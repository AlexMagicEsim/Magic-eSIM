#!/usr/bin/env node
// Rebuilds sitemap.xml: canonical 200-pages only (home, hub, all country pages,
// guides, terms/privacy). Payment/tech pages excluded. Run: node seo/build-sitemap.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE } from './countries.mjs';
import { loadCached } from './catalogue-source.mjs';

// The catalogue decides which country pages exist. A hand-kept list is
// guaranteed to drift: a country added stays out of the sitemap, and one
// dropped keeps an entry pointing at a page that sells nothing.
const { countries: ALL } = loadCached();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TODAY = process.env.SITEMAP_DATE || new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, prio: '1.0', freq: 'weekly' },
  { loc: `${SITE}/esim/`, prio: '0.8', freq: 'weekly' },
  ...ALL.map((c) => ({ loc: `${SITE}/esim/${c.slug}/`, prio: '0.9', freq: 'weekly' })),
  { loc: `${SITE}/esim/compatibility/`, prio: '0.7', freq: 'monthly' },
  { loc: `${SITE}/esim/activation-before-travel/`, prio: '0.7', freq: 'monthly' },
  { loc: `${SITE}/esim/not-working/`, prio: '0.7', freq: 'monthly' },
  { loc: `${SITE}/esim/dual-sim-sms/`, prio: '0.7', freq: 'monthly' },
  { loc: `${SITE}/iphone.html`, prio: '0.7', freq: 'monthly' },
  { loc: `${SITE}/android.html`, prio: '0.7', freq: 'monthly' },
  { loc: `${SITE}/terms.html`, prio: '0.3', freq: 'yearly' },
  { loc: `${SITE}/privacy.html`, prio: '0.3', freq: 'yearly' },
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.prio}</priority>\n  </url>`).join('\n') + '\n</urlset>\n';
writeFileSync(join(ROOT, 'sitemap.xml'), xml);
console.log(`sitemap.xml: ${urls.length} URLs`);
