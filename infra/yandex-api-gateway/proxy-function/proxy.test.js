'use strict';

// ============================================================================
// Tests for the retail proxy function.
//
// This function is the front door for every retail call the storefront makes:
// creating an order, quoting a promo code, reading an order's status, and the
// QR image whose URL is baked into every eSIM email already in a customer's
// inbox. It had no tests. `_internal` has been exported "so the test suite can
// exercise routing and CORS directly" since it was written, and no such suite
// existed in either repository.
//
// The upstream is never contacted. Two levels:
//
//   * the routing, masking and CORS decisions, called directly;
//   * the whole handler, with https.request stubbed, so what actually reaches
//     the upstream socket is observable. That is the only honest way to test a
//     header allowlist: asserting the constant contains a name proves the
//     constant, not the forwarding.
//
//   node --test proxy.test.js
// ============================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const https = require('node:https');
const { EventEmitter } = require('node:events');

// Stub https.request BEFORE requiring the function: it captures `https` at load
// time, and require() caching means both see the same object.
const captured = [];
let upstreamReply = { status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' };
let upstreamFails = null;

const realRequest = https.request;

https.request = function stubbedRequest(target, options, callback) {
  captured.push({ target, method: options.method, headers: { ...options.headers } });

  const req = new EventEmitter();
  let written = '';
  req.write = (chunk) => { written += chunk; return true; };
  req.destroy = () => {};
  req.end = () => {
    captured[captured.length - 1].body = written;

    setImmediate(() => {
      if (upstreamFails) {
        req.emit('error', Object.assign(new Error(upstreamFails), { code: upstreamFails }));
        return;
      }
      const res = new EventEmitter();
      res.statusCode = upstreamReply.status;
      res.headers = upstreamReply.headers;
      callback(res);
      setImmediate(() => {
        res.emit('data', Buffer.from(upstreamReply.body));
        res.emit('end');
      });
    });
  };

  // The handler attaches a 'socket' listener and reads socket.connecting.
  setImmediate(() => req.emit('socket', Object.assign(new EventEmitter(), { connecting: false })));

  return req;
};

const fn = require('./index');
const { ROUTES, matchRoute, logPath, corsHeaders, isRetrySafe, REQUEST_HEADERS, RESPONSE_HEADERS } = fn._internal;

test.after(() => { https.request = realRequest; });

function reset() {
  captured.length = 0;
  upstreamFails = null;
  upstreamReply = { status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' };
}

const call = (over = {}) => fn.handler({
  httpMethod: 'GET',
  path: '/health',
  headers: {},
  queryStringParameters: {},
  ...over,
});

// The nine routes that existed before the Mini App. Any change to this list is
// a change to what the storefront can reach, and must be deliberate.
const LEGACY_ROUTES = [
  ['GET', '/health'],
  ['GET', '/api/v1/retail/packages'],
  ['POST', '/api/v1/retail/promo/quote'],
  ['POST', '/api/v1/public/retail-orders'],
  ['POST', '/api/v1/public/retail-orders/tok_abc123/pay'],
  ['GET', '/api/v1/public/retail-orders/tok_abc123/status'],
  ['GET', '/api/v1/public/retail-esim/tok_abc123/qr.png'],
  ['GET', '/api/v1/public/private-payments/tok_abc123'],
  ['POST', '/api/v1/public/private-payments/tok_abc123/start'],
];

// ---------------------------------------------------------------------------
// ROUTES — the allowlist is the security boundary
// ---------------------------------------------------------------------------

test('every legacy route still matches', () => {
  for (const [method, path] of LEGACY_ROUTES) {
    assert.ok(matchRoute(method, path), `${method} ${path} stopped matching`);
  }
});

test('the allowlist has exactly the entries it is supposed to have', () => {
  // A count, so an accidental addition in a merge shows up as a failure rather
  // than as new reachable surface.
  const listed = ROUTES.map((r) => `${r.method} ${r.pattern}`).sort();

  assert.deepEqual(listed, [
    'GET /api/v1/public/private-payments/{token}',
    'GET /api/v1/public/retail-esim/{token}/qr.png',
    'GET /api/v1/public/retail-orders/{token}/status',
    'GET /api/v1/retail/packages',
    'GET /health',
    'POST /api/v1/public/private-payments/{token}/start',
    'POST /api/v1/public/retail-orders',
    'POST /api/v1/public/retail-orders/{token}/pay',
    'POST /api/v1/retail/promo/quote',
  ]);
});

test('the method is part of the match', () => {
  // A GET on an order-creating route must not be routed as if it were the POST.
  assert.equal(matchRoute('GET', '/api/v1/public/retail-orders'), null);
  assert.equal(matchRoute('POST', '/api/v1/retail/packages'), null);
  assert.equal(matchRoute('DELETE', '/api/v1/public/retail-orders'), null);
  assert.equal(matchRoute('PUT', '/health'), null);
});

test('a path parameter cannot introduce a segment or escape the path', () => {
  for (const evil of [
    '/api/v1/public/retail-orders/../admin/x/status',
    '/api/v1/public/retail-orders//status',
    '/api/v1/public/retail-orders/a%2Fb/status',
    '/api/v1/public/retail-orders/a b/status',
    '/api/v1/public/retail-orders/' + 'x'.repeat(129) + '/status',
    '/api/v1/public/retail-orders/tok/extra/status',
  ]) {
    assert.equal(matchRoute('GET', evil), null, `accepted ${evil}`);
  }
});

test('SEGMENT cannot be the guard against a slash, and does not need to be', () => {
  // Recorded rather than counted as a kill: widening SEGMENT to permit '/' does
  // not change a single test result, because matchRoute splits the path on '/'
  // before SEGMENT is ever consulted, so a segment cannot contain one. The
  // guard against extra segments is the length comparison, and that is what the
  // traversal cases above actually exercise.
  const segments = '/api/v1/public/retail-orders/a/b/status'.split('/');

  assert.ok(!segments.some((part) => part.includes('/')));
  assert.equal(segments.length, 8);
  assert.equal(matchRoute('GET', '/api/v1/public/retail-orders/a/b/status'), null,
    'refused on segment count, not on the character class');
});

test('admin and internal surfaces are not reachable', () => {
  for (const [method, path] of [
    ['GET', '/api/v1/packages'],                       // the dealer-aware catalogue
    ['GET', '/api/v1/admin/private-payment-links'],
    ['POST', '/api/v1/admin/sync'],
    ['GET', '/api/v1/client/esim/sometoken'],          // legacy client_token route
    ['GET', '/api/v1/status'],
    ['POST', '/api/v1/orders/purchase'],               // dealer purchase
    ['GET', '/.env'],
    ['GET', '/'],
  ]) {
    assert.equal(matchRoute(method, path), null, `${method} ${path} is reachable`);
  }
});

test('an unmatched path is refused without contacting the upstream', async () => {
  reset();
  const res = await call({ httpMethod: 'GET', path: '/api/v1/admin/sync' });

  assert.equal(res.statusCode, 404);
  assert.deepEqual(JSON.parse(res.body), { error: 'not_found' });
  assert.equal(captured.length, 0, 'a refused path must never reach the upstream');
});

test('an unknown path and a disallowed method answer identically', async () => {
  reset();
  const unknown = await call({ httpMethod: 'GET', path: '/api/v1/nope' });
  const badMethod = await call({ httpMethod: 'GET', path: '/api/v1/public/retail-orders' });

  assert.equal(unknown.statusCode, badMethod.statusCode);
  assert.equal(unknown.body, badMethod.body);
});

// ---------------------------------------------------------------------------
// Header forwarding — what actually reaches the socket
// ---------------------------------------------------------------------------

test('only the allowlisted request headers travel upstream', async () => {
  reset();
  await call({
    httpMethod: 'GET',
    path: '/api/v1/retail/packages',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Language': 'ru-RU',
      'Cookie': 'session=SHOULD-NOT-TRAVEL',
      'X-Forwarded-For': '203.0.113.9',
      'X-Api-Key': 'SHOULD-NOT-TRAVEL',
      'Host': 'api.magicesim.store',
    },
  });

  assert.equal(captured.length, 1);
  const sent = captured[0].headers;

  assert.equal(sent['accept-language'], 'ru-RU');
  for (const forbidden of ['cookie', 'x-forwarded-for', 'x-api-key', 'host']) {
    assert.equal(sent[forbidden], undefined, `${forbidden} reached the upstream`);
  }
  assert.ok(!JSON.stringify(sent).includes('SHOULD-NOT-TRAVEL'));
});

test('header names are matched case-insensitively', async () => {
  reset();
  await call({
    httpMethod: 'GET',
    path: '/api/v1/retail/packages',
    headers: { 'ACCEPT-LANGUAGE': 'ru-RU' },
  });

  assert.equal(captured[0].headers['accept-language'], 'ru-RU');
});

test('a POST body travels, with an explicit content-length', async () => {
  reset();
  const body = JSON.stringify({ package_id: 'p1', email: 'a@b.c' });
  await call({ httpMethod: 'POST', path: '/api/v1/retail/promo/quote', body });

  assert.equal(captured[0].body, body);
  assert.equal(captured[0].headers['content-length'], String(Buffer.byteLength(body)));
  // Without an explicit length Node streams chunked and this upstream rejects it.
  assert.ok(captured[0].headers['content-length']);
});

test('an oversized body is refused before the upstream is contacted', async () => {
  reset();
  const res = await call({
    httpMethod: 'POST',
    path: '/api/v1/public/retail-orders',
    body: 'x'.repeat(64 * 1024 + 1),
  });

  assert.equal(res.statusCode, 413);
  assert.equal(captured.length, 0);
});

// ---------------------------------------------------------------------------
// CORS and preflight
// ---------------------------------------------------------------------------

test('preflight answers 204 with the storefront origin, and never contacts upstream', async () => {
  reset();
  const res = await call({ httpMethod: 'OPTIONS', path: '/api/v1/public/retail-orders' });

  assert.equal(res.statusCode, 204);
  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://magicesim.store');
  assert.equal(res.headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS');
  assert.equal(captured.length, 0);
});

test('the allowed origin is a constant, never a reflection of the caller', async () => {
  // Reflecting Origin — or omitting the header and letting the gateway fill in
  // `*` — would let any site read an order's status if it learned the token.
  reset();
  const res = await call({
    httpMethod: 'OPTIONS',
    path: '/api/v1/public/retail-orders',
    headers: { Origin: 'https://evil.example' },
  });

  assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://magicesim.store');
  assert.ok(!JSON.stringify(res.headers).includes('evil.example'));
});

test('CORS headers are present on refusals too, not just on success', async () => {
  reset();
  const notFound = await call({ httpMethod: 'GET', path: '/api/v1/nope' });
  const tooLarge = await call({
    httpMethod: 'POST', path: '/api/v1/public/retail-orders', body: 'x'.repeat(64 * 1024 + 1),
  });

  for (const res of [notFound, tooLarge]) {
    assert.equal(res.headers['Access-Control-Allow-Origin'], 'https://magicesim.store');
  }
});

test('the Allow-Headers list is exactly what the storefront sends', () => {
  assert.equal(corsHeaders()['Access-Control-Allow-Headers'], 'Content-Type, Accept');
});

// ---------------------------------------------------------------------------
// Masking — a log must not become a credential store
// ---------------------------------------------------------------------------

test('a matched route logs its pattern, so the token cannot leak by construction', () => {
  const route = matchRoute('GET', '/api/v1/public/retail-esim/SECRET-TOKEN/qr.png');

  assert.ok(route);
  const logged = logPath('/api/v1/public/retail-esim/SECRET-TOKEN/qr.png', route);
  assert.equal(logged, '/api/v1/public/retail-esim/{token}/qr.png');
  assert.ok(!logged.includes('SECRET-TOKEN'));
});

test('an unmatched token-bearing path is blanked defensively', () => {
  for (const path of [
    '/api/v1/public/retail-esim/SECRET-TOKEN/nope',
    '/api/v1/public/retail-orders/SECRET-TOKEN/nope',
    '/api/v1/public/private-payments/SECRET-TOKEN/nope',
  ]) {
    const logged = logPath(path, null);
    assert.ok(!logged.includes('SECRET-TOKEN'), `${path} logged its token`);
    assert.ok(logged.includes('{token}'));
  }
});

test('the QR token never appears in a log line', async () => {
  reset();
  const lines = [];
  const realLog = console.log;
  console.log = (...args) => lines.push(args.join(' '));

  try {
    await call({ httpMethod: 'GET', path: '/api/v1/public/retail-esim/LIVE-QR-SECRET/qr.png' });
    await call({ httpMethod: 'GET', path: '/api/v1/public/retail-esim/LIVE-QR-SECRET/unmatched' });
  } finally {
    console.log = realLog;
  }

  assert.ok(lines.length > 0, 'the function must log something, or this proves nothing');
  assert.ok(!lines.join('\n').includes('LIVE-QR-SECRET'));
});

// ---------------------------------------------------------------------------
// Retry safety — a retried POST is a second order
// ---------------------------------------------------------------------------

test('a POST is never retried once the request may have been sent', () => {
  assert.equal(isRetrySafe('POST', true), false);
  assert.equal(isRetrySafe('POST', false), true);
  assert.equal(isRetrySafe('GET', true), true);
  assert.equal(isRetrySafe('GET', false), true);
});

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

test('the upstream status and body pass through untouched', async () => {
  reset();
  upstreamReply = {
    status: 409,
    headers: { 'content-type': 'application/json' },
    body: '{"error":"PROMO_CODE_EXPIRED"}',
  };
  const res = await call({ httpMethod: 'POST', path: '/api/v1/retail/promo/quote', body: '{}' });

  assert.equal(res.statusCode, 409, 'a 4xx must stay that 4xx or the storefront loses the real reason');
  assert.equal(Buffer.from(res.body, 'base64').toString(), '{"error":"PROMO_CODE_EXPIRED"}');
});

test("the QR route's no-store headers survive the proxy", async () => {
  reset();
  upstreamReply = {
    status: 200,
    headers: { 'content-type': 'image/png', 'cache-control': 'private, no-store', pragma: 'no-cache', expires: '0' },
    body: 'PNGDATA',
  };
  const res = await call({ httpMethod: 'GET', path: '/api/v1/public/retail-esim/tok_abc/qr.png' });

  assert.equal(res.headers['Cache-Control'], 'private, no-store');
  assert.equal(res.headers['Pragma'], 'no-cache');
  assert.equal(res.headers['Expires'], '0');
});

test("the upstream's own headers are dropped", async () => {
  reset();
  upstreamReply = {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'rndr-id': 'abc-123',
      'x-render-origin-server': 'Render',
      'set-cookie': 'a=b',
      server: 'cloudflare',
    },
    body: '{}',
  };
  const res = await call({ httpMethod: 'GET', path: '/api/v1/retail/packages' });

  for (const leaked of ['rndr-id', 'Rndr-Id', 'x-render-origin-server', 'set-cookie', 'Set-Cookie', 'server', 'Server']) {
    assert.equal(res.headers[leaked], undefined, `${leaked} reached the client`);
  }
  assert.ok(!JSON.stringify(res.headers).includes('Render'));
});

test('the response header allowlist is exactly these six', () => {
  assert.deepEqual(RESPONSE_HEADERS,
    ['content-type', 'cache-control', 'pragma', 'expires', 'etag', 'retry-after']);
});

test('an unreachable upstream answers 502 without naming the host', async () => {
  reset();
  upstreamFails = 'ECONNREFUSED';
  const res = await call({ httpMethod: 'GET', path: '/api/v1/retail/packages' });

  assert.equal(res.statusCode, 502);
  assert.deepEqual(JSON.parse(res.body), { error: 'upstream_unreachable' });
  assert.ok(!res.body.includes('onrender'), 'the upstream host must never reach the client');
});

// ---------------------------------------------------------------------------
// The request header allowlist as a constant
// ---------------------------------------------------------------------------

test('the request header allowlist is exactly what it is meant to be', () => {
  assert.deepEqual(REQUEST_HEADERS, ['content-type', 'accept', 'accept-language']);
});

// NOTE: the Telegram Mini App section lives on main (commit c5f253b) together
// with the routes it tests. This branch is the code that is actually deployed,
// so that it can carry observability to production without also carrying B-6.
