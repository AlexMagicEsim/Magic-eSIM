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
import { PLACE_COVERAGE, checkCoverageClaims, validNetworkFact } from "./content-review.mjs";
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

// 2026-10-01, second pass: the 54 LOW findings, classified A/B/C/D by two
// independent reviewers. Every A sentence as it shipped is caught (the Georgia
// title was fixed later, in its own PR, by the owner's decision). Every B (honest warning) and D (not a network claim) sentence, as it is
// on the page now, must pass — a guard that blocks «в горах сигнал редеет»
// would push the copy toward saying less, not toward saying true things.
const page = (field, text) => (/\.h$/.test(field) ? { why: [{ h: text, p: "x" }] } : { intro: [text] });

const LOW_A = [
  ["georgia title #54", "title", "eSIM для Грузии — интернет в Тбилиси, Батуми и в горах"],
  ["germany why[2].p #6", "why[2].p", "Для переписки хватает, для видеозвонка — не всегда."],
  ["italy intro[1] #10", "intro[1]", "Ощутимые провалы начинаются в горных городках Тосканы и Умбрии, на серпантинах Амальфи и в Доломитах — там, где как раз хочется проложить маршрут на ходу."],
  ["italy faq[2].a #13", "faq[2].a", "В самих городках обычно да, а вот на дорогах между ними и на серпантинах сигнал бывает неровным."],
  ["france intro[1] #14", "intro[1]", "Ощутимые провалы начинаются в горах — в альпийских долинах и на серпантинах Корсики, где вышек мало, а навигация нужна больше обычного."],
  ["japan intro[0] #16", "intro[0]", "Японская сеть — одна из самых плотных в мире."],
  ["south-korea faq[3].a #19", "faq[3].a", "В основном да — базовая навигация и мессенджеры работают на большинстве популярных маршрутов вокруг Сеула и в национальных парках."],
  ["uae faq[4].a #22", "faq[4].a", "Да, локальный тариф действует на территории всей страны — Дубай, Абу-Даби, Шарджа, Рас-эль-Хайма и остальные эмираты покрываются одинаково."],
  ["thailand intro[0] #25", "intro[0]", "Провалы начинаются там, куда туристы добираются реже — на переходах между островами, в горных нацпарках на севере и на дорогах между провинциями."],
  ["thailand lead #26", "lead", "Поэтому выбор здесь не про «есть связь или нет», а про то, какой объём взять, чтобы не докупать на десятый день."],
  ["turkey why[1].p #28", "why[1].p", "Именно на трассах и в горных участках Каппадокии связь неровная."],
  ["indonesia intro[1] #29", "intro[1]", "Провалы встречаются на севере острова, в районе рисовых террас и на дорогах в горы — там, где вышек меньше, а серпантин требует навигации больше всего."],
  ["united-kingdom dual_sim_note.text #35", "dual_sim_note.text", "В метро интернет идёт через eSIM, а звонки принимает ваш номер, как обычно: {link}."],
  ["usa why[0].p #36", "why[0].p", "Здесь важен объём пакета, а не качество сети."],
  ["spain lead #40", "lead", "На практике это не так: острова входят в ту же национальную сеть, и локальный тариф работает на них так же, как в Мадриде."],
  ["spain why[0].h #41", "why[0].h", "Острова — та же сеть"],
  ["greece lead #43", "lead", "eSIM устанавливается до вылета и работает по всей стране."],
  ["maldives description #44", "description", "eSIM для Мальдив: связь на трансферах и на острове, не завися от резортного Wi-Fi."],
  ["maldives why[1].h #45", "why[1].h", "Связь на трансферах"],
  ["maldives intro[0] #46", "intro[0]", "Свой мобильный интернет делает поездку предсказуемой — мессенджеры и звонки домой работают из бунгало и с пляжа в рамках покрытия сети."],
  ["vietnam why[0].p #47", "why[0].p", "В Ханое и Хошимине вопрос обычно только в размере пакета: расход в городе ровный и предсказуемый."],
  ["vietnam why[3].p #48", "why[3].p", "Готовый профиль работает сразу после посадки: не нужно искать стойку и платить курортную наценку."],
  ["serbia intro[1] #49", "intro[1]", "eSIM удобна именно этим разрывом: профиль ставится дома по Wi-Fi, оплачивается российской банковской картой или через СБП, и работает с момента прилёта."],
  ["montenegro intro[0] #51", "intro[0]", "То есть переплата покрывает право пересечь границу и более быструю сеть, но не более мягкий лимит."],
  ["kyrgyzstan faq[2].a #52", "faq[2].a", "Покрытие зависит от сети оператора, а не от того, какой eSIM вы купили: на трассах вдоль озера и в населённых пунктах связь обычно есть, в глухих ущельях её может не быть ни у кого."],
  ["sri-lanka faq[2].a #53", "faq[2].a", "Покрытие обеспечивают местные сети, и на побережье оно обычно устойчивее, чем в горных районах вокруг Эллы и на плантациях."],
];

