// Operator names are checked against the BLOCK their sentence is about.
//
// The gap (found fact-checking catalogue PR #188, 2026-10-28): the only operator
// fact was one set merged over every package of a country, and no rule compared
// a name with it at all. Catalogue b493e787 moved all ten local Chilean packages
// from WOM to movistar / CLARO CL; WOM survived only on a multi-country daily
// plan — and «местные тарифы Чили — на сети WOM» would have stayed green.
//
// The first tests run against the REAL snapshot on exactly that case (and the
// Curaçao Digicel → Chippie one). The rule tests after them use small synthetic
// layouts, so a provider move cannot turn them red; the corpus tests at the end
// read every authored text source the site has.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkNetworkClaims, operatorLexicon, operatorMentions, networksByBlock, blockRows, bareMentions, loadCatalogDoc,
} from './network-claims.mjs';
import { catalogueProblems } from './content-review.mjs';
import { sentencesOf } from './coverage-claims.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOC = loadCatalogDoc();
const LEX = operatorLexicon(DOC.packages);
const run = (profile, slug, doc = DOC) => checkNetworkClaims(profile, slug, { doc });
const one = (text, claims, extra = {}) => ({ faq: [{ q: 'Вопрос?', a: text }], ...(claims ? { network_claims: claims } : {}), ...extra });
const claim = (text, block, operators, more = {}) => ({ id: 'c', anchors: [{ field: 'faq[0].a', text }], block, operators, ...more });

// ------------------------------------------------------------ the real cases

const CHILE_LOCAL_WOM = 'По данным каталога местные тарифы Чили — на сети WOM.';

test('FIRST: a Chile sentence putting WOM on the LOCAL plans fails on the real snapshot', () => {
  // Precondition, so this test cannot pass for a reason it does not name: in the
  // snapshot WOM is listed on Chile's page, but not by a local plan.
  const nb = networksByBlock(DOC, 'CL');
  assert.ok(nb, 'в снимке нет раскладки для CL');
  assert.ok(!nb.local.includes('WOM'), `предпосылка: у местных тарифов CL WOM быть не должно (${nb.local.join(', ')})`);
  assert.ok(Object.values(nb).some((l) => l.includes('WOM')), 'предпосылка: WOM указан в каком-то блоке страницы CL');

  const p = run(one(CHILE_LOCAL_WOM, [claim(CHILE_LOCAL_WOM, 'local', ['WOM'])]), 'chile');
  assert.ok(p.some((x) => /«WOM» не указан ни у одного тарифа в блок местных тарифов/.test(x)), p.join('\n'));
  // …and the message names where WOM actually is.
  assert.ok(p.some((x) => /он есть только в: блок «Трафик на каждый день»/.test(x)), p.join('\n'));
});

test('the same sentence with no block at all fails too — it is never guessed', () => {
  const p = run(one(CHILE_LOCAL_WOM), 'chile');
  assert.ok(p.some((x) => /«WOM» в faq\[0\]\.a без network_claims/.test(x)), p.join('\n'));
});

test('the same sentence attributed to the REGIONAL block passes when that block lists WOM', () => {
  // Synthetic: in today's snapshot Chile's regional plans list no operator at
  // all (WOM is on a multi-country DAILY plan) — the next test pins that.
  const doc = {
    packages: [
      { package_id: 'l1', name: 'Chile 3GB', networks: [{ operator: 'movistar' }, { operator: 'CLARO CL' }] },
      { package_id: 'r1', name: 'South America 5GB', networks: [{ operator: 'WOM' }, { operator: 'Personal' }] },
    ],
    assortment: { countries: { CL: { local: ['l1'], regional: ['r1'], daily: [] } } },
  };
  const t = 'WOM указан у региональных тарифов, покрывающих Чили.';
  assert.deepEqual(run(one(t, [claim(t, 'regional', ['WOM'])]), 'chile', doc), []);
  assert.ok(run(one(t, [claim(t, 'local', ['WOM'])]), 'chile', doc).length, 'тот же WOM в local должен падать');
});

test('real snapshot: WOM in Chile is a DAILY-block fact, not a regional one', () => {
  const t = 'WOM указан у многостранового пакета в блоке «Трафик на каждый день».';
  assert.deepEqual(run(one(t, [claim(t, 'daily', ['WOM'])]), 'chile'), []);
  const p = run(one(t, [claim(t, 'regional', ['WOM'])]), 'chile');
  assert.ok(p.length, 'в снимке региональные тарифы Чили WOM не указывают');
});

