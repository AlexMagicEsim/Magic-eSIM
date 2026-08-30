#!/usr/bin/env node
// Версии CSS/JS в адресах.
//
// ЧТО ЭТО ЛОВИТ
//
//   GitHub Pages отдаёт HTML и ассеты с одинаковым `max-age=600` и настроить
//   это нельзя. Раз кеши истекают независимо, после деплоя браузер до десяти
//   минут мог сочетать НОВУЮ разметку со СТАРЫМ стилем. Это случилось в проде
//   2026-08-28: страница просила `assets/country-pages.css` без версии,
//   получала прошлую копию из кеша, и дневные карточки выглядели сломанными.
//
//   Версия от содержимого делает пару HTML↔ассет неразделимой: новый HTML
//   просит адрес, которого в кеше нет; старый HTML просит старый адрес и
//   получает файл, под который он собран. Смешанного состояния не остаётся.
//
// Run: node --test seo/test-asset-versioning.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampHtml, stampUrl, assetVersion, assetRefRe, hasAssetRef } from './asset-version.mjs';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.playwright-mcp', 'Magic-eSIM-github-2']);

function htmlFiles(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) htmlFiles(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}
const read = (f) => readFileSync(join(ROOT, f), 'utf8');

test('every page asks for the asset version it was built against', () => {
  // The whole point: this fails the moment an asset changes without the pages
  // being restamped — which is the state that shipped the mismatch.
  const stale = [];
  for (const file of htmlFiles()) {
    const src = readFileSync(file, 'utf8');
    if (stampHtml(src, dirname(file)) !== src) stale.push(relative(ROOT, file));
  }
  assert.deepEqual(stale.slice(0, 12), [],
    `${stale.length} pages reference a stale asset version — run: node seo/stamp-assets.mjs`);
});

test('no asset reference is left unversioned', () => {
  const bare = [];
  for (const file of htmlFiles()) {
    for (const m of readFileSync(file, 'utf8').matchAll(assetRefRe())) {
      const url = m[2];
      // A file we do not serve cannot be versioned: telegram-web-app.js is on
      // Telegram's origin, and a ref to something absent is a broken link, not
      // a caching problem.
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url) || url.startsWith('//')) continue;
      const path = url.split('?')[0];
      const local = path.startsWith('/') ? join(ROOT, path.slice(1)) : resolve(dirname(file), path);
      if (!existsSync(local)) continue;
      if (!/\?v=[0-9a-f]{8}\b/.test(url)) bare.push(`${relative(ROOT, file)} → ${url}`);
    }
  }
  assert.deepEqual(bare.slice(0, 12), [], 'these would be served from a stale cache after a deploy');
});

test('the Mini App is versioned too, not just assets/', () => {
  // It loads mini.css, core.js and ui.js from its own directory, and those were
  // left bare when only assets/ was covered — the same HTML↔CSS mismatch this
  // whole mechanism exists to prevent, on the surface that ships a Telegram
  // app.
  const html = readFileSync(join(ROOT, 'app/index.html'), 'utf8');
  // `locales.js` and `i18n.js` are named here rather than left to the generic
  // sweep above for the same reason the first three are: when a locale string
  // is edited the file's hash moves, and an unversioned tag would serve the old
  // dictionary against the new markup for up to ten minutes — the exact
  // HTML↔asset mismatch this mechanism exists to prevent, on the one pair of
  // files that will be edited most often from here on.
  for (const name of ['mini.css', 'locales.js', 'i18n.js', 'core.js', 'ui.js']) {
    assert.match(html, new RegExp(`(?:href|src)="${name.replace('.', '\\.')}\\?v=[0-9a-f]{8}"`),
      `app/index.html must version ${name}`);
  }
  // …and Telegram's own script must be left alone.
  assert.match(html, /src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"/);
});

test('the pages that hydrate tariffs are actually covered', () => {
  // A guard against the check above passing because it found nothing to check.
  const pages = htmlFiles().filter((f) => hasAssetRef(readFileSync(f, 'utf8')));
  assert.ok(pages.length > 200, `expected the generated pages to be present, found ${pages.length}`);
});

test('the version is the content hash, so an untouched asset keeps its URL', () => {
  // A build-time stamp would expire every asset on every deploy, including the
  // four that did not change.
  const v = assetVersion('assets/country-pages.css');
  assert.match(v, /^[0-9a-f]{8}$/);
  assert.equal(v, assetVersion('assets/country-pages.css'));
  assert.notEqual(v, assetVersion('assets/country-tariffs.js'), 'different files, different versions');
  assert.notEqual(v, assetVersion('app/mini.css'), 'and the Mini App has its own');
});

test('stamping is idempotent and leaves other hosts alone', () => {
  const once = stampUrl('/assets/magic-net.js');
  assert.equal(stampUrl(once), once, 'a second pass must not append a second version');
  assert.match(once, /^\/assets\/magic-net\.js\?v=[0-9a-f]{8}$/);

  // We cannot version a file we do not own, and trying to used to throw.
  for (const foreign of ['https://cdn.example.com/assets/x.js', '//cdn.example.com/assets/x.css']) {
    assert.equal(stampUrl(foreign), foreign);
  }
  // Data is not an asset: catalog.json is refreshed by a bot on its own cadence.
  assert.equal(stampUrl('/assets/catalog.json'), '/assets/catalog.json');
  // Neither is a reference to a file that is not there.
  assert.equal(stampUrl('/assets/does-not-exist.js'), '/assets/does-not-exist.js');
});

test('the generators stamp their own output, rather than being repaired later', () => {
  for (const gen of ['seo/build-catalogue-pages.mjs', 'seo/build-hub.mjs', 'seo/build-guides.mjs']) {
    const src = read(gen);
    assert.match(src, /import \{ stampUrl \} from '\.\/asset-version\.mjs'/, `${gen} must know about versions`);
    // No bare literal reference left in a template.
    const bare = [...src.matchAll(/(?:href|src)="([^"$]*assets\/[A-Za-z0-9._-]+\.(?:css|js))"/g)].map((m) => m[1]);
    assert.deepEqual(bare, [], `${gen} still emits an unversioned reference`);
  }
});

test('a full build ends by stamping the pages nobody generates', () => {
  // index.html, app/index.html and the static pages have no generator, so the
  // stamping pass is the only thing that updates them.
  const all = read('seo/build-all.mjs');
  assert.match(all, /run\('stamp-assets\.mjs'\)/);
  assert.ok(all.indexOf("stamp-assets.mjs") > all.indexOf("build-sitemap.mjs"),
    'stamping must come after the generators, not before');
});
