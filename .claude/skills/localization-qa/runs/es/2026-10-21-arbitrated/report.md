# Ревью локализации: es — 2026-10-21

Строк проверено: **515** · строк с замечаниями: **23** · замечаний: **29** · код: `e837aa36`

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 1 |
| мелко (minor) | 20 |
| на вкус (preferential) | 8 |

| Категория | Замечаний |
|---|---|
| fluency | 6 |
| style-variant | 5 |
| country-name | 4 |
| accuracy | 4 |
| terminology | 3 |
| consistency | 3 |
| grammar | 2 |
| spelling | 1 |
| platform-label | 1 |

Источник: механические проверки 2, ИИ-ревью 27; второе мнение подтвердило или понизило 0, отклонило 0. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 2.

## Решения арбитра

Строк с замечаниями: 23 · исправить: **5** · оставить как есть: 4 · стилистика (не применяется): 14 · внесено и подтверждено повторной выгрузкой: **5/5**

### guide-iphone:s2.body · мелко

guide «How to install an eSIM on iPhone», section 2 — [на сайте](https://magicesim.store/es/guides/iphone/#qr)

**EN**

> • Show your eSIM's QR code on another screen: a computer, a tablet or a second phone.
> • On the iPhone, open the **Camera** app and scan the QR code.
> • When the **Cellular Plan Detected** notification appears, tap it.
> • Tap **Continue**, then **Add Cellular Plan**. If you are asked for a confirmation code, enter the one provided with your eSIM.
> • Give the line a clear name, such as «Travel», so you do not mix it up with your main SIM.
> With iOS 17.4 or later, if the QR code is in an email or on a web page on the iPhone itself, touch and hold the code, then tap **Add eSIM**.

**Было**

> • Muestra el código QR de tu eSIM en otra pantalla: un ordenador, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil**. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Стало**

> • Muestra el código QR de tu eSIM en otra pantalla: una computadora, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil** (**Agregar plan de datos**). Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Причина:** «ordenador» is a Spain-only word the README variant rule excludes (glossary: «computadora»); and the decided guide rule gives both regional labels, so «Add Cellular Plan» gets its listed es-MX label «Agregar plan de datos» (platform-labels.md, Apple 118669) like every other label in the step.

**Независимые проверки:** linguistic A0005 (style-variant, важно, 0.95); fidelity A0021 (terminology, мелко, 0.85); check C0001 (terminology, мелко, 0.8); fidelity A0020 (consistency, мелко, 0.8) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:faq2.q · мелко

guide «How to install an eSIM on iPhone», question 2 — [на сайте](https://magicesim.store/es/guides/iphone/#faq)

**EN**

> The QR code is on this same iPhone. Can I still install it?

**Было**

> El código QR está en este mismo iPhone. ¿Puedo instalarla igualmente?

**Стало**

> El código QR está en este mismo iPhone. ¿Puedo instalar la eSIM igualmente?

**Причина:** A standalone FAQ question (shown alone in FAQPage) whose only noun is masculine «El código QR» leaves the feminine «instalarla» with no antecedent — a grammar/clarity error; naming «la eSIM» adds no fact (the English «it» is the eSIM).

**Независимые проверки:** linguistic A0008 (grammar, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:faq1.q · мелко

guide «When to install and turn on your eSIM», question 1 — [на сайте](https://magicesim.store/es/guides/activation/#faq)

**EN**

> I installed the eSIM a week before the trip. Is the plan already running?

**Было**

> Instalé la eSIM una semana antes del viaje. ¿El plan ya está contando?

**Стало**

> Instalé la eSIM una semana antes del viaje. ¿Ya empezó a correr la validez del plan?

**Причина:** «¿El plan ya está contando?» is an intransitive calque of «is running» with no clear object, ambiguous on exactly the point the guide exists to explain (when validity starts); «empezó a correr la validez» states the English meaning without adding a fact.

**Независимые проверки:** linguistic A0009 (fluency, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:s4.body · мелко

guide «How to install an eSIM on iPhone», section 4 — [на сайте](https://magicesim.store/es/guides/iphone/#data)

**EN**

> • In **Settings → Cellular**, make sure the eSIM line is turned on.
> • Tap **Cellular Data** and choose the eSIM line. Your main SIM can stay on for calls and texts.
> • Open the eSIM line and turn on **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.
> Menu names can differ slightly between iOS versions.

**Было**

> • En **Ajustes → Datos móviles** (**Configuración → Datos celulares**), comprueba que la línea eSIM está activada.
> • Toca **Datos móviles** (**Datos celulares**) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas y mensajes de texto.
> • Abre la línea eSIM y activa la itinerancia de datos (en algunas regiones se llama roaming de datos). Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.
> • Si no quieres cargos de tu operador habitual, desactiva la itinerancia de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.
> Los nombres de los menús pueden variar un poco según la versión de iOS y el idioma del teléfono.

**Стало**

> • En **Ajustes → Datos móviles** (**Configuración → Datos celulares**), comprueba que la línea eSIM está activada.
> • Toca **Datos móviles** (**Datos celulares**) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas y mensajes de texto.
> • Abre la línea eSIM y activa la itinerancia de datos (en algunas regiones se llama roaming de datos). Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.
> • Si no quieres cargos de tu operador habitual, desactiva la itinerancia de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.
> Los nombres de los menús pueden variar un poco según la versión de iOS.

**Причина:** Rule 1: the last line adds «y el idioma del teléfono», information the English does not carry; the corrected line matches the English («según la versión de iOS»).

**Независимые проверки:** fidelity A0022 (accuracy, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-android:faq3.a · мелко

guide «How to install an eSIM on Android», answer 3 — [на сайте](https://magicesim.store/es/guides/android/#faq)

**EN**

> Only if your plan's details list an APN: then check that it matches in the eSIM's settings.

**Было**

> Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM (en Pixel, «Nombres de puntos de acceso»).

**Стало**

> Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM.

**Причина:** Rule 1: the parenthesis adds a Pixel menu name the English answer does not give and no label rule requires it; dropping it restores the English content.

**Независимые проверки:** fidelity A0024 (accuracy, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### Стилистика — записано, не применяется

- ui:home.guidesTitle: «soluciona tu eSIM» is understood and grammatical (colloquial «solucionar» + object); «soluciona problemas» is a collocation preference, not an error — correct, clear wording is not changed for style.
- ui:how.step4: The feminine clitic refers to the eSIM, the subject of the whole how-it-works list (the English says «it» too); naming «la eSIM» is a clarity nicety, not a grammar error.
- ui:hub.matches.one: «{n} destino coincide» is grammatical and clear; «encontrado» is a phrasing preference.
- daily:place:the Middle East: «Oriente Medio» and «Medio Oriente» are both correct and understood everywhere; the README excludes neither, so a Spain vs Latin-American choice is optional under the owner's rule.
- guide-iphone:faq2.a: «mantener pulsado» is correct and understood in Latin America; it is a description of a gesture, not a quoted label, and the README does not exclude it — regional preference only.
- guide-iphone:faq1.a: The answer is read under its question about installing the eSIM; the feminine «-la» cannot be read as «el perfil», so the meaning is clear. Naming the eSIM is a readability nicety.
- guide-activation:description: «empezar su validez» is grammatical (transitive «empezar»), clear, and mirrors the English «starting its validity»; the suggested rewording is stylistic.
- guide-activation:s5.h2: The present perfect «¿Has aterrizado…?» is correct and understood everywhere; preterite preference in Latin America is a regional style choice the README does not exclude.
- guide-troubleshooting:faq3.q: «¿Me cobrará mi SIM principal…?» is a common metonymy (the line charges you) and keeps the English meaning; «me cobrarán por» is a phrasing preference.
- guide-iphone:description: «introducir los datos» is correct and understood across Latin America; «ingresar» is a regional preference the README does not exclude.
- countries:SA: «Arabia Saudí» and «Arabia Saudita» are both RAE-valid and understood; the README excludes neither, so the Spain vs Latin-American choice is optional under the owner's rule (an SEO switch is a separate owner decision).
- countries:TL: «Timor-Leste» is the official name (UN/CLDR Spanish) and is correct; «Timor Oriental» is a common exonym preference, not an error fix.
- countries:ML: «Mali» is accepted (CLDR es) and understood; the RAE's «Malí» is a spelling preference, not an error.
- daily:reset: «El límite se renueva cada 24 horas» is accurate (the daily amount is the cap that resets); aligning with «cantidad de datos» elsewhere is a consistency nicety, not a meaning error.

### Оставлено как есть

- guide-android:s1.body: The Spanish quotes Samsung's own Spanish labels («Gestor de SIM», «Añadir eSIM») and Google's listed es-419 labels from platform-labels.md; «plan» is not needed once the vendor label is used. Any mismatch is in the English label, an owner check, not a Spanish fix.
- ui:nav.compat: «Compatibilidad» is a clear short menu label for the device-compatibility page; it loses no fact the reader needs.
- guide-android:s3.body: The Samsung roaming path is described rather than quoted because platform-labels.md lists no official Spanish Samsung label for data roaming (a binding rule), and the Pixel path substitutes listed labels (2926415) so the step still names a real setting; the English should be aligned by the owner, not the Spanish reduced.
- countries:QA: «Catar» is the RAE/CLDR Spanish spelling and correct; «Qatar» is an SEO preference, not an error.

## Все замечания этапов

## guide-iphone

### A0005 · важно · style-variant · уверенность 0.95 · linguistic · объективное

`s2.body` — guide «How to install an eSIM on iPhone», section 2 — [на сайте](https://magicesim.store/es/guides/iphone/#qr)

**EN**

> • Show your eSIM's QR code on another screen: a computer, a tablet or a second phone.
> • On the iPhone, open the **Camera** app and scan the QR code.
> • When the **Cellular Plan Detected** notification appears, tap it.
> • Tap **Continue**, then **Add Cellular Plan**. If you are asked for a confirmation code, enter the one provided with your eSIM.
> • Give the line a clear name, such as «Travel», so you do not mix it up with your main SIM.
> With iOS 17.4 or later, if the QR code is in an email or on a web page on the iPhone itself, touch and hold the code, then tap **Add eSIM**.

**Сейчас**

> • Muestra el código QR de tu eSIM en otra pantalla: un ordenador, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil**. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Предложение**

> • Muestra el código QR de tu eSIM en otra pantalla: una computadora, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil**. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Почему:** «ordenador» is Spain-only; the README's variant rule (neutral, Latin-American-first) names it and prefers «computadora». · правило `es/README variant: no Spain-only words` · ai

### A0021 · мелко · terminology · уверенность 0.85 · fidelity · объективное

`s2.body` — guide «How to install an eSIM on iPhone», section 2 — [на сайте](https://magicesim.store/es/guides/iphone/#qr)

**EN**

> • Show your eSIM's QR code on another screen: a computer, a tablet or a second phone.
> • On the iPhone, open the **Camera** app and scan the QR code.
> • When the **Cellular Plan Detected** notification appears, tap it.
> • Tap **Continue**, then **Add Cellular Plan**. If you are asked for a confirmation code, enter the one provided with your eSIM.
> • Give the line a clear name, such as «Travel», so you do not mix it up with your main SIM.
> With iOS 17.4 or later, if the QR code is in an email or on a web page on the iPhone itself, touch and hold the code, then tap **Add eSIM**.

**Сейчас**

> • Muestra el código QR de tu eSIM en otra pantalla: un ordenador, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil**. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Предложение**

> • Muestra el código QR de tu eSIM en otra pantalla: una computadora, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil**. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Почему:** «ordenador» is Spain-only; the glossary sets «computadora» for this Latin-American-first site (glossary term «computer», avoid «ordenador»). · правило `glossary:computer` · ai

### C0001 · мелко · terminology · уверенность 0.8 · check · объективное

`s2.body` — guide «How to install an eSIM on iPhone», section 2 — [на сайте](https://magicesim.store/es/guides/iphone/#qr)

**EN**

> • Show your eSIM's QR code on another screen: a computer, a tablet or a second phone.
> • On the iPhone, open the **Camera** app and scan the QR code.
> • When the **Cellular Plan Detected** notification appears, tap it.
> • Tap **Continue**, then **Add Cellular Plan**. If you are asked for a confirmation code, enter the one provided with your eSIM.
> • Give the line a clear name, such as «Travel», so you do not mix it up with your main SIM.
> With iOS 17.4 or later, if the QR code is in an email or on a web page on the iPhone itself, touch and hold the code, then tap **Add eSIM**.

**Сейчас**

> • Muestra el código QR de tu eSIM en otra pantalla: un ordenador, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil**. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Почему:** «ordenador»: the glossary uses «computadora» for «computer» — «ordenador» is Spain's word; Latin America says «computadora» (Latin-American-first audience). · правило `glossary:computer` · check

### A0020 · мелко · consistency · уверенность 0.8 · fidelity · объективное

`s2.body` — guide «How to install an eSIM on iPhone», section 2 — [на сайте](https://magicesim.store/es/guides/iphone/#qr)

**EN**

> • Show your eSIM's QR code on another screen: a computer, a tablet or a second phone.
> • On the iPhone, open the **Camera** app and scan the QR code.
> • When the **Cellular Plan Detected** notification appears, tap it.
> • Tap **Continue**, then **Add Cellular Plan**. If you are asked for a confirmation code, enter the one provided with your eSIM.
> • Give the line a clear name, such as «Travel», so you do not mix it up with your main SIM.
> With iOS 17.4 or later, if the QR code is in an email or on a web page on the iPhone itself, touch and hold the code, then tap **Add eSIM**.

**Сейчас**

> • Muestra el código QR de tu eSIM en otra pantalla: un ordenador, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil**. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Предложение**

> • Muestra el código QR de tu eSIM en otra pantalla: un ordenador, una tableta u otro teléfono.
> • En el iPhone, abre la app **Cámara** y escanea el código QR.
> • Cuando aparezca la notificación **Plan móvil detectado** (**Plan de datos celulares detectado**), tócala.
> • Toca **Continuar** y después **Añadir plan móvil** (**Agregar plan de datos**). Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Почему:** «Add Cellular Plan» is given only in the Spain form here («Añadir plan móvil»), while every other iPhone label in this guide gives both (es-ES then es-MX); a Latin-American reader will not find «Añadir plan móvil» on a Configuración screen. platform-labels.md: es-MX «Agregar plan de datos» (Apple 118669). · правило `both-regional-labels` · ai

### A0008 · мелко · grammar · уверенность 0.7 · linguistic · объективное

`faq2.q` — guide «How to install an eSIM on iPhone», question 2 — [на сайте](https://magicesim.store/es/guides/iphone/#faq)

**EN**

> The QR code is on this same iPhone. Can I still install it?

**Сейчас**

> El código QR está en este mismo iPhone. ¿Puedo instalarla igualmente?

**Предложение**

> El código QR está en este mismo iPhone. ¿Puedo instalar la eSIM igualmente?

**Почему:** «instalarla» has no feminine antecedent: the only noun in the question is «El código QR» (masculine), so the pronoun reads as dangling. · правило `pronoun agreement with antecedent` · ai

### A0007 · мелко · fluency · уверенность 0.65 · linguistic

`faq1.a` — guide «How to install an eSIM on iPhone», answer 1 — [на сайте](https://magicesim.store/es/guides/iphone/#faq)

**EN**

> You need an internet connection to download the profile, and Wi-Fi is the easiest. Installing on the day you travel, before you leave home or on airport Wi-Fi, works whatever the plan's rules for when its validity starts.

**Сейчас**

> Necesitas conexión a internet para descargar el perfil, y lo más sencillo es una red Wi-Fi. Instalarla el día del viaje, antes de salir de casa o con el Wi-Fi del aeropuerto, funciona sean cuales sean las reglas del plan sobre cuándo empieza su validez.

**Предложение**

> Necesitas conexión a internet para descargar el perfil, y lo más sencillo es una red Wi-Fi. Instalar la eSIM el día del viaje, antes de salir de casa o con el Wi-Fi del aeropuerto, funciona sean cuales sean las reglas del plan sobre cuándo empieza su validez.

**Почему:** The clitic «-la» has no feminine antecedent in this answer (the previous noun is «el perfil»), and FAQ answers are read standalone in FAQPage; name the eSIM. · правило `clear antecedent` · ai

### A0006 · мелко · style-variant · уверенность 0.6 · linguistic

`faq2.a` — guide «How to install an eSIM on iPhone», answer 2 — [на сайте](https://magicesim.store/es/guides/iphone/#faq)

**EN**

> Yes. With iOS 17.4 or later, touch and hold the QR code in the email or web page, then tap Add eSIM. Or choose Enter Details Manually and type in the details provided with your eSIM.

**Сейчас**

> Sí. Con iOS 17.4 o posterior, mantén pulsado el código QR en el correo o en la página web y toca Añadir eSIM (Agregar eSIM). O elige Introducir Detalles Manualmente (Ingresar detalles manualmente) y escribe los datos que acompañan a tu eSIM.

**Предложение**

> Sí. Con iOS 17.4 o posterior, mantén presionado el código QR en el correo o en la página web y toca Añadir eSIM (Agregar eSIM). O elige Introducir Detalles Manualmente (Ingresar detalles manualmente) y escribe los datos que acompañan a tu eSIM.

**Почему:** «mantener pulsado» leans to Spain; Latin-American readers say «mantener presionado» for touch-and-hold. Also in guide-iphone:s2.body (last line). If the README treats this gesture as a vendor label, ignore. · правило `es/README variant: LatAm-first` · ai

### A0022 · мелко · accuracy · уверенность 0.6 · fidelity · объективное

`s4.body` — guide «How to install an eSIM on iPhone», section 4 — [на сайте](https://magicesim.store/es/guides/iphone/#data)

**EN**

> • In **Settings → Cellular**, make sure the eSIM line is turned on.
> • Tap **Cellular Data** and choose the eSIM line. Your main SIM can stay on for calls and texts.
> • Open the eSIM line and turn on **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.
> Menu names can differ slightly between iOS versions.

**Сейчас**

> • En **Ajustes → Datos móviles** (**Configuración → Datos celulares**), comprueba que la línea eSIM está activada.
> • Toca **Datos móviles** (**Datos celulares**) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas y mensajes de texto.
> • Abre la línea eSIM y activa la itinerancia de datos (en algunas regiones se llama roaming de datos). Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.
> • Si no quieres cargos de tu operador habitual, desactiva la itinerancia de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.
> Los nombres de los menús pueden variar un poco según la versión de iOS y el idioma del teléfono.

**Предложение**

> • En **Ajustes → Datos móviles** (**Configuración → Datos celulares**), comprueba que la línea eSIM está activada.
> • Toca **Datos móviles** (**Datos celulares**) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas y mensajes de texto.
> • Abre la línea eSIM y activa la itinerancia de datos (en algunas regiones se llama roaming de datos). Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.
> • Si no quieres cargos de tu operador habitual, desactiva la itinerancia de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.
> Los nombres de los menús pueden variar un poco según la versión de iOS.

**Почему:** The last line adds «y el idioma del teléfono» — the English says only that names differ between iOS versions. Harmless and arguably true given the two regional labels, but it is information the source does not carry; either drop it or add it to the English. · правило `no-added-information` · ai

### A0013 · на вкус · style-variant · уверенность 0.5 · linguistic

`description` — guide «How to install an eSIM on iPhone» — [на сайте](https://magicesim.store/es/guides/iphone/)

**EN**

> Install a travel eSIM on iPhone with a QR code or by entering the details manually, then switch on data for the trip.

**Сейчас**

> Instala una eSIM de viaje en iPhone con un código QR o introduciendo los datos a mano, y activa los datos para el viaje.

**Предложение**

> Instala una eSIM de viaje en iPhone con un código QR o ingresando los datos a mano, y activa los datos para el viaje.

**Почему:** «introducir» (data) is the Spain-leaning verb; Latin-American readers expect «ingresar» (the LatAm iOS label itself is «Ingresar detalles manualmente»). Also «introduce» in guide-iphone:s2.body, s3.h2, guide-activation:s5.body. Understood everywhere, hence preferential. · правило `es/README variant: LatAm-first` · ai

## countries

### A0014 · мелко · country-name · уверенность 0.75 · linguistic

`SA` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/saudi-arabia/)

**EN**

> Saudi Arabia

**Сейчас**

> Arabia Saudí

**Предложение**

> Arabia Saudita

**Почему:** Both forms are accepted by the RAE, but «Arabia Saudí» is the Spain-leaning form; for the Latin-American-first neutral variant (README D1) «Arabia Saudita» is the form Latin-American readers use and search for. · правило `es README: variant — Latin-American-first, avoid Spain-only forms` · ai

### A0015 · мелко · country-name · уверенность 0.65 · linguistic

`TL` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/timor-leste/)

**EN**

> Timor-Leste

**Сейчас**

> Timor-Leste

**Предложение**

> Timor Oriental

**Почему:** «Timor-Leste» is the Portuguese official name left untranslated; the RAE/Fundéu recommend the Spanish exonym «Timor Oriental», which is what native readers use. · правило `RAE Ortografía 2010 country list / Fundéu` · ai

### A0016 · на вкус · spelling · уверенность 0.55 · linguistic

`ML` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/mali/)

**EN**

> Mali

**Сейчас**

> Mali

**Предложение**

> Malí

**Почему:** The RAE country list and Fundéu prefer the stressed-final spelling «Malí»; «Mali» is tolerated, so this is a preference, not an error. · правило `RAE Ortografía 2010 country list` · ai

### A0027 · на вкус · country-name · уверенность 0.55 · fidelity

`QA` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/qatar/)

**EN**

> Qatar

**Сейчас**

> Catar

**Предложение**

> Qatar

**Почему:** «Catar» is the RAE/CLDR spelling and correct, but «Qatar» is what most Latin-American readers write and search for («eSIM Qatar»); the name feeds page titles and H1. A matter of SEO taste; current text is acceptable. · правило `seo-search-intent` · ai

### A0029 · на вкус · country-name · уверенность 0.5 · fidelity

`ML` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/mali/)

**EN**

> Mali

**Сейчас**

> Mali

**Предложение**

> Malí

**Почему:** RAE/Fundéu write «Malí» with an accent (CLDR es keeps «Mali»); both appear in Latin-American usage. Preferential, no meaning change. · правило `country-name-usual-form` · ai

## ui

### A0001 · мелко · fluency · уверенность 0.75 · linguistic

`home.guidesTitle` — home — [на сайте](https://magicesim.store/es/)

**EN**

> Set up and fix your eSIM

**Сейчас**

> Configura y soluciona tu eSIM

**Предложение**

> Configura tu eSIM y soluciona problemas

**Почему:** «Solucionar» takes a problem as its object, not the device: «soluciona tu eSIM» reads as a calque of «fix your eSIM». Also in ui:home.guidesLead («Instala, comprueba y soluciona una eSIM de viaje» → «Instala y comprueba una eSIM de viaje, y soluciona problemas, paso a paso.»). · правило `natural collocation (solucionar + problema)` · ai

### A0003 · мелко · fluency · уверенность 0.65 · linguistic

`hub.matches.one` — destination list search — [на сайте](https://magicesim.store/es/esim/)

**EN**

> {n} destination match

**Сейчас**

> {n} destino coincide

**Предложение**

> {n} destino encontrado

**Почему:** Grammatical but a calque of «match»: a bare count + «coincide» reads unnatural as a search-result status; «{n} destino encontrado / {n} destinos encontrados» is the usual phrasing. Also in ui:hub.matches.other («{n} destinos encontrados»). · правило `natural phrasing` · ai

### A0002 · мелко · grammar · уверенность 0.6 · linguistic

`how.step4` — home → how it works — [на сайте](https://magicesim.store/es/#how)

**EN**

> Land, switch it on, and you are online.

**Сейчас**

> Al aterrizar, actívala y ya tienes conexión.

**Предложение**

> Al aterrizar, activa la eSIM y ya tienes conexión.

**Почему:** The step before it ends on «el perfil eSIM» (masculine), so the feminine clitic «actívala» has no matching antecedent in the visible list; naming «la eSIM» removes the mismatch. · правило `pronoun–antecedent agreement across adjacent steps` · ai

### A0017 · на вкус · accuracy · уверенность 0.5 · fidelity

`nav.compat` — header menu — [на сайте](https://magicesim.store/es/)

**EN**

> Device check

**Сейчас**

> Compatibilidad

**Предложение**

> Comprobar el teléfono

**Почему:** The English names an action (checking the device); «Compatibilidad» names only the topic, so the menu item no longer says the reader can check their phone there. Acceptable as a short menu label — a matter of taste (rubric: accuracy, preferential). · правило `fidelity-nuance` · ai

## daily

### A0018 · мелко · consistency · уверенность 0.6 · fidelity

`reset` — daily plan card — [на сайте](https://magicesim.store/es/esim/thailand/#dailyBlock)

**EN**

> The allowance resets every 24 hours

**Сейчас**

> El límite se renueva cada 24 horas

**Предложение**

> La cantidad de datos se renueva cada 24 horas

**Почему:** «allowance» is the daily data amount; «límite» reads as a cap and can be confused with the throttle line just above («Después, hasta {s}»). The batch already renders «allowance» as «cantidad de datos» (page:dailyNote), so the suggestion is also consistent. Also in daily:sample-card. · правило `one source term, one translation; meaning of «allowance»` · ai

### A0004 · на вкус · style-variant · уверенность 0.55 · linguistic

`place:the Middle East` — daily plan card title («Region — 1 GB a day») — [на сайте](https://magicesim.store/es/esim/thailand/#dailyBlock)

**EN**

> the Middle East

**Сейчас**

> Oriente Medio

**Предложение**

> Medio Oriente

**Почему:** Both forms are correct; «Oriente Medio» is the Spain-preferred form, while the Latin-American-first variant (README D1) normally uses «Medio Oriente». · правило `variant: neutral, Latin-American-first` · ai

### A0019 · на вкус · terminology · уверенность 0.55 · fidelity

`place:the Middle East` — daily plan card title («Region — 1 GB a day») — [на сайте](https://magicesim.store/es/esim/thailand/#dailyBlock)

**EN**

> the Middle East

**Сейчас**

> Oriente Medio

**Предложение**

> Medio Oriente

**Почему:** Both are correct; «Oriente Medio» is the usual form in Spain, «Medio Oriente» in most of Latin America — the site's audience is Latin-American-first (D1). A matter of preference. · правило `variant: neutral Spanish, Latin-American-first` · ai

## guide-activation

### A0009 · мелко · fluency · уверенность 0.6 · linguistic

`faq1.q` — guide «When to install and turn on your eSIM», question 1 — [на сайте](https://magicesim.store/es/guides/activation/#faq)

**EN**

> I installed the eSIM a week before the trip. Is the plan already running?

**Сейчас**

> Instalé la eSIM una semana antes del viaje. ¿El plan ya está contando?

**Предложение**

> Instalé la eSIM una semana antes del viaje. ¿Ya empezó a correr la validez del plan?

**Почему:** «el plan está contando» with no object is a calque of «is running»; a native says the validity «empezó a correr» / «ya corre». · правило `calque` · ai

### A0011 · мелко · style-variant · уверенность 0.6 · linguistic

`s5.h2` — guide «When to install and turn on your eSIM», section 5 heading (H2) — [на сайте](https://magicesim.store/es/guides/activation/#no-wifi)

**EN**

> Landed without the eSIM installed and no Wi-Fi?

**Сейчас**

> ¿Has aterrizado sin instalar la eSIM y sin Wi-Fi?

**Предложение**

> ¿Aterrizaste sin instalar la eSIM y sin Wi-Fi?

**Почему:** The present perfect for a just-completed event («Has aterrizado», «He aterrizado») is Spain usage; Latin-American-first Spanish uses the preterite. Also in guide-activation:faq3.q («He aterrizado» → «Aterricé»). · правило `es/README variant: LatAm-first` · ai

### A0010 · мелко · fluency · уверенность 0.55 · linguistic

`description` — guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/es/guides/activation/)

**EN**

> Installing an eSIM and starting its validity are different things. When to install, when to switch on the line and data roaming, and a checklist for the day you fly.

**Сейчас**

> Instalar una eSIM y empezar su validez no es lo mismo. Cuándo instalarla, cuándo activar la línea y la itinerancia de datos, y una lista para el día del vuelo.

**Предложение**

> Instalar una eSIM no es lo mismo que el inicio de su validez. Cuándo instalarla, cuándo activar la línea y la itinerancia de datos, y una lista para el día del vuelo.

**Почему:** «empezar su validez» uses «empezar» transitively with «validez» as object, as if the reader starts it; unnatural. Also in guide-activation:lead («Instalar la eSIM y empezar su validez no son lo mismo»). · правило `calque` · ai

## guide-troubleshooting

### A0012 · мелко · fluency · уверенность 0.6 · linguistic

`faq3.q` — guide «eSIM not working — what to check», question 3 — [на сайте](https://magicesim.store/es/guides/troubleshooting/#faq)

**EN**

> Will my main SIM get charged while I troubleshoot?

**Сейчас**

> ¿Me cobrará mi SIM principal mientras busco el problema?

**Предложение**

> ¿Me cobrarán por mi SIM principal mientras busco el problema?

**Почему:** A SIM does not charge anyone; as written the SIM is the subject of «cobrar». The operator charges for the SIM's use. · правило `semantic subject` · ai

## guide-android

### A0024 · мелко · accuracy · уверенность 0.55 · fidelity · объективное

`faq3.a` — guide «How to install an eSIM on Android», answer 3 — [на сайте](https://magicesim.store/es/guides/android/#faq)

**EN**

> Only if your plan's details list an APN: then check that it matches in the eSIM's settings.

**Сейчас**

> Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM (en Pixel, «Nombres de puntos de acceso»).

**Предложение**

> Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM.

**Почему:** Adds «(en Pixel, «Nombres de puntos de acceso»)», which the English answer does not contain. The label is in platform-labels.md, so it is not wrong, but it is added information; keep only if the English gets it too. · правило `no-added-information` · ai

### C0002 · мелко · consistency · уверенность 0.55 · check · объективное

`s1.body` — guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/es/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM card manager → **Add mobile plan**.
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Сейчас**

> Los ajustes de la SIM suelen estar en uno de estos lugares; los nombres cambian según la marca y la versión de Android:
> • **Google Pixel:** Configuración → Internet y redes → Tarjetas SIM (o SIMs) → **Agregar una SIM** → **Configurar una eSIM**.
> • **Samsung Galaxy:** Ajustes → Conexiones → Gestor de SIM → **Añadir eSIM**.
> • **Otras marcas:** busca en los ajustes «Red móvil», «Tarjetas SIM» o «Conexiones».
> Si no encuentras en ningún sitio la opción de añadir una eSIM, consulta si tu teléfono admite eSIM.

**Почему:** The source says «plan»; elsewhere it is «plan», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

### A0023 · мелко · accuracy · уверенность 0.55 · fidelity · объективное

`s3.body` — guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/es/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Сейчас**

> • Comprueba que la eSIM está activada. Pixel: Configuración → Internet y redes → Red móvil → la eSIM → **Usar esta SIM**.
> • Elige la eSIM como SIM para los **datos móviles**. Pixel: Configuración → Internet y redes → SIMs → **Datos móviles**. Tu SIM principal puede seguir activa para llamadas y mensajes de texto.
> • Activa el **roaming** para la eSIM. Pixel: Configuración → Internet y redes → SIM → **Roaming**. Samsung: búscalo en los ajustes de red móvil de Conexiones; el nombre exacto depende del modelo. Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como roaming.
> • Si no quieres cargos de tu operador habitual, desactiva el roaming de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.

**Почему:** The roaming step adds a Pixel path («Pixel: Configuración → Internet y redes → SIM → **Roaming**») that the English does not have, and replaces the English Samsung path (Settings → Connections → Mobile Networks → Data Roaming) with a description. The Samsung change follows platform-labels.md (no official Spanish Samsung label for data roaming → describe), and the Pixel label is listed (page 2926415), so the Spanish is likely the better text — but EN and ES now give different instructions. Owner: confirm the deviation or align the English. · правило `no-added-information` · ai

### A0025 · на вкус · platform-label · уверенность 0.5 · fidelity

`s1.body` — guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/es/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM card manager → **Add mobile plan**.
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Сейчас**

> Los ajustes de la SIM suelen estar en uno de estos lugares; los nombres cambian según la marca y la versión de Android:
> • **Google Pixel:** Configuración → Internet y redes → Tarjetas SIM (o SIMs) → **Agregar una SIM** → **Configurar una eSIM**.
> • **Samsung Galaxy:** Ajustes → Conexiones → Gestor de SIM → **Añadir eSIM**.
> • **Otras marcas:** busca en los ajustes «Red móvil», «Tarjetas SIM» o «Conexiones».
> Si no encuentras en ningún sitio la opción de añadir una eSIM, consulta si tu teléfono admite eSIM.

**Почему:** The English names Samsung's step **Add mobile plan** (and in guide-compatibility:s1.body also **Add mobile plan** / «SIM card manager»), while the Spanish quotes **Añadir eSIM** and «Gestor de SIM» from Samsung's Spanish page (platform-labels.md). The Spanish follows the vendor; the mismatch is on the English side. Also in guide-compatibility:s1.body. Flagged so the owner checks the English label against Samsung's current English UI — no change to the Spanish proposed. · правило `labels-evidence-bound` · ai

