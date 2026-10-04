/* The GLOBAL storefront's design system and home (2026-10 redesign).
 *
 * The home (en/index.html) is hand-written; every other English page comes
 * from seo/build-en-pages.mjs. These tests hold the two together — one header,
 * one payment-status bar, one footer — and pin what the home may and may not
 * carry: no price in the HTML, no catalogue read, no external resource, only
 * destinations and guides that exist.
 *
 * Run: node --test seo/test-en-home.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { header, PAYBAR, FOOTER, LOGO, POPULAR, FONT_PRELOAD } from './build-en-pages.mjs';
import { EN_GUIDES } from './guides-en.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const HOME = read('en/index.html');
const I18N_EN = createRequire(import.meta.url)(join(ROOT, 'assets/site-i18n.js')).DICT.en;

function htmlUnder(dir, out = []) {
  for (const d of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (d.isDirectory()) htmlUnder(`${dir}/${d.name}`, out);
    else if (d.name.endsWith('.html')) out.push(`${dir}/${d.name}`);
  }
  return out;
}
const PAGES = htmlUnder('en');
const DESTINATIONS = [...read('en/destinations.js').matchAll(/iso: "([A-Z]{2})", slug: "([a-z0-9-]+)"/g)]
  .map((m) => ({ iso: m[1], slug: m[2] }));

/* ------------------------------------------------------------ one chrome */

test('the home carries the generator\'s header, payment bar and footer, verbatim', () => {
  assert.ok(HOME.includes(header('/')), 'header (language switch to the Russian landing)');
  assert.ok(HOME.includes(PAYBAR), 'payment-status bar');
  assert.ok(HOME.includes(FOOTER), 'footer');
  assert.ok(HOME.includes(FONT_PRELOAD), 'font preload');
  // The rule can fire: a one-character drift is caught.
  assert.equal(HOME.includes(FOOTER.replace('Help', 'Hlp')), false);
});

test('every English page has the same header shape, the same footer, and the bar where plans are sold', () => {
  assert.equal(PAGES.length, 206);
  for (const p of PAGES) {
    const h = read(p);
    assert.ok(h.includes(FOOTER), `${p}: footer`);
    assert.ok(h.includes(LOGO), `${p}: logo`);
    assert.match(h, /<header class="site-header">/, p);
    assert.match(h, /<details class="mnav">\s*<summary aria-label="Menu">/, `${p}: the mobile menu`);
    const isGuide = p.startsWith('en/guides/');
    assert.equal(h.includes(PAYBAR), !isGuide, `${p}: the payment bar is on every page that lists plans, and only there`);
  }
});

test('the mobile menu offers exactly the desktop links, plus the language switch', () => {
  const desk = [...HOME.slice(HOME.indexOf('<nav class="nav"'), HOME.indexOf('</nav>')).matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const panel = HOME.slice(HOME.indexOf('<nav class="mnav-panel"'), HOME.indexOf('</nav>', HOME.indexOf('<nav class="mnav-panel"')));
  const mob = [...panel.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(desk, ['/en/esim/', '/en/#how', '/en/#compat', '/en/guides/']);
  assert.deepEqual(mob, [...desk, '/']);
});

/* ------------------------------------------------------------ what the home shows */

test('popular destinations are real pages with real flags, in the declared order', () => {
  const tiles = [...HOME.matchAll(/<a class="dest-tile" href="\/en\/esim\/([a-z0-9-]+)\/"><img class="flag" src="\/en\/flags\/([a-z]{2})\.svg"[^>]*><span><b>([^<]+)<\/b>/g)]
    .map((m) => ({ slug: m[1], iso: m[2].toUpperCase(), name: m[3] }));
  assert.deepEqual(tiles, POPULAR.map((c) => ({ slug: c.slug, iso: c.iso, name: c.name })));
  for (const c of POPULAR) {
    assert.ok(existsSync(join(ROOT, `en/esim/${c.slug}/index.html`)), `${c.slug} has an English page`);
    assert.ok(DESTINATIONS.some((d) => d.iso === c.iso && d.slug === c.slug), `${c.slug} is ${c.iso} in the destination list`);
  }
});

test('every link on the home lands on a file that exists', () => {
  const hrefs = [...HOME.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
  assert.ok(hrefs.length > 30);
  for (const h of hrefs) {
    const file = h.endsWith('/') ? `${h}index.html` : h;
    assert.ok(existsSync(join(ROOT, file.slice(1))), `${h} does not exist`);
  }
  for (const src of [...HOME.matchAll(/src="(\/[^"?]+)/g)].map((m) => m[1])) {
    assert.ok(existsSync(join(ROOT, src.slice(1))), `${src} does not exist`);
  }
});

test('the guide cards are the five guides, with their own titles and blurbs', () => {
  const cards = [...HOME.matchAll(/<a class="guide-card" href="\/en\/guides\/([a-z]+)\/"><b>([^<]+)<\/b><span>([^<]+)<\/span>/g)]
    .map((m) => [m[1], m[2], m[3]]);
  const esc = (s) => s.replace(/&/g, '&amp;');
  assert.deepEqual(cards, EN_GUIDES.map((g) => [g.slug, esc(g.h1), esc(g.blurb)]));
});

test('the home shows no price and reads no catalogue', () => {
  const body = HOME.slice(HOME.indexOf('<body'));
  assert.doesNotMatch(body, /\$\s?\d|\bUSD\s?\d|\d\s?USD\b/, 'no amount in the HTML: prices live on the country pages');
  assert.match(HOME, /connect-src 'none'/, 'and the CSP lets it call nothing');
  assert.doesNotMatch(HOME, /global-catalog\.js|magic-net\.js|checkout\.js/);
});

test('the search: one labelled field and one button, results as links, a no-JS way round', () => {
  assert.match(HOME, /<label for="q" data-i18n="site\.chooseCountry">Where are you going\?<\/label>/);
  assert.match(HOME, /<input type="text" id="q"/);
  assert.match(HOME, /<button type="button" class="btn" id="qGo" data-i18n="home\.find">Find plans<\/button>/);
  assert.match(HOME, /<noscript><p class="note nojs-search">[^<]*<a href="\/en\/esim\/">Browse all destinations<\/a>/);
  const APP = read('en/app.js');
  assert.match(APP, /first\.click\(\)/, 'the best match is followed as a click, never by assigning a location');
  assert.match(APP, /\/\^\[A-Z\]\{2\}\$\/\.test\(d\.iso\)/, 'the flag path is built from a checked ISO code');
});

/* ------------------------------------------------------------ words */

test('every new English string exists, and none promises what the shop cannot stand behind', () => {
  const keys = [...new Set([...HOME.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1])
    .concat([...HOME.matchAll(/data-i18n-attr="[^":]+:([^"]+)"/g)].map((m) => m[1])))];
  const missing = keys.filter((k) => !Object.prototype.hasOwnProperty.call(I18N_EN, k));
  assert.deepEqual(missing, []);
  const homeKeys = Object.keys(I18N_EN).filter((k) => /^(home|footer|nav|preview)\./.test(k));
  const CLAIM = /24\/7|\binstant|\bbest\b|\bfastest|\bcheapest|guarantee|\brefund|\bunlimited|\bsave\b|\bno\.? ?1\b|rating|review|trusted|million/i;
  for (const k of homeKeys) assert.doesNotMatch(I18N_EN[k], CLAIM, `${k}: «${I18N_EN[k]}»`);
  assert.equal(CLAIM.test('Fast support 24/7'), true, 'the rule can fire');
  // And the markup's static text is held to the same rule.
  const text = HOME.slice(HOME.indexOf('<main')).replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, CLAIM);
});

