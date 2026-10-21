// What search engines may index on the multilingual site, and which pages are the same page in another language
// (I18N-09, 2026-10-21). ONE source for the robots meta, the hreflang clusters of the RU, EN and ES pages and the sitemap
// entries of the prefixed languages — the generators, the hand-written Russian pages and the sitemap all read it, and
// seo/test-i18n-indexing.mjs holds every built page to it.
//
// THE RULES (owner D5–D7, ES plan 2026-10-21):
//   - A prefixed language is indexable when the registry says `site.indexableHome` (seo/locales.mjs). Its home, its
//     destination list, its guide list and its five guides are indexed; its country pages are indexed in STAGES:
//     `INDEXED_COUNTRIES` below is the stage. Every other country page stays `noindex, follow`, out of the sitemap,
//     without hreflang — a template with no price in the HTML is not offered to search engines 198 at a time.
//   - The ten SEO-experiment pages (seo/frozen-pages.mjs) are in NO stage until the pilot verdict (~2026-12-07): their
//     Russian pages get no hreflang (the experiment's markup must not change) and their EN/ES twins stay noindex.
//   - A cluster lists only pages that exist and are indexed, each pointing at all the others (reciprocal), plus
//     x-default → the English twin (owner 2026-10-13). A page outside every cluster carries no alternate at all.
//   - Russian pages are indexed as before; they gain only the <link rel="alternate"> block of their cluster.
import { LOCALES, SITE } from './locales.mjs';
import { isFrozenPage } from './frozen-pages.mjs';

/* Stage 1 (2026-10-21): the popular destinations of the three home pages (RU_POPULAR_ALL, PAGE_COPY.en/es.popular)
 * minus the frozen ten. Widening the stage = adding slugs here (a page for it must exist in every indexed language). */
export const INDEXED_COUNTRIES = Object.freeze([
  'china', 'france', 'greece', 'indonesia', 'japan', 'maldives', 'mexico', 'south-korea', 'sri-lanka', 'thailand',
  'turkey', 'united-kingdom', 'vietnam',
]);

/* The Russian twin of each guide (the Russian site has its own structure: no /guides/). */
export const GUIDE_RU = Object.freeze({
  iphone: '/iphone.html',
  android: '/android.html',
  compatibility: '/esim/compatibility/',
  activation: '/esim/activation-before-travel/',
  troubleshooting: '/esim/not-working/',
});

/* The languages that take part in clusters: published and indexable. Registry order (ru, en, es, …). */
export const indexedLocales = (list = LOCALES) => list.filter((l) => l.site.enabled && l.site.indexableHome);

/* A page, described once: { kind: 'home' | 'hub' | 'guides' | 'guide' | 'country', slug? }. Its path in one language,
 * or null when that language has no such page. */
export function pathIn(l, page) {
  const P = l.prefix ? `/${l.prefix}` : '';
  switch (page.kind) {
    case 'home': return `${P}/`;
    case 'hub': return `${P}/esim/`;
    case 'guides': return l.prefix ? `${P}/guides/` : null;
    case 'guide': return l.prefix ? `${P}/guides/${page.slug}/` : (GUIDE_RU[page.slug] || null);
    case 'country': return `${P}/esim/${page.slug}/`;
    default: throw new Error(`indexing: unknown page kind ${page.kind}`);
  }
}

/* Is this page offered to search engines in language `code`? */
export function isIndexed(code, page, list = LOCALES) {
  const l = indexedLocales(list).find((x) => x.code === code);
  if (!l || pathIn(l, page) === null) return false;
  if (page.kind !== 'country') return true;
  if (isFrozenPage(page.slug)) return false;
  return INDEXED_COUNTRIES.includes(page.slug);
}

/* The cluster of one page: [{ hreflang, href }] of every language where it is indexed, then x-default → the English
 * twin. Empty when fewer than two languages index it (an hreflang needs a counterpart) or the page is frozen. */
export function cluster(page, list = LOCALES) {
  if (page.kind === 'country' && isFrozenPage(page.slug)) return [];
  const members = indexedLocales(list).filter((l) => isIndexed(l.code, page, list))
    .map((l) => ({ code: l.code, hreflang: l.hreflang, href: SITE + pathIn(l, page) }));
  if (members.length < 2) return [];
  const en = members.find((m) => m.code === 'en');
  return [...members.map(({ hreflang, href }) => ({ hreflang, href })), ...(en ? [{ hreflang: 'x-default', href: en.href }] : [])];
}

/* The <link rel="alternate"> block in a page's own formatting. `indent` and `close` follow the file it goes into:
 * the generated prefixed pages write `<link …>`, the Russian pages `  <link … />`. */
export const alternateLinks = (page, { indent = '', close = '>' } = {}) =>
  cluster(page).map((a) => `${indent}<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"${close === '/>' ? ' />' : '>'}`).join('\n');

/* The robots meta of a prefixed-language page. */
export const robotsFor = (code, page) => (isIndexed(code, page) ? 'index, follow' : 'noindex, follow');

/* Every indexed page of the prefixed languages, for the sitemap: home, list, guide list, guides, the stage's countries. */
export function indexedPrefixedPages(guideSlugs, list = LOCALES) {
  const pages = [{ kind: 'home' }, { kind: 'hub' }, { kind: 'guides' }, ...guideSlugs.map((slug) => ({ kind: 'guide', slug })),
    ...INDEXED_COUNTRIES.map((slug) => ({ kind: 'country', slug }))];
  const out = [];
  for (const l of indexedLocales(list).filter((x) => x.prefix)) {
    for (const p of pages) if (isIndexed(l.code, p, list)) out.push({ code: l.code, page: p, loc: SITE + pathIn(l, p) });
  }
  return out;
}

/* A Russian page by its URL or path ('/', '/esim/', '/esim/<slug>/', a GUIDE_RU path), or null for a page with no twin. */
export function ruPage(urlOrPath) {
  const path = String(urlOrPath).replace(SITE, '') || '/';
  if (path === '/') return { kind: 'home' };
  if (path === '/esim/') return { kind: 'hub' };
  const guide = Object.keys(GUIDE_RU).find((k) => GUIDE_RU[k] === path);
  if (guide) return { kind: 'guide', slug: guide };
  const m = path.match(/^\/esim\/([a-z0-9-]+)\/$/);
  return m ? { kind: 'country', slug: m[1] } : null;
}

/* The block a Russian page's <head> carries right after its canonical: its cluster in the Russian files' formatting
 * (two-space indent, ` />`), each line ending in a newline — or '' when the page is in no cluster. The Russian
 * generators and the hand-written pages (index.html, iphone.html, android.html) use exactly this text. */
export function ruAlternates(urlOrPath) {
  const page = ruPage(urlOrPath);
  const links = page ? alternateLinks(page, { indent: '  ', close: '/>' }) : '';
  return links ? `${links}\n` : '';
}
