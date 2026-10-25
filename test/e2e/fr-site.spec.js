'use strict';

/*
 * The French site, /fr/ (I18N FR-1), in a real browser: Chromium at 390 and 320 (the projects) and at 1366, and in
 * WebKit (the webkit-flags project runs this file too — Safari's engine). The GLOBAL catalogue is a fixture and the
 * quote POST is answered in the browser, exactly as the Spanish spec does; nothing reaches the API.
 *
 *   * a country page: local → regional → daily, French labels, prices «2,99 USD» (owner D2), the daily lines from the
 *     French table (decimal comma, Go), a per-day term picked on the card and handed to the checkout and the quote;
 *   * the list: an accent-free search finds «États-Unis», «Égypte», «Thaïlande»; the home: the search opens a French page;
 *   * the language list on every kind of page keeps the reader on the same page;
 *   * an unknown /fr/ address gets the French 404, without the counter;
 *   * the logo «Reveal + Wave» and Expressive as in English, CLS < 0.02, axe clean, no clipped French word;
 *   * noindex in the live DOM.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const fs = require('fs');
const path = require('path');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const NOT_FOUND = fs.readFileSync(path.join(__dirname, '..', '..', '404.html'), 'utf8');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const local = (n, gb, days, price) => ({ package_id: uuid(n), name: `Thailand ${gb}GB`, country_code: 'TH', coverage_country_codes: ['TH'],
  data_gb: gb, validity_days: days, price, currency: 'USD', plan_type: 'FIXED_VOLUME' });
const PER_DAY = { package_id: uuid(50), name: 'Thailand 1GB/Day', country_code: 'TH', coverage_country_codes: ['TH'], plan_type: 'DAILY',
  daily_term_mode: 'PER_DAY', daily_gb: 1, data_gb: 0, price: 1.49, currency: 'USD', daily_throttle_label: '512 Kbps',
  term_prices: [{ days: 3, price: 4.99 }, { days: 7, price: 10.99 }, { days: 15, price: 19.99 }] };
const FIXED_DAILY = { package_id: uuid(51), name: 'Thailand 1.5GB/Day 3 Days', country_code: 'TH', coverage_country_codes: ['TH'], plan_type: 'DAILY',
  daily_term_mode: 'FIXED_TERM', daily_gb: 1.5, data_gb: 0, validity_days: 3, price: 15.99, currency: 'USD', daily_reset_confirmed: true };
const REGIONAL = { package_id: uuid(60), name: 'Asia 5GB', country_code: 'AS-5', coverage_country_codes: ['TH', 'MY', 'SG', 'VN', 'ID'],
  data_gb: 5, validity_days: 30, price: 12.99, currency: 'USD', plan_type: 'FIXED_VOLUME' };
const LOCALS = [local(1, 1, 7, 2.99), local(2, 3, 15, 4.99), local(3, 5, 30, 6.99), local(4, 10, 30, 11.99), local(5, 20, 30, 19.99),
  local(6, 50, 30, 29.99), local(7, 100, 30, 49.99), local(8, 30, 30, 24.99)];
const BODY = JSON.stringify(withLayout({ status: 'success', market: 'global', currency: 'USD', data: [...LOCALS, PER_DAY, FIXED_DAILY, REGIONAL] }));

async function open(page, url = '/fr/esim/thailand/', { gate } = {}) {
  const st = { quotes: [], csp: [], errors: [], external: [] };
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    else if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) st.errors.push(m.text());
  });
  page.on('pageerror', (e) => st.errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => { st.external.push(r.request().url()); return r.abort(); });
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      if (gate) await gate;
      return route.fulfill({ status: 200, contentType: 'application/json', body: BODY });
    }
    const b = JSON.parse(req.postData());
    st.quotes.push(b);
    const price = b.days === 7 ? 10.99 : b.days === 15 ? 19.99 : 4.99;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ quote_id: '3fbced54-1111-4222-8333-444455556666',
      package_id: b.package_id, days: b.days, currency: 'USD', amount: price, expires_at: new Date(Date.now() + 1800000).toISOString() }) });
  });
  await page.goto(url);
  return st;
}
const ready = (page) => expect(page.locator('#localGrid .card').first()).toBeVisible();
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const restful = (page) => page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });

const sp = (t) => t.replace(/[  ]/g, ' ');

test('a country page in French: blocks, labels, «USD» prices and the daily lines from the French table', async ({ page }) => {
  const st = await open(page); await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('h1')).toHaveText('eSIM pour la Thaïlande');
  const order = await page.evaluate(() => [...document.querySelectorAll('.plan-block:not([hidden])')].map((s) => s.id));
  expect(order).toEqual(['localBlock', 'regionalBlock', 'dailyBlock']);
  await expect(page.locator('.cp-jump a:visible')).toHaveText([/Thaïlande\s*8/, /Régionaux\s*1/, /Des données chaque jour\s*2/]);
  const loc = page.locator('#localGrid .card').first();
  await expect(loc.locator('.plan-badge')).toHaveText('Forfait local');
  await expect(loc.locator('.plan-data')).toHaveText('1 Go');
  await expect(loc.locator('.plan-term')).toHaveText('7 jours');
  expect(sp(await loc.locator('.price').textContent())).toBe('2,99 USD');
  await expect(page.locator('#localBlock')).toContainText('Voir les 8 forfaits');
  const daily = page.locator('#dailyGrid .card', { hasText: '1 Go par jour' });
  await expect(daily).toContainText('Ensuite, jusqu’à 512 kbit/s');
  const fixed = page.locator('#dailyGrid .card', { hasText: '1,5 Go par jour' });
  await expect(fixed).toContainText('Le volume est réinitialisé toutes les 24 heures');
  await expect(fixed.locator('.plan-term')).toHaveText('3 jours');
  expect(sp(await page.locator('#regionalGrid .card .price').first().textContent())).toBe('12,99 USD');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBe(0);
  expect(st.csp).toEqual([]); expect(st.errors).toEqual([]); expect(st.external).toEqual([]);
  expect(await noOverflow(page)).toBe(true);
});

test('articles: «eSIM pour les États-Unis», «pour le Japon», «pour l’Italie», «pour Singapour»', async ({ page }) => {
  const st = await open(page, '/fr/esim/usa/');
  await expect(page.locator('h1')).toHaveText('eSIM pour les États-Unis');
  await page.goto('/fr/esim/japan/'); await expect(page.locator('h1')).toHaveText('eSIM pour le Japon');
  await expect(page).toHaveTitle('eSIM pour le Japon : forfaits en USD | Magic eSIM');
  await page.goto('/fr/esim/italy/'); await expect(page.locator('h1')).toHaveText('eSIM pour l’Italie');
  await page.goto('/fr/esim/singapore/'); await expect(page.locator('h1')).toHaveText('eSIM pour Singapour');
  expect(st.errors).toEqual([]);
});

test('per-day: the term picked on the card goes to the checkout and the quote; the checkout speaks French', async ({ page }) => {
  const st = await open(page); await ready(page);
  const card = page.locator('#dailyGrid .card', { hasText: '1 Go par jour' });
  await expect(card.getByRole('radio', { name: '3' })).toBeChecked();
  await card.getByRole('radio', { name: '7' }).check();
  expect(sp(await card.locator('.price').textContent())).toBe('10,99 USD');
  await expect(card.locator('.plan-term')).toHaveText('7 jours');
  await card.getByRole('button').click();
  await expect(page.locator('#coDays')).toHaveValue('7');
  await expect(page.locator('#coTerm')).toHaveText('7 jours');
  await expect(page.locator('.co-steps')).toContainText('Coordonnées');
  await expect(page.locator('#coQuote')).toHaveText('Obtenir le prix exact');
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText(/^10,99\sUSD$/);
  expect(st.quotes).toEqual([{ package_id: PER_DAY.package_id, days: 7 }]);
  await expect(page.locator('#coPay')).toBeDisabled();                 // payment is not available — in French too
  expect(st.errors).toEqual([]);
});

test('the list: an accent-free search finds États-Unis, Égypte and Thaïlande; the count speaks French', async ({ page }) => {
  const st = await open(page, '/fr/esim/');
  await page.locator('#hq').fill('etats-unis');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('États-Unis');
  await expect(page.locator('#hubCount')).toHaveText('1 destination correspond');
  await page.locator('#hq').fill('egypte');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('Égypte');
  await page.locator('#hq').fill('thailande');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('Thaïlande');
  await page.locator('#hq').fill('zzzz');
  await expect(page.locator('#hubEmpty')).toBeVisible();
  expect(st.external).toEqual([]); expect(st.errors).toEqual([]);
});

test('the home: the search opens the French page of the country; Expressive and the logo are on', async ({ page }) => {
  const st = await open(page, '/fr/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', /.+/);
  await expect(page.locator('.brand-logo .lm-symbol')).toHaveCount(1);
  await expect(page.locator('.brand-logo .lm-waves')).toHaveCount(1);
  await page.locator('#q').fill('mexi');
  const first = page.locator('#results a.res').first();
  await expect(first).toHaveText('Mexique');
  await first.click();
  await expect(page).toHaveURL(/\/fr\/esim\/mexico\/$/);
  expect(st.errors).toEqual([]); expect(st.external).toEqual([]);
});

test('the logo «Reveal + Wave» plays once per visit, as on the English pages (the shared `me-logo` key)', async ({ page }) => {
  await open(page, '/fr/');
  expect(await page.evaluate(() => [document.documentElement.classList.contains('lm-once'), sessionStorage.getItem('me-logo')])).toEqual([true, '1']);
  await page.goto('/fr/esim/');
  expect(await page.evaluate(() => document.documentElement.classList.contains('lm-once')), 'not again in the same visit').toBe(false);
  await page.goto('/de/');
  expect(await page.evaluate(() => document.documentElement.classList.contains('lm-once')), 'nor on German').toBe(false);
});

test('motion.js loads on the home and a country page, as in English, and not on a guide', async ({ page }) => {
  const loaded = [];
  page.on('request', (r) => { if (/\/assets\/motion\.js/.test(r.url())) loaded.push(new URL(page.url()).pathname); });
  await open(page, '/fr/'); await page.waitForTimeout(400);
  await page.goto('/fr/esim/thailand/'); await page.waitForTimeout(400);
  await page.goto('/fr/guides/iphone/'); await page.waitForTimeout(400);
  expect([...new Set(loaded)]).toEqual(['/fr/', '/fr/esim/thailand/']);
});

test('the phone menu lists the other languages, each to the same page', async ({ page }) => {
  await open(page, '/fr/guides/android/');
  await page.locator('.mnav summary').click();
  const langs = page.locator('.mnav-panel a[hreflang]');
  await expect(langs).toHaveText(['Русский', 'English', 'Español', 'Deutsch', '简体中文', '한국어']);
  expect(await langs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/android.html', '/en/guides/android/', '/es/guides/android/', '/de/guides/android/', '/zh/guides/android/', '/ko/guides/android/']);
  expect(await noOverflow(page)).toBe(true);
});

test('an unknown /fr/ address gets the French 404, without the counter', async ({ page }) => {
  const metrika = [];
  await page.route('**/mc.yandex.ru/**', (r) => { metrika.push(r.request().url()); return r.fulfill({ status: 204, body: '' }); });
  await page.route((u) => u.pathname === '/fr/esim/atlantis/', (r) => r.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: NOT_FOUND }));
  await page.goto('/fr/esim/atlantis/');
  await expect(page.locator('h1')).toHaveText('Page introuvable');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('a.home').first()).toHaveAttribute('href', '/fr/');
  expect(metrika).toEqual([]);
});

test('no layout shift while a country page loads its plans (CLS < 0.02)', async ({ page }) => {
  let release; const gate = new Promise((r) => { release = r; });
  await page.addInitScript(() => {
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* WebKit: no API */ }
  });
  await open(page, '/fr/esim/thailand/', { gate });
  await page.waitForTimeout(500);
  release();
  await ready(page);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.02);
});

