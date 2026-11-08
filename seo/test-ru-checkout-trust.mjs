// The trust lines under the pay button of the Russian checkout (P1-3, owner 2026-11-08; MAGIC_ESIM_P1-3_TRUST_BLOCK_PROPOSAL_2026-11-08.md).
//
// Two lines in seo/ru-checkout-markup.mjs, after «Оплата через Platega…»: a refund line that says ONLY what section 6
// of the Russian user agreement (/terms.html#s6 — the document the checkout's consent box names) says, and the support
// contacts. What must hold:
//   * the wording is exactly the approved one, on every Russian country page, below the pay button, outside the consent box;
//   * every statement of the refund line stands on a sentence of /terms.html §6 — if the agreement changes, this fails
//     and the line is rewritten (never the premise loosened);
//   * the line never widens the terms: no promise to return money, no period, no guarantee;
//   * the Telegram contact is the support bot the Mini App already uses.
// Run: node --test seo/test-ru-checkout-trust.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RU_CHECKOUT_MODAL } from './ru-checkout-markup.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const text = (html) => html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const REFUND = '<p class="checkout-note">Возврат: после выдачи данных для установки eSIM деньги, как правило, не возвращаются. Если eSIM не выдана по нашей технической вине или заказ не обработан после оплаты, возврат рассматривается индивидуально — <a href="/terms.html#s6" target="_blank" rel="noopener">раздел 6 соглашения</a>.</p>';
const SUPPORT = '<p class="checkout-note">Вопросы до или после оплаты — в Telegram <a href="https://t.me/magic_esim_support_bot" target="_blank" rel="noopener">@magic_esim_support_bot</a> или на <a href="mailto:support@magicesim.store">support@magicesim.store</a>.</p>';
const PLATEGA = '<p class="checkout-note">Оплата через Platega: СБП или российская банковская карта. Данные eSIM придут на указанный email.</p>';

test('the approved lines, in order, under the pay button and outside the consent box', () => {
  const m = RU_CHECKOUT_MODAL;
  for (const s of [REFUND, SUPPORT, PLATEGA]) assert.equal(m.split(s).length, 2, `exactly once: ${s.slice(0, 60)}`);
  const at = (s) => m.indexOf(s);
  assert.ok(at('id="coConsent"') < at('id="coPay"'), 'consent box above the pay button (unchanged)');
  assert.ok(at('id="coPay"') < at(PLATEGA) && at(PLATEGA) < at(REFUND) && at(REFUND) < at(SUPPORT), 'pay → Platega → refund → support');
  assert.ok(at(SUPPORT) < at('</form>'), 'inside the checkout form, before its end');
  const consent = m.slice(at('<label class="checkout-consent">'), m.indexOf('</label>', at('<label class="checkout-consent">')));
  assert.doesNotMatch(consent, /Возврат|Telegram/, 'nothing of it is part of the consent');
  assert.equal((m.match(/type="checkbox"/g) || []).length, 1, 'still exactly one required box');
});

test('every Russian country page carries the window with the lines', () => {
  const dir = join(ROOT, 'ru/esim');
  let pages = 0;
  for (const slug of readdirSync(dir)) {
    const f = join(dir, slug, 'index.html');
    if (!existsSync(f)) continue;
    const html = readFileSync(f, 'utf8');
    if (!html.includes('id="checkoutModal"')) continue;
    pages++;
    assert.ok(html.includes(RU_CHECKOUT_MODAL), `${slug}: the window is not the generator's`);
  }
  assert.ok(pages >= 150, `pages with the window: ${pages}`);
});

test('the premise: each statement of the refund line is a sentence of /terms.html section 6', () => {
  const terms = read('terms.html');
  const s6 = terms.slice(terms.indexOf('id="s6"'), terms.indexOf('id="s7"'));
  assert.ok(s6.length > 200 && /6\. Возвраты/.test(s6), 'section 6 is found by its anchor (the link goes to /terms.html#s6)');
  const t = text(s6);
  // «после выдачи данных для установки eSIM деньги, как правило, не возвращаются»
  assert.ok(t.includes('После предоставления пользователю QR-кода, кода активации или иных данных для установки eSIM возврат денежных средств, как правило, не производится'), '6.1');
  // «Если eSIM не выдана по нашей технической вине или заказ не обработан после оплаты, возврат рассматривается индивидуально»
  assert.ok(t.includes('Возврат может быть рассмотрен индивидуально, если'), '6.2 — individually');
  assert.ok(t.includes('eSIM не была предоставлена пользователю по технической вине Magic eSIM'), '6.2 — not delivered by our technical fault');
  assert.ok(t.includes('оплата прошла, но заказ не был обработан'), '6.2 — paid, not processed');
  assert.ok(t.includes('Решение о возврате принимается индивидуально'), '6.5');
});

test('the refund line never widens the terms', () => {
  const t = text(REFUND);
  assert.match(t, /как правило/, 'keeps «как правило» of 6.1');
  assert.match(t, /рассматривается индивидуально/, 'a case is considered, not promised');
  for (const bad of [/верн[её]м/i, /гарант/i, /\d+\s*(дн|дней|час)/i, /в течение/i, /полн(ый|ую|остью)/i, /любой карт/i, /безусловн/i, /всегда/i]) {
    assert.doesNotMatch(t, bad, String(bad));
  }
  assert.doesNotMatch(text(SUPPORT), /круглосуточн|24\/7|в течение|ответим/i, 'no response time is promised');
});

test('the Telegram contact is the support bot the Mini App already links', () => {
  assert.match(read('app/ui.js'), /const SUPPORT_BOT = 'https:\/\/t\.me\/magic_esim_support_bot';/);
  assert.ok(SUPPORT.includes('href="https://t.me/magic_esim_support_bot"'));
  assert.ok(SUPPORT.includes('href="mailto:support@magicesim.store"'));
  assert.match(read('terms.html'), /support@magicesim\.store/, 'the address the agreement names');
});
