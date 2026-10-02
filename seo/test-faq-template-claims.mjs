// Template sentences about a plan's TERM, held to what the catalogue says.
//
// WHY
//
//   Three sentences went out on every country page whatever the catalogue held,
//   in the visible FAQ and in FAQPage alike:
//
//     * «вы выбираете, на сколько дней нужен интернет» — false on pages whose
//       daily plans include FIXED_TERM ones (26 pages);
//     * «дневной лимит трафика обновляется каждые сутки» — a nightly reset no
//       daily plan confirms on 103 of the 123 pages (daily_reset_confirmed is
//       `every`, not `some`: no country qualifies, so no page may say it);
//     * «Срок действия тарифа отсчитывается с момента подключения к сети в
//       поездке» — false on the 4 template pages that render a plan starting
//       «после установки eSIM» (29 if world packages were counted, but country
//       pages never render those), and unsupported everywhere else: the card
//       prints a fallback for the ~91 % of plans whose policy is `unknown`.
//
//   The guides and the Mini App FAQ carried the same class: «у многих / у
//   большинства тарифов», «Чаще всего…», «проверьте … письмо заказа» (the
//   delivery email has no start-of-term row), and unconditional «ставьте дома».
//   test-guide-activation.mjs covers that one guide; this file covers the rest.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coverageCodes, isRussia, isRestricted, isGlobal, isDaily } from './catalogue-facts.mjs';
import { startRuleProblems, proseOf } from './start-of-term-rules.mjs';
import * as CR from './content-review.mjs';

const SHEETS = JSON.parse(readFileSync(new URL('./fact-sheets.json', import.meta.url), 'utf8')).sheets;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = JSON.parse(readFileSync(join(ROOT, 'assets/catalog.json'), 'utf8')).packages;
const { countries: COUNTRIES } = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8'));
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const shownOn = (iso) => PACKAGES.filter((p) => !isRussia(p) && !isRestricted(p) && Number(p.price) > 0
  && coverageCodes(p).includes(iso) && !isGlobal(p));
const INSTALL = ['installation', 'upon_installation'];
const policy = (p) => String(p.activation_policy || '').trim().toLowerCase();

const unhtml = (s) => s.replace(/<[^>]+>/g, '').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function answer(html, qEnds) {
  const visible = [...html.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
    .filter((m) => unhtml(m[1]).endsWith(qEnds)).map((m) => unhtml(m[2]));
  const schema = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    for (const n of [].concat(JSON.parse(m[1])['@graph'] || JSON.parse(m[1]))) {
      if (n['@type'] === 'FAQPage') for (const q of n.mainEntity) if (q.name.endsWith(qEnds)) schema.push(q.acceptedAnswer.text);
    }
  }
  return { visible, schema };
}

/** What is wrong with the daily-plans answer, given the page's daily plans. */
export function dailyProblems(a, { perDay, fixed }) {
  const out = [];
  if (/кажд[а-яё]*\s+сутк|обновля|сбрас|в\s+полночь|ежесуточн/i.test(a)) out.push('обещает сброс дневного лимита');
  if (fixed > 0 && /вы\s+выбираете,\s+на\s+сколько\s+дней/i.test(a) && !/фиксирован/i.test(a)) out.push('«вы выбираете срок», а у части тарифов он фиксирован');
  if (fixed > 0 && !/фиксирован/i.test(a)) out.push('не сказано, что срок бывает фиксированным');
  if (perDay > 0 && !/выбира/i.test(a)) out.push('не сказано, что срок выбирают');
  return out;
}

/** What is wrong with the «Когда устанавливать eSIM?» answer. */
export function installProblems(a, { install }) {
  const out = [];
  if (/отсчитывается\s+с\s+момента\s+подключения/i.test(a)) out.push('срок «с момента подключения» без оговорки');
  if (!/«Начало срока»/.test(a)) out.push('не названа строка «Начало срока»');
  if (install && !/«после установки eSIM»/.test(a)) out.push('на странице есть тарифы «после установки eSIM» — ответ о них молчит');
  if (!install && /«после установки eSIM»/.test(a)) out.push('цитирует «после установки eSIM», которого карточки этой страницы не печатают');
  return out;
}

