// hud.js — everything the player reads: money, health, wanted stars, the bust
// meter, the mission objective banner, toasts, dialogue, and the minimap.

import { ROAD_XS, ROAD_YS, WORLD_WIDTH, WORLD_HEIGHT, WATER_Y, BEACH_Y, PLACES } from './city.js';
import { currentMission, currentStep, objectivePosition } from './missions.js';
import { playerPosition } from './player.js';

/** Grab every HUD element once. */
export function collectHudElements() {
  const byId = (id) => document.getElementById(id);
  return {
    root: byId('hud'), money: byId('hud-money'), health: byId('hud-health'),
    vehicle: byId('hud-vehicle'), stars: byId('hud-stars'),
    bustWrap: byId('hud-bust-wrap'), bust: byId('hud-bust'),
    missionName: byId('hud-mission-name'), objectiveText: byId('hud-objective-text'),
    objectiveDist: byId('hud-objective-dist'), toast: byId('hud-toast'),
    minimap: byId('minimap'), dialogue: byId('dialogue'),
    dialogueSpeaker: byId('dialogue-speaker'), dialogueText: byId('dialogue-text'),
  };
}

/** Show a big centre toast for a few seconds (rewards, wanted changes, hints). */
export function showHudToast(state, message) {
  state.hud.toast.textContent = message;
  state.hud.toast.classList.remove('hidden');
  state.toastTimer = 2.6;
}

/** Queue dialogue lines; the game shows them one at a time over the world. */
export function showDialogueLines(state, lines, onDone) {
  state.dialogueQueue = { lines, index: 0, onDone: onDone || null };
  renderDialogueLine(state);
}

/** Put the current dialogue line on screen (or hide the box when done). */
export function renderDialogueLine(state) {
  const q = state.dialogueQueue;
  if (!q) { state.hud.dialogue.classList.add('hidden'); return; }
  const [speaker, text] = q.lines[q.index];
  state.hud.dialogueSpeaker.textContent = speaker;
  state.hud.dialogueText.textContent = text;
  state.hud.dialogue.classList.remove('hidden');
}

/** Advance dialogue on click/Space; fire the completion callback at the end. */
export function advanceDialogue(state) {
  const q = state.dialogueQueue;
  if (!q) return false;
  q.index += 1;
  if (q.index >= q.lines.length) {
    state.dialogueQueue = null;
    state.hud.dialogue.classList.add('hidden');
    if (q.onDone) q.onDone();
  } else renderDialogueLine(state);
  return true;
}

/** Name of the Port Palmera district the player is in: the nearest named place. */
export function nearestDistrictName(state) {
  const p = playerPosition(state);
  let best = 'Port Palmera', bestDist = Infinity;
  for (const key of Object.keys(PLACES)) {
    const place = PLACES[key];
    const d = Math.hypot(place.x - p.x, place.y - p.y);
    if (d < bestDist) { bestDist = d; best = place.name; }
  }
  return best;
}

/** Refresh all HUD readouts from state (called every frame; cheap text writes). */
export function updateHud(state) {
  const hud = state.hud, player = state.player;
  hud.money.textContent = '$' + player.money;
  hud.health.style.width = Math.max(0, player.hp) + '%';
  hud.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
  hud.stars.style.opacity = state.wanted === 0 ? '0.35' : '1';
  hud.bustWrap.classList.toggle('hidden', state.bustMeter <= 0.02);
  hud.bust.style.width = (state.bustMeter * 100).toFixed(0) + '%';
  if (player.car) { hud.vehicle.classList.remove('hidden'); hud.vehicle.textContent = '🚗 ' + player.car.name.toUpperCase() + ' · ' + Math.round(player.car.hp) + '%'; }
  else hud.vehicle.classList.add('hidden');
  const mission = currentMission(state);
  const step = currentStep(state);
  hud.missionName.textContent = (mission ? mission.title : 'VICE HARBOR') + ' — ' + nearestDistrictName(state);
  if (state.storyComplete) hud.objectiveText.textContent = 'Story complete — Port Palmera is yours. Free roam!';
  else if (step) {
    hud.objectiveText.textContent = step.text;
    const pos = objectivePosition(state);
    if (pos) {
      const p = playerPosition(state);
      const d = Math.round(Math.hypot(pos.x - p.x, pos.y - p.y));
      hud.objectiveDist.textContent = '◆ ' + d + ' m' + (step.type === 'loseCops' ? ' — break line of sight!' : '');
    } else hud.objectiveDist.textContent = '';
  } else hud.objectiveText.textContent = 'Explore Port Palmera';
  if (state.toastTimer > 0) { state.toastTimer -= 1 / 60; if (state.toastTimer <= 0) hud.toast.classList.add('hidden'); }
}

/** Draw the minimap: water, beach, roads, buildings, objective, police, player. */
export function drawMinimap(state) {
  const canvas = state.hud.minimap;
  const ctx = canvas.getContext('2d');
  const sx = canvas.width / WORLD_WIDTH, sy = canvas.height / WORLD_HEIGHT;
  ctx.fillStyle = '#79c98a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f7e3ac'; ctx.fillRect(0, BEACH_Y * sy, canvas.width, (WATER_Y - BEACH_Y) * sy);
  ctx.fillStyle = '#1595b8'; ctx.fillRect(0, WATER_Y * sy, canvas.width, canvas.height - WATER_Y * sy);
  ctx.fillStyle = '#3c4650';
  for (const rx of ROAD_XS) ctx.fillRect(rx * sx - 2, 0, 4, canvas.height);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry * sy - 2, canvas.width, 4);
  ctx.fillStyle = 'rgba(60,40,20,.5)';
  for (const b of state.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  // Named places as pale dots.
  ctx.fillStyle = '#ffffff';
  for (const key of Object.keys(PLACES)) { const pl = PLACES[key]; ctx.beginPath(); ctx.arc(pl.x * sx, pl.y * sy, 2, 0, Math.PI * 2); ctx.fill(); }
  // Objective: pulsing gold diamond.
  const objective = objectivePosition(state);
  if (objective) {
    const pulse = 4 + Math.sin(state.time * 5) * 1.4;
    ctx.fillStyle = '#ffd23f';
    ctx.save(); ctx.translate(objective.x * sx, objective.y * sy); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse / 1.4, -pulse / 1.4, pulse * 1.4, pulse * 1.4); ctx.restore();
  }
  // Police as blue/red dots.
  for (const cop of state.policeCars) {
    ctx.fillStyle = Math.sin(state.time * 12 + cop.sirenPhase) > 0 ? '#ff3b30' : '#3da9ff';
    ctx.beginPath(); ctx.arc(cop.x * sx, cop.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Enemies as pink dots.
  ctx.fillStyle = '#ff5d8f';
  for (const e of state.enemies) if (!e.dead) { ctx.beginPath(); ctx.arc(e.x * sx, e.y * sy, 2.6, 0, Math.PI * 2); ctx.fill(); }
  // Player: white arrow.
  const p = playerPosition(state);
  const angle = state.player.car ? state.player.car.angle : state.player.angle;
  ctx.save(); ctx.translate(p.x * sx, p.y * sy); ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.4;
  ctx.strokeRect(state.camera.x * sx - (state.camera.viewWidth / 2 / state.camera.zoom) * sx, state.camera.y * sy - (state.camera.viewHeight / 2 / state.camera.zoom) * sy, (state.camera.viewWidth / state.camera.zoom) * sx, (state.camera.viewHeight / state.camera.zoom) * sy);
}
