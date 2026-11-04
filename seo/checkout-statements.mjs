#!/usr/bin/env node
// P1-1 / P1-4 (owner's decision 2026-11-04) — the statements a buyer makes at the international checkout, as a frozen,
// versioned set: what the boxes said, word for word, in every published language, with a SHA-256 of each text.
//
// WHY. The server records, with each GLOBAL order, WHICH statements the buyer made and in which language (Terms §5.3:
// «We keep a record of what you accepted, with the date and time our server recorded it»; Refund §4.2: the confirmation
// email repeats the request for immediate supply). It cannot take the words from the browser — anything could be sent —
// so it keeps its own copy of this set (the backend's lib/checkout-statements.json, a byte-for-byte copy of the public
// /en/checkout-statements.json, compared by `npm run check:legal-versions` there) and the browser sends only the set's
// VERSION and the page's language. The record then holds the server's text hash, never the client's.
//
// THE STATEMENTS, by version (ids are a contract with the backend — never renamed, never reused for other words):
//   v1 (2026-11-04, three boxes): terms_refund · immediate_supply · age_18 · device_compatible
//   v2 (owner 2026-11-04, two boxes):
//     terms_refund_privacy_age  box 1 — 18 or older, the Terms of Service and the Refund Policy accepted, the Privacy
//                               Policy read (consent.terms, the three link labels filled in as plain words; Terms §3.1,
//                               §5.3(a), (b), (e)). The Privacy Policy is READ, never «agreed to»: it is not a consent.
//     immediate_supply          box 2, on its own — the Refund §4.2 quotation (consent.delivery; seo/test-legal-i18n.mjs
//                               holds it to §4.2). Kept apart: the express request that starts the plan inside the
//                               withdrawal period is never folded into the acceptance of the terms.
//     device_compatible         the device box of the details step (checkout.device; Terms §4.2 and §5.3(c))
//
// FROZEN, LIKE THE LEGAL ARCHIVE. seo/checkout-statements/v<n>.json (its own directory: seo/legal-archive/ holds only
// documents) is written ONCE by `--freeze` and never
// rewritten. seo/test-checkout-statements.mjs fails when the words of the dictionary differ from the snapshot of the
// CURRENT version: a wording change of any box comes with a new STATEMENTS_VERSION (and a new freeze), never under the
// old one — the backend then refuses an order from a page that still shows the old words (409 LEGAL_VERSION_CHANGED).
//
//   node seo/checkout-statements.mjs --freeze   write the snapshot of the current version (refuses to overwrite)
//   node seo/checkout-statements.mjs --check    exit 1 if a snapshot is damaged or the current words are not frozen
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { word } from './site-dictionary.mjs';
import { siteLocales } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE_DIR = join(ROOT, 'seo', 'checkout-statements');

/** The version of the set the pages show now. A wording change of any statement = the next number + `--freeze`. */
export const STATEMENTS_VERSION = '2';
export const STATEMENTS_JSON = 'en/checkout-statements.json';
export const STATEMENT_IDS_BY_VERSION = Object.freeze({
  1: Object.freeze(['terms_refund', 'immediate_supply', 'age_18', 'device_compatible']),
  2: Object.freeze(['terms_refund_privacy_age', 'immediate_supply', 'device_compatible']),
});
/** The statements of the current version. */
export const STATEMENT_IDS = STATEMENT_IDS_BY_VERSION[STATEMENTS_VERSION];

/** The languages of the international checkout: every published site language but Russian (its checkout is its own). */
export function statementLanguages() {
  return siteLocales().filter((c) => c !== 'ru');
}

const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

/** The words of every statement in one language, from the dictionary the pages are built from. */
export function currentTexts(code) {
  const fill = (key, links) => word(code, key).replace(/\{(\w+)\}/g, (m, name) => {
    if (!links[name]) throw new Error(`checkout-statements: ${code} ${key} names {${name}}, which has no word`);
    return links[name];
  });
  return {
    terms_refund_privacy_age: fill('consent.terms', { terms: word(code, 'consent.termsLink'),
      refund: word(code, 'consent.refundLink'), privacy: word(code, 'consent.privacyLink') }),
    immediate_supply: word(code, 'consent.delivery'),
    device_compatible: word(code, 'checkout.device'),
  };
}

