/* =====================================================================
 * site-i18n — the engine that puts the storefront's words on a page.
 * The words themselves live one file per language in assets/i18n/ (I18N-10).
 * ---------------------------------------------------------------------
 * WHY THIS IS NOT app/i18n.js. That engine is good and this one is modelled
 * on it — same allowlist-before-lookup rule, same «a Russian string is never
 * replaced by an English one» fallback, same individually-guarded storage.
 * It is not REUSED because `robots.txt` carries `Disallow: /app/`, and an
 * indexable page whose text depends on a script crawlers are told not to
 * fetch is a page that renders empty for a crawler. The Mini App's engine
 * stays where the Mini App can reach it.
 *
 * WHY THE RUSSIAN DICTIONARY EXISTS AT ALL, when index.html is hardcoded
 * Russian and stays that way. Because the alternative — translating from
 * English at build time, or keeping only English here — makes the two pages
 * free to drift with nothing to notice. `test/site-i18n.test.js` asserts that
 * every Russian string in this file appears VERBATIM in index.html, so the
 * dictionary is provably a mirror of the live Russian page rather than a
 * second opinion about it. Change the landing's wording without changing this
 * file and the gate goes red.
 *
 * That is a deliberate trade. Rewriting 3409 lines of production Russian
 * markup to render through a dictionary would have been the tidier shape and
 * a far worse risk: the RU landing is the only page that has ever taken money.
 * It is untouched, and a test holds the two together instead.
 *
 * IT CANNOT THROW. `t()` is called during first paint; a throw here is not a
 * missing translation, it is a blank page.
 * ================================================================== */
