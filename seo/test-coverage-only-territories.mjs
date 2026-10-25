// Coverage-only territories (seo/coverage-only-territories.mjs): named in every
// coverage list, never a destination, never one more «страна» in a count — and
// the guard that refuses an UNKNOWN code stays exactly as strict.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { COVERAGE_ONLY, COVERAGE_ONLY_CODES, isCoverageOnly, UNCOUNTED_CODES } from './coverage-only-territories.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { renderCoverageOnlyBlock, COVERAGE_TARGETS, COVERAGE_BLOCK_RE } from './build-country-dictionary.mjs';
import { printedCount } from './coverage-claims.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const CATALOG = JSON.parse(read('assets/catalog.json'));
const only = (p, iso) => Array.isArray(p.coverage_country_codes) && p.coverage_country_codes.length === 1 && p.coverage_country_codes[0] === iso;

test('every entry carries a reason and a decision date, and is a two-letter code', () => {
  assert.ok(Object.keys(COVERAGE_ONLY).length >= 2);
  for (const [code, e] of Object.entries(COVERAGE_ONLY)) {
    assert.match(code, /^[A-Z]{2}$/, code);
    assert.ok(typeof e.reason === 'string' && e.reason.length > 40, `${code}: reason`);
    assert.match(String(e.decided), /\d{4}-\d{2}/, `${code}: decided`);
    assert.equal(typeof e.counts_as_country, 'boolean', `${code}: counts_as_country`);
  }
  assert.ok(isCoverageOnly('kt') && isCoverageOnly(' KT ') && !isCoverageOnly('CY') && !isCoverageOnly(''));
  // KT is not counted (part of the island of Cyprus); AN is (the only code for the islands it covers).
  assert.deepEqual([...UNCOUNTED_CODES], ['KT']);
});

test('KT is Северный Кипр / Northern Cyprus, in the SEO dictionary (the planned-language table is held to the same codes by its own test)', () => {
  assert.equal(COUNTRY_NAMES.KT.ru, 'Северный Кипр');
  assert.equal(COUNTRY_NAMES.KT.en, 'Northern Cyprus');
  assert.equal(COUNTRY_NAMES.KT.gen, 'Северного Кипра');
  for (const code of COVERAGE_ONLY_CODES) {
    assert.ok(COUNTRY_NAMES[code], `${code}: a coverage-only code must still be NAMED (seo/country-names.mjs)`);
  }
});

test('the runtime dictionaries name KT: site (RU, EN) and Mini App (RU, EN)', () => {
  assert.match(read('assets/country-tariffs.js'), /KT:'Северный Кипр'/);
  assert.match(read('assets/country-tariffs.js'), /KT:'Северного Кипра'/);
  assert.match(read('assets/country-names-en.js'), /KT: 'Northern Cyprus'/);
  const core = require('../app/core.js');
  assert.equal(core.countryLabel('KT', 'ru'), 'Северный Кипр');
  assert.equal(core.countryLabel('KT', 'en'), 'Northern Cyprus');
});

test('the generated uncounted list is in every script that counts countries, and current', () => {
  for (const file of COVERAGE_TARGETS) {
    const src = readFileSync(file, 'utf8');
    const m = src.match(new RegExp('^([ \\t]*)' + COVERAGE_BLOCK_RE.source, 'm'));
    assert.ok(m, `${file}: no COVERAGE ONLY block`);
    assert.equal(m[0].slice(m[1].length), renderCoverageOnlyBlock(m[1]), `${file}: stale — run node seo/build-country-dictionary.mjs`);
  }
});

// The KT packages as the provider sends them (2026-10-18): KT appended to the coverage.
const KT_PACKAGES = CATALOG.packages.filter((p) => (p.coverage_country_codes || []).includes('CY') && (p.coverage_country_codes || []).length > 3).slice(0, 3)
  .map((p) => ({ ...p, coverage_country_codes: [...p.coverage_country_codes.filter((c) => c !== 'KT'), 'KT'] }));

