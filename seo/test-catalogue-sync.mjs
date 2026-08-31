// Does the page say true things about the catalogue?
//
// WHY
//
//   Every number a country page prints — how many tariffs, from how many roubles
//   — was computed once, at build time, from a snapshot. Nothing checked it
//   afterwards. By 2026-08-31 the snapshot was 19 days old and:
//
//     * 144 pages advertised a price higher than the cheapest thing on offer;
//     * 5 advertised a price LOWER than anything purchasable — Kosovo promised
//       1000 ₽ against a real floor of 2150 ₽;
//     * /esim/madagascar/ sold 3 local tariffs that had been withdrawn, in its
//       meta description, its visible FAQ and its FAQPage structured data;
//     * 4 pages promised tariffs while rendering an empty grid;
//     * 198 pages printed a hero that contradicted their own tariff grid,
//       because the generator and the browser counted differently.
//
//   None of it was caught, because nothing compared the claim to the catalogue.
//   This file is that comparison.
//
// OFFLINE. Reads assets/catalog.json from the repo — the bot refreshes it six
// times a day — so it can gate CI and can never fail because a provider was slow.
//
// Run: node --test seo/test-catalogue-sync.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadCatalogue, countryFacts, purchasablePrice, isDaily, isMultiCountry, isGlobal, isRestricted } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PK = loadCatalogue();

// ru-RU separates thousands with U+00A0, not a space. A regex with a plain space
// silently misses every four-digit price — which is most of them.
const NB = '[\\d\\u00A0\\u202F\\u2009\\u2007 ]';
const MONEY = new RegExp('от\\s*(' + NB + '+)\\s*₽');
const FACTS = new RegExp(
  '<p class="facts">\\s*'
  + '(?:Локальных тарифов: <b>(\\d+)</b>\\.\\s*)?'
  + '(?:Региональных: <b>(\\d+)</b>\\.\\s*)?'
  + '(?:С оплатой за день: <b>(\\d+)</b>\\.\\s*)?'
  + '(?:Цены от <b>(' + NB + '+) ₽</b>\\.)?'
);
const toNum = (s) => Number(String(s).replace(/[^\d]/g, ''));

function pages() {
  const out = [];
  for (const d of readdirSync(join(ROOT, 'esim'))) {
    const f = join(ROOT, 'esim', d, 'index.html');
    if (!existsSync(f)) continue;
    const h = readFileSync(f, 'utf8');
    const iso = (h.match(/data-country-page="([A-Z]{2})"/) || [])[1];
    if (!iso) continue;                       // guides have no country contract
    out.push({ slug: d, iso, html: h });
  }
  return out;
}
const PAGES = pages();

test('the corpus is there at all', () => {
  // A sweep that silently finds nothing passes every assertion below it.
  assert.ok(PAGES.length > 190, `expected 190+ country pages, found ${PAGES.length}`);
});

