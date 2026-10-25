/* The Simplified Chinese site, /zh/ (I18N ZH-1, 2026-10-22): complete, in Chinese, the English design, noindex.
 *
 *   1. Every source has every key English has; the guides mirror the English ones (plus the one mainland section, D12).
 *      The generator's output is the committed tree.
 *   2. The same design: every page kind's markup skeleton equals the English one; the destination list by pinyin initial.
 *   3. Chinese only: no English-only word, no Russian on the 207 pages; the claim rules (hanWord, T1) hold.
 *   4. Prices «US$12.99» (D2); data in GB/MB; one plural form.
 *   5. Titles fit the 60-unit DISPLAY WIDTH budget (T2); Chinese typography (D6).
 *   6. Search engines (D11): every page noindex, self-canonical, no hreflang, out of the sitemap.
 *   7. Legal links (D8): no Russian document is linked; the English LEGAL documents only once published — none yet.
 *   8. Mainland China (D12): Apple's sourced facts on the Chinese compatibility guide only; nothing on another language.
 *   9. Sources: the guides quote only labels read on the vendors' Simplified Chinese pages. 10. Fonts (T3).
 *
 * Run: node --test seo/test-zh-site.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGE_COPY, TITLE_MAX, displayWidth } from './page-copy.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { ZH_GUIDES } from './guides-zh.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { countryName } from './country-names-i18n.mjs';
import { localeGenerator } from './build-locale-pages.mjs';
import { stampHtml } from './asset-version.mjs';
import { locale } from './locales.mjs';
import { rulesFor, withoutSourced } from './claim-guards.mjs';
import { legalLinks, INTL_LEGAL, LEGAL_SCHEME } from './legal-links.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const DAILY = require(join(ROOT, 'assets/daily-plan-copy.js'));
const ZH = SITE.DICT['zh-Hans'];
const C = PAGE_COPY['zh-Hans'];

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
const ZH_PAGES = htmlUnder('zh');
// LEGAL-4: the three translated legal documents (/zh/terms|refund|privacy/) are pages of this language too; their
// fidelity to the English — which keeps proper names, the seller's Latin address and foreign law titles in English —
// is held by seo/test-legal-i18n.mjs, so the «Chinese only» word scan reads the 207 site pages without them.
const ZH_LEGAL = /^zh\/(terms|refund|privacy)\/index\.html$/;
const ZH_SITE_PAGES = ZH_PAGES.filter((rel) => !ZH_LEGAL.test(rel));
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

test('207 Chinese pages: the home, the list, 199 countries, the guides list and five guides', () => {
  assert.equal(ZH_SITE_PAGES.length, 207);
  assert.equal(ZH_PAGES.length, 210, '+ the three legal documents (LEGAL-4)');
  assert.equal(ZH_PAGES.filter((p) => /^zh\/esim\/[^/]+\/index\.html$/.test(p)).length, 199);
  assert.equal(htmlUnder('en').length, ZH_PAGES.length, 'the same pages as English, the three legal documents included (LEGAL-4)');
});

test('every source has every key English has, and no other; the same {placeholders}; one plural form', () => {
  assert.deepEqual(Object.keys(ZH).sort(), Object.keys(SITE.DICT.en).sort(), 'assets/i18n/zh-Hans.js');
  assert.deepEqual(Object.keys(C).sort(), Object.keys(PAGE_COPY.en).sort(), 'seo/page-copy.mjs');
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const [k, v] of Object.entries(SITE.DICT.en)) assert.deepEqual(ph(ZH[k]), ph(v), `${k}: the same {placeholders}`);
  for (const k of Object.keys(ZH).filter((x) => x.endsWith('.one'))) assert.equal(ZH[k], ZH[k.replace(/\.one$/, '.other')], `${k}: Chinese has one form`);
  assert.deepEqual(new Intl.PluralRules('zh-Hans').resolvedOptions().pluralCategories, ['other']);
  assert.ok(DAILY.LANGS.includes('zh-Hans'), 'the daily-plan table');
  assert.equal(ZH['lang.ru'], 'Русский');
});

test('the Chinese guides mirror the English ones: slugs, sections (+ the mainland section, D12), questions, related, links', () => {
  assert.deepEqual(ZH_GUIDES.map((g) => g.slug), EN_GUIDES.map((g) => g.slug));
  const links = (g) => g.sections.flatMap((s) => [...s.html.matchAll(/href="(\/[^"]+)"/g)].map((m) => m[1].replace(/^\/(en|zh)\//, '/L/')));
  for (const [i, zh] of ZH_GUIDES.entries()) {
    const en = EN_GUIDES[i];
    const sections = zh.sections.filter((s) => s.id !== 'mainland');
    assert.equal(sections.length, en.sections.length, `${zh.slug}: sections`);
    assert.equal(zh.faq.length, en.faq.length, `${zh.slug}: questions`);
    assert.deepEqual(zh.related, en.related, `${zh.slug}: related`);
    assert.deepEqual(links({ sections }), links(en), `${zh.slug}: the same internal links, in Chinese`);
    for (const s of zh.sections) assert.match(s.id || '', /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${zh.slug}: «${s.h2}» names an ASCII anchor`);
  }
  assert.deepEqual(ZH_GUIDES.flatMap((g) => g.sections.filter((s) => s.id === 'mainland').map(() => g.slug)), ['compatibility']);
});

test('Chinese built through the locale generator equals the committed pages, byte for byte', () => {
  const G = localeGenerator('zh-Hans');
  const list = G.countries();
  assert.equal(list.length, 199);
  const drift = [];
  const same = (html, rel) => stampHtml(html, join(ROOT, dirname(rel))) === read(rel);
  if (!same(G.homePage(list), 'zh/index.html')) drift.push('zh/');
  for (const c of list) if (!same(G.countryPage(c), `zh/esim/${c.slug}/index.html`)) drift.push(c.slug);
  if (!same(G.hubPage(list), 'zh/esim/index.html')) drift.push('zh/esim/');
  for (const g of ZH_GUIDES) if (!same(G.guidePage(g), `zh/guides/${g.slug}/index.html`)) drift.push(`guide ${g.slug}`);
  if (!same(G.guidesHub(), 'zh/guides/index.html')) drift.push('zh/guides/');
  if (G.destinationsJs(list) !== read('zh/destinations.js')) drift.push('zh/destinations.js');
  assert.deepEqual(drift, []);
});

/* ------------------------------------------------------------------ 2. the same design */

