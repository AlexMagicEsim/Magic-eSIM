// Network quality in a place — a claim no catalogue field can prove.
//
// WHY THIS FILE EXISTS
//
//   An independent audit on 2026-10-01 read all 61 authored profiles and found
//   35 sentences that promised the quality of the network in a city, on a train
//   or along a coast — «Берлин, Мюнхен, Гамбург, Франкфурт закрыты уверенно»,
//   «интернет есть и в поездах», «связь ровная», «5G работает в метро». Not one
//   cited an operator or regulator; they came from blog sources. The rule that
//   was meant to stop them (PLACE_COVERAGE) matched NONE of the 1471 fields, and
//   it ran only from the content-review CLI — not in npm test at all.
//
//   The sentences are rewritten; this file keeps them out. The first two cases
//   are the exact sentences the review named. The coverage guard proves which
//   countries a product covers — not what the signal is like there.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PLACE_COVERAGE, checkCoverageClaims, validNetworkFact, NETWORK_QUALITY_BACKLOG } from "./content-review.mjs";
import { fieldText, isWholeSentence } from "./coverage-claims.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The exact sentences that shipped, verbatim. Germany and Italy first.
const SHIPPED = [
  ["germany", "Само покрытие в Германии ровное в городах и вдоль основных магистралей: Берлин, Мюнхен, Гамбург, Франкфурт закрыты уверенно."],
  ["italy", "С покрытием в Италии всё в порядке: города, побережье и основные железнодорожные линии закрыты уверенно, интернет есть и в поездах между крупными городами."],
  ["germany", "Там связь не пропадает совсем, но скорость может опуститься до уровня, на котором видеозвонок уже не тянет."],
  ["germany", "Города покрыты уверенно"],
  ["italy", "На линиях между крупными городами связь ровная почти всю дорогу, и переезд не превращается в офлайн."],
  ["france", "Французская сеть в городах и вдоль скоростных линий плотная: Париж, Лион, Марсель, побережье покрыты уверенно, интернет в TGV работает на большей части маршрута."],
  ["france", "На большей части маршрута да — связь вдоль скоростных линий ровная, и дорога между городами не превращается в офлайн."],
  ["france", "Короткие провалы бывают в тоннелях и на отдельных участках вдали от городов, но они не мешают ни навигации, ни переписке."],
  ["japan", "Синкансэн, токийское метро, подземные переходы — покрытие ровное."],
  ["japan", "Да, поездка вдоль скоростных линий — это долгие перегоны, где телефон почти не выпускают из рук, и в поездке между Токио и Киото связь не пропадает надолго."],
  ["japan", "Короткие провалы бывают в длинных тоннелях, но они длятся секунды и не мешают ни навигации, ни переписке."],
  ["south-korea", "5G работает в сеульском метро, на скоростных поездах KTX и в туристических районах вроде Мёндона и Хондэ."],
  ["south-korea", "Сеульское метро и скоростные поезда покрыты уверенно."],
  ["south-korea", "Дорога между городами не превращается в офлайн."],
  ["singapore", "Ограничением связь здесь не станет — вопрос только в том, какой объём осмысленно покупать под короткий срок."],
  ["singapore", "Город покрыт целиком"],
  ["singapore", "MRT, подземные переходы, торговые галереи — связь ровная."],
  ["singapore", "Навигация под землёй работает так же, как на поверхности."],
  ["uae", "Со всем остальным в ОАЭ проще, чем почти где-либо: сеть в Дубае и Абу-Даби очень плотная, 5G есть в торговых центрах, метро и на набережных, а качество связи ровное даже в высокий сезон."],
  ["china", "Со связью как таковой в Китае проблем нет: сеть в Пекине, Шанхае, Гуанчжоу и Шэньчжэне очень плотная, скоростной интернет есть в метро и в скоростных поездах."],
  ["thailand", "Тайская мобильная сеть в туристических местах плотная: в Бангкоке, на Пхукете, в Чиангмае и на Самуи связь ровная."],
  ["thailand", "На Пхукете и Самуи покрытие городское, но на паромах и в бухтах поменьше сигнал плавает."],
  ["turkey", "Турецкая сеть в курортных и городских зонах плотная: Стамбул, Анталья, Измир, Каппадокия покрыты уверенно."],
  ["indonesia", "Со связью на Бали и в других туристических зонах всё в порядке: 4G работает в Убуде, Чангу, Семиньяке и Куте, местами доступен 5G."],
  ["indonesia", "Туристические зоны покрыты"],
  ["indonesia", "Профиль обычно ставят дома и включают после посадки — интернет появляется до выхода из терминала."],
  ["united-kingdom", "На поверхности картина обычная для крупной европейской страны: города покрыты уверенно, вдоль магистралей связь ровная, а провалы начинаются в Шотландском высокогорье, в Озёрном крае и на валлийских дорогах."],
  ["usa", "За городом картина меняется резко — на межштатных трассах сигнал переходит в 4G, а в национальных парках вроде Йосемити, Долины Смерти или Гранд-Каньона его местами нет вовсе."],
  ["usa", "Скорости в мегаполисах достаточно для видео и работы."],
];

