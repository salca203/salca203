// Gemeinsame Laufzeit-Hilfen für eingebettete Module (sauberes Aufräumen bei Spielwechsel)
const makeRuntime = () => {
  let timers = [];
  let rafs = [];
  let keyHandler = null;

  const later = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  };

  const trackRaf = (id) => {
    rafs.push(id);
    return id;
  };

  const setKey = (fn) => {
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = fn;
    if (fn) window.addEventListener('keydown', keyHandler);
  };

  const prevCleanup = SZ.activeCleanup;
  SZ.activeCleanup = () => {
    timers.forEach(clearTimeout);
    timers = [];
    rafs.forEach(cancelAnimationFrame);
    rafs = [];
    if (keyHandler) window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    if (typeof prevCleanup === 'function') prevCleanup();
  };

  return { later, trackRaf, setKey };
};

// Kleine Helferleiste für Spieloptionen (z. B. Gegner, Stärke, Größe)
const buildOptionBar = (defs, onChange) => {
  const bar = $('div', 'sz-opts');
  const state = {};
  defs.forEach(([key, label, choices, defIdx = 0]) => {
    state[key] = choices[defIdx][1];
    const grp = $('label', 'sz-opt-group');
    grp.append($('span', null, label));
    const sel = $('select');
    choices.forEach(([text, val]) => {
      const opt = $('option');
      opt.value = String(val);
      opt.textContent = text;
      if (val === state[key]) opt.selected = true;
      sel.append(opt);
    });
    sel.onchange = () => {
      const raw = sel.value;
      state[key] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
      onChange(state);
    };
    grp.append(sel);
    bar.append(grp);
  });
  return { bar, state };
};

// ==========================================
// 1. HOCHGELADENE SPIELE (MIT OPTIONEN)
// ==========================================

registerGame({
  id: 'tap-duell',
  title: 'Tap-Duell',
  icon: '⚡',
  cat: 'Action',
  desc: 'Warte auf JETZT TIPPEN und tippe als Erster auf deine Seite. Zu früh tippen gibt dem anderen den Punkt.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['m', 'Gegner', [['Computer', 1], ['Zu zweit', 2]], 0],
      ['d', 'Stärke', [['Leicht', 0], ['Mittel', 1], ['Schwer', 2]], 1],
      ['w', 'Punkte', [['3', 3], ['5', 5], ['10', 10]], 1],
      ['sit', 'Position', [['Nebeneinander', 0], ['Gegenüber', 1]], 0]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { later, setKey } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.cssText = 'flex:1;min-height:0;width:100%';
      container.append(playArea);

      const WIN = o.w;
      const RT = [[420, 800], [300, 600], [190, 330]][o.d ?? 1];
      const pCol = ['var(--sz-p0)', 'var(--sz-p1)'];
      let sc = [0, 0], go = 0, bz = 0, fin = 0;

      const w = $('div', 'sz-duel' + (o.sit ? ' v' : ''));
      w.style.height = '100%';
      playArea.append(w);

      const z = [0, 1].map((i) => {
        const d = $('button', 'sz-zone');
        d.style.background = pCol[i];
        if (o.sit && !i) d.style.transform = 'rotate(180deg)';
        d.onpointerdown = () => hit(i);
        w.append(d);
        return d;
      });

      const show = (m) => {
        z.forEach((d, i) => {
          const pName = i === 1 && o.m === 1 ? 'Computer' : SZ.names[i];
          d.innerHTML = `<small style="opacity:.85">${pName}</small><span class="sz-big">${sc[i]}</span><span>${m[i]}</span>`;
        });
      };

      const round = () => {
        go = bz = 0;
        show(['Warten …', 'Warten …']);
        later(() => {
          go = 1;
          show(['JETZT TIPPEN!', 'JETZT TIPPEN!']);
          if (o.m === 1) later(() => hit(1), RT[0] + R(RT[1] - RT[0]));
        }, 1500 + R(3000));
      };

      const hit = (i) => {
        if (bz || fin) return;
        bz = 1;
        const wn = go ? i : 1 - i;
        sc[wn]++;
        show([0, 1].map((k) => (k === wn ? (go ? 'Schneller! ✔' : 'Gegner war zu früh ✔') : (go ? 'Zu langsam' : 'Zu früh! ✖'))));
        const n0 = SZ.names[0], n1 = o.m === 1 ? 'Computer' : SZ.names[1];
        status.textContent = `${n0} ${sc[0]} : ${sc[1]} ${n1} · Ziel: ${WIN}`;
        if (sc[wn] >= WIN) {
          fin = 1;
          later(() => show([0, 1].map((k) => (k === wn ? '🏆 Gewonnen!' : 'Verloren'))), 700);
        } else {
          later(round, 1500);
        }
      };

      setKey((e) => {
        if (e.repeat) return;
        if (e.key === 'a') hit(0);
        else if (e.key === 'l') hit(1);
        else if (e.key === ' ') { e.preventDefault(); hit(o.m === 1 ? 0 : 1); }
      });

      status.textContent = `Erster mit ${WIN} Punkten gewinnt`;
      round();
    };

    mount();
  }
});

registerGame({
  id: 'tauziehen',
  title: 'Tauziehen',
  icon: '💪',
  cat: 'Action',
  desc: 'Tippe so schnell du kannst auf deine Seite. Wer die Grenze auf die andere Seite schiebt, gewinnt.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['m', 'Gegner', [['Computer', 1], ['Zu zweit', 2]], 0],
      ['d', 'Stärke', [['Leicht', 0], ['Mittel', 1], ['Schwer', 2]], 1],
      ['sit', 'Position', [['Nebeneinander', 0], ['Gegenüber', 1]], 0]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;width:100%;height:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { later, setKey } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.cssText = 'flex:1;min-height:0;width:100%';
      container.append(playArea);

      const IV = [[230, 150], [140, 120], [85, 70]][o.d ?? 1];
      const pCol = ['var(--sz-p0)', 'var(--sz-p1)'];
      let p = 50, ov = 0;

      const w = $('div', 'sz-duel' + (o.sit ? ' v' : ''));
      w.style.height = '100%';
      playArea.append(w);

      const z = [0, 1].map((i) => {
        const pName = i === 1 && o.m === 1 ? 'Computer' : SZ.names[i];
        const d = $('button', 'sz-zone', `<small style="opacity:.85">${pName}</small><span class="sz-big">👆</span><span>Tippen!</span>`);
        d.style.background = pCol[i];
        if (o.sit && !i) d.style.transform = 'rotate(180deg)';
        d.onpointerdown = () => push(i);
        w.append(d);
        return d;
      });

      z[0].style.flex = z[1].style.flex = 50;

      const push = (i) => {
        if (ov) return;
        p += i ? -3 : 3;
        z[0].style.flex = p;
        z[1].style.flex = 100 - p;
        if (p >= 92 || p <= 8) {
          ov = 1;
          const t = p >= 92 ? 0 : 1;
          const winName = t === 1 && o.m === 1 ? 'Computer' : SZ.names[t];
          z[t].innerHTML = `<span class="sz-big">🏆</span><span>${winName} gewinnt!</span>`;
          z[1 - t].innerHTML = '<span>Verloren</span>';
          status.textContent = `${winName} hat gewonnen!`;
        }
      };

      const ai = () => {
        if (!ov) {
          push(1);
          later(ai, IV[0] + R(IV[1]));
        }
      };
      if (o.m === 1) later(ai, 1000);

      setKey((e) => {
        if (e.repeat) return;
        if (e.key === 'a') push(0);
        else if (e.key === 'l') push(1);
        else if (e.key === ' ') { e.preventDefault(); push(o.m === 1 ? 0 : 1); }
      });

      status.textContent = 'So schnell wie möglich auf deine Seite tippen!';
    };

    mount();
  }
});

registerGame({
  id: 'tic-tac-toe',
  title: 'Tic-Tac-Toe',
  icon: '✖️',
  cat: 'Brettspiele',
  desc: 'Drei in einer Reihe gewinnt. Die Punkte zählen über mehrere Runden.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['m', 'Gegner', [['Computer', 1], ['Zu zweit', 2]], 0],
      ['d', 'Stärke', [['Leicht', 0], ['Mittel', 1], ['Schwer', 2]], 1]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { later } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.width = '100%';
      container.append(playArea);

      const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const pCol = ['var(--sz-p0)', 'var(--sz-p1)'];
      const p1Name = o.m === 1 ? 'Computer' : SZ.names[1];
      let b, cur, over, sc = [0, 0], first = 1;

      const g = $('div', 'sz-tt');
      const nx = $('button', 'sz-btn sz-btn-primary', 'Nächste Runde');
      nx.style.cssText = 'display:block;margin:14px auto 0';
      playArea.append(g, nx);

      const win = (a) => L.find((l) => a[l[0]] != null && a[l[0]] === a[l[1]] && a[l[1]] === a[l[2]]) || 0;
      const curName = (idx) => (idx === 1 && o.m === 1 ? 'Computer' : SZ.names[idx]);

      const u = () => {
        status.textContent = `${SZ.names[0]} ${sc[0]} : ${sc[1]} ${p1Name} · ` +
          (over === 1 ? `${curName(cur)} gewinnt! 🏆` : over === 2 ? 'Unentschieden' : `${curName(cur)} ist dran`);
      };

      const draw = () => {
        g.innerHTML = '';
        const w = win(b);
        b.forEach((v, i) => {
          const c = $('button', 'sz-tc' + (w && w.includes(i) ? ' win' : ''), v == null ? '' : '✕○'[v]);
          c.style.color = v != null ? pCol[v] : '';
          c.onclick = () => {
            if (!over && b[i] == null && !(o.m === 1 && cur === 1)) mv(i);
          };
          g.append(c);
        });
        nx.hidden = !over;
      };

      const mv = (i) => {
        b[i] = cur;
        if (win(b)) { over = 1; sc[cur]++; }
        else if (b.every((v) => v != null)) over = 2;
        else cur = 1 - cur;
        draw();
        u();
        if (!over && o.m === 1 && cur === 1) later(ai, 500);
      };

      const mm = (a, p, dp) => {
        const w = win(a);
        if (w) return a[w[0]] === 1 ? 10 - dp : dp - 10;
        if (a.every((v) => v != null)) return 0;
        let r = p === 1 ? -99 : 99;
        for (let i = 0; i < 9; i++) if (a[i] == null) {
          a[i] = p;
          const v = mm(a, 1 - p, dp + 1);
          a[i] = null;
          r = p === 1 ? Math.max(r, v) : Math.min(r, v);
        }
        return r;
      };

      const ai = () => {
        const d = o.d ?? 1;
        const e = [...b.keys()].filter((i) => b[i] == null);
        if (!e.length) return;
        const c = [0, 2, 6, 8].filter((i) => b[i] == null);
        const t = (p) => e.find((i) => { b[i] = p; const w = win(b); b[i] = null; return w; });
        if (d === 0 && R(100) < 60) return mv(e[R(e.length)]);
        if (d === 2) {
          let bs = -99, bm = [];
          e.forEach((i) => {
            b[i] = 1;
            const v = mm(b, 0, 1);
            b[i] = null;
            if (v > bs) { bs = v; bm = [i]; }
            else if (v === bs) bm.push(i);
          });
          return mv(bm[R(bm.length)]);
        }
        mv(t(1) ?? t(0) ?? (b[4] == null ? 4 : c.length ? c[R(c.length)] : e[R(e.length)]));
      };

      const nw = () => {
        b = Array(9).fill(null);
        over = 0;
        first = 1 - first;
        cur = first;
        draw();
        u();
        if (o.m === 1 && cur === 1) later(ai, 500);
      };

      nx.onclick = nw;
      nw();
    };

    mount();
  }
});

