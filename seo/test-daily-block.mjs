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
  // pays for one term and is quoted another. Bounded on the FUNCTION that does
  // it, not on a character window: the click handler now delegates to
  // selectDailyTerm so the keyboard takes the same path, and a fixed window
  // stopped covering the code it was meant to defend.
  const at = s.indexOf('function selectDailyTerm');
  assert.ok(at > 0, 'index.html must route selection through one function');
  let i = s.indexOf('{', at), depth = 0, end = -1;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  const handler = s.slice(at, end);
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
  // Anchored on the SCRIPT TAGS, not on the first mention of each name: the
  // generator's own prose names country-tariffs.js on line 18, long before it
  // emits either tag, and matching that made this fail while the emitted order
  // was correct. The src now carries ?v=<hash>, so match the stampUrl() call.
  const tag = (name) => gen.search(new RegExp(`<script src="\\$\\{stampUrl\\('[^']*${name.replace(/[.]/g, '\\.')}'\\)\\}"`));
  assert.ok(tag('daily-plan-copy.js') > 0, 'the generator emits no tag for the module');
  assert.ok(tag('country-tariffs.js') > 0, 'the generator emits no tag for the renderer');
  assert.ok(tag('daily-plan-copy.js') < tag('country-tariffs.js'),
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

// ---------------------------------------------------------------------------
// The Mini App is the third surface, and behaves like the other two
// ---------------------------------------------------------------------------

test('the Mini App loads the shared copy module, before the code that reads it', () => {
  const html = read('app/index.html');
  // Compared on the SCRIPT TAGS, not on the first mention of each name: the
  // comment above the tag names core.js too, and matching that made this fail
  // while the load order was in fact correct.
  // The src carries ?v=<content hash>, so match up to the quote, not through it.
  const tag = (src) => html.search(new RegExp(`<script src="${src.replace(/[./]/g, '\\$&')}(\\?v=[0-9a-f]{8})?"`));
  assert.ok(tag('/assets/daily-plan-copy.js') > 0, 'the Mini App does not load the module');
  assert.ok(tag('core.js') > 0);
  assert.ok(tag('/assets/daily-plan-copy.js') < tag('core.js'),
    'the module must load before core.js');
});

test('the Mini App splits the two products before sorting, like the storefront', () => {
  const s = read('app/ui.js');
  const split = s.indexOf('C.partitionDaily(group.items)');
  const sort = s.indexOf('C.sortTariffs(volume');
  assert.ok(split > 0, 'daily plans are not partitioned out');
  assert.ok(sort > split, 'the split must happen before the ranking');
  // The volume sort must no longer see the whole group.
  assert.ok(!/C\.sortTariffs\(group\.items/.test(s),
    'sorting the whole group would rank daily plans against volumes');
});

test('the Mini App composes no copy of its own about a daily plan', () => {
  const s = read('app/ui.js');
  assert.match(s, /C\.dailyCopy\(\)/);
  assert.ok(!/в день на максимальной/.test(s),
    'card copy must come from assets/daily-plan-copy.js');
  const daily = s.slice(s.indexOf('function dailyCard'), s.indexOf('function tariffCard'));
  assert.ok(!/безлимит/i.test(daily), 'a daily card must not promise unlimited traffic');
  assert.match(daily, /if \(!D\) return null/, 'no module, no card');
});

test('the Mini App prices nothing: the ladder comes from the server', () => {
  const core = read('app/core.js');
  const fn = core.slice(core.indexOf('function dailyTerms'), core.indexOf('function dailyTerms') + 600);
  assert.match(fn, /term_prices/);
  assert.ok(!/[*/]\s*days|days\s*[*/]/.test(fn), 'the app must not multiply a price by a term');
});

test('the Mini App order carries the term, and the term is part of the intent', () => {
  const core = read('app/core.js');
  const body = core.slice(core.indexOf("request('/api/v1/tma/orders'"), core.indexOf("request('/api/v1/tma/orders'") + 1400);
  assert.match(body, /days:\s*intent\.days\s*\|\|\s*undefined/,
    'a per-day order must say how many days');

  const scope = core.slice(core.indexOf('function purchaseIntentScope'), core.indexOf('function purchaseIntentScope') + 700);
  assert.match(scope, /intent\.days/, 'two terms must be two intents');

  // One builder for both the mint and the clear — a second copy is how the two
  // start hashing to different slots.
  assert.equal((core.match(/function purchaseIntentScope/g) || []).length, 1);
  assert.match(core, /function clearIntentKey[\s\S]{0,200}purchaseIntentScope\(intent\)/);
});

test('the Mini App asserts the price it SHOWED, which for a daily plan is the term\'s', () => {
  const s = read('app/ui.js');
  assert.match(s, /expected_amount_rub: Number\(dailyTerm \? dailyTerm\.price : pkg\.price\)/,
    'sending the row price would assert one day against a month');
});

test('a daily plan with no priced ladder cannot be bought in the Mini App', () => {
  const s = read('app/ui.js');
  assert.match(s, /isDaily && !terms\.length/);
  assert.match(s, /нельзя оформить/);
});

// ---------------------------------------------------------------------------
// The term selector, and the row alignment it has to sit inside
// ---------------------------------------------------------------------------

test('both surfaces render the term as a clickable radio, not a price list', () => {
  // It used to be a <ul> of <li> on the country pages: the prices were visible
  // and the fact that one could be chosen — and that one already was — was not.
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 2400);
    assert.match(fn, /role="radiogroup"/, `${f}: the group must announce itself`);
    assert.match(fn, /<button type="button" class="daily-term js-daily-term/, `${f}: each term is a button`);
    assert.match(fn, /aria-checked="\$\{i===0\?'true':'false'\}"/, `${f}: exactly one is checked`);
    assert.match(fn, /i===0\?' is-selected':''/, `${f}: the first is selected by default`);
    assert.ok(!/<li class="daily-term"/.test(fn), `${f}: no list rows left`);
  }
});

test('a chip shows the term AND its price, both from the server', () => {
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 2400);
    assert.match(fn, /daily-term-days/);
    assert.match(fn, /daily-term-price/);
    assert.match(fn, /t\.price/, 'the price is the server\'s');
    assert.match(fn, /pluralDays/, 'and the day word comes from the shared module');
  }
});

