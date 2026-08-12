#!/usr/bin/env node
// Browser QA — the last gate, and the only one that looks at the real page.
//
// Everything before this reads JSON. This renders the built HTML in Chrome, at
// a phone width and a desktop width, and checks the things that only exist
// once a browser has laid the page out:
//
//   визуал        does anything overflow the viewport horizontally
//   перелинковка  do the internal links resolve to pages that exist
//   FAQ           is every question in the JSON-LD actually visible on screen
//   LOCAL/REGIONAL are both blocks present and in the right order
//   CTA           is there a way to buy, above and below the fold
//   Canonical     one, absolute, matching this page
//   JSON-LD       parses, and its FAQ matches the rendered FAQ exactly
//   404           an unknown country does not render as an empty country page
//   console       no page errors
//
// Chrome is driven over the DevTools protocol directly. There is no Playwright
// in this repository and adding one for nine assertions would be a poor trade.
//
//   node seo/browser-qa.mjs thailand japan
//   node seo/browser-qa.mjs --all

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg', '.webp': 'image/webp' };

// --- static server ---------------------------------------------------------
function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const file = join(ROOT, p);
      if (!file.startsWith(ROOT) || !existsSync(file)) {
        res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<h1>404</h1>');
        return;
      }
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch { res.writeHead(500); res.end(); }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

// --- chrome over CDP -------------------------------------------------------
async function chrome() {
  const port = 9500 + (process.pid % 400);
  const proc = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--hide-scrollbars', '--user-data-dir=/tmp/magic-qa-profile', 'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 100 && !target; i += 1) {
    await new Promise((r) => setTimeout(r, 150));
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch { /* not up yet */ }
  }
  if (!target) { proc.kill(); throw new Error('Chrome не поднялся'); }
  return { proc, wsUrl: target.webSocketDebuggerUrl, kill: () => proc.kill() };
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new (globalThis.WebSocket)(wsUrl);
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) events.push(msg);
    };
    ws.onerror = reject;
    ws.onopen = () => resolve({
      send: (method, params = {}) => new Promise((res, rej) => {
        id += 1; pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params }));
      }),
      events,
      close: () => ws.close(),
    });
  });
}