function skeleton(html) {
  const body = html.slice(html.indexOf('<body'))
    .replace(/<script[\s\S]*?<\/script>/g, '<script>')
    .replace(/<svg[\s\S]*?<\/svg>/g, '<svg>')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ul class="langmenu-list">[\s\S]*?<\/ul>/g, '<ul class="langmenu-list">')
    .replace(/(<nav class="hub-az"[^>]*>)[\s\S]*?<\/nav>/g, '$1</nav>')
    .replace(/(<div class="hub-list" id="hubList">)[\s\S]*?(<div class="hub-empty")/g, '$1</div>$2')
    // D8: the Chinese footer has no legal line until the English documents are published
    .replace(/<p><a href="\/terms\.html"[\s\S]*?<\/p>/g, '');
  return [...body.matchAll(/<([a-z0-9]+)\b([^>]*)>/g)].filter((m) => m[1] !== 'strong' && m[1] !== 'br').map((m) => {
    const cls = (m[2].match(/\sclass="([^"]*)"/) || [, ''])[1];
    return cls ? `${m[1]}.${cls.split(/\s+/).join('.')}` : m[1];
  }).join(' ');
}

test('the same design: every page kind has the English markup skeleton (tags and classes, in order)', () => {
  const kinds = ['index.html', 'esim/index.html', 'esim/thailand/index.html', 'esim/japan/index.html', 'esim/uae/index.html',
    'esim/peru/index.html', 'esim/turkey/index.html', 'guides/index.html',
    ...EN_GUIDES.filter((g) => g.slug !== 'compatibility').map((g) => `guides/${g.slug}/index.html`)];
  for (const k of kinds) assert.equal(skeleton(read(`zh/${k}`)), skeleton(read(`en/${k}`)), k);
  const assets = (h) => [...h.matchAll(/(?:href|src)="(\/[^"?]+\.(?:css|js))(?:\?v=[0-9a-f]+)?"/g)].map((m) => m[1].replace(/^\/(en|zh)\/destinations\.js$/, 'DEST').replace(/country-names-(en|zh)\.js$/, 'NAMES').replace(/site-i18n-(en|zh)\.js$/, 'WORDS'));
  for (const k of ['index.html', 'esim/thailand/index.html', 'esim/index.html', 'guides/iphone/index.html']) {
    assert.deepEqual(assets(read(`zh/${k}`)), assets(read(`en/${k}`)), `${k}: the same assets`);
  }
  assert.match(head(read('zh/index.html')), /<meta property="og:locale" content="zh_CN">/, 'the home names its locale (D10)');
  for (const k of ['index.html', 'esim/thailand/index.html', 'guides/iphone/index.html']) {
    assert.match(read(`zh/${k}`), /<html lang="zh-Hans"/, k);
    assert.match(read(`zh/${k}`), /<script src="\/assets\/logo-once\.js\?v=[0-9a-f]+"[^>]*><\/script>/, `${k}: the logo «Reveal + Wave»`);
    assert.equal(head(read(`zh/${k}`)).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1],
      head(read(`en/${k}`)).match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1], `${k}: the English CSP`);
  }
  assert.match(read('zh/esim/thailand/index.html'), /data-motion-src="\/assets\/motion\.js\?v=[0-9a-f]+"/, 'Expressive on a country page');
});

