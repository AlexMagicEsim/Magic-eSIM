/* Magic eSIM — catalogue loader with a same-origin fallback.
 *
 * Why this exists: the landing is on GitHub Pages, which Russian networks reach
 * reliably, while the API lives on a Render IP range they frequently cannot reach
 * at all. The site would load and the tariff list would stay empty. So: try the
 * live API, and if the network refuses, fall back to /assets/catalog.json — a
 * validated snapshot served from the very origin that already works.
 *
 * The cache is for DISPLAY ONLY. Its prices are provisional and are never sent to
 * the backend; the order endpoint re-reads the package from the database and
 * ignores anything the client supplies. Checkout from a cached card therefore
 * re-validates against the live API first (see revalidatePackage) and refuses to
 * open if the backend cannot be reached — no backend, no payment.
 *
 * Single implementation shared by index.html and assets/country-tariffs.js so the
 * fallback rules cannot drift apart between the landing and the country pages.
 *
 * Exposes window.MagicCatalog.
 */
(function () {
  'use strict';

  var API_BASE = 'https://api.magicesim.store';
  var LIVE_URL = API_BASE + '/api/v1/retail/packages';
  var CACHE_URL = '/assets/catalog.json';

  // 7s: long enough for a slow-but-working mobile connection, short enough that a
  // silently dropped connection does not hold the page for the old 20 seconds.
  var LIVE_TIMEOUT_MS = 7000;
  var CACHE_TIMEOUT_MS = 5000;
  var LIVE_ATTEMPTS = 2;
  var RETRY_BASE_MS = 1200;
  var SCHEMA_VERSION = 1;

  function jitter(base) { return base + Math.floor(Math.random() * 400); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** fetch with a hard deadline; rejects with a tagged error we can classify. */
  function fetchWithTimeout(url, timeoutMs) {
    if (typeof AbortController === 'undefined' || typeof fetch !== 'function') {
      return Promise.reject(tagged('unsupported', 'fetch/AbortController unavailable'));
    }
    var ac = new AbortController();
    var timer = setTimeout(function () { ac.abort(); }, timeoutMs);
    return fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' }, credentials: 'omit' })
      .then(function (res) { clearTimeout(timer); return res; })
      .catch(function (err) {
        clearTimeout(timer);
        // An aborted fetch and a refused one are indistinguishable to the caller
        // otherwise, and they mean different things when we log them.
        throw tagged(err && err.name === 'AbortError' ? 'timeout' : 'network', String(err && err.message || err));
      });
  }

  function tagged(type, message) {
    var e = new Error(message || type);
    e.errorType = type;
    return e;
  }

  /**
   * Which HTTP failures are worth falling back for. 5xx and 429 are the API
   * having a bad time; 404/403 on a public endpoint are almost certainly a
   * network intermediary rather than our routing, so we fall back too — but the
   * error type is preserved so a genuine misconfiguration still shows up in
   * analytics instead of being silently papered over.
   */
  function httpErrorType(status) {
    if (status >= 500) return 'http_5xx';
    if (status === 429) return 'http_429';
    if (status === 404) return 'http_404';
    if (status === 403) return 'http_403';
    return 'http_' + status;
  }

  /** One live attempt. Resolves with the package array or throws a tagged error. */
  function fetchLiveOnce() {
    return fetchWithTimeout(LIVE_URL + '?t=' + Date.now(), LIVE_TIMEOUT_MS)
      .then(function (res) {
        if (res.status !== 200) throw tagged(httpErrorType(res.status), 'HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var json;
        try { json = JSON.parse(text); } catch (e) { throw tagged('bad_json', 'live response is not JSON'); }
        if (!json || !Array.isArray(json.data)) throw tagged('bad_shape', 'live response has no data array');
        // An empty catalogue is never correct here — treat it as a failure so the
        // cache can still show something rather than rendering an empty page.
        if (json.data.length === 0) throw tagged('empty', 'live catalogue is empty');
        return json.data;
      });
  }

  /** Live API with a bounded number of attempts. Never loops indefinitely. */
  function fetchLive() {
    var lastErr = null;
    function attempt(n) {
      return fetchLiveOnce().catch(function (err) {
        lastErr = err;
        if (n + 1 >= LIVE_ATTEMPTS) throw lastErr;
        return sleep(jitter(RETRY_BASE_MS)).then(function () { return attempt(n + 1); });
      });
    }
    return attempt(0);
  }

  /**
   * Structural validation of the cache, mirroring scripts/update-catalog-cache.mjs.
   * A file the generator would refuse to write is also refused here, so a
   * hand-edited or truncated catalog.json cannot reach the UI.
   */
  function validateCache(doc) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 'not an object';
    if (doc.schema_version !== SCHEMA_VERSION) return 'unsupported schema_version: ' + doc.schema_version;
    if (typeof doc.generated_at !== 'string' || isNaN(Date.parse(doc.generated_at))) return 'invalid generated_at';
    if (!Array.isArray(doc.packages)) return 'packages is not an array';
    if (doc.packages.length === 0) return 'packages is empty';
    if (doc.package_count !== doc.packages.length) return 'package_count does not match packages.length';
    var seen = Object.create(null);
    for (var i = 0; i < doc.packages.length; i++) {
      var p = doc.packages[i];
      if (!p || typeof p !== 'object') return 'packages[' + i + '] is not an object';
      if (typeof p.package_id !== 'string' || !p.package_id) return 'packages[' + i + '] has no package_id';
      if (seen[p.package_id]) return 'duplicate package_id: ' + p.package_id;
      seen[p.package_id] = true;
      if (typeof p.price !== 'number' || !isFinite(p.price) || p.price <= 0) return 'packages[' + i + '] has an invalid price';
      if (typeof p.name !== 'string' || !p.name) return 'packages[' + i + '] has no name';
    }
    return null;
  }

  function fetchCache() {
    return fetchWithTimeout(CACHE_URL + '?t=' + Date.now(), CACHE_TIMEOUT_MS)
      .then(function (res) {
        if (res.status !== 200) throw tagged('cache_http_' + res.status, 'cache HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var doc;
        try { doc = JSON.parse(text); } catch (e) { throw tagged('cache_bad_json', 'cache is not valid JSON'); }
        var problem = validateCache(doc);
        if (problem) throw tagged('cache_invalid', problem);
        return { packages: doc.packages, generatedAt: doc.generated_at };
      });
  }

  /**
   * Live first, cache second. Resolves with
   *   { source: 'live' | 'cache', packages, generatedAt }
   * and rejects with a structured error when neither is available, so the caller
   * can render a real message instead of leaving a spinner up.
   */
  function load() {
    return fetchLive()
      .then(function (packages) {
        return { source: 'live', packages: packages, generatedAt: null, liveError: null };
      })
      .catch(function (liveErr) {
        return fetchCache()
          .then(function (c) {
            return { source: 'cache', packages: c.packages, generatedAt: c.generatedAt, liveError: liveErr.errorType || 'unknown' };
          })
          .catch(function (cacheErr) {
            throw {
              source: 'none',
              liveError: liveErr.errorType || 'unknown',
              cacheError: cacheErr.errorType || 'unknown',
              message: 'live and cache both unavailable',
            };
          });
      });
  }

  /**
   * Used before opening checkout on a cached card, and by the retry button.
   * Returns the live package list or throws — deliberately no cache fallback:
   * if this cannot reach the backend, an order cannot be created either, and the
   * caller must refuse to start a payment.
   */
  function loadLive() {
    return fetchLive();
  }

  /**
   * Confirms a package still exists at the current price before anyone pays.
   * Resolves with { ok: true, pkg, priceChanged, previousPrice } or
   * { ok: false, reason: 'gone' | 'unreachable' }.
   */
  function revalidatePackage(packageId, cachedPrice) {
    return loadLive().then(function (packages) {
      var pkg = null;
      for (var i = 0; i < packages.length; i++) {
        if (packages[i].package_id === packageId) { pkg = packages[i]; break; }
      }
      // Gone from the live catalogue means deactivated or withdrawn. The backend
      // would reject the order anyway; refusing here saves the user a dead end.
      if (!pkg) return { ok: false, reason: 'gone', packages: packages };
      var changed = cachedPrice != null && Number(pkg.price) !== Number(cachedPrice);
      return { ok: true, pkg: pkg, packages: packages, priceChanged: changed, previousPrice: changed ? Number(cachedPrice) : null };
    }).catch(function () {
      return { ok: false, reason: 'unreachable' };
    });
  }

  function cacheAgeHours(generatedAt) {
    if (!generatedAt) return null;
    var t = Date.parse(generatedAt);
    if (isNaN(t)) return null;
    return Math.max(0, Math.round((Date.now() - t) / 3600000));
  }

  window.MagicCatalog = {
    load: load,
    loadLive: loadLive,
    revalidatePackage: revalidatePackage,
    validateCache: validateCache,
    cacheAgeHours: cacheAgeHours,
    CACHE_URL: CACHE_URL,
    LIVE_URL: LIVE_URL,
    LIVE_TIMEOUT_MS: LIVE_TIMEOUT_MS,
    CACHE_TIMEOUT_MS: CACHE_TIMEOUT_MS,
    LIVE_ATTEMPTS: LIVE_ATTEMPTS,
    SCHEMA_VERSION: SCHEMA_VERSION,
  };
})();
