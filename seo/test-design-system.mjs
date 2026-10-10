// The shared design system (2026-10-10): assets/site.css is ONE stylesheet for
// the Russian and the English storefront, so their design cannot drift apart.
// What this pins:
//   1. Inter is self-hosted for latin, latin-ext AND cyrillic — the Russian
//      pages render in Inter, not in a fallback — and the three files are the
//      exact @fontsource-variable/inter 5.3.0 files (the latin ones are the
//      files /en/ shipped since #35);
//   2. site.css is locale-neutral: no copy, no currency, no market — a rule
//      that only one storefront may have lives in that storefront's own layer
//      (the GLOBAL payment-status bar is en/en.css);
//   3. every English page loads site.css, then its own en/en.css — in that
//      order, because the layer is written to sit on top;
//   4. the shared files no longer exist under /en/.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const CSS = read('assets/site.css');

const FONTS = {
  'inter-latin-wght-normal.woff2': '3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62',
  'inter-latin-ext-wght-normal.woff2': '34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956',
  'inter-cyrillic-wght-normal.woff2': '71d5ee93cc1e9f1d520a3a8b66456de18c7879d8df09d57fcd2eaff75fef0075',
};

test('Inter covers latin, latin-ext and cyrillic, from the pinned files', () => {
  for (const [file, sha] of Object.entries(FONTS)) {
    const got = createHash('sha256').update(readFileSync(join(ROOT, 'assets/fonts', file))).digest('hex');
    assert.equal(got, sha, file);
    assert.ok(CSS.includes(`url(/assets/fonts/${file})`), `${file} is declared`);
  }
  const cyr = CSS.split('\n').find((l) => l.includes('inter-cyrillic-wght-normal.woff2'));
  assert.match(cyr, /unicode-range:[^}]*U\+0400-045F/, 'the Russian alphabet, ё included');
  // ₽ (U+20BD) is in the latin-ext file's range.
  const ext = CSS.split('\n').find((l) => l.includes('inter-latin-ext-wght-normal.woff2'));
  assert.match(ext, /U\+20AD-20C0/);
});

test('site.css is locale-neutral: no copy, no currency, no market', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /[А-Яа-яЁё]/, 'no Russian text');
  assert.doesNotMatch(rules, /₽|\$\d|\bUSD\b|\bRUB\b|руб/i, 'no currency');
  assert.doesNotMatch(rules, /\.paybar|global|platega|flitt/i, 'no market-specific component');
  // the rule can fire
  assert.match('.paybar{color:red}', /\.paybar|global|platega|flitt/i);
});

function htmlUnder(dir, out = []) {
  for (const n of readdirSync(join(ROOT, dir))) {
    const p = join(dir, n);
    if (statSync(join(ROOT, p)).isDirectory()) htmlUnder(p, out);
    else if (n.endsWith('.html')) out.push(p);
  }
  return out;
}

test('every English page loads site.css and then its own en/en.css', () => {
  const pages = htmlUnder('en');
  assert.ok(pages.length >= 205, `English pages: ${pages.length}`);
  const bad = pages.filter((p) => !/<link rel="stylesheet" href="\/assets\/site\.css\?v=[0-9a-f]{8}">\n<link rel="stylesheet" href="\/en\/en\.css\?v=[0-9a-f]{8}">/.test(read(p)));
  assert.deepEqual(bad, []);
});

test('the shared files live in /assets only', () => {
  for (const gone of ['en/fonts', 'en/img', 'en/flags']) assert.equal(existsSync(join(ROOT, gone)), false, gone);
  for (const here of ['assets/fonts/OFL.txt', 'assets/flags/LICENSE.txt', 'assets/brand/logo-1x.png']) assert.ok(existsSync(join(ROOT, here)), here);
});

// ---- the Russian pages on the shared design system (RU↔EN parity, PR 2) ----

const RU_GENERATED = () => {
  const out = ['esim/index.html', 'iphone.html', 'android.html'];
  for (const d of readdirSync(join(ROOT, 'esim'))) {
    if (existsSync(join(ROOT, 'esim', d, 'index.html'))) out.push(`esim/${d}/index.html`);
  }
  return out;
};

test('every generated Russian page loads site.css, its page sheet and ru.css — in that order', () => {
  const pages = RU_GENERATED();
  assert.ok(pages.length >= 205, `Russian generated pages: ${pages.length}`);
  const bad = [];
  for (const p of pages) {
    const h = read(p);
    const at = (f) => h.indexOf(`href="/assets/${f}?v=`);
    const page = ['page-country.css', 'page-hub.css', 'page-guides.css'].map(at).filter((i) => i > 0);
    if (!(at('site.css') > 0 && page.length === 1 && at('site.css') < page[0] && page[0] < at('ru.css'))) bad.push(p);
    if (/country-pages\.css|\/en\/[a-z]+\.css/.test(h)) bad.push(`${p}: an old or English-only sheet`);
  }
  assert.deepEqual(bad, []);
});

