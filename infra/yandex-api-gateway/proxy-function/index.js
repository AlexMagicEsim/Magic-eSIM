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
const net = require('node:net');
const crypto = require('node:crypto');
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

/* ------------------------------------------------------- observability only */

/**
 * Everything from here to the end of this block exists to answer one question:
 * WHICH STAGE of an upstream connection consumes the three seconds that a failed
 * attempt costs. It changes no network behaviour whatsoever — not a timeout, not
 * a retry, not a hostname, not a header. It only watches.
 *
 * Why it is needed: `tls.connect({ timeout })` is a single INACTIVITY timer that
 * covers DNS, the TCP handshake, the TLS handshake and an idle established
 * socket alike. Proven by running this exact file against a black-holed SYN and
 * against a stalled handshake: `total_ms 12030` and `12017`, byte-identical log
 * lines, indistinguishable from production's `12019`. The old log therefore
 * cannot tell DNS from TCP from TLS even in principle, and every stage-level
 * claim about TD-55 is currently a hypothesis.
 *
 * The stage is recoverable, though, because the socket says so through its
 * events rather than through its timer: a target reached the TCP stage if
 * `connect` fired, the TLS stage if `secureConnect` did. Watching which events
 * arrived before the failure names the stage exactly.
 */

/** A stable, non-secret marker for this warm instance, so cold starts are visible. */
const INSTANCE = crypto.randomBytes(4).toString('hex');
let invocations = 0;
/** When this instance last began a request, for the idle-gap measurement. */
let lastRequestAt = 0;

/** Ordered, so an attempt can report the furthest stage any target reached. */
const STAGE_RANK = { dns: 0, tcp: 1, tls: 2, ready: 3, response: 4 };

/**
 * A correlation id from the caller is written into a log store, so it is treated
 * as hostile input: bounded, and restricted to characters that cannot forge a
 * second log line or a JSON field.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * The identity of a request, in three parts, because they are three different
 * things and conflating them was the first version's mistake.
 *
 * `request_id` is the platform's own invocation id — a UUIDv4, measured, and
 * the id Cloud Logging already indexes. It is essentially always present, which
 * means the header branch below is a fallback that in practice never runs; it
 * exists for the direct function endpoint and for a gateway that stops setting
 * the field.
 *
 * `gw_request_id` is a SEPARATE field, not a fallback, because the gateway's
 * `x-request-id` and the platform's invocation id were measured to be different
 * values for the same request. Only logging both can join a proxy line to a
 * gateway line — and only logging both can establish whether the header reaches
 * the function at all, which the platform documentation does not say.
 *
 * `request_id_source` exists because a caller can supply `x-request-id` and the
 * gateway echoes it verbatim. Charset-bounded, so it cannot forge a log record,
 * but two lines sharing an id are not necessarily one request, and at 3am that
 * has to be visible rather than assumed.
 *
 * `context` also carries an IAM token. It is never read here, and must not be.
 */
function clientRequestId(event) {
  const headers = (event && event.headers) || {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === 'x-request-id');
  const value = key ? headers[key] : null;
  return typeof value === 'string' && SAFE_REQUEST_ID.test(value) ? value : null;
}

function correlationId(event, context) {
  const fromContext = context && context.requestId;
  if (typeof fromContext === 'string' && SAFE_REQUEST_ID.test(fromContext)) return fromContext;
  return clientRequestId(event) || crypto.randomUUID();
}

function correlationSource(event, context) {
  const fromContext = context && context.requestId;
  if (typeof fromContext === 'string' && SAFE_REQUEST_ID.test(fromContext)) return 'platform';
  return clientRequestId(event) ? 'client' : 'generated';
}

/**
 * Which stage a target died in, given the events that did and did not arrive.
 * Timeout and error are separated because they mean different things: a timeout
 * is silence, an error is a peer that answered with a refusal.
 */
function classifyConnect(diag) {
  const timedOut = diag.outcome === 'timeout';
  switch (diag.stage) {
    case 'dns': return 'UPSTREAM_DNS_ERROR';
    case 'tcp': return timedOut ? 'UPSTREAM_TCP_TIMEOUT' : 'UPSTREAM_TCP_ERROR';
    case 'tls': return timedOut ? 'UPSTREAM_TLS_TIMEOUT' : 'UPSTREAM_TLS_ERROR';
    case 'ready': return timedOut ? 'UPSTREAM_REQUEST_TIMEOUT' : 'UPSTREAM_REQUEST_ERROR';
    default: return 'UPSTREAM_UNKNOWN';
  }
}

