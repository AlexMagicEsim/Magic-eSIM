/* The English pages' browser scripts take every word, the number format and
 * the route prefix from the site dictionary — and say exactly what they said
 * before (I18N-08b).
 *
 *   1. NOTHING MOVED. A fingerprint of every en/plans.js helper over a frozen
 *      catalogue sample equals the one the code produced before the move
 *      (test/fixtures/en-plans-golden.json, basis 17f18445), and the words the
 *      DOM-only scripts build are pinned to their former literals.
 *   2. NO WORD IS TYPED INTO A SCRIPT AGAIN. en/{plans,country,hub,checkout,app}.js
 *      carry no interface phrase, no `'en'`, `'en-US'` or `/en/` literal; the
 *      language is the page's own `<html lang>`.
 *   3. THE DICTIONARY'S NEW HELPERS are safe: placeholders from own properties
 *      only, plurals by the language's rules, the page language and prefix.
 *
 * Run: node --test seo/test-en-browser-words.mjs
 */
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const require = createRequire(import.meta.url);
const MATRIX = require(join(ROOT, 'test/fixtures/en-plans-matrix.js'));
const GOLDEN = JSON.parse(read('test/fixtures/en-plans-golden.json'));
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const EN = SITE.createI18n('en');

const SCRIPTS = ['en/plans.js', 'en/country.js', 'en/hub.js', 'en/checkout.js', 'en/app.js'];

/* ===================================================================== *
 * 1. Nothing moved
 * ===================================================================== */

test('every en/plans.js helper says what it said before the move — 14 fingerprints over a frozen sample', () => {
  const now = MATRIX.fingerprint(ROOT);
  assert.deepEqual(now.counts, GOLDEN.counts);
  const moved = Object.keys(GOLDEN.hashes).filter((k) => now.hashes[k] !== GOLDEN.hashes[k]);
  assert.deepEqual(moved, []);
  assert.deepEqual(Object.keys(now.hashes), Object.keys(GOLDEN.hashes));
});

