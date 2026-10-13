/* =====================================================================
 * build-country-dictionary-en — the English country names, for the browser.
 * ---------------------------------------------------------------------
 * The English entry point of seo/build-country-dictionary-locale.mjs, which
 * builds the names file of every published prefixed language (I18N-08c). Kept
 * so the command, the exports and the file's own header stay what they were:
 *
 *   node seo/build-country-dictionary-en.mjs
 *
 * `seo/test-country-names-en.mjs` fails if the committed file and the
 * generator disagree, so the check is not «somebody remembered to run it».
 * ================================================================== */
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderNames, writeNames, namesFile } from './build-country-dictionary-locale.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = join(ROOT, namesFile('en').rel);

export function render() {
  return renderNames('en');
}

// Compared as PATHS, not as URL strings. This repository lives under
// «Magic eSIM Site» — a directory with a space — and `import.meta.url`
// percent-encodes it, so the usual `file://${process.argv[1]}` comparison is
// false here and the generator silently does nothing.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  writeNames('en');
  console.log(`country-names-en: ${Object.keys(COUNTRY_NAMES).length} names -> ${OUT}`);
}
