// save.js — localStorage progress: money, story job, position, wanted-free.

const SAVE_KEY = 'vice-harbor-port-palmera-save-v1';

export function loadSaveGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch (err) {
    void err;
    return null;
  }
}

export function storeSaveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    void err;
  }
}

export function wipeSaveGame() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    void err;
  }
}

export function snapshotProgress(game) {
  return {
    money: Math.round(game.money),
    jobIndex: game.missions.jobIndex,
    playerX: Math.round(game.player.x),
    playerY: Math.round(game.player.y),
    jobsDone: game.missions.jobsCompleted,
  };
}