registerGame({
  id: 'turmbau',
  title: 'Turmbau',
  icon: '🏗️',
  cat: 'Action',
  desc: 'Tippe im richtigen Moment, damit der Block auf dem Turm landet. Was übersteht, fällt ab.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['d', 'Schwierigkeit', [['Leicht', 0], ['Mittel', 1], ['Schwer', 2]], 1]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%;height:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { trackRaf, setKey } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.cssText = 'flex:1;min-height:0;display:flex;align-items:center;justify-content:center;width:100%';
      container.append(playArea);

      const W = 400, H = 560, BH = 26, key = 'sz_stk_' + (o.d ?? 1);
      const cv = $('canvas', 'sz-stack-cv');
      cv.width = W; cv.height = H;
      playArea.append(cv);
      const x = cv.getContext('2d');

      let best = 0;
      try { best = +localStorage.getItem(key) || 0; } catch (_) {}

      let L, cur, dir, cam, sc, st, deb, combo, lt = 0, cd = 0, nb = 0;
      const hue = (i) => (i * 14 + 200) % 360;
      const mkc = () => { const p = L[L.length - 1]; cur = { x: 0, w: p.w }; dir = 1; };
      const u = () => { status.textContent = `Höhe ${sc} · 🏆 ${best}`; };

      const reset = () => {
        L = [{ x: 100, w: 200 }];
        sc = 0; st = 0; nb = 0; deb = []; combo = 0; cam = 0;
        mkc();
        u();
      };

      const tap = () => {
        if (st === 2) { if (Date.now() > cd) reset(); return; }
        if (st === 0) { st = 1; return; }
        const p = L[L.length - 1];
        const ov = Math.min(cur.x + cur.w, p.x + p.w) - Math.max(cur.x, p.x);
        if (ov <= 0) {
          st = 2;
          cd = Date.now() + 500;
          deb.push({ x: cur.x, w: cur.w, y: L.length, vy: 0, h: hue(L.length) });
          if (sc > best) {
            best = sc; nb = 1;
            try { localStorage.setItem(key, String(best)); } catch (_) {}
          }
          u();
          return;
        }
        if (Math.abs(cur.x - p.x) < [9, 5, 3][o.d ?? 1]) {
          cur.x = p.x;
          cur.w = Math.min(cur.w + (combo > 2 ? 6 : 0), 200);
          combo++;
        } else {
          combo = 0;
          const nx = Math.max(cur.x, p.x);
          if (cur.x < p.x) deb.push({ x: cur.x, w: p.x - cur.x, y: L.length, vy: 0, h: hue(L.length) });
          else deb.push({ x: p.x + p.w, w: cur.x + cur.w - (p.x + p.w), y: L.length, vy: 0, h: hue(L.length) });
          cur.x = nx;
          cur.w = ov;
        }
        L.push({ x: cur.x, w: cur.w });
        sc++;
        u();
        mkc();
      };

      cv.onpointerdown = tap;
      setKey((e) => {
        if (!e.repeat && (e.key === ' ' || e.key === 'ArrowDown')) { e.preventDefault(); tap(); }
      });

      const yy = (i) => H - 120 - (i * BH) + cam;
      const blk = (a, w, i, h) => {
        x.fillStyle = `hsl(${h} 70% 58%)`;
        x.fillRect(a, yy(i), w, BH - 2);
        x.fillStyle = `hsl(${h} 70% 70%)`;
        x.fillRect(a, yy(i), w, 6);
        x.fillStyle = `hsl(${h} 70% 42%)`;
        x.fillRect(a, yy(i) + BH - 8, w, 6);
      };

      const go = (now) => {
        const d = Math.min(2.5, (now - (lt || now)) / 16.67);
        lt = now;
        if (st === 1) {
          const v = Math.min(7.5, 2.6 + sc * 0.12) * [0.8, 1, 1.25][o.d ?? 1] * d;
          cur.x += dir * v;
          if (cur.x < 0) { cur.x = 0; dir = 1; }
          if (cur.x + cur.w > W) { cur.x = W - cur.w; dir = -1; }
        }
        const tg = Math.max(0, (L.length - 6) * BH);
        cam += (tg - cam) * 0.1 * d;
        deb.forEach((b) => { b.vy += 0.012 * d; b.y -= b.vy * d; });
        deb = deb.filter((b) => b.y > -12);

        const g = x.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, `hsl(${(220 + sc * 5) % 360} 60% 22%)`);
        g.addColorStop(1, `hsl(${(270 + sc * 5) % 360} 60% 10%)`);
        x.fillStyle = g;
        x.fillRect(0, 0, W, H);

        L.forEach((b, i) => { if (yy(i) < H && yy(i) > -BH) blk(b.x, b.w, i, hue(i)); });
        deb.forEach((b) => blk(b.x, b.w, b.y, b.h));
        if (st === 1) blk(cur.x, cur.w, L.length, hue(L.length));

        x.textAlign = 'center';
        x.lineWidth = 6;
        x.strokeStyle = '#14213d';
        x.fillStyle = '#fff';
        x.lineJoin = 'round';
        x.font = '800 48px ui-rounded, system-ui, sans-serif';
        if (st) { x.strokeText(sc, W / 2, 64); x.fillText(sc, W / 2, 64); }
        x.font = '800 20px ui-rounded, system-ui, sans-serif';
        if (st === 0) {
          x.strokeText('Tippen zum Starten und Bauen', W / 2, H / 2);
          x.fillText('Tippen zum Starten und Bauen', W / 2, H / 2);
        }
        if (st === 2) {
          const msg = nb ? '🏆 Neuer Bestwert!' : 'Eingestürzt!';
          x.strokeText(msg, W / 2, 120); x.fillText(msg, W / 2, 120);
        }

        trackRaf(requestAnimationFrame(go));
      };

      reset();
      trackRaf(requestAnimationFrame(go));
    };

    mount();
  }
});

registerGame({
  id: 'ultimate-tic-tac-toe',
  title: 'Ultimate Tic-Tac-Toe',
  icon: '❌',
  cat: 'Brettspiele',
  desc: 'Dein Zug bestimmt das Feld des Gegners. Gewinne drei kleine Felder in einer Reihe.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['m', 'Gegner', [['Computer', 1], ['Zu zweit', 2]], 0],
      ['d', 'Stärke', [['Leicht', 0], ['Mittel', 1], ['Schwer', 2]], 1]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { later } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.width = '100%';
      container.append(playArea);

      const pCol = ['var(--sz-p0)', 'var(--sz-p1)'];
      const pName = (idx) => (idx === 1 && o.m === 1 ? 'Computer' : SZ.names[idx]);
      let B = Array(81).fill(null), W = Array(9).fill(null), cur = 0, nx = -1, over = 0;
      const g = $('div', 'sz-ut');
      playArea.append(g);

      const L = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      const wn = (a) => {
        for (const [x, y, z] of L) if (a[x] != null && a[x] < 2 && a[x] === a[y] && a[y] === a[z]) return a[x];
        return a.every((v) => v != null) ? 2 : null;
      };

      const st = () => {
        status.textContent = `${pName(cur)}${nx < 0 ? ' · beliebiges Feld' : ''}`;
      };

      const draw = () => {
        g.innerHTML = '';
        for (let i = 0; i < 9; i++) {
          const d = $('div', 'sz-sb' + ((nx < 0 || nx === i) && W[i] == null && !over ? ' act' : ''));
          if (W[i] != null && W[i] < 2) {
            d.innerHTML = `<em style="color:${pCol[W[i]]}">${'✕○'[W[i]]}</em>`;
          } else {
            for (let j = 0; j < 9; j++) {
              const v = B[i * 9 + j];
              const c = $('button', 'sz-uc', v == null ? '' : '✕○'[v]);
              if (v != null) c.style.color = pCol[v];
              c.onclick = () => { if (!(o.m === 1 && cur === 1)) play(i, j); };
              d.append(c);
            }
          }
          g.append(d);
        }
      };

      const play = (i, j) => {
        if (over || W[i] != null || B[i * 9 + j] != null || (nx >= 0 && nx !== i)) return;
        B[i * 9 + j] = cur;
        W[i] = wn(B.slice(i * 9, i * 9 + 9));
        const w = wn(W);
        if (w != null) {
          over = 1;
          status.textContent = w === 2 ? 'Unentschieden' : `${pName(w)} gewinnt! 🏆`;
        } else {
          cur = 1 - cur;
          nx = W[j] == null ? j : -1;
          st();
          if (o.m === 1 && cur === 1) later(ai, 600);
        }
        draw();
      };

      const ai = () => {
        const d = o.d ?? 1, m = [];
        for (let i = 0; i < 9; i++) if (W[i] == null && (nx < 0 || nx === i))
          for (let j = 0; j < 9; j++) if (B[i * 9 + j] == null) m.push([i, j]);
        if (!m.length) return;
        if (d === 0) return play(...m[R(m.length)]);
        const sc = ([i, j]) => {
          const a = B.slice(i * 9, i * 9 + 9);
          a[j] = 1;
          let v = (wn(a) === 1 ? 5 : 0) + (j === 4 ? 1 : 0) + (W[j] == null ? 0 : -2) + Math.random();
          if (d === 2) {
            const W2 = [...W]; W2[i] = wn(a);
            if (wn(W2) === 1) v += 100;
            if (W[j] == null) {
              const t = B.slice(j * 9, j * 9 + 9);
              if (i === j) t[j] = 1;
              for (let k = 0; k < 9; k++) if (t[k] == null) { t[k] = 0; if (wn(t) === 0) v -= 6; t[k] = null; }
            }
            const c = B.slice(i * 9, i * 9 + 9); c[j] = 0;
            if (wn(c) === 0) v += 4;
            if (wn(a) === 1 && W[j] != null) v += 1;
          }
          return v;
        };
        m.sort((p, q) => sc(q) - sc(p));
        play(...m[0]);
      };

      draw();
      st();
    };

    mount();
  }
});

registerGame({
  id: 'vier-in-einer-reihe',
  title: 'Vier in einer Reihe',
  icon: '🔴',
  cat: 'Brettspiele',
  desc: 'Klassisch fallen die Steine nach unten. Im Modus „Freies Feld“ setzt du Steine überall hin.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['m', 'Gegner', [['Computer', 1], ['Zu zweit', 2]], 0],
      ['md', 'Modus', [['Klassisch', 0], ['Freies Feld', 1]], 0],
      ['d', 'Stärke', [['Leicht', 0], ['Mittel', 1], ['Schwer', 2]], 1]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { later } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.width = '100%';
      container.append(playArea);

      const C = 7, H = 6, fr = o.md === 1;
      const pCol = ['var(--sz-p0)', 'var(--sz-p1)'];
      const pName = (idx) => (idx === 1 && o.m === 1 ? 'Computer' : SZ.names[idx]);
      const g = $('div', 'sz-c4'), cl = [];
      let b = Array.from({ length: C }, () => Array(H).fill(null)), cur = 0, over = 0, bz = 0;
      playArea.append(g);

      const win = (c, r, p) => [[1,0],[0,1],[1,1],[1,-1]].some(([dx, dy]) => {
        let n = 1;
        for (const k of [1, -1]) for (let i = 1; i < 4; i++) {
          if (b[c + k * i * dx]?.[r + k * i * dy] === p) n++;
          else break;
        }
        return n >= 4;
      });

      const low = (c) => b[c].indexOf(null);
      const u = () => { status.textContent = `${pName(cur)} ist dran`; };
      const paint = () => b.forEach((col, c) => col.forEach((v, r) => {
        cl[c][r].style.background = v == null ? '' : pCol[v];
      }));

      b.forEach((_, c) => {
        const e = $('button', 'sz-col');
        cl[c] = [];
        e.onclick = () => tap(c, null);
        for (let r = H - 1; r >= 0; r--) {
          const x = $('i', 'sz-cell');
          x.onclick = (ev) => { if (fr) { ev.stopPropagation(); tap(c, r); } };
          cl[c][r] = x;
          e.append(x);
        }
        g.append(e);
      });

      const tap = (c, r) => {
        if (over || bz || (o.m === 1 && cur === 1)) return;
        if (fr) { if (r == null) return; }
        else r = low(c);
        if (r < 0 || b[c][r] != null) return;
        put(c, r);
      };

      const put = (c, r) => {
        bz = 1;
        b[c][r] = cur;
        paint();
        later(() => {
          bz = 0;
          if (win(c, r, cur)) {
            over = 1;
            status.textContent = `${pName(cur)} gewinnt! 🏆`;
            return;
          }
          if (b.every((k) => k.every((v) => v != null))) {
            over = 1;
            status.textContent = 'Unentschieden';
            return;
          }
          cur = 1 - cur;
          u();
          if (o.m === 1 && cur === 1) later(ai, 300);
        }, 120);
      };

      const mvs = () => {
        const a = [];
        for (let c = 0; c < C; c++) for (let r = 0; r < H; r++)
          if (b[c][r] == null && (fr || r === low(c))) a.push([c, r]);
        return a;
      };

      const ai = () => {
        const ok = mvs();
        if (!ok.length) return;
        const t = (p) => ok.find(([c, r]) => { b[c][r] = p; const w = win(c, r, p); b[c][r] = null; return w; });
        if ((o.d ?? 1) === 0 && R(100) < 45) return put(...ok[R(ok.length)]);
        const choice = t(1) ?? t(0) ?? ok.find(([c]) => c === 3) ?? ok[R(ok.length)];
        put(...choice);
      };

      u();
    };

    mount();
  }
});

