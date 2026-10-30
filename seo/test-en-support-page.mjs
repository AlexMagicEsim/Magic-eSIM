/* The English support page — /en/support/ (seo/support-en.mjs, built by seo/build-locale-pages.mjs, 2026-10-30).
 *
 * What it must be: English only (no twin, no hreflang, out of the sitemap, noindex like the legal pages); the frame of
 * every English page (skip link first, the header, the payment bar, the footer, the strict CSP, no counter); ONE
 * contact — support@magicesim.store as a mailto — and no Telegram; links to the three legal documents and the five
 * guides; every sentence that restates a document found word for word in that document; nothing the guide claim rules
 * forbid. And the footer of EVERY English page links it — no other language's page does.
 *
 * Run: node --test seo/test-en-support-page.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORT, SUPPORT_PATH, SUPPORT_FOOTER_LINK } from './support-en.mjs';
import { TERMS } from './terms-en.mjs';
import { REFUND } from './refund-en.mjs';
import { PRIVACY } from './privacy-en.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { rulesFor, CLAIM_GUARDS } from './claim-guards.mjs';
import { localeGenerator } from './build-locale-pages.mjs';
import { LOCALES } from './locales.mjs';
import { stampHtml } from './asset-version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const FILE = 'en/support/index.html';
const HTML = read(FILE);
const head = HTML.slice(0, HTML.indexOf('</head>'));
const main = HTML.slice(HTML.indexOf('<main'), HTML.indexOf('</main>'));
const footerOf = (h) => h.slice(h.indexOf('<footer'), h.indexOf('</footer>'));
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
// Inline tags join their words; every other tag separates them.
const text = (html) => decode(html.replace(/<\/?(strong|em|a|time)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const docText = (D) => text(D.sections.map((x) => x.html).join(' '));
const MAIN_TEXT = text(main);

function htmlUnder(dir, out = []) {
  for (const d of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (['node_modules', '.git', '.claude', 'test', 'seo', 'scripts', 'infra', '_site'].includes(d.name)) continue;
    const rel = dir === '.' ? d.name : `${dir}/${d.name}`;
    if (d.isDirectory()) htmlUnder(rel, out);
    else if (d.name.endsWith('.html')) out.push(rel);
  }
  return out;
}

/* ------------------------------------------------------------------ 1. the page and its head */