test('the rules fire on the sentences they exist for', () => {
  const oldDaily = 'Да, сейчас таких 6. У них платится не объём, а срок: вы выбираете, на сколько дней нужен интернет, а дневной лимит трафика обновляется каждые сутки. Минимальный срок и цена указаны в карточке каждого тарифа.';
  assert.ok(dailyProblems(oldDaily, { perDay: 6, fixed: 0 }).length > 0, 'reset claim must fail');
  assert.ok(dailyProblems(oldDaily, { perDay: 4, fixed: 2 }).length > 1, '«вы выбираете» must fail with fixed-term plans');
  const oldInstall = 'eSIM можно установить заранее, дома по Wi-Fi: после оплаты QR-код приходит на почту. Срок действия тарифа отсчитывается с момента подключения к сети в поездке, а не с момента покупки.';
  assert.ok(installProblems(oldInstall, { install: true }).length > 0);
  assert.ok(installProblems(oldInstall, { install: false }).length > 0);
  // Troubleshooting advice is not a claim about plans.
  assert.deepEqual(startRuleProblems('Чаще всего помогает простая проверка: включены ли передача данных и роуминг данных именно на eSIM.'), []);
  assert.ok(startRuleProblems('Чаще всего отсчёт идёт с первого подключения к сети за границей.').length > 0);
  assert.ok(startRuleProblems('Установить профиль лучше заранее: у многих тарифов срок стартует при первом подключении к сети.').length > 0);
  assert.ok(startRuleProblems('У большинства тарифов — нет: установка профиля сама по себе не запускает срок.').length > 0);
  assert.deepEqual(startRuleProblems('Travel-тарифы обычно работают в гостевых сетях, и телефон считает такое подключение роумингом.'), []);
  assert.ok(startRuleProblems('Обычно срок начинается с первого подключения.').length > 0);
  assert.deepEqual(startRuleProblems('Если поездка короткая, посмотрите блок «Трафик на каждый день»: у большинства таких тарифов срок выбирается отдельно, и платить за неиспользованные дни не придётся.'), []);
});

test('every country page: the daily-plans and install answers match its own catalogue — FAQ and FAQPage', () => {
  const bad = [];
  let daily = 0; let install = 0; let fixed = 0;
  for (const c of COUNTRIES) {
    const html = read(`esim/${c.slug}/index.html`);
    const shown = shownOn(c.iso);
    const d = shown.filter(isDaily);
    const t = { perDay: d.filter((p) => p.daily_term_mode === 'PER_DAY').length, fixed: d.filter((p) => p.daily_term_mode !== 'PER_DAY').length };
    const inst = shown.some((p) => INSTALL.includes(policy(p)));
    const minDays = Math.min(...d.filter((p) => p.daily_term_mode === 'PER_DAY').flatMap((p) => (p.term_prices || []).map((x) => Number(x.days))).filter((n) => n > 0));

    // Authored pages carry their own FAQ and no template answers; where a
    // template answer IS on the page, it must be true and appear exactly once
    // in each of the visible FAQ and FAQPage.
    const da = answer(html, '— есть ли тарифы с оплатой за день?');
    if (da.visible.length === 1 && da.schema.length === 1) {
      daily++; if (t.fixed) fixed++;
      if (c.daily_count === 0) bad.push(`${c.slug}: дневной ответ на странице без посуточных тарифов`);
      if (da.visible[0] !== da.schema[0]) bad.push(`${c.slug}: дневной ответ ≠ FAQPage`);
      for (const p of dailyProblems(da.visible[0], t)) bad.push(`${c.slug}: ${p}`);
      if (t.perDay && !da.visible[0].includes(`от ${minDays} `)) bad.push(`${c.slug}: минимальный срок не «от ${minDays}» (кнопки карточки начинаются с ${minDays})`);
    } else if (da.visible.length + da.schema.length) bad.push(`${c.slug}: дневной ответ ${da.visible.length}/${da.schema.length}`);
    const ia = answer(html, 'Когда устанавливать eSIM?');
    if (ia.visible.length === 1 && ia.schema.length === 1) {
      if (inst) install++;
      if (ia.visible[0] !== ia.schema[0]) bad.push(`${c.slug}: ответ об установке ≠ FAQPage`);
      for (const p of installProblems(ia.visible[0], { install: inst })) bad.push(`${c.slug}: ${p}`);
    } else if (ia.visible.length + ia.schema.length) bad.push(`${c.slug}: ответ об установке ${ia.visible.length}/${ia.schema.length}`);
  }
  assert.deepEqual(bad, []);
  // Not vacuous: the cases the old text got wrong are actually present.
  // install is small today (4): «после установки eSIM» plans covering a country
  // are mostly world packages, which country pages do not render (isGlobal).
  assert.ok(daily > 100 && fixed > 10 && install > 0, `daily ${daily}, fixed ${fixed}, install ${install}`);
});

