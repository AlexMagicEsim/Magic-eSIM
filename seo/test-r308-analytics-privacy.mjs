// R3-08 (2026-10-10) — what Yandex Metrika / Webvisor can see on this origin.
//
// The counter (tag.js, webvisor:true, and the counter's «record form fields»
// setting ON) reads location.href the moment it starts and records the page.
// Measured before this fix: 11 payment-success URLs with the full order token
// were stored in Metrika. These guards pin the fix and the class around it:
//   1. both payment return pages drop token / public_order_token / src from the
//      URL in the FIRST script of <head>, before the counter;
//   2. no counter page reads a payment token from the URL after the counter;
//   3. every user-typed <input> on a counter page is hidden from Webvisor;
//   4. nothing on this origin writes a credential to localStorage /
//      sessionStorage / cookies (tag.js runs with this origin's privileges).
// The browser half (the URL at the moment ym(..,'init') runs, F5, storage) is
// test/e2e/payment-return.spec.js.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const COUNTER = 'mc.yandex.ru/metrika/tag.js';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'test', 'seo', 'infra', 'playwright-report', 'test-results'].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(html|js|mjs)$/.test(name) && !/\.test\.(js|mjs)$/.test(name) && !/^playwright\.config/.test(name)) out.push(relative(ROOT, p));
  }
  return out;
}
const SERVED = walk(ROOT);
const COUNTER_PAGES = SERVED.filter((f) => f.endsWith('.html') && read(f).includes(COUNTER));

test('the counter pages are the expected set (a walk that finds nothing must not pass)', () => {
  assert.ok(COUNTER_PAGES.length >= 200, `counter pages: ${COUNTER_PAGES.length}`);
  for (const f of ['payment-success.html', 'payment-failed.html', 'index.html', '404.html']) assert.ok(COUNTER_PAGES.includes(f), f);
  assert.ok(!COUNTER_PAGES.some((f) => f.startsWith('en/') || f.startsWith('app/')), 'no counter on /en/ or the Mini App');
});

// ── 1. the early bootstrap ──

function headScripts(html) {
  const head = html.slice(0, html.indexOf('</head>'));
  return [...head.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => ({ at: m.index, body: m[1] }));
}

