// The authored prose, checked against the catalogue on every `npm test`.
//
// WHY THIS FILE EXISTS
//
//   The rules that compare an authored page with the catalogue — every ₽ and ГБ
//   figure must exist, «от N ₽» must be a floor, a quoted activation label must
//   be one the cards print — have lived in content-review.mjs since August. That
//   file is a CLI. Nothing ran it: not `npm test`, not CI, not the SEO refresh
//   job. So when the provider moved prices on 2026-09-25 two authored pages went
//   stale on the live site with every gate green:
//
//     israel       «1650 ₽ против 2500 ₽» — Israel 10GB 30Days is 1400 ₽ since
//                  catalogue commit 1ae0ba0. `node seo/content-review.mjs israel`
//                  reported it; nobody was asked to run it.
//     south-korea  «в карточке указано, что срок идёт с первого подключения к
//                  сети» about the «Китай, Корея, Япония» package. All three of
//                  its packages print «с первого использования интернета» now.
//                  No rule caught this one at all: the activation check asked
//                  whether ANY Korean card prints the phrase, and some still do.
//
//   The fix is two things. The existing checks are wired here, so the refresh
//   job — which runs `npm test` after rebuilding — stops before it can open a
//   pull request over prose the new catalogue contradicts. And a claim about a
//   NAMED package family is checked against that family, not the country.
//
// ONLY THE LAST TEST READS THE LIVE CATALOGUE. Every fixture runs against the
// fixed sheet and family map below. The first version pinned them to live
// values, and a replay over 30 real catalogue snapshots showed them red on
// every one before 2026-09-25: the next price move would have failed the
// refresh job with no stale prose anywhere and held back every page. A test of
// the RULE must not depend on today's prices; only the test of the CORPUS may.
//
//   What is deliberately NOT checked: bare numbers. «2 недели», «за 5 минут»,
//   «24/7», «поездка на 14 дней» are not catalogue facts, and a checker that
//   fires on them gets switched off. The negative cases below pin that.

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  catalogueProblems, checkFacts, checkNamedFamilies, FAMILY_TITLES, familyKey,
} from './content-review.mjs';
import { loadCatalogue } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_DIR = join(ROOT, 'seo/content-profiles');
const faqProfile = (a) => ({ faq: [{ q: 'Вопрос?', a }] });

// A country as the fact sheet describes one — fixed, so no price move reaches it.
const SHEET = {
  iso: 'KR', local_count: 7, regional_count: 3, total_count: 10,
  min_price_rub: 400, max_price_rub: 2500, validity_days_min: 30, validity_days_max: 30,
  volumes_gb: [3, 10, 20], daily_gb: [], term_days: [], regional_reach_max: 3,
  offers: [{ data_gb: 10, price_rub: 1400, validity_days: 30, kind: 'local' }],
  all_purchasable_prices: [400, 1400, 2500],
  min_volume_price_rub: 400, min_daily_price_rub: null,
  speeds: ['3G/4G'], networks: ['Op'], fup_policies: [],
  activation_policies: ['installation', 'unknown'],
  activation_labels: ['после установки eSIM', 'с первого подключения к сети'],
  topup_yes: 2, topup_no: 0, daily_reset_confirmed: false, daily_throttle_continues: false,
};
const FAMILIES = new Map([
  ['Китай, Корея и Япония', new Map([['KR', new Set(['с первого использования интернета'])]])],
]);
const SHEETS = { fixture: SHEET };

// The two sentences as they stood on the live site on 2026-09-26.
const ISRAEL_STALE = 'Шаг с 10 на 20 ГБ здесь стоит дешевле, чем ожидаешь: 1650 ₽ против 2500 ₽ при одинаковом сроке в 30 дней.';
const KOREA_STALE = 'Тот же пакет «Китай, Корея, Япония» закрывает маршрут одним профилем — и у него есть деталь, важная именно перед вылетом: в карточке указано, что срок идёт с первого подключения к сети, а не с установки.';

test('israel shape: a price the catalogue no longer sells is refused, the current one passes', () => {
  const problems = checkFacts(faqProfile(ISRAEL_STALE), SHEET);
  assert.ok(problems.some((p) => p.includes('1650')), `1650 ₽ обязан ловиться:\n${problems.join('\n')}`);
  assert.deepEqual(checkFacts(faqProfile(ISRAEL_STALE.replace('1650', '1400')), SHEET), []);
});

test('korea shape: an activation label quoted for a named family is checked against THAT family', () => {
  // The country-level rule is blind here by design: some Korean card does
  // print «с первого подключения к сети». This is the gap the family rule fills.
  const problems = checkNamedFamilies(faqProfile(KOREA_STALE), 'KR', FAMILIES);
  assert.ok(problems.some((p) => p.includes('Китай, Корея и Япония')), `старая надпись обязана ловиться:\n${problems.join('\n')}`);
  const fixed = KOREA_STALE.replace('с первого подключения к сети', 'с первого использования интернета');
  assert.deepEqual(checkNamedFamilies(faqProfile(fixed), 'KR', FAMILIES), []);
});

test('the family rule reads the title with or without «и», with a volume, at a sentence start', () => {
  for (const q of ['Китай, Корея и Япония', 'Китай, Корея, Япония', 'Китай, Корея и Япония 12 GB']) {
    const t = `Пакет «${q}» — в карточке срок идёт с первого подключения к сети.`;
    assert.ok(checkNamedFamilies(faqProfile(t), 'KR', FAMILIES).length, `не распознано: «${q}»`);
  }
  const capital = 'Про «Китай, Корея и Япония» в карточке одно: С первого подключения к сети.';
  assert.ok(checkNamedFamilies(faqProfile(capital), 'KR', FAMILIES).length, 'заглавная буква не должна прятать утверждение');
});

