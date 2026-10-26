// LEGAL-3 — the pre-launch Terms of Service and Refund Policy (/en/terms/, /en/refund/), the three legal links in every
// international footer, and the two consents of the international checkout. What is pinned:
//
//   1. the pages: English, own canonical, noindex, follow, no hreflang, strict CSP, no counter, not in the sitemap;
//   2. what they state: the seller and the support address, a version and an effective date, «International payments are
//      currently unavailable»; never a placeholder, an internal note, a payment provider, a Merchant of Record or an
//      eSIM supplier by name, a telephone number, or a claim that a payment flow runs;
//   3. every EN/ES/DE/FR/ZH/KO footer links the three published English documents and no Russian one;
//   4. the consents: two separate boxes, never pre-ticked, directly before the (disabled) payment button, the Terms and
//      the Refund Policy each its own link (new tab); the second box says what Refund Policy §4.2 quotes, word for word
//      in English; every language keeps every link placeholder;
//   5. en/checkout.js: payments are off by a constant, the one gate (payAllowed) needs both boxes, both versions and open
//      payments, the consent record cannot be built around it, and the script still never touches the payment button
//      nor calls any order or payment path.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { TERMS, TERMS_VERSION } from './terms-en.mjs';
import { REFUND, REFUND_VERSION } from './refund-en.mjs';
import { INTL_LEGAL, legalLinks } from './legal-links.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const SITE = require(join(ROOT, 'assets/site-i18n.js'));
const LANGS = [['en', 'en'], ['es', 'es'], ['de', 'de'], ['fr', 'fr'], ['zh-Hans', 'zh'], ['ko', 'ko']];
const DOCS = [['terms', TERMS, TERMS_VERSION], ['refund', REFUND, REFUND_VERSION]];

function pagesUnder(dir) {
  const out = [];
  (function walk(d) {
    for (const n of readdirSync(join(ROOT, d))) {
      const p = join(d, n);
      if (statSync(join(ROOT, p)).isDirectory()) walk(p);
      else if (n === 'index.html') out.push(p);
    }
  }(dir));
  return out;
}

/* ------------------------------------------------------------------ 1. the pages */

