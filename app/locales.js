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
  };

  const LOCALES = { ru: ru, en: en };

  if (typeof module === 'object' && module.exports) module.exports = LOCALES;
  root.MagicLocales = LOCALES;
}(typeof window !== 'undefined' ? window : globalThis));
