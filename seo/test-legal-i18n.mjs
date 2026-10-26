// LEGAL-4 — the translations of the Terms of Service, the Refund Policy and the Privacy Policy (seo/legal-i18n.mjs).
//
//   1. FRESHNESS: every translated section and head follows the CURRENT English text (its `en` hash) — a change to the
//      English fails here, naming the language, the document and the section, until the translation is redone;
//   2. FIDELITY GUARDS: the same sections, the same element structure, the same links, <code> values, numbers, seller
//      details and contact; no English sentence left; no supplier, payment provider or Merchant of Record named;
//   3. the checkout's words are the documents' words: the second box = the Refund §4.2 quotation, the box links = the
//      document titles = the footer labels;
//   4. the pages: one per language and document, its own language, noindex, self-canonical, not in the sitemap, the
//      English version and date, the precedence notice with a link to the English original;
//   5. English Terms §5.6 states the precedence of the English version with the consumer-law reservation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { LEGAL_TRANSLATIONS, LEGAL_KINDS, EN_LEGAL, staleness, sectionHash, headHash } from './legal-i18n.mjs';
import { LOCALES } from './locales.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const count = (h, tag) => (h.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
const PREFIX = { es: 'es', de: 'de', fr: 'fr', 'zh-Hans': 'zh', ko: 'ko' };
const CODES = Object.keys(PREFIX);

test('every published non-English, non-Russian language has a translation of all three documents', () => {
  const published = LOCALES.filter((l) => l.site && l.site.enabled && l.code !== 'en' && l.code !== 'ru').map((l) => l.code).sort();
  assert.deepEqual(Object.keys(LEGAL_TRANSLATIONS).sort(), published);
  assert.deepEqual(CODES.slice().sort(), published);
});

/* ------------------------------------------------------------------ 1. freshness */

test('FRESHNESS: every translation follows the current English text, section by section', () => {
  for (const code of CODES) {
    const stale = staleness(code);
    assert.deepEqual(stale, [], `${code}: the English changed — re-translate these and update their \`en\` hash:\n${stale.map((s) => `  ${s.kind} ${s.id}: ${s.reason}`).join('\n')}`);
  }
});

test('freshness is real: a one-character change to the English is caught', () => {
  const E = EN_LEGAL.refund.D;
  const s0 = E.sections[3];
  assert.notEqual(sectionHash({ ...s0, html: s0.html.replace('14', '15') }), sectionHash(s0));
  assert.notEqual(headHash({ ...E, lead: `${E.lead} ` }), headHash(E));
  const T = LEGAL_TRANSLATIONS.es;
  const fake = { ...T, refund: { ...T.refund, sections: T.refund.sections.map((x, i) => (i === 3 ? { ...x, en: '000000000000' } : x)) } };
  assert.equal(staleness('es', fake).length, 1);
});

/* ------------------------------------------------------------------ 2. fidelity guards */

const NUM = (h) => (text(h).replace(/\d+(?:[.,]\d+)*(?=\s?%)/g, (m) => m.replace(',', '.')).match(/\d+/g) || []).sort();
const SUPPLIERS = /mobimatter|esim ?access|yesim|airalo|holafly|esimgo|esim go\b|platega|flitt|paddle|dodo|creem|stripe|tbc\b/i;

for (const code of CODES) {
  const T = LEGAL_TRANSLATIONS[code];
  for (const kind of LEGAL_KINDS) {
    const E = EN_LEGAL[kind].D;
    const X = T[kind];
    test(`${code} ${kind}: same structure, links, codes and numbers as the English, section by section`, () => {
      for (const [i, s] of E.sections.entries()) {
        const x = X.sections[i];
        const where = `${code} ${kind} ${s.id}`;
        for (const tag of ['p', 'li', 'ul', 'ol', 'h3', 'blockquote', 'strong', 'code', 'a', 'table', 'tr']) {
          assert.equal(count(x.html, tag), count(s.html, tag), `${where}: <${tag}> count`);
        }
        const hrefs = (h) => [...h.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).sort();
        assert.deepEqual(hrefs(x.html), hrefs(s.html), `${where}: links`);
        const codes = (h) => [...h.matchAll(/<code>([^<]*)<\/code>/g)].map((m) => m[1]).sort();
        assert.deepEqual(codes(x.html), codes(s.html), `${where}: <code> values`);
        assert.deepEqual(NUM(x.html), NUM(s.html), `${where}: the numbers`);
        assert.doesNotMatch(x.html + x.h2, SUPPLIERS, `${where}: no supplier, payment provider or MoR`);
        assert.notEqual(text(x.html), text(s.html), `${where}: translated`);
      }
    });
    test(`${code} ${kind}: no English sentence left (7-word runs of the English do not appear)`, () => {
      // Kept in English on purpose: the seller's name, the postal address (Latin, as registered) and foreign law titles.
      const KEEP = [/Individual Entrepreneur ALEKSANDR KHARIN/g, /ALEKSANDR KHARIN \(Magic eSIM\)/g,
        /Georgia, Tbilisi, Saburtalo district, Bakhtrioni str\. N22, Apt\. 75/g, /Bakhtrioni str\. N22, Apt\. 75, Saburtalo district, Tbilisi, Georgia/g,
        /Consumer Guarantees Act 1993/g, /Fair Trading Act 1986/g, /Australian Consumer Law/g];
      for (const [i, s] of E.sections.entries()) {
        const en = KEEP.reduce((a, r) => a.replace(r, ' | '), text(s.html)).split(' ');
        const tx = text(X.sections[i].html);
        for (let j = 0; j + 7 <= en.length; j++) {
          const run = en.slice(j, j + 7);
          if (run.includes('|') || !/[a-z]{3}/.test(run.join(' '))) continue;
          assert.ok(!tx.includes(run.join(' ')), `${code} ${kind} ${s.id}: English left: «${run.join(' ')}»`);
        }
      }
    });
  }
  test(`${code}: the seller, the identification number and the contact are kept exactly`, () => {
    const all = LEGAL_KINDS.map((k) => T[k].sections.map((x) => x.html).join(' ')).join(' ');
    for (const must of ['ALEKSANDR KHARIN', '305887261', 'support@magicesim.store', 'Bakhtrioni str. N22, Apt. 75']) assert.ok(all.includes(must), `${code}: ${must}`);
    assert.ok(T.terms.sections.map((x) => x.html).join(' ').includes('ინდივიდუალური მეწარმე'), `${code}: the Georgian legal form`);
    // «Version» is also the French and German word, so only the two others must differ from the English.
    for (const k of ['version', 'effective', 'preLaunch']) assert.ok(typeof T.labels[k] === 'string' && T.labels[k].trim(), `${code}: label ${k}`);
    for (const k of ['effective', 'preLaunch']) assert.notEqual(T.labels[k], { effective: 'Effective date', preLaunch: 'pre-launch' }[k], `${code}: label ${k} translated`);
    assert.ok(T.notice.body && !/This is a translation/.test(T.notice.body), `${code}: the notice translated`);
  });
}

