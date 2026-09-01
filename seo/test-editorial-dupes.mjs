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

// The payment answer is mandated and must repeat; nothing else may.
//
//   Until 2026-09-01 the exemption was «skip any answer containing PAY», which
//   exempted the WHOLE answer. Only the first sentence is mandated, and the two
//   that followed it drifted into fifteen paraphrases of the same two facts —
//   0.84 at the top (armenia ↔ morocco) once the mandated sentence was stripped.
//   Vocabulary diverse, argument identical: exactly the defect this file exists
//   to catch, hidden by its own whitelist.
//
//   The block is one canonical string now. The gate subtracts THAT STRING and
//   compares whatever a page adds around it, so a page may still say something
//   of its own (india does) and is measured on it.
const PAY = 'российской банковской картой';
const PAY_BLOCK = 'Оплата российской банковской картой или через СБП — способ выбирается на шаге оплаты. '
  + 'Иностранные карты пока не поддерживаются. '
  + 'После оплаты на почту приходит письмо с QR-кодом и инструкцией по установке.';
const dropPay = (t) => String(t).split(PAY_BLOCK).join(' ').trim();
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
    .map((f, i) => [s, i, dropPay(f.a)])
    // What is left after the mandated block is subtracted. A page whose whole
    // answer WAS that block leaves nothing, and nothing cannot duplicate.
    .filter(([, , a]) => tok(a).size >= 8));
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

test('the mandated payment block is one string, not fifteen paraphrases', () => {
  // Fifteen pages answer «чем платить». The facts are the same on all of them and
  // the wording is mandated (CLAUDE.md: «оплата российской банковской картой или
  // через СБП», never «любой картой»). Fifteen rewordings of one fact is not
  // editorial diversity — it is the thing this file calls a clone. So: one
  // string. A page may add a sentence of its own; it may not restate the block.
  const bad = [];
  for (const [s, d] of Object.entries(P)) {
    for (const [i, f] of (d.faq || []).entries()) {
      if (!String(f.a).includes(PAY)) continue;
      if (!String(f.a).includes(PAY_BLOCK)) bad.push(`${s} faq[${i}] — свой вариант вместо общего блока`);
      const rest = dropPay(f.a);
      if (/иностранн|QR|письм/i.test(rest)) bad.push(`${s} faq[${i}] — повторяет блок своими словами`);
    }
  }
  assert.deepEqual(bad, [], `оплата снова расписана по-разному:\n${bad.join('\n')}`);
});

