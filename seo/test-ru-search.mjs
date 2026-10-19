// Conversion stage 2, PR B — the destination search (home and /esim/):
// assets/ru-search.js over the generated assets/ru-destinations.js
// (aliases, regions, popular from seo/destination-aliases.mjs).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { ALIASES, REGIONS } from './destination-aliases.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

// The browser's own files, in the order the pages load them.
const sandbox = { console };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(read('assets/ru-destinations.js'), sandbox);
vm.runInContext(read('assets/ru-search.js'), sandbox);
const S = sandbox.MagicRuSearch;
const LIST = sandbox.MagicRuDestinations;
const BY_ISO = Object.fromEntries(LIST.map((d) => [d.iso, d]));
// Arrays made inside the vm sandbox belong to another realm: compare plain copies.
const plain = (x) => JSON.parse(JSON.stringify(x));
const top = (q) => { const r = S.search(q); return r.hits[0] ? r.hits[0].d.name : null; };

test('the owner\'s examples and the case forms find their country', () => {
  const cases = {
    'Бали': 'Индонезия', 'Анталья': 'Турция', 'анталию': 'Турция', 'Дубай': 'ОАЭ', 'на Пхукет': 'Таиланд',
    'Нячанг': 'Вьетнам', 'хургаду': 'Египет', 'Англия': 'Великобритания', 'Америка': 'США',
    'турцию': 'Турция', 'в Турцию': 'Турция', 'Турции': 'Турция', 'Таиланде': 'Таиланд', 'в Египте': 'Египет',
    'Шри Ланка': 'Шри-Ланка', 'южную корею': 'Южная Корея', 'Мале': 'Мальдивы',
    'Thailand': 'Таиланд', 'germany': 'Германия', 'TR': 'Турция', 'ОАЭ': 'ОАЭ',
  };
  for (const [q, want] of Object.entries(cases)) assert.equal(top(q), want, q);
  assert.equal(S.search('Бали').hits[0].via, 'бали', 'the place typed is shown with its country');
  assert.equal(S.search('корея').hits[0].via, '', 'an alias already in the name gets no label («Южная КореяКорея»)');
});

test('regions, in their case forms, give a list of countries — the seven approved, nothing else', () => {
  assert.deepEqual(plain(sandbox.MagicRuRegions.map((r) => r.label)), ['Европа', 'Азия', 'Балканы', 'Скандинавия', 'Африка', 'Латинская Америка', 'Весь мир']);
  const forms = {
    'Европа': 'Европа', 'в Европу': 'Европа', 'Азии': 'Азия', 'Балканы': 'Балканы', 'Скандинавию': 'Скандинавия',
    'Африке': 'Африка', 'Латинская Америка': 'Латинская Америка', 'южную америку': 'Латинская Америка', 'весь мир': 'Весь мир', 'по миру': 'Весь мир',
  };
  for (const [q, label] of Object.entries(forms)) assert.equal((S.search(q).region || {}).label, label, q);
  for (const r of sandbox.MagicRuRegions) {
    assert.ok(r.countries.length >= 4, `${r.label}: ${r.countries.length} countries`);
    for (const iso of r.countries) assert.ok(BY_ISO[iso], `${r.label}: ${iso} has no page`);
  }
});

test('no false friends: a place is not a region, a stem is not another place', () => {
  assert.equal(S.search('Бали').region, null, '«бали» is not «балканы»');
  assert.ok(!S.search('Дубай').hits.some((h) => h.d.iso === 'HR'), '«дубай» does not find «дубровник»');
  assert.ok(!S.search('корея').hits.some((h) => h.d.iso === 'GR'), '«корея» does not find «корфу»');
  assert.equal(S.search('Америка').region, null, '«Америка» alone is the USA, not Latin America');
  for (const q of ['xyzq', 'в', 'на', '']) { assert.equal(S.search(q).hits.length, 0, q); assert.equal(S.search(q).region, null, q); }
});

test('every alias leads to an existing page and is not another country\'s name', () => {
  const names = new Map(LIST.map((d) => [S.norm(d.name), d.iso]));
  for (const [iso, aliases] of Object.entries(ALIASES)) {
    assert.ok(BY_ISO[iso], `${iso} has no page`);
    assert.ok(existsSync(join(ROOT, 'esim', BY_ISO[iso].slug, 'index.html')), iso);
    for (const a of aliases) {
      assert.equal(a, a.toLowerCase(), a);
      const other = names.get(S.norm(a));
      assert.ok(!other || other === iso, `«${a}» is the name of ${other}`);
    }
  }
  const all = Object.values(ALIASES).flat();
  assert.equal(new Set(all).size, all.length, 'an alias leads to one country');
  // Places whose coverage by the country's plans is unclear stay out (header of destination-aliases.mjs).
  for (const bad of ['тенерифе', 'канары', 'майорка', 'ибица', 'мадейра', 'занзибар', 'гавайи', 'северный кипр']) {
    assert.ok(!all.includes(bad), bad);
  }
  assert.equal(REGIONS.length, 7);
});

test('the popular list is the home\'s popular destinations, each with a page', () => {
  assert.equal(sandbox.MagicRuPopular.length, 8);
  assert.deepEqual(plain(S.popular().map((d) => d.iso)), plain(sandbox.MagicRuPopular));
});

test('search_no_result is allowlisted on the home and /esim/ only — never on a country page', () => {
  assert.match(read('index.html'), /var GOALS=\{search_no_result:\[\],/);
  assert.match(read('esim/index.html'), /var GOALS=\{search_no_result:\[\],/);
  assert.match(read('esim/index.html'), /magicMetrikaGoal\('search_no_result'\)/);
  let pages = 0;
  for (const slug of readdirSync(join(ROOT, 'esim'))) {
    const f = join(ROOT, 'esim', slug, 'index.html');
    if (!existsSync(f) || !/data-country-page=/.test(readFileSync(f, 'utf8'))) continue;
    pages += 1;
    assert.doesNotMatch(readFileSync(f, 'utf8'), /search_no_result/, slug);
  }
  assert.ok(pages >= 190, `country pages checked: ${pages}`);
});
