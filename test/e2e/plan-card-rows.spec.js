'use strict';

/*
 * One row of plan cards, one height and one set of lines (assets/page-country.css, the subgrid block), on the RU
 * country page and on every prefixed language (en, es, de, fr, zh, ko), at desktop (three columns), tablet (two) and
 * a narrow two-column card (600 px, where the button goes under the network and IP lines):
 *   - every card of a grid row is as tall as the row;
 *   - the foot (the divider, the network, the button) starts at the same height in every card of the row, and the
 *     buy button's top and bottom are the same — though one card prints an IP line, a «Пополнение» line or the
 *     «Оптимальный выбор» badge and its neighbour does not (a row like that is REQUIRED below, or the claim is empty);
 *   - nothing is clipped: no card is given a height, and every part of it lies inside it;
 *   - between two rows of cards the gap is still the grid's (16 px).
 * Before this, a card without an IP line had a shorter foot, pinned to the bottom, so its divider and button sat
 * 21–48 px lower than its neighbours' (measured 2026-10-25 on the live catalogue, all seven languages).
 * Nothing leaves the machine: the catalogue is the committed snapshot (RUB) and the same rows in dollars (GLOBAL).
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');
const path = require('path');

const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const usd = (rub) => (Number(rub) > 0 ? Math.round(Number(rub) / 87 * 100) / 100 : rub);
const RUB_BODY = JSON.stringify(withLayout({ status: 'success', data: CATALOG.packages }));
const USD_BODY = JSON.stringify(withLayout({ status: 'success', market: 'global', currency: 'USD', data: CATALOG.packages.map((p) => ({
  ...p, currency: 'USD', price: usd(p.price),
  term_prices: Array.isArray(p.term_prices) ? p.term_prices.map((t) => ({ ...t, price: usd(t.price) })) : p.term_prices,
})) }));
const cors = { 'access-control-allow-origin': '*' };

const LANGS = ['', 'en/', 'es/', 'de/', 'fr/', 'zh/', 'ko/'];
const WIDTHS = [1366, 820, 600];
const PAGES = ['turkey', 'japan'];

async function open(page, url, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url);
  await expect(page.locator('.plan-grid > .plan').first()).toBeVisible();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 8000 });
}

/** Every grid row of two or more cards: the spread of each measure across the row, and whether its cards differ. */
function rows() {
  const out = [];
  const r = (e) => e.getBoundingClientRect();
  for (const grid of document.querySelectorAll('.plan-grid')) {
    const cards = [...grid.children].filter((c) => c.classList.contains('plan') && c.getClientRects().length);
    const byTop = new Map();
    for (const c of cards) { const t = Math.round(r(c).top); if (!byTop.has(t)) byTop.set(t, []); byTop.get(t).push(c); }
    const tops = [...byTop.keys()].sort((a, b) => a - b);
    tops.forEach((top, i) => {
      const cs = byTop.get(top);
      const spread = (f) => { const xs = cs.map(f); return Math.max(...xs) - Math.min(...xs); };
      const btn = (c) => c.querySelector('.plan-foot > .btn, .plan-foot > .note');
      const shape = (c) => [!!c.querySelector('.plan-foot .plan-ip'), !!c.querySelector('.package-best'),
        Math.round(r(c.querySelector('.plan-foot')).height)].join();
      const prevBottom = i ? Math.max(...byTop.get(tops[i - 1]).map((c) => r(c).bottom)) : null;
      out.push({
        grid: grid.id, n: cs.length, single: cs.length < 2,
        height: spread((c) => r(c).height),
        foot: spread((c) => r(c.querySelector('.plan-foot')).top),
        btnTop: spread((c) => r(btn(c)).top),
        btnBottom: spread((c) => r(btn(c)).bottom),
        differ: new Set(cs.map(shape)).size > 1 || new Set(cs.map((c) => c.querySelector('.plan-foot .plan-ip') ? 1 : 0)).size > 1,
        gapAbove: prevBottom == null ? null : Math.round((top - prevBottom) * 10) / 10,
        // nothing clipped: no height on the card, every part inside it
        clipped: cs.some((c) => {
          const b = r(c);
          const s = getComputedStyle(c);
          if (c.style.height || /(hidden|clip)/.test(s.overflowY)) return true;
          return [...c.querySelectorAll('*')].some((e) => { const x = r(e); return x.height && (x.bottom > b.bottom + 0.5 || x.top < b.top - 0.5); });
        }),
      });
    });
  }
  return out;
}

