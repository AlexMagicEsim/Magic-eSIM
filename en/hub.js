/* =====================================================================
 * /en/esim/ — the destination list's search.
 * ---------------------------------------------------------------------
 * The page is complete without this file: every destination is a link in
 * an A–Z group, with jump letters. This script only adds a search box that
 * filters that list IN PLACE.
 *
 * WHAT IT MUST NEVER DO:
 *   * Touch the network. The list is in the HTML; connect-src is 'none'.
 *   * Store anything, or redirect. Enter follows the first match as the same
 *     click a visitor would make.
 * ================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var box = $('hubSearch');
  var q = $('hq');
  var list = $('hubList');
  if (!box || !q || !list) return;

  var items = Array.prototype.slice.call(list.querySelectorAll('li[data-name]'));
  var groups = Array.prototype.slice.call(list.querySelectorAll('.az-group'));
  var count = $('hubCount');
  var empty = $('hubEmpty');
  var popular = $('hubPopular');
  var clear = $('hubClear');
  var az = $('hubAz');

  // Accents do not matter when searching: «aland» finds «Åland Islands».
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function apply() {
    var term = norm(q.value);
    var shown = 0;
    items.forEach(function (li) {
      var hit = !term || li.getAttribute('data-name').indexOf(term) !== -1
        || li.getAttribute('data-iso').toLowerCase() === term;
      li.hidden = !hit;
      if (hit) shown += 1;
    });
    groups.forEach(function (g) {
      g.hidden = !g.querySelector('li[data-name]:not([hidden])');
    });
    // While searching, the matches ARE the list: the popular row and the
    // letters would only point at entries the search has hidden.
    if (popular) popular.hidden = !!term;
    if (az) az.hidden = !!term;
    clear.hidden = !term;
    empty.hidden = shown !== 0;
    count.textContent = term
      ? (shown === 0 ? 'No matches' : shown + (shown === 1 ? ' destination' : ' destinations') + ' match')
      : '';
  }

  function first() {
    var li = items.filter(function (x) { return !x.hidden; })[0];
    return li ? li.querySelector('a') : null;
  }

  q.addEventListener('input', apply);
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var a = norm(q.value) ? first() : null;
      if (a) a.click();
    } else if (e.key === 'Escape' && q.value) {
      e.preventDefault();
      q.value = '';
      apply();
    }
  });
  clear.addEventListener('click', function () { q.value = ''; apply(); q.focus(); });
  $('hubReset').addEventListener('click', function () { q.value = ''; apply(); q.focus(); });

  box.hidden = false;
  apply();
})();
