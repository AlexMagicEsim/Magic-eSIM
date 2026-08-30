'use strict';

/* ============================================================================
 * Magic eSIM Mini App — the i18n engine.
 *
 * WHY THIS IS A FACTORY AND NOT A SINGLETON
 *
 *   `createI18n(deps)` mirrors `C.createApi(deps)` for the same reason that one
 *   does: the interesting behaviour here is what happens with a dictionary that
 *   has a hole, a storage that throws, and a Telegram that lies — and none of
 *   those can be exercised against a module-level singleton without leaving
 *   global state behind for the next test to trip over. A `setLang('en')` in
 *   one test that silently makes a later test pass is exactly the "green by
 *   drift" failure this project has been bitten by twice.
 *
 *   The singleton at the bottom is a thin default instance, and it is what the
 *   app uses.
 *
 * THREE RULES THIS FILE ENFORCES
 *
 *   1. IT CANNOT THROW AT LOAD, and `t()` cannot throw at all. This script runs
 *      before `ui.js`, which reads `window.MagicI18n` on its first line. A
 *      throw here is not a missing translation, it is a blank Mini App. That is
 *      why every storage touch is individually guarded rather than probed once:
 *      Safari with cookies blocked throws on ACCESS, and a private-mode
 *      `setItem` throws on quota while `getItem` works fine.
 *
 *   2. A RUSSIAN STRING IS NEVER REPLACED BY AN ENGLISH ONE. The fallback chain
 *      is active → ru → the key itself, never active → en. `core.js` already
 *      holds this rule for provider text — «an untranslated English string is
 *      never shown to a customer» — and it holds here for the same reason.
 *
 *   3. NOTHING FROM OUTSIDE INDEXES ANYTHING BEFORE IT IS VALIDATED. Both
 *      sources of a language — `localStorage` and Telegram's UNSIGNED
 *      `initDataUnsafe` — are attacker-writable in a hostile client and
 *      corruptible in an ordinary one. `dicts['__proto__']` returns an object
 *      rather than `undefined`, so the allowlist check comes first, every time,
 *      and the value is never used as a path, a URL, an attribute name or
 *      markup.
 * ========================================================================= */

