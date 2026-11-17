// Stormkite: the kite itself — a storm-kite with momentum, a tether, stamina,
// hull and a copper tail that holds caught lightning until it is grounded.

import { KITE_MAX_CHARGE, KITE_MAX_HULL, KITE_MAX_STAMINA, WORLD_H, WORLD_W } from './config.js';
import { windAlignment, windAt } from './wind.js';

/** A fresh kite, hovering over the heart of the archipelago. */
export function createKite() {
  return {
    x: WORLD_W / 2,
    y: 300,
    vx: 0,
    vy: 0,
    /** Facing, for the sail's tilt. */
    angle: 0,
    hull: KITE_MAX_HULL,
    maxHull: KITE_MAX_HULL,
    stamina: KITE_MAX_STAMINA,
    charge: 0,
    maxCharge: KITE_MAX_CHARGE,
    /** Seconds left on each ability's cooldown. */
    gustCd: 0,
    bellCd: 0,
    flareCd: 0,
    /** Seconds of bell ward still active around the kite. */
    bellWard: 0,
    /** Seconds of flare light still burning (lights dark beacons at range). */
    flareLight: 0,
    /** Brief invulnerability after a peck, so hits cannot stack in one frame. */
    hurtCd: 0,
    /** Brief cooldown after ramming the Tyrant, so one pass lands one hit. */
    ramCd: 0,
    /** The chain timer's glow: 1 just after scoring, fading to 0. */
    glow: 0,
  };
}

/**
 * Fly the kite one step. Thrust steers, the wind pushes, the tether pulls toward
 * the pointer, Gust bursts forward and Bell wards crows off. Returns events:
 * 'gust' when a burst fires, 'bell' when the ward rings, 'flare' on a flare.
 */
export function updateKite(kite, input, wind, upgrades, dt) {
  const events = [];
  const sailTier = upgrades.sail || 0;
  const thrust = 300 * (1 + 0.14 * sailTier);
  const topSpeed = 470 * (1 + 0.14 * sailTier);

  kite.gustCd = Math.max(0, kite.gustCd - dt);
  kite.bellCd = Math.max(0, kite.bellCd - dt);
  kite.flareCd = Math.max(0, kite.flareCd - dt);
  kite.bellWard = Math.max(0, kite.bellWard - dt);
  kite.flareLight = Math.max(0, kite.flareLight - dt);
  kite.hurtCd = Math.max(0, kite.hurtCd - dt);
  kite.ramCd = Math.max(0, kite.ramCd - dt);
  kite.glow = Math.max(0, kite.glow - dt * 1.4);

  // Thrust: WASD/arrows. Empty stamina halves the push.
  const tired = kite.stamina <= 0.5;
  const push = tired ? 0.5 : 1;
  if (input.tx !== 0 || input.ty !== 0) {
    kite.vx += input.tx * thrust * push * dt;
    kite.vy += input.ty * thrust * push * dt;
    kite.stamina = Math.max(0, kite.stamina - 4 * dt);
  } else {
    kite.stamina = Math.min(KITE_MAX_STAMINA, kite.stamina + 20 * dt);
  }

  // Tether: holding the mouse pulls the kite toward the pointer.
  if (input.tether && input.mouseX !== null && input.mouseY !== null) {
    const dx = input.mouseX - kite.x;
    const dy = input.mouseY - kite.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      kite.vx += (dx / d) * 520 * dt;
      kite.vy += (dy / d) * 520 * dt;
      kite.stamina = Math.max(0, kite.stamina - 4 * dt);
    }
  }

  // Gust: a burst in the direction the kite is steering (or moving, when the
  // player is not steering), knocking crows back.
  if (input.gust && kite.gustCd <= 0 && kite.stamina >= 25) {
    let gx = input.tx;
    let gy = input.ty;
    if (gx === 0 && gy === 0) {
      gx = kite.vx;
      gy = kite.vy;
    }
    const gl = Math.hypot(gx, gy) || 1;
    kite.vx += (gx / gl) * 380;
    kite.vy += (gy / gl) * 380;
    kite.stamina -= 25;
    kite.gustCd = 3;
    kite.glow = 1;
    events.push('gust');
  }

  // Bell: a ward that scares crows off for a few seconds.
  if (input.bell && kite.bellCd <= 0) {
    const bellTier = upgrades.bell || 0;
    kite.bellWard = 3 + bellTier;
    kite.bellCd = 12 * (1 - 0.3 * bellTier);
    events.push('bell');
  }

  // Flare: a burst of light that kindles every dark beacon within reach.
  if (input.flare && kite.flareCd <= 0) {
    kite.flareLight = 2.5;
    kite.flareCd = 20;
    events.push('flare');
  }

  // The wind pushes, drag steadies, speed caps.
  const w = windAt(wind, kite.x, kite.y);
  kite.vx += w.x * 0.55 * dt;
  kite.vy += w.y * 0.55 * dt;
  const drag = Math.exp(-0.55 * dt);
  kite.vx *= drag;
  kite.vy *= drag;
  const speed = Math.hypot(kite.vx, kite.vy);
  if (speed > topSpeed) {
    kite.vx = (kite.vx / speed) * topSpeed;
    kite.vy = (kite.vy / speed) * topSpeed;
  }

  kite.x += kite.vx * dt;
  kite.y += kite.vy * dt;

  // Soft walls: the kite bounces off the edge of the sky, losing a little speed.
  if (kite.x < 60) { kite.x = 60; kite.vx = Math.abs(kite.vx) * 0.5; }
  if (kite.x > WORLD_W - 60) { kite.x = WORLD_W - 60; kite.vx = -Math.abs(kite.vx) * 0.5; }
  if (kite.y < 60) { kite.y = 60; kite.vy = Math.abs(kite.vy) * 0.5; }
  if (kite.y > WORLD_H - 60) { kite.y = WORLD_H - 60; kite.vy = -Math.abs(kite.vy) * 0.5; }

  // Face the motion; riding with the wind shows in the sail's lean.
  if (speed > 30) kite.angle = Math.atan2(kite.vy, kite.vx);
  return events;
}

/** The kite's speed, for ramming crows and the boss. */
export function kiteSpeed(kite) {
  return Math.hypot(kite.vx, kite.vy);
}

/** 1 when the kite flies with the wind, -1 against it, 0 when still. */
export function kiteWindAlignment(kite, wind) {
  return windAlignment(wind, kite.vx, kite.vy);
}