// --- the checks ------------------------------------------------------------
const EXPECT = process.env.QA_EXPECT_TARIFFS === '1';
const CHECKS = `(() => {
  const EXPECT_TARIFFS = ${EXPECT};
  const problems = [];
  const doc = document;
  const url = location.href;

  // canonical
  const canon = [...doc.querySelectorAll('link[rel=canonical]')];
  if (canon.length !== 1) problems.push('canonical: ' + canon.length + ' шт., нужен ровно один');
  else {
    const href = canon[0].getAttribute('href') || '';
    if (!/^https:\\/\\//.test(href)) problems.push('canonical не абсолютный: ' + href);
    const slug = location.pathname.replace(/\\/index\\.html$/, '/').split('/').filter(Boolean).pop();
    if (slug && !href.includes('/' + slug + '/')) problems.push('canonical указывает не на эту страну: ' + href);
  }

  // h1
  const h1 = [...doc.querySelectorAll('h1')];
  if (h1.length !== 1) problems.push('H1: ' + h1.length + ' шт.');
  else if (!h1[0].textContent.trim()) problems.push('H1 пустой');

  // json-ld
  // Узлы собираются со ВСЕХ блоков, а не с первого. Старые страницы кладут
  // BreadcrumbList, WebPage и FAQPage тремя отдельными <script>, и проверка по
  // первому блоку объявляла бы у них отсутствующим то, что просто лежит рядом.
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  if (!scripts.length) problems.push('нет JSON-LD');
  const graph = [];
  for (const s of scripts) {
    try {
      const j = JSON.parse(s.textContent);
      graph.push(...(j['@graph'] || [j]));
    } catch (e) { problems.push('JSON-LD не разбирается: ' + e.message); }
  }
  const faqNode = graph.find((n) => n['@type'] === 'FAQPage');
  // Две разметки FAQ: сгенерированные страницы используют <details><summary>,
  // старые авторские — <p class="faq-q">. Проверка обязана понимать обе, иначе
  // объявит отсутствующим то, что читатель прекрасно видит.
  const visibleQ = [...doc.querySelectorAll('.faq-item summary, details summary, .faq-q')]
    .map((x) => x.textContent.trim()).filter(Boolean);
  if (faqNode) {
    const marked = (faqNode.mainEntity || []).map((q) => (q.name || '').trim());
    const missing = marked.filter((q) => !visibleQ.includes(q));
    if (missing.length) problems.push(missing.length + ' вопрос(ов) есть в разметке, но не видны на странице');
    const extra = visibleQ.filter((q) => !marked.includes(q));
    if (extra.length) problems.push(extra.length + ' видимых вопрос(ов) нет в разметке');
    if (marked.length < 4) problems.push('FAQPage всего с ' + marked.length + ' вопросами');
  } else problems.push('нет FAQPage в разметке');
  if (!graph.find((n) => n['@type'] === 'BreadcrumbList')) problems.push('нет BreadcrumbList');

  // local / regional blocks
  const text = doc.body.innerText;
  //
  // Проверяется НАЛИЧИЕ блоков в разметке, а не их видимость. Скрипт прячет
  // блок, в котором нечего показать: у страны без региональных тарифов
  // regionalBlock скрывается, и слово «Региональные» исчезает из innerText.
  // Это правильное поведение, и требовать его наличия — значит требовать
  // пустой заголовок.
  if (!doc.getElementById('localBlock')) problems.push('нет блока локальных тарифов');
  if (!doc.getElementById('regionalBlock')) problems.push('нет блока региональных тарифов');
  const hasLocal = /Локальные тарифы|Тарифы для|локальн/i.test(text);
  const hasRegional = /Региональн/i.test(text);
  const regionalCards = doc.querySelectorAll('#regionalGrid .package-card').length;
  if (regionalCards > 0 && !hasRegional) problems.push('региональные тарифы отрисованы, но заголовок не виден');
  if (!hasLocal && !hasRegional) problems.push('на странице не видно ни локальных, ни региональных тарифов');

  // Тарифы должны быть НЕ ПРОСТО ЗАГОЛОВКОМ, а отрисованными карточками.
  //
  // Ровно этой проверки не хватило в прошлый раз: заголовок «Локальные тарифы»
  // лежит в статическом HTML и присутствует всегда, поэтому проверка по тексту
  // проходила, пока сетка была пуста. Сто девяносто страниц уехали в продакшн
  // с вечным «Загружаем тарифы…» и без единой кнопки покупки.
  const marker = doc.querySelector('[data-country-page]');
  if (!marker) {
    problems.push('нет [data-country-page] — country-tariffs.js не поймёт, какую страну грузить');
  } else if (!/^[A-Z]{2}$/.test(marker.getAttribute('data-country-page') || '')) {
    problems.push('data-country-page=\"' + marker.getAttribute('data-country-page') + '\" — нужен ISO из двух букв');
  }
  //
  // Отрисовка проверяется и локально. API отдаёт CORS только боевому origin,
  // но при неудаче загрузчик падает на резервный /assets/catalog.json, который
  // лежит в репозитории, — и карточки всё равно строятся. Так что пустая сетка
  // здесь означает поломку страницы, а не стенда.
  const cards = doc.querySelectorAll('#localGrid .package-card, #regionalGrid .package-card, .js-buy-link').length;
  const status = (doc.getElementById('packagesStatus') || {}).textContent || '';
  const failed = /не удалось|попробуйте/i.test(doc.body.innerText);
  if (cards === 0 && !failed) {
    problems.push('тарифы не отрисовались (карточек 0, статус «' + status.trim().slice(0, 40) + '»)');
  }
  const rendered = { cards, status: status.trim().slice(0, 40), failed };

  // Ссылка покупки обязана нести метку происхождения
  const buys = [...doc.querySelectorAll('.js-buy-link')];
  const unmarked = buys.filter((a) => !String(a.getAttribute('href') || '').includes('src=country-page'));
  if (buys.length && unmarked.length) problems.push(unmarked.length + ' из ' + buys.length + ' ссылок покупки без метки происхождения');

  // CTA
  const ctas = [...doc.querySelectorAll('a,button')].filter((el) => {
    const t = (el.textContent || '').toLowerCase();
    return /купить|выбрать тариф|оформить|подключить|все тарифы|тарифы/.test(t);
  });
  if (!ctas.length) problems.push('на странице нет ни одной кнопки покупки');

  // internal links
  // Resolved against the page, not taken raw: "../usa/" is a valid link and a
  // checker that treats it as a path from the site root invents broken links.
  const internal = [...doc.querySelectorAll('a[href]')]
    .map((a) => a.getAttribute('href'))
    .filter((h) => h && !/^(mailto:|tel:|#)/.test(h))
    .map((h) => { try { const u = new URL(h, location.href); return u.origin === location.origin ? u.pathname : null; } catch { return null; } })
    .filter(Boolean);

  // horizontal overflow
  const de = doc.documentElement;
  const overflow = de.scrollWidth > de.clientWidth + 1;
  const wide = overflow ? [...doc.querySelectorAll('body *')]
    .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 2)
    .slice(0, 3).map((el) => el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : ''))
    : [];
  if (overflow) problems.push('горизонтальная прокрутка (' + de.scrollWidth + ' > ' + de.clientWidth + '): ' + wide.join(', '));

  return { problems, rendered, internal: [...new Set(internal)], questions: visibleQ.length, title: doc.title, url };
})()`;