/* ------------------------------------------------------------ assets */

test('Inter is self-hosted, licensed, and the only font the stylesheet asks for', () => {
  const CSS = read('en/en.css');
  const urls = [...CSS.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].replace(/["']/g, ''));
  assert.ok(urls.length >= 2);
  for (const u of urls) {
    assert.match(u, /^\/en\/fonts\/inter-latin(-ext)?-wght-normal\.woff2$/, u);
    assert.ok(existsSync(join(ROOT, u.slice(1))), u);
  }
  assert.match(read('en/fonts/OFL.txt'), /SIL Open Font License/);
  assert.match(CSS, /--font:"Inter",/);
});

test('no stylesheet reaches outside the site (the CSP allows only self)', () => {
  for (const f of ['en/en.css', 'en/home.css']) {
    assert.doesNotMatch(read(f), /https?:\/\/|@import/i, f);
  }
});

test('every destination has its flag, and the flags are licensed', () => {
  assert.equal(DESTINATIONS.length, 198);
  const missing = DESTINATIONS.filter((d) => !existsSync(join(ROOT, `en/flags/${d.iso.toLowerCase()}.svg`)));
  assert.deepEqual(missing, []);
  for (const f of readdirSync(join(ROOT, 'en/flags')).filter((x) => x.endsWith('.svg'))) {
    const svg = read(`en/flags/${f}`);
    assert.match(svg, /^<svg[^>]*viewBox="0 0 640 480"/, `${f} is a 4:3 SVG`);
    assert.doesNotMatch(svg, /<script|on[a-z]+=|href="(?:https?:|javascript:)/i, `${f} is inert`);
  }
  assert.match(read('en/flags/LICENSE.txt'), /MIT/);
});

test('the logo is the brand artwork at 1x, 2x and 3x of a 44 px header', () => {
  const size = (p) => { const b = readFileSync(join(ROOT, p)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(size('en/img/logo-1x.png'), [59, 44]);
  assert.deepEqual(size('en/img/logo-2x.png'), [117, 88]);
  assert.deepEqual(size('en/img/logo-3x.png'), [176, 132]);
});

test('the design system keeps the brand palette and the contrast the tests pin', () => {
  const CSS = read('en/en.css');
  assert.match(CSS, /--grad:linear-gradient\(135deg,#8a16c7 0%,#3866d9 52%,#00c7df 100%\)/, 'the Russian landing\'s gradient');
  assert.match(CSS, /--bg:#f7f9fc;/);
  assert.match(CSS, /--accent-btn:#4267e8;/);
});

/* ------------------------------------------------------------ RU untouched */

test('the Russian site loads nothing of the English design system', () => {
  const RU = read('index.html');
  assert.doesNotMatch(RU, /\/en\/(en|home)\.css|\/en\/fonts\/|\/en\/flags\/|\/en\/img\//);
});
