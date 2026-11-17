// Stormkite: keyboard and mouse input. One object, read every frame by the loop:
// thrust direction, tether point, and the ability keys the player pressed.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_GUST = 'gust';
export const ACTION_BELL = 'bell';
export const ACTION_FLARE = 'flare';
export const ACTION_RESTART = 'restart';

/** Wire the canvas and window; returns the live input state. */
export function createInput(canvas) {
  const input = {
    /** Thrust keys held, as a unit vector (or 0,0). */
    tx: 0,
    ty: 0,
    /** Mouse position in canvas pixels, or null when the pointer is away. */
    mouseX: null,
    mouseY: null,
    /** Mouse held: the tether pulls the kite toward the pointer. */
    tether: false,
    /** Keys pressed since the last frame was read (edge-triggered). */
    pressed: [],
  };
  const keys = new Set();

  function recomputeThrust() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    const len = Math.hypot(x, y) || 1;
    input.tx = x / len;
    input.ty = y / len;
  }

  const keyAction = {
    Enter: ACTION_CONFIRM,
    Space: ACTION_GUST,
    KeyP: ACTION_PAUSE,
    Escape: ACTION_PAUSE,
    KeyQ: ACTION_BELL,
    KeyE: ACTION_FLARE,
    KeyR: ACTION_RESTART,
    Digit1: '1',
    Digit2: '2',
    Digit3: '3',
    Digit4: '4',
    Digit5: '5',
    Digit6: '6',
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    recomputeThrust();
    const action = keyAction[event.code];
    if (action) {
      input.pressed.push(action);
      if (event.code === 'Space') event.preventDefault();
    }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    recomputeThrust();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    recomputeThrust();
    input.tether = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
    input.tether = true;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', () => {
    input.tether = false;
  });
  canvas.addEventListener('pointerleave', () => {
    input.mouseX = null;
    input.mouseY = null;
  });

  /** Take this frame's edge-triggered presses and clear them. */
  input.takePressed = () => {
    const out = input.pressed;
    input.pressed = [];
    return out;
  };
  return input;
}
