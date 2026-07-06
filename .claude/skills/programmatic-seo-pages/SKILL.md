---
name: programmatic-seo-pages
description: Design and scaffold per-country eSIM landing pages for Magic eSIM (e.g. /esim/thailand/, /esim/turkey/, /esim/china/, /esim/uae/, /esim/vietnam/) as static, indexable HTML with unique content, tariffs, FAQ, breadcrumbs and JSON-LD. Use when the user asks to create country pages, programmatic/pSEO pages, "страницы стран", "landing под страну", "/esim/<country>", or scale country-targeted SEO pages. Requires explicit confirmation before generating pages in bulk; never produces doorway/thin pages and never invents tariff data.
metadata:
  version: 1.0.0
  scope: project
  mode: confirm-before-generate
---

# Programmatic SEO Pages — Magic eSIM country landings

You design and scaffold **per-country eSIM landing pages** that are genuinely
useful, unique, and indexable — not doorway/thin pages. You always confirm scope
before generating pages in bulk.

## Sources of truth (Magic eSIM)
- Production site: `https://magicesim.store`
- Landing repo (static HTML): `~/Desktop/eSim/Magic eSIM Site/Magic-eSIM-github`
- Public API (tariffs/countries): `https://api.magicesim.store`
- Restricted countries — **never generate/promote/index** as sellable: **RU, UA, BY**
- Yandex Metrika counter: `110393848`
- Telegram: `https://t.me/magicesim`

## Target URL pattern
`/esim/<country-slug>/` — e.g. `/esim/thailand/`, `/esim/turkey/`, `/esim/china/`,
`/esim/uae/`, `/esim/vietnam/`. Use a stable, lowercase, hyphenated slug; one
canonical URL per country.

## Hard limits (never do)
- No deploy, no `git push`, no Render env changes, no backend edits, no payment-flow edits.
- **Never generate hundreds of pages without explicit confirmation.** Propose a small batch first (e.g. 3–5), get approval, then scale.
- No doorway/thin pages; no copying one text across all countries; no keyword stuffing; no cloaking or hidden text.
- **Never add `noindex` to these commercial pages.**
- **Never invent prices, coverage, data volumes, validity, or operator/network specs.** Pull tariffs from the API; if a value is unavailable at build time, show "уточняется" and let the tariff block load from the API — but the core SEO content must exist without JS.
- Never present RU/UA/BY as available.

## Required per-page structure
Each country page MUST have:
- **Unique `<title>`** and **unique `<meta name="description">`** (country-specific, no template-only strings).
- **Exactly one `<h1>`** naming the country + eSIM intent.
- `<link rel="canonical">` self-referential.
- **Static, indexable HTML**: the main SEO copy, headings, FAQ, and internal links render without JavaScript.
- **Unique body copy** per country (real, country-specific facts: typical use cases, coverage note, what to expect on arrival) — no boilerplate cloned across countries.
- **Tariffs block**: may hydrate from `https://api.magicesim.store` via JS, but a static fallback / server-rendered summary must be present for crawlers; never hardcode invented prices.
- **FAQ** (country-relevant, unique) with `FAQPage` JSON-LD matching the visible Q&A.
- **Internal links**: to the home page, related countries, and iPhone/Android setup guides. **Breadcrumbs** (Home → eSIM → Country) with `BreadcrumbList` JSON-LD.
- **JSON-LD**: `Organization`, `WebSite`, and `BreadcrumbList` (+ `FAQPage` when an FAQ exists), valid and consistent with visible content.
- Open Graph + Twitter cards, `<html lang="ru">`, descriptive `alt` on images, and the existing Yandex Metrika (`110393848`) snippet consistent with other pages.

## Workflow
1. **Plan first (no files yet):** propose the URL structure, the per-country content
   outline, the data fields to pull from the API, the JSON-LD blocks, and the
   internal-linking map. List which countries (excluding RU/UA/BY).
2. **Get explicit confirmation** of the batch (which countries, how many, template).
3. Generate a **single reference page** for one country for review.
4. After approval, generate the approved batch — each page with genuinely unique
   copy and country-specific data. Never auto-publish; leave deploy to the user.
5. Provide a short QA checklist per page (unique title/description/H1, canonical,
   JSON-LD validity, no thin content, tariffs source, internal links).

## Output format
- Proposed structure + content model + internal-link map.
- One sample page (HTML) for review.
- On approval: the batch, plus a per-page QA table. Stop and wait between steps.
