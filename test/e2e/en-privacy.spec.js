'use strict';

/*
 * The English Privacy Policy, /en/privacy/ (LEGAL-1), in a real browser: Chromium at 390 and 320 (the projects) and at
 * 1366 (set per test), and in WebKit (the webkit-flags project runs this file too — Safari's engine). What it must do:
 *   * open as an English document page: the hero with the effective date, «On this page», one card per section;
 *   * no request off the site, no CSP violation, no console error, no cookie, no horizontal scroll;
 *   * every «On this page» link lands on its section;
 *   * the footer of EN, ES, DE, FR and ZH pages leads to it; no international page links a Russian legal document;
 *   * axe clean (WCAG 2 A/AA).
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PATH = '/en/privacy/';

async function open(page, path) {
  const st = { off: [], csp: [], errors: [] };
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('http://localhost')) st.off.push(r.url()); });
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    if (m.type() === 'error') st.errors.push(m.text());
  });
  page.on('pageerror', (e) => st.errors.push(String(e)));
  // The international pages ask the API for prices; the privacy page must not. Answer anything that tries, then count it.
  await page.route(/\/api\//, (r) => r.fulfill({ status: 503, body: '{}' }));
  const res = await page.goto(path);
  return { st, res };
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const atRest = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });

for (const w of [null, 1366]) {
  test(`the page opens clean @${w || 'project'}`, async ({ page, context }) => {
    if (w) await page.setViewportSize({ width: w, height: 900 });
    const { st, res } = await open(page, PATH);
    expect(res.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText('Privacy Policy');
    await expect(page).toHaveTitle('Privacy Policy — Magic eSIM');
    await expect(page.locator('.lg-meta').first()).toContainText('Effective date:');
    await expect(page.locator('main')).toContainText('Individual Entrepreneur ALEKSANDR KHARIN');
    await expect(page.locator('main')).toContainText('Online purchases are not yet available on the international website.');
    expect(await page.locator('main .g-sec').count()).toBeGreaterThanOrEqual(12);
    expect(await noOverflow(page), 'no horizontal scroll').toBe(true);
    // Every card is inside the viewport's width — nothing clipped on a phone.
    const wide = await page.evaluate(() => [...document.querySelectorAll('main .g-sec')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5).map((el) => el.id));
    expect(wide).toEqual([]);
    expect(st.off, 'no request off the site').toEqual([]);
    expect(st.csp, 'no CSP violation').toEqual([]);
    expect(st.errors, 'no console error').toEqual([]);
    expect(await context.cookies(), 'no cookie').toEqual([]);
    const footerLink = page.locator('footer a[href="/en/privacy/"]');
    await expect(footerLink).toHaveText('Privacy Policy');
    expect(await page.locator('a[href="/terms.html"], a[href="/privacy.html"]').count()).toBe(0);
  });
}

test('«On this page» links land on their sections', async ({ page }) => {
  await open(page, PATH);
  const links = page.locator('.g-toc a');
  const n = await links.count();
  expect(n).toBeGreaterThanOrEqual(12);
  for (const i of [1, Math.floor(n / 2), n - 1]) {
    const href = await links.nth(i).getAttribute('href');
    await links.nth(i).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    const top = await page.locator(href).evaluate((el) => el.getBoundingClientRect().top);
    expect(top, `${href} is not hidden under the sticky header`).toBeGreaterThanOrEqual(0);
  }
});

test('every international footer leads to the Privacy Policy in its own language; none links a Russian legal document', async ({ page }) => {
  // LEGAL-4: each language links its own translation (seo/legal-i18n.mjs); English links /en/privacy/.
  const LABELS = {
    '/en/': ['/en/privacy/', 'en', 'Privacy Policy'],
    '/es/': ['/es/privacy/', 'es', 'Política de privacidad'],
    '/de/': ['/de/privacy/', 'de', 'Datenschutzerklärung'],
    '/fr/': ['/fr/privacy/', 'fr', 'Politique de confidentialité'],
    '/zh/': ['/zh/privacy/', 'zh-Hans', '隐私政策'],
    '/ko/': ['/ko/privacy/', 'ko', '개인정보 처리방침'],
  };
  for (const [home, [href, lang, label]] of Object.entries(LABELS)) {
    for (const path of [home, `${home}guides/`]) {
      await open(page, path);
      const link = page.locator(`footer a[href="${href}"]`);
      await expect(link, path).toHaveText(label);
      await expect(link, path).toHaveAttribute('hreflang', lang);
      expect(await page.locator('a[href="/terms.html"], a[href="/privacy.html"]').count(), `${path}: Russian legal link`).toBe(0);
    }
  }
  await open(page, '/de/');
  await page.locator('footer a[href="/de/privacy/"]').click();
  await expect(page).toHaveURL(/\/de\/privacy\/$/);
  await expect(page.locator('h1')).toHaveText('Datenschutzerklärung');
  await expect(page.locator('.lg-translation a[href="/en/privacy/"]')).toBeVisible();
});

test.describe('axe on the privacy page', () => {
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
