// The EN-root migration: English moves to the site root, Russian moves under /ru/ (owner, 2026-11-07).
//
// THE ONE MAP of old public paths to new ones. The web server's 301 rules (infra/web/), the redirect tests and
// the report are all generated from it — never type a redirect anywhere else.
//
//   English   /en/            -> /                 /en/guides/... -> /guides/...      /en/support/ -> /support/
//             /en/esim/...    -> /destinations/... (NOT /esim/: that path is the old Russian catalogue, and a 301
//                                                   from it is only possible while nothing else lives there)
//   Russian   /               -> no redirect: / becomes the English home (a URL cannot be both a page and a 301)
//             /esim/...       -> /ru/esim/...      /iphone.html -> /ru/iphone.html   /android.html -> /ru/android.html
//             /?country=XX    -> /ru/esim/<slug>/  (the old home's deep link; a server rule on the query)
//
// What does NOT move, on purpose:
//   - legal documents at their permanent addresses: /en/terms|refund|privacy/ with every frozen version and PDF,
//     /en/legal-versions.json, /en/checkout-statements.json (the backend pins them by URL and sha256), and the
//     Russian /terms.html, /privacy.html;
//   - /payment-success.html, /payment-failed.html (Platega returns there; the backend builds those URLs);
//   - /pay/..., /app/... (the Mini App), /assets/..., the English scripts and styles under /en/;
//   - every other language (/es/, /de/, /fr/, /zh/, /ko/).
//
// A rule's target is never another rule's source: one hop, no chain, no loop (seo/test-url-migration.mjs).

export const RU_BASE = '/ru/';
export const EN_CATALOGUE_BASE = '/destinations/';

/** Ordered: the first rule that matches decides. `exact` matches the path alone; `prefix` keeps the rest of it. */
export const RULES = Object.freeze([
  { type: 'exact', from: '/en', to: '/' },
  { type: 'exact', from: '/en/', to: '/' },
  { type: 'exact', from: '/en/index.html', to: '/' },
  { type: 'exact', from: '/en/esim', to: EN_CATALOGUE_BASE },
  { type: 'prefix', from: '/en/esim/', to: EN_CATALOGUE_BASE },
  { type: 'exact', from: '/en/guides', to: '/guides/' },
  { type: 'prefix', from: '/en/guides/', to: '/guides/' },
  { type: 'exact', from: '/en/support', to: '/support/' },
  { type: 'prefix', from: '/en/support/', to: '/support/' },
  { type: 'exact', from: '/esim', to: `${RU_BASE}esim/` },
  { type: 'prefix', from: '/esim/', to: `${RU_BASE}esim/` },
  { type: 'exact', from: '/iphone.html', to: `${RU_BASE}iphone.html` },
  { type: 'exact', from: '/iphone', to: `${RU_BASE}iphone.html` },
  { type: 'exact', from: '/android.html', to: `${RU_BASE}android.html` },
  { type: 'exact', from: '/android', to: `${RU_BASE}android.html` },
].map(Object.freeze));

/** Paths that keep answering 200 at the same address, named so a test can prove no rule touches them. */
export const STAYS = Object.freeze([
  '/', '/terms.html', '/privacy.html', '/payment-success.html', '/payment-failed.html', '/404.html',
  '/en/terms/', '/en/refund/', '/en/privacy/', '/en/legal-versions.json', '/en/checkout-statements.json',
  '/pay/', '/app/', '/assets/', '/robots.txt', '/sitemap.xml',
  '/es/', '/de/', '/fr/', '/zh/', '/ko/',
]);

/**
 * The rest of a path under a prefix rule, with the directory slash a page needs: `turkey` -> `turkey/`, so
 * `/esim/turkey` lands on `/ru/esim/turkey/` in ONE hop instead of a second directory 301. A last segment with a
 * dot (a file) or an empty rest is left alone.
 */
export function withDirSlash(rest) {
  if (rest === '' || rest.endsWith('/')) return rest;
  return rest.slice(rest.lastIndexOf('/') + 1).includes('.') ? rest : `${rest}/`;
}

/** The new path for an old one, or null when the path does not move. Query and fragment are the caller's. */
export function newPath(path) {
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error(`newPath: not a path: ${String(path)}`);
  for (const r of RULES) {
    if (r.type === 'exact' && path === r.from) return r.to;
    if (r.type === 'prefix' && path.startsWith(r.from)) return r.to + withDirSlash(path.slice(r.from.length));
  }
  return null;
}

/** `/?country=XX` -> the Russian country page. `countries` = seo/catalogue-countries.json `countries`. */
export function countryQueryTargets(countries) {
  const out = {};
  for (const c of countries || []) {
    if (c && /^[A-Z]{2}$/.test(c.iso) && typeof c.slug === 'string' && /^[a-z0-9-]+$/.test(c.slug)) {
      out[c.iso] = `${RU_BASE}esim/${c.slug}/`;
    }
  }
  return out;
}
