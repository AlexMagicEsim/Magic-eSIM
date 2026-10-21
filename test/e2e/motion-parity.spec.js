'use strict';

/*
 * The English pages move like the Russian ones (owner, 2026-10-21). One copy of the «Expressive» rules (assets/site.css,
 * under [data-motion]); RU switches it on from the header's inline script, EN from assets/logo-once.js in <head> (its CSP
 * refuses inline script). assets/motion.js — reveal below the fold, the hero parallax, the jump bar's spy — loads on RU
 * everywhere and on EN only where it has something to do: the home and the country pages (never the guides or the hub).
 *
 * Pinned here, side by side: the switch, motion.js where it belongs, the same transitions on the same elements, card
 * entrances, the per-day term settle (EN's .days, RU's .daily-term), scroll reveal, hover lift and the nav underline
 * (desktop), the parallax and the jump-bar spy, no layout shift, and NOTHING under prefers-reduced-motion. The logo's own
 * once-per-visit start is pinned by en-logo specs and seo/test-logo-svg.mjs. Nothing real is touched.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const RU = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'catalog.json'), 'utf8')).packages;
const EN = require('../fixtures/en-plans-catalogue.json').packages;
const cors = { 'access-control-allow-origin': '*' };
const PAIRS = { home: ['/', '/en/'], country: ['/esim/turkey/', '/en/esim/thailand/'], hub: ['/esim/', '/en/esim/'], guide: ['/esim/compatibility/', '/en/guides/compatibility/'] };

async function open(page, url, { reduce = false } = {}) {
  if (reduce) await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    window.ym = function () {};
    window.__cls = 0; window.__anims = new Set();
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* no API */ }
    const grab = () => { for (const a of document.getAnimations()) if (a.animationName) window.__anims.add(a.animationName); if (performance.now() < 6000) requestAnimationFrame(grab); };
    requestAnimationFrame(grab);
  });
  // the LAST registered route wins: the refusal first, the catalogues after it
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => (route.request().method() !== 'GET' ? route.abort() : route.fulfill({ status: 204, body: '' })));
  await page.route(/\/api\/v1\/retail\/packages\?market=global$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', market: 'global', currency: 'USD', data: EN }) }));
  await page.route(/\/api\/v1\/retail\/packages(\?(?!market=global)|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'success', data: RU }) }));
  await page.goto(url);
}
const state = (page) => page.evaluate(() => ({
  motion: document.documentElement.getAttribute('data-motion'),
  motionJs: !!performance.getEntriesByType('resource').find((r) => /\/assets\/motion\.js/.test(r.name)),
  anims: [...window.__anims].sort(), cls: window.__cls, pre: document.querySelectorAll('.m-pre').length,
  // per kind of block, for the blocks both homes have (the RU home also has a .dest-card list the EN home does not)
  preBy: Object.fromEntries(['.dest-tile', '.guide-card', '.step'].map((c) => [c, document.querySelectorAll(c + '.m-pre').length])),
}));
const transitions = (page, sels) => page.evaluate((sels) => Object.fromEntries(sels.map((s) => {
  const e = document.querySelector(s); if (!e) return [s, null]; const c = getComputedStyle(e);
  return [s, `${c.transitionProperty}|${c.transitionDuration}`];
})), sels);

for (const [kind, [ru, en]] of Object.entries(PAIRS)) {
  test(`${kind}: EN switches the same motion on as RU; motion.js only where it has something to do`, async ({ page }) => {
    await open(page, ru); await page.waitForTimeout(1500);
    const r = await state(page);
    await open(page, en); await page.waitForTimeout(1500);
    const e = await state(page);
    expect(r.motion).toBe('expressive');
    expect(e.motion).toBe('expressive');
    expect(r.motionJs).toBe(true);
    expect(e.motionJs).toBe(kind === 'home' || kind === 'country');
    // The destinations hub has a shift of its own that predates this (the .hub-body moves once its script lays out the
    // A–Z list: 0.048 at 320, identical on main — reported 2026-10-21, a separate fix); the motion adds none anywhere.
    if (kind !== 'hub') expect(e.cls).toBeLessThan(0.02);
  });
}

