// THE REGION PAGES — Europe, Asia, Global (international SEO stage 4, 2026-10-27). One place for what a region IS.
//
// A region page lists the multi-country plans the USD catalogue's own layout shows in the «regional» block of some
// country page (assortment.countries[*].regional — the backend decides which plans those are; nothing here chooses,
// sorts or filters a plan), grouped into COVERAGE SETS: one set = one distinct list of ISO codes a plan covers.
// scripts/update-global-plan-facts.mjs stores those sets in seo/global-plan-facts.json (`regions`), facts only.
//
// WHICH REGION A SET BELONGS TO is decided by a rule over its CODES, never by a provider's plan name (a plan called
// «Asia-20» covers Australia, Israel and Saudi Arabia; one called «Europe (35 areas)» does not cover France):
//   1. global — the set covers at least GLOBAL_MIN_CODES destinations;
//   2. europe — otherwise, the set covers at least SET_MIN_CODES destinations and at least SHARE_MIN of its codes are
//      in EUROPE_CODES (the UN M49 geoscheme's Europe, region 150, every ISO code it lists);
//   3. asia — the same test against ASIA_CODES (UN M49 Eastern, South-eastern, Southern and Central Asia: regions 030,
//      035, 034, 143). Western Asia (145, the Middle East) is deliberately NOT in it: a traveller reading «Asia» means
//      the East, South-East and South; Middle-East plans (Gulf, MENA) are their own travel region and get no page here;
//   4. anything else (a pair or a trio, the Americas, Africa, «Europe + Asia + USA» at ~half European) is in no region.
// A set may cover places outside its region (a Europe set that also covers the United States): the page prints the
// codes as they are — that is the point of listing coverage destination by destination.
//
// NEVER on a region page: «EU», «Schengen», «all of Europe» or any coverage word for a whole region; a provider's family
// name; a count taken from a name («35 areas»); a price; RU, UA or BY (LEFT_OUT — the snapshot drops them at write time).
//
// INDEXING: every region page is `noindex, follow` (seo/indexing.mjs INDEXED_REGIONS is empty). Global in particular
// stays out until the owner decides the «Best World» question (its coverage lists RU/BY; CLAUDE.md, open decision).

/** The region pages, in display order. Their slugs live beside the country slugs under /<prefix>/esim/, so none may
 *  ever be a country slug (seo/test-region-pages.mjs; the generator refuses a collision). */
export const REGION_SLUGS = Object.freeze(['europe', 'asia', 'global']);

export const GLOBAL_MIN_CODES = 100;
export const SET_MIN_CODES = 5;
export const SHARE_MIN = 0.75;

/* UN M49, Europe (150): Eastern, Northern, Southern and Western Europe — ISO 3166-1 codes only (Kosovo has none). */
export const EUROPE_CODES = Object.freeze([
  'BG', 'BY', 'CZ', 'HU', 'MD', 'PL', 'RO', 'RU', 'SK', 'UA', // Eastern Europe (151)
  'AX', 'DK', 'EE', 'FI', 'FO', 'GB', 'GG', 'IE', 'IM', 'IS', 'JE', 'LT', 'LV', 'NO', 'SE', 'SJ', // Northern Europe (154)
  'AD', 'AL', 'BA', 'ES', 'GI', 'GR', 'HR', 'IT', 'ME', 'MK', 'MT', 'PT', 'RS', 'SI', 'SM', 'VA', // Southern Europe (39)
  'AT', 'BE', 'CH', 'DE', 'FR', 'LI', 'LU', 'MC', 'NL', // Western Europe (155)
]);

/* UN M49, Asia (142) WITHOUT Western Asia (145). */
export const ASIA_CODES = Object.freeze([
  'CN', 'HK', 'JP', 'KP', 'KR', 'MN', 'MO', 'TW', // Eastern Asia (030)
  'BN', 'ID', 'KH', 'LA', 'MM', 'MY', 'PH', 'SG', 'TH', 'TL', 'VN', // South-eastern Asia (035)
  'AF', 'BD', 'BT', 'IN', 'IR', 'LK', 'MV', 'NP', 'PK', // Southern Asia (034)
  'KG', 'KZ', 'TJ', 'TM', 'UZ', // Central Asia (143)
]);

const ISO = /^[A-Z]{2}$/;

