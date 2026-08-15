/**
 * Magic eSIM — retail reverse proxy (Yandex Cloud Function, behind API Gateway).
 *
 * Why a function instead of the gateway's built-in `http` integration: that
 * integration silently drops POST bodies for this upstream. Verified from both
 * ends — a diagnostic route pointed at an echo service received the body intact
 * (content-type and content-length correct), while the identical route pointed
 * at Render arrived body-less: sending deliberately malformed JSON produced our
 * app's `terms_not_accepted` (empty body) instead of Express's parse error.
 * Tried with and without `requestBody` declared, and with and without an
 * explicit `method` — no difference. Order creation would have failed in
 * production, so the forwarding is done explicitly here instead.
 *
 * This is a narrow proxy, not an open one:
 *   - the upstream is fixed in code, never taken from the request;
 *   - only allowlisted method+path pairs are forwarded, everything else 404s;
 *   - request and response headers are filtered to what is actually needed;
 *   - the upstream hostname never appears in a response header or error body.
 *
 * It carries no credentials and makes no decision about money: prices and
 * package availability are resolved by the backend exactly as before.
 */

'use strict';

const https = require('node:https');
const tls = require('node:tls');
const dns = require('node:dns').promises;

const UPSTREAM = 'https://esim-backend-3wmu.onrender.com';
const UPSTREAM_HOST = 'esim-backend-3wmu.onrender.com';
const STOREFRONT = 'https://magicesim.store';

// Short, because a working connection to this upstream takes ~50 ms; anything
// slower is the failure mode described at `agent` below, and waiting it out
// helps nobody. Four attempts at 3 s stays inside the gateway's own budget.
const CONNECT_TIMEOUT_MS = 3_000;
const READ_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 4;

const MAX_BODY_BYTES = 64 * 1024; // orders and promo payloads are well under 1 KB

/**
 * Allowlist. A path is a literal or a single {token} segment; anything else is
 * rejected before a request is made. Keeping it as data makes the surface
 * auditable at a glance.
 */
const ROUTES = [
  { method: 'GET', pattern: '/health' },
  { method: 'GET', pattern: '/api/v1/retail/packages' },
  { method: 'POST', pattern: '/api/v1/retail/promo/quote' },
  { method: 'POST', pattern: '/api/v1/public/retail-orders' },
  { method: 'POST', pattern: '/api/v1/public/retail-orders/{token}/pay' },
  { method: 'GET', pattern: '/api/v1/public/retail-orders/{token}/status' },
  // The QR image for a delivered eSIM. This one is not optional: its URL is
  // baked into every order email already in customers' inboxes, it names
  // api.magicesim.store, and the token does not expire. Leaving it out would
  // stop past customers from opening the QR they already paid for.
  { method: 'GET', pattern: '/api/v1/public/retail-esim/{token}/qr.png' },
  // Private payment links. These are browser calls too — 404.html serves /pay/
  // and reads them from the storefront — so they suffer exactly the Russian
  // unreachability this proxy exists to fix, and a link was live when this was
  // added. The admin side lives under /api/v1/admin/private-payment-links and
  // stays out.
  { method: 'GET', pattern: '/api/v1/public/private-payments/{token}' },
  { method: 'POST', pattern: '/api/v1/public/private-payments/{token}/start' },

  // Telegram Mini App (Phase B). Only the routes that have a handler upstream.
  //
  // The remaining twelve of the fourteen in the architecture arrive with their
  // own stages. An allowlisted path with no handler is not a hole, but it is not
  // free either: it reaches the backend, matches nothing, and falls into an
  // application-wide admin catch-all that answers 401 ADMIN_AUTH_REQUIRED —
  // which is precisely the misleading diagnosis the proxy-before-frontend rule
  // exists to prevent.
  //
  // Neither route authorises by a token in the URL, and none ever will: that is
  // rule R17. The legacy client_token paths — /api/v1/client/esim/:token and the
  // QR image — are not part of this contour.
  { method: 'POST', pattern: '/api/v1/tma/session' },
  { method: 'POST', pattern: '/api/v1/tma/session/revoke' },
];

