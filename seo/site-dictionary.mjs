// The storefront's interface words for the GENERATORS — read from the one
// dictionary the browser already uses.
//
// I18N-02. Before this, a word like «How it works» lived twice: as the static
// text a generator wrote into every English page, and as `DICT.en['nav.how']`
// in `assets/site-i18n.js`, which re-fills the same element at runtime. Nothing
// held the two together, so a wording change in one left the other behind —
// and the static copy is the one a crawler and a no-JS visitor read.
//
// WHY THE SOURCE IS `assets/site-i18n.js` AND NOT A NEW JSON FILE. That script
// is shipped: 199 English pages load it under a content hash. A dictionary
// moved into JSON would have to be generated back INTO that script, changing
// its bytes and every page's stamp — the opposite of this stage's promise that
// RU/EN output stays byte-for-byte. So the shipped dictionary stays the single
// source, and the generators read it rather than repeating it. When a third
// language is enabled that file changes anyway, and its shape can be revisited
// then.
//
// IT THROWS on an unknown key or language: a generator that silently printed
// the key would ship «nav.how» to every page.
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { DICT, LANGS } = createRequire(import.meta.url)(join(ROOT, 'assets/site-i18n.js'));

export { DICT };

/** The raw dictionary value. */
export function word(lang, key) {
  if (!LANGS.includes(lang)) throw new Error(`site-dictionary: no language ${lang}`);
  const d = DICT[lang];
  if (!Object.prototype.hasOwnProperty.call(d, key)) throw new Error(`site-dictionary: no ${lang} entry for ${key}`);
  return String(d[key]);
}

/**
 * For element text. Escapes only what HTML text requires (&, <, >) — the pages
 * print apostrophes and quotes literally («can't»), and escaping them here
 * would change every page's bytes for no reader's benefit.
 */
export function text(lang, key) {
  return escapeText(word(lang, key));
}

/** For a double-quoted attribute value: text() plus the quote. */
export function attr(lang, key) {
  return escapeAttr(word(lang, key));
}

/** text()'s escaping, for a value that did not come from the dictionary (a rehearsal's words). */
export function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** attr()'s escaping. */
export function escapeAttr(value) {
  return escapeText(value).replace(/"/g, '&quot;');
}

/** The browser's reading of static text: what `textContent` will compare against. */
export function unescapeText(html) {
  return String(html).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
