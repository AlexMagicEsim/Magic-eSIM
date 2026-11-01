// Every number a country page prints about its assortment counts the cards the
// page SHOWS — the backend's published layout (seo/catalogue-facts.mjs
// shownBlocks), not every package whose coverage names the country.
//
// Until 2026-11-01 countryFacts rebuilt the page from coverage codes: on 175 of
// 199 RU pages a generated number disagreed with the grid — Seychelles' FAQ
// said «региональных … Сейчас таких 9» above five regional cards. Pinned here:
// the corpus (facts line, template FAQ, FAQPage, template description, hub), and
// each catalogue move on fixtures with their own published layout
// (seo/fixture-layout.mjs). The browser half — the page draws exactly these
// cards — is test/e2e/published-counts.spec.js.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogueDoc, countryFacts, countryOffers, shownBlocks, hasCountryPage, purchasablePrice } from './catalogue-facts.mjs';
import { loadPublishedCatalogue } from './page-claims.mjs';
import { layoutByCoverage, republish } from './fixture-layout.mjs';
import { COVERAGE_ONLY_CODES } from './coverage-only-territories.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = loadCatalogueDoc();
const clone = (x) => JSON.parse(JSON.stringify(x));
const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
const plain = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const PAGES = readdirSync(join(ROOT, 'esim')).map((slug) => {
  const f = join(ROOT, 'esim', slug, 'index.html');
  if (!existsSync(f)) return null;
  const html = readFileSync(f, 'utf8');
  const iso = (html.match(/data-country-page="([A-Z]{2})"/) || [])[1];
  return iso ? { slug, iso, html } : null;
}).filter(Boolean);

// The numbers the template prints, wherever it prints them.
function printed(html) {
  const text = plain(html);
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => { const j = JSON.parse(m[1]); return j['@graph'] || [j]; });
  const faqLd = (ld.find((n) => n['@type'] === 'FAQPage') || { mainEntity: [] }).mainEntity.map((q) => `${q.name} ${q.acceptedAnswer.text}`).join(' ');
  const grab = (re, s) => [...s.matchAll(re)].map((m) => num(m[1]));
  return {
    facts: {
      local: grab(/data-cat="local">(\d+)</g, html), regional: grab(/data-cat="regional">(\d+)</g, html), daily: grab(/data-cat="daily">(\d+)</g, html),
    },
    faq: {
      local: grab(/Сейчас доступно (\d+) локальн/g, text), regional: grab(/включает несколько стран, в том числе эту\. Сейчас таких (\d+)\./g, text),
      daily: grab(/Да, сейчас таких (\d+)\. У них платится не объём/g, text), floor: grab(/Цены начинаются от ([\d\u00a0\u202f\u2009 ]+) ₽/g, text),
    },
    faqLd: {
      local: grab(/Сейчас доступно (\d+) локальн/g, faqLd), regional: grab(/включает несколько стран, в том числе эту\. Сейчас таких (\d+)\./g, faqLd),
      daily: grab(/Да, сейчас таких (\d+)\. У них платится не объём/g, faqLd), floor: grab(/Цены начинаются от ([\d\u00a0\u202f\u2009 ]+) ₽/g, faqLd),
    },
  };
}

// ------------------------------------------------------------------ the corpus

test('the corpus is there', () => assert.ok(PAGES.length >= 190, `${PAGES.length} country pages`));

test('every RU country page: the facts line, the template FAQ and FAQPage count the cards the page shows', () => {
  const bad = [];
  let checked = 0;
  for (const { slug, iso, html } of PAGES) {
    const f = countryFacts(DOC, iso);
    const want = { local: f.local_count, regional: f.regional_count, daily: f.daily_count, floor: f.min_price_rub };
    const got = printed(html);
    for (const where of ['facts', 'faq', 'faqLd']) {
      for (const [k, list] of Object.entries(got[where])) {
        for (const n of list) { checked++; if (n !== want[k]) bad.push(`${slug} ${where}.${k}: ${n}, shown ${want[k]}`); }
      }
    }
    // A category the page does not show is not mentioned: no «региональные … 0», no segment for it.
    if (f.regional_count === 0 && /Что такое региональные тарифы\?/.test(html)) bad.push(`${slug}: regional question with no regional card`);
    if (f.daily_count === 0 && /data-cat-seg="daily"/.test(html)) bad.push(`${slug}: daily segment with no daily card`);
  }
  assert.ok(checked > 600, `numbers read: ${checked} — the patterns must find the template`);
  assert.deepEqual(bad, []);
});

