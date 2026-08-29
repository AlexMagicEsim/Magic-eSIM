// Which Telegram bot each storefront link opens (migration 2026-08-29).
//
// The Mini App moved from @magic_esim_support_bot to @magicesim_bot; the
// support button did NOT. Both halves are asserted here because the two
// usernames differ by one underscore, and a link that opens the wrong bot looks
// completely normal until a customer tries to buy something from a support desk.
//
// Run: node --test seo/test-telegram-bots.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

const MAIN = 'magicesim_bot';
const SUPPORT = 'magic_esim_support_bot';

// Strip comments so a note ABOUT the old bot cannot satisfy or break an
// assertion about links TO it.
const code = (s) => s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, ' ');

test('every Mini App entry point on the site opens the MAIN bot', () => {
  const index = code(read('index.html'));
  const links = [...index.matchAll(/https:\/\/t\.me\/([A-Za-z0-9_]+)\?startapp[^"']*/g)];
  assert.ok(links.length >= 2, 'the nav and hero entry points both exist');
  for (const [full, who] of links) {
    assert.equal(who, MAIN, `${full} must open the main bot`);
  }
});

test('the post-payment returns open the MAIN bot', () => {
  const pay = code(read('payment-success.html'));
  assert.match(pay, new RegExp(`https://t\\.me/${MAIN}\\?startapp=esims`));
  assert.match(pay, new RegExp(`https://t\\.me/${MAIN}\\?startapp=o_`));
  assert.ok(!new RegExp(`t\\.me/${SUPPORT}\\?startapp`).test(pay), 'no startapp link may point at support');
});

test('the support button in the Mini App still opens the SUPPORT bot', () => {
  const ui = code(read('app/ui.js'));
  assert.match(ui, new RegExp(`const SUPPORT_BOT = 'https://t\\.me/${SUPPORT}'`));
  assert.match(ui, /\$\{SUPPORT_BOT\}\?start=order_/);
  // And it is a ?start= conversation, never a ?startapp= app launch.
  assert.ok(!/SUPPORT_BOT\}\?startapp/.test(ui), 'support is a chat, not a Mini App entry');
});

test('no ?startapp anywhere still names the support bot', () => {
  for (const f of ['index.html', 'payment-success.html', 'payment-failed.html', '404.html', 'app/ui.js', 'app/core.js']) {
    let src;
    try { src = code(read(f)); } catch { continue; }
    assert.ok(
      !new RegExp(`t\\.me/${SUPPORT}\\?startapp`).test(src),
      `${f} still launches the Mini App from the support bot`
    );
  }
});

test('the CHANNEL is a channel — never used as a Mini App entry point', () => {
  const index = code(read('index.html'));
  assert.match(index, /https:\/\/t\.me\/magicesim"/, 'the channel link exists');
  // t.me/magicesim (channel) must never carry ?startapp — it has no Mini App.
  assert.ok(!/t\.me\/magicesim\?startapp/.test(index), 'the channel cannot launch an app');
  // And the main bot must not be confused with it: magicesim_bot ≠ magicesim.
  assert.notEqual(MAIN, 'magicesim');
});

test('the three bots are never conflated', () => {
  const index = code(read('index.html'));
  // The ADMIN alert bot must appear nowhere on a customer-facing page.
  assert.ok(!/t\.me\/magic_esim_bot/.test(index), 'the admin bot is not a customer surface');
});
