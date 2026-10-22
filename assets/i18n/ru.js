/* =====================================================================
 * assets/i18n/ru.js — the storefront's Russian interface words (I18N-10).
 * ---------------------------------------------------------------------
 * One file per language: a page loads only its own language's words, inside the
 * bundle /assets/site-i18n-<prefix>.js that seo/site-i18n-bundle.mjs builds from
 * this file and the engine (assets/site-i18n.js). Never load this file on a page
 * by itself, and never edit a bundle: edit here, then run the locale build.
 *
 * Node (generators, tests, the localization-qa skill) reads it through the engine:
 * require('assets/site-i18n.js').DICT.ru.
 * The Russian words. No Russian page loads a site-i18n bundle (the Russian pages are written in Russian and
 * stay so): this table is the mirror seo/test-site-i18n.mjs holds VERBATIM to index.html, and the Node-side
 * fallback of the engine (active → ru → the key).
 * ================================================================== */
(function (root) {
  'use strict';
  var WORDS = {
    'nav.destinations': 'Направления',
    'nav.how': 'Как это работает',
    'nav.tariffs': 'Тарифы',
    'nav.guides': 'Инструкции',

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
  };
  if (typeof module === 'object' && module.exports) module.exports = WORDS;
  else (root.MagicSiteWords = root.MagicSiteWords || {})['ru'] = WORDS;
})(typeof window !== 'undefined' ? window : globalThis);
