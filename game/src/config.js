// Stormkite — Warden of the Seven Gales: every number that tunes the game.
// One place for balance so the loop can be tuned without touching the sim.

/** Fixed simulation step (seconds). The world always advances in these. */
export const STEP = 1 / 60;

/** The archipelago the kite flies over, in world units. */
export const WORLD_W = 1600;
export const WORLD_H = 900;

/** How many houses a village loses before it counts as burned out. */
export const HOUSES_PER_VILLAGE = 4;
/** Burned-out villages at once ends the run. */
export const VILLAGES_LOST_LIMIT = 3;

/** The kite's hull when a run starts; 0 hull ends the run. */
export const KITE_MAX_HULL = 100;
/** Stamina pays for thrust and Gust; empty stamina halves thrust. */
export const KITE_MAX_STAMINA = 100;
/** Bolts the copper tail can hold before it overloads on the next catch. */
export const KITE_MAX_CHARGE = 2;

/** How far a caught bolt's charge reaches a beacon to ground it. */
export const GROUND_RADIUS = 90;
/** How close the kite must be to a strike point to catch the bolt. */
export const CATCH_RADIUS = 95;
/** Points for catching a bolt, before the chain multiplier. */
export const CATCH_POINTS = 150;
/** Points for grounding a charge into a beacon, before the chain multiplier. */
export const GROUND_POINTS = 400;
/** Points for lighting the last dark beacon (all five lit). */
export const ALL_BEACONS_BONUS = 1000;
/** Points for bringing down the Gale Tyrant. */
export const BOSS_POINTS = 2000;
/** Points for clearing a gale. */
export const GALE_CLEAR_POINTS = 300;

/** The seven gales, in order. Each one is a stage: wind, lightning and crows
 *  all grow harder, and the seventh brings the Gale Tyrant. */
export const GALES = [
  { name: 'First Breeze', duration: 60, windAngle: -0.6, windStrength: 55, boltEvery: 9.5, crows: 2, emberEvery: 1.1, rain: 0 },
  { name: 'Rising Squall', duration: 60, windAngle: -0.2, windStrength: 70, boltEvery: 8.5, crows: 3, emberEvery: 1.0, rain: 1 },
  { name: 'The Undertow', duration: 60, windAngle: 0.5, windStrength: 85, boltEvery: 7.5, crows: 4, emberEvery: 0.9, rain: 1 },
  { name: "Widow's Gale", duration: 60, windAngle: 1.1, windStrength: 100, boltEvery: 6.8, crows: 5, emberEvery: 0.85, rain: 2 },
  { name: 'Copper Tempest', duration: 60, windAngle: 1.7, windStrength: 115, boltEvery: 6.0, crows: 6, emberEvery: 0.8, rain: 2 },
  { name: 'The Hollow Wind', duration: 60, windAngle: 2.4, windStrength: 130, boltEvery: 5.4, crows: 6, emberEvery: 0.75, rain: 3 },
  { name: 'The Gale Tyrant', duration: 75, windAngle: 2.9, windStrength: 145, boltEvery: 5.0, crows: 5, emberEvery: 0.7, rain: 3 },
];

/** Seconds of shop between gales. The run waits; the player buys, then flies on. */
export const SHOP_SECONDS = 14;

/** The upgrade shop: six named upgrades, each with tiers and ember costs. */
export const UPGRADES = [
  { id: 'sail', name: 'Storm Sail', key: '1', desc: '+14% thrust and top speed', costs: [12, 20, 30], max: 3 },
  { id: 'tail', name: 'Copper Tail', key: '2', desc: '+1 bolt the tail can hold', costs: [15, 26], max: 2 },
  { id: 'bell', name: 'Storm Bell', key: '3', desc: 'Bell recharges 30% faster, wider ward', costs: [10, 18], max: 2 },
  { id: 'sight', name: 'Wind-Sight', key: '4', desc: 'See the next wind shift and bolt target early', costs: [14], max: 1 },
  { id: 'hull', name: 'Hull Plating', key: '5', desc: '+30 max hull, mends 30 now', costs: [12, 20], max: 2 },
  { id: 'magnet', name: 'Ember Magnet', key: '6', desc: '+70% ember pickup reach', costs: [10, 16], max: 2 },
];

/** Result grades, by final score. */
export const GRADES = [
  { min: 22000, grade: 'S', title: 'Stormlord' },
  { min: 15000, grade: 'A', title: 'Gale Warden' },
  { min: 9000, grade: 'B', title: 'Kite Keeper' },
  { min: 0, grade: 'C', title: 'Breeze Chaser' },
];

/** localStorage key for the best score. */
export const BEST_KEY = 'stormkite.best.score.v1';
