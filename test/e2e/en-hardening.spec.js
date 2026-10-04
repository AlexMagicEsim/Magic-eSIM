'use strict';

/*
 * English storefront hardening, in a real browser at 390 and 320:
 *   D1   GLOBAL never reaches the fallback gateway — not even when Render fails;
 *        a failed load offers «Try again», and only a click retries.
 *   a11y the checkout dialog takes focus, keeps Tab inside, returns focus.
 *   UX   look-alike plans are told apart by what actually differs.
 *   CSP  the page runs a whole quote flow without a single CSP violation.
 */

const { test, expect } = require('@playwright/test');

const PRIMARY = 'https://esim-backend-3wmu.onrender.com';
const GATEWAY = 'api.magicesim.store';

const base = { coverage_country_codes: ['JP'], country_code: 'JP', region: 'JP', currency: 'USD', plan_type: 'FIXED_VOLUME' };
const PACKAGES = [
  // Two look-alikes: same coverage, volume, term and price — different exit and operators.
  { ...base, package_id: '11111111-0000-4000-8000-000000000001', name: 'Japan 3GB 15Days A', data_gb: 3, validity_days: 15,
    price: 4.99, ip_export: ['HK'], networks: [{ operator: 'Docomo' }], network_technologies: ['4G', '5G'] },
  { ...base, package_id: '11111111-0000-4000-8000-000000000002', name: 'Japan 3GB 15Days B', data_gb: 3, validity_days: 15,
    price: 4.99, ip_export: ['SG'], networks: [{ operator: 'KDDI' }, { operator: 'SoftBank' }], network_technologies: ['4G', '5G'] },
  // Two daily look-alikes whose only difference is the published speed after the allowance.
  { ...base, package_id: '11111111-0000-4000-8000-000000000003', name: 'Japan 1GB/Day', plan_type: 'DAILY', daily_term_mode: 'PER_DAY',
    daily_gb: 1, data_gb: 0, price: 1.99, daily_throttle_label: '512 Kbps', term_prices: [{ days: 3, price: 4.99 }] },
  { ...base, package_id: '11111111-0000-4000-8000-000000000004', name: 'Japan 1GB/Day FUP1Mbps', plan_type: 'DAILY', daily_term_mode: 'PER_DAY',
    daily_gb: 1, data_gb: 0, price: 1.99, daily_throttle_label: '1 Mbps', term_prices: [{ days: 3, price: 4.99 }] },
];
const BODY = JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: PACKAGES });

async function open(page, { catalogue = () => ({ status: 200, body: BODY }) } = {}) {
  const calls = [];
  const csp = [];
  page.on('request', (r) => calls.push({ method: r.method(), url: r.url() }));
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); });
  page.on('pageerror', (e) => { if (/Content Security Policy/i.test(String(e))) csp.push(String(e)); });
  let n = 0;
  await page.route('**/*', (route) => {
    const req = route.request();
    const url = req.url();
    if (url.includes(GATEWAY)) return route.fulfill({ status: 200, contentType: 'application/json', body: BODY });
    if (url.startsWith(PRIMARY) && /\/api\/v1\/retail\/packages\?market=global$/.test(url)) {
      n += 1;
      const r = catalogue(n);
      if (r === 'abort') return route.abort();
      return route.fulfill({ status: r.status, contentType: 'application/json', body: r.body });
    }
    if (url.startsWith(PRIMARY) && /\/api\/v1\/global\/quotes$/.test(url) && req.method() === 'POST') {
      const b = JSON.parse(req.postData());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        quote_id: '3fbced54-1111-4222-8333-444455556666', package_id: b.package_id, days: b.days, currency: 'USD',
        amount: 4.99, expires_at: new Date(Date.now() + 1800000).toISOString() }) });
    }
    if (url.startsWith(PRIMARY)) return route.fulfill({ status: 500, body: 'unexpected' });
    return route.continue();
  });
  await page.goto('/en/esim/japan/');
  return { calls, csp, count: () => n };
}

const gatewayCalls = (calls) => calls.filter((c) => c.url.includes(GATEWAY));

test('D1: Render down → «unavailable» and «Try again»; the gateway is never asked; only a click retries', async ({ page }) => {
  const { calls, count } = await open(page, { catalogue: (n) => (n === 1 ? 'abort' : { status: 200, body: BODY }) });
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
  const retry = page.locator('#retry');
  await expect(retry).toBeVisible();
  await expect(retry).toHaveText('Try again');
  await page.waitForTimeout(1500);
  expect(count()).toBe(1);                       // nothing retried on its own
  await retry.click();
  await expect(page.locator('#status')).toBeHidden();
  await expect(retry).toBeHidden();
  await expect(page.locator('#localGrid .card')).toHaveCount(2);
  expect(count()).toBe(2);
  expect(gatewayCalls(calls)).toEqual([]);
});

test('D1: a 503 from the primary is final — no second road', async ({ page }) => {
  const { calls, count } = await open(page, { catalogue: () => ({ status: 503,
    body: JSON.stringify({ status: 'error', error: 'GLOBAL_PRICING_DISABLED' }) }) });
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
  expect(count()).toBe(1);
  expect(gatewayCalls(calls)).toEqual([]);
});

test('look-alike plans are told apart: exit, operators, and the speed after a daily allowance', async ({ page }) => {
  await open(page);
  const local = page.locator('#localGrid .card');
  await expect(local).toHaveCount(2);
  const chipSets = await local.evaluateAll((cards) => cards.map((c) => [...c.querySelectorAll('.chip')].map((x) => x.textContent)));
  expect(chipSets.map((s) => s.join(' · ')).sort()).toEqual(['IP: Hong Kong · Docomo', 'IP: Singapore · 2 networks']);
  const daily = page.locator('#dailyGrid .card');
  await expect(daily).toHaveCount(2);
  await expect(daily.filter({ hasText: 'Then up to 512 Kbps' })).toHaveCount(1);
  await expect(daily.filter({ hasText: 'Then up to 1 Mbps' })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('the checkout dialog takes focus, keeps Tab inside, and gives focus back on close', async ({ page }) => {
  await open(page);
  const opener = page.locator('#localGrid .card').first().getByRole('button');
  await opener.focus();
  await opener.press('Enter');
  await expect(page.locator('#checkout')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement.id)).toBe('coTitle');
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#checkout .modal'))).toBe(true);
  }
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#checkout .modal'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#checkout')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement.textContent)).toBe('View details');
  await expect(opener).toBeFocused();
});

test('a whole quote flow runs without a single CSP violation, and the buttons are the AA colour', async ({ page }) => {
  const { calls, csp } = await open(page);
  await page.locator('#localGrid .card').first().getByRole('button').click();
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  await page.locator('#coEmail').fill('csp@example.com');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  await expect(page.locator('#coStep3')).toBeVisible();
  expect(csp).toEqual([]);
  expect(await page.locator('#coQuote').evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(74, 104, 232)');
  expect(calls.filter((c) => c.url.startsWith('http') && !c.url.startsWith('http://127.0.0.1') && !c.url.startsWith('http://localhost')
    && !c.url.startsWith(PRIMARY))).toEqual([]);
  expect(gatewayCalls(calls)).toEqual([]);
});

test('a CSP violation would be caught: a request to the gateway from the page is refused', async ({ page }) => {
  const { csp } = await open(page);
  const r = await page.evaluate(async (g) => {
    try { await fetch(`https://${g}/api/v1/retail/packages?market=global`); return 'sent'; } catch (e) { return 'refused'; }
  }, GATEWAY);
  expect(r).toBe('refused');
  expect(csp.length).toBeGreaterThan(0);
});
