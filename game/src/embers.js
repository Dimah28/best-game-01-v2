// Stormkite: storm-embers. Little coals of the storm drift on the wind; the kite
// sweeps them up for score and for the ember currency the shop spends. Golden
// embers are rare and worth five.

import { WORLD_H, WORLD_W } from './config.js';
import { windAt } from './wind.js';

/** An ember drifting on the wind. */
export function createEmber(random, golden) {
  return {
    x: random.range(120, WORLD_W - 120),
    y: random.range(120, WORLD_H - 120),
    golden: !!golden,
    /** Slow bob so the drift reads as alive. */
    phase: random.next() * Math.PI * 2,
    age: 0,
  };
}

/**
 * Advance embers one step: they ride the wind, bob, and fade after a while.
 * Pickups are scored by world.js; this module only moves them.
 */
export function updateEmbers(world, dt) {
  const { wind, random } = world;
  for (let i = world.embersArr.length - 1; i >= 0; i -= 1) {
    const ember = world.embersArr[i];
    ember.age += dt;
    const w = windAt(wind, ember.x, ember.y);
    ember.x += w.x * 0.35 * dt + Math.cos(ember.phase + ember.age * 2) * 12 * dt;
    ember.y += w.y * 0.35 * dt + Math.sin(ember.phase + ember.age * 2.6) * 10 * dt;
    if (ember.x < 40 || ember.x > WORLD_W - 40 || ember.y < 40 || ember.y > WORLD_H - 40 || ember.age > 26) {
      world.embersArr.splice(i, 1);
    }
  }
  // Keep the sky stocked: a new ember drifts in on the gale's schedule.
  world.emberTimer -= dt;
  if (world.emberTimer <= 0) {
    world.emberTimer = world.galeDef.emberEvery;
    world.embersArr.push(createEmber(random, random.next() < 0.08));
  }
}

/** Pickup reach of the kite, widened by the Ember Magnet. */
export function pickupRadius(upgrades) {
  return 42 * (1 + 0.7 * (upgrades.magnet || 0));
}
