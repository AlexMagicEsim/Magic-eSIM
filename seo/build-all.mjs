#!/usr/bin/env node
// One command, one API call, everything downstream regenerated in order.
//   node seo/build-all.mjs
import { execFileSync } from 'node:child_process';
const run = (f) => { console.log(`\n── ${f}`); execFileSync('node', [`seo/${f}`], { stdio: 'inherit' }); };
run('fetch-catalogue.mjs');   // the single source of truth
run('build-catalogue-pages.mjs');
run('build-hub.mjs');
run('build-sitemap.mjs');
// Последним: страницы генераторов рождаются проштампованными, но index.html,
// app/index.html и статические страницы никто не генерирует — их версии
// обновляет только этот проход.
run('stamp-assets.mjs');
console.log('\nГотово.');