/** The furthest-progressed failing target; ties broken by whichever ran longest. */
function worstTarget(targets) {
  let worst = null;
  for (const t of targets || []) {
    if (t.outcome === 'ok' || t.outcome === 'aborted') continue;
    if (!worst) { worst = t; continue; }
    const rank = STAGE_RANK[t.stage] ?? -1;
    const best = STAGE_RANK[worst.stage] ?? -1;
    if (rank > best || (rank === best && (t.duration_ms || 0) > (worst.duration_ms || 0))) worst = t;
  }
  return worst;
}

/**
 * The classification of a whole attempt. A connection-stage failure is named by
 * the target that got furthest; anything after the socket was handed over is a
 * request-stage failure and is named by its reason.
 */
function classifyAttempt(reason, diag) {
  // The connection trace explains the failure ONLY when the connection never
  // produced a socket. Once a socket was handed over, the request stage owns
  // whatever went wrong — and the trace of a successful connection routinely
  // contains a target that failed while another won the race, so consulting it
  // here would report a read timeout as a TCP error.
  const conn = diag.socket_ms == null ? (diag.conn || null) : null;

  // The resolver failed AND left nothing usable behind, so every target is the
  // bare hostname. Whatever the socket then did, the reason this attempt had
  // nowhere good to go is DNS, and the socket's own verdict would hide that.
  if (conn && conn.dns && conn.dns.error && (conn.targets || []).every((t) => t.by === 'hostname')) {
    return 'UPSTREAM_DNS_ERROR';
  }

  const target = conn ? worstTarget(conn.targets) : null;
  if (target) return target.class || 'UPSTREAM_UNKNOWN';

  if (reason === 'read_timeout') return 'UPSTREAM_REQUEST_TIMEOUT';
  if (reason === 'response_error') return 'UPSTREAM_RESPONSE_ERROR';
  if (reason === 'connect_timeout') return 'UPSTREAM_TCP_TIMEOUT';
  if (reason === 'socket_error') return 'UPSTREAM_UNKNOWN';
  // Anything else is an errno from a socket that had already been handed over.
  return diag.ttfb_ms == null ? 'UPSTREAM_REQUEST_ERROR' : 'UPSTREAM_RESPONSE_ERROR';
}

/**
 * Raw bytes on the wire beneath the TLS layer, or null when they cannot be had.
 *
 * A TLSSocket's own `bytesRead`/`bytesWritten` count DECRYPTED application
 * bytes, so during a handshake they are both zero no matter what happened —
 * measured, on both runtimes. The handshake bytes live on the TCP handle the
 * TLS layer wraps, and that is an undocumented internal, so it is read
 * defensively: if the shape ever changes, this returns null and the field reads
 * as NOT OBSERVABLE rather than as a wrong number.
 *
 * Verified to discriminate on Node 18.20.8 and Node 24: a swallowed ClientHello
 * gives read 0, a ServerHello that arrives and then stalls gives read > 0, and
 * `written` is non-zero in both, proving we did send one.
 */
function rawByteCounts(socket) {
  try {
    const handle = socket && socket._handle;
    const wrap = handle && (handle._parentWrap || handle._parent);
    if (!wrap || typeof wrap.bytesRead !== 'number') return null;
    return { read: wrap.bytesRead, written: typeof wrap.bytesWritten === 'number' ? wrap.bytesWritten : null };
  } catch {
    return null;
  }
}

