/* Magic eSIM — the language of the FIRST look at the Russian home «/» (owner, 2026-10-23; the SEO risk accepted in writing,
   reports/ENGLISH_FIRST_AUDIT/MAGIC_ESIM_AUTO_LANGUAGE_PLAN_2026-10-23.md).

   Loaded synchronously, first in <head> of index.html ONLY — before the Metrika counter and before first paint — so a
   visitor who is sent on is never counted on «/» and never sees the Russian page flash.

   When it moves a visitor (all must hold, else it does nothing):
     1. the path is exactly «/» — never any other page: a link to a language page is never redirected;
     2. the visit did not come from this site (document.referrer is not our origin): a click on our logo, on «Русский»
        in another language's switch, or a «Back» never bounces anyone — that is also what makes a loop impossible
        (the target pages never run this script, and a return to «/» from them is same-origin);
     3. no `country` in the query: /?country=XX is an old link to one Russian country page (assets/ru-home.js takes it);
     4. the language is not Russian. It is the visitor's SAVED choice (localStorage `mesim.site.lang`, written by a
        language switch — assets/logo-once.js on the international pages, and below for «Русский»), else the first
        language of navigator.languages / navigator.language we publish (ru en es fr de zh ko; any zh → /zh/),
        else English.
   The move is location.replace (no history entry), keeps the WHOLE query string (utm_*, gclid, yclid, partner and
   campaign marks) and keeps the hash only when the target home has that section (HASHES).
   No IP, no User-Agent, no robot detection (owner). Storage refused (Safari private, blocked cookies) → the browser's
   language decides; nothing throws. */
(function (root) {
  'use strict';

  var KEY = 'mesim.site.lang';
  // = assets/site-i18n.js LANGS / PREFIX (seo/test-lang-route.mjs holds them equal)
  var PREFIX = { ru: '', en: 'en', es: 'es', de: 'de', fr: 'fr', 'zh-Hans': 'zh', ko: 'ko' };
  var BROWSER = { ru: 'ru', en: 'en', es: 'es', de: 'de', fr: 'fr', zh: 'zh-Hans', ko: 'ko' };
  // Sections every prefixed home has (seo/home-page.mjs; the test reads all six) + the RU home's old anchors
  // (assets/ru-home.js MAP) under their new names. Anything else (#faq, #top) is dropped: the target has no such place.
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
   * env = { pathname, search, hash, referrer, origin, languages: [..], stored: 'en' | null }
   */
  function decide(env) {
    if (env.pathname !== '/') return null;
    if (sameOrigin(env.referrer, env.origin)) return null;
    if (/(?:^\?|&)country=/.test(env.search || '')) return null;
    var lang = env.stored || fromBrowser(env.languages);
    if (!lang || PREFIX[lang] === '' || PREFIX[lang] === undefined) return null;
    var hash = HASHES[env.hash] || '';
    return '/' + PREFIX[lang] + '/' + (env.search || '') + hash;
  }

  var api = { decide: decide, fromBrowser: fromBrowser, PREFIX: PREFIX, HASHES: HASHES, KEY: KEY, AUTO: AUTO };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }

  var d = root.document, l = root.location, n = root.navigator || {}, ls = null, ss = null;
  try { ls = root.localStorage; } catch (e) { ls = null; }
  try { ss = root.sessionStorage; } catch (e) { ss = null; }

  // «Русский» chosen in another language's switch: remember it (the switch's own listener may not have run — a page
  // without scripts, or storage refused there). A same-origin arrival from a prefixed page = that switch.
  try {
    var ref = d.referrer || '';
    if (l.pathname === '/' && sameOrigin(ref, l.origin) && /^\/(en|es|de|fr|zh|ko)\//.test(ref.slice(l.origin.length)) && ls) {
      ls.setItem(KEY, 'ru');
    }
  } catch (e) { /* storage refused */ }

  var to = null;
  try {
    to = decide({
      pathname: l.pathname, search: l.search, hash: l.hash, referrer: d.referrer || '', origin: l.origin,
      languages: (n.languages && n.languages.length) ? n.languages : [n.language], stored: stored(ls),
    });
  } catch (e) { to = null; }
  if (!to) return;
  try { if (!stored(ls) && ss) ss.setItem(AUTO, '1'); } catch (e) { /* no storage: the target may take it as a choice */ }
  l.replace(to);
})(typeof window !== 'undefined' ? window : this);
