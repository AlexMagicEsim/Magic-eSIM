/* =====================================================================
 * assets/i18n/en.js — the storefront's English interface words (I18N-10).
 * ---------------------------------------------------------------------
 * One file per language: a page loads only its own language's words, inside the
 * bundle /assets/site-i18n-<prefix>.js that seo/site-i18n-bundle.mjs builds from
 * this file and the engine (assets/site-i18n.js). Never load this file on a page
 * by itself, and never edit a bundle: edit here, then run the locale build.
 *
 * Node (generators, tests, the localization-qa skill) reads it through the engine:
 * require('assets/site-i18n.js').DICT.en.
 * The English words. Every other prefixed language has exactly these keys (seo/test-site-i18n-split.mjs; French
 * adds the `.many` plural forms it needs).
 * ================================================================== */
(function (root) {
  'use strict';
  var WORDS = {
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
    'footer.terms': 'Terms of Service',
    'footer.refund': 'Refund Policy',
    'footer.privacy': 'Privacy Policy',
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
    'consent.legend': 'Before you pay',
    'consent.terms': 'I have read and agree to the {terms} and {refund}.',
    'consent.termsLink': 'Terms of Service',
    'consent.refundLink': 'Refund Policy',
    'consent.delivery': 'I ask Magic eSIM to start providing my eSIM plan now, within the 14-day withdrawal period. I understand that I lose my right of withdrawal once the plan has been fully provided (its data is used up or its validity has ended), and that if I withdraw before then I will pay for the part of the plan provided up to the time I tell you.',
    'consent.privacy': 'Our {privacy} explains how we handle your data.',
    'consent.privacyLink': 'Privacy Policy',
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
    // How the currency is written: 'symbol' («$12.99», «USD 12.99» in es-419) or 'code' («12,99 USD»). Intl's own value.
    'fmt.currencyDisplay': 'symbol',
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
  };
  if (typeof module === 'object' && module.exports) module.exports = WORDS;
  else (root.MagicSiteWords = root.MagicSiteWords || {})['en'] = WORDS;
})(typeof window !== 'undefined' ? window : globalThis);
