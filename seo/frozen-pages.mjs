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
