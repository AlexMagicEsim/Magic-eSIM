// Regression for the top-up rule in content-review.mjs, and for the one change
// made to it on 2026-09-01.
//
// WHY THIS FILE EXISTS
//
//   `checkTopup` compares a page's claim against COUNTRY-LEVEL counts
//   (`topup_yes` / `topup_no`). That is right for a categorical claim — Vietnam
//   said top-up was impossible while 14 of its 44 packages support it, Spain
//   said it was available while 6 of 39 do not — and wrong for a claim about ONE
//   named package. Four true sentences tripped it on 2026-09-01:
//
//     «у двадцатигигабайтного в карточке отмечено пополнение, у тридцатигигабайтного его нет»
//
//   That is the per-package truth, it is the most useful thing the page can say,
//   and the old rule pushed it back toward the vaguer hedge. TOPUP_CONTRAST now
//   lets a sentence through when it carries BOTH poles — an affirmative about
//   top-up and a negative — because only a contrast can be about two packages.
//   One pole alone is still a claim about the whole country and still fails.
//
//   The predicates are copied here, as the other rule regressions in this repo
//   copy theirs. A copy can drift, so the test also asserts the copies are still
//   the literals in content-review.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'seo/content-review.mjs'), 'utf8');

const TOPUP_NO = /(?:докупить|пополнить|дополнить)\s+(?:объ[её]м|трафик|гигабайт[а-яё]*|пакет|его|тариф)?[^.!?]{0,70}(?:нельзя|невозможно|не\s+получится|не\s+выйдет)|пополнени[а-яё]*[^.!?]{0,40}(?:нет|недоступн[а-яё]*|не\s+поддерживается)/i;
const TOPUP_YES = /(?:докупить|пополнить)[^.!?]{0,60}можно|пополнение\s+доступно(?![^.!?]{0,30}(?:не\s+у|у\s+части|зависит))/i;
const TOPUP_HEDGE = /зависит от тарифа|не у всех|не все|у части|отмечен[а-яё]* в карточке|видно (?:по отметке )?в карточке/i;
const TOPUP_CONTRAST = (t) => /пополнени[а-яё]*/i.test(t)
  // «не поддерживается» contains «поддерживает». Without the lookbehind a
  // one-sided negative reads as a contrast and walks straight through.
  && /(?<!не\s)(?:отмечено|отмечена|указано|(?<![а-яё])есть(?![а-яё])|доступно|поддерживает)/i.test(t)
  && /(?:(?<![а-яёa-z])нет(?![а-яёa-z])|не\s+отмечен|не\s+поддерживается|не\s+указан)/i.test(t);

// What checkTopup does, minus the sheet lookup.
const flagged = (t, { yes = 1, no = 1 } = {}) => {
  if (TOPUP_HEDGE.test(t) || TOPUP_CONTRAST(t)) return false;
  return Boolean((yes && TOPUP_NO.test(t)) || (no && TOPUP_YES.test(t)));
};

test('the copies here are still the literals in content-review.mjs', () => {
  for (const lit of [
    'const TOPUP_NO = ' + TOPUP_NO.toString().replace(/\/i$/, '/i;'),
    'const TOPUP_YES = ' + TOPUP_YES.toString().replace(/\/i$/, '/i;'),
    'const TOPUP_HEDGE = ' + TOPUP_HEDGE.toString().replace(/\/i$/, '/i;'),
  ]) assert.ok(SRC.includes(lit), `правило разошлось с копией в тесте:\n${lit}`);
  assert.ok(SRC.includes('const TOPUP_CONTRAST = (t) =>'), 'TOPUP_CONTRAST исчез из content-review.mjs');
  assert.ok(SRC.includes('TOPUP_HEDGE.test(t) || TOPUP_CONTRAST(t)'), 'contrast больше не подключён к checkTopup');
});

test('the two defects the rule was written for still fail', () => {
  assert.ok(flagged('Пополнить объём в середине поездки нельзя — придётся покупать новый тариф.'),
    'категоричное «нельзя» обязано ловиться (дефект Вьетнама)');
  assert.ok(flagged('Пополнение доступно, поэтому объём можно не считать.'),
    'категоричное «доступно» обязано ловиться (дефект Испании)');
});

test('a per-package contrast passes, a one-sided claim does not', () => {
  assert.ok(!flagged('Различает их другая строка: у двадцатигигабайтного в карточке отмечено пополнение, у тридцатигигабайтного его нет.'),
    'контраст двух пакетов — это правда о каждом из них, а не о стране');
  assert.ok(!flagged('У дешёвого в карточке отмечено пополнение, у дорогого его нет; срок у обоих 30 дней.'),
    'та же форма на другой странице');
  assert.ok(flagged('Пополнение у этого семейства не поддерживается.'),
    'один полюс — снова утверждение обо всей стране, и оно обязано ловиться');
});

test('the hedge still works and the contrast has not swallowed it', () => {
  assert.ok(!flagged('Зависит от тарифа: у части в каталоге пополнение доступно, у части — нет.'),
    'хедж обязан по-прежнему проходить');
  assert.ok(!TOPUP_CONTRAST('Пополнение доступно у всех тарифов этой страны.'),
    'без отрицания это не контраст');
  assert.ok(!TOPUP_CONTRAST('Докупить покрытие нельзя.'),
    'без слова «пополнение» это не контраст');
  assert.ok(!TOPUP_CONTRAST('Пополнение у этого семейства не поддерживается.'),
    '«не поддерживается» содержит «поддерживает» — без lookbehind это читалось как контраст');
});

test('the Cyrillic boundary is real — \\bнет\\b would not have worked', () => {
  assert.ok(!/\bнет\b/.test('у дорогого его нет;'), 'ASCII \\b в кириллице не срабатывает — ради этого и написан явный lookaround');
  assert.ok(/(?<![а-яёa-z])нет(?![а-яёa-z])/i.test('у дорогого его нет;'), 'явная граница обязана срабатывать');
  assert.ok(!/(?<![а-яёa-z])нет(?![а-яёa-z])/i.test('интернета нету, но это другое слово'), 'и не цеплять «нету»');
});