test('the family rule stays quiet where it has nothing to check', () => {
  const quiet = (t, iso = 'KR') => assert.deepEqual(checkNamedFamilies(faqProfile(t), iso, FAMILIES), [], t);
  // A country-level claim is checkAttribution's business, not this rule's.
  quiet('У большинства тарифов срок идёт с первого подключения к сети.');
  // A quote that names no family: a card label, a heading.
  quiet('Блок называется «Трафик на каждый день»; срок идёт с первого подключения к сети.');
  // A family that does not cover this country is not this page's claim.
  quiet(KOREA_STALE, 'TR');
  // A contrast between the family and other packages is two claims, not one.
  quiet('У пакета «Китай, Корея и Япония» срок идёт с первого использования интернета, а у местных корейских — после установки eSIM.');
});

test('bare numbers are never catalogue facts', () => {
  const text = 'Поездка на 14 дней, установка за 5 минут, поддержка 24/7, 2 недели на море и 3 города по пути.';
  assert.deepEqual(checkFacts(faqProfile(text), SHEET), []);
});

test('every catalogue rule is wired into catalogueProblems', () => {
  // Each sentence breaks exactly one rule against the fixed sheet. Removing any
  // rule from catalogueProblems, or making it return [], turns this red — the
  // corpus test below cannot, because a green corpus looks the same either way.
  const cases = {
    facts: 'Десять гигабайт стоят 1650 ₽.',
    floor: 'Тарифы от 1400 ₽.',
    daily: 'Лимит обновляется каждые сутки.',
    speed: 'Сеть 5G есть везде.',
    family: KOREA_STALE,
    safety: 'Профиль лучше установить дома заранее.',
    topup: 'Пополнить объём нельзя.',
    networks: 'Здесь работают три сети.',
  };
  for (const [rule, text] of Object.entries(cases)) {
    const got = catalogueProblems(faqProfile(text), 'fixture', { sheetsBySlug: SHEETS, families: FAMILIES });
    assert.ok(got.length, `правило «${rule}» не подключено: «${text}» прошло без замечаний`);
  }
  assert.deepEqual(catalogueProblems(faqProfile('Обычный текст без фактов о тарифах.'), 'fixture', { sheetsBySlug: SHEETS, families: FAMILIES }), []);
});

test('FAMILY_TITLES is a faithful port of the card title — checked by running the card code', () => {
  // Extract publicPackageName and formatDataLabel from the browser script and
  // run them on every package in the catalogue. A renamed title, a changed
  // match rule or a reordered branch in either file shows up as a package that
  // the card and the gate put in different families.
  const src = readFileSync(join(ROOT, 'assets/country-tariffs.js'), 'utf8');
  const fn = (name) => {
    const start = src.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} не найдена в country-tariffs.js`);
    let depth = 0;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
    }
    throw new Error(`${name}: скобки не сошлись`);
  };
  const ctx = {
    packageCoverageCodes: (p) => (Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : [p.country_code]),
    hasCountryName: () => false,
    countryName: (c) => c,
  };
  vm.createContext(ctx);
  vm.runInContext(`${fn('formatDataLabel')}\n${fn('publicPackageName')}\nthis.publicPackageName = publicPackageName;`, ctx);

  // The extraction itself, on a fixed package — so a broken extraction cannot
  // hide behind whatever the live catalogue happens to hold today.
  assert.equal(ctx.publicPackageName({ name: 'China Korea Japan 12 GB', data_gb: 12 }), 'Китай, Корея и Япония 12 GB');

  const loaded = loadCatalogue();
  const packages = Array.isArray(loaded) ? loaded : loaded.packages;
  const keys = new Set(FAMILY_TITLES.map((f) => familyKey(f.title)));
  const diverged = [];
  let inFamily = 0;
  for (const p of packages) {
    const card = ctx.publicPackageName(p);
    const fam = FAMILY_TITLES.find((f) => f.match(String(p.name || '').toLowerCase()));
    if (fam) inFamily++;
    const cardKey = familyKey(card);
    if (fam ? cardKey !== familyKey(fam.title) : keys.has(cardKey)) {
      diverged.push(`${p.name}: карточка «${card}», гейт «${fam ? fam.title : '—'}»`);
    }
  }
  assert.ok(inFamily > 0, 'ни один пакет каталога не попал в семью — сопоставление перестало срабатывать?');
  assert.deepEqual(diverged.slice(0, 10), []);
});

test('every authored page agrees with the current catalogue', () => {
  const slugs = readdirSync(PROFILE_DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  const failures = [];
  let checked = 0;
  for (const slug of slugs) {
    const profile = JSON.parse(readFileSync(join(PROFILE_DIR, `${slug}.json`), 'utf8'));
    if (profile.status !== 'published') continue;
    checked++;
    const problems = catalogueProblems(profile, slug);
    if (problems.length) failures.push(`${slug}:\n    ${problems.join('\n    ')}`);
  }
  assert.ok(checked >= 46, `проверено ${checked} профилей — фильтр не должен пропускать корпус`);
  assert.deepEqual(failures, [], `авторский текст расходится с каталогом:\n${failures.join('\n')}`);
});