for (const page of ['payment-success.html', 'payment-failed.html']) {
  test(`${page}: the FIRST script in <head> strips token, public_order_token and src, before the counter`, () => {
    const html = read(page);
    const scripts = headScripts(html);
    assert.ok(scripts.length >= 2, 'bootstrap + counter');
    const first = scripts[0];
    for (const k of ['token', 'public_order_token', 'src']) assert.match(first.body, new RegExp(`sp\\.delete\\('${k}'\\)`), `deletes ${k}`);
    assert.match(first.body, /history\.replaceState\(/);
    assert.doesNotMatch(first.body, /localStorage|sessionStorage|document\.cookie|console\.|innerHTML|textContent/, 'stores/logs/renders nothing');
    const counterAt = html.indexOf(COUNTER);
    const firstYm = html.search(/\bym\(\s*\d+/);
    assert.ok(first.at < counterAt && first.at < firstYm, 'bootstrap precedes tag.js and the first ym() call');
    assert.ok(!first.body.includes(COUNTER) && !/\bym\(/.test(first.body), 'the bootstrap is not the counter');
  });
}

test('payment-success keeps the token only in __payBoot and this tab\'s history.state; failed keeps nothing', () => {
  const ok = headScripts(read('payment-success.html'))[0].body;
  assert.match(ok, /window\.__payBoot = Object\.freeze\(boot\)/);
  assert.match(ok, /history\.replaceState\(t \? \{ t: t, src: s \} : null/);
  const bad = headScripts(read('payment-failed.html'))[0].body;
  assert.match(bad, /history\.replaceState\(null,/);
  assert.doesNotMatch(bad, /__payBoot|\{ t:/);
});

// ── 2. no payment token read from the URL after the counter ──

const TOKEN_FROM_URL = /\.get\(\s*['"](token|public_order_token)['"]\s*\)|[?&](token|public_order_token)=/;

test('no counter page (or script it loads) reads a payment token from the URL after the counter starts', () => {
  const offenders = [];
  for (const f of COUNTER_PAGES) {
    const html = read(f);
    const afterCounter = html.slice(html.indexOf(COUNTER));
    if (TOKEN_FROM_URL.test(afterCounter)) offenders.push(f);
  }
  for (const f of SERVED.filter((x) => x.startsWith('assets/') && x.endsWith('.js'))) {
    if (/\.get\(\s*['"](token|public_order_token)['"]\s*\)/.test(read(f))) offenders.push(f);
  }
  assert.deepEqual(offenders, []);
  const app = read('payment-success.html').slice(read('payment-success.html').indexOf(COUNTER));
  assert.doesNotMatch(app, /location\.search|URLSearchParams\(\s*location/, 'the success page reads __payBoot, not the URL');
  // positive control: the pattern does fire on the pre-R3-08 line
  assert.match("var token = (params.get('token') || params.get('public_order_token') || '').trim();", TOKEN_FROM_URL);
});

// ── 3. Webvisor never records what a visitor types ──

const NOT_TYPED = /type\s*=\s*["']?(hidden|submit|button|checkbox|radio|reset|image|range|color|file)\b/i;

test('every user-typed <input> / <textarea> on a counter page carries ym-hide-content', () => {
  const offenders = [];
  let seen = 0;
  for (const f of COUNTER_PAGES) {
    for (const m of read(f).matchAll(/<(input|textarea)\b[^>]*>/gi)) {
      if (NOT_TYPED.test(m[0])) continue;
      seen += 1;
      if (!/class\s*=\s*["'][^"']*\bym-hide-content\b/.test(m[0])) offenders.push(`${f}: ${m[0].slice(0, 90)}`);
    }
  }
  for (const f of SERVED.filter((x) => x.startsWith('assets/') && x.endsWith('.js'))) {
    for (const m of read(f).matchAll(/<(input|textarea)\b[^>]*>/gi)) {
      if (NOT_TYPED.test(m[0])) continue;
      seen += 1;
      if (!/\bym-hide-content\b/.test(m[0])) offenders.push(`${f}: ${m[0].slice(0, 90)}`);
    }
  }
  assert.ok(seen >= 2, `typed inputs seen: ${seen} (the checkout email and promo at least)`);
  assert.deepEqual(offenders, []);
  assert.doesNotMatch('<input type="email" id="coEmail" required>', /class\s*=\s*["'][^"']*\bym-hide-content\b/, 'positive control');
});

// ── 4. no credential in browser storage on this origin ──

const STORAGE_KEYS = new Set(['mesim.probe', 'mesim_attr', 'magic_attr', 'magic_pay_ctx', 'magic_fired_goals', 'mesim.site.lang']);
const CREDENTIAL_WORD = /token|bearer|secret|passw|credential|session|auth|jwt|api[_-]?key|init_?data/i;
const SET_CALL = /(localStorage|sessionStorage)\.setItem\(\s*([^,]+?)\s*,\s*([^;\n]*)/g;

function resolveKey(src, expr) {
  const lit = /^['"`]([^'"`]+)['"`]$/.exec(expr);
  if (lit) return lit[1];
  const m = new RegExp(`(?:var|let|const)\\s+${expr.replace(/[^\w$]/g, '')}\\s*=\\s*['"]([^'"]+)['"]`).exec(src);
  return m ? m[1] : null;
}

function storageOffences(file, src) {
  const out = [];
  if (/document\.cookie\s*=/.test(src)) out.push(`${file}: writes document.cookie`);
  for (const m of src.matchAll(SET_CALL)) {
    const key = resolveKey(src, m[2].trim());
    if (key === null) { out.push(`${file}: unresolvable storage key ${m[2].trim()}`); continue; }
    if (!STORAGE_KEYS.has(key)) out.push(`${file}: storage key "${key}" is not on the reviewed list`);
    if (CREDENTIAL_WORD.test(key)) out.push(`${file}: storage key "${key}" names a credential`);
    if (/\b(token|sessionToken|bearer|secret|password|apiKey|initData|__payBoot)\b/.test(m[3])) out.push(`${file}: stores ${m[3].slice(0, 60)}`);
  }
  return out;
}

test('nothing on the storefront origin writes a credential to storage or cookies', () => {
  const offenders = SERVED.flatMap((f) => storageOffences(f, read(f)));
  assert.deepEqual(offenders, []);
});

test('the storage guard fires on what it exists for, and stays quiet on the reviewed keys', () => {
  const bad = [
    "localStorage.setItem('admin_session_token', t);",
    "sessionStorage.setItem('magic_pay_ctx', JSON.stringify({ token: token }));",
    "var K='mesim_bearer'; localStorage.setItem(K, x);",
    "document.cookie = 'sid=' + v;",
    "localStorage.setItem('new_key', '1');",
  ];
  for (const b of bad) assert.ok(storageOffences('fixture.js', b).length > 0, b);
  const good = [
    "sessionStorage.setItem('magic_pay_ctx', JSON.stringify(_c));",
    "var AK='magic_attr'; sessionStorage.setItem(AK, JSON.stringify(ar));",
    "localStorage.setItem('magic_fired_goals', JSON.stringify(keep.slice(-100)));",
  ];
  for (const g of good) assert.deepEqual(storageOffences('fixture.js', g), [], g);
});
