'use strict';

/*
 * /en/ — walked end to end in a real browser, including the step where it
 * stops.
 *
 * WHY A BROWSER AND NOT THE SOURCE GATES. `seo/test-en-storefront.mjs` reads
 * the shipped files as text and settles what they CONTAIN — no POST, a hidden
 * notice, a reciprocal hreflang. It cannot settle what a visitor actually
 * experiences: whether the catalogue renders in English, whether the checkout
 * opens, whether the payment step refuses, and — the one that matters most —
 * whether anything leaves the browser when it does.
 *
 * THE NETWORK IS THE ASSERTION. Every request the page makes is recorded, and
 * the test fails on any write (POST/PUT/PATCH/DELETE) and on any request to the
 * checkout API at all. «GLOBAL cannot take money» stops being a promise about
 * code and becomes a measurement of traffic.
 */

const { test, expect } = require('@playwright/test');

/**
 * A small, real-shaped slice of the GLOBAL catalogue — what
 * `GET /api/v1/retail/packages?market=global` answers: the same card fields as
 * the Russian catalogue, priced in US dollars by the GLOBAL lane.
 */
const PACKAGES = [
  {
    package_id: 'vn-3-15', name: 'Vietnam 3GB 15Days', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 3, validity_days: 15, price: 4.99,
    plan_type: 'FIXED_VOLUME', currency: 'USD',
  },
  {
    package_id: 'vn-10-30', name: 'Vietnam 10GB 30Days', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 10, validity_days: 30, price: 11.99,
    plan_type: 'FIXED_VOLUME', currency: 'USD',
  },
  {
    package_id: 'it-5-30', name: 'Italy 5GB 30Days', country_code: 'IT', region: 'EU',
    coverage_country_codes: ['IT', 'FR', 'ES'], data_gb: 5, validity_days: 30, price: 8.99,
    plan_type: 'FIXED_VOLUME', currency: 'USD',
  },
  /*
   * A PER_DAY plan. `price` is the PER-DAY RATE ($2.49) and one day is not sold;
   * the shortest purchasable term is $6.99 for 3 days. A card showing $2.49
   * would be advertising a figure nobody can pay.
   */
  {
    package_id: 'vn-daily', name: 'Vietnam 1GB/Day', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 0, validity_days: 0, price: 2.49,
    plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 1, currency: 'USD',
    term_prices: [{ days: 3, price: 6.99 }, { days: 7, price: 15.99 }],
  },
  /* A FIXED_TERM daily: no ladder by design, one term, one stored price. */
  {
    package_id: 'vn-fixed', name: 'Vietnam Unlimited 3 Days', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 0, validity_days: 3, price: 15.99,
    plan_type: 'DAILY', daily_term_mode: 'FIXED_TERM', daily_gb: 3, currency: 'USD',
  },
  // A REGIONAL PSEUDO-CODE: not a destination.
  {
    package_id: 'eu-20-30', name: 'Europe 20GB 30Days', country_code: 'EU-33', region: 'EU',
    coverage_country_codes: ['IT', 'FR', 'ES', 'DE'], data_gb: 20, validity_days: 30,
    price: 24.99, plan_type: 'FIXED_VOLUME', currency: 'USD',
  },
];

const GLOBAL_BODY = { status: 'success', market: 'global', count: PACKAGES.length, currency: 'USD', data: PACKAGES };

/**
 * Serve the GLOBAL catalogue from a fixture and record every request the page
 * makes. Every OTHER API path and the Russian rouble snapshot are answered too
 * — so a leak shows up in `calls` instead of travelling — but with data that
 * would be visibly wrong (roubles), and the tests assert they are never asked.
 */
async function openEn(page, { globalStatus = 200, globalBody = GLOBAL_BODY } = {}) {
  const calls = [];
  page.on('request', (r) => calls.push({ method: r.method(), url: r.url() }));
  await page.route('**/assets/catalog.json*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ schema_version: 1, packages: [{ package_id: 'rub', country_code: 'VN', price: 500, currency: 'RUB' }] }),
  }));
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    if (/\/api\/v1\/retail\/packages\?market=global$/.test(url)) {
      return route.fulfill({ status: globalStatus, contentType: 'application/json', body: JSON.stringify(globalBody) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ status: 'success', currency: 'RUB', data: [{ package_id: 'rub', country_code: 'VN', price: 500 }] }) });
  });
  await page.goto('/en/index.html');
  return calls;
}

