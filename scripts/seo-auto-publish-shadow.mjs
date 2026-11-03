#!/usr/bin/env node
// SHADOW MODE — WHAT COULD HAVE BEEN PUBLISHED WITHOUT A PERSON (stage 2, 2026-11-03).
//
// The SEO refresh (.github/workflows/seo-refresh-pr.yml) rebuilds every page from
// the newest catalogue and opens a pull request a person merges. With the live
// auto-import the catalogue moves at every slot, the PR is RISK HIGH every time,
// and the pages fall days behind the cards (which read the live API). The plan
// agreed with the owner: publish automatically only what is provably «the same
// page with other numbers», and keep the PR for everything else. Before any
// such lane exists, this script only DECIDES AND RECORDS — it publishes nothing,
// pushes nothing, and no later step reads its verdict. It never fails the job.
//
// A rebuild «would auto-publish» only when ALL of these hold (fail closed: any
// doubt — an unreadable file, an unknown status — is «review»):
//   1. gates   — the job's gates and browser tiers are green;
//   2. paths   — every changed path is a generated artefact (seo/refresh-allowlist.mjs)
//                and none is added or deleted;
//   3. pages   — the set of country pages and of sitemap URLs is unchanged;
//   4. claims  — seo/suppressed-claims.json lists exactly what it listed before
//                (no authored sentence newly left out, none back);
//   5. text    — every changed page is the SAME page once its numbers are masked:
//                every digit run (with its thousands separators) is one token and
//                the generator's counted nouns lose their plural ending — so a new
//                price, count or floor passes, and a new word, card name, volume
//                list in words or sentence does not.
//
// It also measures what a number-blind lastmod would have done: how many dates
// this rebuild moves now, and how many it would move if only text moved them.
//
//   node scripts/seo-auto-publish-shadow.mjs --changed /tmp/seo-changed.txt \
//     --gates success --browser success --out /tmp/seo-shadow
//
// Writes <out>/shadow.json and <out>/shadow.md, prints one `SEO_SHADOW {…}` line.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parsePorcelain, unexpectedPaths } from '../seo/refresh-allowlist.mjs';
import { stripAssetStamps } from '../seo/build-sitemap.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The nouns the generators put after a number, in every form (seo/*.mjs plural()).
const COUNTED = /(#)([\s  ]+)(тариф|стран|дн|ден|пакет|региональн|локальн|посуточн|гигабайт|plan|countr|day)[a-zа-яё]*/gi;

/** The page with its numbers masked: what must be identical for «only the numbers moved». */
export function maskNumbers(html) {
  return stripAssetStamps(String(html))
    .replace(/\d(?:[\d    .,]*\d)?/g, '#')
    .replace(COUNTED, (m, hash, gap, stem) => `${hash} ${stem.toLowerCase() === 'ден' ? 'дн' : stem.toLowerCase()}`);   // день / дня / дней
}

// For the stage-3 decision only (the verdict above never uses them): two looser
// readings of «the same page», to measure how often a rebuild is only a longer or
// shorter generated LIST — of volumes or terms («1, 3, 5 GB» → «1, 3, 5, 10 GB»)
// or of related destinations (the «also for» links) — rather than new words.
export function maskLists(masked) {
  return String(masked)
    .replace(/#(?:\s*,\s*#)*(?:\s*(?:и|and|y|und|et|e|和|및)\s*#)?/g, '#')
    .replace(/#[\s\u00a0]*([^\s,<#]+)(?:\s*,\s*#[\s\u00a0]*[^\s,<#]+)+/g, '#list $1');
}
export function maskRelated(masked) {
  return maskLists(masked)
    .replace(/<li><a href="[^"]*\/esim\/[a-z-]+\/">[^<]*<\/a><\/li>/g, '<li>@</li>')
    .replace(/(?:\s*<li>@<\/li>)+/g, '<li>@</li>');
}

const claimKey = (e) => [e.slug, e.source, e.id, e.field].join('|');
const sitemapLocs = (xml) => [...String(xml || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
const slugsOf = (doc) => ((doc && doc.countries) || []).map((c) => c.slug).sort();
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** The first place two masked pages differ, a short window around it, for the report. */
function firstDifference(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const cut = (s) => s.slice(Math.max(0, i - 60), i + 60).replace(/\s+/g, ' ');
  return { before: cut(a), after: cut(b) };
}

/**
 * PURE. The verdict on one rebuild.
 * @param {object} x
 * @param {string} x.porcelain     `git status --porcelain -uall` after the rebuild
 * @param {string} x.gates         the gates step's outcome ('success' | anything else)
 * @param {string} x.browser       the browser step's outcome
 * @param {(path: string) => string|null} x.before  the file as it was on main (null = absent)
 * @param {(path: string) => string|null} x.after   the file as rebuilt (null = absent)
 */
export function classify(x) {
  const reasons = [];
  const add = (code, detail) => reasons.push(detail === undefined ? { code } : { code, detail });
  const lines = String(x.porcelain || '').split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.length > 3);
  const changed = parsePorcelain(x.porcelain);

  if (x.gates !== 'success') add('gates_not_green', String(x.gates || 'unknown'));
  if (x.browser !== 'success') add('browser_not_green', String(x.browser || 'unknown'));

  // 2. paths
  const statuses = lines.map((l) => l.slice(0, 2));
  const odd = lines.filter((l) => l.slice(0, 2) !== ' M' && l.slice(0, 2) !== 'M ' && l.slice(0, 2) !== 'MM');
  if (odd.length) add('file_added_or_deleted', odd.slice(0, 10).map((l) => l.trim()));
  let afterCountries = null;
  try { afterCountries = JSON.parse(x.after('seo/catalogue-countries.json')); } catch (_) { /* below */ }
  if (!afterCountries) add('unreadable', 'seo/catalogue-countries.json');
  else {
    const bad = unexpectedPaths(changed, slugsOf(afterCountries));
    if (bad.length) add('path_outside_allowlist', bad.slice(0, 10));
  }

  // 3. pages and URLs
  let beforeCountries = null;
  try { beforeCountries = JSON.parse(x.before('seo/catalogue-countries.json')); } catch (_) { add('unreadable', 'seo/catalogue-countries.json (main)'); }
  if (beforeCountries && afterCountries) {
    const a = slugsOf(beforeCountries); const b = slugsOf(afterCountries);
    if (!sameList(a, b)) add('pages_changed', { added: b.filter((s) => !a.includes(s)), removed: a.filter((s) => !b.includes(s)) });
  }
  const urlsBefore = sitemapLocs(x.before('sitemap.xml')); const urlsAfter = sitemapLocs(x.after('sitemap.xml'));
  if (!urlsBefore.length || !urlsAfter.length) add('unreadable', 'sitemap.xml');
  else if (!sameList(urlsBefore, urlsAfter)) {
    add('urls_changed', { added: urlsAfter.filter((u) => !urlsBefore.includes(u)), removed: urlsBefore.filter((u) => !urlsAfter.includes(u)) });
  }

  // 4. suppressed claims
  let supBefore = null; let supAfter = null;
  try { supBefore = JSON.parse(x.before('seo/suppressed-claims.json')).entries || []; } catch (_) { add('unreadable', 'seo/suppressed-claims.json (main)'); }
  try { supAfter = JSON.parse(x.after('seo/suppressed-claims.json')).entries || []; } catch (_) { add('unreadable', 'seo/suppressed-claims.json'); }
  if (supBefore && supAfter) {
    const a = new Set(supBefore.map(claimKey)); const b = new Set(supAfter.map(claimKey));
    const added = [...b].filter((k) => !a.has(k)); const removed = [...a].filter((k) => !b.has(k));
    if (added.length || removed.length) add('suppressed_claims_changed', { added: added.slice(0, 20), removed: removed.slice(0, 20), now: b.size });
  }

  // 5. text, page by page
  const pages = changed.filter((p) => p.endsWith('.html'));
  const textChanged = [];
  let numbersOnly = 0; let listsOnly = 0; let relatedOnly = 0;
  for (const p of pages) {
    const a = x.before(p); const b = x.after(p);
    if (a == null || b == null) continue;   // added / deleted: already a reason above
    const ma = maskNumbers(a); const mb = maskNumbers(b);
    if (ma === mb) { numbersOnly += 1; continue; }
    if (maskLists(ma) === maskLists(mb)) listsOnly += 1;
    else if (maskRelated(ma) === maskRelated(mb)) relatedOnly += 1;
    else {
      const la = maskRelated(ma); const lb = maskRelated(mb);
      textChanged.push({ page: p, words: true, ...firstDifference(la, lb) });
      continue;
    }
    textChanged.push({ page: p, words: false, ...firstDifference(ma, mb) });
  }
  if (textChanged.length) {
    // The sample shows real wording changes first: those are what a person must read.
    const sample = textChanged.filter((t) => t.words).concat(textChanged.filter((t) => !t.words)).slice(0, 5);
    add('text_changed', { pages: textChanged.length, sample });
  }

  // lastmod: how many dates move now, and how many a number-blind hash would move
  let movedNow = null;
  try {
    const a = JSON.parse(x.before('seo/sitemap-lastmod.json')).pages || {};
    const b = JSON.parse(x.after('seo/sitemap-lastmod.json')).pages || {};
    movedNow = Object.keys(b).filter((k) => a[k] && a[k].lastmod !== b[k].lastmod).length;
  } catch (_) { /* reported as null */ }

  return {
    verdict: reasons.length ? 'review' : 'auto',
    reasons,
    files_changed: changed.length,
    statuses: [...new Set(statuses)].sort(),
    pages: {
      changed: pages.length, numbers_only: numbersOnly, text_changed: textChanged.length,
      // the breakdown of text_changed, for the stage-3 decision (not used by the verdict)
      lists_only: listsOnly, related_links_only: relatedOnly, words: textChanged.filter((t) => t.words).length,
    },
    lastmod: { moved_now: movedNow, moved_if_number_blind: textChanged.length },
  };
}

const TITLES = {
  gates_not_green: 'гейты витрины не зелёные',
  browser_not_green: 'браузерные тесты не зелёные',
  file_added_or_deleted: 'файл добавлен или удалён',
  unreadable: 'файл не прочитан',
  path_outside_allowlist: 'путь вне списка сгенерированных',
  pages_changed: 'изменился набор страниц стран',
  urls_changed: 'изменился набор URL в sitemap',
  suppressed_claims_changed: 'изменился список снятых утверждений',
  text_changed: 'на страницах изменился текст, а не только числа',
  error: 'ошибка классификатора',
};

export function toMarkdown(r) {
  const out = ['### Тень: автопубликация (только запись, ничего не публикует)', ''];
  out.push(r.verdict === 'auto'
    ? '**Вердикт: можно было бы опубликовать автоматически** — изменились только числа.'
    : '**Вердикт: нужен человек** (PR, как сейчас).');
  out.push('');
  out.push(`Файлов: ${r.files_changed}; страниц: ${r.pages.changed}, из них только числа — ${r.pages.numbers_only}, с изменённым текстом — ${r.pages.text_changed}.`);
  if (r.pages.text_changed) {
    out.push(`Из страниц с изменённым текстом: только длина списков объёмов/сроков — ${r.pages.lists_only}, только «связанные направления» — ${r.pages.related_links_only}, слова — ${r.pages.words} (разбивка для решения по этапу 3; на вердикт не влияет).`);
  }
  if (r.lastmod) out.push(`lastmod: сдвинуто сейчас — ${r.lastmod.moved_now ?? 'не определено'}; если бы даты двигал только текст — ${r.lastmod.moved_if_number_blind}.`);
  for (const reason of r.reasons) {
    const d = reason.detail;
    let text = TITLES[reason.code] || reason.code;
    if (reason.code === 'text_changed') text += `: ${d.pages}`;
    else if (reason.code === 'suppressed_claims_changed') text += `: +${d.added.length} / −${d.removed.length}, всего ${d.now}`;
    else if (d && typeof d !== 'object') text += `: ${d}`;
    out.push(`- ${text}`);
    if (reason.code === 'text_changed') {
      // Inside code spans, backticks removed: page text (provider names included)
      // cannot become a link, a mention or markup in the PR body.
      const code = (t) => `\`${String(t).replace(/`/g, "'").replace(/\s+/g, ' ').trim()}\``;
      for (const s of d.sample) out.push(`  - ${code(s.page)}: ${code(`…${s.before}…`)} → ${code(`…${s.after}…`)}`);
    }
  }
  return out.join('\n') + '\n';
}

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = argValue('--out') || '/tmp/seo-shadow';
  let result;
  try {
    const porcelain = readFileSync(argValue('--changed'), 'utf8');
    const before = (p) => { try { return execFileSync('git', ['show', `HEAD:${p}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { return null; } };
    const after = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);
    result = classify({ porcelain, gates: argValue('--gates'), browser: argValue('--browser'), before, after });
  } catch (error) {
    result = { verdict: 'review', reasons: [{ code: 'error', detail: String(error && error.message || error).slice(0, 200) }], files_changed: null, pages: { changed: null, numbers_only: null, text_changed: null }, lastmod: null };
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'shadow.json'), JSON.stringify(result, null, 2) + '\n');
  writeFileSync(join(out, 'shadow.md'), toMarkdown(result));
  const brief = { verdict: result.verdict, reasons: result.reasons.map((r) => r.code), pages: result.pages, lastmod: result.lastmod };
  console.log(`SEO_SHADOW ${JSON.stringify(brief)}`);
  // Shadow mode: never a failure, whatever happened above.
  process.exit(0);
}
