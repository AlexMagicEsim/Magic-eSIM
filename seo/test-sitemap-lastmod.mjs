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
import { resolveLastmod, renderSitemap, fileFor, contentHash, sitemapUrls, stripAssetStamps, stripSiteChrome, rehashKeepDates,
  stripAnimatedLogo, stripLanguageSwitch, stripSiteI18nBundle } from './build-sitemap.mjs';

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

// THIS FILE MUTATES THE REAL WORKING TREE. It has to: test 0 asserts that the
// COMMITTED pages match what the generator produces, and a sandbox copy would
// not be the committed tree. The snapshot above and restore() below put it back.
//
//   But `node --test` runs test FILES in parallel, and seo/test-one-pipeline.mjs
//   copies the working tree into a sandbox to make the same comparison. When the
//   two overlap, that copy catches this file mid-restore and the pipeline test
//   goes red on a page nobody edited. Measured 2026-09-01: roughly one run in
//   six. A gate that fails one time in six is worse than no gate — it teaches
//   everyone to re-run instead of read.
//
//   `npm test` therefore passes --test-concurrency=1, and
//   seo/test-one-pipeline.mjs asserts that the flag is still in package.json.
//   Do not remove either half.

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

test('a share image is not content — fixing a broken og:image is not an edit', () => {
  const page = (img) => `<meta property="og:image" content="${img}" />\n  <meta name="twitter:image" content="${img}" />\n<p>текст</p>`;
  assert.equal(contentHash(page('https://magicesim.store/a.png')), contentHash(page('https://magicesim.store/b.png')),
    'смена картинки превью не должна двигать lastmod');
  assert.notEqual(contentHash(page('https://magicesim.store/a.png')), contentHash(page('https://magicesim.store/a.png').replace('текст', 'другое')),
    'а текст страницы — должен');
});

// ── against the real generator ──────────────────────────────────────────────
test('an hreflang alternate is not content — and only that kind of link', () => {
  const page = (head) => `<html><head>\n<link rel="canonical" href="https://magicesim.store/esim/serbia/" />\n${head}</head><body>текст</body></html>`;
  const tags = '  <link rel="alternate" hreflang="ru" href="https://magicesim.store/esim/serbia/" />\n'
    + '  <link rel="alternate" hreflang="en" href="https://magicesim.store/en/esim/serbia/" />\n'
    + '<link hreflang="x-default" rel="alternate" href="https://magicesim.store/esim/serbia/">\n';
  assert.equal(contentHash(page(tags)), contentHash(page('')), 'взаимные hreflang (в любом порядке атрибутов) не должны менять хеш');
  // Everything else stays content.
  assert.notEqual(contentHash(page('<link rel="alternate" type="application/rss+xml" href="/feed.xml">\n')), contentHash(page('')),
    'alternate без hreflang (лента) — это содержимое');
  assert.notEqual(contentHash(page('').replace('текст', '<a href="/en/" hreflang="en">English</a>')), contentHash(page('')),
    'видимая ссылка-переключатель <a hreflang> — это содержимое');
  assert.notEqual(contentHash(page('').replace('/esim/serbia/', '/esim/montenegro/')), contentHash(page('')),
    'смена canonical — это содержимое');
});

test('4b. giving a real Russian page its hreflang pair moves no date', () => {
  const snap = snapshot();
  const page = join(ROOT, 'esim/serbia/index.html');
  try {
    const tags = '<link rel="alternate" hreflang="ru" href="https://magicesim.store/esim/serbia/" />\n'
      + '<link rel="alternate" hreflang="en" href="https://magicesim.store/en/esim/serbia/" />\n'
      + '<link rel="alternate" hreflang="x-default" href="https://magicesim.store/esim/serbia/" />\n';
    writeFileSync(page, snap.files.get(page).replace('</head>', `${tags}</head>`));
    const out = execFileSync('node', ['seo/build-sitemap.mjs'], {
      cwd: ROOT, encoding: 'utf8', env: { ...process.env, SITEMAP_DATE: '2027-01-01' },
    });
    assert.match(out, /lastmod сдвинут у 0/, `hreflang не правка страницы, вывод: ${out.trim()}`);
    assert.equal(readFileSync(SITEMAP, 'utf8'), snap.sitemap, 'sitemap обязан остаться прежним');
  } finally { restore(snap); }
});

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

