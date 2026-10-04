/* Magic eSIM — the GLOBAL (international, USD) catalogue, read-only.
 *
 * WHAT IT READS: `GET /api/v1/retail/packages?market=global` — the SAME
 * backend and the SAME catalogue the Russian storefront sells from, priced in
 * US dollars by the GLOBAL policy (provider cost → formula, catalogue rules,
 * per-package controls). There is no second catalogue and no static copy of it.
 *
 * WHAT IT NEVER DOES, each by construction:
 *   * It never falls back to /assets/catalog.json. That snapshot is the Russian
 *     catalogue in ROUBLES; showing it on an English page is exactly the «₽ for
 *     reference» this replaces, and a stale rouble price dressed as a dollar
 *     one would be worse. No GLOBAL answer means «prices unavailable», said so.
 *   * It never writes. One GET, no other request, no quote, no order. A test
 *     asserts it.
 *   * It never leaves the primary backend (owner's decision D1, 2026-10-04).
 *     The Russian storefront keeps its fallback road through the Yandex Cloud
 *     gateway; GLOBAL does not use it — no GLOBAL request is carried to
 *     infrastructure outside the primary origin. When Render does not answer,
 *     the page says prices are unavailable. The EN pages' CSP `connect-src`
 *     allows that one origin only, so a regression here is also refused by the
 *     browser itself.
 *   * It never trusts a 200 blindly: the body must say market «global» and
 *     currency «USD», carry a data array and only positive prices. Anything
 *     else is «unavailable», not a guess.
 *
 * WHERE: MagicNet.primaryBase — the one place the storefront names its
 * primary API origin. MagicNet.request is NOT used for this read, because it
 * would carry a failed read to the fallback gateway.
 *
 * Exposes window.MagicGlobalCatalog = { PATH, load(), validate() }.
 */
(function (root) {
  'use strict';

  var PATH = '/api/v1/retail/packages?market=global';
  // The answer is ~1.5 MB of JSON (about 130 KB on the wire); a phone on a slow
  // network needs longer than MagicNet's 6 s read budget.
  var TIMEOUT_MS = 15000;

  function positive(n) { var v = Number(n); return isFinite(v) && v > 0; }

  /**
   * Is this a GLOBAL catalogue we may render? Pure, for the tests.
   * @returns {{ok:true, packages:Array}|{ok:false, reason:string}}
   */
  function validate(status, body) {
    if (status === 503) {
      return { ok: false, reason: body && body.error === 'GLOBAL_PRICING_DISABLED' ? 'disabled' : 'unavailable' };
    }
    if (status === 429) return { ok: false, reason: 'busy' };
    if (status !== 200 || !body || typeof body !== 'object') return { ok: false, reason: 'unavailable' };
    if (body.market !== 'global' || body.currency !== 'USD' || !Array.isArray(body.data)) {
      return { ok: false, reason: 'bad_shape' };
    }
    var out = [];
    for (var i = 0; i < body.data.length; i += 1) {
      var p = body.data[i];
      if (!p || typeof p !== 'object') continue;
      // A row must be in dollars and carry something payable: a fixed price,
      // or a ladder of positive term prices. Anything else is dropped rather
      // than shown with a number nobody can pay.
      if (p.currency !== undefined && p.currency !== 'USD') continue;
      var terms = Array.isArray(p.term_prices) ? p.term_prices.filter(function (t) {
        return t && positive(t.price) && positive(t.days);
      }) : null;
      if (!positive(p.price) && !(terms && terms.length)) continue;
      out.push(p);
    }
    if (!out.length) return { ok: false, reason: 'empty' };
    return { ok: true, packages: out };
  }

  function load() {
    var net = root.MagicNet;
    var base = net && net.primaryBase;
    if (typeof base !== 'string' || !/^https:\/\//.test(base) || typeof root.fetch !== 'function') {
      return Promise.resolve({ ok: false, reason: 'unavailable' });
    }
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ac ? setTimeout(function () { ac.abort(); }, TIMEOUT_MS) : null;
    var init = { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit' };
    if (ac) init.signal = ac.signal;
    return root.fetch(base + PATH, init).then(function (res) {
      return res.text().then(function (raw) {
        var body = null;
        try { body = raw ? JSON.parse(raw) : null; } catch (e) { /* not json */ }
        return validate(res.status, body);
      });
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      return r;
    }, function () {
      if (timer) clearTimeout(timer);
      return { ok: false, reason: 'unavailable' };
    });
  }

  var api = { PATH: PATH, TIMEOUT_MS: TIMEOUT_MS, load: load, validate: validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MagicGlobalCatalog = api;
})(typeof window !== 'undefined' ? window : globalThis);
