// combat.js — pistol fire with mouse aim, F-key melee, Palm Row crew
// gunmen who strafe and shoot back, bullets, tracers and hit sparks.

import { clampNumber, distanceBetween } from './engine.js';
import { pointHitsBuilding } from './city.js';
import { hurtPlayer } from './player.js';

export function makeCrewGunman(x, y, name) {
  return {
    x, y,
    angle: 0,
    health: 60,
    maxHealth: 60,
    name: name || 'Palm Row crew',
    shootCooldown: 1 + Math.random() * 1.4,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: 1.5 + Math.random() * 2,
    alive: true,
    walkPhase: Math.random() * 6,
  };
}

export function playerTryShoot(game, aimX, aimY) {
  const player = game.player;
  if (player.car || game.shootCooldown > 0) return;
  game.shootCooldown = 0.16;
  const angle = Math.atan2(aimY - player.y, aimX - player.x);
  game.bullets.push({
    x: player.x + Math.cos(angle) * 16,
    y: player.y + Math.sin(angle) * 16,
    vx: Math.cos(angle) * 880,
    vy: Math.sin(angle) * 880,
    life: 0.55,
    from: 'player',
  });
  game.alarmTimer = 2.2;
  game.audio.playGunshot();
  game.spawnParticles(player.x + Math.cos(angle) * 18, player.y + Math.sin(angle) * 18, '#ffd166', 2);
}

export function playerMeleeAttack(game) {
  if (game.player.car || game.meleeCooldown > 0) return;
  game.meleeCooldown = 0.38;
  let hitSomething = false;
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    if (distanceBetween(game.player.x, game.player.y, enemy.x, enemy.y) < 58) {
      damageEnemy(game, enemy, 34);
      enemy.x += Math.cos(Math.atan2(enemy.y - game.player.y, enemy.x - game.player.x)) * 16;
      hitSomething = true;
    }
  }
  if (hitSomething) game.audio.playCrash(1);
}

export function damageEnemy(game, enemy, damage) {
  enemy.health -= damage;
  game.spawnParticles(enemy.x, enemy.y, '#ef476f', 5);
  if (enemy.health <= 0 && enemy.alive) {
    enemy.alive = false;
    game.money += 25;
    game.crewDefeated++;
    game.showBanner(`${enemy.name} down — +$25`);
    game.audio.playPickup();
  }
}

function enemyTakeShot(game, enemy) {
  const player = game.player;
  const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x) + (game.rng() - 0.5) * 0.14;
  game.bullets.push({
    x: enemy.x + Math.cos(angle) * 14,
    y: enemy.y + Math.sin(angle) * 14,
    vx: Math.cos(angle) * 640,
    vy: Math.sin(angle) * 640,
    life: 0.7,
    from: 'enemy',
  });
  game.audio.playGunshot();
}

export function updateCombatWorld(game, dt) {
  if (game.shootCooldown > 0) game.shootCooldown -= dt;
  if (game.meleeCooldown > 0) game.meleeCooldown -= dt;
  if (game.alarmTimer > 0) game.alarmTimer -= dt;

  // Enemies: close to mid-range, strafe sideways, shoot on a cadence.
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    const player = game.player;
    const dist = distanceBetween(enemy.x, enemy.y, player.x, player.y);
    enemy.walkPhase += dt * 8;
    enemy.strafeTimer -= dt;
    if (enemy.strafeTimer <= 0) {
      enemy.strafeTimer = 1.2 + game.rng() * 2;
      enemy.strafeDir *= -1;
    }
    let moveX = 0;
    let moveY = 0;
    const toPlayer = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.angle = toPlayer;
    if (dist > 190) {
      moveX = Math.cos(toPlayer);
      moveY = Math.sin(toPlayer);
    } else if (dist < 110) {
      moveX = -Math.cos(toPlayer);
      moveY = -Math.sin(toPlayer);
    }
    moveX += Math.cos(toPlayer + Math.PI / 2) * enemy.strafeDir * 0.7;
    moveY += Math.sin(toPlayer + Math.PI / 2) * enemy.strafeDir * 0.7;
    const len = Math.hypot(moveX, moveY) || 1;
    const nx = enemy.x + (moveX / len) * 92 * dt;
    const ny = enemy.y + (moveY / len) * 92 * dt;
    if (!pointHitsBuilding(game.city, nx, ny, 12)) {
      enemy.x = nx;
      enemy.y = ny;
    }
    enemy.shootCooldown -= dt;
    if (enemy.shootCooldown <= 0 && dist < 350 && game.mode === 'playing') {
      enemy.shootCooldown = 1.1 + game.rng() * 1.1;
      enemyTakeShot(game, enemy);
    }
  }

  // Bullets.
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const bullet = game.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    let remove = bullet.life <= 0 || pointHitsBuilding(game.city, bullet.x, bullet.y, 2) !== null;
    if (!remove && bullet.from === 'player') {
      for (const enemy of game.enemies) {
        if (enemy.alive && distanceBetween(bullet.x, bullet.y, enemy.x, enemy.y) < 14) {
          damageEnemy(game, enemy, 22);
          remove = true;
          break;
        }
      }
      if (!remove) {
        for (const cop of game.policeCars) {
          if (distanceBetween(bullet.x, bullet.y, cop.x, cop.y) < 22) {
            game.reportCrime(1, 'Shots at patrol');
            game.spawnParticles(cop.x, cop.y, '#ffd166', 4);
            remove = true;
            break;
          }
        }
      }
    }
    if (!remove && bullet.from === 'enemy') {
      const target = game.player.car || game.player;
      const radius = game.player.car ? 24 : 13;
      if (distanceBetween(bullet.x, bullet.y, target.x, target.y) < radius) {
        if (game.player.car) game.player.car.health = Math.max(0, game.player.car.health - 4);
        else hurtPlayer(game, 7);
        remove = true;
      }
    }
    if (remove) game.bullets.splice(i, 1);
  }
}

export function drawCrewGunman(ctx, enemy) {
  if (!enemy.alive) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(1.45);
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(-12, -4, 24, 8);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 9, 4, 0, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ef476f';
  ctx.beginPath();
  ctx.arc(0, 0, 8.6, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#f2c297';
  ctx.beginPath();
  ctx.arc(Math.cos(enemy.angle) * 2, -1, 5, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#f2c297';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(enemy.angle) * 12, Math.sin(enemy.angle) * 12);
  ctx.stroke();
  // Health bar.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(-13, -19, 26, 4.5);
  ctx.fillStyle = '#ef476f';
  ctx.fillRect(-13, -19, 26 * clampNumber(enemy.health / enemy.maxHealth, 0, 1), 4.5);
  ctx.restore();
}

export function drawBullets(ctx, bullets) {
  ctx.strokeStyle = '#ffe74c';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (const bullet of bullets) {
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
  }
  ctx.stroke();
}
