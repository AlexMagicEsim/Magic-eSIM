/* The Korean site, /ko/ (I18N KO-1, 2026-10-22): complete, in Korean, the English design, noindex.
 *
 *   1. Every source has every key English has; the guides mirror the English ones; the generator's output is the tree.
 *   2. The same design: every page kind's markup skeleton equals the English one; the list by initial consonant (ㄱ…ㅎ).
 *   3. Korean only: no English-only word, no Russian, no Chinese characters on the 206 pages; the claim rules hold.
 *   4. Prices «US$12.99» (D2); data «1.5GB», days «3일» (D6); one plural form.
 *   5. Titles fit 60 display units; Korean typography (D6); PARTICLES (D15): after a {name}/{names} only particles that
 *      do not depend on the last syllable — read on three real names (vowel-final, consonant-final, long); and the right
 *      particle after a Latin word (eSIM을/은/이/으로, iPhone을/은/이/으로, Android를/는/가/로).
 *   6. Search engines (D11): noindex, self-canonical, no hreflang, out of the sitemap. 7. Legal links (D8).
 *   8. Sources: the guides quote only labels read on the vendors' Korean pages; Samsung's QR step never quoted (D12).
 *   9. Names (D5) and fonts / line breaking (D6: keep-all).
 *
 * Run: node --test seo/test-ko-site.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGE_COPY, TITLE_MAX, displayWidth } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { KO_GUIDES } from './guides-ko.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { countryName } from './country-names-i18n.mjs';
import { localeGenerator } from './build-locale-pages.mjs';
import { stampHtml } from './asset-version.mjs';
import { locale } from './locales.mjs';
import { rulesFor } from './claim-guards.mjs';
import { legalLinks, INTL_LEGAL, LEGAL_SCHEME } from './legal-links.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const DAILY = require(join(ROOT, 'assets/daily-plan-copy.js'));
const KO = SITE.DICT.ko;
const C = PAGE_COPY.ko;

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
// LEGAL-8: the permanent copies of the legal documents (/ko/<kind>/v<n>/) are held by seo/test-legal-archive.mjs.
const KO_PAGES = htmlUnder('ko').filter((rel) => !/\/v\d[\d.]*\/index\.html$/.test(rel));
// LEGAL-4: the three translated legal documents (/ko/terms|refund|privacy/) are pages of this language too; their
// fidelity to the English — which keeps proper names, the seller's Latin address and foreign law titles in English —
// is held by seo/test-legal-i18n.mjs, so the «Korean only» word scan reads the 206 site pages without them.
const KO_LEGAL = /^ko\/(terms|refund|privacy)\/index\.html$/;
const KO_SITE_PAGES = KO_PAGES.filter((rel) => !KO_LEGAL.test(rel));
const head = (html) => html.slice(0, html.indexOf('</head>'));
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

/* ------------------------------------------------------------------ 1. complete */

test('206 Korean pages: the home, the list, 198 countries, the guides list and five guides', () => {
  assert.equal(KO_SITE_PAGES.length, 209, '206 + the three region pages (seo/regions.mjs)');
  assert.equal(KO_PAGES.length, 212, '+ the three legal documents (LEGAL-4)');
  assert.equal(KO_PAGES.filter((p) => /^ko\/esim\/[^/]+\/index\.html$/.test(p)).length, 201, "198 countries + 3 region pages");
  assert.equal(htmlUnder('en').filter((p) => !/\/v\d[\d.]*\/index\.html$/.test(p)).length, KO_PAGES.length, 'the same pages as English, the three legal documents included (LEGAL-4); the permanent copies of their versions are English only (LEGAL-5)');
});

