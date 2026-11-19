// main.js — Vice Harbor bootstrap: builds the world state, wires the menus and
// buttons, runs the game loop, renders Port Palmera, and stages ?shot= scenes.

import { createRng, FollowCamera, InputState, updateParticles, drawParticles, clampValue } from './engine.js';
import { buildCity, drawCity, PLACES } from './city.js';
import { spawnParkedCars, drawCar, toggleEnterExitCar } from './vehicles.js';
import { spawnTrafficCars, updateTrafficCars, drawTrafficCars } from './traffic.js';
import { spawnPedestrians, updatePedestrians, drawPedestrians } from './pedestrians.js';
import { createPlayer, updatePlayer, updatePlayerHealing, drawPlayer, playerPosition, playerSpeed } from './player.js';
import { updatePolice, drawPoliceCars, commitCrime } from './police.js';
import { updateCombat, drawEnemies, drawBulletsAndFlash, playerShootAt, playerMeleeAttack } from './combat.js';
import { beginStep, updateMissions, objectivePosition, currentStep } from './missions.js';
import { GameAudio } from './audio.js';
import { collectHudElements, updateHud, drawMinimap, showHudToast, showDialogueLines, advanceDialogue } from './hud.js';
import { saveGameToStorage, loadGameFromStorage, applySaveData, hasSaveGame, clearSaveGame } from './save.js';
import { stageShotScene } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const seed = Number.parseInt(params.get('seed') || '7', 10) || 7;
const shotName = params.get('shot');

/** Build a fresh world state with every system wired together. */
export function createGameState() {
  const rng = createRng(seed);
  const state = {
    mode: 'title', time: 0, rng, seed,
    city: buildCity(rng),
    player: createPlayer(),
    parkedCars: [], trafficCars: [], policeCars: [], peds: [], enemies: [],
    bullets: [], particles: [], targetCar: null, missionEnemies: null,
    wanted: 0, heatTimer: 0, bustMeter: 0, lastCrimeLabel: '',
    missionIndex: 0, stepIndex: 0, missionsDone: 0, storyComplete: false,
    shootCooldown: 0, meleeCooldown: 0, combatTimer: 0, muzzleFlash: null,
    shotsFiredBefore: false, toastTimer: 0, dialogueQueue: null, objectiveCount: null,
    camera: new FollowCamera(window.innerWidth, window.innerHeight),
    input: new InputState(canvas),
    audio: new GameAudio(),
    hud: collectHudElements(),
    shotName,
  };
  state.parkedCars = spawnParkedCars(state);
  state.trafficCars = spawnTrafficCars(state, 17);
  state.peds = spawnPedestrians(state, 30);
  state.commitCrime = (stars, label) => commitCrime(state, stars, label);
  state.showToast = (msg) => showHudToast(state, msg);
  state.showDialogue = (lines, onDone) => showDialogueLines(state, lines, onDone);
  state.dismissDialogue = () => { state.dialogueQueue = null; state.hud.dialogue.classList.add('hidden'); };
  state.saveGame = () => { if (saveGameToStorage(state)) showHudToast(state, '💾 Game saved'); };
  state.onPlayerBusted = () => endRun(state, 'busted');
  state.onPlayerWasted = () => endRun(state, 'wasted');
  state.onStoryComplete = () => {
    state.storyComplete = true;
    showHudToast(state, '👑 STORY COMPLETE — Vice Harbor is yours!');
    saveGameToStorage(state);
  };
  return state;
}

const state = createGameState();

/** Handle the busted / wasted end screens and their penalties. */
export function endRun(st, kind) {
  if (st.mode !== 'play') return;
  st.mode = 'end';
  const title = document.getElementById('end-title');
  const text = document.getElementById('end-text');
  if (kind === 'busted') {
    const fine = Math.min(90, st.player.money);
    st.player.money -= fine;
    title.textContent = 'BUSTED';
    text.textContent = 'Captain Ortiz\'s Harbor Patrol boxed Rico in. Fine paid: $' + fine + '. The harbor keeps spinning…';
    st.audio.playBustedSound();
  } else {
    const bill = Math.min(60, st.player.money);
    st.player.money -= bill;
    title.textContent = 'WASTED';
    text.textContent = 'Rico woke up at the Marina clinic with a $' + bill + ' bill and a headache shaped like Palm Row.';
    st.audio.playBustedSound();
  }
  document.getElementById('end-screen').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
}

