/* The English country pages (/en/esim/<slug>/): what the generator writes,
 * where it may write, how a search engine is told to treat them, and how a
 * country's plans are sorted into blocks.
 *
 * Run: node --test seo/test-en-pages.mjs
 */
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enCountries, countryPage, hubPage, destinationsJs } from './build-en-pages.mjs';
import { stampHtml } from './asset-version.mjs';
import { allowedPaths } from './refresh-allowlist.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const require = createRequire(import.meta.url);
const LIST = enCountries();
const CATALOGUE = JSON.parse(read('seo/catalogue-countries.json')).countries;

/* ===================================================================== *
 * 1. The committed pages are the generator's output, all of them
 * ===================================================================== */

test('every committed English page is exactly what the generator produces', () => {
  const stale = [];
  for (const c of LIST) {
    const rel = `en/esim/${c.slug}/index.html`;
    const want = stampHtml(countryPage(c), join(ROOT, 'en/esim', c.slug));
    if (!existsSync(join(ROOT, rel)) || read(rel) !== want) stale.push(rel);
  }
  if (read('en/esim/index.html') !== stampHtml(hubPage(LIST), join(ROOT, 'en/esim'))) stale.push('en/esim/index.html');
  if (read('en/destinations.js') !== destinationsJs(LIST)) stale.push('en/destinations.js');
  assert.deepEqual(stale, [], 'run node seo/build-en-pages.mjs (or build-all.mjs) — never edit these by hand');
});

