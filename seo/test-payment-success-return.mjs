// O3 (2026-11-20): /payment-success.html after a payment.
//
// Like /payment-failed.html (O2), it still linked the Russian site the EN-only
// publication of 2026-11-09 hides: a header and footer of /ru/ links, and
// «Вернуться на главную» → /ru/ — «Остаться на сайте» for a Mini App buyer —
// all 404. Pinned here:
//   1. every link of the page leads to something published today; the second
//      button is support, the header and footer are seo/ru-chrome.mjs's
//      payment-return chrome;
//   2. a Mini App return (src=tma) still gets «Вернуться в Telegram» →
//      startapp=o_<last six of the token> — run on the page's own script;
//   3. a website buyer still gets «Открыть в Telegram» on `done` only, and never
//      two Telegram buttons;
//   4. the order display is the same machine: every state, the status endpoint,
//      the polling, the R3-08 bootstrap — unchanged words except the canceled
//      note, which no longer sends the buyer to the hidden tariffs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RU_PAY_RETURN_HEADER, RU_PAY_RETURN_FOOTER, RU_PAY_RETURN_LINKS } from './ru-chrome.mjs';
import { planArtifact } from '../scripts/build-pages-artifact.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = readFileSync(join(ROOT, 'payment-success.html'), 'utf8');
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-XYZ12';
const strip = (h) => h.replace(/<!--[\s\S]*?-->/g, '');

test('1. every link leads to something published today; the second button is support', () => {
  assert.ok(PAGE.includes(RU_PAY_RETURN_HEADER), 'header = RU_PAY_RETURN_HEADER');
  assert.ok(PAGE.includes(RU_PAY_RETURN_FOOTER), 'footer = RU_PAY_RETURN_FOOTER');
  const body = strip(PAGE.slice(PAGE.indexOf('<body>')));
  const hrefs = [...body.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 7, `links read (${hrefs.length})`);
  const allowed = new Set([...RU_PAY_RETURN_LINKS, 'https://t.me/magicesim_bot?startapp=esims']);
  for (const h of hrefs) assert.ok(allowed.has(h), `${h} is not a published destination`);
  assert.doesNotMatch(body, /id="actionHome"|Вернуться на главную|Остаться на сайте/);
  assert.match(body, /<a class="btn secondary" id="actionSupport" href="mailto:support@magicesim\.store">Связаться с поддержкой<\/a>/);
  const published = new Set(planArtifact(ROOT).publish);
  assert.ok(published.has('payment-success.html'));
  assert.equal(published.has('ru/index.html'), false, 'the proof: /ru/ is not published');
});

// The page's own script for the Mini App return, run on a stub DOM.
const TMA = PAGE.match(/\(function \(\) \{\s*\n\s*if \(src !== 'tma'\) return;[\s\S]*?\n\s*\}\)\(\);/);
function runTma(src, token) {
  const made = [];
  const actions = { firstChild: null, insertBefore: (el) => made.push(el) };
  let tmaRemoved = false;
  const document = {
    createElement: () => ({}),
    getElementById: (id) => (id === 'actions' ? actions : id === 'actionTma' ? { remove: () => { tmaRemoved = true; } } : null),
  };
  const orderRef = (t) => String(t || '').slice(-6);
  new Function('document', 'src', 'token', 'orderRef', TMA[0])(document, src, token, orderRef);
  return { made, tmaRemoved };
}

test('2. a Mini App return still goes back to Telegram on THIS order, and only it', () => {
  assert.ok(TMA, 'the src=tma script is there');
  const r = runTma('tma', TOKEN);
  assert.equal(r.made.length, 1);
  assert.equal(r.made[0].id, 'actionTelegram');
  assert.equal(r.made[0].textContent, 'Вернуться в Telegram');
  assert.equal(r.made[0].href, `https://t.me/magicesim_bot?startapp=o_${TOKEN.slice(-6)}`);
  assert.equal(r.tmaRemoved, true, 'never two Telegram buttons');
  assert.equal(runTma('', TOKEN).made.length, 0, 'a website return gets no such button');
  assert.equal(runTma('tma', '').made.length, 0, 'no token, no order to go back to');
});

test('3. the website buyer\'s Telegram entry appears on `done` only', () => {
  assert.match(PAGE, /<a class="btn hide" id="actionTma"\s+href="https:\/\/t\.me\/magicesim_bot\?startapp=esims"/);
  assert.match(PAGE, /if \(key === 'done' && !fromTma\) tmaBtn\.classList\.remove\('hide'\);/);
});

test('4. the order display is unchanged but for the chrome, the second button, the canceled note and the network fallback', () => {
  const before = execFileSync('git', ['show', 'f4a2f7560:payment-success.html'], { cwd: ROOT, encoding: 'utf8' });
  const main = (h) => h.slice(h.indexOf('<main class="svc">'), h.indexOf('</main>'));
  const scripts = (h) => strip(h).match(/<script\b[^>]*>[\s\S]*?<\/script>/g).filter((s) => !/lm-play/.test(s));
  // every state but canceled, the status request, the polling and the goals: byte for byte
  const norm = (h) => scripts(h).join('\n')
    .replace(/canceled:\s+\{ title: 'Платёж не завершён', msg: '[^']*'/, 'CANCELED')
    .replace(/\s*var home = document\.getElementById\('actionHome'\);\n\s*if \(home\) home\.textContent = 'Остаться на сайте';/, '')
    // the poll loop itself is pinned by seo/test-payment-success-net-fallback.mjs
    .replace(/\n\s*(\/\* The network layer, and what to do when it did not load\.|function poll\(\) \{)[\s\S]*?\n      poll\(\);/, '\nPOLL');
  assert.equal(norm(PAGE), norm(before));
  assert.match(PAGE, /canceled:\s+\{ title: 'Платёж не завершён', msg: 'Оплата не была завершена\. Попробовать снова можно в Magic eSIM в Telegram\.'/);
  // the card itself: only the second button changed
  const card = (h) => strip(main(h)).replace(/<a class="btn secondary" id="action(Home|Support)"[^>]*>[^<]*<\/a>/, 'SECOND').replace(/\n[ \t]*(?=\n)/g, '');
  assert.equal(card(PAGE), card(before));
});
