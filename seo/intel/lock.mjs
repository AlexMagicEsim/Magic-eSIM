#!/usr/bin/env node
// LOCK PAGE — решение человека, которое система не может отменить.
//
// Замок живёт в самом профиле страницы, а не в отдельной базе состояний.
// Это осознанно: профиль коммитится, значит замок виден в диффе, переживает
// пересборку и не может «потеряться» вместе с временным файлом. Снять его
// можно только правкой того же файла.
//
//   node seo/intel/lock.mjs thailand "перед сезоном не трогаем" --by=Игорь
//   node seo/intel/lock.mjs --unlock thailand
//   node seo/intel/lock.mjs --list

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PROFILE_DIR } from '../content-profile.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}`));
const positional = args.filter((a) => !a.startsWith('--'));

if (flag('list')) {
  const rows = readdirSync(PROFILE_DIR).filter((f) => f.endsWith('.json')).map((f) => {
    const p = JSON.parse(readFileSync(join(PROFILE_DIR, f), 'utf8'));
    return { slug: f.replace(/\.json$/, ''), locked: p.locked === true, by: p.locked_by, why: p.locked_reason };
  }).filter((r) => r.locked);
  if (!rows.length) console.log('заблокированных страниц нет');
  for (const r of rows) console.log(`🔒 ${r.slug.padEnd(20)} ${r.by || '—'}: ${r.why || 'без причины'}`);
  process.exit(0);
}

const slug = positional[0];
if (!slug) { console.error('укажи страну: node seo/intel/lock.mjs <slug> "причина" [--by=Имя] | --unlock <slug> | --list'); process.exit(2); }

const file = join(PROFILE_DIR, `${slug}.json`);
if (!existsSync(file)) { console.error(`нет профиля ${slug} — замок ставится на профиль`); process.exit(2); }
const profile = JSON.parse(readFileSync(file, 'utf8'));

if (flag('unlock')) {
  delete profile.locked; delete profile.locked_by; delete profile.locked_reason;
  writeFileSync(file, `${JSON.stringify(profile, null, 2)}\n`);
  console.log(`🔓 ${slug} разблокирована`);
} else {
  const reason = positional[1];
  if (!reason) { console.error('причина обязательна: замок без причины через месяц никто не решится снять'); process.exit(2); }
  profile.locked = true;
  profile.locked_by = (flag('by') || '--by=не указан').split('=')[1];
  profile.locked_reason = reason;
  writeFileSync(file, `${JSON.stringify(profile, null, 2)}\n`);
  console.log(`🔒 ${slug} заблокирована: ${reason} (${profile.locked_by})`);
}
