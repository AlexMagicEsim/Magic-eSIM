// The international Privacy Policy (§3 «Cookies and local storage») names EXACTLY the browser-storage keys that the code of
// the international pages uses — in English and in every translation — and nothing on those pages writes a cookie or
// uses another browser store (2026-10-29: v0.9.5 said «only two values» while the pages used three).
//
// THE CODE SIDE is read, not declared: every script the generated EN / ES / DE / FR / ZH / KO pages (and the shared
// 404.html, which serves unknown /en/… paths) load — <script src>, the logo script's data-motion-src and every inline
// script that is not JSON-LD — plus assets/lang-route.js, which runs on «/» but writes the one key (`mesim.lang.auto`)
// that exists only for visitors it moves to an international page. In each file every `.getItem(` / `.setItem(` /
// `.removeItem(` call is resolved to a key (a string literal, or a constant assigned a literal in the same file) and a
// store (local / session, from the receiver). A call that cannot be resolved FAILS — a dynamic key cannot slip past.
//
// THE POLICY SIDE: each `<li>` of section 3 that starts with `<code>key</code> (local storage | session storage)`, in the
// words of each language. A key in code but not in the policy fails; a key in the policy that no code uses fails; a key
// listed under the wrong store fails.
//
// The first test proves the check fires: the frozen v0.9.5 text (English and every translation) misses `mesim.lang.auto`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIVACY } from './privacy-en.mjs';
import { LEGAL_TRANSLATIONS } from './legal-i18n.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const INTL_DIRS = ['en', 'es', 'de', 'fr', 'zh', 'ko'];
const CODE_BY_DIR = { en: 'en', es: 'es', de: 'de', fr: 'fr', zh: 'zh-Hans', ko: 'ko' };

/** How each language names the two stores in §3 (the existing translations' own terms). */
const STORE_WORDS = Object.freeze({
  en: { local: 'local storage', session: 'session storage' },
  es: { local: 'almacenamiento local', session: 'almacenamiento de sesión' },
  de: { local: 'lokaler Speicher', session: 'Sitzungsspeicher' },
  fr: { local: 'stockage local', session: 'stockage de session' },
  'zh-Hans': { local: '本地存储', session: '会话存储' },
  ko: { local: '로컬 저장소', session: '세션 저장소' },
});

/* ------------------------------------------------------------------ the code side */

/** Comments out, strings kept (a URL's «//» inside a string is not a comment). */
export function stripComments(src) {
  let out = '';
  for (let i = 0; i < src.length;) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1;
    } else if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; out += ' ';
    } else if (c === '/' && src[i + 1] === '/') {
      const j = src.indexOf('\n', i); i = j < 0 ? src.length : j;
    } else { out += c; i += 1; }
  }
  return out;
}

