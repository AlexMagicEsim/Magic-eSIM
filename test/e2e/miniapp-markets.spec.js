'use strict';

/*
 * MINIAPP-I18N-LEGAL-1 (owner, 2026-10-23) in a real browser: the Mini App speaks seven languages, chosen from Telegram's
 * language_code (unknown or absent → English), and offers two PAYMENT MARKETS chosen only by the customer — the Russian
 * market (roubles, Platega, the Russian documents; the default, exactly as before) and the international market (the
 * GLOBAL catalogue in US dollars, the English legal documents, no payment until a Merchant of Record exists).
 *
 * Every API is a fixture; nothing real is touched. The international catalogue is answered on its own path
 * (`/api/v1/retail/packages?market=global`) with USD prices that are NOT the rouble prices, so a converted or borrowed
 * figure would show.
 */

const { test, expect } = require('@playwright/test');
const LOCALES = require('../../app/locales.js');
const CORE = require('../../app/core.js');
const { installMiniApp, openApp, ESIM, PACKAGE } = require('./harness');

const GLOBAL_PACKAGE = { ...PACKAGE, price: 9.99, currency: 'USD' };
const GLOBAL_DAILY = {
  ...PACKAGE, package_id: 'pkg-jp-daily', name: 'Japan 1GB/Day', plan_type: 'DAILY', daily_term_mode: 'PER_DAY', daily_gb: 1,
  data_gb: 0, validity_days: 0, price: 2.49, currency: 'USD', term_prices: [{ days: 3, price: 6.99 }, { days: 7, price: 14.99 }],
};
const RU_DAILY = { ...GLOBAL_DAILY, price: 300, currency: undefined, term_prices: [{ days: 3, price: 900 }, { days: 7, price: 1900 }] };
const USD_FIXED = { ru: '$9.99', en: '$9.99', es: 'USD 9.99', de: '9,99 USD', fr: '9,99 USD', 'zh-Hans': 'US$9.99', ko: 'US$9.99' };
const usdLike = (s) => new RegExp(`^${s.replace(/[$.]/g, '\\$&').replace(/ /g, '[\\s\\u00a0\\u202f]')}$`);

const open = (page, opts = {}) => installMiniApp(page, {
  packages: [PACKAGE, RU_DAILY], globalPackages: [GLOBAL_PACKAGE, GLOBAL_DAILY], ...opts,
});
const market = (page) => page.locator('#market-switch [aria-checked="true"]').getAttribute('data-market');
async function toJapan(page) {
  await page.locator('#screen-home .card--row, #screen-home .tile').filter({ has: page.locator('.flag, img, svg') }).first().waitFor();
  await page.locator('#search').fill('JP');
  await page.locator('#screen-home .card--row, #screen-home .tile').first().click();
  await expect(page.locator('#screen-country[data-active]')).toBeVisible();
}

/* ------------------------------------------------------------------ languages */

const LANG_CASES = [
  ['ru', 'ru'], ['en-US', 'en'], ['es-MX', 'es'], ['de-DE', 'de'], ['fr', 'fr'], ['zh-CN', 'zh-Hans'], ['ko-KR', 'ko'],
  ['pt-BR', 'en'], [null, 'en'],
];
for (const [code, want] of LANG_CASES) {
  test(`Telegram ${code === null ? 'without a language' : code} → ${want}: the whole home speaks it, nothing mixed in`, async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    await open(page, { languageCode: code });
    await openApp(page);
    expect(await page.evaluate(() => document.documentElement.lang)).toBe(want);
    const W = LOCALES[want];
    await expect(page.locator('#market-switch [data-market="ru"]')).toHaveText(W['market.ru']);
    await expect(page.locator('#market-switch [data-market="global"]')).toHaveText(W['market.global']);
    await expect(page.locator('#search')).toHaveAttribute('placeholder', W['search.placeholder']);
    if (want !== 'ru') {
      // no Russian left on the home (the market switch's «₽» is a symbol, not a word)
      const text = await page.locator('#screen-home').innerText();
      expect(text.match(/[Ѐ-ӿ][^\n]*/)?.[0] || '').toBe('');
    }
    expect(await market(page)).toBe('ru');   // the language never moves the market
    expect(errors).toEqual([]);
  });
}

/* ------------------------------------------------------------------ markets */

