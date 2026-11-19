// traffic.js — Port Palmera's everyday drivers: lane discipline, braking
// for obstacles, random turns at intersections, and panic when shot at.

import { makeSeededRandom, turnAngleTowards } from './engine.js';
import { VERTICAL_ROADS, HORIZONTAL_ROADS, WORLD_WIDTH, WORLD_HEIGHT } from './city.js';
import { makeCar, CAR_PAINTS, CAR_MODELS } from './vehicles.js';

const LANE_OFFSET = 29;

export function spawnTrafficCars(seed, count) {
  const random = makeSeededRandom(seed || 33);
  const cars = [];
  const total = count || 17;
  for (let i = 0; i < total; i++) {
    const vertical = random() < 0.5;
    const dir = random() < 0.5 ? 1 : -1;
    let x;
    let y;
    let angle;
    if (vertical) {
      const road = VERTICAL_ROADS[Math.floor(random() * VERTICAL_ROADS.length)];
      x = road + dir * LANE_OFFSET * -1; // right-hand traffic
      y = 120 + random() * (WORLD_HEIGHT - 240);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const road = HORIZONTAL_ROADS[Math.floor(random() * HORIZONTAL_ROADS.length)];
      y = road + dir * LANE_OFFSET;
      x = 120 + random() * 1900;
      angle = dir > 0 ? 0 : Math.PI;
    }
    const car = makeCar(x, y, angle, CAR_PAINTS[Math.floor(random() * CAR_PAINTS.length)], CAR_MODELS[Math.floor(random() * CAR_MODELS.length)], 'traffic');
    car.axis = vertical ? 'v' : 'h';
    car.dir = dir;
    car.cruiseSpeed = 130 + random() * 90;
    car.turnCooldown = 2 + random() * 5;
    car.panicTimer = 0;
    cars.push(car);
  }
  return cars;
}

function obstacleAhead(game, car, lookDist) {
  const probeX = car.x + Math.cos(car.angle) * lookDist;
  const probeY = car.y + Math.sin(car.angle) * lookDist;
  const others = [...game.trafficCars, ...game.policeCars, ...game.parkedCars];
  if (game.player.car) others.push(game.player.car);
  if (game.goldCoupe) others.push(game.goldCoupe);
  for (const other of others) {
    if (other === car) continue;
    if (Math.hypot(other.x - probeX, other.y - probeY) < 34) return true;
  }
  if (!game.player.car && Math.hypot(game.player.x - probeX, game.player.y - probeY) < 24) return true;
  return false;
}

function maybeTurnAtIntersection(car, dt, random) {
  car.turnCooldown -= dt;
  if (car.turnCooldown > 0) return;
  const roads = car.axis === 'v' ? HORIZONTAL_ROADS : VERTICAL_ROADS;
  const along = car.axis === 'v' ? car.y : car.x;
  for (const road of roads) {
    if (Math.abs(along - road) < 8) {
      if (random() < 0.45) {
        const newDir = random() < 0.5 ? 1 : -1;
        if (car.axis === 'v') {
          car.axis = 'h';
          car.dir = newDir;
          car.y = road;
        } else {
          car.axis = 'v';
          car.dir = newDir;
          car.x = road;
        }
      }
      car.turnCooldown = 3 + random() * 4;
      return;
    }
  }
}

export function updateTrafficCars(game, dt) {
  const random = game.rng;
  for (const car of game.trafficCars) {
    if (car.driver === 'player' || car.driver === 'abandoned') continue;
    if (car.panicTimer > 0) car.panicTimer -= dt;
    const targetSpeed = car.panicTimer > 0 ? 300 : car.cruiseSpeed;
    const blocked = obstacleAhead(game, car, 58);
    if (blocked) car.speed = Math.max(0, car.speed - 340 * dt);
    else if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 170 * dt);
    else car.speed = Math.max(targetSpeed, car.speed - 120 * dt);

    // Desired heading: straight along the current axis in the lane direction.
    let wantedAngle;
    if (car.axis === 'v') {
      wantedAngle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      const road = VERTICAL_ROADS.reduce((best, rx) => (Math.abs(rx - car.x) < Math.abs(best - car.x) ? rx : best), VERTICAL_ROADS[0]);
      car.x += ((road - car.dir * LANE_OFFSET) - car.x) * Math.min(1, dt * 2);
    } else {
      wantedAngle = car.dir > 0 ? 0 : Math.PI;
      const road = HORIZONTAL_ROADS.reduce((best, ry) => (Math.abs(ry - car.y) < Math.abs(best - car.y) ? ry : best), HORIZONTAL_ROADS[0]);
      car.y += ((road + car.dir * LANE_OFFSET) - car.y) * Math.min(1, dt * 2);
    }
    car.angle = turnAngleTowards(car.angle, wantedAngle, dt * 3.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    // Wrap around the city edge instead of leaving the world.
    if (car.x < 40) car.x = 2040;
    if (car.x > 2060) car.x = 60;
    if (car.y < 40) car.y = WORLD_HEIGHT - 60;
    if (car.y > WORLD_HEIGHT - 40) car.y = 60;

    maybeTurnAtIntersection(car, dt, random);

    // Bumping the player's ride is a crime scene: panic + a little damage.
    const playerCar = game.player.car;
    if (playerCar && Math.hypot(playerCar.x - car.x, playerCar.y - car.y) < 40 && Math.abs(playerCar.speed) > 60) {
      car.panicTimer = 2.5;
      car.health = Math.max(0, car.health - 6);
    }
  }
}
