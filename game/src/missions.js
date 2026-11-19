// missions.js — Mara Voss's five-job story arc for Rico Marlow: objectives,
// dialogue, rival crews, the marked car, rewards and progression.

import { PLACES } from './city.js';
import { distanceBetween } from './engine.js';
import { playerPosition } from './player.js';
import { spawnEnemyGroup } from './combat.js';
import { createCar } from './vehicles.js';

/**
 * The story. Each mission is a list of steps; a step is one objective:
 * goto (reach a place), pickup (reach on foot), defeat (beat named rivals),
 * stealTarget (enter the gold-ringed car), deliverCar (drive it somewhere),
 * loseCops (wanted must reach 0), escape (reach a place with any wanted).
 * Dialogue lines play when the step starts.
 */
export const MISSIONS = [
  {
    title: 'Job 1 · First Run',
    reward: 120,
    steps: [
      { type: 'goto', place: 'marina', text: 'Meet Mara Voss at Marina Azul', dialogue: [
        ['Mara Voss', 'Rico Marlow. You look like a man who owes the sea money. Good — I pay cash.'],
        ['Mara Voss', 'A cooler by the marina office. Pick it up, no questions, and my world opens for you.'],
      ] },
      { type: 'pickup', place: 'marina', text: 'Pick up the cooler at Marina Azul', dialogue: [
        ['Rico Marlow', 'Heavy cooler. Ice, fish… and something that ticks. Sure. No questions.'],
      ] },
      { type: 'goto', place: 'cafe', text: 'Deliver the cooler to Café Sol', dialogue: [
        ['Mara Voss', 'Café Sol, uptown. The owner pays on sight. Try not to collect stars on the way.'],
      ] },
    ],
    outro: [['Mara Voss', 'Clean run. You just earned Port Palmera money, Rico. There is more where that came from.']],
  },
  {
    title: 'Job 2 · Harbor Heat',
    reward: 200,
    steps: [
      { type: 'goto', place: 'plaza', text: 'Collect the ledger at Plaza Central', dialogue: [
        ['Mara Voss', 'A ledger sits in a Plaza Central kiosk. It names every bribe in the harbor — including Patrol ones.'],
        ['Rico Marlow', 'So Captain Ortiz will be thrilled to see me carrying it.'],
      ] },
      { type: 'pickup', place: 'plaza', text: 'Grab the ledger (on foot)', heatOnPickup: 2, dialogue: [
        ['Radio', 'Harbor Patrol to all units — suspect has the ledger. Captain Ortiz wants him boxed in.'],
      ] },
      { type: 'loseCops', text: 'Lose the Harbor Patrol', dialogue: [
        ['Mara Voss', 'Shake them, Rico! Break their line of sight and let the heat die down.'],
      ] },
      { type: 'goto', place: 'hideout', text: 'Reach the Old Lighthouse Point', dialogue: [
        ['Mara Voss', 'Good. Bring it to the lighthouse point, north-east. And Rico — stay breathing.'],
      ] },
    ],
    outro: [['Mara Voss', 'Ortiz is furious, which means the ledger is real gold. Two jobs down, Rico.']],
  },
  {
    title: 'Job 3 · Palm Row Rivals',
    reward: 320,
    steps: [
      { type: 'goto', place: 'palmRow', text: 'Go to Palm Row', dialogue: [
        ['Mara Voss', 'The Palm Row crew — Salvo, Bibi and Renzo — tax my boats now. Untax them. Permanently.'],
      ] },
      { type: 'defeat', place: 'palmRow', names: ['Salvo', 'Bibi', 'Renzo'], text: 'Defeat the Palm Row crew (3)', dialogue: [
        ['Salvo', 'Wrong street, tourist. Palm Row collects from everybody — even ghosts.'],
      ] },
    ],
    outro: [['Mara Voss', 'Palm Row is quiet again. My boats move free, and your name just got heavier.']],
  },
  {
    title: 'Job 4 · The Night Ledger',
    reward: 450,
    steps: [
      { type: 'goto', place: 'garage', text: "Meet Tito Salas at Tito's Garage", dialogue: [
        ["Tito Salas", 'Rico! A gold Solana Coupe by the plaza holds a second ledger in its boot. Lift it for me, amigo.'],
      ] },
      { type: 'stealTarget', place: 'plaza', text: 'Steal the gold Solana Coupe at Plaza Central', dialogue: [
        ['Rico Marlow', 'Gold paint, tinted glass, terrible owner. Perfect. E to steal it.'],
      ] },
      { type: 'deliverCar', place: 'garage', text: "Deliver the coupe to Tito's Garage", heatOnSteal: 2, dialogue: [
        ['Radio', 'All units — gold coupe leaving Plaza Central. Ortiz: "That car does not reach the garage."'],
      ] },
    ],
    outro: [["Tito Salas", 'Beautiful driving, amigo. The garage is yours whenever you need wheels.']],
  },
  {
    title: 'Job 5 · Harbor King',
    reward: 800,
    steps: [
      { type: 'goto', place: 'palmRow', text: 'Face Dario "Kite" Fen at Palm Row', dialogue: [
        ['Mara Voss', 'Last job. Kite Fen runs Palm Row now, and he put a price on your head, Rico. End it.'],
      ] },
      { type: 'defeat', place: 'palmRow', names: ['Pico', 'Lulu', 'Dario "Kite" Fen'], toughLast: true, text: 'Defeat Kite Fen and his crew (3)', dialogue: [
        ['Dario "Kite" Fen', 'Marlow! The harbor has one king, and he is not some washed-up errand boy.'],
      ] },
      { type: 'escape', place: 'pier', text: 'Escape to Faro Pier', heatOnDefeat: 3, dialogue: [
        ['Mara Voss', 'Kite is done — but every patrol car in Palmera is rolling. Get to Faro Pier, NOW.'],
      ] },
    ],
    outro: [
      ['Mara Voss', 'The docks are ours, Rico. Port Palmera has a new name on the harbor wall…'],
      ['Rico Marlow', 'Vice Harbor, Mara. From today, they call this place by our name.'],
    ],
  },
];

