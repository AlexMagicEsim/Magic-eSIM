#!/usr/bin/env node
// Rebuilds sitemap.xml: canonical 200-pages only (home, hub, all country pages,
// guides, terms/privacy). Payment/tech pages excluded. Run: node seo/build-sitemap.mjs
//
// LASTMOD IS A CLAIM ABOUT A PAGE, NOT ABOUT THE BUILD
//
//   Until 2026-09-01 this file stamped `new Date()` on every one of the 209
//   URLs, every run. A wave that rewrote ten pages told search engines that all
//   209 had changed, and so did a run that changed nothing at all. That is not a
//   cosmetic defect: `lastmod` is the one hint in a sitemap a crawler can act
//   on, and a value that is always today carries no information — at best it is
//   ignored, at worst it dilutes the signal for the pages that really did move.
//
//   So the date now comes from the PAGE. Each URL's rendered HTML is hashed and
//   the hash is kept in seo/sitemap-lastmod.json next to the date it was first
//   seen. Same hash on the next build → the stored date is reused untouched. New
//   hash → today. Nothing else moves.
//
//   Asset version stamps are stripped before hashing. `?v=<hash>` changes
//   whenever a CSS or JS file changes, which would have marked all 209 pages
//   modified on any asset edit — and stamp-assets.mjs runs AFTER this generator
//   in build-all.mjs, so half the files on disk carry the previous run's stamps
//   at the moment they are read here. Both problems have the same one-line fix.
//
//   Deterministic by construction: same pages plus same state file give the same
//   sitemap, in CI and on a laptop, with no network and no git history. Only a
//   genuinely new hash consults the clock. SITEMAP_DATE pins that clock for tests.
//
// WHAT «CHANGED» DELIBERATELY DOES NOT INCLUDE
//
//   A country page ships an EMPTY tariff grid. The plans and every price in them
//   are fetched at render time by assets/country-tariffs.js from the live API,
//   falling back to assets/catalog.json — which a bot refreshes and commits six
//   times a day without regenerating a single page. So the commercial content a
//   crawler renders can move while this hash does not.
//
//   That is a decision, not an oversight. Folding catalog.json into the hash
//   would re-date all 198 country pages six times a day on a bot commit that
//   touches three lines — the same «everything changed today» noise this file
//   exists to remove, only harder to argue with. What DOES belong to the page is
//   already inside the hash: the one <p class="facts"> line carries the counts
//   and the floor price, so a real catalogue move shows up as a changed date the
//   moment someone regenerates.
//
//   The gap worth naming is upstream and older than this file: the bot refreshes
//   the catalogue without rebuilding the pages, so those facts lines can sit
//   stale between manual builds. Fixing THAT is what would make the dates track
//   the storefront; widening the hash would only make them noisy again.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from './countries.mjs';
import { loadCached } from './catalogue-source.mjs';
import { indexedPrefixedPages } from './indexing.mjs';
import { EN_GUIDES } from './guides-en.mjs';

const PREFIXED_WEIGHT = {
  home: { prio: '0.9', freq: 'weekly' }, hub: { prio: '0.8', freq: 'weekly' }, country: { prio: '0.8', freq: 'weekly' },
  guides: { prio: '0.6', freq: 'monthly' }, guide: { prio: '0.7', freq: 'monthly' }, region: { prio: '0.7', freq: 'weekly' },
};
/* A page kind with no weight would enter the sitemap with no priority and no frequency (the spread of `undefined`). */
const weightOf = (kind) => {
  if (!PREFIXED_WEIGHT[kind]) throw new Error(`build-sitemap: no sitemap weight for the page kind «${kind}»`);
  return PREFIXED_WEIGHT[kind];
};
export { PREFIXED_WEIGHT };
import { LOGO as STATIC_LOGO } from './site-chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE = join(ROOT, 'seo/sitemap-lastmod.json');

