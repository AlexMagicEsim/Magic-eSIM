'use strict';

/*
 * The Mini App's plan card is the website's card, and nothing on it is cut, squeezed or wider than the phone
 * (UX audit 2026-10-25, on the live RUB and USD catalogues at 320–430px, seven languages, both themes).
 *
 * What the audit found, each pinned here:
 *   1. A daily card's throttle sentence was ONE unbreakable pill: the Italy screen was 509px wide on a 390px phone and the
 *      tab bar ended 119px short of the content.
 *   2. A FIXED_TERM daily plan («EUconnect Unlimited 7 Days», 2 000 ₽) printed «—» on its card and «недоступно» on its
 *      screen — it has no ladder; its price is the row's, its term its own (the website sells it so).
 *   3. A regional card read «Регион · 35 стран» squeezed onto the volume's line («30 днейВьетнам и Юго-Восточная Азия»);
 *      the website reads «Европа, 34 страны» — it leaves RU/UA/BY out, the Mini App counted Ukraine.
 *   4. Pills at 11–12px; nothing on a plan card or the tariff screen is below 13px now.
 *   5. Country names and tab labels were cut with an ellipsis («Vereinigte Arabische…», «Meine eSI…» at 320px).
 *   6. The checkout's e-mail field sat 16px inside the column with a 42px gutter for an icon it does not have; the promo
 *      opener's chevron was glued to its label.
 *   7. Telegram painted its own background, header and bottom bar with the CARD colour while the page is the GROUND
 *      colour — a darker band on every overscroll, height change and the iPhone safe area in the dark theme.
 *   8. The sticky tab bar sat on the on-screen keyboard over the field being typed into.
 * The rows are a frozen copy of the live catalogue (test/fixtures/miniapp-ux-rows.json), so a price move cannot turn this red.
 */

const { test, expect } = require('@playwright/test');
const { defaultSnapshotRoute } = require('../helpers/assortment-layout.cjs');
const { installMiniApp, openApp } = require('./harness.js');
const ROWS = require('../fixtures/miniapp-ux-rows.json');

test.beforeEach(async ({ context }) => { await defaultSnapshotRoute(context); });

const NAMES = { IT: { ru: 'Италия', en: 'Italy', de: 'Italien' }, TH: { ru: 'Таиланд', en: 'Thailand', de: 'Thailand' } };
const FIXED = ROWS.find((r) => r.daily_term_mode === 'FIXED_TERM');
const rub = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;

async function toCountry(page, cc, lang = 'ru') {
  await openApp(page);
  await page.fill('#search', NAMES[cc][lang]);
  await page.locator('#home-countries .card--row, #home-countries .tile', { hasText: NAMES[cc][lang] }).first().click();
  await expect(page.locator('#screen-country[data-active]')).toBeVisible();
}

/** The page never scrolls sideways, and the tab bar spans it. */
async function noSideways(page) {
  const m = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bar: Math.round(document.querySelector('.tabbar').getBoundingClientRect().width),
    vw: document.documentElement.clientWidth,
  }));
  expect(m.doc).toBeLessThanOrEqual(0);
  expect(m.bar).toBe(m.vw);
}

/** Every visible text on the screen at its computed size; the smallest found, with what it was. */
async function smallestText(page, root) {
  return page.$$eval(`${root} *`, (nodes) => nodes
    .filter((n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim()) && n.getBoundingClientRect().width > 0)
    .map((n) => ({ px: parseFloat(getComputedStyle(n).fontSize), cls: String(n.className), text: n.textContent.trim().slice(0, 30) }))
    .sort((a, b) => a.px - b.px)[0]);
}

test('a daily card\'s long lines wrap: the country screen is never wider than the phone (was 509px at 390)', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS });
  await toCountry(page, 'IT');
  await expect(page.locator('#country-list .plan-daily')).toHaveCount(2);
  await noSideways(page);
  const over = await page.$$eval('#country-list .card--tariff *', (ns) => ns
    .filter((n) => n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 1).map((n) => n.className));
  expect(over).toEqual([]);
});