/** Requests that must never happen on /en/: the rouble snapshot and any non-GLOBAL API read. */
const roubleSources = (calls) => calls.filter((c) => /\/assets\/catalog\.json/.test(c.url)
  || (/\/api\//.test(c.url) && !/\/api\/v1\/retail\/packages\?market=global$/.test(c.url)));

const writes = (calls) => calls.filter((c) => !['GET', 'HEAD'].includes(c.method));
const checkoutCalls = (calls) => calls.filter((c) => /retail-orders|\/pay|platega/i.test(c.url));

/* ================================================================== *
 * 1. The page is in English and usable
 * ================================================================== */

test('the English storefront renders in English', async ({ page }) => {
  await openEn(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toContainText('without roaming');
  // The stylesheet moved out of the page into /en/en.css: prove it is applied,
  // or a broken link would leave an unstyled page that every other test passes.
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(7, 9, 16)');
  // The only Russian allowed anywhere on this page is the link back.
  const body = await page.locator('body').innerText();
  const withoutSwitch = body.replace(/Перейти на русскую версию/g, '');
  expect(withoutSwitch).not.toMatch(/[А-Яа-я]{4,}/);
});

test('a destination search finds a country by its ENGLISH name', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await expect(page.locator('#results .res').first()).toHaveText('Vietnam');
});

test('choosing a destination lists its plans, cheapest first, priced in US dollars', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res', { hasText: 'Vietnam' }).first().click();

  // Four: two volume plans and two daily ones. The daily pair is what makes the
  // «cheapest first» claim meaningful — priced from the ladder, they sort where
  // they belong instead of leading with an unpayable rate.
  const cards = page.locator('#tariffGrid .card');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).locator('.price')).toHaveText('$4.99');
  await expect(cards.nth(1).locator('.price')).toHaveText('$6.99');
  await expect(cards.nth(2).locator('.price')).toHaveText('$11.99');
  await expect(cards.nth(3).locator('.price')).toHaveText('$15.99');
  await expect(page.locator('#tariffs')).toContainText('Prices in US dollars (USD)');
  expect(await page.locator('body').innerText()).not.toMatch(/₽|rouble/i);
});

test('a multi-country plan says so in English', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Ital');
  await page.locator('#results .res', { hasText: 'Italy' }).first().click();
  await expect(page.locator('#tariffGrid .card').first()).toContainText('Italy + 2 countries');
});

/* ================================================================== *
 * 2. A plan opens as a preview — there is no checkout on this page
 * ================================================================== */

test('a regional pseudo-code is never offered as a destination', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('EU');
  // It must not appear by code…
  await expect(page.locator('#results .res', { hasText: 'EU-33' })).toHaveCount(0);
  await page.locator('#q').fill('Europe');
  // …nor by the name it does not have.
  await expect(page.locator('#results .res', { hasText: 'EU-33' })).toHaveCount(0);
});

test('search finds a country by a word inside its name, not only the first one', async ({ page }) => {
  await openEn(page);
  // Prefix-only matching returned nothing for «korea» and «emirates». The
  // fixture has none of those, so this proves the property on Italy: «taly».
  await page.locator('#q').fill('taly');
  await expect(page.locator('#results .res').first()).toHaveText('Italy');
});

test('a multi-country plan uses the shared plural, not a local idiom', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Ital');
  await page.locator('#results .res', { hasText: 'Italy' }).first().click();
  await expect(page.locator('#tariffGrid .card').first()).toContainText('Italy + 2 countries');
});

test('the preview notice is on screen before the search, without any action', async ({ page }) => {
  await openEn(page);
  const notice = page.locator('#previewNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toBeInViewport();
  await expect(notice).toContainText("Checkout isn't open yet — plans can't be bought here yet");
  await expect(notice).toContainText('nothing can be ordered or charged on this page');
  const noticeBox = await notice.boundingBox();
  const searchBox = await page.locator('#q').boundingBox();
  expect(noticeBox.y).toBeLessThan(searchBox.y);
});

test('a per-day plan is priced from the ladder, never from the rate', async ({ page }) => {
  // The defect this fixture exists for: `price` is $2.49 per day, and that buys
  // nothing. The shortest purchasable term is $6.99 for 3 days.
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res', { hasText: 'Vietnam' }).first().click();

  const daily = page.locator('#tariffGrid .card', { hasText: '1 GB a day' });
  await expect(daily.locator('.price')).toHaveText('$6.99');
  await expect(daily).toContainText('3 days');
  await expect(daily.locator('.price')).not.toHaveText('$2.49');
});

test('a fixed-term daily shows the term its single price buys', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res', { hasText: 'Vietnam' }).first().click();

  const fixed = page.locator('#tariffGrid .card', { hasText: '3 GB a day' });
  await expect(fixed.locator('.price')).toHaveText('$15.99');
  await expect(fixed).toContainText('3 days');
});

