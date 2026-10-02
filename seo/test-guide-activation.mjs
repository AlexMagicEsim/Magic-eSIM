// /esim/activation-before-travel/ — where the start of a plan's term is written.
//
// WHY
//
//   The guide told readers the start rule is «указано в карточке тарифа и в
//   письме с заказом» — four times — and that «у большинства тарифов» the term
//   starts on first network connection.
//
//   * The delivery email has five rows: Тариф, Страна/регион, Интернет, Срок
//     действия, Номер заказа (~/esim-backend/lib/retailEmail.js:101-105,
//     rendered at :296). It states HOW LONG, never FROM WHEN. That lives in the
//     backend repo, so this file can only pin the guide, not the email; re-read
//     those lines if the email changes.
//   * «Большинство» rested on nothing: activation_policy is `unknown` on ~91 %
//     of the catalogue, and the card prints a fallback there. 15 plans start
//     «после установки eSIM» — the case where installing at home burns days.
//
//   What the guide may say instead: read the «Начало срока» row, and the only
//   values it quotes are ones the card actually prints.
//
//   TRIPWIRE, deliberate: the last test needs at least one «после установки
//   eSIM» plan in assets/catalog.json. If the provider withdraws all of them,
//   the guide warns about a case that no longer exists — the build goes red
//   (the catalogue refresh PR included) until a person edits the guide.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'esim/activation-before-travel/index.html'), 'utf8');
const TARIFFS_JS = readFileSync(join(ROOT, 'assets/country-tariffs.js'), 'utf8');
const PACKAGES = JSON.parse(readFileSync(join(ROOT, 'assets/catalog.json'), 'utf8')).packages;

const text = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const sentences = (t) => t.split(/(?<=[.!?])\s+/);
const faqSchema = () => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap((m) => [].concat(JSON.parse(m[1])['@graph'] || JSON.parse(m[1])))
  .filter((n) => n['@type'] === 'FAQPage').flatMap((n) => n.mainEntity.map((q) => `${q.name} ${q.acceptedAnswer.text}`)).join(' ');

/** Sentences that send the reader to the email for the start rule, or claim a majority. */
export function startRuleProblems(t) {
  const out = [];
  for (const s of sentences(t)) {
    const aboutStart = /Начало срока|начина|старт|отсч[её]т|момент|счита|пойд[уёе]т\s+дни|когда\s+пойдут|(?:условия|правил[а-яё]*)\s+(?:старта|начала)|(?:услови|правил)[а-яё]*[^.]{0,40}(?:срок|тариф)/i.test(s);
    const mail = /письм|e-?mail|почт/i.test(s);
    if (mail && aboutStart && !/срок\s+действия,\s+но\s+не\s+момент/i.test(s)) out.push(`письмо как источник условия старта: «${s.trim()}»`);
    if (/у\s+большинства|в\s+большинстве|больш[а-яё]+\s+част[а-яё]*\s+тариф|чаще\s+всего|(?<![а-яё])обычно[^.]{0,40}(?:срок|отсч[её]т|начина)/i.test(s)) out.push(`утверждение о большинстве тарифов: «${s.trim()}»`);
  }
  return out;
}

test('the rule fires on the sentences it exists for', () => {
  for (const old of [
    'Точное правило всегда указано в карточке тарифа и в письме с заказом — проверьте его до установки.',
    'Но проверьте условия своего тарифа в карточке и письме — правила зависят от конкретного тарифа.',
    'Условия старта тарифа прочитаны в карточке/письме — вы знаете, когда начнётся отсчёт срока.',
    'У большинства тарифов Magic eSIM отсчёт начинается при первом подключении к сети в стране поездки.',
    // Paraphrases a second writer would reach for.
    'Из письма вы узнаете, с какого момента считается срок.',
    'В письме написано, когда пойдут дни.',
    'Момент старта указан в e-mail с заказом.',
    'В большинстве тарифов срок идёт с подключения.',
    'Обычно срок начинается с первого подключения.',
    'Чаще всего отсчёт идёт с первого подключения к сети.',
    'В письме указан момент старта, а не момент покупки.',
  ]) assert.ok(startRuleProblems(old).length > 0, old);
  // The true sentence about the email must pass.
  assert.deepEqual(startRuleProblems('Проверьте эту строку до установки: в письме с заказом указан срок действия, но не момент, с которого он считается.'), []);
  // Delivery instructions mentioning the email are not about the start rule.
  assert.deepEqual(startRuleProblems('Тариф куплен, письмо с QR-кодом получено и открывается.'), []);
  assert.deepEqual(startRuleProblems('Письмо приходит сразу; условия возврата — в соглашении.'), []);
});

test('the guide never sends the reader to the email for the start rule — page and FAQPage', () => {
  assert.deepEqual(startRuleProblems(text(html)), []);
  assert.deepEqual(startRuleProblems(faqSchema()), []);
});

test('it points at the row the card actually has', () => {
  assert.match(text(html), /«Начало срока»/);
  assert.match(readFileSync(join(ROOT, 'index.html'), 'utf8'), /<span class="k">Начало срока<\/span>/);
  assert.match(TARIFFS_JS, /setCovText\('covStart'/);
});

test('every start value the guide quotes is one a card prints, and «после установки eSIM» is real', () => {
  // Only the activation map and its fallback — not every key:'value' in the file.
  const map = (TARIFFS_JS.match(/var TARIFF_ACTIVATION_LABELS=\{([\s\S]*?)\};/) || [])[1] || '';
  const labels = new Set([...map.matchAll(/:'([^']+)'/g)].map((m) => m[1]));
  const fallback = (TARIFFS_JS.match(/TARIFF_ACTIVATION_FALLBACK='([^']+)'/) || [])[1];
  assert.ok(labels.size >= 3 && fallback, 'не нашли TARIFF_ACTIVATION_LABELS / FALLBACK — тест бы прошёл вхолостую');
  labels.add(fallback);
  // Every guillemet quote that names a moment («с …», «после …», «при …», «сразу …»).
  const quoted = [...text(html).matchAll(/«((?:с первого|после|при|сразу|с момента)[^»]*)»/g)].map((m) => m[1]);
  assert.ok(quoted.length >= 3, `ожидали цитаты значений «Начала срока», нашли ${quoted.length}`);
  for (const q of quoted) assert.ok(labels.has(q), `«${q}» — такого значения карточка не печатает`);
  const install = PACKAGES.filter((p) => ['installation', 'upon_installation'].includes(p.activation_policy)).length;
  assert.ok(install > 0, 'гайд предупреждает о «после установки eSIM» — в каталоге таких тарифов нет');
});
