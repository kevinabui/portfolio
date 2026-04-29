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
