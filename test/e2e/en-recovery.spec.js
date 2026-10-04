'use strict';

/*
 * The English (GLOBAL) storefront when things go wrong — and how it recovers.
 * Real browser, 390 and 320. Every scenario asserts the three invariants:
 *   * no stale or mismatched price is ever shown as the price;
 *   * no request is repeated on its own, and a retry never runs two at once;
 *   * the visitor gets plain English — never a status code, a stack or a
 *     provider detail — and keyboard / screen-reader users keep their place.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const ID_PER_DAY = '5999d3b5-425e-4f0a-9601-2c6d72ceb303';
const ID_FIXED = '0d504f79-eab1-40dc-891a-c1f60cf11f06';
const PER_DAY = { package_id: ID_PER_DAY, name: 'Thailand 500MB/Day', country_code: 'TH', coverage_country_codes: ['TH'],
  plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 0.49, data_gb: 0, price: 1.99, currency: 'USD',
  term_prices: [{ days: 3, price: 4.99 }, { days: 7, price: 10.99 }] };
const FIXED = { package_id: ID_FIXED, name: 'Thailand 3GB', country_code: 'TH', coverage_country_codes: ['TH'],
  data_gb: 3, validity_days: 15, price: 4.99, currency: 'USD', plan_type: 'FIXED_VOLUME' };
const BODY = JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: [PER_DAY, FIXED] });
const quoteFor = (b, amount) => ({ quote_id: '3fbced54-1111-4222-8333-444455556666', package_id: b.package_id, days: b.days,
  currency: 'USD', amount, expires_at: new Date(Date.now() + 1800000).toISOString() });
const priceOf = (b) => (b.days === 7 ? 10.99 : b.days === 3 ? 4.99 : 4.99);

/** Route the API; `onQuote(body, n)` may return a promise to delay. Records every request. */
async function open(page, { catalogue, onQuote, path = '/en/esim/thailand/' } = {}) {
  const st = { cat: 0, quotes: [], calls: [], csp: [] };
  page.on('request', (r) => st.calls.push(`${r.method()} ${r.url()}`));
  page.on('console', (m) => { if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text()); });
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      st.cat += 1;
      const c = catalogue ? await catalogue(st.cat) : { status: 200, body: BODY };
      if (c === 'abort') return route.abort();
      return route.fulfill({ status: c.status, contentType: 'application/json', body: c.body });
    }
    const b = JSON.parse(req.postData());
    st.quotes.push(b);
    const r = onQuote ? await onQuote(b, st.quotes.length) : { status: 200, body: quoteFor(b, priceOf(b)) };
    if (r === 'abort') return route.abort();
    return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
  });
  await page.goto(path);
  return st;
}
const openDaily = (page) => page.locator('#dailyGrid .card').first().getByRole('button').click();
const openFixed = (page) => page.locator('#localGrid .card').first().getByRole('button').click();
const active = (page) => page.evaluate(() => ({ id: document.activeElement.id, tag: document.activeElement.tagName,
  inDialog: !!document.activeElement.closest('#checkout .modal'), visible: document.activeElement.offsetParent !== null }));
const TECH = /\b(4\d\d|5\d\d)\b|error|stack|undefined|null|NaN|exception|esimaccess|mobimatter|provider/i;

/* ================================================================== *
 * 1. A quote answer never lands on a different selection
 * ================================================================== */

test('changing the duration while a quote is in flight: the late answer is dropped, never shown as the price', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const st = await open(page, { onQuote: async (b) => { if (b.days === 7) await gate; return { status: 200, body: quoteFor(b, priceOf(b)) }; } });
  await openDaily(page);
  await page.locator('#coDays').selectOption('7');
  await page.locator('#coQuote').click();                // the 7-day quote is slow…
  await page.locator('#coDays').selectOption('3');       // …and the visitor switches to 3 days
  release();
  await page.waitForTimeout(400);
  await expect(page.locator('#coStep2')).toBeHidden();
  await expect(page.locator('#coTotal')).toHaveText('—');
  await expect(page.locator('#coListed')).toHaveText('$4.99');
  expect(await page.locator('#checkout').innerText()).not.toContain('$10.99');
  await expect(page.locator('#coQuote')).toBeEnabled();  // free to ask for the 3-day price
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  await expect(page.locator('#coTerm')).toHaveText('3 days');
  expect(st.quotes.map((q) => q.days)).toEqual([7, 3]);
});

