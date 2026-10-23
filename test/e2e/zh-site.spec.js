'use strict';

/*
 * The Simplified Chinese site, /zh/ (I18N ZH-1), in a real browser: Chromium at 390 and 320 (the projects) and at 1366,
 * and in WebKit (the webkit-flags project runs this file too — Safari's engine). The GLOBAL catalogue is a fixture and
 * the quote POST is answered in the browser, as the other language specs do; nothing reaches the API.
 *
 *   * a country page: local → regional → daily, Chinese labels, prices «US$2.99» (owner D2), the daily lines from the
 *     Chinese table, a per-day term picked on the card and handed to the checkout and the quote;
 *   * the list and the home: a search by the Chinese name; the language list keeps the reader on the same page;
 *   * an unknown /zh/ address gets the Chinese 404, without the counter;
 *   * fonts (T3): the Chinese characters from a system font, no tighter tracking; typography (D6) on screen;
 *   * no legal link to a Russian document (D8); Apple's mainland facts on the compatibility guide (D12);
 *   * the logo «Reveal + Wave» and Expressive as in English, CLS < 0.02, axe clean, no clipped word, noindex.
 */

const { test, expect } = require('@playwright/test');
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
const BODY = JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: [...LOCALS, PER_DAY, FIXED_DAILY, REGIONAL] });

async function open(page, url = '/zh/esim/thailand/', { gate } = {}) {
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

test('a country page in Chinese: blocks, labels, «US$» prices and the daily lines from the Chinese table', async ({ page }) => {
  const st = await open(page); await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.locator('h1')).toHaveText('泰国 eSIM');
  const order = await page.evaluate(() => [...document.querySelectorAll('.plan-block:not([hidden])')].map((s) => s.id));
  expect(order).toEqual(['localBlock', 'regionalBlock', 'dailyBlock']);
  await expect(page.locator('.cp-jump a:visible')).toHaveText([/泰国\s*8/, /区域套餐\s*1/, /每日流量\s*2/]);
  const loc = page.locator('#localGrid .card').first();
  await expect(loc.locator('.plan-badge')).toHaveText('单国套餐');
  await expect(loc.locator('.plan-data')).toHaveText('1 GB');
  await expect(loc.locator('.plan-term')).toHaveText('7 天');
  await expect(loc.locator('.price')).toHaveText('US$2.99');
  await expect(page.locator('#localBlock')).toContainText('显示全部 8 个套餐');
  const daily = page.locator('#dailyGrid .card', { hasText: '每天 1 GB' });
  await expect(daily).toContainText('之后最高 512 Kbps');
  const fixed = page.locator('#dailyGrid .card', { hasText: '每天 1.5 GB' });
  await expect(fixed).toContainText('流量每 24 小时重置');
  await expect(fixed.locator('.plan-term')).toHaveText('3 天');
  await expect(page.locator('#regionalGrid .card .price').first()).toHaveText('US$12.99');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBe(0);
  expect(st.csp).toEqual([]); expect(st.errors).toEqual([]); expect(st.external).toEqual([]);
  expect(await noOverflow(page)).toBe(true);
});

test('per-day: the term picked on the card goes to the checkout and the quote; the checkout speaks Chinese', async ({ page }) => {
  const st = await open(page); await ready(page);
  const card = page.locator('#dailyGrid .card', { hasText: '每天 1 GB' });
  await expect(card.getByRole('radio', { name: '3' })).toBeChecked();
  await card.getByRole('radio', { name: '7' }).check();
  await expect(card.locator('.price')).toHaveText('US$10.99');
  await expect(card.locator('.plan-term')).toHaveText('7 天');
  await card.getByRole('button').click();
  await expect(page.locator('#coDays')).toHaveValue('7');
  await expect(page.locator('#coTerm')).toHaveText('7 天');
  await expect(page.locator('#coTitle')).toHaveText('结账');
  await expect(page.locator('#coQuote')).toHaveText('获取准确价格');
  await page.locator('#coQuote').click();
  await expect(page.locator('#coTotal')).toHaveText('US$10.99');
  expect(st.quotes).toEqual([{ package_id: PER_DAY.package_id, days: 7 }]);
  await expect(page.locator('#coPay')).toBeDisabled();                 // payment is not available — in Chinese too
  expect(st.errors).toEqual([]);
});