test('the live catalogue markup (SEO stage C) does not change the hash — the page reduces to EXACTLY its earlier form', () => {
  const before = [
    '<p class="facts">',
    '          Локальных тарифов: <b>4</b>. С оплатой за день: <b>4</b>. Цены от <b>1 650 ₽</b>.',
    '        </p>',
    '<details class="faq-item"><summary>Q</summary><p>Цены начинаются от 1 650 ₽. Оплата в рублях.</p></details>',
    '  <script src="/assets/daily-plan-copy.js?v=ae5df21d" defer></script>',
    '  <script src="../../assets/country-tariffs.js?v=4a046485" defer></script>',
  ].join('\n');
  const after = [
    '<p class="facts">',
    '          <span data-cat-seg="local">Локальных тарифов: <b data-cat="local">4</b>. </span><span data-cat-seg="daily">С оплатой за день: <b data-cat="daily">4</b>. </span><span data-cat-floor>Цены от <b data-cat="floor">1 650 ₽</b>.</span>',
    '        </p>',
    '<details class="faq-item"><summary>Q</summary><p><span data-cat-floor>Цены начинаются от <span data-cat="floor">1 650 ₽</span>.</span> Оплата в рублях.</p></details>',
    '  <script src="/assets/daily-plan-copy.js?v=ae5df21d" defer></script>',
    '  <!-- Keeps the generated counts and «от N ₽» equal to the catalogue the grid',
    '       shows; hides the floor when that catalogue is stale (stage C). Before',
    '       country-tariffs.js, so it listens before the first render. -->',
    '  <script src="/assets/catalog-numbers.js?v=ed3635ef" defer></script>',
    '  <script src="../../assets/country-tariffs.js?v=c7e68d0f" defer></script>',
  ].join('\n');
  assert.equal(contentHash(after), contentHash(before));
  // …and a real change inside the markup still moves it.
  assert.notEqual(contentHash(after.replace('1 650 ₽</b>', '1 600 ₽</b>')), contentHash(before));
});

/* KO-1 (owner D14 «B», 2026-10-22): the language switch is not content — a new language in the menus of every page must
 * move no date — while a real edit to the page still does. Read on real pages, both menus (desktop list, phone links). */
test('the language switch is not content: a language added to both menus leaves the hash; a real edit still moves it', () => {
  const real = readFileSync(join(ROOT, 'en/esim/japan/index.html'), 'utf8');
  assert.match(real, /<details class="langsw langmenu">/, 'the desktop list is on the page');
  assert.match(real, /<nav class="mnav-panel"[\s\S]*?<hr>\s*<a href="[^"]*" hreflang=/, 'the phone menu lists languages after its <hr>');
  const more = real
    .replace(/(<ul class="langmenu-list">[\s\S]*?)(\n        <\/ul>)/, '$1\n          <li><a href="/xx/esim/japan/" hreflang="xx" lang="xx">Xxxxx</a></li>$2')
    .replace(/(<nav class="mnav-panel"[\s\S]*?)(\n        <\/nav>)/, '$1\n          <a href="/xx/esim/japan/" hreflang="xx" lang="xx">Xxxxx</a>$2');
  assert.notEqual(more, real, 'the language was really added');
  assert.equal((more.match(/Xxxxx/g) || []).length, 2, 'to both menus');
  assert.equal(contentHash(more), contentHash(real), 'a new language in the menus moves no date');
  // …and fewer languages, or another order, neither
  const fewer = real.replace(/\n          <li><a href="\/es\/esim\/japan\/"[^\n]*/, '').replace(/\n          <a href="\/es\/esim\/japan\/"[^\n]*/, '');
  assert.notEqual(fewer, real);
  assert.equal(contentHash(fewer), contentHash(real));
  // a real edit still moves it — alone, and together with a menu change
  const edited = real.replace(/<h1>([^<]+)<\/h1>/, '<h1>$1 — edited</h1>');
  assert.notEqual(edited, real);
  assert.notEqual(contentHash(edited), contentHash(real), 'an edited heading is an edit');
  assert.notEqual(contentHash(more.replace(/<h1>([^<]+)<\/h1>/, '<h1>$1 — edited</h1>')), contentHash(real), 'a menu change does not hide an edit');
  // 2026-10-28 (SEO stage 6, R4): the header and footer are site-wide chrome, so a navigation label no longer moves a
  // date (it was content here before). What the page itself says still does — see «an edit inside <main>» below.
  assert.equal(contentHash(real.replace('data-i18n="nav.how">How it works', 'data-i18n="nav.how">How it all works')), contentHash(real), 'the header navigation is chrome');
});