test('the fingerprint can fire: one changed word in the dictionary moves exactly the helpers that use it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'en-words-'));
  try {
    for (const f of MATRIX.SCRIPTS) {
      mkdirSync(join(dir, dirname(f)), { recursive: true });
      let src = read(f);
      if (f === 'assets/site-i18n.js') src = src.replace("'plan.ip': 'IP: {names}'", "'plan.ip': 'IP — {names}'");
      writeFileSync(join(dir, f), src);
    }
    const now = MATRIX.fingerprint(dir);
    const moved = Object.keys(GOLDEN.hashes).filter((k) => now.hashes[k] !== GOLDEN.hashes[k]);
    assert.deepEqual(moved, ['ipLabel', 'classify']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the words the DOM-only scripts build are their former literals, exactly', () => {
  // en/country.js — the fold button
  assert.equal(EN.t('plan.showAll', { n: 7 }), 'Show all 7 plans');
  assert.equal(EN.t('plan.showFewer'), 'Show fewer plans');
  // en/hub.js — the live count (was: shown === 0 ? 'No matches' : shown + (shown === 1 ? ' destination' : ' destinations') + ' match')
  assert.equal(EN.t('hub.noMatches'), 'No matches');
  for (const n of [1, 2, 3, 12, 21, 198]) {
    assert.equal(EN.plural('hub.matches', n, { n }), n + (n === 1 ? ' destination' : ' destinations') + ' match', String(n));
  }
  // en/checkout.js and en/plans.js — a term (was: d + ' ' + (d === 1 ? 'day' : 'days'), and d + ' days')
  for (const d of [1, 2, 3, 7, 30]) assert.equal(EN.plural('plan.dayCount', d, { n: d }), d + (d === 1 ? ' day' : ' days'), String(d));
  // en/checkout.js — the countdown and the announcement (was: t + ' ' + clock, and t + ' ' + price + '.')
  assert.equal(EN.t('quote.heldFor', { time: '29:59' }), 'Price held for 29:59');
  assert.equal(EN.t('quote.fixed', { price: '$12.34' }), 'The price is fixed: $12.34.');
  assert.equal(EN.t('fmt.listSeparator'), ', ');
  // en/plans.js — the card's own words
  assert.equal(EN.t('plan.badgeLocal'), 'Local plan');
  assert.equal(EN.t('plan.badgeRegional'), 'Regional plan');
  assert.equal(EN.t('plan.badgeDaily'), 'Daily plan');
  assert.equal(EN.t('plan.daysLegend'), 'Days');
  assert.equal(EN.t('fmt.numberLocale'), 'en-US');
});

test('the duration options never meet «1 days»: the catalogue sells no one-day term, and the plural now covers it anyway', () => {
  const sample = JSON.parse(read('test/fixtures/en-plans-catalogue.json')).packages;
  const days = sample.flatMap((p) => (p.term_prices || []).map((t) => Number(t.days)));
  assert.ok(days.length > 100);
  assert.equal(days.includes(1), false);
});

/* ===================================================================== *
 * 2. No word is typed into a script again
 * ===================================================================== */

const KEY_NAMES = new Set(['Enter', 'Escape', 'Tab']);
// The one phrase allowed inline, and why: it is shown when a script failed to
// load — the dictionary may be the script that is missing.
const ALLOWED = new Set(['Prices are temporarily unavailable. Please reload the page — nothing can be ordered here yet.']);

function code(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
}
function literals(src) {
  return [...code(src).matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"/g)].map((m) => m[1] ?? m[2]);
}
const CLASS_LIST = /^[a-z][a-z0-9-]*( [a-z][a-z0-9-]*)+$/;
const SELECTOR = /\[|^[a-z.#][\w.#-]*(, [a-z.#][\w.#-]*)+$/;
function phrases(src) {
  return literals(src).filter((s) => {
    if (ALLOWED.has(s)) return false;
    if (/ /.test(s)) return !CLASS_LIST.test(s) && !SELECTOR.test(s);
    return /^[A-Z][a-z]+$/.test(s) && !KEY_NAMES.has(s);
  });
}

test('the phrase check fires on what the scripts used to say', () => {
  const before = [
    "var badgeText = kind === 'regional' ? 'Regional plan' : kind === 'daily' ? 'Daily plan' : 'Local plan';",
    "lg.textContent = 'Days';",
    "return ops.length > 1 ? ops.length + ' networks' : '';",
    "return c.length ? 'IP: ' + c.join(', ') : '';",
    "return 'Also covers ' + names.join(', ') + (rest > 0 ? ' + ' + rest + ' more' : '');",
    "more.textContent = open ? 'Show fewer plans' : 'Show all ' + list.length + ' plans';",
    "count.textContent = shown === 0 ? 'No matches' : shown + ' destinations match';",
    "o.textContent = d.days + ' days';",
  ];
  for (const line of before) assert.ok(phrases(line).length > 0, line);
  // …and stays quiet on what is not a phrase.
  assert.deepEqual(phrases("x.className = 'chip chip-net is-diff'; q('button, input'); k === 'Enter'; c('li[data-name]:not([hidden])');"), []);
});

test('no interface phrase is typed into an English browser script', () => {
  const found = SCRIPTS.flatMap((f) => phrases(read(f)).map((s) => `${f}: ${JSON.stringify(s)}`));
  assert.deepEqual(found, []);
});

test('no script names its language, its number locale or its route', () => {
  for (const f of SCRIPTS) {
    const lits = literals(read(f));
    assert.deepEqual(lits.filter((s) => s === 'en' || /^en-[A-Z]{2}$/.test(s) || /^\/en(\/|$)/.test(s)), [], f);
    assert.doesNotMatch(code(read(f)), /createI18n\(\s*['"]/, `${f}: the language must come from the page`);
  }
  for (const f of ['en/hub.js', 'en/app.js']) assert.match(read(f), /createI18n\(window\.MagicSiteI18n\.pageLang\(document\)\)/, f);
  // I18N-08c: en/country.js reads the language once (it also picks the names file by it).
  assert.match(read('en/country.js'), /var LANG = SITE \? SITE\.pageLang\(document\) : '';[\s\S]*var I18N = SITE\.createI18n\(LANG\);/);
});

test('every English page that runs a word-using script loads the dictionary before it', () => {
  const pages = ['en/index.html', 'en/esim/index.html', 'en/esim/thailand/index.html', 'en/esim/japan/index.html'];
  for (const p of pages) {
    const html = read(p);
    const dict = html.indexOf('/assets/site-i18n.js?v=');
    assert.ok(dict > 0, `${p}: no dictionary`);
    for (const s of ['/en/plans.js', '/en/country.js', '/en/hub.js', '/en/checkout.js', '/en/app.js']) {
      const at = html.indexOf(`${s}?v=`);
      if (at !== -1) assert.ok(dict < at, `${p}: ${s} before the dictionary`);
    }
  }
});

/* ===================================================================== *
 * 3. The dictionary's new helpers
 * ===================================================================== */

test('t(key, vars) fills placeholders from own properties only, as text', () => {
  assert.equal(EN.t('plan.networks', { n: 2 }), '2 networks');
  assert.equal(EN.t('plan.ip', { names: '<b>x</b>' }), 'IP: <b>x</b>'); // still a string; callers use textContent
  assert.equal(EN.t('plan.networks', {}), '{n} networks');
  assert.equal(EN.t('plan.networks', Object.create({ n: 9 })), '{n} networks');
  assert.equal(EN.t('plan.networks'), '{n} networks');
  assert.equal(EN.t('site.choose', { n: 1 }), 'View details');
  assert.equal(EN.t('__proto__', { n: 1 }), '__proto__');
});

test('plural() follows the language\'s rule and falls back to .other', () => {
  assert.equal(EN.plural('plan.country', 1), 'country');
  assert.equal(EN.plural('plan.country', 0), 'countries');
  assert.equal(EN.plural('plan.country', 21), 'countries');
  // A base with no forms of its own is not a plural: the missing .other key comes back as itself.
  assert.equal(EN.plural('plan.networks', 3, { n: 3 }), 'plan.networks.other');
});

test('pageLang reads <html lang>; pathPrefix gives each language its start of path', () => {
  const doc = (lang) => ({ documentElement: { getAttribute: (k) => (k === 'lang' ? lang : null) } });
  assert.equal(SITE.pageLang(doc('en')), 'en');
  assert.equal(SITE.pageLang(doc('ru')), 'ru');
  assert.equal(SITE.pageLang(doc('es')), 'es');
  for (const v of ['de', 'EN', '', null, 'en-US', '__proto__']) assert.equal(SITE.pageLang(doc(v)), 'ru', String(v));
  assert.equal(SITE.pathPrefix('en'), '/en');
  assert.equal(SITE.pathPrefix('ru'), '');
  assert.equal(SITE.pathPrefix('es'), '/es');
  assert.equal(SITE.pathPrefix('de'), '');
  assert.ok(Object.isFrozen(SITE.PREFIX));
});
