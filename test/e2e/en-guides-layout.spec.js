'use strict';

/*
 * The English guides and their list after the 2026-10 redesign, at 390 and
 * 320 (the projects) and at 1366 (set per test). What they must do:
 *   * show the payment bar under the header, then the hero;
 *   * «On this page»: beside the article on desktop (sticky), above it on a
 *     phone; every link lands on its heading, not under the header;
 *   * numbered steps, readable notes, questions that open by keyboard;
 *   * related guides as cards and one «Choose a destination» button;
 *   * no script, no request off the site, no overflow, axe clean.
 */

const { test, expect } = require('@playwright/test');
const fs = require('fs');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const GUIDES = ['iphone', 'android', 'compatibility', 'activation', 'troubleshooting'];

async function open(page, path) {
  const st = { off: [], csp: [], errors: [] };
  page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1') && !r.url().startsWith('http://localhost')) st.off.push(r.url()); });
  page.on('console', (m) => {
    if (/Content Security Policy/i.test(m.text())) st.csp.push(m.text());
    if (m.type() === 'error') st.errors.push(m.text());
  });
  await page.goto(path);
  return st;
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('every guide and the list: payment bar, hero, no script, nothing off the site, no overflow', async ({ page }) => {
  for (const w of [null, 1366]) {
    if (w) await page.setViewportSize({ width: w, height: 900 });
    for (const path of [...GUIDES.map((g) => `/en/guides/${g}/`), '/en/guides/']) {
      const st = await open(page, path);
      const bar = await page.locator('#previewNotice').boundingBox();
      const h1 = await page.locator('h1').boundingBox();
      expect(bar.y + bar.height, path).toBeLessThanOrEqual(h1.y);
      await expect(page.locator('#previewNotice summary')).toContainText("Online payment isn't available yet");
      expect(await page.locator('script').count(), path).toBe(0);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
      expect(await noOverflow(page), path).toBe(true);
      expect(st.off, path).toEqual([]);
      expect(st.csp, path).toEqual([]);
      expect(st.errors, path).toEqual([]);
    }
  }
});

test('«On this page»: above the article on a phone, sticky beside it on desktop; a link lands on its heading', async ({ page }) => {
  await open(page, '/en/guides/iphone/');
  const toc = page.locator('nav.g-toc');
  const art = page.locator('article.g-article');
  let t = await toc.boundingBox(); let a = await art.boundingBox();
  expect(t.y + t.height).toBeLessThanOrEqual(a.y);
  await toc.locator('a[href="#at-your-destination-turn-on-data"]').click();
  await expect(page).toHaveURL(/#at-your-destination-turn-on-data$/);
  const header = await page.locator('header.site-header').boundingBox();
  let hd = await page.locator('#at-your-destination-turn-on-data-h').boundingBox();
  expect(hd.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(hd.y).toBeLessThan(page.viewportSize().height / 2);

  await page.setViewportSize({ width: 1366, height: 900 });
  await open(page, '/en/guides/iphone/');
  t = await toc.boundingBox(); a = await art.boundingBox();
  expect(t.x).toBeGreaterThan(a.x + a.width);
  await toc.locator('a[href="#faq"]').click();
  hd = await page.locator('#faq-h').boundingBox();
  expect(hd.y).toBeGreaterThanOrEqual(68);
  t = await toc.boundingBox();
  expect(t.y).toBeGreaterThanOrEqual(0);
  expect(t.y).toBeLessThan(140);
});

test('steps are numbered badges, a note keeps its words on one flow, questions open by keyboard', async ({ page }) => {
  await open(page, '/en/guides/iphone/');
  const step = page.locator('#option-1-scan-the-qr-code .steps li').first();
  const badge = await step.evaluate((li) => { const s = getComputedStyle(li, '::before'); return [s.content, s.width]; });
  expect(badge).toEqual(['counter(step)', '28px']);
  // «Add eSIM» is a <strong> inside the note: it must sit in the text, not in a column of its own.
  const note = page.locator('#option-1-scan-the-qr-code p.note');
  const [n, s] = [await note.boundingBox(), await note.locator('strong').boundingBox()];
  expect(s.x + s.width).toBeLessThan(n.x + n.width - 20);
  expect(await note.evaluate((p) => getComputedStyle(p).display)).toBe('block');
  const sum = page.locator('#faq summary').first();
  await sum.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#faq details').first()).toHaveAttribute('open', '');
  await expect(page.locator('#faq details').first().locator('p.note')).toBeVisible();
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  expect(outline).not.toBe('none');
});

test('related guides are cards to real guides, then one button to the destinations', async ({ page, request }) => {
  await open(page, '/en/guides/activation/');
  const hrefs = await page.locator('.g-related .g-card').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(hrefs.length).toBe(4);
  for (const h of hrefs) expect((await request.get(h)).status(), h).toBe(200);
  await expect(page.locator('.g-related .btn')).toHaveAttribute('href', '/en/esim/');
  await expect(page.locator('.g-related .btn')).toHaveText('Choose a destination');
});

test('the list: five cards, each opens its guide', async ({ page }) => {
  await open(page, '/en/guides/');
  const cards = page.locator('.g-cards-hub .g-card');
  await expect(cards).toHaveCount(5);
  await cards.nth(4).click();
  await expect(page).toHaveURL(/\/en\/guides\/troubleshooting\/$/);
  await expect(page.locator('h1')).toHaveText('eSIM not working — what to check');
});

test.describe('axe on the guides', () => {
  test.use({ bypassCSP: true });   // only so axe can be injected; the pages are unchanged
  test('every guide with a question open, and the list, at the project width and 1366', async ({ page }) => {
    for (const w of [null, 1366]) {
      if (w) await page.setViewportSize({ width: w, height: 900 });
      for (const path of [...GUIDES.map((g) => `/en/guides/${g}/`), '/en/guides/']) {
        await page.goto(path);
        if (await page.locator('#faq summary').count()) await page.locator('#faq summary').first().click();
        await page.addScriptTag({ content: AXE });
        const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }))
          .violations.map((x) => `${x.id} ×${x.nodes.length}`));
        expect(v, `${path} @${w || 'project'}`).toEqual([]);
      }
    }
  });
});