test('the same elements carry the same transitions on RU and EN', async ({ page }) => {
  const sels = ['.btn', '.nav a', '.dest-tile', '.guide-card', '.step', '.langsw svg', '.plan', '.cp-jump a'];
  await open(page, '/'); const rh = await transitions(page, sels);
  await open(page, '/en/'); const eh = await transitions(page, sels);
  await open(page, '/esim/turkey/'); await expect(page.locator('#localGrid .plan').first()).toBeVisible(); const rc = await transitions(page, sels);
  await open(page, '/en/esim/thailand/'); await expect(page.locator('#localGrid .plan').first()).toBeVisible(); const ec = await transitions(page, sels);
  for (const s of ['.btn', '.nav a', '.dest-tile', '.guide-card', '.step', '.langsw svg']) { expect(rh[s], `home ${s}`).not.toBeNull(); expect(eh[s], `home ${s}`).toBe(rh[s]); }
  for (const s of ['.plan', '.cp-jump a', '.btn']) { expect(rc[s], `country ${s}`).not.toBeNull(); expect(ec[s], `country ${s}`).toBe(rc[s]); }
  expect(ec['.plan']).toMatch(/^transform/);   // Expressive's lift, not the base shadow-only transition
});

test('EN country page: the cards enter, the chosen day term settles, the jump bar follows the scroll', async ({ page }) => {
  await open(page, '/en/esim/thailand/');
  await expect(page.locator('#localGrid .plan').first()).toBeVisible();
  await page.waitForTimeout(800);
  const s = await state(page);
  expect(s.anims).toEqual(expect.arrayContaining(['m-in']));
  const daily = page.locator('#dailyGrid .plan').first();
  await daily.scrollIntoViewIfNeeded();
  await daily.locator('.days label').nth(1).click();
  expect(await daily.locator('.days input:checked + span').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('m-settle');
  // while a term is pressed, the invisible radio stays on top (the press scales the whole label, not the span over it)
  const third = daily.locator('.days label').nth(2);
  const box = await third.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.waitForTimeout(150);
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y).tagName, [box.x + box.width / 2, box.y + box.height / 2])).toBe('INPUT');
  await page.mouse.up();
  await page.evaluate(() => document.getElementById('dailyBlock').scrollIntoView({ block: 'center' }));
  await expect(page.locator('.cp-jump a[href="#dailyBlock"]')).toHaveClass(/m-active/);
});

test('EN home: the same blocks below the fold wait for the scroll as on RU, and reveal when reached', async ({ page }) => {
  await open(page, '/'); await page.waitForTimeout(800);
  const ru = await state(page);
  await open(page, '/en/'); await page.waitForTimeout(800);
  const en = await state(page);
  expect(ru.pre).toBeGreaterThan(0);
  expect(en.pre).toBeGreaterThan(0);
  expect(en.preBy).toEqual(ru.preBy);
  // scroll the page the way a person does; every waiting block is revealed on the way (a jump straight to the last one
  // would leave the ones it skipped waiting — correctly: they were never on screen)
  await page.evaluate(async () => { for (let y = 0; y <= document.body.scrollHeight; y += 200) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.m-pre').length), { timeout: 3000 }).toBe(0);
});

test.describe('desktop', () => {
  test.use({ viewport: { width: 1366, height: 900 } });
  test('hover lifts a plan card and a button and draws the nav underline — the same on RU and EN; the hero parallax is on', async ({ page }) => {
    const measure = async (url, card) => {
      await open(page, url);
      if (card) await expect(page.locator(card).first()).toBeVisible();
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });
      const out = {};
      for (const s of [card, '.btn.hdr-cta'].filter(Boolean)) {
        const el = page.locator(s).first(); await el.scrollIntoViewIfNeeded(); await el.hover(); await page.waitForTimeout(500);
        out[s] = await el.evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m42);
        await page.mouse.move(1, 1); await page.waitForTimeout(400);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      const nav = page.locator('.nav a').first(); await nav.hover(); await page.waitForTimeout(500);
      out.nav = await nav.evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e, '::after').transform).a);
      return out;
    };
    const ru = await measure('/esim/turkey/', '#localGrid .plan');
    const en = await measure('/en/esim/thailand/', '#localGrid .plan');
    expect(ru['#localGrid .plan']).toBe(-5);
    expect(en).toEqual(ru);
    await open(page, '/en/'); await page.waitForTimeout(800);
    await expect(page.locator('.hero-art')).toHaveClass(/m-par/);
  });
});

for (const url of ['/', '/en/', '/en/esim/thailand/']) {
  test(`prefers-reduced-motion: ${url} runs no animation and hides nothing`, async ({ page }) => {
    await open(page, url, { reduce: true });
    await page.waitForTimeout(1500);
    const s = await state(page);
    expect(s.anims).toEqual([]);
    expect(s.pre).toBe(0);
  });
}