registerGame({
  id: 'woertle',
  title: 'Wörtle',
  icon: '🔠',
  cat: 'Wörter & Quiz',
  desc: 'Errate das gesuchte Wort. Grün: richtig. Gelb: falscher Platz. Grau: kommt nicht vor.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['l', 'Wortlänge', [['4 Buchstaben', 4], ['5 Buchstaben', 5], ['6 Buchstaben', 6]], 1],
      ['t', 'Versuche', [['8 Versuche', 8], ['6 Versuche', 6], ['4 Versuche', 4]], 1]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { setKey } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.width = '100%';
      container.append(playArea);

      const L = o.l ?? 5, T = o.t ?? 6;
      const RAW = ('APFEL BIRNE BLUME BRIEF BRUST BUCHE DACHS DECKE ENGEL FARBE FEUER FILME FISCH FLUSS FRAGE FUCHS GABEL GRUND HAFEN HASEN HONIG HUNDE INSEL JUNGE KATZE KERZE KLEID KOHLE KRAFT KREIS LAMPE LEBEN LICHT LINSE LÖWEN MACHT MAUER MILCH MONAT MÜHLE MUSIK NACHT NADEL NEBEL OZEAN PFERD PILZE PUPPE QUARK RADIO REGEL REISE ROBBE ROSEN SCHAF SCHAL SCHUH SEIDE SONNE SPIEL STADT STEIN STERN STIFT STUHL TASSE TIGER TISCH TRAUM TÜREN VOGEL WAAGE WELLE WIESE WOLKE WURST ZEBRA ZIEGE ZWERG '
        + 'AUTO BALL BAUM BETT BIER BILD BLAU BOOT BROT BUCH DACH DORF ENTE ERDE ESEL FELD FILM FREI GANS GELB GELD GRAS GRÜN HAND HASE HAUS HELD HERZ HOSE HUHN JAHR JUNG KALT KIND KINO KOPF LAND LAUT LEER LIED LUFT MAUS MEER MOND MUND NASE NEST OBST OFEN PAAR POST REIS ROCK ROSE SAND SAFT SALZ SEIL SOHN TAXI TIER TURM VASE WALD WAND WIND WOLF ZAHN ZELT '
        + 'BANANE BRÜCKE DRACHEN ELEFANT FENSTER FREUND GARTEN GITARRE HAMMER HIMMEL KAFFEE KÄFIG KELLER KIRCHE KLEBER LEITER MÄRCHEN MUSTER NUDELN ORANGE PAPIER RAKETE REGAL SCHERE SCHLÜSSEL SESSEL SPINNE STRAND STRASSE TELLER TREPPE TURNEN WINTER WOLKEN ZAUBER ZIEGEL ZITRONE ZUCKER ABEND AFFEN BADEN BERGE BLATT BRAUN BRILLE GEBÄUDE HÜGEL KÄSE KÜRBIS LATERNE MURMEL PINSEL PUDDING RUCKSACK TOMATE TASCHE TUNNEL VULKAN WAGEN ZIRKUS').split(' ');
      const pool = RAW.filter((w) => w.length === L);
      const w = (pool.length ? pool : RAW)[R((pool.length ? pool : RAW).length)];

      const box = $('div', 'sz-wg'), kb = $('div', 'sz-wk');
      box.style.setProperty('--rows', T);
      playArea.append(box, kb);

      let rows = [], cur = '', done = 0, kc = {}, fresh = -1;
      const rk = { g: 3, y: 2, a: 1 };

      const sc = (g) => {
        const r = Array(w.length).fill('a'), u = [...w];
        for (let i = 0; i < w.length; i++) if (g[i] === w[i]) { r[i] = 'g'; u[i] = null; }
        for (let i = 0; i < w.length; i++) if (r[i] === 'a') {
          const k = u.indexOf(g[i]);
          if (k >= 0) { r[i] = 'y'; u[k] = null; }
        }
        return r;
      };

      const draw = () => {
        box.innerHTML = '';
        for (let r = 0; r < T; r++) {
          const row = $('div', 'sz-wr'), g = rows[r];
          for (let c = 0; c < w.length; c++) {
            row.append($('div', 'sz-wc' + (g ? ' ' + g.s[c] : '') + (g && r === fresh ? ' flip' : ''), g ? g.w[c] : r === rows.length ? cur[c] || '' : ''));
          }
          box.append(row);
        }
        kb.innerHTML = '';
        ['QWERTZUIOPÜ', 'ASDFGHJKLÖÄ', '⏎YXCVBNM⌫'].forEach((l) => {
          const row = $('div', 'sz-wr');
          [...l].forEach((k) => {
            const b = $('button', 'sz-wkb ' + (kc[k] || ''), k);
            b.onclick = () => key(k);
            row.append(b);
          });
          kb.append(row);
        });
        status.textContent = done === 1 ? '🎉 Richtig!' : done === 2 ? 'Das Wort war ' + w : `Versuch ${Math.min(rows.length + 1, T)} von ${T} · ${w.length} Buchstaben`;
      };

      const key = (k) => {
        if (done) return;
        if (k !== '⏎') fresh = -1;
        if (k === '⌫') cur = cur.slice(0, -1);
        else if (k === '⏎') {
          if (cur.length < w.length) return;
          const r = sc(cur);
          rows.push({ w: cur, s: r });
          fresh = rows.length - 1;
          [...cur].forEach((ch, i) => { if (!kc[ch] || rk[r[i]] > rk[kc[ch]]) kc[ch] = r[i]; });
          if (cur === w) done = 1;
          else if (rows.length >= T) done = 2;
          cur = '';
        } else if (cur.length < w.length && /^[A-ZÄÖÜ]$/.test(k)) {
          cur += k;
        }
        draw();
      };

      setKey((e) => key(e.key === 'Enter' ? '⏎' : e.key === 'Backspace' ? '⌫' : e.key.toUpperCase()));
      draw();
    };

    mount();
  }
});

registerGame({
  id: 'wuerfelkoenig',
  title: 'Würfelkönig',
  icon: '🎲',
  cat: 'Puzzle',
  desc: 'Bis zu 3 Würfe pro Runde. Würfel antippen zum Behalten, dann ein Feld wählen. 13 Runden.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['m', 'Modus', [['Allein', 1], ['Zu zweit', 2], ['Gegen Computer', 3]], 2]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { later } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.width = '100%';
      container.append(playArea);

      const ai = o.m === 3, np = o.m === 1 ? 1 : 2;
      const pNames = np === 1 ? [SZ.names[0]] : [SZ.names[0], ai ? 'Computer' : SZ.names[1]];
      const CT = ['Einser','Zweier','Dreier','Vierer','Fünfer','Sechser','Dreierpasch','Viererpasch','Full House','Kleine Straße','Große Straße','Fünferpasch','Chance'];
      const EX = [3, 6, 9, 12, 15, 18, 22, 13, 13, 12, 16, 18, 22];
      const S = Array.from({ length: np }, () => Array(13).fill(null));
      const box = $('div', 'sz-kn');
      playArea.append(box);

      let d = [1, 1, 1, 1, 1], hd = [0, 0, 0, 0, 0], rl = 0, cur = 0, done = 0, rolling = 0;

      const pts = (k, dice) => {
        const c = [0, 0, 0, 0, 0, 0, 0];
        dice.forEach((v) => c[v]++);
        const sm = dice.reduce((a, b) => a + b, 0);
        const mx = Math.max(...c);
        const r = (...a) => a.every((v) => c[v]);
        return k < 6 ? c[k + 1] * (k + 1)
          : k === 6 ? (mx >= 3 ? sm : 0)
          : k === 7 ? (mx >= 4 ? sm : 0)
          : k === 8 ? (c.includes(3) && c.includes(2) ? 25 : 0)
          : k === 9 ? (r(1,2,3,4) || r(2,3,4,5) || r(3,4,5,6) ? 30 : 0)
          : k === 10 ? (r(1,2,3,4,5) || r(2,3,4,5,6) ? 40 : 0)
          : k === 11 ? (mx === 5 ? 50 : 0)
          : sm;
      };

      const tot = (p) => {
        const u = S[p].slice(0, 6).reduce((a, b) => a + (b || 0), 0);
        return S[p].reduce((a, b) => a + (b || 0), 0) + (u >= 63 ? 35 : 0);
      };

      const hum = () => !(ai && cur === 1);

      const roll = () => {
        if (rl >= 3 || !hum() || done || rolling) return;
        rolling = 1;
        const keep = [...hd], t0 = performance.now();
        const spin = () => {
          const q = performance.now() - t0;
          d = d.map((v, i) => (keep[i] ? v : 1 + R(6)));
          draw(1);
          if (q < 420) later(spin, 60);
          else { rolling = 0; rl++; draw(); }
        };
        spin();
      };

      const pick = (k) => {
        if (S[cur][k] != null) return;
        S[cur][k] = pts(k, d);
        rl = 0;
        hd = [0, 0, 0, 0, 0];
        if (S.every((row) => row.every((v) => v != null))) {
          done = 1;
          const w = np > 1 && tot(1) > tot(0) ? 1 : 0;
          status.textContent = np > 1
            ? (tot(0) === tot(1) ? 'Unentschieden' : `${pNames[w]} gewinnt! 🏆`)
            : `🎉 ${tot(0)} Punkte`;
        } else {
          cur = (cur + 1) % np;
          if (!hum()) later(aiRoll, 800);
        }
        draw();
      };

      const aiRoll = () => {
        d = d.map((v, i) => (hd[i] ? v : 1 + R(6)));
        rl++;
        if (rl < 3) {
          const c = [0, 0, 0, 0, 0, 0, 0];
          d.forEach((v) => c[v]++);
          let b = 1;
          for (let v = 2; v < 7; v++) if (c[v] >= c[b]) b = v;
          hd = d.map((v) => +(v === b));
          draw();
          later(aiRoll, 900);
        } else {
          draw();
          later(() => {
            const free = [...Array(13).keys()].filter((k) => S[1][k] == null);
            free.sort((a, b) => (pts(b, d) - EX[b]) - (pts(a, d) - EX[a]));
            pick(free[0]);
          }, 900);
        }
      };

      const draw = (spinning = 0) => {
        box.innerHTML = '';
        if (!done) status.textContent = `${pNames[cur]} · Wurf ${rl}/3`;

        const L = $('div', 'sz-kd'), D = $('div', 'sz-dice');
        d.forEach((v, i) => {
          const b = $('button', 'sz-dc' + (hd[i] ? ' h' : '') + (spinning && !hd[i] ? ' roll' : ''), '⚀⚁⚂⚃⚄⚅'[v - 1]);
          b.onclick = () => { if (rl && rl < 3 && hum() && !done && !rolling) { hd[i] ^= 1; draw(); } };
          D.append(b);
        });

        const r = $('button', 'sz-btn sz-btn-primary', rl >= 3 ? 'Feld wählen' : 'Würfeln');
        r.disabled = rl >= 3 || !hum() || done || rolling;
        r.onclick = roll;
        L.append(D, r, $('small', null, 'Würfel antippen = behalten'));

        const T = $('table', 'sz-kt');
        T.innerHTML = `<tr><td></td>${pNames.map((n) => `<th>${n}</th>`).join('')}</tr>`;
        CT.forEach((n, k) => {
          const tr = $('tr');
          tr.append($('td', null, n));
          pNames.forEach((_, p) => {
            const td = $('td');
            if (S[p][k] != null) td.textContent = S[p][k];
            else if (p === cur && rl && hum() && !done && !rolling) {
              td.textContent = pts(k, d);
              td.className = 'pk';
              td.onclick = () => pick(k);
            }
            tr.append(td);
          });
          T.append(tr);
        });
        T.append($('tr', null, `<td><b>Summe</b> (Bonus +35 ab 63 oben)</td>${pNames.map((_, p) => `<td><b>${tot(p)}</b></td>`).join('')}`));

        box.append(L, T);
      };

      draw();
    };

    mount();
  }
});

