// The publication scope: what the PUBLISHED copy of the site (scripts/build-pages-artifact.mjs → _site/) holds when
// only some languages are public (seo/locales.mjs PUBLIC_SITE_LOCALES; owner, 2026-11-09, the Merchant of Record
// application — `MAGIC_ESIM_MOR_EN_ONLY_AUDIT_2026-11-09.md`).
//
// HIDDEN, NOT DELETED. Nothing here touches the repository: every page, translation and legal document of a hidden
// language is still built, refreshed by the catalogue bots and tested there. Only the published copy leaves it out, so a
// direct URL answers the site's 404 — never a redirect to English (owner: no redirect until a safe SEO scheme exists).
// Restoring a language is putting its code back in PUBLIC_SITE_LOCALES; with every enabled language public, each
// function below is the identity (seo/test-publication-scope.mjs proves it on the whole tree).
//
// What a hidden language loses from the published copy:
//   - every file under its prefix (/ru/, /es/, /de/, /fr/, /zh/, /ko/) — pages, legal documents, version archives, PDFs —
//     except KEPT_UNDER_HIDDEN (owner D3: what the Mini App links);
//   - every old-address redirect page whose target is one of those files (/esim/<country>/ → /ru/esim/<country>/ …);
//   - its hreflang alternates, its entries in the language switch and in sitemap.xml, and the first-visit language
//     move of the English home (assets/lang-route.js — it would send a browser to a page that is not there);
//   - the installed-site start page (site.webmanifest start_url /ru/ → «/»);
//   - its own not-found screen: 404.html shows the English one for its paths.
// What stays published although Russian (owner D3, 2026-11-09): /terms.html, /privacy.html (the documents existing RU
// orders accepted), /payment-success.html and /payment-failed.html (Platega's return pages), /app/ (the Mini App),
// /pay/ (Private Pay, routed by 404.html), /ru/iphone.html and /ru/android.html — unlisted: out of the sitemap, linked
// from no English page.

import { LOCALES, PUBLIC_SITE_LOCALES, isRussian } from './locales.mjs';

/** Published although under a hidden prefix: the Mini App's install guides (app/ui.js links them). */
export const KEPT_UNDER_HIDDEN = Object.freeze(['ru/iphone.html', 'ru/android.html']);

/** Root files of a hidden Russian site that stay published but leave the sitemap (owner D3). */
export const UNLISTED_ROOT_RU = Object.freeze(['terms.html', 'privacy.html']);

const SITE = 'https://magicesim.store';

/** The languages that are enabled but not public, as registry entries. */
export function hiddenLocales({ publicCodes = PUBLIC_SITE_LOCALES, list = LOCALES } = {}) {
  for (const c of publicCodes) {
    const l = list.find((x) => x.code === c);
    if (!l || !l.site.enabled) throw new Error(`publication scope: «${c}» is not an enabled language`);
  }
  return list.filter((l) => l.site.enabled && !publicCodes.includes(l.code));
}

/** Every enabled language public: the site as it is when the scope is lifted (tests of the repository's own pages). */
export const restoredScope = (list = LOCALES) => scopeOf({ publicCodes: list.filter((l) => l.site.enabled).map((l) => l.code), list });

/** One scope object: everything the other functions need, computed once. */
export function scopeOf(opts = {}) {
  const hidden = hiddenLocales(opts);
  const prefixes = hidden.map((l) => l.prefix);
  const ruHidden = hidden.some(isRussian);
  return Object.freeze({
    active: hidden.length > 0,
    hidden: Object.freeze(hidden.map((l) => l.code)),
    hreflangs: Object.freeze(hidden.map((l) => l.hreflang)),
    prefixes: Object.freeze(prefixes),
    kept: ruHidden ? KEPT_UNDER_HIDDEN : Object.freeze([]),
    unlisted: ruHidden ? UNLISTED_ROOT_RU : Object.freeze([]),
  });
}