test('the plan card reads in the website\'s order and sizes: volume and price, then term and kind, nothing below 13px', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS });
  await toCountry(page, 'IT');
  const card = page.locator('#country-list .plan-local').first();
  await expect(card.locator('.card__title')).toHaveText('1 ГБ');
  await expect(card.locator('.card__price')).toHaveText('150 ₽');
  await expect(card.locator('.tariff__term')).toHaveText('7 дней');
  await expect(card.locator('.tariff__kind')).toHaveText('Локальный тариф');
  await expect(card.locator('.tariff__more')).toHaveText('Покрытие и условия');

  const box = (sel) => card.locator(sel).evaluate((n) => { const r = n.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, px: parseFloat(getComputedStyle(n).fontSize) }; });
  const title = await box('.card__title'); const price = await box('.card__price'); const term = await box('.tariff__term');
  // The volume and the price share line one; the term sits under them.
  expect(Math.abs(title.top - price.top)).toBeLessThan(8);
  expect(term.top).toBeGreaterThanOrEqual(title.bottom - 1);
  expect(title.px).toBeGreaterThanOrEqual(18); expect(title.px).toBeLessThanOrEqual(24);
  expect(price.px).toBeGreaterThanOrEqual(18); expect(price.px).toBeLessThanOrEqual(22);
  expect(term.px).toBeGreaterThanOrEqual(14);
  expect((await smallestText(page, '#country-list')).px).toBeGreaterThanOrEqual(13);

  await card.click();
  await expect(page.locator('#screen-tariff[data-active]')).toBeVisible();
  const small = await smallestText(page, '#tariff-body');
  expect(small.px, `${small.cls} «${small.text}»`).toBeGreaterThanOrEqual(13);
});

test('a FIXED_TERM daily plan shows its price and can be bought for its own term, as on the website', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS });
  await toCountry(page, 'IT');
  const card = page.locator(`#country-list .card--daily[data-package-id="${FIXED.package_id}"]`);
  await expect(card.locator('.card__price')).toHaveText(rub(FIXED.price));               // was «—»
  await expect(card.locator('.tariff__term')).toHaveText(`${FIXED.validity_days} дней`);
  await expect(card.locator('.tariff__per')).toHaveCount(0);                             // one term: a price, not «от»

  await card.click();
  await expect(page.locator('#tariff-price')).toHaveText(rub(FIXED.price));
  await expect(page.locator('.daily-term')).toHaveCount(0);                              // nothing to choose
  await expect(page.locator('#tariff-buy')).toHaveText(`Купить за ${rub(FIXED.price)}`); // was «недоступно», no button
  await page.locator('#tariff-buy').click();
  await expect(page.locator('#screen-checkout[data-active]')).toBeVisible();
  await expect(page.locator('#checkout-summary')).toContainText(`· ${FIXED.validity_days} дней`);
  await expect(page.locator('#checkout-pay')).toHaveText(`Оплатить ${rub(FIXED.price)}`);
});

test('a per-day card prints a TOTAL for a term, never a rate per day', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS });
  await toCountry(page, 'IT');
  const p = ROWS.find((r) => r.daily_term_mode === 'PER_DAY');
  const first = p.term_prices[0]; const last = p.term_prices[p.term_prices.length - 1];
  const card = page.locator(`#country-list .card--daily[data-package-id="${p.package_id}"]`);
  await expect(card.locator('.card__price')).toHaveText(`от ${rub(first.price)}`);
  await expect(card.locator('.tariff__per')).toHaveText(`за ${first.days} дня`);
  await expect(card.locator('.tariff__term')).toHaveText(`${first.days}–${last.days} дней`);
});

