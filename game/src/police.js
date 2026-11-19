// police.js — the Harbor Patrol: wanted stars, predictive pursuit, ramming,
// roadblocks-by-position, the bust meter and heat cooling out of sight.

import { clampNumber, turnAngleTowards, distanceBetween } from './engine.js';
import { VERTICAL_ROADS, HORIZONTAL_ROADS } from './city.js';
import { makeCar, driveCarPhysics } from './vehicles.js';
import { playerAnchor } from './player.js';

export function reportCrimeToPolice(game, amount, reason) {
  if (game.mode !== 'playing') return;
  const before = Math.floor(game.wanted);
  game.wanted = clampNumber(game.wanted + amount, 0, 5);
  game.lastCrimeAt = game.time;
  game.lastCrimeReason = reason;
  if (Math.floor(game.wanted) > before) {
    game.showBanner(`WANTED ${'★'.repeat(Math.floor(game.wanted))} — ${reason}`);
  }
}

function spawnPatrolCar(game) {
  const anchor = playerAnchor(game);
  // Spawn on a road ring around the player, out of immediate view.
  const ring = 480 + game.rng() * 160;
  const theta = game.rng() * Math.PI * 2;
  let x = anchor.x + Math.cos(theta) * ring;
  let y = anchor.y + Math.sin(theta) * ring;
  // Snap to the nearest road so patrols arrive by street, not through walls.
  const nearV = VERTICAL_ROADS.reduce((best, rx) => (Math.abs(rx - x) < Math.abs(best - x) ? rx : best), VERTICAL_ROADS[0]);
  const nearH = HORIZONTAL_ROADS.reduce((best, ry) => (Math.abs(ry - y) < Math.abs(best - y) ? ry : best), HORIZONTAL_ROADS[0]);
  if (Math.abs(nearV - x) < Math.abs(nearH - y)) x = nearV;
  else y = nearH;
  x = clampNumber(x, 60, 2300);
  y = clampNumber(y, 60, 1940);
  const car = makeCar(x, y, Math.atan2(anchor.y - y, anchor.x - x), '#f8f9fa', 'sedan', 'police');
  car.driver = 'police';
  game.policeCars.push(car);
}

export function updatePolicePursuit(game, dt) {
  const wantedStars = Math.floor(game.wanted);
  // Keep the patrol strength matched to the wanted level.
  game.policeSpawnTimer -= dt;
  const desired = wantedStars <= 0 ? 0 : Math.min(5, wantedStars + 1);
  if (game.policeCars.length < desired && game.policeSpawnTimer <= 0) {
    spawnPatrolCar(game);
    game.policeSpawnTimer = 1.6;
  }
  if (game.policeCars.length > desired + 1) {
    game.policeCars.splice(0, game.policeCars.length - desired - 1);
  }

  const anchor = playerAnchor(game);
  const anchorVelX = game.player.car ? Math.cos(game.player.car.angle) * game.player.car.speed : 0;
  const anchorVelY = game.player.car ? Math.sin(game.player.car.angle) * game.player.car.speed : 0;
  let nearestCop = Infinity;
  let anyCopSeesPlayer = false;

  for (const cop of game.policeCars) {
    const dist = distanceBetween(cop.x, cop.y, anchor.x, anchor.y);
    nearestCop = Math.min(nearestCop, dist);
    if (dist < 430) anyCopSeesPlayer = true;
    // Predictive chase: aim where the player will be, offset per cop so
    // they surround rather than queue.
    const lead = clampNumber(dist / 320, 0, 0.85);
    const slot = (cop.id % 3 - 1) * 46;
    const aimX = anchor.x + anchorVelX * lead + Math.cos(cop.angle) * slot * 0.2 - Math.sin(cop.angle) * slot * 0.1;
    const aimY = anchor.y + anchorVelY * lead + Math.sin(cop.angle) * slot * 0.2 + Math.cos(cop.angle) * slot * 0.1;
    const wantedAngle = Math.atan2(aimY - cop.y, aimX - cop.x);
    const angleDiff = Math.abs(((wantedAngle - cop.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const steer = turnAngleTowards(0, ((wantedAngle - cop.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI, 1) ;
    const throttle = dist > 55 ? 1 : 0.15;
    // Reuse the shared driving physics with a steering shim.
    const previousAngle = cop.angle;
    driveCarPhysics(cop, throttle, clampNumber(steer * 1.4, -1, 1), dt, game.city, (strength) => {
      game.audio.playCrash(strength / 60);
    });
    if (angleDiff > 2.6 && dist < 90) cop.angle = previousAngle + steer * dt * 1.4;
    // Ram contact: shove and damage the player's car, spark particles.
    if (game.player.car && dist < 40) {
      const car = game.player.car;
      car.health = Math.max(0, car.health - dt * 9);
      car.x += Math.cos(cop.angle) * dt * 42;
      car.y += Math.sin(cop.angle) * dt * 42;
      if (game.rng() < dt * 6) game.spawnParticles(car.x, car.y, '#ffd166', 3);
    }
  }
  game.copSeesPlayer = anyCopSeesPlayer;

  // Heat cools while no patrol can see the player.
  if (game.wanted > 0) {
    if (!anyCopSeesPlayer) {
      game.unseenTimer += dt;
      if (game.unseenTimer > 7) {
        game.wanted = Math.max(0, game.wanted - dt * 0.14);
        if (game.wanted <= 0.02) {
          game.wanted = 0;
          game.policeCars.length = 0;
          game.showBanner('You lost the Harbor Patrol');
        }
      }
    } else {
      game.unseenTimer = 0;
    }
  }

  // Bust meter: fills when a patrol is on top of a slow or on-foot player.
  const playerSpeed = game.player.car ? Math.abs(game.player.car.speed) : 200;
  const caught = nearestCop < 62 && (!game.player.car || playerSpeed < 26);
  if (game.wanted > 0 && caught) {
    game.bust = clampNumber(game.bust + dt / 2.6, 0, 1);
    if (game.bust >= 1) game.onPlayerBusted();
  } else {
    game.bust = clampNumber(game.bust - dt / 3.2, 0, 1);
  }
}

export function clearPoliceHeat(game) {
  game.wanted = 0;
  game.bust = 0;
  game.unseenTimer = 0;
  game.policeCars.length = 0;
}