/** The step Rico is currently on, or null when the story is finished. */
export function currentStep(state) {
  const mission = MISSIONS[state.missionIndex];
  if (!mission) return null;
  return mission.steps[state.stepIndex] || null;
}

/** The mission object Rico is currently running, or null. */
export function currentMission(state) { return MISSIONS[state.missionIndex] || null; }

/** World position of the current objective, or null. */
export function objectivePosition(state) {
  const step = currentStep(state);
  if (!step || !step.place) return null;
  if (step.type === 'stealTarget' && state.targetCar) return { x: state.targetCar.x, y: state.targetCar.y };
  return PLACES[step.place];
}

/** Start a step: play its dialogue and set up its world pieces (rivals, target car). */
export function beginStep(state) {
  const step = currentStep(state);
  if (!step) return;
  if (step.dialogue) state.showDialogue(step.dialogue, null);
  if (step.type === 'defeat') {
    state.missionEnemies = spawnEnemyGroup(state, PLACES[step.place].x + 90, PLACES[step.place].y + 40, step.names, step.toughLast);
  }
  if (step.type === 'stealTarget' && !state.targetCar) {
    const car = createCar(PLACES.plaza.x + 60, PLACES.plaza.y - 130, 0, '#ffd23f', 'parked', state.rng);
    car.isTargetCar = true; car.name = 'Solana Coupe (gold)';
    state.targetCar = car;
    state.parkedCars.push(car);
  }
}

/** Finish the current mission: pay Rico, toast, autosave, queue the next job. */
export function completeMission(state) {
  const mission = currentMission(state);
  if (!mission) return;
  state.player.money += mission.reward;
  state.missionsDone += 1;
  state.showToast(mission.title + ' complete  +$' + mission.reward);
  state.audio.playMissionCompleteSound();
  state.showDialogue(mission.outro, () => {
    state.missionIndex += 1; state.stepIndex = 0;
    state.saveGame();
    if (state.missionIndex >= MISSIONS.length) state.onStoryComplete();
    else beginStep(state);
  });
}

/** Move to the next step of the mission, or finish the mission. */
export function advanceStep(state) {
  const mission = currentMission(state);
  state.stepIndex += 1;
  state.audio.playPickupSound();
  if (state.stepIndex >= mission.steps.length) completeMission(state);
  else beginStep(state);
}

/** Check the current objective against the world; advance when it is met. */
export function updateMissions(state, dt) {
  const step = currentStep(state);
  if (!step || state.dialogueQueue) return;
  const p = playerPosition(state);
  const place = step.place ? PLACES[step.place] : null;
  switch (step.type) {
    case 'goto':
    case 'escape':
      if (place && distanceBetween(p.x, p.y, place.x, place.y) < 78) {
        if (step.type === 'escape' && step.heatOnDefeat) { /* heat already applied */ }
        advanceStep(state);
      }
      break;
    case 'pickup':
      if (place && !state.player.car && distanceBetween(p.x, p.y, place.x, place.y) < 46) {
        if (step.heatOnPickup) state.commitCrime(step.heatOnPickup, 'Ledger taken');
        advanceStep(state);
      }
      break;
    case 'defeat': {
      const alive = (state.missionEnemies || []).filter((e) => !e.dead).length;
      state.objectiveCount = alive;
      if (alive === 0 && state.missionEnemies) {
        state.missionEnemies = null;
        if (step.heatOnDefeat) state.commitCrime(step.heatOnDefeat, 'Kite Fen down');
        advanceStep(state);
      }
      break;
    }
    case 'stealTarget':
      if (state.targetCar && state.player.car === state.targetCar) {
        if (step.heatOnSteal || currentMission(state).steps[state.stepIndex + 1]?.heatOnSteal) { /* handled below */ }
        advanceStep(state);
      }
      break;
    case 'deliverCar':
      if (place && state.player.car === state.targetCar && distanceBetween(p.x, p.y, place.x, place.y) < 96) {
        // Hand the coupe over: it stays at the garage as Tito's trophy.
        const car = state.targetCar;
        state.player.car = null; car.kind = 'parked'; car.isTargetCar = false; car.speed = 0;
        if (!state.parkedCars.includes(car)) state.parkedCars.push(car);
        state.player.x = car.x + 40; state.player.y = car.y + 20;
        state.targetCar = null;
        advanceStep(state);
      }
      break;
    case 'loseCops':
      if (state.wanted === 0) advanceStep(state);
      break;
    default:
      break;
  }
  // The steal step's heat lands when the NEXT step (deliverCar) begins with heatOnSteal.
  const now = currentStep(state);
  if (now && now.type === 'deliverCar' && now.heatOnSteal && !now.heatApplied) {
    now.heatApplied = true;
    state.commitCrime(now.heatOnSteal, 'Stolen coupe');
  }
}

/** A short "what now" line for the HUD when between story beats. */
export function freeRoamObjectiveText(state) {
  if (state.missionIndex >= MISSIONS.length) return 'Story complete — Port Palmera is yours. Free roam!';
  return 'Follow the gold beacon';
}
