// «от N ₽» must be a FLOOR, and the sheet must know every price a customer can pay.
//
// WHY
//
//   Two defects, found on 2026-09-01 while writing WAVE 2 and fixed together
//   because neither is safe without the other.
//
//   1. The fact sheet kept ONE price per volume — the cheapest — which is right
//      for "what does 5 ГБ cost here". But a DAILY plan has data_gb = 0, so every
//      daily in a country collapsed into that single bucket. Of 1345 active daily
//      packages the sheet could vouch for exactly one price per country, and any
//      page comparing two daily plans had every figure but one reported as
//      «факт вне каталога» — the most natural page to write about a country whose
//      grid is mostly daily was the one the checker made impossible.
//
//   2. This file's own header had claimed since it was written that «a page that
//      says "от 350 ₽" when the catalogue says 400 is worse than a page that says
//      nothing». The implementation never did that. It checked MEMBERSHIP in a
//      set, so any real price passed after «от», including the most expensive one
//      in the country. Widening (1) without adding (2) really would have been a
//      loosening; together they are a net-stronger gate.
//
//   And the first attempt at (2) was written /\bот\s+…/ — which matched NOTHING,
//   because JavaScript's \b is ASCII-only and there is no word boundary between a
//   space and a Cyrillic «о». It passed 25 profiles by never firing. A rule that
//   cannot fail is not a rule, so the first test here is that it fails.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalogue, countryFacts, purchasablePrice, isDaily } from './catalogue-facts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHEETS = JSON.parse(readFileSync(join(ROOT, 'seo/fact-sheets.json'), 'utf8')).sheets;
const PK = loadCatalogue();

