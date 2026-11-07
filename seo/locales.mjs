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
//   - x-default moves to EN — in the indexing stage (I18N-09, 2026-10-21: done;
//     the Russian home's <head> changed with it). `X_DEFAULT_CURRENT` is what
//     the live pages say.
//   - Rollout: a working EN + GLOBAL payments first, then ES, then DE/FR, then
//     ZH/KO. The Mini App gets no new language for customers before GLOBAL
//     payments exist.
//   - UI copy: AI-assisted + review. Legal text: separate review.
//
// A LANGUAGE IS NOT A MARKET. `defaultMarket` is the commercial contour a page
// in that language defaults to; price, package, provider and payment are
// decided by the market (backend `lib/markets.js`), never by the language.

import { REGION_SLUGS } from './regions.mjs';


const pathsOf = (o) => Object.freeze(o.paths || { home: `/${o.prefix}/`, catalogue: `/${o.prefix}/esim/`, guides: `/${o.prefix}/guides/` });
const L = (o) => Object.freeze({ ...o, paths: pathsOf(o), site: Object.freeze(o.site), app: Object.freeze(o.app) });

/**
 * Every language the architecture is built for, in display order.
 *
 * code        internal id, BCP 47; also the dictionary key and the backend value
 * prefix      the language's own path segment and file id: /<prefix>/ holds its legal documents, assets/site-i18n-
 *             <prefix>.js its words, seo/content-<prefix>/ its texts. Since the EN-root migration (owner, 2026-11-07)
 *             no language has an empty prefix: Russian is `ru`, English keeps `en` (its legal documents, scripts and
 *             styles stay under /en/) while its PAGES live at the root — see `paths`.
 * paths       where the language's pages are, as URL paths (seo/url-migration.mjs is the map from the old ones):
 *             home, catalogue (the destination list; a country is catalogue + slug + '/'), guides (null: Russian
 *             guides live inside its catalogue and at /ru/iphone.html, /ru/android.html). Read through homePath(),
 *             cataloguePath(), guidesPath() — never typed again.
 * htmlLang    <html lang>
 * hreflang    <link rel="alternate" hreflang>
 * ogLocale    og:locale
 * script      ISO 15924 — what a «no foreign script on this page» gate checks
 * endonym     the name a language switcher prints
 * site        enabled: pages exist under the prefix; indexableHome: the home is
 *             in the sitemap and the hreflang cluster; analytics: the counter its
 *             pages load — 'metrika' (the Russian site: Yandex Metrika, R3-08) or
 *             'none'. A prefixed language states it explicitly; the locale
 *             generator builds only 'none' until a counter is decided by the owner
 *             (its CSP, consent and a no-PII rule come with that decision).
 * app         enabled: the Mini App offers it
 */
