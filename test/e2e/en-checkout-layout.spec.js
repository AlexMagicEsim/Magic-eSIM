'use strict';

/*
 * The redesigned checkout window (PR 3), in a real browser at 390 and 320
 * (projects) and at desktop width. en/checkout.js is unchanged, so its flow is
 * covered by en-checkout / en-recovery; this file holds the LAYOUT to its
 * promises: the step indicator follows the step, the refusal is visible on
 * every step and given once (in full) on review, phones get a sheet whose
 * action stays on screen and whose backdrop strip still closes it, axe is 0.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PKG = { package_id: '0d504f79-eab1-40dc-891a-c1f60cf11f06', name: 'Thailand 3GB', country_code: 'TH', coverage_country_codes: ['TH'],
  data_gb: 3, validity_days: 15, price: 4.99, currency: 'USD', plan_type: 'FIXED_VOLUME', networks: [{ operator: 'AIS', type: '5G' }] };
const BODY = JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: [PKG] });

async function open(page) {
  const st = { csp: [], errors: [] };
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    else if (m.type() === 'error') st.errors.push(m.text());
  });
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: BODY });
    const b = JSON.parse(req.postData());
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quote_id: '3fbced54-1111-4222-8333-444455556666',
      package_id: b.package_id, days: b.days, currency: 'USD', amount: 4.99, expires_at: new Date(Date.now() + 1800000).toISOString() }) });
  });
  await page.goto('/en/esim/thailand/');
  await page.locator('#localGrid .card').first().getByRole('button').click();
  await expect(page.locator('#checkout')).toBeVisible();
  return st;
}
const toStep2 = async (page) => { await page.locator('#coQuote').click(); await expect(page.locator('#coStep2')).toBeVisible(); };
const toStep3 = async (page) => {
  await toStep2(page);
  await page.locator('#coEmail').fill('traveller@example.com');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  await expect(page.locator('#coStep3')).toBeVisible();
};
const current = (page) => page.locator('.co-steps li').evaluateAll((lis) => lis.map((li) => getComputedStyle(li).borderBottomColor));
const BLUE = 'rgb(66, 103, 232)';

test('the step indicator follows the step, with no script of its own', async ({ page }) => {
  await open(page);
  expect((await current(page))[0]).toBe(BLUE);
  await toStep2(page);
  const s2 = await current(page);
  expect(s2[1]).toBe(BLUE);
  expect(s2[0]).not.toBe(BLUE);
  await page.locator('#coEmail').fill('traveller@example.com');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  expect((await current(page))[2]).toBe(BLUE);
  await page.locator('#coBack').click();
  expect((await current(page))[1]).toBe(BLUE);
});

test('the refusal is visible on steps 1 and 2, and given once — in full, above the disabled button — on review', async ({ page }) => {
  await open(page);
  await expect(page.locator('#coUnavail')).toBeVisible();
  await expect(page.locator('#coUnavail h4')).toBeInViewport();
  await toStep2(page);
  await expect(page.locator('#coUnavail')).toBeVisible();
  await page.locator('#coEmail').fill('traveller@example.com');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  await expect(page.locator('#coUnavail')).toBeHidden();
  await expect(page.locator('#coFinal')).toBeVisible();
  await expect(page.locator('#coFinal')).toContainText('nothing has been charged, no order has been created and no eSIM will be sent');
  await expect(page.locator('#coFinal')).toBeInViewport();
  await expect(page.locator('#coPay')).toBeDisabled();
  // Review shows each fact once: the top summary steps aside.
  await expect(page.locator('.co-sum')).toBeHidden();
  await expect(page.locator('#rvData')).toHaveText('3 GB');
  await expect(page.locator('#rvTotal')).toHaveText('$4.99');
  await expect(page.locator('#rvEmail')).toHaveText('traveller@example.com');
});

test('the summary names the country with its flag', async ({ page }) => {
  await open(page);
  await expect(page.locator('.co-sum-head')).toHaveText('eSIM for Thailand');
  expect(await page.locator('.co-flag').evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
});

test('phones: a sheet whose action is on screen on every step, and a backdrop strip that still closes it', async ({ page }) => {
  await open(page);
  const vh = page.viewportSize().height;
  for (const [step, btn] of [['1', '#coQuote'], ['2', '#coReview'], ['3', '#coPay']]) {
    if (step === '2') await toStep2(page);
    if (step === '3') { await page.locator('#coEmail').fill('traveller@example.com'); await page.locator('#coDevice').check(); await page.locator('#coReview').click(); }
    const box = await page.locator(btn).boundingBox();
    expect(box.y + box.height, `step ${step}`).toBeLessThanOrEqual(vh);
    expect(box.y, `step ${step}`).toBeGreaterThan(0);
  }
  const modal = await page.locator('#checkout .modal').boundingBox();
  expect(modal.x).toBe(0);                                  // full width
  // When the sheet is scrolled, its sticky head (with ×) covers the strip; at the top the strip shows.
  await page.locator('#checkout').evaluate((o) => o.scrollTo(0, 0));
  await page.locator('#checkout').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#checkout')).toBeHidden();
});

for (const [w, h] of [[1366, 900], [390, 844], [320, 640]]) {
  test(`${w}px: no overflow at any step, no CSP violation`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const st = await open(page);
    const flat = () => page.evaluate(() => { const o = document.querySelector('.overlay'); return o.scrollWidth <= o.clientWidth && document.documentElement.scrollWidth <= innerWidth; });
    expect(await flat()).toBe(true);
    await toStep3(page);
    expect(await flat()).toBe(true);
    if (w === 1366) expect((await page.locator('#checkout .modal').boundingBox()).width).toBeLessThanOrEqual(540);
    expect(st.csp).toEqual([]);
    expect(st.errors).toEqual([]);
  });
}

test.describe('axe on every step of the window', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the page is unchanged
  const audit = async (page, label) => {
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
      .violations.map((x) => `${x.id} ×${x.nodes.length}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' | ')}`));
    expect(v, label).toEqual([]);
  };
  for (const [w, h] of [[1366, 900], [0, 0]]) {
    test(`${w ? w + 'px' : 'project width'}: plan, price, review`, async ({ page }) => {
      if (w) await page.setViewportSize({ width: w, height: h });
      await open(page);
      await audit(page, 'step 1');
      await toStep2(page);
      await audit(page, 'step 2');
      await page.locator('#coEmail').fill('traveller@example.com');
      await page.locator('#coDevice').check();
      await page.locator('#coReview').click();
      await audit(page, 'step 3');
    });
  }
});
