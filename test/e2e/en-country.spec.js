'use strict';

/*
 * The redesigned GLOBAL country page, in a real browser at 390 and 320 (the
 * projects) and at desktop width. The catalogue is a fixture; the quote POST is
 * answered in the browser. What it must do:
 *   * show local, regional and daily plans in that order, with honest labels;
 *   * fold a long block behind «Show all N plans»;
 *   * let a per-day term be picked on the card, priced from the same ladder the
 *     checkout shows, and hand exactly that term to the checkout and the quote;
 *   * keep one button per card, the payment bar before every plan, and every
 *     loading / error / empty state; pass axe; stay inside the CSP; never overflow.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const local = (n, gb, days, price) => ({ package_id: uuid(n), name: `Thailand ${gb}GB`, country_code: 'TH', coverage_country_codes: ['TH'],
  data_gb: gb, validity_days: days, price, currency: 'USD', plan_type: 'FIXED_VOLUME' });
const PER_DAY = { package_id: uuid(50), name: 'Thailand 1GB/Day', country_code: 'TH', coverage_country_codes: ['TH'], plan_type: 'DAILY',
  daily_term_mode: 'PER_DAY', daily_gb: 1, data_gb: 0, price: 1.49, currency: 'USD', daily_throttle_label: '512 Kbps',
  term_prices: [{ days: 3, price: 4.99 }, { days: 7, price: 10.99 }, { days: 15, price: 19.99 }] };
const FIXED_DAILY = { package_id: uuid(51), name: 'Thailand 3GB/Day 3 Days', country_code: 'TH', coverage_country_codes: ['TH'], plan_type: 'DAILY',
  daily_term_mode: 'FIXED_TERM', daily_gb: 3, data_gb: 0, validity_days: 3, price: 15.99, currency: 'USD' };
const REGIONAL = { package_id: uuid(60), name: 'Asia 5GB', country_code: 'AS-5', coverage_country_codes: ['TH', 'MY', 'SG', 'VN', 'ID'],
  data_gb: 5, validity_days: 30, price: 12.99, currency: 'USD', plan_type: 'FIXED_VOLUME' };
const LOCALS = [local(1, 1, 7, 2.99), local(2, 3, 15, 4.99), local(3, 5, 30, 6.99), local(4, 10, 30, 11.99), local(5, 20, 30, 19.99),
  local(6, 50, 30, 29.99), local(7, 100, 30, 49.99), local(8, 30, 30, 24.99)];
const BODY = JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: [...LOCALS, PER_DAY, FIXED_DAILY, REGIONAL] });

async function open(page, { catalogue, path = '/en/esim/thailand/' } = {}) {
  const st = { quotes: [], csp: [], errors: [], cat: 0 };
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    else if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) st.errors.push(m.text());
  });
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      st.cat += 1;
      const c = catalogue ? await catalogue(st.cat) : { status: 200, body: BODY };
      return route.fulfill({ status: c.status, contentType: 'application/json', body: c.body });
    }
    const b = JSON.parse(req.postData());
    st.quotes.push(b);
    const price = b.days === 7 ? 10.99 : b.days === 15 ? 19.99 : b.days === 3 ? 4.99 : 4.99;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quote_id: '3fbced54-1111-4222-8333-444455556666',
      package_id: b.package_id, days: b.days, currency: 'USD', amount: price, expires_at: new Date(Date.now() + 1800000).toISOString() }) });
  });
  await page.goto(path);
  return st;
}
const ready = (page) => expect(page.locator('#localGrid .card').first()).toBeVisible();
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('local, regional and daily, in that order, each with its own label and count', async ({ page }) => {
  await open(page); await ready(page);
  const order = await page.evaluate(() => [...document.querySelectorAll('.plan-block:not([hidden])')].map((s) => s.id));
  expect(order).toEqual(['localBlock', 'regionalBlock', 'dailyBlock']);
  await expect(page.locator('.cp-jump a:visible')).toHaveText([/Thailand\s*8/, /Regional\s*1/, /Data every day\s*2/]);
  const loc = page.locator('#localGrid .card').first();
  await expect(loc.locator('.plan-badge')).toHaveText('Thailand only');
  await expect(loc.locator('.m-cov')).toHaveCount(0);                        // the badge already says it
  const reg = page.locator('#regionalGrid .card').first();
  await expect(reg.locator('.plan-badge')).toHaveText('Regional plan');
  await expect(reg.locator('.m-cov')).toHaveText('5 countries, incl. Thailand');
  await expect(reg.locator('.m-also')).toHaveText('Also covers Malaysia, Singapore, Vietnam + 1 more');
  await expect(page.locator('#dailyGrid .card .plan-badge').first()).toHaveText('Daily plan');
  // Exactly one button per card: the per-day terms are radio inputs.
  // (Counted as elements: folded cards are hidden, and role queries skip hidden nodes.)
  expect(await page.locator('.card').evaluateAll((cs) => cs.map((c) => c.querySelectorAll('button').length)))
    .toEqual(Array(11).fill(1));
});

test('a long block shows six plans and folds the rest behind «Show all N plans»', async ({ page }) => {
  await open(page); await ready(page);
  const cards = page.locator('#localGrid .card');
  await expect(cards).toHaveCount(8);
  await expect(page.locator('#localGrid .card:visible')).toHaveCount(6);
  const more = page.locator('#localBlock .plan-more');
  await expect(more).toHaveText('Show all 8 plans');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(page.locator('#localGrid .card:visible')).toHaveCount(8);
  await expect(more).toHaveText('Show fewer plans');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => !!document.activeElement.closest('#localGrid .card:nth-child(7)'))).toBe(true);
  await more.click();
  await expect(page.locator('#localGrid .card:visible')).toHaveCount(6);
  // Cheapest first, as before.
  expect(await cards.locator('.price').evaluateAll((e) => e.map((x) => x.textContent)))
    .toEqual(['$2.99', '$4.99', '$6.99', '$11.99', '$19.99', '$24.99', '$29.99', '$49.99']);
});

test('per-day: pick the days on the card; the price follows the ladder and the checkout gets exactly that term', async ({ page }) => {
  const st = await open(page); await ready(page);
  const card = page.locator('#dailyGrid .card', { hasText: '1 GB a day' });
  await expect(card.getByRole('radio')).toHaveCount(3);
  await expect(card.getByRole('radio', { name: '3' })).toBeChecked();      // the term the card is priced from
  await expect(card.locator('.price')).toHaveText('$4.99');
  await expect(card.locator('.price-for')).toHaveText('for 3 days');
  // Keyboard: arrows move along the radio group.
  await card.getByRole('radio', { name: '3' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(card.getByRole('radio', { name: '7' })).toBeChecked();
  await expect(card.locator('.price')).toHaveText('$10.99');
  await expect(card.locator('.price-for')).toHaveText('for 7 days');
  await card.getByRole('button').click();
  await expect(page.locator('#coDays')).toHaveValue('7');
  await expect(page.locator('#coTerm')).toHaveText('7 days');
  await expect(page.locator('#coListed')).toHaveText('$10.99');          // the same ladder price
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$10.99');
  expect(st.quotes).toEqual([{ package_id: PER_DAY.package_id, days: 7 }]);
});

test('a fixed-term daily plan and a volume plan open the checkout as before, with no days', async ({ page }) => {
  const st = await open(page); await ready(page);
  const fixed = page.locator('#dailyGrid .card', { hasText: '3 GB a day' });
  await expect(fixed.getByRole('radio')).toHaveCount(0);
  await expect(fixed.locator('.price-for')).toHaveText('for 3 days');
  await page.locator('#localGrid .card').first().getByRole('button').click();
  await expect(page.locator('#coTermPick')).toBeHidden();
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('$4.99');
  expect(st.quotes).toEqual([{ package_id: LOCALS[0].package_id, days: null }]);
});

test('the payment bar sits above the hero and every plan; the checkout still refuses payment', async ({ page }) => {
  await open(page); await ready(page);
  const bar = await page.locator('#previewNotice').boundingBox();
  const first = await page.locator('.plan').first().boundingBox();
  expect(bar.y + bar.height).toBeLessThanOrEqual(first.y);
  await page.locator('#localGrid .card').first().getByRole('button').click();
  await expect(page.locator('#coUnavail')).toBeVisible();
  await expect(page.locator('#coPay')).toBeDisabled();
});

test('loading shows placeholders (not plans); they go when the plans arrive', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  await open(page, { catalogue: async () => { await gate; return { status: 200, body: BODY }; } });
  await expect(page.locator('#skeleton')).toBeVisible();
  await expect(page.locator('#status')).toHaveText('Loading plans…');
  await expect(page.locator('.card')).toHaveCount(0);
  release();
  await ready(page);
  await expect(page.locator('#skeleton')).toBeHidden();
  await expect(page.locator('.cp-jump')).toBeVisible();
});

test('unavailable: the message and «Try again», no placeholders, no jump links, no plan', async ({ page }) => {
  await open(page, { catalogue: async () => ({ status: 503, body: '{}' }) });
  await expect(page.locator('#retry')).toBeVisible();
  await expect(page.locator('#status')).toContainText('Prices are temporarily unavailable');
  await expect(page.locator('#skeleton')).toBeHidden();
  await expect(page.locator('.cp-jump')).toBeHidden();
  await expect(page.locator('.card')).toHaveCount(0);
});

test('nothing for this country: says so, and offers the destination list', async ({ page }) => {
  await open(page, { path: '/en/esim/japan/' });
  await expect(page.locator('#status')).toHaveText('No plans for this destination yet.');
  await expect(page.locator('#emptyLink')).toBeVisible();
  await expect(page.locator('#emptyLink')).toHaveAttribute('href', '/en/esim/');
  await expect(page.locator('#skeleton')).toBeHidden();
});

test('«Before you buy» leads to the device check, the guides and support', async ({ page }) => {
  await open(page); await ready(page);
  const help = page.locator('.cp-help');
  await expect(help.locator('a')).toHaveText([/How to check your phone/, /iPhone setup/, /Android setup/,
    /When to install and turn on your eSIM/, /eSIM not working/, /Guides/, /support@magicesim\.store/]);
});

for (const [w, h] of [[1366, 900], [390, 844], [320, 640]]) {
  test(`${w}px: no overflow, the first plans are near the top, no CSP violation`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const st = await open(page); await ready(page);
    expect(await noOverflow(page)).toBe(true);
    const top = await page.locator('#localBlock .blk-head').boundingBox();
    expect(top.y).toBeLessThan(h);                                       // the plans start on the first screen
    await page.locator('#localBlock .plan-more').click();
    expect(await noOverflow(page)).toBe(true);
    expect(st.csp).toEqual([]);
    expect(st.errors).toEqual([]);
  });
}

test.describe('axe on the country page', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the page is unchanged
  const audit = async (page, label) => {
    await page.addScriptTag({ content: AXE });
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
      .violations.map((x) => `${x.id} ×${x.nodes.length}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 2).join(' | ')}`));
    expect(v, label).toEqual([]);
  };
  test('loaded, folded open, a day picked, and unavailable', async ({ page }) => {
    await open(page); await ready(page);
    await audit(page, 'loaded');
    await page.locator('#localBlock .plan-more').click();
    await page.locator('#dailyGrid .card', { hasText: '1 GB a day' }).getByRole('radio', { name: '7' }).check();
    await audit(page, 'expanded, 7 days picked');
  });
  test('desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await open(page); await ready(page);
    await audit(page, 'desktop');
  });
  test('unavailable state', async ({ page }) => {
    await open(page, { catalogue: async () => ({ status: 503, body: '{}' }) });
    await expect(page.locator('#retry')).toBeVisible();
    await audit(page, 'unavailable');
  });
});