const LOW_B_AND_D = [
  ["germany intro[1] #1", "intro[1]", "Карт покрытия мы не публикуем, и качество связи в конкретном городе или на перегоне по карточке тарифа не узнать. Если в дороге запланирован созвон или работа с документами, нужные файлы и билеты лучше заранее сохранить офлайн."],
  ["germany intro[0] #2", "intro[0]", "Практика простая: интернет на ноутбук можно раздать с телефона — тогда работа в дороге не зависит от того, есть ли у поезда или кафе своя сеть. Расход при этом растёт кратно, и объём под такой сценарий считают отдельно от обычного телефонного."],
  ["germany why[0].h #3", "why[0].h", "Раздача на ноутбук"],
  ["germany why[2].h #4", "why[2].h", "Между землями бывает медленно"],
  ["germany why[2].p #5", "why[2].p", "На сельских участках скорость падает."],
  ["germany faq[1].a #7", "faq[1].a", "Wi-Fi в поезде к тарифу отношения не имеет. Если в дороге нужен созвон или работа с документами, интернет на ноутбук можно раздать с телефона — объём пакета тогда считают с учётом ноутбука."],
  ["germany h1 #8", "h1", "Связь в Германии: когда телефон заменяет вагонный Wi-Fi"],
  ["germany lead #9", "lead", "Германия — страна, куда чаще едут работать, чем отдыхать: конференции, командировки, переезды между городами с ноутбуком на коленях. И частый рабочий сценарий здесь — поезд, ноутбук и звонок через десять минут, для которого нужен интернет."],
  ["italy why[2].p #11", "why[2].p", "Тоскана, Умбрия, Амальфи, Доломиты — участки с неровным сигналом."],
  ["italy faq[1].a #12", "faq[1].a", "Тариф действует по всей Италии в рамках покрытия, но связь в конкретном поезде не обещает — карт покрытия мы не публикуем. Билеты и брони удобнее держать офлайн: тогда посадка и пересадки не зависят от сигнала в вагоне."],
  ["france why[2].p #15", "why[2].p", "В горных долинах сигнал редеет."],
  ["south-korea intro[1] #17", "intro[1]", "Что до самой сети, поколение указано в строке «Сеть» карточки — у большинства корейских тарифов сейчас там есть 5G. О связи в конкретном месте — в сеульском метро, в поезде KTX или в горах национальных парков — карточка не говорит, поэтому маршрут на день лучше сохранить офлайн."],
  ["south-korea intro[1] #18", "intro[1]", "Что до самой сети, поколение указано в строке «Сеть» карточки — у большинства корейских тарифов сейчас там есть 5G. О связи в конкретном месте — в сеульском метро, в поезде KTX или в горах национальных парков — карточка не говорит, поэтому маршрут на день лучше сохранить офлайн."],
  ["uae intro[1] #20", "intro[1]", "Со всем остальным выбор здесь обычный: поколение сети указано в строке «Сеть» карточки, а о качестве связи в конкретном торговом центре или на набережной карточка не говорит — карт покрытия мы не публикуем. Для маршрутов в пустыню карту лучше сохранить заранее."],
  ["uae why[2].p #21", "why[2].p", "На сафари и трассах между эмиратами сигнал ощутимо реже."],
  ["china lead #24", "lead", "Китай — единственное направление, где вопрос «сколько гигабайт» уступает вопросу «а что вообще откроется». Местная SIM-карта подключает вас к китайскому интернету со всеми его правилами. Туристический профиль может вести себя иначе: у части китайских тарифов в карточке стоит отметка «IP: Гонконг» или «IP: Сингапур» — трафик таких тарифов выходит в интернет за пределами Китая. Какие приложения окажутся доступны, тариф не гарантирует."],
  ["turkey intro[0] #27", "intro[0]", "Отдельная история — переезды: маршрут Стамбул—Каппадокия или дорога вдоль побережья проходит через участки, где сигнал заметно проседает, и навигация в этот момент нужна больше всего."],
  ["indonesia why[1].p #30", "why[1].p", "Дороги в горы и на север острова — как раз те места, где связь неровная."],
  ["united-kingdom why[2].p #33", "why[2].p", "В высокогорье и Озёрном крае связь пропадает."],
  ["usa why[1].p #37", "why[1].p", "Йосемити, Долина Смерти, каньоны Юты — местами сигнала нет совсем."],
  ["usa faq[1].a #38", "faq[1].a", "В Йосемити, Гранд-Каньоне и Долине Смерти есть большие зоны без покрытия — так устроена сеть, и никакой тариф этого не изменит."],
  ["usa faq[3].a #39", "faq[3].a", "Разница в качестве связи определяется не тарифом, а плотностью вышек: между побережьями и пустынными участками она отличается принципиально."],
  ["spain why[2].p #42", "why[2].p", "Тейде, север Майорки, горные дороги — участки с редким сигналом."],
  ["cyprus lead #50", "lead", "eSIM устанавливается до вылета и включается сразу после посадки в Ларнаке или Пафосе."],
  ["sri-lanka faq: term vs volume", "faq[1].a", "Все местные объёмные тарифы здесь действуют 30 дней, так что срок на две недели не ограничивает — вопрос только в объёме."],
  ["sri-lanka faq question", "faq[4].q", "eSIM заработает сразу по прилёте?"],
  ["korea heading after #16", "why[2].h", "Горы — маршрут офлайн"],
];