test('only the switch is stripped: an hreflang link inside the page is still content (a header label is chrome since 2026-10-28)', () => {
  const real = readFileSync(join(ROOT, 'en/guides/iphone/index.html'), 'utf8');
  const withLink = real.replace('</main>', '<p><a href="/es/guides/iphone/" hreflang="es" lang="es">Español</a></p></main>');
  assert.notEqual(withLink, real);
  assert.notEqual(contentHash(withLink), contentHash(real), 'a cross-language link in the content is content');
  // the Russian home's single «English» link is the switch too; its words around it are not
  const ru = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(ru, /<a class="langsw" href="\/en\/" hreflang="en" lang="en">/);
  const ruMore = ru.replace(/(<nav class="mnav-panel"[\s\S]*?<hr>\s*<a href="\/en\/" hreflang="en" lang="en">English<\/a>)/, '$1\n          <a href="/xx/" hreflang="xx" lang="xx">Xxxxx</a>');
  assert.notEqual(ruMore, ru);
  assert.equal(contentHash(ruMore), contentHash(ru));
  assert.equal(contentHash(ru.replace('Как это работает</a>', 'Как всё работает</a>')), contentHash(ru), 'the header navigation is chrome (2026-10-28)');
  assert.notEqual(contentHash(ru.replace('<h2 id="howTitle">Как это работает</h2>', '<h2 id="howTitle">Как всё работает</h2>')), contentHash(ru),
    'the same words as a heading of the home are content');
});

test('KO-1 on the real tree: every page now lists 한국어 in its menus, and no indexed page moved its date for it', () => {
  // the 42 indexed EN/ES pages carry the new language in both menus…
  for (const rel of ['en/index.html', 'es/esim/japan/index.html', 'en/guides/iphone/index.html']) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    assert.equal((html.match(/hreflang="ko" lang="ko">한국어</g) || []).length, 2, `${rel}: 한국어 in both menus`);
  }
  // …and the entry changes nothing the sitemap reads: each page hashes as it would without Korean in its menus
  // (no git history needed — CI checks out one commit)
  for (const rel of ['en/index.html', 'es/esim/japan/index.html', 'en/guides/iphone/index.html', 'en/esim/thailand/index.html']) {
    const html = readFileSync(join(ROOT, rel), 'utf8');
    const without = html.replace(/\n\s*(?:<li>)?<a href="[^"]*" hreflang="ko" lang="ko">한국어<\/a>(?:<\/li>)?/g, '');
    assert.notEqual(without, html);
    assert.equal(contentHash(without), contentHash(html), `${rel}: 한국어 in the menus is not content`);
  }
});

// ── 2026-10-28 (SEO stage 6, GSC audit risk R4): template-only changes move no date ───────────────────────────────
// #169 changed only the footer's «Destinations» list and re-dated all 42 indexed EN/ES URLs. The strips below are
// each proven to FIRE on a real built page first, then shown not to hide an edit to what the page says.

