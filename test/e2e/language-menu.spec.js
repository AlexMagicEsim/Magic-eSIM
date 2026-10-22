'use strict';

/*
 * The language switch as a list (I18N ES-0, published with ES-1): what a reader meets on every prefixed page now that
 * Russian, English and Spanish are live. This runs on the real Spanish pages (/es/guides/ and a guide), served by the
 * test server like every other page; nothing is mocked but the outside world.
 *
 * Desktop (1366): the native <details> opens by click and by keyboard, lists every language by its own name with the
 * current one marked, each link goes to THE SAME PAGE in that language (and that page loads), it drops in with the
 * Expressive entrance and not at all under reduced motion; axe clean while open. Phones (390/320, the projects): the
 * desktop list is hidden and the phone menu lists the other languages; nothing overflows the width.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const GUIDE = '/es/guides/iphone/';

async function open(page, at = '/es/guides/') {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  await page.goto(at);
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1366, height: 860 } });

  test('the list opens, names every language, marks this one and links each to the same page', async ({ page }) => {
    await open(page);
    const menu = page.locator('.hdr-actions details.langmenu');
    await expect(menu.locator('summary')).toBeVisible();
    await expect(menu.locator('summary')).toContainText('Español');
    await expect(menu.locator('.langmenu-list')).toBeHidden();
    await menu.locator('summary').click();
    const items = menu.locator('.langmenu-list li');
    await expect(items).toHaveText(['Русский', 'English', 'Español', 'Deutsch', 'Français', '简体中文']);
    await expect(menu.locator('[aria-current="true"]')).toHaveText('Español');
    await expect(menu.locator('a')).toHaveCount(5);
    expect(await menu.locator('a').evaluateAll((as) => as.map((a) => [a.getAttribute('href'), a.lang, a.hreflang])))
      .toEqual([['/esim/', 'ru', 'ru'], ['/en/guides/', 'en', 'en'], ['/de/guides/', 'de', 'de'], ['/fr/guides/', 'fr', 'fr'], ['/zh/guides/', 'zh-Hans', 'zh-Hans']]);
    // the English twin is a real page, and the link takes the reader there
    await menu.locator('a[lang="en"]').click();
    await expect(page).toHaveURL(/\/en\/guides\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('a guide links to the same guide in every language', async ({ page }) => {
    const slug = GUIDE;
    await open(page, slug);
    await page.locator('.hdr-actions details.langmenu summary').click();
    const hrefs = await page.locator('.langmenu-list a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs[1]).toBe(slug.replace('/es/', '/en/'));
    for (const h of hrefs) expect((await page.request.get(h)).status(), h).toBe(200);
  });

  test('closed, it is the same pill as the one link it replaced: no card border, 40 px, level with «Find a plan»', async ({ page }) => {
    // ES-1 found it wearing the shared FAQ `details` card style (border, padding, margin): 42 px and 4 px lower.
    await open(page);
    const g = await page.evaluate(() => {
      const d = document.querySelector('.hdr-actions details.langmenu');
      const s = d.querySelector('summary').getBoundingClientRect();
      const cta = document.querySelector('.hdr-cta').getBoundingClientRect();
      const cs = getComputedStyle(d);
      return { top: Math.round(s.top), h: Math.round(s.height), ctaTop: Math.round(cta.top), ctaH: Math.round(cta.height),
        border: cs.borderTopWidth, margin: cs.marginTop, bg: cs.backgroundColor, outer: Math.round(d.getBoundingClientRect().height) };
    });
    expect(g.border).toBe('0px');
    expect(g.margin).toBe('0px');
    expect(g.bg).toBe('rgba(0, 0, 0, 0)');
    expect(g.h).toBe(40);
    expect(g.outer).toBe(40);
    expect(g.top).toBe(g.ctaTop);
  });

  test('keyboard: Enter opens it, Tab walks its links', async ({ page }) => {
    await open(page);
    const summary = page.locator('.hdr-actions details.langmenu summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.langmenu-list')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.locator('.langmenu-list a').first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('.langmenu-list a').nth(1)).toBeFocused();
  });

  test('Expressive: the list drops in; under reduced motion it does not move', async ({ page }) => {
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('data-motion', /.+/);
    await page.locator('.langmenu summary').click();
    const names = await page.locator('.langmenu-list').evaluate((el) => el.getAnimations().map((a) => a.animationName));
    expect(names).toContain('m-drop');
  });

  test.describe('reduced motion', () => {
    test('no animation on the list', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page);
      await page.locator('.langmenu summary').click();
      await expect(page.locator('.langmenu-list')).toBeVisible();
      expect(await page.locator('.langmenu-list').evaluate((el) => el.getAnimations().map((a) => [a.constructor.name, a.animationName || a.transitionProperty, a.playState]))).toEqual([]);
    });
  });

  test.describe('axe', () => {
    test.use({ bypassCSP: true });   // only so axe can be injected
    test('clean with the list open', async ({ page }) => {
      await open(page);
      await page.locator('.langmenu summary').click();
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 6000 });
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
        .violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`));
      expect(v).toEqual([]);
    });
  });
});

test('phones: the desktop list is hidden, the menu lists the other languages, nothing overflows', async ({ page }) => {
  await open(page);
  await expect(page.locator('.hdr-actions details.langmenu')).toBeHidden();
  await page.locator('.mnav summary').click();
  const langs = page.locator('.mnav-panel a[hreflang]');
  await expect(langs).toHaveText(['Русский', 'English', 'Deutsch', 'Français', '简体中文']);
  expect(await langs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/esim/', '/en/guides/', '/de/guides/', '/fr/guides/', '/zh/guides/']);
  const box = await langs.first().boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
