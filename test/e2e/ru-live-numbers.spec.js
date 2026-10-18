'use strict';

/*
 * SEO stage C in a real browser: the counts and the «от N ₽» the generator
 * printed outside the grid follow the catalogue the grid shows
 * (assets/catalog-numbers.js), and the floor HIDES when that catalogue cannot be
 * shown as current. Nothing is bought; every non-GET is aborted and counted.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'catalog.json'), 'utf8'));
const SLUG = 'afghanistan';
const ISO = 'AF';
const money = (v) => Math.round(Number(v)).toLocaleString('ru-RU');

async function facts(pk) {
  const { countryFacts } = await import(path.join(ROOT, 'seo', 'catalogue-facts.mjs'));
  return countryFacts(pk, ISO);
}

// The country's own plans 20 % cheaper — the floor moves; no other page involved.
function cheaper(pk) {
  return pk.map((p) => {
    const c = Array.isArray(p.coverage_country_codes) ? p.coverage_country_codes : [];
    if (!(c.length === 1 && c[0] === ISO)) return p;
    const q = { ...p, price: Math.round(p.price * 0.8 / 50) * 50 || p.price };
    if (Array.isArray(p.term_prices)) q.term_prices = p.term_prices.map((t) => ({ ...t, price: Math.max(50, Math.round(t.price * 0.8 / 50) * 50) }));
    return q;
  });
}

/**
 * live: an array of packages to answer the API with, or a status code to fail.
 * snapshot: a catalog.json document, or a status code, or undefined (the file as committed).
 */
async function open(page, url, { live, snapshot } = {}) {
  const st = { nonGet: 0, errors: [] };
  page.on('pageerror', (e) => st.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Package load failed|Failed to load resource/.test(m.text())) st.errors.push(m.text()); });
  if (snapshot !== undefined) {
    await page.route('**/assets/catalog.json*', (route) => (typeof snapshot === 'number'
      ? route.fulfill({ status: snapshot, body: '' })
      : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snapshot) })));
  }
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => {
    const req = route.request();
    if (req.method() !== 'GET') { st.nonGet += 1; return route.abort(); }
    if (/\/api\/v1\/retail\/packages/.test(req.url())) {
      if (typeof live === 'number') return route.fulfill({ status: live, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ status: 'success', data: live || SNAPSHOT.packages }) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto(url);
  return st;
}

const floorTexts = (page) => page.locator('[data-cat="floor"]').allTextContents();
const visibleFloors = (page) => page.locator('[data-cat-floor]:not([hidden])').count();

test('live catalogue moved since the build: the printed floor and counts follow it', async ({ page }) => {
  const live = cheaper(SNAPSHOT.packages);
  const before = await facts(SNAPSHOT.packages);
  const after = await facts(live);
  expect(after.min_price_rub).toBeLessThan(before.min_price_rub);
  const st = await open(page, `/esim/${SLUG}/`, { live });
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  await expect.poll(() => floorTexts(page)).toEqual([`${money(after.min_price_rub)} ₽`, `${money(after.min_price_rub)} ₽`]);
  expect(await visibleFloors(page)).toBe(2);
  await expect(page.locator('[data-cat="local"]')).toHaveText(String(after.local_count));
  await expect(page.locator('[data-cat="daily"]')).toHaveText(String(after.daily_count));
  // The FAQ sentence reads whole, with the new number.
  await expect(page.locator('#faq')).toContainText(`Цены начинаются от ${money(after.min_price_rub)} ₽.`);
  expect(st.errors).toEqual([]);
  expect(st.nonGet).toBe(0);
});

test('API down, snapshot fresh: the numbers are the snapshot\'s and stay visible', async ({ page }) => {
  const fresh = { ...SNAPSHOT, generated_at: new Date().toISOString() };
  const f = await facts(SNAPSHOT.packages);
  const st = await open(page, `/esim/${SLUG}/`, { live: 502, snapshot: fresh });
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  await expect.poll(() => floorTexts(page)).toEqual([`${money(f.min_price_rub)} ₽`, `${money(f.min_price_rub)} ₽`]);
  expect(await visibleFloors(page)).toBe(2);
  await expect(page.locator('#catalogNotice')).toBeHidden();
  expect(st.errors).toEqual([]);
});

test('API down, snapshot older than 48 h: the floor phrases hide, the grid says the data is saved', async ({ page }) => {
  const old = { ...SNAPSHOT, generated_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() };
  const st = await open(page, `/esim/${SLUG}/`, { live: 502, snapshot: old });
  await expect(page.locator('#catalogNotice')).toBeVisible();
  await expect(page.locator('#catalogNotice')).toContainText('Показаны ранее сохранённые тарифы');
  await expect.poll(() => visibleFloors(page)).toBe(0);
  // Both floor phrases (facts line + FAQ) are there, hidden — not removed.
  expect(await page.locator('[data-cat-floor][hidden]').count()).toBe(2);
  await expect(page.locator('.facts')).not.toContainText('Цены от', { useInnerText: true });
  await page.locator('#faq summary', { hasText: 'сколько стоит eSIM' }).click();
  await expect(page.locator('#faq')).not.toContainText('Цены начинаются от', { useInnerText: true });
  await expect(page.locator('#faq')).toContainText('актуальная цена каждого тарифа показана на этой странице', { useInnerText: true });
  expect(st.errors).toEqual([]);
  expect(st.nonGet).toBe(0);
});

test('nothing loads at all: the floor phrases hide (an unverifiable price is not shown as current)', async ({ page }) => {
  const st = await open(page, `/esim/${SLUG}/`, { live: 502, snapshot: 404 });
  await expect(page.locator('#catalogNotice')).toBeVisible();
  await expect.poll(() => visibleFloors(page)).toBe(0);
  expect(st.nonGet).toBe(0);
});

test('the SEO pilot page is untouched: no live markup, the generated floor stays as built', async ({ page }) => {
  const st = await open(page, '/esim/uae/', { live: cheaper(SNAPSHOT.packages) });
  await expect(page.locator('#dailyGrid .plan, #localGrid .plan').first()).toBeVisible();
  expect(await page.locator('[data-cat], [data-cat-floor], [data-cat-seg]').count()).toBe(0);
  expect(await page.evaluate(() => typeof window.MagicCatalogNumbers)).toBe('undefined');
  expect(st.errors).toEqual([]);
});