test('the rule catches the paraphrases a second writer reaches for — and not true sentences', () => {
  // Every one of these was written by a reviewer to walk past an earlier version.
  for (const s of ['Как правило, срок начинается с подключения к сети.', 'В основном срок идёт с первого подключения.',
    'Многие тарифы активируются только при первом подключении к сети.', 'Большинство тарифов начинают действовать с первого подключения.',
    'Почти всегда тариф активируется при первом подключении.', 'По умолчанию срок идёт с первого подключения к сети.',
    'Чаще срок стартует после прилёта.', 'Когда начнётся срок, смотрите в письме.', 'Дата начала срока есть в письме заказа.',
    'Проверьте условия активации в письме заказа.', 'Обычно тариф начинает действовать при первом подключении.',
    'Момент старта указан в e-mail с заказом.', 'Чаще всего отсчёт идёт с первого подключения к сети.',
    'Срок действия тарифа отсчитывается с момента подключения к сети в поездке, а не с момента покупки.',
    'Срок действия начинается с момента первого подключения к японской сети, а не с покупки.',
    'Тариф начинает действовать с первого подключения к сети.', 'Большая часть пакетов активируется при первом подключении к сети.',
    // «Scoping» that is not scoping: only the row or a quoted card value counts.
    'Срок начинается с первого подключения к сети — без исключений.', 'Срок идёт с первого подключения к сети, а не после установки eSIM.',
    'Срок начинается с первого подключения к сети, если вы купили тариф заранее.',
    'Срок действия начинается с первого подключения к сети, поэтому в карточке это можно не проверять.',
    'Срок идёт с момента подключения к сети, кроме случаев, когда вы подключитесь дома.',
    'Срок идёт с первого подключения к сети у пакетов всех операторов.',
    // The two pages a second review found after the first fix.
    'Установка требует интернета, а начало действия тарифа обычно наступает уже в сербской сети, так что заранее поставленный профиль ничего не расходует.',
    'Отсчёт срока при этом начинается не в момент установки, так что поставить профиль за неделю до вылета ничем не грозит.',
    'Надёжнее поставить профиль дома заранее, и ранняя установка ничего не расходует.']) {
    assert.ok(startRuleProblems(s).length > 0, s);
  }
  for (const s of ['У многих телефонов eSIM включается в момент установки автоматически.', 'Письмо приходит в момент оплаты.',
    '…выбирается как обычно — по объёму и сроку поездки.', 'Чаще всего пользователи начинают с тарифа на 5 ГБ.',
    'Если поездка короткая, посмотрите блок «Трафик на каждый день»: у большинства таких тарифов срок выбирается отдельно, и платить за неиспользованные дни не придётся.',
    'Travel-тарифы обычно работают в гостевых сетях, и телефон считает такое подключение роумингом.',
    'eSIM можно установить заранее, дома: в строке «Начало срока» у тарифов блока «Тарифы для Швейцарии» указано «с первого подключения к сети».']) {
    assert.deepEqual(startRuleProblems(s), [], s);
  }
});

