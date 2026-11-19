// hud.js — everything readable at a glance: money, health, vehicle state,
// wanted stars, bust meter, mission banner with district + objective +
// distance, dialogue box, live minimap, start screen and pause menu.

import { clampNumber } from './engine.js';
import { WORLD_WIDTH, WORLD_HEIGHT, VERTICAL_ROADS, HORIZONTAL_ROADS, WATER_START_X, SAND_START_X, nearestPlaceTo } from './city.js';

function roundedPanel(ctx, x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

export function drawMinimapPanel(ctx, game, x, y, w, h) {
  roundedPanel(ctx, x, y, w, h, 'rgba(7,40,54,0.82)');
  const sx = w / WORLD_WIDTH;
  const sy = h / WORLD_HEIGHT;
  const px = (wx) => x + wx * sx;
  const py = (wy) => y + wy * sy;
  // Land, sand, sea.
  ctx.fillStyle = '#7fb069';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = '#f6e3a1';
  ctx.fillRect(px(SAND_START_X), y + 3, (WATER_START_X - SAND_START_X) * sx, h - 6);
  ctx.fillStyle = '#118ab2';
  ctx.fillRect(px(WATER_START_X), y + 3, w - (WATER_START_X * sx) - 3, h - 6);
  // Roads.
  ctx.strokeStyle = 'rgba(30,30,36,0.85)';
  ctx.lineWidth = 2;
  for (const rx of VERTICAL_ROADS) {
    ctx.beginPath(); ctx.moveTo(px(rx), y + 3); ctx.lineTo(px(rx), y + h - 3); ctx.stroke();
  }
  for (const ry of HORIZONTAL_ROADS) {
    ctx.beginPath(); ctx.moveTo(x + 3, py(ry)); ctx.lineTo(x + w - 3, py(ry)); ctx.stroke();
  }
  // Buildings as faint blocks.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const b of game.city.buildings) ctx.fillRect(px(b.x), py(b.y), Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  // Traffic dots.
  ctx.fillStyle = '#ffffff';
  for (const car of game.trafficCars) ctx.fillRect(px(car.x) - 1, py(car.y) - 1, 2.4, 2.4);
  // Police dots blink red/blue.
  const flash = Math.sin(game.time * 9) > 0;
  for (const cop of game.policeCars) {
    ctx.fillStyle = flash ? '#ff2e4d' : '#3a86ff';
    ctx.beginPath(); ctx.arc(px(cop.x), py(cop.y), 3.1, 0, 7); ctx.fill();
  }
  // Objective diamond.
  const objective = game.missions.currentObjective();
  if (objective && objective.x !== null) {
    ctx.save();
    ctx.translate(px(objective.x), py(objective.y));
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd60a';
    const s = 5 + Math.sin(game.time * 6) * 1.2;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }
  // Places.
  ctx.fillStyle = '#073b4c';
  for (const place of game.city.places) ctx.fillRect(px(place.x) - 1.4, py(place.y) - 1.4, 2.8, 2.8);
  // Camera box.
  const cam = game.camera;
  const halfW = (game.viewWidth / cam.zoom / 2) * sx;
  const halfH = (game.viewHeight / cam.zoom / 2) * sy;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px(cam.x) - halfW, py(cam.y) - halfH, halfW * 2, halfH * 2);
  // Player arrow.
  const anchor = game.player.car || game.player;
  ctx.save();
  ctx.translate(px(anchor.x), py(anchor.y));
  ctx.rotate(anchor.angle || 0);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-4, -3.6); ctx.lineTo(-4, 3.6); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e8fbff';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PORT PALMERA', x + 7, y + 13);
}

