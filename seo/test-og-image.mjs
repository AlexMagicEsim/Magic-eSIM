// Every share image a page names must be a file this site actually serves.
//
// Until 2026-09-27 the 198 country pages and the hub named
// https://magicesim.store/magic-esim-banner.png in og:image and twitter:image.
// That file never existed in git — the only banner ever committed was
// magic-esim-banner-optimized.jpg, added and deleted on 2026-05-03 — so the URL
// answered 404 and a link to a country page shared in Telegram came without a
// picture. No test looked, because nothing ever resolves a meta URL. This does.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';

function pages() {
  const out = [join(ROOT, 'index.html'), join(ROOT, 'en/index.html'), join(ROOT, 'esim/index.html')];
  for (const d of readdirSync(join(ROOT, 'esim'))) {
    const f = join(ROOT, 'esim', d, 'index.html');
    if (existsSync(f)) out.push(f);
  }
  return out;
}

const IMAGE_META = /<meta\s+(?:property|name)="(og:image|twitter:image)"\s+content="([^"]+)"/g;

test('every og:image and twitter:image resolves to a file in the repository', () => {
  const all = pages();
  assert.ok(all.length > 200, `страниц ${all.length}`);
  const broken = [];
  let seen = 0;
  for (const file of all) {
    const html = readFileSync(file, 'utf8');
    for (const [, key, url] of html.matchAll(IMAGE_META)) {
      seen++;
      if (!url.startsWith(`${SITE}/`)) { broken.push(`${file.slice(ROOT.length)}: ${key} не на нашем домене — ${url}`); continue; }
      const local = join(ROOT, url.slice(SITE.length + 1).split(/[?#]/)[0]);
      if (!existsSync(local) || !statSync(local).isFile()) broken.push(`${file.slice(ROOT.length)}: ${key} → ${url} — файла нет`);
    }
  }
  assert.ok(seen > 400, `мета-картинок найдено ${seen} — селектор перестал совпадать с разметкой?`);
  assert.deepEqual(broken, []);
});

test('every country page names a share image', () => {
  const missing = pages().filter((f) => f.includes('/esim/') && !/property="og:image"/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(missing.map((f) => f.slice(ROOT.length)), []);
});
