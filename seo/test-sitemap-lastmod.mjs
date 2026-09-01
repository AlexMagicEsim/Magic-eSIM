// lastmod must describe the PAGE, not the build.
//
// WHY
//
//   build-sitemap.mjs stamped `new Date()` on all 209 URLs on every run. A wave
//   that rewrote ten pages announced that all 209 had changed; so did a run that
//   changed nothing. `lastmod` is the one hint in a sitemap a crawler can act on,
//   and a value that is always today carries none.
//
//   Four properties are proven here, and each one failed before the change:
//
//     0. the committed state still describes the pages on disk;
//     1. editing ONE page moves ONE date;
//     2. rebuilding with no edits moves NOTHING;
//     3. regenerating every page from the same inputs is not a mass edit.
//
// WHY IT IS ALL ONE FILE, AND WHY (0) COMES FIRST
//
//   An earlier draft split the staleness check into its own file, reasoning that
//   node:test would then give it a separate process. It does — and that made
//   things worse, because `node --test` runs FILES CONCURRENTLY while the two
//   files share one working tree. An independent review reproduced both
//   directions: the state check false-FAILED (~20 % of runs) while the
//   regeneration test held esim/serbia/index.html edited and sitemap.xml stamped
//   2027-01-01, and false-PASSED when the generator had already reverted a real
//   hand edit. Process isolation was never the problem; the shared tree was.
//
//   So: one file, which node:test runs sequentially, with the read-only check
//   first — before anything has had a chance to repair what it is looking for.
//
//   And the mutating tests now snapshot and restore EVERY html file they could
//   touch. The previous version restored sitemap.xml and the state file but not
//   the ~200 pages it regenerated; it looked clean only because the tree happened
//   to be stamp-consistent. With one unbuilt CSS edit in the tree, `npm test`
//   passed and left 207 tracked files rewritten.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveLastmod, renderSitemap, fileFor, contentHash, sitemapUrls } from './build-sitemap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITEMAP = join(ROOT, 'sitemap.xml');
const STATE = join(ROOT, 'seo/sitemap-lastmod.json');
const COUNTRIES = () => JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8')).countries;
const URL_COUNT = sitemapUrls(COUNTRIES()).length;

// Every .html a generator or the stamping pass could rewrite. Snapshotting the
// list of sitemap URLs is not enough: stamp-assets.mjs walks the whole checkout.
function allHtml(dir = ROOT, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === '.git' || e === 'node_modules' || e === 'test-results') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) allHtml(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}
function snapshot() {
  const files = new Map();
  for (const f of allHtml()) files.set(f, readFileSync(f, 'utf8'));
  return { files, sitemap: readFileSync(SITEMAP, 'utf8'), state: readFileSync(STATE, 'utf8') };
}
function restore(s) {
  for (const [f, body] of s.files) if (readFileSync(f, 'utf8') !== body) writeFileSync(f, body);
  writeFileSync(SITEMAP, s.sitemap);
  writeFileSync(STATE, s.state);
}

// Taken once, at import, before any test has run.
const BASELINE = snapshot();

// ── 0. read-only, and deliberately first ────────────────────────────────────
test('0. the committed state still matches the pages on disk', () => {
  // Catches: someone edits a page by hand — as f65233b did to twelve legacy
  // pages — and does not rerun the generator. The sitemap then dates that page
  // wrongly and nothing notices, because the file itself is well-formed.
  const state = JSON.parse(readFileSync(STATE, 'utf8')).pages;
  const stale = [];
  for (const u of sitemapUrls(COUNTRIES())) {
    assert.ok(state[u.loc], `${u.loc} нет в seo/sitemap-lastmod.json — запусти node seo/build-sitemap.mjs`);
    if (state[u.loc].hash !== contentHash(readFileSync(join(ROOT, fileFor(u.loc)), 'utf8'))) stale.push(u.loc);
  }
  assert.deepEqual(stale, [], 'страницы изменились без пересборки sitemap — запусти node seo/build-sitemap.mjs');
  const orphan = Object.keys(state).filter((k) => !sitemapUrls(COUNTRIES()).some((u) => u.loc === k));
  assert.deepEqual(orphan, [], 'в состоянии остались URL, которых нет в sitemap');
});

test('0b. every lastmod is a real date, and none is in the future', () => {
  const dates = [...readFileSync(SITEMAP, 'utf8').matchAll(/<lastmod>([^<]*)<\/lastmod>/g)].map((m) => m[1]);
  assert.equal(dates.length, URL_COUNT, 'у каждого URL должна быть дата');
  const today = new Date().toISOString().slice(0, 10);
  for (const d of dates) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `дата «${d}» не в формате YYYY-MM-DD`);
    assert.ok(d <= today, `дата ${d} в будущем`);
  }
});

