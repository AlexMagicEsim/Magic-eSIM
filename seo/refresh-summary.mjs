// What changed, stated so a person can decide in a minute whether to merge.
//
// THIS FILE INVENTS NOTHING. Every number below is a difference between two
// states that exist on disk: the artefacts committed on main and the artefacts
// the generators just produced. Where an input is missing — most often the
// previous catalogue snapshot, which has to be found by provenance — the field
// is `null` and the rendered summary says so in words. A summary that quietly
// prints 0 for «could not determine» is worse than one that admits it: 0 is a
// finding, and a reviewer acts on findings.
//
// WHY THE RISK LEVEL IS DELIBERATELY PESSIMISTIC. It gates nothing — every level
// opens the same pull request and nothing ever merges itself. Its only job is to
// decide how hard the reviewer looks, so the cost of calling a dull change HIGH
// is thirty wasted seconds, and the cost of calling a page-deleting change LOW
// is a URL that 404s in search results. Those are not comparable, so the rules
// round towards suspicion.

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Text that came from the provider, made safe to put in a Markdown body.
 *
 * A package name is the one field here that nobody in this repository writes.
 * It reaches the pull request body inside a code span, so a backtick in it would
 * close the span and everything after would render as prose — which is enough to
 * fake a heading, hide a line, or make a removal look like an addition to a
 * reviewer skimming. It cannot reach a shell (the body is written to a file by
 * Node and passed as --body-file, never interpolated into a `run:` block), so
 * this is about what the reviewer SEES being what the data SAYS.
 *
 * Backticks and backslashes go, control characters and newlines collapse to a
 * space, and the result is capped: a name long enough to push the numbers off
 * the screen is itself a way to hide them.
 */