test('choosing a term moves the selection and what the buy button will send', () => {
  for (const f of SURFACES) {
    const s = read(f);
    const at = s.indexOf("closest('.js-daily-term')");
    assert.ok(at > 0, `${f}: no handler for the chips`);
    const handler = s.slice(at, at + 900);
    assert.match(handler, /classList\.toggle\('is-selected'/, `${f}: the selection must be visible`);
    assert.match(handler, /setAttribute\('aria-checked'/, `${f}: and announced`);
    assert.match(handler, /dataset\.days\s*=/, `${f}: the chosen term must reach the buy control`);
    assert.match(handler, /dataset\.price\s*=/);
  }
});

test('a plan with no priced ladder cannot be bought on either surface', () => {
  // A term we cannot price is a term we cannot sell, and a button that leads to
  // a refusal is worse than no button.
  for (const f of SURFACES) {
    const s = read(f);
    assert.match(s, /Временно недоступен/, `${f}: must refuse rather than offer`);
    assert.match(s, /aria-disabled="true"/);
  }
});

test('no surface computes a price for a term', () => {
  for (const f of SURFACES) {
    const region = dailyRegion(read(f));
    for (const op of ['\\*', '/']) {
      assert.ok(!new RegExp(`price\\s*${op}`).test(region), `${f}: no arithmetic on a price`);
      assert.ok(!new RegExp(`${op}\\s*days`).test(region), `${f}: no arithmetic on a term`);
    }
  }
});

// ---------------------------------------------------------------------------
// Alignment
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// THE STYLESHEET NOBODY LOADS.
//
// The daily CSS lived only in assets/country-pages.css, under a comment saying
// the landing loads it too. The landing loads NO external stylesheet at all —
// document.styleSheets on production was []. So the storefront shipped daily
// cards with no styling: .daily-card was display:flex with no grid, and every
// chip was an unpainted browser button, rgb(239,239,239) on black, the selected
// one indistinguishable from the rest. The country pages looked correct, which
// is why checking one surface passed.
//
// The block is therefore duplicated and pinned byte-for-byte, the same way the
// TARIFF DISPLAY MAPPERS block is.

const CSS_SURFACES = { 'index.html': 'index.html', 'assets/country-pages.css': 'assets/country-pages.css' };
const BLOCK_START = '/* === DAILY CARD BLOCK';
const BLOCK_END = '/* === END DAILY CARD BLOCK === */';

function dailyCss(file) {
  const s = read(file);
  const a = s.indexOf(BLOCK_START);
  assert.ok(a >= 0, `${file} carries no daily CSS block — its daily cards would render unstyled`);
  const b = s.indexOf(BLOCK_END, a);
  assert.ok(b > a, `${file}: the daily CSS block is not terminated`);
  return s.slice(a, b + BLOCK_END.length);
}

test('both surfaces carry the daily CSS, byte for byte', () => {
  const [a, b] = Object.values(CSS_SURFACES).map(dailyCss);
  assert.equal(a, b, 'the landing and the country pages must style a daily card identically');
});

test('the terms are one table, not six buttons', () => {
  // Measured on production: 7 bordered elements per card and 24 border edges,
  // because every cell owned a 1px border and gap:2px turned each seam into
  // 4px. That lattice — not the colours — is what read as heavy, and the
  // per-cell radius is what made the selected one look like a second CTA.
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    const grid = css.slice(css.indexOf('.daily-terms{'), css.indexOf('.daily-terms{') + 320);
    assert.match(grid, /gap:0/, `${file}: no seam between cells`);
    assert.match(grid, /border:1px solid #e2e8f0/, `${file}: the border belongs to the container`);
    assert.match(grid, /border-radius:10px/, `${file}: and so does the radius`);

    const cell = css.slice(css.indexOf('.daily-term{'), css.indexOf('.daily-term{') + 480);
    assert.match(cell, /border:0/, `${file}: a cell owns no box`);
    assert.match(cell, /border-radius:0/, `${file}: a rounded cell imitates the CTA`);
    assert.match(cell, /background:transparent/, `${file}: unselected cells are not plates`);
    assert.match(cell, /border-right:1px solid #eef2f7/, `${file}: hairline dividers instead`);
    assert.match(cell, /cursor:pointer/, `${file}: it still has to look clickable`);
    assert.match(cell, /min-height:52px/, `${file}: and stay a comfortable tap target`);
  }
});

test('the selected term is a solid brand fill, at full white', () => {
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    const at = css.indexOf('.daily-term.is-selected,');
    assert.ok(at > 0, `${file}: the selected state must be styled`);
    assert.match(css.slice(at, at + 200), /background:var\(--blue\)/, `${file}: a fill, not a hint`);
    assert.match(css, /\.daily-term\.is-selected \.daily-term-days,\s*\n\.daily-term\.is-selected \.daily-term-price\{color:#fff;\}/,
      `${file}: both lines go white`);
    // White on #4267E8 is 4.84:1 — fading it to 85% lands near 3.9 and fails.
    assert.ok(!/is-selected[\s\S]{0,200}rgba\(255,255,255,\.\d/.test(css),
      `${file}: the white must not be faded on the fill`);
    assert.ok(contrast('#ffffff', '#4267E8') >= AA);

    // The fill must survive a hover, and hover must not fire on touch, where
    // it sticks after a tap and makes a neighbour look half-selected.
    assert.match(css, /\.daily-term\.is-selected:hover\{background:var\(--blue\)/, file);
    assert.match(css, /@media \(hover:hover\) and \(pointer:fine\)/, `${file}: hover is gated`);
  }
});

test('the selection survives forced-colors, where the fill does not', () => {
  // In Windows High Contrast the background is stripped. With selection
  // signalled only by a fill, all six cells would render identically and the
  // chosen term would be invisible — state loss, not a cosmetic issue.
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    assert.match(css, /@media \(forced-colors:active\)/, `${file}: no forced-colors fallback`);
    const fc = css.slice(css.indexOf('@media (forced-colors:active)'));
    assert.match(fc, /\.daily-term\.is-selected\{outline:3px solid Highlight/, `${file}: the outline is what survives`);
  }
});

test('the card aligns by subgrid, not by one row absorbing the slack', () => {
  // Giving `desc` 1fr made ONE section absorb every difference: a card with a
  // single fixed term stretched its description to 247px while its neighbours
  // sat at 47px, so «Выберите срок», the network badge and the coverage line
  // all started lower. Only the button matched, because it is the last row.
  // Subgrid hands the row heights to the parent, so each section is as tall as
  // the tallest one beside it and every section starts on the same Y.
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    assert.match(css, /@supports \(grid-template-rows:subgrid\)/, `${file}: no subgrid path`);
    assert.match(css, /#dailyGrid > \.daily-card\{[\s\S]{0,120}grid-template-rows:subgrid/,
      `${file}: the card must take its rows from the grid`);
    assert.match(css, /grid-row:span 6/, `${file}: the card must span all six rows`);
    // row-gap would otherwise fall BETWEEN a card's own sections.
    assert.match(css, /#dailyGrid\{row-gap:0/, `${file}: the parent gap must not split the card`);
    assert.match(css, /margin-bottom:16px/, `${file}: and the gap between rows must come back`);

    // The fallback still names all seven sections in order.
    assert.match(css, /grid-template-areas:'top' 'title' 'desc' 'terms' 'meta' 'buy'/, file);
    for (const [sel, area] of [
      ['.daily-card__title', 'title'],
      ['.daily-card .daily-lines', 'desc'],
      ['.daily-card .daily-terms-block', 'terms'],
      ['.daily-card__meta', 'meta'],
      ['.daily-card .package-actions', 'buy'],
    ]) {
      const i = css.indexOf(sel + '{');
      assert.ok(i > 0, `${file}: ${sel} is not styled`);
      assert.match(css.slice(i, i + 160), new RegExp(`grid-area:${area}`), `${file}: ${sel} must own ${area}`);
    }
  }
});

test('the term block is always rendered, even empty, so it holds its row', () => {
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 2000);
    assert.match(fn, /return '<div class="daily-terms-block"><\/div>'/,
      `${f}: an empty term block must still occupy the row`);
  }
});

test('the selector announces itself, and each cell states a term and a price', () => {
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 2400);
    assert.match(fn, /Выберите срок:/, `${f}: the chooser needs a label`);
    // The dot separator went with the pill: day and price now sit on two lines,
    // which is what lets the six prices line up in scannable columns.
    assert.ok(!/daily-term-dot/.test(fn), `${f}: the inline separator is gone`);
    assert.match(fn, /daily-term-days[\s\S]{0,200}daily-term-price/, `${f}: day above, price below`);
    // A screen reader gets the pair as one phrase, not two orphan spans.
    assert.match(fn, /aria-label="\$\{escapeHtml\(String\(t\.days\)\)\}[^"]*за \$\{escapeHtml\(String\(t\.price\)\)\}/,
      `${f}: the cell must read as «N дней за M рублей»`);
  }
  const s = read('assets/country-tariffs.js');
  assert.match(s, /single\?'Срок:':'Выберите срок:'/);
});

