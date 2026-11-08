// /ru/esim/europe/ — the Russian region page (P2-3 of the SEO plan, owner 2026-11-08; seo/ru-regions.mjs).
//
// What must hold, on the committed page and the catalogue it was built from:
//   * every coverage set is real: European by the codes rule (seo/regions.mjs regionOf), never global, made only of
//     plans the published layout SHOWS in the regional block of the pages that «sell» it, priced from those plans;
//   * the page promises nothing about Europe as a whole and names no RU/UA/BY;
//   * it is indexed exactly while it carries plans, with a self canonical and no hreflang (no translation exists);
//   * the country pages that link it are the European pages that offer a set — never the SEO pilot's pages.
// Run: node --test seo/test-ru-europe-page.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruRegionSets, ruRegionPage, indexable, EUROPE_COPY } from './ru-regions.mjs';
import { regionOf, EUROPE_CODES, GLOBAL_MIN_CODES, REGION_SLUGS } from './regions.mjs';
import { shownBlocks, purchasablePrice } from './catalogue-facts.mjs';
import { loadPublishedCatalogue } from './page-claims.mjs';
import { loadCached } from './catalogue-source.mjs';
import { INDEXED_REGIONS, enSwitchPath, ruAlternates } from './indexing.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const DOC = loadPublishedCatalogue();
const { countries } = loadCached();
const SETS = ruRegionSets(DOC, countries, 'europe');
const PAGE = read('ru/esim/europe/index.html');
const text = (html) => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const money = (v) => Math.round(Number(v)).toLocaleString('ru-RU').replace(/\s/g, ' '); // text() folds the no-break space too
const PILOT = new Set(readdirSync(join(ROOT, 'seo/content-profiles')).filter((f) => f.endsWith('.json'))
  .filter((f) => JSON.parse(read(`seo/content-profiles/${f}`)).seo_pilot).map((f) => f.slice(0, -5)));
const byIso = new Map(countries.map((c) => [c.iso, c]));

test('the proof: the catalogue the pages were built from carries European sets', () => {
  assert.ok(SETS.length > 0, 'no European coverage set — the page would be noindex');
  assert.ok(PILOT.size >= 1, 'the pilot profiles were read');
});

test('every set is real: European by its codes, never global, only plans the layout shows on the pages that sell it', () => {
  SETS.forEach((s, i) => {
    assert.equal(s.letter, String.fromCharCode(65 + i));
    assert.equal(regionOf(s.codes), 'europe', s.letter);
    assert.ok(s.codes.length < GLOBAL_MIN_CODES, `${s.letter}: a global set on the Europe page`);
    assert.ok(!s.codes.some((c) => ['RU', 'UA', 'BY'].includes(c)), `${s.letter}: RU/UA/BY`);
    assert.ok(s.plans > 0 && s.shown_on.length > 0, s.letter);
    // Rebuild the set from the published layout of the pages that «sell» it: same plans, same floor price.
    const plans = new Map();
    for (const iso of s.shown_on) {
      assert.ok(byIso.has(iso), `${s.letter}: ${iso} has no page`);
      for (const p of shownBlocks(DOC, iso).regional) {
        const codes = [...new Set((p.coverage_country_codes || []).filter((c) => /^[A-Z]{2}$/.test(c) && !['RU', 'UA', 'BY'].includes(c)))].sort();
        if (codes.join(',') === s.codes.join(',')) plans.set(p.package_id || p.id, p);
      }
    }
    assert.equal(plans.size, s.plans, `${s.letter}: plan count`);
    assert.equal(Math.min(...[...plans.values()].map(purchasablePrice)), s.min, `${s.letter}: floor price`);
  });
});

test('the committed page prints exactly these sets — volumes, terms, floor prices and where to buy', () => {
  const cards = [...PAGE.matchAll(/<div class="help-card" id="set-([a-z])">([\s\S]*?)<\/div>/g)];
  assert.equal(cards.length, SETS.length, 'one card per set');
  for (const [i, s] of SETS.entries()) {
    const [, letter, html] = cards[i];
    assert.equal(letter.toUpperCase(), s.letter);
    assert.match(html, new RegExp(`Вариант ${s.letter}: ${s.codes.length} направлени`));
    assert.ok(text(html).includes(`от ${money(s.min)} ₽`), `${s.letter}: floor price`);
    assert.ok(text(html).includes(`${s.gb.join(', ')} ГБ`), `${s.letter}: volumes`);
    for (const [, slug] of html.matchAll(/href="\/ru\/esim\/([a-z0-9-]+)\/"/g)) {
      const c = countries.find((x) => x.slug === slug);
      assert.ok(c && s.shown_on.includes(c.iso), `${s.letter}: «где купить» ${slug} does not sell this set`);
    }
  }
});

