/* =====================================================================
 * /en/esim/<slug>/ — one English country page's behaviour.
 * ---------------------------------------------------------------------
 * The page itself is static and carries NO price: seo/build-en-pages.mjs
 * writes the country's name, its ISO code (`<body data-iso>`) and empty
 * blocks. The plans arrive here, in the browser, from the GLOBAL catalogue —
 * one GET of `?market=global` through assets/global-catalog.js, in US
 * dollars. So no English page can ever carry a stale price, and the country
 * pages and the catalogue cannot drift: there is only one catalogue.
 *
 * WHAT THIS PAGE MUST NEVER DO:
 *
 *   * Write anything itself. Its one request is the catalogue GET. The only
 *     write on these pages is the price quote, and it lives in en/checkout.js,
 *     behind a button. No order, no payment, no eSIM: a test asserts it.
 *   * Show roubles or convert. When the GLOBAL lane answers nothing usable
 *     (switched off, busy, down, wrong shape) the page says prices are
 *     unavailable. It never falls back to the Russian rouble snapshot.
 *   * Decide a block from a package NAME. Which block a plan sits in is
 *     decided by its coverage codes alone (en/plans.js classify).
 * ================================================================== */
(function () {
  'use strict';

  // A script that failed to load must not leave «Loading plans…» on screen for
  // ever. Plain English here: the dictionary may be the script that is missing.
  if (!window.MagicSiteI18n || !window.MagicCountryNamesEn || !window.MagicGlobalCatalog
    || !window.MagicEnPlans || !window.MagicEnCheckout) {
    var st0 = document.getElementById('status');
    if (st0) {
      st0.textContent = 'Prices are temporarily unavailable. Please reload the page — nothing can be ordered here yet.';
      st0.hidden = false;
    }
    return;
  }

  var I18N = window.MagicSiteI18n.createI18n('en');
  var PLANS = window.MagicEnPlans.create({
    I18N: I18N,
    NAMES: window.MagicCountryNamesEn,
    DAILY: window.MagicDailyPlan,
  });
  var $ = function (id) { return document.getElementById(id); };

  I18N.apply(document);

  var iso = String(document.body.getAttribute('data-iso') || '').toUpperCase();
  if (!PLANS.ISO2.test(iso)) return;

  function fill(block, gridId, countId, list, open) {
    var grid = $(gridId);
    grid.textContent = '';
    // Look-alikes are told apart within ONE block, never across blocks: a local
    // plan and a regional one are not alternatives to each other.
    var distinct = PLANS.distinguishers(list);
    list.forEach(function (p) {
      grid.appendChild(PLANS.card(p, { focus: iso, onOpen: open, chips: distinct[String(p.package_id || '')] }));
    });
    $(countId).textContent = list.length ? String(list.length) : '';
    $(block).hidden = !list.length;
  }

  function boot() {
    // The checkout window (en/checkout.js): plan → server quote → review, and
    // a payment step that says it is not available yet.
    var open = window.MagicEnCheckout.bind(document, { I18N: I18N, PLANS: PLANS });
    var openPlan = function (p) { open(p, iso); };

    var failed = function () {
      ['dailyBlock', 'localBlock', 'regionalBlock'].forEach(function (id) { $(id).hidden = true; });
      $('status').textContent = I18N.t('site.pricesUnavailable');
      $('status').hidden = false;
      // A visitor may ask again — never the page on its own: every load is a
      // 1.5 MB read counted against the 20/min/IP budget.
      $('retry').hidden = false;
      $('retry').disabled = false;
    };

    var load = function () {
      $('retry').hidden = true;
      $('status').textContent = I18N.t('site.loading');
      $('status').hidden = false;
      return window.MagicGlobalCatalog.load().then(render, failed);
    };

    var render = function (res) {
      try { return draw(res); } catch (e) { return failed(); }
    };

    var draw = function (res) {
      var list = (res && res.ok && res.packages) || [];
      if (!list.length) return failed();

      var blocks = PLANS.classify(list, iso);
      fill('dailyBlock', 'dailyGrid', 'dailyCount', blocks.daily, openPlan);
      fill('localBlock', 'localGrid', 'localCount', blocks.local, openPlan);
      fill('regionalBlock', 'regionalGrid', 'regionalCount', blocks.regional, openPlan);

      // The catalogue answered and none of it covers this country: say so,
      // rather than leave a page of empty headings.
      if (!blocks.daily.length && !blocks.local.length && !blocks.regional.length) {
        $('status').textContent = I18N.t('site.noPlans');
        $('status').hidden = false;
        return undefined;
      }
      $('status').textContent = '';
      $('status').hidden = true;
      $('currencyNote').hidden = false;
      return undefined;
    };

    $('retry').addEventListener('click', function () {
      $('retry').disabled = true;
      load();
    });
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
