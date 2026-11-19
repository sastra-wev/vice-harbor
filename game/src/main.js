// main.js — Vice Harbor bootstrap: builds Port Palmera, wires every system
// (city, traffic, pedestrians, vehicles, police, combat, missions, HUD,
// audio, save) into one game state and runs the frame loop.

import { InputState, SmoothCamera, runAnimationLoop, makeSeededRandom, clampNumber } from './engine.js';
import { buildCityLayout, drawCityWorld, placeByName, WORLD_WIDTH, WORLD_HEIGHT } from './city.js';
import { HarborAudio } from './audio.js';
import { loadSaveGame, storeSaveGame, wipeSaveGame, snapshotProgress } from './save.js';
import { spawnParkedCars, drawVehicleBody, driveCarPhysics, coastCar, nearestStealableCar, enterCar, exitCar } from './vehicles.js';
import { spawnTrafficCars, updateTrafficCars } from './traffic.js';
import { spawnPedestrians, updatePedestrians, drawPedestrianFigure } from './pedestrians.js';
import { makePlayer, updatePlayerOnFoot, drawPlayerFigure } from './player.js';
import { reportCrimeToPolice, updatePolicePursuit, clearPoliceHeat } from './police.js';
import { playerTryShoot, playerMeleeAttack, updateCombatWorld, drawCrewGunman, drawBullets } from './combat.js';
import { MissionRunner } from './missions.js';
import { drawGameHud, drawStartScreen, drawPauseMenu, drawObjectiveMarker } from './hud.js';
import { readShotRequest, stageShotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const shotRequest = readShotRequest();
const seed = shotRequest.seed;

const game = {
  time: 0,
  mode: 'start', // start | playing | paused
  viewWidth: canvas.width,
  viewHeight: canvas.height,
  city: buildCityLayout(seed + 6),
  camera: new SmoothCamera(WORLD_WIDTH, WORLD_HEIGHT),
  input: new InputState(canvas),
  audio: new HarborAudio(),
  rng: makeSeededRandom(seed + 91),
  player: null,
  parkedCars: [],
  trafficCars: [],
  policeCars: [],
  pedestrians: [],
  enemies: [],
  bullets: [],
  particles: [],
  goldCoupe: null,
  money: 40,
  wanted: 0,
  bust: 0,
  unseenTimer: 0,
  lastCrimeAt: -99,
  lastCrimeReason: '',
  policeSpawnTimer: 0,
  copSeesPlayer: false,
  alarmTimer: 0,
  shootCooldown: 0,
  meleeCooldown: 0,
  crewDefeated: 0,
  dialogue: null,
  dialogueQueue: [],
  dialogueTimer: 0,
  banner: '',
  bannerTimer: 0,
  message: '',
  messageTimer: 0,
  uiButtons: [],
  hasSave: !!loadSaveGame(),
  shotMode: '',
  missions: null,
};

game.player = makePlayer(1490, 770);
game.parkedCars = spawnParkedCars(game.city, seed + 20);
game.trafficCars = spawnTrafficCars(seed + 33, 17);
game.pedestrians = spawnPedestrians(seed + 55, 30);
game.missions = new MissionRunner(game);

game.reportCrime = (amount, reason) => reportCrimeToPolice(game, amount, reason);
game.showBanner = (text) => {
  game.banner = text;
  game.bannerTimer = 2.6;
  statusLine.textContent = text;
};
game.queueDialogue = (lines) => {
  for (const [speaker, text] of lines) game.dialogueQueue.push({ speaker, text });
  if (!game.dialogue) advanceDialogue();
};
game.spawnParticles = (x, y, color, count) => {
  for (let i = 0; i < count; i++) {
    const a = game.rng() * Math.PI * 2;
    const sp = 30 + game.rng() * 110;
    game.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45 + game.rng() * 0.3, color, size: 2 + game.rng() * 3 });
  }
};
game.onJobCompleted = () => {
  storeSaveGame(snapshotProgress(game));
  game.hasSave = true;
};
game.onPlayerBusted = () => {
  game.audio.playBustedSting();
  const fine = Math.min(game.money, 120);
  game.money -= fine;
  clearPoliceHeat(game);
  respawnAtPlaza('BUSTED by the Harbor Patrol');
  game.showBanner(`BUSTED — fined $${fine}`);
};
game.onPlayerWasted = () => {
  const fee = Math.min(game.money, 90);
  game.money -= fee;
  clearPoliceHeat(game);
  game.enemies.length = 0;
  respawnAtPlaza('WASTED — patched up at Plaza Central clinic');
  game.player.health = 100;
  game.showBanner(`WASTED — clinic fee $${fee}`);
};

