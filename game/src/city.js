// city.js — Port Palmera itself: the road grid, pastel buildings with shop signs, palm
// trees, the marina and the southern beach, plus the drawing of all of it.

export const WORLD_WIDTH = 2500;
export const WORLD_HEIGHT = 1900;
export const BEACH_Y = 1560;          // sand starts here; water below WATER_Y
export const WATER_Y = 1740;
export const ROAD_WIDTH = 96;
export const ROAD_XS = [260, 660, 1060, 1460, 1860, 2260];   // vertical road centres
export const ROAD_YS = [260, 660, 1060, 1420];                // horizontal road centres

const BUILDING_COLORS = ['#ffd9a0', '#ffb3c1', '#a8e6cf', '#fdfd96', '#c3b2ea', '#ffc48f', '#9be7ff', '#f9f871', '#ffabab', '#b5ead7'];
const ROOF_COLORS = ['#e07a5f', '#f2cc8f', '#81b29a', '#e07a5f', '#3d405b', '#f4845f'];
const SHOP_NAMES = ['CAFÉ SOL', 'MARINA INN', 'PALM RADIO', 'SURF SHOP', 'BANCO SOL', 'TACO MAR', 'HOTEL LUNA', 'GYM COCO', 'PHARMACY', 'BAR NEÓN', 'BAKERY ANA', 'PORT STORE', 'CLUB FARO', 'PIZZA REEF', 'DIVE SHOP', 'MERCADO'];

/** True when (x, y) is on any road (either direction). */
export function isOnRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < ROAD_WIDTH / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < ROAD_WIDTH / 2) return true;
  return false;
}

/** True when (x, y) is on a sidewalk: just beside a road, not on the asphalt. */
export function isOnSidewalk(x, y) {
  for (const rx of ROAD_XS) { const d = Math.abs(x - rx); if (d >= ROAD_WIDTH / 2 && d < ROAD_WIDTH / 2 + 16) return true; }
  for (const ry of ROAD_YS) { const d = Math.abs(y - ry); if (d >= ROAD_WIDTH / 2 && d < ROAD_WIDTH / 2 + 16) return true; }
  return false;
}

/** Build the whole city deterministically from the seeded RNG. */
export function buildCity(rng) {
  const buildings = [];
  let shopIndex = 0;
  // Plots on a 152px grid offset from the roads; any plot touching a road band
  // (asphalt + sidewalk + margin) is skipped, so buildings fill the blocks only.
  const touchesRoad = (x, y, w, h) => {
    for (const rx of ROAD_XS) if (x < rx + 66 && x + w > rx - 66) return true;
    for (const ry of ROAD_YS) if (y < ry + 66 && y + h > ry - 66) return true;
    return false;
  };
  for (let bx = 84; bx < WORLD_WIDTH - 130; bx += 152) {
    for (let by = 84; by < BEACH_Y - 130; by += 152) {
      const w = 116 + rng() * 26, h = 106 + rng() * 26;
      const x = bx + rng() * 8, y = by + rng() * 8;
      if (touchesRoad(x, y, w, h)) continue;
      const color = BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)];
      const roof = ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)];
      const shop = rng() < 0.42 ? SHOP_NAMES[shopIndex++ % SHOP_NAMES.length] : null;
      buildings.push({ x, y, w, h, color, roof, shop, floors: 2 + Math.floor(rng() * 4) });
    }
  }
  const palms = [];
  for (let i = 0; i < 130; i += 1) {
    const onBeach = i > 70;
    const x = 30 + rng() * (WORLD_WIDTH - 60);
    const y = onBeach ? BEACH_Y + 16 + rng() * (WATER_Y - BEACH_Y - 40) : 30 + rng() * (BEACH_Y - 80);
    if (!onBeach && isOnRoad(x, y)) continue;
    let inside = false;
    for (const b of buildings) if (x > b.x - 8 && x < b.x + b.w + 8 && y > b.y - 8 && y < b.y + b.h + 8) { inside = true; break; }
    if (inside) continue;
    palms.push({ x, y, sway: rng() * Math.PI * 2, size: 13 + rng() * 8 });
  }
  const umbrellas = [];
  for (let i = 0; i < 16; i += 1) umbrellas.push({ x: 80 + rng() * (WORLD_WIDTH - 160), y: BEACH_Y + 30 + rng() * 120, color: BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)] });
  const boats = [];
  for (let i = 0; i < 9; i += 1) boats.push({ x: 120 + i * 260 + rng() * 90, y: WATER_Y + 46 + rng() * 60, color: BUILDING_COLORS[Math.floor(rng() * BUILDING_COLORS.length)], phase: rng() * 6 });
  return { buildings, palms, umbrellas, boats };
}

/** The named places missions send the player to. */
export const PLACES = {
  marina: { x: 660, y: 1660, name: 'Marina Azul' },
  cafe: { x: 1060, y: 700, name: 'Café Sol' },
  palmRow: { x: 1860, y: 660, name: 'Palm Row' },
  garage: { x: 300, y: 1100, name: "Tito's Garage" },
  pier: { x: 2260, y: 1680, name: 'Faro Pier' },
  hideout: { x: 2260, y: 300, name: 'Old Lighthouse Point' },
  plaza: { x: 1060, y: 1060, name: 'Plaza Central' },
};

