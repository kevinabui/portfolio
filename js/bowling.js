/* ── Bowling Analytics · Kevin Bui ──────────────────────────────────────── */

const STORAGE_KEY = 'kevin_bowling_v1';

// ── Persistence ───────────────────────────────────────────────────────────
function loadData() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : { sessions: [] };
  } catch { return { sessions: [] }; }
}
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ── Flatten games from all sessions ──────────────────────────────────────
function allGames(data) {
  const games = [];
  data.sessions.forEach(s => {
    s.games.forEach((g, gi) => {
      games.push({ ...g, date: s.date, location: s.location, sessionId: s.id, gameNum: gi + 1 });
    });
  });
  return games;
}

// ── Stats ─────────────────────────────────────────────────────────────────
function computeStats(data) {
  const games = allGames(data);
  if (!games.length) return null;

  const recent = games.slice(-15);

  const allScratches    = games.map(g => g.scratch).filter(Boolean);
  const totalStrikes    = games.reduce((a, g) => a + (g.strikes || 0), 0);
  const totalSpares     = games.reduce((a, g) => a + (g.spares || 0), 0);
  const totalOpens      = games.reduce((a, g) => a + (g.openFrames || 0), 0);

  const recentScratches = recent.map(g => g.scratch).filter(Boolean);
  const recentStrikes   = recent.reduce((a, g) => a + (g.strikes || 0), 0);
  const recentSpares    = recent.reduce((a, g) => a + (g.spares || 0), 0);
  const recentSpeeds    = recent.map(g => g.firstBallSpeed).filter(Boolean);

  return {
    games,
    avgScore:    recentScratches.length ? Math.round(recentScratches.reduce((a, b) => a + b, 0) / recentScratches.length) : '--',
    highGame:    allScratches.length ? Math.max(...allScratches) : '--',
    avgStrikes:  (recentStrikes / recent.length).toFixed(1),
    avgSpares:   (recentSpares  / recent.length).toFixed(1),
    avgSpeed:    recentSpeeds.length ? (recentSpeeds.reduce((a, b) => a + b, 0) / recentSpeeds.length).toFixed(1) : '--',
    totalGames:  games.length,
    recentCount: recent.length,
    totalStrikes, totalSpares, totalOpens,
  };
}

// ── Rolling average ───────────────────────────────────────────────────────
function rollingAvg(arr, w = 3) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1);
    return +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(1);
  });
}