registerGame({
  id: 'zahlenfusion',
  title: 'Zahlenfusion',
  icon: '🔢',
  cat: 'Puzzle',
  desc: 'Wische in eine Richtung, alle Kacheln rutschen. Zwei gleiche Zahlen verschmelzen zur doppelten.',
  run({ body, status }) {
    const { bar, state: o } = buildOptionBar([
      ['n', 'Spielfeld', [['Klassisch 4×4', 4], ['Leicht 5×5', 5], ['Schwer 3×3', 3]], 0]
    ], () => mount());

    const container = $('div', null, '');
    container.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:100%';
    container.append(bar);
    body.append(container);

    let playArea = null;
    const mount = () => {
      if (playArea) playArea.remove();
      const { later, setKey } = makeRuntime();
      playArea = $('div', null, '');
      playArea.style.width = '100%';
      container.append(playArea);

      const N = o.n ?? 4, key = 'sz_g48_' + N;
      const g = $('div', 'sz-g48');
      g.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
      for (let i = 0; i < N * N; i++) g.append($('div', 'sz-tb'));
      playArea.append(g);

      let best = 0;
      try { best = +localStorage.getItem(key) || 0; } catch (_) {}

      let nbz = 0, won = 0, b = Array.from({ length: N }, () => Array(N).fill(null)), sc = 0, over = 0, lk = 0, sx = 0, sy = 0;

      const col = (v) => `hsl(${(Math.log2(v) * 34 + 14) % 360} 72% ${v < 8 ? 66 : 56}%)`;
      const pos = (t) => `translate(${t.c * 100}%, ${t.r * 100}%)`;
      const upd = () => { status.textContent = `Punkte ${sc} · 🏆 ${best}` + (won ? ' · 🎉 2048 erreicht!' : ''); };

      const tw = (t) => {
        const inner = t.el.firstChild;
        inner.textContent = t.v;
        inner.style.background = col(t.v);
        inner.style.fontSize = t.v > 999 ? '20px' : t.v > 99 ? '26px' : '32px';
        inner.style.color = t.v < 8 ? '#5b4a2a' : '#fff';
      };

      const add = () => {
        const e = [];
        b.forEach((row, r) => row.forEach((v, c) => { if (!v) e.push([r, c]); }));
        if (!e.length) return;
        const [r, c] = e[R(e.length)];
        const t = { v: R(10) ? 2 : 4, r, c, el: $('div', 'sz-tl new') };
        t.el.style.width = t.el.style.height = (100 / N) + '%';
        t.el.append($('i'));
        tw(t);
        t.el.style.transform = pos(t);
        g.append(t.el);
        b[r][c] = t;
      };

      const can = () => b.some((row, r) => row.some((t, c) =>
        !t || (c < N - 1 && row[c + 1] && row[c + 1].v === t.v) || (r < N - 1 && b[r + 1][c] && b[r + 1][c].v === t.v)
      ));

      const mv = (dx, dy) => {
        if (lk || over) return;
        let moved = 0, gain = 0;
        const mg = [];
        for (let k = 0; k < N; k++) {
          const co = [];
          for (let i = 0; i < N; i++) co.push(dx ? [k, dx < 0 ? i : N - 1 - i] : [dy < 0 ? i : N - 1 - i, k]);
          const ts = co.map(([r, c]) => b[r][c]).filter(Boolean), out = [];
          for (let i = 0; i < ts.length; i++) {
            if (i + 1 < ts.length && ts[i].v === ts[i + 1].v) { out.push([ts[i], ts[i + 1]]); i++; }
            else out.push([ts[i]]);
          }
          co.forEach(([r, c]) => { b[r][c] = null; });
          out.forEach((u, j) => {
            const [r, c] = co[j];
            u.forEach((t) => { if (t.r !== r || t.c !== c) moved = 1; t.r = r; t.c = c; });
            b[r][c] = u[0];
            if (u[1]) { mg.push(u); moved = 1; }
          });
        }
        if (!moved) return;
        lk = 1;
        b.forEach((row) => row.forEach((t) => { if (t) t.el.style.transform = pos(t); }));
        mg.forEach(([a, c]) => { c.el.style.transform = pos(a); });
        later(() => {
          mg.forEach(([a, c]) => {
            c.el.remove();
            a.v *= 2;
            gain += a.v;
            if (a.v >= 2048) won = 1;
            tw(a);
            a.el.classList.remove('new', 'mg');
            void a.el.offsetWidth;
            a.el.classList.add('mg');
          });
          sc += gain;
          if (sc > best) {
            best = sc; nbz = 1;
            try { localStorage.setItem(key, String(best)); } catch (_) {}
          }
          add();
          upd();
          lk = 0;
          if (!can()) {
            over = 1;
            status.textContent = `Keine Züge mehr · ${sc} Punkte · 🏆 ${best}` + (nbz ? ' · Neuer Bestwert!' : '');
          }
        }, 130);
      };

      g.onpointerdown = (e) => { sx = e.clientX; sy = e.clientY; };
      g.onpointerup = (e) => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) mv(Math.sign(dx), 0);
        else mv(0, Math.sign(dy));
      };

      setKey((e) => {
        const m = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[e.key];
        if (m) { e.preventDefault(); mv(...m); }
      });

      add(); add(); upd();
    };

    mount();
  }
});

// ==========================================
// 2. WEITERE DIREKT SPIELBARE MODULE
// ==========================================

