// Vice Harbor — hand-in program for the make.fun gta6-01 bounty.
//
// The game itself is the plain static site in game/ (open game/index.html in a
// browser and it plays, no build step, no network). This program's only job is
// delivery: mirror game/ and screenshots/ into the output folder and stamp the
// folder with dossier.json, produced by the vendored make.fun dossier library
// so the grader rebuilds exactly the same bytes.
//
// Local dry run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for the grader's /output.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Caps mirrored from the gate: at most 4 screenshots of 256 KiB each, at most
// 993 entries / 48 MiB under game/, no game path longer than 1000 bytes, and
// the dossier's source text truncated at 160 KiB.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