test('the Chinese destination list: 199 destinations under their pinyin initial, every jump letter lands', () => {
  const html = read('zh/esim/index.html');
  const sections = [...html.matchAll(/<section class="az-group" id="az-([a-z]+)"[\s\S]*?<h2 id="azh-\1">([^<]+)<\/h2>([\s\S]*?)<\/section>/g)];
  const names = sections.flatMap((m) => [...m[3].matchAll(/<span>([^<]+)<\/span>/g)].map((x) => [m[2], decode(x[1])]));
  assert.equal(names.length, 199);
  const jumps = [...html.matchAll(/<a href="#az-([a-z]+)" data-letter="([A-Z])">/g)].map((m) => m[1]);
  assert.deepEqual(jumps, sections.map((m) => m[1]));
  const at = (n) => names.find(([, x]) => x === n)?.[0];
  assert.equal(at('日本'), 'R'); assert.equal(at('美国'), 'M'); assert.equal(at('阿联酋'), 'A'); assert.equal(at('秘鲁'), 'B', '秘鲁 is Bìlǔ');
  assert.equal(at('中国香港'), 'Z'); assert.equal(at('埃斯瓦蒂尼'), 'A');
});

/* ------------------------------------------------------------------ 3. Chinese only */

const KEEP = new Set(['magic', 'esim', 'sim', 'iphone', 'ios', 'android', 'google', 'pixel', 'samsung', 'galaxy', 'apple', 'app',
  'one', 'ui', 'qr', 'apn', 'eid', 'usd', 'us', 'gb', 'mb', 'kbps', 'mbps', 'gbps', 'ip', 'support', 'magicesim', 'store',
  'javascript', 'pro', 'max', 'duo', 'air', 'wi', 'fi']);
// single letters are the list's pinyin initials (A–Z)
const latin = (s) => (String(s).toLowerCase().match(/[a-z]+/g) || []);

test('Chinese only: no English word (beyond brands, products and units) and no Russian on any of the 207 pages', () => {
  const hits = new Set();
  for (const rel of ZH_SITE_PAGES) for (const run of readable(read(rel))) {
    if (/[А-Яа-яЁё]/.test(run)) hits.add(`${rel}: Russian «${run.slice(0, 60)}»`);
    for (const w of latin(run)) if (w.length > 1 && !KEEP.has(w)) hits.add(`${rel}: «${w}» in «${run.slice(0, 60)}»`);
  }
  assert.deepEqual([...hits].slice(0, 20), []);
});

test('the claim rules (seo/claim-guards.mjs, zh-Hans, hanWord) hold on every Chinese page of their kind', () => {
  const kindOf = (rel) => (rel === 'zh/index.html' ? 'home' : /^zh\/guides\/[^/]+\/index\.html$/.test(rel) ? 'guide'
    : /^zh\/esim\/[^/]+\/index\.html$/.test(rel) ? 'country' : null);
  const hits = [];
  for (const rel of ZH_PAGES) {
    const kind = kindOf(rel); if (!kind) continue;
    const text = withoutSourced('zh-Hans', rel.replace(/index\.html$/, ''), readable(read(rel)).join('\n'));
    for (const [id, re] of rulesFor('zh-Hans', kind)) { const m = text.match(re); if (m) hits.push(`${rel}: ${id} «${m[0]}»`); }
  }
  assert.deepEqual(hits, []);
});

/* ------------------------------------------------------------------ 4. numbers */