registerGame({
  id: 'orakel',
  title: 'Orakel',
  icon: '🎡',
  cat: 'Partyspiele',
  desc: 'Eigene Fragen eingeben und das Glücksrad auf eine Person aus der Runde zeigen lassen.',
  run({ body, status }) {
    const { trackRaf } = makeRuntime();
    const wrap = $('div', null, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:center;width:100%;max-width:920px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
          <div style="font-size:24px">▼</div>
          <canvas id="ora-cv" width="320" height="320" style="max-width:100%;border-radius:50%"></canvas>
          <button id="ora-spin" class="sz-btn sz-btn-primary">Glücksrad drehen</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <label class="sz-field">
            <span>Orakel-Frage</span>
            <input id="ora-q" type="text" value="Wer landet am ehesten auf der Straße?" />
          </label>
          <label class="sz-field">
            <span>Teilnehmende (kommagetrennt)</span>
            <input id="ora-names" type="text" value="${SZ.group.join(', ')}" />
          </label>
          <div id="ora-res" style="padding:14px;border-radius:12px;background:var(--sz-surface-2);font-size:17px;font-weight:700;min-height:54px">
            Bereit für die nächste Frage.
          </div>
        </div>
      </div>
    `);
    body.append(wrap);

    const cv = wrap.querySelector('#ora-cv');
    const ctx = cv.getContext('2d');
    const qInput = wrap.querySelector('#ora-q');
    const nInput = wrap.querySelector('#ora-names');
    const resEl = wrap.querySelector('#ora-res');
    const spinBtn = wrap.querySelector('#ora-spin');
    let angle = 0, spinning = 0;
    const palette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    const getList = () => {
      const arr = nInput.value.split(',').map((s) => s.trim()).filter(Boolean);
      return arr.length >= 2 ? arr : ['Spieler 1', 'Spieler 2'];
    };

    const drawWheel = () => {
      const list = getList();
      const step = (Math.PI * 2) / list.length;
      ctx.clearRect(0, 0, cv.width, cv.height);
      const cx = cv.width / 2, cy = cv.height / 2, r = cx - 6;
      list.forEach((name, idx) => {
        const a0 = angle + idx * step, a1 = a0 + step;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
        ctx.fillStyle = palette[idx % palette.length]; ctx.fill();
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a0 + step / 2);
        ctx.fillStyle = '#fff'; ctx.font = '800 15px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(name.slice(0, 14), r - 14, 5); ctx.restore();
      });
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fillStyle = '#0f1324'; ctx.fill();
    };

    spinBtn.onclick = () => {
      if (spinning) return;
      spinning = 1;
      const list = getList(), start = performance.now(), duration = 2200, startAngle = angle;
      const extra = Math.PI * 8 + Math.random() * Math.PI * 2;
      const stepFrame = (now) => {
        const t = Math.min(1, (now - start) / duration);
        angle = startAngle + extra * (1 - Math.pow(1 - t, 3));
        drawWheel();
        if (t < 1) trackRaf(requestAnimationFrame(stepFrame));
        else {
          spinning = 0;
          const step = (Math.PI * 2) / list.length;
          const pointerAngle = ((Math.PI * 1.5 - angle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          const winner = list[Math.floor(pointerAngle / step) % list.length];
          resEl.textContent = `🔮 ${qInput.value.trim() || 'Das Orakel sagt:'} → ${winner}!`;
          status.textContent = `Ergebnis: ${winner}`;
        }
      };
      trackRaf(requestAnimationFrame(stepFrame));
    };

    nInput.oninput = drawWheel;
    drawWheel();
  }
});

registerGame({
  id: 'sand-fall',
  title: 'Sand Fall',
  icon: '⏳',
  cat: 'Simulation',
  desc: 'Lass bunten Sand rieseln und ziehe Barrieren auf dem Feld.',
  run({ body, status }) {
    const { trackRaf } = makeRuntime();
    const W = 120, H = 80, scale = 6;
    const cv = $('canvas', null);
    cv.width = W * scale; cv.height = H * scale;
    cv.style.cssText = 'max-width:100%;border-radius:12px;touch-action:none';

    let mode = 'sand';
    const sandBtn = $('button', 'sz-btn sz-btn-primary', 'Sand');
    const wallBtn = $('button', 'sz-btn sz-btn-ghost', 'Wand');
    const clrBtn = $('button', 'sz-btn sz-btn-ghost', 'Leeren');
    const setMode = (m) => {
      mode = m;
      sandBtn.className = 'sz-btn ' + (m === 'sand' ? 'sz-btn-primary' : 'sz-btn-ghost');
      wallBtn.className = 'sz-btn ' + (m === 'wall' ? 'sz-btn-primary' : 'sz-btn-ghost');
    };
    sandBtn.onclick = () => setMode('sand');
    wallBtn.onclick = () => setMode('wall');

    const box = $('div', null, '');
    box.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:10px;width:100%';
    box.append($('div', 'sz-controls', ''), cv);
    box.firstChild.append(sandBtn, wallBtn, clrBtn);
    body.append(box);

    const ctx = cv.getContext('2d');
    let grid = Array.from({ length: H }, () => Array(W).fill(0));
    clrBtn.onclick = () => { grid = Array.from({ length: H }, () => Array(W).fill(0)); };

    let pointerDown = false;
    const paintAt = (e) => {
      const rect = cv.getBoundingClientRect();
      const gx = Math.floor(((e.clientX - rect.left) / rect.width) * W);
      const gy = Math.floor(((e.clientY - rect.top) / rect.height) * H);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const x = gx + dx, y = gy + dy;
        if (x >= 0 && x < W && y >= 0 && y < H) {
          if (mode === 'wall') grid[y][x] = -1;
          else if (grid[y][x] === 0 && Math.random() < 0.7) grid[y][x] = 35 + ((gx * 2 + R(30)) % 45);
        }
      }
    };

    cv.onpointerdown = (e) => { pointerDown = true; cv.setPointerCapture(e.pointerId); paintAt(e); };
    cv.onpointermove = (e) => { if (pointerDown) paintAt(e); };
    cv.onpointerup = cv.onpointercancel = () => { pointerDown = false; };

    const loop = () => {
      for (let y = H - 2; y >= 0; y--) for (let x = 0; x < W; x++) {
        const v = grid[y][x];
        if (v > 0) {
          if (grid[y + 1][x] === 0) { grid[y + 1][x] = v; grid[y][x] = 0; }
          else {
            const dir = R(2) ? 1 : -1;
            if (x + dir >= 0 && x + dir < W && grid[y + 1][x + dir] === 0) { grid[y + 1][x + dir] = v; grid[y][x] = 0; }
            else if (x - dir >= 0 && x - dir < W && grid[y + 1][x - dir] === 0) { grid[y + 1][x - dir] = v; grid[y][x] = 0; }
          }
        }
      }
      ctx.fillStyle = '#0b0e1a'; ctx.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const v = grid[y][x];
        if (v === -1) { ctx.fillStyle = '#64748b'; ctx.fillRect(x * scale, y * scale, scale, scale); }
        else if (v > 0) { ctx.fillStyle = `hsl(${v} 85% 60%)`; ctx.fillRect(x * scale, y * scale, scale, scale); }
      }
      status.textContent = mode === 'sand' ? 'Modus: Sand streuen' : 'Modus: Wände zeichnen';
      trackRaf(requestAnimationFrame(loop));
    };
    trackRaf(requestAnimationFrame(loop));
  }
});

registerGame({
  id: 'oh-h1',
  title: '0h h1',
  icon: '🔵',
  cat: 'Puzzle',
  desc: 'Fülle jedes Feld mit Rot oder Blau – maximal zwei gleiche direkt nebeneinander.',
  run({ body, status }) {
    const N = 6;
    const solution = [
      [1,2,1,2,2,1],[2,1,2,1,1,2],[1,1,2,1,2,2],
      [2,2,1,2,1,1],[1,2,2,1,1,2],[2,1,1,2,2,1]
    ];
    const clues = [
      [1,0,0,2,0,0],[0,0,2,0,0,2],[0,1,0,0,2,0],
      [2,0,0,2,0,0],[0,0,2,0,1,0],[0,1,0,0,0,1]
    ];
    let grid = clues.map((r) => [...r]);
    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(6,54px);gap:8px';

    const checkBoard = () => {
      if (grid.every((r, y) => r.every((v, x) => v === solution[y][x]))) status.textContent = '🎉 Rätsel gelöst!';
      else {
        const open = grid.flat().filter((v) => v === 0).length;
        status.textContent = open ? `Noch ${open} Felder offen` : 'Prüfe Reihen & Nachbarn (max. 2 gleich)';
      }
    };

    const render = () => {
      wrap.innerHTML = '';
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const locked = clues[y][x] !== 0, val = grid[y][x];
        const btn = $('button', 'sz-btn', locked ? '🔒' : '');
        btn.style.cssText = `width:54px;height:54px;border-radius:12px;padding:0;font-size:14px;background:${
          val === 1 ? '#ef4444' : val === 2 ? '#3b82f6' : '#28325c'
        }`;
        if (!locked) btn.onclick = () => { grid[y][x] = (grid[y][x] + 1) % 3; render(); checkBoard(); };
        wrap.append(btn);
      }
    };

    body.append(wrap);
    render();
    checkBoard();
  }
});

registerGame({
  id: 'laengen-schaetzen',
  title: 'Linien-Schätzer (kalibriert)',
  icon: '📏',
  cat: 'Alltag & Wissen',
  desc: 'Einmal den Bildschirm kalibrieren und danach angezeigte Linienlängen in cm schätzen.',
  run({ body, status }) {
    let pxPerCm = Number(localStorage.getItem('sz_px_per_cm') || 38);
    let targetCm = 8;

    const wrap = $('div', null, `
      <div style="display:flex;flex-direction:column;gap:16px;width:100%;max-width:720px;align-items:center">
        <div style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <label class="sz-field" style="flex:1;min-width:220px">
            <span>Kalibrierung (Pixel pro cm, aktuell ${pxPerCm.toFixed(1)} px/cm):</span>
            <input id="cal-range" type="range" min="25" max="65" step="0.5" value="${pxPerCm}" />
          </label>
          <button id="new-line" class="sz-btn sz-btn-ghost">Neue Linie</button>
        </div>
        <div style="width:100%;min-height:90px;display:flex;align-items:center;justify-content:center;background:var(--sz-bg);border-radius:12px;padding:16px">
          <div id="line-bar" style="height:6px;border-radius:999px;background:#38bdf8"></div>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input id="guess-cm" type="number" step="0.5" min="1" max="30" placeholder="Schätzung in cm" style="width:150px;padding:10px;border-radius:10px;border:1px solid var(--sz-border);background:var(--sz-bg);color:var(--sz-text);font-size:16px" />
          <button id="check-cm" class="sz-btn sz-btn-primary">Prüfen</button>
          <span id="cm-fb" style="font-weight:700"></span>
        </div>
      </div>
    `);
    body.append(wrap);

    const rangeEl = wrap.querySelector('#cal-range');
    const lineEl = wrap.querySelector('#line-bar');
    const guessEl = wrap.querySelector('#guess-cm');
    const fbEl = wrap.querySelector('#cm-fb');

    const drawLine = () => {
      lineEl.style.width = Math.round(targetCm * pxPerCm) + 'px';
      fbEl.textContent = '';
      guessEl.value = '';
      status.textContent = `Kalibriert: ${pxPerCm.toFixed(1)} px/cm`;
    };

    const nextLine = () => { targetCm = (4 + R(17)) + (R(2) ? 0.5 : 0); drawLine(); };

    rangeEl.oninput = () => {
      pxPerCm = parseFloat(rangeEl.value);
      try { localStorage.setItem('sz_px_per_cm', String(pxPerCm)); } catch (_) {}
      drawLine();
    };

    wrap.querySelector('#new-line').onclick = nextLine;
    wrap.querySelector('#check-cm').onclick = () => {
      const val = parseFloat(guessEl.value);
      if (Number.isNaN(val)) return;
      fbEl.textContent = `Echt: ${targetCm.toFixed(1)} cm (Abweichung: ${Math.abs(val - targetCm).toFixed(1)} cm)`;
    };

    nextLine();
  }
});

// ==========================================
// 3. WEITERE AUSGEBAUTE WUNSCHLISTENTITEL
// ==========================================

registerGame({
  id: 'mastermind',
  title: 'Mastermind',
  icon: '🎯',
  cat: 'Puzzle',
  desc: 'Knacke den geheimen 4er-Farbcode in 8 Versuchen. Grün = Farbe & Platz richtig, Gelb = richtige Farbe, falscher Platz.',
  run({ body, status }) {
    const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
    const MAX_TRIES = 8;
    const secret = Array.from({ length: 4 }, () => COLORS[R(COLORS.length)]);
    let guesses = [];
    let current = [COLORS[0], COLORS[1], COLORS[2], COLORS[3]];
    let activeSlot = 0;
    let over = false;

    const wrap = $('div', 'sz-mm');
    const historyEl = $('div', null, '');
    historyEl.style.cssText = 'display:flex;flex-direction:column;gap:8px;max-height:280px;overflow:auto';

    const pickerRow = $('div', 'sz-mm-row');
    const slotButtons = [];
    for (let i = 0; i < 4; i++) {
      const btn = $('button', 'sz-peg');
      btn.onclick = () => { activeSlot = i; render(); };
      slotButtons.push(btn);
    }
    const checkBtn = $('button', 'sz-btn sz-btn-primary', 'Prüfen');

    const paletteRow = $('div', 'sz-mm-row');
    COLORS.forEach((col) => {
      const p = $('button', 'sz-peg');
      p.style.background = col;
      p.onclick = () => {
        if (over) return;
        current[activeSlot] = col;
        activeSlot = (activeSlot + 1) % 4;
        render();
      };
      paletteRow.append(p);
    });

    const evaluate = (guess) => {
      let exact = 0;
      const sRem = [], gRem = [];
      for (let i = 0; i < 4; i++) {
        if (guess[i] === secret[i]) exact++;
        else { sRem.push(secret[i]); gRem.push(guess[i]); }
      }
      let near = 0;
      gRem.forEach((c) => {
        const idx = sRem.indexOf(c);
        if (idx >= 0) { near++; sRem.splice(idx, 1); }
      });
      return { exact, near };
    };

    checkBtn.onclick = () => {
      if (over) return;
      const res = evaluate(current);
      guesses.push({ guess: [...current], ...res });
      if (res.exact === 4) {
        over = true;
        status.textContent = `🎉 Code in ${guesses.length} Versuchen geknackt!`;
      } else if (guesses.length >= MAX_TRIES) {
        over = true;
        status.textContent = 'Keine Versuche mehr – Code wurde nicht geknackt.';
      } else {
        status.textContent = `Versuch ${guesses.length + 1} von ${MAX_TRIES}`;
      }
      render();
    };

    const render = () => {
      historyEl.innerHTML = '';
      guesses.forEach((g, idx) => {
        const row = $('div', 'sz-mm-row');
        const pegs = $('div', 'sz-mm-pegs');
        g.guess.forEach((c) => {
          const d = $('span', 'sz-peg');
          d.style.background = c;
          d.style.cursor = 'default';
          pegs.append(d);
        });
        const hints = $('div', 'sz-mm-hints');
        for (let h = 0; h < 4; h++) {
          const dot = $('span', 'sz-hint-dot' + (h < g.exact ? ' exact' : h < g.exact + g.near ? ' near' : ''));
          hints.append(dot);
        }
        row.append($('span', null, `#${idx + 1}`), pegs, hints);
        historyEl.append(row);
      });

      pickerRow.innerHTML = '';
      slotButtons.forEach((btn, i) => {
        btn.style.background = current[i];
        btn.style.outline = i === activeSlot ? '3px solid #fff' : 'none';
        pickerRow.append(btn);
      });
      pickerRow.append(checkBtn);
      checkBtn.disabled = over;
    };

    wrap.append(historyEl, pickerRow, paletteRow);
    body.append(wrap);
    status.textContent = `Versuch 1 von ${MAX_TRIES}`;
    render();
  }
});

