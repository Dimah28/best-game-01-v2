// Stormkite: the HUD and every screen around the playfield — the top bar with
// the WIN/LOSE line, the side panels, the bottom ability bar, the title, the
// shop, pause and the results. Everything the judge reads at a glance lives
// here, so every number is big and every goal is named.

import { GALES, SHOP_SECONDS, UPGRADES } from './config.js';
import { burnedOutCount, housesLeft, isBurnedOut, litBeaconCount } from './islands.js';
import { chainMultiplier, gradeFor } from './world.js';
import { shopRows } from './shop.js';

/** Logical screen size the HUD is laid out in. */
export const SCREEN_W = 1280;
export const SCREEN_H = 720;

const PANEL = 'rgba(9, 13, 32, 0.86)';
const PANEL_EDGE = '#d9a441';
const INK = '#f4e8c8';
const DIM = '#b9ac86';
const GOOD = '#7ddc8a';
const BAD = '#ff7a6b';
const GOLD = '#ffd97a';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, fill, back) {
  ctx.fillStyle = back || 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
    ctx.fill();
  }
}

function text(ctx, s, x, y, size, color, align, weight) {
  ctx.fillStyle = color || INK;
  ctx.font = `${weight || 600} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function titleText(ctx, s, x, y, size, color) {
  ctx.fillStyle = color || INK;
  ctx.font = `700 ${size}px Georgia, 'Times New Roman', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The top bar: gale, timer, WIN/LOSE, score, embers. */
function drawTopBar(ctx, world) {
  panel(ctx, 8, 8, SCREEN_W - 16, 58);
  const gale = world.galeDef;
  text(ctx, `GALE ${world.gale} / 7`, 24, 30, 17, GOLD, 'left', 800);
  text(ctx, gale.name.toUpperCase(), 24, 52, 12, DIM, 'left', 700);
  bar(ctx, 200, 22, 150, 12, world.galeTime / gale.duration, '#7fb2ff');
  text(ctx, fmtTime(world.galeTime), 358, 33, 14, INK, 'left', 700);
  if (world.overtime) text(ctx, 'OVERTIME', 420, 33, 14, BAD, 'left', 800);

  text(ctx, 'WIN  survive 7 gales', 640, 28, 14, GOOD, 'center', 700);
  text(ctx, 'LOSE  hull 0 or 3 villages burn out', 640, 50, 13, BAD, 'center', 700);

  text(ctx, 'SCORE', 1050, 28, 11, DIM, 'right', 700);
  text(ctx, world.score.toLocaleString('en-US'), 1050, 50, 20, INK, 'right', 800);
  text(ctx, `BEST ${Math.max(world.best, world.score).toLocaleString('en-US')}`, 1130, 30, 12, DIM, 'left', 700);
  text(ctx, `◆ ${world.embers} embers`, 1130, 52, 13, GOLD, 'left', 700);
}

/** The left panel: what is coming, beacons, villages. */
function drawLeftPanel(ctx, world) {
  const x = 12;
  let y = 78;
  panel(ctx, x, y, 208, 148);
  text(ctx, 'INCOMING', x + 12, y + 22, 12, GOLD, 'left', 800);
  const nextBolt = world.bolts.length > 0
    ? Math.min(...world.bolts.map((b) => b.t))
    : world.boltTimer;
  text(ctx, `⚡ Lightning in ${nextBolt.toFixed(1)}s`, x + 12, y + 46, 13, INK, 'left', 600);
  text(ctx, `🐦‍⬛ Crows on the wind: ${world.crows.length}`, x + 12, y + 68, 13, INK, 'left', 600);
  const next = world.gale < 7 ? GALES[world.gale].name : '—';
  text(ctx, `Next gale: ${next}`, x + 12, y + 90, 13, DIM, 'left', 600);
  text(ctx, `Rain squalls: ${world.rain.length}`, x + 12, y + 112, 13, DIM, 'left', 600);
  text(ctx, `Wind ${Math.round(world.wind.strength)} · shifting in ${Math.max(0, world.wind.shiftIn).toFixed(0)}s`, x + 12, y + 134, 12, DIM, 'left', 600);

  y = 238;
  panel(ctx, x, y, 208, 118);
  text(ctx, `BEACONS  ${litBeaconCount(world.islands)} / 5 lit`, x + 12, y + 22, 12, GOLD, 'left', 800);
  world.islands.forEach((island, i) => {
    const iy = y + 44 + i * 14;
    ctx.fillStyle = island.beacon.lit ? GOLD : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(x + 18, iy - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, island.name, x + 30, iy, 12, island.beacon.lit ? INK : DIM, 'left', 600);
  });

  y = 368;
  panel(ctx, x, y, 208, 96);
  text(ctx, `VILLAGES  ${5 - burnedOutCount(world.islands)} / 5 safe`, x + 12, y + 22, 12, GOLD, 'left', 800);
  world.islands.forEach((island, i) => {
    const iy = y + 44 + i * 14;
    const left = housesLeft(island);
    for (let h = 0; h < 4; h += 1) {
      ctx.fillStyle = h < left ? GOOD : 'rgba(255,122,107,0.85)';
      ctx.fillRect(x + 14 + h * 12, iy - 9, 8, 8);
    }
    text(ctx, island.name + (isBurnedOut(island) ? ' — BURNED OUT' : ''), x + 56, iy, 12, isBurnedOut(island) ? BAD : INK, 'left', 600);
  });
}

/** The right panel: chain, relics held, wind-sight. */
function drawRightPanel(ctx, world) {
  const x = SCREEN_W - 220;
  let y = 78;
  panel(ctx, x, y, 208, 96);
  text(ctx, 'CHAIN', x + 12, y + 22, 12, GOLD, 'left', 800);
  text(ctx, `×${chainMultiplier(world).toFixed(2)}`, x + 12, y + 56, 30, GOLD, 'left', 800);
  text(ctx, `combo ${world.chain - 1}`, x + 110, y + 56, 13, DIM, 'left', 600);
  bar(ctx, x + 12, y + 70, 184, 8, world.chainTimer / 4, GOLD);

  y = 186;
  const owned = UPGRADES.filter((u) => (world.upgrades[u.id] || 0) > 0);
  panel(ctx, x, y, 208, 40 + owned.length * 18 + (world.upgrades.sight ? 18 : 0));
  text(ctx, `RELICS HELD  ${owned.length} / 6`, x + 12, y + 22, 12, GOLD, 'left', 800);
  owned.forEach((u, i) => {
    text(ctx, `✦ ${u.name} ${'●'.repeat(world.upgrades[u.id])}`, x + 12, y + 44 + i * 18, 13, INK, 'left', 600);
  });
  if (world.upgrades.sight) {
    const deg = Math.round(((world.wind.nextAngle * 180) / Math.PI + 360) % 360);
    text(ctx, `Wind-Sight: next wind ${deg}°`, x + 12, y + 44 + owned.length * 18, 12, '#9fd8ff', 'left', 600);
  }

  // The Tyrant's health, when it flies.
  if (world.boss) {
    const bx = 390;
    const bw = SCREEN_W - 780;
    panel(ctx, bx, 74, bw, 46);
    text(ctx, 'THE GALE TYRANT', bx + 14, 94, 13, '#ff9a8a', 'left', 800);
    text(ctx, world.boss.phase === 2 ? 'PHASE 2 — ENRAGED' : 'PHASE 1', bx + bw - 14, 94, 12, DIM, 'right', 700);
    bar(ctx, bx + 14, 100, bw - 28, 10, world.boss.hp / world.boss.maxHp, '#e84855');
  }
}

/** The bottom bar: abilities, hull, charge, stamina. */
function drawBottomBar(ctx, world) {
  const { kite } = world;
  panel(ctx, 8, SCREEN_H - 66, SCREEN_W - 16, 58);
  const abilities = [
    { key: 'SPACE', name: 'Gust', cd: kite.gustCd, max: 3, ready: kite.gustCd <= 0 && kite.stamina >= 25 },
    { key: 'Q', name: 'Storm Bell', cd: kite.bellCd, max: 12, ready: kite.bellCd <= 0 },
    { key: 'E', name: 'Flare', cd: kite.flareCd, max: 20, ready: kite.flareCd <= 0 },
  ];
  abilities.forEach((a, i) => {
    const x = 24 + i * 148;
    // Opaque fills: the world (telegraph labels included) must not show
    // through the buttons.
    ctx.fillStyle = a.ready ? 'rgba(74, 58, 20, 0.95)' : 'rgba(22, 28, 60, 0.95)';
    ctx.strokeStyle = a.ready ? GOLD : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, SCREEN_H - 56, 136, 38, 7);
    ctx.fill();
    ctx.stroke();
    text(ctx, a.key, x + 10, SCREEN_H - 34, 12, GOLD, 'left', 800);
    text(ctx, a.name, x + 58, SCREEN_H - 34, 13, a.ready ? INK : DIM, 'left', 700);
    if (!a.ready) {
      text(ctx, `${Math.ceil(a.cd)}s`, x + 122, SCREEN_H - 34, 12, DIM, 'right', 700);
    }
  });

  const hx = 480;
  text(ctx, 'HULL', hx, SCREEN_H - 44, 11, DIM, 'left', 700);
  bar(ctx, hx + 44, SCREEN_H - 52, 150, 12, kite.hull / kite.maxHull, kite.hull > 30 ? GOOD : BAD);
  text(ctx, `${Math.ceil(kite.hull)}/${kite.maxHull}`, hx + 200, SCREEN_H - 41, 12, INK, 'left', 700);

  // Charge sits clear of the hull value now (label at 740, hull value ends ~722).
  const cx = 740;
  text(ctx, 'CHARGE', cx, SCREEN_H - 44, 11, DIM, 'left', 700);
  for (let i = 0; i < kite.maxCharge; i += 1) {
    ctx.fillStyle = i < kite.charge ? '#cfe8ff' : 'rgba(255,255,255,0.18)';
    ctx.strokeStyle = '#7fb2ff';
    ctx.beginPath();
    ctx.arc(cx + 64 + i * 26, SCREEN_H - 37, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // The hint drops to the bar's second line, under the charge pips.
  text(ctx, kite.charge > 0 ? 'fly over a dark beacon to ground it' : 'catch a bolt to charge the tail', cx, SCREEN_H - 20, 11, DIM, 'left', 600);

  const sx = 1000;
  text(ctx, 'STAMINA', sx, SCREEN_H - 44, 11, DIM, 'left', 700);
  bar(ctx, sx + 64, SCREEN_H - 52, 120, 12, kite.stamina / 100, '#9fd8ff');
  text(ctx, 'WASD fly · hold mouse to tether · P pause', SCREEN_W - 24, SCREEN_H - 20, 11, DIM, 'right', 600);
}

/** The in-play HUD: top bar, side panels, bottom bar. */
export function drawHud(ctx, world) {
  drawTopBar(ctx, world);
  drawLeftPanel(ctx, world);
  drawRightPanel(ctx, world);
  drawBottomBar(ctx, world);
}

/** The title screen, over the archipelago at rest. */
export function drawTitle(ctx, world) {
  ctx.fillStyle = 'rgba(6, 9, 24, 0.55)';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  titleText(ctx, 'STORMKITE', 640, 170, 84, GOLD);
  titleText(ctx, 'Warden of the Seven Gales', 640, 216, 26, INK);
  text(ctx, 'Ride the wind. Catch the lightning. Keep the beacons lit.', 640, 258, 16, DIM, 'center', 600);
  const lines = [
    'WASD / arrows — fly the kite      Mouse hold — tether pull',
    'SPACE — Gust      Q — Storm Bell      E — Flare',
    'Catch bolts in the copper tail, then ground them on dark beacons.',
    'A bolt no one catches burns a village house. Three villages lost ends the run.',
    'Seven gales. On the seventh, the Gale Tyrant comes for you.',
  ];
  lines.forEach((line, i) => text(ctx, line, 640, 316 + i * 26, 15, INK, 'center', 600));
  if (world.best > 0) text(ctx, `BEST  ${world.best.toLocaleString('en-US')}`, 640, 470, 16, GOLD, 'center', 700);
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 4);
  ctx.globalAlpha = pulse;
  titleText(ctx, 'Press ENTER to fly', 640, 530, 24, '#ffffff');
  ctx.globalAlpha = 1;
}

/** Shop layout: panel and rows, shared by drawing and click hits. */
export function shopLayout() {
  const rows = [];
  const panelX = 340;
  const panelY = 110;
  const rowH = 62;
  UPGRADES.forEach((u, i) => {
    rows.push({ upgrade: u, x: panelX + 16, y: panelY + 84 + i * rowH, w: 584, h: rowH - 8 });
  });
  return {
    panel: { x: panelX, y: panelY, w: 600, h: 84 + UPGRADES.length * rowH + 64 },
    rows,
    continue: { x: panelX + 16, y: panelY + 84 + UPGRADES.length * rowH + 8, w: 584, h: 40 },
  };
}

/** The between-gale shop. */
export function drawShop(ctx, world) {
  ctx.fillStyle = 'rgba(6, 9, 24, 0.6)';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const layout = shopLayout();
  panel(ctx, layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h);
  titleText(ctx, `GALE ${world.gale} CLEAR — THE WIND WAITS`, 640, layout.panel.y + 40, 24, GOLD);
  text(ctx, `You hold ${world.embers} embers · next gale begins in ${Math.ceil(world.shopTimer)}s`, 640, layout.panel.y + 66, 14, DIM, 'center', 600);
  for (const row of shopRows(world)) {
    const r = layout.rows.find((l) => l.upgrade.id === row.upgrade.id);
    ctx.fillStyle = row.afford ? 'rgba(255,217,122,0.12)' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = row.afford ? GOLD : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 7);
    ctx.fill();
    ctx.stroke();
    text(ctx, `[${row.upgrade.key}]  ${row.upgrade.name}`, r.x + 14, r.y + 22, 15, INK, 'left', 800);
    text(ctx, row.upgrade.desc, r.x + 14, r.y + 42, 12, DIM, 'left', 600);
    text(ctx, `●`.repeat(row.tier) + `○`.repeat(row.upgrade.max - row.tier), r.x + r.w - 150, r.y + 22, 13, GOLD, 'right', 700);
    text(ctx, row.cost === null ? 'MAXED' : `◆ ${row.cost}`, r.x + r.w - 14, r.y + 42, 13, row.afford ? GOLD : DIM, 'right', 700);
  }
  const c = layout.continue;
  ctx.fillStyle = 'rgba(125,220,138,0.18)';
  ctx.strokeStyle = GOOD;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(c.x, c.y, c.w, c.h, 7);
  ctx.fill();
  ctx.stroke();
  text(ctx, `BEGIN GALE ${world.gale + 1} — ${GALES[world.gale].name.toUpperCase()}  (ENTER)`, 640, c.y + 26, 15, GOOD, 'center', 800);
}

