// seo/test-assortment-single-source.mjs — ONE source for every country page (owner, 2026-10-25).
//
// The backend decides which plans a country shows, in which of the three blocks (local, regional, daily), in which
// order, and the «Оптимальный выбор» card (esim-backend lib/assortmentLayout.js). The Russian site, every prefixed
// language and the Mini App read that layout through ONE reader, assets/assortment-view.js, and decide nothing.
//
//   1. the reader is the only way in: each surface calls it, none keeps a rule of its own;
//   2. for the same catalogue (a real backend layout, 12 countries × 2 markets) the website's page and the Mini App's
//      country screen hold the same ids, in the same blocks, in the same order, with the same badge;
//   3. the <script> line that loads the reader re-dates no page (sitemap hash round trip).
//
// The rendered pages are compared in a browser by test/e2e/assortment-parity.spec.js.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { contentHash, stripAssortmentView } from './build-sitemap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const require = createRequire(import.meta.url);
const MA = require(join(ROOT, 'assets/assortment-view.js'));
const C = require(join(ROOT, 'app/core.js'));
const fixture = (m) => JSON.parse(read(`test/fixtures/assortment-parity-${m}.json`));

/* ---------------------------------------------------------------- 1. the reader is the only way in */

test('every surface reads the backend layout through assets/assortment-view.js', () => {
  assert.match(read('assets/country-tariffs.js'), /window\.MagicAssortment\.forCountry\(allLandingPackages,code\)/, 'RU site');
  assert.match(read('en/country.js'), /window\.MagicAssortment\.forCountry\(list, iso\)/, 'every prefixed language');
  assert.match(read('app/core.js'), /A\.forCountry\(rows, code\)/, 'Mini App');
  assert.match(read('assets/catalog-loader.js'), /attachLayout\(json\.data, json\.assortment\)/, 'RU live answer carries it');
  assert.match(read('assets/catalog-loader.js'), /attachLayout\(doc\.packages, doc\.assortment\)/, 'RU snapshot carries it');
  assert.match(read('assets/global-catalog.js'), /A\.attach\(out, layout\)/, 'GLOBAL answer carries it');
  assert.match(read('scripts/update-catalog-cache.mjs'), /doc\.assortment = layoutFor\(/, 'the snapshot keeps it');
});

test('no surface keeps a selection rule of its own', () => {
  const site = read('assets/country-tariffs.js');
  for (const gone of ['function basePackages', 'function packageMatchesCountry', 'function isPublicGlobalPackage',
    'function bestLocalPackageId', 'function comparePackages', '.partition(all)']) {
    assert.equal(site.includes(gone), false, `assets/country-tariffs.js still has ${gone}`);
  }
  const split = site.slice(site.indexOf('function renderCountrySplit'), site.indexOf('function renderCountrySplit') + 4000);
  assert.equal(/\.filter\(/.test(split.slice(0, split.indexOf('const D=dailyCopy()'))), false, 'renderCountrySplit filters nothing before drawing');
  const plans = read('en/plans.js');
  assert.equal(/function classify|function sortByPrice/.test(plans), false, 'en/plans.js chooses nothing');
  const core = read('app/core.js');
  for (const gone of ['function byCountry', 'function pickBestValue', 'function regionsCovering']) {
    assert.equal(core.includes(gone), false, `app/core.js still has ${gone}`);
  }
  assert.equal(read('app/ui.js').includes('regionsCovering'), false, 'the Mini App country screen draws the regional block, not region rows');
});

test('the reader itself filters, sorts and classifies nothing', () => {
  const src = read('assets/assortment-view.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/\.sort\(\s*function|\.sort\(\(/.test(src.replace('}).sort();', '')), false, 'no comparator — the order is the backend\'s');
  for (const word of ['coverage', 'country_code', 'plan_type', 'data_gb', 'price']) {
    assert.equal(src.includes(word), false, `assets/assortment-view.js must not read ${word}`);
  }
});

/* ---------------------------------------------------------------- 2. site = Mini App, per country and market */

for (const market of ['rub', 'usd']) {
  test(`${market.toUpperCase()}: the website and the Mini App hold the same cards, blocks, order and badge for every country`, () => {
    const body = fixture(market);
    const rows = MA.attach(body.data.slice(), body.assortment);
    const app = C.groupCatalogue(rows, market === 'rub' ? 'ru' : 'en', { best: market === 'rub' });
    const appBy = new Map(app.countries.map((g) => [g.country_code, g]));
    const isos = Object.keys(body.assortment.countries);
    assert.ok(isos.length >= 12, `countries in the fixture: ${isos.length}`);
    const ids = (xs) => xs.map((p) => String(p.package_id));
    for (const iso of isos) {
      const site = MA.forCountry(rows, iso);
      const g = appBy.get(iso);
      assert.ok(g, `${iso}: the Mini App lists the country`);
      assert.deepEqual(ids(g.local), ids(site.local), `${iso} local`);
      assert.deepEqual(ids(g.regional_items), ids(site.regional), `${iso} regional`);
      assert.deepEqual(ids(g.daily), ids(site.daily), `${iso} daily`);
      assert.deepEqual(ids(site.local), body.assortment.countries[iso].local, `${iso}: the backend's own order`);
      assert.ok(site.regional.length <= 8, `${iso}: the regional block is within its cap of 8`);
      if (market === 'rub') assert.equal(g.best ? String(g.best.package_id) : null, site.best, `${iso} badge`);
      else assert.equal(g.best, null, `${iso}: no badge on the international market (the international site shows none)`);
      // The same objects: same price, volume and term on both surfaces.
      for (const p of g.items) assert.equal(rows.find((r) => r.package_id === p.package_id), p);
    }
  });
}

test('a plan in the catalogue is on some page of BOTH surfaces, or on neither', () => {
  for (const market of ['rub', 'usd']) {
    const body = fixture(market);
    const rows = MA.attach(body.data.slice(), body.assortment);
    const onSite = new Set(Object.keys(body.assortment.countries).flatMap((iso) => {
      const v = MA.forCountry(rows, iso);
      return [...v.local, ...v.regional, ...v.daily].map((p) => p.package_id);
    }));
    const onApp = new Set(C.groupCatalogue(rows, 'ru').countries.flatMap((g) => g.items.map((p) => p.package_id)));
    assert.deepEqual([...onApp].sort(), [...onSite].sort(), market);
  }
});

/* ---------------------------------------------------------------- 3. no page re-dated */

test('the line that loads the reader re-dates no page: the sitemap hash ignores it, on every page kind', () => {
  for (const f of ['esim/italy/index.html', 'en/esim/italy/index.html', 'es/esim/italy/index.html']) {
    const html = read(f);
    assert.match(html, /<script src="(?:\.\.\/\.\.)?\/assets\/assortment-view\.js(?:\?v=[0-9a-f]+)?" defer><\/script>/, `${f} loads the reader`);
    const without = html.replace(/[ \t]*<script src="\/assets\/assortment-view\.js(?:\?v=[0-9a-f]+)?" defer><\/script>\n?/, '');
    assert.notEqual(without, html);
    assert.equal(contentHash(html), contentHash(without), f);
  }
  assert.equal(stripAssortmentView('<a href="/assets/assortment-view.js">x</a>'), '<a href="/assets/assortment-view.js">x</a>', 'only the script line');
});
