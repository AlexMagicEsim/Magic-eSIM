'use strict';

// TEST FIXTURES ONLY — never loaded by a page.
//
// The catalogue answer now carries the backend's layout of every country page
// (esim-backend lib/assortmentLayout.js; the storefront reads it through
// assets/assortment-view.js and decides nothing itself). Fixtures written
// before that carry rows only. `withLayout()` adds the layout the backend gives
// such a list in mode `legacy` — every plan, in its block, in the backend's
// one order — so a fixture still describes what a page draws:
//
//   blocks  coverage codes (coverage_country_codes + country_code + ISO tokens
//           of region, never RU/UA/BY); restricted and worldwide plans on no
//           page; DAILY -> daily; one counted country -> local; else regional.
//   order   local/regional: own-country first (regional), volume (unlimited
//           last), term, payable price, id; daily: allowance, payable price, id.
//   best    a local 10 GB (then 20 GB) plan with a 7-30 day term, lowest price
//           per GB, then price.
//
// A port of the backend's rules for fixtures, kept small on purpose; the
// backend's own tests pin the real thing.

const ISO2 = /^[A-Z]{2}$/;
const RESTRICTED = ['RU', 'UA', 'BY'];
const RESTRICTED_WORDS = ['russia', 'ukraine', 'belarus', 'россия', 'украина', 'беларусь'];
const UNCOUNTED = ['KT'];

function coverageCodes(p) {
  const out = [];
  const add = (c) => { const x = String(c == null ? '' : c).trim().toUpperCase(); if (ISO2.test(x) && !out.includes(x) && !RESTRICTED.includes(x)) out.push(x); };
  (Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : []).forEach(add);
  add(p.country_code);
  String(p.region || '').toUpperCase().split(/[\s,;/|+]+/).forEach(add);
  return out;
}
const restricted = (p) => RESTRICTED.includes(String(p.country_code || '').toUpperCase()) || RESTRICTED_WORDS.some((w) => String(p.name || '').toLowerCase().includes(w));
const worldwide = (p) => String(p.country_code || '').toUpperCase().startsWith('GL-') || String(p.name || '').toLowerCase().includes('global');
const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
function payable(p) {
  if (String(p.plan_type || '') === 'DAILY' && String(p.daily_term_mode || '') === 'PER_DAY') {
    const xs = (Array.isArray(p.term_prices) ? p.term_prices : []).map((t) => num(t && t.price)).filter((x) => x > 0);
    return xs.length ? Math.min(...xs) : Infinity;
  }
  return num(p.price) > 0 ? num(p.price) : Infinity;
}
const vol = (p) => (p.unlimited === true ? Infinity : (num(p.data_gb) > 0 ? num(p.data_gb) : Infinity));
const allow = (p) => (p.unlimited === true ? Infinity : (num(p.daily_gb) > 0 ? num(p.daily_gb) : Infinity));
const byId = (a, b) => (String(a.package_id) < String(b.package_id) ? -1 : String(a.package_id) > String(b.package_id) ? 1 : 0);

