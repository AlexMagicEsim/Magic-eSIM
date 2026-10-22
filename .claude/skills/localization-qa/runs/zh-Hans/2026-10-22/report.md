# Ревью локализации: zh-Hans — 2026-10-22

Строк проверено: **516** · строк с замечаниями: **25** · замечаний: **25**

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 4 |
| мелко (minor) | 21 |
| на вкус (preferential) | 0 |

| Категория | Замечаний |
|---|---|
| fluency | 10 |
| accuracy | 7 |
| punctuation | 2 |
| terminology | 2 |
| consistency | 2 |
| grammar | 1 |
| seo | 1 |

Источник: механические проверки 1, ИИ-ревью 24; второе мнение подтвердило или понизило 0, отклонило 0. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 0.

## Решения арбитра

Строк с замечаниями: 25 · исправить: **10** · оставить как есть: 5 · стилистика (не применяется): 10 · внесено и подтверждено повторной выгрузкой: **10/10**

### guide-iphone:s1.body · важно

guide «How to install an eSIM on iPhone», section 1 — [на сайте](https://magicesim.store/zh/guides/iphone/#check)

**EN**

> Open **Settings → Cellular** (called **Mobile Data** in some regions). If you see **Add eSIM** or **Add Cellular Plan**, your iPhone supports eSIM.
> Your iPhone must also not be locked to one carrier. See how to check compatibility.

**Было**

> 打开**设置 → 蜂窝网络**（或**移动数据**）。如果看到**添加 eSIM** 或**添加蜂窝号码**，说明您的 iPhone 支持 eSIM。
> 您的 iPhone 还不能被运营商锁定。请查看如何检查兼容性。在中国大陆购买的 iPhone，只有部分机型支持 eSIM，兼容性指南中有说明。

**Стало**

> 打开**设置 → 蜂窝网络**（或**移动数据**）。如果看到**添加 eSIM** 或**添加蜂窝号码**，说明您的 iPhone 支持 eSIM。
> 此外，您的 iPhone 必须未被运营商锁定。请查看如何检查兼容性。在中国大陆购买的 iPhone，只有部分机型支持 eSIM，兼容性指南中有说明。

**Причина:** «还不能被运营商锁定» is ambiguous («cannot be locked yet»); the English requirement «must also not be locked» must be unambiguous (accuracy/ambiguous instruction). The D12 China sentence is kept.

**Независимые проверки:** linguistic A0005 (fluency, важно, 0.8) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:faq1.a · важно

guide «How to install an eSIM on iPhone», answer 1 — [на сайте](https://magicesim.store/zh/guides/iphone/#faq)

**EN**

> You need an internet connection to download the profile, and Wi-Fi is the easiest. Installing on the day you travel, before you leave home or on airport Wi-Fi, works whatever the plan's rules for when its validity starts.

**Было**

> 下载描述文件需要连接互联网，最简单的是使用无线局域网。如果您在出行当天安装 eSIM，例如出发前在家中或使用机场的无线局域网，无论套餐的有效期何时开始，都适用。

**Стало**

> 下载描述文件需要连接互联网，最简单的是使用无线局域网。在出行当天安装 eSIM（出发前在家中，或使用机场的无线局域网），无论套餐的有效期何时开始计算，这种做法都适用。

**Причина:** The second sentence is ungrammatical — «都适用» has no subject and «例如» turns the condition into a list (grammar); the fix restores the English meaning without adding facts.

**Независимые проверки:** linguistic A0006 (grammar, важно, 0.85) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-compatibility:s1.body · мелко

guide «Does your phone support eSIM?», section 1 — [на сайте](https://magicesim.store/zh/guides/compatibility/#setting)

**EN**

> **iPhone:** Settings → Cellular. **Add eSIM** or **Add Cellular Plan** means eSIM is supported.
> **Android:** open the SIM settings and look for a way to add an eSIM — on Pixel, Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**; on Samsung, Connections → SIM manager → **Add eSIM** (older One UI: SIM card manager → **Add mobile plan**).
> An extra hint on Pixel: to use an eSIM, a phone needs an **EID** number. You can find it in Settings → About phone → SIM status. The setting to add an eSIM is still what decides.

**Было**

> **iPhone：**设置 → 蜂窝网络（或移动数据）。如果出现**添加 eSIM** 或**添加蜂窝号码**，这部 iPhone 支持 eSIM。
> **Android：**打开 SIM 卡设置，查找添加 eSIM 的方法：Pixel 上为 网络和互联网 → SIM 卡 → **添加 SIM 卡** → **设置 eSIM 卡**；Samsung 上在与“连接”相关的菜单中查找管理 SIM 卡的选项。
> Pixel 上的另一个线索：要使用 eSIM，手机还需要有 **EID** 号码。您可以在 设置 → 关于手机 → SIM 卡状态 中找到它。不过，以添加 eSIM 的设置为准。

**Стало**

> **iPhone：**设置 → 蜂窝网络（或移动数据）。如果出现**添加 eSIM** 或**添加蜂窝号码**，说明这部 iPhone 支持 eSIM。
> **Android：**打开 SIM 卡设置，查找添加 eSIM 的方法：在 Pixel 上，依次进入网络和互联网 → SIM 卡 → **添加 SIM 卡** → **设置 eSIM 卡**；Samsung 上在与“连接”相关的菜单中查找管理 SIM 卡的选项。
> Pixel 上的另一个线索：要使用 eSIM，手机还需要有 **EID** 号码。您可以在“设置 → 关于手机 → SIM 卡状态”中找到它。不过，以添加 eSIM 的设置为准。

**Причина:** Half-width spaces between Chinese characters around menu paths break the D6 typography rule (spaces only between Chinese and Latin/digits); «说明» restores the conditional's consequence as in the iPhone guide.

**Независимые проверки:** linguistic A0007 (punctuation, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### ui:site.compatCheck · мелко

several pages — [на сайте](https://magicesim.store/zh/)

**EN**

> iPhone setup

**Было**

> iPhone 设置

**Стало**

> iPhone 安装指南

**Причина:** «iPhone 设置» reads as the Settings app (platform label 设置), not as the iPhone setup guide the link opens — an ambiguous label (accuracy). Same fix applies to ui:site.compatAndroid («Android 安装指南»).

**Независимые проверки:** fidelity A0015 (accuracy, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-android:s2.body · важно

guide «How to install an eSIM on Android», section 2 — [на сайте](https://magicesim.store/zh/guides/android/#install)

**EN**

> • Show your eSIM's QR code on another screen.
> • Start adding an eSIM as above. **Samsung:** tap **Scan QR code** (older One UI: **Add using QR code**) and scan the code. **Pixel:** follow the instructions on the screen.
> • No QR code to scan? On Samsung with older One UI, tap **Add using activation code** and enter the details provided with your eSIM; on newer versions, follow the on-screen option for entering an activation code.
> • Confirm, and wait until the installation finishes.
> • Rename the eSIM, for example to «Travel».

**Было**

> • 在另一块屏幕上显示 eSIM 的二维码。
> • 按上文所述开始添加 eSIM。**Samsung：**选择扫描二维码的选项并扫描。**Pixel：**按照屏幕上的说明操作。
> • 没有可扫描的二维码？选择手动输入激活码的选项，输入随 eSIM 提供的信息。
> • 确认并等待安装完成。
> • 为 eSIM 重命名，例如“旅行”。

**Стало**

> • 在另一块屏幕上显示 eSIM 的二维码。
> • 按上文所述开始添加 eSIM。**Samsung：**选择扫描二维码的选项并扫描。**Pixel：**按照屏幕上的说明操作。
> • 没有可扫描的二维码？在 Samsung 手机上，选择输入激活码的选项，输入随 eSIM 提供的信息；具体名称因 One UI 版本而异。
> • 确认并等待安装完成。
> • 为 eSIM 重命名，例如“旅行”。

**Причина:** The English scopes the activation-code route to Samsung; the translation tells every Android user (Pixel included) such an option exists — an added instruction (accuracy). Samsung is described, not quoted (D13).

**Независимые проверки:** fidelity A0016 (accuracy, важно, 0.75) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:lead · важно

guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/zh/guides/activation/)

**EN**

> Installing the eSIM and starting its validity are not the same thing, and plans differ on when the validity starts. The advice that is safe for every plan: install on the day you travel, over Wi-Fi, and switch the eSIM on for data when you arrive.

**Было**

> 安装 eSIM 和开始计算有效期不是一回事，每个套餐都规定了有效期开始的时间。适用于所有套餐的建议：在出行当天通过无线局域网安装 eSIM，抵达后再开启数据。

**Стало**

> 安装 eSIM 和开始计算有效期不是一回事，而且不同套餐的有效期开始时间各不相同。适用于所有套餐的建议：在出行当天通过无线局域网安装 eSIM，抵达后再开启 eSIM 的数据。

**Причина:** «每个套餐都规定了有效期开始的时间» loses the fact that plans DIFFER on when validity starts, which the safe advice rests on; «开启数据» also drops that it is the eSIM switched on for data (accuracy).

**Независимые проверки:** fidelity A0017 (accuracy, важно, 0.75) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:faq3.a · мелко

guide «How to install an eSIM on iPhone», answer 3 — [на сайте](https://magicesim.store/zh/guides/iphone/#faq)

**EN**

> It stays on. Calls and texts to your main number follow your home operator's roaming terms; the travel eSIM is used for mobile data.

**Было**

> 主号码仍然有效。拨打和接收主号码的电话和短信，按原运营商的漫游条款计费；旅行 eSIM 用于蜂窝数据。

**Стало**

> 主号码保持开启。主号码的来电和短信按原运营商的漫游条款处理；旅行 eSIM 用于蜂窝数据。

**Причина:** «仍然有效» changes «stays on» to «remains valid», and «拨打和接收…计费» adds outgoing calls and billing the English does not state (accuracy, rule 1).

**Независимые проверки:** fidelity A0018 (accuracy, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:title · мелко

guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/zh/guides/activation/)

**EN**

> When to install and turn on a travel eSIM | Magic eSIM

**Было**

> 何时安装和激活旅行 eSIM | Magic eSIM

**Стало**

> 何时安装和开启旅行 eSIM | Magic eSIM

**Причина:** «激活» reads as activating the plan / starting validity — exactly what this guide separates from switching the line on; «开启» renders «turn on» and matches the body (terminology/accuracy). Same fix applies to guide-activation:h1.

**Независимые проверки:** fidelity A0020 (terminology, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-compatibility:title · мелко

guide «Does your phone support eSIM?» — [на сайте](https://magicesim.store/zh/guides/compatibility/)

**EN**

> Does my phone support eSIM? How to check | Magic eSIM

**Было**

> 我的手机支持 eSIM 吗？| Magic eSIM

**Стало**

> 我的手机支持 eSIM 吗？如何检查 | Magic eSIM

**Причина:** The title drops the «How to check» intent of the English (SEO keyword lost); the fix fits the budget at ~43 of 60 width units. guide-troubleshooting:title has the same issue.

**Независимые проверки:** fidelity A0021 (seo, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:s4.body · мелко

guide «How to install an eSIM on iPhone», section 4 — [на сайте](https://magicesim.store/zh/guides/iphone/#data)

**EN**

> • In **Settings → Cellular**, make sure the eSIM line is turned on.
> • Tap **Cellular Data** and choose the eSIM line. Your main SIM can stay on for calls and texts.
> • Open the eSIM line and turn on **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.
> Menu names can differ slightly between iOS versions.

**Было**

> • 在**设置 → 蜂窝网络**中，确认 eSIM 号码已开启。
> • 轻点**蜂窝数据**，选择 eSIM 号码。您的主 SIM 卡可以继续用于通话和短信。
> • 打开 eSIM 号码，开启数据漫游。旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。
> • 如果不想被原运营商收费，请关闭主 SIM 卡的数据漫游。
> • 等待一两分钟，让手机注册到当地网络。
> 菜单名称可能因 iOS 版本略有不同。

**Стало**

> • 在**设置 → 蜂窝网络**中，确认 eSIM 号码已开启。
> • 轻点**蜂窝数据**，选择 eSIM 号码。您的主 SIM 卡可以继续用于通话和短信。
> • 打开 eSIM 号码，开启**数据漫游**。旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。
> • 如果不想被原运营商收费，请关闭主 SIM 卡的数据漫游。
> • 等待一两分钟，让手机注册到当地网络。
> 菜单名称可能因 iOS 版本略有不同。

**Причина:** The English bolds the on-screen label Data Roaming; 数据漫游 is a sourced label (109317), so the bold must be kept (rule 3).

**Независимые проверки:** fidelity A0024 (consistency, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### Стилистика — записано, не применяется

- ui:pay.finalBody: 电子邮箱 is an accepted glossary variant and commonly means the address; «电子邮箱地址…被» is a stylistic clarification, not an error.
- ui:plan.alsoCoversMore: «另外 {n} 个» after a list of country names is an acceptable elliptical form; adding 国家/地区 is a stylistic improvement.
- page:homeArtCoverageValue: «190+ 个目的地» is a common, clear marketing form; aligning it with «190 多个» in the description is consistency of taste.
- page:homeTitle: The «—» is a separator between the Latin brand and the Chinese phrase in a title, not a dash inside Chinese prose; switching to «：» (and in hubTitle/404:title) is a stylistic harmonisation.
- guide-activation:s3.body: The English link text is also a bare «(check)»; «（查看检查方法）» is a clearer but stylistic rewording.
- guide-activation:s5.body: «同行旅伴» is mildly redundant but correct and clear; trimming it is taste.
- guide-activation:faq1.a: «为了适用于所有套餐» is understandable and keeps the meaning; «为稳妥起见» is a more idiomatic but stylistic choice.
- guide-troubleshooting:s1.body: The APN line is readable and «它» refers to the APN just named; bracketing the condition is a stylistic improvement.
- guide-troubleshooting:h1: «eSIM 无法使用：检查什么» is an acceptable heading form mirroring the English; the suggested phrasing is taste.
- ui:how.step3: «描述文件» is the term used for the eSIM profile across the whole Chinese site (guides included) and is not in the glossary; changing one string would create inconsistency — a site-wide term decision, not an error here.

### Оставлено как есть

- guide-android:s1.body: The missing «套餐» is the Samsung «Add mobile plan» label, deliberately described rather than quoted (owner D13); no meaning is lost.
- guide-android:faq3.a: «与注明的一致» is a grammatical 的-structure with an elided noun; the sentence is correct and clear.
- guide-compatibility:s4.body: False positive from section misalignment: the Chinese guide has an extra D12 section «在中国大陆购买的 iPhone», and the English «what next» section exists as its own section («手机符合条件：下一步？», id next) with the destination-list and guide links.
- guide-android:s3.body: The Pixel roaming path uses only labels sourced from Pixel page 2926415 (网络和互联网 → SIM 卡 → 漫游, listed in platform-labels.md and the generator's source note); it compensates for the Samsung path that D13 requires to be described. No objective error is shown.
- guide-iphone:s3.body: Apple 118669 itself places «手动输入详细信息» at the bottom of the screen; the detail is sourced and harmless.

## Все замечания этапов

## guide-iphone

### A0006 · важно · grammar · уверенность 0.85 · linguistic · объективное

`faq1.a` — guide «How to install an eSIM on iPhone», answer 1 — [на сайте](https://magicesim.store/zh/guides/iphone/#faq)

**EN**

> You need an internet connection to download the profile, and Wi-Fi is the easiest. Installing on the day you travel, before you leave home or on airport Wi-Fi, works whatever the plan's rules for when its validity starts.

**Сейчас**

> 下载描述文件需要连接互联网，最简单的是使用无线局域网。如果您在出行当天安装 eSIM，例如出发前在家中或使用机场的无线局域网，无论套餐的有效期何时开始，都适用。

**Предложение**

> 下载描述文件需要连接互联网，最简单的是使用无线局域网。在出行当天安装 eSIM（出发前在家中，或使用机场的无线局域网），无论套餐的有效期何时开始计算，这种做法都适用。

**Почему:** The second sentence is broken: the main clause «都适用» has no subject (what applies?), and the 例如 insertion makes the conditional read as an example list. The suggestion gives 都适用 a subject (这种做法) and puts the examples in brackets. · правило `missing-subject` · ai

### A0005 · важно · fluency · уверенность 0.8 · linguistic · объективное

`s1.body` — guide «How to install an eSIM on iPhone», section 1 — [на сайте](https://magicesim.store/zh/guides/iphone/#check)

**EN**

> Open **Settings → Cellular** (called **Mobile Data** in some regions). If you see **Add eSIM** or **Add Cellular Plan**, your iPhone supports eSIM.
> Your iPhone must also not be locked to one carrier. See how to check compatibility.

**Сейчас**

> 打开**设置 → 蜂窝网络**（或**移动数据**）。如果看到**添加 eSIM** 或**添加蜂窝号码**，说明您的 iPhone 支持 eSIM。
> 您的 iPhone 还不能被运营商锁定。请查看如何检查兼容性。在中国大陆购买的 iPhone，只有部分机型支持 eSIM，兼容性指南中有说明。

**Предложение**

> 打开**设置 → 蜂窝网络**（或**移动数据**）。如果看到**添加 eSIM** 或**添加蜂窝号码**，说明您的 iPhone 支持 eSIM。
> 此外，您的 iPhone 必须未被运营商锁定。请查看如何检查兼容性。在中国大陆购买的 iPhone，只有部分机型支持 eSIM，兼容性指南中有说明。

**Почему:** «还不能被……锁定» reads as «cannot be locked yet» — the intended «must also not be locked» is lost by the ambiguous 还不能; «此外……必须未被……锁定» says it unambiguously. · правило `ambiguous-modal` · ai

### A0018 · мелко · accuracy · уверенность 0.6 · fidelity · объективное

`faq3.a` — guide «How to install an eSIM on iPhone», answer 3 — [на сайте](https://magicesim.store/zh/guides/iphone/#faq)

**EN**

> It stays on. Calls and texts to your main number follow your home operator's roaming terms; the travel eSIM is used for mobile data.

**Сейчас**

> 主号码仍然有效。拨打和接收主号码的电话和短信，按原运营商的漫游条款计费；旅行 eSIM 用于蜂窝数据。

**Предложение**

> 主号码保持开启。主号码的来电和短信按原运营商的漫游条款处理；旅行 eSIM 用于蜂窝数据。

**Почему:** «It stays on» (the line remains switched on) became «仍然有效» (remains valid), and «calls and texts TO your main number» became «拨打和接收» (outgoing and incoming) plus an added «计费». Keep the English scope: the line stays on, incoming calls/texts follow the home operator's roaming terms. · правило `fidelity-accuracy` · ai

### A0023 · мелко · accuracy · уверенность 0.55 · fidelity

`s3.body` — guide «How to install an eSIM on iPhone», section 3 — [на сайте](https://magicesim.store/zh/guides/iphone/#manual)

**EN**

> • Find the details for manual installation that come with your eSIM.
> • Open **Settings → Cellular** (or **Mobile Data**) and tap **Add Cellular Plan**.
> • Tap **Enter Details Manually** and type in those details.
> • Confirm, and wait until the installation finishes.
> Useful when there is no QR code to scan.

**Сейчас**

> • 准备好随 eSIM 提供的手动安装信息。
> • 打开**设置 → 蜂窝网络**（或**移动数据**），轻点**添加蜂窝号码**。
> • 轻点屏幕底部的**手动输入详细信息**，然后输入这些信息。
> • 确认并等待安装完成。
> 没有可扫描的二维码时，这个方法很方便。

**Предложение**

> • 准备好随 eSIM 提供的手动安装信息。
> • 打开**设置 → 蜂窝网络**（或**移动数据**），轻点**添加蜂窝号码**。
> • 轻点**手动输入详细信息**，然后输入这些信息。
> • 确认并等待安装完成。
> 没有可扫描的二维码时，这个方法很方便。

**Почему:** «屏幕底部的» (at the bottom of the screen) is added; the English does not say where the button is. Harmless if Apple 118669 zh-cn says so, otherwise drop it. · правило `fidelity-accuracy` · ai

### A0024 · мелко · consistency · уверенность 0.55 · fidelity

`s4.body` — guide «How to install an eSIM on iPhone», section 4 — [на сайте](https://magicesim.store/zh/guides/iphone/#data)

**EN**

> • In **Settings → Cellular**, make sure the eSIM line is turned on.
> • Tap **Cellular Data** and choose the eSIM line. Your main SIM can stay on for calls and texts.
> • Open the eSIM line and turn on **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.
> Menu names can differ slightly between iOS versions.

**Сейчас**

> • 在**设置 → 蜂窝网络**中，确认 eSIM 号码已开启。
> • 轻点**蜂窝数据**，选择 eSIM 号码。您的主 SIM 卡可以继续用于通话和短信。
> • 打开 eSIM 号码，开启数据漫游。旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。
> • 如果不想被原运营商收费，请关闭主 SIM 卡的数据漫游。
> • 等待一两分钟，让手机注册到当地网络。
> 菜单名称可能因 iOS 版本略有不同。

**Предложение**

> • 在**设置 → 蜂窝网络**中，确认 eSIM 号码已开启。
> • 轻点**蜂窝数据**，选择 eSIM 号码。您的主 SIM 卡可以继续用于通话和短信。
> • 打开 eSIM 号码，开启**数据漫游**。旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。
> • 如果不想被原运营商收费，请关闭主 SIM 卡的数据漫游。
> • 等待一两分钟，让手机注册到当地网络。
> 菜单名称可能因 iOS 版本略有不同。

**Почему:** The English bolds the on-screen label **Data Roaming**; the translation drops the bold although 数据漫游 is in platform-labels.md (109317). Rule 3: keep every bold label. · правило `fidelity-consistency` · ai

## guide-activation

### A0017 · важно · accuracy · уверенность 0.75 · fidelity · объективное

`lead` — guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/zh/guides/activation/)

**EN**

> Installing the eSIM and starting its validity are not the same thing, and plans differ on when the validity starts. The advice that is safe for every plan: install on the day you travel, over Wi-Fi, and switch the eSIM on for data when you arrive.

**Сейчас**

> 安装 eSIM 和开始计算有效期不是一回事，每个套餐都规定了有效期开始的时间。适用于所有套餐的建议：在出行当天通过无线局域网安装 eSIM，抵达后再开启数据。

**Предложение**

> 安装 eSIM 和开始计算有效期不是一回事，而且不同套餐的有效期开始时间各不相同。适用于所有套餐的建议：在出行当天通过无线局域网安装 eSIM，抵达后再开启 eSIM 的数据。

**Почему:** «plans differ on when the validity starts» became «每个套餐都规定了有效期开始的时间» (every plan specifies when it starts) — the fact that plans DIFFER, which is why the safe advice exists, is lost. Also «switch the eSIM on for data» is narrowed to a generic «开启数据». · правило `fidelity-accuracy` · ai

### A0010 · мелко · fluency · уверенность 0.7 · linguistic

`faq1.a` — guide «When to install and turn on your eSIM», answer 1 — [на сайте](https://magicesim.store/zh/guides/activation/#faq)

**EN**

> It depends on the plan: some start counting at installation, others on the first connection or the first data used at the destination. To be safe with any plan, install on the day you travel.

**Сейчас**

> 这取决于套餐：有些在安装时开始计算，有些在目的地首次连接网络或首次使用数据时开始。为了适用于所有套餐，请在出行当天安装 eSIM。

**Предложение**

> 这取决于套餐：有些在安装时开始计算，有些在目的地首次连接网络或首次使用数据时开始。为稳妥起见，无论哪种套餐，都请在出行当天安装 eSIM。

**Почему:** «为了适用于所有套餐» has no subject and reads as a calque of «to be safe with any plan»; «为稳妥起见，无论哪种套餐» is the natural form. · правило `calque` · ai

### A0008 · мелко · fluency · уверенность 0.65 · linguistic

`s3.body` — guide «When to install and turn on your eSIM», section 3 — [на сайте](https://magicesim.store/zh/guides/activation/#checklist)

**EN**

> • Your phone supports eSIM and is not carrier-locked (check).
> • You have the eSIM's QR code, or its details for manual installation, at hand — saved somewhere you can open offline.
> • You install the eSIM over Wi-Fi (iPhone, Android).
> • You keep your main SIM for data until you land.

**Сейчас**

> • 您的手机支持 eSIM，且未被运营商锁定（检查）。
> • eSIM 的二维码或手动安装信息已准备好，并保存在离线也能打开的地方。
> • 通过无线局域网安装 eSIM（iPhone、Android）。
> • 落地前，主 SIM 卡继续负责数据。

**Предложение**

> • 您的手机支持 eSIM，且未被运营商锁定（查看检查方法）。
> • eSIM 的二维码或手动安装信息已准备好，并保存在离线也能打开的地方。
> • 通过无线局域网安装 eSIM（iPhone、Android）。
> • 落地前，主 SIM 卡继续负责数据。

**Почему:** A bare «（检查）» as link text reads as a stray imperative; «（查看检查方法）» says what the link opens. · правило `dangling-link-text` · ai

### A0009 · мелко · fluency · уверенность 0.6 · linguistic

`s5.body` — guide «When to install and turn on your eSIM», section 5 — [на сайте](https://magicesim.store/zh/guides/activation/#no-wifi)

**EN**

> You need internet to download the profile. Options: the airport's free Wi-Fi, or internet shared from a travel companion's phone. Entering the details by hand still needs internet to download the profile.

**Сейчас**

> 下载描述文件需要连接互联网。可以使用机场的免费无线局域网，或者同行旅伴手机共享的网络。手动输入信息同样需要互联网来下载描述文件。

**Предложение**

> 下载描述文件需要连接互联网。可以使用机场的免费无线局域网，或者旅伴手机共享的网络。手动输入信息同样需要互联网来下载描述文件。

**Почему:** «同行旅伴» is redundant (旅伴 already means a travel companion). · правило `redundancy` · ai

### A0020 · мелко · terminology · уверенность 0.6 · fidelity

`title` — guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/zh/guides/activation/)

**EN**

> When to install and turn on a travel eSIM | Magic eSIM

**Сейчас**

> 何时安装和激活旅行 eSIM | Magic eSIM

**Предложение**

> 何时安装和开启旅行 eSIM | Magic eSIM

**Почему:** «turn on» is rendered 激活 (activate), which in Chinese eSIM usage reads as activating the plan — exactly what this guide says is a separate event from installing/switching on the line. 开启 matches the body («开启号码») and s4. Also in guide-activation:h1 («何时安装和激活您的 eSIM» → «何时安装和开启您的 eSIM»). · правило `fidelity-terminology` · ai

## guide-android

### A0016 · важно · accuracy · уверенность 0.75 · fidelity · объективное

`s2.body` — guide «How to install an eSIM on Android», section 2 — [на сайте](https://magicesim.store/zh/guides/android/#install)

**EN**

> • Show your eSIM's QR code on another screen.
> • Start adding an eSIM as above. **Samsung:** tap **Scan QR code** (older One UI: **Add using QR code**) and scan the code. **Pixel:** follow the instructions on the screen.
> • No QR code to scan? On Samsung with older One UI, tap **Add using activation code** and enter the details provided with your eSIM; on newer versions, follow the on-screen option for entering an activation code.
> • Confirm, and wait until the installation finishes.
> • Rename the eSIM, for example to «Travel».

**Сейчас**

> • 在另一块屏幕上显示 eSIM 的二维码。
> • 按上文所述开始添加 eSIM。**Samsung：**选择扫描二维码的选项并扫描。**Pixel：**按照屏幕上的说明操作。
> • 没有可扫描的二维码？选择手动输入激活码的选项，输入随 eSIM 提供的信息。
> • 确认并等待安装完成。
> • 为 eSIM 重命名，例如“旅行”。

**Предложение**

> • 在另一块屏幕上显示 eSIM 的二维码。
> • 按上文所述开始添加 eSIM。**Samsung：**选择扫描二维码的选项并扫描。**Pixel：**按照屏幕上的说明操作。
> • 没有可扫描的二维码？在 Samsung 手机上，选择输入激活码的选项，输入随 eSIM 提供的信息；具体名称因 One UI 版本而异。
> • 确认并等待安装完成。
> • 为 eSIM 重命名，例如“旅行”。

**Почему:** The English scopes the activation-code route to Samsung (older One UI: «Add using activation code»; newer: the on-screen option). The translation drops «Samsung» and tells every Android user, Pixel included, that a manual activation-code option exists — a step the English does not promise. Restore the Samsung scope (described, not quoted — D13). · правило `fidelity-accuracy` · ai

### A0013 · мелко · fluency · уверенность 0.55 · linguistic

`faq3.a` — guide «How to install an eSIM on Android», answer 3 — [на сайте](https://magicesim.store/zh/guides/android/#faq)

**EN**

> Only if your plan's details list an APN: then check that it matches in the eSIM's settings.

**Сейчас**

> 只有当您的套餐信息中注明了 APN 时才需要：请在 eSIM 的设置中确认它与注明的一致。

**Предложение**

> 只有当您的套餐信息中注明了 APN 时才需要：请在 eSIM 的设置中确认 APN 与之一致。

**Почему:** «它与注明的一致» is awkward (a dangling 的-phrase with no noun); naming the APN reads naturally. · правило `dangling-de` · ai

### C0001 · мелко · consistency · уверенность 0.55 · check · объективное

`s1.body` — guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/zh/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM manager → **Add eSIM** (on older One UI versions: SIM card manager → **Add mobile plan**).
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Сейчас**

> SIM 卡设置通常在以下位置之一；名称因品牌和 Android 版本而异：
> • **Google Pixel：**设置 → 网络和互联网 → SIM 卡 → **添加 SIM 卡** → **设置 eSIM 卡**。
> • **Samsung Galaxy：**在设置中打开与“连接”相关的菜单，找到管理 SIM 卡的选项，从那里添加 eSIM；具体名称因机型和 One UI 版本而异。
> • **其他品牌：**在设置中查找与移动网络、SIM 卡或连接相关的菜单。
> 如果哪里都找不到添加 eSIM 的选项，请检查您的手机是否支持 eSIM。

**Почему:** The source says «plan»; elsewhere it is «套餐», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

### A0022 · мелко · accuracy · уверенность 0.5 · fidelity

`s3.body` — guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/zh/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Сейчас**

> • 确认 eSIM 已开启。Pixel：设置 → 网络和互联网 → 移动网络 → 该 eSIM → **使用此 SIM 卡**。
> • 将 eSIM 设为**移动数据**使用的 SIM 卡。Pixel：设置 → 网络和互联网 → SIM 卡 → **移动数据**。您的主 SIM 卡可以继续用于通话和短信。
> • 为 eSIM 开启**漫游**。Pixel：设置 → 网络和互联网 → SIM 卡 → **漫游**。Samsung：在“连接”下的移动网络设置中查找；确切名称取决于机型。旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。
> • 如果不想被原运营商收费，请关闭主 SIM 卡的数据漫游。
> • 等待一两分钟，让手机注册到当地网络。

**Почему:** The translation adds a Pixel roaming path («设置 → 网络和互联网 → SIM 卡 → **漫游**») that the English does not give (it gives a Samsung path, rightly described rather than quoted per D13). The labels are in platform-labels.md (2926415), but the path as written skips choosing the eSIM in the SIM list before «漫游»; please confirm against Pixel page 2926415 (zh-Hans) — e.g. «SIM 卡 → 该 eSIM → 漫游». · правило `fidelity-accuracy` · ai

## guide-compatibility

### A0007 · мелко · punctuation · уверенность 0.7 · linguistic · объективное

`s1.body` — guide «Does your phone support eSIM?», section 1 — [на сайте](https://magicesim.store/zh/guides/compatibility/#setting)

**EN**

> **iPhone:** Settings → Cellular. **Add eSIM** or **Add Cellular Plan** means eSIM is supported.
> **Android:** open the SIM settings and look for a way to add an eSIM — on Pixel, Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**; on Samsung, Connections → SIM manager → **Add eSIM** (older One UI: SIM card manager → **Add mobile plan**).
> An extra hint on Pixel: to use an eSIM, a phone needs an **EID** number. You can find it in Settings → About phone → SIM status. The setting to add an eSIM is still what decides.

**Сейчас**

> **iPhone：**设置 → 蜂窝网络（或移动数据）。如果出现**添加 eSIM** 或**添加蜂窝号码**，这部 iPhone 支持 eSIM。
> **Android：**打开 SIM 卡设置，查找添加 eSIM 的方法：Pixel 上为 网络和互联网 → SIM 卡 → **添加 SIM 卡** → **设置 eSIM 卡**；Samsung 上在与“连接”相关的菜单中查找管理 SIM 卡的选项。
> Pixel 上的另一个线索：要使用 eSIM，手机还需要有 **EID** 号码。您可以在 设置 → 关于手机 → SIM 卡状态 中找到它。不过，以添加 eSIM 的设置为准。

**Предложение**

> **iPhone：**设置 → 蜂窝网络（或移动数据）。如果出现**添加 eSIM** 或**添加蜂窝号码**，说明这部 iPhone 支持 eSIM。
> **Android：**打开 SIM 卡设置，查找添加 eSIM 的方法：在 Pixel 上，依次进入网络和互联网 → SIM 卡 → **添加 SIM 卡** → **设置 eSIM 卡**；Samsung 上在与“连接”相关的菜单中查找管理 SIM 卡的选项。
> Pixel 上的另一个线索：要使用 eSIM，手机还需要有 **EID** 号码。您可以在“设置 → 关于手机 → SIM 卡状态”中找到它。不过，以添加 eSIM 的设置为准。

**Почему:** Half-width spaces are used between Chinese characters to fence off a menu path («在 设置 … 中», «上为 网络和互联网»); the typography rule puts spaces only between Chinese and Latin/digits. Mark the path with “ ” quotes instead and rephrase «Pixel 上为» as «在 Pixel 上，依次进入». Also «这部 iPhone 支持 eSIM» lacks 说明 (cf. the iPhone guide). · правило `zh-spacing` · ai

### A0019 · мелко · accuracy · уверенность 0.6 · fidelity · объективное

`s4.body` — guide «Does your phone support eSIM?», section 4 — [на сайте](https://magicesim.store/zh/guides/compatibility/#mainland)

**EN**

> Choose a destination in the list of destinations, then read how to install the eSIM on iPhone or Android.

**Сейчас**

> 根据 Apple 于 2026 年 9 月 9 日发布的说明，在中国大陆，以下 iPhone 机型支持 eSIM：iPhone 18 Pro、iPhone 18 Pro Max、iPhone Duo、iPhone 17e 和 iPhone Air。
> Apple 表示，在中国大陆境外旅行时，可以在购自中国大陆并支持 eSIM 的 iPhone 上激活当地运营商提供的 eSIM；而在中国大陆，无法安装境外运营商提供的 eSIM。因此，如果您要带 iPhone 前往中国大陆，请在入境前安装 eSIM。
> 来源：Apple 支持文章《在中国大陆将 eSIM 与 iPhone 搭配使用》。
> 在中国大陆购买的 Android 手机是否支持 eSIM，取决于机型和地区版本：请按上文在设置中检查。

**Предложение**

> 根据 Apple 于 2026 年 9 月 9 日发布的说明，在中国大陆，以下 iPhone 机型支持 eSIM：iPhone 18 Pro、iPhone 18 Pro Max、iPhone Duo、iPhone 17e 和 iPhone Air。
> Apple 表示，在中国大陆境外旅行时，可以在购自中国大陆并支持 eSIM 的 iPhone 上激活当地运营商提供的 eSIM；而在中国大陆，无法安装境外运营商提供的 eSIM。因此，如果您要带 iPhone 前往中国大陆，请在入境前安装 eSIM。
> 来源：Apple 支持文章《在中国大陆将 eSIM 与 iPhone 搭配使用》。
> 在中国大陆购买的 Android 手机是否支持 eSIM，取决于机型和地区版本：请按上文在设置中检查。
> 确认手机符合条件后，请在目的地列表中选择目的地，然后阅读如何在 iPhone 或 Android 上安装 eSIM。

**Почему:** Section 4 («Your phone qualifies — what next»: choose a destination, then read the install guide) is replaced by the mainland-China section (D12, decided and sourced — not questioned here), so the next-step pointer to the destination list and the iPhone/Android guides is lost entirely; the H2 likewise no longer matches the English. If the replacement is deliberate, keep the China text and add the next-step line (or restore it as its own section). · правило `fidelity-accuracy` · ai

### A0021 · мелко · seo · уверенность 0.6 · fidelity

`title` — guide «Does your phone support eSIM?» — [на сайте](https://magicesim.store/zh/guides/compatibility/)

**EN**

> Does my phone support eSIM? How to check | Magic eSIM

**Сейчас**

> 我的手机支持 eSIM 吗？| Magic eSIM

**Предложение**

> 我的手机支持 eSIM 吗？如何检查 | Magic eSIM

**Почему:** The English title carries the intent «How to check»; the translation drops it, leaving only the question (budget allows it: ~43 of 60 width units). Also in guide-troubleshooting:title, which drops «what to check» → «eSIM 在境外无法使用？检查什么 | Magic eSIM». · правило `fidelity-seo` · ai

## ui

### A0001 · мелко · fluency · уверенность 0.7 · linguistic

`pay.finalBody` — checkout window (country page → plan) — [на сайте](https://magicesim.store/zh/esim/thailand/)

**EN**

> We can't take payment yet, so nothing has been charged, no order has been created and no eSIM will be sent. Your email has not been sent or saved.

**Сейчас**

> 我们目前还无法收款，因此没有产生任何费用，没有创建订单，也不会发送 eSIM。您的电子邮箱既未发送也未保存。

**Предложение**

> 我们目前还无法收款，因此没有产生任何费用，没有创建订单，也不会发送 eSIM。您的电子邮箱地址既未被发送，也未被保存。

**Почему:** «电子邮箱既未发送» reads as «the mailbox was not sent» — 电子邮箱 is the mailbox, and as the subject of a passive 发送/保存 the natural object is the address (电子邮箱地址); the passive also reads more clearly with 被. · правило `collocation: 发送/保存 + 电子邮箱地址` · ai

### A0002 · мелко · fluency · уверенность 0.7 · linguistic

`plan.alsoCoversMore` — plan cards (country page) — [на сайте](https://magicesim.store/zh/esim/thailand/)

**EN**

> Also covers {names} + {n} more

**Сейчас**

> 还覆盖{names}及另外 {n} 个

**Предложение**

> 还覆盖{names}及另外 {n} 个国家/地区

**Почему:** The sentence ends on the measure word 个 with no noun, which reads as cut off; a native reader expects the counted noun, as plan.country already supplies it (个国家/地区). · правило `natural phrasing: measure word followed by its noun` · ai

### A0014 · мелко · terminology · уверенность 0.6 · fidelity

`how.step3` — home → how it works — [на сайте](https://magicesim.store/zh/#how)

**EN**

> Install the eSIM profile before you fly.

**Сейчас**

> 出发前安装 eSIM 描述文件。

**Предложение**

> 出发前安装 eSIM 配置文件。

**Почему:** «描述文件» is the iOS term for configuration profiles (VPN, MDM, beta), not for an eSIM; an iPhone reader may look in Settings → VPN与设备管理 for it. The eSIM profile is usually «eSIM 配置文件» (or simply «安装 eSIM», as the rest of the site writes). Terminology rule; not in the glossary, so confidence is moderate. · правило `terminology: eSIM profile ≠ iOS configuration profile` · ai

### A0015 · мелко · accuracy · уверенность 0.55 · fidelity

`site.compatCheck` — several pages — [на сайте](https://magicesim.store/zh/)

**EN**

> iPhone setup

**Сейчас**

> iPhone 设置

**Предложение**

> iPhone 安装指南

**Почему:** «设置» is also the name of the Settings app (platform-labels: 设置), so «iPhone 设置» can read as «iPhone Settings» rather than a link to the iPhone setup guide. Also in ui:site.compatAndroid («Android 设置» → «Android 安装指南»). · правило `ambiguity with an on-screen label` · ai

## guide-troubleshooting

### A0011 · мелко · fluency · уверенность 0.65 · linguistic

`s1.body` — guide «eSIM not working — what to check», section 1 — [на сайте](https://magicesim.store/zh/guides/troubleshooting/#checklist)

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

> • **eSIM 号码开启了吗？**在 SIM 卡设置中检查。
> • **eSIM 设为移动数据卡了吗？**上网流量应通过 eSIM，而不是主 SIM 卡。
> • **eSIM 的数据漫游开启了吗？**旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。
> • **开启飞行模式**十秒钟，然后关闭。
> • **重启手机。**
> • **手动选择网络。**在 eSIM 的网络设置中关闭自动选择，从列表中选择另一个网络。
> • **检查 APN**，仅当您的套餐信息中注明了 APN 时：它必须与 eSIM 设置中的一致。
> • **您在套餐的覆盖范围内吗？**确认您所在的国家或地区在套餐覆盖的国家和地区之列。

**Предложение**

> • **eSIM 号码开启了吗？**在 SIM 卡设置中检查。
> • **eSIM 设为移动数据卡了吗？**上网流量应通过 eSIM，而不是主 SIM 卡。
> • **eSIM 的数据漫游开启了吗？**旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。
> • **开启飞行模式**十秒钟，然后关闭。
> • **重启手机。**
> • **手动选择网络。**在 eSIM 的网络设置中关闭自动选择，从列表中选择另一个网络。
> • **检查 APN**（仅当您的套餐信息中注明了 APN 时）：eSIM 设置中的 APN 应与之一致。
> • **您在套餐的覆盖范围内吗？**确认您所在的国家或地区在套餐覆盖的国家和地区之列。

**Почему:** The condition hangs between a comma and a colon, so «它» has no clear referent; bracketing the condition and naming the APN fixes the structure (应 keeps the English «should»). · правило `clause-structure` · ai

### A0012 · мелко · fluency · уверенность 0.6 · linguistic

`h1` — guide «eSIM not working — what to check» — [на сайте](https://magicesim.store/zh/guides/troubleshooting/)

**EN**

> eSIM not working — what to check

**Сейчас**

> eSIM 无法使用：检查什么

**Предложение**

> eSIM 无法使用时该检查什么

**Почему:** «……：检查什么» is a clipped calque of «— what to check»; a native heading is «eSIM 无法使用时该检查什么». · правило `calque-heading` · ai

## page

### A0003 · мелко · fluency · уверенность 0.6 · linguistic

`homeArtCoverageValue` — home — [на сайте](https://magicesim.store/zh/)

**EN**

> 190+ destinations

**Сейчас**

> 190+ 个目的地

**Предложение**

> 190 多个目的地

**Почему:** «190+ 个» mixes the Latin «+» with the measure word 个, which reads awkwardly; the site's own description already uses the natural form «190 多个目的地». · правило `natural phrasing; consistency with page:homeDescription` · ai

### A0004 · мелко · punctuation · уверенность 0.55 · linguistic

`homeTitle` — home — [на сайте](https://magicesim.store/zh/)

**EN**

> Magic eSIM — travel data abroad without roaming

**Сейчас**

> Magic eSIM — 出境上网，无需漫游

**Предложение**

> Magic eSIM：出境上网，无需漫游

**Почему:** A single em dash «—» is not a Chinese punctuation mark (the README's norm is the double dash ——); as a title separator the country and guide titles already use the full-width colon. Also in page:hubTitle and 404:title, where the brand separator could stay as is or become « | Magic eSIM» like the country title. · правило `README typography D6 (em dash ——); consistency of title separators` · ai