test('the payment rule can fail — a paraphrase must be caught', () => {
  const draft = 'Оплата российской банковской картой или через СБП, способ выбирается на шаге оплаты. '
    + 'Иностранные карты пока не поддерживаются. QR-код приходит письмом.';
  assert.ok(!draft.includes(PAY_BLOCK), 'перефразированный блок обязан не совпасть с каноном');
  assert.ok(/иностранн|QR|письм/i.test(dropPay(draft)), 'и обязан остаться видимым после вычитания');
  assert.equal(dropPay(PAY_BLOCK), '', 'канон обязан вычитаться нацело');
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

// ── The contextual link to /esim/dual-sim-sms/ ────────────────────────────
//
//   One guide was linked from ZERO country pages while ~15 of their FAQ answers
//   restated it. The fix is a per-profile sentence, not a template line, so the
//   wording and the anchor differ per page — which only holds if something
//   checks it. A review found four failure modes this file now pins: a note on a
//   page that does not discuss the topic; a page that discusses it and has none;
//   two `{link}` placeholders silently truncating the sentence; and anchors
//   drifting into each other.

const NOTES = Object.fromEntries(Object.entries(P).filter(([, d]) => d.dual_sim_note));
// [\wа-яёА-ЯЁ], never \w. This is the FOURTH time the ASCII-only \w has bitten
// in this repo — /\bот/ matched nothing, обновля\w*\s+кажд matched nothing,
// перв\w+\s+подключени matched nothing, and this line matched nothing until the
// test that uses it was run against real data. The rule is in CLAUDE.md now.
const CY = '[\\wа-яёА-ЯЁ]';
const TOPIC = new RegExp(
  `домашн${CY}*\\s+SIM|основн${CY}*\\s+(?:номер|SIM)|российск${CY}*\\s+(?:SIM|номер)|SMS\\s+от\\s+банк`
  + `|банковск${CY}*\\s+код|код${CY}*\\s+подтвержден|втор${CY}*\\s+лини|две\\s+лини|обычн${CY}*\\s+номер`
  + `|ваш\\s+номер|местн${CY}*\\s+номер|ваш${CY}*\\s+остаётся|номер${CY}*\\s+(?:остаётся|не\\s+девается)`, 'i');

test('a dual-sim note is well formed and can emit only its one link', () => {
  for (const [slug, d] of Object.entries(NOTES)) {
    const n = d.dual_sim_note;
    assert.equal(typeof n.text, 'string', `${slug}: text не строка`);
    assert.equal(typeof n.anchor, 'string', `${slug}: anchor не строка`);
    assert.ok(n.anchor.trim().length >= 3, `${slug}: пустой anchor`);
    assert.equal(n.text.split('{link}').length, 2, `${slug}: нужен ровно один {link}`);
    for (const s of [n.text, n.anchor]) {
      assert.ok(!/[<>]/.test(s), `${slug}: разметка в тексте заметки — эмитировать можно только {link}`);
    }
  }
});

test('every note sits on a page that discusses the second line', () => {
  const bad = [];
  for (const [slug, d] of Object.entries(NOTES)) {
    const own = JSON.stringify([d.lead, d.intro, d.why, d.faq, d.h1, d.description]);
    if (!TOPIC.test(own) && !TOPIC.test(d.dual_sim_note.text)) bad.push(slug);
  }
  assert.deepEqual(bad, [], `ссылка стоит там, где страница темы не касается: ${bad.join(', ')}`);
});

test('anchors and sentences do not converge', () => {
  const tri = (t) => new Set(Array.from({ length: Math.max(0, t.length - 2) }, (_, i) => t.slice(i, i + 3)));
  const j = (a, b) => { const A = tri(a), B = tri(b); const i = [...A].filter((x) => B.has(x)).length; const u = new Set([...A, ...B]).size; return u ? i / u : 0; };
  const e = Object.entries(NOTES);
  const bad = [];
  for (let i = 0; i < e.length; i++) for (let k = i + 1; k < e.length; k++) {
    const a = e[i][1].dual_sim_note, b = e[k][1].dual_sim_note;
    if (a.anchor === b.anchor) bad.push(`одинаковый якорь: ${e[i][0]} ↔ ${e[k][0]}`);
    else if (j(a.anchor, b.anchor) >= 0.65) bad.push(`${j(a.anchor, b.anchor).toFixed(2)} якоря ${e[i][0]} ↔ ${e[k][0]}`);
    if (j(a.text, b.text) >= 0.65) bad.push(`${j(a.text, b.text).toFixed(2)} тексты ${e[i][0]} ↔ ${e[k][0]}`);
  }
  assert.deepEqual(bad, [], `заметки сходятся друг с другом:\n${bad.join('\n')}`);
});

test('the note is not a step in the numbered instructions', () => {
  // It was one, briefly: a declarative aside numbered «5.» among four
  // imperatives. It renders as a paragraph after the list now.
  const { readFileSync: rf } = { readFileSync };
  for (const slug of Object.keys(NOTES)) {
    const html = rf(join(ROOT, `esim/${slug}/index.html`), 'utf8');
    const ol = html.match(/<ol class="howto-list">([\s\S]*?)<\/ol>/);
    assert.ok(ol, `${slug}: список «Как подключить» не найден`);
    assert.ok(!ol[1].includes('dual-sim-sms'), `${slug}: ссылка снова внутри нумерованного списка`);
    assert.match(html, /<\/ol>\s*<p class="howto-note">/, `${slug}: заметка не сразу после списка`);
  }
});