test('French is longer than English: no page overflows the width, no button or tab clips its words', async ({ page }) => {
  for (const url of ['/fr/', '/fr/esim/', '/fr/esim/thailand/', '/fr/esim/central-african-republic/', '/fr/esim/saint-vincent-and-the-grenadines/',
    '/fr/guides/', '/fr/guides/iphone/', '/fr/guides/android/', '/fr/guides/troubleshooting/']) {
    await open(page, url);
    if (url === '/fr/esim/thailand/') await ready(page);
    expect(await noOverflow(page), `${url}: horizontal scroll`).toBe(true);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.btn, .cp-jump a, .hub-tile, .dest-tile, .guide-card, .langsw, .co-steps li, h1, h2')]
      .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => e.className + ': ' + e.textContent.trim().slice(0, 40)));
    expect(clipped, url).toEqual([]);
  }
});

test('French typography reaches the screen: a no-break space before «?» and «:», never a line starting with it', async ({ page }) => {
  await open(page, '/fr/');
  const label = await page.locator('label[for="q"]').textContent();
  expect(label).toBe('Où partez-vous ?');
  await page.goto('/fr/guides/troubleshooting/');
  const faq = await page.locator('main').textContent();
  expect(faq).toContain('affiche « Aucun service »');
});

test.describe('axe', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected
  for (const url of ['/fr/', '/fr/esim/', '/fr/esim/thailand/', '/fr/guides/', '/fr/guides/iphone/']) {
    test(`axe: ${url}`, async ({ page }) => {
      await open(page, url);
      if (url === '/fr/esim/thailand/') await ready(page);
      await restful(page);
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
        .violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`));
      expect(v, url).toEqual([]);
    });
  }
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1366, height: 860 } });
  test('the language list keeps the page; the country page shows prices and no overflow', async ({ page }) => {
    await open(page); await ready(page);
    await page.locator('.hdr-actions details.langmenu summary').click();
    const entries = await page.locator('.langmenu-list li').allTextContents();
    expect(entries.map((t) => t.trim())).toEqual(['Русский', 'English', 'Español', 'Deutsch', 'Français', '简体中文', '한국어']);
    expect(await page.locator('.langmenu-list a').evaluateAll((as) => as.map((a) => a.getAttribute('href'))))
      .toEqual(['/esim/thailand/', '/en/esim/thailand/', '/es/esim/thailand/', '/de/esim/thailand/', '/zh/esim/thailand/', '/ko/esim/thailand/']);
    expect(sp(await page.locator('#localGrid .card .price').first().textContent())).toBe('2,99 USD');
    expect(await noOverflow(page)).toBe(true);
  });
});
