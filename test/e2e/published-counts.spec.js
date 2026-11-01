'use strict';

/*
 * THE NUMBERS A COUNTRY PAGE PRINTS ARE THE CARDS IT DRAWS (2026-11-01).
 *
 * seo/test-published-counts.mjs holds the generated numbers (facts line,
 * template FAQ, FAQPage, template description, hub) to the published layout of
 * assets/catalog.json. This is the other half: a real browser, the page fed that
 * same snapshot as its catalogue answer, the cards counted on screen per block —
 * after every rule of the storefront (assets/assortment-view.js) — and compared
 * with the numbers in the page's own HTML as served (what a crawler reads) and
 * after the live update. Seychelles is the page that said «9» above five cards.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const SNAP = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8'));
const ANSWER = { status: 'success', count: SNAP.packages.length, currency: 'RUB', data: SNAP.packages, assortment: SNAP.assortment };
const PAGES = ['seychelles', 'italy', 'usa', 'nepal', 'tanzania', 'south-africa', 'uae', 'thailand', 'morocco', 'switzerland'];

const num = (s) => Number(String(s).replace(/[^\d]/g, ''));
function servedNumbers(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  const one = (re, s = text) => { const m = re.exec(s); return m ? num(m[1]) : null; };
  return {
    facts: { local: one(/data-cat="local">(\d+)</, html), regional: one(/data-cat="regional">(\d+)</, html), daily: one(/data-cat="daily">(\d+)</, html) },
    faq: {
      local: one(/Сейчас доступно (\d+) локальн/), regional: one(/в том числе эту\. Сейчас таких (\d+)\./), daily: one(/Да, сейчас таких (\d+)\. У них платится не объём/),
    },
  };
}

for (const slug of PAGES) {
  test(`${slug}: the cards on screen = the numbers in the HTML a crawler reads = the numbers after the live update`, async ({ page, context, request }) => {
    const served = await (await request.get(`/esim/${slug}/`)).text();
    const printed = servedNumbers(served);

    await context.route('**/api/v1/retail/packages*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ANSWER) }));
    await page.goto(`/esim/${slug}/`);
    await page.waitForFunction(() => document.querySelector('#tariffs') && document.querySelector('#tariffs').getAttribute('data-loading') === 'false');
    const drawn = await page.evaluate(() => {
      const count = (sel) => document.querySelectorAll(sel).length;
      const card = (grid) => count(`${grid} .js-buy`);
      return { local: card('#localGrid'), regional: card('#regionalGrid'), daily: card('#dailyGrid') };
    });
    const live = await page.evaluate(() => {
      const val = (k) => { const seg = document.querySelector(`[data-cat-seg="${k}"]`); const b = document.querySelector(`[data-cat="${k}"]`); return !seg || seg.hasAttribute('hidden') ? 0 : Number(b.textContent); };
      return { local: val('local'), regional: val('regional'), daily: val('daily') };
    });

    for (const k of ['local', 'regional', 'daily']) {
      expect(printed.facts[k] ?? 0, `${slug} facts line «${k}» as served`).toBe(drawn[k]);
      if (printed.faq[k] !== null) expect(printed.faq[k], `${slug} template FAQ «${k}» as served`).toBe(drawn[k]);
      expect(live[k], `${slug} facts line «${k}» after the live update`).toBe(drawn[k]);
    }
    if (slug === 'seychelles') expect(drawn.regional).toBe(5);
  });
}