test('every source has every key English has, and no other; the same {placeholders}; one plural form', () => {
  assert.deepEqual(Object.keys(KO).sort(), Object.keys(SITE.DICT.en).sort(), 'assets/i18n/ko.js');
  assert.deepEqual(Object.keys(C).sort(), Object.keys(PAGE_COPY.en).sort(), 'seo/page-copy.mjs');
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [k, v] of Object.entries(SITE.DICT.en)) assert.deepEqual(ph(KO[k]), ph(v), `${k}: the same {placeholders}`);
  for (const k of Object.keys(KO).filter((x) => x.endsWith('.one'))) assert.equal(KO[k], KO[k.replace(/\.one$/, '.other')], `${k}: one form`);
  assert.deepEqual(new Intl.PluralRules('ko').resolvedOptions().pluralCategories, ['other']);
  assert.ok(DAILY.LANGS.includes('ko'), 'the daily-plan table');
  assert.equal(KO['lang.ru'], 'Русский');
});

test('the Korean guides mirror the English ones: slugs, sections, questions, related, internal links, ASCII anchors', () => {
  assert.deepEqual(KO_GUIDES.map((g) => g.slug), EN_GUIDES.map((g) => g.slug));
  const links = (g) => g.sections.flatMap((s) => [...s.html.matchAll(/href="(\/[^"]+)"/g)].map((m) => m[1].replace(/^\/(en|ko)\//, '/L/')));
  for (const [i, ko] of KO_GUIDES.entries()) {
    const en = EN_GUIDES[i];
    assert.equal(ko.sections.length, en.sections.length, `${ko.slug}: sections`);
    assert.equal(ko.faq.length, en.faq.length, `${ko.slug}: questions`);
    assert.deepEqual(ko.related, en.related, `${ko.slug}: related`);
    assert.deepEqual(links(ko), links(en), `${ko.slug}: the same links, in Korean`);
    for (const s of ko.sections) assert.match(s.id || '', /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${ko.slug}: «${s.h2}» names an ASCII anchor`);
  }
});

test('Korean built through the locale generator equals the committed pages, byte for byte', () => {
  const G = localeGenerator('ko');
  const list = G.countries();
  assert.equal(list.length, 198);
  const drift = [];
  const same = (html, rel) => stampHtml(html, join(ROOT, dirname(rel))) === read(rel);
  if (!same(G.homePage(list), 'ko/index.html')) drift.push('ko/');
  for (const c of list) if (!same(G.countryPage(c), `ko/esim/${c.slug}/index.html`)) drift.push(c.slug);
  if (!same(G.hubPage(list), 'ko/esim/index.html')) drift.push('ko/esim/');
  for (const g of KO_GUIDES) if (!same(G.guidePage(g), `ko/guides/${g.slug}/index.html`)) drift.push(`guide ${g.slug}`);
  if (!same(G.guidesHub(), 'ko/guides/index.html')) drift.push('ko/guides/');
  if (G.destinationsJs(list) !== read('ko/destinations.js')) drift.push('ko/destinations.js');
  assert.deepEqual(drift, []);
});

/* ------------------------------------------------------------------ 2. the same design */

function skeleton(html) {
  const body = html.slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/g, '<script>')
    .replace(/<svg[\s\S]*?<\/svg>/g, '<svg>')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ul class="langmenu-list">[\s\S]*?<\/ul>/g, '<ul class="langmenu-list">')
    // the authored English text (seo/content-en/, 2026-10-27) exists on the English page only, by design — content, not design
    .replace(/<div class="cp-about">[\s\S]*?<\/section>\s*<\/div>/g, '')
    .replace(/(<nav class="hub-az"[^>]*>)[\s\S]*?<\/nav>/g, '$1</nav>')
    .replace(/(<div class="hub-list" id="hubList">)[\s\S]*?(<div class="hub-empty")/g, '$1</div>$2')
    .replace(/<p><a href="\/terms\.html"[\s\S]*?<\/p>/g, '');   // (pre-LEGAL-1 pages had a Russian legal line)
  return [...body.matchAll(/<([a-z0-9]+)\b([^>]*)>/g)].filter((m) => m[1] !== 'strong' && m[1] !== 'br').map((m) => {
    const cls = (m[2].match(/\sclass="([^"]*)"/) || [, ''])[1];
    return cls ? `${m[1]}.${cls.split(/\s+/).join('.')}` : m[1];
  }).join(' ');
}

test('the same design: every page kind has the English markup skeleton; the same assets, CSP, logo and motion', () => {
  const kinds = ['index.html', 'esim/index.html', 'esim/thailand/index.html', 'esim/japan/index.html', 'esim/uae/index.html',
    'esim/peru/index.html', 'esim/turkey/index.html', 'guides/index.html', ...EN_GUIDES.map((g) => `guides/${g.slug}/index.html`)];
  for (const k of kinds) assert.equal(skeleton(read(`ko/${k}`)), skeleton(read(`en/${k}`)), k);
  const assets = (h) => [...h.matchAll(/(?:href|src)="(\/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g)].map((m) => m[1].replace(/^\/(en|ko)\/destinations\.js$/, 'DEST').replace(/country-names-(en|ko)\.js$/, 'NAMES').replace(/site-i18n-(en|ko)\.js$/, 'WORDS')).filter((a) => a !== '/en/content.css');   // the authored English text's own sheet
  for (const k of ['index.html', 'esim/thailand/index.html', 'esim/index.html', 'guides/iphone/index.html']) {
    assert.deepEqual(assets(read(`ko/${k}`)), assets(read(`en/${k}`)), `${k}: the same assets`);
  }
  assert.match(head(read('ko/index.html')), /<meta property="og:locale" content="ko_KR">/, 'the home names its locale (D10)');
  for (const k of ['index.html', 'esim/thailand/index.html', 'guides/iphone/index.html']) {
    assert.match(read(`ko/${k}`), /<html lang="ko"/, k);
    assert.match(read(`ko/${k}`), /<script src="\/assets\/logo-once\.js\?v=[0-9a-f]+"[^>]*><\/script>/, `${k}: the logo «Reveal + Wave»`);
    assert.equal(head(read(`ko/${k}`)).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1],
      head(read(`en/${k}`)).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1], `${k}: the English CSP`);
  }
  assert.match(read('ko/esim/thailand/index.html'), /data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]+"/, 'Expressive on a country page');
});

test('the Korean destination list: 198 destinations under their initial consonant (ㄱ…ㅎ), every jump letter lands', () => {
  const html = read('ko/esim/index.html');
  const sections = [...html.matchAll(/<section class="az-group" id="az-([a-z0-9-]+)"[\s\S]*?<h2 id="azh-\1">([^<]+)<\/h2>([\s\S]*?)<\/section>/g)];
  const names = sections.flatMap((m) => [...m[3].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => [m[2], decode(x[1])]));
  assert.equal(names.length, 198);
  const jumps = [...html.matchAll(/<a href="#az-([a-z0-9-]+)" data-letter="[^"]+">/g)].map((m) => m[1]);
  assert.deepEqual(jumps, sections.map((m) => m[1]));
  const at = (n) => names.find(([, x]) => x === n)?.[0];
  assert.equal(at('일본'), 'ㅇ'); assert.equal(at('미국'), 'ㅁ'); assert.equal(at('태국'), 'ㅌ'); assert.equal(at('대한민국'), 'ㄷ');
  for (const [letter] of names) assert.match(letter, /^[ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ]$/, letter);
});

/* ------------------------------------------------------------------ 3. Korean only */

const KEEP = new Set(['magic', 'esim', 'sim', 'iphone', 'ios', 'android', 'google', 'pixel', 'samsung', 'galaxy', 'apple',
  'one', 'ui', 'qr', 'apn', 'eid', 'embedded', 'identity', 'document', 'usd', 'us', 'gb', 'mb', 'kbps', 'mbps', 'gbps', 'ip',
  'support', 'magicesim', 'store', 'javascript', 'wi', 'fi',
  // the seller's own name in the footer, as the Korean Terms §1 print it (a person's legal name is never translated)
  'aleksandr', 'kharin']);
const latin = (s) => (String(s).toLowerCase().match(/[a-z]+/g) || []);

test('Korean only: no English word (beyond brands, products and units), no Russian, no Chinese character on the 206 pages', () => {
  const hits = new Set();
  for (const rel of KO_SITE_PAGES) for (const run of readable(read(rel))) {
    if (/[А-Яа-яЁё]/.test(run)) hits.add(`${rel}: Russian «${run.slice(0, 60)}»`);
    if (/\p{Script=Han}/u.test(run)) hits.add(`${rel}: Chinese character «${run.slice(0, 60)}»`);
    for (const w of latin(run)) if (w.length > 1 && !KEEP.has(w)) hits.add(`${rel}: «${w}» in «${run.slice(0, 60)}»`);
  }
  assert.deepEqual([...hits].slice(0, 20), []);
});

test('the claim rules (seo/claim-guards.mjs, ko, hanWord) hold on every Korean page of its kind', () => {
  const kindOf = (rel) => (rel === 'ko/index.html' ? 'home' : /^ko\/guides\/[^/]+\/index\.html$/.test(rel) ? 'guide'
    : /^ko\/esim\/[^/]+\/index\.html$/.test(rel) ? 'country' : null);
  const hits = [];
  for (const rel of KO_PAGES) {
    const kind = kindOf(rel); if (!kind) continue;
    const text = readable(read(rel)).join('\n');
    for (const [id, re] of rulesFor('ko', kind)) { const m = text.match(re); if (m) hits.push(`${rel}: ${id} «${m[0]}»`); }
  }
  assert.deepEqual(hits, []);
});

/* ------------------------------------------------------------------ 4. numbers */

test('prices are «US$12.99» (Intl ko, symbol — owner D2), never ₩; the other languages unchanged', () => {
  const fmt = (lang, n) => {
    const I = SITE.createI18n(lang);
    return new Intl.NumberFormat(I.t('fmt.numberLocale'), { style: 'currency', currency: 'USD', currencyDisplay: I.t('fmt.currencyDisplay'),
      minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/\s/g, ' ');
  };
  assert.equal(fmt('ko', 12.99), 'US$12.99');
  assert.equal(fmt('ko', 1234.5), 'US$1,234.50');
  for (const [l, want] of [['en', '$12.99'], ['es', 'USD 12.99'], ['de', '12,99 USD'], ['fr', '12,99 USD'], ['zh-Hans', 'US$12.99']]) assert.equal(fmt(l, 12.99), want, l);
  for (const rel of KO_PAGES) assert.doesNotMatch(read(rel), /₩|KRW|원화/, rel);
});

test('data «1.5GB» and days «3일» (digits attached, D6); one plural form; the daily lines in Korean', () => {
  const I = SITE.createI18n('ko');
  assert.equal(DAILY.formatAllowance(1.5, 'ko'), '1.5GB');
  assert.equal(DAILY.formatAllowance(0.49, 'ko'), '500MB');
  assert.equal(DAILY.formatAllowance(1.5, 'en'), '1.5 GB', 'English keeps its space (unitSpace is Korean only)');
  assert.equal(I.plural('plan.dayCount', 1, { n: 1 }), '1일');
  assert.equal(I.plural('plan.dayCount', 7, { n: 7 }), '7일');
  assert.equal(I.t('plan.gb', { n: 5 }), '5GB');
  const sample = { plan_type: 'DAILY', daily_gb: 1.5, daily_throttle_label: '512 Kbps', daily_reset_confirmed: true, daily_term_mode: 'FIXED_TERM', validity_days: 3 };
  assert.equal(DAILY.lines(sample, 'ko').map((l) => l.text).join(' | '),
    '하루 1.5GB까지 최대 속도 | 이후 최대 512Kbps | 데이터 제공량은 24시간마다 초기화됩니다 | 이용 기간: 3일');
  assert.equal(SITE.pathPrefix('ko'), '/ko');
});

/* ------------------------------------------------------------------ 5. titles, typography, particles */

test('titles fit the 60-unit display width (Hangul = 2); descriptions 40–160 units; one H1', () => {
  for (const rel of KO_PAGES) {
    const html = read(rel);
    const title = decode(html.match(/<title>([^<]*)<\/title>/)[1]);
    assert.ok(displayWidth(title) <= TITLE_MAX, `${rel}: width ${displayWidth(title)} «${title}»`);
    const desc = decode(html.match(/<meta name="description" content="([^"]*)"/)[1]);
    assert.ok(displayWidth(desc) <= 160 && displayWidth(desc) >= 40, `${rel}: description width ${displayWidth(desc)}`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${rel}: one H1`);
  }
  assert.match(read('ko/esim/thailand/index.html'), /<title>태국 eSIM: 미국 달러 데이터 요금제 \| Magic eSIM<\/title>/);
  assert.match(read('ko/esim/japan/index.html'), /<h1>일본 eSIM<\/h1>/);
});

/** Korean typography faults (D6): a space before . , ? ! : ;, full-width punctuation, a Chinese character, ASCII quotes. */
function typoFaults(run) {
  const f = [];
  if (/\s[.,?!:;](?!\d)/.test(run)) f.push('space before punctuation');
  if (/[，。：；？！、（）]/.test(run)) f.push('full-width punctuation');
  if (/\p{Script=Han}/u.test(run)) f.push('Chinese character');
  if (/"[^"]*\p{Script=Hangul}[^"]*"/u.test(run)) f.push('ASCII quotes around Korean');
  return f;
}

/** The particle after a Latin word follows its Korean reading: eSIM (…엠), iPhone (…폰) take 을/은/이/과/으로;
 *  Android (…드) takes 를/는/가/와/로. */
function particleFaults(run) {
  const f = [];
  if (/(?:eSIM|iPhone)(?:를|는|가|와|로)(?![\p{Script=Hangul}])/u.test(run)) f.push('wrong particle after eSIM/iPhone');
  if (/Android(?:을|은|이|과|으로)(?![\p{Script=Hangul}])/u.test(run)) f.push('wrong particle after Android');
  return f;
}

test('Korean typography (D6) and particles after Latin words on every Korean page and in every Korean source string', () => {
  const hits = [];
  for (const rel of KO_PAGES) for (const run of readable(read(rel))) for (const f of [...typoFaults(run), ...particleFaults(run)]) hits.push(`${rel}: ${f} — «${run.slice(0, 70)}»`);
  for (const [k, v] of Object.entries(KO)) if (!/^(fmt|lang)\./.test(k)) for (const f of [...typoFaults(v), ...particleFaults(v)]) hits.push(`ko ${k}: ${f}`);
  for (const g of KO_GUIDES) for (const [i, s] of g.sections.entries()) {
    for (const f of [...typoFaults(s.html.replace(/<[^>]+>/g, '')), ...particleFaults(s.html.replace(/<[^>]+>/g, ''))]) hits.push(`guide ${g.slug} §${i + 1}: ${f}`);
  }
  assert.deepEqual([...new Set(hits)].slice(0, 20), []);
});

/* D15: after a variable name only particles that do not depend on its last syllable. Read every template with three
 * real names — vowel-final, consonant-final, long — and the dictionary's {name}/{names} strings as written. */
const VARIABLE = /(?:을|를|이|가|은|는|와|과|으로|로)(?![\p{Script=Hangul}])/u;
test('D15: no syllable-dependent particle after a country name — templates read with 이탈리아, 일본 and 보스니아 헤르체고비나', () => {
  const hits = [];
  for (const [k, fn] of Object.entries(C).filter(([, v]) => typeof v === 'function')) {
    for (const name of ['이탈리아', '일본', '보스니아 헤르체고비나']) {
      const out = String(fn(name));
      const after = out.split(name).slice(1);
      for (const a of after) if (VARIABLE.test(a.slice(0, 2)) && !/^\s/.test(a)) hits.push(`PAGE_COPY.ko.${k}(«${name}»): «${name}${a.slice(0, 6)}»`);
    }
  }
  for (const [k, v] of Object.entries(KO)) for (const m of String(v).matchAll(/\{(name|names)\}(.{0,3})/gu)) {
    if (VARIABLE.test(m[2]) && !/^\s/.test(m[2])) hits.push(`ko ${k}: «{${m[1]}}${m[2]}»`);
  }
  assert.deepEqual(hits, []);
});

test('the typography and particle checks can fire', () => {
  assert.deepEqual(typoFaults('어디로 떠나시나요 ?'), ['space before punctuation']);
  assert.deepEqual(typoFaults('설치하세요。'), ['full-width punctuation']);
  assert.deepEqual(typoFaults('日本 eSIM'), ['Chinese character']);
  assert.deepEqual(typoFaults('이름을 "여행"으로'), ['ASCII quotes around Korean']);
  assert.deepEqual(particleFaults('eSIM를 설치하세요'), ['wrong particle after eSIM/iPhone']);
  assert.deepEqual(particleFaults('iPhone는'), ['wrong particle after eSIM/iPhone']);
  assert.deepEqual(particleFaults('Android을'), ['wrong particle after Android']);
  assert.deepEqual(particleFaults('eSIM을 설치하고 iPhone에서, Android에서 eSIM으로'), []);
  assert.ok(VARIABLE.test('을 '), 'the particle rule can fire');
});

/* ------------------------------------------------------------------ 6. search engines */

test('noindex until the owner opens Korean (D11): every page noindex, self-canonical, no hreflang, out of the sitemap', () => {
  assert.equal(locale('ko').site.enabled, true);
  assert.equal(locale('ko').site.indexableHome, false);
  assert.equal(locale('ko').app.enabled, true, 'the Mini App speaks Korean since MINIAPP-I18N-LEGAL-1 (owner, 2026-10-23)');
  assert.doesNotMatch(read('sitemap.xml'), /magicesim\.store\/ko\//);
  for (const rel of KO_PAGES) {
    const h = head(read(rel));
    const url = `https://magicesim.store/${rel.replace(/index\.html$/, '')}`;
    assert.match(h, /<meta name="robots" content="noindex, follow">/, rel);
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), `${rel}: canonical`);
    assert.doesNotMatch(h, /rel="alternate"[^>]*hreflang/, `${rel}: an hreflang alternate`);
  }
  for (const rel of ['index.html', 'esim/thailand/index.html', 'en/index.html', 'en/esim/thailand/index.html', 'es/index.html', 'zh/index.html', 'iphone.html']) {
    assert.doesNotMatch(head(read(rel)), /hreflang="ko"/, `${rel}: no Korean alternate`);
  }
  assert.doesNotMatch(read('robots.txt'), /^Disallow:\s*\/ko\//m);
});

/* ------------------------------------------------------------------ 7. legal links (D8) */

test('D8: no Korean page links a Russian document or a page that does not exist; only the published English documents (LEGAL-1)', () => {
  assert.equal(LEGAL_SCHEME.ko, 'international');
  // LEGAL-1 (#127) published the English Privacy Policy; terms and refund are not published yet
  const links = legalLinks('ko');
  assert.deepEqual(links.map((l) => [l.key, l.href, l.hreflang]), Object.entries(INTL_LEGAL).filter(([, v]) => v).map(([k, v]) => [`footer.${k}`, v, 'en']));
  for (const l of links) assert.ok(existsSync(join(ROOT, l.href.slice(1), 'index.html')), `${l.href} is a published page`);
  for (const rel of KO_PAGES) {
    const h = read(rel);
    assert.doesNotMatch(h, /href="\/(terms|privacy)\.html"/, `${rel}: a Russian legal document`);
    if (!INTL_LEGAL.terms) assert.ok(!h.includes(KO['footer.terms']), `${rel}: names terms that are not published`);
    // LEGAL-4: the Korean translation of the published Privacy Policy (seo/legal-i18n/ko.mjs), at /ko/privacy/.
    if (INTL_LEGAL.privacy) assert.ok(h.includes(`<a href="/ko/privacy/" hreflang="ko" data-i18n="footer.privacy">${KO['footer.privacy']}</a>`), `${rel}: the Korean Privacy Policy`);
  }
});

/* ------------------------------------------------------------------ 8. sources */

test('the Korean guides name their vendor sources and their date; bold labels are the sourced ones; Samsung QR never quoted', () => {
  const src = read('seo/guides-ko.mjs');
  for (const s of ['support.apple.com/ko-kr/118669', '/ko-kr/118227', '/ko-kr/109317', '/ko-kr/HT201415',
    'pixelphone/answer/16115470?hl=ko', '9449293', '2926415', '10402530', 'samsungsvc.co.kr/solution/1071978', '2026-10-22']) assert.ok(src.includes(s), s);
  const header = src.slice(0, src.indexOf('export const'));
  const NOT_LABELS = /^(Google Pixel|Samsung Galaxy|다른 브랜드|Samsung|Pixel|iPhone|Android|eSIM을 삭제하지 마세요|EID)\s*:?$/u;
  for (const g of KO_GUIDES) {
    const bold = g.sections.flatMap((s) => [...s.html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]))
      .filter((b) => !NOT_LABELS.test(b) && !/[?.]$/.test(b) && !['설치', '회선 켜기', '모바일 데이터용으로 선택', '데이터 로밍 켜기', '비행기 탑승 모드를 켜고', '출발 당일에 eSIM을 설치하고', 'APN을 확인하세요.'].includes(b))
      .flatMap((b) => b.split(' → '));
    for (const b of bold) assert.ok(header.includes(b), `${g.slug}: «${b}» is not among the sourced labels`);
    for (const s of g.sections) assert.doesNotMatch(s.html, /<strong>(QR 코드 스캔|활성화 코드 입력)<\/strong>/, `${g.slug}: a Samsung label no Korean Samsung page names`);
  }
});

