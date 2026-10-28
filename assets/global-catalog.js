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
 * ONE COUNTRY, NOT THE WHOLE CATALOGUE (2026-10-27): a country page passes its
 * ISO code, `load({ country: 'TH' })`, and asks for
 * `?market=global&country=TH` — the backend's SAME objects for exactly the ids
 * of that country's layout entry, plus the entry (~2.5 KB on the wire instead
 * of ~237 KB; esim-backend lib/globalCatalogueCountry.js). Nothing is chosen
 * here: the answer goes through the same validate() and the same layout
 * reader. When the backend does not know the country (400 INVALID_COUNTRY,
 * 404 COUNTRY_NOT_FOUND), or its answer is empty or has no entry for it, the
 * page asks ONCE for the whole catalogue, from the same primary origin — so
 * «no plans here» is decided exactly as before, and a backend without the
 * parameter still works. A refusal (429, 503), an error or no answer is NOT
 * retried: the page says prices are unavailable, as before.
 *
 * Exposes window.MagicGlobalCatalog = { PATH, countryPath(), load(), validate() }.
 */
(function (root) {
  'use strict';

  var PATH = '/api/v1/retail/packages?market=global';
  // The whole answer is ~2.3 MB of JSON (about 237 KB on the wire, 2026-10-27);
  // a phone on a slow network needs longer than MagicNet's 6 s read budget.
  var TIMEOUT_MS = 15000;

  function positive(n) { var v = Number(n); return isFinite(v) && v > 0; }

  /**
   * Is this a GLOBAL catalogue we may render? Pure, for the tests.
   * @returns {{ok:true, packages:Array, assortment:Object|null}|{ok:false, reason:string}}
   * `assortment` is the backend's layout of every country page (assets/assortment-view.js),
   * also attached to `packages`.
   */
  function validate(status, body) {
    if (status === 503) {
      return { ok: false, reason: body && body.error === 'GLOBAL_PRICING_DISABLED' ? 'disabled' : 'unavailable' };
    }
    if (status === 429) return { ok: false, reason: 'busy' };
    // The one-country read only (countryPath): the backend does not know that country.
    if ((status === 400 && body && body.error === 'INVALID_COUNTRY')
      || (status === 404 && body && body.error === 'COUNTRY_NOT_FOUND')) return { ok: false, reason: 'unknown_country' };
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
    var layout = body.assortment && typeof body.assortment === 'object' ? body.assortment : null;
    var A = root.MagicAssortment;
    if (A && typeof A.attach === 'function') A.attach(out, layout);
    return { ok: true, packages: out, assortment: layout };
  }

  var ISO2 = /^[A-Z]{2}$/;

  /** The one-country read for an ISO code, or null for anything that is not one. */
  function countryPath(iso) {
    return typeof iso === 'string' && ISO2.test(iso) ? PATH + '&country=' + iso : null;
  }

  /** Is a one-country answer drawable as it is? Otherwise the whole catalogue is asked once. */
  function narrowedFits(r, iso) {
    var c = r.assortment && r.assortment.countries;
    return !!(c && Object.prototype.hasOwnProperty.call(c, iso));
  }

  /**
   * @param {{country?: string}} [opts]  a country page passes its ISO code
   */
  function load(opts) {
    var net = root.MagicNet;
    var base = net && net.primaryBase;
    if (typeof base !== 'string' || !/^https:\/\//.test(base) || typeof root.fetch !== 'function') {
      return Promise.resolve({ ok: false, reason: 'unavailable' });
    }
    var iso = opts && opts.country;
    var one = countryPath(iso);
    if (!one) return get(base, PATH);
    return get(base, one).then(function (r) {
      if (r.ok && narrowedFits(r, iso)) return r;
      if (r.ok || r.reason === 'unknown_country' || r.reason === 'empty') return get(base, PATH);
      return r;
    });
  }

  /** ONE GET of the primary origin — the only request this file makes. */
  function get(base, path) {
    var ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ac ? setTimeout(function () { ac.abort(); }, TIMEOUT_MS) : null;
    var init = { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit' };
    if (ac) init.signal = ac.signal;
    return root.fetch(base + path, init).then(function (res) {
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

  var api = { PATH: PATH, TIMEOUT_MS: TIMEOUT_MS, countryPath: countryPath, load: load, validate: validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MagicGlobalCatalog = api;
})(typeof window !== 'undefined' ? window : globalThis);
