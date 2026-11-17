// Stormkite: particles, floating score text and screen shake — the feedback on
// every action. Pure data here; render.js paints them.

/** A burst of sparks at a point. */
export function burst(world, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = world.random.next() * Math.PI * 2;
    const s = speed * (0.4 + world.random.next() * 0.8);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5 + world.random.next() * 0.5,
      age: 0,
      size: 2 + world.random.next() * 3,
      color,
    });
  }
}

/** A ring that expands and fades — a caught bolt, a grounded beacon. */
export function ring(world, x, y, color) {
  world.particles.push({
    x, y, vx: 0, vy: 0,
    life: 0.7, age: 0,
    size: 10, color, ring: true,
  });
}

/** Floating text that rises and fades: "+150", "CAUGHT!", "GROUNDED". */
export function floatText(world, x, y, text, color, big) {
  world.floats.push({
    x, y, text, color,
    age: 0, life: big ? 1.6 : 1.1,
    big: !!big,
  });
}

/** Advance particles and floating text one step. */
export function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const p = world.particles[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.exp(-2.2 * dt);
    p.vy *= Math.exp(-2.2 * dt);
    if (p.age >= p.life) world.particles.splice(i, 1);
  }
  for (let i = world.floats.length - 1; i >= 0; i -= 1) {
    const f = world.floats[i];
    f.age += dt;
    f.y -= 34 * dt;
    if (f.age >= f.life) world.floats.splice(i, 1);
  }
  world.shake = Math.max(0, world.shake - dt * 26);
  world.flash = Math.max(0, world.flash - dt * 2.4);
}
