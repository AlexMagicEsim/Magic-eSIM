# FR-1 localization QA — notes beside the generated report (2026-10-22)

- Run: 516 strings, 2 deterministic findings, 8 independent reviewers (4 linguistic, 4 fidelity — fidelity 04 also checked
  all 198 entries of `FR_POUR`: no wrong article or elision), one arbiter: **apply 10 · keep 3 · optional 3**;
  `merge.mjs --after`: 10 / 10 applied changes are on the site verbatim.
- Two country names were changed through the overrides of `seo/country-names-i18n.mjs` (with their `FR_POUR` keys):
  VC «Saint-Vincent-et-les Grenadines» → «Saint-Vincent-et-les-Grenadines», SX «Sint-Maarten» → «Sint Maarten».
- Tooling, not copy:
  - `check.mjs` gained `style.frenchSpacing` (references/fr/style.json): its language-neutral «space before punctuation»
    rule fired 81 times on French no-break spaces, which French typography requires; with the switch only a space before
    «,» «.» is a finding, and a PLAIN space before «: ; ? !» is the style rule `plain-space-before-punct`. EN/ES/DE unchanged.
  - Two ASCII apostrophes right before a `<strong>` tag («l'<strong>itinérance», «d'<strong>installer») slipped past the
    typography helper and the page test (the tag splits the rendered text run). Found by two reviewers; fixed by the
    arbiter's decisions; `seo/test-fr-site.mjs` now reads the guides' HTML with the tags in place, and the
    `ascii-apostrophe` style rule also matches before a `**` (bold) in the extracted text.
- Optional (recorded, not applied): `ui:how.step4` («activez-la» → «activez l’eSIM»), `ui:quote.explain` («réservé» →
  «maintenu», with `quote.heldFor`), `countries:VA` («État de la Cité du Vatican» → «Vatican»).
- Kept the Pixel roaming path in `guide-android:s3.body` (sourced; ES/DE give it too) — finding F0008 declined.
