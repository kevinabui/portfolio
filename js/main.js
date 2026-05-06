/* ─────────────────────────────────────────────────────────────────────────
   Kevin Bui · Portfolio — main.js
   ───────────────────────────────────────────────────────────────────────── */


// ── Navbar scroll effect ─────────────────────────────────────────────────────
(function initNavbar() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
})();


// ── Active nav link on scroll ────────────────────────────────────────────────
(function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const links    = document.querySelectorAll('.nav-links a');

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        links.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => obs.observe(s));
})();


// ── Hamburger menu ───────────────────────────────────────────────────────────
(function initHamburger() {
  const btn   = document.getElementById('hamburger');
  const links = document.querySelector('.nav-links');

  btn.addEventListener('click', () => {
    const open = btn.classList.toggle('open');
    links.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open);
  });

  // Close on link click
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      btn.classList.remove('open');
      links.classList.remove('open');
    });
  });
})();


// ── Project filter tabs ───────────────────────────────────────────────────────
(function initFilters() {
  const buttons = document.querySelectorAll('.filter-btn');
  const cards   = document.querySelectorAll('.project-card');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      cards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('hidden', !match);
        // Re-trigger animation on visible cards
        if (match) {
          card.classList.remove('reveal', 'visible');
          void card.offsetWidth; // reflow
          card.classList.add('reveal');
          setTimeout(() => card.classList.add('visible'), 10);
        }
      });
    });
  });
})();


// ── Reveal on scroll ─────────────────────────────────────────────────────────
(function initReveal() {
  const targets = [
    ...document.querySelectorAll('.project-card'),
    ...document.querySelectorAll('.skill-category'),
    ...document.querySelectorAll('.about-grid'),
    ...document.querySelectorAll('.timeline-item'),
  ];

  targets.forEach(el => el.classList.add('reveal'));

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  targets.forEach(t => obs.observe(t));
})();


// ── Subtle hero parallax ─────────────────────────────────────────────────────
(function initParallax() {
  const bg   = document.querySelector('.hero-bg');
  const name = document.querySelector('.hero-name');
  if (!bg) return;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    bg.style.transform   = `translateY(${y * 0.3}px)`;
    if (name) name.style.transform = `translateY(${y * 0.08}px)`;
  }, { passive: true });
})();


// ── Smooth card entrance stagger ─────────────────────────────────────────────
(function staggerCards() {
  const cards = document.querySelectorAll('.project-card');
  cards.forEach((card, i) => {
    card.style.transitionDelay = `${i * 50}ms`;
  });
})();


// ── Typewriter hero headline ──────────────────────────────────────────────────
(function initTypewriter() {
  const el = document.querySelector('.hero-name');
  if (!el) return;

  const phrases = [
    'I build data tools that turn messy information into something people can actually use.',
    'I build LLM systems that ground AI in real-world data.',
    'I build pipelines that connect raw data to clear decisions.',
    'I build analytics dashboards people actually want to use.',
  ];

  const cursor = document.createElement('span');
  cursor.className = 'type-cursor';
  cursor.textContent = '|';
  el.textContent = '';
  el.appendChild(cursor);

  let pi = 0, ci = 0, deleting = false;
  const SPEED_TYPE = 38, SPEED_DEL = 18, PAUSE_END = 2200, PAUSE_START = 400;

  function tick() {
    const phrase = phrases[pi];
    if (!deleting) {
      el.textContent = phrase.slice(0, ci);
      el.appendChild(cursor);
      ci++;
      if (ci > phrase.length) {
        deleting = true;
        setTimeout(tick, PAUSE_END);
        return;
      }
      setTimeout(tick, SPEED_TYPE);
    } else {
      el.textContent = phrase.slice(0, ci);
      el.appendChild(cursor);
      ci--;
      if (ci < 0) {
        deleting = false;
        pi = (pi + 1) % phrases.length;
        ci = 0;
        setTimeout(tick, PAUSE_START);
        return;
      }
      setTimeout(tick, SPEED_DEL);
    }
  }

  tick();
})();


// ── Live bowling avg in hero ──────────────────────────────────────────────────
(function initLiveBowlingAvg() {
  if (typeof firebase === 'undefined') return;
  try {
    firebase.initializeApp({
      apiKey:      'AIzaSyB7kBe56BuvGA05FrzYgTWXHWYA5X4UoEg',
      databaseURL: 'https://bowling-stats-tracker-2b8c5-default-rtdb.firebaseio.com',
      projectId:   'bowling-stats-tracker-2b8c5',
    });
  } catch (_) {}
  crypto.subtle.digest('SHA-256', new TextEncoder().encode('kevin123'))
    .then(buf => {
      const key = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      return firebase.database().ref('users/' + key).once('value');
    })
    .then(snap => {
      const val = snap.val();
      if (!val?.sessions) return;
      const sessions = Array.isArray(val.sessions) ? val.sessions : Object.values(val.sessions);
      const games  = sessions.flatMap(s => s.games);
      const recent = games.slice(-15).map(g => g.scratch).filter(Boolean);
      if (!recent.length) return;
      const avg   = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
      const avgEl = document.getElementById('bowl-avg');
      const pill  = document.getElementById('bowl-avg-pill');
      if (avgEl) avgEl.textContent = avg;
      if (pill)  pill.style.display = '';
    })
    .catch(() => {});
})();