test('R4 strip 1: an asset stamp on any asset type is stripped — first proven on a real page', () => {
  const real = readFileSync(join(ROOT, 'en/esim/france/index.html'), 'utf8');
  // the shapes on the page today, beyond .css/.js: the logo symbol, the icons
  for (const re of [/\/assets\/site\.css\?v=[0-9a-f]+"/, /\/favicon\.svg\?v=[0-9a-f]+"/, /\/apple-touch-icon\.png\?v=[0-9a-f]+"/]) {
    assert.match(real, re, `the page carries ${re}`);
  }
  const stripped = stripAssetStamps(real);
  assert.notEqual(stripped, real, 'the strip fires on the real page');
  assert.doesNotMatch(stripped, /\.(?:css|js|svg|png|ico)\?v=[0-9a-f]+/, 'no asset stamp survives');
  const snippet = '<use href="/assets/brand/logo.svg?v=72aa4ec9#me-symbol"/><link rel="preload" href="/assets/fonts/x.woff2?v=abc123" as="font"><img srcset="/a.webp?v=0f 2x">';
  assert.equal(stripAssetStamps(snippet), '<use href="/assets/brand/logo.svg#me-symbol"/><link rel="preload" href="/assets/fonts/x.woff2" as="font"><img srcset="/a.webp 2x">');
  assert.equal(contentHash(real.replace(/\?v=[0-9a-f]+/g, '?v=00000000')), contentHash(real), 'restamping everything is not an edit');
  // still anchored: prose and non-asset URLs keep their ?v=
  assert.equal(stripAssetStamps('<a href="https://youtu.be/watch?v=deadbeef">x</a>'), '<a href="https://youtu.be/watch?v=deadbeef">x</a>');
  assert.equal(stripAssetStamps('<a href="/page.html?v=abc">x</a>'), '<a href="/page.html?v=abc">x</a>');
});

test('R4 strip 2–4: the site header, the site footer and the CSP meta are chrome — first proven on a real page', () => {
  const real = readFileSync(join(ROOT, 'en/esim/france/index.html'), 'utf8');
  assert.match(real, /<footer class="site-footer">[\s\S]*?<a href="\/en\/esim\/china\/">China<\/a>[\s\S]*?<\/footer>/, 'the footer lists destinations');
  assert.match(real, /<header class="site-header">[\s\S]*?data-i18n="nav.guides"[\s\S]*?<\/header>/, 'the header carries the navigation');
  assert.match(real, /<meta http-equiv="Content-Security-Policy"/, 'the page carries a CSP meta');
  const stripped = stripSiteChrome(real);
  assert.notEqual(stripped, real, 'the strip fires on the real page');
  assert.match(stripped, /<header class="site-header"><\/header>/);
  assert.match(stripped, /<footer class="site-footer"><\/footer>/);
  assert.doesNotMatch(stripped, /Content-Security-Policy/);
  assert.doesNotMatch(stripped, /<a href="\/en\/esim\/china\/">China<\/a>/, 'the footer list is gone');
  // what stays: the substance
  for (const kept of ['<title>', '<meta name="description"', '<link rel="canonical"', '<meta name="robots"', 'application/ld+json', '<main', '<h1', 'id="previewNotice"']) {
    assert.ok(stripped.includes(kept), `${kept} is still hashed`);
  }
  // a destination added to the footer list, a CSP host, a header label: no change
  const footer = real.replace('<li><a href="/en/esim/china/">China</a></li>', '<li><a href="/en/esim/brazil/">Brazil</a></li>\n          <li><a href="/en/esim/china/">China</a></li>');
  assert.notEqual(footer, real);
  assert.equal(contentHash(footer), contentHash(real), 'the footer list is chrome');
  const csp = real.replace('connect-src https://', 'connect-src https://example.org https://');
  assert.notEqual(csp, real);
  assert.equal(contentHash(csp), contentHash(real), 'the CSP is chrome');
});

test('R4 negative: an edit inside <main>, to the title, description, canonical, robots or JSON-LD still moves the hash', () => {
  const real = readFileSync(join(ROOT, 'en/esim/france/index.html'), 'utf8');
  const h = contentHash(real);
  const main = real.match(/<main[\s\S]*?<\/main>/)[0];
  const sentence = main.match(/<p>[^<]{40,}/)[0];
  const edits = {
    'a sentence in <main>': real.replace(sentence, `${sentence} Edited.`),
    '<h1>': real.replace(/<h1>/, '<h1>Edited '),
    '<title>': real.replace('<title>', '<title>Edited '),
    'meta description': real.replace('<meta name="description" content="', '<meta name="description" content="Edited '),
    'canonical': real.replace('<link rel="canonical" href="https://magicesim.store/en/esim/france/">', '<link rel="canonical" href="https://magicesim.store/en/esim/spain/">'),
    'robots': real.replace('content="index, follow"', 'content="noindex, follow"'),
    'JSON-LD': real.replace('"@type":"BreadcrumbList"', '"@type":"BreadcrumbList","name":"x"'),
    'the payment notice': real.replace('Online payment isn\'t available yet', 'Online payment is available'),
  };
  for (const [what, edited] of Object.entries(edits)) {
    assert.notEqual(edited, real, `${what}: the edit applied`);
    assert.notEqual(contentHash(edited), h, `${what} is content`);
  }
  // and chrome changes do not hide a content edit made in the same build
  const both = edits['a sentence in <main>'].replace('<li><a href="/en/esim/china/">China</a></li>', '');
  assert.notEqual(contentHash(both), h);
});

test('R4 migration: --rehash-keep-dates keeps every date, takes the new hash, refuses an unknown page', () => {
  const urls = [{ loc: 'https://magicesim.store/a/' }, { loc: 'https://magicesim.store/b/' }];
  const prev = { 'https://magicesim.store/a/': { hash: 'old-a', lastmod: '2026-01-01' }, 'https://magicesim.store/b/': { hash: 'old-b', lastmod: '2026-02-02' } };
  const { state, moved } = rehashKeepDates({ urls, hashOf: (l) => `new-${l.slice(-2, -1)}`, prev });
  assert.deepEqual(moved, []);
  assert.deepEqual(state, { 'https://magicesim.store/a/': { hash: 'new-a', lastmod: '2026-01-01' }, 'https://magicesim.store/b/': { hash: 'new-b', lastmod: '2026-02-02' } });
  assert.throws(() => rehashKeepDates({ urls: [...urls, { loc: 'https://magicesim.store/c/' }], hashOf: () => 'x', prev }), /нет в состоянии/);
  // the CLI refuses the two modes together
  let failed = false;
  try { execFileSync('node', ['seo/build-sitemap.mjs', '--seed', '--rehash-keep-dates'], { cwd: ROOT, stdio: 'pipe' }); }
  catch (e) { failed = true; assert.match(String(e.stderr), /взаимоисключающие/); }
  assert.ok(failed);
});

// The three properties on the REAL tree, through the real CLI (snapshot + restore as the tests above).
function buildOut() {
  return execFileSync('node', ['seo/build-sitemap.mjs'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, SITEMAP_DATE: '2027-01-01' } });
}
const SITEMAP_FILES = () => sitemapUrls(COUNTRIES()).map((u) => join(ROOT, fileFor(u.loc)));