(function (root) {
  /** The only two strings that are ever a language. Compared by equality. */
  const LANGS = ['ru', 'en'];

  /**
   * Russian, when we do not know.
   *
   * NOT English. An absent `language_code` is not a statement that the customer
   * reads English — it is the absence of a statement, and it is common: the
   * field is optional on Telegram's `WebAppUser`, `initDataUnsafe` is `{}` in a
   * plain browser tab, and some launch contexts carry no `user` at all. This
   * shop's storefront, purchase email, support bot and channel are Russian, so
   * the absence of information resolves to Russian. English is chosen only when
   * Telegram positively states a language that is not Russian.
   */
  const DEFAULT_LANG = 'ru';

  /**
   * The manual choice, in `localStorage` rather than `sessionStorage`.
   *
   * The app keeps everything else in `sessionStorage` (`ui.js`) and the bearer
   * in memory only (`core.js`) — a token on disk is a token that outlives the
   * session that earned it. A language is neither a credential nor session
   * state: the requirement is that it survives closing the app, which is the
   * one thing `sessionStorage` cannot do.
   */
  const STORAGE_KEY = 'mesim.lang';

  /**
   * The attributes a translation may write, enforced HERE rather than by
   * convention in the markup.
   *
   * All four are rendered as text by the browser and read back by nothing in
   * this app. What is kept out matters more: `on*` is script (blocked by our
   * CSP today, one `'unsafe-inline'` away from live), `href`/`src` accept
   * `javascript:`, `id`/`for` clobber the DOM — and `notify-${key}` ids are
   * built from identifiers a few lines from a POST body — `data-*` is read
   * back as real input elsewhere in this app (`data-method` becomes the
   * payment type), and `style` is the one attribute our CSP deliberately does
   * NOT cover, because `el()` writes it through `cssText` on purpose.
   */
  const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];

  /**
   * Month names for the English date, kept here rather than in the dictionary.
   *
   * They are format data, not copy: nobody edits them for tone, and putting
   * twelve of them in a customer-facing dictionary would mean twelve keys whose
   * Russian column is never read (the Russian format is numeric).
   */
  const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** Exactly `'ru'` or `'en'`, or null. No trimming, no case folding, no prefix. */
  function known(value) {
    return LANGS.indexOf(value) >= 0 ? value : null;
  }

  /**
   * The primary subtag of an IETF language tag, lowercased.
   *
   * `language_code` is an IETF tag — `ru`, `ru-RU`, `en-GB`, `pt-br`, `zh-hans`
   * — so the question "is this Russian" is a question about the PRIMARY SUBTAG
   * and not about a prefix. `startsWith('ru')` would also claim `rue` (Rusyn)
   * and `rup` (Aromanian), which are real primary subtags for languages that
   * are not Russian. Same cost, no false-positive class.
   */
  function primarySubtag(tag) {
    return String(tag == null ? '' : tag).toLowerCase().split(/[-_]/)[0];
  }

  /**
   * A `localStorage`-shaped object that can be relied on to answer, or null.
   *
   * Not a one-shot probe. `ui.js` probes `sessionStorage` once at start-up and
   * that is right for its purpose, but a single successful probe does not prove
   * a later write will succeed: `localStorage` in a Telegram Web iframe is
   * third-party storage, and quota is reached at write time, not at read time.
   * So this only checks that the OBJECT can be reached — every call is guarded
   * again at its own call site.
   */
  function defaultStorage(win) {
    try {
      const s = win && win.localStorage;
      if (!s || typeof s.getItem !== 'function') return null;

      return s;
    } catch {
      // Access itself throws in Safari with cross-site tracking prevention and
      // in Firefox with storage partitioning — both of which are how this app
      // runs on Telegram Web, where it lives in a cross-origin iframe.
      return null;
    }
  }

  function createI18n(deps) {
    const options = deps || {};
    const win = typeof window !== 'undefined' ? window : undefined;
    const dicts = options.dicts || (root && root.MagicLocales) || { ru: {}, en: {} };
    const storage = options.storage === undefined ? defaultStorage(win) : options.storage;
    const telegram = options.telegram === undefined
      ? (win && win.Telegram ? win.Telegram : null)
      : options.telegram;
    const onMiss = typeof options.onMiss === 'function' ? options.onMiss : null;

    const misses = [];
    const listeners = [];

    /* ---- the two sources of a language ------------------------------- */

    /**
     * What the customer chose here, previously.
     *
     * An unrecognised value is DELETED rather than ignored. Ignoring it leaves
     * a value that will be re-read and re-rejected on every launch forever,
     * and — worse — makes "the customer chose nothing" and "the customer chose
     * something we no longer support" indistinguishable to everything above.
     */
    function stored() {
      if (!storage) return null;

      let raw = null;
      try { raw = storage.getItem(STORAGE_KEY); } catch { return null; }
      if (raw === null || raw === undefined) return null;

      const valid = known(raw);
      if (valid) return valid;

      try { storage.removeItem(STORAGE_KEY); } catch { /* nothing to do */ }

      return null;
    }

    /**
     * What Telegram says the customer's client is set to.
     *
     * `initDataUnsafe` is unsigned and its `user` may be absent entirely, so
     * this copies the defensive shape `startParam()` already uses in `ui.js`.
     * The value decides which dictionary is shown and nothing else — it is
     * never sent, never stored, and never part of any key. An attacker who
     * lies here changes the language of their own screen, which they could
     * also do by tapping the switcher.
     */
    function fromTelegram() {
      let code = '';
      try {
        const app = telegram && telegram.WebApp;
        const user = app && app.initDataUnsafe && app.initDataUnsafe.user;
        code = user && user.language_code ? String(user.language_code) : '';
      } catch {
        return null;
      }

      if (!code.trim()) return null;

      return primarySubtag(code) === 'ru' ? 'ru' : 'en';
    }

    /** Manual choice, then Telegram's statement, then Russian. */
    function detect() {
      return stored() || fromTelegram() || DEFAULT_LANG;
    }

    let current = detect();

    /* ---- lookup ------------------------------------------------------ */

    function miss(key) {
      misses.push(key);
      if (onMiss) {
        try { onMiss(key); } catch { /* a reporter must not break a render */ }
      }
    }

    /**
     * A translated string. Total: it returns a string for any input at all,
     * because `apply()` hands it whatever a `data-i18n` attribute contained.
     */
    function t(key, vars) {
      if (typeof key !== 'string' || key === '') return '';

      const active = dicts[current];
      const fallback = dicts.ru;

      let value;
      if (active && Object.prototype.hasOwnProperty.call(active, key)) value = active[key];
      else if (fallback && Object.prototype.hasOwnProperty.call(fallback, key)) value = fallback[key];

      // An object value is the reserved plural shape, which nothing selects
      // from yet. Rendering it would print "[object Object]" to a customer, so
      // it is a miss until `t()` learns to choose a form.
      if (typeof value !== 'string') {
        miss(key);

        return key;
      }

      if (!vars) return value;

      // A FUNCTION replacer, not a string one. `String.prototype.replace` with
      // a string replacement expands `$&`, `$1`, `` $` `` and `$'` — so a value
      // that happened to contain them would corrupt the sentence around it.
      // A placeholder with no value is left standing rather than rendered as
      // the word "undefined".
      return value.replace(/\{(\w+)\}/g, (whole, name) => (
        Object.prototype.hasOwnProperty.call(vars, name) && vars[name] !== undefined && vars[name] !== null
          ? String(vars[name])
          : whole
      ));
    }

    /* ---- dates ------------------------------------------------------- */

    /**
     * A date a customer reads, built by hand rather than by `toLocaleDateString`.
     *
     * Two reasons, both of which have produced wrong output on this project's
     * own machines. `toLocaleDateString('en', …)` resolves to en-US and returns
     * "Aug 19, 2026", not the "19 Aug 2026" it was asked for; and any
     * `toLocale*` output is a contract with whatever ICU the WebView shipped,
     * which differs across iOS, Android and Desktop Telegram. Hand-rolling
     * makes both languages deterministic and makes the test that pins them
     * mean something.
     *
     * The parts are LOCAL, not UTC, because that is what
     * `toLocaleDateString('ru-RU')` did here before there were two languages —
     * and Russian output must not move.
     */
    function formatDate(value) {
      if (value === null || value === undefined || value === '') return '';

      const date = value instanceof Date ? value : new Date(value);
      const time = date.getTime();
      if (!Number.isFinite(time)) return '';

      const day = date.getDate();
      const month = date.getMonth();
      const year = date.getFullYear();

      if (current === 'en') return `${day} ${EN_MONTHS[month]} ${year}`;

      const dd = String(day).padStart(2, '0');
      const mm = String(month + 1).padStart(2, '0');

      return `${dd}.${mm}.${year}`;
    }

    /* ---- changing it ------------------------------------------------- */

    function lang() { return current; }

    /**
     * Choose a language.
     *
     * Refuses one it has no dictionary for — a picker can only offer what
     * exists, and the API must hold the same rule the interface does. A choice
     * that is already in force is a no-op and fires nothing: `onChange`
     * re-renders the open screen, and a spurious fire re-enters that render.
     *
     * The write is best-effort. A storage that refuses does not stop the
     * language from changing — "it changes but does not stick" is a bad day;
     * "it throws" is a broken app.
     */
    function setLang(next) {
      const valid = known(next);
      if (!valid || !dicts[valid]) return current;
      if (valid === current) return current;

      current = valid;

      if (storage) {
        try { storage.setItem(STORAGE_KEY, valid); } catch { /* best effort */ }
      }

      for (const fn of listeners.slice()) {
        try { fn(valid); } catch { /* one bad listener must not stop the rest */ }
      }

      return current;
    }

    function onChange(fn) {
      if (typeof fn !== 'function') return () => {};
      listeners.push(fn);

      return () => {
        const at = listeners.indexOf(fn);
        if (at >= 0) listeners.splice(at, 1);
      };
    }

    /* ---- the static markup ------------------------------------------- */

    /**
     * Translate the shell.
     *
     * Text, never markup — the same rule `el()` holds for every other string
     * in this app. The names of the markup-assigning sinks are deliberately
     * absent from this file, comments included, so that the test forbidding
     * them can be a plain search over the source; that is why this sentence is
     * phrased the long way round. Attributes go through the allowlist above, and
     * a name outside it is skipped rather than trusted, so a dictionary can
     * never widen what it is allowed to write.
     *
     * Deliberately registers NO `DOMContentLoaded` listener of its own. `boot()`
     * calls this, so the order is stated in one place instead of depending on
     * which script's listener happened to be registered first — and the same
     * call site serves a language change.
     */
    function apply(target) {
      const scope = target || (typeof document !== 'undefined' ? document : null);
      if (!scope || typeof scope.querySelectorAll !== 'function') return;

      for (const node of scope.querySelectorAll('[data-i18n]')) {
        node.textContent = t(node.getAttribute('data-i18n'));
      }

      for (const attr of ATTRS) {
        for (const node of scope.querySelectorAll(`[data-i18n-${attr}]`)) {
          node.setAttribute(attr, t(node.getAttribute(`data-i18n-${attr}`)));
        }
      }

      // Screen readers pick their voice from this. The literal in the markup
      // stays `ru` — `seo/validate-seo.mjs` requires it — and this moves it at
      // runtime, which is the only moment the answer can actually be known.
      try {
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.lang = current;
        }
      } catch { /* not a DOM we can touch */ }
    }

    return {
      lang, setLang, t, onChange, apply, formatDate, detect,
      misses,
      LANGS: LANGS.slice(),
      STORAGE_KEY,
      ATTRS: ATTRS.slice(),
    };
  }

  const I18N = createI18n();
  I18N.create = createI18n;

  if (typeof module === 'object' && module.exports) module.exports = I18N;
  root.MagicI18n = I18N;
}(typeof window !== 'undefined' ? window : globalThis));
