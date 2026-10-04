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

test('all 206 English pages carry the support line in the footer, exactly once', () => {
  assert.equal(PAGES.length, 206, '198 countries + destination list + home + guide list + 5 guides');
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

test('no legal or contact page was created', () => {
  for (const slug of ['contact', 'contacts', 'terms', 'privacy', 'refund', 'delivery', 'legal']) {
    assert.ok(!PAGES.some((p) => p.startsWith(`en/${slug}/`)), slug);
  }
});
