# Localization QA rubric

One rubric for every language. A run produces **findings**; each finding is about ONE string and has this shape:

```json
{ "id": "A0042", "item_id": "guide-iphone:s2.body", "group": "guide-iphone", "key": "s2.body", "where": "…", "url": "…",
  "en": "English source, verbatim", "target": "current translation, verbatim",
  "suggestion": "the corrected translation of the WHOLE string (empty when the finding is a question, not a fix)",
  "explanation": "one or two sentences: what is wrong and why the suggestion is right — name the rule",
  "category": "…", "severity": "…", "confidence": 0.8, "source": "check | ai", "rule": "…" }
```

## Categories
| category | covers |
|---|---|
| `grammar` | agreement, verb forms, prepositions, articles |
| `spelling` | spelling and accents (tildes) |
| `punctuation` | punctuation, opening ¿ ¡, spaces, quotes, capitalisation |
| `fluency` | correct but unnatural, a calque, word order a native would not use |
| `accuracy` | meaning added, lost or changed against the English; untranslated text |
| `terminology` | eSIM / mobile terms, the glossary, do-not-translate words |
| `platform-label` | an iOS / Android on-screen label that is not the vendor's (references/<lang>/platform-labels.md) |
| `seo` | title / description / H1–H3: length, keyword lost, wrong intent, duplicate |
| `consistency` | one source term translated two ways |
| `country-name` | a country name a native reader would not use |
| `placeholder` | `{n}`, `{name}`… lost, renamed or added |
| `claim` | a feature, guarantee, speed, coverage, delivery or payment promise the English does not make |
| `style-variant` | register (tú/usted, vosotros) or a regional variant the language's style rules exclude |

## Severity
| severity | meaning — use the LOWEST that fits |
|---|---|
| `critical` | wrong or harmful for the customer or the business: a false promise, changed meaning of a price / term / coverage / step, a broken placeholder, offensive word, an instruction that leads the reader to the wrong setting |
| `major` | a native reader notices an error: grammar, spelling, a wrong label, a misleading term, a clearly unnatural sentence, an SEO title badly over budget |
| `minor` | small: punctuation, a slightly unnatural phrase, an inconsistency, a regional word |
| `preferential` | a matter of taste; the current text is acceptable |

## Confidence (0–1)
How sure the reviewer is that the finding is right AND the suggestion is better: 0.9+ certain (rule-based, verifiable);
0.7–0.9 a native would almost surely agree; 0.5–0.7 likely, worth a native's look; below 0.5 do not report — ask in
`explanation` of a `preferential` finding instead, or say nothing.

## Rules every reviewer follows
1. **Compare with the English, string by string.** The English is the reference for facts; the translation may restructure
   for naturalness but must not add, drop or soften a fact.
2. **Never invent.** A suggestion adds no feature, guarantee, speed, coverage, delivery promise or payment method. «No
   problem found» is a valid outcome for most strings.
3. **Quote, don't paraphrase.** `en` and `target` are verbatim; `suggestion` is the whole corrected string with every
   placeholder and every `**bold**` label kept.
4. **Labels are evidence-bound.** An on-screen label is right only if the language's platform-labels list has it. If a
   label is missing from the list, report a `platform-label` finding with confidence ≤ 0.6 asking for a source — never
   «correct» it from memory.
5. **Decided things are not findings**: the price format, the do-not-translate list, the language variant, the brand
   slogan in English, both regional labels side by side in guides.
6. **No duplicates.** One finding per problem; if a whole group repeats one problem, report it once on the first string
   and say «also in …».
7. **Avoid false positives.** If unsure whether something is an error, it is `preferential` or nothing.

Credits: the source-vs-target, accuracy-before-style approach follows `translation-reviewer` (ur-grue/autopunk-media-skills,
MIT) and the conservative «preserve meaning, voice and protected content» stance follows `proofread` (kikearciniegas, MIT);
the glossary / do-not-translate shape follows `dragoman` (hacksurvivor, MIT). No code was copied.
