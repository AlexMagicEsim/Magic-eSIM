/* The French site, /fr/ (I18N FR-1, 2026-10-22): complete, in French, the English design, noindex.
 *
 *   1. Every source has every key English has (+ the `.many` plural forms French needs); the guides mirror the English
 *      ones section for section, question for question, link for link. The generator's output is the committed tree.
 *   2. The same design: every page kind's markup skeleton (tags and classes, in order) equals the English one.
 *   3. French only: no English-only word, no Russian, no German or Spanish word on the 206 pages; the claim rules hold.
 *   4. Prices and numbers the owner's way (D2): «12,99 USD»; data in Go/Mo with a decimal comma; French plurals.
 *   5. Country names in sentences: after «pour» the noun phrase FR_POUR gives — every destination has one (D5).
 *   6. French typography (D7): a no-break space before «: ; ? !», inside « », the apostrophe ’.
 *   7. Search engines (D11): every French page noindex, self-canonical, no hreflang, out of the sitemap.
 *   8. The guides name their sources (vendor pages read 2026-10-22) and quote only those labels.
 *
 * Run: node --test seo/test-fr-site.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGE_COPY, FR_POUR, TITLE_MAX } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { FR_GUIDES } from './guides-fr.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { countryName } from './country-names-i18n.mjs';
import { localeGenerator } from './build-locale-pages.mjs';
import { stampHtml } from './asset-version.mjs';
import { locale } from './locales.mjs';
import { INDEXED_COUNTRIES } from './indexing.mjs';
import { rulesFor } from './claim-guards.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const DAILY = require(join(ROOT, 'assets/daily-plan-copy.js'));

function htmlUnder(dir) {
  const out = [];
  (function walk(d) {
    for (const n of readdirSync(join(ROOT, d))) {
      const p = join(d, n);
      if (statSync(join(ROOT, p)).isDirectory()) walk(p);
      else if (n === 'index.html') out.push(p);
    }
  }(dir));
  return out.sort();
}
// LEGAL-8: the permanent copies of the legal documents (/fr/<kind>/v<n>/) are held by seo/test-legal-archive.mjs.
const FR_PAGES = htmlUnder('fr').filter((rel) => !/\/v\d[\d.]*\/index\.html$/.test(rel));
// LEGAL-4: the three translated legal documents (/fr/terms|refund|privacy/) are pages of this language too; their
// fidelity to the English — which keeps proper names, the seller's Latin address and foreign law titles in English —
// is held by seo/test-legal-i18n.mjs, so the «French only» word scan reads the 206 site pages without them.
const FR_LEGAL = /^fr\/(terms|refund|privacy)\/index\.html$/;
const FR_SITE_PAGES = FR_PAGES.filter((rel) => !FR_LEGAL.test(rel));
const head = (html) => html.slice(0, html.indexOf('</head>'));

/* ------------------------------------------------------------------ 1. complete */

test('206 French pages: the home, the list, 198 countries, the guides list and five guides', () => {
  assert.equal(FR_SITE_PAGES.length, 206);
  assert.equal(FR_PAGES.length, 209, '+ the three legal documents (LEGAL-4)');
  assert.equal(FR_PAGES.filter((p) => /^fr\/esim\/[^/]+\/index\.html$/.test(p)).length, 198);
  assert.equal(htmlUnder('en').filter((p) => !/\/v\d[\d.]*\/index\.html$/.test(p)).length, FR_PAGES.length, 'the same pages as English, the three legal documents included (LEGAL-4); the permanent copies of their versions are English only (LEGAL-5)');
});

test('every source has every key English has (+ .many plurals), and no other; the same {placeholders}', () => {
  const want = [...Object.keys(SITE.DICT.en), ...Object.keys(SITE.DICT.en).filter((k) => k.endsWith('.other')).map((k) => k.replace(/\.other$/, '.many'))].sort();
  assert.deepEqual(Object.keys(SITE.DICT.fr).sort(), want, 'assets/site-i18n.js');
  assert.deepEqual(Object.keys(PAGE_COPY.fr).sort(), Object.keys(PAGE_COPY.en).sort(), 'seo/page-copy.mjs');
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [k, v] of Object.entries(SITE.DICT.en)) assert.deepEqual(ph(SITE.DICT.fr[k]), ph(v), `${k}: the same {placeholders}`);
  assert.ok(DAILY.LANGS.includes('fr'), 'the daily-plan table');
  assert.equal(SITE.DICT.fr['lang.ru'], 'Русский');
});

