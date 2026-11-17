// Stormkite: painting the world. Sky, sea, islands, beacons, wind, embers,
// lightning, crows, the Tyrant and the kite — all drawn in code, no assets.
// The renderer reads the world and paints it; it never changes the world.

import { SCREEN_H, SCREEN_W } from './hud.js';
import { WORLD_H, WORLD_W } from './config.js';
import { housesLeft } from './islands.js';
import { windAt } from './wind.js';

/** Build a renderer for a canvas. Returns { draw(world), view }. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  /** Stars, fixed for the life of the page so they never twinkle twice. */
  const stars = Array.from({ length: 130 }, (_, i) => ({
    x: ((i * 937) % 1600) / 1600 * WORLD_W,
    y: ((i * 571) % 500) / 500 * 420,
    r: 0.6 + ((i * 37) % 10) / 10 * 1.3,
    p: (i * 0.37) % (Math.PI * 2),
  }));
  /** Clouds drifting across the sky. */
  const clouds = Array.from({ length: 9 }, (_, i) => ({
    x: (i * 197) % WORLD_W,
    y: 60 + ((i * 113) % 260),
    s: 0.7 + ((i * 29) % 10) / 10 * 0.9,
    v: 6 + ((i * 13) % 10),
  }));

  /** World-to-screen transform for this canvas size. */
  function view() {
    const scale = Math.min(canvas.width / WORLD_W, canvas.height / WORLD_H);
    return {
      scale,
      ox: (canvas.width - WORLD_W * scale) / 2,
      oy: (canvas.height - WORLD_H * scale) / 2,
    };
  }

  /** Convert a canvas pixel to a world point. */
  function toWorld(px, py) {
    const v = view();
    return { x: (px - v.ox) / v.scale, y: (py - v.oy) / v.scale };
  }

  function drawSky(world, v) {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#0b0f2a');
    g.addColorStop(0.55, '#1b2350');
    g.addColorStop(0.8, '#3a2b5c');
    g.addColorStop(1, '#54382e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Stars.
    for (const s of stars) {
      const a = 0.35 + 0.4 * Math.abs(Math.sin(world.time * 0.7 + s.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(v.ox + s.x * v.scale, v.oy + s.y * v.scale, s.r * v.scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // A low amber moon-glow on the horizon.
    const moon = ctx.createRadialGradient(canvas.width * 0.82, canvas.height * 0.2, 10, canvas.width * 0.82, canvas.height * 0.2, 260);
    moon.addColorStop(0, 'rgba(255, 214, 130, 0.5)');
    moon.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(canvas.width * 0.82, canvas.height * 0.2, 26, 0, Math.PI * 2);
    ctx.fill();

    // Clouds.
    ctx.fillStyle = 'rgba(148, 156, 210, 0.16)';
    for (const c of clouds) {
      const cx = ((c.x + world.time * c.v) % (WORLD_W + 320)) - 160;
      ctx.beginPath();
      ctx.ellipse(v.ox + cx * v.scale, v.oy + c.y * v.scale, 90 * c.s * v.scale, 22 * c.s * v.scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSea(world, v) {
    ctx.fillStyle = '#12283d';
    ctx.fillRect(0, v.oy + 470 * v.scale, canvas.width, canvas.height - v.oy - 470 * v.scale);
    // Shimmer lines on the water.
    ctx.strokeStyle = 'rgba(127, 178, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 14; i += 1) {
      const y = 500 + ((i * 53 + world.time * 12) % 380);
      const x0 = ((i * 331) % 1400) + 100;
      ctx.beginPath();
      ctx.moveTo(v.ox + x0 * v.scale, v.oy + y * v.scale);
      ctx.lineTo(v.ox + (x0 + 60 + (i % 3) * 30) * v.scale, v.oy + y * v.scale);
      ctx.stroke();
    }
  }

  function drawIslands(world, v) {
    for (const island of world.islands) {
      const cx = v.ox + island.x * v.scale;
      const cy = v.oy + island.y * v.scale;
      const r = island.r * v.scale;

      // Sand rim, grass top.
      ctx.fillStyle = '#c9a86a';
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a7c4f';
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.06, r * 0.88, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();

      // Houses: warm windows, or a charred stump when burned.
      island.houses.forEach((standing, i) => {
        const hx = cx + (i - 1) * r * 0.5;
        const hy = cy + r * 0.18 - (i % 2) * r * 0.16;
        if (standing) {
          ctx.fillStyle = '#8a5a3b';
          ctx.fillRect(hx - 13 * v.scale, hy - 12 * v.scale, 26 * v.scale, 20 * v.scale);
          ctx.fillStyle = '#e84855';
          ctx.beginPath();
          ctx.moveTo(hx - 15 * v.scale, hy - 12 * v.scale);
          ctx.lineTo(hx, hy - 24 * v.scale);
          ctx.lineTo(hx + 15 * v.scale, hy - 12 * v.scale);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffd97a';
          ctx.fillRect(hx - 4 * v.scale, hy - 4 * v.scale, 8 * v.scale, 8 * v.scale);
        } else {
          ctx.fillStyle = '#2c2622';
          ctx.fillRect(hx - 10 * v.scale, hy - 4 * v.scale, 20 * v.scale, 10 * v.scale);
        }
      });

      // The beacon tower, lit or dark.
      const bx = v.ox + island.beacon.x * v.scale;
      const by = v.oy + island.beacon.y * v.scale;
      if (island.beacon.lit) {
        const glow = ctx.createRadialGradient(bx, by, 4, bx, by, 150 * v.scale);
        glow.addColorStop(0, 'rgba(255, 217, 122, 0.55)');
        glow.addColorStop(1, 'rgba(255, 217, 122, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(bx - 150 * v.scale, by - 150 * v.scale, 300 * v.scale, 300 * v.scale);
        ctx.fillStyle = 'rgba(255, 217, 122, 0.25)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - 90 * v.scale, by - 190 * v.scale);
        ctx.lineTo(bx + 90 * v.scale, by - 190 * v.scale);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#6b5a4e';
      ctx.fillRect(bx - 7 * v.scale, by - 34 * v.scale, 14 * v.scale, 34 * v.scale);
      ctx.fillStyle = island.beacon.lit ? '#ffd97a' : '#3a3f5c';
      ctx.beginPath();
      ctx.arc(bx, by - 38 * v.scale, 9 * v.scale, 0, Math.PI * 2);
      ctx.fill();
      if (island.beacon.lit) {
        ctx.strokeStyle = '#ffd97a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by - 38 * v.scale, 14 * v.scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Island name, small.
      ctx.fillStyle = 'rgba(244, 232, 200, 0.85)';
      ctx.font = `600 ${Math.max(11, 13 * v.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(island.name.toUpperCase(), cx, cy + r * 0.62);
      if (housesLeft(island) === 0) {
        ctx.fillStyle = '#ff7a6b';
        ctx.fillText('BURNED OUT', cx, cy + r * 0.62 + 16 * v.scale);
      }
    }
  }

  function drawWind(world, v) {
    // Flowing arrows show the prevailing wind and the gust cells.
    ctx.strokeStyle = 'rgba(159, 216, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(159, 216, 255, 0.35)';
    for (let gx = 140; gx < WORLD_W; gx += 170) {
      for (let gy = 120; gy < WORLD_H; gy += 150) {
        const w = windAt(world.wind, gx, gy);
        const len = Math.hypot(w.x, w.y);
        if (len < 10) continue;
        const ux = w.x / len;
        const uy = w.y / len;
        const L = 26 + Math.min(22, len * 0.12);
        const sx = v.ox + gx * v.scale;
        const sy = v.oy + gy * v.scale;
        const flow = (world.time * 40 + gx + gy) % 60;
        const px = sx + ux * (flow - 30) * 0.4 * v.scale;
        const py = sy + uy * (flow - 30) * 0.4 * v.scale;
        ctx.beginPath();
        ctx.moveTo(px - (ux * L) / 2, py - (uy * L) / 2);
        ctx.lineTo(px + (ux * L) / 2, py + (uy * L) / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(px + (ux * L) / 2, py + (uy * L) / 2);
        ctx.lineTo(px + (ux * L) / 2 - ux * 7 - uy * 4, py + (uy * L) / 2 - uy * 7 + ux * 4);
        ctx.lineTo(px + (ux * L) / 2 - ux * 7 + uy * 4, py + (uy * L) / 2 - uy * 7 - ux * 4);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Gust cells as soft rings.
    for (const cell of world.wind.cells) {
      ctx.strokeStyle = 'rgba(159, 216, 255, 0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(v.ox + cell.x * v.scale, v.oy + cell.y * v.scale, cell.r * v.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEmbers(world, v) {
    for (const ember of world.embersArr) {
      const x = v.ox + ember.x * v.scale;
      const y = v.oy + ember.y * v.scale;
      const pulse = 0.7 + 0.3 * Math.sin(world.time * 5 + ember.phase);
      const r = (ember.golden ? 9 : 6) * v.scale * pulse;
      const glow = ctx.createRadialGradient(x, y, 1, x, y, r * 3);
      glow.addColorStop(0, ember.golden ? 'rgba(255, 224, 102, 0.8)' : 'rgba(255, 179, 71, 0.7)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      ctx.fillStyle = ember.golden ? '#ffe066' : '#ffb347';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBolts(world, v) {
    for (const bolt of world.bolts) {
      const x = v.ox + bolt.x * v.scale;
      const y = v.oy + bolt.y * v.scale;
      const frac = 1 - bolt.t / bolt.telegraph;
      // Telegraph ring: shrinks onto the strike point.
      ctx.strokeStyle = `rgba(255, 122, 107, ${0.35 + 0.5 * frac})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, (110 - 70 * frac) * v.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(255, 122, 107, ${0.14 + 0.2 * frac})`;
      ctx.beginPath();
      ctx.arc(x, y, (110 - 70 * frac) * v.scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7a6b';
      ctx.font = `800 ${Math.max(12, 15 * v.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('⚡', x, y - 52 * v.scale);
      if (bolt.aimed) {
        ctx.fillStyle = '#ffd97a';
        ctx.font = `700 ${Math.max(10, 12 * v.scale)}px system-ui, sans-serif`;
        ctx.fillText('ON YOU', x, y + 74 * v.scale);
      }
    }
  }

  function drawCrowShape(x, y, scale, flap, dark) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const wing = Math.sin(flap) * 10;
    ctx.fillStyle = dark ? '#1c2036' : '#232840';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.quadraticCurveTo(-26, -16 - wing, -34, -4 - wing * 0.5);
    ctx.quadraticCurveTo(-18, 2, -6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.quadraticCurveTo(-24, 14 + wing, -32, 6 + wing * 0.5);
    ctx.quadraticCurveTo(-16, 8, -6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(14, -3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.moveTo(19, -4);
    ctx.lineTo(27, -2);
    ctx.lineTo(19, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff5a4e';
    ctx.beginPath();
    ctx.arc(15, -5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCrows(world, v) {
    for (const crow of world.crows) {
      drawCrowShape(v.ox + crow.x * v.scale, v.oy + crow.y * v.scale, v.scale, crow.flap, crow.state === 'flee');
    }
    if (world.boss) {
      const b = world.boss;
      const x = v.ox + b.x * v.scale;
      const y = v.oy + b.y * v.scale;
      const glow = ctx.createRadialGradient(x, y, 10, x, y, 150 * v.scale);
      glow.addColorStop(0, 'rgba(232, 72, 85, 0.35)');
      glow.addColorStop(1, 'rgba(232, 72, 85, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 150 * v.scale, y - 150 * v.scale, 300 * v.scale, 300 * v.scale);
      drawCrowShape(x, y, v.scale * 2.9, b.flap, true);
      ctx.fillStyle = '#ff9a8a';
      ctx.font = `800 ${Math.max(12, 15 * v.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('THE GALE TYRANT', x, y - 78 * v.scale);
    }
  }

  function drawKite(world, v) {
    const kite = world.kite;
    const x = v.ox + kite.x * v.scale;
    const y = v.oy + kite.y * v.scale;
    // Bell ward ring.
    if (kite.bellWard > 0) {
      ctx.strokeStyle = `rgba(255, 233, 168, ${0.25 + 0.35 * kite.bellWard / 4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, (240 + 60 * (world.upgrades.bell || 0)) * v.scale * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Tail ribbons, streaming behind the motion.
    const tailLen = 46 * v.scale;
    const back = Math.atan2(-kite.vy, -kite.vx);
    for (let i = 0; i < 3; i += 1) {
      const wave = Math.sin(world.time * 6 + i * 2.1) * 8 * v.scale;
      const a = back + (i - 1) * 0.28;
      ctx.strokeStyle = ['#e84855', '#ffd97a', '#7fb2ff'][i];
      ctx.lineWidth = 3 * v.scale;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + Math.cos(a) * tailLen * 0.6 + wave,
        y + Math.sin(a) * tailLen * 0.6,
        x + Math.cos(a) * tailLen + wave,
        y + Math.sin(a) * tailLen,
      );
      ctx.stroke();
    }
    // The diamond sail, leaning into the wind.
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(kite.angle + Math.PI / 2);
    const s = v.scale;
    ctx.fillStyle = '#e84855';
    ctx.beginPath();
    ctx.moveTo(0, -26 * s);
    ctx.lineTo(20 * s, 0);
    ctx.lineTo(0, 22 * s);
    ctx.lineTo(-20 * s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd97a';
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    ctx.fillStyle = '#ffd97a';
    ctx.beginPath();
    ctx.moveTo(0, -26 * s);
    ctx.lineTo(0, 22 * s);
    ctx.stroke();
    // Copper tail charge: glowing pips on the sail.
    for (let i = 0; i < kite.maxCharge; i += 1) {
      ctx.fillStyle = i < kite.charge ? '#cfe8ff' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(-10 * s + i * 10 * s, 0, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Hurt flash.
    if (kite.hurtCd > 0.6) {
      ctx.strokeStyle = 'rgba(255, 122, 107, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 34 * v.scale, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawRain(world, v) {
    if (world.rain.length === 0) return;
    ctx.strokeStyle = 'rgba(159, 216, 255, 0.22)';
    ctx.lineWidth = 2;
    for (const zone of world.rain) {
      const cx = v.ox + zone.x * v.scale;
      const cy = v.oy + zone.y * v.scale;
      const r = zone.r * v.scale;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 + world.time * 0.5;
        const sx = cx + Math.cos(a) * r * 0.8;
        const sy = cy + Math.sin(a) * r * 0.8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 4, sy + 12);
        ctx.stroke();
      }
    }
  }

  function drawParticles(world, v) {
    for (const p of world.particles) {
      const a = 1 - p.age / p.life;
      const x = v.ox + p.x * v.scale;
      const y = v.oy + p.y * v.scale;
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = a;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, (p.size + p.age * 260) * v.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size * v.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    for (const f of world.floats) {
      const a = 1 - f.age / f.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = f.color;
      ctx.font = `${f.big ? 800 : 700} ${Math.max(13, (f.big ? 26 : 17) * v.scale)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 4;
      const x = v.ox + f.x * v.scale;
      const y = v.oy + f.y * v.scale;
      ctx.strokeText(f.text, x, y);
      ctx.fillText(f.text, x, y);
      ctx.globalAlpha = 1;
    }
  }

  /** Paint the whole world: sky, sea, islands, wind, pieces, kite, weather. */
  function draw(world) {
    const v = view();
    ctx.save();
    if (world.shake > 0) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    drawSky(world, v);
    drawSea(world, v);
    drawIslands(world, v);
    drawWind(world, v);
    drawEmbers(world, v);
    drawBolts(world, v);
    drawCrows(world, v);
    drawKite(world, v);
    drawRain(world, v);
    drawParticles(world, v);
    ctx.restore();
    // Lightning flash over everything.
    if (world.flash > 0) {
      ctx.fillStyle = `rgba(207, 232, 255, ${world.flash * 0.28})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Vignette.
    const vg = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height * 0.45,
      canvas.width / 2, canvas.height / 2, canvas.height * 0.95,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  return { draw, view, toWorld };
}