function loadSiteScript() {
  // country-tariffs.js is a browser script; its pure helpers are read in a sandbox.
  const ctx = { window: {}, document: { addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } }, console, URLSearchParams, location: { search: '', pathname: '/esim/turkey/' }, navigator: {}, setTimeout, clearTimeout };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('assets/country-tariffs.js') + '\n;globalThis.__t={countryName,coverageCountriesText,compactCoverageLabel,packageCoverageCodes,isMultiCountryPackage,publicPackageName};', ctx);
  return ctx.__t;
}

test('site: a coverage list names KT and never prints the bare code; the count does not add it', () => {
  assert.ok(KT_PACKAGES.length >= 1);
  const t = loadSiteScript();
  assert.equal(t.countryName('KT'), 'Северный Кипр');
  for (const p of KT_PACKAGES) {
    const text = t.coverageCountriesText(p);
    assert.match(text, /Северный Кипр/, p.name);
    assert.doesNotMatch(text, /\bKT\b/, `${p.name}: bare code`);
    const codes = [...new Set(t.packageCoverageCodes(p))];
    const label = t.compactCoverageLabel(p);
    const n = Number((label.match(/(\d+) стран/) || [])[1]);
    if (n) assert.equal(n, codes.length - 1, `${p.name}: «${label}» counts KT as a country`);
    assert.equal(printedCount(p), codes.filter((c) => c !== 'KT').length, `${p.name}: generator printedCount`);
  }
});

test('no coverage list on the live snapshot can print a bare code: every displayed code has a name', () => {
  const t = loadSiteScript();
  const bare = new Set();
  for (const p of CATALOG.packages) for (const c of t.packageCoverageCodes(p)) if (t.countryName(c) === c) bare.add(c);
  assert.deepEqual([...bare], []);
});

test('daily copy and the EN plans count countries without KT, and still count AN', () => {
  const daily = require('../assets/daily-plan-copy.js');
  const pkg = { plan_type: 'DAILY', daily_gb: 1, name: 'Xyz', country_code: 'GR', coverage_country_codes: ['GR', 'CY', 'TR', 'BG', 'RO', 'HU', 'KT'] };
  const name = (c) => ({ GR: 'Греция', CY: 'Кипр', TR: 'Турция', BG: 'Болгария', RO: 'Румыния', HU: 'Венгрия', KT: 'Северный Кипр' }[c] || c);
  assert.match(daily.coverageLine(pkg, name), /^6 стран/);
  assert.match(daily.coverageLine({ ...pkg, coverage_country_codes: ['AG', 'AI', 'AN', 'BB'] }, name), /^4 страны/);
  assert.match(read('en/plans.js'), /var total = countryCount\(codes\);/);
});

test('Mini App fingerprint: adding KT moved countryLabel ONLY by its own entry', () => {
  // test/fixtures/miniapp-locale-golden.json hashes countryLabel over every
  // dictionary key, so a new name moves it by construction; its digest was
  // re-recorded with KT. Without KT the output is the I18N-04 golden, byte for byte.
  const C = require('../app/core.js');
  require('../assets/daily-plan-copy.js');
  const { fingerprint } = require('../test/fixtures/miniapp-locale-matrix.js');
  const strip = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== 'KT'));
  const without = fingerprint({ ...C, countryNames: strip(C.countryNames), countryNamesEn: strip(C.countryNamesEn) });
  assert.equal(without.countryLabel, 'af7795119382a80e02ed44f080246a9fbde42c62e2e97d09343291c3c223542c');
});

test('Mini App: KT is never a destination, and a regional group counts it out', () => {
  const core = require('../app/core.js');
  const groups = core.groupCatalogue([...KT_PACKAGES], 'ru');
  assert.ok(!groups.countries.some((g) => g.country_code === 'KT'));
  assert.equal(core.countedCountries(['GR', 'CY', 'KT']), 2);
  assert.equal(core.countedCountries(['GR', 'CY']), 2);
  assert.equal(core.countedCountries(['AG', 'AN']), 2);
});

