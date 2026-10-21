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
  var LANGS = ['ru', 'en', 'es'];

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
    },

    en: {
      'nav.destinations': 'Destinations',
      'nav.how': 'How it works',
      'nav.tariffs': 'Plans',
      'nav.guides': 'Guides',

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
      'quote.heldFor': 'Price held for {time}',
      'quote.expired': 'This price has expired. Get a new price to continue.',
      'quote.fixed': 'The price is fixed: {price}.',
      'quote.changed': 'The price has been updated since the list was loaded.',
      'quote.unavailable': 'The price is temporarily unavailable. Please try again later.',
      'quote.busy': 'Too many requests. Please wait a minute and try again.',
      'quote.gone': 'This plan is no longer available. Please choose another one.',
      'quote.offline': 'Could not reach the server. Check your connection and try again.',

      'lang.ru': 'Русский',
      'lang.en': 'English',
      'lang.switchToRu': 'Перейти на русскую версию',
      // The GLOBAL storefront's chrome and home (2026-10 redesign). English
      // only: the Russian landing does not load this file's English half.
      'nav.findPlan': 'Find a plan',
      'preview.more': 'What this means',
      'footer.about': 'Travel eSIM data plans for 190+ destinations, with prices in US dollars.',
      'footer.help': 'Help',
      'home.eyebrow': 'Travel eSIM for 190+ destinations',
      'home.h1a': 'Mobile data abroad,',
      'home.h1b': 'without roaming charges',
      'home.searchPlaceholder': 'Where are you going?',
      'home.find': 'Find plans',
      'home.popularShort': 'Popular:',
      'home.fact1': 'Prices in US dollars',
      'home.fact2': 'Install by QR code',
      'home.fact3': 'Country, regional and daily plans',
      'home.popularTitle': 'Popular destinations',
      'home.popularLead': 'Choose a country to see its plans, with prices in US dollars.',
      'home.viewPlans': 'View plans',
      'home.howKicker': 'Getting started',
      'home.typesKicker': 'Plans',
      'home.typesTitle': 'Three kinds of plans',
      'home.typesLead': 'Every destination page groups its plans the same way, so you can compare like with like.',
      'home.typeLocalTitle': 'Plans for one country',
      'home.typeLocalBody': 'A set amount of data for one country, valid for a set number of days.',
      'home.typeRegionalTitle': 'Regional plans',
      'home.typeRegionalBody': 'One plan for several countries, for a trip that crosses borders. Each plan lists the countries it covers.',
      'home.typeDailyTitle': 'Data every day',
      'home.typeDailyBody': 'A data allowance for each day of the trip, rather than one amount for the whole stay.',
      'home.guidesTitle': 'Set up and fix your eSIM',
      'home.guidesLead': 'Install, check and fix a travel eSIM — step by step.',
      'home.supportTitle': 'Questions before you travel?',
      'home.supportBody': 'Write to our support team by email.',

      /* ---- words the browser scripts build at runtime (I18N-08b) ---------
       * en/plans.js, en/country.js, en/hub.js, en/checkout.js used to type
       * these inline. `{name}` is filled by t(key, vars); a key ending in
       * `.one` / `.other` is a plural, chosen by plural(base, n) with the
       * language's own Intl.PluralRules. The number format is data too: the
       * locale Intl formats a dollar amount with. */
      'fmt.numberLocale': 'en-US',
      'fmt.listSeparator': ', ',
      'plan.badgeLocal': 'Local plan',
      'plan.badgeRegional': 'Regional plan',
      'plan.badgeDaily': 'Daily plan',
      'plan.daysLegend': 'Days',
      'plan.gb': '{n} GB',
      'plan.dayCount.one': '{n} day',
      'plan.dayCount.other': '{n} days',
      'plan.country.one': 'country',
      'plan.country.other': 'countries',
      'plan.coverageIncl': '{n} {countries}, incl. {name}',
      'plan.coveragePlus': '{name} + {n} {countries}',
      'plan.alsoCovers': 'Also covers {names}',
      'plan.alsoCoversMore': 'Also covers {names} + {n} more',
      'plan.networks': '{n} networks',
      'plan.ip': 'IP: {names}',
      'plan.showAll': 'Show all {n} plans',
      'plan.showFewer': 'Show fewer plans',
      'hub.noMatches': 'No matches',
      'hub.matches.one': '{n} destination match',
      'hub.matches.other': '{n} destinations match'
    },
    /* Neutral international Spanish (owner, D1), I18N ES-1 2026-10-21: every English key, no more — the lookup falls
     * back to RUSSIAN for a missing key, so seo/test-es-site.mjs holds the two key sets equal. Prices are written
     * the Latin-American way the owner chose (D2): «USD 12.99» (fmt.numberLocale es-419). An AI-assisted draft, held
     * to the English facts and to seo/claim-guards.mjs; a native review is part of publishing. */
    es: {
      'nav.destinations': 'Destinos',
      'nav.how': 'Cómo funciona',
      'nav.tariffs': 'Planes',
      'nav.guides': 'Guías',
      'checkout.title': 'Finalizar compra',
      'checkout.plan': 'Plan eSIM',
      'checkout.coverage': 'Cobertura',
      'checkout.data': 'Datos',
      'checkout.term': 'Validez',
      'checkout.price': 'Precio',
      'checkout.discount': 'Descuento por código promocional',
      'checkout.total': 'Total',
      'checkout.close': 'Cerrar',
      'checkout.method': 'Método de pago',
      'checkout.promo': 'Código promocional',
      'checkout.promoApply': 'Aplicar',
      'checkout.promoRemove': 'Quitar',
      'checkout.email': 'Correo electrónico para tu eSIM',
      'checkout.continue': 'Continuar',
      'site.tagline': 'Datos móviles en el extranjero, sin cargos de roaming',
      'site.lead': 'Elige un destino, instala una eSIM y conéctate al aterrizar. Sin SIM física y sin esperas en el aeropuerto.',
      'site.chooseCountry': '¿A dónde viajas?',
      'site.searchPlaceholder': 'País o región',
      'site.plansFor': 'Planes para',
      'site.noPlans': 'Todavía no hay planes para este destino.',
      'site.noDestination': 'Ningún destino coincide con ese nombre.',
      'site.allDestinations': 'Todos los destinos',
      'site.unavailable': 'No disponible por el momento',
      'site.loading': 'Cargando planes…',
      'site.loadFailed': 'No se pudieron cargar los planes. Inténtalo de nuevo.',
      'site.pricesUnavailable': 'Los precios no están disponibles por el momento. Vuelve a intentarlo pronto; aquí todavía no se puede hacer ningún pedido.',
      'site.retry': 'Reintentar',
      'site.choose': 'Ver detalles',
      'nav.compat': 'Compatibilidad',
      'how.title': 'Cómo funciona',
      'how.step1': 'Elige tu destino y un plan de datos.',
      'how.step2': 'Comprueba que tu teléfono admite eSIM y está liberado.',
      'how.step3': 'Instala el perfil eSIM antes de volar.',
      'how.step4': 'Al aterrizar, actívala y ya tienes conexión.',
      'footer.terms': 'Términos (en ruso)',
      'footer.privacy': 'Privacidad (en ruso)',
      'site.compatTitle': '¿Funcionará mi teléfono?',
      'site.compatBody': 'Tu teléfono debe admitir eSIM y estar liberado (sin bloqueo de compañía). La mayoría de los teléfonos lanzados después de 2019 cumplen estos requisitos.',
      'site.compatCheck': 'Configurar en iPhone',
      'site.compatGuide': 'Cómo comprobar tu teléfono',
      'site.compatAndroid': 'Configurar en Android',
      'price.currencyNote': 'Precios en dólares estadounidenses (USD). Estos planes todavía no se pueden comprar en esta página.',
      'preview.noticeTitle': 'El pago en línea aún no está disponible: todavía no se pueden comprar planes aquí',
      'preview.noticeBody': 'Puedes ver los planes, obtener el precio exacto en dólares estadounidenses y completar los pasos del pedido, pero todavía no se puede cobrar: no se cobra nada y no se crea ningún pedido ni eSIM.',
      'preview.title': 'Detalles del plan',
      'preview.price': 'Precio',
      'pay.unavailableTitle': 'El pago en línea aún no está disponible',
      'pay.unavailableBody': 'Puedes revisar un plan y obtener su precio exacto, pero todavía no se puede cobrar. No se cobra nada y no se crea ningún pedido ni eSIM.',
      'pay.finalTitle': 'El pago en línea aún no está disponible',
      'pay.finalBody': 'Todavía no podemos cobrar, así que no se ha cobrado nada, no se ha creado ningún pedido y no se enviará ninguna eSIM. Tu correo no se ha enviado ni guardado.',
      'pay.disabled': 'Pago aún no disponible',
      'checkout.duration': 'Duración',
      'checkout.listed': 'Precio de lista',
      'checkout.emailShort': 'Correo electrónico',
      'checkout.emailNote': 'Todavía no se envía ni se guarda en ningún sitio: el pago no está disponible.',
      'checkout.emailInvalid': 'Escribe una dirección de correo válida.',
      'checkout.device': 'Mi teléfono admite eSIM y está liberado',
      'checkout.deviceRequired': 'Confirma que tu teléfono admite eSIM.',
      'checkout.review': 'Revisar',
      'checkout.back': 'Atrás',
      'quote.explain': 'Nuestro servidor fija el precio exacto y lo mantiene durante 30 minutos.',
      'quote.get': 'Obtener el precio exacto',
      'quote.again': 'Obtener un nuevo precio',
      'quote.loading': 'Obteniendo el precio…',
      'quote.heldFor': 'Precio reservado durante {time}',
      'quote.expired': 'Este precio ha caducado. Obtén un nuevo precio para continuar.',
      'quote.fixed': 'El precio está fijado: {price}.',
      'quote.changed': 'El precio se actualizó después de cargar la lista.',
      'quote.unavailable': 'El precio no está disponible por el momento. Inténtalo más tarde.',
      'quote.busy': 'Demasiadas solicitudes. Espera un minuto e inténtalo de nuevo.',
      'quote.gone': 'Este plan ya no está disponible. Elige otro.',
      'quote.offline': 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      'lang.ru': 'Русский',
      'lang.en': 'English',
      'lang.switchToRu': 'Перейти на русскую версию',
      'nav.findPlan': 'Buscar un plan',
      'preview.more': 'Qué significa',
      'footer.about': 'Planes de datos eSIM para viajar a más de 190 destinos, con precios en dólares estadounidenses.',
      'footer.help': 'Ayuda',
      'home.eyebrow': 'eSIM de viaje para más de 190 destinos',
      'home.h1a': 'Datos móviles en el extranjero,',
      'home.h1b': 'sin cargos de roaming',
      'home.searchPlaceholder': '¿A dónde viajas?',
      'home.find': 'Buscar planes',
      'home.popularShort': 'Populares:',
      'home.fact1': 'Precios en dólares estadounidenses',
      'home.fact2': 'Instalación con código QR',
      'home.fact3': 'Planes por país, regionales y diarios',
      'home.popularTitle': 'Destinos populares',
      'home.popularLead': 'Elige un país para ver sus planes, con precios en dólares estadounidenses.',
      'home.viewPlans': 'Ver planes',
      'home.howKicker': 'Primeros pasos',
      'home.typesKicker': 'Planes',
      'home.typesTitle': 'Tres tipos de planes',
      'home.typesLead': 'Todas las páginas de destino agrupan los planes de la misma manera, para que compares opciones equivalentes.',
      'home.typeLocalTitle': 'Planes para un país',
      'home.typeLocalBody': 'Una cantidad fija de datos para un país, válida durante un número fijo de días.',
      'home.typeRegionalTitle': 'Planes regionales',
      'home.typeRegionalBody': 'Un plan para varios países, para un viaje que cruza fronteras. Cada plan indica los países que cubre.',
      'home.typeDailyTitle': 'Datos cada día',
      'home.typeDailyBody': 'Una cantidad de datos para cada día del viaje, en lugar de una sola cantidad para toda la estancia.',
      'home.guidesTitle': 'Configura y soluciona tu eSIM',
      'home.guidesLead': 'Instala, comprueba y soluciona una eSIM de viaje, paso a paso.',
      'home.supportTitle': '¿Tienes preguntas antes de viajar?',
      'home.supportBody': 'Escribe a nuestro equipo de soporte por correo electrónico.',
      'fmt.numberLocale': 'es-419',
      'fmt.listSeparator': ', ',
      'plan.badgeLocal': 'Plan local',
      'plan.badgeRegional': 'Plan regional',
      'plan.badgeDaily': 'Plan diario',
      'plan.daysLegend': 'Días',
      'plan.gb': '{n} GB',
      'plan.dayCount.one': '{n} día',
      'plan.dayCount.other': '{n} días',
      'plan.country.one': 'país',
      'plan.country.other': 'países',
      'plan.coverageIncl': '{n} {countries}, entre ellos {name}',
      'plan.coveragePlus': '{name} + {n} {countries}',
      'plan.alsoCovers': 'También cubre {names}',
      'plan.alsoCoversMore': 'También cubre {names} y {n} más',
      'plan.networks': '{n} redes',
      'plan.ip': 'IP: {names}',
      'plan.showAll': 'Ver los {n} planes',
      'plan.showFewer': 'Ver menos planes',
      'hub.noMatches': 'Sin resultados',
      'hub.matches.one': '{n} destino coincide',
      'hub.matches.other': '{n} destinos coinciden'
    }
  };

  /**
   * Where each language's pages live. Russian is the root; every other
   * language sits under its own prefix — the registry's (seo/locales.mjs),
   * held equal to it by seo/test-locales.mjs.
   */
  var PREFIX = { ru: '', en: 'en', es: 'es' };
  Object.freeze(PREFIX);

  Object.freeze(DICT.ru);
  Object.freeze(DICT.en);
  Object.freeze(DICT.es);
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
