/* Magic eSIM — the English pages' start of the header motion (owner, 2026-10-20 / 2026-10-21). The Russian pages do the
   same with an inline script after the header SVG (seo/site-chrome.mjs HEADER_MOTION_SCRIPT); the English pages' CSP is
   `script-src 'self'`, which refuses inline script, so the same steps live here, loaded synchronously in <head> before
   the stylesheets — before first paint, so nothing flashes:
     1. <html data-motion="expressive"> turns the interface motion on (the [data-motion] rules in assets/site.css);
     2. the logo plays «Reveal + Wave» ONCE per visit — the same sessionStorage key as the RU script (`me-logo`), so a visit
        plays it once across both languages; `lm-once` on <html> starts it (assets/site.css); no storage → no animation;
     3. where the generator names it (data-motion-src — the home and the country pages, which have something for it to
        do), assets/motion.js loads asynchronously: reveal below the fold, the hero parallax, the jump bar's spy.
   No network but that one same-origin script. All of the motion sits inside prefers-reduced-motion:
   no-preference (the CSS; motion.js returns at once under reduce).

   4. THE LANGUAGE CHOICE (owner, 2026-10-23; assets/lang-route.js reads it on «/»): a click on a language in the switch
      (the desktop list, the single link, the phone menu) saves that language in localStorage `mesim.site.lang`; an
      arrival from a Russian page of this site (its header's «English» is the only link that crosses — the Russian
      pages have no script for it) saves this page's language. Not saved: an arrival that lang-route.js made itself
      (sessionStorage `mesim.lang.auto`, consumed here). Storage refused → nothing saved, nothing thrown. */
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

  var KEY = 'mesim.site.lang', LANGS = { ru: 1, en: 1, es: 1, de: 1, fr: 1, 'zh-Hans': 1, ko: 1 };
  function save(lang) {
    try { if (LANGS[lang] === 1) window.localStorage.setItem(KEY, lang); } catch (e) { /* storage refused */ }
  }
  try {
    var ss = window.sessionStorage, auto = ss && ss.getItem('mesim.lang.auto');
    if (auto) ss.removeItem('mesim.lang.auto');
    var ref = d.referrer || '', o = location.origin;
    if (!auto && ref.indexOf(o + '/') === 0 && !/^\/(en|es|de|fr|zh|ko|app|pay)\//.test(ref.slice(o.length))) save(r.getAttribute('lang'));
  } catch (e) { /* storage refused */ }
  d.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[hreflang]');
    if (a && a.closest('.langsw, .langmenu, .mnav-panel')) save(a.getAttribute('hreflang'));
  }, true);
})();
