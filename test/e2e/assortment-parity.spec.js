'use strict';

/*
 * THE SITE AND THE MINI APP SHOW THE SAME CARDS (owner, 2026-10-25).
 *
 * One catalogue answer — a real backend layout of 12 countries
 * (test/fixtures/assortment-parity-{rub,usd}.json) — served to the Russian
 * country page and the RU Mini App, and to the international country page and
 * the international Mini App. For each country the rendered pages are read
 * back from the DOM: the package ids of the local, regional and daily blocks,
 * in screen order. They must be equal between the two surfaces of a market,
 * and equal to the backend's layout.
 */

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp } = require('./harness.js');

const FIX = (m) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', `assortment-parity-${m}.json`), 'utf8'));
const RUB = FIX('rub');
const USD = FIX('usd');
const COUNTRIES = [
  { iso: 'AE', slug: 'uae', ru: 'ОАЭ', en: 'United Arab Emirates' },
  { iso: 'TH', slug: 'thailand', ru: 'Таиланд', en: 'Thailand' },
  { iso: 'TR', slug: 'turkey', ru: 'Турция', en: 'Türkiye' },
  { iso: 'IT', slug: 'italy', ru: 'Италия', en: 'Italy' },
];

const expected = (body, iso) => {
  const c = body.assortment.countries[iso];
  return { local: c.local, regional: c.regional, daily: c.daily };
};

async function siteBlocks(page, kind) {
  return page.evaluate((k) => {
    const ids = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getAttribute('data-package-id'));
    if (k === 'ru') {
      return { local: ids('#localGrid .js-buy'), regional: ids('#regionalGrid .js-buy'), daily: ids('#dailyGrid .js-buy') };
    }
    return { local: ids('#localGrid [data-package-id]'), regional: ids('#regionalGrid [data-package-id]'), daily: ids('#dailyGrid [data-package-id]') };
  }, kind);
}

async function appBlocks(page) {
  return page.evaluate(() => {
    // Each card names its block (`plan-local` / `plan-regional` / `plan-daily`, app/ui.js planCard); the order is the
    // DOM's. Since 2026-10-25 every block has a heading, so «the first h2 starts the regional block» no longer holds.
    const out = { local: [], regional: [], daily: [] };
    for (const node of document.querySelectorAll('#country-list > .card--tariff[data-package-id]')) {
      const block = ['local', 'regional', 'daily'].find((k) => node.classList.contains(`plan-${k}`));
      out[block].push(node.getAttribute('data-package-id'));
    }
    return out;
  });
}

async function openInApp(page, name) {
  await page.fill('#search', name);
  const exact = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  await page.locator('#home-countries .card--row').filter({ has: page.locator('.card__title', { hasText: exact }) }).first().click();
  await expect(page.locator('#country-title')).toHaveText(name);
}

for (const c of COUNTRIES) {
  test(`RUB · ${c.iso}: the Russian page and the RU Mini App draw the backend's layout card for card`, async ({ page, context }) => {
    await context.route('**/assets/catalog.json*', (r) => r.fulfill({ status: 404, body: '' }));
    await context.route('**/api/v1/retail/packages*', (r) => (new URL(r.request().url()).searchParams.get('market') === 'global'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USD) })
      : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RUB) })));
    await page.goto(`/esim/${c.slug}/`);
    await page.waitForFunction(() => document.querySelector('#tariffs') && document.querySelector('#tariffs').getAttribute('data-loading') === 'false');
    const site = await siteBlocks(page, 'ru');
    expect(site).toEqual(expected(RUB, c.iso));

    const app = await context.newPage();
    await installMiniApp(app, { catalogue: RUB, globalCatalogue: USD });
    await openApp(app);
    await openInApp(app, c.ru);
    expect(await appBlocks(app)).toEqual(site);
  });

  test(`USD · ${c.iso}: the international page and the international Mini App draw the same layout`, async ({ page, context }) => {
    await context.route('**/api/v1/retail/packages*', (r) => (new URL(r.request().url()).searchParams.get('market') === 'global'
      ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(USD) })
      : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RUB) })));
    await page.goto(`/en/esim/${c.slug}/`);
    await page.waitForFunction(() => !document.querySelector('#status') || document.querySelector('#status').hidden);
    const site = await siteBlocks(page, 'en');
    expect(site).toEqual(expected(USD, c.iso));

    const app = await context.newPage();
    await installMiniApp(app, { languageCode: 'en', catalogue: RUB, globalCatalogue: USD });
    await app.addInitScript(() => { try { localStorage.setItem('mesim.market', 'global'); } catch (_) {} });
    await openApp(app);
    await openInApp(app, c.en);
    expect(await appBlocks(app)).toEqual(site);
  });
}