/** Pool occupancy, counted rather than dumped: the objects hold live sockets. */
function poolState() {
  const count = (bag) => Object.values(bag || {}).reduce((n, list) => n + list.length, 0);
  return { active: count(agent.sockets), free: count(agent.freeSockets), queued: count(agent.requests) };
}

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
  // Self-serve pay page (/pay/s/<secret>). Same reasoning as the links above:
  // browser calls from 404.html, so they need the same Russian-reachability
  // fallback.
  //
  // The link secret is spelled '{token}', not '{secret}', and that is
  // load-bearing rather than cosmetic: matchRoute knows exactly ONE placeholder
  // (see below), so any other spelling is compared LITERALLY — the route would
  // never match, the fallback would fail silently, and the word would enter
  // KNOWN_SEGMENTS and stop masking that position in logs. The secret is the
  // one path segment on this whole surface that most needs masking.
  { method: 'GET', pattern: '/api/v1/public/pay-link/{token}' },
  { method: 'POST', pattern: '/api/v1/public/pay-link/{token}/charge' },
  { method: 'GET', pattern: '/api/v1/public/pay-charge/{token}' },
  { method: 'GET', pattern: '/api/v1/public/pay-charge/{token}/qr.png' },

  // Telegram Mini App (Phase B / B-6). Only the routes that have a handler
  // upstream. The remaining routes of the architecture arrive with their own
  // stages: an allowlisted path with no handler is not a hole, but it is not
  // free either — it reaches the backend, matches nothing, and falls into an
  // application-wide admin catch-all that answers 401 ADMIN_AUTH_REQUIRED,
  // which is precisely the misleading diagnosis the proxy-before-frontend rule
  // exists to prevent.
  //
  // Neither route authorises by a token in the URL, and none ever will (R17).
  // The legacy client_token paths are not part of this contour.
  { method: 'POST', pattern: '/api/v1/tma/session' },
  { method: 'POST', pattern: '/api/v1/tma/session/revoke' },

  // B-7 read wave. Six GETs, every one of them behind the same bearer session
  // the two routes above issue and revoke: without it the backend answers 401
  // SESSION_INVALID, which is the shape to expect here and NOT the proxy's own
  // 404. The distinction is the whole point of opening them — before this, an
  // unallowlisted /tma/me returned the proxy 404, and once allowlisted a missing
  // handler would have returned the application-wide 401 ADMIN_AUTH_REQUIRED.
  // All three answers are 401-or-404 and mean entirely different things.
  //
  // The dynamic segment is spelled '{token}' in both patterns because that is
  // the only placeholder matchRoute knows (§13); '{id}' would be compared as a
  // literal segment, never match, and — worse — enter KNOWN_SEGMENTS and stop
  // being masked in logs. The eSIM id is not a credential the way the qr.png
  // token is, but neither is it ours to write into Cloud Logging.
  //
  // Deliberately absent, each waiting on its own wave: activation, QR, live
  // usage/refresh, top-up, purchase, identity/email.
  { method: 'GET', pattern: '/api/v1/tma/me' },
  { method: 'GET', pattern: '/api/v1/tma/me/orders' },
  { method: 'GET', pattern: '/api/v1/tma/me/orders/active' },
  { method: 'GET', pattern: '/api/v1/tma/orders/{token}/status' },
  { method: 'GET', pattern: '/api/v1/tma/esims' },

  // The eSIMs the customer has put aside.
  //
  // BEFORE '/api/v1/tma/esims/{token}' for the same reason the backend router
  // registers it first: `hidden` is a literal segment and `{token}` matches
  // anything, so behind it this would be read as an eSIM whose id is the word
  // "hidden". matchRoute takes the first match, so order is the control.
  { method: 'GET', pattern: '/api/v1/tma/esims/hidden' },

  { method: 'GET', pattern: '/api/v1/tma/esims/{token}' },

  // Display settings on an eSIM the customer already owns: their own name for
  // it, and whether it appears in their main list.
  //
  // NOTHING IS DELETED by either, which is why neither is a DELETE — and the
  // gateway forwards only GET and POST in any case. Both are write routes on a
  // resource the backend proves ownership of inside the statement that writes,
  // so an id belonging to somebody else answers the same 404 a missing one does.
  { method: 'POST', pattern: '/api/v1/tma/esims/{token}/name' },
  { method: 'POST', pattern: '/api/v1/tma/esims/{token}/visibility' },
  // Top-up discovery — READ ONLY, added 2026-08-19.
  //
  // What a customer could add to an eSIM they already own. Deliberately the
  // only top-up route in this list: creating an intent, paying for one and
  // executing it against the provider are all still closed at the gateway, so
  // even if a handler existed and TOPUP_PURCHASE_ENABLED were flipped, nothing
  // outside could reach it. R8's order — proxy before frontend — cuts both ways.
  { method: 'GET', pattern: '/api/v1/tma/esims/{token}/topups' },

  // B-7 write wave. Three POSTs, and they are the three the backend actually
  // registers — taken from router.post() in lib/tmaRoutes.js rather than from a
  // plan, because a pattern with no handler behind it is not a hole but it is
  // not free either: it reaches the backend, matches nothing, and falls into the
  // application-wide admin catch-all that answers 401 ADMIN_AUTH_REQUIRED, which
  // is exactly the misleading diagnosis this ordering rule exists to prevent.
  //
  // All three sit behind the same bearer session as the reads. Without it the
  // backend answers 401 SESSION_INVALID — not the proxy's 404, and not
  // ADMIN_AUTH_REQUIRED. Those three answers mean three different things and the
  // smoke test checks for the middle one.
  //
  // `{token}` is again the only placeholder matchRoute knows, and here it sits in
  // the MIDDLE of the path rather than at the end. That works — the matcher
  // compares segment by segment and only cares that the counts line up — but it
  // means `activation`, `usage`, `refresh` and `orders` now enter KNOWN_SEGMENTS
  // and stop being masked in logs. That is safe and was checked rather than
  // assumed: all four are fixed structural words. The eSIM id in the middle is
  // still masked, because a MATCHED route logs its PATTERN.
  //
  // Deliberately still absent: top-up (no provider-safe recharge exists — Р-4),
  // and anything admin.
  { method: 'POST', pattern: '/api/v1/tma/orders' },
  { method: 'POST', pattern: '/api/v1/tma/esims/{token}/activation' },
  { method: 'POST', pattern: '/api/v1/tma/esims/{token}/usage/refresh' },

  // S13 — linking website purchases by email, added 2026-08-19. Three POSTs,
  // taken from router.post() in lib/tmaRoutes.js rather than from the plan, and
  // all three behind the same bearer session as everything above: without it the
  // backend answers 401 SESSION_INVALID, verified against production before this
  // list was touched.
  //
  // Revoke is a POST and not a DELETE because the gateway forwards only GET and
  // POST. A DELETE pattern here would be unreachable, which is a worse kind of
  // wrong than an ugly verb: it would look allowlisted and never match.
  //
  // No GET half for any of them, and that is the security property. A challenge
  // code lives in exactly one email body; a route that returned one — or merely
  // confirmed a challenge exists — by URL would undo the whole design, and a URL
  // is the thing somebody shares by accident.
  // Notification switches. A write, POST like every other one here, and it
  // carries two booleans and nothing else — the customer it applies to comes
  // from the session, never from the body.
  { method: 'POST', pattern: '/api/v1/tma/notifications/prefs' },

  { method: 'POST', pattern: '/api/v1/tma/identity/email/request' },
  { method: 'POST', pattern: '/api/v1/tma/identity/email/confirm' },
  { method: 'POST', pattern: '/api/v1/tma/identity/email/revoke' },

  // Top-up PURCHASE, added 2026-08-19 (W3). Exactly three routes, taken from
  // router.post()/router.get() in lib/tmaRoutes.js rather than from a plan, and
  // deployed only after the backend that answers them.
  //
  // The provider execution endpoint is NOT here and never will be. It has no
  // route of its own: the only thing that can trigger a provider top-up is the
  // verified Platega callback, which arrives at the backend's own origin and
  // does not pass through this gateway at all. There is nothing outside to
  // allowlist, which is a stronger property than allowlisting it carefully.
  //
  // Both write routes fail CLOSED behind two server-side flags
  // (TOPUP_PURCHASE_ENABLED and ESIMACCESS_TOPUP_PURCHASE_ENABLED, both
  // currently off), so opening them at the gateway does not open the purchase.
  // R8's order — proxy before frontend — cuts both ways: the Mini App may not
  // ship a button whose route 404s, and the gateway may not open a route whose
  // backend does not exist.
  //
  // No wildcard and no generic provider route. `{token}` is again the only
  // placeholder matchRoute knows; in the quote it sits in the MIDDLE of the
  // path, which works because the matcher compares segment by segment — and it
  // means `topups`, `quote`, `checkout` and `status` enter KNOWN_SEGMENTS and
  // stop being masked in logs. Checked rather than assumed: all four are fixed
  // structural words. The eSIM id and the intent token in the middle are still
  // masked, because a MATCHED route logs its PATTERN.
  //
  // The intent token is not a bearer: /topups/{token}/status authorises by the
  // session, and the token only names which of the caller's OWN intents to read
  // (R17). That is why it may sit in a URL at all, unlike an install secret.
  { method: 'POST', pattern: '/api/v1/tma/esims/{token}/topups/quote' },
  { method: 'POST', pattern: '/api/v1/tma/topups/{token}/checkout' },
  { method: 'GET', pattern: '/api/v1/tma/topups/{token}/status' },
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
 * The VALUE is never logged. This function logs no header at all, and that is
 * a property to keep, not an accident.
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
const KNOWN_SEGMENTS = new Set(
  ROUTES.flatMap((r) => r.pattern.split('/')).filter((s) => s && s !== '{token}'),
);

