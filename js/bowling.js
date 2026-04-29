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

  const scratches    = games.map(g => g.scratch).filter(Boolean);
  const totalStrikes = games.reduce((a, g) => a + (g.strikes || 0), 0);
  const totalSpares  = games.reduce((a, g) => a + (g.spares || 0), 0);
  const totalOpens   = games.reduce((a, g) => a + (g.openFrames || 0), 0);
  const speeds       = games.map(g => g.firstBallSpeed).filter(Boolean);

  return {
    games,
    avgScore:    scratches.length ? Math.round(scratches.reduce((a, b) => a + b, 0) / scratches.length) : '--',
    highGame:    scratches.length ? Math.max(...scratches) : '--',
    avgStrikes:  (totalStrikes / games.length).toFixed(1),
    avgSpares:   (totalSpares  / games.length).toFixed(1),
    avgSpeed:    speeds.length ? (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1) : '--',
    totalGames:  games.length,
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
  const games  = stats.games;
  const labels = games.map((_, i) => `G${i + 1}`);

  // Score trend
  destroyChart('score');
  const scratches = games.map(g => g.scratch || null);
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
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#0369a1',
          tension: 0.3,
          fill: true,
        },
        {
          label: '3-Game Avg',
          data: rollingAvg(scratches.filter(Boolean)),
          borderColor: '#f97316',
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 0,
          tension: 0.4,
          fill: false,
        },
      ],
    },
    options: chartOptions({ yMin: 60, unit: '' }),
  });

  // Ball speed
  destroyChart('speed');
  charts['speed'] = new Chart(document.getElementById('speedChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: '1st Ball',
          data: games.map(g => g.firstBallSpeed || null),
          borderColor: '#0369a1',
          backgroundColor: 'rgba(3,105,161,.07)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#0369a1',
          tension: 0.3,
          fill: true,
        },
        {
          label: '2nd Ball',
          data: games.map(g => g.secondBallSpeed || null),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,.07)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#10b981',
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: chartOptions({ yMin: 0, unit: ' mph' }),
  });

  // Frame breakdown donut
  destroyChart('breakdown');
  charts['breakdown'] = new Chart(document.getElementById('breakdownChart'), {
    type: 'doughnut',
    data: {
      labels: ['Strikes', 'Spares', 'Open Frames'],
      datasets: [{
        data: [stats.totalStrikes, stats.totalSpares, stats.totalOpens],
        backgroundColor: ['#0369a1', '#10b981', '#e2e8f0'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, boxWidth: 14 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } },
      },
    },
  });

  // 1st ball average
  destroyChart('firstBall');
  charts['firstBall'] = new Chart(document.getElementById('firstBallChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '1st Ball Avg',
        data: games.map(g => g.firstBallAvg || null),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,.07)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#8b5cf6',
        tension: 0.3,
        fill: true,
      }],
    },
    options: chartOptions({ yMin: 0, yMax: 10, unit: ' pins' }),
  });
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

  [...data.sessions].reverse().forEach(session => {
    const card = document.createElement('div');
    card.className = 'session-card';

    card.innerHTML = `
      <div class="session-header">
        <div class="session-meta">
          <span class="session-date">${fmt(session.date)}</span>
          <span class="session-location">${session.location}</span>
        </div>
        <button class="delete-session-btn" data-id="${session.id}">Delete</button>
      </div>
      ${session.games.map((g, i) => `
        <div class="game-row">
          <div class="game-row-label">Game ${i + 1}</div>
          <div class="game-stats-grid">
            <div class="game-stat">
              <span class="game-stat-label">Scratch</span>
              <span class="game-stat-val highlight">${g.scratch ?? '--'}</span>
            </div>
            <div class="game-stat">
              <span class="game-stat-label">+ HDCP</span>
              <span class="game-stat-val">${g.hdcpScore ?? '--'}</span>
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
              <span class="game-stat-label">1st Ball Avg</span>
              <span class="game-stat-val">${g.firstBallAvg ?? '--'}</span>
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
    `;

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
    document.getElementById('stat-avg').textContent    = stats.avgScore;
    document.getElementById('stat-high').textContent   = stats.highGame;
    document.getElementById('stat-strikes').textContent = stats.avgStrikes;
    document.getElementById('stat-spares').textContent  = stats.avgSpares;
    document.getElementById('stat-speed').textContent   = stats.avgSpeed !== '--' ? stats.avgSpeed + ' mph' : '--';
    document.getElementById('stat-games').textContent   = stats.totalGames;
    renderCharts(stats);
    renderHistory(data);
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
          <label>Scratch + HDCP</label>
          <input type="number" name="hdcpScore" min="0" max="400" placeholder="0 – 400" />
        </div>
        <div class="form-group">
          <label>Open Frames</label>
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
          <label>1st Ball Avg (pins)</label>
          <input type="number" name="firstBallAvg" step="0.1" min="0" max="10" placeholder="e.g. 7.8" />
        </div>
        <div class="form-group">
          <label>1st Ball Speed (mph)</label>
          <input type="number" name="firstBallSpeed" step="0.1" min="0" max="30" placeholder="e.g. 14.2" />
        </div>
        <div class="form-group">
          <label>2nd Ball Speed (mph)</label>
          <input type="number" name="secondBallSpeed" step="0.1" min="0" max="30" placeholder="e.g. 13.5" />
        </div>
      </div>
    `;
    div.querySelector('.remove-game-btn')?.addEventListener('click', () => div.remove());
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
      hdcpScore:       num(entry.querySelector('[name=hdcpScore]').value),
      openFrames:      num(entry.querySelector('[name=openFrames]').value),
      spares:          num(entry.querySelector('[name=spares]').value),
      strikes:         num(entry.querySelector('[name=strikes]').value),
      gutters:         num(entry.querySelector('[name=gutters]').value),
      firstBallAvg:    num(entry.querySelector('[name=firstBallAvg]').value),
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

// ── Boot ──────────────────────────────────────────────────────────────────
const data = loadData();
renderAll(data);
initLogForm(data);
initScorecard();
