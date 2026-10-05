/* =====================================================================
 * /en/ — what every English page knows about a plan.
 * ---------------------------------------------------------------------
 * One module for every English country page (/en/esim/<slug>/), so no two
 * pages can disagree about what a plan costs, how it is labelled, or which
 * block a country shows it in. Pure functions plus one DOM builder; it is
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

    /* ------------------------------------------------------------------
     * What tells two look-alike cards apart.
     *
     * Ported from the Russian storefront's MagicCatalog.distinguishers()
     * (assets/catalog-loader.js), which English pages may not load: it also
     * carries the rouble fallback. Same rule, English labels. Within ONE block,
     * cards that share coverage, allowance and term are siblings; for each
     * sibling group only the attributes that VARY are returned — the exit
     * country of the traffic (`ip_export`), the operators (`networks`) and the
     * best network generation (`network_technologies`). Nothing varies → no
     * chip. Unknown → no chip: silence beats a placeholder.
     * ---------------------------------------------------------------- */
    var GENERATIONS = ['5G', '4G', '3G', '2G'];
    // eSIM Access writes «UK»; the name map is keyed by ISO-3166 «GB».
    function iso(c) { var x = String(c || '').toUpperCase(); return x === 'UK' ? 'GB' : x; }
    function ipCodes(p) {
      return Array.isArray(p && p.ip_export) ? p.ip_export.filter(Boolean).map(iso).filter(function (c) { return ISO2.test(c); }) : [];
    }
    function operators(p) {
      var out = [];
      (Array.isArray(p && p.networks) ? p.networks : []).forEach(function (n) {
        var name = String((n && n.operator) || '').trim();
        if (name && out.indexOf(name) === -1) out.push(name);
      });
      return out;
    }
    function topGeneration(p) {
      var t = (Array.isArray(p && p.network_technologies) ? p.network_technologies : [])
        .map(function (x) { return String(x || '').toUpperCase(); });
      for (var i = 0; i < GENERATIONS.length; i += 1) if (t.indexOf(GENERATIONS[i]) !== -1) return GENERATIONS[i];
      return '';
    }
    function siblingKey(p) {
      var priced = priceOf(p);
      var allowance = hasDaily && DAILY.isDaily(p)
        ? 'P' + Number(p.daily_gb || 0)
        : (p.unlimited ? 'U' : 'D' + Number(p.data_gb));
      return [coverageCodes(p).slice().sort().join('+'), allowance, 'V' + (priced ? priced.days : '')].join('|');
    }

    /** package_id → [{kind:'ip'|'net'|'gen', label}] for one block's list. */
    function distinguishers(list) {
      var groups = {};
      (Array.isArray(list) ? list : []).forEach(function (p) {
        var k = siblingKey(p);
        (groups[k] = groups[k] || []).push(p);
      });
      var out = {};
      Object.keys(groups).forEach(function (k) {
        var g = groups[k];
        if (g.length < 2) return;
        var vary = function (fn) {
          var seen = {};
          g.forEach(function (p) { seen[fn(p)] = true; });
          return Object.keys(seen).length > 1;
        };
        var ipV = vary(function (p) { return ipCodes(p).join('+'); });
        var netV = vary(function (p) { return operators(p).slice().sort().join('|'); });
        var genV = vary(topGeneration);
        if (!ipV && !netV && !genV) return;
        g.forEach(function (p) {
          var chips = [];
          if (ipV && ipCodes(p).length) chips.push({ kind: 'ip', label: 'IP: ' + ipCodes(p).map(function (c) { return NAMES.of(c); }).join(', ') });
          if (netV) {
            var ops = operators(p);
            if (ops.length === 1) chips.push({ kind: 'net', label: ops[0] });
            else if (ops.length > 1) chips.push({ kind: 'net', label: ops.length + ' networks' });
          }
          if (genV && topGeneration(p)) chips.push({ kind: 'gen', label: topGeneration(p) });
          if (chips.length) out[String(p.package_id || '')] = chips;
        });
      });
      return out;
    }

    /**
     * The per-day ladder a visitor can pick from, cheapest term first — the
     * SAME rule as the checkout's own duration list (en/checkout.js
     * durations()): integer days > 0, price > 0, one entry per term. It only
     * DISPLAYS the catalogue's term prices; the price that counts is still the
     * server's quote. A test pins the two functions to the same answer.
     */
    function ladder(p) {
      if (String((p && p.daily_term_mode) || '') !== 'PER_DAY') return [];
      var terms = Array.isArray(p.term_prices) ? p.term_prices : [];
      var out = [];
      terms.forEach(function (t) {
        var d = Number(t && t.days); var price = Number(t && t.price);
        if (Number.isInteger(d) && d > 0 && isFinite(price) && price > 0
          && !out.some(function (x) { return x.days === d; })) out.push({ days: d, price: price });
      });
      return out.sort(function (a, b) { return a.days - b.days; });
    }

    /** «Also covers Albania, Andorra, Argentina + 166 more» — the other countries, by name. */
    function alsoCovers(p, focusIso, max) {
      var focus = String(focusIso || '').toUpperCase();
      var others = coverageCodes(p).filter(function (c) { return c !== focus; });
      if (!others.length) return '';
      var n = max || 3;
      var names = others.slice(0, n).map(function (c) { return NAMES.of(c); });
      var rest = others.length - names.length;
      return 'Also covers ' + names.join(', ') + (rest > 0 ? ' + ' + rest + ' more' : '');
    }

    function span(cls, text) {
      var s = document.createElement('span');
      if (cls) s.className = cls;
      if (text != null) s.textContent = text;
      return s;
    }

    /**
     * One plan card. `opts.kind` is the block it sits in (local | regional |
     * daily) and only chooses the label; `onOpen(p, days)` opens the checkout,
     * with the per-day term the visitor picked here (null otherwise); `chips`
     * tell it apart from a look-alike. Every price and coverage figure comes
     * from the functions above — the card only lays them out. It holds exactly
     * ONE button: the per-day terms are radio inputs.
     */
    function card(p, opts) {
      var o = opts || {};
      var kind = o.kind === 'regional' || o.kind === 'daily' ? o.kind : 'local';
      var priced = priceOf(p);
      var el = document.createElement('article');
      el.className = 'card plan plan-' + kind;

      var head = document.createElement('div');
      head.className = 'plan-head';
      var badgeText = kind === 'regional' ? 'Regional plan'
        : kind === 'daily' ? 'Daily plan'
          : (o.focus ? NAMES.of(String(o.focus).toUpperCase()) + ' only' : '');
      if (badgeText) head.appendChild(span('plan-badge', badgeText));
      var h = document.createElement('h3');
      h.className = 'plan-data';
      h.textContent = dataText(p) || I18N.t('checkout.plan');
      head.appendChild(h);
      el.appendChild(head);

      if (o.chips && o.chips.length) {
        var d = document.createElement('div');
        d.className = 'distinct';
        o.chips.forEach(function (c) { d.appendChild(span('chip chip-' + c.kind, c.label)); });
        el.appendChild(d);
      }

      var meta = document.createElement('div');
      meta.className = 'meta';
      // A daily plan also says what happens after the day's allowance, in the
      // shared daily copy's own vetted words («Then up to 512 Kbps» — a
      // published number, never the stronger claim that traffic keeps flowing),
      // and a reset only where the provider confirmed one. Two daily plans whose
      // only difference is that speed used to look identical.
      var extra = hasDaily && DAILY.isDaily(p)
        ? (DAILY.lines(p, 'en') || []).filter(function (l) { return l.kind === 'throttle' || l.kind === 'reset'; })
          .map(function (l) { return l.text; })
        : [];
      // A plan for this country alone says so in its badge; the line is for
      // everything else (regional, and daily plans that cross borders).
      var cov = kind === 'local' && coverageCodes(p).length === 1 ? '' : coverageText(p, o.focus);
      if (cov) meta.appendChild(span('m-cov', cov));
      var also = coverageCodes(p).length > 1 ? alsoCovers(p, o.focus, 3) : '';
      if (also) meta.appendChild(span('m-also', also));
      extra.forEach(function (txt) { meta.appendChild(span('m-extra', txt)); });
      el.appendChild(meta);

      // A per-day plan: the visitor picks the number of days right here.
      var steps = ladder(p);
      var chosen = priced ? { days: priced.days, price: priced.amount } : null;
      var foot = document.createElement('div');
      foot.className = 'plan-foot';
      var priceBox = document.createElement('div');
      priceBox.className = 'plan-price';
      var pr = span('price', priced ? money(priced.amount) : '');
      pr.setAttribute('aria-live', 'polite');
      var forTerm = span('price-for', '');
      var showTerm = function () {
        forTerm.textContent = chosen && chosen.days ? 'for ' + chosen.days + ' ' + plural(chosen.days) : '';
      };
      showTerm();
      priceBox.appendChild(pr);
      priceBox.appendChild(forTerm);

      if (priced && steps.length > 1) {
        var fs = document.createElement('fieldset');
        fs.className = 'plan-days';
        var lg = document.createElement('legend');
        lg.textContent = 'Days';
        fs.appendChild(lg);
        var name = 'days-' + String(p.package_id || Math.random()).replace(/[^A-Za-z0-9-]/g, '');
        var opts2 = document.createElement('div');
        opts2.className = 'days';
        steps.forEach(function (t) {
          var lab = document.createElement('label');
          var r = document.createElement('input');
          r.type = 'radio';
          r.name = name;
          r.value = String(t.days);
          r.checked = t.days === chosen.days;
          r.addEventListener('change', function () {
            if (!r.checked) return;
            chosen = { days: t.days, price: t.price };
            pr.textContent = money(t.price);
            showTerm();
          });
          lab.appendChild(r);
          lab.appendChild(span('', String(t.days)));
          opts2.appendChild(lab);
        });
        fs.appendChild(opts2);
        el.appendChild(fs);
      }

      foot.appendChild(priceBox);
      if (priced) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn';
        btn.textContent = I18N.t('site.choose');
        btn.addEventListener('click', function () {
          if (o.onOpen) o.onOpen(p, steps.length ? chosen.days : null);
        });
        foot.appendChild(btn);
      } else {
        foot.appendChild(span('note', I18N.t('site.unavailable')));
      }
      el.appendChild(foot);
      return el;
    }

    return {
      ISO2: ISO2, priceOf: priceOf, money: money, priceText: priceText, dataText: dataText, termText: termText,
      coverageCodes: coverageCodes, coverageText: coverageText, isRestricted: isRestricted, isWorldwide: isWorldwide,
      classify: classify, sortByPrice: sortByPrice, card: card, distinguishers: distinguishers,
      ladder: ladder, alsoCovers: alsoCovers,
    };
  }

  var api = { create: create };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MagicEnPlans = api;
})(typeof window !== 'undefined' ? window : globalThis);