// ── Chart instances (so we can destroy on re-render) ─────────────────────
const charts = {};
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ── Render charts ─────────────────────────────────────────────────────────
function renderCharts(stats) {
  const games     = stats.games;
  const labels    = games.map((_, i) => `G${i + 1}`);
  const scratches = games.map(g => g.scratch || null);
  const validScr  = scratches.filter(Boolean);
  const highGame  = validScr.length ? Math.max(...validScr) : 0;
  const seasonAvg = validScr.length
    ? Math.round(validScr.reduce((a, b) => a + b, 0) / validScr.length) : 0;

  // ── 1. Score Over Time: PB + season avg + colored rolling avg ────────────
  destroyChart('score');
  charts['score'] = new Chart(document.getElementById('scoreChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Scratch',
          data: scratches,
          borderColor: '#0369a1',
          backgroundColor: 'rgba(3,105,161,.07)',
          borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#0369a1',
          tension: 0.3, fill: true, order: 2,
        },
        {
          label: '3-Game Avg',
          data: rollingAvg(validScr),
          borderWidth: 2.5, pointRadius: 0, tension: 0.4,
          fill: false, order: 1,
          segment: { borderColor: ctx => ctx.p1.parsed.y >= seasonAvg ? '#10b981' : '#f97316' },
        },
        {
          label: `PB · ${highGame}`,
          data: new Array(labels.length).fill(highGame),
          borderColor: 'rgba(251,191,36,.65)', borderWidth: 1.5,
          borderDash: [6, 4], pointRadius: 0, fill: false, order: 3,
        },
        {
          label: `Avg · ${seasonAvg}`,
          data: new Array(labels.length).fill(seasonAvg),
          borderColor: 'rgba(148,163,184,.45)', borderWidth: 1,
          borderDash: [3, 3], pointRadius: 0, fill: false, order: 4,
        },
      ],
    },
    options: chartOptions({ yMin: 60, unit: '' }),
  });

  // ── 2. Strike Rate % ─────────────────────────────────────────────────────
  destroyChart('strikeRate');
  const strikeRates = games.map(g => g.strikes != null ? +(g.strikes / 12 * 100).toFixed(1) : null);
  const validSR     = strikeRates.filter(Boolean);
  charts['strikeRate'] = new Chart(document.getElementById('strikeRateChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Strike %',
          data: strikeRates,
          borderColor: '#0369a1', backgroundColor: 'rgba(3,105,161,.07)',
          borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#0369a1',
          tension: 0.3, fill: true,
        },
        {
          label: '3-Game Avg',
          data: validSR.length ? rollingAvg(validSR) : [],
          borderColor: '#f97316', borderWidth: 2, borderDash: [5, 4],
          pointRadius: 0, tension: 0.4, fill: false,
        },
      ],
    },
    options: chartOptions({ yMin: 0, yMax: 100, unit: '%' }),
  });

  // ── 3. Score Distribution histogram ──────────────────────────────────────
  destroyChart('dist');
  const buckets    = ['<120', '120–139', '140–159', '160–179', '180–199', '200–219', '220–239', '240+'];
  const counts     = new Array(8).fill(0);
  const distColors = ['#94a3b8','#64748b','#f97316','#eab308','#22c55e','#10b981','#0369a1','#7c3aed'];
  validScr.forEach(s => {
    if      (s < 120) counts[0]++;
    else if (s < 140) counts[1]++;
    else if (s < 160) counts[2]++;
    else if (s < 180) counts[3]++;
    else if (s < 200) counts[4]++;
    else if (s < 220) counts[5]++;
    else if (s < 240) counts[6]++;
    else              counts[7]++;
  });
  charts['dist'] = new Chart(document.getElementById('distChart'), {
    type: 'bar',
    data: {
      labels: buckets,
      datasets: [{
        label: 'Games',
        data: counts,
        backgroundColor: distColors.map(c => c + 'bb'),
        borderColor: distColors,
        borderWidth: 1.5,
        borderRadius: 5,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw} game${ctx.raw !== 1 ? 's' : ''}` } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1, font: { family: 'Fira Code', size: 11 } }, grid: { color: 'rgba(15,23,42,.05)' } },
        x: { grid: { display: false }, ticks: { font: { family: 'Fira Code', size: 10 } } },
      },
    },
  });

  // ── 4. Ball Speed ─────────────────────────────────────────────────────────
  destroyChart('speed');
  charts['speed'] = new Chart(document.getElementById('speedChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '1st Ball',
          data: games.map(g => g.firstBallSpeed || null),
          borderColor: '#0369a1', backgroundColor: 'rgba(3,105,161,.07)',
          borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#0369a1',
          tension: 0.3, fill: true,
        },
        {
          label: '2nd Ball',
          data: games.map(g => g.secondBallSpeed || null),
          borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.07)',
          borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#10b981',
          tension: 0.3, fill: true,
        },
      ],
    },
    options: chartOptions({ yMin: 0, unit: ' mph' }),
  });

  // ── 5. By Location (only when multiple alleys logged) ────────────────────
  destroyChart('location');
  const locMap = {};
  games.forEach(g => {
    const loc = g.location || 'Unknown';
    if (!locMap[loc]) locMap[loc] = [];
    if (g.scratch) locMap[loc].push(g.scratch);
  });
  const locKeys = Object.keys(locMap);
  const locRow  = document.getElementById('location-row');
  if (locKeys.length > 1 && locRow) {
    locRow.style.display = '';
    const locLabels = locKeys.map(k => k.length > 22 ? k.slice(0, 21) + '…' : k);
    const locAvgs   = locKeys.map(k => {
      const arr = locMap[k];
      return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    });
    const locCounts = locKeys.map(k => locMap[k].length);
    const locOpts   = chartOptions({ yMin: 60, unit: '' });
    locOpts.plugins.tooltip = {
      callbacks: { label: ctx => ` Avg ${ctx.raw} · ${locCounts[ctx.dataIndex]} games` },
    };
    charts['location'] = new Chart(document.getElementById('locationChart'), {
      type: 'bar',
      data: {
        labels: locLabels,
        datasets: [{
          label: 'Avg Score', data: locAvgs,
          backgroundColor: 'rgba(3,105,161,.70)', borderColor: '#0369a1',
          borderWidth: 1.5, borderRadius: 6,
        }],
      },
      options: locOpts,
    });
  } else if (locRow) {
    locRow.style.display = 'none';
  }

  // ── 6. Pin Diagram ────────────────────────────────────────────────────────
  renderPinDiagram(stats);
}

// ── 10-Pin Diagram ────────────────────────────────────────────────────────
function renderPinDiagram(stats) {
  const el     = document.getElementById('pinDiagram');
  const legend = document.getElementById('pinLegend');
  if (!el) return;

  const strikes = Math.round(parseFloat(stats.avgStrikes));
  const spares  = Math.round(parseFloat(stats.avgSpares));
  const opens   = Math.max(0, 10 - strikes - spares);

  const colors = [];
  let s = strikes, sp = spares;
  for (let i = 0; i < 10; i++) {
    if (s > 0)       { colors.push('strike'); s--; }
    else if (sp > 0) { colors.push('spare');  sp--; }
    else             { colors.push('open'); }
  }

  el.innerHTML = colors.map((c, i) =>
    `<span class="pd-pin pd-${c}" title="Pin ${i + 1}"></span>`
  ).join('');

  legend.innerHTML = `
    <span class="pd-legend-item"><span class="pd-dot pd-strike"></span> ~${strikes} strikes/game</span>
    <span class="pd-legend-item"><span class="pd-dot pd-spare"></span> ~${spares} spares/game</span>
    <span class="pd-legend-item"><span class="pd-dot pd-open"></span> ~${opens} opens/game</span>
  `;
}

function chartOptions({ yMin = 0, yMax, unit = '' }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, boxWidth: 14 } },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}${unit}` },
      },
    },
    scales: {
      y: {
        min: yMin,
        ...(yMax ? { max: yMax } : {}),
        grid: { color: 'rgba(15,23,42,.05)' },
        ticks: { font: { family: 'Fira Code', size: 11 } },
      },
      x: { grid: { display: false }, ticks: { font: { family: 'Fira Code', size: 11 } } },
    },
  };
}

