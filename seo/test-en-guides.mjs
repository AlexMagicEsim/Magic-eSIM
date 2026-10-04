/* The English guides (/en/guides/<slug>/): what they may say, how a crawler
 * is told to treat them, and that every link lands somewhere real.
 *
 * Run: node --test seo/test-en-guides.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN_GUIDES } from './guides-en.mjs';
import { guidePage, guidesHub, GUIDE_RU } from './build-en-pages.mjs';
import { stampHtml } from './asset-version.mjs';

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
  assert.match(read('seo/build-all.mjs'), /run\('build-en-pages\.mjs'\)/);
  assert.match(read('seo/build-en-pages.mjs'), /for \(const g of EN_GUIDES\) write\(`en\/guides\/\$\{g\.slug\}\/index\.html`/);
});

/* ===================================================================== *
 * 2. How a crawler is told to treat them
 * ===================================================================== */

test('every guide is noindex, self-canonical, with no hreflang, no structured data and no script', () => {
  const sitemap = read('sitemap.xml');
  for (const { g, rel } of PAGES) {
    const h = html(rel);
    const url = `https://magicesim.store/en/guides/${g ? `${g.slug}/` : ''}`;
    assert.match(h, /<html lang="en">/, rel);
    assert.match(h, /<meta name="robots" content="noindex, follow">/, rel);
    assert.equal((h.match(/<meta name="robots"/g) || []).length, 1, rel);
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), `${rel}: canonical is itself`);
    assert.equal(/<link[^>]*hreflang/.test(h), false, `${rel}: no hreflang alternate until PR 8`);
    assert.equal(/application\/ld\+json/.test(h), false, `${rel}: no structured data until PR 8`);
    assert.equal(/<script/i.test(h), false, `${rel}: a guide runs no script — no network, no analytics`);
    assert.equal(sitemap.includes(url), false, `${rel}: not in the sitemap`);
  }
  assert.equal(/\/en\/guides\//.test(sitemap), false);
});

test('the language switch goes to each guide\'s Russian twin, which exists', () => {
  for (const g of EN_GUIDES) {
    const ru = GUIDE_RU[g.slug];
    const file = ru.endsWith('/') ? `${ru.slice(1)}index.html` : ru.slice(1);
    assert.ok(existsSync(join(ROOT, file)), `${g.slug} → ${ru}`);
    assert.match(html(`en/guides/${g.slug}/index.html`), new RegExp(`class="langsw" href="${ru}" hreflang="ru"`));
  }
});

test('every link on a guide lands on a page that exists, and a Russian one says so', () => {
  for (const { rel } of PAGES) {
    const h = html(rel);
    const links = [...h.matchAll(/<a\b[^>]*href="(\/[^"#?]*)"[^>]*>/g)];
    assert.ok(links.length >= 6, `${rel}: the scan must find the links`);
    for (const [tag, href] of links) {
      const file = href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1);
      assert.ok(existsSync(join(ROOT, file)), `${rel}: ${href} does not exist`);
      if (!href.startsWith('/en/')) assert.match(tag, /hreflang="ru"/, `${rel}: ${href} is Russian and must say so`);
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

const BANNED = [
  // A price or a payment method: GLOBAL takes no payment yet.
  ['a rouble or a payment method', /₽|\broubles?\b|\brubles?\b|\bRUB\b|\bSBP\b|any card|credit card|bank card|pay with/i],
  // Delivery that does not exist for GLOBAL yet.
  ['a promise about delivery', /we (will )?(send|email)|our email|you('ll| will) receive|sent to your (e-?mail|inbox)|delivery email|order email/i],
  // A card row the English plan cards do not show.
  ['a pointer to a card row EN does not have', /start of (the )?term|validity starts? row|coverage and conditions|activation row/i],
  // A promise of network quality in a place.
  ['a network-quality promise', /\b(fast|reliable|strong signal|best coverage|full coverage|guaranteed?|works everywhere|seamless)\b|\b(4G|5G|LTE)\b/i],
  // Features no guide may promise.
  ['an unlimited / hotspot / calls / SMS / 2FA promise', /\bunlimited\b|\bhotspot\b|tethering|receive (sms|texts|verification)|\b2FA\b|verification code|phone number included/i],
  // A list of device models.
  ['a device-model list', /iPhone\s?(X[RS]?|\d{1,2})\b|Galaxy\s?[SZA]\d|Pixel\s?\d/i],
  // The start-of-term trap.
  ['install-early advice that ignores the start of term', /install (it |the eSIM )?(a few days|days|a week|well) (before|ahead)/i],
  // A QR code that can always be reused.
  ['a reusable QR code', /QR code (can|may) be (re-?used|scanned again)|reusable QR|scan it again any time/i],
  // A claim about a provider or a catalogue fact the guide cannot check.
  ['a claim about suppliers', /\bsupplier|\bprovider\b|eSIM Access|MobiMatter/i],
];

test('no guide says what this site cannot stand behind', () => {
  for (const { rel } of PAGES) {
    const text = prose(html(rel)).replace(/Перейти на русскую версию/g, '');
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