function layoutOf(rows) {
  const groups = new Map();
  for (const p of rows) {
    if (!p || p.package_id == null || restricted(p) || worldwide(p)) continue;
    const codes = coverageCodes(p);
    const counted = codes.filter((c) => !UNCOUNTED.includes(c)).length;
    for (const iso of codes) {
      const block = String(p.plan_type || '') === 'DAILY' ? 'daily' : counted === 1 ? 'local' : 'regional';
      if (!groups.has(iso)) groups.set(iso, { local: [], regional: [], daily: [] });
      groups.get(iso)[block].push(p);
    }
  }
  const countries = {};
  for (const iso of [...groups.keys()].sort()) {
    const g = groups.get(iso);
    const cmpV = (a, b) => {
      const own = (x) => (String(x.country_code || '').toUpperCase() === iso ? 0 : 1);
      return (own(a) - own(b)) || (vol(a) - vol(b) || 0) || ((num(a.validity_days) || 0) - (num(b.validity_days) || 0)) || (payable(a) - payable(b) || 0) || byId(a, b);
    };
    const local = g.local.slice().sort(cmpV);
    const regional = g.regional.slice().sort(cmpV);
    const daily = g.daily.slice().sort((a, b) => (allow(a) - allow(b) || 0) || (payable(a) - payable(b) || 0) || byId(a, b));
    const eligible = local.filter((p) => p.unlimited !== true && (num(p.data_gb) === 10 || num(p.data_gb) === 20)
      && num(p.validity_days) >= 7 && num(p.validity_days) <= 30 && Number.isFinite(payable(p)))
      .sort((a, b) => ((num(a.data_gb) === 10 ? 0 : 1) - (num(b.data_gb) === 10 ? 0 : 1))
        || (payable(a) / num(a.data_gb) - payable(b) / num(b.data_gb)) || (payable(a) - payable(b)) || byId(a, b));
    countries[iso] = {
      local: local.map((p) => String(p.package_id)),
      regional: regional.map((p) => String(p.package_id)),
      daily: daily.map((p) => String(p.package_id)),
      best: eligible.length ? String(eligible[0].package_id) : null,
    };
  }
  return { mode: 'legacy', regional_cap: 8, countries };
}

/** A catalogue body (`{ data: [...] }`, a snapshot `{ packages: [...] }`) with the layout added; a copy. */
function withLayout(body) {
  if (!body || typeof body !== 'object') return body;
  const rows = Array.isArray(body.data) ? body.data : Array.isArray(body.packages) ? body.packages : null;
  if (!rows || body.assortment) return body;
  return { ...body, assortment: layoutOf(rows) };
}

/**
 * The backend's one-country answer (esim-backend lib/globalCatalogueCountry.js + assortmentService.present):
 * the layout entry of `iso` only, `data` = the whole answer's objects for exactly its ids, in the whole answer's
 * order, `count` to match. null when the layout has no entry for it — the backend answers that 404
 * COUNTRY_NOT_FOUND. The body must already carry its layout (withLayout).
 */
function narrowToCountry(body, iso) {
  const entry = body && body.assortment && body.assortment.countries && body.assortment.countries[iso];
  if (!entry || !Array.isArray(body.data)) return null;
  const ids = new Set([...entry.local, ...entry.regional, ...entry.daily].map(String));
  const data = body.data.filter((p) => ids.has(String(p.package_id)));
  return { ...body, count: data.length, data, assortment: { ...body.assortment, countries: { [iso]: entry } } };
}

/** Playwright route answer for a GLOBAL catalogue request: narrowed when the URL names a country (as the backend). */
function globalAnswer(url, body, { narrow = true, status = 200 } = {}) {
  const iso = new URL(url).searchParams.get('country');
  if (!iso || !narrow || status !== 200) return { status, contentType: 'application/json', body: JSON.stringify(body) };
  const one = narrowToCountry(body, iso);
  return one
    ? { status: 200, contentType: 'application/json', body: JSON.stringify(one) }
    : { status: 404, contentType: 'application/json', body: JSON.stringify({ status: 'error', error: 'COUNTRY_NOT_FOUND' }) };
}

module.exports = { layoutOf, withLayout, coverageCodes, restricted, worldwide, narrowToCountry, globalAnswer };

/**
 * Playwright: serve the committed snapshot WITH its layout by default. Registered first (beforeEach), so a spec's own
 * route for the snapshot — registered later — still wins (Playwright matches the newest route first).
 */
async function defaultSnapshotRoute(context) {
  const fs = require('fs');
  const path = require('path');
  let doc = null;
  await context.route('**/assets/catalog.json*', (route) => {
    if (!doc) doc = withLayout(JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8')));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doc) });
  });
}

module.exports.defaultSnapshotRoute = defaultSnapshotRoute;
