// ==========================================
// 1. MAHJONG
// ==========================================
registerGame({
  id: 'mahjong',
  title: 'Mahjong',
  icon: '🀄',
  cat: 'Puzzle',
  desc: 'Wähle zwei gleiche Kacheln mit mindestens einer freien linken oder rechten Seite und räume das Feld ab.',
  run({ body, status }) {
    const COLS = 6, ROWS = 4;
    const SYMS = ['🀄', '🎋', '🌸', '🐉', '🏮', '🪙', '🎲', '🌙', '⭐', '🔥', '🍀', '💎'];
    const pairs = [];
    for (let i = 0; i < (COLS * ROWS) / 2; i++) {
      const s = SYMS[i % SYMS.length];
      pairs.push(s, s);
    }
    pairs.sort(() => Math.random() - 0.5);

    let board = [...pairs];
    let selected = null;
    let matched = 0;

    const wrap = $('div', 'sz-mj-grid');
    body.append(wrap);

    const isFree = (idx) => {
      if (!board[idx]) return false;
      const c = idx % COLS;
      const leftFree = c === 0 || !board[idx - 1];
      const rightFree = c === COLS - 1 || !board[idx + 1];
      return leftFree || rightFree;
    };

    const render = () => {
      wrap.innerHTML = '';
      board.forEach((sym, idx) => {
        const cls = 'sz-mj-tile' + (!sym ? ' gone' : '') + (selected === idx ? ' sel' : '');
        const btn = $('button', cls, sym || '');
        btn.onclick = () => {
          if (!sym) return;
          if (!isFree(idx)) {
            status.textContent = 'Kachel ist seitlich blockiert';
            return;
          }
          if (selected === null) {
            selected = idx;
            status.textContent = 'Zweite passende Kachel wählen';
          } else if (selected === idx) {
            selected = null;
            status.textContent = 'Auswahl aufgehoben';
          } else if (board[selected] === sym) {
            board[selected] = null;
            board[idx] = null;
            selected = null;
            matched += 2;
            status.textContent = matched === board.length
              ? '🏆 Alle Paare abgeräumt!'
              : `Paar entfernt! (${matched}/${board.length})`;
          } else {
            selected = idx;
            status.textContent = 'Kein Paar – neue Kachel gewählt';
          }
          render();
        };
        wrap.append(btn);
      });
    };

    status.textContent = 'Wähle zwei gleiche freie Kacheln';
    render();
  }
});

// ==========================================
// 2. POKER (5-Card-Draw gegen Computer)
// ==========================================
registerGame({
  id: 'poker',
  title: 'Poker',
  icon: '🃏',
  cat: 'Karten & Strategie',
  desc: 'Wähle Karten zum Behalten, tausche den Rest und vergleiche deine Hand gegen den Computer.',
  run({ body, status }) {
    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = [7, 8, 9, 10, 11, 12, 13, 14];
    const RLABEL = { 7: '7', 8: '8', 9: '9', 10: '10', 11: 'B', 12: 'D', 13: 'K', 14: 'A' };

    const makeDeck = () => {
      const d = [];
      for (const s of SUITS) for (const r of RANKS) d.push({ s, r });
      return d.sort(() => Math.random() - 0.5);
    };

    const scoreHand = (hand) => {
      const counts = {};
      hand.forEach((c) => { counts[c.r] = (counts[c.r] || 0) + 1; });
      const vals = Object.values(counts).sort((a, b) => b - a);
      const flush = hand.every((c) => c.s === hand[0].s);
      const high = Math.max(...hand.map((c) => c.r));
      if (flush) return { rank: 5, name: 'Flush', high };
      if (vals[0] === 4) return { rank: 7, name: 'Vierling', high };
      if (vals[0] === 3 && vals[1] === 2) return { rank: 6, name: 'Full House', high };
      if (vals[0] === 3) return { rank: 4, name: 'Drilling', high };
      if (vals[0] === 2 && vals[1] === 2) return { rank: 3, name: 'Zwei Paare', high };
      if (vals[0] === 2) return { rank: 2, name: 'Ein Paar', high };
      return { rank: 1, name: 'Höchste Karte', high };
    };

    let deck = makeDeck();
    let player = deck.splice(0, 5);
    let ai = deck.splice(0, 5);
    let holds = [true, true, true, true, true];
    let drawn = false;

    const wrap = $('div', 'sz-pk-wrap');
    const aiInfo = $('div', null, '');
    const handEl = $('div', 'sz-pk-hand');
    const actionBtn = $('button', 'sz-btn sz-btn-primary', 'Ausgewählte tauschen');
    wrap.append(aiInfo, handEl, actionBtn);
    body.append(wrap);

    const renderCard = (c, idx, interactive) => {
      const isRed = c.s === '♥' || c.s === '♦';
      const el = $('button', 'sz-pk-card' + (isRed ? ' red' : '') + (interactive && holds[idx] ? ' hold' : ''),
        `<span>${RLABEL[c.r]}</span><span style="font-size:22px">${c.s}</span>` + (interactive ? `<small style="font-size:10px">${holds[idx] ? 'HALTEN' : 'TAUSCH'}</small>` : '')
      );
      if (interactive) {
        el.onclick = () => {
          if (drawn) return;
          holds[idx] = !holds[idx];
          render();
        };
      } else {
        el.style.cursor = 'default';
      }
      return el;
    };

    const render = () => {
      handEl.innerHTML = '';
      player.forEach((c, i) => handEl.append(renderCard(c, i, true)));

      if (!drawn) {
        aiInfo.textContent = 'Computer hält 5 verdeckte Karten';
        actionBtn.textContent = 'Ausgewählte tauschen';
        status.textContent = 'Tippe auf Karten zum Tauschen/Halten';
      } else {
        const pSc = scoreHand(player);
        const aSc = scoreHand(ai);
        aiInfo.innerHTML = `<div style="margin-bottom:6px">Computer (${aSc.name}):</div><div style="display:flex;gap:8px;justify-content:center">${ai.map((c) => renderCard(c, 0, false).outerHTML).join('')}</div>`;
        actionBtn.textContent = 'Neue Runde';
        if (pSc.rank > aSc.rank || (pSc.rank === aSc.rank && pSc.high > aSc.high)) {
          status.textContent = `🏆 Du gewinnst mit ${pSc.name} gegen ${aSc.name}!`;
        } else if (aSc.rank > pSc.rank || (aSc.rank === pSc.rank && aSc.high > pSc.high)) {
          status.textContent = `🤖 Computer gewinnt mit ${aSc.name} gegen ${pSc.name}.`;
        } else {
          status.textContent = `Unentschieden (${pSc.name})!`;
        }
      }
    };

    actionBtn.onclick = () => {
      if (!drawn) {
        player = player.map((c, i) => (holds[i] ? c : deck.pop() || c));
        ai = ai.map((c) => (scoreHand(ai).rank >= 2 ? c : deck.pop() || c));
        drawn = true;
        render();
      } else {
        deck = makeDeck();
        player = deck.splice(0, 5);
        ai = deck.splice(0, 5);
        holds = [true, true, true, true, true];
        drawn = false;
        render();
      }
    };

    render();
  }
});

// ==========================================
// 3. FUSSBALL
// ==========================================
registerGame({
  id: 'fussball',
  title: 'Fußball',
  icon: '⚽',
  cat: 'Sport & Action',
  desc: 'Steuere deinen Spieler mit Finger, Maus oder Pfeiltasten/WASD und schieße Tore ins rechte Tor.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const W = 520, H = 320;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let px = 110, py = H / 2;
    let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 10 };
    let goals = 0, shots = 0;

    const resetBall = () => {
      ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 10 };
      px = 110; py = H / 2;
    };

    const moveTo = (clientX, clientY) => {
      const rect = cv.getBoundingClientRect();
      px = Math.max(24, Math.min(W - 24, ((clientX - rect.left) / rect.width) * W));
      py = Math.max(24, Math.min(H - 24, ((clientY - rect.top) / rect.height) * H));
    };

    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); moveTo(e.clientX, e.clientY); };
    cv.onpointermove = (e) => { if (e.buttons || e.pointerType === 'touch') moveTo(e.clientX, e.clientY); };
    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', 'ArrowUp', 'w', 'ArrowDown', 's']);

    const loop = () => {
      if (keys.ArrowLeft || keys.a) px = Math.max(24, px - 5);
      if (keys.ArrowRight || keys.d) px = Math.min(W - 24, px + 5);
      if (keys.ArrowUp || keys.w) py = Math.max(24, py - 5);
      if (keys.ArrowDown || keys.s) py = Math.min(H - 24, py + 5);

      const dx = ball.x - px, dy = ball.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist < ball.r + 16 && dist > 0) {
        ball.vx = (dx / dist) * 6.8;
        ball.vy = (dy / dist) * 6.8;
        shots++;
      }

      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.vx *= 0.975;
      ball.vy *= 0.975;

      if (ball.y - ball.r < 16) { ball.y = 16 + ball.r; ball.vy *= -0.85; }
      if (ball.y + ball.r > H - 16) { ball.y = H - 16 - ball.r; ball.vy *= -0.85; }
      if (ball.x - ball.r < 16) { ball.x = 16 + ball.r; ball.vx *= -0.85; }

      if (ball.x + ball.r > W - 16) {
        if (ball.y > 105 && ball.y < 215) {
          goals++;
          status.textContent = `⚽ TOR! Tore: ${goals} · Schüsse: ${shots}`;
          resetBall();
        } else {
          ball.x = W - 16 - ball.r;
          ball.vx *= -0.85;
        }
      }

      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(16, 16, W - 32, H - 32);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(W - 28, 105, 12, 110);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    status.textContent = `Tore: 0 · Schüsse: 0 · Ball ins rechte Tor schießen`;
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 4. SCHLAGENSPIEL
// ==========================================
registerGame({
  id: 'schlagenspiel',
  title: 'Schlagenspiel',
  icon: '🥊',
  cat: 'Action',
  desc: 'Schlage zu, wenn der Gegner ungedeckt ist, und blocke, wenn er ausholt!',
  run({ body, status }) {
    const { later } = makeRuntime();
    let myHp = 100, aiHp = 100, aiTelegraph = false, over = false;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;max-width:540px;text-align:center';

    const barsEl = $('div', null, '');
    barsEl.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:14px;width:100%';
    const arenaEl = $('div', null, '');
    arenaEl.style.cssText = 'padding:28px 18px;border-radius:16px;background:var(--sz-surface-2);width:100%;font-size:20px;font-weight:800';
    const btnsEl = $('div', null, '');
    btnsEl.style.cssText = 'display:flex;gap:14px;justify-content:center;flex-wrap:wrap';

    const hitBtn = $('button', 'sz-btn sz-btn-primary', '🥊 Schlag');
    const blkBtn = $('button', 'sz-btn sz-btn-ghost', '🛡️ Block');
    btnsEl.append(hitBtn, blkBtn);
    wrap.append(barsEl, arenaEl, btnsEl);
    body.append(wrap);

    const render = (msg) => {
      barsEl.innerHTML = `
        <div style="background:var(--sz-bg);padding:10px;border-radius:12px">Du: <strong>${Math.max(0, myHp)} HP</strong></div>
        <div style="background:var(--sz-bg);padding:10px;border-radius:12px">Gegner: <strong>${Math.max(0, aiHp)} HP</strong></div>
      `;
      arenaEl.textContent = msg || (aiTelegraph ? '⚠️ Gegner holt aus – BLOCKEN!' : '🥊 Gegner offen – SCHLAGEN!');
    };

    const scheduleAi = () => {
      if (over) return;
      later(() => {
        if (over) return;
        aiTelegraph = true;
        render('⚠️ Gegner holt aus – BLOCKEN!');
        later(() => {
          if (over) return;
          aiTelegraph = false;
          render('🥊 Gegner offen – SCHLAGEN!');
        }, 900);
        scheduleAi();
      }, 1500 + R(900));
    };

    const endGame = () => {
      if (aiHp <= 0 || myHp <= 0) {
        over = true;
        status.textContent = aiHp <= 0 ? '🏆 Du hast gewonnen!' : '💥 K.O. – Gegner gewinnt!';
      }
    };

    hitBtn.onclick = () => {
      if (over) return;
      if (aiTelegraph) {
        myHp -= 18;
        render('✖ Konter! Gegner hat dich beim Ausholen erwischt.');
      } else {
        aiHp -= 20;
        render('✔ Volltreffer! -20 HP beim Gegner.');
      }
      endGame();
    };

    blkBtn.onclick = () => {
      if (over) return;
      if (aiTelegraph) {
        aiTelegraph = false;
        aiHp -= 8;
        render('🛡️ Sauber geblockt! Gegenangriff -8 HP.');
      } else {
        render('🛡️ Deckung gehalten.');
      }
      endGame();
    };

    status.textContent = 'Schlagen wenn offen, Blocken wenn Gegner ausholt';
    render();
    scheduleAi();
  }
});

// ==========================================
// 5. FRUCHTSPIEL
// ==========================================
registerGame({
  id: 'fruchtspiel',
  title: 'Fruchtspiel',
  icon: '🍉',
  cat: 'Puzzle',
  desc: 'Wähle eine Spalte, um Früchte fallen zu lassen – gleiche Früchte verschmelzen zur nächsten Stufe.',
  run({ body, status }) {
    const COLS = 5, ROWS = 5;
    const FRUITS = ['🍒', '🍓', '🍊', '🍎', '🍍', '🍉'];
    let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
    let nextLevel = R(3);
    let score = 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const boardEl = $('div', null, '');
    boardEl.style.cssText = `display:grid;grid-template-columns:repeat(${COLS},54px);gap:6px;background:var(--sz-surface-2);padding:10px;border-radius:14px`;
    wrap.append(boardEl);
    body.append(wrap);

    const dropInCol = (c) => {
      let row = -1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (grid[r][c] === -1) { row = r; break; }
      }
      if (row === -1) {
        status.textContent = 'Spalte voll – andere Spalte wählen';
        return;
      }
      grid[row][c] = nextLevel;
      const curLvl = nextLevel;
      if (row + 1 < ROWS && grid[row + 1][c] === curLvl && curLvl + 1 < FRUITS.length) {
        grid[row][c] = -1;
        grid[row + 1][c] = curLvl + 1;
        score += (curLvl + 1) * 15;
      } else if (c + 1 < COLS && grid[row][c + 1] === curLvl && curLvl + 1 < FRUITS.length) {
        grid[row][c] = -1;
        grid[row][c + 1] = curLvl + 1;
        score += (curLvl + 1) * 15;
      } else {
        score += 5;
      }
      nextLevel = R(3);
      render();
    };

    const render = () => {
      boardEl.innerHTML = '';
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const lvl = grid[r][c];
        const cell = $('button', 'sz-btn', lvl >= 0 ? FRUITS[lvl] : '');
        cell.style.cssText = 'width:54px;height:54px;padding:0;font-size:26px;background:var(--sz-bg);border-radius:10px';
        cell.onclick = () => dropInCol(c);
        boardEl.append(cell);
      }
      status.textContent = `Punkte: ${score} · Nächste Frucht: ${FRUITS[nextLevel]}`;
    };

    render();
  }
});

// ==========================================
// 6. FARBIGE SCHRAUBEN
// ==========================================
registerGame({
  id: 'farbige-schrauben',
  title: 'Farbige Schrauben',
  icon: '🔩',
  cat: 'Puzzle',
  desc: 'Tippe auf eine Halterung, um die oberste Schraube in eine andere Halterung zu bewegen.',
  run({ body, status }) {
    const COLORS = { r: '#ef4444', b: '#3b82f6', g: '#22c55e' };
    let cols = [
      ['r', 'b', 'g'],
      ['g', 'r', 'b'],
      ['b', 'g', 'r'],
      []
    ];
    let selCol = null;

    const wrap = $('div', 'sz-sc-wrap');
    body.append(wrap);

    const checkWin = () => {
      const done = cols.every((col) => col.length === 0 || (col.length === 3 && col.every((x) => x === col[0])));
      status.textContent = done
        ? '🎉 Alle Schrauben sauber sortiert!'
        : (selCol !== null ? `Halterung #${selCol + 1} gewählt` : 'Wähle eine Halterung');
    };

    const render = () => {
      wrap.innerHTML = '';
      cols.forEach((col, idx) => {
        const box = $('button', 'sz-sc-col' + (selCol === idx ? ' sel' : ''));
        col.forEach((cKey) => {
          const bolt = $('span', 'sz-sc-bolt');
          bolt.style.background = COLORS[cKey];
          box.append(bolt);
        });
        box.onclick = () => {
          if (selCol === null) {
            if (col.length) selCol = idx;
          } else if (selCol === idx) {
            selCol = null;
          } else {
            const mover = cols[selCol][cols[selCol].length - 1];
            if (mover && cols[idx].length < 3) {
              cols[selCol].pop();
              cols[idx].push(mover);
            }
            selCol = null;
          }
          render();
          checkWin();
        };
        wrap.append(box);
      });
    };

    render();
    checkWin();
  }
});

// ==========================================
// 7. LABYRINTH MALEN
// ==========================================
registerGame({
  id: 'labyrinth-malen',
  title: 'Labyrinth malen',
  icon: '🌀',
  cat: 'Puzzle',
  desc: 'Ziehe oder tippe benachbarte Felder von Start (S) bis zum Ziel (Z) ohne Wände.',
  run({ body, status }) {
    const { on } = makeRuntime();
    const N = 7;
    const map = [
      0, 0, 1, 0, 0, 0, 0,
      1, 0, 1, 0, 1, 1, 0,
      0, 0, 0, 0, 1, 0, 0,
      0, 1, 1, 1, 1, 0, 1,
      0, 0, 0, 0, 0, 0, 0,
      1, 1, 0, 1, 1, 1, 0,
      0, 0, 0, 0, 0, 1, 0
    ];
    const start = 0, goal = N * N - 1;
    let trail = [start];
    let painting = false;

    const wrap = $('div', 'sz-lm-grid');
    body.append(wrap);

    const isAdj = (a, b) => {
      const ar = Math.floor(a / N), ac = a % N;
      const br = Math.floor(b / N), bc = b % N;
      return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
    };

    const stepTo = (idx) => {
      if (map[idx] === 1) return;
      const head = trail[trail.length - 1];
      if (idx === head || trail.includes(idx) || !isAdj(head, idx)) return;
      trail.push(idx);
      render();
      status.textContent = idx === goal
        ? `🎉 Ziel erreicht in ${trail.length - 1} Schritten!`
        : `Schritte: ${trail.length - 1} · Weiter zum Ziel (Z)`;
    };

    const render = () => {
      wrap.innerHTML = '';
      for (let i = 0; i < N * N; i++) {
        const isWall = map[i] === 1;
        const onPath = trail.includes(i);
        const label = i === start ? 'S' : i === goal ? 'Z' : '';
        const cls = 'sz-lm-cell' + (isWall ? ' wall' : '') + (onPath ? ' path' : '') + (i === goal ? ' goal' : '');
        const cell = $('button', cls, label);
        cell.onpointerdown = () => { painting = true; stepTo(i); };
        cell.onpointerenter = () => { if (painting) stepTo(i); };
        wrap.append(cell);
      }
    };

    on(window, 'pointerup', () => { painting = false; });
    status.textContent = 'Von S nach Z ziehen oder tippen';
    render();
  }
});

