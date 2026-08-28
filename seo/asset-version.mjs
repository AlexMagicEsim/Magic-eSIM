#!/usr/bin/env node
// ОДИН источник версий для CSS/JS витрины.
//
// ЗАЧЕМ ЭТО СУЩЕСТВУЕТ
//
//   GitHub Pages отдаёт всё с `cache-control: max-age=600` и настроить это
//   нельзя — ни HTML, ни ассеты. HTML и CSS живут в кеше независимо, поэтому
//   после деплоя браузер до 10 минут мог сочетать НОВУЮ разметку со СТАРЫМ
//   стилем. Это не теория: 2026-08-28 карточки дневных тарифов приехали в
//   прод с новой разметкой и прошлым CSS, и выглядели сломанными у всех, кто
//   заходил на сайт раньше.
//
//   Версия в адресе это чинит на уровне ссылки: новый HTML просит URL,
//   которого в кеше нет, и получает ровно тот файл, под который он собран.
//   Старый HTML продолжает просить старый URL — и это тоже согласованная
//   пара, а не смесь. Заголовки при этом менять не нужно.
//
//   Хеш от СОДЕРЖИМОГО, а не время сборки: одинаковый файл сохраняет адрес,
//   поэтому деплой, не тронувший ассет, не сбрасывает его кеш у всех.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();

/**
 * Восемь hex от sha256 файла.
 *
 * `name` — путь от корня репозитория: «assets/country-pages.css», «app/mini.css».
 * Сначала версионировались только assets/, и Mini App остался с
 * `href="mini.css"` без версии — то есть ровно с тем рассинхроном
 * HTML↔CSS, ради которого всё это делалось.
 */
export function assetVersion(name) {
  if (cache.has(name)) return cache.get(name);
  const file = join(ROOT, name);
  if (!existsSync(file)) throw new Error(`${name} не существует — ссылку некуда версионировать`);
  const v = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);
  cache.set(name, v);
  return v;
}

/**
 * Локальная ссылка на .css/.js -> та же ссылка с ?v=<хеш>.
 *
 * `from` — каталог, относительно которого читается ссылка: для «mini.css» из
 * app/index.html это app/. Абсолютные пути («/assets/x.js») считаются от корня.
 * Уже проставленная версия заменяется, поэтому вызов идемпотентен. Чужой хост
 * и несуществующий файл возвращаются как есть: версионировать нечего.
 */
export function stampUrl(url, from = ROOT) {
  const s = String(url);
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) || s.startsWith('//')) return url;
  const m = s.match(/^([^?#]*\.(?:css|js))(?:\?[^#]*)?(#.*)?$/);
  if (!m) return url;
  const file = m[1].startsWith('/') ? join(ROOT, m[1].slice(1)) : resolve(from, m[1]);
  if (!existsSync(file)) return url;
  return `${m[1]}?v=${assetVersion(relative(ROOT, file))}${m[2] || ''}`;
}

/**
 * href/src в HTML. Только локальные assets/, поэтому чужие CDN не трогаются.
 *
 * Это ФУНКЦИЯ, а не константа: у глобального регэкспа между вызовами живёт
 * lastIndex, поэтому `.test()` в цикле пропускает совпадения через одно —
 * на этом уже один раз ложно упала проверка покрытия.
 */
export const assetRefRe = () => /((?:href|src)=")([^"]*\.(?:css|js)(?:\?[^"]*)?)(")/g;

/** Есть ли в тексте хоть одна ссылка на наш ассет. */
export function hasAssetRef(html) {
  return assetRefRe().test(String(html));
}

/** Проштамповать весь HTML-текст. Возвращает новый текст. */
export function stampHtml(html, from = ROOT) {
  return html.replace(assetRefRe(), (all, a, url, z) => a + stampUrl(url, from) + z);
}
