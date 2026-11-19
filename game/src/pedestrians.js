// pedestrians.js — citizens strolling the sidewalks and boardwalk. They
// chat-walk in pairs, flee gunfire and fast cars, and falling one is a crime.

import { makeSeededRandom } from './engine.js';
import { VERTICAL_ROADS, HORIZONTAL_ROADS, SAND_START_X, blockedAt } from './city.js';

const SHIRT_COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#f368e0', '#ff9f43', '#54a0ff', '#5f27cd', '#ffffff', '#ff8fa3'];

export function spawnPedestrians(seed, count) {
  const random = makeSeededRandom(seed || 55);
  const peds = [];
  const total = count || 30;
  for (let i = 0; i < total; i++) {
    let x;
    let y;
    const zone = random();
    if (zone < 0.3) {
      // Boardwalk crowd.
      x = SAND_START_X + 8 + random() * 26;
      y = 80 + random() * 1800;
    } else if (zone < 0.65) {
      const road = HORIZONTAL_ROADS[Math.floor(random() * HORIZONTAL_ROADS.length)];
      x = 80 + random() * 1950;
      y = road + (random() < 0.5 ? -80 : 80);
    } else {
      const road = VERTICAL_ROADS[Math.floor(random() * VERTICAL_ROADS.length)];
      x = road + (random() < 0.5 ? -80 : 80);
      y = 80 + random() * 1850;
    }
    peds.push({
      x, y,
      angle: random() * Math.PI * 2,
      speed: 34 + random() * 30,
      shirt: SHIRT_COLORS[Math.floor(random() * SHIRT_COLORS.length)],
      walkPhase: random() * 6.28,
      state: 'walk', // walk | flee | fallen
      stateTimer: 0,
      turnTimer: 1 + random() * 4,
      hitReported: false,
    });
  }
  return peds;
}

export function updatePedestrians(game, dt) {
  for (const ped of game.pedestrians) {
    if (ped.state === 'fallen') continue;
    ped.turnTimer -= dt;
    let speed = ped.speed;
    // Flee from gunfire, sirens up close, or a car bearing down.
    let threat = null;
    if (game.alarmTimer > 0) threat = game.player;
    const fastCar = game.player.car && Math.abs(game.player.car.speed) > 120 ? game.player.car : null;
    if (fastCar && Math.hypot(fastCar.x - ped.x, fastCar.y - ped.y) < 110) threat = fastCar;
    if (threat) {
      ped.state = 'flee';
      ped.angle = Math.atan2(ped.y - threat.y, ped.x - threat.x);
      speed = 165;
    } else if (ped.state === 'flee') {
      ped.state = 'walk';
    }
    if (ped.state === 'walk' && ped.turnTimer <= 0) {
      ped.turnTimer = 2 + game.rng() * 4;
      ped.angle += (game.rng() - 0.5) * 1.6;
    }
    const nextX = ped.x + Math.cos(ped.angle) * speed * dt;
    const nextY = ped.y + Math.sin(ped.angle) * speed * dt;
    if (blockedAt(game.city, nextX, nextY, 10)) {
      ped.angle += Math.PI * 0.75;
    } else {
      ped.x = nextX;
      ped.y = nextY;
    }
    ped.walkPhase += dt * (ped.state === 'flee' ? 13 : 7);
    // Run over by the player: a crime the harbor notices.
    const vehiclesToCheck = game.player.car ? [game.player.car] : [];
    for (const car of vehiclesToCheck) {
      if (Math.abs(car.speed) > 45 && Math.hypot(car.x - ped.x, car.y - ped.y) < 26) {
        ped.state = 'fallen';
        if (!ped.hitReported) {
          ped.hitReported = true;
          game.reportCrime(1, 'Pedestrian down');
          game.audio.playCrash(2);
          game.spawnParticles(ped.x, ped.y, '#ff6b6b', 8);
        }
      }
    }
  }
}

export function drawPedestrianFigure(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'fallen') {
    ctx.rotate(1.5);
    ctx.fillStyle = ped.shirt;
    ctx.fillRect(-12, -4, 24, 8);
    ctx.fillStyle = '#f2c297';
    ctx.beginPath();
    ctx.arc(15, 0, 5.5, 0, 7);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.walkPhase) * 1.6;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 8, 4, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#2b3a42';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 1);
  ctx.lineTo(Math.cos(ped.angle) * 3 + Math.sin(ped.walkPhase) * 4, 8);
  ctx.moveTo(0, 1);
  ctx.lineTo(Math.cos(ped.angle) * 3 - Math.sin(ped.walkPhase) * 4, 8);
  ctx.stroke();
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 7.5, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#f2c297';
  ctx.beginPath();
  ctx.arc(Math.cos(ped.angle) * 2.5, bob * 0.3 - 1, 4.6, 0, 7);
  ctx.fill();
  void time;
  ctx.restore();
}
