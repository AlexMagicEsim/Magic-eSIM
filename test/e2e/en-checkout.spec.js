'use strict';

/*
 * The GLOBAL checkout on /en/esim/<country>/, walked to the payment step and
 * no further — in a real browser, at 390 and 320.
 *
 * THE NETWORK IS THE ASSERTION. Every request is recorded. The only write the
 * page may ever make is POST /api/v1/global/quotes with { package_id, days };
 * the tests fail on any other write, on any order/payment path, on the email
 * appearing in any request, and on any rouble source.
 */

const { test, expect } = require('@playwright/test');

const ID = {
  ae3: '0d504f79-eab1-40dc-891a-c1f60cf11f06',
  ae5: '1a2b3c4d-0000-4000-8000-000000000005',
  aeDaily: '1a2b3c4d-0000-4000-8000-0000000000d1',
  best: '1a2b3c4d-0000-4000-8000-0000000000b3',
  th3: '1a2b3c4d-0000-4000-8000-000000000073',
  thDaily: '5999d3b5-425e-4f0a-9601-2c6d72ceb303',
  pf10: '1a2b3c4d-0000-4000-8000-0000000000f0',
};

const vol = (id, name, codes, gb, days, price) => ({
  package_id: id, name, country_code: codes.length === 1 ? codes[0] : 'XX-9', region: codes.join(', '),
  coverage_country_codes: codes, data_gb: gb, validity_days: days, price, plan_type: 'FIXED_VOLUME', currency: 'USD',
});
const perDay = (id, name, codes, gbPerDay, rate, ladder) => ({
  package_id: id, name, country_code: codes[0], region: codes.join(', '), coverage_country_codes: codes,
  data_gb: 0, validity_days: 0, price: rate, plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: gbPerDay,
  currency: 'USD', term_prices: ladder.map(([d, p]) => ({ days: d, price: p })),
});

const PACKAGES = [
  vol(ID.ae3, 'United Arab Emirates 3GB 30Days', ['AE'], 3, 30, 9.99),
  vol(ID.ae5, 'United Arab Emirates 5GB 30Days', ['AE'], 5, 30, 19.99),
  perDay(ID.aeDaily, 'United Arab Emirates 500MB/Day', ['AE'], 0.49, 2.99, [[3, 8.99], [7, 19.99]]),
  vol(ID.best, 'Best World 3 GB', ['AL', 'AE', 'PF', 'TH'], 3, 30, 35.99),
  vol(ID.th3, 'Thailand 3GB 15Days', ['TH'], 3, 15, 4.99),
  perDay(ID.thDaily, 'Singapore & Malaysia & Thailand 500MB/Day', ['SG', 'MY', 'TH'], 0.49, 1.99,
    [[3, 4.99], [5, 7.99], [7, 10.99], [10, 14.99]]),
  vol(ID.pf10, 'French Polynesia 10GB 30Days', ['PF'], 10, 30, 214.99),
];
const BY_ID = Object.fromEntries(PACKAGES.map((p) => [p.package_id, p]));

/** What the server would quote: the catalogue figure for that term (or an override). */
function serverQuote(body, { amountFor } = {}) {
  const p = BY_ID[body.package_id];
  if (!p) return { status: 404, body: { status: 'error', error: 'GLOBAL_PACKAGE_UNAVAILABLE' } };
  let amount = p.price;
  if (p.daily_term_mode === 'PER_DAY') {
    const t = p.term_prices.find((x) => x.days === body.days);
    if (!t) return { status: 400, body: { status: 'error', error: 'GLOBAL_TERM_REQUIRED' } };
    amount = t.price;
  }
  if (amountFor) amount = amountFor(body, amount);
  return { status: 200, body: { quote_id: '3fbced54-1111-4222-8333-444455556666', package_id: body.package_id,
    days: p.daily_term_mode === 'PER_DAY' ? body.days : null, currency: 'USD', amount,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() } };
}

/**
 * Serve the GLOBAL catalogue and the quote route from fixtures and record every
 * request. `quote` overrides the quote answer.
 */
