'use strict';

// What en/plans.js says about a plan, as one fingerprint per function.
//
// I18N-08b moved every word the English plan helpers used to type inline into
// assets/site-i18n.js (and the dollar format into `fmt.numberLocale`). This
// walks each helper over a FROZEN sample of the GLOBAL catalogue (the fixture
// next to this file — not the live catalogue, which the provider sync moves)
// and hashes what comes out. en-plans-golden.json holds the hashes the code
// produced BEFORE the move (storefront 17f18445); seo/test-en-browser-words.mjs
// asserts the code produces them still.
//
// Every script runs in its own vm context, so the same function can fingerprint
// another tree (`fingerprint(otherRoot)`) without sharing a global.

const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const SCRIPTS = ['assets/site-i18n.js', 'assets/country-names-en.js', 'assets/daily-plan-copy.js', 'en/plans.js', 'en/checkout.js'];
const AMOUNTS = [0.5, 1, 2.99, 9.99, 10, 12.3, 73.99, 99.99, 100, 1234.5, 435.99];

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function load(root) {
  const ctx = { console, Intl, Math, JSON, Date, Number, String, Array, Object, isFinite };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of SCRIPTS) vm.runInContext(readFileSync(join(root, f), 'utf8'), ctx, { filename: f });
  const PLANS = ctx.MagicEnPlans.create({ I18N: ctx.MagicSiteI18n.createI18n('en'), NAMES: ctx.MagicCountryNamesEn, DAILY: ctx.MagicDailyPlan });
  return { PLANS, CHECKOUT: ctx.MagicEnCheckout };
}

function fingerprint(root, sample) {
  const { PLANS, CHECKOUT } = load(root);
  const list = sample || JSON.parse(readFileSync(join(__dirname, 'en-plans-catalogue.json'), 'utf8')).packages;
  const each = (fn) => list.map((p) => fn(p));
  const focus = (p) => PLANS.coverageCodes(p).slice(0, 2);
  const isos = [...new Set(list.flatMap((p) => PLANS.coverageCodes(p)))].sort();
  const out = {
    money: AMOUNTS.map((a) => PLANS.money(a)),
    priceOf: each(PLANS.priceOf),
    priceText: each(PLANS.priceText),
    dataText: each(PLANS.dataText),
    termText: each(PLANS.termText),
    coverageCodes: each(PLANS.coverageCodes),
    coverageText: each((p) => [PLANS.coverageText(p), ...focus(p).map((c) => PLANS.coverageText(p, c)), PLANS.coverageText(p, 'ZZ')]),
    alsoCovers: each((p) => focus(p).flatMap((c) => [PLANS.alsoCovers(p, c), PLANS.alsoCovers(p, c, 1), PLANS.alsoCovers(p, c, 50)])),
    networkLabel: each(PLANS.networkLabel),
    ipLabel: each(PLANS.ipLabel),
    ladder: each(PLANS.ladder),
    durations: each(CHECKOUT.durations),
    restricted: each((p) => [PLANS.isRestricted(p), PLANS.isWorldwide(p)]),
    classify: isos.map((iso) => {
      const b = PLANS.classify(list, iso);
      const ids = (xs) => xs.map((p) => p.package_id);
      return [iso, ids(b.local), ids(b.regional), ids(b.daily),
        PLANS.distinguishers(b.local), PLANS.distinguishers(b.regional), PLANS.distinguishers(b.daily)];
    }),
  };
  const hashes = {};
  for (const [k, v] of Object.entries(out)) hashes[k] = digest(v);
  return { hashes, counts: { packages: list.length, countries: isos.length } };
}

module.exports = { fingerprint, digest, SCRIPTS };
