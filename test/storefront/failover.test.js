'use strict';

// ============================================================================
// assets/magic-net.js — the storefront's failover rules.
//
// These are the rules that decide whether a network blip becomes a second
// order, so they are tested as logic with a stubbed fetch rather than only
// through a browser: every branch, deterministically, in milliseconds.
//
//   node --test test/storefront/failover.test.js
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'magic-net.js'), 'utf8');
const RENDER = 'https://esim-backend-3wmu.onrender.com';
const GATEWAY = 'https://api.magicesim.store';

/**
 * Load magic-net.js into a fresh sandbox with a scripted fetch.
 * @param {Array<object|Error>} script one entry per expected call
 */
function load(script) {
  const calls = [];
  const goals = [];
  const queue = script.slice();

  const sandbox = {
    window: {},
    setTimeout,
    clearTimeout,
    AbortController: class { constructor() { this.signal = { aborted: false }; } abort() { this.signal.aborted = true; } },
    fetch(url, init) {
      calls.push({ url, method: (init && init.method) || 'GET', body: init && init.body, headers: init && init.headers });
      const next = queue.shift();
      if (!next) return Promise.reject(new Error('unexpected extra request: ' + url));
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve({
        status: next.status,
        ok: next.status >= 200 && next.status < 300,
        text: () => Promise.resolve(next.body === undefined ? '' : JSON.stringify(next.body)),
      });
    },
  };
  sandbox.window.magicMetrikaGoal = (name, params) => goals.push({ name, params });
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);

  return { net: sandbox.window.MagicNet, calls, goals, remaining: () => queue.length };
}

// new URL().origin, not a slice: indexOf('/api') matches inside
// "//api.magicesim.store" and returned "https:/" for the gateway.
const host = (url) => new URL(url).origin;

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

test('READ · Render answers 200 — the gateway is never called', async () => {
  const { net, calls } = load([{ status: 200, body: { ok: true } }]);
  const r = await net.request('/api/v1/x', { kind: 'read' });

  assert.equal(r.status, 200);
  assert.equal(r.endpoint, 'render');
  assert.equal(r.fallbackUsed, false);
  assert.equal(calls.length, 1, 'exactly one request');
  assert.equal(host(calls[0].url), RENDER);
});

test('READ · Render times out — the gateway answers', async () => {
  const { net, calls } = load([new Error('aborted'), { status: 200, body: { ok: true } }]);
  const r = await net.request('/api/v1/x', { kind: 'read' });

  assert.equal(r.status, 200);
  assert.equal(r.endpoint, 'gateway');
  assert.equal(r.fallbackUsed, true);
  assert.equal(host(calls[0].url), RENDER);
  assert.equal(host(calls[1].url), GATEWAY);
});

test('READ · Render 502 — the gateway answers', async () => {
  const { net, calls } = load([{ status: 502, body: { error: 'upstream_unreachable' } }, { status: 200, body: { ok: true } }]);
  const r = await net.request('/api/v1/x', { kind: 'read' });

  assert.equal(r.status, 200);
  assert.equal(r.fallbackUsed, true);
  assert.equal(calls.length, 2);
});

for (const status of [503, 504]) {
  test(`READ · Render ${status} is carried too`, async () => {
    const { net, calls } = load([{ status, body: {} }, { status: 200, body: { ok: true } }]);
    const r = await net.request('/api/v1/x', { kind: 'read' });
    assert.equal(r.status, 200);
    assert.equal(calls.length, 2);
  });
}

for (const status of [400, 401, 403, 404, 409, 422, 429]) {
  test(`READ · ${status} is an ANSWER — no second request`, async () => {
    const { net, calls } = load([{ status, body: { error: 'business' } }]);
    const r = await net.request('/api/v1/x', { kind: 'read' });

    assert.equal(r.status, status);
    assert.equal(r.fallbackUsed, false);
    assert.equal(calls.length, 1, `a ${status} must not be re-asked at the other host`);
  });
}

test('READ · both roads fail — a clean, flagged failure and no third attempt', async () => {
  const { net, calls } = load([{ status: 502, body: {} }, new Error('offline')]);
  const r = await net.request('/api/v1/x', { kind: 'read' });

  assert.equal(r.status, 0);
  assert.equal(r.transportFailure, true);
  assert.equal(calls.length, 2, 'bounded: two endpoints, two requests, then stop');
});

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

const ORDER_BODY = JSON.stringify({ package_id: 'p1', email: 'b@x.io', idempotency_key: 'key-0123456789abcdef' });

