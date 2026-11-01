// Authored references name a CARD (block, volume, term, family), never a provider
// row — seo/plan-ref.mjs, seo/page-claims.mjs (2026-11-01).
//
// Since backend #124 the backend shows, among look-alike plans, the one we buy
// cheapest; the row (id, provider) behind a card can change on any sync. Two
// pinned ids stopped every SEO refresh on 2026-10-31 (storefront #198). These
// tests pin what happens on each catalogue move, on fixtures with their own
// published layout (seo/fixture-layout.mjs), then the corpus.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishedBlocks, selectPlan, validateSelector, familyOf, matches } from './plan-ref.mjs';
import { renderAuthored, loadPublishedCatalogue, readRawProfile, unitOf, withoutUnits } from './page-claims.mjs';
import { loadProfile } from './content-profile.mjs';
import { layoutByCoverage } from './fixture-layout.mjs';
import { money } from './price-tokens.mjs';
import { classify, renderMarkdown } from './refresh-summary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const clone = (x) => JSON.parse(JSON.stringify(x));

// ------------------------------------------------------------------ a small Dominican Republic

const pk = (o) => ({ country_code: 'DO', coverage_country_codes: ['DO'], plan_type: 'FIXED_VOLUME', daily_gb: null, validity_days: 30, ...o });
const WORLD = () => [
  pk({ package_id: 'ea-do-20', provider: 'esimaccess', name: 'Dominican Republic 20GB 30Days', data_gb: 20, price: 4900 }),
  pk({ package_id: 'ea-do-5', provider: 'esimaccess', name: 'Dominican Republic 5GB 30Days', data_gb: 5, price: 1600 }),
  pk({ package_id: 'mm-car-20', provider: 'mobimatter', name: 'Caribbean 20 GB', data_gb: 20, price: 11450, coverage_country_codes: ['DO', 'JM', 'BB'] }),
  pk({ package_id: 'ea-do-day', provider: 'esimaccess', name: 'Dominican Republic 1GB/Day', plan_type: 'DAILY', daily_gb: 1, daily_term_mode: 'PER_DAY', validity_days: null, price: 300,
    term_prices: [{ days: 3, price: 900 }, { days: 7, price: 1950 }] }),
  pk({ package_id: 'mm-do-day7', provider: 'mobimatter', name: 'Dominican Republic 2GB/Day 7 Days', plan_type: 'DAILY', daily_gb: 2, daily_term_mode: 'FIXED_TERM', validity_days: 7, price: 2400 }),
];
const G20 = { block: 'local', attrs: { data_gb: 20, validity_days: 30 } };
const CAR20 = { block: 'regional', attrs: { data_gb: 20, validity_days: 30 }, family: 'caribbean' };
const TEXT = {
  lead: 'Местная линейка — до 20 ГБ на 30 дней за {{price:g20}}.',
  intro: ['Пакет на Карибы на 20 ГБ стоит {{price:car20}}.', 'Без цены.'],
  faq: [{ q: 'Местный или Карибы?', a: 'Местный: {{price:g20}} против {{price:car20}}.' }, { q: 'Посуточно?', a: 'Три дня по 1 ГБ — {{price:day3}}.' }],
};
const RAW = {
  price_refs: { g20: G20, car20: CAR20, day3: { block: 'daily', attrs: { daily_gb: 1 }, days: 3 } },
  price_claims: [{ id: 'local-cheaper', anchors: [{ field: 'faq[0].a', text: 'Местный: {{price:g20}} против {{price:car20}}.' }],
    terms: { local: G20, car: CAR20 }, assert: [{ left: 'local', op: '<', right: 'car' }] }],
};
const render = (packages, raw = RAW, text = TEXT) => renderAuthored('dominican-republic', { text, raw: { ...raw, ...text }, doc: layoutByCoverage(packages) });
const swap = (packages, id, over) => packages.map((p) => (p.package_id === id ? { ...p, ...over } : p));

test('1. eSIM Access → MobiMatter behind the same card: the page is unchanged, nothing is left out', () => {
  const before = render(WORLD());
  const after = render(swap(WORLD(), 'ea-do-20', { package_id: 'mm-do-20', provider: 'mobimatter', name: 'Dominican Republic 20 GB' }));
  assert.deepEqual(after.problems, []);
  assert.deepEqual(after.suppressed, []);
  assert.deepEqual(after.profile, before.profile);
  assert.equal(after.profile.lead, `Местная линейка — до 20 ГБ на 30 дней за ${money(4900)}.`);
});

