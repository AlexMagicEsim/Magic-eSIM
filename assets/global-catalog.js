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
 *   * It never writes. One GET through MagicNet, no other request, no quote,
 *     no order. A test asserts it.
 *   * It never trusts a 200 blindly: the body must say market «global» and
 *     currency «USD», carry a data array and only positive prices. Anything
 *     else is «unavailable», not a guess.
 *
 * WHY MagicNet: it already knows where the API lives (Render first, the
 * gateway as fallback) and which failures may be retried on the other road.
 * A 503 — the lane switched off — is retried there too and is still a 503.
 *
 * Exposes window.MagicGlobalCatalog = { PATH, load(), validate() }.
 */
(function (root) {
  'use strict';

  var PATH = '/api/v1/retail/packages?market=global';

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
    if (!net || typeof net.request !== 'function') return Promise.resolve({ ok: false, reason: 'unavailable' });
    return net.request(PATH, { method: 'GET' }).then(function (res) {
      return validate(res && res.status, res && res.body);
    }, function () {
      return { ok: false, reason: 'unavailable' };
    });
  }

  var api = { PATH: PATH, load: load, validate: validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MagicGlobalCatalog = api;
})(typeof window !== 'undefined' ? window : globalThis);
