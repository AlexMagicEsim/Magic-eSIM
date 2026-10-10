// The shared design system (2026-10-10): assets/site.css is ONE stylesheet for
// the Russian and the English storefront, so their design cannot drift apart.
// What this pins:
//   1. Inter is self-hosted for latin, latin-ext AND cyrillic — the Russian
//      pages render in Inter, not in a fallback — and the three files are the
//      exact @fontsource-variable/inter 5.3.0 files (the latin ones are the
//      files /en/ shipped since #35);
//   2. site.css is locale-neutral: no copy, no currency, no market — a rule
//      that only one storefront may have lives in that storefront's own layer
//      (the GLOBAL payment-status bar is en/en.css);
//   3. every English page loads site.css, then its own en/en.css — in that
//      order, because the layer is written to sit on top;
//   4. the shared files no longer exist under /en/.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const CSS = read('assets/site.css');

const FONTS = {
  'inter-latin-wght-normal.woff2': '3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62',
  'inter-latin-ext-wght-normal.woff2': '34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956',
  'inter-cyrillic-wght-normal.woff2': '71d5ee93cc1e9f1d520a3a8b66456de18c7879d8df09d57fcd2eaff75fef0075',
};

test('Inter covers latin, latin-ext and cyrillic, from the pinned files', () => {
  for (const [file, sha] of Object.entries(FONTS)) {
    const got = createHash('sha256').update(readFileSync(join(ROOT, 'assets/fonts', file))).digest('hex');
    assert.equal(got, sha, file);
    assert.ok(CSS.includes(`url(/assets/fonts/${file})`), `${file} is declared`);
  }
  const cyr = CSS.split('\n').find((l) => l.includes('inter-cyrillic-wght-normal.woff2'));
  assert.match(cyr, /unicode-range:[^}]*U\+0400-045F/, 'the Russian alphabet, ё included');
  // ₽ (U+20BD) is in the latin-ext file's range.
  const ext = CSS.split('\n').find((l) => l.includes('inter-latin-ext-wght-normal.woff2'));
  assert.match(ext, /U\+20AD-20C0/);
});

test('site.css is locale-neutral: no copy, no currency, no market', () => {
  const rules = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /[А-Яа-яЁё]/, 'no Russian text');
  assert.doesNotMatch(rules, /₽|\$\d|\bUSD\b|\bRUB\b|руб/i, 'no currency');
  assert.doesNotMatch(rules, /\.paybar|global|platega|flitt/i, 'no market-specific component');
  // the rule can fire
  assert.match('.paybar{color:red}', /\.paybar|global|platega|flitt/i);
});

function htmlUnder(dir, out = []) {
  for (const n of readdirSync(join(ROOT, dir))) {
    const p = join(dir, n);
    if (statSync(join(ROOT, p)).isDirectory()) htmlUnder(p, out);
    else if (n.endsWith('.html')) out.push(p);
  }
  return out;
}

test('every English page loads site.css and then its own en/en.css', () => {
  const pages = htmlUnder('en');
  assert.ok(pages.length >= 205, `English pages: ${pages.length}`);
  const bad = pages.filter((p) => !/<link rel="stylesheet" href="\/assets\/site\.css\?v=[0-9a-f]{8}">\n<link rel="stylesheet" href="\/en\/en\.css\?v=[0-9a-f]{8}">/.test(read(p)));
  assert.deepEqual(bad, []);
});

test('the shared files live in /assets only', () => {
  for (const gone of ['en/fonts', 'en/img', 'en/flags']) assert.equal(existsSync(join(ROOT, gone)), false, gone);
  for (const here of ['assets/fonts/OFL.txt', 'assets/flags/LICENSE.txt', 'assets/brand/logo-1x.png']) assert.ok(existsSync(join(ROOT, here)), here);
});