registerGame({
  id: 'farben-verbinden',
  title: 'Farben verbinden',
  icon: '🔗',
  cat: 'Puzzle',
  desc: 'Verbinde gleichfarbige Punkte auf dem 5×5-Feld, ohne dass sich Wege kreuzen.',
  run({ body, status }) {
    const N = 5;
    const endpoints = {
      0: 1, 22: 1,
      2: 2, 17: 2,
      6: 3, 18: 3,
      10: 4, 24: 4
    };
    const palette = { 1: '#ef4444', 2: '#22c55e', 3: '#3b82f6', 4: '#eab308' };
    let owner = Array(N * N).fill(0);
    Object.entries(endpoints).forEach(([idx, col]) => { owner[Number(idx)] = col; });

    let activeColor = 0;
    let drawing = false;
    const gridEl = $('div', 'sz-fn-grid');
    body.append(gridEl);

    const checkWin = () => {
      const pairs = [1, 2, 3, 4];
      const ok = pairs.every((c) => {
        const ends = Object.entries(endpoints).filter(([, v]) => v === c).map(([k]) => Number(k));
        return ends.length === 2 && owner[ends[0]] === c && owner[ends[1]] === c && owner.includes(c);
      });
      if (ok && owner.every((v) => v > 0)) {
        status.textContent = '🎉 Alle Farben perfekt verbunden!';
      } else {
        status.textContent = activeColor ? `Verbinde Farbe ${activeColor}…` : 'Ziehe oder tippe von einem Farbpunkt aus';
      }
    };

    const paintCell = (idx) => {
      if (!drawing || !activeColor) return;
      const ep = endpoints[idx];
      if (ep && ep !== activeColor) return;
      if (owner[idx] && owner[idx] !== activeColor && !ep) return;
      owner[idx] = activeColor;
      render();
      checkWin();
    };

    const render = () => {
      gridEl.innerHTML = '';
      for (let i = 0; i < N * N; i++) {
        const cell = $('div', 'sz-fn-cell');
        const c = owner[i];
        if (c) cell.style.background = palette[c] + '33';
        if (endpoints[i]) {
          const dot = $('span', 'sz-fn-dot');
          dot.style.background = palette[endpoints[i]];
          cell.append(dot);
        }
        cell.onpointerdown = () => {
          const ep = endpoints[i];
          if (ep) {
            activeColor = ep;
            drawing = true;
            owner = owner.map((v, k) => (v === ep && !endpoints[k] ? 0 : v));
            render();
            checkWin();
          } else if (activeColor) {
            drawing = true;
            paintCell(i);
          }
        };
        cell.onpointerenter = () => { if (drawing) paintCell(i); };
        gridEl.append(cell);
      }
    };

    window.addEventListener('pointerup', () => { drawing = false; });
    render();
    checkWin();
  }
});

registerGame({
  id: 'laender-der-welt',
  title: 'Länder der Welt lernen',
  icon: '🌍',
  cat: 'Wissen & Quiz',
  desc: 'Lerne Flaggen, Hauptstädte und Kontinente von Ländern weltweit.',
  run({ body, status }) {
    const COUNTRIES = [
      { name: 'Deutschland', flag: '🇩🇪', capital: 'Berlin', cont: 'Europa' },
      { name: 'Japan', flag: '🇯🇵', capital: 'Tokio', cont: 'Asien' },
      { name: 'Brasilien', flag: '🇧🇷', capital: 'Brasília', cont: 'Südamerika' },
      { name: 'Kanada', flag: '🇨🇦', capital: 'Ottawa', cont: 'Nordamerika' },
      { name: 'Australien', flag: '🇦🇺', capital: 'Canberra', cont: 'Australien / Ozeanien' },
      { name: 'Ägypten', flag: '🇪🇬', capital: 'Kairo', cont: 'Afrika' },
      { name: 'Norwegen', flag: '🇳🇴', capital: 'Oslo', cont: 'Europa' },
      { name: 'Italien', flag: '🇮🇹', capital: 'Rom', cont: 'Europa' },
      { name: 'Indien', flag: '🇮🇳', capital: 'Neu-Delhi', cont: 'Asien' },
      { name: 'Mexiko', flag: '🇲🇽', capital: 'Mexiko-Stadt', cont: 'Nordamerika' },
      { name: 'Argentinien', flag: '🇦🇷', capital: 'Buenos Aires', cont: 'Südamerika' },
      { name: 'Südafrika', flag: '🇿🇦', capital: 'Pretoria', cont: 'Afrika' }
    ];

    let score = 0, round = 0, current = null, locked = false;
    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:640px;text-align:center';

    const flagEl = $('div', null, '');
    flagEl.style.fontSize = '64px';
    const qEl = $('h3', null, '');
    qEl.style.margin = '0';
    const optsEl = $('div', null, '');
    optsEl.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:10px;width:100%';
    const fbEl = $('p', null, '');
    fbEl.style.cssText = 'min-height:24px;margin:0;font-weight:700';

    wrap.append(flagEl, qEl, optsEl, fbEl);
    body.append(wrap);

    const nextQ = () => {
      locked = false;
      round++;
      current = COUNTRIES[R(COUNTRIES.length)];
      const choices = [current];
      while (choices.length < 4) {
        const cand = COUNTRIES[R(COUNTRIES.length)];
        if (!choices.includes(cand)) choices.push(cand);
      }
      choices.sort(() => Math.random() - 0.5);

      flagEl.textContent = current.flag;
      qEl.textContent = `Welches Land gehört zu Hauptstadt ${current.capital} (${current.cont})?`;
      fbEl.textContent = '';
      optsEl.innerHTML = '';

      choices.forEach((c) => {
        const btn = $('button', 'sz-btn sz-btn-ghost', `${c.flag} ${c.name}`);
        btn.onclick = () => {
          if (locked) return;
          locked = true;
          if (c.name === current.name) {
            score++;
            btn.className = 'sz-btn sz-btn-primary';
            fbEl.textContent = `✔ Richtig! ${current.name} (${current.capital}, ${current.cont}).`;
          } else {
            btn.style.background = '#991b1b';
            fbEl.textContent = `✖ Gesucht war ${current.flag} ${current.name} (${current.capital}).`;
          }
          status.textContent = `Punkte: ${score} · Runde ${round}`;
          setTimeout(nextQ, 1100);
        };
        optsEl.append(btn);
      });
      status.textContent = `Punkte: ${score} · Runde ${round}`;
    };

    nextQ();
  }
});

registerGame({
  id: 'schiffe-versenken',
  title: 'Schiffe versenken',
  icon: '🚢',
  cat: 'Brettspiele',
  desc: 'Versenke alle gegnerischen Schiffe auf dem rechten Feld, bevor deine eigene Flotte sinkt.',
  run({ body, status }) {
    const N = 6;
    const placeFleet = () => {
      const grid = Array(N * N).fill(0);
      [3, 2, 2].forEach((len) => {
        let placed = false;
        for (let guard = 0; guard < 100 && !placed; guard++) {
          const horiz = R(2) === 0;
          const r = R(horiz ? N : N - len + 1);
          const c = R(horiz ? N - len + 1 : N);
          const cells = [];
          for (let k = 0; k < len; k++) cells.push((r + (horiz ? 0 : k)) * N + (c + (horiz ? k : 0)));
          if (cells.every((idx) => grid[idx] === 0)) {
            cells.forEach((idx) => { grid[idx] = 1; });
            placed = true;
          }
        }
      });
      return grid;
    };

    const myShips = placeFleet();
    const enemyShips = placeFleet();
    const myShots = Array(N * N).fill(0);
    const enemyShots = Array(N * N).fill(0);
    let over = false;

    const wrap = $('div', 'sz-bs-wrap');
    const leftBox = $('div', null, '<h4 style="margin:0 0 8px">Deine Flotte</h4>');
    const rightBox = $('div', null, '<h4 style="margin:0 0 8px">Gegnerisches Meer (tippen zum Schießen)</h4>');
    const leftGrid = $('div', 'sz-bs-grid');
    const rightGrid = $('div', 'sz-bs-grid');
    leftBox.append(leftGrid);
    rightBox.append(rightGrid);
    wrap.append(leftBox, rightBox);
    body.append(wrap);

    const checkEnd = () => {
      const enemyLeft = enemyShips.some((v, i) => v === 1 && myShots[i] !== 2);
      const myLeft = myShips.some((v, i) => v === 1 && enemyShots[i] !== 2);
      if (!enemyLeft) {
        over = true;
        status.textContent = '🏆 Alle gegnerischen Schiffe versenkt!';
        return true;
      }
      if (!myLeft) {
        over = true;
        status.textContent = '💥 Deine Flotte wurde versenkt!';
        return true;
      }
      return false;
    };

    const aiShoot = () => {
      const open = [...Array(N * N).keys()].filter((i) => enemyShots[i] === 0);
      if (!open.length) return;
      const pick = open[R(open.length)];
      enemyShots[pick] = myShips[pick] ? 2 : 1;
      render();
      checkEnd();
    };

    const render = () => {
      leftGrid.innerHTML = '';
      rightGrid.innerHTML = '';

      for (let i = 0; i < N * N; i++) {
        const lc = $('div', 'sz-bs-cell' + (enemyShots[i] === 2 ? ' hit' : enemyShots[i] === 1 ? ' miss' : myShips[i] ? ' ship' : ''),
          enemyShots[i] === 2 ? '💥' : enemyShots[i] === 1 ? '·' : myShips[i] ? '⛴' : '');
        lc.style.display = 'grid';
        lc.style.placeItems = 'center';
        leftGrid.append(lc);

        const rc = $('button', 'sz-bs-cell' + (myShots[i] === 2 ? ' hit' : myShots[i] === 1 ? ' miss' : ''),
          myShots[i] === 2 ? '💥' : myShots[i] === 1 ? '·' : '');
        rc.onclick = () => {
          if (over || myShots[i] !== 0) return;
          myShots[i] = enemyShips[i] ? 2 : 1;
          render();
          if (!checkEnd()) {
            status.textContent = 'Computer schießt…';
            setTimeout(() => {
              if (!over) {
                aiShoot();
                if (!over) status.textContent = 'Du bist dran – wähle ein Feld rechts';
              }
            }, 350);
          }
        };
        rightGrid.append(rc);
      }
    };

    status.textContent = 'Du bist dran – wähle ein Feld rechts';
    render();
  }
});

