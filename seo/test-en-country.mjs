/* The GLOBAL country page after its redesign (2026-10): what the template and
 * the card helpers must keep true. The business rules — the catalogue, USD
 * prices, local / regional / daily, the checkout — are tested where they live;
 * these pin the layout's promises to them.
 *
 * Run: node --test seo/test-en-country.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryPage } from './build-en-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const require = createRequire(import.meta.url);
globalThis.window = globalThis;
require(join(ROOT, 'assets/site-i18n.js'));
require(join(ROOT, 'assets/country-names-en.js'));
require(join(ROOT, 'assets/daily-plan-copy.js'));
const PLANS = require(join(ROOT, 'en/plans.js')).create({
  I18N: globalThis.MagicSiteI18n.createI18n('en'), NAMES: globalThis.MagicCountryNamesEn, DAILY: globalThis.MagicDailyPlan,
});
const CHECKOUT = require(join(ROOT, 'en/checkout.js'));

const PAGES = readdirSync(join(ROOT, 'en/esim'), { withFileTypes: true }).filter((d) => d.isDirectory())
  .map((d) => `en/esim/${d.name}/index.html`);
const JP = read('en/esim/japan/index.html');

/* ------------------------------------------------------------ the per-day picker shows the checkout's own ladder */

test('the card\'s day picker lists exactly the checkout\'s durations — same days, same prices, same order', () => {
  const cases = [
    { daily_term_mode: 'PER_DAY', term_prices: [{ days: 7, price: 10.99 }, { days: 3, price: 4.99 }, { days: 3, price: 9 }, { days: 0, price: 1 }, { days: 5, price: 0 }, { days: 2.5, price: 3 }, { days: 30, price: 35.99 }] },
    { daily_term_mode: 'PER_DAY', term_prices: [] },
    { daily_term_mode: 'PER_DAY' },
    { daily_term_mode: 'FIXED_TERM', price: 15.99, validity_days: 3 },
    { price: 4.99, validity_days: 15 },
  ];
  for (const p of cases) {
    const fromCheckout = CHECKOUT.isPerDay(p) ? CHECKOUT.durations(p) : [];
    assert.deepEqual(PLANS.ladder(p), fromCheckout);
  }
  assert.deepEqual(PLANS.ladder(cases[0]), [{ days: 3, price: 4.99 }, { days: 7, price: 10.99 }, { days: 30, price: 35.99 }]);
});

test('the day picked by default is the one the card is priced from', () => {
  const p = { plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 1, price: 1.49,
    coverage_country_codes: ['TH'], term_prices: [{ days: 7, price: 10.99 }, { days: 3, price: 4.99 }] };
  const priced = PLANS.priceOf(p);
  assert.ok(PLANS.ladder(p).some((t) => t.days === priced.days && t.price === priced.amount));
});

test('a regional card names the other countries it covers, never the page\'s own as «also»', () => {
  const p = { coverage_country_codes: ['TH', 'MY', 'SG', 'VN', 'ID'] };
  assert.equal(PLANS.alsoCovers(p, 'TH', 3), 'Also covers Malaysia, Singapore, Vietnam + 1 more');
  assert.equal(PLANS.alsoCovers({ coverage_country_codes: ['TH', 'MY'] }, 'TH', 3), 'Also covers Malaysia');
  assert.equal(PLANS.alsoCovers({ coverage_country_codes: ['TH'] }, 'TH', 3), '');
  // RU / UA / BY never appear: they are not coverage on this storefront.
  assert.equal(PLANS.alsoCovers({ coverage_country_codes: ['TH', 'RU', 'UA'] }, 'TH', 3), '');
});

/* ------------------------------------------------------------ the template */

test('blocks keep their ids, words and counts, now in the order local → regional → daily', () => {
  const at = (id) => JP.indexOf(`id="${id}Block"`);
  assert.ok(at('local') > 0 && at('local') < at('regional') && at('regional') < at('daily'));
  assert.match(JP, /<h2><span>Plans for Japan<\/span> <span class="count" id="localCount"><\/span><\/h2>\s*<p class="note">Plans that cover Japan only\.<\/p>/);
  assert.match(JP, /<h2><span>Regional plans that include Japan<\/span> <span class="count" id="regionalCount"><\/span><\/h2>\s*<p class="note">Plans that cover Japan together with other countries\.<\/p>/);
  assert.match(JP, /<h2><span>Data every day<\/span> <span class="count" id="dailyCount"><\/span><\/h2>\s*<p class="note">A data allowance for each day of the trip\.<\/p>/);
  for (const b of ['local', 'regional', 'daily']) assert.match(JP, new RegExp(`<div class="grid plan-grid" id="${b}Grid"></div>`));
});

test('the payment bar, then the hero, then the plans — nothing purchasable before the bar', () => {
  const bar = JP.indexOf('id="previewNotice"');
  for (const id of ['cp-hero', 'id="localBlock"', 'id="regionalBlock"', 'id="dailyBlock"', 'id="checkout"']) {
    assert.ok(bar < JP.indexOf(id), id);
  }
});

