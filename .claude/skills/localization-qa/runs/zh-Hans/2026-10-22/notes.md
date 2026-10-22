# ZH-1 localization QA — notes beside the generated report (2026-10-22)

- Run: 516 strings, 1 deterministic finding left after the fixes below, 8 independent reviewers (4 linguistic, 4
  fidelity — both 04 batches read all 198 country names: 0 findings), one arbiter: **apply 10 · keep 5 · optional 10**;
  `merge.mjs --after`: 10 / 10 applied changes are on the site verbatim.
- Three twin strings fixed on the arbiter's / reviewer's own words (named in a decision's reason, not items of their own):
  `ui:site.compatAndroid` «Android 设置» → «Android 安装指南» (arbiter, with `ui:site.compatCheck`);
  `guide-activation:h1` 激活 → 开启 (arbiter, with `guide-activation:title`);
  `guide-troubleshooting:title` → «eSIM 在境外无法使用？检查什么 | Magic eSIM» (fidelity F-finding on
  `guide-compatibility:title`, which names this twin and its wording).
- Found before the AI stages by the deterministic layer (fixed in the draft, not part of the decisions):
  - text next to a link with no space («请见<a>eSIM 无法使用</a>» → «请见eSIM» on screen), three places — the link text now
    sits in “ ”; and «添加 eSIM</strong>或» (two places) — a space added. The page test read rendered runs split at the
    tag and could not see either; `seo/test-zh-site.mjs` now also reads the guides' HTML with the tags taken out.
- Tooling, not copy:
  - `check.mjs`: `style.cjk` — glossary / consistency matching with Latin-or-digit edges (a letter-edged pattern never
    matches inside Chinese: every string would have been reported); `seo.widthUnits` — title / description budgets in
    display width (a Chinese character = 2); SOURCED sentences (seo/claim-guards.mjs) are not claim findings.
  - `references/zh-Hans/`: README (decided items D1–D13), style.json (您, full-width punctuation, Chinese–Latin spacing,
    Traditional characters), glossary.json, platform-labels.md (Apple zh-cn, Pixel zh-Hans; Samsung: none — never quoted).
- Optional (recorded, not applied): L0001 (pay.finalBody 电子邮箱地址), L0002 (plan.alsoCoversMore + 国家/地区), L0003
  (homeArtCoverageValue «190 多个»), L0004 (home/hub/404 title separator «—»), L0008–L0012 (guide phrasing), F0001
  («描述文件» → «配置文件» — 描述文件 is used site-wide; a one-string change would make it inconsistent).
- Kept: C0001 (Samsung described, D13), L0013, F0006 (the mainland section is an addition, «next» still exists), F0009
  (Pixel roaming path sourced, 2926415), F0010 (Apple 118669 puts «手动输入详细信息» at the bottom of the screen).
