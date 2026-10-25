// Coverage claims: the machine-checkable dependencies of authored prose.
//
// WHY THIS FILE EXISTS
//
//   Authored /esim/<country>/ pages say things like «Замбию покрывает только
//   пакет на 5 ГБ», «пакет на Австралию и Новую Зеландию», «Кубу не покрывает
//   ни один тариф». Prices were already gated against the catalogue; coverage
//   was not. If a provider changes the countries of a product, the sentence goes
//   stale on the live site with every gate green. Each profile now carries
//   `coverage_claims` — explicit assertions over package ids and page blocks —
//   and this file checks them against assets/catalog.json, the snapshot every
//   other SEO gate reads. No network, no provider code, no prices.
//
//   Layout: (1) the RULES, on a synthetic catalogue — no live data, so a price
//   or coverage move can never make a rule test red; (2) MUTATIONS of the live
//   catalogue on the claims real pages make; (3) the CORPUS — every authored
//   page against the current snapshot; (4) PARITY of the Node visibility rules
//   with the browser code they port; (5) the refresh wiring.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import {
  evaluateProfile, checkCorpus, pageBlocks, printedCount, validateClaimShape,
  loadCatalogDoc, formatProblem, unanchoredCoverageSentences, fieldText, isWholeSentence,
} from './coverage-claims.mjs';
import { coverageCodes, isRussia, isRestricted, isGlobal, isMultiCountry, isDaily } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LIVE = JSON.parse(readFileSync(join(ROOT, 'assets', 'catalog.json'), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- fixtures

let seq = 0;
const pkg = (o) => ({
  package_id: o.id || `id-${++seq}`, name: o.name || 'Pkg', country_code: o.cc || (o.cov || ['XX'])[0],
  region: (o.cov || []).join(', '), coverage_country_codes: o.cov || ['XX'],
  data_gb: o.daily ? null : (o.gb ?? 3), validity_days: o.days ?? 30, price: o.price ?? 1000,
  plan_type: o.daily ? 'DAILY' : 'FIXED_VOLUME', daily_gb: o.daily ? 1 : null,
  daily_term_mode: o.daily ? 'PER_DAY' : null, topup_available: o.topup ?? true,
});
// A tiny world: page ZA, a 5 GB Africa pack with Zambia, a 3 GB one without,
// local ZA, a hidden Global covering everything, a Zambia local.
const FIX = () => ({
  packages: [
    pkg({ id: 'af5', name: 'Africa 5GB 30Days', cov: ['ZA', 'ZM', 'BW'], gb: 5 }),
    pkg({ id: 'af3', name: 'Africa 3 GB', cov: ['ZA', 'BW', 'SZ'], gb: 3, topup: false, days: 15 }),
    pkg({ id: 'za3', name: 'South Africa 3GB', cov: ['ZA'] }),
    pkg({ id: 'gl', name: 'Global (120+ areas) 3 GB', cc: 'GL-120', cov: ['ZA', 'ZM', 'CU', 'LS'] }),
    pkg({ id: 'zm1', name: 'Zambia 1GB', cov: ['ZM'] }),
    pkg({ id: 'zad', name: 'South Africa 1GB/Day', cov: ['ZA'], daily: true }),
  ],
});
const profile = (claims, prose = {}) => ({
  status: 'published',
  lead: prose.lead ?? 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ. Кубу не покрывает ни один тариф.',
  faq: prose.faq ?? [{ q: 'Вопрос?', a: 'Лесото не покрывает ни один тариф каталога.' }],
  coverage_claims: claims,
});
const run = (claims, catalogue = FIX(), prose) =>
  evaluateProfile(profile(claims, prose), 'south-africa', catalogue.packages);

const zambiaOnly = {
  id: 'zambia-only', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }],
  scope: 'regional', packages: ['af5'], must_cover: ['ZM'], only: true,
};

// ---------------------------------------------------------------- 1. RULES

test('a true claim passes, and the rule is not vacuous: the same claim on a broken catalogue fails', () => {
  assert.deepEqual(run([zambiaOnly]), []);
  const broken = FIX(); broken.packages[0].coverage_country_codes = ['ZA', 'BW']; broken.packages[0].region = 'ZA, BW';
  assert.equal(run([zambiaOnly], broken).length, 1);
});

test('must_cover: a country the text claims disappears from the product', () => {
  const c = FIX(); c.packages[0].coverage_country_codes = ['ZA', 'BW']; c.packages[0].region = 'ZA, BW';
  const [p] = run([zambiaOnly], c);
  assert.match(p.message, /ZM/); assert.match(p.message, /af5/); assert.equal(p.slug, 'south-africa');
});

test('must_not_cover / none_in_scope: a country the text says is absent appears', () => {
  const claim = { id: 'no-cuba', anchors: [{ field: 'lead', text: 'Кубу не покрывает ни один тариф.' }], scope: 'catalog', none_in_scope: ['CU'] };
  assert.deepEqual(run([claim]), [], 'the hidden Global covering CU must not count — the storefront never shows it');
  const c = FIX(); c.packages[2].coverage_country_codes = ['ZA', 'CU']; c.packages[2].region = 'ZA, CU';
  const [p] = run([claim], c);
  assert.match(p.message, /CU/); assert.match(p.message, /za3/);
});

test('the basis product disappears from the snapshot', () => {
  const c = FIX(); c.packages = c.packages.filter((p) => p.package_id !== 'af5');
  const [p] = run([zambiaOnly], c);
  assert.match(p.message, /исчез|нет в каталоге/);
});

test('the basis product stops being visible: zero price, a Russia region, restricted country code', () => {
  for (const mutate of [
    (p) => { p.price = 0; },
    (p) => { p.region += ', RU'; p.coverage_country_codes.push('RU'); },
    (p) => { p.country_code = 'UA'; },
  ]) {
    const c = FIX(); mutate(c.packages[0]);
    const problems = run([zambiaOnly], c);
    assert.ok(problems.some((x) => /не показывается|не виден/.test(x.message)), JSON.stringify(problems));
  }
});

test('the basis product moves to another block (volume → daily)', () => {
  const c = FIX(); Object.assign(c.packages[0], { plan_type: 'DAILY', daily_gb: 1, daily_term_mode: 'PER_DAY', data_gb: null });
  const [p] = run([zambiaOnly], c);
  assert.match(p.message, /блок/);
});