/**
 * An unmatched path is arbitrary client input, so it is REBUILT from the
 * segments that appear literally in ROUTES rather than filtered by a denylist
 * of known token-bearing prefixes.
 *
 * The denylist this replaces was bypassed three ways — a case change
 * (`/RETAIL-ESIM/`), a percent-encoded hyphen, and simply adding a tenth route
 * without remembering to extend the regex. That last one is the reachable-by-
 * accident case: a mangled link or a stale bookmark on such a route would write
 * a non-expiring eSIM install secret into a log store with its own retention
 * and its own readers. An allowlist derived from ROUTES cannot drift out of
 * step with ROUTES, which is what the original comment claimed and only the
 * matched branch delivered.
 *
 * The cost is real and accepted: `/api/v1/admin/sync` now logs as
 * `/api/v1/{}/{}`. The gateway's own access log keeps the full path, and its
 * min level is WARN.
 */
const MAX_LOGGED_PATH = 256;

function logPath(path, route) {
  if (route) return route.pattern;
  const masked = String(path)
    .split('/')
    .map((segment) => (segment === '' || KNOWN_SEGMENTS.has(segment) ? segment : '{}'))
    .join('/');
  return masked.length > MAX_LOGGED_PATH ? `${masked.slice(0, MAX_LOGGED_PATH)}…` : masked;
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

/**
 * Returns the addresses and, separately, what resolving them cost. The DNS
 * stage is the one stage that happens HERE rather than on the socket, because
 * the sockets below are handed literal addresses; measuring it anywhere else
 * would measure nothing.
 *
 * The failure path is unchanged: a resolution error is still swallowed and the
 * cached list still stands in for it. Only the reason is now recorded.
 */
async function upstreamAddresses() {
  const startedAt = Date.now();
  const fresh = Date.now() - addressCache.at < 60_000;
  if (fresh && addressCache.addresses.length) {
    return { addresses: addressCache.addresses, dns: { source: 'cache', duration_ms: 0, count: addressCache.addresses.length } };
  }
  try {
    const addresses = await dns.resolve4(UPSTREAM_HOST);
    if (addresses.length) addressCache = { at: Date.now(), addresses };
    return {
      addresses: addressCache.addresses,
      dns: { source: 'resolve4', duration_ms: Date.now() - startedAt, count: addresses.length },
    };
  } catch (err) {
    // Keep whatever we had; a stale address list beats no connection at all.
    return {
      addresses: addressCache.addresses,
      dns: {
        source: 'resolve4',
        duration_ms: Date.now() - startedAt,
        count: 0,
        error: (err && err.code) || 'dns_error',
        class: 'UPSTREAM_DNS_ERROR',
      },
    };
  }
}

/**
 * One instrumented TLS connection to one target.
 *
 * Behaviour is exactly `tls.connect({ host, port: 443, servername, timeout })`
 * and nothing more — the listeners added here are observers that neither
 * consume an event nor alter the socket. `port`, `servername` and `timeout` are
 * parameters solely so the test suite can point this at a local server that
 * fails on purpose; production passes none of them and gets the same three
 * values it always had.
 */
function connectTarget(address, opts = {}) {
  const port = opts.port || 443;
  const servername = opts.servername || UPSTREAM_HOST;
  const timeout = opts.timeout == null ? CONNECT_TIMEOUT_MS : opts.timeout;

  const family = net.isIP(address);
  const t0 = Date.now();
  let mark = t0;

  const diag = {
    target: address,
    by: family ? 'ip' : 'hostname',
    family: family || null,
    dns_ms: null,
    tcp_ms: null,
    tls_ms: null,
    // How long was spent in the stage that the socket died in. A completed
    // stage reports its own duration above; this is the incomplete one, and it
    // is the number the whole patch exists to produce.
    stage_ms: null,
    // Where the socket currently IS. Whatever it holds when the socket settles
    // is the stage that consumed the failure.
    stage: family ? 'tcp' : 'dns',
    outcome: null,
    error: null,
    connecting: null,
    duration_ms: null,
    class: null,
    // The discriminator inside the TLS stage, and the reason it is worth a
    // field of its own: a handshake that times out having read ZERO bytes means
    // our ClientHello was swallowed, and a handshake that times out having read
    // some means the peer answered and then stalled. Same class, same three
    // seconds, opposite remediations — one points at filtering on the path out,
    // the other at the origin's behaviour toward this source.
    bytes_read: null,
    bytes_written: null,
  };

  const socket = tls.connect({ host: address, port, servername, timeout });

  // Only fires when connecting by hostname; a literal address never resolves.
  socket.once('lookup', (err, resolved, resolvedFamily) => {
    diag.dns_ms = Date.now() - mark;
    mark = Date.now();
    if (err) { diag.error = err.code || 'dns_error'; return; } // stays at stage 'dns'
    diag.resolved = resolved;
    diag.family = resolvedFamily || null;
    diag.stage = 'tcp';
  });
  socket.once('connect', () => { diag.tcp_ms = Date.now() - mark; mark = Date.now(); diag.stage = 'tls'; });
  socket.once('secureConnect', () => { diag.tls_ms = Date.now() - mark; mark = Date.now(); diag.stage = 'ready'; });

  /** First seal wins, so a deliberate destroy cannot overwrite a real verdict. */
  const seal = (outcome, err) => {
    if (diag.outcome) return diag;
    diag.outcome = outcome;
    diag.stage_ms = Date.now() - mark;
    diag.duration_ms = Date.now() - t0;
    diag.connecting = socket.connecting === true;
    const raw = rawByteCounts(socket);
    diag.bytes_read = raw ? raw.read : null;
    diag.bytes_written = raw ? raw.written : null;
    if (err && err.code) diag.error = err.code;
    diag.class = (outcome === 'ok' || outcome === 'aborted') ? null : classifyConnect(diag);
    return diag;
  };

  return { socket, diag, seal };
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
  const startedAt = Date.now();
  upstreamAddresses().then(({ addresses, dns: dnsDiag }) => {
    const targets = addresses.length ? addresses : [UPSTREAM_HOST];
    const sockets = [];
    const entries = [];
    let pending = targets.length;

    /** The stage record for this connection, whichever way it ends. */
    const trace = () => ({
      dns: dnsDiag,
      targets: entries.map((e) => e.diag),
      duration_ms: Date.now() - startedAt,
    });

    const lose = (entry, err, outcome) => {
      entry.seal(outcome, err);
      entry.socket.destroy();
      if (settled) return;
      if (--pending === 0) {
        settled = true;
        // Carried on the error rather than logged here: only the request knows
        // its correlation id and its attempt number, and a line without those
        // cannot be joined to anything.
        callback(Object.assign(err || new Error('no_route'), { __conn: trace() }));
      }
    };

    for (const address of targets) {
      // SNI must stay the hostname, not the address — connectTarget's default.
      const entry = connectTarget(address);
      const socket = entry.socket;
      sockets.push(socket);
      entries.push(entry);
      socket.once('secureConnect', () => {
        if (settled) { socket.destroy(); return; }
        settled = true;
        entry.seal('ok');
        socket.setTimeout(0); // hand a clean socket to the agent's keep-alive pool
        for (const other of sockets) if (other !== socket) other.destroy();
        for (const e of entries) if (e !== entry) e.seal('aborted');
        socket.__proxyConn = trace();
        socket.__proxyConnAt = Date.now();
        callback(null, socket);
      });
      socket.once('timeout', () => lose(entry, new Error('connect_timeout'), 'timeout'));
      socket.once('error', (err) => lose(entry, err, 'error'));
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
    const t0 = Date.now();
    // Observation only. Nothing here is read by any decision the function makes.
    const diag = {
      stage: 'connect', socket_ms: null, ttfb_ms: null, reused: null,
      conn_age_ms: null, conn: null, duration_ms: null, class: null,
    };
    const fail = (reason) => {
      if (done) return;
      done = true;
      clearTimeout(connectTimer);
      clearTimeout(readTimer);
      req.destroy();
      diag.duration_ms = Date.now() - t0;
      // Guarded because this runs inside a socket event handler, where an
      // uncaught exception does not reject a promise — it kills the invocation.
      try { diag.class = classifyAttempt(reason, diag); } catch { diag.class = 'UPSTREAM_UNKNOWN'; }
      reject(Object.assign(new Error(reason), { reason, sent, diag }));
    };

    const readTimer = setTimeout(() => fail('read_timeout'), READ_TIMEOUT_MS);
    let connectTimer;

    const req = https.request(target, { method, headers, agent }, (res) => {
      diag.ttfb_ms = Date.now() - t0;
      diag.stage = 'response';
      diag.status = res.statusCode;
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('error', () => fail('response_error'));
      res.on('end', () => {
        if (done) return;
        done = true;
        clearTimeout(connectTimer);
        clearTimeout(readTimer);
        diag.duration_ms = Date.now() - t0;
        // Kept as bytes. Decoding here would corrupt the QR PNG and would risk
        // mangling multi-byte UTF-8 in JSON error messages.
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks), diag });
      });
    });

    req.on('socket', (socket) => {
      // A socket that arrives already established either came from the pool or
      // was just raced into existence by raceConnect; `__proxyUsed` is what
      // tells those two apart, and the cold path is the one customers are on.
      diag.socket_ms = Date.now() - t0;
      diag.reused = socket.__proxyUsed === true;
      diag.conn = socket.__proxyConn || null;
      diag.conn_age_ms = socket.__proxyConnAt ? Date.now() - socket.__proxyConnAt : null;
      diag.stage = 'request';
      socket.__proxyUsed = true;

      if (!socket.connecting) { sent = true; return; } // reused from the pool
      connectTimer = setTimeout(() => fail('connect_timeout'), CONNECT_TIMEOUT_MS);
      socket.once('connect', () => { clearTimeout(connectTimer); });
      socket.once('secureConnect', () => { sent = true; });
    });
    req.on('error', (e) => {
      // raceConnect could not log this itself: it has no correlation id.
      // `reused` becomes false rather than staying null: no socket was handed
      // over, but a connection was certainly attempted, and this is the very
      // population where the cold-path question is asked.
      if (e && e.__conn) { diag.conn = e.__conn; diag.stage = 'connect'; diag.reused = false; }
      fail(e.code || 'socket_error');
    });

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

/**
 * One line per upstream attempt. This is the whole point of the patch: the
 * per-request line below reports what happened, this one reports WHERE.
 *
 * Nothing from the request travels into it — no header, no body, no query, no
 * token. The path is the allowlist pattern, the same value the request line
 * already logs. What is added is the shape of the connection: the addresses
 * tried, the stage each of them reached, and how long each stage took.
 */
function logAttempt(ctx, n, outcome, diag, reason, pool) {
  try {
    // A reused socket's connection trace describes a DIFFERENT, earlier
    // request. Repeating it would read as "this attempt tried these
    // addresses", which is exactly the kind of wrong a diagnostic log must not
    // be. Its age is reported instead, and that is the fact worth having: cold
    // connections are the ones that fail.
    const trace = diag && diag.reused !== true ? diag.conn : null;

    // Attribution is a NARROWER question than the trace. A trace exists on a
    // successful race too, and it routinely contains the address that lost —
    // so on this upstream, where one address has refused every handshake, every
    // 200 would otherwise be filed under the TCP stage. Only a connection that
    // never produced a socket is explained by its targets.
    const failed = diag && diag.socket_ms == null ? diag.conn : null;
    const worst = failed ? worstTarget(failed.targets) : null;

    console.log(JSON.stringify({
      evt: 'upstream_attempt',
      request_id: ctx.requestId,
      gw_request_id: ctx.gatewayRequestId,
      method: ctx.method,
      path: ctx.path,
      attempt: n,
      max_attempts: MAX_ATTEMPTS,
      outcome,
      class: (diag && diag.class) || null,
      reason: reason || null,
      // Named only when a target explains it, so a stage never contradicts the
      // class on its own line.
      stage: worst ? worst.stage : (outcome === 'ok' ? 'response' : (diag && diag.stage) || 'unknown'),
      stage_duration_ms: worst ? worst.stage_ms : null,
      // Flat, because Cloud Logging filters cannot index into a JSON array, and
      // "is one of the two addresses dead" is the most decision-relevant cut
      // there is. Without these it needs an export and a jq pass.
      worst_target: worst ? worst.target : null,
      worst_error: worst ? worst.error : null,
      targets_summary: trace
        ? trace.targets.map((t) => `${t.target}=${t.stage}/${t.outcome}`).join(';')
        : null,
      attempt_duration_ms: diag ? diag.duration_ms : null,
      total_duration_ms: Date.now() - ctx.started,
      status: diag ? diag.status ?? null : null,
      ttfb_ms: diag ? diag.ttfb_ms : null,
      socket_ms: diag ? diag.socket_ms : null,
      reused: diag ? diag.reused : null,
      conn_age_ms: diag ? diag.conn_age_ms : null,
      // The gap since this instance last served a request. Failure rate is a
      // function of exactly this: 2.8% back-to-back, 54% ten minutes apart.
      // Without it that split is a window function over an export; with it, it
      // is a group-by.
      idle_ms: ctx.idleMs,
      first_invocation: ctx.firstInvocation,
      instance: INSTANCE,
      // Sampled before the attempt ran, so it reports the contention the
      // attempt met rather than the aftermath it left.
      pool,
      dns: trace ? trace.dns : null,
      connect_ms: trace ? trace.duration_ms : null,
      targets: trace ? trace.targets : null,
    }));
  } catch {
    // Observability must never be able to affect a request. It has no
    // consequence beyond this line, so a failure here has none either.
  }
}

async function send(target, method, headers, body, ctx) {
  let last;
  let made = 0;
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    made = n;
    const pool = poolState();
    let res = null;
    try {
      res = await attempt(target, method, headers, body);
    } catch (err) {
      last = err;
    }
    // Deliberately OUTSIDE the try that governs the retry decision. Inside it,
    // a throw from a log line would be caught as an upstream failure carrying
    // no `sent` flag — and `isRetrySafe(POST, undefined)` is true, so a
    // checkout the backend had already accepted would be sent a second time.
    // An observability patch must not be able to create a duplicate order.
    logAttempt(ctx, n, res ? 'ok' : 'fail', res ? res.diag : last.diag, res ? null : last.reason, pool);
    if (res) return { ...res, attempts: n };
    if (!isRetrySafe(method, last.sent) || n === MAX_ATTEMPTS) break;
  }
  // The count is the number of attempts actually made. It used to be the
  // constant, which is how a run that gave up after one attempt — every POST
  // that reached the wire — was recorded in production as four.
  throw Object.assign(last || new Error('failed'), { attempts: made });
}

/**
 * Exposed so the test suite can exercise routing and CORS directly rather than
 * grepping this file. Not part of the function's contract with the gateway.
 */
module.exports._internal = {
  ROUTES, UPSTREAM, matchRoute, logPath, corsHeaders, isRetrySafe, REQUEST_HEADERS, RESPONSE_HEADERS,
  // Observability. Pure functions and one connector, exported so the stage
  // classification can be proven against real failing sockets rather than
  // asserted from the shape of the code.
  classifyConnect, classifyAttempt, worstTarget, correlationId, correlationSource, clientRequestId,
  connectTarget, poolState, agent, KNOWN_SEGMENTS, rawByteCounts,
  SAFE_REQUEST_ID, CONNECT_TIMEOUT_MS, READ_TIMEOUT_MS, MAX_ATTEMPTS,
};

module.exports.handler = async function (event, context) {
  const started = Date.now();
  invocations += 1;
  // `first_invocation` is an INSTANCE cold start, which is not the same thing
  // as the cold path a customer is on. `idle_ms` is the one that matters: the
  // gap since this instance last served anything, which is what decides whether
  // a live socket is waiting in the pool.
  const firstInvocation = invocations === 1;
  const idleMs = lastRequestAt ? started - lastRequestAt : null;
  lastRequestAt = started;
  const requestId = correlationId(event, context);
  const requestIdSource = correlationSource(event, context);
  const gatewayRequestId = clientRequestId(event);
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
    console.log(JSON.stringify({
      evt: 'rejected', request_id: requestId, request_id_source: requestIdSource,
      gw_request_id: gatewayRequestId, method: method.slice(0, 16), path: logPath(path, null),
      status: 404, idle_ms: idleMs, first_invocation: firstInvocation, instance: INSTANCE,
    }));
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
      console.log(JSON.stringify({
        evt: 'too_large', request_id: requestId, path: logPath(path, route), status: 413,
        idle_ms: idleMs, instance: INSTANCE,
      }));
      return json(413, { error: 'payload_too_large' }, cors);
    }
    if (!headers['content-type']) headers['content-type'] = 'application/json';
    // Explicit, because without it Node streams the body chunked, and this
    // upstream rejects chunked requests with an Express parse error.
    headers['content-length'] = String(Buffer.byteLength(body, 'utf8'));
  }

  const t0 = Date.now();
  const ctx = {
    requestId, gatewayRequestId, method, path: logPath(path, route), started,
    idleMs, firstInvocation,
  };
  try {
    const res = await send(target, method, headers, body, ctx);

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
      evt: 'proxied', request_id: requestId, request_id_source: requestIdSource,
      gw_request_id: gatewayRequestId, method, path: logPath(path, route), status: res.status,
      attempts: res.attempts, bytes: res.body.length, upstream_ms: Date.now() - t0,
      total_ms: Date.now() - started, reused: res.diag ? res.diag.reused : null,
      idle_ms: idleMs, first_invocation: firstInvocation, instance: INSTANCE,
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
      evt: 'error', request_id: requestId, request_id_source: requestIdSource,
      gw_request_id: gatewayRequestId, method, path: logPath(path, route), kind, reason: err && err.reason,
      // `reason` is left exactly as it was, including its `socket_error`
      // catch-all, so this line stays comparable with 58 hours of history.
      // `class` is the new, machine-readable answer to the same question.
      class: (err && err.diag && err.diag.class) || null,
      attempts: err && err.attempts, total_ms: Date.now() - started,
      // Repeated from the attempt lines so an alert keyed on this event can say
      // cold-or-warm without joining back on request_id.
      reused: err && err.diag ? err.diag.reused : null,
      idle_ms: idleMs, first_invocation: firstInvocation, instance: INSTANCE,
    }));
    return json(kind === 'timeout' ? 504 : 502, { error: kind }, cors);
  }
};