const FORBIDDEN = [
  [/\bdocument\s*\.\s*cookie\b/, 'document.cookie'],
  [/\bcookieStore\b/, 'cookieStore'],
  [/\bindexedDB\b/, 'indexedDB'],
  [/\bcaches\s*\.\s*(open|keys|match|delete|has)\b/, 'Cache Storage'],
  [/\bserviceWorker\b/, 'service worker'],
  [/\bopenDatabase\b/, 'Web SQL'],
  [/\b(localStorage|sessionStorage)\s*\[/, 'storage accessed by index'],
  [/\b(localStorage|sessionStorage)\s*\.\s*(?!getItem|setItem|removeItem)[A-Za-z_$]/, 'storage accessed by property'],
];

/**
 * Every storage key one script uses: { keys: [{ key, store, op }], problems: [..] }.
 * `store` is 'local' or 'session'; a problem is anything the scan cannot resolve or a forbidden API.
 */
export function scanScript(src, label = 'script') {
  const code = stripComments(src);
  const keys = [];
  const problems = [];
  for (const [re, name] of FORBIDDEN) if (re.test(code)) problems.push(`${label}: uses ${name}`);
  const storeOf = (recv) => {
    const m = /(localStorage|sessionStorage)$/.exec(recv);
    if (m) return m[1] === 'localStorage' ? 'local' : 'session';
    const id = recv.split('.').pop().replace(/[$]/g, '\\$');
    const found = new Set([...code.matchAll(new RegExp(`(?:^|[^\\w$.])${id}\\s*=\\s*[\\w$.]*?(localStorage|sessionStorage)\\b`, 'g'))]
      .map((x) => (x[1] === 'localStorage' ? 'local' : 'session')));
    return found.size === 1 ? [...found][0] : null;
  };
  const keyOf = (arg) => {
    const a = arg.trim();
    const lit = /^(['"])([^'"]+)\1$/.exec(a);
    if (lit) return lit[2];
    if (!/^[A-Za-z_$][\w$]*$/.test(a)) return null;
    const vals = new Set([...code.matchAll(new RegExp(`(?:^|[^\\w$.])${a.replace(/[$]/g, '\\$')}\\s*=\\s*(['"])([^'"]+)\\1`, 'g'))].map((x) => x[2]));
    return vals.size === 1 ? [...vals][0] : null;
  };
  for (const m of code.matchAll(/([\w$.]+)\s*\.\s*(getItem|setItem|removeItem)\s*\(\s*([^,)]*)/g)) {
    const [, recv, op, arg] = m;
    const store = storeOf(recv);
    const key = keyOf(arg);
    if (!store) problems.push(`${label}: ${recv}.${op}(${arg}) — cannot tell which store «${recv}» is`);
    if (!key) problems.push(`${label}: ${recv}.${op}(${arg}) — the key is not a literal or a constant of this file`);
    if (store && key) keys.push({ key, store, op });
  }
  return { keys, problems };
}

function pagesUnder(dir) {
  const out = [];
  (function walk(d) {
    for (const n of readdirSync(join(ROOT, d))) {
      const p = join(d, n);
      if (statSync(join(ROOT, p)).isDirectory()) walk(p);
      else if (n.endsWith('.html')) out.push(p);
    }
  }(dir));
  return out;
}

/** The code the international pages run: { files: Map<label, source>, pages }. */
function intlCode() {
  const files = new Map();
  const pages = [...INTL_DIRS.flatMap(pagesUnder), '404.html'];
  for (const rel of pages) {
    const h = read(rel);
    for (const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      const attrs = m[1];
      const src = /\ssrc="([^"]+)"/.exec(attrs);
      const extra = /\sdata-motion-src="([^"]+)"/.exec(attrs);
      for (const s of [src, extra].filter(Boolean)) {
        const path = s[1].replace(/[?#].*$/, '');
        assert.ok(path.startsWith('/') && !path.startsWith('//'), `${rel}: an off-site script ${s[1]}`);
        if (!files.has(path)) files.set(path, read(path.slice(1)));
      }
      if (!src && !/type="application\/ld\+json"/.test(attrs) && m[2].trim()) files.set(`${rel} (inline)`, m[2]);
    }
  }
  // «/» is the Russian home; its language script writes `mesim.lang.auto` only for a visit it moves to an international page.
  files.set('/assets/lang-route.js', read('assets/lang-route.js'));
  return { files, pages };
}

/** { key → store } over every file, with every problem. */
function codeKeys() {
  const { files, pages } = intlCode();
  const byKey = new Map();
  const problems = [];
  for (const [label, src] of files) {
    const r = scanScript(src, label);
    problems.push(...r.problems);
    for (const k of r.keys) {
      if (!byKey.has(k.key)) byKey.set(k.key, { store: k.store, where: new Set() });
      const e = byKey.get(k.key);
      if (e.store !== k.store) problems.push(`${label}: «${k.key}» is used in both local and session storage`);
      e.where.add(label);
    }
  }
  return { byKey, problems, files, pages };
}

/* ------------------------------------------------------------------ the policy side */

/** { key → store } named by §3 of a document (the English module, a translation, or a frozen snapshot). */
export function policyKeys(doc, code) {
  const s = doc.sections.find((x) => x.id === 'cookies');
  assert.ok(s, `${code}: no «cookies» section`);
  const W = STORE_WORDS[code];
  const out = new Map();
  for (const li of s.html.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
    const m = /^\s*<code>([^<]+)<\/code>\s*[(（]\s*([^)）]+?)\s*[)）]/.exec(li[1]);
    if (!m) continue;
    const store = m[2] === W.local ? 'local' : m[2] === W.session ? 'session' : `unknown store «${m[2]}»`;
    out.set(m[1], store);
  }
  // A key named elsewhere in the section (not as a list item) is still a claim about the browser.
  for (const c of s.html.matchAll(/<code>([^<]+)<\/code>/g)) if (!out.has(c[1])) out.set(c[1], 'named outside the list');
  return out;
}

/** What differs between the code and a policy: [] when they agree. */
export function drift(code, policy) {
  const out = [];
  for (const [k, v] of code) {
    if (!policy.has(k)) out.push(`missing from the policy: ${k} (${v} storage)`);
    else if (policy.get(k) !== v) out.push(`${k}: the policy says ${policy.get(k)}, the code uses ${v} storage`);
  }
  for (const k of policy.keys()) if (!code.has(k)) out.push(`named by the policy but used by no code: ${k}`);
  return out;
}

