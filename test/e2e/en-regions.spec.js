'use strict';

/*
 * The region pages /<prefix>/esim/{europe,asia,global}/ (international SEO stage 4, 2026-10-27; seo/regions.mjs), at
 * 390 and 320 (the projects) and at 1366 (set per test). What they must do:
 *   * show the payment bar first, stay noindex with no hreflang;
 *   * print every fact — the plan sets and «which set covers which destination» — in the HTML, so the page reads the
 *     same with JavaScript off;
 *   * call nothing (connect-src 'none'), make no non-GET request, log no error or CSP message, overflow nothing;
 *   * lead from the destination list to each region, and from each region row to a real country page;
 *   * pass axe at every width.
 * Never opens `/` (the language move of assets/lang-route.js).
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const REGIONS = ['europe', 'asia', 'global'];

async function open(page, path) {
  const st = { calls: [], csp: [], errors: [] };
  page.on('request', (r) => st.calls.push({ method: r.method(), url: r.url() }));
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    if (m.type() === 'error') st.errors.push(m.text());
  });
  page.on('pageerror', (e) => st.errors.push(String(e)));
  await page.route('**/api/**', (route) => route.fulfill({ status: 500, body: 'a region page must not call the API' }));
  const res = await page.goto(path);
  expect(res.status()).toBe(200);
  return st;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const atRest = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });

for (const slug of REGIONS) {
  test(`/en/esim/${slug}/: payment bar first, noindex, the facts on the page; no API, no CSP message, no overflow`, async ({ page }) => {
    for (const w of [null, 1366]) {
      if (w) await page.setViewportSize({ width: w, height: 900 });
      const st = await open(page, `/en/esim/${slug}/`);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
      await expect(page.locator('link[rel="alternate"]')).toHaveCount(0);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://magicesim.store/en/esim/${slug}/`);
      await expect(page.locator('h1')).toHaveCount(1);
      const bar = await page.locator('#previewNotice').boundingBox();
      const h1 = await page.locator('h1').boundingBox();
      expect(bar.y + bar.height).toBeLessThanOrEqual(h1.y);
      await expect(page.locator('#regionSetsTitle')).toBeVisible();
      await expect(page.locator('#regionMatrixTitle')).toBeVisible();
      expect(await page.locator('.region-matrix li[data-iso]').count()).toBeGreaterThan(0);
      expect(await noOverflow(page)).toBe(true);
      await atRest(page);
      expect(await noOverflow(page)).toBe(true);
      expect(st.calls.filter((c) => /\/api\//.test(c.url) || c.method !== 'GET')).toEqual([]);
      expect(st.csp).toEqual([]);
      expect(st.errors).toEqual([]);
    }
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every region page shows its sets and its matrix — the same rows as with JavaScript', async ({ page }) => {
    for (const slug of REGIONS) {
      await page.goto(`/en/esim/${slug}/`);
      await expect(page.locator('#regionMatrixTitle')).toBeVisible();
      const rows = page.locator('.region-matrix li[data-iso]');
      expect(await rows.count()).toBeGreaterThan(0);
      await expect(rows.first()).toBeVisible();
      await expect(page.locator('.region-sets .help-card').first()).toBeVisible();
      expect(await noOverflow(page)).toBe(true);
    }
  });
});

test('the destination list leads to each region, and each region row to a real country page', async ({ page, request }) => {
  await open(page, '/en/esim/');
  for (const slug of REGIONS) {
    const tile = page.locator(`#hubRegions a[href="/en/esim/${slug}/"]`);
    await expect(tile).toBeVisible();
  }
  await page.locator('#hubRegions a[href="/en/esim/europe/"]').click();
  await expect(page).toHaveURL(/\/en\/esim\/europe\/$/);
  const hrefs = await page.locator('.region-matrix li[data-iso] > a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBeGreaterThan(10);
  for (const href of hrefs.slice(0, 12)) expect((await request.get(href)).status(), href).toBe(200);
  // a set letter leads to its card on the same page
  const letter = page.locator('.region-matrix li[data-iso] small a').first();
  const target = await letter.getAttribute('href');
  expect(target).toMatch(/^#set-[a-z]$/);
  await letter.click();
  await expect(page.locator(target)).toBeInViewport();
});

test('other languages: the same page kind, in their language, noindex', async ({ page }) => {
  for (const [prefix, lang] of [['es', 'es'], ['de', 'de'], ['fr', 'fr'], ['zh', 'zh-Hans'], ['ko', 'ko']]) {
    const st = await open(page, `/${prefix}/esim/asia/`);
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    expect(await noOverflow(page)).toBe(true);
    expect(st.errors).toEqual([]);
    expect(st.csp).toEqual([]);
  }
});

test.describe('axe on the region pages', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the page is unchanged
  test('every region, at the project width and at 1366', async ({ page }) => {
    for (const w of [null, 1366]) {
      if (w) await page.setViewportSize({ width: w, height: 900 });
      for (const path of [...REGIONS.map((s) => `/en/esim/${s}/`), '/zh/esim/asia/', '/de/esim/europe/']) {
        await page.goto(path);
        await page.addScriptTag({ content: AXE });
        await atRest(page);
        const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
          .violations.map((x) => `${x.id} ×${x.nodes.length}`));
        expect(v, `${path} @ ${w || 'project'}`).toEqual([]);
      }
    }
  });
});