test('the Russian market is the default, in roubles, and its checkout is the one it always was', async ({ page }) => {
  const state = await open(page, { languageCode: 'ru' });
  await openApp(page);
  expect(await market(page)).toBe('ru');
  await expect(page.locator('#market-hint')).toBeHidden();
  await toJapan(page);
  await page.locator('#screen-country .card--row, #screen-country .card').filter({ hasText: '5' }).first().click();
  await expect(page.locator('#tariff-buy')).toBeEnabled();
  await expect(page.locator('#tariff-buy')).toContainText('₽');
  await page.locator('#tariff-buy').click();
  await expect(page.locator('#screen-checkout[data-active]')).toBeVisible();
  await expect(page.locator('#checkout-pay')).toContainText('₽');
  await expect(page.locator('#checkout-terms')).toBeVisible();
  // the Russian consent and documents, unchanged
  await expect(page.locator('#screen-checkout a[href="https://magicesim.store/terms.html"]')).toHaveCount(1);
  expect(state.calls.filter((c) => c.path.endsWith('/api/v1/retail/packages')).length).toBeGreaterThan(0);
});

for (const [code, lang] of [['en', 'en'], ['ru', 'ru'], ['es', 'es'], ['de', 'de'], ['fr', 'fr'], ['zh-CN', 'zh-Hans'], ['ko', 'ko']]) {
  test(`${lang}: the international market shows US dollars from the GLOBAL catalogue, no rouble anywhere, and no way to pay`, async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const state = await open(page, { languageCode: code });
    await openApp(page);
    await page.locator('#market-switch [data-market="global"]').click();
    expect(await market(page)).toBe('global');
    await expect(page.locator('#market-hint')).toHaveText(LOCALES[lang]['market.globalHint']);
    await expect(page.locator('#home-promo')).toBeHidden();
    await toJapan(page);
    const nb = (x) => x.replace(/[\u00a0\u202f]/g, ' ');   // Intl writes no-break spaces inside an amount
    const country = nb(await page.locator('#screen-country').innerText());
    expect(country).toContain(USD_FIXED[lang]);
    expect(country).not.toMatch(/₽|\bRUB\b|руб/);
    await page.locator('#screen-country .card--row, #screen-country .card').filter({ hasText: usdLike(USD_FIXED[lang]).source.slice(1, -1) ? new RegExp(usdLike(USD_FIXED[lang]).source.slice(1, -1)) : USD_FIXED[lang] }).first().click();
    await expect(page.locator('#tariff-price')).toHaveText(usdLike(USD_FIXED[lang]));
    const buy = page.locator('#tariff-buy');
    await expect(buy).toHaveText(LOCALES[lang]['gco.continue']);
    expect(await page.locator('#screen-tariff').innerText()).not.toMatch(/₽/);
    await buy.click();
    // the international checkout — never the Russian one — and its pay button can't be pressed
    await expect(page.locator('#screen-gcheckout[data-active]')).toBeVisible();
    await expect(page.locator('#screen-checkout[data-active]')).toHaveCount(0);
    await expect(page.locator('#gco-total')).toHaveText(usdLike(USD_FIXED[lang]));
    await expect(page.locator('#gco-pay')).toBeDisabled();
    await expect(page.locator('#gco-pay')).toHaveText(LOCALES[lang]['gco.pay']);
    expect(await page.locator('#screen-gcheckout').innerText()).not.toMatch(/₽|СБП|Platega/);
    // the international catalogue came from Render only, with ?market=global; no order was ever asked for
    const globalCalls = state.calls.filter((c) => c.path.endsWith('/api/v1/retail/packages'));
    expect(globalCalls.length).toBeGreaterThan(0);
    expect(state.calls.filter((c) => /\/tma\/orders|\/topups\/quote|\/checkout|\/global\/orders|\/pay/.test(c.path))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('a daily plan on the international market: every term in US dollars, never the rouble ladder', async ({ page }) => {
  await open(page, { languageCode: 'en' });
  await openApp(page);
  await page.locator('#market-switch [data-market="global"]').click();
  await toJapan(page);
  await page.locator('#screen-country .card--daily').first().click();
  for (const term of GLOBAL_DAILY.term_prices) {
    await page.locator('.daily-term', { hasText: new RegExp(`^\\s*${term.days}\\s`) }).first().click();
    await expect(page.locator('#tariff-price')).toHaveText(`$${term.price}`);
  }
  // the chosen term is what the international checkout shows
  await page.locator('#tariff-buy').click();
  await expect(page.locator('#gco-total')).toHaveText(`$${GLOBAL_DAILY.term_prices[1].price}`);
  await expect(page.locator('#gco-summary')).toContainText('7');
  await expect(page.locator('#gco-pay')).toBeDisabled();
});

test('the market is remembered on the device, and switching back restores roubles', async ({ page }) => {
  await open(page, { languageCode: 'en' });
  await openApp(page);
  await page.locator('#market-switch [data-market="global"]').click();
  await page.reload();
  await page.waitForFunction(() => !document.querySelector('#screen-loading[data-active]'));
  expect(await market(page)).toBe('global');
  await page.locator('#market-switch [data-market="ru"]').click();
  await toJapan(page);
  expect(await page.locator('#screen-country').innerText()).toContain('₽');
});

test('the international catalogue failing says so — never roubles in its place', async ({ page }) => {
  await open(page, { languageCode: 'en', globalStatus: 503 });
  await openApp(page);
  await page.locator('#market-switch [data-market="global"]').click();
  await expect(page.locator('#home-notice')).toContainText(LOCALES.en['global.loadFailed']);
  expect(await page.locator('#home-countries').innerText()).not.toMatch(/₽/);
});

test('top-ups: roubles on the Russian market, «not available yet» on the international one', async ({ page }) => {
  const topups = { topup_available: true, purchase_enabled: true, topup_options: [{ option_id: 'o1', data_gb: 1, validity_days: 7, price_rub: 500, currency: 'RUB' }] };
  await open(page, { languageCode: 'en', esims: [ESIM], topups });
  await openApp(page);
  await page.locator('#nav-esims').click();
  await page.locator('#screen-esims .card').first().click();
  await expect(page.locator('#esim-topup')).toContainText(LOCALES.en['topup.action']);
  await page.locator('#nav-home').click();
  await page.locator('#market-switch [data-market="global"]').click();
  await page.locator('#nav-esims').click();
  await page.locator('#screen-esims .card').first().click();
  await expect(page.locator('#esim-topup')).toContainText(LOCALES.en['global.topupUnavailable']);
  expect(await page.locator('#esim-topup').innerText()).not.toMatch(/₽|500/);
});

test('Help links the documents of the market: the Russian ones, or the international website\'s English ones', async ({ page }) => {
  await open(page, { languageCode: 'en' });
  await openApp(page);
  await page.locator('#nav-help').click();
  await page.getByRole('button', { name: LOCALES.en['help.offer'], exact: true }).click();
  expect(await page.evaluate(() => window.__opened)).toBe('https://magicesim.store/terms.html');
  await page.locator('#nav-home').click();
  await page.locator('#market-switch [data-market="global"]').click();
  await page.locator('#nav-help').click();
  for (const [key, url] of [['legal.intl.terms', '/en/terms/'], ['legal.intl.refund', '/en/refund/'], ['legal.intl.privacy', '/en/privacy/']]) {
    await page.getByRole('button', { name: LOCALES.en[key], exact: true }).click();
    expect(await page.evaluate(() => window.__opened)).toBe(`https://magicesim.store${url}`);
  }
  await expect(page.getByRole('button', { name: LOCALES.en['help.offer'], exact: true })).toHaveCount(0);
});

/* ------------------------------------------------------------------ stage C: the two consents */

async function toGlobalCheckout(page, code = 'en', extra = {}) {
  const state = await open(page, { languageCode: code, ...extra });
  await openApp(page);
  await page.locator('#market-switch [data-market="global"]').click();
  await toJapan(page);
  await page.locator('#screen-country .card--row, #screen-country .card').filter({ hasText: /9[.,]99/ }).first().click();
  await page.locator('#tariff-buy').click();
  await expect(page.locator('#screen-gcheckout[data-active]')).toBeVisible();
  return state;
}
const consentState = (page) => page.locator('#gco-consents').getAttribute('data-state');

for (const [code, lang] of [['en', 'en'], ['ru', 'ru'], ['es', 'es'], ['de', 'de'], ['fr', 'fr'], ['zh-CN', 'zh-Hans'], ['ko', 'ko']]) {
  test(`${lang}: two consent boxes in the website's words, unticked, and the payment stays shut with both ticked`, async ({ page }) => {
    const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const state = await toGlobalCheckout(page, code);
    const W = LOCALES[lang];
    const terms = page.locator('#gco-terms'); const delivery = page.locator('#gco-delivery'); const pay = page.locator('#gco-pay');
    await expect(page.locator('#gco-consents legend')).toHaveText(W['gco.legend']);
    await expect(page.locator('#screen-gcheckout .gco-unavailable')).toHaveText(W['gco.unavailable']);
    // the sentences, with the document names as links to the English documents
    const fill = (k, v) => W[k].replace(/\{([a-z]+)\}/g, (_, n) => v[n]);
    await expect(page.locator('#gco-terms-text')).toHaveText(fill('gco.terms', { terms: W['gco.termsLink'], refund: W['gco.refundLink'] }));
    await expect(page.locator('label[for="gco-delivery"] span')).toHaveText(W['gco.delivery']);
    await expect(page.locator('#gco-privacy')).toHaveText(fill('gco.privacy', { privacy: W['gco.privacyLink'] }));
    // LEGAL-4: the language's own version of each document where the website publishes one, else the English
    const U = CORE.intlLegalUrls(lang);
    expect(U.terms).toBe(`https://magicesim.store/${{ ru: 'en', en: 'en', es: 'es', de: 'de', fr: 'fr', 'zh-Hans': 'zh', ko: 'ko' }[lang]}/terms/`);
    expect(await page.$$eval('#gco-consents a', (as) => as.map((a) => [a.getAttribute('href'), a.textContent]))).toEqual([
      [U.terms, W['gco.termsLink']], [U.refund, W['gco.refundLink']], [U.privacy, W['gco.privacyLink']]]);
    // never ticked in advance; each box on its own; the button never opens while payments are off
    await expect(terms).not.toBeChecked(); await expect(delivery).not.toBeChecked();
    expect(await consentState(page)).toBe('none');
    await terms.check(); expect(await consentState(page)).toBe('terms'); await expect(pay).toBeDisabled();
    await terms.uncheck(); await delivery.check(); expect(await consentState(page)).toBe('delivery'); await expect(pay).toBeDisabled();
    await terms.check(); expect(await consentState(page)).toBe('both');
    await expect(page.locator('#gco-consents')).toHaveAttribute('data-ready', 'false');
    await expect(pay).toBeDisabled();
    await expect(pay).toHaveAttribute('aria-disabled', 'true');
    await pay.click({ force: true });
    await expect(page.locator('#screen-gcheckout[data-active]')).toBeVisible();
    await delivery.uncheck(); expect(await consentState(page)).toBe('terms');
    // nothing on this screen reached the network: no email, no quote, no order, no payment
    expect(state.calls.filter((c) => c.method && c.method !== 'GET' && !/\/tma\/(session|events)/.test(c.path))).toEqual([]);
    expect(state.calls.filter((c) => /\/orders|\/quotes|\/topups\/quote|\/pay|platega/i.test(c.path))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('the boxes are cleared every time the international checkout opens again', async ({ page }) => {
  await toGlobalCheckout(page, 'en');
  await page.locator('#gco-terms').check(); await page.locator('#gco-delivery').check();
  expect(await consentState(page)).toBe('both');
  await page.locator('#nav-home').click();
  await toJapan(page);
  await page.locator('#screen-country .card--row, #screen-country .card').filter({ hasText: /9[.,]99/ }).first().click();
  await page.locator('#tariff-buy').click();
  await expect(page.locator('#gco-terms')).not.toBeChecked();
  await expect(page.locator('#gco-delivery')).not.toBeChecked();
  expect(await consentState(page)).toBe('none');
});

test('a document link opens the English document and never ticks its box', async ({ page }) => {
  await toGlobalCheckout(page, 'en');
  for (const [href, url] of [['/en/terms/', 'https://magicesim.store/en/terms/'], ['/en/refund/', 'https://magicesim.store/en/refund/']]) {
    await page.locator(`#gco-terms-text a[href$="${href}"]`).click();
    expect(await page.evaluate(() => window.__opened)).toBe(url);
    await expect(page.locator('#gco-terms')).not.toBeChecked();
  }
  await page.locator('#gco-privacy a').click();
  expect(await page.evaluate(() => window.__opened)).toBe('https://magicesim.store/en/privacy/');
  expect(await consentState(page)).toBe('none');
});

test('the Russian market never shows the international checkout, and the international one never the Russian consent', async ({ page }) => {
  await open(page, { languageCode: 'ru' });
  await openApp(page);
  await toJapan(page);
  await page.locator('#screen-country .card--row, #screen-country .card').filter({ hasText: '₽' }).first().click();
  await page.locator('#tariff-buy').click();
  await expect(page.locator('#screen-checkout[data-active]')).toBeVisible();
  await expect(page.locator('#screen-gcheckout[data-active]')).toHaveCount(0);
  await expect(page.locator('#checkout-terms')).not.toBeChecked();
  await expect(page.locator('#checkout-pay')).toBeDisabled();
  await expect(page.locator('#checkout-methods [data-method="sbp"]')).toHaveAttribute('aria-checked', 'true');
});

test('the international checkout passes axe (both boxes ticked, light and dark)', async ({ page }) => {
  const AXE = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  for (const colorScheme of ['light', 'dark']) {
    await toGlobalCheckout(page, 'de', { colorScheme });
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-tg-scheme'))).toBe(colorScheme);
    await page.locator('#gco-terms').check(); await page.locator('#gco-delivery').check();
    await page.evaluate(AXE);
    const res = await page.evaluate(() => window.axe.run('#screen-gcheckout'));
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});

test('Help on the international market in Spanish links the Spanish documents (LEGAL-4)', async ({ page }) => {
  await open(page, { languageCode: 'es' });
  await openApp(page);
  await page.locator('#market-switch [data-market="global"]').click();
  await page.locator('#nav-help').click();
  for (const [key, url] of [['legal.intl.terms', '/es/terms/'], ['legal.intl.refund', '/es/refund/'], ['legal.intl.privacy', '/es/privacy/']]) {
    await page.getByRole('button', { name: LOCALES.es[key], exact: true }).click();
    expect(await page.evaluate(() => window.__opened)).toBe(`https://magicesim.store${url}`);
  }
});
