'use strict';

/*
 * MINIAPP-I18N-LEGAL-2 (2026-10-23) — what the production check of PR #132 found, pinned in a browser.
 *
 * 1. «$400.00» on the international market. Reproduced: the rouble catalogue (2 MB from Render, or the static snapshot,
 *    or the session cache) answered AFTER the customer switched to International, replaced the US-dollar rows and was
 *    drawn with the dollar format — «from $400.00» for a 400 ₽ plan. Fixed in renderCatalogue: an answer (or a failure)
 *    that lands after the market changed is not drawn. Here: every late rouble source, and every way the international
 *    catalogue can fail (429, 503, timeout, slow), never shows a rouble amount, a converted amount or an invented one.
 * 2. «IP: Япония» / «4 сети» on a German card: tariffDistinguishers spoke Russian in every language. The two Japan rows
 *    below are the production GLOBAL catalogue's own (2026-10-23), fields verbatim; only the prices differ per market.
 * 3. «15 일» on a Korean card — the number and the counter word are written together: «15일».
 * 4. «Prices are in roubles. Pay via SBP or a Russian bank card» under the international catalogue.
 */

const { test, expect } = require('@playwright/test');
const { withLayout, defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
// The backend sends the layout of every country page with each catalogue (assets/assortment-view.js); fixtures get
// the one it gives an unfiltered list, and the committed snapshot is served with it (test/helpers/assortment-layout.cjs).
test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });
const LOCALES = require('../../app/locales.js');
const C = require('../../app/core.js');   // word forms and plural rules (country names come from the page)
const { installMiniApp, openApp } = require('./harness');

const RENDER = 'https://esim-backend-3wmu.onrender.com';
const BASE_ROW = {
  data_gb: 3, validity_days: 15, country_code: 'JP', region: 'JP', topup_available: true, speed: '3G/4G/5G', fup_policy: '',
  coverage_country_codes: ['JP'], coverage_countries: [], coverage_flags: '🇯🇵', plan_type: 'FIXED_VOLUME', daily_gb: null,
  daily_term_mode: null, daily_throttle_label: null, daily_throttle_continues: false, daily_reset_confirmed: false,
  sellable_days: [], network_technologies: ['3G', '4G', '5G'], hotspot_supported: null, activation_policy: 'unknown',
  speed_note: '', calls_supported: null, sms_supported: null, data_only: null, unlimited: null,
};
const ONE_NET = { ...BASE_ROW, package_id: '0af096b3-e069-4c33-a983-e88ff49d4a2f', name: 'Japan 3GB 15Days (IIJ)',
  networks: [{ operator: 'NTT docomo', type: '5G' }], ip_export: ['JP'] };
const FOUR_NETS = { ...BASE_ROW, package_id: 'c334ff34-1827-4a9c-9efe-38e72094861c', name: 'Japan 3GB 15Days',
  networks: [{ operator: 'NTT docomo', type: '5G' }, { operator: 'Rakuten Mobile', type: '5G' }, { operator: 'KDDI/au', type: '5G' }, { operator: 'SoftBank', type: '5G' }],
  ip_export: ['HK'] };
const RU_ROWS = [{ ...ONE_NET, price: 400 }, { ...FOUR_NETS, price: 400 }];
const GL_ROWS = [{ ...ONE_NET, price: 4.99, currency: 'USD' }, { ...FOUR_NETS, price: 4.99, currency: 'USD' }];
const LANGS = [['ru', 'ru'], ['en', 'en'], ['es', 'es'], ['de', 'de'], ['fr', 'fr'], ['zh-CN', 'zh-Hans'], ['ko', 'ko']];
const nb = (s) => s.replace(/[  ]/g, ' ');
const FOUR_HUNDRED = /\$\s?400|400[.,]00|USD 400|400 USD|₽|руб/;

const delay = (ms) => new Promise((z) => setTimeout(z, ms));
async function app(page, opts = {}) {
  const state = await installMiniApp(page, { languageCode: 'en', packages: RU_ROWS, globalPackages: GL_ROWS, ...opts });
  return state;
}
const usdOnly = async (page, where) => {
  const text = nb(await page.locator(where).innerText());
  expect(text).not.toMatch(FOUR_HUNDRED);
  return text;
};