test('no page, hub card, sitemap URL or destination-search entry for a coverage-only territory', () => {
  const snap = JSON.parse(read('seo/catalogue-countries.json'));
  for (const code of COVERAGE_ONLY_CODES) {
    const slug = COUNTRY_NAMES[code].slug;
    assert.ok(!existsSync(join(ROOT, 'esim', slug)), `/esim/${slug}/`);
    assert.ok(!existsSync(join(ROOT, 'en', 'esim', slug)), `/en/esim/${slug}/`);
    assert.ok(!snap.countries.some((c) => c.iso === code), `${code} in catalogue-countries.json`);
    for (const f of ['sitemap.xml', 'esim/index.html', 'en/esim/index.html', 'assets/ru-destinations.js']) {
      assert.ok(!read(f).includes(`/esim/${slug}/`) && !read(f).includes(`'${slug}'`) && !read(f).includes(`"${slug}"`), `${code} in ${f}`);
    }
  }
});

function guard(packages) {
  const dir = mkdtempSync(join(tmpdir(), 'cov-'));
  const file = join(dir, 'catalog.json');
  writeFileSync(file, JSON.stringify({ ...CATALOG, packages, package_count: packages.length }));
  return spawnSync(process.execPath, [join(ROOT, 'seo', 'check-country-coverage.mjs'), file], { encoding: 'utf8' });
}

test('the guard passes a catalogue with KT (the provider\'s 2026-10-18 move)', () => {
  const r = guard([...CATALOG.packages, ...KT_PACKAGES.map((p, i) => ({ ...p, package_id: `00000000-0000-4000-8000-00000000c0${i}` }))]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('the guard still REFUSES an unknown provider code (it is not loosened by the list)', () => {
  const p = { ...KT_PACKAGES[0], package_id: '00000000-0000-4000-8000-0000000000c9', coverage_country_codes: [...KT_PACKAGES[0].coverage_country_codes, 'XQ'] };
  const r = guard([...CATALOG.packages, p]);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /XQ/);
});

test('a TR + KT plan is still a Turkish plan: site, generator, EN storefront and Mini App all file it local', async () => {
  const base = CATALOG.packages.find((p) => /^Turkey Premium \d/.test(p.name)) || CATALOG.packages.find((p) => only(p, 'TR') && p.plan_type !== 'DAILY');
  const tr = { ...base, coverage_country_codes: ['TR', 'KT'] };
  const t = loadSiteScript();
  assert.equal(t.isMultiCountryPackage(tr), /greece cyprus turkey|europe|unlimited/i.test(tr.name), 'site');
  assert.match(t.publicPackageName(tr), /^Турция /, 'site title');
  assert.match(t.coverageCountriesText(tr), /Северный Кипр/, 'site coverage list still names KT');
  const { pageBlocks } = await import('./coverage-claims.mjs');
  const b = pageBlocks([tr], 'TR');
  assert.equal(b.local.length + b.daily.length, 1, 'generator');
  assert.equal(b.regional.length, 0, 'generator');
  const { SCRIPTS } = require('../test/fixtures/en-plans-matrix.js');
  const ctx = { console, Intl, Math, JSON, Date, Number, String, Array, Object, isFinite };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of SCRIPTS) vm.runInContext(read(f), ctx, { filename: f });
  const PLANS = ctx.MagicEnPlans.create({ I18N: ctx.MagicSiteI18n.createI18n('en'), NAMES: ctx.MagicCountryNamesEn, DAILY: ctx.MagicDailyPlan });
  // The block is the BACKEND's since 2026-10-25 (every site language and the Mini App draw its layout); its rule,
  // through the fixture port, files a TR + KT plan local too.
  const layout = require('../test/helpers/assortment-layout.cjs').layoutOf([tr]);
  assert.deepEqual(layout.countries.TR.local, [String(tr.package_id)], 'backend layout (EN storefront, Mini App)');
  assert.equal(typeof PLANS.card, 'function', 'EN storefront draws it');
  const core = require('../app/core.js');
  assert.equal(core.isRegional(tr), false, 'Mini App');
  assert.equal(core.coverageSummary(tr, 'ru'), 'Турция');
  // A real multi-country plan with KT still counts its countries, without KT.
  assert.equal(core.isRegional({ coverage_country_codes: ['GR', 'CY', 'TR', 'KT'] }), true);
  assert.match(core.coverageSummary({ coverage_country_codes: ['GR', 'CY', 'TR', 'KT'] }, 'ru'), /3 страны/);
});
