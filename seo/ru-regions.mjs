// THE RUSSIAN REGION PAGE — /ru/esim/europe/ (P2-3 of the 2026-11-08 SEO plan, owner's word the same day).
//
// The same rule as the prefixed languages' region pages (seo/regions.mjs, read it first): a region page lists the
// multi-country plans the RUB layout already SHOWS in the «regional» block of some Russian country page — the backend
// decides which plans those are; nothing here chooses, sorts out or adds a plan — grouped into COVERAGE SETS (one set =
// one list of ISO codes), each set assigned to a region by regionOf() over its codes, never by a plan's name.
//
// What differs from the prefixed pages, and why:
//   * it reads the RUB catalogue the Russian pages are built from (assets/catalog.json through the published layout,
//     seo/catalogue-facts.mjs shownBlocks), not seo/global-plan-facts.json (USD);
//   * each set shows its floor price «от N ₽» — computed from the same catalogue, like the hub's «от N ₽» rows
//     (seo/build-hub.mjs), never typed by hand;
//   * ONLY europe. Asia and Global get no Russian page (Global never before the owner's «Best World» decision);
//   * it is indexed by its own rule (indexable() below) while it carries plans; seo/indexing.mjs INDEXED_REGIONS, the
//     rule of the prefixed region pages, is NOT touched — those stay noindex.
//
// NEVER on this page: «ЕС», «Шенген», «вся Европа» or any word that promises a whole region; a provider's family name;
// a count taken from a plan name; RU, UA or BY (dropped before grouping, as everywhere).

import { regionOf } from './regions.mjs';
import { shownBlocks, purchasablePrice, isDaily } from './catalogue-facts.mjs';
import { COUNTRY_NAMES } from './country-names.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const RU_REGION_SLUGS = Object.freeze(['europe']);
const LEFT_OUT = Object.freeze(['RU', 'UA', 'BY']);
const ISO = /^[A-Z]{2}$/;
const SHOP_SHOWN_MAX = 8;

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const uniqSorted = (xs) => [...new Set(xs.filter((x) => Number.isFinite(x) && x > 0))].sort((a, b) => a - b);
const letterOf = (i) => {
  if (i >= 26) throw new Error('ru-regions: more than 26 coverage sets in one region — the letters run out');
  return String.fromCharCode(65 + i);
};

/**
 * The coverage sets of `slug` on the Russian pages. `doc` is the published catalogue (page-claims.mjs
 * loadPublishedCatalogue), `pages` the countries that have a Russian page ({ iso, slug, nameRu }). Per set: its codes
 * (sorted, RU/UA/BY dropped), the volumes and terms of its plans, the floor price, how many plans, and the pages that
 * offer it (`shown_on`, ISO codes of countries with a page). Deterministic: sets by size, then codes.
 */
export function ruRegionSets(doc, pages, slug) {
  if (!RU_REGION_SLUGS.includes(slug)) throw new Error(`ru-regions: no Russian region page «${slug}»`);
  const groups = new Map();
  for (const c of [...pages].sort((a, b) => a.iso.localeCompare(b.iso))) {
    for (const p of shownBlocks(doc, c.iso).regional) {
      if (isDaily(p)) continue;
      const codes = [...new Set((p.coverage_country_codes || []).filter((x) => ISO.test(x) && !LEFT_OUT.includes(x)))].sort();
      if (regionOf(codes) !== slug) continue;
      const key = codes.join(',');
      if (!groups.has(key)) groups.set(key, { codes, plans: new Map(), shown: new Set() });
      const g = groups.get(key);
      const id = p.package_id || p.id;
      if (id) g.plans.set(id, p);
      g.shown.add(c.iso);
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.codes.length - a.codes.length || a.codes.join(',').localeCompare(b.codes.join(',')))
    .map((g, i) => {
      const plans = [...g.plans.values()];
      const prices = plans.map(purchasablePrice).filter((v) => Number.isFinite(v) && v > 0);
      return {
        letter: letterOf(i), codes: g.codes, plans: plans.length,
        gb: uniqSorted(plans.map((p) => num(p.data_gb))), days: uniqSorted(plans.map((p) => num(p.validity_days))),
        min: prices.length ? Math.min(...prices) : null, shown_on: [...g.shown].sort(),
      };
    })
    .filter((s) => s.plans > 0 && s.min !== null);
}

/** Whether the written page is indexed — the sitemap and the hub link follow the page, so they can never disagree. */
export function writtenPageIndexed(root, slug) {
  const f = join(root, 'ru/esim', slug, 'index.html');
  return existsSync(f) && /<meta name="robots" content="index, follow"/.test(readFileSync(f, 'utf8'));
}

/** The page is indexed only while it carries plans: at least one set, each with a price and a page that sells it. */
export function indexable(sets) {
  return Array.isArray(sets) && sets.length > 0 && sets.every((s) => s.min !== null && s.shown_on.length > 0);
}

const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const money = (v) => Math.round(Number(v)).toLocaleString('ru-RU');
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);
const gbText = (v) => `${v.join(', ')} ГБ`;
const daysText = (v) => `${v.join(', ')} ${plural(v[v.length - 1], 'день', 'дня', 'дней')}`;
const nameOf = (iso, byIso) => (byIso.get(iso) && byIso.get(iso).nameRu) || (COUNTRY_NAMES[iso] && COUNTRY_NAMES[iso].ru) || iso;