test('a regional card names its region and counts as the website does (Ukraine is not counted)', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS });
  await toCountry(page, 'IT');
  const eu = ROWS.find((r) => /^Europe \(35 areas\)/.test(r.name));
  expect(eu.coverage_country_codes).toContain('UA');
  const card = page.locator(`#country-list .plan-regional[data-package-id="${eu.package_id}"]`);
  await expect(card.locator('.tariff__kind')).toHaveText('Европа');                       // the region, not «Региональный тариф»
  await expect(card.locator('.tariff__line--cov')).toHaveText('34 страны');               // was «Регион · 35 стран»
  await card.click();
  await expect(page.locator('.tariff-head__kind')).toHaveText('Региональный тариф · Европа, 34 страны');
  await expect(page.locator('#tariff-body')).not.toContainText('Украина');
});

test('a small unnamed region lists its countries instead of a bare count', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS });
  await toCountry(page, 'TH');
  const card = page.locator('#country-list .plan-regional').first();
  const line = await card.locator('.tariff__line--cov').textContent();
  for (const name of ['Сингапур', 'Малайзия', 'Таиланд']) expect(line).toContain(name);
  // Its own line, under the term — never run into it.
  const [term, cov] = await Promise.all(['.tariff__term', '.tariff__line--cov'].map((s) => card.locator(s).evaluate((n) => n.getBoundingClientRect())));
  expect(cov.top).toBeGreaterThanOrEqual(term.bottom - 1);
});

for (const lang of ['de', 'en', 'es']) {
  test(`[${lang}] at 320px no country name or tab label is cut with an ellipsis`, async ({ page }) => {
    // The whole committed catalogue, so the popular tiles include the United Arab Emirates — the longest name there.
    const snap = require('../../assets/catalog.json');
    await page.setViewportSize({ width: 320, height: 640 });
    await installMiniApp(page, { languageCode: lang, catalogue: { status: 'success', currency: 'RUB', data: snap.packages, assortment: snap.assortment } });
    await openApp(page);
    const cut = (root) => page.$$eval(`${root} *`, (ns) => ns
      .filter((n) => n.clientWidth > 0 && n.scrollWidth > n.clientWidth + 1).map((n) => `${n.className} «${n.textContent.trim()}»`));
    await expect(page.locator('#home-countries .tile').first()).toBeVisible();
    expect(await cut('#home-countries')).toEqual([]);
    await noSideways(page);
    // The selected tab is bolder, and «Meine eSIMs» was cut in exactly that state.
    await page.locator('#nav-esims').click();
    await expect(page.locator('#nav-esims')).toHaveAttribute('aria-selected', 'true');
    expect(await cut('.tabbar')).toEqual([]);
  });
}

test('the checkout\'s e-mail field lines up with the column, and the promo chevron sits at the right edge', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS });
  await toCountry(page, 'IT');
  await page.locator('#country-list .plan-local').first().click();
  await page.locator('#tariff-buy').click();
  await expect(page.locator('#screen-checkout[data-active]')).toBeVisible();
  const m = await page.evaluate(() => {
    const input = document.querySelector('#checkout-email');
    const pay = document.querySelector('#checkout-pay').getBoundingClientRect();
    const toggle = document.querySelector('.promo__toggle');
    const chev = toggle && toggle.lastElementChild.getBoundingClientRect();
    return {
      dl: Math.round(input.getBoundingClientRect().left - pay.left), dr: Math.round(pay.right - input.getBoundingClientRect().right),
      pad: parseFloat(getComputedStyle(input).paddingLeft),
      chevGap: toggle ? Math.round(toggle.getBoundingClientRect().right - chev.right) : 0,
    };
  });
  expect(m.dl).toBe(0); expect(m.dr).toBe(0);           // was 16 / 16
  expect(m.pad).toBeLessThanOrEqual(16);                // was 42, for a search icon this field does not have
  expect(m.chevGap).toBeLessThanOrEqual(24);            // the card's own padding, not «Ввести промокод›»
});

