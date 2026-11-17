// Stormkite: the best score, kept in localStorage so the title screen can
// show what the player is chasing.

import { BEST_KEY } from './config.js';

/** Read the best score (0 when none is saved yet). */
export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

/** Save a new best score; returns true when it beat the old one. */
export function writeBest(score) {
  const best = readBest();
  if (score <= best) return false;
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch { /* a private window forgets; the run still counts */ }
  return true;
}
