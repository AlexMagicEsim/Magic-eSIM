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
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 1600);
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
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 1600);
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

test('every surface paints the selected term brand blue on white', () => {
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    const at = css.indexOf('.daily-term.is-selected{');
    assert.ok(at > 0, `${file}: no selected-chip rule`);
    const rule = css.slice(at, at + 200);
    assert.match(rule, /background:var\(--blue\)/, `${file}: a tint is invisible in sunlight`);
    assert.match(rule, /color:#fff/, `${file}: the selected chip needs white text`);

    const base = css.slice(css.indexOf('.daily-term{'), css.indexOf('.daily-term{') + 400);
    assert.match(base, /cursor:pointer/, `${file}: it has to look clickable`);
    assert.match(base, /border:1px solid/, `${file}: unselected chips keep a border`);
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
    assert.match(css, /grid-row:span 7/, `${file}: the card must span all seven rows`);
    // row-gap would otherwise fall BETWEEN a card's own sections.
    assert.match(css, /#dailyGrid\{row-gap:0/, `${file}: the parent gap must not split the card`);
    assert.match(css, /margin-bottom:16px/, `${file}: and the gap between rows must come back`);

    // The fallback still names all seven sections in order.
    assert.match(css, /grid-template-areas:'top' 'title' 'desc' 'terms' 'net' 'cov' 'buy'/, file);
    for (const [sel, area] of [
      ['.daily-card__title', 'title'],
      ['.daily-card .daily-lines', 'desc'],
      ['.daily-card .daily-terms-block', 'terms'],
      ['.daily-card__network', 'net'],
      ['.daily-card__coverage', 'cov'],
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

test('the selector announces itself and separates the term from the price', () => {
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 2000);
    assert.match(fn, /Выберите срок:/, `${f}: the chooser needs a label`);
    assert.match(fn, /daily-term-dot/, `${f}: «3 дня300 ₽» is not a price`);
  }
  const s = read('assets/country-tariffs.js');
  assert.match(s, /single\?'Срок:':'Выберите срок:'/);
});

test('the chips wrap instead of shrinking, and the selection survives a dark theme', () => {
  const css = read('assets/country-pages.css');
  const terms = css.slice(css.indexOf('.daily-terms{'), css.indexOf('.daily-terms{') + 400);
  assert.match(terms, /flex-wrap:wrap/, 'two readable rows beat six unreadable chips');

  const selected = css.indexOf('.daily-term.is-selected{');
  assert.ok(selected > 0, 'the selected state must be styled');
  // A border, not just a tint: a background difference is invisible on a phone
  // in sunlight.
  assert.match(css.slice(selected, selected + 200), /border-color:/);

  assert.ok(css.includes('prefers-color-scheme:dark'), 'the card has a dark theme');
  const dark = css.slice(css.indexOf('@media (prefers-color-scheme:dark)'));
  assert.match(dark, /\.daily-term\.is-selected\{/, 'and the selection stays visible in it');
});

test('mobile stops stretching the description and widens the chips', () => {
  for (const file of Object.values(CSS_SURFACES)) {
    const css = dailyCss(file);
    const mobile = css.slice(css.indexOf('@media (max-width:560px)'));
    assert.match(mobile, /\.daily-card\{grid-template-rows:auto auto auto auto auto auto auto;?\}/, file);
    assert.match(mobile, /\.daily-term\{flex:1 1 calc\(50% - 4px\)/, `${file}: two chips per row`);
  }
});

test('a fixed-term plan shows its price too, and reserves the same row', () => {
  // MobiMatter sells a finished product: one term, nothing to choose. It has no
  // ladder, and without this branch such a card showed its price NOWHERE — the
  // chips are the only place a daily card carries one — and left the terms row
  // empty, so everything below it sat higher than on the card beside it.
  for (const f of SURFACES) {
    const s = read(f);
    const fn = s.slice(s.indexOf('function dailyTermsHtml'), s.indexOf('function dailyTermsHtml') + 1600);
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
      'daily-card__network', 'daily-card__coverage', 'package-actions']) {
      assert.ok(html.includes(cls), `${cls} is missing from the rendered card`);
    }

    // Built name, not the provider's.
    assert.ok(html.includes('Япония — 500 МБ в день'), 'the built Russian name is not on the card');
    assert.ok(!/Japan|IIJ|MB\/Day/.test(html), 'a raw provider name reached the card');

    // A real chooser: three chips, the first one selected, price beside term.
    assert.equal((html.match(/js-daily-term/g) || []).length, 3);
    assert.equal((html.match(/is-selected/g) || []).length, 1, 'exactly one term starts selected');
    assert.ok(html.includes('Выберите срок:'));
    assert.ok(html.includes('>3 дня<') || html.includes('3 дня'), 'the term is spelled in Russian');
    assert.ok(html.includes('350 ₽'), 'the chip must carry its own price');

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
