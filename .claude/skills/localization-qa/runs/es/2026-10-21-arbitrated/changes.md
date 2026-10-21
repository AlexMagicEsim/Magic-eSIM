# Испанская локализация — журнал изменений (2026-10-21)

Изменено строк: **16** (раунд 1 — объективные ошибки: 11; раунд 2 — решения арбитра: 5).

## ui:plan.coverageIncl

plan cards (country page) — [на сайте](https://magicesim.store/es/esim/thailand/) — objective fixes (round 1)

**EN**

> {n} {countries}, incl. {name}

**Было**

> {n} {countries}, incluido {name}

**Стало**

> {n} {countries}, entre ellos {name}

**Причина:** «incluido» as a participle agrees with the noun that follows, so it is wrong for feminine country names («incluido Francia» should be «incluida Francia»); the template cannot know the gender. «entre ellos» agrees with «países» and works for every {name}.

**Независимые проверки.** Раунд 1: A0008 ai (grammar, minor, 0.65). Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

## page:countryTitle

country page (sample: Thailand) — [на сайте](https://magicesim.store/es/esim/thailand/) — objective fixes (round 1)

**EN**

> eSIM for Thailand — data plans in US dollars | Magic eSIM

**Было**

> eSIM para Tailandia: planes de datos en dólares | Magic eSIM

**Стало**

> eSIM para Tailandia: planes de datos en USD | Magic eSIM

**Причина:** «US dollars» became plain «dólares»; for a Latin-American audience several currencies are called «dólares» or use «$», so the currency is less exact than the English. «USD» (do-not-translate, the site's price format) restores it and keeps the title under 60 characters.

**Независимые проверки.** Раунд 1: A0010 ai (accuracy, minor, 0.6). Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

## guide-iphone:s2.body

guide «How to install an eSIM on iPhone», section 2 — [на сайте](https://magicesim.store/es/guides/iphone/#qr) — arbiter (round 2)

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

**Независимые проверки.** Раунд 1: C0001 check (terminology, minor, 0.8) — второе мнение: confirm; A0016 ai (style-variant, minor, 0.6). Раунд 2 (три этапа по исправленному тексту): A0005 linguistic (style-variant, major); A0021 fidelity (terminology, minor); C0001 check (terminology, minor); A0020 fidelity (consistency, minor); арбитр: apply — «ordenador» is a Spain-only word the README variant rule excludes (glossary: «computadora»); and the decided guide rule gives both regional labels, so «Add Cellular Plan» gets its listed es-MX label «Agregar plan de datos» (platform-labels.md, Apple 118669) like every other label in the step..

## guide-iphone:s4.body

guide «How to install an eSIM on iPhone», section 4 — [на сайте](https://magicesim.store/es/guides/iphone/#data) — arbiter (round 2)

**EN**

> • In **Settings → Cellular**, make sure the eSIM line is turned on.
> • Tap **Cellular Data** and choose the eSIM line. Your main SIM can stay on for calls and texts.
> • Open the eSIM line and turn on **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.
> Menu names can differ slightly between iOS versions.

**Было**

> • En **Ajustes → Datos móviles** (**Configuración → Datos celulares**), comprueba que la línea eSIM está activada.
> • Toca **Datos móviles** (**Datos celulares**) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas.
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

**Независимые проверки.** Раунд 1: A0015 ai (accuracy, minor, 0.65); A0014 ai (accuracy, minor, 0.6). Раунд 2 (три этапа по исправленному тексту): A0022 fidelity (accuracy, minor); арбитр: apply — Rule 1: the last line adds «y el idioma del teléfono», information the English does not carry; the corrected line matches the English («según la versión de iOS»)..

## guide-iphone:faq2.q

guide «How to install an eSIM on iPhone», question 2 — [на сайте](https://magicesim.store/es/guides/iphone/#faq) — arbiter (round 2)

**EN**

> The QR code is on this same iPhone. Can I still install it?

**Было**

> El código QR está en este mismo iPhone. ¿Puedo instalarla igualmente?

**Стало**

> El código QR está en este mismo iPhone. ¿Puedo instalar la eSIM igualmente?

**Причина:** A standalone FAQ question (shown alone in FAQPage) whose only noun is masculine «El código QR» leaves the feminine «instalarla» with no antecedent — a grammar/clarity error; naming «la eSIM» adds no fact (the English «it» is the eSIM).

**Независимые проверки.** Раунд 1: —. Раунд 2 (три этапа по исправленному тексту): A0008 linguistic (grammar, minor); арбитр: apply — A standalone FAQ question (shown alone in FAQPage) whose only noun is masculine «El código QR» leaves the feminine «instalarla» with no antecedent — a grammar/clarity error; naming «la eSIM» adds no fact (the English «it» is the eSIM)..

## guide-iphone:faq3.a

guide «How to install an eSIM on iPhone», answer 3 — [на сайте](https://magicesim.store/es/guides/iphone/#faq) — objective fixes (round 1)

**EN**

> It stays on. Calls and texts to your main number follow your home operator's roaming terms; the travel eSIM is used for mobile data.

**Было**

> Sigue activo. Las llamadas a tu número principal siguen las condiciones de itinerancia de tu operador habitual; la eSIM de viaje se usa para los datos móviles.

**Стало**

> Sigue activo. Las llamadas y los mensajes de texto a tu número principal siguen las condiciones de itinerancia de tu operador habitual; la eSIM de viaje se usa para los datos móviles.

**Причина:** 

**Независимые проверки.** Раунд 1: —. Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

## guide-iphone:faq4.a

guide «How to install an eSIM on iPhone», answer 4 — [на сайте](https://magicesim.store/es/guides/iphone/#faq) — objective fixes (round 1)

**EN**

> Travel eSIMs usually connect through partner networks, which the phone treats as roaming. Data roaming on the eSIM line is a normal setting; you can keep it off on your main SIM.

**Было**

> Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia. Activarla en la línea eSIM es un ajuste normal; en tu SIM principal puedes dejarla desactivada.

**Стало**

> Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia. La itinerancia de datos en la línea eSIM es un ajuste normal; en tu SIM principal puedes dejarla desactivada.

**Причина:** «Activarla» has no clear antecedent (the nearest feminine nouns are «las eSIM» / «itinerancia»), so it can read as «activate the eSIM»; the English names «Data roaming» explicitly. / The source says «data roaming»; elsewhere it is «itinerancia de datos», here neither it nor an accepted variant appears. Check whether the meaning is kept.

**Независимые проверки.** Раунд 1: A0018 ai (fluency, minor, 0.7); C0005 check (consistency, minor, 0.55) — второе мнение: confirm. Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

## guide-android:title

guide «How to install an eSIM on Android» — [на сайте](https://magicesim.store/es/guides/android/) — objective fixes (round 1)

**EN**

> How to install an eSIM on Android — Samsung, Pixel and others | Magic eSIM

**Было**

> Cómo instalar una eSIM en Android: Samsung, Pixel y otros | Magic eSIM

**Стало**

> Instalar eSIM en Android: Samsung, Pixel y más | Magic eSIM

**Причина:** Title is 70 characters (budget 60; English 74). Search results will likely cut it.

**Независимые проверки.** Раунд 1: C0002 check (seo, minor, 0.9) — второе мнение: confirm. Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

## guide-android:s3.body

guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/es/guides/android/#data) — objective fixes (round 1)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Было**

> • Comprueba que la eSIM está activada. Pixel: Configuración → Internet y redes → Red móvil → la eSIM → **Usar esta SIM**.
> • Elige la eSIM como SIM para los **datos móviles**. Pixel: Configuración → Internet y redes → SIMs → **Datos móviles**. Tu SIM principal puede seguir activa para llamadas.
> • Activa el **roaming** para la eSIM. Pixel: Configuración → Internet y redes → SIM → **Roaming**. Samsung: búscalo en los ajustes de red móvil de Conexiones; el nombre exacto depende del modelo. Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como roaming.
> • Si no quieres cargos de tu operador habitual, desactiva el roaming de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.

**Стало**

> • Comprueba que la eSIM está activada. Pixel: Configuración → Internet y redes → Red móvil → la eSIM → **Usar esta SIM**.
> • Elige la eSIM como SIM para los **datos móviles**. Pixel: Configuración → Internet y redes → SIMs → **Datos móviles**. Tu SIM principal puede seguir activa para llamadas y mensajes de texto.
> • Activa el **roaming** para la eSIM. Pixel: Configuración → Internet y redes → SIM → **Roaming**. Samsung: búscalo en los ajustes de red móvil de Conexiones; el nombre exacto depende del modelo. Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como roaming.
> • Si no quieres cargos de tu operador habitual, desactiva el roaming de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.

**Причина:** Fidelity: the English says the main SIM stays on «for calls and texts»; the Spanish drops «texts» (also in faq2.a: «para las llamadas» → «para las llamadas y los mensajes de texto»). If the omission was a deliberate SMS-claim decision, ignore.

**Независимые проверки.** Раунд 1: A0020 ai (accuracy, minor, 0.6). Раунд 2 (три этапа по исправленному тексту): A0023 fidelity (accuracy, minor); арбитр: keep — The Samsung roaming path is described rather than quoted because platform-labels.md lists no official Spanish Samsung label for data roaming (a binding rule), and the Pixel path substitutes listed labels (2926415) so the step still names a real setting; the English should be aligned by the owner, not the Spanish reduced..

## guide-android:faq2.a

guide «How to install an eSIM on Android», answer 2 — [на сайте](https://magicesim.store/es/guides/android/#faq) — objective fixes (round 1)

**EN**

> On phones that support dual SIM with eSIM, yes: choose the eSIM for mobile data and keep the physical SIM for calls and texts.

**Было**

> En los teléfonos que admiten SIM dual con eSIM, sí: elige la eSIM para los datos móviles y mantén la SIM física para las llamadas.

**Стало**

> En los teléfonos que admiten SIM dual con eSIM, sí: elige la eSIM para los datos móviles y mantén la SIM física para las llamadas y los mensajes de texto.

**Причина:** 

**Независимые проверки.** Раунд 1: —. Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

## guide-android:faq3.a

guide «How to install an eSIM on Android», answer 3 — [на сайте](https://magicesim.store/es/guides/android/#faq) — arbiter (round 2)

**EN**

> Only if your plan's details list an APN: then check that it matches in the eSIM's settings.

**Было**

> Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM (en Pixel, «Nombres de puntos de acceso»).

**Стало**

> Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM.

**Причина:** Rule 1: the parenthesis adds a Pixel menu name the English answer does not give and no label rule requires it; dropping it restores the English content.

**Независимые проверки.** Раунд 1: A0023 ai (accuracy, preferential, 0.55). Раунд 2 (три этапа по исправленному тексту): A0024 fidelity (accuracy, minor); арбитр: apply — Rule 1: the parenthesis adds a Pixel menu name the English answer does not give and no label rule requires it; dropping it restores the English content..

## guide-activation:description

guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/es/guides/activation/) — objective fixes (round 1)

**EN**

> Installing an eSIM and starting its validity are different things. When to install, when to switch on the line and data roaming, and a checklist for the day you fly.

**Было**

> Instalar una eSIM y empezar su validez son cosas distintas. Cuándo instalarla, cuándo activar la línea y la itinerancia de datos, y una lista para el día del vuelo.

**Стало**

> Instalar una eSIM y empezar su validez no es lo mismo. Cuándo instalarla, cuándo activar la línea y la itinerancia de datos, y una lista para el día del vuelo.

**Причина:** Description is 164 characters (budget 160; English 165).

**Независимые проверки.** Раунд 1: C0003 check (seo, minor, 0.8) — второе мнение: confirm. Раунд 2 (три этапа по исправленному тексту): A0010 linguistic (fluency, minor); арбитр: optional — «empezar su validez» is grammatical (transitive «empezar»), clear, and mirrors the English «starting its validity»; the suggested rewording is stylistic..

## guide-activation:faq1.q

guide «When to install and turn on your eSIM», question 1 — [на сайте](https://magicesim.store/es/guides/activation/#faq) — arbiter (round 2)

**EN**

> I installed the eSIM a week before the trip. Is the plan already running?

**Было**

> Instalé la eSIM una semana antes del viaje. ¿El plan ya está contando?

**Стало**

> Instalé la eSIM una semana antes del viaje. ¿Ya empezó a correr la validez del plan?

**Причина:** «¿El plan ya está contando?» is an intransitive calque of «is running» with no clear object, ambiguous on exactly the point the guide exists to explain (when validity starts); «empezó a correr la validez» states the English meaning without adding a fact.

**Независимые проверки.** Раунд 1: —. Раунд 2 (три этапа по исправленному тексту): A0009 linguistic (fluency, minor); арбитр: apply — «¿El plan ya está contando?» is an intransitive calque of «is running» with no clear object, ambiguous on exactly the point the guide exists to explain (when validity starts); «empezó a correr la validez» states the English meaning without adding a fact..

## guide-troubleshooting:title

guide «eSIM not working — what to check» — [на сайте](https://magicesim.store/es/guides/troubleshooting/) — objective fixes (round 1)

**EN**

> eSIM not working abroad — what to check | Magic eSIM

**Было**

> La eSIM no funciona en el extranjero: qué revisar | Magic eSIM

**Стало**

> eSIM no funciona en el extranjero: qué revisar | Magic eSIM

**Причина:** Title is 62 characters (budget 60; English 52). Search results will likely cut it.

**Независимые проверки.** Раунд 1: C0004 check (seo, minor, 0.9) — второе мнение: confirm. Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

## guide-troubleshooting:description

guide «eSIM not working — what to check» — [на сайте](https://magicesim.store/es/guides/troubleshooting/) — objective fixes (round 1)

**EN**

> A step-by-step checklist when a travel eSIM shows no network or no internet: data line, roaming, airplane mode, network selection and when not to delete the eSIM.

**Было**

> Una lista paso a paso cuando una eSIM de viaje no tiene red ni internet: línea de datos, itinerancia, modo avión, selección de red y por qué no borrar la eSIM.

**Стало**

> Lista paso a paso para cuando una eSIM de viaje no tiene red ni internet: línea de datos, itinerancia, modo avión, selección de red y cuándo no borrar la eSIM.

**Причина:** The English says «when not to delete the eSIM»; «por qué no borrar» changes it to «why». Also «Una lista paso a paso cuando…» lacks «para»: a list «para cuando» something happens. The suggestion fixes both and stays at 159 characters.

**Независимые проверки.** Раунд 1: A0029 ai (accuracy, minor, 0.75). Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

## countries:CI

country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/ivory-coast/) — objective fixes (round 1)

**EN**

> Côte d’Ivoire

**Было**

> Côte d’Ivoire

**Стало**

> Costa de Marfil

**Причина:** The French endonym is left untranslated; Spanish speakers in every region call and search the country «Costa de Marfil» (RAE/Fundéu standard form). Since the name is used in the page title and H1, the French form also misses the search intent.

**Независимые проверки.** Раунд 1: A0035 ai (country-name, major, 0.8) — второе мнение: confirm. Раунд 2 (три этапа по исправленному тексту): замечаний нет; арбитр: замечаний не было.

