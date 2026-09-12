'use strict';

/*
 * What happens on the price screen, and how the customer leaves it.
 *
 * WHY THIS FILE EXISTS. Two paid placements ran on 2026-09-07
 * (telega_vietnamnews, telega_nationalgeo). Between them, 19 people opened the
 * Mini App, 12 reached a country, 5 opened a tariff and 0 reached the form.
 * The funnel could say that much and not one thing more: `tariff_select` was
 * the last row those five ever produced, so «refused the price on sight» and
 * «read the screen for a minute and decided against it» were the same silence,
 * and so was «closed the app right there».
 *
 * Four events close that gap, and this file is what keeps them honest. They
 * add no field — the name carries the meaning and `country_code` stays the
 * only context — so the property under test is entirely about WHEN each one
 * fires and how often:
 *
 *   select → checkout_open   advanced to the form
 *   select → tariff_exit     left; the interval between the rows is the dwell
 *   select → neither         closed the app ON the price screen
 *
 * The third reading is the fragile one and the reason the second event has to
 * exist: an ABSENT row only means something once a present one is possible. If
 * `tariff_exit` ever stops firing on an ordinary back-out, every one of those
 * exits silently becomes an app-close in the analysis, and the number will
 * look plausible while being wrong. Hence the assertions below are as much
 * about the event NOT being sent (on the way to checkout) as about it being
 * sent.
 */

const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, eventsSent } = require('./harness.js');

/* ------------------------------------------------------------------ *
 * Fixture — three shapes, because the screen differs by shape.
 * ------------------------------------------------------------------ */

const base = {
  country_code: 'VN',
  region: 'VN',
  networks: [{ operator: 'Viettel Mobile', type: '4G' }],
  activation_policy: 'first_data_usage',
  topup_available: true,
  network_technologies: ['3G', '4G', '5G'],
  speed: '3G/4G/5G',
  hotspot_supported: false,
  sellable_days: [],
};

const PACKAGES = [
  // 1. An ordinary single-country plan: no coverage sheet, no term ladder.
  //    The plain exit path is measured on this one.
  Object.assign({}, base, {
    package_id: 'vn-3-15',
    name: 'Vietnam 3GB 15Days',
    coverage_country_codes: ['VN'],
    data_gb: 3, validity_days: 15, price: 500, plan_type: 'FIXED_VOLUME',
  }),
  // 2. A regional plan, so the coverage sheet exists to be opened. Its whole
  //    reason for being on this screen is the question «does it cover where I
  //    am actually going», which is a doubt the price cannot answer.
  Object.assign({}, base, {
    package_id: 'apac-10-30',
    name: 'Asia 10GB 30Days',
    coverage_country_codes: ['VN', 'TH', 'SG'],
    data_gb: 10, validity_days: 30, price: 1900, plan_type: 'FIXED_VOLUME',
  }),
  // 3. A daily plan with a priced ladder, so the term picker renders.
  Object.assign({}, base, {
    package_id: 'vn-d1',
    name: 'Vietnam 1GB/Day',
    coverage_country_codes: ['VN'],
    data_gb: 0, validity_days: 0, price: 250,
    plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 1,
    daily_throttle_label: '512 Kbps', daily_throttle_continues: false,
    daily_reset_confirmed: false,
    ip_export: ['HK'],
    sellable_days: [3, 7, 30],
    term_prices: [{ days: 3, price: 750 }, { days: 7, price: 1500 }, { days: 30, price: 5250 }],
  }),
];

/** Home → Вьетнам → the tariff list. */
async function openVietnam(page) {
  await page.locator('#screen-home .tile', { hasText: 'Вьетнам' }).first().click();
  await page.locator('#screen-country[data-active]').waitFor();
  await expect(page.locator('#country-list .card--tariff').first()).toBeVisible();
}

/** A card by its visible text, then the tariff screen it opens. */
async function openTariff(page, cardText) {
  await page.locator('#country-list .card--tariff', { hasText: cardText }).first().click();
  await page.locator('#screen-tariff[data-active]').waitFor();
}

const sheet = (page, text) => page.locator('#screen-tariff details.sheet', { hasText: text });

/* ================================================================== *
 * 1. The three ways off the price screen
 * ================================================================== */

test('leaving the price screen without buying reports an exit, after the select', async ({ page }) => {
  const state = await installMiniApp(page, { packages: PACKAGES });
  await openApp(page);
  await openVietnam(page);
  await openTariff(page, '3 ГБ');

  await expect.poll(() => eventsSent(state)).toContain('tariff_select');

  await page.locator('#nav-esims').click();
  await expect.poll(() => eventsSent(state)).toContain('tariff_exit');

  // Order is the journey. A screen cannot be left before it is opened, and the
  // gap between these two rows is what the analysis reads as the dwell.
  const sent = eventsSent(state);
  expect(sent.indexOf('tariff_select')).toBeLessThan(sent.indexOf('tariff_exit'));
});

test('going on to the form is NOT an exit', async ({ page }) => {
  // The distinction the whole event rests on. If advancing also counted as
  // leaving, `tariff_exit` would fire on every visit and its ratio against
  // `tariff_select` would be a constant 1 — a number that looks like data and
  // measures nothing.
  const state = await installMiniApp(page, { packages: PACKAGES });
  await openApp(page);
  await openVietnam(page);
  await openTariff(page, '3 ГБ');

  await page.locator('#tariff-buy').click();
  await page.locator('#screen-checkout[data-active]').waitFor();
  await expect.poll(() => eventsSent(state)).toContain('checkout_open');

  expect(eventsSent(state)).not.toContain('tariff_exit');
});

