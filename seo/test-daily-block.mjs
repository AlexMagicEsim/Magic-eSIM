#!/usr/bin/env node
// The «Трафик на каждый день» block, pinned at the source level.
//
// Both surfaces that render a country's tariffs are checked — the landing's own
// copy in index.html and assets/country-tariffs.js, which the ~190 generated
// country pages load. The property that matters is the same on both: a daily
// plan never enters the pool that gets ranked by price against fixed volumes.
//
// Run: node --test seo/test-daily-block.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

const SURFACES = ['index.html', 'assets/country-tariffs.js'];

// ---------------------------------------------------------------------------
// The two products stay apart
// ---------------------------------------------------------------------------

test('both renderers take daily plans out of the pool BEFORE sorting by price', () => {
  // «1 ГБ в день» and «1 ГБ всего» are not two prices for the same thing, so a
  // daily plan must never be ranked against a volume. Partitioning after the
  // sort would still show the right cards in the right block while quietly
  // letting a daily price decide which volume card is «Оптимальный выбор».
  for (const f of SURFACES) {
    const s = read(f);
    const split = s.indexOf('.partition(all)');
    const sort = s.indexOf('applySort(list.filter');
    assert.ok(split > 0, `${f}: daily plans are not partitioned out`);
    assert.ok(sort > 0, `${f}: sort not found`);
    assert.ok(split < sort, `${f}: the split must happen before the ranking`);
  }
});

/** The daily rendering only — not the whole file. */
function dailyRegion(source) {
  const from = source.indexOf('function dailyCopy');
  const to = source.indexOf('function renderCountrySplit');
  assert.ok(from > 0 && to > from, 'daily rendering block not found');
  return source.slice(from, to);
}

test('both renderers get every line of copy from the shared module', () => {
  for (const f of SURFACES) {
    const s = read(f);
    assert.match(s, /MagicDailyPlan/, `${f}: does not use the shared copy module`);

    // Scoped to the daily rendering rather than the whole file, and the
    // difference is real: index.html carries a long-standing dictionary that
    // translates a PROVIDER string «unlimited» into «Безлимитный трафик.» for
    // fup_policy on ordinary cards. That predates daily plans and is not what
    // this rule is about — what must not happen is a DAILY card composing its
    // own promise. So the region, not the file.
    const region = dailyRegion(s);
    assert.ok(!/в день на максимальной/.test(region),
      `${f}: card copy must come from assets/daily-plan-copy.js, not be inlined`);
    assert.ok(!/безлимит/i.test(region), `${f}: a daily card must not promise unlimited traffic`);
  }
});

test('a surface with no copy module renders no daily card at all', () => {
  // Showing the card without its terms would show a daily plan as though it
  // were a volume one — the exact confusion the block exists to prevent.
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function renderDailyCard'), s.indexOf('function renderDailyCard') + 260);
    assert.match(fn, /if\(!D\)\s*return ''/, `${f}: must bail out without the module`);
  }
});

// ---------------------------------------------------------------------------
// The term is the product
// ---------------------------------------------------------------------------

test('the term prices are repeated from the API, never computed in the browser', () => {
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 1200);
    assert.match(fn, /term_prices/, `${f}: must read the server's ladder`);
    // A browser that computes its own total is a second opinion about money.
    for (const banned of ['*', '/']) {
      const arithmetic = new RegExp(`price\\s*\\${banned}`);
      assert.ok(!arithmetic.test(fn), `${f}: must not do arithmetic on a price`);
    }
  }
});

test('the landing lets a customer choose the term, and the choice moves the buy button', () => {
  const s = read('index.html');
  assert.match(s, /role="radiogroup"/, 'the term is chosen before payment, not after');
  assert.match(s, /js-daily-term/);
  // Selecting a term must update what the buy button will send, or the customer
  // pays for one term and is quoted another.
  const handler = s.slice(s.indexOf("closest('.js-daily-term')"), s.indexOf("closest('.js-daily-term')") + 700);
  assert.match(handler, /buy\.dataset\.days\s*=/, 'the selected term must reach the buy button');
  assert.match(handler, /buy\.dataset\.price\s*=/);
});

test('the chosen term travels with the order, and the price still does not', () => {
  const s = read('index.html');
  const start = s.indexOf('const orderBody=JSON.stringify({');
  assert.ok(start > 0);
  let depth = 0; let end = start;
  for (let i = s.indexOf('{', start); i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
  }
  const payload = s.slice(start, end);
  assert.match(payload, /days\s*:/, 'a per-day order must say how many days');
  assert.match(payload, /package_id\s*:/);
  for (const banned of ['price', 'amount', 'retail_price', 'total', 'sum']) {
    assert.ok(!new RegExp(`\\b${banned}\\s*:`).test(payload),
      `checkout must not send ${banned} — the server decides the amount`);
  }
});

test('the term is part of the intent, so two terms are two orders', () => {
  // Without this, choosing 30 days after 7 would reuse the first intent's
  // idempotency key and the backend would correctly return the FIRST order —
  // a customer charged for a week and shown a month.
  const s = read('index.html');
  const fn = s.slice(s.indexOf('function coIdemKeyFor'), s.indexOf('function coIdemKeyFor') + 700);
  assert.match(fn, /function coIdemKeyFor\(pkgId,method,email,promo,days\)/);
  assert.match(fn, /String\(days\|\|''\)/, 'the term must be in the tuple');
  assert.match(s, /coIdemKeyFor\(pkgId,paymentType,email\.value,[^)]*,coDays\)/,
    'and the call site must pass it');
});

test('an ordinary package carries no term into the order', () => {
  const s = read('index.html');
  assert.match(s, /overlay\.dataset\.days=d\.planType==='DAILY'&&d\.days\?String\(d\.days\):''/,
    'only a daily plan may set a term');
});

// ---------------------------------------------------------------------------
// Every surface actually loads the module
// ---------------------------------------------------------------------------

function countryPages() {
  const dir = join(ROOT, 'esim');
  return readdirSync(dir)
    .filter((n) => statSync(join(dir, n)).isDirectory())
    .map((n) => join('esim', n, 'index.html'))
    .filter((p) => { try { statSync(join(ROOT, p)); return true; } catch { return false; } });
}

test('every page that renders tariffs loads the shared copy module', () => {
  const pages = ['index.html', ...countryPages()];
  assert.ok(pages.length > 100, 'expected the generated country pages to be present');
  const missing = pages.filter((p) => {
    const s = read(p);
    // Only pages that actually hydrate a tariff grid need it.
    if (!s.includes('catalog-loader.js')) return false;
    return !s.includes('daily-plan-copy.js');
  });
  assert.deepEqual(missing, [], 'these pages would render a daily tariff as an ordinary one');
});

test('the generator ships the module too, so new pages are not born broken', () => {
  const gen = read('seo/build-catalogue-pages.mjs');
  assert.match(gen, /daily-plan-copy\.js/);
  // Before country-tariffs.js, which reads it.
  assert.ok(gen.indexOf('daily-plan-copy.js') < gen.indexOf('country-tariffs.js" defer'),
    'the module must load before the renderer that uses it');
});

test('the block has styles in the stylesheet BOTH surfaces load', () => {
  // 190 country pages once rendered without their layout because a rule lived
  // in the wrong file. assets/country-pages.css is the one both load.
  const css = read('assets/country-pages.css');
  for (const cls of ['.daily-lines', '.daily-line', '.daily-terms', '.daily-term']) {
    assert.ok(css.includes(cls), `${cls} is not styled in the shared stylesheet`);
  }
});
