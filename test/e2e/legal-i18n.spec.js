'use strict';

/*
 * LEGAL-4 — the translated Terms of Service, Refund Policy and Privacy Policy (/es/ /de/ /fr/ /zh/ /ko/ ×
 * terms / refund / privacy) in a real browser, at the project widths (390, 320; WebKit in webkit-flags):
 *   * each opens in its own language with the translation notice and a working link to the English original;
 *   * no request off the site, no CSP violation, no console error, no cookie, no horizontal scroll;
 *   * axe clean (WCAG 2 A/AA) on one document per language;
 *   * the checkout's consent links on a country page lead to the same language's documents.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const LANGS = { es: 'es', de: 'de', fr: 'fr', zh: 'zh-Hans', ko: 'ko' };
const KINDS = ['terms', 'refund', 'privacy'];

async function open(page, path) {
  const st = { off: [], csp: [], errors: [] };
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('http://localhost')) st.off.push(r.url()); });
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    if (m.type() === 'error') st.errors.push(m.text());
  });
  page.on('pageerror', (e) => st.errors.push(String(e)));
  await page.route(/\/api\//, (r) => r.fulfill({ status: 503, body: '{}' }));
  const res = await page.goto(path);
  return { st, res };
}
const atRest = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });

for (const [prefix, lang] of Object.entries(LANGS)) {
  test(`/${prefix}/: the three documents open clean in ${lang}, each with the notice and the English original`, async ({ page, context }) => {
    for (const kind of KINDS) {
      const path = `/${prefix}/${kind}/`;
      const { st, res } = await open(page, path);
      expect(res.status(), path).toBe(200);
      await expect(page.locator('html'), path).toHaveAttribute('lang', lang);
      await expect(page.locator('.lg-translation'), path).toBeVisible();
      await expect(page.locator(`.lg-translation a[href="/en/${kind}/"]`), path).toHaveAttribute('hreflang', 'en');
      expect(await page.locator('.g-sec').count(), path).toBeGreaterThan(5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path}: no horizontal scroll`).toBe(true);
      expect(st.off, `${path}: off-site requests`).toEqual([]);
      expect(st.csp, `${path}: CSP`).toEqual([]);
      expect(st.errors, `${path}: console errors`).toEqual([]);
      page.removeAllListeners('request'); page.removeAllListeners('console'); page.removeAllListeners('pageerror');
    }
    expect(await context.cookies()).toEqual([]);
    await page.locator('.lg-translation a').click();
    await expect(page).toHaveURL(/\/en\/privacy\/$/);
  });

  test(`/${prefix}/: the checkout consent links lead to the ${lang} documents`, async ({ page }) => {
    await open(page, `/${prefix}/esim/uae/`);
    for (const kind of KINDS) {
      expect(await page.locator(`#coConsents a[href="/${prefix}/${kind}/"]`).count(), kind).toBe(1);
      expect(await page.locator(`#coConsents a[href="/en/${kind}/"]`).count(), `${kind}: no English link`).toBe(0);
    }
  });
}

test.describe('axe on the translated documents', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the pages are unchanged
  test('one document per language', async ({ page }) => {
    const pick = { es: 'refund', de: 'terms', fr: 'privacy', zh: 'refund', ko: 'terms' };
    for (const [prefix, kind] of Object.entries(pick)) {
      await page.goto(`/${prefix}/${kind}/`);
      await page.addScriptTag({ content: AXE });
      await atRest(page);
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
        .violations.map((x) => `${x.id} ×${x.nodes.length}`));
      expect(v, `/${prefix}/${kind}/`).toEqual([]);
    }
  });
});
