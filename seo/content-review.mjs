#!/usr/bin/env node
// SEO Reviewer — the gate between "written" and "published".
//
// It asks three questions a human reviewer would ask, and it asks them the way
// a machine can: exhaustively, on every page, every time.
//
//   1. Is every fact in the prose actually in the catalogue?
//      Every number carrying a unit — ГБ, ₽, дней, стран, тарифов — is pulled
//      out of the editorial text and matched against that country's fact
//      sheet. A number that is not there was invented, and invented numbers
//      are the one failure mode this whole pipeline exists to prevent. A page
//      that says "от 350 ₽" when the catalogue says 400 is worse than a page
//      that says nothing.
//
//   2. Does the page read as its own page?
//      Shared openings, cloned FAQ, corpus-wide similarity. Handled by
//      content-quality.mjs, surfaced here.
//
//   3. Is it structurally publishable?
//      Meta lengths, an H1 that is not the title, enough FAQ to be worth
//      marking up, no catalogue keys smuggled into the profile.
//
// Exit code is 1 if any page in scope fails, so this can gate a build.
//
//   node seo/content-review.mjs                все профили
//   node seo/content-review.mjs thailand japan

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILE_DIR, EDITORIAL_KEYS } from './content-profile.mjs';
import { loadSheets } from './fact-sheet.mjs';
import { scoreProfile, corpusEntry, BANNED_PHRASES } from './content-quality.mjs';
import { readdirSync } from 'node:fs';

const { sheets } = loadSheets();

const TEXT_KEYS = ['lead', 'intro', 'why', 'faq', 'title', 'description', 'h1'];

/** Every string a reader will actually see, flattened. */
function proseOf(profile) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const k of TEXT_KEYS) if (profile[k] !== undefined) walk(profile[k]);
  return out;
}

// A claim is a number plus the thing it counts. Bare numbers are ignored on
// purpose — "2 недели", "5 минут", "24/7" are not catalogue facts and policing
// them would make the check unusable.
//
// Volumes and prices are checked ALWAYS: there is no innocent reason for a
// gigabyte figure or a rouble figure to appear in editorial prose unless it
// came from the catalogue, and those are the two that cost a customer money
// when they are wrong.
//
// Days, countries and tariff counts are checked only in a sentence that is
// talking about the catalogue. "поездка на 14 дней" is a trip, not a validity
// period, and a checker that cannot tell them apart gets switched off.
const STRICT_PATTERNS = [
  { unit: 'ГБ', re: /(\d+(?:[.,]\d+)?)\s*(?:гб|gb|гигабайт\w*)/gi },
  { unit: '₽',  re: /(\d[\d\s ]*)\s*(?:₽|руб\w*)/gi },
];
const CONTEXTUAL_PATTERNS = [
  { unit: 'дней',    re: /(\d+)\s*(?:дн\w*|сут\w*)/gi },
  { unit: 'стран',   re: /(\d+)\s*стран\w*/gi },
  { unit: 'тарифов', re: /(\d+)\s*(?:тариф\w*|пакет\w*|план\w*)/gi },
];
const CATALOGUE_CONTEXT = /тариф|пакет|план|действ|срок|покрыва|включ|каталог/i;

const sentences = (text) => String(text).split(/(?<=[.!?…])\s+/);

function allowedValues(sheet) {
  const gb = new Set(sheet.volumes_gb);
  const rub = new Set(sheet.offers.map((o) => o.price_rub));
  rub.add(sheet.min_price_rub); rub.add(sheet.max_price_rub);
  const days = new Set(sheet.offers.map((o) => o.validity_days).filter((d) => d !== null));
  if (sheet.validity_days_min !== null) { days.add(sheet.validity_days_min); days.add(sheet.validity_days_max); }
  const countries = new Set([sheet.regional_reach_max]);
  const counts = new Set([sheet.local_count, sheet.regional_count, sheet.total_count]);
  return { 'ГБ': gb, '₽': rub, 'дней': days, 'стран': countries, 'тарифов': counts };
}

