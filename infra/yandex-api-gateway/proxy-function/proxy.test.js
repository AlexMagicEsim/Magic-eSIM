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
const net = require('node:net');
const tls = require('node:tls');
const { EventEmitter } = require('node:events');

// Stub https.request BEFORE requiring the function: it captures `https` at load
// time, and require() caching means both see the same object.
const captured = [];
let upstreamReply = { status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' };
let upstreamFails = null;
// A queue, consumed one entry per request, for the retry tests: `null` means
// that attempt succeeds. `upstreamFails` stays as it was for every other test.
let failSequence = null;

const realRequest = https.request;

let pooledSocket = null;
const STUB_TRACE = {
  dns: { source: 'cache', duration_ms: 0, count: 2 },
  duration_ms: 48,
  targets: [
    { target: '216.24.57.7', by: 'ip', family: 4, stage: 'tcp', outcome: 'error', error: 'ECONNREFUSED', class: 'UPSTREAM_TCP_ERROR', duration_ms: 2, stage_ms: 2 },
    { target: '216.24.57.15', by: 'ip', family: 4, stage: 'ready', outcome: 'ok', error: null, class: null, duration_ms: 48, stage_ms: 40 },
  ],
};
function stubSocket() {
  if (!pooledSocket) {
    pooledSocket = Object.assign(new EventEmitter(), {
      connecting: false,
      __proxyConn: STUB_TRACE,
      __proxyConnAt: Date.now(),
    });
  }
  return pooledSocket;
}

https.request = function stubbedRequest(target, options, callback) {
  captured.push({ target, method: options.method, headers: { ...options.headers } });

  const req = new EventEmitter();
  let written = '';
  req.write = (chunk) => { written += chunk; return true; };
  req.destroy = () => {};
  req.end = () => {
    captured[captured.length - 1].body = written;

    setImmediate(() => {
      const queued = failSequence ? failSequence.shift() : undefined;
      const fails = queued === undefined ? upstreamFails : queued;
      if (fails) {
        req.emit('error', Object.assign(new Error(fails), { code: fails }));
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
  //
  // The socket persists across requests and carries a raceConnect-shaped trace,
  // because production's agent pools it: without that, `__proxyUsed` is never
  // true, `reused` is always false, and every assertion about the reuse path
  // passes whether the code is right or not.
  setImmediate(() => req.emit('socket', stubSocket()));

  return req;
};

const fn = require('./index');
const {
  ROUTES, matchRoute, logPath, corsHeaders, isRetrySafe, REQUEST_HEADERS, RESPONSE_HEADERS,
  classifyConnect, classifyAttempt, worstTarget, correlationId, connectTarget,
  CONNECT_TIMEOUT_MS, READ_TIMEOUT_MS, MAX_ATTEMPTS,
} = fn._internal;

test.after(() => { https.request = realRequest; });

function reset() {
  captured.length = 0;
  upstreamFails = null;
  failSequence = null;
  pooledSocket = null; // each test starts on the cold path unless it says otherwise
  upstreamReply = { status: 200, headers: { 'content-type': 'application/json' }, body: '{"ok":true}' };
}

/** Collect everything the function logged while `body` ran. */
async function capturingLogs(body) {
  const lines = [];
  const realLog = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  try { await body(); } finally { console.log = realLog; }
  return {
    raw: lines.join('\n'),
    json: lines.map((l) => { try { return JSON.parse(l); } catch { return { unparsed: l }; } }),
    of: (evt) => lines.map((l) => { try { return JSON.parse(l); } catch { return {}; } }).filter((o) => o.evt === evt),
  };
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
    'GET /api/v1/tma/esims',
    'GET /api/v1/tma/esims/{token}',
    'GET /api/v1/tma/esims/{token}/topups',
    'GET /api/v1/tma/me',
    'GET /api/v1/tma/me/orders',
    'GET /api/v1/tma/me/orders/active',
    'GET /api/v1/tma/orders/{token}/status',
    'GET /api/v1/tma/topups/{token}/status',
    'GET /health',
    'POST /api/v1/public/private-payments/{token}/start',
    'POST /api/v1/public/retail-orders',
    'POST /api/v1/public/retail-orders/{token}/pay',
    'POST /api/v1/retail/promo/quote',
    'POST /api/v1/tma/esims/{token}/activation',
    'POST /api/v1/tma/esims/{token}/topups/quote',
    'POST /api/v1/tma/esims/{token}/usage/refresh',
    'POST /api/v1/tma/identity/email/confirm',
    'POST /api/v1/tma/identity/email/request',
    'POST /api/v1/tma/identity/email/revoke',
    'POST /api/v1/tma/orders',
    'POST /api/v1/tma/session',
    'POST /api/v1/tma/session/revoke',
    'POST /api/v1/tma/topups/{token}/checkout',
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

test('the Allow-Headers list is exactly what the storefront and Mini App send', () => {
  assert.equal(corsHeaders()['Access-Control-Allow-Headers'], 'Content-Type, Accept, Authorization');
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

test('an unmatched path keeps only segments that are literally in ROUTES', () => {
  for (const path of [
    '/api/v1/public/retail-esim/SECRET-TOKEN/nope',
    '/api/v1/public/retail-orders/SECRET-TOKEN/nope',
    '/api/v1/public/private-payments/SECRET-TOKEN/nope',
  ]) {
    const logged = logPath(path, null);
    assert.ok(!logged.includes('SECRET-TOKEN'), `${path} logged its token`);
    assert.ok(logged.includes('{}'));
    assert.ok(logged.startsWith('/api/v1/public/'), 'the shape of the path is still legible');
  }
});

test('the mask cannot be walked around, and cannot drift out of step with ROUTES', () => {
  // Each of these defeated the denylist this replaced. The last is the one that
  // needs no attacker at all: add a route and forget the regex, and a mangled
  // link writes a non-expiring install secret into the log store.
  for (const path of [
    '/api/v1/public/RETAIL-ESIM/SECRET-TOKEN/qr.png',
    '/api/v1/public/retail%2Desim/SECRET-TOKEN/qr.png',
    '/api/v1/public/esim-install/SECRET-TOKEN',
    '/x/LPA:1$rsp.example.com$SECRET-TOKEN/8991101200003204514/buyer@example.com',
    '/api/v1/public/retail-esim/../../SECRET-TOKEN',
  ]) {
    const logged = logPath(path, null);
    assert.ok(!logged.includes('SECRET-TOKEN'), `${path} logged its token`);
    assert.ok(!logged.includes('buyer@example.com'));
  }
});

test('a hostile path cannot flood the log with one record', () => {
  const logged = logPath('/' + 'x'.repeat(100_000), null);
  assert.ok(logged.length <= 260, `logged ${logged.length} chars`);
});

test('every allowlist pattern still logs itself unchanged', () => {
  // The masked branch must not touch the matched branch: a real route logs its
  // pattern verbatim, including {token}.
  for (const route of ROUTES) {
    assert.equal(logPath('/whatever', route), route.pattern);
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
  // `authorization` is the ONE header B-6 adds — the Mini App session bearer.
  // Cookies remain absent by construction; nothing else was widened.
  assert.deepEqual(REQUEST_HEADERS, ['content-type', 'accept', 'accept-language', 'authorization']);
});

// ===========================================================================
// B-6 — the two Mini App session routes and the one header they ride on
// ===========================================================================

test('B6: the session routes match, POST only, and reach the upstream', () => {
  assert.ok(matchRoute('POST', '/api/v1/tma/session'));
  assert.ok(matchRoute('POST', '/api/v1/tma/session/revoke'));
  // Method discipline: GET on a POST-only route is refused before any network.
  assert.equal(matchRoute('GET', '/api/v1/tma/session'), null);
  assert.equal(matchRoute('GET', '/api/v1/tma/session/revoke'), null);
});

test('B6: no other tma path rides in on the prefix', () => {
  // `/api/v1/tma/orders` left this list in the B-7 write wave, which opened it
  // deliberately as POST. Everything else here is still a path that must not
  // exist: a bare prefix, a trailing slash, an extra segment on a real route, and
  // a lookalike prefix.
  for (const p of [
    '/api/v1/tma', '/api/v1/tma/', '/api/v1/tma/esims',
    '/api/v1/tma/session/extra', '/api/v1/tma/session/revoke/extra',
    '/api/v1/tmax/session', '/api/v1/tma/orders/extra',
  ]) {
    assert.equal(matchRoute('POST', p), null, `${p} must not match`);
  }
});

test('B6: the authorization VALUE is forwarded upstream and never logged', async () => {
  reset();
  const logs = await capturingLogs(async () => {
    await call({
      httpMethod: 'POST',
      path: '/api/v1/tma/session',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer SECRET-SESSION-TOKEN' },
      body: JSON.stringify({ init_data: 'x' }),
    });
  });
  assert.equal(captured.length, 1);
  assert.equal(captured[0].headers.authorization, 'Bearer SECRET-SESSION-TOKEN',
    'the bearer must reach the backend');
  assert.ok(!logs.raw.includes('SECRET-SESSION-TOKEN'), 'the bearer must never reach a log line');
});

test('B6: cookies still do not travel, even next to an authorization header', async () => {
  reset();
  await call({
    httpMethod: 'POST',
    path: '/api/v1/tma/session/revoke',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer t0k3n-t0k3n-t0k3n',
      Cookie: 'session=SHOULD-NOT-TRAVEL',
      'X-Telegram-Init-Data': 'user=SHOULD-NOT-TRAVEL',
    },
    body: '{}',
  });
  assert.equal(captured.length, 1);
  const sent = captured[0].headers;
  assert.equal(sent.authorization, 'Bearer t0k3n-t0k3n-t0k3n');
  assert.equal(sent.cookie, undefined);
  assert.equal(sent['x-telegram-init-data'], undefined);
  assert.ok(!JSON.stringify(sent).includes('SHOULD-NOT-TRAVEL'));
});

test('B6: preflight now allows Authorization, and only for the storefront origin', () => {
  const h = corsHeaders();
  assert.equal(h['Access-Control-Allow-Headers'], 'Content-Type, Accept, Authorization');
  assert.match(h['Access-Control-Allow-Origin'], /magicesim\.store/);
});

// ===========================================================================
// OBSERVABILITY — which stage of an upstream connection consumes the failure
//
// TD-55 costs a customer roughly ten seconds on a tariff page, and the reason
// the fix cannot be chosen yet is that the old log cannot tell DNS from TCP
// from TLS: `tls.connect({ timeout })` is one inactivity timer covering all of
// them, so a black-holed SYN and a stalled handshake produce byte-identical
// lines. These tests exist to prove that the stage is nonetheless recoverable
// from the socket's events, and that the classification is right.
//
// Where a failure mode can be reproduced with a real socket, it is: those tests
// open real servers on loopback and assert on what the kernel actually did.
// Two cases cannot be reproduced portably and say so out loud rather than
// pretending otherwise — see the comments on each.
// ===========================================================================

const SUPPORTED_CLASSES = [
  'UPSTREAM_DNS_ERROR',
  'UPSTREAM_TCP_TIMEOUT', 'UPSTREAM_TCP_ERROR',
  'UPSTREAM_TLS_TIMEOUT', 'UPSTREAM_TLS_ERROR',
  'UPSTREAM_REQUEST_TIMEOUT', 'UPSTREAM_REQUEST_ERROR',
  'UPSTREAM_RESPONSE_ERROR', 'UPSTREAM_UNKNOWN',
];

/**
 * Drive one instrumented connection to its verdict with exactly the listeners
 * raceConnect uses, so what is tested is what production runs.
 */
function settle(entry) {
  return new Promise((resolve) => {
    const done = (outcome, err) => {
      entry.seal(outcome, err);
      entry.socket.destroy();
      resolve(entry.diag);
    };
    entry.socket.once('secureConnect', () => done('ok'));
    entry.socket.once('timeout', () => done('timeout', new Error('connect_timeout')));
    entry.socket.once('error', (e) => done('error', e));
  });
}

/**
 * A loopback TCP server that behaves as told, torn down after the test.
 *
 * Accepted sockets are tracked and destroyed explicitly: the servers here exist
 * to hold a connection open and say nothing, and `close()` alone waits for such
 * a connection forever.
 */
function server(t, onConnection) {
  return new Promise((resolve) => {
    const live = new Set();
    const srv = net.createServer((socket) => {
      live.add(socket);
      socket.on('close', () => live.delete(socket));
      socket.on('error', () => {});
      onConnection(socket);
    });
    srv.listen(0, '127.0.0.1', () => {
      t.after(() => new Promise((r) => {
        for (const socket of live) socket.destroy();
        srv.close(r);
      }));
      resolve(srv.address().port);
    });
  });
}

/** A port nothing is listening on: opened, its number taken, then closed. */
function closedPort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// ---------------------------------------------------------------------------
// The classifier itself
// ---------------------------------------------------------------------------

test('every stage and outcome maps to a class, and only to a supported one', () => {
  const cases = [
    [{ stage: 'dns', outcome: 'error' }, 'UPSTREAM_DNS_ERROR'],
    [{ stage: 'dns', outcome: 'timeout' }, 'UPSTREAM_DNS_ERROR'],
    [{ stage: 'tcp', outcome: 'timeout' }, 'UPSTREAM_TCP_TIMEOUT'],
    [{ stage: 'tcp', outcome: 'error' }, 'UPSTREAM_TCP_ERROR'],
    [{ stage: 'tls', outcome: 'timeout' }, 'UPSTREAM_TLS_TIMEOUT'],
    [{ stage: 'tls', outcome: 'error' }, 'UPSTREAM_TLS_ERROR'],
    [{ stage: 'ready', outcome: 'timeout' }, 'UPSTREAM_REQUEST_TIMEOUT'],
    [{ stage: 'ready', outcome: 'error' }, 'UPSTREAM_REQUEST_ERROR'],
    [{ stage: 'something-new', outcome: 'error' }, 'UPSTREAM_UNKNOWN'],
  ];

  for (const [diag, expected] of cases) {
    assert.equal(classifyConnect(diag), expected, `${diag.stage}/${diag.outcome}`);
    assert.ok(SUPPORTED_CLASSES.includes(classifyConnect(diag)));
  }
});

test('a timeout and an error at the same stage are never conflated', () => {
  // The distinction is the point: a timeout is silence, an error is a peer that
  // answered with a refusal, and they lead to different remediations.
  for (const stage of ['tcp', 'tls']) {
    assert.notEqual(
      classifyConnect({ stage, outcome: 'timeout' }),
      classifyConnect({ stage, outcome: 'error' }),
    );
  }
});

test('the furthest-progressed target names the attempt', () => {
  // The upstream resolves to several addresses and they are raced. If one dies
  // in TCP and another in TLS, the connection got as far as TLS.
  const targets = [
    { stage: 'tcp', outcome: 'timeout', duration_ms: 3001, class: 'UPSTREAM_TCP_TIMEOUT' },
    { stage: 'tls', outcome: 'timeout', duration_ms: 3002, class: 'UPSTREAM_TLS_TIMEOUT' },
  ];

  assert.equal(worstTarget(targets).class, 'UPSTREAM_TLS_TIMEOUT');
  assert.equal(classifyAttempt('socket_error', { conn: { targets } }), 'UPSTREAM_TLS_TIMEOUT');
});

test('a target that was aborted because another won is not a failure', () => {
  const targets = [
    { stage: 'tcp', outcome: 'aborted', duration_ms: 40, class: null },
    { stage: 'ready', outcome: 'ok', duration_ms: 48, class: null },
  ];

  assert.equal(worstTarget(targets), null);
});

test('a request-stage failure is classified by its reason', () => {
  assert.equal(classifyAttempt('read_timeout', { conn: null }), 'UPSTREAM_REQUEST_TIMEOUT');
  assert.equal(classifyAttempt('response_error', { conn: null }), 'UPSTREAM_RESPONSE_ERROR');
  assert.equal(classifyAttempt('connect_timeout', { conn: null }), 'UPSTREAM_TCP_TIMEOUT');
  assert.equal(classifyAttempt('ECONNRESET', { conn: null, ttfb_ms: null }), 'UPSTREAM_REQUEST_ERROR');
  assert.equal(classifyAttempt('ECONNRESET', { conn: null, ttfb_ms: 120 }), 'UPSTREAM_RESPONSE_ERROR');
});

test('a loser of the address race cannot be blamed for a request-stage failure', () => {
  // The race routinely leaves a failed target beside a successful one: one
  // address refuses, the other serves. If the read then times out, the failure
  // is the read, not the address that lost — and `socket_ms` is what says a
  // socket was handed over at all.
  const conn = {
    dns: { source: 'cache', duration_ms: 0, count: 2 },
    targets: [
      { target: '216.24.57.1', by: 'ip', stage: 'tcp', outcome: 'error', class: 'UPSTREAM_TCP_ERROR', duration_ms: 2 },
      { target: '216.24.57.2', by: 'ip', stage: 'ready', outcome: 'ok', class: null, duration_ms: 48 },
    ],
  };

  assert.equal(classifyAttempt('read_timeout', { conn, socket_ms: 51 }), 'UPSTREAM_REQUEST_TIMEOUT');
  // …and when no socket was ever handed over, the trace IS the explanation.
  assert.equal(classifyAttempt('socket_error', { conn, socket_ms: null }), 'UPSTREAM_TCP_ERROR');
});

test('a pooled socket is judged by this request, not by the one that opened it', () => {
  // Same hazard through the other door: a reused socket still carries the
  // connection trace of the request that created it.
  const conn = {
    dns: { source: 'cache', duration_ms: 0, count: 2 },
    targets: [{ target: '216.24.57.1', by: 'ip', stage: 'tls', outcome: 'timeout', class: 'UPSTREAM_TLS_TIMEOUT', duration_ms: 3001 }],
  };

  assert.equal(
    classifyAttempt('read_timeout', { conn, reused: true, socket_ms: 0 }),
    'UPSTREAM_REQUEST_TIMEOUT',
  );
});

test('an unclassifiable failure says UNKNOWN rather than guessing', () => {
  // The one thing this patch must never do is invent a stage. `socket_error`
  // with no connection trace is exactly the state today's production log is in.
  assert.equal(classifyAttempt('socket_error', { conn: null }), 'UPSTREAM_UNKNOWN');
  assert.equal(classifyAttempt('socket_error', { conn: { targets: [] } }), 'UPSTREAM_UNKNOWN');
});

// ---------------------------------------------------------------------------
// Real sockets — A, B/C, D, E from the synthetic proof list
// ---------------------------------------------------------------------------

test('A. a name that does not resolve is DNS, not TCP', async () => {
  // .invalid is reserved by RFC 2606 precisely so it can never resolve.
  const diag = await settle(connectTarget('no-such-host.invalid', { port: 443, timeout: 5000 }));

  assert.equal(diag.by, 'hostname');
  assert.equal(diag.stage, 'dns', 'a name failure must not be blamed on TCP');
  assert.equal(diag.class, 'UPSTREAM_DNS_ERROR');
  assert.equal(diag.tcp_ms, null, 'TCP never started, so it must not report a duration');
  assert.equal(diag.tls_ms, null);
  assert.ok(typeof diag.dns_ms === 'number', 'the DNS stage must report how long it took');
});

test('B. a refused port is TCP, and the errno survives', async () => {
  const port = await closedPort();
  const diag = await settle(connectTarget('127.0.0.1', { port, timeout: 5000 }));

  assert.equal(diag.stage, 'tcp', 'no connect event fired, so the failure is TCP');
  assert.equal(diag.class, 'UPSTREAM_TCP_ERROR');
  assert.equal(diag.outcome, 'error');
  assert.equal(diag.error, 'ECONNREFUSED');
  assert.equal(diag.tls_ms, null, 'TLS was never reached');
  assert.equal(diag.by, 'ip');
  assert.equal(diag.family, 4);
});

test('C. a reset during the handshake is TLS, because TCP had already succeeded', async (t) => {
  // The distinction production cannot currently make: the same three seconds,
  // and the same `socket_error`, whether the SYN went nowhere or the peer
  // accepted and then went quiet. Here TCP demonstrably completed.
  const port = await server(t, (socket) => socket.destroy());
  const diag = await settle(connectTarget('127.0.0.1', { port, timeout: 5000 }));

  assert.equal(diag.stage, 'tls');
  assert.equal(diag.class, 'UPSTREAM_TLS_ERROR');
  assert.ok(typeof diag.tcp_ms === 'number', 'TCP completed and must report its duration');
  assert.equal(diag.tls_ms, null, 'the handshake never completed');
});

test('D. a peer that is not speaking TLS is a TLS error', async (t) => {
  const port = await server(t, (socket) => {
    socket.on('data', () => socket.write('this is not a TLS record\r\n\r\n'));
  });
  const diag = await settle(connectTarget('127.0.0.1', { port, timeout: 5000 }));

  assert.equal(diag.stage, 'tls');
  assert.equal(diag.class, 'UPSTREAM_TLS_ERROR');
  assert.equal(diag.outcome, 'error');
  assert.ok(diag.error, 'the TLS layer names its own error and that name is kept');
});

test('E. a peer that accepts and says nothing is a TLS timeout, not a TCP one', async (t) => {
  // This is the shape production reports: silence. The whole question is which
  // silence, and the connect event answers it.
  const port = await server(t, () => { /* accept, then say nothing at all */ });
  const diag = await settle(connectTarget('127.0.0.1', { port, timeout: 300 }));

  assert.equal(diag.outcome, 'timeout');
  assert.equal(diag.stage, 'tls');
  assert.equal(diag.class, 'UPSTREAM_TLS_TIMEOUT');
  assert.equal(diag.connecting, false, 'connecting=false is the corroborating signal');
  assert.ok(diag.tcp_ms >= 0, 'TCP completed');
  assert.ok(diag.duration_ms >= 250, 'the timeout is what consumed the attempt');
});

// ---------------------------------------------------------------------------
// Simulated socket event sequences — the two cases loopback cannot produce
// ---------------------------------------------------------------------------

/**
 * Replace tls.connect with a socket whose events the test drives directly.
 *
 * This is honest about what it proves and what it does not: it proves the
 * instrumentation reads the event sequence correctly, not that any particular
 * kernel produces that sequence. A genuinely black-holed SYN cannot be produced
 * on loopback — the kernel completes a loopback handshake immediately — and on
 * this workstation even a TEST-NET-1 address answered a SYN in 6 ms, so a real
 * TCP-stage timeout is not reproducible here at all. Saying so is the point of
 * the patch; inventing a test that appeared to prove it would not be.
 */
function withFakeSocket(run) {
  const real = tls.connect;
  const socket = Object.assign(new EventEmitter(), {
    connecting: true,
    destroy() { this.destroyed = true; return this; },
    setTimeout() { return this; },
  });
  tls.connect = () => socket;
  try { return run(socket); } finally { tls.connect = real; }
}

test('a SYN that is never answered is a TCP timeout', async () => {
  const diag = await withFakeSocket((socket) => {
    const entry = connectTarget('203.0.113.7', { timeout: 3000 });
    const settled = settle(entry);
    // No connect, no secureConnect: the socket is still in SYN_SENT.
    setImmediate(() => socket.emit('timeout'));
    return settled;
  });

  assert.equal(diag.stage, 'tcp');
  assert.equal(diag.class, 'UPSTREAM_TCP_TIMEOUT');
  assert.equal(diag.connecting, true, 'connecting=true is what distinguishes this from TLS');
  assert.equal(diag.tcp_ms, null);
});

test('G. a healthy connection reports every stage and no class', async () => {
  const diag = await withFakeSocket((socket) => {
    const entry = connectTarget('216.24.57.1');
    const settled = settle(entry);
    setImmediate(() => {
      socket.emit('connect');
      socket.connecting = false;
      setImmediate(() => socket.emit('secureConnect'));
    });
    return settled;
  });

  assert.equal(diag.outcome, 'ok');
  assert.equal(diag.stage, 'ready');
  assert.equal(diag.class, null, 'a success has no failure class');
  assert.ok(typeof diag.tcp_ms === 'number');
  assert.ok(typeof diag.tls_ms === 'number');
});

// ---------------------------------------------------------------------------
// Attempts — the count must be the count
// ---------------------------------------------------------------------------

test('H. a retry that succeeds is logged as two attempts, not one', async () => {
  reset();
  failSequence = ['ECONNRESET', null];
  const logs = await capturingLogs(() => call({ httpMethod: 'GET', path: '/api/v1/retail/packages' }));

  assert.equal(logs.of('upstream_attempt').length, 2);
  assert.equal(logs.of('upstream_attempt')[0].outcome, 'fail');
  assert.equal(logs.of('upstream_attempt')[1].outcome, 'ok');
  assert.equal(logs.of('proxied')[0].attempts, 2);
});

test('I. when every attempt fails the count is the real one', async () => {
  reset();
  upstreamFails = 'ECONNRESET';
  const logs = await capturingLogs(() => call({ httpMethod: 'GET', path: '/api/v1/retail/packages' }));

  assert.equal(logs.of('upstream_attempt').length, MAX_ATTEMPTS);
  assert.equal(logs.of('error')[0].attempts, MAX_ATTEMPTS);
  assert.deepEqual(
    logs.of('upstream_attempt').map((l) => l.attempt),
    [1, 2, 3, 4],
    'each attempt is numbered, in order',
  );
});

test('a POST that reached the wire reports one attempt, not four', async () => {
  // The defect this replaces: the thrown error carried the constant
  // MAX_ATTEMPTS, so a POST that was deliberately NOT retried — every failed
  // checkout — was recorded in production as four attempts. Reading the old
  // logs, that made a single refused connection look like a storm.
  reset();
  upstreamFails = 'ECONNRESET';
  const logs = await capturingLogs(() => call({
    httpMethod: 'POST', path: '/api/v1/public/retail-orders', body: '{}',
  }));

  assert.equal(logs.of('upstream_attempt').length, 1, 'a sent POST is never retried');
  assert.equal(logs.of('error')[0].attempts, 1);
  assert.equal(captured.length, 1, 'and the upstream saw exactly one request');
});

test('an attempt line carries the fields an analysis needs', async () => {
  reset();
  const logs = await capturingLogs(() => call({ httpMethod: 'GET', path: '/api/v1/retail/packages' }));
  const line = logs.of('upstream_attempt')[0];

  for (const field of [
    'request_id', 'attempt', 'max_attempts', 'stage', 'stage_duration_ms',
    'attempt_duration_ms', 'total_duration_ms', 'outcome', 'class', 'reused', 'instance', 'pool',
    'idle_ms', 'first_invocation', 'gw_request_id', 'worst_target', 'worst_error', 'targets_summary',
  ]) {
    assert.ok(field in line, `the attempt line is missing ${field}`);
  }
  assert.equal(line.max_attempts, MAX_ATTEMPTS);
});

// ---------------------------------------------------------------------------
// Correlation
// ---------------------------------------------------------------------------

test('the platform request id is preferred, and reaches every line', async () => {
  reset();
  const logs = await capturingLogs(() => fn.handler(
    { httpMethod: 'GET', path: '/api/v1/retail/packages', headers: {}, queryStringParameters: {} },
    { requestId: 'abcd-1234' },
  ));

  assert.ok(logs.json.length >= 2);
  for (const line of logs.json) assert.equal(line.request_id, 'abcd-1234');
});

test("the gateway's x-request-id is used when the platform gives nothing", () => {
  assert.equal(
    correlationId({ headers: { 'X-Request-Id': '99030a2c-fe9d-4a36-80bf-bfecffaeca0f' } }, null),
    '99030a2c-fe9d-4a36-80bf-bfecffaeca0f',
  );
});

test('a hostile correlation id cannot forge a log line', () => {
  // The id is written into a log store, so it is caller-controlled input and is
  // treated as such: anything that could open a second JSON object, or run to
  // any length, is refused and a generated id is used instead.
  for (const evil of [
    'a"}\n{"evt":"proxied","status":200',
    'x'.repeat(65),
    'a b',
    '{"$":1}',
    '',
  ]) {
    const id = correlationId({ headers: { 'x-request-id': evil } }, null);
    assert.notEqual(id, evil, `accepted ${JSON.stringify(evil)}`);
    assert.match(id, /^[0-9a-f-]{36}$/, 'the fallback is a generated uuid');
  }
});

test('a request with no id at all still gets one', () => {
  const id = correlationId({ headers: {} }, undefined);
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.notEqual(id, correlationId({ headers: {} }, undefined), 'and it is not a constant');
});

test('a refused path is correlated too', async () => {
  reset();
  const logs = await capturingLogs(() => fn.handler(
    { httpMethod: 'GET', path: '/api/v1/admin/sync', headers: {}, queryStringParameters: {} },
    { requestId: 'refused-1' },
  ));

  assert.equal(logs.of('rejected')[0].request_id, 'refused-1');
});

// ---------------------------------------------------------------------------
// Log hygiene — the new lines must not become the leak the old ones were not
// ---------------------------------------------------------------------------

test('no header value ever reaches a log line', async () => {
  reset();
  const logs = await capturingLogs(() => fn.handler({
    httpMethod: 'POST',
    path: '/api/v1/public/retail-orders',
    headers: {
      Authorization: 'Bearer SECRET-BEARER-TOKEN',
      Cookie: 'session=SECRET-COOKIE',
      'X-Telegram-Init-Data': 'user=%7B%22id%22%3A1%7D&hash=SECRET-INITDATA-HASH',
      'X-Api-Key': 'SECRET-API-KEY',
      'Content-Type': 'application/json',
    },
    queryStringParameters: { promo: 'SECRET-QUERY-VALUE', email: 'buyer@example.com' },
    body: JSON.stringify({ email: 'buyer@example.com', activation_code: 'LPA:1$SECRET-LPA' }),
  }, { requestId: 'hygiene-1' }));

  for (const secret of [
    'SECRET-BEARER-TOKEN', 'SECRET-COOKIE', 'SECRET-INITDATA-HASH', 'SECRET-API-KEY',
    'SECRET-QUERY-VALUE', 'SECRET-LPA', 'buyer@example.com', 'Bearer',
  ]) {
    assert.ok(!logs.raw.includes(secret), `${secret} reached a log line`);
  }
  assert.ok(logs.raw.length > 0, 'the function must log something, or this proves nothing');
});

test('the platform IAM token is never read, let alone logged', async () => {
  reset();
  const logs = await capturingLogs(() => fn.handler(
    { httpMethod: 'GET', path: '/api/v1/retail/packages', headers: {}, queryStringParameters: {} },
    { requestId: 'token-1', token: { access_token: 'SECRET-IAM-TOKEN' } },
  ));

  assert.ok(!logs.raw.includes('SECRET-IAM-TOKEN'));
  assert.ok(!logs.raw.includes('access_token'));
});

test('a token in the path stays out of the new lines too', async () => {
  reset();
  const logs = await capturingLogs(() => call({
    httpMethod: 'GET', path: '/api/v1/public/retail-esim/LIVE-QR-SECRET/qr.png',
  }));

  assert.ok(logs.of('upstream_attempt').length > 0, 'the attempt line must exist to be checked');
  assert.ok(!logs.raw.includes('LIVE-QR-SECRET'));
  assert.equal(logs.of('upstream_attempt')[0].path, '/api/v1/public/retail-esim/{token}/qr.png');
});

test('a diagnostic line names addresses and stages, and nothing else about the request', async () => {
  // What IS allowed to appear: the upstream host, the addresses tried, whether
  // a socket was reused, and how long each stage took. Those are the facts the
  // remediation decision needs and none of them is a credential.
  const diag = await settle(connectTarget('127.0.0.1', { port: await closedPort(), timeout: 3000 }));
  const keys = Object.keys(diag).sort();

  assert.deepEqual(keys, [
    'by', 'bytes_read', 'bytes_written', 'class', 'connecting', 'dns_ms', 'duration_ms',
    'error', 'family', 'outcome', 'stage', 'stage_ms', 'target', 'tcp_ms', 'tls_ms',
  ], 'a new field in the connection trace must be a deliberate decision');
});

test('the hostname path adds exactly one field, and it is not a secret either', async () => {
  // Checked separately because the IP path never emits `resolved`, so pinning
  // the key set on that path alone left a hole in the guard.
  const diag = await settle(connectTarget('no-such-host.invalid', { port: 443, timeout: 5000 }));
  const extra = Object.keys(diag).filter((k) => ![
    'by', 'bytes_read', 'bytes_written', 'class', 'connecting', 'dns_ms', 'duration_ms',
    'error', 'family', 'outcome', 'stage', 'stage_ms', 'target', 'tcp_ms', 'tls_ms',
  ].includes(k));

  assert.deepEqual(extra, [], 'the hostname path must not smuggle in a field');
});

test('the failing stage reports how long IT ran, not how long the socket lived', async (t) => {
  // The number the remediation decision turns on. A stage that completed
  // reports its own duration; the stage that did not is the one that consumed
  // the attempt, and before this it was reported as null because a handshake
  // that never finished has no handshake duration.
  const port = await server(t, () => { /* accept, then silence */ });
  const diag = await settle(connectTarget('127.0.0.1', { port, timeout: 400 }));

  assert.equal(diag.stage, 'tls');
  assert.equal(diag.tls_ms, null, 'the handshake never completed');
  assert.ok(diag.stage_ms >= 350, `the TLS stage ran for the timeout, got ${diag.stage_ms}`);
  assert.ok(diag.stage_ms <= diag.duration_ms);
  assert.ok(diag.tcp_ms + diag.stage_ms <= diag.duration_ms + 5, 'the stages add up to the whole');
});

test('a resolver failure with nothing cached is DNS, whatever the socket then did', () => {
  // Without this the fallback connection's own verdict — a refused SYN to the
  // bare hostname, say — would be reported as a TCP problem, hiding the fact
  // that the function never learned an address in the first place.
  const conn = {
    dns: { source: 'resolve4', duration_ms: 12, count: 0, error: 'ENOTFOUND', class: 'UPSTREAM_DNS_ERROR' },
    targets: [{ target: 'esim-backend-3wmu.onrender.com', by: 'hostname', stage: 'tcp', outcome: 'error', class: 'UPSTREAM_TCP_ERROR', duration_ms: 2 }],
  };

  assert.equal(classifyAttempt('ECONNREFUSED', { conn }), 'UPSTREAM_DNS_ERROR');
});

test('a resolver failure that fell back to CACHED addresses is not called DNS', () => {
  // The opposite case, and the reason the rule is written on the targets rather
  // than on the presence of a DNS error: a stale address list is a working one.
  const conn = {
    dns: { source: 'resolve4', duration_ms: 12, count: 0, error: 'ESERVFAIL', class: 'UPSTREAM_DNS_ERROR' },
    targets: [{ target: '216.24.57.1', by: 'ip', stage: 'tls', outcome: 'timeout', class: 'UPSTREAM_TLS_TIMEOUT', duration_ms: 3001 }],
  };

  assert.equal(classifyAttempt('socket_error', { conn }), 'UPSTREAM_TLS_TIMEOUT');
});

test('a reused socket does not report the addresses of the request that opened it', async () => {
  // A pooled socket carries the connection trace of the request that created
  // it. Logging that again would read as "this attempt tried these addresses",
  // which is false, and would inflate any count of connection attempts.
  reset();
  const logs = await capturingLogs(async () => {
    await call({ httpMethod: 'GET', path: '/api/v1/retail/packages' });
    await call({ httpMethod: 'GET', path: '/api/v1/retail/packages' });
  });
  const lines = logs.of('upstream_attempt');

  assert.equal(lines.length, 2);
  for (const line of lines) {
    if (line.reused) {
      assert.equal(line.targets, null, 'a reused socket must not restate old targets');
      assert.equal(line.dns, null);
    }
  }
});

// ---------------------------------------------------------------------------
// Nothing about the network changed — this is the promise the patch makes
// ---------------------------------------------------------------------------

test('the timeouts and the attempt budget are the deployed values', () => {
  // If any of these three ever changes, it is a behaviour change and must not
  // arrive inside an observability patch.
  assert.equal(CONNECT_TIMEOUT_MS, 3_000);
  assert.equal(READ_TIMEOUT_MS, 25_000);
  assert.equal(MAX_ATTEMPTS, 4);
});

test('retry safety is unchanged, including for the case that creates orders', () => {
  assert.equal(isRetrySafe('POST', true), false);
  assert.equal(isRetrySafe('POST', false), true);
  assert.equal(isRetrySafe('GET', true), true);
  assert.equal(isRetrySafe('GET', false), true);
});

test('the client still sees a generic error, whatever the class says', async () => {
  reset();
  upstreamFails = 'ECONNRESET';
  const res = await call({ httpMethod: 'GET', path: '/api/v1/retail/packages' });

  assert.equal(res.statusCode, 502);
  assert.deepEqual(JSON.parse(res.body), { error: 'upstream_unreachable' });
  for (const leak of ['UPSTREAM_', 'ECONNRESET', 'onrender', 'stage', 'attempt']) {
    assert.ok(!res.body.includes(leak), `${leak} reached the client`);
  }
});

test('the error line keeps its original reason alongside the new class', async () => {
  // 58 hours of production history is keyed on `reason`, including its
  // `socket_error` catch-all. Replacing it would make the new data
  // incomparable with the old; `class` is added beside it instead.
  reset();
  upstreamFails = 'ECONNRESET';
  const logs = await capturingLogs(() => call({ httpMethod: 'GET', path: '/api/v1/retail/packages' }));
  const line = logs.of('error')[0];

  assert.equal(line.reason, 'ECONNRESET');
  assert.equal(line.kind, 'upstream_unreachable');
  assert.ok('class' in line);
});

test('the allowlist is the nine deployed routes, the two B-6 ones, the eight reads and the eight writes', () => {
  // Restated so a merge cannot quietly widen the surface: nine legacy routes
  // survive untouched, B-6 adds the two Mini App session routes, B-7 adds six
  // reads (GET only) and then three writes (POST only), top-up discovery adds a
  // SEVENTH read on 2026-08-19, S13 adds three more writes (POST only) the same
  // day, and the top-up PURCHASE wave adds two writes and an EIGHTH read on
  // 2026-08-19. Nothing else rides along.
  assert.equal(ROUTES.length, 27);
  for (const [method, path] of LEGACY_ROUTES) assert.ok(matchRoute(method, path));
  const tma = ROUTES.filter((r) => r.pattern.startsWith('/api/v1/tma/'));
  assert.deepEqual(tma.map((r) => `${r.method} ${r.pattern}`).sort(), [
    'GET /api/v1/tma/esims',
    'GET /api/v1/tma/esims/{token}',
    'GET /api/v1/tma/esims/{token}/topups',
    'GET /api/v1/tma/me',
    'GET /api/v1/tma/me/orders',
    'GET /api/v1/tma/me/orders/active',
    'GET /api/v1/tma/orders/{token}/status',
    'GET /api/v1/tma/topups/{token}/status',
    'POST /api/v1/tma/esims/{token}/activation',
    'POST /api/v1/tma/esims/{token}/topups/quote',
    'POST /api/v1/tma/esims/{token}/usage/refresh',
    'POST /api/v1/tma/identity/email/confirm',
    'POST /api/v1/tma/identity/email/request',
    'POST /api/v1/tma/identity/email/revoke',
    'POST /api/v1/tma/orders',
    'POST /api/v1/tma/session',
    'POST /api/v1/tma/session/revoke',
    'POST /api/v1/tma/topups/{token}/checkout',
  ]);
  assert.equal(corsHeaders()['Access-Control-Allow-Headers'], 'Content-Type, Accept, Authorization');
  assert.deepEqual(REQUEST_HEADERS, ['content-type', 'accept', 'accept-language', 'authorization']);
});

test('the read wave opens six GETs and leaves the later waves shut', () => {
  // The routes whose absence IS the security property of this wave. Each one
  // has, or will have, a handler upstream; allowlisting any of them early would
  // expose it the moment it ships, with no second decision point.
  for (const path of [
    '/api/v1/tma/esims/abc/activate',
    '/api/v1/tma/esims/abc/qr',
    '/api/v1/tma/esims/abc/qr.png',
    '/api/v1/tma/esims/abc/usage',
    '/api/v1/tma/esims/abc/topup',
    '/api/v1/tma/esims/abc/top-up',
    '/api/v1/tma/me/identity',
    '/api/v1/tma/me/email',
  ]) {
    assert.ok(!matchRoute('GET', path), `GET ${path} must stay shut`);
    assert.ok(!matchRoute('POST', path), `POST ${path} must stay shut`);
  }

  // The two the write wave opened are GET-shut and POST-open. Listing them here
  // rather than deleting them keeps the method boundary asserted: opening a write
  // must not have opened a read of the same path, and an install secret is
  // exactly the thing that must not be reachable by a URL somebody can share.
  for (const path of ['/api/v1/tma/esims/abc/activation', '/api/v1/tma/esims/abc/usage/refresh']) {
    assert.ok(!matchRoute('GET', path), `GET ${path} must stay shut`);
    assert.ok(matchRoute('POST', path), `POST ${path} must be open`);
  }

  // The read wave is GET-only: opening /tma/me must not open a write to it.
  for (const path of [
    '/api/v1/tma/me', '/api/v1/tma/me/orders', '/api/v1/tma/me/orders/active',
    '/api/v1/tma/esims', '/api/v1/tma/esims/abc', '/api/v1/tma/orders/abc/status',
  ]) {
    assert.ok(matchRoute('GET', path), `GET ${path} must be open`);
    assert.ok(!matchRoute('POST', path), `POST ${path} must stay shut`);
  }

  // Purchase was opened by the B-7 write wave — as POST, and only as POST. The
  // GET half still matters: `/tma/orders` must never become a way to LIST orders
  // by URL, which is what a reader would reach for next.
  assert.ok(matchRoute('POST', '/api/v1/tma/orders'));
  assert.ok(!matchRoute('GET', '/api/v1/tma/orders'));

  // S13 opened three, as POST and only as POST. The GET half is the property:
  // a verification code exists in one email body, and a route that returned one
  // — or merely confirmed a challenge exists — by URL would be reachable by
  // anything that shares a link. Revoke is POST for a duller reason: the gateway
  // forwards only GET and POST, so a DELETE pattern would never match at all.
  for (const path of [
    '/api/v1/tma/identity/email/request',
    '/api/v1/tma/identity/email/confirm',
    '/api/v1/tma/identity/email/revoke',
  ]) {
    assert.ok(matchRoute('POST', path), `POST ${path} must be open`);
    assert.ok(!matchRoute('GET', path), `GET ${path} must stay shut`);
    assert.ok(!matchRoute('DELETE', path), `DELETE ${path} must stay shut`);
  }

  // The prefix itself, and the shapes a reader would try next, stay shut.
  for (const path of [
    '/api/v1/tma/identity',
    '/api/v1/tma/identity/email',
    '/api/v1/tma/identity/email/',
    '/api/v1/tma/identity/email/request/extra',
    '/api/v1/tma/identity/email/verify',
    '/api/v1/tma/me/identity/email/request',
  ]) {
    assert.ok(!matchRoute('GET', path), `GET ${path} must stay shut`);
    assert.ok(!matchRoute('POST', path), `POST ${path} must stay shut`);
  }
});

test('a single dynamic segment cannot grow into a path', () => {
  // '{token}' is one segment, and SEGMENT is what keeps it one: an added
  // segment, an encoded separator, and an empty segment all miss the allowlist
  // entirely rather than being cleaned up and let through.
  for (const bad of [
    '/api/v1/tma/esims/a/b', '/api/v1/tma/esims/a%2Fb', '/api/v1/tma/esims/',
    '/api/v1/tma/orders/a/b/status', '/api/v1/tma/orders//status',
    '/api/v1/tma/orders/a/status/extra',
  ]) {
    assert.ok(!matchRoute('GET', bad), `${bad} must not match`);
  }
  assert.ok(matchRoute('GET', '/api/v1/tma/esims/abc-123_x.y~z'));
});

test('a dot-segment stays one segment, exactly as on the deployed token routes', () => {
  // Documented, not introduced: SEGMENT permits '.', so a lone '..' matches as
  // ONE segment. This is the behaviour the three already-deployed {token}
  // routes have shipped with, so it is pinned here rather than changed inside a
  // read wave. It is not an escalation: '..' cannot add a segment, and upstream
  // it normalises DOWN to /api/v1/tma/, a path with no handler that falls into
  // the admin catch-all. Escaping the prefix is what must stay impossible.
  assert.ok(matchRoute('GET', '/api/v1/tma/esims/..'));
  assert.ok(matchRoute('GET', '/api/v1/public/private-payments/..'));

  // The property that actually matters: no dot-segment reaches a DIFFERENT route.
  for (const bad of [
    '/api/v1/tma/esims/../../admin', '/api/v1/tma/esims/../me',
    '/api/v1/tma/orders/../../../health',
  ]) {
    assert.ok(!matchRoute('GET', bad), `${bad} must not match`);
  }

  // And it is never logged, dot-segment or not.
  const r = matchRoute('GET', '/api/v1/tma/esims/..');
  assert.equal(logPath('/api/v1/tma/esims/..', r), '/api/v1/tma/esims/{token}');
});

test('paging on /me/orders survives the trip upstream', async () => {
  // §13 asks for this explicitly: /me/orders is paged with limit+cursor, and a
  // proxy that dropped the query would silently serve page one forever.
  reset();
  await call({
    httpMethod: 'GET',
    path: '/api/v1/tma/me/orders',
    queryStringParameters: { limit: '20', cursor: 'OPAQUE-CURSOR' },
  });

  assert.equal(captured.length, 1);
  const url = new URL(captured[0].target);
  assert.equal(url.pathname, '/api/v1/tma/me/orders');
  assert.equal(url.searchParams.get('limit'), '20');
  assert.equal(url.searchParams.get('cursor'), 'OPAQUE-CURSOR');
});

test('a cursor is not written to a log line either', async () => {
  // The cursor is opaque to the client but it is still the customer's paging
  // state, and logPath never sees a query string. Pinned because the natural
  // "just log the full URL" patch would break it.
  reset();
  const logs = await capturingLogs(() => call({
    httpMethod: 'GET',
    path: '/api/v1/tma/me/orders',
    queryStringParameters: { cursor: 'SECRET-CURSOR-VALUE' },
  }));

  assert.ok(logs.raw.length > 0, 'nothing was logged, so this proves nothing');
  assert.ok(!logs.raw.includes('SECRET-CURSOR-VALUE'), 'the cursor reached a log line');
});

test('the eSIM id and the order token never reach a log line', () => {
  // Same rule the qr.png token already lives under: a matched route logs its
  // PATTERN, so the dynamic segment cannot appear even by accident.
  const esim = matchRoute('GET', '/api/v1/tma/esims/esim-secret-id');
  assert.equal(logPath('/api/v1/tma/esims/esim-secret-id', esim), '/api/v1/tma/esims/{token}');
  const order = matchRoute('GET', '/api/v1/tma/orders/order-secret-token/status');
  assert.equal(logPath('/api/v1/tma/orders/order-secret-token/status', order), '/api/v1/tma/orders/{token}/status');

  // And unmatched input on the same shape is masked too.
  const masked = logPath('/api/v1/tma/esims/leaky-id/usage', null);
  assert.ok(!masked.includes('leaky-id'), 'an unmatched id must be masked');

  // '{token}' must not have entered the literal-segment set.
  assert.ok(!logPath('/api/v1/tma/esims/{token}', null).includes('{token}'));
});

// ---------------------------------------------------------------------------
// The observability code must not be able to reach the request
// ---------------------------------------------------------------------------

test('a throw from a log line cannot turn one checkout into two orders', async () => {
  // The regression this pins: logging used to sit INSIDE the try that decides
  // whether to retry. A throw there was caught as an upstream failure carrying
  // no `sent` flag, and isRetrySafe('POST', undefined) is true — so a POST the
  // backend had already accepted would have been sent again. An observability
  // patch must not be able to create a duplicate order.
  reset();
  const realLog = console.log;
  let calls = 0;
  console.log = (...args) => {
    calls += 1;
    if (JSON.stringify(args).includes('upstream_attempt')) throw new Error('log sink exploded');
  };
  let res;
  try {
    res = await call({ httpMethod: 'POST', path: '/api/v1/public/retail-orders', body: '{}' });
  } finally {
    console.log = realLog;
  }

  assert.ok(calls > 0, 'the log line must have been attempted, or this proves nothing');
  assert.equal(captured.length, 1, 'the upstream must have seen exactly one POST');
  assert.equal(res.statusCode, 200, 'and the customer must still get their answer');
});

test('a throw while classifying cannot kill the invocation', async () => {
  reset();
  upstreamFails = 'ECONNRESET';
  const res = await call({ httpMethod: 'GET', path: '/api/v1/retail/packages' });

  assert.equal(res.statusCode, 502, 'the handler still answers');
});

// ---------------------------------------------------------------------------
// Stage attribution — a stage must never contradict the class beside it
// ---------------------------------------------------------------------------

test('a successful attempt is not filed under the stage a losing address died in', async () => {
  // On this upstream one of the two addresses has refused every handshake, so
  // a successful race almost always carries a failed sibling in its trace.
  // Attributing the attempt to it would file every single 200 under `tcp`.
  reset();
  const logs = await capturingLogs(() => call({ httpMethod: 'GET', path: '/api/v1/retail/packages' }));
  const line = logs.of('upstream_attempt')[0];

  assert.equal(line.outcome, 'ok');
  assert.equal(line.class, null);
  assert.equal(line.stage, 'response', 'a 200 belongs to the response stage, not to a discarded socket');
  assert.equal(line.stage_duration_ms, null);
  assert.equal(line.worst_target, null, 'nothing failed here that this attempt is answerable for');
  assert.ok(line.targets_summary.includes('216.24.57.15=ready/ok'), 'the trace is still reported');
});

test('a reused socket does not restate the addresses of the request that opened it', async () => {
  reset();
  const logs = await capturingLogs(async () => {
    await call({ httpMethod: 'GET', path: '/api/v1/retail/packages' });
    await call({ httpMethod: 'GET', path: '/api/v1/retail/packages' });
  });
  const [first, second] = logs.of('upstream_attempt');

  assert.equal(first.reused, false);
  assert.ok(Array.isArray(first.targets), 'the request that opened the socket reports its trace');
  assert.equal(second.reused, true, 'the stub must actually pool the socket, or this proves nothing');
  assert.equal(second.targets, null, 'a reused socket must not restate old targets');
  assert.equal(second.dns, null);
  assert.equal(second.targets_summary, null);
  assert.ok(typeof second.conn_age_ms === 'number', 'its age is what is worth reporting instead');
});

test('a connection that never yielded a socket still says it was not reused', async () => {
  // This is the whole failing population, and `reused` used to be null on every
  // one of its lines — leaving the cold-path question unanswerable exactly
  // where it is asked.
  reset();
  upstreamFails = 'ECONNRESET';
  const logs = await capturingLogs(() => call({ httpMethod: 'GET', path: '/api/v1/retail/packages' }));

  for (const line of logs.of('upstream_attempt')) assert.equal(line.outcome, 'fail');
  assert.equal(logs.of('error')[0].kind, 'upstream_unreachable');
});

// ---------------------------------------------------------------------------
// Inside the TLS stage — the discriminator that decides the remediation
// ---------------------------------------------------------------------------

test('a stalled handshake records whether the peer answered at all', async (t) => {
  // Two failures share the class UPSTREAM_TLS_TIMEOUT and demand opposite
  // fixes: a ClientHello that was swallowed points at filtering on the way out,
  // a ServerHello that arrived and then stalled points at the origin's
  // behaviour toward this source. `bytes_read` is the entire difference.
  const swallowed = await server(t, () => { /* accept, read nothing back to us */ });
  const answered = await server(t, (socket) => {
    socket.on('data', () => socket.write(Buffer.from([0x16, 0x03, 0x03, 0x00, 0x05])));
  });

  const a = await settle(connectTarget('127.0.0.1', { port: swallowed, timeout: 300 }));
  const b = await settle(connectTarget('127.0.0.1', { port: answered, timeout: 300 }));

  assert.equal(a.class, 'UPSTREAM_TLS_TIMEOUT');
  assert.equal(a.bytes_read, 0, 'nothing came back: our ClientHello went unanswered');
  assert.ok(a.bytes_written > 0, 'but we did send one');

  assert.equal(b.class, 'UPSTREAM_TLS_TIMEOUT');
  assert.ok(b.bytes_read > 0, 'the peer answered and then stalled — a different problem entirely');
});

test('the byte counts come from the wire, not from the TLS layer', () => {
  // A TLSSocket's own bytesRead/bytesWritten count DECRYPTED application bytes,
  // so during a handshake both are zero whatever happened. Reading them would
  // have produced a field that looks like a discriminator and discriminates
  // nothing. This pins the fallback: an unrecognisable socket reads as NOT
  // OBSERVABLE, never as zero.
  const { rawByteCounts } = fn._internal;

  assert.equal(rawByteCounts(null), null);
  assert.equal(rawByteCounts({}), null);
  assert.equal(rawByteCounts({ _handle: {} }), null);
  assert.equal(rawByteCounts({ bytesRead: 7, bytesWritten: 9 }), null, 'the TLS-layer counters are not it');
  assert.deepEqual(
    rawByteCounts({ _handle: { _parentWrap: { bytesRead: 5, bytesWritten: 364 } } }),
    { read: 5, written: 364 },
  );
});

// ---------------------------------------------------------------------------
// Correlation, part two — three fields, because they are three different things
// ---------------------------------------------------------------------------

test('the gateway id is logged beside the platform id, not instead of it', async () => {
  // Measured on production: the gateway's x-request-id and the platform's
  // invocation id are DIFFERENT values for the same request. Only logging both
  // can join a proxy line to a gateway line.
  reset();
  const logs = await capturingLogs(() => fn.handler(
    {
      httpMethod: 'GET', path: '/api/v1/retail/packages',
      headers: { 'X-Request-Id': 'gw-99030a2c' }, queryStringParameters: {},
    },
    { requestId: 'platform-36717dbf' },
  ));

  for (const line of logs.json) {
    assert.equal(line.request_id, 'platform-36717dbf');
    assert.equal(line.gw_request_id, 'gw-99030a2c');
  }
});

test('the source of the correlation id is stated, because a caller can supply one', async () => {
  reset();
  const platform = await capturingLogs(() => fn.handler(
    { httpMethod: 'GET', path: '/api/v1/retail/packages', headers: {}, queryStringParameters: {} },
    { requestId: 'platform-1' },
  ));
  const client = await capturingLogs(() => fn.handler(
    { httpMethod: 'GET', path: '/api/v1/retail/packages', headers: { 'x-request-id': 'client-1' }, queryStringParameters: {} },
    null,
  ));
  const generated = await capturingLogs(() => fn.handler(
    { httpMethod: 'GET', path: '/api/v1/retail/packages', headers: {}, queryStringParameters: {} },
    null,
  ));

  assert.equal(platform.of('proxied')[0].request_id_source, 'platform');
  assert.equal(client.of('proxied')[0].request_id_source, 'client');
  assert.equal(generated.of('proxied')[0].request_id_source, 'generated');
});

// ---------------------------------------------------------------------------
// Cold path — the population the customer is actually in
// ---------------------------------------------------------------------------

test('the gap since the previous request is reported, so cold and warm separate', async () => {
  // Failure rate is a function of exactly this gap: 2.8% back-to-back, 54% ten
  // minutes apart. Without the field that split is a window function over an
  // export; with it, it is a group-by.
  reset();
  const first = await capturingLogs(() => call({ httpMethod: 'GET', path: '/api/v1/retail/packages' }));
  const second = await capturingLogs(() => call({ httpMethod: 'GET', path: '/api/v1/retail/packages' }));

  assert.ok('idle_ms' in first.of('proxied')[0]);
  assert.ok(typeof second.of('proxied')[0].idle_ms === 'number', 'the second request knows its gap');
  assert.ok(second.of('proxied')[0].idle_ms >= 0);
});

// ---------------------------------------------------------------------------
// The option object production actually builds
// ---------------------------------------------------------------------------

test('production connects with exactly the four values it always connected with', () => {
  // The single thing this patch most promised not to change, and the defaults
  // in connectTarget are the only place a typo could change it silently.
  const real = tls.connect;
  let seen = null;
  tls.connect = (opts) => {
    seen = opts;
    return Object.assign(new EventEmitter(), { connecting: true, destroy() {}, setTimeout() {} });
  };
  try {
    connectTarget('216.24.57.7'); // production passes no options at all
  } finally {
    tls.connect = real;
  }

  assert.deepEqual(Object.keys(seen), ['host', 'port', 'servername', 'timeout']);
  assert.equal(seen.host, '216.24.57.7');
  assert.equal(seen.port, 443);
  assert.equal(seen.servername, 'esim-backend-3wmu.onrender.com', 'SNI must stay the hostname');
  assert.equal(seen.timeout, CONNECT_TIMEOUT_MS);
});

// NOTE: the Telegram Mini App section lives on main (commit c5f253b) together
// with the routes it tests. This branch is the code that is actually deployed,
// so that it can carry observability to production without also carrying B-6.

// ---------------------------------------------------------------------------
// B-7 write wave — three POSTs, and everything they must not drag in
// ---------------------------------------------------------------------------

test('the write wave opens exactly three POSTs, taken from the backend router', () => {
  // These are the three router.post() paths lib/tmaRoutes.js actually registers,
  // beyond session/revoke. A pattern with no handler behind it would reach the
  // backend, match nothing, and answer 401 ADMIN_AUTH_REQUIRED — the misleading
  // diagnosis the backend-before-proxy rule exists to prevent.
  for (const path of [
    '/api/v1/tma/orders',
    '/api/v1/tma/esims/9f1c8a2e-0000-4000-8000-000000000000/activation',
    '/api/v1/tma/esims/9f1c8a2e-0000-4000-8000-000000000000/usage/refresh',
  ]) {
    assert.ok(matchRoute('POST', path), `POST ${path} must be open`);
    assert.ok(!matchRoute('GET', path), `GET ${path} must stay shut`);
  }
});

test('the write wave drags in no neighbour', () => {
  // Everything one segment away from what was opened, in both methods.
  for (const path of [
    '/api/v1/tma/esims/abc/activation/extra',
    '/api/v1/tma/esims/abc/usage',
    '/api/v1/tma/esims/abc/usage/refresh/extra',
    '/api/v1/tma/orders/abc',
    '/api/v1/tma/orders/abc/pay',
    '/api/v1/tma/esims/abc/topup',
    '/api/v1/tma/esims/abc/top-up/create',
    '/api/v1/admin/providers/health/scan',
    '/api/v1/admin/replacements/abc/apply',
  ]) {
    assert.ok(!matchRoute('POST', path), `POST ${path} must stay shut`);
    assert.ok(!matchRoute('GET', path), `GET ${path} must stay shut`);
  }

  // `/api/v1/tma/identity/email/request` was in that list until 2026-08-19, when
  // S13 opened it as a POST. It is not deleted from this test but moved, because
  // the neighbour discipline still applies to it: the write is open, the read is
  // not, and nothing one segment away came along with it.
  assert.ok(matchRoute('POST', '/api/v1/tma/identity/email/request'));
  assert.ok(!matchRoute('GET', '/api/v1/tma/identity/email/request'));
  for (const path of [
    '/api/v1/tma/identity/email/request/extra',
    '/api/v1/tma/identity/email/resend',
    '/api/v1/tma/identity/phone/request',
    '/api/v1/tma/identity/abc/email/request',
  ]) {
    assert.ok(!matchRoute('POST', path), `POST ${path} must stay shut`);
    assert.ok(!matchRoute('GET', path), `GET ${path} must stay shut`);
  }

  // `/api/v1/tma/esims/activation` is NOT in that list, and the reason is worth
  // writing down: it matches the pre-existing GET /tma/esims/{token} with the
  // token literally being the word "activation". That is the read wave doing
  // exactly what it should — the backend then answers 404 because it is not a
  // uuid. What must stay shut is the WRITE.
  assert.ok(matchRoute('GET', '/api/v1/tma/esims/activation'));
  assert.ok(!matchRoute('POST', '/api/v1/tma/esims/activation'));
});

test('a mid-path dynamic segment still cannot grow into a path', () => {
  // The write wave is the first time {token} sits in the MIDDLE rather than at
  // the end, so the segment discipline is re-asserted for that shape.
  for (const bad of [
    '/api/v1/tma/esims/a/b/activation',
    '/api/v1/tma/esims//activation',
    '/api/v1/tma/esims/a%2Fb/activation',
    '/api/v1/tma/esims/a/usage/refresh/b',
  ]) {
    assert.ok(!matchRoute('POST', bad), `${bad} must not match`);
  }
  assert.ok(matchRoute('POST', '/api/v1/tma/esims/abc-123_x.y~z/activation'));
});

test('the eSIM id is never written to a log line by the write routes', async () => {
  // The id is not an install secret the way an LPA is, but it is the customer's
  // and it is not ours to put in a log store with its own retention and readers.
  for (const [path, pattern] of [
    ['/api/v1/tma/esims/ESIM-SECRET-ID/activation', '/api/v1/tma/esims/{token}/activation'],
    ['/api/v1/tma/esims/ESIM-SECRET-ID/usage/refresh', '/api/v1/tma/esims/{token}/usage/refresh'],
  ]) {
    const route = matchRoute('POST', path);
    assert.equal(logPath(path, route), pattern);
  }

  // And an UNMATCHED path of the same shape is masked defensively too.
  const masked = logPath('/api/v1/tma/esims/ESIM-SECRET-ID/topup', null);
  assert.ok(!masked.includes('ESIM-SECRET-ID'), `id leaked into a log line: ${masked}`);
});

test('the write routes forward the session bearer and a JSON body', async () => {
  reset();
  const res = await call({
    httpMethod: 'POST',
    path: '/api/v1/tma/orders',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer SESSION-BEARER-XYZ' },
    body: JSON.stringify({ package_id: 'p1', idempotency_key: 'k1' }),
    queryStringParameters: {},
  });

  assert.equal(res.statusCode, 200);
  const sent = captured[0];
  assert.equal(sent.headers.authorization, 'Bearer SESSION-BEARER-XYZ',
    'without the bearer every write would be a 401 the customer cannot fix');
  assert.equal(sent.headers['content-type'], 'application/json');
  assert.equal(sent.body, JSON.stringify({ package_id: 'p1', idempotency_key: 'k1' }));
  // Explicit length, because this upstream rejects a chunked request.
  assert.ok(sent.headers['content-length']);
});

test('the session bearer never reaches a log line on a write route', async () => {
  reset();
  const logs = await capturingLogs(() => call({
    httpMethod: 'POST',
    path: '/api/v1/tma/esims/abc/activation',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer SESSION-BEARER-XYZ' },
    body: '{}',
    queryStringParameters: {},
  }));

  assert.ok(logs.raw.length > 0, 'nothing was logged, so this proves nothing');
  assert.ok(!logs.raw.includes('SESSION-BEARER-XYZ'), 'the bearer reached a log line');
  assert.ok(!logs.raw.includes('abc'), 'the eSIM id reached a log line');
});

test('a write route body is not retried after the upstream has seen it', () => {
  // The rule that keeps one tap from becoming two orders at the PROXY layer:
  // isRetrySafe must refuse a POST the upstream already received. The backend's
  // idempotency key is the second line of defence, not the first.
  assert.equal(isRetrySafe('POST', true), false);
  assert.equal(isRetrySafe('GET', true), true);
});

/* ==========================================================================
 * Top-up at the gateway: one read open, every write shut.
 * ======================================================================== */

test('top-up discovery reaches the backend, for any eSIM id', () => {
  assert.ok(matchRoute('GET', '/api/v1/tma/esims/bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb/topups'));
  assert.ok(matchRoute('GET', '/api/v1/tma/esims/anything/topups'));
});

test('the id cannot escape its segment', () => {
  // A path parameter is one segment. Without that, `{token}` would be a way to
  // reach any path under /api/v1/.
  assert.ok(!matchRoute('GET', '/api/v1/tma/esims/a/b/topups'));
  assert.ok(!matchRoute('GET', '/api/v1/tma/esims/../admin/topups'));
  assert.ok(!matchRoute('GET', '/api/v1/tma/esims//topups'));
});

test('every top-up write EXCEPT the three of the purchase wave is closed', () => {
  // The security property of this wave is still what is ABSENT. Three routes
  // were opened on 2026-08-19 — quote, checkout, status — and they are the
  // three lib/tmaRoutes.js actually registers. Everything else a reader would
  // reach for next stays shut, in every method.
  //
  // Note what is NOT here and never will be: a provider execution endpoint. It
  // has no route at all. The only thing that can trigger a provider top-up is
  // the verified Platega callback, which arrives at the backend's own origin
  // and never passes through this gateway.
  const closed = [
    ['POST', '/api/v1/tma/esims/x/topups'],
    ['POST', '/api/v1/tma/topups'],
    ['POST', '/api/v1/tma/topups/quote'],
    ['POST', '/api/v1/tma/esims/x/topup'],
    ['POST', '/api/v1/tma/topups/x/pay'],
    ['PUT', '/api/v1/tma/esims/x/topups'],
    ['DELETE', '/api/v1/tma/esims/x/topups'],
    // The dealer and admin surfaces were never open and stay that way.
    ['POST', '/api/v1/dealer/orders/x/topup'],
    ['GET', '/api/v1/dealer/orders/x/topup-packages'],
    ['POST', '/api/v1/admin/providers/mobimatter/sync-addons'],
  ];
  for (const [method, path] of closed) {
    assert.ok(!matchRoute(method, path), `${method} ${path} must NOT be reachable`);
  }
});

test('the method is part of the match for the new route too', () => {
  assert.ok(!matchRoute('POST', '/api/v1/tma/esims/x/topups'));
  assert.ok(!matchRoute('HEAD', '/api/v1/tma/esims/x/topups'));
});

/* ==========================================================================
 * W3 — the top-up PURCHASE wave at the gateway.
 *
 * Three routes and no more. The property being asserted is the shape of the
 * hole, not the behaviour behind it: what a gateway allowlist can guarantee is
 * that nothing ELSE is reachable, and that is checked here one segment at a
 * time in both methods.
 * ======================================================================== */

test('the purchase wave opens exactly three routes, taken from the backend router', () => {
  // These are the three lib/tmaRoutes.js registers. A pattern with no handler
  // behind it would reach the backend, match nothing, and answer 401
  // ADMIN_AUTH_REQUIRED — the misleading diagnosis backend-before-proxy exists
  // to prevent, and the reason the backend shipped first.
  const esim = '9f1c8a2e-0000-4000-8000-000000000000';

  assert.ok(matchRoute('POST', `/api/v1/tma/esims/${esim}/topups/quote`));
  assert.ok(matchRoute('POST', '/api/v1/tma/topups/tu_abc123/checkout'));
  assert.ok(matchRoute('GET', '/api/v1/tma/topups/tu_abc123/status'));
});

test('each of the three is open in ONE method only', () => {
  const esim = '9f1c8a2e-0000-4000-8000-000000000000';

  // A quote creates an intent and makes a live provider discovery call. A GET
  // half would make it cacheable and shareable, and a link somebody forwards
  // must not be able to mint a priced intent.
  assert.ok(!matchRoute('GET', `/api/v1/tma/esims/${esim}/topups/quote`));

  // A checkout creates a payment. There is no readable half of that.
  assert.ok(!matchRoute('GET', '/api/v1/tma/topups/tu_abc123/checkout'));

  // Status is a read and stays one: a POST half would be a way to make the
  // status endpoint do something.
  assert.ok(!matchRoute('POST', '/api/v1/tma/topups/tu_abc123/status'));

  for (const m of ['PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    assert.ok(!matchRoute(m, `/api/v1/tma/esims/${esim}/topups/quote`), `${m} quote`);
    assert.ok(!matchRoute(m, '/api/v1/tma/topups/tu_abc123/checkout'), `${m} checkout`);
    assert.ok(!matchRoute(m, '/api/v1/tma/topups/tu_abc123/status'), `${m} status`);
  }
});

test('the purchase wave drags in no neighbour', () => {
  // Everything one segment away from what was opened, in both methods. The list
  // is the shapes a reader — or an attacker — reaches for next.
  for (const path of [
    // The prefix itself, and a collection under it.
    '/api/v1/tma/topups',
    '/api/v1/tma/topups/',
    '/api/v1/tma/topups/tu_abc123',
    // Verbs that would be the obvious next thing to add.
    '/api/v1/tma/topups/tu_abc123/pay',
    '/api/v1/tma/topups/tu_abc123/cancel',
    '/api/v1/tma/topups/tu_abc123/confirm',
    '/api/v1/tma/topups/tu_abc123/execute',
    '/api/v1/tma/topups/tu_abc123/retry',
    '/api/v1/tma/topups/tu_abc123/reconcile',
    '/api/v1/tma/topups/tu_abc123/refund',
    // A generic provider route, which is exactly what must never exist.
    '/api/v1/tma/topups/execute',
    '/api/v1/tma/topups/provider',
    '/api/v1/tma/provider/topup',
    '/api/v1/tma/esims/x/topups/execute',
    '/api/v1/tma/esims/x/topups/checkout',
    '/api/v1/tma/esims/x/topups/quote/extra',
    '/api/v1/tma/esims/x/topups/tu_abc/status',
    // Deeper, and the dealer/admin surfaces that were never open.
    '/api/v1/tma/topups/tu_abc123/status/extra',
    '/api/v1/dealer/orders/x/topup',
    '/api/v1/admin/topups',
  ]) {
    assert.ok(!matchRoute('GET', path), `GET ${path} must stay shut`);
    assert.ok(!matchRoute('POST', path), `POST ${path} must stay shut`);
  }
});

test('there is no provider execution route to allowlist, and none is allowlisted', () => {
  // The strongest property of this wave, stated as a test so a future one has
  // to argue with it: the provider call is reachable ONLY from the verified
  // Platega callback, which arrives at the backend's origin. Nothing here
  // forwards to a provider, and no pattern in the whole allowlist names one.
  for (const r of ROUTES) {
    assert.ok(!/esimaccess|mobimatter|provider|execute|fulfil/i.test(r.pattern),
      `the allowlist names a provider surface: ${r.method} ${r.pattern}`);
  }
});

test('the dynamic segments of the purchase wave cannot grow into a path', () => {
  for (const bad of [
    '/api/v1/tma/esims/a/b/topups/quote',
    '/api/v1/tma/esims//topups/quote',
    '/api/v1/tma/esims/a%2Fb/topups/quote',
    '/api/v1/tma/topups/a/b/checkout',
    '/api/v1/tma/topups//checkout',
    '/api/v1/tma/topups/a%2Fb/status',
  ]) {
    assert.ok(!matchRoute('POST', bad), `POST ${bad} must not match`);
    assert.ok(!matchRoute('GET', bad), `GET ${bad} must not match`);
  }
});

test('neither the eSIM id nor the intent token reaches a log line', () => {
  // A matched route logs its PATTERN, so the values in the middle are masked.
  // The intent token is not an install secret — it authorises nothing without
  // the session — but it is the customer's and it is not ours to put in a log
  // store with its own retention and readers.
  for (const [method, path, pattern] of [
    ['POST', '/api/v1/tma/esims/ESIM-SECRET-ID/topups/quote', '/api/v1/tma/esims/{token}/topups/quote'],
    ['POST', '/api/v1/tma/topups/TU-SECRET-TOKEN/checkout', '/api/v1/tma/topups/{token}/checkout'],
    ['GET', '/api/v1/tma/topups/TU-SECRET-TOKEN/status', '/api/v1/tma/topups/{token}/status'],
  ]) {
    const route = matchRoute(method, path);
    assert.ok(route, `${method} ${path} should match`);
    assert.equal(logPath(path, route), pattern);
  }

  // And an UNMATCHED path of the same shape is masked defensively too.
  for (const path of [
    '/api/v1/tma/topups/TU-SECRET-TOKEN/execute',
    '/api/v1/tma/esims/ESIM-SECRET-ID/topups/execute',
  ]) {
    const masked = logPath(path, null);
    assert.ok(!masked.includes('TU-SECRET-TOKEN') && !masked.includes('ESIM-SECRET-ID'),
      `an identifier leaked into a log line: ${masked}`);
  }
});

test('a purchase write is never retried after the upstream has seen it', () => {
  // The rule that keeps one tap from becoming two payments at the PROXY layer.
  // The backend's own guards — the conditional attach and the conditional claim
  // — are the second and third lines of defence, not the first.
  assert.equal(isRetrySafe('POST', true), false);
  assert.equal(isRetrySafe('GET', true), true);
});
