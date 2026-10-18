/*
 * The numbers the generator printed outside the tariff grid follow the
 * catalogue the grid shows (SEO stage C).
 *
 * seo/build-catalogue-pages.mjs marks them: the facts line's counts
 * (data-cat="local" | "regional" | "daily", each inside data-cat-seg) and the
 * floor «от N ₽» (data-cat="floor", inside a data-cat-floor phrase) in the facts
 * line and in the template FAQ. They were right when the page was built; the
 * catalogue moves several times a day and the page is rebuilt only when a person
 * merges the SEO refresh PR (measured: a median of ~10 h, up to 46 h, between a
 * catalogue update and that merge).
 *
 * assets/country-tariffs.js renders the grid, then dispatches
 * `magic:catalog-rendered` with the packages of each block and whether the
 * catalogue it rendered can be trusted as current:
 *   trusted  — the live API, or a snapshot fresh enough to show without a notice:
 *              every marked number becomes the rendered one (a segment whose
 *              count is 0 hides; the floor is the cheapest purchasable amount);
 *   !trusted — a stale snapshot (the API is down and the snapshot is > 48 h) or
 *              no catalogue at all: the floor phrases HIDE — an old price is
 *              never shown as current. Counts follow the stale grid, which says
 *              itself that it is saved data.
 * Crawlers and readers without JavaScript keep the build-time numbers, which
 * the gates (seo/test-generated-prices.mjs, C2/C3) hold equal to the catalogue
 * at build time.
 *
 * The cheapest purchasable amount is the generator's rule (seo/catalogue-facts.mjs
 * purchasablePrice): the lowest rung of term_prices when there is a ladder, else
 * price. seo/test-live-numbers.mjs holds the two equal on every package.
 */
(function (root) {
  'use strict';

  function purchasablePrice(p) {
    var terms = p && Array.isArray(p.term_prices) ? p.term_prices : [];
    var v = [];
    for (var i = 0; i < terms.length; i++) {
      var n = Number(terms[i] && terms[i].price);
      if (isFinite(n) && n > 0) v.push(n);
    }
    if (v.length) return Math.min.apply(null, v);
    var raw = Number(p && p.price);
    return isFinite(raw) && raw > 0 ? raw : null;
  }

  function floorOf(items) {
    var min = null;
    for (var i = 0; i < (items || []).length; i++) {
      var n = purchasablePrice(items[i]);
      if (n !== null && (min === null || n < min)) min = n;
    }
    return min;
  }

  // seo/build-catalogue-pages.mjs money(): Math.round(v).toLocaleString('ru-RU').
  function money(v) { return Math.round(Number(v)).toLocaleString('ru-RU'); }

  function setHidden(el, hidden) { if (hidden) el.setAttribute('hidden', ''); else el.removeAttribute('hidden'); }

  function apply(doc, detail) {
    if (!doc || !doc.querySelector || !doc.querySelector('[data-cat]')) return;
    var d = detail || {};
    var have = Array.isArray(d.local) && Array.isArray(d.regional) && Array.isArray(d.daily);
    var floors = doc.querySelectorAll('[data-cat-floor]');
    var i;
    if (have) {
      var counts = { local: d.local.length, regional: d.regional.length, daily: d.daily.length };
      var segs = doc.querySelectorAll('[data-cat-seg]');
      for (i = 0; i < segs.length; i++) {
        var k = segs[i].getAttribute('data-cat-seg');
        if (!(k in counts)) continue;
        var b = segs[i].querySelector('[data-cat="' + k + '"]');
        if (b) b.textContent = String(counts[k]);
        setHidden(segs[i], counts[k] === 0);
      }
    }
    var floor = have && d.trusted ? floorOf(d.local.concat(d.regional, d.daily)) : null;
    for (i = 0; i < floors.length; i++) {
      if (floor === null) { setHidden(floors[i], true); continue; }
      var n = floors[i].querySelector('[data-cat="floor"]');
      if (n) n.textContent = money(floor) + ' ₽';
      setHidden(floors[i], false);
    }
  }

  var api = { purchasablePrice: purchasablePrice, floorOf: floorOf, money: money, apply: apply };
  root.MagicCatalogNumbers = api;
  if (root.document && typeof root.addEventListener === 'function') {
    root.addEventListener('magic:catalog-rendered', function (e) { apply(root.document, e && e.detail); });
  }
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
