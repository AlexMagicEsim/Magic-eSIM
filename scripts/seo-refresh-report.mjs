#!/usr/bin/env node
// Превращает решение seo/refresh-classify.mjs в сводку, которую человек увидит
// в интерфейсе прогона. Вызывается ТОЛЬКО из шага с `if: failure()`, поэтому сам
// ничего не решает про успех и не умеет уронить прогон: печатает на stdout и
// выходит с нулём. Единственный канал, который остаётся, когда PR создать нельзя.
//
// --step    имя упавшего шага
// --inputs  файл со списком путей, изменившихся с последнего успеха;
//           отсутствие файла или слово «unknown» внутри = окно не установлено
// --run-url ссылка на прогон
// --log     файл с хвостом лога упавшего шага (необязательно)
import { readFileSync, existsSync } from 'node:fs';
import { classifyFailure, KIND } from '../seo/refresh-classify.mjs';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? '' : String(process.argv[i + 1] ?? ''); };

// Три РАЗНЫХ ответа, и путать их нельзя:
//   отсутствует файл / «unknown» → окно не установлено (null) → класс UNKNOWN;
//   «none»                       → окно пустое ([])        → гейт краснеет без
//                                   единого изменения, это КОД;
//   список путей                 → окно известно.
// Первая версия не знала слова «none» и принимала его за путь с таким именем —
// тогда «ничего не менялось» читалось как «менялся код none». Поймано на стенде,
// который исполняет тело шага, а не на глаз.
function readInputs(file) {
  if (!file || !existsSync(file)) return null;
  const raw = readFileSync(file, 'utf8').trim();
  if (!raw || raw === 'unknown') return null;
  if (raw === 'none') return [];
  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

const failedStep = arg('step');
const inputsChanged = readInputs(arg('inputs'));
const verdict = classifyFailure({ failedStep, inputsChanged });

// Что делать дальше — разное для каждого класса, и в этом весь смысл разделения.
const NEXT = {
  [KIND.DATA]: [
    'Поставщик сказал то, чего страницы говорить не вправе, ИЛИ гейт закодировал предпосылку, которую поставщик нарушил.',
    'Разбирать с данных: найти пакет в `assets/catalog.json`, сверить с тем, что утверждает гейт.',
    'Код чинить не надо, пока не доказано, что дело в нём. **Отдельно проверить, не блокирует ли этот гейт ИСПРАВЛЕНИЕ** — так было 2026-09-18, когда страницы обещали «от 600 ₽» при реальном минимуме 450 ₽.',
  ],
  [KIND.CODE]: [
    'С последнего успешного прогона изменились файлы репозитория — начинать с них, а не с каталога.',
    'Воспроизводится локально: `node seo/build-all.mjs && npm test`.',
  ],
  [KIND.AUTOMATION]: [
    'Дело не в страницах и не в каталоге, а в самом прогоне: ветка, аллоулист, лиза или окружение.',
    'Ни ветка, ни PR не тронуты — это гарантировано порядком шагов, а не аккуратностью.',
  ],
  [KIND.UNKNOWN]: [
    'Класс установить не удалось. **Обращаться как с кодом** — «данные» звучат как «это не мы» и снимают срочность.',
    'Если шаг новый, его нужно описать в `seo/refresh-classify.mjs`.',
  ],
};

const label = { [KIND.DATA]: 'ДАННЫЕ', [KIND.CODE]: 'КОД', [KIND.AUTOMATION]: 'АВТОМАТИКА', [KIND.UNKNOWN]: 'НЕ УСТАНОВЛЕНО' }[verdict.kind];

const out = [];
out.push(`## Пересборка SEO не состоялась — класс: ${label}`);
out.push('');
out.push(`**${verdict.headline}**`);
out.push('');
out.push('```');
out.push(`упавший шаг : ${failedStep || 'не определён'}`);
out.push(`класс       : ${verdict.kind}`);
out.push(`основание   : ${verdict.why}`);
out.push(`вход с последнего успеха : ${inputsChanged ? (inputsChanged.length ? inputsChanged.join(', ') : 'ничего не менялось') : 'окно не установлено'}`);
out.push('```');
out.push('');
out.push('### Что это значит');
for (const line of NEXT[verdict.kind]) out.push(`- ${line}`);
out.push('');
out.push('### Что НЕ произошло');
out.push('- Ветка `automation/catalogue-seo-refresh` не создавалась и не переписывалась.');
out.push('- Pull request не создавался и не обновлялся.');
out.push('- `main` не менялся: этот workflow в него не пишет никогда.');

/**
 * Не хвост, а САМИ ПАДЕНИЯ.
 *
 * Первая версия брала `slice(-40)` — и на инциденте, ради которого всё писалось,
 * показала бы сорок строк проходящих тестов: в том прогоне `npm test` выдал 4303
 * строки, а единственная `not ok` была на 2347-й, за 1956 строк до конца. Сводка
 * сказала бы «упал тест», что и так видно по крестику, и умолчала бы, какой
 * именно. Поэтому из TAP вынимаются блоки падений, а хвост идёт после них и
 * только как контекст.
 */
function failures(text) {
  const lines = text.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length && blocks.length < 5; i++) {
    if (!/^\s*not ok \d+/.test(lines[i])) continue;
    const block = [lines[i]];
    for (let j = i + 1; j < lines.length && block.length < 16; j++) {
      block.push(lines[j]);
      if (/^\s*\.\.\.\s*$/.test(lines[j])) break;   // конец YAML-блока TAP
      if (/^\s*not ok \d+/.test(lines[j])) { block.pop(); break; }
    }
    blocks.push(block.join('\n'));
  }
  return blocks;
}

/** Внутри ``` не должно оказаться ``` — иначе строка лога выйдет из блока. */
const fenceSafe = (t) => String(t).replace(/`{3,}/g, (m) => '\u2060'.repeat(1) + m.slice(1));

const log = arg('log');
if (log && existsSync(log)) {
  const text = readFileSync(log, 'utf8');
  const blocks = failures(text);
  const counters = text.split('\n').filter((l) => /^#\s*(pass|fail|tests)\b/.test(l.trim())).join('\n');
  if (blocks.length || counters) {
    out.push('');
    out.push(`### Что именно упало${blocks.length >= 5 ? ' (первые пять)' : ''}`);
    out.push('```');
    out.push(fenceSafe([counters, '', ...blocks].filter(Boolean).join('\n').slice(0, 6000)));
    out.push('```');
  }
  if (!blocks.length) {
    const tail = text.split('\n').slice(-30).join('\n').trim();
    if (tail) {
      // Ни одной `not ok` — значит упало не утверждение, а сам запуск.
      out.push('');
      out.push('### Хвост лога (падений TAP не найдено — упал не тест, а запуск)');
      out.push('```');
      out.push(fenceSafe(tail.slice(-3000)));
      out.push('```');
    }
  }
}

const runUrl = arg('run-url');
if (runUrl) { out.push(''); out.push(`[Полный лог прогона](${runUrl})`); }

process.stdout.write(`${out.join('\n')}\n`);
