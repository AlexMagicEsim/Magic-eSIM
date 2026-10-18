'use strict';

/*
 * A coverage-only territory in a real browser (seo/coverage-only-territories.mjs):
 * the provider's 2026-10-18 move — KT (Northern Cyprus) appended to the coverage
 * of Turkey Premium, Greece Cyprus Turkey and Europe and USA — is named in every
 * coverage list, never printed as a bare code, never counted as one more
 * country, and does not push «Turkey Premium» out of «Тарифы для Турции».
 * Nothing is bought; every non-GET is aborted and counted.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'catalog.json'), 'utf8'));
const FAMILY = /^(Turkey Premium|Greece Cyprus Turkey|Europe and USA) \d/;
const WITH_KT = SNAPSHOT.packages.map((p) => (FAMILY.test(String(p.name || '')) && Array.isArray(p.coverage_country_codes)
  ? { ...p, coverage_country_codes: [...p.coverage_country_codes.filter((c) => c !== 'KT'), 'KT'] }
  : p));

async function open(page, url) {
  const st = { nonGet: 0, errors: [] };
  page.on('pageerror', (e) => st.errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') { st.nonGet += 1; return route.abort(); }
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ status: 'success', data: WITH_KT }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  return st;
}

test('turkey: KT is named in the coverage lists, never bare; Turkey Premium stays a Turkish plan', async ({ page }) => {
  expect(WITH_KT.filter((p) => (p.coverage_country_codes || []).includes('KT')).length).toBeGreaterThanOrEqual(3);
  const st = await open(page, '/esim/turkey/');
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  const lists = await page.locator('.js-coverage').evaluateAll((els) => els.map((e) => e.getAttribute('data-countries') || ''));
  const withKt = lists.filter((t) => t.includes('Северный Кипр'));
  expect(withKt.length).toBeGreaterThan(0);
  for (const t of lists) expect(t).not.toMatch(/(^|[\s,])KT([\s,]|$)/);
  // «Turkey Premium» (TR + KT) is in the local block, titled by the country.
  const premiumNames = SNAPSHOT.packages.filter((p) => /^Turkey Premium \d/.test(p.name)).length;
  if (premiumNames) {
    const regionalTurkeyOnly = await page.locator('#regionalGrid .js-coverage').evaluateAll((els) => els
      .map((e) => e.getAttribute('data-countries') || '')
      .filter((t) => /^Турция, Северный Кипр$/.test(t.trim())).length);
    expect(regionalTurkeyOnly).toBe(0);
  }
  // No card says «42 страны»: KT is not one more country.
  await expect(page.locator('body')).not.toContainText('42 стран');
  expect(st.errors).toEqual([]);
  expect(st.nonGet).toBe(0);
});

test('KT has no destination page', async ({ page }) => {
  const r = await page.goto('/esim/northern-cyprus/');
  expect(r.status()).toBe(404);
});
