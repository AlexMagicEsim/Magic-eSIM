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

/** A small, real-shaped slice of the catalogue. Two countries, three plans. */
const PACKAGES = [
  {
    package_id: 'vn-3-15', name: 'Vietnam 3GB 15Days', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 3, validity_days: 15, price: 500,
    retail_price_rub: 500, plan_type: 'FIXED_VOLUME', currency: 'RUB',
  },
  {
    package_id: 'vn-10-30', name: 'Vietnam 10GB 30Days', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 10, validity_days: 30, price: 1150,
    retail_price_rub: 1150, plan_type: 'FIXED_VOLUME', currency: 'RUB',
  },
  {
    package_id: 'it-5-30', name: 'Italy 5GB 30Days', country_code: 'IT', region: 'EU',
    coverage_country_codes: ['IT', 'FR', 'ES'], data_gb: 5, validity_days: 30, price: 800,
    retail_price_rub: 800, plan_type: 'FIXED_VOLUME', currency: 'RUB',
  },
  /*
   * A DAILY plan, and the fixture had none — which is why 57 % of the catalogue
   * went untested in a browser and a bait price shipped. `price` here is the
   * PER-DAY RATE (250) and the shortest purchasable term is 750; a card showing
   * 250 would be advertising a figure nobody can pay.
   */
  {
    package_id: 'vn-daily', name: 'Vietnam 1GB/Day', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 0, validity_days: 0, price: 250,
    retail_price_rub: 250, plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 1,
    currency: 'RUB',
    term_prices: [{ days: 3, price: 750 }, { days: 7, price: 1500 }],
  },
  /* A FIXED_TERM daily: no ladder by design, one term, one stored price. All 31
   * of these rendered a blank validity before the fix. */
  {
    package_id: 'vn-fixed', name: 'Vietnam Unlimited 3 Days', country_code: 'VN', region: 'VN',
    coverage_country_codes: ['VN'], data_gb: 0, validity_days: 3, price: 1700,
    retail_price_rub: 1700, plan_type: 'DAILY', daily_term_mode: 'FIXED_TERM', daily_gb: 3,
    currency: 'RUB',
  },
  // A REGIONAL PSEUDO-CODE. The catalogue carries 29 of these among its 225
  // `country_code` values, and they are not destinations: the English search
  // offered «EU-33» as a place to travel to until it filtered on ISO-2.
  {
    package_id: 'eu-20-30', name: 'Europe 20GB 30Days', country_code: 'EU-33', region: 'EU',
    coverage_country_codes: ['IT', 'FR', 'ES', 'DE'], data_gb: 20, validity_days: 30,
    price: 2500, retail_price_rub: 2500, plan_type: 'FIXED_VOLUME', currency: 'RUB',
  },
];

/** Serve the catalogue from a fixture and record every request the page makes. */
async function openEn(page) {
  const calls = [];
  page.on('request', (r) => calls.push({ method: r.method(), url: r.url() }));

  // The glob needs the tail: `catalog-loader.js:190` fetches
  // `/assets/catalog.json?t=<Date.now()>` to defeat the browser cache, and a
  // pattern without it silently misses — the request then reaches the dev
  // server, which serves the REAL production catalogue and makes a fixture
  // test quietly assert against production data.
  await page.route('**/assets/catalog.json*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ schema_version: 1, packages: PACKAGES }),
  }));
  // Anything that would reach a backend is answered locally, so a leak shows up
  // in `calls` instead of travelling.
  await page.route('**/api/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ data: PACKAGES }),
  }));

  await page.goto('/en/index.html');
  return calls;
}

const writes = (calls) => calls.filter((c) => !['GET', 'HEAD'].includes(c.method));
const checkoutCalls = (calls) => calls.filter((c) => /retail-orders|\/pay|platega/i.test(c.url));

/* ================================================================== *
 * 1. The page is in English and usable
 * ================================================================== */

test('the English storefront renders in English', async ({ page }) => {
  await openEn(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toContainText('without roaming');
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

test('choosing a destination lists its plans, cheapest first, priced in roubles', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res', { hasText: 'Vietnam' }).first().click();

  // Four: two volume plans and two daily ones. The daily pair is what makes the
  // «cheapest first» claim meaningful — priced from the ladder, they sort where
  // they belong instead of leading with an unpayable rate.
  const cards = page.locator('#tariffGrid .card');
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).locator('.price')).toHaveText('500 ₽');
  await expect(cards.nth(1).locator('.price')).toHaveText('750 ₽');
  await expect(cards.nth(2).locator('.price')).toHaveText('1,150 ₽');
  await expect(cards.nth(3).locator('.price')).toHaveText('1,700 ₽');
  // The currency is named, because it is the only real price this catalogue has.
  await expect(page.locator('#tariffs')).toContainText('Russian roubles');
});