test('0c. every URL maps to a file that exists', () => {
  for (const u of sitemapUrls(COUNTRIES())) {
    assert.ok(existsSync(join(ROOT, fileFor(u.loc))), `${u.loc} → ${fileFor(u.loc)} отсутствует`);
  }
});

// ── the rule itself, with no filesystem ─────────────────────────────────────
const URLS = [
  { loc: 'https://magicesim.store/', prio: '1.0', freq: 'weekly' },
  { loc: 'https://magicesim.store/esim/serbia/', prio: '0.9', freq: 'weekly' },
  { loc: 'https://magicesim.store/esim/oman/', prio: '0.9', freq: 'weekly' },
];
const prevOf = (h) => Object.fromEntries(URLS.map((u, i) => [u.loc, { hash: h[i], lastmod: '2026-08-01' }]));

test('1. editing one page moves only that page', () => {
  const prev = prevOf(['aaa', 'bbb', 'ccc']);
  const hashOf = (loc) => (loc.endsWith('/esim/oman/') ? 'ЧТО-ТО-ДРУГОЕ' : prev[loc].hash);
  const { state, moved } = resolveLastmod({ urls: URLS, hashOf, prev, today: '2026-09-05' });
  assert.deepEqual(moved, ['https://magicesim.store/esim/oman/'], 'сдвинуться должен ровно один URL');
  assert.equal(state['https://magicesim.store/esim/oman/'].lastmod, '2026-09-05');
  assert.equal(state['https://magicesim.store/esim/serbia/'].lastmod, '2026-08-01', 'соседняя страница не тронута');
  assert.equal(state['https://magicesim.store/'].lastmod, '2026-08-01', 'главная не тронута');
});

test('2. a rebuild with no edits moves nothing at all', () => {
  const prev = prevOf(['aaa', 'bbb', 'ccc']);
  const { state, moved } = resolveLastmod({ urls: URLS, hashOf: (l) => prev[l].hash, prev, today: '2026-12-31' });
  assert.deepEqual(moved, [], 'ни один URL не должен сдвинуться');
  assert.equal(renderSitemap(URLS, state), renderSitemap(URLS, prev), 'sitemap обязан выйти байт-в-байт прежним');
});

test('2b. and the clock is not consulted — a later date changes nothing', () => {
  const prev = prevOf(['aaa', 'bbb', 'ccc']);
  const a = resolveLastmod({ urls: URLS, hashOf: (l) => prev[l].hash, prev, today: '2026-09-05' });
  const b = resolveLastmod({ urls: URLS, hashOf: (l) => prev[l].hash, prev, today: '2027-04-17' });
  assert.deepEqual(a.state, b.state, 'результат не должен зависеть от даты запуска');
});

test('3. a URL with no history is dated today, and only it', () => {
  const prev = { 'https://magicesim.store/': { hash: 'aaa', lastmod: '2026-08-01' } };
  const hashOf = (loc) => (loc === 'https://magicesim.store/' ? 'aaa' : 'новый');
  const { state, moved } = resolveLastmod({ urls: URLS, hashOf, prev, today: '2026-09-05' });
  assert.equal(moved.length, 2, 'две новые страницы');
  assert.equal(state['https://magicesim.store/'].lastmod, '2026-08-01', 'существующая не тронута');
});

test('asset version stamps are not content — restamping is not an edit', () => {
  const a = '<script src="/assets/x.js?v=deadbeef"></script><p>текст</p>';
  const b = '<script src="/assets/x.js?v=12345678"></script><p>текст</p>';
  assert.equal(contentHash(a), contentHash(b), 'смена версии ассета не должна менять хеш');
  assert.notEqual(contentHash(a), contentHash(a.replace('текст', 'другой текст')), 'а смена текста — должна');
});

test('the strip is anchored to assets — a ?v= inside prose is content', () => {
  // Unanchored, `?v=dQw4w9WgXcQ` lost its «?v=d» and hashed as a different,
  // collidable string. Nothing on the site embeds video today; the regex should
  // still not be right only by luck.
  const a = '<p>Смотри https://youtu.be/watch?v=deadbeef00</p>';
  const b = '<p>Смотри https://youtu.be/watch?v=cafebabe11</p>';
  assert.notEqual(contentHash(a), contentHash(b), 'разные ссылки обязаны давать разный хеш');
});