registerGame({
  id: 'brick-out',
  title: 'Brick Out - Stein Brecher',
  icon: '🧱',
  cat: 'Action',
  desc: 'Lenke den Schläger mit Finger, Maus oder Pfeiltasten und zerschlage alle Steine.',
  run({ body, status }) {
    const { trackRaf, setKey } = makeRuntime();
    const W = 520, H = 380;
    const cv = $('canvas', 'sz-brk-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let paddleX = W / 2 - 48;
    const paddleW = 96, paddleH = 12, paddleY = H - 28;
    let ball = { x: W / 2, y: paddleY - 12, vx: 3.1, vy: -3.4, r: 7 };
    let score = 0, lives = 3, over = false, keys = {};
    const cols = 8, rows = 4, bw = 54, bh = 18, gap = 6;
    const offsetX = (W - (cols * (bw + gap) - gap)) / 2;
    const palette = ['#ef4444', '#f59e0b', '#22c55e', '#38bdf8'];

    let bricks = [];
    const buildBricks = () => {
      bricks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          bricks.push({
            x: offsetX + c * (bw + gap),
            y: 36 + r * (bh + gap),
            w: bw, h: bh,
            alive: true,
            color: palette[r % palette.length]
          });
        }
      }
    };

    const resetBall = () => {
      ball = { x: paddleX + paddleW / 2, y: paddleY - 12, vx: (R(2) ? 1 : -1) * 3.1, vy: -3.4, r: 7 };
    };

    const movePaddleToClientX = (clientX) => {
      const rect = cv.getBoundingClientRect();
      const rel = ((clientX - rect.left) / rect.width) * W;
      paddleX = Math.max(0, Math.min(W - paddleW, rel - paddleW / 2));
    };

    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); movePaddleToClientX(e.clientX); };
    cv.onpointermove = (e) => { if (e.buttons || e.pointerType === 'touch') movePaddleToClientX(e.clientX); };

    setKey((e) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) {
        e.preventDefault();
        keys[e.key] = e.type === 'keydown';
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.key] = false; });

    const updStatus = () => {
      status.textContent = over
        ? `${lives > 0 ? '🏆 Alle Steine zerlegt!' : '💥 Spiel vorbei'} · Punkte: ${score}`
        : `Punkte: ${score} · Leben: ${'❤️'.repeat(Math.max(0, lives))}`;
    };

    const loop = () => {
      if (!over) {
        if (keys.ArrowLeft || keys.a) paddleX = Math.max(0, paddleX - 6);
        if (keys.ArrowRight || keys.d) paddleX = Math.min(W - paddleW, paddleX + 6);

        ball.x += ball.vx;
        ball.y += ball.vy;

        if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
        if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
        if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

        if (
          ball.vy > 0 &&
          ball.y + ball.r >= paddleY &&
          ball.y - ball.r <= paddleY + paddleH &&
          ball.x >= paddleX - ball.r &&
          ball.x <= paddleX + paddleW + ball.r
        ) {
          const hitNorm = ((ball.x - (paddleX + paddleW / 2)) / (paddleW / 2));
          ball.vx = hitNorm * 4.2;
          ball.vy = -Math.abs(ball.vy);
        }

        bricks.forEach((b) => {
          if (!b.alive) return;
          if (
            ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
            ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h
          ) {
            b.alive = false;
            ball.vy = -ball.vy;
            score += 10;
            updStatus();
          }
        });

        if (bricks.every((b) => !b.alive)) {
          over = true;
          updStatus();
        } else if (ball.y - ball.r > H) {
          lives--;
          if (lives <= 0) {
            over = true;
            updStatus();
          } else {
            resetBall();
            updStatus();
          }
        }
      }

      ctx.fillStyle = '#0b1120';
      ctx.fillRect(0, 0, W, H);

      bricks.forEach((b) => {
        if (!b.alive) return;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 5);
        ctx.fill();
      });

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.roundRect(paddleX, paddleY, paddleW, paddleH, 6);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    buildBricks();
    updStatus();
    trackRaf(requestAnimationFrame(loop));
  }
});

registerGame({
  id: 'sudoku',
  title: 'Sudoku',
  icon: '🔢',
  cat: 'Puzzle',
  desc: 'Fülle jede Zeile, jede Spalte und jeden 3×3-Block mit den Zahlen 1 bis 9.',
  run({ body, status }) {
    const baseSol = [
      [5,3,4,6,7,8,9,1,2],
      [6,7,2,1,9,5,3,4,8],
      [1,9,8,3,4,2,5,6,7],
      [8,5,9,7,6,1,4,2,3],
      [4,2,6,8,5,3,7,9,1],
      [7,1,3,9,2,4,8,5,6],
      [9,6,1,5,3,7,2,8,4],
      [2,8,7,4,1,9,6,3,5],
      [3,4,5,2,8,6,1,7,9]
    ];
    const perm = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5);
    const sol = baseSol.map((row) => row.map((v) => perm[v - 1]));

    const given = sol.map((row, r) => row.map((v, c) => (((r * 3 + c) % 4 === 0) ? v : 0)));
    let board = given.map((row) => [...row]);
    let selected = [0, 0];

    const wrap = $('div', 'sz-sd-wrap');
    const gridEl = $('div', 'sz-sd-grid');
    const padEl = $('div', 'sz-sd-numpad');
    wrap.append(gridEl, padEl);
    body.append(wrap);

    const isConflict = (r, c, val) => {
      if (!val) return false;
      for (let i = 0; i < 9; i++) {
        if (i !== c && board[r][i] === val) return true;
        if (i !== r && board[i][c] === val) return true;
      }
      const br = Math.floor(r / 3) * 3, bc = Math.floor(c / 3) * 3;
      for (let y = br; y < br + 3; y++) for (let x = bc; x < bc + 3; x++) {
        if ((y !== r || x !== c) && board[y][x] === val) return true;
      }
      return false;
    };

    const setDigit = (num) => {
      const [r, c] = selected;
      if (given[r][c] !== 0) return;
      board[r][c] = num;
      render();
      if (board.every((row, y) => row.every((v, x) => v === sol[y][x]))) {
        status.textContent = '🎉 Sudoku fehlerfrei gelöst!';
      } else {
        const left = board.flat().filter((v) => v === 0).length;
        status.textContent = `Noch ${left} Felder frei`;
      }
    };

    const render = () => {
      gridEl.innerHTML = '';
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const fixed = given[r][c] !== 0;
        const val = board[r][c];
        const bad = !fixed && isConflict(r, c, val);
        const sel = selected[0] === r && selected[1] === c;
        const cls = 'sz-sd-cell' + (fixed ? ' fixed' : '') + (sel ? ' sel' : '') + (bad ? ' bad' : '');
        const btn = $('button', cls, val ? String(val) : '');
        if (c === 2 || c === 5) btn.style.marginRight = '4px';
        if (r === 2 || r === 5) btn.style.marginBottom = '4px';
        btn.onclick = () => { selected = [r, c]; render(); };
        gridEl.append(btn);
      }

      padEl.innerHTML = '';
      for (let n = 1; n <= 9; n++) {
        const b = $('button', 'sz-btn sz-btn-ghost', String(n));
        b.onclick = () => setDigit(n);
        padEl.append(b);
      }
      const clr = $('button', 'sz-btn sz-btn-ghost', 'Löschen');
      clr.onclick = () => setDigit(0);
      padEl.append(clr);
    };

    status.textContent = `Noch ${board.flat().filter((v) => v === 0).length} Felder frei`;
    render();
  }
});

registerGame({
  id: 'uno',
  title: 'Uno',
  icon: '🌈',
  cat: 'Karten & Strategie',
  desc: 'Lege eine Karte mit gleicher Farbe oder Zahl bzw. Aktion ab oder ziehe vom Stapel.',
  run({ body, status }) {
    const COLORS = ['rot', 'blau', 'grün', 'gelb'];
    const HEX = { rot: '#dc2626', blau: '#2563eb', grün: '#16a34a', gelb: '#d97706' };
    const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '+2', 'Aussetzen'];

    const makeCard = () => ({ color: COLORS[R(COLORS.length)], val: VALUES[R(VALUES.length)] });
    let myHand = Array.from({ length: 7 }, makeCard);
    let aiHand = Array.from({ length: 7 }, makeCard);
    let topCard = makeCard();
    let turn = 0;
    let over = false;

    const wrap = $('div', 'sz-uno');
    const infoEl = $('div', null, '');
    infoEl.style.fontWeight = '700';
    const tableEl = $('div', 'sz-uno-table');
    const handEl = $('div', 'sz-uno-hand');
    wrap.append(infoEl, tableEl, handEl);
    body.append(wrap);

    const canPlay = (card) => card.color === topCard.color || card.val === topCard.val;

    const endCheck = () => {
      if (!myHand.length) {
        over = true;
        status.textContent = '🏆 Du hast gewonnen!';
        render();
        return true;
      }
      if (!aiHand.length) {
        over = true;
        status.textContent = '🤖 Computer hat gewonnen!';
        render();
        return true;
      }
      return false;
    };

    const applyCard = (card, fromPlayer) => {
      topCard = card;
      let nextTurn = 1 - fromPlayer;
      if (card.val === '+2') {
        if (fromPlayer === 0) { aiHand.push(makeCard(), makeCard()); nextTurn = 0; }
        else { myHand.push(makeCard(), makeCard()); nextTurn = 1; }
      } else if (card.val === 'Aussetzen') {
        nextTurn = fromPlayer;
      }
      turn = nextTurn;
      if (!endCheck()) {
        render();
        if (turn === 1) setTimeout(aiStep, 650);
      }
    };

    const aiStep = () => {
      if (over || turn !== 1) return;
      const idx = aiHand.findIndex(canPlay);
      if (idx >= 0) {
        const [card] = aiHand.splice(idx, 1);
        applyCard(card, 1);
      } else {
        aiHand.push(makeCard());
        turn = 0;
        render();
      }
    };

    const drawFromDeck = () => {
      if (over || turn !== 0) return;
      const card = makeCard();
      myHand.push(card);
      if (canPlay(card)) {
        const idx = myHand.length - 1;
        myHand.splice(idx, 1);
        applyCard(card, 0);
      } else {
        turn = 1;
        render();
        setTimeout(aiStep, 650);
      }
    };

    const render = () => {
      infoEl.textContent = `Computer-Karten: ${aiHand.length} · ${over ? 'Runde beendet' : turn === 0 ? 'Du bist dran' : 'Computer ist dran…'}`;
      status.textContent = over ? infoEl.textContent : `Aktive Karte: ${topCard.color.toUpperCase()} ${topCard.val}`;

      tableEl.innerHTML = '';
      const deckBtn = $('button', 'sz-uno-card', '<span>🃏</span><small>Ziehen</small>');
      deckBtn.style.background = '#334155';
      deckBtn.onclick = drawFromDeck;

      const pileEl = $('div', 'sz-uno-card', `<span style="text-transform:uppercase;font-size:12px">${topCard.color}</span><span style="font-size:24px">${topCard.val}</span>`);
      pileEl.style.background = HEX[topCard.color];
      pileEl.style.cursor = 'default';
      tableEl.append(deckBtn, pileEl);

      handEl.innerHTML = '';
      myHand.forEach((card, idx) => {
        const playable = !over && turn === 0 && canPlay(card);
        const btn = $('button', 'sz-uno-card', `<span style="text-transform:uppercase;font-size:11px">${card.color}</span><span style="font-size:22px">${card.val}</span>`);
        btn.style.background = HEX[card.color];
        btn.style.opacity = playable ? '1' : '0.55';
        btn.onclick = () => {
          if (!playable) return;
          myHand.splice(idx, 1);
          applyCard(card, 0);
        };
        handEl.append(btn);
      });
    };

    render();
  }
});

registerGame({
  id: 'bundesstaaten-usa',
  title: 'Bundesstaaten der USA lernen',
  icon: '🇺🇸',
  cat: 'Wissen & Quiz',
  desc: 'Lerne US-Bundesstaaten, ihre Hauptstädte und Regionen.',
  run({ body, status }) {
    const STATES = [
      { name: 'Kalifornien', abbr: 'CA', capital: 'Sacramento', region: 'Westen' },
      { name: 'Texas', abbr: 'TX', capital: 'Austin', region: 'Süden' },
      { name: 'New York', abbr: 'NY', capital: 'Albany', region: 'Nordosten' },
      { name: 'Florida', abbr: 'FL', capital: 'Tallahassee', region: 'Süden' },
      { name: 'Illinois', abbr: 'IL', capital: 'Springfield', region: 'Mittlerer Westen' },
      { name: 'Washington', abbr: 'WA', capital: 'Olympia', region: 'Westen' },
      { name: 'Colorado', abbr: 'CO', capital: 'Denver', region: 'Westen' },
      { name: 'Massachusetts', abbr: 'MA', capital: 'Boston', region: 'Nordosten' },
      { name: 'Arizona', abbr: 'AZ', capital: 'Phoenix', region: 'Westen' },
      { name: 'Michigan', abbr: 'MI', capital: 'Lansing', region: 'Mittlerer Westen' },
      { name: 'Georgia', abbr: 'GA', capital: 'Atlanta', region: 'Süden' },
      { name: 'Ohio', abbr: 'OH', capital: 'Columbus', region: 'Mittlerer Westen' }
    ];

    let score = 0, round = 0, locked = false;
    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:640px;text-align:center';

    const badgeEl = $('div', 'sz-badge sz-badge-ready', '');
    badgeEl.style.fontSize = '16px';
    const qEl = $('h3', null, '');
    qEl.style.margin = '0';
    const optsEl = $('div', null, '');
    optsEl.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(160px,1fr));gap:10px;width:100%';
    const fbEl = $('p', null, '');
    fbEl.style.cssText = 'min-height:24px;margin:0;font-weight:700';

    wrap.append(badgeEl, qEl, optsEl, fbEl);
    body.append(wrap);

    const nextQ = () => {
      locked = false;
      round++;
      const target = STATES[R(STATES.length)];
      const choices = [target];
      while (choices.length < 4) {
        const cand = STATES[R(STATES.length)];
        if (!choices.includes(cand)) choices.push(cand);
      }
      choices.sort(() => Math.random() - 0.5);

      badgeEl.textContent = `Kürzel: ${target.abbr} · Region: ${target.region}`;
      qEl.textContent = `Welcher Bundesstaat hat die Hauptstadt ${target.capital}?`;
      fbEl.textContent = '';
      optsEl.innerHTML = '';

      choices.forEach((st) => {
        const btn = $('button', 'sz-btn sz-btn-ghost', `${st.name} (${st.abbr})`);
        btn.onclick = () => {
          if (locked) return;
          locked = true;
          if (st.name === target.name) {
            score++;
            btn.className = 'sz-btn sz-btn-primary';
            fbEl.textContent = `✔ Richtig! ${target.name} – Hauptstadt: ${target.capital} (${target.region}).`;
          } else {
            btn.style.background = '#991b1b';
            fbEl.textContent = `✖ Gesucht war ${target.name} (Hauptstadt: ${target.capital}).`;
          }
          status.textContent = `Punkte: ${score} · Runde ${round}`;
          setTimeout(nextQ, 1100);
        };
        optsEl.append(btn);
      });
      status.textContent = `Punkte: ${score} · Runde ${round}`;
    };

    nextQ();
  }
});

