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

  // The endpoint list, primary first. Taken from MagicNet when it is present so
  // there is ONE definition of "where the API lives" in the storefront; the
  // literals below are the same pair and exist only so this file still works if
  // it is ever loaded on a page that forgot the script tag.
  var BASES = (window.MagicNet && window.MagicNet.ENDPOINTS)
    ? window.MagicNet.ENDPOINTS.map(function (e) { return e.base; })
    : ['https://esim-backend-3wmu.onrender.com', 'https://api.magicesim.store'];
  var API_BASE = BASES[0];
  var LIVE_PATH = '/api/v1/retail/packages';
  var LIVE_URL = API_BASE + LIVE_PATH;
  var CACHE_URL = '/assets/catalog.json';

  // 7s: long enough for a slow-but-working mobile connection, short enough that a
  // silently dropped connection does not hold the page for the old 20 seconds.
  var LIVE_TIMEOUT_MS = 7000;
  var CACHE_TIMEOUT_MS = 5000;
  var LIVE_ATTEMPTS = 2;
  var RETRY_BASE_MS = 1200;
  var SCHEMA_VERSION = 1;

  // Fail-fast: how long the live API gets to answer before the page stops
  // waiting and renders the static snapshot instead. Chosen from measured
  // production timings (2026-08-16): a warm proxy path answers in ~0.25-0.3s and
  // always wins; a healthy cold path lands around 1.1s and usually wins; the
  // TD-55 failure mode burns 5-12s and must never be waited out. Losing the
  // race is cheap — the snapshot is at most hours old, no notice is shown for a
  // fresh one, and checkout revalidates against the live API regardless.
  var RACE_DEADLINE_MS = 1200;

  // A snapshot older than this stops pretending to be current: it no longer
  // wins the deadline race (the page waits for the live API instead) and, when
  // it is shown because the API is truly down, the caller is told it is stale
  // so it can say so. The generator refreshes six times a day, so 48h means at
  // least twelve missed refreshes — a dead pipeline, not a quiet weekend.
  var STALE_MAX_HOURS = 48;

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

  /** One live attempt against ONE endpoint. Resolves with the package array. */
  function fetchLiveOnce(base) {
    return fetchWithTimeout((base || API_BASE) + LIVE_PATH + '?t=' + Date.now(), LIVE_TIMEOUT_MS)
      .then(function (res) {
        if (res.status !== 200) {
          // `errorType` stays coarse because analytics is built on it — 5xx has
          // always collapsed to 'http_5xx'. The exact status rides alongside so
          // endpoint failover can be precise about which failures reached no
          // verdict; classifying on errorType alone silently never fell over,
          // because 'http_502' is a value this function has never produced.
          var e = tagged(httpErrorType(res.status), 'HTTP ' + res.status);
          e.httpStatus = res.status;
          throw e;
        }
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

  /**
   * Only a failure that reached NO VERDICT may be carried to the second
   * endpoint. A 404 or a 403 is an answer and would be the same answer there;
   * re-asking it just spends another second of somebody's morning.
   */
  function carriesToNextEndpoint(err) {
    if (!err) return false;
    var t = err.errorType;
    if (t === 'timeout' || t === 'network') return true;
    var st = err.httpStatus;
    return st === 502 || st === 503 || st === 504;
  }

  /**
   * Live API, bounded twice over: LIVE_ATTEMPTS against the primary, then ONE
   * attempt against the fallback. Three requests worst case, then the caller
   * falls through to the static snapshot exactly as before — this changes which
   * roads are tried, not what happens when they all fail.
   */
  function fetchLive() {
    var lastErr = null;
    function onPrimary(n) {
      return fetchLiveOnce(BASES[0]).catch(function (err) {
        lastErr = err;
        if (n + 1 >= LIVE_ATTEMPTS) throw err;
        return sleep(jitter(RETRY_BASE_MS)).then(function () { return onPrimary(n + 1); });
      });
    }
    return onPrimary(0).catch(function (err) {
      if (BASES.length < 2 || !carriesToNextEndpoint(err)) throw err;
      return fetchLiveOnce(BASES[1]).catch(function (err2) {
        // Report the PRIMARY's failure: it is the one that describes the outage.
        throw lastErr || err2;
      });
    });
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

  function cacheAgeMsOf(generatedAt) {
    if (!generatedAt) return null;
    var t = Date.parse(generatedAt);
    if (isNaN(t)) return null;
    return Math.max(0, Date.now() - t);
  }

  /**
   * Live and cache RACE with a deadline, so TD-55's 5-12s connection stalls stop
   * translating into an empty tariff list.
   *
   *   - The live request starts immediately and, if it answers before the
   *     deadline, wins exactly as before.
   *   - At the deadline the static snapshot is fetched; if it is valid and
   *     fresh (see STALE_MAX_HOURS) it renders NOW while the live request keeps
   *     running in the background.
   *   - A stale snapshot never wins the race: the page keeps waiting for the
   *     live API and falls back to the stale copy only when the API has
   *     definitively failed — flagged `stale: true` so the caller can say so.
   *   - If the live API fails outright (5xx, timeout, network) the snapshot is
   *     used immediately, fresh or stale, without waiting for the deadline.
   *
   * Resolves with
   *   { source: 'live'|'cache', packages, generatedAt, liveError, stale,
   *     metrics: { apiLatencyMs, fallbackTriggered, deadlineMs, staticAgeMs },
   *     whenLive }
   * where `whenLive` NEVER rejects: it resolves { packages, latencyMs } if the
   * losing live request later succeeded, or null. Callers may use it to refresh
   * their in-memory list for the NEXT render; nothing here re-renders anything.
   *
   * Rejects with the same structured error as before when neither source works.
   *
   * `opts.deadlineMs` / `opts.staleMaxHours` exist for tests only; production
   * callers pass nothing.
   */
  function load(opts) {
    opts = opts || {};
    var deadlineMs = typeof opts.deadlineMs === 'number' ? opts.deadlineMs : RACE_DEADLINE_MS;
    var staleMaxMs = (typeof opts.staleMaxHours === 'number' ? opts.staleMaxHours : STALE_MAX_HOURS) * 3600000;
    var t0 = Date.now();

    var livePromise = fetchLive().then(
      function (packages) { return { packages: packages, latencyMs: Date.now() - t0 }; },
      function (err) { err.latencyMs = Date.now() - t0; throw err; }
    );

    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = null;
      var cachePromise = null;
      // Set the moment live DEFINITIVELY fails, so a deadline handler whose
      // cache fetch outlived the failure reports the real error, not the
      // deadline that merely started the fetch.
      var liveFailedType = null;

      // The cache is fetched at most once, and only when needed: at the
      // deadline, or the moment the live API definitively fails. A fast live
      // win never touches it.
      function startCache() {
        if (!cachePromise) cachePromise = fetchCache();
        return cachePromise;
      }

      function settle(fn, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn(value);
      }

      function liveResult(r) {
        return {
          source: 'live', packages: r.packages, generatedAt: null, liveError: null, stale: false,
          metrics: { apiLatencyMs: r.latencyMs, fallbackTriggered: false, deadlineMs: deadlineMs, staticAgeMs: null },
          whenLive: Promise.resolve(null),
        };
      }

      function cacheResult(c, liveErrType, livePending) {
        var ageMs = cacheAgeMsOf(c.generatedAt);
        return {
          source: 'cache', packages: c.packages, generatedAt: c.generatedAt,
          liveError: liveErrType, stale: ageMs == null || ageMs > staleMaxMs,
          metrics: {
            apiLatencyMs: livePending ? null : Date.now() - t0,
            fallbackTriggered: true, deadlineMs: deadlineMs, staticAgeMs: ageMs,
          },
          // The losing live request is not cancelled: if it lands, the caller
          // gets the fresher list for its NEXT render. Never rejects.
          whenLive: livePending
            ? livePromise.then(function (r) { return r; }, function () { return null; })
            : Promise.resolve(null),
        };
      }

      livePromise.then(
        function (r) { settle(resolve, liveResult(r)); },
        function (liveErr) {
          // Live is definitively down — the snapshot, fresh or stale, beats an
          // empty page. This does not wait for the deadline.
          liveFailedType = liveErr.errorType || 'unknown';
          startCache().then(
            function (c) { settle(resolve, cacheResult(c, liveErr.errorType || 'unknown', false)); },
            function (cacheErr) {
              settle(reject, {
                source: 'none',
                liveError: liveErr.errorType || 'unknown',
                cacheError: cacheErr.errorType || 'unknown',
                message: 'live and cache both unavailable',
              });
            }
          );
        }
      );

      timer = setTimeout(function () {
        if (settled) return;
        startCache().then(function (c) {
          if (settled) return;
          var ageMs = cacheAgeMsOf(c.generatedAt);
          // Only a FRESH snapshot may pre-empt a still-running live request; a
          // stale one waits for the live verdict (the failure path above).
          if (ageMs != null && ageMs <= staleMaxMs) {
            // Live may have failed while the cache fetch was in flight; report
            // the real verdict then, not the deadline that started the fetch.
            settle(resolve, liveFailedType
              ? cacheResult(c, liveFailedType, false)
              : cacheResult(c, 'race_deadline', true));
          }
        }, function () { /* cache broken: the live request stays the only hope */ });
      }, deadlineMs);
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


  /* =====================================================================
   * What actually tells two tariffs apart.
   * ---------------------------------------------------------------------
   * eSIM Access sells Japan twice at one price: same volume, same validity,
   * same wholesale cost. One exits the internet in Hong Kong over four
   * operators on 5G; the other exits in JAPAN over NTT docomo on 4G. Both
   * rendered as «Япония 3 GB · 400 ₽», and the customer had no way to learn
   * which was which — so the useful one was invisible rather than redundant.
   *
   * This computes, per package, the attributes that VARY among its siblings —
   * the packages with the same volume and the same validity. Only differences
   * are returned, so a country where nothing varies gets no extra text and no
   * card turns into a spec sheet.
   *
   * NOT Japan-specific and contains no country list: it compares whatever the
   * data says, so the moment any other country ships two tariffs with
   * different exits or different operators, the same labels appear there.
   *
   * Silence beats a placeholder: a package whose exit country is unknown
   * (MobiMatter has no such field; eSIM Access sometimes says "Europe", which
   * is not a country code) contributes no chip at all. Nothing renders the
   * word Unknown.
   * ================================================================== */

  var GENERATIONS = ['5G', '4G', '3G', '2G'];

  // eSIM Access writes "UK"; ISO-3166 says "GB", and every name map in this
  // project is keyed by the ISO code. Without this the chip would read
  // «IP: UK» — a raw code shown to a customer, which is the placeholder this
  // design set out to avoid. 201 packages carry a UK exit today.
  function toIsoCode(code) {
    var c = String(code || '').toUpperCase();
    return c === 'UK' ? 'GB' : c;
  }

  function ipCodes(item) {
    return Array.isArray(item && item.ip_export)
      ? item.ip_export.filter(Boolean).map(toIsoCode)
      : [];
  }

  function operatorNames(item) {
    var list = Array.isArray(item && item.networks) ? item.networks : [];
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var name = String((list[i] || {}).operator || '').trim();
      if (name && out.indexOf(name) === -1) out.push(name);
    }
    return out;
  }

  function topGeneration(item) {
    var techs = Array.isArray(item && item.network_technologies) ? item.network_technologies : [];
    var upper = techs.map(function (t) { return String(t || '').toUpperCase(); });
    for (var i = 0; i < GENERATIONS.length; i++) {
      if (upper.indexOf(GENERATIONS[i]) !== -1) return GENERATIONS[i];
    }
    return '';
  }

  /**
   * Siblings share COVERAGE, volume and validity.
   *
   * Coverage belongs in this key and leaving it out was a real defect, caught
   * on the Japan page: «Китай, Корея и Япония 12 GB» and «Азия и Океания 12 GB»
   * were compared as alternatives and each grew a chip explaining how it
   * differed from the other. They are not alternatives — they cover different
   * countries at different prices, and the label implied a choice that was not
   * being offered. A local tariff and a regional one that happens to include
   * the same country are likewise never siblings.
   */
  function siblingKey(item) {
    var codes = Array.isArray((item || {}).coverage_country_codes)
      ? item.coverage_country_codes.map(function (c) { return String(c || '').toUpperCase(); }).sort().join('+')
      : String((item || {}).country_code || '').toUpperCase();
    return [
      codes,
      item && item.unlimited ? 'U' : 'D' + Number((item || {}).data_gb),
      'V' + Number((item || {}).validity_days)
    ].join('|');
  }

  /**
   * @param {Array} list      packages as the public API returns them
   * @param {object} [opts]
   *   countryName(code)      -> human name; falls back to the code itself
   *   pluralNetworks(n)      -> e.g. "4 сети"; omit to fall back to "N сетей"
   * @returns {object} package_id -> [{kind:'ip'|'net'|'gen', label:string}]
   */
  function distinguishers(list, opts) {
    var packages = Array.isArray(list) ? list : [];
    var options = opts || {};
    var nameOf = typeof options.countryName === 'function'
      ? options.countryName
      : function (code) { return code; };
    var netsWord = typeof options.pluralNetworks === 'function'
      ? options.pluralNetworks
      : function (n) { return n + ' сетей'; };

    var groups = {};
    for (var i = 0; i < packages.length; i++) {
      var k = siblingKey(packages[i]);
      (groups[k] = groups[k] || []).push(packages[i]);
    }

    var out = {};
    for (var key in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, key)) continue;
      var group = groups[key];
      if (group.length < 2) continue;   // nothing to tell apart

      var ipValues = {}, netValues = {}, genValues = {};
      for (var g = 0; g < group.length; g++) {
        ipValues[ipCodes(group[g]).join('+')] = true;
        netValues[operatorNames(group[g]).slice().sort().join('|')] = true;
        genValues[topGeneration(group[g])] = true;
      }
      var ipVaries = Object.keys(ipValues).length > 1;
      var netVaries = Object.keys(netValues).length > 1;
      var genVaries = Object.keys(genValues).length > 1;
      if (!ipVaries && !netVaries && !genVaries) continue;

      for (var j = 0; j < group.length; j++) {
        var item = group[j];
        var chips = [];

        if (ipVaries) {
          var codes = ipCodes(item);
          // Only when we know. One exit reads as a country; several read as a
          // list, because "IP: Нидерланды, Франция" is still information.
          if (codes.length) {
            chips.push({
              kind: 'ip',
              label: 'IP: ' + codes.map(nameOf).join(', ')
            });
          }
        }

        if (netVaries) {
          var ops = operatorNames(item);
          if (ops.length === 1) chips.push({ kind: 'net', label: ops[0] });
          else if (ops.length > 1) chips.push({ kind: 'net', label: netsWord(ops.length) });
        }

        if (genVaries) {
          var gen = topGeneration(item);
          if (gen) chips.push({ kind: 'gen', label: gen });
        }

        if (chips.length) out[String(item.package_id || '')] = chips;
      }
    }

    return out;
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
    distinguishers: distinguishers,
    CACHE_URL: CACHE_URL,
    LIVE_URL: LIVE_URL,
    LIVE_TIMEOUT_MS: LIVE_TIMEOUT_MS,
    CACHE_TIMEOUT_MS: CACHE_TIMEOUT_MS,
    LIVE_ATTEMPTS: LIVE_ATTEMPTS,
    SCHEMA_VERSION: SCHEMA_VERSION,
    RACE_DEADLINE_MS: RACE_DEADLINE_MS,
    STALE_MAX_HOURS: STALE_MAX_HOURS,
  };
})();
