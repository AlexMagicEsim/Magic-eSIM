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
 *   * Write anything. No POST, no quote, no order: the plan window shows a
 *     plan and says it cannot be bought yet. A test asserts the absence.
 *   * Show roubles or convert. When the GLOBAL lane answers nothing usable
 *     (switched off, busy, down, wrong shape) the page says prices are
 *     unavailable. It never falls back to the Russian rouble snapshot.
 *   * Decide a block from a package NAME. Which block a plan sits in is
 *     decided by its coverage codes alone (en/plans.js classify).
 * ================================================================== */
(function () {
  'use strict';

  if (!window.MagicSiteI18n || !window.MagicCountryNamesEn || !window.MagicGlobalCatalog
    || !window.MagicEnPlans) return;

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
    list.forEach(function (p) {
      grid.appendChild(PLANS.card(p, { focus: iso, onOpen: open }));
    });
    $(countId).textContent = list.length ? String(list.length) : '';
    $(block).hidden = !list.length;
  }

  function boot() {
    var open = PLANS.bindPreview(document);
    var openPlan = function (p) { open(p, iso); };

    var failed = function () {
      ['dailyBlock', 'localBlock', 'regionalBlock'].forEach(function (id) { $(id).hidden = true; });
      $('status').textContent = I18N.t('site.pricesUnavailable');
      $('status').hidden = false;
    };

    window.MagicGlobalCatalog.load().then(function (res) {
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
    }, failed);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