// The catalogue decides which country pages exist. A hand-kept list is
// guaranteed to drift: a country added stays out of the sitemap, and one
// dropped keeps an entry pointing at a page that sells nothing.
export function sitemapUrls(countries) {
  return [
    { loc: `${SITE}/`, prio: '1.0', freq: 'weekly' },
    // The other languages' indexed pages (I18N-09): exactly what seo/indexing.mjs
    // offers to search engines — home, destination list, guide list, guides and the
    // country pages of the current stage. Every other prefixed page is noindex and
    // stays out: listing URLs nobody may index is how a sitemap starts reporting
    // errors instead of pages.
    ...indexedPrefixedPages(EN_GUIDES.map((g) => g.slug)).map(({ page, loc }) => ({ loc, ...weightOf(page.kind) })),
    { loc: `${SITE}/esim/`, prio: '0.8', freq: 'weekly' },
    ...countries.map((c) => ({ loc: `${SITE}/esim/${c.slug}/`, prio: '0.9', freq: 'weekly' })),
    { loc: `${SITE}/esim/compatibility/`, prio: '0.7', freq: 'monthly' },
    { loc: `${SITE}/esim/activation-before-travel/`, prio: '0.7', freq: 'monthly' },
    { loc: `${SITE}/esim/not-working/`, prio: '0.7', freq: 'monthly' },
    { loc: `${SITE}/esim/dual-sim-sms/`, prio: '0.7', freq: 'monthly' },
    { loc: `${SITE}/esim/payment-rubles/`, prio: '0.7', freq: 'monthly' },
    { loc: `${SITE}/iphone.html`, prio: '0.7', freq: 'monthly' },
    { loc: `${SITE}/android.html`, prio: '0.7', freq: 'monthly' },
    { loc: `${SITE}/terms.html`, prio: '0.3', freq: 'yearly' },
    { loc: `${SITE}/privacy.html`, prio: '0.3', freq: 'yearly' },
  ];
}

