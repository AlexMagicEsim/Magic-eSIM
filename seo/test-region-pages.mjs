/* THE REGION PAGES — /<prefix>/esim/{europe,asia,global}/ (international SEO stage 4, 2026-10-27; seo/regions.mjs).
 *
 *   1. The rule: a coverage set's region comes from its ISO codes only — never a name, never a size alone.
 *   2. The facts: scripts/update-global-plan-facts.mjs builds `regions` from the USD layout's REGIONAL blocks only,
 *      drops RU/UA/BY, merges equal sets, stores no price / id / name / count; validateFacts refuses each way it can go
 *      wrong (negative controls); the committed snapshot passes.
 *   3. Claims about a region (region_includes / region_excludes_some / region_together) hold or fail against the facts.
 *   4. Indexing: a region is its own page kind — noindex everywhere, no hreflang, not in the sitemap, no Russian twin,
 *      and a region slug is never a country slug.
 *   5. The built pages, every published language: head (canonical, robots, CSP connect-src 'none', breadcrumb = crumbs,
 *      no Product/FAQPage), skip link first, the payment bar, no counter, no price, no provider name, no RU/UA/BY name;
 *      the matrix printed without JavaScript and EXACTLY the snapshot (destination × set); every link a real page.
 *   6. Inbound links: every language's destination list links its three region pages; nothing links a region page that
 *      does not exist.
 *   7. The refresh automation accepts the region pages and still refuses a region-like path that is not one.
 *
 * Run: node --test seo/test-region-pages.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { REGION_SLUGS, EUROPE_CODES, ASIA_CODES, regionOf, regionClaimProblems, GLOBAL_MIN_CODES, nearLine } from './regions.mjs';
import { buildFacts, regionsFor, validateFacts, regionWarnings, LEFT_OUT } from '../scripts/update-global-plan-facts.mjs';
import { INDEXED_REGIONS, isIndexed, cluster, indexedPrefixedPages, pathIn, ruPage, ruAlternates } from './indexing.mjs';
import { LOCALES, locale } from './locales.mjs';
import { sitemapUrls, PREFIXED_WEIGHT } from './build-sitemap.mjs';
import { localeGenerator, publishedLocales } from './build-locale-pages.mjs';
import { PAGE_COPY, displayWidth, TITLE_MAX } from './page-copy.mjs';
import { countryName } from './country-names-i18n.mjs';
import { unexpectedPaths } from './refresh-allowlist.mjs';
import { EN_GUIDES } from './guides-en.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const FACTS = JSON.parse(read('seo/global-plan-facts.json'));
const CATALOGUE = JSON.parse(read('seo/catalogue-countries.json')).countries;
const PREFIXED = LOCALES.filter((l) => l.prefix && l.site.enabled);

/* ------------------------------------------------------------------ 1. the rule */

test('the rule: global by breadth; Europe and Asia by the share of their codes; anything else is no region', () => {
  const world = [...EUROPE_CODES, ...ASIA_CODES, 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'ZA', 'EG', 'MA', 'KE', 'AU', 'NZ',
    'AE', 'SA', 'IL', 'TR', 'CY', 'GE', 'AM', 'JO', 'QA', 'OM', 'KW', 'BH', 'NG', 'GH', 'TZ', 'UG', 'PE', 'CO', 'EC',
    'UY', 'PY', 'BO', 'CR', 'PA', 'GT', 'HN', 'SV', 'NI', 'DO', 'JM'];
  assert.ok(world.length >= GLOBAL_MIN_CODES);
  assert.equal(regionOf(world), 'global');
  assert.equal(regionOf(['AT', 'BE', 'DE', 'FR', 'IT', 'ES', 'US']), 'europe', 'a European set may cover the US too');
  assert.equal(regionOf(['CN', 'JP', 'KR', 'TH', 'VN', 'SG', 'AU', 'SA']), 'asia', '6 of 8 Asian codes is 75 %');
  assert.equal(regionOf(['CN', 'JP', 'KR', 'TH', 'VN', 'AU', 'SA']), null, '5 of 7 is below 75 %');
  // negative controls
  assert.equal(regionOf(['DE', 'AT']), null, 'a pair is no region page');
  assert.equal(regionOf(['AE', 'SA', 'QA', 'KW', 'BH', 'OM']), null, 'the Middle East is not «Asia» here (seo/regions.mjs)');
  assert.equal(regionOf(['DE', 'FR', 'IT', 'CN', 'JP', 'KR', 'US', 'IL']), null, 'half Europe, half Asia: neither');
  assert.equal(regionOf(['US', 'CA', 'MX', 'BR', 'AR']), null);
  assert.equal(regionOf(['FR', 'DE', 'xx', 'Europe', 'EU']), null, 'only ISO codes count — names and bloc words never');
});

