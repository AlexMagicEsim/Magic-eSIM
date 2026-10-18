// Territories the catalogue can list in a package's COVERAGE that are shown by
// name there but never become a destination page (/esim/<slug>/), a hub card,
// a sitemap URL, a destination-search entry or a Mini App country.
//
// Naming a place and selling a page about it are different decisions. The
// storefront's rule is strict and stays strict: every code the catalogue can put
// on screen must have a customer-facing name (seo/check-country-coverage.mjs
// fails the catalogue refresh otherwise), and every sellable named country gets
// a page (seo/test-catalogue-sync.mjs, «C4b mirror»). An entry here is the one
// deliberate exception to the SECOND rule — never to the first: each code must
// be in seo/country-names.mjs, so the runtime dictionaries (assets/country-tariffs.js,
// app/core.js, assets/country-names-en.js) name it.
//
// Adding a code here is an owner's decision, with its reason, its date and
// whether a coverage count («N стран») counts it; seo/test-coverage-only-territories.mjs
// refuses an entry without them.
export const COVERAGE_ONLY = Object.freeze({
  AN: Object.freeze({
    reason: 'Netherlands Antilles — a country dissolved in 2010. Two Caribbean daily packages still list the deprecated code in their coverage; it must be named there, and must not gain /esim/netherlands-antilles/.',
    decided: '2026-09 (moved here from NO_PAGE in seo/catalogue-source.mjs)',
    // Counted: those packages list no CW/BQ/SX — AN is the only code for the
    // islands they cover, so it is one destination of the «N стран».
    counts_as_country: true,
  }),
  KT: Object.freeze({
    reason: 'Northern Cyprus — no ISO 3166 code; the provider lists «KT» in the coverage of Turkey Premium, Greece Cyprus Turkey and Europe and USA packages (first seen 2026-10-18, it stopped the catalogue refresh as an unnamed code). Named «Северный Кипр» / «Northern Cyprus» in coverage lists; no destination page for now (owner).',
    decided: '2026-10-18 (owner)',
    // Not counted: the north of the island of Cyprus, recognised as a state only
    // by Turkey; CY is already in every such list. Counting it would print
    // «42 страны» and falsify «до 41 страны» on cyprus (an SEO control page),
    // france, greece and portugal.
    counts_as_country: false,
  }),
});

export const COVERAGE_ONLY_CODES = Object.freeze(new Set(Object.keys(COVERAGE_ONLY)));
export const isCoverageOnly = (code) => COVERAGE_ONLY_CODES.has(String(code || '').trim().toUpperCase());

/** Codes a coverage list names but a «N стран» count leaves out. */
export const UNCOUNTED_CODES = Object.freeze(new Set(Object.keys(COVERAGE_ONLY).filter((c) => COVERAGE_ONLY[c].counts_as_country === false)));
export const isUncounted = (code) => UNCOUNTED_CODES.has(String(code || '').trim().toUpperCase());