// ==========================================
// 8. WER BIN ICH?
// ==========================================
registerGame({
  id: 'wer-bin-ich',
  title: 'Wer bin ich?',
  icon: '❓',
  cat: 'Partyspiele',
  desc: 'Lies die Hinweise und errate, wer oder was gesucht ist.',
  run({ body, status }) {
    const CARDS = [
      { answer: 'Pinguin', hints: ['Ich bin ein Vogel, kann aber nicht fliegen.', 'Ich schwimme blitzschnell im kalten Wasser.', 'Ich trage Schwarz-Weiß.'] },
      { answer: 'Vulkan', hints: ['Ich schlafe manchmal jahrelang ruhig.', 'Wenn ich ausbreche, fließt heiße Lava.', 'Ich habe oft einen Krater an der Spitze.'] },
      { answer: 'Kompass', hints: ['Ich brauche keinen Strom für meine Arbeit.', 'Meine Nadel zeigt nach Norden.', 'Seefahrer und Wanderer nutzen mich.'] },
      { answer: 'Chamäleon', hints: ['Ich bewege meine Augen unabhängig voneinander.', 'Ich kann meine Hautfarbe anpassen.', 'Ich fange Insekten mit einer langen Zunge.'] }
    ];

    let idx = 0, hintCount = 1, score = 0;
    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:560px;text-align:center';

    const cardBox = $('div', null, '');
    cardBox.style.cssText = 'padding:20px;border-radius:16px;background:var(--sz-surface-2);width:100%';
    const ansEl = $('div', null, '');
    ansEl.style.cssText = 'font-size:24px;font-weight:900;margin-top:12px;color:#a3e635';

    const actions = $('div', null, '');
    actions.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    const nextHintBtn = $('button', 'sz-btn sz-btn-ghost', 'Nächster Hinweis');
    const revealBtn = $('button', 'sz-btn sz-btn-primary', 'Auflösen (+1 Punkt)');
    const nextCardBtn = $('button', 'sz-btn sz-btn-lime', 'Nächste Karte');
    actions.append(nextHintBtn, revealBtn, nextCardBtn);

    wrap.append(cardBox, ansEl, actions);
    body.append(wrap);

    const render = (revealed = false) => {
      const c = CARDS[idx % CARDS.length];
      cardBox.innerHTML = `<ul style="text-align:left;margin:0;padding-left:20px;line-height:1.7">${c.hints.slice(0, hintCount).map((h) => `<li>${h}</li>`).join('')}</ul>`;
      ansEl.textContent = revealed ? `Gesucht: ${c.answer}` : '???';
      status.textContent = `Punkte: ${score} · Hinweise sichtbar: ${hintCount}/${c.hints.length}`;
    };

    nextHintBtn.onclick = () => {
      const c = CARDS[idx % CARDS.length];
      if (hintCount < c.hints.length) hintCount++;
      render(false);
    };

    revealBtn.onclick = () => {
      if (ansEl.textContent === '???') score++;
      render(true);
    };

    nextCardBtn.onclick = () => {
      idx++;
      hintCount = 1;
      render(false);
    };

    render(false);
  }
});

// ==========================================
// 9. BALL RUN
// ==========================================
registerGame({
  id: 'ball-run',
  title: 'Ball run',
  icon: '🏀',
  cat: 'Action',
  desc: 'Halte den Ball auf der Strecke und weiche roten Blöcken aus.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const W = 400, H = 480;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    const trackW = 190;
    let ballX = W / 2, score = 0, over = false, blocks = [], tick = 0;

    const reset = () => {
      ballX = W / 2; score = 0; over = false; blocks = []; tick = 0;
      status.textContent = 'Punkte: 0 · Auf der Bahn bleiben';
    };

    const setX = (clientX) => {
      const rect = cv.getBoundingClientRect();
      ballX = Math.max(20, Math.min(W - 20, ((clientX - rect.left) / rect.width) * W));
    };

    cv.onpointerdown = (e) => {
      if (over) { reset(); return; }
      cv.setPointerCapture(e.pointerId);
      setX(e.clientX);
    };
    cv.onpointermove = (e) => { if (!over && (e.buttons || e.pointerType === 'touch')) setX(e.clientX); };
    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', ' '], (e, firstPress) => {
      if (over && e.key === ' ' && firstPress) reset();
    });

    const loop = () => {
      if (!over) {
        if (keys.ArrowLeft || keys.a) ballX -= 5;
        if (keys.ArrowRight || keys.d) ballX += 5;
        tick++;
        if (tick % 50 === 1) {
          const leftEdge = (W - trackW) / 2;
          blocks.push({ x: leftEdge + R(trackW - 44), y: -20, w: 44, h: 18, vy: 3.1 });
        }

        const leftEdge = (W - trackW) / 2;
        const rightEdge = leftEdge + trackW;
        if (ballX - 11 < leftEdge || ballX + 11 > rightEdge) {
          over = true;
          status.textContent = `💥 Von der Bahn gerollt! Punkte: ${score} · Tippen für Neustart`;
        }

        const by = H - 75, br = 11;
        for (let i = blocks.length - 1; i >= 0; i--) {
          const b = blocks[i];
          b.y += b.vy;
          if (b.y > by + br && !b.passed) {
            b.passed = true;
            score++;
            status.textContent = `Punkte: ${score}`;
          }
          const nx = Math.max(b.x, Math.min(ballX, b.x + b.w));
          const ny = Math.max(b.y, Math.min(by, b.y + b.h));
          if (Math.hypot(ballX - nx, by - ny) < br) {
            over = true;
            status.textContent = `💥 Block getroffen! Punkte: ${score} · Tippen für Neustart`;
          }
          if (b.y > H + 30) blocks.splice(i, 1);
        }
      }

      ctx.fillStyle = '#0c0918';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#241c42';
      ctx.fillRect((W - trackW) / 2, 0, trackW, H);

      blocks.forEach((b) => {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 5); ctx.fill();
      });

      ctx.fillStyle = '#f97316';
      ctx.beginPath(); ctx.arc(ballX, H - 75, 11, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    reset();
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 10. TOWER WAR
// ==========================================
registerGame({
  id: 'tower-war',
  title: 'Tower war',
  icon: '🏰',
  cat: 'Strategie',
  desc: 'Wähle einen eigenen blauen Turm und klicke auf einen Zielturm, um die Hälfte deiner Einheiten zu schicken.',
  run({ body, status }) {
    const { later } = makeRuntime();
    let towers = [
      { id: 0, name: 'West-Turm', owner: 'player', units: 16 },
      { id: 1, name: 'Mittel-Turm', owner: 'neutral', units: 8 },
      { id: 2, name: 'Ost-Turm', owner: 'enemy', units: 14 }
    ];
    let selected = null;
    let over = false;

    const wrap = $('div', 'sz-tw-wrap');
    body.append(wrap);

    const checkWin = () => {
      const allPlayer = towers.every((t) => t.owner === 'player');
      const noPlayer = towers.every((t) => t.owner !== 'player');
      if (allPlayer) {
        over = true;
        status.textContent = '🏆 Alle Türme erobert!';
      } else if (noPlayer) {
        over = true;
        status.textContent = '💥 Alle eigenen Türme verloren!';
      }
    };

    const tickProd = () => {
      if (over) return;
      towers.forEach((t) => {
        if (t.owner !== 'neutral' && t.units < 30) t.units += 1;
      });
      render();
      later(tickProd, 1200);
    };

    const render = () => {
      wrap.innerHTML = '';
      towers.forEach((t) => {
        const bg = t.owner === 'player' ? '#2563eb' : t.owner === 'enemy' ? '#dc2626' : '#475569';
        const btn = $('button', 'sz-tw-tower' + (selected === t.id ? ' sel' : ''),
          `<span>🏰</span><span>${t.name}</span><span style="font-size:20px">${t.units}</span>`
        );
        btn.style.background = bg;
        btn.onclick = () => {
          if (over) return;
          if (selected === null) {
            if (t.owner === 'player' && t.units > 1) {
              selected = t.id;
              status.textContent = `${t.name} gewählt – Zielturm antippen`;
              render();
            }
          } else if (selected === t.id) {
            selected = null;
            render();
          } else {
            const src = towers[selected];
            const sent = Math.floor(src.units / 2);
            src.units -= sent;
            if (t.owner === 'player') {
              t.units += sent;
            } else if (sent > t.units) {
              t.units = sent - t.units;
              t.owner = 'player';
            } else {
              t.units -= sent;
            }
            selected = null;
            render();
            checkWin();
          }
        };
        wrap.append(btn);
      });
    };

    status.textContent = 'Blauen Turm wählen und Ziel angreifen';
    render();
    later(tickProd, 1200);
  }
});

// ==========================================
// 11. SOLITAIRE
// ==========================================
registerGame({
  id: 'solitaire',
  title: 'Solitaire',
  icon: '♠️',
  cat: 'Karten & Strategie',
  desc: 'Lege Karten absteigend mit wechselnder Farbe auf die 4 Spalten oder sortiere sie aufwärts auf den Ablagestapel.',
  run({ body, status }) {
    const SUITS = ['♠', '♥', '♦', '♣'];
    const isRed = (s) => s === '♥' || s === '♦';
    const deck = [];
    for (const s of SUITS) for (let v = 1; v <= 6; v++) deck.push({ s, v });
    deck.sort(() => Math.random() - 0.5);

    let cols = Array.from({ length: 4 }, (_, i) => [deck[i]]);
    let waste = deck.slice(4, 12);
    let foundation = [];
    let selected = null;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:640px';
    const topRow = $('div', null, '');
    topRow.style.cssText = 'display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:center';
    const colsRow = $('div', null, '');
    colsRow.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(95px,1fr));gap:10px;width:100%';
    wrap.append(topRow, colsRow);
    body.append(wrap);

    const getPicked = () => {
      if (!selected) return null;
      if (selected.type === 'waste') return waste[waste.length - 1] || null;
      return cols[selected.col]?.[selected.idx] || null;
    };

    const removePicked = () => {
      if (!selected) return;
      if (selected.type === 'waste') waste.pop();
      else cols[selected.col].splice(selected.idx);
      selected = null;
    };

    const render = () => {
      topRow.innerHTML = '';
      const drawBtn = $('button', 'sz-btn sz-btn-ghost', `🃏 Nachziehen (${waste.length})`);
      drawBtn.onclick = () => {
        if (!waste.length) return;
        waste.push(waste.shift());
        selected = null;
        render();
      };

      const topW = waste[waste.length - 1];
      const wCard = $('button', 'sz-pk-card' + (topW && isRed(topW.s) ? ' red' : '') + (selected?.type === 'waste' ? ' hold' : ''),
        topW ? `<span>${topW.v}</span><span style="font-size:22px">${topW.s}</span>` : '<small>Leer</small>'
      );
      wCard.onclick = () => {
        if (!topW) return;
        selected = selected?.type === 'waste' ? null : { type: 'waste' };
        render();
      };

      const fTop = foundation[foundation.length - 1];
      const fBtn = $('button', 'sz-pk-card' + (fTop && isRed(fTop.s) ? ' red' : ''),
        fTop ? `<span>${fTop.v}</span><span style="font-size:22px">${fTop.s}</span><small>Ablage</small>` : '<small>Ablage<br>Start: 1</small>'
      );
      fBtn.onclick = () => {
        const card = getPicked();
        if (!card) return;
        if (card.v === foundation.length + 1) {
          foundation.push(card);
          removePicked();
          status.textContent = foundation.length === 24 ? '🏆 Solitaire geschafft!' : `Ablage: ${foundation.length}/24 Karten`;
          render();
        }
      };

      topRow.append(drawBtn, wCard, fBtn);

      colsRow.innerHTML = '';
      cols.forEach((col, cIdx) => {
        const box = $('div', null, '');
        box.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:center;min-height:130px;padding:8px;border-radius:12px;background:var(--sz-surface-2)';
        col.forEach((card, kIdx) => {
          const isSel = selected?.type === 'col' && selected.col === cIdx && selected.idx === kIdx;
          const btn = $('button', 'sz-pk-card' + (isRed(card.s) ? ' red' : '') + (isSel ? ' hold' : ''),
            `<span>${card.v}</span><span style="font-size:22px">${card.s}</span>`
          );
          btn.onclick = (ev) => {
            ev.stopPropagation();
            if (isSel) { selected = null; render(); return; }
            const picked = getPicked();
            if (picked && kIdx === col.length - 1 && isRed(picked.s) !== isRed(card.s) && picked.v === card.v - 1) {
              const moving = selected.type === 'waste' ? [waste.pop()] : cols[selected.col].splice(selected.idx);
              cols[cIdx].push(...moving);
              selected = null;
              render();
              return;
            }
            selected = { type: 'col', col: cIdx, idx: kIdx };
            render();
          };
          box.append(btn);
        });
        box.onclick = () => {
          const picked = getPicked();
          if (picked && col.length === 0) {
            const moving = selected.type === 'waste' ? [waste.pop()] : cols[selected.col].splice(selected.idx);
            cols[cIdx].push(...moving);
            selected = null;
            render();
          }
        };
        colsRow.append(box);
      });
    };

    status.textContent = `Ablage: 0/24 Karten · Karten anlegen oder auf Ablage sortieren`;
    render();
  }
});

// ==========================================
// 12. DAME
// ==========================================
registerGame({
  id: 'dame',
  title: 'Dame',
  icon: '⚫',
  cat: 'Brettspiele',
  desc: 'Ziehe deine Steine (⚪) diagonal vorwärts und schlage gegnerische Steine (⚫) durch Überspringen.',
  run({ body, status }) {
    const { later } = makeRuntime();
    const N = 8;
    let board = Array.from({ length: N }, (_, r) =>
      Array.from({ length: N }, (_, c) => {
        if ((r + c) % 2 === 1) {
          if (r < 3) return 2;
          if (r > 4) return 1;
        }
        return 0;
      })
    );
    let sel = null;
    let turn = 1;

    const wrap = $('div', 'sz-ck-grid');
    body.append(wrap);

    const tryMove = (tr, tc) => {
      if (!sel || board[tr][tc] !== 0 || (tr + tc) % 2 === 0) return false;
      const [sr, sc] = sel;
      const dr = tr - sr, dc = tc - sc;
      if (Math.abs(dc) === 1 && dr === -1) {
        board[tr][tc] = 1;
        board[sr][sc] = 0;
        sel = null;
        return true;
      }
      if (Math.abs(dc) === 2 && dr === -2) {
        const mr = (sr + tr) / 2, mc = (sc + tc) / 2;
        if (board[mr][mc] === 2) {
          board[tr][tc] = 1;
          board[sr][sc] = 0;
          board[mr][mc] = 0;
          sel = null;
          return true;
        }
      }
      return false;
    };

    const aiTurn = () => {
      const moves = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (board[r][c] !== 2) continue;
        for (const dc of [-1, 1]) {
          const nr = r + 1, nc = c + dc;
          if (nr < N && nc >= 0 && nc < N && board[nr][nc] === 0) {
            moves.push({ sr: r, sc: c, tr: nr, tc: nc, cap: null });
          }
          const jr = r + 2, jc = c + dc * 2;
          if (jr < N && jc >= 0 && jc < N && board[r + 1][c + dc] === 1 && board[jr][jc] === 0) {
            moves.unshift({ sr: r, sc: c, tr: jr, tc: jc, cap: [r + 1, c + dc] });
          }
        }
      }
      if (moves.length) {
        const m = moves[0];
        board[m.tr][m.tc] = 2;
        board[m.sr][m.sc] = 0;
        if (m.cap) board[m.cap[0]][m.cap[1]] = 0;
      }
      turn = 1;
      render();
      const pCount = board.flat().filter((v) => v === 1).length;
      const aCount = board.flat().filter((v) => v === 2).length;
      if (!aCount) status.textContent = '🏆 Alle Gegnersteine geschlagen!';
      else if (!pCount) status.textContent = '💥 Alle eigenen Steine verloren!';
      else status.textContent = `Du (⚪): ${pCount} · Gegner (⚫): ${aCount} · Du bist dran`;
    };

    const render = () => {
      wrap.innerHTML = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const isDark = (r + c) % 2 === 1;
        const v = board[r][c];
        const isSel = sel && sel[0] === r && sel[1] === c;
        const sym = v === 1 ? '⚪' : v === 2 ? '⚫' : '';
        const cell = $('button', 'sz-ck-cell ' + (isDark ? 'dark' : 'light') + (isSel ? ' sel' : ''), sym);
        cell.onclick = () => {
          if (turn !== 1) return;
          if (v === 1) {
            sel = [r, c];
            render();
          } else if (sel && tryMove(r, c)) {
            turn = 2;
            render();
            status.textContent = 'Gegner zieht…';
            later(aiTurn, 350);
          }
        };
        wrap.append(cell);
      }
    };

    status.textContent = 'Wähle einen weißen Stein (⚪) und ziehe diagonal';
    render();
  }
});

// ==========================================
// 13. MIAUDOKU
// ==========================================
registerGame({
  id: 'miaudoku',
  title: 'Miaudoku (Kakuro/Sudoku-Stil)',
  icon: '🐱',
  cat: 'Puzzle',
  desc: 'Platziere jedes der 4 Katzensymbole (🐱 😸 🐾 🧶) genau einmal pro Zeile und Spalte.',
  run({ body, status }) {
    const N = 4;
    const SYMS = ['🐱', '😸', '🐾', '🧶'];
    const sol = [
      [0, 1, 2, 3],
      [2, 3, 0, 1],
      [1, 0, 3, 2],
      [3, 2, 1, 0]
    ];
    const fixed = [
      [0, -1, -1, 3],
      [-1, 3, -1, -1],
      [-1, -1, 3, -1],
      [3, -1, -1, 0]
    ];
    let grid = fixed.map((r) => [...r]);

    const wrap = $('div', 'sz-md-grid');
    body.append(wrap);

    const check = () => {
      if (grid.every((r, y) => r.every((v, x) => v === sol[y][x]))) {
        status.textContent = '🐱🎉 Miaudoku perfekt gelöst!';
        return;
      }
      const open = grid.flat().filter((v) => v === -1).length;
      status.textContent = open ? `Noch ${open} Felder offen` : 'Prüfe Zeilen & Spalten auf Doppelte';
    };

    const render = () => {
      wrap.innerHTML = '';
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const isFixed = fixed[r][c] !== -1;
        const val = grid[r][c];
        const cell = $('button', 'sz-md-cell' + (isFixed ? ' fixed' : ''), val >= 0 ? SYMS[val] : '');
        if (!isFixed) {
          cell.onclick = () => {
            grid[r][c] = (grid[r][c] + 1) % SYMS.length;
            render();
            check();
          };
        }
        wrap.append(cell);
      }
    };

    render();
    check();
  }
});

// ==========================================
// 14. HERZEN
// ==========================================
registerGame({
  id: 'herzen',
  title: 'Herzen',
  icon: '♥️',
  cat: 'Karten & Strategie',
  desc: 'Spiele eine Karte aus deiner Hand – Herz-Karten (♥️) geben Minuspunkte, andere Karten bringen Punkte.',
  run({ body, status }) {
    const SUITS = ['♣', '♦', '♠', '♥'];
    const makeHand = () => Array.from({ length: 5 }, () => ({
      s: SUITS[R(SUITS.length)],
      v: 2 + R(12)
    }));

    let hand = makeHand();
    let score = 0, round = 1;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:640px';
    const handEl = $('div', 'sz-pk-hand');
    wrap.append(handEl);
    body.append(wrap);

    const render = () => {
      handEl.innerHTML = '';
      hand.forEach((c, idx) => {
        const red = c.s === '♥' || c.s === '♦';
        const btn = $('button', 'sz-pk-card' + (red ? ' red' : ''),
          `<span>${c.v}</span><span style="font-size:22px">${c.s}</span>`
        );
        btn.onclick = () => {
          hand.splice(idx, 1);
          if (c.s === '♥') {
            score -= c.v;
            status.textContent = `💔 Herz ${c.v} gezogen (-${c.v}) · Konto: ${score}`;
          } else {
            score += 5;
            status.textContent = `✔ Sicher abgelegt (+5) · Konto: ${score}`;
          }
          if (!hand.length) {
            round++;
            hand = makeHand();
          }
          render();
        };
        handEl.append(btn);
      });
    };

    status.textContent = `Runde ${round} · Konto: ${score} · Möglichst wenig Herzen spielen`;
    render();
  }
});

