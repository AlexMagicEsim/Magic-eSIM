#!/usr/bin/env node
/**
 * Builds assets/catalog.json — a read-only mirror of the public catalogue, served
 * from the same origin as the landing so the tariff list survives the API being
 * unreachable. Russian networks reach GitHub Pages reliably while they often
 * cannot reach the API's IP range at all; this file is what they fall back to.
 *
 * It is a DISPLAY cache and nothing else. Every price in it is provisional: the
 * order endpoint re-reads the package from the database and ignores anything the
 * client sends, so a stale figure here can never become a charge.
 *
 * The one rule that matters: a working cache is never replaced by a worse one.
 * Everything below is in service of that — fetch, validate, write to a temp file,
 * validate the temp file, and only then swap it in. Any failure leaves the
 * existing catalog.json untouched.
 *
 *   node scripts/update-catalog-cache.mjs           refresh from the live API
 *   node scripts/update-catalog-cache.mjs --check    validate what is on disk
 */

import { readFileSync, writeFileSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'catalog.json');
const TMP = join(ROOT, 'assets', '.catalog.json.tmp');

const API = process.env.CATALOG_API_BASE || 'https://api.magicesim.store';
const ENDPOINT = `${API}/api/v1/retail/packages`;
const FETCH_TIMEOUT_MS = 30_000;

export const SCHEMA_VERSION = 1;

/**
 * Exactly the fields index.html and assets/country-tariffs.js read off a package.
 * An allowlist rather than a blocklist: a new internal field added upstream stays
 * out by default instead of leaking until someone notices.
 */
export const ALLOWED_PACKAGE_FIELDS = [
  'package_id',              // the only identifier checkout sends to the backend
  'name',
  'country_code',
  'region',
  'coverage_country_codes',
  'coverage_flags',
  'data_gb',
  'validity_days',
  'price',                   // retail price in RUB — display only, backend re-reads it
  'networks',
  'network_technologies',
  'speed',                   // legacy provider field, still read as a network fallback
  'speed_note',
  'fup_policy',
  'hotspot_supported',
  'activation_policy',
  'topup_available',
];

/**
 * Never let these reach a public file, at any depth. Cost, margin, credentials and
 * anything that identifies a person. Checked recursively on the built object, so a
 * nested surprise fails the build rather than shipping.
 */
export const FORBIDDEN_KEY_PATTERNS = [
  /purchase_price/i, /dealer/i, /margin/i, /cost/i, /wholesale/i,
  /provider_price/i, /provider_product_id/i, /provider_payload/i, /provider_currency/i,
  /secret/i, /token/i, /api[_-]?key/i, /password/i, /credential/i,
  /email/i, /phone/i, /iccid/i, /\bqr\b/i, /activation_code/i, /lpa/i,
  /internal/i, /is_active/i, /admin/i,
];

/** A catalogue this small means something upstream broke, not that we sell less. */
export const MIN_ABSOLUTE_PACKAGES = 100;
/** …and a sudden drop against a known-good cache is equally suspect. */
export const MIN_RATIO_OF_PREVIOUS = 0.7;

/* ------------------------------------------------------------------ helpers */

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);

export function findForbiddenKeys(value, path = '$', found = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findForbiddenKeys(v, `${path}[${i}]`, found));
    return found;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEY_PATTERNS.some((re) => re.test(k))) found.push(`${path}.${k}`);
      findForbiddenKeys(v, `${path}.${k}`, found);
    }
  }
  return found;
}

/** Strips a raw API package down to the allowlist. Unknown fields simply vanish. */
export function normalizePackage(raw) {
  const out = {};
  for (const key of ALLOWED_PACKAGE_FIELDS) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}

/**
 * The same checks run on the generator's output and on whatever the browser later
 * downloads, so a file that passes here cannot be rejected at runtime for a reason
 * the build did not already look for.
 */