test('closing the app on the price screen leaves select with nothing after it', async ({ page }) => {
  // The third reading, asserted as an absence — which is the only way it can
  // be asserted, and exactly why the other two tests exist to prove the
  // absence is informative rather than a broken beacon.
  const state = await installMiniApp(page, { packages: PACKAGES });
  await openApp(page);
  await openVietnam(page);
  await openTariff(page, '3 ГБ');

  await expect.poll(() => eventsSent(state)).toContain('tariff_select');
  await page.waitForTimeout(300);

  const sent = eventsSent(state);
  expect(sent).not.toContain('tariff_exit');
  expect(sent).not.toContain('checkout_open');
});

/* ================================================================== *
 * 2. What they touched before leaving
 * ================================================================== */

test('opening the compatibility sheet is reported once, however often it is folded', async ({ page }) => {
  const state = await installMiniApp(page, { packages: PACKAGES });
  await openApp(page);
  await openVietnam(page);
  await openTariff(page, '3 ГБ');

  const compat = sheet(page, 'Подойдёт ли мой телефон');
  await compat.locator('summary').click();
  await expect.poll(() => eventsSent(state).filter((e) => e === 'tariff_compat_open').length).toBe(1);

  // Fold and unfold. `toggle` fires on closing too, and a customer who folds
  // the sheet back has not doubted their phone twice.
  await compat.locator('summary').click();
  await compat.locator('summary').click();
  await page.waitForTimeout(300);
  expect(eventsSent(state).filter((e) => e === 'tariff_compat_open').length).toBe(1);
});

test('opening the coverage list on a regional plan is reported once', async ({ page }) => {
  const state = await installMiniApp(page, { packages: PACKAGES });
  await openApp(page);
  await openVietnam(page);

  // A multi-country plan is not a card in the country's own list: it forms a
  // REGION of its own and appears under «Также подойдут», one row down. That
  // is the only route to a tariff screen that draws the coverage sheet, so the
  // test has to walk it rather than reach for a card that is not there.
  await page.locator('#country-list', { hasText: 'Также подойдут' })
    .locator('text=Регион').first().click();
  await expect(page.locator('#country-list .card--tariff').first()).toBeVisible();
  await openTariff(page, '10 ГБ');

  await sheet(page, 'стран').first().locator('summary').click();
  await expect.poll(() => eventsSent(state).filter((e) => e === 'tariff_coverage_open').length).toBe(1);
});

test('changing the term is reported; re-tapping the chosen one is not', async ({ page }) => {
  const state = await installMiniApp(page, { packages: PACKAGES });
  await openApp(page);
  await openVietnam(page);
  await openTariff(page, 'в день');

  const terms = page.locator('#screen-tariff .daily-term');
  await expect(terms.first()).toBeVisible();

  // The first term is preselected, so tapping it changes nothing and must not
  // be reported as a change — it is also the likeliest stray tap on the screen.
  await terms.nth(0).click();
  await page.waitForTimeout(300);
  expect(eventsSent(state)).not.toContain('tariff_term_change');

  await terms.nth(1).click();
  await expect.poll(() => eventsSent(state).filter((e) => e === 'tariff_term_change').length).toBe(1);

  // A customer working the whole ladder is one fact, not three.
  await terms.nth(2).click();
  await page.waitForTimeout(300);
  expect(eventsSent(state).filter((e) => e === 'tariff_term_change').length).toBe(1);
});

/* ================================================================== *
 * 3. A visit, not a session
 * ================================================================== */

test('re-opening a tariff starts a fresh visit and can report again', async ({ page }) => {
  // Coalescing is per VISIT on purpose. Opening the same tariff twice is two
  // separate considerations and has to count twice, or the denominator of
  // every ratio on this screen quietly stops matching `tariff_select`.
  const state = await installMiniApp(page, { packages: PACKAGES });
  await openApp(page);
  await openVietnam(page);

  await openTariff(page, '3 ГБ');
  await sheet(page, 'Подойдёт ли мой телефон').locator('summary').click();
  await expect.poll(() => eventsSent(state).filter((e) => e === 'tariff_compat_open').length).toBe(1);

  await page.locator('#nav-esims').click();
  await expect.poll(() => eventsSent(state).filter((e) => e === 'tariff_exit').length).toBe(1);

  await page.locator('#nav-home').click();
  await openVietnam(page);
  await openTariff(page, '3 ГБ');
  await sheet(page, 'Подойдёт ли мой телефон').locator('summary').click();

  await expect.poll(() => eventsSent(state).filter((e) => e === 'tariff_select').length).toBe(2);
  await expect.poll(() => eventsSent(state).filter((e) => e === 'tariff_compat_open').length).toBe(2);
});

/* ================================================================== *
 * 4. The shape of the beacon
 * ================================================================== */

test('every tariff event carries the country and nothing else', async ({ page }) => {
  // The table has no free-text column and these events must not be the reason
  // it grows one. `track()` in core.js drops anything but country_code and
  // payment_method; this asserts the four new names inherit that.
  const state = await installMiniApp(page, { packages: PACKAGES });
  await openApp(page);
  await openVietnam(page);
  await openTariff(page, '3 ГБ');
  await sheet(page, 'Подойдёт ли мой телефон').locator('summary').click();
  await page.locator('#nav-esims').click();
  await expect.poll(() => eventsSent(state)).toContain('tariff_exit');

  const bodies = state.calls
    .filter((c) => c.path.endsWith('/api/v1/tma/events') && c.event)
    .filter((c) => String(c.event.event).startsWith('tariff_'))
    .map((c) => c.event);

  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) {
    expect(Object.keys(body).sort()).toEqual(['country_code', 'event']);
    expect(body.country_code).toBe('VN');
    // A purchase is what the Platega webhook says it is; no client event may
    // ever imply one.
    expect(body.event).not.toContain('payment_success');
  }
});
