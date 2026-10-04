'use strict';

/*
 * /en/ and /en/esim/<country>/ — walked end to end in a real browser,
 * including the step where they stop.
 *
 * WHY A BROWSER AND NOT THE SOURCE GATES. `seo/test-en-storefront.mjs` and
 * `seo/test-en-pages.mjs` read the shipped files as text and settle what they
 * CONTAIN. They cannot settle what a visitor actually experiences: whether a
 * country's plans land in the right block, whether prices are dollars, whether
 * the plan window refuses — and, the one that matters most, whether anything
 * leaves the browser when it does.
 *
 * THE NETWORK IS THE ASSERTION. Every request is recorded; the tests fail on
 * any write (POST/PUT/PATCH/DELETE), on any request to the checkout API, and
 * on any read of a rouble source. «GLOBAL cannot take money» and «/en/ never
 * shows roubles» stop being promises about code and become measurements.
 */

const { test, expect } = require('@playwright/test');

const vol = (id, name, codes, gb, days, price, extra = {}) => ({
  package_id: id, name, country_code: codes.length === 1 ? codes[0] : 'XX-9', region: codes.join(', '),
  coverage_country_codes: codes, data_gb: gb, validity_days: days, price, plan_type: 'FIXED_VOLUME', currency: 'USD', ...extra,
});
const perDay = (id, name, codes, gbPerDay, rate, ladder) => ({
  package_id: id, name, country_code: codes[0], region: codes.join(', '), coverage_country_codes: codes,
  data_gb: 0, validity_days: 0, price: rate, plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: gbPerDay,
  currency: 'USD', term_prices: ladder.map(([d, p]) => ({ days: d, price: p })),
});

/* 170 countries, as the real «Best World» — the regional plan French Polynesia
 * and the UAE both get, and which must read «…, incl. <this country>». */
const WORLD_170 = ['AL', 'AE', 'PF', 'TH', 'VN', 'IT', 'FR', 'OM']
  .concat(Array.from({ length: 300 }, (_, i) => String.fromCharCode(65 + Math.floor(i / 26), 65 + (i % 26))))
  .filter((c, i, a) => a.indexOf(c) === i && !['RU', 'UA', 'BY'].includes(c)).slice(0, 170);

/**
 * A small, real-shaped slice of the GLOBAL catalogue — what
 * `GET /api/v1/retail/packages?market=global` answers. Prices are the ones the
 * production GLOBAL lane quoted on 2026-10-04 for the same plans.
 */
const PACKAGES = [
  // United Arab Emirates: local, regional and daily.
  vol('ae-3-30', 'United Arab Emirates 3GB 30Days', ['AE'], 3, 30, 9.99),
  vol('ae-5-30', 'United Arab Emirates 5GB 30Days', ['AE'], 5, 30, 19.99),
  vol('dubai-50', 'Dubai 50 GB', ['AE'], 50, 30, 148.99),
  perDay('ae-500', 'United Arab Emirates 500MB/Day', ['AE'], 0.49, 2.99, [[3, 8.99], [7, 19.99]]),
  perDay('gulf-500', 'Gulf Region 500MB/Day', ['AE', 'OM', 'QA', 'SA', 'KW', 'BH'], 0.49, 4.66, [[3, 13.99]]),
  vol('best-3', 'Best World 3 GB', WORLD_170, 3, 30, 35.99),
  vol('best-10', 'Best World 10 GB', WORLD_170, 10, 30, 69.99),
  // A worldwide plan: never on a country page.
  vol('global-3', 'Global (120+ areas) 3GB 30Days', ['AE', 'TH', 'PF'], 3, 30, 39.99, { country_code: 'GL-120' }),
  // Thailand: local, regional (SE Asia) and daily.
  vol('th-3-15', 'Thailand 3GB 15Days', ['TH'], 3, 15, 4.99),
  vol('th-5-30', 'Thailand 5GB 30Days', ['TH'], 5, 30, 6.99),
  vol('sea-5', 'Singapore & Malaysia & Thailand 5GB', ['SG', 'MY', 'TH'], 5, 30, 8.99),
  perDay('th-500', 'Thailand 500MB/Day', ['TH'], 0.49, 1.33, [[3, 3.99]]),
  // French Polynesia: local and regional, no daily at all.
  vol('pf-3', 'French Polynesia 3GB 15Days', ['PF'], 3, 15, 73.99),
  vol('pf-5', 'French Polynesia 5GB 30Days', ['PF'], 5, 30, 119.99),
  vol('pf-10', 'French Polynesia 10GB 30Days', ['PF'], 10, 30, 214.99),
  // Vietnam: the per-day trap and a fixed-term daily.
  vol('vn-3', 'Vietnam 3GB 15Days', ['VN'], 3, 15, 4.99),
  perDay('vn-daily', 'Vietnam 1GB/Day', ['VN'], 1, 2.49, [[3, 6.99], [7, 15.99]]),
  { package_id: 'vn-fixed', name: 'Vietnam Unlimited 3 Days', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 0, validity_days: 3, price: 15.99,
    plan_type: 'DAILY', daily_term_mode: 'FIXED_TERM', daily_gb: 3, currency: 'USD' },
];

