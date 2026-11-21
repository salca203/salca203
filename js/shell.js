let activeCategory = 'Alle';
let activeSearch = '';
let activeCleanup = null;
let szEnhanceQueued = false;

function renderCustomMotifSvg(gameId) {
  switch (gameId) {
    case 'schach':
      return `
        <g transform="translate(212, 34)">
          <rect width="72" height="72" rx="10" fill="#0f172a" stroke="#ffffff" stroke-opacity="0.25" />
          <rect x="0" y="0" width="24" height="24" fill="#e2e8f0" />
          <rect x="48" y="0" width="24" height="24" fill="#e2e8f0" />
          <rect x="24" y="24" width="24" height="24" fill="#e2e8f0" />
          <rect x="0" y="48" width="24" height="24" fill="#e2e8f0" />
          <rect x="48" y="48" width="24" height="24" fill="#e2e8f0" />
          <text x="36" y="46" text-anchor="middle" font-size="30">♞</text>
        </g>`;
    case 'poker':
    case 'uno':
      return `
        <g transform="translate(210, 34)">
          <rect x="0" y="8" width="44" height="62" rx="7" transform="rotate(-10 22 39)" fill="#f8fafc" />
          <rect x="28" y="4" width="44" height="62" rx="7" transform="rotate(10 50 35)" fill="#fde047" />
          <text x="20" y="44" text-anchor="middle" font-size="22" fill="#dc2626">♥</text>
        </g>`;
    case 'tetris':
    case '2048':
      return `
        <g transform="translate(216, 36)">
          <rect x="0" y="0" width="22" height="22" rx="5" fill="#38bdf8" />
          <rect x="25" y="0" width="22" height="22" rx="5" fill="#a3e635" />
          <rect x="25" y="25" width="22" height="22" rx="5" fill="#a3e635" />
          <rect x="48" y="25" width="22" height="22" rx="5" fill="#facc15" />
        </g>`;
    case 'tomb-of-the-mask':
      return `
        <g transform="translate(216, 36)">
          <rect width="68" height="68" rx="12" fill="#120d26" stroke="#38bdf8" stroke-opacity="0.4" />
          <rect x="14" y="14" width="14" height="14" rx="3" fill="#475569" />
          <rect x="40" y="40" width="14" height="14" rx="3" fill="#475569" />
          <circle cx="34" cy="34" r="10" fill="#facc15" />
        </g>`;
    case 'fussball':
      return `
        <g transform="translate(216, 36)">
          <rect width="68" height="68" rx="12" fill="#14532d" stroke="#ffffff" stroke-opacity="0.3" />
          <circle cx="34" cy="34" r="15" fill="#ffffff" />
          <circle cx="34" cy="34" r="5" fill="#0f172a" />
        </g>`;
    case 'srw2':
      return `
        <g transform="translate(216, 34)">
          <rect width="68" height="72" rx="12" fill="#0f172a" stroke="#38bdf8" stroke-opacity="0.4" />
          <line x1="23" y1="6" x2="23" y2="66" stroke="#ffffff" stroke-opacity="0.2" stroke-dasharray="6 6" />
          <line x1="45" y1="6" x2="45" y2="66" stroke="#ffffff" stroke-opacity="0.2" stroke-dasharray="6 6" />
          <polygon points="34,14 46,54 22,54" fill="#38bdf8" />
        </g>`;
    case 'monument-valley':
      return `
        <g transform="translate(216, 36)">
          <rect width="68" height="68" rx="12" fill="#1e1b4b" />
          <polygon points="34,10 56,34 34,58 12,34" fill="#a855f7" fill-opacity="0.7" />
          <circle cx="34" cy="34" r="8" fill="#a3e635" />
        </g>`;
    case 'drift-boss':
      return `
        <g transform="translate(216, 36)">
          <rect width="68" height="68" rx="12" fill="#1e1b4b" />
          <polyline points="12,56 34,38 22,22 56,12" fill="none" stroke="#f97316" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
          <circle cx="56" cy="12" r="6" fill="#a3e635" />
        </g>`;
    case 'smash-karts':
    case 'diep-io':
      return `
        <g transform="translate(216, 36)">
          <rect width="68" height="68" rx="12" fill="#0f172a" />
          <circle cx="34" cy="36" r="16" fill="#38bdf8" />
          <rect x="34" y="32" width="22" height="8" rx="3" fill="#facc15" />
        </g>`;
    case 'paper-io-2':
    case 'state-io':
      return `
        <g transform="translate(216, 36)">
          <rect width="68" height="68" rx="12" fill="#141129" />
          <rect x="10" y="10" width="22" height="22" rx="4" fill="#22c55e" />
          <rect x="36" y="10" width="22" height="22" rx="4" fill="#ef4444" />
          <rect x="10" y="36" width="48" height="22" rx="4" fill="#38bdf8" fill-opacity="0.85" />
        </g>`;
    default:
      return '';
  }
}

