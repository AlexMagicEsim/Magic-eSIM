#!/usr/bin/env node
// Refuses to continue if the rebuild touched anything it had no business touching.
//
//   git status --porcelain > changed.txt
//   node scripts/seo-refresh-check-paths.mjs --status changed.txt
//
// Exit 0 means every changed path is a generated SEO artefact. Any other exit
// means the run stops WITHOUT creating or updating a pull request — which is the
// whole point: the automation holds write access to a public repository, and the
// failure it must never have is «an unrelated file rode along in a 200-file diff
// nobody read to the bottom of».
//
// The permitted country pages come from the snapshot that was just built, so a
// country the provider starts selling needs no change here. Everything else is
// five exact paths. See seo/refresh-allowlist.mjs for why it is an allowlist.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePorcelain, unexpectedPaths, FIXED_ALLOWED } from '../seo/refresh-allowlist.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const i = process.argv.indexOf('--status');
const file = i === -1 ? null : process.argv[i + 1];
if (!file || !existsSync(file)) {
  console.error('нужен --status <файл с выводом git status --porcelain>');
  process.exit(2);
}

const snapshot = join(ROOT, 'seo/catalogue-countries.json');
if (!existsSync(snapshot)) {
  console.error('seo/catalogue-countries.json отсутствует — без него список разрешённых страниц неизвестен');
  process.exit(2);
}

const slugs = (JSON.parse(readFileSync(snapshot, 'utf8')).countries || []).map((c) => c.slug);
const changed = parsePorcelain(readFileSync(file, 'utf8'));
const bad = unexpectedPaths(changed, slugs);

console.error(`изменено файлов: ${changed.length}; разрешено: ${FIXED_ALLOWED.length} фиксированных + ${slugs.length} страниц стран`);

if (bad.length) {
  console.error('');
  console.error('ОСТАНОВ: пересборка изменила файлы, которых не должна была касаться:');
  for (const p of bad) console.error(`  ${p}`);
  console.error('');
  console.error('PR не создаётся и не обновляется. Разберитесь вручную: либо генератор стал писать');
  console.error('что-то новое — тогда список в seo/refresh-allowlist.mjs надо осознанно расширить, —');
  console.error('либо в рабочем дереве оказалось лишнее, и это само по себе повод остановиться.');
  process.exit(1);
}

console.error('все изменения — ожидаемые сгенерированные артефакты');