/* ------------------------------------------------------------ 1. late rouble answers, failing international answers */

for (const [name, routeIt] of [
  ['the live rouble catalogue', (page, ms) => page.route((u) => u.href === `${RENDER}/api/v1/retail/packages`, async (r) => { await delay(ms); return r.fallback(); })],
  ['the static rouble snapshot', (page, ms) => page.route('**/assets/catalog.json*', async (r) => {
    await delay(ms);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(withLayout({ schema_version: 1, generated_at: '2026-10-23T00:00:00Z', source: 'test', package_count: 2, packages: RU_ROWS, data: RU_ROWS })) });
  })],
]) {
  test(`${name} answering after the switch to International is not drawn — no «$400.00»`, async ({ page }) => {
    await app(page);
    await routeIt(page, 1500);
    await page.goto('/app/index.html');
    await page.locator('#market-switch [data-market="global"]').click();
    await page.waitForTimeout(2500);   // the late rouble answer has landed by now
    const home = await usdOnly(page, '#home-countries');
    expect(home).toContain('$4.99');
    await page.locator('#search').fill('JP');
    await page.locator('#screen-home .card--row, #screen-home .tile').first().click();
    const country = await usdOnly(page, '#screen-country');
    expect(country).toContain('$4.99');
    // and back on the Russian market the same plans are roubles again
    await page.locator('#nav-home').click();
    await page.locator('#market-switch [data-market="ru"]').click();
    await expect(page.locator('#home-countries')).toContainText('₽');
    expect(nb(await page.locator('#home-countries').innerText())).not.toMatch(/\$|USD/);
  });
}

test('the rouble catalogue FAILING after the switch does not wipe the international list', async ({ page }) => {
  await app(page);
  await page.route((u) => u.href === `${RENDER}/api/v1/retail/packages`, async (r) => { await delay(1200); return r.fulfill({ status: 503, body: '{}' }); });
  await page.route('https://api.magicesim.store/**', (r) => r.fulfill({ status: 503, body: '{}' }));
  await page.route('**/assets/catalog.json*', async (r) => { await delay(1200); return r.fulfill({ status: 404, body: '' }); });
  await page.goto('/app/index.html');
  await page.locator('#market-switch [data-market="global"]').click();
  await page.waitForTimeout(2500);
  await expect(page.locator('#home-countries')).toContainText('$4.99');
  await expect(page.locator('#home-countries')).not.toContainText(LOCALES.en['home.loadFailed']);
});

for (const [name, opts, routeIt] of [
  ['429', { globalStatus: 429 }, null],
  ['503', { globalStatus: 503 }, null],
  ['a timeout', {}, (page) => page.route(`${RENDER}/api/v1/retail/packages?market=global`, (r) => r.abort('timedout'))],
  ['a slow answer (6 s)', {}, (page) => page.route(`${RENDER}/api/v1/retail/packages?market=global`, async (r) => { await delay(6000); return r.fallback(); })],
]) {
  test(`the international catalogue with ${name}: no price at all until a real US-dollar answer — never roubles, never invented`, async ({ page }) => {
    const state = await app(page, opts);
    if (routeIt) await routeIt(page);
    await openApp(page);
    await page.locator('#market-switch [data-market="global"]').click();
    await page.waitForTimeout(300);
    // skeleton or error: no amount of any kind in the list or its notice (the switch's «· ₽» / «· $» are labels)
    const loading = nb(await page.locator('#home-countries').innerText() + await page.locator('#home-notice').innerText());
    expect(loading).not.toMatch(/\d[.,]\d{2}|₽|\$\s?\d|\d\s?USD/);
    await page.locator('#search').fill('JP');
    await expect(page.locator('#screen-home .card--row, #screen-home .tile')).toHaveCount(0);
    if (opts.globalStatus) await expect(page.locator('#home-notice')).toContainText(LOCALES.en['global.loadFailed']);
    if (name.startsWith('a slow')) {
      await page.locator('#search').fill('');
      await expect(page.locator('#home-countries')).toContainText('$4.99', { timeout: 10000 });
    }
    // no conversion: the international screen never asked for a rate or a quote
    expect(state.calls.filter((c) => /rate|fx|quote|orders/i.test(c.path))).toEqual([]);
  });
}