/** The region of one coverage set (its ISO codes), or null. Pure; the codes decide, nothing else. */
export function regionOf(codes) {
  const list = [...new Set((codes || []).filter((c) => ISO.test(c)))];
  if (list.length >= GLOBAL_MIN_CODES) return 'global';
  if (list.length < SET_MIN_CODES) return null;
  const share = (ref) => list.filter((c) => ref.includes(c)).length / list.length;
  if (share(EUROPE_CODES) >= SHARE_MIN) return 'europe';
  if (share(ASIA_CODES) >= SHARE_MIN) return 'asia';
  return null;
}

/* A set CLOSE TO A LINE: the rule is a threshold, so a provider adding or dropping one code can move a set out of its
 * region (or into one) and the page would change without anyone deciding it. Measured 2026-10-27: one Asia set sits at
 * exactly 15 of 20 (75 %). The facts updater warns about every set within MARGIN of a line, and about every set of the
 * previous snapshot that no longer appears (seo/test-region-pages.mjs). */
export const MARGIN = 0.05;
export function nearLine(codes) {
  const list = [...new Set((codes || []).filter((c) => ISO.test(c)))];
  if (!list.length) return null;
  const share = (ref) => list.filter((c) => ref.includes(c)).length / list.length;
  const notes = [];
  if (Math.abs(list.length - GLOBAL_MIN_CODES) <= 10) notes.push(`${list.length} codes, the global line is ${GLOBAL_MIN_CODES}`);
  if (list.length >= SET_MIN_CODES && list.length < GLOBAL_MIN_CODES) {
    for (const [name, ref] of [['Europe', EUROPE_CODES], ['Asia', ASIA_CODES]]) {
      const s = share(ref);
      if (Math.abs(s - SHARE_MIN) <= MARGIN) notes.push(`${name} share ${(s * 100).toFixed(1)} %, the line is ${SHARE_MIN * 100} %`);
    }
  }
  if (Math.abs(list.length - SET_MIN_CODES) <= 1 && list.length < GLOBAL_MIN_CODES) notes.push(`${list.length} codes, the smallest region set is ${SET_MIN_CODES}`);
  return notes.length ? notes.join('; ') : null;
}

/* ------------------------------------------------------------------------------------------------------------------
 * CLAIMS ABOUT A REGION (for any authored sentence a region page may carry later — CONTENT.md §2.4). A sentence about
 * coverage is pinned to one of three kinds, checked against the snapshot, and a catalogue move that breaks one makes
 * regionClaimProblems() report it (the build stops; the sentence is rewritten, never the check loosened):
 *   { kind: 'region_includes', region, code }        — at least one set of the region covers `code`;
 *   { kind: 'region_excludes_some', region, code }   — at least one set of the region does NOT cover `code`;
 *   { kind: 'region_together', region, codes: [...] } — ONE set of the region covers every one of `codes`.
 * ------------------------------------------------------------------------------------------------------------------ */
export const CLAIM_KINDS = Object.freeze(['region_includes', 'region_excludes_some', 'region_together']);

/** Problems with one claim against the facts document ({ regions }); [] when it holds. */
export function regionClaimProblems(claim, facts) {
  if (!claim || !CLAIM_KINDS.includes(claim.kind)) return [`unknown claim kind ${claim && claim.kind}`];
  if (!REGION_SLUGS.includes(claim.region)) return [`unknown region ${claim.region}`];
  const sets = (facts && facts.regions && facts.regions[claim.region] && facts.regions[claim.region].sets) || [];
  if (!sets.length) return [`${claim.region}: the snapshot has no coverage set`];
  const codes = claim.kind === 'region_together' ? claim.codes : [claim.code];
  if (!Array.isArray(codes) || !codes.length || codes.some((c) => !ISO.test(c))) return [`${claim.kind}: codes must be ISO codes`];
  if (claim.kind === 'region_together' && codes.length < 2) return ['region_together needs at least two codes'];
  const holds = {
    region_includes: () => sets.some((s) => s.codes.includes(codes[0])),
    region_excludes_some: () => sets.some((s) => !s.codes.includes(codes[0])),
    region_together: () => sets.some((s) => codes.every((c) => s.codes.includes(c))),
  }[claim.kind]();
  return holds ? [] : [`${claim.kind} ${claim.region} ${codes.join('+')}: false against the snapshot`];
}
