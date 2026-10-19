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
  // The matcher is assets/ru-search.js (one for the home and /esim/): case
  // forms, English names, cities and resorts, regions. If it failed to load,
  // the search still finds countries by name, as before.
  function legacyHits(query) {
    var q = norm(query);
    if (!q) return [];
    function latin(d) { return norm(d.en) + ' ' + d.slug.replace(/-/g, ' '); }
    return DESTINATIONS.filter(function (d) {
      return norm(d.name).indexOf(q) !== -1 || latin(d).indexOf(q) !== -1 || d.iso.toLowerCase() === q;
    }).slice(0, 20).map(function (d) { return { d: d, via: '' }; });
  }
  function find(query) {
    var S = window.MagicRuSearch;
    return S ? S.search(query) : { hits: legacyHits(query), region: null };
  }
  function popular() {
    var S = window.MagicRuSearch;
    return S ? S.popular() : [];
  }

  function link(d, via) {
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
    if (via) {
      // «Бали» → Индонезия: the place typed, after the country it leads to.
      var v = document.createElement('span');
      v.className = 'res-via';
      v.textContent = via.charAt(0).toUpperCase() + via.slice(1);
      a.appendChild(v);
    }
    return a;
  }
  function note(text) {
    var p = document.createElement('p');
    p.className = 'note';
    p.textContent = text;
    return p;
  }

  /* search_no_result: ONE goal per streak of a query that finds nothing — on
     «Найти тарифы» / Enter, or once the typing has paused. Never the text. */
  var noResultSent = false;
  var idle = null;
  function noResult() {
    if (noResultSent) return;
    noResultSent = true;
    goal('search_no_result');
  }

  // Returns what was rendered: 'none' | 'region' | 'hits' | 'nothing'.
  function renderResults(query) {
    var box = $('results');
    box.textContent = '';
    if (idle) { clearTimeout(idle); idle = null; }
    if (!String(query || '').trim()) { box.hidden = true; noResultSent = false; return 'none'; }
    var r = find(query);
    if (r.region) {
      var S = window.MagicRuSearch;
      box.appendChild(note(r.region.label + ' — популярные направления. Выберите первую страну поездки: на её странице есть и тарифы на несколько стран, если они её покрывают.'));
      (S ? S.entries(r.region.countries) : []).forEach(function (d) { box.appendChild(link(d, '')); });
    }
    r.hits.forEach(function (h) { box.appendChild(link(h.d, h.via)); });
    if (r.region || r.hits.length) {
      noResultSent = false;
      box.hidden = false;
      return r.region ? 'region' : 'hits';
    }
    var none = note('Такого направления нет. Посмотрите популярные или ');
    var all = document.createElement('a');
    all.href = '/esim/';
    all.textContent = 'все направления';
    none.appendChild(all);
    none.appendChild(document.createTextNode('.'));
    box.appendChild(none);
    popular().forEach(function (d) { box.appendChild(link(d, '')); });
    box.hidden = false;
    if (String(query).trim().length >= 3) idle = setTimeout(noResult, 1500);
    return 'nothing';
  }

  function links() {
    return Array.prototype.slice.call($('results').querySelectorAll('a.res'));
  }

  // «Найти тарифы» / Enter: go to the best country. A region or nothing found
  // stays on the list — never jump to a popular destination nobody asked for.
  function go() {
    var q = $('q');
    if (!String(q.value || '').trim()) { q.focus(); return; }
    var shown = renderResults(q.value);
    if (shown === 'hits') { var first = links()[0]; if (first) { first.click(); return; } }
    if (shown === 'nothing') noResult();
    q.focus();
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