for (const [slug, D, version] of DOCS) {
  test(`/en/${slug}/: English, own canonical, noindex, follow, no hreflang, strict CSP, no counter, not in the sitemap`, () => {
    const PAGE = read(`en/${slug}/index.html`);
    const head = PAGE.slice(0, PAGE.indexOf('</head>'));
    assert.match(PAGE, /^<!doctype html>\n<html lang="en">/);
    assert.ok(head.includes(`<link rel="canonical" href="https://magicesim.store/en/${slug}/">`), 'its own canonical');
    assert.ok(head.includes('<meta name="robots" content="noindex, follow">'), 'noindex, follow');
    assert.doesNotMatch(head, /rel="alternate"|hreflang=/, 'no hreflang');
    assert.match(head, /http-equiv="Content-Security-Policy" content="[^"]*connect-src 'none'/);
    assert.doesNotMatch(PAGE, /mc\.yandex|metrika|ym\(|gtag|googletagmanager|document\.cookie/i);
    const scripts = [...PAGE.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(scripts.every((s) => /src="\/assets\/logo-once\.js/.test(s)), `only the logo script: ${scripts.join(' ')}`);
    assert.equal((PAGE.match(/<h1>/g) || []).length, 1);
    assert.ok(PAGE.includes(`<h1>${D.h1}</h1>`));
    assert.ok(PAGE.includes(`Version ${version} · Effective date: <time datetime="`), 'version and effective date');
    for (const s of D.sections) assert.ok(PAGE.includes(`<a href="#${s.id}">`) && PAGE.split(`id="${s.id}"`).length === 2, `toc → ${s.id}`);
    assert.ok(!read('sitemap.xml').includes(`/en/${slug}/`), 'not in the sitemap');
    assert.doesNotMatch(read('robots.txt'), new RegExp(`Disallow:\\s*/en/${slug}/`));
  });

  test(`/en/${slug}/: no placeholder, no internal note, no named payment provider, MoR, supplier or telephone; payments stated as unavailable`, () => {
    const PAGE = read(`en/${slug}/index.html`);
    const main = PAGE.slice(PAGE.indexOf('<main'), PAGE.indexOf('</main>'));
    const t = text(main);
    assert.doesNotMatch(PAGE, /AT LAUNCH|\{\{|\}\}|\[date|TODO|TBD|<!--/i, 'a placeholder or an HTML comment');
    assert.doesNotMatch(t, /\[[^\]*]*\]/, 'a bracketed field');
    assert.match(t, /International payments are currently unavailable/);
    assert.match(t, /Individual Entrepreneur ALEKSANDR KHARIN/);
    assert.match(t, /support@magicesim\.store/);
    assert.doesNotMatch(t, /Telephone|phone number:|\+\d[\d\s-]{6,}/i, 'no telephone line');
    // No company is named — not a payment provider, a Merchant of Record or an eSIM supplier (closed: none at all).
    const named = [...t.matchAll(/\b([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?),?\s(?:Inc\.|Incorporated|AG|Ltd|LLC|Pte\.|GmbH|S\.A\.)/g)].map((m) => m[1]);
    assert.deepEqual(named, []);
    // Company names as written (case-sensitive: «we resend the eSIM» is a verb, not the email company).
    assert.doesNotMatch(t, /eSIM Access|MobiMatter|Yesim|eSIMGo|Airalo|Platega|Flitt|\bTBC\b|Paddle|Lemon Squeezy|FastSpring|Stripe|PayPal|\bRender\b|\bResend\b|ImprovMX|Proton|GitHub|Cloudflare|Yandex/);
    assert.doesNotMatch(t, /esimaccess|mobimatter|platega|flitt|paddle|fastspring|stripe/i);
    // «processed by a third-party payment service» is the pre-launch wording; a NAMED processor is not.
    assert.doesNotMatch(t, /[Pp]ayments are processed by (?!a third-party)/, 'no named payment processor');
    assert.doesNotMatch(t, /our payment provider is|is our Merchant of Record|Merchant of Record is [A-Z]/i, 'no claim that a payment flow runs');
    // LEGAL-4: no possessive MoR either («added by our Merchant of Record» read as if one were connected).
    assert.doesNotMatch(t, /\bour (Merchant of Record|payment provider|payment intermediary)\b/i, 'no MoR or payment provider presented as ours');
    // LEGAL-6 (owner, 2026-10-26): our own policy — no Merchant of Record, seller of record or future payment intermediary at all.
    assert.doesNotMatch(t, /Merchant of Record|seller of record|payment intermediary|reseller of record/i, 'no MoR / intermediary');
  });
}

test('the Terms and the Refund Policy say the same thing where they meet', () => {
  const terms = text(TERMS.sections.map((s) => s.html).join(' '));
  const refund = text(REFUND.sections.map((s) => s.html).join(' '));
  for (const t of [terms, refund]) assert.match(t, /International payments are currently unavailable/);
  assert.match(terms, /The Refund Policy is part of these Terms/);
  assert.match(refund, /This policy is part of our Terms of Service/);
  assert.match(terms, /We reply on business days and aim to send a first reply within 1–2 business days/);
  assert.match(refund, /We reply on business days and aim to send a first reply within 1–2 business days/);
});

/* ------------------------------------------------------------------ 3. footers */

// LEGAL-4: every language links its OWN version of the three documents (English: /en/…; the others their translation,
// seo/legal-i18n.mjs), never a Russian one.
const HTML_LANG = { en: 'en', es: 'es', de: 'de', fr: 'fr', 'zh-Hans': 'zh-Hans', ko: 'ko' };
test('every international footer links the three documents in its own language, and no Russian one', () => {
  assert.deepEqual(INTL_LEGAL, { terms: '/en/terms/', refund: '/en/refund/', privacy: '/en/privacy/' });
  for (const [code, prefix] of LANGS) {
    assert.deepEqual(legalLinks(code).map((l) => l.href), ['/en/terms/', '/en/refund/', '/en/privacy/'], code);
    const W = SITE.DICT[code];
    for (const rel of pagesUnder(prefix).filter((p) => !p.startsWith('en/') || prefix === 'en')) {
      const h = read(rel);
      const foot = h.slice(h.indexOf('<footer'));
      for (const k of ['terms', 'refund', 'privacy']) {
        assert.ok(foot.includes(`<a href="/${prefix}/${k}/" hreflang="${HTML_LANG[code]}" data-i18n="footer.${k}">${W[`footer.${k}`]}</a>`), `${rel}: footer ${k}`);
      }
      assert.doesNotMatch(foot, /href="\/(terms|privacy)\.html"/, `${rel}: a Russian document`);
    }
  }
});

/* ------------------------------------------------------------------ 4. the consents */

test('every language: both consent texts present, every link placeholder kept once, the document names translated', () => {
  for (const [code] of LANGS) {
    const W = SITE.DICT[code];
    for (const k of ['consent.legend', 'consent.terms', 'consent.termsLink', 'consent.refundLink', 'consent.delivery', 'consent.privacy', 'consent.privacyLink', 'footer.refund']) {
      assert.ok(typeof W[k] === 'string' && W[k].trim(), `${code} ${k}`);
    }
    for (const [k, names] of [['consent.terms', ['terms', 'refund']], ['consent.privacy', ['privacy']]]) {
      const found = [...W[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      assert.deepEqual(found, names.slice().sort(), `${code} ${k}: {${names.join('}, {')}} exactly once each`);
    }
    if (code !== 'en') {
      for (const k of ['consent.terms', 'consent.delivery', 'consent.termsLink', 'consent.refundLink']) assert.notEqual(W[k], SITE.DICT.en[k], `${code} ${k}: not translated`);
    }
  }
});

test('the second box says, in English, exactly what Refund Policy §4.2 quotes', () => {
  const refund = REFUND.sections.map((s) => s.html).join('\n');
  const quoted = refund.match(/<blockquote>\s*<p>“([^”]+)”<\/p>\s*<\/blockquote>/)[1].replace(/’/g, "'");
  assert.equal(SITE.DICT.en['consent.delivery'], quoted);
  assert.match(text(refund), /at checkout we ask you to tick a separate box\. It is never pre-ticked\./);
});

test('every checkout window: two separate boxes, unticked, before the disabled payment button; each document its own new-tab link', () => {
  for (const [code, prefix] of LANGS) {
    const W = SITE.DICT[code];
    const h = read(`${prefix}/esim/uae/index.html`);
    const box = h.slice(h.indexOf('<fieldset class="co-consents"'), h.indexOf('</fieldset>') + 11);
    assert.ok(box.length > 100, `${code}: the consent block`);
    assert.ok(h.indexOf('id="coConsents"') < h.indexOf('id="coPay"'), `${code}: before the payment button`);
    assert.ok(h.indexOf('id="coFinal"') < h.indexOf('id="coConsents"'), `${code}: after the status note`);
    assert.match(h, /<button type="button" class="btn" id="coPay" disabled aria-disabled="true"/, `${code}: the button is disabled in the markup`);
    const inputs = [...box.matchAll(/<input [^>]*>/g)].map((m) => m[0]);
    assert.equal(inputs.length, 2, `${code}: exactly two boxes`);
    assert.ok(inputs.every((i) => /type="checkbox"/.test(i) && !/\bchecked\b/.test(i) && !/\brequired\b/.test(i) === true), `${code}: never pre-ticked`);
    assert.match(inputs[0], /id="coAgreeTerms" data-terms-version="[^"]+" data-refund-version="[^"]+"/);
    assert.match(inputs[1], /id="coAgreeDelivery"/);
    const labels = [...box.matchAll(/<label class="check">([\s\S]*?)<\/label>/g)].map((m) => m[1]);
    assert.equal(labels.length, 2, `${code}: one label per box`);
    for (const [k, href] of [['termsLink', `/${prefix}/terms/`], ['refundLink', `/${prefix}/refund/`]]) {
      assert.ok(labels[0].includes(`<a href="${href}" target="_blank" rel="noopener" data-i18n="consent.${k}">${W[`consent.${k}`]}</a>`), `${code}: ${k}`);
    }
    assert.ok(labels[1].includes(W['consent.delivery']), `${code}: the request text`);
    assert.doesNotMatch(labels[1], /<a /, `${code}: the request is its own box, no document in it`);
    assert.ok(box.includes(`<a href="/${prefix}/privacy/" target="_blank" rel="noopener" data-i18n="consent.privacyLink">${W['consent.privacyLink']}</a>`), `${code}: Privacy linked`);
  }
});

test('no Russian page carries the international consents', () => {
  for (const rel of ['index.html', 'esim/uae/index.html', 'esim/turkey/index.html']) {
    assert.doesNotMatch(read(rel), /coConsents|coAgreeTerms|coAgreeDelivery|consent\.delivery/, rel);
  }
});

/* ------------------------------------------------------------------ 5. en/checkout.js */

test('en/checkout.js: payments off by a constant; the gate needs both boxes, both versions and open payments', () => {
  const SRC = read('en/checkout.js');
  assert.match(SRC, /\n {2}var PAYMENTS_OPEN = false;\n/);
  assert.equal((SRC.match(/PAYMENTS_OPEN\s*=/g) || []).length, 1, 'assigned once, never switched at run time');
  const CO = require(join(ROOT, 'en/checkout.js'));
  const base = { paymentsOpen: true, terms: true, delivery: true, termsVersion: TERMS_VERSION, refundVersion: REFUND_VERSION };
  assert.equal(CO.payAllowed(base), true, 'the gate can open');
  for (const [k, v] of [['paymentsOpen', false], ['terms', false], ['delivery', false], ['termsVersion', ''], ['refundVersion', ''], ['terms', 'yes'], ['paymentsOpen', 'true']]) {
    assert.equal(CO.payAllowed({ ...base, [k]: v }), false, `${k}=${JSON.stringify(v)}`);
  }
  assert.equal(CO.payAllowed(null), false);
});

test('en/checkout.js: the consent record cannot be built around the gate; the script never touches the payment button or a payment path', () => {
  const SRC = read('en/checkout.js');
  const CO = require(join(ROOT, 'en/checkout.js'));
  const doc = (terms, delivery) => ({ getElementById: (id) => ({
    coAgreeTerms: { checked: terms, getAttribute: (a) => (a === 'data-terms-version' ? TERMS_VERSION : REFUND_VERSION) },
    coAgreeDelivery: { checked: delivery, getAttribute: () => null },
  })[id] || null });
  for (const [t, d] of [[false, false], [true, false], [false, true], [true, true]]) {
    assert.throws(() => CO.consentRecord(doc(t, d)), /CONSENT_REQUIRED/, `terms=${t} delivery=${d}: payments are off`);
    assert.deepEqual(CO.consentState(doc(t, d)), { paymentsOpen: false, terms: t, delivery: d, termsVersion: TERMS_VERSION, refundVersion: REFUND_VERSION });
  }
  assert.doesNotMatch(SRC, /coPay/, 'never touches the payment button');
  assert.doesNotMatch(SRC.replace(/\/\/.*$/gm, ''), /global\/orders|retail-orders|\/payments?\b|platega|flitt|checkout\.session/i, 'no order or payment path');
  assert.equal((SRC.match(/fetch\(|XMLHttpRequest|sendBeacon/g) || []).length <= 1, true, 'one network call: the quote');
});

/* ------------------------------------------------------------------ LEGAL-4: taxes, and the three documents agree */

test('Terms §6.1: taxes may be added at checkout and the total is shown before payment — no Merchant of Record named', () => {
  const t = text(TERMS.sections.map((x) => x.html).join(' '));
  assert.match(t, /applicable taxes may be calculated and added at checkout\./);
  assert.match(t, /The total amount payable, including any applicable taxes, will be displayed before you confirm the payment\./);
  assert.doesNotMatch(t, /Merchant of Record during checkout/);
});

