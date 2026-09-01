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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE = join(ROOT, 'seo/sitemap-lastmod.json');

// The catalogue decides which country pages exist. A hand-kept list is
// guaranteed to drift: a country added stays out of the sitemap, and one
// dropped keeps an entry pointing at a page that sells nothing.
export function sitemapUrls(countries) {
  return [
    { loc: `${SITE}/`, prio: '1.0', freq: 'weekly' },
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
export function contentHash(html) {
  return createHash('sha256').update(String(html).replace(/\.(css|js)\?v=[0-9a-f]+/g, '.$1')).digest('hex').slice(0, 16);
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
