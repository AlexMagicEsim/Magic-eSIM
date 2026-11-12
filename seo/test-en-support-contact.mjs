/* English storefront: a visible support contact (2026-10-04).
 *
 * Every English page names support@magicesim.store — the address the GLOBAL
 * delivery email and the Russian terms already use — in its footer, and the
 * troubleshooting guide ends with it. No legal or Contacts page, no other
 * address (the expired magicesim.com domain least of all).
 *
 * Since 2026-11-12 (owner, Payssion onboarding) the English pages also show the
 * support telephone +995 591 021 807 (seo/support-phone.mjs): a tel: line under
 * the email in the footer, and a second button in the home's support band. The
 * hidden language versions and the Russian site never carry it.
 *
 * Run: node --test seo/test-en-support-contact.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN_GUIDES } from './guides-en.mjs';
import { snapshots as legalVersions } from './legal-archive.mjs';
import { COUNTRY_PAGES } from './catalogue-page-count.mjs';
import { isLegacyRedirectFile } from './build-legacy-redirects.mjs';
import { SUPPORT_PHONE, supportPhoneFor } from './support-phone.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function htmlUnder(dir, out = []) {
  for (const d of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (d.isDirectory()) htmlUnder(`${dir}/${d.name}`, out);
    else if (d.name.endsWith('.html')) out.push(`${dir}/${d.name}`);
  }
  return out;
}

// EN-root migration (2026-11-07): the English pages are the root home, /destinations/, /guides/ and the legal pages in en/.
const PAGES = ['index.html', ...htmlUnder('destinations'), ...htmlUnder('guides'), ...htmlUnder('en')].filter((p) => !isLegacyRedirectFile(p));   // not the old addresses' redirect pages
const ADDRESS = 'support@magicesim.store';
const LINK = `<a href="mailto:${ADDRESS}">${ADDRESS}</a>`;
const FOOTER_LINE = `<p class="support">Support: ${LINK}</p>`;
const footerOf = (h) => h.slice(h.indexOf('<footer'), h.indexOf('</footer>'));
const mainOf = (h) => h.slice(h.indexOf('<main'), h.indexOf('</main>'));
const EMAILS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

test('the rule can fire: a footer without the line, or with another address, is caught', () => {
  assert.ok(!footerOf('<footer class="wrap"><p>© Magic eSIM</p></footer>').includes(FOOTER_LINE));
  assert.deepEqual('<p>Email: support@magicesim.com</p>'.match(EMAILS), ['support@magicesim.com']);
});

test('every English page carries the support line in the footer, exactly once', () => {
  assert.equal(PAGES.length, COUNTRY_PAGES + 14 + legalVersions().length, 'the catalogue countries + 3 region pages + destination list + home + guide list + 5 guides + the Privacy Policy (LEGAL-1) + Terms and Refund (LEGAL-3) + the permanent copy of each of their versions (LEGAL-5)');
  const missing = PAGES.filter((p) => !footerOf(read(p)).includes(FOOTER_LINE));
  assert.deepEqual(missing, []);
  const twice = PAGES.filter((p) => read(p).split(FOOTER_LINE).length !== 2);
  assert.deepEqual(twice, []);
});

test('the support line is static English: no i18n key can rewrite it, no script needed to show it', () => {
  for (const p of PAGES) {
    const line = footerOf(read(p)).split('\n').find((l) => l.includes('class="support"'));
    assert.doesNotMatch(line, /data-i18n/, p);
  }
});

test('the troubleshooting guide ends its checklist with the address, in the page and in its source', () => {
  const g = EN_GUIDES.find((x) => x.slug === 'troubleshooting');
  const last = g.sections[g.sections.length - 1];
  assert.equal(last.h2, 'Still not working?');
  assert.ok(last.html.includes(LINK));
  const main = mainOf(read('guides/troubleshooting/index.html'));
  assert.ok(main.includes(LINK), 'rendered inside <main>');
  // No promise the site cannot keep: no reply time, no order or refund wording.
  assert.doesNotMatch(last.html, /\b(hour|day|minute|24\/7|reply|respond|refund|order)\w*/i);
});

test('no other email address appears on any English page', () => {
  const others = new Set();
  for (const p of PAGES) for (const m of read(p).match(EMAILS) || []) if (m !== ADDRESS) others.add(`${p}: ${m}`);
  assert.deepEqual([...others], []);
});

test('the legal pages are the published Privacy Policy, Terms and Refund (LEGAL-1, LEGAL-3); no contact or other legal page exists', () => {
  for (const slug of ['privacy', 'terms', 'refund']) assert.ok(PAGES.includes(`en/${slug}/index.html`), `the pre-launch ${slug} page`);
  for (const slug of ['contact', 'contacts', 'delivery', 'legal']) {
    assert.ok(!PAGES.some((p) => p.startsWith(`en/${slug}/`)), slug);
  }
});

/* ------------------------------------------------------------ the support telephone (2026-11-12) */

const PHONE_LINE = '<p class="support support-phone">Phone: <a href="tel:+995591021807">+995 591 021 807</a></p>';
const HIDDEN_DIRS = ['es', 'de', 'fr', 'zh', 'ko', 'ru'];

test('the number and its tel: link are the owner\'s, and only English shows it', () => {
  assert.deepEqual(SUPPORT_PHONE, { display: '+995 591 021 807', tel: '+995591021807' });
  assert.deepEqual(supportPhoneFor('en'), { label: 'Phone:', display: '+995 591 021 807', href: 'tel:+995591021807' });
  for (const code of ['es', 'de', 'fr', 'zh-Hans', 'ko', 'ru']) assert.equal(supportPhoneFor(code), null, code);
});

test('every English page carries the telephone line in the footer, exactly once, right after the email line', () => {
  const missing = PAGES.filter((p) => !footerOf(read(p)).includes(`${FOOTER_LINE}\n        ${PHONE_LINE}`));
  assert.deepEqual(missing, []);
  const twice = PAGES.filter((p) => read(p).split(PHONE_LINE).length !== 2);
  assert.deepEqual(twice, []);
});

test('the English home\'s support band offers the email and the telephone, both as links', () => {
  const band = read('index.html').split('id="support"')[1].split('</section>')[0];
  assert.match(band, /<a class="btn" href="mailto:support@magicesim\.store">support@magicesim\.store<\/a>/);
  assert.match(band, /<a class="btn" href="tel:\+995591021807">\+995 591 021 807<\/a>/);
});

test('no hidden language version and no Russian page carries the telephone', () => {
  // the rule can fire
  assert.ok(/tel:\+995591021807|591 021 807/.test(PHONE_LINE));
  const found = [];
  for (const dir of HIDDEN_DIRS) {
    for (const p of htmlUnder(dir)) { const h = read(p); if (/tel:\+995591021807|591 021 807/.test(h)) found.push(p); }
  }
  for (const p of ['terms.html', 'privacy.html']) { try { if (/591 021 807/.test(read(p))) found.push(p); } catch { /* absent */ } }
  assert.deepEqual(found, []);
});

test('the legal documents do not carry the telephone (a phone in the Terms would be a new version)', () => {
  for (const p of PAGES.filter((x) => /^en\/(terms|refund|privacy)\//.test(x))) {
    assert.doesNotMatch(mainOf(read(p)), /591 021 807|tel:/, p);
  }
});
