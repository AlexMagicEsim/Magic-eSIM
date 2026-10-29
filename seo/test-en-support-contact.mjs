/* English storefront: a visible support contact (2026-10-04).
 *
 * Every English page names ONE way to reach a person — support@magicesim.store,
 * the address the GLOBAL delivery email and the Russian terms already use — in
 * its footer, and the troubleshooting guide ends with it. Nothing else: no
 * legal or Contacts page, no seller details, no other address (the expired
 * magicesim.com domain least of all).
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

function htmlUnder(dir, out = []) {
  for (const d of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (d.isDirectory()) htmlUnder(`${dir}/${d.name}`, out);
    else if (d.name.endsWith('.html')) out.push(`${dir}/${d.name}`);
  }
  return out;
}

const PAGES = htmlUnder('en');
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
  const main = mainOf(read('en/guides/troubleshooting/index.html'));
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
