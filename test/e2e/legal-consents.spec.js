'use strict';

/*
 * LEGAL-3 in a real browser (Chromium 390 / 320, WebKit): the two consents of the international checkout in all six
 * languages, the three English legal pages and the footer links — with every API answered from a fixture and every
 * request recorded. Nothing real is touched; the only write the page may make is the GLOBAL quote.
 *
 * International payments are OFF: the payment button stays disabled whatever the boxes say, and the consent record
 * cannot be built. What the boxes do is still observable: #coConsents carries data-state (none / terms / delivery /
 * both) and data-ready (the one gate, payAllowed — false while payments are off).
 */

const { test, expect } = require('@playwright/test');
const SITE = require('../../assets/site-i18n.js');

const AE3 = '0d504f79-eab1-40dc-891a-c1f60cf11f06';
const PACKAGES = [{
  package_id: AE3, name: 'United Arab Emirates 3GB 30Days', country_code: 'AE', region: 'AE', coverage_country_codes: ['AE'],
  data_gb: 3, validity_days: 30, price: 9.99, plan_type: 'FIXED_VOLUME', currency: 'USD',
}];
const LANGS = [['en', 'en'], ['es', 'es'], ['de', 'de'], ['fr', 'fr'], ['zh-Hans', 'zh'], ['ko', 'ko']];

async function open(page, path) {
  const calls = [];
  page.on('request', (r) => calls.push({ method: r.method(), url: r.url() }));
  await page.route('**/assets/catalog.json*', (route) => route.fulfill({ status: 500, body: 'must not be asked' }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET' && /\/api\/v1\/retail\/packages\?market=global$/.test(req.url())) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: PACKAGES }) });
    }
    if (req.method() === 'POST' && /\/api\/v1\/global\/quotes$/.test(req.url())) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        quote_id: '3fbced54-1111-4222-8333-444455556666', package_id: AE3, days: null, currency: 'USD', amount: 9.99,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() }) });
    }
    return route.fulfill({ status: 500, body: 'must not be asked' });
  });
  await page.goto(path);
  await expect(page.locator('#status')).toBeHidden();
  return calls;
}

/** Plan → server price → email + device → the review step, where the consents are. */
async function toReview(page) {
  await page.locator('#localGrid .card').first().getByRole('button').click();
  await page.locator('#coQuote').click();
  await expect(page.locator('#coStep2')).toBeVisible();
  await page.locator('#coEmail').fill('traveller@example.com');
  await page.locator('#coDevice').check();
  await page.locator('#coReview').click();
  await expect(page.locator('#coStep3')).toBeVisible();
}

function assertClean(calls) {
  const writes = calls.filter((c) => !['GET', 'HEAD'].includes(c.method));
  expect(writes.filter((c) => !/\/api\/v1\/global\/quotes$/.test(c.url)).map((c) => `${c.method} ${c.url}`)).toEqual([]);
  expect(calls.filter((c) => /retail-orders|\/orders|platega|flitt|\/pay\b|payments|fulfil/i.test(c.url))).toEqual([]);
}

const state = (page) => page.locator('#coConsents').getAttribute('data-state');
const ready = (page) => page.locator('#coConsents').getAttribute('data-ready');

test('English: both boxes start unticked; each state is tracked; the payment button never enables; nothing is sent', async ({ page }) => {
  const calls = await open(page, '/en/esim/uae/');
  await toReview(page);
  const terms = page.locator('#coAgreeTerms');
  const delivery = page.locator('#coAgreeDelivery');
  const pay = page.locator('#coPay');

  // 1. both off
  await expect(terms).not.toBeChecked();
  await expect(delivery).not.toBeChecked();
  expect(await state(page)).toBe('none');
  await expect(pay).toBeDisabled();
  // 2. only the first
  await terms.check();
  expect(await state(page)).toBe('terms');
  await expect(pay).toBeDisabled();
  // 3. only the second
  await terms.uncheck();
  await delivery.check();
  expect(await state(page)).toBe('delivery');
  await expect(pay).toBeDisabled();
  // 4. both — the gate still refuses: international payments are off
  await terms.check();
  expect(await state(page)).toBe('both');
  expect(await ready(page)).toBe('false');
  await expect(pay).toBeDisabled();
  await expect(pay).toHaveAttribute('aria-disabled', 'true');
  // 5. one taken back
  await delivery.uncheck();
  expect(await state(page)).toBe('terms');
  await expect(pay).toBeDisabled();

  // No way around the boxes from the page's own script: the record refuses, a forced click does nothing.
  await delivery.check();
  const record = await page.evaluate(() => { try { window.MagicEnCheckout.consentRecord(document); return 'built'; } catch (e) { return e.message; } });
  expect(record).toBe('CONSENT_REQUIRED');
  await pay.click({ force: true });
  await expect(page.locator('#coStep3')).toBeVisible();
  assertClean(calls);
});