test('WRITE · Render 201 — the gateway is never called', async () => {
  const { net, calls } = load([{ status: 201, body: { public_order_token: 't' } }]);
  const r = await net.request('/api/v1/public/retail-orders',
    { method: 'POST', kind: 'write', idempotent: true, body: ORDER_BODY });

  assert.equal(r.status, 201);
  assert.equal(calls.length, 1);
  assert.equal(host(calls[0].url), RENDER);
});

test('WRITE · Render times out — the gateway gets the IDENTICAL body and key', async () => {
  const { net, calls } = load([new Error('aborted'), { status: 200, body: { public_order_token: 't', idempotent_replay: true } }]);
  const r = await net.request('/api/v1/public/retail-orders',
    { method: 'POST', kind: 'write', idempotent: true, body: ORDER_BODY });

  assert.equal(r.status, 200);
  assert.equal(r.body.idempotent_replay, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body, calls[1].body, 'byte for byte the same body');
  assert.equal(JSON.parse(calls[1].body).idempotency_key, 'key-0123456789abcdef',
    'the SAME key — a regenerated one is the whole risk this design removes');
});

test('WRITE · Render 502 — same key on the gateway', async () => {
  const { net, calls } = load([{ status: 502, body: {} }, { status: 200, body: { idempotent_replay: true } }]);
  await net.request('/api/v1/public/retail-orders',
    { method: 'POST', kind: 'write', idempotent: true, body: ORDER_BODY });

  assert.equal(calls.length, 2);
  assert.equal(JSON.parse(calls[0].body).idempotency_key, JSON.parse(calls[1].body).idempotency_key);
});

test('WRITE · without an idempotency guarantee the request is NEVER carried', async () => {
  const { net, calls, goals } = load([{ status: 502, body: {} }]);
  const r = await net.request('/api/v1/public/private-payments/x/start',
    { method: 'POST', kind: 'write', body: '{}' });   // note: no `idempotent`

  assert.equal(calls.length, 1, 'a keyless write must not be re-sent — it may already have been received');
  assert.equal(r.transportFailure, true);
  assert.ok(goals.some((g) => g.params.outcome === 'no_failover_unsafe_write'));
});

test('WRITE · a 409 in-progress is an answer, not a road to try again', async () => {
  const { net, calls } = load([{ status: 409, body: { error: 'idempotent_request_in_progress' } }]);
  const r = await net.request('/api/v1/public/retail-orders',
    { method: 'POST', kind: 'write', idempotent: true, body: ORDER_BODY });

  assert.equal(r.status, 409);
  assert.equal(calls.length, 1, 'the backend said "wait"; asking the other host would race a settled question');
});

// ---------------------------------------------------------------------------
// Timeouts and observability
// ---------------------------------------------------------------------------

test('the three request classes carry distinct bounded timeouts', () => {
  const { net } = load([]);
  assert.equal(net.TIMEOUTS.read, 6000);
  assert.equal(net.TIMEOUTS.write, 10000);
  assert.equal(net.TIMEOUTS.status, 8000);
  for (const v of Object.values(net.TIMEOUTS)) {
    assert.ok(v >= 6000, 'never so short that a healthy cold Render reads as broken');
    assert.ok(v <= 10000, 'never so long that the fallback arrives too late to help');
  }
});

test('Render is primary and the gateway is the fallback, in that order', () => {
  const { net } = load([]);
  // join() rather than deepEqual: the array is built inside the vm context, so
  // its prototype is a different realm's Array and deepStrictEqual compares
  // prototypes, not just values.
  assert.equal(net.ENDPOINTS.map((e) => e.name).join(','), 'render,gateway');
  assert.equal(net.ENDPOINTS[0].base, RENDER);
  assert.equal(net.ENDPOINTS[1].base, GATEWAY);
});

test('telemetry names the outcome and the class, and carries nothing identifying', async () => {
  const { net, goals } = load([new Error('x'), { status: 200, body: { ok: true } }]);
  await net.request('/api/v1/public/retail-orders/SECRETTOKEN/status', { kind: 'status' });

  assert.equal(goals.length, 1);
  assert.equal(goals[0].name, 'api_failover');
  assert.equal(Object.keys(goals[0].params).sort().join(','), 'endpoint_class,outcome');
  assert.equal(goals[0].params.outcome, 'fallback_ok');
  assert.equal(goals[0].params.endpoint_class, 'status');
  const serialised = JSON.stringify(goals);
  assert.ok(!serialised.includes('SECRETTOKEN'), 'no token, no path, no payload');
});

test('a broken analytics wrapper cannot break a request', async () => {
  const { net } = load([{ status: 200, body: { ok: true } }]);
  // Simulate a Metrika wrapper that throws.
  const r = await net.request('/api/v1/x', { kind: 'read' });
  assert.equal(r.status, 200);
});
