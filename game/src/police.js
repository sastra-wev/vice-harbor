// police.js — the Harbor Patrol: the wanted-star system, patrol spawns at the
// city edge, pursuit steering that rams and blocks, and the bust meter.

import { clampValue, turnAngleTowards, angleTowards, distanceBetween } from './engine.js';
import { createCar, drawCar, updateCarDamageEffects } from './vehicles.js';
import { playerPosition, playerSpeed } from './player.js';

export const MAX_WANTED = 5;

/** How many patrol cars each wanted level sends after Rico. */
export function policeCountForWanted(wanted) { return wanted <= 0 ? 0 : 1 + wanted; }

/** Register a crime: raise the wanted level (capped) and restart the heat clock. */
export function commitCrime(state, stars, label) {
  if (state.mode !== 'play') return;
  const before = state.wanted;
  state.wanted = clampValue(state.wanted + stars, 0, MAX_WANTED);
  state.heatTimer = 0;
  state.lastCrimeLabel = label;
  if (state.wanted > before) state.showToast('★ WANTED — ' + label);
}

/** Spawn one patrol car just off-screen, at the nearest road edge to the player. */
export function spawnPoliceCar(state) {
  const p = playerPosition(state);
  const angle = state.rng() * Math.PI * 2;
  const x = clampValue(p.x + Math.cos(angle) * 560, 60, 2440);
  const y = clampValue(p.y + Math.sin(angle) * 460, 60, 1560);
  const car = createCar(x, y, angleTowards(x, y, p.x, p.y), '#f4f6f8', 'police', state.rng);
  car.cruiseSpeed = 300;
  state.policeCars.push(car);
}

/** Keep the patrol fleet matched to the wanted level; cool the heat over time. */
export function updateWantedSystem(state, dt) {
  state.heatTimer += dt;
  // Heat cools when no cop can see Rico for a while.
  const p = playerPosition(state);
  let seen = false;
  for (const cop of state.policeCars) if (distanceBetween(cop.x, cop.y, p.x, p.y) < 330) seen = true;
  if (state.wanted > 0 && state.heatTimer > 9 && !seen) {
    state.wanted -= 1; state.heatTimer = 0;
    state.showToast(state.wanted === 0 ? 'You lost the Harbor Patrol' : 'Heat cooling…');
  }
  const wantedCount = policeCountForWanted(state.wanted);
  while (state.policeCars.length < wantedCount) spawnPoliceCar(state);
  while (state.policeCars.length > wantedCount) {
    // The farthest patrol car gives up and leaves.
    let farIndex = 0, farD = -1;
    state.policeCars.forEach((cop, i) => { const d = distanceBetween(cop.x, cop.y, p.x, p.y); if (d > farD) { farD = d; farIndex = i; } });
    state.policeCars.splice(farIndex, 1);
  }
  if (state.wanted > 0 && state.rng() < dt * 0.4) state.audio.playSirenBlip();
}

/** Steer one patrol car: chase, predict, ram when close, block the road ahead. */
export function updatePoliceCar(state, car, dt) {
  const p = playerPosition(state);
  const dist = distanceBetween(car.x, car.y, p.x, p.y);
  // Aim at where the player will be, slightly ahead — the blocking move.
  const lead = clampValue(dist / 320, 0, 0.85);
  const targetX = p.x + Math.cos(state.player.car ? state.player.car.angle : state.player.angle) * playerSpeed(state) * lead * 0.6;
  const targetY = p.y + Math.sin(state.player.car ? state.player.car.angle : state.player.angle) * playerSpeed(state) * lead * 0.6;
  const desired = angleTowards(car.x, car.y, targetX, targetY);
  car.angle = turnAngleTowards(car.angle, desired, 2.4 * dt);
  const topSpeed = state.wanted >= 4 ? 345 : 312;
  const catching = dist > 46;
  car.speed += Math.sign((catching ? topSpeed : 0) - car.speed) * Math.min(Math.abs((catching ? topSpeed : 0) - car.speed), 300 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clampValue(car.x, 26, 2474); car.y = clampValue(car.y, 26, 1700);
  // Patrol cars shove off buildings rather than entering them.
  for (const b of state.city.buildings) {
    if (car.x > b.x - 22 && car.x < b.x + b.w + 22 && car.y > b.y - 22 && car.y < b.y + b.h + 22) {
      car.speed *= 0.4;
      car.x += (car.x < b.x + b.w / 2 ? -1 : 1) * 60 * dt * 4;
      car.y += (car.y < b.y + b.h / 2 ? -1 : 1) * 60 * dt * 4;
    }
  }
  updateCarDamageEffects(state, car, dt);
}

/** The bust meter: fills while a patrol car is close and Rico is slow or on foot. */
export function updateBustMeter(state, dt) {
  const p = playerPosition(state);
  let nearCop = false;
  for (const cop of state.policeCars) if (distanceBetween(cop.x, cop.y, p.x, p.y) < 78) nearCop = true;
  const slow = playerSpeed(state) < 42;
  if (state.wanted > 0 && nearCop && slow) state.bustMeter = Math.min(1, state.bustMeter + dt / 2.6);
  else state.bustMeter = Math.max(0, state.bustMeter - dt / 1.4);
  if (state.bustMeter >= 1) state.onPlayerBusted();
}

/** Advance the whole police system one frame. */
export function updatePolice(state, dt) {
  updateWantedSystem(state, dt);
  for (const cop of state.policeCars) updatePoliceCar(state, cop, dt);
  updateBustMeter(state, dt);
}

/** Draw every patrol car with its flashing light bar. */
export function drawPoliceCars(ctx, state, time) {
  for (const cop of state.policeCars) drawCar(ctx, cop, time);
}
