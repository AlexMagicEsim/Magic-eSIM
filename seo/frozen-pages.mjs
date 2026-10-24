// Pages whose HTML structure must not change until the Google SEO pilot verdict
// (~2026-12-07; handoff 10-11 §5j): the five pilot pages and their five
// controls. Generated numbers keep updating there as before (the catalogue
// refresh rebuilds them); NEW mechanisms — the live catalogue numbers of
// assets/catalog-numbers.js, stage C — are not added to them until the verdict.
// seo/test-live-numbers.mjs holds these lists equal to seo/test-seo-pilot.mjs.
export const SEO_PILOT_PAGES = Object.freeze(['uae', 'egypt', 'georgia', 'uzbekistan', 'italy']);
export const SEO_CONTROL_PAGES = Object.freeze(['cyprus', 'spain', 'usa', 'albania', 'kyrgyzstan']);
export const FROZEN_PAGES = Object.freeze(new Set([...SEO_PILOT_PAGES, ...SEO_CONTROL_PAGES]));
export const isFrozenPage = (slug) => FROZEN_PAGES.has(slug);

// 2026-10-24 (owner, variant «Б»): the plan cards of ALL these pages switched to the B1 card (data-cards="compact", the
// brand book v1.2) — pilot and control on the same day. Their titles, descriptions, hero, block order and the absence of the
// live numbers stay as above. A before/after comparison of either group must split at this date (owner: never pool the
// results across it without a separate analysis).
export const CARDS_B1_SINCE = '2026-10-24';

// 2026-10-24 (owner): the original SEO experiment ENDED — its ten pages now have the same page structure as every other RU
// country page (the English reference: short hero, plans first, the authored texts under the plans). Results before and after
// this date are never pooled. The lists above stay as the record of the two groups and still drive seo/indexing.mjs (not in the
// indexing stages, no hreflang cluster) and seo/price-tokens.mjs — each a separate owner decision.
export const EXPERIMENT_ENDED = '2026-10-24';

