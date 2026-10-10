// The home page's «Почему Magic eSIM» block and its FAQ.
//
// WHY THIS FILE EXISTS
//
//   The SEO gap audit of 2026-09-30 found the home page — the most-crawled URL
//   on the site — with no FAQ and no FAQPage, and with benefits that described
//   eSIM in general rather than this service: the word «рублях» did not occur
//   on it once, while every country page leads with payment in roubles.
//
//   Both were added with three constraints this file pins:
//     1. the visible FAQ and the FAQPage schema say the same thing, question
//        for question — the five guides are already held to this; the home
//        page had no FAQ to hold;
//     2. each answer is a sentence or two plus a link to the guide that answers
//        in full — the home page must not become a sixth copy of the guides'
//        answers (176 country pages once cannibalised a guide that way);
//     3. payment is named only in the mandated form — «российской банковской
//        картой или через СБП» — and nothing implies a foreign card works.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOME = readFileSync(join(ROOT, 'index.html'), 'utf8');
const text = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function section(id) {
  const m = HOME.match(new RegExp(`<section\\b[^>]*\\bid="${id}"[\\s\\S]*?</section>`));
  assert.ok(m, `секции #${id} на главной нет`);
  return m[0];
}

function visibleFaq() {
  return [...section('faq').matchAll(/<details class="home-faq-item"><summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map((m) => ({ q: text(m[1]), a: text(m[2]), html: m[2] }));
}

function schemaFaq() {
  for (const [, raw] of HOME.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const j = JSON.parse(raw);
    for (const node of j['@graph'] || [j]) {
      if (node['@type'] === 'FAQPage') return node.mainEntity.map((e) => ({ q: e.name, a: e.acceptedAnswer.text }));
    }
  }
  return null;
}

test('the home page carries a FAQ, and exactly one FAQPage', () => {
  const faq = visibleFaq();
  assert.ok(faq.length >= 4 && faq.length <= 8, `вопросов ${faq.length}`);
  const blocks = [...HOME.matchAll(/"@type":\s*"FAQPage"/g)].length;
  assert.equal(blocks, 1, 'FAQPage на главной должен быть ровно один');
});

test('FAQPage says exactly what the visitor sees, question for question', () => {
  assert.deepEqual(schemaFaq(), visibleFaq().map(({ q, a }) => ({ q, a })));
});

test('every answer links to a guide that exists, and none is a copy of that guide', () => {
  const guideFaqs = [];
  for (const g of ['payment-rubles', 'activation-before-travel', 'compatibility', 'dual-sim-sms', 'not-working']) {
    const h = readFileSync(join(ROOT, 'esim', g, 'index.html'), 'utf8');
    for (const [, raw] of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const j = JSON.parse(raw);
      for (const node of j['@graph'] || [j]) {
        if (node['@type'] === 'FAQPage') for (const e of node.mainEntity) guideFaqs.push({ q: e.name, a: e.acceptedAnswer.text });
      }
    }
  }
  assert.ok(guideFaqs.length > 20, `вопросов в гайдах ${guideFaqs.length} — селектор сломался?`);
  const words = (s) => new Set(s.toLowerCase().match(/[a-zа-яё0-9]+/g) || []);
  const jaccard = (a, b) => { const A = words(a), B = words(b); const i = [...A].filter((w) => B.has(w)).length; return i / (A.size + B.size - i); };
  for (const { q, a, html } of visibleFaq()) {
    const links = [...html.matchAll(/href="(\/esim\/[a-z-]+\/)"/g)].map((m) => m[1]);
    const mail = /href="mailto:support@magicesim\.store"/.test(html);
    assert.ok(links.length || mail, `«${q}» никуда не ведёт`);
    for (const l of links) assert.ok(existsSync(join(ROOT, l, 'index.html')), `${l} не существует`);
    for (const g of guideFaqs) {
      assert.notEqual(q, g.q, `вопрос «${q}» дословно повторяет гайд`);
      assert.ok(jaccard(a, g.a) < 0.5, `ответ на «${q}» пересказывает гайд: «${g.q}»`);
    }
  }
});

test('payment is named only in the mandated form', () => {
  // «Почему Magic eSIM» (#why-magic) left the home with RU↔EN migration PR C; the
  // payment answer lives in the FAQ, and the footer says it on every page.
  const faq = visibleFaq().map((f) => f.a).join(' ');
  const home = text(HOME.replace(/<head>[\s\S]*?<\/head>/, ''));
  assert.match(faq, /Российской банковской картой или через СБП/);
  assert.match(faq, /Карты иностранных банков пока не принимаются/);
  assert.match(home, /российской картой или через СБП/);
  // The plain word is what regresses, not the phrases nobody writes (§31).
  for (const bad of [/любой карт/i, /any card/i, /\bVisa\b/, /Mastercard/i, /иностранн[а-яё]* карт[а-яё]* (?:тоже|также) /i]) {
    assert.doesNotMatch(home, bad);
  }
  assert.doesNotMatch(faq, /(?:^|[^а-яё])картой(?! или через СБП)(?![а-яё])/i, '«картой» без «российской … или через СБП»');
});

test('the home promises nothing about the network', () => {
  // The rule «Почему Magic eSIM» was held to, now for the whole page.
  const home = text(HOME.replace(/<head>[\s\S]*?<\/head>/, ''));
  for (const bad of [/5G/, /4G/, /скорост/i, /покрыти[а-яё]* (?:везде|вс[её]й|полн)/i, /без ограничений/i, /безлимит/i, /гарантир/i]) {
    assert.doesNotMatch(home, bad, `«${home.match(bad)?.[0]}» — утверждение о сети, которого каталог не подтверждает`);
  }
});

test('the activation answer carries the installation caveat', () => {
  // Same rule as TERM_START in content-review.mjs: advice to install early must
  // say that some tariffs start counting at installation.
  const a = visibleFaq().find((f) => /устанавливать/i.test(f.q));
  assert.ok(a, 'нет вопроса про момент установки');
  assert.match(a.a, /после установки/);
});
