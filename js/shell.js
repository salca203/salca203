const Shell = (() => {
  const gridEl = document.getElementById('sz-grid');
  const stageEl = document.getElementById('sz-stage');
  const catsEl = document.getElementById('sz-cats');
  const searchEl = document.getElementById('sz-search');
  const backBtn = document.getElementById('sz-back-btn');
  const playersBtn = document.getElementById('sz-players-btn');
  const dialogEl = document.getElementById('sz-names-dialog');

  let activeCat = 'Alle';
  let activeQuery = '';

  const getCategories = () => {
    const set = new Set(['Alle', 'Spielbar']);
    SZ.games.forEach((g) => g.cat && set.add(g.cat));
    return [...set];
  };

  const renderCats = () => {
    catsEl.innerHTML = '';
    getCategories().forEach((cat) => {
      const btn = $('button', 'sz-chip' + (cat === activeCat ? ' active' : ''), cat);
      btn.onclick = () => {
        activeCat = cat;
        renderCats();
        renderGrid();
      };
      catsEl.append(btn);
    });
  };

  const renderGrid = () => {
    gridEl.innerHTML = '';
    const q = activeQuery.trim().toLowerCase();
    const list = SZ.games.filter((g) => {
      const catOk =
        activeCat === 'Alle' ||
        (activeCat === 'Spielbar' && typeof g.run === 'function') ||
        g.cat === activeCat;
      const qOk =
        !q ||
        g.title.toLowerCase().includes(q) ||
        (g.desc && g.desc.toLowerCase().includes(q)) ||
        (g.cat && g.cat.toLowerCase().includes(q));
      return catOk && qOk;
    });

    list.forEach((g) => {
      const playable = typeof g.run === 'function';
      const card = $('button', 'sz-card', `
        <div>
          <div class="sz-card-top">
            <span class="sz-card-icon">${g.icon || '🎮'}</span>
            <span class="sz-badge ${playable ? 'sz-badge-ready' : ''}">${playable ? 'Spielbar' : 'Geplant'}</span>
          </div>
          <h2 class="sz-card-title">${g.title}</h2>
          <p class="sz-card-desc">${g.desc || ''}</p>
        </div>
        <span class="sz-badge">${g.cat || 'Allgemein'}</span>
      `);
      card.onclick = () => openGame(g);
      gridEl.append(card);
    });
  };

  const openGame = (g) => {
    if (typeof SZ.activeCleanup === 'function') {
      SZ.activeCleanup();
      SZ.activeCleanup = null;
    }
    gridEl.classList.add('hidden');
    catsEl.classList.add('hidden');
    searchEl.classList.add('hidden');
    playersBtn.classList.add('hidden');
    backBtn.classList.remove('hidden');
    stageEl.classList.remove('hidden');
    stageEl.innerHTML = '';

    const status = $('span', null, g.desc || '');
    const restartBtn = $('button', 'sz-btn sz-btn-ghost', '↻ Neu');
    const bar = $('div', 'sz-game-bar', `<span>${g.icon || ''} <strong>${g.title}</strong></span>`);
    const right = $('div', 'sz-controls');
    const body = $('div', 'sz-game-body');

    const mount = () => {
      body.innerHTML = '';
      if (typeof SZ.activeCleanup === 'function') {
        SZ.activeCleanup();
        SZ.activeCleanup = null;
      }
      if (typeof g.run === 'function') {
        g.run({ body, status });
      } else {
        body.innerHTML = `
          <div style="max-width:520px;text-align:center;line-height:1.5">
            <div style="font-size:44px;margin-bottom:8px">${g.icon || '🚧'}</div>
            <h3 style="margin:0 0 8px">${g.title}</h3>
            <p style="color:var(--sz-muted);margin:0 0 14px">${g.desc}</p>
            <p style="font-size:13px;color:var(--sz-muted)">Dieses Modul steht auf der Roadmap und wird als Nächstes ergänzt.</p>
          </div>
        `;
      }
    };

    restartBtn.onclick = mount;
    right.append(status, restartBtn);
    bar.append(right);
    stageEl.append(bar, body);
    mount();
  };

  const goHome = () => {
    if (typeof SZ.activeCleanup === 'function') {
      SZ.activeCleanup();
      SZ.activeCleanup = null;
    }
    stageEl.classList.add('hidden');
    backBtn.classList.add('hidden');
    gridEl.classList.remove('hidden');
    catsEl.classList.remove('hidden');
    searchEl.classList.remove('hidden');
    playersBtn.classList.remove('hidden');
    renderGrid();
  };

  backBtn.onclick = goHome;
  searchEl.oninput = (e) => {
    activeQuery = e.target.value;
    renderGrid();
  };

  playersBtn.onclick = () => {
    document.getElementById('sz-p1').value = SZ.names[0];
    document.getElementById('sz-p2').value = SZ.names[1];
    document.getElementById('sz-group').value = SZ.group.join(', ');
    dialogEl.showModal();
  };

  dialogEl.addEventListener('close', () => {
    if (dialogEl.returnValue === 'save') {
      const p1 = document.getElementById('sz-p1').value.trim();
      const p2 = document.getElementById('sz-p2').value.trim();
      const grp = document.getElementById('sz-group').value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (p1) SZ.names[0] = p1;
      if (p2) SZ.names[1] = p2;
      if (grp.length) SZ.group = grp;
      saveProfiles();
    }
  });

  const init = () => {
    renderCats();
    renderGrid();
  };

  return { init, openGame, goHome };
})();