test('the list: a search by the Chinese name or the ISO code; the count speaks Chinese', async ({ page }) => {
  const st = await open(page, '/zh/esim/');
  await page.locator('#hq').fill('日本');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('日本');
  await expect(page.locator('#hubCount')).toHaveText('找到 1 个目的地');
  await page.locator('#hq').fill('美国');
  await expect(page.locator('#hubList li:not([hidden]) a').first()).toContainText('美国');
  await page.locator('#hq').fill('zzzz');
  await expect(page.locator('#hubEmpty')).toBeVisible();
  await expect(page.locator('#hubCount')).toHaveText('无匹配结果');
  expect(st.external).toEqual([]); expect(st.errors).toEqual([]);
});

test('the home: the search opens the Chinese page of the country; Expressive and the logo are on', async ({ page }) => {
  const st = await open(page, '/zh/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', /.+/);
  await expect(page.locator('.brand-logo .lm-symbol')).toHaveCount(1);
  await expect(page.locator('.brand-logo .lm-waves')).toHaveCount(1);
  await page.locator('#q').fill('墨西');
  const first = page.locator('#results a.res').first();
  await expect(first).toHaveText('墨西哥');
  await first.click();
  await expect(page).toHaveURL(/\/zh\/esim\/mexico\/$/);
  expect(st.errors).toEqual([]); expect(st.external).toEqual([]);
});

test('the logo «Reveal + Wave» plays once per visit; motion.js on the home and a country page, not on a guide', async ({ page }) => {
  const loaded = [];
  page.on('request', (r) => { if (/\/assets\/motion\.js/.test(r.url())) loaded.push(new URL(page.url()).pathname); });
  await open(page, '/zh/'); await page.waitForTimeout(400);
  expect(await page.evaluate(() => [document.documentElement.classList.contains('lm-once'), sessionStorage.getItem('me-logo')])).toEqual([true, '1']);
  await page.goto('/zh/esim/thailand/'); await page.waitForTimeout(400);
  expect(await page.evaluate(() => document.documentElement.classList.contains('lm-once')), 'not again in the same visit').toBe(false);
  await page.goto('/zh/guides/iphone/'); await page.waitForTimeout(400);
  expect([...new Set(loaded)]).toEqual(['/zh/', '/zh/esim/thailand/']);
});

test('the phone menu lists the other languages, each to the same page', async ({ page }) => {
  await open(page, '/zh/guides/android/');
  await page.locator('.mnav summary').click();
  const langs = page.locator('.mnav-panel a[hreflang]');
  await expect(langs).toHaveText(['Русский', 'English', 'Español', 'Deutsch', 'Français', '한국어']);
  expect(await langs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/android.html', '/en/guides/android/', '/es/guides/android/', '/de/guides/android/', '/fr/guides/android/', '/ko/guides/android/']);
  expect(await noOverflow(page)).toBe(true);
});

test('an unknown /zh/ address gets the Chinese 404, without the counter', async ({ page }) => {
  const metrika = [];
  await page.route('**/mc.yandex.ru/**', (r) => { metrika.push(r.request().url()); return r.fulfill({ status: 204, body: '' }); });
  await page.route((u) => u.pathname === '/zh/esim/atlantis/', (r) => r.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: NOT_FOUND }));
  await page.goto('/zh/esim/atlantis/');
  await expect(page.locator('h1')).toHaveText('找不到页面');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.locator('a.home').first()).toHaveAttribute('href', '/zh/');
  expect(metrika).toEqual([]);
});