function makeGameThumbnailSvg(game) {
  const palettes = [
    ['#4f46e5', '#9333ea', '#38bdf8'],
    ['#e11d48', '#f97316', '#facc15'],
    ['#059669', '#0284c7', '#a3e635'],
    ['#7c3aed', '#db2777', '#22d3ee'],
    ['#b45309', '#dc2626', '#fde047']
  ];
  let hash = 0;
  const str = String(game.id || game.title || 'sz');
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  const [c1, c2, c3] = palettes[hash % palettes.length];
  const gid = `szg_${hash}`;
  const icon = game.icon || '🎮';
  const motif = renderCustomMotifSvg(game.id);

  return `
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${game.title}">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="100%" stop-color="${c2}" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill="url(#${gid})" />
      <circle cx="265" cy="42" r="56" fill="${c3}" fill-opacity="0.22" />
      <circle cx="52" cy="172" r="68" fill="#000000" fill-opacity="0.24" />
      <rect x="18" y="18" width="284" height="164" rx="18" fill="#0c0918" fill-opacity="0.28" stroke="#ffffff" stroke-opacity="0.16" />
      ${motif}
      <text x="${motif ? '112' : '160'}" y="112" text-anchor="middle" font-size="${motif ? '56' : '68'}" dominant-baseline="middle">${icon}</text>
      <rect x="26" y="148" width="112" height="22" rx="11" fill="#0c0918" fill-opacity="0.72" />
      <text x="82" y="163" text-anchor="middle" fill="#ffffff" font-size="11" font-weight="800" font-family="system-ui, sans-serif">${(game.cat || 'Arcade').slice(0, 14)}</text>
    </svg>
  `;
}

function getGameExplanation(game) {
  if (game.desc && String(game.desc).trim()) return String(game.desc).trim();
  return `Starte „${game.title}“ (${game.cat || 'Spiel'}) und folge den Anzeigen in der Spielleiste. Dein Fortschritt wird lokal gespeichert.`;
}

function renderTopBanners() {
  const bannersEl = document.getElementById('sz-banners');
  if (!bannersEl) return;

  const items = [
    { cls: 'sz-banner-brain', ico: '🧠', lbl: 'Train your brain', q: 'Puzzle' },
    { cls: 'sz-banner-adrenaline', ico: '🏎️', lbl: 'Adrenaline', q: 'Action' },
    { cls: 'sz-banner-friends', ico: '🙌', lbl: 'Mit Freunden', q: 'Partyspiele' }
  ];

  bannersEl.innerHTML = '';
  items.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `sz-banner-card ${b.cls}`;
    btn.innerHTML = `<span class="sz-banner-ico">${b.ico}</span><span class="sz-banner-lbl">${b.lbl}</span>`;
    btn.onclick = () => selectCategory(b.q);
    bannersEl.append(btn);
  });
}

