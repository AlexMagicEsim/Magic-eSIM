# Ревью локализации: ko — 2026-10-24

Строк проверено: **25** · строк с замечаниями: **3** · замечаний: **3**

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 2 |
| мелко (minor) | 1 |
| на вкус (preferential) | 0 |

| Категория | Замечаний |
|---|---|
| grammar | 2 |
| accuracy | 1 |

Источник: механические проверки 0, ИИ-ревью 3; второе мнение подтвердило или понизило 0, отклонило 0. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 0.

## Решения арбитра

Строк с замечаниями: 3 · исправить: **3** · оставить как есть: 0 · стилистика (не применяется): 0 · внесено и подтверждено повторной выгрузкой: **3/3**

### privacy:providers.3 · важно

Privacy Policy §providers (p) — [на сайте](https://magicesim.store/ko/privacy/#providers)

**EN**

> Hosts the website’s pages. GitHub also logs visitors’ IP addresses for its own security purposes, under its own privacy statement. <em>Data:</em> IP address and technical data of your visit.

**Было**

> 웹사이트 페이지를 호스팅합니다. GitHub는 또한 자체 개인정보 처리방침(privacy statement)에 따라 자체 보안 목적으로 방문자의 IP 주소를 기록합니다. <em>정보:</em> 방문 시의 IP 주소 및 기술 정보.

**Стало**

> 웹사이트 페이지를 호스팅합니다. GitHub은 또한 자체 개인정보 처리방침(privacy statement)에 따라 자체 보안 목적으로 방문자의 IP 주소를 기록합니다. <em>정보:</em> 방문 시의 IP 주소 및 기술 정보.

**Причина:** D15: a particle after a Latin word follows its Korean reading; GitHub = 깃허브 ends in ㅂ, so the topic particle is 은, not 는. Only the particle changes; <em> label and meaning kept.

**Независимые проверки:** linguistic A0001 (grammar, важно, 0.85) · плейсхолдеры сохранены · на сайте именно этот текст

### privacy:international.5 · важно

Privacy Policy §international (li) — [на сайте](https://magicesim.store/ko/privacy/#international)

**EN**

> Render and GitHub take part in the EU–U.S. Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection.

**Было**

> Render와 GitHub는 EU–U.S. Data Privacy Framework(EU-미국 데이터 프라이버시 프레임워크)에 참여하고 있으며, 유럽연합 집행위원회는 이 프레임워크가 적정한 수준의 보호를 제공한다고 인정했습니다.

**Стало**

> Render와 GitHub은 EU–U.S. Data Privacy Framework(EU-미국 데이터 프라이버시 프레임워크)에 참여하고 있으며, 유럽연합 집행위원회는 이 프레임워크가 적정한 수준의 보호를 제공한다고 인정했습니다.

**Причина:** D15: the particle attaches to the last word GitHub (깃허브, final ㅂ), so 은 is required instead of 는; same fix as privacy:providers.3 for consistency.

**Независимые проверки:** linguistic A0002 (grammar, важно, 0.85) · плейсхолдеры сохранены · на сайте именно этот текст

### privacy:international.1 · мелко

Privacy Policy §international (p) — [на сайте](https://magicesim.store/ko/privacy/#international)

**EN**

> We are based in Georgia, but our service providers are international companies. As a result, your data may be processed outside Georgia, mainly in the United States, the European Economic Area and Switzerland, and in other countries where these providers or their own providers operate.

**Было**

> 당사는 조지아에 소재하지만, 당사의 서비스 제공업체는 국제적인 기업입니다. 따라서 귀하의 정보는 조지아 밖에서, 주로 미국, 유럽경제지역(EEA), 스위스, 그리고 이러한 제공업체 또는 그들이 이용하는 제공업체가 운영되는 기타 국가에서 처리될 수 있습니다.

**Стало**

> 당사는 조지아에 소재하지만, 당사의 서비스 제공업체는 국제적인 기업입니다. 따라서 귀하의 정보는 조지아 밖에서, 주로 미국, 유럽경제지역(EEA) 및 스위스에서, 그리고 이러한 제공업체 또는 그들이 이용하는 제공업체가 운영되는 기타 국가에서도 처리될 수 있습니다.

**Причина:** Rule 1 (accuracy): in the English «mainly» scopes only the US, the EEA and Switzerland, with «other countries» as an additional set; the current Korean puts 기타 국가 inside the 주로 list. In a legal text the English scope is the reference, so the list is closed before «그리고 … 기타 국가에서도».

**Независимые проверки:** fidelity A0003 (accuracy, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

## Все замечания этапов

## privacy

### A0002 · важно · grammar · уверенность 0.85 · linguistic · объективное

`international.5` — Privacy Policy §international (li) — [на сайте](https://magicesim.store/ko/privacy/#international)

**EN**

> Render and GitHub take part in the EU–U.S. Data Privacy Framework, which the European Commission has recognised as providing an adequate level of protection.

**Сейчас**

> Render와 GitHub는 EU–U.S. Data Privacy Framework(EU-미국 데이터 프라이버시 프레임워크)에 참여하고 있으며, 유럽연합 집행위원회는 이 프레임워크가 적정한 수준의 보호를 제공한다고 인정했습니다.

**Предложение**

> Render와 GitHub은 EU–U.S. Data Privacy Framework(EU-미국 데이터 프라이버시 프레임워크)에 참여하고 있으며, 유럽연합 집행위원회는 이 프레임워크가 적정한 수준의 보호를 제공한다고 인정했습니다.

**Почему:** Particle after a Latin word follows its Korean reading (README D15): GitHub = 깃허브, ends in the final consonant ㅂ, so the topic particle is 은, not 는 (GitHub Docs ko writes «GitHub은»). Same problem as privacy:providers.3. · правило `ko-D15-latin-particle` · ai

### A0001 · важно · grammar · уверенность 0.85 · linguistic · объективное

`providers.3` — Privacy Policy §providers (p) — [на сайте](https://magicesim.store/ko/privacy/#providers)

**EN**

> Hosts the website’s pages. GitHub also logs visitors’ IP addresses for its own security purposes, under its own privacy statement. <em>Data:</em> IP address and technical data of your visit.

**Сейчас**

> 웹사이트 페이지를 호스팅합니다. GitHub는 또한 자체 개인정보 처리방침(privacy statement)에 따라 자체 보안 목적으로 방문자의 IP 주소를 기록합니다. <em>정보:</em> 방문 시의 IP 주소 및 기술 정보.

**Предложение**

> 웹사이트 페이지를 호스팅합니다. GitHub은 또한 자체 개인정보 처리방침(privacy statement)에 따라 자체 보안 목적으로 방문자의 IP 주소를 기록합니다. <em>정보:</em> 방문 시의 IP 주소 및 기술 정보.

**Почему:** Particle after a Latin word follows its Korean reading (README D15): GitHub = 깃허브, ends in the final consonant ㅂ, so the topic particle is 은, not 는 (GitHub Docs ko writes «GitHub은»). Also in privacy:international.5. · правило `ko-D15-latin-particle` · ai

### A0003 · мелко · accuracy · уверенность 0.6 · fidelity

`international.1` — Privacy Policy §international (p) — [на сайте](https://magicesim.store/ko/privacy/#international)

**EN**

> We are based in Georgia, but our service providers are international companies. As a result, your data may be processed outside Georgia, mainly in the United States, the European Economic Area and Switzerland, and in other countries where these providers or their own providers operate.

**Сейчас**

> 당사는 조지아에 소재하지만, 당사의 서비스 제공업체는 국제적인 기업입니다. 따라서 귀하의 정보는 조지아 밖에서, 주로 미국, 유럽경제지역(EEA), 스위스, 그리고 이러한 제공업체 또는 그들이 이용하는 제공업체가 운영되는 기타 국가에서 처리될 수 있습니다.

**Предложение**

> 당사는 조지아에 소재하지만, 당사의 서비스 제공업체는 국제적인 기업입니다. 따라서 귀하의 정보는 조지아 밖에서, 주로 미국, 유럽경제지역(EEA) 및 스위스에서, 그리고 이러한 제공업체 또는 그들이 이용하는 제공업체가 운영되는 기타 국가에서도 처리될 수 있습니다.

**Почему:** In the English «mainly» qualifies only the US, the EEA and Switzerland; «and in other countries…» is a separate, additional set. The Korean folds «기타 국가» into the same 주로 list, so the other countries also read as a «main» location. Closing the list with «…스위스에서, 그리고 … 기타 국가에서도» restores the English scope (rule 1, accuracy). · правило `fidelity:scope-of-mainly` · ai