function respawnAtPlaza(why) {
  if (game.player.car) {
    game.player.car.driver = null;
    game.player.car = null;
  }
  const plaza = placeByName(game.city, 'Plaza Central');
  game.player.x = plaza.x + 60;
  game.player.y = plaza.y + 95;
  game.camera.snapTo(game.player.x, game.player.y);
  game.message = why;
  game.messageTimer = 3;
}

function advanceDialogue() {
  const next = game.dialogueQueue.shift();
  game.dialogue = next || null;
  game.dialogueTimer = next ? 3.8 : 0;
}

function startNewRun() {
  wipeSaveGame();
  game.hasSave = false;
  game.money = 40;
  game.player.health = 100;
  clearPoliceHeat(game);
  respawnAtPlaza('');
  game.mode = 'playing';
  game.audio.unlockAudio();
  game.missions.startJob(0);
}

function continueSavedRun() {
  const data = loadSaveGame();
  game.audio.unlockAudio();
  game.mode = 'playing';
  if (!data) {
    game.missions.startJob(0);
    return;
  }
  game.money = data.money || 0;
  game.player.x = data.playerX || game.player.x;
  game.player.y = data.playerY || game.player.y;
  game.camera.snapTo(game.player.x, game.player.y);
  game.missions.jobsCompleted = data.jobsDone || 0;
  game.missions.startJob(Math.min(data.jobIndex || 0, 5));
  game.showBanner('Welcome back to Port Palmera');
}

function handleUiClick(mouseX, mouseY) {
  for (const button of game.uiButtons) {
    if (mouseX >= button.x && mouseX <= button.x + button.w && mouseY >= button.y && mouseY <= button.y + button.h) {
      if (button.action === 'start') startNewRun();
      else if (button.action === 'continue') continueSavedRun();
      else if (button.action === 'resume') game.mode = 'playing';
      else if (button.action === 'save') {
        storeSaveGame(snapshotProgress(game));
        game.hasSave = true;
        game.showBanner('Progress saved');
      } else if (button.action === 'restart') startNewRun();
      return true;
    }
  }
  return false;
}

function updateDriving(dt) {
  const car = game.player.car;
  const input = game.input;
  let throttle = 0;
  let steer = 0;
  if (input.isDown('KeyW', 'ArrowUp')) throttle = 1;
  if (input.isDown('KeyS', 'ArrowDown')) throttle = -1;
  if (input.isDown('KeyA', 'ArrowLeft')) steer = -1;
  if (input.isDown('KeyD', 'ArrowRight')) steer = 1;
  if (game.shotAutoDrive) {
    // Screenshot scenes drive themselves down their staged avenue.
    throttle = 1;
    steer = 0;
  }
  driveCarPhysics(car, throttle, steer, dt, game.city, (strength) => {
    game.audio.playCrash(strength / 55);
    game.spawnParticles(car.x, car.y, '#ffd166', 6);
    if (strength > 190) game.reportCrime(0.5, 'Reckless driving');
  });
  // Collisions with other cars: bounce apart, dent both, draw attention.
  const others = [...game.parkedCars, ...game.trafficCars, ...game.policeCars];
  if (game.goldCoupe) others.push(game.goldCoupe);
  for (const other of others) {
    if (other === car) continue;
    const d = Math.hypot(other.x - car.x, other.y - car.y);
    if (d < 42 && d > 0.01) {
      const push = (42 - d) / 2;
      const nx = (other.x - car.x) / d;
      const ny = (other.y - car.y) / d;
      other.x += nx * push;
      other.y += ny * push;
      car.x -= nx * push;
      car.y -= ny * push;
      if (Math.abs(car.speed) > 90) {
        other.health = Math.max(0, other.health - 7);
        game.audio.playCrash(Math.abs(car.speed) / 40);
        game.spawnParticles(other.x, other.y, '#ffb36b', 5);
        game.reportCrime(0.5, 'Hit and run');
        if (other.driver === 'traffic') other.panicTimer = 3;
      }
      car.speed *= 0.55;
    }
  }
}