/** The text of the page, from the sets — every word generated, nothing about the region as a whole. */
export const EUROPE_COPY = Object.freeze({
  title: 'eSIM для Европы — один тариф на несколько стран | Magic eSIM',
  description: 'Региональные eSIM для поездок по нескольким странам Европы: варианты покрытия, объёмы, сроки и цены в рублях. Список стран у каждого тарифа свой.',
  h1: 'eSIM для Европы: тарифы на несколько стран',
  crumb: 'Европа',
  lead: 'Региональные тарифы, покрытие которых включает несколько стран Европы. У каждого варианта свой список стран — проверьте, что в него входят все страны вашей поездки. Купить тариф можно на странице любой страны, где он предложен.',
});

/**
 * The HTML of /ru/esim/europe/. `chrome` carries what build-catalogue-pages.mjs already has: { site, header, footer,
 * fontPreload, headIcons, stamp, metrika, updated }. Pure apart from those strings, so a test can build it from a
 * fixture.
 */
export function ruRegionPage(slug, { sets, pages, chrome }) {
  const C = EUROPE_COPY;
  const url = `${chrome.site}/ru/esim/${slug}/`;
  const byIso = new Map(pages.map((c) => [c.iso, c]));
  const byName = (isos) => [...isos].sort((a, b) => nameOf(a, byIso).localeCompare(nameOf(b, byIso), 'ru'));
  const indexed = indexable(sets);

  const cards = sets.map((s) => {
    const shop = byName(s.shown_on.filter((iso) => byIso.has(iso)));
    const shown = shop.slice(0, SHOP_SHOWN_MAX);
    const rest = shop.length - shown.length;
    const outside = byName(s.codes.filter((iso) => !byIso.has(iso)));
    return `        <div class="help-card" id="set-${s.letter.toLowerCase()}">
          <h3>Вариант ${s.letter}: ${s.codes.length} ${plural(s.codes.length, 'направление', 'направления', 'направлений')}</h3>
          <p><strong>Интернет:</strong> ${esc(gbText(s.gb))}<br><strong>Срок:</strong> ${esc(daysText(s.days))}<br><strong>Цены:</strong> от ${money(s.min)} ₽ · ${s.plans} ${plural(s.plans, 'тариф', 'тарифа', 'тарифов')}</p>
          <p><strong>Где купить:</strong> ${shown.map((iso) => `<a href="/ru/esim/${byIso.get(iso).slug}/">${esc(nameOf(iso, byIso))}</a>`).join(', ')}${rest > 0 ? ` и ещё ${rest}` : ''}.</p>${outside.length ? `
          <p class="note">Также в покрытии: ${esc(outside.map((iso) => nameOf(iso, byIso)).join(', '))}.</p>` : ''}
        </div>`;
  }).join('\n');

  // Country × set: every country with a page that a set covers, and the sets that cover it — split into the sets
  // offered on THAT country's own page and the sets that also cover it but are bought on other pages. A row never
  // implies a set can be chosen on a page that does not offer it.
  const covered = new Map();
  for (const s of sets) for (const iso of s.codes) {
    if (!byIso.has(iso)) continue;
    if (!covered.has(iso)) covered.set(iso, { here: [], also: [] });
    covered.get(iso)[s.shown_on.includes(iso) ? 'here' : 'also'].push(s.letter);
  }
  const LETTERS = 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯ'.split('');
  const first = (n) => { const L = String(n).charAt(0).toUpperCase(); return L === 'Ё' ? 'Е' : L; };
  const groups = new Map();
  for (const iso of byName(covered.keys())) {
    const L = first(nameOf(iso, byIso));
    if (!LETTERS.includes(L)) throw new Error(`ru-regions: буква «${L}» вне алфавита`);
    if (!groups.has(L)) groups.set(L, []);
    groups.get(L).push(iso);
  }
  const rows = [...groups.entries()].map(([L, isos]) => `      <section class="az-group" id="az-${LETTERS.indexOf(L) + 1}" aria-labelledby="az-${LETTERS.indexOf(L) + 1}h">
        <h2 id="az-${LETTERS.indexOf(L) + 1}h">${L}</h2>
        <ul class="dest">
${isos.map((iso) => {
    const c = byIso.get(iso); const { here, also } = covered.get(iso);
    // Plain letters inside the country's own link, as the hub prints «N тарифов · от X ₽» — a link inside a link is
    // invalid, and .az-group .dest styles every link there as a 46 px row.
    const meta = [here.length ? `можно купить здесь: ${here.join(', ')}` : '', also.length ? `покрывают также: ${also.join(', ')}` : ''].filter(Boolean).join(' · ');
    return `          <li data-iso="${iso}"><a href="/ru/esim/${c.slug}/"><img class="flag" src="/assets/flags/${iso.toLowerCase()}.svg" alt="" width="28" height="21" loading="lazy"><span>${esc(c.nameRu)}<small class="dest-meta">${meta}</small></span></a></li>`;
  }).join('\n')}
        </ul>
      </section>`).join('\n');

  const jsonld = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Главная', item: `${chrome.site}/ru/` },
    { '@type': 'ListItem', position: 2, name: 'Страны', item: `${chrome.site}/ru/esim/` },
    { '@type': 'ListItem', position: 3, name: C.crumb, item: url },
  ] };

  const body = sets.length ? `    <section class="cp-help" aria-labelledby="setsTitle">
      <h2 id="setsTitle">Варианты покрытия</h2>
      <p class="note">Каждый вариант — региональные тарифы с одним и тем же списком стран. Объём, срок и цена конкретного тарифа — на странице страны, в его карточке; там же кнопка «Покрытие и условия».</p>
      <div class="help-grid">
${cards}
      </div>
      <p class="note">По данным каталога на <time datetime="${esc(chrome.updated)}">${esc(String(chrome.updated).slice(0, 10))}</time>. Список стран в карточке тарифа — главный источник.</p>
    </section>

    <section class="cp-help" aria-labelledby="matrixTitle">
      <h2 id="matrixTitle">Страны и варианты покрытия</h2>
      <p class="note">«Можно купить здесь» — вариант предложен на странице этой страны. «Покрывают также» — вариант включает страну, но продаётся на страницах других стран.</p>
      <div class="hub-list">
${rows}
      </div>
    </section>` : `    <p class="note">Сейчас в каталоге нет региональных тарифов для Европы. Тарифы для конкретной страны — в <a href="/ru/esim/">каталоге направлений</a>.</p>`;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(C.title)}</title>
  <meta name="description" content="${esc(C.description)}" />
  <link rel="canonical" href="${url}" />
  <meta name="robots" content="${indexed ? 'index, follow' : 'noindex, follow'}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${esc(C.title.replace(' | Magic eSIM', ''))}" />
  <meta property="og:description" content="${esc(C.description)}" />
  <meta property="og:image" content="${chrome.site}/assets/magic-esim-logo.png" />
  <meta property="og:locale" content="ru_RU" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(C.title.replace(' | Magic eSIM', ''))}" />
  <meta name="twitter:description" content="${esc(C.description)}" />
  <meta name="twitter:image" content="${chrome.site}/assets/magic-esim-logo.png" />
${chrome.headIcons}
${chrome.fontPreload}
  <link rel="stylesheet" href="${chrome.stamp('/assets/site.css')}" />
  <link rel="stylesheet" href="${chrome.stamp('/assets/page-hub.css')}" />
  <link rel="stylesheet" href="${chrome.stamp('/assets/ru.css')}" />
${chrome.metrika}
  <!-- Structured data -->
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
${chrome.header}

<main class="hub">
  <section class="hub-hero">
    <div class="wrap">
      <nav class="crumbs" aria-label="Хлебные крошки"><a href="/ru/">Главная</a> › <a href="/ru/esim/">Страны</a> › <span aria-current="page">${esc(C.crumb)}</span></nav>
      <h1>${esc(C.h1)}</h1>
      <p class="lead">${esc(C.lead)}</p>
    </div>
  </section>

  <div class="wrap hub-body">
${body}
  </div>
</main>

${chrome.footer}
</body>
</html>
`;
}
