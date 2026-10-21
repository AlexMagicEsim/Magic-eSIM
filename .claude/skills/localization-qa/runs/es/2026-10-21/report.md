# Ревью локализации: es — 2026-10-21

Строк проверено: **515** · строк с замечаниями: **39** · замечаний: **42** · код: `e837aa36`

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 1 |
| мелко (minor) | 32 |
| на вкус (preferential) | 9 |

| Категория | Замечаний |
|---|---|
| fluency | 14 |
| accuracy | 8 |
| style-variant | 8 |
| country-name | 3 |
| seo | 3 |
| terminology | 2 |
| spelling | 1 |
| grammar | 1 |
| punctuation | 1 |
| consistency | 1 |

Источник: механические проверки 5, ИИ-ревью 37; второе мнение подтвердило или понизило 6, отклонило 1. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 0.

## countries

### A0035 · важно · country-name · уверенность 0.8

`CI` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/ivory-coast/)

**EN**

> Côte d’Ivoire

**Сейчас**

> Côte d’Ivoire

**Предложение**

> Costa de Marfil

**Почему:** The French endonym is left untranslated; Spanish speakers in every region call and search the country «Costa de Marfil» (RAE/Fundéu standard form). Since the name is used in the page title and H1, the French form also misses the search intent. _(второе мнение: confirm — Spanish speakers everywhere name and search the country «Costa de Marfil» (Fundéu/RAE form); the French endonym in title and H1 is both unnatural and misses the search intent, and the suggestion adds no meaning.)_ · правило `country-name-spanish-exonym` · ai

### A0034 · мелко · country-name · уверенность 0.75

`SA` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/saudi-arabia/)

**EN**

> Saudi Arabia

**Сейчас**

> Arabia Saudí

**Предложение**

> Arabia Saudita

**Почему:** Both forms are accepted by the RAE, but «Arabia Saudí» is the Spain form; Latin America (and CLDR es-419) uses «Arabia Saudita», which the Latin-American-first variant (README) should prefer. The name feeds the page title and H1, so it is also the more searched form for this audience. · правило `country-name-latam-first` · ai

### A0036 · мелко · spelling · уверенность 0.65

`ML` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/mali/)

**EN**

> Mali

**Сейчас**

> Mali

**Предложение**

> Malí

**Почему:** The Ortografía de la RAE (2010, list of country names) and the Diccionario panhispánico de dudas give «Malí» with an accent as the recommended Spanish form; «Mali» without an accent is the English/French spelling. · правило `country-name-rae-accent` · ai

### A0037 · на вкус · country-name · уверенность 0.55

`TL` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/es/esim/timor-leste/)

**EN**

> Timor-Leste

**Сейчас**

> Timor-Leste

**Предложение**

> Timor Oriental

**Почему:** «Timor-Leste» is the official Portuguese-based form kept by CLDR; most Spanish readers know and search the country as «Timor Oriental» (also accepted by the RAE). Acceptable as is; worth a native's look for the title/H1. · правило `country-name-common-form` · ai

## guide-android

### C0002 · мелко · seo · уверенность 0.9