export function drawGameHud(ctx, game) {
  const W = game.viewWidth;
  const player = game.player;
  // Top-left stat panel.
  roundedPanel(ctx, 14, 14, 252, 104, 'rgba(7,40,54,0.78)');
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VICE HARBOR', 26, 38);
  ctx.fillStyle = '#7bf1a8';
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(`$${Math.floor(game.money)}`, 26, 64);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(110, 50, 140, 13);
  ctx.fillStyle = player.health > 30 ? '#2ee66b' : '#ff5964';
  ctx.fillRect(110, 50, 140 * clampNumber(player.health / 100, 0, 1), 13);
  ctx.fillStyle = '#e8fbff';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(player.car ? `Driving: ${player.car.isGoldCoupe ? 'GOLD COUPE' : player.car.model} · ${Math.round(Math.abs(player.car.speed) * 0.36)} km/h · hull ${Math.round(player.car.health)}%` : 'On foot · E: steal a car', 26, 88);
  ctx.fillText(game.audio.muted ? 'Sound OFF (M)' : 'Sound ON (M)', 26, 106);

  // Wanted stars, top centre — big and screenshot-legible.
  const stars = Math.floor(game.wanted);
  if (stars > 0) {
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < stars ? '#ffd60a' : 'rgba(255,255,255,0.28)';
      ctx.fillText('★', W / 2 - 68 + i * 34, 44);
    }
    if (game.bust > 0.02) {
      ctx.fillStyle = 'rgba(7,40,54,0.8)';
      ctx.fillRect(W / 2 - 70, 54, 140, 12);
      ctx.fillStyle = '#ff2e4d';
      ctx.fillRect(W / 2 - 70, 54, 140 * game.bust, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.fillText('BUSTED?', W / 2, 63.5);
    }
  }

  drawMinimapPanel(ctx, game, W - 236, 14, 222, 172);

  // Mission banner: job title + district beside it, objective + distance.
  const job = game.missions.currentJob();
  const objective = game.missions.currentObjective();
  const anchor = player.car || player;
  const district = nearestPlaceTo(game.city, anchor.x, anchor.y).place.name;
  roundedPanel(ctx, W / 2 - 320, game.viewHeight - 118, 640, 62, 'rgba(7,40,54,0.85)');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd166';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(job ? `${job.title}  ·  ${district}` : `Free Roam  ·  ${district}`, W / 2, game.viewHeight - 94);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13.5px system-ui, sans-serif';
  if (objective) {
    const distText = objective.distance === null ? '' : ` — ${objective.distance} m`;
    ctx.fillText(`Objective: ${objective.label}${distText}`, W / 2, game.viewHeight - 72);
  } else {
    ctx.fillText('Explore Port Palmera — steal cars, outrun patrols, make money.', W / 2, game.viewHeight - 72);
  }

  // Dialogue box above the mission banner.
  if (game.dialogue) {
    const d = game.dialogue;
    roundedPanel(ctx, W / 2 - 320, game.viewHeight - 196, 640, 66, 'rgba(20,16,40,0.88)');
    ctx.fillStyle = '#ff9f6e';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(d.speaker, W / 2 - 302, game.viewHeight - 172);
    ctx.fillStyle = '#ffffff';
    ctx.font = '13.5px system-ui, sans-serif';
    wrapText(ctx, d.text, W / 2 - 302, game.viewHeight - 152, 604, 17);
  }

  // Transient centre banner (job done, wanted up, busted...).
  if (game.banner && game.bannerTimer > 0) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 25px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(7,40,54,0.85)';
    const tw = ctx.measureText(game.banner).width + 44;
    roundedPanel(ctx, W / 2 - tw / 2, 74, tw, 44, 'rgba(7,40,54,0.85)');
    ctx.fillStyle = '#ffd166';
    ctx.fillText(game.banner, W / 2, 104);
  }

  // Context hint.
  ctx.textAlign = 'left';
  ctx.font = '11.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const hint = player.car ? 'WASD drive · E exit car · P pause' : nearestStealableHint(game);
  ctx.fillText(hint, 16, game.viewHeight - 16);
}

