// The seam a human-quality content pipeline plugs into.
//
// A country page has two kinds of content, and they must never be able to mix:
//
//   FACTS      how many tariffs, which volumes, what they cost, what the
//              coverage is. These come from the Magic eSIM API and from
//              nowhere else — not from a profile, not from an editor, not from
//              a model. A profile that tries to state a price is refused.
//
//   EDITORIAL  why someone travelling there needs data, what to expect on
//              arrival, which questions people actually ask. This cannot be
//              derived from a catalogue and must not be invented by a
//              generator. It arrives as a profile, written or reviewed by a
//              person, and it is optional: a country with no profile still
//              gets a correct factual page.
//
// So the merge is one-directional. A profile may ADD prose and MAY NOT touch
// any field the catalogue owns. loadProfile() enforces that by whitelist —
// a profile key that is not in EDITORIAL_KEYS is dropped and reported, so a
// pipeline that starts writing prices finds out immediately rather than
// publishing them.
//
// FILE LAYOUT
//
//   seo/content-profiles/<slug>.json
//
// SHAPE (every field optional)
//
//   {
//     "status": "draft" | "reviewed" | "published",
//     "reviewed_by": "...", "reviewed_at": "2026-08-12",
//     "lead": "one paragraph replacing the neutral hero lead",
//     "intro": ["paragraph", "paragraph"],
//     "why": [{ "icon": "🛵", "h": "...", "p": "..." }],
//     "faq": [{ "q": "...", "a": "..." }],
//     "title": "...", "description": "...", "h1": "...",
//     "search_intent": "notes from the SEO researcher — not rendered",
//     "sources": ["url"]
//   }
//
// `status` gates rendering: only "published" profiles reach the page, so a
// draft can sit in the repository without appearing on the site.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PROFILE_DIR = join(ROOT, 'seo/content-profiles');

// The only keys a profile may carry into a page. Anything the catalogue owns
// is absent on purpose, and the absence is the enforcement.
export const EDITORIAL_KEYS = Object.freeze([
  'lead', 'intro', 'why', 'faq', 'title', 'description', 'h1',
  // { text: '… {link} …', anchor: '…' } — one contextual link to
  // /esim/dual-sim-sms/, on the pages that actually discuss the second line.
  'dual_sim_note',
  // Hand-picked neighbours for «Другие направления». Without it the block falls
  // back to alphabetical adjacency, which is right for pages nobody curated and
  // wrong for the six that were.
  'related',
]);

// Keys a profile may carry for the pipeline's own bookkeeping. Never rendered.
//
// These exist so the dashboard can answer "what state is this page in and who
// touched it last" without opening the file. None of them reaches the HTML —
// a reader has no use for a quality score, and a search engine has no use for
// an editor's note.
const META_KEYS = Object.freeze([
  'status', 'priority', 'quality_score', 'traffic_bucket',
  'search_intent', 'paa', 'related_topics', 'faq_candidates', 'sources',
  'reviewed_by', 'reviewed_at', 'last_reviewed', 'next_review',
  'editor_notes', 'notes', 'research_method',
  // Решение человека, которое никакая метрика не отменяет.
  'locked', 'locked_by', 'locked_reason', 'ab_test',
]);

// Anything resembling a catalogue fact. A profile containing one of these is
// not merely ignored — it is reported, because it means a pipeline is trying
// to state a price or a coverage claim from outside the API.
const FORBIDDEN = Object.freeze([
  'price', 'prices', 'min_price_rub', 'retail_price_rub', 'dealer_price_rub',
  'volumes', 'data_gb', 'validity_days', 'coverage', 'local_count',
  'regional_count', 'tariffs', 'packages', 'operators', 'networks',
]);

/**
 * @returns {{ profile: object|null, warnings: string[] }}
 *   `profile` is null when there is no file, when it will not parse, or when
 *   its status is not "published". A broken profile never breaks a build: the
 *   page falls back to the factual template and the warning is printed.
 */
export function loadProfile(slug) {
  const file = join(PROFILE_DIR, `${slug}.json`);
  if (!existsSync(file)) return { profile: null, warnings: [] };

  let raw;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { profile: null, warnings: [`${slug}: профиль не разбирается (${error.message}) — страница собрана по фактам`] };
  }

  const warnings = [];
  const forbidden = Object.keys(raw).filter((k) => FORBIDDEN.includes(k));
  if (forbidden.length) {
    warnings.push(`${slug}: профиль пытается задать факты каталога (${forbidden.join(', ')}) — проигнорировано`);
  }

  const unknown = Object.keys(raw)
    .filter((k) => !EDITORIAL_KEYS.includes(k) && !META_KEYS.includes(k) && !FORBIDDEN.includes(k));
  if (unknown.length) warnings.push(`${slug}: неизвестные поля профиля (${unknown.join(', ')}) — проигнорированы`);

  // QA has to look at the real page, not at a description of it — and the real
  // page only exists once the profile is merged in. So a preview build renders
  // unpublished profiles, loudly. It is an environment variable rather than a
  // flag in the file because the file is what gets committed: a page cannot go
  // live by preview simply because someone forgot to change it back.
  const preview = process.env.CONTENT_PREVIEW === '1';
  if (raw.status !== 'published') {
    if (!preview) {
      warnings.push(`${slug}: статус "${raw.status || 'нет'}" — на сайт не идёт`);
      return { profile: null, warnings };
    }
    warnings.push(`${slug}: ПРЕВЬЮ статуса "${raw.status || 'нет'}" — публиковать эту сборку нельзя`);
  }

  const profile = {};
  for (const key of EDITORIAL_KEYS) {
    if (raw[key] !== undefined) profile[key] = raw[key];
  }
  return { profile: Object.keys(profile).length ? profile : null, warnings };
}

/** Every profile on disk, for a report. */
export function listProfiles() {
  if (!existsSync(PROFILE_DIR)) return [];
  return readdirSync(PROFILE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const slug = f.replace(/\.json$/, '');
      let status = 'unreadable';
      try { status = JSON.parse(readFileSync(join(PROFILE_DIR, f), 'utf8')).status || 'нет'; } catch { /* keep */ }
      return { slug, status };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}