test('Seychelles: the FAQ says five regional plans — the five the page shows, not the nine packages that cover it', () => {
  const page = PAGES.find((p) => p.slug === 'seychelles');
  const covering = DOC.packages.filter((p) => hasCountryPage([p], 'SC') && !(p.coverage_country_codes || []).every((c) => c === 'SC') && !(p.plan_type === 'DAILY'));
  const shown = shownBlocks(DOC, 'SC').regional;
  assert.ok(covering.length > shown.length, `premise: more regional packages cover SC (${covering.length}) than the page shows (${shown.length})`);
  assert.deepEqual(printed(page.html).faq.regional, [shown.length]);
  assert.deepEqual(printed(page.html).facts.regional, [shown.length]);
});

test('the template description (pages without an authored one) counts the shown cards', () => {
  const bad = [];
  for (const { slug, iso, html } of PAGES) {
    const d = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '';
    const m = /— eSIM: (?:(\d+) локальн[а-я]+ тариф[а-я]*)?(?:, )?(?:(\d+) региональн[а-я]+)?[^.]*?(?: и (\d+) тариф[а-я]* с оплатой за день)?, от ([\d\u00a0\u202f\u2009 ]+) ₽\./.exec(d);
    if (!m) continue;
    const f = countryFacts(DOC, iso);
    const [, l, r, dd, floor] = m;
    if (l && num(l) !== f.local_count) bad.push(`${slug}: ${l} local, shown ${f.local_count}`);
    if (r && num(r) !== f.regional_count) bad.push(`${slug}: ${r} regional, shown ${f.regional_count}`);
    if (dd && num(dd) !== f.daily_count) bad.push(`${slug}: ${dd} daily, shown ${f.daily_count}`);
    if (num(floor) !== f.min_price_rub) bad.push(`${slug}: от ${floor}, shown ${f.min_price_rub}`);
  }
  assert.deepEqual(bad, []);
});

test('the hub: «N тарифов · от X ₽» on every destination is the page\'s own shown cards and floor', () => {
  const hub = readFileSync(join(ROOT, 'esim', 'index.html'), 'utf8');
  const rows = [...hub.matchAll(/data-iso="([A-Z]{2})" data-count="(\d+)" data-price="(\d*)"[\s\S]*?<small class="dest-meta">(\d+) тариф[а-я]* · от ([\d\u00a0\u202f\u2009 ]+) ₽/g)];
  assert.ok(rows.length >= 190, `${rows.length} hub rows`);
  const bad = [];
  for (const [, iso, count, price, n, from] of rows) {
    const f = countryFacts(DOC, iso);
    if (Number(count) !== f.total_shown || num(n) !== f.total_shown) bad.push(`${iso}: ${n} тарифов, shown ${f.total_shown}`);
    if (Number(price) !== f.min_price_rub || num(from) !== f.min_price_rub) bad.push(`${iso}: от ${from}, shown ${f.min_price_rub}`);
  }
  assert.deepEqual(bad, []);
});

test('the prefixed (USD) pages print no count or price of plans at all — their facts come from the USD layout only', () => {
  for (const lang of ['en', 'es']) {
    const html = readFileSync(join(ROOT, lang, 'esim', 'seychelles', 'index.html'), 'utf8');
    assert.doesNotMatch(plain(html), /\b\d+ (regional|local|daily) plans?\b|\$\s?\d|USD \d|\d+ ₽/i, `${lang}: no static count or price`);
  }
  const src = readFileSync(join(ROOT, 'seo', 'build-locale-pages.mjs'), 'utf8');
  assert.doesNotMatch(src, /countryFacts|countryOffers/, 'the USD pages never read the RUB counts');
});

// ------------------------------------------------------------------ the rule, on fixtures

const pk = (o) => ({ country_code: 'SC', coverage_country_codes: ['SC'], plan_type: 'FIXED_VOLUME', daily_gb: null, validity_days: 30, ...o });
const AF = (id, gb, over = {}) => pk({ package_id: id, name: `Africa ${gb} GB`, data_gb: gb, price: 1000 + gb * 100, coverage_country_codes: ['SC', 'MU', 'KE'], ...over });
const WORLD = () => [
  pk({ package_id: 'sc1', name: 'Seychelles 1GB 7Days', data_gb: 1, validity_days: 7, price: 700 }),
  pk({ package_id: 'sc3', name: 'Seychelles 3GB 30Days', data_gb: 3, price: 1800 }),
  ...[1, 3, 5, 10, 15, 20, 30, 40, 50].map((gb, i) => AF(`af${i}`, gb)),
  pk({ package_id: 'scd', name: 'Seychelles 1GB/Day', plan_type: 'DAILY', daily_gb: 1, daily_term_mode: 'PER_DAY', validity_days: null, price: 600, term_prices: [{ days: 3, price: 1850 }, { days: 7, price: 3650 }] }),
];
// The backend shows five of the nine Africa packs (its R-rules and the regional cap — not this file's business).
const SHOWN5 = (pkgs = WORLD()) => { const d = layoutByCoverage(pkgs); d.assortment.countries.SC.regional = ['af0', 'af1', 'af2', 'af3', 'af4']; return d; };

