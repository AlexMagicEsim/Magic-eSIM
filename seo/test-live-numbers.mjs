// SEO stage C — the generated numbers follow the catalogue the grid shows.
// The browser behaviour is pinned in test/e2e/ru-live-numbers.spec.js; this
// file pins the build: the markup is where it must be (and nowhere on the SEO
// pilot / control pages), structured data carries no markup, and the browser's
// price rule is the generator's on every package.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { loadCatalogue, countryFacts, purchasablePrice } from './catalogue-facts.mjs';
import { countryPages } from './generated-prices.mjs';
import { SEO_PILOT_PAGES, SEO_CONTROL_PAGES, isFrozenPage } from './frozen-pages.mjs';
import { stripLiveCatalogueMarkup } from './build-sitemap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const NUMBERS = require('../assets/catalog-numbers.js');
const PK = loadCatalogue();
const PAGES = countryPages();
const money = (v) => Math.round(Number(v)).toLocaleString('ru-RU');

test('the frozen lists are the SEO pilot test\'s own lists', () => {
  const src = readFileSync(join(ROOT, 'seo', 'test-seo-pilot.mjs'), 'utf8');
  const list = (name) => JSON.parse(src.match(new RegExp(`const ${name} = (\\[[^\\]]*\\])`))[1].replace(/'/g, '"'));
  assert.deepEqual([...SEO_PILOT_PAGES], list('PILOT'));
  assert.deepEqual([...SEO_CONTROL_PAGES], list('CONTROL'));
});

test('the ten former SEO-experiment pages carry the live markup and load assets/catalog-numbers.js since 2026-10-24', () => {
  const frozen = PAGES.filter((p) => isFrozenPage(p.slug));
  assert.equal(frozen.length, 10);
  for (const { slug, html } of frozen) {
    assert.match(html, /data-cat/, slug);
    assert.match(html, /catalog-numbers\.js/, slug);
  }
});

test('every other selling page marks its facts line, its template FAQ floor, and loads the script', () => {
  let faq = 0;
  for (const { slug, iso, html } of PAGES) {
    const f = countryFacts(PK, iso);
    if (f.min_price_rub === null) continue;
    assert.match(html, /<script src="\/assets\/catalog-numbers\.js\?v=[0-9a-f]+" defer><\/script>\s*<script src="\.\.\/\.\.\/assets\/country-tariffs\.js/, `${slug}: script before country-tariffs.js`);
    assert.ok(html.includes(`<span data-cat-floor>Цены от <b data-cat="floor">${money(f.min_price_rub)} ₽</b>.</span>`), `${slug}: facts floor`);
    for (const [k, n] of [['local', f.local_count], ['regional', f.regional_count], ['daily', f.daily_count]]) {
      if (n > 0) assert.ok(html.includes(`<b data-cat="${k}">${n}</b>`), `${slug}: ${k} count`);
      else assert.ok(!html.includes(`data-cat-seg="${k}"`), `${slug}: no ${k} segment for 0`);
    }
    if (html.includes('Цены начинаются от')) {
      faq += 1;
      assert.ok(html.includes(`<span data-cat-floor>Цены начинаются от <span data-cat="floor">${money(f.min_price_rub)} ₽</span>.</span>`), `${slug}: FAQ floor`);
    }
  }
  assert.ok(faq >= 120, `template FAQ floors marked: ${faq}`);
});

test('structured data and meta never carry the markup', () => {
  for (const { slug, html } of PAGES) {
    const ld = (html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).join('');
    const head = (html.match(/<head>[\s\S]*?<\/head>/) || [''])[0];
    assert.doesNotMatch(ld, /data-cat|<span|<b>/, `${slug}: JSON-LD`);
    assert.doesNotMatch(head.replace(/<script[\s\S]*?<\/script>/g, ''), /data-cat/, `${slug}: head`);
  }
});

test('the browser\'s cheapest purchasable amount is the generator\'s, on every package', () => {
  const off = PK.filter((p) => NUMBERS.purchasablePrice(p) !== purchasablePrice(p)).map((p) => p.package_id);
  assert.deepEqual(off, []);
  assert.ok(PK.length > 1000);
  assert.equal(NUMBERS.floorOf([]), null);
  assert.equal(NUMBERS.floorOf([{ price: 300 }, { price: 250, term_prices: [{ days: 3, price: 750 }] }, { price: 0 }]), 300);
});

test('the browser formats money exactly as the generator', () => {
  for (const n of [50, 350, 999, 1000, 1650, 18750, 104500]) assert.equal(NUMBERS.money(n), money(n), String(n));
});

test('the sitemap hash ignores the live markup: every page reduces to its pre-stage-C form', () => {
  for (const { slug, html } of PAGES.slice(0, 40)) {
    const stripped = stripLiveCatalogueMarkup(html);
    assert.doesNotMatch(stripped, /data-cat|catalog-numbers\.js/, slug);
  }
});