test('Telegram paints its background, header and bottom bar with the page colour, not the card colour', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS, colorScheme: 'dark' });
  await page.addInitScript(() => {
    const w = window.Telegram.WebApp; window.__painted = [];
    w.version = '7.10'; w.isVersionAtLeast = (v) => parseFloat(v) <= 7.10;
    for (const k of ['setBackgroundColor', 'setHeaderColor', 'setBottomBarColor']) w[k] = (c) => window.__painted.push([k, c]);
  });
  await openApp(page);
  const painted = await page.evaluate(() => window.__painted);
  const page_ = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(page_).toBe('rgb(35, 46, 60)');                // secondary_bg_color #232E3C
  expect(painted).toEqual([['setBackgroundColor', '#232E3C'], ['setHeaderColor', '#232E3C'], ['setBottomBarColor', '#232E3C']]);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true });
  test('the tab bar steps aside while the keyboard is up, and comes back after', async ({ page }) => {
    await installMiniApp(page, { packages: ROWS });
    await toCountry(page, 'IT');
    await page.locator('#country-list .plan-local').first().click();
    await page.locator('#tariff-buy').click();
    await page.locator('#checkout-email').focus();
    await expect(page.locator('.tabbar')).toBeHidden();
    await page.locator('#checkout-email').blur();
    await expect(page.locator('.tabbar')).toBeVisible();
  });
});

/*
 * The three block headings and the region on a regional card, in every language (2026-10-25). The regional block sat
 * under «Также подойдут» — a heading that did not say the plans below it cover a whole region. The headings are the
 * website's three blocks; the daily one is the shared module's own title (assets/daily-plan-copy.js), as on the website.
 */
const HEADINGS = {
  ru: ['Локальные тарифы', 'Региональные тарифы', 'Трафик на каждый день'],
  en: ['Local plans', 'Regional plans', 'Data every day'],
  es: ['Planes locales', 'Planes regionales', 'Datos cada día'],
  de: ['Ländertarife', 'Regionale Tarife', 'Daten für jeden Tag'],
  fr: ['Forfaits locaux', 'Forfaits régionaux', 'Des données chaque jour'],
  'zh-Hans': ['单国套餐', '区域套餐', '每日流量'],
  ko: ['국가 요금제', '지역 요금제', '매일 데이터'],
};
const EUROPE = { ru: 'Европа', en: 'Europe', es: 'Europa', de: 'Europa', fr: 'Europe', 'zh-Hans': '欧洲', ko: '유럽' };
const ITALY = { ru: 'Италия', en: 'Italy', es: 'Italia', de: 'Italien', fr: 'Italie', 'zh-Hans': '意大利', ko: '이탈리아' };

for (const lang of Object.keys(HEADINGS)) {
  test(`[${lang}] the three blocks carry the website's headings, and a regional card names its region`, async ({ page }) => {
    await installMiniApp(page, { languageCode: lang === 'zh-Hans' ? 'zh-hans' : lang, packages: ROWS });
    await openApp(page);
    await page.fill('#search', ITALY[lang]);
    await page.locator('#home-countries .card--row, #home-countries .tile', { hasText: ITALY[lang] }).first().click();
    await expect(page.locator('#screen-country[data-active]')).toBeVisible();
    await expect(page.locator('#country-list h2.section')).toHaveText(HEADINGS[lang]);
    await expect(page.locator('#country-list')).not.toContainText(/Также подойдут|These also work/);
    const eu = ROWS.find((r) => /^Europe \(35 areas\)/.test(r.name));
    const card = page.locator(`#country-list .plan-regional[data-package-id="${eu.package_id}"]`);
    await expect(card.locator('.tariff__kind')).toHaveText(EUROPE[lang]);
    await expect(card.locator('.tariff__line--cov')).toContainText('34');                  // the count stays
    await expect(card.locator('.tariff__more')).toBeVisible();                              // and «Покрытие и условия»
  });
}

test('a region without a name keeps the kind word and lists its few countries', async ({ page }) => {
  await installMiniApp(page, { packages: ROWS });
  await toCountry(page, 'TH');
  const card = page.locator('#country-list .plan-regional').first();
  await expect(card.locator('.tariff__kind')).toHaveText('Региональный тариф');
  await expect(card.locator('.tariff__line--cov')).toContainText('Малайзия');
});
