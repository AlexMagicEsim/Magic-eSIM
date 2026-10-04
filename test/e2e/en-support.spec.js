'use strict';

/*
 * The support contact on the English pages: visible in every kind of page's
 * footer and at the end of the troubleshooting guide, at 390, 320 and desktop
 * width, without overflowing, and with no new axe violation. Nothing real is
 * touched: the catalogue is a fixture, and a mailto link sends no request.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ADDRESS = 'support@magicesim.store';
const BODY = JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: [
  { package_id: '0d504f79-eab1-40dc-891a-c1f60cf11f06', name: 'Thailand 3GB', country_code: 'TH', coverage_country_codes: ['TH'],
    data_gb: 3, validity_days: 15, price: 4.99, currency: 'USD', plan_type: 'FIXED_VOLUME' }] });

const PAGES = ['/en/', '/en/esim/', '/en/esim/thailand/', '/en/guides/', '/en/guides/troubleshooting/'];

async function visit(page, path) {
  const calls = [];
  page.on('request', (r) => { if (r.method() !== 'GET') calls.push(`${r.method()} ${r.url()}`); });
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: BODY }));
  await page.goto(path);
  if (path === '/en/esim/thailand/') await expect(page.locator('#localGrid .card')).toHaveCount(1);
  return calls;
}

async function checkFooter(page) {
  const link = page.locator('footer a[href^="mailto:"]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', `mailto:${ADDRESS}`);
  await expect(link).toHaveText(ADDRESS);
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  await expect(page.locator('footer .support')).toHaveText(`Support: ${ADDRESS}`);
  const box = await link.boundingBox();
  const width = page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const path of PAGES) {
  test(`${path}: the footer names ${ADDRESS}, visible and inside the screen`, async ({ page }) => {
    const calls = await visit(page, path);
    await checkFooter(page);
    expect(calls).toEqual([]);
  });
}

test('desktop width: the footer contact is visible on the home and a country page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ['/en/', '/en/esim/thailand/']) {
    await visit(page, path);
    await checkFooter(page);
  }
});

test('troubleshooting ends with «Still not working?» and the address, before the questions', async ({ page }) => {
  await visit(page, '/en/guides/troubleshooting/');
  const h = page.locator('main h2', { hasText: 'Still not working?' });
  await expect(h).toHaveCount(1);
  const link = page.locator(`main a[href="mailto:${ADDRESS}"]`);
  await expect(link).toHaveText(ADDRESS);
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
});

test.describe('axe with the contact in place', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the pages are unchanged
  for (const path of ['/en/', '/en/esim/thailand/', '/en/guides/troubleshooting/']) {
    test(`${path}: no WCAG A/AA violation`, async ({ page }) => {
      await visit(page, path);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
        .violations.map((x) => `${x.id} ×${x.nodes.length}`));
      expect(v).toEqual([]);
    });
  }
});