export const LOCALES = Object.freeze([
  L({ code: 'ru', prefix: 'ru', paths: { home: '/ru/', catalogue: '/ru/esim/', guides: null }, htmlLang: 'ru', hreflang: 'ru', ogLocale: 'ru_RU', script: 'Cyrl', endonym: 'Русский', defaultMarket: 'ru',
    site: { enabled: true, indexableHome: true, analytics: 'metrika' }, app: { enabled: true } }),
  L({ code: 'en', prefix: 'en', paths: { home: '/', catalogue: '/destinations/', guides: '/guides/' }, htmlLang: 'en', hreflang: 'en', ogLocale: 'en_US', script: 'Latn', endonym: 'English', defaultMarket: 'global',
    site: { enabled: true, indexableHome: true, analytics: 'none' }, app: { enabled: true } }),
  // ES-1 (2026-10-21) published it under noindex for review; ES-1r reviewed it (AI-only, owner); I18N-09 makes it
  // indexable: home, list, guides and the country stage of seo/indexing.mjs. The Mini App does not offer it (no Mini App
  // language before GLOBAL payments).
  L({ code: 'es', prefix: 'es', htmlLang: 'es', hreflang: 'es', ogLocale: 'es_ES', script: 'Latn', endonym: 'Español', defaultMarket: 'global',
    site: { enabled: true, indexableHome: true, analytics: 'none' }, app: { enabled: true } }),
  // DE-1 (2026-10-22): published under noindex (owner D11) — no hreflang cluster, not in the sitemap, until a separate
  // indexing decision sets indexableHome. Standard German (de-DE, «du»); the Mini App does not offer it.
  L({ code: 'de', prefix: 'de', htmlLang: 'de', hreflang: 'de', ogLocale: 'de_DE', script: 'Latn', endonym: 'Deutsch', defaultMarket: 'global',
    site: { enabled: true, indexableHome: false, analytics: 'none' }, app: { enabled: true } }),
  // FR-1 (2026-10-22): published under noindex (owner D11) — no hreflang cluster, not in the sitemap, until a separate
  // indexing decision. Standard French (fr-FR, «vous»); the Mini App does not offer it.
  L({ code: 'fr', prefix: 'fr', htmlLang: 'fr', hreflang: 'fr', ogLocale: 'fr_FR', script: 'Latn', endonym: 'Français', defaultMarket: 'global',
    site: { enabled: true, indexableHome: false, analytics: 'none' }, app: { enabled: true } }),
  L({ code: 'zh-Hans', prefix: 'zh', htmlLang: 'zh-Hans', hreflang: 'zh-Hans', ogLocale: 'zh_CN', script: 'Hans', endonym: '简体中文', defaultMarket: 'global',
    // ZH-1 2026-10-22: published under noindex (owner D11) — indexing opens only on the owner's separate word.
    site: { enabled: true, indexableHome: false, analytics: 'none' }, app: { enabled: true } }),
  L({ code: 'ko', prefix: 'ko', htmlLang: 'ko', hreflang: 'ko', ogLocale: 'ko_KR', script: 'Hang', endonym: '한국어', defaultMarket: 'global',
    // KO-1 2026-10-22: published under noindex (owner D11) — indexing opens only on the owner's separate word.
    site: { enabled: true, indexableHome: false, analytics: 'none' }, app: { enabled: true } }),
]);

/** What the live pages declare as x-default: the English twin since I18N-09 (was `ru` = `/`). See the decisions above. */
export const X_DEFAULT_CURRENT = 'en';

/** The owner's decided target for x-default, applied by the indexing stage (I18N-09). */
export const X_DEFAULT_DECIDED = 'en';

export const SITE = 'https://magicesim.store';

export function locale(code) {
  return LOCALES.find((l) => l.code === code) || null;
}

/** The registry as it was while `code` was still planned — a copy with that language unpublished. For the rehearsal
 *  tests only (KO-1: every registry language is published, so they rehearse one «as if planned»). Never used to build. */
export function asPlanned(code, list = LOCALES) {
  if (!list.some((l) => l.code === code && !isRussian(l))) throw new Error(`asPlanned: no prefixed locale ${String(code)}`);
  return Object.freeze(list.map((l) => (l.code === code ? Object.freeze({ ...l, site: Object.freeze({ ...l.site, enabled: false, indexableHome: false }) }) : l)));
}

/** Codes of the languages the website publishes. */
export function siteLocales() {
  return LOCALES.filter((l) => l.site.enabled).map((l) => l.code);
}

/** Codes of the languages the Mini App offers. */
export function appLocales() {
  return LOCALES.filter((l) => l.app.enabled).map((l) => l.code);
}

/** The Russian site: its own generators (build-catalogue-pages, build-hub, build-guides), its own checkout, its counter. */
export const RU_CODE = 'ru';
export const isRussian = (l) => Boolean(l) && l.code === RU_CODE;

const asLocale = (x, list = LOCALES) => {
  const l = typeof x === 'string' ? list.find((y) => y.code === x) : x;
  if (!l || !l.paths) throw new Error(`unknown locale ${String(x && x.code ? x.code : x)}`);
  return l;
};

