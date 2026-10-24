# Ревью локализации: es — 2026-10-24

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

Строк с замечаниями: 1 · исправить: **1** · оставить как есть: 0 · стилистика (не применяется): 0 · внесено и подтверждено повторной выгрузкой: **1/1**

### privacy:international.5 · мелко

Privacy Policy §international (li) — [на сайте](https://magicesim.store/es/privacy/#international)

**EN**

> Render and GitHub take part in the EU–U.S. Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection.

**Было**

> Render y GitHub participan en el Marco de Privacidad de Datos UE-EE. UU. (EU–U.S. Data Privacy Framework), para el que la Comisión Europea ha reconocido un nivel de protección adecuado.

**Стало**

> Render y GitHub participan en el Marco de Privacidad de Datos UE-EE. UU. (EU–U.S. Data Privacy Framework), que, según ha reconocido la Comisión Europea, ofrece un nivel de protección adecuado.

**Причина:** Rubric rule 1 (accuracy) in a legal text: «para el que … ha reconocido un nivel» blurs that the Framework is what provides the adequate protection; the fix restores «recognised as providing». Both reviewers' «garante» was not taken because it adds a guarantee the English does not state (rule 2); «ofrece» matches «providing».

**Независимые проверки:** linguistic A0001 (fluency, мелко, 0.65); fidelity A0002 (accuracy, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

## Все замечания этапов

## privacy

### A0001 · мелко · fluency · уверенность 0.65 · linguistic

`international.5` — Privacy Policy §international (li) — [на сайте](https://magicesim.store/es/privacy/#international)

**EN**

> Render and GitHub take part in the EU–U.S. Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection.

**Сейчас**

> Render y GitHub participan en el Marco de Privacidad de Datos UE-EE. UU. (EU–U.S. Data Privacy Framework), para el que la Comisión Europea ha reconocido un nivel de protección adecuado.

**Предложение**

> Render y GitHub participan en el Marco de Privacidad de Datos UE-EE. UU. (EU–U.S. Data Privacy Framework), que la Comisión Europea ha reconocido como garante de un nivel de protección adecuado.

**Почему:** «para el que la Comisión Europea ha reconocido un nivel de protección adecuado» is an awkward relative construction (one recognises a framework AS providing protection, not a level FOR it); «que … ha reconocido como garante de un nivel de protección adecuado» reads naturally and keeps the meaning. · правило `natural-phrasing` · ai

### A0002 · мелко · accuracy · уверенность 0.6 · fidelity

`international.5` — Privacy Policy §international (li) — [на сайте](https://magicesim.store/es/privacy/#international)

**EN**

> Render and GitHub take part in the EU–U.S. Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection.

**Сейчас**

> Render y GitHub participan en el Marco de Privacidad de Datos UE-EE. UU. (EU–U.S. Data Privacy Framework), para el que la Comisión Europea ha reconocido un nivel de protección adecuado.

**Предложение**

> Render y GitHub participan en el Marco de Privacidad de Datos UE-EE. UU. (EU–U.S. Data Privacy Framework), que la Comisión Europea ha reconocido como garante de un nivel de protección adecuado.

**Почему:** Accuracy nuance (rule 1): the English says the Commission recognised the Framework AS PROVIDING adequate protection; «para el que … ha reconocido un nivel» reads as a level recognised «for» the Framework and blurs who provides the protection. The suggestion restores the «recognised as providing» relation without adding anything. The meaning is broadly kept, so this is a nuance, not a factual change. · правило `fidelity: relation in the source kept` · ai

