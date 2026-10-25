// Japan's intro[0] says what the «Сеть» row of the cards shows. It used to
// say «у части 3G/4G, у части 3G/4G/5G» about JAPANESE tariffs — but no card
// covering only Japan prints 3G/4G: that value sits on a few multi-country
// daily packages. The §28 class again — a real value attributed to the wrong
// set of cards. This test recomputes the row the way the browser prints it
// (the real mapper block from assets/country-tariffs.js) over the packages
// the Japan page shows, and checks every part of the sentence against it.
// «Только для Японии» is decided by the coverage codes — what the card prints
// as «Покрытие: Япония» — not by isMultiCountry(), which also reads the name
// and counts «Japan Unlimited N Days» as regional.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogue, coverageCodes, countryFacts, isRussia, isRestricted, isGlobal, isDaily } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BLOCK_RE = /\/\* --- TARIFF DISPLAY MAPPERS[\s\S]*?END TARIFF DISPLAY MAPPERS -+ \*\//;
const { tariffNetworkLabel } = new Function(
  `${readFileSync(join(ROOT, 'assets/country-tariffs.js'), 'utf8').match(BLOCK_RE)[0]}\nreturn { tariffNetworkLabel };`)();

const SENTENCE = 'В строке «Сеть» карточки указаны поддерживаемые поколения: у всех тарифов только для Японии в ней есть 4G, у большинства — ещё и 5G.';

const catalogue = loadCatalogue();
const packages = catalogue.packages || catalogue;
const shown = packages.filter((p) => !isRussia(p) && !isRestricted(p) && Number(p.price) > 0
  && coverageCodes(p).includes('JP') && !isGlobal(p));
const onlyJapan = (p) => { const c = new Set(coverageCodes(p)); return c.size === 1 && c.has('JP'); };
const label = (p) => tariffNetworkLabel(p);
const parts = (p) => label(p).split('/').filter(Boolean);

test('the set checked here is the set the Japan page shows', () => {
  const f = countryFacts(packages, 'JP');
  assert.equal(shown.length, f.local_count + f.regional_count + f.daily_count);
  assert.ok(shown.length > 0);
});

test('Japan intro[0] carries the sentence this test checks — and not the old misattribution', () => {
  const p = JSON.parse(readFileSync(join(ROOT, 'seo/content-profiles/japan.json'), 'utf8'));
  assert.ok(p.intro[0].includes(SENTENCE), 'if the sentence is rewritten, rewrite this test with it');
  const html = readFileSync(join(ROOT, 'esim/japan/index.html'), 'utf8');
  assert.ok(!/у части 3G\/4G, у части 3G\/4G\/5G/.test(JSON.stringify(p) + html));
});

test('«у всех тарифов только для Японии в ней есть 4G» — every Japan-only card prints 4G', () => {
  const jp = shown.filter(onlyJapan);
  assert.ok(jp.length > 0);
  assert.deepEqual(jp.filter((p) => !parts(p).includes('4G')).map((p) => `${p.name}: «${label(p)}»`), []);
});

test('«у большинства — ещё и 5G» — more than half of the Japan-only cards print 5G', () => {
  const jp = shown.filter(onlyJapan);
  const with5g = jp.filter((p) => parts(p).includes('5G')).length;
  assert.ok(with5g * 2 > jp.length, `${with5g} of ${jp.length}`);
});

// 2026-10-25 (590 new plans): the clause «а вариант 3G/4G без 5G встречается только у посуточных пакетов на несколько
// стран в блоке «Трафик на каждый день»» became false in the checker's view (a regional «Asia (12 areas) 1GB 7Days»
// prints 3G/4G) and was removed from intro[0]; its two tests went with it. The sentence now claims only the two
// properties pinned above.
test('the removed clause about 3G/4G stays out of the copy', () => {
  const p = JSON.parse(readFileSync(join(ROOT, 'seo/content-profiles/japan.json'), 'utf8'));
  assert.equal(p.intro[0].includes('3G/4G без 5G'), false);
});
