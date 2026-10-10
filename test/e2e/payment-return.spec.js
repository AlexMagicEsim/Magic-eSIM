'use strict';

/*
 * R3-08 — the order token never reaches Yandex Metrika.
 *
 * Platega returns the buyer to /payment-success.html?token=…[&src=tma] and
 * /payment-failed.html?token=…. The counter (webvisor:true) reads location.href
 * the moment `ym(…,'init')` runs. These tests record location.href at exactly
 * that call (window.ym is pre-defined by an init script, so the counter snippet
 * keeps OUR function and calls it synchronously), and check where the token
 * lives afterwards. tag.js and the status API are intercepted: nothing leaves.
 */

const { test, expect } = require('@playwright/test');

const TOKEN = 'TestTokenR308_abcdefghijklmnopqrstuvwxyz012';   // fixture, 43 chars, not a real order
const REF = TOKEN.slice(-6);

async function harness(page, statuses) {
  const status = { calls: [] };
  let i = 0;
  await page.addInitScript(() => {
    window.__ymSeen = [];
    window.ym = function () { window.__ymSeen.push({ href: location.href, args: [].slice.call(arguments, 0, 2) }); };
  });
  await page.route('**/mc.yandex.ru/**', (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('**/api/v1/public/retail-orders/*/status', (r) => {
    status.calls.push(r.request().url());
    const s = statuses[Math.min(i++, statuses.length - 1)];
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: s, paymentStatus: 'confirmed', amountRub: 950, currency: 'RUB', country: 'IT' }) });
  });
  return status;
}

async function leaks(page) {
  return page.evaluate((tok) => ({
    href: location.href.includes(tok),
    local: Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes(tok) || k.includes(tok)),
    session: Object.keys(sessionStorage).some((k) => (sessionStorage.getItem(k) || '').includes(tok) || k.includes(tok)),
    cookie: document.cookie.includes(tok),
    dom: document.documentElement.outerHTML.includes(tok),
  }), TOKEN);
}

test('payment-success: the URL is clean BEFORE ym init; polling uses the token from memory; nothing stores it', async ({ page }) => {
  const status = await harness(page, ['paid', 'completed']);
  await page.goto(`/payment-success.html?utm_source=x&token=${TOKEN}&src=tma#keep`);
  await expect(page.locator('#title')).toHaveText('eSIM готова', { timeout: 15000 });

  const ym = await page.evaluate(() => window.__ymSeen);
  const init = ym.find((c) => c.args[1] === 'init');
  expect(init, 'ym init was called').toBeTruthy();
  expect(init.href).not.toContain('token=');
  expect(init.href).not.toContain('src=');
  expect(init.href).not.toContain(TOKEN);
  expect(init.href).toContain('utm_source=x');      // other params survive
  expect(init.href).toContain('#keep');             // and the hash
  expect(ym.every((c) => !c.href.includes(TOKEN))).toBe(true);

  expect(status.calls.length).toBeGreaterThanOrEqual(2);
  expect(status.calls.every((u) => u.includes(`/retail-orders/${TOKEN}/status`))).toBe(true);
  // src=tma still works from memory: the «back to Telegram» link carries only the 6-char ref
  await expect(page.locator('#actionTelegram')).toHaveAttribute('href', `https://t.me/magicesim_bot?startapp=o_${encodeURIComponent(REF)}`);

  expect(await leaks(page)).toEqual({ href: false, local: false, session: false, cookie: false, dom: false });
  expect(await page.evaluate(() => Object.isFrozen(window.__payBoot) && window.__payBoot.src)).toBe('tma');
});

test('payment-success: F5 keeps polling from this tab\'s history.state, URL still clean, still no storage', async ({ page }) => {
  const status = await harness(page, ['awaiting_payment']);
  await page.goto(`/payment-success.html?token=${TOKEN}`);
  await expect.poll(() => status.calls.length).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => history.state && history.state.t)).toBe(TOKEN);

  const before = status.calls.length;
  await page.reload();
  await expect.poll(() => status.calls.length).toBeGreaterThan(before);
  expect(status.calls.at(-1)).toContain(`/retail-orders/${TOKEN}/status`);
  const init = (await page.evaluate(() => window.__ymSeen)).find((c) => c.args[1] === 'init');
  expect(init.href).not.toContain(TOKEN);
  expect(await leaks(page)).toEqual({ href: false, local: false, session: false, cookie: false, dom: false });
});

test('payment-success: the legacy public_order_token parameter is stripped the same way', async ({ page }) => {
  const status = await harness(page, ['completed']);
  await page.goto(`/payment-success.html?public_order_token=${TOKEN}`);
  await expect.poll(() => status.calls.length).toBeGreaterThanOrEqual(1);
  const init = (await page.evaluate(() => window.__ymSeen)).find((c) => c.args[1] === 'init');
  expect(init.href).not.toContain('public_order_token');
  expect(status.calls[0]).toContain(`/retail-orders/${TOKEN}/status`);
});

test('payment-success: no token anywhere still shows the neutral fallback and calls nothing', async ({ page }) => {
  const status = await harness(page, ['completed']);
  await page.goto('/payment-success.html');
  await expect(page.locator('#title')).toHaveText('Проверяем оплату');
  await page.waitForTimeout(300);
  expect(status.calls).toEqual([]);
});

test('payment-failed: the URL is clean before ym init, and the token is kept nowhere', async ({ page }) => {
  await harness(page, ['canceled']);
  await page.goto(`/payment-failed.html?token=${TOKEN}&src=tma&x=1`);
  const ym = await page.evaluate(() => window.__ymSeen);
  const init = ym.find((c) => c.args[1] === 'init');
  expect(init, 'ym init was called').toBeTruthy();
  expect(init.href).not.toContain('token=');
  expect(init.href).not.toContain('src=');
  expect(init.href).toContain('x=1');
  expect(await page.evaluate(() => [history.state, typeof window.__payBoot])).toEqual([null, 'undefined']);
  expect(await leaks(page)).toEqual({ href: false, local: false, session: false, cookie: false, dom: false });
});
