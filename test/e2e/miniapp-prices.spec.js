'use strict';

/*
 * One price from the tariff card to the pay button (owner report 2026-10-20, production).
 *
 * Italy «1 ГБ в день», 30 days: the header said 3 150 ₽, «Купить» said 400 ₽ (the 3-day term) and, on the checkout,
 * «К оплате 3 150 ₽» sat above «Оплатить 150 ₽» (ONE day). The order and the payment were right — the server prices the
 * term and asserts the app's expected amount — but every button the customer reads must name the same number:
 *   1. the term picker's callback was `(t) =>`, shadowing the translation function `t()`, so a tap threw after the
 *      header moved and the buy button kept the first term;
 *   2. the pay button was labelled with the row's price (one day of a daily plan) until the consent box was ticked;
 *   3. a promo applied after consent left the pay button at the pre-promo amount;
 *   4. a promo answer repainted the summary with the row's validity_days (null on a daily row) — «· 0 дней».
 * The rows are a frozen copy of the catalogue (test/fixtures/miniapp-price-rows.json), so a price move cannot turn this red.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const ROWS = require('../fixtures/miniapp-price-rows.json');
const { installMiniApp, openApp } = require('./harness.js');

const DAILY = ROWS.find((r) => r.plan_type === 'DAILY');
const REGULAR = ROWS.find((r) => r.plan_type !== 'DAILY');
const rub = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
const digits = (s) => Number(String(s).replace(/\D/g, ''));

async function toItaly(page) {
  await openApp(page);
  await page.fill('#search', 'Италия');
  await page.locator('#screen-home .card--row, #screen-home .tile', { hasText: 'Италия' }).first().click();
  await expect(page.locator('#screen-country[data-active]')).toBeVisible();
}
const total = (page) => page.locator('#checkout-summary .checkout-total strong');
const pay = (page) => page.locator('#checkout-pay');
async function applyCode(page, code) {
  const open = page.locator('#screen-checkout').getByText(/Ввести промокод/);
  if (await open.count()) await open.first().click();
  await page.locator('#screen-checkout .promo__row input').fill(code);
  await page.locator('#screen-checkout .promo__row .promo__act').click();
  // Wait for the ANSWER (a refusal message or the applied state) — asserting before it lands passes on the pre-answer screen.
  await expect(page.locator('#screen-checkout .promo__err, #screen-checkout .promo__act:has-text("Удалить")').first()).toBeVisible();
}

test('daily plan: every term moves the header and «Купить» together; the checkout and the pay button say the term\'s price', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  // The server refuses a promo on a per-day plan (PROMO_CODE_NOT_APPLICABLE): an answer the app must survive unchanged.
  await installMiniApp(page, { packages: ROWS, promoQuote: { valid: false, error: 'PROMO_CODE_NOT_APPLICABLE' } });
  await toItaly(page);
  await page.locator('#screen-country .card--daily').first().click();
  await expect(page.locator('#tariff-buy')).toBeVisible();

  for (const term of DAILY.term_prices) {
    await page.locator('.daily-term', { hasText: new RegExp(`^\\s*${term.days}\\s`) }).first().click();
    expect(digits(await page.locator('#tariff-price').textContent()), `header, ${term.days} days`).toBe(term.price);
    expect(digits(await page.locator('#tariff-buy').textContent()), `«Купить», ${term.days} days`).toBe(term.price);
  }
  expect(errors).toEqual([]);

  const last = DAILY.term_prices[DAILY.term_prices.length - 1];   // 30 days, as reported
  await page.locator('#tariff-buy').click();
  await expect(page.locator('#screen-checkout[data-active]')).toBeVisible();
  await expect(page.locator('#checkout-summary')).toContainText(`· ${last.days} дней`);
  await expect(total(page)).toHaveText(rub(last.price));
  await expect(pay(page)).toHaveText(`Оплатить ${rub(last.price)}`);     // before consent: was «Оплатить 150 ₽» (one day)
  await expect(pay(page)).toBeDisabled();

  await page.locator('#checkout-terms').check();
  await expect(pay(page)).toHaveText(`Оплатить ${rub(last.price)}`);
  await expect(pay(page)).toBeEnabled();

  await applyCode(page, 'TEST10');
  await expect(page.locator('#checkout-summary')).toContainText(`· ${last.days} дней`);   // was «· 0 дней»
  await expect(total(page)).toHaveText(rub(last.price));
  await expect(pay(page)).toHaveText(`Оплатить ${rub(last.price)}`);
  expect(errors).toEqual([]);
});

test('regular plan: a promo applied after consent moves «К оплате» and the pay button together; removing it moves both back', async ({ page }) => {
  const price = REGULAR.price; const discount = Math.round(price * 0.1); const final = price - discount;
  await installMiniApp(page, { packages: ROWS, promoQuote: { valid: true, promo_code: 'TEST10', original_amount_rub: price, discount_amount_rub: discount, final_amount_rub: final } });
  await toItaly(page);
  await page.locator('#screen-country .card--tariff:not(.card--daily)').first().click();
  await expect(page.locator('#tariff-buy')).toHaveText(`Купить за ${rub(price)}`);
  await page.locator('#tariff-buy').click();
  await expect(total(page)).toHaveText(rub(price));
  await expect(pay(page)).toHaveText(`Оплатить ${rub(price)}`);

  await page.locator('#checkout-terms').check();
  await applyCode(page, 'TEST10');
  await expect(total(page)).toHaveText(rub(final));
  await expect(pay(page)).toHaveText(`Оплатить ${rub(final)}`);           // was the pre-promo amount
  await expect(pay(page)).toBeEnabled();

  await page.locator('#screen-checkout .promo__act', { hasText: 'Удалить' }).click();
  await expect(total(page)).toHaveText(rub(price));
  await expect(pay(page)).toHaveText(`Оплатить ${rub(price)}`);
});