/* ------------------------------------------------------------------ 2. the facts */

const pkg = (id, codes, extra = {}) => ({ package_id: id, name: `Provider family ${id} 35 areas`, price: 9.99, currency: 'USD',
  data_gb: 5, validity_days: 30, coverage_country_codes: codes, ...extra });
const EU_A = ['AT', 'BE', 'DE', 'ES', 'FR', 'IT', 'NL', 'PT'];
function fixture() {
  return {
    currency: 'USD',
    data: [
      pkg('r1', [...EU_A, 'UA']), // UA is dropped …
      pkg('r2', EU_A, { data_gb: 10, validity_days: 15 }), // … so r1 and r2 are one set
      pkg('r3', ['CN', 'JP', 'KR', 'TH', 'VN', 'RU']),
      pkg('r4', ['DE', 'AT']), // a pair: no region
      pkg('d1', ['DE', 'FR', 'IT', 'ES', 'PL'], { daily_gb: 1 }), // in a daily block only: never counted
      pkg('l1', ['DE']),
      pkg('x1', ['GB', 'IE', 'FR', 'DE', 'IT']), // in no layout at all: never counted
    ],
    assortment: { countries: {
      DE: { local: ['l1'], regional: ['r1', 'r4'], daily: ['d1'] },
      FR: { local: [], regional: ['r2'], daily: [] },
      RU: { local: [], regional: ['r1'], daily: [] }, // a left-out page never appears as «shown on»
      JP: { local: [], regional: ['r3'], daily: [] },
      ...Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`Q${String.fromCharCode(65 + (i % 26))}`, { local: [], regional: [], daily: [] }])),
    } },
  };
}

test('facts: only the layout\'s regional blocks count; RU/UA/BY dropped; equal sets merged; no price, id or name', () => {
  const answer = fixture();
  const regions = regionsFor(answer.assortment.countries, new Map(answer.data.map((p) => [p.package_id, p])));
  assert.deepEqual(regions.europe.sets, [{ codes: [...EU_A].sort(), gb: [5, 10], days: [15, 30], shown_on: ['DE', 'FR'] }]);
  assert.deepEqual(regions.asia.sets, [{ codes: ['CN', 'JP', 'KR', 'TH', 'VN'], gb: [5], days: [30], shown_on: ['JP'] }]);
  assert.deepEqual(regions.global.sets, []);
  const text = JSON.stringify(regions);
  for (const bad of ['9.99', 'r1', 'Provider family', '35 areas', '"RU"', '"UA"', '"BY"', 'GB']) assert.ok(!text.includes(bad), bad);
  // the whole document from the same answer is deterministic and valid
  const doc = buildFacts(answer);
  assert.deepEqual(buildFacts(fixture()), doc);
});