test('the terms are a three-column table, so the prices line up', () => {
  // Wrapped pills put the six prices on three different x positions (300/500,
  // 700/1000, 1450/2800), so «is 30 days better value» could not be read at a
  // glance. A fixed three-column grid gives two scannable price columns.
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    const terms = css.slice(css.indexOf('.daily-terms{'), css.indexOf('.daily-terms{') + 300);
    assert.match(terms, /display:grid/, `${file}: a table, not a wrap`);
    assert.match(terms, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, `${file}: three equal columns`);
    assert.ok(!/flex-wrap:wrap/.test(terms), `${file}: wrapping is what misaligned the prices`);

    // Digits must line up vertically, or the columns buy nothing.
    const price = css.slice(css.indexOf('.daily-term-price{'), css.indexOf('.daily-term-price{') + 220);
    assert.match(price, /font-variant-numeric:tabular-nums/, `${file}: prices need tabular figures`);

    assert.ok(css.includes('prefers-color-scheme:dark'), `${file}: the card has a dark theme`);
    const dark = css.slice(css.indexOf('@media (prefers-color-scheme:dark)'));
    assert.match(dark, /\.daily-term\.is-selected,[\s\S]{0,120}background:var\(--blue\)/,
      `${file}: and the selection is the same fill in it`);
  }
});

