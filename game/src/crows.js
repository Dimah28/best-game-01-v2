// Stormkite: storm-crows and the Gale Tyrant. Crows hunt the kite and peck its
// hull; the Bell scares them off and a fast kite disperses them. On the seventh
// gale the Tyrant — a crow the size of a house — calls lightning down on the
// kite and must be rammed at full speed to be brought down.

import { WORLD_H, WORLD_W } from './config.js';

/** A storm-crow, hunting the kite. */
export function createCrow(random, kite) {
  const edge = random.int(4);
  let x;
  let y;
  if (edge === 0) { x = random.range(100, WORLD_W - 100); y = 70; }
  else if (edge === 1) { x = random.range(100, WORLD_W - 100); y = WORLD_H - 70; }
  else if (edge === 2) { x = 70; y = random.range(100, WORLD_H - 100); }
  else { x = WORLD_W - 70; y = random.range(100, WORLD_H - 100); }
  return {
    x, y, vx: 0, vy: 0,
    /** hunt: closing on the kite. peck: striking. flee: scared off. */
    state: 'hunt',
    stateT: 0,
    flap: random.next() * Math.PI * 2,
    hp: 1,
  };
}

/** The Gale Tyrant, boss of the seventh gale. */
export function createBoss(random) {
  return {
    x: WORLD_W / 2,
    y: 180,
    vx: 0,
    vy: 0,
    hp: 300,
    maxHp: 300,
    /** Seconds until its next called-down bolt. */
    boltIn: 5,
    /** Seconds until it spawns more crows. */
    spawnIn: 11,
    /** Seconds of stun left after a bell (rams hurt more while stunned). */
    stun: 0,
    angle: 0,
    flap: 0,
    phase: 1,
  };
}

/**
 * Advance the crows one step. Returns events: 'peck' (hull lost) and
 * 'disperse' (a crow scattered by a fast kite).
 */
export function updateCrows(world, dt) {
  const events = [];
  const { kite, random } = world;
  const wardR = 240 + 60 * (world.upgrades.bell || 0);

  for (let i = world.crows.length - 1; i >= 0; i -= 1) {
    const crow = world.crows[i];
    crow.flap += dt * 9;
    crow.stateT -= dt;
    const dx = kite.x - crow.x;
    const dy = kite.y - crow.y;
    const d = Math.hypot(dx, dy) || 1;

    // The bell ward and a fresh Gust send crows fleeing.
    if (kite.bellWard > 0 && d < wardR) {
      crow.state = 'flee';
      crow.stateT = 3;
    }
    if (crow.state === 'flee') {
      crow.vx += (-dx / d) * 320 * dt;
      crow.vy += (-dy / d) * 320 * dt;
      if (crow.stateT <= 0) crow.state = 'hunt';
    } else if (crow.state === 'peck') {
      // A peck already landed; the crow pulls away to circle again.
      crow.vx += (-dx / d) * 200 * dt;
      crow.vy += (-dy / d) * 200 * dt;
      if (crow.stateT <= 0) crow.state = 'hunt';
    } else {
      // Hunt: steer at the kite, faster when close.
      const speed = 140 + world.gale * 10;
      crow.vx += (dx / d) * speed * dt * 1.5;
      crow.vy += (dy / d) * speed * dt * 1.5;
      if (d < 30 && kite.hurtCd <= 0) {
        kite.hull -= 5;
        kite.hurtCd = 0.9;
        crow.state = 'peck';
        crow.stateT = 2.0;
        events.push({ type: 'peck', points: 0 });
      }
    }

    // A kite at full tilt disperses a crow it touches.
    const kiteSpeed = Math.hypot(kite.vx, kite.vy);
    if (d < 34 && kiteSpeed > 300) {
      world.crows.splice(i, 1);
      events.push({ type: 'disperse', points: 25, x: crow.x, y: crow.y });
      continue;
    }

    const drag = Math.exp(-1.1 * dt);
    crow.vx *= drag;
    crow.vy *= drag;
    const cs = Math.hypot(crow.vx, crow.vy);
    const cap = 230;
    if (cs > cap) {
      crow.vx = (crow.vx / cs) * cap;
      crow.vy = (crow.vy / cs) * cap;
    }
    crow.x += crow.vx * dt;
    crow.y += crow.vy * dt;
    crow.x = Math.max(40, Math.min(WORLD_W - 40, crow.x));
    crow.y = Math.max(40, Math.min(WORLD_H - 40, crow.y));
  }

  // Keep the sky stocked up to the gale's crow count.
  while (world.crows.length < world.galeDef.crows && world.screen === 'play') {
    world.crows.push(createCrow(random, kite));
  }
  return events;
}

