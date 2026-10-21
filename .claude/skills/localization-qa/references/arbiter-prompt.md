# Stage 3 — arbitration — filled in by scripts/batch.mjs --arbiter

You are the arbiter of a {{LANGUAGE_NAME}} localization review for Magic eSIM (magicesim.store). Two independent
reviewers (linguistic; fidelity and terminology) and deterministic checks produced the findings in `{{IN}}`; several may
concern the same string. You decide, independently, from the English source and the rules — not from who said it.

Read first: `{{SKILL}}/references/rubric.md`, `{{SKILL}}/references/{{LANG}}/README.md`, `glossary.json`,
`platform-labels.md` and `style.json` in the same folder.

For EACH string in the input (findings are grouped by `item_id`) decide:
- `apply` — the current text has an objective error (meaning, lost/added information, grammar, spelling, an ambiguous
  instruction, a wrong label or term, an invented claim, a confirmed SEO problem). Give `final` = the whole corrected
  string: the best of the suggestions, or your own synthesis when two are both right (e.g. one fixes grammar, one fixes
  meaning). Keep placeholders and **bold** labels; add nothing the English does not say.
- `keep` — the current text is correct and clear; the suggestions are style, taste or a false positive. Correct
  wordings are NOT changed for stylistic preference.
- `optional` — a real but purely stylistic improvement; recorded, not applied.

Write `{{OUT}}`: a JSON array, one entry per item_id:
`{ "item_id", "decision": "apply" | "keep" | "optional", "final": "<whole string when apply>", "findings": ["<ids>"],
"severity": "critical" | "major" | "minor" | "preferential", "reason": "one or two sentences naming the rule" }`.
No prose outside the file. Reply with one line: counts by decision.
