/* =====================================================================
 * /en/ — the international (GLOBAL) storefront's behaviour.
 * ---------------------------------------------------------------------
 * WHAT THIS PAGE IS ALLOWED TO DO: read the GLOBAL catalogue (US dollars,
 * through assets/global-catalog.js), render it in English, and show a plan's
 * details. It sells nothing yet: the page says so before any price or button,
 * and the plan window repeats it and asks for nothing.
 *
 * WHAT IT MUST NEVER DO, and the reason each is structural rather than
 * remembered:
 *
 *   * It never touches the network itself. The only read is
 *     MagicGlobalCatalog.load() — one GET of `?market=global` — and there is no
 *     POST, no quote and no order anywhere on this page, so nothing can reach a
 *     payment provider, fulfilment or a supplier. A test asserts the absence.
 *   * It never shows roubles and never converts. Prices are the GLOBAL lane's
 *     own USD figures. When that lane answers nothing usable (switched off,
 *     busy, down), the page says prices are unavailable — it does NOT fall back
 *     to the Russian rouble snapshot, which is what /en/ used to show.
 *   * It never invents a price, and «the price» is not one field. A
 *     FIXED_VOLUME plan carries its whole price in `price`; a PER_DAY plan's
 *     `price` is a per-day RATE and one day is not sold, so the payable figures
 *     live in the `term_prices` ladder; a FIXED_TERM daily has no ladder and
 *     `price` is again the whole price. `priceOf` reads each shape on its own
 *     terms and returns null when none yields something purchasable — the card
 *     then says the plan is unavailable rather than quoting a number nobody can
 *     pay (1293 of 1324 daily packages once advertised an unpayable figure).
 *   * It never redirects. The language switch is an ordinary link the visitor
 *     clicks, so there is no automatic hop to get into a loop with.
 * ================================================================== */
