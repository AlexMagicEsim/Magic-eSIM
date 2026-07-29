#!/usr/bin/env node
// Tests for the tariff display mappers. The landing has no bundler, so the
// mapper block is duplicated verbatim in index.html and assets/country-tariffs.js;
// this file loads BOTH copies, pins them together, and runs the same suite
// against each so they cannot drift.
//
// Run: node --test seo/test-tariff-display.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCES = {
  'index.html': join(ROOT, 'index.html'),
  'assets/country-tariffs.js': join(ROOT, 'assets/country-tariffs.js'),
};
const BLOCK_RE = /\/\* --- TARIFF DISPLAY MAPPERS[\s\S]*?END TARIFF DISPLAY MAPPERS -+ \*\//;

function extractBlock(file) {
  const match = readFileSync(file, 'utf8').match(BLOCK_RE);
  assert.ok(match, `mapper block not found in ${file}`);
  return match[0];
}

function loadMappers(file) {
  const factory = new Function(`${extractBlock(file)}
    return { tariffNetworkLabel, tariffHotspotLabel, tariffActivationLabel, tariffText,
             TARIFF_ACTIVATION_UNKNOWN, TARIFF_HOTSPOT_UNKNOWN };`);
  return factory();
}

test('the two copies of the mapper block are byte-identical', () => {
  const [a, b] = Object.values(SOURCES).map(extractBlock);
  assert.equal(a, b, 'index.html and assets/country-tariffs.js must carry the same mappers');
});

// Two homepage renderers are unreachable legacy (see the reachability test
// below) and still carry the old fabricated strings. Removing them is a
// separate refactor, deliberately kept out of this release, so the guard below
// checks the code that can actually run and skips exactly these two bodies.
const KNOWN_UNREACHABLE = ['async function loadRussiaApiPackages(){', 'function renderPackagesForCountry(countryCode){'];

// Strips a top-level `function ...(){ ... }` block that starts at column 0 and
// ends at the first column-0 closing brace.
function stripBlock(src, signature) {
  const start = src.indexOf(signature);
  if (start === -1) return src;
  const end = src.indexOf('\n}', start);
  if (end === -1) return src;
  return src.slice(0, start) + src.slice(end + 2);
}

function activeSource(file) {
  let src = readFileSync(file, 'utf8');
  for (const signature of KNOWN_UNREACHABLE) src = stripBlock(src, signature);
  return src;
}

test('no invented network fallback survives in code that can run', () => {
  // The exact substitutions that used to fabricate a technology, plus the
  // unconditional tethering promise.
  const FORBIDDEN = ["speed||'4G'", "speed || '4G'", "item.speed||'4G/5G'", "speed||'3G/4G/5G'",
    'Раздача интернета:</strong> доступна'];
  for (const [name, file] of Object.entries(SOURCES)) {
    const src = activeSource(file);
    for (const needle of FORBIDDEN) {
      assert.ok(!src.includes(needle), `${name} still contains ${needle} in reachable code`);
    }
  }
});

test('the skipped legacy renderers really are unreachable', () => {
  // If this ever fails, the fabricated strings inside those bodies became live
  // and the guard above stopped covering them.
  const src = readFileSync(SOURCES['index.html'], 'utf8');

  // loadRussiaApiPackages() bails out unless BOTH elements exist; neither does.
  for (const id of ['russiaApiPackagesGrid', 'russiaApiStatus']) {
    assert.equal(src.split(`id="${id}"`).length - 1, 0, `#${id} must not exist in the markup`);
  }
  // renderPackagesForCountry is declared and never called.
  assert.equal(src.split('renderPackagesForCountry').length - 1, 1,
    'renderPackagesForCountry must appear exactly once (its declaration)');
});

