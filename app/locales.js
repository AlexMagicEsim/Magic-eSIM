'use strict';

/* ============================================================================
 * Magic eSIM Mini App — the two dictionaries.
 *
 * ONE file, not one per language. Two files would be two requests on a
 * `max-age=600` Pages origin and, worse, a partial state nobody would think to
 * handle: `en.js` arrives, `ru.js` does not, and the fallback chain has no
 * Russian to fall back to. Both dictionaries are small and both are always
 * needed — English falls back to Russian by design.
 *
 * WRAPPED IN AN IIFE, and that is not decoration. `app/core.js` is a classic
 * script with TOP-LEVEL declarations — `countryNames`, `PROMO_MESSAGES`,
 * `REGION_NAMES`, `plural`, `CORE` and a dozen more all live in the shared
 * global lexical scope. A top-level `const` here that collided with any of them
 * would be a SyntaxError, the colliding script would never parse, and if that
 * script were core.js then `window.MagicCore` is never set, `app/ui.js` reads
 * `undefined` on its first line, and the Mini App is a blank screen. The
 * convention copied here is the one `assets/daily-plan-copy.js` already uses.
 *
 * THE VALUE SHAPE, decided now while it is free.
 *
 *   A value is a string today. It MAY become `{one, few, many, other}` when a
 *   plural arrives, and `t(key, vars)` will select a form from `vars.count`.
 *   That decision is recorded here rather than deferred because deferring the
 *   SHAPE — as opposed to deferring the plural code — would later force either
 *   a change to `t()`'s signature at every call site, or a second function
 *   saying the same thing a different way. Russian needs three forms and
 *   English two; `core.js` already has the Russian selector (`plural`).
 *
 * WHAT DOES NOT BELONG HERE: anything a machine reads. Country names are
 * generated into `core.js` from `seo/country-names.mjs` and have no English
 * column yet; provider, operator and network names are the vendor's and are
 * never translated; `low_data` / `expiry` / `sbp` / `card` are identifiers that
 * happen to be readable, and translating one would change what we send.
 * ========================================================================= */