test('2. MobiMatter → eSIM Access behind the same card: the same', () => {
  const before = render(WORLD());
  const after = render(swap(WORLD(), 'mm-car-20', { package_id: 'ea-car-20', provider: 'esimaccess', name: 'Caribbean 20GB 30Days' }));
  assert.deepEqual([after.problems, after.suppressed], [[], []]);
  assert.deepEqual(after.profile, before.profile);
});

test('3. a new id with the same characteristics and price: byte-identical text', () => {
  const ids = WORLD().map((p) => ({ ...p, package_id: `new-${p.package_id}` }));
  assert.deepEqual(JSON.stringify(render(ids).profile), JSON.stringify(render(WORLD()).profile));
});

test('4. a new id at a new retail price: the new amount is printed; a relation it breaks is left out, one it keeps stays', () => {
  const dearer = render(swap(WORLD(), 'ea-do-20', { package_id: 'mm-do-20', price: 5200 }));
  assert.deepEqual(dearer.suppressed, []);
  assert.equal(dearer.profile.lead, `Местная линейка — до 20 ГБ на 30 дней за ${money(5200)}.`);
  assert.match(dearer.profile.faq[0].a, new RegExp(money(5200)), 'still cheaper than the Caribbean pack: kept');
  const false_ = render(swap(WORLD(), 'ea-do-20', { package_id: 'mm-do-20', price: 12000 }));
  assert.deepEqual(false_.suppressed.map((x) => [x.unit, x.source, x.id]), [['faq[0]', 'price_claims', 'local-cheaper']]);
  assert.equal(false_.profile.faq.length, 1, 'the false comparison is not on the page');
  assert.equal(false_.profile.lead, `Местная линейка — до 20 ГБ на 30 дней за ${money(12000)}.`, 'an amount alone never goes stale');
});

