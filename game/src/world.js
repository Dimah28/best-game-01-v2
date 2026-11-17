// Stormkite: the world — the whole run in one state machine. Title, play, shop,
// pause, victory and defeat; seven gales, the shop between them, the Tyrant on
// the seventh. Every subsystem lives here; main.js only feeds it input and
// paints what it holds. No DOM in this file, so the sim can be stepped in Node.

import {
  ALL_BEACONS_BONUS,
  BOSS_POINTS,
  GALES,
  GALE_CLEAR_POINTS,
  GRADES,
  GROUND_POINTS,
  HOUSES_PER_VILLAGE,
  SHOP_SECONDS,
  STEP,
  VILLAGES_LOST_LIMIT,
  WORLD_H,
  WORLD_W,
} from './config.js';
import { createRandom } from './random.js';
import { createWind, updateWind } from './wind.js';
import { createKite, kiteSpeed, updateKite } from './kite.js';
import { createIslands, burnedOutCount, litBeaconCount } from './islands.js';
import { createEmber, pickupRadius, updateEmbers } from './embers.js';
import { createBoss, updateBoss, updateCrows } from './crows.js';
import { createShop, buyUpgrade } from './shop.js';
import { burst, floatText, ring, updateParticles } from './particles.js';
import { scheduleBolt, updateLightning } from './lightning.js';

/** A fresh run, waiting on the title screen. */
export function createWorld(random, seed) {
  const galeDef = GALES[0];
  return {
    seed,
    random,
    /** Total seconds the run has lived (drives the boss's orbit). */
    time: 0,
    /** title | play | shop | paused | victory | defeat */
    screen: 'title',
    /** Screen shown before pause, so resume returns to it. */
    screenBeforePause: 'play',
    gale: 1,
    galeDef,
    /** Seconds left in this gale. */
    galeTime: galeDef.duration,
    /** The seventh gale, extended while the Tyrant still flies. */
    overtime: false,
    /** Seconds left in the shop. */
    shopTimer: 0,
    /** Why the run ended, when it has: 'hull' | 'villages' | 'tyrant'. */
    defeatReason: null,

    score: 0,
    best: 0,
    newBest: false,
    /** Chain of scoring actions; multiplies points. */
    chain: 1,
    /** Seconds left before the chain falls back to 1. */
    chainTimer: 0,
    /** Ember currency for the shop. */
    embers: 0,

    kite: createKite(),
    wind: createWind(random, galeDef),
    islands: createIslands(),
    bolts: [],
    embersArr: [],
    crows: [],
    boss: null,
    upgrades: createShop(),
    /** Drifting rain squalls that drag the kite down. */
    rain: [],
    particles: [],
    floats: [],
    shake: 0,
    flash: 0,
    /** Events this step produced, for sound and banners (drained by main.js). */
    events: [],

    boltTimer: galeDef.boltEvery * 0.8,
    emberTimer: 0.5,
    /** Last time a crow pecked the kite; the hull mends after 5 calm seconds. */
    lastPeckAt: -99,
    stats: { caught: 0, grounded: 0, repaired: 0, embersCollected: 0, crowsDispersed: 0, bossHits: 0 },
  };
}

/** The chain multiplier for a scoring event right now. */
export function chainMultiplier(world) {
  return Math.min(4, 1 + 0.25 * (world.chain - 1));
}

/** Add scored points, multiplied by the chain, with a floating label. */
export function scorePoints(world, base, x, y, label) {
  const mult = chainMultiplier(world);
  const points = Math.round(base * mult);
  world.score += points;
  if (x !== undefined) floatText(world, x, y, `+${points}${label ? ' ' + label : ''}`, '#ffd97a', base >= 150);
  return points;
}

/** Bump the chain after a scoring action and refresh its timer. */
function raiseChain(world) {
  world.chain = Math.min(13, world.chain + 1);
  world.chainTimer = 4;
}

/** Drop the chain back to 1 (a peck, an overload, a village burning). */
function dropChain(world) {
  world.chain = 1;
  world.chainTimer = 0;
}

/** The grade for a final score. */
export function gradeFor(score) {
  for (const g of GRADES) {
    if (score >= g.min) return g;
  }
  return GRADES[GRADES.length - 1];
}