test("the rule fires on the Germany and Italy sentences that shipped", () => {
  const [de, it] = SHIPPED;
  assert.equal(de[0], "germany"); assert.equal(it[0], "italy");
  assert.match(de[1], PLACE_COVERAGE);
  assert.match(it[1], PLACE_COVERAGE);
});

test("the rule fires on every other shipped quality promise it is meant to catch", () => {
  const missed = SHIPPED.filter(([, t]) => !PLACE_COVERAGE.test(t)).map(([s, t]) => `${s}: ${t}`);
  assert.deepEqual(missed, []);
  assert.ok(SHIPPED.length >= 29);
});

test("honest wording passes: what the card prints, and that we publish no coverage maps", () => {
  for (const ok of [
    "Карт покрытия мы не публикуем, и качество связи в конкретном городе или на перегоне по карточке тарифа не узнать.",
    "Тариф действует по всей Италии в рамках покрытия, но карт покрытия мы не публикуем.",
    "Поколение сети напечатано в каждой карточке — сравните его до покупки.",
    "В строке «Сеть» у тарифа 4G — это данные каталога, а не обещание скорости в конкретном месте.",
    "Карточка тарифа описывает страну целиком, а не железнодорожные линии, поэтому связь в конкретном поезде она не обещает.",
    "Сеть Македонии в каталоге названа по оператору.",
  ]) assert.doesNotMatch(ok, PLACE_COVERAGE, ok);
});

test("dual_sim_note is read: a promise hidden in the note is caught too", () => {
  const p = { dual_sim_note: { text: "В метро связь ровная — {link}.", anchor: "x" } };
  assert.equal(checkCoverageClaims(p).length, 1);
});

test("no authored page promises the quality of the network in a place", () => {
  const bad = [];
  for (const f of readdirSync(join(ROOT, "seo", "content-profiles")).filter((x) => x.endsWith(".json"))) {
    const p = JSON.parse(readFileSync(join(ROOT, "seo", "content-profiles", f), "utf8"));
    for (const x of checkCoverageClaims(p, { slug: f.slice(0, -5) })) bad.push(`${f}: ${x}`);
  }
  assert.deepEqual(bad, []);
});


const FACT = { field: "intro[0]", source: "https://tfl.gov.uk/modes/tube/station-wifi", checked: "2026-10-01", review_by: "2027-01-15" };
const SOURCES = [FACT.source];

test("network_facts: a place-level sentence passes only when declared, for its own field, with a primary source", () => {
  const sentence = "По данным TfL, 4G и 5G работают на станциях и в тоннелях на участках линий.";
  const today = "2026-10-01";
  const page = (extra = {}, fact = {}) => ({ intro: [sentence], sources: SOURCES, network_facts: [{ ...FACT, text: sentence, ...fact }], ...extra });
  assert.equal(checkCoverageClaims({ intro: [sentence] }, { slug: "united-kingdom", today }).length, 1, "undeclared — caught");
  assert.equal(checkCoverageClaims(page(), { slug: "united-kingdom", today }).length, 0, "declared — passes");
  assert.equal(checkCoverageClaims(page({ intro: [], lead: sentence }), { slug: "united-kingdom", today }).length, 1, "declared for intro[0], not for lead");
  assert.equal(checkCoverageClaims(page({ intro: [sentence + " Связь ровная по всему Лондону."] }), { slug: "united-kingdom", today }).length, 1, "a declaration covers its own sentence only");
  assert.equal(checkCoverageClaims(page({ sources: ["https://vc.ru/life/1"] }, { source: "https://vc.ru/life/1" }), { slug: "united-kingdom", today }).length, 1, "a blog is not a primary source");
  assert.equal(checkCoverageClaims(page({}, { source: "https://tfl.gov.uk.evil.example/x" }), { slug: "united-kingdom", today }).length, 1, "lookalike host refused");
  assert.equal(checkCoverageClaims(page({ sources: ["http://tfl.gov.uk/x"] }, { source: "http://tfl.gov.uk/x" }), { slug: "united-kingdom", today }).length, 1, "http refused");
  assert.equal(checkCoverageClaims(page({ sources: [] }), { slug: "united-kingdom", today }).length, 1, "source must be listed in the profile's sources");
  assert.equal(checkCoverageClaims(page(), { slug: "united-kingdom", today: "2027-01-16" }).length, 1, "past review_by — stops counting");
  assert.equal(checkCoverageClaims(page({}, { review_by: undefined }), { slug: "united-kingdom", today }).length, 1, "no review_by — refused");
  assert.equal(checkCoverageClaims(page(), { slug: "germany", today }).length, 1, "a TfL URL does not attest a German page");
  assert.equal(checkCoverageClaims(page({}, { review_by: "2099-01-01" }), { slug: "united-kingdom", today }).length, 1, "review_by more than six months after the check — refused");
});