test('R4 (a) on the real tree: a new stamp of a shared asset on every page moves no date', () => {
  const snap = snapshot();
  try {
    let touched = 0;
    for (const f of SITEMAP_FILES()) {
      const body = snap.files.get(f);
      const next = body.replace(/\/assets\/site\.css\?v=[0-9a-f]+/g, '/assets/site.css?v=0123abcd').replace(/\/favicon\.svg\?v=[0-9a-f]+/g, '/favicon.svg?v=0123abcd');
      if (next !== body) { writeFileSync(f, next); touched++; }
    }
    assert.equal(touched, URL_COUNT, 'every sitemap page was restamped');
    const out = buildOut();
    assert.match(out, /lastmod сдвинут у 0/, out.trim());
    assert.equal(readFileSync(SITEMAP, 'utf8'), snap.sitemap);
  } finally { restore(snap); }
});

test('R4 (b) on the real tree: a destination added to the footer of every page moves no date', () => {
  const snap = snapshot();
  try {
    let touched = 0;
    for (const f of SITEMAP_FILES()) {
      const body = snap.files.get(f);
      const next = body.replace(/(<footer class="site-footer">[\s\S]*?<ul>)/, '$1\n          <li><a href="/en/esim/brazil/">Brazil</a></li>');
      if (next !== body) { writeFileSync(f, next); touched++; }
    }
    assert.equal(touched, URL_COUNT, 'every sitemap page has a footer list');
    const out = buildOut();
    assert.match(out, /lastmod сдвинут у 0/, out.trim());
    assert.equal(readFileSync(SITEMAP, 'utf8'), snap.sitemap);
  } finally { restore(snap); }
});

test('R4 (c) on the real tree: one sentence changed inside one page\'s <main> moves exactly that date', () => {
  const snap = snapshot();
  const page = join(ROOT, 'en/esim/france/index.html');
  try {
    const body = snap.files.get(page);
    const main = body.match(/<main[\s\S]*?<\/main>/)[0];
    const sentence = main.match(/<p>[^<]{40,}/)[0];
    writeFileSync(page, body.replace(sentence, `${sentence} Edited.`));
    const out = buildOut();
    assert.match(out, /lastmod сдвинут у 1/, out.trim());
    const xml = readFileSync(SITEMAP, 'utf8');
    assert.equal((xml.match(/<lastmod>2027-01-01<\/lastmod>/g) || []).length, 1);
    assert.match(xml.split('<url>').find((b) => b.includes('<loc>https://magicesim.store/en/esim/france/</loc>')), /2027-01-01/);
  } finally { restore(snap); }
});

