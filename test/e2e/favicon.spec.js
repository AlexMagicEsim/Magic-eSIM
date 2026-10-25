'use strict';

/*
 * The favicon (owner, 2026-10-19: variant 1 «Плотный», no tile) as a browser
 * sees it, on RU and EN pages — the SEO-experiment page included, whose HTML
 * changes only by the icon versions:
 *   - every page declares the icon set with a ?v= content version, and each
 *     declared file loads and decodes (the .ico included);
 *   - favicon.svg draws the reduced full mark at 16, 32, 48 and 64 px: not
 *     blank, transparent corners (no tile), the gold chip visible from 32 px;
 *   - the stamped favicon is a new URL: the unversioned one a browser may still
 *     hold in its icon cache is never what a page asks for.
 * Nothing leaves the machine: every request to another host is aborted.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });

const PAGES = ['/', '/en/', '/esim/', '/esim/turkey/', '/en/esim/turkey/', '/esim/uae/', '/payment-failed.html'];

async function offline(page) {
  await page.addInitScript(() => { window.ym = function () {}; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
}

for (const url of PAGES) {
  test(`${url}: the favicon set is versioned and every file loads`, async ({ page }) => {
    await offline(page);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const r = await page.evaluate(async () => {
      const links = [...document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')];
      const out = [];
      for (const l of links) {
        const href = l.getAttribute('href');
        let ok = true;
        try { const i = new Image(); i.src = href; await i.decode(); ok = i.naturalWidth > 0; } catch (e) { ok = false; }
        out.push({ href, ok });
      }
      return out;
    });
    expect(r.length).toBe(5);
    for (const { href, ok } of r) {
      expect(href, 'a content version on every icon href').toMatch(/^\/(favicon\.ico|favicon\.svg|favicon-32\.png|apple-touch-icon\.png)\?v=[0-9a-f]{8}$/);
      expect(ok, `${href} loads`).toBe(true);
    }
  });
}

test('favicon.svg draws the reduced mark at 16, 32, 48 and 64 px', async ({ page }) => {
  await offline(page);
  await page.goto('/');
  const href = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
  const res = await page.evaluate(async (href) => {
    const out = {};
    for (const n of [16, 32, 48, 64]) {
      const i = new Image(); i.src = href; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = n;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0, n, n);
      const d = x.getImageData(0, 0, n, n).data;
      let ink = 0, gold = 0;
      for (let k = 0; k < d.length; k += 4) {
        if (d[k + 3] > 128) ink++;
        if (d[k + 3] > 200 && d[k] > 215 && d[k + 1] > 175 && d[k + 2] < 170 && d[k] - d[k + 2] > 60) gold++;
      }
      const corners = [0, n - 1].flatMap((y) => [0, n - 1].map((xx) => d[(y * n + xx) * 4 + 3]));
      out[n] = { ink: ink / (n * n), gold, corners };
    }
    return out;
  }, href);
  for (const n of [16, 32, 48, 64]) {
    expect(res[n].ink, `${n} px is not blank`).toBeGreaterThan(0.3);
    expect(res[n].corners, `${n} px has no tile`).toEqual([0, 0, 0, 0]);
  }
  for (const n of [32, 48, 64]) expect(res[n].gold, `${n} px shows the chip`).toBeGreaterThan(n / 6);
});

test('the old unversioned favicon URL is not what any page asks for', async ({ page }) => {
  await offline(page);
  for (const url of ['/', '/en/', '/esim/uae/']) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const hrefs = await page.locator('link[rel="icon"]').evaluateAll((ls) => ls.map((l) => l.getAttribute('href')));
    expect(hrefs.filter((h) => /^\/favicon\.(ico|svg)$/.test(h)), url).toEqual([]);
  }
});
