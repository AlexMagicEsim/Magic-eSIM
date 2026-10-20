// The Telegram Mini App follows the Magic eSIM brand book v1.0 (approved by the owner 2026-10-20):
// the slogan exactly «Stay Connected Anywhere» (English, no full stop), every colour in app/mini.css
// from the approved palette (or derived from it in CSS), Inter first in the type stack, line icons
// with a 2 px stroke. Telegram's own theme variables still decide surfaces and text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const CSS = read('app/mini.css');
const HTML = read('app/index.html');
const noComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Brand book v1.0, «Цветовая палитра»: brand, action, neutral, status (+ the chip pair of «Оптимальный выбор»).
export const PALETTE = new Set(['#8A16C7', '#3866D9', '#00C7DF', '#F6CE82', '#4267E8', '#3557D6', '#EEF2FF', '#111827', '#5B6478',
  '#687186', '#E6EAF2', '#D6DEF0', '#F7F9FC', '#FFFFFF', '#080B16', '#1F9D57', '#C5372B', '#FFF7E6', '#F2D08A', '#7A4B00',
  '#14794A', '#E7F6EE', '#FFF', '#000']);

/** Hex colours a stylesheet uses outside comments that are not in the palette. */
export function offPalette(css) {
  const hex = noComments(css).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [];
  return [...new Set(hex.map((h) => h.toUpperCase()))].filter((h) => !PALETTE.has(h));
}

test('the slogan is exactly «Stay Connected Anywhere» — English, no full stop', () => {
  const lines = [...HTML.matchAll(/class="hero__sub hero__sub--slogan" lang="en">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(lines, ['Stay Connected Anywhere']);
  for (const f of ['app/index.html', 'app/canary.html', 'app/i18n.js', 'app/ui.js', 'app/core.js']) {
    assert.doesNotMatch(read(f), /Stay Connected Anywhere\./, `${f}: the slogan never takes a full stop`);
  }
});

test('every colour in mini.css is on the brand palette', () => {
  assert.deepEqual(offPalette(CSS), []);
});

test('the checker catches an off-palette colour (mutation)', () => {
  assert.deepEqual(offPalette('.a{color:#16A34A}/* #DC2626 in a comment is fine */'), ['#16A34A']);
  assert.deepEqual(offPalette(CSS.replace('--bad: #C5372B;', '--bad: #DC2626;')), ['#DC2626']);
});

test('dark-theme state colours are the palette lifted toward white, not other hues', () => {
  const dark = noComments(CSS).match(/:root\[data-tg-scheme='dark'\]\s*\{([^}]*)\}/)[1];
  for (const [k, base] of [['good', '#1F9D57'], ['warn', '#7A4B00'], ['bad', '#C5372B']]) {
    assert.match(dark, new RegExp(`--${k}:\\s*color-mix\\(in srgb, ${base} \\d+%, #fff\\)`), `--${k} in dark`);
  }
});

test('Inter is the typeface: first in the stack, self-hosted files that exist, preloaded', () => {
  assert.match(CSS, /--font:\s*"Inter",/);
  assert.match(noComments(CSS), /html, body \{[^}]*font: 15px\/1\.45 var\(--font\);/);
  const files = [...CSS.matchAll(/url\(\.\.\/assets\/fonts\/([^)]+\.woff2)\)/g)].map((m) => m[1]);
  assert.deepEqual(files.sort(), ['inter-cyrillic-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2', 'inter-latin-wght-normal.woff2']);
  for (const f of files) assert.ok(existsSync(join(ROOT, 'assets/fonts', f)), f);
  for (const f of ['inter-cyrillic-wght-normal.woff2', 'inter-latin-wght-normal.woff2']) {
    assert.match(HTML, new RegExp(`<link rel="preload" href="/assets/fonts/${f}" as="font" type="font/woff2" crossorigin>`), f);
  }
  assert.match(HTML, /font-src 'self'/, 'the CSP still allows the self-hosted font');
});

test('no token is used that mini.css never defines', () => {
  const css = noComments(CSS);
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((v) => !v.startsWith('--tg-')));
  assert.deepEqual([...used].filter((v) => !defined.has(v)), []);
});

test('the primary button is the brand blue; pressed is the brand book\'s hover blue', () => {
  const css = noComments(CSS);
  assert.match(css, /\.btn \{[^}]*background: var\(--blue\);/);
  assert.match(css, /--blue: #4267E8;/);
  assert.match(css, /--blue-press: #3557D6;/);
  assert.match(css, /\.btn:not\(\.btn--ghost\):not\(\.btn--quiet\):not\(\[disabled\]\):active \{ background: var\(--blue-press\); \}/);
});

test('line icons in the Mini App markup use the brand book\'s 2 px stroke', () => {
  // the logo is artwork, not a line icon: its wave rings are drawn in the 574-unit logo space (seo/site-chrome.mjs)
  const icons = HTML.replace(/<svg class="brand [^"]*brand-logo[\s\S]*?<\/svg>/g, '');
  const widths = [...icons.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => m[1]);
  assert.ok(widths.length >= 6, 'the tab bar and the settings gear');
  assert.deepEqual([...new Set(widths)], ['2']);
});
