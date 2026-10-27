/* The plan facts a prefixed-language country page prints in its HTML (international SEO audit, 2026-10-27).
 *
 * Before: the EN/ES country pages carried no plan, volume or term without a script — the three blocks are filled in
 * the browser from the live GLOBAL catalogue — and a crawler read ~600 identical words on every page (Thailand vs
 * Japan 98 % alike; GSC 2026-10-27: 7 of the 13 stage pages «Discovered – currently not indexed»). These tests hold:
 *   1. the snapshot (seo/global-plan-facts.json, scripts/update-global-plan-facts.mjs): derived from the USD layout,
 *      no price / amount / identifier, never replaced by a worse one;
 *   2. every country page in every published prefixed language prints exactly the snapshot's facts, in its own
 *      language and the cards' own number format, with links only to pages that exist — and still no price or count;
 *   3. the indexed pages are no longer one text, and the catalogue bot keeps the snapshot fresh.
 *
 * Run: node --test seo/test-global-plan-facts.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { factsFor, buildFacts, validateFacts, runUpdate, LEFT_OUT, ALSO_KEPT } from '../scripts/update-global-plan-facts.mjs';
import { LOCALES } from './locales.mjs';
import { PAGE_COPY } from './page-copy.mjs';
import { INDEXED_COUNTRIES } from './indexing.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const FACTS = JSON.parse(read('seo/global-plan-facts.json'));
const COUNTRIES = JSON.parse(read('seo/catalogue-countries.json')).countries;
const AMOUNT = createRequire(import.meta.url)('../assets/daily-plan-copy.js').formatAllowance;
const PREFIXED = LOCALES.filter((l) => l.prefix && l.site.enabled);
const dict = (code) => createRequire(import.meta.url)(`../assets/i18n/${code}.js`);
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const glanceOf = (html) => (html.match(/<section class="cp-help cp-glance"[\s\S]*?<\/section>/) || [null])[0];

/* ---------------------------------------------------------------- 1. the snapshot */

const pkg = (id, o) => ({ package_id: id, coverage_country_codes: [], ...o });
const ANSWER = {
  currency: 'USD',
  data: [
    pkg('l1', { data_gb: 10, validity_days: 30 }), pkg('l2', { data_gb: 1, validity_days: 7 }), pkg('l3', { data_gb: 10, validity_days: 7 }),
    pkg('u', { data_gb: 0, validity_days: 30 }),                                   // an unlimited row: no volume to state
    pkg('r1', { coverage_country_codes: ['TH', 'VN', 'RU', 'MY'] }), pkg('r2', { coverage_country_codes: ['TH', 'MY', 'UA', 'BY', 'US-HI'] }),
    pkg('d1', { daily_gb: 0.49, sellable_days: [3, 7] }), pkg('d2', { daily_gb: 1, validity_days: 5 }),
  ],
  assortment: { countries: { TH: { local: ['l1', 'l2', 'l3', 'u'], regional: ['r1', 'r2'], daily: ['d1', 'd2'] }, RU: { local: ['l1'], regional: [], daily: [] } } },
};

test('the facts are derived from the layout: volumes, terms, ranked destinations, daily allowances and terms', () => {
  const doc = buildFacts(ANSWER);
  assert.deepEqual(Object.keys(doc.countries), ['TH'], 'RU/UA/BY never get facts');
  assert.deepEqual(doc.countries.TH, {
    local: { gb: [1, 10], days: [7, 30] },
    also: ['MY', 'VN'],                              // MY is in both regional plans; never TH itself, RU/UA/BY or «US-HI»
    daily: { gb_per_day: [0.49, 1], days: [3, 5, 7] },
  });
  assert.equal(doc.countries.TH.also.some((c) => LEFT_OUT.includes(c)), false);
});

test('only the USD catalogue with a layout is accepted', () => {
  assert.throws(() => buildFacts({ ...ANSWER, currency: 'RUB' }), /USD/);
  assert.throws(() => buildFacts({ currency: 'USD', data: [] }), /assortment/);
});

