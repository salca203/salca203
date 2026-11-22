const SZ_GAMES = [];
const SZ_STORAGE_KEY = 'spielzentrale_state_v1';

const szState = loadSzState();
let activeGameId = null;
let activeCategory = 'Alle';
let activeCleanup = null;

function loadSzState() {
  try {
    const raw = localStorage.getItem(SZ_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      sound: parsed.sound !== false,
      reducedMotion: Boolean(parsed.reducedMotion),
      colorBlindAssist: Boolean(parsed.colorBlindAssist),
      records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {}
    };
  } catch {
    return { sound: true, reducedMotion: false, colorBlindAssist: false, records: {} };
  }
}

function saveSzState() {
  try {
    localStorage.setItem(SZ_STORAGE_KEY, JSON.stringify(szState));
  } catch {
    // Storage ggf. blockiert
  }
}

function $(tag, className = '', text = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== '') el.textContent = text;
  return el;
}

function R(max) {
  return Math.floor(Math.random() * max);
}

function registerGame(gameDef) {
  const idx = SZ_GAMES.findIndex((g) => g.id === gameDef.id);
  if (idx >= 0) SZ_GAMES[idx] = gameDef;
  else SZ_GAMES.push(gameDef);
}

function getGameRecord(gameId, profileKey = 'default') {
  const byGame = szState.records[gameId];
  if (!byGame || typeof byGame !== 'object') return { best: 0 };
  const entry = byGame[profileKey];
  return entry && typeof entry === 'object' ? { best: Number(entry.best) || 0 } : { best: 0 };
}

function saveGameRecord(gameId, score, profileKey = 'default') {
  const numScore = Number(score) || 0;
  if (!szState.records[gameId]) szState.records[gameId] = {};
  const prev = Number(szState.records[gameId][profileKey]?.best) || 0;
  const isNewBest = numScore > prev;
  szState.records[gameId][profileKey] = { best: Math.max(prev, numScore) };
  saveSzState();
  return isNewBest;
}

function makeRuntime() {
  const timers = new Set();
  const cleanups = new Set();

  return {
    later(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    },
    onCleanup(fn) {
      cleanups.add(fn);
    },
    cleanup() {
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      cleanups.forEach((fn) => {
        try { fn(); } catch {}
      });
      cleanups.clear();
    }
  };
}

const szSfx = (() => {
  let ctx = null;
  const getCtx = () => {
    if (!szState.sound || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  };
  const tone = (freq, duration = 0.08, type = 'sine', gainVal = 0.05) => {
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(gainVal, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration);
  };
  return {
    click: () => tone(520, 0.045, 'triangle', 0.04),
    hit: (streak = 1) => tone(Math.min(1100, 560 + streak * 45), 0.09, 'sine', 0.055),
    miss: () => tone(190, 0.14, 'sawtooth', 0.045),
    tick: (urgent = false) => tone(urgent ? 880 : 660, 0.04, 'square', 0.025)
  };
})();

function openGame(gameId) {
  if (typeof activeCleanup === 'function') {
    activeCleanup();
    activeCleanup = null;
  }
  activeGameId = gameId || null;
  renderShell();
}

function renderShell() {
  const root = document.getElementById('app');
  if (!root) return;
  root.innerHTML = '';

  const shell = $('div', 'sz-shell');
  const topbar = $('div', 'sz-topbar');

  const brand = $('div', 'sz-brand');
  brand.append($('span', '', '🎮'), $('span', '', 'SpielZentrale'));

  const controls = $('div', 'sz-top-controls');
  const soundBtn = $('button', 'sz-btn sz-btn-ghost', szState.sound ? '🔊 Ton: AN' : '🔇 Ton: AUS');
  soundBtn.type = 'button';
  soundBtn.onclick = () => {
    szState.sound = !szState.sound;
    saveSzState();
    renderShell();
  };

  const cbControl = createColorBlindProfileControl(() => {});
  controls.append(soundBtn, cbControl.el);
  topbar.append(brand, controls);
  shell.append(topbar);

  if (!activeGameId) {
    const categories = ['Alle', ...new Set(SZ_GAMES.map((g) => g.cat))];
    const filterBar = $('div', 'sz-filter-bar');
    categories.forEach((cat) => {
      const btn = $('button', 'sz-seg-btn' + (activeCategory === cat ? ' is-active' : ''), cat);
      btn.type = 'button';
      btn.onclick = () => {
        activeCategory = cat;
        renderShell();
      };
      filterBar.append(btn);
    });
    shell.append(filterBar);

    const grid = $('div', 'sz-hub-grid');
    const filtered = activeCategory === 'Alle'
      ? SZ_GAMES
      : SZ_GAMES.filter((g) => g.cat === activeCategory);

    filtered.forEach((game) => {
      const card = $('button', 'sz-game-card');
      card.type = 'button';

      const top = $('div', 'sz-card-top');
      top.append($('span', 'sz-card-icon', game.icon), $('span', 'sz-card-cat', game.cat));

      const best = getGameRecord(game.id, 'sprint_normal').best || 0;
      const meta = $('div', 'sz-card-desc', best > 0 ? `Rekord (Standard): ${best} Pkt` : 'Noch kein Rekord');

      card.append(
        top,
        $('div', 'sz-card-title', game.title),
        $('div', 'sz-card-desc', game.desc),
        meta
      );
      card.onclick = () => {
        szSfx.click();
        openGame(game.id);
      };
      grid.append(card);
    });

    shell.append(grid);
    root.append(shell);
    return;
  }

  const game = SZ_GAMES.find((g) => g.id === activeGameId);
  if (!game) {
    activeGameId = null;
    renderShell();
    return;
  }

  const panel = $('div', 'sz-game-panel');
  const head = $('div', 'sz-game-head');
  const title = $('h1', 'sz-game-title', `${game.icon} ${game.title}`);
  const backBtn = $('button', 'sz-btn', '← Übersicht');
  backBtn.type = 'button';
  backBtn.onclick = () => {
    szSfx.click();
    openGame(null);
  };
  head.append(title, backBtn);

  const body = $('div', 'sz-game-body');
  const status = $('div', 'sz-status-line', '');
  panel.append(head, body, status);
  shell.append(panel);
  root.append(shell);

  if (typeof game.run === 'function') {
    game.run({ body, status, game });
  }
}