/** The set as it stands now: { version, languages: { <code>: [{ id, text, sha256 }] } }. */
export function currentSet(version = STATEMENTS_VERSION) {
  const languages = {};
  for (const code of statementLanguages()) {
    const t = currentTexts(code);
    languages[code] = STATEMENT_IDS.map((id) => ({ id, text: t[id], sha256: sha(t[id]) }));
  }
  return { version, languages };
}

const snapshotFile = (v) => join(ARCHIVE_DIR, `v${v}.json`);

/** Every frozen version, oldest first. */
export function snapshots() {
  return readdirSync(ARCHIVE_DIR)
    .filter((f) => /^v\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(ARCHIVE_DIR, f), 'utf8')))
    .sort((a, b) => Number(a.version) - Number(b.version));
}

/** Everything wrong with the archive and the current words: [] = in order. */
export function problems(list = snapshots(), now = currentSet()) {
  const out = [];
  for (const s of list) {
    for (const [code, list] of Object.entries(s.languages || {})) {
      const ids = STATEMENT_IDS_BY_VERSION[s.version];
      if (!ids) { out.push(`v${s.version}: no statement ids for this version in STATEMENT_IDS_BY_VERSION`); continue; }
      if (list.map((x) => x.id).join() !== ids.join()) out.push(`v${s.version} ${code}: the statements are not [${ids}]`);
      for (const x of list) if (sha(x.text) !== x.sha256) out.push(`v${s.version} ${code} ${x.id}: the text does not match its own sha256`);
    }
  }
  const frozen = list.find((s) => s.version === STATEMENTS_VERSION);
  if (!frozen) { out.push(`v${STATEMENTS_VERSION}: not frozen — run node seo/checkout-statements.mjs --freeze`); return out; }
  for (const code of statementLanguages()) {
    const a = (frozen.languages || {})[code];
    if (!a) { out.push(`v${STATEMENTS_VERSION} ${code}: not in the frozen set`); continue; }
    for (const x of now.languages[code]) {
      const f = a.find((y) => y.id === x.id);
      if (!f || f.text !== x.text) out.push(`v${STATEMENTS_VERSION} ${code} ${x.id}: the words changed since the set was frozen — a new STATEMENTS_VERSION and --freeze`);
    }
  }
  return out;
}

/** Write the snapshot of the current version. Refuses to overwrite one. */
export function freeze() {
  const f = snapshotFile(STATEMENTS_VERSION);
  if (existsSync(f)) throw new Error(`checkout-statements: v${STATEMENTS_VERSION} is frozen already (${f}) — never rewritten`);
  writeFileSync(f, `${JSON.stringify(currentSet(), null, 2)}\n`);
  return f;
}

/** The public list (written to /en/checkout-statements.json by the English build): every frozen version, the current one marked. */
export function statementsJson(list = snapshots()) {
  const doc = {
    note: 'The statements a buyer makes at the Magic eSIM international checkout, word for word, by version and language. The server records the version and language of the statements made with each order; each text\'s SHA-256 is over its UTF-8 bytes.',
    current: STATEMENTS_VERSION,
    versions: list.map((s) => ({ version: s.version, current: s.version === STATEMENTS_VERSION, languages: s.languages })),
  };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const arg = process.argv[2];
  if (arg === '--freeze') { console.log(`frozen: ${freeze()}`); process.exit(0); }
  const p = problems();
  for (const x of p) console.log(x);
  console.log(p.length ? `${p.length} problem(s)` : `checkout statements v${STATEMENTS_VERSION}: frozen and current`);
  process.exit(p.length ? 1 : 0);
}