test('5. the plan disappears with no replacement: every piece that prints it is left out — no guess, no stale amount, no raw token', () => {
  const r = render(WORLD().filter((p) => p.package_id !== 'ea-do-20'));
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.suppressed.map((x) => [x.unit, x.source, x.id]).sort(), [['faq[0]', 'price_claims', 'local-cheaper'], ['faq[0]', 'price_refs', 'g20'], ['lead', 'price_refs', 'g20']]);
  assert.equal(r.profile.lead, undefined, 'the template prints its own lead');
  assert.deepEqual(r.profile.faq.map((f) => f.q), ['Посуточно?']);
  assert.doesNotMatch(JSON.stringify(r.profile), /\{\{price:|4 900/);
  // A safe fallback — written by the author, «от N ₽» — is used instead of leaving the sentence out.
  const fb = render(WORLD().filter((p) => p.package_id !== 'ea-do-20'),
    { ...RAW, price_refs: { ...RAW.price_refs, g20: { ...G20, fallback: { min_of: 'local' } } } },
    { ...TEXT, faq: [TEXT.faq[1]] });
  assert.equal(fb.profile.lead, `Местная линейка — до 20 ГБ на 30 дней за ${money(1600)}.`);
});

test('6. several look-alikes in one block: the first in the PUBLISHED order wins — not the cheapest, not a provider', () => {
  const twins = [...WORLD(), pk({ package_id: 'mm-do-20', provider: 'mobimatter', name: 'Dominican Republic 20 GB', data_gb: 20, price: 4500 })];
  const doc = layoutByCoverage(twins);
  assert.equal(selectPlan(publishedBlocks(doc, 'DO'), G20).plan.package_id, 'ea-do-20');
  doc.assortment.countries.DO.local = ['mm-do-20', ...doc.assortment.countries.DO.local.filter((id) => id !== 'mm-do-20')];
  assert.equal(selectPlan(publishedBlocks(doc, 'DO'), G20).plan.package_id, 'mm-do-20');
  assert.equal(renderAuthored('dominican-republic', { text: TEXT, raw: { ...RAW, ...TEXT }, doc }).profile.lead, `Местная линейка — до 20 ГБ на 30 дней за ${money(4500)}.`);
});

test('7. local and regional never stand in for each other — the block is part of the card', () => {
  const blocks = publishedBlocks(layoutByCoverage(WORLD()), 'DO');
  assert.equal(selectPlan(blocks, G20).plan.package_id, 'ea-do-20');
  assert.equal(selectPlan(blocks, { ...G20, block: 'regional', family: 'caribbean' }).plan.package_id, 'mm-car-20', 'the regional 20 GB / 30 days is the Caribbean pack');
  assert.equal(selectPlan(blocks, { ...G20, block: 'regional' }).plan, null, 'a regional card is named by its family — without one nothing matches (and the shape refuses it)');
  assert.equal(selectPlan(blocks, { ...CAR20, family: 'europe' }).plan, null, 'and a family narrows it — «пакет на Карибы» is not any regional pack');
  const noLocal = render(WORLD().filter((p) => p.package_id !== 'ea-do-20'));
  assert.ok(noLocal.suppressed.some((x) => x.id === 'g20'), 'the Caribbean 20 GB never stands in for the local 20 GB');
});

test('8. RUB and USD: amounts are RUB-only — the RU pages read the RUB snapshot, no prefixed page carries a token or a ref', () => {
  const src = readFileSync(join(ROOT, 'seo', 'build-catalogue-pages.mjs'), 'utf8');
  assert.match(src, /loadPublishedCatalogue\(\)/, 'the RU generator reads assets/catalog.json (the RUB snapshot)');
  const doc = loadPublishedCatalogue();
  assert.equal(doc.source, 'production-public-api');
  assert.ok(doc.packages.every((p) => !('price_usd' in p)), 'the RU snapshot carries RUB prices only');
  for (const f of readdirSync(join(ROOT, 'seo'))) {
    if (!/^build-locale|^home-page|^page-copy/.test(f)) continue;
    const t = readFileSync(join(ROOT, 'seo', f), 'utf8');
    assert.doesNotMatch(t, /page-claims|price-tokens|renderPriceTokens/, `${f}: a prefixed (USD) page never prints an RU amount`);
  }
  for (const dir of ['content-en', 'content-es']) {
    for (const f of readdirSync(join(ROOT, 'seo', dir)).filter((x) => x.endsWith('.json'))) {
      const t = readFileSync(join(ROOT, 'seo', dir, f), 'utf8');
      assert.doesNotMatch(t, /\{\{price:|"price_refs"|"package"\s*:/, `${dir}/${f}: no price token, ref or provider id`);
    }
  }
  // The same selector on a USD layout would name the USD card — the rule is per snapshot, never mixed.
  const usd = layoutByCoverage(WORLD().map((p) => ({ ...p, price: Math.round(p.price / 87 * 100) / 100 })));
  assert.equal(selectPlan(publishedBlocks(usd, 'DO'), G20).plan.price, 56.32);
});

test('9. daily cards: a ladder rung by days, a fixed term by validity; daily and regular never mix', () => {
  const blocks = publishedBlocks(layoutByCoverage(WORLD()), 'DO');
  assert.equal(selectPlan(blocks, { block: 'daily', attrs: { daily_gb: 1 }, days: 3 }).plan.package_id, 'ea-do-day');
  assert.equal(selectPlan(blocks, { block: 'daily', attrs: { daily_gb: 1 }, days: 5 }).plan, null, 'no 5-day rung');
  assert.equal(selectPlan(blocks, { block: 'daily', attrs: { daily_gb: 2, validity_days: 7 } }).plan.package_id, 'mm-do-day7');
  assert.equal(selectPlan(blocks, { block: 'daily', attrs: { daily_gb: 2 }, days: 7 }).plan.package_id, 'mm-do-day7', 'a FIXED_TERM plan sells its own term');
  assert.equal(selectPlan(blocks, { block: 'daily', attrs: { daily_gb: 1, validity_days: 3 } }).plan, null, 'a ladder is not a fixed 3-day plan');
  assert.ok(validateSelector('x', { block: 'local', attrs: { daily_gb: 1 }, days: 3 }).some((m) => /daily_gb — только в блоке daily/.test(m)));
  assert.ok(validateSelector('x', { block: 'daily', attrs: { data_gb: 1 }, days: 3 }).some((m) => /в блоке daily объём — daily_gb/.test(m)));
  assert.equal(matches(WORLD()[0], { block: 'daily', attrs: { daily_gb: 20 }, days: 30 }), false);
  const r = render(swap(WORLD(), 'ea-do-day', { term_prices: [{ days: 3, price: 950 }, { days: 7, price: 1950 }] }));
  assert.equal(r.profile.faq[1].a, `Три дня по 1 ГБ — ${money(950)}.`);
});

test('9b. a selector with no family never takes a multi-country card — even one first in the published order', () => {
  const world = [pk({ package_id: 'mm-latam-day', name: 'LatAm 1GB/Day', plan_type: 'DAILY', daily_gb: 1, daily_term_mode: 'PER_DAY', validity_days: null, price: 900,
    coverage_country_codes: ['DO', 'MX', 'CO'], term_prices: [{ days: 3, price: 2750 }] }), ...WORLD()];
  const blocks = publishedBlocks(layoutByCoverage(world), 'DO');
  assert.equal(blocks.daily[0].package_id, 'mm-latam-day', 'the multi-country card comes first');
  assert.equal(selectPlan(blocks, { block: 'daily', attrs: { daily_gb: 1 }, days: 3 }).plan.package_id, 'ea-do-day');
  assert.equal(selectPlan(blocks, { block: 'daily', attrs: { daily_gb: 1 }, days: 3, family: 'latam' }).plan.package_id, 'mm-latam-day');
  const r = render(world.filter((p) => p.package_id !== 'ea-do-day'));
  assert.ok(r.suppressed.some((x) => x.id === 'day3'), 'with the country\'s own card gone the sentence goes — the LatAm price is never printed for it');
  assert.ok(validateSelector('x', { block: 'regional', attrs: { data_gb: 3, validity_days: 30 } }).some((m) => /в блоке regional нужен family/.test(m)));
});

test('9c. an operator the provider stops listing is the catalogue\'s move: the sentence is left out, the build never stops (UAE Du → Etisalat, #190)', () => {
  const live = loadPublishedCatalogue();
  const raw = readRawProfile('uae');
  const du = (raw.network_claims || []).find((c) => c.operators.includes('Du'));
  assert.ok(du, 'premise: the UAE page has a claim on Du');
  const doc = clone(live);
  for (const p of doc.packages) if (Array.isArray(p.networks)) p.networks = p.networks.map((n) => (n && n.operator === 'Du' ? { ...n, operator: 'Etisalat' } : n));
  const r = renderAuthored('uae', { text: loadProfile('uae').profile, raw, doc });
  assert.deepEqual(r.problems, [], 'no authoring error — the build goes on');
  assert.ok(r.suppressed.some((x) => x.source === 'network_claims' && x.id === du.id), `${du.id} is left out`);
});

test('10. a plan in the catalogue but NOT in this page\'s published layout is never used', () => {
  const doc = layoutByCoverage(WORLD());
  doc.assortment.countries.DO.local = doc.assortment.countries.DO.local.filter((id) => id !== 'ea-do-20'); // the backend hides it here
  assert.ok(doc.packages.some((p) => p.package_id === 'ea-do-20'), 'still in the snapshot (shown elsewhere)');
  const r = renderAuthored('dominican-republic', { text: TEXT, raw: { ...RAW, ...TEXT }, doc });
  assert.ok(r.suppressed.some((x) => x.id === 'g20'));
  assert.doesNotMatch(JSON.stringify(r.profile), /4 900/);
});

test('11. an incomplete catalogue is refused, not read as «every card is gone»', () => {
  const live = loadPublishedCatalogue();
  assert.throws(() => loadPublishedCatalogue(null, { doc: { ...clone(live), assortment: null } }), /нет раскладки assortment\.countries — каталог неполный/);
  const broken = clone(live);
  const iso = Object.keys(broken.assortment.countries)[0];
  broken.assortment.countries[iso].local = [...broken.assortment.countries[iso].local, 'not-in-the-snapshot'];
  assert.throws(() => loadPublishedCatalogue(null, { doc: broken }), /ссылается на тарифы, которых в снимке нет/);
  const shrunk = { ...clone(live), packages: live.packages.slice(0, 10), package_count: 10 };
  assert.throws(() => loadPublishedCatalogue(null, { doc: shrunk }), /каталог/);
  // A layout that is there but empty, collapsed or missing a page's country is just as incomplete.
  const none = clone(live); none.assortment.countries = {};
  assert.throws(() => loadPublishedCatalogue(null, { doc: none }), /без карточек для \d+ стран со страницами/);
  const collapsed = clone(live);
  for (const e of Object.values(collapsed.assortment.countries)) { e.local = []; e.regional = []; e.daily = []; }
  assert.throws(() => loadPublishedCatalogue(null, { doc: collapsed }), /без карточек/);
  const partial = clone(live); delete partial.assortment.countries.IT; delete partial.assortment.countries.TH;
  assert.throws(() => loadPublishedCatalogue(null, { doc: partial }), /без карточек для 2 стран со страницами \(IT, TH\)|без карточек для 2 стран со страницами \(TH, IT\)/);
  assert.ok(loadPublishedCatalogue(), 'the live snapshot is complete');
});

test('12. the same data renders the same result, every time', () => {
  const a = render(WORLD()); const b = render(clone(WORLD()));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const doc = loadPublishedCatalogue();
  for (const slug of ['dominican-republic', 'usa', 'south-africa']) {
    const { profile: text } = loadProfile(slug);
    const x = renderAuthored(slug, { text, raw: readRawProfile(slug), doc });
    const y = renderAuthored(slug, { text: clone(text), raw: readRawProfile(slug), doc: clone(doc) });
    assert.equal(JSON.stringify(x), JSON.stringify(y), slug);
  }
});

// ------------------------------------------------------------------ the parts that are left out

test('a fallback is for a printed amount only — a price claim compares the card its sentence names', () => {
  const claim = { ...RAW.price_claims[0], terms: { local: { ...G20, fallback: { min_of: 'local' } }, car: CAR20 } };
  const r = render(WORLD(), { ...RAW, price_claims: [claim] });
  assert.ok(r.problems.some((m) => /fallback — запасной вариант только у price_refs/.test(m)), r.problems.join('\n'));
});

test('unitOf / withoutUnits: the smallest rendered piece goes whole — a FAQ question with its answer, one paragraph, one card', () => {
  assert.deepEqual(['faq[2].a', 'faq[2].q', 'why[0].h', 'intro[3]', 'lead', 'dual_sim_note.text', 'title'].map(unitOf),
    ['faq[2]', 'faq[2]', 'why[0]', 'intro[3]', 'lead', 'dual_sim_note', 'title']);
  const p = { title: 'T', lead: 'L', intro: ['a', 'b'], faq: [{ q: 'q0', a: 'a0' }, { q: 'q1', a: 'a1' }], why: [{ h: 'h', p: 'p' }] };
  assert.deepEqual(withoutUnits(p, new Set(['title', 'intro[0]', 'faq[1]', 'why[0]'])), { lead: 'L', intro: ['b'], faq: [{ q: 'q0', a: 'a0' }] });
  assert.deepEqual(withoutUnits(p, new Set(['intro[0]', 'faq[0]'])).intro, ['b'], 'the page: removed');
  assert.deepEqual(withoutUnits(p, new Set(['intro[0]', 'faq[0]']), { keepPositions: true }).intro, [null, 'b'], 'the prose gates: «intro[1]» still names «b»');
});

test('familyOf: the family a multi-country name stands for, across providers\' spellings', () => {
  assert.equal(familyOf('Africa 3GB 30Days'), 'africa');
  assert.equal(familyOf('Africa 3 GB'), 'africa');
  assert.equal(familyOf('Caribbean 20 GB'), 'caribbean');
  assert.equal(familyOf('Europe (40+ areas) & Morocco 5GB 30Days'), 'europe.*&.*morocco');
  assert.equal(familyOf('APAC 17 GB Yearly'), 'apac');
  assert.ok(new RegExp(familyOf('North America 5GB/Day'), 'i').test('North America 5GB/Day'));
});

// ------------------------------------------------------------------ the corpus

const PROFILES = readdirSync(join(ROOT, 'seo', 'content-profiles')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));

test('no authored reference names a provider row: no package / packages key, no package id anywhere a claim reads', () => {
  const ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const bad = [];
  for (const slug of PROFILES) {
    const p = readRawProfile(slug);
    const refs = JSON.stringify({ r: p.price_refs, pc: p.price_claims, cc: p.coverage_claims, nc: p.network_claims });
    if (/"packages?"\s*:/.test(refs)) bad.push(`${slug}: package(s) key`);
    if (ID.test(refs)) bad.push(`${slug}: ${refs.match(ID)[0]}`);
  }
  assert.deepEqual(bad, []);
});

test('seo/suppressed-claims.json is exactly what the generator leaves out on assets/catalog.json, and none of it is on a page', () => {
  const doc = loadPublishedCatalogue();
  const want = [];
  for (const slug of PROFILES) {
    const { profile: text } = loadProfile(slug);
    if (!text) continue;
    const r = renderAuthored(slug, { text, raw: readRawProfile(slug), doc });
    assert.deepEqual(r.problems, [], slug);
    want.push(...r.suppressed);
  }
  const file = JSON.parse(readFileSync(join(ROOT, 'seo', 'suppressed-claims.json'), 'utf8'));
  const key = (x) => `${x.slug}|${x.unit}|${x.source}|${x.id}`;
  assert.deepEqual(file.entries.map(key).sort(), want.map(key).sort(), 'rebuild: node seo/build-all.mjs');
  for (const x of file.entries) {
    const raw = readRawProfile(x.slug);
    const m = /^(intro|why|faq)\[(\d+)\]$/.exec(x.unit);
    const piece = m ? raw[m[1]][Number(m[2])] : raw[x.unit];
    const text = typeof piece === 'string' ? piece : piece && (piece.a || piece.p || piece.text);
    const probe = String(text).replace(/\{\{price:[a-z0-9_]+\}\}/g, '\u0000').split('\u0000').map((s) => s.trim()).sort((a, b) => b.length - a.length)[0].slice(0, 60);
    const html = readFileSync(join(ROOT, 'esim', x.slug, 'index.html'), 'utf8');
    assert.ok(probe.length >= 20, `${x.slug} ${x.unit}: probe too short`);
    assert.ok(!html.includes(probe.replaceAll('&', '&amp;').replaceAll('"', '&quot;')) && !html.includes(probe), `${x.slug} ${x.unit} is still on the page: «${probe}»`);
  }
});

test('a left-out headline falls back to the template\'s own factual text, never to nothing', () => {
  const doc = loadPublishedCatalogue();
  for (const x of JSON.parse(readFileSync(join(ROOT, 'seo', 'suppressed-claims.json'), 'utf8')).entries) {
    if (!['title', 'description', 'h1', 'lead'].includes(x.unit)) continue;
    const html = readFileSync(join(ROOT, 'esim', x.slug, 'index.html'), 'utf8');
    if (x.unit === 'description') assert.match(html, /<meta name="description" content="[^"]{40,}"/, x.slug);
    if (x.unit === 'title') assert.match(html, /<title>[^<]{10,}<\/title>/, x.slug);
    if (x.unit === 'h1') assert.match(html, /<h2 id="aboutTitle">[^<]+— eSIM для поездки<\/h2>/, x.slug);
    if (x.unit === 'lead') assert.match(html, /<p class="lead">[^<]+Мобильный интернет в поездке/, x.slug);
  }
  assert.ok(doc);
});

test('the test-only layout helper is never imported by a generator or a check', () => {
  for (const f of readdirSync(join(ROOT, 'seo')).filter((x) => x.endsWith('.mjs') && !x.startsWith('test-') && !/^refresh-scenario/.test(x))) {
    assert.doesNotMatch(readFileSync(join(ROOT, 'seo', f), 'utf8'), /fixture-layout/, `${f} imports the test-only layout`);
  }
  for (const f of readdirSync(join(ROOT, 'scripts')).filter((x) => x.endsWith('.mjs'))) {
    assert.doesNotMatch(readFileSync(join(ROOT, 'scripts', f), 'utf8'), /fixture-layout/, `scripts/${f}`);
  }
  assert.ok(existsSync(join(ROOT, 'seo', 'fixture-layout.mjs')));
});

test('the SEO refresh PR body lists what is left out, near the top — the person who merges sees every sentence to rewrite', () => {
  const s = classify({ cacheBefore: { countries: [] }, cacheAfter: { countries: [] }, sheetsBefore: { sheets: {} }, sheetsAfter: { sheets: {} },
    catalogueBefore: [], catalogueAfter: [], urlsBefore: [], urlsAfter: [], lastmodBefore: null, lastmodAfter: null });
  const md = renderMarkdown(s, { suppressed: [{ slug: 'morocco', unit: 'faq[1]', source: 'price_refs', id: 'africa_3gb' }, { slug: 'nepal', unit: 'faq[3]', source: 'coverage_claims', id: 'x' }] });
  assert.match(md, /Не опубликовано авторских фрагментов: 2\*\* на 2 страницах/);
  assert.match(md, /`\/esim\/morocco\/` faq\[1\] · price_refs\/africa_3gb/);
  assert.ok(md.indexOf('Не опубликовано') < md.indexOf('### Страны'));
  assert.doesNotMatch(renderMarkdown(s, {}), /Не опубликовано/);
  assert.match(readFileSync(join(ROOT, 'scripts', 'seo-refresh-summary.mjs'), 'utf8'), /suppressed: \(\(\) => \{ try \{ return readJson\(join\(ROOT, 'seo\/suppressed-claims\.json'\)\)\?\.entries/);
});