test('content-review TERM_START now reads «идёт» (it matched «идти» only)', () => {
  const caveatless = { lead: 'Профиль ставят дома заранее. Срок идёт с первого подключения к сети.' };
  const hits = CR.checkActivationSafety(caveatless, SHEETS.thailand);
  assert.ok(hits.length > 0, 'на странице с тарифами «после установки eSIM» это должно быть замечанием');
});

test('no page — country, guide or landing — makes a start-of-term claim the catalogue does not support', () => {
  const files = ['index.html', 'iphone.html', 'android.html',
    ...readdirSync(join(ROOT, 'esim')).map((d) => `esim/${d}/index.html`).filter((f) => existsSync(join(ROOT, f)))];
  const bad = [];
  for (const f of files) for (const block of proseOf(read(f))) for (const p of startRuleProblems(block)) bad.push(`${f}: ${p}`);
  assert.deepEqual([...new Set(bad)], []);
  assert.ok(files.length > 200, `проверено ${files.length} страниц`);
});

test('no guide sends the reader to the email for the start rule or claims a majority', () => {
  for (const f of ['iphone.html', 'android.html', 'esim/payment-rubles/index.html', 'esim/compatibility/index.html',
    'esim/not-working/index.html', 'esim/dual-sim-sms/index.html', 'esim/activation-before-travel/index.html']) {
    const t = unhtml(read(f).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' '));
    assert.deepEqual(startRuleProblems(t), [], f);
  }
});

test('advice to install at home is conditional on the «Начало срока» row', () => {
  // A sentence telling the reader to install at home / before the flight must
  // carry the condition in the same sentence.
  const early = /(?:устан[а-яё]*|став[а-яё]*)[^.]{0,60}(?:дома|до\s+вылета|заранее)|(?:дома|до\s+вылета|заранее)[^.]{0,40}(?:устан|став)/i;
  const cond = /Начало\s+срока|после\s+установки|не\s+начинается\s+с\s+установки|срок\s+тарифа\s+не\s+(?:начинается|идёт)/i;
  const assertCond = (f) => {
    const t = unhtml(read(f).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' '));
    const bad = t.split(/(?<=[.!?])\s+/).filter((s) => early.test(s) && !cond.test(s));
    assert.deepEqual(bad, [], f);
  };
  assert.ok(early.test('Установите eSIM дома по Wi-Fi — в аэропорту это делать неудобно.') && !cond.test('Установите eSIM дома по Wi-Fi — в аэропорту это делать неудобно.'), 'the rule must fire on the old iPhone line');
  for (const f of ['iphone.html', 'esim/payment-rubles/index.html']) assertCond(f);
});

test('the Mini App FAQ answer about the term makes no majority claim, in both languages', () => {
  const src = read('app/locales.js');
  const answers = [...src.matchAll(/'faq\.term\.a':\s*'([^']+)'/g)].map((m) => m[1]);
  assert.equal(answers.length, 2);
  for (const a of answers) assert.doesNotMatch(a, /Чаще всего|Most often|большинств|most plans|usually/i, a);
  // It quotes the card's own label, in each language.
  const core = read('app/core.js');
  assert.ok(answers.some((a) => a.includes('«после установки eSIM»')) && core.includes("upon_installation:'после установки eSIM'"));
  assert.ok(answers.some((a) => a.includes('“once the eSIM is installed”')) && core.includes("upon_installation: 'once the eSIM is installed'"));
});
