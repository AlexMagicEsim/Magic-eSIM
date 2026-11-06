// The China page's FAQ (2026-11-06, from Yandex Wordstat: «есим китай» 16 595 a month, «интернет в китае» 11 053). Every
// answer points at a row the cards print instead of promising a property, so the premises those rows rest on are checked
// here on the published layout: a row that disappears from every China card makes its sentence false — rewrite it, never
// loosen this. Also: the visible FAQ and FAQPage are the same questions, each once, and nothing is promised about a named
// app, an operator or network quality.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPublishedCatalogue } from './page-claims.mjs';
import { shownBlocks } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'esim/china/index.html'), 'utf8');
const profile = JSON.parse(readFileSync(join(ROOT, 'seo/content-profiles/china.json'), 'utf8'));
const un = (s) => s.replace(/<[^>]+>/g, '').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const visible = [...html.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)]
  .map((m) => ({ q: un(m[1]), a: un(m[2]) }));
const faqPage = [].concat(...[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => JSON.parse(m[1])['@graph'] || []))
  .find((n) => n['@type'] === 'FAQPage');

const b = shownBlocks(loadPublishedCatalogue(), 'CN');
const cards = [...b.local, ...b.regional, ...b.daily];

const QUESTIONS = [
  'Работает ли eSIM в Китае',
  'Как подключить интернет в Китае',
  'Будут ли работать мессенджеры и нужен ли VPN',
  'Можно ли установить eSIM до поездки',
  'Когда начинается срок действия тарифа',
  'Нужен ли физический SIM-слот',
  'Как проверить, поддерживает ли телефон eSIM',
  'Можно ли раздавать интернет с китайской eSIM',
];

test('the authored questions are on the page, in the HTML (no script needed), each once', () => {
  const qs = visible.map((f) => f.q);
  for (const q of QUESTIONS) assert.equal(qs.filter((x) => x === q).length, 1, `«${q}»`);
  assert.equal(new Set(qs).size, qs.length, 'a question is repeated');
  assert.deepEqual(qs.slice(0, profile.faq.length), profile.faq.map((f) => f.q), 'the profile order');
});

test('FAQPage is exactly the visible FAQ — the same questions and answers, in order', () => {
  assert.ok(faqPage, 'FAQPage');
  assert.deepEqual(faqPage.mainEntity.map((e) => e.name), visible.map((f) => f.q));
  faqPage.mainEntity.forEach((e, i) => assert.equal(e.acceptedAnswer.text, visible[i].a, e.name));
});

test('one H1, the FAQ under an H2, questions are summaries (not headings)', () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<section class="cp-sec faq" id="faq">\s*<h2>Вопросы о eSIM: Китай<\/h2>\s*<details class="faq-item">/);
});

test('premise: hotspot is confirmed on SOME China cards and denied on none («у части тарифов … если такой строки нет»)', () => {
  assert.ok(cards.length > 0);
  assert.ok(cards.some((p) => p.hotspot_supported === true), 'no card says «Раздача интернета: поддерживается»');
  assert.ok(cards.some((p) => p.hotspot_supported !== true), '«у части» — every card confirms it now; rewrite the answer');
});

test('premise: the «Начало срока» values quoted are both printed by China cards', () => {
  assert.ok(cards.some((p) => String(p.activation_policy || '').trim().toLowerCase() === 'first_data_usage'), '«с первого использования интернета»');
  // the card's fallback «с первого подключения к сети» (unknown policy) or the stated network-connection policies
  assert.ok(cards.some((p) => ['', 'unknown', 'first_network_connection', 'network_connection'].includes(String(p.activation_policy || '').trim().toLowerCase())),
    '«с первого подключения к сети»');
});

test('premise: every China card has a «Сеть» generation; some carry an IP exit mark and some do not', () => {
  for (const p of cards) assert.ok((p.network_technologies || []).length || p.speed, `${p.name}: no «Сеть»`);
  const ip = (p) => (Array.isArray(p.ip_export) ? p.ip_export.filter(Boolean) : []);
  assert.ok(cards.some((p) => ip(p).length), 'no «IP: …» mark');
  assert.ok(cards.some((p) => !ip(p).length), '«у других такой отметки нет»');
});

test('nothing is promised about a named app, an operator or the network in a place', () => {
  const text = profile.faq.map((f) => `${f.q} ${f.a}`).join(' ');
  assert.doesNotMatch(text, /WhatsApp|Telegram|Телеграм|WeChat|Google|YouTube|Instagram|Ватсап/i);
  assert.doesNotMatch(text, /China Mobile|China Unicom|China Telecom|Чайна/i);
  assert.doesNotMatch(text, /отличн[а-яё]+ связ|стабильн[а-яё]+ связ|без перебоев/i);
  // every «гарантир…» / «обещ…» is negated
  for (const m of text.matchAll(/[^.]*(?:гарантир|обещ)[^.]*\./gi)) assert.match(m[0], /(?<![а-яё])не(?![а-яё])|ни один|нельзя/i, m[0]);
});