// The rule, mirrored. Kept here rather than imported so that a change to the
// reviewer that quietly drops the rule fails this file instead of passing it.
const OT = /(?:^|[\s(«,—-])от\s+(\d[\d\s ]*)\s*(?:₽|руб\w*)/gi;
const floors = (s) => [s.min_price_rub, s.min_volume_price_rub, s.min_daily_price_rub].filter((n) => Number.isFinite(n));

test('«от N ₽» matches at all — the ASCII \\b bug would make this rule silent', () => {
  const hits = [...'Тарифы от 450 ₽ и дневные — от 350 ₽.'.matchAll(OT)].map((m) => Number(m[1]));
  assert.deepEqual(hits, [450, 350], 'правило обязано находить оба «от», иначе оно не работает вовсе');
  assert.equal([...'дорогой вариант — 1000 ₽'.matchAll(OT)].length, 0, 'без «от» правило молчит');
});

test('every profile\'s «от N ₽» is a floor of the country, its volumes or its dailies', () => {
  const dir = join(ROOT, 'seo/content-profiles');
  const flat = (o) => typeof o === 'string' ? [o]
    : Array.isArray(o) ? o.flatMap(flat)
    : o && typeof o === 'object' ? Object.values(o).flatMap(flat) : [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const slug = f.replace(/\.json$/, '');
    const sheet = SHEETS[slug];
    if (!sheet) continue;
    const ok = floors(sheet);
    for (const text of flat(JSON.parse(readFileSync(join(dir, f), 'utf8')))) {
      for (const m of text.matchAll(OT)) {
        const v = Number(String(m[1]).replace(/[\s\u00A0]/g, ''));
        assert.ok(ok.includes(v),
          `${slug}: «${m[0].trim()}» — не пол (страна ${sheet.min_price_rub}, объёмные ${sheet.min_volume_price_rub}, посуточные ${sheet.min_daily_price_rub})`);
      }
    }
  }
});

test('the sheet knows every purchasable price, ladder rungs included', () => {
  for (const [slug, sheet] of Object.entries(SHEETS)) {
    const set = new Set(sheet.all_purchasable_prices);
    assert.ok(set.size >= sheet.offers.length, `${slug}: цен меньше, чем предложений`);
    assert.ok(set.has(sheet.min_price_rub), `${slug}: минимум страны не входит в множество покупаемых цен`);
    for (const o of sheet.offers) {
      assert.ok(set.has(o.price_rub), `${slug}: цена предложения ${o.price_rub} ₽ не входит в множество покупаемых`);
    }
  }
});

test('a daily ladder rung is blessed — the whole point of the widening', () => {
  const sheet = SHEETS['montenegro'];
  const balkans = PK.find((p) => /Balkans/.test(String(p.name || '')) && /500MB\/Day/.test(String(p.name || '')));
  assert.ok(balkans, 'ожидался балканский посуточный пакет');
  const rung = Math.min(...balkans.term_prices.map((t) => Number(t.price)));
  assert.ok(sheet.all_purchasable_prices.includes(rung),
    `ступень ${rung} ₽ обязана быть в фактшите Черногории`);
  assert.ok(!sheet.offers.some((o) => o.price_rub === rung),
    'и её заведомо нет в offers — иначе тест ничего не доказывает');
});

test('every price in the sheet is one a customer can actually pay', () => {
  for (const [slug, sheet] of Object.entries(SHEETS)) {
    const real = new Set();
    for (const p of PK) {
      if (countryFacts([p], sheet.iso).total_shown !== 1) continue;
      const terms = Array.isArray(p.term_prices) ? p.term_prices : [];
      if (terms.length) terms.forEach((t) => real.add(Number(t.price)));
      else real.add(purchasablePrice(p));
    }
    for (const v of sheet.all_purchasable_prices) {
      assert.ok(real.has(v), `${slug}: ${v} ₽ нет ни в одном покупаемом тарифе`);
    }
  }
});

test('the three floors are the real floors', () => {
  for (const [slug, sheet] of Object.entries(SHEETS)) {
    const vol = [], day = [];
    for (const p of PK) {
      if (countryFacts([p], sheet.iso).total_shown !== 1) continue;
      const terms = Array.isArray(p.term_prices) ? p.term_prices : [];
      const vs = terms.length ? terms.map((t) => Number(t.price)) : [purchasablePrice(p)];
      (isDaily(p) ? day : vol).push(...vs.filter((n) => Number.isFinite(n) && n > 0));
    }
    if (vol.length) assert.equal(sheet.min_volume_price_rub, Math.min(...vol), `${slug}: пол объёмных`);
    if (day.length) assert.equal(sheet.min_daily_price_rub, Math.min(...day), `${slug}: пол посуточных`);
    assert.equal(sheet.min_price_rub, Math.min(...floors(sheet)), `${slug}: пол страны — минимальный из трёх`);
  }
});

// ── What a page may SAY about a daily plan ────────────────────────────────
//
//   The provider publishes a speed for after the daily limit and nothing else.
//   Whether the allowance resets, and whether traffic keeps flowing at that
//   speed, are separate flags — true for 22 and 31 of 1329 daily packages.
//   assets/daily-plan-copy.js is built around refusing to complete that
//   sentence on a product card, and a test enforces it there. The editorial
//   prose had no such rule, and on 2026-09-01 four WAVE 2 drafts asserted a
//   nightly reset for countries where not one package confirms it. I wrote all
//   four myself, twice over — plausible, universally "known", and unverifiable.

const RESET_CLAIMS = /сгора[\wа-яёА-ЯЁ]*|обновля[\wа-яёА-ЯЁ]*\s+кажд|не\s+накаплива[\wа-яёА-ЯЁ]*|переносит[\wа-яёА-ЯЁ]*\s+на\s+(?:завтра|следующ)|кажд[\wа-яёА-ЯЁ]*\s+утр[\wа-яёА-ЯЁ]*\s+(?:выда|дад|появ)|в\s+полночь|до\s+полуночи/gi;
const CONTINUE_CLAIMS = /продолжа[\wа-яёА-ЯЁ]*\s+работать\s+на\s+(?:сниженн|урезанн|пониженн)|не\s+выключа[\wа-яёА-ЯЁ]*\s*,?\s*(?:а|и)\s+продолжа|интернет\s+продолжа[\wа-яёА-ЯЁ]*/gi;
const PROSE_KEYS = ['title', 'description', 'h1', 'lead', 'intro', 'why', 'faq'];

test('no profile claims a daily reset the catalogue does not confirm', () => {
  const dir = join(ROOT, 'seo/content-profiles');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const slug = f.replace(/\.json$/, '');
    const sheet = SHEETS[slug];
    if (!sheet) continue;
    const profile = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    const prose = JSON.stringify(PROSE_KEYS.map((k) => profile[k]));
    if (!sheet.daily_reset_confirmed) {
      const hit = [...prose.matchAll(RESET_CLAIMS)].map((m) => m[0]);
      assert.deepEqual(hit, [], `${slug}: утверждает суточный сброс, каталог его не подтверждает`);
    }
    if (!sheet.daily_throttle_continues) {
      const hit = [...prose.matchAll(CONTINUE_CLAIMS)].map((m) => m[0]);
      assert.deepEqual(hit, [], `${slug}: утверждает, что трафик продолжается после лимита`);
    }
  }
});

test('the reset flag means ALL daily plans, not merely one', () => {
  // It used to mean `some`, and that let Oman's page say «лимит обновляется
  // каждые сутки» about six PER_DAY packages on the strength of four FIXED_TERM
  // ones. A blanket claim needs blanket evidence.
  for (const [slug, sheet] of Object.entries(SHEETS)) {
    const dailies = PK.filter((p) => countryFacts([p], sheet.iso).total_shown === 1 && isDaily(p));
    const every = dailies.length > 0 && dailies.every((p) => p.daily_reset_confirmed === true);
    const partial = dailies.some((p) => p.daily_reset_confirmed === true) && !every;
    assert.equal(sheet.daily_reset_confirmed, every, `${slug}: флаг сброса разошёлся с каталогом`);
    assert.equal(sheet.daily_reset_partial, partial, `${slug}: флаг частичного подтверждения разошёлся`);
  }
});

