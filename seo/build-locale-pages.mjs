#!/usr/bin/env node
/* The locale pages: /<prefix>/esim/<slug>/, the list /<prefix>/esim/, the
 * guides /<prefix>/guides/…, and the home's destination list
 * <prefix>/destinations.js — for ANY site language of seo/locales.mjs other
 * than the root one (Russian has its own generator, build-catalogue-pages.mjs).
 *
 * I18N-08: this was build-en-pages.mjs, English-only. It is now a factory,
 * `localeGenerator(code)`, that takes everything language-specific from three
 * places and nothing from a literal:
 *   - the route prefix, <html lang>, og:locale, collation, write paths and
 *     canonical URLs — seo/locales.mjs;
 *   - the words the browser re-applies at runtime — assets/i18n/<code>.js, read
 *     through seo/site-dictionary.mjs; the page loads that language's bundle
 *     /assets/site-i18n-<prefix>.js (seo/site-i18n-bundle.mjs, written by build());
 *   - the words fixed at build time (titles, headings, labels) —
 *     seo/page-copy.mjs.
 * The intl layer's own assets (/en/en.css, /en/checkout.css, /en/plans.js, …)
 * stay where they are: they are shared files, not routes of a language.
 *
 * IT REFUSES TO BUILD A LANGUAGE THAT IS NOT PUBLISHED. A language that is not
 * `site.enabled` in seo/locales.mjs, or has no page copy, no guides or no
 * country names, throws — so a new locale cannot appear by accident. Today
 * exactly one language passes: English, and seo/build-en-pages.mjs builds it
 * byte-for-byte as before (seo/test-locale-pages.mjs, seo/test-en-pages.mjs).
 *
 * WHAT A PAGE CARRIES, AND WHAT IT DELIBERATELY DOES NOT (unchanged):
 *   * No price, no plan, no count — the browser fills the blocks from the
 *     GLOBAL catalogue (US dollars).
 *   * No claim. A country page is a TEMPLATE, so `noindex, follow`, out of the
 *     sitemap, no hreflang — until a reviewed text, the sitemap entry and the
 *     reciprocal hreflang ship together (PR 8 / I18N-09).
 * Deterministic: no clock, no network, sorted input.
 *
 * Run: node seo/build-locale-pages.mjs   (builds every enabled non-root language)
 *      node seo/build-en-pages.mjs       (English only — what build-all.mjs runs)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { COUNTRY_NAMES } from './country-names.mjs';
import { stampHtml } from './asset-version.mjs';
import { EN_GUIDES } from './guides-en.mjs';
import { ES_GUIDES } from './guides-es.mjs';
import { DE_GUIDES } from './guides-de.mjs';
import { FR_GUIDES } from './guides-fr.mjs';
import { ZH_GUIDES } from './guides-zh.mjs';
import { KO_GUIDES } from './guides-ko.mjs';
import { FONT_PRELOAD, LOGO, LOGO_ANIMATED_EN, LOGO_ONCE_SCRIPT, LOGO_ONCE_SCRIPT_MOTION, ICON_GLOBE, ICON_MENU, SEARCH_ICON, BLOCK_ICON, GUIDE_ICON } from './site-chrome.mjs';
import { word, escapeText, escapeAttr } from './site-dictionary.mjs';
import { countryName } from './country-names-i18n.mjs';
import { namesFile, globalSuffix } from './build-country-dictionary-locale.mjs';
import { LOCALES, locale, homeUrl, X_DEFAULT_CURRENT } from './locales.mjs';
import { homePage as renderHome } from './home-page.mjs';
import { missingGuards } from './claim-guards.mjs';
import { PAGE_COPY } from './page-copy.mjs';
import { GUIDE_RU, alternateLinks, robotsFor } from './indexing.mjs';
import { siteI18nBundle, writeSiteI18nBundle, wordsFile } from './site-i18n-bundle.mjs';
import { legalLinks, LEGAL_SCHEME, INTL_LEGAL } from './legal-links.mjs';
import { LEGAL_TRANSLATIONS } from './legal-i18n.mjs';
import { snapshots as legalSnapshots, archivePath, versionNumber, versionsJson, VERSIONS_JSON } from './legal-archive.mjs';
import { PRIVACY, PRIVACY_VERSION, PRIVACY_EFFECTIVE, PRIVACY_EFFECTIVE_ISO } from './privacy-en.mjs';
import { TERMS, TERMS_VERSION, TERMS_EFFECTIVE, TERMS_EFFECTIVE_ISO } from './terms-en.mjs';
import { REFUND, REFUND_VERSION, REFUND_EFFECTIVE, REFUND_EFFECTIVE_ISO } from './refund-en.mjs';

export { FONT_PRELOAD, LOGO };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://magicesim.store';

/* The primary API origin, read from the one file that names it
 * (assets/magic-net.js, ENDPOINTS[0]). The country pages' CSP allows exactly
 * this origin for connections — so the GLOBAL catalogue and quotes cannot reach
 * the fallback gateway even by mistake (owner's decision D1). */
export function primaryApiOrigin() {
  const src = readFileSync(join(ROOT, 'assets/magic-net.js'), 'utf8');
  const m = src.match(/name: 'render', base: '(https:\/\/[a-z0-9.-]+)'/);
  if (!m) throw new Error('assets/magic-net.js: the primary endpoint was not found');
  return m[1];
}

/* A Content-Security-Policy per page kind. No 'unsafe-inline' anywhere: the EN
 * pages carry no inline script, style or handler (the JSON-LD block on /en/ is
 * data, not script). Pages that call no API get connect-src 'none'. */