/**
 * Only these travel upstream. Cookies stay absent by construction: the gateway
 * does not return set-cookie, so a cookie session is impossible here, which is
 * why the Mini App session is a bearer.
 *
 * `authorization` was added for that session, and only after measuring it.
 * Yandex Cloud Functions document Authorization among the headers REMOVED from
 * a request, and that is true — of the direct function endpoint, where the
 * platform claims the header for its own IAM. Through the API Gateway it
 * arrives intact: 37 characters of 37, six requests out of six, across GET,
 * POST with a body, and a lowercase header name.
 *
 * The VALUE is never logged. This function logs no header at all, and that is a
 * property to keep, not an accident.
 */
const REQUEST_HEADERS = ['content-type', 'accept', 'accept-language', 'authorization'];

/**
 * Only these come back. Render's own headers (rndr-id, x-render-origin-server)
 * are dropped.
 *
 * `pragma` and `expires` are here for the QR route alone: that response is the
 * eSIM install secret itself, and the backend deliberately marks it
 * `private, no-store` plus those two legacy headers. Forwarding only part of
 * that set would let this proxy weaken a decision the backend made on purpose.
 */
const RESPONSE_HEADERS = ['content-type', 'cache-control', 'pragma', 'expires', 'etag', 'retry-after'];

const SEGMENT = /^[A-Za-z0-9._~-]{1,128}$/;

/**
 * The path as it goes into a log line — never the one used for routing or sent
 * upstream.
 *
 * Three routes carry a token in the path itself, and `/retail-esim/{token}/qr.png`
 * is the eSIM install secret and does not expire. Writing those into Cloud
 * Logging would put a live credential in a store with its own retention and its
 * own set of readers.
 *
 * For a matched route the allowlist pattern is logged directly, so the log is
 * token-free by construction and cannot drift out of step with ROUTES. An
 * unmatched path is arbitrary client input, so the same segments are blanked
 * defensively there too.
 */
const TOKEN_BEARING =
  /(\/(?:retail-esim|retail-orders|private-payments|tma\/orders|tma\/esims)\/)[^/]+/g;

function logPath(path, route) {
  if (route) return route.pattern;
  return String(path).replace(TOKEN_BEARING, '$1{token}');
}

function matchRoute(method, path) {
  for (const route of ROUTES) {
    if (route.method !== method) continue;
    const want = route.pattern.split('/');
    const got = path.split('/');
    if (want.length !== got.length) continue;
    let ok = true;
    for (let i = 0; i < want.length; i++) {
      if (want[i] === '{token}') {
        // A path parameter may never introduce a new segment or escape the path.
        if (!SEGMENT.test(got[i])) { ok = false; break; }
      } else if (want[i] !== got[i]) { ok = false; break; }
    }
    if (ok) return route;
  }
  return null;
}

/**
 * Mirror the backend's own policy: the storefront only.
 *
 * The header is always emitted with the same literal value rather than being
 * omitted for unknown origins. Omitting it is what a hand-written server would
 * do, but the gateway then fills in `Access-Control-Allow-Origin: *`, which
 * would let any site read an order's status if it learned the token. A constant
 * value leaves nothing to fill in, and the browser still refuses every origin
 * that is not this one.
 */
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': STOREFRONT,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '600',
  };
}

const json = (statusCode, obj, extra = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...extra },
  body: JSON.stringify(obj),
});

/* ------------------------------------------------------------------ upstream */

/**
 * Connections to the upstream are the unreliable part, not the upstream itself.
 * Measured from inside Yandex Cloud: of the two addresses the origin resolves to,
 * one refused every TLS connection and the other succeeded intermittently — yet a
 * connection that *does* establish is fast (48 ms handshake, 240 KB catalogue in
 * ~350 ms). Left alone this surfaced as roughly half of concurrent requests
 * failing after a flat 10 s, which is the default connect timeout.
 *
 * So the strategy is: hold connections open and reuse them, and when a new one
 * has to be made, give up on it quickly and try again rather than waiting out a
 * long timeout.
 */
const agent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 32,
  maxFreeSockets: 8,
});

/** Resolved addresses of the upstream, refreshed at most once a minute. */
let addressCache = { at: 0, addresses: [] };

