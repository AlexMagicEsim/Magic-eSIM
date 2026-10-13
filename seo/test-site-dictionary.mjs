/* One dictionary for the storefront's interface words (I18N-02).
 *
 * `assets/site-i18n.js` is the single source. The generators read it through
 * `seo/site-dictionary.mjs`; this file proves that:
 *
 *   1. the STATIC text of every keyed element on every English page — what a
 *      crawler and a visitor without JavaScript read — equals the dictionary,
 *      the hand-written `en/index.html` included, so the runtime re-fill never
 *      changes a word on screen;
 *   2. the English generator no longer types a keyed word a second time;
 *   3. the Russian header's dictionary words come from the dictionary;
 *   4. the reader throws rather than printing a key, and escapes exactly what
 *      the pages always escaped.
 *
 * Run: node --test seo/test-site-dictionary.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DICT, word, text, attr, unescapeText } from './site-dictionary.mjs';
import { ruHeader } from './ru-chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function pagesUnder(dir) {
  const out = [];
  (function walk(d) {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.html')) out.push(relative(ROOT, p));
    }
  }(join(ROOT, dir)));
  return out;
}

/** Keyed elements whose static text or attribute differs from the dictionary. Pure, so it can be shown to fire. */
function drift(pages, dict) {
  const bad = [];
  for (const [file, html] of pages) {
    for (const m of html.matchAll(/data-i18n="([\w.]+)"[^>]*>([^<]*)</g)) {
      const [, key, raw] = m;
      if (!Object.prototype.hasOwnProperty.call(dict, key)) bad.push(`${file}: ${key} has no entry`);
      else if (unescapeText(raw) !== dict[key]) bad.push(`${file}: ${key} = «${raw}»`);
    }
    for (const m of html.matchAll(/data-i18n-attr="([\w-]+):([\w.]+)"[^>]*?\s\1="([^"]*)"/g)) {
      const [, name, key, raw] = m;
      if (unescapeText(raw) !== dict[key]) bad.push(`${file}: ${name}:${key} = «${raw}»`);
    }
  }
  return bad;
}

const EN_PAGES = pagesUnder('en').map((f) => [f, read(f)]);

/* ===================================================================== */

test('every keyed word on every English page is the dictionary word', () => {
  assert.ok(EN_PAGES.length >= 200, `only ${EN_PAGES.length} English pages`);
  const keyed = EN_PAGES.reduce((n, [, h]) => n + (h.match(/data-i18n="/g) || []).length, 0);
  assert.ok(keyed >= 5000, `only ${keyed} keyed elements — the scan is not reading the pages`);
  assert.deepEqual(drift(EN_PAGES, DICT.en), []);
});

test('the hand-written English home is held to the same dictionary', () => {
  const home = EN_PAGES.find(([f]) => f === join('en', 'index.html'));
  assert.ok(home, 'en/index.html');
  assert.ok((home[1].match(/data-i18n="/g) || []).length >= 40);
  assert.deepEqual(drift([home], DICT.en), []);
});

test('the drift check can fire, on text and on an attribute', () => {
  // §26.1: prove the gate is capable of failing.
  const page = ['x.html', '<a data-i18n="nav.how">How it work</a><button data-i18n-attr="aria-label:checkout.close" aria-label="Shut">×</button>'];
  assert.deepEqual(drift([page], DICT.en), [
    'x.html: nav.how = «How it work»',
    'x.html: aria-label:checkout.close = «Shut»',
  ]);
  assert.deepEqual(drift([['y.html', '<a data-i18n="nav.how">How it works</a>']], DICT.en), []);
});

test('the English generator types no keyed word a second time', () => {
  // Every keyed element's content is a dictionary lookup (or an interpolation);
  // a literal here is a copy that can drift from the dictionary.
  const src = read('seo/build-en-pages.mjs');
  const literals = [...src.matchAll(/data-i18n="([\w.]+)"[^>]*>([^<$`][^<]*)</g)].map((m) => `${m[1]}: ${m[2]}`);
  assert.deepEqual(literals, []);
  const attrs = [...src.matchAll(/data-i18n-attr="([\w-]+):[\w.]+"[^>]*?\s\1="([^"$][^"]*)"/g)].map((m) => m[0]);
  assert.deepEqual(attrs, []);
  assert.ok((src.match(/\$\{t\('/g) || []).length >= 60, 'the lookups are gone — was the generator rewritten?');
});

test('the Russian header reads its dictionary words from the dictionary', () => {
  const src = read('seo/ru-chrome.mjs');
  for (const key of ['nav.destinations', 'nav.how', 'nav.guides']) {
    assert.ok(src.includes(`text('ru', '${key}')`), key);
    assert.ok(ruHeader().includes(`>${DICT.ru[key]}<`), key);
  }
  // …and the home, which carries a byte copy of the header, shows the same words.
  const home = read('index.html');
  for (const key of ['nav.destinations', 'nav.how', 'nav.guides']) assert.ok(home.includes(`>${DICT.ru[key]}</a>`), key);
});

test('the reader throws on an unknown key or language instead of printing a key', () => {
  assert.throws(() => word('en', 'nav.nothing'), /no en entry for nav\.nothing/);
  assert.throws(() => word('de', 'nav.how'), /no language de/);
  assert.throws(() => word('en', '__proto__'), /no en entry/);
  assert.throws(() => text('ru', 'site.tagline'), /no ru entry/, 'an English-only key has no Russian');
});

test('escaping is exactly what the pages always printed', () => {
  // Apostrophes stay literal («can't»): the old literals were written that way,
  // and escaping them would change every page's bytes.
  assert.equal(text('en', 'preview.noticeTitle'), "Online payment isn't available yet — plans can't be bought here yet");
  assert.equal(attr('en', 'checkout.close'), 'Close');
  assert.equal(unescapeText('a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39;'), 'a & b <c> "d" \'e\'');
});