// THE PREMISE the header / footer strip rests on: that chrome is the SAME on every page of a language and holds nothing
// page-specific. Pinned here, so a page-specific line moved into a header or footer fails a gate instead of silently
// leaving the hash.
const SITE_HEADER = /<header class="site-header">[\s\S]*?<\/header>/g;
const SITE_FOOTER = /<footer class="site-footer">[\s\S]*?<\/footer>/g;
const CHROME_FORBIDDEN = ['application/ld+json', '<main', '<h1', 'crumbs', 'previewNotice'];
function chromeProblems(pages) {           // pages: [{ file, html }]
  const problems = [];
  const variants = {};                     // lang → { header: Map, footer: Map }
  for (const { file, html } of pages) {
    const norm = stripAssetStamps(stripAnimatedLogo(stripSiteI18nBundle(stripLanguageSwitch(html))));
    const lang = (norm.match(/<html lang="([^"]+)"/) || [])[1] || '?';
    const headers = norm.match(SITE_HEADER) || [];
    const footers = norm.match(SITE_FOOTER) || [];
    if (headers.length !== 1) problems.push(`${file}: ${headers.length} site headers`);
    if (footers.length !== 1) problems.push(`${file}: ${footers.length} site footers`);
    const v = variants[lang] ||= { header: new Map(), footer: new Map() };
    for (const [kind, blocks] of [['header', headers], ['footer', footers]]) {
      for (const b of blocks) {
        if (!v[kind].has(b)) v[kind].set(b, file);
        for (const bad of CHROME_FORBIDDEN) if (b.includes(bad)) problems.push(`${file}: ${kind} holds «${bad}»`);
      }
    }
  }
  for (const [lang, v] of Object.entries(variants)) {
    const maxHeaders = lang === 'ru' ? 2 : 1;   // the Russian home has its own header
    if (v.header.size > maxHeaders) problems.push(`${lang}: ${v.header.size} header variants (${[...v.header.values()].join(', ')})`);
    if (v.footer.size > 1) problems.push(`${lang}: ${v.footer.size} footer variants (${[...v.footer.values()].join(', ')})`);
  }
  return problems;
}

test('R4 premise: the stripped header and footer are one site-wide block per language, with nothing page-specific', () => {
  const pages = sitemapUrls(COUNTRIES()).map((u) => ({ file: fileFor(u.loc), html: readFileSync(join(ROOT, fileFor(u.loc)), 'utf8') }));
  // FIRST: the check fires — one footer with a page-specific line on one page
  const i = pages.findIndex((p) => p.file === 'en/esim/france/index.html');
  assert.ok(i >= 0);
  const altered = pages.map((p, k) => (k === i ? { ...p, html: p.html.replace('<footer class="site-footer">', '<footer class="site-footer"><p>Only France: 5 plans.</p>') } : p));
  assert.notEqual(altered[i].html, pages[i].html);
  assert.ok(chromeProblems(altered).some((m) => /^en: 2 footer variants/.test(m)), 'a page-specific footer is caught');
  const ld = pages.map((p, k) => (k === i ? { ...p, html: p.html.replace('</header>', '<script type="application/ld+json">{}</script></header>') } : p));
  assert.ok(chromeProblems(ld).some((m) => m.includes('header holds «application/ld+json»')), 'content inside the chrome is caught');
  const two = pages.map((p, k) => (k === i ? { ...p, html: p.html.replace('</body>', '<footer class="site-footer"></footer></body>') } : p));
  assert.ok(chromeProblems(two).some((m) => m.includes('2 site footers')), 'a second footer is caught');
  // …and the real tree has none of it
  assert.deepEqual(chromeProblems(pages), []);
  assert.deepEqual([...new Set(pages.map((p) => (p.html.match(/<html lang="([^"]+)"/) || [])[1]))].sort(), ['en', 'es', 'ru'], 'all three sitemap languages were read');
});

test('6 (again, last). the R4 tests too leave the working tree exactly as they found it', () => {
  const changed = [];
  for (const [f, body] of BASELINE.files) if (readFileSync(f, 'utf8') !== body) changed.push(f.slice(ROOT.length + 1));
  assert.deepEqual(changed, [], `тесты оставили изменённые страницы:\n${changed.join('\n')}`);
  assert.equal(readFileSync(SITEMAP, 'utf8'), BASELINE.sitemap, 'sitemap.xml restored');
  assert.equal(readFileSync(STATE, 'utf8'), BASELINE.state, 'the state restored');
});
