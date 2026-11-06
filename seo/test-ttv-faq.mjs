// Turkey, Thailand and Vietnam FAQ (2026-11-06, from Yandex Wordstat: «есим турция» 17 654 a month, «интернет в турции»
// 9 233, «сим карта турция» 4 639, «есим тайланд» 2 328, «есим вьетнам» 3 227, «сим карта вьетнам» 1 558). The answers
// carry no price, volume or package count — the cards do — and point at card rows instead. The premises those answers rest
// on are checked here on the published layout: a premise that fails makes a sentence false — rewrite the answer, never
// loosen this. Also: the visible FAQ and FAQPage are the same, each question once, and no operator or network quality.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPublishedCatalogue } from './page-claims.mjs';
import { shownBlocks } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const un = (s) => s.replace(/<[^>]+>/g, '').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const doc = loadPublishedCatalogue();

const PAGES = {
  turkey: { iso: 'TR', name: 'Турция', questions: ['Как подключить интернет в Турции туристу', 'eSIM или турецкая сим-карта — что выбрать', 'Чем eSIM удобнее роуминга своего оператора', 'Сколько трафика нужно в Турции'] },
  thailand: { iso: 'TH', name: 'Таиланд', questions: ['Сколько гигабайт брать на две недели в Таиланде', 'Нужна ли тайская сим-карта туристу', 'Как подключить eSIM в Таиланде'] },
  vietnam: { iso: 'VN', name: 'Вьетнам', questions: ['Сколько гигабайт нужно на две недели во Вьетнаме', 'Работает ли eSIM в Нячанге, на Фукуоке и Кондао', 'Что выбрать: eSIM или вьетнамскую сим-карту', 'Как подключить eSIM во Вьетнаме', 'Чем eSIM лучше роуминга во Вьетнаме'] },
};

function page(slug) {
  const html = readFileSync(join(ROOT, `esim/${slug}/index.html`), 'utf8');
  const profile = JSON.parse(readFileSync(join(ROOT, `seo/content-profiles/${slug}.json`), 'utf8'));
  const visible = [...html.matchAll(/<details class="faq-item"><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)].map((m) => ({ q: un(m[1]), a: un(m[2]) }));
  const faqPage = [].concat(...[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])['@graph'] || []))
    .find((n) => n['@type'] === 'FAQPage');
  const b = shownBlocks(doc, PAGES[slug].iso);
  return { html, profile, visible, faqPage, b, cards: [...b.local, ...b.regional, ...b.daily] };
}

for (const [slug, spec] of Object.entries(PAGES)) {
  const P = page(slug);

  test(`${slug}: the new questions are in the HTML (no script needed), each once, in the profile's order`, () => {
    const qs = P.visible.map((f) => f.q);
    for (const q of spec.questions) assert.equal(qs.filter((x) => x === q).length, 1, `«${q}»`);
    assert.equal(new Set(qs).size, qs.length, 'a question is repeated');
    assert.deepEqual(qs.slice(0, P.profile.faq.length), P.profile.faq.map((f) => f.q.trim()));
  });

  test(`${slug}: FAQPage is exactly the visible FAQ — questions and answers, in order`, () => {
    assert.ok(P.faqPage, 'FAQPage');
    assert.deepEqual(P.faqPage.mainEntity.map((e) => e.name), P.visible.map((f) => f.q));
    P.faqPage.mainEntity.forEach((e, i) => assert.equal(e.acceptedAnswer.text, P.visible[i].a, e.name));
  });

  test(`${slug}: no amount, price token, volume or term figure in the authored FAQ; no price claim left`, () => {
    for (const f of P.profile.faq) {
      assert.doesNotMatch(f.a, /\{\{price:|₽|руб/i, f.q);
      assert.doesNotMatch(f.a, /\d+(?:[.,]\d+)?\s*(?:ГБ|МБ|GB|дн|дней|день)/i, f.q);
    }
    assert.equal(P.profile.price_claims, undefined);
    assert.deepEqual(Object.keys(P.profile.price_refs), ['volume_floor'], 'only the floor of the title / description');
  });

  test(`${slug}: nothing named about an operator, an app's availability or network quality`, () => {
    const text = P.profile.faq.map((f) => `${f.q} ${f.a}`).join(' ');
    assert.doesNotMatch(text, /Turkcell|Vodafone|Türk Telekom|AIS|DTAC|TrueMove|Viettel|Vinaphone|Mobifone|МТС|Билайн|Мегафон|Теле2/i);
    assert.doesNotMatch(text, /отличн[а-яё]+ связ|стабильн[а-яё]+ связ|без перебоев|быстр[а-яё]+ интернет/i);
  });

  test(`${slug}: premise «только мобильный интернет, номера и звонков в карточках нет» — no card sells calls, SMS or a number`, () => {
    assert.ok(P.cards.length > 0);
    for (const p of P.cards) assert.doesNotMatch(String(p.name || ''), /call|voice|sms|minute|number|звон|минут|номер/i, p.name);
  });

  test(`${slug}: premise «у тарифов одного объёма срок бывает разным» — two cards share a volume with different terms`, () => {
    const terms = new Map();
    for (const p of [...P.b.local, ...P.b.regional]) {
      if (!p.data_gb || !p.validity_days) continue;
      terms.set(p.data_gb, new Set([...(terms.get(p.data_gb) || []), p.validity_days]));
    }
    assert.ok([...terms.values()].some((s) => s.size > 1), 'every volume has one term now — rewrite the answer');
  });
}

test('vietnam: premise «поколения сети у пакетов различаются»', () => {
  const nets = new Set(page('vietnam').cards.map((p) => (p.network_technologies || []).join('/')));
  assert.ok(nets.size > 1, [...nets].join(', '));
});

test('thailand: «Тайланд» appears once in the page text (the FAQ), never in the H1 — the interface keeps «Таиланд»', () => {
  const { html } = page('thailand');
  const body = html.slice(html.indexOf('<body')).replace(/<script[\s\S]*?<\/script>/g, '');
  assert.equal((un(body).match(/Тайланд/g) || []).length, 1);
  assert.doesNotMatch(html.match(/<h1[\s\S]*?<\/h1>/)[0], /Тайланд/);
});

test('the claims taken out stay out: regulator-blocked sites in Turkey, airport price mark-ups in Vietnam', () => {
  const tr = readFileSync(join(ROOT, 'seo/content-profiles/turkey.json'), 'utf8');
  const vn = readFileSync(join(ROOT, 'seo/content-profiles/vietnam.json'), 'utf8').replace(/"editor_notes":.*\n/, '');
  assert.doesNotMatch(tr.replace(/"editor_notes":.*\n/, ''), /регулятор|регулирован/);
  assert.doesNotMatch(vn, /наценк|дороже городских|выше городских/);
});