test("the coverage-map hedge is honest, and it cannot launder a promise standing beside it", () => {
  for (const s of ["У тарифа 5G, но карт покрытия мы не публикуем.", "Тариф действует по всей Японии в рамках покрытия, но связь в конкретном поезде не обещает."])
    assert.deepEqual(checkCoverageClaims({ intro: [s] }), [], s);
  for (const s of [
    "5G работает в сеульском метро; карт покрытия мы не публикуем.",
    "Города покрыты, но карт покрытия мы не публикуем.",
    "Скорости в мегаполисах достаточно для видео, хотя тариф этого не обещает.",
    "4G в метро есть везде — тариф не обещает только 5G.",
    "В метро связь ровная, хотя карт покрытия мы не публикуем.",
  ]) assert.equal(checkCoverageClaims({ intro: [s] }).length, 1, s);
});

test("generic quality promises are caught too, not only the shipped phrasings", () => {
  for (const s of [
    "Связь в Сингапуре везде отличная.", "Интернет в метро работает без перебоев.", "Связь стабильная даже в горах.",
    "Покрытие хорошее на всём побережье.", "Сеть здесь самая плотная в мире.", "Связь надёжная по всему побережью.",
    "Интернет быстрый даже в метро.", "В метро сигнал есть на всех станциях.", "5G доступен по всему Сеулу.",
    "Мобильный интернет работает повсюду.", "Покрытие сплошное.", "LTE ловит в каждом вагоне.",
    "Интернет без проблем работает в поездах.", "Японская сеть — одна из самых плотных в мире.",
    "MRT покрыт полностью.", "Связь уверенная даже в горах.", "В метро Сеула 5G.", "В поездах KTX интернет не пропадает.",
    "Интернет работает без сбоев в Токио.", "Покрытие в городах полное.", "Сеть в Сеуле одна из лучших в мире.",
    "Связь в Берлине ровная.", "Пятое поколение доступно в метро Сеула.",
  ]) assert.ok(PLACE_COVERAGE.test(s), s);
  for (const s of ["В отелях интернет есть почти везде, но экскурсии, такси и переводчик нужны там, где его нет.",
    "Местную SIM здесь оформляют по паспорту, и на это уходит время первого дня — а он обычно самый плотный.",
    "В Таиланде интернет расходуется быстрее, чем планировалось.", "Связь в горах нестабильна.", "Связь есть не везде."]) assert.ok(!PLACE_COVERAGE.test(s), s);
});

test("the deferred LOW backlog only shrinks: every entry is still on its page and still needs the exemption", () => {
  for (const [slug, list] of Object.entries(NETWORK_QUALITY_BACKLOG)) {
    const p = JSON.parse(readFileSync(join(ROOT, "seo", "content-profiles", `${slug}.json`), "utf8"));
    const prose = JSON.stringify([p.title, p.description, p.h1, p.lead, p.intro, p.why, p.faq, p.dual_sim_note]);
    for (const s of list) {
      assert.ok(prose.includes(s), `${slug}: «${s}» больше нет на странице — уберите из NETWORK_QUALITY_BACKLOG`);
      assert.ok(PLACE_COVERAGE.test(s), `${slug}: «${s}» правило уже не ловит — исключение лишнее`);
    }
    assert.equal(checkCoverageClaims(p, { slug }).length, 0);
    assert.ok(checkCoverageClaims(p).length > 0, `${slug}: without the backlog entry the page is caught`);
  }
});

test("every declared network fact is a whole sentence of its page, primary-sourced, dated and not past review", () => {
  const bad = [];
  for (const f of readdirSync(join(ROOT, "seo", "content-profiles")).filter((x) => x.endsWith(".json"))) {
    const p = JSON.parse(readFileSync(join(ROOT, "seo", "content-profiles", f), "utf8"));
    for (const x of p.network_facts || []) {
      const t = fieldText(p, x.field);
      if (!t || !isWholeSentence(t, x.text)) bad.push(`${f} ${x.field}: не целое предложение страницы — «${x.text}»`);
      if (!validNetworkFact(x, f.slice(0, -5), undefined, p.sources || [])) bad.push(`${f} ${x.field}: источник не первичный, нет дат или истёк review_by`);
      if (!(p.sources || []).includes(x.source)) bad.push(`${f} ${x.field}: источника нет в sources`);
    }
  }
  assert.deepEqual(bad, []);
});
