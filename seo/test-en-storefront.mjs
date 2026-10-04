/* /en/ — the international storefront, and the three things it must never do.
 *
 * Run: node seo/test-en-storefront.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const require = createRequire(import.meta.url);

const EN = read('en/index.html');
const EN_JS = read('en/app.js');
// The English country pages — UAE stands for all 198 (seo/test-en-pages.mjs
// proves every page is the generator's output, so one is every one).
const PAGE = read('en/esim/uae/index.html');
const HUB = read('en/esim/index.html');
const COUNTRY_JS = read('en/country.js');
const PLANS_JS = read('en/plans.js');
const code = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const RU = read('index.html');
const ROBOTS = read('robots.txt');
const SITEMAP = read('sitemap.xml');

/* ===================================================================== *
 * 1. It cannot take money, and that is structural
 * ===================================================================== */

test('no English page script has a network primitive of its own', () => {
  // THE FIRST VERSION OF THIS TEST PINNED SPELLINGS, not the fact: it banned
  // `method:'POST'` in four spacings and `XMLHttpRequest`, and would have passed
  // on `fetch(url, {method: m})`. That is the §30 lesson — a forbidden-phrase
  // test that lists phrases nobody writes passes vacuously. What actually has to
  // be true is that this file cannot reach the network by ANY route, so the ban
  // is on the primitives themselves.
  const FORBIDDEN = [
    ['fetch(', /\bfetch\s*\(/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['sendBeacon', /\bsendBeacon\b/],
    ['WebSocket', /\bWebSocket\b/],
    ['EventSource', /\bEventSource\b/],
    ['MagicNet', /\bMagicNet\b/],
    ['form submit', /\.submit\s*\(/],
    ['import(', /\bimport\s*\(/],
    ['retail-orders', /retail-orders/i],
    ['platega', /platega/i],
    ['quotes', /quotes/i],
  ];
  for (const [file, text] of [['en/app.js', EN_JS], ['en/country.js', COUNTRY_JS], ['en/plans.js', PLANS_JS]]) {
    for (const [name, re] of FORBIDDEN) assert.equal(re.test(code(text)), false, `${name} must not appear in ${file}`);
    assert.equal(/\bMagicCatalog\b/.test(code(text)), false, `the Russian rouble loader must not be used in ${file}`);
  }
  // The country page reads the catalogue through MagicGlobalCatalog (one GET of
  // the GLOBAL lane) — the one and only way an English page talks to anything.
  assert.match(code(COUNTRY_JS), /MagicGlobalCatalog\.load\(\)/);
  // The home reads nothing at all: its destination list is static.
  assert.equal(/MagicGlobalCatalog/.test(code(EN_JS)), false, 'the home must not load the catalogue');
  assert.equal(/MagicGlobalCatalog/.test(code(PLANS_JS)), false, 'plans.js renders, it never loads');
});

test('no English page posts a form', () => {
  for (const [name, html] of [['home', EN], ['country', PAGE], ['list', HUB]]) {
    assert.equal(/<form/i.test(html), false, `${name}: a form is a write primitive the markup can carry`);
  }
});

test('the ban can fire', () => {
  // §26.1. If this regex cannot match, the test above proves nothing.
  const sample = 'var x = fetch("/api/v1/public/retail-orders", {method: m});';
  assert.equal(/\bfetch\s*\(/.test(sample), true);
  assert.equal(/retail-orders/i.test(sample), true);
});

/*
 * THE PAGE SAYS IT SELLS NOTHING BEFORE ANYTHING ON IT LOOKS PURCHASABLE.
 * The first version revealed it only after the visitor typed an email into a
 * checkout that could not take money (audit 2026-10-01, P0). Now the notice is
 * static markup ABOVE the search, and the plan window opens with it and asks
 * for nothing.
 */
const I18N_EN = createRequire(import.meta.url)(join(ROOT, 'assets/site-i18n.js')).DICT.en;

test('the preview notice is static markup, before the search, the prices and every button', () => {
  const notice = EN.indexOf('id="previewNotice"');
  assert.ok(notice > 0, 'the notice must be in the HTML itself, not rendered by JS');
  assert.ok(notice < EN.indexOf('id="plans"'), 'before the search');
  assert.doesNotMatch(EN.slice(notice, EN.indexOf('</div>', notice)), /\bhidden\b/, 'never hidden');
  // And on every country page, before the first plan block and the plan window.
  const n2 = PAGE.indexOf('id="previewNotice"');
  assert.ok(n2 > 0, 'the country page carries the notice in its HTML');
  for (const id of ['dailyBlock', 'localBlock', 'regionalBlock', 'checkout']) {
    assert.ok(n2 < PAGE.indexOf(`id="${id}"`), `before #${id}`);
  }
  assert.doesNotMatch(PAGE.slice(n2, PAGE.indexOf('</div>', n2)), /\bhidden\b/, 'never hidden');
  // Word for word the home's notice: one promise, not two paraphrases.
  const noticeOf = (h) => h.slice(h.indexOf('id="previewNotice"'), h.indexOf('</div>', h.indexOf('id="previewNotice"')));
  assert.equal(noticeOf(PAGE), noticeOf(EN));
  assert.equal(noticeOf(HUB), noticeOf(EN));
  assert.match(I18N_EN['preview.noticeTitle'], /can't be bought here yet/);
  assert.match(I18N_EN['preview.noticeBody'], /checkout is closed and nothing can be ordered/);
});

test('the plan window opens with the refusal and asks for nothing', () => {
  assert.doesNotMatch(EN, /id="checkout"/, 'the home has no plan window: plans live on the country pages');
  const win = PAGE.slice(PAGE.indexOf('id="checkout"'), PAGE.indexOf('</footer>'));
  assert.match(win, /id="coUnavail"/);
  assert.doesNotMatch(win, /id="coUnavail"[^>]*hidden/, 'visible the moment the window opens');
  assert.doesNotMatch(win, /type="email"|id="coEmail"|id="coPay"|<input/, 'no email field, no pay button, no input at all');
  assert.ok(win.indexOf('id="coUnavail"') < win.indexOf('class="rows"'), 'the refusal comes before the price');
  for (const t of [EN_JS, COUNTRY_JS, PLANS_JS]) assert.doesNotMatch(t, /coEmail|coPay|attemptPay|emailInvalid/, 'no checkout step');
  assert.match(I18N_EN['pay.unavailableTitle'], /Not available to buy yet/);
  assert.match(I18N_EN['pay.unavailableBody'], /Nothing is charged and no order is created/);
});

test('no call to action on /en/ promises a purchase', () => {
  // The calls to action are the buttons and the .btn links in the markup, and
  // the button labels en/app.js renders. Refusals («Not available to buy yet»)
  // are not calls to action and are not checked here.
  const ALL = EN + PAGE + HUB;
  const ctaKeys = new Set([
    ...[...ALL.matchAll(/<(?:button|a)\b[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*data-i18n="([^"]+)"/g)].map((m) => m[1]),
    ...[...ALL.matchAll(/<button\b[^>]*data-i18n="([^"]+)"/g)].map((m) => m[1]),
    'site.choose', 'site.retry',
  ]);
  const BUY = /\b(buy|purchase|pay|order|checkout|continue|add to cart)\b/i;
  const offending = [...ctaKeys].filter((k) => BUY.test(I18N_EN[k] || ''));
  assert.deepEqual(offending, []);
  // The markup scan must be able to find a .btn link, or an empty result proves nothing.
  const sampleBtn = '<a class="btn btn-ghost" href="/x" data-i18n="pay.toRussianSite">x</a>';
  assert.equal([...sampleBtn.matchAll(/<(?:button|a)\b[^>]*class="[^"]*\bbtn\b[^"]*"[^>]*data-i18n="([^"]+)"/g)].length, 1,
    'the markup scan finds .btn links');
  assert.equal(I18N_EN['site.choose'], 'View details');
  assert.equal(BUY.test('Buy now'), true, 'the rule can fire');
  assert.equal(BUY.test(I18N_EN['checkout.continue']), true, 'and it fires on the label this page used to show');
});

test('the price note and the notice say US dollars, and never roubles', () => {
  assert.match(I18N_EN['price.currencyNote'], /Prices in US dollars \(USD\)/);
  assert.match(I18N_EN['preview.noticeBody'], /prices in US dollars/);
  assert.match(I18N_EN['preview.noticeBody'], /nothing can be ordered or charged/);
  assert.doesNotMatch(I18N_EN['price.currencyNote'] + I18N_EN['preview.noticeBody'], /₽|rouble|ruble|RUB|EUR|€|reference/i);
});

test('every daily plan on /en/ quotes a price a customer can actually pay', () => {
  /*
   * THE GATE THAT DID NOT EXIST, and the defect it would have caught.
   *
   * A DAILY plan's `price` is a PER-DAY RATE, and one day is not sold. The first
   * version of `en/app.js` priced every card from it, so 1293 of the catalogue's
   * 1324 daily packages advertised a figure nobody can pay — Oman's cheapest
   * card said 200 ₽ where the shortest purchasable term is 600 ₽ — and because
   * the list sorts ascending, those rows led every country.
   *
   * `CLAUDE.md` records this exact trap («for a PER_DAY plan that is a per-day
   * RATE and one day is not sold»), and the previous gate could not see it: it
   * only checked that no `$`, `USD` or `EUR` appeared. It asserted the absence
   * of an invented CURRENCY while the invented NUMBER went straight through.
   *
   * This runs the shipped `priceOf` (en/plans.js) over the real catalogue.
   */
  const DAILY = require(join(ROOT, 'assets/daily-plan-copy.js'));
  const catalogue = JSON.parse(readFileSync(join(ROOT, 'assets/catalog.json'), 'utf8'));
  const packages = catalogue.packages || catalogue;

  // The shipped module itself, not a copy of its function.
  const PLANS = require(join(ROOT, 'en/plans.js'));
  const priceOf = PLANS.create({ I18N: { t: (k) => k }, NAMES: { of: (c) => c }, DAILY }).priceOf;

  const daily = packages.filter((p) => DAILY.isDaily(p));
  assert.ok(daily.length > 100, `only ${daily.length} daily packages — is the catalogue loaded?`);

  const unpayable = [];
  for (const p of daily) {
    const priced = priceOf(p);
    if (!priced) continue;                 // rendered as unavailable, not sold
    const terms = Array.isArray(p.term_prices) ? p.term_prices : [];
    const ok = terms.length
      ? terms.some((t) => Number(t.price) === priced.amount)
      : (String(p.daily_term_mode || '') === 'FIXED_TERM' && Number(p.price) === priced.amount);
    if (!ok) unpayable.push(`${p.package_id}: ${priced.amount} is in no purchasable term`);
  }
  assert.deepEqual(unpayable.slice(0, 5), [], `${unpayable.length} daily plans quote an unpayable price`);
});

test('the daily-price gate can fire', () => {
  // §26.1. Pricing a per-day plan from `p.price` is the defect; this proves the
  // check above distinguishes that from the purchasable ladder.
  const p = { plan_type: 'DAILY', daily_term_mode: 'PER_DAY', price: 200,
    term_prices: [{ days: 3, price: 600 }, { days: 7, price: 1300 }] };
  assert.equal(p.term_prices.some((t) => Number(t.price) === Number(p.price)), false,
    'the rate must not look purchasable, or the gate proves nothing');
});

test('a daily plan always shows the term its price buys', () => {
  // All 31 FIXED_TERM dailies have an empty `DAILY.terms()`, so reading that
  // alone left «China Unlimited 3 Days» priced and undated.
  const DAILY = require(join(ROOT, 'assets/daily-plan-copy.js'));
  const catalogue = JSON.parse(readFileSync(join(ROOT, 'assets/catalog.json'), 'utf8'));
  const packages = (catalogue.packages || catalogue).filter((p) => DAILY.isDaily(p));
  const fixed = packages.filter((p) => String(p.daily_term_mode || '') === 'FIXED_TERM');
  assert.ok(fixed.length > 0, 'no FIXED_TERM daily in the catalogue — the case is untested');
  for (const p of fixed) {
    assert.equal((DAILY.terms(p) || []).length, 0,
      'if this ever has a ladder, the fallback below is no longer the only source of the term');
    assert.ok(Number(p.validity_days) > 0, `${p.package_id} has no validity to fall back to`);
  }
});

test('prices on /en/ are the GLOBAL lane\'s US dollars — never roubles, never converted', () => {
  const c = code(PLANS_JS) + code(COUNTRY_JS) + code(EN_JS);
  assert.match(code(PLANS_JS), /currency: 'USD'/, 'formatted as US dollars');
  assert.equal(/₽|retail_price_rub|catalog\.json|\bRUB\b|toFixed\(0\)/.test(c), false,
    'no rouble sign, no rouble field, no rouble snapshot');
  assert.equal(/\*\s*\d+(\.\d+)?\s*\/|rate|convert/i.test(c.replace(/per-day RATE/g, '')), false,
    'no conversion arithmetic or rate');
  assert.match(PAGE, /data-i18n="price\.currencyNote"/, 'and the country page says which currency');
});

/* ===================================================================== *
 * The GLOBAL catalogue client — read-only, USD-only, no rouble fallback
 * ===================================================================== */

const GLOBAL_JS = read('assets/global-catalog.js');
const GLOBAL = require(join(ROOT, 'assets/global-catalog.js'));

test('the GLOBAL client reads exactly one URL, with GET, through MagicNet — and nothing else', () => {
  const code = GLOBAL_JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(GLOBAL.PATH, '/api/v1/retail/packages?market=global');
  assert.match(code, /net\.request\(PATH, \{ method: 'GET' \}\)/);
  for (const [name, re] of [
    ['fetch(', /\bfetch\s*\(/], ['XMLHttpRequest', /\bXMLHttpRequest\b/], ['sendBeacon', /\bsendBeacon\b/],
    ['POST', /POST/i], ['catalog.json', /catalog\.json/], ['MagicCatalog', /\bMagicCatalog\b/],
    ['retail-orders', /retail-orders/i], ['quotes', /quotes/i], ['platega', /platega/i], ['localStorage', /localStorage/],
  ]) assert.equal(re.test(code), false, `${name} must not appear in assets/global-catalog.js`);
});

test('the GLOBAL client accepts only a GLOBAL, USD, payable answer', () => {
  const ok = (data) => GLOBAL.validate(200, { status: 'success', market: 'global', currency: 'USD', data });
  const fixed = { package_id: 'a', price: 9.99, currency: 'USD' };
  const daily = { package_id: 'b', price: 1.99, currency: 'USD', term_prices: [{ days: 3, price: 3.99 }] };
  assert.deepEqual(ok([fixed, daily]), { ok: true, packages: [fixed, daily] });
  // The lane switched off, busy, broken — each is «unavailable», never a guess.
  assert.deepEqual(GLOBAL.validate(503, { status: 'error', error: 'GLOBAL_PRICING_DISABLED' }), { ok: false, reason: 'disabled' });
  assert.deepEqual(GLOBAL.validate(503, { status: 'error', error: 'GLOBAL_PRICING_NOT_CONFIGURED' }), { ok: false, reason: 'unavailable' });
  assert.deepEqual(GLOBAL.validate(429, {}), { ok: false, reason: 'busy' });
  assert.deepEqual(GLOBAL.validate(0, null), { ok: false, reason: 'unavailable' });
  // A rouble or Russian answer is refused, even with status 200 — the RU catalogue looks like this.
  assert.deepEqual(GLOBAL.validate(200, { status: 'success', currency: 'RUB', data: [fixed] }), { ok: false, reason: 'bad_shape' });
  assert.deepEqual(GLOBAL.validate(200, { market: 'ru', currency: 'USD', data: [fixed] }), { ok: false, reason: 'bad_shape' });
  // Rows nobody can pay are dropped; a row labelled in another currency too.
  assert.deepEqual(ok([{ price: 0 }, { price: -1 }, { term_prices: [{ days: 3, price: 0 }] }, { price: 5, currency: 'RUB' }]),
    { ok: false, reason: 'empty' });
  assert.deepEqual(ok([]), { ok: false, reason: 'empty' });
});

test('the GLOBAL client turns a transport failure into «unavailable», not an exception', async () => {
  const saved = globalThis.MagicNet;
  try {
    globalThis.MagicNet = { request: async () => { throw new Error('offline'); } };
    assert.deepEqual(await GLOBAL.load(), { ok: false, reason: 'unavailable' });
    globalThis.MagicNet = { request: async (path, opts) => {
      assert.equal(path, '/api/v1/retail/packages?market=global');
      assert.deepEqual(opts, { method: 'GET' });
      return { status: 503, body: { status: 'error', error: 'GLOBAL_PRICING_DISABLED' } };
    } };
    assert.deepEqual(await GLOBAL.load(), { ok: false, reason: 'disabled' });
    delete globalThis.MagicNet;
    assert.deepEqual(await GLOBAL.load(), { ok: false, reason: 'unavailable' });
  } finally { if (saved) globalThis.MagicNet = saved; else delete globalThis.MagicNet; }
});

test('no rouble anywhere on /en/: markup, script, stylesheet and every English string it uses', () => {
  const css = read('en/en.css');
  const ALL = EN + PAGE + HUB;
  const keys = new Set([...ALL.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1])
    .concat([...(EN_JS + COUNTRY_JS + PLANS_JS).matchAll(/I18N\.t\('([^']+)'\)/g)].map((m) => m[1])));
  const strings = [...keys].map((k) => I18N_EN[k] || '').join('\n');
  const ROUBLE = /₽|\brub(le|les)?\b|\brouble|\bRUB\b|руб/i;
  // Code without its comments (they explain WHY the rouble snapshot is gone);
  // markup, stylesheet and the visible strings in full.
  const markup = (h) => h.replace(/<!--[\s\S]*?-->/g, '');
  for (const [name, text] of [['en/index.html', markup(EN)], ['en/esim/uae/index.html', markup(PAGE)],
    ['en/esim/index.html', markup(HUB)], ['en/destinations.js', read('en/destinations.js')],
    ['en/app.js', code(EN_JS)], ['en/country.js', code(COUNTRY_JS)], ['en/plans.js', code(PLANS_JS)],
    ['en/en.css', code(css)], ['strings', strings], ['assets/global-catalog.js', code(GLOBAL_JS)]]) {
    // The header's «Перейти на русскую версию» is a language switch, not a price.
    assert.equal(ROUBLE.test(text), false, `${name} mentions roubles`);
  }
  assert.equal(ROUBLE.test('1 150 ₽'), true, 'the rule can fire');
});

test('RU is untouched by the GLOBAL client: the Russian landing loads neither it nor the English stylesheet', () => {
  // (The landing does link to /en/ — that is the language switch, not a script.)
  assert.doesNotMatch(RU, /global-catalog\.js|\/en\/(en\.css|plans\.js|country\.js|app\.js|destinations\.js)/);
  assert.match(RU, /assets\/catalog-loader\.js/, 'the Russian landing still reads its own catalogue');
  for (const [name, html] of [['home', EN], ['country', PAGE], ['list', HUB]]) {
    assert.doesNotMatch(html, /catalog-loader\.js|country-tariffs\.js/, `${name}: no Russian catalogue script on an English page`);
  }
  // No Russian country page loads anything English.
  const bad = readdirSync(join(ROOT, 'esim')).filter((d) => existsSync(join(ROOT, 'esim', d, 'index.html')))
    .filter((d) => /global-catalog\.js|\/en\/(en\.css|plans\.js|country\.js)/.test(read(`esim/${d}/index.html`)));
  assert.deepEqual(bad, []);
});


/* ===================================================================== *
 * 2. It does not touch the Russian site
 * ===================================================================== */

test('no Russian URL was moved, renamed or removed', () => {
  for (const p of ['index.html', 'esim/index.html', 'iphone.html', 'android.html',
    'terms.html', 'privacy.html', 'esim/italy/index.html', 'esim/payment-rubles/index.html']) {
    assert.ok(existsSync(join(ROOT, p)), p);
  }
  // The country pages are all still there.
  const countries = readdirSync(join(ROOT, 'esim')).filter((d) =>
    existsSync(join(ROOT, 'esim', d, 'index.html')));
  assert.ok(countries.length >= 200, `only ${countries.length} pages under /esim/`);
});

test('the Russian landing gained a head and lost nothing else', () => {
  assert.match(RU, /<html lang="ru">/);
  assert.match(RU, /rel="canonical" href="https:\/\/magicesim\.store\/"/);
  // The checkout is still Russian and still Platega's.
  assert.match(RU, /Оформление заказа/);
  assert.match(RU, /Российская карта/);
  assert.match(RU, /Оплата через Platega/);
});

test('no redirect exists in either direction', () => {
  // The language switch is a link the visitor clicks. There is no automatic hop
  // and therefore no loop to get into.
  for (const [name, html] of [['en', EN], ['ru', RU]]) {
    assert.equal(/http-equiv="refresh"/i.test(html), false, name);
    assert.equal(/location\.replace\(|location\.href\s*=/.test(html), false, name);
  }
  for (const [n, t] of [['en/app.js', EN_JS], ['en/country.js', COUNTRY_JS], ['en/plans.js', PLANS_JS], ['country page', PAGE]]) {
    assert.equal(/location\.replace\(|location\.href\s*=|http-equiv="refresh"/i.test(t), false, n);
  }
});

/* ===================================================================== *
 * 3. Crawlable, declared, and not a duplicate
 * ===================================================================== */

test('the language is declared on the page itself', () => {
  assert.match(EN, /<html lang="en">/);
  assert.match(RU, /<html lang="ru">/);
});

test('canonical is self-referencing on both pages', () => {
  assert.match(EN, /<link rel="canonical" href="https:\/\/magicesim\.store\/en\/">/);
  assert.match(RU, /<link rel="canonical" href="https:\/\/magicesim\.store\/" \/>/);
});

test('the hreflang cluster is reciprocal and complete', () => {
  // A one-sided cluster is ignored. Each page must name ITSELF and the other.
  for (const [name, html] of [['en', EN], ['ru', RU]]) {
    assert.match(html, /hreflang="ru" href="https:\/\/magicesim\.store\/"/, name);
    assert.match(html, /hreflang="en" href="https:\/\/magicesim\.store\/en\/"/, name);
    assert.match(html, /hreflang="x-default" href="https:\/\/magicesim\.store\/"/, name);
  }
});

test('no hreflang points at a page that does not exist', () => {
  const targets = [...EN.matchAll(/hreflang="[^"]+" href="https:\/\/magicesim\.store(\/[^"]*)"/g)]
    .concat([...RU.matchAll(/hreflang="[^"]+" href="https:\/\/magicesim\.store(\/[^"]*)"/g)])
    .map((m) => m[1]);
  assert.ok(targets.length >= 6);
  for (const t of new Set(targets)) {
    const file = t === '/' ? 'index.html' : `${t.replace(/^\//, '')}index.html`;
    assert.ok(existsSync(join(ROOT, file)), `${t} -> ${file}`);
  }
});

test('the Russian country pages carry NO alternate, because they have no twin', () => {
  // /en/esim/italy/ exists now, but it is a noindex template: hreflang pairs
  // a page with an INDEXABLE twin, so the Russian page still carries none.
  // When a reviewed English page becomes indexable (PR 8), this test changes.
  const italy = read('esim/italy/index.html');
  assert.equal(/hreflang/.test(italy), false);
  assert.match(italy, /rel="canonical" href="https:\/\/magicesim\.store\/esim\/italy\/"/);
});

test('robots does not block the English page, and still blocks what it blocked', () => {
  assert.equal(/Disallow:\s*\/en\//.test(ROBOTS), false, '/en/ must be crawlable');
  assert.match(ROBOTS, /Disallow: \/app\//);
  assert.match(ROBOTS, /Disallow: \/payment-success\.html/);
  assert.match(ROBOTS, /Sitemap: https:\/\/magicesim\.store\/sitemap\.xml/);
});

test('the sitemap lists the English page exactly once, beside the Russian one', () => {
  const locs = [...SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.filter((l) => l === 'https://magicesim.store/en/').length, 1);
  assert.equal(locs.filter((l) => l === 'https://magicesim.store/').length, 1);
  assert.ok(locs.length >= 209, `sitemap shrank to ${locs.length} — a Russian page was lost`);
  // The English country pages are noindex templates: none of them is listed.
  for (const l of locs.filter((x) => x.includes('/en/'))) {
    assert.equal(l, 'https://magicesim.store/en/', l);
  }
});

test('the English page is not a copy of the Russian one', () => {
  // Duplicate content is decided by the body, not by the URL. These two share
  // no sentence of visible prose.
  const strip = (h) => h.replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const enText = strip(EN);
  assert.equal(/[А-Яа-я]{4,}/.test(enText.replace(/Перейти на русскую версию/g, '')), false,
    'the only Russian on the English page is the link back to the Russian one');
  assert.ok(enText.length > 200, 'the English page has real content');
});

test('the English page HAS structured data, and it is in English', () => {
  // «if any» was the whole defect in the first version: with no JSON-LD present
  // the loop ran zero times and the gate reported clean. A rule whose first
  // assertion does not prove it can fire is not a rule.
  const blocks = [...EN.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.ok(blocks.length >= 1, 'no structured data on the English storefront');

  const types = [];
  for (const [, body] of blocks) {
    const json = JSON.parse(body);
    const text = JSON.stringify(json);
    assert.equal(/[А-Яа-я]/.test(text), false, 'Russian structured data on an English page');
    assert.match(text, /"inLanguage":"en"/, 'the language must be declared, not inferred');
    for (const node of (json['@graph'] || [json])) types.push(node['@type']);
  }
  assert.ok(types.includes('Organization'), 'Organization missing');
  assert.ok(types.includes('WebSite'), 'WebSite missing');
});

test('the English link is outside the container that mobile hides', () => {
  // `.nav-links` is `display:none` below 920px. The first version of the link
  // lived inside it, so it was declared, gated, and invisible on every phone —
  // the readers most likely to need it.
  const navLinks = RU.match(/<div class="nav-links">[\s\S]*?<\/div>/);
  assert.ok(navLinks, 'the nav container moved — this test needs rewriting, not deleting');
  assert.equal(/nav-lang/.test(navLinks[0]), false, 'the language link is inside a hidden container');
  assert.match(RU, /<a class="nav-lang"[^>]*href="\/en\/"/);
  assert.match(RU, /\.nav-links\{display:none\}/, 'if this rule is gone, the test above is moot');
});

test('the English version is reachable from the Russian site, not only declared', () => {
  // An hreflang tag is a signal to a crawler; it is not a way in for a reader,
  // and it passes no internal link equity. Without a real link /en/ was an
  // orphan that nothing on the site pointed at.
  assert.match(RU, /href="\/en\/"[^>]*hreflang="en"/);
});

test('every link from /en/ that lands on a Russian page says so', () => {
  // An English label on a link into `<html lang="ru">` is a small betrayal that
  // costs a visitor a page load to discover.
  for (const html of [EN, PAGE, HUB]) {
    const links = [...html.matchAll(/<a[^>]*href="(\/[a-z-]*\.html|\/|\/esim\/[a-z-]*\/?)"[^>]*>([^<]*)</g)];
    assert.ok(links.length >= 2, 'the scan must find the Russian links');
    for (const [tag, href, label] of links) {
      assert.match(tag, /hreflang="ru"/, `${href} (${label.trim()}) must declare hreflang="ru"`);
    }
  }
});
