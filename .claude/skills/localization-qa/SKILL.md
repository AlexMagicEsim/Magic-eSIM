---
name: localization-qa
description: Three-stage AI localization QA of a published Magic eSIM site language (es now; de, fr, zh-Hans, ko later) — a linguistic reviewer, an independent fidelity/terminology reviewer and an arbiter; every string compared with its English source for grammar, spelling, punctuation, natural phrasing in the chosen variant, fidelity, eSIM/mobile terminology, iOS/Android on-screen labels, SEO title/description/H1–H3, consistency, country names, placeholders and invented claims. Use when asked to review, proofread or QA a translation/localization of magicesim.store («проверь перевод», «ревью локализации», «LQA», «revisión del español», «Spanish QA»). Produces a JSON + Markdown report with source, current text, suggestion, explanation, severity and confidence per finding. Read-only: never edits translations, the site or production.
metadata:
  version: 1.1.0
  scope: project
  mode: read-only
---

# Localization QA — Magic eSIM

A three-stage review of one published site language by independent AI agents, plus deterministic checks. **There is no
native-speaker review** (owner, 2026-10-21): this skill IS the quality gate. A person (the owner) approves the resulting
PR; nothing is changed without that.

1. **Stage 1 — linguistic** (`references/review-linguistic.md`): grammar, spelling, punctuation, natural phrasing in the
   variant, register.
2. **Stage 2 — fidelity** (`references/review-fidelity.md`), independent of stage 1: meaning against the English,
   eSIM terminology and the glossary, Apple / Google / Samsung labels (only from `platform-labels.md`), SEO intent and
   budgets, placeholders, no invented features, guarantees or commercial promises.
3. **Stage 3 — arbiter** (`references/arbiter-prompt.md`): every string with a finding from either stage or the checks;
   decides `apply` (an objective error, with the final wording), `keep` (correct and clear — never changed for style) or
   `optional` (style, recorded, not applied).

## Hard limits
- **Read-only.** The skill never edits a translation, a page or production. Applying the arbiter's `apply` decisions is a
  separate, reviewed change (a PR the owner merges); `merge.mjs --after` then proves each change landed verbatim.
- **No network, no external service.** Strings never leave the machine.
- **Correct wording is not rewritten for taste.** Only `apply` decisions are applied.
- The review artifact «Revisión del español» (claude.ai `5YS2HYR4Mz6QSKFCKwnXUK`) is OPTIONAL since 2026-10-21 (no native
  review is planned); if anyone uses it, its `verdicts` stay apart from AI findings.
- Decided things are never findings (see `references/<lang>/README.md`).

## The run

```bash
S=.claude/skills/localization-qa; R=$S/runs/<lang>/<date>; mkdir -p "$R"     # add --root <checkout> to review another checkout
node $S/scripts/extract.mjs --lang es --out "$R/items.json"
node $S/scripts/check.mjs --items "$R/items.json" --out "$R/check.json"
node $S/scripts/batch.mjs --run "$R" --stage linguistic --max 110
node $S/scripts/batch.mjs --run "$R" --stage fidelity --max 110
```
- For every `$R/prompts/linguistic/*.md` and `$R/prompts/fidelity/*.md` start one agent (Agent tool, general-purpose) with
  «your whole task is in <that file>»; all in parallel. Each writes only `$R/ai/<stage>/*.json`. Do not review strings in
  the main context and do not edit agents' output.
- `node $S/scripts/batch.mjs --run "$R" --arbiter` → one agent with `$R/prompts/arbiter.md` writes `$R/arbiter/decisions.json`.
- `node $S/scripts/merge.mjs --run "$R" --commit <sha>` → `report.json` + `report.md`: the decisions, the change log
  (EN, old, new, reason, the evidence of every stage) and every finding.
- After the fixes are made in the site's sources and the pages rebuilt: extract again to `$R/after.json` and run
  `merge.mjs --run "$R" --after "$R/after.json"`: each change must show «на сайте именно этот текст».
- Commit the report, `check.json`, `ai/`, `arbiter/` and `after.json`; `items.json`, `batches/`, `prompts/`,
  `*-input.json` are regenerated (ignored by `runs/.gitignore`).

The older two-layer run (`runs/es/2026-10-21`, one reviewer + a second opinion via `--verify`-era prompts) is kept as the
first baseline; `review-prompt.md` / `verify-prompt.md` remain for reference.

## What is checked, and where
| # | Requirement | Layer |
|---|---|---|
| 1 | grammar, spelling, punctuation | stage 1; `check.mjs`: opening ¿ ¡, spacing |
| 2 | natural phrasing in the variant | stage 1 + `references/<lang>/README.md`; `check.mjs`: register words |
| 3 | fidelity to the English | stage 2; `check.mjs`: untranslated, missing |
| 4 | eSIM / mobile terminology | stage 2 + `glossary.json` |
| 5 | iOS / Android instructions | stage 2 against `platform-labels.md` (vendor pages, dated) |
| 6 | SEO title, description, H1–H3 | `check.mjs` budgets + stages 1–2 |
| 7 | terminology consistency | `check.mjs` + stage 2 |
| 8 | country names | `check.mjs` (CLDR, duplicates) + stages 1–2 |
| 9 | placeholders | `check.mjs` + `merge.mjs` (every applied change) |
| 10 | no invented features, guarantees, promises | `check.mjs` with `seo/claim-guards.mjs` + stage 2 + arbiter |

Every finding: English source, current text, suggestion, explanation, category, severity, confidence, stage, objective.

## Another language
Copy `references/_template/` to `references/<code>/` and fill it in. The language must be published (`seo/locales.mjs`).
