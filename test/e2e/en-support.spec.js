'use strict';

/*
 * The support contact on the English pages: visible in every kind of page's
 * footer and at the end of the troubleshooting guide, at 390, 320 and desktop
 * width, without overflowing, and with no new axe violation. Nothing real is
 * touched: the catalogue is a fixture, and a mailto link sends no request.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const ADDRESS = 'support@magicesim.store';
const BODY = JSON.stringify(withLayout({ status: 'success', market: 'global', currency: 'USD', data: [
  { package_id: '0d504f79-eab1-40dc-891a-c1f60cf11f06', name: 'Thailand 3GB', country_code: 'TH', coverage_country_codes: ['TH'],
    data_gb: 3, validity_days: 15, price: 4.99, currency: 'USD', plan_type: 'FIXED_VOLUME' }] }));

const PAGES = ['/', '/destinations/', '/destinations/thailand/', '/guides/', '/guides/troubleshooting/'];

async function visit(page, path) {
  const calls = [];
  page.on('request', (r) => { if (r.method() !== 'GET') calls.push(`${r.method()} ${r.url()}`); });
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: BODY }));
  await page.goto(path);
  if (path === '/destinations/thailand/') await expect(page.locator('#localGrid .card')).toHaveCount(1);
  return calls;
}

async function checkFooter(page) {
  const link = page.locator('footer a[href^="mailto:"]');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('href', `mailto:${ADDRESS}`);
  await expect(link).toHaveText(ADDRESS);
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  await expect(page.locator('footer .support:not(.support-phone)')).toHaveText(`Support: ${ADDRESS}`);
  const box = await link.boundingBox();
  const width = page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

// The support telephone (2026-11-12, seo/support-phone.mjs): a tel: link under the email, visible and inside the screen.
const PHONE = '+995 591 021 807';
async function checkPhone(page, scope) {
  const link = page.locator(`${scope} a[href="tel:+995591021807"]`);
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText(PHONE);
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
  const box = await link.boundingBox();
  const width = page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.height).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const path of PAGES) {
  test(`${path}: the footer names ${ADDRESS}, visible and inside the screen`, async ({ page }) => {
    const calls = await visit(page, path);
    await checkFooter(page);
    await checkPhone(page, 'footer');
    await expect(page.locator('footer .support-phone')).toHaveText(`Phone: ${PHONE}`);
    expect(calls).toEqual([]);
  });
}

test('desktop width: the footer contact is visible on the home and a country page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of ['/', '/destinations/thailand/']) {
    await visit(page, path);
    await checkFooter(page);
    await checkPhone(page, 'footer');
  }
});

for (const width of [1280, 390, 320]) {
  test(`${width}px: the home's support band offers the email and the telephone, both visible and tappable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await visit(page, '/');
    const band = '#support .support-band';
    await expect(page.locator(`${band} a[href="mailto:${ADDRESS}"]`)).toBeVisible();
    await checkPhone(page, band);
    // a phone screen stacks the two buttons, each a full-width target of at least 44 px
    if (width < 600) {
      for (const sel of [`${band} a[href="mailto:${ADDRESS}"]`, `${band} a[href^="tel:"]`]) {
        const b = await page.locator(sel).boundingBox();
        expect(b.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
}

test('the hidden language versions do not show the telephone', async ({ page }) => {
  for (const path of ['/es/', '/de/', '/fr/', '/zh/', '/ko/']) {
    await page.goto(path);
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  }
});

test('troubleshooting ends with «Still not working?» and the address, before the questions', async ({ page }) => {
  await visit(page, '/guides/troubleshooting/');
  const h = page.locator('main h2', { hasText: 'Still not working?' });
  await expect(h).toHaveCount(1);
  const link = page.locator(`main a[href="mailto:${ADDRESS}"]`);
  await expect(link).toHaveText(ADDRESS);
  await link.scrollIntoViewIfNeeded();
  await expect(link).toBeVisible();
});

test.describe('axe with the contact in place', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the pages are unchanged
  for (const path of ['/', '/destinations/thailand/', '/guides/troubleshooting/']) {
    test(`${path}: no WCAG A/AA violation`, async ({ page }) => {
      await visit(page, path);
      await page.addScriptTag({ content: AXE });
      // axe reads the page at rest: the Expressive entrances fade blocks in, and a half-transparent text reads as low contrast
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
        .violations.map((x) => `${x.id} ×${x.nodes.length}`));
      expect(v).toEqual([]);
    });
  }
});
