// /payment-success.html when /assets/magic-net.js did not load (2026-11-20).
//
// A live check a minute after a deploy got the page without the network layer:
// the first MagicNet.request threw inside poll(), poll() never rescheduled, and
// the page stayed on «Проверяем оплату» for ever. The page now loads the layer
// again from the SAME <script> tag's src and treats a poll without it as a failed
// attempt. This runs the page's REAL bottom script in a sandbox (stub DOM, stub
// network, manual timers) and pins:
//   A. with the layer present nothing changed — same status URL, same options;
//   B. the layer missing, one reload that works → the order status is shown;
//   C. the layer never loads → retries, never two loads at a time, and the page
//      ends on the neutral fallback after MAX attempts instead of a spinner;
//   D. the reload uses the tag's own src — no host typed anywhere.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = readFileSync(join(ROOT, 'payment-success.html'), 'utf8');
const TAG_SRC = PAGE.match(/<script src="(\/assets\/magic-net\.js\?v=[0-9a-f]{8})"><\/script>/)[1];
const scripts = [...PAGE.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const MAIN = scripts.find((s) => s.includes('function poll()'));
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-XYZ12';

function sandbox({ netAtStart = true, reloadWorks = false, status = 'completed', code = MAIN } = {}) {
  const els = {};
  const el = (id) => (els[id] ||= { id, textContent: '', classList: { add() {}, remove() {} }, remove() {}, insertBefore() {}, firstChild: null, setAttribute() {} });
  const timers = [];
  const appended = [];
  const requests = [];
  const MagicNet = { request: (url, opts) => { requests.push({ url, opts }); return Promise.resolve({ ok: true, body: { status, paymentStatus: 'confirmed', amountRub: 100, currency: 'RUB' } }); } };
  const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
  const window = { __payBoot: { token: TOKEN, src: '' }, MagicNet: netAtStart ? MagicNet : undefined, magicMetrikaGoal() {} };
  const document = {
    getElementById: el,
    createElement: () => ({}),
    querySelector: (sel) => (sel === 'script[src^="/assets/magic-net.js"]' ? { getAttribute: (a) => (a === 'src' ? TAG_SRC : null) } : null),
    head: { appendChild: (s) => { appended.push(s); queueMicrotask(() => { if (reloadWorks) { window.MagicNet = MagicNet; s.onload(); } else s.onerror(); }); } },
  };
  const ctx = vm.createContext({ window, document, sessionStorage: store(), localStorage: store(), setTimeout: (fn, ms) => timers.push({ fn, ms }), Promise, Date, JSON, Number, String, Math, isFinite, Array, Object, encodeURIComponent, Error, queueMicrotask, console });
  try { vm.runInContext(code, ctx); } catch (e) { ctx.__threw = e; }
  const settle = () => new Promise((r) => setImmediate(r));
  return { els, timers, appended, requests, settle, ctx, title: () => el('title').textContent };
}

test('the script under test is the page\'s own, and it calls the layer only through withNet()', () => {
  assert.ok(MAIN && TAG_SRC);
  const body = MAIN.slice(MAIN.indexOf('function poll()'), MAIN.indexOf('\n      poll();'));
  assert.doesNotMatch(body, /MagicNet\.request/, 'no direct call that can throw a ReferenceError');
  assert.match(body, /withNet\(\)/);
});

test('A. the layer present: the same status request as before, and the order is shown', async () => {
  const s = sandbox({ netAtStart: true });
  await s.settle();
  assert.equal(s.appended.length, 0, 'nothing reloaded');
  assert.equal(s.requests.length, 1);
  assert.equal(s.requests[0].url, `/api/v1/public/retail-orders/${encodeURIComponent(TOKEN)}/status`);
  assert.deepEqual(JSON.parse(JSON.stringify(s.requests[0].opts)), { kind: 'status', headers: { Accept: 'application/json' } });
  assert.equal(s.title(), 'eSIM готова');
});

test('B. the layer missing, one reload works: the order status is shown', async () => {
  const s = sandbox({ netAtStart: false, reloadWorks: true });
  await s.settle();
  assert.equal(s.appended.length, 1);
  assert.equal(s.appended[0].src, TAG_SRC, 'D. the same tag\'s src — no typed host');
  assert.equal(s.requests.length, 1);
  assert.equal(s.title(), 'eSIM готова');
});

test('C. the layer never loads: retried, one load at a time, and it ENDS on the neutral fallback', async () => {
  const s = sandbox({ netAtStart: false, reloadWorks: false });
  await s.settle();
  assert.equal(s.appended.length, 1);
  assert.equal(s.title(), 'Проверяем оплату', 'processing while it retries');
  let rounds = 0;
  while (s.timers.length && rounds < 100) {
    const t = s.timers.shift();
    assert.equal(t.ms, 5000, 'a failed attempt waits like any failed status read');
    t.fn();
    await s.settle();
    rounds++;
  }
  assert.equal(s.timers.length, 0, 'polling stopped');
  assert.equal(s.appended.length, 40, 'one load per attempt, MAX attempts');
  assert.equal(s.requests.length, 0);
  assert.equal(s.els.message.textContent, 'Если вы завершили оплату, детали eSIM придут на указанный email. По вопросам — напишите в поддержку.', 'the neutral fallback');
});

test('the proof: the page BEFORE this change, without the layer, stops on the spinner for good', async () => {
  const old = execFileSync('git', ['show', 'a8b2bf4d8:payment-success.html'], { cwd: ROOT, encoding: 'utf8' });
  const oldMain = [...old.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((x) => x.includes('function poll()'));
  const s = sandbox({ netAtStart: false, code: oldMain });
  await s.settle();
  assert.ok(s.ctx.__threw instanceof Error || s.ctx.__threw, 'MagicNet.request threw');
  assert.equal(s.timers.length, 0, 'nothing rescheduled');
  assert.equal(s.title(), 'Проверяем оплату', 'and the page says so for ever');
});
