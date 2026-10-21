# Adding a language to localization QA

Copy this folder to `references/<code>/` (the code from `seo/locales.mjs`: `de`, `fr`, `zh-Hans`, `ko`) and fill in:

1. `README.md` — the variant and register (DE: du or Sie; FR: tu or vous; ZH-Hans: mainland conventions; KO: 해요체 or
   합쇼체), punctuation and number conventions, what is decided and therefore never a finding.
2. `style.json` — `{ "language", "variant", "formality", "invertedPunctuation": false, "seo": { "titleMax", "descriptionMax" },
   "sameAsEnglishAllowed": [], "forbidden": [{ "id", "pattern", "severity", "category", "reason" }] }`. CJK: count
   characters, set titleMax ≈ 30.
3. `glossary.json` — `{ "doNotTranslate": [...], "terms": [{ "en", "target", "alsoAccept", "avoid", "severity", "why",
   "consistency" }] }`.
4. `platform-labels.md` — every iOS / Android / Samsung label the guides quote, read on the vendor's own page in that
   language, with the URL and the date.

The scripts need no change: the language comes from `--lang`, its strings from the storefront's registry. A language that
is not published yet cannot be extracted (there is nothing live to review).
