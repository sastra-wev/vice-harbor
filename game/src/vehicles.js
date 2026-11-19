// vehicles.js — every car in Port Palmera: creation, driving physics, building
// collision, damage smoke, drawing, and the steal / enter / exit logic.

import { clampValue, pushCircleOutOfRect, spawnParticles } from './engine.js';

export const CAR_COLORS = ['#ff5964', '#ffe74c', '#35a7ff', '#6bf178', '#ff9f1c', '#c77dff', '#4cc9f0', '#f72585', '#ffffff', '#2ec4b6'];
export const CAR_NAMES = ['Solana Coupe', 'Palmera Cabrio', 'Reef Pickup', 'Luna Sedan', 'Coco Hatch', 'Faro Van'];

/** Create a car. kind: 'parked' | 'traffic' | 'police' | 'player' | 'target'. */
export function createCar(x, y, angle, color, kind, rng) {
  return {
    x, y, angle, speed: 0, steer: 0, color, kind,
    name: CAR_NAMES[Math.floor(rng() * CAR_NAMES.length)],
    width: 46, height: 24, hp: 100, smokeTimer: 0,
    axis: 'h', dir: 1, laneCoord: 0, cruiseSpeed: 110 + rng() * 60,
    sirenPhase: rng() * 6, isTargetCar: false,
  };
}

/** Spawn the parked cars scattered on roadsides all over the city. */
export function spawnParkedCars(state) {
  const cars = [];
  const spots = [
    [340, 210], [600, 330], [980, 210], [1140, 600], [1400, 330], [1540, 990],
    [1780, 210], [1940, 600], [2180, 330], [340, 990], [600, 1130], [980, 1350],
    [1140, 990], [1400, 1130], [1780, 1350], [1940, 990], [2180, 1130], [460, 1490],
    [860, 1490], [1260, 1490], [1660, 1490], [2060, 1490], [340, 600], [1540, 210],
  ];
  for (const [x, y] of spots) {
    const vertical = state.rng() < 0.5;
    cars.push(createCar(x, y, vertical ? Math.PI / 2 : 0, CAR_COLORS[Math.floor(state.rng() * CAR_COLORS.length)], 'parked', state.rng));
  }
  return cars;
}

/** Accelerate / brake / steer a car from driver input (-1..1 throttle, -1..1 steer). */
export function driveCarPhysics(car, throttle, steer, dt) {
  const maxForward = 330, maxReverse = 110;
  if (throttle > 0) car.speed += 260 * dt;
  else if (throttle < 0) car.speed -= (car.speed > 10 ? 420 : 170) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 90 * dt);
  car.speed = clampValue(car.speed, -maxReverse, maxForward);
  const grip = clampValue(Math.abs(car.speed) / 60, 0, 1);
  car.angle += steer * grip * 1.9 * dt * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

/** Keep a car inside the world and out of buildings; returns true on a hard hit. */
export function collideCarWithCity(state, car) {
  car.x = clampValue(car.x, 30, 2470); car.y = clampValue(car.y, 30, 1700);
  let hardHit = false;
  for (const b of state.city.buildings) {
    const pushed = pushCircleOutOfRect(car.x, car.y, 24, b);
    if (pushed.hit) {
      if (Math.abs(car.speed) > 130) { hardHit = true; car.hp -= 9; }
      car.x = pushed.x; car.y = pushed.y; car.speed *= 0.35;
    }
  }
  return hardHit;
}

/** Damage smoke and spark effects for a beaten-up car. */
export function updateCarDamageEffects(state, car, dt) {
  if (car.hp >= 55) return;
  car.smokeTimer -= dt;
  if (car.smokeTimer <= 0) {
    car.smokeTimer = car.hp < 25 ? 0.08 : 0.22;
    spawnParticles(state, car.x + Math.cos(car.angle) * 16, car.y + Math.sin(car.angle) * 16, car.hp < 25 ? '#ff7b3d' : '#5a5a5a', 1, 22, 0.9, 5);
  }
}

/** Draw a car top-down: shadow, body, cabin, wheels, headlights; police livery when needed. */
export function drawCar(ctx, car, time) {
  ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(3, 5, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1c1c22';
  for (const [wx, wy] of [[-15, -13], [15, -13], [-15, 10], [15, 10]]) ctx.fillRect(wx, wy, 10, 5);
  ctx.fillStyle = car.kind === 'police' ? '#f4f6f8' : car.color;
  ctx.beginPath(); ctx.roundRect(-23, -12, 46, 24, 7); ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#123c4d'; ctx.fillRect(-23, -12, 46, 6); ctx.fillRect(-23, 6, 46, 6);
    ctx.fillStyle = '#123c4d'; ctx.font = 'bold 7px Verdana'; ctx.textAlign = 'center'; ctx.fillText('HARBOR PATROL', 0, 3);
    const flash = Math.sin(time * 14 + car.sirenPhase) > 0;
    ctx.fillStyle = flash ? '#ff3b30' : '#3da9ff';
    ctx.beginPath(); ctx.arc(-4, 0, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#3da9ff' : '#ff3b30';
    ctx.beginPath(); ctx.arc(4, 0, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(20,40,60,.85)'; ctx.beginPath(); ctx.roundRect(-9, -9, 17, 18, 4); ctx.fill();
  ctx.fillStyle = 'rgba(160,225,255,.8)'; ctx.fillRect(5, -8, 4, 16);
  ctx.fillStyle = '#fff6bf';
  ctx.beginPath(); ctx.arc(23, -8, 2.6, 0, Math.PI * 2); ctx.arc(23, 8, 2.6, 0, Math.PI * 2); ctx.fill();
  if (car.isTargetCar) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(-26, -15, 52, 30, 9); ctx.stroke(); }
  if (car.hp < 30) { ctx.fillStyle = 'rgba(30,30,30,.35)'; ctx.beginPath(); ctx.roundRect(-23, -12, 20, 24, 7); ctx.fill(); }
  ctx.restore();
}

/** The car nearest to a point within `range`, of any stealable kind, or null. */
export function findNearestStealableCar(state, x, y, range) {
  let best = null, bestD = range;
  const all = [...state.parkedCars, ...state.trafficCars];
  for (const car of all) { const d = Math.hypot(car.x - x, car.y - y); if (d < bestD) { bestD = d; best = car; } }
  return best;
}

/** Try to enter (steal) a car or exit the current one. Returns a message for the HUD. */
export function toggleEnterExitCar(state) {
  const player = state.player;
  if (player.car) {
    const car = player.car;
    car.kind = 'parked'; car.speed = 0;
    if (!state.parkedCars.includes(car)) state.parkedCars.push(car);
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    player.car = null;
    state.audio.playDoorSound();
    return 'On foot';
  }
  const car = findNearestStealableCar(state, player.x, player.y, 52);
  if (!car) return null;
  car.previousKind = car.kind;
  // Move the car from its old list into the player's hands.
  state.parkedCars = state.parkedCars.filter((c) => c !== car);
  state.trafficCars = state.trafficCars.filter((c) => c !== car);
  car.kind = 'player'; car.speed = 0;
  player.car = car;
  state.audio.playDoorSound();
  if (!car.wasStolenBefore) {
    car.wasStolenBefore = true;
    state.commitCrime(1, 'Car stolen');
  }
  return 'Driving ' + car.name;
}