// ── Render history ────────────────────────────────────────────────────────
function renderHistory(data) {
  const el = document.getElementById('history-list');
  el.innerHTML = '';

  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const locationLabel = loc => loc.toLowerCase().includes('husky') ? `🐾 ${loc}` : loc;
  const allHighGame = Math.max(...data.sessions.flatMap(s => s.games.map(g => g.scratch || 0)));

  [...data.sessions].reverse().forEach((session, idx) => {
    const isFirst   = idx === 0;
    const isUW      = session.location.toLowerCase().includes('husky');
    const scratches = session.games.map(g => g.scratch || 0);
    const avgScratch = session.games.filter(g => g.scratch).length
      ? Math.round(session.games.reduce((a, g) => a + (g.scratch || 0), 0) / session.games.filter(g => g.scratch).length)
      : null;
    const isPB = allHighGame > 0 && Math.max(...scratches) === allHighGame;

    const card = document.createElement('div');
    card.className = 'session-card' + (isFirst ? ' session-open' : ' session-collapsed') + (isUW ? ' session-uw' : '');

    card.innerHTML = `
      <div class="session-header session-toggle">
        <div class="session-meta">
          <span class="session-date">${fmt(session.date)}</span>
          <span class="session-location">${locationLabel(session.location)}</span>
        </div>
        <div class="session-header-right">
          ${isPB ? `<span class="pb-badge">🏆 PB</span>` : ''}
          ${avgScratch != null ? `<span class="session-avg">avg ${avgScratch}</span>` : ''}
          <span class="session-chevron">${isFirst ? '▲' : '▼'}</span>
          <button class="delete-session-btn" data-id="${session.id}">Delete</button>
        </div>
      </div>
      <div class="session-body">
        ${session.games.map((g, i) => `
          <div class="game-row">
            <div class="game-row-label">Game ${i + 1}</div>
            <div class="game-stats-grid">
              <div class="game-stat">
                <span class="game-stat-label">Scratch</span>
                <span class="game-stat-val highlight">${g.scratch ?? '--'}</span>
              </div>
              <div class="game-stat">
                <span class="game-stat-label">Strikes</span>
                <span class="game-stat-val">${g.strikes ?? '--'}</span>
              </div>
              <div class="game-stat">
                <span class="game-stat-label">Spares</span>
                <span class="game-stat-val">${g.spares ?? '--'}</span>
              </div>
              <div class="game-stat">
                <span class="game-stat-label">Opens</span>
                <span class="game-stat-val">${g.openFrames ?? '--'}</span>
              </div>
              <div class="game-stat">
                <span class="game-stat-label">Gutters</span>
                <span class="game-stat-val">${g.gutters ?? '--'}</span>
              </div>
              <div class="game-stat">
                <span class="game-stat-label">1st Speed</span>
                <span class="game-stat-val">${g.firstBallSpeed != null ? g.firstBallSpeed + ' mph' : '--'}</span>
              </div>
              <div class="game-stat">
                <span class="game-stat-label">2nd Speed</span>
                <span class="game-stat-val">${g.secondBallSpeed != null ? g.secondBallSpeed + ' mph' : '--'}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    card.querySelector('.session-toggle').addEventListener('click', e => {
      if (e.target.closest('.delete-session-btn')) return;
      const open = card.classList.toggle('session-open');
      card.classList.toggle('session-collapsed', !open);
      card.querySelector('.session-chevron').textContent = open ? '▲' : '▼';
    });

    card.querySelector('.delete-session-btn').addEventListener('click', () => {
      if (!confirm('Delete this session?')) return;
      data.sessions = data.sessions.filter(s => s.id !== session.id);
      saveData(data);
      renderAll(data);
    });

    el.appendChild(card);
  });
}

