// LEGAL-4 — the translations of the three international legal documents (Terms of Service, Refund Policy, Privacy Policy)
// into every prefixed non-English language of the site (es, de, fr, zh-Hans, ko).
//
// The ENGLISH text is the master (seo/terms-en.mjs, seo/refund-en.mjs, seo/privacy-en.mjs; Terms §5.6 says that the English
// version applies where a translation differs, unless mandatory law requires otherwise). Each translation lives in ONE file,
// seo/legal-i18n/<code>.mjs, with the same section ids in the same order.
//
// FRESHNESS. Every translated section — and each document's head (title, description, h1, lead, crumb) — carries `en`: a
// hash of the ENGLISH text it was translated from. When the English changes, the hash no longer matches and
// seo/test-legal-i18n.mjs fails, naming the language, the document and the section, until the translation is redone and
// its `en` updated. Never update an `en` hash without re-translating that section: the hash is the record that the
// translation follows that exact English text. The version of a translation is always the English version (the build
// prints it from the English module), so a translation can never claim a version it does not follow.
//
//   node seo/legal-i18n.mjs --check            every stale or missing section, per language (exit 1 if any)
//   node seo/legal-i18n.mjs --scaffold <code>  a new translation file with the English text and the current hashes
import { createHash } from 'node:crypto';
import { TERMS, TERMS_VERSION, TERMS_EFFECTIVE_ISO } from './terms-en.mjs';
import { REFUND, REFUND_VERSION, REFUND_EFFECTIVE_ISO } from './refund-en.mjs';
import { PRIVACY, PRIVACY_VERSION, PRIVACY_EFFECTIVE_ISO } from './privacy-en.mjs';
import { LEGAL_I18N as ES } from './legal-i18n/es.mjs';
import { LEGAL_I18N as DE } from './legal-i18n/de.mjs';
import { LEGAL_I18N as FR } from './legal-i18n/fr.mjs';
import { LEGAL_I18N as ZH } from './legal-i18n/zh-Hans.mjs';
import { LEGAL_I18N as KO } from './legal-i18n/ko.mjs';

export const LEGAL_KINDS = Object.freeze(['terms', 'refund', 'privacy']);

/** The English masters. */
export const EN_LEGAL = Object.freeze({
  terms: { D: TERMS, version: TERMS_VERSION, effectiveIso: TERMS_EFFECTIVE_ISO },
  refund: { D: REFUND, version: REFUND_VERSION, effectiveIso: REFUND_EFFECTIVE_ISO },
  privacy: { D: PRIVACY, version: PRIVACY_VERSION, effectiveIso: PRIVACY_EFFECTIVE_ISO },
});

/** The published translations, by language code (seo/locales.mjs). */
export const LEGAL_TRANSLATIONS = Object.freeze({ es: ES, de: DE, fr: FR, 'zh-Hans': ZH, ko: KO });

const h = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 12);
/** The hash of one English section: its id, heading and HTML, exactly. */
export const sectionHash = (s) => h([s.id, s.h2, s.html]);
/** The hash of a document's head. */
export const headHash = (D) => h([D.title, D.description, D.h1, D.lead, D.crumb]);

/** Every way a translation is out of step with the English: [{ code, kind, id, reason }]. Empty = current. */
export function staleness(code, T = LEGAL_TRANSLATIONS[code]) {
  const out = [];
  if (!T) return [{ code, kind: '*', id: '*', reason: 'no translation file' }];
  for (const kind of LEGAL_KINDS) {
    const E = EN_LEGAL[kind].D;
    const X = T[kind];
    if (!X) { out.push({ code, kind, id: '*', reason: 'document missing' }); continue; }
    if (X.en !== headHash(E)) out.push({ code, kind, id: 'head', reason: 'the English title / description / lead changed' });
    const eIds = E.sections.map((s) => s.id);
    const xIds = (X.sections || []).map((s) => s.id);
    if (eIds.join('|') !== xIds.join('|')) out.push({ code, kind, id: '*', reason: `sections differ: English [${eIds}] vs [${xIds}]` });
    for (const s of E.sections) {
      const t = (X.sections || []).find((x) => x.id === s.id);
      if (t && t.en !== sectionHash(s)) out.push({ code, kind, id: s.id, reason: 'the English section changed since it was translated' });
    }
  }
  return out;
}

/** A new translation file, the English text in place, ready to be translated. */
export function scaffold(code) {
  const docs = LEGAL_KINDS.map((kind) => {
    const D = EN_LEGAL[kind].D;
    const secs = D.sections.map((s) => `      { id: ${JSON.stringify(s.id)}, en: '${sectionHash(s)}', h2: ${JSON.stringify(s.h2)}, html: \`${s.html.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\` },`).join('\n');
    return `  ${kind}: {
    en: '${headHash(D)}',
    title: ${JSON.stringify(D.title)},
    description: ${JSON.stringify(D.description)},
    h1: ${JSON.stringify(D.h1)},
    lead: ${JSON.stringify(D.lead)},
    crumb: ${JSON.stringify(D.crumb)},
    sections: [
${secs}
    ],
  },`;
  }).join('\n');
  return `// LEGAL-4 — ${code}: the translation of the international Terms of Service, Refund Policy and Privacy Policy.
// The English (seo/terms-en.mjs, seo/refund-en.mjs, seo/privacy-en.mjs) is the master; see seo/legal-i18n.mjs.
export const LEGAL_I18N = Object.freeze({
  code: ${JSON.stringify(code)},
  labels: { version: 'Version', effective: 'Effective date', preLaunch: 'pre-launch' },
  notice: {
    body: 'This is a translation of the English version, provided for your convenience. If the translation and the English version differ, the English version applies, unless the mandatory law that applies to you requires otherwise. This does not limit your statutory rights.',
    english: 'Read the English version',
  },
${docs}
});
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [flag, arg] = process.argv.slice(2);
  if (flag === '--scaffold') process.stdout.write(scaffold(arg));
  else {
    const all = Object.keys(LEGAL_TRANSLATIONS).flatMap((c) => staleness(c));
    for (const s of all) console.log(`${s.code} ${s.kind} ${s.id}: ${s.reason}`);
    console.log(all.length ? `${all.length} stale` : 'all translations follow the current English');
    process.exit(all.length ? 1 : 0);
  }
}