test('the country rows: a page that covers, split into «можно купить здесь» and «покрывают также», never invented', () => {
  const rows = [...PAGE.matchAll(/<li data-iso="([A-Z]{2})">([\s\S]*?)<\/li>/g)];
  assert.ok(rows.length > 10, `rows ${rows.length}`);
  for (const [, iso, html] of rows) {
    assert.ok(byIso.has(iso), `${iso} has no page`);
    const letters = (re) => ((html.match(re) || [, ''])[1].match(/[A-Z]/g) || []);
    const here = letters(/можно купить здесь: ([A-Z, ]+)/);
    const also = letters(/покрывают также: ([A-Z, ]+)/);
    assert.ok(here.length + also.length > 0, iso);
    for (const l of here) assert.ok(SETS.find((s) => s.letter === l).shown_on.includes(iso), `${iso}: ${l} is not sold here`);
    for (const l of also) { const s = SETS.find((x) => x.letter === l); assert.ok(s.codes.includes(iso) && !s.shown_on.includes(iso), `${iso}: ${l}`); }
  }
});

test('the copy promises nothing about Europe as a whole and names no left-out country', () => {
  const t = text(PAGE);
  for (const bad of [/(?:^|[^а-яё])ЕС(?:[^а-яё]|$)/, /Евросоюз/i, /Шенген/i, /вс[еяю]\s+Европ/i, /всей\s+Европ/i, /весь\s+регион/i, /Best World/, /(?:^|[^а-яё])(Россия|Украина|Беларусь)(?:[^а-яё]|$)/]) {
    assert.doesNotMatch(t, bad, String(bad));
  }
  assert.ok(PAGE.includes(`<title>${EUROPE_COPY.title}</title>`));
});

test('indexing: indexed exactly while it carries plans; self canonical; no hreflang; «English» leads home', () => {
  assert.equal(/<meta name="robots" content="index, follow"/.test(PAGE), indexable(SETS));
  assert.match(PAGE, /<link rel="canonical" href="https:\/\/magicesim\.store\/ru\/esim\/europe\/" \/>/);
  assert.doesNotMatch(PAGE, /hreflang=/);
  assert.equal(ruAlternates('/ru/esim/europe/'), '');
  assert.equal(enSwitchPath('/ru/esim/europe/'), '/');
  assert.deepEqual([...INDEXED_REGIONS], [], 'the prefixed languages\' region pages stay noindex');
  assert.equal(read('sitemap.xml').includes('<loc>https://magicesim.store/ru/esim/europe/</loc>'), indexable(SETS));
  // The rule fires: a catalogue with no European set makes the page noindex, with nothing to sell on it.
  const chrome = { site: 'https://magicesim.store', header: '', footer: '', fontPreload: '', headIcons: '', stamp: (u) => u, metrika: '', updated: '2026-11-08' };
  const empty = ruRegionPage('europe', { sets: [], pages: countries, chrome });
  assert.match(empty, /<meta name="robots" content="noindex, follow"/);
  assert.doesNotMatch(empty, /help-card/);
  assert.equal(indexable([]), false);
  assert.throws(() => ruRegionSets(DOC, countries, 'global'), /no Russian region page/, 'Global never gets a Russian page');
  for (const slug of REGION_SLUGS.filter((s) => s !== 'europe')) assert.ok(!existsSync(join(ROOT, 'ru/esim', slug)), slug);
});

test('country links: exactly the European pages that sell a set, never a pilot page, never a non-European page', () => {
  const expected = new Set(SETS.flatMap((s) => s.shown_on).filter((iso) => EUROPE_CODES.includes(iso)));
  const LINK = 'href="/ru/esim/europe/"';
  for (const c of countries) {
    const html = read(`ru/esim/${c.slug}/index.html`);
    const has = html.includes(LINK);
    if (PILOT.has(c.slug)) assert.equal(has, false, `${c.slug}: a pilot page must stay as it was`);
    else assert.equal(has, indexable(SETS) && expected.has(c.iso), `${c.slug} (${c.iso})`);
  }
  assert.ok(read('ru/esim/index.html').includes(LINK), 'the destination list links it');
});