test.describe('plan cards: one row, one height, one line for the foot and the button', () => {
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'chromium-390', 'widths are set here; one engine run is enough');
    await page.addInitScript(() => { window.ym = function () {}; });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
      const req = route.request();
      if (req.method() !== 'GET') return route.abort();
      if (/\/api\/v1\/retail\/packages/.test(req.url())) {
        return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: /market=global/.test(req.url()) ? USD_BODY : RUB_BODY });
      }
      return route.fulfill({ status: 204, body: '' });
    });
  });

  for (const lang of LANGS) {
    test(`${lang || 'ru/'}: equal height, foot and button on one line in every row (desktop, tablet, narrow)`, async ({ page }) => {
      test.setTimeout(120000);
      let multi = 0; let differing = 0;
      for (const width of WIDTHS) {
        for (const slug of PAGES) {
          await open(page, `/${lang}esim/${slug}/`, width);
          const all = await page.evaluate(rows);
          const where = `${lang || 'ru/'}esim/${slug}/ @ ${width}`;
          for (const row of all) {
            expect(row.clipped, `${where} ${row.grid}: a card is clipped or given a height`).toBe(false);
            if (row.gapAbove != null) expect(Math.abs(row.gapAbove - 16), `${where} ${row.grid}: the gap between two rows (${row.gapAbove})`).toBeLessThanOrEqual(1);
            if (row.single) continue;
            multi++;
            if (row.differ) differing++;
            expect(row.height, `${where} ${row.grid}: card heights in a row`).toBeLessThanOrEqual(0.5);
            expect(row.foot, `${where} ${row.grid}: where the foot starts`).toBeLessThanOrEqual(0.5);
            expect(row.btnTop, `${where} ${row.grid}: the buy button's top`).toBeLessThanOrEqual(0.5);
            expect(row.btnBottom, `${where} ${row.grid}: the buy button's bottom`).toBeLessThanOrEqual(0.5);
          }
        }
      }
      expect(multi, 'rows of two or more cards were measured').toBeGreaterThan(10);
      expect(differing, 'some measured row mixes cards with and without an IP line / badge — or the claim is empty').toBeGreaterThan(0);
    });
  }

  test('ru/: the «Оптимальный выбор» card and its neighbours keep one line for everything below the badge', async ({ page }) => {
    await open(page, '/esim/thailand/', 1366);
    const best = page.locator('#localGrid > .plan', { has: page.locator('.package-best') });
    await expect(best).toHaveCount(1);
    const row = await page.evaluate(() => {
      const b = document.querySelector('#localGrid .package-best').closest('.plan');
      const top = Math.round(b.getBoundingClientRect().top);
      const cs = [...document.querySelectorAll('#localGrid > .plan')].filter((c) => Math.round(c.getBoundingClientRect().top) === top);
      const y = (c, sel) => c.querySelector(sel).getBoundingClientRect().top;
      const spread = (sel) => { const xs = cs.map((c) => y(c, sel)); return Math.max(...xs) - Math.min(...xs); };
      return { n: cs.length, meta: spread('.meta'), info: spread('.plan-info'), foot: spread('.plan-foot'), btn: spread('.plan-foot > .btn') };
    });
    expect(row.n).toBeGreaterThan(1);
    expect(row).toEqual({ n: row.n, meta: 0, info: 0, foot: 0, btn: 0 });
  });

  test('one column (390 px): a card is exactly as tall as its own content — no space added under the button', async ({ page }) => {
    for (const lang of ['', 'de/', 'fr/']) {
      await open(page, `/${lang}esim/turkey/`, 390);
      const gaps = await page.evaluate(() => [...document.querySelectorAll('.plan-grid > .plan')].filter((c) => c.getClientRects().length).map((c) => {
        const foot = c.querySelector('.plan-foot');
        const last = [...foot.querySelectorAll('.btn, .note, .plan-net, .plan-ip')].reduce((m, e) => Math.max(m, e.getBoundingClientRect().bottom), 0);
        return Math.round((foot.getBoundingClientRect().bottom - last) * 10) / 10;
      }));
      expect(gaps.length).toBeGreaterThan(3);
      // the foot ends at its last line (+ nothing): RU and EN have no bottom padding on the foot
      for (const g of gaps) expect(g).toBeLessThanOrEqual(0.5);
    }
  });
});
