'use strict';

/*
 * No country page scrolls sideways on a phone: at 320, 375, 390 and 430 px the page is never wider than the screen.
 * Found on /esim/central-african-republic/ (2026-10-24): the title column next to the flag (.cp-title > div) and the block
 * heads (.blk-head > div) are flex items, whose min-width is their longest word — «Центральноафриканской» at 28 px widened the
 * column to 428 px. Fixed in assets/page-country.css (min-width:0 + overflow-wrap:break-word), never by overflow-x:hidden.
 *
 * Which pages: in every published language, the country pages whose title holds the LONGEST word (read from the built HTML,
 * so a new long name is covered without editing this file), plus the Central African Republic. Off-site requests are refused;
 * the RU pages get the committed catalogue, so their plan cards render too.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CATALOG = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'catalog.json'), 'utf8'));
const cors = { 'access-control-allow-origin': '*' };
const WIDTHS = [320, 375, 390, 430];
const PREFIXES = ['', 'en', 'es', 'de', 'fr', 'zh', 'ko'];
const PER_LANGUAGE = 3;

const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const longestWord = (s) => Math.max(...s.split(/[\s \-–—]+/).map((w) => [...w].length));

function pages() {
  const out = new Set();
  for (const p of PREFIXES) {
    const dir = path.join(ROOT, p, 'esim');
    const rows = fs.readdirSync(dir)
      .filter((slug) => fs.existsSync(path.join(dir, slug, 'index.html')))
      .map((slug) => {
        const h = fs.readFileSync(path.join(dir, slug, 'index.html'), 'utf8');
        const m = h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
        return { url: `/${p ? p + '/' : ''}esim/${slug}/`, len: m ? longestWord(text(m[1])) : 0, h1: m ? text(m[1]).length : 0 };
      })
      .filter((r) => r.len > 0);
    rows.sort((a, b) => b.len - a.len || b.h1 - a.h1);
    rows.slice(0, PER_LANGUAGE).forEach((r) => out.add(r.url));
    out.add(`/${p ? p + '/' : ''}esim/central-african-republic/`);
  }
  return [...out];
}

test('the page list is real: every language contributes, the Central African Republic is in it', () => {
  const list = pages();
  for (const p of PREFIXES) expect(list.filter((u) => u.startsWith(p ? `/${p}/esim/` : '/esim/')).length, p || 'ru').toBeGreaterThanOrEqual(PER_LANGUAGE);
  expect(list).toContain('/esim/central-african-republic/');
});

for (const url of pages()) {
  test(`${url}: no horizontal scroll at ${WIDTHS.join(' / ')} px`, async ({ page }) => {
    await page.addInitScript(() => { window.ym = function () {}; try { localStorage.setItem('mesim.site.lang', 'ru'); } catch (e) {} });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
      const req = route.request();
      if (req.method() === 'GET' && /\/api\/v1\/retail\/packages(?!.*market=global)/.test(req.url())) {
        return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(withLayout({ status: 'success', data: CATALOG.packages })) });
      }
      return route.abort();
    });
    await page.setViewportSize({ width: WIDTHS[0], height: 844 });
    await page.goto(url);
    await page.waitForFunction(() => { const t = document.querySelector('#tariffs'); return !t || t.getAttribute('data-loading') === 'false' || !!document.querySelector('.plan'); }, null, { timeout: 10000 }).catch(() => {});
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      const r = await page.evaluate(() => {
        const W = document.documentElement.clientWidth;
        const wide = [...document.querySelectorAll('body *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width && b.right > W + 0.5; });
        return { W, sw: document.documentElement.scrollWidth, first: wide.slice(0, 2).map((el) => `${el.tagName.toLowerCase()}.${el.className}`) };
      });
      expect(r.sw, `${url} at ${width} px is ${r.sw} px wide: ${r.first.join(', ')}`).toBeLessThanOrEqual(r.W);
    }
  });
}