/** Is a repository-relative file under a hidden prefix (and not kept)? */
export function isHiddenFile(rel, scope = scopeOf()) {
  const r = String(rel).replace(/\\/g, '/').replace(/^\//, '');
  if (scope.kept.includes(r)) return false;
  return scope.prefixes.some((p) => r === p || r.startsWith(`${p}/`));
}

/** The file a site path is served from: '/ru/' → 'ru/index.html', '/ru/iphone.html' → itself. */
const fileOfPath = (path) => {
  const p = String(path).replace(/[?#].*$/, '').replace(/^\//, '');
  return p === '' || p.endsWith('/') ? `${p}index.html` : p;
};

/** Is a URL or site path (absolute on this site, or starting with '/') a page the published copy does not hold? */
export function isHiddenUrl(url, scope = scopeOf()) {
  let u = String(url || '');
  if (u.startsWith(SITE)) u = u.slice(SITE.length) || '/';
  if (!u.startsWith('/') || u.startsWith('//')) return false;
  return isHiddenFile(fileOfPath(u), scope);
}

/**
 * Is a URL a page OF a hidden language — published or not? The kept and unlisted pages count: the site's frame (hreflang,
 * the language switch, the sitemap) never names them, even though a direct link still opens them.
 */
export function isHiddenLanguageUrl(url, scope = scopeOf()) {
  let u = String(url || '');
  if (u.startsWith(SITE)) u = u.slice(SITE.length) || '/';
  if (!u.startsWith('/') || u.startsWith('//')) return false;
  const file = fileOfPath(u);
  return scope.kept.includes(file) || scope.unlisted.includes(file) || isHiddenFile(file, scope);
}

/** The target of an old-address redirect page (`<meta http-equiv="refresh" content="0; url=…">`), or null. */
export function redirectTargetOf(html) {
  const m = /<meta http-equiv="refresh" content="0; url=([^"]+)">/.exec(String(html));
  return m ? m[1] : null;
}

/** Is this published file an old-address redirect page that leads into a hidden page? */
export function isHiddenRedirect(html, scope = scopeOf()) {
  const t = redirectTargetOf(html);
  return t !== null && isHiddenUrl(t, scope);
}

const LANG_ROUTE = /<!-- Before everything else: the first look at «\/» in the visitor's language — assets\/lang-route\.js -->\n<script src="\/assets\/lang-route\.js\?v=[0-9a-f]+"><\/script>\n/;

/**
 * An HTML page as the published copy serves it: without links into hidden pages that are part of the site's frame —
 * the hreflang alternates, the language switch (desktop list, mobile menu, single-link form) — and, on the English home,
 * without the first-visit language move. The page's own content is never edited: a link into a hidden page left in
 * the content is reported by the artifact's reference check instead (scripts/build-pages-artifact.mjs).
 */
export function scopeHtml(html, scope = scopeOf()) {
  if (!scope.active) return html;
  const hiddenHref = (href) => isHiddenLanguageUrl(href, scope);
  let out = String(html);
  // <link rel="alternate" hreflang="xx" href="…"> into a hidden page
  out = out.replace(/^[ \t]*<link rel="alternate" hreflang="[^"]+" href="([^"]+)">\n/gm, (all, href) => (hiddenHref(href) ? '' : all));
  // the desktop language list: drop hidden entries; drop the whole list when no other language is left
  out = out.replace(/([ \t]*)<details class="langsw langmenu">[\s\S]*?<\/details>\n?/g, (block) => {
    const kept = block.replace(/^[ \t]*<li><a href="([^"]+)" hreflang="[^"]+" lang="[^"]+">[^<]*<\/a><\/li>\n/gm, (li, href) => (hiddenHref(href) ? '' : li));
    return /<li><a /.test(kept) ? kept : '';
  });
  // the single-link switch (a page whose only other language is Russian)
  out = out.replace(/[ \t]*<a class="langsw" href="([^"]+)" hreflang="[^"]+" lang="[^"]+">[\s\S]*?<\/a>\n?/g, (a, href) => (hiddenHref(href) ? '' : a));
  // the mobile menu's language links (after its <hr>), then the <hr> itself when nothing follows it
  out = out.replace(/^[ \t]*<a href="([^"]+)" hreflang="[^"]+" lang="[^"]+"(?: data-i18n="[^"]+")?>[^<]*<\/a>\n/gm, (a, href) => (hiddenHref(href) ? '' : a));
  out = out.replace(/\n[ \t]*<hr>\n([ \t]*<\/nav>)/g, '\n$1');
  // the English home's first-visit language move sends browsers to the other languages' homes
  out = out.replace(LANG_ROUTE, '');
  return out;
}

/** sitemap.xml without the entries of hidden pages and of the unlisted Russian root documents. */
export function scopeSitemap(xml, scope = scopeOf()) {
  if (!scope.active) return xml;
  return String(xml).replace(/[ \t]*<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>\n/g, (block, loc) => {
    return isHiddenLanguageUrl(loc, scope) ? '' : block;
  });
}

/** site.webmanifest: an installed site that would open on a hidden home opens on the English one («/») instead. */
export function scopeManifest(text, scope = scopeOf()) {
  if (!scope.active) return text;
  return String(text).replace(/("start_url":\s*")([^"]+)(")/, (all, a, url, b) => (isHiddenUrl(url, scope) ? `${a}/${b}` : all));
}

const NOT_FOUND_FN = 'function notFoundLocale(path){\n';

/**
 * 404.html as the published copy serves it: a path of a hidden language gets the ENGLISH not-found screen (with its
 * links to «/» and /destinations/), never its own language's screen, whose links would lead to hidden pages — nor the
 * Russian one, which also loads the counter. /pay/ is routed before this function and is untouched.
 */
export function scope404(html, scope = scopeOf()) {
  if (!scope.active) return html;
  const s = String(html);
  const at = s.indexOf(NOT_FOUND_FN);
  if (at < 0 || s.indexOf(NOT_FOUND_FN, at + 1) >= 0) throw new Error('publication scope: 404.html has no single notFoundLocale()');
  const segs = [...scope.prefixes, ...(scope.hidden.includes('ru') ? ['esim'] : [])];
  const paths = scope.hidden.includes('ru') ? '|| /^\\/(iphone|android)(\\.html)?\\/?$/.test(path) ' : '';
  const guard = `      // seo/publication-scope.mjs: these languages are not published — their paths get the English screen\n`
    + `      if (/^\\/(${segs.join('|')})(\\/|$)/.test(path) ${paths}) return 'en';\n`;
  return s.slice(0, at + NOT_FOUND_FN.length) + guard + s.slice(at + NOT_FOUND_FN.length);
}