test('the Russian header and footer are the shared chrome, with the Russian market only', () => {
  for (const p of ['esim/turkey/index.html', 'esim/index.html', 'iphone.html']) {
    const h = read(p);
    assert.match(h, /<header class="site-header">/, `${p}: header`);
    assert.match(h, /<footer class="site-footer">/, `${p}: footer`);
    assert.match(h, /<a class="langsw" href="\/en\/" lang="en">/, `${p}: English is /en/, never a noindex template`);
    assert.doesNotMatch(h, /class="paybar"|previewNotice/, `${p}: no GLOBAL payment bar on the Russian site`);
    assert.doesNotMatch(h, /\bUSD\b|\$\d/, `${p}: no dollars`);
    assert.doesNotMatch(h, /href="\/en\/(esim|guides)\//, `${p}: no link to an English template page`);
    assert.match(h, /190\+ направлений/, `${p}: the one measured wording for the catalogue size`);
  }
});

test('the measured catalogue size still supports «190+ направлений»', () => {
  // 198 countries rendered plans on 2026-10-10. If the catalogue ever drops
  // below 190, the wording must change before the build ships.
  const { countries } = JSON.parse(read('seo/catalogue-countries.json'));
  assert.ok(countries.length >= 190, `countries with plans: ${countries.length}`);
});

// ---- the Russian home on the shared design system (RU↔EN parity, PR 3) ----

test('the home is styled only by the shared sheets, in order, with no inline <style>', () => {
  const h = read('index.html');
  assert.doesNotMatch(h, /<style\b/, 'an inline stylesheet is a second design system');
  const at = (f) => h.indexOf(`href="/assets/${f}?v=`);
  const order = ['site.css', 'page-home.css', 'page-country.css', 'ru.css'].map(at);
  assert.ok(order.every((i) => i > 0), `missing sheet: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'site.css → page-home.css → page-country.css → ru.css');
  assert.ok(order[3] < h.indexOf('<!-- Yandex.Metrika counter -->'), 'the sheets come before the counter');
});

test('the home header and footer are the ONE Russian chrome, byte for byte', async () => {
  const { ruHeader, RU_FOOTER } = await import('./ru-chrome.mjs');
  const h = read('index.html');
  assert.ok(h.includes(ruHeader({ hreflang: true })), 'index.html header drifted from seo/ru-chrome.mjs');
  assert.ok(h.includes(RU_FOOTER), 'index.html footer drifted from seo/ru-chrome.mjs');
  // the rule can fire
  assert.equal(h.includes(ruHeader({ hreflang: true }).replace('Направления', 'Страны')), false);
});

test('the home keeps the Russian market: Platega checkout, roubles, Metrika, no GLOBAL bar', () => {
  const h = read('index.html');
  for (const s of ['Оформление заказа', 'Российская карта', 'Оплата через Platega', 'id="coPay"', 'id="checkoutModal"', 'ym(110393848']) {
    assert.ok(h.includes(s), s);
  }
  assert.doesNotMatch(h, /class="paybar"|previewNotice|global-catalog\.js|\/en\/checkout\.js/);
  assert.match(h, /Тарифы для 190\+ направлений/, 'the one measured wording');
  assert.doesNotMatch(h, /150\+ стран/, 'the old count is gone');
});

// ---- the service pages (RU↔EN parity, PR 4) ----

test('payment return and legal pages: shared sheets, the one Russian chrome, no inline <style>', async () => {
  const { ruHeader, RU_FOOTER } = await import('./ru-chrome.mjs');
  for (const p of ['payment-success.html', 'payment-failed.html', 'privacy.html', 'terms.html']) {
    const h = read(p);
    assert.doesNotMatch(h, /<style\b/, `${p}: an inline stylesheet is a second design system`);
    assert.ok(h.indexOf('href="/assets/site.css?v=') > 0 && h.indexOf('href="/assets/site.css?v=') < h.indexOf('href="/assets/ru.css?v='), `${p}: site.css, then ru.css`);
    assert.ok(h.includes(ruHeader()), `${p}: header drifted from seo/ru-chrome.mjs`);
    assert.ok(h.includes(RU_FOOTER), `${p}: footer drifted from seo/ru-chrome.mjs`);
  }
  // The R3-08 bootstrap is still the first script of the payment pages' <head>;
  // seo/test-r308-analytics-privacy.mjs pins the rest of that contract.
  for (const p of ['payment-success.html', 'payment-failed.html']) {
    const head = read(p).slice(0, read(p).indexOf('</head>'));
    const first = head.match(/<script\b[^>]*>([\s\S]*?)<\/script>/);
    assert.match(first[1], /sp\.delete\('token'\)/, `${p}: the token strip is the first script`);
  }
});

test('404.html (the /pay/ router and the English 404) keeps its own brandless card, on purpose', () => {
  // Its stylesheet says so: «this page has no brand of its own and borrows none».
  // It serves the private payment link and the English 404 from one file, so the
  // Russian chrome must not appear there. A change here is the owner's call.
  const h = read('404.html');
  assert.doesNotMatch(h, /site-header|site-footer|assets\/ru\.css/);
});
