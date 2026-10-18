// Every rouble amount a hand-written country text prints — and whether anything
// checks it against the package it priced.
//
// WHY
//
//   A provider move falsifies any authored sentence that quotes its amount
//   (storefront #70, #72, #78). A sentence anchored by a `price_claims` entry
//   (seo/price-claims.mjs) is checked against ONE package and term, so the move
//   stops the SEO refresh with a clear message. An UNANCHORED amount is checked
//   only by checkFacts — «does this figure exist anywhere in the country's
//   catalogue» — which passed stale pages whenever the old amount happened to be
//   some other plan's price (#75). On 2026-10-18 there were ~300 such amounts.
//
//   This module lists them; seo/test-price-inventory.mjs is the ratchet: the
//   unanchored set may only SHRINK (seo/price-inventory-baseline.json, plus a
//   ceiling in the test). A new amount must arrive with its claim, or be written
//   as a relation, or (stage B) as a catalogue substitution.
//
// WHAT COUNTS
//
//   Rendered profile text only — lead, title, description, h1, intro[i],
//   why[i].h / why[i].p, faq[i].q / faq[i].a, dual_sim_note.text. Bookkeeping keys
//   (claims, sources, notes) never reach the HTML. A sentence is split as the
//   claim checkers split it (seo/coverage-claims.mjs sentencesOf); one with a
//   digit followed by «₽» is an amount sentence:
//     anchored   — a price_claims anchor names this field and this exact sentence;
//     waived     — a price_claims_waived entry does (headline fields only);
//     unanchored — anything else.
//
//   CLI: node seo/price-inventory.mjs [--json] [--write-baseline]

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sentencesOf } from './coverage-claims.mjs';
import { loadProfiles, PROFILE_DIR } from './price-claims.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
export const BASELINE_FILE = join(ROOT, 'seo', 'price-inventory-baseline.json');

export const AMOUNT_RE = /\d[\d   ]*₽/g;
// An amount, or an enumeration / range of amounts ending in one «₽»:
// «за 1000, 1300, 2350 и 3550 ₽», «от 1 050 до 18 750 ₽» — every number counts.
export const AMOUNT_GROUP_RE = /(?:\d[\d   ]*?(?:,\s*|\s+и\s+|\s+до\s+|\s*[–—]\s*))*\d[\d   ]*₽/g;
const numbersOf = (group) => group.replace(/₽/, '').split(/,\s*|\s+и\s+|\s+до\s+|\s*[–—]\s*/).map((x) => Number(x.replace(/[^\d]/g, ''))).filter((n) => n > 0);
const norm = (s) => String(s ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim();

/** Every rendered text field of a profile as [path, text], in a stable order. */
export function renderedFields(profile) {
  const out = [];
  for (const k of ['title', 'description', 'h1', 'lead']) if (typeof profile[k] === 'string') out.push([k, profile[k]]);
  (Array.isArray(profile.intro) ? profile.intro : []).forEach((t, i) => { if (typeof t === 'string') out.push([`intro[${i}]`, t]); });
  (Array.isArray(profile.why) ? profile.why : []).forEach((w, i) => {
    if (typeof w === 'string') { out.push([`why[${i}]`, w]); return; }
    for (const sub of ['h', 'p']) if (w && typeof w[sub] === 'string') out.push([`why[${i}].${sub}`, w[sub]]);
  });
  (Array.isArray(profile.faq) ? profile.faq : []).forEach((f, i) => {
    for (const sub of ['q', 'a']) if (f && typeof f[sub] === 'string') out.push([`faq[${i}].${sub}`, f[sub]]);
  });
  if (profile.dual_sim_note && typeof profile.dual_sim_note.text === 'string') out.push(['dual_sim_note.text', profile.dual_sim_note.text]);
  return out;
}

/** Amount sentences of one profile, each with its status. */
export function inventoryOf(slug, profile) {
  const anchors = (Array.isArray(profile.price_claims) ? profile.price_claims : [])
    .flatMap((c) => (c && Array.isArray(c.anchors) ? c.anchors.map((a) => ({ ...a, claim: c.id })) : []));
  const waived = Array.isArray(profile.price_claims_waived) ? profile.price_claims_waived : [];
  const out = [];
  for (const [field, text] of renderedFields(profile)) {
    for (const sentence of sentencesOf(text)) {
      const groups = sentence.match(AMOUNT_GROUP_RE);
      if (!groups) continue;
      const anchor = anchors.find((a) => a && a.field === field && norm(a.text) === sentence);
      const waiver = waived.find((w) => w && w.field === field && norm(w.text) === sentence);
      out.push({
        slug, field, sentence,
        amounts: groups.flatMap(numbersOf),
        status: anchor ? 'anchored' : waiver ? 'waived' : 'unanchored',
        claim: anchor ? anchor.claim : null,
      });
    }
  }
  return out;
}

/** The whole published corpus. */
export function inventory(profileDir = PROFILE_DIR) {
  return loadProfiles(profileDir).flatMap(({ slug, profile }) => inventoryOf(slug, profile));
}

/** The ratchet's key for one unanchored sentence. */
export const keyOf = (x) => `${x.slug} · ${x.field} · ${x.sentence}`;

export function summary(rows) {
  const by = (s) => rows.filter((r) => r.status === s);
  const amounts = (rs) => rs.reduce((n, r) => n + r.amounts.length, 0);
  return {
    profiles: new Set(rows.map((r) => r.slug)).size,
    sentences: rows.length,
    amounts: amounts(rows),
    anchored: { sentences: by('anchored').length, amounts: amounts(by('anchored')) },
    waived: { sentences: by('waived').length, amounts: amounts(by('waived')) },
    unanchored: { sentences: by('unanchored').length, amounts: amounts(by('unanchored')) },
  };
}

export function loadBaseline(file = BASELINE_FILE) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  if (!doc || !Array.isArray(doc.unanchored)) throw new Error(`${file}: нет массива unanchored`);
  return doc;
}

export function baselineDoc(rows) {
  return {
    _doc: [
      'Unanchored rouble amounts in authored country texts (seo/price-inventory.mjs).',
      'THIS LIST MAY ONLY SHRINK: seo/test-price-inventory.mjs fails on a new entry and on a stale one.',
      'Remove a line by anchoring its sentence with price_claims, rewriting it as a relation, or (stage B) a catalogue substitution.',
      'Regenerate after a removal: node seo/price-inventory.mjs --write-baseline — and lower MAX_UNANCHORED in the test.',
    ],
    unanchored: rows.filter((r) => r.status === 'unanchored').map(keyOf).sort(),
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const rows = inventory();
  if (process.argv.includes('--write-baseline')) {
    writeFileSync(BASELINE_FILE, JSON.stringify(baselineDoc(rows), null, 2) + '\n');
    console.log(`written ${BASELINE_FILE}`);
  }
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
  else {
    const s = summary(rows);
    console.log(`profiles with amounts ${s.profiles} · sentences ${s.sentences} · amounts ${s.amounts}`);
    console.log(`anchored ${s.anchored.sentences} sentences / ${s.anchored.amounts} amounts · waived ${s.waived.sentences} / ${s.waived.amounts} · UNANCHORED ${s.unanchored.sentences} / ${s.unanchored.amounts}`);
    const per = {};
    for (const r of rows) if (r.status === 'unanchored') per[r.slug] = (per[r.slug] || 0) + r.amounts.length;
    console.log('unanchored amounts by page:', Object.entries(per).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  }
}