for (const [name, file] of Object.entries(SOURCES)) {
  const m = loadMappers(file);

  test(`[${name}] network: normalized array wins`, () => {
    assert.equal(m.tariffNetworkLabel({ network_technologies: ['4G', '5G'], speed: '' }), '4G/5G');
    assert.equal(m.tariffNetworkLabel({ network_technologies: ['3G', '4G', '5G'] }), '3G/4G/5G');
    // The array wins even when a legacy string is also present.
    assert.equal(m.tariffNetworkLabel({ network_technologies: ['5G'], speed: '3G/4G' }), '5G');
  });

  test(`[${name}] network: legacy speed used only when it holds generations`, () => {
    assert.equal(m.tariffNetworkLabel({ speed: '4G/LTE' }), '4G', 'LTE folds into 4G, deduped');
    assert.equal(m.tariffNetworkLabel({ speed: '5G/4G/LTE' }), '4G/5G');
    assert.equal(m.tariffNetworkLabel({ speed: '3G/4G/5G' }), '3G/4G/5G');
    assert.equal(m.tariffNetworkLabel({ speed: 'LTE' }), '4G');
  });

  test(`[${name}] network: throughput wording never becomes a generation`, () => {
    // MobiMatter's SPEED field. None of these may yield "4G".
    assert.equal(m.tariffNetworkLabel({ speed: 'Unrestricted' }), '');
    assert.equal(m.tariffNetworkLabel({ speed: 'Limited' }), '');
    assert.equal(m.tariffNetworkLabel({ speed: 'N/A' }), '');
    assert.equal(m.tariffNetworkLabel({ speed: '3GB/day at 20Mbps. 1Mbps afterwards.' }), '');
  });

  test(`[${name}] network: nothing known -> empty string, never a default`, () => {
    assert.equal(m.tariffNetworkLabel({}), '');
    assert.equal(m.tariffNetworkLabel({ speed: '' }), '');
    assert.equal(m.tariffNetworkLabel({ speed: null }), '');
    assert.equal(m.tariffNetworkLabel({ network_technologies: [] }), '');
    assert.equal(m.tariffNetworkLabel({ network_technologies: null, speed: undefined }), '');
    assert.equal(m.tariffNetworkLabel(undefined), '');
    assert.equal(m.tariffNetworkLabel(null), '');
  });

  test(`[${name}] hotspot: tri-state`, () => {
    assert.equal(m.tariffHotspotLabel({ hotspot_supported: true }), 'поддерживается');
    assert.equal(m.tariffHotspotLabel({ hotspot_supported: false }), 'не поддерживается');
    assert.equal(m.tariffHotspotLabel({ hotspot_supported: null }), m.TARIFF_HOTSPOT_UNKNOWN);
    assert.equal(m.tariffHotspotLabel({}), m.TARIFF_HOTSPOT_UNKNOWN, 'absent field is unknown');
    assert.equal(m.tariffHotspotLabel(undefined), m.TARIFF_HOTSPOT_UNKNOWN);
  });

  test(`[${name}] hotspot: truthy junk is not treated as "yes"`, () => {
    // Only a real boolean true may promise tethering.
    for (const v of ['true', 1, 'yes', {}]) {
      assert.equal(m.tariffHotspotLabel({ hotspot_supported: v }), m.TARIFF_HOTSPOT_UNKNOWN,
        `${JSON.stringify(v)} must not be read as supported`);
    }
  });

  test(`[${name}] activation: every known policy maps`, () => {
    const cases = {
      first_data_usage: 'начинается при первом использовании интернета',
      first_network_connection: 'начинается при первом подключении к поддерживаемой сети',
      network_connection: 'начинается при первом подключении к поддерживаемой сети',
      upon_installation: 'начинается после установки eSIM',
      installation: 'начинается после установки eSIM',
      upon_purchase: 'начинается после покупки',
      purchase: 'начинается после покупки',
    };
    for (const [policy, expected] of Object.entries(cases)) {
      assert.equal(m.tariffActivationLabel({ activation_policy: policy }), expected, policy);
    }
    // Case and padding tolerated.
    assert.equal(m.tariffActivationLabel({ activation_policy: '  PURCHASE ' }), 'начинается после покупки');
  });

  test(`[${name}] activation: unknown / missing degrades, never printed raw`, () => {
    for (const v of ['unknown', 'activates when the moon is full', '', null, undefined]) {
      assert.equal(m.tariffActivationLabel({ activation_policy: v }), m.TARIFF_ACTIVATION_UNKNOWN);
    }
    assert.equal(m.tariffActivationLabel({}), m.TARIFF_ACTIVATION_UNKNOWN);
    assert.equal(m.tariffActivationLabel(undefined), m.TARIFF_ACTIVATION_UNKNOWN);
    // Prototype keys must not leak a label.
    assert.equal(m.tariffActivationLabel({ activation_policy: 'constructor' }), m.TARIFF_ACTIVATION_UNKNOWN);
    assert.equal(m.tariffActivationLabel({ activation_policy: 'toString' }), m.TARIFF_ACTIVATION_UNKNOWN);
  });

  test(`[${name}] speed_note and fup_policy: only real text`, () => {
    assert.equal(m.tariffText({ speed_note: 'Full data speeds - no daily limits' }, 'speed_note'),
      'Full data speeds - no daily limits');
    assert.equal(m.tariffText({ fup_policy: '512 Kbps' }, 'fup_policy'), '512 Kbps');
    assert.equal(m.tariffText({ fup_policy: '   ' }, 'fup_policy'), '', 'whitespace is empty');
    assert.equal(m.tariffText({ fup_policy: '' }, 'fup_policy'), '');
    assert.equal(m.tariffText({ fup_policy: null }, 'fup_policy'), '');
    assert.equal(m.tariffText({}, 'fup_policy'), '');
    assert.equal(m.tariffText(undefined, 'fup_policy'), '');
    assert.equal(m.tariffText({ fup_policy: 512 }, 'fup_policy'), '', 'non-string is not rendered');
  });

  test(`[${name}] today's production payload (no new keys) stays safe`, () => {
    // Exactly the 15 keys the live API returns right now.
    const mobimatter = {
      package_id: 'x', name: 'Vietnam Plus 3 GB', data_gb: 3, validity_days: 30,
      country_code: 'VN', region: 'VN', price: 450, currency: 'RUB',
      networks: [], topup_available: false, speed: '', fup_policy: '',
      coverage_country_codes: ['VN'], coverage_countries: [], coverage_flags: '🇻🇳',
    };
    const esimaccess = { ...mobimatter, name: 'Australia 3GB 30Days', speed: '3G/4G/5G' };

    assert.equal(m.tariffNetworkLabel(mobimatter), '', 'no fabricated 4G for an empty speed');
    assert.equal(m.tariffNetworkLabel(esimaccess), '3G/4G/5G', 'legacy speed still renders');
    for (const item of [mobimatter, esimaccess]) {
      assert.equal(m.tariffHotspotLabel(item), m.TARIFF_HOTSPOT_UNKNOWN);
      assert.equal(m.tariffActivationLabel(item), m.TARIFF_ACTIVATION_UNKNOWN);
      assert.equal(m.tariffText(item, 'speed_note'), '');
      assert.equal(m.tariffText(item, 'fup_policy'), '');
    }
  });

  test(`[${name}] tomorrow's payload (new keys present) renders the real values`, () => {
    const mobimatter = {
      speed: '', fup_policy: '', network_technologies: ['4G', '5G'],
      hotspot_supported: true, activation_policy: 'network_connection',
      speed_note: 'Full data speeds - no daily limits, no throttling',
      calls_supported: false, sms_supported: false, data_only: true, unlimited: false,
    };
    assert.equal(m.tariffNetworkLabel(mobimatter), '4G/5G');
    assert.equal(m.tariffHotspotLabel(mobimatter), 'поддерживается');
    assert.equal(m.tariffActivationLabel(mobimatter),
      'начинается при первом подключении к поддерживаемой сети');
    assert.equal(m.tariffText(mobimatter, 'speed_note'),
      'Full data speeds - no daily limits, no throttling');

    const esimaccess = {
      speed: '3G/4G/5G', fup_policy: '512 Kbps', network_technologies: ['3G', '4G', '5G'],
      hotspot_supported: null, activation_policy: 'unknown', speed_note: '',
      calls_supported: null, sms_supported: null, data_only: null, unlimited: null,
    };
    assert.equal(m.tariffNetworkLabel(esimaccess), '3G/4G/5G');
    assert.equal(m.tariffHotspotLabel(esimaccess), m.TARIFF_HOTSPOT_UNKNOWN,
      'null must not become "не поддерживается"');
    assert.equal(m.tariffActivationLabel(esimaccess), m.TARIFF_ACTIVATION_UNKNOWN);
    assert.equal(m.tariffText(esimaccess, 'fup_policy'), '512 Kbps');
  });
}