/**
 * Advance the Tyrant one step. It sweeps the sky in wide arcs, calls bolts down
 * on the kite, and spawns crows. A fast kite ramming it hurts it — more while
 * it is stunned by the bell. Returns events: 'boss-hit' and 'boss-down'.
 */
export function updateBoss(world, dt) {
  const events = [];
  const boss = world.boss;
  if (!boss) return events;
  const { kite, random } = world;
  boss.flap += dt * 6;
  boss.stun = Math.max(0, boss.stun - dt);
  boss.phase = boss.hp < boss.maxHp / 2 ? 2 : 1;

  // Sweep: a wide orbit around the heart of the archipelago, faster and
  // tighter in phase 2 — a fixed circuit the kite can cut across to ram it.
  // (It used to orbit the kite itself, which no kite could ever catch.)
  // Stunned (by the bell), the Tyrant hangs where it stands — ram it now.
  const orbitR = boss.phase === 2 ? 220 : 300;
  const orbitSpeed = boss.phase === 2 ? 0.45 : 0.32;
  const tx = WORLD_W / 2 + Math.cos(world.time * orbitSpeed) * orbitR;
  const ty = WORLD_H / 2 + Math.sin(world.time * orbitSpeed * 1.3) * orbitR * 0.6 - 60;
  if (boss.stun <= 0) {
    boss.vx += (tx - boss.x) * 1.6 * dt;
    boss.vy += (ty - boss.y) * 1.6 * dt;
  }
  const drag = Math.exp(-1.4 * dt);
  boss.vx *= drag;
  boss.vy *= drag;
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;
  boss.x = Math.max(90, Math.min(WORLD_W - 90, boss.x));
  boss.y = Math.max(90, Math.min(WORLD_H - 90, boss.y));
  boss.angle = Math.atan2(boss.vy, boss.vx);

  // Call lightning down on the kite.
  boss.boltIn -= dt;
  if (boss.boltIn <= 0) {
    boss.boltIn = boss.phase === 2 ? 5.5 : 6;
    world.bolts.push({
      x: kite.x + random.range(-30, 30),
      y: kite.y + random.range(-30, 30),
      t: 2.2, telegraph: 2.2, aimed: true,
      jag: Array.from({ length: 7 }, () => random.range(-14, 14)),
    });
    events.push({ type: 'boss-bolt', points: 0 });
  }

  // Spawn crows to harry the kite — never more than a skyful.
  boss.spawnIn -= dt;
  if (boss.spawnIn <= 0) {
    boss.spawnIn = 12;
    if (world.crows.length < 8) world.crows.push(createCrow(random, kite));
    if (world.crows.length < 8) world.crows.push(createCrow(random, kite));
  }

  // Ramming: a fast kite hurts the Tyrant; a stunned one hurts far more.
  const d = Math.hypot(kite.x - boss.x, kite.y - boss.y);
  const kiteSpeed = Math.hypot(kite.vx, kite.vy);
  if (d < 92 && kiteSpeed > 300 && kite.ramCd <= 0) {
    const damage = boss.stun > 0 ? 90 : 40;
    boss.hp -= damage;
    kite.ramCd = 1.0;
    kite.vx = -kite.vx * 0.6;
    kite.vy = -kite.vy * 0.6;
    events.push({ type: 'boss-hit', points: 60, damage, x: boss.x, y: boss.y });
    if (boss.hp <= 0) {
      events.push({ type: 'boss-down', points: 2000, x: boss.x, y: boss.y });
    }
  }

  // The bell stuns the Tyrant where it stands.
  if (kite.bellWard > 0 && d < 300 && boss.stun <= 0) {
    boss.stun = 2.5;
  }
  return events;
}