// ── Show/hide data-dependent sections ────────────────────────────────────
function renderAll(data) {
  const stats   = computeStats(data);
  const hasData = !!stats;

  document.getElementById('charts-section').style.display  = hasData ? '' : 'none';
  document.getElementById('history-section').style.display = hasData ? '' : 'none';

  if (hasData) {
    const windowLabel = `last ${stats.recentCount} game${stats.recentCount !== 1 ? 's' : ''}`;
    document.getElementById('stat-avg').textContent    = stats.avgScore;
    document.getElementById('stat-high').textContent   = stats.highGame;
    document.getElementById('stat-strikes').textContent = stats.avgStrikes;
    document.getElementById('stat-spares').textContent  = stats.avgSpares;
    document.getElementById('stat-speed').textContent   = stats.avgSpeed !== '--' ? stats.avgSpeed + ' mph' : '--';
    document.getElementById('stat-games').textContent   = stats.totalGames;
    ['stat-avg-window', 'stat-strikes-window', 'stat-spares-window', 'stat-speed-window'].forEach(id => {
      document.getElementById(id).textContent = windowLabel;
    });
    renderCharts(stats);
    renderHistory(data);
    initReveal();
    animateStats(stats);
    // bounce pins after diagram renders
    requestAnimationFrame(() => {
      document.querySelectorAll('.pd-pin').forEach((pin, i) => {
        pin.style.animation = `pinBounce .45s ${i * 45}ms ease-out`;
        pin.addEventListener('animationend', () => { pin.style.animation = ''; }, { once: true });
      });
    });
  } else {
    document.getElementById('stat-avg').textContent     = '--';
    document.getElementById('stat-high').textContent    = '--';
    document.getElementById('stat-strikes').textContent = '--';
    document.getElementById('stat-spares').textContent  = '--';
    document.getElementById('stat-speed').textContent   = '--';
    document.getElementById('stat-games').textContent   = '0';
  }
}