test('the French guides mirror the English ones: slugs, sections, questions, related, internal links', () => {
  assert.deepEqual(FR_GUIDES.map((g) => g.slug), EN_GUIDES.map((g) => g.slug));
  const links = (g) => g.sections.flatMap((s) => [...s.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/^\/(en|fr)\//, '/L/')));
  for (const [i, fr] of FR_GUIDES.entries()) {
    const en = EN_GUIDES[i];
    assert.equal(fr.sections.length, en.sections.length, `${fr.slug}: sections`);
    assert.equal(fr.faq.length, en.faq.length, `${fr.slug}: questions`);
    assert.deepEqual(fr.related, en.related, `${fr.slug}: related`);
    assert.deepEqual(links(fr), links(en), `${fr.slug}: the same links, in French`);
    for (const [j, s] of fr.sections.entries()) {
      const tags = (h) => [...h.matchAll(/<(ol|ul|li|p|strong|a)\b/g)].map((m) => m[1]).filter((t) => t !== 'strong').join(' ');
      assert.equal(tags(s.html), tags(en.sections[j].html), `${fr.slug} §${j}: the same structure`);
    }
  }
});

test('French built through the locale generator equals the committed pages, byte for byte', () => {
  const G = localeGenerator('fr');
  const list = G.countries();
  assert.equal(list.length, 198);
  const drift = [];
  const same = (html, rel) => stampHtml(html, join(ROOT, dirname(rel))) === read(rel);
  if (!same(G.homePage(list), 'fr/index.html')) drift.push('fr/');
  for (const c of list) if (!same(G.countryPage(c), `fr/esim/${c.slug}/index.html`)) drift.push(c.slug);
  if (!same(G.hubPage(list), 'fr/esim/index.html')) drift.push('fr/esim/');
  for (const g of FR_GUIDES) if (!same(G.guidePage(g), `fr/guides/${g.slug}/index.html`)) drift.push(`guide ${g.slug}`);
  if (!same(G.guidesHub(), 'fr/guides/index.html')) drift.push('fr/guides/');
  if (G.destinationsJs(list) !== read('fr/destinations.js')) drift.push('fr/destinations.js');
  assert.deepEqual(drift, []);
});

/* ------------------------------------------------------------------ 2. the same design */

/** Tags and classes in order — what the stylesheets see. Text, URLs, ids and labels left out. */
function skeleton(html) {
  const body = html.slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/g, '<script>')
    .replace(/<svg[\s\S]*?<\/svg>/g, '<svg>')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ul class="langmenu-list">[\s\S]*?<\/ul>/g, '<ul class="langmenu-list">')
    // the authored English text (seo/content-en/, 2026-10-27) exists on the English page only, by design — content, not design
    .replace(/<div class="cp-about">[\s\S]*?<\/section>\s*<\/div>/g, '')
    .replace(/(<nav class="hub-az"[^>]*>)[\s\S]*?<\/nav>/g, '$1</nav>')
    .replace(/(<div class="hub-list" id="hubList">)[\s\S]*?(<div class="hub-empty")/g, '$1</div>$2');
  return [...body.matchAll(/<([a-z0-9]+)\b([^>]*)>/g)].filter((m) => m[1] !== 'strong' && m[1] !== 'br').map((m) => {
    const cls = (m[2].match(/\sclass="([^"]*)"/) || [, ''])[1];
    return cls ? `${m[1]}.${cls.split(/\s+/).join('.')}` : m[1];
  }).join(' ');
}