export function validateCatalog(doc, { previousCount = null } = {}) {
  const errors = [];
  const fail = (m) => errors.push(m);

  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    return ['catalog is not an object'];
  }
  if (doc.schema_version !== SCHEMA_VERSION) fail(`schema_version must be ${SCHEMA_VERSION}, got ${JSON.stringify(doc.schema_version)}`);
  if (typeof doc.generated_at !== 'string' || Number.isNaN(Date.parse(doc.generated_at))) fail('generated_at is not a valid ISO-8601 timestamp');
  if (doc.source !== 'production-public-api') fail(`unexpected source: ${JSON.stringify(doc.source)}`);
  if (!Array.isArray(doc.packages)) return [...errors, 'packages is not an array'];
  if (doc.packages.length === 0) fail('packages is empty');
  if (doc.package_count !== doc.packages.length) fail(`package_count ${doc.package_count} != packages.length ${doc.packages.length}`);

  if (doc.packages.length < MIN_ABSOLUTE_PACKAGES) {
    fail(`only ${doc.packages.length} packages, below the ${MIN_ABSOLUTE_PACKAGES} floor`);
  }
  if (previousCount != null && previousCount > 0) {
    const floor = Math.floor(previousCount * MIN_RATIO_OF_PREVIOUS);
    if (doc.packages.length < floor) {
      fail(`${doc.packages.length} packages is under ${Math.round(MIN_RATIO_OF_PREVIOUS * 100)}% of the previous ${previousCount} (floor ${floor})`);
    }
  }

  const ids = new Set();
  doc.packages.forEach((p, i) => {
    const at = `packages[${i}]`;
    if (!p || typeof p !== 'object') { fail(`${at} is not an object`); return; }
    const id = p.package_id;
    if (typeof id !== 'string' || !id.trim()) fail(`${at}.package_id is missing`);
    else if (ids.has(id)) fail(`${at}.package_id duplicated: ${id}`);
    else ids.add(id);

    if (typeof p.name !== 'string' || !p.name.trim()) fail(`${at}.name is missing`);
    if (!isFiniteNumber(p.price) || p.price <= 0) fail(`${at}.price is not a positive number`);
    if (!isFiniteNumber(p.data_gb) || p.data_gb <= 0) fail(`${at}.data_gb is not a positive number`);
    if (!isFiniteNumber(p.validity_days) || p.validity_days <= 0) fail(`${at}.validity_days is not a positive number`);

    for (const k of Object.keys(p)) {
      if (!ALLOWED_PACKAGE_FIELDS.includes(k)) fail(`${at}.${k} is not in the allowlist`);
    }
  });

  const forbidden = findForbiddenKeys(doc);
  if (forbidden.length) fail(`forbidden keys present: ${forbidden.slice(0, 5).join(', ')}`);

  return errors;
}

/** Stable order so an unchanged catalogue produces an identical file every run. */
function sortPackages(list) {
  return [...list].sort((a, b) => String(a.package_id).localeCompare(String(b.package_id)));
}

/** Everything except generated_at — two runs an hour apart should compare equal. */
function contentFingerprint(doc) {
  return JSON.stringify({ schema_version: doc.schema_version, source: doc.source, packages: doc.packages });
}

export function readExistingCatalog() {
  if (!existsSync(OUT)) return null;
  try { return JSON.parse(readFileSync(OUT, 'utf8')); } catch { return null; }
}

