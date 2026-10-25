/*
 * MagicAssortment — the ONE reader of the backend's assortment layout.
 *
 * WHY THIS EXISTS (owner, 2026-10-25): the site and the Telegram Mini App must
 * show the SAME plans for a country and a market — the same ids, prices,
 * volumes, terms, card order and the same three blocks (local, regional,
 * daily) — and none of them may decide that on its own. The backend decides
 * (esim-backend lib/assortment.js + lib/assortmentLayout.js) and sends, with
 * every catalogue answer, `assortment.countries`:
 *
 *   { "AE": { local: [id…], regional: [id…], daily: [id…], best: id|null }, … }
 *
 * each list already in display order, the regional block already within its
 * cap. This file only looks the ids up in the catalogue's own `data` and hands
 * the cards back. It filters nothing, sorts nothing, classifies nothing: an id
 * the catalogue does not carry is skipped (it cannot be drawn), and that is
 * all. The Russian site (assets/country-tariffs.js), every prefixed language
 * (en/country.js) and the Mini App (app/core.js) read the layout ONLY through
 * this file — seo/test-assortment-single-source.mjs holds them to it.
 *
 * WHERE THE LAYOUT TRAVELS: the catalogue loaders hand pages a plain array of
 * packages; the layout rides on that array as a non-enumerable `assortment`
 * property (attach / of), so every existing consumer of the array keeps
 * working and a copy of the array (slice, filter) simply has no layout.
 *
 * No layout (an old snapshot, a backend without it) = `null` from forCountry —
 * the caller shows its «unavailable» state; it never falls back to a rule of
 * its own.
 */
(function (root) {
  'use strict';

  var BLOCKS = ['local', 'regional', 'daily'];
  var index = typeof WeakMap === 'function' ? new WeakMap() : null;

  function valid(a) {
    return !!(a && typeof a === 'object' && a.countries && typeof a.countries === 'object');
  }

  /** Puts the backend's layout on a package array. Returns the array. */
  function attach(list, assortment) {
    if (!Array.isArray(list)) return list;
    try {
      Object.defineProperty(list, 'assortment', { value: valid(assortment) ? assortment : null, enumerable: false, configurable: true, writable: true });
    } catch (_) { /* a frozen array: no layout */ }
    return list;
  }

  /** The layout a package array carries, or null. */
  function of(list) {
    var a = list && list.assortment;
    return valid(a) ? a : null;
  }

  function byId(list) {
    var hit = index && index.get(list);
    if (hit) return hit;
    var m = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p && p.package_id != null) m[String(p.package_id)] = p;
    }
    if (index) index.set(list, m);
    return m;
  }

  /**
   * One country's page: { local, regional, daily, best } with the PACKAGES in
   * the backend's order, or null when the list carries no layout. A country
   * the layout does not name has nothing to show: three empty blocks.
   */
  function forCountry(list, iso) {
    var a = of(list);
    if (!a) return null;
    var code = String(iso || '').toUpperCase();
    var entry = a.countries[code] || null;
    var ids = byId(list);
    var out = { local: [], regional: [], daily: [], best: null };
    if (!entry) return out;
    for (var b = 0; b < BLOCKS.length; b++) {
      var name = BLOCKS[b];
      var got = Array.isArray(entry[name]) ? entry[name] : [];
      for (var i = 0; i < got.length; i++) {
        var p = ids[String(got[i])];
        if (p) out[name].push(p);
      }
    }
    var best = entry.best == null ? null : String(entry.best);
    out.best = best && ids[best] ? best : null;
    return out;
  }

  /** The countries the layout gives at least one card, in code order. */
  function countries(list) {
    var a = of(list);
    if (!a) return [];
    var ids = byId(list);
    return Object.keys(a.countries).filter(function (iso) {
      var e = a.countries[iso] || {};
      return BLOCKS.some(function (b) {
        return (Array.isArray(e[b]) ? e[b] : []).some(function (id) { return !!ids[String(id)]; });
      });
    }).sort();
  }

  var api = { BLOCKS: BLOCKS, attach: attach, of: of, forCountry: forCountry, countries: countries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MagicAssortment = api;
})(typeof window !== 'undefined' ? window : globalThis);