const CODE = codeKeys();
const CODE_MAP = new Map([...CODE.byKey].map(([k, v]) => [k, v.store]));

/* ------------------------------------------------------------------ 1. the check fires */

test('the check fires: the frozen v0.9.5 policy (every language) misses mesim.lang.auto', () => {
  const en = JSON.parse(read('seo/legal-archive/privacy-0.9.5.json'));
  assert.deepEqual(drift(CODE_MAP, policyKeys(en, 'en')), ['missing from the policy: mesim.lang.auto (session storage)']);
  for (const code of Object.keys(LEGAL_TRANSLATIONS)) {
    const t = JSON.parse(read(`seo/legal-archive/${code}/privacy-0.9.5.json`));
    assert.deepEqual(drift(CODE_MAP, policyKeys(t, code)), ['missing from the policy: mesim.lang.auto (session storage)'], code);
  }
});

test('the scanner fires on a new key, a dynamic key, an unknown store, a cookie and another browser store', () => {
  assert.deepEqual(scanScript("localStorage.setItem('mesim.new', '1')").keys, [{ key: 'mesim.new', store: 'local', op: 'setItem' }]);
  assert.deepEqual(scanScript("var K = 'x.y'; var s = window.sessionStorage; s.getItem(K);").keys, [{ key: 'x.y', store: 'session', op: 'getItem' }]);
  assert.match(scanScript("sessionStorage.setItem('k' + id, 1)").problems.join(), /not a literal/);
  assert.match(scanScript("store.getItem('k')").problems.join(), /which store/);
  assert.match(scanScript("document.cookie = 'a=1'").problems.join(), /document\.cookie/);
  assert.match(scanScript('indexedDB.open("x")').problems.join(), /indexedDB/);
  assert.match(scanScript('navigator.serviceWorker.register("/sw.js")').problems.join(), /service worker/);
  assert.match(scanScript('localStorage["k"] = 1').problems.join(), /by index/);
  assert.match(scanScript('localStorage.k = 1').problems.join(), /by property/);
  assert.deepEqual(scanScript("/* localStorage.setItem('old', 1) */ var u = 'https://x//y';").keys, [], 'comments are not code');
  // A policy that lists a key no code uses, or a key under the wrong store, is drift too.
  assert.deepEqual(drift(new Map([['a', 'local']]), new Map([['a', 'session'], ['b', 'local']])),
    ['a: the policy says session, the code uses local storage', 'named by the policy but used by no code: b']);
});

/* ------------------------------------------------------------------ 2. the code today */

test('the international pages’ code: every storage call resolved, no cookie, no other browser store', () => {
  assert.ok(CODE.pages.length > 1200, `${CODE.pages.length} pages read`);
  assert.ok(CODE.files.size >= 20, `${CODE.files.size} scripts read`);
  assert.deepEqual(CODE.problems, []);
  // The inventory as of 2026-10-29 (the Privacy Policy §3, v0.9.6): pinned so a change is seen in review as well.
  assert.deepEqual(Object.fromEntries([...CODE_MAP].sort()), {
    'me-logo': 'session', 'mesim.lang.auto': 'session', 'mesim.site.lang': 'local',
  });
});

/* ------------------------------------------------------------------ 3. the policy today */

test('the current Privacy Policy names exactly the keys the code uses, in the right store — English and every translation', () => {
  assert.deepEqual(drift(CODE_MAP, policyKeys(PRIVACY, 'en')), [], 'en');
  for (const [code, T] of Object.entries(LEGAL_TRANSLATIONS)) assert.deepEqual(drift(CODE_MAP, policyKeys(T.privacy, code)), [], code);
  // No count of values that the next key would falsify.
  const s = PRIVACY.sections.find((x) => x.id === 'cookies').html;
  assert.doesNotMatch(s, /\b(one|two|three|four|five)\b (small )?values?/i);
});

test('the published privacy pages carry that list (built from the current text)', () => {
  for (const dir of INTL_DIRS) {
    const page = read(`${dir}/privacy/index.html`);
    for (const k of CODE_MAP.keys()) assert.ok(page.includes(`<code>${k}</code>`), `${dir}/privacy/: ${k}`);
  }
  for (const code of Object.values(CODE_BY_DIR)) assert.ok(STORE_WORDS[code], code);
  assert.ok(existsSync(join(ROOT, 'seo/legal-archive/privacy-0.9.5.json')), 'v0.9.5 is kept');
});
