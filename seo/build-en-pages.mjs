#!/usr/bin/env node
/* The English pages — /en/esim/<slug>/, /en/esim/, /en/guides/…, en/destinations.js.
 *
 * Since I18N-08 the templates live in seo/build-locale-pages.mjs, one generator
 * for every site language of seo/locales.mjs; this file is English's entry
 * point. It keeps the names the tests and seo/build-all.mjs have always used,
 * and its output is byte-for-byte what it was (seo/test-locale-pages.mjs).
 *
 * Run: node seo/build-en-pages.mjs   (build-all.mjs runs it)
 */
import { pathToFileURL } from 'node:url';
import { localeGenerator, primaryApiOrigin, cspMeta, azLetter, GUIDE_RU, sectionId, FONT_PRELOAD, LOGO } from './build-locale-pages.mjs';

const EN = localeGenerator('en');

export { primaryApiOrigin, cspMeta, azLetter, GUIDE_RU, sectionId, FONT_PRELOAD, LOGO };
export const { POPULAR, SKIP_LINK, header, PAYBAR, FOOTER, countryPage, hubPage, guidePage, guidesHub, destinationsJs } = EN;
export const enCountries = () => EN.countries();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = EN.build();
  console.log(`en/esim: ${n.countries} country pages + the list (all noindex), en/destinations.js; en/guides: ${n.guides} guides + the list (noindex)`);
}
