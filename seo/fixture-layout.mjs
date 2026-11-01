// TESTS ONLY — a published layout for a synthetic or mutated catalogue.
//
// Since 2026-11-01 every authored claim is checked on the backend's published
// layout (assets/catalog.json `assortment.countries`, seo/plan-ref.mjs), never
// on a view rebuilt from coverage codes. A rule test therefore has to say what
// the backend published for its little world, and a mutation test of the live
// catalogue has to say what the backend would publish after the mutation. This
// file is that statement, and nothing else: no generator imports it
// (seo/test-plan-refs.mjs pins that), so it can never become a second
// assortment.
//
//   layoutByCoverage(packages)   a world where every visible plan is shown on
//                                every page its coverage names (fixtures)
//   republish(base, packages)    the live layout after a mutation: a withdrawn or
//                                hidden plan leaves every page, a plan that loses
//                                a country leaves that page, a new plan or a new
//                                country is appended at the END of its block

import { pageBlocks, storefrontVisible } from './coverage-claims.mjs';
import { coverageCodes, isDaily, isMultiCountry } from './catalogue-facts.mjs';
import { BLOCKS } from './plan-ref.mjs';

const kindOf = (p) => (isDaily(p) ? 'daily' : isMultiCountry(p) ? 'regional' : 'local');

/** { packages, assortment: { countries } } with every visible plan on every page it covers. */
export function layoutByCoverage(packages, extra = {}) {
  const countries = {};
  const isos = new Set(packages.flatMap((p) => coverageCodes(p)));
  for (const iso of [...isos].sort()) {
    const b = pageBlocks(packages, iso);
    countries[iso] = { local: b.local.map((p) => p.package_id), regional: b.regional.map((p) => p.package_id), daily: b.daily.map((p) => p.package_id), best: null };
  }
  return { ...extra, packages, assortment: { mode: 'on', regional_cap: 8, countries } };
}

/** `base` (a snapshot) re-laid for `packages` — what the backend would publish after the change. */
export function republish(base, packages) {
  const before = new Map(base.packages.map((p) => [p.package_id, p]));
  const now = new Map(packages.map((p) => [p.package_id, p]));
  const countries = {};
  for (const [iso, entry] of Object.entries(base.assortment.countries)) {
    countries[iso] = { ...entry };
    for (const b of BLOCKS) {
      countries[iso][b] = (entry[b] || []).filter((id) => {
        const p = now.get(id);
        return p && storefrontVisible(p) && coverageCodes(p).includes(iso) && kindOf(p) === b;
      });
    }
  }
  const shownBefore = (id) => Object.keys(base.assortment.countries).filter((iso) => BLOCKS.some((b) => (base.assortment.countries[iso][b] || []).includes(id)));
  for (const p of packages) {
    if (!storefrontVisible(p)) continue;
    const old = before.get(p.package_id);
    const block = kindOf(p);
    let add;
    if (!old) add = coverageCodes(p);
    else if (kindOf(old) !== block) add = shownBefore(p.package_id).filter((iso) => coverageCodes(p).includes(iso));
    else add = coverageCodes(p).filter((iso) => !coverageCodes(old).includes(iso));
    for (const iso of add) {
      if (!countries[iso]) countries[iso] = { local: [], regional: [], daily: [], best: null };
      if (!countries[iso][block].includes(p.package_id)) countries[iso][block] = [...countries[iso][block], p.package_id];
    }
  }
  return { ...base, packages, package_count: packages.length, assortment: { ...base.assortment, countries } };
}