test('movistar and CLARO CL for the Chilean local plans pass', () => {
  const t = 'По данным каталога местные тарифы Чили — на сетях movistar и CLARO CL.';
  assert.deepEqual(run(one(t, [claim(t, 'local', ['movistar', 'CLARO CL'], { every: true, only: true })]), 'chile'), []);
});

test('Curaçao: «Digicel» fails in every block (none lists it), «Chippie» passes', () => {
  const nb = networksByBlock(DOC, 'CW');
  assert.ok(nb && !Object.values(nb).some((l) => l.includes('Digicel')), 'предпосылка: Digicel на странице CW не указан');
  const bad = 'По данным каталога местные тарифы Кюрасао — на сети Digicel.';
  for (const block of ['local', 'regional', 'daily']) {
    const p = run(one(bad, [claim(bad, block, ['Digicel'])]), 'curacao');
    assert.ok(p.some((x) => /«Digicel» не указан ни у одного тарифа.*ни в одном блоке страницы/.test(x)), `${block}: ${p.join('\n')}`);
  }
  assert.ok(run(one(bad), 'curacao').length, 'без network_claims Digicel тоже должен падать');
  const good = 'По данным каталога местные тарифы Кюрасао — на сети Chippie.';
  assert.deepEqual(run(one(good, [claim(good, 'local', ['Chippie'], { every: true, only: true })]), 'curacao'), []);
});

test('a name the catalogue no longer lists anywhere is still detected (EXTRA_OPERATORS)', () => {
  const empty = operatorLexicon([]);
  assert.deepEqual(operatorMentions('Местные тарифы — на сети Digicel.', empty), ['Digicel']);
  assert.deepEqual(operatorMentions('Местные тарифы — на сети Билайн.', empty), ['Билайн']);
});

// ------------------------------------------------------------ the rule

const SYN = {
  packages: [
    { package_id: 'a', name: 'X 1GB', networks: [{ operator: 'Alpha' }, { operator: 'Beta' }] },
    { package_id: 'b', name: 'X 3GB', networks: [{ operator: 'Alpha' }] },
    { package_id: 'c', name: 'X 10GB', networks: [] },
    { package_id: 'r', name: 'Region 5GB', networks: [{ operator: 'Gamma' }, { operator: 'Alpha' }] },
    { package_id: 'd', name: 'X 1GB/Day', networks: [{ operator: 'Alpha' }] },
  ],
  assortment: { countries: { CL: { local: ['a', 'b', 'c'], regional: ['r'], daily: ['d'] } } },
};
const SYN_LEX = operatorLexicon(SYN.packages);
const syn = (profile) => checkNetworkClaims(profile, 'chile', { doc: SYN, lexicon: SYN_LEX });

test('every / only / all_listed / packages / exclusive each fire on their own case', () => {
  const t = 'Местные тарифы — на сети Alpha.';
  assert.deepEqual(syn(one(t, [claim(t, 'local', ['Alpha'])])), []);
  assert.deepEqual(syn(one(t, [claim(t, 'local', ['Alpha'], { every: true })])), [], 'c без сети every не нарушает');
  assert.ok(syn(one(t, [claim(t, 'local', ['Alpha'], { only: true })])).some((x) => /only — у a .* Beta/.test(x)));
  assert.ok(syn(one(t, [claim(t, 'local', ['Alpha'], { all_listed: true })])).some((x) => /all_listed — у c/.test(x)));
  assert.ok(syn(one(t, [claim(t, 'local', ['Alpha'], { exclusive: true })])).some((x) => /exclusive — «Alpha» указан и в/.test(x)));
  const tb = 'У пакета на 1 ГБ — Alpha и Beta.';
  assert.deepEqual(syn(one(tb, [claim(tb, 'local', ['Alpha', 'Beta'], { packages: ['a'], every: true, only: true })])), []);
  assert.ok(syn(one(tb, [claim(tb, 'local', ['Alpha', 'Beta'], { packages: ['b'] })])).some((x) => /у продукта b .* «Beta» не указан/.test(x)));
  assert.ok(syn(one(tb, [claim(tb, 'local', ['Alpha', 'Beta'], { packages: ['r'] })])).some((x) => /продукт r не стоит в блок местных тарифов.*regional/.test(x)));
  const tg = 'Gamma указан только у региональных тарифов.';
  assert.deepEqual(syn(one(tg, [claim(tg, 'regional', ['Gamma'], { exclusive: true })])), []);
});

