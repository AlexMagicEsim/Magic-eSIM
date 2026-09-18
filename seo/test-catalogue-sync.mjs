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
test('C4b: no page exists for a country whose grid would render nothing', () => {
  // This replaces an earlier form that iterated the PAGES and skipped anything
  // not `renders_nothing`. Once such pages stopped existing, that loop examined
  // zero rows and passed having checked nothing — a detector that cannot fail.
  //
  // The four that were in this state — russia, belarus, ukraine,
  // us-virgin-islands — were 200, indexable, in the sitemap, in the hub, linked
  // from five neighbours each, and had never once appeared in search. Their H1
  // offered «eSIM для поездки» for a destination with nothing to sell.
  const bad = [];
  for (const { slug, iso } of PAGES) {
    if (countryFacts(PK, iso).renders_nothing) bad.push(`${slug} (${iso}): page exists but its grid would be empty`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('C4b mirror: every sellable country HAS a page, and no other country does', () => {
  // The other direction, and the one that makes the rule self-healing in a repo
  // with no build step. Removal is automatic — the snapshot drops the country and
  // the page, hub card, sitemap entry and neighbour links go with it. RESTORATION
  // is not: assets/catalog.json is refreshed by a bot six times a day, but
  // seo/catalogue-countries.json is only rewritten when a person runs
  // fetch-catalogue.mjs.
  //
  // So if a country becomes sellable again — VI would, if isRussiaPackage's
  // region-token clause were ever narrowed — nothing else would notice. This
  // assertion turns that into a red build with a named country instead of a page
  // that stays 404 until someone happens to rebuild.
  const sellable = new Set();
  for (const p of PK) {
    for (const iso of (p.coverage_country_codes || [])) {
      if (!/^[A-Z]{2}$/.test(String(iso))) continue;
      if (!countryFacts(PK, iso).renders_nothing) sellable.add(String(iso).toUpperCase());
    }
  }
  const have = new Set(PAGES.map((x) => x.iso));

  const snap = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8'));
  const named = new Set(snap.countries.map((c) => c.iso));

  // Only countries the snapshot names can have a page at all — an unnamed ISO or
  // one on the NO_PAGE list is a separate, deliberate exclusion.
  const missing = [...sellable].filter((iso) => named.has(iso) && !have.has(iso));
  const extra = [...have].filter((iso) => !sellable.has(iso));

  assert.deepEqual(missing, [], `sellable countries with no page: ${missing.join(', ')} — run seo/build-all.mjs`);
  assert.deepEqual(extra, [], `pages for countries that sell nothing: ${extra.join(', ')}`);
});

test('C5: no orphaned country directory survives a removal', () => {
  // build-catalogue-pages.mjs only ever mkdir + writeFile — there is no rm
  // anywhere in seo/. A country dropped from the snapshot keeps its directory,
  // keeps 200, keeps index/follow and its self-canonical, and becomes an
  // unreachable indexable page: worse than before it was removed. Deletion has
  // to be explicit, and this is what notices when it was not.
  const snap = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8'));
  const known = new Set(snap.countries.map((c) => c.slug));
  const guides = new Set(['compatibility', 'activation-before-travel', 'not-working', 'dual-sim-sms', 'payment-rubles']);
  const orphans = readdirSync(join(ROOT, 'esim'))
    .filter((d) => existsSync(join(ROOT, 'esim', d, 'index.html')))
    .filter((d) => !known.has(d) && !guides.has(d));
  assert.deepEqual(orphans, [], `orphaned page directories: ${orphans.join(', ')}`);
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
/**
 * Did this PER_DAY package price itself from its LADDER, or fall back to the
 * per-day rate? Returns null when it is fine, a reason when it is not.
 *
 * THE RULE IS ABOUT PROVENANCE, NOT ABOUT A NUMBER, and that distinction cost a
 * production run on 2026-09-18. The check used to be
 * `assert.notEqual(mp, Number(p.price))` — a proxy that reads «the answer does
 * not look like the rate». On that day the provider repriced the Israel daily
 * family: «Israel 500MB/Day» kept its 450 ₽/day rate while its cheapest ladder
 * step, 3 days, fell from 1200 ₽ to 450 ₽. The ladder was intact, monotonic
 * (150→128 ₽/day) and the 450 ₽ was genuinely purchasable — three days of it —
 * but the two numbers now COLLIDED, and the proxy could not tell «came from the
 * ladder» from «fell back to the rate». One package of 1293.
 *
 * It blocked the whole refresh, and what it blocked was a CORRECTION: the live
 * pages said «Цены от 600 ₽» for Israel while the floor had dropped to 450 ₽.
 * A gate that stops the site from getting less wrong is worse than no gate.
 *
 * So the question is asked directly. A ladder exists → the answer must be its
 * cheapest step. No ladder → there is nothing to buy but a rate, and a PER_DAY
 * package in that state is the real defect this file was written to catch.
 */
function perDayLadderVerdict(p) {
  const mp = purchasablePrice(p);
  if (!(mp > 0)) return 'no purchasable price';
  const raw = Array.isArray(p.term_prices) ? p.term_prices : [];
  const terms = raw.map((t) => Number(t.price)).filter((n) => Number.isFinite(n) && n > 0);
  // No ladder at all: purchasablePrice can only have returned the rate, and one
  // day of a PER_DAY plan is not sold. THIS is the bait price.
  if (!terms.length) return `PER_DAY without a ladder — ${mp} can only be the raw per-day rate`;
  // A rung of 0, negative or non-numeric. purchasablePrice filters these out
  // with this exact predicate, so without naming them here they would be
  // invisible to both sides — and a ladder that carries one is a ladder nobody
  // should be reading a floor price off. The assertion this function replaced
  // pinned them only by accident, through a `Math.min` over unfiltered terms;
  // 0 packages are in that state today, so this is a restored guard, not a live
  // defect.
  if (terms.length !== raw.length) return `ladder carries ${raw.length - terms.length} unusable step(s)`;
  const cheapest = Math.min(...terms);
  if (mp !== cheapest) return `not the cheapest term (${mp} against ${cheapest})`;
  return null;
}

test('purchasablePrice prices every PER_DAY plan from its ladder', () => {
  const perDay = PK.filter((p) => isDaily(p) && p.daily_term_mode === 'PER_DAY');
  assert.ok(perDay.length > 1000, `expected the PER_DAY family, found ${perDay.length}`);
  const bad = [];
  for (const p of perDay) {
    const why = perDayLadderVerdict(p);
    if (why) bad.push(`${p.name}: ${why}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('REGRESSION 2026-09-18: a cheapest term that equals the per-day rate is accepted', () => {
  // The exact shape that stopped the refresh. The rate and the 3-day price are
  // both 450; the ladder is real and the 450 buys three days.
  const israel = {
    name: 'Israel 500MB/Day', plan_type: 'DAILY', daily_term_mode: 'PER_DAY', price: 450,
    term_prices: [{ days: 3, price: 450 }, { days: 5, price: 750 }, { days: 7, price: 1000 },
                  { days: 10, price: 1400 }, { days: 15, price: 2050 }, { days: 30, price: 3850 }],
  };
  assert.equal(perDayLadderVerdict(israel), null);
  assert.equal(purchasablePrice(israel), 450);

  // …and it is not a special case for one package: the same collision anywhere
  // on the ladder is still the ladder's own number. This line is the
  // load-bearing half — it is what turns this test red if purchasablePrice ever
  // goes back to reading the rate.
  assert.equal(perDayLadderVerdict({ ...israel, price: 750 }), null);

  // DELIBERATELY NOT ANCHORED TO THE LIVE PACKAGE. The first version looked it
  // up and asserted `if (live) …`, which is the vacuous-pass shape this repo
  // polices: a rename or a withdrawal turns the assertion into nothing, and a
  // revert of the reprice makes it pass while silently no longer exercising the
  // collision at all. Every live package is already checked by the corpus test
  // above; this one pins the SHAPE, and the fixture cannot be taken away.
});

test('MUTATION: the rule still catches a genuine fallback to the per-day rate', () => {
  const base = { name: 'X 1GB/Day', plan_type: 'DAILY', daily_term_mode: 'PER_DAY', price: 500 };
  // No ladder at all — purchasablePrice returns the rate, which is unbuyable.
  assert.match(perDayLadderVerdict({ ...base, term_prices: [] }) || '', /without a ladder/);
  assert.match(perDayLadderVerdict({ ...base }) || '', /without a ladder/);
  // A ladder of unusable numbers is the same thing wearing a ladder's clothes.
  assert.match(perDayLadderVerdict({ ...base, term_prices: [{ days: 3, price: 0 }] }) || '', /without a ladder/);
  assert.match(perDayLadderVerdict({ ...base, term_prices: [{ days: 3, price: null }] }) || '', /without a ladder/);
  // And a package with no price at all is refused rather than passed as 0.
  assert.match(perDayLadderVerdict({ ...base, price: 0, term_prices: [] }) || '', /no purchasable price/);

  // A ladder with a usable step AND a junk one. purchasablePrice would quietly
  // ignore the junk and answer 750, which is a real price — so this is the case
  // the provenance rule could have lost, and the review that found it is the
  // reason these four lines exist.
  const withJunk = (bad) => ({ ...base, term_prices: [{ days: 3, price: bad }, { days: 5, price: 750 }] });
  for (const bad of [0, -5, 'abc', null, undefined, NaN]) {
    assert.match(perDayLadderVerdict(withJunk(bad)) || '', /unusable step/,
      `ступень ${JSON.stringify(bad)} должна быть отвергнута`);
  }
  // …and a clean two-step ladder still passes, so the guard is not blanket.
  assert.equal(perDayLadderVerdict(withJunk(450)), null);
});

test('MUTATION: the rule fires on the REAL corpus when a ladder is taken away', () => {
  // Synthetic fixtures prove the function on invented shapes; this runs it on a
  // package taken OUT of the live catalogue, so the fields are the provider's
  // own. It does not re-run the corpus loop above — that was checked separately,
  // by appending a ladder-less PER_DAY package to assets/catalog.json in a copy
  // and watching the loop name it — and this comment says so rather than
  // implying the test itself did it.
  const victim = PK.find((p) => isDaily(p) && p.daily_term_mode === 'PER_DAY'
                               && Array.isArray(p.term_prices) && p.term_prices.length);
  assert.ok(victim, 'no PER_DAY package with a ladder in the catalogue');
  assert.equal(perDayLadderVerdict(victim), null, 'the untouched package must pass');

  const stripped = { ...victim, term_prices: [] };
  assert.match(perDayLadderVerdict(stripped) || '', /without a ladder/);
  assert.equal(purchasablePrice(stripped), Number(victim.price),
    'stripping the ladder must make purchasablePrice fall back to the rate — that is the defect');

  // WHAT CHANGED AND WHAT DID NOT. The assertion this replaced —
  // `notEqual(mp, price)` — caught this stripped package too; it was never blind
  // to the real defect. Verified, not assumed: with an empty ladder
  // purchasablePrice returns the rate, so `mp === price` and the old check
  // fired. What it could not do is tell that case apart from a ladder whose
  // cheapest step merely EQUALS the rate, because both produce the same
  // equality. What the swap DOES lose is one incidental check: the old
  // `Math.min` ran over unfiltered terms, so a rung of 0, negative or
  // non-numeric poisoned the minimum and failed. That is restored explicitly in
  // perDayLadderVerdict above — see the `unusable step(s)` branch — because
  // «we happened to catch it» is not a guard anyone can rely on.
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
  //
  // MEASURED ACROSS THE WHOLE CORPUS, NOT ON ONE HAND-PICKED COUNTRY. This test
  // used to assert `notEqual` on Ireland alone — the same «two numbers differ»
  // proxy that broke the PER_DAY rule above on 2026-09-18, one aggregation level
  // up and waiting its turn. Ireland has margin today (250 against 100), but 11
  // of 203 countries ALREADY collide under this transform — SV LR MG ML MC SX MP
  // MZ CF SD TL, all of them places whose cheapest package is not a daily — and
  // one provider move on Ireland would have turned this red for a reason that
  // has nothing to do with the helper it is testing.
  //
  // A majority cannot be moved by one reprice. The floor is deliberately far
  // below today's number so a normal catalogue week never touches it.
  const { pk, clean } = scratch((a) => a.forEach((p) => { delete p.term_prices; }));
  try {
    const isos = [...new Set(PK.flatMap((p) => p.coverage_country_codes || []))];
    let moved = 0;
    for (const iso of isos) {
      const before = countryFacts(PK, iso).min_price_rub;
      const after = countryFacts(pk, iso).min_price_rub;
      if (before !== after) moved += 1;
    }
    assert.ok(moved > isos.length * 0.75,
      `removing term_prices moved the minimum for only ${moved} of ${isos.length} countries — ` +
      'the ladder is barely being consulted');
  } finally {
    clean();
  }
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