// ── against the real generator ──────────────────────────────────────────────
test('4. regenerating every page is not a mass edit', () => {
  const snap = snapshot();
  try {
    execFileSync('node', ['seo/build-catalogue-pages.mjs'], { cwd: ROOT, stdio: 'pipe' });
    execFileSync('node', ['seo/build-hub.mjs'], { cwd: ROOT, stdio: 'pipe' });
    execFileSync('node', ['seo/stamp-assets.mjs'], { cwd: ROOT, stdio: 'pipe' });
    const out = execFileSync('node', ['seo/build-sitemap.mjs'], {
      cwd: ROOT, encoding: 'utf8', env: { ...process.env, SITEMAP_DATE: '2027-01-01' },
    });
    assert.match(out, /lastmod сдвинут у 0/, `полная перегенерация не должна двигать даты, вывод: ${out.trim()}`);
    assert.equal(readFileSync(SITEMAP, 'utf8'), snap.sitemap, 'sitemap обязан остаться прежним');
    assert.equal((readFileSync(SITEMAP, 'utf8').match(/<loc>/g) || []).length, URL_COUNT, 'число URL не меняется');
  } finally { restore(snap); }
});

test('5. a real edit to a real page moves exactly one date', () => {
  const snap = snapshot();
  const page = join(ROOT, 'esim/serbia/index.html');
  try {
    writeFileSync(page, snap.files.get(page).replace('</body>', '<!-- проверочная правка -->\n</body>'));
    const out = execFileSync('node', ['seo/build-sitemap.mjs'], {
      cwd: ROOT, encoding: 'utf8', env: { ...process.env, SITEMAP_DATE: '2027-01-01' },
    });
    assert.match(out, /lastmod сдвинут у 1/, `ожидался ровно один сдвиг, вывод: ${out.trim()}`);
    const xml = readFileSync(SITEMAP, 'utf8');
    assert.equal((xml.match(/<lastmod>2027-01-01<\/lastmod>/g) || []).length, 1, 'дата правки стоит ровно у одного URL');
    assert.match(xml.split('<url>').find((b) => b.includes('/esim/serbia/')), /2027-01-01/, 'и это именно изменённая страница');
  } finally { restore(snap); }
});

test('6. the tests leave the working tree exactly as they found it', () => {
  // The property that failed silently before: `npm test` passed and rewrote 207
  // tracked files. Asserted last, so it sees whatever the mutating tests left.
  //
  // Compared against the tree AS THIS FILE FOUND IT, not against git. A
  // developer's own uncommitted edit is not this suite's doing, and blaming the
  // tests for it would send the next person hunting the wrong bug.
  const changed = [];
  for (const [f, body] of BASELINE.files) {
    if (readFileSync(f, 'utf8') !== body) changed.push(f.slice(ROOT.length + 1));
  }
  assert.deepEqual(changed, [], `тесты оставили изменённые страницы:\n${changed.join('\n')}`);
});

// ── losing the state is not an ordinary build ───────────────────────────────
test('7. a missing or malformed state file refuses to write', () => {
  const snap = snapshot();
  try {
    execFileSync('node', ['-e', 'require("fs").unlinkSync("seo/sitemap-lastmod.json")'], { cwd: ROOT });
    let failed = false;
    try { execFileSync('node', ['seo/build-sitemap.mjs'], { cwd: ROOT, stdio: 'pipe' }); }
    catch (e) { failed = true; assert.match(String(e.stderr), /отсутствует/, 'должно объяснять, что это состояние'); }
    assert.ok(failed, 'без состояния сборка обязана падать, а не датировать всё сегодняшним днём');
    assert.equal(readFileSync(SITEMAP, 'utf8'), snap.sitemap, 'и не трогать sitemap');

    writeFileSync(STATE, '{"foo":1}\n');
    failed = false;
    try { execFileSync('node', ['seo/build-sitemap.mjs'], { cwd: ROOT, stdio: 'pipe' }); }
    catch (e) { failed = true; assert.match(String(e.stderr), /pages/, 'должно называть недостающий ключ'); }
    assert.ok(failed, 'состояние без ключа pages обязано ломать сборку');
  } finally { restore(snap); }
});

test('8. SITEMAP_DATE must be a date', () => {
  let failed = false;
  try { execFileSync('node', ['seo/build-sitemap.mjs'], { cwd: ROOT, stdio: 'pipe', env: { ...process.env, SITEMAP_DATE: 'вчера' } }); }
  catch (e) { failed = true; assert.match(String(e.stderr), /YYYY-MM-DD/); }
  assert.ok(failed, 'мусор в SITEMAP_DATE не должен попадать в sitemap');
});
