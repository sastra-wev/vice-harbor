// missions.js — Rico's five-job story for fixer Mara Voss: dialogue,
// objective stages, rewards, the gold coupe and the lighthouse finale.

import { distanceBetween } from './engine.js';
import { placeByName } from './city.js';
import { makeCrewGunman } from './combat.js';
import { makeGoldCoupe } from './vehicles.js';
import { clearPoliceHeat } from './police.js';

export const STORY_JOBS = [
  {
    title: 'First Run for Mara',
    giver: 'Mara Voss',
    reward: 150,
    intro: [
      ['Mara Voss', 'Rico Marlow. Heard you drive like the tide owes you money.'],
      ['Mara Voss', 'Take this parcel from Plaza Central and drop it at Café Sol. Quiet and quick.'],
    ],
    stages: [
      { kind: 'goto', place: 'Plaza Central', label: 'Pick up the parcel at Plaza Central' },
      { kind: 'goto', place: 'Café Sol', label: 'Deliver the parcel to Café Sol' },
    ],
    outro: [['Mara Voss', 'Clean work. Port Palmera might suit you, Rico.']],
  },
  {
    title: 'Parts for Tito',
    giver: 'Mara Voss',
    reward: 220,
    intro: [
      ['Mara Voss', 'Tito Salas at the garage needs boat parts off Marina Azul.'],
      ['Rico Marlow', 'Pick up at the marina, drop at Tito\'s Garage. On it.'],
    ],
    stages: [
      { kind: 'goto', place: 'Marina Azul', label: 'Pick up boat parts at Marina Azul' },
      { kind: 'goto', place: "Tito's Garage", label: "Deliver the parts to Tito's Garage" },
    ],
    outro: [['Tito Salas', 'These fit my fastest hull. Mara chose well.']],
  },
  {
    title: 'Heat on Palm Row',
    giver: 'Mara Voss',
    reward: 260,
    intro: [
      ['Mara Voss', 'Captain Lena Ortiz is watching Palm Row tonight. A pickup there will draw her patrols.'],
      ['Mara Voss', 'Grab the envelope, then lose the Harbor Patrol. However you can.'],
    ],
    stages: [
      { kind: 'goto', place: 'Palm Row', label: 'Grab the envelope at Palm Row', heat: 2 },
      { kind: 'escape', label: 'Lose the Harbor Patrol' },
    ],
    outro: [['Mara Voss', 'Ortiz is furious. That means you did it right.']],
  },
  {
    title: 'Palm Row Payback',
    giver: 'Mara Voss',
    reward: 340,
    intro: [
      ['Dario "Kite" Fen', 'My Palm Row crew runs this strip now, Marlow. Walk away.'],
      ['Rico Marlow', 'Mara sends her regards, Kite. All three of you — let\'s talk.'],
    ],
    stages: [
      { kind: 'goto', place: 'Palm Row', label: 'Confront the Palm Row crew' },
      { kind: 'defeat', place: 'Palm Row', count: 3, label: 'Defeat the Palm Row crew (3)' },
      { kind: 'goto', place: 'Café Sol', label: 'Report back at Café Sol' },
    ],
    outro: [['Mara Voss', 'Kite\'s crew is done. One last job, and it glitters.']],
  },
  {
    title: 'The Gold Coupe',
    giver: 'Mara Voss',
    reward: 500,
    intro: [
      ['Mara Voss', 'A marked gold coupe sits at Plaza Central. Steal it, bring it to Faro Pier.'],
      ['Mara Voss', 'Then vanish to the Old Lighthouse Point. After that, Port Palmera is yours.'],
    ],
    stages: [
      { kind: 'stealGold', place: 'Plaza Central', label: 'Steal the marked gold coupe at Plaza Central' },
      { kind: 'goto', place: 'Faro Pier', label: 'Deliver the gold coupe to Faro Pier', needsGold: true },
      { kind: 'goto', place: 'Old Lighthouse Point', label: 'Reach the Old Lighthouse Point' },
    ],
    outro: [['Mara Voss', 'Done, Rico. The harbor remembers its own. Free roam — enjoy Port Palmera.']],
  },
];