function safeText(v) {
  const s = String(v ?? '').replace(/[`\\]/g, '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  return s.length > 120 ? `${s.slice(0, 117)}…` : s;
}

/**
 * Claim-bearing fields of a fact sheet: what a page is ALLOWED to assert.
 *
 * THESE NAMES ARE THE SHEET'S, AND THE FIRST VERSION GOT FOUR OF THEM WRONG.
 * `topup_available`, `activation_policy`, `speed` and `fup_policy` do not exist
 * in seo/fact-sheets.json — the sheet stores `topup_yes`/`topup_no`,
 * `activation_policies`, `speeds`, `fup_policies` — so on all 199 countries both
 * sides of the comparison read `undefined`, were always equal, and the «claim
 * changed → HIGH» rule could never fire for exactly the three fields CLAUDE.md
 * records as added and gated after WAVE 3. The test did not catch it because its
 * fixture invented the same wrong names: a rule proved against a shape nobody
 * ships is §26.1 one level down, in the fixture. `test-seo-refresh.mjs` now
 * asserts this list against the real file.
 */
export const CLAIM_FIELDS = Object.freeze([
  'daily_reset_confirmed',
  'daily_reset_partial',
  'daily_throttle_continues',
  'topup_yes',
  'topup_no',
  'activation_policies',
  'speeds',
  'fup_policies',
  'has_unlimited',
  'networks',
]);

/** Counts a page prints in its hero and repeats in its FAQ. */
const COUNT_FIELDS = Object.freeze(['local_count', 'regional_count', 'daily_count', 'total_count']);

/**
 * Claim fields that are COUNTS, compared on whether they are zero.
 *
 * `topup_yes` and `topup_no` are numbers of packages, and `checkTopup` in
 * content-review.mjs decides on zero-ness alone: `if (!yes && !no) return []`,
 * then `if (yes && …)`. So 34 → 33 changes nothing a page is allowed to say,
 * while 1 → 0 changes it completely. Comparing the raw value made every ordinary
 * withdrawal register as «a factual claim changed» and pushed the run to HIGH —
 * six countries on the 2026-09-14 case, of which exactly one was a real claim
 * change. A risk level that is HIGH every time is not a risk level.
 */
const CLAIM_ZERONESS = Object.freeze(new Set(['topup_yes', 'topup_no']));

/**
 * What the grid OFFERS, as opposed to how much of it there is.
 *
 * A one-for-one swap — 20 GB withdrawn, 30 GB added at the same price — moves no
 * count and no floor, and the first version of this file reported it as «ничего
 * не сдвинулось» while every ladder on the page had changed.
 */
const SHAPE_FIELDS = Object.freeze(['volumes', 'daily_gb', 'strategy']);

const byKey = (arr, key) => new Map((arr || []).map((x) => [x[key], x]));
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);

/**
 * A floor moved «sharply» — half again as much, or into/out of existence.
 *
 * The null cases are the important half. A floor that disappears means the page
 * stops being able to quote a price at all; a floor that appears where there was
 * none means it starts. Both are bigger events than any ratio.
 */
function sharpMove(before, after) {
  const a = num(before);
  const b = num(after);
  if (a === null || b === null) return a !== b;
  if (a <= 0 || b <= 0) return true;
  const ratio = b / a;
  return ratio >= 1.5 || ratio <= 1 / 1.5;
}

/**
 * Compare two states. Every argument may be null except `cacheAfter`.
 *
 * `catalogueBefore` is the package array of the snapshot the COMMITTED artefacts
 * were built from, found by provenance rather than assumed to be the previous
 * commit — several bot refreshes can land between two rebuilds, and «the parent
 * of the last catalogue commit» would then describe the wrong pair.
 */
export function classify({
  cacheBefore, cacheAfter,
  sheetsBefore, sheetsAfter,
  catalogueBefore, catalogueAfter,
  urlsBefore, urlsAfter,
  lastmodBefore, lastmodAfter,
} = {}) {
  const before = byKey(cacheBefore?.countries, 'slug');
  const after = byKey(cacheAfter?.countries, 'slug');
  const sb = sheetsBefore?.sheets || sheetsBefore || {};
  const sa = sheetsAfter?.sheets || sheetsAfter || {};

  const appeared = [...after.keys()].filter((s) => !before.has(s)).sort();
  const disappeared = [...before.keys()].filter((s) => !after.has(s)).sort();

  const countries = [];
  for (const slug of [...after.keys()].sort()) {
    if (!before.has(slug)) continue;
    const a = before.get(slug);
    const b = after.get(slug);
    const changes = {};

    for (const f of COUNT_FIELDS) {
      if (num(a[f]) !== num(b[f])) changes[f] = { before: num(a[f]), after: num(b[f]) };
    }
    if (num(a.min_price_rub) !== num(b.min_price_rub)) {
      changes.min_price_rub = { before: num(a.min_price_rub), after: num(b.min_price_rub) };
    }
    for (const f of ['min_volume_price_rub', 'min_daily_price_rub']) {
      const x = num(sb[slug]?.[f]);
      const y = num(sa[slug]?.[f]);
      if (x !== y) changes[f] = { before: x, after: y };
    }
    for (const f of SHAPE_FIELDS) {
      if (!same(a[f], b[f])) changes[f] = { before: a[f] ?? null, after: b[f] ?? null };
    }
    const claims = {};
    for (const f of CLAIM_FIELDS) {
      const x = sb[slug]?.[f];
      const y = sa[slug]?.[f];
      const moved = CLAIM_ZERONESS.has(f)
        ? (Number(x || 0) > 0) !== (Number(y || 0) > 0)
        : !same(x, y);
      if (moved) claims[f] = { before: x ?? null, after: y ?? null };
    }
    if (Object.keys(claims).length) changes.claims = claims;

    if (Object.keys(changes).length) countries.push({ slug: safeText(slug), name: safeText(b.nameRu || slug), changes });
  }

  // Package-level movement. Null — not zero — when the originating snapshot
  // could not be identified, because «0 plans removed» is a claim.
  let plans = null;
  if (Array.isArray(catalogueBefore) && Array.isArray(catalogueAfter)) {
    const ib = new Map(catalogueBefore.map((p) => [p.package_id, p]));
    const ia = new Map(catalogueAfter.map((p) => [p.package_id, p]));
    const added = [...ia.keys()].filter((k) => !ib.has(k));
    const removed = [...ib.keys()].filter((k) => !ia.has(k));
    const describe = (p) => ({
      id: p.package_id,
      name: p.name ? safeText(p.name) : null,
      price: num(p.price),
      plan_type: p.plan_type ? safeText(p.plan_type) : null,
      daily_term_mode: p.daily_term_mode ? safeText(p.daily_term_mode) : null,
      coverage: (p.coverage_country_codes || []).slice(0, 6).map(safeText),
    });
    plans = {
      added: added.map((k) => describe(ia.get(k))),
      removed: removed.map((k) => describe(ib.get(k))),
      total_before: catalogueBefore.length,
      total_after: catalogueAfter.length,
    };
  }

  // Both sides or neither. With `urlsBefore` missing, «removed: 0» would be a
  // statement that no page was dropped, computed from an empty set — the same
  // fabricated zero this file's header forbids, and it slipped in here while the
  // header was being written.
  const knowUrls = Array.isArray(urlsBefore) && Array.isArray(urlsAfter);
  const ub = new Set(urlsBefore || []);
  const ua = new Set(urlsAfter || []);
  const urls = knowUrls ? {
    added: [...ua].filter((u) => !ub.has(u)).sort(),
    removed: [...ub].filter((u) => !ua.has(u)).sort(),
    total_before: ub.size,
    total_after: ua.size,
  } : {
    added: null, removed: null, total_before: null, total_after: urlsAfter ? ua.size : null,
  };

  let sitemapDates = null;
  if (lastmodBefore && lastmodAfter) {
    const pb = lastmodBefore.pages || {};
    const pa = lastmodAfter.pages || {};
    sitemapDates = Object.keys(pa).filter((k) => pb[k] && !same(pb[k], pa[k])).sort();
  }

  const floorsChanged = countries.filter((c) => (
    c.changes.min_price_rub || c.changes.min_volume_price_rub || c.changes.min_daily_price_rub
  )).length;
  const claimsChanged = countries.filter((c) => c.changes.claims).length;
  const countsChanged = countries.filter((c) => COUNT_FIELDS.some((f) => c.changes[f])).length;

  return {
    countries,
    appeared,
    disappeared,
    plans,
    urls,
    sitemap_dates_moved: sitemapDates,
    totals: {
      countries_affected: countries.length + appeared.length + disappeared.length,
      plans_added: plans ? plans.added.length : null,
      plans_removed: plans ? plans.removed.length : null,
      floors_changed: floorsChanged,
      claims_changed: claimsChanged,
      counts_changed: countsChanged,
      urls_added: urls.added ? urls.added.length : null,
      urls_removed: urls.removed ? urls.removed.length : null,
    },
  };
}

/**
 * LOW / MEDIUM / HIGH plus the reasons, which matter more than the label.
 *
 * HIGH is anything that changes what EXISTS (a URL, a country) or what a page
 * ASSERTS, plus a price or an assortment that moved far enough that a mistake
 * upstream is as likely an explanation as a real withdrawal. Everything else
 * that moved a number is MEDIUM. LOW is reserved for a rebuild that moved
 * nothing a reader would see.
 */
export function riskOf(summary) {
  const why = [];

  if (summary.urls.removed?.length) why.push(`удалён адрес: ${summary.urls.removed.length}`);
  if (summary.urls.removed === null) why.push('состав адресов сравнить не с чем — «до» неизвестно');
  if (summary.disappeared.length) why.push(`страна исчезла из каталога: ${summary.disappeared.join(', ')}`);
  if (summary.totals.claims_changed) why.push(`изменились фактические утверждения: у ${nCountries(summary.totals.claims_changed)}`);

  // A withdrawal is a fact about what can be bought, and `riskOf` used to ignore
  // `plans` entirely: a one-for-one swap moved no count, no floor and no claim,
  // and came out LOW while every ladder on the page had changed.
  if (summary.plans?.removed.length) why.push(`тарифов снято: ${summary.plans.removed.length}`);
  for (const c of summary.countries) {
    for (const f of SHAPE_FIELDS) {
      if (c.changes[f]) why.push(`${c.slug}: изменился состав (${f})`);
    }
    for (const f of ['min_price_rub', 'min_volume_price_rub', 'min_daily_price_rub']) {
      const ch = c.changes[f];
      if (ch && sharpMove(ch.before, ch.after)) why.push(`${c.slug}: ${f} ${ch.before} → ${ch.after}`);
    }
    const t = c.changes.total_count;
    if (t) {
      const delta = Math.abs((t.after ?? 0) - (t.before ?? 0));
      const share = t.before ? delta / t.before : 1;
      if (delta >= 5 || share >= 0.3) why.push(`${c.slug}: тарифов ${t.before} → ${t.after}`);
    }
  }
  if (why.length) return { level: 'HIGH', why };

  const med = [];
  if (summary.urls.added.length) med.push(`добавлен адрес: ${summary.urls.added.length}`);
  if (summary.appeared.length) med.push(`появилась страна: ${summary.appeared.join(', ')}`);
  if (summary.totals.floors_changed) med.push(`сдвинулись цены-полы: у ${nCountries(summary.totals.floors_changed)}`);
  if (summary.totals.counts_changed) med.push(`изменились счётчики тарифов: у ${nCountries(summary.totals.counts_changed)}`);
  if (med.length) return { level: 'MEDIUM', why: med };

  return { level: 'LOW', why: ['ни одна цифра, которую видит читатель, не сдвинулась'] };
}

const rub = (v) => (v === null || v === undefined ? '«нет данных»' : `${v} ₽`);

/**
 * A pull request body is capped at 65 536 characters by GitHub, and nothing here
 * was bounded.
 *
 * Measured rather than guessed: 198 countries plus 300 withdrawn plans renders
 * 55 901 characters — inside the limit but at 85 % of it — and withdrawing the
 * whole daily family (1340 rows, a shape this catalogue can genuinely produce)
 * renders 106 946. `gh pr create` answers 422 at that point, which means NO
 * PULL REQUEST at exactly the change that most needs reviewing. A mass
 * withdrawal is the worst thing the provider can do and the automation would
 * have gone silent for it.
 *
 * So the lists are capped and the count of what was dropped is stated. Nothing
 * is lost: summary.json carries every row, the branch diff carries every file,
 * and the seven numbers a decision rests on sit above all of it.
 */
const LIST_CAP = 60;
const BODY_CAP = 60000;

function capped(list, render) {
  const out = (list || []).slice(0, LIST_CAP).map(render);
  const rest = (list || []).length - out.length;
  if (rest > 0) out.push(`- …и ещё ${rest} — целиком в \`summary.json\` и в диффе ветки`);
  return out;
}

/**
 * «1 страна», «2 страны», «5 стран».
 *
 * Russian declines by the LAST TWO digits, which is why 11–14 are the exception
 * and why `n % 10` alone is wrong: 11 takes the same form as 5, not as 1. The
 * confirmation-code TTL in the backend was shipped with the naive rule once
 * already; the cost of getting it right is four lines.
 */
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
// Named `nCountries`, not `countries`: `classify` has a local array by that name
// and a shadowed helper is a trap for whoever edits this next.
const nCountries = (n) => `${n} ${plural(n, 'страны', 'стран', 'стран')}`;

/** The pull request body. Decision first, evidence under it. */
export function renderMarkdown(summary, meta = {}) {
  const r = riskOf(summary);
  const t = summary.totals;
  const n = (v) => (v === null ? 'не определено' : String(v));
  const L = [];

  L.push('## CATALOGUE SEO REFRESH', '');
  L.push('```');
  L.push(`Affected countries:      ${t.countries_affected}`);
  L.push(`Plans added:             ${n(t.plans_added)}`);
  L.push(`Plans removed:           ${n(t.plans_removed)}`);
  L.push(`Price floors changed:    ${t.floors_changed}`);
  L.push(`Factual claims changed:  ${t.claims_changed}`);
  L.push(`URLs added:              ${n(t.urls_added)}`);
  L.push(`URLs removed:            ${n(t.urls_removed)}`);
  L.push('');
  L.push(`RISK: ${r.level}`);
  L.push('```');
  L.push('');
  for (const w of r.why) L.push(`- ${w}`);
  L.push('');

  if (t.plans_added === null) {
    L.push('> Снимок каталога, из которого собраны текущие артефакты, определить не удалось,',
      '> поэтому добавленные и снятые тарифы НЕ посчитаны — это «не определено», а не ноль.', '');
  }

  L.push('### Страны', '');
  if (!summary.countries.length && !summary.appeared.length && !summary.disappeared.length) {
    L.push('Ни одна страна не изменилась.', '');
  }
  for (const s of summary.disappeared) {
    // The generators never delete: build-catalogue-pages.mjs only mkdir+write,
    // and CLAUDE.md §22 records that removal has to be an explicit `git rm`. The
    // first version of this line told the reviewer the page goes away, which is
    // the opposite of what merging does — the page stays, unchanged, still
    // served, still advertising an assortment that no longer exists, and because
    // it is unchanged it appears in no diff and trips no gate.
    L.push(`- **${safeText(s)}** — исчезла из каталога. **Страница НЕ удаляется автоматически:**`
      + ` \`esim/${safeText(s)}/index.html\` останется в выдаче и будет рекламировать то, чего нет.`
      + ' Удалять вручную: `git rm -r esim/' + safeText(s) + '/`');
  }
  for (const s of summary.appeared) L.push(`- **${safeText(s)}** — появилась в каталоге, страница создаётся`);
  const shownCountries = summary.countries.slice(0, LIST_CAP);
  for (const c of shownCountries) {
    L.push(`- **${c.name}** (\`${c.slug}\`)`);
    for (const f of COUNT_FIELDS) {
      if (c.changes[f]) L.push(`  - ${f}: ${c.changes[f].before} → ${c.changes[f].after}`);
    }
    for (const [f, label] of [['min_price_rub', 'минимальная цена'],
      ['min_volume_price_rub', 'пол объёмных'], ['min_daily_price_rub', 'пол посуточных']]) {
      if (c.changes[f]) L.push(`  - ${label}: ${rub(c.changes[f].before)} → ${rub(c.changes[f].after)}`);
    }
    for (const [f, v] of Object.entries(c.changes.claims || {})) {
      L.push(`  - **утверждение \`${f}\`**: ${JSON.stringify(v.before)} → ${JSON.stringify(v.after)}`);
    }
  }
  if (summary.countries.length > shownCountries.length) {
    L.push(`- …и ещё ${summary.countries.length - shownCountries.length} стран — целиком в \`summary.json\``);
  }
  L.push('');

  if (summary.plans) {
    L.push('### Тарифы', '');
    L.push(`Пакетов в каталоге: ${summary.plans.total_before} → ${summary.plans.total_after}`, '');
    const line = (verb) => (p) => `- ${verb}: \`${p.name}\` — ${rub(p.price)}, ${p.plan_type}${p.daily_term_mode ? `/${p.daily_term_mode}` : ''}, покрытие ${p.coverage.join(', ')}`;
    L.push(...capped(summary.plans.removed, line('снят')));
    L.push(...capped(summary.plans.added, line('добавлен')));
    L.push('');
  }

  L.push('### Адреса', '');
  L.push(`В карте сайта: ${n(summary.urls.total_before)} → ${n(summary.urls.total_after)}`, '');
  if (summary.urls.removed === null) {
    L.push('> Список адресов «до» недоступен, поэтому добавленные и удалённые адреса не посчитаны.');
  }
  L.push(...capped(summary.urls.removed, (u) => `- **удалён:** ${safeText(u)}`));
  L.push(...capped(summary.urls.added, (u) => `- добавлен: ${safeText(u)}`));
  if (summary.sitemap_dates_moved) {
    L.push('', `Дат \`lastmod\` сдвинулось: ${summary.sitemap_dates_moved.length}`);
  }
  L.push('');

  if (meta.changed_files) {
    L.push('### Изменённые файлы', '');
    L.push(`Всего: ${meta.changed_files.length}`, '');
    for (const f of meta.changed_files.slice(0, 40)) L.push(`- \`${safeText(f)}\``);
    if (meta.changed_files.length > 40) L.push(`- …и ещё ${meta.changed_files.length - 40}`);
    L.push('');
    if (!summary.countries.length && !summary.appeared.length && !summary.disappeared.length) {
      L.push('> Файлы изменились, но ни одна цифра, которую видит читатель, не сдвинулась.',
        '> Так выглядит движение служебных полей — штампа происхождения и счётчиков,',
        '> которые не читает ни один гейт. Это ожидаемо, а не противоречие.', '');
    }
  }

  L.push('### Происхождение', '');
  L.push(`- каталог собран из: \`${meta.catalogue_commit || 'неизвестно'}\``);
  L.push(`- \`assets/catalog.json\` сгенерирован: \`${meta.catalogue_generated_at || 'неизвестно'}\``);
  L.push(`- артефакты до пересборки собирались из снимка: \`${meta.previous_snapshot_at || 'неизвестно'}\``);
  L.push(`- ветка собрана от: \`${meta.base_commit || 'неизвестно'}\``);
  L.push('');

  L.push('### Проверки', '');
  for (const v of meta.validation || []) L.push(`- ${v}`);
  L.push('');
  L.push('---', '');
  L.push('Собрано автоматически из `node seo/build-all.mjs`. Ни один файл не редактировался руками;',
    'ни один файл вне списка сгенерированных изменён быть не может — иначе запуск падает и PR не трогает.',
    'Слияние только вручную.');

  const body = L.join('\n');
  if (body.length <= BODY_CAP) return body;

  // Last line of defence. The caps above should make this unreachable, and it
  // exists because «unreachable» is what the unbounded version was too. The HEAD
  // is kept, not the tail: the seven numbers and the risk block are what a
  // decision rests on, and they are at the top.
  const keep = body.slice(0, BODY_CAP);
  return `${keep.slice(0, keep.lastIndexOf('\n'))}\n\n---\n\n`
    + `**Тело обрезано: полная сводка — ${body.length} символов, предел GitHub — 65536.**\n`
    + 'Всё целиком лежит в `summary.json` этого прогона и в диффе ветки.';
}