// --------------------------------------------------------------------------
// C1 — the advertised price exists somewhere in the catalogue
// --------------------------------------------------------------------------
test('C1: no page quotes a price that appears in no package', () => {
  const bad = [];
  for (const { slug, iso, html } of PAGES) {
    const m = html.match(MONEY);
    if (!m) continue;
    const claimed = toNum(m[1]);
    const f = countryFacts(PK, iso);
    if (!f.all_prices.has(claimed)) bad.push(`${slug}: ${claimed} ₽ exists in no package covering ${iso}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

// --------------------------------------------------------------------------
// C2 — the advertised price is the cheapest PURCHASABLE one
// --------------------------------------------------------------------------
test('C2: no page promises a price cheaper than anything buyable', () => {
  // The bait case, and the only one with a legal edge: a customer arrives for
  // «от 1000 ₽» and the cheapest thing on the page is 2150 ₽.
  const bait = [];
  for (const { slug, iso, html } of PAGES) {
    const m = html.match(MONEY);
    if (!m) continue;
    const f = countryFacts(PK, iso);
    if (f.min_price_rub === null) continue;
    const claimed = toNum(m[1]);
    if (claimed < f.min_price_rub) bait.push(`${slug}: claims ${claimed} ₽, cheapest purchasable is ${f.min_price_rub} ₽`);
  }
  assert.deepEqual(bait, [], bait.join('\n'));
});

test('C2: the generated facts block quotes exactly the minimum purchasable price', () => {
  // Scoped to the generated block, not the hand-written profile sentence: a
  // profile may legitimately quote the cheapest VOLUME plan alongside a GB range.
  const off = [];
  for (const { slug, iso, html } of PAGES) {
    const m = html.match(FACTS);
    if (!m || !m[4]) continue;
    const f = countryFacts(PK, iso);
    if (f.min_price_rub === null) continue;
    if (toNum(m[4]) !== f.min_price_rub) off.push(`${slug}: facts say ${toNum(m[4])} ₽, catalogue minimum is ${f.min_price_rub} ₽`);
  }
  assert.deepEqual(off, [], off.join('\n'));
});

// --------------------------------------------------------------------------
// C3 — the counts match what the grid will render
// --------------------------------------------------------------------------
test('C3: no page advertises tariffs it no longer has', () => {
  const bad = [];
  for (const { slug, iso, html } of PAGES) {
    const m = html.match(FACTS);
    if (!m) continue;
    const f = countryFacts(PK, iso);
    const claimedLocal = m[1] ? Number(m[1]) : 0;
    const claimedReg = m[2] ? Number(m[2]) : 0;
    const claimedDaily = m[3] ? Number(m[3]) : 0;
    if (claimedLocal !== f.local_count) bad.push(`${slug}: claims ${claimedLocal} local, catalogue has ${f.local_count}`);
    if (claimedReg !== f.regional_count) bad.push(`${slug}: claims ${claimedReg} regional, catalogue has ${f.regional_count}`);
    if (claimedDaily !== f.daily_count) bad.push(`${slug}: claims ${claimedDaily} daily, catalogue has ${f.daily_count}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

// --------------------------------------------------------------------------
// C4 — internal consistency, and pages that would render nothing
// --------------------------------------------------------------------------
test('C4b: a page that would render an empty grid does not promise tariffs', () => {
  // Four pages were in this state: every package covering them is dropped by the
  // runtime's own filters, so the grid shows «тарифы не найдены» under a
  // description promising N tariffs from N ₽.
  const bad = [];
  for (const { slug, iso, html } of PAGES) {
    const f = countryFacts(PK, iso);
    if (!f.renders_nothing) continue;
    if (MONEY.test(html)) bad.push(`${slug}: renders nothing, yet quotes a price`);
    const m = html.match(FACTS);
    if (m && (m[1] || m[2] || m[3])) bad.push(`${slug}: renders nothing, yet claims a tariff count`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

// --------------------------------------------------------------------------
// C5 — the contract the runtime depends on survived the build
// --------------------------------------------------------------------------
test('C5: every country page keeps the ids renderCountrySplit reads', () => {
  // Their absence is what once shipped 190 pages with a permanent
  // «Загружаем тарифы…» and an empty grid.
  const need = ['packagesStatus', 'localBlock', 'localCount', 'localEmpty', 'localGrid', 'regionalCount'];
  const bad = [];
  for (const { slug, html } of PAGES) {
    for (const id of need) if (!html.includes(`id="${id}"`)) bad.push(`${slug}: missing id="${id}"`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('C5: the page count did not silently shrink', () => {
  const snap = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8'));
  assert.equal(PAGES.length, snap.countries.length,
    `${PAGES.length} pages against ${snap.countries.length} countries in the snapshot`);
});

// --------------------------------------------------------------------------
// The price rule itself
// --------------------------------------------------------------------------
test('purchasablePrice never returns a per-day rate', () => {
  const perDay = PK.filter((p) => isDaily(p) && p.daily_term_mode === 'PER_DAY');
  assert.ok(perDay.length > 1000, `expected the PER_DAY family, found ${perDay.length}`);
  for (const p of perDay) {
    const mp = purchasablePrice(p);
    assert.ok(mp > 0, `${p.name}: no purchasable price`);
    assert.notEqual(mp, Number(p.price), `${p.name}: returned the raw per-day rate ${p.price}`);
    const terms = p.term_prices.map((t) => Number(t.price));
    assert.equal(mp, Math.min(...terms), `${p.name}: not the cheapest term`);
  }
});

test('purchasablePrice falls back to price for FIXED_TERM dailies', () => {
  // 31 packages: the package IS the term, so there is no ladder to read. This is
  // the same fallback assets/country-tariffs.js:1006 applies.
  const ft = PK.filter((p) => isDaily(p) && p.daily_term_mode === 'FIXED_TERM');
  assert.ok(ft.length > 0);
  for (const p of ft) assert.equal(purchasablePrice(p), Number(p.price), p.name);
});

// --------------------------------------------------------------------------
// MUTATION — a check nobody has seen fail is not known to work
// --------------------------------------------------------------------------
function scratch(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'cat-sync-'));
  const pk = JSON.parse(JSON.stringify(PK));
  mutate(pk);
  return { dir, pk, clean: () => rmSync(dir, { recursive: true, force: true }) };
}

test('MUTATION: C1 fires on an invented price', () => {
  const f = countryFacts(PK, 'RS');
  assert.ok(!f.all_prices.has(1), 'precondition: 1 ₽ is not a real Serbian price');
  assert.ok(f.all_prices.has(f.min_price_rub), 'a real price must be recognised');
});

test('MUTATION: C2 catches what C1 cannot — a real number that is not purchasable', () => {
  // The bait shape, and the reason the two checks are separate. A per-day rate
  // IS a number in the catalogue, so C1 (does this price exist?) waves it
  // through. Only C2 (is it purchasable?) sees the problem.
  //
  // Kenya 500MB/Day: rate 250 ₽, cheapest real term 750 ₽ — and 750 happens to
  // be the country's floor, so quoting 250 would undercut everything on the page.
  const f = countryFacts(PK, 'KE');
  const shown = PK.filter((p) => !isRestricted(p) && !isGlobal(p) && Number(p.price) > 0)
    .filter((p) => (p.coverage_country_codes || []).includes('KE'));
  const baits = shown.filter((p) => Number(p.price) < f.min_price_rub);
  assert.ok(baits.length > 0, 'precondition: at least one raw rate sits below the purchasable floor');

  for (const b of baits) {
    assert.ok(f.all_prices.has(Number(b.price)),
      `${b.name}: the rate is a real number, so C1 alone would pass it`);
    assert.ok(purchasablePrice(b) > Number(b.price),
      `${b.name}: and its purchasable price is strictly higher — that gap IS the bait`);
  }
});

test('MUTATION: dropping term_prices changes the verdict', () => {
  // If the pass/fail set is identical with and without the ladder, the helper is
  // not being consulted and the whole rule is decoration.
  const { pk, clean } = scratch((a) => a.forEach((p) => { delete p.term_prices; }));
  const before = countryFacts(PK, 'IE').min_price_rub;
  const after = countryFacts(pk, 'IE').min_price_rub;
  assert.notEqual(after, before, 'removing term_prices must change the computed minimum');
  clean();
});

test('MUTATION: C3 fires when the catalogue loses a tariff', () => {
  const { pk, clean } = scratch((a) => {
    const i = a.findIndex((p) => (p.coverage_country_codes || []).length === 1
      && p.coverage_country_codes[0] === 'RS' && !isDaily(p));
    a.splice(i, 1);
  });
  assert.equal(countryFacts(pk, 'RS').local_count, countryFacts(PK, 'RS').local_count - 1);
  clean();
});

test('MUTATION: the runtime filters are actually applied', () => {
  const iso = 'RS';
  const base = countryFacts(PK, iso);

  // A global package must be excluded entirely.
  const g = scratch((a) => a.push({ package_id: 'x1', name: 'Global (120+ areas) 3GB', country_code: 'GL-EU',
    coverage_country_codes: [iso], price: 1, plan_type: 'FIXED_VOLUME', data_gb: 3 }));
  assert.equal(countryFacts(g.pk, iso).total_shown, base.total_shown, 'a GL- package must not be counted');
  g.clean();

  // A Russia-named package must be excluded.
  const r = scratch((a) => a.push({ package_id: 'x2', name: 'Russia 5GB', country_code: 'XX',
    coverage_country_codes: [iso], price: 1, plan_type: 'FIXED_VOLUME', data_gb: 5 }));
  assert.equal(countryFacts(r.pk, iso).total_shown, base.total_shown, 'a Russia package must not be counted');
  r.clean();

  // Single-country coverage but a regional NAME lands in regional, not local.
  const e = scratch((a) => a.push({ package_id: 'x3', name: 'Europe 7GB', country_code: 'XX',
    coverage_country_codes: [iso], price: 999, plan_type: 'FIXED_VOLUME', data_gb: 7 }));
  const ef = countryFacts(e.pk, iso);
  assert.equal(ef.local_count, base.local_count, 'name-based regional must not become local');
  assert.equal(ef.regional_count, base.regional_count + 1, 'it must land in regional');
  e.clean();
});

test('MUTATION: a daily plan never lands in the volume counts', () => {
  const iso = 'RS';
  const base = countryFacts(PK, iso);
  const d = scratch((a) => a.push({ package_id: 'x4', name: 'Serbia 1GB/Day', country_code: 'RS',
    coverage_country_codes: [iso], price: 100, plan_type: 'DAILY', daily_term_mode: 'PER_DAY',
    daily_gb: 1, data_gb: 0, term_prices: [{ days: 3, price: 300 }] }));
  const f = countryFacts(d.pk, iso);
  assert.equal(f.local_count, base.local_count, 'daily must not inflate local');
  assert.equal(f.regional_count, base.regional_count, 'daily must not inflate regional');
  assert.equal(f.daily_count, base.daily_count + 1, 'daily must be counted as daily');
  assert.equal(f.min_price_rub, Math.min(base.min_price_rub, 300), 'and it must be priced off its term, not its rate');
  d.clean();
});

test('MUTATION: volumes never carry a daily plan zero', () => {
  for (const { iso } of PAGES) {
    const f = countryFacts(PK, iso);
    assert.ok(!f.volumes.includes(0), `${iso}: 0 ГБ leaked into the volume list`);
  }
});

test('the derivation stays offline', () => {
  const src = readFileSync(join(ROOT, 'seo/catalogue-facts.mjs'), 'utf8');
  assert.ok(!/\bfetch\s*\(/.test(src), 'catalogue-facts.mjs must never reach the network');
});
