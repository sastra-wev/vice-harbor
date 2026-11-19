// combat.js — Palm Row crew fights: mouse-aimed shooting, melee, enemy gunners
// who strafe and return fire, bullets, muzzle flashes and hit effects.

import { angleTowards, distanceBetween, spawnParticles } from './engine.js';
import { damagePlayer, playerPosition } from './player.js';

export const ENEMY_MAX_HP = 60;

/** Create a Palm Row rival: a named original gang member with a gun. */
export function createEnemy(x, y, name, tough) {
  return {
    x, y, name, hp: tough ? 110 : ENEMY_MAX_HP, maxHp: tough ? 110 : ENEMY_MAX_HP,
    angle: 0, shootCooldown: 1 + Math.random() * 0.5, strafeDir: 1, strafeTimer: 2,
    hurtFlash: 0, dead: false, tough: !!tough, meleeCooldown: 0,
  };
}

/** Spawn a group of rivals around a point (used by the Palm Row missions). */
export function spawnEnemyGroup(state, x, y, names, toughLast) {
  const group = names.map((name, i) => {
    const a = (i / names.length) * Math.PI * 2;
    return createEnemy(x + Math.cos(a) * 54, y + Math.sin(a) * 54, name, toughLast && i === names.length - 1);
  });
  state.enemies.push(...group);
  return group;
}

/** Fire Rico's pistol toward a world point; raises heat the first time. */
export function playerShootAt(state, worldX, worldY) {
  const player = state.player;
  if (player.car || player.dead) return;
  if (state.shootCooldown > 0) return;
  state.shootCooldown = 0.22;
  state.combatTimer = 4;
  const angle = angleTowards(player.x, player.y, worldX, worldY);
  state.bullets.push({ x: player.x + Math.cos(angle) * 18, y: player.y + Math.sin(angle) * 18, vx: Math.cos(angle) * 780, vy: Math.sin(angle) * 780, fromPlayer: true, life: 0.55 });
  state.muzzleFlash = { x: player.x + Math.cos(angle) * 24, y: player.y + Math.sin(angle) * 24, life: 0.05 };
  spawnParticles(state, player.x + Math.cos(angle) * 24, player.y + Math.sin(angle) * 24, '#ffd23f', 2, 60, 0.15, 2.4);
  state.audio.playGunshotSound(false);
  if (!state.shotsFiredBefore) { state.shotsFiredBefore = true; state.commitCrime(1, 'Shots fired'); }
  else if (state.rng() < 0.3) state.commitCrime(0, 'Shots fired');
}

/** Rico's melee swing (F): short range, quiet, knocks rivals back. */
export function playerMeleeAttack(state) {
  if (state.player.car || state.meleeCooldown > 0) return;
  state.meleeCooldown = 0.38;
  state.combatTimer = 4;
  const player = state.player;
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    if (distanceBetween(player.x, player.y, enemy.x, enemy.y) < 44) {
      hurtEnemy(state, enemy, 22);
      enemy.x += Math.cos(player.angle) * 16; enemy.y += Math.sin(player.angle) * 16;
    }
  }
  state.audio.playSwingSound();
}

/** Damage a rival; on death he drops cash and may feed a mission objective. */
export function hurtEnemy(state, enemy, amount) {
  enemy.hp -= amount; enemy.hurtFlash = 0.18;
  spawnParticles(state, enemy.x, enemy.y, '#ff5d73', 4, 90, 0.35, 3);
  if (enemy.hp <= 0 && !enemy.dead) {
    enemy.dead = true;
    state.player.money += 15;
    state.showToast(enemy.name + ' down  +$15');
    state.audio.playPickupSound();
    state.commitCrime(1, 'Rival down');
  }
}