test('prices are «US$12.99» (Intl zh-Hans, symbol — owner D2); English, Spanish, German and French unchanged', () => {
  const fmt = (lang, n) => {
    const I = SITE.createI18n(lang);
    return new Intl.NumberFormat(I.t('fmt.numberLocale'), { style: 'currency', currency: 'USD', currencyDisplay: I.t('fmt.currencyDisplay'),
      minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/\s/g, ' ');
  };
  assert.equal(fmt('zh-Hans', 12.99), 'US$12.99');
  assert.equal(fmt('zh-Hans', 1234.5), 'US$1,234.50');
  assert.equal(fmt('en', 12.99), '$12.99');
  assert.equal(fmt('es', 12.99), 'USD 12.99');
  assert.equal(fmt('de', 12.99), '12,99 USD');
  assert.equal(fmt('fr', 12.99), '12,99 USD');
});

test('data in GB/MB with a decimal point; one plural form; the daily lines in Chinese', () => {
  const I = SITE.createI18n('zh-Hans');
  assert.equal(DAILY.formatAllowance(1.5, 'zh-Hans'), '1.5 GB');
  assert.equal(I.plural('plan.dayCount', 1, { n: 1 }), '1 天');
  assert.equal(I.plural('plan.dayCount', 7, { n: 7 }), '7 天');
  assert.equal(I.plural('hub.matches', 3, { n: 3 }), '找到 3 个目的地');
  const sample = { plan_type: 'DAILY', daily_gb: 1.5, daily_throttle_label: '512 Kbps', daily_reset_confirmed: true, daily_term_mode: 'FIXED_TERM', validity_days: 3 };
  assert.equal(DAILY.lines(sample, 'zh-Hans').map((l) => l.text).join(' | '),
    '每天 1.5 GB 全速流量 | 之后最高 512 Kbps | 流量每 24 小时重置 | 有效期：3 天');
  assert.equal(SITE.pathPrefix('zh-Hans'), '/zh');
});

/* ------------------------------------------------------------------ 5. titles and typography */

test('titles fit the 60-unit display width (T2) — a Chinese character counts 2; descriptions 40–160 units', () => {
  assert.equal(displayWidth('日本 eSIM'), 9);
  assert.equal(displayWidth('eSIM for Japan — data plans in US dollars | Magic eSIM'), 'eSIM for Japan — data plans in US dollars | Magic eSIM'.length, 'Latin: width = length');
  for (const rel of ZH_PAGES) {
    const title = decode(read(rel).match(/<title>([^<]*)<\/title>/)[1]);
    assert.ok(displayWidth(title) <= TITLE_MAX, `${rel}: width ${displayWidth(title)} «${title}»`);
    const desc = decode(read(rel).match(/<meta name="description" content="([^"]*)"/)[1]);
    assert.ok(displayWidth(desc) <= 160 && displayWidth(desc) >= 40, `${rel}: description width ${displayWidth(desc)}`);
  }
  assert.match(read('zh/esim/thailand/index.html'), /<title>泰国 eSIM：美元计价的流量套餐 \| Magic eSIM<\/title>/);
  assert.match(read('zh/esim/japan/index.html'), /<h1>日本 eSIM<\/h1>/);
});

/** Chinese typography faults (D6): half-width punctuation next to Chinese, a missing space between Chinese and a Latin
 *  letter or digit, a space next to full-width punctuation, ASCII quotes around Chinese. */
function typoFaults(run) {
  const f = [];
  if (/\p{Script=Han}[,;:!?]|[,;:!?](?=\p{Script=Han})|\p{Script=Han}\.(?!\d)/u.test(run)) f.push('half-width punctuation next to Chinese');
  if (/\p{Script=Han}[A-Za-z0-9]|[A-Za-z0-9]\p{Script=Han}/u.test(run)) f.push('no space between Chinese and Latin/digit');
  if (/ [，。：；？！、）]|[，。：；？！、（] /u.test(run)) f.push('space next to full-width punctuation');
  if (/"[^"]*\p{Script=Han}[^"]*"/u.test(run)) f.push('ASCII quotes around Chinese');
  return f;
}

test('Chinese typography (D6) on every Chinese page and in every Chinese source string', () => {
  const hits = [];
  for (const rel of ZH_PAGES) for (const run of readable(read(rel))) for (const f of typoFaults(run)) hits.push(`${rel}: ${f} — «${run.slice(0, 70)}»`);
  for (const [k, v] of Object.entries(ZH)) if (!/^(fmt|lang)\./.test(k)) for (const f of typoFaults(v)) hits.push(`zh-Hans ${k}: ${f}`);
  // the guides' HTML with the tags taken out: text and a link next to it («请见<a>eSIM…») meet on screen with no space,
  // which the rendered runs (split at the tag) cannot see
  for (const g of ZH_GUIDES) for (const [i, sct] of g.sections.entries()) for (const f of typoFaults(sct.html.replace(/<[^>]+>/g, ''))) hits.push(`guide ${g.slug} §${i + 1}: ${f} (across a tag)`);
  assert.deepEqual([...new Set(hits)].slice(0, 20), []);
});

test('the typography check can fire', () => {
  assert.deepEqual(typoFaults('您要去哪里?'), ['half-width punctuation next to Chinese']);
  assert.deepEqual(typoFaults('安装eSIM'), ['no space between Chinese and Latin/digit']);
  assert.deepEqual(typoFaults('等待 1到3 分钟'), ['no space between Chinese and Latin/digit']);
  assert.deepEqual(typoFaults('选择目的地 ，安装'), ['space next to full-width punctuation']);
  assert.deepEqual(typoFaults('起一个名称，例如"旅行"'), ['ASCII quotes around Chinese']);
  assert.deepEqual(typoFaults('安装 eSIM，等待 1 到 3 分钟。名称例如“旅行”'), []);
});

/* ------------------------------------------------------------------ 6. search engines */

test('noindex until the owner opens Chinese (D11): every page noindex, self-canonical, no hreflang, out of the sitemap', () => {
  assert.equal(locale('zh-Hans').site.enabled, true);
  assert.equal(locale('zh-Hans').site.indexableHome, false);
  assert.equal(locale('zh-Hans').app.enabled, true, 'the Mini App speaks Simplified Chinese since MINIAPP-I18N-LEGAL-1 (owner, 2026-10-23)');
  assert.doesNotMatch(read('sitemap.xml'), /magicesim\.store\/zh\//);
  for (const rel of ZH_PAGES) {
    const h = head(read(rel));
    const url = `https://magicesim.store/${rel.replace(/index\.html$/, '')}`;
    assert.match(h, /<meta name="robots" content="noindex, follow">/, rel);
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), `${rel}: canonical`);
    assert.doesNotMatch(h, /rel="alternate"[^>]*hreflang/, `${rel}: an hreflang alternate`);
  }
  for (const rel of ['index.html', 'esim/thailand/index.html', 'en/index.html', 'en/esim/thailand/index.html', 'es/index.html', 'iphone.html']) {
    assert.doesNotMatch(head(read(rel)), /hreflang="zh-Hans"/, `${rel}: no Chinese alternate`);
  }
  assert.doesNotMatch(read('robots.txt'), /^Disallow:\s*\/zh\//m);
});

/* ------------------------------------------------------------------ 7. legal links (D8) */

test('D8 + LEGAL-1 + LEGAL-3 + LEGAL-4: no international page links a Russian document; every Chinese page links the Chinese Terms, Refund and Privacy', () => {
  for (const l of ['en', 'es', 'de', 'fr', 'zh-Hans', 'ko']) assert.equal(LEGAL_SCHEME[l], 'international', l);
  assert.deepEqual(INTL_LEGAL, { terms: '/en/terms/', refund: '/en/refund/', privacy: '/en/privacy/' }, 'LEGAL-1 published Privacy; LEGAL-3 Terms and Refund');
  assert.deepEqual(legalLinks('zh-Hans').map((l) => [l.key, l.href, l.hreflang]), [['footer.terms', '/en/terms/', 'en'], ['footer.refund', '/en/refund/', 'en'], ['footer.privacy', '/en/privacy/', 'en']]);
  assert.throws(() => legalLinks('zh-Hans', { terms: '/legal/terms/', refund: null, privacy: null }), /not a published page/, 'never a link to a page that does not exist');
  for (const rel of ZH_PAGES) {
    const h = read(rel);
    assert.doesNotMatch(h, /href="\/(terms|privacy)\.html"/, `${rel}: a Russian legal document`);
    for (const k of ['terms', 'refund', 'privacy']) assert.ok(h.includes(`<a href="/zh/${k}/" hreflang="zh-Hans" data-i18n="footer.${k}">${ZH[`footer.${k}`]}</a>`), `${rel}: the Chinese ${k} document`);
  }
  const en = read('en/index.html');
  assert.ok(en.includes('<a href="/en/privacy/" hreflang="en" data-i18n="footer.privacy">Privacy Policy</a>'), 'English links its Privacy Policy');
  assert.doesNotMatch(en, /href="\/(terms|privacy)\.html"/, 'English no longer links the Russian documents');
});

/* ------------------------------------------------------------------ 8. mainland China (D12) */

test('D12: Apple\'s mainland facts are on the Chinese compatibility guide, sourced — and on no other language', () => {
  const html = read('zh/guides/compatibility/index.html');
  for (const s of ['iPhone 18 Pro、iPhone 18 Pro Max、iPhone Duo、iPhone 17e 和 iPhone Air', '在中国大陆，无法安装境外运营商提供的 eSIM',
    '请在入境前安装 eSIM', 'href="https://support.apple.com/zh-cn/123879"', '2026 年 9 月 9 日']) assert.ok(html.includes(s), s);
  const other = ['en', 'es', 'de', 'fr'].flatMap((l) => htmlUnder(l));
  for (const rel of other) assert.doesNotMatch(read(rel), /iPhone Air|iPhone Duo|support\.apple\.com\/[a-z-]+\/123879|中国大陆/, `${rel}: D12 is Chinese only`);
  // nothing on any Chinese page says which services work in mainland China
  // (the Terms translation keeps the English §9.1 «laws … on the use of VPNs» — a legal duty, not a claim about services)
  for (const rel of ZH_SITE_PAGES) assert.doesNotMatch(readable(read(rel)).join('\n'), /VPN|翻墙|科学上网|谷歌|Google 服务|WhatsApp/, rel);
});

/* ------------------------------------------------------------------ 9. sources, names, fonts */

test('the Chinese guides name their vendor sources and their date; bold labels are the sourced ones; Samsung is never quoted', () => {
  const src = read('seo/guides-zh.mjs');
  for (const s of ['support.apple.com/zh-cn/118669', '/zh-cn/118227', '/zh-cn/109317', '/zh-cn/HT201415', '/zh-cn/123879',
    'pixelphone/answer/16115470?hl=zh-Hans', '9449293', '2926415', '10402530', '2026-10-22']) assert.ok(src.includes(s), s);
  const header = src.slice(0, src.indexOf('export const'));
  const NOT_LABELS = /^(Google Pixel|Samsung Galaxy|其他品牌|Samsung|Pixel|iPhone|Android|请不要删除 eSIM|EID)\s*：?$/u;
  for (const g of ZH_GUIDES) {
    const bold = g.sections.flatMap((s) => [...s.html.matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]))
      .filter((b) => !NOT_LABELS.test(b) && !/[？。]$/.test(b) && !['安装', '开启号码', '设为移动数据卡', '开启数据漫游', '开启飞行模式', '重启手机。', '手动选择网络。', '检查 APN', '在出行当天安装 eSIM'].includes(b))
      .flatMap((b) => b.split(' → '));
    for (const b of bold) assert.ok(header.includes(b), `${g.slug}: «${b}» is not among the sourced labels`);
  }
  assert.match(header, /no Samsung page in Simplified Chinese/);
});