const GLOBAL_BODY = { status: 'success', market: 'global', count: PACKAGES.length, currency: 'USD', data: PACKAGES };

/**
 * Serve the GLOBAL catalogue from a fixture and record every request. Every
 * OTHER API path and the rouble snapshot answer too — so a leak shows up in
 * `calls` instead of travelling — with visibly wrong rouble data, and the tests
 * assert they are never asked.
 */
async function open(page, path, { globalStatus = 200, globalBody = GLOBAL_BODY } = {}) {
  const calls = [];
  page.on('request', (r) => calls.push({ method: r.method(), url: r.url() }));
  await page.route('**/assets/catalog.json*', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ schema_version: 1, packages: [{ package_id: 'rub', country_code: 'AE', price: 500, currency: 'RUB' }] }),
  }));
  await page.route('**/api/**', (route) => {
    if (/\/api\/v1\/retail\/packages\?market=global$/.test(route.request().url())) {
      return route.fulfill({ status: globalStatus, contentType: 'application/json', body: JSON.stringify(globalBody) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ status: 'success', currency: 'RUB', data: [{ package_id: 'rub', country_code: 'AE', price: 500 }] }) });
  });
  await page.goto(path);
  return calls;
}

const apiCalls = (calls) => calls.filter((c) => /\/api\//.test(c.url));
const roubleSources = (calls) => calls.filter((c) => /\/assets\/catalog\.json/.test(c.url)
  || (/\/api\//.test(c.url) && !/\/api\/v1\/retail\/packages\?market=global$/.test(c.url)));
const writes = (calls) => calls.filter((c) => !['GET', 'HEAD'].includes(c.method));
const checkoutCalls = (calls) => calls.filter((c) => /retail-orders|\/pay|platega|quotes|orders/i.test(c.url));

const cards = (page, block) => page.locator(`#${block}Grid .card`);
const prices = (page, block) => cards(page, block).locator('.price').allInnerTexts();

/* ================================================================== *
 * 1. The home: a way in, and nothing else
 * ================================================================== */

test('the home is in English, styled, and says it sells nothing before the search', async ({ page }) => {
  const calls = await open(page, '/en/index.html');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toContainText('without roaming');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(7, 9, 16)');
  const notice = page.locator('#previewNotice');
  await expect(notice).toBeInViewport();
  await expect(notice).toContainText("Online payment isn't available yet — plans can't be bought here yet");
  expect((await notice.boundingBox()).y).toBeLessThan((await page.locator('#q').boundingBox()).y);
  const body = (await page.locator('body').innerText()).replace(/Перейти на русскую версию/g, '');
  expect(body).not.toMatch(/[А-Яа-я]{4,}/);
  // The home reads NO catalogue at all — its destination list is static.
  expect(apiCalls(calls)).toEqual([]);
});

test('search finds a country by any word of its English name and links to its page', async ({ page }) => {
  const calls = await open(page, '/en/index.html');
  await page.locator('#q').fill('emirates');
  const hit = page.locator('#results a.res', { hasText: 'United Arab Emirates' });
  await expect(hit).toHaveAttribute('href', '/en/esim/uae/');
  await page.locator('#q').fill('polyn');
  await expect(page.locator('#results a.res').first()).toHaveText('French Polynesia');
  await page.locator('#q').fill('zzzz');
  await expect(page.locator('#results')).toContainText('No destination matches that name.');
  await page.locator('#q').fill('Thai');
  await page.locator('#results a.res', { hasText: 'Thailand' }).click();
  await expect(page).toHaveURL(/\/en\/esim\/thailand\/$/);
  await expect(page.locator('h1')).toHaveText('eSIM for Thailand');
  expect(writes(calls)).toEqual([]);
});

test('a regional pseudo-code is never offered as a destination', async ({ page }) => {
  await open(page, '/en/index.html');
  for (const q of ['EU', 'Europe', 'GL']) {
    await page.locator('#q').fill(q);
    await expect(page.locator('#results a.res', { hasText: /EU-\d|GL-\d/ })).toHaveCount(0);
  }
});

test('the destination list links every country, and is a template like them', async ({ page }) => {
  const calls = await open(page, '/en/esim/');
  await expect(page.locator('h1')).toHaveText('eSIM destinations');
  expect(await page.locator('.dest a').count()).toBeGreaterThan(190);
  await expect(page.locator('.dest a', { hasText: 'United Arab Emirates' })).toHaveAttribute('href', '/en/esim/uae/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  expect(apiCalls(calls)).toEqual([]);
});

/* ================================================================== *
 * 2. A country page: local, regional and daily, in US dollars
 * ================================================================== */

test('UAE: local, regional and daily plans, each in its own block, cheapest first, in dollars', async ({ page }) => {
  const calls = await open(page, '/en/esim/uae/');
  await expect(page.locator('h1')).toHaveText('eSIM for United Arab Emirates');
  await expect(page.locator('#status')).toBeHidden();

  expect(await prices(page, 'local')).toEqual(['$9.99', '$19.99', '$148.99']);
  expect(await prices(page, 'daily')).toEqual(['$8.99', '$13.99']);
  expect(await prices(page, 'regional')).toEqual(['$35.99', '$69.99']);
  await expect(page.locator('#localBlock h2')).toContainText('Plans for United Arab Emirates');
  await expect(page.locator('#regionalBlock h2')).toContainText('Regional plans that include United Arab Emirates');
  await expect(page.locator('#localCount')).toHaveText('3');
  // A regional card names THIS country, not the package's first code (Albania).
  await expect(cards(page, 'regional').first()).toContainText('170 countries, incl. United Arab Emirates');
  await expect(cards(page, 'daily').nth(1)).toContainText('6 countries, incl. United Arab Emirates');
  // The worldwide plan is not a plan FOR the UAE.
  expect(await page.locator('main').innerText()).not.toContain('$39.99');
  await expect(page.locator('#currencyNote')).toContainText('Prices in US dollars (USD)');
  expect(await page.locator('body').innerText()).not.toMatch(/₽|rouble|\bRUB\b/i);

  expect(apiCalls(calls).map((c) => `${c.method} ${new URL(c.url).pathname}${new URL(c.url).search}`))
    .toEqual(['GET /api/v1/retail/packages?market=global']);
  expect(roubleSources(calls)).toEqual([]);
});

test('Thailand: daily, local and an SE-Asia regional plan', async ({ page }) => {
  await open(page, '/en/esim/thailand/');
  expect(await prices(page, 'daily')).toEqual(['$3.99']);
  expect(await prices(page, 'local')).toEqual(['$4.99', '$6.99']);
  expect(await prices(page, 'regional')).toEqual(['$8.99', '$35.99', '$69.99']);
  await expect(cards(page, 'regional').first()).toContainText('3 countries, incl. Thailand');
});

test('French Polynesia: local and regional, and no empty daily block', async ({ page }) => {
  await open(page, '/en/esim/french-polynesia/');
  expect(await prices(page, 'local')).toEqual(['$73.99', '$119.99', '$214.99']);
  expect(await prices(page, 'regional')).toEqual(['$35.99', '$69.99']);
  await expect(page.locator('#dailyBlock')).toBeHidden();
  await expect(cards(page, 'regional').first()).toContainText('170 countries, incl. French Polynesia');
});

test('a per-day plan is priced from the ladder, never from the rate', async ({ page }) => {
  await open(page, '/en/esim/vietnam/');
  const daily = cards(page, 'daily');
  await expect(daily).toHaveCount(2);
  const perDayCard = daily.filter({ hasText: '1 GB a day' });
  await expect(perDayCard.locator('.price')).toHaveText('$6.99');
  await expect(perDayCard).toContainText('3 days');
  expect(await page.locator('main').innerText()).not.toContain('$2.49');
  // A fixed-term daily shows the term its single price buys.
  const fixed = daily.filter({ hasText: '3 GB a day' });
  await expect(fixed.locator('.price')).toHaveText('$15.99');
  await expect(fixed).toContainText('3 days');
});

test('a country the catalogue has nothing for says so, with no empty blocks', async ({ page }) => {
  await open(page, '/en/esim/japan/');
  await expect(page.locator('#status')).toHaveText('No plans for this destination yet.');
  for (const b of ['daily', 'local', 'regional']) await expect(page.locator(`#${b}Block`)).toBeHidden();
});

/* ================================================================== *
 * 3. The plan window: a preview that refuses, and asks for nothing
 * ================================================================== */

test('a plan opens the checkout: the refusal at once, and opening or closing it sends nothing', async ({ page }) => {
  // The quote — the one write on these pages — is a button press away, never
  // a side effect of looking. Its own flow is in en-checkout.spec.js.
  const calls = await open(page, '/en/esim/uae/');
  const cta = cards(page, 'local').first().getByRole('button');
  await expect(cta).toHaveText('View details');
  await cta.click();
  await expect(page.locator('#checkout')).toBeVisible();
  await expect(page.locator('#coTitle')).toHaveText('Checkout');
  await expect(page.locator('#coListed')).toHaveText('$9.99');
  await expect(page.locator('#coCoverage')).toHaveText('United Arab Emirates');
  await expect(page.locator('#coUnavail')).toContainText('Online payment is not available yet');
  await expect(page.locator('#coUnavail')).toContainText('no order or eSIM is created');
  await expect(page.locator('#coUnavail h4')).toBeInViewport();
  await expect(page.locator('#coStep2')).toBeHidden();
  await expect(page.locator('#checkout').getByRole('button', { name: /buy|continue|order|checkout/i })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(page.locator('#checkout')).toBeHidden();
  await cards(page, 'regional').first().getByRole('button').click();
  await expect(page.locator('#coCoverage')).toHaveText('170 countries, incl. United Arab Emirates');
  await page.locator('#coClose').click();
  await cards(page, 'daily').first().getByRole('button').click();
  await page.locator('#checkout').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#checkout')).toBeHidden();
  await expect(cards(page, 'local')).toHaveCount(3);

  // THE ASSERTIONS THIS FILE EXISTS FOR.
  expect(writes(calls).map((c) => `${c.method} ${c.url}`)).toEqual([]);
  expect(checkoutCalls(calls)).toEqual([]);
  expect(roubleSources(calls)).toEqual([]);
});

/* ================================================================== *
 * 4. When the GLOBAL lane has nothing to give
 * ================================================================== */

test('a GLOBAL lane switched off says prices are unavailable — and shows no roubles', async ({ page }) => {
  const calls = await open(page, '/en/esim/uae/', { globalStatus: 503, globalBody: { status: 'error', error: 'GLOBAL_PRICING_DISABLED' } });
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
  await expect(page.locator('.card')).toHaveCount(0);
  for (const b of ['daily', 'local', 'regional']) await expect(page.locator(`#${b}Block`)).toBeHidden();
  expect(await page.locator('body').innerText()).not.toMatch(/₽|rouble|\$\d/i);
  expect(roubleSources(calls)).toEqual([]);
  expect(writes(calls)).toEqual([]);
});

test('a busy GLOBAL lane (429) is unavailable too', async ({ page }) => {
  await open(page, '/en/esim/thailand/', { globalStatus: 429, globalBody: { status: 'error' } });
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
  await expect(page.locator('.card')).toHaveCount(0);
});

test('a 200 that is not a GLOBAL USD answer is refused, not rendered', async ({ page }) => {
  await open(page, '/en/esim/uae/', { globalBody: { status: 'success', currency: 'RUB', data: PACKAGES } });
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
  await expect(page.locator('.card')).toHaveCount(0);
});

test('a catalogue that cannot be reached says so instead of looking empty', async ({ page }) => {
  await page.route('**/assets/catalog.json*', (route) => route.abort());
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/en/esim/french-polynesia/');
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
});

/* ================================================================== *
 * 5. Leaving, and what a crawler is told
 * ================================================================== */

test('the language switch goes to the Russian twin, and nothing redirects by itself', async ({ page }) => {
  await open(page, '/en/esim/uae/');
  await expect(page.locator('a.langsw')).toHaveAttribute('href', '/esim/uae/');
  await expect(page.locator('a.langsw')).toHaveAttribute('hreflang', 'ru');
  expect(page.url()).toContain('/en/esim/uae/');
});

test('a country page is a noindex template with a self canonical and no hreflang', async ({ page }) => {
  await open(page, '/en/esim/french-polynesia/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://magicesim.store/en/esim/french-polynesia/');
  await expect(page.locator('link[hreflang]')).toHaveCount(0);
});

test('nothing on a country page overflows a narrow phone', async ({ page }) => {
  await open(page, '/en/esim/uae/');
  await expect(cards(page, 'local').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