/** Advance one rival: keep a fighting distance, strafe, shoot back, brawl up close. */
export function updateEnemy(state, enemy, dt) {
  if (enemy.dead) return;
  enemy.hurtFlash = Math.max(0, enemy.hurtFlash - dt);
  enemy.meleeCooldown = Math.max(0, enemy.meleeCooldown - dt);
  const p = playerPosition(state);
  const dist = distanceBetween(enemy.x, enemy.y, p.x, p.y);
  enemy.angle = angleTowards(enemy.x, enemy.y, p.x, p.y);
  if (dist > 640) return; // dormant until Rico comes close
  state.combatTimer = Math.max(state.combatTimer, 1.2);
  enemy.strafeTimer -= dt;
  if (enemy.strafeTimer <= 0) { enemy.strafeTimer = 1.4 + state.rng() * 1.6; enemy.strafeDir *= -1; }
  let mx = 0, my = 0;
  if (dist > 190) { mx = Math.cos(enemy.angle); my = Math.sin(enemy.angle); }
  else if (dist < 120) { mx = -Math.cos(enemy.angle); my = -Math.sin(enemy.angle); }
  const strafeA = enemy.angle + Math.PI / 2;
  mx += Math.cos(strafeA) * enemy.strafeDir * 0.7; my += Math.sin(strafeA) * enemy.strafeDir * 0.7;
  const ml = Math.hypot(mx, my) || 1;
  const speed = enemy.tough ? 96 : 82;
  enemy.x += (mx / ml) * speed * dt; enemy.y += (my / ml) * speed * dt;
  for (const b of state.city.buildings) {
    if (enemy.x > b.x - 10 && enemy.x < b.x + b.w + 10 && enemy.y > b.y - 10 && enemy.y < b.y + b.h + 10) {
      enemy.x -= (mx / ml) * speed * dt * 1.4; enemy.y -= (my / ml) * speed * dt * 1.4;
    }
  }
  if (dist < 42 && enemy.meleeCooldown <= 0 && !state.player.car) {
    enemy.meleeCooldown = 0.9;
    damagePlayer(state, enemy.tough ? 11 : 7);
    state.audio.playThudSound();
  }
  enemy.shootCooldown -= dt;
  if (enemy.shootCooldown <= 0 && dist < 330 && dist > 40) {
    enemy.shootCooldown = (enemy.tough ? 0.85 : 1.25) + state.rng() * 0.5;
    const spread = (state.rng() - 0.5) * 0.16;
    const a = enemy.angle + spread;
    state.bullets.push({ x: enemy.x + Math.cos(a) * 16, y: enemy.y + Math.sin(a) * 16, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, fromPlayer: false, life: 0.6 });
    state.audio.playGunshotSound(true);
  }
}

/** Move every bullet, test hits on rivals, on Rico, and on buildings. */
export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let kill = b.life <= 0;
    for (const bd of state.city.buildings) {
      if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) { kill = true; spawnParticles(state, b.x, b.y, '#ffe9a8', 2, 50, 0.2, 2); break; }
    }
    if (!kill && b.fromPlayer) {
      for (const enemy of state.enemies) {
        if (!enemy.dead && distanceBetween(b.x, b.y, enemy.x, enemy.y) < 13) { hurtEnemy(state, enemy, 26); kill = true; break; }
      }
    }
    if (!kill && !b.fromPlayer) {
      const p = playerPosition(state);
      if (distanceBetween(b.x, b.y, p.x, p.y) < (state.player.car ? 24 : 12)) { damagePlayer(state, 6); kill = true; }
    }
    if (kill) state.bullets.splice(i, 1);
  }
  if (state.muzzleFlash) { state.muzzleFlash.life -= dt; if (state.muzzleFlash.life <= 0) state.muzzleFlash = null; }
}

/** Advance all combat: cooldowns, rivals, bullets. */
export function updateCombat(state, dt) {
  state.shootCooldown = Math.max(0, state.shootCooldown - dt);
  state.meleeCooldown = Math.max(0, state.meleeCooldown - dt);
  state.combatTimer = Math.max(0, state.combatTimer - dt);
  for (const enemy of state.enemies) updateEnemy(state, enemy, dt);
  updateBullets(state, dt);
}

/** Draw rivals with name tags and health bars; the dead lie still. */
export function drawEnemies(ctx, state) {
  for (const enemy of state.enemies) {
    ctx.save(); ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(1, 3, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (enemy.dead) { ctx.rotate(1.2); ctx.fillStyle = '#5b2333'; ctx.fillRect(-10, -4, 20, 8); ctx.restore(); continue; }
    ctx.fillStyle = enemy.hurtFlash > 0 ? '#ffffff' : (enemy.tough ? '#7c1d3f' : '#a4133c');
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c68863'; ctx.beginPath(); ctx.arc(0, -1, 5.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, -4, 5.4, Math.PI, 0); ctx.fill();
    ctx.save(); ctx.rotate(enemy.angle); ctx.fillStyle = '#22242c'; ctx.fillRect(10, -1.6, 9, 3.2); ctx.restore();
    ctx.restore();
    if (!enemy.dead) {
      ctx.fillStyle = 'rgba(3,34,50,.7)'; ctx.fillRect(enemy.x - 24, enemy.y - 32, 48, 11);
      ctx.fillStyle = '#ff8fab'; ctx.font = 'bold 8px Verdana'; ctx.textAlign = 'center';
      ctx.fillText(enemy.name.toUpperCase(), enemy.x, enemy.y - 23.5);
      ctx.fillStyle = '#40101c'; ctx.fillRect(enemy.x - 16, enemy.y + 14, 32, 4.4);
      ctx.fillStyle = '#ff5d73'; ctx.fillRect(enemy.x - 16, enemy.y + 14, 32 * Math.max(0, enemy.hp / enemy.maxHp), 4.4);
    }
  }
}

/** Draw bullets as tracers and the muzzle flash star. */
export function drawBulletsAndFlash(ctx, state) {
  ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (const b of state.bullets) {
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  if (state.muzzleFlash) {
    ctx.fillStyle = '#ffd23f';
    ctx.save(); ctx.translate(state.muzzleFlash.x, state.muzzleFlash.y);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.lineTo(Math.cos(a + 0.5) * 4, Math.sin(a + 0.5) * 4); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
