// Where the FAQ says a tariff block is — checked against where the page puts it.
//
// WHY
//
//   Every country page answers «— есть ли локальные тарифы?» from a template, and
//   the template said «Они показаны первым блоком на этой странице». But
//   assets/country-tariffs.js inserts «Трафик на каждый день» BEFORE the local
//   block whenever the country has a daily card, so on 188 of the 195 pages
//   that carry the sentence it was false — in the visible FAQ and in FAQPage
//   structured data alike. The no-local branch said «они показаны ниже» from an
//   FAQ that sits under the whole grid. The hub's lead repeated «идут первым
//   блоком» for every country.
//
//   The daily-card rule is the renderer's own: a card renders when
//   daily-plan-copy.js lines(pkg) is non-empty (renderDailyCard returns '' for
//   anything else), and that function is imported, not copied. The country
//   filter in front of it repeats countryFacts' chain from catalogue-facts.mjs
//   (itself a port of country-tariffs.js); the daily_count parity check below
//   turns any drift between the two into a red build.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { coverageCodes, isRussia, isRestricted, isGlobal } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const D = createRequire(import.meta.url)('../assets/daily-plan-copy.js');
const PACKAGES = JSON.parse(readFileSync(join(ROOT, 'assets/catalog.json'), 'utf8')).packages;
const { countries: COUNTRIES } = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8'));
const QUESTION = '— есть ли локальные тарифы?';

/** Does this country's page render a «Трафик на каждый день» block? The renderer's rule, not a copy. */
function rendersDailyBlock(iso) {
  return PACKAGES
    .filter((p) => !isRussia(p) && !isRestricted(p) && Number(p.price) > 0)
    .filter((p) => coverageCodes(p).includes(iso) && !isGlobal(p))
    .filter(D.isDaily)
    .some((p) => D.lines(p).length > 0);
}

const unhtml = (s) => s.replace(/<[^>]+>/g, '').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();

/** The answer to the local-tariffs question, from the visible FAQ and from FAQPage. */
function answers(html) {
  const visible = [...html.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
    .filter((m) => unhtml(m[1]).endsWith(QUESTION)).map((m) => unhtml(m[2]));
  const schema = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const graph = [].concat(JSON.parse(m[1])['@graph'] || JSON.parse(m[1]));
    for (const node of graph) {
      if (node['@type'] !== 'FAQPage') continue;
      for (const q of node.mainEntity) if (q.name.endsWith(QUESTION)) schema.push(q.acceptedAnswer.text);
    }
  }
  return { visible, schema };
}

/** What is wrong with an answer, given what the page renders. Empty = fine. */
export function positionProblems(answer, { hasLocal, hasDaily }) {
  const out = [];
  if (/ниже/.test(answer)) out.push('«ниже» — FAQ стоит под всеми блоками тарифов');
  if (hasLocal && hasDaily && /первым блоком/.test(answer)) out.push(`«первым блоком» — первым идёт «${D.BLOCK_TITLE}»`);
  if (hasLocal && hasDaily && !answer.includes(`«${D.BLOCK_TITLE}»`)) out.push(`не назван блок «${D.BLOCK_TITLE}», после которого идут локальные`);
  if (hasLocal && !hasDaily && !/первым блоком/.test(answer)) out.push('без посуточного блока локальные идут первыми — так и надо сказать');
  return out;
}

test('the rule fires on the exact sentences it exists for', () => {
  const old = 'Да. Сейчас доступно 7 локальных тарифов именно для этой страны. Они показаны первым блоком на этой странице.';
  assert.ok(positionProblems(old, { hasLocal: true, hasDaily: true }).length > 0, 'old «первым блоком» must fail where a daily block exists');
  assert.deepEqual(positionProblems(old, { hasLocal: true, hasDaily: false }), [], 'it stays true where there is no daily block');
  const below = 'Локальных тарифов для этой страны сейчас нет. Доступны региональные тарифы, покрытие которых включает эту страну — они показаны ниже.';
  assert.ok(positionProblems(below, { hasLocal: false, hasDaily: true }).length > 0, '«ниже» must fail');
  const fixed = `Да. Сейчас доступно 7 локальных тарифов именно для этой страны. Они показаны на этой странице сразу после блока «${D.BLOCK_TITLE}».`;
  assert.deepEqual(positionProblems(fixed, { hasLocal: true, hasDaily: true }), []);
});

test('every country page says where its local tariffs actually are — visible FAQ and FAQPage alike', () => {
  const bad = [];
  let withDaily = 0;
  for (const c of COUNTRIES) {
    const html = readFileSync(join(ROOT, 'esim', c.slug, 'index.html'), 'utf8');
    const hasDaily = rendersDailyBlock(c.iso);
    if (hasDaily) withDaily++;
    // The generator decides from the counted daily plans; the renderer from the
    // cards it can draw. If those ever disagree, the FAQ is wrong somewhere.
    if ((c.daily_count > 0) !== hasDaily) bad.push(`${c.slug}: daily_count ${c.daily_count}, но посуточный блок ${hasDaily ? 'рисуется' : 'не рисуется'}`);
    const { visible, schema } = answers(html);
    if (visible.length !== 1 || schema.length !== 1) { bad.push(`${c.slug}: ответов в FAQ ${visible.length}, в FAQPage ${schema.length}`); continue; }
    if (visible[0] !== schema[0]) bad.push(`${c.slug}: видимый ответ ≠ FAQPage`);
    for (const p of positionProblems(visible[0], { hasLocal: c.local_count > 0, hasDaily })) bad.push(`${c.slug}: ${p}`);
  }
  assert.deepEqual(bad, []);
  assert.ok(withDaily > 100, `ожидали посуточный блок на большинстве страниц, нашли ${withDaily} — проверка не сработала бы вхолостую`);
});

test('the hub does not tell readers the local block comes first', () => {
  const hub = readFileSync(join(ROOT, 'esim/index.html'), 'utf8');
  assert.doesNotMatch(hub, /первым блоком/);
});