export function cspMeta(connect) {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">
<meta name="referrer" content="strict-origin-when-cross-origin">`;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* Shared chrome: every page of a prefixed language, its home included (seo/home-page.mjs), carries the same
 * header, notice and footer; the tests compare the notice word for word. */
const HEAD_ICONS = `<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/site.webmanifest" />`;

/* INDEXING (I18N-09): seo/indexing.mjs decides, per page and language, whether search engines are offered the page and
 * which pages are its twins. An indexed page says `index, follow` and lists its cluster (every indexed twin + x-default
 * → English); any other page stays `noindex, follow` with no alternate and out of the sitemap. */
const NOINDEX_NOTE = `<!-- Not offered to search engines yet (noindex): a page outside the indexing stage of
     seo/indexing.mjs is not in the sitemap and has no hreflang twin. «follow» keeps its links crawlable. -->`;
const INDEX_NOTE = `<!-- Indexed (seo/indexing.mjs): in the sitemap, with the hreflang cluster of its indexed
     twins in every language and x-default → English. -->`;
const indexingHead = (code, page) => {
  const alts = alternateLinks(page);
  if (robotsFor(code, page) === 'index, follow' && alts) return `${INDEX_NOTE}\n<meta name="robots" content="index, follow">\n${alts}`;
  return `${NOINDEX_NOTE}\n<meta name="robots" content="noindex, follow">`;
};



/* The letter a destination is filed under: its English name's first letter,
 * accents stripped («Åland Islands» → A, «Réunion» → R). */
export const azLetter = (name) => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();

/* HOW THE DESTINATION LIST IS INDEXED, per writing system (I18N stage 2).
 *
 * A Latin-script language files a name under its first letter, accents stripped, and jumps A–Z — the
 * English list, unchanged. Chinese has no letters to strip to: a Chinese reader's A–Z list is by the first
 * letter of the PINYIN reading (the order of every Chinese contact and city picker); ICU's pinyin collation
 * gives that order, and the first syllable of each initial, in that order, marks where a letter begins
 * (pinyin has no I, U or V initial). A collation reads a character, not a word, so a name whose first
 * character has another reading here is pinned in ZH_READING by a name with the same reading: 秘鲁 is
 * Bìlǔ, not mì. Korean files a name under the initial consonant of its first syllable, ㄱ … ㅎ, doubled
 * consonants under their single one — the order of a Korean dictionary. Anchors (`az-…`) stay ASCII in
 * every language. This runs at build time only; the browser receives finished groups. Before it, a Chinese
 * list came out as 119 one-character groups and a Korean one as one group per syllable. */
const PINYIN_STARTS = [['A', '阿'], ['B', '八'], ['C', '嚓'], ['D', '哒'], ['E', '妸'], ['F', '发'], ['G', '旮'], ['H', '哈'],
  ['J', '丌'], ['K', '咔'], ['L', '垃'], ['M', '妈'], ['N', '拏'], ['O', '噢'], ['P', '妑'], ['Q', '七'], ['R', '呥'], ['S', '仨'],
  ['T', '他'], ['W', '屲'], ['X', '夕'], ['Y', '丫'], ['Z', '帀']];
export const ZH_READING = Object.freeze({ '秘鲁': '必鲁' });
const HANGUL_INITIALS = [['ㄱ', 'g'], ['ㄴ', 'n'], ['ㄷ', 'd'], ['ㄹ', 'r'], ['ㅁ', 'm'], ['ㅂ', 'b'], ['ㅅ', 's'], ['ㅇ', 'o'],
  ['ㅈ', 'j'], ['ㅊ', 'ch'], ['ㅋ', 'k'], ['ㅌ', 't'], ['ㅍ', 'p'], ['ㅎ', 'h']];
// The 19 initial consonants of a Hangul syllable, in Unicode order, each folded to its index group.
const HANGUL_CHOSEONG = 'ㄱㄱㄴㄷㄷㄹㅁㅂㅂㅅㅅㅇㅈㅈㅊㅋㅌㅍㅎ';
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function listIndex(code) {
  const L = locale(code);
  if (!L) throw new Error(`listIndex: unknown locale ${String(code)}`);
  if (L.script === 'Hans') {
    const collator = new Intl.Collator('zh-Hans-u-co-pinyin');
    const key = (name) => ZH_READING[name] || name;
    return {
      labels: LATIN,
      compare: (a, b) => collator.compare(key(a), key(b)),
      labelOf: (name) => {
        let label = null;
        for (const [l, start] of PINYIN_STARTS) if (collator.compare(key(name).charAt(0), start) >= 0) label = l;
        if (!label) throw new Error(`listIndex: «${name}» sorts before every pinyin letter`);
        return label;
      },
      id: (label) => label.toLowerCase(),
    };
  }
  if (L.script === 'Hang') {
    const ids = new Map(HANGUL_INITIALS);
    return {
      labels: HANGUL_INITIALS.map(([l]) => l),
      compare: (a, b) => a.localeCompare(b, 'ko'),
      labelOf: (name) => {
        const c = String(name).charCodeAt(0);
        if (!(c >= 0xAC00 && c <= 0xD7A3)) throw new Error(`listIndex: «${name}» does not start with a Hangul syllable`);
        return HANGUL_CHOSEONG.charAt(Math.floor((c - 0xAC00) / 588));
      },
      id: (label) => ids.get(label),
    };
  }
  if (L.script !== 'Latn') throw new Error(`listIndex: no index for script ${L.script} (${code})`);
  return {
    labels: LATIN,
    compare: (a, b) => a.localeCompare(b, L.code),
    labelOf: (name) => {
      const label = azLetter(name);
      if (!LATIN.includes(label)) throw new Error(`listIndex: «${name}» is filed under «${label}», which is not A–Z`);
      return label;
    },
    id: (label) => label.toLowerCase(),
  };
}


/* The Russian twin of each guide — the language switch and the hreflang clusters (seo/indexing.mjs holds it). */
export { GUIDE_RU };

/* One icon per guide, for its card and its hero. Decorative only. */
const guideIcon = (slug) => {
  if (!GUIDE_ICON[slug]) throw new Error(`guide ${slug} has no icon`);
  return GUIDE_ICON[slug];
};

/* A section heading's anchor: its own words, lower-cased, so the «On this
 * page» links are stable and readable. Two equal headings would collide, so
 * that is refused rather than silently suffixed. */
export const sectionId = (h2) => h2.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* The anchor a guide section gets: the guide's own `id` when it gives one, else
 * one made from the heading. A heading with no Latin letters or digits (Chinese,
 * Korean) makes no anchor at all — the guide must name it (`id: 'install'`), and
 * the build refuses until it does rather than linking «On this page» to "#". */
export function guideSectionId(section, slug) {
  const id = section.id !== undefined ? String(section.id) : sectionId(section.h2);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`guide ${slug}: section «${section.h2}» has no usable anchor («${id}») — give it an \`id\` (a-z, 0-9, -)`);
  }
  return id;
}

