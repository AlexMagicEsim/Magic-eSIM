'use strict';

/*
 * The English support page, /en/support/ (seo/support-en.mjs), in a real browser: Chromium at 390 and 320 (the
 * projects) and at 1366 (set per test), and in WebKit (the webkit-flags project runs this file too). What it must do:
 *   * open as an English document page: hero, «On this page», the six sections, the payment bar;
 *   * no request off the site, no CSP violation, no console error, no cookie, no API call, no horizontal scroll;
 *   * the mailto address, the three legal documents and the five guides as links; no Telegram link;
 *   * the footer of English pages leads to it, and no other language's page does;
 *   * axe clean (WCAG 2 A/AA) at the project width and at 1366.
 */

const { test, expect } = require('@playwright/test');
const { defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PATH = '/en/support/';

async function open(page, path) {
  const st = { off: [], csp: [], errors: [], api: 0 };
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('http://localhost')) st.off.push(r.url()); });
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    if (m.type() === 'error') st.errors.push(m.text());
  });
  page.on('pageerror', (e) => st.errors.push(String(e)));
  // The support page asks the API for nothing; answer anything that tries, and count it.
  await page.route(/\/api\//, (r) => { st.api += 1; return r.fulfill({ status: 503, body: '{}' }); });
  const res = await page.goto(path);
  return { st, res };
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const atRest = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });

for (const w of [null, 1366]) {
  test(`the support page opens clean @${w || 'project'}`, async ({ page, context }) => {
    if (w) await page.setViewportSize({ width: w, height: 900 });
    const { st, res } = await open(page, PATH);
    expect(res.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Support — Magic eSIM');
    await expect(page.locator('h1')).toHaveText('Support');
    await expect(page.locator('main h2')).toHaveText(['Contact Support', 'Order & Payment Issues', 'eSIM Installation & Activation',
      'Connectivity & Roaming Issues', 'Refunds', 'Information Needed for Support']);
    await expect(page.locator('#previewNotice')).toBeVisible();
    await expect(page.locator('main')).toContainText('International payments are currently unavailable.');
    await expect(page.locator('main a[href="mailto:support@magicesim.store"]').first()).toBeVisible();
    for (const href of ['/en/terms/', '/en/refund/', '/en/privacy/', '/en/guides/iphone/', '/en/guides/android/',
      '/en/guides/compatibility/', '/en/guides/activation/', '/en/guides/troubleshooting/']) {
      expect(await page.locator(`main a[href="${href}"]`).count(), href).toBeGreaterThan(0);
    }
    expect(await page.locator('a[href*="t.me"], a[href^="tg:"]').count(), 'no Telegram link').toBe(0);
    await atRest(page);
    expect(await noOverflow(page), 'no horizontal scroll').toBe(true);
    const wide = await page.evaluate(() => [...document.querySelectorAll('main .g-sec, main li, main p')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5).map((el) => el.id || el.textContent.slice(0, 40)));
    expect(wide, 'nothing wider than the viewport').toEqual([]);
    expect(st.off, 'no request off the site').toEqual([]);
    expect(st.csp, 'no CSP violation').toEqual([]);
    expect(st.errors, 'no console error').toEqual([]);
    expect(st.api, 'no API request').toBe(0);
    expect(await context.cookies(), 'no cookie').toEqual([]);
  });
}

test('«On this page» links land on their sections', async ({ page }) => {
  await open(page, PATH);
  const links = page.locator('.g-toc a');
  await expect(links).toHaveCount(6);
  for (const i of [0, 3, 5]) {
    const href = await links.nth(i).getAttribute('href');
    await links.nth(i).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const top = await page.locator(href).evaluate((el) => el.getBoundingClientRect().top);
    expect(top, `${href} is not hidden under the sticky header`).toBeGreaterThanOrEqual(0);
  }
});

test('the English footer leads to the support page; no other language\'s page links it', async ({ page }) => {
  for (const path of ['/en/', '/en/esim/', '/en/esim/thailand/', '/en/guides/iphone/', '/en/terms/']) {
    await open(page, path);
    await expect(page.locator('footer a[href="/en/support/"]'), path).toHaveText('Support');
  }
  await open(page, '/en/guides/');
  await page.locator('footer a[href="/en/support/"]').click();
  await expect(page).toHaveURL(/\/en\/support\/$/);
  await expect(page.locator('h1')).toHaveText('Support');
  for (const path of ['/es/', '/de/', '/fr/', '/zh/', '/ko/', '/es/guides/']) {
    await open(page, path);
    expect(await page.locator('a[href="/en/support/"]').count(), path).toBe(0);
  }
});

test.describe('axe on the support page', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the page is unchanged
  test('at the project width and at 1366', async ({ page }) => {
    for (const w of [null, 1366]) {
      if (w) await page.setViewportSize({ width: w, height: 900 });
      await page.goto(PATH);
      await page.addScriptTag({ content: AXE });
      await atRest(page);
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
        .violations.map((x) => `${x.id} ×${x.nodes.length}`));
      expect(v, `@${w || 'project'}`).toEqual([]);
    }
  });
});