async function fetchLiveCatalogue() {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}?t=${Date.now()}`, {
      signal: ac.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status !== 200) throw new Error(`API returned HTTP ${res.status}, expected 200`);
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { throw new Error('API response is not valid JSON'); }
    if (!json || !Array.isArray(json.data)) throw new Error('API response has no data array');
    if (json.data.length === 0) throw new Error('API returned an empty catalogue');
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

function cleanupTmp() {
  try { if (existsSync(TMP)) unlinkSync(TMP); } catch { /* nothing we can do */ }
}

/* -------------------------------------------------------------------- modes */

function runCheck() {
  console.log('── проверка assets/catalog.json ──');
  if (!existsSync(OUT)) { console.error('✗ файла нет'); return 1; }
  let doc;
  try { doc = JSON.parse(readFileSync(OUT, 'utf8')); }
  catch (e) { console.error(`✗ невалидный JSON: ${e.message}`); return 1; }

  const errors = validateCatalog(doc);
  const raw = readFileSync(OUT);
  console.log(`  schema_version : ${doc.schema_version}`);
  console.log(`  generated_at   : ${doc.generated_at}`);
  console.log(`  packages       : ${doc.package_count}`);
  console.log(`  размер         : ${raw.length} байт (gzip ${gzipSync(raw).length})`);
  if (errors.length) {
    console.error(`✗ невалиден (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.error(`    - ${e}`);
    return 1;
  }
  console.log('✓ валиден');
  return 0;
}

async function runUpdate() {
  const previous = readExistingCatalog();
  const previousCount = previous && Array.isArray(previous.packages) ? previous.packages.length : null;
  console.log(`── обновление кеша каталога ──`);
  console.log(`  источник: ${ENDPOINT}`);
  console.log(`  предыдущий кеш: ${previousCount == null ? 'отсутствует' : previousCount + ' пакетов'}`);

  let rawPackages;
  try {
    rawPackages = await fetchLiveCatalogue();
  } catch (e) {
    console.error(`✗ загрузка не удалась: ${e.message}`);
    console.error('  существующий catalog.json НЕ ТРОНУТ');
    cleanupTmp();
    return 1;
  }
  console.log(`  получено пакетов: ${rawPackages.length}`);

  const doc = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source: 'production-public-api',
    package_count: rawPackages.length,
    packages: sortPackages(rawPackages.map(normalizePackage)),
  };
  doc.package_count = doc.packages.length;

  const errors = validateCatalog(doc, { previousCount });
  if (errors.length) {
    console.error(`✗ новый каталог не прошёл валидацию (${errors.length}):`);
    for (const e of errors.slice(0, 20)) console.error(`    - ${e}`);
    console.error('  существующий catalog.json НЕ ТРОНУТ');
    cleanupTmp();
    return 1;
  }

  // Identical content: keep the old file, including its generated_at, so nothing
  // is committed and no pointless Pages deploy is triggered.
  if (previous && contentFingerprint(previous) === contentFingerprint(doc)) {
    console.log('  каталог не изменился — файл оставлен как есть, коммит не нужен');
    cleanupTmp();
    return 0;
  }

  const json = JSON.stringify(doc, null, 2) + '\n';
  try {
    writeFileSync(TMP, json, 'utf8');
    // Re-read and re-validate what actually landed on disk, not what we meant to write.
    const back = JSON.parse(readFileSync(TMP, 'utf8'));
    const backErrors = validateCatalog(back, { previousCount });
    if (backErrors.length) throw new Error(`temp file failed validation: ${backErrors[0]}`);
    renameSync(TMP, OUT);            // atomic within the same filesystem
  } catch (e) {
    console.error(`✗ запись не удалась: ${e.message}`);
    console.error('  существующий catalog.json НЕ ТРОНУТ');
    cleanupTmp();
    return 1;
  }

  const raw = readFileSync(OUT);
  console.log(`✓ обновлено: ${doc.package_count} пакетов, ${raw.length} байт (gzip ${gzipSync(raw).length})`);
  console.log(`  generated_at: ${doc.generated_at}`);
  return 0;
}

/* --------------------------------------------------------------------- main */

// Compare resolved paths, not URL strings: this repo lives under a directory with
// spaces, so import.meta.url is percent-encoded and would never match argv[1].
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const code = process.argv.includes('--check') ? runCheck() : await runUpdate();
  process.exit(code);
}
