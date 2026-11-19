// shots.js — deterministic screenshot scenes for Vice Harbor (?shot=chase|drive|walk|start).
// Each scene is REAL game state built with the game's own systems — real traffic, real
// Harbor Patrol AI, the real HUD — staged at a fixed seed, never a fake picture.

import { spawnPoliceCar } from './police.js';
import { PLACES } from './city.js';

/** Put Rico into the nearest parked car and return that car (used by drive/chase). */
export function putPlayerInNearestCar(state) {
  let best = null, bestD = 1e9;
  for (const car of state.parkedCars) {
    const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return null;
  state.parkedCars = state.parkedCars.filter((c) => c !== best);
  best.kind = 'player'; best.wasStolenBefore = true;
  state.player.car = best;
  return best;
}

/** Stage the named scene on a freshly started game state. */
export function stageShotScene(state, name) {
  state.dismissDialogue();
  if (name === 'walk') {
    // On foot on the boardwalk by Marina Azul, palms and beach around, job 1 active.
    state.player.x = 900; state.player.y = 1652; state.player.angle = 0.4;
    state.camera.snapTo(state.player.x, state.player.y);
    return;
  }
  if (name === 'drive' || name === 'chase') {
    // Behind the wheel on the busy east–west avenue (ROAD_YS[1] = 660).
    state.player.x = 500; state.player.y = 660;
    const car = putPlayerInNearestCar(state);
    if (car) {
      car.x = 500; car.y = 684; car.angle = 0; car.speed = 165;
      state.player.x = car.x; state.player.y = car.y;
    }
    state.camera.snapTo(560, 668);
    if (name === 'chase') {
      // Job 2's finale: ledger delivered run — 3 stars, patrol already on his tail,
      // objective (Old Lighthouse Point) live on the HUD and the minimap.
      state.missionIndex = 1; state.stepIndex = 3;
      state.wanted = 3; state.heatTimer = 0;
      state.policeCars = [];
      for (let i = 0; i < 4; i += 1) spawnPoliceCar(state);
      // Pull two patrol cars in close behind so the chase reads at a glance.
      if (state.policeCars[0]) { state.policeCars[0].x = 380; state.policeCars[0].y = 640; state.policeCars[0].angle = 0; state.policeCars[0].speed = 190; }
      if (state.policeCars[1]) { state.policeCars[1].x = 330; state.policeCars[1].y = 706; state.policeCars[1].angle = 0.2; state.policeCars[1].speed = 175; }
      state.showToast('★ WANTED — Ledger run: reach the lighthouse!');
    }
    return;
  }
  // 'start' and anything else: the title screen over the marina (handled by main).
  state.camera.snapTo(PLACES.marina.x, 1420);
}