test('mobile keeps the three columns and only tightens them', () => {
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    const mobile = css.slice(css.indexOf('@media (max-width:560px)'));
    assert.match(mobile, /\.daily-card\{grid-template-rows:auto auto auto auto auto auto;?\}/, file);
    // The three columns are kept on a phone — «10 дней» / «1450 ₽» still fit —
    // and only the padding tightens.
    assert.match(mobile, /\.daily-term\{padding:/, `${file}: the cell tightens rather than reflowing`);
  }
});

test('a fixed-term plan shows its price too, and reserves the same row', () => {
  // MobiMatter sells a finished product: one term, nothing to choose. It has no
  // ladder, and without this branch such a card showed its price NOWHERE — the
  // chips are the only place a daily card carries one — and left the terms row
  // empty, so everything below it sat higher than on the card beside it.
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 2400);
    assert.match(fn, /daily_term_mode\|\|''\)==='FIXED_TERM'/, `${f}: must handle the fixed term`);
    assert.match(fn, /days:Number\(item\.validity_days\),price:Number\(item\.price\)/,
      `${f}: from the row's own term and price`);
  }
});

test('a fixed-term plan is buyable, and an unpriceable one still is not', () => {
  for (const f of SURFACES) {
    const s = read(f);
    // The buy control falls back to the row's own term for a fixed-term plan…
    assert.match(s, /FIXED_TERM'\s*\n?\s*&& Number\(item\.validity_days\)>0 && Number\(item\.price\)>0/,
      `${f}: fixed-term plans must remain sellable`);
    // …and still refuses when there is neither a ladder nor a term.
    assert.match(s, /Временно недоступен/);
  }
});

// ---------------------------------------------------------------------------
// RENDERING IT, not reading it.
//
// Every test above matches source text, and a matched string proves only that
// the string is there. It cannot see that `${buy}` refers to a variable the
// function never declares — which is exactly what shipped into index.html
// while all 30 text assertions stayed green. A daily card that throws on
// render is not a layout bug, it is an empty block.
//
// So this pulls the real functions out of each surface and CALLS them.

function extractFns(file, names) {
  const src = read(file);
  const out = [];
  for (const n of names) {
    const at = src.indexOf(`function ${n}(`);
    assert.ok(at > 0, `${file}: function ${n} not found`);
    // Brace-match the body rather than guessing a length, so this cannot rot
    // into covering half a function the way a fixed window does.
    let i = src.indexOf('{', at), depth = 0, end = -1;
    for (let j = i; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
    }
    assert.ok(end > 0, `${file}: could not delimit ${n}`);
    out.push(src.slice(at, end));
  }
  return out.join('\n');
}

