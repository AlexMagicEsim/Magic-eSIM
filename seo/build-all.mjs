#!/usr/bin/env node
// One command, one API call, everything downstream regenerated in order.
//   node seo/build-all.mjs
import { execFileSync } from 'node:child_process';
const run = (f) => { console.log(`\n── ${f}`); execFileSync('node', [`seo/${f}`], { stdio: 'inherit' }); };
run('fetch-catalogue.mjs');   // the single source of truth
run('build-catalogue-pages.mjs');
run('build-hub.mjs');
run('build-sitemap.mjs');
// fact-sheets.json is what the editorial gates check an authored claim against,
// and it was NOT in this list. So «rebuild everything» left the sheet describing
// an older catalogue than the pages beside it — which is how, on 2026-09-14,
// two profiles went on promising «дневные — от 300 ₽» after the 100 ₽/day plan
// behind that number was withdrawn. A gate fed a stale fact cannot refuse a
// stale claim.
run('fact-sheet.mjs');
// Последним: страницы генераторов рождаются проштампованными, но index.html,
// app/index.html и статические страницы никто не генерирует — их версии
// обновляет только этот проход.
run('stamp-assets.mjs');
console.log('\nГотово.');
