# VICE HARBOR — an open-world crime game in Port Palmera

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/sastra-wev/vice-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/sastra-wev/vice-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Entry for the make.fun competition **[gta6-01 — "Make GTA 6"](https://make.fun/bounty/gta6-01)** ($1,666, deadline Tue 24 Nov 2026 22:00 WIB).

**Vice Harbor** is a complete open-world crime game that runs in a desktop browser from static files — no build step, no network requests. Vanilla JavaScript + Canvas 2D, top-down, in the bright tropical beach city of **Port Palmera**: sand, turquoise water, palms, pastel blocks and neon shop signs. Everything is original — city, characters, vehicles, story, art and music were invented for this game; nothing comes from any commercial game.

## The story

Rico Marlow washed up in Port Palmera with a duffel bag, a fake name and one contact: **Mara Voss**, the fixer who runs Marina Azul. Run her five jobs — a cooler run to Café Sol, a stolen police ledger under Captain **Lena Ortiz** and her Harbor Patrol, a street war with the Palm Row crew (Salvo, Bibi, Renzo), a gold coupe lift for **Tito Salas**, and a final showdown with **Dario "Kite" Fen** — and the harbor is yours.

## What is in the game

- **Open world** — a 2500×1900 city with a road grid, ~90 pastel buildings with shop signs, palm trees, a boardwalk, beach umbrellas, a marina with bobbing boats and animated water.
- **On foot & by car** — explore walking/sprinting, steal any parked or traffic car (E), drive it with real acceleration/steering, damage and smoke.
- **Traffic & pedestrians** — lane-following traffic that brakes for obstacles, and 30 pedestrians who stroll sidewalks, flee reckless drivers and get knocked down (a crime!).
- **Wanted system & police** — 1–5 stars for stealing, shooting, ramming and mission heat; Harbor Patrol cars spawn, chase, predict, ram and block; a bust meter fills when they corner you; heat cools when you break line of sight.
- **Missions & story** — 5 jobs with named characters, dialogue, varied objectives (deliver, pick up, lose the cops, defeat crews, steal & deliver a marked car, escape), cash rewards and progression.
- **Combat** — mouse-aimed pistol with tracers and muzzle flash, F melee, rival gunners who strafe, shoot back and brawl; health, damage feedback, WASTED/BUSTED end screens.
- **HUD & minimap** — money, health bar, vehicle status, wanted stars, bust meter, mission objective banner with distance, toasts, and a live minimap (roads, buildings, objective beacon, police, enemies, player).
- **Start screen, pause menu & save** — title screen with story intro and controls, pause menu (P/Esc), and localStorage save/load: Continue on the title screen, manual save in pause, autosave after every job.
- **Sound & music** — fully synthesized with the WebAudio API (no audio files): a tropical chord loop, engine hum that follows speed, sirens, gunshots, crashes, pickups and mission stingers. M mutes.
- **Polish** — smooth zooming follow camera, objective beacon + edge arrow, particles (sparks, smoke, splashes), hurt vignette, warm tropical colour grade.

## Controls

| Keys | Action |
|---|---|
| WASD / arrow keys | Move on foot / drive |
| E or Enter | Steal / enter / exit car |
| Shift | Sprint |
| Mouse | Aim |
| Mouse click (hold) | Shoot (on foot) |
| F | Melee attack |
| P / Esc | Pause menu (save / load / restart) |
| M | Mute / unmute |
| Space / click | Advance dialogue |

## Run it locally

```bash
node serve.ts            # serves game/ at http://localhost:8080
# or: python3 -m http.server -d game 8080
```

Open http://localhost:8080 in desktop Chrome. The game loads only files inside `game/` and makes no network requests.

Deterministic screenshot scenes (used for `screenshots/`): `?shot=chase`, `?shot=drive`, `?shot=walk`, `?shot=start` (with `&seed=7`) stage real game state — real traffic, real patrol AI, the real HUD.

## Hand-in program

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `vendor/makefun-game.ts` library (byte-for-byte the kit's copy).

## File structure

```
main.ts                  hand-in program (copies game/ + screenshots/, writes dossier.json)
serve.ts                 tiny local static server for game/
vendor/makefun-game.ts   make.fun dossier library (unchanged kit copy)
game/
  index.html             page, HUD DOM, menus, dialogue box
  style.css              UI chrome styling
  src/
    main.js              bootstrap, game loop, rendering, menus, shot staging calls
    engine.js            seeded RNG, math, smooth camera, input, particles
    city.js              Port Palmera: roads, buildings, beach, marina, drawing
    traffic.js           lane traffic AI
    pedestrians.js       sidewalk & boardwalk walkers
    vehicles.js          car physics, damage, drawing, steal/enter/exit
    player.js            Rico on foot: movement, aim, damage, healing
    police.js            wanted stars, Harbor Patrol chase AI, bust meter
    combat.js            shooting, melee, Palm Row rivals, bullets
    missions.js          Mara Voss's five-job story arc and objectives
    hud.js               HUD readouts, dialogue, toasts, minimap
    audio.js             WebAudio music & sound effects (synthesized)
    save.js              localStorage save / load
    shots.js             deterministic ?shot= screenshot scenes
screenshots/             4 real screenshots of the game running (cover = police chase)
```

## License

MIT — see `LICENSE` (first line: `SPDX-License-Identifier: MIT`).
