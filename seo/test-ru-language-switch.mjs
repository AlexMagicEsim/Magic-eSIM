// THE RUSSIAN PAGES' WAY OUT (post-migration audit, 2026-11-07), held on the BUILT tree.
//
//   1. «English» leads to the same page in English (P2): every Russian page's language switch — the header link and the
//      phone menu's — goes to seo/indexing.mjs enSwitchPath(page): /ru/esim/<country>/ → /destinations/<country>/,
//      /ru/esim/ → /destinations/, a guide → its English guide, and «/» only for a page English has not (the Russian
//      home, the payment-rubles and dual-sim-sms guides, the Russian legal and payment pages). Every target is a real
//      page of the tree, never a redirect page.
//   2. A Russian page never sends a buyer to the English home by accident (P1): outside the language switch (a link
//      marked lang="en"), no link on a Russian page resolves to «/» or /index.html — the old relative `index.html` of
//      /payment-success.html, which meant the Russian home before the migration, is exactly what this catches.
//
// Each rule's first assertion proves it fires.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planArtifact } from '../scripts/build-pages-artifact.mjs';
import { enSwitchPath } from './indexing.mjs';
import { isLegacyRedirectFile } from './build-legacy-redirects.mjs';
import { COUNTRY_SLUGS } from './catalogue-page-count.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const HTML = planArtifact(ROOT).publish.filter((f) => f.endsWith('.html'));
const pathOf = (rel) => `/${rel.replace(/(^|\/)index\.html$/, '$1')}`;
const fileOf = (path) => (path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1));
// The Russian SITE pages: lang="ru" with the site header (the Mini App at /app/ is Russian too, but has no site chrome).
const RU_PAGES = HTML.filter((rel) => !isLegacyRedirectFile(rel) && rel !== '404.html' && /<html lang="ru"/.test(read(rel))
  && read(rel).includes('<header class="site-header">'));

/** The two «English» links of a Russian header: [header switch, phone menu]. */
const switchTargets = (html) => [
  ...[...html.matchAll(/<a class="langsw" href="([^"]*)"[^>]*lang="en"/g)].map((m) => m[1]),
  ...[...html.matchAll(/<a href="([^"]*)"(?: hreflang="en")? lang="en">English<\/a>/g)].map((m) => m[1]),
];

/** Links of a Russian page that resolve to the English home and are not the language switch. */
export function englishHomeLinks(html, rel) {
  const base = new URL(`${SITE}${pathOf(rel)}`);
  const out = [];
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<a\b([^>]*)>/gi)) {
    const href = (m[1].match(/\shref="([^"]*)"/) || [])[1];
    if (!href || /\slang="en"/.test(m[1])) continue;
    let u;
    try { u = new URL(href, base); } catch { continue; }
    if (u.origin === SITE && (u.pathname === '/' || u.pathname === '/index.html')) out.push(href);
  }
  return out;
}

test('enSwitchPath: the same page in English, «/» only where English has none', () => {
  assert.equal(enSwitchPath('/ru/esim/turkey/'), '/destinations/turkey/', 'the proof');
  assert.equal(enSwitchPath(`${SITE}/ru/esim/italy/`), '/destinations/italy/');
  assert.equal(enSwitchPath('/ru/esim/'), '/destinations/');
  assert.equal(enSwitchPath('/ru/'), '/');
  assert.equal(enSwitchPath('/ru/iphone.html'), '/guides/iphone/');
  assert.equal(enSwitchPath('/ru/android.html'), '/guides/android/');
  assert.equal(enSwitchPath('/ru/esim/compatibility/'), '/guides/compatibility/');
  assert.equal(enSwitchPath('/ru/esim/activation-before-travel/'), '/guides/activation/');
  assert.equal(enSwitchPath('/ru/esim/not-working/'), '/guides/troubleshooting/');
  for (const p of ['/ru/esim/payment-rubles/', '/ru/esim/dual-sim-sms/', '/ru/esim/esim-or-roaming/', '/terms.html', '/privacy.html', '/payment-success.html', '/ru/esim/europe/']) {
    assert.equal(enSwitchPath(p), '/', `${p} has no English twin`);
  }
  assert.equal(enSwitchPath('/ru/esim/turkey/', ['italy']), '/', 'a slug without a catalogue page has no country twin');
});

test('every Russian page\'s «English» leads to its English twin (or «/»), and every target is a real page', () => {
  assert.deepEqual(switchTargets('<a class="langsw" href="/x/" lang="en">…</a><a href="/x/" lang="en">English</a>'), ['/x/', '/x/'], 'the proof: both links are read');
  assert.ok(RU_PAGES.length > 200, `the Russian pages were read (${RU_PAGES.length})`);
  let twins = 0;
  for (const rel of RU_PAGES) {
    const html = read(rel);
    const want = enSwitchPath(pathOf(rel));
    const got = switchTargets(html);
    assert.equal(got.length, 2, `${rel}: the header and the phone menu each carry one «English»`);
    assert.deepEqual(got, [want, want], `${rel}: «English» leads to ${want}`);
    assert.ok(existsSync(join(ROOT, fileOf(want))) && !isLegacyRedirectFile(fileOf(want)), `${rel}: ${want} is a real page`);
    assert.match(read(fileOf(want)), /<html lang="en"/, `${rel}: ${want} is English`);
    if (want !== '/') twins++;
  }
  // every country page, the list and the five guides with an English twin
  assert.ok(twins >= COUNTRY_SLUGS.length + 1 + 5, `${twins} pages lead to their twin`);
});

test('no Russian page links to the English home except through the language switch', () => {
  assert.deepEqual(englishHomeLinks('<a class="btn" id="actionHome" href="index.html">Вернуться на главную</a>', 'payment-success.html'), ['index.html'], 'the proof: the old relative home link');
  assert.deepEqual(englishHomeLinks('<a href="/" lang="en">English</a><a href="/ru/">Главная</a>', 'payment-success.html'), []);
  assert.deepEqual(englishHomeLinks('<a href="./">x</a><a href="https://magicesim.store/">y</a>', 'terms.html'), ['./', 'https://magicesim.store/']);
  const found = [];
  for (const rel of RU_PAGES) for (const href of englishHomeLinks(read(rel), rel)) found.push(`${rel}: ${href}`);
  assert.deepEqual(found, []);
  // the buyer's way back after a payment, named
  const ok = read('payment-success.html');
  assert.match(ok, /<a class="btn secondary" id="actionHome" href="\/ru\/">Вернуться на главную<\/a>/);
  for (const rel of ['payment-success.html', 'payment-failed.html', 'terms.html', 'privacy.html']) assert.ok(RU_PAGES.includes(rel), rel);
});