function write(rel, text) {
  const file = join(ROOT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

/* The languages the shared daily-plan copy speaks: a country page in any other would print its daily cards in Russian. */
export const DAILY_COPY_LANGS = Object.freeze(createRequire(import.meta.url)('../assets/daily-plan-copy.js').LANGS.slice());

/* The guides each language has. A language without its own guides is not built. */
export const GUIDES_BY_LOCALE = Object.freeze({ en: EN_GUIDES, es: ES_GUIDES, de: DE_GUIDES, fr: FR_GUIDES, 'zh-Hans': ZH_GUIDES, ko: KO_GUIDES });

/* Why a language cannot be built, or null. Pure — the tests call it. */
export function cannotBuild(code) {
  const L = locale(code);
  if (!L) return `unknown locale ${String(code)}`;
  if (!L.prefix) return `${code} is the root language; build-catalogue-pages.mjs builds it`;
  if (!L.site.enabled) return `${code} is not enabled for the site (seo/locales.mjs) — refusing to publish it`;
  if (!PAGE_COPY[code]) return `${code} has no page copy (seo/page-copy.mjs)`;
  if (!GUIDES_BY_LOCALE[code]) return `${code} has no guides`;
  if (!LEGAL_SCHEME[code]) return `${code} has no legal-link scheme (seo/legal-links.mjs)`;
  if (!existsSync(join(ROOT, wordsFile(code)))) return `${code} has no interface words (${wordsFile(code)})`;
  if (!DAILY_COPY_LANGS.includes(code)) return `${code} has no daily-plan words (assets/daily-plan-copy.js)`;
  const guards = missingGuards(code);
  if (guards) return guards;
  if (L.site.analytics !== 'none') return `${code}: analytics «${L.site.analytics}» is not built for prefixed pages — a counter needs the owner's decision (CSP, consent) first`;
  return null;
}

/** The generator for one published language. Throws for anything else. */
export function localeGenerator(code) {
  const why = cannotBuild(code);
  if (why) throw new Error(`build-locale-pages: ${why}`);
  return makeGenerator(code, {
    copy: PAGE_COPY[code],
    guides: GUIDES_BY_LOCALE[code],
    word: (key) => word(code, key),
  }, true);
}

/**
 * A REHEARSAL: the pages of a planned, unpublished language, built in memory
 * from the copy, guides and words the caller hands in — so a test can prove a
 * language would come out whole before anyone writes its copy. It has NO
 * build(): nothing it makes can reach the tree. An enabled language, the root
 * one or an unknown one is refused (use localeGenerator for a published one).
 */
export function rehearsalGenerator(code, { copy, guides, words, registry = LOCALES } = {}) {
  // `registry`: a copy of the language list in which `code` is not published yet (seo/locales.mjs asPlanned). Since
  // KO-1 every registry language is published; the tests rehearse one «as if planned» to keep this machinery proved.
  const L = registry.find((l) => l.code === code) || null;
  if (!L || !L.prefix) throw new Error(`build-locale-pages: no prefixed locale ${String(code)} to rehearse`);
  if (L.site.enabled) throw new Error(`build-locale-pages: ${code} is published — rehearse only a planned language`);
  if (!copy || !Array.isArray(guides) || !words) throw new Error('build-locale-pages: a rehearsal needs copy, guides and words');
  return makeGenerator(code, {
    copy,
    guides,
    word: (key) => {
      if (!Object.prototype.hasOwnProperty.call(words, key)) throw new Error(`rehearsal: no ${code} entry for ${key}`);
      return String(words[key]);
    },
  }, false, registry);
}

function makeGenerator(code, source, canWrite, registry = LOCALES) {
  const L = registry.find((l) => l.code === code);
  const C = source.copy;
  const GUIDES = source.guides;
  const P = `/${L.prefix}`;
  const NAMES_FILE = namesFile(code);
  const I18N_BUNDLE = siteI18nBundle(code);

  /* Interface words come from the ONE dictionary the browser re-applies at
   * runtime (assets/i18n/<code>.js) — never typed here a second time. `t` is
   * element text, `a` an attribute value; both throw on a missing key. */
  const t = (key) => escapeText(source.word(key));
  const a = (key) => escapeAttr(source.word(key));
  const POPULAR = C.popular;

  /** The pages, as data: the countries the Russian site has a page for, named in this language
   *  (seo/country-names-i18n.mjs countryName — ru/en from seo/country-names.mjs, the rest CLDR). */
  function countries() {
    const { countries: list } = JSON.parse(readFileSync(join(ROOT, 'seo/catalogue-countries.json'), 'utf8'));
    return list.map((c) => {
      const entry = COUNTRY_NAMES[c.iso];
      const name = entry ? countryName(c.iso, L.code) : '';
      if (!name) throw new Error(`${c.iso} (${c.slug}) has no ${L.code} name`);
      if (entry.slug !== c.slug) throw new Error(`${c.iso}: slug ${c.slug} ≠ dictionary ${entry.slug}`);
      if (!/^[a-z0-9-]+$/.test(c.slug)) throw new Error(`${c.slug} is not a safe path segment`);
      return { iso: c.iso, slug: c.slug, name };
    }).sort((x, y) => (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0));
  }

  const NAV_LINKS = `<a href="${P}/esim/" data-i18n="nav.destinations">${t('nav.destinations')}</a>
      <a href="${P}/#how" data-i18n="nav.how">${t('nav.how')}</a>
      <a href="${P}/#compat" data-i18n="nav.compat">${t('nav.compat')}</a>
      <a href="${P}/guides/" data-i18n="nav.guides">${t('nav.guides')}</a>`;

/* THE SAME PAGE IN ANOTHER LANGUAGE (I18N ES-0). `twin(ruPath, path)` describes one page in every language: on the
 * Russian site it is `ruPath` (its own structure: no /guides/, so a guide's twin is the Russian guide), on a prefixed
 * one `/<prefix>` + `path`. The language switch links each language to the page the reader is on, not to a home. */
const twin = (ruPath, path) => (l) => (l.prefix ? `/${l.prefix}${path}` : ruPath);

/* The languages the switch offers: every published one, plus the page's own (a rehearsal builds a language that is
 * not published yet). Registry order. */
const SWITCH_LANGS = registry.filter((l) => l.site.enabled || l.code === L.code);

/* The header. Desktop: logo, four links, the language switch, «Find a plan». Below 900 px
 * the links fold into a <details> menu — native, so it works on the guides,
 * which carry no script at all, and with JavaScript off.
 *
 * The switch: while Russian is the only other language (the English site today) it is the one «Русский» link it
 * always was — the same bytes. With two or more other languages it becomes a <details> list of every language by its
 * own name (endonym), the current one marked and not a link — native again, no script, the CSP unchanged. */
/* The skip link is the FIRST focusable element of every English page: hidden until it
 * has keyboard focus, then shown over the sticky header; it moves focus to <main>
 * (tabindex="-1"). Plain HTML + assets/site.css, so it works without JavaScript and under the
 * strict CSP. seo/test-en-skip-link.mjs and test/e2e/en-skip-link.spec.js pin it. */
const SKIP_LINK = `<a class="skip" href="#main">${C.skipLink}</a>`;

const header = (pageTwin) => {
  const others = SWITCH_LANGS.filter((l) => l.code !== L.code);
  const ruHref = pageTwin(locale('ru'));
  const single = others.length === 1 && others[0].code === 'ru';
  const switchDesktop = single
    ? `<a class="langsw" href="${ruHref}" hreflang="ru" lang="ru">${ICON_GLOBE}<span data-i18n="lang.ru">${t('lang.ru')}</span></a>`
    : `<details class="langsw langmenu">
        <summary aria-label="${C.langMenu}">${ICON_GLOBE}<span lang="${L.htmlLang}">${esc(L.endonym)}</span></summary>
        <ul class="langmenu-list">
${SWITCH_LANGS.map((l) => (l.code === L.code
    ? `          <li><span aria-current="true" lang="${l.htmlLang}">${esc(l.endonym)}</span></li>`
    : `          <li><a href="${pageTwin(l)}" hreflang="${l.hreflang}" lang="${l.htmlLang}">${esc(l.endonym)}</a></li>`)).join('\n')}
        </ul>
      </details>`;
  const switchMenu = single
    ? `<a href="${ruHref}" hreflang="ru" lang="ru" data-i18n="lang.ru">${t('lang.ru')}</a>`
    : others.map((l) => `<a href="${pageTwin(l)}" hreflang="${l.hreflang}" lang="${l.htmlLang}">${esc(l.endonym)}</a>`).join('\n          ');
  return `${SKIP_LINK}
<header class="site-header">
  <div class="wrap hdr">
    <a class="brand" href="${P}/">${LOGO_ANIMATED_EN}</a>
    <nav class="nav" aria-label="${C.navLabel}">
      ${NAV_LINKS}
    </nav>
    <div class="hdr-actions">
      ${switchDesktop}
      <a class="btn btn-sm hdr-cta" href="${P}/#plans" data-i18n="nav.findPlan">${t('nav.findPlan')}</a>
      <details class="mnav">
        <summary aria-label="${C.menuLabel}">${ICON_MENU}</summary>
        <nav class="mnav-panel" aria-label="${C.menuLabel}">
      ${NAV_LINKS}
          <hr>
          ${switchMenu}
        </nav>
      </details>
    </div>
  </div>
</header>`;
};

/* «Payment unavailable», as a compact bar under the header: on the home, the
 * destination list and every country page, BEFORE anything that looks
 * purchasable. The sentence that says nothing can be bought is always visible;
 * «What this means» opens the full wording. Static markup, identical on every
 * page (the tests compare it), so it is there without JavaScript too. */
const PAYBAR = `<div class="paybar" id="previewNotice" role="note">
  <details class="wrap">
    <summary><span class="paybar-dot" aria-hidden="true"></span><strong data-i18n="preview.noticeTitle">${t('preview.noticeTitle')}</strong><span class="paybar-more" data-i18n="preview.more">${t('preview.more')}</span></summary>
    <p data-i18n="preview.noticeBody">${t('preview.noticeBody')}</p>
  </details>
</div>`;

const ftLinks = (items) => items.map((x) => `          <li><a href="${x.href}">${esc(x.label)}</a></li>`).join('\n');

/* The footer. The support line is pinned word for word by
 * seo/test-en-support-contact.mjs. The legal links follow the language's scheme
 * (seo/legal-links.mjs): every international language links the three published
 * documents — Terms of Service, Refund Policy, Privacy Policy (LEGAL-3) — in its own
 * language (LEGAL-4: the translations of seo/legal-i18n.mjs); never a Russian document. */
// LEGAL-4: a language with its own translation of the three documents (seo/legal-i18n.mjs) links its own pages
// (/<prefix>/terms/ …), labelled without «in English»; English links /en/.
const LEGAL_T = code === 'en' ? null : (LEGAL_TRANSLATIONS[code] || null);
const EN_ROOT = `/${locale('en').prefix}/`;
const localLegal = (href) => (LEGAL_T && href.startsWith(EN_ROOT) ? `${P}/${href.slice(EN_ROOT.length)}` : href);
const LEGAL = legalLinks(code).map((l) => (LEGAL_T && l.hreflang === 'en' ? { ...l, href: localLegal(l.href), hreflang: L.htmlLang } : l));
const LEGAL_LINE = LEGAL.length
  ? `      <p>${LEGAL.map((l) => `<a href="${l.href}" hreflang="${l.hreflang}" data-i18n="${l.key}">${t(l.key)}</a>`).join(' · ')}</p>\n`
  : '';
const FOOTER = `<footer class="site-footer">
  <div class="wrap">
    <div class="ft-grid">
      <div class="ft-brand">
        <a href="${P}/">${LOGO}</a>
        <p data-i18n="footer.about">${t('footer.about')}</p>
      </div>
      <div class="ft-col">
        <h2 data-i18n="nav.destinations">${t('nav.destinations')}</h2>
        <ul>
${ftLinks(POPULAR.slice(0, 6).map((c) => ({ href: `${P}/esim/${c.slug}/`, label: c.name })))}
          <li><a href="${P}/esim/" data-i18n="site.allDestinations">${t('site.allDestinations')}</a></li>
        </ul>
      </div>
      <div class="ft-col">
        <h2 data-i18n="nav.guides">${t('nav.guides')}</h2>
        <ul>
${ftLinks(GUIDES.map((g) => ({ href: `${P}/guides/${g.slug}/`, label: g.h1 })))}
        </ul>
      </div>
      <div class="ft-col">
        <h2 data-i18n="footer.help">${t('footer.help')}</h2>
        <p class="support">${C.support} <a href="mailto:support@magicesim.store">support@magicesim.store</a></p>
        <ul>
          <li><a href="${P}/#how" data-i18n="nav.how">${t('nav.how')}</a></li>
          <li><a href="${P}/#compat" data-i18n="nav.compat">${t('nav.compat')}</a></li>
        </ul>
      </div>
    </div>
    <div class="ft-bottom">
      <p>© Magic eSIM</p>
${LEGAL_LINE}    </div>
  </div>
</footer>`;

/* LEGAL-3: the two consents, directly before the payment button, each its own box, never pre-ticked — (1) the Terms of
 * Service and the Refund Policy, each its own link to the published English page (a new tab); (2) the express request
 * for immediate supply, in the words Refund Policy §4.2 quotes. The Privacy Policy is linked under them (Terms §5.3(b)).
 * Built from one template per language: a {name} becomes the link. A document that is not published makes the BUILD
 * fail — never a box that names a page that does not exist. en/checkout.js keeps the boxes unticked on every opening and
 * keeps the payment button disabled while international payments are off; the server must check the record too
 * (MAGIC_ESIM_LEGAL3_CONSENT_SERVER_PLAN). */
function legalLink(kind, key) {
  const href = INTL_LEGAL[kind];
  if (!href) throw new Error(`consents: the ${kind} document is not published (seo/legal-links.mjs) — no box may name it`);
  return `<a href="${localLegal(href)}" target="_blank" rel="noopener" data-i18n="${key}">${t(key)}</a>`;
}
function fillTemplate(key, links) {
  // Every {name} must have a link; that every language KEEPS each {name} is held by seo/test-en-legal-docs.mjs
  // (a rehearsal's marked words carry no placeholder at all, so the build does not refuse a missing one).
  return t(key).replace(/\{(\w+)\}/g, (m, name) => {
    if (!links[name]) throw new Error(`consents: ${key} names {${name}}, which has no link`);
    return links[name];
  });
}
const CONSENTS = `      <fieldset class="co-consents" id="coConsents" data-state="none" data-ready="false">
        <legend class="sr-only" data-i18n="consent.legend">${t('consent.legend')}</legend>
        <label class="check"><input type="checkbox" id="coAgreeTerms" data-terms-version="${TERMS_VERSION}" data-refund-version="${REFUND_VERSION}"> <span>${fillTemplate('consent.terms', { terms: legalLink('terms', 'consent.termsLink'), refund: legalLink('refund', 'consent.refundLink') })}</span></label>
        <label class="check"><input type="checkbox" id="coAgreeDelivery"> <span data-i18n="consent.delivery">${t('consent.delivery')}</span></label>
        <p class="note">${fillTemplate('consent.privacy', { privacy: legalLink('privacy', 'consent.privacyLink') })}</p>
      </fieldset>`;

/* The checkout window: plan → price fixed by the server (a GLOBAL quote) →
 * review. Each fact about the plan is shown once: coverage, data, validity
 * (the card's own title IS the data line, so a separate «plan» row only
 * repeated it). The refusal is the first thing in it, and the payment button is
 * DISABLED in the markup — en/checkout.js never enables it. */
/* The checkout window, in the design system (redesign PR 3). Markup only:
 * every id en/checkout.js reads is here, unchanged, and the script is untouched.
 * The step indicator follows the visible #coStepN through CSS (:has), so it
 * needs no script; it is decorative for screen readers, which hear each
 * step's own heading and the #coLive announcements. On step 3 the summary at
 * the top hides (CSS), so the review shows each fact once. */
const modal = (c) => `<div class="overlay" id="checkout" hidden>
  <div class="modal co" role="dialog" aria-modal="true" aria-labelledby="coTitle">
    <div class="co-head">
      <h3 id="coTitle" tabindex="-1" data-i18n="checkout.title">${t('checkout.title')}</h3>
      <button type="button" class="close" id="coClose" data-i18n-attr="aria-label:checkout.close" aria-label="${a('checkout.close')}">×</button>
    </div>
    <ol class="co-steps" aria-hidden="true">
      <li><span>1</span>${C.steps[0]}</li>
      <li><span>2</span>${C.steps[1]}</li>
      <li><span>3</span>${C.steps[2]}</li>
    </ol>
    <div class="unavail" id="coUnavail">
      <h4 data-i18n="pay.unavailableTitle">${t('pay.unavailableTitle')}</h4>
      <p data-i18n="pay.unavailableBody">${t('pay.unavailableBody')}</p>
    </div>
    <section class="co-sum" aria-label="${C.yourPlan}">
      <div class="co-sum-head"><img class="co-flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="36" height="27"><span>${C.esimFor(esc(c.name))}</span></div>
      <div class="rows">
        <div><span data-i18n="checkout.coverage">${t('checkout.coverage')}</span><b id="coCoverage">—</b></div>
        <div><span data-i18n="checkout.data">${t('checkout.data')}</span><b id="coData">—</b></div>
        <div><span data-i18n="checkout.term">${t('checkout.term')}</span><b id="coTerm">—</b></div>
      </div>
      <!-- The duration stays in view on steps 1 and 2: changing it drops the
           held price and starts again from step 1. -->
      <div class="field" id="coTermPick" hidden>
        <label for="coDays" data-i18n="checkout.duration">${t('checkout.duration')}</label>
        <select id="coDays"></select>
      </div>
    </section>
    <p class="note" id="coQuoteStatus" role="status" hidden></p>
    <p class="sr-only" id="coLive" role="status" aria-live="polite"></p>
    <div id="coStep1" class="co-step">
      <div class="rows"><div><span data-i18n="checkout.listed">${t('checkout.listed')}</span><b id="coListed">—</b></div></div>
      <p class="note" data-i18n="quote.explain">${t('quote.explain')}</p>
      <div class="co-action">
        <button type="button" class="btn" id="coQuote" data-i18n="quote.get">${t('quote.get')}</button>
      </div>
    </div>
    <div id="coStep2" class="co-step" hidden>
      <div class="co-price">
        <div class="rows"><div class="total"><span data-i18n="checkout.price">${t('checkout.price')}</span><b id="coTotal" tabindex="-1">—</b></div></div>
        <p class="note" id="coExpiry" hidden></p>
        <p class="note" id="coPriceChanged" hidden></p>
        <button type="button" class="btn btn-ghost" id="coRequote" data-i18n="quote.again" hidden>${t('quote.again')}</button>
      </div>
      <div class="field">
        <label for="coEmail" data-i18n="checkout.email">${t('checkout.email')}</label>
        <input type="email" id="coEmail" autocomplete="email" inputmode="email" spellcheck="false" maxlength="254">
        <p class="note" data-i18n="checkout.emailNote">${t('checkout.emailNote')}</p>
      </div>
      <label class="check"><input type="checkbox" id="coDevice"> <span data-i18n="checkout.device">${t('checkout.device')}</span></label>
      <p class="note err" id="coFormError" role="alert" hidden></p>
      <div class="co-action">
        <button type="button" class="btn" id="coReview" data-i18n="checkout.review">${t('checkout.review')}</button>
      </div>
    </div>
    <div id="coStep3" class="co-step" hidden>
      <div class="rows co-review">
        <div><span data-i18n="checkout.coverage">${t('checkout.coverage')}</span><b id="rvCoverage">—</b></div>
        <div><span data-i18n="checkout.data">${t('checkout.data')}</span><b id="rvData">—</b></div>
        <div><span data-i18n="checkout.term">${t('checkout.term')}</span><b id="rvTerm">—</b></div>
        <div><span data-i18n="checkout.emailShort">${t('checkout.emailShort')}</span><b id="rvEmail">—</b></div>
        <div class="total"><span data-i18n="checkout.price">${t('checkout.price')}</span><b id="rvTotal">—</b></div>
      </div>
      <div class="unavail" id="coFinal" role="status" tabindex="-1">
        <h4 data-i18n="pay.finalTitle">${t('pay.finalTitle')}</h4>
        <p data-i18n="pay.finalBody">${t('pay.finalBody')}</p>
      </div>
${CONSENTS}
      <div class="co-action">
        <button type="button" class="btn" id="coPay" disabled aria-disabled="true" data-i18n="pay.disabled">${t('pay.disabled')}</button>
        <button type="button" class="btn btn-ghost" id="coBack" data-i18n="checkout.back">${t('checkout.back')}</button>
      </div>
    </div>
  </div>
</div>`;


/* One block of plans. The heading, count and note are the same words as
 * before; the grid is filled by en/country.js, which also folds a long list. */
const block = (id, title, note) => `  <section class="block plan-block plan-block-${id}" id="${id}Block" hidden>
    <div class="blk-head">
      <span class="blk-ico">${BLOCK_ICON[id]}</span>
      <div>
        <h2><span>${title}</span> <span class="count" id="${id}Count"></span></h2>
        <p class="note">${note}</p>
      </div>
    </div>
    <div class="grid plan-grid" id="${id}Grid"></div>
  </section>`;

/* «Before you buy»: links to what already exists — the device check, two
 * guides and the support address. No new claims. */
const HELP = `  <section class="cp-help" aria-labelledby="cpHelpTitle">
    <h2 id="cpHelpTitle">${C.beforeYouBuy}</h2>
    <div class="help-grid">
      <div class="help-card">
        <h3 data-i18n="site.compatTitle">${t('site.compatTitle')}</h3>
        <p data-i18n="site.compatBody">${t('site.compatBody')}</p>
        <ul>
          <li><a href="${P}/guides/compatibility/" data-i18n="site.compatGuide">${t('site.compatGuide')}</a></li>
          <li><a href="${P}/guides/iphone/" data-i18n="site.compatCheck">${t('site.compatCheck')}</a></li>
          <li><a href="${P}/guides/android/" data-i18n="site.compatAndroid">${t('site.compatAndroid')}</a></li>
        </ul>
      </div>
      <div class="help-card">
        <h3 data-i18n="home.guidesTitle">${t('home.guidesTitle')}</h3>
        <p data-i18n="home.guidesLead">${t('home.guidesLead')}</p>
        <ul>
${GUIDES.filter((g) => g.slug === 'activation' || g.slug === 'troubleshooting').map((g) => `          <li><a href="${P}/guides/${g.slug}/">${esc(g.h1)}</a></li>`).join('\n')}
          <li><a href="${P}/guides/" data-i18n="nav.guides">${t('nav.guides')}</a></li>
        </ul>
      </div>
      <div class="help-card">
        <h3 data-i18n="home.supportTitle">${t('home.supportTitle')}</h3>
        <p data-i18n="home.supportBody">${t('home.supportBody')}</p>
        <ul>
          <li><a href="mailto:support@magicesim.store">support@magicesim.store</a></li>
        </ul>
      </div>
    </div>
  </section>`;

function countryPage(c) {
  const name = esc(c.name);
  const url = `${SITE}${P}/esim/${c.slug}/`;
  const title = C.countryTitle(name);
  return `<!doctype html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${C.countryDescription(name)}">
<link rel="canonical" href="${url}">
${indexingHead(L.code, { kind: 'country', slug: c.slug })}
${cspMeta(primaryApiOrigin())}
<meta property="og:type" content="website">
<meta property="og:locale" content="${L.ogLocale}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title}">
${HEAD_ICONS}
${FONT_PRELOAD}
${LOGO_ONCE_SCRIPT_MOTION}
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/en/en.css">
<link rel="stylesheet" href="/assets/page-country.css">
<link rel="stylesheet" href="/en/checkout.css">
</head>
<body data-iso="${c.iso}">

${header(twin(`/esim/${c.slug}/`, `/esim/${c.slug}/`))}
${PAYBAR}

<main class="cp" id="main" tabindex="-1">
  <section class="cp-hero">
    <div class="wrap">
      <p class="crumbs"><a href="${P}/">Magic eSIM</a> › <a href="${P}/esim/" data-i18n="nav.destinations">${t('nav.destinations')}</a> › ${name}</p>
      <div class="cp-title">
        <img class="cp-flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="72" height="54">
        <div>
          <h1>${C.esimFor(name)}</h1>
          <p class="lead">${C.countryLead(name)}</p>
        </div>
      </div>
      <div class="cp-hero-foot">
        <ul class="cp-facts">
          <li data-i18n="home.fact1">${t('home.fact1')}</li>
          <li data-i18n="home.fact2">${t('home.fact2')}</li>
        </ul>
        <a class="cp-change" href="${P}/esim/">${C.chooseAnother}</a>
      </div>
    </div>
  </section>

  <div class="wrap cp-body">
  <nav class="cp-jump" aria-label="${C.planTypes}" hidden>
    <a href="#localBlock" hidden><span>${name}</span> <span class="n"></span></a>
    <a href="#regionalBlock" hidden><span>${C.jumpRegional}</span> <span class="n"></span></a>
    <a href="#dailyBlock" hidden><span>${C.jumpDaily}</span> <span class="n"></span></a>
  </nav>

  <div class="cp-state">
  <p class="note" id="status" role="status" aria-live="polite" data-i18n="site.loading">${t('site.loading')}</p>
  <noscript>
    <link rel="stylesheet" href="/en/noscript.css">
    <p class="note">${C.noscript}</p>
  </noscript>
  <button type="button" class="btn btn-ghost" id="retry" data-i18n="site.retry" hidden>${t('site.retry')}</button>
  <a class="btn btn-ghost" id="emptyLink" href="${P}/esim/" data-i18n="site.allDestinations" hidden>${t('site.allDestinations')}</a>
  </div>

  <div class="cp-skeleton" id="skeleton" aria-hidden="true">
    <div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div><div class="sk"></div>
  </div>

${block('local', C.localTitle(name), C.localNote(name))}

${block('regional', C.regionalTitle(name), C.regionalNote(name))}

${block('daily', C.dailyTitle, C.dailyNote)}

  <p class="note" id="currencyNote" data-i18n="price.currencyNote" hidden>${t('price.currencyNote')}</p>

${HELP}
  </div>
</main>

${modal(c)}

${FOOTER}

<script src="/assets/magic-net.js" defer></script>
<script src="/assets/assortment-view.js" defer></script>
<script src="/assets/global-catalog.js" defer></script>
<script src="/assets/daily-plan-copy.js" defer></script>
<script src="${NAMES_FILE.src}" defer></script>
<script src="${I18N_BUNDLE.src}" defer></script>
<script src="/en/plans.js" defer></script>
<script src="/en/checkout.js" defer></script>
<script src="/en/country.js" defer></script>
</body>
</html>
`;
}

/* The destination list. Static and complete without JavaScript (A–Z groups,
 * jump letters); en/hub.js only adds the search that filters it in place. It
 * reads nothing over the network (connect-src 'none'). The popular row is the
 * home's own POPULAR list, under the home's own label — no new claim. */
function hubPage(list) {
  const url = `${SITE}${P}/esim/`;
  const index = listIndex(code);
  const sorted = list.slice().sort((a, b) => index.compare(a.name, b.name));
  const groups = new Map(index.labels.map((l) => [l, []]));
  for (const c of sorted) groups.get(index.labelOf(c.name)).push(c);
  for (const [l, cs] of groups) if (!cs.length) groups.delete(l);
  const jump = index.labels.map((l) => (groups.has(l)
    ? `<a href="#az-${index.id(l)}" data-letter="${l}">${l}</a>`
    : `<span aria-hidden="true">${l}</span>`)).join('');
  const item = (c) => `        <li data-name="${esc(c.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())}" data-iso="${c.iso}"><a href="${P}/esim/${c.slug}/"><img class="flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="28" height="21" loading="lazy"><span>${esc(c.name)}</span></a></li>`;
  const sections = [...groups.entries()].map(([l, cs]) => `    <section class="az-group" id="az-${index.id(l)}" aria-labelledby="azh-${index.id(l)}">
      <h2 id="azh-${index.id(l)}">${l}</h2>
      <ul class="dest">
${cs.map(item).join('\n')}
      </ul>
    </section>`).join('\n');
  const popular = POPULAR.map((c) => `      <a class="hub-tile" href="${P}/esim/${c.slug}/"><img class="flag" src="/assets/flags/${c.iso.toLowerCase()}.svg" alt="" width="40" height="30"><span>${esc(c.name)}</span></a>`).join('\n');
  return `<!doctype html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${C.hubTitle}</title>
<meta name="description" content="${C.hubDescription}">
<link rel="canonical" href="${url}">
${indexingHead(L.code, { kind: 'hub' })}
${cspMeta("'none'")}
${HEAD_ICONS}
${FONT_PRELOAD}
${LOGO_ONCE_SCRIPT}
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/en/en.css">
<link rel="stylesheet" href="/assets/page-hub.css">
<noscript><link rel="stylesheet" href="/en/noscript.css"></noscript>
</head>
<body>

${header(twin('/esim/', '/esim/'))}
${PAYBAR}

<main class="hub" id="main" tabindex="-1">
  <section class="hub-hero">
    <div class="wrap">
      <p class="crumbs"><a href="${P}/">Magic eSIM</a> › <span data-i18n="nav.destinations">${t('nav.destinations')}</span></p>
      <h1>${C.hubH1}</h1>
      <p class="lead">${C.hubLead}</p>
      <!-- In the layout from the first paint: shown by the markup, not by en/hub.js (defer), which used to unhide it after the
           page had painted and push the list down 74 px — CLS 0.05 on phones (2026-10-21). Without JavaScript there is
           still no search box that does nothing: en/noscript.css (in <noscript>) hides it. -->
      <div class="hub-search" id="hubSearch" role="search">
        <label for="hq" class="sr-only" data-i18n="site.chooseCountry">${t('site.chooseCountry')}</label>
        <div class="hub-field">${SEARCH_ICON}<input type="text" id="hq" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-controls="hubList" aria-describedby="hubCount" placeholder="${C.hubSearchPlaceholder}"><button type="button" class="hub-clear" id="hubClear" aria-label="${C.hubClear}" hidden>×</button></div>
      </div>
      <p class="hub-count" id="hubCount" role="status" aria-live="polite"></p>
    </div>
  </section>

  <div class="wrap hub-body">
    <section class="hub-pop" id="hubPopular" aria-labelledby="hubPopTitle">
      <h2 id="hubPopTitle" data-i18n="home.popularTitle">${t('home.popularTitle')}</h2>
      <div class="hub-tiles">
${popular}
      </div>
    </section>

    <nav class="hub-az" id="hubAz" aria-label="${C.hubAz}">${jump}</nav>

    <div class="hub-list" id="hubList">
${sections}
    </div>

    <div class="hub-empty" id="hubEmpty" hidden>
      <p class="hub-empty-title" data-i18n="site.noDestination">${t('site.noDestination')}</p>
      <p class="note">${C.hubEmptyNote}</p>
      <button type="button" class="btn btn-ghost" id="hubReset">${C.hubShowAll}</button>
    </div>

${HELP}
  </div>
</main>

${FOOTER}

<script src="${I18N_BUNDLE.src}" defer></script>
<script src="/en/hub.js" defer></script>
</body>
</html>
`;
}

/* A guide card — the guide list and «Related guides» use the same one. */
const guideCard = (r, tag = 'h2') => `      <a class="g-card" href="${P}/guides/${r.slug}/">
        <span class="g-ico">${guideIcon(r.slug)}</span>
        <span class="g-card-body"><${tag} class="g-card-title">${esc(r.h1)}</${tag}><span class="g-card-blurb">${esc(r.blurb)}</span></span>
      </a>`;

/* A guide: the text is seo/guides-en.mjs, word for word; only the frame is
 * this function's. No script — the «On this page» list is plain anchors. */
function guidePage(g, all = GUIDES) {
  const url = `${SITE}${P}/guides/${g.slug}/`;
  const ru = GUIDE_RU[g.slug];
  if (!ru) throw new Error(`guide ${g.slug} has no Russian twin for the language switch`);
  const ids = g.sections.map((x) => guideSectionId(x, g.slug));
  if (new Set([...ids, 'faq', 'related']).size !== ids.length + 2) throw new Error(`guide ${g.slug} has two sections with the same anchor`);
  const sections = g.sections.map((x, i) => `    <section class="g-sec prose" id="${ids[i]}" aria-labelledby="${ids[i]}-h">
      <h2 id="${ids[i]}-h">${esc(x.h2)}</h2>
${x.html.replace(/^\n/, '').replace(/\s+$/, '')}
    </section>`).join('\n\n');
  const toc = g.sections.map((x, i) => `        <li><a href="#${ids[i]}">${esc(x.h2)}</a></li>`)
    .concat([`        <li><a href="#faq">${C.questions}</a></li>`]).join('\n');
  const faq = g.faq.map((f) => `      <details>
        <summary>${esc(f.q)}</summary>
        <p class="note">${esc(f.a)}</p>
      </details>`).join('\n');
  const related = g.related.map((slug) => {
    const r = all.find((x) => x.slug === slug);
    if (!r) throw new Error(`guide ${g.slug} links to an unknown guide ${slug}`);
    return guideCard(r, 'h3');
  }).join('\n');
  return `<!doctype html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(g.title)}</title>
<meta name="description" content="${esc(g.description)}">
<link rel="canonical" href="${url}">
${indexingHead(L.code, { kind: 'guide', slug: g.slug })}
${cspMeta("'none'")}
<meta property="og:type" content="article">
<meta property="og:locale" content="${L.ogLocale}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(g.title)}">
${HEAD_ICONS}
${FONT_PRELOAD}
${LOGO_ONCE_SCRIPT}
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/en/en.css">
<link rel="stylesheet" href="/assets/page-guides.css">
</head>
<body>

${header(twin(ru, `/guides/${g.slug}/`))}
${PAYBAR}

<main class="guide" id="main" tabindex="-1">
  <section class="g-hero">
    <div class="wrap">
      <p class="crumbs"><a href="${P}/">Magic eSIM</a> › <a href="${P}/guides/" data-i18n="nav.guides">${t('nav.guides')}</a> › ${esc(g.nav)}</p>
      <div class="g-hero-row">
        <span class="g-ico g-ico-lg">${guideIcon(g.slug)}</span>
        <h1>${esc(g.h1)}</h1>
      </div>
      <p class="lead">${esc(g.lead)}</p>
    </div>
  </section>

  <div class="wrap g-layout">
    <nav class="g-toc" aria-label="${C.onThisPage}">
      <p class="g-toc-title">${C.onThisPage}</p>
      <ol>
${toc}
      </ol>
    </nav>

    <article class="g-article">
${sections}

    <section class="g-sec" id="faq" aria-labelledby="faq-h">
      <h2 id="faq-h">${C.questions}</h2>
${faq}
    </section>
    </article>
  </div>

  <div class="wrap">
    <section class="g-related" id="related" aria-labelledby="related-h">
      <h2 id="related-h">${C.relatedGuides}</h2>
      <div class="g-cards">
${related}
      </div>
      <p class="g-cta"><a class="btn" href="${P}/esim/">${C.chooseDestination}</a></p>
    </section>
  </div>
</main>

${FOOTER}
</body>
</html>
`;
}

function guidesHub(all = GUIDES) {
  const url = `${SITE}${P}/guides/`;
  const items = all.map((g) => guideCard(g)).join('\n');
  return `<!doctype html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${C.guidesTitle}</title>
<meta name="description" content="${C.guidesDescription}">
<link rel="canonical" href="${url}">
${indexingHead(L.code, { kind: 'guides' })}
${cspMeta("'none'")}
${HEAD_ICONS}
${FONT_PRELOAD}
${LOGO_ONCE_SCRIPT}
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/en/en.css">
<link rel="stylesheet" href="/assets/page-guides.css">
</head>
<body>

${header(twin('/esim/', '/guides/'))}
${PAYBAR}

<main class="guide" id="main" tabindex="-1">
  <section class="g-hero">
    <div class="wrap">
      <p class="crumbs"><a href="${P}/">Magic eSIM</a> › <span data-i18n="nav.guides">${t('nav.guides')}</span></p>
      <h1>${C.guidesH1}</h1>
      <p class="lead">${C.guidesLead}</p>
    </div>
  </section>

  <div class="wrap">
    <div class="g-cards g-cards-hub guides">
${items}
    </div>
  </div>
</main>

${FOOTER}
</body>
</html>
`;
}

/* THE LEGAL DOCUMENTS — /en/privacy/ (LEGAL-1), /en/terms/ and /en/refund/ (LEGAL-3), and since LEGAL-4 their translations
 * /<prefix>/{terms,refund,privacy}/ for every language with a seo/legal-i18n/<code>.mjs (the English is the master).
 * Each text lives in ONE place (seo/privacy-en.mjs, seo/terms-en.mjs, seo/refund-en.mjs); this is their one frame, the guide layout (hero, «On this page», one card per section). No script
 * beyond the logo's (CSP connect-src 'none'), no counter, no cookie. noindex, follow with its own canonical and no
 * hreflang: the indexing stages of seo/indexing.mjs are untouched, so the sitemap does not change. The language
 * switch leads every language to its own version of the document (Russian: its home). */
const PRIVACY_PATH = '/en/privacy/';
const LEGAL_DOCS = Object.freeze({
  privacy: { path: PRIVACY_PATH, D: PRIVACY, version: PRIVACY_VERSION, effective: PRIVACY_EFFECTIVE, effectiveIso: PRIVACY_EFFECTIVE_ISO },
  terms: { path: '/en/terms/', D: TERMS, version: TERMS_VERSION, effective: TERMS_EFFECTIVE, effectiveIso: TERMS_EFFECTIVE_ISO },
  refund: { path: '/en/refund/', D: REFUND, version: REFUND_VERSION, effective: REFUND_EFFECTIVE, effectiveIso: REFUND_EFFECTIVE_ISO },
});
// The international Privacy Policy (pre-launch) is not offered to search engines (noindex) and is not in the sitemap;
// every international footer links it (seo/legal-links.mjs). This note stays here, in the source: the legal page
// itself carries no HTML comment (LEGAL-1 audit L1).
const EN_HTML_LANG = locale('en').htmlLang;
// Chinese typography (D6): a space between digits and Chinese («2026 年 10 月 23 日»), as the guides write dates.
const cjkSpaced = (v) => v.replace(/(\d)(\p{Script=Han})/gu, '$1 $2').replace(/(\p{Script=Han})(\d)/gu, '$1 $2');
const META_COLON = Object.freeze({ fr: '\u00a0:', 'zh-Hans': '：' });
const PRIVACY_NOINDEX = '<meta name="robots" content="noindex, follow">';
function privacyPage() { return legalPage('privacy'); }
// LEGAL-5: `archived` = one frozen version from seo/legal-archive/ (English only), rendered at its permanent address
// /en/<kind>/v<number>/ in the same frame, with a notice that it is kept unchanged and a link to the current version.
function legalPage(kind, archived = null) {
  const cur = LEGAL_DOCS[kind];
  if (!cur) throw new Error(`legalPage: no legal document «${kind}»`);
  if (archived && L.code !== 'en') throw new Error('legalPage: an archived version is English only (the master text)');
  const doc = archived
    ? { path: archivePath(kind, archived.version), D: archived, version: archived.version, effective: archived.effective, effectiveIso: archived.effectiveIso }
    : cur;
  // LEGAL-4: outside English the page is the translation (seo/legal-i18n/<code>.mjs) of the same English document — the
  // same section ids, the English version and date, and a notice that the English version applies where they differ.
  const T = L.code === 'en' ? null : LEGAL_T;
  if (L.code !== 'en' && !T) throw new Error(`legalPage: no ${L.code} translation of the ${kind} document (seo/legal-i18n.mjs)`);
  const path = T ? `${P}/${kind}/` : doc.path;
  const permanent = archivePath(kind, cur.version);
  const url = `${SITE}${path}`;
  const D = T ? T[kind] : doc.D;
  if (T && D.sections.map((x) => x.id).join('|') !== doc.D.sections.map((x) => x.id).join('|')) throw new Error(`legalPage(${kind}): the ${L.code} sections are not the English sections`);
  const vLabel = T ? T.labels.version : 'Version';
  const eLabel = T ? T.labels.effective : 'Effective date';
  const version = T ? doc.version.replace('(pre-launch)', `(${T.labels.preLaunch})`) : doc.version;
  const effective0 = T
    ? new Intl.DateTimeFormat(L.htmlLang, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${doc.effectiveIso}T00:00:00Z`))
    : doc.effective;
  const effective = L.code === 'zh-Hans' ? cjkSpaced(effective0) : effective0;
  // The version line follows each language's typography: French « : », Chinese full-width （）and ：.
  const metaVersion = L.code === 'zh-Hans' ? version.replace(' (', '（').replace(/\)$/, '）') : version;
  const notice = T ? `\n      <p class="lg-meta lg-translation">${esc(T.notice.body)} <a href="${doc.path}" hreflang="${EN_HTML_LANG}" lang="${EN_HTML_LANG}">${esc(T.notice.english)}</a></p>` : '';
  // The permanent copy of the version shown (LEGAL-5); on an archived page, the way back to the current version.
  const keep = archived
    ? `\n      <p class="lg-meta lg-archived"><strong>Permanent copy.</strong> This is version ${esc(versionNumber(doc.version))} of our ${esc(cur.D.h1)}, kept unchanged at this address. The current version is always at <a href="${cur.path}">magicesim.store${cur.path}</a>.</p>`
    : `\n      <p class="lg-meta lg-permanent"><a href="${permanent}"${T ? ` hreflang="${EN_HTML_LANG}"` : ''}>${esc(T ? T.labels.permanent : 'Permanent copy of this version')}</a></p>`;
  const ids = D.sections.map((x) => x.id);
  if (new Set(ids).size !== ids.length || ids.some((id) => !/^[a-z0-9-]+$/.test(id))) throw new Error(`legalPage(${kind}): section ids must be unique ASCII`);
  const toc = D.sections.map((x) => `        <li><a href="#${x.id}">${esc(x.h2)}</a></li>`).join('\n');
  const sections = D.sections.map((x) => `    <section class="g-sec prose" id="${x.id}" aria-labelledby="${x.id}-h">
      <h2 id="${x.id}-h">${esc(x.h2)}</h2>
${x.html.replace(/^\n/, '').replace(/\s+$/, '')}
    </section>`).join('\n\n');
  // The switch leads every language that has this document to its own version of it; Russian to its home.
  const switchTwin = (l) => (l.code === 'en' ? doc.path : (LEGAL_TRANSLATIONS[l.code] && l.prefix ? `/${l.prefix}/${kind}/` : (l.prefix ? `/${l.prefix}/` : '/')));
  return `<!doctype html>
<html lang="${L.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(archived ? `${D.h1}, version ${versionNumber(doc.version)} — Magic eSIM` : D.title)}</title>
<meta name="description" content="${esc(D.description)}">
<link rel="canonical" href="${url}">
${PRIVACY_NOINDEX}
${cspMeta("'none'")}
<meta property="og:type" content="article">
<meta property="og:locale" content="${L.ogLocale}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(D.title)}">
${HEAD_ICONS}
${FONT_PRELOAD}
${LOGO_ONCE_SCRIPT}
<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/en/en.css">
<link rel="stylesheet" href="/assets/page-guides.css">
</head>
<body>

${header(switchTwin)}
${PAYBAR}

<main class="guide legal" id="main" tabindex="-1">
  <section class="g-hero">
    <div class="wrap">
      <p class="crumbs"><a href="${P}/">Magic eSIM</a> › ${esc(D.crumb)}</p>
      <h1>${esc(D.h1)}</h1>
      <p class="lead">${esc(D.lead)}</p>
      <p class="lg-meta">${esc(vLabel)} ${esc(metaVersion)} · ${esc(eLabel)}${META_COLON[L.code] || ':'} <time datetime="${doc.effectiveIso}">${esc(effective)}</time></p>${notice}${keep}
    </div>
  </section>

  <div class="wrap g-layout">
    <nav class="g-toc" aria-label="${C.onThisPage}">
      <p class="g-toc-title">${C.onThisPage}</p>
      <ol>
${toc}
      </ol>
    </nav>

    <article class="g-article">
${sections}
    </article>
  </div>
</main>

${FOOTER}
</body>
</html>
`;
}

function destinationsJs(list) {
  const rows = list.slice().sort((a, b) => a.name.localeCompare(b.name, L.code))
    .map((c) => `  { iso: ${JSON.stringify(c.iso)}, slug: ${JSON.stringify(c.slug)}, name: ${JSON.stringify(c.name)} },`)
    .join('\n');
  const languageName = new Intl.DisplayNames(['en'], { type: 'language' }).of(L.code);
  const own = `seo/build-${L.prefix}-pages.mjs`;
  const entry = existsSync(join(ROOT, own)) ? own : 'seo/build-locale-pages.mjs';
  return `/* GENERATED by ${entry} — do not edit by hand.
 * The destinations that have ${/^[AEIOU]/.test(languageName) ? 'an' : 'a'} ${languageName} page (${P}/esim/<slug>/), for the
 * home's search. Static on purpose: the home reads no catalogue. */
window.Magic${globalSuffix(L.prefix)}Destinations = [
${rows}
];
`;
}

/* THE HOME (seo/home-page.mjs). Its indexing is the registry's: an indexable home carries the hreflang cluster of
 * every indexable home plus x-default (X_DEFAULT_CURRENT — English since I18N-09) and says `index, follow`; any other
 * home is `noindex, follow` with no alternate — a language is published under noindex first (owner, D5) and reviewed. */
const HOME_CLUSTER_NOTE = `<!-- The cluster is declared on EVERY home of the cluster and each points at all the
     others and at itself, which is what makes it valid. The other pages' clusters
     come from seo/indexing.mjs. -->`;
const HOME_INDEX = `<!-- Stated rather than relied upon. The default is index,follow, but the RU
     landing says it out loud and a page whose indexability is a deliberate
     decision should not leave it to a default. -->
<meta name="robots" content="index, follow">`;
const HOME_NOINDEX = `<!-- PUBLISHED FOR REVIEW: this language's pages are live but not yet offered to
     search engines (noindex), not in the sitemap and without hreflang, until its
     copy has been reviewed and the indexing stage opens it. -->
<meta name="robots" content="noindex, follow">`;

function homeIndexing() {
  if (!L.site.indexableHome) return { alternates: '', ogAlternates: '', robots: HOME_NOINDEX };
  const cluster = LOCALES.filter((l) => l.site.enabled && l.site.indexableHome);
  if (!cluster.some((l) => l.code === L.code)) throw new Error(`${L.code}: an indexable home outside its own cluster`);
  const alternates = `${HOME_CLUSTER_NOTE}
${cluster.map((l) => `<link rel="alternate" hreflang="${l.hreflang}" href="${homeUrl(l.code)}">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${homeUrl(X_DEFAULT_CURRENT)}">
`;
  const ogAlternates = cluster.filter((l) => l.code !== L.code).map((l) => `<meta property="og:locale:alternate" content="${l.ogLocale}">\n`).join('');
  return { alternates, ogAlternates, robots: HOME_INDEX };
}

function homePage(list = countries()) {
  const byIso = new Map(list.map((c) => [c.iso, c]));
  const QUICK = C.quick.map((iso) => {
    const c = byIso.get(iso);
    if (!c) throw new Error(`home: quick link ${iso} has no ${L.code} page`);
    return c;
  });
  return renderHome({ L, P, SITE, C, t, a, esc, json: (v) => JSON.stringify(String(v)), header, twins: twin('/', '/'),
    PAYBAR, FOOTER, POPULAR, QUICK, GUIDES, HEAD_ICONS, FONT_PRELOAD, LOGO_ONCE_SCRIPT_MOTION, cspMeta, indexing: homeIndexing() });
}

  /** Write every page of this language. The script first: the pages stamp asset versions from file contents. */
  function build() {
    if (!canWrite) throw new Error('build-locale-pages: a rehearsal never writes');
    const list = countries();
    const base = L.prefix;
    writeSiteI18nBundle(code);
    write(`${base}/destinations.js`, destinationsJs(list));
    write(`${base}/index.html`, stampHtml(homePage(list), join(ROOT, base)));
    for (const c of list) write(`${base}/esim/${c.slug}/index.html`, stampHtml(countryPage(c), join(ROOT, base, 'esim', c.slug)));
    write(`${base}/esim/index.html`, stampHtml(hubPage(list), join(ROOT, base, 'esim')));
    for (const g of GUIDES) write(`${base}/guides/${g.slug}/index.html`, stampHtml(guidePage(g), join(ROOT, base, 'guides', g.slug)));
    write(`${base}/guides/index.html`, stampHtml(guidesHub(), join(ROOT, base, 'guides')));
    // An English legal page is written only while seo/legal-links.mjs publishes it at this very path.
    for (const [kind, doc] of Object.entries(L.code === 'en' || LEGAL_T ? LEGAL_DOCS : {})) {
      if (INTL_LEGAL[kind] !== doc.path) continue;
      write(`${base}/${kind}/index.html`, stampHtml(legalPage(kind), join(ROOT, base, kind)));
    }
    // LEGAL-5: every frozen version at its permanent address, and the public list of versions (English only).
    if (L.code === 'en') {
      for (const snap of legalSnapshots()) {
        if (INTL_LEGAL[snap.kind] !== LEGAL_DOCS[snap.kind].path) continue;
        const rel = archivePath(snap.kind, snap.version).slice(1);
        write(`${rel}index.html`, stampHtml(legalPage(snap.kind, snap), join(ROOT, rel)));
      }
      write(VERSIONS_JSON, versionsJson());
    }
    return { countries: list.length, guides: GUIDES.length };
  }

  return Object.freeze({
    locale: L, countries, POPULAR, SKIP_LINK, header, PAYBAR, FOOTER,
    countryPage, hubPage, guidePage, guidesHub, homePage, destinationsJs, twin, privacyPage, legalPage,
    ...(canWrite ? { build } : {}),
  });
}

/** Every language this generator publishes: the enabled site languages with a prefix. */
export function publishedLocales() {
  return LOCALES.filter((l) => l.prefix && l.site.enabled).map((l) => l.code);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const code of publishedLocales()) {
    const n = localeGenerator(code).build();
    console.log(`${code}: ${n.countries} country pages + the list, destinations.js; ${n.guides} guides + the list (indexing: seo/indexing.mjs)`);
  }
}