(function () {
  'use strict';

  // Guarded like DAILY below. Either script failing to load used to throw before
  // `boot()` bound a single handler, leaving a search box that silently did
  // nothing on a page that otherwise rendered fine.
  if (!window.MagicSiteI18n || !window.MagicCountryNamesEn || !window.MagicGlobalCatalog) return;

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

  /**
   * What this plan actually costs, and what term that buys.
   *
   * A DAILY plan's `price` IS A PER-DAY RATE AND ONE DAY IS NOT SOLD. The first
   * version of this file priced every card from `p.price`, which on 1293 of the
   * catalogue's 1324 daily packages is a figure no customer can pay: Oman's
   * cheapest card advertised 200 ₽ where the shortest purchasable term is 600 ₽,
   * and because the list sorts ascending those understated rows led every
   * country. That is the §21 bait-price class this project has already paid for
   * once, and `CLAUDE.md` says it in as many words — «for a PER_DAY plan that is
   * a per-day RATE and one day is not sold».
   *
   * So the rules are the Russian storefront's, not new ones
   * (`assets/country-tariffs.js` dailyTermsHtml):
   *
   *   PER_DAY     the ladder in `term_prices` is the only truth. No ladder
   *               means nothing is purchasable — the card says so rather than
   *               inventing a number, exactly as the Russian card does.
   *   FIXED_TERM  no ladder by design: one term, one stored price.
   *   otherwise   the volume plan's own price.
   */
  function priceOf(p) {
    var terms = Array.isArray(p && p.term_prices) ? p.term_prices : [];

    if (hasDaily && DAILY.isDaily(p)) {
      if (terms.length) {
        var best = null;
        for (var i = 0; i < terms.length; i += 1) {
          var price = Number(terms[i] && terms[i].price);
          var days = Number(terms[i] && terms[i].days);
          if (!isFinite(price) || price <= 0 || !isFinite(days) || days <= 0) continue;
          if (!best || price < best.price) best = { price: price, days: days };
        }
        return best ? { amount: best.price, days: best.days } : null;
      }
      // MobiMatter's fixed-term daily: the ladder is absent because there is
      // nothing to choose, and `price` is the whole price.
      if (String(p.daily_term_mode || '') === 'FIXED_TERM'
        && Number(p.validity_days) > 0 && Number(p.price) > 0) {
        return { amount: Number(p.price), days: Number(p.validity_days) };
      }

      return null;
    }

    var n = Number(p && p.price);
    if (!isFinite(n) || n <= 0) return null;

    return { amount: n, days: Number(p.validity_days) || null };
  }

  // US dollars, always two decimals: the GLOBAL lane prices to the cent and
  // ends on .99, so «$9.99», never «$9.9» or «$10».
  var USD = (typeof Intl !== 'undefined' && Intl.NumberFormat)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  function money(amount) {
    return USD ? USD.format(amount) : '$' + Number(amount).toFixed(2);
  }

  function priceText(p) {
    var priced = priceOf(p);
    if (!priced) return '';
    return money(priced.amount);
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

  /**
   * The term the PRICED offer buys — taken from the same decision, never from a
   * second one.
   *
   * `DAILY.terms(p)` returns the ladder's day list and is EMPTY for all 31
   * FIXED_TERM daily plans, so reading it alone left «China Unlimited 3 Days»
   * showing a price and a blank validity with `validity_days: 3` sitting in the
   * row. Deriving the term from `priceOf` means the two lines on a card can
   * never describe different offers.
   */
  function termText(p) {
    var priced = priceOf(p);
    if (!priced || !priced.days) return '';

    return priced.days + ' ' + plural(priced.days);
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

  /*
   * The same countries the Russian landing refuses to sell, refused here.
   *
   * `index.html` filters RU/UA/BY by code AND by package name; `/en/` filtered
   * on ISO-2 shape alone, so the two storefronts disagreed about what is on
   * offer. Today the exposure is zero — no package carries those country codes
   * and none names them — but a policy enforced on one surface and not the
   * other is a policy that stops being enforced the day the catalogue moves.
   */
  var RESTRICTED = ['RU', 'UA', 'BY'];

  function isRestricted(p) {
    if (!p) return false;
    if (RESTRICTED.indexOf(String(p.country_code || '').toUpperCase()) !== -1) return true;
    var name = String(p.name || '').toLowerCase();

    return name.indexOf('russia') !== -1 || name.indexOf('ukraine') !== -1
      || name.indexOf('belarus') !== -1;
  }

  function destinations() {
    var seen = {};
    var out = [];
    for (var i = 0; i < packages.length; i += 1) {
      if (isRestricted(packages[i])) continue;
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
      return !isRestricted(p) && String(p.country_code || '').toUpperCase() === code;
    }).sort(function (a, b) {
      // Sorted on the PURCHASABLE price. Sorting on `p.price` put the per-day
      // rates at the top of every country, so the cheapest-looking rows were
      // exactly the ones whose advertised figure could not be paid.
      var pa = priceOf(a); var pb = priceOf(b);
      if (!pa && !pb) return 0;
      if (!pa) return 1;
      if (!pb) return -1;

      return pa.amount - pb.amount;
    });

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
      var priced = priceOf(p);
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

      if (priced) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.textContent = I18N.t('site.choose');
        btn.addEventListener('click', function () { openCheckout(p, name); });
        card.appendChild(btn);
      } else {
        // The Russian card renders «Временно недоступен» here for exactly this
        // state. A plan whose ladder is missing has no price anyone can pay, and
        // offering a button would send the visitor to a checkout with no number.
        var off = document.createElement('span');
        off.className = 'note';
        off.textContent = I18N.t('site.unavailable');
        card.appendChild(off);
      }

      grid.appendChild(card);
    });

    $('tariffs').hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * Plan details — a preview window. This page has no international checkout:
   * the window shows the plan, says it cannot be bought here yet, and asks for
   * nothing (no email, no button towards paying)
   * ------------------------------------------------------------------ */

  function openCheckout(p, countryName) {
    chosen = p;
    $('coPlan').textContent = dataText(p) || I18N.t('checkout.plan');
    $('coCoverage').textContent = countryName || coverageText(p);
    $('coData').textContent = dataText(p);
    $('coTerm').textContent = termText(p);
    $('coTotal').textContent = priceText(p);
    $('checkout').hidden = false;
  }

  function closeCheckout() {
    $('checkout').hidden = true;
    chosen = null;
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function boot() {
    $('q').addEventListener('input', function (e) { renderResults(e.target.value); });
    $('coClose').addEventListener('click', closeCheckout);
    $('checkout').addEventListener('click', function (e) {
      if (e.target === $('checkout')) closeCheckout();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('checkout').hidden) closeCheckout();
    });

    // NO PRICES IS SAID, not hidden. The GLOBAL lane can be switched off (503),
    // busy (429) or unreachable; in every case the page says prices are
    // unavailable and offers nothing — it never substitutes the Russian rouble
    // snapshot. An empty or malformed answer counts as unavailable too: an
    // empty list must not look like a destination with no plans.
    var failed = function () {
      $('status').textContent = I18N.t('site.pricesUnavailable');
      $('status').hidden = false;
    };

    window.MagicGlobalCatalog.load().then(function (res) {
      var list = (res && res.ok && res.packages) || [];
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
