/**
 * magic-net.js — one network strategy for the whole storefront.
 *
 * WHY THIS EXISTS
 *
 * Every storefront page pointed at https://api.magicesim.store and had no second
 * road. A read-only measurement on 2026-08-22 (126 cold samples per host, plus a
 * 26-round series spaced 70s apart to model a real visitor rather than a burst):
 *
 *              success   p50      p95       502   timeouts
 *   gateway     48.4%   1983ms   20844ms    16      49
 *   render      97.6%    422ms    3247ms     0       3
 *
 * The order-create route through the gateway answered 0 of 25 attempts on a
 * kept-alive socket. This is TD-55 — the failure layer is the Yandex Cloud
 * egress reaching Render's Cloudflare edge — and it is documented, long-running
 * and not fixed by anything a browser can do.
 *
 * So the storefront now does what the Mini App has always done: Render first,
 * gateway as the second road. The rules below are ported from app/core.js
 * deliberately rather than reinvented, because two different answers to "may I
 * retry this?" in one product is how a double charge eventually happens.
 *
 * WHAT MAY BE CARRIED TO THE SECOND ROAD, AND NOTHING ELSE
 *
 * Only a request that reached NO VERDICT: status 0 (abort, DNS, TLS, offline),
 * 502, 503, 504. Every other status is an ANSWER and is honoured wherever it
 * came from. A 400, 401, 403, 404, 409, 422 or 429 re-asked at the other host is
 * the same answer plus a delay — and worse than useless for 409 and 429, where
 * the second ask would turn a rate limit into a way of doubling load, or race a
 * question the database has already settled. Both hosts are the same backend and
 * the same Postgres; asking twice does not make an answer truer.
 *
 * BOUNDED. One attempt per endpoint, two endpoints, so a logical call is at most
 * two requests and then an honest error. No retry storm, no loop.
 */
(function () {
  'use strict';

  // The canonical pair, identical to app/core.js. Not a new address: the Mini
  // App has shipped against exactly these two for months.
  var ENDPOINTS = [
    { name: 'render', base: 'https://esim-backend-3wmu.onrender.com' },
    { name: 'gateway', base: 'https://api.magicesim.store' }
  ];

  /**
   * Bounded client timeouts, chosen from the measurement above rather than from
   * taste. The rule in both directions: the primary must give up soon enough
   * that the fallback still helps a waiting person, and late enough that a
   * healthy-but-slow Render is never mistaken for a broken one.
   *
   *   read   6s — Render's p95 on these paths is 0.8s and its worst observed
   *               sample 2.05s, so 6s is ~3x the worst real answer. The gateway
   *               routinely burns 17-26s here; nobody should wait that out.
   *   write 10s — order creation also calls Platega, so it is allowed more than
   *               a read. Worst case for the pair is ~20s, which is the ceiling
   *               for a payment the customer is watching. A shorter primary is
   *               now affordable BECAUSE the lost-response case is proven safe:
   *               a retry under the same key returns the first order.
   *   status 8s — polling already has its own 4s interval and attempt cap; this
   *               only stops one poll hanging past the next.
   */
  var TIMEOUTS = { read: 6000, write: 10000, status: 8000 };

  function classOf(kind) { return TIMEOUTS[kind] || TIMEOUTS.read; }

  /** A verdictless failure — the only thing that may be carried to endpoint two. */
  function isTransport(status) {
    return status === 0 || status === 502 || status === 503 || status === 504;
  }

  /**
   * Observability, through the analytics wrapper the storefront already has.
   * No new system, and nothing identifying: an endpoint name, a request class
   * and an outcome. Never a token, an email, an order id or a payload.
   */
  function note(outcome, endpointClass) {
    try {
      if (typeof window.magicMetrikaGoal === 'function') {
        window.magicMetrikaGoal('api_failover', { outcome: outcome, endpoint_class: endpointClass });
      }
    } catch (e) { /* analytics must never break a purchase */ }
  }

  function once(base, path, opts, timeoutMs) {
    var ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ac ? setTimeout(function () { ac.abort(); }, timeoutMs) : null;
    var init = {
      method: opts.method || 'GET',
      headers: opts.headers || { Accept: 'application/json' },
      credentials: 'omit'
    };
    if (opts.body !== undefined && opts.body !== null) init.body = opts.body;
    if (ac) init.signal = ac.signal;

    return fetch(base + path, init).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.text().then(function (raw) {
        var json = null;
        try { json = raw ? JSON.parse(raw) : null; } catch (e) { /* not json */ }
        return { status: res.status, body: json, raw: raw, ok: res.ok };
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      // A thrown fetch reached no verdict: abort, DNS, TLS, offline. Status 0 so
      // it classifies exactly like the gateway drop it usually is.
      return { status: 0, body: null, ok: false, err: String((err && err.message) || err) };
    });
  }

  /**
   * One logical request across the endpoint list.
   *
   * @param {string} path      e.g. '/api/v1/public/retail-orders'
   * @param {object} [opts]
   *   method, headers, body   passed through UNCHANGED — see the warning below
   *   kind                    'read' | 'write' | 'status' (picks the timeout)
   *   idempotent              REQUIRED to fail over a write. See below.
   *
   * THE WRITE RULE. A write is carried to the second endpoint only when the
   * caller marks it `idempotent`, and the body is forwarded byte for byte. The
   * caller must therefore build the body ONCE — including its idempotency_key —
   * and hand the same string to this function. Regenerating a key between the
   * two roads would defeat the entire mechanism and is the one thing that could
   * turn a network blip into two orders. Proven in
   * test/integration/crossOriginIdempotency.test.js: a retry under the same key
   * through the OTHER origin returns the first order, 200 with
   * idempotent_replay, one row in retail_orders, one payment.
   *
   * @returns {Promise<{status, body, raw, ok, endpoint, fallbackUsed}>}
   */
  function request(path, opts) {
    opts = opts || {};
    var kind = opts.kind || (opts.method && opts.method !== 'GET' ? 'write' : 'read');
    var isWrite = kind === 'write';
    var timeoutMs = classOf(kind);
    var lastStatus = null;

    function attempt(i) {
      var ep = ENDPOINTS[i];
      return once(ep.base, path, opts, timeoutMs).then(function (res) {
        var transport = isTransport(res.status);

        // An answer. Return it, whichever road brought it.
        if (!transport) {
          note(i === 0 ? 'primary_ok' : 'fallback_ok', kind);
          res.endpoint = ep.name;
          res.fallbackUsed = i > 0;
          return res;
        }

        lastStatus = res.status;
        var isLast = i === ENDPOINTS.length - 1;
        // A write without a stable key must never be re-sent: the first attempt
        // may have been received and only its answer lost.
        var mayCarry = !isWrite || opts.idempotent === true;

        if (isLast || !mayCarry) {
          note(isLast ? 'both_failed' : 'no_failover_unsafe_write', kind);
          res.endpoint = ep.name;
          res.fallbackUsed = i > 0;
          res.transportFailure = true;
          return res;
        }
        return attempt(i + 1);
      });
    }

    return attempt(0);
  }

  window.MagicNet = {
    ENDPOINTS: ENDPOINTS,
    TIMEOUTS: TIMEOUTS,
    isTransport: isTransport,
    request: request,
    /** The primary base, for callers that still build their own URL. */
    primaryBase: ENDPOINTS[0].base,
    fallbackBase: ENDPOINTS[1].base
  };
})();
