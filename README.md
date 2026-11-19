# VICE HARBOR — Port Palmera

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sastra-wev/vice-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sastra-wev/vice-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for the make.fun competition **gta6-01** — *Make GTA 6* ($1,666): https://make.fun/bounty/gta6-01

**Vice Harbor** is an original open-world crime game set in **Port Palmera**, a sun-soaked tropical harbor city of pastel blocks, palm-lined avenues, a boardwalk, a marina and one very patient lighthouse. No names, characters, maps, art or music from any commercial game — every street, face and chord here was invented for this entry.

## The story

Rico Marlow arrives with empty pockets. Fixer **Mara Voss** offers five jobs:

1. **First Run for Mara** — a parcel from Plaza Central to Café Sol.
2. **Parts for Tito** — boat parts from Marina Azul to Tito's Garage.
3. **Heat on Palm Row** — grab the envelope, then lose Captain **Lena Ortiz** and the Harbor Patrol.
4. **Palm Row Payback** — face down Dario "Kite" Fen and his crew, on foot, with a pistol.
5. **The Gold Coupe** — steal the marked gold coupe, deliver it to Faro Pier, and vanish to the Old Lighthouse Point.

Finish all five and Port Palmera is yours in free roam.

## What is in the game

- A 2600×2000 city to explore **on foot and by car**: six named districts, ~150 pastel buildings with shop signs, palms, beach, boardwalk, marina boats and a lighthouse.
- **Traffic AI** (17 drivers with lanes, braking and intersection turns) and **30 pedestrians** who stroll, flee gunfire — and count as a crime if you run one down.
- **Steal and drive** 26 parked cars plus moving traffic (pull a driver out with E), each with health, damage smoke and crash physics.
- **Wanted 1–5 stars**: the Harbor Patrol spawns on roads, predicts your line, rams and surrounds you; a **bust meter** fills if they pin you slow or on foot; heat cools when you break sight for good.
- **Combat**: mouse-aim pistol, F-key melee, crew gunmen who strafe and shoot back.
- **HUD + live minimap**: money, health, vehicle state, wanted stars, bust meter, mission banner naming the current district beside the job title, the objective and its distance, and a minimap with roads, water, buildings, traffic, police, objective diamond and camera box.
- **Start screen** with story and controls, **pause menu**, and **save/load** via localStorage with autosave after every completed job.
- **Sound and music synthesized live with WebAudio**: a tropical chord loop, an engine hum that follows your speed, near-patrol sirens, gunshots, crashes and reward chimes. M mutes.

## Controls

| Input | Action |
|---|---|
| WASD / arrow keys | Move on foot / drive |
| E | Enter, exit or steal a car |
| Shift | Sprint |
| Mouse | Aim |
| Left click | Shoot (on foot) / press menu buttons |
| F | Melee attack |
| M | Mute / unmute |
| P or Esc | Pause menu |

## Run it

The game is plain static files — no build step, no network requests:

```bash
node serve.ts            # then open http://localhost:8080
```

or serve `game/` with any static file server and open `index.html`.

## Hand in (maintainers)

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output folder and writes `dossier.json` with the vendored make.fun library (`vendor/makefun-game.ts`, unmodified).

## Source layout

- `game/src/engine.js` — loop, input, smooth camera
- `game/src/city.js` — Port Palmera: roads, buildings, beach, places, rendering
- `game/src/traffic.js` / `pedestrians.js` — everyday drivers and citizens
- `game/src/vehicles.js` / `player.js` — cars, stealing, Rico on foot
- `game/src/police.js` — wanted stars, pursuit, bust meter
- `game/src/combat.js` — pistol, melee, Palm Row crew
- `game/src/missions.js` — the five-job story
- `game/src/hud.js` — HUD, minimap, menus
- `game/src/audio.js` — WebAudio music and effects
- `game/src/save.js` — localStorage progress
- `game/src/shots.js` — deterministic `?shot=` scenes used for the screenshots

## License

MIT — see `LICENSE`.
