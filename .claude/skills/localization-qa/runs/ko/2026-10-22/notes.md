# KO-1 localization QA — notes beside the generated report (2026-10-22)

- Run: 516 strings, 1 deterministic finding (a glossary consistency note on the described Samsung step — kept), 8
  independent reviewers (4 linguistic, 4 fidelity — both 04 batches read all 198 country names: 0 findings), one arbiter:
  **apply 11 · keep 4 · optional 7**; `merge.mjs --after`: 11 / 11 applied changes are on the site verbatim.
- Korean-specific stage-1 check (KO-0 plan): every `{name}` template read with 이탈리아 / 일본 / 보스니아 헤르체고비나 —
  0 particle or spacing errors (only invariant particles after a name: 에서, 만, 도, 외, 포함 — owner D15; also pinned by
  seo/test-ko-site.mjs, mutation-checked). Particles after Latin words (eSIM을/이/과, iPhone이, Android에, Wi-Fi를) correct.
- Two twins fixed on the arbiter's own words (named in its reasons): the daily reset sentence also shown on the sample
  card (one source, `COPY.ko.reset`), and the older One UI note also on `guide-compatibility:s1.body`.
- **Cross-language note:** the arbiter removed the Pixel roaming path from `guide-android:s3.body` (the English names no
  path there; fidelity F03-02). In FR-1 and ZH-1 the arbiters KEPT the same sourced path (FR F0008, ZH F0009). The
  process applies each run's decision; the inconsistency is recorded for the owner — no other language was changed.
- Tooling: `references/ko/` (README with the decided items D1–D15, style.json — `cjk`, `seo.widthUnits`, 반말 endings,
  ‑해요 mixing, particles after Latin words, Chinese characters, KRW/₩, full-width punctuation, ASCII quotes —,
  glossary.json, platform-labels.md: Apple ko-kr, Pixel hl=ko, Samsung Korea service page; Samsung QR not quoted). The
  first `banmal` pattern also matched nouns ending in 지 / 니 / 해 (여행지, 피지, 카리브해): narrowed to sentence-final 반말
  endings before punctuation before the AI stages (17 false findings removed; no copy changed for it).
- `site.compatBody` deliberately does not repeat the English «most phones released after 2019 qualify» (not true of
  every Korean-market model; D12): it says support depends on the model and where it was sold (Samsung Korea's page).
- Optional (recorded, not applied): countryTitle wording «데이터 요금제(미국 달러 가격)», preview.noticeTitle (one sentence,
  «여기에서는»), home.fact3 parallel list, home.typeDailyBody / typeLocalBody / typeLocalTitle phrasing,
  home.typeRegionalBody «하나의 요금제로», preview.more «무슨 뜻인가요?», activation «이용 기간을 손해 보지 않는»,
  troubleshooting «지금 계신», compatibility nav «호환성 확인».
- Observed, not a finding (CLDR, D5): spacing before 제도 differs (케이맨 제도 / 북마리아나제도).
