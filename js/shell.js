// ==========================================
// SPIELEZIMMER – SHELL (AUDIO, LOBBY, FILTER & BÜHNE)
// ==========================================

let szAudioCtx = null;

function ensureAudioCtx() {
  if (szState.muted) return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!szAudioCtx) szAudioCtx = new Ctx();
  if (szAudioCtx.state === 'suspended') szAudioCtx.resume().catch(() => {});
  return szAudioCtx;
}

function playTone({ freq = 440, endFreq = null, duration = 0.08, type = 'sine', volume = 0.07, delay = 0 }) {
  if (szState.muted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;

  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (endFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + Math.min(0.015, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

const szSfx = {
  click: () => playTone({ freq: 520, endFreq: 380, duration: 0.045, type: 'triangle', volume: 0.05 }),
  hit: (streak = 0) => {
    const boost = Math.min(260, Math.max(0, streak) * 22);
    playTone({ freq: 440 + boost, endFreq: 660 + boost, duration: 0.09, type: 'sine', volume: 0.075 });
  },
  miss: () => playTone({ freq: 210, endFreq: 125, duration: 0.14, type: 'sawtooth', volume: 0.05 }),
  tick: (urgent = false) => playTone({
    freq: urgent ? 880 : 620,
    endFreq: urgent ? 880 : 620,
    duration: 0.04,
    type: 'sine',
    volume: urgent ? 0.06 : 0.03
  }),
  record: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((n, i) => {
      playTone({ freq: n, endFreq: n * 1.02, duration: 0.13, type: 'triangle', volume: 0.075, delay: i * 0.075 });
    });
  },
  gameover: () => {
    playTone({ freq: 392, endFreq: 293.66, duration: 0.16, type: 'sine', volume: 0.055, delay: 0 });
    playTone({ freq: 293.66, endFreq: 220, duration: 0.22, type: 'sine', volume: 0.055, delay: 0.13 });
  }
};

function getDailyGame() {
  if (!SZ_GAMES.length) return null;
  const now = new Date();
  const seed = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SZ_GAMES[h % SZ_GAMES.length];
}

function renderShell() {
  const app = document.getElementById('sz-app');
  if (!app) return;

  let currentView = 'lobby';
  let activeGameId = null;
  let searchQuery = '';
  let activeCat = 'Alle';
  let activeStatus = 'all'; // 'all' | 'record' | 'unplayed' | 'fav'

  const runCleanup = () => {
    if (typeof activeCleanup === 'function') {
      activeCleanup();
      activeCleanup = null;
    }
  };

  openGame = (gameId) => {
    const game = SZ_GAMES.find((g) => g.id === gameId);
    if (!game) return;
    runCleanup();
    currentView = 'game';
    activeGameId = game.id;
    szState.lastPlayedId = game.id;
    writeSzState();
    render();
  };

  const openLobby = () => {
    runCleanup();
    currentView = 'lobby';
    activeGameId = null;
    render();
  };

  function render() {
    app.innerHTML = '';

    // Topbar
    const topbar = $('header', 'sz-topbar');
    const brand = $('div', 'sz-brand');
    brand.append($('span', 'sz-card-icon', '🕹️'), $('h1', 'sz-brand-title', 'Spielezimmer'));

    const toolbar = $('div', 'sz-toolbar');
    const muteBtn = $('button', 'sz-btn sz-btn-ghost', szState.muted ? '🔇 Ton aus' : '🔊 Ton an');
    muteBtn.type = 'button';
    muteBtn.onclick = () => {
      szState.muted = !szState.muted;
      writeSzState();
      if (!szState.muted) {
        ensureAudioCtx();
        szSfx.click();
      }
      render();
    };
    toolbar.append(muteBtn);

    if (currentView === 'game') {
      const backBtn = $('button', 'sz-btn sz-btn-primary', '← Lobby');
      backBtn.type = 'button';
      backBtn.onclick = () => {
        szSfx.click();
        openLobby();
      };
      toolbar.append(backBtn);
    }

    topbar.append(brand, toolbar);
    app.append(topbar);

    if (currentView === 'game') {
      const game = SZ_GAMES.find((g) => g.id === activeGameId);
      if (!game) {
        openLobby();
        return;
      }

      const stageShell = $('main', 'sz-stage-shell');
      const stageHeader = $('div', 'sz-stage-header');
      stageHeader.append($('h2', 'sz-stage-title', `${game.icon || '🎮'} ${game.title}`));

      const favBtn = $('button', 'sz-btn sz-btn-ghost sz-fav-btn' + (isFavorite(game.id) ? ' is-fav' : ''), isFavorite(game.id) ? '★ Favorit' : '☆ Favorit');
      favBtn.type = 'button';
      favBtn.onclick = () => {
        szSfx.click();
        toggleFavorite(game.id);
        render();
      };
      stageHeader.append(favBtn);

      const stageBody = $('div', 'sz-stage-body');
      const statusBar = $('div', 'sz-status', 'Bereit');
      stageShell.append(stageHeader, stageBody, statusBar);
      app.append(stageShell);

      game.run({ body: stageBody, status: statusBar });
      return;
    }

    // Lobby-Ansicht: Spiel des Tages + Rekord-Übersicht + Farbenblind-Schalter
    const potd = getDailyGame();
    let playedCount = 0;
    let totalBest = 0;
    const recByGame = {};
    for (const g of SZ_GAMES) {
      const r = getBestScoreForGame(g.id);
      recByGame[g.id] = r;
      if (r.played) playedCount++;
      if (r.best > 0) totalBest += r.best;
    }

    const hubBar = $('section', 'sz-hub-bar');
    const potdBox = $('div', 'sz-hub-potd');
    potdBox.append(
      $('span', 'sz-hub-potd-label', '📅 Spiel des Tages'),
      $('div', 'sz-hub-potd-title', potd ? `${potd.icon || '🎮'} ${potd.title}` : '—')
    );

    const statsBox = $('div', 'sz-hub-stats');
    statsBox.append(
      $('span', 'sz-sc-pill', `🎮 Gespielt: ${playedCount}/${SZ_GAMES.length}`),
      $('span', 'sz-sc-pill', `🏆 Rekord-Summe: ${totalBest}`)
    );

    const actionsBox = $('div', 'sz-hub-actions');
    if (potd) {
      const potdBtn = $('button', 'sz-btn sz-btn-primary', '▶ Heute spielen');
      potdBtn.type = 'button';
      potdBtn.onclick = () => {
        szSfx.click();
        openGame(potd.id);
      };
      actionsBox.append(potdBtn);
    }

    let armed = false;
    const resetBtn = $('button', 'sz-btn sz-btn-ghost sz-btn-danger-soft', '🗑 Rekorde löschen');
    resetBtn.type = 'button';
    resetBtn.onclick = () => {
      if (!armed) {
        armed = true;
        szSfx.click();
        resetBtn.textContent = '⚠ Wirklich löschen?';
        setTimeout(() => {
          armed = false;
          if (resetBtn.isConnected) resetBtn.textContent = '🗑 Rekorde löschen';
        }, 3500);
        return;
      }
      szSfx.miss();
      resetAllRecords();
      render();
    };
    actionsBox.append(resetBtn);
    hubBar.append(potdBox, statsBox, actionsBox);
    app.append(hubBar);

    // Zuletzt gespielt
    if (szState.lastPlayedId) {
      const lastGame = SZ_GAMES.find((g) => g.id === szState.lastPlayedId);
      if (lastGame) {
        const recent = $('div', 'sz-recent-strip');
        const resumeLastBtn = $('button', 'sz-btn sz-btn-ghost', '↻ Weiter spielen');
        resumeLastBtn.type = 'button';
        resumeLastBtn.onclick = () => {
          szSfx.click();
          openGame(lastGame.id);
        };
        recent.append(
          $('span', 'sz-recent-label', `🕘 Zuletzt gespielt: ${lastGame.icon || '🎮'} ${lastGame.title}`),
          resumeLastBtn
        );
        app.append(recent);
      }
    }

    // Profil: Farbenblind-Modus
    const cbCtrl = createColorBlindProfileControl(() => render());
    app.append(cbCtrl.el);

    // Filter & Sortierung
    const filterBar = $('section', 'sz-filter-bar');
    const topRow = $('div', 'sz-filter-row');
    const searchInput = $('input', 'sz-search-input');
    searchInput.type = 'search';
    searchInput.value = searchQuery;
    searchInput.placeholder = 'Spiel suchen…';
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      renderList();
    };

    const clearBtn = $('button', 'sz-btn sz-btn-ghost', '✕ Filter zurücksetzen');
    clearBtn.type = 'button';
    clearBtn.onclick = () => {
      szSfx.click();
      searchQuery = '';
      activeCat = 'Alle';
      activeStatus = 'all';
      render();
    };
    topRow.append(searchInput, clearBtn);

    const cats = ['Alle', ...new Set(SZ_GAMES.map((g) => g.cat).filter(Boolean))];
    const catGroup = $('div', 'sz-mode-group');
    cats.forEach((c) => {
      const b = $('button', 'sz-mode-chip' + (c === activeCat ? ' active' : ''), c);
      b.type = 'button';
      b.onclick = () => {
        szSfx.click();
        activeCat = c;
        render();
      };
      catGroup.append(b);
    });

    const statusDefs = [
      { id: 'all', label: 'Alle' },
      { id: 'fav', label: '★ Favoriten' },
      { id: 'record', label: '🏆 Mit Rekord' },
      { id: 'unplayed', label: '✨ Ungespielt' }
    ];
    const stGroup = $('div', 'sz-mode-group');
    statusDefs.forEach((s) => {
      const b = $('button', 'sz-mode-chip' + (s.id === activeStatus ? ' active' : ''), s.label);
      b.type = 'button';
      b.onclick = () => {
        szSfx.click();
        activeStatus = s.id;
        render();
      };
      stGroup.append(b);
    });

    const sortDefs = [
      { id: 'default', label: 'Katalog' },
      { id: 'favorites', label: '★ Favoriten' },
      { id: 'record', label: '🏆 Rekord' },
      { id: 'title', label: 'A–Z' }
    ];
    const sortGroup = $('div', 'sz-mode-group');
    sortGroup.append($('span', 'sz-sort-label', 'Sortierung:'));
    sortDefs.forEach((sd) => {
      const b = $('button', 'sz-mode-chip' + (sd.id === szState.sortMode ? ' active' : ''), sd.label);
      b.type = 'button';
      b.onclick = () => {
        szSfx.click();
        szState.sortMode = sd.id;
        writeSzState();
        render();
      };
      sortGroup.append(b);
    });

    filterBar.append(topRow, catGroup, stGroup, sortGroup);
    app.append(filterBar);

    const grid = $('section', 'sz-grid');
    app.append(grid);

    function renderList() {
      grid.innerHTML = '';
      const q = searchQuery.trim().toLowerCase();

      let list = SZ_GAMES.filter((g) => {
        if (activeCat !== 'Alle' && g.cat !== activeCat) return false;
        const r = recByGame[g.id] || { best: 0, played: false };
        if (activeStatus === 'fav' && !isFavorite(g.id)) return false;
        if (activeStatus === 'record' && !(r.best > 0 || r.bestMoves !== null)) return false;
        if (activeStatus === 'unplayed' && r.played) return false;
        if (!q) return true;
        return `${g.title} ${g.cat || ''} ${g.desc || ''}`.toLowerCase().includes(q);
      });

      if (szState.sortMode === 'title') {
        list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'de'));
      } else if (szState.sortMode === 'favorites') {
        list = [...list].sort((a, b) => Number(isFavorite(b.id)) - Number(isFavorite(a.id)));
      } else if (szState.sortMode === 'record') {
        list = [...list].sort((a, b) => (recByGame[b.id]?.best || 0) - (recByGame[a.id]?.best || 0));
      }

      if (!list.length) {
        const empty = $('div', 'sz-empty-state');
        const btn = $('button', 'sz-btn sz-btn-ghost', 'Filter zurücksetzen');
        btn.type = 'button';
        btn.onclick = () => clearBtn.click();
        empty.append($('div', '', 'Keine passenden Spiele gefunden.'), btn);
        grid.append(empty);
        return;
      }

      for (const g of list) {
        const card = $('button', 'sz-card');
        card.type = 'button';
        card.onclick = () => {
          szSfx.click();
          openGame(g.id);
        };

        const head = $('div', 'sz-card-head');
        head.append($('span', 'sz-card-icon', g.icon || '🎮'));
        if (g.cat) head.append($('span', 'sz-card-cat', g.cat));

        card.append(
          head,
          $('h3', 'sz-card-title', g.title),
          $('p', 'sz-card-desc', g.desc || '')
        );

        const badges = $('div', 'sz-card-badges');
        if (potd && potd.id === g.id) badges.append($('span', 'sz-badge-chip is-potd', '📅 Heute'));
        if (isFavorite(g.id)) badges.append($('span', 'sz-badge-chip is-fav', '★ Favorit'));
        const rec = recByGame[g.id];
        if (rec && rec.best > 0) badges.append($('span', 'sz-badge-chip is-record', `🏆 ${rec.best} Pkt`));
        if (badges.childNodes.length) card.append(badges);

        grid.append(card);
      }
    }

    renderList();
  }

  render();
}
