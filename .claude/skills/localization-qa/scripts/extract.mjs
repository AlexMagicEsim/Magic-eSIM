#!/usr/bin/env node
// Every published string of one site language beside its English source — the input of a localization QA run.
//
//   node .claude/skills/localization-qa/scripts/extract.mjs --lang es [--out <file>]
//
// Reads the storefront's own sources (never the built HTML, never the network): the browser dictionary
// (assets/site-i18n.js), the build-time page words (seo/page-copy.mjs), the daily-plan card table
// (assets/daily-plan-copy.js), the guides (seo/build-locale-pages.mjs GUIDES_BY_LOCALE), the 404 table (404.html) and the
// generated destination list (<prefix>/destinations.js). The language must be published (seo/locales.mjs). Read-only.
//
// Item shape: { id, group, kind, key, where, url, en, target, note }
//   kind — what the string is, for the rubric: ui | seo-title | seo-description | heading | body | daily | guide-step |
//          faq-q | faq-a | country-name | technical
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../../../..');
const LIVE = 'https://magicesim.store';

export async function extract(lang, root = ROOT) {
  const require = createRequire(join(root, 'package.json'));
  const imp = (rel) => import(pathToFileURL(join(root, rel)).href);
  const { locale } = await imp('seo/locales.mjs');
  const L = locale(lang);
  if (!L || !L.prefix) throw new Error(`extract: ${lang} is not a prefixed site language`);
  if (!L.site.enabled) throw new Error(`extract: ${lang} is not published — nothing to review`);
  const P = `/${L.prefix}`;
  const SITE = require(join(root, 'assets/site-i18n.js'));
  const { PAGE_COPY } = await imp('seo/page-copy.mjs');
  const { GUIDES_BY_LOCALE } = await imp('seo/build-locale-pages.mjs');
  const items = [];
  const add = (o) => items.push({ id: `${o.group}:${o.key}`, note: '', ...o });

  // 1. Interface words
  const WHERE = [[/^nav\./, 'header menu', '/'], [/^(checkout|quote|pay)\./, 'checkout window (country page → plan)', '/esim/thailand/'],
    [/^home\./, 'home', '/'], [/^plan\./, 'plan cards (country page)', '/esim/thailand/'], [/^hub\./, 'destination list search', '/esim/'],
    [/^how\./, 'home → how it works', '/#how'], [/^footer\./, 'footer', '/'], [/^(preview|price)\./, 'payment notice under the header', '/esim/thailand/'],
    [/^lang\./, 'language switch', '/'], [/^fmt\./, 'number format (technical)', '/esim/thailand/'], [/^site\./, 'several pages', '/']];
  for (const [k, en] of Object.entries(SITE.DICT.en)) {
    const [, where, path] = WHERE.find(([re]) => re.test(k)) || [null, 'several pages', '/'];
    add({ group: 'ui', kind: k.startsWith('fmt.') || k.startsWith('lang.') ? 'technical' : 'ui', key: k, where, url: LIVE + P + path,
      en: String(en), target: SITE.DICT[lang] && k in SITE.DICT[lang] ? String(SITE.DICT[lang][k]) : null,
      note: k.startsWith('fmt.') ? 'Locale tag, not prose.' : k.startsWith('lang.') ? 'A language\'s own name: never translated.' : '' });
  }

  // 2. Page words (build time)
  const show = (x, nm) => (typeof x === 'function' ? x(nm) : Array.isArray(x) ? x.join(' · ') : String(x));
  const sampleName = { en: 'Thailand' };
  const { countryName } = await imp('seo/country-names-i18n.mjs').catch(() => ({ countryName: null }));
  const targetSample = countryName ? countryName('TH', lang) : 'Thailand';
  for (const [k, v] of Object.entries(PAGE_COPY.en)) {
    const t = PAGE_COPY[lang] ? PAGE_COPY[lang][k] : undefined;
    if (k === 'popular') { add({ group: 'page', kind: 'technical', key: k, where: 'popular destinations (home, list, footer)', url: LIVE + P + '/', en: v.map((p) => p.name).join(', '), target: t ? t.map((p) => p.name).join(', ') : null, note: 'A selection for this audience; names are CLDR.' }); continue; }
    if (k === 'quick') { add({ group: 'page', kind: 'technical', key: k, where: 'quick links under the home search', url: LIVE + P + '/', en: v.join(', '), target: t ? t.join(', ') : null, note: 'ISO codes.' }); continue; }
    const kind = /Title$|^countryTitle$|^homeTitle$/.test(k) ? 'seo-title' : /Description$/.test(k) && k !== 'homeOgDescription' ? 'seo-description' : /H1$|^h1$/.test(k) ? 'heading' : 'ui';
    const where = /^home/.test(k) ? 'home' : /^hub/.test(k) ? 'destination list' : /^guides|^questions|^onThisPage|^related|^chooseDestination/.test(k) ? 'guides' : /^(country|local|regional|daily|jump|planTypes|chooseAnother|noscript|beforeYouBuy)/.test(k) ? 'country page (sample: Thailand)' : /^(yourPlan|esimFor|steps)$/.test(k) ? 'checkout window' : 'header / accessibility';
    const path = where.startsWith('country') || where.startsWith('checkout') ? '/esim/thailand/' : where === 'destination list' ? '/esim/' : where === 'guides' ? '/guides/' : '/';
    add({ group: 'page', kind, key: k, where, url: LIVE + P + path, en: show(v, sampleName.en), target: t === undefined ? null : show(t, targetSample) });
  }

  // 3. Daily-plan cards
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readFileSync(join(root, 'assets/daily-plan-copy.js'), 'utf8').replace('  var LANGS = Object.keys(COPY);', '  var LANGS = Object.keys(COPY); root.__COPY = COPY;'), ctx);
  const C = ctx.__COPY;
  if (C[lang]) {
    for (const k of ['blockTitle', 'allowance', 'throttle', 'reset', 'term', 'perDay']) {
      add({ group: 'daily', kind: 'daily', key: k, where: 'daily plan card', url: LIVE + P + '/esim/thailand/#dailyBlock', en: C.en[k], target: C[lang][k], note: '{a} amount (1 GB), {s} speed, {n} number, {days} day/days.' });
    }
    for (const [ru, en] of Object.entries(C.en.places)) add({ group: 'daily', kind: 'daily', key: `place:${en}`, where: 'daily plan card title («Region — 1 GB a day»)', url: LIVE + P + '/esim/thailand/#dailyBlock', en, target: C[lang].places[ru] });
    const D = ctx.MagicDailyPlan;
    const sample = { plan_type: 'DAILY', daily_gb: 1.5, daily_throttle_label: '512 Kbps', daily_reset_confirmed: true, daily_term_mode: 'FIXED_TERM', validity_days: 3 };
    add({ group: 'daily', kind: 'daily', key: 'sample-card', where: 'a whole daily card, as rendered', url: LIVE + P + '/esim/thailand/#dailyBlock', en: D.lines(sample, 'en').map((l) => l.text).join(' | '), target: D.lines(sample, lang).map((l) => l.text).join(' | ') });
  }

  // 4. Guides
  const plain = (h) => String(h).replace(/<li>/g, '\n• ').replace(/<strong>([^<]*)<\/strong>/g, '**$1**').replace(/<a [^>]*>([^<]*)<\/a>/g, '$1').replace(/<[^>]+>/g, '').replace(/[ \t]+/g, ' ').replace(/\n\s+/g, '\n').trim();
  const EN = GUIDES_BY_LOCALE.en; const T = GUIDES_BY_LOCALE[lang] || [];
  for (const [i, en] of EN.entries()) {
    const t = T.find((g) => g.slug === en.slug); const url = `${LIVE}${P}/guides/${en.slug}/`; const group = `guide-${en.slug}`;
    for (const k of ['title', 'description', 'h1', 'blurb', 'lead', 'nav']) {
      add({ group, kind: k === 'title' ? 'seo-title' : k === 'description' ? 'seo-description' : k === 'h1' ? 'heading' : 'body', key: k, where: `guide «${en.h1}»`, url, en: en[k], target: t ? t[k] : null });
    }
    en.sections.forEach((s, j) => {
      const ts = t && t.sections[j];
      add({ group, kind: 'heading', key: `s${j + 1}.h2`, where: `guide «${en.h1}», section ${j + 1} heading (H2)`, url: `${url}#${ts && ts.id || ''}`, en: s.h2, target: ts ? ts.h2 : null });
      add({ group, kind: 'guide-step', key: `s${j + 1}.body`, where: `guide «${en.h1}», section ${j + 1}`, url: `${url}#${ts && ts.id || ''}`, en: plain(s.html), target: ts ? plain(ts.html) : null,
        note: /\*\*/.test(plain(s.html)) && /^(iphone|android|compatibility)$/.test(en.slug) ? 'Bold = an on-screen label; must match the vendor\'s own documentation in this language (references/<lang>/platform-labels.md).' : '' });
    });
    en.faq.forEach((f, j) => {
      const tf = t && t.faq[j];
      add({ group, kind: 'faq-q', key: `faq${j + 1}.q`, where: `guide «${en.h1}», question ${j + 1}`, url: `${url}#faq`, en: f.q, target: tf ? tf.q : null });
      add({ group, kind: 'faq-a', key: `faq${j + 1}.a`, where: `guide «${en.h1}», answer ${j + 1}`, url: `${url}#faq`, en: f.a, target: tf ? tf.a : null });
    });
  }

  // 5. 404
  const nf = readFileSync(join(root, '404.html'), 'utf8');
  const block = (code) => { const at = nf.indexOf(`      ${code}: {`); return at < 0 ? {} : Object.fromEntries([...nf.slice(at).split('}')[0].matchAll(/(\w+): '([^']*)'/g)].map((m) => [m[1], m[2]])); };
  const e4 = block('en'), t4 = block(L.prefix);
  for (const k of ['title', 'h1', 'desc', 'home', 'all']) add({ group: '404', kind: k === 'title' ? 'seo-title' : k === 'h1' ? 'heading' : 'ui', key: k, where: 'page not found', url: `${LIVE}${P}/nope/`, en: e4[k], target: t4[k] ?? null });

  // 6. Country names (the destinations with a page)
  const list = (rel) => [...readFileSync(join(root, rel), 'utf8').matchAll(/iso: "([A-Z]{2})", slug: "([a-z0-9-]+)", name: "([^"]+)"/g)].map((m) => ({ iso: m[1], slug: m[2], name: m[3] }));
  const enN = Object.fromEntries(list('en/destinations.js').map((c) => [c.iso, c.name]));
  for (const c of list(`${L.prefix}/destinations.js`)) add({ group: 'countries', kind: 'country-name', key: c.iso, where: 'country name (list, page title, H1, plan cards)', url: `${LIVE}${P}/esim/${c.slug}/`, en: enN[c.iso], target: c.name });

  return { lang, prefix: L.prefix, htmlLang: L.htmlLang, items };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const lang = arg('--lang'); if (!lang) { console.error('usage: extract.mjs --lang <code> [--out file]'); process.exit(2); }
  const r = await extract(lang, arg('--root') ? resolve(arg('--root')) : ROOT);   // --root: review another checkout of the site
  const out = arg('--out');
  if (out) writeFileSync(out, JSON.stringify(r, null, 1)); else process.stdout.write(JSON.stringify(r));
  const by = {}; for (const it of r.items) by[it.group] = (by[it.group] || 0) + 1;
  console.error(`${lang}: ${r.items.length} strings`, JSON.stringify(by));
}