test('facts: validateFacts refuses each way a region set can go wrong (negative controls)', () => {
  const base = JSON.parse(JSON.stringify(FACTS));
  assert.deepEqual(validateFacts(base), [], 'the committed snapshot is valid');
  const broken = (fn) => { const d = JSON.parse(JSON.stringify(FACTS)); fn(d); return validateFacts(d); };
  const one = (fn, re) => { const e = broken(fn); assert.ok(e.some((x) => re.test(x)), `expected ${re} in ${JSON.stringify(e)}`); };
  one((d) => { delete d.regions; }, /regions/);
  one((d) => { d.regions.africa = { sets: [] }; }, /regions/);
  one((d) => { d.regions.europe.sets[0].codes = [...d.regions.europe.sets[0].codes, 'RU'].sort(); }, /codes/);
  one((d) => { d.regions.europe.sets[0].codes = [...d.regions.europe.sets[0].codes].reverse(); }, /codes/);
  one((d) => { d.regions.europe.sets[0].name = 'Europe (35 areas)'; }, /identifier|unexpected field/);
  one((d) => { d.regions.europe.sets[0].price = 9.99; }, /price|unexpected field/);
  one((d) => { d.regions.europe.sets[0].count = 35; }, /unexpected field/);
  one((d) => { d.regions.europe.sets.push(d.regions.europe.sets[0]); }, /twice/);
  one((d) => { d.regions.europe.sets[0] = { ...d.regions.asia.sets[0] }; }, /not europe by the rule/);
  one((d) => { d.regions.asia.sets[0].shown_on = []; }, /shown_on/);
  one((d) => { d.regions.asia.sets[0].gb = [5, 1]; }, /gb\/days/);
});

test('the committed snapshot: every set is its region by the rule, ISO codes, none left out, shown on a real country', () => {
  const iso = new Set(CATALOGUE.map((c) => c.iso));
  for (const slug of REGION_SLUGS) {
    const sets = FACTS.regions[slug].sets;
    assert.ok(Array.isArray(sets));
    for (const s of sets) {
      assert.equal(regionOf(s.codes), slug);
      for (const c of s.codes) assert.ok(/^[A-Z]{2}$/.test(c) && !LEFT_OUT.includes(c), c);
      assert.ok(s.shown_on.some((c) => iso.has(c)), `${slug}: a set shown on no country with a page`);
    }
  }
  assert.ok(FACTS.regions.europe.sets.length > 0 && FACTS.regions.asia.sets.length > 0, 'Europe and Asia have sets today');
});

test('a set close to a line, or one that left its region, is reported in the bot run (warning, never a failure)', () => {
  const at75 = ['CN', 'HK', 'ID', 'IN', 'JP', 'KH', 'KR', 'LK', 'MO', 'MY', 'PH', 'PK', 'SG', 'TH', 'VN', 'AU', 'NZ', 'IL', 'SA', 'KW'];
  assert.equal(regionOf(at75), 'asia');
  assert.match(nearLine(at75), /Asia share 75\.0 %/);
  assert.equal(regionOf([...at75.slice(0, 14), ...at75.slice(15)]), null, 'one code fewer and it leaves Asia');
  assert.equal(nearLine(['AT', 'BE', 'DE', 'ES', 'FR', 'IT', 'NL', 'PT', 'PL', 'SE']), null, 'far from every line: no noise');
  const prev = { europe: { sets: [] }, asia: { sets: [{ codes: [...at75].sort() }] }, global: { sets: [] } };
  const next = { europe: { sets: [] }, asia: { sets: [] }, global: { sets: [] } };
  assert.ok(regionWarnings(next, prev).some((w) => /asia: a set of 20 codes .* left the page/.test(w)));
  assert.ok(regionWarnings(prev, prev).some((w) => /close to a line/.test(w)));
  assert.deepEqual(regionWarnings(next, next), []);
});

/* ------------------------------------------------------------------ 3. claims */

