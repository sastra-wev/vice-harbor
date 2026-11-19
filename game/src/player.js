// player.js — Rico Marlow on foot: movement, sprint, aim, health and the
// little figure the camera follows around Port Palmera.

import { clampNumber } from './engine.js';
import { blockedAt } from './city.js';

export function makePlayer(x, y) {
  return {
    x, y,
    angle: 0,
    radius: 13,
    health: 100,
    car: null,
    walkPhase: 0,
    moving: false,
    lastHurtAt: -99,
    name: 'RICO',
  };
}

export function playerAnchor(game) {
  // Where the camera and enemies look: the car when driving, else Rico.
  if (game.player.car) return game.player.car;
  return game.player;
}

export function updatePlayerOnFoot(game, dt) {
  const player = game.player;
  if (player.car) {
    player.x = player.car.x;
    player.y = player.car.y;
    return;
  }
  const input = game.input;
  let moveX = 0;
  let moveY = 0;
  if (input.isDown('KeyW', 'ArrowUp')) moveY -= 1;
  if (input.isDown('KeyS', 'ArrowDown')) moveY += 1;
  if (input.isDown('KeyA', 'ArrowLeft')) moveX -= 1;
  if (input.isDown('KeyD', 'ArrowRight')) moveX += 1;
  const length = Math.hypot(moveX, moveY);
  player.moving = length > 0;
  const sprinting = input.isDown('ShiftLeft', 'ShiftRight');
  const speed = sprinting ? 292 : 196;
  if (length > 0) {
    moveX /= length;
    moveY /= length;
    const nextX = player.x + moveX * speed * dt;
    const nextY = player.y + moveY * speed * dt;
    if (!blockedAt(game.city, nextX, player.y, player.radius)) player.x = nextX;
    if (!blockedAt(game.city, player.x, nextY, player.radius)) player.y = nextY;
    player.angle = Math.atan2(moveY, moveX);
    player.walkPhase += dt * (sprinting ? 13 : 9.5);
  }
  // Slow recovery when nobody has hurt Rico lately.
  if (game.time - player.lastHurtAt > 6 && player.health > 0) {
    player.health = clampNumber(player.health + dt * 2.4, 0, 100);
  }
}

export function hurtPlayer(game, damage) {
  const player = game.player;
  player.health = clampNumber(player.health - damage, 0, 100);
  player.lastHurtAt = game.time;
  game.spawnParticles(player.x, player.y, '#ff5964', 5);
  if (player.health <= 0 && game.mode === 'playing') game.onPlayerWasted();
}

export function drawPlayerFigure(ctx, player, aimAngle, time) {
  if (player.car) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 9, 4.5, 0, 0, 7);
  ctx.fill();
  const bob = player.moving ? Math.sin(player.walkPhase) * 1.8 : Math.sin(time * 2.2) * 0.5;
  // Legs.
  ctx.strokeStyle = '#22303a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(Math.sin(player.walkPhase) * 5, 10);
  ctx.moveTo(0, 2);
  ctx.lineTo(-Math.sin(player.walkPhase) * 5, 10);
  ctx.stroke();
  // Torso: Rico's teal sunset shirt.
  ctx.fillStyle = '#0fa3a3';
  ctx.beginPath();
  ctx.arc(0, bob * 0.3, 8.6, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ff9f1c';
  ctx.fillRect(-8.6, bob * 0.3 - 2, 17.2, 3.4);
  // Head + black peci-style cap.
  ctx.fillStyle = '#f2c297';
  ctx.beginPath();
  ctx.arc(Math.cos(player.angle) * 2, bob * 0.3 - 1.5, 5.2, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#191919';
  ctx.beginPath();
  ctx.arc(Math.cos(player.angle) * 2, bob * 0.3 - 3.4, 5.4, Math.PI, 0);
  ctx.fill();
  // Pistol arm toward the mouse aim.
  ctx.strokeStyle = '#f2c297';
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(aimAngle) * 11, Math.sin(aimAngle) * 11);
  ctx.stroke();
  ctx.fillStyle = '#22252b';
  ctx.fillRect(Math.cos(aimAngle) * 11 - 2, Math.sin(aimAngle) * 11 - 2, 5.5, 3.6);
  // Name tag so screenshots read clearly.
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(7,59,76,0.8)';
  ctx.fillText(player.name, 0, -15);
  ctx.restore();
}
