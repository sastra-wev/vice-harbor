// player.js — Rico Marlow on foot: walking, sprinting, aiming at the mouse,
// colliding with buildings and the sea, taking damage and healing at the marina.

import { clampValue, angleTowards, pushCircleOutOfRect } from './engine.js';
import { WORLD_WIDTH, WATER_Y } from './city.js';
import { driveCarPhysics, collideCarWithCity, updateCarDamageEffects } from './vehicles.js';

export const PLAYER_RADIUS = 11;
export const PLAYER_MAX_HP = 100;

/** Create Rico at the marina, broke and unknown. */
export function createPlayer() {
  return {
    x: 660, y: 1500, angle: -Math.PI / 2, hp: PLAYER_MAX_HP, money: 40,
    car: null, walkPhase: 0, hurtFlash: 0, dead: false, name: 'Rico Marlow',
  };
}

/** Rico's world position: his own feet, or his car's bonnet when driving. */
export function playerPosition(state) {
  return state.player.car ? { x: state.player.car.x, y: state.player.car.y } : { x: state.player.x, y: state.player.y };
}

/** Rico's current speed in world units per second (for camera and bust logic). */
export function playerSpeed(state) {
  if (state.player.car) return Math.abs(state.player.car.speed);
  return state.player.footSpeed || 0;
}

/** Update Rico for one frame from input: drive his car, or walk and aim. */
export function updatePlayer(state, dt) {
  const player = state.player, input = state.input;
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  if (player.car) {
    const car = player.car;
    const throttle = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) - (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
    const steer = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) - (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
    const before = Math.abs(car.speed);
    driveCarPhysics(car, throttle, steer, dt);
    const hardHit = collideCarWithCity(state, car);
    if (hardHit && before > 150) {
      state.commitCrime(1, 'Reckless ramming');
      damagePlayer(state, 4);
      state.audio.playCrashSound();
    }
    if (Math.abs(car.speed) > 60 && state.rng() < dt * 6) {
      state.particles.push({ x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color: 'rgba(60,60,60,0.5)', size: 4 });
    }
    updateCarDamageEffects(state, car, dt);
    state.audio.setEngineSound(Math.abs(car.speed) / 330);
    player.x = car.x; player.y = car.y;
    return;
  }
  state.audio.setEngineSound(0);
  const ax = input.moveAxisX(), ay = input.moveAxisY();
  const sprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const speed = sprinting ? 235 : 148;
  const moving = ax !== 0 || ay !== 0;
  const len = moving ? Math.hypot(ax, ay) : 1;
  player.footSpeed = moving ? speed : 0;
  player.x += (ax / len) * speed * dt;
  player.y += (ay / len) * speed * dt;
  if (moving) player.walkPhase += dt * (sprinting ? 13 : 10);
  // Aim at the mouse; face movement only when the mouse has never moved.
  const mouseWorldX = state.camera.screenToWorldX(input.mouseScreenX);
  const mouseWorldY = state.camera.screenToWorldY(input.mouseScreenY);
  player.angle = angleTowards(player.x, player.y, mouseWorldX, mouseWorldY);
  player.x = clampValue(player.x, 16, WORLD_WIDTH - 16);
  player.y = clampValue(player.y, 16, WATER_Y - 8);
  for (const b of state.city.buildings) {
    const pushed = pushCircleOutOfRect(player.x, player.y, PLAYER_RADIUS, b);
    if (pushed.hit) { player.x = pushed.x; player.y = pushed.y; }
  }
}

/** Hurt Rico; reaching zero means WASTED. Cars soak half the damage first. */
export function damagePlayer(state, amount) {
  const player = state.player;
  if (player.car) { player.car.hp -= amount * 0.7; amount *= 0.45; }
  player.hp -= amount;
  player.hurtFlash = 0.25;
  if (player.hp <= 0 && !player.dead) { player.hp = 0; player.dead = true; state.onPlayerWasted(); }
}

/** Slowly patch Rico up when he is safe, out of combat and un-wanted. */
export function updatePlayerHealing(state, dt) {
  const player = state.player;
  if (player.dead) return;
  if (player.hp < PLAYER_MAX_HP && state.wanted === 0 && state.combatTimer <= 0) {
    player.hp = Math.min(PLAYER_MAX_HP, player.hp + 3.2 * dt);
  }
}

/** Draw Rico: stride, teal shirt, and a gun line toward his aim when armed on foot. */
export function drawPlayer(ctx, state, time) {
  const player = state.player;
  if (player.car) return; // hidden inside the car; the car itself is drawn by vehicles
  ctx.save(); ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(1, 4, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  const stride = Math.sin(player.walkPhase) * 4;
  ctx.strokeStyle = '#f4f1de'; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
  ctx.save(); ctx.rotate(player.angle + Math.PI / 2);
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(stride, 10); ctx.moveTo(0, 2); ctx.lineTo(-stride, 10); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = player.hurtFlash > 0 ? '#ff5d73' : '#00b4a2';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(0, -1, 5.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#132a3a'; ctx.beginPath(); ctx.arc(0, -3.6, 5.6, Math.PI, 0); ctx.fill();
  // Sunglasses + gun arm toward the aim.
  ctx.save(); ctx.rotate(player.angle);
  ctx.fillStyle = '#10151c'; ctx.fillRect(3, -2.4, 5, 4.8);
  ctx.strokeStyle = '#f2c89b'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(13, 3); ctx.stroke();
  ctx.fillStyle = '#22242c'; ctx.fillRect(12, 1.4, 9, 3.4);
  ctx.restore();
  ctx.restore();
  // Name tag so screenshots read clearly.
  ctx.fillStyle = 'rgba(3,34,50,.75)'; ctx.fillRect(player.x - 26, player.y - 34, 52, 13);
  ctx.fillStyle = '#7fe7dc'; ctx.font = 'bold 9px Verdana'; ctx.textAlign = 'center';
  ctx.fillText('RICO', player.x, player.y - 24);
}