// ==========================================
// 15. MINI METRO
// ==========================================
registerGame({
  id: 'mini-metro',
  title: 'Mini Metro',
  icon: '🚇',
  cat: 'Strategie',
  desc: 'Klicke zwei Stationen nacheinander an, um eine U-Bahn-Linie zu ziehen und Fahrgäste abzuholen.',
  run({ body, status }) {
    const { trackRaf } = makeArcadeCanvasRuntime();
    const W = 520, H = 320;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    const stations = [
      { id: 0, x: 90, y: 110, waiting: 2 },
      { id: 1, x: 210, y: 80, waiting: 1 },
      { id: 2, x: 340, y: 130, waiting: 2 },
      { id: 3, x: 430, y: 220, waiting: 1 },
      { id: 4, x: 150, y: 230, waiting: 2 }
    ];
    let lines = [[0, 1], [1, 2]];
    let selStation = null;
    let delivered = 0;
    let tStep = 0;

    cv.onpointerdown = (e) => {
      const rect = cv.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      const hit = stations.find((s) => Math.hypot(s.x - x, s.y - y) < 22);
      if (!hit) { selStation = null; return; }
      if (selStation === null) {
        selStation = hit.id;
        status.textContent = `Station ${hit.id + 1} gewählt – zweite Station antippen`;
      } else if (selStation !== hit.id) {
        lines.push([selStation, hit.id]);
        selStation = null;
        status.textContent = `Linie gebaut! Befördert: ${delivered}`;
      }
    };

    const loop = () => {
      tStep++;
      if (tStep % 95 === 0) stations[R(stations.length)].waiting++;
      if (tStep % 55 === 0 && lines.length) {
        const ln = lines[R(lines.length)];
        const a = stations[ln[0]], b = stations[ln[1]];
        if (a.waiting > 0) { a.waiting--; delivered++; }
        if (b.waiting > 0) { b.waiting--; delivered++; }
        status.textContent = `Befördert: ${delivered} · Linien: ${lines.length}`;
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 5;
      lines.forEach(([i, j]) => {
        ctx.beginPath();
        ctx.moveTo(stations[i].x, stations[i].y);
        ctx.lineTo(stations[j].x, stations[j].y);
        ctx.stroke();
      });

      stations.forEach((s) => {
        ctx.fillStyle = selStation === s.id ? '#a3e635' : '#f8fafc';
        ctx.beginPath(); ctx.arc(s.x, s.y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(s.waiting), s.x, s.y + 4);
      });

      trackRaf(requestAnimationFrame(loop));
    };

    status.textContent = `Befördert: 0 · Zwei Stationen antippen, um Linien zu ziehen`;
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 16. BALATRO
// ==========================================
registerGame({
  id: 'balatro',
  title: 'Balatro',
  icon: '🃏',
  cat: 'Karten & Strategie',
  desc: 'Wähle bis zu 5 Karten und spiele deine Hand, um das Punktesoll der Runde zu erreichen.',
  run({ body, status }) {
    const SUITS = ['♠', '♥', '♦', '♣'];
    const dealHand = () => Array.from({ length: 7 }, () => ({
      s: SUITS[R(SUITS.length)],
      v: 2 + R(12),
      sel: false
    }));

    let hand = dealHand();
    let score = 0, target = 120, handsLeft = 3;

    const wrap = $('div', 'sz-pk-wrap');
    const handEl = $('div', 'sz-pk-hand');
    const playBtn = $('button', 'sz-btn sz-btn-primary', 'Hand spielen');
    wrap.append(handEl, playBtn);
    body.append(wrap);

    const calcPlay = (picked) => {
      if (!picked.length) return 0;
      const chips = picked.reduce((sum, c) => sum + c.v, 0) + 15;
      const mult = picked.length >= 3 ? 3 : picked.length === 2 ? 2 : 1;
      return chips * mult;
    };

    const render = () => {
      handEl.innerHTML = '';
      hand.forEach((c) => {
        const red = c.s === '♥' || c.s === '♦';
        const btn = $('button', 'sz-pk-card' + (red ? ' red' : '') + (c.sel ? ' hold' : ''),
          `<span>${c.v}</span><span style="font-size:22px">${c.s}</span>`
        );
        btn.onclick = () => {
          const curSelCount = hand.filter((x) => x.sel).length;
          if (!c.sel && curSelCount >= 5) return;
          c.sel = !c.sel;
          render();
        };
        handEl.append(btn);
      });
      status.textContent = `Punkte: ${score}/${target} · Hände übrig: ${handsLeft}`;
    };

    playBtn.onclick = () => {
      if (handsLeft <= 0 || score >= target) return;
      const picked = hand.filter((c) => c.sel);
      if (!picked.length) return;
      const pts = calcPlay(picked);
      score += pts;
      handsLeft--;
      hand = hand.filter((c) => !c.sel);
      while (hand.length < 7) hand.push({ s: SUITS[R(SUITS.length)], v: 2 + R(12), sel: false });
      render();
      if (score >= target) {
        status.textContent = `🏆 Ziel geknackt! (${score}/${target} Punkte)`;
      } else if (handsLeft === 0) {
        status.textContent = `💥 Hände aufgebraucht (${score}/${target} Punkte)`;
      } else {
        status.textContent = `+${pts} Punkte! · Stand: ${score}/${target} · Hände: ${handsLeft}`;
      }
    };

    render();
  }
});

// ==========================================
// 17. HOTEL MANAGER
// ==========================================
registerGame({
  id: 'hotel-manager',
  title: 'Hotel manager',
  icon: '🏨',
  cat: 'Strategie',
  desc: 'Tippe auf freie Zimmer, um Gäste einzuchecken, und kassiere Einnahmen von belegten Zimmern.',
  run({ body, status }) {
    const { later } = makeRuntime();
    let cash = 100;
    let rooms = ['free', 'guest', 'free', 'dirty', 'free', 'guest'];

    const wrap = $('div', 'sz-hm-grid');
    body.append(wrap);

    const tickGuests = () => {
      rooms = rooms.map((r) => (r === 'free' && R(100) < 35 ? 'guest' : r));
      render();
      later(tickGuests, 2200);
    };

    const render = () => {
      wrap.innerHTML = '';
      rooms.forEach((st, idx) => {
        const label = st === 'free' ? '🟢 Frei (Einchecken)' : st === 'guest' ? '🛎️ Gast da (+25€)' : '🧹 Aufräumen';
        const btn = $('button', 'sz-hm-room', `<span style="font-size:18px">Zimmer ${idx + 1}</span><span>${label}</span>`);
        btn.onclick = () => {
          if (st === 'free') rooms[idx] = 'guest';
          else if (st === 'guest') { cash += 25; rooms[idx] = 'dirty'; }
          else rooms[idx] = 'free';
          render();
        };
        wrap.append(btn);
      });
      status.textContent = `Kasse: ${cash} € · Zimmer antippen zum Verwalten`;
    };

    render();
    later(tickGuests, 2200);
  }
});

// ==========================================
// 18. RIDER
// ==========================================
registerGame({
  id: 'rider',
  title: 'Rider',
  icon: '🏍️',
  cat: 'Action',
  desc: 'Halte gedrückt (Maus/Finger/Leertaste), um auf Rampen abzuspringen und sauber zu landen.',
  run({ body, status }) {
    const { trackRaf, on, bindKeys } = makeArcadeCanvasRuntime();
    const W = 480, H = 300;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let bikeY = 190, vy = 0, air = false, holding = false, score = 0, over = false, tick = 0;

    const reset = () => {
      bikeY = 190; vy = 0; air = false; holding = false; score = 0; over = false; tick = 0;
      status.textContent = 'Punkte: 0 · Gedrückt halten zum Springen';
    };

    const pressStart = () => {
      if (over) { reset(); return; }
      holding = true;
      if (!air) { vy = -6.8; air = true; }
    };
    const pressEnd = () => { holding = false; };

    cv.onpointerdown = pressStart;
    on(window, 'pointerup', pressEnd);
    on(window, 'pointercancel', pressEnd);
    bindKeys([' ', 'ArrowUp'], (e, firstPress) => {
      if (e.type === 'keydown' && firstPress) pressStart();
      if (e.type === 'keyup') pressEnd();
    });

    const loop = () => {
      if (!over) {
        tick++;
        if (tick % 35 === 0) { score++; status.textContent = `Punkte: ${score}`; }
        if (air) {
          vy += holding ? 0.24 : 0.42;
          bikeY += vy;
          if (bikeY >= 190) {
            bikeY = 190;
            vy = 0;
            air = false;
          }
        }
      }

      ctx.fillStyle = '#0c0918';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#312e81';
      ctx.fillRect(0, 206, W, H - 206);

      ctx.fillStyle = '#a3e635';
      ctx.beginPath(); ctx.arc(110, bikeY, 14, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    reset();
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 19. SRW2
// ==========================================
registerGame({
  id: 'srw2',
  title: 'SRW2',
  icon: '🚀',
  cat: 'Action',
  desc: 'Wechsle zwischen 3 Spuren (links/rechts oder Pfeiltasten/A/D) und weiche Hindernissen aus.',
  run({ body, status }) {
    const { trackRaf, bindKeys } = makeArcadeCanvasRuntime();
    const W = 380, H = 480;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    const lanes = [95, 190, 285];
    let lane = 1, score = 0, over = false, obs = [], tick = 0;

    const reset = () => {
      lane = 1; score = 0; over = false; obs = []; tick = 0;
      status.textContent = 'Punkte: 0 · Spur wechseln';
    };

    cv.onpointerdown = (e) => {
      if (over) { reset(); return; }
      const rect = cv.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      lane = x < W / 2 ? Math.max(0, lane - 1) : Math.min(2, lane + 1);
    };

    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', ' '], (e, firstPress) => {
      if (e.type !== 'keydown' || !firstPress) return;
      if (over && e.key === ' ') { reset(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'a') lane = Math.max(0, lane - 1);
      if (e.key === 'ArrowRight' || e.key === 'd') lane = Math.min(2, lane + 1);
    });

    const loop = () => {
      if (!over) {
        tick++;
        if (tick % 46 === 1) {
          obs.push({ ln: R(3), y: -30, vy: 4.2 + Math.min(2.5, score * 0.04) });
        }
        const py = H - 70;
        for (let i = obs.length - 1; i >= 0; i--) {
          const o = obs[i];
          o.y += o.vy;
          if (o.y > py + 24 && !o.passed) {
            o.passed = true;
            score++;
            status.textContent = `Punkte: ${score}`;
          }
          if (o.ln === lane && Math.abs(o.y - py) < 24) {
            over = true;
            status.textContent = `💥 Kollision! Punkte: ${score} · Tippen für Neustart`;
          }
          if (o.y > H + 30) obs.splice(i, 1);
        }
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      [142, 238].forEach((x) => {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      });

      obs.forEach((o) => {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(lanes[o.ln] - 18, o.y - 18, 36, 36);
      });

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(lanes[lane] - 18, H - 88, 36, 36);

      trackRaf(requestAnimationFrame(loop));
    };

    reset();
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 20. TOMB OF THE MASK
// ==========================================
registerGame({
  id: 'tomb-of-the-mask',
  title: 'Tomb of the Mask',
  icon: '🎭',
  cat: 'Action',
  desc: 'Wische oder nutze Pfeiltasten/WASD – deine Figur rast bis zur nächsten Wand und sammelt Edelsteine.',
  run({ body, status }) {
    const { trackRaf, on, bindKeys } = makeArcadeCanvasRuntime();
    const N = 7, cell = 46;
    let map = [
      1, 1, 1, 1, 1, 1, 1,
      1, 0, 0, 2, 0, 0, 1,
      1, 0, 1, 1, 0, 1, 1,
      1, 0, 0, 0, 2, 0, 1,
      1, 1, 0, 1, 1, 0, 1,
      1, 2, 0, 0, 0, 3, 1,
      1, 1, 1, 1, 1, 1, 1
    ];
    let px = 1, py = 1, vx = 0, vy = 0, gems = 0, won = false;
    let sx = 0, sy = 0, swiping = false;

    const cv = $('canvas', 'sz-arc-cv');
    cv.width = N * cell; cv.height = N * cell;
    body.append(cv);
    const ctx = cv.getContext('2d');

    const startDash = (dx, dy) => {
      if (won || vx !== 0 || vy !== 0) return;
      vx = dx; vy = dy;
    };

    cv.onpointerdown = (e) => { sx = e.clientX; sy = e.clientY; swiping = true; };
    on(window, 'pointerup', (e) => {
      if (!swiping) return;
      swiping = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) < 16 && Math.abs(dy) < 16) return;
      if (Math.abs(dx) > Math.abs(dy)) startDash(Math.sign(dx), 0);
      else startDash(0, Math.sign(dy));
    });

    bindKeys(['ArrowUp', 'w', 'ArrowDown', 's', 'ArrowLeft', 'a', 'ArrowRight', 'd'], (e, firstPress) => {
      if (e.type !== 'keydown' || !firstPress) return;
      const dir = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] }[e.key];
      if (dir) startDash(...dir);
    });

    let tick = 0;
    const loop = () => {
      tick++;
      if (!won && (vx !== 0 || vy !== 0) && tick % 6 === 0) {
        const nx = px + vx, ny = py + vy;
        const tile = map[ny * N + nx];
        if (tile === 1) {
          vx = 0; vy = 0;
        } else {
          px = nx; py = ny;
          if (tile === 2) {
            map[ny * N + nx] = 0;
            gems++;
            status.textContent = `💎 Edelsteine: ${gems} · Weiter zum Ausgang`;
          } else if (tile === 3) {
            won = true;
            vx = 0; vy = 0;
            status.textContent = `🏆 Ausgang erreicht! Edelsteine: ${gems}`;
          }
        }
      }

      ctx.fillStyle = '#120d26';
      ctx.fillRect(0, 0, cv.width, cv.height);

      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const t = map[y * N + x];
        if (t === 1) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(x * cell, y * cell, cell, cell);
        } else if (t === 2) {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath(); ctx.arc(x * cell + cell / 2, y * cell + cell / 2, 8, 0, Math.PI * 2); ctx.fill();
        } else if (t === 3) {
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(x * cell + 8, y * cell + 8, cell - 16, cell - 16);
        }
      }

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(px * cell + cell / 2, py * cell + cell / 2, 14, 0, Math.PI * 2);
      ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    status.textContent = `💎 Edelsteine: 0 · Wischen oder Pfeiltasten zum Rasen`;
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 21. COLOR SLIDE
// ==========================================
registerGame({
  id: 'color-slide',
  title: 'Color Slide',
  icon: '🎨',
  cat: 'Puzzle',
  desc: 'Tippe auf Kacheln neben dem freien Feld, um sie zu verschieben und Farben in Reihen zu ordnen.',
  run({ body, status }) {
    const COLS = ['#0f172a', '#ef4444', '#3b82f6', '#22c55e'];
    const LBL = ['', 'ROT', 'BLAU', 'GRÜN'];
    let tiles = [1, 2, 3, 1, 2, 3, 1, 2, 0];
    let moves = 0;

    const wrap = $('div', 'sz-cs-grid');
    body.append(wrap);

    const checkDone = () => {
      const rowsOk = [0, 3, 6].every((start) => {
        const vals = tiles.slice(start, start + 3).filter((v) => v !== 0);
        return vals.length > 0 && vals.every((v) => v === vals[0]);
      });
      status.textContent = rowsOk
        ? `🎉 Reihen sortiert in ${moves} Zügen!`
        : `Züge: ${moves} · Gleiche Farben in Reihen bringen`;
    };

    const render = () => {
      wrap.innerHTML = '';
      tiles.forEach((v, idx) => {
        const btn = $('button', 'sz-cs-tile', LBL[v]);
        btn.style.background = COLS[v];
        btn.onclick = () => {
          const empty = tiles.indexOf(0);
          const r1 = Math.floor(idx / 3), c1 = idx % 3;
          const r2 = Math.floor(empty / 3), c2 = empty % 3;
          if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
            [tiles[idx], tiles[empty]] = [tiles[empty], tiles[idx]];
            moves++;
            render();
            checkDone();
          }
        };
        wrap.append(btn);
      });
    };

    render();
    checkDone();
  }
});

// ==========================================
// 22. NONOGRAM
// ==========================================
registerGame({
  id: 'nonogram',
  title: 'Nonogram',
  icon: '⬛',
  cat: 'Puzzle',
  desc: 'Nutze die Zahlen links (Blöcke pro Zeile) und fülle die Felder zum Pixelbild aus.',
  run({ body, status }) {
    const N = 5;
    const sol = [
      0, 1, 0, 1, 0,
      1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
      0, 1, 1, 1, 0,
      0, 0, 1, 0, 0
    ];
    let grid = Array(N * N).fill(0);

    const rowHint = (r) => {
      const runs = [];
      let cur = 0;
      for (let c = 0; c < N; c++) {
        if (sol[r * N + c]) cur++;
        else if (cur) { runs.push(cur); cur = 0; }
      }
      if (cur) runs.push(cur);
      return runs.join(' ');
    };

    const wrap = $('div', 'sz-ng-wrap');
    body.append(wrap);

    const checkWin = () => {
      const ok = grid.every((v, i) => v === sol[i]);
      status.textContent = ok ? '🎉 Nonogram gelöst!' : 'Felder antippen zum Ausfüllen';
    };

    const render = () => {
      wrap.innerHTML = '';
      for (let r = 0; r < N; r++) {
        const row = $('div', 'sz-ng-row');
        row.append($('span', 'sz-ng-hint', rowHint(r)));
        for (let c = 0; c < N; c++) {
          const idx = r * N + c;
          const cell = $('button', 'sz-ng-cell' + (grid[idx] ? ' fill' : ''), grid[idx] ? '■' : '');
          cell.onclick = () => {
            grid[idx] = grid[idx] ? 0 : 1;
            render();
            checkWin();
          };
          row.append(cell);
        }
        wrap.append(row);
      }
    };

    render();
    checkWin();
  }
});

// ==========================================
// 23. BALL BLAST
// ==========================================
registerGame({
  id: 'ball-blast',
  title: 'Ball Blast',
  icon: '💥',
  cat: 'Action',
  desc: 'Lenke die Kanone nach links/rechts und schieße auf herabfallende Zahlenblöcke.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const W = 400, H = 480;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let gunX = W / 2, score = 0, over = false;
    let bullets = [], blocks = [], tick = 0;

    const reset = () => {
      gunX = W / 2; score = 0; over = false; bullets = []; blocks = []; tick = 0;
      status.textContent = 'Punkte: 0 · Blöcke abschießen!';
    };

    const setX = (clientX) => {
      const rect = cv.getBoundingClientRect();
      gunX = Math.max(24, Math.min(W - 24, ((clientX - rect.left) / rect.width) * W));
    };

    cv.onpointerdown = (e) => {
      if (over) { reset(); return; }
      cv.setPointerCapture(e.pointerId);
      setX(e.clientX);
    };
    cv.onpointermove = (e) => { if (!over && (e.buttons || e.pointerType === 'touch')) setX(e.clientX); };
    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', ' '], (e, firstPress) => {
      if (over && e.key === ' ' && firstPress) reset();
    });

    const loop = () => {
      if (!over) {
        if (keys.ArrowLeft || keys.a) gunX = Math.max(24, gunX - 5);
        if (keys.ArrowRight || keys.d) gunX = Math.min(W - 24, gunX + 5);

        tick++;
        if (tick % 10 === 0) bullets.push({ x: gunX, y: H - 56, vy: -8 });
        if (tick % 65 === 1) {
          blocks.push({ x: 35 + R(W - 110), y: -36, size: 46, hp: 4 + R(8), vy: 1.5 });
        }

        for (let i = bullets.length - 1; i >= 0; i--) {
          bullets[i].y += bullets[i].vy;
          if (bullets[i].y < -10) bullets.splice(i, 1);
        }

        for (let j = blocks.length - 1; j >= 0; j--) {
          const b = blocks[j];
          b.y += b.vy;

          for (let i = bullets.length - 1; i >= 0; i--) {
            const bl = bullets[i];
            if (bl.x > b.x && bl.x < b.x + b.size && bl.y > b.y && bl.y < b.y + b.size) {
              bullets.splice(i, 1);
              b.hp--;
              score++;
              status.textContent = `Punkte: ${score}`;
              if (b.hp <= 0) {
                blocks.splice(j, 1);
                break;
              }
            }
          }

          if (blocks[j] && b.y + b.size > H - 44) {
            over = true;
            status.textContent = `💥 Block durchgebrochen! Punkte: ${score} · Tippen für Neustart`;
          }
        }
      }

      ctx.fillStyle = '#0c0918';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#a3e635';
      bullets.forEach((bl) => ctx.fillRect(bl.x - 2, bl.y - 8, 4, 10));

      blocks.forEach((b) => {
        ctx.fillStyle = '#7c3aed';
        ctx.beginPath(); ctx.roundRect(b.x, b.y, b.size, b.size, 10); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '900 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(b.hp), b.x + b.size / 2, b.y + b.size / 2 + 6);
      });

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(gunX - 18, H - 44, 36, 22);

      trackRaf(requestAnimationFrame(loop));
    };

    reset();
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 24. EPIC PLANE
// ==========================================
registerGame({
  id: 'epic-plane',
  title: 'Epic Plane',
  icon: '✈️',
  cat: 'Action',
  desc: 'Steuere dein Flugzeug hoch/runter (Finger/Maus/Pfeiltasten), sammle Sterne und weiche Wolkenblöcken aus.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const W = 480, H = 320;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let py = H / 2, score = 0, over = false, items = [], tick = 0;

    const reset = () => {
      py = H / 2; score = 0; over = false; items = []; tick = 0;
      status.textContent = 'Punkte: 0 · Sterne sammeln & ausweichen';
    };

    const setY = (clientY) => {
      const rect = cv.getBoundingClientRect();
      py = Math.max(20, Math.min(H - 20, ((clientY - rect.top) / rect.height) * H));
    };

    cv.onpointerdown = (e) => {
      if (over) { reset(); return; }
      cv.setPointerCapture(e.pointerId);
      setY(e.clientY);
    };
    cv.onpointermove = (e) => { if (!over && (e.buttons || e.pointerType === 'touch')) setY(e.clientY); };
    bindKeys(['ArrowUp', 'w', 'ArrowDown', 's', ' '], (e, firstPress) => {
      if (over && e.key === ' ' && firstPress) reset();
    });

    const loop = () => {
      if (!over) {
        if (keys.ArrowUp || keys.w) py = Math.max(20, py - 4.5);
        if (keys.ArrowDown || keys.s) py = Math.min(H - 20, py + 4.5);

        tick++;
        if (tick % 42 === 1) {
          items.push({ x: W + 20, y: 30 + R(H - 60), isStar: R(3) === 0, vx: 3.6 });
        }

        const px = 85;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.x -= it.vx;
          if (Math.hypot(it.x - px, it.y - py) < 22) {
            if (it.isStar) {
              score += 5;
              status.textContent = `⭐ +5 Punkte! Stand: ${score}`;
              items.splice(i, 1);
              continue;
            } else {
              over = true;
              status.textContent = `💥 Treffer! Punkte: ${score} · Tippen für Neustart`;
            }
          }
          if (it.x < -30) items.splice(i, 1);
        }
      }

      ctx.fillStyle = '#0e172a';
      ctx.fillRect(0, 0, W, H);
      items.forEach((it) => {
        ctx.fillStyle = it.isStar ? '#facc15' : '#ef4444';
        ctx.beginPath(); ctx.arc(it.x, it.y, 12, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(85, py, 14, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    reset();
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 25. MERGE
// ==========================================
registerGame({
  id: 'merge',
  title: 'Merge',
  icon: '✨',
  cat: 'Puzzle',
  desc: 'Tippe auf ein Feld mit Nachbarn gleicher Stufe, um es auf die nächste Stufe zu erhöhen.',
  run({ body, status }) {
    const N = 4;
    const SYMS = ['✨', '🔮', '⚡', '🔥', '👑', '🌟'];
    let grid = Array.from({ length: N * N }, () => R(3));
    let score = 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = `display:grid;grid-template-columns:repeat(${N},64px);gap:8px`;
    body.append(wrap);

    const neighbors = (idx) => {
      const r = Math.floor(idx / N), c = idx % N, out = [];
      if (r > 0) out.push((r - 1) * N + c);
      if (r < N - 1) out.push((r + 1) * N + c);
      if (c > 0) out.push(r * N + (c - 1));
      if (c < N - 1) out.push(r * N + (c + 1));
      return out;
    };

    const render = () => {
      wrap.innerHTML = '';
      grid.forEach((lvl, idx) => {
        const btn = $('button', 'sz-btn', `${SYMS[lvl % SYMS.length]}<br><small>Stufe ${lvl + 1}</small>`);
        btn.style.cssText = 'width:64px;height:64px;padding:4px;font-size:16px;background:var(--sz-surface-2)';
        btn.onclick = () => {
          const match = neighbors(idx).find((n) => grid[n] === lvl);
          if (match !== undefined) {
            grid[match] = R(3);
            grid[idx] = lvl + 1;
            score += (lvl + 1) * 10;
            status.textContent = `✨ Verschmolzen zu Stufe ${grid[idx] + 1}! Punkte: ${score}`;
            render();
          } else {
            status.textContent = 'Kein direkter Nachbar mit gleicher Stufe';
          }
        };
        wrap.append(btn);
      });
    };

    status.textContent = `Punkte: ${score} · Gleiche Nachbarn verschmelzen`;
    render();
  }
});

// ==========================================
// 26. BRAWL STARS (ARENA-MODUS)
// ==========================================
registerGame({
  id: 'brawl-stars',
  title: 'Brawl Stars (Arena-Modus)',
  icon: '🔥',
  cat: 'Action',
  desc: 'Bewege dich mit Finger/Maus oder WASD/Pfeiltasten und tippe/drücke Leertaste zum Schießen.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const W = 480, H = 320;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let px = 110, py = H / 2, ex = W - 95, ey = H / 2;
    let score = 0, shots = [];

    const fire = () => shots.push({ x: px + 18, y: py, vx: 7 });

    cv.onpointerdown = (e) => {
      const rect = cv.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      if (x > px + 40) fire();
      else { px = Math.max(24, Math.min(W - 24, x)); py = Math.max(24, Math.min(H - 24, y)); }
    };
    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', 'ArrowUp', 'w', 'ArrowDown', 's', ' '], (e, firstPress) => {
      if (e.key === ' ' && e.type === 'keydown' && firstPress) fire();
    });

    const loop = () => {
      if (keys.ArrowLeft || keys.a) px = Math.max(24, px - 4.5);
      if (keys.ArrowRight || keys.d) px = Math.min(W - 24, px + 4.5);
      if (keys.ArrowUp || keys.w) py = Math.max(24, py - 4.5);
      if (keys.ArrowDown || keys.s) py = Math.min(H - 24, py + 4.5);

      ey = H / 2 + Math.sin(performance.now() * 0.0025) * 90;

      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.x += s.vx;
        if (Math.hypot(s.x - ex, s.y - ey) < 22) {
          score += 10;
          status.textContent = `🔥 Treffer! Punkte: ${score}`;
          shots.splice(i, 1);
          continue;
        }
        if (s.x > W + 20) shots.splice(i, 1);
      }

      ctx.fillStyle = '#141129';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#facc15';
      shots.forEach((s) => { ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(ex, ey, 16, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    status.textContent = `Punkte: 0 · Leertaste oder rechts tippen zum Schießen`;
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 27. HARVEST.IO
// ==========================================
registerGame({
  id: 'harvest-io',
  title: 'Harvest.io',
  icon: '🌾',
  cat: 'Action',
  desc: 'Steuere deinen Spieler mit Finger/Maus oder WASD/Pfeiltasten und sammle Weizenbündel ein.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const W = 480, H = 320;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let px = W / 2, py = H / 2, harvested = 0;
    let crops = Array.from({ length: 8 }, () => ({ x: 40 + R(W - 80), y: 40 + R(H - 80) }));

    const moveTo = (clientX, clientY) => {
      const rect = cv.getBoundingClientRect();
      px = Math.max(20, Math.min(W - 20, ((clientX - rect.left) / rect.width) * W));
      py = Math.max(20, Math.min(H - 20, ((clientY - rect.top) / rect.height) * H));
    };

    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); moveTo(e.clientX, e.clientY); };
    cv.onpointermove = (e) => { if (e.buttons || e.pointerType === 'touch') moveTo(e.clientX, e.clientY); };
    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', 'ArrowUp', 'w', 'ArrowDown', 's']);

    const loop = () => {
      if (keys.ArrowLeft || keys.a) px = Math.max(20, px - 4);
      if (keys.ArrowRight || keys.d) px = Math.min(W - 20, px + 4);
      if (keys.ArrowUp || keys.w) py = Math.max(20, py - 4);
      if (keys.ArrowDown || keys.s) py = Math.min(H - 20, py + 4);

      const radius = 14 + Math.min(14, harvested * 0.4);
      for (let i = crops.length - 1; i >= 0; i--) {
        if (Math.hypot(crops[i].x - px, crops[i].y - py) < radius + 8) {
          harvested++;
          crops.splice(i, 1);
          crops.push({ x: 35 + R(W - 70), y: 35 + R(H - 70) });
          status.textContent = `🌾 Geerntet: ${harvested}`;
        }
      }

      ctx.fillStyle = '#1a2e1a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#facc15';
      crops.forEach((c) => { ctx.beginPath(); ctx.arc(c.x, c.y, 7, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#22c55e';
      ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    status.textContent = `🌾 Geerntet: 0 · Weizen einsammeln`;
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 28. BTD 6 (TOWER DEFENSE)
// ==========================================
registerGame({
  id: 'btd-6',
  title: 'BTD 6 (Tower Defense)',
  icon: '🎈',
  cat: 'Strategie',
  desc: 'Tippe auf die Karte, um Verteidigungstürme zu platzieren, die vorbeiziehende Ballons treffen.',
  run({ body, status }) {
    const { trackRaf } = makeArcadeCanvasRuntime();
    const W = 480, H = 320;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let towers = [{ x: 160, y: 110 }, { x: 310, y: 210 }];
    let balloons = [];
    let popped = 0, tick = 0;

    cv.onpointerdown = (e) => {
      if (towers.length >= 6) return;
      const rect = cv.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * W;
      const y = ((e.clientY - rect.top) / rect.height) * H;
      towers.push({ x, y });
      status.textContent = `Turm platziert (${towers.length}/6) · Geplatzt: ${popped}`;
    };

    const loop = () => {
      tick++;
      if (tick % 65 === 1) balloons.push({ x: 20, y: 160, vx: 1.8, hp: 2 });

      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i];
        b.x += b.vx;
        if (tick % 24 === 0) {
          const inRange = towers.some((t) => Math.hypot(t.x - b.x, t.y - b.y) < 115);
          if (inRange) {
            b.hp--;
            if (b.hp <= 0) {
              popped++;
              balloons.splice(i, 1);
              status.textContent = `🎈 Geplatzt: ${popped} · Türme: ${towers.length}/6`;
              continue;
            }
          }
        }
        if (b.x > W + 20) balloons.splice(i, 1);
      }

      ctx.fillStyle = '#132a1e';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#a16207';
      ctx.lineWidth = 24;
      ctx.beginPath(); ctx.moveTo(0, 160); ctx.lineTo(W, 160); ctx.stroke();

      towers.forEach((t) => {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(t.x, t.y, 13, 0, Math.PI * 2); ctx.fill();
      });

      balloons.forEach((b) => {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();
      });

      trackRaf(requestAnimationFrame(loop));
    };

    status.textContent = `Geplatzt: 0 · Tippen zum Platzieren von Türmen (max. 6)`;
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 29. DRILL AND CONNECT
// ==========================================
registerGame({
  id: 'drill-and-connect',
  title: 'Drill and Connect',
  icon: '⛏️',
  cat: 'Puzzle',
  desc: 'Tippe oder ziehe benachbarte Gesteinsfelder (🟫) ab Start (S) bis zum Ziel (Z), um sie zu graben.',
  run({ body, status }) {
    const N = 6;
    let rock = Array(N * N).fill(1);
    const start = 0, goal = N * N - 1;
    rock[start] = 0;
    rock[goal] = 0;
    let dug = [start];

    const wrap = $('div', 'sz-lm-grid');
    wrap.style.gridTemplateColumns = `repeat(${N}, 46px)`;
    body.append(wrap);

    const isAdj = (a, b) => {
      const ar = Math.floor(a / N), ac = a % N;
      const br = Math.floor(b / N), bc = b % N;
      return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
    };

    const render = () => {
      wrap.innerHTML = '';
      for (let i = 0; i < N * N; i++) {
        const isDug = dug.includes(i);
        const label = i === start ? 'S' : i === goal ? 'Z' : rock[i] ? '🟫' : '';
        const cell = $('button', 'sz-lm-cell' + (isDug ? ' path' : '') + (i === goal ? ' goal' : ''), label);
        cell.onclick = () => {
          const last = dug[dug.length - 1];
          if (!isDug && isAdj(last, i)) {
            rock[i] = 0;
            dug.push(i);
            render();
            status.textContent = i === goal
              ? `🏆 Verbindung gegraben in ${dug.length - 1} Schritten!`
              : `Schritte: ${dug.length - 1} · Weiter Richtung Z`;
          }
        };
        wrap.append(cell);
      }
    };

    status.textContent = `Von S nach Z durch Gestein graben`;
    render();
  }
});

// ==========================================
// 30. HAY DAY (HOF-MINI)
// ==========================================
registerGame({
  id: 'hay-day',
  title: 'Hay Day (Hof-Mini)',
  icon: '🚜',
  cat: 'Strategie',
  desc: 'Tippe auf leere Felder zum Säen und ernte reifen Weizen (🌾) für Münzen.',
  run({ body, status }) {
    const { later } = makeRuntime();
    let coins = 50;
    let plots = [0, 2, 1, 0, 2, 0];

    const wrap = $('div', 'sz-hd-grid');
    body.append(wrap);

    const growTick = () => {
      plots = plots.map((p) => (p === 1 ? 2 : p));
      render();
      later(growTick, 1600);
    };

    const render = () => {
      wrap.innerHTML = '';
      plots.forEach((p, idx) => {
        const txt = p === 0 ? '🌱 Säen' : p === 1 ? '⏳ Wächst…' : '🌾 Ernten (+15)';
        const btn = $('button', 'sz-hd-plot', `<span>Feld ${idx + 1}</span><span>${txt}</span>`);
        btn.onclick = () => {
          if (p === 0) plots[idx] = 1;
          else if (p === 2) { coins += 15; plots[idx] = 0; }
          render();
        };
        wrap.append(btn);
      });
      status.textContent = `Münzen: ${coins} · Felder säen & reife Ernte einsammeln`;
    };

    render();
    later(growTick, 1600);
  }
});

// ==========================================
// 31. MONUMENT VALLEY
// ==========================================
registerGame({
  id: 'monument-valley',
  title: 'Monument Valley',
  icon: '🏛️',
  cat: 'Puzzle',
  desc: 'Drehe die Brücke gerade (waagerecht), damit deine Figur (🟣) zum Portal (🟢) gehen kann. Dein Fortschritt bleibt gespeichert.',
  run({ body, status }) {
    const saved = loadGameProgress('monument-valley', { rot: 0, solved: false });
    let rot = saved.rot || 0;
    let solved = !!saved.solved;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px';

    const view = $('div', null, '');
    view.style.cssText = 'width:260px;height:170px;border-radius:16px;background:var(--sz-surface-2);display:flex;align-items:center;justify-content:space-around;font-size:32px;padding:12px';

    const bridge = $('div', null, '🌉');
    bridge.style.transition = 'transform 180ms ease';
    view.append('🟣', bridge, '🟢');

    const ctrls = $('div', null, '');
    ctrls.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    const rotBtn = $('button', 'sz-btn sz-btn-primary', '🔄 Brücke drehen');
    const walkBtn = $('button', 'sz-btn sz-btn-lime', '🚶 Gehen');
    ctrls.append(rotBtn, walkBtn);

    wrap.append(view, ctrls);
    body.append(wrap);

    const render = () => {
      bridge.style.transform = `rotate(${rot * 90}deg)`;
      saveGameProgress('monument-valley', { rot, solved });
      if (solved) {
        status.textContent = '🏛️ Portal erreicht! (Gespeichert)';
      } else {
        status.textContent = rot % 2 === 0
          ? 'Brücke ausgerichtet – gehe zum Portal!'
          : 'Brücke verdreht – zum Ausrichten drehen';
      }
    };

    rotBtn.onclick = () => { rot = (rot + 1) % 4; render(); };
    walkBtn.onclick = () => {
      if (rot % 2 === 0) { solved = true; render(); }
      else status.textContent = '⚠ Weg unterbrochen – erst die Brücke gerade drehen!';
    };

    render();
  }
});

// ==========================================
// 32. CUT THE ROPE
// ==========================================
registerGame({
  id: 'cut-the-rope',
  title: 'Cut the Rope',
  icon: '🍬',
  cat: 'Puzzle',
  desc: 'Kappe das Seil, damit das Bonbon (🍬) zum Monster (🐸) fällt.',
  run({ body, status }) {
    const saved = loadGameProgress('cut-the-rope', { wins: 0 });
    let wins = saved.wins || 0;
    let cut = false, y = 40;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const box = $('div', null, '');
    box.style.cssText = 'position:relative;width:240px;height:220px;border-radius:16px;background:var(--sz-surface-2);overflow:hidden';

    const candy = $('div', null, '🍬');
    candy.style.cssText = 'position:absolute;left:104px;font-size:28px;transition:top 260ms ease-in';
    const rope = $('div', null, '|');
    rope.style.cssText = 'position:absolute;left:115px;top:0;font-size:22px;font-weight:900';
    const frog = $('div', null, '🐸');
    frog.style.cssText = 'position:absolute;left:102px;bottom:14px;font-size:32px';

    box.append(rope, candy, frog);
    const cutBtn = $('button', 'sz-btn sz-btn-primary', '✂️ Seil kappen');
    const resetBtn = $('button', 'sz-btn sz-btn-ghost', 'Neu spannen');
    wrap.append(box, cutBtn, resetBtn);
    body.append(wrap);

    const sync = () => {
      candy.style.top = `${y}px`;
      rope.style.opacity = cut ? '0.15' : '1';
      saveGameProgress('cut-the-rope', { wins });
      status.textContent = `Gefangen: ${wins} · ${cut ? 'Bonbon gefallen!' : 'Seil kappen zum Fallenlassen'}`;
    };

    cutBtn.onclick = () => { if (!cut) { cut = true; y = 165; wins++; sync(); } };
    resetBtn.onclick = () => { cut = false; y = 40; sync(); };

    sync();
  }
});

// ==========================================
// 33. ANGRY BIRDS
// ==========================================
registerGame({
  id: 'angry-birds',
  title: 'Angry Birds',
  icon: '🐦',
  cat: 'Action',
  desc: 'Wähle den Winkel und feuere den Vogel auf das Ziel (Trefferbereich: 30°–50°).',
  run({ body, status }) {
    const saved = loadGameProgress('angry-birds', { hits: 0, angle: 35 });
    let hits = saved.hits || 0;
    let angle = saved.angle ?? 35;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:460px';
    const slider = $('input', null, '');
    slider.type = 'range'; slider.min = '10'; slider.max = '75'; slider.value = String(angle);
    const fireBtn = $('button', 'sz-btn sz-btn-primary', '🚀 Abschuss');
    const out = $('div', null, '');
    out.style.cssText = 'padding:16px;border-radius:14px;background:var(--sz-surface-2);width:100%;text-align:center;font-weight:800';
    wrap.append(slider, fireBtn, out);
    body.append(wrap);

    const save = () => saveGameProgress('angry-birds', { hits, angle });

    slider.oninput = () => {
      angle = Number(slider.value);
      save();
      status.textContent = `Treffer: ${hits} · Winkel: ${angle}° (Zielbereich: 30°–50°)`;
    };

    fireBtn.onclick = () => {
      if (angle >= 30 && angle <= 50) {
        hits++;
        out.textContent = `🎯 Treffer bei ${angle}°! Gesamttreffer: ${hits}`;
      } else {
        out.textContent = `💨 Daneben bei ${angle}° – versuche einen Winkel zwischen 30° und 50°`;
      }
      save();
      status.textContent = `Treffer: ${hits} · Winkel: ${angle}°`;
    };

    status.textContent = `Treffer: ${hits} · Winkel: ${angle}° (Zielbereich: 30°–50°)`;
  }
});

// ==========================================
// 34. CROSSY ROAD
// ==========================================
registerGame({
  id: 'crossy-road',
  title: 'Crossy Road',
  icon: '🐔',
  cat: 'Action',
  desc: 'Steuere deine Figur vorwärts/seitwärts und weiche Fahrzeugen aus.',
  run({ body, status }) {
    const saved = loadGameProgress('crossy-road', { best: 0 });
    let best = saved.best || 0;
    let step = 0, laneX = 2;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const board = $('div', null, '');
    board.style.cssText = 'padding:20px;border-radius:16px;background:var(--sz-surface-2);min-width:260px;text-align:center;font-size:20px;font-weight:800';

    const btns = $('div', null, '');
    btns.style.cssText = 'display:flex;gap:8px';
    const leftBtn = $('button', 'sz-btn sz-btn-ghost', '←');
    const fwdBtn = $('button', 'sz-btn sz-btn-primary', '↑ Vor');
    const rightBtn = $('button', 'sz-btn sz-btn-ghost', '→');
    btns.append(leftBtn, fwdBtn, rightBtn);
    wrap.append(board, btns);
    body.append(wrap);

    const render = () => {
      if (step > best) best = step;
      saveGameProgress('crossy-road', { best });
      const carLane = (step * 2 + 1) % 5;
      if (carLane === laneX && step > 0) {
        step = 0;
        board.textContent = `💥 Auto erwischt! Neustart · Rekord: ${best}`;
      } else {
        board.textContent = `🐔 Spur ${step} · Pos ${laneX + 1}/5 · Gefahr auf ${carLane + 1}`;
      }
      status.textContent = `Aktuell: ${step} · Rekord (gespeichert): ${best}`;
    };

    leftBtn.onclick = () => { laneX = Math.max(0, laneX - 1); render(); };
    rightBtn.onclick = () => { laneX = Math.min(4, laneX + 1); render(); };
    fwdBtn.onclick = () => { step++; render(); };

    render();
  }
});

// ==========================================
// 35. GEOMETRY DASH
// ==========================================
registerGame({
  id: 'geometry-dash',
  title: 'Geometry Dash',
  icon: '💠',
  cat: 'Action',
  desc: 'Springe im richtigen Takt über Stacheln und sammle Sterne.',
  run({ body, status }) {
    const saved = loadGameProgress('geometry-dash', { stars: 0 });
    let stars = saved.stars || 0;
    let spikePos = 6;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:440px';
    const track = $('div', null, '');
    track.style.cssText = 'padding:18px;border-radius:14px;background:var(--sz-surface-2);width:100%;text-align:center;font-family:monospace;font-size:20px';
    const jumpBtn = $('button', 'sz-btn sz-btn-primary', '⬆️ Springen');
    wrap.append(track, jumpBtn);
    body.append(wrap);

    const drawTrack = (jumped) => {
      const cells = Array.from({ length: 8 }, (_, i) => {
        if (i === 1) return jumped ? '🟦' : '💠';
        if (i === spikePos) return '🔺';
        return '·';
      });
      track.textContent = cells.join(' ');
    };

    jumpBtn.onclick = () => {
      drawTrack(true);
      stars++;
      spikePos = 3 + R(5);
      saveGameProgress('geometry-dash', { stars });
      status.textContent = `⭐ Sterne (gespeichert): ${stars} · Sauber gesprungen!`;
    };

    drawTrack(false);
    status.textContent = `⭐ Sterne (gespeichert): ${stars} · Springen zum Sammeln`;
  }
});

// ==========================================
// 36. PLANTS VS. ZOMBIES
// ==========================================
registerGame({
  id: 'plants-vs-zombies',
  title: 'Plants vs. Zombies',
  icon: '🌻',
  cat: 'Strategie',
  desc: 'Setze Verteidigungspflanzen auf die Reihe, um anrückende Zombies aufzuhalten.',
  run({ body, status }) {
    const saved = loadGameProgress('plants-vs-zombies', { sun: 75, waves: 0 });
    let sun = saved.sun ?? 75;
    let waves = saved.waves || 0;
    let lane = ['🌱', '·', '·', '·', '🧟'];

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const row = $('div', null, '');
    row.style.cssText = 'display:flex;gap:8px';
    const waveBtn = $('button', 'sz-btn sz-btn-primary', '🧟 Welle starten');
    wrap.append(row, waveBtn);
    body.append(wrap);

    const save = () => saveGameProgress('plants-vs-zombies', { sun, waves });

    const render = () => {
      row.innerHTML = '';
      lane.forEach((cell, idx) => {
        const b = $('button', 'sz-btn sz-btn-ghost', cell);
        b.style.cssText = 'width:50px;height:50px;padding:0;font-size:22px';
        b.onclick = () => {
          if (cell === '·' && sun >= 25) {
            sun -= 25;
            lane[idx] = '🌻';
            save();
            render();
          }
        };
        row.append(b);
      });
      status.textContent = `☀️ Sonne: ${sun} · Abgewehrte Wellen: ${waves}`;
    };

    waveBtn.onclick = () => {
      const plants = lane.filter((x) => x === '🌻' || x === '🌱').length;
      if (plants >= 1) {
        waves++;
        sun += 25;
        save();
        status.textContent = `🌻 Welle abgewehrt! Wellen: ${waves} · Sonne: ${sun}`;
      } else {
        status.textContent = 'Setze erst eine Pflanze (25 Sonne)';
      }
      render();
    };

    render();
  }
});

// ==========================================
// 37. TETRIS
// ==========================================
registerGame({
  id: 'tetris',
  title: 'Tetris',
  icon: '🧱',
  cat: 'Puzzle',
  desc: 'Setze Blöcke in Spalten, fülle Reihen auf und speichere deinen Punktestand.',
  run({ body, status }) {
    const saved = loadGameProgress('tetris', { lines: 0, score: 0 });
    let lines = saved.lines || 0;
    let score = saved.score || 0;
    let cols = [0, 0, 0, 0, 0, 0];

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const grid = $('div', null, '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(6,44px);gap:6px';
    wrap.append(grid);
    body.append(wrap);

    const render = () => {
      grid.innerHTML = '';
      cols.forEach((h, idx) => {
        const btn = $('button', 'sz-btn sz-btn-ghost', `S${idx + 1}\n${h}`);
        btn.style.cssText = 'width:44px;height:56px;padding:0;font-size:13px;white-space:pre-line';
        btn.onclick = () => {
          cols[idx]++;
          if (cols.every((v) => v > 0)) {
            cols = cols.map((v) => Math.max(0, v - 1));
            lines++;
            score += 100;
          } else {
            score += 10;
          }
          saveGameProgress('tetris', { lines, score });
          render();
        };
        grid.append(btn);
      });
      status.textContent = `Punkte: ${score} · Reihen: ${lines}`;
    };

    render();
  }
});

// ==========================================
// 38. PAC-MAN
// ==========================================
registerGame({
  id: 'pac-man',
  title: 'Pac-Man',
  icon: '🟡',
  cat: 'Arcade',
  desc: 'Steuere Pac-Man durch das Raster, sammle Punkte und meide Geister.',
  run({ body, status }) {
    const saved = loadGameProgress('pac-man', { pellets: 0 });
    let pellets = saved.pellets || 0;
    let pos = 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const grid = $('div', null, '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,48px);gap:6px';
    wrap.append(grid);
    body.append(wrap);

    const render = () => {
      grid.innerHTML = '';
      for (let i = 0; i < 15; i++) {
        const isPac = i === pos;
        const isGhost = i === 12;
        const lbl = isPac ? '🟡' : isGhost ? '👻' : '·';
        const btn = $('button', 'sz-btn sz-btn-ghost', lbl);
        btn.style.cssText = 'width:48px;height:48px;padding:0;font-size:20px';
        btn.onclick = () => {
          if (i === 12) {
            pos = 0;
            status.textContent = `👻 Geist erwischt – zurück zum Start · Punkte: ${pellets}`;
            render();
            return;
          }
          pos = i;
          pellets += 10;
          saveGameProgress('pac-man', { pellets });
          render();
        };
        grid.append(btn);
      }
      status.textContent = `🟡 Punkte (gespeichert): ${pellets}`;
    };

    render();
  }
});

// ==========================================
// 39. 2048
// ==========================================
registerGame({
  id: '2048',
  title: '2048',
  icon: '🔢',
  cat: 'Puzzle',
  desc: 'Tippe auf zwei gleiche Zahlenkacheln, um sie zu verschmelzen – leere Felder (·) füllen sich mit 2ern auf.',
  run({ body, status }) {
    const saved = loadGameProgress('2048', { tiles: [2, 2, 4, 4, 2, 8, 2, 4, 2], best: 8 });
    let tiles = Array.isArray(saved.tiles) && saved.tiles.length === 9 ? [...saved.tiles] : [2, 2, 4, 4, 2, 8, 2, 4, 2];
    let best = saved.best || Math.max(...tiles);
    let picked = null;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const grid = $('div', null, '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,68px);gap:8px';
    wrap.append(grid);
    body.append(wrap);

    const render = () => {
      best = Math.max(best, ...tiles);
      saveGameProgress('2048', { tiles, best });
      grid.innerHTML = '';
      tiles.forEach((v, idx) => {
        const isPicked = picked === idx;
        const btn = $('button', 'sz-btn ' + (isPicked ? 'sz-btn-lime' : 'sz-btn-primary'), v > 0 ? String(v) : '·');
        btn.style.cssText = 'width:68px;height:68px;padding:0;font-size:20px;font-weight:900';
        btn.onclick = () => {
          if (v === 0) {
            tiles[idx] = 2;
            picked = null;
            render();
            return;
          }
          if (picked === null) {
            picked = idx;
            render();
          } else if (picked === idx) {
            picked = null;
            render();
          } else if (tiles[picked] === v) {
            tiles[idx] = v * 2;
            tiles[picked] = 0;
            picked = null;
            render();
          } else {
            picked = idx;
            render();
          }
        };
        grid.append(btn);
      });
      status.textContent = `Höchste Kachel (gespeichert): ${best} · ${picked !== null ? 'Passende Zahl antippen' : 'Zahl wählen'}`;
    };

    render();
  }
});

// ==========================================
// 40. MINESWEEPER
// ==========================================
registerGame({
  id: 'minesweeper',
  title: 'Minesweeper',
  icon: '💣',
  cat: 'Puzzle',
  desc: 'Decke sichere Felder auf, ohne die Mine (Feld 5) zu treffen.',
  run({ body, status }) {
    const MINE = 4;
    const saved = loadGameProgress('minesweeper', { revealed: [], won: false });
    let revealed = Array.isArray(saved.revealed) ? [...saved.revealed] : [];
    let won = !!saved.won;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(3,64px);gap:8px';
    body.append(wrap);

    const render = () => {
      saveGameProgress('minesweeper', { revealed, won });
      wrap.innerHTML = '';
      for (let i = 0; i < 9; i++) {
        const open = revealed.includes(i);
        const lbl = open ? (i === MINE ? '💣' : '✔') : '?';
        const btn = $('button', 'sz-btn ' + (open ? 'sz-btn-ghost' : 'sz-btn-primary'), lbl);
        btn.style.cssText = 'width:64px;height:64px;padding:0;font-size:22px';
        btn.onclick = () => {
          if (i === MINE) {
            revealed = [];
            won = false;
            status.textContent = '💥 Mine getroffen – Feld zurückgesetzt';
            render();
            return;
          }
          if (!revealed.includes(i)) revealed.push(i);
          if (revealed.length >= 8) won = true;
          render();
        };
        wrap.append(btn);
      }
      if (!status.textContent.includes('Mine getroffen')) {
        status.textContent = won ? '🏆 Alle sicheren Felder aufgedeckt!' : `Aufgedeckt: ${revealed.length}/8 sichere Felder`;
      }
    };

    render();
  }
});

// ==========================================
// 41. SNAKE
// ==========================================
registerGame({
  id: 'snake',
  title: 'Snake',
  icon: '🐍',
  cat: 'Arcade',
  desc: 'Sammle Futterpunkte, verlängere die Schlange und speichere deinen Rekord.',
  run({ body, status }) {
    const saved = loadGameProgress('snake', { score: 0, best: 0 });
    let score = saved.score || 0;
    let best = saved.best || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px';
    const eatBtn = $('button', 'sz-btn sz-btn-primary', '🍎 Futter fressen (+10)');
    const resetScoreBtn = $('button', 'sz-btn sz-btn-ghost', 'Runde nullen');
    wrap.append(eatBtn, resetScoreBtn);
    body.append(wrap);

    const sync = () => {
      if (score > best) best = score;
      saveGameProgress('snake', { score, best });
      status.textContent = `🐍 Punkte: ${score} · Rekord: ${best}`;
    };

    eatBtn.onclick = () => { score += 10; sync(); };
    resetScoreBtn.onclick = () => { score = 0; sync(); };

    sync();
  }
});

// ==========================================
// 42. FLAPPY BIRD
// ==========================================
registerGame({
  id: 'flappy-bird',
  title: 'Flappy Bird',
  icon: '🐤',
  cat: 'Arcade',
  desc: 'Tippe zum Flattern, passiere Rohre und behalte deinen Highscore.',
  run({ body, status }) {
    const saved = loadGameProgress('flappy-bird', { score: 0, best: 0 });
    let score = saved.score || 0;
    let best = saved.best || 0;

    const flapBtn = $('button', 'sz-btn sz-btn-primary', '🐤 Flattern & Rohr passieren');
    body.append(flapBtn);

    const sync = () => {
      if (score > best) best = score;
      saveGameProgress('flappy-bird', { score, best });
      status.textContent = `Punkte: ${score} · Rekord: ${best}`;
    };

    flapBtn.onclick = () => { score++; sync(); };
    sync();
  }
});

// ==========================================
// 43. PONG
// ==========================================
registerGame({
  id: 'pong',
  title: 'Pong',
  icon: '🏓',
  cat: 'Sport & Action',
  desc: 'Schlage den Ball mit dem Schläger zurück und sammle Ballwechsel-Punkte.',
  run({ body, status }) {
    const saved = loadGameProgress('pong', { rallies: 0, best: 0 });
    let rallies = saved.rallies || 0;
    let best = saved.best || 0;

    const hitBtn = $('button', 'sz-btn sz-btn-primary', '🏓 Ball zurückschlagen');
    body.append(hitBtn);

    const sync = () => {
      if (rallies > best) best = rallies;
      saveGameProgress('pong', { rallies, best });
      status.textContent = `Ballwechsel: ${rallies} · Rekord: ${best}`;
    };

    hitBtn.onclick = () => { rallies++; sync(); };
    sync();
  }
});

// ==========================================
// 44. BREAKOUT
// ==========================================
registerGame({
  id: 'breakout',
  title: 'Breakout',
  icon: '🧱',
  cat: 'Arcade',
  desc: 'Räume die Steine mit dem Ball ab – dein Fortschritt bleibt erhalten.',
  run({ body, status }) {
    const saved = loadGameProgress('breakout', { bricks: [1, 1, 1, 1, 1, 1], score: 0 });
    let bricks = Array.isArray(saved.bricks) && saved.bricks.length === 6 ? [...saved.bricks] : [1, 1, 1, 1, 1, 1];
    let score = saved.score || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(3,72px);gap:8px';
    body.append(wrap);

    const render = () => {
      if (bricks.every((b) => b === 0)) bricks = [1, 1, 1, 1, 1, 1];
      saveGameProgress('breakout', { bricks, score });
      wrap.innerHTML = '';
      bricks.forEach((alive, idx) => {
        const btn = $('button', 'sz-btn ' + (alive ? 'sz-btn-primary' : 'sz-btn-ghost'), alive ? '🧱' : '·');
        btn.style.cssText = 'width:72px;height:44px;padding:0;font-size:20px';
        btn.onclick = () => {
          if (bricks[idx]) { bricks[idx] = 0; score += 20; render(); }
        };
        wrap.append(btn);
      });
      status.textContent = `Punkte (gespeichert): ${score}`;
    };

    render();
  }
});

// ==========================================
// 45. SIMON SAYS
// ==========================================
registerGame({
  id: 'simon-says',
  title: 'Simon Says',
  icon: '🎛️',
  cat: 'Puzzle',
  desc: 'Merke dir die angezeigte Farbfolge und tippe sie in derselben Reihenfolge nach.',
  run({ body, status }) {
    const COLORS = ['🔴', '🟢', '🔵', '🟡'];
    const saved = loadGameProgress('simon-says', { level: 1 });
    let level = saved.level || 1;
    const buildSeq = (lvl) => Array.from({ length: lvl }, (_, i) => (lvl === 1 ? 0 : (R(COLORS.length) + i) % COLORS.length));
    let seq = buildSeq(level);
    let stepIdx = 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const seqBox = $('div', null, '');
    seqBox.style.cssText = 'padding:10px 16px;border-radius:12px;background:var(--sz-surface-2);font-size:22px;letter-spacing:6px';
    const grid = $('div', null, '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,72px);gap:10px';
    wrap.append(seqBox, grid);
    body.append(wrap);

    const render = () => {
      saveGameProgress('simon-says', { level });
      seqBox.textContent = seq.map((i) => COLORS[i]).join(' ');
      grid.innerHTML = '';

      COLORS.forEach((emo, idx) => {
        const btn = $('button', 'sz-btn sz-btn-ghost', emo);
        btn.style.cssText = 'width:72px;height:72px;padding:0;font-size:28px';
        btn.onclick = () => {
          if (idx === seq[stepIdx]) {
            stepIdx++;
            if (stepIdx >= seq.length) {
              level++;
              seq = buildSeq(level);
              stepIdx = 0;
              status.textContent = `✔ Folge geschafft! Neues Level: ${level}`;
              render();
            } else {
              status.textContent = `✔ Schritt ${stepIdx}/${seq.length} richtig`;
            }
          } else {
            stepIdx = 0;
            seq = buildSeq(level);
            status.textContent = `✖ Falsche Farbe – neue Folge für Level ${level}`;
            render();
          }
        };
        grid.append(btn);
      });

      status.textContent = `Level ${level} · Folge (${seq.length} Farben) nachtippen`;
    };

    render();
  }
});

// ==========================================
// 46. WHACK-A-MOLE
// ==========================================
registerGame({
  id: 'whack-a-mole',
  title: 'Whack-a-Mole',
  icon: '🐹',
  cat: 'Action',
  desc: 'Treffe den Maulwurf (🐹) und speichere deine Trefferzahl.',
  run({ body, status }) {
    const saved = loadGameProgress('whack-a-mole', { hits: 0, mole: 0 });
    let hits = saved.hits || 0;
    let mole = saved.mole ?? 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(3,64px);gap:8px';
    body.append(wrap);

    const render = () => {
      saveGameProgress('whack-a-mole', { hits, mole });
      wrap.innerHTML = '';
      for (let i = 0; i < 6; i++) {
        const btn = $('button', 'sz-btn ' + (i === mole ? 'sz-btn-primary' : 'sz-btn-ghost'), i === mole ? '🐹' : '🕳️');
        btn.style.cssText = 'width:64px;height:64px;padding:0;font-size:24px';
        btn.onclick = () => {
          if (i === mole) { hits++; mole = (mole + 2) % 6; render(); }
        };
        wrap.append(btn);
      }
      status.textContent = `🐹 Treffer (gespeichert): ${hits}`;
    };

    render();
  }
});

// ==========================================
// 47. MEMORY
// ==========================================
registerGame({
  id: 'memory',
  title: 'Memory',
  icon: '🃏',
  cat: 'Puzzle',
  desc: 'Decke gleiche Paare auf – aufgedeckte Paare bleiben gespeichert.',
  run({ body, status }) {
    const CARDS = ['🦊', '🦊', '🦉', '🦉', '🐼', '🐼'];
    const saved = loadGameProgress('memory', { matched: [] });
    let matched = Array.isArray(saved.matched) ? [...saved.matched] : [];
    let first = null;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(3,68px);gap:8px';
    body.append(wrap);

    const render = () => {
      saveGameProgress('memory', { matched });
      wrap.innerHTML = '';
      CARDS.forEach((sym, idx) => {
        const open = matched.includes(idx) || first === idx;
        const btn = $('button', 'sz-btn ' + (open ? 'sz-btn-primary' : 'sz-btn-ghost'), open ? sym : '❓');
        btn.style.cssText = 'width:68px;height:68px;padding:0;font-size:26px';
        btn.onclick = () => {
          if (matched.includes(idx) || first === idx) return;
          if (first === null) {
            first = idx;
          } else {
            if (CARDS[first] === sym) matched.push(first, idx);
            first = null;
          }
          render();
        };
        wrap.append(btn);
      });
      status.textContent = matched.length === CARDS.length ? '🎉 Alle Paare gefunden!' : `Paare gefunden: ${matched.length / 2}/${CARDS.length / 2}`;
    };

    render();
  }
});

// ==========================================
// 48. TIC-TAC-TOE
// ==========================================
registerGame({
  id: 'tic-tac-toe',
  title: 'Tic-Tac-Toe',
  icon: '❌',
  cat: 'Brettspiele',
  desc: 'Setze ❌ oder ⭕ – dein aktuelles Brett bleibt gespeichert.',
  run({ body, status }) {
    const saved = loadGameProgress('tic-tac-toe', { board: Array(9).fill(''), turn: '❌' });
    let board = Array.isArray(saved.board) && saved.board.length === 9 ? [...saved.board] : Array(9).fill('');
    let turn = saved.turn === '⭕' ? '⭕' : '❌';

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const grid = $('div', null, '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,68px);gap:8px';
    const clrBtn = $('button', 'sz-btn sz-btn-ghost', 'Neues Feld');
    wrap.append(grid, clrBtn);
    body.append(wrap);

    const render = () => {
      saveGameProgress('tic-tac-toe', { board, turn });
      grid.innerHTML = '';
      board.forEach((val, idx) => {
        const btn = $('button', 'sz-btn sz-btn-primary', val || '·');
        btn.style.cssText = 'width:68px;height:68px;padding:0;font-size:24px';
        btn.onclick = () => {
          if (!board[idx]) { board[idx] = turn; turn = turn === '❌' ? '⭕' : '❌'; render(); }
        };
        grid.append(btn);
      });
      status.textContent = `Am Zug: ${turn}`;
    };

    clrBtn.onclick = () => { board = Array(9).fill(''); turn = '❌'; render(); };
    render();
  }
});

// ==========================================
// 49. CONNECT FOUR
// ==========================================
registerGame({
  id: 'connect-four',
  title: 'Connect Four',
  icon: '🔴',
  cat: 'Brettspiele',
  desc: 'Wirf farbige Steine in 4 Spalten ein – der Stand bleibt gespeichert.',
  run({ body, status }) {
    const saved = loadGameProgress('connect-four', { cols: [[], [], [], []], redTurn: true });
    let cols = Array.isArray(saved.cols) && saved.cols.length === 4 ? saved.cols.map((c) => [...c]) : [[], [], [], []];
    let redTurn = !!saved.redTurn;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    body.append(wrap);

    const render = () => {
      saveGameProgress('connect-four', { cols, redTurn });
      wrap.innerHTML = '';
      cols.forEach((col, cIdx) => {
        const btn = $('button', 'sz-btn sz-btn-ghost', `Spalte ${cIdx + 1}\n${col.join(' ') || 'leer'}`);
        btn.style.cssText = 'min-width:86px;min-height:92px;white-space:pre-line;font-size:15px';
        btn.onclick = () => {
          if (col.length < 4) { col.push(redTurn ? '🔴' : '🟡'); redTurn = !redTurn; render(); }
        };
        wrap.append(btn);
      });
      status.textContent = `Nächster Stein: ${redTurn ? '🔴 Rot' : '🟡 Gelb'}`;
    };

    render();
  }
});

// ==========================================
// 50. BUNTE FORMEN EINSETZEN
// ==========================================
registerGame({
  id: 'bunte-formen-einsetzen',
  title: 'Bunte Formen einsetzen',
  icon: '🔷',
  cat: 'Puzzle',
  desc: 'Wähle eine Form aus der Ablage und setze sie in das passende Feld ein.',
  run({ body, status }) {
    const SHAPES = ['🔺', '🔷', '🟣'];
    const saved = loadGameProgress('bunte-formen-einsetzen', { slots: ['', '', '', '', '', ''] });
    let slots = Array.isArray(saved.slots) && saved.slots.length === 6 ? [...saved.slots] : ['', '', '', '', '', ''];
    let picked = 0;

    const wrap = $('div', 'sz-sh-wrap');
    const board = $('div', 'sz-sh-board');
    const tray = $('div', 'sz-sh-tray');
    wrap.append(board, tray);
    body.append(wrap);

    const render = () => {
      saveGameProgress('bunte-formen-einsetzen', { slots });
      board.innerHTML = '';
      slots.forEach((val, idx) => {
        const cell = $('button', 'sz-sh-slot', val || '⬜');
        cell.onclick = () => { slots[idx] = val === SHAPES[picked] ? '' : SHAPES[picked]; render(); };
        board.append(cell);
      });

      tray.innerHTML = '';
      SHAPES.forEach((sh, idx) => {
        const pBtn = $('button', 'sz-sh-piece' + (picked === idx ? ' sel' : ''), sh);
        pBtn.onclick = () => { picked = idx; render(); };
        tray.append(pBtn);
      });

      const placed = slots.filter(Boolean).length;
      status.textContent = `Eingesetzte Formen (gespeichert): ${placed}/6 · Aktiv: ${SHAPES[picked]}`;
    };

    render();
  }
});

// ==========================================
// 51. SCHACH
// ==========================================
registerGame({
  id: 'schach',
  title: 'Schach',
  icon: '♟️',
  cat: 'Brettspiele',
  desc: 'Wähle eine Figur und setze sie auf ein Zielfeld – dein Brettstand bleibt gespeichert.',
  run({ body, status }) {
    const INIT = [
      ['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'],
      ['♟', '♟', '♟', '♟', '♟', '♟', '♟', '♟'],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', ''],
      ['♙', '♙', '♙', '♙', '♙', '♙', '♙', '♙'],
      ['♖', '♘', '♗', '♕', '♔', '♗', '♘', '♖']
    ];
    const saved = loadGameProgress('schach', { board: INIT });
    let board = Array.isArray(saved.board) && saved.board.length === 8 ? saved.board.map((r) => [...r]) : INIT.map((r) => [...r]);
    let sel = null, moves = 0;

    const wrap = $('div', 'sz-ck-grid');
    body.append(wrap);

    const render = () => {
      saveGameProgress('schach', { board });
      wrap.innerHTML = '';
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const isDark = (r + c) % 2 === 1;
        const isSel = sel && sel[0] === r && sel[1] === c;
        const piece = board[r][c];
        const cell = $('button', 'sz-ck-cell ' + (isDark ? 'dark' : 'light') + (isSel ? ' sel' : ''), piece);
        cell.onclick = () => {
          if (!sel) {
            if (piece) { sel = [r, c]; status.textContent = `Figur ${piece} gewählt – Zielfeld antippen`; render(); }
          } else {
            const [sr, sc] = sel;
            if (sr === r && sc === c) { sel = null; status.textContent = 'Auswahl aufgehoben'; render(); return; }
            board[r][c] = board[sr][sc];
            board[sr][sc] = '';
            sel = null;
            moves++;
            status.textContent = `Züge: ${moves} · Stand gespeichert`;
            render();
          }
        };
        wrap.append(cell);
      }
    };

    status.textContent = 'Figur wählen und auf ein Feld ziehen (Stand gespeichert)';
    render();
  }
});

// ==========================================
// 52. MÜHLE
// ==========================================
registerGame({
  id: 'muehle',
  title: 'Mühle',
  icon: '⭕',
  cat: 'Brettspiele',
  desc: 'Setze Steine auf das 3×3-Mühlenfeld – jede 3er-Reihe bringt einen Punkt und wird gespeichert.',
  run({ body, status }) {
    const saved = loadGameProgress('muehle', { cells: Array(9).fill(''), turn: '🔵', score: 0 });
    let cells = Array.isArray(saved.cells) && saved.cells.length === 9 ? [...saved.cells] : Array(9).fill('');
    let turn = saved.turn === '🟠' ? '🟠' : '🔵';
    let score = saved.score || 0;
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px';
    const grid = $('div', null, '');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,68px);gap:8px';
    const clrBtn = $('button', 'sz-btn sz-btn-ghost', 'Feld leeren');
    wrap.append(grid, clrBtn);
    body.append(wrap);

    const render = () => {
      saveGameProgress('muehle', { cells, turn, score });
      grid.innerHTML = '';
      cells.forEach((v, idx) => {
        const btn = $('button', 'sz-btn sz-btn-primary', v || '·');
        btn.style.cssText = 'width:68px;height:68px;padding:0;font-size:24px';
        btn.onclick = () => {
          if (cells[idx]) return;
          cells[idx] = turn;
          const formed = LINES.some(([a, b, c]) => cells[a] === turn && cells[b] === turn && cells[c] === turn);
          if (formed) score++;
          turn = turn === '🔵' ? '🟠' : '🔵';
          render();
          if (formed) status.textContent = `🏆 Mühle gebildet! Punkte: ${score} · Am Zug: ${turn}`;
        };
        grid.append(btn);
      });
      if (!status.textContent.includes('Mühle gebildet!')) status.textContent = `Punkte: ${score} · Am Zug: ${turn}`;
    };

    clrBtn.onclick = () => { cells = Array(9).fill(''); turn = '🔵'; render(); };
    render();
  }
});

// ==========================================
// 53. UNO
// ==========================================
registerGame({
  id: 'uno',
  title: 'Uno',
  icon: '🎴',
  cat: 'Karten & Strategie',
  desc: 'Lege eine Karte mit passender Farbe oder Zahl auf den Ablagestapel oder ziehe nach.',
  run({ body, status }) {
    const COLORS = ['🔴', '🔵', '🟢', '🟡'];
    const randCard = () => ({ c: COLORS[R(COLORS.length)], n: 1 + R(9) });
    const saved = loadGameProgress('uno', { top: randCard(), hand: Array.from({ length: 5 }, randCard), wins: 0 });
    let top = saved.top || randCard();
    let hand = Array.isArray(saved.hand) && saved.hand.length ? saved.hand : Array.from({ length: 5 }, randCard);
    let wins = saved.wins || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:620px';
    const topEl = $('div', null, '');
    topEl.style.cssText = 'padding:12px 18px;border-radius:14px;background:var(--sz-surface-2);font-size:22px;font-weight:900';
    const handEl = $('div', 'sz-pk-hand');
    const drawBtn = $('button', 'sz-btn sz-btn-ghost', '🃏 Karte ziehen');
    wrap.append(topEl, handEl, drawBtn);
    body.append(wrap);

    const save = () => saveGameProgress('uno', { top, hand, wins });

    const render = () => {
      save();
      topEl.textContent = `Ablage: ${top.c} ${top.n}`;
      handEl.innerHTML = '';
      hand.forEach((card, idx) => {
        const btn = $('button', 'sz-pk-card', `<span>${card.c}</span><span style="font-size:20px">${card.n}</span>`);
        btn.onclick = () => {
          if (card.c === top.c || card.n === top.n) {
            top = card;
            hand.splice(idx, 1);
            if (!hand.length) { wins++; hand = Array.from({ length: 5 }, randCard); status.textContent = `🎉 Runde gewonnen! Siege: ${wins}`; }
            else status.textContent = `✔ Karte abgelegt (${card.c} ${card.n}) · Hand: ${hand.length}`;
            render();
          } else {
            status.textContent = `Passt nicht auf ${top.c} ${top.n} – gleiche Farbe oder Zahl wählen`;
          }
        };
        handEl.append(btn);
      });
    };

    drawBtn.onclick = () => { hand.push(randCard()); render(); status.textContent = `Karte gezogen · Hand: ${hand.length} · Siege: ${wins}`; };
    render();
  }
});

// ==========================================
// 54. STADT, LAND, FLUSS
// ==========================================
registerGame({
  id: 'stadt-land-fluss',
  title: 'Stadt, Land, Fluss',
  icon: '🗺️',
  cat: 'Partyspiele',
  desc: 'Ziehe einen Anfangsbuchstaben, trage Begriffe für Stadt, Land und Fluss ein und sichere Punkte.',
  run({ body, status }) {
    const LETTERS = 'ABCDEFGHKLMNOPRSTW';
    const saved = loadGameProgress('stadt-land-fluss', { letter: 'B', city: '', country: '', river: '', score: 0 });
    let letter = saved.letter || 'B';
    let city = saved.city || '', country = saved.country || '', river = saved.river || '', score = saved.score || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;max-width:460px';
    const head = $('div', null, `Buchstabe: <strong>${letter}</strong>`);
    head.style.cssText = 'font-size:20px;text-align:center';

    const makeInput = (ph, val, onChg) => {
      const inp = $('input', 'sz-search', '');
      inp.placeholder = ph; inp.value = val; inp.style.width = '100%';
      inp.oninput = () => { onChg(inp.value); saveGameProgress('stadt-land-fluss', { letter, city, country, river, score }); };
      return inp;
    };

    const iCity = makeInput('Stadt…', city, (v) => { city = v; });
    const iCountry = makeInput('Land…', country, (v) => { country = v; });
    const iRiver = makeInput('Fluss…', river, (v) => { river = v; });

    const row = $('div', null, '');
    row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
    const scoreBtn = $('button', 'sz-btn sz-btn-primary', 'Runde werten (+10)');
    const newLetterBtn = $('button', 'sz-btn sz-btn-ghost', '🎲 Neuer Buchstabe');
    row.append(scoreBtn, newLetterBtn);
    wrap.append(head, iCity, iCountry, iRiver, row);
    body.append(wrap);

    const syncStatus = () => { saveGameProgress('stadt-land-fluss', { letter, city, country, river, score }); status.textContent = `Punkte: ${score} · Buchstabe: ${letter}`; };

    scoreBtn.onclick = () => {
      const filled = [city, country, river].filter((x) => x.trim().length > 0).length;
      score += filled * 10;
      syncStatus();
    };

    newLetterBtn.onclick = () => {
      letter = LETTERS[R(LETTERS.length)];
      city = ''; country = ''; river = '';
      iCity.value = ''; iCountry.value = ''; iRiver.value = '';
      head.innerHTML = `Buchstabe: <strong>${letter}</strong>`;
      syncStatus();
    };

    syncStatus();
  }
});

// ==========================================
// 55. TABU
// ==========================================
registerGame({
  id: 'tabu',
  title: 'Tabu',
  icon: '🚫',
  cat: 'Partyspiele',
  desc: 'Erkläre oder errate den Zielbegriff, ohne die Tabuwörter zu nutzen.',
  run({ body, status }) {
    const DECK = [
      { word: 'REGENBOGEN', tabu: ['Farben', 'Himmel', 'Regen', 'Sonne'] },
      { word: 'PIZZA', tabu: ['Italien', 'Käse', 'Ofen', 'Teig'] },
      { word: 'RAKETE', tabu: ['Weltall', 'Mond', 'Fliegen', 'Start'] },
      { word: 'SCHLÜSSEL', tabu: ['Tür', 'Schloss', 'Aufschließen', 'Metall'] }
    ];
    const saved = loadGameProgress('tabu', { idx: 0, pts: 0 });
    let idx = saved.idx || 0, pts = saved.pts || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:440px;text-align:center';
    const card = $('div', null, '');
    card.style.cssText = 'padding:18px;border-radius:16px;background:var(--sz-surface-2);width:100%';
    const btns = $('div', null, '');
    btns.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    const hitBtn = $('button', 'sz-btn sz-btn-lime', '✔ Erraten (+1)');
    const tabuBtn = $('button', 'sz-btn sz-btn-ghost', '🚫 Tabu-Wort');
    btns.append(hitBtn, tabuBtn);
    wrap.append(card, btns);
    body.append(wrap);

    const render = () => {
      saveGameProgress('tabu', { idx, pts });
      const item = DECK[idx % DECK.length];
      card.innerHTML = `<div style="font-size:24px;font-weight:900;margin-bottom:8px">${item.word}</div><div style="color:var(--sz-muted)">Tabu: ${item.tabu.join(' · ')}</div>`;
      status.textContent = `Punkte: ${pts} · Karte ${(idx % DECK.length) + 1}/${DECK.length}`;
    };

    hitBtn.onclick = () => { pts++; idx++; render(); };
    tabuBtn.onclick = () => { idx++; render(); };
    render();
  }
});

// ==========================================
// 56. SCHARADE
// ==========================================
registerGame({
  id: 'scharade',
  title: 'Scharade',
  icon: '🎭',
  cat: 'Partyspiele',
  desc: 'Ziehe Begriffe zum Darstellen ohne Worte und speichere deine gelösten Runden.',
  run({ body, status }) {
    const PROMPTS = ['Eis essen', 'Tauchen', 'Gitarre spielen', 'Zug verpassen', 'Berg besteigen'];
    const saved = loadGameProgress('scharade', { idx: 0, solved: 0 });
    let idx = saved.idx || 0, solved = saved.solved || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center';
    const box = $('div', null, '');
    box.style.cssText = 'padding:20px 26px;border-radius:16px;background:var(--sz-surface-2);font-size:22px;font-weight:900';
    const doneBtn = $('button', 'sz-btn sz-btn-primary', '✔ Gelöst & Nächster');
    wrap.append(box, doneBtn);
    body.append(wrap);

    const render = () => {
      saveGameProgress('scharade', { idx, solved });
      box.textContent = PROMPTS[idx % PROMPTS.length];
      status.textContent = `Gelöst: ${solved} · Begriff ${(idx % PROMPTS.length) + 1}`;
    };

    doneBtn.onclick = () => { solved++; idx++; render(); };
    render();
  }
});

// ==========================================
// 57. WERWOLF
// ==========================================
registerGame({
  id: 'werwolf',
  title: 'Werwolf',
  icon: '🐺',
  cat: 'Partyspiele',
  desc: 'Führe durch Tag- und Nachtrunden und speichere den aktuellen Rundenstand.',
  run({ body, status }) {
    const ROLES = ['🐺 Werwolf', '🛡️ Seherin/Schutz', '🧑‍🌾 Dorfbewohner', '🔮 Hexe'];
    const saved = loadGameProgress('werwolf', { day: 1, roleIdx: 0 });
    let day = saved.day || 1, roleIdx = saved.roleIdx || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center';
    const info = $('div', null, '');
    info.style.cssText = 'padding:18px;border-radius:16px;background:var(--sz-surface-2);font-size:20px;font-weight:800';
    const btns = $('div', null, '');
    btns.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    const roleBtn = $('button', 'sz-btn sz-btn-ghost', '🎭 Rolle wechseln');
    const nextDayBtn = $('button', 'sz-btn sz-btn-primary', '🌙/☀️ Nächste Runde');
    btns.append(roleBtn, nextDayBtn);
    wrap.append(info, btns);
    body.append(wrap);

    const render = () => {
      saveGameProgress('werwolf', { day, roleIdx });
      info.textContent = `Tag ${day} · Deine Rolle: ${ROLES[roleIdx % ROLES.length]}`;
      status.textContent = `Runde ${day} gespeichert`;
    };

    roleBtn.onclick = () => { roleIdx++; render(); };
    nextDayBtn.onclick = () => { day++; render(); };
    render();
  }
});

// ==========================================
// 58. QUARTETT
// ==========================================
registerGame({
  id: 'quartett',
  title: 'Quartett',
  icon: '🏎️',
  cat: 'Karten & Strategie',
  desc: 'Vergleiche deinen Wert (PS) gegen den Gegner und sammle gewonnene Stiche.',
  run({ body, status }) {
    const CARS = [
      { name: 'Volt GT', ps: 420 },
      { name: 'Nebula EV', ps: 510 },
      { name: 'Pulse RS', ps: 360 },
      { name: 'Hyperion', ps: 640 }
    ];
    const saved = loadGameProgress('quartett', { idx: 0, wins: 0 });
    let idx = saved.idx || 0, wins = saved.wins || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center';
    const card = $('div', null, '');
    card.style.cssText = 'padding:18px;border-radius:16px;background:var(--sz-surface-2);min-width:240px;font-size:19px;font-weight:800';
    const playBtn = $('button', 'sz-btn sz-btn-primary', '⚡ Mit PS antreten');
    wrap.append(card, playBtn);
    body.append(wrap);

    const render = () => {
      saveGameProgress('quartett', { idx, wins });
      const mine = CARS[idx % CARS.length];
      card.innerHTML = `<div>${mine.name}</div><div style="color:#a3e635;margin-top:6px">${mine.ps} PS</div>`;
      status.textContent = `Gewonnene Stiche: ${wins}`;
    };

    playBtn.onclick = () => {
      const mine = CARS[idx % CARS.length];
      const foe = CARS[(idx + 1) % CARS.length];
      if (mine.ps >= foe.ps) {
        wins++;
        status.textContent = `🏆 ${mine.name} (${mine.ps} PS) schlägt ${foe.name} (${foe.ps} PS) · Stiche: ${wins}`;
      } else {
        status.textContent = `✖ ${foe.name} (${foe.ps} PS) hat mehr PS als ${mine.name} (${mine.ps} PS) · Stiche: ${wins}`;
      }
      idx++;
      render();
    };

    render();
  }
});

// ==========================================
// 59. SCHIFFE VERSENKEN
// ==========================================
registerGame({
  id: 'schiffe-versenken',
  title: 'Schiffe versenken',
  icon: '🚢',
  cat: 'Strategie',
  desc: 'Beschieße das 4×4-Feld – Treffer (💥) und Wasser (🌊) bleiben gespeichert.',
  run({ body, status }) {
    const SHIPS = [1, 2, 5, 10];
    const saved = loadGameProgress('schiffe-versenken', { shots: [] });
    let shots = Array.isArray(saved.shots) ? [...saved.shots] : [];

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(4,58px);gap:8px';
    body.append(wrap);

    const render = () => {
      saveGameProgress('schiffe-versenken', { shots });
      wrap.innerHTML = '';
      for (let i = 0; i < 16; i++) {
        const hitShot = shots.includes(i);
        const isShip = SHIPS.includes(i);
        const lbl = hitShot ? (isShip ? '💥' : '🌊') : '·';
        const btn = $('button', 'sz-btn ' + (hitShot ? 'sz-btn-ghost' : 'sz-btn-primary'), lbl);
        btn.style.cssText = 'width:58px;height:58px;padding:0;font-size:20px';
        btn.onclick = () => {
          if (!shots.includes(i)) { shots.push(i); render(); }
        };
        wrap.append(btn);
      }
      const hits = shots.filter((s) => SHIPS.includes(s)).length;
      status.textContent = `Treffer: ${hits}/${SHIPS.length} · Schüsse: ${shots.length}`;
    };

    render();
  }
});

// ==========================================
// 60. ZAHLENRATEN
// ==========================================
registerGame({
  id: 'zahlenraten',
  title: 'Zahlenraten',
  icon: '🎯',
  cat: 'Puzzle',
  desc: 'Rate die Geheimzahl zwischen 1 und 10 – Siege und Versuche bleiben gespeichert.',
  run({ body, status }) {
    const SECRET = 7;
    const saved = loadGameProgress('zahlenraten', { wins: 0, tries: 0 });
    let wins = saved.wins || 0, tries = saved.tries || 0;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;max-width:340px;justify-content:center';
    body.append(wrap);

    const sync = (msg) => {
      saveGameProgress('zahlenraten', { wins, tries });
      status.textContent = `${msg} · Siege: ${wins} · Versuche: ${tries}`;
    };

    for (let n = 1; n <= 10; n++) {
      const btn = $('button', 'sz-btn sz-btn-primary', String(n));
      btn.style.cssText = 'width:56px;height:48px;padding:0;font-weight:900';
      btn.onclick = () => {
        tries++;
        if (n === SECRET) { wins++; sync(`🎯 Treffer (${n})!`); }
        else if (n < SECRET) sync(`⬆ Zu niedrig (${n})`);
        else sync(`⬇ Zu hoch (${n})`);
      };
      wrap.append(btn);
    }

    sync('Wähle eine Zahl von 1 bis 10');
  }
});

// ==========================================
// 61. DRIFT BOSS
// ==========================================
registerGame({
  id: 'drift-boss',
  title: 'Drift Boss',
  icon: '🛞',
  cat: 'Action',
  desc: 'Halte gedrückt (Maus, Finger oder Leertaste), um nach rechts zu driften, und lass los für links – bleib auf der Bahn und speichere deinen Rekord.',
  run({ body, status }) {
    const { trackRaf, on, bindKeys } = makeArcadeCanvasRuntime();
    const saved = loadGameProgress('drift-boss', { best: 0 });
    let best = saved.best || 0;

    const W = 400, H = 360;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let x = W / 2, y = H - 70, score = 0, over = false, driftRight = false, tick = 0;

    const reset = () => {
      x = W / 2; y = H - 70; score = 0; over = false; driftRight = false; tick = 0;
      status.textContent = `Punkte: 0 · Rekord: ${best} · Gedrückt halten = Rechts`;
    };

    const down = () => { if (over) reset(); else driftRight = true; };
    const up = () => { driftRight = false; };

    cv.onpointerdown = down;
    on(window, 'pointerup', up);
    bindKeys([' ', 'ArrowRight', 'd'], (e, firstPress) => {
      if (e.type === 'keydown' && firstPress) down();
      if (e.type === 'keyup') up();
    });

    const loop = () => {
      if (!over) {
        tick++;
        const centerX = W / 2 + Math.sin(tick * 0.04) * 95;
        const halfRoad = 68;
        x += driftRight ? 3.2 : -3.2;

        if (tick % 25 === 0) {
          score++;
          if (score > best) best = score;
          saveGameProgress('drift-boss', { best });
          status.textContent = `Punkte: ${score} · Rekord: ${best}`;
        }

        if (Math.abs(x - centerX) > halfRoad) {
          over = true;
          status.textContent = `💥 Abgedriftet! Punkte: ${score} · Rekord: ${best} · Tippen für Neustart`;
        }

        ctx.fillStyle = '#0c0918';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#2b2154';
        ctx.fillRect(centerX - halfRoad, 0, halfRoad * 2, H);

        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      }
      trackRaf(requestAnimationFrame(loop));
    };

    reset();
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 62. SMASH KARTS
// ==========================================
registerGame({
  id: 'smash-karts',
  title: 'Smash Karts',
  icon: '🏎️',
  cat: 'Action',
  desc: 'Steuere dein Kart in der Arena und feuere Schüsse auf Ziel-Karts, um Punkte zu sammeln.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const saved = loadGameProgress('smash-karts', { ko: 0 });
    let ko = saved.ko || 0;

    const W = 480, H = 320;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let kx = 110, ky = H / 2, tx = W - 100, ty = H / 2, bolts = [];
    const shoot = () => bolts.push({ x: kx + 18, y: ky, vx: 7.5 });

    cv.onpointerdown = (e) => {
      const rect = cv.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      const py = ((e.clientY - rect.top) / rect.height) * H;
      if (px > kx + 50) shoot();
      else { kx = Math.max(24, Math.min(W - 24, px)); ky = Math.max(24, Math.min(H - 24, py)); }
    };
    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', 'ArrowUp', 'w', 'ArrowDown', 's', ' '], (e, firstPress) => {
      if (e.key === ' ' && e.type === 'keydown' && firstPress) shoot();
    });

    const loop = () => {
      if (keys.ArrowLeft || keys.a) kx = Math.max(24, kx - 4.5);
      if (keys.ArrowRight || keys.d) kx = Math.min(W - 24, kx + 4.5);
      if (keys.ArrowUp || keys.w) ky = Math.max(24, ky - 4.5);
      if (keys.ArrowDown || keys.s) ky = Math.min(H - 24, ky + 4.5);

      ty = H / 2 + Math.cos(performance.now() * 0.0024) * 95;

      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        b.x += b.vx;
        if (Math.hypot(b.x - tx, b.y - ty) < 22) {
          ko++;
          saveGameProgress('smash-karts', { ko });
          status.textContent = `💥 Kart getroffen! K.O.s: ${ko}`;
          bolts.splice(i, 1);
          continue;
        }
        if (b.x > W + 20) bolts.splice(i, 1);
      }

      ctx.fillStyle = '#121829';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#facc15';
      bolts.forEach((b) => { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath(); ctx.arc(kx, ky, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    status.textContent = `K.O.s: ${ko} · Leertaste oder rechts tippen zum Feuern`;
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 63. PAPER.IO 2
// ==========================================
registerGame({
  id: 'paper-io-2',
  title: 'Paper.io 2',
  icon: '🟩',
  cat: 'Action',
  desc: 'Tippe auf Felder, um grünes Gebiet zu erobern und deinen Fortschritt zu sichern.',
  run({ body, status }) {
    const N = 6;
    const saved = loadGameProgress('paper-io-2', { owned: [0, 1, 6, 7] });
    let owned = Array.isArray(saved.owned) && saved.owned.length ? [...saved.owned] : [0, 1, 6, 7];

    const wrap = $('div', null, '');
    wrap.style.cssText = `display:grid;grid-template-columns:repeat(${N},46px);gap:6px`;
    body.append(wrap);

    const render = () => {
      saveGameProgress('paper-io-2', { owned });
      wrap.innerHTML = '';
      for (let i = 0; i < N * N; i++) {
        const isMine = owned.includes(i);
        const btn = $('button', 'sz-btn ' + (isMine ? 'sz-btn-lime' : 'sz-btn-ghost'), isMine ? '🟩' : '·');
        btn.style.cssText = 'width:46px;height:46px;padding:0;font-size:18px';
        btn.onclick = () => { if (!owned.includes(i)) { owned.push(i); render(); } };
        wrap.append(btn);
      }
      status.textContent = `Erobert: ${owned.length}/${N * N} Felder (gespeichert)`;
    };

    render();
  }
});

// ==========================================
// 64. STATE.IO
// ==========================================
registerGame({
  id: 'state-io',
  title: 'State.io',
  icon: '🚩',
  cat: 'Strategie',
  desc: 'Wähle eine eigene Zone (🟦) und klicke auf ein Ziel, um es zu übernehmen.',
  run({ body, status }) {
    const saved = loadGameProgress('state-io', { zones: ['player', 'neutral', 'enemy', 'neutral'] });
    let zones = Array.isArray(saved.zones) && saved.zones.length === 4 ? [...saved.zones] : ['player', 'neutral', 'enemy', 'neutral'];
    let picked = null;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(2,120px);gap:12px';
    body.append(wrap);

    const render = () => {
      saveGameProgress('state-io', { zones });
      wrap.innerHTML = '';
      zones.forEach((owner, idx) => {
        const ico = owner === 'player' ? '🟦 Eigen' : owner === 'enemy' ? '🟥 Gegner' : '⬜ Frei';
        const btn = $('button', 'sz-btn ' + (picked === idx ? 'sz-btn-lime' : 'sz-btn-primary'), `Zone ${idx + 1}\n${ico}`);
        btn.style.cssText = 'height:76px;white-space:pre-line;font-size:14px';
        btn.onclick = () => {
          if (picked === null) { if (owner === 'player') { picked = idx; render(); } }
          else if (picked !== idx) { zones[idx] = 'player'; picked = null; render(); }
          else { picked = null; render(); }
        };
        wrap.append(btn);
      });
      const mine = zones.filter((z) => z === 'player').length;
      status.textContent = `Deine Zonen: ${mine}/4 · ${mine === 4 ? '🏆 Karte erobert!' : 'Eigene Zone wählen & Ziel erobern'}`;
    };

    render();
  }
});

// ==========================================
// 65. HEXA SORT
// ==========================================
registerGame({
  id: 'hexa-sort',
  title: 'Hexa Sort',
  icon: '⬡',
  cat: 'Puzzle',
  desc: 'Sortiere farbige Sechseck-Stapel durch Umlegen und sammle Punkte.',
  run({ body, status }) {
    const saved = loadGameProgress('hexa-sort', { stacks: [['🟣', '🟡'], ['🟡', '🟣'], ['🩵'], []], pts: 0 });
    let stacks = Array.isArray(saved.stacks) && saved.stacks.length === 4 ? saved.stacks.map((s) => [...s]) : [['🟣', '🟡'], ['🟡', '🟣'], ['🩵'], []];
    let pts = saved.pts || 0, sel = null;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;justify-content:center';
    body.append(wrap);

    const render = () => {
      saveGameProgress('hexa-sort', { stacks, pts });
      wrap.innerHTML = '';
      stacks.forEach((st, idx) => {
        const btn = $('button', 'sz-btn ' + (sel === idx ? 'sz-btn-lime' : 'sz-btn-ghost'), `Stapel ${idx + 1}\n${st.join(' ') || 'leer'}`);
        btn.style.cssText = 'min-width:96px;min-height:84px;white-space:pre-line;font-size:15px';
        btn.onclick = () => {
          if (sel === null) { if (st.length) { sel = idx; render(); } }
          else if (sel === idx) { sel = null; render(); }
          else {
            const mover = stacks[sel].pop();
            if (mover) stacks[idx].push(mover);
            if (stacks[idx].length >= 2 && stacks[idx].every((x) => x === stacks[idx][0])) pts += 25;
            sel = null;
            render();
          }
        };
        wrap.append(btn);
      });
      status.textContent = `Punkte (gespeichert): ${pts} · Gleichfarbige Stapel bilden`;
    };

    render();
  }
});

// ==========================================
// 66. SNOWBALL RUSH
// ==========================================
registerGame({
  id: 'snowball-rush',
  title: 'Snowball Rush',
  icon: '☃️',
  cat: 'Action',
  desc: 'Steuere deinen Schneeball nach links/rechts und weiche Hindernissen aus.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const saved = loadGameProgress('snowball-rush', { best: 0 });
    let best = saved.best || 0;

    const W = 400, H = 460;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let bx = W / 2, score = 0, over = false, rocks = [], tick = 0;

    const reset = () => {
      bx = W / 2; score = 0; over = false; rocks = []; tick = 0;
      status.textContent = `Punkte: 0 · Rekord: ${best}`;
    };

    const setX = (clientX) => {
      const rect = cv.getBoundingClientRect();
      bx = Math.max(24, Math.min(W - 24, ((clientX - rect.left) / rect.width) * W));
    };

    cv.onpointerdown = (e) => {
      if (over) { reset(); return; }
      cv.setPointerCapture(e.pointerId);
      setX(e.clientX);
    };
    cv.onpointermove = (e) => { if (!over && (e.buttons || e.pointerType === 'touch')) setX(e.clientX); };
    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', ' '], (e, firstPress) => {
      if (over && e.key === ' ' && firstPress) reset();
    });

    const loop = () => {
      if (!over) {
        if (keys.ArrowLeft || keys.a) bx = Math.max(24, bx - 4.8);
        if (keys.ArrowRight || keys.d) bx = Math.min(W - 24, bx + 4.8);

        tick++;
        if (tick % 48 === 1) rocks.push({ x: 36 + R(W - 72), y: -20, vy: 3.4 });

        const by = H - 70, br = 14;
        for (let i = rocks.length - 1; i >= 0; i--) {
          const rk = rocks[i];
          rk.y += rk.vy;
          if (rk.y > by + br && !rk.passed) {
            rk.passed = true;
            score++;
            if (score > best) { best = score; saveGameProgress('snowball-rush', { best }); }
            status.textContent = `Punkte: ${score} · Rekord: ${best}`;
          }
          if (Math.hypot(rk.x - bx, rk.y - by) < br + 12) {
            over = true;
            status.textContent = `💥 Hindernis erwischt! Punkte: ${score} · Rekord: ${best} · Tippen für Neustart`;
          }
          if (rk.y > H + 30) rocks.splice(i, 1);
        }
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#94a3b8';
      rocks.forEach((rk) => { ctx.beginPath(); ctx.arc(rk.x, rk.y, 12, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath(); ctx.arc(bx, H - 70, 14, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    reset();
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 67. RAGDOLL ARCHERS
// ==========================================
registerGame({
  id: 'ragdoll-archers',
  title: 'Ragdoll Archers',
  icon: '🏹',
  cat: 'Action',
  desc: 'Stelle den Schusswinkel ein und schieße Pfeile auf das Ziel (Trefferbereich: 25°–45°).',
  run({ body, status }) {
    const saved = loadGameProgress('ragdoll-archers', { hits: 0, aim: 35 });
    let hits = saved.hits || 0, aim = saved.aim ?? 35;

    const wrap = $('div', null, '');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;max-width:440px';
    const rng = $('input', null, '');
    rng.type = 'range'; rng.min = '5'; rng.max = '75'; rng.value = String(aim);
    const shotBtn = $('button', 'sz-btn sz-btn-primary', '🏹 Pfeil abschießen');
    wrap.append(rng, shotBtn);
    body.append(wrap);

    const sync = (msg) => { saveGameProgress('ragdoll-archers', { hits, aim }); status.textContent = `${msg} · Treffer: ${hits} · Winkel: ${aim}°`; };

    rng.oninput = () => { aim = Number(rng.value); sync('Winkel angepasst'); };
    shotBtn.onclick = () => {
      if (aim >= 25 && aim <= 45) { hits++; sync('🎯 Volltreffer!'); }
      else sync('💨 Daneben – Ziel liegt bei 25°–45°');
    };

    sync('Bereit zum Schießen');
  }
});

// ==========================================
// 68. DIEP.IO
// ==========================================
registerGame({
  id: 'diep-io',
  title: 'Diep.io',
  icon: '🎯',
  cat: 'Action',
  desc: 'Bewege deinen Panzer mit Finger/Maus oder WASD/Pfeiltasten und feuere auf Ziele.',
  run({ body, status }) {
    const { trackRaf, keys, bindKeys } = makeArcadeCanvasRuntime();
    const saved = loadGameProgress('diep-io', { score: 0 });
    let score = saved.score || 0;

    const W = 480, H = 320;
    const cv = $('canvas', 'sz-arc-cv');
    cv.width = W; cv.height = H;
    body.append(cv);
    const ctx = cv.getContext('2d');

    let tx = 100, ty = H / 2, gx = W - 110, gy = H / 2, shells = [];
    const fire = () => shells.push({ x: tx + 22, y: ty, vx: 7.5 });

    cv.onpointerdown = (e) => {
      const rect = cv.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * W;
      const py = ((e.clientY - rect.top) / rect.height) * H;
      if (px > tx + 50) fire();
      else { tx = Math.max(24, Math.min(W - 24, px)); ty = Math.max(24, Math.min(H - 24, py)); }
    };
    bindKeys(['ArrowLeft', 'a', 'ArrowRight', 'd', 'ArrowUp', 'w', 'ArrowDown', 's', ' '], (e, firstPress) => {
      if (e.key === ' ' && e.type === 'keydown' && firstPress) fire();
    });

    const loop = () => {
      if (keys.ArrowLeft || keys.a) tx = Math.max(24, tx - 4.5);
      if (keys.ArrowRight || keys.d) tx = Math.min(W - 24, tx + 4.5);
      if (keys.ArrowUp || keys.w) ty = Math.max(24, ty - 4.5);
      if (keys.ArrowDown || keys.s) ty = Math.min(H - 24, ty + 4.5);

      gy = H / 2 + Math.sin(performance.now() * 0.0022) * 85;

      for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i];
        s.x += s.vx;
        if (Math.hypot(s.x - gx, s.y - gy) < 24) {
          score += 15;
          saveGameProgress('diep-io', { score });
          status.textContent = `💥 Ziel zerstört! Punkte: ${score}`;
          shells.splice(i, 1);
          continue;
        }
        if (s.x > W + 20) shells.splice(i, 1);
      }

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fde047';
      shells.forEach((s) => { ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(tx, ty - 4, 22, 8);
      ctx.beginPath(); ctx.arc(tx, ty, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath(); ctx.arc(gx, gy, 17, 0, Math.PI * 2); ctx.fill();

      trackRaf(requestAnimationFrame(loop));
    };

    status.textContent = `Punkte: ${score} · Leertaste oder rechts tippen zum Schießen`;
    trackRaf(requestAnimationFrame(loop));
  }
});

// ==========================================
// 69. MULTIPLAYER: KATEGORIE-BOMBE
// ==========================================
registerGame({
  id: 'kategorie-bombe',
  title: 'Kategorie-Bombe',
  icon: '💣',
  cat: 'Partyspiele',
  desc: 'Es erscheint eine Kategorie (z. B. Automarke). Reihum oder gegenseitig einen Begriff nennen und die Bombe weitergeben – platzt sie bei dir, hast du verloren!',
  run({ body, status }) {
    const { later, cleanup } = makeRuntime();

    const CATEGORIES = [
      'Automarke', 'Tier', 'Land oder Hauptstadt', 'Film oder Serie', 'Getränk',
      'Videospiel', 'Obst oder Gemüse', 'Beruf', 'Sportart', 'Musikband oder Künstler'
    ];

    const getPlayers = () => {
      const p1 = (document.getElementById('sz-p1')?.value || '').trim() || 'Spieler 1';
      const p2 = (document.getElementById('sz-p2')?.value || '').trim() || 'Spieler 2';
      const rawGroup = (document.getElementById('sz-group')?.value || '').trim();
      if (rawGroup) {
        const list = rawGroup.split(',').map((s) => s.trim()).filter(Boolean);
        if (list.length >= 2) return list;
      }
      return [p1, p2];
    };

    const players = getPlayers();
    const saved = loadGameProgress('kategorie-bombe', { losses: {}, rounds: 0 });
    let losses = typeof saved.losses === 'object' && saved.losses ? { ...saved.losses } : {};
    let rounds = saved.rounds || 0;

    let category = CATEGORIES[R(CATEGORIES.length)];
    let turnIdx = 0, running = false, exploded = false, timeLeftMs = 0, tickPulse = false;

    let audioCtx = null;
    const playTick = (urgent) => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtx) audioCtx = new Ctx();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = urgent ? 'sawtooth' : 'sine';
        osc.frequency.value = urgent ? 760 : 440;
        gain.gain.value = 0.04;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } catch (_) {}
    };

    const wrap = $('div', 'sz-kb-wrap');
    const catBox = $('div', 'sz-kb-cat-box');
    const catLabel = $('div', 'sz-kb-cat-label', 'Aktuelle Kategorie');
    const catTitle = $('div', 'sz-kb-cat-title', category);
    catBox.append(catLabel, catTitle);

    const bombStage = $('div', 'sz-kb-bomb-stage');
    const bombIco = $('div', 'sz-kb-bomb-ico', '💣');
    const playerEl = $('div', 'sz-kb-player', players[turnIdx]);
    const hintEl = $('div', 'sz-muted', 'Nenne einen passenden Begriff und gib die Bombe weiter!');
    bombStage.append(bombIco, playerEl, hintEl);

    const actions = $('div', 'sz-kb-actions');
    const passBtn = $('button', 'sz-btn sz-btn-primary', '💣 Begriff gesagt → Weitergeben');
    const newRoundBtn = $('button', 'sz-btn sz-btn-lime', '▶ Neue Kategorie & Start');
    const catBtn = $('button', 'sz-btn sz-btn-ghost', '🎲 Nur Kategorie wechseln');
    actions.append(passBtn, newRoundBtn, catBtn);

    const scoresEl = $('div', 'sz-kb-scores');
    wrap.append(catBox, bombStage, actions, scoresEl);
    body.append(wrap);

    const persist = () => saveGameProgress('kategorie-bombe', { losses, rounds });

    const renderScores = () => {
      scoresEl.innerHTML = '';
      players.forEach((name) => {
        const l = losses[name] || 0;
        scoresEl.append($('span', 'sz-kb-chip', `${name}: ${l}× geplatzt`));
      });
      scoresEl.append($('span', 'sz-kb-chip', `Runden: ${rounds}`));
    };

    const renderState = () => {
      const curPlayer = players[turnIdx % players.length];
      catTitle.textContent = category;
      playerEl.textContent = exploded ? `💥 BOOM! ${curPlayer} hat verloren!` : `Am Zug: ${curPlayer}`;
      bombIco.textContent = exploded ? '💥' : '💣';
      bombIco.classList.toggle('tick', tickPulse && !exploded);
      bombStage.classList.toggle('danger', running && timeLeftMs < 2400);
      passBtn.disabled = !running || exploded;
      renderScores();
    };

    const scheduleCountdown = () => {
      if (!running || exploded) return;
      const stepMs = 450;
      later(() => {
        if (!running || exploded) return;
        timeLeftMs -= stepMs;
        tickPulse = !tickPulse;
        playTick(timeLeftMs < 2400);

        if (timeLeftMs <= 0) {
          running = false;
          exploded = true;
          const loser = players[turnIdx % players.length];
          losses[loser] = (losses[loser] || 0) + 1;
          rounds++;
          persist();
          hintEl.textContent = 'Zeit abgelaufen – die Bombe ist geplatzt!';
          status.textContent = `💥 ${loser} war dran, als die Bombe platzte!`;
          renderState();
          return;
        }

        renderState();
        scheduleCountdown();
      }, stepMs);
    };

    const startNewRound = () => {
      cleanup();
      category = CATEGORIES[R(CATEGORIES.length)];
      turnIdx = R(players.length);
      exploded = false;
      running = true;
      timeLeftMs = 5500 + R(4500);
      rounds++;
      persist();
      hintEl.textContent = 'Schnell einen Begriff nennen und weitergeben!';
      status.textContent = `Kategorie „${category}“ · ${players[turnIdx]} beginnt!`;
      renderState();
      scheduleCountdown();
    };

    passBtn.onclick = () => {
      if (!running || exploded) return;
      turnIdx = (turnIdx + 1) % players.length;
      const nextName = players[turnIdx];
      hintEl.textContent = `Weiter an ${nextName}!`;
      status.textContent = `Bombe weitergegeben an ${nextName} · Kategorie: ${category}`;
      renderState();
    };

    catBtn.onclick = () => {
      category = CATEGORIES[R(CATEGORIES.length)];
      renderState();
      status.textContent = `Neue Kategorie: ${category}`;
    };

    newRoundBtn.onclick = startNewRound;
    renderState();
    status.textContent = `Kategorie „${category}“ · Drücke „Neue Kategorie & Start“ zum Loslegen`;
  }
});

// ==========================================
// 70–74. WEITERE 2, 3 UND 4 SPIELER PARTYSPIELE
// ==========================================
function getMultiplayerRoster(count = 4) {
  const p1 = (document.getElementById('sz-p1')?.value || '').trim() || 'Spieler 1';
  const p2 = (document.getElementById('sz-p2')?.value || '').trim() || 'Spieler 2';
  const rawGroup = (document.getElementById('sz-group')?.value || '').trim();
  const pool = [];

  if (rawGroup) {
    rawGroup.split(',').map((s) => s.trim()).filter(Boolean).forEach((n) => {
      if (!pool.includes(n)) pool.push(n);
    });
  }
  [p1, p2, 'Spieler 3', 'Spieler 4'].forEach((n) => {
    if (!pool.includes(n)) pool.push(n);
  });

  return pool.slice(0, Math.max(2, Math.min(4, count)));
}

function buildPlayerCountSwitcher(initialCount, onChangeCount) {
  const bar = $('div', 'sz-mp-bar');
  bar.append($('span', 'sz-muted', 'Spielerzahl:'));
  [2, 3, 4].forEach((n) => {
    const btn = $('button', 'sz-btn ' + (n === initialCount ? 'sz-btn-primary' : 'sz-btn-ghost'), `${n}P`);
    btn.style.padding = '5px 10px';
    btn.style.fontSize = '12px';
    btn.onclick = () => onChangeCount(n);
    bar.append(btn);
  });
  return bar;
}

registerGame({
  id: 'kofferpacken-mp',
  title: 'Kofferpacken (2–4P)',
  icon: '🧳',
  cat: 'Partyspiele',
  desc: 'Für 2, 3 oder 4 Spieler: Reihum einen neuen Gegenstand in den Koffer legen und alle bisherigen Dinge der Reihe nach nennen.',
  run({ body, status }) {
    const saved = loadGameProgress('kofferpacken-mp', { count: 3, scores: {}, items: ['Zahnbürste'] });
    let count = saved.count || 3;
    let scores = typeof saved.scores === 'object' && saved.scores ? { ...saved.scores } : {};
    let items = Array.isArray(saved.items) && saved.items.length ? [...saved.items] : ['Zahnbürste'];
    let turn = 0;

    const wrap = $('div', 'sz-mp-wrap');
    body.append(wrap);

    const render = () => {
      const players = getMultiplayerRoster(count);
      const cur = players[turn % players.length];
      saveGameProgress('kofferpacken-mp', { count, scores, items });
      wrap.innerHTML = '';
      wrap.append(buildPlayerCountSwitcher(count, (n) => { count = n; turn = 0; render(); }));

      const board = $('div', 'sz-mp-board');
      board.append(
        $('div', 'sz-mp-active', `Am Zug: ${cur}`),
        $('div', null, `Im Koffer (${items.length}): ${items.join(' · ')}`)
      );

      const input = $('input', 'sz-search', '');
      input.placeholder = 'Neuer Gegenstand (z. B. Sonnenbrille)…';
      input.style.width = '100%';

      const btns = $('div', 'sz-mp-bar');
      const okBtn = $('button', 'sz-btn sz-btn-lime', '✔ Richtig gesagt (+1)');
      const failBtn = $('button', 'sz-btn sz-btn-ghost', '✖ Patzer (Andere +1)');
      const clrBtn = $('button', 'sz-btn sz-btn-ghost', '🧳 Koffer leeren');

      okBtn.onclick = () => {
        const val = input.value.trim();
        items.push(val || `Sache #${items.length + 1}`);
        scores[cur] = (scores[cur] || 0) + 1;
        turn = (turn + 1) % players.length;
        render();
      };
      failBtn.onclick = () => {
        players.forEach((p) => { if (p !== cur) scores[p] = (scores[p] || 0) + 1; });
        items = ['Zahnbürste'];
        turn = (turn + 1) % players.length;
        render();
      };
      clrBtn.onclick = () => { items = ['Zahnbürste']; render(); };

      btns.append(okBtn, failBtn, clrBtn);
      board.append(input, btns);

      const pills = $('div', 'sz-mp-list');
      players.forEach((p, idx) => {
        pills.append($('span', 'sz-mp-pill' + (idx === turn % players.length ? ' cur' : ''), `${p}: ${scores[p] || 0} Pkt`));
      });

      wrap.append(board, pills);
      status.textContent = `${players.length} Spieler · ${cur} ist dran`;
    };

    render();
  }
});

registerGame({
  id: 'buzzer-duell-mp',
  title: 'Buzzer-Duell (2–4P)',
  icon: '🚨',
  cat: 'Partyspiele',
  desc: 'Für 2, 3 oder 4 Spieler: Wer zuerst die richtige Antwort ruft, bekommt über seinen Spieler-Buzzer den Punkt.',
  run({ body, status }) {
    const PROMPTS = [
      'Nenne schnell ein Land mit „A“!',
      'Nenne ein Tier, das fliegen kann!',
      'Nenne eine Farbe im Regenbogen!',
      'Nenne ein Obst mit Kernen!',
      'Nenne eine Sportart mit Ball!'
    ];
    const saved = loadGameProgress('buzzer-duell-mp', { count: 4, scores: {}, idx: 0 });
    let count = saved.count || 4;
    let scores = typeof saved.scores === 'object' && saved.scores ? { ...saved.scores } : {};
    let idx = saved.idx || 0;

    const wrap = $('div', 'sz-mp-wrap');
    body.append(wrap);

    const render = () => {
      const players = getMultiplayerRoster(count);
      saveGameProgress('buzzer-duell-mp', { count, scores, idx });
      wrap.innerHTML = '';
      wrap.append(buildPlayerCountSwitcher(count, (n) => { count = n; render(); }));

      const board = $('div', 'sz-mp-board');
      board.append(
        $('div', 'sz-mp-active', PROMPTS[idx % PROMPTS.length]),
        $('div', 'sz-muted', 'Wer zuerst antwortet, tippt seinen Buzzer:')
      );

      const buzzRow = $('div', 'sz-mp-bar');
      players.forEach((p) => {
        const b = $('button', 'sz-btn sz-btn-primary', `🚨 ${p} (${scores[p] || 0})`);
        b.onclick = () => { scores[p] = (scores[p] || 0) + 1; idx++; render(); };
        buzzRow.append(b);
      });

      const skipBtn = $('button', 'sz-btn sz-btn-ghost', '⏭ Nächste Aufgabe');
      skipBtn.onclick = () => { idx++; render(); };

      board.append(buzzRow, skipBtn);
      wrap.append(board);
      status.textContent = `Buzzer-Runde mit ${players.length} Spielern (Punkte gespeichert)`;
    };

    render();
  }
});

registerGame({
  id: 'hoeher-tiefer-mp',
  title: 'Höher oder Tiefer (2–4P)',
  icon: '📈',
  cat: 'Partyspiele',
  desc: 'Für 2, 3 oder 4 Spieler: Schätze reihum, ob die nächste Zahl (1–100) höher oder tiefer als die aktuelle Zahl liegt.',
  run({ body, status }) {
    const saved = loadGameProgress('hoeher-tiefer-mp', { count: 3, scores: {}, curNum: 50, turn: 0 });
    let count = saved.count || 3;
    let scores = typeof saved.scores === 'object' && saved.scores ? { ...saved.scores } : {};
    let curNum = saved.curNum ?? 50;
    let turn = saved.turn || 0;

    const wrap = $('div', 'sz-mp-wrap');
    body.append(wrap);

    const render = () => {
      const players = getMultiplayerRoster(count);
      const actor = players[turn % players.length];
      saveGameProgress('hoeher-tiefer-mp', { count, scores, curNum, turn });
      wrap.innerHTML = '';
      wrap.append(buildPlayerCountSwitcher(count, (n) => { count = n; turn = 0; render(); }));

      const board = $('div', 'sz-mp-board');
      board.append(
        $('div', 'sz-mp-active', `${actor} ist dran · Aktuelle Zahl: ${curNum}`),
        $('div', 'sz-muted', 'Liegt die nächste Zahl (1–100) höher oder tiefer?')
      );

      const guess = (dir) => {
        const nextNum = 1 + R(100);
        const right = (dir === 'high' && nextNum >= curNum) || (dir === 'low' && nextNum <= curNum);
        if (right) {
          scores[actor] = (scores[actor] || 0) + 1;
          status.textContent = `✔ ${actor} tippt richtig (${curNum} → ${nextNum})! +1 Punkt`;
        } else {
          status.textContent = `✖ ${actor} liegt daneben (${curNum} → ${nextNum})`;
        }
        curNum = nextNum;
        turn = (turn + 1) % players.length;
        render();
      };

      const row = $('div', 'sz-mp-bar');
      const hiBtn = $('button', 'sz-btn sz-btn-lime', '⬆ Höher');
      const loBtn = $('button', 'sz-btn sz-btn-primary', '⬇ Tiefer');
      hiBtn.onclick = () => guess('high');
      loBtn.onclick = () => guess('low');
      row.append(hiBtn, loBtn);
      board.append(row);

      const pills = $('div', 'sz-mp-list');
      players.forEach((p, i) => {
        pills.append($('span', 'sz-mp-pill' + (i === turn % players.length ? ' cur' : ''), `${p}: ${scores[p] || 0}`));
      });

      wrap.append(board, pills);
    };

    render();
  }
});

registerGame({
  id: 'blitz-rechnen-mp',
  title: 'Blitz-Rechnen (2–4P)',
  icon: '🧮',
  cat: 'Partyspiele',
  desc: 'Für 2, 3 oder 4 Spieler: Löst die Kopfrechen-Aufgabe und vergebt Punkte an den Schnellsten.',
  run({ body, status }) {
    const saved = loadGameProgress('blitz-rechnen-mp', { count: 4, scores: {} });
    let count = saved.count || 4;
    let scores = typeof saved.scores === 'object' && saved.scores ? { ...saved.scores } : {};
    let a = 6 + R(14), b = 4 + R(12), showAns = false;

    const wrap = $('div', 'sz-mp-wrap');
    body.append(wrap);

    const newTask = () => { a = 6 + R(14); b = 4 + R(12); showAns = false; };

    const render = () => {
      const players = getMultiplayerRoster(count);
      saveGameProgress('blitz-rechnen-mp', { count, scores });
      wrap.innerHTML = '';
      wrap.append(buildPlayerCountSwitcher(count, (n) => { count = n; render(); }));

      const board = $('div', 'sz-mp-board');
      board.append(
        $('div', 'sz-mp-active', `${a} + ${b} = ${showAns ? a + b : '?'}`),
        $('div', 'sz-muted', 'Wer zuerst löst, bekommt den Punkt:')
      );

      const pRow = $('div', 'sz-mp-bar');
      players.forEach((p) => {
        const btn = $('button', 'sz-btn sz-btn-primary', `${p} (${scores[p] || 0})`);
        btn.onclick = () => { scores[p] = (scores[p] || 0) + 1; newTask(); render(); };
        pRow.append(btn);
      });

      const ctrlRow = $('div', 'sz-mp-bar');
      const revBtn = $('button', 'sz-btn sz-btn-ghost', '👁 Ergebnis zeigen');
      const nxtBtn = $('button', 'sz-btn sz-btn-lime', '↻ Neue Aufgabe');
      revBtn.onclick = () => { showAns = true; render(); };
      nxtBtn.onclick = () => { newTask(); render(); };
      ctrlRow.append(revBtn, nxtBtn);

      board.append(pRow, ctrlRow);
      wrap.append(board);
      status.textContent = `Blitz-Rechnen für ${players.length} Spieler (Punkte gespeichert)`;
    };

    render();
  }
});

registerGame({
  id: 'luegen-oder-wahrheit-mp',
  title: 'Lügen oder Wahrheit? (2–4P)',
  icon: '🤥',
  cat: 'Partyspiele',
  desc: 'Für 2, 3 oder 4 Spieler: Der aktive Spieler stellt eine Behauptung auf – wer täuscht oder durchschaut, punktet.',
  run({ body, status }) {
    const saved = loadGameProgress('luegen-oder-wahrheit-mp', { count: 4, scores: {}, turn: 0 });
    let count = saved.count || 4;
    let scores = typeof saved.scores === 'object' && saved.scores ? { ...saved.scores } : {};
    let turn = saved.turn || 0;

    const wrap = $('div', 'sz-mp-wrap');
    body.append(wrap);

    const render = () => {
      const players = getMultiplayerRoster(count);
      const speaker = players[turn % players.length];
      saveGameProgress('luegen-oder-wahrheit-mp', { count, scores, turn });
      wrap.innerHTML = '';
      wrap.append(buildPlayerCountSwitcher(count, (n) => { count = n; turn = 0; render(); }));

      const board = $('div', 'sz-mp-board');
      board.append(
        $('div', 'sz-mp-active', `${speaker} stellt eine Behauptung auf`),
        $('div', 'sz-muted', 'Punkte für Täuschung oder Durchschauen vergeben:')
      );

      const row = $('div', 'sz-mp-bar');
      const fooledBtn = $('button', 'sz-btn sz-btn-lime', `🎭 ${speaker} täuscht alle (+1)`);
      const caughtBtn = $('button', 'sz-btn sz-btn-primary', '🕵️ Gruppe durchschaut (+1 an alle anderen)');
      const nextBtn = $('button', 'sz-btn sz-btn-ghost', '➡ Nächster Spieler');

      fooledBtn.onclick = () => { scores[speaker] = (scores[speaker] || 0) + 1; turn = (turn + 1) % players.length; render(); };
      caughtBtn.onclick = () => {
        players.forEach((p) => { if (p !== speaker) scores[p] = (scores[p] || 0) + 1; });
        turn = (turn + 1) % players.length;
        render();
      };
      nextBtn.onclick = () => { turn = (turn + 1) % players.length; render(); };

      row.append(fooledBtn, caughtBtn, nextBtn);
      board.append(row);

      const pills = $('div', 'sz-mp-list');
      players.forEach((p, i) => {
        pills.append($('span', 'sz-mp-pill' + (i === turn % players.length ? ' cur' : ''), `${p}: ${scores[p] || 0}`));
      });

      wrap.append(board, pills);
      status.textContent = `Runde mit ${players.length} Spielern · Sprecher: ${speaker}`;
    };

    render();
  }
});

ROADMAP.forEach((item) => {
  if (!GAMES.some((g) => g.id === item.id)) {
    registerGame({
      id: item.id,
      title: item.title,
      icon: item.icon || '🎮',
      cat: item.cat || 'Arcade',
      desc: item.desc || 'Lokal spielbares Modul im Spielezimmer.',
      run({ status }) {
        status.textContent = `${item.title} bereit.`;
      }
    });
  }
});
