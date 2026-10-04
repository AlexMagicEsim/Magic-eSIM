/* =====================================================================
 * site-i18n — the storefront's words, in the two languages it speaks.
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

  /** The only two strings that are ever a language. Compared by equality. */
  var LANGS = ['ru', 'en'];

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

  /* Frozen, and frozen DEEP. `LANGS` was defensively copied on the way out two
   * lines below while the dictionary itself was handed over by reference — a
   * caller could have rewritten a price note or a refusal message at runtime.
   * There is no reason for anything to write here. */
  var DICT = {
    ru: {
      'nav.destinations': 'Направления',
      'nav.how': 'Как работает',
      'nav.benefits': 'Преимущества',
      'nav.tariffs': 'Тарифы',
      'nav.guides': 'Инструкции',
      'nav.cta': 'Выбрать тариф',

      'checkout.title': 'Оформление заказа',
      'checkout.plan': 'eSIM-тариф',
      'checkout.coverage': 'Покрытие',
      'checkout.data': 'Интернет',
      'checkout.term': 'Срок',
      'checkout.price': 'Стоимость',
      'checkout.discount': 'Скидка по промокоду',
      'checkout.total': 'Итого',
      'checkout.close': 'Закрыть',
      'checkout.method': 'Способ оплаты',
      'checkout.sbp': 'СБП',
      'checkout.card': 'Российская карта',
      'checkout.promo': 'Промокод',
      'checkout.promoApply': 'Применить',
      'checkout.promoRemove': 'Удалить',
      'checkout.email': 'Email для получения eSIM',
      'checkout.paySbp': 'Оплатить по СБП',
      'checkout.note': 'Оплата через Platega: СБП или российская банковская карта. Данные eSIM придут на указанный email.'
    },

    en: {
      'nav.destinations': 'Destinations',
      'nav.how': 'How it works',
      'nav.benefits': 'Why Magic eSIM',
      'nav.tariffs': 'Plans',
      'nav.guides': 'Guides',
      'nav.cta': 'Choose a plan',

      'checkout.title': 'Checkout',
      'checkout.plan': 'eSIM plan',
      'checkout.coverage': 'Coverage',
      'checkout.data': 'Data',
      'checkout.term': 'Validity',
      'checkout.price': 'Price',
      'checkout.discount': 'Promo discount',
      'checkout.total': 'Total',
      'checkout.close': 'Close',
      'checkout.method': 'Payment method',
      'checkout.promo': 'Promo code',
      'checkout.promoApply': 'Apply',
      'checkout.promoRemove': 'Remove',
      'checkout.email': 'Email for your eSIM',
      'checkout.continue': 'Continue',

      /* ---- the international page's own words ---------------------------
       * These have no Russian twin on purpose: they describe a state the
       * Russian storefront is not in. The mirror test only walks `ru`, so a
       * key that exists in `en` alone is expected rather than a gap.
       * ------------------------------------------------------------------ */
      'site.tagline': 'Mobile data abroad, without roaming charges',
      'site.lead': 'Pick a destination, install an eSIM, land connected. No plastic SIM, no queue at the airport.',
      'site.chooseCountry': 'Where are you going?',
      'site.searchPlaceholder': 'Country or region',
      'site.plansFor': 'Plans for',
      'site.noPlans': 'No plans for this destination yet.',
      'site.noDestination': 'No destination matches that name.',
      'site.allDestinations': 'All destinations',
      'site.unavailable': 'Temporarily unavailable',
      'site.loading': 'Loading plans…',
      'site.loadFailed': 'Could not load the plans. Please try again.',
      'site.pricesUnavailable': 'Prices are temporarily unavailable. Please check back soon — nothing can be ordered here yet.',
      'site.retry': 'Try again',
      'site.choose': 'View details',
      'nav.compat': 'Device check',
      'how.title': 'How it works',
      'how.step1': 'Pick your destination and a data plan.',
      'how.step2': 'Check your phone supports eSIM and is not carrier-locked.',
      'how.step3': 'Install the eSIM profile before you fly.',
      'how.step4': 'Land, switch it on, and you are online.',
      'footer.terms': 'Terms (in Russian)',
      'footer.privacy': 'Privacy (in Russian)',
      'site.compatTitle': 'Will my phone work?',
      'site.compatBody': 'Your phone needs eSIM support and must not be carrier-locked. Most phones released after 2019 qualify.',
      'site.compatCheck': 'iPhone setup',
      'site.compatGuide': 'How to check your phone',
      'site.compatAndroid': 'Android setup',

      /* Prices. The GLOBAL lane's own US-dollar figures (assets/global-catalog.js),
       * never the Russian rouble prices converted or relabelled. */
      'price.currencyNote': 'Prices in US dollars (USD). These plans can\'t be bought on this page yet.',

      /* Said BEFORE anything looks purchasable: above the search, in the static
       * HTML, so a visitor learns it before a price, a button or a form — not
       * after typing an email into a checkout that cannot take money. */
      'preview.noticeTitle': 'Online payment isn\'t available yet — plans can\'t be bought here yet',
      'preview.noticeBody': 'You can browse plans, get an exact price in US dollars and go through checkout, but payment can\'t be taken yet: nothing is charged, and no order or eSIM is created.',
      'preview.title': 'Plan details',
      'preview.price': 'Price',

      /* Shown as soon as a plan is opened. There is no international provider
       * and no checkout behind it, so the plan window asks for nothing. */
      'pay.unavailableTitle': 'Online payment is not available yet',
      'pay.unavailableBody': 'You can check a plan and get its exact price, but payment can\'t be taken yet. Nothing is charged, and no order or eSIM is created.',
      'pay.finalTitle': 'Online payment is not available yet',
      'pay.finalBody': 'We can\'t take payment yet, so nothing has been charged, no order has been created and no eSIM will be sent. Your email has not been sent or saved.',
      'pay.disabled': 'Payment not available yet',
      'checkout.duration': 'Duration',
      'checkout.listed': 'Listed price',
      'checkout.emailShort': 'Email',
      'checkout.emailNote': 'Not sent or saved anywhere yet — payment isn\'t available.',
      'checkout.emailInvalid': 'Please enter a valid email address.',
      'checkout.device': 'My phone supports eSIM and isn\'t carrier-locked',
      'checkout.deviceRequired': 'Please confirm your phone supports eSIM.',
      'checkout.review': 'Review',
      'checkout.back': 'Back',
      'quote.explain': 'The exact price is fixed by our server and held for 30 minutes.',
      'quote.get': 'Get the exact price',
      'quote.again': 'Get a new price',
      'quote.loading': 'Getting the price…',
      'quote.heldFor': 'Price held for',
      'quote.expired': 'This price has expired. Get a new price to continue.',
      'quote.changed': 'The price has been updated since the list was loaded.',
      'quote.unavailable': 'The price is temporarily unavailable. Please try again later.',
      'quote.busy': 'Too many requests. Please wait a minute and try again.',
      'quote.gone': 'This plan is no longer available. Please choose another one.',
      'quote.offline': 'Could not reach the server. Check your connection and try again.',

      'lang.ru': 'Русский',
      'lang.en': 'English',
      'lang.switchToRu': 'Перейти на русскую версию'
    }
  };

  Object.freeze(DICT.ru);
  Object.freeze(DICT.en);
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
    function t(key) {
      var k = String(key == null ? '' : key);
      var d = DICT[active];
      if (d && Object.prototype.hasOwnProperty.call(d, k)) return String(d[k]);
      var ru = DICT[DEFAULT_LANG];
      if (ru && Object.prototype.hasOwnProperty.call(ru, k)) return String(ru[k]);
      return k;
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
      apply: apply,
      setLang: setLang,
      lang: function () { return active; },
      LANGS: LANGS.slice()
    };
  }

  var api = {
    createI18n: createI18n,
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