test('the same design: every page kind has the English markup skeleton (tags and classes, in order)', () => {
  const kinds = ['index.html', 'esim/index.html', 'esim/thailand/index.html', 'esim/japan/index.html', 'esim/uae/index.html',
    'esim/peru/index.html', 'esim/turkey/index.html', 'guides/index.html', ...EN_GUIDES.map((g) => `guides/${g.slug}/index.html`)];
  for (const k of kinds) assert.equal(skeleton(read(`fr/${k}`)), skeleton(read(`en/${k}`)), k);
  // …and the same stylesheets and scripts (Expressive and the logo included), the language's own data aside.
  const assets = (h) => [...h.matchAll(/(?:href|src)="(\/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g)].map((m) => m[1].replace(/^\/(en|fr)\/destinations\.js$/, 'DEST').replace(/country-names-(en|fr)\.js$/, 'NAMES').replace(/site-i18n-(en|fr)\.js$/, 'WORDS')).filter((a) => a !== '/en/content.css');   // the authored English text's own sheet
  for (const k of ['index.html', 'esim/thailand/index.html', 'esim/index.html', 'guides/iphone/index.html']) {
    assert.deepEqual(assets(read(`fr/${k}`)), assets(read(`en/${k}`)), `${k}: the same assets`);
  }
  assert.match(head(read('fr/index.html')), /<meta property="og:locale" content="fr_FR">/, 'the home names its locale');
  assert.match(read('fr/index.html'), /data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]+"/, 'Expressive on the home');
  assert.match(read('fr/esim/thailand/index.html'), /data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]+"/, 'Expressive on a country page');
  for (const k of ['index.html', 'esim/thailand/index.html', 'guides/iphone/index.html']) {
    assert.match(read(`fr/${k}`), /<script src="\/assets\/logo-once\.js\?v=[0-9a-f]+"[^>]*><\/script>/, `${k}: the logo «Reveal + Wave»`);
    assert.equal(head(read(`fr/${k}`)).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1],
      head(read(`en/${k}`)).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1], `${k}: the English CSP`);
  }
});

test('the French destination list: 198 destinations, each under its initial (É → E, Î → I, Å → A), every jump letter lands', () => {
  const html = read('fr/esim/index.html');
  const sections = [...html.matchAll(/<section class="az-group" id="az-([a-z]+)"[\s\S]*?<h2 id="azh-\1">([^<]+)<\/h2>([\s\S]*?)<\/section>/g)];
  const names = sections.flatMap((m) => [...m[3].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => [m[2], decode(x[1])]));
  assert.equal(names.length, 198);
  for (const [letter, name] of names) assert.equal(name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase(), letter, name);
  const jumps = [...html.matchAll(/<a href="#az-([a-z]+)" data-letter="([A-Z])">/g)].map((m) => m[1]);
  assert.deepEqual(jumps, sections.map((m) => m[1]));
  for (const l of sections.map((m) => m[2])) {
    const group = names.filter(([x]) => x === l).map(([, n]) => n);
    assert.deepEqual(group, group.slice().sort((a, b) => a.localeCompare(b, 'fr')), `${l}: in French order`);
  }
  const at = (n) => names.find(([, x]) => x === n)?.[0];
  assert.equal(at('États-Unis'), 'E'); assert.equal(at('Égypte'), 'E'); assert.equal(at('Îles Caïmans'), 'I'); assert.equal(at('Îles Åland'), 'I');
});

test('the skeleton check can fire', () => {
  assert.notEqual(skeleton('<body><div class="a"><p>x</p></div>'), skeleton('<body><div class="b"><p>x</p></div>'));
});

/* ------------------------------------------------------------------ 3. French only */

const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
function readable(html) {
  const body = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<a [^>]*hreflang="[^"]*"[^>]*>[^<]*<\/a>/g, ' ').replace(/<span aria-current="true"[^>]*>[^<]*<\/span>/g, ' ')
    .replace(/<summary aria-label="[^"]*">[\s\S]*?<\/summary>/g, ' ');
  const runs = [];
  for (const m of body.matchAll(/>([^<]+)</g)) runs.push(decode(m[1]));
  for (const m of body.matchAll(/\s(?:aria-label|placeholder|title|alt)="([^"]*)"/g)) runs.push(decode(m[1]));
  for (const m of body.matchAll(/<meta (?:name="description"|property="og:(?:title|description)") content="([^"]*)"/g)) runs.push(decode(m[1]));
  return runs.map((s) => s.trim()).filter(Boolean);
}