async function upstreamAddresses() {
  const fresh = Date.now() - addressCache.at < 60_000;
  if (fresh && addressCache.addresses.length) return addressCache.addresses;
  try {
    const addresses = await dns.resolve4(UPSTREAM_HOST);
    if (addresses.length) addressCache = { at: Date.now(), addresses };
  } catch {
    // Keep whatever we had; a stale address list beats no connection at all.
  }
  return addressCache.addresses;
}

/**
 * Connect to every address at once and keep the first one that completes the
 * handshake.
 *
 * The origin resolves to several addresses and they are not equally usable from
 * here — one of them refused every handshake while another answered in ~50 ms.
 * Picking one and waiting is a coin flip that costs seconds when it loses;
 * racing them costs one extra SYN and always lands on whichever address is
 * actually working right now, including after the origin's addresses change.
 */
function raceConnect(options, callback) {
  let settled = false;
  upstreamAddresses().then((addresses) => {
    const targets = addresses.length ? addresses : [UPSTREAM_HOST];
    const sockets = [];
    let pending = targets.length;

    const lose = (socket, err) => {
      socket.destroy();
      if (settled) return;
      if (--pending === 0) { settled = true; callback(err || new Error('no_route')); }
    };

    for (const address of targets) {
      const socket = tls.connect({
        host: address,
        port: 443,
        servername: UPSTREAM_HOST, // SNI must stay the hostname, not the address
        timeout: CONNECT_TIMEOUT_MS,
      });
      sockets.push(socket);
      socket.once('secureConnect', () => {
        if (settled) { socket.destroy(); return; }
        settled = true;
        socket.setTimeout(0); // hand a clean socket to the agent's keep-alive pool
        for (const other of sockets) if (other !== socket) other.destroy();
        callback(null, socket);
      });
      socket.once('timeout', () => lose(socket, new Error('connect_timeout')));
      socket.once('error', (err) => lose(socket, err));
    }
  }).catch((err) => { if (!settled) { settled = true; callback(err); } });
}

agent.createConnection = raceConnect;

/**
 * One attempt. Resolves with the response; rejects with `reason` and a `sent`
 * flag saying whether any byte of the request reached the wire.
 *
 * That flag is the whole point of hand-rolling this: a retry is only safe when
 * the upstream cannot possibly have seen the request. Retrying a POST that did
 * arrive would create a second order for one checkout.
 */