test('1. nine packages cover the country, the backend shows five: five', () => {
  const d = SHOWN5();
  assert.equal(d.packages.filter((p) => p.name.startsWith('Africa')).length, 9);
  const f = countryFacts(d, 'SC');
  assert.deepEqual([f.local_count, f.regional_count, f.daily_count, f.total_shown], [2, 5, 1, 8]);
  assert.deepEqual(f.volumes, [1, 3, 5, 10, 15], 'volumes of the shown cards only');
});

test('2. the provider behind a card switches: same counts, same floor', () => {
  const d = SHOWN5();
  const before = countryFacts(d, 'SC');
  const swapped = clone(d);
  swapped.packages = swapped.packages.map((p) => (p.package_id === 'af2' ? { ...p, package_id: 'mm-af2', name: 'Africa 5 GB (other provider)' } : p));
  swapped.assortment.countries.SC.regional = swapped.assortment.countries.SC.regional.map((id) => (id === 'af2' ? 'mm-af2' : id));
  const after = countryFacts(swapped, 'SC');
  assert.deepEqual({ ...after, all_prices: [...after.all_prices] }, { ...before, all_prices: [...before.all_prices] });
});

test('3. a plan leaves sale: the counts drop with it; 4. it returns: they come back', () => {
  const d = layoutByCoverage(WORLD());
  const gone = republish(d, d.packages.filter((p) => p.package_id !== 'sc3'));
  assert.equal(countryFacts(gone, 'SC').local_count, countryFacts(d, 'SC').local_count - 1);
  const back = republish(gone, [...gone.packages, WORLD().find((p) => p.package_id === 'sc3')]);
  assert.equal(countryFacts(back, 'SC').local_count, countryFacts(d, 'SC').local_count);
});

test('5. look-alikes are the backend\'s to deduplicate; a layout that repeats a card is refused, never counted twice', () => {
  const d = SHOWN5();
  const twin = clone(d);
  twin.packages.push(AF('af2-twin', 5));
  assert.equal(countryFacts(twin, 'SC').regional_count, 5, 'a look-alike the backend does not show is not counted');
  const repeated = clone(loadPublishedCatalogue());
  const iso = Object.keys(repeated.assortment.countries).find((k) => repeated.assortment.countries[k].local.length);
  repeated.assortment.countries[iso].local.push(repeated.assortment.countries[iso].local[0]);
  assert.throws(() => loadPublishedCatalogue(null, { doc: repeated }), /повторяет карточку/);
});

test('6. local, regional and worldwide never mix: a worldwide card the backend shows is counted in regional', () => {
  const d = SHOWN5();
  d.packages.push(pk({ package_id: 'w1', name: 'World 1 GB', country_code: 'GL-120', data_gb: 1, price: 2050, coverage_country_codes: ['SC', 'MU', 'US', 'FR'] }));
  d.assortment.countries.SC.regional.push('w1');
  const f = countryFacts(d, 'SC');
  assert.deepEqual([f.local_count, f.regional_count], [2, 6]);
});

test('7. daily cards are their own block: never in the volume counts or volumes; the floor is a rung, never the rate', () => {
  const f = countryFacts(SHOWN5(), 'SC');
  assert.equal(f.daily_count, 1);
  assert.ok(!f.volumes.includes(0));
  assert.deepEqual(f.daily_gb, [1]);
  assert.equal(f.min_price_rub, 700, 'local 1 GB / 7 days, not the 600 ₽ per-day rate');
});

test('8. RUB and USD are separate snapshots: a market\'s numbers come from its own layout', () => {
  const rub = SHOWN5();
  const usd = clone(rub);
  usd.packages = usd.packages.map((p) => ({ ...p, price: Math.round(p.price / 87 * 100) / 100, term_prices: p.term_prices && p.term_prices.map((t) => ({ ...t, price: Math.round(t.price / 87 * 100) / 100 })) }));
  usd.assortment.countries.SC.regional = ['af0', 'af1', 'af2'];
  assert.equal(countryFacts(rub, 'SC').regional_count, 5);
  assert.equal(countryFacts(usd, 'SC').regional_count, 3);
  assert.equal(countryFacts(usd, 'SC').min_price_rub, Math.round(700 / 87 * 100) / 100);
  assert.equal(JSON.parse(readFileSync(join(ROOT, 'assets', 'catalog.json'), 'utf8')).source, 'production-public-api', 'the RU pages read the RUB snapshot');
});