test("LOW pass: every A-classified sentence as it shipped is caught", () => {
  const missed = LOW_A.filter(([, field, text]) => checkCoverageClaims(page(field, text)).length === 0).map(([id]) => id);
  assert.deepEqual(missed, []);
  assert.equal(LOW_A.length, 26);
});

test("LOW pass: honest warnings (B) and non-network sentences (D) are not blocked", () => {
  const flagged = LOW_B_AND_D.filter(([, field, text]) => checkCoverageClaims(page(field, text)).length > 0).map(([id, , text]) => `${id}: ${text}`);
  assert.deepEqual(flagged, []);
});

test("a card heading «— исключение» is caught; the same word in prose is not", () => {
  assert.equal(checkCoverageClaims({ why: [{ h: "Горы островов — исключение", p: "x" }] }).length, 1);
  assert.equal(checkCoverageClaims({ why: [{ h: "Пустыня — исключение", p: "x" }] }).length, 1);
  assert.deepEqual(checkCoverageClaims({ intro: ["Исключение — тарифы с дневным лимитом: у них срок считается иначе."] }), []);
});

// Review of the LOW pass: close paraphrases of the A classes are caught, and
// honest copy that merely shares a word with them is not. Each NEG line is a
// sentence an earlier, context-free version of a pattern blocked.
test("LOW pass: paraphrases of the A classes are caught", () => {
  const POS = [
    "Острова используют ту же сеть.", "Тариф работает на Канарах так же, как на материке.",
    "eSIM работает по всей Греции.", "eSIM заработает сразу по прилёте.", "Только в горах связь пропадает.",
    "Лишь на серпантинах сигнал неровный.", "Сложности со связью начинаются только в горах.",
    "В городах обычно есть связь.", "Связь в городах, как правило, есть.", "Покрытие одинаковое во всех эмиратах.",
    "Скорости хватает для переписки.", "Объём важнее, чем качество сети.",
    "Мессенджеры и звонки домой работают из бунгало и с пляжа.",
    "Связь на трансферах есть, и она нужна.", "Связь на островах есть, а нужна она там больше всего.",
  ];
  assert.deepEqual(POS.filter((s) => checkCoverageClaims({ intro: [s] }).length === 0), []);
  const HEADINGS = ["Связь на катерах", "Горы — единственное исключение", "Исключение — горы", "Горы — исключения"];
  assert.deepEqual(HEADINGS.filter((h) => checkCoverageClaims({ why: [{ h, p: "x" }] }).length === 0), []);
});

test("LOW pass: words shared with the A classes do not block honest copy", () => {
  const NEG = [
    "Можно ли поставить eSIM заранее? Обычно да: срок начинается с первого подключения.",
    "В основном да — у большинства тарифов страны есть пополнение.",
    "Звонки через мессенджеры работают с ограничениями, которые вводит регулятор.",
    "Звонки домой работают на той же схеме: номер остаётся на физической SIM.",
    "У балканского тарифа те же сети, что и у местного.",
    "Быстрый интернет нужен для видеозвонков, поэтому объём берите с запасом.",
    "Связь на островах зависит от инфраструктуры атолла — карт покрытия мы не публикуем.",
    "Есть ли связь на островах?",
    "После лимита скорость 512 Кбит/с: для переписки хватает, для видео нет.",
    "Тариф действует по всей стране в рамках покрытия.",
    "Отдельное ограничение в Японии — сам язык.",
    "eSIM для Грузии — Тбилиси, Батуми и горные маршруты", "Интернет в горах нужен для навигации, поэтому карту лучше скачать заранее.",
    "Будет ли интернет на серф-спотах и в горах?",
    "Пополнение работает по всей линейке тарифов.", "Профиль работает по всей длине поездки.",
    "Для переписки хватает 512 Кбит/с, для видео — нет.", "После лимита остаётся 512 Kbps: для переписки хватает.",
    "Для переписки хватает и 1 ГБ.", "Скорости хватает для карт, но не для видео — после лимита 512 Кбит/с.",
  ];
  assert.deepEqual(NEG.filter((s) => checkCoverageClaims({ intro: [s] }).length > 0), []);
  const HEADINGS = ["Безлимит — исключение", "Тарифы на 180 дней — исключение", "Пополнение — исключение", "Трансфер — связь нужнее всего", "Горные участки островов",
    "Северная Америка — исключение", "Парковка — исключение", "Трассировка — исключение", "Горы — не исключение"];
  assert.deepEqual(HEADINGS.filter((h) => checkCoverageClaims({ why: [{ h, p: "x" }] }).length > 0), []);
});
