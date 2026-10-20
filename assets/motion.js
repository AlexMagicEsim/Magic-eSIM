/* Magic eSIM — interface motion «Expressive» (owner, 2026-10-20). The rules are in assets/ru.css under [data-motion]; this
   file does only what CSS cannot: reveal-on-scroll for content that is BELOW the fold at load (nothing visible is ever
   hidden), a pointer parallax on the home drawing (fine pointers only) and the country page's jump-bar spy. Loaded by the
   header script (seo/site-chrome.mjs) without blocking anything; no library; passive listeners; one rAF per pointer frame.
   Under prefers-reduced-motion it does nothing. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root.hasAttribute('data-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // reveal on scroll: only elements whose top is below the viewport when this runs
  const REVEAL = '.dest-tile,.guide-card,.how-step,.step,.faq details,.dest-card';
  function arm() {
    if (!('IntersectionObserver' in window)) return;
    const vh = window.innerHeight;
    const els = [...document.querySelectorAll(REVEAL)].filter((e) => e.getBoundingClientRect().top > vh);
    const io = new IntersectionObserver((list) => list.forEach((en) => {
      if (!en.isIntersecting) return;
      const e = en.target; io.unobserve(e);
      e.classList.add('m-show'); requestAnimationFrame(() => e.classList.remove('m-pre'));
      setTimeout(() => { e.classList.remove('m-show'); e.style.removeProperty('--i'); }, 900);
    }), { rootMargin: '0px 0px -8% 0px' });
    const sib = new Map();
    els.forEach((e) => {
      const p = e.parentElement; const k = sib.get(p) || 0; sib.set(p, k + 1);
      e.style.setProperty('--i', Math.min(k, 5)); e.classList.add('m-pre'); io.observe(e);
    });
  }

  // pointer parallax on the home drawing (mouse only)
  function parallax() {
    const art = document.querySelector('.hero-art');
    if (!art || !window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    art.classList.add('m-par'); let raf = 0, x = 0, y = 0;
    const hero = art.closest('.hero') || art;
    hero.addEventListener('pointermove', (e) => {
      const r = art.getBoundingClientRect(); x = ((e.clientX - r.left) / r.width - 0.5) * 2; y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(() => {
        raf = 0;
        art.style.setProperty('--px', Math.max(-1, Math.min(1, x)).toFixed(3));
        art.style.setProperty('--py', Math.max(-1, Math.min(1, y)).toFixed(3));
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { art.style.setProperty('--px', 0); art.style.setProperty('--py', 0); }, { passive: true });
  }

  // the jump bar's active link (country page)
  function jumpSpy() {
    const links = [...document.querySelectorAll('.cp-jump a[href^="#"]')];
    if (!links.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((list) => list.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('m-active', a.getAttribute('href') === '#' + en.target.id));
    }), { rootMargin: '-40% 0px -55% 0px' });
    links.forEach((a) => { const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) io.observe(t); });
  }

  const start = () => { arm(); parallax(); jumpSpy(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