test('names (D5): the overrides the owner chose, and the popular list in the names the site prints', () => {
  assert.equal(countryName('AE', 'zh-Hans'), '阿联酋');
  assert.equal(countryName('SZ', 'zh-Hans'), '埃斯瓦蒂尼');
  assert.equal(countryName('HK', 'zh-Hans'), '中国香港');
  assert.equal(countryName('MO', 'zh-Hans'), '中国澳门');
  assert.equal(countryName('TW', 'zh-Hans'), '台湾');
  for (const p of C.popular) assert.equal(p.name, countryName(p.iso, 'zh-Hans'), p.iso);
  const names = Object.keys(COUNTRY_NAMES).map((iso) => countryName(iso, 'zh-Hans'));
  assert.equal(new Set(names).size, names.length, 'no two countries share a Chinese name');
});

test('fonts (T3): the Chinese rule is scoped to <html lang="zh-Hans">, system fonts only, no tighter tracking; nothing else moved', () => {
  const css = read('en/en.css');
  assert.match(css, /html:lang\(zh-Hans\) \{ --font: "Inter", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", ui-sans-serif, system-ui, sans-serif; \}/);
  assert.match(css, /html:lang\(zh-Hans\) :is\(h1, h2, h3, h4, \.price\) \{ letter-spacing: 0; \}/);
  assert.equal((css.match(/zh-Hans/g) || []).length, 2, 'the two rules, nothing else');
  assert.doesNotMatch(read('assets/site.css'), /zh|PingFang|YaHei/, 'the shared stylesheet is untouched');
  assert.doesNotMatch(css, /@font-face[^}]*(PingFang|Noto|Source Han)/, 'no Chinese web font is downloaded');
});
