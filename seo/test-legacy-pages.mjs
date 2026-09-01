// The six hand-built country pages nobody was checking.
//
// WHY
//
//   `content-review.mjs` and `test-editorial-dupes.mjs` both read
//   `seo/content-profiles/*.json`. The six countries that never got a profile —
//   malaysia, maldives, mexico, brazil, greece, cyprus — are plain HTML, so
//   every editorial rule in this repo skipped them silently. An adversarial
//   review of all 46 authored pages found, in exactly those six:
//
//     * «Срок тарифа обычно отсчитывается с первого подключения к малайзийской
//       сети, так что заранее установленная eSIM дни не теряет» — on a page that
//       renders four packages whose validity starts AT INSTALLATION;
//     * «5–8 ГБ» recommended on four pages, twice each (visible FAQ and FAQPage
//       structured data). No country in the catalogue sells 8 ГБ. Mexico has no
//       7 ГБ either. The STRICT ГБ rule would have rejected it on sight.
//
//   These are the same rules the profiles already pass. The file exists because
//   a gate that reads one of two page families is a gate that reports clean.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHEETS = JSON.parse(readFileSync(join(ROOT, 'seo/fact-sheets.json'), 'utf8')).sheets;
const LEGACY = ['malaysia', 'maldives', 'mexico', 'brazil', 'greece', 'cyprus'];

// Visible prose only: drop scripts, styles and tags, keep the text a reader sees
// plus the FAQPage answers, which Google reads and which carried the same defect.
function prose(slug) {
  const html = readFileSync(join(ROOT, `esim/${slug}/index.html`), 'utf8');
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (m) => (/ld\+json/i.test(m) ? m : ' '))
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

const CYR = '[\\wа-яёА-ЯЁ]';
const EARLY_INSTALL = new RegExp(
  `(?:поставит${CYR}*|установит${CYR}*|устанавлива${CYR}*|установленн${CYR}*)[^.!?]{0,70}(?:заранее|дома|до\\s+вылета)`
  + `|(?:заранее|дома)[^.!?]{0,50}(?:поставит${CYR}*|установит${CYR}*|устанавлива${CYR}*|установленн${CYR}*)`, 'i');
const TERM_START = new RegExp(
  `срок[^.!?]{0,90}(?:начн[её]тся|начина${CYR}*|идт[иё]|отсчитыва${CYR}*|отсчит${CYR}*)[^.!?]{0,70}(?:перв${CYR}*\\s+(?:подключени|использовани)${CYR}*|подключени${CYR}*\\s+к)`, 'i');

test('legacy pages exist and are the six we think they are', () => {
  for (const s of LEGACY) assert.ok(existsSync(join(ROOT, `esim/${s}/index.html`)), `${s} отсутствует`);
});

test('every ГБ figure a legacy page recommends exists in that country', () => {
  const bad = [];
  for (const slug of LEGACY) {
    const sheet = SHEETS[slug];
    if (!sheet) continue;
    const allowed = new Set([...(sheet.volumes_gb || []), ...(sheet.daily_gb || [])]);
    for (const m of prose(slug).matchAll(/(\d+(?:[.,]\d+)?)\s*(?:ГБ|GB|гигабайт\w*)/gi)) {
      const v = Number(String(m[1]).replace(',', '.'));
      if (Number.isFinite(v) && !allowed.has(v)) bad.push(`${slug}: «${m[0].trim()}» — в каталоге таких ГБ нет (${[...allowed].sort((a, b) => a - b).join(', ')})`);
    }
  }
  assert.deepEqual([...new Set(bad)], [], `legacy-страницы называют несуществующие объёмы:\n${[...new Set(bad)].join('\n')}`);
});

test('a legacy page that advises installing early acknowledges the installation tariffs', () => {
  const bad = [];
  for (const slug of LEGACY) {
    const sheet = SHEETS[slug];
    if (!sheet || !(sheet.activation_policies || []).some((a) => a === 'installation' || a === 'upon_installation')) continue;
    const t = prose(slug);
    if ((EARLY_INSTALL.test(t) || TERM_START.test(t)) && !/после установки/i.test(t)) bad.push(slug);
  }
  assert.deepEqual(bad, [], `советуют ставить заранее, не оговаривая тарифы «после установки eSIM»: ${bad.join(', ')}`);
});

test('legacy pages carry the mandated payment wording and never soften it', () => {
  for (const slug of LEGACY) {
    const t = prose(slug);
    assert.ok(/росси[йи]ск/i.test(t), `${slug}: платёжная формулировка без «российской»`);
    for (const bad of ['любой картой', 'любую карту', 'любой банковской', 'иностранной картой', 'международной картой']) {
      assert.ok(!t.toLowerCase().includes(bad), `${slug}: запрещённая формулировка «${bad}»`);
    }
  }
});

test('the rules can fail — each fires on the defect it was written for', () => {
  assert.ok(TERM_START.test('Срок тарифа обычно отсчитывается с первого подключения к малайзийской сети.'),
    'правило обязано ловить фразу, из-за которой этот файл написан');
  assert.ok(EARLY_INSTALL.test('заранее установленная eSIM дни не теряет'), 'и совет ставить заранее');
  assert.ok(!TERM_START.test('Объём доступен до конца срока действия.'), 'и не срабатывать на честной фразе');
});
