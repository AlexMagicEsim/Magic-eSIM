// The authored prose, checked against the catalogue on every `npm test`.
//
// WHY THIS FILE EXISTS
//
//   The rules that compare an authored page with the catalogue — every ₽ and ГБ
//   figure must exist, «от N ₽» must be a floor, a quoted activation label must
//   be one the cards print — have lived in content-review.mjs since August. That
//   file is a CLI. Nothing ran it: not `npm test`, not CI, not the SEO refresh
//   job. So when the provider moved prices on 2026-09-25 two authored pages went
//   stale on the live site with every gate green:
//
//     israel       «1650 ₽ против 2500 ₽» — Israel 10GB 30Days is 1400 ₽ since
//                  catalogue commit 1ae0ba0. `node seo/content-review.mjs israel`
//                  reported it; nobody was asked to run it.
//     south-korea  «в карточке указано, что срок идёт с первого подключения к
//                  сети» about the «Китай, Корея, Япония» package. All three of
//                  its packages print «с первого использования интернета» now.
//                  No rule caught this one at all: the activation check asked
//                  whether ANY Korean card prints the phrase, and some still do.
//
//   The fix is two things. The existing checks are wired here, so the refresh
//   job — which runs `npm test` after rebuilding — stops before it can open a
//   pull request over prose the new catalogue contradicts. And a claim about a
//   NAMED package family is checked against that family, not the country.
//
//   What is deliberately NOT checked: bare numbers. «2 недели», «за 5 минут»,
//   «24/7», «поездка на 14 дней» are not catalogue facts, and a checker that
//   fires on them gets switched off. The negative cases below pin that.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  catalogueProblems, checkFacts, checkNamedFamilies, FAMILY_TITLES,
} from './content-review.mjs';
import { loadSheets } from './fact-sheet.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_DIR = join(ROOT, 'seo/content-profiles');
const { sheets } = loadSheets();
const faqProfile = (a) => ({ faq: [{ q: 'Вопрос?', a }] });

// The two sentences as they stood on the live site on 2026-09-26.
const ISRAEL_STALE = 'Шаг с 10 на 20 ГБ здесь стоит дешевле, чем ожидаешь: 1650 ₽ против 2500 ₽ при одинаковом сроке в 30 дней.';
const KOREA_STALE = 'Тот же пакет «Китай, Корея, Япония» закрывает маршрут одним профилем — и у него есть деталь, важная именно перед вылетом: в карточке указано, что срок идёт с первого подключения к сети, а не с установки.';

test('israel: the stale 10 ГБ price is refused against the current catalogue', () => {
  const problems = checkFacts(faqProfile(ISRAEL_STALE), sheets.israel);
  assert.ok(problems.some((p) => p.includes('1650')), `1650 ₽ обязан ловиться:\n${problems.join('\n')}`);
  const fixed = checkFacts(faqProfile(ISRAEL_STALE.replace('1650', '1400')), sheets.israel);
  assert.deepEqual(fixed, [], 'цена из каталога не должна давать замечаний');
});

test('south-korea: an activation label quoted for a named family is checked against THAT family', () => {
  const problems = checkNamedFamilies(faqProfile(KOREA_STALE), 'KR');
  assert.ok(problems.some((p) => p.includes('Китай, Корея и Япония')), `старая надпись обязана ловиться:\n${problems.join('\n')}`);
  const fixed = KOREA_STALE.replace('с первого подключения к сети', 'с первого использования интернета');
  assert.deepEqual(checkNamedFamilies(faqProfile(fixed), 'KR'), []);
});

test('the family rule reads the card title with or without «и» and with a volume', () => {
  const t = (q) => `Пакет «${q}» — в карточке срок идёт с первого подключения к сети.`;
  for (const q of ['Китай, Корея и Япония', 'Китай, Корея, Япония', 'Китай, Корея и Япония 12 GB']) {
    assert.ok(checkNamedFamilies(faqProfile(t(q)), 'KR').length, `не распознано: «${q}»`);
  }
});

test('the family rule stays quiet where it has nothing to check', () => {
  // A country-level claim is checkAttribution's business, not this rule's.
  assert.deepEqual(checkNamedFamilies(faqProfile('У большинства тарифов срок идёт с первого подключения к сети.'), 'KR'), []);
  // A quote that names no family: a card label, a heading.
  assert.deepEqual(checkNamedFamilies(faqProfile('В карточке стоит «после установки eSIM», а блок называется «Трафик на каждый день»; срок идёт с первого подключения к сети.'), 'KR'), []);
  // A family that does not cover this country is not this page's claim.
  assert.deepEqual(checkNamedFamilies(faqProfile(KOREA_STALE), 'TR'), []);
});

test('bare numbers are never catalogue facts', () => {
  const text = 'Поездка на 14 дней, установка за 5 минут, поддержка 24/7, 2 недели на море и 3 города по пути.';
  assert.deepEqual(checkFacts(faqProfile(text), sheets.israel), []);
});

test('every family title here is a title the card actually prints', () => {
  const src = readFileSync(join(ROOT, 'assets/country-tariffs.js'), 'utf8');
  for (const { title } of FAMILY_TITLES) {
    assert.ok(src.includes(title), `«${title}» больше не печатается assets/country-tariffs.js — таблица разошлась с карточкой`);
  }
});

test('every authored page agrees with the current catalogue', () => {
  const slugs = readdirSync(PROFILE_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  assert.ok(slugs.length >= 46, `профилей ${slugs.length}`);
  const failures = [];
  for (const slug of slugs) {
    const profile = JSON.parse(readFileSync(join(PROFILE_DIR, `${slug}.json`), 'utf8'));
    if (profile.status !== 'published') continue;
    const problems = catalogueProblems(profile, slug);
    if (problems.length) failures.push(`${slug}:\n    ${problems.join('\n    ')}`);
  }
  assert.deepEqual(failures, [], `авторский текст расходится с каталогом:\n${failures.join('\n')}`);
});
