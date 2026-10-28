/* The English guides (/en/guides/<slug>/): what they may say, how a crawler
 * is told to treat them, and that every link lands somewhere real.
 *
 * Run: node --test seo/test-en-guides.mjs
 */
import { rulesFor, RULES } from './claim-guards.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN_GUIDES } from './guides-en.mjs';
import { guidePage, guidesHub, GUIDE_RU } from './build-en-pages.mjs';
import { stampHtml } from './asset-version.mjs';
import { isIndexed, cluster } from './indexing.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const PAGES = EN_GUIDES.map((g) => ({ g, rel: `en/guides/${g.slug}/index.html` }))
  .concat([{ g: null, rel: 'en/guides/index.html' }]);
const html = (rel) => read(rel);
/** What a reader sees: no tags, no comments, no head. */
const prose = (h) => h.replace(/<head>[\s\S]*?<\/head>/, '').replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

/* ===================================================================== *
 * 1. The set, and the generator
 * ===================================================================== */

test('the five planned guides exist, each from the generator', () => {
  assert.deepEqual(EN_GUIDES.map((g) => g.slug), ['iphone', 'android', 'compatibility', 'activation', 'troubleshooting']);
  for (const { g, rel } of PAGES) {
    const want = g ? stampHtml(guidePage(g), join(ROOT, 'en/guides', g.slug)) : stampHtml(guidesHub(), join(ROOT, 'en/guides'));
    assert.equal(html(rel), want, `${rel}: run node seo/build-en-pages.mjs — never edit by hand`);
  }
});

