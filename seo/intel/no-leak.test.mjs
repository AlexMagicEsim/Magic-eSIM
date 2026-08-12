// Защита от публикации внутренних данных.
//
// Репозиторий публичный и раздаётся целиком через GitHub Pages: каждый файл в
// нём — доступный URL. Выручка, прибыль и очередь правок публичными быть не
// должны, а .gitignore — это соглашение, которое легко обойти одним `git add -f`.
// Поэтому здесь стоит проверка, которая падает, если внутреннее всё-таки попало
// под контроль версий или в собранную страницу.
//
//   node --test seo/intel/no-leak.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);

test('внутренние измерения не под контролем версий', () => {
  const leaked = tracked.filter((f) => f.startsWith('seo/intel/data/') || f.startsWith('seo/intel/data-demo/'));
  assert.deepEqual(leaked, [], `эти файлы стали бы публичными URL: ${leaked.join(', ')}`);
});

test('панель Content Intelligence Center не лежит в репозитории', () => {
  const panels = tracked.filter((f) => /content-intelligence|intel\/report/.test(f));
  assert.deepEqual(panels, [], 'панель с выручкой и прибылью не должна публиковаться');
});

test('синтетика не попадает в git ни под каким именем', () => {
  // Не по пути, а по содержимому: демо-файлы помечают себя флагом DEMO, и
  // достаточно один раз положить такой файл мимо data-demo/, чтобы синтетика
  // оказалась в отчёте, по которому примут решение.
  const suspicious = [];
  for (const f of tracked) {
    if (!f.endsWith('.json')) continue;
    const full = join(ROOT, f);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, 'utf8');
    if (/"DEMO"\s*:\s*true/.test(text)) suspicious.push(f);
  }
  assert.deepEqual(suspicious, [], `файлы с флагом DEMO под контролем версий: ${suspicious.join(', ')}`);
});

test('в опубликованных страницах нет выручки, прибыли и заказов', () => {
  // Страницы стран собираются из каталога и профиля. Ни один источник не имеет
  // права принести туда внутреннюю цифру, но проверить дешевле, чем узнать.
  const dir = join(ROOT, 'esim');
  const bad = [];
  const FORBIDDEN = /revenue_rub|profit_rub|completed_orders|performance_score|research_priority|Needs Improvement|High Performer/;
  for (const slug of readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    const f = join(dir, slug, 'index.html');
    if (!existsSync(f)) continue;
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) bad.push(slug);
  }
  assert.deepEqual(bad, [], `внутренние метрики просочились в HTML: ${bad.join(', ')}`);
});

test('служебные поля профиля не попадают в HTML', () => {
  // Профиль несёт editor_notes, quality_score, next_review и прочую кухню.
  // Рендерится из него только текст — остальное обязано остаться в JSON.
  const notes = [];
  const profiles = join(ROOT, 'seo/content-profiles');
  for (const f of readdirSync(profiles).filter((x) => x.endsWith('.json'))) {
    const p = JSON.parse(readFileSync(join(profiles, f), 'utf8'));
    if (!p.editor_notes) continue;
    const page = join(ROOT, 'esim', f.replace(/\.json$/, ''), 'index.html');
    if (!existsSync(page)) continue;
    const html = readFileSync(page, 'utf8');
    if (html.includes(p.editor_notes.slice(0, 40))) notes.push(f);
    if (p.search_intent && html.includes(String(p.search_intent).slice(0, 40))) notes.push(`${f}:intent`);
  }
  assert.deepEqual(notes, [], `заметки редактора видны на странице: ${notes.join(', ')}`);
});

test('в отслеживаемых файлах нет похожего на секреты', () => {
  const PATTERNS = [
    [/\bghp_[A-Za-z0-9]{20,}/, 'GitHub token'],
    [/\bAIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
    [/\by0_[A-Za-z0-9_-]{20,}/, 'Yandex OAuth token'],
    [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, 'private key'],
    [/postgres(ql)?:\/\/[^\s"']*:[^\s"'@]+@/, 'строка подключения с паролем'],
    [/"?(client_secret|refresh_token|api_key|access_token)"?\s*[:=]\s*["'][A-Za-z0-9_\-.]{16,}["']/i, 'секрет в коде'],
  ];
  const hits = [];
  for (const f of tracked) {
    if (/\.(png|jpg|jpeg|webp|ico|pdf|svg|woff2?)$/i.test(f)) continue;
    const full = join(ROOT, f);
    if (!existsSync(full)) continue;
    const text = readFileSync(full, 'utf8');
    for (const [re, what] of PATTERNS) if (re.test(text)) hits.push(`${f}: ${what}`);
  }
  assert.deepEqual(hits, [], hits.join('; '));
});
