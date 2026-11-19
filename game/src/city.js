// city.js — Port Palmera itself: road grid, pastel blocks, beach, marina,
// palms, named places, collision and the world renderer.

import { makeSeededRandom, distanceBetween } from './engine.js';

export const WORLD_WIDTH = 2600;
export const WORLD_HEIGHT = 2000;
export const ROAD_WIDTH = 120;
export const VERTICAL_ROADS = [220, 620, 1020, 1420, 1820];
export const HORIZONTAL_ROADS = [260, 660, 1060, 1460, 1820];
export const SAND_START_X = 2100;
export const WATER_START_X = 2380;

export const CITY_PLACES = [
  { name: 'Plaza Central', x: 1420, y: 660, color: '#ffd166' },
  { name: 'Café Sol', x: 620, y: 660, color: '#ff9f6e' },
  { name: 'Palm Row', x: 1020, y: 1060, color: '#ef476f' },
  { name: "Tito's Garage", x: 220, y: 1460, color: '#8ecae6' },
  { name: 'Marina Azul', x: 2320, y: 260, color: '#48cae4' },
  { name: 'Faro Pier', x: 2360, y: 1060, color: '#90e0a0' },
  { name: 'Old Lighthouse Point', x: 2470, y: 1820, color: '#f4f1de' },
];

const PASTEL_WALLS = ['#ffd6a5', '#ffadad', '#ffc6ff', '#bdb2ff', '#a0c4ff', '#9bf6ff', '#caffbf', '#fdffb6', '#ffb36b', '#ff8fa3'];
const SHOP_SIGNS = ['Hotel Brisa', 'Tienda Ola', 'Bar Coral', 'Farmacia Luz', 'Mercado Sol', 'Surf Nami', 'Café Sol', 'Joyas Mar', 'Libros Alba', 'Pan Dulce', 'Radio Costa', 'Flores Mia'];

export function placeByName(city, name) {
  return city.places.find((place) => place.name === name);
}

export function nearestPlaceTo(city, x, y) {
  let best = city.places[0];
  let bestDist = Infinity;
  for (const place of city.places) {
    const d = distanceBetween(x, y, place.x, place.y);
    if (d < bestDist) {
      bestDist = d;
      best = place;
    }
  }
  return { place: best, distance: bestDist };
}

export function isOnAnyRoad(x, y) {
  for (const rx of VERTICAL_ROADS) if (Math.abs(x - rx) < ROAD_WIDTH / 2) return true;
  for (const ry of HORIZONTAL_ROADS) if (Math.abs(y - ry) < ROAD_WIDTH / 2 && x < WATER_START_X + 290) return true;
  return false;
}

export function isInWater(x, y) {
  if (x < WATER_START_X) return false;
  // The pier road and the lighthouse spit stay walkable/drivable.
  if (Math.abs(y - 1060) < 70) return false;
  if (x < 2560 && Math.abs(y - 1820) < 70) return false;
  return true;
}

export function buildCityLayout(seed) {
  const random = makeSeededRandom(seed || 7);
  const buildings = [];
  const xBlocks = [[36, 130], [290, 530], [690, 930], [1090, 1330], [1490, 1730], [1890, 2030]];
  const yBlocks = [[36, 170], [330, 570], [730, 970], [1130, 1370], [1530, 1730], [1890, 1940]];
  let signIndex = 0;
  for (let by = 0; by < yBlocks.length; by++) {
    for (let bx = 0; bx < xBlocks.length; bx++) {
      const [x0, x1] = xBlocks[bx];
      const [y0, y1] = yBlocks[by];
      const cols = x1 - x0 > 160 ? 2 : 1;
      const rows = y1 - y0 > 160 ? 2 : 1;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const w = (x1 - x0) / cols - 22;
          const h = (y1 - y0) / rows - 22;
          if (w < 40 || h < 34) continue;
          const jitterX = (random() - 0.5) * 8;
          const jitterY = (random() - 0.5) * 8;
          const signed = random() < 0.34;
          buildings.push({
            x: x0 + cx * ((x1 - x0) / cols) + 11 + jitterX,
            y: y0 + cy * ((y1 - y0) / rows) + 11 + jitterY,
            w,
            h,
            color: PASTEL_WALLS[Math.floor(random() * PASTEL_WALLS.length)],
            roof: PASTEL_WALLS[Math.floor(random() * PASTEL_WALLS.length)],
            sign: signed ? SHOP_SIGNS[signIndex++ % SHOP_SIGNS.length] : '',
          });
        }
      }
    }
  }
  const palms = [];
  for (let y = 90; y < WORLD_HEIGHT - 60; y += 92) {
    palms.push({ x: SAND_START_X + 46 + random() * 60, y: y + random() * 30, size: 15 + random() * 8 });
  }
  for (const ry of HORIZONTAL_ROADS) {
    for (const rx of VERTICAL_ROADS) {
      palms.push({ x: rx + 84, y: ry + 84, size: 13 + random() * 6 });
    }
  }
  const boats = [];
  for (let i = 0; i < 9; i++) {
    boats.push({ x: WATER_START_X + 60 + random() * 130, y: 120 + i * 205 + random() * 60, phase: random() * 6.28, hue: PASTEL_WALLS[i % PASTEL_WALLS.length] });
  }
  return { buildings, palms, boats, places: CITY_PLACES.map((p) => ({ ...p })) };
}