(function (root) {
  'use strict';

  /** The languages the site speaks (seo/locales.mjs, published). Compared by equality. */
  var LANGS = ['ru', 'en', 'es', 'de', 'fr', 'zh-Hans'];

  /**
   * Russian, when we do not know.
   *
   * NOT English, and for the same reason the Mini App gives: the absence of a
   * statement is not a statement. This shop's landing, support and channel are
   * Russian. English is chosen when a page says so — `/en/` sets it explicitly
   * — never inferred from a browser header on a page that has no English twin.
   */
  var DEFAULT_LANG = 'ru';

  /** The manual choice. Survives closing the tab; a language is not session state. */
  var STORAGE_KEY = 'mesim.site.lang';

  /* The words: ONE file per language, assets/i18n/<code>.js (I18N-10, 2026-10-22).
   *
   * In the browser a page loads the bundle of its own language only —
   * /assets/site-i18n-<prefix>.js = that language's words + this engine, built by
   * seo/site-i18n-bundle.mjs — so the words file has run before this line and left
   * its table in `root.MagicSiteWords`. A page never carries another language's
   * words; adding a language adds a file, never bytes to anyone else's page.
   *
   * In Node (generators, tests, the localization-qa skill) every language is read
   * from its file, so `DICT` there is the whole dictionary, as it always was.
   *
   * Frozen, and frozen DEEP. `LANGS` was defensively copied on the way out two
   * lines below while the dictionary itself was handed over by reference — a
   * caller could have rewritten a price note or a refusal message at runtime.
   * There is no reason for anything to write here. */
  var NODE = typeof module === 'object' && module && module.exports && typeof require === 'function';
  var LOADED = (!NODE && root.MagicSiteWords && typeof root.MagicSiteWords === 'object') ? root.MagicSiteWords : {};
  var DICT = {};
  for (var li = 0; li < LANGS.length; li += 1) {
    var code = LANGS[li];
    var words = NODE ? require('./i18n/' + code + '.js')
      : (Object.prototype.hasOwnProperty.call(LOADED, code) ? LOADED[code] : null);
    if (words && typeof words === 'object') DICT[code] = Object.freeze(words);
  }

  /**
   * Where each language's pages live. Russian is the root; every other
   * language sits under its own prefix — the registry's (seo/locales.mjs),
   * held equal to it by seo/test-locales.mjs.
   */
  var PREFIX = { ru: '', en: 'en', es: 'es', de: 'de', fr: 'fr', 'zh-Hans': 'zh' };
  Object.freeze(PREFIX);
  Object.freeze(DICT);

  function isLang(v) {
    return typeof v === 'string' && LANGS.indexOf(v) !== -1;
  }

  /** Individually guarded: Safari with cookies blocked throws on ACCESS. */
  function readStored() {
    try {
      var v = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return isLang(v) ? v : null;
    } catch (e) { return null; }
  }

  function writeStored(lang) {
    try {
      if (root.localStorage && isLang(lang)) root.localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) { /* private mode throws on quota while getItem works fine */ }
  }

  function createI18n(initial) {
    var active = isLang(initial) ? initial : DEFAULT_LANG;

    /**
     * A string for a key.
     *
     * The chain is active -> ru -> the key itself, and NEVER active -> en.
     * An untranslated English string shown to a Russian customer is worse than
     * an untranslated key, because it looks deliberate.
     *
     * The key is checked with `hasOwnProperty` before it is used, so
     * `t('__proto__')` cannot return an object, and the result is coerced to a
     * string so a dictionary mistake cannot hand markup to a caller that will
     * insert it.
     */
    function lookup(k) {
      var d = DICT[active];
      if (d && Object.prototype.hasOwnProperty.call(d, k)) return String(d[k]);
      var ru = DICT[DEFAULT_LANG];
      if (ru && Object.prototype.hasOwnProperty.call(ru, k)) return String(ru[k]);
      return k;
    }

    /**
     * `vars`, when given, fills `{name}` placeholders from its OWN properties
     * only; an unknown placeholder is left as written, so a missing value is
     * visible rather than silently empty. Values are coerced to strings —
     * still text, never markup.
     */
    function t(key, vars) {
      var s = lookup(String(key == null ? '' : key));
      if (!vars || typeof vars !== 'object') return s;
      return s.replace(/\{([A-Za-z0-9_]+)\}/g, function (m, name) {
        return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m;
      });
    }

    /**
     * The plural form of `base` for n: `base.<category>` by the language's own
     * Intl.PluralRules, falling back to `base.other`. English without Intl:
     * 1 → one, anything else → other.
     */
    var rules = null;
    try { rules = (typeof Intl !== 'undefined' && Intl.PluralRules) ? new Intl.PluralRules(active) : null; } catch (e) { rules = null; }
    function plural(base, n, vars) {
      var num = Number(n);
      var cat = rules ? rules.select(num) : (num === 1 ? 'one' : 'other');
      var key = base + '.' + cat;
      var d = DICT[active];
      if (!(d && Object.prototype.hasOwnProperty.call(d, key))) key = base + '.other';
      return t(key, vars);
    }

    function setLang(next) {
      if (!isLang(next)) return active;
      active = next;
      writeStored(next);
      return active;
    }

    /**
     * Fill every `[data-i18n]` element in a root.
     *
     * `textContent`, never `innerHTML`: a dictionary is data, and the one way
     * a dictionary becomes a vulnerability is a helper that renders it as
     * markup.
     */
    function apply(scope) {
      var el = (scope || root.document);
      if (!el || !el.querySelectorAll) return;
      // No words for this language on this page (its bundle did not load, or an
      // old page met a new engine): the static text the page was built with is
      // already right — leave it, never overwrite it with keys.
      if (!DICT[active]) return;
      var nodes = el.querySelectorAll('[data-i18n]');
      for (var i = 0; i < nodes.length; i += 1) {
        nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
      }
      var attrs = el.querySelectorAll('[data-i18n-attr]');
      for (var j = 0; j < attrs.length; j += 1) {
        var spec = String(attrs[j].getAttribute('data-i18n-attr') || '');
        var parts = spec.split(':');
        if (parts.length === 2 && parts[0] && parts[1]) {
          // Only these three. An arbitrary attribute name from markup is how a
          // helper like this grows into a way to set `onclick` or `href`.
          if (['placeholder', 'aria-label', 'title'].indexOf(parts[0]) !== -1) {
            attrs[j].setAttribute(parts[0], t(parts[1]));
          }
        }
      }
    }

    return {
      t: t,
      plural: plural,
      apply: apply,
      setLang: setLang,
      lang: function () { return active; },
      LANGS: LANGS.slice()
    };
  }

  /** The page's own language: `<html lang>`, when it is one this file speaks. */
  function pageLang(doc) {
    var d = doc || root.document;
    var v = d && d.documentElement ? String(d.documentElement.getAttribute('lang') || '') : '';
    return isLang(v) ? v : DEFAULT_LANG;
  }

  /** «/en» for English, «» for Russian: the start of every path in a language. */
  function pathPrefix(lang) {
    return isLang(lang) && PREFIX[lang] ? '/' + PREFIX[lang] : '';
  }

  var api = {
    createI18n: createI18n,
    pageLang: pageLang,
    pathPrefix: pathPrefix,
    PREFIX: PREFIX,
    DICT: DICT,
    LANGS: LANGS.slice(),
    DEFAULT_LANG: DEFAULT_LANG,
    STORAGE_KEY: STORAGE_KEY,
    isLang: isLang,
    readStored: readStored
  };

  root.MagicSiteI18n = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