test('the boxes are never remembered: closing and opening the checkout again starts unticked', async ({ page }) => {
  await open(page, '/en/esim/uae/');
  await toReview(page);
  await page.locator('#coAgreeTerms').check();
  await page.locator('#coAgreeDelivery').check();
  expect(await state(page)).toBe('both');
  await page.keyboard.press('Escape');
  await expect(page.locator('#checkout')).toBeHidden();
  await toReview(page);
  await expect(page.locator('#coAgreeTerms')).not.toBeChecked();
  await expect(page.locator('#coAgreeDelivery')).not.toBeChecked();
  expect(await state(page)).toBe('none');
  // and a reload keeps nothing either
  await page.reload();
  await expect(page.locator('#status')).toBeHidden();
  await toReview(page);
  expect(await state(page)).toBe('none');
});

test('each document is its own link and opens in a new tab without ticking the box', async ({ page, context }) => {
  await open(page, '/en/esim/uae/');
  await toReview(page);
  for (const [name, path] of [['Terms of Service', '/en/terms/'], ['Refund Policy', '/en/refund/']]) {
    const link = page.locator('#coConsents label a', { hasText: name });
    await expect(link).toHaveAttribute('href', path);
    await expect(link).toHaveAttribute('target', '_blank');
    const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await tab.waitForLoadState();
    expect(new URL(tab.url()).pathname).toBe(path);
    await expect(tab.locator('h1')).toHaveText(name);
    await tab.close();
    await expect(page.locator('#coAgreeTerms')).not.toBeChecked();
  }
  await expect(page.locator('#coConsents .note a')).toHaveAttribute('href', '/en/privacy/');
});

for (const [code, prefix] of LANGS) {
  test(`${code}: the two consents in the page's language, before the disabled payment button, on a phone without overflow`, async ({ page }) => {
    const W = SITE.DICT[code];
    const calls = await open(page, `/${prefix}/esim/uae/`);
    await toReview(page);
    const box = page.locator('#coConsents');
    await expect(box).toBeVisible();
    await expect(page.locator('#coConsents a[href="/en/terms/"]')).toHaveText(W['consent.termsLink']);
    await expect(page.locator('#coConsents a[href="/en/refund/"]')).toHaveText(W['consent.refundLink']);
    await expect(page.locator('#coConsents a[href="/en/privacy/"]')).toHaveText(W['consent.privacyLink']);
    await expect(page.locator('#coAgreeDelivery + span')).toHaveText(W['consent.delivery']);
    // Directly above the payment button: on a phone the action bar is pinned to the bottom of the sheet, so scroll the
    // sheet to its end — then the boxes sit right above the bar and the bar covers neither of them.
    await box.evaluate((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY;
        if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) { p.scrollTop = p.scrollHeight; break; }
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    const boxBottom = await box.evaluate((el) => el.getBoundingClientRect().bottom);
    const payTop = await page.locator('#coPay').evaluate((el) => el.getBoundingClientRect().top);
    expect(payTop).toBeGreaterThanOrEqual(boxBottom - 1);
    for (const id of ['coAgreeTerms', 'coAgreeDelivery']) {
      const hit = await page.evaluate((x) => { const r = document.getElementById(x).getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.id; }, id);
      expect(hit, `${id} is not covered`).toBe(id);
    }
    await page.locator('#coAgreeTerms').check();
    await page.locator('#coAgreeDelivery').check();
    expect(await state(page)).toBe('both');
    await expect(page.locator('#coPay')).toBeDisabled();
    // a finger can hit each box; nothing is wider than the screen
    for (const id of ['#coAgreeTerms', '#coAgreeDelivery']) {
      const b = await page.locator(id).boundingBox();
      expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(18);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    assertClean(calls);
  });

  test(`${code}: the footer links the Terms, the Refund Policy and the Privacy Policy`, async ({ page }) => {
    await page.route('**/api/**', (route) => route.fulfill({ status: 500, body: 'not needed' }));
    await page.goto(`/${prefix}/`);
    for (const k of ['terms', 'refund', 'privacy']) {
      await expect(page.locator(`.site-footer a[href="/en/${k}/"]`)).toHaveText(SITE.DICT[code][`footer.${k}`]);
    }
    await expect(page.locator('.site-footer a[href="/terms.html"], .site-footer a[href="/privacy.html"]')).toHaveCount(0);
  });
}

for (const [slug, h1] of [['terms', 'Terms of Service'], ['refund', 'Refund Policy'], ['privacy', 'Privacy Policy']]) {
  test(`/en/${slug}/ loads, reads on a phone, and says payments are unavailable where it describes them`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const r = await page.goto(`/en/${slug}/`);
    expect(r.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(h1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (slug !== 'privacy') await expect(page.locator('main')).toContainText('International payments are currently unavailable');
    await expect(page.locator('main')).not.toContainText('AT LAUNCH');
    for (const k of ['terms', 'refund', 'privacy']) await expect(page.locator(`.site-footer a[href="/en/${k}/"]`)).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test('the Russian checkout is untouched: no international consents, its own consent and Platega button as before', async ({ page }) => {
  await page.route('**/mc.yandex.ru/**', (route) => route.abort());
  await page.goto('/esim/turkey/');
  await expect(page.locator('#coConsents, #coAgreeTerms, #coAgreeDelivery')).toHaveCount(0);
  await expect(page.locator('#checkoutModal #coConsent')).toHaveCount(1);
  await expect(page.locator('#checkoutModal a[href="/terms.html"]')).toHaveCount(1);
  await expect(page.locator('#checkoutModal #coPayLabel')).toHaveText('Оплатить по СБП');
});