export function pointHitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    if (x + radius > b.x && x - radius < b.x + b.w && y + radius > b.y && y - radius < b.y + b.h) return b;
  }
  return null;
}

export function blockedAt(city, x, y, radius) {
  if (x < radius || y < radius || x > WORLD_WIDTH - radius || y > WORLD_HEIGHT - radius) return true;
  if (isInWater(x, y)) return true;
  return pointHitsBuilding(city, x, y, radius) !== null;
}

function drawPalmTree(ctx, palm, time) {
  const sway = Math.sin(time * 1.4 + palm.x * 0.05) * 2;
  ctx.strokeStyle = '#8a5a33';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(palm.x, palm.y);
  ctx.quadraticCurveTo(palm.x + 3, palm.y - palm.size * 0.7, palm.x + sway, palm.y - palm.size * 1.25);
  ctx.stroke();
  ctx.strokeStyle = '#2f9e44';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + sway * 0.05;
    ctx.beginPath();
    ctx.moveTo(palm.x + sway, palm.y - palm.size * 1.25);
    ctx.quadraticCurveTo(
      palm.x + sway + Math.cos(a) * palm.size * 0.9,
      palm.y - palm.size * 1.25 + Math.sin(a) * palm.size * 0.4 - 4,
      palm.x + sway + Math.cos(a) * palm.size * 1.25,
      palm.y - palm.size * 1.25 + Math.sin(a) * palm.size * 0.7 + 5,
    );
    ctx.stroke();
  }
  ctx.fillStyle = '#6f4518';
  ctx.beginPath();
  ctx.arc(palm.x + sway - 3, palm.y - palm.size * 1.2, 3, 0, 7);
  ctx.arc(palm.x + sway + 4, palm.y - palm.size * 1.15, 3, 0, 7);
  ctx.fill();
}

