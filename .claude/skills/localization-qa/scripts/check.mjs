#!/usr/bin/env node
// The deterministic half of a localization QA run: checks a script can make with certainty, before any model reads a
// string. Language-specific settings live in references/<lang>/ (style.json, glossary.json) — never in this file.
//
//   node .claude/skills/localization-qa/scripts/check.mjs --items <items.json> --out <findings.json>
//
// Every finding has the report's shape (references/rubric.md) with source "check". Read-only: it changes nothing.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = resolve(HERE, '..');
const ROOT = resolve(SKILL, '../../..');

const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort();
const sentences = (s) => String(s).split(/(?<=[.!?…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);

export function loadLanguage(lang) {
  const dir = join(SKILL, 'references', lang);
  if (!existsSync(join(dir, 'style.json'))) throw new Error(`no references/${lang}/style.json — add the language first (references/_template/)`);
  const style = JSON.parse(readFileSync(join(dir, 'style.json'), 'utf8'));
  const glossary = existsSync(join(dir, 'glossary.json')) ? JSON.parse(readFileSync(join(dir, 'glossary.json'), 'utf8')) : { terms: [], doNotTranslate: [] };
  return { style, glossary };
}

export async function check(run, root = ROOT) {
  const { lang, items } = run;
  const { style, glossary } = loadLanguage(lang);
  const { rulesFor, SOURCED = {} } = await import(pathToFileURL(join(root, 'seo/claim-guards.mjs')).href);
  // sentences the owner allowed whole, with a source (seo/claim-guards.mjs SOURCED) — decided, never a claim finding
  const sourced = (SOURCED[lang] || []).map((x) => x.sentence);
  const { countryName } = await import(pathToFileURL(join(root, 'seo/country-names-i18n.mjs')).href).catch(() => ({ countryName: null }));
  const findings = [];
  const add = (it, f) => findings.push({ item_id: it.id, group: it.group, key: it.key, where: it.where, url: it.url, en: it.en, target: it.target,
    suggestion: '', source: 'check', ...f });
  // Chinese (style.json `cjk`) writes no space between words: a letter-edged pattern never matches inside a Chinese
  // sentence, so glossary and consistency would report every string. There only a Latin letter or a digit ends a term
  // (seo/claim-guards.mjs hanWord, ZH-1 T1).
  const word = style.cjk
    ? (src) => new RegExp(`(?<![\\p{Script=Latin}\\p{N}])(?:${src})(?![\\p{Script=Latin}\\p{N}])`, 'iu')
    : (src) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`, 'iu');
  // SEO budgets: characters, or display width (style.json `seo.widthUnits`) — a Chinese character is about twice a Latin
  // letter, and search engines cut by pixels (seo/page-copy.mjs displayWidth, ZH-1 T2).
  const WIDE = /[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u;
  const units = (x) => ((style.seo || {}).widthUnits ? [...String(x)].reduce((w, ch) => w + (WIDE.test(ch) ? 2 : 1), 0) : String(x).length);
  const unitName = (style.seo || {}).widthUnits ? 'display units (a Chinese character counts 2)' : 'characters';

  for (const it of items) {
    const t = it.target;
    if (t == null || t === '') { add(it, { category: 'accuracy', severity: 'critical', confidence: 1, rule: 'missing', explanation: 'No translation: the page shows another language (or a key) here.' }); continue; }
    if (it.kind === 'technical') continue;

    // 1. placeholders — filled in at runtime; a lost or renamed one breaks the sentence
    const a = placeholders(it.en).join(' '), b = placeholders(t).join(' ');
    if (a !== b) add(it, { category: 'placeholder', severity: 'critical', confidence: 1, rule: 'placeholders', explanation: `Placeholders differ: source ${a || '—'}, translation ${b || '—'}.` });

    // 2. untranslated
    if (t === it.en && it.kind !== 'country-name' && /[a-z]{3,}/i.test(t) && !(style.sameAsEnglishAllowed || []).includes(t)) {
      add(it, { category: 'accuracy', severity: 'major', confidence: 0.7, rule: 'untranslated', explanation: 'The translation is identical to the English source.' });
    }

    // 3. SEO lengths (Google truncates by pixels; these are the usual character budgets)
    const seo = style.seo || {};
    if (it.kind === 'seo-title' && seo.titleMax && units(t) > seo.titleMax) {
      add(it, { category: 'seo', severity: units(t) > seo.titleMax + 10 ? 'major' : 'minor', confidence: 0.9, rule: 'seo-title-length',
        explanation: `Title is ${units(t)} ${unitName} (budget ${seo.titleMax}; English ${it.en.length}). Search results will likely cut it.` });
    }
    if (it.kind === 'seo-description' && seo.descriptionMax && units(t) > seo.descriptionMax) {
      add(it, { category: 'seo', severity: 'minor', confidence: 0.8, rule: 'seo-description-length',
        explanation: `Description is ${units(t)} ${unitName} (budget ${seo.descriptionMax}; English ${it.en.length}).` });
    }

    // 4. claims the site may not make (the storefront's own rules, seo/claim-guards.mjs)
    const kinds = it.group.startsWith('guide-') ? ['guide'] : it.group === 'page' && /^home/.test(it.key) ? ['home'] : it.group === 'page' && /country|local|regional|daily|jump/.test(it.key) ? ['country'] : it.group === 'daily' ? ['country'] : [];
    for (const kind of kinds) {
      for (const [id, re] of rulesFor(lang, kind)) {
        const m = sourced.reduce((x, sen) => x.split(sen).join(' '), t).match(re);
        if (m && !re.test(it.en)) add(it, { category: 'claim', severity: 'critical', confidence: 0.85, rule: `claim-guards:${id}`,
          explanation: `«${m[0]}» is a claim the storefront may not make (${id}); the English source does not make it.` });
      }
    }

    // 5. do-not-translate tokens: present in the source → present in the translation
    for (const tok of glossary.doNotTranslate || []) {
      if (it.en.includes(tok) && !t.includes(tok)) add(it, { category: 'terminology', severity: 'major', confidence: 0.9, rule: 'do-not-translate',
        explanation: `«${tok}» is never translated or altered, and it is missing here.` });
    }

    // 6. glossary: a preferred term's avoided variants
    for (const term of glossary.terms || []) {
      for (const bad of term.avoid || []) {
        const m = t.match(word(bad));
        if (m) add(it, { category: 'terminology', severity: term.severity || 'minor', confidence: 0.8, rule: `glossary:${term.en}`,
          suggestion: '', explanation: `«${m[0]}»: the glossary uses «${term.target}» for «${term.en}»${term.why ? ` — ${term.why}` : ''}.` });
      }
    }

    // 7. register and variant (style.json)
    for (const f of style.forbidden || []) {
      const m = t.match(new RegExp(f.pattern, 'iu'));
      if (m) add(it, { category: f.category || 'style-variant', severity: f.severity || 'minor', confidence: f.confidence ?? 0.8, rule: `style:${f.id}`,
        explanation: `«${m[0]}»: ${f.reason}` });
    }

    // 8. punctuation
    if (style.invertedPunctuation) {
      for (const s of sentences(t)) {
        if (/\?$/.test(s) && !s.includes('¿')) add(it, { category: 'punctuation', severity: 'minor', confidence: 0.9, rule: 'inverted-question', explanation: `A question without the opening «¿»: «${s.slice(0, 60)}».` });
        if (/!$/.test(s) && !s.includes('¡')) add(it, { category: 'punctuation', severity: 'minor', confidence: 0.9, rule: 'inverted-exclamation', explanation: `An exclamation without the opening «¡»: «${s.slice(0, 60)}».` });
      }
    }
    if (/ {2,}/.test(t.replace(/\n/g, ''))) add(it, { category: 'punctuation', severity: 'minor', confidence: 1, rule: 'double-space', explanation: 'Two spaces in a row.' });
    // French puts a NO-BREAK space before «: ; ? !» (style.json `frenchSpacing`): there only a comma or full stop after a
    // space is wrong, and a PLAIN space before «: ; ? !» is the style rule `plain-space-before-punct`.
    const beforePunct = style.frenchSpacing ? /\s[,.](?!\d)/ : /\s[,.;:!?](?!\d)/;
    if (beforePunct.test(t) && !/ :$/.test(t)) add(it, { category: 'punctuation', severity: 'minor', confidence: 0.7, rule: 'space-before-punctuation', explanation: 'A space before a punctuation mark.' });

    // 9. country names: the CLDR name the generator prints, and no two countries sharing one
    if (it.kind === 'country-name' && countryName) {
      let cldr = null; try { cldr = countryName(it.key, lang); } catch { /* a code CLDR does not know: nothing to compare */ }
      if (cldr && cldr !== t) add(it, { category: 'country-name', severity: 'major', confidence: 0.9, rule: 'cldr', explanation: `Differs from the CLDR name «${cldr}».` });
    }
  }
  const byName = {};
  for (const it of items.filter((x) => x.kind === 'country-name')) (byName[it.target] ||= []).push(it);
  for (const [name, its] of Object.entries(byName)) if (its.length > 1) for (const it of its) add(it, { category: 'country-name', severity: 'major', confidence: 1, rule: 'duplicate-name', explanation: `«${name}» names ${its.length} countries (${its.map((x) => x.key).join(', ')}).` });

  // 10. consistency: one English term, one translation, across the interface (glossary terms only — evidence, not guesses)
  for (const term of glossary.terms || []) {
    if (!term.consistency) continue;
    const hits = items.filter((x) => x.target && word(term.en).test(x.en) && x.kind !== 'technical');
    const miss = hits.filter((x) => !word(term.target).test(x.target) && !(term.alsoAccept || []).some((alt) => word(alt).test(x.target)));
    for (const it of miss) add(it, { category: 'consistency', severity: 'minor', confidence: 0.55, rule: `consistency:${term.en}`,
      explanation: `The source says «${term.en}»; elsewhere it is «${term.target}», here neither it nor an accepted variant appears. Check whether the meaning is kept.` });
  }
  return findings.map((f, i) => ({ id: `C${String(i + 1).padStart(4, '0')}`, ...f }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
  const run = JSON.parse(readFileSync(arg('--items'), 'utf8'));
  const f = await check(run, arg('--root') ? resolve(arg('--root')) : ROOT);
  writeFileSync(arg('--out'), JSON.stringify(f, null, 1));
  const by = {}; for (const x of f) by[`${x.severity}/${x.rule.split(':')[0]}`] = (by[`${x.severity}/${x.rule.split(':')[0]}`] || 0) + 1;
  console.error(`${run.lang}: ${f.length} deterministic findings`, JSON.stringify(by));
}
