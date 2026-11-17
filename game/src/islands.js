// Stormkite: the Ember Archipelago — five island villages and their beacon towers.
// Lightning that no one catches burns a house; a village with no houses left is
// burned out, and three burned-out villages end the run.

import { HOUSES_PER_VILLAGE } from './config.js';

/** The five islands, placed so the kite always has somewhere to fly. */
export function createIslands() {
  return [
    { name: 'Beacon Prime', x: 800, y: 470, r: 150, houses: [true, true, true, true], beacon: { x: 800, y: 430, lit: false } },
    { name: 'Gull Rest', x: 330, y: 250, r: 105, houses: [true, true, true, true], beacon: { x: 330, y: 220, lit: false } },
    { name: 'Copper Shoal', x: 1280, y: 260, r: 110, houses: [true, true, true, true], beacon: { x: 1280, y: 228, lit: false } },
    { name: 'Widow Rock', x: 360, y: 700, r: 100, houses: [true, true, true, true], beacon: { x: 360, y: 672, lit: false } },
    { name: 'Saltspire', x: 1260, y: 690, r: 105, houses: [true, true, true, true], beacon: { x: 1260, y: 660, lit: false } },
  ];
}

/** Houses still standing on an island. */
export function housesLeft(island) {
  return island.houses.filter(Boolean).length;
}

/** Is the village burned out (no house left)? */
export function isBurnedOut(island) {
  return housesLeft(island) === 0;
}

/** How many villages are burned out across the archipelago. */
export function burnedOutCount(islands) {
  return islands.filter(isBurnedOut).length;
}

/** How many beacons are lit. */
export function litBeaconCount(islands) {
  return islands.filter((island) => island.beacon.lit).length;
}

/** The island under a point, or null when the point is open sea. */
export function islandAt(islands, x, y) {
  for (const island of islands) {
    if (Math.hypot(x - island.x, y - island.y) < island.r) return island;
  }
  return null;
}

/**
 * Burn one house on the nearest island to a strike. Returns the island burned,
 * or null when the bolt fell on open sea.
 */
export function burnNearestHouse(islands, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const island of islands) {
    const d = Math.hypot(x - island.x, y - island.y) - island.r;
    if (d < bestD) {
      bestD = d;
      best = island;
    }
  }
  if (!best || bestD > 60) return null;
  const standing = best.houses.findIndex(Boolean);
  if (standing === -1) return null;
  best.houses[standing] = false;
  return best;
}

/** Light a dark beacon; returns true when a beacon was lit. */
export function lightBeacon(island) {
  if (island.beacon.lit) return false;
  island.beacon.lit = true;
  return true;
}