(function (root) {
  /* --------------------------------------------------------------------- *
   * Shared chrome.
   *
   * These four render INSIDE the settings screen — the retry on a failed load,
   * and the dialog that confirms disconnecting an address — but they are built
   * by helpers shared with six other screens. They are in Phase 1 because the
   * alternative is a confirmation dialog whose title and cancel button are
   * Russian around an English question, which is the same lie as an untrue
   * control, just in a smaller box.
   * --------------------------------------------------------------------- */
  const ru = {
    'common.retry': 'Повторить',
    'common.confirmTitle': 'Подтвердите',
    'common.continue': 'Продолжить',
    'common.cancel': 'Отмена',

    'settings.title': 'Настройки',
    'settings.loadFailed': 'Не удалось загрузить настройки.',

    // The language block. `settings.language.ru` and `.en` are ENDONYMS — each
    // written in its own language — so both labels are identical in both
    // dictionaries and the control never relabels itself when it is used.
    // Calling them «Русский»/«Английский» in one language and "Russian"/
    // "English" in the other would make the control rewrite itself under the
    // finger that just tapped it.
    'settings.language.section': 'Язык',
    'settings.language.ru': 'Русский',
    'settings.language.en': 'English',
    // The second sentence is what keeps this control honest while the rest of
    // the app is still Russian. Delete it when it stops being true, and not
    // before: a switch that claims to change the app and changes one screen is
    // exactly the control `renderSettings`' own comment forbids.
    'settings.language.hint': 'Меняет язык приложения. Часть экранов пока только на русском.',

    'settings.email.section': 'Почта',
    'settings.email.none': 'Подтверждённых адресов нет. Подключите почту, чтобы покупки с сайта появились здесь.',
    'settings.email.add': 'Добавить покупки с сайта',
    'settings.email.have': 'Покупки с сайта на эти адреса появляются в «Мои eSIM» автоматически.',
    'settings.email.verifiedAt': 'подтверждён {date}',
    // A SEPARATE key from `verifiedAt`, not a shortening of it: merging them
    // would render the literal «подтверждён {date}» when a date is missing.
    'settings.email.verified': 'подтверждён',
    'settings.email.disconnect': 'Отключить',
    'settings.email.disconnectConfirm': 'Отключить этот адрес? Покупки, которые уже добавлены, останутся — новые с этого адреса просто перестанут появляться сами.',
    // Also separate from `settings.email.disconnect`, even though the Russian
    // bytes match. They are two different controls — a row action and a
    // dialog's confirm — and English may well want them to differ.
    'settings.email.disconnectAction': 'Отключить',
    'settings.email.disconnectFailed': 'Не удалось отключить. Попробуйте ещё раз.',

    'settings.notify.section': 'Уведомления',
    'settings.notify.lowData.title': 'Интернет заканчивается',
    'settings.notify.lowData.hint': 'При остатке 20% и 10%',
    'settings.notify.expiry.title': 'Срок действия истекает',
    'settings.notify.expiry.hint': 'За 3 дня и за сутки',
    'settings.notify.note': 'Приходят в этот чат. Данные eSIM и чек — на почту, указанную при покупке. Рекламных рассылок мы не отправляем.',
    'settings.notify.saveFailed': 'Не удалось сохранить. Попробуйте ещё раз.',

    'settings.account.section': 'Аккаунт',
    'settings.account.since': 'Вы с нами с',
    'settings.account.orders': 'Покупок',
    'settings.account.esims': 'eSIM',

    /* ------------------------------------------------------------------ *
     * What to say when a request failed.
     *
     * ONLY the sentences addressed by a LITERAL key live here. The ones the
     * server picks by CODE do not: a code is data, `t()` would have to be
     * called with a computed key, and this project forbids that outright —
     * a computed key is invisible to the scanner that proves every key is
     * used, and the scanner's failure mode is somebody deleting a live key to
     * make it green. Those sentences live in SERVER_ERRORS in core.js, beside
     * PROMO_MESSAGES, which is where the Russian ones already were.
     *
     * The Russian values below are byte-identical to the fallbacks that ship
     * today, so adding English cannot move a single Russian pixel.
     * ------------------------------------------------------------------ */
    /* The shell: screens, tabs and the copy that ships in index.html. */
    'nav.sections': 'Разделы',
    'nav.home': 'Главная',
    'nav.buy': 'Купить',
    'nav.esims': 'Мои eSIM',
    'nav.help': 'Помощь',
    'home.aria': 'Каталог',
    'home.title': 'Интернет в поездке',
    'home.payNote': 'Цены в рублях. Оплата картой или через СБП.',
    'search.placeholder': 'Куда едете?',
    'search.aria': 'Поиск страны',
    'country.aria': 'Тарифы страны',
    'country.title': 'Тарифы',
    'tariff.aria': 'Тариф',
    'claim.aria': 'Покупки с сайта',
    'claim.title': 'Покупки с сайта',
    'help.aria': 'Помощь',
    'help.title': 'Помощь',
    'checkout.aria': 'Оформление',
    'checkout.title': 'Оформление',
    'checkout.emailTitle': 'E-mail для eSIM',
    'checkout.emailNote': 'Отправим QR-код и данные установки на этот адрес.',
    'checkout.method': 'Способ оплаты',
    'checkout.sbp': 'СБП',
    'checkout.card': 'Карта',
    'checkout.pay': 'Оплатить',
    'checkout.payNote': 'Оплата откроется в браузере. После оплаты вернитесь в Telegram — eSIM появится в «Мои eSIM».',
    'esims.aria': 'Мои eSIM',
    'esims.title': 'Мои eSIM',
    'install.aria': 'Установка',
    'install.title': 'Установка',
    'order.aria': 'Статус заказа',
    'order.checking': 'Проверяем оплату',
    'topup.aria': 'Статус пополнения',
    'topup.title': 'Пополнение',
    'error.aria': 'Ошибка',
    'loading.aria': 'Загрузка',
    'loading.text': 'Подключаемся…',

    'esim.validUntil': 'Действует до {date}',

    'errors.promoFallback': 'Не удалось применить промокод.',

    'errors.topupTransport': 'Связь прервалась. Повторите — лишнего пополнения не создастся.',
    'errors.topupFallback': 'Не удалось начать пополнение.',

    'errors.orderFallback': 'Не удалось создать заказ.',
    'errors.codeCheckFallback': 'Не удалось проверить код. Попробуйте ещё раз.',
    'errors.renameFallback': 'Не удалось сохранить название.',
    'errors.loginFallback': 'Telegram не подтвердил вход. Откройте приложение заново из бота.',
  };

  const en = {
    'common.retry': 'Retry',
    'common.confirmTitle': 'Confirm',
    'common.continue': 'Continue',
    'common.cancel': 'Cancel',

    'settings.title': 'Settings',
    'settings.loadFailed': 'Couldn’t load settings.',

    'settings.language.section': 'Language',
    'settings.language.ru': 'Русский',
    'settings.language.en': 'English',
    'settings.language.hint': 'Changes the app language. Some screens are still Russian only.',

    'settings.email.section': 'Email',
    'settings.email.none': 'No confirmed addresses yet. Connect your email so website purchases show up here.',
    'settings.email.add': 'Add website purchases',
    // Deliberately does NOT name the «Мои eSIM» tab the way the Russian does:
    // the tab bar is not translated in Phase 1, so an English sentence naming
    // an English tab would point at a label that is not on the screen.
    'settings.email.have': 'Website purchases to these addresses are added automatically.',
    'settings.email.verifiedAt': 'verified {date}',
    'settings.email.verified': 'verified',
    'settings.email.disconnect': 'Disconnect',
    'settings.email.disconnectConfirm': 'Disconnect this address? Purchases already added will stay — new ones from this address just won’t appear by themselves.',
    'settings.email.disconnectAction': 'Disconnect',
    'settings.email.disconnectFailed': 'Couldn’t disconnect. Please try again.',

    'settings.notify.section': 'Notifications',
    'settings.notify.lowData.title': 'Data is running out',
    'settings.notify.lowData.hint': 'At 20% and 10% left',
    'settings.notify.expiry.title': 'Plan is expiring',
    'settings.notify.expiry.hint': '3 days and 1 day before',
    'settings.notify.note': 'These arrive in this chat. eSIM details and the receipt go to the email you gave at checkout. We don’t send marketing.',
    'settings.notify.saveFailed': 'Couldn’t save. Please try again.',

    'settings.account.section': 'Account',
    'settings.account.since': 'With us since',
    'settings.account.orders': 'Purchases',
    // Plural on purpose: an English row labelled "eSIM" beside a number reads
    // as a heading rather than a count.
    'settings.account.esims': 'eSIMs',


    'nav.sections': 'Sections',
    'nav.home': 'Home',
    'nav.buy': 'Buy',
    'nav.esims': 'My eSIMs',
    'nav.help': 'Help',
    'home.aria': 'Catalogue',
    'home.title': 'Internet while you travel',
    'home.payNote': 'Prices are in roubles. Pay by card or via SBP.',
    'search.placeholder': 'Where are you going?',
    'search.aria': 'Search for a country',
    'country.aria': 'Plans for this country',
    'country.title': 'Plans',
    'tariff.aria': 'Plan',
    'claim.aria': 'Website purchases',
    'claim.title': 'Website purchases',
    'help.aria': 'Help',
    'help.title': 'Help',
    'checkout.aria': 'Checkout',
    'checkout.title': 'Checkout',
    'checkout.emailTitle': 'Email for your eSIM',
    'checkout.emailNote': 'We’ll send the QR code and setup details to this address.',
    'checkout.method': 'Payment method',
    'checkout.sbp': 'SBP',
    'checkout.card': 'Card',
    'checkout.pay': 'Pay',
    'checkout.payNote': 'Payment opens in your browser. Come back to Telegram afterwards — your eSIM will appear under My eSIMs.',
    'esims.aria': 'My eSIMs',
    'esims.title': 'My eSIMs',
    'install.aria': 'Setup',
    'install.title': 'Setup',
    'order.aria': 'Order status',
    'order.checking': 'Checking your payment',
    'topup.aria': 'Top-up status',
    'topup.title': 'Top-up',
    'error.aria': 'Error',
    'loading.aria': 'Loading',
    'loading.text': 'Connecting…',

    'esim.validUntil': 'Valid until {date}',

    'errors.promoFallback': 'Couldn’t apply the promo code.',

    // Says the same reassuring thing the Russian does: a dropped connection is
    // not a second charge. That promise is the point of the sentence.
    'errors.topupTransport': 'The connection dropped. Try again — this won’t create a duplicate top-up.',
    'errors.topupFallback': 'Couldn’t start the top-up.',

    'errors.orderFallback': 'Couldn’t create the order.',
    'errors.codeCheckFallback': 'Couldn’t check the code. Please try again.',
    'errors.renameFallback': 'Couldn’t save the name.',
    'errors.loginFallback': 'Telegram didn’t confirm the sign-in. Please reopen the app from the bot.',
  };

  const LOCALES = { ru: ru, en: en };

  if (typeof module === 'object' && module.exports) module.exports = LOCALES;
  root.MagicLocales = LOCALES;
}(typeof window !== 'undefined' ? window : globalThis));
