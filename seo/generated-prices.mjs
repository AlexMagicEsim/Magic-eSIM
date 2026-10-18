// The «от N ₽» the generator prints outside the facts block must be the catalogue
// floor — everywhere it is printed.
//
// seo/build-catalogue-pages.mjs writes the country's minimum purchasable price
// into the generated meta description (and its og:/twitter: copies), the
// WebPage description in JSON-LD, and the template FAQ answer «Цены начинаются
// от N ₽.» — visible AND inside FAQPage. seo/test-catalogue-sync.mjs (C2) checks
// the facts block only; seo/test-seo-pilot.mjs checks the five pilot pages'
// title, description and AggregateOffer. This covers the rest, so a hand edit,
// a template change or a stale rebuild cannot leave one copy behind.
//
// Authored pages (a profile with its own description) do not use the generated
// meta sentence; only what is found is checked, and the test pins that the
// patterns are found on most pages so the check cannot pass by matching nothing.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countryFacts } from './catalogue-facts.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const NB = '[\\d\\u00A0\\u202F\\u2009\\u2007 ]';
const toNum = (s) => Number(String(s).replace(/[^\d]/g, ''));

// The generated meta sentence: «…, от N ₽. Оплата рублями, QR-код на почту.»
const META_TAIL = new RegExp(`от\\s*(${NB}+?)\\s*₽\\. Оплата рублями, QR-код на почту\\.`, 'g');
// The template FAQ answer.
const FAQ_FLOOR = new RegExp(`Цены начинаются от (${NB}+?) ₽\\.`, 'g');

/** Country pages: { slug, iso, html }. */
export function countryPages(root = ROOT) {
  const out = [];
  for (const d of readdirSync(join(root, 'esim'))) {
    const f = join(root, 'esim', d, 'index.html');
    if (!existsSync(f)) continue;
    const html = readFileSync(f, 'utf8');
    const iso = (html.match(/data-country-page="([A-Z]{2})"/) || [])[1];
    if (iso) out.push({ slug: d, iso, html });
  }
  return out;
}

function parts(html) {
  const head = (html.match(/<head>[\s\S]*?<\/head>/) || [''])[0];
  const metas = (head.match(/<meta[^>]+(?:name="description"|property="og:description"|name="twitter:description")[^>]*>/g) || []);
  const ld = (html.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).join('\n');
  const body = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<head>[\s\S]*?<\/head>/, ' ');
  return { metas: metas.join('\n'), ld, body };
}

/**
 * Every generated floor on every page compared with the catalogue.
 * @returns {{ problems: string[], seen: { meta: number, ldMeta: number, faq: number, ldFaq: number } }}
 */
export function generatedPriceProblems(pages, packages) {
  const problems = [];
  const seen = { meta: 0, ldMeta: 0, faq: 0, ldFaq: 0 };
  for (const { slug, iso, html } of pages) {
    const min = countryFacts(packages, iso).min_price_rub;
    const { metas, ld, body } = parts(html);
    const check = (where, text, re, counter) => {
      let found = false;
      for (const m of text.matchAll(re)) {
        found = true;
        const n = toNum(m[1]);
        if (min === null) problems.push(`${slug}: ${where} says «от ${n} ₽», but the catalogue sells nothing here`);
        else if (n !== min) problems.push(`${slug}: ${where} says «от ${n} ₽», catalogue floor is ${min} ₽`);
      }
      if (found) seen[counter] += 1;
    };
    check('meta description', metas, META_TAIL, 'meta');
    check('JSON-LD description', ld, META_TAIL, 'ldMeta');
    check('FAQ', body, FAQ_FLOOR, 'faq');
    check('FAQPage JSON-LD', ld, FAQ_FLOOR, 'ldFaq');
  }
  return { problems, seen };
}
