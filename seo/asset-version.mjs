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
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = new Map();

/** Восемь hex от sha256 файла. Коллизия на пяти файлах невозможна на практике. */
export function assetVersion(name) {
  if (cache.has(name)) return cache.get(name);
  const file = join(ROOT, 'assets', name);
  if (!existsSync(file)) throw new Error(`assets/${name} не существует — ссылку некуда версионировать`);
  const v = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8);
  cache.set(name, v);
  return v;
}

/**
 * Любая ссылка на assets/<файл>.css|js -> та же ссылка с ?v=<хеш>.
 * Префикс не важен: «/assets/x.js», «../assets/x.js», «../../assets/x.js».
 * Уже проставленная версия заменяется, поэтому вызов идемпотентен.
 */
export function stampUrl(url) {
  const s = String(url);
  // Только свой origin. «https://cdn.example.com/assets/x.js» тоже содержит
  // «assets/», но версионировать чужой файл мы не можем и не должны — до
  // этой проверки такой адрес валил сборку.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(s) || s.startsWith('//')) return url;
  const m = s.match(/^([^?#]*assets\/([A-Za-z0-9._-]+\.(?:css|js)))(?:\?[^#]*)?(#.*)?$/);
  if (!m) return url;
  return `${m[1]}?v=${assetVersion(basename(m[2]))}${m[3] || ''}`;
}

/**
 * href/src в HTML. Только локальные assets/, поэтому чужие CDN не трогаются.
 *
 * Это ФУНКЦИЯ, а не константа: у глобального регэкспа между вызовами живёт
 * lastIndex, поэтому `.test()` в цикле пропускает совпадения через одно —
 * на этом уже один раз ложно упала проверка покрытия.
 */
export const assetRefRe = () => /((?:href|src)=")([^"]*assets\/[A-Za-z0-9._-]+\.(?:css|js)(?:\?[^"]*)?)(")/g;

/** Есть ли в тексте хоть одна ссылка на наш ассет. */
export function hasAssetRef(html) {
  return assetRefRe().test(String(html));
}

/** Проштамповать весь HTML-текст. Возвращает новый текст. */
export function stampHtml(html) {
  return html.replace(assetRefRe(), (all, a, url, z) => a + stampUrl(url) + z);
}
