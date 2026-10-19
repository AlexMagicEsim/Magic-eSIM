/* assets/ru-search.js — the destination matcher of the Russian storefront
 * (conversion stage 2, PR B). ONE matcher for the home's search (ru-home.js)
 * and for /esim/ (the hub's inline script): what a traveller types — a
 * country in any case form («в Турцию», «Таиланде»), its English name, a city
 * or a resort («Бали», «Анталья», «Дубай»), a colloquial name («Англия»), or a
 * region («Европа», «Балканы», «весь мир») — leads to the country pages.
 *
 * Data: assets/ru-destinations.js (generated): MagicRuDestinations (name, en,
 * slug, aliases), MagicRuRegions, MagicRuPopular. No network, no catalogue.
 * A region answer is a list of that region's popular destinations with a page —
 * never a claim that the whole region is covered.
 *
 * MagicRuSearch.search(query) → { hits: [{ d, via }], region } — `via` is the
 * alias that matched («Бали»), or ''. Also usable from Node (module.exports).
 */
(function (root) {
  'use strict';

  var PREPOSITIONS = { 'в': 1, 'во': 1, 'на': 1, 'для': 1, 'по': 1, 'из': 1, 'с': 1, 'со': 1 };

  function norm(s) {
    return String(s || '').toLowerCase().replace(/ё/g, 'е')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[-‐‑–—_]+/g, ' ').replace(/[.,!?;:«»"'()]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function words(s) {
    var w = norm(s).split(' ').filter(Boolean);
    while (w.length > 1 && PREPOSITIONS[w[0]]) w.shift();      // «в Турцию», «на Бали»
    if (w.length === 1 && PREPOSITIONS[w[0]]) return [];
    return w;
  }
  // A Russian case ending off a word, from a list (longest first), never below
  // 3 letters: «турцию» → «турц» = «турция» → «турц»; «южную» → «южн»;
  // «европу» → «европ». A blunter «strip 1–2 vowels» made «бали» look like
  // «балканы» and «корея» like «корфу».
  var ENDINGS = ['ями', 'ами', 'ого', 'ему', 'ому', 'ыми', 'ими', 'ую', 'юю', 'ая', 'яя', 'ое', 'ее', 'ой', 'ей', 'ом', 'ем',
    'ах', 'ях', 'ам', 'ям', 'ов', 'ев', 'ию', 'ия', 'ии', 'ье', 'ья', 'ью', 'а', 'я', 'у', 'ю', 'е', 'и', 'ы', 'о', 'й', 'ь'];
  function stem(w) {
    if (!/[а-я]/.test(w)) return w;
    for (var i = 0; i < ENDINGS.length; i++) {
      var e = ENDINGS[i];
      if (w.length - e.length >= 3 && w.slice(-e.length) === e) return w.slice(0, -e.length);
    }
    return w;
  }
  // A fleeting vowel: «египет» → «египт» (as in «в Египте»).
  function forms(t) {
    var f = t.replace(/[ео]([бвгджзклмнпрстфхцчшщ])$/, '$1');
    return f === t ? [t] : [t, f];
  }
  function wordWhole(q, t) {      // the same word in another case form
    var s = stem(q);
    return forms(t).some(function (v) { return v === q || stem(v) === s; });
  }
  function wordPrefix(q, t) {     // the word begun, in any case form
    var s = stem(q);
    return forms(t).some(function (v) { return v.indexOf(s) === 0; });
  }
  function toks(text) { return norm(text).split(' ').filter(Boolean); }
  // Every query word begins some word of the candidate, in order.
  function phraseMatches(qw, text) {
    var tw = toks(text), j = 0;
    for (var i = 0; i < qw.length; i++) {
      while (j < tw.length && !wordPrefix(qw[i], tw[j])) j++;
      if (j >= tw.length) return false;
      j++;
    }
    return true;
  }
  // The query IS the name, word for word, in some case form («европу»,
  // «латинской америке», «южную корею»).
  function wholeMatches(qw, text) {
    var tw = toks(text);
    if (tw.length !== qw.length) return false;
    for (var i = 0; i < qw.length; i++) if (!wordWhole(qw[i], tw[i])) return false;
    return true;
  }

  function data() {
    return {
      list: Array.isArray(root.MagicRuDestinations) ? root.MagicRuDestinations : [],
      regions: Array.isArray(root.MagicRuRegions) ? root.MagicRuRegions : [],
      popular: Array.isArray(root.MagicRuPopular) ? root.MagicRuPopular : []
    };
  }

  function search(query, opts) {
    var limit = (opts && opts.limit) || 20;
    var D = data();
    var qw = words(query);
    var out = { hits: [], region: null };
    if (!qw.length) return out;
    var q = qw.join(' ');

    for (var r = 0; r < D.regions.length; r++) {
      var reg = D.regions[r];
      if ((reg.names || []).some(function (n) { return wholeMatches(qw, n); })) { out.region = reg; break; }
    }

    var ranked = [];
    D.list.forEach(function (d) {
      var name = norm(d.name), en = norm(d.en), slug = d.slug.replace(/-/g, ' ');
      var rank = -1, via = '';
      if (d.iso.toLowerCase() === q) rank = 0;
      else if (name === q || en === q) rank = 0;
      else if (wholeMatches(qw, d.name) || wholeMatches(qw, d.en)) rank = 1;
      else if (name.indexOf(q) === 0 || en.indexOf(q) === 0 || slug.indexOf(q) === 0) rank = 2;
      else if (name.indexOf(q) !== -1 || en.indexOf(q) !== -1 || slug.indexOf(q) !== -1) rank = 3;
      else if (phraseMatches(qw, d.name) || phraseMatches(qw, d.en) || phraseMatches(qw, slug)) rank = 3;
      var aliases = d.aliases || [];
      for (var k = 0; k < aliases.length; k++) {
        var a = aliases[k];
        // An alias in its own words or a case form of them; begun literally (3+ letters). No stem-prefix:
        // «дубай» must not find «дубровник».
        var na = norm(a);
        var ar = na === q ? 0 : wholeMatches(qw, a) ? 1 : (q.length >= 3 && na.indexOf(q) === 0) ? 4 : -1;
        if (ar !== -1 && (rank === -1 || ar < rank)) { rank = ar; via = a; }
      }
      // «Корея» → «Южная Корея»: the alias is in the name already, no label.
      if (via && name.indexOf(norm(via)) !== -1) via = '';
      if (rank !== -1) ranked.push({ d: d, via: via, rank: rank });
    });
    ranked.sort(function (a, b) { return a.rank - b.rank || a.d.name.localeCompare(b.d.name, 'ru'); });
    out.hits = ranked.slice(0, limit).map(function (x) { return { d: x.d, via: x.via }; });
    return out;
  }

  /** The region's countries (or the popular list) as destination entries. */
  function entries(isos) {
    var byIso = {};
    data().list.forEach(function (d) { byIso[d.iso] = d; });
    return (isos || []).map(function (i) { return byIso[i]; }).filter(Boolean);
  }

  var api = { norm: norm, words: words, stem: stem, search: search, entries: entries, popular: function () { return entries(data().popular); } };
  root.MagicRuSearch = api;
  if (typeof module === 'object' && module && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