function nearestStealableHint(game) {
  return 'WASD move · E enter car · Click shoot · F melee · Shift sprint · P pause';
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawObjectiveMarker(ctx, game) {
  const objective = game.missions.currentObjective();
  if (!objective || objective.x === null) return;
  const pulse = 1 + Math.sin(game.time * 5) * 0.15;
  ctx.save();
  ctx.translate(objective.x, objective.y);
  ctx.fillStyle = 'rgba(255,214,10,0.2)';
  ctx.beginPath();
  ctx.arc(0, 0, 44 * pulse, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#ffd60a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 30 * pulse, 0, 7);
  ctx.stroke();
  ctx.fillStyle = '#ffd60a';
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(13, -30);
  ctx.lineTo(-13, -30);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMenuButton(ctx, rect, label, accent) {
  roundedPanel(ctx, rect.x, rect.y, rect.w, rect.h, accent ? 'rgba(255,183,3,0.92)' : 'rgba(10,60,80,0.9)');
  ctx.fillStyle = accent ? '#073b4c' : '#ffffff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 6);
}

export function drawStartScreen(ctx, game) {
  const W = game.viewWidth;
  const H = game.viewHeight;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255,120,80,0.5)');
  grad.addColorStop(0.55, 'rgba(64,20,80,0.55)');
  grad.addColorStop(1, 'rgba(4,40,54,0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd60a';
  ctx.font = '900 74px system-ui, sans-serif';
  ctx.fillText('VICE HARBOR', W / 2, 128);
  ctx.fillStyle = '#7bf1ff';
  ctx.font = 'bold 21px system-ui, sans-serif';
  ctx.fillText('— PORT PALMERA —', W / 2, 162);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15.5px system-ui, sans-serif';
  wrapTextCentered(ctx, 'Rico Marlow washes up in a sun-soaked harbor city with empty pockets and a fast right foot. Fixer Mara Voss offers five jobs: parcels, boat parts, hot envelopes, a turf war on Palm Row — and one glittering gold coupe. Captain Lena Ortiz and the Harbor Patrol have other plans.', W / 2, 196, 720, 22);
  ctx.font = '13.5px system-ui, sans-serif';
  ctx.fillStyle = '#ffe9a8';
  wrapTextCentered(ctx, 'CONTROLS — WASD / arrows: move & drive · E: enter / exit / steal car · Shift: sprint · Mouse: aim · Click: shoot · F: melee · M: mute · P / Esc: pause', W / 2, 292, 700, 20);
  game.uiButtons = [];
  const startRect = { x: W / 2 - 150, y: 348, w: 300, h: 52, action: 'start' };
  drawMenuButton(ctx, startRect, 'START NEW RUN', true);
  game.uiButtons.push(startRect);
  if (game.hasSave) {
    const contRect = { x: W / 2 - 150, y: 414, w: 300, h: 52, action: 'continue' };
    drawMenuButton(ctx, contRect, 'CONTINUE (saved run)', false);
    game.uiButtons.push(contRect);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Progress autosaves after every job · Headphones on: the harbor hums', W / 2, H - 26);
}

function wrapTextCentered(ctx, text, centerX, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, centerX, yy);
      line = word;
      yy += lineHeight;
    } else line = test;
  }
  if (line) ctx.fillText(line, centerX, yy);
  return yy;
}

export function drawPauseMenu(ctx, game) {
  const W = game.viewWidth;
  const H = game.viewHeight;
  ctx.fillStyle = 'rgba(4,30,44,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd60a';
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 96);
  game.uiButtons = [];
  const resumeRect = { x: W / 2 - 140, y: H / 2 - 66, w: 280, h: 48, action: 'resume' };
  drawMenuButton(ctx, resumeRect, 'RESUME', true);
  game.uiButtons.push(resumeRect);
  const saveRect = { x: W / 2 - 140, y: H / 2 - 6, w: 280, h: 48, action: 'save' };
  drawMenuButton(ctx, saveRect, 'SAVE NOW', false);
  game.uiButtons.push(saveRect);
  const restartRect = { x: W / 2 - 140, y: H / 2 + 54, w: 280, h: 48, action: 'restart' };
  drawMenuButton(ctx, restartRect, 'RESTART RUN', false);
  game.uiButtons.push(restartRect);
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Money $${Math.floor(game.money)} · Jobs done ${game.missions.jobsCompleted}/5`, W / 2, H / 2 + 138);
}