registerGame({
  id: 'groessenvergleich',
  title: 'Größenvergleich (Dinge & Gebäude)',
  icon: '🏙️',
  cat: 'Wissen & Quiz',
  desc: 'Schätze und vergleiche, welches Bauwerk oder Objekt höher bzw. größer ist.',
  run({ body, status }) {
    const ITEMS = [
      { name: 'Eiffelturm', h: '330 m', val: 330 },
      { name: 'Burj Khalifa', h: '828 m', val: 828 },
      { name: 'Freiheitsstatue (inkl. Sockel)', h: '93 m', val: 93 },
      { name: 'Kölner Dom', h: '157 m', val: 157 },
      { name: 'Cheops-Pyramide', h: '139 m', val: 139 },
      { name: 'Berliner Fernsehturm', h: '368 m', val: 368 },
      { name: 'Doppeldeckerbus', h: '4,4 m', val: 4.4 },
      { name: 'Giraffe (ausgewachsen)', h: '5,5 m', val: 5.5 },
      { name: 'Blauwal', h: '28 m (Länge)', val: 28 },
      { name: 'Boing 747 (Länge)', h: '70,6 m', val: 70.6 }
    ];

    let score = 0, round = 0, locked = false;
    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:640px;text-align:center';

    const qEl = $('h3', null, 'Was ist höher / größer?');
    qEl.style.margin = '0';
    const pairEl = $('div', null, '');
    pairEl.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%';
    const fbEl = $('p', null, '');
    fbEl.style.cssText = 'min-height:24px;margin:0;font-weight:700';

    wrap.append(qEl, pairEl, fbEl);
    body.append(wrap);

    const nextPair = () => {
      locked = false;
      round++;
      const a = ITEMS[R(ITEMS.length)];
      let b = ITEMS[R(ITEMS.length)];
      while (b.name === a.name) b = ITEMS[R(ITEMS.length)];
      fbEl.textContent = '';
      pairEl.innerHTML = '';

      [[a, b], [b, a]].forEach(([pick, other]) => {
        const btn = $('button', 'sz-card', `
          <div style="font-size:18px;font-weight:800">${pick.name}</div>
          <div style="font-size:12px;color:var(--sz-muted)">Tippen zum Wählen</div>
        `);
        btn.onclick = () => {
          if (locked) return;
          locked = true;
          if (pick.val >= other.val) {
            score++;
            btn.style.borderColor = '#22c55e';
            fbEl.textContent = `✔ Richtig! ${pick.name} (${pick.h}) vs. ${other.name} (${other.h}).`;
          } else {
            btn.style.borderColor = '#ef4444';
            fbEl.textContent = `✖ ${other.name} (${other.h}) ist größer als ${pick.name} (${pick.h}).`;
          }
          status.textContent = `Punkte: ${score} · Runde ${round}`;
          setTimeout(nextPair, 1200);
        };
        pairEl.append(btn);
      });
      status.textContent = `Punkte: ${score} · Runde ${round}`;
    };

    nextPair();
  }
});

// ==========================================
// 4. WEITERE WUNSCHLISTE (ROADMAP-KACHELN)
// ==========================================

const ROADMAP = [
  ['Mahjong', '🀄', 'Puzzle', 'Kacheln paarweise freispielen.'],
  ['Poker', '🃏', 'Karten & Strategie', 'Rundenbasiertes Kartenspiel mit Chips.'],
  ['Duet', '⚪', 'Action', 'Zwei gekoppelte Punkte um Hindernisse steuern.'],
  ['Fußball', '⚽', 'Sport & Action', 'Schnelle Tore auf dem Querformat-Feld.'],
  ['Schlagenspiel', '🥊', 'Action', 'Reaktions- und Schlagduell lokal.'],
  ['Fruchtspiel', '🍉', 'Puzzle', 'Gleiche Früchte zusammenführen bis zur größten Frucht.'],
  ['Farbige Schrauben', '🔩', 'Puzzle', 'Schrauben nach Farben sortieren und lösen.'],
  ['Labyrinth malen', '🌀', 'Puzzle', 'Weg durch das Labyrinth mit Farbspur ziehen.'],
  ['Wer bin ich?', '❓', 'Partyspiele', 'Begriffe erraten mit Ja/Nein-Fragen.'],
  ['Red car escape!', '🚗', 'Puzzle', 'Blockaden verschieben und das rote Auto befreien.'],
  ['Ball run', '🏀', 'Action', 'Ball auf Strecke balancieren und Hindernissen ausweichen.'],
  ['Flappy jump', '🐦', 'Action', 'Durch Lücken fliegen und Highscores jagen.'],
  ['Tower war', '🏰', 'Strategie', 'Türme und Einheiten geschickt verteilen und erobern.'],
  ['Solitaire', '♠️', 'Karten & Strategie', 'Kartenstapel nach Farbe und Wert sortieren.'],
  ['Dame', '⚫', 'Brettspiele', 'Klassisches Brettspiel für 2 Spieler lokal.'],
  ['Miaudoku (Kakuro/Sudoku-Stil)', '🐱', 'Puzzle', 'Logikrätsel im vertrauten Katzen-/Kacheldesign.'],
  ['Herzen', '♥️', 'Karten & Strategie', 'Stiche vermeiden – besonders Herz und Pik-Dame.'],
  ['Mini Metro', '🚇', 'Strategie', 'Linien ziehen und Stationen rechtzeitig verbinden.'],
  ['Balatro', '🃏', 'Karten & Strategie', 'Pokerhände mit Multiplikatoren und Jokern kombinieren.'],
  ['Hotel manager', '🏨', 'Strategie', 'Zimmer verwalten, Gäste zufriedenstellen und ausbauen.'],
  ['Rider', '🏍️', 'Action', 'Flips und Landungen auf Rampen meistern.'],
  ['SRW2', '🚀', 'Action', 'Arcade-Rennen bzw. Action-Runde im Portal.'],
  ['Tomb of the Mask', '🎭', 'Action', 'Rasantes Labyrinth-Dash bis zum Ausgang.'],
  ['Color Slide', '🎨', 'Puzzle', 'Blöcke verschieben, bis Farben zusammenpassen.'],
  ['Nonogram', '⬛', 'Puzzle', 'Zahlenhinweise nutzen, um das Pixelbild aufzudecken.'],
  ['Ball Blast', '💥', 'Action', 'Fallende Zahlenblöcke mit Dauerfeuer zerlegen.'],
  ['Epic Plane', '✈️', 'Action', 'Flugzeug aufrüsten und möglichst weit fliegen.'],
  ['Merge', '✨', 'Puzzle', 'Gleiche Elemente zu höheren Stufen verschmelzen.'],
  ['Brawl Stars (Arena-Modus)', '🔥', 'Action', 'Kompaktes Top-Down-Arena-Duell lokal.'],
  ['Harvest.io', '🌾', 'Action', 'Ernte einsammeln und mit großem Anhänger ausweichen.'],
  ['BTD 6 (Tower Defense)', '🎈', 'Strategie', 'Verteidigungstürme gegen Wellen platzieren.'],
  ['Drill and Connect', '⛏️', 'Puzzle', 'Durch Gestein graben und Leitungen/Ziele verbinden.'],
  ['Hay Day (Hof-Mini)', '🚜', 'Strategie', 'Felder bestellen, ernten und Vorräte verwalten.'],
  ['Monument Valley', '🏛️', 'Puzzle', 'Optische Täuschungen und Wege geschickt drehen.'],
  ['Slither.io', '🐍', 'Action', 'Wachsen und anderen ausweichen.'],
  ['Hill Climb Racing', '🚙', 'Action', 'Hügel bezwingen und Sprit im Blick behalten.'],
  ['Stealth Master', '🥷', 'Action', 'Unbemerkt durch Räume schleichen und Ziele ausschalten.'],
  ['4 Bilder 1 Wort', '🖼️', 'Wörter & Quiz', 'Gemeinsamen Begriff aus vier Bildern finden.'],
  ['Lines', '⚪', 'Puzzle', 'Fünf gleiche Kugeln in einer Reihe auflösen.'],
  ['Mensch ärgere dich nicht', '🎲', 'Brettspiele', 'Klassiker für die Runde am Tisch.'],
  ['Dobble', '👁️', 'Partyspiele', 'Gemeinsames Symbol zwischen zwei Karten blitzschnell finden.'],
  ['Farbkampf', '🖌️', 'Action', 'Flächen in der eigenen Farbe einfärben.'],
  ['Gravity Run', '🌌', 'Action', 'Schwerkraft umschalten und Hindernissen entgehen.'],
  ['Chicken Jump', '🐔', 'Action', 'Plattformen nach oben erklimmen.'],
  ['Frohe Vogel', '🐤', 'Action', 'Leichter Arcade-Flugmodus für zwischendurch.'],
  ['Broken Tiles', '🧩', 'Puzzle', 'Zerbrochene Kacheln wieder zusammensetzen.'],
  ['Minigolf', '⛳', 'Sport & Action', 'Winkel und Schlagkraft auf Parcours-Bahnen abstimmen.'],
  ['Beach Ball', '🏖️', 'Action', 'Ball in der Luft halten und Punkte sammeln.'],
  ['Subway Surfers (Lane-Runner)', '🏃', 'Action', 'Spuren wechseln, springen und ducken.'],
  ['Idle Balls', '🔮', 'Simulation', 'Bälle rollen lassen und Upgrades freischalten.'],
  ['Traffic Rider', '🛣️', 'Action', 'Durch den Verkehr schlängeln ohne Crash.'],
  ['Rise Up! Ballon beschützen', '🎈', 'Action', 'Hindernisse mit dem Schild vom Ballon fernhalten.'],
  ['Angry Birds (Schleuder)', '🐦', 'Action', 'Mit der Schleuder zielen und Ziele treffen.'],
  ['Puzzle', '🧩', 'Puzzle', 'Klassisches Bildpuzzle zusammensetzen.'],
  ['Bunte Formen einsetzen (Tangram-Bild)', '🔷', 'Puzzle', 'Bunte geometrische Formen passend in ein Bild einsetzen.']
];

ROADMAP.forEach(([title, icon, cat, desc], idx) => {
  registerGame({ id: `item-${idx + 1}`, title, icon, cat, desc });
});

Shell.init();
