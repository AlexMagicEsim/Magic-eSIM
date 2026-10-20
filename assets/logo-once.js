/* Magic eSIM — the header logo plays «Reveal + Wave» ONCE per session on the English pages (owner, 2026-10-20).
   The Russian pages do this with an inline script after the SVG (seo/site-chrome.mjs HEADER_MOTION_SCRIPT); the English
   pages' CSP is `script-src 'self'`, which refuses inline script, so the same three lines live here and load in <head>,
   synchronously, before first paint: no flash of a logo that then disappears. Same sessionStorage key as the RU script, so
   a visit plays it once across both languages. It only marks <html>; the animation is assets/site.css (.lm-once), inside
   prefers-reduced-motion: no-preference. No storage → no animation. Nothing else on the page moves. */
(function () {
  try {
    var s = window.sessionStorage;
    if (s.getItem('me-logo')) return;
    s.setItem('me-logo', '1');
    document.documentElement.classList.add('lm-once');
  } catch (e) { /* storage refused: the logo stays static */ }
})();
