// engine.js — canvas loop, keyboard/mouse input and the smooth chase camera.

export function clampNumber(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerpValue(from, to, amount) {
  return from + (to - from) * amount;
}

export function distanceBetween(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTowards(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function turnAngleTowards(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}

// Deterministic seeded random so shot modes and city layout are stable.
export function makeSeededRandom(seed) {
  let state = (seed * 2654435761) >>> 0;
  return function nextRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export class InputState {
  constructor(canvas) {
    this.canvas = canvas;
    this.keysDown = new Set();
    this.keysPressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    window.addEventListener('keydown', (event) => {
      if (!this.keysDown.has(event.code)) this.keysPressed.add(event.code);
      this.keysDown.add(event.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    });
    window.addEventListener('keyup', (event) => this.keysDown.delete(event.code));
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
  }

  isDown(...codes) {
    return codes.some((code) => this.keysDown.has(code));
  }

  wasPressed(...codes) {
    return codes.some((code) => this.keysPressed.has(code));
  }

  endFrame() {
    this.keysPressed.clear();
    this.mouseClicked = false;
  }
}

export class SmoothCamera {
  constructor(worldWidth, worldHeight) {
    this.x = worldWidth / 2;
    this.y = worldHeight / 2;
    this.zoom = 1;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  snapTo(targetX, targetY) {
    this.x = targetX;
    this.y = targetY;
  }

  followTarget(dt, targetX, targetY, isDriving, viewWidth, viewHeight) {
    const stiffness = 1 - Math.pow(0.0001, dt);
    this.x = lerpValue(this.x, targetX, stiffness);
    this.y = lerpValue(this.y, targetY, stiffness);
    const wantedZoom = isDriving ? 0.82 : 1;
    this.zoom = lerpValue(this.zoom, wantedZoom, 1 - Math.pow(0.001, dt));
    const halfW = viewWidth / this.zoom / 2;
    const halfH = viewHeight / this.zoom / 2;
    this.x = clampNumber(this.x, halfW - 120, this.worldWidth - halfW + 120);
    this.y = clampNumber(this.y, halfH - 120, this.worldHeight - halfH + 120);
  }

  screenToWorld(screenX, screenY, viewWidth, viewHeight) {
    return {
      x: this.x + (screenX - viewWidth / 2) / this.zoom,
      y: this.y + (screenY - viewHeight / 2) / this.zoom,
    };
  }
}

export function runAnimationLoop(stepFunction) {
  let lastTime = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    stepFunction(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