test('the hero: flag, name, a plain line, and a way back to the destinations', () => {
  assert.match(JP, /<img class="cp-flag" src="\/en\/flags\/jp\.svg" alt="" width="72" height="54">/);
  assert.match(JP, /<h1>eSIM for Japan<\/h1>/);
  assert.match(JP, /<p class="lead">Data plans that work in Japan, with prices in US dollars\.<\/p>/);
  assert.match(JP, /<a class="cp-change" href="\/en\/esim\/">Choose another destination<\/a>/);
  for (const p of PAGES) {
    const iso = (read(p).match(/<body data-iso="([A-Z]{2})">/) || [])[1];
    assert.ok(existsSync(join(ROOT, `en/flags/${iso.toLowerCase()}.svg`)), `${p}: flag`);
  }
});

test('the jump links point at the three blocks and start hidden; the skeleton has no .card and hides without JS', () => {
  assert.match(JP, /<nav class="cp-jump" aria-label="Plan types" hidden>/);
  for (const b of ['local', 'regional', 'daily']) assert.match(JP, new RegExp(`<a href="#${b}Block" hidden>`));
  const sk = JP.slice(JP.indexOf('id="skeleton"'), JP.indexOf('</div>\n', JP.indexOf('id="skeleton"')) + 6);
  assert.match(sk, /aria-hidden="true"/);
  assert.doesNotMatch(sk, /\bcard\b/, 'the error tests count .card: a placeholder must not be one');
  assert.match(read('en/noscript.css'), /#skeleton\{display:none!important\}/);
});

test('«Before you buy» links only to pages that exist, and says nothing new', () => {
  const help = JP.slice(JP.indexOf('class="cp-help"'), JP.indexOf('</section>', JP.indexOf('class="cp-help"')));
  const hrefs = [...help.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 6);
  for (const h of hrefs) {
    if (h.startsWith('mailto:')) { assert.equal(h, 'mailto:support@magicesim.store'); continue; }
    assert.ok(existsSync(join(ROOT, h.slice(1), 'index.html')), h);
  }
  // Every sentence in it is an existing English string or a guide title.
  const keys = [...help.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  const EN = require(join(ROOT, 'assets/site-i18n.js')).DICT.en;
  for (const k of keys) assert.ok(Object.prototype.hasOwnProperty.call(EN, k), k);
});

test('the page carries no price and no claim of its own', () => {
  const body = JP.slice(JP.indexOf('<body'), JP.indexOf('<div class="overlay"'));
  assert.doesNotMatch(body, /\$\s?\d/);
  assert.doesNotMatch(body.replace(/<[^>]+>/g, ' '), /24\/7|\binstant|\bbest\b|\bcheapest|\bpopular\b|\bsave\b|rating|review|guarantee|\bunlimited/i);
  // The same as countryPage() writes — the committed page is the generator's output.
  assert.ok(countryPage({ iso: 'JP', slug: 'japan', name: 'Japan' }).includes('<h1>eSIM for Japan</h1>'));
});

test('country.css reaches nothing outside the site and styles no class nobody uses', () => {
  const css = read('en/country.css');
  assert.doesNotMatch(css, /https?:\/\/|@import|url\(/i);
  let sel = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < 5; i += 1) sel = sel.replace(/\{[^{}]*\}/g, ' ');
  const classes = [...new Set([...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
  const used = new Set([...JP.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  for (const f of ['en/plans.js', 'en/country.js']) {
    const src = read(f);
    for (const m of src.matchAll(/className = '([^']+)'/g)) m[1].split(/\s+/).forEach((c) => used.add(c));
    for (const m of src.matchAll(/span\('([a-z][\w -]*)'/g)) m[1].split(/\s+/).forEach((c) => used.add(c));
    for (const m of src.matchAll(/'(plan-[a-z]+|chip-[a-z]+)'/g)) used.add(m[1]);
    // Classes chosen in a ternary: every quoted class list in the source.
    for (const m of src.matchAll(/'([a-z][a-z0-9-]*(?: [a-z][a-z0-9-]*)*)'/g)) m[1].split(' ').forEach((c) => used.add(c));
  }
  ['plan-local', 'plan-regional', 'plan-daily'].forEach((c) => used.add(c));   // 'plan plan-' + kind
  const dead = classes.filter((c) => !used.has(c));
  assert.deepEqual(dead, []);
});

test('small coloured labels on the page meet WCAG AA (axe found the jump counts at 4.33:1 on live data)', () => {
  const css = read('en/country.css');
  const lum = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const n = css.match(/\.cp-jump \.n\{[^}]*color:(#[0-9a-f]{6})/);
  assert.ok(n, '.cp-jump .n has a literal colour');
  assert.ok(cr(n[1], '#eef2ff') >= 4.5, `jump count ${n[1]} on #eef2ff = ${cr(n[1], '#eef2ff').toFixed(2)}`);
  for (const [sel, bg] of [['.plan-badge', '#eef2ff'], ['.plan-regional .plan-badge', '#f4ecfd'], ['.plan-daily .plan-badge', '#e3f6fa']]) {
    const m = css.match(new RegExp(sel.replace(/\./g, '\\.') + '\\{[^}]*color:(#[0-9a-f]{6})'));
    assert.ok(m && cr(m[1], bg) >= 4.5, `${sel} ${m && m[1]} on ${bg}`);
  }
  assert.ok(cr('#4267e8', '#eef2ff') < 4.5, 'the rule can fire: the old count colour fails');
});
