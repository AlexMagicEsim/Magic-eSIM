'use strict';

/*
 * «Покрытие и условия →» on the B1 plan cards: the pressable area is at least 44 px high (brand book v1.2: interactive elements
 * ≥ 44 px) while the link LOOKS as before (28 px). An invisible ::before centred on the link (assets/ru.css, B1 cards only) does
 * it: a press 21 px above or below the link's middle still opens the same window; the band never covers «Купить», a day button or
 * any other control; the card is not taller. Since 2026-10-24 the ten SEO-experiment pages have the B1 card too (owner, variant
 * «Б»): /esim/uae/ (pilot) and /esim/cyprus/ (control) are held to the same 44 px.
 * Nothing leaves the machine: the API is answered here from the committed catalogue, Metrika is stubbed.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const cors = { 'access-control-allow-origin': '*' };

async function open(page, url, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => { window.ym = function () {}; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') return route.abort();
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data: CATALOG.packages }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  await expect(page.locator('#tariffs .js-coverage').first()).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 5000 });
}

// [page, its card, the link's visible height, enlarged to 44 px?]
const CASES = [['/esim/turkey/', 'compact B1 card', 28, true], ['/esim/japan/', 'compact B1 card', 28, true], ['/esim/uae/', 'B1, SEO pilot page', 28, true], ['/esim/cyprus/', 'B1, SEO control page', 28, true]];

for (const [url, kind, visible, enlarged] of CASES) {
  for (const width of [320, 390, 1366]) {
    test(`${url} (${kind}) at ${width} px: ${enlarged ? '44 px pressable, looks the same, covers no other control' : 'the old link exactly as before'}`, async ({ page }) => {
      await open(page, url, width);
      const links = page.locator('#tariffs .js-coverage:visible');
      const n = Math.min(await links.count(), 8);
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        const link = links.nth(i);
        await link.evaluate((b) => b.scrollIntoView({ block: 'center' }));
        const r = await link.evaluate((b) => {
          const q = b.getBoundingClientRect(); const cy = q.top + q.height / 2;
          const hit = (x, y) => { const el = document.elementFromPoint(x, y); return !!(el && el.closest('.js-coverage') === b); };
          const band = { l: q.left, r: q.right, t: cy - 22, b: cy + 22 };
          const others = [...document.querySelectorAll('a[href], button, input, select, [role="button"]')]
            .filter((e) => e.offsetParent && e !== b && !b.contains(e))
            .filter((e) => { const o = e.getBoundingClientRect(); return o.left < band.r && o.right > band.l && o.top < band.b && o.bottom > band.t; })
            .map((e) => (e.innerText || e.className).toString().trim().slice(0, 24));
          return { h: Math.round(q.height), up: hit(q.left + 4, cy - 21), down: hit(q.left + 4, cy + 21), x: q.left + 4, y: cy - 21, others };
        });
        expect(r.h, 'the link keeps its look').toBe(visible);
        if (!enlarged) {
          expect(r.up || r.down, 'the experiment card is not enlarged').toBe(false);
          continue;
        }
        expect(r.up && r.down, 'pressable 21 px above and below its middle = 44 px').toBe(true);
        expect(r.others, 'the 44 px band covers no other control').toEqual([]);
        if (i === 0) {
          await page.mouse.click(r.x, r.y);
          await expect(page.locator('#coverageModal')).toBeVisible();
          await page.locator('#coverageClose').click();
          await expect(page.locator('#coverageModal')).toBeHidden();
        }
      }
    });
  }
}
