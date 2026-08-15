#!/usr/bin/env node
// CI invariant: no destination reaches the storefront as a bare ISO code.
//
// This is the guard that was missing. A country the provider adds arrives
// entirely without human involvement — sync writes it, the API serves it, and
// refresh-catalog-cache.yml commits it into assets/catalog.json six times a day
// — while the name it is displayed under used to come from a hand-typed list.
// The two were never compared, so 34 codes had been rendering as themselves
// (`BN 10 GB`) for as long as nobody happened to look.
//
// So: take every country code the catalogue can actually put on screen, and
// require the RUNTIME dictionary to name it. Not the SEO dictionary — that one
// is already complete, which is exactly why checking it proved nothing.
//
//   node seo/check-country-coverage.mjs                  # against assets/catalog.json
//   node seo/check-country-coverage.mjs <file.json>      # against any catalogue snapshot
//
// Exit 1 lists the offending codes. In the refresh workflow this runs after the
// cache is rebuilt and before it is committed, so an unnamed destination stops
// the pipeline instead of reaching a customer.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COUNTRY_NAMES as SEO_NAMES } from './country-names.mjs';
import { buildDictionary } from './build-country-dictionary.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The codes the renderer can reach — mirrors packageCoverageCodes(). */
export function catalogueCodes(packages) {
  const counts = new Map();
  const bump = (code, titled) => {
    const entry = counts.get(code) || { packages: 0, titles: 0 };
    entry.packages += 1;
    if (titled) entry.titles += 1;
    counts.set(code, entry);
  };

  for (const item of packages) {
    const coverage = Array.isArray(item.coverage_country_codes) ? item.coverage_country_codes : [];
    const codes = new Set(
      coverage.map((c) => String(c || '').trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)),
    );
    const direct = String(item.country_code || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(direct)) codes.add(direct);
    String(item.region || '')
      .toUpperCase()
      .split(/[\s,;/|+]+/)
      .map((c) => c.trim())
      .filter((c) => /^[A-Z]{2}$/.test(c))
      .forEach((c) => codes.add(c));

    // A single-coverage package has its title rebuilt from the code, so an
    // unnamed one there is a broken CARD, not merely a broken chip.
    const unique = [...new Set(coverage.map((c) => String(c || '').trim().toUpperCase()))];
    const titledBy = unique.length === 1 ? unique[0] : null;
    for (const code of codes) bump(code, code === titledBy);
  }
  return counts;
}

function loadCatalogue(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const packages = Array.isArray(raw) ? raw : raw.packages || raw.data || [];
  if (!packages.length) {
    console.error(`no packages in ${file} — refusing to pass a check that examined nothing`);
    process.exit(2);
  }
  return packages;
}

function main() {
  const file = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, 'assets', 'catalog.json');
  const packages = loadCatalogue(file);
  const dict = buildDictionary();
  const counts = catalogueCodes(packages);

  const missing = [...counts.entries()]
    .filter(([code]) => !Object.prototype.hasOwnProperty.call(dict, code))
    .sort((a, b) => b[1].titles - a[1].titles || b[1].packages - a[1].packages);

  console.log(`catalogue        : ${file}`);
  console.log(`packages         : ${packages.length}`);
  console.log(`distinct codes   : ${counts.size}`);
  console.log(`dictionary       : ${Object.keys(dict).length} entries`);

  if (!missing.length) {
    console.log('result           : every displayed country code has a name');
    return;
  }

  console.error(`result           : ${missing.length} code(s) have NO customer-facing name`);
  for (const [code, { packages: n, titles }] of missing) {
    const known = SEO_NAMES[code] ? `seo/country-names.mjs has "${SEO_NAMES[code].ru}"` : 'ABSENT from seo/country-names.mjs too — add it there';
    console.error(`  ${code}  packages=${n}  cards titled with the bare code=${titles}  -> ${known}`);
  }
  console.error('');
  console.error('Add the name to seo/country-names.mjs, then run:');
  console.error('  node seo/build-country-dictionary.mjs');
  process.exit(1);
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedDirectly) main();
