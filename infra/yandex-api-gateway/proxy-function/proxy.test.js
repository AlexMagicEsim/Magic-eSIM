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
  setImmediate(() => req.emit('socket', Object.assign(new EventEmitter(), { connecting: false })));

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
    'by', 'class', 'connecting', 'dns_ms', 'duration_ms', 'error', 'family',
    'outcome', 'stage', 'stage_ms', 'target', 'tcp_ms', 'tls_ms',
  ], 'a new field in the connection trace must be a deliberate decision');
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

test('the allowlist is still the nine deployed routes', () => {
  // Restated here so that merging observability and B-6 later cannot quietly
  // widen the surface: this branch must reach production with nine.
  assert.equal(ROUTES.length, 9);
  for (const [method, path] of LEGACY_ROUTES) assert.ok(matchRoute(method, path));
  assert.equal(corsHeaders()['Access-Control-Allow-Headers'], 'Content-Type, Accept');
  assert.deepEqual(REQUEST_HEADERS, ['content-type', 'accept', 'accept-language']);
});

// NOTE: the Telegram Mini App section lives on main (commit c5f253b) together
// with the routes it tests. This branch is the code that is actually deployed,
// so that it can carry observability to production without also carrying B-6.
