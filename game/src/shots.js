// Stormkite: screenshot staging and the autopilot. ?shot=title|play|boss|win
// (with &seed=N) stages that scene instead of running the loop: the world is
// fast-forwarded with a simple autopilot that flies the kite, catches bolts and
// buys upgrades, then the frame is painted twice and window.__shotReady is set
// for the screenshot. The staged scenes are the game's own code, mid-flight.

import { STEP } from './config.js';
import { createWorld, updateWorld } from './world.js';
import { createRandom } from './random.js';
import { buyUpgrade } from './shop.js';
import { lightBeacon } from './islands.js';

/** One autopilot step: steer the kite at whatever matters most right now. */
export function autopilotInput(world) {
  const kite = world.kite;
  const input = { tx: 0, ty: 0, mouseX: null, mouseY: null, tether: false, pressed: [] };
  let target = null;

  // An urgent telegraphed bolt the kite can reach is always worth chasing.
  let urgentBolt = null;
  for (const bolt of world.bolts) {
    const d = Math.hypot(bolt.x - kite.x, bolt.y - kite.y);
    if (bolt.t < 1.6 && bolt.t > d / 460 + 0.2) {
      urgentBolt = bolt;
      break;
    }
  }
  if (urgentBolt) {
    target = urgentBolt;
  } else if (world.boss) {
    // The Tyrant is the win condition: hunt it, bell it, ram it.
    const lead = 0.4;
    target = {
      x: world.boss.x + world.boss.vx * lead,
      y: world.boss.y + world.boss.vy * lead,
    };
  } else {
    // A telegraphed bolt the kite can reach is always worth chasing.
    for (const bolt of world.bolts) {
      const d = Math.hypot(bolt.x - kite.x, bolt.y - kite.y);
      if (bolt.t > d / 460 + 0.25) {
        target = { x: bolt.x, y: bolt.y };
        break;
      }
    }
  }
  // Charged: fly for the nearest dark beacon and ground it.
  if (!target && kite.charge > 0) {
    let best = null;
    let bestD = Infinity;
    for (const island of world.islands) {
      if (island.beacon.lit) continue;
      const d = Math.hypot(island.beacon.x - kite.x, island.beacon.y - kite.y);
      if (d < bestD) {
        bestD = d;
        best = island.beacon;
      }
    }
    if (best) target = best;
  }
  // Otherwise sweep up the nearest ember.
  if (!target && world.embersArr.length > 0) {
    let best = null;
    let bestD = Infinity;
    for (const ember of world.embersArr) {
      const d = Math.hypot(ember.x - kite.x, ember.y - kite.y);
      if (d < bestD) {
        bestD = d;
        best = ember;
      }
    }
    if (best) target = best;
  }
  // Nothing to chase: hold over the heart of the archipelago.
  if (!target) target = { x: 800, y: 470 };

  const dx = target.x - kite.x;
  const dy = target.y - kite.y;
  const d = Math.hypot(dx, dy) || 1;
  // Thrust whenever the target is far; stamina self-regulates (empty stamina
  // halves thrust, and the kite keeps its speed while it recovers).
  if (d > 120) {
    input.tx = dx / d;
    input.ty = dy / d;
  }
  // A long haul is worth a Gust — unless the Tyrant flies, when every Gust
  // is saved for the ram.
  if (!world.boss && d > 380 && kite.stamina > 55 && kite.gustCd <= 0) input.pressed.push('gust');

  // A crow closing in: break away from it instead of flying into the peck.
  for (const crow of world.crows) {
    const cd = Math.hypot(crow.x - kite.x, crow.y - kite.y);
    if (cd < 150) {
      const ax = kite.x - crow.x;
      const ay = kite.y - crow.y;
      const al = Math.hypot(ax, ay) || 1;
      input.tx = ax / al;
      input.ty = ay / al;
      if (cd < 130 && kite.bellCd <= 0) input.pressed.push('bell');
      break;
    }
  }
  // The Tyrant: bell it to freeze it, then ram it at full tilt. Ramming needs
  // a run-up — a kite hovering in the boss's face never builds speed, so the
  // hunt jousts: back off when too close, dive when the range is right. And a
  // dive needs stamina, so the kite rests its wings between dives.
  if (world.boss) {
    const bd = Math.hypot(world.boss.x - kite.x, world.boss.y - kite.y);
    if (bd < 300 && kite.bellCd <= 0 && world.boss.stun <= 0) {
      input.pressed.push('bell');
    }
    if (world.boss.stun <= 0 && kite.stamina < 40) {
      // Rest: coast and let stamina recover for the next dive.
      input.tx = 0;
      input.ty = 0;
      return input;
    }
    // A dive without a Gust is a slow bump, not a ram — if the Gust cannot
    // fire (stamina under 25), rest even mid-stun: the Tyrant is frozen, it
    // is not going anywhere.
    if (kite.stamina < 25) {
      input.tx = 0;
      input.ty = 0;
      return input;
    }
    if (world.boss.stun > 0) {
      // Frozen: dive straight at it and gust from range.
      input.tx = (world.boss.x - kite.x) / (bd || 1);
      input.ty = (world.boss.y - kite.y) / (bd || 1);
      if (bd < 300 && kite.gustCd <= 0 && kite.stamina >= 25) input.pressed.push('gust');
      return input;
    }
    if (bd < 180) {
      // Too close to ram: back off for a run-up.
      input.tx = (kite.x - world.boss.x) / (bd || 1);
      input.ty = (kite.y - world.boss.y) / (bd || 1);
      return input;
    }
    if (bd < 320 && kite.gustCd <= 0 && kite.stamina >= 25) {
      // In range: dive through it.
      const lead = 0.45;
      const px = world.boss.x + world.boss.vx * lead;
      const py = world.boss.y + world.boss.vy * lead;
      const pd = Math.hypot(px - kite.x, py - kite.y) || 1;
      input.tx = (px - kite.x) / pd;
      input.ty = (py - kite.y) / pd;
      input.pressed.push('gust');
    }
  }
  return input;
}

