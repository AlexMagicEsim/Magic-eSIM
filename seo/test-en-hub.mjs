/* The GLOBAL destination list /en/esim/ after its redesign (2026-10).
 * What the page must keep: noindex and its head as they were, no network,
 * every destination linked once under its letter, the home's popular list
 * and nothing more, a search that exists only when its script runs.
 *
 * Run: node --test seo/test-en-hub.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POPULAR, azLetter, enCountries } from './build-en-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const HUB = read('en/esim/index.html');
const JS = read('en/hub.js');
const CSS = read('en/hub.css');
const LIST = enCountries();

test('the head is the same page for search engines: noindex, self canonical, the same title and description', () => {
  assert.match(HUB, /<title>eSIM destinations — Magic eSIM<\/title>/);
  assert.match(HUB, /<meta name="robots" content="noindex, follow">/);
  assert.match(HUB, /<link rel="canonical" href="https:\/\/magicesim\.store\/en\/esim\/">/);
  assert.match(HUB, /<meta name="description" content="Every destination Magic eSIM has data plans for, with prices in US dollars\. Online payment is not available yet\.">/);
  assert.doesNotMatch(HUB, /hreflang="en"|rel="alternate"/);
  assert.match(HUB, /connect-src 'none'/);
});

test('the page reads nothing: its one script is en/hub.js, and that script has no network, storage or redirect', () => {
  const srcs = [...HUB.matchAll(/<script[^>]*src="([^"?]+)/g)].map((m) => m[1]);
  assert.deepEqual(srcs, ['/en/hub.js']);
  const code = JS.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const re of [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage|sessionStorage|indexedDB|document\.cookie/, /location\.(href|replace|assign)/, /\bimport\s*\(/]) {
    assert.doesNotMatch(code, re, String(re));
  }
});

test('every destination is linked exactly once, under its own letter, A to Z, with its flag', () => {
  const groups = [...HUB.matchAll(/<section class="az-group" id="az-([a-z])"[\s\S]*?<\/section>/g)];
  assert.ok(groups.length >= 20);
  const seen = [];
  for (const [block, l] of groups) {
    for (const m of block.matchAll(/<li data-name="[^"]+" data-iso="([A-Z]{2})"><a href="\/en\/esim\/([a-z0-9-]+)\/"><img class="flag" src="\/en\/flags\/([a-z]{2})\.svg"[^>]*><span>([^<]+)<\/span><\/a><\/li>/g)) {
      const [, iso, slug, flag, name] = m;
      assert.equal(azLetter(name.replace(/&amp;/g, '&')), l.toUpperCase(), `${name} under ${l}`);
      assert.equal(flag, iso.toLowerCase());
      assert.ok(existsSync(join(ROOT, `en/esim/${slug}/index.html`)), slug);
      seen.push(slug);
    }
  }
  assert.equal(seen.length, LIST.length);
  assert.equal(new Set(seen).size, LIST.length, 'no destination twice');
  assert.deepEqual([...seen].sort(), LIST.map((c) => c.slug).sort());
  assert.equal(azLetter('Åland Islands'), 'A');
  assert.equal(azLetter('Réunion'), 'R');
});

test('the jump letters: a link for every group, a muted letter where there is none', () => {
  const nav = HUB.slice(HUB.indexOf('<nav class="hub-az"'), HUB.indexOf('</nav>', HUB.indexOf('<nav class="hub-az"')));
  for (const L of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const has = HUB.includes(`id="az-${L.toLowerCase()}"`);
    if (has) assert.ok(nav.includes(`<a href="#az-${L.toLowerCase()}" data-letter="${L}">${L}</a>`), L);
    else assert.ok(nav.includes(`<span aria-hidden="true">${L}</span>`), L);
  }
});

test('popular is the home\'s own list under the home\'s own label — no price, count or claim', () => {
  const tiles = [...HUB.matchAll(/<a class="hub-tile" href="\/en\/esim\/([a-z0-9-]+)\/">/g)].map((m) => m[1]);
  assert.deepEqual(tiles, POPULAR.map((c) => c.slug));
  assert.match(HUB, /<h2 id="hubPopTitle" data-i18n="home\.popularTitle">Popular destinations<\/h2>/);
  const text = HUB.slice(HUB.indexOf('<main'), HUB.indexOf('</main>')).replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, /\$\s?\d|\bfrom \$|\bplans? from\b|\d+\s+plans\b|best|cheapest|top-rated|rating|review|discount|% off|best seller|bestseller|24\/7|instant/i);
});

test('without JavaScript there is no search box that does nothing; the list and the letters still work', () => {
  assert.match(HUB, /<div class="hub-search" id="hubSearch" role="search" hidden>/);
  assert.match(JS, /box\.hidden = false;/);
  assert.ok(HUB.indexOf('id="previewNotice"') < HUB.indexOf('id="hubSearch"'), 'the payment bar comes first');
});

test('hub.css reaches nothing outside the site and styles no class the page does not use', () => {
  assert.doesNotMatch(CSS, /https?:\/\/|@import|url\(/i);
  let sel = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < 5; i += 1) sel = sel.replace(/\{[^{}]*\}/g, ' ');
  const classes = [...new Set([...sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
  const used = new Set([...HUB.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  assert.deepEqual(classes.filter((c) => !used.has(c)), []);
});
