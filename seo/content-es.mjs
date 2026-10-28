#!/usr/bin/env node
/* AUTHORED SPANISH COUNTRY CONTENT — seo/content-es/<slug>.json. The rules are seo/content-en.mjs's, run with the
 * Spanish entry of its CONTENT_LANGS (head suffix, block words, number and day figures, Spanish names and aliases,
 * seo/claim-guards.mjs `es`, /es/ links, «¿»). This module only binds them to the Spanish folder, with the same API as
 * seo/content-en.mjs (contentSlugs, loadContent, validateContent, checkAll, CONTENT_DIR) so a tool that discovers one
 * validator per language as seo/content-<prefix>.mjs finds it.
 *
 *   node seo/content-es.mjs --check [slug…]   (= node seo/content-en.mjs --check --lang es [slug…])
 */
import { pathToFileURL } from 'node:url';
import * as base from './content-en.mjs';

export const LANG = 'es';
export const CONTENT_DIR = base.contentDir(LANG);
export const CONTENT_COPY = base.CONTENT_LANGS[LANG].copy;
export const contentSlugs = (dir = CONTENT_DIR) => base.contentSlugs(dir);
export const loadContent = (slug, dir = CONTENT_DIR) => base.loadContent(slug, dir);
export const validateContent = (doc, opts = {}) => base.validateContent(doc, { ...opts, lang: LANG });
export const checkAll = (slugs, opts = {}) => base.checkAll(slugs, { ...opts, lang: LANG });
export const crossProblems = (docs, countries) => base.crossProblems(docs, countries, LANG);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] !== '--check') { console.error('usage: node seo/content-es.mjs --check [slug…]'); process.exit(2); }
  const res = checkAll(args.slice(1).length ? args.slice(1) : contentSlugs());
  let n = 0;
  for (const [slug, problems] of Object.entries(res)) {
    if (!problems.length) { if (slug !== '_cross') console.log(`ok   ${slug}`); continue; }
    n += problems.length;
    console.log(`FAIL ${slug === '_cross' ? 'across files' : slug}`);
    for (const p of problems) console.log(`     - ${p}`);
  }
  process.exit(n ? 1 : 0);
}