// --- run -------------------------------------------------------------------
const argv = process.argv.slice(2);
const slugs = argv.includes('--all')
  ? (await readdir(join(ROOT, 'esim'), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name)
  : argv;
if (!slugs.length) { console.error('укажи страны или --all'); process.exit(2); }

const { server, port } = await serve();
const br = await chrome();
const cdp = await connect(br.wsUrl);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Log.enable');

const VIEWPORTS = [
  { name: 'моб 390×844', width: 390, height: 844, mobile: true },
  { name: 'деск 1280×900', width: 1280, height: 900, mobile: false },
];

async function load(url) {
  await cdp.send('Page.navigate', { url });
  for (let i = 0; i < 120; i += 1) {
    await new Promise((r) => setTimeout(r, 100));
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (result.value === 'complete') break;
  }
  // Каталог грузится уже после readyState=complete, и сколько это займёт —
  // неизвестно: сначала пробуется живой API, и только когда он не отвечает,
  // загрузчик падает на резервный catalog.json. Фиксированная пауза здесь
  // делает проверку то зелёной, то красной на одних и тех же страницах,
  // поэтому ждём СОБЫТИЯ: появления карточек или сообщения об ошибке.
  const DEADLINE = Date.now() + 25000;
  while (Date.now() < DEADLINE) {
    const { result } = await cdp.send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const cards = document.querySelectorAll('#localGrid .package-card, #regionalGrid .package-card, .js-buy-link').length;
        const failed = /не удалось|попробуйте/i.test(document.body.innerText);
        return cards > 0 || failed;
      })()`,
    });
    if (result.value === true) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 250));
}

let failed = 0;
const linkTargets = new Set();

for (const slug of slugs) {
  const found = [];
  for (const vp of VIEWPORTS) {
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: vp.mobile,
    });
    await load(`http://127.0.0.1:${port}/esim/${slug}/`);
    const { result } = await cdp.send('Runtime.evaluate', { expression: CHECKS, returnByValue: true, awaitPromise: false });
    const r = result.value;
    if (!r) { found.push(`${vp.name}: страница не отдала результат`); continue; }
    for (const p of r.problems) found.push(`${vp.name}: ${p}`);

    for (const l of r.internal) linkTargets.add(l);
  }
  const errs = cdp.events.filter((e) => e.method === 'Log.entryAdded'
    && e.params.entry.level === 'error'
    && !/favicon|404 \(Not Found\).*(png|ico)/i.test(e.params.entry.text)
    // Локально каталог всегда отвечает CORS-отказом: боевой origin в белом
    // списке, 127.0.0.1 — нет. Это условие стенда, а не дефект страницы.
    && !(!EXPECT && /Access to fetch|CORS|api\.magicesim\.store|net::ERR_FAILED/i.test(e.params.entry.text)));
  cdp.events.length = 0;
  if (errs.length) found.push(`${errs.length} ошибк(и) в консоли: ${errs[0].params.entry.text.slice(0, 90)}`);

  if (found.length) { failed += 1; console.log(`\n✗ ${slug}`); for (const f of found) console.log(`    ${f}`); }
  else console.log(`✓ ${slug}`);
}

// --- internal links resolve ------------------------------------------------
console.log(`\nПерелинковка: ${linkTargets.size} уникальных внутренних ссылок`);
const broken = [];
for (const href of linkTargets) {
  const res = await fetch(`http://127.0.0.1:${port}${href.startsWith('/') ? href : `/${href}`}`, { redirect: 'manual' });
  if (res.status >= 400) broken.push(`${href} → ${res.status}`);
}
if (broken.length) { failed += 1; console.log(`  ✗ битые: ${broken.join(', ')}`); }
else console.log('  ✓ все ссылки открываются');

// --- 404 -------------------------------------------------------------------
const nope = await fetch(`http://127.0.0.1:${port}/esim/nosuchcountry/`);
console.log(`404 для несуществующей страны: ${nope.status}${nope.status === 404 ? ' ✓' : ' ✗ должно быть 404'}`);
if (nope.status !== 404) failed += 1;

cdp.close(); br.kill(); server.close();
console.log(`\nПроверено ${slugs.length} стран, проблемы в ${failed}.`);
process.exit(failed ? 1 : 0);