const SAMPLE = {
  package_id: 'p1', name: 'Japan 500MB/Day (IIJ)', plan_type: 'DAILY',
  daily_term_mode: 'PER_DAY', daily_gb: 0.49, daily_throttle_label: '256 Kbps',
  daily_throttle_continues: false, daily_reset_confirmed: false,
  validity_days: null, country_code: 'JP', coverage_country_codes: ['JP'],
  data_gb: 0, price: 150, retail_price_rub: 150,
  network_technologies: ['3G', '4G'], speed: '3G/4G',
  term_prices: [{ days: 3, price: 350 }, { days: 7, price: 800 }, { days: 30, price: 3000 }],
};

function renderer(file) {
  const copy = read('assets/daily-plan-copy.js');
  const body = extractFns(file, ['dailyTermsHtml', 'renderDailyCard']);
  const buyName = file === 'index.html' ? 'dailyBuyButtonHtml' : null;
  const extra = buyName ? extractFns(file, ['dailyBuyButtonHtmlInner', 'dailyBuyButtonHtml']) : '';
  return new Function('window', `
    ${copy}
    const D = window.MagicDailyPlan;
    const dailyCopy = () => D;
    const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g,
      (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
    const ICON_BOLT = '';
    const countryName = (c) => (String(c).toUpperCase() === 'JP' ? 'Япония' : String(c).toUpperCase());
    const tariffNetworkLabel = (p) => (p.network_technologies || []).join('/');
    const buyButtonHtml = (p) =>
      '<a class="btn package-buy js-buy" data-days="' + escapeHtml(p.validity_days)
      + '" data-price="' + escapeHtml(p.price) + '">Купить</a>';
    ${extra}
    ${body}
    return renderDailyCard;
  `)({});
}

for (const file of SURFACES) {
  test(`${file}: renderDailyCard actually runs and returns a whole card`, () => {
    const html = renderer(file)(SAMPLE);

    // The failure this exists for: an undeclared identifier throws above, and
    // an empty string means the card silently vanished.
    assert.ok(html && html.length > 200, 'the renderer produced nothing');

    // Every section the grid places must be present, or a row collapses.
    for (const cls of ['daily-card__title', 'daily-lines', 'daily-terms-block',
      'daily-card__meta', 'package-actions']) {
      assert.ok(html.includes(cls), `${cls} is missing from the rendered card`);
    }

    // Built name, not the provider's.
    assert.ok(html.includes('Япония — 500 МБ в день'), 'the built Russian name is not on the card');
    assert.ok(!/Japan|IIJ|MB\/Day/.test(html), 'a raw provider name reached the card');

    // A real chooser: three chips, the first one selected, price beside term.
    assert.equal((html.match(/js-daily-term/g) || []).length, 3);
    assert.equal((html.match(/is-selected/g) || []).length, 1, 'exactly one term starts selected');
    assert.ok(html.includes('Выберите срок:'));
    assert.ok(html.includes('3 дня'), 'the term is spelled in Russian');
    assert.ok(html.includes('350 ₽'), 'the cell must carry its own price');
    // Day above, price below — the shape that lets the columns line up.
    assert.match(html, /daily-term-days[\s\S]{0,120}daily-term-price/);
    assert.ok(!html.includes('daily-term-dot'), 'the inline separator belonged to the pill');

    // And a button that can be bought, priced at the term that starts selected.
    assert.ok(html.includes('js-buy'), 'no buy control');
    assert.ok(/data-days="3"/.test(html), 'the button must start on the selected term');
  });

  test(`${file}: a daily plan with no priced ladder renders no buy button`, () => {
    // A term we cannot price is a term we cannot sell. The card may still
    // describe the plan; it must not offer a purchase it cannot honour.
    const html = renderer(file)({ ...SAMPLE, term_prices: [] });
    assert.ok(html.includes('daily-terms-block'), 'the empty block still holds its row');
    assert.ok(!/js-buy"/.test(html) || /aria-disabled/.test(html),
      'an unpriceable plan must not offer a live buy button');
  });
}

// ---------------------------------------------------------------------------
// THE CHECKOUT SUMMARY.
//
// «Интернет: —» in the order modal for a daily tariff. data_gb is NULL on a
// daily row and that is the model, not a gap: the allowance is per DAY and the
// total depends on the term the customer picks, so the column is deliberately
// empty. The summary read only data_gb, so it printed a dash for a number the
// page had all along — right next to «Срок: 10 дн.» and «Итого: 700 ₽».

