// The English Privacy Policy, /en/privacy/ (LEGAL-1): what the page is, what it states and what it must never state,
// and that every international footer — and no Russian page — links it.
//
//   1. the page: English, its own canonical, noindex, no hreflang, CSP connect-src 'none', no counter, no cookie;
//   2. the facts it states are the pre-launch facts: the seller, the support address, an effective date, «purchases
//      are not yet available»; no claim of a permit, an authorisation or an order/payment flow that does not run;
//   3. EN, ES, DE, FR and ZH footers link it (hreflang="en") and no international page links a Russian legal document;
//   4. the Russian site keeps its own legal links (seo/ru-chrome.mjs, terms.html, privacy.html untouched).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIVACY, PRIVACY_EFFECTIVE } from './privacy-en.mjs';
import { RU_FOOTER } from './ru-chrome.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const PAGE = read('en/privacy/index.html');
const head = PAGE.slice(0, PAGE.indexOf('</head>'));
const main = PAGE.slice(PAGE.indexOf('<main'), PAGE.indexOf('</main>'));
const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

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

/* ------------------------------------------------------------------ 1. the page */

test('the page: English, own canonical, noindex without hreflang, strict CSP, no counter, no cookie', () => {
  assert.match(PAGE, /^<!doctype html>\n<html lang="en">/);
  assert.ok(head.includes(`<title>${PRIVACY.title.replace('—', '—')}</title>`), 'title');
  assert.match(head, /<meta name="description" content="[^"]{50,170}">/, 'a description of search-snippet length');
  assert.ok(head.includes('<link rel="canonical" href="https://magicesim.store/en/privacy/">'), 'its own canonical');
  assert.ok(head.includes('<meta name="robots" content="noindex, follow">'), 'noindex, follow');
  assert.doesNotMatch(head, /rel="alternate"|hreflang=/, 'no hreflang: there is no translation');
  assert.match(head, /http-equiv="Content-Security-Policy" content="[^"]*connect-src 'none'/, 'the page talks to no server');
  assert.doesNotMatch(PAGE, /mc\.yandex|metrika|ym\(|gtag|googletagmanager|document\.cookie/i, 'no counter, no cookie');
  const scripts = [...PAGE.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(scripts.every((s) => /src="\/assets\/logo-once\.js/.test(s)), `only the logo script: ${scripts.join(' ')}`);
  assert.equal((PAGE.match(/<h1>/g) || []).length, 1, 'one h1');
  assert.match(PAGE, /<main class="guide legal" id="main" tabindex="-1">/, 'the skip link target');
  assert.match(PAGE, /<a class="skip" href="#main">Skip to main content<\/a>/, 'the skip link');
});

test('every section is reachable from «On this page», ids are unique', () => {
  for (const s of PRIVACY.sections) {
    assert.ok(PAGE.includes(`<a href="#${s.id}">`), `toc → ${s.id}`);
    assert.equal(PAGE.split(`id="${s.id}"`).length, 2, `one #${s.id}`);
  }
});

/* ------------------------------------------------------------------ 2. what it states */

test('it names the seller, the privacy contact and an effective date', () => {
  const t = text(main);
  assert.match(t, /Individual Entrepreneur ALEKSANDR KHARIN/);
  assert.match(t, /registered in Georgia/);
  assert.match(t, /support@magicesim\.store/);
  assert.match(main, /Effective date: <time datetime="\d{4}-\d{2}-\d{2}">/);
  assert.ok(t.includes(PRIVACY_EFFECTIVE));
});

test('it describes only what runs today: purchases are not available; no order, payment or eSIM delivery flow', () => {
  const t = text(main);
  assert.match(t, /Online purchases are not yet available on the international website\./);
  // No payment provider, no order database, no email delivery service and no eSIM service provider is described as in use.
  assert.doesNotMatch(t, /Platega|Flitt|Paddle|Creem|Stripe|Supabase|Resend|Telegram/);
  assert.doesNotMatch(t, /eSIM (service )?providers?|wholesale|connectivity partner/i, 'the pre-launch policy describes no eSIM supply');
  assert.doesNotMatch(t, /your order (is|was|has been)|we (deliver|send) (your|the) eSIM/i);
  assert.doesNotMatch(t, /\bcookies? (we|are) (set|use)/i);
});

test('no unconfirmed claim: no permit, authorisation, certification or full-compliance statement', () => {
  const t = text(main);
  assert.doesNotMatch(t, /\bpermit\b|authori[sz]ation|authori[sz]ed by|approved by the State Audit Office/i);
  assert.doesNotMatch(t, /fully compliant|complies fully|GDPR[- ]compliant|certified/i);
  assert.doesNotMatch(t, /\[(TBD|CONFIRM|DEPENDS|VERIFY)/, 'no drafting marker');
  // Standard Contractual Clauses are claimed for Render only — the one provider whose published terms are confirmed.
  for (const m of t.matchAll(/[^.]*Standard Contractual Clauses[^.]*\./g)) assert.match(m[0], /Render/, m[0]);
});

test('no link to a Russian legal document from the page itself', () => {
  assert.doesNotMatch(main, /href="\/(terms|privacy)\.html"/);
});

/* ------------------------------------------------------------------ 3. the international footers */

test('EN, ES, DE, FR and ZH: every page links the English Privacy Policy and no Russian legal document', () => {
  for (const dir of ['en', 'es', 'de', 'fr', 'zh']) {
    const pages = pagesUnder(dir);
    assert.ok(pages.length >= 206, `${dir}: ${pages.length} pages`);
    for (const rel of pages) {
      const h = read(rel);
      const footer = h.slice(h.indexOf('<footer'), h.indexOf('</footer>'));
      assert.match(footer, /<a href="\/en\/privacy\/" hreflang="en" data-i18n="footer\.privacy">[^<]+<\/a>/, `${rel}: Privacy Policy link`);
      assert.doesNotMatch(h, /href="\/(terms|privacy)\.html"/, `${rel}: a Russian legal document`);
    }
  }
});

/* ------------------------------------------------------------------ 4. the Russian site is untouched */

test('the Russian site keeps its own legal links', () => {
  assert.match(RU_FOOTER, /<a href="\/terms\.html">Пользовательское соглашение<\/a> · <a href="\/privacy\.html">Политика конфиденциальности<\/a>/);
  assert.match(read('index.html'), /href="\/privacy\.html"/);
  assert.doesNotMatch(read('index.html'), /\/en\/privacy\//);
});