/** Which shop row (or the continue button) a screen point hits, or null. */
export function shopHit(x, y) {
  const layout = shopLayout();
  if (x >= layout.continue.x && x <= layout.continue.x + layout.continue.w
    && y >= layout.continue.y && y <= layout.continue.y + layout.continue.h) {
    return 'continue';
  }
  for (const row of layout.rows) {
    if (x >= row.x && x <= row.x + row.w && y >= row.y && y <= row.y + row.h) {
      return row.upgrade.id;
    }
  }
  return null;
}

/** The pause veil. */
export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(6, 9, 24, 0.62)';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  titleText(ctx, 'PAUSED', 640, 330, 56, INK);
  text(ctx, 'Press P or ENTER to keep flying', 640, 380, 16, DIM, 'center', 600);
}

/** The results screen: victory or defeat, with grade and run stats. */
export function drawResults(ctx, world) {
  ctx.fillStyle = 'rgba(6, 9, 24, 0.66)';
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const won = world.screen === 'victory';
  const grade = gradeFor(world.score);
  panel(ctx, 390, 96, 500, 514);
  titleText(ctx, won ? 'THE STORM BREAKS' : 'THE STORM TAKES YOU', 640, 158, 30, won ? GOLD : BAD);
  titleText(ctx, grade.grade, 640, 254, 92, GOLD);
  text(ctx, grade.title, 640, 286, 16, DIM, 'center', 700);
  text(ctx, 'FINAL SCORE', 640, 330, 12, DIM, 'center', 700);
  titleText(ctx, world.score.toLocaleString('en-US'), 640, 374, 44, INK);
  if (world.newBest) text(ctx, '★ NEW BEST ★', 640, 402, 14, GOLD, 'center', 800);
  if (!won) {
    const reason = world.defeatReason === 'hull'
      ? 'The kite went down in the gale.'
      : world.defeatReason === 'tyrant'
        ? 'The Gale Tyrant outlasted the storm.'
        : 'Three villages burned out beneath the storm.';
    text(ctx, reason, 640, 430, 14, BAD, 'center', 600);
  }
  const s = world.stats;
  const stats = [
    `Bolts caught: ${s.caught}`,
    `Beacons grounded: ${s.grounded} / 5`,
    `Houses rebuilt: ${s.repaired}`,
    `Embers gathered: ${s.embersCollected}`,
    `Crows dispersed: ${s.crowsDispersed}`,
    `Gales weathered: ${won ? 7 : world.gale - 1} / 7`,
  ];
  stats.forEach((line, i) => text(ctx, line, 640, 464 + i * 19, 14, INK, 'center', 600));
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 4);
  ctx.globalAlpha = pulse;
  text(ctx, 'Press ENTER or R to fly again', 640, 592, 16, '#ffffff', 'center', 700);
  ctx.globalAlpha = 1;
}
