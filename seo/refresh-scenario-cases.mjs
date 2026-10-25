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
      // 2026-10-25: re-pointed from local-vs-balkans-daily (the Balkans daily plans left the assortment) to the claim that
      // replaced it. Both terms are fixed-volume plans printed through {{price:local_20gb}} / {{price:eu_usa_18gb}}.
      name: 'a stated relation FLIPS (montenegro · local-20gb-below-regional-18gb: the local plan becomes dearer)',
      mutate: (doc) => {
        const local = byId(doc, claimTerm('montenegro', 'price', 'local-20gb-below-regional-18gb', 'local'));
        const regional = byId(doc, claimTerm('montenegro', 'price', 'local-20gb-below-regional-18gb', 'regional'));
        local.price = Number(regional.price) + 100;
      },
    },
    {
      // 2026-10-25 (after the 590-plan activation): why-entry-vs-local is gone with its sentence (the cheapest entry on the
      // Sri Lanka page is now a 1 GB / 7 days card). The withdrawn package is the local 3 GB / 15 days plan of
      // faq-3gb-30-not-dearer-than-15 — a claim term, not a {{price}} token.
      name: 'a package a PRICE claim names is WITHDRAWN (sri-lanka · faq-3gb-30-not-dearer-than-15 · d15)',
      mutate: (doc) => {
        const id = claimTerm('sri-lanka', 'price', 'faq-3gb-30-not-dearer-than-15', 'd15');
        byId(doc, id);
        doc.packages = doc.packages.filter((p) => p.package_id !== id);
      },
    },
    {
      // 2026-10-25: re-pointed from australia · au-nz-daily-500mb (the AU+NZ daily family left the assortment). After the
      // assortment NO package is named by a coverage claim AND a price claim without also being a {{price}} token (a token
      // stops the build instead — the stage B case) or being the last plan of a country (Caribbean 3 GB is Sint Maarten's
      // only plan — the «LOSES every plan» case). So this case is now coverage alone: North America 5GB/Day, named only by
      // usa's coverage claim (no authored «факт» rests on it, unlike LatAm 50 GB or EU 60 GB, whose withdrawal also turns
      // the facts gate red); withdrawing a package a price claim names is the sri-lanka case above.
      name: 'a package a COVERAGE claim names is WITHDRAWN (usa · north-america-daily)',
      mutate: (doc) => {
        const id = claimTerm('usa', 'coverage', 'north-america-daily');
        byId(doc, id);
        doc.packages = doc.packages.filter((p) => p.package_id !== id);
      },
    },
    {
      // 2026-10-25 (after the 590-plan activation): re-pointed from sri-lanka · cheapest-is-not-local (its sentence is
      // gone) to greece · cheapest-entry-1gb, «the cheapest entry is the local 1 GB / 7 days card»: a second local card
      // below it makes that false.
      name: 'a new offer makes a «cheapest» sentence false (greece: a local plan below the 1 GB / 7 days entry)',
      mutate: (doc) => {
        const g1 = byId(doc, claimTerm('greece', 'price', 'cheapest-entry-1gb', 'g1'));
        const n = JSON.parse(JSON.stringify(g1));
        n.package_id = '00000000-0000-4000-8000-0000000000bb';
        n.name = `${g1.name} (scenario)`;
        n.price = Math.max(50, Number(g1.price) - 50);
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
          .map((p) => {
            if (!covers(p, tpl.iso)) return p;
            const codes = p.coverage_country_codes.filter((c) => c !== tpl.iso);
            // 2026-10-25: a bundle FILED under the country (MobiMatter «Europe Asia and USA», 81 countries, country_code AF)
            // must be re-filed too, or the country keeps it — a lost country loses its filing and its region token, not only
            // its code.
            const region = typeof p.region === 'string'
              ? p.region.split(',').map((s) => s.trim()).filter((s) => s && s !== tpl.iso).join(', ')
              : p.region;
            return { ...p, coverage_country_codes: codes, region, ...(p.country_code === tpl.iso ? { country_code: codes[0] } : {}) };
          });
        return { tpl };
      },
      inspect: ({ pageOf }) => ({ pageStillThere: !!pageOf(tpl.slug) }),
    },
  ];
}
