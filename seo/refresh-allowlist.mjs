// What a catalogue-driven rebuild is allowed to touch, and nothing else.
//
// WHY AN ALLOWLIST AND NOT A DENYLIST. The automation that uses this holds
// `contents: write` on a public repository and runs unattended six times a day.
// The thing it must never become is a way to get an arbitrary file onto a branch
// and in front of a reviewer who is scanning a 200-file diff for price changes.
// So the question is not «is this file dangerous» but «did the generators have
// any business writing it» — and anything outside that answer stops the run.
//
// THE COUNTRY PAGES ARE NOT A WILDCARD. `esim/*/index.html` would also match the
// five guides (compatibility, activation-before-travel, not-working,
// dual-sim-sms, payment-rubles), which `build-all.mjs` does not generate:
// build-guides.mjs is a separate command it never calls. A guide page that
// changed during a catalogue refresh would mean something unexpected happened,
// and matching it as «a country page» would hide exactly that. The permitted
// set is therefore the slugs the freshly built snapshot actually names.
//
// stamp-assets.mjs, which build-all runs last, walks EVERY .html file in the
// repository and rewrites any whose asset hashes moved. During a catalogue
// refresh none should move — no asset changed — so a stamped file outside this
// list is a real signal and not noise. Failing closed there is the point.

/** Generated files a catalogue refresh legitimately rewrites, by exact path. */
export const FIXED_ALLOWED = Object.freeze([
  'esim/index.html',              // the hub, from build-hub.mjs
  'sitemap.xml',                  // from build-sitemap.mjs
  'seo/catalogue-countries.json', // the snapshot every page generator reads
  'seo/fact-sheets.json',         // what the editorial gates check a claim against
  'seo/sitemap-lastmod.json',     // per-page content hashes behind <lastmod>
]);

/**
 * The full permitted set for one run.
 *
 * `countrySlugs` comes from the REBUILT seo/catalogue-countries.json, not from a
 * list kept here: a country the provider starts selling gets a page on the next
 * build, and a list maintained by hand would fail that run closed for no reason.
 */
export function allowedPaths(countrySlugs) {
  const out = new Set(FIXED_ALLOWED);
  for (const slug of countrySlugs || []) {
    if (typeof slug !== 'string' || !slug) continue;
    out.add(`esim/${slug}/index.html`);
  }
  return out;
}

/**
 * Paths that changed but had no business changing. Empty means proceed.
 *
 * Deliberately returns the paths rather than a boolean: the caller has to print
 * them, because «something unexpected changed» with no name attached is the kind
 * of failure people re-run rather than read.
 */
export function unexpectedPaths(changedPaths, countrySlugs) {
  const allowed = allowedPaths(countrySlugs);
  return (changedPaths || [])
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .filter((p) => !allowed.has(p))
    .sort();
}

/**
 * `git status --porcelain` into plain paths.
 *
 * Handles the three shapes that matter: an ordinary ` M path`, an untracked
 * `?? path`, and a rename `R  old -> new`, where it is the NEW path that exists
 * on disk. A quoted path (git quotes anything non-ASCII unless core.quotepath is
 * off) is returned quoted on purpose — it will not match the allowlist, and a
 * name we cannot read plainly is exactly the case to stop on rather than guess.
 */
export function parsePorcelain(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length > 3)
    .map((line) => {
      const rest = line.slice(3);
      const arrow = rest.indexOf(' -> ');
      return arrow === -1 ? rest : rest.slice(arrow + 4);
    })
    .map((p) => p.trim())
    .filter(Boolean);
}