async function open(page, path, { quote, amountFor, beforeGoto } = {}) {
  const calls = [];
  const quoteBodies = [];
  page.on('request', (r) => calls.push({ method: r.method(), url: r.url(), body: r.postData() || '' }));
  await page.route('**/assets/catalog.json*', (route) => route.fulfill({ status: 500, body: 'must not be asked' }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (req.method() === 'GET' && /\/api\/v1\/retail\/packages\?market=global$/.test(url)) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: PACKAGES }) });
    }
    if (req.method() === 'POST' && /\/api\/v1\/global\/quotes$/.test(url)) {
      const body = JSON.parse(req.postData() || '{}');
      quoteBodies.push(body);
      if (quote === 'abort') return route.abort();
      const r = quote ? quote(body) : serverQuote(body, { amountFor });
      return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
    }
    return route.fulfill({ status: 500, body: 'must not be asked' });
  });
  if (beforeGoto) await beforeGoto();
  await page.goto(path);
  await expect(page.locator('#status')).toBeHidden();
  return { calls, quoteBodies };
}

const cardBtn = (page, block, text) => page.locator(`#${block}Grid .card`, { hasText: text }).first().getByRole('button');

/** Requests that must never happen, whatever the flow did. */
function assertClean(calls, email) {
  const writes = calls.filter((c) => !['GET', 'HEAD'].includes(c.method));
  expect(writes.filter((c) => !/\/api\/v1\/global\/quotes$/.test(c.url)).map((c) => `${c.method} ${c.url}`)).toEqual([]);
  expect(calls.filter((c) => /retail-orders|\/orders|platega|flitt|\/pay\b|payments|fulfil/i.test(c.url))).toEqual([]);
  expect(calls.filter((c) => /catalog\.json/.test(c.url))).toEqual([]);
  if (email) {
    expect(calls.filter((c) => c.url.includes(email) || c.body.includes(email) || c.url.includes(encodeURIComponent(email)))).toEqual([]);
  }
}

/* ================================================================== *
 * The whole flow, on the plan the owner priced by hand: UAE 3 GB $9.99
 * ================================================================== */

test('UAE 3 GB: plan → server price $9.99 → email → review → payment not available, and only one quote is sent', async ({ page }) => {
  const { calls, quoteBodies } = await open(page, '/en/esim/uae/');
  await cardBtn(page, 'local', '3 GB').click();

  // Step 1 — the plan, the listed price, and nothing sent yet.
  await expect(page.locator('#coData')).toHaveText('3 GB');
  await expect(page.locator('#coCoverage')).toHaveText('United Arab Emirates');
  await expect(page.locator('#coTerm')).toHaveText('30 days');
  await expect(page.locator('#coListed')).toHaveText('$9.99');
  await expect(page.locator('#coTermPick')).toBeHidden();
  expect(quoteBodies).toEqual([]);

  // Step 2 — the server fixes the price.
  await page.locator('#coQuote').click();
  await expect(page.locator('#coStep2')).toBeVisible();
  await expect(page.locator('#coTotal')).toHaveText('$9.99');
  await expect(page.locator('#coExpiry')).toContainText(/Price held for (30:00|29:5\d)/);
  await expect(page.locator('#coPriceChanged')).toBeHidden();
  expect(quoteBodies).toEqual([{ package_id: ID.ae3, days: null }]);

  // The form refuses a typo and an unconfirmed device, and says so.
  await page.locator('#coReview').click();
  await expect(page.locator('#coFormError')).toHaveText('Please enter a valid email address.');
  await page.locator('#coEmail').fill('traveller@example.com');
  await page.locator('#coReview').click();
  await expect(page.locator('#coFormError')).toHaveText('Please confirm your phone supports eSIM.');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();

  // Step 3 — everything the visitor chose, and the plain status.
  await expect(page.locator('#coStep3')).toBeVisible();
  await expect(page.locator('#rvCoverage')).toHaveText('United Arab Emirates');
  await expect(page.locator('#rvData')).toHaveText('3 GB');
  await expect(page.locator('#rvTerm')).toHaveText('30 days');
  await expect(page.locator('#rvEmail')).toHaveText('traveller@example.com');
  await expect(page.locator('#rvTotal')).toHaveText('$9.99');
  // Each fact once: no «eSIM plan» row repeating the data line.
  await expect(page.locator('#checkout .rows span', { hasText: 'eSIM plan' })).toHaveCount(0);
  expect(await page.locator('#coStep3 .rows > div > span').allInnerTexts()).toEqual(['Coverage', 'Data', 'Validity', 'Email', 'Price']);
  await expect(page.locator('#coFinal')).toContainText('Online payment is not available yet');
  await expect(page.locator('#coFinal')).toContainText('nothing has been charged, no order has been created and no eSIM will be sent');
  await expect(page.locator('#coFinal')).toContainText('Your email has not been sent or saved');
  const pay = page.locator('#coPay');
  await expect(pay).toBeDisabled();
  await expect(pay).toHaveText('Payment not available yet');
  await pay.click({ force: true });          // a disabled button does nothing, even forced
  await expect(page.locator('#coStep3')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator('body').innerText()).not.toMatch(/₽|rouble|\bRUB\b/i);

  // Back to the form keeps the quote; closing drops the email.
  await page.locator('#coBack').click();
  await expect(page.locator('#coStep2')).toBeVisible();
  await page.keyboard.press('Escape');
  await cardBtn(page, 'local', '3 GB').click();
  await expect(page.locator('#coStep1')).toBeVisible();
  await expect(page.locator('#coEmail')).toHaveValue('');

  expect(quoteBodies.length).toBe(1);
  assertClean(calls, 'traveller@example.com');
  // Nothing was stored in the browser either.
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie])).toEqual([0, 0, '']);
});

