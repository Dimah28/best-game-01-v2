// Stormkite: the wind field. One prevailing wind per gale, slowly turning, plus
// drifting gust cells — round pockets of stronger wind that wander the sky.
// Everything that flies (kite, embers, crows) feels the wind at its position.

/** Build the wind for a gale: angle and strength come from the gale table. */
export function createWind(random, gale) {
  return {
    angle: gale.windAngle,
    strength: gale.windStrength,
    /** Seconds until the prevailing wind turns again. */
    shiftIn: 14 + random.next() * 8,
    /** Where the next shift will turn to (shown early with Wind-Sight). */
    nextAngle: gale.windAngle + (random.next() - 0.5) * 1.2,
    /** Wandering pockets of stronger wind. */
    cells: [
      { x: 500, y: 300, r: 190, angle: gale.windAngle + 0.7, strength: 90, vx: 14, vy: 9 },
      { x: 1100, y: 600, r: 230, angle: gale.windAngle - 0.6, strength: 110, vx: -11, vy: 12 },
    ],
    drift: 0,
  };
}

/** Advance the wind one step: it turns a little, shifts now and then, cells roam. */
export function updateWind(wind, random, gale, dt) {
  wind.drift += dt;
  wind.angle += Math.sin(wind.drift * 0.11) * 0.0016;
  wind.shiftIn -= dt;
  if (wind.shiftIn <= 0) {
    wind.angle = wind.nextAngle;
    wind.nextAngle = gale.windAngle + (random.next() - 0.5) * 1.6;
    wind.shiftIn = 13 + random.next() * 9;
  }
  for (const cell of wind.cells) {
    cell.x += cell.vx * dt;
    cell.y += cell.vy * dt;
    if (cell.x < 140 || cell.x > 1460) cell.vx *= -1;
    if (cell.y < 120 || cell.y > 780) cell.vy *= -1;
  }
}

/** The wind vector at a point: prevailing wind plus any gust cell over it. */
export function windAt(wind, x, y) {
  let wx = Math.cos(wind.angle) * wind.strength;
  let wy = Math.sin(wind.angle) * wind.strength;
  for (const cell of wind.cells) {
    const dx = x - cell.x;
    const dy = y - cell.y;
    const d = Math.hypot(dx, dy);
    if (d < cell.r) {
      const fall = 1 - d / cell.r;
      wx += Math.cos(cell.angle) * cell.strength * fall;
      wy += Math.sin(cell.angle) * cell.strength * fall;
    }
  }
  return { x: wx, y: wy };
}

/** How much of the kite's motion runs with the wind (1) or against it (-1). */
export function windAlignment(wind, vx, vy) {
  const speed = Math.hypot(vx, vy);
  if (speed < 20) return 0;
  const wx = Math.cos(wind.angle);
  const wy = Math.sin(wind.angle);
  return (vx * wx + vy * wy) / speed;
}
