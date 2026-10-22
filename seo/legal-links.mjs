// The legal links in the footer of a prefixed-language page (ZH-1, owner D8, 2026-10-22).
//
// Two schemes:
//   'russian'       — the current Russian documents, labelled «in Russian» in the page's language: /terms.html and
//                     /privacy.html (EN, ES, DE, FR — unchanged, byte for byte).
//   'international' — the ENGLISH documents being prepared for the international segment (LEGAL-0 / LEGAL-1). The
//                     Chinese pages never point at the Russian Terms, Refund or Privacy documents (owner D8).
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
  terms: null,
  refund: null,
  privacy: null,
});

/** Which footer each prefixed language gets. A language missing here cannot be built. */
export const LEGAL_SCHEME = Object.freeze({
  en: 'russian', es: 'russian', de: 'russian', fr: 'russian',
  'zh-Hans': 'international', ko: 'international',
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
    const file = servedFile(href);
    if (!file || !existsSync(join(ROOT, file))) throw new Error(`legal-links: ${doc} → ${href} is not a published page — never link a document before it exists`);
    out.push({ key: `footer.${doc}`, href, hreflang: 'en' });
  }
  return out;
}
