# DE-1 localization QA — notes beside the generated report (2026-10-22)

- Run: 516 strings, 9 deterministic findings, 8 independent reviewers (4 linguistic, 4 fidelity), one arbiter:
  apply 15 · keep 6 · optional 5. `merge.mjs --after`: 15 / 15 applied changes are on the site verbatim.
- Two strings were changed on the arbiter's own words in the reason for `guide-activation:faq1.a` («the same ambiguous
  «sie» in guide-activation:s2.body and :lead … should be fixed the same way»); they were not in its input, so the
  generated change log does not list them:
  - `guide-activation:lead` — «Installiere sie am Reisetag …» → «Installiere die eSIM am Reisetag …» (the nearest
    feminine noun was «Gültigkeit»);
  - `guide-activation:s2.body` — «<strong>Installiere sie am Reisetag</strong>» → «<strong>Installiere die eSIM am Reisetag</strong>».
- The two labels the arbiter kept but asked to source were read on Apple's German pages and added to
  `references/de/platform-labels.md` and the header of `seo/guides-de.mjs`: «Kamera» (118669) and «Kein Netz»
  (HT201415, 2026-10-22).
- One rule of `references/de/style.json` was withdrawn before the review: `capital-du` (`check.mjs` compiles patterns
  case-insensitively, so it fired on every lower-case «du»). The lower-case rule stays in the README for reviewers.
- Optional (recorded, not applied): `home.typesLead`, `guide-iphone:s5.body`, `countries:BN` («Brunei Darussalam» →
  «Brunei»), `guide-compatibility:lead`, `guide-activation:title`.
