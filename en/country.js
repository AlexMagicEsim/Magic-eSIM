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

  // A long block shows its first plans and folds the rest behind one button,
  // so 39 offers read as three short lists, not a wall. Cheapest first, as before.
  var FOLD = 6;

  function fold(block, grid, list) {
    var sec = $(block);
    var old = sec.querySelector('.plan-more');
    if (old) old.remove();
    var cards = grid.children;
    for (var i = 0; i < cards.length; i += 1) cards[i].hidden = i >= FOLD;
    if (list.length <= FOLD) return;
    var more = document.createElement('button');
    more.type = 'button';
    more.className = 'btn btn-ghost plan-more';
    more.setAttribute('aria-controls', grid.id);
    more.setAttribute('aria-expanded', 'false');
    var label = function (open) { more.textContent = open ? 'Show fewer plans' : 'Show all ' + list.length + ' plans'; };
    label(false);
    more.addEventListener('click', function () {
      var open = more.getAttribute('aria-expanded') !== 'true';
      for (var j = 0; j < cards.length; j += 1) cards[j].hidden = !open && j >= FOLD;
      more.setAttribute('aria-expanded', String(open));
      label(open);
      // Opening: move focus to the first plan that just appeared.
      if (open && cards[FOLD]) { var b = cards[FOLD].querySelector('button, input'); if (b) b.focus(); }
    });
    grid.parentNode.insertBefore(more, grid.nextSibling);
  }

  function fill(block, gridId, countId, list, open, kind) {
    var grid = $(gridId);
    grid.textContent = '';
    // Look-alikes are told apart within ONE block, never across blocks: a local
    // plan and a regional one are not alternatives to each other.
    var distinct = PLANS.distinguishers(list);
    list.forEach(function (p) {
      grid.appendChild(PLANS.card(p, { focus: iso, onOpen: open, kind: kind, chips: distinct[String(p.package_id || '')] }));
    });
    $(countId).textContent = list.length ? String(list.length) : '';
    $(block).hidden = !list.length;
    fold(block, grid, list);
    // The jump link to this block, with the same count.
    var jump = document.querySelector('.cp-jump a[href="#' + block + '"]');
    if (jump) {
      jump.hidden = !list.length;
      var n = jump.querySelector('.n');
      if (n) n.textContent = list.length ? String(list.length) : '';
    }
  }

  function boot() {
    // The checkout window (en/checkout.js): plan → server quote → review, and
    // a payment step that says it is not available yet.
    var open = window.MagicEnCheckout.bind(document, { I18N: I18N, PLANS: PLANS });
    // A per-day term picked on the card is handed to the checkout the way a
    // visitor would set it: its own duration list gets the value and a change
    // event. en/checkout.js is untouched and runs its usual change handler.
    var openPlan = function (p, days) {
      open(p, iso);
      var sel = $('coDays');
      if (days && sel && !$('coTermPick').hidden) {
        var has = Array.prototype.some.call(sel.options, function (o) { return o.value === String(days); });
        if (has && sel.value !== String(days)) {
          sel.value = String(days);
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    };

    var skeleton = function (on) { var k = $('skeleton'); if (k) k.hidden = !on; };
    var jumps = function (on) { var j = document.querySelector('.cp-jump'); if (j) j.hidden = !on; };

    var failed = function () {
      skeleton(false);
      jumps(false);
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
      skeleton(true);
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
      skeleton(false);
      fill('localBlock', 'localGrid', 'localCount', blocks.local, openPlan, 'local');
      fill('regionalBlock', 'regionalGrid', 'regionalCount', blocks.regional, openPlan, 'regional');
      fill('dailyBlock', 'dailyGrid', 'dailyCount', blocks.daily, openPlan, 'daily');

      // The catalogue answered and none of it covers this country: say so,
      // rather than leave a page of empty headings.
      if (!blocks.daily.length && !blocks.local.length && !blocks.regional.length) {
        $('status').textContent = I18N.t('site.noPlans');
        $('status').hidden = false;
        if ($('emptyLink')) $('emptyLink').hidden = false;
        return undefined;
      }
      $('status').textContent = '';
      $('status').hidden = true;
      $('currencyNote').hidden = false;
      jumps(true);
      return undefined;
    };

    // «Try again» hides itself while the catalogue loads, so focus falls to
    // <body>. When the answer is in, put it where the visitor acts next: on
    // «Try again» if it failed again, else on the first block of plans, else
    // on the status line. Never moves focus the visitor has already placed.
    var refocus = function () {
      var a = document.activeElement;
      if (a && a !== document.body) return;
      var target = !$('retry').hidden ? $('retry') : null;
      if (!target) {
        ['localBlock', 'regionalBlock', 'dailyBlock'].some(function (id) {
          if ($(id).hidden) return false;
          target = $(id).querySelector('h2');
          return !!target;
        });
      }
      if (!target && !$('status').hidden) target = $('status');
      if (!target) return;
      if (target.tagName !== 'BUTTON' && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus();
    };

    $('retry').addEventListener('click', function () {
      $('retry').disabled = true;
      load().then(refocus);
    });
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