// ── Log Form ──────────────────────────────────────────────────────────────
function initLogForm(data) {
  const form      = document.getElementById('log-form');
  const gamesList = document.getElementById('games-list');
  let gameCount   = 0;

  document.getElementById('log-date').valueAsDate = new Date();

  function addGame() {
    gameCount++;
    const idx = gameCount;
    const div = document.createElement('div');
    div.className = 'game-entry';
    div.dataset.game = idx;
    div.innerHTML = `
      <div class="game-entry-header">
        <span class="game-entry-label">Game ${idx}</span>
        ${idx > 1 ? `<button type="button" class="remove-game-btn" title="Remove">×</button>` : ''}
      </div>
      <div class="game-fields">
        <div class="form-group">
          <label>Scratch</label>
          <input type="number" name="scratch" min="0" max="300" placeholder="0 – 300" />
        </div>
        <div class="form-group">
          <label>Open Frames <span class="label-hint">(auto from strikes/spares)</span></label>
          <input type="number" name="openFrames" min="0" max="10" placeholder="0 – 10" />
        </div>
        <div class="form-group">
          <label>Spares</label>
          <input type="number" name="spares" min="0" max="10" placeholder="0 – 10" />
        </div>
        <div class="form-group">
          <label>Strikes</label>
          <input type="number" name="strikes" min="0" max="12" placeholder="0 – 12" />
        </div>
        <div class="form-group">
          <label>Gutters</label>
          <input type="number" name="gutters" min="0" max="20" placeholder="0 – 20" />
        </div>
        <div class="form-group">
          <label>1st Ball Speed (mph)</label>
          <input type="number" name="firstBallSpeed" step="any" min="0" max="30" placeholder="e.g. 14.2" />
        </div>
        <div class="form-group">
          <label>2nd Ball Speed (mph)</label>
          <input type="number" name="secondBallSpeed" step="any" min="0" max="30" placeholder="e.g. 13.5" />
        </div>
      </div>
    `;
    div.querySelector('.remove-game-btn')?.addEventListener('click', () => div.remove());

    // Auto-calc open frames from strikes + spares
    const strikesEl = div.querySelector('[name=strikes]');
    const sparesEl  = div.querySelector('[name=spares]');
    const opensEl   = div.querySelector('[name=openFrames]');
    function recalcOpens() {
      if (strikesEl.value === '' && sparesEl.value === '') {
        opensEl.value = '';
        opensEl.removeAttribute('readonly');
        opensEl.classList.remove('input-auto');
      } else {
        opensEl.value = Math.max(0, 10 - (parseInt(strikesEl.value) || 0) - (parseInt(sparesEl.value) || 0));
        opensEl.setAttribute('readonly', '');
        opensEl.classList.add('input-auto');
      }
    }
    strikesEl.addEventListener('input', recalcOpens);
    sparesEl.addEventListener('input', recalcOpens);

    gamesList.appendChild(div);
  }

  addGame();
  document.getElementById('add-game-btn').addEventListener('click', addGame);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const date     = document.getElementById('log-date').value;
    const location = document.getElementById('log-location').value.trim();
    if (!date || !location) return;

    const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };

    const games = [...gamesList.querySelectorAll('.game-entry')].map(entry => ({
      scratch:         num(entry.querySelector('[name=scratch]').value),
      openFrames:      num(entry.querySelector('[name=openFrames]').value),
      spares:          num(entry.querySelector('[name=spares]').value),
      strikes:         num(entry.querySelector('[name=strikes]').value),
      gutters:         num(entry.querySelector('[name=gutters]').value),
      firstBallSpeed:  num(entry.querySelector('[name=firstBallSpeed]').value),
      secondBallSpeed: num(entry.querySelector('[name=secondBallSpeed]').value),
    }));

    data.sessions.push({ id: Date.now().toString(), date, location, games });
    saveData(data);
    renderAll(data);

    // Reset form
    form.reset();
    document.getElementById('log-date').valueAsDate = new Date();
    gamesList.innerHTML = '';
    gameCount = 0;
    addGame();

    document.getElementById('history-section').scrollIntoView({ behavior: 'smooth' });
  });
}

// ── Live Scorecard ────────────────────────────────────────────────────────
function maxPossible(state) {
  // Compute the maximum score still achievable given the balls already thrown
  const balls = [];
  state.forEach((f, fi) => {
    if (fi < 9) {
      if (f.balls[0] === 10) balls.push(10);
      else balls.push(...f.balls.filter(b => b != null));
    } else {
      balls.push(...f.balls.filter(b => b != null));
    }
  });

  // Build a "best case" scenario: fill remaining with strikes
  const filled = [...balls];
  while (filled.length < 30) filled.push(10);

  let total = 0, bi = 0;
  for (let f = 0; f < 10; f++) {
    if (f === 9) {
      // 10th frame: sum next 3 balls from filled
      total += (filled[bi] || 0) + (filled[bi + 1] || 0) + (filled[bi + 2] || 0);
      break;
    }
    if (filled[bi] === 10) {
      total += 10 + (filled[bi + 1] || 0) + (filled[bi + 2] || 0);
      bi++;
    } else if ((filled[bi] || 0) + (filled[bi + 1] || 0) === 10) {
      total += 10 + (filled[bi + 2] || 0);
      bi += 2;
    } else {
      total += (filled[bi] || 0) + (filled[bi + 1] || 0);
      bi += 2;
    }
  }
  return Math.min(total, 300);
}