test('a sentence about two blocks needs a claim for each name', () => {
  const t = 'У местных — Beta, у региональных — Gamma.';
  assert.ok(syn(one(t, [claim(t, 'local', ['Beta'])])).some((x) => /«Gamma» в faq\[0\]\.a без network_claims/.test(x)));
  assert.deepEqual(syn(one(t, [claim(t, 'local', ['Beta']), { ...claim(t, 'regional', ['Gamma']), id: 'c2' }])), []);
});

test('a claim must be about its own sentence: whole sentence, and the operator in it', () => {
  const t = 'Местные тарифы — на сети Alpha. Второе предложение.';
  assert.ok(syn(one(t, [claim('Местные тарифы — на сети', 'local', ['Alpha'])])).some((x) => /не целое предложение/.test(x)));
  const s = 'Местные тарифы — на сети Alpha.';
  assert.ok(syn(one(t, [claim(s, 'local', ['Alpha', 'Beta'])])).some((x) => /оператора «Beta» нет в цитате/.test(x)));
  assert.ok(syn(one(t, [claim(s, 'global', ['Alpha'])])).some((x) => /block «global»/.test(x)));
});

test('no layout for the country → every operator claim fails, never passes', () => {
  const t = 'Местные тарифы — на сети Alpha.';
  const p = checkNetworkClaims(one(t, [claim(t, 'local', ['Alpha'])]), 'chile', { doc: { packages: SYN.packages, assortment: { countries: {} } }, lexicon: SYN_LEX });
  assert.ok(p.some((x) => /нет раскладки/.test(x)), p.join('\n'));
});

test('a waiver needs a reason and a source the profile lists, and expires with the name', () => {
  const t = 'По данным регулятора, сети 5G развернули операторы Alpha и Beta.';
  const src = 'https://regulator.example/5g';
  const w = { field: 'faq[0].a', text: t, reason: 'факт регулятора о сетях страны, не о тарифах', source: src };
  assert.deepEqual(syn(one(t, null, { network_claims_waived: [w], sources: [`${src} — 5G; проверено 2026-10-29`] })), []);
  assert.ok(syn(one(t, null, { network_claims_waived: [w], sources: [] })).some((x) => /не указан в sources/.test(x)));
  assert.ok(syn(one(t, null, { network_claims_waived: [{ ...w, reason: 'так надо' }], sources: [src] })).some((x) => /reason/.test(x)));
  const plain = 'Сети 5G в стране есть.';
  assert.ok(syn(one(plain, null, { network_claims_waived: [{ ...w, text: plain }], sources: [src] })).some((x) => /исключение устарело/.test(x)));
});

test('ordinary words that are also operator names count only beside a network word', () => {
  // «Brunei Plus» (a package family), «Free Wi-Fi», «One UI»: no network word, no operator.
  assert.deepEqual(operatorMentions('Пакеты «Brunei Plus» покрывают три страны.', LEX), []);
  assert.deepEqual(operatorMentions('Athens airport has free Wi-Fi in the terminal, ATH Free Wifi.', LEX), []);
  assert.deepEqual(operatorMentions('Is there free Wi-Fi at the airport? Yes.', LEX), []);
  // Beside one, they do.
  assert.deepEqual(operatorMentions('Частоты распределены между операторами Salt и Swisscom.', LEX).sort(), ['Salt', 'Swisscom']);
  assert.deepEqual(operatorMentions('у локальных тарифов это сеть Du', LEX), ['Du']);
  // «3» is never a name («3 ГБ на сети …»).
  assert.ok(!operatorMentions('3 ГБ на сети Metfone.', LEX).includes('3'));
  // Case: the catalogue spells it «movistar» and «Movistar»; both are one name.
  assert.deepEqual(operatorMentions('на сети MOVISTAR', LEX), ['MOVISTAR']);
});

test('the rule is wired into catalogueProblems (what npm test and the refresh job run)', () => {
  const p = catalogueProblems(one(CHILE_LOCAL_WOM), 'chile');
  assert.ok(p.some((x) => /«WOM».*без network_claims/.test(x)), p.join('\n'));
});

