// The storefront's languages: one table, read by tests and (later) generators.
//
// WHAT THIS IS — I18N-01, the foundation (the i18n audit and plan of 2026-10-13).
// Before this file «which languages exist» was answered in four places that
// could not see each other: `assets/site-i18n.js` (LANGS), `app/i18n.js`
// (LANGS), the backend's allowlists, and two dozen tests that hard-coded
// `ru`/`en` or used `de`/`fr` as the example of a language nobody speaks.
// This table is now the answer for the storefront repository, and
// `seo/test-locales.mjs` holds every shipped list to it.
//
// WHAT THIS IS NOT. Nothing here renders anything. No generator reads it yet,
// no page links to it, and turning a flag on below does NOT publish a language:
// a language needs its dictionaries, its reviewed pages and its own stage of
// the plan. Today exactly `ru` and `en` are enabled — the five others are
// described so the architecture is built for seven, and `seo/test-locales.mjs`
// pins that they stay OFF until a stage deliberately turns one on.
//
// OWNER DECISIONS, 2026-10-13 (recorded here so nobody re-litigates them):
//   - Simplified Chinese lives at /zh/ with lang and hreflang `zh-Hans`
//     (script, not region: `zh-CN` would target mainland China, where Google is
//     blocked). Traditional Chinese, if ever, is `zh-Hant` at /zh-hant/.
//   - x-default moves to EN — but in the indexing stage (I18N-09), NOT here:
//     moving it changes the Russian home's <head>, and this stage changes no
//     output. `X_DEFAULT_CURRENT` is what the live pages say today.
//   - Rollout: a working EN + GLOBAL payments first, then ES, then DE/FR, then
//     ZH/KO. The Mini App gets no new language for customers before GLOBAL
//     payments exist.
//   - UI copy: AI-assisted + review. Legal text: separate review.
//
// A LANGUAGE IS NOT A MARKET. `defaultMarket` is the commercial contour a page
// in that language defaults to; price, package, provider and payment are
// decided by the market (backend `lib/markets.js`), never by the language.

const L = (o) => Object.freeze({ ...o, site: Object.freeze(o.site), app: Object.freeze(o.app) });

/**
 * Every language the architecture is built for, in display order.
 *
 * code        internal id, BCP 47; also the dictionary key and the backend value
 * prefix      URL path segment; '' = the site root (Russian stays at /)
 * htmlLang    <html lang>
 * hreflang    <link rel="alternate" hreflang>
 * ogLocale    og:locale
 * script      ISO 15924 — what a «no foreign script on this page» gate checks
 * endonym     the name a language switcher prints
 * site        enabled: pages exist under the prefix; indexableHome: the home is
 *             in the sitemap and the hreflang cluster
 * app         enabled: the Mini App offers it
 */
export const LOCALES = Object.freeze([
  L({ code: 'ru', prefix: '', htmlLang: 'ru', hreflang: 'ru', ogLocale: 'ru_RU', script: 'Cyrl', endonym: 'Русский', defaultMarket: 'ru',
    site: { enabled: true, indexableHome: true }, app: { enabled: true } }),
  L({ code: 'en', prefix: 'en', htmlLang: 'en', hreflang: 'en', ogLocale: 'en_US', script: 'Latn', endonym: 'English', defaultMarket: 'global',
    site: { enabled: true, indexableHome: true }, app: { enabled: true } }),
  L({ code: 'es', prefix: 'es', htmlLang: 'es', hreflang: 'es', ogLocale: 'es_ES', script: 'Latn', endonym: 'Español', defaultMarket: 'global',
    site: { enabled: false, indexableHome: false }, app: { enabled: false } }),
  L({ code: 'de', prefix: 'de', htmlLang: 'de', hreflang: 'de', ogLocale: 'de_DE', script: 'Latn', endonym: 'Deutsch', defaultMarket: 'global',
    site: { enabled: false, indexableHome: false }, app: { enabled: false } }),
  L({ code: 'fr', prefix: 'fr', htmlLang: 'fr', hreflang: 'fr', ogLocale: 'fr_FR', script: 'Latn', endonym: 'Français', defaultMarket: 'global',
    site: { enabled: false, indexableHome: false }, app: { enabled: false } }),
  L({ code: 'zh-Hans', prefix: 'zh', htmlLang: 'zh-Hans', hreflang: 'zh-Hans', ogLocale: 'zh_CN', script: 'Hans', endonym: '简体中文', defaultMarket: 'global',
    site: { enabled: false, indexableHome: false }, app: { enabled: false } }),
  L({ code: 'ko', prefix: 'ko', htmlLang: 'ko', hreflang: 'ko', ogLocale: 'ko_KR', script: 'Hang', endonym: '한국어', defaultMarket: 'global',
    site: { enabled: false, indexableHome: false }, app: { enabled: false } }),
]);

