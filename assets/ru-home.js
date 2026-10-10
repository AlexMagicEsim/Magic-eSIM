/* =====================================================================
 * / — the Russian storefront's home (RU↔EN migration PR C).
 * ---------------------------------------------------------------------
 * The Russian localisation of /en/ (en/app.js): the home is a way IN. Search a
 * destination, land on its country page (/esim/<slug>/), where the plans, the
 * rouble prices and the checkout are. Plans are shown in ONE place — the
 * country page — so the home and a country page can never show the same
 * country two ways.
 *
 * WHAT THIS FILE DOES:
 *   * reads the destination list the generator wrote (assets/ru-destinations.js,
 *     static: the countries that have a page) and renders search results as
 *     ordinary links, with the country's flag (a static file under
 *     assets/flags/); «Найти тарифы» or Enter follows the best one;
 *   * keeps the home's existing Metrika goals for the ways into a country page
 *     (country_search, popular_country_click) and the Mini App button
 *     (telegram_app_click) — through the page's own allowlisted wrapper;
 *   * keeps OLD links working. Until PR C the home held the catalogue, and
 *     links to it are out in the world: /?country=XX (the country pages' old buy
 *     link, still in search indexes — see robots.txt) goes to that country's
 *     page; #global-pricing, #solution and #install-guides-section scroll to
 *     what replaced them.
 *
 * WHAT IT MUST NEVER DO: touch the network (no catalogue, no API — the list is
 * static), or redirect anywhere but a country page from the generated list.
 * First-touch attribution is captured by the inline script in <head> before
 * this file runs, so the legacy hop keeps the visit's source.
 * ================================================================== */
(function () {
  'use strict';

  var DESTINATIONS = Array.isArray(window.MagicRuDestinations) ? window.MagicRuDestinations : [];
  var $ = function (id) { return document.getElementById(id); };
  var goal = function (name, params) {
    try { if (typeof window.magicMetrikaGoal === 'function') window.magicMetrikaGoal(name, params); } catch (e) { /* analytics never blocks */ }
  };

  // «ё» and «е» are one letter to a person typing in a hurry; accents in the
  // English names («Türkiye», «Curaçao») likewise.
  function norm(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е')
      .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }
  function byIso(iso) {
    iso = String(iso || '').toUpperCase();
    for (var i = 0; i < DESTINATIONS.length; i++) if (DESTINATIONS[i].iso === iso) return DESTINATIONS[i];
    return null;
  }

  /* ---- old links ------------------------------------------------------ */
  (function legacy() {
    try {
      var code = new URLSearchParams(location.search).get('country');
      if (code) {
        var d = /^[A-Za-z]{2}$/.test(code) ? byIso(code) : null;
        // The slug comes from the generated list, never from the URL.
        if (d) { location.replace('/esim/' + d.slug + '/'); return; }
      }
      var MAP = { '#global-pricing': '#plans', '#solution': '#how', '#install-guides-section': '#guides' };
      var to = MAP[location.hash];
      if (to) {
        history.replaceState(null, '', location.pathname + location.search + to);
        var el = document.querySelector(to);
        if (el) el.scrollIntoView();
      }
    } catch (e) { /* an old link that cannot be honoured leaves the home as it is */ }
  })();

  /* ---- search --------------------------------------------------------- */
  function hitsFor(query) {
    var q = norm(query);
    if (!q) return [];
    // Substring, not prefix: «корея» must find «Южная Корея». Prefix matches
    // sort first, so «ит» still leads with Италия. Latin finds the English
    // name («emirates»), the page's slug («turkey» — the English name is
    // «Türkiye»; the Mini App searches the same slugs) and the ISO code («tr»).
    function latin(d) { return norm(d.en) + ' ' + d.slug.replace(/-/g, ' '); }
    return DESTINATIONS.filter(function (d) {
      return norm(d.name).indexOf(q) !== -1 || latin(d).indexOf(q) !== -1 || d.iso.toLowerCase() === q;
    }).sort(function (a, b) {
      // An exact ISO code first («ae» is the UAE, not «Israel»), then a prefix.
      var rank = function (d) {
        if (d.iso.toLowerCase() === q) return 0;
        return (norm(d.name).indexOf(q) === 0 || norm(d.en).indexOf(q) === 0 || d.slug.indexOf(q) === 0) ? 1 : 2;
      };
      var ap = rank(a);
      var bp = rank(b);
      return ap !== bp ? ap - bp : a.name.localeCompare(b.name, 'ru');
    }).slice(0, 20);
  }

  function renderResults(query) {
    var box = $('results');
    box.textContent = '';
    if (!String(query || '').trim()) { box.hidden = true; return; }
    var hits = hitsFor(query);
    if (!hits.length) {
      var none = document.createElement('p');
      none.className = 'note';
      none.textContent = 'Такого направления нет. Посмотрите список всех стран.';
      var all = document.createElement('a');
      all.href = '/esim/';
      all.textContent = 'Все направления';
      none.appendChild(document.createTextNode(' '));
      none.appendChild(all);
      box.appendChild(none);
      box.hidden = false;
      return;
    }
    hits.forEach(function (d) {
      var a = document.createElement('a');
      a.className = 'res';
      a.href = '/esim/' + d.slug + '/';
      a.setAttribute('data-country', d.iso);
      if (/^[A-Z]{2}$/.test(d.iso)) {
        var img = document.createElement('img');
        img.className = 'flag';
        img.src = '/assets/flags/' + d.iso.toLowerCase() + '.svg';
        img.alt = '';
        img.width = 28;
        img.height = 21;
        img.loading = 'lazy';
        a.appendChild(img);
      }
      a.appendChild(document.createTextNode(d.name));
      box.appendChild(a);
    });
    box.hidden = false;
  }

  function links() {
    return Array.prototype.slice.call($('results').querySelectorAll('a.res'));
  }

  // «Найти тарифы» and Enter open the best match — by following its link, the
  // same click a visitor would make; with nothing typed they put the caret in
  // the search. Nothing happens unless the visitor acts.
  function go() {
    var q = $('q');
    if (!String(q.value || '').trim()) { q.focus(); return; }
    renderResults(q.value);
    var first = links()[0];
    if (first) first.click(); else q.focus();
  }

  function boot() {
    var q = $('q');
    var box = $('results');
    if (q && box) {
      q.addEventListener('input', function (e) { renderResults(e.target.value); });
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); go(); }
        else if (e.key === 'ArrowDown') {
          var first = links()[0];
          if (first) { e.preventDefault(); first.focus(); }
        }
      });
      // Arrow keys walk the results; Escape goes back to the search.
      box.addEventListener('keydown', function (e) {
        var all = links();
        var i = all.indexOf(document.activeElement);
        if (i === -1) return;
        if (e.key === 'ArrowDown' && i < all.length - 1) { e.preventDefault(); all[i + 1].focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? all[i - 1] : q).focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); q.focus(); }
      });
      // The goal the old search fired: a destination found by search. Only the
      // country code — never what was typed.
      box.addEventListener('click', function (e) {
        var a = e.target.closest('a.res');
        if (a) goal('country_search', { country_code: a.getAttribute('data-country') });
      });
      var btn = $('qGo');
      if (btn) btn.addEventListener('click', go);
    }

    // The two other existing goals: a popular destination (the tiles and the
    // hero's «Популярно:» row), and the Mini App button.
    document.addEventListener('click', function (e) {
      var d = e.target.closest('a.dest-card[data-country]');
      if (d) goal('popular_country_click', { country_code: d.getAttribute('data-country') });
      if (e.target.closest('[data-tg-entry]')) goal('telegram_app_click', { page_type: 'landing' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
