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
             tariffTextRu, TARIFF_ACTIVATION_FALLBACK, TARIFF_TEXT_RU };`);
  return factory();
}

test('the two copies of the mapper block are byte-identical', () => {
  const [a, b] = Object.values(SOURCES).map(extractBlock);
  assert.equal(a, b, 'index.html and assets/country-tariffs.js must carry the same mappers');
});

// The two unreachable renderers that used to carry these strings were deleted,
// so the guards below now scan each file whole - no exemptions.
function activeSource(file) {
  return readFileSync(file, 'utf8');
}

test('no invented network fallback survives anywhere', () => {
  // The exact substitutions that used to fabricate a technology, plus the
  // unconditional tethering promise.
  const FORBIDDEN = ["speed||'4G'", "speed || '4G'", "item.speed||'4G/5G'", "speed||'3G/4G/5G'",
    'Раздача интернета:</strong> доступна'];
  for (const [name, file] of Object.entries(SOURCES)) {
    const src = activeSource(file);
    for (const needle of FORBIDDEN) {
      assert.ok(!src.includes(needle), `${name} still contains ${needle}`);
    }
  }
});

test('no vague wording reaches the user', () => {
  // The UI must state a fact or hide the row - never hedge.
  const BANNED = ['зависит от условий конкретного тарифа', 'зависит от условий тарифа',
    'уточните перед покупкой', 'уточняйте перед покупкой', 'смотрите условия тарифа'];
  for (const [name, file] of Object.entries(SOURCES)) {
    const src = activeSource(file);
    for (const phrase of BANNED) {
      assert.ok(!src.includes(phrase), `${name} still shows the vague wording "${phrase}"`);
    }
  }
});

test('every provider string the live catalogues return has a Russian translation', () => {
  // Captured from the full provider catalogues on 2026-07-30:
  // MobiMatter SPEED (8 distinct) + SPEED_LONG (8) + eSIM Access fupPolicy (8).
  const LIVE_PROVIDER_STRINGS = [
    'Unrestricted', 'Limited', 'N/A',
    '3GB/day at 20Mbps. 1Mbps afterwards.',
    '3GB/day high speed. 1Mbps afterwards.',
    'Total 30 GB at full speed, 2Mbps speed cap afterwards',
    'Total 60 GB at full speed, 2Mbps speed cap afterwards',
    'Total 90 GB at full speed, 2Mbps speed cap afterwards',
    'Full data speeds - no daily limits, no throttling',
    '3GB/day at 20Mbps high speed. Up to 1 Mbps speed limit afterwards, resets every 24 hours. Fair usage policy applies.',
    '3GB/day without a speed limit. Up to 1 Mbps speed limit afterwards, resets every 24 hours. Fair usage policy applies.',
    'In case of exceeding daily 1 GB high-speed allowance, speed will be limited to 512 Kbps for the remainder of the day, which may impact your experience with video streaming and other data-intensive applications.',
    'No daily limits. Speed restricted to 2 Mbps if total consumption exceeds 30 GB',
    'No daily limits. Speed restricted to 2 Mbps if total consumption exceeds 60 GB',
    'No daily limits. Speed restricted to 2 Mbps if total consumption exceeds 90 GB',
    '512 Kbps', '1 Mbps', '384 Kbps', '500 Kbps', '128 Kbps', '256 Kbps', '384Kbps', '1Mbps',
    // Not returned today; covered ahead of a provider-side wording change.
    'No speed restrictions', 'Unlimited at reduced speed', 'No throttling',
    'Fair usage policy applies', 'Unlimited', 'High speed', 'Reduced speed',
    'Data only', 'Daily limit', 'No daily limits',
  ];
  // Deliberately empty: explicit "no data" markers.
  const RENDER_AS_EMPTY = new Set(['N/A']);

  for (const [name, file] of Object.entries(SOURCES)) {
    const m = loadMappers(file);
    for (const raw of LIVE_PROVIDER_STRINGS) {
      const out = m.tariffTextRu(raw);
      if (RENDER_AS_EMPTY.has(raw)) {
        assert.equal(out, '', `[${name}] "${raw}" must render as nothing`);
        continue;
      }
      assert.notEqual(out, '', `[${name}] no Russian translation for "${raw.slice(0, 60)}"`);
      assert.ok(/[а-яё]/i.test(out), `[${name}] translation of "${raw.slice(0, 40)}" is not Russian: ${out}`);
      assert.ok(!/[a-z]{4,}/i.test(out.replace(/eSIM/g, '')),
        `[${name}] translation of "${raw.slice(0, 40)}" still contains English: ${out}`);
    }
  }
});

test('the deleted legacy renderers stay deleted', () => {
  // They generated fabricated speed/FUP/tethering values and were unreachable.
  // If a name reappears, the fabricated strings can come back with it.
  const src = readFileSync(SOURCES['index.html'], 'utf8');
  for (const name of ['loadRussiaApiPackages', 'renderPackagesForCountry',
                      'isRussiaDailyApiPackage', 'isRussiaApiPackage']) {
    assert.equal(src.includes(name), false, `${name} must not come back`);
  }
  // The elements it waited for never existed; re-adding them would be a smell.
  for (const id of ['russiaApiPackagesGrid', 'russiaApiStatus']) {
    assert.equal(src.includes(`id="${id}"`), false, `#${id} must not exist in the markup`);
  }
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
    assert.equal(m.tariffHotspotLabel({ hotspot_supported: null }), '', 'no data -> row is hidden');
    assert.equal(m.tariffHotspotLabel({}), '', 'absent field -> row is hidden');
    assert.equal(m.tariffHotspotLabel(undefined), '', 'no item -> row is hidden');
  });

  test(`[${name}] hotspot: truthy junk is not treated as "yes"`, () => {
    // Only a real boolean true may promise tethering.
    for (const v of ['true', 1, 'yes', {}]) {
      assert.equal(m.tariffHotspotLabel({ hotspot_supported: v }), '',
        `${JSON.stringify(v)} must not be read as supported`);
    }
  });

  test(`[${name}] activation: every known policy maps`, () => {
    const cases = {
      first_data_usage: 'с первого использования интернета',
      first_network_connection: 'с первого подключения к сети',
      network_connection: 'с первого подключения к сети',
      upon_installation: 'после установки eSIM',
      installation: 'после установки eSIM',
      upon_purchase: 'после покупки',
      purchase: 'после покупки',
    };
    for (const [policy, expected] of Object.entries(cases)) {
      assert.equal(m.tariffActivationLabel({ activation_policy: policy }), expected, policy);
    }
    // Case and padding tolerated.
    assert.equal(m.tariffActivationLabel({ activation_policy: '  PURCHASE ' }), 'после покупки');
  });

  test(`[${name}] activation: unknown / missing degrades, never printed raw`, () => {
    for (const v of ['unknown', 'activates when the moon is full', '', null, undefined]) {
      assert.equal(m.tariffActivationLabel({ activation_policy: v }), m.TARIFF_ACTIVATION_FALLBACK);
    }
    assert.equal(m.tariffActivationLabel({}), m.TARIFF_ACTIVATION_FALLBACK);
    assert.equal(m.tariffActivationLabel(undefined), m.TARIFF_ACTIVATION_FALLBACK);
    // Prototype keys must not leak a label.
    assert.equal(m.tariffActivationLabel({ activation_policy: 'constructor' }), m.TARIFF_ACTIVATION_FALLBACK);
    assert.equal(m.tariffActivationLabel({ activation_policy: 'toString' }), m.TARIFF_ACTIVATION_FALLBACK);
  });

  test(`[${name}] speed_note and fup_policy: only real text`, () => {
    assert.equal(m.tariffText({ speed_note: 'Full data speeds - no daily limits, no throttling' }, 'speed_note'),
      'Полная скорость без ежедневных лимитов и снижения скорости.');
    assert.equal(m.tariffText({ fup_policy: '512 Kbps' }, 'fup_policy'),
      'После исчерпания лимита скорость снижается до 512 Кбит/с.');
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
      assert.equal(m.tariffHotspotLabel(item), '');
      assert.equal(m.tariffActivationLabel(item), m.TARIFF_ACTIVATION_FALLBACK);
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
    assert.equal(m.tariffActivationLabel(mobimatter), 'с первого подключения к сети');
    assert.equal(m.tariffText(mobimatter, 'speed_note'),
      'Полная скорость без ежедневных лимитов и снижения скорости.');

    const esimaccess = {
      speed: '3G/4G/5G', fup_policy: '512 Kbps', network_technologies: ['3G', '4G', '5G'],
      hotspot_supported: null, activation_policy: 'unknown', speed_note: '',
      calls_supported: null, sms_supported: null, data_only: null, unlimited: null,
    };
    assert.equal(m.tariffNetworkLabel(esimaccess), '3G/4G/5G');
    assert.equal(m.tariffHotspotLabel(esimaccess), '',
      'null must not become "не поддерживается"');
    assert.equal(m.tariffActivationLabel(esimaccess), m.TARIFF_ACTIVATION_FALLBACK);
    assert.equal(m.tariffText(esimaccess, 'fup_policy'),
      'После исчерпания лимита скорость снижается до 512 Кбит/с.');
  });
}