test('closing the window during a quote and opening another plan: the late answer goes nowhere', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await open(page, { onQuote: async (b, n) => { if (n === 1) await gate; return { status: 200, body: quoteFor(b, n === 1 ? 10.99 : 4.99) }; } });
  await openDaily(page);
  await page.locator('#coDays').selectOption('7');
  await page.locator('#coQuote').click();
  await page.keyboard.press('Escape');
  await openFixed(page);
  release();
  await page.waitForTimeout(400);
  await expect(page.locator('#coStep1')).toBeVisible();
  await expect(page.locator('#coTotal')).toHaveText('—');
  await expect(page.locator('#coQuote')).toBeEnabled();
});

test('a double click, and «Get a new price» clicked twice, each send exactly one quote', async ({ page }) => {
  await page.clock.install();
  let n = 0;
  const st = await open(page, { onQuote: async (b) => { n += 1; return { status: 200, body: { ...quoteFor(b, 4.99),
    expires_at: new Date(Date.now() + (n === 1 ? 30 : 120) * 60000).toISOString() } }; } });
  await openFixed(page);
  await page.locator('#coQuote').dblclick();
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  expect(st.quotes.length).toBe(1);
  await page.clock.fastForward('31:00');
  await expect(page.locator('#coRequote')).toBeVisible();
  await page.locator('#coRequote').dblclick();
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  expect(st.quotes.length).toBe(2);
});

/* ================================================================== *
 * 2. Keyboard and screen-reader users keep their place
 * ================================================================== */

test('focus follows the steps instead of falling to the page, and is never stolen while typing', async ({ page }) => {
  await page.clock.install();
  // The browser's clock jumps ahead; each quote is issued valid in the browser's
  // own present, as a real server would answer at that moment.
  await open(page, { onQuote: async (b, n) => ({ status: 200, body: { ...quoteFor(b, 4.99),
    expires_at: new Date(Date.now() + [30, 61, 300, 300][Math.min(n, 4) - 1] * 60000).toISOString() } }) });
  await openFixed(page);
  await page.locator('#coQuote').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#coStep2')).toBeVisible();
  expect(await active(page)).toMatchObject({ id: 'coTotal', inDialog: true, visible: true });
  // Typing an email: an expiry does not move the caret.
  await page.locator('#coEmail').focus();
  await page.keyboard.type('a@example.com');
  await page.clock.fastForward('31:00');
  await expect(page.locator('#coRequote')).toBeVisible();
  expect((await active(page)).id).toBe('coEmail');
  // From review, an expiry hides the focused element: focus goes to «Get a new price».
  await page.locator('#coRequote').click();
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  expect(await active(page)).toMatchObject({ id: 'coFinal', inDialog: true, visible: true });
  await page.clock.fastForward('31:00');
  await expect(page.locator('#coStep2')).toBeVisible();
  expect(await active(page)).toMatchObject({ id: 'coRequote', inDialog: true, visible: true });
  // Back from review returns to the price.
  await page.locator('#coRequote').click();
  await page.locator('#coReview').click();
  await page.locator('#coBack').click();
  expect(await active(page)).toMatchObject({ id: 'coTotal', visible: true });
});

test('the countdown is not read out every second; the fixed price and the expiry are announced once', async ({ page }) => {
  await page.clock.install();
  await open(page);
  await expect(page.locator('#coExpiry')).not.toHaveAttribute('role', /./);
  await expect(page.locator('#coExpiry')).not.toHaveAttribute('aria-live', /./);
  await expect(page.locator('#coLive')).toHaveAttribute('role', 'status');
  await openFixed(page);
  await page.locator('#coQuote').click();
  await expect(page.locator('#coLive')).toHaveText('The price is fixed: $4.99.');
  // Count how often the live region changes while the clock runs for 20 s.
  await page.evaluate(() => {
    window.__liveChanges = 0;
    new MutationObserver(() => { window.__liveChanges += 1; })
      .observe(document.getElementById('coLive'), { childList: true, characterData: true, subtree: true });
  });
  await page.clock.fastForward('00:20');
  expect(await page.evaluate(() => window.__liveChanges)).toBe(0);
  await expect(page.locator('#coExpiry')).toContainText('Price held for');
  await page.clock.fastForward('31:00');
  await expect(page.locator('#coLive')).toHaveText('This price has expired. Get a new price to continue.');
});