test('9. a retail price moves: the floor and the offer ranges follow it', () => {
  const d = SHOWN5();
  d.packages = d.packages.map((p) => (p.package_id === 'sc1' ? { ...p, price: 650 } : p));
  assert.equal(countryFacts(d, 'SC').min_price_rub, 650);
  assert.equal(countryOffers(d, 'SC').localRange.min, 650);
  assert.equal(purchasablePrice(d.packages.find((p) => p.package_id === 'sc1')), 650);
});

test('10. an empty category: zero, and the page says nothing about it', () => {
  const d = SHOWN5();
  d.assortment.countries.SC.regional = [];
  const f = countryFacts(d, 'SC');
  assert.equal(f.regional_count, 0);
  const noRegional = PAGES.find((p) => countryFacts(DOC, p.iso).regional_count === 0);
  if (noRegional) assert.doesNotMatch(noRegional.html, /Что такое региональные тарифы\?|data-cat-seg="regional"/, noRegional.slug);
});

test('11. an incomplete or corrupt catalogue is refused — no count is ever read from it', () => {
  assert.throws(() => countryFacts(DOC.packages, 'SC'), /нужен снимок каталога с раскладкой/);
  assert.throws(() => countryFacts({ packages: DOC.packages }, 'SC'), /нужен снимок каталога с раскладкой/);
  const live = loadPublishedCatalogue();
  const partial = clone(live); delete partial.assortment.countries.SC;
  assert.throws(() => loadPublishedCatalogue(null, { doc: partial }), /без карточек/);
});

test('12. the same snapshot gives the same numbers, every time', () => {
  for (const iso of ['SC', 'IT', 'US', 'NP']) {
    const a = countryFacts(DOC, iso); const b = countryFacts(clone(DOC), iso);
    assert.deepEqual({ ...a, all_prices: [...a.all_prices] }, { ...b, all_prices: [...b.all_prices] }, iso);
  }
});

test('no generator counts by coverage: the old filter chain is gone from every generator', () => {
  for (const f of ['build-catalogue-pages.mjs', 'catalogue-source.mjs', 'fact-sheet.mjs', 'generated-prices.mjs', 'build-hub.mjs']) {
    const src = readFileSync(join(ROOT, 'seo', f), 'utf8');
    assert.doesNotMatch(src, /coverageCodes\(p\)\.includes\(iso\)\s*&&\s*!isGlobal\(p\)/, `${f}: a page view rebuilt from coverage codes`);
  }
});

test('the fact sheet counts the page\'s own blocks — daily apart — and only for countries with a page', async () => {
  const sheets = JSON.parse(readFileSync(join(ROOT, 'seo', 'fact-sheets.json'), 'utf8')).sheets;
  const bad = [];
  for (const { slug, iso } of PAGES) {
    const s = sheets[slug]; const f = countryFacts(DOC, iso);
    if (!s) { bad.push(`${slug}: no sheet`); continue; }
    if (s.local_count !== f.local_count || s.regional_count !== f.regional_count || s.daily_count !== f.daily_count || s.total_count !== f.total_shown) {
      bad.push(`${slug}: sheet ${s.local_count}/${s.regional_count}/${s.daily_count}/${s.total_count}, page ${f.local_count}/${f.regional_count}/${f.daily_count}/${f.total_shown}`);
    }
  }
  assert.deepEqual(bad, []);
  // A sheet for every page, for the coverage-only territories (AN, KT — named in coverage lists, no page), and for no
  // other country: LS, NC, TG are laid out by the backend but have no page.
  const pageIsos = new Set(PAGES.map((p) => p.iso));
  const extra = Object.values(sheets).map((s) => s.iso).filter((iso) => !pageIsos.has(iso));
  assert.deepEqual(extra.filter((iso) => !COVERAGE_ONLY_CODES.has(iso)), [], 'no sheet for a country without a page');
  const { checkFacts } = await import('./content-review.mjs');
  const andorra = sheets.andorra; const fa = countryFacts(DOC, 'AD');
  const say = (t) => checkFacts({ faq: [{ q: 'Вопрос?', a: t }] }, andorra);
  assert.deepEqual(say(`Здесь ${fa.daily_count} тарифов с оплатой за день.`), [], 'a true count of the daily block is accepted');
  assert.ok(say(`Здесь ${fa.local_count + fa.daily_count + 100} тарифов.`).length > 0, 'an invented count is not');
});

test('an API answer without a complete layout is refused before anything is written', async () => {
  const src = readFileSync(join(ROOT, 'seo', 'catalogue-source.mjs'), 'utf8');
  assert.match(src, /return checkedCountries\(doc, \{ source: API/, 'the --api path goes through the same checks');
  assert.match(readFileSync(join(ROOT, 'seo', 'fact-sheet.mjs'), 'utf8'), /loadPublishedCatalogue\(null, \{ doc: layoutDoc, pages: \[\] \}\)/, 'the fact sheet refuses an incomplete snapshot');
});