function computeRunningScores(state) {
  const balls = [];
  state.forEach((f, fi) => {
    if (fi < 9 && f.balls[0] === 10) balls.push(10);
    else balls.push(...f.balls.filter(b => b != null));
  });

  const scores = [];
  let bi = 0, running = 0;
  for (let f = 0; f < 10; f++) {
    const fb = state[f].balls.filter(b => b != null);
    if (!fb.length) { scores.push(null); if (f < 9 && state[f].balls[0] === 10) bi++; else bi += fb.length; continue; }

    if (f === 9) {
      running += fb.reduce((a, b) => a + b, 0);
      scores.push(running);
      break;
    }
    if (fb[0] === 10) {
      const b1 = balls[bi + 1], b2 = balls[bi + 2];
      if (b1 == null || b2 == null) { scores.push(null); bi++; continue; }
      running += 10 + b1 + b2;
      scores.push(running);
      bi++;
    } else if (fb.length >= 2 && fb[0] + fb[1] === 10) {
      const next = balls[bi + 2];
      if (next == null) { scores.push(null); bi += 2; continue; }
      running += 10 + next;
      scores.push(running);
      bi += 2;
    } else if (fb.length >= 2) {
      running += fb[0] + fb[1];
      scores.push(running);
      bi += 2;
    } else {
      scores.push(null);
      bi++;
    }
  }
  return scores;
}

function initScorecard() {
  const container = document.getElementById('scorecard');
  const state = Array.from({ length: 10 }, () => ({ balls: [] }));

  function buildUI() {
    container.innerHTML = '';
    for (let f = 0; f < 10; f++) {
      const div = document.createElement('div');
      div.className = 'sc-frame';
      const ballCount = f === 9 ? 3 : 2;

      div.innerHTML = `
        <div class="sc-frame-label">F${f + 1}</div>
        <div class="sc-balls">
          ${Array.from({ length: ballCount }, (_, b) =>
            `<input class="sc-ball" maxlength="1" data-frame="${f}" data-ball="${b}" />`
          ).join('')}
        </div>
        <div class="sc-total pending" id="sc-total-${f}"></div>
      `;
      container.appendChild(div);
    }

    // Max possible row
    const maxRow = document.createElement('div');
    maxRow.id = 'sc-max-row';
    maxRow.className = 'sc-max-row';
    maxRow.innerHTML = `<span class="sc-max-label">Max possible</span><span class="sc-max-val" id="sc-max-val">300</span>`;
    container.after(maxRow);

    attachListeners();
  }

  function parseInput(val, prev) {
    const v = val.trim().toUpperCase();
    if (v === 'X') return 10;
    if (v === '/' && prev != null) return 10 - prev;
    if (v === '-') return 0;
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
  }

  function updateDisplay() {
    const scores = computeRunningScores(state);
    const inputs = [...container.querySelectorAll('.sc-ball')];

    inputs.forEach(inp => {
      const fi = +inp.dataset.frame, bi = +inp.dataset.ball;
      const val = state[fi].balls[bi];
      if (val == null) { inp.value = ''; inp.className = 'sc-ball'; return; }

      const isStrikeBall = (bi === 0 && val === 10);
      const isSpareBall  = !isStrikeBall && bi >= 1 &&
        fi < 9 ? (state[fi].balls[0] != null && state[fi].balls[0] + val === 10) :
        (bi === 1 && state[fi].balls[0] !== 10 && (state[fi].balls[0] || 0) + val === 10);

      if (val === 10 && bi === 0 && fi < 9) {
        inp.value = 'X'; inp.className = 'sc-ball is-strike';
      } else if (bi >= 1 && fi < 9 && state[fi].balls[0] !== 10 && (state[fi].balls[0] || 0) + val === 10) {
        inp.value = '/'; inp.className = 'sc-ball is-spare';
      } else if (fi === 9 && bi === 1 && state[fi].balls[0] !== 10 && (state[fi].balls[0] || 0) + val === 10) {
        inp.value = '/'; inp.className = 'sc-ball is-spare';
      } else {
        inp.value = val === 0 ? '-' : val;
        inp.className = 'sc-ball';
      }
    });

    scores.forEach((score, fi) => {
      const el = document.getElementById(`sc-total-${fi}`);
      if (!el) return;
      if (score == null) { el.textContent = ''; el.className = 'sc-total pending'; }
      else { el.textContent = score; el.className = 'sc-total'; }
    });

    const maxEl = document.getElementById('sc-max-val');
    if (maxEl) {
      const max = maxPossible(state);
      maxEl.textContent = max;
      maxEl.style.color = max === 300 ? 'var(--accent)' : max < 200 ? '#f97316' : 'var(--text)';
    }
  }

  function attachListeners() {
    container.querySelectorAll('.sc-ball').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Backspace' && inp.value === '') {
          const fi = +inp.dataset.frame, bi = +inp.dataset.ball;
          state[fi].balls[bi] = null;
          updateDisplay();
        }
      });
      inp.addEventListener('input', () => {
        const fi = +inp.dataset.frame, bi = +inp.dataset.ball;
        const raw  = inp.value.slice(-1);
        const prev = bi > 0 ? state[fi].balls[bi - 1] : null;
        const val  = parseInput(raw, prev);
        if (val === null) { inp.value = ''; return; }
        state[fi].balls[bi] = val;
        updateDisplay();
        // strike flash
        if (val === 10 && bi === 0 && fi < 9) {
          inp.classList.add('flash-strike');
          inp.addEventListener('animationend', () => inp.classList.remove('flash-strike'), { once: true });
        }
        // perfect game easter egg
        const scores = computeRunningScores(state);
        if (scores[9] === 300) showConfetti();
        const all = [...container.querySelectorAll('.sc-ball')];
        const idx = all.indexOf(inp);
        if (idx < all.length - 1) all[idx + 1].focus();
      });
    });
  }

  document.getElementById('reset-btn').addEventListener('click', () => {
    state.forEach(f => { f.balls = []; });
    const maxRow = document.getElementById('sc-max-row');
    if (maxRow) maxRow.remove();
    buildUI();
  });

  buildUI();
}

