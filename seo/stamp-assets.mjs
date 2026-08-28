#!/usr/bin/env node
// Проставить версии CSS/JS во ВСЕХ html витрины.
//
//   node seo/stamp-assets.mjs         — проставить и записать
//   node seo/stamp-assets.mjs --check — только проверить (код 1, если устарело)
//
// Генераторы страниц зовут stampUrl() сами, поэтому их вывод рождается уже
// проштампованным. Этот проход нужен для файлов, которые никто не генерирует
// — index.html, app/index.html, iphone/android/404/payment-success — и как
// ремонт, если ассет поменяли, а страницы не пересобирали.
//
// Почему это вообще нужно — см. seo/asset-version.mjs.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stampHtml } from './asset-version.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.playwright-mcp', 'Magic-eSIM-github-2']);

function htmlFiles(dir = ROOT, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) htmlFiles(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

const checkOnly = process.argv.includes('--check');
const stale = [];
let changed = 0;

for (const file of htmlFiles()) {
  const before = readFileSync(file, 'utf8');
  const after = stampHtml(before, dirname(file));
  if (before === after) continue;
  stale.push(relative(ROOT, file));
  if (!checkOnly) { writeFileSync(file, after); changed++; }
}

if (checkOnly) {
  if (stale.length) {
    console.error(`Версии ассетов устарели в ${stale.length} файлах:`);
    for (const f of stale.slice(0, 10)) console.error('  ' + f);
    if (stale.length > 10) console.error(`  … и ещё ${stale.length - 10}`);
    console.error('\nПочинить: node seo/stamp-assets.mjs');
    process.exit(1);
  }
  console.log('Версии ассетов актуальны во всём HTML.');
} else {
  console.log(changed ? `Проштамповано файлов: ${changed}` : 'Всё уже проштамповано.');
}