function updatePlaying(dt) {
  const input = game.input;
  // Enter / exit / steal.
  if (input.wasPressed('KeyE')) {
    if (game.player.car) exitCar(game);
    else {
      const car = nearestStealableCar(game, game.player.x, game.player.y, 58);
      if (car) {
        if (car.driver === 'traffic') {
          car.driver = 'abandoned';
          game.trafficCars.splice(game.trafficCars.indexOf(car), 1);
          game.parkedCars.push(car);
          game.pedestrians.forEach((ped) => { if (Math.hypot(ped.x - car.x, ped.y - car.y) < 60) ped.state = 'flee'; });
        }
        enterCar(game, car);
      }
    }
  }
  if (game.player.car) updateDriving(dt);
  else {
    updatePlayerOnFoot(game, dt);
    // Shooting + melee on foot.
    const aim = game.camera.screenToWorld(input.mouseX, input.mouseY, game.viewWidth, game.viewHeight);
    if (input.mouseDown) playerTryShoot(game, aim.x, aim.y);
    if (input.wasPressed('KeyF')) playerMeleeAttack(game);
  }
  // Driverless parked cars roll out; the gold coupe waits where it sits.
  for (const car of game.parkedCars) {
    if (car.driver !== 'player' && Math.abs(car.speed) > 1) coastCar(car, dt, game.city);
  }
  if (game.goldCoupe && game.goldCoupe.driver !== 'player' && Math.abs(game.goldCoupe.speed) > 1) coastCar(game.goldCoupe, dt, game.city);

  updateTrafficCars(game, dt);
  updatePolicePursuit(game, dt);
  updatePedestrians(game, dt);
  updateCombatWorld(game, dt);
  game.missions.updateMissions(dt);
  game.audio.updateAudio(dt, game);
}

function updateTimers(dt) {
  if (game.bannerTimer > 0) game.bannerTimer -= dt;
  if (game.messageTimer > 0) game.messageTimer -= dt;
  if (game.dialogue) {
    game.dialogueTimer -= dt;
    if (game.dialogueTimer <= 0) advanceDialogue();
  }
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
}

function renderWorld() {
  const view = { x: game.camera.x, y: game.camera.y, w: game.viewWidth / game.camera.zoom, h: game.viewHeight / game.camera.zoom };
  ctx.save();
  ctx.translate(game.viewWidth / 2, game.viewHeight / 2);
  ctx.scale(game.camera.zoom, game.camera.zoom);
  ctx.translate(-game.camera.x, -game.camera.y);
  drawCityWorld(ctx, game.city, view, game.time);
  drawObjectiveMarker(ctx, game);
  for (const car of game.parkedCars) drawVehicleBody(ctx, car, game.time);
  if (game.goldCoupe && game.goldCoupe.driver !== 'player') drawVehicleBody(ctx, game.goldCoupe, game.time);
  for (const car of game.trafficCars) drawVehicleBody(ctx, car, game.time);
  for (const cop of game.policeCars) drawVehicleBody(ctx, cop, game.time);
  for (const ped of game.pedestrians) drawPedestrianFigure(ctx, ped, game.time);
  for (const enemy of game.enemies) drawCrewGunman(ctx, enemy);
  if (game.player.car) drawVehicleBody(ctx, game.player.car, game.time);
  const aim = game.camera.screenToWorld(game.input.mouseX, game.input.mouseY, game.viewWidth, game.viewHeight);
  drawPlayerFigure(ctx, game.player, Math.atan2(aim.y - game.player.y, aim.x - game.player.x), game.time);
  drawBullets(ctx, game.bullets);
  for (const p of game.particles) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

function frameStep(dt) {
  game.time += dt;
  game.viewWidth = canvas.width;
  game.viewHeight = canvas.height;
  const input = game.input;

  if (input.mouseClicked) {
    game.audio.unlockAudio();
    if (game.mode === 'start' || game.mode === 'paused') handleUiClick(input.mouseX, input.mouseY);
  }
  if (input.wasPressed('KeyM')) game.audio.setMuted(!game.audio.muted);
  if (input.wasPressed('KeyP', 'Escape')) {
    if (game.mode === 'playing') game.mode = 'paused';
    else if (game.mode === 'paused') game.mode = 'playing';
  }

  if (game.mode === 'playing') updatePlaying(dt);
  updateTimers(dt);

  const anchor = game.player.car || game.player;
  game.camera.followTarget(dt, anchor.x, anchor.y, !!game.player.car, game.viewWidth, game.viewHeight);

  ctx.clearRect(0, 0, game.viewWidth, game.viewHeight);
  renderWorld();
  if (game.mode === 'start') drawStartScreen(ctx, game);
  else {
    drawGameHud(ctx, game);
    if (game.mode === 'paused') drawPauseMenu(ctx, game);
  }
  if (game.messageTimer > 0 && game.message) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(7,40,54,0.85)';
    const tw = ctx.measureText(game.message).width + 36;
    ctx.beginPath();
    ctx.roundRect(game.viewWidth / 2 - tw / 2, 128, tw, 36, 9);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.message, game.viewWidth / 2, 151);
  }
  // Keep health in sane bounds after every system has had its say.
  game.player.health = clampNumber(game.player.health, 0, 100);
  input.endFrame();
}

// Opening camera: drift over the marina until the player starts.
game.camera.snapTo(1500, 820);
stageShotScene(game, shotRequest.shot);
runAnimationLoop(frameStep);