/* ================================================================== *
 * 3. Catalogue failures, offline, slow, retry
 * ================================================================== */

for (const [name, c] of [
  ['429', { status: 429, body: '{"error":"TOO_MANY_REQUESTS"}' }],
  ['500', { status: 500, body: '{"error":"internal_error","stack":"at x"}' }],
  ['502', { status: 502, body: '<html>Bad gateway</html>' }],
  ['503', { status: 503, body: '{"status":"error","error":"GLOBAL_PRICING_DISABLED"}' }],
  ['network error', 'abort'],
]) {
  test(`catalogue ${name}: plain English, «Try again» recovers, one request per click`, async ({ page }) => {
    const st = await open(page, { catalogue: async (n) => (n === 1 ? c : { status: 200, body: BODY }) });
    await expect(page.locator('#status')).toHaveText('Prices are temporarily unavailable. Please check back soon — nothing can be ordered here yet.');
    expect(await page.locator('main').innerText()).not.toMatch(TECH);
    await expect(page.locator('.card')).toHaveCount(0);
    // Two activations in the same task (a double click / double tap): the
    // second must find the button already disabled. Clicked in the page, not
    // by coordinates, because the button hides itself and the layout moves.
    await page.locator('#retry').evaluate((b) => { b.click(); b.click(); });
    await expect(page.locator('#dailyGrid .card')).toHaveCount(1);
    expect(st.cat).toBe(2);
    expect(st.csp).toEqual([]);
    expect(st.calls.filter((x) => x.includes('api.magicesim.store'))).toEqual([]);
  });
}

test('offline, then online again: the page says so, and «Try again» recovers once the network is back', async ({ page, context }) => {
  await context.setOffline(true);
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: BODY }));
  await page.goto('/en/esim/thailand/').catch(() => {});
  // The page itself is served by the test server; only the API is unreachable offline.
  await context.setOffline(false);
  await page.unroute('**/api/**');
  const st = await open(page, { catalogue: async (n) => (n === 1 ? 'abort' : { status: 200, body: BODY }) });
  await expect(page.locator('#retry')).toBeVisible();
  await page.locator('#retry').click();
  await expect(page.locator('#dailyGrid .card')).toHaveCount(1);
  expect(st.cat).toBe(2);
});

test('a slow catalogue shows «Loading plans…» in a polite live region and no plan until it arrives', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await open(page, { catalogue: async () => { await gate; return { status: 200, body: BODY }; } });
  await expect(page.locator('#status')).toHaveText('Loading plans…');
  await expect(page.locator('#status')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.card')).toHaveCount(0);
  await expect(page.locator('#retry')).toBeHidden();
  release();
  await expect(page.locator('#dailyGrid .card')).toHaveCount(1);
});

/* ================================================================== *
 * 4. Quote failures, a plan withdrawn, a price that moved
 * ================================================================== */

for (const [name, r, message] of [
  ['400', { status: 400, body: { status: 'error', error: 'GLOBAL_TERM_REQUIRED' } }, 'The price is temporarily unavailable. Please try again later.'],
  ['404 (plan hidden since the page opened)', { status: 404, body: { status: 'error', error: 'GLOBAL_PACKAGE_UNAVAILABLE' } }, 'This plan is no longer available. Please choose another one.'],
  ['409 (plan disabled since the page opened)', { status: 409, body: { status: 'error', error: 'GLOBAL_PACKAGE_UNAVAILABLE' } }, 'This plan is no longer available. Please choose another one.'],
  ['429', { status: 429, body: { error: 'TOO_MANY_REQUESTS' } }, 'Too many requests. Please wait a minute and try again.'],
  ['500', { status: 500, body: { error: 'internal_error', stack: 'Error: at provider' } }, 'The price is temporarily unavailable. Please try again later.'],
  ['503', { status: 503, body: { status: 'error', error: 'GLOBAL_PRICING_DISABLED' } }, 'The price is temporarily unavailable. Please try again later.'],
  ['network error', 'abort', 'Could not reach the server. Check your connection and try again.'],
]) {
  test(`quote ${name}: plain English, no price, the visitor may try again`, async ({ page }) => {
    const st = await open(page, { onQuote: async () => r });
    await openFixed(page);
    await page.locator('#coQuote').click();
    await expect(page.locator('#coQuoteStatus')).toHaveText(message);
    await expect(page.locator('#coStep2')).toBeHidden();
    await expect(page.locator('#coTotal')).toHaveText('—');
    expect(await page.locator('#checkout').innerText()).not.toMatch(TECH);
    await expect(page.locator('#coQuote')).toBeEnabled();
    expect(st.quotes.length).toBe(1);
  });
}