// Names that are the same in every language: the brand, products, platforms, technical terms and units.
const KEEP = new Set(['magic', 'esim', 'sim', 'sims', 'iphone', 'ios', 'android', 'google', 'pixel', 'samsung', 'galaxy',
  'apple', 'wi', 'fi', 'qr', 'apn', 'apns', 'eid', 'usd', 'gb', 'mb', 'kbps', 'mbps', 'gbps', 'ip', 'support', 'magicesim', 'store']);
const words = (s) => (String(s).toLowerCase().match(/\p{L}+/gu) || []);

function frenchWords() {
  const fr = new Set();
  const add = (v) => { for (const w of words(typeof v === 'function' ? v('X') : Array.isArray(v) ? JSON.stringify(v) : v)) fr.add(w); };
  for (const v of Object.values(SITE.DICT.fr)) add(v);
  for (const v of Object.values(PAGE_COPY.fr)) add(v);
  for (const g of FR_GUIDES) add(JSON.stringify(g).replace(/<[^>]+>/g, ' '));
  for (const v of Object.values(FR_POUR)) add(v);
  return fr;
}

function englishOnlyWords() {
  const en = new Set();
  const de = new Set();
  const add = (set, v) => { for (const w of words(typeof v === 'function' ? v('X') : Array.isArray(v) ? JSON.stringify(v) : v)) set.add(w); };
  for (const v of Object.values(SITE.DICT.en)) add(en, v);
  for (const v of Object.values(PAGE_COPY.en)) add(en, v);
  for (const g of EN_GUIDES) add(en, JSON.stringify(g).replace(/<[^>]+>/g, ' '));
  for (const w of frenchWords()) de.add(w);
  return new Set([...en].filter((w) => w.length >= 3 && !de.has(w) && !KEEP.has(w)));
}

test('French only: no English-only word and no Russian on any of the 206 pages', () => {
  const EN_ONLY = englishOnlyWords();
  assert.ok(EN_ONLY.size > 300 && EN_ONLY.has('plans') && EN_ONLY.has('choose'), 'the English word list is real');
  const namesSrc = read('assets/country-names-fr.js');
  const frNames = new Set(Object.keys(COUNTRY_NAMES).flatMap((iso) => words(namesSrc.match(new RegExp(`"${iso}": "([^"]+)"`))?.[1] || '')));
  const hits = new Set();
  for (const rel of FR_SITE_PAGES) {
    for (const run of readable(read(rel))) {
      if (/[А-Яа-яЁё]/.test(run)) hits.add(`${rel}: Russian «${run.slice(0, 60)}»`);
      for (const w of words(run)) if (EN_ONLY.has(w) && !frNames.has(w)) hits.add(`${rel}: «${w}» in «${run.slice(0, 60)}»`);
    }
  }
  assert.deepEqual([...hits].slice(0, 20), []);
});

test('no Spanish or German word on a French page (the template must not borrow another copy)', () => {
  const fr = frenchWords();
  const other = new Set();
  for (const l of ['es', 'de']) for (const v of Object.values(SITE.DICT[l])) for (const w of words(v)) if (w.length >= 5 && !fr.has(w) && !KEEP.has(w)) other.add(w);
  const hits = new Set();
  for (const rel of ['fr/index.html', 'fr/esim/index.html', 'fr/esim/thailand/index.html', 'fr/guides/index.html', 'fr/guides/iphone/index.html']) {
    for (const run of readable(read(rel))) for (const w of words(run)) if (other.has(w)) hits.add(`${rel}: «${w}»`);
  }
  assert.deepEqual([...hits], []);
});

test('the French-only check can fire', () => {
  const EN_ONLY = englishOnlyWords();
  const runs = readable('<body><p>Voir les forfaits</p><p>Show all plans</p><p>Тарифы</p></body>');
  assert.ok(runs.some((r) => words(r).some((w) => EN_ONLY.has(w))), 'an English phrase is caught');
  assert.ok(runs.some((r) => /[А-Яа-яЁё]/.test(r)), 'a Russian one too');
});

