// ==========================================
// BASIS-BAUSTEINE & GEMEINSAMER ROUND-RUNNER
// ==========================================

function prefersReducedMotion() {
  if (typeof szState === 'object' && szState && szState.reducedMotion) return true;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

function pulseSafe(el, animClass = 'pop') {
  if (!el || prefersReducedMotion()) return;
  el.classList.remove(animClass);
  void el.offsetWidth;
  el.classList.add(animClass);
}

function spawnScorePopup(anchorEl, text, { hot = false, rt = null } = {}) {
  if (!anchorEl || prefersReducedMotion()) return;
  const host = anchorEl.closest('.sz-pbk-wrap, .sz-game-body') || anchorEl.parentElement || document.body;
  const computed = window.getComputedStyle(host);
  if (computed.position === 'static') host.style.position = 'relative';

  const pop = $('span', 'sz-score-popup' + (hot ? ' is-hot' : ''), text);
  const aRect = anchorEl.getBoundingClientRect();
  const hRect = host.getBoundingClientRect();
  pop.style.left = `${Math.max(12, aRect.left - hRect.left + aRect.width * 0.5)}px`;
  pop.style.top = `${Math.max(8, aRect.top - hRect.top - 4)}px`;
  host.append(pop);

  const removeFn = () => pop.remove();
  if (rt && typeof rt.later === 'function') {
    rt.later(removeFn, 760);
  } else {
    setTimeout(removeFn, 760);
  }
}

function annotateColorBlindMarker(btn, symbol) {
  if (!btn) return;
  let badge = btn.querySelector('.sz-cb-badge');
  if (!badge) {
    badge = $('span', 'sz-cb-badge', symbol);
    btn.append(badge);
  } else {
    badge.textContent = symbol;
  }
  const active = Boolean(typeof szState === 'object' && szState && szState.colorBlindAssist);
  badge.style.display = active ? 'inline-flex' : 'none';
}

function createColorBlindProfileControl(onChange) {
  const wrap = $('div', 'sz-cb-control');
  const btn = $('button', 'sz-btn sz-btn-ghost sz-cb-btn', '');
  btn.type = 'button';

  const syncLabel = () => {
    const enabled = Boolean(typeof szState === 'object' && szState && szState.colorBlindAssist);
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btn.classList.toggle('is-active', enabled);
    btn.textContent = enabled ? '👁 Farbenblind-Hilfe: AN' : '👁 Farbenblind-Hilfe: AUS';
  };

  btn.onclick = () => {
    if (typeof szState === 'object' && szState) {
      szState.colorBlindAssist = !szState.colorBlindAssist;
      if (typeof saveSzState === 'function') saveSzState();
    }
    syncLabel();
    if (typeof onChange === 'function') onChange();
  };

  syncLabel();
  wrap.append(btn);
  return { el: wrap, sync: syncLabel };
}

function createLearnBar({ initialText = '', onTip = null, tipLabel = '💡 Tipp (3)' } = {}) {
  const el = $('div', 'sz-learn-bar');
  const msgEl = $('div', 'sz-learn-msg', initialText);
  let tipBtn = null;

  if (typeof onTip === 'function') {
    tipBtn = $('button', 'sz-btn sz-btn-ghost sz-tip-btn', tipLabel);
    tipBtn.type = 'button';
    tipBtn.onclick = () => {
      if (typeof szSfx === 'object' && szSfx && typeof szSfx.click === 'function') szSfx.click();
      onTip();
    };
    el.append(msgEl, tipBtn);
  } else {
    el.append(msgEl);
  }

  return {
    el,
    setMessage(text, tone = 'neutral') {
      msgEl.textContent = text;
      el.classList.remove('is-good', 'is-learn', 'is-warn');
      if (tone === 'good') el.classList.add('is-good');
      else if (tone === 'learn') el.classList.add('is-learn');
      else if (tone === 'warn') el.classList.add('is-warn');
    },
    setTipState({ label, disabled } = {}) {
      if (!tipBtn) return;
      if (typeof label === 'string') tipBtn.textContent = label;
      if (typeof disabled === 'boolean') tipBtn.disabled = disabled;
    }
  };
}

const SZ_DIFFS = {
  easy: { key: 'easy', label: 'Entspannt', timeMult: 1.25, scoreMult: 0.85, rangeFactor: 0.75 },
  normal: { key: 'normal', label: 'Standard', timeMult: 1.0, scoreMult: 1.0, rangeFactor: 1.0 },
  turbo: { key: 'turbo', label: 'Turbo', timeMult: 0.85, scoreMult: 1.35, rangeFactor: 1.3 }
};

function buildModeConfig(modeKey, diffKey, baseSec) {
  const diff = SZ_DIFFS[diffKey] || SZ_DIFFS.normal;
  const isZen = modeKey === 'zen';
  const durationSec = isZen ? 0 : Math.max(10, Math.round(baseSec * diff.timeMult));
  const profileKey = `${isZen ? 'zen' : 'sprint'}_${diff.key}`;
  return {
    modeKey,
    diffKey: diff.key,
    diffLabel: diff.label,
    isZen,
    durationSec,
    scoreMult: diff.scoreMult,
    rangeFactor: diff.rangeFactor,
    profileKey
  };
}

function createRoundRunner({
  rt,
  gameId,
  baseSec = 30,
  statusEl,
  onStartRound,
  onFinishRound,
  onPauseChange,
  onPickIndex,
  onNextGame
}) {
  let modeKey = 'sprint';
  let diffKey = 'normal';
  let playing = false;
  let paused = false;
  let remaining = baseSec;
  let totalDuration = baseSec;
  let timerId = null;
  let lastTickSec = null;

  const modeBar = $('div', 'sz-mode-bar');
  const modeGroup = $('div', 'sz-seg-group');
  const sprintBtn = $('button', 'sz-seg-btn is-active', '⚡ Sprint');
  const zenBtn = $('button', 'sz-seg-btn', '🧘 Zen');
  sprintBtn.type = 'button';
  zenBtn.type = 'button';
  modeGroup.append(sprintBtn, zenBtn);

  const diffGroup = $('div', 'sz-seg-group');
  const diffButtons = Object.values(SZ_DIFFS).map((d) => {
    const b = $('button', 'sz-seg-btn' + (d.key === diffKey ? ' is-active' : ''), d.label);
    b.type = 'button';
    b.dataset.diff = d.key;
    diffGroup.append(b);
    return b;
  });

  const pauseBtn = $('button', 'sz-btn sz-btn-ghost sz-pause-trigger', '⏸ Pause');
  pauseBtn.type = 'button';
  pauseBtn.disabled = true;

  modeBar.append(modeGroup, diffGroup, pauseBtn);

  const timeBar = $('div', 'sz-timebar');
  const timeFill = $('div', 'sz-timebar-fill');
  timeBar.append(timeFill);

  const pauseBox = $('div', 'sz-pause-box');
  pauseBox.style.display = 'none';
  pauseBox.append(
    $('div', 'sz-pause-title', '⏸ Spiel pausiert'),
    $('div', 'sz-pause-sub', 'Drücke „Weiter“ oder Esc, um fortzusetzen.')
  );
  const resumeBtn = $('button', 'sz-btn sz-btn-primary', '▶ Weiter');
  resumeBtn.type = 'button';
  pauseBox.append(resumeBtn);

  const resultBox = $('div', 'sz-result-box');
  resultBox.style.display = 'none';

  const getConfig = () => buildModeConfig(modeKey, diffKey, baseSec);

  const syncSegButtons = () => {
    sprintBtn.classList.toggle('is-active', modeKey === 'sprint');
    zenBtn.classList.toggle('is-active', modeKey === 'zen');
    diffButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.diff === diffKey));
    const cfg = getConfig();
    timeBar.classList.toggle('is-zen', cfg.isZen);
    if (cfg.isZen) {
      timeFill.style.width = '100%';
    } else {
      const pct = totalDuration > 0 ? Math.max(0, Math.min(100, (remaining / totalDuration) * 100)) : 0;
      timeFill.style.width = `${pct}%`;
    }
    pauseBtn.disabled = !playing || cfg.isZen;
    pauseBtn.textContent = paused ? '▶ Weiter' : '⏸ Pause';
  };

  const stopTimer = () => {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const setPaused = (nextPaused, reason = 'manual') => {
    if (!playing || getConfig().isZen) return;
    if (paused === nextPaused) return;
    paused = nextPaused;
    pauseBox.style.display = paused ? 'flex' : 'none';
    syncSegButtons();
    if (typeof onPauseChange === 'function') onPauseChange(paused);
    if (statusEl) {
      statusEl.textContent = paused
        ? (reason === 'blur' ? 'Automatisch pausiert (Tab gewechselt)' : 'Pausiert – Esc oder „Weiter“')
        : 'Runde läuft – Tasten 1–4 oder Klick';
    }
  };

  const finish = ({ score = 0, streak = 0 } = {}) => {
    if (!playing) return;
    playing = false;
    paused = false;
    stopTimer();
    pauseBox.style.display = 'none';
    syncSegButtons();

    const cfg = getConfig();
    const isNewBest = typeof saveGameRecord === 'function'
      ? saveGameRecord(gameId, score, cfg.profileKey)
      : false;
    const best = typeof getGameRecord === 'function'
      ? (getGameRecord(gameId, cfg.profileKey).best || score)
      : score;

    resultBox.innerHTML = '';
    resultBox.style.display = 'flex';
    resultBox.append(
      $('div', 'sz-result-badge', isNewBest ? '🏆 Neuer Rekord!' : '🏁 Runde beendet'),
      $('div', 'sz-result-score', `${score} Punkte`),
      $('div', 'sz-result-meta', `${cfg.isZen ? 'Zen' : 'Sprint'} · ${cfg.diffLabel} · Beste Serie: ${streak}× · Rekord: ${best}`)
    );

    const actions = $('div', 'sz-result-actions');
    const againBtn = $('button', 'sz-btn sz-btn-primary', '↻ Nochmal');
    againBtn.type = 'button';
    againBtn.onclick = () => {
      if (typeof szSfx === 'object' && szSfx && typeof szSfx.click === 'function') szSfx.click();
      start();
    };
    actions.append(againBtn);

    if (typeof onNextGame === 'function') {
      const nextBtn = $('button', 'sz-btn sz-btn-ghost', '🎲 Nächstes Spiel');
      nextBtn.type = 'button';
      nextBtn.onclick = () => {
        if (typeof szSfx === 'object' && szSfx && typeof szSfx.click === 'function') szSfx.click();
        onNextGame();
      };
      actions.append(nextBtn);
    }

    resultBox.append(actions);
    if (typeof onFinishRound === 'function') onFinishRound({ score, streak, isNewBest, best, cfg });
    if (statusEl) statusEl.textContent = `Fertig: ${score} Punkte (Rekord: ${best})`;
  };

  const start = () => {
    stopTimer();
    resultBox.style.display = 'none';
    pauseBox.style.display = 'none';
    paused = false;
    playing = true;

    const cfg = getConfig();
    totalDuration = cfg.durationSec;
    remaining = cfg.durationSec;
    lastTickSec = Math.ceil(remaining);
    syncSegButtons();

    if (typeof onStartRound === 'function') onStartRound(cfg);

    if (!cfg.isZen) {
      let lastNow = performance.now();
      timerId = setInterval(() => {
        if (!playing || paused) {
          lastNow = performance.now();
          return;
        }
        const now = performance.now();
        const dt = (now - lastNow) / 1000;
        lastNow = now;
        remaining = Math.max(0, remaining - dt);

        const pct = totalDuration > 0 ? (remaining / totalDuration) * 100 : 0;
        timeFill.style.width = `${pct}%`;

        const ceilSec = Math.ceil(remaining);
        if (ceilSec !== lastTickSec && ceilSec <= 5 && ceilSec > 0) {
          lastTickSec = ceilSec;
          if (typeof szSfx === 'object' && szSfx && typeof szSfx.tick === 'function') {
            szSfx.tick(ceilSec <= 3);
          }
        }
        if (statusEl) {
          statusEl.textContent = `Sprint (${cfg.diffLabel}): noch ${ceilSec}s`;
        }
        if (remaining <= 0) {
          finish({ score: 0, streak: 0 });
        }
      }, 60);
    } else if (statusEl) {
      statusEl.textContent = `Zen-Modus (${cfg.diffLabel}) – kein Zeitdruck`;
    }
  };

  sprintBtn.onclick = () => {
    if (typeof szSfx === 'object' && szSfx && typeof szSfx.click === 'function') szSfx.click();
    modeKey = 'sprint';
    playing = false;
    paused = false;
    stopTimer();
    pauseBox.style.display = 'none';
    resultBox.style.display = 'none';
    remaining = getConfig().durationSec;
    syncSegButtons();
    if (typeof onStartRound === 'function') onStartRound(getConfig());
  };

  zenBtn.onclick = () => {
    if (typeof szSfx === 'object' && szSfx && typeof szSfx.click === 'function') szSfx.click();
    modeKey = 'zen';
    playing = false;
    paused = false;
    stopTimer();
    pauseBox.style.display = 'none';
    resultBox.style.display = 'none';
    syncSegButtons();
    if (typeof onStartRound === 'function') onStartRound(getConfig());
  };

  diffButtons.forEach((btn) => {
    btn.onclick = () => {
      if (typeof szSfx === 'object' && szSfx && typeof szSfx.click === 'function') szSfx.click();
      diffKey = btn.dataset.diff || 'normal';
      playing = false;
      paused = false;
      stopTimer();
      pauseBox.style.display = 'none';
      resultBox.style.display = 'none';
      remaining = getConfig().durationSec;
      syncSegButtons();
      if (typeof onStartRound === 'function') onStartRound(getConfig());
    };
  });

  pauseBtn.onclick = () => {
    if (typeof szSfx === 'object' && szSfx && typeof szSfx.click === 'function') szSfx.click();
    setPaused(!paused, 'manual');
  };

  resumeBtn.onclick = () => {
    if (typeof szSfx === 'object' && szSfx && typeof szSfx.click === 'function') szSfx.click();
    setPaused(false, 'manual');
  };

  const onKeyDown = (e) => {
    if (!modeBar.isConnected) return;
    if (e.key === 'Escape' && playing && !getConfig().isZen) {
      e.preventDefault();
      setPaused(!paused, 'manual');
      return;
    }
    if (e.key === 'Enter' && !playing) {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag !== 'INPUT' && tag !== 'SELECT') {
        e.preventDefault();
        start();
      }
      return;
    }
    if (playing && !paused && typeof onPickIndex === 'function') {
      const map = { '1': 0, '2': 1, '3': 2, '4': 3 };
      if (Object.prototype.hasOwnProperty.call(map, e.key)) {
        e.preventDefault();
        onPickIndex(map[e.key]);
      }
    }
  };

  const onVisibilityChange = () => {
    if (document.hidden && playing && !getConfig().isZen) {
      setPaused(true, 'blur');
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibilityChange);

  if (rt && typeof rt.onCleanup === 'function') {
    rt.onCleanup(() => {
      stopTimer();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  }

  syncSegButtons();

  return {
    modeBar,
    timeBar,
    pauseBox,
    resultBox,
    start,
    finish,
    setPaused,
    isPlaying: () => playing,
    isPaused: () => paused,
    getTimeLeft: () => remaining,
    getConfig
  };
}

// ==========================================
// SPIELE 1–3: POTENZ-KNACKER, ZAHLEN-KETTE & REFLEX-TAKT
// ==========================================
function buildPowerTaskWithDepth({ streak = 0, rangeFactor = 1.0 }) {
  const useCube = streak >= 2 && R(100) < (streak >= 4 ? 42 : 25);
  const maxSq = Math.max(8, Math.min(15, Math.round(12 * rangeFactor)));
  const maxCb = Math.max(4, Math.min(7, Math.round(5 * rangeFactor)));

  const base = useCube ? (2 + R(Math.max(2, maxCb - 1))) : (2 + R(Math.max(3, maxSq - 1)));
  const exp = useCube ? 3 : 2;
  const answer = Math.pow(base, exp);
  const label = useCube ? `${base}³ = ?` : `${base}² = ?`;
  const trap = base * exp;

  const set = new Set([answer]);
  const pool = [trap, Math.pow(Math.max(2, base + 1), exp), Math.pow(Math.max(2, base - 1), exp), answer + 2, Math.max(4, answer - 2)];
  for (const c of pool) {
    if (set.size >= 4) break;
    if (Number.isFinite(c) && c > 0 && c !== answer) set.add(c);
  }
  while (set.size < 4) {
    const f = answer + (set.size + 1) * 2;
    if (f !== answer) set.add(f);
  }

  const options = [...set];
  for (let i = options.length - 1; i > 0; i--) {
    const j = R(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    base,
    exp,
    label,
    answer,
    options,
    explainRule: `${label.replace(' = ?', '')} = ${Array.from({ length: exp }, () => base).join(' × ')} = ${answer}`
  };
}

registerGame({
  id: 'power-breaker',
  title: 'Potenz-Knacker',
  icon: '⚡',
  cat: 'Puzzle',
  desc: 'Berechne Quadrat- und Kubikzahlen im Kopf – mit Zen/Sprint, Schwierigkeit, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let task = buildPowerTaskWithDepth({ streak: 0, rangeFactor: 1 });

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'math');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '⚡ 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', '');
    const subEl = $('div', 'sz-pbk-sub', 'Potenzwert im Kopf berechnen');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp blendet eine falsche Antwort aus.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const wrong = optBtns.find((b) => !b.disabled && Number(b.textContent) !== task.answer);
        if (!wrong) return;
        wrong.disabled = true;
        wrong.style.opacity = '0.28';
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: ${task.base} wird ${task.exp}× mit sich selbst malgenommen.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('power-breaker', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `⚡ ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const nextTask = (nextStreak, rangeFactor) => {
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      task = buildPowerTaskWithDepth({ streak: nextStreak, rangeFactor });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });
      exprEl.textContent = task.label;

      optBtns.forEach((btn, i) => {
        const val = task.options[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === task.answer) {
            streak++;
            const baseGain = tipUsed ? 10 : 15;
            const gained = Math.round((baseGain + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const rule = task.explainRule;
            nextTask(streak, curCfg.rangeFactor);
            learnBar.setMessage(`✓ Richtig: ${rule} (+${gained} Pkt)`, 'good');
          } else {
            const rule = task.explainRule;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            nextTask(0, curCfg.rangeFactor);
            learnBar.setMessage(`✕ ${val} stimmt nicht – ${rule}.`, 'learn');
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'power-breaker',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        nextTask(0, cfg.rangeFactor);
        learnBar.setMessage('Löse so viele Potenzen wie möglich.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'power-breaker');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    nextTask(0, 1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

function buildChainTask({ streak = 0, rangeFactor = 1.0 }) {
  const scale = Math.max(1, Math.round(rangeFactor));
  const useMult = streak >= 2 && R(100) < 45;

  if (useMult) {
    const start = 1 + R(3);
    const step = 2 + R(Math.min(2, scale));
    const seq = [start, start * step, start * step * step];
    const ans = start * step * step * step;
    const set = new Set([ans]);
    [ans + step, Math.max(2, ans - step), seq[2] + step, ans * 2].forEach((n) => {
      if (set.size < 4 && n > 0 && n !== ans) set.add(n);
    });
    while (set.size < 4) set.add(ans + set.size * 3);

    const options = [...set];
    for (let i = options.length - 1; i > 0; i--) {
      const j = R(i + 1);
      [options[i], options[j]] = [options[j], options[i]];
    }

    return {
      expr: `${seq.join(' · ')} · ?`,
      sub: `Jede Zahl wird mit ×${step} weitergerechnet`,
      tip: `Multipliziere ${seq[2]} mit ${step}.`,
      rule: `${seq[2]} × ${step} = ${ans}`,
      answer: ans,
      options
    };
  }

  const start = 2 + R(10 * scale);
  const step = (2 + R(5) + Math.min(3, Math.floor(streak / 2))) * scale;
  const seq = [start, start + step, start + 2 * step];
  const ans = start + 3 * step;
  const set = new Set([ans]);
  [ans + step, Math.max(1, ans - step), ans + 2, Math.max(1, ans - 2)].forEach((n) => {
    if (set.size < 4 && n > 0 && n !== ans) set.add(n);
  });
  while (set.size < 4) set.add(ans + set.size * 2);

  const options = [...set];
  for (let i = options.length - 1; i > 0; i--) {
    const j = R(i + 1);
    [options[i], options[j]] = [options[j], options[i]];
  }

  return {
    expr: `${seq.join(' · ')} · ?`,
    sub: `Schrittweite +${step} pro Glied`,
    tip: `Addiere +${step} auf die letzte Zahl (${seq[2]}).`,
    rule: `${seq[2]} + ${step} = ${ans}`,
    answer: ans,
    options
  };
}

registerGame({
  id: 'chain-breaker',
  title: 'Zahlen-Kette',
  icon: '🔗',
  cat: 'Logik',
  desc: 'Setze Zahlenketten logisch fort – mit Zen/Sprint, Schwierigkeit, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let task = buildChainTask({ streak: 0, rangeFactor: 1 });

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'logic');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '🔗 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', '');
    const subEl = $('div', 'sz-pbk-sub', '');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp nennt die Rechenregel für den nächsten Schritt.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const wrong = optBtns.find((b) => !b.disabled && Number(b.textContent) !== task.answer);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: ${task.tip}`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('chain-breaker', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🔗 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const nextTask = (nextStreak, rangeFactor) => {
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      task = buildChainTask({ streak: nextStreak, rangeFactor });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });
      exprEl.textContent = task.expr;
      subEl.textContent = task.sub;

      optBtns.forEach((btn, i) => {
        const val = task.options[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === task.answer) {
            streak++;
            const gained = Math.round(((tipUsed ? 10 : 15) + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const info = task.rule;
            nextTask(streak, curCfg.rangeFactor);
            learnBar.setMessage(`✓ Richtig: ${info} (+${gained} Pkt)`, 'good');
          } else {
            const info = task.rule;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            nextTask(0, curCfg.rangeFactor);
            learnBar.setMessage(`✕ ${val} passt nicht – ${info}.`, 'learn');
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'chain-breaker',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        nextTask(0, cfg.rangeFactor);
        learnBar.setMessage('Finde die nächste Zahl der Kette.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'chain-breaker');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    nextTask(0, 1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'reflex-pulse',
  title: 'Reflex-Takt',
  icon: '⚡',
  cat: 'Reflex',
  desc: 'Triff nur das aktive Signal-Feld – mit Zen/Sprint, Schwierigkeit, Farbenblind-Markern & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let targetIdx = 0;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'reflex');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 25s');
    const scorePill = $('span', 'sz-sc-pill', '⚡ 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', 'SIGNAL');
    const subEl = $('div', 'sz-pbk-sub', 'Wähle das markierte Ziel-Feld (1–4)');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const labels = ['Feld 1', 'Feld 2', 'Feld 3', 'Feld 4'];
    const optBtns = labels.map((lbl, idx) => {
      const b = $('button', 'sz-pbk-btn', lbl);
      b.type = 'button';
      b.dataset.idx = String(idx);
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp blendet ein falsches Feld aus.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const wrong = optBtns.find((b, i) => !b.disabled && i !== targetIdx);
        if (!wrong) return;
        wrong.disabled = true;
        wrong.style.opacity = '0.28';
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Ziel ist Feld ${targetIdx + 1}.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('reflex-pulse', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `⚡ ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealSignal = (rangeFactor) => {
      tipUsed = false;
      const nextIdx = R(4);
      targetIdx = nextIdx === targetIdx ? (nextIdx + 1) % 4 : nextIdx;
      const stepBonus = rangeFactor > 1.1 ? ' (Turbo-Tempo)' : '';
      exprEl.textContent = `ZIEL: FELD ${targetIdx + 1}`;
      subEl.textContent = `Aktives Signal auf Feld ${targetIdx + 1}${stepBonus}`;
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      optBtns.forEach((b, i) => {
        b.style.opacity = '';
        b.disabled = !runner.isPlaying() || runner.isPaused();
        const isTarget = i === targetIdx;
        b.style.borderColor = isTarget ? 'var(--sz-accent)' : '';
        annotateColorBlindMarker(b, isTarget ? '✓' : '·');
      });
    };

    optBtns.forEach((btn, idx) => {
      btn.onclick = () => {
        const curCfg = runner.getConfig();
        if (!runner.isPlaying() || runner.isPaused()) return;
        if (idx === targetIdx) {
          streak++;
          const gained = Math.round(((tipUsed ? 8 : 12) + Math.min(18, streak * 2)) * curCfg.scoreMult);
          score += gained;
          szSfx.hit(streak);
          pulseSafe(stage, 'pop');
          spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
          learnBar.setMessage(`✓ Feld ${idx + 1} getroffen (+${gained} Pkt)`, 'good');
          dealSignal(curCfg.rangeFactor);
        } else {
          const expected = targetIdx + 1;
          streak = 0;
          szSfx.miss();
          pulseSafe(grid, 'shake');
          learnBar.setMessage(`✕ Feld ${idx + 1} war falsch – gesucht war Feld ${expected}.`, 'learn');
          dealSignal(curCfg.rangeFactor);
        }
        syncHud();
      };
    });

    const runner = createRoundRunner({
      rt,
      gameId: 'reflex-pulse',
      baseSec: 25,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealSignal(cfg.rangeFactor);
        learnBar.setMessage('Triff das markierte Zielfeld so schnell wie möglich.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'reflex-pulse');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealSignal(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

// ==========================================
// SPIELE 4–8: BUCHSTABEN-SALAT, SILBEN-SUCHE, REIM-BLITZ, QUOTIENT-KNACKER & MUSTER-KNACKER
// ==========================================
const SZ_WORD_BANK = [
  { word: 'SONNE', clue: 'Tagesgestirn', fact: 'Spendet Licht und Wärme am Tag.' },
  { word: 'WOLKE', clue: 'Am Himmel', fact: 'Schwebt aus winzigen Wassertröpfchen.' },
  { word: 'BLITZ', clue: 'Bei Gewitter', fact: 'Elektrische Entladung vor dem Donner.' },
  { word: 'STERN', clue: 'Nachthimmel', fact: 'Leuchtet weit entfernt in der Dunkelheit.' },
  { word: 'TURM', clue: 'Hohes Bauwerk', fact: 'Ragt oft über Dächer und Mauern hinaus.' },
  { word: 'FLUSS', clue: 'Fließgewässer', fact: 'Strömt Richtung See oder Meer.' },
  { word: 'INSEL', clue: 'Land im Wasser', fact: 'Allseitig von Wasser umgeben.' },
  { word: 'LAMPE', clue: 'Lichtquelle', fact: 'Erhellt Räume und Schreibtische.' },
  { word: 'KARTE', clue: 'Orientierung', fact: 'Zeigt Wege, Orte oder Spielwerte.' },
  { word: 'GIPFEL', clue: 'Höchster Punkt', fact: 'Die Spitze eines Berges.' },
  { word: 'KOMPASS', clue: 'Himmelsrichtung', fact: 'Weist zuverlässig nach Norden.' },
  { word: 'LEUCHTTURM', clue: 'Küstensignal', fact: 'Warnt Schiffe mit seinem Lichtstrahl.' }
];

const SZ_SYLLABLE_BANK = [
  { left: 'SON', right: 'NE', word: 'SONNE', clue: 'Licht am Tag', distractors: ['MON', 'TAS', 'BAUM', 'LICHT'] },
  { left: 'WOL', right: 'KE', word: 'WOLKE', clue: 'Himmelsgebilde', distractors: ['STERN', 'FEN', 'BERG', 'WIND'] },
  { left: 'STER', right: 'NE', word: 'STERNE', clue: 'Nachthimmel', distractors: ['SON', 'BLITZ', 'WALD', 'TAG'] },
  { left: 'IN', right: 'SEL', word: 'INSEL', clue: 'Land im Wasser', distractors: ['FLUSS', 'SEE', 'TURM', 'SAND'] },
  { left: 'GIP', right: 'FEL', word: 'GIPFEL', clue: 'Bergspitze', distractors: ['TAL', 'HÖH', 'STEIN', 'WEG'] },
  { left: 'KOM', right: 'PASS', word: 'KOMPASS', clue: 'Nadel nach Norden', distractors: ['KARTE', 'UHR', 'NORD', 'STERN'] }
];

registerGame({
  id: 'word-scramble',
  title: 'Buchstaben-Salat',
  icon: '🥗',
  cat: 'Wörter',
  desc: 'Setze gemischte Buchstaben zum gesuchten Wort zusammen – mit Hinweis, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let entry = SZ_WORD_BANK[0];
    let tiles = [];
    let pickedIds = [];

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'word');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '🥗 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const banner = $('div', 'sz-word-banner');
    const wordLine = $('div', 'sz-word-main', '');
    const clueLine = $('div', 'sz-word-sub', '');
    banner.append(wordLine, clueLine);

    const pool = $('div', 'sz-tile-pool');

    const undoRow = $('div', 'sz-hub-actions');
    const undoBtn = $('button', 'sz-btn sz-btn-ghost', '⌫ Zurück');
    undoBtn.type = 'button';
    undoRow.append(undoBtn);

    const learnBar = createLearnBar({
      initialText: 'Tipp markiert den nächsten benötigten Buchstaben.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const built = pickedIds.map((id) => tiles.find((t) => t.id === id)?.ch || '').join('');
        const needed = entry.word[built.length];
        if (!needed) return;
        const target = tiles.find((t) => !t.picked && t.ch === needed);
        if (!target) return;
        target.peeked = true;
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Als Nächstes folgt „${needed}“ (${entry.clue}).`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
        renderTiles();
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('word-scramble', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🥗 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealWord = (rangeFactor, prevWord = null) => {
      let bank = SZ_WORD_BANK.filter((w) => w.word !== prevWord);
      if (!bank.length) bank = SZ_WORD_BANK;
      if (rangeFactor < 0.85) {
        const s = bank.filter((w) => w.word.length <= 5);
        if (s.length) bank = s;
      } else if (rangeFactor > 1.15) {
        const l = bank.filter((w) => w.word.length >= 6);
        if (l.length) bank = l;
      }

      entry = bank[R(bank.length)];
      pickedIds = [];
      tipUsed = false;
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const chars = entry.word.split('');
      for (let attempt = 0; attempt < 8; attempt++) {
        for (let i = chars.length - 1; i > 0; i--) {
          const j = R(i + 1);
          [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        if (chars.join('') !== entry.word) break;
      }
      tiles = chars.map((ch, id) => ({ id, ch, picked: false, peeked: false }));
      renderTiles();
    };

    function renderTiles() {
      const built = pickedIds.map((id) => tiles.find((t) => t.id === id)?.ch || '').join('');
      wordLine.textContent = `${built || '—'} (${entry.word.length})`;
      clueLine.textContent = `Hinweis: ${entry.clue}`;
      undoBtn.disabled = !runner.isPlaying() || runner.isPaused() || pickedIds.length === 0;

      pool.innerHTML = '';
      tiles.forEach((t) => {
        const cls =
          'sz-letter-tile' +
          (t.picked ? ' is-picked' : '') +
          (t.peeked && !t.picked ? ' is-peek' : '');
        const btn = $('button', cls, t.ch);
        btn.type = 'button';
        btn.disabled = !runner.isPlaying() || runner.isPaused() || t.picked;
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused() || t.picked) return;
          t.picked = true;
          pickedIds.push(t.id);
          const nowBuilt = pickedIds.map((id) => tiles.find((x) => x.id === id)?.ch || '').join('');

          if (nowBuilt === entry.word) {
            streak++;
            const gained = Math.round(((tipUsed ? 10 : 15) + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(banner, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const fact = entry.fact;
            dealWord(curCfg.rangeFactor, entry.word);
            learnBar.setMessage(`✓ ${nowBuilt}: ${fact} (+${gained} Pkt)`, 'good');
          } else if (!entry.word.startsWith(nowBuilt)) {
            const missed = entry.word;
            const fact = entry.fact;
            streak = 0;
            szSfx.miss();
            pulseSafe(pool, 'shake');
            dealWord(curCfg.rangeFactor, missed);
            learnBar.setMessage(`✕ Gesucht war „${missed}“ – ${fact}`, 'learn');
          } else {
            szSfx.click();
            renderTiles();
          }
          syncHud();
        };
        pool.append(btn);
      });
    }

    undoBtn.onclick = () => {
      if (!runner.isPlaying() || runner.isPaused() || !pickedIds.length) return;
      szSfx.click();
      const lastId = pickedIds.pop();
      const t = tiles.find((x) => x.id === lastId);
      if (t) t.picked = false;
      renderTiles();
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'word-scramble',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealWord(cfg.rangeFactor);
        learnBar.setMessage('Wähle die Buchstaben in der richtigen Reihenfolge.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        renderTiles();
        syncHud();
      },
      onPauseChange() {
        renderTiles();
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'word-scramble');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, banner, pool, undoRow, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealWord(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'syllable-hunt',
  title: 'Silben-Suche',
  icon: '🧩',
  cat: 'Wörter',
  desc: 'Finde die passende zweite Silbe zum Wortanfang – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let item = SZ_SYLLABLE_BANK[0];
    let choices = [];

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'word');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '🧩 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const banner = $('div', 'sz-word-banner');
    const leftSylEl = $('div', 'sz-word-main', '');
    const clueEl = $('div', 'sz-word-sub', '');
    banner.append(leftSylEl, clueEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp blendet eine unpassende Silbe aus.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const wrong = optBtns.find((b) => !b.disabled && b.textContent !== item.right);
        if (!wrong) return;
        wrong.disabled = true;
        wrong.style.opacity = '0.28';
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Gesucht ist das Wort „${item.word}“ (${item.clue}).`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('syllable-hunt', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🧩 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const nextSyllable = (prevWord = null) => {
      let pool = SZ_SYLLABLE_BANK.filter((s) => s.word !== prevWord);
      if (!pool.length) pool = SZ_SYLLABLE_BANK;
      item = pool[R(pool.length)];
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      leftSylEl.textContent = `${item.left} + ?`;
      clueEl.textContent = `Hinweis: ${item.clue}`;

      const list = [item.right, ...item.distractors.slice(0, 3)];
      for (let i = list.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [list[i], list[j]] = [list[j], list[i]];
      }
      choices = list;

      optBtns.forEach((btn, i) => {
        const syl = choices[i];
        btn.textContent = syl;
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (syl === item.right) {
            streak++;
            const gained = Math.round(((tipUsed ? 10 : 14) + Math.min(18, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(banner, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const solvedWord = item.word;
            nextSyllable(solvedWord);
            learnBar.setMessage(`✓ Ergibt „${solvedWord}“ (+${gained} Pkt)`, 'good');
          } else {
            const solvedWord = item.word;
            const rightSyl = item.right;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            nextSyllable(solvedWord);
            learnBar.setMessage(`✕ Gesucht war „${rightSyl}“ für „${solvedWord}“.`, 'learn');
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'syllable-hunt',
      baseSec: 30,
      statusEl: status,
      onStartRound() {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        nextSyllable(null);
        learnBar.setMessage('Wähle die passende zweite Silbe.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'syllable-hunt');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, banner, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    nextSyllable(null);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'rhyme-blitz',
  title: 'Reim-Blitz',
  icon: '🎵',
  cat: 'Wörter',
  desc: 'Finde das passende Reimwort zum Zielwort – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    const sets = [
      { word: 'MAUS', ending: '-AUS', rhyme: 'HAUS', others: ['TISCH', 'WOLKE', 'STERN'], fact: 'MAUS und HAUS reimen auf „-aus“.' },
      { word: 'NACHT', ending: '-ACHT', rhyme: 'MACHT', others: ['BLUME', 'TURM', 'FLUSS'], fact: 'NACHT und MACHT reimen auf „-acht“.' },
      { word: 'STEIN', ending: '-EIN', rhyme: 'BEIN', others: ['APFEL', 'LAMPE', 'VOGEL'], fact: 'STEIN und BEIN reimen auf „-ein“.' },
      { word: 'BAUM', ending: '-AUM', rhyme: 'TRAUM', others: ['RADAR', 'UHR', 'KOMET'], fact: 'BAUM und TRAUM reimen auf „-aum“.' },
      { word: 'WIND', ending: '-IND', rhyme: 'KIND', others: ['GIPFEL', 'KARTE', 'TAKT'], fact: 'WIND und KIND reimen auf „-ind“.' },
      { word: 'MEER', ending: '-EER', rhyme: 'LEER', others: ['DRACHE', 'WOLKE', 'FEDER'], fact: 'MEER und LEER reimen auf „-eer“.' }
    ];

    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let cur = sets[0];
    let opts = [];

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'word');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 25s');
    const scorePill = $('span', 'sz-sc-pill', '🎵 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const banner = $('div', 'sz-word-banner');
    const titleEl = $('div', 'sz-word-main', '');
    const hintEl = $('div', 'sz-word-sub', '');
    banner.append(titleEl, hintEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp nennt den Reimklang und blendet ein Wort aus.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const wrong = optBtns.find((b, i) => !b.disabled && opts[i] && !opts[i].ok);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        hintEl.textContent = `Reimklang: ${cur.ending}`;
        learnBar.setMessage(`Tipp: Achte auf den Endklang „${cur.ending}“.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('rhyme-blitz', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🎵 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const nextRhyme = (prevWord = null) => {
      let pool = sets.filter((s) => s.word !== prevWord);
      if (!pool.length) pool = sets;
      cur = pool[R(pool.length)];
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      titleEl.textContent = `Reim zu „${cur.word}“`;
      hintEl.textContent = 'Wähle das passende Reimwort';

      const list = [
        { label: cur.rhyme, ok: true },
        ...cur.others.slice(0, 3).map((w) => ({ label: w, ok: false }))
      ];
      for (let i = list.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [list[i], list[j]] = [list[j], list[i]];
      }
      opts = list;

      optBtns.forEach((btn, i) => {
        const item = opts[i];
        btn.textContent = item.label;
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (item.ok) {
            streak++;
            const gained = Math.round(((tipUsed ? 8 : 12) + Math.min(18, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(banner, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const fact = cur.fact;
            nextRhyme(cur.word);
            learnBar.setMessage(`✓ ${fact} (+${gained} Pkt)`, 'good');
          } else {
            const fact = cur.fact;
            const prev = cur.word;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            nextRhyme(prev);
            learnBar.setMessage(`✕ ${item.label} reimt nicht – ${fact}`, 'learn');
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'rhyme-blitz',
      baseSec: 25,
      statusEl: status,
      onStartRound() {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        nextRhyme(null);
        learnBar.setMessage('Finde das passende Reimwort.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'rhyme-blitz');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, banner, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    nextRhyme(null);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'quotient-breaker',
  title: 'Quotient-Knacker',
  icon: '➗',
  cat: 'Puzzle',
  desc: 'Wähle zwei Zahlen, deren Division den Zielquotienten ergibt – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let targetQ = 3;
    let pair = { a: 12, b: 4 };
    let tiles = [];
    let selectedIdx = -1;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'math');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '➗ 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const qEl = $('div', 'sz-pbk-expr', '');
    const subEl = $('div', 'sz-pbk-sub', 'Zwei Zahlen antippen: große ÷ kleine = Ziel');
    stage.append(qEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp markiert eine passende Zahl für den Zielquotienten.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const idx = tiles.findIndex((v, i) => i !== selectedIdx && (v === pair.a || v === pair.b));
        if (idx === -1) return;
        tipUsed = true;
        tipsLeft--;
        optBtns.forEach((b, i) => {
          if (i === idx) b.style.borderColor = '#38bdf8';
        });
        learnBar.setMessage(`Tipp: ${tiles[idx]} gehört zu einem passenden Paar (${pair.a} ÷ ${pair.b} = ${targetQ}).`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('quotient-breaker', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `➗ ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealPair = (rangeFactor) => {
      selectedIdx = -1;
      tipUsed = false;
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const maxQ = rangeFactor < 0.85 ? 5 : (rangeFactor > 1.15 ? 8 : 6);
      const maxD = rangeFactor < 0.85 ? 6 : (rangeFactor > 1.15 ? 9 : 7);
      targetQ = 2 + R(Math.max(2, maxQ - 1));
      const d = 2 + R(Math.max(2, maxD - 1));
      pair = { a: targetQ * d, b: d };
      qEl.textContent = `Ziel: ${targetQ}`;

      const set = new Set([pair.a, pair.b]);
      while (set.size < 4) {
        const cand = 2 + R(Math.max(16, Math.round(36 * rangeFactor)));
        set.add(cand);
      }
      tiles = [...set];
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }

      renderTiles();
    };

    function renderTiles() {
      optBtns.forEach((btn, i) => {
        const val = tiles[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.style.borderColor = i === selectedIdx ? '#facc15' : '';
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (selectedIdx === -1) {
            selectedIdx = i;
            szSfx.click();
            renderTiles();
            return;
          }
          if (selectedIdx === i) {
            selectedIdx = -1;
            szSfx.click();
            renderTiles();
            return;
          }
          const firstVal = tiles[selectedIdx];
          const hi = Math.max(firstVal, val);
          const lo = Math.min(firstVal, val);
          const ok = lo > 0 && hi % lo === 0 && hi / lo === targetQ;

          if (ok) {
            streak++;
            const gained = Math.round(((tipUsed ? 10 : 15) + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            dealPair(curCfg.rangeFactor);
            learnBar.setMessage(`✓ ${hi} ÷ ${lo} = ${targetQ} (+${gained} Pkt)`, 'good');
          } else {
            streak = 0;
            selectedIdx = -1;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ ${hi} ÷ ${lo} ergibt nicht ${targetQ}.`, 'learn');
            renderTiles();
          }
          syncHud();
        };
      });
    }

    const runner = createRoundRunner({
      rt,
      gameId: 'quotient-breaker',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealPair(cfg.rangeFactor);
        learnBar.setMessage(`Finde zwei Zahlen mit Quotient ${targetQ}.`, 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'quotient-breaker');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealPair(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'pattern-breaker',
  title: 'Muster-Knacker',
  icon: '🔮',
  cat: 'Logik',
  desc: 'Ergänze fehlende Glieder in Zahlen- und Schrittmustern – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let peekIdx = -1;
    let task = null;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'logic');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '🔮 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const ruleEl = $('div', 'sz-pbk-sub', '');
    const seqRow = $('div', 'sz-seq-row');
    stage.append(ruleEl, seqRow);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp markiert das Bezugsglied im Muster.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0 || !task) return;
        const wrong = optBtns.find((b) => !b.disabled && Number(b.textContent) !== task.answer);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        peekIdx = task.focusIdx;
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: ${task.tip}`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
        renderPattern();
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('pattern-breaker', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🔮 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const makePattern = (nextStreak, rangeFactor) => {
      const step = (2 + R(4) + Math.min(2, Math.floor(nextStreak / 2))) * Math.max(1, Math.round(rangeFactor));
      const start = 2 + R(12);
      const seq = [0, 1, 2, 3].map((i) => start + i * step);
      const gapIdx = nextStreak >= 3 ? 2 : 3;
      const ans = seq[gapIdx];

      const set = new Set([ans]);
      [ans + step, Math.max(1, ans - step), ans + 1, Math.max(1, ans - 1)].forEach((n) => {
        if (set.size < 4 && n > 0 && n !== ans) set.add(n);
      });
      while (set.size < 4) set.add(ans + set.size * 2);

      const options = [...set];
      for (let i = options.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }

      return {
        rule: `Muster: Schrittweite +${step}`,
        tip: `Vergleiche die Nachbarn mit dem Schritt +${step}.`,
        explain: `Mit +${step} ergibt sich ${ans}.`,
        seq: seq.map((v, i) => (i === gapIdx ? '?' : v)),
        gapIdx,
        focusIdx: Math.max(0, gapIdx - 1),
        answer: ans,
        options
      };
    };

    const dealPattern = (nextStreak, rangeFactor) => {
      tipUsed = false;
      peekIdx = -1;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      task = makePattern(nextStreak, rangeFactor);
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });
      renderPattern();
    };

    function renderPattern() {
      if (!task) return;
      ruleEl.textContent = task.rule;
      seqRow.innerHTML = '';
      task.seq.forEach((val, i) => {
        const cls =
          'sz-seq-cell' +
          (val === '?' ? ' is-gap' : '') +
          (i === peekIdx ? ' is-peek' : '');
        seqRow.append($('div', cls, String(val)));
      });

      optBtns.forEach((btn, i) => {
        const val = task.options[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === task.answer) {
            streak++;
            const gained = Math.round(((tipUsed ? 10 : 15) + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const info = task.explain;
            dealPattern(streak, curCfg.rangeFactor);
            learnBar.setMessage(`✓ Richtig: ${info} (+${gained} Pkt)`, 'good');
          } else {
            const info = task.explain;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            dealPattern(0, curCfg.rangeFactor);
            learnBar.setMessage(`✕ ${val} war falsch – ${info}`, 'learn');
          }
          syncHud();
        };
      });
    }

    const runner = createRoundRunner({
      rt,
      gameId: 'pattern-breaker',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealPattern(0, cfg.rangeFactor);
        learnBar.setMessage('Ergänze das fehlende Glied im Muster.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'pattern-breaker');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealPattern(0, 1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

// ==========================================
// SPIELE 9–12: GRÖSSEN-DUELL, TERM-BLITZ, REIHEN-SORTIERER & SEQUENZ-MERKER
// ==========================================
registerGame({
  id: 'size-duel',
  title: 'Größen-Duell',
  icon: '⚖️',
  cat: 'Logik',
  desc: 'Finde den höheren Wert im Vergleich – mit Zen/Sprint, Schwierigkeit, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let pair = null;
    let opts = [];

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'logic');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 25s');
    const scorePill = $('span', 'sz-sc-pill', '⚖️ 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', 'WER IST GRÖSSER?');
    const subEl = $('div', 'sz-pbk-sub', 'Wähle den höheren Wert');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp blendet eine der kleineren Optionen aus.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0 || !pair) return;
        const idx = opts.findIndex((o, i) => !optBtns[i].disabled && o.val < pair.maxVal);
        if (idx === -1) return;
        optBtns[idx].disabled = true;
        optBtns[idx].style.opacity = '0.28';
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Gesucht ist ein Wert größer als ${opts[idx].val}.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('size-duel', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `⚖️ ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealDuel = (rangeFactor) => {
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const baseA = 2 + R(Math.max(4, Math.round(7 * rangeFactor)));
      const baseB = 2 + R(Math.max(4, Math.round(7 * rangeFactor)));
      const v1 = baseA * baseA;
      const multB = 2 + R(4);
      const v2 = baseB * multB;
      let maxVal = Math.max(v1, v2);

      const raw = [
        { label: `${baseA}²`, val: v1 },
        { label: `${baseB} × ${multB}`, val: v2 },
        { label: String(Math.max(2, maxVal - (4 + R(8)))), val: Math.max(2, maxVal - (4 + R(8))) },
        { label: String(Math.max(2, maxVal - (12 + R(8)))), val: Math.max(2, maxVal - (12 + R(8))) }
      ];

      const highest = Math.max(...raw.map((x) => x.val));
      const topItems = raw.filter((x) => x.val === highest);
      if (topItems.length > 1) {
        topItems[0].val += 3;
        topItems[0].label = `${topItems[0].label} + 3`;
      }

      maxVal = Math.max(...raw.map((x) => x.val));
      pair = { maxVal };

      for (let i = raw.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [raw[i], raw[j]] = [raw[j], raw[i]];
      }
      opts = raw;

      exprEl.textContent = 'HÖCHSTER WERT';
      subEl.textContent = 'Vergleiche die Ausdrücke und Zahlen';

      optBtns.forEach((btn, i) => {
        const item = opts[i];
        btn.textContent = item.label;
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (item.val === pair.maxVal) {
            streak++;
            const gained = Math.round(((tipUsed ? 10 : 14) + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            dealDuel(curCfg.rangeFactor);
            learnBar.setMessage(`✓ ${item.label} = ${pair.maxVal} war am höchsten (+${gained} Pkt)`, 'good');
          } else {
            const bestLabel = opts.find((o) => o.val === pair.maxVal)?.label || '';
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ ${item.label} (${item.val}) ist kleiner als ${bestLabel} (${pair.maxVal}).`, 'learn');
            dealDuel(curCfg.rangeFactor);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'size-duel',
      baseSec: 25,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealDuel(cfg.rangeFactor);
        learnBar.setMessage('Wähle den größten Wert.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'size-duel');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealDuel(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'term-blitz',
  title: 'Term-Blitz',
  icon: '🧮',
  cat: 'Puzzle',
  desc: 'Löse zusammengesetzte Rechenaufgaben sicher im Kopf – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let current = null;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'math');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '🧮 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', '');
    const subEl = $('div', 'sz-pbk-sub', 'Erst malnehmen, dann plus/minus');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp rechnet zuerst den Mal-Teil aus.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0 || !current) return;
        const wrong = optBtns.find((b) => !b.disabled && Number(b.textContent) !== current.answer);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Der Mal-Teil ergibt ${current.prod}.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('term-blitz', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🧮 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealTerm = (rangeFactor) => {
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const a = 2 + R(Math.max(3, Math.round(6 * rangeFactor)));
      const b = 2 + R(6);
      const c = 2 + R(Math.max(5, Math.round(12 * rangeFactor)));
      const usePlus = R(2) === 0;
      const prod = a * b;
      const ans = usePlus ? prod + c : Math.max(1, prod - c);
      const text = usePlus ? `${c} + ${a} × ${b} = ?` : `${prod} - ${c} = ?`;

      const set = new Set([ans]);
      [(usePlus ? (c + a) * b : prod), ans + b, Math.max(1, ans - b), ans + 2].forEach((n) => {
        if (set.size < 4 && n > 0 && n !== ans) set.add(n);
      });
      while (set.size < 4) set.add(ans + set.size * 3);

      const options = [...set];
      for (let i = options.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }

      current = {
        text,
        prod,
        answer: ans,
        options,
        explain: usePlus ? `${a} × ${b} = ${prod}, dann + ${c} = ${ans}` : `${prod} - ${c} = ${ans}`
      };

      exprEl.textContent = current.text;
      optBtns.forEach((btn, i) => {
        const val = current.options[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === current.answer) {
            streak++;
            const gained = Math.round(((tipUsed ? 10 : 15) + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const info = current.explain;
            dealTerm(curCfg.rangeFactor);
            learnBar.setMessage(`✓ ${info} (+${gained} Pkt)`, 'good');
          } else {
            const info = current.explain;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ ${val} stimmt nicht – ${info}.`, 'learn');
            dealTerm(curCfg.rangeFactor);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'term-blitz',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealTerm(cfg.rangeFactor);
        learnBar.setMessage('Berechne den Term Schritt für Schritt.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'term-blitz');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealTerm(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'order-sorter',
  title: 'Reihen-Sortierer',
  icon: '📶',
  cat: 'Logik',
  desc: 'Finde die Zahl, die die Lücke zwischen zwei Nachbarn sauber füllt – mit Zen/Sprint, Tipp & Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let cur = null;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'logic');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '📶 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const ruleEl = $('div', 'sz-pbk-sub', 'Zahl zwischen beiden Nachbarn finden');
    const seqRow = $('div', 'sz-seq-row');
    stage.append(ruleEl, seqRow);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp grenzt den Bereich zwischen links und rechts ein.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0 || !cur) return;
        const wrong = optBtns.find((b) => !b.disabled && Number(b.textContent) !== cur.answer);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Die Zahl liegt zwischen ${cur.left} und ${cur.right}.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('order-sorter', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `📶 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealOrder = (rangeFactor) => {
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const step = (2 + R(4)) * Math.max(1, Math.round(rangeFactor));
      const left = 2 + R(Math.max(8, Math.round(25 * rangeFactor)));
      const ans = left + step;
      const right = ans + step;

      const set = new Set([ans]);
      [Math.max(1, left - step), right + step, ans + 1, Math.max(1, ans - 1)].forEach((n) => {
        if (set.size < 4 && n > 0 && n !== ans && (n <= left || n >= right)) set.add(n);
      });
      while (set.size < 4) set.add(right + set.size * step);

      const options = [...set];
      for (let i = options.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }

      cur = {
        left,
        right,
        answer: ans,
        options,
        explain: `${left} → ${ans} → ${right} (gleichmäßiger Abstand +${step})`
      };

      ruleEl.textContent = `Gleichmäßiger Schritt zwischen ${left} und ${right}`;
      seqRow.innerHTML = '';
      [left, '?', right].forEach((v) => {
        seqRow.append($('div', 'sz-seq-cell' + (v === '?' ? ' is-gap' : ''), String(v)));
      });

      optBtns.forEach((btn, i) => {
        const val = cur.options[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === cur.answer) {
            streak++;
            const gained = Math.round(((tipUsed ? 10 : 14) + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const info = cur.explain;
            dealOrder(curCfg.rangeFactor);
            learnBar.setMessage(`✓ ${info} (+${gained} Pkt)`, 'good');
          } else {
            const info = cur.explain;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ ${val} passt hier nicht – ${info}.`, 'learn');
            dealOrder(curCfg.rangeFactor);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'order-sorter',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealOrder(cfg.rangeFactor);
        learnBar.setMessage('Finde die passende Zahl zwischen beiden Nachbarn.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'order-sorter');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealOrder(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'sequence-memory',
  title: 'Sequenz-Merker',
  icon: '🧠',
  cat: 'Logik',
  desc: 'Merke dir die gezeigte Reihenfolge und spiele sie nach – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let sequence = [];
    let stepCursor = 0;
    let showingSeq = false;
    let peekIdx = -1;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'logic');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 35s');
    const scorePill = $('span', 'sz-sc-pill', '🧠 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', 'FOLGE MERKEN');
    const subEl = $('div', 'sz-pbk-sub', 'Beobachte die Reihenfolge, danach nachspielen');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const padLabels = ['1 · ▲', '2 · ●', '3 · ■', '4 · ◆'];
    const optBtns = padLabels.map((lbl, idx) => {
      const b = $('button', 'sz-pbk-btn', lbl);
      b.type = 'button';
      b.dataset.idx = String(idx);
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp markiert das als Nächstes erwartete Feld.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || showingSeq || tipUsed || tipsLeft <= 0) return;
        const expected = sequence[stepCursor];
        if (typeof expected !== 'number') return;
        peekIdx = expected;
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Als Nächstes kommt Feld ${expected + 1} (${stepCursor + 1}/${sequence.length}).`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
        syncPads();
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('sequence-memory', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🧠 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const syncPads = () => {
      const canInput = runner.isPlaying() && !runner.isPaused() && !showingSeq;
      optBtns.forEach((btn, i) => {
        btn.disabled = !canInput;
        btn.style.borderColor = i === peekIdx ? '#fde047' : '';
        annotateColorBlindMarker(btn, i === peekIdx ? '★' : String(i + 1));
      });
      learnBar.setTipState({
        label: `💡 Tipp (${tipsLeft})`,
        disabled: !canInput || tipUsed || tipsLeft <= 0
      });
    };

    const flashPad = (idx, durationMs = 340) => {
      const btn = optBtns[idx];
      if (!btn) return;
      btn.style.borderColor = '#38bdf8';
      btn.style.transform = 'scale(1.04)';
      pulseSafe(btn, 'pop');
      rt.later(() => {
        if (!btn.isConnected) return;
        btn.style.borderColor = '';
        btn.style.transform = '';
      }, durationMs);
    };

    const playSequence = (seqToShow) => {
      showingSeq = true;
      stepCursor = 0;
      peekIdx = -1;
      tipUsed = false;
      syncPads();
      exprEl.textContent = `LÄNGE ${seqToShow.length}`;
      subEl.textContent = 'Folge läuft – gut merken…';

      const paceMs = runner.getConfig().rangeFactor > 1.1 ? 380 : 480;
      seqToShow.forEach((padIdx, stepOffset) => {
        rt.later(() => {
          if (!runner.isPlaying()) return;
          flashPad(padIdx, Math.max(220, paceMs - 110));
          szSfx.tick(false);
        }, stepOffset * paceMs + 160);
      });

      rt.later(() => {
        if (!runner.isPlaying()) return;
        showingSeq = false;
        subEl.textContent = `Deine Reihe: Schritt 1 von ${seqToShow.length}`;
        syncPads();
      }, seqToShow.length * paceMs + 260);
    };

    const startNextSequence = (len) => {
      const next = [];
      for (let i = 0; i < len; i++) next.push(R(4));
      sequence = next;
      playSequence(sequence);
    };

    optBtns.forEach((btn, idx) => {
      btn.onclick = () => {
        const curCfg = runner.getConfig();
        if (!runner.isPlaying() || runner.isPaused() || showingSeq) return;
        const expected = sequence[stepCursor];

        if (idx === expected) {
          stepCursor++;
          peekIdx = -1;
          szSfx.hit(stepCursor);
          flashPad(idx, 200);

          if (stepCursor >= sequence.length) {
            streak++;
            const gained = Math.round(((tipUsed ? 12 : 16) + sequence.length * 3 + Math.min(20, streak * 2)) * curCfg.scoreMult);
            score += gained;
            const solvedLen = sequence.length;
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            learnBar.setMessage(`✓ Folge der Länge ${solvedLen} fehlerfrei gemeistert (+${gained} Pkt)`, 'good');
            syncHud();

            const nextLen = Math.min(8, solvedLen + 1);
            rt.later(() => {
              if (runner.isPlaying() && !runner.isPaused()) startNextSequence(nextLen);
            }, 420);
          } else {
            subEl.textContent = `Deine Reihe: Schritt ${stepCursor + 1} von ${sequence.length}`;
            syncPads();
          }
        } else {
          const expectedHuman = expected + 1;
          streak = 0;
          szSfx.miss();
          pulseSafe(grid, 'shake');
          learnBar.setMessage(`✕ Schritt ${stepCursor + 1} war falsch – erwartet war Feld ${expectedHuman}.`, 'learn');
          syncHud();

          const restartLen = curCfg.rangeFactor < 0.85 ? 2 : 3;
          rt.later(() => {
            if (runner.isPlaying() && !runner.isPaused()) startNextSequence(restartLen);
          }, 480);
        }
      };
    });

    const runner = createRoundRunner({
      rt,
      gameId: 'sequence-memory',
      baseSec: 35,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        const startLen = cfg.rangeFactor < 0.85 ? 2 : 3;
        learnBar.setMessage('Merke dir die gezeigte Reihenfolge und tippe sie nach.', 'neutral');
        syncHud();
        startNextSequence(startLen);
      },
      onFinishRound() {
        showingSeq = false;
        syncPads();
        syncHud();
      },
      onPauseChange() {
        syncPads();
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'sequence-memory');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    syncPads();
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

// ==========================================
// SPIELE 13–18: EINMALEINS-TURBO, WORT-LÜCKE, TEILBARKEITS-CHECK, SPIEGEL-WORT, ZAHLEN-PAAR & GEGENSATZ-BLITZ
// ==========================================
registerGame({
  id: 'times-table-blitz',
  title: 'Einmaleins-Turbo',
  icon: '✖️',
  cat: 'Puzzle',
  desc: 'Trainiere das kleine und große Einmaleins – mit Zen/Sprint, Schwierigkeit, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let cur = null;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'math');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '✖️ 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', '');
    const subEl = $('div', 'sz-pbk-sub', 'Produkt schnell ausrechnen');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp nennt eine Teilsumme über die Hälfte des Faktors.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0 || !cur) return;
        const wrong = optBtns.find((b) => !b.disabled && Number(b.textContent) !== cur.answer);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: ${cur.a} × ${cur.half} = ${cur.a * cur.half}, danach noch ${cur.b - cur.half} × ${cur.a}.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('times-table-blitz', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `✖️ ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealTimes = (rangeFactor) => {
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const maxF = rangeFactor < 0.85 ? 7 : (rangeFactor > 1.15 ? 12 : 10);
      const a = 2 + R(Math.max(3, maxF - 1));
      const b = 2 + R(Math.max(3, maxF - 1));
      const ans = a * b;
      const half = Math.max(1, Math.floor(b / 2));

      const set = new Set([ans]);
      [ans + a, Math.max(2, ans - a), ans + b, Math.max(2, ans - b)].forEach((n) => {
        if (set.size < 4 && n > 0 && n !== ans) set.add(n);
      });
      while (set.size < 4) set.add(ans + set.size * 2);

      const options = [...set];
      for (let i = options.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }

      cur = { a, b, half, answer: ans, options };
      exprEl.textContent = `${a} × ${b} = ?`;

      optBtns.forEach((btn, i) => {
        const val = cur.options[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === cur.answer) {
            streak++;
            const gained = Math.round(((tipUsed ? 8 : 12) + Math.min(18, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const info = `${a} × ${b} = ${ans}`;
            dealTimes(curCfg.rangeFactor);
            learnBar.setMessage(`✓ ${info} (+${gained} Pkt)`, 'good');
          } else {
            const info = `${a} × ${b} = ${ans}`;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ ${val} stimmt nicht – ${info}.`, 'learn');
            dealTimes(curCfg.rangeFactor);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'times-table-blitz',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealTimes(cfg.rangeFactor);
        learnBar.setMessage('Rechne die Malaufgaben so schnell wie möglich.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'times-table-blitz');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealTimes(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'word-gap',
  title: 'Wort-Lücke',
  icon: '🔤',
  cat: 'Wörter',
  desc: 'Fülle den fehlenden Buchstaben im Wort – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    const bank = [
      { word: 'REGEN', idx: 1, clue: 'Fällt aus Wolken', distractors: ['A', 'O', 'U'] },
      { word: 'WALZER', idx: 2, clue: 'Klassischer Tanz im Dreiertakt', distractors: ['I', 'O', 'U'] },
      { word: 'BRÜCKE', idx: 1, clue: 'Verbindet zwei Ufer', distractors: ['A', 'E', 'O'] },
      { word: 'FENSTER', idx: 1, clue: 'Blick nach draußen', distractors: ['A', 'I', 'O'] },
      { word: 'GARTEN', idx: 1, clue: 'Beete und Pflanzen am Haus', distractors: ['E', 'I', 'O'] },
      { word: 'SCHULE', idx: 2, clue: 'Ort zum Lernen', distractors: ['A', 'E', 'O'] }
    ];

    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let cur = bank[0];
    let opts = [];

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'word');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '🔤 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const banner = $('div', 'sz-word-banner');
    const wordEl = $('div', 'sz-word-main', '');
    const clueEl = $('div', 'sz-word-sub', '');
    banner.append(wordEl, clueEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp blendet einen falschen Buchstaben aus.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const ansChar = cur.word[cur.idx];
        const wrong = optBtns.find((b) => !b.disabled && b.textContent !== ansChar);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Das gesuchte Wort lautet „${cur.word}“.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('word-gap', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🔤 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const nextGap = (prevWord = null) => {
      const pool = bank.filter((x) => x.word !== prevWord);
      cur = (pool.length ? pool : bank)[R((pool.length ? pool : bank).length)];
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const ansChar = cur.word[cur.idx];
      const masked = cur.word
        .split('')
        .map((ch, i) => (i === cur.idx ? '_' : ch))
        .join(' ');
      wordEl.textContent = masked;
      clueEl.textContent = `Hinweis: ${cur.clue}`;

      const list = [ansChar, ...cur.distractors.filter((d) => d !== ansChar).slice(0, 3)];
      while (list.length < 4) list.push('E');
      for (let i = list.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [list[i], list[j]] = [list[j], list[i]];
      }
      opts = list;

      optBtns.forEach((btn, i) => {
        const ch = opts[i];
        btn.textContent = ch;
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (ch === ansChar) {
            streak++;
            const gained = Math.round(((tipUsed ? 8 : 12) + Math.min(18, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(banner, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const fullWord = cur.word;
            nextGap(fullWord);
            learnBar.setMessage(`✓ „${fullWord}“ ergänzt (+${gained} Pkt)`, 'good');
          } else {
            const fullWord = cur.word;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ „${ch}“ passt nicht – gesucht war „${ansChar}“ in „${fullWord}“.`, 'learn');
            nextGap(fullWord);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'word-gap',
      baseSec: 30,
      statusEl: status,
      onStartRound() {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        nextGap(null);
        learnBar.setMessage('Wähle den fehlenden Buchstaben.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'word-gap');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, banner, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    nextGap(null);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'divisibility-check',
  title: 'Teilbarkeits-Check',
  icon: '🎯',
  cat: 'Puzzle',
  desc: 'Erkenne glatte Teiler (2, 3, 5, 9, 10) – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let cur = null;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'math');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '🎯 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', '');
    const subEl = $('div', 'sz-pbk-sub', 'Welcher Teiler geht glatt auf?');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp nennt einen Hinweis zur Teilbarkeit.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0 || !cur) return;
        const wrong = optBtns.find((b) => !b.disabled && Number(b.textContent) !== cur.divisor);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: ${cur.hint}`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('divisibility-check', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🎯 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealDiv = (rangeFactor) => {
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const rules = [
        { d: 2, hint: 'Gerade Zahlen enden auf 0, 2, 4, 6 oder 8.' },
        { d: 3, hint: 'Quersumme ist durch 3 teilbar.' },
        { d: 5, hint: 'Endziffer ist 0 oder 5.' },
        { d: 9, hint: 'Quersumme ist durch 9 teilbar.' },
        { d: 10, hint: 'Endet auf 0.' }
      ];
      const pickRule = rules[R(rules.length)];
      const mult = 3 + R(Math.max(4, Math.round(9 * rangeFactor)));
      const num = pickRule.d * mult;

      const set = new Set([pickRule.d]);
      for (const cand of [2, 3, 5, 9, 10]) {
        if (set.size >= 4) break;
        if (num % cand !== 0) set.add(cand);
      }
      while (set.size < 4) set.add(2 + set.size);

      const options = [...set];
      for (let i = options.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }

      cur = {
        num,
        divisor: pickRule.d,
        quot: mult,
        hint: pickRule.hint,
        options
      };
      exprEl.textContent = `${num} teilbar durch …?`;

      optBtns.forEach((btn, i) => {
        const val = cur.options[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === cur.divisor) {
            streak++;
            const gained = Math.round(((tipUsed ? 8 : 12) + Math.min(18, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const info = `${num} ÷ ${val} = ${cur.quot}`;
            dealDiv(curCfg.rangeFactor);
            learnBar.setMessage(`✓ ${info} (+${gained} Pkt)`, 'good');
          } else {
            const info = `${num} ÷ ${cur.divisor} = ${cur.quot}`;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ ${val} geht nicht glatt auf – ${info}.`, 'learn');
            dealDiv(curCfg.rangeFactor);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'divisibility-check',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealDiv(cfg.rangeFactor);
        learnBar.setMessage('Wähle einen Teiler, der glatt aufgeht.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'divisibility-check');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealDiv(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'mirror-word',
  title: 'Spiegel-Wort',
  icon: '🪞',
  cat: 'Wörter',
  desc: 'Erkenne das richtig geschriebene Wort zwischen gespiegelten Varianten – mit Tipp & Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    const words = ['WOLKE', 'SONNE', 'STERN', 'BLITZ', 'INSEL', 'TURM', 'FLUSS', 'KARTE'];
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let targetWord = words[0];
    let opts = [];

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'word');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 25s');
    const scorePill = $('span', 'sz-sc-pill', '🪞 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const banner = $('div', 'sz-word-banner');
    const titleEl = $('div', 'sz-word-main', 'RICHTIGE SCHREIBWEISE');
    const subEl = $('div', 'sz-word-sub', 'Welche Schreibweise ist vorwärts richtig?');
    banner.append(titleEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp blendet eine rückwärts geschriebene Variante aus.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const wrong = optBtns.find((b) => !b.disabled && b.textContent !== targetWord);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Das Wort beginnt mit „${targetWord[0]}“.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('mirror-word', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `🪞 ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const makeMirrorVariants = (w) => {
      const rev = w.split('').reverse().join('');
      const swap1 = w.length >= 4 ? w[1] + w[0] + w.slice(2) : rev;
      const swapEnd = w.length >= 4 ? w.slice(0, -2) + w[w.length - 1] + w[w.length - 2] : rev;
      const set = new Set([w, rev, swap1, swapEnd]);
      while (set.size < 4) set.add(w.slice(1) + w[0]);
      const list = [...set].slice(0, 4);
      for (let i = list.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [list[i], list[j]] = [list[j], list[i]];
      }
      return list;
    };

    const nextMirror = (prev = null) => {
      const pool = words.filter((w) => w !== prev);
      targetWord = (pool.length ? pool : words)[R((pool.length ? pool : words).length)];
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      opts = makeMirrorVariants(targetWord);
      optBtns.forEach((btn, i) => {
        const val = opts[i];
        btn.textContent = val;
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === targetWord) {
            streak++;
            const gained = Math.round(((tipUsed ? 8 : 12) + Math.min(18, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(banner, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const solved = targetWord;
            nextMirror(solved);
            learnBar.setMessage(`✓ „${solved}“ erkannt (+${gained} Pkt)`, 'good');
          } else {
            const solved = targetWord;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ „${val}“ war verdreht – gesucht war „${solved}“.`, 'learn');
            nextMirror(solved);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'mirror-word',
      baseSec: 25,
      statusEl: status,
      onStartRound() {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        nextMirror(null);
        learnBar.setMessage('Tippe die richtig geschriebene Wortform.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'mirror-word');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, banner, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    nextMirror(null);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'pair-sum',
  title: 'Zahlen-Paar',
  icon: '➕',
  cat: 'Puzzle',
  desc: 'Finde den fehlenden Summanden bis zur Zielsumme – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let cur = null;

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'math');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 30s');
    const scorePill = $('span', 'sz-sc-pill', '➕ 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const stage = $('div', 'sz-pbk-stage');
    const exprEl = $('div', 'sz-pbk-expr', '');
    const subEl = $('div', 'sz-pbk-sub', 'Welche Zahl ergänzt zur Summe?');
    stage.append(exprEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp zeigt die Differenz (Zielsumme minus Startzahl).',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0 || !cur) return;
        const wrong = optBtns.find((b) => !b.disabled && Number(b.textContent) !== cur.answer);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Rechne ${cur.sum} - ${cur.start}.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('pair-sum', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `➕ ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const dealPairSum = (rangeFactor) => {
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      const start = 3 + R(Math.max(8, Math.round(25 * rangeFactor)));
      const ans = 2 + R(Math.max(8, Math.round(25 * rangeFactor)));
      const sum = start + ans;

      const set = new Set([ans]);
      [ans + 1, Math.max(1, ans - 1), ans + 5, Math.max(1, ans - 5)].forEach((n) => {
        if (set.size < 4 && n > 0 && n !== ans) set.add(n);
      });
      while (set.size < 4) set.add(ans + set.size * 2);

      const options = [...set];
      for (let i = options.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [options[i], options[j]] = [options[j], options[i]];
      }

      cur = { start, sum, answer: ans, options };
      exprEl.textContent = `${start} + ? = ${sum}`;

      optBtns.forEach((btn, i) => {
        const val = cur.options[i];
        btn.textContent = String(val);
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === cur.answer) {
            streak++;
            const gained = Math.round(((tipUsed ? 8 : 12) + Math.min(18, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(stage, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const info = `${start} + ${ans} = ${sum}`;
            dealPairSum(curCfg.rangeFactor);
            learnBar.setMessage(`✓ ${info} (+${gained} Pkt)`, 'good');
          } else {
            const info = `${start} + ${ans} = ${sum}`;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ ${val} passt nicht – ${info}.`, 'learn');
            dealPairSum(curCfg.rangeFactor);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'pair-sum',
      baseSec: 30,
      statusEl: status,
      onStartRound(cfg) {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        dealPairSum(cfg.rangeFactor);
        learnBar.setMessage('Finde die fehlende Zahl bis zur Zielsumme.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'pair-sum');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    dealPairSum(1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

registerGame({
  id: 'opposite-blitz',
  title: 'Gegensatz-Blitz',
  icon: '↔️',
  cat: 'Wörter',
  desc: 'Finde das passende Gegenteil zum Begriff – mit Zen/Sprint, Tipp & Lern-Feedback.',
  run({ body, status }) {
    const rt = makeRuntime();
    const pairs = [
      { word: 'HELL', opp: 'DUNKEL', others: ['LAUT', 'SCHWER', 'BREIT'], fact: 'Gegenteil von HELL ist DUNKEL.' },
      { word: 'SCHNELL', opp: 'LANGSAM', others: ['KALT', 'TIEF', 'LEER'], fact: 'Gegenteil von SCHNELL ist LANGSAM.' },
      { word: 'LEICHT', opp: 'SCHWER', others: ['HOCH', 'FRÜH', 'NEU'], fact: 'Gegenteil von LEICHT ist SCHWER.' },
      { word: 'ALT', opp: 'NEU', others: ['WEIT', 'HART', 'LAUT'], fact: 'Gegenteil von ALT ist NEU.' },
      { word: 'VOLL', opp: 'LEER', others: ['KURZ', 'WARM', 'SÜSS'], fact: 'Gegenteil von VOLL ist LEER.' },
      { word: 'HOCH', opp: 'TIEF', others: ['DÜNN', 'SPÄT', 'RUHIG'], fact: 'Gegenteil von HOCH ist TIEF.' }
    ];

    let score = 0;
    let streak = 0;
    let tipsLeft = 3;
    let tipUsed = false;
    let cur = pairs[0];
    let opts = [];

    const wrap = $('div', 'sz-pbk-wrap');
    wrap.setAttribute('data-genre', 'word');

    const top = $('div', 'sz-pbk-top');
    const pills = $('div', 'sz-sc-badges');
    const timePill = $('span', 'sz-sc-pill', '⏱ 25s');
    const scorePill = $('span', 'sz-sc-pill', '↔️ 0 Pkt');
    const bestPill = $('span', 'sz-sc-pill', '');
    pills.append(timePill, scorePill, bestPill);

    const startBtn = $('button', 'sz-btn sz-btn-primary', '▶ Start');
    startBtn.type = 'button';
    top.append(pills, startBtn);

    const banner = $('div', 'sz-word-banner');
    const titleEl = $('div', 'sz-word-main', '');
    const subEl = $('div', 'sz-word-sub', 'Wähle das passende Gegenteil');
    banner.append(titleEl, subEl);

    const grid = $('div', 'sz-pbk-grid');
    const optBtns = Array.from({ length: 4 }, () => {
      const b = $('button', 'sz-pbk-btn', '');
      b.type = 'button';
      grid.append(b);
      return b;
    });

    const learnBar = createLearnBar({
      initialText: 'Tipp nennt den Anfangsbuchstaben des Gegenteils.',
      onTip: () => {
        if (!runner.isPlaying() || runner.isPaused() || tipUsed || tipsLeft <= 0) return;
        const wrong = optBtns.find((b) => !b.disabled && b.textContent !== cur.opp);
        if (wrong) {
          wrong.disabled = true;
          wrong.style.opacity = '0.28';
        }
        tipUsed = true;
        tipsLeft--;
        learnBar.setMessage(`Tipp: Das Gegenteil beginnt mit „${cur.opp[0]}“.`, 'learn');
        learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: true });
      }
    });

    const syncHud = () => {
      const cfg = runner.getConfig();
      const best = getGameRecord('opposite-blitz', cfg.profileKey).best || 0;
      timePill.classList.toggle('sz-zen-pill', cfg.isZen);
      timePill.textContent = cfg.isZen ? '🧘 Zen' : `⏱ ${Math.ceil(runner.getTimeLeft())}s`;
      scorePill.textContent = `↔️ ${score} Pkt`;
      bestPill.textContent = `🏆 Rekord: ${best}`;
      startBtn.textContent = runner.isPlaying() && cfg.isZen ? '■ Beenden' : '▶ Start';
    };

    const nextOpp = (prev = null) => {
      const pool = pairs.filter((p) => p.word !== prev);
      cur = (pool.length ? pool : pairs)[R((pool.length ? pool : pairs).length)];
      tipUsed = false;
      optBtns.forEach((b) => { b.style.opacity = ''; });
      learnBar.setTipState({ label: `💡 Tipp (${tipsLeft})`, disabled: !runner.isPlaying() || tipsLeft <= 0 });

      titleEl.textContent = `Gegenteil von „${cur.word}“`;
      const list = [cur.opp, ...cur.others.slice(0, 3)];
      for (let i = list.length - 1; i > 0; i--) {
        const j = R(i + 1);
        [list[i], list[j]] = [list[j], list[i]];
      }
      opts = list;

      optBtns.forEach((btn, i) => {
        const val = opts[i];
        btn.textContent = val;
        btn.disabled = !runner.isPlaying() || runner.isPaused();
        btn.onclick = () => {
          const curCfg = runner.getConfig();
          if (!runner.isPlaying() || runner.isPaused()) return;
          if (val === cur.opp) {
            streak++;
            const gained = Math.round(((tipUsed ? 8 : 12) + Math.min(18, streak * 2)) * curCfg.scoreMult);
            score += gained;
            szSfx.hit(streak);
            pulseSafe(banner, 'pop');
            spawnScorePopup(btn, streak >= 3 ? `+${gained} · ${streak}×` : `+${gained}`, { hot: streak >= 3, rt });
            const fact = cur.fact;
            const prevWord = cur.word;
            nextOpp(prevWord);
            learnBar.setMessage(`✓ ${fact} (+${gained} Pkt)`, 'good');
          } else {
            const fact = cur.fact;
            const prevWord = cur.word;
            streak = 0;
            szSfx.miss();
            pulseSafe(grid, 'shake');
            learnBar.setMessage(`✕ „${val}“ passt nicht – ${fact}`, 'learn');
            nextOpp(prevWord);
          }
          syncHud();
        };
      });
    };

    const runner = createRoundRunner({
      rt,
      gameId: 'opposite-blitz',
      baseSec: 25,
      statusEl: status,
      onStartRound() {
        score = 0;
        streak = 0;
        tipsLeft = 3;
        nextOpp(null);
        learnBar.setMessage('Finde das passende Gegenteil.', 'neutral');
        syncHud();
      },
      onFinishRound() {
        optBtns.forEach((b) => { b.disabled = true; });
        syncHud();
      },
      onPauseChange(isPaused) {
        optBtns.forEach((b) => { b.disabled = isPaused || !runner.isPlaying(); });
      },
      onPickIndex(idx) {
        const b = optBtns[idx];
        if (b && !b.disabled) {
          pulseSafe(b, 'pop');
          b.click();
        }
      },
      onNextGame: () => {
        if (typeof openGame === 'function') {
          const others = SZ_GAMES.filter((g) => g.id !== 'opposite-blitz');
          if (others.length) openGame(others[R(others.length)].id);
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) runner.finish({ score, streak });
      else runner.start();
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, banner, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    nextOpp(null);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

renderShell();
