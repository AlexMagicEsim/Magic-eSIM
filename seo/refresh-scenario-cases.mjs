// The catalogue moves seo/test-refresh-scenarios.mjs runs (seo/refresh-scenarios.mjs).
// Fixtures come from the current catalogue and profiles; see the header there.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, readJson, countryPageSlugs } from './refresh-scenarios.mjs';
import { countryFacts } from './catalogue-facts.mjs';

const CATALOG = () => readJson(join(ROOT, 'assets', 'catalog.json'));
const profilePath = (slug) => join(ROOT, 'seo', 'content-profiles', `${slug}.json`);
const isoOfPage = (slug) => {
  const h = readFileSync(join(ROOT, 'esim', slug, 'index.html'), 'utf8');
  return (h.match(/data-country-page="([A-Z]{2})"/) || [])[1] || null;
};
const only = (p, iso) => Array.isArray(p.coverage_country_codes) && p.coverage_country_codes.length === 1 && p.coverage_country_codes[0] === iso;
const covers = (p, iso) => Array.isArray(p.coverage_country_codes) && p.coverage_country_codes.includes(iso);
const scale = (p, k) => {
  p.price = Math.round(Number(p.price) * k / 50) * 50 || Number(p.price);
  if (Array.isArray(p.term_prices)) p.term_prices = p.term_prices.map((t) => ({ ...t, price: Math.max(50, Math.round(t.price * k / 50) * 50) }));
};
// The packages the provider gave KT (Northern Cyprus) on 2026-10-18.
const KT_FAMILY = /^(Turkey Premium|Greece Cyprus Turkey|Europe and USA) \d/;
// The unknown-code move uses the already-regional «Europe and USA» family only:
// added to «Turkey Premium» (TR + KT) a new code would also turn a plan the turkey
// profile prices as LOCAL into a regional one — a different scenario.
const UNKNOWN_FAMILY = /^Europe and USA \d/;
const addCode = (doc, code, family = KT_FAMILY) => {
  const hit = doc.packages.filter((p) => family.test(String(p.name || '')) && Array.isArray(p.coverage_country_codes));
  if (hit.length < 2) throw new Error('fixture: the family is not in the catalogue — re-point seo/refresh-scenario-cases.mjs');
  for (const p of hit) p.coverage_country_codes = [...p.coverage_country_codes.filter((c) => c !== code), code];
  return hit.length;
};
// The catalogue refresh's own guard, run in the scenario's copy.
const coverageGuard = (dir) => {
  const r = spawnSync(process.execPath, ['seo/check-country-coverage.mjs'], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
};
const termPrice = (p, days) => (Array.isArray(p.term_prices) ? (p.term_prices.find((t) => t.days === days) || {}).price : undefined);

/**
 * A template page (no authored profile) whose floor is a plan sold for that
 * country alone — so moving that country's own plans moves the floor and
 * touches no other page. The first such slug, alphabetically.
 */
export function templateFixture(packages = CATALOG().packages) {
  for (const slug of countryPageSlugs().sort()) {
    if (existsSync(profilePath(slug))) continue;
    const iso = isoOfPage(slug);
    if (!iso) continue;
    const own = packages.filter((p) => only(p, iso));
    if (own.length < 3) continue;
    const f = countryFacts(packages, iso);
    const ownMin = countryFacts(own, iso).min_price_rub;
    if (f.min_price_rub !== null && ownMin === f.min_price_rub) return { slug, iso, floor: f.min_price_rub, count: own.length };
  }
  throw new Error('no template fixture: no page without a profile whose floor is a single-country plan');
}

/** A named claim's term package id, or a loud error naming what to re-point. */
export function claimTerm(slug, kind, claimId, term) {
  const p = readJson(profilePath(slug));
  const list = kind === 'price' ? p.price_claims : p.coverage_claims;
  const c = (list || []).find((x) => x.id === claimId);
  if (!c) throw new Error(`fixture: ${slug} has no ${kind} claim «${claimId}» — re-point seo/refresh-scenario-cases.mjs`);
  if (kind === 'coverage') return c.packages[0];
  if (!c.terms[term] || !c.terms[term].package) throw new Error(`fixture: ${slug} · ${claimId} has no package term «${term}»`);
  return c.terms[term].package;
}

/** A {{price:<name>}} reference's package id, or a loud error naming what to re-point. */
export function tokenRef(slug, name) {
  const r = (readJson(profilePath(slug)).price_refs || {})[name];
  if (!r || !r.package) throw new Error(`fixture: ${slug} has no price_refs.${name} with a package — re-point seo/refresh-scenario-cases.mjs`);
  return r.package;
}

const byId = (doc, id) => {
  const p = doc.packages.find((x) => x.package_id === id);
  if (!p) throw new Error(`fixture: package ${id} is not in the catalogue — re-point seo/refresh-scenario-cases.mjs`);
  return p;
};

export function cases() {
  const tpl = templateFixture();
  return [
    {
      name: 'control: the catalogue does not move',
      mutate: () => ({}),
    },
    {
      name: 'prices DOWN on a template page (no authored text quotes them)',
      mutate: (doc) => { for (const p of doc.packages) if (only(p, tpl.iso)) scale(p, 0.8); return { tpl }; },
      inspect: ({ pageOf, doc }) => ({ floor: countryFacts(doc.packages, tpl.iso).min_price_rub, html: pageOf(tpl.slug) }),
    },
    {
      name: 'prices UP on a template page',
      mutate: (doc) => { for (const p of doc.packages) if (only(p, tpl.iso)) scale(p, 1.3); return { tpl }; },
      inspect: ({ pageOf, doc }) => ({ floor: countryFacts(doc.packages, tpl.iso).min_price_rub, html: pageOf(tpl.slug) }),
    },
    {
      name: 'a NEW offer below the floor on a template page',
      mutate: (doc) => {
        const base = doc.packages.find((p) => only(p, tpl.iso) && !Array.isArray(p.term_prices));
        const n = { ...JSON.parse(JSON.stringify(base)), package_id: '00000000-0000-4000-8000-0000000000aa', name: `${base.name} (scenario)` };
        n.price = Math.max(50, tpl.floor - 100);
        doc.packages.push(n);
        return { tpl, price: n.price };
      },
      inspect: ({ pageOf, doc }) => ({ floor: countryFacts(doc.packages, tpl.iso).min_price_rub, html: pageOf(tpl.slug) }),
    },
    {
      // Stage B: australia prints this amount through {{price:au_daily_500mb_3d}}.
      name: 'a package a {{price}} TOKEN prints moves (australia · au_daily_500mb_3d)',
      mutate: (doc) => {
        const p = byId(doc, tokenRef('australia', 'au_daily_500mb_3d'));
        p.term_prices = p.term_prices.map((t) => (t.days === 3 ? { ...t, price: t.price + 100 } : t));
        return { price: termPrice(p, 3) };
      },
      inspect: ({ pageOf, info }) => ({ html: pageOf('australia'), price: info.price }),
    },
    // «a package QUOTED with a hand-typed amount moves» was retired on 2026-10-24: the last hand-typed amounts (the former
    // SEO control pages) became {{price:…}} tokens, MAX_UNANCHORED is 0 (seo/test-price-inventory.mjs) — a moved price is
    // the «{{price}} token prints moves — GREEN» case below.
    {
      name: 'a package a {{price}} TOKEN names is WITHDRAWN (australia · aunz_5gb)',
      mutate: (doc) => {
        const id = tokenRef('australia', 'aunz_5gb');
        byId(doc, id);
        doc.packages = doc.packages.filter((p) => p.package_id !== id);
      },
    },
    {
      name: 'a stated relation FLIPS (montenegro · local-vs-balkans-daily: the local plan becomes dearer)',
      mutate: (doc) => {
        const local = byId(doc, claimTerm('montenegro', 'price', 'local-vs-balkans-daily', 'local'));
        const balkans = byId(doc, claimTerm('montenegro', 'price', 'local-vs-balkans-daily', 'balkans'));
        const b3 = termPrice(balkans, 3);
        local.term_prices = local.term_prices.map((t) => (t.days === 3 ? { ...t, price: b3 + 100 } : t));
      },
    },
    {
      name: 'a package a PRICE claim names is WITHDRAWN (sri-lanka · why-entry-vs-local · local)',
      mutate: (doc) => {
        const id = claimTerm('sri-lanka', 'price', 'why-entry-vs-local', 'local');
        byId(doc, id);
        doc.packages = doc.packages.filter((p) => p.package_id !== id);
      },
    },
    {
      name: 'a package a COVERAGE claim names is WITHDRAWN (australia · au-nz-daily-500mb)',
      mutate: (doc) => {
        const id = claimTerm('australia', 'coverage', 'au-nz-daily-500mb');
        byId(doc, id);
        doc.packages = doc.packages.filter((p) => p.package_id !== id);
      },
    },
    {
      name: 'a new offer makes a «cheapest» sentence false (sri-lanka: a local plan below the multi-country entry)',
      mutate: (doc) => {
        const multi = byId(doc, claimTerm('sri-lanka', 'price', 'why-entry-vs-local', 'multi'));
        const local = byId(doc, claimTerm('sri-lanka', 'price', 'why-entry-vs-local', 'local'));
        const n = JSON.parse(JSON.stringify(local));
        n.package_id = '00000000-0000-4000-8000-0000000000bb';
        n.name = `${local.name} (scenario)`;
        const m3 = termPrice(multi, 3);
        n.term_prices = n.term_prices.map((t) => ({ ...t, price: t.days === 3 ? Math.max(50, m3 - 50) : t.price }));
        doc.packages.push(n);
      },
    },
    {
      name: 'the provider adds a NAMED coverage-only code (KT, Northern Cyprus) to a package family',
      mutate: (doc) => ({ packages: addCode(doc, 'KT') }),
      inspect: ({ dir, pageOf }) => ({ guard: coverageGuard(dir), ktPage: !!pageOf('northern-cyprus') }),
    },
    {
      name: 'the provider adds an UNKNOWN code to a package family',
      mutate: (doc) => ({ packages: addCode(doc, 'XQ', UNKNOWN_FAMILY) }),
      inspect: ({ dir }) => ({ guard: coverageGuard(dir) }),
    },
    {
      name: 'a template country LOSES every plan (its page must be removed by a person)',
      mutate: (doc) => {
        doc.packages = doc.packages
          .filter((p) => !only(p, tpl.iso))
          .map((p) => (covers(p, tpl.iso) ? { ...p, coverage_country_codes: p.coverage_country_codes.filter((c) => c !== tpl.iso) } : p));
        return { tpl };
      },
      inspect: ({ pageOf }) => ({ pageStillThere: !!pageOf(tpl.slug) }),
    },
  ];
}
