// No organisation node in any page's JSON-LD carries `inLanguage`.
//
// schema.org defines `inLanguage` on CreativeWork (WebSite, WebPage, Article …) and
// Event, not on Organization or its subtypes (OnlineStore …); a validator flags it.
// The prefixed homes (seo/home-page.mjs) carried it on their Organization node until
// the Stage 6 audit (2026-10-28) — it stays valid on their WebSite and WebPage.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORG_TYPES = new Set(['Organization', 'OnlineStore', 'Corporation', 'LocalBusiness', 'Store']);

function pages(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) pages(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Every organisation node of a page that carries `inLanguage`, as «type @id». */
export function orgNodesWithLanguage(html) {
  const bad = [];
  for (const [, body] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const doc = JSON.parse(body);
    const walk = (n) => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== 'object') return;
      const types = [].concat(n['@type'] || []);
      if (types.some((t) => ORG_TYPES.has(t)) && Object.prototype.hasOwnProperty.call(n, 'inLanguage')) bad.push(`${types.join('/')} ${n['@id'] || ''}`.trim());
      for (const v of Object.values(n)) walk(v);
    };
    walk(doc);
  }
  return bad;
}

test('the check fires on the exact node the prefixed homes used to carry', () => {
  const old = '<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","@id":"https://magicesim.store/#org","name":"Magic eSIM","inLanguage":"en"},{"@type":"WebSite","inLanguage":"en"}]}</script>';
  assert.deepEqual(orgNodesWithLanguage(old), ['Organization https://magicesim.store/#org']);
  assert.deepEqual(orgNodesWithLanguage(old.replace(',"inLanguage":"en"}', '}')), [], 'WebSite keeps its inLanguage');
});

test('no organisation node on any built page carries inLanguage', () => {
  const dirs = ['index.html', 'esim', 'en', 'es', 'de', 'fr', 'zh', 'ko'].map((d) => join(ROOT, d));
  const files = dirs.flatMap((d) => (d.endsWith('.html') ? [d] : pages(d)));
  assert.ok(files.length > 1000, `expected the whole site, found ${files.length} pages`);
  const found = [];
  for (const f of files) for (const n of orgNodesWithLanguage(readFileSync(f, 'utf8'))) found.push(`${f.slice(ROOT.length + 1)}: ${n}`);
  assert.deepEqual(found, []);
});