function attempt(target, method, headers, body) {
  return new Promise((resolve, reject) => {
    let sent = false;
    let done = false;
    const fail = (reason) => {
      if (done) return;
      done = true;
      clearTimeout(connectTimer);
      clearTimeout(readTimer);
      req.destroy();
      reject(Object.assign(new Error(reason), { reason, sent }));
    };

    const readTimer = setTimeout(() => fail('read_timeout'), READ_TIMEOUT_MS);
    let connectTimer;

    const req = https.request(target, { method, headers, agent }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', () => fail('response_error'));
      res.on('end', () => {
        if (done) return;
        done = true;
        clearTimeout(connectTimer);
        clearTimeout(readTimer);
        // Kept as bytes. Decoding here would corrupt the QR PNG and would risk
        // mangling multi-byte UTF-8 in JSON error messages.
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });

    req.on('socket', (socket) => {
      if (!socket.connecting) { sent = true; return; } // reused from the pool
      connectTimer = setTimeout(() => fail('connect_timeout'), CONNECT_TIMEOUT_MS);
      socket.once('connect', () => { clearTimeout(connectTimer); });
      socket.once('secureConnect', () => { sent = true; });
    });
    req.on('error', (e) => fail(e.code || 'socket_error'));

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Retry only where it cannot duplicate an effect: when nothing reached the wire,
 * or when the method is idempotent by definition.
 *
 * The POST case is the one that matters — `/retail-orders` creates an order and
 * `/pay` starts a payment, so a retry of a request the backend already received
 * would charge a customer twice for one checkout.
 */
function isRetrySafe(method, sent) {
  return !sent || method === 'GET';
}

async function send(target, method, headers, body) {
  let last;
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    try {
      const res = await attempt(target, method, headers, body);
      return { ...res, attempts: n };
    } catch (err) {
      last = err;
      if (!isRetrySafe(method, err.sent) || n === MAX_ATTEMPTS) break;
    }
  }
  throw Object.assign(last || new Error('failed'), { attempts: MAX_ATTEMPTS });
}

/**
 * Exposed so the test suite can exercise routing and CORS directly rather than
 * grepping this file. Not part of the function's contract with the gateway.
 */
module.exports._internal = { ROUTES, UPSTREAM, matchRoute, logPath, corsHeaders, isRetrySafe, REQUEST_HEADERS, RESPONSE_HEADERS };

module.exports.handler = async function (event) {
  const started = Date.now();
  const method = String(event.httpMethod || 'GET').toUpperCase();
  // API Gateway delivers the path differently depending on how the route is
  // declared; with a {proxy+} catch-all the literal pattern can arrive in
  // event.path while the real path sits in the greedy parameter. Take the
  // first form that actually looks like a path.
  const candidates = [
    event.requestContext && event.requestContext.http && event.requestContext.http.path,
    event.url,
    event.path,
    (event.params && event.params.proxy) || (event.pathParams && event.pathParams.proxy),
  ].filter((p) => typeof p === 'string' && p.length);
  let path = (candidates.find((p) => p.startsWith('/') && !p.includes('{')) || candidates[0] || '/');
  if (!path.startsWith('/')) path = '/' + path;
  path = path.split('?')[0];
  const reqHeaders = event.headers || {};
  const cors = corsHeaders();

  if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

  const route = matchRoute(method, path);
  if (!route) {
    // Same shape for unknown path and disallowed method: reveals nothing about
    // what else exists upstream.
    console.log(JSON.stringify({ evt: 'rejected', method, path: logPath(path, null), status: 404 }));
    return json(404, { error: 'not_found' }, cors);
  }

  // Query string: rebuilt from parsed params so nothing exotic is passed through.
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(event.queryStringParameters || {})) {
    if (v != null) qs.append(k, String(v));
  }
  const target = UPSTREAM + path + (qs.toString() ? `?${qs}` : '');

  const headers = {};
  for (const name of REQUEST_HEADERS) {
    const found = Object.keys(reqHeaders).find((k) => k.toLowerCase() === name);
    if (found && reqHeaders[found]) headers[name] = reqHeaders[found];
  }

  let body;
  if (method === 'POST') {
    body = event.isBase64Encoded && event.body
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : (event.body || '');
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      console.log(JSON.stringify({ evt: 'too_large', path: logPath(path, route), status: 413 }));
      return json(413, { error: 'payload_too_large' }, cors);
    }
    if (!headers['content-type']) headers['content-type'] = 'application/json';
    // Explicit, because without it Node streams the body chunked, and this
    // upstream rejects chunked requests with an Express parse error.
    headers['content-length'] = String(Buffer.byteLength(body, 'utf8'));
  }

  const t0 = Date.now();
  try {
    const res = await send(target, method, headers, body);

    const out = { ...cors };
    for (const name of RESPONSE_HEADERS) {
      const v = res.headers[name];
      if (v) out[name.replace(/(^|-)([a-z])/g, (m) => m.toUpperCase())] = v;
    }
    if (!out['Content-Type']) out['Content-Type'] = 'application/json; charset=utf-8';

    // Status, body and the meaningful headers pass through untouched: a 4xx from
    // the backend must stay that 4xx, so the storefront keeps showing the real
    // reason a package or promo code was refused.
    console.log(JSON.stringify({
      evt: 'proxied', method, path: logPath(path, route), status: res.status, attempts: res.attempts,
      bytes: res.body.length, upstream_ms: Date.now() - t0, total_ms: Date.now() - started,
    }));
    // Always base64, always flagged. The gateway decodes it back to the exact
    // bytes the backend produced, which is the only representation that is
    // correct for both a PNG and a JSON body — the QR image in every eSIM email
    // we have ever sent is served through this path.
    return { statusCode: res.status, headers: out, body: res.body.toString('base64'), isBase64Encoded: true };
  } catch (err) {
    const kind = err && err.reason === 'read_timeout' ? 'timeout' : 'upstream_unreachable';
    // Never surface the upstream host or the raw error to the client.
    console.log(JSON.stringify({
      evt: 'error', method, path: logPath(path, route), kind, reason: err && err.reason,
      attempts: err && err.attempts, total_ms: Date.now() - started,
    }));
    return json(kind === 'timeout' ? 504 : 502, { error: kind }, cors);
  }
};
