const GAMES = [];
const ROADMAP = [];
const SZ_SAVE_KEY = 'spielezimmer_save_v1';

const $ = (tag, cls, html) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (html !== undefined && html !== null) el.innerHTML = html;
  return el;
};

const R = (n) => Math.floor(Math.random() * n);

function registerGame(def) {
  if (!def || !def.id || typeof def.run !== 'function') return;
  const idx = GAMES.findIndex((g) => g.id === def.id);
  if (idx >= 0) GAMES[idx] = def;
  else GAMES.push(def);
}

function attachCleanListener(target, type, handler, options) {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  target.addEventListener(type, handler, options);
  return () => {
    try {
      target.removeEventListener(type, handler, options);
    } catch (_) {}
  };
}

function makeRuntime() {
  let rafId = null;
  const timers = new Set();
  const cleanups = [];

  const trackRaf = (id) => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = id;
    return id;
  };

  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  };

  const on = (target, type, handler, opts) => {
    const off = attachCleanListener(target, type, handler, opts);
    cleanups.push(off);
    return off;
  };

  const cleanup = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
    while (cleanups.length) {
      const fn = cleanups.pop();
      try { fn(); } catch (_) {}
    }
  };

  return { trackRaf, later, on, cleanup };
}

function makeArcadeCanvasRuntime() {
  const base = makeRuntime();
  const keys = Object.create(null);

  const bindKeys = (watchedKeys, onPress) => {
    const watched = new Set(watchedKeys || []);
    base.on(window, 'keydown', (e) => {
      if (watched.size && !watched.has(e.key)) return;
      if (watched.size) e.preventDefault();
      const firstPress = !keys[e.key];
      keys[e.key] = true;
      if (typeof onPress === 'function') onPress(e, firstPress);
    });
    base.on(window, 'keyup', (e) => {
      if (watched.size && !watched.has(e.key)) return;
      keys[e.key] = false;
    });
    base.on(window, 'blur', () => {
      Object.keys(keys).forEach((k) => { keys[k] = false; });
    });
  };

  const cleanup = () => {
    Object.keys(keys).forEach((k) => { keys[k] = false; });
    base.cleanup();
  };

  return {
    trackRaf: base.trackRaf,
    later: base.later,
    on: base.on,
    keys,
    bindKeys,
    cleanup
  };
}

function readAllSaves() {
  try {
    const raw = localStorage.getItem(SZ_SAVE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function writeAllSaves(all) {
  try {
    localStorage.setItem(SZ_SAVE_KEY, JSON.stringify(all));
  } catch (_) {}
}

function saveGameProgress(gameId, data) {
  const all = readAllSaves();
  all[gameId] = {
    updatedAt: Date.now(),
    data
  };
  writeAllSaves(all);
}

function loadGameProgress(gameId, fallback = null) {
  const all = readAllSaves();
  if (all[gameId] && Object.prototype.hasOwnProperty.call(all[gameId], 'data')) {
    return all[gameId].data;
  }
  return fallback;
}

function clearGameProgress(gameId) {
  const all = readAllSaves();
  delete all[gameId];
  writeAllSaves(all);
}

function clearAllGameProgress() {
  try {
    localStorage.removeItem(SZ_SAVE_KEY);
  } catch (_) {}
}

function resetSingleGameProgress(gameId) {
  if (!gameId) return;
  clearGameProgress(gameId);
  const stage = document.getElementById('sz-stage');
  if (stage && !stage.classList.contains('hidden') && stage.dataset.activeGameId === gameId && typeof openGame === 'function') {
    openGame(gameId);
  }
}
