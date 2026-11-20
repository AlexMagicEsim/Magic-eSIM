// O2 (2026-11-20): /payment-failed.html after a payment that did not complete.
//
// Platega returns every Russian buyer here — today all of them from the Telegram
// Mini App, since the Russian site (/ru/, its country pages, /terms.html,
// /privacy.html) is hidden by the EN-only publication of 2026-11-09. The page
// used to strip src=tma and offer «Вернуться к тарифам» → /ru/#plans (404), a
// header and a footer whose links were nearly all 404 too, and no way back into
// Telegram at all.
//
// Pinned here, on the page's OWN scripts run in a sandbox:
//   1. a Mini App return (src=tma) gets «Вернуться в Telegram» →
//      t.me/magicesim_bot?startapp=o_<last six of the token>, so the app opens on
//      THIS order's server status (a payment that went through after all is SEEN,
//      not paid twice); without a usable token, the plain Mini App entry;
//   2. any other visitor gets the plain Mini App entry, never a hidden page;
//   3. the token itself never survives the first script — only its six-char ref,
//      in memory, and only for src=tma;
//   4. every link on the page leads to something published today;
//   5. nothing on the page can create or repeat a payment: no request at all,
//      and the payment_failed goal still fires at most once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RU_PAY_RETURN_HEADER, RU_PAY_RETURN_FOOTER, RU_PAY_RETURN_LINKS, RU_TG_APP } from './ru-chrome.mjs';
import { planArtifact } from '../scripts/build-pages-artifact.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const PAGE = read('payment-failed.html');
const HEAD = PAGE.slice(0, PAGE.indexOf('</head>'));
const BOOT = HEAD.match(/<script>\s*\n\s*\(function \(\) \{\s*\n\s*var boot = \{ tma: false, ref: '' \};[\s\S]*?<\/script>/);
const RETURN = PAGE.match(/\(function\(\)\{\s*\n\s*var a=document\.getElementById\('pfBack'\)[\s\S]*?\n\s*\}\)\(\);/);
const GOAL = PAGE.match(/\(function\(\)\{\s*\n\s*var MAX_AGE_MS[\s\S]*?\n\s*\}\)\(\);/);
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-XYZ12';   // 43 chars, like a real public_order_token

const scriptBody = (tag) => tag.replace(/^<script>/, '').replace(/<\/script>$/, '');

/** Run the head bootstrap on a URL, then the return script, as the browser would. */
function land(href, { withLink = true } = {}) {
  const replaced = [];
  const window = {};
  const location = { href };
  const history = { replaceState: (state, _t, url) => replaced.push({ state, url }) };
  new Function('window', 'location', 'history', 'URL', scriptBody(BOOT[0]))(window, location, history, URL);
  const link = { href: RU_TG_APP, textContent: 'Открыть Magic eSIM в Telegram' };
  const document = { getElementById: (id) => (withLink && id === 'pfBack' ? link : null) };
  new Function('window', 'document', RETURN[0])(window, document);
  return { link, boot: window.__payFail, replaced };
}

const BASE = 'https://magicesim.store/payment-failed.html';

test('the scripts exist and the bootstrap is the first script of <head>, before the counter', () => {
  assert.ok(BOOT, 'bootstrap not found');
  assert.ok(RETURN, 'return script not found');
  assert.ok(GOAL, 'payment_failed goal script not found');
  const first = HEAD.match(/<script\b[^>]*>[\s\S]*?<\/script>/);
  assert.equal(first[0], BOOT[0]);
  assert.ok(HEAD.indexOf(BOOT[0]) < HEAD.indexOf('mc.yandex.ru/metrika/tag.js'));
  assert.ok(PAGE.indexOf(RETURN[0]) < PAGE.indexOf(GOAL[0]));
});

test('1. a Mini App return goes back to Telegram on THIS order', () => {
  const r = land(`${BASE}?token=${TOKEN}&src=tma`);
  assert.equal(r.link.textContent, 'Вернуться в Telegram');
  assert.equal(r.link.href, `https://t.me/magicesim_bot?startapp=o_${TOKEN.slice(-6)}`);
  assert.deepEqual({ ...r.boot }, { tma: true, ref: TOKEN.slice(-6) });
  assert.ok(Object.isFrozen(r.boot));
});

test('1b. a Mini App return without a usable token still goes back to Telegram (no order hint)', () => {
  for (const q of ['?src=tma', '?src=tma&token=short', '?src=tma&token=bad%20token%20with%20spaces%20xxxxxxxx']) {
    const r = land(BASE + q);
    assert.equal(r.link.textContent, 'Вернуться в Telegram', q);
    assert.equal(r.link.href, RU_TG_APP, q);
  }
});

test('2. any other visitor gets the plain Mini App entry — never a hidden /ru/ page', () => {
  for (const q of ['', `?token=${TOKEN}`, '?src=site', '?src=TMA', `?token=${TOKEN}&src=web`]) {
    const r = land(BASE + q);
    assert.equal(r.link.href, RU_TG_APP, q || 'no query');
    assert.equal(r.link.textContent, 'Открыть Magic eSIM в Telegram', q || 'no query');
    assert.equal(r.boot.tma, false);
    assert.equal(r.boot.ref, '');
  }
  // the static default, without JavaScript
  const btn = PAGE.match(/<a class="btn" id="pfBack" href="([^"]+)">([^<]+)<\/a>/);
  assert.deepEqual([btn[1], btn[2]], [RU_TG_APP, 'Открыть Magic eSIM в Telegram']);
});

test('3. the token never survives the bootstrap: URL cleaned, history state null, only six chars in memory', () => {
  const r = land(`${BASE}?token=${TOKEN}&src=tma&utm_source=x#h`);
  assert.equal(r.replaced.length, 1);
  assert.equal(r.replaced[0].state, null);
  assert.equal(r.replaced[0].url, '/payment-failed.html?utm_source=x#h');
  assert.equal(JSON.stringify(r.boot).includes(TOKEN), false);
  assert.equal(JSON.stringify(r.boot).includes(TOKEN.slice(0, 7)), false);
  assert.doesNotMatch(BOOT[0], /localStorage|sessionStorage|document\.cookie|console\.|innerHTML/);
  const p = land(`${BASE}?public_order_token=${TOKEN}&src=tma`);
  assert.equal(p.replaced[0].url, '/payment-failed.html');
  assert.equal(p.link.href, `https://t.me/magicesim_bot?startapp=o_${TOKEN.slice(-6)}`);
});

test('3b. no button on the page, or no bootstrap result: nothing throws', () => {
  assert.doesNotThrow(() => land(`${BASE}?token=${TOKEN}&src=tma`, { withLink: false }));
  const link = { href: RU_TG_APP, textContent: 'x' };
  new Function('window', 'document', RETURN[0])({}, { getElementById: () => link });
  assert.equal(link.href, RU_TG_APP);
});

test('4. every link on the page leads to something published today', () => {
  assert.ok(PAGE.includes(RU_PAY_RETURN_HEADER), 'header = seo/ru-chrome.mjs RU_PAY_RETURN_HEADER');
  assert.ok(PAGE.includes(RU_PAY_RETURN_FOOTER), 'footer = seo/ru-chrome.mjs RU_PAY_RETURN_FOOTER');
  const body = PAGE.slice(PAGE.indexOf('<body>')).replace(/<!--[\s\S]*?-->/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
  const hrefs = [...body.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
  // the logo's <use href> points at the published sprite, never at a page
  for (const m of body.matchAll(/<use\b[^>]*\shref="([^"]+)"/g)) assert.match(m[1], /^\/assets\/brand\/logo\.svg\?v=[0-9a-f]{8}#me-(symbol|word)$/);
  assert.ok(hrefs.length >= 6, `links read (${hrefs.length})`);
  for (const h of hrefs) assert.ok(RU_PAY_RETURN_LINKS.includes(h), `${h} is not a published destination`);
  assert.doesNotMatch(PAGE.replace(/<!--[\s\S]*?-->/g, ''), /href="\/ru\/(#|esim|")|href="\/terms\.html"|href="\/privacy\.html"|'\/ru\/esim\/'/);
  const published = new Set(planArtifact(ROOT).publish);
  assert.ok(published.has('payment-failed.html'), 'the page itself is published');
  for (const h of RU_PAY_RETURN_LINKS.filter((x) => x.startsWith('/'))) assert.ok(published.has(h.slice(1)), `${h} is in the Pages artifact`);
  assert.equal(published.has('ru/index.html'), false, 'the proof: /ru/ is not published, so linking it would be a 404');
});

test('5. the page cannot create or repeat a payment: no request, goal at most once', () => {
  const code = PAGE.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|sendBeacon|<form\b|MagicNet|\/api\/v1\//, 'no network call of our own');
  assert.doesNotMatch(code, /platega/i);
  const m = new Map([['magic_pay_ctx', JSON.stringify({ payment_type: 'card', country_code: 'TH', package_id: 'p', order_ref: 'AbC123', _ts: Date.now() })]]);
  const ss = { getItem: (k) => (m.has(k) ? m.get(k) : null), removeItem: (k) => m.delete(k), setItem: (k, v) => m.set(k, v) };
  const goals = [];
  const win = { magicMetrikaGoal: (n) => goals.push(n) };
  new Function('window', 'sessionStorage', GOAL[0])(win, ss);
  new Function('window', 'sessionStorage', GOAL[0])(win, ss);
  assert.deepEqual(goals, ['payment_failed']);
});