// ------------------------------------------------------------ the fact sheet

test('the fact sheet keeps operators per block, the same ones the gate reads', () => {
  const { sheets } = JSON.parse(readFileSync(join(ROOT, 'seo/fact-sheets.json'), 'utf8'));
  let n = 0;
  for (const [slug, s] of Object.entries(sheets)) {
    assert.ok('networks_by_block' in s, `${slug}: нет networks_by_block — пересоберите node seo/fact-sheet.mjs`);
    assert.deepEqual(s.networks_by_block, networksByBlock(DOC, s.iso), `${slug}: networks_by_block расходится со снимком`);
    n++;
  }
  assert.ok(n >= 190, `проверено ${n} фактшитов`);
  // The case the union could not tell apart.
  assert.ok(sheets.chile.networks.includes('WOM') && !sheets.chile.networks_by_block.local.includes('WOM'));
  // A stale sheet is refused by the gate itself.
  const stale = { ...sheets.chile, networks_by_block: { ...sheets.chile.networks_by_block, local: ['WOM'] } };
  assert.ok(catalogueProblems({}, 'chile', { sheetsBySlug: { chile: stale } }).some((x) => /networks_by_block не совпадает/.test(x)));
});

test('blockRows reads the layout, not a new definition of the blocks', () => {
  const rows = blockRows(DOC, 'CL');
  const L = DOC.assortment.countries.CL;
  for (const b of ['local', 'regional', 'daily']) assert.deepEqual(rows[b].map((r) => r.id), L[b]);
});

// ------------------------------------------------------------ the corpus

test('every RU profile: each operator name is anchored to its block and true of it', () => {
  const dir = join(ROOT, 'seo/content-profiles');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const failures = [];
  let named = 0;
  for (const f of files) {
    const profile = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const p = run(profile, f.slice(0, -5));
    if (p.length) failures.push(`${f}:\n    ${p.join('\n    ')}`);
    if ((profile.network_claims || []).length || (profile.network_claims_waived || []).length) named++;
  }
  assert.ok(files.length >= 66, `проверено ${files.length} профилей`);
  assert.ok(named >= 8, `профилей с операторами ${named} — детектор перестал их видеть?`);
  assert.deepEqual(failures, [], failures.join('\n'));
});

const visible = (html) => html
  .replace(/<script(?![^>]*ld\+json)[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ');

test('the six legacy pages and the EN/ES authored content name no operator (no claim format there)', () => {
  const found = [];
  for (const slug of ['malaysia', 'maldives', 'mexico', 'brazil', 'greece', 'cyprus']) {
    for (const m of bareMentions([visible(readFileSync(join(ROOT, `esim/${slug}/index.html`), 'utf8'))], LEX)) found.push(`legacy ${slug}: ${m.name} — «${m.sentence.slice(0, 120)}»`);
  }
  const strings = (v, out = []) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['sources', 'plan_claims'].includes(k)) strings(x, out);
    return out;
  };
  let n = 0;
  for (const d of ['seo/content-en', 'seo/content-es']) {
    for (const f of readdirSync(join(ROOT, d)).filter((x) => x.endsWith('.json'))) {
      n++;
      for (const m of bareMentions(strings(JSON.parse(readFileSync(join(ROOT, d, f), 'utf8'))), LEX)) found.push(`${d}/${f}: ${m.name} — «${m.sentence.slice(0, 120)}»`);
    }
  }
  assert.ok(n >= 31, `проверено ${n} файлов EN/ES`);
  assert.deepEqual(found, [], `оператор в тексте без формата утверждений — уберите имя или заведите формат:\n${found.join('\n')}`);
});

test('the corpus negative control: the old UAE sentence fails on the current snapshot', () => {
  const old = 'Там, где поставщик вообще указывает сеть, у локальных тарифов ОАЭ это Du, а у тарифа на 1 ГБ на 7 дней — Etisalat; Etisalat указан и у части многострановых пакетов.';
  assert.equal(sentencesOf(old).length, 1);
  const p = run(one(old, [claim(old, 'local', ['Du', 'Etisalat'])]), 'uae');
  assert.ok(p.some((x) => /«Etisalat» не указан ни у одного тарифа в блок местных тарифов/.test(x)), p.join('\n'));
});