/** Draw one palm tree: curved trunk and a fan of fronds that sways with the breeze. */
export function drawPalmTree(ctx, palm, time) {
  const sway = Math.sin(time * 0.9 + palm.sway) * 2.2;
  ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(palm.x, palm.y); ctx.quadraticCurveTo(palm.x + sway, palm.y - palm.size * 0.7, palm.x + sway * 1.8, palm.y - palm.size * 1.25); ctx.stroke();
  const topX = palm.x + sway * 1.8, topY = palm.y - palm.size * 1.25;
  ctx.strokeStyle = '#1f9d63'; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + palm.sway;
    ctx.beginPath(); ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + Math.cos(a) * palm.size * 0.8, topY + Math.sin(a) * palm.size * 0.5 - 4, topX + Math.cos(a) * palm.size * 1.25, topY + Math.sin(a) * palm.size * 0.8 + 5);
    ctx.stroke();
  }
  ctx.fillStyle = '#6b4423';
  ctx.beginPath(); ctx.arc(topX - 3, topY + 2, 3, 0, Math.PI * 2); ctx.arc(topX + 4, topY + 3, 3, 0, Math.PI * 2); ctx.fill();
}

/** Draw the full city: ground, beach, water, roads, buildings, palms and boats. */
export function drawCity(ctx, city, time) {
  // Grass / city ground base.
  ctx.fillStyle = '#79c98a'; ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = '#8fd49a';
  for (let x = 0; x < WORLD_WIDTH; x += 200) for (let y = 0; y < BEACH_Y; y += 200) if ((x + y) % 400 === 0) ctx.fillRect(x, y, 200, 200);
  // Beach sand and animated turquoise water.
  ctx.fillStyle = '#f7e3ac'; ctx.fillRect(0, BEACH_Y, WORLD_WIDTH, WORLD_HEIGHT - BEACH_Y);
  ctx.fillStyle = '#ffeec2'; ctx.fillRect(0, BEACH_Y, WORLD_WIDTH, 26);
  const grad = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_HEIGHT);
  grad.addColorStop(0, '#37d5c4'); grad.addColorStop(1, '#0e7fb8');
  ctx.fillStyle = grad; ctx.fillRect(0, WATER_Y, WORLD_WIDTH, WORLD_HEIGHT - WATER_Y);
  ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= WORLD_WIDTH; x += 26) { const y = WATER_Y + 6 + Math.sin(time * 1.6 + x * 0.02) * 4; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.3)';
  for (let row = 0; row < 3; row += 1) {
    ctx.beginPath();
    for (let x = 0; x <= WORLD_WIDTH; x += 60) { const y = WATER_Y + 34 + row * 44 + Math.sin(time + x * 0.013 + row * 2) * 6; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // Marina boardwalk.
  ctx.fillStyle = '#b08954'; ctx.fillRect(0, BEACH_Y + 118, WORLD_WIDTH, 30);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 0; x < WORLD_WIDTH; x += 34) ctx.fillRect(x, BEACH_Y + 118, 3, 30);
  // Roads: sidewalks, asphalt, dashes.
  ctx.fillStyle = '#cfd6da';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_WIDTH / 2 - 14, 0, ROAD_WIDTH + 28, BEACH_Y + 60);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_WIDTH / 2 - 14, WORLD_WIDTH, ROAD_WIDTH + 28);
  ctx.fillStyle = '#3c4650';
  for (const rx of ROAD_XS) ctx.fillRect(rx - ROAD_WIDTH / 2, 0, ROAD_WIDTH, BEACH_Y + 60);
  for (const ry of ROAD_YS) ctx.fillRect(0, ry - ROAD_WIDTH / 2, WORLD_WIDTH, ROAD_WIDTH);
  ctx.fillStyle = '#f7f3d8';
  for (const rx of ROAD_XS) for (let y = 10; y < BEACH_Y + 40; y += 46) ctx.fillRect(rx - 2, y, 4, 26);
  for (const ry of ROAD_YS) for (let x = 10; x < WORLD_WIDTH; x += 46) ctx.fillRect(x, ry - 2, 26, 4);
  // Buildings with roofs, windows and shop signs.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x, b.y, b.w, 12);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    const cols = Math.floor(b.w / 30), rows = b.floors;
    for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) ctx.fillRect(b.x + 10 + i * 30, b.y + 24 + j * 24, 15, 13);
    if (b.shop) {
      ctx.fillStyle = '#123c4d'; ctx.fillRect(b.x + 6, b.y + b.h - 24, b.w - 12, 18);
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 10px Verdana'; ctx.textAlign = 'center';
      ctx.fillText(b.shop, b.x + b.w / 2, b.y + b.h - 11);
    }
  }
  // Beach umbrellas.
  for (const u of city.umbrellas) {
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(u.x + 4, u.y + 5, 15, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = u.color; ctx.beginPath(); ctx.arc(u.x, u.y, 15, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.x, u.y + 12); ctx.stroke();
  }
  for (const palm of city.palms) drawPalmTree(ctx, palm, time);
  // Boats bobbing at the marina.
  for (const boat of city.boats) {
    const bob = Math.sin(time * 1.3 + boat.phase) * 3;
    ctx.save(); ctx.translate(boat.x, boat.y + bob); ctx.rotate(Math.sin(time * 0.7 + boat.phase) * 0.05);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.lineTo(13, 11); ctx.lineTo(-13, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = boat.color; ctx.fillRect(-12, -9, 24, 9);
    ctx.fillStyle = '#123c4d'; ctx.fillRect(2, -22, 3, 14);
    ctx.restore();
  }
}
