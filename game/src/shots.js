// shots.js — deterministic screenshot scenes. Each ?shot= mode stages
// REAL game state (live patrol AI, live traffic, a real mission stage)
// and lets the normal loop run; nothing here draws a fake picture.

import { placeByName } from './city.js';
import { makeCar } from './vehicles.js';

export function readShotRequest() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot') || '',
    seed: Number(params.get('seed') || 1) || 1,
  };
}

function putPlayerInCar(game, x, y, angle, color) {
  const car = makeCar(x, y, angle, color || '#ff5964', 'coupe', 'parked');
  car.driver = 'player';
  car.stolenOnce = true;
  game.parkedCars.push(car);
  game.player.car = car;
  game.player.x = x;
  game.player.y = y;
  return car;
}

export function stageShotScene(game, shot) {
  if (!shot) return;
  game.shotMode = shot;
  if (shot === 'start') {
    game.mode = 'start';
    const plaza = placeByName(game.city, 'Plaza Central');
    game.camera.snapTo(plaza.x + 120, plaza.y + 160);
    return;
  }
  game.mode = 'playing';
  game.missions.startJob(0);

  if (shot === 'walk') {
    // Rico on the open sand, boardwalk and marina water beside him,
    // Café Sol objective live.
    game.player.x = 2246;
    game.player.y = 986;
    game.player.angle = -0.5;
    game.missions.stageIndex = 1; // heading to Café Sol
    game.camera.snapTo(game.player.x, game.player.y);
    return;
  }

  if (shot === 'drive') {
    // Eastbound on the Plaza Central avenue in thick two-way traffic,
    // staged just past an intersection for a clean run at the next one.
    const car = putPlayerInCar(game, 1075, 660 + 29, 0, '#35a7ff');
    car.speed = 215;
    game.shotAutoDrive = true;
    game.camera.snapTo(car.x, car.y);
    return;
  }

  if (shot === 'chase') {
    // Three-star pursuit: patrol spawned by the real police system, the
    // gold-coupe finale staged as the active objective.
    const car = putPlayerInCar(game, 700, 1060 + 29, 0, '#ffd700');
    car.speed = 240;
    game.shotAutoDrive = true;
    // Drop the first job's queued dialogue so the finale's own lines play.
    game.dialogueQueue.length = 0;
    game.dialogue = null;
    game.missions.startJob(4);
    game.missions.stageIndex = 2; // Reach the Old Lighthouse Point
    game.wanted = 3;
    game.bust = 0.85;
    // Pre-place patrol cars in pursuit formation behind Rico; the live
    // pursuit AI takes over from the first frame.
    const offsets = [[-95, -34], [-150, 30], [-215, -6]];
    for (const [ox, oy] of offsets) {
      const cop = makeCar(car.x + ox, car.y + oy, 0, '#f8f9fa', 'sedan', 'police');
      cop.driver = 'police';
      cop.speed = 225;
      game.policeCars.push(cop);
    }
    game.camera.snapTo(car.x + 40, car.y);
  }
}