// ── Navbar ────────────────────────────────────────────────────────────────
(function () {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 20), { passive: true });
})();

// ── Log Gate ──────────────────────────────────────────────────────────────
function initGate() {
  const gate  = document.getElementById('log-gate');
  const form  = document.getElementById('log-form');
  const input = document.getElementById('gate-input');
  const btn   = document.getElementById('gate-btn');
  const err   = document.getElementById('gate-error');

  function unlock() {
    gate.style.display = 'none';
    form.style.display = '';
    sessionStorage.setItem('bowl_unlocked', '1');
  }

  if (sessionStorage.getItem('bowl_unlocked') === '1') { unlock(); return; }

  btn.addEventListener('click', () => {
    if (input.value.trim() === 'K20053634!') {
      unlock();
    } else {
      err.textContent = 'Incorrect password.';
      input.value = '';
      input.focus();
    }
  });

  input.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });
}

// ── Confetti ──────────────────────────────────────────────────────────────
function showConfetti() {
  const wrap = document.createElement('div');
  wrap.className = 'confetti-wrap';
  document.body.appendChild(wrap);
  const colors = ['#0369a1','#10b981','#f97316','#f59e0b','#8b5cf6','#ef4444','#06b6d4'];
  for (let i = 0; i < 80; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.cssText = `
      left:${Math.random()*100}%;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${1.2+Math.random()*1.8}s;
      animation-delay:${Math.random()*0.6}s;
      transform:rotate(${Math.random()*360}deg);
      width:${6+Math.random()*6}px;
      height:${8+Math.random()*8}px;
    `;
    wrap.appendChild(p);
  }
  setTimeout(() => wrap.remove(), 4000);
}

// ── Count-up animation ────────────────────────────────────────────────────
function countUp(el, target, suffix = '', duration = 800) {
  const isFloat = target % 1 !== 0;
  const start   = performance.now();
  el.classList.add('counting');
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = (isFloat ? (ease * target).toFixed(1) : Math.round(ease * target)) + suffix;
    if (p < 1) requestAnimationFrame(step);
    else el.classList.remove('counting');
  }
  requestAnimationFrame(step);
}

function animateStats(stats) {
  const avgVal = stats.avgScore !== '--' ? +stats.avgScore : null;
  if (avgVal !== null) countUp(document.getElementById('stat-avg'), avgVal);
  if (stats.highGame !== '--') countUp(document.getElementById('stat-high'), +stats.highGame);
  countUp(document.getElementById('stat-strikes'), parseFloat(stats.avgStrikes), '', 900);
  countUp(document.getElementById('stat-spares'),  parseFloat(stats.avgSpares),  '', 900);
  if (stats.avgSpeed !== '--') countUp(document.getElementById('stat-speed'), parseFloat(stats.avgSpeed), ' mph', 900);
  countUp(document.getElementById('stat-games'), stats.totalGames);
}

