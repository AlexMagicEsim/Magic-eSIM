#!/usr/bin/env node
// THE OLD ADDRESSES' CLIENT-SIDE REDIRECT PAGES (EN-root migration, owner 2026-11-07; the site stays on GitHub Pages).
//
// GitHub Pages cannot send a configurable HTTP 301 (its only real redirects are http→https, www→apex and a directory
// without its slash). So every old address that moved (seo/url-migration-legacy-paths.json, frozen; newPath() not null)
// gets a small generated page at its OLD file location that sends the visitor on in the browser:
//   - a script first: location.replace(NEW + location.search + location.hash) — the query (utm_*, gclid …) and the
//     fragment survive; the page's meta CSP allows exactly that script by its sha256 and nothing else;
//   - <meta http-equiv="refresh" content="0; url=NEW"> for a browser without JavaScript (it cannot carry the query);
//   - <link rel="canonical"> to NEW, and a visible link to NEW in the old page's language.
// No noindex (it would contradict the redirect signals), no Metrika, no hreflang; never in the sitemap and no lastmod
// (seo/build-sitemap.mjs lists its URLs explicitly; nothing that walks the tree for pages may count these — they are
// recognised by isLegacyRedirectFile()). This is a CLIENT-SIDE REDIRECT PAGE, never an HTTP 301.
//
// «/» gets none: it is the English home now (the old Russian home's address cannot also redirect to /ru/). /en/ leads to
// «/», and a visitor arriving from it is not moved on to /ru/ by assets/lang-route.js: the move to «/» is same-origin
// (the referrer is /en/), and lang-route.js never moves a same-origin arrival.
//
// One target page per old page: a target that no longer exists (a country withdrawn later) gets NO page here, and the
// stale one is removed by a person (generators never delete; seo/test-legacy-redirects.mjs names it).
//
//   node seo/build-legacy-redirects.mjs      (part of the template rebuild; never edit its output by hand)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { newPath } from './url-migration.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';
export const LEGACY_FILE = 'seo/url-migration-legacy-paths.json';

/** The repository file that serves a URL path: '/esim/x/' -> 'esim/x/index.html', '/iphone.html' -> 'iphone.html'. */
export const fileOfPath = (path) => (path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1));

/** The frozen old addresses. */
export const legacyPaths = (root = ROOT) => JSON.parse(readFileSync(join(root, LEGACY_FILE), 'utf8')).paths;

/** The language of an old page: the Russian catalogue and install guides were Russian, the /en/ pages English. */
const langOf = (path) => (path.startsWith('/en/') ? 'en' : 'ru');

const WORDS = {
  ru: { title: 'Страница переехала — Magic eSIM', moved: 'Эта страница теперь здесь:' },
  en: { title: 'This page has moved — Magic eSIM', moved: 'This page is now at:' },
};

const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('base64');

/** The redirect page of one old address that moved to `target`. Pure. */
export function redirectPage(path, target) {
  if (!/^\/[a-z0-9./-]*$/.test(target) || target.includes('..')) throw new Error(`legacy redirect: unsafe target ${target}`);
  const w = WORDS[langOf(path)];
  const script = `location.replace(${JSON.stringify(target)}+location.search+location.hash)`;
  return `<!doctype html>
<html lang="${langOf(path)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!-- A client-side redirect page (seo/build-legacy-redirects.mjs): this address moved to ${target}. GitHub Pages
     sends no HTTP 301; the script keeps the query and fragment, the refresh serves a browser without JavaScript. -->
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${sha256(script)}'; img-src 'self'; base-uri 'none'; form-action 'none'">
<title>${w.title}</title>
<script>${script}</script>
<meta http-equiv="refresh" content="0; url=${target}">
<link rel="canonical" href="${SITE}${target}">
</head>
<body>
<p>${w.moved} <a href="${target}">magicesim.store${target}</a></p>
</body>
</html>
`;
}

/** Every redirect page the frozen inventory asks for: [{ path, file, target, html, missingTarget }]. */
export function legacyRedirects(root = ROOT) {
  const out = [];
  for (const path of legacyPaths(root)) {
    const target = newPath(path);
    if (target === null) continue;
    const missingTarget = !existsSync(join(root, fileOfPath(target)));
    out.push({ path, file: fileOfPath(path), target, html: missingTarget ? null : redirectPage(path, target), missingTarget });
  }
  return out;
}

let FILES = null;
/** Is this repository file one of the redirect pages (for every reader that walks the tree for pages)? */
export function isLegacyRedirectFile(rel) {
  if (!FILES) FILES = new Set(legacyRedirects().map((r) => r.file));
  return FILES.has(String(rel).replace(/\\/g, '/'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const all = legacyRedirects();
  let n = 0;
  for (const r of all) {
    if (r.missingTarget) continue;
    mkdirSync(dirname(join(ROOT, r.file)), { recursive: true });
    writeFileSync(join(ROOT, r.file), r.html);
    n++;
  }
  const gone = all.filter((r) => r.missingTarget);
  console.log(`legacy redirect pages: ${n}${gone.length ? `; ${gone.length} old addresses whose target is gone (no page): ${gone.map((r) => r.path).join(', ')}` : ''}`);
}