test('the page exists at /en/support/ with its title, description, canonical and robots', () => {
  assert.equal(SUPPORT_PATH, '/en/support/');
  assert.ok(existsSync(join(ROOT, FILE)));
  const title = head.match(/<title>([^<]*)<\/title>/)[1];
  assert.equal(decode(title), 'Support — Magic eSIM');
  assert.ok(decode(title).length <= 60, 'title ≤ 60 characters');
  const description = decode(head.match(/<meta name="description" content="([^"]*)">/)[1]);
  assert.equal(description, SUPPORT.description);
  assert.ok(description.length <= 155, `description ≤ 155 characters (${description.length})`);
  assert.match(description, /International payments are currently unavailable\./);
  assert.match(head, /<link rel="canonical" href="https:\/\/magicesim\.store\/en\/support\/">/);
  assert.match(head, /<meta property="og:url" content="https:\/\/magicesim\.store\/en\/support\/">/);
  // Like the legal pages: offered to readers, not to search engines; no twin, so no hreflang and no sitemap entry.
  assert.match(head, /<meta name="robots" content="noindex, follow">/);
  assert.equal(read('en/terms/index.html').includes('<meta name="robots" content="noindex, follow">'), true, 'the legal pages it matches');
  assert.doesNotMatch(HTML, /<link rel="alternate"/);
  assert.doesNotMatch(read('sitemap.xml'), /\/en\/support\//);
  assert.equal(HTML.match(/<h1>/g).length, 1);
  assert.match(main, /<h1>Support<\/h1>/);
  assert.match(main, /<p class="crumbs"><a href="\/en\/">Magic eSIM<\/a> › Support<\/p>/, 'crumbs like the legal pages');
});

test('the frame of every English page: skip link first, header, payment bar, footer, strict CSP, no counter, no script but the logo', () => {
  const g = localeGenerator('en');
  const body = HTML.slice(HTML.indexOf('<body>') + '<body>'.length).trimStart();
  assert.ok(body.startsWith('<a class="skip" href="#main">'), 'the skip link is the first thing in <body>');
  assert.match(HTML, /<main class="guide support" id="main" tabindex="-1">/);
  assert.ok(HTML.includes(g.PAYBAR), 'the payment bar');
  assert.ok(HTML.includes(g.FOOTER), 'the generator\'s footer');
  assert.equal(HTML, stampHtml(g.supportPage(), join(ROOT, 'en', 'support')), 'the committed page is the generator\'s, byte for byte');
  const csp = head.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)[1];
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(HTML, /mc\.yandex|metrika|ym\(|googletagmanager|gtag\(/i, 'no counter on /en/');
  const scripts = [...HTML.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  assert.deepEqual(scripts.map((s) => (s.match(/src="([^"?]+)/) || [, 'INLINE'])[1]), ['/assets/logo-once.js']);
  assert.doesNotMatch(HTML, /<script>(?!<\/script>)/, 'no inline script');
});

test('the generator refuses a support page in any other language', () => {
  for (const code of LOCALES.filter((l) => l.prefix && l.site.enabled && l.code !== 'en').map((l) => l.code)) {
    assert.equal(localeGenerator(code).supportPage, undefined, code);
    assert.ok(!existsSync(join(ROOT, `${LOCALES.find((l) => l.code === code).prefix}/support/index.html`)), `${code}: no page`);
  }
  assert.ok(!existsSync(join(ROOT, 'support/index.html')) && !existsSync(join(ROOT, 'support.html')), 'no Russian page');
});

test('the language switch leads to pages that exist: this page in English, every other language to its home', () => {
  const sw = HTML.slice(HTML.indexOf('<ul class="langmenu-list">'), HTML.indexOf('</ul>', HTML.indexOf('<ul class="langmenu-list">')));
  const hrefs = [...sw.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 1);
  for (const h of hrefs) {
    const file = h === '/' ? 'index.html' : `${h.slice(1)}index.html`;
    assert.ok(existsSync(join(ROOT, file)), `${h} exists`);
    assert.ok(h === '/' || /^\/[a-z]+\/$/.test(h), `${h} is a home`);
  }
});

/* ------------------------------------------------------------------ 2. what it says */

test('the six sections, in order', () => {
  const h2 = [...main.matchAll(/<h2 id="[^"]+">([^<]+)<\/h2>/g)].map((m) => decode(m[1]));
  assert.deepEqual(h2, ['Contact Support', 'Order & Payment Issues', 'eSIM Installation & Activation',
    'Connectivity & Roaming Issues', 'Refunds', 'Information Needed for Support']);
});

test('ONE contact: support@magicesim.store as a mailto; no Telegram, no phone, no other address', () => {
  assert.ok(main.includes('<a href="mailto:support@magicesim.store">support@magicesim.store</a>'));
  const mails = new Set([...HTML.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g)].map((m) => m[0]));
  assert.deepEqual([...mails], ['support@magicesim.store']);
  // The support bot answers English only for an allowlist today — a customer would get Russian. Never list it here.
  assert.doesNotMatch(HTML, /t\.me\/|telegram|tg:\/\/|_bot\b|whatsapp|viber/i);
  assert.doesNotMatch(MAIN_TEXT, /\+\d[\d ()-]{6,}|\bphone:|\bcall us|live chat|chat with us/i);
  // The rule can fire.
  assert.match('<a href="https://t.me/magic_esim_support_bot">', /t\.me\/|telegram|tg:\/\/|_bot\b/i);
});

test('it links the three current legal documents and the five guides', () => {
  for (const href of ['/en/terms/', '/en/refund/', '/en/privacy/']) assert.ok(main.includes(`href="${href}"`), href);
  assert.doesNotMatch(main, /href="\/en\/(terms|refund|privacy)\/v\d/, 'the current documents, never a frozen version');
  for (const g of EN_GUIDES) assert.ok(main.includes(`<a href="/en/guides/${g.slug}/">${g.h1}</a>`), g.slug);
  assert.deepEqual(EN_GUIDES.map((g) => g.slug), ['iphone', 'android', 'compatibility', 'activation', 'troubleshooting']);
  // Every local link of the page lands on a file.
  for (const [, href] of HTML.matchAll(/href="(\/[^"#?]*)/g)) {
    const file = href.endsWith('/') ? `${href.slice(1)}index.html` : href.slice(1);
    assert.ok(existsSync(join(ROOT, file)), `${href} exists`);
  }
});

/* Each sentence below is on the page AND, word for word, in the document named. A document change that drops one makes
 * this test fail — then the page is re-read against the new document, never this list loosened. */
const QUOTED = [
  [TERMS, 'You can email us at any time, 24 hours a day, 7 days a week.'],
  [TERMS, 'We reply on business days and aim to send a first reply within 1–2 business days, usually sooner.'],
  [TERMS, 'You can browse plans and get an exact price on the Website, but you cannot place an order or pay', 'You can browse plans and get an exact price on this website, but you cannot place an order or pay'],
  [TERMS, 'It is not a subscription and does not renew automatically.'],
  [TERMS, 'Delivery is electronic, by email to the address you entered.'],
  [TERMS, 'The eSIM is usually delivered within a few minutes after the payment is confirmed.'],
  [TERMS, 'If you have not received it within 1 hour, check your spam folder and write to us.'],
  [TERMS, 'We resend the eSIM to the address used for the order on request.'],
  [TERMS, 'You need an internet connection, for example Wi-Fi'],
  [TERMS, 'An eSIM can normally be installed only once and only on one device. It cannot be moved to another device.'],
  [TERMS, 'A deleted eSIM usually cannot be restored.'],
  [TERMS, 'Depending on the plan, it is the installation of the eSIM, its first connection to a network, its first use of data, or the purchase.'],
  [TERMS, 'If you do not intend to install the eSIM soon after buying it, ask us for the period of your plan before you pay.'],
  [TERMS, 'Data roaming usually has to be switched on for the Magic eSIM line. Switch it on for the Magic eSIM line only.'],
  [TERMS, 'To avoid charges from your home mobile operator, keep data roaming switched off for your other SIM and choose the Magic eSIM line for mobile data.'],
  [TERMS, 'Websites and apps may therefore see an IP address or location outside the country you are in.'],
  [TERMS, 'Coverage, speed and availability depend on the local operator’s network, your location, your device and its settings, and network load.'],
  [TERMS, 'They do not include a phone number, voice calls or SMS unless the product card says so.'],
  [TERMS, 'The plan may not work until registration is complete.'],
  [TERMS, 'An unregistered device may be blocked by the local networks, whichever eSIM it uses.'],
  [TERMS, 'Please do not delete the eSIM while we are helping you.'],
  [TERMS, 'We try to fix the problem, for example by guiding you through settings, reissuing installation details or providing a replacement eSIM.'],
  [TERMS, 'We never receive or store your full card number or security code.'],
  [TERMS, 'The QR code and installation details give access to your plan.'],
  [TERMS, 'Individual Entrepreneur ALEKSANDR KHARIN'],
  [TERMS, 'are governed by separate terms published there.', 'The Russian-language website magicesim.store is governed by separate terms published there.'],
  [REFUND, 'Paid purchases are not refundable or exchangeable except as required by the law that applies to your purchase or as expressly provided in'],
  [REFUND, 'This policy applies to plans bought once international checkout becomes available.', 'It applies to plans bought once international checkout becomes available.'],
  [REFUND, 'you chose the wrong plan, your device is not compatible, your trip changed, you did not use the eSIM'],
  [REFUND, 'No voluntary refund.', 'there is no voluntary refund.'],
  [PRIVACY, 'when you contact our support team', 'How we handle the information you send us is described in our Privacy Policy.'],
];

test('every restated sentence is in its document word for word, and on the page', () => {
  const docs = new Map([[TERMS, docText(TERMS)], [REFUND, docText(REFUND)], [PRIVACY, docText(PRIVACY)]]);
  for (const [D, inDoc, onPage = inDoc] of QUOTED) {
    assert.ok(docs.get(D).includes(inDoc), `${D.h1}: «${inDoc}»`);
    assert.ok(MAIN_TEXT.includes(onPage), `the page: «${onPage}»`);
  }
});

test('international payments: the page says they are unavailable and never invites an order now', () => {
  assert.ok(MAIN_TEXT.includes('International payments are currently unavailable.'));
  assert.ok(MAIN_TEXT.includes('when international checkout becomes available'));
  assert.doesNotMatch(MAIN_TEXT, /\b(buy now|order now|place your order|checkout now|pay now)\b/i);
  // No refund the Refund Policy does not give: no money-back period, no «no questions asked».
  assert.doesNotMatch(MAIN_TEXT, /\b(14|30)[- ]day|money[- ]back|no questions asked|satisfaction/i);
  // Never asks for what the Terms say must stay private.
  assert.match(MAIN_TEXT, /Never send us a card number or security code, a password, or the eSIM’s QR code or installation details\./);
  // No payment provider, supplier or Russian-site channel by name.
  assert.doesNotMatch(MAIN_TEXT, /platega|flitt|paddle|stripe|paypal|esim access|mobimatter|yesim|mini app/i);
});

test('nothing the guide claim rules forbid, and no 24/7 / instant / guarantee wording', () => {
  const hits = [];
  for (const [id, re] of rulesFor('en', 'guide')) if (re.test(MAIN_TEXT)) hits.push(`${id} «${MAIN_TEXT.match(re)[0]}»`);
  assert.deepEqual(hits, []);
  assert.doesNotMatch(MAIN_TEXT, /24\/7|\binstant|guarantee|\bbest\b|\bfastest|\bcheapest/i);
  assert.ok(CLAIM_GUARDS.en.network.re.test('fast 5G everywhere'), 'the rules can fire');
});

/* ------------------------------------------------------------------ 3. the footer */

test('every English page links /en/support/ in its footer, exactly once, after the legal links', () => {
  const pages = htmlUnder('en');
  assert.ok(pages.length > 200);
  const missing = pages.filter((p) => footerOf(read(p)).split(SUPPORT_FOOTER_LINK).length !== 2);
  assert.deepEqual(missing, []);
  assert.match(footerOf(HTML), /Privacy Policy<\/a> · <a href="\/en\/support\/">Support<\/a><\/p>/);
  // The rule can fire.
  assert.equal(footerOf(read('en/index.html').replace(SUPPORT_FOOTER_LINK, '')).includes(SUPPORT_FOOTER_LINK), false);
});

test('no page in another language, and no Russian page, links /en/support/', () => {
  const others = htmlUnder('.').filter((p) => !p.startsWith('en/') && read(p).includes('/en/support/'));
  assert.deepEqual(others, []);
});
