/* =====================================================================
 * /en/ — the international storefront's behaviour.
 * ---------------------------------------------------------------------
 * WHAT THIS PAGE IS ALLOWED TO DO: read the catalogue, render it in English,
 * and walk a visitor to the payment step.
 *
 * WHAT IT MUST NEVER DO, and the reason each is structural rather than
 * remembered:
 *
 *   * It never POSTs anything. There is no call to /api/v1/public/retail-orders
 *     in this file, so no order can be created and therefore nothing can reach
 *     Platega, the fulfilment hook or a provider. A test asserts the absence.
 *   * It never invents a price. The catalogue holds exactly one real price per
 *     plan and it is denominated in roubles; no international price exists yet.
 *     So the rouble figure is shown, labelled as roubles, and the page says
 *     international pricing is being finalised. Converting it at some rate
 *     would be inventing the number the whole pricing lane is supposed to
 *     produce later.
 *   * It never redirects. The language switch is an ordinary link the visitor
 *     clicks, so there is no automatic hop to get into a loop with.
 * ================================================================== */
(function () {
  'use strict';

  var I18N = window.MagicSiteI18n.createI18n('en');
  var NAMES = window.MagicCountryNamesEn;
  // `MagicDailyPlan`, not `MagicDailyCopy` — the file is named daily-plan-copy.js
  // and the global is not. The first version of this line read the wrong name,
  // node's `require()` returned the module anyway so the unit smoke passed, and
  // only a real browser showed the page rendering nothing.
  var DAILY = window.MagicDailyPlan;
  // A missing dependency must degrade, not blank the page: every helper below
  // asks this first, so a script that failed to load costs a line of detail
  // rather than the whole catalogue.
  var hasDaily = !!(DAILY && typeof DAILY.isDaily === 'function');

  var $ = function (id) { return document.getElementById(id); };
  var packages = [];
  var chosen = null;

  I18N.apply(document);

  /* ------------------------------------------------------------------ *
   * Rendering helpers. All of them build text, never markup: every value
   * that reaches the DOM goes through textContent, so a package name from a
   * provider feed cannot become an element.
   * ------------------------------------------------------------------ */

  function priceText(p) {
    var n = Number(p && (p.price != null ? p.price : p.retail_price_rub));
    if (!isFinite(n) || n <= 0) return '';
    // Grouped the English way on an English page: 1,150 ₽. The currency stays
    // the rouble sign because the currency IS the rouble.
    return n.toLocaleString('en-US') + ' ₽';
  }

  function dataText(p) {
    if (hasDaily && DAILY.isDaily(p)) {
      var l = DAILY.lines(p, 'en');
      return (l && l[0] && l[0].text) || '';
    }
    var gb = Number(p.data_gb);
    if (!isFinite(gb) || gb <= 0) return '';
    // The shared formatter, not a local ' GB': it already renders 0.49 as
    // «500 MB», and a second idiom here is a second answer to the same question.
    return hasDaily ? DAILY.formatAllowance(gb, 'en') : gb + ' GB';
  }

  function plural(n) {
    return hasDaily ? DAILY.pluralDays(n, 'en') : (Number(n) === 1 ? 'day' : 'days');
  }

  function termText(p) {
    if (hasDaily && DAILY.isDaily(p)) {
      var days = DAILY.terms(p);
      return days.length ? days[0] + ' ' + plural(days[0]) : '';
    }
    var d = Number(p.validity_days);
    return isFinite(d) && d > 0 ? d + ' ' + plural(d) : '';
  }

  function coverageText(p) {
    var codes = Array.isArray(p.coverage_country_codes) && p.coverage_country_codes.length
      ? p.coverage_country_codes
      : (p.country_code ? [p.country_code] : []);
    if (!codes.length) return '';
    if (codes.length === 1) return NAMES.of(codes[0]);
    var rest = codes.length - 1;
    // `pluralCountries` already exists and already speaks English; inventing
    // «+ N more» here would be a second idiom for the same fact.
    var word = hasDaily ? DAILY.pluralCountries(rest, 'en') : (rest === 1 ? 'country' : 'countries');
    return NAMES.of(codes[0]) + ' + ' + rest + ' ' + word;
  }

  /* ------------------------------------------------------------------ *
   * Destination search
   * ------------------------------------------------------------------ */

  /**
   * A destination is a COUNTRY, and the catalogue does not only hold countries.
   *
   * 29 of its 225 `country_code` values are regional pseudo-codes — `EU-33`,
   * `SGMYVNTHID-5`, `JPKR-2` — and `NAMES.of()` returns the code itself when it
   * has no name for it, so without this filter the English search offered
   * «EU-33» as a place to travel to. The Russian landing has filtered on the
   * same shape since it was written (index.html, `/^[A-Z]{2}$/`); this is that
   * rule, not a new one.
   */
  var ISO2 = /^[A-Z]{2}$/;

  function destinations() {
    var seen = {};
    var out = [];
    for (var i = 0; i < packages.length; i += 1) {
      var c = String(packages[i].country_code || '').toUpperCase();
      if (!ISO2.test(c) || Object.prototype.hasOwnProperty.call(seen, c)) continue;
      seen[c] = true;
      out.push({ code: c, name: NAMES.of(c) });
    }
    out.sort(function (a, b) { return a.name.localeCompare(b.name, 'en'); });
    return out;
  }

  function renderResults(query) {
    var box = $('results');
    box.textContent = '';
    var q = String(query || '').trim().toLowerCase();
    if (q.length < 1) { box.hidden = true; return; }

    // Substring, not prefix: «korea» must find «South Korea» and «emirates»
    // «United Arab Emirates». Prefix-only silently returned nothing for both.
    // Prefix matches still sort first, so typing «it» still leads with Italy.
    var hits = destinations().filter(function (d) {
      return d.name.toLowerCase().indexOf(q) !== -1 || d.code.toLowerCase() === q;
    }).sort(function (a, b) {
      var ap = a.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      var bp = b.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      return ap !== bp ? ap - bp : a.name.localeCompare(b.name, 'en');
    }).slice(0, 20);

    if (!hits.length) { box.hidden = true; return; }
    hits.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'res';
      b.textContent = d.name;
      b.addEventListener('click', function () { showCountry(d.code, d.name); });
      box.appendChild(b);
    });
    box.hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * Plans for one destination
   * ------------------------------------------------------------------ */

  function showCountry(code, name) {
    $('results').hidden = true;
    $('q').value = name;

    var list = packages.filter(function (p) {
      return String(p.country_code || '').toUpperCase() === code;
    }).sort(function (a, b) { return Number(a.price || 0) - Number(b.price || 0); });

    $('tariffsTitle').textContent = I18N.t('site.plansFor') + ' ' + name;
    var grid = $('tariffGrid');
    grid.textContent = '';

    if (!list.length) {
      var empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent = I18N.t('site.noPlans');
      grid.appendChild(empty);
      $('tariffs').hidden = false;
      return;
    }

    list.forEach(function (p) {
      var card = document.createElement('div');
      card.className = 'card';

      var h = document.createElement('h3');
      h.textContent = dataText(p) || I18N.t('checkout.plan');
      card.appendChild(h);

      var meta = document.createElement('div');
      meta.className = 'meta';
      [coverageText(p), termText(p)].filter(Boolean).forEach(function (txt) {
        var s = document.createElement('span');
        s.textContent = txt;
        meta.appendChild(s);
      });
      card.appendChild(meta);

      var pr = document.createElement('div');
      pr.className = 'price';
      pr.textContent = priceText(p);
      card.appendChild(pr);

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.textContent = I18N.t('site.choose');
      btn.addEventListener('click', function () { openCheckout(p, name); });
      card.appendChild(btn);

      grid.appendChild(card);
    });

    $('tariffs').hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * Checkout — up to, and stopping at, the payment step
   * ------------------------------------------------------------------ */

  function openCheckout(p, countryName) {
    chosen = p;
    $('coPlan').textContent = dataText(p) || I18N.t('checkout.plan');
    $('coCoverage').textContent = countryName || coverageText(p);
    $('coData').textContent = dataText(p);
    $('coTerm').textContent = termText(p);
    $('coTotal').textContent = priceText(p);
    $('coErr').hidden = true;
    $('coUnavail').hidden = true;
    $('coPay').disabled = false;
    $('coPay').textContent = I18N.t('checkout.continue');
    // A previous attempt's address must not follow the visitor onto a different
    // plan: reopening the checkout is a fresh decision.
    $('coEmail').value = '';
    $('checkout').hidden = false;
  }

  function closeCheckout() {
    $('checkout').hidden = true;
    chosen = null;
  }

  /**
   * The payment step.
   *
   * The email is validated FIRST, so the visitor gets the ordinary experience of
   * a form that checks its input rather than a dead end that ignores it — and
   * then the step says, in as many words, that nothing was charged and no order
   * was created. Which is true: this function makes no network call at all.
   *
   * There is no consent checkbox here, deliberately: consent is collected where
   * an order is created, and this page creates none.
   */
  function attemptPay() {
    var email = String($('coEmail').value || '').trim();
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
    if (!ok) {
      $('coErr').textContent = I18N.t('pay.emailInvalid');
      $('coErr').hidden = false;
      return;
    }
    $('coErr').hidden = true;
    $('coUnavail').hidden = false;
    $('coPay').disabled = true;
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function boot() {
    $('q').addEventListener('input', function (e) { renderResults(e.target.value); });
    $('coClose').addEventListener('click', closeCheckout);
    $('coPay').addEventListener('click', attemptPay);
    $('checkout').addEventListener('click', function (e) {
      if (e.target === $('checkout')) closeCheckout();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('checkout').hidden) closeCheckout();
    });

    // AN EMPTY RESULT IS A FAILURE, not an empty shop. `MagicCatalog.load()`
    // RESOLVES even when both the live API and the static cache are
    // unreachable — that resilience is deliberate and is what keeps the Russian
    // landing standing — so a page that only handled the rejection showed
    // «Loading…», then nothing, and looked like a country with no plans. The
    // browser test caught it; the first version of this function had the bug.
    var failed = function () {
      $('status').textContent = I18N.t('site.loadFailed');
      $('status').hidden = false;
    };

    window.MagicCatalog.load().then(function (res) {
      var list = (res && res.packages) || [];
      if (!list.length) return failed();
      packages = list;
      $('status').textContent = '';
      $('status').hidden = true;
      return undefined;
    }, failed);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
