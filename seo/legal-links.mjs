// The legal links in the footer of a prefixed-language page (ZH-1, owner D8, 2026-10-22).
//
// Two schemes:
//   'international' — the ENGLISH documents of the international segment (LEGAL-0 / LEGAL-1). Since LEGAL-1 EVERY
//                     prefixed language uses it (EN, ES, DE, FR, ZH, KO): no international page points at the Russian
//                     Terms, Refund or Privacy documents any more (owner, LEGAL-1; ZH already so — owner D8).
//   'russian'       — the Russian documents, labelled «in Russian»: /terms.html and /privacy.html. Kept for the
//                     record and for a rehearsal; no published language uses it now. The Russian site's own footer
//                     (seo/ru-chrome.mjs) is a different file and is untouched.
//
// LEGAL-4: a language with a translation (seo/legal-i18n.mjs) links its own /<prefix>/… version of each published
// document instead (seo/build-locale-pages.mjs maps the /en/ path); legalLinks() itself still answers the English paths.
//
// INTL_LEGAL names each English document's URL — null until it is PUBLISHED. A null document is simply not linked:
// no placeholder page is created and no page says a document exists before it does. Publishing one = its URL here
// (a page that exists in the repository; the build refuses a URL that does not) and, for a document the dictionary has
// no label for yet (the refund policy), its `footer.*` key in every language that links it.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The English legal documents of LEGAL-1: a site path when published, null until then. */
export const INTL_LEGAL = Object.freeze({
  terms: '/en/terms/', // LEGAL-3: the pre-launch Terms of Service (seo/terms-en.mjs)
  refund: '/en/refund/', // LEGAL-3: the pre-launch Refund Policy (seo/refund-en.mjs)
  privacy: '/en/privacy/', // LEGAL-1: the pre-launch Privacy Policy (seo/privacy-en.mjs)
});

/** Which footer each prefixed language gets. A language missing here cannot be built. */
export const LEGAL_SCHEME = Object.freeze({
  en: 'international', es: 'international', de: 'international', fr: 'international',
  'zh-Hans': 'international', ko: 'international',
});

/** The English legal pages the locale build writes itself, with the module that holds each text. */
export const GENERATED_LEGAL = Object.freeze({
  '/en/privacy/': 'seo/privacy-en.mjs',
  '/en/terms/': 'seo/terms-en.mjs',
  '/en/refund/': 'seo/refund-en.mjs',
});

const RUSSIAN = Object.freeze([
  Object.freeze({ key: 'footer.terms', href: '/terms.html', hreflang: 'ru' }),
  Object.freeze({ key: 'footer.privacy', href: '/privacy.html', hreflang: 'ru' }),
]);

/** The file a site path is served from, or null for a path that is not a local page. */
function servedFile(href) {
  if (typeof href !== 'string' || !/^\/[a-z0-9/_.-]*$/.test(href) || href.includes('..')) return null;
  return href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1);
}

/** The footer's legal links for a language: [{ key, href, hreflang }] in display order (possibly empty). */
export function legalLinks(code, legal = INTL_LEGAL) {
  const scheme = LEGAL_SCHEME[code];
  if (!scheme) throw new Error(`legal-links: no legal scheme for ${String(code)} (seo/legal-links.mjs)`);
  if (scheme === 'russian') return RUSSIAN;
  const out = [];
  for (const doc of ['terms', 'refund', 'privacy']) {
    const href = legal[doc];
    if (href == null) continue;
    // An English legal page this repository generates (seo/build-locale-pages.mjs, English build) counts as published
    // when its text source exists — the same build writes the page, so a fresh checkout can build it the first time.
    const generated = GENERATED_LEGAL[href];
    if (generated) {
      if (!existsSync(join(ROOT, generated))) throw new Error(`legal-links: ${doc} → ${href} has no text source ${generated}`);
      out.push({ key: `footer.${doc}`, href, hreflang: 'en' });
      continue;
    }
    const file = servedFile(href);
    if (!file || !existsSync(join(ROOT, file))) throw new Error(`legal-links: ${doc} → ${href} is not a published page — never link a document before it exists`);
    out.push({ key: `footer.${doc}`, href, hreflang: 'en' });
  }
  return out;
}