test('build-all renders the guides (the Russian builder is the one build-all forgets)', () => {
  // I18N ES-1: build-all runs the locale generator for every published language (English included); build-en-pages.mjs
  // stays the English entry point, and builds English through the same generator, whose build() writes every guide.
  assert.match(read('seo/build-all.mjs'), /run\('build-locale-pages\.mjs'\)/);
  assert.match(read('seo/build-en-pages.mjs'), /EN\.build\(\)/);
  assert.match(read('seo/build-locale-pages.mjs'), /for \(const g of GUIDES\) write\(`\$\{base\}\/guides\/\$\{g\.slug\}\/index\.html`/);
  assert.match(read('seo/build-locale-pages.mjs'), /export const GUIDES_BY_LOCALE = Object\.freeze\(\{ en: EN_GUIDES, es: ES_GUIDES, de: DE_GUIDES, fr: FR_GUIDES, 'zh-Hans': ZH_GUIDES, ko: KO_GUIDES \}\);/);
});

/* ===================================================================== *
 * 2. How a crawler is told to treat them
 * ===================================================================== */

test('every guide is indexed with its cluster (I18N-09), self-canonical, with only a BreadcrumbList and no script', () => {
  const sitemap = read('sitemap.xml');
  for (const { g, rel } of PAGES) {
    const h = html(rel);
    const url = `https://magicesim.store/en/guides/${g ? `${g.slug}/` : ''}`;
    assert.match(h, /<html lang="en">/, rel);
    const page = g ? { kind: 'guide', slug: g.slug } : { kind: 'guides' };
    assert.match(h, /<meta name="robots" content="index, follow">/, rel);
    assert.equal((h.match(/<meta name="robots"/g) || []).length, 1, rel);
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), `${rel}: canonical is itself`);
    assert.equal((h.match(/<link[^>]*hreflang/g) || []).length, cluster(page).length, `${rel}: its hreflang cluster`);
    // Structured data: the BreadcrumbList of the visible crumbs only (SEO stage 6 O1, 2026-10-28; its content is checked
    // in seo/test-en-pages.mjs) — never FAQPage, HowTo or anything else. A JSON-LD block is data, not a script that runs.
    const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])['@type']);
    assert.deepEqual(ld, ['BreadcrumbList'], `${rel}: one BreadcrumbList, no other structured data`);
    // A guide runs no script — no network, no analytics. The one exception (owner, 2026-10-20) is the header logo's
    // start, assets/logo-once.js: one sessionStorage flag, no network (seo/test-logo-svg.mjs pins what it may do).
    assert.equal(/<script/i.test(h.replace(/<script src="\/assets\/logo-once\.js\?v=[0-9a-f]{8}"><\/script>/, '').replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')), false, `${rel}: a guide runs no script but the logo's start — no network, no analytics`);
    assert.equal(sitemap.includes(`<loc>${url}</loc>`), isIndexed('en', page), `${rel}: in the sitemap exactly when indexed`);
  }
});

test('the language switch goes to each guide\'s twin in every language, which exists', () => {
  for (const g of EN_GUIDES) {
    const ru = GUIDE_RU[g.slug];
    const file = ru.endsWith('/') ? `${ru.slice(1)}index.html` : ru.slice(1);
    assert.ok(existsSync(join(ROOT, file)), `${g.slug} → ${ru}`);
    const page = html(`en/guides/${g.slug}/index.html`);
    assert.ok(page.includes(`<li><a href="${ru}" hreflang="ru" lang="ru">`), `${g.slug}: the Russian twin`);
    assert.ok(page.includes(`<li><a href="/es/guides/${g.slug}/" hreflang="es" lang="es">`), `${g.slug}: the Spanish twin`);
    assert.ok(existsSync(join(ROOT, `es/guides/${g.slug}/index.html`)), `${g.slug}: es exists`);
  }
});

test('every link on a guide lands on a page that exists, and one into another language says which', () => {
  for (const { rel } of PAGES) {
    const h = html(rel);
    const links = [...h.matchAll(/<a\b[^>]*href="(\/[^"#?]*)"[^>]*>/g)];
    assert.ok(links.length >= 6, `${rel}: the scan must find the links`);
    for (const [tag, href] of links) {
      const file = href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1);
      assert.ok(existsSync(join(ROOT, file)), `${rel}: ${href} does not exist`);
      if (href.startsWith('/es/')) assert.match(tag, /hreflang="es"/, `${rel}: ${href} is Spanish and must say so`);
      else if (href.startsWith('/de/')) assert.match(tag, /hreflang="de"/, `${rel}: ${href} is German and must say so`);
      else if (href.startsWith('/fr/')) assert.match(tag, /hreflang="fr"/, `${rel}: ${href} is French and must say so`);
      else if (href.startsWith('/zh/')) assert.match(tag, /hreflang="zh-Hans"/, `${rel}: ${href} is Chinese and must say so`);
      else if (href.startsWith('/ko/')) assert.match(tag, /hreflang="ko"/, `${rel}: ${href} is Korean and must say so`);
      else if (!href.startsWith('/en/')) assert.match(tag, /hreflang="ru"/, `${rel}: ${href} is Russian and must say so`);
    }
  }
});

test('the English pages point at the English guides, not the Russian ones', () => {
  const home = read('en/index.html');
  for (const slug of ['compatibility', 'iphone', 'android']) assert.ok(home.includes(`href="/en/guides/${slug}/"`), slug);
  assert.equal(/href="\/(iphone|android)\.html"/.test(home), false, 'the home no longer sends readers to a Russian guide');
  assert.match(read('en/esim/uae/index.html'), /<a href="\/en\/guides\/">Guides<\/a>|data-i18n="nav.guides">Guides</);
});

/* ===================================================================== *
 * 3. What a guide may say
 * ===================================================================== */

// The rules live in seo/claim-guards.mjs — one table per language, the same ids (English moved there byte for byte).
const BANNED = rulesFor('en', 'guide').map(([id, re]) => [RULES[id].why, re]);

test('no guide says what this site cannot stand behind', () => {
  for (const { rel } of PAGES) {
    // The only Russian allowed is the language control's own name, «Русский»,
    // on the links that declare lang="ru" — cut out by element, not by word,
    // so the same word anywhere else on the page still fails.
    const page = html(rel);
    assert.equal((page.match(/<a [^>]*hreflang="ru" lang="ru"[^>]*>/g) || []).length, 2, `${rel}: the language switch, desktop and menu`);
    const text = prose(page.replace(/<a [^>]*lang="ru"[^>]*>[\s\S]*?<\/a>/g, ''));
    for (const [name, re] of BANNED) {
      const m = text.match(re);
      assert.equal(m, null, `${rel}: ${name} — «${m && m[0]}»`);
    }
    assert.equal(/[А-Яа-яЁё]{3,}/.test(text), false, `${rel}: Russian text on an English guide`);
  }
});

test('every banned-claim rule can fire', () => {
  // §26.1: a rule whose first test does not prove it fires proves nothing.
  const samples = ['Pay 950 ₽ by card', 'we will send the QR code to your email', 'see the Start of term row',
    'fast 5G everywhere', 'unlimited data with hotspot', 'works on iPhone 12 and later',
    'install it a few days before you fly', 'the QR code can be reused', 'our supplier eSIM Access'];
  BANNED.forEach(([name, re], i) => assert.match(samples[i], re, name));
  // …and the first rule does not fire inside «troubleshooting» (it once did).
  assert.doesNotMatch('eSIM troubleshooting', BANNED[0][1]);
  assert.match('Prices in roubles', BANNED[0][1]);
});

test('the start-of-term advice is the one that is safe for every plan', () => {
  const act = prose(html('en/guides/activation/index.html'));
  assert.match(act, /install on the day you travel/i);
  assert.match(act, /Others start as soon as the eSIM is installed/);
  for (const slug of ['iphone', 'android']) {
    assert.doesNotMatch(prose(html(`en/guides/${slug}/index.html`)), /before you (fly|leave)(?! home or on airport Wi-Fi)/i, slug);
  }
});

test('the guides tell the reader not to delete the eSIM, and why', () => {
  for (const slug of ['iphone', 'android', 'troubleshooting']) {
    const t = prose(html(`en/guides/${slug}/index.html`));
    assert.match(t, /Do not delete the eSIM/i, slug);
    assert.match(t, /may be single-use/, slug);
  }
});

test('every menu path is offered as typical, never as exact', () => {
  for (const slug of ['iphone', 'android']) {
    assert.match(prose(html(`en/guides/${slug}/index.html`)), /names? (can )?(differ|vary)/i, slug);
  }
});