/** Run the world forward with the autopilot until a condition holds. */
function fastForward(world, until, maxSteps) {
  let steps = 0;
  while (steps < maxSteps && !until(world)) {
    const input = { tx: 0, ty: 0, mouseX: null, mouseY: null, tether: false, pressed: [] };
    if (world.screen === 'title') {
      input.pressed.push('confirm');
    } else if (world.screen === 'shop') {
      // Buy the cheapest upgrade the run can afford, then fly on.
      const order = ['sail', 'bell', 'magnet', 'hull', 'tail', 'sight'];
      for (const id of order) {
        if (buyUpgrade(world, id)) break;
      }
      input.pressed.push('confirm');
    } else if (world.screen === 'play') {
      Object.assign(input, autopilotInput(world));
    } else {
      break;
    }
    updateWorld(world, input, STEP);
    steps += 1;
  }
  return steps;
}

/**
 * Stage a scene for a screenshot. Returns the world, already flown to the
 * moment the screenshot should show.
 */
export function stageShot(shot, seed) {
  const world = createWorld(createRandom(seed), seed);
  world.best = 18460;

  if (shot === 'title') {
    world.time = 6;
    return world;
  }

  if (shot === 'win') {
    world.screen = 'victory';
    world.score = 19280;
    world.best = 19280;
    world.newBest = true;
    world.gale = 7;
    // Stats from a real winning sim run (seed 7): 4 stunned rams kill the
    // Tyrant, 5 beacons grounded, 7 houses rebuilt.
    world.stats = { caught: 21, grounded: 5, repaired: 7, embersCollected: 152, crowsDispersed: 1, bossHits: 4 };
    world.upgrades = { sail: 3, tail: 2, bell: 2, sight: 1, hull: 2, magnet: 2 };
    world.kite.hull = 64;
    world.kite.charge = 1;
    world.time = 480;
    return world;
  }

  // Play and boss: fly the run with the autopilot to the right gale.
  fastForward(world, (w) => w.screen === 'play' && w.gale === 5 && w.galeTime < 42, 30000);
  if (shot === 'play') {
    finishPlayShot(world);
    return world;
  }

  // Boss: on to the seventh gale — catch the Tyrant the moment it arrives.
  fastForward(world, (w) => w.screen === 'play' && w.gale === 7 && w.boss, 30000);
  // One second of fight so the scene is alive, then freeze the Tyrant at
  // half health for the shot. The autopilot kills a wounded boss in ~5s, so
  // the frame has to be taken before it can finish the job — set the health
  // after the warm-up steps, not before them.
  for (let i = 0; i < 60; i += 1) updateWorld(world, autopilotInput(world), STEP);
  if (world.boss) world.boss.hp = Math.round(world.boss.maxHp * 0.55);
  finishPlayShot(world);
  return world;
}

/** Richen a mid-play scene so the screenshot reads at a glance. */
function finishPlayShot(world) {
  // A chain, relics and embers in hand.
  world.chain = 5;
  world.chainTimer = 3.5;
  world.embers = Math.max(world.embers, 23);
  // Two beacons lit, so the beacon panel tells a story.
  let lit = 0;
  for (const island of world.islands) {
    if (lit < 2 && !island.beacon.lit) {
      lightBeacon(island);
      lit += 1;
    }
  }
  // A bolt telegraphed, close enough to read, far enough to survive the shot.
  if (world.bolts.length === 0) {
    world.bolts.push({
      x: world.kite.x + 180, y: world.kite.y - 120,
      t: 1.4, telegraph: 3.2, aimed: false,
      jag: [4, -8, 10, -6, 8, -10, 5],
    });
  }
  // A few crows in frame.
  while (world.crows.length < 3) {
    world.crows.push({
      x: world.kite.x + 200 + world.crows.length * 90,
      y: world.kite.y - 140 + world.crows.length * 60,
      vx: -40, vy: 20, state: 'hunt', stateT: 2, flap: 1.2, hp: 1,
    });
  }
}