/** Respawn Rico at the marina after a bust or a hospital visit. */
export function respawnPlayer(st) {
  if (st.player.car) { st.player.car.kind = 'parked'; st.parkedCars.push(st.player.car); st.player.car = null; }
  st.player.x = PLACES.marina.x; st.player.y = 1500;
  st.player.hp = 100; st.player.dead = false;
  st.wanted = 0; st.policeCars = []; st.bustMeter = 0; st.enemies = st.enemies.filter((e) => e.dead);
  st.mode = 'play';
  document.getElementById('end-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  st.camera.snapTo(st.player.x, st.player.y);
}

/** Start a brand-new story (wipes any save). */
export function startNewGame(st) {
  clearSaveGame();
  Object.assign(st, { missionIndex: 0, stepIndex: 0, missionsDone: 0, storyComplete: false, wanted: 0, policeCars: [], bustMeter: 0, enemies: [], bullets: [], targetCar: null, missionEnemies: null });
  st.player.hp = 100; st.player.money = 40; st.player.dead = false;
  st.player.x = PLACES.marina.x; st.player.y = 1500;
  if (st.player.car) { st.player.car = null; }
  st.mode = 'play';
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  st.camera.snapTo(st.player.x, st.player.y);
  beginStep(st);
}

/** Continue from the localStorage save. */
export function continueGame(st) {
  const data = loadGameFromStorage();
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  st.mode = 'play';
  if (data) applySaveData(st, data);
  st.camera.snapTo(st.player.x, st.player.y);
  beginStep(st);
  showHudToast(st, '↻ Save loaded — welcome back, Rico');
}

/** Pause / resume handling with the stats line filled in. */
export function setPaused(st, paused) {
  if (paused && st.mode === 'play') {
    st.mode = 'pause';
    document.getElementById('pause-stats').textContent =
      'Money $' + st.player.money + ' · Jobs done ' + st.missionsDone + '/5 · Wanted ' + st.wanted + '★ · ' + (st.player.car ? 'Driving ' + st.player.car.name : 'On foot');
    document.getElementById('pause-screen').classList.remove('hidden');
  } else if (!paused && st.mode === 'pause') {
    st.mode = 'play';
    document.getElementById('pause-screen').classList.add('hidden');
  }
}

/** Wire every menu button and key-driven UI action. */
export function wireMenus(st) {
  const $ = (id) => document.getElementById(id);
  $('btn-start').addEventListener('click', () => { st.audio.initAudioOnGesture(); startNewGame(st); });
  $('btn-continue').addEventListener('click', () => { st.audio.initAudioOnGesture(); continueGame(st); });
  $('btn-how').addEventListener('click', () => $('start-how').classList.toggle('hidden'));
  $('btn-resume').addEventListener('click', () => setPaused(st, false));
  $('btn-save').addEventListener('click', () => { st.saveGame(); });
  $('btn-load').addEventListener('click', () => { setPaused(st, false); continueGame(st); });
  $('btn-restart').addEventListener('click', () => { setPaused(st, false); document.getElementById('pause-screen').classList.add('hidden'); startNewGame(st); });
  $('btn-again').addEventListener('click', () => respawnPlayer(st));
  $('btn-mute').addEventListener('click', (e) => { st.audio.initAudioOnGesture(); e.target.textContent = st.audio.toggleMute() ? '🔇 MUTED' : '🔊 SOUND ON'; });
  st.hud.dialogue.addEventListener('click', () => advanceDialogue(st));
  if (hasSaveGame()) $('btn-continue').classList.remove('hidden');
  window.addEventListener('pointerdown', () => st.audio.initAudioOnGesture(), { once: true });
}

/** One frame of world simulation for the play mode. */
export function updatePlay(st, dt) {
  st.time += dt;
  if (st.shotName) applyShotAutopilot(st);
  if (st.dialogueQueue) return; // world holds its breath while people talk
  if (st.input.wasPressed('KeyE') || st.input.wasPressed('Enter')) {
    const msg = toggleEnterExitCar(st);
    if (msg) showHudToast(st, msg);
  }
  if (st.input.wasPressed('KeyF')) playerMeleeAttack(st);
  if (st.input.wasPressed('KeyM')) {
    const muted = st.audio.toggleMute();
    document.getElementById('btn-mute').textContent = muted ? '🔇 MUTED' : '🔊 SOUND ON';
  }
  if (st.input.mouseDown && !st.player.car) {
    playerShootAt(st, st.camera.screenToWorldX(st.input.mouseScreenX), st.camera.screenToWorldY(st.input.mouseScreenY));
  }
  updatePlayer(st, dt);
  updatePlayerHealing(st, dt);
  updateTrafficCars(st, dt);
  updatePedestrians(st, dt);
  updatePolice(st, dt);
  updateCombat(st, dt);
  updateMissions(st, dt);
  updateParticles(st, dt);
  const p = playerPosition(st);
  st.camera.followTarget(p.x, p.y, playerSpeed(st), dt);
  updateHud(st);
  drawMinimap(st);
}

/** Ambient simulation behind the title screen: traffic and people keep living. */
export function updateTitleAmbient(st, dt) {
  st.time += dt;
  updateTrafficCars(st, dt);
  updatePedestrians(st, dt);
  updateParticles(st, dt);
  st.camera.x = PLACES.marina.x + Math.sin(st.time * 0.07) * 260;
  st.camera.y = 1400 + Math.sin(st.time * 0.05) * 60;
}

/** In shot mode the game drives itself so screenshots show real motion systems. */
export function applyShotAutopilot(st) {
  st.input.keysDown.add('KeyW');
  if (!st.player.car) { st.input.keysDown.delete('KeyW'); st.input.keysDown.add('KeyD'); }
}

/** The gold objective beacon: light column, pulsing ring and place name. */
export function drawObjectiveBeacon(ctx, st) {
  const pos = objectivePosition(st);
  if (!pos) return;
  const pulse = 26 + Math.sin(st.time * 4) * 6;
  const grad = ctx.createLinearGradient(0, pos.y - 260, 0, pos.y);
  grad.addColorStop(0, 'rgba(255,210,63,0)'); grad.addColorStop(1, 'rgba(255,210,63,.5)');
  ctx.fillStyle = grad; ctx.fillRect(pos.x - 13, pos.y - 260, 26, 260);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(pos.x, pos.y, pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,210,63,.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(pos.x, pos.y, pulse + 13, 0, Math.PI * 2); ctx.stroke();
  const step = currentStep(st);
  ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 15px Verdana'; ctx.textAlign = 'center';
  ctx.fillText('◆ ' + (step && step.place ? PLACES[step.place].name.toUpperCase() : 'OBJECTIVE'), pos.x, pos.y - 44);
}

/** An edge arrow (screen space) pointing toward an off-screen objective. */
export function drawObjectiveEdgeArrow(ctx, st) {
  const pos = objectivePosition(st);
  if (!pos) return;
  const sx = st.camera.worldToScreenX(pos.x), sy = st.camera.worldToScreenY(pos.y);
  const w = st.camera.viewWidth, h = st.camera.viewHeight;
  if (sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30) return;
  const cx = clampValue(sx, 36, w - 36), cy = clampValue(sy, 90, h - 36);
  const angle = Math.atan2(sy - cy, sx - cx);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Render the whole frame. */
export function renderGame(st) {
  const cam = st.camera;
  cam.clampToWorld(2500, 1900);
  ctx.fillStyle = '#0e7fb8'; ctx.fillRect(0, 0, cam.viewWidth, cam.viewHeight);
  ctx.save();
  ctx.translate(cam.viewWidth / 2, cam.viewHeight / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  drawCity(ctx, st.city, st.time);
  drawObjectiveBeacon(ctx, st);
  for (const car of st.parkedCars) drawCar(ctx, car, st.time);
  drawTrafficCars(ctx, st, st.time);
  drawPedestrians(ctx, st, st.time);
  drawEnemies(ctx, st);
  drawPoliceCars(ctx, st, st.time);
  if (st.player.car) drawCar(ctx, st.player.car, st.time);
  drawPlayer(ctx, st, st.time);
  drawBulletsAndFlash(ctx, st);
  drawParticles(ctx, st);
  ctx.restore();
  drawObjectiveEdgeArrow(ctx, st);
  if (st.player.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(255,40,60,' + (st.player.hurtFlash * 0.55) + ')';
    ctx.fillRect(0, 0, cam.viewWidth, cam.viewHeight);
  }
  // Warm tropical grade: a whisper of golden light from the top.
  const grad = ctx.createLinearGradient(0, 0, 0, cam.viewHeight);
  grad.addColorStop(0, 'rgba(255,190,80,.07)'); grad.addColorStop(1, 'rgba(10,60,110,.08)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, cam.viewWidth, cam.viewHeight);
}

/** Resize the canvas to the window (device pixels, capped for performance). */
export function resizeCanvas(st) {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  st.camera.viewWidth = window.innerWidth;
  st.camera.viewHeight = window.innerHeight;
}

let lastTimestamp = 0;
/** The requestAnimationFrame loop: fixed-clamped dt, mode dispatch, render. */
export function gameLoop(timestamp) {
  const dt = Math.min(0.033, (timestamp - lastTimestamp) / 1000 || 0.016);
  lastTimestamp = timestamp;
  if (state.input.wasPressed('KeyP') || state.input.wasPressed('Escape')) {
    if (state.mode === 'play') setPaused(state, true);
    else if (state.mode === 'pause') setPaused(state, false);
  }
  if (state.input.wasPressed('Space') && state.dialogueQueue) advanceDialogue(state);
  if (state.mode === 'play') updatePlay(state, dt);
  else if (state.mode === 'title') updateTitleAmbient(state, dt);
  renderGame(state);
  state.input.endFrame();
  requestAnimationFrame(gameLoop);
}

// ---- boot ----
resizeCanvas(state);
window.addEventListener('resize', () => resizeCanvas(state));
wireMenus(state);
state.camera.snapTo(PLACES.marina.x, 1420);
if (shotName) {
  document.getElementById('start-screen').classList.add('hidden');
  if (shotName !== 'start') {
    state.mode = 'play';
    document.getElementById('hud').classList.remove('hidden');
    beginStep(state);
    stageShotScene(state, shotName);
  } else {
    document.getElementById('start-screen').classList.remove('hidden');
    state.mode = 'title';
  }
}
requestAnimationFrame(gameLoop);
