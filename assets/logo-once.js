/* Magic eSIM — the English pages' start of the header motion (owner, 2026-10-20 / 2026-10-21). The Russian pages do the
   same with an inline script after the header SVG (seo/site-chrome.mjs HEADER_MOTION_SCRIPT); the English pages' CSP is
   `script-src 'self'`, which refuses inline script, so the same steps live here, loaded synchronously in <head> before
   the stylesheets — before first paint, so nothing flashes:
     1. <html data-motion="expressive"> turns the interface motion on (the [data-motion] rules in assets/site.css);
     2. the logo plays «Reveal + Wave» ONCE per visit — the same sessionStorage key as the RU script (`me-logo`), so a visit
        plays it once across both languages; `lm-once` on <html> starts it (assets/site.css); no storage → no animation;
     3. where the generator names it (data-motion-src — the home and the country pages, which have something for it to
        do), assets/motion.js loads asynchronously: reveal below the fold, the hero parallax, the jump bar's spy.
   No network but that one same-origin script, no other storage. All of it sits inside prefers-reduced-motion:
   no-preference (the CSS; motion.js returns at once under reduce). */
(function () {
  var d = document, r = d.documentElement, me = d.currentScript;
  r.setAttribute('data-motion', 'expressive');
  try {
    var s = window.sessionStorage;
    if (!s.getItem('me-logo')) { s.setItem('me-logo', '1'); r.classList.add('lm-once'); }
  } catch (e) { /* storage refused: the logo stays static */ }
  var src = me && me.getAttribute('data-motion-src');
  if (src && /^\/assets\/motion\.js(\?v=[0-9a-f]{8})?$/.test(src)) {
    var j = d.createElement('script'); j.src = src; j.async = true; d.head.appendChild(j);
  }
})();
