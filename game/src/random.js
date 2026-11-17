// Stormkite: a small seeded random source (mulberry32). The whole run is driven
// by one of these, so a seed replays the same winds, bolts and crows.

/** Build a random source from a 32-bit seed. */
export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    /** Next float in [0, 1). */
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Integer in [0, n). */
    int(n) {
      return Math.floor(this.next() * n);
    },
    /** Float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** One element of the array, at random. */
    pick(array) {
      return array[Math.floor(this.next() * array.length)];
    },
  };
}