/** What the live homes declare as x-default today (`/`). See the decisions above. */
export const X_DEFAULT_CURRENT = 'ru';

/** The owner's decided target for x-default, applied by the indexing stage (I18N-09). */
export const X_DEFAULT_DECIDED = 'en';

export const SITE = 'https://magicesim.store';

export function locale(code) {
  return LOCALES.find((l) => l.code === code) || null;
}

/** Codes of the languages the website publishes. */
export function siteLocales() {
  return LOCALES.filter((l) => l.site.enabled).map((l) => l.code);
}

/** Codes of the languages the Mini App offers. */
export function appLocales() {
  return LOCALES.filter((l) => l.app.enabled).map((l) => l.code);
}

/** The absolute URL of a language's home. */
export function homeUrl(code) {
  const l = locale(code);
  if (!l) throw new Error(`unknown locale ${code}`);
  return l.prefix ? `${SITE}/${l.prefix}/` : `${SITE}/`;
}

/* ------------------------------------------------------------------------ *
 * Paths the catalogue automation may touch, per published language (I18N-08).
 *
 * The refresh automation (seo/refresh-allowlist.mjs, seo/build-sitemap.mjs,
 * .github/workflows/seo-refresh-pr.yml) used to type `en/…` paths by hand, so a
 * new language would have stopped every catalogue refresh (fail-closed) until
 * somebody found all the places. They now come from here. Every function takes
 * the language list as an argument so a test can rehearse an enabled language
 * without enabling one; the default is the live registry.
 * ------------------------------------------------------------------------ */

/** The published languages that live under their own prefix (not the root). */
export function prefixedSiteLocales(list = LOCALES) {
  return list.filter((l) => l.prefix && l.site.enabled);
}

/** The non-root homes that go into the sitemap: published AND indexable. */
export function indexablePrefixedHomes(list = LOCALES) {
  return prefixedSiteLocales(list).filter((l) => l.site.indexableHome).map((l) => l.code);
}

/** The files a catalogue rebuild writes for one prefixed language: its list, its search data, one page per country. */
export function catalogueLocalePaths(slugs, list = LOCALES) {
  const fixed = [];
  const perCountry = [];
  for (const l of prefixedSiteLocales(list)) {
    fixed.push(`${l.prefix}/esim/index.html`, `${l.prefix}/destinations.js`);
    for (const slug of slugs || []) {
      if (typeof slug === 'string' && slug) perCountry.push(`${l.prefix}/esim/${slug}/index.html`);
    }
  }
  return { fixed, perCountry };
}

/** The pathspecs the refresh workflow stages (`git add --`), in the workflow's order. */
export function refreshStagePaths(list = LOCALES) {
  return ['esim',
    ...prefixedSiteLocales(list).flatMap((l) => [`${l.prefix}/esim`, `${l.prefix}/destinations.js`]),
    'seo/catalogue-countries.json', 'seo/fact-sheets.json', 'seo/sitemap-lastmod.json', 'sitemap.xml'];
}

/** The paths the workflow's reproducibility hash covers (`find …`), in its order. */
export function refreshTreePaths(list = LOCALES) {
  return ['esim',
    ...prefixedSiteLocales(list).flatMap((l) => [`${l.prefix}/esim`, `${l.prefix}/destinations.js`]),
    'seo', 'sitemap.xml'];
}
