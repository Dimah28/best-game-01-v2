// Stormkite: lightning. Bolts telegraph their strike (a shrinking ring and a
// warning), then land. A kite inside the strike circle CATCHES the bolt in its
// copper tail; a bolt no one catches burns the island beneath it — or, on the
// seventh gale, is called down on the kite itself by the Gale Tyrant.

import { CATCH_POINTS, CATCH_RADIUS, GROUND_POINTS, GROUND_RADIUS, WORLD_H, WORLD_W } from './config.js';
import { burnNearestHouse, housesLeft, islandAt, lightBeacon, litBeaconCount } from './islands.js';

/** A bolt warming up: where it will land, and how long until it does. */
export function createBolt(random, x, y, telegraph, aimed) {
  return {
    x, y,
    /** Seconds left before the strike. */
    t: telegraph,
    telegraph,
    /** True when the Tyrant called it down on the kite. */
    aimed: !!aimed,
    /** Jitter for the drawn bolt's jagged path. */
    jag: Array.from({ length: 7 }, () => random.range(-14, 14)),
  };
}

/**
 * Schedule the next bolt. Most fall on a random island; some hunt the kite;
 * the Tyrant's bolts always hunt the kite.
 */
export function scheduleBolt(random, islands, kite, gale, bossActive) {
  const roll = random.next();
  let x;
  let y;
  let aimed = false;
  if (bossActive || roll < 0.4) {
    aimed = true;
    x = kite.x + random.range(-40, 40);
    y = kite.y + random.range(-40, 40);
  } else if (roll < 0.75) {
    const island = random.pick(islands);
    const a = random.next() * Math.PI * 2;
    const r = random.next() * island.r * 0.7;
    x = island.x + Math.cos(a) * r;
    y = island.y + Math.sin(a) * r;
  } else {
    // Open sea: a bolt no village needs to fear.
    x = random.range(200, WORLD_W - 200);
    y = random.range(560, WORLD_H - 120);
  }
  x = Math.max(80, Math.min(WORLD_W - 80, x));
  y = Math.max(80, Math.min(WORLD_H - 80, y));
  return createBolt(random, x, y, bossActive ? 2.2 : 3.2, aimed);
}

/**
 * Advance all bolts one step. Returns events for the frame:
 * 'catch' (the kite caught one), 'overload' (caught with a full tail),
 * 'burn' (an island house burned), 'sea' (a bolt fell on open water),
 * 'ground' (a charge was grounded into a beacon), 'all-lit' (last beacon lit).
 * Scoring and the chain live in world.js; this module reports what happened.
 */
export function updateLightning(world, dt) {
  const events = [];
  const { kite, islands, random } = world;

  // Grounding: a charged kite over a dark beacon lights it; over a lit beacon
  // with burned houses, the charge rebuilds one house instead.
  if (kite.charge > 0) {
    for (const island of islands) {
      if (island.beacon.lit && housesLeft(island) >= 3) continue;
      const d = Math.hypot(kite.x - island.beacon.x, kite.y - island.beacon.y);
      if (d < GROUND_RADIUS) {
        if (!island.beacon.lit) {
          lightBeacon(island);
          kite.charge -= 1;
          kite.hull = Math.min(kite.maxHull, kite.hull + 10);
          events.push({ type: 'ground', island: island.name, beacons: litBeaconCount(islands) });
          if (litBeaconCount(islands) === islands.length) events.push({ type: 'all-lit' });
        } else {
          island.houses[island.houses.indexOf(false)] = true;
          kite.charge -= 1;
          events.push({ type: 'repair', island: island.name, points: 100 });
        }
        break;
      }
    }
  }

  // Flare light kindles dark beacons at range while it burns.
  if (kite.flareLight > 0) {
    for (const island of islands) {
      if (island.beacon.lit) continue;
      const d = Math.hypot(kite.x - island.beacon.x, kite.y - island.beacon.y);
      if (d < 320) {
        lightBeacon(island);
        events.push({ type: 'ground', island: island.name, beacons: litBeaconCount(islands), flare: true });
        if (litBeaconCount(islands) === islands.length) events.push({ type: 'all-lit' });
      }
    }
  }

  // Bolts count down, then strike.
  for (let i = world.bolts.length - 1; i >= 0; i -= 1) {
    const bolt = world.bolts[i];
    bolt.t -= dt;
    if (bolt.t > 0) continue;
    world.bolts.splice(i, 1);
    const d = Math.hypot(kite.x - bolt.x, kite.y - bolt.y);
    if (d < CATCH_RADIUS) {
      if (kite.charge >= kite.maxCharge) {
        kite.charge = 0;
        kite.hull -= 12;
        events.push({ type: 'overload', points: 0 });
      } else {
        kite.charge += 1;
        kite.glow = 1;
        events.push({ type: 'catch', points: CATCH_POINTS });
      }
    } else {
      const island = islandAt(islands, bolt.x, bolt.y);
      if (island) {
        const burned = burnNearestHouse(islands, bolt.x, bolt.y);
        events.push({ type: 'burn', island: burned ? burned.name : island.name, points: 0 });
      } else {
        events.push({ type: 'sea', points: 0 });
      }
    }
  }
  return events;
}
