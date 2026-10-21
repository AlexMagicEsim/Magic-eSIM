// What assets/daily-plan-copy.js says, as one fingerprint per function and language.
//
// I18N stage 2 moved the module's words from `lang === EN ? … : …` branches into one table per language. This walks every
// exported function over the daily plans of BOTH frozen catalogue samples next to this file (the Mini App's RU sample and
// the GLOBAL sample — never the live catalogue, which the provider sync moves) plus edge values, in every language a caller
// passes today: none, 'ru', 'en' and an unknown one ('xx' — never a planned language, those get their own table). The
// hashes in daily-copy-golden.json are what the code produced BEFORE the move (storefront 27529719);
// seo/test-daily-copy-langs.mjs asserts the code produces them still.
//
// The script runs in its own vm context, so the same function can fingerprint another tree.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { COUNTRY_NAMES } from '../../seo/country-names.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LANGS = [undefined, 'ru', 'en', 'xx'];
const GB = [0, -1, 'x', 0.1, 0.25, 0.49, 0.5, 0.98, 1, 1.5, 2, 2.25, 3, 5, 10, 20];
const SPEEDS = ['', 'fast', '128 Kbps', '384 kbps', '512Kbps', '1 Mbps', '1.5 Mbps', '1,5 Mbps', '3 mbps', '2 Gbps', '10 Mbps '];
const NUMBERS = Array.from({ length: 125 }, (_, i) => i - 2).concat([1.5, 211, 1001]);

const digest = (value) => createHash('sha256').update(JSON.stringify(value === undefined ? null : value)).digest('hex');

export function load(root) {
  const ctx = { console, Intl, Math, JSON, Number, String, Array, Object, isFinite };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, 'assets/daily-plan-copy.js'), 'utf8'), ctx, { filename: 'daily-plan-copy.js' });
  return ctx.MagicDailyPlan;
}

export function sample() {
  const seen = new Map();
  for (const f of ['miniapp-locale-catalogue.json', 'en-plans-catalogue.json']) {
    const j = JSON.parse(readFileSync(join(HERE, f), 'utf8'));
    for (const p of (Array.isArray(j) ? j : j.packages)) if (!seen.has(f + p.package_id)) seen.set(f + p.package_id, p);
  }
  return [...seen.values()];
}

export function fingerprint(root) {
  const D = load(root);
  const list = sample();
  const namer = (lang) => (c) => {
    const n = COUNTRY_NAMES[String(c || '').toUpperCase()];
    return n ? (lang === 'en' ? n.en : n.ru) : String(c || '').toUpperCase();
  };
  const bare = (c) => String(c || '').toUpperCase();
  const out = { BLOCK_TITLE: D.BLOCK_TITLE, isDaily: list.map((p) => D.isDaily(p)), terms: list.map((p) => D.terms(p)),
    partition: (() => { const r = D.partition(list); return [r.daily.map((p) => p.package_id), r.volume.map((p) => p.package_id)]; })() };
  for (const lang of LANGS) {
    const k = String(lang);
    const names = namer(lang);
    out[`blockTitle.${k}`] = D.blockTitle(lang);
    out[`formatAllowance.${k}`] = GB.map((g) => D.formatAllowance(g, lang)).concat(list.map((p) => D.formatAllowance(p.daily_gb, lang)));
    out[`formatSpeed.${k}`] = SPEEDS.map((s) => D.formatSpeed(s, lang)).concat(list.map((p) => D.formatSpeed(p.daily_throttle_label, lang)));
    out[`pluralDays.${k}`] = NUMBERS.map((n) => D.pluralDays(n, lang));
    out[`pluralCountries.${k}`] = NUMBERS.map((n) => D.pluralCountries(n, lang));
    out[`lines.${k}`] = list.map((p) => D.lines(p, lang));
    out[`placeName.${k}`] = list.map((p) => [D.placeName(p, names, lang), D.placeName(p, bare, lang), D.placeName(p, undefined, lang)]);
    out[`displayName.${k}`] = list.map((p) => [D.displayName(p, names, lang), D.displayName(p, bare, lang)]);
    out[`coverageLine.${k}`] = list.map((p) => [D.coverageLine(p, names, lang), D.coverageLine(p, undefined, lang)]);
  }
  const hashes = {};
  for (const [k, v] of Object.entries(out)) hashes[k] = digest(v);
  return { hashes, counts: { packages: list.length, daily: list.filter((p) => D.isDaily(p)).length } };
}