/** Begin a gale: fresh wind, rain, bolts and crows; the Tyrant on the seventh. */
function startGale(world) {
  const galeDef = GALES[world.gale - 1];
  world.galeDef = galeDef;
  world.galeTime = galeDef.duration;
  world.overtime = false;
  world.wind = createWind(world.random, galeDef);
  world.bolts = [];
  world.crows = [];
  world.boss = world.gale === 7 ? createBoss(world.random) : null;
  world.boltTimer = galeDef.boltEvery * 0.8;
  world.emberTimer = 0.4;
  world.rain = [];
  for (let i = 0; i < galeDef.rain; i += 1) {
    world.rain.push({
      x: world.random.range(200, WORLD_W - 200),
      y: world.random.range(200, WORLD_H - 200),
      r: 150 + world.random.next() * 60,
      vx: world.random.range(-12, 12),
      vy: world.random.range(-8, 8),
    });
  }
  for (let i = 0; i < 10; i += 1) world.embersArr.push(createEmber(world.random, false));
}

/** Open the shop between gales. */
function openShop(world) {
  world.screen = 'shop';
  world.shopTimer = SHOP_SECONDS;
  world.events.push({ type: 'shop-open', gale: world.gale });
}

/** Close the shop and begin the next gale. */
function closeShop(world) {
  world.gale += 1;
  startGale(world);
  world.screen = 'play';
  world.events.push({ type: 'gale-start', gale: world.gale, name: world.galeDef.name });
}

/** End the run in victory: the storm is survived, the score is graded. */
function winRun(world) {
  world.screen = 'victory';
  world.newBest = world.score > world.best;
  if (world.newBest) world.best = world.score;
  world.events.push({ type: 'victory', score: world.score });
}

/** End the run in defeat, with the reason for the results screen. */
function loseRun(world, reason) {
  world.screen = 'defeat';
  world.defeatReason = reason;
  world.newBest = world.score > world.best;
  if (world.newBest) world.best = world.score;
  world.events.push({ type: 'defeat', reason, score: world.score });
}

/**
 * Advance the world one fixed step. `input` carries thrust, tether, ability
 * flags and the edge-triggered presses since the last step. Returns the step's
 * events (also appended to world.events for main.js to drain).
 */
