/* =====================================================================
 * /en/ — the international (GLOBAL) storefront's home.
 * ---------------------------------------------------------------------
 * The home is a way IN: search a destination, land on its English country
 * page (/en/esim/<slug>/), where the plans and their US-dollar prices are.
 * Plans are shown in ONE place — the country page (en/country.js with
 * en/plans.js) — so the home and a country page can never show the same
 * country two ways.
 *
 * WHAT THIS FILE IS ALLOWED TO DO: read the destination list the generator
 * wrote (en/destinations.js, static: the countries that have an English page)
 * and render search results as ordinary links (with the country's flag, a
 * static file under assets/flags/), and follow the best one when the visitor
 * presses «Find plans» or Enter.
 *
 * WHAT IT MUST NEVER DO:
 *
 *   * Touch the network. It does not even read the catalogue: the destination
 *     list is static, so opening /en/ costs the backend nothing. A test bans
 *     every network primitive here.
 *   * Redirect. A result is a link the visitor clicks; the language switch is
 *     a link too. There is no automatic hop to get into a loop with.
 * ================================================================== */
(function () {
  'use strict';

  if (!window.MagicSiteI18n || !Array.isArray(window.MagicEnDestinations)) return;

  var I18N = window.MagicSiteI18n.createI18n('en');
  var DESTINATIONS = window.MagicEnDestinations;
  var $ = function (id) { return document.getElementById(id); };

  I18N.apply(document);

  function renderResults(query) {
    var box = $('results');
    box.textContent = '';
    var q = String(query || '').trim().toLowerCase();
    if (q.length < 1) { box.hidden = true; return; }

    // Substring, not prefix: «korea» must find «South Korea» and «emirates»
    // «United Arab Emirates». Prefix matches still sort first, so typing «it»
    // still leads with Italy.
    var hits = DESTINATIONS.filter(function (d) {
      return d.name.toLowerCase().indexOf(q) !== -1 || d.iso.toLowerCase() === q;
    }).sort(function (a, b) {
      var ap = a.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      var bp = b.name.toLowerCase().indexOf(q) === 0 ? 0 : 1;
      return ap !== bp ? ap - bp : a.name.localeCompare(b.name, 'en');
    }).slice(0, 20);

    if (!hits.length) {
      var none = document.createElement('p');
      none.className = 'note';
      none.textContent = I18N.t('site.noDestination');
      box.appendChild(none);
      box.hidden = false;
      return;
    }
    hits.forEach(function (d) {
      var a = document.createElement('a');
      a.className = 'res';
      // The slug comes from the generated list, which takes it from the
      // country dictionary — never from what the visitor typed. So does the
      // flag: an ISO-2 code from the same list, checked before it is used.
      a.href = '/en/esim/' + d.slug + '/';
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

  // «Find plans» and Enter open the best match — by following its link, the
  // same click a visitor would make; with nothing typed they put the caret in
  // the search. Never a redirect: nothing happens unless the visitor acts.
  function go() {
    var q = $('q');
    if (!String(q.value || '').trim()) { q.focus(); return; }
    renderResults(q.value);
    var first = links()[0];
    if (first) first.click(); else q.focus();
  }

  function boot() {
    var q = $('q');
    q.addEventListener('input', function (e) { renderResults(e.target.value); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); go(); }
      else if (e.key === 'ArrowDown') {
        var first = links()[0];
        if (first) { e.preventDefault(); first.focus(); }
      }
    });
    // Arrow keys walk the results; Escape goes back to the search.
    $('results').addEventListener('keydown', function (e) {
      var all = links();
      var i = all.indexOf(document.activeElement);
      if (i === -1) return;
      if (e.key === 'ArrowDown' && i < all.length - 1) { e.preventDefault(); all[i + 1].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (i > 0 ? all[i - 1] : q).focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); q.focus(); }
    });
    var btn = $('qGo');
    if (btn) btn.addEventListener('click', go);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
