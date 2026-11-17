// Stormkite — Warden of the Seven Gales. Boot and the one loop: input is read
// every frame, the world advances in fixed 1/60 s steps, and the renderer
// paints what is there. The game moves between title, play, shop, pause and
// the results screens, with WebAudio sound on every action.
//
// ?seed=N fixes the run's random source. ?shot=title|play|boss|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, updateWorld } from './world.js';
import { ACTION_CONFIRM, createInput } from './input.js';
import { createRenderer } from './render.js';
import { SCREEN_H, SCREEN_W, drawHud, drawPaused, drawResults, drawShop, drawTitle, shopHit } from './hud.js';
import { createAudio } from './audio.js';
import { readBest, writeBest } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const dpr = Math.min(2, window.devicePixelRatio || 1);
canvas.width = SCREEN_W * dpr;
canvas.height = SCREEN_H * dpr;

const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const hudCtx = canvas.getContext('2d');

/** Extra edge-triggered presses queued by mouse clicks (shop buttons). */
const extraPressed = [];

let world;
if (shot) {
  world = stageShot(shot, seed);
} else {
  world = createWorld(createRandom(seed), seed);
  world.best = readBest();
}

/** The status line screen readers announce, kept in step with the screen. */
function announce() {
  const lines = {
    title: 'Stormkite. Press Enter to fly.',
    play: `Gale ${world.gale} of 7, ${world.galeDef.name}. Score ${world.score}. Hull ${Math.ceil(world.kite.hull)}.`,
    shop: `Between gales. You hold ${world.embers} embers.`,
    paused: 'Paused.',
    victory: `Victory. Final score ${world.score}.`,
    defeat: `Defeat. Final score ${world.score}.`,
  };
  status.textContent = lines[world.screen] || '';
}

/** Turn a world event into sound and, where it matters, a banner shake. */
function playEvent(event) {
  switch (event.type) {
    case 'catch':
      audio.zap();
      break;
    case 'ember':
      audio.chime();
      break;
    case 'ground':
    case 'all-lit':
      audio.bell();
      break;
    case 'burn':
      audio.thunder(0.8);
      break;
    case 'peck':
      audio.peck();
      break;
    case 'gust':
      audio.gust();
      break;
    case 'bell':
      audio.bell();
      break;
    case 'flare':
      audio.chime();
      break;
    case 'boss-down':
    case 'victory':
      audio.fanfare();
      break;
    case 'defeat':
      audio.doom();
      break;
    case 'buy':
    case 'run-start':
    case 'gale-start':
      audio.click();
      break;
    default:
      break;
  }
}

/** Paint one frame: the world in backing pixels, then the HUD in logical pixels. */
function paint() {
  hudCtx.setTransform(1, 0, 0, 1, 0, 0);
  renderer.draw(world);
  hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (world.screen === 'title') {
    drawTitle(hudCtx, world);
  } else if (world.screen === 'shop') {
    drawHud(hudCtx, world);
    drawShop(hudCtx, world);
  } else if (world.screen === 'paused') {
    drawHud(hudCtx, world);
    drawPaused(hudCtx);
  } else if (world.screen === 'victory' || world.screen === 'defeat') {
    drawResults(hudCtx, world);
  } else {
    drawHud(hudCtx, world);
  }
}

/** Mouse clicks on the shop buy rows and the continue button. */
canvas.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (world.screen !== 'shop') return;
  const rect = canvas.getBoundingClientRect();
  const sx = (event.clientX - rect.left) * (SCREEN_W / rect.width);
  const sy = (event.clientY - rect.top) * (SCREEN_H / rect.height);
  const hit = shopHit(sx, sy);
  if (hit === 'continue') {
    extraPressed.push(ACTION_CONFIRM);
  } else if (hit) {
    const index = ['sail', 'tail', 'bell', 'sight', 'hull', 'magnet'].indexOf(hit);
    if (index >= 0) extraPressed.push(String(index + 1));
  }
});

window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

if (shot) {
  // Staged scene: paint it twice and signal the screenshot.
  paint();
  paint();
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;
  let lastScreen = world.screen;

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    acc += elapsed;

    const pressed = input.takePressed().concat(extraPressed.splice(0));
    // Mouse position in world units, for the tether pull.
    let mouseWorld = { x: null, y: null };
    if (input.mouseX !== null && input.mouseY !== null) {
      const rect = canvas.getBoundingClientRect();
      const bx = input.mouseX * (canvas.width / rect.width);
      const by = input.mouseY * (canvas.height / rect.height);
      mouseWorld = renderer.toWorld(bx, by);
    }

    while (acc >= STEP) {
      acc -= STEP;
      const events = updateWorld(world, {
        tx: input.tx,
        ty: input.ty,
        mouseX: mouseWorld.x,
        mouseY: mouseWorld.y,
        tether: input.tether,
        pressed,
      }, STEP);
      for (const event of events) playEvent(event);
      if (world.screen !== lastScreen) {
        lastScreen = world.screen;
        announce();
        if (world.screen === 'victory' || world.screen === 'defeat') writeBest(world.score);
      }
      // Wind bed follows the gale.
      audio.setWind(world.galeDef.windStrength / 160);
    }
    paint();
  }

  announce();
  requestAnimationFrame(frame);
}