test('the claim rules (seo/claim-guards.mjs, fr) hold on every French page of their kind', () => {
  const kindOf = (rel) => (rel === 'fr/index.html' ? 'home' : /^fr\/guides\/[^/]+\/index\.html$/.test(rel) ? 'guide'
    : /^fr\/esim\/[^/]+\/index\.html$/.test(rel) ? 'country' : null);
  const hits = [];
  for (const rel of FR_PAGES) {
    const kind = kindOf(rel); if (!kind) continue;
    const text = readable(read(rel)).join('\n');
    for (const [id, re] of rulesFor('fr', kind)) { const m = text.match(re); if (m) hits.push(`${rel}: ${id} «${m[0]}»`); }
  }
  assert.deepEqual(hits, []);
});

/* ------------------------------------------------------------------ 4. numbers */

test('prices are «12,99 USD» (fr-FR, the currency as a code — owner D2); English, Spanish and German unchanged', () => {
  const fmt = (lang, n) => {
    const I = SITE.createI18n(lang);
    return new Intl.NumberFormat(I.t('fmt.numberLocale'), { style: 'currency', currency: 'USD', currencyDisplay: I.t('fmt.currencyDisplay'),
      minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/\s/g, ' ');
  };
  assert.equal(fmt('fr', 12.99), '12,99 USD');
  assert.equal(fmt('fr', 1234.5), '1 234,50 USD');
  assert.equal(fmt('en', 12.99), '$12.99');
  assert.equal(fmt('es', 12.99), 'USD 12.99');
  assert.equal(fmt('de', 12.99), '12,99 USD');
  assert.equal(SITE.DICT.fr['fmt.currencyDisplay'], 'code');
  assert.equal(SITE.DICT.fr['fmt.numberLocale'], 'fr-FR');
});

test('data in Go/Mo with a decimal comma; French plurals (0 and 1 singular)', () => {
  const I = SITE.createI18n('fr');
  assert.equal(DAILY.formatAllowance(1.5, 'fr'), '1,5 Go');
  assert.equal(DAILY.formatAllowance(0.49, 'fr'), '500 Mo');
  assert.equal(I.plural('plan.dayCount', 1, { n: 1 }), '1 jour');
  assert.equal(I.plural('plan.dayCount', 7, { n: 7 }), '7 jours');
  assert.equal(I.plural('hub.matches', 1, { n: 1 }), '1 destination correspond');
  assert.equal(I.plural('hub.matches', 3, { n: 3 }), '3 destinations correspondent');
  assert.equal(I.t('plan.gb', { n: 5 }), '5 Go');
  const sample = { plan_type: 'DAILY', daily_gb: 1.5, daily_throttle_label: '512 Kbps', daily_reset_confirmed: true, daily_term_mode: 'FIXED_TERM', validity_days: 3 };
  assert.equal(DAILY.lines(sample, 'fr').map((l) => l.text).join(' | '),
    '1,5 Go par jour à vitesse maximale | Ensuite, jusqu’à 512 kbit/s | Le volume est réinitialisé toutes les 24 heures | Durée : 3 jours');
  assert.equal(SITE.pathPrefix('fr'), '/fr');
});

/* ------------------------------------------------------------------ 5. country names in sentences */

test('FR_POUR has every destination, each key a French name the site prints, each value with its article', () => {
  const slugs = JSON.parse(read('seo/catalogue-countries.json')).countries;
  const names = new Set(Object.keys(COUNTRY_NAMES).map((iso) => { try { return countryName(iso, 'fr'); } catch { return null; } }));
  for (const c of slugs) assert.ok(Object.prototype.hasOwnProperty.call(FR_POUR, countryName(c.iso, 'fr')), `${c.slug}: no FR_POUR entry`);
  assert.equal(Object.keys(FR_POUR).length, slugs.length);
  for (const [k, v] of Object.entries(FR_POUR)) {
    assert.ok(names.has(k), `«${k}» is not a French name of seo/country-names-i18n.mjs`);
    assert.ok(v === k || /^(le|la|les) /.test(v) || /^l’/.test(v), `«${v}»: an article, an elision or the bare name`);
    assert.doesNotMatch(v, /'/, `«${v}»: the typographic apostrophe ’`);
  }
  const C = PAGE_COPY.fr;
  assert.equal(C.esimFor('Japon'), 'eSIM pour le Japon');
  assert.equal(C.esimFor('France'), 'eSIM pour la France');
  assert.equal(C.esimFor('Italie'), 'eSIM pour l’Italie');
  assert.equal(C.esimFor('États-Unis'), 'eSIM pour les États-Unis');
  assert.equal(C.esimFor('Îles Caïmans'), 'eSIM pour les îles Caïmans');
  assert.equal(C.esimFor('Singapour'), 'eSIM pour Singapour');
  assert.match(read('fr/esim/usa/index.html'), /<h1>eSIM pour les États-Unis<\/h1>/);
  assert.match(read('fr/esim/japan/index.html'), /<h1>eSIM pour le Japon<\/h1>/);
  // no name that takes an article stands bare after «pour» anywhere on the French pages
  const bare = Object.entries(FR_POUR).filter(([k, v]) => k !== v).map(([k]) => [k, new RegExp(`pour ${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'u')]);
  const hits = new Set();
  for (const rel of FR_PAGES) for (const run of readable(read(rel))) for (const [k, re] of bare) if (re.test(run)) hits.add(`${rel}: «pour ${k}»`);
  assert.ok(bare.find(([k]) => k === 'Japon')[1].test('Forfaits pour Japon'), 'the check can fire');
  assert.deepEqual([...hits], []);
});

test('every French title fits 60 characters, every description 70–160', () => {
  for (const rel of FR_PAGES) {
    const title = decode(read(rel).match(/<title>([^<]*)<\/title>/)[1]);
    assert.ok([...title].length <= TITLE_MAX, `${rel}: ${[...title].length} «${title}»`);
    const desc = decode(read(rel).match(/<meta name="description" content="([^"]*)"/)[1]);
    assert.ok([...desc].length <= 160 && [...desc].length >= 70, `${rel}: description ${[...desc].length}`);
  }
  assert.match(read('fr/esim/thailand/index.html'), /<title>eSIM pour la Thaïlande : forfaits en USD \| Magic eSIM<\/title>/);
});

/* ------------------------------------------------------------------ 6. typography */

/** French typography faults in one run of text: a plain or missing space before «: ; ? !», a plain space inside « »,
 *  an ASCII apostrophe between letters. Times, URLs, ratios and «IP:»-style codes are not in the copy. */
function typoFaults(run) {
  const f = [];
  if (/[^\s  ][;?!](?=\s|$)/u.test(run)) f.push('no space before ; ? !');
  if (/ [;?!:](?=\s|$)/u.test(run)) f.push('plain space before ; ? ! :');
  if (/[\p{L}\d)][:](?=\s|$)/u.test(run)) f.push('no space before :');
  if (/« | »/.test(run)) f.push('plain space inside « »');
  if (/\p{L}'\p{L}/u.test(run)) f.push('ASCII apostrophe');
  return f;
}

test('French typography (D7) on every French page and in every French source string', () => {
  const hits = [];
  for (const rel of FR_PAGES) for (const run of readable(read(rel))) for (const f of typoFaults(run)) hits.push(`${rel}: ${f} — «${run.slice(0, 70)}»`);
  for (const [k, v] of Object.entries(SITE.DICT.fr)) if (!/^(fmt|lang)\./.test(k)) for (const f of typoFaults(v)) hits.push(`DICT.fr ${k}: ${f}`);
  // the guides' HTML: an apostrophe right before a tag («l'<strong>itinérance») is split from its word by the tag, so the
  // rendered runs cannot see it — read the source strings with the tags in place.
  for (const g of FR_GUIDES) for (const [i, sct] of g.sections.entries()) if (/\p{L}'(?=<|\p{L})/u.test(sct.html)) hits.push(`guide ${g.slug} §${i + 1}: ASCII apostrophe in the HTML`);
  assert.deepEqual([...new Set(hits)].slice(0, 20), []);
});

test('the typography check can fire', () => {
  assert.deepEqual(typoFaults('Où partez-vous ?'), ['plain space before ; ? ! :']);
  assert.deepEqual(typoFaults('Où partez-vous?'), ['no space before ; ? !']);
  assert.deepEqual(typoFaults('Prix : 5'), ['plain space before ; ? ! :']);
  assert.deepEqual(typoFaults('Prix: 5'), ['no space before :']);
  assert.deepEqual(typoFaults("l'eSIM"), ['ASCII apostrophe']);
  assert.deepEqual(typoFaults('« Voyage »'), ['plain space inside « »']);
  assert.deepEqual(typoFaults('Où partez-vous ? Prix : « Voyage » l’eSIM'), []);
});

/* ------------------------------------------------------------------ 7. search engines */

test('noindex until the owner opens French (D11): every page noindex, self-canonical, no hreflang, out of the sitemap', () => {
  assert.equal(locale('fr').site.enabled, true);
  assert.equal(locale('fr').site.indexableHome, false);
  assert.doesNotMatch(read('sitemap.xml'), /magicesim\.store\/fr\//);
  for (const rel of FR_PAGES) {
    const h = head(read(rel));
    const url = `https://magicesim.store/${rel.replace(/index\.html$/, '')}`;
    assert.match(h, /<meta name="robots" content="noindex, follow">/, rel);
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), `${rel}: canonical`);
    assert.doesNotMatch(h, /rel="alternate"[^>]*hreflang/, `${rel}: an hreflang alternate`);
    assert.match(read(rel), /<html lang="fr"/, rel);
    const og = h.match(/<meta property="og:locale" content="([^"]+)">/);
    if (og) assert.equal(og[1], 'fr_FR', rel);
  }
  assert.doesNotMatch(read('robots.txt'), /^Disallow:\s*\/fr\//m);
});

test('no RU / EN / ES / DE page lists French as an hreflang alternate; the stage is unchanged', () => {
  assert.deepEqual([...INDEXED_COUNTRIES], ['china', 'france', 'greece', 'indonesia', 'japan', 'malaysia', 'maldives', 'mexico',
    'singapore', 'south-korea', 'sri-lanka', 'thailand', 'turkey', 'united-kingdom', 'vietnam']);
  for (const rel of ['index.html', 'esim/thailand/index.html', 'en/index.html', 'en/esim/thailand/index.html', 'es/index.html',
    'es/esim/japan/index.html', 'de/index.html', 'en/guides/iphone/index.html', 'iphone.html']) {
    assert.doesNotMatch(head(read(rel)), /hreflang="fr"/, rel);
  }
});

/* ------------------------------------------------------------------ 8. sources */

test('the French guides name their vendor sources and their date; the guides quote only sourced labels', () => {
  const src = read('seo/guides-fr.mjs');
  for (const s of ['support.apple.com/fr-fr/118669', 'support.apple.com/fr-ca/118669', '/fr-fr/118227', '/fr-fr/HT201415', 'pixelphone/answer/16115470?hl=fr',
    'samsung.com/be_fr/support/mobile-devices/la-esim-galaxy', 'samsung.com/fr/support/mobile-devices/how-to-install-nano-sim-card-and-esim', '2026-10-22']) assert.ok(src.includes(s), s);
  const quoted = new Set([...src.slice(0, src.indexOf('export const')).replace(/\n\/\/\s+/g, ' ').matchAll(/«([^»]+)»/g)].map((m) => m[1]));
  const GENERIC = new Set(['Réglages', 'Général', 'Informations', 'Données cellulaires', 'Données mobiles', 'Réseau cellulaire']);
  for (const g of FR_GUIDES.filter((x) => ['iphone', 'android', 'compatibility'].includes(x.slug))) {
    const bold = g.sections.flatMap((s) => [...s.html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]))
      .filter((b) => !/^(Google Pixel|Samsung Galaxy|Autres marques|Samsung|Pixel|iPhone|Android|données mobiles|itinérance|EID|Ne supprimez pas l’eSIM)\s*:?$/u.test(b))
      .flatMap((b) => b.split(' → '));
    for (const b of bold) assert.ok(quoted.has(b) || GENERIC.has(b), `${g.slug}: «${b}» is not among the sourced labels`);
  }
});
