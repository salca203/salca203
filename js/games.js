// ==========================================
// SPIELEZIMMER – SHARED BAUSTEINE & SPIELE
// ==========================================

function prefersReducedMotion() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function pulseSafe(el, type = 'pop') {
  if (!el || prefersReducedMotion()) return;
  pulseEl(el, type);
}

function spawnScorePopup(anchorEl, text, { hot = false, rt = null } = {}) {
  if (!anchorEl || prefersReducedMotion() || typeof anchorEl.getBoundingClientRect !== 'function') return;
  const rect = anchorEl.getBoundingClientRect();
  if (!rect.width && !rect.height) return;

  const badge = $('div', 'sz-score-popup' + (hot ? ' streak-hot' : ''), text);
  badge.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
  badge.style.top = `${Math.max(16, Math.round(rect.top + 6))}px`;
  document.body.append(badge);

  const removeBadge = () => {
    if (badge.isConnected) badge.remove();
  };
  if (rt && typeof rt.later === 'function') rt.later(removeBadge, 680);
  else setTimeout(removeBadge, 680);
}

function annotateColorBlindMarker(el, markerText) {
  if (!el || !markerText) return;
  const existing = el.querySelector('.sz-cb-tag');
  if (szState.colorblind === 'off') {
    if (existing) existing.remove();
    return;
  }
  if (!existing) {
    el.append($('span', 'sz-cb-tag', markerText));
  } else {
    existing.textContent = markerText;
  }
}