function renderCategories() {
  const catsEl = document.getElementById('sz-cats');
  if (!catsEl) return;

  const cats = ['Alle', ...Array.from(new Set(GAMES.map((g) => g.cat || 'Arcade')))];
  catsEl.innerHTML = '';

  cats.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sz-cat-pill' + (activeCategory === cat ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => selectCategory(cat);
    catsEl.append(btn);
  });
}

function selectCategory(cat) {
  activeCategory = cat || 'Alle';
  renderCategories();
  renderGrid();
}

function scheduleEnhance() {
  if (szEnhanceQueued) return;
  szEnhanceQueued = true;
  requestAnimationFrame(() => {
    szEnhanceQueued = false;
    enhanceCardsAndStageSafe();
  });
}

function enhanceCardsAndStageSafe() {
  const saves = typeof readAllSaves === 'function' ? readAllSaves() : {};

  document.querySelectorAll('.sz-card').forEach((card) => {
    const id = card.dataset.gameId;
    const game = GAMES.find((g) => g.id === id);
    if (!game) return;

    const hasSave = Boolean(saves && saves[game.id]);
    const signature = `${game.id}|${hasSave ? 1 : 0}|${game.title}`;
    if (card.dataset.szEnhanced === signature) return;

    const expl = getGameExplanation(game);
    card.dataset.szEnhanced = signature;
    card.title = `${game.title} – ${expl}`;
    card.innerHTML = `
      <div class="sz-thumb-box">
        ${makeGameThumbnailSvg(game)}
        ${hasSave ? '<span class="sz-badge-saved">💾 Stand</span>' : ''}
      </div>
      <div class="sz-card-title">${game.title}</div>
      <div class="sz-card-sub">${expl}</div>
    `;
  });

  const stage = document.getElementById('sz-stage');
  if (stage && !stage.classList.contains('hidden')) {
    const activeId = stage.dataset.activeGameId;
    const game = GAMES.find((g) => g.id === activeId);
    if (game && stage.dataset.szStageEnhanced !== game.id) {
      stage.dataset.szStageEnhanced = game.id;
      stage.querySelectorAll('.sz-explain-box').forEach((el) => el.remove());

      const box = document.createElement('div');
      box.className = 'sz-explain-box';
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px">
          <strong>Spielerklärung · ${game.title}</strong>
          <button type="button" class="sz-btn sz-btn-ghost sz-single-reset" style="padding:4px 10px;font-size:12px">↺ Spielstand löschen</button>
        </div>
        <p>${getGameExplanation(game)}</p>
      `;
      box.querySelector('.sz-single-reset')?.addEventListener('click', () => {
        resetSingleGameProgress(game.id);
      });
      stage.prepend(box);
    }
  }
}

function renderGrid(onlySaved = false) {
  const grid = document.getElementById('sz-grid');
  const stage = document.getElementById('sz-stage');
  const backBtn = document.getElementById('sz-back-btn');
  if (!grid || !stage) return;

  if (typeof activeCleanup === 'function') {
    activeCleanup();
    activeCleanup = null;
  }
  stage.classList.add('hidden');
  stage.innerHTML = '';
  delete stage.dataset.activeGameId;
  delete stage.dataset.szStageEnhanced;
  grid.classList.remove('hidden');
  backBtn?.classList.add('hidden');

  const saves = readAllSaves();
  const q = activeSearch.trim().toLowerCase();

  const filtered = GAMES.filter((g) => {
    const catOk = activeCategory === 'Alle' || g.cat === activeCategory;
    const saveOk = !onlySaved || Boolean(saves && saves[g.id]);
    const searchOk = !q
      || g.title.toLowerCase().includes(q)
      || (g.cat || '').toLowerCase().includes(q)
      || (g.desc || '').toLowerCase().includes(q);
    return catOk && saveOk && searchOk;
  });

  grid.innerHTML = '';
  if (!filtered.length) {
    grid.innerHTML = `<p class="sz-muted" style="grid-column:1/-1;text-align:center;padding:24px">Keine passenden Spiele gefunden.</p>`;
    return;
  }

  filtered.forEach((game) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'sz-card';
    card.dataset.gameId = game.id;
    card.onclick = () => openGame(game.id);
    grid.append(card);
  });

  scheduleEnhance();
}

function openGame(gameId) {
  const game = GAMES.find((g) => g.id === gameId);
  const grid = document.getElementById('sz-grid');
  const stage = document.getElementById('sz-stage');
  const backBtn = document.getElementById('sz-back-btn');
  if (!game || !stage) return;

  if (typeof activeCleanup === 'function') {
    activeCleanup();
    activeCleanup = null;
  }

  grid?.classList.add('hidden');
  backBtn?.classList.remove('hidden');
  stage.classList.remove('hidden');
  stage.dataset.activeGameId = game.id;
  delete stage.dataset.szStageEnhanced;
  stage.innerHTML = '';

  const head = $('div', 'sz-stage-head');
  const title = $('h2', 'sz-stage-title', `${game.icon || '🎮'} ${game.title}`);
  const closeBtn = $('button', 'sz-btn sz-btn-ghost', '← Zurück');
  closeBtn.onclick = () => renderGrid();
  head.append(title, closeBtn);

  const status = $('div', 'sz-stage-status', 'Bereit');
  const body = $('div', 'sz-stage-body');

  stage.append(head, status, body);
  enhanceCardsAndStageSafe();

  const rt = makeRuntime();
  activeCleanup = () => rt.cleanup();

  game.run({
    body,
    status,
    cleanup: rt.cleanup
  });
}

function openRandomGame() {
  if (!GAMES.length) return;
  const pick = GAMES[R(GAMES.length)];
  if (pick) openGame(pick.id);
}

document.addEventListener('DOMContentLoaded', () => {
  renderTopBanners();
  renderCategories();
  renderGrid();

  const searchInp = document.getElementById('sz-search');
  searchInp?.addEventListener('input', () => {
    activeSearch = searchInp.value || '';
    renderGrid();
  });

  document.getElementById('sz-random-btn')?.addEventListener('click', openRandomGame);
  document.getElementById('sz-back-btn')?.addEventListener('click', () => renderGrid());

  const namesDlg = document.getElementById('sz-names-dialog');
  document.getElementById('sz-players-btn')?.addEventListener('click', () => {
    if (namesDlg && typeof namesDlg.showModal === 'function') namesDlg.showModal();
  });

  document.getElementById('sz-reset-saves-btn')?.addEventListener('click', () => {
    if (confirm('Alle gespeicherten Spielstände im Browser wirklich löschen?')) {
      clearAllGameProgress();
      renderGrid();
    }
  });

  const homeBtn = document.getElementById('sz-nav-home');
  const searchBtn = document.getElementById('sz-nav-search');
  const savedBtn = document.getElementById('sz-nav-saved');
  const playersBtn = document.getElementById('sz-nav-players');

  const setActiveNav = (btn) => {
    [homeBtn, searchBtn, savedBtn, playersBtn].forEach((b) => b?.classList.remove('active'));
    btn?.classList.add('active');
  };

  homeBtn?.addEventListener('click', () => {
    setActiveNav(homeBtn);
    activeCategory = 'Alle';
    activeSearch = '';
    if (searchInp) searchInp.value = '';
    renderCategories();
    renderGrid(false);
  });

  searchBtn?.addEventListener('click', () => {
    setActiveNav(searchBtn);
    renderGrid(false);
    searchInp?.focus();
    searchInp?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  savedBtn?.addEventListener('click', () => {
    setActiveNav(savedBtn);
    renderGrid(true);
  });

  playersBtn?.addEventListener('click', () => {
    setActiveNav(playersBtn);
    if (namesDlg && typeof namesDlg.showModal === 'function') namesDlg.showModal();
  });

  const obs = new MutationObserver(() => scheduleEnhance());
  obs.observe(document.body, { childList: true, subtree: true });
});
