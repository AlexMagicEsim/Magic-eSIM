// The Russian checkout lives in ONE module, assets/ru-checkout.js, and opens on
// the country pages (/esim/<slug>/). History: PR A moved it verbatim out of
// index.html; PR B loaded it on the country pages; PR C (RU↔EN migration) took
// the catalogue — and with it the checkout — off the home, which is now a way
// in, as /en/ is. What this pins:
//   1. the home loads no checkout and carries no checkout window;
//   2. every country page carries the one window (seo/ru-checkout-markup.mjs),
//      MagicNet, and the checkout after its renderer;
//   3. every name the module relies on is declared by the country page's
//      renderer (a rename on one side would otherwise fail only in a browser, at
//      the moment somebody tries to pay);
//   4. every element id the module reads exists in a country page's markup;
//   5. every goal the module fires is allowlisted where it runs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const HOME = read('index.html');
const PAGE = read('esim/turkey/index.html');
const MOD = read('assets/ru-checkout.js');

test('the home loads no checkout and carries no checkout window', () => {
  assert.ok(!/ru-checkout\.js/.test(HOME), 'the home must not load the checkout');
  for (const id of ['checkoutModal', 'coPay', 'coEmail', 'coverageModal']) {
    assert.ok(!HOME.includes(`id="${id}"`), `the home must not carry #${id}`);
  }
  // and the rule can fire
  assert.ok(PAGE.includes('id="checkoutModal"'));
});

test('there is ONE copy of the checkout: the module', () => {
  for (const marker of ['function coIdemKeyFor', 'function coStartPayment', "'/api/v1/public/retail-orders'"]) {
    assert.ok(MOD.includes(marker), `assets/ru-checkout.js lacks «${marker}»`);
    assert.ok(!read('assets/country-tariffs.js').includes(marker), `country-tariffs.js carries a second copy of «${marker}»`);
    assert.ok(!HOME.includes(marker), `index.html carries «${marker}»`);
  }
  assert.match(MOD, /\n\(function\(\)\{\n[\s\S]*\n\}\)\(\);\n$/, 'one IIFE, ending the file');
});

test('every element id the checkout reads exists in a country page\'s markup', () => {
  const ids = [...new Set([...MOD.matchAll(/(?:byId|getElementById)\('([A-Za-z][\w-]*)'\)/g)].map((m) => m[1]))];
  assert.ok(ids.length >= 25, `ids found: ${ids.length}`);
  const markup = PAGE.replace(/<script[\s\S]*?<\/script>/g, '');
  const missing = ids.filter((id) => !markup.includes(`id="${id}"`) && id !== 'catalogRetryBtn' && id !== 'catalogNotice');
  assert.deepEqual(missing, [], 'the module reads ids the page does not have');
});

// ---- the country pages open the checkout (PR B) ----

const goalsOf = (html) => {
  const m = html.match(/var GOALS=\{([\s\S]*?)\};/);
  return new Set(m ? [...m[1].matchAll(/([a-z_]+):\[/g)].map((x) => x[1]) : []);
};

test('a country page carries the checkout window, MagicNet, and the checkout after its renderer', async () => {
  const { RU_CHECKOUT_MODAL } = await import('./ru-checkout-markup.mjs');
  for (const p of ['esim/turkey/index.html', 'esim/thailand/index.html', 'esim/japan/index.html']) {
    const h = read(p);
    assert.ok(h.includes(RU_CHECKOUT_MODAL), `${p}: the checkout window drifted from seo/ru-checkout-markup.mjs`);
    const net = h.indexOf('<script src="/assets/magic-net.js?v=');
    const ct = h.indexOf('assets/country-tariffs.js?v=');
    const co = h.search(/<script src="\/assets\/ru-checkout\.js\?v=[0-9a-f]{8}" defer><\/script>/);
    assert.ok(net > 0 && ct > net && co > ct, `${p}: MagicNet → country-tariffs.js → ru-checkout.js (defer, in that order)`);
  }
});

test('the country page declares every landing name the checkout relies on', () => {
  const ct = read('assets/country-tariffs.js');
  for (const n of ['catalogSource', 'catalogGeneratedAt', 'allLandingPackages', 'activeCountry']) {
    assert.match(ct, new RegExp(`(?:^|\\n)let ${n}\\b`), `${n} must be a top-level name on the country page`);
  }
  for (const n of ['renderPackages', 'renderCountryChips', 'hideCatalogNotice', 'catalogNoticeEl', 'retryLiveCatalog']) {
    assert.match(ct, new RegExp(`(?:^|\\n)function ${n}\\(`), `${n} must be a top-level function on the country page`);
  }
  assert.match(ct, /window\.MAGIC_PAGE_TYPE='country'/);
});

test('every goal the checkout fires is allowed on every page that opens it', () => {
  // the first argument, including a ternary between two goal names
  const fired = [...new Set([...MOD.matchAll(/magicMetrikaGoal\(([^,]+),/g)].flatMap((m) => [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1])).filter((g) => !/^(sbp|card)$/.test(g)))];
  assert.ok(fired.length >= 9, `goals found: ${fired.length}`);
  for (const p of ['esim/turkey/index.html', 'esim/japan/index.html']) {
    const allowed = goalsOf(read(p));
    const dropped = fired.filter((g) => !allowed.has(g));
    assert.deepEqual(dropped, [], `${p} would silently drop these checkout goals`);
  }
});