export function updateWorld(world, input, dt = STEP) {
  const events = [];
  world.events = events;

  // Title: any confirm starts the first gale.
  if (world.screen === 'title') {
    if (input.pressed.includes('confirm')) {
      startGale(world);
      world.screen = 'play';
      events.push({ type: 'run-start' });
    }
    return events;
  }

  // Results: confirm or restart begins a fresh run with a new seed.
  if (world.screen === 'victory' || world.screen === 'defeat') {
    if (input.pressed.includes('confirm') || input.pressed.includes('restart')) {
      const fresh = createWorld(createRandom((Math.random() * 4294967296) >>> 0), world.seed + 1);
      Object.keys(fresh).forEach((key) => { world[key] = fresh[key]; });
      startGale(world);
      world.screen = 'play';
      events.push({ type: 'run-start' });
    }
    return events;
  }

  // Pause: only pause/confirm matter.
  if (world.screen === 'paused') {
    if (input.pressed.includes('pause') || input.pressed.includes('confirm')) {
      world.screen = world.screenBeforePause;
      events.push({ type: 'resume' });
    }
    return events;
  }

  // Shop: buy with 1-6, confirm (or the timer) moves on.
  if (world.screen === 'shop') {
    world.shopTimer -= dt;
    for (const press of input.pressed) {
      const n = Number.parseInt(press, 10);
      if (n >= 1 && n <= 6) {
        const bought = buyUpgrade(world, ['sail', 'tail', 'bell', 'sight', 'hull', 'magnet'][n - 1]);
        if (bought) events.push({ type: 'buy', upgrade: bought.name });
      }
    }
    if (input.pressed.includes('confirm') || input.pressed.includes('restart') || world.shopTimer <= 0) {
      closeShop(world);
    }
    updateParticles(world, dt);
    return events;
  }

  // --- Play ---
  world.time += dt;
  if (input.pressed.includes('pause')) {
    world.screenBeforePause = 'play';
    world.screen = 'paused';
    events.push({ type: 'pause' });
    return events;
  }

  const { kite } = world;

  // Kite + wind.
  const kiteEvents = updateKite(kite, {
    tx: input.tx, ty: input.ty,
    mouseX: input.mouseX, mouseY: input.mouseY,
    tether: input.tether,
    gust: input.pressed.includes('gust'),
    bell: input.pressed.includes('bell'),
    flare: input.pressed.includes('flare'),
  }, world.wind, world.upgrades, dt);
  for (const e of kiteEvents) {
    if (e === 'gust') {
      events.push({ type: 'gust' });
      burst(world, kite.x, kite.y, '#9fd8ff', 10, 160);
      // A gust at full tilt knocks nearby crows back.
      for (const crow of world.crows) {
        const d = Math.hypot(crow.x - kite.x, crow.y - kite.y);
        if (d < 150) {
          crow.state = 'flee';
          crow.stateT = 1.5;
          crow.vx += ((crow.x - kite.x) / (d || 1)) * 260;
          crow.vy += ((crow.y - kite.y) / (d || 1)) * 260;
        }
      }
    }
    if (e === 'bell') {
      events.push({ type: 'bell' });
      ring(world, kite.x, kite.y, '#ffe9a8');
    }
    if (e === 'flare') {
      events.push({ type: 'flare' });
      burst(world, kite.x, kite.y, '#ffd97a', 22, 260);
      world.flash = 0.7;
    }
  }

  updateWind(world.wind, world.random, world.galeDef, dt);

  // Rain squalls drift and drag the kite.
  for (const zone of world.rain) {
    zone.x += zone.vx * dt;
    zone.y += zone.vy * dt;
    if (zone.x < 120 || zone.x > WORLD_W - 120) zone.vx *= -1;
    if (zone.y < 120 || zone.y > WORLD_H - 120) zone.vy *= -1;
    if (Math.hypot(kite.x - zone.x, kite.y - zone.y) < zone.r) {
      kite.vx *= Math.exp(-0.7 * dt);
      kite.vy *= Math.exp(-0.7 * dt);
      kite.stamina = Math.max(0, kite.stamina - 9 * dt);
    }
  }

  // Embers drift; the kite sweeps them up.
  updateEmbers(world, dt);
  const reach = pickupRadius(world.upgrades);
  for (let i = world.embersArr.length - 1; i >= 0; i -= 1) {
    const ember = world.embersArr[i];
    const d = Math.hypot(kite.x - ember.x, kite.y - ember.y);
    if (d < reach) {
      world.embersArr.splice(i, 1);
      const value = ember.golden ? 5 : 1;
      world.embers += value;
      world.stats.embersCollected += 1;
      world.chainTimer = 4;
      scorePoints(world, ember.golden ? 50 : 10, ember.x, ember.y - 14, ember.golden ? 'GOLD' : null);
      burst(world, ember.x, ember.y, ember.golden ? '#ffe066' : '#ffb347', ember.golden ? 10 : 5, 120);
      events.push({ type: 'ember', golden: ember.golden });
    }
  }

  // Lightning: schedule, telegraph, strike, catch, ground.
  world.boltTimer -= dt;
  if (world.boltTimer <= 0) {
    world.boltTimer = world.galeDef.boltEvery * (0.85 + world.random.next() * 0.3);
    world.bolts.push(scheduleBolt(world.random, world.islands, kite, world.galeDef, !!world.boss));
    events.push({ type: 'bolt-warn' });
  }
  for (const e of updateLightning(world, dt)) {
    if (e.type === 'catch') {
      world.stats.caught += 1;
      raiseChain(world);
      scorePoints(world, e.points, kite.x, kite.y - 30, 'CAUGHT!');
      burst(world, kite.x, kite.y, '#cfe8ff', 26, 300);
      ring(world, kite.x, kite.y, '#bcd8ff');
      world.flash = 1;
      world.shake = 7;
      events.push(e);
    } else if (e.type === 'overload') {
      dropChain(world);
      floatText(world, kite.x, kite.y - 30, 'OVERLOAD!', '#ff7a6b', true);
      world.shake = 10;
      events.push(e);
    } else if (e.type === 'ground') {
      world.stats.grounded += 1;
      raiseChain(world);
      scorePoints(world, GROUND_POINTS, kite.x, kite.y - 30, 'GROUNDED');
      burst(world, kite.x, kite.y, '#ffd97a', 20, 240);
      events.push(e);
    } else if (e.type === 'repair') {
      world.stats.repaired += 1;
      raiseChain(world);
      scorePoints(world, e.points, kite.x, kite.y - 30, `${e.island.toUpperCase()} REBUILT`);
      burst(world, kite.x, kite.y, '#7ddc8a', 12, 180);
      events.push(e);
    } else if (e.type === 'all-lit') {
      scorePoints(world, ALL_BEACONS_BONUS, kite.x, kite.y - 56, 'ALL BEACONS LIT!');
      events.push(e);
    } else if (e.type === 'burn') {
      dropChain(world);
      const burned = burnedOutCount(world.islands);
      floatText(world, kite.x, kite.y - 30, `${e.island.toUpperCase()} BURNS!`, '#ff9a6b', true);
      world.shake = 9;
      events.push({ ...e, burnedOut: burned });
      if (burned >= VILLAGES_LOST_LIMIT) {
        loseRun(world, 'villages');
        return events;
      }
    } else {
      events.push(e);
    }
  }

  // The hull mends itself after four calm seconds without a peck.
  if (world.time - world.lastPeckAt > 4 && kite.hull < kite.maxHull) {
    kite.hull = Math.min(kite.maxHull, kite.hull + 2.2 * dt);
  }

  // Crows and the Tyrant.
  for (const e of updateCrows(world, dt)) {
    if (e.type === 'peck') {
      world.lastPeckAt = world.time;
      dropChain(world);
      floatText(world, kite.x, kite.y - 30, '-8 HULL', '#ff7a6b', false);
      world.shake = 6;
      events.push(e);
    } else if (e.type === 'disperse') {
      world.stats.crowsDispersed += 1;
      scorePoints(world, e.points, e.x, e.y, 'DISPERSED');
      burst(world, e.x, e.y, '#8a93b8', 12, 200);
      events.push(e);
    }
  }
  for (const e of updateBoss(world, dt)) {
    if (e.type === 'boss-hit') {
      world.stats.bossHits += 1;
      raiseChain(world);
      scorePoints(world, e.points, e.x, e.y - 40, `-${e.damage}`);
      burst(world, e.x, e.y, '#e84855', 18, 260);
      world.shake = 8;
      events.push(e);
    } else if (e.type === 'boss-down') {
      scorePoints(world, BOSS_POINTS, e.x, e.y - 60, 'TYRANT DOWN!');
      burst(world, e.x, e.y, '#ffd97a', 40, 340);
      ring(world, e.x, e.y, '#ffd97a');
      world.boss = null;
      world.flash = 1;
      world.shake = 12;
      events.push(e);
      winRun(world);
      return events;
    } else {
      events.push(e);
    }
  }

  // Chain decay.
  if (world.chainTimer > 0) {
    world.chainTimer -= dt;
    if (world.chainTimer <= 0) dropChain(world);
  }

  // Gale clock.
  world.galeTime -= dt;
  if (world.galeTime <= 0) {
    if (world.gale >= 7) {
      if (world.boss) {
        if (!world.overtime) {
          world.overtime = true;
          world.galeTime = 45;
          events.push({ type: 'overtime' });
          floatText(world, kite.x, kite.y - 60, 'OVERTIME — BRING DOWN THE TYRANT', '#ff9a6b', true);
        } else {
          loseRun(world, 'tyrant');
          return events;
        }
      } else {
        winRun(world);
        return events;
      }
    } else {
      scorePoints(world, GALE_CLEAR_POINTS, kite.x, kite.y - 40, `GALE ${world.gale} CLEAR!`);
      openShop(world);
      return events;
    }
  }

  // Defeat by hull.
  if (kite.hull <= 0) {
    kite.hull = 0;
    loseRun(world, 'hull');
    return events;
  }

  updateParticles(world, dt);
  return events;
}
