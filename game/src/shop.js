// Stormkite: the between-gale shop. The run pauses, the player spends embers
// on named upgrades, then the next gale begins. Buying is one function so the
// shop panel, the keys and the autopilot all buy the same way.

import { UPGRADES } from './config.js';

/** The shop's current state: which upgrades the player owns. */
export function createShop() {
  return { sail: 0, tail: 0, bell: 0, sight: 0, hull: 0, magnet: 0 };
}

/** What an upgrade costs at its next tier, or null when it is maxed. */
export function upgradeCost(upgrade, owned) {
  const tier = owned[upgrade.id] || 0;
  if (tier >= upgrade.max) return null;
  return upgrade.costs[tier];
}

/**
 * Buy an upgrade with embers. Returns the upgrade bought, or null when the
 * player cannot afford it or it is maxed. Applies the instant effects
 * (hull plating mends the kite; the copper tail widens it).
 */
export function buyUpgrade(world, upgradeId) {
  const upgrade = UPGRADES.find((u) => u.id === upgradeId);
  if (!upgrade) return null;
  const cost = upgradeCost(upgrade, world.upgrades);
  if (cost === null || world.embers < cost) return null;
  world.embers -= cost;
  world.upgrades[upgrade.id] = (world.upgrades[upgrade.id] || 0) + 1;
  if (upgrade.id === 'hull') {
    world.kite.maxHull += 30;
    world.kite.hull = Math.min(world.kite.maxHull, world.kite.hull + 30);
  }
  if (upgrade.id === 'tail') {
    world.kite.maxCharge += 1;
  }
  return upgrade;
}

/** The shop's rows for the panel: each upgrade, its tier, cost and afford state. */
export function shopRows(world) {
  return UPGRADES.map((upgrade) => {
    const cost = upgradeCost(upgrade, world.upgrades);
    return {
      upgrade,
      tier: world.upgrades[upgrade.id] || 0,
      cost,
      afford: cost !== null && world.embers >= cost,
    };
  });
}