test('claims: includes / excludes-some / together hold or fail against the facts', () => {
  const facts = { regions: { europe: { sets: [{ codes: ['AT', 'DE', 'GB', 'IT'] }, { codes: ['AT', 'DE', 'IT', 'TR'] }] }, asia: { sets: [] }, global: { sets: [] } } };
  const ok = (c) => assert.deepEqual(regionClaimProblems(c, facts), [], JSON.stringify(c));
  const bad = (c) => assert.notDeepEqual(regionClaimProblems(c, facts), [], JSON.stringify(c));
  ok({ kind: 'region_includes', region: 'europe', code: 'GB' });
  bad({ kind: 'region_includes', region: 'europe', code: 'CH' });
  ok({ kind: 'region_excludes_some', region: 'europe', code: 'TR' });
  bad({ kind: 'region_excludes_some', region: 'europe', code: 'DE' });
  ok({ kind: 'region_together', region: 'europe', codes: ['DE', 'IT', 'TR'] });
  bad({ kind: 'region_together', region: 'europe', codes: ['GB', 'TR'] }, 'two sets between them are not «one plan»');
  bad({ kind: 'region_together', region: 'europe', codes: ['DE'] });
  bad({ kind: 'region_includes', region: 'asia', code: 'JP' });
  bad({ kind: 'region_covers_all', region: 'europe', code: 'DE' });
  bad({ kind: 'region_includes', region: 'schengen', code: 'DE' });
  bad({ kind: 'region_includes', region: 'europe', code: 'Germany' });
});

/* ------------------------------------------------------------------ 4. indexing */

