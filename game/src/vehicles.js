// vehicles.js — car bodies, driving physics, the parked fleet and stealing.

import { clampNumber, turnAngleTowards, makeSeededRandom } from './engine.js';
import { pointHitsBuilding, isInWater, WORLD_WIDTH, WORLD_HEIGHT, VERTICAL_ROADS, HORIZONTAL_ROADS } from './city.js';

export const CAR_PAINTS = ['#ff5964', '#ffe74c', '#35a7ff', '#6bf178', '#ff9f1c', '#c084fc', '#f8f7ff', '#00c2a8', '#ff70a6', '#4cc9f0'];
export const CAR_MODELS = ['compact', 'sedan', 'coupe', 'pickup', 'van'];

let nextCarId = 1;

export function makeCar(x, y, angle, color, model, kind) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    color,
    model: model || 'sedan',
    kind: kind || 'parked', // parked | traffic | police | gold
    driver: kind === 'traffic' ? 'traffic' : null,
    health: 100,
    stolenOnce: false,
    width: model === 'van' || model === 'pickup' ? 52 : 46,
    length: model === 'van' ? 26 : 23,
    steerVisual: 0,
  };
}

export function spawnParkedCars(city, seed) {
  const random = makeSeededRandom(seed || 21);
  const cars = [];
  const spots = [];
  for (const ry of HORIZONTAL_ROADS) {
    for (let x = 330; x < 2050; x += 210) spots.push({ x: x + random() * 40, y: ry - 82, angle: 0 });
    for (let x = 430; x < 2050; x += 260) spots.push({ x: x + random() * 40, y: ry + 82, angle: Math.PI });
  }
  for (const rx of VERTICAL_ROADS) {
    for (let y = 360; y < 1900; y += 300) spots.push({ x: rx - 82, y: y + random() * 40, angle: Math.PI / 2 });
  }
  let placed = 0;
  for (const spot of spots) {
    if (placed >= 26) break;
    if (random() < 0.3) continue;
    if (pointHitsBuilding(city, spot.x, spot.y, 30)) continue;
    cars.push(makeCar(spot.x, spot.y, spot.angle, CAR_PAINTS[Math.floor(random() * CAR_PAINTS.length)], CAR_MODELS[Math.floor(random() * CAR_MODELS.length)], 'parked'));
    placed++;
  }
  return cars;
}

export function makeGoldCoupe(x, y) {
  const car = makeCar(x, y, 0, '#ffd700', 'coupe', 'gold');
  car.isGoldCoupe = true;
  return car;
}

export function driveCarPhysics(car, throttle, steer, dt, city, onCrash) {
  const accel = car.kind === 'police' ? 260 : 225;
  const maxForward = car.kind === 'police' ? 355 : 320;
  const maxReverse = 110;
  if (throttle > 0) car.speed += accel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 4 ? 330 : 130) * dt;
  else car.speed -= car.speed * 1.6 * dt;
  car.speed = clampNumber(car.speed, -maxReverse, maxForward);
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;
  const steerAmount = steer * (car.speed >= 0 ? 1 : -1);
  car.angle += steerAmount * dt * (1.15 - Math.min(0.55, Math.abs(car.speed) / 700)) * (Math.abs(car.speed) > 4 ? 1 : 0);
  car.steerVisual = steer;
  const nextX = car.x + Math.cos(car.angle) * car.speed * dt;
  const nextY = car.y + Math.sin(car.angle) * car.speed * dt;
  const hitWall = pointHitsBuilding(city, nextX, nextY, 20) || isInWater(nextX, nextY)
    || nextX < 24 || nextY < 24 || nextX > WORLD_WIDTH - 24 || nextY > WORLD_HEIGHT - 24;
  if (hitWall) {
    if (Math.abs(car.speed) > 120 && onCrash) onCrash(Math.abs(car.speed));
    car.health = Math.max(0, car.health - Math.abs(car.speed) * 0.03);
    car.speed = -car.speed * 0.25;
  } else {
    car.x = nextX;
    car.y = nextY;
  }
  return car;
}

export function coastCar(car, dt, city) {
  // A driverless car rolls to a stop.
  driveCarPhysics(car, 0, 0, dt, city, null);
}

export function drawVehicleBody(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = car.width;
  const W = car.length;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 5, L, W);
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-L / 2, -W / 2, L, W, 7);
  ctx.fill();
  if (car.isGoldCoupe) {
    ctx.strokeStyle = '#fff3b0';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (Math.sin(time * 5) > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(L * 0.22, -W * 0.2, 3, 0, 7);
      ctx.fill();
    }
  }
  // Cabin, windshield and rear window.
  ctx.fillStyle = '#17323e';
  ctx.fillRect(-L * 0.18, -W / 2 + 3, L * 0.42, 5);
  ctx.fillRect(-L * 0.3, W / 2 - 8, L * 0.4, 5);
  ctx.fillStyle = '#28536b';
  ctx.fillRect(-L * 0.28, -W * 0.18, L * 0.56, W * 0.4);
  // Wheels.
  ctx.fillStyle = '#14161a';
  const wy = W / 2 - 1;
  ctx.fillRect(-L / 2 + 5, -wy - 2, 11, 4.5);
  ctx.fillRect(L / 2 - 16, -wy - 2, 11, 4.5);
  ctx.fillRect(-L / 2 + 5, wy - 2.5, 11, 4.5);
  ctx.fillRect(L / 2 - 16, wy - 2.5, 11, 4.5);
  // Headlights.
  ctx.fillStyle = '#fff9c4';
  ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 3, W / 2 - 8, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#f1fa8c';
    ctx.fillRect(-8, -W * 0.3, 16, W * 0.6);
    ctx.fillStyle = '#073b4c';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.rotate(Math.PI / 2);
    ctx.fillText('PATROL', 0, 3);
    ctx.restore();
    const flash = Math.sin(time * 11) > 0;
    ctx.fillStyle = flash ? '#ff2e4d' : '#3066ff';
    ctx.fillRect(-3, -7, 6, 6);
    ctx.fillStyle = flash ? '#3066ff' : '#ff2e4d';
    ctx.fillRect(-3, 1, 6, 6);
    ctx.fillStyle = flash ? 'rgba(255,46,77,0.16)' : 'rgba(48,102,255,0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, 7);
    ctx.fill();
  }
  if (car.health < 45) {
    ctx.fillStyle = 'rgba(70,70,70,0.55)';
    ctx.beginPath();
    ctx.arc(L / 2 - 4, 0, 6 + Math.sin(time * 7) * 2, 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function nearestStealableCar(game, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  const consider = (car) => {
    if (car.driver === 'player') return;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  };
  for (const car of game.parkedCars) consider(car);
  for (const car of game.trafficCars) consider(car);
  if (game.goldCoupe) consider(game.goldCoupe);
  return best;
}

export function enterCar(game, car) {
  car.driver = 'player';
  car.previousKind = car.kind;
  game.player.car = car;
  game.player.x = car.x;
  game.player.y = car.y;
  if (!car.stolenOnce) {
    car.stolenOnce = true;
    if (car.kind !== 'gold') game.reportCrime(1, 'Car stolen');
    game.audio.playDoorSlam();
  }
}

export function exitCar(game) {
  const car = game.player.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  game.player.car = null;
  const sideX = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  const sideY = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  game.player.x = sideX;
  game.player.y = sideY;
  game.audio.playDoorSlam();
}
