import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assetVersion } from './asset-version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// seo/site-chrome.mjs — the pieces of the shared design system that live in
// markup rather than in assets/site.css: the font preload, the logo and the
// icons. The English generator (build-en-pages.mjs) and the Russian chrome
// (ru-chrome.mjs) both import them, so the two storefronts draw the same logo
// and the same icons from one source.

/* Inter is self-hosted (font-src 'self'); the latin file is what nearly every
 * English page needs first, so it is fetched alongside the stylesheet. */
export const FONT_PRELOAD = `<link rel="preload" href="/assets/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>`;

/* The logo is the brand's own artwork (assets/magic-esim-logo.png), trimmed of
 * its white margin and exported at 1x/2x/3x for a 44 px header — the artwork
 * itself is unchanged. It carries the name, so its alt is the name. */
export const LOGO = `<img src="/assets/brand/logo-1x.png" srcset="/assets/brand/logo-2x.png 2x, /assets/brand/logo-3x.png 3x" width="59" height="44" alt="Magic eSIM">`;

/* THE ANIMATED HEADER LOGO (approved 2026-10-20: «Reveal + Wave», interface motion «Expressive»).
 * The same logo A, as vector: the geometry is assets/brand/logo.svg (seo/build-logo-svg.mjs — the brand book master with
 * coordinates rounded to 0.1, ≤ 0.05 unit from it), drawn here by two <use> of its #me-symbol and #me-word, so the
 * 31 KB file is fetched once and cached while each page carries ~2.5 KB. The two master gradients are repeated IN the
 * page: WebKit resolves a fill url() of an external <use> against the referencing document and drew only the gold chip
 * without them (measured 2026-10-20: 2 728 px painted instead of 38 971). The three rings are the «wave» layer, faded
 * out above the lettering. Static, it is exactly the header logo; the animation is ru.css `.brand-logo.lm-play`,
 * switched on ONCE PER SESSION by HEADER_MOTION_SCRIPT right after it (before first paint — no flash; no storage → no
 * animation), and never under prefers-reduced-motion. Box: the PNG's 59 × 44 (40 px tall below 900 px). */
const LOGO_GRADIENTS = (() => {
  const svg = readFileSync(join(ROOT, 'assets/brand/logo.svg'), 'utf8');
  const g = svg.match(/<defs>([\s\S]*?)<\/defs>/);
  if (!g) throw new Error('assets/brand/logo.svg: no gradients — run node seo/build-logo-svg.mjs');
  return g[1];
})();
export const LOGO_SVG_URL = `/assets/brand/logo.svg?v=${assetVersion('assets/brand/logo.svg')}`;
const RING = (i) => `<circle class="lm-ring lm-ring${i}" cx="627" cy="372" r="150" fill="none" stroke="url(#me-lw-wave)" stroke-width="7"/>`;
export const LOGO_ANIMATED_SVG = ({ url = LOGO_SVG_URL, cls = 'brand-logo', w = 59, h = 44 } = {}) => `<svg class="${cls}" viewBox="336 208 574 432" width="${w}" height="${h}" role="img" aria-label="Magic eSIM">`
  + `<defs>${LOGO_GRADIENTS}`
  + `<linearGradient id="me-lw-wave" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A16C7"/><stop offset=".52" stop-color="#3866D9"/><stop offset="1" stop-color="#00C7DF"/></linearGradient>`
  + `<linearGradient id="me-lw-fadeg" gradientUnits="userSpaceOnUse" x1="0" y1="430" x2="0" y2="505"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`
  + `<mask id="me-lw-fade" maskUnits="userSpaceOnUse" x="150" y="40" width="950" height="600"><rect x="150" y="40" width="950" height="600" fill="url(#me-lw-fadeg)"/></mask></defs>`
  + `<g class="lm-waves" aria-hidden="true" mask="url(#me-lw-fade)">${RING(1)}${RING(2)}${RING(3)}</g>`
  + `<use class="lm-symbol" href="${url}#me-symbol"/><use class="lm-word" href="${url}#me-word"/></svg>`;
export const MOTION_JS_URL = `/assets/motion.js?v=${assetVersion('assets/motion.js')}`;
/* Runs where it stands, before first paint: turns the interface motion on (<html data-motion>, the ru.css rules), plays
 * the logo once per session (sessionStorage; none → no animation) and loads assets/motion.js without blocking. */
export const HEADER_MOTION_SCRIPT = `<script>(function(){var d=document,r=d.documentElement,l=d.currentScript.previousElementSibling;r.setAttribute('data-motion','expressive');`
  + `try{var s=sessionStorage;if(!s.getItem('me-logo')){s.setItem('me-logo','1');l.classList.add('lm-play')}}catch(e){}`
  + `var j=d.createElement('script');j.src='${MOTION_JS_URL}';j.async=true;d.head.appendChild(j)})();</script>`;
export const LOGO_ANIMATED = LOGO_ANIMATED_SVG() + HEADER_MOTION_SCRIPT;
/* The English pages: the SAME SVG and the same motion as the Russian header, started from assets/logo-once.js in <head>
 * (their CSP refuses inline script — see that file): data-motion before first paint, the logo once per visit, and — on
 * the pages that have something for it (the home and the country pages) — assets/motion.js, named by data-motion-src.
 * LOGO_ONCE_SCRIPT (no motion.js: the guides, the guide list, the destinations hub) or LOGO_ONCE_SCRIPT_MOTION goes in
 * every English <head>, LOGO_ANIMATED_EN in the header. */
export const LOGO_ONCE_SCRIPT = `<script src="/assets/logo-once.js?v=${assetVersion('assets/logo-once.js')}"></script>`;
export const LOGO_ONCE_SCRIPT_MOTION = `<script src="/assets/logo-once.js?v=${assetVersion('assets/logo-once.js')}" data-motion-src="${MOTION_JS_URL}"></script>`;
export const LOGO_ANIMATED_EN = LOGO_ANIMATED_SVG();
/* The Mini App's home logo: the same SVG at the hero's 52 px, playing once when the home screen first shows (app/motion.js
 * drops .lm-play after it, so returning to the tab does not replay it). app/index.html carries it; test-logo-svg pins it. */
export const MINI_APP_LOGO = LOGO_ANIMATED_SVG({ cls: 'brand brand--sm brand-logo lm-play', w: 69, h: 52 });

export const ICON_GLOBE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>';
export const ICON_MENU = '<svg class="ico-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><svg class="ico-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export const SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';

/* The plan-block icons (local, regional, daily) — country pages, both languages. */
export const BLOCK_ICON = {
  local: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>',
  regional: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/></svg>',
  daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
};

/* The guide icons. The first five are the English guides'; the last two are
 * the Russian-only guides (two SIMs and SMS; paying in roubles). */
export const GUIDE_ICON = {
  iphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>',
  android: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="2.5" width="13" height="19" rx="2"/><path d="M5.5 6h13M5.5 18h13"/></svg>',
  compatibility: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/></svg>',
  activation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/></svg>',
  troubleshooting: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.8 1.8 0 0 0 2.6 2.6l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>',
  sim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="9" height="13" rx="2"/><rect x="12" y="4" width="9" height="13" rx="2"/><path d="M6 10h3M15 8h3"/></svg>',
  payment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/></svg>',
};
