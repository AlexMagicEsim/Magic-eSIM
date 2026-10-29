// How many country pages the committed catalogue gives every language — the one number the count tests compare with.
//
// WHY NOT A LITERAL. A country page exists exactly when the catalogue sells something for that country
// (seo/catalogue-source.mjs decides it; the generators never delete). So the number of pages moves with the
// provider: 199 → 198 when Zimbabwe was withdrawn (2026-10-26, #154), back to 199 when it returned (2026-10-29).
// With «198» typed into two dozen tests, every such move stopped the catalogue bot's SEO refresh on tests that
// had nothing to say about the move. The tests keep their intent — every page present, every list complete,
// every link unique — and take the count from the same snapshot the generators read, seo/catalogue-countries.json.
// A count that disagrees with it is still a failure; a count that merely follows the catalogue is not.
//
// The «190+ направлений» wording keeps its own floor test (seo/test-*), untouched: that is a promise in the copy,
// not a page count.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const snapshot = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8'));

/** The country slugs that have a page, in the snapshot's order. */
export const COUNTRY_SLUGS = Object.freeze(snapshot.countries.map((c) => c.slug));

/** The number of country pages per language (the same for RU and every published prefixed language). */
export const COUNTRY_PAGES = COUNTRY_SLUGS.length;

// A snapshot that lost most of its countries is not a reason for every count test to agree with it.
if (!(COUNTRY_PAGES >= 150)) throw new Error(`seo/catalogue-countries.json: ${COUNTRY_PAGES} countries — not a real catalogue`);