function createColorBlindProfileControl(onChange = null) {
  const box = $('div', 'sz-cb-bar');
  const lbl = $('span', 'sz-cb-label', '👁 Farbenblind-Modus:');
  const group = $('div', 'sz-mode-group');

  const modes = [
    { id: 'off', label: 'Aus' },
    { id: 'rg',  label: 'Rot/Grün-Schutz' },
    { id: 'by',  label: 'Blau/Gelb-Schutz' }
  ];

  const btns = modes.map((m) => {
    const btn = $('button', 'sz-mode-chip' + (m.id === szState.colorblind ? ' active' : ''), m.label);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(m.id === szState.colorblind));
    btn.onclick = () => {
      if (m.id === szState.colorblind) return;
      const applied = applyColorBlindMode(m.id);
      szSfx.click();
      btns.forEach((b, idx) => {
        const active = modes[idx].id === applied;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      if (typeof onChange === 'function') onChange(applied);
    };
    group.append(btn);
    return btn;
  });

  box.append(lbl, group);
  return { el: box, getMode: () => szState.colorblind };
}

function createLearnBar({ onTip, initialText = 'Bereit – nutze bei Bedarf einen Tipp.' }) {
  const bar = $('div', 'sz-learn-bar');
  const textEl = $('div', 'sz-learn-text', initialText);
  const tipBtn = $('button', 'sz-tip-btn', '💡 Tipp');
  tipBtn.type = 'button';

  tipBtn.onclick = () => {
    if (tipBtn.disabled) return;
    szSfx.click();
    if (typeof onTip === 'function') onTip();
  };

  bar.append(textEl, tipBtn);
  return {
    el: bar,
    setMessage(msg, tone = 'neutral') {
      textEl.textContent = msg;
      textEl.classList.remove('is-good', 'is-learn');
      if (tone === 'good') textEl.classList.add('is-good');
      if (tone === 'learn') textEl.classList.add('is-learn');
    },
    setTipState({ label = '💡 Tipp', disabled = false } = {}) {
      tipBtn.textContent = label;
      tipBtn.disabled = Boolean(disabled);
    }
  };
}

const SZ_DIFFS = {
  easy:   { id: 'easy',   label: 'Entspannt', timeFactor: 1.2,  rangeFactor: 0.75, scoreMult: 0.85 },
  normal: { id: 'normal', label: 'Standard',  timeFactor: 1.0,  rangeFactor: 1.0,  scoreMult: 1.0  },
  hard:   { id: 'hard',   label: 'Turbo',     timeFactor: 0.82, rangeFactor: 1.35, scoreMult: 1.25 }
};

function buildModeConfig(gameId, baseSec, pace, diff) {
  const d = SZ_DIFFS[diff] || SZ_DIFFS.normal;
  const isZen = pace === 'zen';
  const durationSec = isZen ? null : Math.max(12, Math.round(baseSec * d.timeFactor));
  return {
    gameId,
    pace: isZen ? 'zen' : 'sprint',
    isZen,
    diff: d.id,
    diffLabel: d.label,
    durationSec,
    rangeFactor: d.rangeFactor,
    scoreMult: d.scoreMult,
    profileKey: `${pace}__${d.id}`,
    summary: isZen ? `🧘 Zen · ${d.label}` : `⏱ ${durationSec}s · ${d.label}`
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
  if (statusEl) {
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.setAttribute('aria-atomic', 'true');
  }

  let pace = 'sprint';
  let diff = 'normal';
  let cfg = buildModeConfig(gameId, baseSec, pace, diff);
  let timeLeft = cfg.durationSec || baseSec;
  let playing = false;
  let paused = false;
  let rafId = null;
  let lastTs = 0;
  let lastSecTick = null;

  const stopRaf = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastTs = 0;
  };

  const modeBar = $('div', 'sz-mode-bar');
  const paceGroup = $('div', 'sz-mode-group');
  const diffGroup = $('div', 'sz-mode-group');

  const sprintBtn = $('button', 'sz-mode-chip', '⏱ Sprint');
  const zenBtn = $('button', 'sz-mode-chip zen', '🧘 Zen');
  sprintBtn.type = 'button';
  zenBtn.type = 'button';
  paceGroup.append(sprintBtn, zenBtn);

  const diffBtns = Object.values(SZ_DIFFS).map((d) => {
    const b = $('button', 'sz-mode-chip', d.label);
    b.type = 'button';
    b.dataset.diff = d.id;
    diffGroup.append(b);
    return b;
  });
  modeBar.append(paceGroup, diffGroup);

  const tbarTrack = $('div', 'sz-tbar-track');
  const tbarFill = $('div', 'sz-tbar-fill');
  tbarTrack.append(tbarFill);

  const setTimeRatio = (ratio, urgent = false) => {
    const c = Math.max(0, Math.min(1, ratio));
    tbarFill.style.transform = `scaleX(${c})`;
    tbarFill.classList.toggle('urgent', Boolean(urgent));
  };

  const pauseBox = $('div', 'sz-pause-box');
  pauseBox.style.display = 'none';
  const pauseTitle = $('div', 'sz-pause-title', '⏸ Spiel pausiert');
  const pauseSub = $('div', 'sz-pause-sub', 'Esc oder Enter zum Fortsetzen');
  const resumeBtn = $('button', 'sz-btn sz-btn-primary', '▶ Weiter');
  resumeBtn.type = 'button';
  pauseBox.append(pauseTitle, pauseSub, resumeBtn);

  const resultBox = $('div', 'sz-result-overlay');
  resultBox.style.display = 'none';
  const resBadge = $('div', 'sz-result-badge', '🏆 NEUER REKORD');
  const resScore = $('div', 'sz-result-score', '');
  const resMeta = $('div', 'sz-result-meta', '');
  const resActions = $('div', 'sz-result-actions');
  const replayBtn = $('button', 'sz-btn sz-btn-primary', '↻ Nochmal spielen');
  replayBtn.type = 'button';
  resActions.append(replayBtn);

  if (typeof onNextGame === 'function') {
    const nextBtn = $('button', 'sz-btn sz-btn-ghost', '⏭ Nächstes Spiel');
    nextBtn.type = 'button';
    nextBtn.onclick = () => {
      szSfx.click();
      onNextGame();
    };
    resActions.append(nextBtn);
  }
  resultBox.append(resBadge, resScore, resMeta, resActions);

  const syncModeChips = () => {
    sprintBtn.classList.toggle('active', pace === 'sprint');
    zenBtn.classList.toggle('active', pace === 'zen');
    diffBtns.forEach((b) => b.classList.toggle('active', b.dataset.diff === diff));
  };

  const setModeControlsDisabled = (disabled) => {
    [sprintBtn, zenBtn, ...diffBtns].forEach((b) => {
      b.disabled = Boolean(disabled);
    });
  };

  const refreshConfigPreview = () => {
    cfg = buildModeConfig(gameId, baseSec, pace, diff);
    timeLeft = cfg.durationSec || baseSec;
    setTimeRatio(1, false);
    syncModeChips();
  };

  sprintBtn.onclick = () => {
    if (playing || pace === 'sprint') return;
    szSfx.click();
    pace = 'sprint';
    refreshConfigPreview();
    if (statusEl) statusEl.textContent = `Modus: ${cfg.summary}`;
  };

  zenBtn.onclick = () => {
    if (playing || pace === 'zen') return;
    szSfx.click();
    pace = 'zen';
    refreshConfigPreview();
    if (statusEl) statusEl.textContent = `Modus: ${cfg.summary}`;
  };

  diffBtns.forEach((b) => {
    b.onclick = () => {
      if (playing || b.dataset.diff === diff) return;
      szSfx.click();
      diff = b.dataset.diff;
      refreshConfigPreview();
      if (statusEl) statusEl.textContent = `Schwierigkeit: ${cfg.summary}`;
    };
  });

  const finish = ({ score = 0, streak = 0, extraMeta = '' } = {}) => {
    playing = false;
    paused = false;
    stopRaf();
    pauseBox.style.display = 'none';
    setModeControlsDisabled(false);

    const prev = getGameRecord(gameId, cfg.profileKey);
    const prevBest = prev.best || 0;
    const isNewRecord = score > 0 && score > prevBest;
    const nextBest = isNewRecord ? score : prevBest;

    saveGameRecord(gameId, cfg.profileKey, { best: nextBest, played: true });

    if (isNewRecord) szSfx.record();
    else szSfx.gameover();

    resBadge.style.display = isNewRecord ? 'inline-flex' : 'none';
    resScore.textContent = `${score} Punkte`;
    const parts = [cfg.summary, `Serie: ${streak}`, `Rekord: ${nextBest}`];
    if (extraMeta) parts.push(extraMeta);
    resMeta.textContent = parts.join(' · ');
    resultBox.style.display = 'flex';

    if (typeof onFinishRound === 'function') {
      onFinishRound({ score, streak, best: nextBest, isNewRecord, cfg });
    }
    if (statusEl) {
      statusEl.textContent = `🏁 Runde beendet: ${score} Punkte (Rekord: ${nextBest})`;
    }
  };

  const stepFrame = (ts) => {
    if (!playing || paused || cfg.isZen) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;

    timeLeft = Math.max(0, timeLeft - dt);
    const ceilSec = Math.ceil(timeLeft);
    if (ceilSec !== lastSecTick && ceilSec > 0 && ceilSec <= 3) {
      lastSecTick = ceilSec;
      szSfx.tick(true);
    }

    setTimeRatio(timeLeft / cfg.durationSec, timeLeft <= 5);
    if (timeLeft <= 0) {
      finish({ score: 0, streak: 0 });
      return;
    }
    rafId = requestAnimationFrame(stepFrame);
  };

  const togglePause = (reason = null) => {
    if (!playing || cfg.isZen) return;
    paused = !paused;
    if (paused) {
      stopRaf();
      pauseSub.textContent = reason || 'Esc oder Enter zum Fortsetzen';
      pauseBox.style.display = 'flex';
      if (typeof onPauseChange === 'function') onPauseChange(true);
      if (statusEl) statusEl.textContent = '⏸ Spiel pausiert';
    } else {
      pauseBox.style.display = 'none';
      lastTs = 0;
      if (typeof onPauseChange === 'function') onPauseChange(false);
      if (statusEl) statusEl.textContent = '▶ Weiter geht’s!';
      rafId = requestAnimationFrame(stepFrame);
    }
  };

  const start = () => {
    stopRaf();
    resultBox.style.display = 'none';
    pauseBox.style.display = 'none';
    cfg = buildModeConfig(gameId, baseSec, pace, diff);
    timeLeft = cfg.durationSec || baseSec;
    lastSecTick = null;
    playing = true;
    paused = false;
    setTimeRatio(1, false);
    setModeControlsDisabled(true);

    if (typeof onStartRound === 'function') onStartRound(cfg);
    if (!cfg.isZen) rafId = requestAnimationFrame(stepFrame);
  };

  resumeBtn.onclick = () => {
    szSfx.click();
    togglePause();
  };
  replayBtn.onclick = () => {
    szSfx.click();
    start();
  };

  const onKeyDown = (e) => {
    if (e.repeat) return;
    const tag = document.activeElement?.tagName?.toLowerCase();
    const inField = tag === 'input' || tag === 'textarea';

    if (e.key === 'Escape' && playing) {
      e.preventDefault();
      togglePause();
      return;
    }
    if (e.key === 'Enter' && !inField) {
      if (paused) {
        e.preventDefault();
        togglePause();
      } else if (!playing) {
        e.preventDefault();
        szSfx.click();
        start();
      }
      return;
    }
    if (!inField && playing && !paused && typeof onPickIndex === 'function') {
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx !== -1) {
        e.preventDefault();
        onPickIndex(idx);
      }
    }
  };

  const onVisChange = () => {
    if (document.hidden && playing && !paused && !cfg.isZen) {
      togglePause('Automatisch pausiert beim Tab-Wechsel');
    }
  };

  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisChange);

  const prevCleanup = rt.cleanup;
  rt.cleanup = () => {
    stopRaf();
    window.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('visibilitychange', onVisChange);
    prevCleanup();
  };

  syncModeChips();
  setTimeRatio(1, false);

  return {
    modeBar,
    timeBar: tbarTrack,
    pauseBox,
    resultBox,
    getConfig: () => cfg,
    getTimeLeft: () => timeLeft,
    isPlaying: () => playing,
    isPaused: () => paused,
    start,
    finish,
    togglePause,
    setTimeRatio
  };
}

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
          if (others.length) {
            const pick = others[R(others.length)];
            openGame(pick.id);
          }
        }
      }
    });

    startBtn.onclick = () => {
      szSfx.click();
      if (runner.isPlaying() && runner.getConfig().isZen) {
        runner.finish({ score, streak });
      } else {
        runner.start();
      }
    };

    wrap.append(top, runner.modeBar, runner.timeBar, runner.pauseBox, stage, grid, learnBar.el, runner.resultBox);
    body.append(wrap);
    nextTask(0, 1);
    syncHud();
    status.textContent = 'Klicke „Start“ oder drücke Enter';
  }
});

renderShell();