/* ================================================================== *
 * A per-day plan is quoted for the duration chosen
 * ================================================================== */

test('Thailand per-day: the duration is chosen from the ladder and quoted for exactly those days', async ({ page }) => {
  const { calls, quoteBodies } = await open(page, '/en/esim/thailand/');
  await cardBtn(page, 'daily', '500 MB a day').click();
  await expect(page.locator('#coTermPick')).toBeVisible();
  await expect(page.locator('#coDays option')).toHaveText(['3 days', '5 days', '7 days', '10 days']);
  await expect(page.locator('#coCoverage')).toHaveText('3 countries, incl. Thailand');
  await page.locator('#coDays').selectOption('7');
  await expect(page.locator('#coTerm')).toHaveText('7 days');
  await expect(page.locator('#coListed')).toHaveText('$10.99');
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$10.99');
  expect(quoteBodies).toEqual([{ package_id: ID.thDaily, days: 7 }]);

  // Changing the duration throws the held price away — back to step 1.
  await page.locator('#coDays').selectOption('3');
  await expect(page.locator('#coStep1')).toBeVisible();
  await expect(page.locator('#coTotal')).toHaveText('—');
  await expect(page.locator('#coListed')).toHaveText('$4.99');
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  expect(quoteBodies).toEqual([{ package_id: ID.thDaily, days: 7 }, { package_id: ID.thDaily, days: 3 }]);
  assertClean(calls);
});

test('Thailand local 3 GB is quoted without days', async ({ page }) => {
  const { quoteBodies } = await open(page, '/en/esim/thailand/');
  await cardBtn(page, 'local', '3 GB').click();
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  expect(quoteBodies).toEqual([{ package_id: ID.th3, days: null }]);
});

/* ================================================================== *
 * French Polynesia — local and regional
 * ================================================================== */

test('French Polynesia: the local 10 GB and the regional Best World each go through to review', async ({ page }) => {
  const { calls, quoteBodies } = await open(page, '/en/esim/french-polynesia/');
  await cardBtn(page, 'local', '10 GB').click();
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$214.99');
  await page.locator('#coEmail').fill('pf@example.org');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  await expect(page.locator('#rvTotal')).toHaveText('$214.99');
  await expect(page.locator('#rvCoverage')).toHaveText('French Polynesia');
  await page.locator('#coClose').click();

  await cardBtn(page, 'regional', '3 GB').click();
  await expect(page.locator('#coCoverage')).toHaveText('4 countries, incl. French Polynesia');
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$35.99');
  expect(quoteBodies.map((b) => b.package_id)).toEqual([ID.pf10, ID.best]);
  assertClean(calls, 'pf@example.org');
});

/* ================================================================== *
 * The server's price wins, and it does not last for ever
 * ================================================================== */

test('when the server quotes a different price, the server\'s price is the one shown — and it says so', async ({ page }) => {
  await open(page, '/en/esim/uae/', { amountFor: () => 10.99 });
  await cardBtn(page, 'local', '3 GB').click();
  await expect(page.locator('#coListed')).toHaveText('$9.99');
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$10.99');
  await expect(page.locator('#coPriceChanged')).toHaveText('The price has been updated since the list was loaded.');
  await page.locator('#coEmail').fill('a@example.com');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  await expect(page.locator('#rvTotal')).toHaveText('$10.99');
});

