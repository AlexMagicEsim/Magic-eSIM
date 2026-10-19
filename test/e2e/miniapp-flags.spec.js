'use strict';

/*
 * The Mini App draws flags from the storefront's files, not as system emoji.
 *
 * An emoji flag is the operating system's drawing: Apple's on iOS and macOS,
 * Google's on Android, and on Windows none at all — Telegram Desktop prints the
 * two letters «CN». Every place the app showed a flag (destination rows, the
 * tariff header, the order summary, the eSIM cards, a regional pack's coverage
 * chips) now shows `../assets/flags/<code>.svg`; a code with no file keeps its
 * emoji and a wide region its globe, so nothing degrades to a broken image.
 * Runs in Chromium at 390/320 and in WebKit (the `webkit-flags` project).
 */

const { test, expect } = require('@playwright/test');
const { installMiniApp, openApp, overflowingInside } = require('./harness.js');

const base = { networks: [{ operator: 'Op', type: '4G' }], activation_policy: 'first_data_usage', topup_available: false,
  plan_type: 'FIXED_VOLUME', network_technologies: ['4G'], speed: '4G', hotspot_supported: false, sellable_days: [] };
const pack = (id, code, coverage, flags, name, gb, price) => Object.assign({}, base, {
  package_id: id, name, country_code: code, region: code, coverage_country_codes: coverage, coverage_flags: flags,
  data_gb: gb, validity_days: 30, price,
});
const PACKAGES = [
  pack('th1', 'TH', ['TH'], '🇹🇭', 'Thailand 5GB 30Days', 5, 450),
  pack('cn1', 'CN', ['CN'], '🇨🇳', 'China 5GB 30Days', 5, 550),
  pack('nz1', 'NZ', ['NZ'], '🇳🇿', 'New Zealand 5GB 30Days', 5, 650),
  pack('aq1', 'AQ', ['AQ'], '🇦🇶', 'Antarctica 1GB 7Days', 1, 900),
  pack('thvn', 'TH', ['TH', 'VN'], '🇹🇭🇻🇳', 'Thailand & Vietnam 10GB 30Days', 10, 990),
  pack('asia', 'SG', ['SG', 'MY', 'TH', 'VN', 'ID', 'PH'], '🇸🇬🇲🇾🇹🇭🇻🇳🇮🇩🇵🇭', 'Asia 6 countries 10GB 30Days', 10, 1500),
];

const RI = /[\u{1F1E6}-\u{1F1FF}]/u;

async function flagReport(page, scope) {
  return page.evaluate(({ scope, ri }) => {
    const re = new RegExp(ri, 'u');
    return [...document.querySelectorAll(`${scope} .card__flag, ${scope} .chip__flag`)].filter((n) => n.offsetParent).map((n) => ({
      imgs: [...n.querySelectorAll('img')].map((i) => ({ src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0,
        w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height) })),
      text: n.textContent.trim(),
      emoji: re.test(n.textContent),
    }));
  }, { scope, ri: RI.source });
}

async function loaded(page) {
  await page.waitForFunction(() => [...document.querySelectorAll('.card__flag img, .chip__flag img')]
    .filter((i) => i.offsetParent).every((i) => i.complete));
}

test('destination rows draw image flags; a code with no file keeps its emoji, a wide region its globe', async ({ page }) => {
  await installMiniApp(page, { languageCode: 'ru', packages: PACKAGES });
  await openApp(page);
  await page.locator('#screen-home button', { hasText: 'Все страны и регионы' }).click();
  await expect(page.locator('#screen-home .card--row').first()).toBeVisible();
  await loaded(page);
  const rows = await flagReport(page, '#screen-home');
  expect(rows.length).toBeGreaterThanOrEqual(5);
  const srcs = rows.flatMap((r) => r.imgs.map((i) => i.src));
  for (const c of ['th', 'cn', 'nz']) expect(srcs).toContain(`../assets/flags/${c}.svg`);
  for (const r of rows) for (const i of r.imgs) expect(i.ok, `${i.src} loads`).toBe(true);
  // Only the code with no file (AQ) may still be an emoji.
  expect(rows.filter((r) => r.emoji).map((r) => r.text)).toEqual(['🇦🇶']);
  expect(rows.some((r) => r.text === '🌍')).toBe(true);
  // A two-country pack shows both flags in one box.
  expect(rows.some((r) => r.imgs.map((i) => i.src).join() === '../assets/flags/th.svg,../assets/flags/vn.svg')).toBe(true);
  expect(await overflowingInside(page, '#screen-home')).toEqual([]);
});

test('search, the tariff header and a regional pack\'s coverage chips draw image flags', async ({ page }) => {
  await installMiniApp(page, { languageCode: 'en', packages: PACKAGES });
  await openApp(page);
  await page.locator('#search').fill('China');
  const row = page.locator('#screen-home .card--row', { hasText: 'China' }).first();
  await expect(row.locator('.card__flag img')).toHaveAttribute('src', '../assets/flags/cn.svg');
  await page.locator('#search').fill('Thailand');
  await page.locator('#screen-home .card--row').first().click();
  await page.locator('#screen-country[data-active]').waitFor();
  // «These also work»: the two-country pack, its pair of flags.
  const pair = page.locator('#screen-country .card--row', { hasText: '2' }).first();
  await expect(pair.locator('.card__flag img')).toHaveCount(2);
  await pair.click();
  await page.locator('#country-list .card--tariff').first().click();
  await page.locator('#screen-tariff[data-active]').waitFor();
  const cover = page.locator('#screen-tariff details.sheet').first();
  if (await cover.count()) await cover.locator('summary').click();
  await loaded(page);
  const tariff = await flagReport(page, '#screen-tariff');
  expect(tariff.length).toBeGreaterThan(1);
  expect(tariff.filter((r) => r.emoji)).toEqual([]);
  const srcs = tariff.flatMap((r) => r.imgs.map((i) => i.src));
  for (const c of ['th', 'vn']) expect(srcs).toContain(`../assets/flags/${c}.svg`);
  for (const r of tariff) for (const i of r.imgs) expect(i.ok, `${i.src} loads`).toBe(true);
  expect(await overflowingInside(page, '#screen-tariff')).toEqual([]);
});
