# Ревью локализации: ko — 2026-10-22

Строк проверено: **516** · строк с замечаниями: **22** · замечаний: **25**

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 1 |
| мелко (minor) | 22 |
| на вкус (preferential) | 2 |

| Категория | Замечаний |
|---|---|
| fluency | 12 |
| accuracy | 9 |
| grammar | 2 |
| consistency | 1 |
| claim | 1 |

Источник: механические проверки 1, ИИ-ревью 24; второе мнение подтвердило или понизило 0, отклонило 0. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 0.

## Решения арбитра

Строк с замечаниями: 22 · исправить: **11** · оставить как есть: 4 · стилистика (не применяется): 7 · внесено и подтверждено повторной выгрузкой: **11/11**

### guide-android:s1.body · мелко

guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/ko/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM manager → **Add eSIM** (on older One UI versions: SIM card manager → **Add mobile plan**).
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Было**

> SIM 설정은 보통 다음 중 한 곳에 있습니다. 이름은 브랜드와 Android 버전에 따라 다릅니다.
> • **Google Pixel:** 설정 → 네트워크 및 인터넷 → SIM → **SIM 추가** → **eSIM 설정**.
> • **Samsung Galaxy:** 설정 → 연결 → SIM 관리자 → **eSIM 추가**.
> • **다른 브랜드:** 설정에서 모바일 네트워크, SIM 또는 연결과 관련된 메뉴를 찾아보세요.
> 어디에서도 eSIM을 추가하는 옵션이 보이지 않으면 휴대전화가 eSIM을 지원하는지 확인하세요.

**Стало**

> SIM 설정은 보통 다음 중 한 곳에 있습니다. 이름은 브랜드와 Android 버전에 따라 다릅니다.
> • **Google Pixel:** 설정 → 네트워크 및 인터넷 → SIM → **SIM 추가** → **eSIM 설정**.
> • **Samsung Galaxy:** 설정 → 연결 → SIM 관리자 → **eSIM 추가**(이전 One UI 버전에서는 메뉴 이름이 다를 수 있습니다).
> • **다른 브랜드:** 설정에서 모바일 네트워크, SIM 또는 연결과 관련된 메뉴를 찾아보세요.
> 어디에서도 eSIM을 추가하는 옵션이 보이지 않으면 휴대전화가 eSIM을 지원하는지 확인하세요.

**Причина:** Rule 1 (accuracy): the English gives the older One UI path and the Korean dropped it; the labels are not in platform-labels.md (D12), so the difference is described, not quoted. C0001 is covered by the same fix. The same omission is reported for guide-compatibility:s1.body (not an item of this input).