// ── Scroll reveal ─────────────────────────────────────────────────────────
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ── Lane Ball Animation ───────────────────────────────────────────────────
function initLaneAnimation() {
  const ball = document.querySelector('.lane-ball');
  const pins = document.querySelectorAll('.lp');
  const lane = document.querySelector('.hero-lane');
  if (!ball || !pins.length || !lane) return;

  const DURATION = 8000;
  const IMPACT   = 0.76; // ball reaches pins (left:78%) at 76% of shot

  const shots = [
    { anim: 'bowlStraight',  strike: true,  color: 'rgba(147,197,253,' },
    { anim: 'bowlStraight',  strike: true,  color: 'rgba(147,197,253,' },
    { anim: 'bowlHook',      strike: true,  color: 'rgba(251,191,36,'  },
    { anim: 'bowlHook',      strike: true,  color: 'rgba(251,191,36,'  },
    { anim: 'bowlHeavyHook', strike: true,  color: 'rgba(248,113,113,' },
    { anim: 'bowlGutter',    strike: false, color: 'rgba(148,163,184,' },
  ];

  // ── Trail canvas ─────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;';
  lane.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function resizeCanvas() { canvas.width = lane.offsetWidth; canvas.height = lane.offsetHeight; }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas, { passive: true });

  const TRAIL_MS  = 3000;
  let trailPoints = [];
  let trailColor  = 'rgba(147,197,253,';
  let trailActive = false;

  function drawTrail(ts) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    while (trailPoints.length && ts - trailPoints[0].t > TRAIL_MS) trailPoints.shift();
    if (trailActive) {
      const br = ball.getBoundingClientRect(), lr = lane.getBoundingClientRect();
      trailPoints.push({ x: br.left - lr.left + br.width * .5, y: br.top - lr.top + br.height * .5, t: ts });
    }
    const n = trailPoints.length;
    if (n > 1) {
      for (let i = 1; i < n; i++) {
        const pos = i / n;
        const age = 1 - (ts - trailPoints[i].t) / TRAIL_MS;
        ctx.beginPath();
        ctx.moveTo(trailPoints[i - 1].x, trailPoints[i - 1].y);
        ctx.lineTo(trailPoints[i].x,     trailPoints[i].y);
        ctx.strokeStyle = trailColor + (pos * age * 0.55) + ')';
        ctx.lineWidth   = pos * 3.5 + 0.5;
        ctx.lineCap     = 'round';
        ctx.stroke();
      }
    }
    requestAnimationFrame(drawTrail);
  }
  requestAnimationFrame(drawTrail);
  // ── End trail ────────────────────────────────────────────────────────────

  let pinTimer  = null;
  let nextTimer = null;

  function playShot() {
    clearTimeout(pinTimer);
    clearTimeout(nextTimer);
    trailActive = false;
    trailPoints = [];

    pins.forEach(lp => {
      lp.style.animation = 'none';
      lp.style.opacity   = '1';
      lp.style.transform = '';
    });

    ball.style.animation = 'none';
    void ball.offsetWidth;

    const shot = shots[Math.floor(Math.random() * shots.length)];
    trailColor = shot.color;
    ball.style.animation = `${shot.anim} ${DURATION / 1000}s linear 1 forwards`;

    setTimeout(() => { trailActive = true;  }, 350);
    setTimeout(() => { trailActive = false; }, DURATION * 0.86);

    if (shot.strike) {
      pinTimer = setTimeout(() => {
        pins.forEach((lp, i) => {
          void lp.offsetWidth;
          lp.style.animation = `pinS${i + 1} 2.4s ease-in 1 forwards`;
        });
      }, DURATION * IMPACT);
    }

    nextTimer = setTimeout(playShot, DURATION + 1200);
  }

  setTimeout(playShot, 800);
}

// ── Boot ──────────────────────────────────────────────────────────────────
const data = loadData();
renderAll(data);
initLogForm(data);
initScorecard();
initGate();
initReveal();
initLaneAnimation();
if (computeStats(data)) animateStats(computeStats(data));
