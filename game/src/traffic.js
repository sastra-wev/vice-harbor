// traffic.js — Port Palmera's everyday traffic: cars that pick a road, hold their
// lane, slow for the car ahead, brake for chaos, and loop around the city forever.

import { ROAD_XS, ROAD_YS, ROAD_WIDTH, WORLD_WIDTH, BEACH_Y } from './city.js';
import { createCar, CAR_COLORS, drawCar, updateCarDamageEffects } from './vehicles.js';

const LANE_OFFSET = ROAD_WIDTH / 4;

/** Create the traffic fleet, spread over both road directions. */
export function spawnTrafficCars(state, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = state.rng() < 0.5;
    const dir = state.rng() < 0.5 ? 1 : -1;
    let car;
    if (vertical) {
      const roadX = ROAD_XS[Math.floor(state.rng() * ROAD_XS.length)];
      car = createCar(roadX + dir * LANE_OFFSET, 80 + state.rng() * (BEACH_Y - 60), dir > 0 ? Math.PI / 2 : -Math.PI / 2, CAR_COLORS[i % CAR_COLORS.length], 'traffic', state.rng);
      car.axis = 'v'; car.laneCoord = roadX + dir * LANE_OFFSET;
    } else {
      const roadY = ROAD_YS[Math.floor(state.rng() * ROAD_YS.length)];
      car = createCar(80 + state.rng() * (WORLD_WIDTH - 160), roadY - dir * LANE_OFFSET, dir > 0 ? 0 : Math.PI, CAR_COLORS[(i + 3) % CAR_COLORS.length], 'traffic', state.rng);
      car.axis = 'h'; car.laneCoord = roadY - dir * LANE_OFFSET;
    }
    car.dir = dir;
    car.speed = car.cruiseSpeed * 0.7;
    cars.push(car);
  }
  return cars;
}

/** Distance to the nearest obstacle ahead of a traffic car (player, police, other traffic). */
function obstacleAheadDistance(state, car) {
  let best = 190;
  const aheadX = car.x + Math.cos(car.angle) * 60, aheadY = car.y + Math.sin(car.angle) * 60;
  const check = (ox, oy, radius) => {
    const along = (ox - car.x) * Math.cos(car.angle) + (oy - car.y) * Math.sin(car.angle);
    const side = Math.abs((ox - car.x) * -Math.sin(car.angle) + (oy - car.y) * Math.cos(car.angle));
    if (along > 0 && along < best && side < radius) best = along;
  };
  for (const other of state.trafficCars) if (other !== car) check(other.x, other.y, 26);
  for (const cop of state.policeCars) check(cop.x, cop.y, 26);
  if (state.player.car) check(state.player.car.x, state.player.car.y, 26);
  else check(state.player.x, state.player.y, 16);
  check(aheadX, aheadY, 0); // keep signature simple; no-op anchor
  return best;
}

/** Advance every traffic car one step along its lane. */
export function updateTrafficCars(state, dt) {
  for (const car of state.trafficCars) {
    const gap = obstacleAheadDistance(state, car);
    const target = gap < 60 ? 0 : gap < 130 ? car.cruiseSpeed * 0.45 : car.cruiseSpeed;
    car.speed += Math.sign(target - car.speed) * Math.min(Math.abs(target - car.speed), 190 * dt);
    if (car.axis === 'v') {
      car.y += car.dir * car.speed * dt; car.x = car.laneCoord; car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y > BEACH_Y + 90) car.y = -30;
      if (car.y < -40) car.y = BEACH_Y + 80;
    } else {
      car.x += car.dir * car.speed * dt; car.y = car.laneCoord; car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x > WORLD_WIDTH + 40) car.x = -30;
      if (car.x < -40) car.x = WORLD_WIDTH + 30;
    }
    updateCarDamageEffects(state, car, dt);
  }
}

/** Draw every traffic car. */
export function drawTrafficCars(ctx, state, time) {
  for (const car of state.trafficCars) drawCar(ctx, car, time);
}