/** A language's home, as a path: '/' (English), '/ru/', '/es/' … */
export const homePath = (x) => asLocale(x).paths.home;
/** A language's destination list, or one destination page when `slug` is given: '/destinations/turkey/', '/ru/esim/turkey/'. */
export const cataloguePath = (x, slug) => asLocale(x).paths.catalogue + (slug ? `${slug}/` : '');
/** A language's guide list, or one guide: '/guides/iphone/', '/es/guides/iphone/'; null for Russian (no guide list). */
export const guidesPath = (x, slug) => {
  const g = asLocale(x).paths.guides;
  return g === null ? null : g + (slug ? `${slug}/` : '');
};
/** The file a page path is written to, relative to the repository: '/' -> 'index.html', '/ru/esim/' -> 'ru/esim/index.html'. */
export const fileOf = (path) => `${String(path).replace(/^\//, '')}index.html`;
/** The directory of a path ending in '/', relative to the repository, without the trailing slash ('' for the root). */
export const dirOf = (path) => String(path).replace(/^\//, '').replace(/\/$/, '');

/** The Russian guides that are the twins of the international ones (seo/indexing.mjs GUIDE_RU). */
export const RU_GUIDE_PATHS = Object.freeze({
  iphone: '/ru/iphone.html',
  android: '/ru/android.html',
  compatibility: '/ru/esim/compatibility/',
  activation: '/ru/esim/activation-before-travel/',
  troubleshooting: '/ru/esim/not-working/',
});

/** The absolute URL of a language's home. */
export function homeUrl(code) {
  return `${SITE}${homePath(code)}`;
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

/** The published languages built by the locale generator (seo/build-locale-pages.mjs): every one but Russian. The name
 *  predates the EN-root migration — English now has its pages at the root, but its legal documents and scripts keep the
 *  /en/ prefix, and it is still built by the same generator as the prefixed languages. */
export function prefixedSiteLocales(list = LOCALES) {
  return list.filter((l) => !isRussian(l) && l.site.enabled);
}

/** The non-root homes that go into the sitemap: published AND indexable. */
export function indexablePrefixedHomes(list = LOCALES) {
  return prefixedSiteLocales(list).filter((l) => l.site.indexableHome).map((l) => l.code);
}

/** The files a catalogue rebuild writes for one prefixed language: its list, its search data, one page per country,
 *  and its region pages (seo/regions.mjs — they print seo/global-plan-facts.json, which the catalogue bot refreshes;
 *  the slugs come from that one list, never typed here, and a region slug is never a country slug). */
export function catalogueLocalePaths(slugs, list = LOCALES) {
  const fixed = [];
  const perCountry = [];
  const perRegion = [];
  for (const l of prefixedSiteLocales(list)) {
    fixed.push(fileOf(l.paths.catalogue), `${l.prefix}/destinations.js`);
    for (const slug of slugs || []) {
      if (typeof slug === 'string' && slug) perCountry.push(fileOf(l.paths.catalogue + `${slug}/`));
    }
    for (const slug of REGION_SLUGS) perRegion.push(fileOf(l.paths.catalogue + `${slug}/`));
  }
  return { fixed, perCountry, perRegion };
}

/** The pathspecs the refresh workflow stages (`git add --`), in the workflow's order. */
export function refreshStagePaths(list = LOCALES) {
  return [dirOf(asLocale(RU_CODE, list).paths.catalogue),
    ...prefixedSiteLocales(list).flatMap((l) => [dirOf(l.paths.catalogue), `${l.prefix}/destinations.js`]),
    'seo/catalogue-countries.json', 'seo/fact-sheets.json', 'seo/sitemap-lastmod.json', 'seo/suppressed-claims.json', 'sitemap.xml'];
}

/** The paths the workflow's reproducibility hash covers (`find …`), in its order. */
export function refreshTreePaths(list = LOCALES) {
  return [dirOf(asLocale(RU_CODE, list).paths.catalogue),
    ...prefixedSiteLocales(list).flatMap((l) => [dirOf(l.paths.catalogue), `${l.prefix}/destinations.js`]),
    'seo', 'sitemap.xml'];
}
