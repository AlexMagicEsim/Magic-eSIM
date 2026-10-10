// The Russian checkout lives in ONE module, assets/ru-checkout.js (RU↔EN
// parity, migration PR A: moved verbatim out of index.html). What this pins:
//   1. the landing loads it as a CLASSIC, SYNCHRONOUS script right after its
//      inline script — the moment the block used to run — and nowhere else yet;
//   2. the inline script no longer carries a second copy of the checkout;
//   3. every top-level name the module relies on is declared by the landing
//      (a rename on one side would otherwise fail only in a browser, at the
//      moment somebody tries to pay);
//   4. every element id the module reads exists in the landing's markup.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const HTML = read('index.html');
const MOD = read('assets/ru-checkout.js');
const inline = [...HTML.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');

test('the landing loads the checkout as a classic synchronous script, right after its inline script', () => {
  const tag = HTML.match(/<script src="\/assets\/ru-checkout\.js\?v=[0-9a-f]{8}"><\/script>/);
  assert.ok(tag, 'no stamped, plain <script src> for the checkout');
  assert.doesNotMatch(tag[0], /defer|async|type=/, 'defer/async/module would change when — and whether — it runs');
  const before = HTML.slice(0, tag.index).replace(/\s+$/, '');
  assert.ok(before.endsWith('</script>'), 'it must follow the inline script immediately');
  // …and that inline script is the big one, the one that declares the names
  const lastInline = before.slice(before.lastIndexOf('<script>'));
  assert.match(lastInline, /let catalogSource=null;/);
  assert.equal((HTML.match(/ru-checkout\.js/g) || []).length, 1, 'loaded once');
});

test('there is ONE copy of the checkout: the inline script no longer carries it', () => {
  for (const marker of ['On-site checkout modal', 'function coIdemKeyFor', 'function coStartPayment', "'/api/v1/public/retail-orders'"]) {
    assert.ok(!inline.includes(marker), `index.html still carries «${marker}»`);
    assert.ok(MOD.includes(marker), `assets/ru-checkout.js lacks «${marker}»`);
  }
  assert.match(MOD, /\n\(function\(\)\{\n[\s\S]*\n\}\)\(\);\n$/, 'one IIFE, ending the file');
});

test('every landing name the checkout relies on is declared by the landing', () => {
  const NAMES = ['catalogSource', 'catalogGeneratedAt', 'allLandingPackages', 'activeCountry', 'renderPackages',
    'renderCountryChips', 'hideCatalogNotice', 'catalogNoticeEl', 'retryLiveCatalog'];
  for (const n of NAMES) {
    assert.ok(new RegExp(`\\b${n}\\b`).test(MOD), `the module no longer uses ${n} — update this list`);
    assert.match(inline, new RegExp(`(?:^|\\n)(?:let|const|var|function|async function) ${n}\\b`), `index.html does not declare ${n} at the top level`);
  }
  // Earlier scripts' globals
  assert.match(HTML, /<script src="\/assets\/magic-net\.js/);
  assert.match(HTML, /<script src="\/assets\/catalog-loader\.js/);
  assert.match(inline, /magicMetrikaGoal/);
});

test('every element id the checkout reads exists in the landing markup', () => {
  const ids = [...new Set([...MOD.matchAll(/(?:byId|getElementById)\('([A-Za-z][\w-]*)'\)/g)].map((m) => m[1]))];
  assert.ok(ids.length >= 25, `ids found: ${ids.length}`);
  const markup = HTML.replace(/<script[\s\S]*?<\/script>/g, '');
  const missing = ids.filter((id) => !markup.includes(`id="${id}"`) && id !== 'catalogRetryBtn' && id !== 'catalogNotice');
  assert.deepEqual(missing, [], 'the module reads ids the page does not have');
});

// ---- PR B: the country pages open the same checkout ----

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
  assert.ok(HTML.includes(RU_CHECKOUT_MODAL), 'the landing carries the same window, byte for byte');
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
  for (const p of ['index.html', 'esim/turkey/index.html']) {
    const allowed = goalsOf(read(p));
    const dropped = fired.filter((g) => !allowed.has(g));
    assert.deepEqual(dropped, [], `${p} would silently drop these checkout goals`);
  }
});