/* ------------------------------------------------------------------ 3. the checkout's words are the documents' words */

const unquote = (s) => s.trim().replace(/^[“„«「"  \s]+|[”“»」"  \s]+$/g, '').trim();
for (const code of CODES) {
  test(`${code}: the second checkout box is word for word the Refund §4.2 quotation; box links = titles = footer labels`, () => {
    const W = SITE.DICT[code];
    const T = LEGAL_TRANSLATIONS[code];
    const s4 = T.refund.sections.find((x) => x.id === 'your-statutory-rights');
    const q = s4.html.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>\s*<\/blockquote>/);
    assert.ok(q, `${code}: the quotation in Refund §4.2`);
    // Compared character for character after the same space normalisation on both sides (text() folds U+00A0/U+202F).
    const norm = (v) => v.replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
    assert.equal(norm(unquote(q[1].replace(/<[^>]+>/g, ''))), norm(W['consent.delivery']), `${code}: consent.delivery ≠ the Refund §4.2 quotation`);
    for (const [kind, key] of [['terms', 'termsLink'], ['refund', 'refundLink'], ['privacy', 'privacyLink']]) {
      assert.equal(T[kind].h1, W[`consent.${key}`], `${code}: ${kind} title = the checkout link`);
      assert.equal(T[kind].h1, W[`footer.${kind}`], `${code}: ${kind} title = the footer label`);
    }
  });
}

/* ------------------------------------------------------------------ 4. the pages */

const sitemap = read('sitemap.xml');
for (const code of CODES) {
  for (const kind of LEGAL_KINDS) {
    const rel = `${PREFIX[code]}/${kind}/index.html`;
    test(`/${PREFIX[code]}/${kind}/: its language, noindex, self-canonical, no hreflang, not in the sitemap, the English version, the notice`, () => {
      assert.ok(existsSync(join(ROOT, rel)), `${rel} is built`);
      const h = read(rel);
      const T = LEGAL_TRANSLATIONS[code];
      const url = `https://magicesim.store/${PREFIX[code]}/${kind}/`;
      assert.match(h, new RegExp(`<html lang="${code}">`));
      assert.ok(h.includes(`<link rel="canonical" href="${url}">`));
      assert.ok(h.includes('<meta name="robots" content="noindex, follow">'));
      assert.doesNotMatch(h, /rel="alternate"/);
      assert.ok(!sitemap.includes(url), 'not in the sitemap');
      assert.doesNotMatch(h, /<!--/, 'no HTML comment');
      const v0 = EN_LEGAL[kind].version.replace('(pre-launch)', `(${T.labels.preLaunch})`);
      const v = code === 'zh-Hans' ? v0.replace(' (', '（').replace(/\)$/, '）') : v0;
      assert.ok(text(h).includes(`${T.labels.version} ${v}`), `the English version ${EN_LEGAL[kind].version}`);
      assert.ok(h.includes(`<time datetime="${EN_LEGAL[kind].effectiveIso}">`), 'the English date');
      assert.ok(h.includes(`<a href="/en/${kind}/" hreflang="en" lang="en">`), 'the link to the English original');
      for (const s of T[kind].sections) assert.ok(h.includes(`id="${s.id}"`), s.id);
    });
  }
}

test('the English pages and every translation lead to each other in the language switch', () => {
  for (const kind of LEGAL_KINDS) {
    const en = read(`en/${kind}/index.html`);
    for (const code of CODES) assert.ok(en.includes(`href="/${PREFIX[code]}/${kind}/"`), `/en/${kind}/ → ${code}`);
    for (const code of CODES) assert.ok(read(`${PREFIX[code]}/${kind}/index.html`).includes(`href="/en/${kind}/"`), `${code} → /en/${kind}/`);
  }
});

/* ------------------------------------------------------------------ 5. English Terms §5.6 */

test('English Terms §5.6: concluded in English; the English applies where a translation differs, save mandatory law; statutory rights kept', () => {
  const t = text(EN_LEGAL.terms.D.sections.map((s) => s.html).join(' '));
  assert.match(t, /The contract is concluded in English\./);
  assert.match(t, /If a translation and the English version differ, the English version applies, unless the mandatory law that applies to you requires otherwise\./);
  assert.match(t, /This does not limit your statutory rights as a consumer, including any rule of that law that an unclear term is interpreted in your favour\./);
});
