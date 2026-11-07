/* Magic eSIM — the language of the FIRST look at the site root «/», the English home since the EN-root migration
   (owner, 2026-11-07; before it «/» was the Russian home and this file sent other languages away from it — owner,
   2026-10-23, reports/ENGLISH_FIRST_AUDIT/MAGIC_ESIM_AUTO_LANGUAGE_PLAN_2026-10-23.md).

   Loaded synchronously, first in <head> of the English home index.html ONLY (seo/home-page.mjs) — before first paint, so
   a visitor who is sent on never sees the English page flash. It is a language SUGGESTION for a first visit, not an SEO
   redirect: the old addresses have their own client-side redirect pages (seo/build-legacy-redirects.mjs).

   When it moves a visitor (all must hold, else it does nothing):
     1. the path is exactly «/» — never any other page: /ru/ and every language page never move anyone;
     2. the visit did not come from this site (document.referrer is not our origin): a click on our logo, on «English»
        in another language's switch, or a «Back» never bounces anyone — that is also what makes a loop impossible
        (the target pages never run this script, and a return to «/» from them is same-origin);
     3. the language is not English. It is the visitor's SAVED choice (localStorage `mesim.site.lang`, written by a
        language switch — assets/logo-once.js on the English and prefixed pages), else the first language of
        navigator.languages / navigator.language we publish (ru en es fr de zh ko; any zh → /zh/), else English (stay).
   /?country=XX is the OLD Russian home's deep link to one Russian country page: it always goes to /ru/?country=XX,
   where assets/ru-home.js resolves it to /ru/esim/<slug>/ from the generated list: two client-side hops, the only way
   on GitHub Pages (it cannot redirect on a query). No Cyrillic list is loaded on «/» for it.
   The move is location.replace (no history entry), keeps the WHOLE query string (utm_*, gclid, yclid, partner and
   campaign marks) and keeps the hash only when the target home has that section (HASHES).
   No IP, no User-Agent, no robot detection (owner). Storage refused (Safari private, blocked cookies) → the browser's
   language decides; nothing throws. */
(function (root) {
  'use strict';

  var KEY = 'mesim.site.lang';
  // = assets/site-i18n.js LANGS / PREFIX (seo/test-lang-route.mjs holds them equal): each language's own segment.
  var PREFIX = { ru: 'ru', en: 'en', es: 'es', de: 'de', fr: 'fr', 'zh-Hans': 'zh', ko: 'ko' };
  // Each language's home (seo/locales.mjs paths.home; the test holds them equal). English is «/» itself.
  var HOME = { ru: '/ru/', en: '/', es: '/es/', de: '/de/', fr: '/fr/', 'zh-Hans': '/zh/', ko: '/ko/' };
  var BROWSER = { ru: 'ru', en: 'en', es: 'es', de: 'de', fr: 'fr', zh: 'zh-Hans', ko: 'ko' };
  // Sections every home has (seo/home-page.mjs and ru/index.html; the test reads them) + the old Russian home's
  // anchors (assets/ru-home.js MAP) under their new names. Anything else (#faq, #top) is dropped.
  var HASHES = { '#main': '#main', '#plans': '#plans', '#popular': '#popular', '#how': '#how', '#plan-types': '#plan-types',
    '#compat': '#compat', '#guides': '#guides', '#support': '#support',
    '#global-pricing': '#plans', '#solution': '#how', '#install-guides-section': '#guides' };
  var AUTO = 'mesim.lang.auto';   // sessionStorage: «this visit was moved by the browser language, not by a choice»

  function stored(ls) {
    try { var v = ls && ls.getItem(KEY); return Object.prototype.hasOwnProperty.call(PREFIX, v) ? v : null; }
    catch (e) { return null; }
  }

  /** The first language of the list we publish, else English. */
  function fromBrowser(list) {
    for (var i = 0; i < (list ? list.length : 0); i++) {
      var tag = String(list[i] || '').toLowerCase().split(/[-_]/)[0];
      if (Object.prototype.hasOwnProperty.call(BROWSER, tag)) return BROWSER[tag];
    }
    return 'en';
  }

  function sameOrigin(ref, origin) {
    if (!ref) return false;
    return ref === origin || ref.indexOf(origin + '/') === 0;
  }

  /**
   * Where «/» should send this visit, or null to stay. Pure: everything it reads is passed in.
   * env = { pathname, search, hash, referrer, origin, languages: [..], stored: 'ru' | null }
   */
  function decide(env) {
    if (env.pathname !== '/') return null;
    var search = env.search || '';
    // The old Russian home's country link: Russian content whatever the language (a link, not a language choice).
    if (/(?:^\?|&)country=/.test(search)) return HOME.ru + search;
    if (sameOrigin(env.referrer, env.origin)) return null;
    var lang = env.stored || fromBrowser(env.languages);
    if (!lang || lang === 'en' || !Object.prototype.hasOwnProperty.call(HOME, lang)) return null;
    var hash = HASHES[env.hash] || '';
    return HOME[lang] + search + hash;
  }

  var api = { decide: decide, fromBrowser: fromBrowser, PREFIX: PREFIX, HOME: HOME, HASHES: HASHES, KEY: KEY, AUTO: AUTO };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  var d = root.document, l = root.location, n = root.navigator || {}, ls = null, ss = null;
  try { ls = root.localStorage; } catch (e) { ls = null; }
  try { ss = root.sessionStorage; } catch (e) { ss = null; }

  var to = null;
  try {
    to = decide({
      pathname: l.pathname, search: l.search, hash: l.hash, referrer: d.referrer || '', origin: l.origin,
      languages: (n.languages && n.languages.length) ? n.languages : [n.language], stored: stored(ls),
    });
  } catch (e) { to = null; }
  if (!to) return;
  // The mark is for the target's assets/logo-once.js (it consumes it). The Russian pages run no logo-once.js, so a mark
  // left for /ru/ would linger and swallow the visitor's later «English» choice: none is left there.
  try { if (!stored(ls) && ss && to.indexOf(HOME.ru) !== 0) ss.setItem(AUTO, '1'); } catch (e) { /* no storage: the target may take it as a choice */ }
  l.replace(to);
})(typeof window !== 'undefined' ? window : this);