export function drawCityWorld(ctx, city, view, time) {
  const left = view.x - view.w / 2 - 60;
  const top = view.y - view.h / 2 - 60;
  const right = view.x + view.w / 2 + 60;
  const bottom = view.y + view.h / 2 + 60;

  // Parkland base, then sand, then turquoise sea.
  ctx.fillStyle = '#9ccc7c';
  ctx.fillRect(left, top, right - left, bottom - top);
  ctx.fillStyle = '#f6e3a1';
  ctx.fillRect(SAND_START_X, top, WATER_START_X - SAND_START_X, bottom - top);
  const seaGrad = ctx.createLinearGradient(WATER_START_X, 0, WORLD_WIDTH, 0);
  seaGrad.addColorStop(0, '#3fd2c7');
  seaGrad.addColorStop(1, '#118ab2');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(WATER_START_X, top, right - WATER_START_X, bottom - top);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = 40; y < WORLD_HEIGHT; y += 64) {
    const wob = Math.sin(time * 1.2 + y * 0.08) * 9;
    ctx.beginPath();
    ctx.moveTo(WATER_START_X + 18 + wob, y);
    ctx.lineTo(WATER_START_X + 88 + wob, y);
    ctx.stroke();
  }
  // Boardwalk planks along the sand.
  ctx.fillStyle = '#cd9b5f';
  ctx.fillRect(SAND_START_X + 2, top, 34, bottom - top);
  ctx.fillStyle = 'rgba(120,72,20,0.35)';
  for (let y = Math.floor(top / 26) * 26; y < bottom; y += 26) ctx.fillRect(SAND_START_X + 2, y, 34, 2);

  // Roads: asphalt slabs with sidewalk rims and dashed centre lines.
  ctx.fillStyle = '#4a4e57';
  for (const rx of VERTICAL_ROADS) ctx.fillRect(rx - ROAD_WIDTH / 2 - 8, 0, ROAD_WIDTH + 16, WORLD_HEIGHT);
  for (const ry of HORIZONTAL_ROADS) ctx.fillRect(0, ry - ROAD_WIDTH / 2 - 8, WATER_START_X + 300, ROAD_WIDTH + 16);
  ctx.fillStyle = '#33363d';
  for (const rx of VERTICAL_ROADS) ctx.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, WORLD_HEIGHT);
  for (const ry of HORIZONTAL_ROADS) ctx.fillRect(0, ry - ROAD_WIDTH / 2, WATER_START_X + 300, ROAD_WIDTH);
  // Zebra crossings where avenues meet.
  ctx.fillStyle = 'rgba(245,245,245,0.75)';
  for (const rx of VERTICAL_ROADS) {
    for (const ry of HORIZONTAL_ROADS) {
      for (let s = -48; s <= 48; s += 16) {
        ctx.fillRect(rx + s - 5, ry - ROAD_WIDTH / 2 - 15, 10, 9);
        ctx.fillRect(rx + s - 5, ry + ROAD_WIDTH / 2 + 6, 10, 9);
        ctx.fillRect(rx - ROAD_WIDTH / 2 - 15, ry + s - 5, 9, 10);
        ctx.fillRect(rx + ROAD_WIDTH / 2 + 6, ry + s - 5, 9, 10);
      }
    }
  }
  ctx.fillStyle = '#f8ed6a';
  for (const rx of VERTICAL_ROADS) {
    for (let y = 14; y < WORLD_HEIGHT; y += 52) ctx.fillRect(rx - 2, y, 4, 26);
  }
  for (const ry of HORIZONTAL_ROADS) {
    for (let x = 14; x < WATER_START_X + 280; x += 52) ctx.fillRect(x, ry - 2, 26, 4);
  }

  // Buildings with pastel walls, roof trim and shop signs.
  for (const b of city.buildings) {
    if (b.x + b.w < left || b.x > right || b.y + b.h < top || b.y > bottom) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 5, b.y + 7, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.roof;
    ctx.lineWidth = 5;
    ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const winW = 12;
    for (let wx = b.x + 10; wx + winW < b.x + b.w - 6; wx += 22) {
      ctx.fillRect(wx, b.y + 12, winW, 9);
      if (b.h > 56) ctx.fillRect(wx, b.y + b.h - 22, winW, 9);
    }
    if (b.sign) {
      ctx.fillStyle = '#073b4c';
      const signW = Math.min(b.w - 8, b.sign.length * 7.4 + 12);
      ctx.fillRect(b.x + (b.w - signW) / 2, b.y + b.h / 2 - 10, signW, 19);
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 3.5);
    }
  }

  for (const palm of city.palms) {
    if (palm.x < left || palm.x > right || palm.y < top - 40 || palm.y > bottom + 40) continue;
    drawPalmTree(ctx, palm, time);
  }

  // Marina boats bobbing at anchor.
  for (const boat of city.boats) {
    const bob = Math.sin(time * 1.6 + boat.phase) * 3;
    ctx.save();
    ctx.translate(boat.x, boat.y + bob);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 10, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = boat.hue;
    ctx.fillRect(-16, -4, 32, 5);
    ctx.strokeStyle = '#5b4a2f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, -30);
    ctx.stroke();
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(13, -6);
    ctx.lineTo(0, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // The lighthouse on its spit.
  const lh = placeByName(city, 'Old Lighthouse Point');
  ctx.fillStyle = '#e9ecef';
  ctx.beginPath();
  ctx.moveTo(lh.x - 15, lh.y + 24);
  ctx.lineTo(lh.x - 9, lh.y - 34);
  ctx.lineTo(lh.x + 9, lh.y - 34);
  ctx.lineTo(lh.x + 15, lh.y + 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ef476f';
  ctx.fillRect(lh.x - 12, lh.y - 8, 24, 11);
  ctx.fillRect(lh.x - 10, lh.y - 26, 20, 9);
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(lh.x, lh.y - 40, 6 + Math.sin(time * 3) * 1.5, 0, 7);
  ctx.fill();

  // Named-place ground labels.
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const place of city.places) {
    ctx.fillStyle = 'rgba(7,59,76,0.75)';
    ctx.fillText(place.name.toUpperCase(), place.x + 1, place.y - 17);
    ctx.fillStyle = place.color;
    ctx.fillText(place.name.toUpperCase(), place.x, place.y - 18);
  }
}