test('a price that moved between the list and the quote: the server\'s price, said so', async ({ page }) => {
  await open(page, { onQuote: async (b) => ({ status: 200, body: quoteFor(b, 5.99) }) });
  await openFixed(page);
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$5.99');
  await expect(page.locator('#coPriceChanged')).toHaveText('The price has been updated since the list was loaded.');
});

test('an empty or invalid email is refused in plain English and focus goes to the field', async ({ page }) => {
  await open(page);
  await openFixed(page);
  await page.locator('#coQuote').click();
  for (const bad of ['', '   ', 'a@b', 'no-at.example.com']) {
    await page.locator('#coEmail').fill(bad);
    await page.locator('#coReview').click();
    await expect(page.locator('#coFormError')).toHaveText('Please enter a valid email address.');
    expect((await active(page)).id).toBe('coEmail');
  }
  await expect(page.locator('#coStep3')).toBeHidden();
});

/* ================================================================== *
 * 5. Reload, missing script, no JavaScript
 * ================================================================== */

test('a reload in the middle of checkout starts clean: no window, no price, no email', async ({ page }) => {
  await open(page);
  await openFixed(page);
  await page.locator('#coQuote').click();
  await page.locator('#coEmail').fill('keep@example.com');
  await page.reload();
  await expect(page.locator('#checkout')).toBeHidden();
  await expect(page.locator('#coTotal')).toHaveText('—');
  await expect(page.locator('#coEmail')).toHaveValue('');
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
});

test('a script that fails to load: no endless «Loading», no plan, nothing to buy', async ({ page }) => {
  await page.route('**/en/checkout.js*', (r) => r.fulfill({ status: 404, body: '' }));
  await open(page);
  await expect(page.locator('#status')).toHaveText('Prices are temporarily unavailable. Please reload the page — nothing can be ordered here yet.');
  await expect(page.locator('.card')).toHaveCount(0);
  await expect(page.locator('main button:visible')).toHaveCount(0);
});

test('without JavaScript: no «Loading» promise, an honest note, the notice, and nothing to buy', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/en/esim/thailand/');
  await expect(page.locator('#status')).toBeHidden();
  // Playwright's text engine does not look inside <noscript>; the element is.
  await expect(page.locator('noscript p')).toBeVisible();
  await expect(page.locator('noscript p')).toHaveText('Plans and prices on this page need JavaScript. Nothing can be bought here yet.');
  await expect(page.locator('#previewNotice')).toBeVisible();
  await expect(page.locator('main button:visible')).toHaveCount(0);
  await ctx.close();
});

/* ================================================================== *
 * 6. axe on every error, loading and retry state
 * ================================================================== */

test.describe('axe on the error and recovery states', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the pages are unchanged
  const audit = async (page, label) => {
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
      .violations.map((x) => `${x.id} ×${x.nodes.length}`));
    expect(v, label).toEqual([]);
  };
  test('catalogue unavailable + Try again; quote error; price expired', async ({ page }) => {
    await page.clock.install();
    await open(page, { catalogue: async (n) => (n === 1 ? { status: 503, body: '{}' } : { status: 200, body: BODY }),
      onQuote: async (b, n) => (n === 1 ? { status: 429, body: {} } : { status: 200, body: quoteFor(b, 4.99) }) });
    await expect(page.locator('#retry')).toBeVisible();
    await audit(page, 'catalogue unavailable');
    await page.locator('#retry').click();
    await openFixed(page);
    await page.locator('#coQuote').click();
    await expect(page.locator('#coQuoteStatus')).toBeVisible();
    await audit(page, 'quote error');
    await page.locator('#coQuote').click();
    await expect(page.locator('#coTotal')).toHaveText('$4.99');
    await page.clock.fastForward('31:00');
    await expect(page.locator('#coRequote')).toBeVisible();
    await audit(page, 'price expired');
  });
});