test('fonts (T3): Chinese from a system font after Inter, no tighter tracking on headings and prices', async ({ page }) => {
  await open(page); await ready(page);
  const f = await page.evaluate(() => ({ body: getComputedStyle(document.body).fontFamily, h1: getComputedStyle(document.querySelector('h1')).letterSpacing,
    price: getComputedStyle(document.querySelector('.price')).letterSpacing }));
  expect(f.body).toMatch(/^"?Inter"?, "?PingFang SC"?/);
  expect(['normal', '0px']).toContain(f.h1);
  expect(['normal', '0px']).toContain(f.price);
  await page.goto('/en/esim/thailand/');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('h1')).letterSpacing), 'English keeps its tracking').not.toBe('normal');
});

test('D8 and D12: no legal link to a Russian document; Apple\'s mainland facts on the compatibility guide', async ({ page }) => {
  await open(page, '/zh/');
  expect(await page.locator('footer a[href="/terms.html"], footer a[href="/privacy.html"]').count()).toBe(0);
  await page.goto('/zh/guides/compatibility/');
  const sec = page.locator('section#mainland');
  await expect(sec.locator('h2')).toHaveText('在中国大陆购买的 iPhone');
  await expect(sec).toContainText('iPhone 18 Pro、iPhone 18 Pro Max、iPhone Duo、iPhone 17e 和 iPhone Air');
  await expect(sec).toContainText('请在入境前安装 eSIM');
  await expect(sec.locator('a[href="https://support.apple.com/zh-cn/123879"]')).toHaveCount(1);
});

test('no layout shift while a country page loads its plans (CLS < 0.02)', async ({ page }) => {
  let release; const gate = new Promise((r) => { release = r; });
  await page.addInitScript(() => {
    window.__cls = 0;
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* WebKit: no API */ }
  });
  await open(page, '/zh/esim/thailand/', { gate });
  await page.waitForTimeout(500);
  release();
  await ready(page);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.02);
});

test('no page overflows the width, no button or tab clips its words (long Chinese names too)', async ({ page }) => {
  for (const url of ['/zh/', '/zh/esim/', '/zh/esim/thailand/', '/zh/esim/central-african-republic/', '/zh/esim/saint-vincent-and-the-grenadines/',
    '/zh/guides/', '/zh/guides/iphone/', '/zh/guides/compatibility/', '/zh/guides/troubleshooting/']) {
    await open(page, url);
    if (url === '/zh/esim/thailand/') await ready(page);
    expect(await noOverflow(page), `${url}: horizontal scroll`).toBe(true);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.btn, .cp-jump a, .hub-tile, .dest-tile, .guide-card, .langsw, .co-steps li, h1, h2')]
      .filter((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1).map((e) => e.className + ': ' + e.textContent.trim().slice(0, 40)));
    expect(clipped, url).toEqual([]);
  }
});

test('Chinese typography reaches the screen: full-width punctuation, a space between Chinese and Latin', async ({ page }) => {
  await open(page, '/zh/');
  expect(await page.locator('label[for="q"]').textContent()).toBe('您要去哪里？');
  await page.goto('/zh/guides/troubleshooting/');
  expect(await page.locator('main').textContent()).toContain('eSIM 显示“无服务”');
});

test.describe('axe', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected
  for (const url of ['/zh/', '/zh/esim/', '/zh/esim/thailand/', '/zh/guides/', '/zh/guides/compatibility/']) {
    test(`axe: ${url}`, async ({ page }) => {
      await open(page, url);
      if (url === '/zh/esim/thailand/') await ready(page);
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
      .toEqual(['/esim/thailand/', '/en/esim/thailand/', '/es/esim/thailand/', '/de/esim/thailand/', '/fr/esim/thailand/', '/ko/esim/thailand/']);
    await expect(page.locator('#localGrid .card .price').first()).toHaveText('US$2.99');
    expect(await noOverflow(page)).toBe(true);
  });
});