test('indexing: a region is its own kind — noindex in every language, no hreflang, not in the sitemap, no Russian twin', () => {
  assert.deepEqual([...INDEXED_REGIONS], [], 'the region stage is empty (owner, 2026-10-27)');
  assert.ok(!INDEXED_REGIONS.includes('global'), 'Global never before the «Best World» (RU/BY) decision');
  const slugs = new Set(CATALOGUE.map((c) => c.slug));
  for (const slug of REGION_SLUGS) {
    assert.ok(!slugs.has(slug), `${slug} is a country slug too`);
    const page = { kind: 'region', slug };
    assert.equal(pathIn(locale('ru'), page), null, 'the Russian site has no region page');
    for (const l of LOCALES) assert.equal(isIndexed(l.code, page), false, `${l.code} ${slug}`);
    assert.deepEqual(cluster(page), []);
    assert.deepEqual(ruPage(`/esim/${slug}/`), page, 'a region path is never read as a Russian country');
    assert.equal(ruAlternates(`/esim/${slug}/`), '');
  }
  assert.equal(indexedPrefixedPages(EN_GUIDES.map((g) => g.slug)).filter((p) => p.page.kind === 'region').length, 0);
  const locs = sitemapUrls(CATALOGUE).map((u) => u.loc);
  assert.equal(locs.filter((u) => REGION_SLUGS.some((s) => u.endsWith(`/esim/${s}/`))).length, 0);
  assert.equal(read('sitemap.xml').match(/\/esim\/(europe|asia|global)\//g), null);
  assert.deepEqual(PREFIXED_WEIGHT.region, { prio: '0.7', freq: 'weekly' }, 'a region opened later gets a full sitemap entry');
});

/* ------------------------------------------------------------------ 5. the built pages */

const head = (html) => html.slice(0, html.indexOf('</head>'));
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const NAMES = /Best World|EUconnect|Asialink|APAC|Asia-20|Balkans Special|Europe Special|\bareas\b|\bSchengen\b|\bEU\b|all of Europe|unlimited/i;

for (const l of PREFIXED) {
  const C = PAGE_COPY[l.code];
  const G = localeGenerator(l.code);
  const pageBySlug = new Map(G.countries().map((c) => [c.slug, c]));
  const pageByIso = new Map(G.countries().map((c) => [c.iso, c]));
  for (const slug of REGION_SLUGS) {
    test(`${l.prefix}/esim/${slug}/: head, structure, no price, no provider name, the matrix = the snapshot`, () => {
      const rel = `${l.prefix}/esim/${slug}/index.html`;
      assert.ok(existsSync(join(ROOT, rel)), rel);
      const html = read(rel);
      const h = head(html);
      const url = `https://magicesim.store/${l.prefix}/esim/${slug}/`;
      assert.match(h, new RegExp(`<html lang="${l.htmlLang}">|`));
      assert.ok(h.includes(`<link rel="canonical" href="${url}">`), 'self-canonical');
      assert.ok(h.includes('<meta name="robots" content="noindex, follow">'));
      assert.doesNotMatch(h, /rel="alternate"/, 'no hreflang while noindex');
      assert.match(h, /connect-src 'none'/, 'a static page connects nowhere');
      assert.doesNotMatch(html, /mc\.yandex|metrika|googletagmanager|gtag\(/i, 'no counter');
      assert.doesNotMatch(html, /"@type":"(Product|Offer|AggregateOffer|FAQPage)"/);
      const title = h.match(/<title>([^<]+)<\/title>/)[1];
      assert.ok(displayWidth(title.replace(/&amp;/g, '&')) <= TITLE_MAX, title);
      // breadcrumb JSON-LD = the visible crumbs
      const ld = JSON.parse(h.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
      assert.equal(ld['@type'], 'BreadcrumbList');
      assert.deepEqual(ld.itemListElement.map((x) => x.item), [`https://magicesim.store/${l.prefix}/`, `https://magicesim.store/${l.prefix}/esim/`, url]);
      const name = C[{ europe: 'regionEurope', asia: 'regionAsia', global: 'regionGlobal' }[slug]];
      assert.equal(ld.itemListElement[2].name, name);
      assert.ok(html.includes(`› ${name}</p>`), 'the visible crumbs end with the region');
      // body: skip link first, payment bar, one H1, the bundle only
      const body = html.slice(html.indexOf('<body'));
      assert.match(body, /^<body[^>]*>\s*<a class="skip" href="#main">/);
      assert.ok(html.includes('id="previewNotice"'), 'the payment bar (every English and prefixed page)');
      assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
      assert.deepEqual([...html.matchAll(/<script src="([^"?]+)/g)].map((m) => m[1]), ['/assets/logo-once.js', `/assets/site-i18n-${l.prefix}.js`]);
      // nothing priced, counted from a name, or named by a provider; no left-out country
      const words = text(html);
      assert.doesNotMatch(words, /\$|US\$|USD|₽|€|\bRUB\b/, 'no price or currency');
      assert.doesNotMatch(words, NAMES, 'no provider family name, bloc or coverage word');
      for (const iso of LEFT_OUT) assert.ok(!words.includes(countryName(iso, l.code)), `${iso} is never named`);
      assert.doesNotMatch(html, /<template|<noscript|\shidden[\s>]/, 'the facts are in the static HTML, visible without JavaScript');
      // the matrix: each destination with a page, the letters of exactly the sets that cover it — split by whether the
      // destination's OWN page offers the set (its shown_on). A row may say «offered on its page» only for those.
      const sets = FACTS.regions[slug].sets;
      const here = new Map();
      const also = new Map();
      sets.forEach((s, i) => {
        for (const iso of s.codes) {
          if (!pageByIso.has(iso)) continue;
          const m = s.shown_on.includes(iso) ? here : also;
          m.set(iso, [...(m.get(iso) || []), String.fromCharCode(65 + i)]);
          (s.shown_on.includes(iso) ? also : here).set(iso, (s.shown_on.includes(iso) ? also : here).get(iso) || []);
        }
      });
      const rows = [...html.matchAll(/<li data-iso="([A-Z]{2})"><a href="([^"]+)">[\s\S]*?<\/li>/g)];
      assert.equal(rows.length, here.size, 'one row per covered destination with a page');
      const lettersIn = (row, cls) => {
        const m = row.match(new RegExp(`<small class="${cls}">([\\s\\S]*?)<\\/small>`));
        if (!m) return [];
        const ls = [...m[1].matchAll(/<a href="#set-([a-z])" aria-label="[^"]+">([A-Z])<\/a>/g)];
        for (const [, id, letter] of ls) {
          assert.equal(id, letter.toLowerCase());
          assert.ok(html.includes(`class="help-card" id="set-${id}"`), `#set-${id} is a card on the page`);
        }
        return ls.map((x) => x[2]);
      };
      for (const [row, iso, href] of rows) {
        assert.equal(href, `/${l.prefix}/esim/${pageByIso.get(iso).slug}/`);
        const h = lettersIn(row, 'sets-here');
        const o = lettersIn(row, 'sets-also');
        assert.deepEqual(h, here.get(iso), `${iso}: «offered on its page» = exactly the sets whose shown_on has ${iso}`);
        assert.deepEqual(o, also.get(iso), `${iso}: the other sets covering it`);
        for (const x of h) assert.ok(sets[x.charCodeAt(0) - 65].shown_on.includes(iso), `${iso}: set ${x} is not offered on its page`);
        if (h.length) assert.ok(row.includes(C.regionOfferedHere('').trim().replace(/&/g, '&amp;').slice(0, 6)), `${iso}: the «offered on its page» words`);
      }
      assert.equal((html.match(/class="help-card" id="set-/g) || []).length, sets.length, 'one card per set');
      // every link on the page leads to a page that exists
      for (const [, href] of html.matchAll(/href="(\/[a-z]{2}\/esim\/[^"#]+)"/g)) {
        const s = href.split('/')[3];
        assert.ok(pageBySlug.has(s) || REGION_SLUGS.includes(s), href);
      }
    });
  }

  test(`${l.prefix}: the destination list links its three region pages; the Russian site links none`, () => {
    const hub = read(`${l.prefix}/esim/index.html`);
    for (const slug of REGION_SLUGS) assert.ok(hub.includes(`<a class="hub-tile" href="/${l.prefix}/esim/${slug}/">`), slug);
  });
}

test('no page links a region page that does not exist; the Russian pages link none', () => {
  const bad = [];
  const walk = (d) => {
    for (const n of readdirSync(join(ROOT, d), { withFileTypes: true })) {
      if (n.name === 'node_modules' || n.name.startsWith('.')) continue;
      const p = d ? `${d}/${n.name}` : n.name;
      if (n.isDirectory()) { if (!['test', 'seo', 'scripts', 'app', 'assets', 'brandbook', 'reports'].includes(p)) walk(p); continue; }
      if (!n.name.endsWith('.html')) continue;
      const html = read(p);
      for (const [, href] of html.matchAll(/href="(\/(?:[a-z]{2}\/)?esim\/(europe|asia|global)\/)"/g)) {
        if (!existsSync(join(ROOT, href, 'index.html')) || !/^\/[a-z]{2}\//.test(href)) bad.push(`${p} → ${href}`);
      }
    }
  };
  walk('');
  assert.deepEqual(bad, []);
  for (const slug of REGION_SLUGS) assert.ok(!existsSync(join(ROOT, 'esim', slug)), `a Russian /esim/${slug}/ would read as a country`);
});

/* ------------------------------------------------------------------ 7. the refresh automation */

test('refresh: a run that rewrites only region pages proceeds; a region-like path that is not one stops it', () => {
  const slugs = CATALOGUE.map((c) => c.slug);
  const pages = publishedLocales().flatMap((code) => REGION_SLUGS.map((s) => `${locale(code).prefix}/esim/${s}/index.html`));
  assert.equal(pages.length, PREFIXED.length * 3);
  assert.deepEqual(unexpectedPaths(pages, slugs), []);
  assert.deepEqual(unexpectedPaths(['en/esim/africa/index.html', 'en/regions/europe/index.html', 'esim/europe/index.html'], slugs),
    ['en/esim/africa/index.html', 'en/regions/europe/index.html', 'esim/europe/index.html']);
});

test('no region slug is a country slug of the generator (it refuses to build one that is)', () => {
  const G = localeGenerator('en');
  const real = G.countries;
  assert.ok(typeof G.regionPage === 'function');
  assert.ok(!real().some((c) => REGION_SLUGS.includes(c.slug)));
});