test('the committed snapshot is valid, carries no price or identifier, and keeps the ranking short', () => {
  assert.deepEqual(validateFacts(FACTS), []);
  assert.match(FACTS.updated, /^\d{4}-\d{2}-\d{2}$/);
  for (const f of Object.values(FACTS.countries)) assert.ok(f.also.length <= ALSO_KEPT);
  // negative controls: each way money or an identity could ride in is refused
  const bad = (mut) => validateFacts(mut(JSON.parse(JSON.stringify(FACTS))));
  assert.notDeepEqual(bad((d) => { d.countries.TH.price = 4.99; return d; }), []);
  assert.notDeepEqual(bad((d) => { d.countries.TH.local.package_id = 'x'; return d; }), []);
  assert.notDeepEqual(bad((d) => { d.countries.TH.also.push('RU'); return d; }), []);
  assert.notDeepEqual(bad((d) => { d.countries.TH.local.gb = [10, 1]; return d; }), []);
  assert.notDeepEqual(bad((d) => { d.countries = {}; return d; }), []);
});

test('never worse: a failed fetch, a bad answer or an identical one leaves the file and its date alone', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'gpf-'));
  const file = join(dir, 'facts.json');
  const big = { ...ANSWER };
  // 120 distinct two-letter codes, each with TH's layout — above the 100-country floor
  const codes = []; for (let a = 0; codes.length < 120; a += 1) { const c = String.fromCharCode(65 + Math.floor(a / 26)) + String.fromCharCode(65 + (a % 26)); if (!['RU', 'UA', 'BY'].includes(c)) codes.push(c); }
  big.assortment.countries = Object.fromEntries(codes.map((c) => [c, ANSWER.assortment.countries.TH]));
  const ok = async () => ({ status: 200, text: async () => JSON.stringify(big) });
  try {
    assert.equal(await runUpdate({ fetchImpl: ok, today: '2026-01-01', file }), 0);
    const first = readFileSync(file, 'utf8');
    assert.equal(JSON.parse(first).updated, '2026-01-01');
    assert.equal(await runUpdate({ fetchImpl: ok, today: '2026-01-02', file }), 0);
    assert.equal(readFileSync(file, 'utf8'), first, 'an identical catalogue keeps the file and its date');
    const down = async () => ({ status: 503, text: async () => '{}' });
    assert.equal(await runUpdate({ fetchImpl: down, today: '2026-01-03', file }), 0, 'a GLOBAL outage only warns');
    assert.equal(readFileSync(file, 'utf8'), first);
    const rub = async () => ({ status: 200, text: async () => JSON.stringify({ ...big, currency: 'RUB' }) });
    assert.equal(await runUpdate({ fetchImpl: rub, today: '2026-01-04', file }), 0);
    assert.equal(readFileSync(file, 'utf8'), first, 'a RUB answer never replaces the USD facts');
    const tiny = async () => ({ status: 200, text: async () => JSON.stringify(ANSWER) });
    assert.equal(await runUpdate({ fetchImpl: tiny, today: '2026-01-05', file }), 0);
    assert.equal(readFileSync(file, 'utf8'), first, 'a catalogue that shrank to one country is refused');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* ---------------------------------------------------- 2. what every page prints */

for (const L of PREFIXED) {
  test(`${L.code}: every country page prints its facts, in its language, linking only to existing pages, with no price or count`, () => {
    const C = PAGE_COPY[L.code];
    const words = dict(L.code);
    const plural = new Intl.PluralRules(L.htmlLang);
    const day = (n) => words[plural.select(n) === 'one' ? 'plan.dayCount.one' : 'plan.dayCount.other'].replace('{n}', String(n));
    let withFacts = 0;
    for (const c of COUNTRIES) {
      const html = read(`${L.prefix}/esim/${c.slug}/index.html`);
      const g = glanceOf(html);
      const f = FACTS.countries[c.iso];
      const any = f && ((f.local.gb.length && f.local.days.length) || f.also.length || (f.daily.gb_per_day.length && f.daily.days.length));
      if (!any) { assert.equal(g, null, `${L.code}/${c.slug}: a glance block with nothing in it`); continue; }
      assert.ok(g, `${L.code}/${c.slug}: no glance block in the HTML`);
      withFacts += 1;
      const text = decode(g.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      if (f.local.gb.length && f.local.days.length) {
        assert.ok(text.includes(f.local.gb.map((gb) => AMOUNT(gb, L.code)).join(C.glanceSep)), `${L.code}/${c.slug}: local volumes`);
        assert.ok(text.includes(f.local.days.map(day).join(C.glanceSep)), `${L.code}/${c.slug}: local terms`);
      }
      if (f.daily.gb_per_day.length && f.daily.days.length) {
        assert.ok(text.includes(f.daily.gb_per_day.map((gb) => AMOUNT(gb, L.code)).join(C.glanceSep)), `${L.code}/${c.slug}: daily allowances`);
        assert.ok(text.includes(f.daily.days.map(day).join(C.glanceSep)), `${L.code}/${c.slug}: daily terms`);
      }
      const links = [...g.matchAll(/<a href="([^"]+)">/g)].map((m) => m[1]);
      assert.ok(links.length <= 8, `${L.code}/${c.slug}: at most eight destinations`);
      for (const href of links) {
        assert.match(href, new RegExp(`^/${L.prefix}/esim/[a-z0-9-]+/$`), `${L.code}/${c.slug}: a link leaves the language`);
        assert.ok(existsSync(join(ROOT, href.slice(1), 'index.html')), `${L.code}/${c.slug}: ${href} does not exist`);
        assert.notEqual(href, `/${L.prefix}/esim/${c.slug}/`, `${L.code}/${c.slug}: links to itself`);
      }
      // the linked destinations are the snapshot's ranking, in order — never a guess
      const slugOf = new Map(COUNTRIES.map((x) => [x.iso, x.slug]));
      const want = f.also.map((iso) => slugOf.get(iso)).filter(Boolean).slice(0, 8).map((s) => `/${L.prefix}/esim/${s}/`);
      assert.deepEqual(links, want, `${L.code}/${c.slug}: the destinations`);
      assert.equal(/\$\s?\d|₽|\bUSD\s?\d|\d\s?(USD|RUB)\b|US\$/i.test(text), false, `${L.code}/${c.slug}: a price in the glance`);
      assert.ok(g.includes(`<time datetime="${FACTS.updated}">`), `${L.code}/${c.slug}: the list's date`);
      // after the plans, before «Before you buy»: below the fold, so nothing shifts while the plans load
      assert.ok(html.indexOf('id="dailyBlock"') < html.indexOf('cp-glance') && html.indexOf('cp-glance') < html.indexOf('id="cpHelpTitle"'), `${L.code}/${c.slug}: position`);
    }
    assert.ok(withFacts > 180, `${L.code}: only ${withFacts} pages carry facts — did the generator stop reading the snapshot?`);
  });
}

/* ------------------------------------------- 3. distinct pages, a fresh snapshot */

const words = (html) => new Set(decode(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ')).toLowerCase().split(/\s+/).filter(Boolean));
test('no two indexed EN/ES country pages share their plan facts word for word', () => {
  for (const prefix of ['en', 'es']) {
    const seen = new Map();
    for (const slug of INDEXED_COUNTRIES) {
      const g = glanceOf(read(`${prefix}/esim/${slug}/index.html`));
      assert.ok(g, `${prefix}/${slug}: an indexed page without facts`);
      const key = [...words(g)].sort().join(' ');
      assert.ok(!seen.has(key), `${prefix}/${slug} prints the same facts as ${seen.get(key)}`);
      seen.set(key, slug);
    }
  }
});

test('the catalogue bot refreshes the snapshot and commits it with the catalogue — never by failing the Russian refresh', () => {
  const wf = read('.github/workflows/refresh-catalog-cache.yml');
  const code = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const step = code.slice(code.indexOf('- name: Refresh global plan facts'), code.indexOf('- name: Commit if changed'));
  assert.match(step, /node scripts\/update-global-plan-facts\.mjs\n/);
  assert.match(step, /node scripts\/update-global-plan-facts\.mjs --check/);
  assert.ok(code.indexOf('- name: Refresh global plan facts') > code.indexOf('- name: SEO coverage facts still hold'), 'after every RU guard');
  assert.match(code, /git diff --quiet -- assets\/catalog\.json seo\/global-plan-facts\.json/);
  assert.match(code, /git add assets\/catalog\.json seo\/global-plan-facts\.json\n/);
  assert.doesNotMatch(code, /continue-on-error/);
  // the script itself only warns on a GLOBAL failure (proved above), and reads only the Render origin (D1)
  assert.match(read('scripts/update-global-plan-facts.mjs'), /'https:\/\/origin\.magicesim\.store'/);
  assert.doesNotMatch(read('scripts/update-global-plan-facts.mjs'), /api\.magicesim\.store|apigw\.yandexcloud/);
});
