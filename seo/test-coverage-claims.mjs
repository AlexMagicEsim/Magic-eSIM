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

test('mutation: New Zealand removed from ONE daily card the FAQ names (500 MB/day) is caught — the text names a product, the claim pins it', () => {
  const c = clone(LIVE.packages);
  const [d] = byName(c, /^Australia & New Zealand 500MB\/Day$/);
  d.coverage_country_codes = ['AU']; d.region = 'AU';
  assert.ok(liveRun('australia', c).some((p) => p.message.includes(d.package_id)));
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
const green = (slug, c, why) => assert.deepEqual(liveRun(slug, c).map(formatProblem), [], `${slug} must stay green: ${why}`);

test('review B1–B16: a NEW product that falsifies «все/ни один» is caught', () => {
  const cases = [
    ['south-africa', 'Africa 3 GB', { coverage_country_codes: ['ZA', 'ZW', 'SZ', 'BW'] }, 'Zimbabwe in a regional pack'],
    ['south-africa', 'Africa 3 GB', { coverage_country_codes: ['ZA', 'MZ', 'SZ', 'BW'] }, 'Mozambique in an Africa pack'],
    ['south-africa', 'Africa 3 GB', { coverage_country_codes: ['ZA', 'KE'] }, 'an Africa pack without Eswatini/Botswana'],
    ['kenya', 'Africa 3 GB', { coverage_country_codes: ['KE', 'UG'] }, 'an Africa pack without Tanzania'],
    ['mauritius', 'Africa 3 GB', { coverage_country_codes: ['MU', 'SC'] }, 'an Africa pack without Réunion'],
    ['seychelles', 'Africa 3 GB', { coverage_country_codes: ['SC', 'UG'] }, 'an Africa pack without Kenya/Tanzania'],
    ['argentina', 'LATAM 10 GB', { name: 'LATAM 15 GB', data_gb: 15, coverage_country_codes: ['AR', 'BR', 'CL', 'PY', 'UY', 'BO'] }, 'Bolivia in a volume regional'],
    ['argentina', 'LATAM 10 GB', { name: 'LATAM 15 GB', data_gb: 15, coverage_country_codes: ['AR', 'BR', 'CL', 'PY'] }, 'a 3–20 GB LATAM without Uruguay'],
    ['mongolia', 'Mongolia 3 GB', { name: 'Central Asia 3 GB', coverage_country_codes: ['MN', 'KZ'] }, 'a regional block appears'],
    ['brunei', 'Brunei Darussalam 3GB 15Days', { name: 'Asia 3 GB', coverage_country_codes: ['BN', 'SG'] }, 'a regional block appears'],
    ['dominican-republic', 'Caribbean 5 GB', { coverage_country_codes: ['DO', 'AW'], topup_available: true }, 'Aruba in a top-up pack'],
    ['laos', 'Asia (20 areas) 1GB/Day', { coverage_country_codes: ['LA', 'VN', 'TH', 'KH'] }, 'an Asia daily covering Cambodia'],
    ['australia', 'APAC 7 GB', { name: 'APAC 9 GB', data_gb: 9, coverage_country_codes: ['AU', 'SG'] }, 'an APAC pack without New Zealand'],
    ['usa', 'USA & Canada 1GB/Day', { coverage_country_codes: ['US'] }, 'a «США и Канада» card without Canada'],
  ];
  for (const [slug, tpl, over, why] of cases) { const c = clone(LIVE.packages); newPkg(c, tpl, over); red(slug, c, why); }
});

test('review B9/B11/B12: same-id changes that falsify the sentence are caught', () => {
  let c = clone(LIVE.packages);
  for (const p of byName(c, /^South America \(6 areas\)/)) { p.coverage_country_codes.push('PY', 'BO'); p.region += ', PY, BO'; }
  red('argentina', c, '«одни не включают Парагвай и Боливию» — all South America cards now include both');
  c = clone(LIVE.packages); const [it] = byName(c, /^Italy 25 GB$/); it.coverage_country_codes = ['IT']; it.region = 'IT';
  red('egypt', c, 'Italy 25 GB is no longer multi-country');
  c = clone(LIVE.packages); byName(c, /^Africa 5GB 30Days$/)[0].topup_available = false;
  red('kenya', c, '«5 ГБ на 30 дней с пополнением» lost its top-up');
});

test('control review N1–N16: the second round of stale-but-green cases is caught', () => {
  const cases = [
    ['argentina', 'LATAM 10 GB', { name: 'LatAm 15 GB', data_gb: 15, coverage_country_codes: ['AR', 'BR', 'CL', 'UY'] }, 'N1: case-insensitive family, no Paraguay'],
    ['argentina', 'LATAM 10 GB', { name: 'South America 10 GB', coverage_country_codes: ['AR', 'BR', 'CL', 'UY'] }, 'N2: «все региональные на 3–20 ГБ» without Paraguay'],
    ['laos', 'Asia (20 areas) 1GB/Day', { name: 'Asia (21 areas) 3GB/Day', coverage_country_codes: ['LA', 'VN', 'TH', 'KH'] }, 'N3: an Asian daily covering Cambodia'],
    ['albania', 'Balkans (5+ areas) 1GB/Day', { name: 'Balkans (6+ areas) 1GB/Day', coverage_country_codes: ['AL', 'ME', 'XK', 'RS', 'MK', 'GR', 'BG', 'HR'] }, 'N4: a Balkans card with Kosovo'],
    ['montenegro', 'Balkans (5+ areas) 1GB/Day', { name: 'Balkans 3GB/Day', coverage_country_codes: ['AL', 'ME', 'RS', 'MK', 'BG', 'HR'] }, 'N5: a Balkans card without Greece'],
    ['kenya', 'Africa 3 GB', { name: 'East Africa 3 GB', coverage_country_codes: ['KE', 'UG'] }, 'N8: a regional pack without Tanzania'],
    ['seychelles', 'Africa 3 GB', { name: 'Indian Ocean 3 GB', validity_days: 30, coverage_country_codes: ['SC', 'MU'] }, 'N9: a 30-day pack covering Mauritius'],
    ['australia', 'Australia & New Zealand 10GB/Day', { name: 'Australia & New Zealand 20GB/Day', daily_gb: 20 }, 'N12: «до 10 ГБ в день»'],
    ['bahrain', 'GCC 2GB/Day FUP1Mbps', { name: 'GCC 3GB/Day', coverage_country_codes: ['AE', 'BH', 'KW', 'OM', 'QA', 'SA', 'IQ'] }, 'N13: a seven-country Gulf card'],
    ['dominican-republic', 'Caribbean 5 GB', { name: 'Antilles 5 GB', coverage_country_codes: ['DO', 'AW'], topup_available: true }, 'N16: Aruba in a top-up pack of another name'],
  ];
  for (const [slug, tpl, over, why] of cases) { const c = clone(LIVE.packages); newPkg(c, tpl, over); red(slug, c, why); }
  const c = clone(LIVE.packages); byName(c, /^Africa 10 GB$/).forEach((p) => { p.topup_available = false; });
  red('south-africa', c, 'N6: «у всех отмечено пополнение»');
});

test('control review over-strict: withdrawing one family member freezes nothing', () => {
  for (const [name, slugs] of [
    ['Balkans (5+ areas) 2GB/Day', ['albania', 'montenegro', 'serbia', 'bosnia-and-herzegovina']],
    ['Australia and NZ 5 GB', ['australia']],
    ['Central Asia (4 areas) 5GB/Day', ['kazakhstan', 'tajikistan']],
  ]) {
    const c = clone(LIVE.packages).filter((p) => p.name !== name);
    for (const slug of slugs) green(slug, c, `${name} withdrawn`);
  }
});

test('review M3: a prose edit that inverts a sentence orphans its claim', () => {
  const p = clone(PROFILES.laos);
  const claim = p.coverage_claims.find((c) => c.none_in_scope && c.none_in_scope.includes('KH'));
  const a = claim.anchors[0];
  const field = a.field.match(/^([a-z_]+)(?:\[(\d+)\])?(?:\.([a-z]+))?$/);
  const flip = (t) => t.replace('не покрывает', 'тоже покрывает').replace('Камбоджу он не покрывает', 'Камбоджу он покрывает');
  if (field[2] !== undefined && field[3]) p[field[1]][Number(field[2])][field[3]] = flip(p[field[1]][Number(field[2])][field[3]]);
  else if (field[2] !== undefined) p[field[1]][Number(field[2])] = flip(p[field[1]][Number(field[2])]);
  else p[field[1]] = flip(p[field[1]]);
  assert.ok(evaluateProfile(p, 'laos', LIVE.packages).length > 0);
});

test('review over-strict: harmless catalogue moves keep the corpus green', () => {
  let c = clone(LIVE.packages).filter((p) => p.name !== 'Gulf Region 5GB/Day');
  green('bahrain', c, 'one Gulf daily card withdrawn — every sentence still holds');
  c = clone(LIVE.packages); newPkg(c, 'Africa 3 GB', { coverage_country_codes: ['MA', 'ZA', 'SZ', 'BW', 'TZ', 'KE', 'RE', 'SC'] });
  green('morocco', c, 'a new Africa pack under «Региональные тарифы» is still African');
  c = clone(LIVE.packages); newPkg(c, 'Africa 5GB 30Days', { coverage_country_codes: ['ZA', 'ZM', 'SZ', 'BW'] });
  green('south-africa', c, 'a second 5 GB pack with Zambia — «только пакет на 5 ГБ» still true');
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
  const fns = ['packageCoverageCodes', 'isRussiaPackage', 'isRestrictedPackage', 'isPublicGlobalPackage', 'isMultiCountryPackage']
    .map((n) => extractFunction(src, n)).join('\n');
  const B = vm.runInNewContext(`${restricted}\n${fns}\n({packageCoverageCodes,isRussiaPackage,isRestrictedPackage,isPublicGlobalPackage,isMultiCountryPackage})`);
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
    if (B.isRussiaPackage(p) !== isRussia(p)) off.push(`russia ${p.package_id}`);
    if (B.isRestrictedPackage(p) !== isRestricted(p)) off.push(`restricted ${p.package_id}`);
    if (B.isPublicGlobalPackage(p) !== isGlobal(p)) off.push(`global ${p.package_id}`);
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
