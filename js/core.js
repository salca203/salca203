// ==========================================
// SPIELEZIMMER – CORE (DOM, ZUFALL, RUNTIME & STATE)
// ==========================================

const SZ_STORAGE_KEY = 'sz_platform_v1';

const SZ_DEFAULT_STATE = {
  muted: false,
  colorblind: 'off', // 'off' | 'rg' | 'by'
  lastPlayedId: null,
  favorites: [],
  sortMode: 'default',
  records: {}
};

function readSzState() {
  try {
    const raw = JSON.parse(localStorage.getItem(SZ_STORAGE_KEY) || 'null');
    if (!raw || typeof raw !== 'object') {
      return JSON.parse(JSON.stringify(SZ_DEFAULT_STATE));
    }
    return {
      muted: Boolean(raw.muted),
      colorblind: ['off', 'rg', 'by'].includes(raw.colorblind) ? raw.colorblind : 'off',
      lastPlayedId: typeof raw.lastPlayedId === 'string' ? raw.lastPlayedId : null,
      favorites: Array.isArray(raw.favorites)
        ? [...new Set(raw.favorites.filter((x) => typeof x === 'string'))]
        : [],
      sortMode: ['default', 'favorites', 'record', 'title'].includes(raw.sortMode)
        ? raw.sortMode
        : 'default',
      records: raw.records && typeof raw.records === 'object' ? raw.records : {}
    };
  } catch {
    return JSON.parse(JSON.stringify(SZ_DEFAULT_STATE));
  }
}

const szState = readSzState();

function writeSzState() {
  try {
    localStorage.setItem(SZ_STORAGE_KEY, JSON.stringify(szState));
  } catch {}
}

function $(tag, className = '', text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== '' && text !== null && text !== undefined) {
    el.textContent = String(text);
  }
  return el;
}

function R(max) {
  return Math.floor(Math.random() * max);
}

function pulseEl(el, cls = 'pop') {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function makeRuntime() {
  const timers = new Set();
  const intervals = new Set();

  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const every = (fn, ms) => {
    const id = setInterval(fn, ms);
    intervals.add(id);
    return id;
  };

  const cleanup = () => {
    for (const id of timers) clearTimeout(id);
    for (const id of intervals) clearInterval(id);
    timers.clear();
    intervals.clear();
  };

  return { later, every, cleanup };
}

function getGameRecord(gameId, profileKey) {
  const entry = szState.records?.[gameId]?.[profileKey];
  return entry && typeof entry === 'object'
    ? { ...entry }
    : { best: 0, bestMoves: null, played: false };
}

function saveGameRecord(gameId, profileKey, patch) {
  if (!szState.records[gameId]) szState.records[gameId] = {};
  const prev = getGameRecord(gameId, profileKey);
  szState.records[gameId][profileKey] = { ...prev, ...patch, played: true };
  writeSzState();
  return szState.records[gameId][profileKey];
}

function getBestScoreForGame(gameId) {
  const map = szState.records?.[gameId];
  if (!map || typeof map !== 'object') return { best: 0, bestMoves: null, played: false };
  let best = 0;
  let bestMoves = null;
  let played = false;

  for (const rec of Object.values(map)) {
    if (!rec || typeof rec !== 'object') continue;
    if (rec.played || rec.best > 0 || typeof rec.bestMoves === 'number') played = true;
    if (typeof rec.best === 'number' && rec.best > best) best = rec.best;
    if (typeof rec.bestMoves === 'number') {
      bestMoves = bestMoves === null ? rec.bestMoves : Math.min(bestMoves, rec.bestMoves);
    }
  }
  return { best, bestMoves, played };
}

function resetAllRecords() {
  szState.records = {};
  szState.lastPlayedId = null;
  writeSzState();
}

function toggleFavorite(gameId) {
  if (!gameId) return false;
  const idx = szState.favorites.indexOf(gameId);
  let active = false;
  if (idx >= 0) {
    szState.favorites.splice(idx, 1);
    active = false;
  } else {
    szState.favorites.push(gameId);
    active = true;
  }
  writeSzState();
  return active;
}

function isFavorite(gameId) {
  return szState.favorites.includes(gameId);
}

function applyColorBlindMode(mode = szState.colorblind) {
  const safe = ['off', 'rg', 'by'].includes(mode) ? mode : 'off';
  szState.colorblind = safe;
  writeSzState();

  if (typeof document !== 'undefined' && document.documentElement) {
    if (safe === 'off') {
      document.documentElement.removeAttribute('data-colorblind');
    } else {
      document.documentElement.setAttribute('data-colorblind', safe);
    }
  }
  return safe;
}

applyColorBlindMode(szState.colorblind);

const SZ_GAMES = [];
let activeCleanup = null;
let openGame = null;

function registerGame(game) {
  if (!game || !game.id || typeof game.run !== 'function') return;
  const existingIdx = SZ_GAMES.findIndex((g) => g.id === game.id);
  if (existingIdx >= 0) SZ_GAMES[existingIdx] = game;
  else SZ_GAMES.push(game);
}