/* ------------------------------------------------------------------ 9. names and fonts */

test('names (D5): CLDR + the owner\'s overrides; the popular list in the names the site prints; no two countries share one', () => {
  assert.equal(countryName('ZA', 'ko'), '남아프리카 공화국');
  assert.equal(countryName('CF', 'ko'), '중앙아프리카공화국');
  assert.equal(countryName('DO', 'ko'), '도미니카공화국');
  assert.equal(countryName('KR', 'ko'), '대한민국');
  assert.equal(countryName('TW', 'ko'), '대만');
  assert.equal(countryName('HK', 'ko'), '홍콩');
  for (const p of C.popular) assert.equal(p.name, countryName(p.iso, 'ko'), p.iso);
  const names = Object.keys(COUNTRY_NAMES).map((iso) => countryName(iso, 'ko'));
  assert.equal(new Set(names).size, names.length);
});

test('fonts and line breaking (D6/D15): the Korean rule is scoped to <html lang="ko">, system fonts, keep-all; nothing else moved', () => {
  const css = read('en/en.css');
  assert.match(css, /html:lang\(ko\) \{ --font: "Inter", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Noto Sans CJK KR", ui-sans-serif, system-ui, sans-serif; \}/);
  assert.match(css, /html:lang\(ko\) body \{ word-break: keep-all; overflow-wrap: anywhere; \}/);
  assert.match(css, /html:lang\(ko\) :is\(h1, h2, h3, h4, \.price\) \{ letter-spacing: 0; \}/);
  assert.equal((css.match(/html:lang\(ko\)/g) || []).length, 3, 'the three rules, nothing else');
  assert.doesNotMatch(read('assets/site.css'), /lang\(ko\)|Malgun|Apple SD Gothic/, 'the shared stylesheet is untouched');
  assert.doesNotMatch(css, /@font-face[^}]*(Malgun|Noto Sans KR|Apple SD)/, 'no Korean web font is downloaded');
});