function checkoutLabelFn() {
  const s = read('index.html');
  const at = s.indexOf('function checkoutDataLabel');
  assert.ok(at > 0, 'index.html has no checkoutDataLabel');
  let i = s.indexOf('{', at), depth = 0, end = -1;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
  }
  const copy = read('assets/daily-plan-copy.js');
  const w = {};
  new Function('window', copy)(w);
  return new Function('dailyCopy', s.slice(at, end) + '; return checkoutDataLabel;')(() => w.MagicDailyPlan);
}

test('checkout states the daily allowance instead of a dash', () => {
  const label = checkoutLabelFn();
  // The three the report named, in the units the card already uses. 0.49 is
  // what the provider sends for «500MB/Day».
  assert.equal(label({ planType: 'DAILY', dailyGb: '0.49', data: '' }), '500 МБ в день');
  assert.equal(label({ planType: 'DAILY', dailyGb: '1', data: '' }), '1 ГБ в день');
  assert.equal(label({ planType: 'DAILY', dailyGb: '2', data: '' }), '2 ГБ в день');
  // A fixed-term daily plan is still sold by the day — same line, its own term.
  assert.equal(label({ planType: 'DAILY', dailyGb: '1', data: '', days: '3' }), '1 ГБ в день');
});

test('an ordinary package keeps the volume line it always had', () => {
  const label = checkoutLabelFn();
  assert.equal(label({ planType: 'ORDINARY', data: '5' }), '5 GB');
  assert.equal(label({ planType: '', data: '10' }), '10 GB');
  assert.equal(label({ planType: 'ORDINARY', data: '' }), '—');
});

test('a dash survives only where the allowance is genuinely unknown', () => {
  const label = checkoutLabelFn();
  for (const gb of ['', null, undefined, '0', 'abc']) {
    assert.equal(label({ planType: 'DAILY', dailyGb: gb, data: '' }), '—', String(gb));
  }
});

test('and the summary row is actually filled from it', () => {
  // Pinning the helper alone was not enough: reverting just the CALL SITE back
  // to `d.data ? … : '—'` left every test above green while production showed
  // the dash again. The wiring is the thing that ships.
  const s = read('index.html');
  assert.match(s, /byId\('coData'\)\.textContent=checkoutDataLabel\(d\);/,
    'the Интернет row must come from checkoutDataLabel');
  assert.ok(!/byId\('coData'\)\.textContent=d\.data/.test(s),
    'the data_gb-only version must not come back');
});

test('the buy button carries the allowance the summary needs', () => {
  // The summary can only state what the button hands it, and data_gb is empty
  // on a daily row.
  const s = read('index.html');
  const at = s.indexOf('function buyButtonHtml');
  const body = s.slice(at, at + 900);
  assert.match(body, /data-daily-gb="\$\{escapeHtml\(item\.daily_gb\?\?''\)\}"/,
    'the daily allowance must reach the checkout');
  assert.match(body, /data-plan-type=/, 'and so must the kind of plan');
  // …and the click handler must forward it, not drop it on the floor.
  assert.match(s, /dailyGb:b\.dataset\.dailyGb/, 'the handler must pass the allowance through');
});