test('re-issued under a new id with identical coverage: still red, with the successor named', () => {
  const c = FIX(); c.packages[0].package_id = 'af5-new';
  const [p] = run([zambiaOnly], c);
  assert.match(p.message, /af5-new/, 'the diagnostic must name the likely successor');
});

test('only: a NEW product covering the country breaks «только» — the claim cannot pass on a look-alike', () => {
  const c = FIX(); c.packages.push(pkg({ id: 'af10', name: 'Africa 5GB 30Days', cov: ['ZA', 'ZM'] }));
  const [p] = run([zambiaOnly], c);
  assert.match(p.message, /af10/);
});

test('a claim cannot silently pass on another product: two identical products, one disappears', () => {
  const two = FIX(); two.packages.push(pkg({ id: 'af5b', name: 'Africa 5GB 30Days', cov: ['ZA', 'ZM', 'BW'], gb: 5 }));
  const claim = { ...zambiaOnly, packages: ['af5', 'af5b'] };
  assert.deepEqual(run([claim], two), []);
  two.packages = two.packages.filter((p) => p.package_id !== 'af5b');
  assert.equal(run([claim], two).length, 1);
});

test('covers_exactly and coverage_count catch a product that GAINS a country', () => {
  const claim = { id: 'exact', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', packages: ['af5'], covers_exactly: ['ZA', 'ZM', 'BW'], coverage_count: 3 };
  assert.deepEqual(run([claim]), []);
  const c = FIX(); c.packages[0].coverage_country_codes.push('NA'); c.packages[0].region += ', NA';
  assert.equal(run([claim], c).length, 2);
});

test('basis_attrs: the attribute the sentence names (5 ГБ, 15 дней, без пополнения) changes on the same id', () => {
  const claim = { ...zambiaOnly, basis_attrs: { data_gb: 5, topup_available: true } };
  assert.deepEqual(run([claim]), []);
  const c = FIX(); c.packages[0].topup_available = false;
  assert.match(run([claim], c)[0].message, /topup_available/);
});

test('all_in_scope / some_in_scope / not_all_in_scope / none_together / min/max countries', () => {
  const ok = [
    { id: 'a', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', all_in_scope: ['BW'] },
    { id: 'b', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', some_in_scope: ['ZM'], not_all_in_scope: ['ZM'] },
    { id: 'c', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', none_together: ['ZM', 'SZ'] },
    { id: 'd', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'local', max_countries: 1 },
    { id: 'e', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', min_countries: 2 },
  ];
  assert.deepEqual(run(ok), []);
  const c = FIX(); c.packages[1].coverage_country_codes = ['ZA', 'ZM', 'SZ']; c.packages[1].region = 'ZA, ZM, SZ';
  const msgs = run(ok, c).map((x) => x.claim);
  assert.deepEqual(msgs.sort(), ['a', 'b', 'c']);
});

test('expect_empty, and an empty scope never satisfies all/none vacuously', () => {
  assert.deepEqual(run([{ id: 'e', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'daily', page: 'zambia', expect_empty: true }]), []);
  const vacuous = run([{ id: 'v', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'daily', page: 'zambia', none_in_scope: ['CU'] }]);
  assert.match(vacuous[0].message, /пуст/);
});

test('scope_is: the block consists of exactly these products', () => {
  const claim = { id: 's', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', packages: ['af5', 'af3'], scope_is: true };
  assert.deepEqual(run([claim]), []);
  const c = FIX(); c.packages.push(pkg({ id: 'eu', name: 'Europe 3 GB', cov: ['ZA', 'FR'] }));
  assert.match(run([claim], c)[0].message, /eu/);
});

test('distinct_coverage: look-alike cards must keep different country sets', () => {
  const claim = { id: 'd', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', packages: ['af5', 'af3'], distinct_coverage: true };
  assert.deepEqual(run([claim]), []);
  const c = FIX(); c.packages[1].coverage_country_codes = ['ZA', 'ZM', 'BW']; c.packages[1].region = 'ZA, ZM, BW';
  assert.equal(run([claim], c).length, 1);
});

test('family: a NEW member of the family is checked, a withdrawn one is not a false alarm', () => {
  const claim = { id: 'f', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', family: '^Africa', all_in_scope: ['BW'] };
  assert.deepEqual(run([claim]), []);
  const added = FIX(); added.packages.push(pkg({ id: 'af7', name: 'Africa 7 GB', cov: ['ZA', 'KE'] }));
  assert.match(run([claim], added)[0].message, /af7/);
  const gone = FIX(); gone.packages = gone.packages.filter((p) => p.package_id !== 'af3');
  assert.deepEqual(run([claim], gone), []);
  const empty = FIX(); empty.packages = empty.packages.filter((p) => !/^Africa/.test(p.name));
  assert.match(run([claim], empty)[0].message, /пуст/, 'an empty family must not vouch for «все»');
});

test('family_is_scope and family-only: «под заголовком только X», «только карточки X покрывают Y»', () => {
  const fis = { id: 'fis', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', family: '^Africa', family_is_scope: true };
  const only = { id: 'fo', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'page', family: '^Africa', must_cover: ['BW'], only: true };
  assert.deepEqual(run([fis, only]), []);
  const c = FIX(); c.packages.push(pkg({ id: 'eu', name: 'Europe 3 GB', cov: ['ZA', 'BW'] }));
  assert.deepEqual(run([fis, only], c).map((x) => x.claim).sort(), ['fis', 'fo']);
});

test('only_attrs: «только пакет на 5 ГБ» — attribute, not identity', () => {
  const claim = { id: 'oa', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', family: '^Africa', some_in_scope: ['ZM'], only_attrs: { data_gb: 5 } };
  assert.deepEqual(run([claim]), []);
  const second5 = FIX(); second5.packages.push(pkg({ id: 'af5b', name: 'Africa 5 GB', cov: ['ZA', 'ZM'], gb: 5 }));
  assert.deepEqual(run([claim], second5), [], 'a second 5 GB pack keeps the sentence true');
  const ten = FIX(); ten.packages.push(pkg({ id: 'af10', name: 'Africa 10 GB', cov: ['ZA', 'ZM'], gb: 10 }));
  assert.match(run([claim], ten)[0].message, /af10/);
});

test('where and attr_bounds: «пакеты на 3–20 ГБ», «от 500 МБ до 10 ГБ в день»; family is case-insensitive', () => {
  const w = { id: 'w', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', family: '^AFRICA', where: { data_gb_max: 4 }, all_in_scope: ['SZ'] };
  const b = { id: 'b', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', family: '^africa', attr_bounds: { data_gb: [3, 5] } };
  assert.deepEqual(run([w, b]), []);
  const c = FIX(); c.packages.push(pkg({ id: 'afbig', name: 'Africa 20 GB', cov: ['ZA', 'BW'], gb: 20 }));
  assert.deepEqual(run([w, b], c).map((x) => x.claim), ['b'], 'a 20 GB pack is outside «3–4 ГБ» but breaks «до 5 ГБ»');
  const d = FIX(); d.packages.push(pkg({ id: 'afs', name: 'AFRICA 3 GB', cov: ['ZA', 'BW'], gb: 3 }));
  assert.deepEqual(run([w], d).map((x) => x.claim), ['w'], 'case must not hide a family member');
});

test('an anchor must be a whole sentence: a fragment would let the rest of the sentence change unseen', () => {
  const frag = { ...zambiaOnly, anchors: [{ field: 'lead', text: 'покрывает только пакет на Африку на 5 ГБ' }] };
  assert.match(run([frag])[0].message, /не целое предложение/);
});

test('the anchor: a claim whose sentence left the page is orphaned, not silently kept', () => {
  const problems = run([zambiaOnly], FIX(), { lead: 'Совсем другой текст.' });
  assert.match(problems[0].message, /текст|осирот/);
});

test('anchors resolve in every prose field, h1 and nested ones included', () => {
  const p = { title: 'Т для X', h1: 'Заголовок про Замбию', lead: 'L', intro: ['I0'], why: [{ h: 'Wh', p: 'Wp' }], faq: [{ q: 'Q', a: 'A про Замбию' }] };
  for (const [field, want] of [['h1', 'Заголовок про Замбию'], ['title', 'Т для X'], ['intro[0]', 'I0'], ['why[0].h', 'Wh'], ['why[0].p', 'Wp'], ['faq[0].q', 'Q'], ['faq[0].a', 'A про Замбию']]) {
    assert.equal(fieldText(p, field), want, field);
  }
  assert.equal(fieldText(p, 'faq[3].a'), undefined);
  assert.equal(fieldText(p, 'sources'), undefined, 'only customer-facing fields can anchor a claim');
});

test('fail closed on malformed claims', () => {
  const bad = [
    { id: 'x', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional' },                         // no check at all
    { id: 'y', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'moon', all_in_scope: ['ZM'] },        // unknown scope
    { id: 'z', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', all_in_scope: ['QQ'] },    // unknown ISO
    { id: 'w', anchors: [], scope: 'regional', all_in_scope: ['ZM'] },                                       // no anchor
    { id: 'v', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', all_in_scope: ['ZM'], mystery: 1 }, // unknown key
    { id: 'u', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', only: true, packages: ['af5'] }, // only without must_cover
    { id: 't', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', packages: ['af5'], basis_attrs: {} }, // empty basis_attrs checks nothing
    { id: 's', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', family: '(', all_in_scope: ['ZM'] }, // family does not compile
    { id: 'r', anchors: [{ field: 'lead', text: 'Замбию на этой странице покрывает только пакет на Африку на 5 ГБ.' }], scope: 'regional', only_attrs: { data_gb: 5 } }, // only_attrs without countries
  ];
  for (const claim of bad) assert.ok(validateClaimShape(claim, 'south-africa').length > 0, `${claim.id} must be rejected`);
  const dup = run([zambiaOnly, zambiaOnly]);
  assert.ok(dup.some((x) => /повтор|дубл/.test(x.message)));
});

test('fail closed on a catalogue that cannot be trusted', () => {
  assert.throws(() => loadCatalogDoc(null, { doc: { schema_version: 99, packages: [] } }), /каталог/);
  assert.throws(() => loadCatalogDoc(null, { doc: { ...clone(LIVE), packages: [] } }), /каталог/);
});

test('printedCount follows the card: daily counts raw codes, volume strips RU/UA/BY', () => {
  assert.equal(printedCount(pkg({ cov: ['ZA', 'UA', 'BW'], daily: true })), 3);
  assert.equal(printedCount(pkg({ cov: ['ZA', 'UA', 'BW'] })), 2);
});

test('the diagnostic names page, claim, quote, expected product and what the catalogue holds now', () => {
  const c = FIX(); c.packages[0].coverage_country_codes = ['ZA', 'BW']; c.packages[0].region = 'ZA, BW';
  const text = formatProblem(run([zambiaOnly], c)[0]);
  for (const part of ['/esim/south-africa/', 'zambia-only', 'покрывает только пакет на Африку на 5 ГБ', 'af5', 'Africa 5GB 30Days', 'must_cover', 'ZA, BW']) {
    assert.ok(text.includes(part), `diagnostic lacks «${part}»:\n${text}`);
  }
});

// ---------------------------------------------------------------- 2. MUTATIONS of the live catalogue

const PROFILES = Object.fromEntries(readdirSync(join(ROOT, 'seo', 'content-profiles'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f.slice(0, -5), JSON.parse(readFileSync(join(ROOT, 'seo', 'content-profiles', f), 'utf8'))]));
const liveRun = (slug, packages) => evaluateProfile(PROFILES[slug], slug, packages);
const byName = (packages, re) => packages.filter((p) => re.test(p.name));

test('mutation: Zambia removed from «Africa 5GB 30Days» turns South Africa red', () => {
  const c = clone(LIVE.packages);
  assert.deepEqual(liveRun('south-africa', c), [], 'baseline must be green');
  const [af5] = byName(c, /^Africa 5GB 30Days$/);
  af5.coverage_country_codes = af5.coverage_country_codes.filter((x) => x !== 'ZM');
  af5.region = af5.coverage_country_codes.join(', ');
  const problems = liveRun('south-africa', c);
  assert.ok(problems.length > 0 && problems.every((p) => p.slug === 'south-africa'));
  assert.ok(problems.some((p) => p.message.includes(af5.package_id)), problems.map(formatProblem).join('\n'));
});

test('mutation: New Zealand removed from «Australia and NZ» turns Australia red', () => {
  const c = clone(LIVE.packages);
  assert.deepEqual(liveRun('australia', c), []);
  for (const p of byName(c, /^Australia (and|&) (NZ|New Zealand)/)) {
    p.coverage_country_codes = p.coverage_country_codes.filter((x) => x !== 'NZ');
    p.region = p.coverage_country_codes.join(', ');
  }
  assert.ok(liveRun('australia', c).some((p) => /NZ/.test(p.message)));
});

// 2026-10-25: this was «Australia & New Zealand 500MB/Day», a daily card the
// Australia FAQ named. The assortment withdrew every AU+NZ daily card and the
// Australia page now says its dailies cover only Australia. Same premise on a
// card that still exists: the USA page names the daily «Северная Америка» на
// 5 ГБ в день (US, CA, MX) and the claim pins its id — Canada removed from it
// must be caught by that id. The Australia sentence that replaced the old one
// («Новую Зеландию посуточные тарифы не покрывают») is proved the other way.
test('mutation: Canada removed from ONE daily card the text names («Северная Америка», 5 GB/day) is caught — the text names a product, the claim pins it', () => {
  const c = clone(LIVE.packages);
  assert.deepEqual(liveRun('usa', c), [], 'baseline must be green');
  const [d] = byName(c, /^North America 5GB\/Day$/);
  d.coverage_country_codes = d.coverage_country_codes.filter((x) => x !== 'CA'); d.region = d.coverage_country_codes.join(', ');
  assert.ok(liveRun('usa', c).some((p) => p.message.includes(d.package_id)));
  const c2 = clone(LIVE.packages);
  const [au] = byName(c2, /^Australia 500MB\/Day$/);
  au.coverage_country_codes = ['AU', 'NZ']; au.region = 'AU, NZ';
  assert.ok(liveRun('australia', c2).some((p) => /NZ/.test(p.message) && p.message.includes(au.package_id)),
    'an Australia daily that gains New Zealand falsifies «Новую Зеландию посуточные тарифы не покрывают»');
});

test('mutation: Cuba added to a visible product turns the Dominican Republic red', () => {
  const c = clone(LIVE.packages);
  assert.deepEqual(liveRun('dominican-republic', c), []);
  const [car] = byName(c, /^Caribbean/);
  car.coverage_country_codes.push('CU'); car.region += ', CU';
  assert.ok(liveRun('dominican-republic', c).some((p) => /CU/.test(p.message)));
});

test('mutation: Lesotho added anywhere visible turns South Africa red (the «no tariff» claim)', () => {
  const c = clone(LIVE.packages);
  const [x] = byName(c, /^Africa 3 GB$/);
  x.coverage_country_codes.push('LS'); x.region += ', LS';
  assert.ok(liveRun('south-africa', c).some((p) => /LS/.test(p.message)));
});

test('mutation: the product a story rests on is deleted, or its price zeroed', () => {
  for (const kill of [(c, id) => c.filter((p) => p.package_id !== id), (c, id) => c.map((p) => (p.package_id === id ? { ...p, price: 0 } : p))]) {
    const c0 = clone(LIVE.packages);
    const [af5] = byName(c0, /^Africa 5GB 30Days$/);
    assert.ok(liveRun('south-africa', kill(c0, af5.package_id)).length > 0);
  }
});

test('mutation: Paraguay added to «LatAm 50 GB» turns Argentina red', () => {
  const c = clone(LIVE.packages);
  assert.deepEqual(liveRun('argentina', c), []);
  const [p50] = byName(c, /^LatAm 50 GB$/);
  p50.coverage_country_codes.push('PY'); p50.region += ', PY';
  assert.ok(liveRun('argentina', c).some((p) => /PY/.test(p.message)));
});

test('mutation: a look-alike re-issue (new id, same name and coverage) is not accepted silently', () => {
  const c = clone(LIVE.packages);
  const [af5] = byName(c, /^Africa 5GB 30Days$/);
  const old = af5.package_id; af5.package_id = '00000000-0000-4000-8000-000000000000';
  const problems = liveRun('south-africa', c);
  assert.ok(problems.some((p) => p.message.includes(old) && p.message.includes(af5.package_id)));
});

// The independent review found these with the first version of the claims: a
// NEW product in a block — the commonest real catalogue event — left stale text
// green, because «все пакеты…» / «ни один…» had been pinned to the ids that
// existed on the day. Each is now a permanent test; together with the
// over-strict cases below they hold the claims to «as strong as the sentence,
// no stronger».
const newPkg = (c, templateName, over) => {
  const t = byName(c, new RegExp(`^${templateName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))[0];
  assert.ok(t, `template ${templateName}`);
  const p = { ...clone(t), package_id: `new-${Math.random().toString(16).slice(2)}`, ...over };
  p.region = p.coverage_country_codes.join(', '); c.push(p); return p;
};
const red = (slug, c, why) => assert.ok(liveRun(slug, c).length > 0, `${slug} must turn red: ${why}`);
// 2026-10-25: the cases rebuilt after the 590-plan activation also name the
// claim that must fire, so a replacement cannot pass on an unrelated claim.
const redBy = (slug, c, claimId, why) => {
  const fired = liveRun(slug, c).map((p) => p.claim);
  assert.ok(fired.includes(claimId), `${slug} must turn red on «${claimId}»: ${why} (fired: ${fired.join(', ') || 'nothing'})`);
};
const green = (slug, c, why) => assert.deepEqual(liveRun(slug, c).map(formatProblem), [], `${slug} must stay green: ${why}`);

test('review B1–B16: a NEW product that falsifies «все/ни один» is caught', () => {
  const cases = [
    ['south-africa', 'Africa 3 GB', { coverage_country_codes: ['ZA', 'ZW', 'SZ', 'BW'] }, 'Zimbabwe in a regional pack'],
    ['south-africa', 'Africa 3 GB', { coverage_country_codes: ['ZA', 'MZ', 'SZ', 'BW'] }, 'Mozambique in an Africa pack'],
    ['south-africa', 'Africa 3 GB', { coverage_country_codes: ['ZA', 'KE'] }, 'an Africa pack without Eswatini/Botswana'],
    ['kenya', 'Africa 3 GB', { coverage_country_codes: ['KE', 'UG'] }, 'an Africa pack without Tanzania'],
    // 2026-10-25: was «an Africa pack without Réunion» — the Mauritius page now
    // says Réunion is in only SOME Africa packs, so a pack without it is true
    // to the page (the inverse, every Africa pack gaining RE, is in B9/B11/B12
    // below). The new-product case is rebuilt on the page's «Самый большой
    // объём — местный»: a 20 GB regional pack with Mauritius falsifies it.
    ['mauritius', 'Africa 5GB 30Days', { name: 'Africa 20 GB', data_gb: 20, coverage_country_codes: ['MU', 'RE', 'SC'] }, 'a 20 GB regional pack — the biggest volume is no longer local', 'biggest-is-local'],
    ['seychelles', 'Africa 3 GB', { coverage_country_codes: ['SC', 'UG'] }, 'an Africa pack without Kenya/Tanzania'],
    // 2026-10-25: 'LATAM 10 GB' left the catalogue; the Argentina cases are
    // re-templated on its successor «Latin America 10 GB». «Bolivia in a volume
    // regional» is dropped: the page now says Bolivia is in SOME «Латинская
    // Америка» plans (the inverse, every one gaining BO, is in B9/B11/B12). Its
    // slot goes to the page's «пополнение отмечено» on every such pack.
    ['argentina', 'Latin America 10 GB', { name: 'Latin America 15 GB', data_gb: 15, topup_available: false }, 'a «Латинская Америка» pack without top-up', 'latam-terms-topup'],
    ['argentina', 'Latin America 10 GB', { name: 'Latin America 15 GB', data_gb: 15, coverage_country_codes: ['AR', 'BR', 'CL', 'PY'] }, 'a «Латинская Америка» pack without Uruguay', 'latam-uy-br-cl'],
    ['mongolia', 'Kazakhstan 3GB 30Days', { name: 'Central Asia 3 GB', coverage_country_codes: ['MN', 'KZ'] }, 'a regional block appears'],
    // 2026-10-25: was «a regional block appears» (an «Asia 3 GB» with BN, SG) —
    // Brunei now HAS a regional block («Brunei Plus»), and its sentence says
    // every «Brunei Plus» card lists exactly Brunei, Malaysia and Indonesia.
    ['brunei', 'Brunei Plus 3 GB', { name: 'Brunei Plus 2 GB', data_gb: 2, coverage_country_codes: ['BN', 'ID'] }, 'a «Brunei Plus» card without Malaysia', 'brunei-plus-with-malaysia'],
    // 2026-10-25: was «Aruba in a top-up pack» — the page now says Aruba and
    // the Bahamas are in only SOME Caribbean packs (the inverse is in
    // B9/B11/B12). New-product case on the page's local ladder: «5 ГБ и больше
    // — только на 30 дней».
    ['dominican-republic', 'Dominican Republic 5GB 30Days', { name: 'Dominican Republic 5GB 15Days', validity_days: 15 }, 'a 5 GB local plan on 15 days', 'local-5plus-30d'],
    // 2026-10-25: the Asia (20 areas) dailies were withdrawn; the Laos page now
    // says its dailies cover only Laos, so a new daily built on a Laos card that
    // reaches Cambodia falsifies the same «ни один» sentence.
    ['laos', 'Laos 1GB/Day', { name: 'Asia (21 areas) 1GB/Day', coverage_country_codes: ['LA', 'VN', 'TH', 'KH'] }, 'an Asia daily covering Cambodia'],
    ['australia', 'APAC 7 GB', { name: 'APAC 9 GB', data_gb: 9, coverage_country_codes: ['AU', 'SG'] }, 'an APAC pack without New Zealand'],
    // 2026-10-25: the «USA & Canada» dailies were withdrawn with the sentence
    // about them. The USA page's current «ни один» sentence is «Региональные
    // «Европа и США» из сетки этой страницы Канаду не покрывают».
    ['usa', 'Europe and USA 15 GB', { name: 'Europe and USA 25 GB', data_gb: 25, coverage_country_codes: [...LIVE.packages.find((p) => p.name === 'Europe and USA 15 GB').coverage_country_codes, 'CA'] }, 'a «Европа и США» card with Canada'],
    // 2026-10-25: new — the Costa Rica page says every volume «Латинская
    // Америка» covers Costa Rica with Colombia and Peru.
    ['costa-rica', 'Latin America 10 GB', { name: 'Latin America 15 GB', data_gb: 15, coverage_country_codes: ['CR', 'PA', 'NI', 'PE'] }, 'a «Латинская Америка» pack without Colombia', 'latam-pa-ni-some'],
  ];
  for (const [slug, tpl, over, why, claimId] of cases) {
    const c = clone(LIVE.packages); newPkg(c, tpl, over);
    if (claimId) redBy(slug, c, claimId, why); else red(slug, c, why);
  }
});

const addCodes = (packages, re, codes) => {
  const hit = byName(packages, re);
  assert.ok(hit.length > 0, `no package matches ${re}`);
  for (const p of hit) for (const x of codes) if (!p.coverage_country_codes.includes(x)) { p.coverage_country_codes.push(x); p.region += `, ${x}`; }
  return hit;
};

test('review B9/B11/B12: same-id changes that falsify the sentence are caught', () => {
  // 2026-10-25: B9 was «South America (6 areas)» gaining PY and BO against
  // «одни не включают Парагвай и Боливию» — that sentence was removed. The
  // Argentina page now says Bolivia is in only SOME «Латинская Америка» plans:
  // every one of them gaining BO falsifies it.
  let c = clone(LIVE.packages);
  addCodes(c, /^lat(am|in america)/i, ['BO']);
  redBy('argentina', c, 'latam-not-all-bo', '«Боливию покрывают не все» — every «Латинская Америка» pack now has BO');
  // 2026-10-25: the inverses of the «only some» sentences that replaced
  // «all/none» sentences on Mauritius, the Dominican Republic and Costa Rica.
  c = clone(LIVE.packages); addCodes(c, /^Africa/i, ['RE']);
  redBy('mauritius', c, 'all', '«Реюньон есть только в части пакетов на Африку» — every Africa pack now has RE');
  c = clone(LIVE.packages); addCodes(c, /^caribbean/i, ['AW', 'BS']);
  redBy('dominican-republic', c, 'caribbean-mixed-aw', '«Аруба и Багамы есть не во всех» — every Caribbean pack now has both');
  c = clone(LIVE.packages); addCodes(c, /^(latam|latin america)\b/i, ['PA', 'NI']);
  redBy('costa-rica', c, 'latam-pa-ni-some', '«Панаму и Никарагуа — только часть из них» — every «Латинская Америка» pack now has both');
  // 2026-10-25: new — the France page rests on «самые широкие региональные
  // тарифы … несколько десятков стран» (the «Europe and USA» family); its
  // withdrawal must not leave the sentence green.
  c = clone(LIVE.packages).filter((p) => !/^europe and usa\b/i.test(p.name));
  redBy('france', c, 'widest-regional-dozens', '«Europe and USA» withdrawn — nothing covers several dozen countries');
  // «Italy 25 GB» (IT/SM/VA) was withdrawn on 2026-10-16 and the Egypt sentence
  // re-pinned to the one multi-country 25 GB pack left: the same kind of change
  // to it must still be caught.
  c = clone(LIVE.packages); const [cjk] = byName(c, /^China Korea Japan 25 GB$/); cjk.coverage_country_codes = ['CN', 'JP', 'KR', 'EG']; cjk.region += ', EG';
  red('egypt', c, 'the China Korea Japan 25 GB pack now covers Egypt');
  c = clone(LIVE.packages); const [cjk2] = byName(c, /^China Korea Japan 25 GB$/); cjk2.coverage_country_codes = ['CN']; cjk2.region = 'CN';
  red('egypt', c, 'the China Korea Japan 25 GB pack is no longer multi-country');
  c = clone(LIVE.packages); byName(c, /^Africa 5GB 30Days$/)[0].topup_available = false;
  red('kenya', c, '«5 ГБ на 30 дней с пополнением» lost its top-up');
});

test('control review N1–N16: the second round of stale-but-green cases is caught', () => {
  const EU_USA_15 = LIVE.packages.find((p) => p.name === 'Europe and USA 15 GB').coverage_country_codes;
  assert.ok(EU_USA_15.includes('GR') && !EU_USA_15.includes('XK'), 'N4/N5 premise: Greece in, Kosovo out');
  const cases = [
    // 2026-10-25: N1 and N2 were «no Paraguay» on 'LATAM 10 GB' (withdrawn);
    // the page now says Paraguay is in only SOME plans, so a pack without it
    // is true. N1 keeps its point — the family is matched case-insensitively —
    // on the claim «Уругвай, Бразилию и Чили покрывают все»; N2 moves to the
    // page's term bound «от 7 до 30 дней».
    ['argentina', 'Latin America 10 GB', { name: 'LATIN AMERICA 15 GB', data_gb: 15, coverage_country_codes: ['AR', 'BR', 'UY'] }, 'N1: case-insensitive family, no Chile', 'latam-uy-br-cl'],
    ['argentina', 'Latin America 10 GB', { name: 'LatAm 15 GB', data_gb: 15, validity_days: 45 }, 'N2: «срок от 7 до 30 дней» — a 45-day pack', 'latam-terms-range'],
    // 2026-10-25: N3/N4/N5/N12/N13 were built on daily families the assortment
    // withdrew (Asia (20 areas), Balkans (5+ areas), Australia & New Zealand,
    // GCC 2GB). Each is rebuilt on the family the page's sentence now rests on.
    ['laos', 'Laos 3GB/Day', { name: 'Asia (21 areas) 3GB/Day', coverage_country_codes: ['LA', 'VN', 'TH', 'KH'] }, 'N3: an Asian daily covering Cambodia'],
    ['albania', 'Europe and USA 15 GB', { name: 'Europe and USA 25 GB', data_gb: 25, coverage_country_codes: [...EU_USA_15, 'XK'] }, 'N4: a «Европа и США» card with Kosovo'],
    ['montenegro', 'Europe and USA 15 GB', { name: 'Europe and USA 25 GB', data_gb: 25, coverage_country_codes: EU_USA_15.filter((x) => x !== 'GR') }, 'N5: a «Европа и США» card without Greece'],
    ['kenya', 'Africa 3 GB', { name: 'East Africa 3 GB', coverage_country_codes: ['KE', 'UG'] }, 'N8: a regional pack without Tanzania'],
    // 2026-10-25: N9 was «a 30-day pack covering Mauritius» under another name
    // — the Seychelles page no longer says Mauritius is 15-day-only, and a
    // non-«Africa» name reaches no claim there. Rebuilt on the page's «Сейшелы
    // и Танзанию покрывают все пакеты на Африку», with an upper-case name so
    // the case-insensitive family is proved on this page too.
    ['seychelles', 'Africa 3 GB', { name: 'AFRICA 7 GB', data_gb: 7, validity_days: 30, coverage_country_codes: ['SC', 'MU', 'KE'] }, 'N9: an Africa pack without Tanzania', 'all-2'],
    // 2026-10-25: N12 was «на 15 и 18 ГБ» (attr_bounds) — the Bosnia sentence
    // no longer names a volume (the family is 1–30 GB now), so a 25 GB card is
    // true to it (pinned green below). The sentence now says «вместе с большей
    // частью Европы и США» (min_countries 30): a card on eight countries breaks it.
    ['bosnia-and-herzegovina', 'Europe and USA 15 GB', { name: 'Europe and USA 25 GB', data_gb: 25, coverage_country_codes: ['HR', 'ME', 'RS', 'US', 'DE', 'FR', 'IT', 'ES'] }, 'N12: «большей частью Европы» — a card on eight countries', 'intro-europe-usa'],
    // N13: daily_gb kept at 5 so only the seventh country (Oman) can turn it red.
    ['bahrain', 'Gulf Region 5GB/Day', { name: 'GCC 5GB/Day', daily_gb: 5, coverage_country_codes: ['AE', 'BH', 'KW', 'OM', 'QA', 'SA', 'IQ'] }, 'N13: a seven-country Gulf card'],
    // 2026-10-25: N16 was «Aruba in a top-up pack of another name» — the page
    // now says Aruba is in only some packs. Kept: a regional pack of ANOTHER
    // name is still caught, now by «Пакеты на Карибы … Кубу не покрывает ни один».
    ['dominican-republic', 'Caribbean 5 GB', { name: 'Antilles 5 GB', coverage_country_codes: ['DO', 'CU'] }, 'N16: Cuba in a regional pack of another name', 'all'],
  ];
  for (const [slug, tpl, over, why, claimId] of cases) {
    const c = clone(LIVE.packages); newPkg(c, tpl, over);
    if (claimId) redBy(slug, c, claimId, why); else red(slug, c, why);
  }
  const c = clone(LIVE.packages); byName(c, /^Africa 10 GB$/).forEach((p) => { p.topup_available = false; });
  red('south-africa', c, 'N6: «у всех отмечено пополнение»');
});

test('control review over-strict: withdrawing one family member freezes nothing', () => {
  for (const [name, slugs] of [
    // 2026-10-25: was 'Balkans (5+ areas) 2GB/Day' — withdrawn by the
    // assortment, which left this case passing on a filter that removed
    // nothing. The pages now rest on «Europe and USA». 2026-10-25:
    // bosnia-and-herzegovina was left out because its sentence named «на 15 и
    // 18 ГБ»; after the activation it names no volume (the family runs 1–30 GB,
    // attr_bounds dropped), so withdrawing one card must keep it green too.
    ['Europe and USA 15 GB', ['albania', 'montenegro', 'serbia', 'bosnia-and-herzegovina']],
    ['Australia and NZ 5 GB', ['australia']],
    ['Central Asia (4 areas) 5GB/Day', ['kazakhstan', 'tajikistan']],
  ]) {
    const c = clone(LIVE.packages).filter((p) => p.name !== name);
    assert.ok(c.length < LIVE.packages.length, `${name} must exist, or withdrawing it proves nothing`);
    for (const slug of slugs) green(slug, c, `${name} withdrawn`);
  }
});

test('review M3: a prose edit that inverts a sentence orphans its claim', () => {
  const p = clone(PROFILES.laos);
  const claim = p.coverage_claims.find((c) => c.none_in_scope && c.none_in_scope.includes('KH'));
  const a = claim.anchors[0];
  const field = a.field.match(/^([a-z_]+)(?:\[(\d+)\])?(?:\.([a-z]+))?$/);
  // 2026-10-25: the Laos claim with KH in none_in_scope is now «Посуточные
  // тарифы … покрывают только Лаос»; the inversion of that sentence is added.
  const flip = (t) => t.replace('не покрывает', 'тоже покрывает').replace('Камбоджу он не покрывает', 'Камбоджу он покрывает')
    .replace('покрывают только Лаос', 'покрывают Лаос и Камбоджу');
  assert.notEqual(flip(a.text), a.text, 'the flip must actually invert the anchored sentence');
  if (field[2] !== undefined && field[3]) p[field[1]][Number(field[2])][field[3]] = flip(p[field[1]][Number(field[2])][field[3]]);
  else if (field[2] !== undefined) p[field[1]][Number(field[2])] = flip(p[field[1]][Number(field[2])]);
  else p[field[1]] = flip(p[field[1]]);
  assert.ok(evaluateProfile(p, 'laos', LIVE.packages).length > 0);
});

test('review over-strict: harmless catalogue moves keep the corpus green', () => {
  // 2026-10-25: was «one Gulf daily card withdrawn» — but the assortment left
  // «Gulf Region 5GB/Day» the ONLY Gulf card, so withdrawing it empties the
  // block every Gulf sentence rests on, and red is the right answer (pinned
  // below). The over-strict case is rebuilt on the harmless move that remains:
  // a second Gulf card with the same six countries and 5 GB a day.
  let c = clone(LIVE.packages);
  newPkg(c, 'Gulf Region 5GB/Day', {});
  green('bahrain', c, 'a second Gulf daily card, same six countries, 5 GB a day — every sentence still holds');
  c = clone(LIVE.packages).filter((p) => p.name !== 'Gulf Region 5GB/Day');
  red('bahrain', c, 'the only Gulf daily card withdrawn — «все они включают Саудовскую Аравию» has nothing to stand on');
  c = clone(LIVE.packages); newPkg(c, 'Africa 3 GB', { coverage_country_codes: ['MA', 'ZA', 'SZ', 'BW', 'TZ', 'KE', 'RE', 'SC'] });
  green('morocco', c, 'a new Africa pack under «Региональные тарифы» is still African');
  // 2026-10-25: was «a second 5 GB pack with Zambia must stay green» — true of
  // the old «только пакет на 5 ГБ», but the page now says «Замбию — только
  // пакеты на 29 стран», so a four-country pack with Zambia falsifies it: red.
  c = clone(LIVE.packages); newPkg(c, 'Africa 5GB 30Days', { coverage_country_codes: ['ZA', 'ZM', 'SZ', 'BW'] });
  redBy('south-africa', c, 'zm-only-29', 'a four-country Africa pack with Zambia — «Замбию — только пакеты на 29 стран» is false');
  // The harmless move for the new sentence: another Africa pack WITHOUT Zambia,
  // on the coverage of the 23-country «Africa 3 GB» (30 days, top-up) — Eswatini
  // and Botswana in, 7 GB within «от 1 до 10 ГБ», top-up marked.
  const af3x30 = LIVE.packages.find((p) => p.name === 'Africa 3 GB' && p.validity_days === 30);
  assert.ok(af3x30 && !af3x30.coverage_country_codes.includes('ZM'), 'premise: the 30-day «Africa 3 GB» has no Zambia');
  c = clone(LIVE.packages);
  newPkg(c, 'Africa 3 GB', { name: 'Africa 7 GB', data_gb: 7, validity_days: 30, topup_available: true, coverage_country_codes: [...af3x30.coverage_country_codes] });
  green('south-africa', c, 'a new Africa pack without Zambia — every sentence still holds');
  // 2026-10-25: the Bosnia sentence names no volume any more; a second card of
  // the same coverage at another size must not turn it red.
  c = clone(LIVE.packages); newPkg(c, 'Europe and USA 15 GB', { name: 'Europe and USA 40 GB', data_gb: 40 });
  green('bosnia-and-herzegovina', c, 'a «Europe and USA» card of the same coverage at another volume');
});

// ---------------------------------------------------------------- 3. CORPUS

test('every authored page agrees with the current catalogue on coverage', () => {
  const { problems, stats } = checkCorpus();
  assert.ok(stats.claims >= 150, `only ${stats.claims} claims — corpus not loaded?`);
  assert.deepEqual(problems.map(formatProblem), []);
});

test('no coverage sentence ships without a claim or an explicit waiver', () => {
  const missing = [];
  for (const [slug, p] of Object.entries(PROFILES)) {
    for (const s of unanchoredCoverageSentences(p)) missing.push(`${slug} ${s.field}: «${s.sentence}»`);
  }
  assert.deepEqual(missing, []);
});

test('every waiver still points at a sentence on its page, and says why', () => {
  const stale = [];
  for (const [slug, p] of Object.entries(PROFILES)) {
    for (const w of p.coverage_claims_waived || []) {
      const t = fieldText(p, w.field);
      if (!t || !isWholeSentence(t, w.text)) stale.push(`${slug} ${w.field}: «${w.text}» — не целое предложение поля или его больше нет`);
      if (!w.reason || String(w.reason).length < 10) stale.push(`${slug} ${w.field}: нет причины`);
    }
  }
  assert.deepEqual(stale, []);
});

// ---------------------------------------------------------------- 4. PARITY with the browser

function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `function ${name} not found`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error(`unbalanced ${name}`);
}

test('the Node visibility and block rules are the browser rules, on every live package', () => {
  const src = readFileSync(join(ROOT, 'assets', 'country-tariffs.js'), 'utf8');
  const restricted = src.match(/const RESTRICTED_COUNTRY_CODES=\[[^\]]*\];/)[0];
  const uncounted = src.match(/var UNCOUNTED_CODES = \[[^\]]*\];/)[0];
  // Which plans a page shows (restricted, worldwide) is the BACKEND's rule since 2026-10-25 — the browser only draws
  // its layout. The browser keeps the coverage reading its cards print; the backend's visibility rule is compared
  // through its fixture port (test/helpers/assortment-layout.cjs).
  const fns = ['packageCoverageCodes', 'countryCountOf', 'isMultiCountryPackage']
    .map((n) => extractFunction(src, n)).join('\n');
  const B = vm.runInNewContext(`${restricted}\n${uncounted}\n${fns}\n({packageCoverageCodes,isMultiCountryPackage})`);
  const BACKEND = createRequire(import.meta.url)(join(ROOT, 'test', 'helpers', 'assortment-layout.cjs'));
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(readFileSync(join(ROOT, 'assets', 'daily-plan-copy.js'), 'utf8'), sandbox);
  const daily = sandbox.module.exports;
  assert.equal(typeof daily.isDaily, 'function', 'daily-plan-copy.js must export isDaily');
  const off = [];
  const edges = [
    pkg({ cov: ['UA'], cc: 'UA', name: 'Ukraine 3 GB' }), pkg({ cov: ['RU', 'KZ'], name: 'Russia & Kazakhstan' }),
    pkg({ cov: ['BY'], cc: 'BY' }), pkg({ cov: ['ZA'], name: 'Global (120+ areas)' }), pkg({ cov: ['ZA'], cc: 'GL-120' }),
    pkg({ cov: ['TH'], name: 'Thailand Unlimited 7 Days' }), pkg({ cov: [], cc: 'DE', name: 'Germany' }),
    { ...pkg({ cov: ['FR'] }), region: 'FR, RU' }, { ...pkg({ cov: ['US'] }), coverage_country_codes: 'US' },
  ];
  assert.ok(edges.some((p) => isRestricted(p)) && edges.some((p) => isRussia(p)) && edges.some((p) => isGlobal(p)), 'edge fixtures must exercise every filter');
  for (const p of [...LIVE.packages, ...edges]) {
    if (JSON.stringify(B.packageCoverageCodes(p)) !== JSON.stringify(coverageCodes(p))) off.push(`coverage ${p.package_id}`);
    // KNOWN DIFFERENCE (2026-10-25, for the SEO follow-up): the Node layer's isRussia also hides a plan whose `region`
    // lists RU («Best World», «Half Global»); the backend — like the English site always did — does not. The pages now
    // show the backend's choice; the generated facts still use the Node rule until the owner decides.
    if (BACKEND.restricted(p) !== isRestricted(p)) off.push(`restricted ${p.package_id}`);
    if (BACKEND.worldwide(p) !== isGlobal(p)) off.push(`global ${p.package_id}`);
    if (B.isMultiCountryPackage(p) !== isMultiCountry(p)) off.push(`multi ${p.package_id}`);
    if (daily.isDaily(p) !== isDaily(p)) off.push(`daily ${p.package_id}`);
  }
  assert.deepEqual(off.slice(0, 10), [], `${off.length} packages disagree`);
});

test('pageBlocks splits a page exactly like the storefront does: every visible package in exactly one block', () => {
  const { daily, regional, local } = pageBlocks(LIVE.packages, 'ZA');
  const ids = [...daily, ...regional, ...local].map((p) => p.package_id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(regional.some((p) => p.name === 'Africa 5GB 30Days'));
  assert.ok(![...daily, ...regional, ...local].some((p) => isGlobal(p) || isRussia(p)));
});

// ---------------------------------------------------------------- 5. WIRING

test('the catalogue refresh runs the guard BEFORE it commits, and says why it stopped', () => {
  const wf = readFileSync(join(ROOT, '.github', 'workflows', 'refresh-catalog-cache.yml'), 'utf8');
  const guard = wf.indexOf('node seo/coverage-claims.mjs --check');
  const commit = wf.indexOf('git commit');
  assert.ok(guard > 0, 'refresh-catalog-cache.yml must run the coverage guard');
  assert.ok(guard < commit, 'the guard must run before the commit, or a stale fact is already published');
  const step = wf.slice(wf.lastIndexOf('- name:', guard), wf.indexOf('- name:', guard));
  assert.doesNotMatch(step, /continue-on-error|\|\|\s*true|^\s*if:/m, 'the guard step must not be bypassable');
  const commitStep = wf.slice(wf.lastIndexOf('- name:', commit), commit);
  assert.doesNotMatch(commitStep, /^\s*if:\s*always\(\)/m, 'the commit step must not run after a failed guard');
});

test('a coverage-only catalogue move still produces a generated-file diff, so the refresh gates run', async () => {
  // seo-refresh-pr.yml runs `npm test` only when a generated file changed. The
  // fact sheet carries the snapshot's generated_at as fetched_at, and the
  // snapshot moves generated_at on every content change — so any coverage move,
  // even one that leaves every count equal, is a diff. Built here from the
  // working-tree catalogue, not read from the committed sheet (main's sheet
  // lags the bot's catalogue until a person merges the refresh PR).
  const { buildFactSheets } = await import('./fact-sheet.mjs');
  const built = await buildFactSheets();
  assert.equal(built.fetched_at, LIVE.generated_at);
});