**Независимые проверки:** fidelity A0020 (accuracy, мелко, 0.6); check C0001 (consistency, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### ui:footer.about · мелко

footer — [на сайте](https://magicesim.store/ko/)

**EN**

> Travel eSIM data plans for 190+ destinations, with prices in US dollars.

**Было**

> 190개 이상의 여행지에서 이용할 수 있는 여행용 eSIM 데이터 요금제, 가격은 미국 달러 기준입니다.

**Стало**

> 190개 이상의 여행지에서 이용할 수 있는 여행용 eSIM 데이터 요금제입니다. 가격은 미국 달러 기준입니다.

**Причина:** Grammar: a noun phrase is comma-spliced to a full ‑입니다 sentence; two well-formed sentences, meaning unchanged.

**Независимые проверки:** linguistic A0002 (grammar, мелко, 0.8) · плейсхолдеры сохранены · на сайте именно этот текст

### daily:reset · мелко

daily plan card — [на сайте](https://magicesim.store/ko/esim/thailand/#dailyBlock)

**EN**

> The allowance resets every 24 hours

**Было**

> 데이터는 24시간마다 초기화됩니다

**Стало**

> 데이터 제공량은 24시간마다 초기화됩니다

**Причина:** Accuracy / ambiguity (rule 1): the English resets the ALLOWANCE; «데이터는 … 초기화됩니다» can read as the data being wiped. Both reviewers agree. The same sentence appears in daily:sample-card and should follow.

**Независимые проверки:** linguistic A0007 (fluency, мелко, 0.6); fidelity A0019 (accuracy, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:s5.body · мелко

guide «How to install an eSIM on iPhone», section 5 — [на сайте](https://magicesim.store/ko/guides/iphone/#help)

**EN**

> Check that the eSIM is the line chosen for cellular data and that data roaming is on for it, then restart the phone. The full checklist is in eSIM not working.
> **Do not delete the eSIM** while troubleshooting: its QR code may be single-use, and you may not be able to install it again.

**Было**

> eSIM이 데이터용 회선으로 선택되어 있고 데이터 로밍이 켜져 있는지 확인한 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 eSIM이 작동하지 않을 때에서 확인할 수 있습니다.
> 문제를 해결하는 동안 **eSIM을 삭제하지 마세요**. QR 코드는 한 번만 사용할 수 있는 경우가 있어 다시 설치하지 못할 수 있습니다.

**Стало**

> eSIM이 데이터용 회선으로 선택되어 있고 데이터 로밍이 켜져 있는지 확인한 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 eSIM이 작동하지 않을 때 가이드에서 확인할 수 있습니다.
> 문제를 해결하는 동안 **eSIM을 삭제하지 마세요**. QR 코드는 한 번만 사용할 수 있는 경우가 있어 다시 설치하지 못할 수 있습니다.

**Причина:** Grammar/clarity: «때에서» after the link text reads as «at the time, in» and garbles the cross-reference; «… 때 가이드에서» names the page and keeps the link text intact.

**Независимые проверки:** linguistic A0009 (fluency, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-android:s4.body · мелко

guide «How to install an eSIM on Android», section 4 — [на сайте](https://magicesim.store/ko/guides/android/#help)

**EN**

> Check the data SIM and roaming on the eSIM, toggle airplane mode, then restart. The full checklist is in eSIM not working.
> **Do not delete the eSIM** while troubleshooting: its QR code may be single-use.

**Было**

> 데이터용으로 선택된 SIM과 eSIM의 로밍 설정을 확인하고, 비행기 탑승 모드를 켰다가 끈 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 eSIM이 작동하지 않을 때에서 확인할 수 있습니다.
> 문제를 해결하는 동안 **eSIM을 삭제하지 마세요**. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다.

**Стало**

> 데이터용으로 선택된 SIM과 eSIM의 로밍 설정을 확인하고, 비행기 탑승 모드를 켰다가 끈 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 eSIM이 작동하지 않을 때 가이드에서 확인할 수 있습니다.
> 문제를 해결하는 동안 **eSIM을 삭제하지 마세요**. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다.

**Причина:** Same cross-reference error as guide-iphone:s5.body («때에서»); fixed the same way for consistency.

**Независимые проверки:** linguistic A0010 (fluency, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:s4.body · мелко

guide «When to install and turn on your eSIM», section 4 — [на сайте](https://magicesim.store/ko/guides/activation/#landed)

**EN**

> • Turn the eSIM line on, if it is off.
> • Choose the eSIM for mobile data.
> • Turn on data roaming for the eSIM.
> • Wait one to three minutes. No network? Turn airplane mode on and off.
> • Still nothing? Go through eSIM not working.

**Было**

> • eSIM 회선이 꺼져 있으면 켭니다.
> • eSIM을 모바일 데이터용으로 선택합니다.
> • eSIM의 데이터 로밍을 켭니다.
> • 1~3분 기다립니다. 신호가 없다면 비행기 탑승 모드를 켰다가 끕니다.
> • 그래도 안 되면 eSIM이 작동하지 않을 때를 확인하세요.

**Стало**

> • eSIM 회선이 꺼져 있으면 켭니다.
> • eSIM을 모바일 데이터용으로 선택합니다.
> • eSIM의 데이터 로밍을 켭니다.
> • 1~3분 기다립니다. 신호가 없다면 비행기 탑승 모드를 켰다가 끕니다.
> • 그래도 안 되면 eSIM이 작동하지 않을 때 가이드를 확인하세요.

**Причина:** «…때를 확인하세요» reads as «check the time when…» — an ambiguous instruction; «… 때 가이드를 확인하세요» names the page.

**Независимые проверки:** linguistic A0011 (fluency, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:title · важно

guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/ko/guides/activation/)

**EN**

> When to install and turn on a travel eSIM | Magic eSIM

**Было**

> 여행용 eSIM 설치 및 켜는 시기 | Magic eSIM

**Стало**

> 여행용 eSIM을 설치하고 켜는 시기 | Magic eSIM

**Причина:** Grammar: «설치 및 켜는» coordinates a noun with a verb modifier; «설치하고 켜는» is parallel, matches the H1 and stays well under 60 width units.

**Независимые проверки:** linguistic A0012 (grammar, важно, 0.8) · плейсхолдеры сохранены · на сайте именно этот текст

### ui:how.step4 · мелко

home → how it works — [на сайте](https://magicesim.store/ko/#how)

**EN**

> Land, switch it on, and you are online.

**Было**

> 도착 후 eSIM을 켜면 바로 연결됩니다.

**Стало**

> 도착 후 eSIM을 켜면 연결됩니다.

**Причина:** Claim rule (rule 2; README: immediacy promises like 즉시 are excluded): «바로» adds an immediate-connection promise the English does not make, while the guides say to wait one to three minutes.

**Независимые проверки:** fidelity A0015 (claim, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-android:s3.body · мелко

guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/ko/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Было**

> • eSIM이 켜져 있는지 확인합니다. Pixel: 설정 → 네트워크 및 인터넷 → 모바일 네트워크 → eSIM → **이 SIM 사용**.
> • eSIM을 **모바일 데이터**용 SIM으로 선택합니다. Pixel: 설정 → 네트워크 및 인터넷 → SIM → **모바일 데이터**. 기본 SIM은 통화와 문자에 계속 사용할 수 있습니다.
> • eSIM의 **로밍**을 켭니다. Pixel: 설정 → 네트워크 및 인터넷 → SIM → **로밍**. Samsung: 연결 아래의 모바일 네트워크 설정에서 찾아보세요. 정확한 이름은 모델에 따라 다릅니다. 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.
> • 기존 이동통신사의 요금이 부과되지 않게 하려면 기본 SIM의 데이터 로밍을 끄세요.
> • 휴대전화가 현지 네트워크에 등록될 때까지 1~2분 기다립니다.

**Стало**

> • eSIM이 켜져 있는지 확인합니다. Pixel: 설정 → 네트워크 및 인터넷 → 모바일 네트워크 → eSIM → **이 SIM 사용**.
> • eSIM을 **모바일 데이터**용 SIM으로 선택합니다. Pixel: 설정 → 네트워크 및 인터넷 → SIM → **모바일 데이터**. 기본 SIM은 통화와 문자에 계속 사용할 수 있습니다.
> • eSIM의 **로밍**을 켭니다. Samsung: 연결 아래의 모바일 네트워크 설정에서 찾아보세요. 정확한 이름은 모델에 따라 다릅니다. 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.
> • 기존 이동통신사의 요금이 부과되지 않게 하려면 기본 SIM의 데이터 로밍을 끄세요.
> • 휴대전화가 현지 네트워크에 등록될 때까지 1~2분 기다립니다.

**Причина:** Rule 1/2: the Korean adds a Pixel roaming path the English does not give, and that path skips selecting the eSIM inside SIM; removed so the step says only what the English says (Samsung described per D12).

**Независимые проверки:** fidelity A0021 (accuracy, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-compatibility:faq1.q · мелко

guide «Does your phone support eSIM?», question 1 — [на сайте](https://magicesim.store/ko/guides/compatibility/#faq)

**EN**

> My phone takes two SIM cards. Does that mean it has eSIM?

**Было**

> 듀얼 SIM 휴대전화라면 eSIM을 지원하나요?

**Стало**

> SIM 카드가 두 장 들어가는 휴대전화라면 eSIM도 지원하나요?

**Причина:** Accuracy: the English asks about a phone taking two physical SIM cards; Korean «듀얼 SIM» also covers SIM + eSIM phones, which makes the question near-circular. Naming the two cards restores the meaning.

**Независимые проверки:** fidelity A0023 (accuracy, мелко, 0.65) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-troubleshooting:faq2.a · мелко

guide «eSIM not working — what to check», answer 2 — [на сайте](https://magicesim.store/ko/guides/troubleshooting/#faq)

**EN**

> Often not: a QR code may be single-use. That is why the checklist tells you not to delete the eSIM.

**Было**

> 대개는 할 수 없습니다. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다. 그래서 점검 목록에서 eSIM을 삭제하지 말라고 안내합니다.

**Стало**

> 다시 설치할 수 없는 경우가 많습니다. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다. 그래서 점검 목록에서 eSIM을 삭제하지 말라고 안내합니다.

**Причина:** Accuracy (rule 1): «대개는 할 수 없습니다» strengthens the English hedge «Often not»; synthesis keeps the hedge and names the action explicitly (clearer than the suggested «그렇지 않은 경우가 많습니다»).

**Независимые проверки:** fidelity A0024 (accuracy, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### Стилистика — записано, не применяется

- ui:preview.noticeTitle: Meaning is correct; «이 사이트» matches «here» on a site-wide notice, so F0004 is not an error. Joining the two clauses (L0001) is a stylistic improvement only.
- ui:home.fact3: The list is understandable and correct; making the three items parallel is a style choice.
- ui:home.typeDailyBody: «여행 기간 전체에 하나의 용량이 아니라» is grammatical and keeps the meaning; the suggested wording is only smoother.
- guide-activation:s2.body: «날짜를 손해 보지 않는» is unidiomatic but the meaning is recoverable from context; «이용 기간을 손해 보지 않는» is a better wording, recorded as optional.
- guide-troubleshooting:s1.body: Mixing the honorific question with plain «있는» in the following clause is acceptable Korean; uniform «계신» is a style refinement.
- ui:preview.more: «자세히 보기» is a standard, correct disclosure label; «What this means» nuance is a stylistic improvement, not a factual change.
- guide-compatibility:nav: «지원 기기» is a common nav label; it may suggest a device list the page does not publish, but the wording is not wrong — optional.

### Оставлено как есть

- ui:home.typeLocalBody: Correct and clear; the repeated «정해진» mirrors the English «set … set» — taste, not an error.
- ui:home.typeLocalTitle: «한 국가 요금제» is correct and clear; «단일 국가» is a stylistic preference.
- page:countryTitle: Within budget, keyword kept, meaning correct; the rewording is taste.
- ui:home.typeRegionalBody: «여러 국가에서 쓸 수 있는 요금제» already denotes one plan across several countries; no fact is lost.

## Все замечания этапов

## guide-activation

### A0012 · важно · grammar · уверенность 0.8 · linguistic · объективное

`title` — guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/ko/guides/activation/)

**EN**

> When to install and turn on a travel eSIM | Magic eSIM

**Сейчас**

> 여행용 eSIM 설치 및 켜는 시기 | Magic eSIM

**Предложение**

> 여행용 eSIM을 설치하고 켜는 시기 | Magic eSIM

**Почему:** «및» joins the noun 설치 with the verb modifier 켜는 — the two coordinated members are not parallel (설치 및 켜는 시기 is ungrammatical coordination). «설치하고 켜는» makes both verbs modify 시기, matching the H1 «eSIM을 설치하고 켜는 시기»; width stays well under 60. · правило `ko-linguistic` · ai

### A0011 · мелко · fluency · уверенность 0.7 · linguistic

`s4.body` — guide «When to install and turn on your eSIM», section 4 — [на сайте](https://magicesim.store/ko/guides/activation/#landed)

**EN**

> • Turn the eSIM line on, if it is off.
> • Choose the eSIM for mobile data.
> • Turn on data roaming for the eSIM.
> • Wait one to three minutes. No network? Turn airplane mode on and off.
> • Still nothing? Go through eSIM not working.

**Сейчас**

> • eSIM 회선이 꺼져 있으면 켭니다.
> • eSIM을 모바일 데이터용으로 선택합니다.
> • eSIM의 데이터 로밍을 켭니다.
> • 1~3분 기다립니다. 신호가 없다면 비행기 탑승 모드를 켰다가 끕니다.
> • 그래도 안 되면 eSIM이 작동하지 않을 때를 확인하세요.

**Предложение**

> • eSIM 회선이 꺼져 있으면 켭니다.
> • eSIM을 모바일 데이터용으로 선택합니다.
> • eSIM의 데이터 로밍을 켭니다.
> • 1~3분 기다립니다. 신호가 없다면 비행기 탑승 모드를 켰다가 끕니다.
> • 그래도 안 되면 eSIM이 작동하지 않을 때 가이드를 확인하세요.

**Почему:** Same problem as guide-iphone:s5.body: «…때를 확인하세요» («check the time when…») is unnatural; «… 때 가이드를 확인하세요» names the page. · правило `ko-linguistic` · ai

### A0013 · мелко · fluency · уверенность 0.6 · linguistic

`s2.body` — guide «When to install and turn on your eSIM», section 2 — [на сайте](https://magicesim.store/ko/guides/activation/#validity)

**EN**

> It depends on the plan. Some plans start counting when the eSIM first connects to a network at the destination or first uses data. Others start as soon as the eSIM is installed.
> Because of that, the advice that never costs you days is to **install on the day you travel** — at home before you leave or on airport Wi-Fi — and to switch the eSIM on for data once you land.

**Сейчас**

> 요금제에 따라 다릅니다. 여행지에서 eSIM이 처음 네트워크에 연결되거나 처음 데이터를 사용할 때 시작되는 요금제도 있고, eSIM을 설치하는 순간 시작되는 요금제도 있습니다.
> 그래서 날짜를 손해 보지 않는 방법은 **출발 당일에 eSIM을 설치하고**(집에서 떠나기 전이나 공항 Wi-Fi로) 도착한 뒤 데이터를 켜는 것입니다.

**Предложение**

> 요금제에 따라 다릅니다. 여행지에서 eSIM이 처음 네트워크에 연결되거나 처음 데이터를 사용할 때 시작되는 요금제도 있고, eSIM을 설치하는 순간 시작되는 요금제도 있습니다.
> 그래서 이용 기간을 손해 보지 않는 방법은 **출발 당일에 eSIM을 설치하고**(집에서 떠나기 전이나 공항 Wi-Fi로) 도착한 뒤 데이터를 켜는 것입니다.

**Почему:** «날짜를 손해 보다» («lose dates») is not idiomatic; what the reader may lose is days of the validity — «이용 기간을 손해 보지 않는» uses the glossary term and reads naturally. · правило `ko-linguistic` · ai

## ui

### A0002 · мелко · grammar · уверенность 0.8 · linguistic · объективное

`footer.about` — footer — [на сайте](https://magicesim.store/ko/)

**EN**

> Travel eSIM data plans for 190+ destinations, with prices in US dollars.

**Сейчас**

> 190개 이상의 여행지에서 이용할 수 있는 여행용 eSIM 데이터 요금제, 가격은 미국 달러 기준입니다.

**Предложение**

> 190개 이상의 여행지에서 이용할 수 있는 여행용 eSIM 데이터 요금제입니다. 가격은 미국 달러 기준입니다.

**Почему:** A noun phrase and a full sentence are spliced with a comma («요금제, 가격은 … 기준입니다»), which is not a well-formed Korean sentence; split into two ‑입니다 sentences. · правило `ko-linguistic` · ai

### A0003 · мелко · fluency · уверенность 0.75 · linguistic

`home.fact3` — home — [на сайте](https://magicesim.store/ko/)

**EN**

> Country, regional and daily plans

**Сейчас**

> 국가별, 지역, 매일 데이터 요금제

**Предложение**

> 국가, 지역, 매일 데이터 요금제

**Почему:** The list mixes 국가별 with bare 지역, so the three items are not parallel; use the same form for each (국가 / 지역 / 매일 데이터). · правило `ko-linguistic` · ai

### A0001 · мелко · fluency · уверенность 0.75 · linguistic

`preview.noticeTitle` — payment notice under the header — [на сайте](https://magicesim.store/ko/esim/thailand/)

**EN**

> Online payment isn't available yet — plans can't be bought here yet

**Сейчас**

> 아직 온라인 결제를 지원하지 않습니다. 이 사이트에서는 아직 요금제를 구매할 수 없습니다

**Предложение**

> 아직 온라인 결제를 지원하지 않아 이 사이트에서는 요금제를 구매할 수 없습니다

**Почему:** Two sentences each with 아직 read as a stutter in one heading, and the first ends with a period while the second does not; one sentence joined with ‑아 is the natural Korean heading. · правило `ko-linguistic` · ai

### A0004 · мелко · fluency · уверенность 0.7 · linguistic

`home.typeDailyBody` — home — [на сайте](https://magicesim.store/ko/)

**EN**

> A data allowance for each day of the trip, rather than one amount for the whole stay.

**Сейчас**

> 여행 기간 전체에 하나의 용량이 아니라 매일 일정한 데이터가 제공됩니다.

**Предложение**

> 여행 기간 전체에 쓸 하나의 용량 대신 여행하는 날마다 일정한 데이터가 제공됩니다.

**Почему:** «여행 기간 전체에 하나의 용량이 아니라» lacks a verb for 전체에 and reads as a calque of «rather than one amount for the whole stay»; «… 쓸 하나의 용량 대신» is the natural construction. · правило `ko-linguistic` · ai

### A0016 · мелко · accuracy · уверенность 0.6 · fidelity

`preview.more` — payment notice under the header — [на сайте](https://magicesim.store/ko/esim/thailand/)

**EN**

> What this means

**Сейчас**

> 자세히 보기

**Предложение**

> 무슨 뜻인가요?

**Почему:** «What this means» opens an explanation of the payment notice; «자세히 보기» is the same text as site.choose («View details») and no longer says it explains the notice. Nuance, not a factual change. · правило `meaning-preserved` · ai

### A0017 · мелко · accuracy · уверенность 0.55 · fidelity

`home.typeRegionalBody` — home — [на сайте](https://magicesim.store/ko/)

**EN**

> One plan for several countries, for a trip that crosses borders. Each plan lists the countries it covers.

**Сейчас**

> 국경을 넘는 여행을 위해 여러 국가에서 쓸 수 있는 요금제입니다. 요금제마다 이용 국가가 표시됩니다.

**Предложение**

> 국경을 넘는 여행을 위해 하나의 요금제로 여러 국가에서 이용할 수 있습니다. 요금제마다 이용 국가가 표시됩니다.

**Почему:** The English stresses ONE plan for several countries; the Korean says «a plan usable in several countries» and drops «one». Small loss of the point of the sentence. · правило `meaning-preserved` · ai

### A0015 · мелко · claim · уверенность 0.55 · fidelity

`how.step4` — home → how it works — [на сайте](https://magicesim.store/ko/#how)

**EN**

> Land, switch it on, and you are online.

**Сейчас**

> 도착 후 eSIM을 켜면 바로 연결됩니다.

**Предложение**

> 도착 후 eSIM을 켜면 연결됩니다.

**Почему:** «바로» (right away) adds an immediacy the English «Land, switch it on, and you are online» does not state; connection timing depends on the local network. Rule 2 (never invent a delivery/speed promise) — mild, so preferential-level wording fix. · правило `no-added-claim` · ai

### A0018 · мелко · accuracy · уверенность 0.55 · fidelity

`preview.noticeTitle` — payment notice under the header — [на сайте](https://magicesim.store/ko/esim/thailand/)

**EN**

> Online payment isn't available yet — plans can't be bought here yet

**Сейчас**

> 아직 온라인 결제를 지원하지 않습니다. 이 사이트에서는 아직 요금제를 구매할 수 없습니다

**Предложение**

> 아직 온라인 결제를 지원하지 않습니다. 여기에서는 아직 요금제를 구매할 수 없습니다

**Почему:** «here» became «이 사이트에서는» (on this site); the same notice elsewhere says «this page» (price.currencyNote «이 페이지에서는»). «이 사이트» could read as the whole magicesim.store, which is broader than the English. Keep it local. · правило `meaning-preserved` · ai

### A0005 · на вкус · fluency · уверенность 0.6 · linguistic

`home.typeLocalBody` — home — [на сайте](https://magicesim.store/ko/)

**EN**

> A set amount of data for one country, valid for a set number of days.

**Сейчас**

> 한 국가에서 정해진 일수 동안 쓸 수 있는 정해진 데이터입니다.

**Предложение**

> 한 국가에서 정해진 일수 동안 쓸 수 있는 일정한 용량의 데이터입니다.

**Почему:** «정해진» repeats twice in one short sentence («정해진 일수 … 정해진 데이터»); 일정한 용량의 데이터 avoids the repetition. · правило `ko-linguistic` · ai

### A0006 · на вкус · fluency · уверенность 0.55 · linguistic

`home.typeLocalTitle` — home — [на сайте](https://magicesim.store/ko/)

**EN**

> Plans for one country

**Сейчас**

> 한 국가 요금제

**Предложение**

> 단일 국가 요금제

**Почему:** «한 국가 요금제» is understandable but «단일 국가 요금제» is the usual heading form in Korean telecom copy. · правило `ko-linguistic` · ai

## guide-android

### A0010 · мелко · fluency · уверенность 0.7 · linguistic

`s4.body` — guide «How to install an eSIM on Android», section 4 — [на сайте](https://magicesim.store/ko/guides/android/#help)

**EN**

> Check the data SIM and roaming on the eSIM, toggle airplane mode, then restart. The full checklist is in eSIM not working.
> **Do not delete the eSIM** while troubleshooting: its QR code may be single-use.

**Сейчас**

> 데이터용으로 선택된 SIM과 eSIM의 로밍 설정을 확인하고, 비행기 탑승 모드를 켰다가 끈 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 eSIM이 작동하지 않을 때에서 확인할 수 있습니다.
> 문제를 해결하는 동안 **eSIM을 삭제하지 마세요**. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다.

**Предложение**

> 데이터용으로 선택된 SIM과 eSIM의 로밍 설정을 확인하고, 비행기 탑승 모드를 켰다가 끈 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 eSIM이 작동하지 않을 때 가이드에서 확인할 수 있습니다.
> 문제를 해결하는 동안 **eSIM을 삭제하지 마세요**. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다.

**Почему:** Same problem as guide-iphone:s5.body: «때에서» after the link text is unnatural; «… 때 가이드에서» names the page. · правило `ko-linguistic` · ai

### A0020 · мелко · accuracy · уверенность 0.6 · fidelity · объективное

`s1.body` — guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/ko/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM manager → **Add eSIM** (on older One UI versions: SIM card manager → **Add mobile plan**).
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Сейчас**

> SIM 설정은 보통 다음 중 한 곳에 있습니다. 이름은 브랜드와 Android 버전에 따라 다릅니다.
> • **Google Pixel:** 설정 → 네트워크 및 인터넷 → SIM → **SIM 추가** → **eSIM 설정**.
> • **Samsung Galaxy:** 설정 → 연결 → SIM 관리자 → **eSIM 추가**.
> • **다른 브랜드:** 설정에서 모바일 네트워크, SIM 또는 연결과 관련된 메뉴를 찾아보세요.
> 어디에서도 eSIM을 추가하는 옵션이 보이지 않으면 휴대전화가 eSIM을 지원하는지 확인하세요.

**Предложение**

> SIM 설정은 보통 다음 중 한 곳에 있습니다. 이름은 브랜드와 Android 버전에 따라 다릅니다.
> • **Google Pixel:** 설정 → 네트워크 및 인터넷 → SIM → **SIM 추가** → **eSIM 설정**.
> • **Samsung Galaxy:** 설정 → 연결 → SIM 관리자 → **eSIM 추가**(이전 One UI 버전에서는 메뉴 이름이 다를 수 있습니다).
> • **다른 브랜드:** 설정에서 모바일 네트워크, SIM 또는 연결과 관련된 메뉴를 찾아보세요.
> 어디에서도 eSIM을 추가하는 옵션이 보이지 않으면 휴대전화가 eSIM을 지원하는지 확인하세요.

**Почему:** The English also gives the older One UI path (SIM card manager → Add mobile plan); the Korean drops it, so a reader on an older Galaxy finds no matching menu. Those labels are not in platform-labels.md (D12), so describe the difference instead of quoting it. Also in guide-compatibility:s1.body. · правило `fidelity: information dropped` · ai

### A0021 · мелко · accuracy · уверенность 0.6 · fidelity · объективное

`s3.body` — guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/ko/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Сейчас**

> • eSIM이 켜져 있는지 확인합니다. Pixel: 설정 → 네트워크 및 인터넷 → 모바일 네트워크 → eSIM → **이 SIM 사용**.
> • eSIM을 **모바일 데이터**용 SIM으로 선택합니다. Pixel: 설정 → 네트워크 및 인터넷 → SIM → **모바일 데이터**. 기본 SIM은 통화와 문자에 계속 사용할 수 있습니다.
> • eSIM의 **로밍**을 켭니다. Pixel: 설정 → 네트워크 및 인터넷 → SIM → **로밍**. Samsung: 연결 아래의 모바일 네트워크 설정에서 찾아보세요. 정확한 이름은 모델에 따라 다릅니다. 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.
> • 기존 이동통신사의 요금이 부과되지 않게 하려면 기본 SIM의 데이터 로밍을 끄세요.
> • 휴대전화가 현지 네트워크에 등록될 때까지 1~2분 기다립니다.

**Предложение**

> • eSIM이 켜져 있는지 확인합니다. Pixel: 설정 → 네트워크 및 인터넷 → 모바일 네트워크 → eSIM → **이 SIM 사용**.
> • eSIM을 **모바일 데이터**용 SIM으로 선택합니다. Pixel: 설정 → 네트워크 및 인터넷 → SIM → **모바일 데이터**. 기본 SIM은 통화와 문자에 계속 사용할 수 있습니다.
> • eSIM의 **로밍**을 켭니다. Samsung: 연결 아래의 모바일 네트워크 설정에서 찾아보세요. 정확한 이름은 모델에 따라 다릅니다. 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.
> • 기존 이동통신사의 요금이 부과되지 않게 하려면 기본 SIM의 데이터 로밍을 끄세요.
> • 휴대전화가 현지 네트워크에 등록될 때까지 1~2분 기다립니다.

**Почему:** The Korean adds a Pixel roaming path the English does not give (EN names only the Samsung path), and the added path skips choosing the eSIM inside SIM, where Pixel's roaming switch sits. Nothing is to be added against the English; keep only the Samsung description. · правило `fidelity: information added` · ai

### C0001 · мелко · consistency · уверенность 0.55 · check · объективное

`s1.body` — guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/ko/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM manager → **Add eSIM** (on older One UI versions: SIM card manager → **Add mobile plan**).
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Сейчас**

> SIM 설정은 보통 다음 중 한 곳에 있습니다. 이름은 브랜드와 Android 버전에 따라 다릅니다.
> • **Google Pixel:** 설정 → 네트워크 및 인터넷 → SIM → **SIM 추가** → **eSIM 설정**.
> • **Samsung Galaxy:** 설정 → 연결 → SIM 관리자 → **eSIM 추가**.
> • **다른 브랜드:** 설정에서 모바일 네트워크, SIM 또는 연결과 관련된 메뉴를 찾아보세요.
> 어디에서도 eSIM을 추가하는 옵션이 보이지 않으면 휴대전화가 eSIM을 지원하는지 확인하세요.

**Почему:** The source says «plan»; elsewhere it is «요금제», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

## guide-iphone

### A0009 · мелко · fluency · уверенность 0.7 · linguistic

`s5.body` — guide «How to install an eSIM on iPhone», section 5 — [на сайте](https://magicesim.store/ko/guides/iphone/#help)

**EN**

> Check that the eSIM is the line chosen for cellular data and that data roaming is on for it, then restart the phone. The full checklist is in eSIM not working.
> **Do not delete the eSIM** while troubleshooting: its QR code may be single-use, and you may not be able to install it again.

**Сейчас**

> eSIM이 데이터용 회선으로 선택되어 있고 데이터 로밍이 켜져 있는지 확인한 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 eSIM이 작동하지 않을 때에서 확인할 수 있습니다.
> 문제를 해결하는 동안 **eSIM을 삭제하지 마세요**. QR 코드는 한 번만 사용할 수 있는 경우가 있어 다시 설치하지 못할 수 있습니다.

**Предложение**

> eSIM이 데이터용 회선으로 선택되어 있고 데이터 로밍이 켜져 있는지 확인한 다음 휴대전화를 다시 시작하세요. 전체 점검 목록은 eSIM이 작동하지 않을 때 가이드에서 확인할 수 있습니다.
> 문제를 해결하는 동안 **eSIM을 삭제하지 마세요**. QR 코드는 한 번만 사용할 수 있는 경우가 있어 다시 설치하지 못할 수 있습니다.

**Почему:** The link text «eSIM이 작동하지 않을 때» ends in the noun 때, so «때에서» reads as «at the time, in» — a native reader stumbles; naming the page («… 때 가이드에서») keeps the link text intact and makes it a place. Same pattern in guide-android:s4.body («…때에서» → «…때 가이드에서») and guide-activation:s4.body («…때를 확인하세요» → «…때 가이드를 확인하세요»). · правило `ko-linguistic` · ai

## guide-compatibility

### A0023 · мелко · accuracy · уверенность 0.65 · fidelity

`faq1.q` — guide «Does your phone support eSIM?», question 1 — [на сайте](https://magicesim.store/ko/guides/compatibility/#faq)

**EN**

> My phone takes two SIM cards. Does that mean it has eSIM?

**Сейчас**

> 듀얼 SIM 휴대전화라면 eSIM을 지원하나요?

**Предложение**

> SIM 카드가 두 장 들어가는 휴대전화라면 eSIM도 지원하나요?

**Почему:** EN asks about a phone that takes two SIM cards (two physical slots, as the answer says). «듀얼 SIM» in Korean also covers physical SIM + eSIM phones, which makes the question near-circular; name the two card slots. · правило `fidelity: meaning shifted` · ai

### A0022 · мелко · accuracy · уверенность 0.6 · fidelity

`nav` — guide «Does your phone support eSIM?» — [на сайте](https://magicesim.store/ko/guides/compatibility/)

**EN**

> Compatibility

**Сейчас**

> 지원 기기

**Предложение**

> 호환성 확인

**Почему:** «지원 기기» reads as «supported devices» — i.e. a device list — while this page explicitly says no list of supported models is published (s3.body). «Compatibility» is a check, not a list. · правило `fidelity: meaning shifted` · ai

## guide-troubleshooting

### A0014 · мелко · fluency · уверенность 0.65 · linguistic

`s1.body` — guide «eSIM not working — what to check», section 1 — [на сайте](https://magicesim.store/ko/guides/troubleshooting/#checklist)

**EN**

> • **Is the eSIM line turned on?** Check the SIM settings.
> • **Is the eSIM chosen for mobile data?** The internet has to go through the eSIM, not your main SIM.
> • **Is data roaming on for the eSIM?** Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • **Toggle airplane mode** on for ten seconds, then off.
> • **Restart the phone.**
> • **Choose a network by hand.** In the eSIM's network settings, turn off automatic selection and pick another network from the list.
> • **Check the APN** — only if your plan's details list one: it should match in the eSIM's settings.
> • **Are you inside the plan's coverage?** Check that the country you are in is among the countries the plan covers.

**Сейчас**

> • **eSIM 회선이 켜져 있나요?** SIM 설정에서 확인하세요.
> • **eSIM이 모바일 데이터용으로 선택되어 있나요?** 인터넷이 기본 SIM이 아니라 eSIM을 통해 연결되어야 합니다.
> • **eSIM의 데이터 로밍이 켜져 있나요?** 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.
> • **비행기 탑승 모드를 켜고** 10초 뒤에 끄세요.
> • **휴대전화를 다시 시작하세요.**
> • **네트워크를 직접 선택하세요.** eSIM의 네트워크 설정에서 자동 선택을 끄고 목록에서 다른 네트워크를 고르세요.
> • **APN을 확인하세요.** 요금제 정보에 APN이 적혀 있는 경우에만 해당하며, eSIM 설정의 값과 같아야 합니다.
> • **요금제 이용 국가에 계신가요?** 지금 있는 국가가 요금제 이용 국가에 포함되는지 확인하세요.

**Предложение**

> • **eSIM 회선이 켜져 있나요?** SIM 설정에서 확인하세요.
> • **eSIM이 모바일 데이터용으로 선택되어 있나요?** 인터넷이 기본 SIM이 아니라 eSIM을 통해 연결되어야 합니다.
> • **eSIM의 데이터 로밍이 켜져 있나요?** 여행용 eSIM은 보통 제휴 네트워크로 연결되며, 휴대전화는 이를 로밍으로 인식합니다.
> • **비행기 탑승 모드를 켜고** 10초 뒤에 끄세요.
> • **휴대전화를 다시 시작하세요.**
> • **네트워크를 직접 선택하세요.** eSIM의 네트워크 설정에서 자동 선택을 끄고 목록에서 다른 네트워크를 고르세요.
> • **APN을 확인하세요.** 요금제 정보에 APN이 적혀 있는 경우에만 해당하며, eSIM 설정의 값과 같아야 합니다.
> • **요금제 이용 국가에 계신가요?** 지금 계신 국가가 요금제 이용 국가에 포함되는지 확인하세요.

**Почему:** The bold question uses the honorific «계신가요?» and the next sentence drops to plain «있는» for the same reader; keep the honorific consistent («계신»). · правило `ko-linguistic` · ai

### A0024 · мелко · accuracy · уверенность 0.6 · fidelity

`faq2.a` — guide «eSIM not working — what to check», answer 2 — [на сайте](https://magicesim.store/ko/guides/troubleshooting/#faq)

**EN**

> Often not: a QR code may be single-use. That is why the checklist tells you not to delete the eSIM.

**Сейчас**

> 대개는 할 수 없습니다. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다. 그래서 점검 목록에서 eSIM을 삭제하지 말라고 안내합니다.

**Предложение**

> 그렇지 않은 경우가 많습니다. QR 코드는 한 번만 사용할 수 있는 경우가 있습니다. 그래서 점검 목록에서 eSIM을 삭제하지 말라고 안내합니다.

**Почему:** EN «Often not» is hedged; «대개는 할 수 없습니다» (usually impossible) states it more strongly than the English and than the next sentence («may be single-use»). · правило `fidelity: certainty strengthened` · ai

## daily

### A0007 · мелко · fluency · уверенность 0.6 · linguistic

`reset` — daily plan card — [на сайте](https://magicesim.store/ko/esim/thailand/#dailyBlock)

**EN**

> The allowance resets every 24 hours

**Сейчас**

> 데이터는 24시간마다 초기화됩니다

**Предложение**

> 데이터 제공량은 24시간마다 초기화됩니다

**Почему:** «데이터는 … 초기화됩니다» reads as if the data itself were wiped; Korean carrier copy says the allowance (제공량) resets. Phrasing, not a rule error. Also in daily:sample-card. · правило `natural phrasing` · ai

### A0019 · мелко · accuracy · уверенность 0.6 · fidelity

`reset` — daily plan card — [на сайте](https://magicesim.store/ko/esim/thailand/#dailyBlock)

**EN**

> The allowance resets every 24 hours

**Сейчас**

> 데이터는 24시간마다 초기화됩니다

**Предложение**

> 데이터 제공량은 24시간마다 초기화됩니다

**Почему:** The English resets the daily ALLOWANCE; «데이터는 … 초기화됩니다» can be read as the data itself (or the eSIM's data) being reset. «데이터 제공량» names the allowance and keeps the meaning exact (rule 1: compare with the English). Also appears in daily:sample-card. · правило `fidelity: allowance vs data` · ai

## page

### A0008 · мелко · fluency · уверенность 0.55 · linguistic

`countryTitle` — country page (sample: Thailand) — [на сайте](https://magicesim.store/ko/esim/thailand/)

**EN**

> eSIM for Thailand — data plans in US dollars | Magic eSIM

**Сейчас**

> 태국 eSIM: 미국 달러 데이터 요금제 | Magic eSIM

**Предложение**

> 태국 eSIM: 데이터 요금제(미국 달러 가격) | Magic eSIM

**Почему:** «미국 달러 데이터 요금제» stacks nouns so that it reads like a «US-dollar data plan» as a product type; stating the currency as the price basis is clearer. Phrasing only; the title stays within budget. · правило `natural phrasing` · ai

