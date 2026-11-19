// engine.js — core loop helpers for Vice Harbor: seeded randomness, math, the smooth
// follow camera, keyboard + mouse input, and the fixed-step game loop driver.

/** Deterministic RNG (mulberry32): the same seed always builds the same Port Palmera. */
export function createRng(seed) {
  let a = (seed >>> 0) || 1;
  return function nextRandom() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clampValue(value, min, max) { return value < min ? min : value > max ? max : value; }
export function lerpValue(a, b, t) { return a + (b - a) * t; }
export function distanceBetween(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.hypot(dx, dy); }
export function angleTowards(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

/** Turn `current` toward `target` angle by at most `maxStep` radians. */
export function turnAngleTowards(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

/** Axis-aligned rectangle overlap test used for building collision. */
export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Push a circle at (x, y) with radius r out of a rectangle; returns the corrected point. */
export function pushCircleOutOfRect(x, y, r, rect) {
  const nx = clampValue(x, rect.x, rect.x + rect.w);
  const ny = clampValue(y, rect.y, rect.y + rect.h);
  const dx = x - nx, dy = y - ny, d2 = dx * dx + dy * dy;
  if (d2 > r * r) return { x, y, hit: false };
  if (d2 > 0.0001) { const d = Math.sqrt(d2); return { x: nx + (dx / d) * r, y: ny + (dy / d) * r, hit: true }; }
  // Centre inside the rect: escape through the nearest face.
  const left = x - rect.x, right = rect.x + rect.w - x, top = y - rect.y, bot = rect.y + rect.h - y;
  const m = Math.min(left, right, top, bot);
  if (m === left) return { x: rect.x - r, y, hit: true };
  if (m === right) return { x: rect.x + rect.w + r, y, hit: true };
  if (m === top) return { x, y: rect.y - r, hit: true };
  return { x, y: rect.y + rect.h + r, hit: true };
}

/** Smooth camera that eases after the player (faster and wider when driving). */
export class FollowCamera {
  constructor(viewWidth, viewHeight) {
    this.x = 0; this.y = 0; this.viewWidth = viewWidth; this.viewHeight = viewHeight; this.zoom = 1;
  }
  snapTo(x, y) { this.x = x; this.y = y; }
  followTarget(targetX, targetY, speed, dt) {
    const stiffness = speed > 40 ? 3.2 : 5.2;
    const k = 1 - Math.exp(-stiffness * dt);
    this.x = lerpValue(this.x, targetX, k);
    this.y = lerpValue(this.y, targetY, k);
    const targetZoom = speed > 40 ? 0.82 : 1;
    this.zoom = lerpValue(this.zoom, targetZoom, 1 - Math.exp(-2 * dt));
  }
  /** Keep the view inside the world so no out-of-bounds void ever shows at the edges. */
  clampToWorld(worldWidth, worldHeight) {
    const halfW = this.viewWidth / 2 / this.zoom, halfH = this.viewHeight / 2 / this.zoom;
    this.x = halfW * 2 >= worldWidth ? worldWidth / 2 : clampValue(this.x, halfW, worldWidth - halfW);
    this.y = halfH * 2 >= worldHeight ? worldHeight / 2 : clampValue(this.y, halfH, worldHeight - halfH);
  }
  worldToScreenX(worldX) { return (worldX - this.x) * this.zoom + this.viewWidth / 2; }
  worldToScreenY(worldY) { return (worldY - this.y) * this.zoom + this.viewHeight / 2; }
  screenToWorldX(screenX) { return (screenX - this.viewWidth / 2) / this.zoom + this.x; }
  screenToWorldY(screenY) { return (screenY - this.viewHeight / 2) / this.zoom + this.y; }
}

/** Keyboard + mouse state, read by every system each frame. */
export class InputState {
  constructor(canvas) {
    this.keysDown = new Set();
    this.mouseScreenX = 0; this.mouseScreenY = 0; this.mouseDown = false;
    this.clickedThisFrame = false; this.pressedKeys = new Set();
    window.addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressedKeys.add(e.code);
      this.keysDown.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    canvas.addEventListener('mousemove', (e) => { this.mouseScreenX = e.clientX; this.mouseScreenY = e.clientY; });
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouseDown = true; this.clickedThisFrame = true; } });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
  }
  isDown(code) { return this.keysDown.has(code); }
  wasPressed(code) { return this.pressedKeys.has(code); }
  moveAxisX() { return (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) - (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0); }
  moveAxisY() { return (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0) - (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0); }
  endFrame() { this.pressedKeys.clear(); this.clickedThisFrame = false; }
}

/** Spawn a burst of simple particles (sparks, splashes, confetti, smoke puffs). */
export function spawnParticles(state, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * Math.PI * 2, s = speed * (0.3 + state.rng() * 0.7);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + state.rng() * 0.5), maxLife: life, color, size: size * (0.6 + state.rng() * 0.8) });
  }
}

/** Advance and fade every live particle. */
export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

/** Draw all particles as soft fading circles in world space. */
export function drawParticles(ctx, state) {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
