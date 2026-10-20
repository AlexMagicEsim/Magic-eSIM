'use strict';

/*
 * The Google SEO pilot pages (uae, egypt, georgia, uzbekistan, italy) in a real
 * browser at 390 and 320 (the projects) and at 1366: the static price block is
 * visible and fits, the live grid still renders over it from the catalogue, the
 * «Купить» → checkout path is untouched, axe is clean, nothing is sent. Same
 * harness as ru-pages.spec.js: the committed snapshot is served as the live API,
 * every non-GET is refused and counted.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const PILOT = ['uae', 'egypt', 'georgia', 'uzbekistan', 'italy'];

async function open(page, url) {
  const st = { nonGet: 0, errors: [] };
  page.on('pageerror', (e) => st.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') st.errors.push(m.text()); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') { st.nonGet += 1; return route.abort(); }
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ status: 'success', data: CATALOG.packages }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  return st;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
async function axeViolations(page) {
  // measure the page at rest: an entrance (Expressive motion) may still be fading in, and axe reads a half-transparent text as low contrast
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 });
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
    .violations.map((v) => `${v.id}: ${v.nodes.length}`));
}

for (const slug of PILOT) {
  test(`pilot /esim/${slug}/: static prices + live grid, no overflow, axe 0, nothing sent`, async ({ page }) => {
    const st = await open(page, `/esim/${slug}/`);
    await expect(page.locator('.plan').first()).toBeVisible();
    await expect(page.locator('#prices')).toBeAttached();
    await page.locator('#prices').scrollIntoViewIfNeeded();
    await expect(page.locator('#prices h2')).toBeVisible();
    expect(await page.locator('#prices .help-card').count()).toBeGreaterThan(0);
    // The block's link goes back to the live grid.
    await expect(page.locator('#prices a[href="#tariffs"]')).toBeVisible();
    expect(await noOverflow(page)).toBe(true);
    expect(await axeViolations(page)).toEqual([]);
    expect(st.errors).toEqual([]);
    expect(st.nonGet).toBe(0);
  });
}

test('pilot /esim/uae/: «Купить» still opens the checkout window, which passes axe', async ({ page }) => {
  const st = await open(page, '/esim/uae/');
  await page.locator('#localGrid .plan .js-buy').first().click();
  await expect(page.locator('#checkoutModal')).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
  expect(await noOverflow(page)).toBe(true);
  expect(st.nonGet).toBe(0);
});

test.describe('desktop width', () => {
  test.use({ viewport: { width: 1366, height: 900 } });
  for (const slug of PILOT) {
    test(`pilot /esim/${slug}/ at 1366: no overflow, axe clean`, async ({ page }) => {
      await open(page, `/esim/${slug}/`);
      await expect(page.locator('.plan').first()).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
});
