# Ревью локализации: zh-Hans — 2026-10-24

Строк проверено: **25** · строк с замечаниями: **3** · замечаний: **3**

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 0 |
| мелко (minor) | 3 |
| на вкус (preferential) | 0 |

| Категория | Замечаний |
|---|---|
| fluency | 2 |
| terminology | 1 |

Источник: механические проверки 1, ИИ-ревью 2; второе мнение подтвердило или понизило 0, отклонило 0. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 0.

## Решения арбитра

Строк с замечаниями: 3 · исправить: **0** · оставить как есть: 1 · стилистика (не применяется): 2 · внесено и подтверждено повторной выгрузкой: **0/0**

### Стилистика — записано, не применяется

- privacy:international.5: «参加» is understandable and not an error; «参与» is a slightly better collocation for a framework — a stylistic improvement only, so recorded, not applied (rubric: correct wordings are not changed for taste).
- privacy:retention.7: The English is itself a fragment and «按照 GitHub 隐私声明中的规定» conveys it accurately; «以……为准» reads more finished but the change is stylistic, not an objective error (rubric rule 7).

### Оставлено как есть

- privacy:retention.6: False positive: «设定» here is the verb «set (by ImprovMX)», not the noun «settings» the glossary entry governs; «由 ImprovMX 设定» is correct (rubric rule 7).

## Все замечания этапов

## privacy

### C0001 · мелко · terminology · уверенность 0.8 · check · объективное

`retention.6` — Privacy Policy §retention (li) — [на сайте](https://magicesim.store/zh/privacy/#retention)

**EN**

> <strong>Email forwarding logs:</strong> 7 days (set by ImprovMX).

**Сейчас**

> <strong>电子邮件转发日志：</strong>7 天（由 ImprovMX 设定）。

**Почему:** «设定»: the glossary uses «设置» for «settings». · правило `glossary:settings` · check

### A0001 · мелко · fluency · уверенность 0.65 · linguistic

`international.5` — Privacy Policy §international (li) — [на сайте](https://magicesim.store/zh/privacy/#international)

**EN**

> Render and GitHub take part in the EU–U.S. Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection.

**Сейчас**

> Render 和 GitHub 参加了 EU–U.S. Data Privacy Framework（欧盟—美国数据隐私框架），欧盟委员会已认定该框架提供充分的保护水平。

**Предложение**

> Render 和 GitHub 参与了 EU–U.S. Data Privacy Framework（欧盟—美国数据隐私框架），欧盟委员会已认定该框架提供充分的保护水平。

**Почему:** 参加 collocates with events and activities (会议、比赛); for a certification framework or programme a native writer uses 参与 or 加入. Collocation, not a grammar error. · правило `collocation` · ai

### A0002 · мелко · fluency · уверенность 0.6 · linguistic

`retention.7` — Privacy Policy §retention (li) — [на сайте](https://magicesim.store/zh/privacy/#retention)

**EN**

> <strong>Website visitor logs:</strong> as stated in GitHub’s privacy statement.

**Сейчас**

> <strong>网站访客日志：</strong>按照 GitHub 隐私声明中的规定。

**Предложение**

> <strong>网站访客日志：</strong>以 GitHub 隐私声明中的规定为准。

**Почему:** 「按照……的规定」 is a prepositional phrase that needs a following verb; standing alone after the colon it reads unfinished. 「以……为准」 is the standard way to state a retention period defined elsewhere. · правило `incomplete-predicate` · ai