export class MissionRunner {
  constructor(game) {
    this.game = game;
    this.jobIndex = 0;
    this.stageIndex = 0;
    this.jobsCompleted = 0;
    this.active = false;
    this.stageHeatApplied = false;
    this.crewSpawned = false;
  }

  startJob(index) {
    const game = this.game;
    this.jobIndex = index;
    this.stageIndex = 0;
    this.stageHeatApplied = false;
    this.crewSpawned = false;
    this.active = index < STORY_JOBS.length;
    if (!this.active) {
      game.showBanner('Port Palmera is yours — free roam');
      return;
    }
    const job = STORY_JOBS[index];
    game.queueDialogue(job.intro);
    game.showBanner(`JOB ${index + 1}: ${job.title}`);
    this.prepareStage();
  }

  prepareStage() {
    const game = this.game;
    const stage = this.currentStage();
    if (!stage) return;
    this.stageHeatApplied = false;
    if (stage.kind === 'stealGold' && !game.goldCoupe) {
      const spot = placeByName(game.city, 'Plaza Central');
      game.goldCoupe = makeGoldCoupe(spot.x + 46, spot.y + 88);
    }
    if (stage.heat) {
      game.wanted = Math.max(game.wanted, stage.heat);
      this.stageHeatApplied = true;
      game.showBanner('The Harbor Patrol is on you!');
    }
  }

  currentJob() {
    return this.active ? STORY_JOBS[this.jobIndex] : null;
  }

  currentStage() {
    const job = this.currentJob();
    return job ? job.stages[this.stageIndex] : null;
  }

  currentObjective() {
    const game = this.game;
    const stage = this.currentStage();
    if (!stage) return null;
    if (stage.kind === 'escape') return { label: stage.label, x: null, y: null, distance: null };
    const place = placeByName(game.city, stage.place);
    const anchor = game.player.car || game.player;
    return {
      label: stage.label,
      x: place.x,
      y: place.y,
      distance: Math.round(distanceBetween(anchor.x, anchor.y, place.x, place.y) / 10),
    };
  }

  completeStage() {
    const game = this.game;
    const job = this.currentJob();
    game.audio.playPickup();
    this.stageIndex++;
    if (this.stageIndex >= job.stages.length) {
      this.completeJob();
    } else {
      game.showBanner('Objective updated');
      this.prepareStage();
    }
  }

  completeJob() {
    const game = this.game;
    const job = this.currentJob();
    game.money += job.reward;
    this.jobsCompleted++;
    game.audio.playCashReward();
    game.queueDialogue(job.outro);
    game.showBanner(`JOB DONE — +$${job.reward}`);
    const next = this.jobIndex + 1;
    game.onJobCompleted(next);
    this.startJob(next);
  }

  updateMissions(dt) {
    const game = this.game;
    const stage = this.currentStage();
    if (!stage || game.mode !== 'playing') return;
    void dt;
    const anchor = game.player.car || game.player;

    if (stage.kind === 'goto' || stage.kind === 'stealGold') {
      if (stage.needsGold && game.player.car !== game.goldCoupe) {
        // Must arrive in the gold coupe itself.
      } else if (stage.kind === 'stealGold') {
        if (game.player.car === game.goldCoupe && game.goldCoupe) this.completeStage();
        return;
      }
      const place = placeByName(game.city, stage.place);
      if (distanceBetween(anchor.x, anchor.y, place.x, place.y) < 78) {
        if (stage.needsGold && game.player.car !== game.goldCoupe) return;
        this.completeStage();
      }
      return;
    }
    if (stage.kind === 'escape') {
      if (game.wanted <= 0) this.completeStage();
      return;
    }
    if (stage.kind === 'defeat') {
      if (!this.crewSpawned) {
        this.crewSpawned = true;
        game.crewDefeated = 0;
        const place = placeByName(game.city, stage.place);
        game.enemies.push(makeCrewGunman(place.x - 60, place.y + 40, 'Kite lookout'));
        game.enemies.push(makeCrewGunman(place.x + 55, place.y - 35, 'Palm Row enforcer'));
        game.enemies.push(makeCrewGunman(place.x + 10, place.y + 85, 'Dario "Kite" Fen'));
        game.showBanner('The Palm Row crew opens fire!');
      }
      if (game.crewDefeated >= stage.count) {
        clearPoliceHeat(game);
        this.completeStage();
      }
    }
  }
}
