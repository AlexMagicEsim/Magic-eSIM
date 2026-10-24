# Ревью локализации: fr — 2026-10-24

Строк проверено: **25** · строк с замечаниями: **1** · замечаний: **2**

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 0 |
| мелко (minor) | 2 |
| на вкус (preferential) | 0 |

| Категория | Замечаний |
|---|---|
| fluency | 1 |
| accuracy | 1 |

Источник: механические проверки 0, ИИ-ревью 2; второе мнение подтвердило или понизило 0, отклонило 0. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 0.

## Решения арбитра

Строк с замечаниями: 1 · исправить: **0** · оставить как есть: 0 · стилистика (не применяется): 1 · внесено и подтверждено повторной выгрузкой: **0/0**

### Стилистика — записано, не применяется

- privacy:international.5: «reconnaître un niveau de protection adéquat pour un cadre» is grammatical French and keeps the fact (the Commission recognised the framework's protection as adequate); «que … a reconnu comme offrant» mirrors the English more closely but is a stylistic improvement, not an objective error (rubric rule 7; both findings marked non-objective).

## Все замечания этапов

## privacy

### A0001 · мелко · fluency · уверенность 0.7 · linguistic

`international.5` — Privacy Policy §international (li) — [на сайте](https://magicesim.store/fr/privacy/#international)

**EN**

> Render and GitHub take part in the EU–U.S. Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection.

**Сейчас**

> Render et GitHub participent au cadre de protection des données UE–États-Unis (EU–U.S. Data Privacy Framework), pour lequel la Commission européenne a reconnu un niveau de protection adéquat.

**Предложение**

> Render et GitHub participent au cadre de protection des données UE–États-Unis (EU–U.S. Data Privacy Framework), que la Commission européenne a reconnu comme offrant un niveau de protection adéquat.

**Почему:** « pour lequel la Commission européenne a reconnu un niveau de protection adéquat » is an awkward construction (reconnaître un niveau pour un cadre); the natural French is « que la Commission européenne a reconnu comme offrant un niveau de protection adéquat », which also mirrors the English structure. · правило `natural phrasing` · ai

### A0002 · мелко · accuracy · уверенность 0.6 · fidelity

`international.5` — Privacy Policy §international (li) — [на сайте](https://magicesim.store/fr/privacy/#international)

**EN**

> Render and GitHub take part in the EU–U.S. Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection.

**Сейчас**

> Render et GitHub participent au cadre de protection des données UE–États-Unis (EU–U.S. Data Privacy Framework), pour lequel la Commission européenne a reconnu un niveau de protection adéquat.

**Предложение**

> Render et GitHub participent au cadre de protection des données UE–États-Unis (EU–U.S. Data Privacy Framework), que la Commission européenne a reconnu comme offrant un niveau de protection adéquat.

**Почему:** The English says the Commission recognised the framework AS PROVIDING an adequate level of protection; «pour lequel … a reconnu un niveau» blurs who provides the protection. «que … a reconnu comme offrant» restates the English relation exactly (rule 1, accuracy). Nuance, not a changed fact. · правило `fidelity-relation` · ai