test('an expired price stops the flow until the visitor asks for a new one — never automatically', async ({ page }) => {
  // The browser's clock is fake and jumps ahead; the fixture's is real. The
  // second quote is therefore issued far enough ahead to be valid in the
  // browser's future — exactly what a real server would answer at that moment.
  let n = 0;
  const quote = (b) => {
    n += 1;
    const r = serverQuote(b);
    r.body.expires_at = new Date(Date.now() + (n === 1 ? 30 : 120) * 60 * 1000).toISOString();
    return r;
  };
  const { quoteBodies } = await open(page, '/en/esim/uae/', { quote, beforeGoto: () => page.clock.install() });
  await cardBtn(page, 'local', '3 GB').click();
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$9.99');
  await page.locator('#coEmail').fill('late@example.com');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  await expect(page.locator('#coStep3')).toBeVisible();

  await page.clock.fastForward('31:00');
  await expect(page.locator('#coStep2')).toBeVisible();
  await expect(page.locator('#coExpiry')).toHaveText('This price has expired. Get a new price to continue.');
  await expect(page.locator('#coTotal')).toHaveText('—');
  await expect(page.locator('#coReview')).toBeDisabled();
  await expect(page.locator('#coRequote')).toBeVisible();
  await page.clock.fastForward('10:00');
  expect(quoteBodies.length).toBe(1);        // nothing re-quoted on its own

  await page.locator('#coRequote').click();
  await expect(page.locator('#coTotal')).toHaveText('$9.99');
  await expect(page.locator('#coReview')).toBeEnabled();
  await expect(page.locator('#coEmail')).toHaveValue('late@example.com');
  expect(quoteBodies.length).toBe(2);
});

test('a double click sends one quote', async ({ page }) => {
  const { quoteBodies } = await open(page, '/en/esim/uae/', {
    quote: (b) => serverQuote(b),
  });
  await cardBtn(page, 'local', '3 GB').click();
  await page.locator('#coQuote').dblclick();
  await expect(page.locator('#coTotal')).toHaveText('$9.99');
  expect(quoteBodies.length).toBe(1);
});

/* ================================================================== *
 * When there is no quote, there is no step 2 — and never a rouble
 * ================================================================== */

for (const [name, quote, message] of [
  ['the GLOBAL lane switched off (503)', () => ({ status: 503, body: { status: 'error', error: 'GLOBAL_PRICING_DISABLED' } }),
    'The price is temporarily unavailable. Please try again later.'],
  ['a plan the rules hid since the list loaded (404)', () => ({ status: 404, body: { status: 'error', error: 'GLOBAL_PACKAGE_UNAVAILABLE' } }),
    'This plan is no longer available. Please choose another one.'],
  ['too many quotes (429)', () => ({ status: 429, body: { error: 'TOO_MANY_REQUESTS' } }),
    'Too many requests. Please wait a minute and try again.'],
  ['a rouble answer', (b) => ({ status: 200, body: { ...serverQuote(b).body, currency: 'RUB', amount: 870 } }),
    'The price is temporarily unavailable. Please try again later.'],
  ['a quote for another package', (b) => ({ status: 200, body: { ...serverQuote(b).body, package_id: ID.ae5 } }),
    'The price is temporarily unavailable. Please try again later.'],
  ['no connection', 'abort', 'Could not reach the server. Check your connection and try again.'],
]) {
  test(`no quote → no checkout: ${name}`, async ({ page }) => {
    const { calls, quoteBodies } = await open(page, '/en/esim/uae/', { quote });
    await cardBtn(page, 'local', '3 GB').click();
    await page.locator('#coQuote').click();
    await expect(page.locator('#coQuoteStatus')).toHaveText(message);
    await expect(page.locator('#coStep1')).toBeVisible();
    await expect(page.locator('#coStep2')).toBeHidden();
    await expect(page.locator('#coTotal')).toHaveText('—');
    await expect(page.locator('#coQuote')).toBeEnabled();      // the visitor may try again by hand
    expect(quoteBodies.length).toBe(1);
    expect(await page.locator('#checkout').innerText()).not.toMatch(/₽|rouble|\bRUB\b|870/i);
    assertClean(calls);
  });
}