test('the Mini App already states it, and still does', () => {
  // app/ui.js built this line correctly from the start; pinned so the two
  // surfaces cannot drift to different answers for the same order.
  const ui = read('app/ui.js');
  assert.match(ui, /\$\{D\.formatAllowance\(pkg\.daily_gb\)\} в день/);
  assert.ok(!/\$\{pkg\.data_gb\} ГБ`\s*\)\s*$/.test(ui), 'the ordinary branch must stay conditional');
});

test('the storefront CTA states the price of the selected term', () => {
  // The card lost its only price accent when the selected chip stopped being a
  // filled blue block — deliberately, because that block competed with «Купить».
  // The price moved INTO the button, which is now the one filled element and
  // also the one that says what it costs.
  const s = read('index.html');
  assert.match(s, /`Купить за \$\{first\.price\} ₽`/, 'the button must open on the first term\'s price');
  assert.match(s, /buy\.textContent=`Купить за \$\{btn\.dataset\.price\} ₽`/,
    'and follow the selection');

  // Still the server's rouble in both places — no arithmetic on the client.
  const handler = s.slice(s.indexOf("closest('.js-daily-term')"), s.indexOf("closest('.js-daily-term')") + 700);
  assert.ok(!/[*/+]\s*(?:days|Number\(btn)/.test(handler), 'the client must not compute a price');

  // An ordinary card keeps the plain label.
  assert.match(s, /escapeHtml\(label\|\|'Купить'\)/, 'ordinary packages keep «Купить»');
});

test('the country pages keep their own CTA, because it does not buy', () => {
  // There the button navigates to the catalogue rather than opening checkout,
  // so putting a price on it would promise a purchase it does not make.
  const s = read('assets/country-tariffs.js');
  assert.match(s, />Выбрать тариф</);
  assert.ok(!/Купить за/.test(s), 'the country page must not claim to buy');
});

test('the title carries the allowance, so the description does not repeat it', () => {
  // «Турция — 500 МБ в день» followed by the bullet «500 МБ в день на
  // максимальной скорости» said the same thing twice within 40px.
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function renderDailyCard'), s.indexOf('function renderDailyCard') + 1800);
    assert.match(fn, /lines\.slice\(1\)/, `${f}: the first line is already the title`);
    assert.match(fn, /D\.displayName\(item,countryName\)/, `${f}: and the title is the built name`);
  }
});

// ---------------------------------------------------------------------------
// CONTRAST, as a number.
//
// Measured on production before this was pinned: the label, the day and the
// coverage line all sat on #667085 — 4.97:1 — and the SELECTED cell was the
// palest thing on the card, brand blue on a 10% tint at 4.21:1, under the 4.5
// AA floor for text this size. The unselected price was already #111827 at
// 17.74:1, the ceiling on a white card, so it is everything AROUND the price
// that had to move.
//
// These assert ratios rather than hex codes, so the rule survives a palette
// change instead of quietly becoming decoration.

function relLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** What an alpha tint of `hex` actually composites to over a white card. */
function overWhite(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  const f = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((v) => Math.round(v * alpha + 255 * (1 - alpha)));
  return '#' + f.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const CARD = '#ffffff';
const AA = 4.5;

test('white on the brand fill clears AA', () => {
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    assert.match(css, /\.daily-term\.is-selected,[\s\S]{0,120}background:var\(--blue\)/, file);
    const r = contrast('#ffffff', '#4267E8');
    assert.ok(r >= AA, `white on the brand blue is ${r.toFixed(2)}:1`);
  }
});

test('the day leads and the price supports, both readable', () => {
  // Six equally loud prices meant none of them read as the answer — which is
  // what «цены теряются» actually was. The price is now one calm caption in
  // every cell; the answer lives where there is exactly one of it: white on
  // the selected fill, and again in the CTA.
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    const grab = (sel) => {
      const at = css.indexOf(sel);
      assert.ok(at > 0, `${file}: ${sel} not found`);
      const rule = css.slice(at, at + 260);
      return {
        colour: rule.match(/color:(#[0-9a-f]{6})/)[1],
        size: Number(rule.match(/font-size:(\d+(?:\.\d+)?)px/)[1]),
        weight: Number((rule.match(/font-weight:(\d+)/) || [0, 400])[1]),
      };
    };
    const day = grab('.daily-term-days{');
    const price = grab('.daily-term-price{');

    // Both must be comfortably readable…
    assert.ok(contrast(day.colour, CARD) >= 12, `${file}: day at ${contrast(day.colour, CARD).toFixed(2)}:1`);
    assert.ok(contrast(price.colour, CARD) >= 4.5, `${file}: price at ${contrast(price.colour, CARD).toFixed(2)}:1`);
    // …and the order between them must be unambiguous.
    assert.ok(contrast(day.colour, CARD) > contrast(price.colour, CARD) * 1.5,
      `${file}: the day must clearly lead the price`);
    assert.ok(day.weight > price.weight, `${file}: and carry the heavier weight`);
    assert.ok(price.size <= 15, `${file}: the price must never out-size the CTA`);
  }
});

test('coverage is no fainter than the badge sitting next to it', () => {
  // «Покрытие: 34 страны» measured 4.97:1 against the badge's 4.52:1 and still
  // read as weaker, because the badge has a plate under it and the text does
  // not. Plain text next to a chip has to be darker to look equally present.
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    const meta = css.slice(css.indexOf('.daily-card__meta{'), css.indexOf('.daily-card__meta{') + 260);
    const colour = meta.match(/color:(#[0-9a-f]{6})/)[1];
    // It reads as secondary by design now, so the bar is «clearly legible»,
    // not «as dark as possible» — the heaviness beside it is what is gone.
    assert.ok(contrast(colour, CARD) >= 7,
      `${file}: coverage at ${contrast(colour, CARD).toFixed(2)}:1`);
    // And the network label lost its pill: a fifth boxed container per card
    // was part of the same overload.
    const badge = css.slice(css.indexOf('.daily-card__meta .package-tag{'), css.indexOf('.daily-card__meta .package-tag{') + 200);
    assert.match(badge, /border:0;background:none/, `${file}: the badge is text, not a control`);
  }
});

test('the Mini App marks the chosen term the same way, not with a ring', () => {
  // Its picker is a different component — a full-width «day · price» row — but
  // it carried the same weak signal: a 1px accent border. A ring that reads as
  // «could be chosen» is wrong on both surfaces.
  const css = readFileSync(join(ROOT, 'app/mini.css'), 'utf8');
  const at = css.indexOf('.daily-term.is-selected{');
  assert.ok(at > 0, 'the Mini App must style the selected term');
  const rule = css.slice(at, at + 200);
  assert.match(rule, /background:var\(--blue\)/, 'a fill, like the storefront');
  assert.ok(!/box-shadow:inset 0 0 0 1px/.test(rule), 'the 1px ring is what was too quiet');
  // Both halves of the row have to survive the fill.
  assert.match(css, /\.daily-term\.is-selected \.muted,\s*\n\.daily-term\.is-selected \.fact__value\{color:#fff;\}/,
    'the day and the price must both go white on the fill');
});

test('the order screen names a daily plan the way the card does', () => {
  // publicPackageName glues the country to formatDataLabel(data_gb), so the
  // checkout title read «Турция 0.49 GB» — the provider's raw number, on the
  // screen where the customer commits, while the card beside it said
  // «Турция — 500 МБ в день». (data_gb is populated on daily rows in
  // production despite the model saying it should be NULL; the storefront must
  // not depend on that either way.)
  const s = read('index.html');
  assert.match(s, /const name=D\?D\.displayName\(item,countryName\):'';/,
    'the daily buy button must carry the built name');
  assert.match(s, /data-name="\$\{escapeHtml\(name\|\|publicPackageName\(item\)\)\}"/,
    'and the button must prefer it');
  // An ordinary package still names itself the way it always did.
  assert.match(s, /function buyButtonHtml\(item,label,name\)\{/);
});

// ---------------------------------------------------------------------------
// KEYBOARD AND SCREEN READER.
//
// role="radio" inside role="radiogroup" is a contract: ONE tab stop for the
// whole group, arrows move focus and selection, Home/End jump. Six plain
// buttons with default tabindex meant six tab stops per card — 138 on the
// Turkey page — and arrow keys did nothing, which is exactly what a screen
// reader tries in forms mode.

test('the term group takes one tab stop, not six', () => {
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 2600);
    assert.match(fn, /tabindex="\$\{i===0\?'0':'-1'\}"/, `${f}: roving tabindex on render`);

    const at = s.indexOf('function selectDailyTerm');
    assert.ok(at > 0, `${f}: selection must run through one function`);
    const body = s.slice(at, at + 900);
    assert.match(body, /setAttribute\('tabindex',on\?'0':'-1'\)/, `${f}: and it must rove on selection`);
    assert.match(body, /setAttribute\('aria-checked',on\?'true':'false'\)/, `${f}: aria-checked moves with it`);
  }
});

test('arrows and Home/End move the choice, and the mouse takes the same path', () => {
  for (const f of SURFACES) {
    const s = read(f);
    const at = s.indexOf('function dailyTermsKeydown');
    assert.ok(at > 0, `${f}: no keyboard handler`);
    const body = s.slice(at, at + 1200);
    for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End']) {
      assert.ok(body.includes(`'${key}'`), `${f}: ${key} is not handled`);
    }
    assert.match(body, /ev\.preventDefault\(\)/, `${f}: arrows must not also scroll the page`);
    assert.match(body, /selectDailyTerm\(next\)/, `${f}: the keyboard must select, not just focus`);
    assert.match(body, /next\.focus\(\)/, `${f}: …and move focus with the selection`);
    // Wrapping, so End→ArrowRight does not dead-end.
    assert.match(body, /\(i\+1\)%items\.length/, `${f}: forward must wrap`);
    assert.match(body, /\(i-1\+items\.length\)%items\.length/, `${f}: backward must wrap`);
    // One path for both inputs.
    assert.match(s, /closest\('\.js-daily-term'\);\s*\n\s*if\(!btn\)return;\s*\n\s*selectDailyTerm\(btn\);/,
      `${f}: the click handler must delegate to the same function`);
  }
});

test('the group is named by its tariff, not by the word «Срок»', () => {
  // A country page carries two dozen of these groups. «группа, радиокнопка,
  // 3 дня за 200 рублей, 1 из 6» says nothing about WHICH plan is being
  // chosen; the two ids concatenate into «Турция — 500 МБ в день Выберите
  // срок».
  for (const f of SURFACES) {
    const s = read(f);
    assert.ok(!/role="radiogroup" aria-label="Срок"/.test(s), `${f}: the anonymous group name must be gone`);
    assert.match(s, /role="radiogroup" aria-labelledby="dt-\$\{gid\} dl-\$\{gid\}"/, `${f}: named by title + label`);
    assert.match(s, /<div class="daily-terms-label" id="dl-\$\{gid\}"/, `${f}: the label needs its id`);
    assert.match(s, /class="package-title daily-card__title" id="dt-\$\{escapeHtml\(String\(item\.package_id\|\|''\)\)\}"/,
      `${f}: the card title needs the matching id`);
  }
});
