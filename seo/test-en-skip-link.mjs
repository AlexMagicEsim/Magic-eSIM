// «Skip to main content» on every English page — the static half.
// The browser half (first Tab, visibility, focus move, no-JS, axe, CSP,
// overflow at 1366 / 390 / 320) is test/e2e/en-skip-link.spec.js.
//
//   1. every en/**/*.html: exactly one skip link, the FIRST element of <body>,
//      before any other link, button or field, pointing at #main;
//   2. exactly one <main id="main" tabindex="-1"> to land on;
//   3. the home's skip link is the generator's own string (one source);
//   4. assets/site.css (the shared design system): off-screen until focused, shown on :focus, no ring on <main>;
//   5. the Russian site and the shared 404.html carry no skip link.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIP_LINK } from './build-en-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const EN = htmlFiles(join(ROOT, 'en'));
const CSS = readFileSync(join(ROOT, 'assets', 'site.css'), 'utf8');

test('the skip link string is what the pages carry', () => {
  assert.equal(SKIP_LINK, '<a class="skip" href="#main">Skip to main content</a>');
});

test('every English page: one skip link, first in <body>, before anything focusable', () => {
  assert.ok(EN.length >= 206, `expected every English page, found ${EN.length}`);
  for (const f of EN) {
    const html = readFileSync(f, 'utf8');
    assert.equal(html.split(SKIP_LINK).length - 1, 1, `${f}: exactly one skip link`);
    const body = html.slice(html.search(/<body[^>]*>/));
    const afterBody = body.slice(body.indexOf('>') + 1).trimStart();
    assert.ok(afterBody.startsWith(SKIP_LINK), `${f}: the skip link is the first element of <body>`);
    const firstFocusable = body.match(/<(a|button|input|select|textarea|summary)\b[^>]*>/);
    assert.equal(firstFocusable && firstFocusable[0], '<a class="skip" href="#main">', `${f}: nothing focusable before it`);
  }
});

test('every English page: exactly one <main id="main" tabindex="-1">', () => {
  for (const f of EN) {
    const html = readFileSync(f, 'utf8');
    const mains = html.match(/<main\b[^>]*>/g) || [];
    assert.equal(mains.length, 1, `${f}: one <main>`);
    assert.match(mains[0], /\bid="main"/, f);
    assert.match(mains[0], /\btabindex="-1"/, f);
    assert.equal((html.match(/\bid="main"/g) || []).length, 1, `${f}: one #main`);
  }
});

test('site.css: hidden until focused, shown on focus, above the sticky header, no ring on <main>', () => {
  const rule = (sel) => {
    const i = CSS.indexOf(`${sel}{`);
    assert.ok(i >= 0, `rule ${sel}`);
    return CSS.slice(i, CSS.indexOf('}', i));
  };
  const base = rule('.skip');
  assert.match(base, /position:fixed/);
  assert.match(base, /transform:translateY\(calc\(-100% - 24px\)\)/, 'off-screen by default');
  assert.match(base, /z-index:100/, 'above .site-header (40)');
  assert.match(base, /background:var\(--accent-btn\)/, 'the AA button colour');
  assert.match(rule('.skip:focus,.skip:focus-visible'), /transform:none/);
  assert.match(CSS, /main\[tabindex="-1"\]:focus\{outline:none\}/);
  const header = CSS.match(/\.site-header\{[^}]*z-index:(\d+)/);
  assert.ok(header && Number(header[1]) < 100, 'the header stays below the skip link');
});

test('the Russian site and the shared 404 page are untouched', () => {
  for (const f of ['index.html', '404.html', join('esim', 'index.html'), join('esim', 'japan', 'index.html')]) {
    const html = readFileSync(join(ROOT, f), 'utf8');
    assert.equal(html.includes('class="skip"'), false, f);
  }
});