test('no country confirms a nightly reset for every daily plan — so no page may claim one', () => {
  // Six countries confirm it for SOME of their dailies (Oman among them); none
  // for all. If that ever changes the assertion below is the place to notice.
  const all = Object.entries(SHEETS).filter(([, s]) => s.daily_reset_confirmed).map(([k]) => k);
  const partial = Object.entries(SHEETS).filter(([, s]) => s.daily_reset_partial).map(([k]) => k);
  assert.deepEqual(all, [], `появились страны с полным подтверждением сброса: ${all.join(', ')}`);
  assert.ok(partial.length > 0, 'ожидались страны с частичным подтверждением — иначе правило нечего охранять');
});

test('the reset rule can fail — it fired on real drafts, so it must fire here', () => {
  const drafted = 'Неизрасходованное сгорает в конце суток, а лимит обновляется каждое утро.';
  assert.ok([...drafted.matchAll(RESET_CLAIMS)].length >= 2, 'правило обязано ловить обе формулировки');
  assert.equal([...'Объём доступен до конца срока действия.'.matchAll(RESET_CLAIMS)].length, 0,
    'и не должно срабатывать на честной формулировке');
});

// ── Attribution: the class of error the price gates cannot see ─────────────
//
//   The 2026-09-01 editorial review found nothing wrong with any price. Every
//   defect it found was ATTRIBUTION: a real number attached to the wrong
//   package, or a superlative asserted at a scope nobody checked, or a field the
//   author never opened. Three fields did all the damage:
//
//     speed              a Kazakhstan draft said the two «Центральная Азия»
//                        families differ «не в скорости» — one is 3G/4G, the
//                        other 3G/4G/5G, and the card prints it.
//     fup_policy         a Georgia draft called a plan «без оговорок» because
//                        its NAME lacked «FUP1Mbps». Its policy is 512 Kbps —
//                        harsher than the plan it was being compared against.
//     activation_policy  a Taiwan draft recommended a package AND told the
//                        reader to install before flying. That package is one of
//                        15 in 2295 whose validity starts at installation.
//
//   So a page may now only name a value some package of that country carries.

test('speeds, throttles and activation phrases are attributed, not invented', () => {
  const dir = join(ROOT, 'seo/content-profiles');
  const SPEED = /\b(?:[2-5]G(?:\/[2-5]G)*)\b/g;
  const THROTTLE = /(\d+(?:[.,]\d+)?)\s*(Кбит\/с|Мбит\/с)/gi;
  const PROSE = ['title', 'description', 'h1', 'lead', 'intro', 'why', 'faq'];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const slug = f.replace(/\.json$/, '');
    const sheet = SHEETS[slug];
    if (!sheet) continue;
    const prose = JSON.stringify(PROSE.map((k) => JSON.parse(readFileSync(join(dir, f), 'utf8'))[k]));
    const gens = new Set((sheet.speeds || []).flatMap((x) => x.split('/')));
    for (const m of prose.matchAll(SPEED)) {
      if (!(sheet.speeds || []).length) continue;
      for (const g of m[0].split('/')) {
        assert.ok(gens.has(g), `${slug}: названа сеть «${m[0]}», у тарифов страны только ${(sheet.speeds || []).join(', ')}`);
      }
    }
    const fups = (sheet.fup_policies || []).map((x) => x.toLowerCase().replace(/\s+/g, ''));
    for (const m of prose.matchAll(THROTTLE)) {
      const want = `${String(m[1]).replace(',', '.')}${m[2].toLowerCase().startsWith('к') ? 'kbps' : 'mbps'}`;
      assert.ok(!fups.length || fups.includes(want), `${slug}: названо ограничение «${m[0]}», в каталоге ${(sheet.fup_policies || []).join(', ')}`);
    }
    if (prose.includes('после установки') && (sheet.activation_policies || []).length) {
      assert.ok((sheet.activation_policies || []).some((a) => a === 'installation' || a === 'upon_installation'),
        `${slug}: сказано «после установки», но таких тарифов у страны нет: ${sheet.activation_policies.join(', ')}`);
    }
  }
});

test('the attribution rule can fail — 5G where the catalogue has none', () => {
  const armenia = SHEETS['armenia'];
  assert.ok(armenia, 'ожидался фактшит Армении');
  const gens = new Set((armenia.speeds || []).flatMap((x) => x.split('/')));
  assert.ok(!gens.has('5G'), 'у Армении не должно быть 5G — иначе тест ничего не доказывает');
  assert.ok(gens.has('4G'), 'а 4G должно быть');
});

test('the three fields are the catalogue\'s, not a guess', () => {
  for (const [slug, sheet] of Object.entries(SHEETS)) {
    const pkgs = PK.filter((p) => countryFacts([p], sheet.iso).total_shown === 1);
    const speeds = [...new Set(pkgs.map((p) => String(p.speed || '').trim()).filter(Boolean))].sort();
    assert.deepEqual(sheet.speeds, speeds, `${slug}: список сетей разошёлся с каталогом`);
    const acts = [...new Set(pkgs.map((p) => String(p.activation_policy || '').trim().toLowerCase()).filter(Boolean))].sort();
    assert.deepEqual(sheet.activation_policies, acts, `${slug}: список политик активации разошёлся с каталогом`);
  }
});
