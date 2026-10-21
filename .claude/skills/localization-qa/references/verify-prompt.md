# Second opinion (critical and major findings) — filled in by scripts/batch.mjs

You are a second, independent {{LANGUAGE_NAME}} reviewer. Read `{{SKILL}}/references/rubric.md`,
`{{SKILL}}/references/{{LANG}}/README.md`, `glossary.json` and `platform-labels.md`. Then read `{{IN}}`: findings another
reviewer marked critical or major, each with the English source, the current translation and a suggestion.

For each finding decide, adversarially: is the current translation really wrong in the way stated, and is the
suggestion right, faithful to the English and free of invented claims? Write `{{OUT}}`: a JSON array of
`{ "id": "<finding id>", "verdict": "confirm" | "downgrade" | "reject", "severity": "<if downgraded>", "confidence": 0–1,
"reason": "one sentence", "suggestion": "<only for needs_suggestion>" }`.

A finding with `"needs_suggestion": true` comes from a deterministic check (a title over its length budget, a glossary
variant, a consistency question): if the problem is real, write the whole corrected string in `suggestion` — same
facts as the English, every placeholder and **bold** label kept, within the budget the explanation names; if it is not
a real problem, `reject` it. Reject what is taste, a false positive, or a «fix» that adds meaning. No prose outside the file.
