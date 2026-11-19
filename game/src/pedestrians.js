// pedestrians.js — the people of Port Palmera: beachgoers and shoppers who stroll
// the sidewalks and the boardwalk, and dive out of the way of reckless drivers.

import { ROAD_XS, ROAD_YS, ROAD_WIDTH, WORLD_WIDTH, BEACH_Y, WATER_Y } from './city.js';

const PED_COLORS = ['#ff8fab', '#ffd166', '#06d6a0', '#118ab2', '#ef476f', '#f4f1de', '#e07a5f', '#81b29a'];
const SKIN_TONES = ['#f2c89b', '#c68863', '#8a5a3b', '#e8b48c', '#6e4426'];

/** Create one pedestrian walking a straight stroll line. */
export function createPedestrian(state, x, y, axis, dir) {
  return {
    x, y, axis, dir, speed: 26 + state.rng() * 26, phase: state.rng() * 6,
    shirt: PED_COLORS[Math.floor(state.rng() * PED_COLORS.length)],
    skin: SKIN_TONES[Math.floor(state.rng() * SKIN_TONES.length)],
    fleeTimer: 0, down: false, downTimer: 0,
  };
}

/** Fill the sidewalks, plaza edges and the beach boardwalk with walkers. */
export function spawnPedestrians(state, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const pick = state.rng();
    if (pick < 0.3) { // boardwalk / beach strollers
      peds.push(createPedestrian(state, 60 + state.rng() * (WORLD_WIDTH - 120), BEACH_Y + 30 + state.rng() * (WATER_Y - BEACH_Y - 60), 'h', state.rng() < 0.5 ? 1 : -1));
    } else if (pick < 0.65) { // vertical-road sidewalks
      const roadX = ROAD_XS[Math.floor(state.rng() * ROAD_XS.length)];
      const side = state.rng() < 0.5 ? -1 : 1;
      peds.push(createPedestrian(state, roadX + side * (ROAD_WIDTH / 2 + 9), 60 + state.rng() * (BEACH_Y - 100), 'v', state.rng() < 0.5 ? 1 : -1));
    } else { // horizontal-road sidewalks
      const roadY = ROAD_YS[Math.floor(state.rng() * ROAD_YS.length)];
      const side = state.rng() < 0.5 ? -1 : 1;
      peds.push(createPedestrian(state, 60 + state.rng() * (WORLD_WIDTH - 120), roadY + side * (ROAD_WIDTH / 2 + 9), 'h', state.rng() < 0.5 ? 1 : -1));
    }
  }
  return peds;
}

/** Walk, flee from fast nearby cars, and get knocked down (a crime!) by reckless ones. */
export function updatePedestrians(state, dt) {
  const threats = [];
  if (state.player.car && Math.abs(state.player.car.speed) > 40) threats.push(state.player.car);
  for (const cop of state.policeCars) if (Math.abs(cop.speed) > 120) threats.push(cop);
  for (const ped of state.peds) {
    if (ped.down) { ped.downTimer -= dt; if (ped.downTimer <= 0) ped.down = false; continue; }
    let fleeX = 0, fleeY = 0;
    for (const car of threats) {
      const d = Math.hypot(car.x - ped.x, car.y - ped.y);
      if (d < 26) {
        ped.down = true; ped.downTimer = 5;
        if (car === state.player.car) { state.commitCrime(1, 'Pedestrian hit'); state.audio.playThudSound(); }
        break;
      }
      if (d < 74) { fleeX += (ped.x - car.x) / d; fleeY += (ped.y - car.y) / d; ped.fleeTimer = 0.7; }
    }
    if (ped.down) continue;
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      ped.x += fleeX * 130 * dt; ped.y += fleeY * 130 * dt;
    } else if (ped.axis === 'h') {
      ped.x += ped.dir * ped.speed * dt;
      if (ped.x < 36 || ped.x > WORLD_WIDTH - 36) ped.dir *= -1;
    } else {
      ped.y += ped.dir * ped.speed * dt;
      if (ped.y < 36 || ped.y > WATER_Y - 30) ped.dir *= -1;
    }
    ped.x = Math.max(20, Math.min(WORLD_WIDTH - 20, ped.x));
    ped.y = Math.max(20, Math.min(WATER_Y - 16, ped.y));
  }
}

/** Draw one pedestrian: shadow, legs mid-stride, shirt, head; flat on the ground when down. */
export function drawPedestrian(ctx, ped, time) {
  ctx.save(); ctx.translate(ped.x, ped.y);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(1, 3, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  if (ped.down) {
    ctx.rotate(Math.PI / 2.4);
    ctx.fillStyle = ped.shirt; ctx.fillRect(-10, -4, 20, 8);
    ctx.fillStyle = ped.skin; ctx.beginPath(); ctx.arc(13, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore(); return;
  }
  const stride = Math.sin(time * 9 + ped.phase) * 3;
  ctx.strokeStyle = '#2b3a4a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(stride, 7); ctx.moveTo(0, 0); ctx.lineTo(-stride, 7); ctx.stroke();
  ctx.fillStyle = ped.shirt; ctx.beginPath(); ctx.arc(0, -1, 6.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.skin; ctx.beginPath(); ctx.arc(0, -2, 4.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#263238'; ctx.beginPath(); ctx.arc(0, -4.4, 4.4, Math.PI, 0); ctx.fill();
  ctx.restore();
}

/** Draw every pedestrian. */
export function drawPedestrians(ctx, state, time) {
  for (const ped of state.peds) drawPedestrian(ctx, ped, time);
}