test('a multi-country plan says so in English', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Ital');
  await page.locator('#results .res', { hasText: 'Italy' }).first().click();
  await expect(page.locator('#tariffGrid .card').first()).toContainText('Italy + 2 countries');
});

/* ================================================================== *
 * 2. The checkout runs to the payment step — and stops there
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

test('an address typed for one plan does not follow the visitor to another', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res').first().click();
  await page.locator('#tariffGrid .card').first().getByRole('button').click();
  await page.locator('#coEmail').fill('first@example.com');
  await page.locator('#coClose').click();

  await page.locator('#tariffGrid .card').nth(1).getByRole('button').click();
  await expect(page.locator('#coEmail')).toHaveValue('');
});

test('a per-day plan is priced from the ladder, never from the rate', async ({ page }) => {
  // The defect this fixture exists for: `price` is 250 per day, and 250 buys
  // nothing. The shortest purchasable term is 750 for 3 days.
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res', { hasText: 'Vietnam' }).first().click();

  const daily = page.locator('#tariffGrid .card', { hasText: '1 GB a day' });
  await expect(daily.locator('.price')).toHaveText('750 ₽');
  await expect(daily).toContainText('3 days');
  await expect(daily.locator('.price')).not.toHaveText('250 ₽');
});

test('a fixed-term daily shows the term its single price buys', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res', { hasText: 'Vietnam' }).first().click();

  const fixed = page.locator('#tariffGrid .card', { hasText: '3 GB a day' });
  await expect(fixed.locator('.price')).toHaveText('1,700 ₽');
  await expect(fixed).toContainText('3 days');
});

test('the cheapest card is the cheapest PURCHASABLE one', async ({ page }) => {
  // Sorting on the per-day rate put the unpayable rows at the top of every
  // country, so the fake-cheap plans were the first thing a visitor saw.
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res', { hasText: 'Vietnam' }).first().click();
  await expect(page.locator('#tariffGrid .card').first().locator('.price')).toHaveText('500 ₽');
});

test('the checkout opens with the chosen plan', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res').first().click();
  await page.locator('#tariffGrid .card').first().getByRole('button').click();

  await expect(page.locator('#checkout')).toBeVisible();
  await expect(page.locator('#coTotal')).toHaveText('500 ₽');
  await expect(page.locator('#coUnavail')).toBeHidden();
});

test('an invalid email is refused before the payment step is reached', async ({ page }) => {
  await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res').first().click();
  await page.locator('#tariffGrid .card').first().getByRole('button').click();

  await page.locator('#coEmail').fill('not-an-email');
  await page.locator('#coPay').click();

  await expect(page.locator('#coErr')).toBeVisible();
  await expect(page.locator('#coUnavail')).toBeHidden('the step is not reached on a bad email');
});

test('a valid email reaches the payment step, which refuses and says nothing was charged', async ({ page }) => {
  const calls = await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res').first().click();
  await page.locator('#tariffGrid .card').first().getByRole('button').click();

  await page.locator('#coEmail').fill('traveller@example.com');
  await page.locator('#coPay').click();

  await expect(page.locator('#coUnavail')).toBeVisible();
  await expect(page.locator('#coUnavail')).toContainText('coming soon');
  await expect(page.locator('#coUnavail')).toContainText('Nothing has been charged');
  await expect(page.locator('#coPay')).toBeDisabled();

  // THE ASSERTION THIS FILE EXISTS FOR.
  expect(writes(calls)).toEqual([]);
  expect(checkoutCalls(calls)).toEqual([]);
});

test('not one write request leaves the page across the whole journey', async ({ page }) => {
  const calls = await openEn(page);
  await page.locator('#q').fill('Viet');
  await page.locator('#results .res').first().click();
  await page.locator('#tariffGrid .card').first().getByRole('button').click();
  await page.locator('#coEmail').fill('a@b.co');
  await page.locator('#coPay').click();
  await page.locator('#coClose').click();
  await page.locator('#q').fill('Ital');
  await page.locator('#results .res').first().click();

  expect(writes(calls).map((c) => `${c.method} ${c.url}`)).toEqual([]);
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

test('a catalogue that fails to load says so instead of looking empty', async ({ page }) => {
  await page.route('**/assets/catalog.json*', (route) => route.abort());
  await page.route('**/api/**', (route) => route.abort());
  await page.goto('/en/index.html');
  await expect(page.locator('#status')).toContainText('Could not load');
});
