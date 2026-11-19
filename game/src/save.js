// save.js — Vice Harbor progress in localStorage: money, story position, health,
// position and the wanted reset, saved after every job and from the pause menu.

export const SAVE_KEY = 'vice-harbor-save-v1';

/** Serialize the parts of state that make up a save game. */
export function buildSaveData(state) {
  return {
    version: 1,
    money: state.player.money,
    hp: Math.round(state.player.hp),
    missionIndex: state.missionIndex,
    stepIndex: state.stepIndex,
    missionsDone: state.missionsDone,
    x: Math.round(state.player.x), y: Math.round(state.player.y),
    storyComplete: state.storyComplete,
    savedAt: 'Port Palmera',
  };
}

/** Write the save game. Returns true when storage accepted it. */
export function saveGameToStorage(state) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(buildSaveData(state))); return true; }
  catch { return false; }
}

/** Read the save game, or null when there is none / it is unreadable. */
export function loadGameFromStorage() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.version === 1 ? data : null;
  } catch { return null; }
}

/** True when a usable save game exists (drives the Continue button). */
export function hasSaveGame() { return loadGameFromStorage() !== null; }

/** Apply a loaded save onto a fresh state (story pieces are re-spawned by beginStep). */
export function applySaveData(state, data) {
  state.player.money = data.money | 0;
  state.player.hp = Math.max(20, Math.min(100, data.hp | 0));
  state.missionIndex = data.missionIndex | 0;
  state.stepIndex = data.stepIndex | 0;
  state.missionsDone = data.missionsDone | 0;
  state.player.x = data.x || state.player.x;
  state.player.y = data.y || state.player.y;
  state.storyComplete = !!data.storyComplete;
  state.wanted = 0; state.policeCars = []; state.bustMeter = 0;
}

/** Delete the save game (New Game). */
export function clearSaveGame() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ }
}
