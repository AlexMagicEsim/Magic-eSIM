# Korean (ko) — what «right» means on this site

- **Variant:** standard modern South Korean (표준어; 국립국어원 spelling and spacing), owner D3 (2026-10-22). Formal polite
  style (owner D1): statements in **‑습니다 / ‑ㅂ니다**, requests in **‑하세요** — as Samsung Korea's support pages; Apple
  ko-kr uses ‑합니다 / ‑하십시오 (both are the same register). Never 반말 (‑해, ‑야, ‑니?), never ‑해요 and ‑습니다 mixed
  in one text. Short UI labels are nouns («결제», «요금제 보기»).
- **Decided, not findings:** prices **«US$12.99»** (Intl ko, currency symbol — D2; never ₩/KRW); English slugs (D4); digits
  attached to units — «5GB», «500MB», «30일», «3개국» (D6); one plural form (`.one` = `.other`); the slogan in English;
  country names = CLDR + overrides (D5: 남아프리카 공화국, 중앙아프리카공화국, 도미니카공화국; 대한민국, 대만, 홍콩, 마카오
  as CLDR); the destination list grouped by initial consonant ㄱ…ㅎ; **no legal links** until the English LEGAL documents
  are published (D8; «이용약관(영어)» exists in the dictionary only for that day); `site.compatBody` does not repeat the
  English «most phones released after 2019 qualify» (not true of every Korean-market model) — it says support depends
  on the model and where it was sold (D12, Samsung Korea's service page).
- **Particles (D15):** after a `{name}` / `{names}` placeholder or a country name in a template only particles that do not
  depend on the last syllable — 의, 에서, 에, 만, 도, 외, 용, 포함 — never 을/를, 이/가, 은/는, 와/과, (으)로. After a Latin
  word the particle follows its Korean reading: **eSIM을/은/이/으로**, **iPhone을/은/이/으로**, **Android를/는/가/로**.
  A wrong particle is an objective error.
- **Typography (D6):** half-width punctuation «. , ? ! :» with a space after, none before; “ ” in prose, ‘ ’ around a
  quoted screen label (Apple ko-kr style); 띄어쓰기 by the standard; no Chinese characters; on screen `word-break: keep-all`.
- **Terminology:** see glossary.json — 요금제 (plan), 데이터 (data), 이용 기간 (validity), 활성화 (activation), 충전 (top-up),
  결제 (checkout), 이동통신사 잠금 (carrier lock, Apple ko-kr), 데이터 로밍, QR 코드, 매일 데이터 (daily), 여행지.
- **SEO:** budgets are DISPLAY WIDTH (Hangul = 2): titles ≤ 60 units, descriptions ≤ 160 units.
- **Claims:** the English is the legal reference (plus D12). 무제한, 초고속, 최고, 최저가, 1위, 보장, 즉시, 24시간, 환불, payment
  brands (카카오페이, 네이버페이, 토스페이), delivery promises — never (seo/claim-guards.mjs ko; Korean Fair Labeling and
  Advertising Act).
- **Samsung (D12):** Samsung Korea's service page names only 설정 → 연결 → SIM 관리자 → eSIM 추가; the QR, activation-code
  and roaming steps are described, never quoted.