// `/esim/serbia/` → esim/serbia/index.html, `/terms.html` → terms.html, `/` → index.html.
export function fileFor(loc) {
  const path = String(loc).slice(SITE.length).replace(/^\//, '');
  return path === '' ? 'index.html' : path.endsWith('/') ? `${path}index.html` : path;
}

// What the page SAYS, with the asset fingerprints taken out. Everything else —
// every word, every number, every tag — is inside the hash.
//
// Anchored to a stylesheet or script URL on purpose. `\?v=[0-9a-f]+` on its own
// matches anywhere, and a YouTube link (`?v=dQw4w9WgXcQ`) would lose its `?v=d`
// and hash as a different, colliding string. Nothing on the site does that today
// — all six `?v=` shapes across the 209 pages are asset stamps — but a regex that
// is right by luck is a defect waiting for the first embedded video.
//
// A CSS or JS edit therefore moves no date. That is deliberate: it changes how
// every page looks, not what any page says, and `lastmod` is a claim about the
// document. A site-wide restyle that really should be announced is a `--seed`
// away.
//
// ICON LINKS ARE STRIPPED FOR THE SAME REASON, added 2026-09-15. They are the
// one block that is byte-identical on all 210 pages and says nothing about any
// of them; when the four icon families were unified, keeping them inside the
// hash re-dated every URL in the sitemap on a change to a favicon. That is the
// «everything changed today» claim this file was written to stop, arriving
// through a different door. The day a proper vector mark replaces the current
// one it must not re-date the corpus either.
//
// SHARE IMAGES LIKEWISE, added 2026-09-27. og:image and twitter:image say how
// a link LOOKS when shared, not what the page says. On 199 pages they named a
// file that never existed; pointing them at a real one re-dated 199 URLs until
// they were stripped here. Same migration as the icons: stored hashes were
// recomputed from the pages as they were at 9982f32, so no date moved.
//
// HREFLANG ALTERNATES LIKEWISE, added 2026-10-04, BEFORE the first English
// country page exists. `<link rel="alternate" hreflang="…">` says where the same
// page lives in another language, not what this page says. Without the strip,
// the day /en/esim/<slug>/ appears and its Russian twin gains a reciprocal tag,
// every such Russian page would be re-dated by a change to a different page.
// Only <link> tags carrying BOTH rel="alternate" and hreflang are stripped: a
// visible <a hreflang> language switch is content, and so would be any other
// alternate (a feed). Same migration: the two pages that carried hreflang (the
// two homes) had their stored hashes recomputed from the pages as they were at
// 7825ab4; no date moved.
//
// Doing this moved no date: the stored hashes in seo/sitemap-lastmod.json were
// recomputed from the pages AS THEY WERE at 3cf9f76 under the new rule, so each
// page kept the date it already had. That is a state migration, deliberately not
// a `--seed` — seeding would have stamped all 210 with today, which is the
// falsehood being avoided.
//
// LIVE CATALOGUE MARKUP LIKEWISE, added 2026-10-18 (SEO stage C). The data-cat
// attributes and wrappers around the generated counts and «от N ₽», and the
// <script> of assets/catalog-numbers.js, say how the page keeps its numbers
// current, not what it says. They are stripped back to EXACTLY the pre-stage-C
// markup, so the stored hashes still match and no date moved (no state
// migration was needed); seo/test-sitemap-lastmod.mjs pins the round trip.
export function stripLiveCatalogueMarkup(html) {
  return String(html)
    .replace(/[ \t]*<!-- Keeps the generated counts[\s\S]*?-->\n[ \t]*<script src="\/assets\/catalog-numbers\.js(?:\?v=[0-9a-f]+)?" defer><\/script>\n/g, '')
    .replace(/<span data-cat="floor">([^<]*)<\/span>/g, '$1')
    .replace(/<b data-cat="(?:local|regional|daily|floor)">/g, '<b>')
    .replace(/<span data-cat-seg="(?:local|regional|daily)">([^<]*<b>[^<]*<\/b>[^<]*)<\/span>/g, '$1')
    .replace(/<span data-cat-floor>([^<]*(?:<b>[^<]*<\/b>)?[^<]*)<\/span>/g, '$1');
}

// THE ANIMATED HEADER LOGO LIKEWISE, added 2026-10-20 (interface motion «Expressive» + logo «Reveal + Wave»). The vector
// logo, its motion script and assets/motion.js say how the header MOVES, not what the page says; they are put back to
// EXACTLY the static <img> logo the stored hashes were taken over, so no date moved (no state migration);
// seo/test-sitemap-lastmod.mjs pins the round trip.
// The English pages (2026-10-20) carry the same SVG with no inline script after it (their CSP) and start it from
// <script src="/assets/logo-once.js"> in <head>; both forms go back to the static logo, and that <head> line goes.
export function stripAnimatedLogo(html) {
  return String(html)
    .replace(/<svg class="brand-logo"[\s\S]*?<\/svg>(?:<script>\(function\(\)\{var d=document[\s\S]*?<\/script>)?/g, STATIC_LOGO)
    // with or without data-motion-src (2026-10-21: the home and the country pages also name assets/motion.js there)
    .replace(/[ \t]*<script src="\/assets\/logo-once\.js(?:\?v=[0-9a-f]+)?"(?: data-motion-src="\/assets\/motion\.js(?:\?v=[0-9a-f]+)?")?><\/script>\n?/g, '');
}

// THE PER-LANGUAGE WORDS BUNDLE LIKEWISE, added 2026-10-22 (I18N-10). /assets/site-i18n-<prefix>.js replaced the one
// shared /assets/site-i18n.js on every prefixed page: it says which file carries the interface words, not what the page
// says (the words themselves are unchanged and in the static HTML). It is put back to EXACTLY the old URL, so the stored
// hashes still match and no date moved (no state migration); seo/test-site-i18n-split.mjs pins the round trip.
export function stripSiteI18nBundle(html) {
  return String(html).replace(/<script src="\/assets\/site-i18n-[a-z]+\.js((?:\?v=[0-9a-f]+)?)" defer><\/script>/g, '<script src="/assets/site-i18n.js$1" defer></script>');
}

// THE LANGUAGE SWITCH LIKEWISE, added 2026-10-22 (KO-1, owner D14 «B»). The header's language list says where the same
// page lives in the other languages — what the hreflang alternates above say for crawlers — not what this page says.
// Kept in the hash, every new language re-dated every indexed page that lists it (the 42 EN/ES URLs on KO's day),
// although none of them changed a word. Reduced to an empty switch, whatever it lists: the desktop list
// (<details class="langsw langmenu">) or single link (<a class="langsw" … hreflang …>), and the language links after the
// <hr> of the phone menu. A link with hreflang anywhere ELSE (a guide pointing at another language) is still content.
// State migration, as for the icons and hreflang: the stored hashes were recomputed from the pages as they were at
// 8e2bd308 under this rule, so no date moved. seo/test-sitemap-lastmod.mjs pins both directions.
export function stripLanguageSwitch(html) {
  return String(html)
    .replace(/<details class="langsw langmenu">[\s\S]*?<\/details>/g, '<details class="langsw langmenu"></details>')
    .replace(/<a class="langsw" href="[^"]*" hreflang="[^"]*" lang="[^"]*">[\s\S]*?<\/a>/g, '<a class="langsw"></a>')
    .replace(/(<nav class="mnav-panel"[^>]*>[\s\S]*?<hr>)((?:\s*<a href="[^"]*" hreflang="[^"]*" lang="[^"]*"[^>]*>[^<]*<\/a>)+)/g, '$1');
}

// THE FIRST-VISIT LANGUAGE ROUTE LIKEWISE, added 2026-10-23 (owner). The two <head> lines of index.html that load
// assets/lang-route.js say where a first visit in another language is sent, not what the Russian home says — the same
// kind of line as the language switch above. Removed before hashing, so «/» keeps its date (no state migration);
// seo/test-lang-route.mjs pins the round trip.
export function stripLangRoute(html) {
  return String(html)
    .replace(/[ \t]*<!-- Before everything else \(the counter included\): the first look at «\/» [^\n]*-->\n/g, '')
    .replace(/[ \t]*<script src="\/assets\/lang-route\.js(?:\?v=[0-9a-f]+)?"><\/script>\n?/g, '');
}

// THE ASSORTMENT READER LIKEWISE, added 2026-10-25 (owner: the backend decides every country page). The one
// <script> line that loads assets/assortment-view.js says which file reads the backend's layout, not what the page
// says — the same kind of line as the language bundle above. Removed before hashing, so no country page is re-dated
// by it (no state migration); seo/test-assortment-single-source.mjs pins the round trip.
export function stripAssortmentView(html) {
  return String(html).replace(/[ \t]*<script src="\/assets\/assortment-view\.js(?:\?v=[0-9a-f]+)?" defer><\/script>\n?/g, '');
}

export function contentHash(html) {
  return createHash('sha256')
    .update(stripLiveCatalogueMarkup(stripAnimatedLogo(stripSiteI18nBundle(stripLanguageSwitch(stripLangRoute(stripAssortmentView(html))))))
      .replace(/\.(css|js)\?v=[0-9a-f]+/g, '.$1')
      .replace(/[ \t]*<link\b(?=[^>]*\brel="(?:icon|shortcut icon|apple-touch-icon|mask-icon|manifest)")[^>]*>\n?/gi, '')
      .replace(/[ \t]*<meta\s+(?:property|name)="(?:og:image|twitter:image)(?::[a-z]+)?"[^>]*>\n?/gi, '')
      .replace(/[ \t]*<link\b(?=[^>]*\brel="alternate")(?=[^>]*\bhreflang=)[^>]*>\n?/gi, ''))
    .digest('hex').slice(0, 16);
}

/**
 * Pure: decides each URL's lastmod from its hash and the previous state.
 * Injecting `hashOf` keeps this testable without a filesystem, and keeps the
 * three properties that matter provable — one page changing moves one date, an
 * unchanged rebuild moves none, and a full regeneration is not a mass edit.
 */
export function resolveLastmod({ urls, hashOf, prev = {}, today }) {
  const next = {};
  const moved = [];
  for (const u of urls) {
    const hash = hashOf(u.loc);
    const before = prev[u.loc];
    if (before && before.hash === hash) {
      next[u.loc] = { hash, lastmod: before.lastmod };
    } else {
      next[u.loc] = { hash, lastmod: today };
      moved.push(u.loc);
    }
  }
  return { state: next, moved };
}

export function renderSitemap(urls, state) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${state[u.loc].lastmod}</lastmod>\n`
      + `    <changefreq>${u.freq}</changefreq>\n    <priority>${u.prio}</priority>\n  </url>`).join('\n')
    + '\n</urlset>\n';
}

function main() {
  const { countries } = loadCached();
  const urls = sitemapUrls(countries);
  const seeding = process.argv.includes('--seed');

  const override = process.env.SITEMAP_DATE;
  if (override && !/^\d{4}-\d{2}-\d{2}$/.test(override)) {
    console.error(`sitemap: SITEMAP_DATE=«${override}» не дата в формате YYYY-MM-DD`);
    process.exit(1);
  }
  const today = override || new Date().toISOString().slice(0, 10);

  // A state file that is absent, or valid JSON without a `pages` key, used to
  // fall back to {} — and every URL then looked new, so all 209 were stamped
  // today and the sitemap silently degraded into exactly the thing this file
  // replaced. Nothing gated on it; the only trace was a log line.
  let prev = {};
  if (existsSync(STATE)) {
    const raw = JSON.parse(readFileSync(STATE, 'utf8'));
    if (!raw || typeof raw.pages !== 'object' || raw.pages === null) {
      console.error(`sitemap: ${STATE} есть, но в нём нет объекта pages — почини или пересоздай с --seed`);
      process.exit(1);
    }
    prev = raw.pages;
  } else if (!seeding) {
    console.error('sitemap: seo/sitemap-lastmod.json отсутствует. Это состояние, а не кэш: без него все даты станут сегодняшними. Восстанови файл из git или пересоздай осознанно: node seo/build-sitemap.mjs --seed');
    process.exit(1);
  }

  const missing = [];
  const hashOf = (loc) => {
    const file = join(ROOT, fileFor(loc));
    if (!existsSync(file)) { missing.push(fileFor(loc)); return 'MISSING'; }
    return contentHash(readFileSync(file, 'utf8'));
  };

  const { state, moved } = resolveLastmod({ urls, hashOf, prev, today });

  // A sitemap entry with no page behind it is a 404 offered to a crawler. The
  // generators never delete (see handoff §22.3), so this is the shape a removed
  // country takes if the git rm is forgotten.
  if (missing.length) {
    console.error(`sitemap: нет файлов для ${missing.length} URL — ${missing.slice(0, 5).join(', ')}`);
    process.exit(1);
  }

  // Moving every date at once is never an ordinary build. It means the state
  // was lost, or the hash definition changed under it — both of which produce a
  // sitemap that claims the whole site changed today, which is the defect this
  // file exists to remove.
  if (!seeding && Object.keys(prev).length && moved.length === urls.length) {
    console.error(`sitemap: сдвинулись ВСЕ ${urls.length} дат. Так не бывает при обычной сборке — вероятно, изменилось определение хеша или потеряно состояние. Если это осознанно: node seo/build-sitemap.mjs --seed`);
    process.exit(1);
  }

  writeFileSync(join(ROOT, 'sitemap.xml'), renderSitemap(urls, state));
  // Sorted so the file is a stable diff rather than a reshuffle on every run.
  const ordered = Object.fromEntries(Object.keys(state).sort().map((k) => [k, state[k]]));
  writeFileSync(STATE, `${JSON.stringify({ pages: ordered }, null, 2)}\n`);
  console.log(`sitemap.xml: ${urls.length} URLs, lastmod сдвинут у ${moved.length}`);
  if (moved.length && moved.length <= 15) for (const m of moved) console.log(`  → ${m.slice(SITE.length)}`);
}

if (process.argv[1] && process.argv[1].endsWith('build-sitemap.mjs')) main();
