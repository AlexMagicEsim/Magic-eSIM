/* /en/ — the international storefront, and the three things it must never do.
 *
 * Run: node seo/test-en-storefront.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const EN = read('en/index.html');
const EN_JS = read('en/app.js');
const RU = read('index.html');
const ROBOTS = read('robots.txt');
const SITEMAP = read('sitemap.xml');

/* ===================================================================== *
 * 1. It cannot take money, and that is structural
 * ===================================================================== */

test('the English storefront has no network primitive at all', () => {
  // THE FIRST VERSION OF THIS TEST PINNED SPELLINGS, not the fact: it banned
  // `method:'POST'` in four spacings and `XMLHttpRequest`, and would have passed
  // on `fetch(url, {method: m})`. That is the §30 lesson — a forbidden-phrase
  // test that lists phrases nobody writes passes vacuously. What actually has to
  // be true is that this file cannot reach the network by ANY route, so the ban
  // is on the primitives themselves.
  const code = EN_JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [name, re] of [
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
  ]) {
    assert.equal(re.test(code), false, `${name} must not appear in en/app.js`);
  }
  // The catalogue is read through MagicCatalog, which is GET-only — that is the
  // one and only way this page talks to anything.
  assert.match(code, /MagicCatalog\.load\(\)/);
});

test('the English page posts no form, anywhere', () => {
  assert.equal(/<form/i.test(EN), false, 'a form is a write primitive the markup can carry');
});

test('the ban can fire', () => {
  // §26.1. If this regex cannot match, the test above proves nothing.
  const sample = 'var x = fetch("/api/v1/public/retail-orders", {method: m});';
  assert.equal(/\bfetch\s*\(/.test(sample), true);
  assert.equal(/retail-orders/i.test(sample), true);
});

test('the payment step exists, is hidden until asked for, and says nothing was charged', () => {
  assert.match(EN, /id="coUnavail"[^>]*hidden/, 'the notice must not be visible before the step');
  assert.match(EN, /data-i18n="pay\.unavailableTitle"/);
  assert.match(EN, /data-i18n="pay\.unavailableBody"/);
  // The one thing a visitor needs to know at a dead payment step.
  const dict = readFileSync(join(ROOT, 'assets/site-i18n.js'), 'utf8');
  assert.match(dict, /Nothing has been charged and no order has been created/);
});

test('the page invents no international price', () => {
  // The catalogue holds one real price per plan and it is in roubles. Anything
  // that looked like a converted USD figure would be the number the global
  // pricing lane is supposed to produce later, guessed early.
  assert.equal(/\$\s*\d/.test(EN_JS), false, 'no dollar amounts');
  assert.equal(/USD|EUR/.test(EN_JS), false, 'no currency conversion');
  assert.match(EN_JS, /toLocaleString\('en-US'\) \+ ' ₽'/, 'roubles, formatted for an English reader');
  assert.match(EN, /data-i18n="price\.currencyNote"/, 'and the page says so');
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
  assert.equal(/location\.replace\(|location\.href\s*=/.test(EN_JS), false, 'en/app.js');
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
  // An hreflang pointing at a page that does not exist is an error, not a
  // placeholder. When /en/esim/<country>/ is written, this test changes with it.
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
  // Nothing under /en/ that does not exist.
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

test('the English version is reachable from the Russian site, not only declared', () => {
  // An hreflang tag is a signal to a crawler; it is not a way in for a reader,
  // and it passes no internal link equity. Without a real link /en/ was an
  // orphan that nothing on the site pointed at.
  assert.match(RU, /href="\/en\/"[^>]*hreflang="en"/);
});

test('every link from /en/ that lands on a Russian page says so', () => {
  // An English label on a link into `<html lang="ru">` is a small betrayal that
  // costs a visitor a page load to discover.
  const links = [...EN.matchAll(/<a[^>]*href="(\/[a-z-]*\.html|\/)"[^>]*>([^<]*)</g)];
  for (const [tag, href, label] of links) {
    if (href === '/en/') continue;
    assert.match(tag, /hreflang="ru"/, `${href} (${label.trim()}) must declare hreflang="ru"`);
  }
});