test('one English page per Russian country page — no more, no fewer', () => {
  assert.equal(LIST.length, CATALOGUE.length);
  assert.ok(LIST.length >= 190, `only ${LIST.length} countries — is the snapshot loaded?`);
  for (const c of CATALOGUE) {
    assert.ok(existsSync(join(ROOT, 'esim', c.slug, 'index.html')), `the Russian twin of ${c.slug} exists`);
    assert.ok(existsSync(join(ROOT, 'en/esim', c.slug, 'index.html')), `en/esim/${c.slug}/`);
  }
  // The generator never deletes (the Russian rule too): a country that leaves
  // the catalogue must be removed with `git rm` in the same commit. This is
  // what notices if it is not.
  const orphans = readdirSync(join(ROOT, 'en/esim'), { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name)
    .filter((slug) => !LIST.some((c) => c.slug === slug));
  assert.deepEqual(orphans, [], 'English pages for countries the catalogue no longer has');
});

test('the home searches exactly the countries that have an English page', () => {
  const ctx = {};
  new Function('window', read('en/destinations.js'))(ctx);
  const list = ctx.MagicEnDestinations;
  assert.equal(list.length, LIST.length);
  for (const d of list) {
    assert.ok(existsSync(join(ROOT, 'en/esim', d.slug, 'index.html')), d.slug);
    assert.match(d.iso, /^[A-Z]{2}$/);
  }
  assert.ok(list.some((d) => d.slug === 'uae' && d.name === 'United Arab Emirates'));
});

/* ===================================================================== *
 * 2. How a search engine is told to treat them
 * ===================================================================== */

const pages = () => LIST.map((c) => ({ c, html: read(`en/esim/${c.slug}/index.html`) }))
  .concat([{ c: { slug: '' }, html: read('en/esim/index.html') }]);

test('every English country page is a noindex template with a self canonical and no hreflang', () => {
  for (const { c, html } of pages()) {
    const url = `https://magicesim.store/en/esim/${c.slug ? `${c.slug}/` : ''}`;
    assert.match(html, /<html lang="en">/, url);
    assert.match(html, /<meta name="robots" content="noindex, follow">/, url);
    assert.equal((html.match(/<meta name="robots"/g) || []).length, 1, `${url}: one robots tag, not two that disagree`);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${url}: canonical is itself`);
    // hreflang pairs a page with an INDEXABLE twin. A noindex page in a cluster
    // is an error report waiting to happen — and no Russian page links back.
    assert.equal(/<link[^>]*hreflang/.test(html), false, `${url}: no hreflang alternate`);
    assert.equal(/application\/ld\+json/.test(html), false, `${url}: no structured data on a template`);
  }
});

test('the noindex rule can fire', () => {
  // §26.1: a page without the tag must fail the check above.
  const broken = countryPage(LIST[0]).replace(/<meta name="robots"[^>]*>/, '');
  assert.equal(/<meta name="robots" content="noindex, follow">/.test(broken), false);
});

test('no English country page is in the sitemap, and no Russian page points at one', () => {
  const sitemap = read('sitemap.xml');
  assert.equal(/\/en\/esim\//.test(sitemap), false);
  const ruWithEnLink = CATALOGUE.filter((c) => /\/en\/esim\//.test(read(`esim/${c.slug}/index.html`)));
  assert.deepEqual(ruWithEnLink, [], 'a Russian page changed — RU must not move in this PR');
});

test('robots.txt lets crawlers SEE the noindex', () => {
  // A Disallow would hide the tag itself, and a blocked page can still be
  // indexed from links. noindex only works on a page that can be fetched.
  assert.equal(/Disallow:\s*\/en\//.test(read('robots.txt')), false);
});

/* ===================================================================== *
 * 3. What a page may say
 * ===================================================================== */

test('no English page carries a price, a currency figure or a plan count in its HTML', () => {
  // Prices arrive in the browser from the GLOBAL catalogue. A figure baked into
  // the HTML is a figure nobody refreshes.
  for (const { c, html } of pages()) {
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
    assert.equal(/\$\s?\d|₽|\bUSD\s?\d|\d\s?(USD|RUB)\b|руб/i.test(text), false, `${c.slug || 'list'}: a price in the HTML`);
    assert.equal(/\b\d+\s+(plans?|countries)\b/i.test(text), false, `${c.slug || 'list'}: a count in the HTML`);
  }
  assert.equal(/\$\s?\d/.test('from $4.99'), true, 'the rule can fire');
});

test('a template says nothing about the network, the operators or the coverage quality', () => {
  // These pages were not written for their country. CLAUDE.md: a page may not
  // promise network quality in a place, and coverage is a list of codes.
  const BANNED = /\b(4G|5G|LTE|operator|carrier network|signal|reliable|fast|best|cheapest|unlimited|guarantee)/i;
  const html = countryPage({ iso: 'XX', slug: 'x', name: 'Placeholder' });
  const prose = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ');
  assert.equal(BANNED.test(prose), false, prose.match(BANNED)?.[0]);
  assert.equal(BANNED.test('works on 5G'), true, 'the rule can fire');
});

test('a country name cannot become markup', () => {
  const html = countryPage({ iso: 'XX', slug: 'x', name: '<img src=x onerror=alert(1)> & "q"' });
  assert.equal(html.includes('<img src=x'), false);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;'));
  // A real non-ASCII name is written as itself, not mangled by the escape.
  assert.match(read('en/esim/aland-islands/index.html'), /<h1>eSIM for Åland Islands<\/h1>/);
});

test('every page loads the GLOBAL client and never the Russian catalogue', () => {
  for (const c of LIST.slice(0, 5).concat(LIST.filter((x) => ['uae', 'thailand', 'french-polynesia'].includes(x.slug)))) {
    const html = read(`en/esim/${c.slug}/index.html`);
    assert.match(html, /<script src="\/assets\/global-catalog\.js\?v=[0-9a-f]{8}"><\/script>/);
    assert.match(html, /<script src="\/en\/country\.js\?v=[0-9a-f]{8}"><\/script>/);
    assert.match(html, new RegExp(`<body data-iso="${c.iso}">`));
    assert.equal(/catalog-loader|country-tariffs|catalog\.json|metrika|mc\.yandex/i.test(html), false, c.slug);
    assert.match(html, new RegExp(`class="langsw" href="/esim/${c.slug}/" hreflang="ru"`), 'the switch goes to the Russian twin');
  }
});

/* ===================================================================== *
 * 4. The generator writes in en/ and nowhere else
 * ===================================================================== */

function snapshotTree(dir) {
  const out = new Map();
  execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: dir, encoding: 'buffer' })
    .toString('utf8').split('\0').filter(Boolean)
    .forEach((rel) => { if (existsSync(join(dir, rel))) out.set(rel, createHash('sha256').update(readFileSync(join(dir, rel))).digest('hex')); });
  return out;
}

test('running the generator touches nothing outside en/ — proven in a sandbox', () => {
  const dir = mkdtempSync(join(tmpdir(), 'en-pages-'));
  try {
    execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'buffer' })
      .toString('utf8').split('\0').filter(Boolean)
      .filter((rel) => rel !== 'node_modules')
      .forEach((rel) => {
        mkdirSync(dirname(join(dir, rel)), { recursive: true });
        copyFileSync(join(ROOT, rel), join(dir, rel));
      });
    // Wipe the English output, so the run has to write every file.
    rmSync(join(dir, 'en/esim'), { recursive: true, force: true });
    rmSync(join(dir, 'en/destinations.js'), { force: true });
    execFileSync('git', ['init', '-q'], { cwd: dir });
    const before = snapshotTree(dir);
    execFileSync('node', ['seo/build-en-pages.mjs'], { cwd: dir, stdio: 'pipe' });
    const after = snapshotTree(dir);
    const touched = [...after.keys()].filter((k) => before.get(k) !== after.get(k));
    const outside = touched.filter((k) => !k.startsWith('en/esim/') && k !== 'en/destinations.js');
    assert.deepEqual(outside, []);
    assert.equal(touched.length, LIST.length + 2, 'every page, the list and the search file');
    // …and every file it wrote is one the refresh automation may commit.
    const allowed = allowedPaths(LIST.map((c) => c.slug));
    assert.deepEqual(touched.filter((k) => !allowed.has(k)), [], 'outside seo/refresh-allowlist.mjs');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('build-all runs the English generator', () => {
  assert.match(read('seo/build-all.mjs'), /run\('build-en-pages\.mjs'\)/);
});

/* ===================================================================== *
 * 5. Which block a plan goes in — coverage codes, never the name
 * ===================================================================== */

const DAILY = require(join(ROOT, 'assets/daily-plan-copy.js'));
const NAMES = require(join(ROOT, 'assets/country-names-en.js'));
const PLANS = require(join(ROOT, 'en/plans.js')).create({ I18N: { t: (k) => k }, NAMES, DAILY });

const vol = (id, codes, price, extra = {}) => ({ package_id: id, name: id, coverage_country_codes: codes,
  country_code: codes.length === 1 ? codes[0] : 'XX-9', data_gb: 3, validity_days: 30, price, currency: 'USD', ...extra });
const day = (id, codes, ladder) => ({ package_id: id, name: id, coverage_country_codes: codes, country_code: codes[0],
  plan_type: 'DAILY', daily_term_mode: 'PER_DAY', data_gb: 0, daily_data_gb: 1, price: 1.49, currency: 'USD',
  term_prices: ladder.map(([days, price]) => ({ days, price })) });

test('a country page sorts its plans into daily, local and regional by coverage codes', () => {
  const list = [
    vol('ae-3', ['AE'], 9.99),
    vol('ae-1', ['AE'], 4.99),
    vol('gulf', ['AE', 'OM', 'QA'], 13.99),
    vol('europe-named-but-uae-only', ['AE'], 7.99, { name: 'Europe 3GB' }),  // the NAME says regional
    vol('dubai', [], 19.99, { country_code: 'AE' }),                        // coverage only in country_code
    vol('region-token', [], 29.99, { country_code: 'XX-2', region: 'AE, OM' }),
    vol('th', ['TH'], 3.99),                                                 // another country
    vol('world', ['AE', 'TH', 'FR'], 49.99, { name: 'Global (120+ areas) 3GB', country_code: 'GL-120' }),
    vol('ru', ['AE', 'RU'], 9.99, { name: 'Russia and UAE' }),
    day('ae-daily', ['AE'], [[3, 8.99], [7, 19.99]]),
    day('gulf-daily', ['AE', 'OM'], [[3, 13.99]]),
    day('no-ladder', ['AE'], []),
  ];
  const b = PLANS.classify(list, 'AE');
  assert.deepEqual(b.local.map((p) => p.package_id), ['ae-1', 'europe-named-but-uae-only', 'ae-3', 'dubai']);
  assert.deepEqual(b.regional.map((p) => p.package_id), ['gulf', 'region-token']);
  assert.deepEqual(b.daily.map((p) => p.package_id), ['ae-daily', 'gulf-daily', 'no-ladder'], 'unpayable last');
  // Worldwide plans and anything naming a restricted country never appear.
  const all = [...b.local, ...b.regional, ...b.daily].map((p) => p.package_id);
  for (const id of ['th', 'world', 'ru']) assert.equal(all.includes(id), false, id);
});

test('a daily plan is priced by its ladder, and a plan with no payable price has no button', () => {
  assert.equal(PLANS.priceText(day('d', ['AE'], [[7, 19.99], [3, 8.99]])), '$8.99');
  assert.equal(PLANS.termText(day('d', ['AE'], [[7, 19.99], [3, 8.99]])), '3 days');
  assert.equal(PLANS.priceOf(day('d', ['AE'], [])), null);
  assert.equal(PLANS.priceText(vol('v', ['AE'], 9.99)), '$9.99');
  assert.equal(PLANS.priceOf(vol('v', ['AE'], 0)), null);
});

test('a regional card names the page\'s country, not the package\'s first code', () => {
  const best = vol('best', ['AL', 'AE', 'PF', 'TH'], 35.99);
  assert.equal(PLANS.coverageText(best, 'PF'), '4 countries, incl. French Polynesia');
  assert.equal(PLANS.coverageText(vol('x', ['AE'], 1), 'AE'), 'United Arab Emirates');
});

test('the rendering module never builds markup from data', () => {
  const src = read('en/plans.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(src), false);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(read('en/country.js')), false);
  assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(read('en/app.js')), false);
});
