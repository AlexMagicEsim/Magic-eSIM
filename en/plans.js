/* =====================================================================
 * /en/ — what every English page knows about a plan.
 * ---------------------------------------------------------------------
 * One module for every English country page (/en/esim/<slug>/), so no two
 * pages can disagree about what a plan costs, how it is labelled, or which
 * block a country shows it in. Pure functions plus two DOM builders; it is
 * also require()-able, so the unit tests run the same code the browser does.
 *
 * It renders, it never fetches: the data is the GLOBAL catalogue
 * (assets/global-catalog.js, US dollars) handed in by the page. Nothing here
 * touches the network, and nothing here can create an order.
 *
 * Every value that reaches the DOM goes through textContent — a provider's
 * package name cannot become markup.
 *
 * Exposes window.MagicEnPlans.create({ I18N, NAMES, DAILY }).
 * ================================================================== */
(function (root) {
  'use strict';

  /** ISO-2 shape: a destination is a country, not a regional pseudo-code. */
  var ISO2 = /^[A-Z]{2}$/;

  /* The countries no storefront sells — the Russian landing's own rule
   * (index.html, country-tariffs.js RESTRICTED_COUNTRY_CODES), not a new one. */
  var RESTRICTED = ['RU', 'UA', 'BY'];

  function create(deps) {
    var I18N = deps.I18N;
    var NAMES = deps.NAMES;
    var DAILY = deps.DAILY;
    var hasDaily = !!(DAILY && typeof DAILY.isDaily === 'function');

    /**
     * What this plan actually costs, and what term that buys.
     *
     * A DAILY plan's `price` IS A PER-DAY RATE AND ONE DAY IS NOT SOLD. The
     * first version of the English page priced every card from `p.price`,
     * which on 1293 of the catalogue's 1324 daily packages is a figure no
     * customer can pay; because the list sorts ascending, those understated
     * rows led every country. That is the §21 bait-price class.
     *
     * So the rules are the Russian storefront's (`assets/country-tariffs.js`
     * dailyTermsHtml):
     *
     *   PER_DAY     the ladder in `term_prices` is the only truth. No ladder
     *               means nothing is purchasable — the card says so.
     *   FIXED_TERM  no ladder by design: one term, one stored price.
     *   otherwise   the volume plan's own price.
     *
     * Moved here unchanged from en/app.js, so every English page prices a plan
     * with ONE copy of the rule.
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
      return priced ? money(priced.amount) : '';
    }

    function dataText(p) {
      if (hasDaily && DAILY.isDaily(p)) {
        var l = DAILY.lines(p, 'en');
        return (l && l[0] && l[0].text) || '';
      }
      var gb = Number(p.data_gb);
      if (!isFinite(gb) || gb <= 0) return '';
      return hasDaily ? DAILY.formatAllowance(gb, 'en') : gb + ' GB';
    }

    function plural(n) {
      return hasDaily ? DAILY.pluralDays(n, 'en') : (Number(n) === 1 ? 'day' : 'days');
    }

    /** The term the PRICED offer buys — from the same decision as the price. */
    function termText(p) {
      var priced = priceOf(p);
      if (!priced || !priced.days) return '';
      return priced.days + ' ' + plural(priced.days);
    }

    /**
     * Which countries a plan covers, exactly as the card prints them — the
     * Russian country page's own reading (country-tariffs.js
     * packageCoverageCodes): the coverage list, plus an ISO-2 country_code,
     * plus ISO-2 tokens of `region`; never RU/UA/BY.
     */
    function coverageCodes(p) {
      var out = [];
      var add = function (c) {
        var code = String(c || '').trim().toUpperCase();
        if (ISO2.test(code) && out.indexOf(code) === -1 && RESTRICTED.indexOf(code) === -1) out.push(code);
      };
      (Array.isArray(p && p.coverage_country_codes) ? p.coverage_country_codes : []).forEach(add);
      add(p && p.country_code);
      String((p && p.region) || '').toUpperCase().split(/[\s,;/|+]+/).forEach(add);
      return out;
    }

    function isRestricted(p) {
      if (!p) return false;
      if (RESTRICTED.indexOf(String(p.country_code || '').toUpperCase()) !== -1) return true;
      var name = String(p.name || '').toLowerCase();
      return name.indexOf('russia') !== -1 || name.indexOf('ukraine') !== -1 || name.indexOf('belarus') !== -1;
    }

    /* Worldwide packages are left off country pages, as on the Russian ones
     * (country-tariffs.js isPublicGlobalPackage): «Global (120+ areas)» is not
     * a plan FOR Thailand, and listing it on 190 pages is noise. */
    function isWorldwide(p) {
      var name = String((p && p.name) || '').toLowerCase();
      return String((p && p.country_code) || '').toUpperCase().indexOf('GL-') === 0 || name.indexOf('global') !== -1;
    }

    /**
     * The three blocks of a country page, decided by COVERAGE CODES only.
     *
     * CLAUDE.md: «Only for country X» is decided by coverage codes — what the
     * card prints — never by a name. «Japan Unlimited N Days» covers ["JP"]
     * and is a Japanese plan whatever its name says.
     *
     *   daily     every daily plan that covers the country (local or not):
     *             it answers a different question and is never ranked against
     *             a volume.
     *   local     a volume plan whose coverage is exactly this country.
     *   regional  a volume plan covering this country AND others.
     */
    function classify(list, iso) {
      var code = String(iso || '').toUpperCase();
      var out = { daily: [], local: [], regional: [] };
      (Array.isArray(list) ? list : []).forEach(function (p) {
        if (!p || isRestricted(p) || isWorldwide(p)) return;
        var codes = coverageCodes(p);
        if (codes.indexOf(code) === -1) return;
        if (hasDaily && DAILY.isDaily(p)) out.daily.push(p);
        else if (codes.length === 1) out.local.push(p);
        else out.regional.push(p);
      });
      out.daily = sortByPrice(out.daily);
      out.local = sortByPrice(out.local);
      out.regional = sortByPrice(out.regional);
      return out;
    }

    /** Cheapest PURCHASABLE first; plans with no payable price last. */
    function sortByPrice(list) {
      return list.slice().sort(function (a, b) {
        var pa = priceOf(a); var pb = priceOf(b);
        if (!pa && !pb) return 0;
        if (!pa) return 1;
        if (!pb) return -1;
        return pa.amount - pb.amount;
      });
    }

    /**
     * Coverage, in English. On a country page a regional plan reads «173
     * countries, incl. French Polynesia» — leading with the package's first
     * code («Albania + 172») would name the wrong place.
     */
    function coverageText(p, focusIso) {
      var codes = coverageCodes(p);
      if (!codes.length) return '';
      if (codes.length === 1) return NAMES.of(codes[0]);
      var focus = String(focusIso || '').toUpperCase();
      if (focus && codes.indexOf(focus) !== -1) {
        var all = hasDaily ? DAILY.pluralCountries(codes.length, 'en') : 'countries';
        return codes.length + ' ' + all + ', incl. ' + NAMES.of(focus);
      }
      var rest = codes.length - 1;
      var word = hasDaily ? DAILY.pluralCountries(rest, 'en') : (rest === 1 ? 'country' : 'countries');
      return NAMES.of(codes[0]) + ' + ' + rest + ' ' + word;
    }

    /** One plan card. `onOpen(p)` opens the preview window. */
    function card(p, opts) {
      var o = opts || {};
      var priced = priceOf(p);
      var el = document.createElement('div');
      el.className = 'card';

      var h = document.createElement('h3');
      h.textContent = dataText(p) || I18N.t('checkout.plan');
      el.appendChild(h);

      var meta = document.createElement('div');
      meta.className = 'meta';
      [coverageText(p, o.focus), termText(p)].filter(Boolean).forEach(function (txt) {
        var s = document.createElement('span');
        s.textContent = txt;
        meta.appendChild(s);
      });
      el.appendChild(meta);

      var pr = document.createElement('div');
      pr.className = 'price';
      pr.textContent = priceText(p);
      el.appendChild(pr);

      if (priced) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.textContent = I18N.t('site.choose');
        btn.addEventListener('click', function () { if (o.onOpen) o.onOpen(p); });
        el.appendChild(btn);
      } else {
        var off = document.createElement('span');
        off.className = 'note';
        off.textContent = I18N.t('site.unavailable');
        el.appendChild(off);
      }
      return el;
    }

    /**
     * The plan window: a preview that shows the plan, says it cannot be bought
     * yet, and asks for nothing. Bound once per page.
     */
    function bindPreview(doc) {
      var $ = function (id) { return doc.getElementById(id); };
      var box = $('checkout');
      if (!box) return function () {};
      var close = function () { box.hidden = true; };
      $('coClose').addEventListener('click', close);
      box.addEventListener('click', function (e) { if (e.target === box) close(); });
      doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(); });
      return function open(p, focusIso) {
        $('coPlan').textContent = dataText(p) || I18N.t('checkout.plan');
        $('coCoverage').textContent = coverageText(p, focusIso);
        $('coData').textContent = dataText(p);
        $('coTerm').textContent = termText(p);
        $('coTotal').textContent = priceText(p);
        box.hidden = false;
      };
    }

    return {
      ISO2: ISO2, priceOf: priceOf, money: money, priceText: priceText, dataText: dataText, termText: termText,
      coverageCodes: coverageCodes, coverageText: coverageText, isRestricted: isRestricted, isWorldwide: isWorldwide,
      classify: classify, sortByPrice: sortByPrice, card: card, bindPreview: bindPreview,
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MagicEnPlans = api;
})(typeof window !== 'undefined' ? window : globalThis);