function checkFacts(profile, sheet) {
  const allowed = allowedValues(sheet);
  const problems = [];
  const scan = (text, patterns) => {
    for (const { unit, re } of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const value = Number(String(m[1]).replace(/[\s ]/g, '').replace(',', '.'));
        if (!Number.isFinite(value)) continue;
        if (!allowed[unit].has(value)) {
          problems.push(`факт вне каталога: «${m[0].trim()}» — в каталоге таких ${unit} нет`);
        }
      }
    }
  };
  for (const text of proseOf(profile)) {
    scan(text, STRICT_PATTERNS);
    for (const sentence of sentences(text)) {
      if (CATALOGUE_CONTEXT.test(sentence)) scan(sentence, CONTEXTUAL_PATTERNS);
    }
  }
  return [...new Set(problems)];
}

function checkStructure(profile) {
  const p = [];
  const title = profile.title || '';
  const desc = profile.description || '';
  if (title && (title.length < 30 || title.length > 65)) p.push(`title ${title.length} симв. (нужно 30–65)`);
  if (desc && (desc.length < 110 || desc.length > 165)) p.push(`description ${desc.length} симв. (нужно 110–165)`);
  if (profile.h1 && title && profile.h1.trim() === title.trim()) p.push('h1 дословно повторяет title');
  const faq = Array.isArray(profile.faq) ? profile.faq : [];
  if (faq.length && faq.length < 4) p.push(`FAQ ${faq.length} — мало для разметки, нужно ≥4`);
  for (const f of faq) {
    if (!f || !f.q || !f.a) p.push('в FAQ есть пункт без вопроса или без ответа');
    else if (String(f.a).length < 80) p.push(`ответ слишком короткий: «${String(f.q).slice(0, 40)}»`);
  }
  const intro = Array.isArray(profile.intro) ? profile.intro : [];
  if (intro.some((x) => typeof x !== 'string' || x.length < 120)) p.push('в intro есть абзац короче 120 символов');
  const why = Array.isArray(profile.why) ? profile.why : [];
  if (why.length && why.length < 3) p.push(`why ${why.length} — нужно ≥3`);
  return p;
}

function checkBanned(profile) {
  const text = proseOf(profile).join(' ').toLowerCase();
  return BANNED_PHRASES.filter((b) => text.includes(b)).map((b) => `штамп: «${b}»`);
}

// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const all = existsSync(PROFILE_DIR)
  ? readdirSync(PROFILE_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))
  : [];
const scope = argv.length ? argv : all;

const corpus = all.map((slug) => {
  try { return corpusEntry(slug, JSON.parse(readFileSync(join(PROFILE_DIR, `${slug}.json`), 'utf8'))); }
  catch { return corpusEntry(slug, null); }
});

let failed = 0;
for (const slug of scope) {
  const file = join(PROFILE_DIR, `${slug}.json`);
  if (!existsSync(file)) { console.log(`\n✗ ${slug}: профиля нет`); failed++; continue; }
  let profile;
  try { profile = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { console.log(`\n✗ ${slug}: JSON не разбирается — ${e.message}`); failed++; continue; }

  const sheet = sheets[slug];
  const problems = [
    ...(sheet ? checkFacts(profile, sheet) : ['нет фактшита — страна не в каталоге']),
    ...checkStructure(profile),
    ...checkBanned(profile),
  ];
  const unknown = Object.keys(profile).filter((k) => !EDITORIAL_KEYS.includes(k)
    && !['status', 'priority', 'quality_score', 'traffic_bucket', 'search_intent', 'paa',
      'related_topics', 'faq_candidates', 'sources', 'reviewed_by', 'reviewed_at',
      'last_reviewed', 'next_review', 'editor_notes', 'notes', 'research_method',
      'locked', 'locked_by', 'locked_reason', 'ab_test'].includes(k));
  if (unknown.length) problems.push(`неизвестные поля: ${unknown.join(', ')}`);

  const q = scoreProfile(profile, { slug, corpus });
  if (q.score < 80) problems.push(`Quality Score ${q.score} (<80): ${q.penalties.join('; ') || q.band}`);

  if (problems.length) {
    failed++;
    console.log(`\n✗ ${slug}  score ${q.score}`);
    for (const x of problems) console.log(`    ${x}`);
  } else {
    console.log(`✓ ${slug}  score ${q.score}  ${q.band}`);
  }
}

console.log(`\nПроверено ${scope.length}, замечаний в ${failed}.`);
process.exit(failed ? 1 : 0);
