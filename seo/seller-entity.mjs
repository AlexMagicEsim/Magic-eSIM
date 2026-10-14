// The ONE machine-readable seller entity of magicesim.store.
//
// Declared in full once, on the Russian home page (index.html) — Google's
// Organization guidance: «We recommend placing this information on your home
// page», and «the most specific schema.org subtype… if you have an ecommerce
// site… OnlineStore» (developers.google.com/search/docs/appearance/structured-
// data/organization, read 2026-10-14). Other pages point at it by the stable
// @id below, and carry name + url too, so the reference still reads without
// cross-page resolution.
//
// ONLY FACTS THE SITE ALREADY PUBLISHES. No legalName, address, foundingDate,
// rating, review or return-policy node: none is public, and terms.html §6
// («возврат… как правило, не производится… может быть рассмотрен
// индивидуально») cannot be expressed as a single MerchantReturnPolicy without
// overstating it. seo/test-seller-entity.mjs refuses those properties.
//
// Scope (owner, 2026-10-14): the home page and the five SEO-pilot country
// pages only; every other page keeps its own inline Organization until a
// separate decision.

export const SITE = 'https://magicesim.store';
export const SELLER_ID = `${SITE}/#organization`;
export const SUPPORT_EMAIL = 'support@magicesim.store';
// Public profiles that belong to Magic eSIM and are already linked from the
// site's footer: the Telegram channel and the Mini App bot.
export const SAME_AS = Object.freeze(['https://t.me/magicesim', 'https://t.me/magicesim_bot']);

/** The full node, for the home page. */
export const SELLER_NODE = Object.freeze({
  '@type': 'OnlineStore',
  '@id': SELLER_ID,
  name: 'Magic eSIM',
  url: `${SITE}/`,
  logo: `${SITE}/assets/magic-esim-logo.png`,
  description: 'Магазин eSIM для путешествий: мобильный интернет в 190+ направлениях, оплата в рублях российской картой или через СБП.',
  email: SUPPORT_EMAIL,
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: SUPPORT_EMAIL,
    availableLanguage: ['ru', 'en'],
  },
  sameAs: SAME_AS,
});

/** The reference other pages use: the same @id, plus enough to read on its own. */
export const SELLER_REF = Object.freeze({
  '@type': 'OnlineStore',
  '@id': SELLER_ID,
  name: 'Magic eSIM',
  url: `${SITE}/`,
});