test('the cheapest card is the cheapest PURCHASABLE one', async ({ page }) => {
  // Sorting on the per-day rate put the unpayable rows at the top of every
  // country, so the fake-cheap plans were the first thing a visitor saw.
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res', { hasText: 'Vietnam' }).first().click();
  await expect(page.locator('#tariffGrid .card').first().locator('.price')).toHaveText('$4.99');
});

test('a plan opens as a preview: the refusal is visible at once and nothing is asked', async ({ page }) => {
  const calls = await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res').first().click();
  const cta = page.locator('#tariffGrid .card').first().getByRole('button');
  await expect(cta).toHaveText('View details');
  await cta.click();

  await expect(page.locator('#checkout')).toBeVisible();
  await expect(page.locator('#coTitle')).toHaveText('Plan details');
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  await expect(page.locator('#coUnavail')).toBeVisible();
  await expect(page.locator('#coUnavail')).toContainText('Not available to buy yet');
  await expect(page.locator('#coUnavail')).toContainText('Nothing is charged and no order is created');
  // On the narrowest phone too: the refusal is the first thing in the window.
  await expect(page.locator('#coUnavail h4')).toBeInViewport();
  await expect(page.locator('#checkout input')).toHaveCount(0);
  await expect(page.locator('#checkout').getByRole('button', { name: /pay|buy|continue|order/i })).toHaveCount(0);

  // THE ASSERTION THIS FILE EXISTS FOR.
  expect(writes(calls)).toEqual([]);
  expect(checkoutCalls(calls)).toEqual([]);
});

test('not one write request leaves the page across the whole journey', async ({ page }) => {
  const calls = await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res').first().click();
  await page.locator('#tariffGrid .card').first().getByRole('button').click();
  await page.locator('#coClose').click();
  await page.locator('#tariffGrid .card').nth(1).getByRole('button').click();
  await page.keyboard.press('Escape');
  await page.locator('#q').fill('Ital');
  await page.locator('#results .res').first().click();

  expect(writes(calls).map((c) => `${c.method} ${c.url}`)).toEqual([]);
  // And the only data source was the GLOBAL catalogue: never the rouble snapshot,
  // never the Russian catalogue, never a quote.
  expect(roubleSources(calls).map((c) => `${c.method} ${c.url}`)).toEqual([]);
  expect(calls.filter((c) => /market=global/.test(c.url)).every((c) => c.method === 'GET')).toBe(true);
});

/* ================================================================== *
 * 3. Leaving, and coming back
 * ================================================================== */

test('the language switch is a link, and it does not redirect on its own', async ({ page }) => {
  await openEn(page);
  const href = await page.locator('a.langsw').getAttribute('href');
  expect(href).toBe('/');
  // Still on /en/ — nothing navigated by itself.
  expect(page.url()).toContain('/en/');
});

test('Escape and the overlay both close the checkout, and the page survives', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res').first().click();
  await page.locator('#tariffGrid .card').first().getByRole('button').click();

  await page.keyboard.press('Escape');
  await expect(page.locator('#checkout')).toBeHidden();
  // The tariff list is still there underneath.
  await expect(page.locator('#tariffGrid .card')).toHaveCount(4);
});

test('a GLOBAL lane that is switched off says prices are unavailable — and shows no roubles', async ({ page }) => {
  // Exactly production today: GLOBAL_PRICING_ENABLED unset → 503.
  const calls = await openEn(page, { globalStatus: 503, globalBody: { status: 'error', error: 'GLOBAL_PRICING_DISABLED' } });
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
  await page.locator('#q').fill('Viet');
  await expect(page.locator('#results .res')).toHaveCount(0);
  await expect(page.locator('#tariffGrid .card')).toHaveCount(0);
  expect(await page.locator('body').innerText()).not.toMatch(/₽|rouble|\$\d/i);
  expect(roubleSources(calls)).toEqual([]);
  expect(writes(calls)).toEqual([]);
});

test('a 200 that is not a GLOBAL USD answer is refused, not rendered', async ({ page }) => {
  await openEn(page, { globalBody: { status: 'success', currency: 'RUB', data: PACKAGES } });
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
  await expect(page.locator('#tariffGrid .card')).toHaveCount(0);
});

test('a catalogue that fails to load says so instead of looking empty', async ({ page }) => {
  await page.route('**/assets/catalog.json*', (route) => route.abort());
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/en/index.html');
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
});
