// Near-duplicates and self-contradiction: what the fact gates cannot see.
//
// WHY
//
//   Two reviews in two days found the same shape of defect, and neither existing
//   gate could see it. The price gates check that a number exists, is
//   purchasable and is a floor. Nothing checked whether a PARAGRAPH was the same
//   paragraph as on another page, and nothing checked whether a page contradicts
//   itself.
//
//   What that let through:
//
//     * eight pages carrying one identical card about how daily plans are sold
//       in 3/5/7/10/15/30-day terms — true, catalogue-confirmed, and repeated in
//       the same words. Seven of the eight already said it elsewhere on their own
//       page, so it duplicated the page as well as its neighbours;
//     * three groups of FAQ answers that were the same answer with the country
//       swapped, one of which (a post-arrival troubleshooting walkthrough) also
//       restated /esim/not-working/ — a guide those same pages link to;
//     * five pages telling the reader to install the profile before flying while
//       a tariff on that same page starts counting its validity AT INSTALLATION.
//       Israel was the worst: its three largest LOCAL packages, 30/50/100 GB.
//
//   The verbatim check that existed found none of these: not one shared an exact
//   sentence. Jaccard on the token sets does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'seo/content-profiles');
const SHEETS = JSON.parse(readFileSync(join(ROOT, 'seo/fact-sheets.json'), 'utf8')).sheets;
const P = Object.fromEntries(readdirSync(DIR).filter((f) => f.endsWith('.json'))
  .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(DIR, f), 'utf8'))]));

// The payment sentence is mandated and must repeat; nothing else may.
const PAY = 'российской банковской картой';
const tok = (t) => new Set(String(t).toLowerCase().match(/[\wа-яё]+/g) || []);
const jaccard = (a, b) => {
  const A = tok(a), B = tok(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
};

// 0.60 is the line the 2026-09-01 review drew by hand, and every defect it named
// sat above it. The corpus today peaks at 0.543 (egypt ↔ jordan), which is the
// mandated «каталог не гарантирует связь в конкретной точке» hedge phrased for
// two different questions — deliberately left, deliberately below the line.
const LIMIT = 0.60;

test('no two pages answer a question with the same answer', () => {
  const items = Object.entries(P).flatMap(([s, d]) => (d.faq || [])
    .filter((f) => !String(f.a).includes(PAY)).map((f, i) => [s, i, f.a]));
  const bad = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i][0] === items[j][0]) continue;
      const v = jaccard(items[i][2], items[j][2]);
      if (v >= LIMIT) bad.push(`${v.toFixed(2)} ${items[i][0]}[${items[i][1]}] ↔ ${items[j][0]}[${items[j][1]}]`);
    }
  }
  assert.deepEqual(bad, [], `ответы FAQ повторяют друг друга:\n${bad.join('\n')}`);
});

test('no two pages carry the same why-card', () => {
  const items = Object.entries(P).flatMap(([s, d]) => (d.why || []).map((w, i) => [s, i, w.p, w.h]));
  const bad = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i][0] === items[j][0]) continue;
      if (items[i][3].trim() === items[j][3].trim()) bad.push(`заголовок «${items[i][3]}»: ${items[i][0]} ↔ ${items[j][0]}`);
      const v = jaccard(items[i][2], items[j][2]);
      if (v >= LIMIT) bad.push(`${v.toFixed(2)} ${items[i][0]}[${items[i][1]}] ↔ ${items[j][0]}[${items[j][1]}]`);
    }
  }
  assert.deepEqual(bad, [], `карточки повторяют друг друга:\n${bad.join('\n')}`);
});

test('no page carries the daily-term boilerplate', () => {
  // The exact block that stood on eight pages. Its facts are true; its problem
  // is that it is product mechanics printed in identical words, and that seven
  // of the eight pages already stated it in their own intro or FAQ.
  const TPL = /(готовыми сроками|продаются сроками|минимальн\w+ (?:покупка|срок)|сроки фиксированные)[^.!?]{0,60}три дня[^.!?]{0,40}5, 7, 10, 15/i;
  const bad = [];
  for (const [s, d] of Object.entries(P)) {
    for (const [i, w] of (d.why || []).entries()) if (TPL.test(w.p)) bad.push(`${s} why[${i}] «${w.h}»`);
  }
  assert.deepEqual(bad, [], `шаблонная карточка про сроки посуточных вернулась:\n${bad.join('\n')}`);
});

test('a page that advises installing early acknowledges the installation tariffs', () => {
  const EARLY = /(?:поставить|установить|ставить|устанавливается)[^.!?]{0,60}(?:заранее|дома|до\s+вылета|до\s+поездки|до\s+выезда)/i;
  const prose = (d) => JSON.stringify(['title', 'description', 'h1', 'lead', 'intro', 'why', 'faq'].map((k) => d[k]));
  const bad = [];
  for (const [s, d] of Object.entries(P)) {
    const sheet = SHEETS[s];
    if (!sheet || !(sheet.activation_policies || []).some((a) => a === 'installation' || a === 'upon_installation')) continue;
    const t = prose(d);
    if (EARLY.test(t) && !/после установки/i.test(t)) bad.push(s);
  }
  assert.deepEqual(bad, [], `советуют ставить заранее, не оговаривая тарифы с активацией «после установки eSIM»: ${bad.join(', ')}`);
});

test('the rules can fail — each fires on the defect it was written for', () => {
  assert.ok(jaccard(
    'Проверьте три вещи по порядку: включена ли на линии eSIM передача данных, включён ли роуминг данных и выбрана ли эта линия для мобильного интернета.',
    'Проверьте по порядку: включена ли на линии eSIM передача данных, включён ли роуминг данных, назначена ли эта линия для мобильного интернета.') >= LIMIT,
    'jaccard обязан ловить пару, которую ревью назвало дубликатом');
  const TPL = /(готовыми сроками|продаются сроками)[^.!?]{0,60}три дня[^.!?]{0,40}5, 7, 10, 15/i;
  assert.ok(TPL.test('Посуточные продаются готовыми сроками: три дня, затем 5, 7, 10, 15 и 30.'), 'шаблон обязан находиться');
  assert.ok(!TPL.test('Минимальный срок покупки здесь — три дня, и это указано в карточке.'), 'и не срабатывать на обычной фразе');
  const EARLY = /(?:поставить|установить|ставить|устанавливается)[^.!?]{0,60}(?:заранее|дома|до\s+вылета)/i;
  assert.ok(EARLY.test('Оплатить можно картой, а профиль поставить дома по Wi-Fi заранее.'), 'совет ставить заранее обязан находиться');
});