`title` — guide «How to install an eSIM on Android» — [на сайте](https://magicesim.store/es/guides/android/)

**EN**

> How to install an eSIM on Android — Samsung, Pixel and others | Magic eSIM

**Сейчас**

> Cómo instalar una eSIM en Android: Samsung, Pixel y otros | Magic eSIM

**Предложение**

> Instalar eSIM en Android: Samsung, Pixel y más | Magic eSIM

**Почему:** Title is 70 characters (budget 60; English 74). Search results will likely cut it. _(второе мнение: confirm — At 70 characters the title is well over the 60-character budget; dropping «Cómo» and the article and using «y más» for «and others» keeps every fact and the Android/Samsung/Pixel keywords within 59.)_ · правило `seo-title-length` · check

### A0022 · мелко · fluency · уверенность 0.65

`s4.body` — guide «How to install an eSIM on Android», section 4 — [на сайте](https://magicesim.store/es/guides/android/#help)

**EN**

> Check the data SIM and roaming on the eSIM, toggle airplane mode, then restart. The full checklist is in eSIM not working.
> **Do not delete the eSIM** while troubleshooting: its QR code may be single-use.

**Сейчас**

> Comprueba la SIM elegida para los datos y el roaming de la eSIM, activa y desactiva el modo avión y reinicia. La lista completa está en La eSIM no funciona.
> **No borres la eSIM** mientras buscas el problema: su código QR puede ser de un solo uso.

**Предложение**

> Comprueba la SIM elegida para los datos y el roaming de la eSIM, activa y desactiva el modo avión y reinicia. La lista completa está en La eSIM no funciona.
> **No borres la eSIM** mientras intentas resolver el problema: su código QR puede ser de un solo uso.

**Почему:** «troubleshooting» is solving the problem, not looking for it; «mientras buscas el problema» is a slightly unnatural rendering. · правило `troubleshooting-calque` · ai

### A0020 · мелко · accuracy · уверенность 0.6

`s3.body` — guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/es/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Сейчас**

> • Comprueba que la eSIM está activada. Pixel: Configuración → Internet y redes → Red móvil → la eSIM → **Usar esta SIM**.
> • Elige la eSIM como SIM para los **datos móviles**. Pixel: Configuración → Internet y redes → SIMs → **Datos móviles**. Tu SIM principal puede seguir activa para llamadas.
> • Activa el **roaming** para la eSIM. Pixel: Configuración → Internet y redes → SIM → **Roaming**. Samsung: búscalo en los ajustes de red móvil de Conexiones; el nombre exacto depende del modelo. Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como roaming.
> • Si no quieres cargos de tu operador habitual, desactiva el roaming de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.

**Предложение**

> • Comprueba que la eSIM está activada. Pixel: Configuración → Internet y redes → Red móvil → la eSIM → **Usar esta SIM**.
> • Elige la eSIM como SIM para los **datos móviles**. Pixel: Configuración → Internet y redes → SIMs → **Datos móviles**. Tu SIM principal puede seguir activa para llamadas y mensajes de texto.
> • Activa el **roaming** para la eSIM. Pixel: Configuración → Internet y redes → SIM → **Roaming**. Samsung: búscalo en los ajustes de red móvil de Conexiones; el nombre exacto depende del modelo. Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como roaming.
> • Si no quieres cargos de tu operador habitual, desactiva el roaming de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.

**Почему:** Fidelity: the English says the main SIM stays on «for calls and texts»; the Spanish drops «texts» (also in faq2.a: «para las llamadas» → «para las llamadas y los mensajes de texto»). If the omission was a deliberate SMS-claim decision, ignore. · правило `dropped-texts` · ai

### A0021 · на вкус · style-variant · уверенность 0.6

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

**Предложение**

> Los ajustes de la SIM suelen estar en uno de estos lugares; los nombres cambian según la marca y la versión de Android:
> • **Google Pixel:** Configuración → Internet y redes → Tarjetas SIM (o SIMs) → **Agregar una SIM** → **Configurar una eSIM**.
> • **Samsung Galaxy:** Ajustes → Conexiones → Gestor de SIM → **Añadir eSIM**.
> • **Otras marcas:** busca en los ajustes «Red móvil», «Tarjetas SIM» o «Conexiones».
> Si no encuentras en ningún lugar la opción de añadir una eSIM, consulta si tu teléfono admite eSIM.

**Почему:** «en ningún sitio» reads as Spain usage; «en ningún lugar» is neutral for a Latin-American-first audience (also in faq1.a: «Si en ningún sitio existe» → «Si en ningún lugar existe»). · правило `sitio-spain` · ai

### A0023 · на вкус · accuracy · уверенность 0.55

`faq3.a` — guide «How to install an eSIM on Android», answer 3 — [на сайте](https://magicesim.store/es/guides/android/#faq)

**EN**

> Only if your plan's details list an APN: then check that it matches in the eSIM's settings.

**Сейчас**

> Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM (en Pixel, «Nombres de puntos de acceso»).

**Предложение**

> Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM.

**Почему:** Fidelity: the parenthesis «(en Pixel, «Nombres de puntos de acceso»)» is not in the English. The label itself is sourced (platform-labels, Pixel 2926415), so keeping it is a content decision; flagged only because the rule is nothing added. · правило `added-label-path` · ai

## guide-troubleshooting

### C0004 · мелко · seo · уверенность 0.9

`title` — guide «eSIM not working — what to check» — [на сайте](https://magicesim.store/es/guides/troubleshooting/)

**EN**

> eSIM not working abroad — what to check | Magic eSIM

**Сейчас**

> La eSIM no funciona en el extranjero: qué revisar | Magic eSIM

**Предложение**

> eSIM no funciona en el extranjero: qué revisar | Magic eSIM

**Почему:** Title is 62 characters (budget 60; English 52). Search results will likely cut it. _(второе мнение: confirm — Removing the leading article (the English title has none) brings the title from 62 to 59 characters with no loss of meaning or keyword.)_ · правило `seo-title-length` · check

### A0029 · мелко · accuracy · уверенность 0.75

`description` — guide «eSIM not working — what to check» — [на сайте](https://magicesim.store/es/guides/troubleshooting/)

**EN**

> A step-by-step checklist when a travel eSIM shows no network or no internet: data line, roaming, airplane mode, network selection and when not to delete the eSIM.

**Сейчас**

> Una lista paso a paso cuando una eSIM de viaje no tiene red ni internet: línea de datos, itinerancia, modo avión, selección de red y por qué no borrar la eSIM.

**Предложение**

> Lista paso a paso para cuando una eSIM de viaje no tiene red ni internet: línea de datos, itinerancia, modo avión, selección de red y cuándo no borrar la eSIM.

**Почему:** The English says «when not to delete the eSIM»; «por qué no borrar» changes it to «why». Also «Una lista paso a paso cuando…» lacks «para»: a list «para cuando» something happens. The suggestion fixes both and stays at 159 characters. · правило `description-when-vs-why` · ai

### A0030 · мелко · fluency · уверенность 0.65

`faq3.q` — guide «eSIM not working — what to check», question 3 — [на сайте](https://magicesim.store/es/guides/troubleshooting/#faq)

**EN**

> Will my main SIM get charged while I troubleshoot?

**Сейчас**

> ¿Me cobrará mi SIM principal mientras busco el problema?

**Предложение**

> ¿Me cobrarán en mi SIM principal mientras intento solucionarlo?

**Почему:** A SIM does not charge anyone — the operator does; «¿Me cobrará mi SIM principal…?» reads oddly. «buscar el problema» is a loose rendering of «troubleshoot»; «intentar solucionarlo» is the natural phrase (the same «mientras buscas el problema» is in the lead, where «mientras intentas solucionarlo» reads better too). · правило `troubleshoot-calque` · ai

### A0031 · мелко · style-variant · уверенность 0.6

`faq1.a` — guide «eSIM not working — what to check», answer 1 — [на сайте](https://magicesim.store/es/guides/troubleshooting/#faq)

**EN**

> Make sure data roaming is on for the eSIM, toggle airplane mode, and give it a couple of minutes. Then try choosing a network by hand.

**Сейчас**

> Comprueba que la itinerancia de datos está activada en la eSIM, activa y desactiva el modo avión y espera un par de minutos. Después, prueba a elegir una red a mano.

**Предложение**

> Comprueba que la itinerancia de datos está activada en la eSIM, activa y desactiva el modo avión y espera un par de minutos. Después, intenta elegir una red a mano.

**Почему:** «probar a + infinitivo» is mainly peninsular; for a Latin-American-first neutral audience «intenta elegir» is understood everywhere. · правило `probar-a-peninsular` · ai

### A0033 · на вкус · fluency · уверенность 0.55

`s1.body` — guide «eSIM not working — what to check», section 1 — [на сайте](https://magicesim.store/es/guides/troubleshooting/#checklist)

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

> • **¿Está activada la línea eSIM?** Revisa los ajustes de la SIM.
> • **¿Está elegida la eSIM para los datos móviles?** Internet tiene que pasar por la eSIM, no por tu SIM principal.
> • **¿Está activada la itinerancia de datos en la eSIM?** Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.
> • **Activa el modo avión** durante diez segundos y desactívalo.
> • **Reinicia el teléfono.**
> • **Elige una red a mano.** En los ajustes de red de la eSIM, desactiva la selección automática y elige otra red de la lista.
> • **Revisa el APN**, solo si los datos de tu plan indican uno: debe coincidir en los ajustes de la eSIM.
> • **¿Estás dentro de la cobertura del plan?** Comprueba que el país en el que estás figura entre los países que cubre el plan.

**Предложение**

> • **¿Está activada la línea eSIM?** Revisa los ajustes de la SIM.
> • **¿Está elegida la eSIM para los datos móviles?** Internet tiene que pasar por la eSIM, no por tu SIM principal.
> • **¿Está activada la itinerancia de datos en la eSIM?** Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.
> • **Activa el modo avión** durante diez segundos y luego desactívalo.
> • **Reinicia el teléfono.**
> • **Elige una red a mano.** En los ajustes de red de la eSIM, desactiva la selección automática y elige otra red de la lista.
> • **Revisa el APN**, solo si los datos de tu plan indican uno: debe coincidir en los ajustes de la eSIM.
> • **¿Estás dentro de la cobertura del plan?** Comprueba que el país en el que estás figura entre los países que cubre el plan.

**Почему:** English «on for ten seconds, then off»: «y luego desactívalo» keeps the sequence explicit and reads more naturally. · правило `then-off` · ai

### A0032 · на вкус · fluency · уверенность 0.55

`s1.h2` — guide «eSIM not working — what to check», section 1 heading (H2) — [на сайте](https://magicesim.store/es/guides/troubleshooting/#checklist)

**EN**

> The checklist

**Сейчас**

> La lista

**Предложение**

> Lista de comprobación

**Почему:** «The checklist» as a bare «La lista» is vague as an H2; «Lista de comprobación» names what it is. The current text is understandable. · правило `checklist-heading` · ai

## guide-activation

### C0003 · мелко · seo · уверенность 0.8

`description` — guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/es/guides/activation/)

**EN**

> Installing an eSIM and starting its validity are different things. When to install, when to switch on the line and data roaming, and a checklist for the day you fly.

**Сейчас**

> Instalar una eSIM y empezar su validez son cosas distintas. Cuándo instalarla, cuándo activar la línea y la itinerancia de datos, y una lista para el día del vuelo.

**Предложение**

> Instalar una eSIM y empezar su validez no es lo mismo. Cuándo instalarla, cuándo activar la línea y la itinerancia de datos, y una lista para el día del vuelo.

**Почему:** Description is 164 characters (budget 160; English 165). _(второе мнение: confirm — «no es lo mismo» renders «are different things» faithfully and brings the description from 164 to 159 characters; nothing else changes.)_ · правило `seo-description-length` · check

### A0025 · мелко · style-variant · уверенность 0.65

`s5.h2` — guide «When to install and turn on your eSIM», section 5 heading (H2) — [на сайте](https://magicesim.store/es/guides/activation/#no-wifi)

**EN**

> Landed without the eSIM installed and no Wi-Fi?

**Сейчас**

> ¿Has aterrizado sin instalar la eSIM y sin Wi-Fi?

**Предложение**

> ¿Aterrizaste sin instalar la eSIM y sin Wi-Fi?

**Почему:** For a just-completed action Latin-American Spanish uses the simple preterite; the present perfect «has aterrizado» reads as Spain usage, against the Latin-American-first variant (D1). Also in faq3.q: «He aterrizado y no hay internet» → «Aterricé y no hay internet». · правило `preterite-for-latam` · ai

### A0026 · мелко · fluency · уверенность 0.6

`faq2.a` — guide «When to install and turn on your eSIM», answer 2 — [на сайте](https://magicesim.store/es/guides/activation/#faq)

**EN**

> The switch itself charges nothing; it only allows the line to use partner networks. What matters is which line is chosen for mobile data, and your plan's terms.

**Сейчас**

> El interruptor en sí no cobra nada; solo permite que la línea use redes asociadas. Lo que importa es qué línea está elegida para los datos móviles y las condiciones de tu plan.

**Предложение**

> Activar el interruptor en sí no tiene ningún costo; solo permite que la línea use redes asociadas. Lo que importa es qué línea está elegida para los datos móviles y las condiciones de tu plan.

**Почему:** «El interruptor no cobra nada» is a literal calque — a switch does not «charge» in Spanish; «activarlo no tiene ningún costo» says the same fact naturally. · правило `calque-switch-charges` · ai

### A0027 · мелко · punctuation · уверенность 0.55

`s4.body` — guide «When to install and turn on your eSIM», section 4 — [на сайте](https://magicesim.store/es/guides/activation/#landed)

**EN**

> • Turn the eSIM line on, if it is off.
> • Choose the eSIM for mobile data.
> • Turn on data roaming for the eSIM.
> • Wait one to three minutes. No network? Turn airplane mode on and off.
> • Still nothing? Go through eSIM not working.

**Сейчас**

> • Activa la línea eSIM, si está desactivada.
> • Elige la eSIM para los datos móviles.
> • Activa la itinerancia de datos en la eSIM.
> • Espera de uno a tres minutos. ¿No hay red? Activa y desactiva el modo avión.
> • ¿Sigue sin funcionar? Revisa La eSIM no funciona.

**Предложение**

> • Activa la línea eSIM, si está desactivada.
> • Elige la eSIM para los datos móviles.
> • Activa la itinerancia de datos en la eSIM.
> • Espera de uno a tres minutos. ¿No hay red? Activa y desactiva el modo avión.
> • ¿Sigue sin funcionar? Revisa la guía «La eSIM no funciona».

**Почему:** The guide title sits mid-sentence with a capital «La» and no marking, so «Revisa La eSIM no funciona» reads as a broken sentence; naming it as a guide in the site's «comillas latinas» fixes it (if the link styling already sets it apart, this is cosmetic). · правило `inline-guide-title` · ai

### A0028 · на вкус · fluency · уверенность 0.55

`s5.body` — guide «When to install and turn on your eSIM», section 5 — [на сайте](https://magicesim.store/es/guides/activation/#no-wifi)

**EN**

> You need internet to download the profile. Options: the airport's free Wi-Fi, or internet shared from a travel companion's phone. Entering the details by hand still needs internet to download the profile.

**Сейчас**

> Necesitas internet para descargar el perfil. Opciones: el Wi-Fi gratuito del aeropuerto o la conexión compartida desde el teléfono de un acompañante. Introducir los datos a mano también necesita internet para descargar el perfil.

**Предложение**

> Necesitas internet para descargar el perfil. Opciones: el Wi-Fi gratuito del aeropuerto o la conexión compartida desde el teléfono de un acompañante. Aunque ingreses los datos a mano, igual necesitas internet para descargar el perfil.

**Почему:** «Introducir» is the Spain-leaning verb (Apple es-MX says «Ingresar detalles manualmente»), and «introducir… también necesita» makes the action the subject of «necesitar»; «aunque ingreses…, igual necesitas» is more natural and keeps the «still» of the English. · правило `ingresar-latam` · ai

## guide-iphone

### C0001 · мелко · terminology · уверенность 0.8

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

**Почему:** «ordenador»: the glossary uses «computadora» for «computer» — «ordenador» is Spain's word; Latin America says «computadora» (Latin-American-first audience). _(второе мнение: confirm — «ordenador» is the Spain-only word the glossary excludes for this Latin-American-first audience; «una computadora» is the decided term and the only change.)_ · правило `glossary:computer` · check

### A0018 · мелко · fluency · уверенность 0.7

`faq4.a` — guide «How to install an eSIM on iPhone», answer 4 — [на сайте](https://magicesim.store/es/guides/iphone/#faq)

**EN**

> Travel eSIMs usually connect through partner networks, which the phone treats as roaming. Data roaming on the eSIM line is a normal setting; you can keep it off on your main SIM.

**Сейчас**

> Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia. Activarla en la línea eSIM es un ajuste normal; en tu SIM principal puedes dejarla desactivada.

**Предложение**

> Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia. Activar la itinerancia de datos en la línea eSIM es un ajuste normal; en tu SIM principal puedes dejarla desactivada.

**Почему:** «Activarla» has no clear antecedent (the nearest feminine nouns are «las eSIM» / «itinerancia»), so it can read as «activate the eSIM»; the English names «Data roaming» explicitly. · правило `ambiguous-pronoun` · ai

### A0015 · мелко · accuracy · уверенность 0.65

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
> • Toca **Datos móviles** (**Datos celulares**) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas.
> • Abre la línea eSIM y activa la itinerancia de datos (en algunas regiones se llama roaming de datos). Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.
> • Si no quieres cargos de tu operador habitual, desactiva la itinerancia de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.
> Los nombres de los menús pueden variar un poco según la versión de iOS y el idioma del teléfono.

**Предложение**

> • En **Ajustes → Datos móviles** (**Configuración → Datos celulares**), comprueba que la línea eSIM está activada.
> • Toca **Datos móviles** (**Datos celulares**) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas.
> • Abre la línea eSIM y activa la itinerancia de datos (en algunas regiones se llama roaming de datos). Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.
> • Si no quieres cargos de tu operador habitual, desactiva la itinerancia de datos en tu SIM principal.
> • Espera uno o dos minutos a que el teléfono se registre en una red local.
> Los nombres de los menús pueden variar un poco según la versión de iOS.

**Почему:** «y el idioma del teléfono» is not in the English («Menu names can differ slightly between iOS versions»); rule 1: nothing added. · правило `added-content` · ai

### A0016 · мелко · style-variant · уверенность 0.6

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
> • Toca **Continuar** y después **Añadir plan móvil**. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.
> • Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.
> Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén presionado el código y toca **Añadir eSIM** (**Agregar eSIM**).

**Почему:** «mantén pulsado» is Spain usage; Apple es-MX says «mantén presionado», which is understood everywhere and fits the Latin-American-first variant. Also in faq2.a. · правило `regional-touch-and-hold` · ai

### A0014 · мелко · accuracy · уверенность 0.6

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
> • Toca **Datos móviles** (**Datos celulares**) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas.
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
> Los nombres de los menús pueden variar un poco según la versión de iOS y el idioma del teléfono.

**Почему:** The English says the main SIM stays on «for calls and texts»; the translation drops «texts». Also in faq3.a («Las llamadas a tu número principal» drops «and texts»). If the omission is a deliberate SMS-claim guard, close this as decided. · правило `dropped-fact-texts` · ai

### A0017 · мелко · fluency · уверенность 0.6

`s5.body` — guide «How to install an eSIM on iPhone», section 5 — [на сайте](https://magicesim.store/es/guides/iphone/#help)

**EN**

> Check that the eSIM is the line chosen for cellular data and that data roaming is on for it, then restart the phone. The full checklist is in eSIM not working.
> **Do not delete the eSIM** while troubleshooting: its QR code may be single-use, and you may not be able to install it again.

**Сейчас**

> Comprueba que la eSIM es la línea elegida para los datos y que tiene la itinerancia de datos activada, y reinicia el teléfono. La lista completa está en La eSIM no funciona.
> **No borres la eSIM** mientras buscas el problema: su código QR puede ser de un solo uso y es posible que no puedas volver a instalarla.

**Предложение**

> Comprueba que la eSIM es la línea elegida para los datos y que tiene la itinerancia de datos activada, y reinicia el teléfono. La lista completa está en La eSIM no funciona.
> **No borres la eSIM** mientras intentas resolver el problema: su código QR puede ser de un solo uso y es posible que no puedas volver a instalarla.

**Почему:** «buscas el problema» is an unnatural rendering of «while troubleshooting» (you look for a solution, not the problem); «intentas resolver el problema» is the natural phrasing. · правило `calque-troubleshooting` · ai

### A0019 · мелко · fluency · уверенность 0.55

`description` — guide «How to install an eSIM on iPhone» — [на сайте](https://magicesim.store/es/guides/iphone/)

**EN**

> Install a travel eSIM on iPhone with a QR code or by entering the details manually, then switch on data for the trip.

**Сейчас**

> Instala una eSIM de viaje en iPhone con un código QR o introduciendo los datos a mano, y activa los datos para el viaje.

**Предложение**

> Instala una eSIM de viaje en iPhone con un código QR o introduciendo a mano los detalles de instalación, y activa los datos móviles para el viaje.

**Почему:** «datos» is used twice in one sentence with two meanings (installation details vs mobile data), which blurs the snippet; Apple es-MX itself says «detalles» for the manual-entry details. 146 characters, within budget. · правило `ambiguous-datos` · ai

### C0005 · мелко · consistency · уверенность 0.55

`faq4.a` — guide «How to install an eSIM on iPhone», answer 4 — [на сайте](https://magicesim.store/es/guides/iphone/#faq)

**EN**

> Travel eSIMs usually connect through partner networks, which the phone treats as roaming. Data roaming on the eSIM line is a normal setting; you can keep it off on your main SIM.

**Сейчас**

> Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia. Activarla en la línea eSIM es un ajuste normal; en tu SIM principal puedes dejarla desactivada.

**Предложение**

> Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia. La itinerancia de datos en la línea eSIM es un ajuste normal; en tu SIM principal puedes dejarla desactivada.

**Почему:** The source says «data roaming»; elsewhere it is «itinerancia de datos», here neither it nor an accepted variant appears. Check whether the meaning is kept. _(второе мнение: confirm — The target replaces «Data roaming … is a normal setting» with «Activarla … es un ajuste normal» (an action called a setting, pronoun pointing to a generic «itinerancia»); naming «la itinerancia de datos» keeps the English meaning and the glossary term.)_ · правило `consistency:data roaming` · check

## guide-compatibility

### A0024 · мелко · accuracy · уверенность 0.7

`lead` — guide «Does your phone support eSIM?» — [на сайте](https://magicesim.store/es/guides/compatibility/)

**EN**

> The quickest check: open your phone's SIM settings and look for an option to add an eSIM. If it is there, the phone supports eSIM. Two more things to check at the same time: whether the phone is locked to one carrier, and which regional version you have.

**Сейчас**

> La comprobación más sencilla: abre los ajustes de la SIM y busca la opción de añadir una eSIM. Si está, el teléfono admite eSIM. Aprovecha para comprobar dos cosas más: si el teléfono está bloqueado por un operador y qué versión regional tienes.

**Предложение**

> La comprobación más rápida: abre los ajustes de la SIM de tu teléfono y busca la opción de añadir una eSIM. Si está, el teléfono admite eSIM. Aprovecha para comprobar dos cosas más: si el teléfono está bloqueado por un operador y qué versión regional tienes.

**Почему:** Fidelity: «quickest» is about speed (it matches the blurb's «de un minuto»), not ease; «más sencilla» shifts the meaning slightly. «de tu teléfono» restores «your phone's» and ties the sentence to the reader's own device. · правило `quickest-not-simplest` · ai

## ui

### A0007 · мелко · fluency · уверенность 0.7

`home.guidesTitle` — home — [на сайте](https://magicesim.store/es/)

**EN**

> Set up and fix your eSIM

**Сейчас**

> Configura y soluciona tu eSIM

**Предложение**

> Configura tu eSIM y soluciona problemas

**Почему:** «solucionar» takes a problem as its object, not a device: «soluciona tu eSIM» reads as a calque of «fix your eSIM». Also in ui:home.guidesLead («soluciona una eSIM de viaje» → «Instala y comprueba una eSIM de viaje, y soluciona problemas, paso a paso.»). · правило `solucionar-object` · ai

### A0001 · мелко · terminology · уверенность 0.7

`site.compatBody` — several pages — [на сайте](https://magicesim.store/es/)

**EN**

> Your phone needs eSIM support and must not be carrier-locked. Most phones released after 2019 qualify.

**Сейчас**

> Tu teléfono debe admitir eSIM y estar liberado (sin bloqueo de compañía). La mayoría de los teléfonos lanzados después de 2019 cumplen estos requisitos.

**Предложение**

> Tu teléfono debe admitir eSIM y estar liberado (sin bloqueo del operador). La mayoría de los teléfonos lanzados después de 2019 cumplen estos requisitos.

**Почему:** «compañía» for the carrier reads as regional (Spain, colloquial); Apple's own Spanish label is «Bloqueo del Operador» / «Bloq. de operador» (platform-labels.md), so «operador» is the neutral term and matches the guides. · правило `carrier-term-operador` · ai

### A0003 · мелко · style-variant · уверенность 0.65

`checkout.emailNote` — checkout window (country page → plan) — [на сайте](https://magicesim.store/es/esim/thailand/)

**EN**

> Not sent or saved anywhere yet — payment isn't available.

**Сейчас**

> Todavía no se envía ni se guarda en ningún sitio: el pago no está disponible.

**Предложение**

> Todavía no se envía ni se guarda en ninguna parte: el pago no está disponible.

**Почему:** «en ningún sitio» reads as Spain usage; «en ninguna parte» is neutral and natural across Latin America (variant rule: Latin-American-first neutral Spanish). · правило `neutral-variant-ningun-sitio` · ai

### A0008 · мелко · grammar · уверенность 0.65

`plan.coverageIncl` — plan cards (country page) — [на сайте](https://magicesim.store/es/esim/thailand/)

**EN**

> {n} {countries}, incl. {name}

**Сейчас**

> {n} {countries}, incluido {name}

**Предложение**

> {n} {countries}, entre ellos {name}

**Почему:** «incluido» as a participle agrees with the noun that follows, so it is wrong for feminine country names («incluido Francia» should be «incluida Francia»); the template cannot know the gender. «entre ellos» agrees with «países» and works for every {name}. · правило `participle-agreement-placeholder` · ai

### A0005 · мелко · fluency · уверенность 0.65

`preview.more` — payment notice under the header — [на сайте](https://magicesim.store/es/esim/thailand/)

**EN**

> What this means

**Сейчас**

> Qué significa

**Предложение**

> Qué significa esto

**Почему:** The English «this» refers to the payment notice; without «esto» the Spanish link label reads as truncated. · правило `truncated-label` · ai

### A0004 · мелко · style-variant · уверенность 0.6

`quote.expired` — checkout window (country page → plan) — [на сайте](https://magicesim.store/es/esim/thailand/)

**EN**

> This price has expired. Get a new price to continue.

**Сейчас**

> Este precio ha caducado. Obtén un nuevo precio para continuar.

**Предложение**

> Este precio expiró. Obtén un nuevo precio para continuar.

**Почему:** «caducar» plus the present perfect leans Spain; for a price hold, Latin-American readers expect «expiró» / «venció». Acceptable as is, so minor. · правило `neutral-variant-caducado` · ai

### A0009 · на вкус · style-variant · уверенность 0.6

`home.typeDailyBody` — home — [на сайте](https://magicesim.store/es/)

**EN**

> A data allowance for each day of the trip, rather than one amount for the whole stay.

**Сейчас**

> Una cantidad de datos para cada día del viaje, en lugar de una sola cantidad para toda la estancia.

**Предложение**

> Una cantidad de datos para cada día del viaje, en lugar de una sola cantidad para toda la estadía.

**Почему:** «estancia» in the sense of a stay is the usual word in Spain; Latin America mostly says «estadía», which suits the Latin-American-first neutral variant and is understood in Spain too. · правило `regional-word-estancia` · ai

### A0002 · на вкус · accuracy · уверенность 0.55

`nav.compat` — header menu — [на сайте](https://magicesim.store/es/)

**EN**

> Device check

**Сейчас**

> Compatibilidad

**Предложение**

> Comprobar dispositivo

**Почему:** The English names an action (checking the device); «Compatibilidad» names the topic. Acceptable as a short menu label, but «Comprobar dispositivo» keeps the source's meaning — a matter of taste, worth a native's look. · правило `menu-label-meaning` · ai

### A0006 · на вкус · fluency · уверенность 0.55

`quote.fixed` — checkout window (country page → plan) — [на сайте](https://magicesim.store/es/esim/thailand/)

**EN**

> The price is fixed: {price}.

**Сейчас**

> El precio está fijado: {price}.

**Предложение**

> El precio quedó fijado: {price}.

**Почему:** «quedó fijado» is the more natural way to report a just-completed fixing of the price; the current text is correct, so preferential. · правило `natural-result-state` · ai

## daily

### A0013 · мелко · style-variant · уверенность 0.6

`place:the Middle East` — daily plan card title («Region — 1 GB a day») — [на сайте](https://magicesim.store/es/esim/thailand/#dailyBlock)

**EN**

> the Middle East

**Сейчас**

> Oriente Medio

**Предложение**

> Medio Oriente

**Почему:** Both forms are correct, but «Oriente Medio» is the form preferred in Spain, while Latin America overwhelmingly says «Medio Oriente»; the variant is neutral international with a Latin-American-first audience (README). · правило `regional-word-latam-first` · ai

## page

### A0010 · мелко · accuracy · уверенность 0.6

`countryTitle` — country page (sample: Thailand) — [на сайте](https://magicesim.store/es/esim/thailand/)

**EN**

> eSIM for Thailand — data plans in US dollars | Magic eSIM

**Сейчас**

> eSIM para Tailandia: planes de datos en dólares | Magic eSIM

**Предложение**

> eSIM para Tailandia: planes de datos en USD | Magic eSIM

**Почему:** «US dollars» became plain «dólares»; for a Latin-American audience several currencies are called «dólares» or use «$», so the currency is less exact than the English. «USD» (do-not-translate, the site's price format) restores it and keeps the title under 60 characters. · правило `currency-precision-title` · ai

### A0012 · мелко · fluency · уверенность 0.6

`guidesLead` — guides — [на сайте](https://magicesim.store/es/guides/)

**EN**

> Install, check and fix a travel eSIM — step by step.

**Сейчас**

> Instala, comprueba y soluciona una eSIM de viaje, paso a paso.

**Предложение**

> Instala y comprueba una eSIM de viaje y soluciona sus problemas, paso a paso.

**Почему:** «solucionar una eSIM» is a calque of «fix an eSIM»: in Spanish one solves problems, not the object itself; giving «solucionar» its natural object keeps the meaning and reads naturally. · правило `solucionar-needs-problem-object` · ai

### A0011 · мелко · fluency · уверенность 0.6

`localNote` — country page (sample: Thailand) — [на сайте](https://magicesim.store/es/esim/thailand/)

**EN**

> Plans that cover Thailand only.

**Сейчас**

> Planes que solo cubren Tailandia.

**Предложение**

> Planes que cubren solo Tailandia.

**Почему:** «solo» before the verb can read as «they only cover (do nothing else)»; placing it before «Tailandia» scopes it to the country, as the English «Thailand only» does, and contrasts cleanly with the regional note («junto con otros países»). · правило `solo-scope` · ai

## Отклонено вторым мнением

- guide-android:s1.body · consistency · «Los ajustes de la SIM suelen estar en uno de estos lugares; » → «» — «Añadir eSIM» is the label Samsung’s own Spanish page uses (platform-labels.md), so quoting the vendor label instead of translating the English UI text «Add mobile plan» is correct and the meaning of the step is kept.