test('back to the Russian market while the international catalogue is still loading: roubles, and the late dollars are dropped', async ({ page }) => {
  await app(page);
  await page.route(`${RENDER}/api/v1/retail/packages?market=global`, async (r) => { await delay(2000); return r.fallback(); });
  await openApp(page);
  await page.locator('#market-switch [data-market="global"]').click();
  await page.locator('#market-switch [data-market="ru"]').click();
  await page.waitForTimeout(2600);
  const home = nb(await page.locator('#home-countries').innerText());
  expect(home).toContain('₽');
  expect(home).not.toMatch(/\$|USD/);
});

/* ------------------------------------------------------------ 2.–4. real IP / network fields, Korean days, the RU note */

for (const [code, lang] of LANGS) {
  for (const market of ['ru', 'global']) {
    test(`${lang}, ${market}: the two Japan cards tell themselves apart in ${lang} (real IP and network fields)`, async ({ page }) => {
      await app(page, { languageCode: code });
      await openApp(page);
      if (market === 'global') await page.locator('#market-switch [data-market="global"]').click();
      await page.locator('#search').fill('JP');
      await page.locator('#screen-home .card--row, #screen-home .tile').first().click();
      await expect(page.locator('#screen-country .card').first()).toBeVisible();
      const chips = await page.locator('#screen-country .tariff__chip').allInnerTexts();
      // the country names the browser has: the site's names file of the language (Node has none of them)
      const names = await page.evaluate((l) => [window.MagicCore.countryLabel('JP', l), window.MagicCore.countryLabel('HK', l)], lang);
      const want = [`IP: ${names[0]}`, 'NTT docomo', `IP: ${names[1]}`, C.countPhrase(lang, 4, C.WORD_FORMS.network)];
      expect(chips.slice().sort()).toEqual(want.slice().sort());
      if (lang === 'ru') expect(want).toEqual(['IP: Япония', 'NTT docomo', 'IP: Гонконг', '4 сети']);   // Russian unchanged
      const country = await page.locator('#screen-country').innerText();
      if (lang !== 'ru') expect(country.match(/[^\n]*[Ѐ-ӿ][^\n]*/)?.[0] || '').toBe('');
      // the term, number and word as one phrase — «15일» in Korean, «15 Tage» in German
      await expect(page.locator('#screen-country .tariff__pill', { hasText: '15' }).first()).toHaveText(C.countPhrase(lang, 15, C.WORD_FORMS.day));
      if (lang === 'ko') expect(country).toContain('15일');
      expect(country).not.toContain('15 일');
      // the payment note: the Russian market's sentence on the Russian market only
      await page.locator('#nav-home').click();
      const note = page.locator('#home-paynote');
      if (market === 'ru') await expect(note).toBeVisible(); else await expect(note).toBeHidden();
      if (market === 'ru') await expect(note).toHaveText(LOCALES[lang]['home.payNote']);
    });
  }
}

test('light and dark theme: the international home and a country screen — no rouble note, localised chips, no overflow', async ({ page }) => {
  // (The IP chip's own contrast — 4.25:1 light, 3.52:1 on Telegram's dark hint colour — predates this work and is the same
  // on the Russian market; recorded in the MINIAPP-I18N-LEGAL-2 report, not changed here.)
  for (const colorScheme of ['light', 'dark']) {
    await app(page, { languageCode: 'de', colorScheme });
    await openApp(page);
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-tg-scheme'))).toBe(colorScheme);
    await page.locator('#market-switch [data-market="global"]').click();
    await expect(page.locator('#home-paynote')).toBeHidden();
    await page.locator('#search').fill('JP');
    await page.locator('#screen-home .card--row, #screen-home .tile').first().click();
    await expect(page.locator('#screen-country .tariff__chip').first()).toBeVisible();
    const chips = await page.locator('#screen-country .tariff__chip').allInnerTexts();
    expect(chips).toContain('4 Netze');
    expect(chips.join(' ')).not.toMatch(/[Ѐ-ӿ]/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
