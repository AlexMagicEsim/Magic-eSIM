# Ревью локализации: fr — 2026-10-22

Строк проверено: **516** · строк с замечаниями: **16** · замечаний: **19** · код: `7a1aa680`

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 3 |
| мелко (minor) | 16 |
| на вкус (preferential) | 0 |

| Категория | Замечаний |
|---|---|
| accuracy | 9 |
| fluency | 4 |
| punctuation | 2 |
| country-name | 2 |
| spelling | 1 |
| terminology | 1 |

Источник: механические проверки 2, ИИ-ревью 17; второе мнение подтвердило или понизило 0, отклонило 0. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 1.

## Решения арбитра

Строк с замечаниями: 16 · исправить: **10** · оставить как есть: 3 · стилистика (не применяется): 3 · внесено и подтверждено повторной выгрузкой: **10/10**

### guide-android:s3.body · мелко

guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/fr/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Было**

> • Vérifiez que l’eSIM est activée. Pixel : Paramètres → Réseau et Internet → Réseau mobile → l’eSIM → **Utiliser cette carte SIM**.
> • Choisissez l’eSIM comme SIM pour les **données mobiles**. Pixel : Paramètres → Réseau et Internet → Cartes SIM → **Données mobiles**. Votre SIM principale peut rester active pour les appels et les SMS.
> • Activez l'**itinérance** pour l’eSIM. Pixel : Paramètres → Réseau et Internet → Cartes SIM (ou Profils SIM) → **Itinérance**. Samsung : cherchez le réglage dans les paramètres de réseau mobile sous Connexions ; son nom exact dépend du modèle. Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.
> • Si vous ne voulez pas de frais de votre opérateur habituel, désactivez l’itinérance des données sur votre SIM principale.
> • Attendez une ou deux minutes que le téléphone s’enregistre sur un réseau local.

**Стало**

> • Vérifiez que l’eSIM est activée. Pixel : Paramètres → Réseau et Internet → Réseau mobile → l’eSIM → **Utiliser cette carte SIM**.
> • Choisissez l’eSIM comme SIM pour les **données mobiles**. Pixel : Paramètres → Réseau et Internet → Cartes SIM → **Données mobiles**. Votre SIM principale peut rester active pour les appels et les SMS.
> • Activez l’**itinérance** pour l’eSIM. Pixel : Paramètres → Réseau et Internet → Cartes SIM (ou Profils SIM) → **Itinérance**. Samsung : cherchez le réglage dans les paramètres de réseau mobile sous Connexions ; son nom exact dépend du modèle. Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.
> • Si vous ne voulez pas de frais de votre opérateur habituel, désactivez l’itinérance des données sur votre SIM principale.
> • Attendez une ou deux minutes que le téléphone s’enregistre sur un réseau local.

**Причина:** Typography D7: the ASCII apostrophe in «l'**itinérance**» becomes ’. F0008 is not applied: the Pixel roaming path is attested (Google 2926415) and is the same deliberate substitute for the unattested Samsung label as in the ES and DE guides.

**Независимые проверки:** linguistic A0004 (punctuation, мелко, 0.95); fidelity A0017 (accuracy, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:s2.body · мелко

guide «When to install and turn on your eSIM», section 2 — [на сайте](https://magicesim.store/fr/guides/activation/#validity)

**EN**

> It depends on the plan. Some plans start counting when the eSIM first connects to a network at the destination or first uses data. Others start as soon as the eSIM is installed.
> Because of that, the advice that never costs you days is to **install on the day you travel** — at home before you leave or on airport Wi-Fi — and to switch the eSIM on for data once you land.

**Было**

> Cela dépend du forfait. Certains forfaits commencent à courir quand l’eSIM se connecte pour la première fois à un réseau à destination ou utilise des données pour la première fois. D’autres commencent dès l’installation de l’eSIM.
> C’est pourquoi le conseil qui ne vous fait jamais perdre de jours est d'**installer l’eSIM le jour du voyage** (chez vous avant de partir ou avec le Wi-Fi de l’aéroport) et de l’activer pour les données à l’atterrissage.

**Стало**

> Cela dépend du forfait. Certains forfaits commencent à courir quand l’eSIM se connecte pour la première fois à un réseau à destination ou utilise des données pour la première fois. D’autres commencent dès l’installation de l’eSIM.
> C’est pourquoi le conseil qui ne vous fait jamais perdre de jours est d’**installer l’eSIM le jour du voyage** (chez vous avant de partir ou avec le Wi-Fi de l’aéroport) et de l’activer pour les données à l’atterrissage.

**Причина:** Typography D7: the ASCII apostrophe in «d'**installer…**» becomes ’; nothing else changes.

**Независимые проверки:** linguistic A0005 (punctuation, мелко, 0.95) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-troubleshooting:description · важно

guide «eSIM not working — what to check» — [на сайте](https://magicesim.store/fr/guides/troubleshooting/)

**EN**

> A step-by-step checklist when a travel eSIM shows no network or no internet: data line, roaming, airplane mode, network selection, when not to delete it.

**Было**

> Liste pour une eSIM de voyage sans réseau ni Internet : ligne de données, itinérance, mode Avion, choix du réseau et pourquoi ne pas supprimer l’eSIM.

**Стало**

> Check-list pas à pas pour une eSIM de voyage sans réseau ni Internet : ligne de données, itinérance, mode Avion, choix du réseau, quand ne pas supprimer l’eSIM.

**Причина:** Accuracy: «pourquoi ne pas supprimer l’eSIM» can read as «why not delete the eSIM?» — the opposite of the English «when not to delete it» — and «step-by-step checklist» was reduced to «Liste». The final restores both at 160 characters (≤ 160).

**Независимые проверки:** linguistic A0006 (fluency, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### countries:VC · мелко

country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/fr/esim/saint-vincent-and-the-grenadines/)

**EN**

> Saint Vincent and the Grenadines

**Было**

> Saint-Vincent-et-les Grenadines

**Стало**

> Saint-Vincent-et-les-Grenadines

**Причина:** Spelling: the French official / CLDR name is hyphenated throughout; the missing hyphen before «Grenadines» is an error. Any FR_POUR key in seo/page-copy.mjs naming the old spelling must change with it.

**Независимые проверки:** linguistic A0007 (spelling, мелко, 0.8) · плейсхолдеры сохранены · на сайте именно этот текст

### countries:SX · мелко

country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/fr/esim/sint-maarten/)

**EN**

> Sint Maarten

**Было**

> Sint-Maarten

**Стало**

> Sint Maarten

**Причина:** Spelling: the local name kept on purpose is the Dutch «Sint Maarten», which has no hyphen (the ES and DE tables write it so); «Sint-Maarten» invents one. The FR_POUR key 'Sint-Maarten' in seo/page-copy.mjs must change with it.

**Независимые проверки:** linguistic A0009 (country-name, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### page:homeDescription · важно

home — [на сайте](https://magicesim.store/fr/)

**EN**

> Pick a destination, install an eSIM and land connected. Magic eSIM covers 190+ destinations with no plastic SIM and no airport queue.

**Было**

> Choisissez une destination, installez une eSIM et soyez connecté dès l’atterrissage. Magic eSIM couvre plus de 190 destinations, sans carte SIM physique.

**Стало**

> Choisissez une destination, installez une eSIM, soyez connecté à l’arrivée. Magic eSIM couvre plus de 190 destinations, sans SIM physique ni file à l’aéroport.

**Причина:** Accuracy: the second benefit «no airport queue» was dropped from the meta description. The suggestion restores it and stays within the budget (159 ≤ 160).

**Независимые проверки:** fidelity A0012 (accuracy, важно, 0.75) · плейсхолдеры сохранены · на сайте именно этот текст

### page:hubDescription · мелко

destination list — [на сайте](https://magicesim.store/fr/esim/)

**EN**

> Every destination Magic eSIM has data plans for, with prices in US dollars. Online payment is not available yet.

**Было**

> Toutes les destinations de Magic eSIM, avec des prix en dollars américains. Le paiement en ligne n’est pas encore disponible.

**Стало**

> Toutes les destinations où Magic eSIM propose des forfaits de données, avec des prix en dollars américains. Le paiement en ligne n’est pas encore disponible.

**Причина:** Accuracy/SEO: «has data plans for» was dropped, losing what the destinations offer and the keyword «forfaits de données»; the suggestion restores it at 157 characters.

**Независимые проверки:** fidelity A0013 (accuracy, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### page:guidesDescription · мелко

guides — [на сайте](https://magicesim.store/fr/guides/)

**EN**

> How to install a travel eSIM on iPhone and Android, check that your phone supports it, when to install it and what to do if it does not work.

**Было**

> Installer une eSIM de voyage sur iPhone et Android, vérifier la compatibilité de votre téléphone, choisir le bon moment et résoudre les problèmes.

**Стало**

> Installer une eSIM de voyage sur iPhone et Android, vérifier la compatibilité de votre téléphone, savoir quand l’installer et résoudre les problèmes.

**Причина:** Accuracy: «choisir le bon moment» does not say for what; the English topic is when to install the eSIM. «savoir quand l’installer» restores it (149 characters).

**Независимые проверки:** fidelity A0014 (accuracy, мелко, 0.65) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-android:s2.body · важно

guide «How to install an eSIM on Android», section 2 — [на сайте](https://magicesim.store/fr/guides/android/#install)

**EN**

> • Show your eSIM's QR code on another screen.
> • Start adding an eSIM as above. **Samsung:** tap **Scan QR code** (older One UI: **Add using QR code**) and scan the code. **Pixel:** follow the instructions on the screen.
> • No QR code to scan? On Samsung with older One UI, tap **Add using activation code** and enter the details provided with your eSIM; on newer versions, follow the on-screen option for entering an activation code.
> • Confirm, and wait until the installation finishes.
> • Rename the eSIM, for example to «Travel».

**Было**

> • Affichez le code QR de votre eSIM sur un autre écran.
> • Commencez à ajouter une eSIM comme indiqué ci-dessus. **Samsung :** touchez **Scanner le code QR** (sur les versions plus anciennes : **Numérisation code QR opérateur**) et scannez le code. **Pixel :** suivez les instructions à l’écran.
> • Pas de code QR à scanner ? Sur Samsung, touchez **Entrer le code d’activation** et saisissez les données fournies avec votre eSIM.
> • Confirmez et attendez la fin de l’installation.
> • Renommez l’eSIM, par exemple « Voyage ».

**Стало**

> • Affichez le code QR de votre eSIM sur un autre écran.
> • Commencez à ajouter une eSIM comme indiqué ci-dessus. **Samsung :** touchez **Scanner le code QR** (sur les versions plus anciennes : **Numérisation code QR opérateur**) et scannez le code. **Pixel :** suivez les instructions à l’écran.
> • Pas de code QR à scanner ? Sur Samsung, touchez **Entrer le code d’activation** et saisissez les données fournies avec votre eSIM (sur les versions plus anciennes de One UI, suivez l’option proposée à l’écran pour saisir un code d’activation).
> • Confirmez et attendez la fin de l’installation.
> • Renommez l’eSIM, par exemple « Voyage ».

**Причина:** Accuracy/platform-label: «Entrer le code d’activation» is attested only for the current One UI, but the French applied it to every Samsung; the final keeps it for current One UI and, as the English does, sends older One UI to the on-screen option without quoting an unsourced label.

**Независимые проверки:** fidelity A0015 (accuracy, важно, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-compatibility:s1.body · мелко

guide «Does your phone support eSIM?», section 1 — [на сайте](https://magicesim.store/fr/guides/compatibility/#setting)

**EN**

> **iPhone:** Settings → Cellular. **Add eSIM** or **Add Cellular Plan** means eSIM is supported.
> **Android:** open the SIM settings and look for a way to add an eSIM — on Pixel, Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**; on Samsung, Connections → SIM manager → **Add eSIM** (older One UI: SIM card manager → **Add mobile plan**).
> An extra hint on Pixel: to use an eSIM, a phone needs an **EID** number. You can find it in Settings → About phone → SIM status. The setting to add an eSIM is still what decides.

**Было**

> **iPhone :** Réglages → Données cellulaires (au Canada, Réseau cellulaire). Si **Ajouter une eSIM** ou **Ajouter un forfait cellulaire** apparaît, l’iPhone est compatible eSIM.
> **Android :** ouvrez les réglages SIM et cherchez comment ajouter une eSIM : sur Pixel, Réseau et Internet → Cartes SIM → **Ajouter une carte SIM** → **Configurer une eSIM** ; sur Samsung, Connexions → Gestionnaire SIM → **Ajouter une eSIM** (sur les versions plus anciennes de One UI, les noms du menu et de l’option diffèrent).
> Autre indice sur Pixel : pour utiliser une eSIM, le téléphone doit disposer d’un numéro **EID**. Vous le trouverez dans Paramètres → À propos du téléphone → État de la carte SIM. Mais c’est le réglage pour ajouter une eSIM qui fait foi.

**Стало**

> **iPhone :** Réglages → Données cellulaires (au Canada, Réseau cellulaire). Si **Ajouter une eSIM** ou **Ajouter un forfait cellulaire** apparaît, l’iPhone est compatible eSIM.
> **Android :** ouvrez les réglages SIM et cherchez comment ajouter une eSIM : sur Pixel, Réseau et Internet → Cartes SIM → **Ajouter une carte SIM** → **Configurer une eSIM** ; sur Samsung, Connexions → Gestionnaire SIM → **Ajouter une eSIM** (sur les versions plus anciennes de One UI : Gestionnaire de carte SIM → **Ajout d’un forfait mobile**).
> Autre indice sur Pixel : pour utiliser une eSIM, le téléphone doit disposer d’un numéro **EID**. Vous le trouverez dans Paramètres → À propos du téléphone → État de la carte SIM. Mais c’est le réglage pour ajouter une eSIM qui fait foi.

**Причина:** Accuracy: the English gives the older One UI path; the French dropped it although both labels are attested in platform-labels.md (older column, «Gestionnaire de carte SIM» → «Ajout d’un forfait mobile») and guide-android:s1 quotes them.

**Независимые проверки:** fidelity A0016 (accuracy, мелко, 0.75) · плейсхолдеры сохранены · на сайте именно этот текст

### Стилистика — записано, не применяется

- ui:how.step4: «activez-la» is understood as the eSIM (as in the ES twin «actívala»); naming «l’eSIM» would be clearer after «le profil eSIM», but the step is not wrong — style, not applied.
- ui:quote.explain: «réservé» is understandable and not wrong; «maintenu» is a more idiomatic verb for a held price. Stylistic, recorded not applied (it would also mean changing ui:quote.heldFor together).
- countries:VA: «État de la Cité du Vatican» is the correct CLDR French name, not an error; a shorter common name («Cité du Vatican») would read lighter after «pour», but that is a style choice.

### Оставлено как есть

- page:homeArtCoverageValue: False positive of the identical-text check: «destinations» is the French word (glossary target) and «190+» is a figure, so the string is correctly the same as the English.
- guide-compatibility:s2.body: False positive: «abonnement» translates «on contract» (a phone bought with a subscription), not the glossary term «plan» → «forfait»; the sentence is correct French.
- ui:checkout.emailNote: The note sits directly under the label «Adresse e-mail pour votre eSIM» (checkout.email, feminine), so «Elle» has its antecedent; «ni envoyée ni enregistrée» states the same fact as «not sent or saved anywhere» — «nulle part» is emphasis only.

## Все замечания этапов

## page

### A0012 · важно · accuracy · уверенность 0.75 · fidelity · объективное

`homeDescription` — home — [на сайте](https://magicesim.store/fr/)

**EN**

> Pick a destination, install an eSIM and land connected. Magic eSIM covers 190+ destinations with no plastic SIM and no airport queue.

**Сейчас**

> Choisissez une destination, installez une eSIM et soyez connecté dès l’atterrissage. Magic eSIM couvre plus de 190 destinations, sans carte SIM physique.

**Предложение**

> Choisissez une destination, installez une eSIM, soyez connecté à l’arrivée. Magic eSIM couvre plus de 190 destinations, sans SIM physique ni file à l’aéroport.

**Почему:** Accuracy: the second benefit «no airport queue» is dropped. The suggestion restores it and stays within the 160-character description budget (159). · правило `fidelity: nothing dropped` · ai

### C0001 · важно · accuracy · уверенность 0.7 · check · объективное

`homeArtCoverageValue` — home — [на сайте](https://magicesim.store/fr/)

**EN**

> 190+ destinations

**Сейчас**

> 190+ destinations

**Почему:** The translation is identical to the English source. · правило `untranslated` · check

### A0013 · мелко · accuracy · уверенность 0.7 · fidelity · объективное

`hubDescription` — destination list — [на сайте](https://magicesim.store/fr/esim/)

**EN**

> Every destination Magic eSIM has data plans for, with prices in US dollars. Online payment is not available yet.

**Сейчас**

> Toutes les destinations de Magic eSIM, avec des prix en dollars américains. Le paiement en ligne n’est pas encore disponible.

**Предложение**

> Toutes les destinations où Magic eSIM propose des forfaits de données, avec des prix en dollars américains. Le paiement en ligne n’est pas encore disponible.

**Почему:** Accuracy/SEO: «has data plans for» is dropped, so the snippet loses what the destinations are for and the keyword «forfaits de données». The suggestion restores it at 157 characters (≤ 160). · правило `fidelity: nothing dropped` · ai

### A0014 · мелко · accuracy · уверенность 0.65 · fidelity

`guidesDescription` — guides — [на сайте](https://magicesim.store/fr/guides/)

**EN**

> How to install a travel eSIM on iPhone and Android, check that your phone supports it, when to install it and what to do if it does not work.

**Сейчас**

> Installer une eSIM de voyage sur iPhone et Android, vérifier la compatibilité de votre téléphone, choisir le bon moment et résoudre les problèmes.

**Предложение**

> Installer une eSIM de voyage sur iPhone et Android, vérifier la compatibilité de votre téléphone, savoir quand l’installer et résoudre les problèmes.

**Почему:** Accuracy: «choisir le bon moment» does not say for what; the English topic is specifically when to install the eSIM (the activation guide). The suggestion names it (149 characters). · правило `fidelity: meaning made vague` · ai

## guide-android

### A0015 · важно · accuracy · уверенность 0.7 · fidelity · объективное

`s2.body` — guide «How to install an eSIM on Android», section 2 — [на сайте](https://magicesim.store/fr/guides/android/#install)

**EN**

> • Show your eSIM's QR code on another screen.
> • Start adding an eSIM as above. **Samsung:** tap **Scan QR code** (older One UI: **Add using QR code**) and scan the code. **Pixel:** follow the instructions on the screen.
> • No QR code to scan? On Samsung with older One UI, tap **Add using activation code** and enter the details provided with your eSIM; on newer versions, follow the on-screen option for entering an activation code.
> • Confirm, and wait until the installation finishes.
> • Rename the eSIM, for example to «Travel».

**Сейчас**

> • Affichez le code QR de votre eSIM sur un autre écran.
> • Commencez à ajouter une eSIM comme indiqué ci-dessus. **Samsung :** touchez **Scanner le code QR** (sur les versions plus anciennes : **Numérisation code QR opérateur**) et scannez le code. **Pixel :** suivez les instructions à l’écran.
> • Pas de code QR à scanner ? Sur Samsung, touchez **Entrer le code d’activation** et saisissez les données fournies avec votre eSIM.
> • Confirmez et attendez la fin de l’installation.
> • Renommez l’eSIM, par exemple « Voyage ».

**Предложение**

> • Affichez le code QR de votre eSIM sur un autre écran.
> • Commencez à ajouter une eSIM comme indiqué ci-dessus. **Samsung :** touchez **Scanner le code QR** (sur les versions plus anciennes : **Numérisation code QR opérateur**) et scannez le code. **Pixel :** suivez les instructions à l’écran.
> • Pas de code QR à scanner ? Sur Samsung, touchez **Entrer le code d’activation** et saisissez les données fournies avec votre eSIM (sur les versions plus anciennes de One UI, suivez l’option proposée à l’écran pour saisir un code d’activation).
> • Confirmez et attendez la fin de l’installation.
> • Renommez l’eSIM, par exemple « Voyage ».

**Почему:** Accuracy: the English distinguishes older and newer One UI for the activation-code step; the French applies «Entrer le code d’activation» to every Samsung, but platform-labels.md attests it only for the current One UI (the older-One-UI page has no such label). The suggestion keeps the attested current label and restores the version condition without quoting an unsourced label. · правило `fidelity: condition dropped; labels evidence-bound` · ai

### A0004 · мелко · punctuation · уверенность 0.95 · linguistic · объективное

`s3.body` — guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/fr/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Сейчас**

> • Vérifiez que l’eSIM est activée. Pixel : Paramètres → Réseau et Internet → Réseau mobile → l’eSIM → **Utiliser cette carte SIM**.
> • Choisissez l’eSIM comme SIM pour les **données mobiles**. Pixel : Paramètres → Réseau et Internet → Cartes SIM → **Données mobiles**. Votre SIM principale peut rester active pour les appels et les SMS.
> • Activez l'**itinérance** pour l’eSIM. Pixel : Paramètres → Réseau et Internet → Cartes SIM (ou Profils SIM) → **Itinérance**. Samsung : cherchez le réglage dans les paramètres de réseau mobile sous Connexions ; son nom exact dépend du modèle. Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.
> • Si vous ne voulez pas de frais de votre opérateur habituel, désactivez l’itinérance des données sur votre SIM principale.
> • Attendez une ou deux minutes que le téléphone s’enregistre sur un réseau local.

**Предложение**

> • Vérifiez que l’eSIM est activée. Pixel : Paramètres → Réseau et Internet → Réseau mobile → l’eSIM → **Utiliser cette carte SIM**.
> • Choisissez l’eSIM comme SIM pour les **données mobiles**. Pixel : Paramètres → Réseau et Internet → Cartes SIM → **Données mobiles**. Votre SIM principale peut rester active pour les appels et les SMS.
> • Activez l’**itinérance** pour l’eSIM. Pixel : Paramètres → Réseau et Internet → Cartes SIM (ou Profils SIM) → **Itinérance**. Samsung : cherchez le réglage dans les paramètres de réseau mobile sous Connexions ; son nom exact dépend du modèle. Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.
> • Si vous ne voulez pas de frais de votre opérateur habituel, désactivez l’itinérance des données sur votre SIM principale.
> • Attendez une ou deux minutes que le téléphone s’enregistre sur un réseau local.

**Почему:** Straight apostrophe in «l'**itinérance**»; the site's French typography (README D7) requires the typographic apostrophe ’. · правило `fr-typography-apostrophe` · ai

### A0017 · мелко · accuracy · уверенность 0.55 · fidelity · объективное

`s3.body` — guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/fr/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Сейчас**

> • Vérifiez que l’eSIM est activée. Pixel : Paramètres → Réseau et Internet → Réseau mobile → l’eSIM → **Utiliser cette carte SIM**.
> • Choisissez l’eSIM comme SIM pour les **données mobiles**. Pixel : Paramètres → Réseau et Internet → Cartes SIM → **Données mobiles**. Votre SIM principale peut rester active pour les appels et les SMS.
> • Activez l'**itinérance** pour l’eSIM. Pixel : Paramètres → Réseau et Internet → Cartes SIM (ou Profils SIM) → **Itinérance**. Samsung : cherchez le réglage dans les paramètres de réseau mobile sous Connexions ; son nom exact dépend du modèle. Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.
> • Si vous ne voulez pas de frais de votre opérateur habituel, désactivez l’itinérance des données sur votre SIM principale.
> • Attendez une ou deux minutes que le téléphone s’enregistre sur un réseau local.

**Предложение**

> • Vérifiez que l’eSIM est activée. Pixel : Paramètres → Réseau et Internet → Réseau mobile → l’eSIM → **Utiliser cette carte SIM**.
> • Choisissez l’eSIM comme SIM pour les **données mobiles**. Pixel : Paramètres → Réseau et Internet → Cartes SIM → **Données mobiles**. Votre SIM principale peut rester active pour les appels et les SMS.
> • Activez l'**itinérance** pour l’eSIM. Samsung : cherchez le réglage dans les paramètres de réseau mobile sous Connexions ; son nom exact dépend du modèle. Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.
> • Si vous ne voulez pas de frais de votre opérateur habituel, désactivez l’itinérance des données sur votre SIM principale.
> • Attendez une ou deux minutes que le téléphone s’enregistre sur un réseau local.

**Почему:** Accuracy: the French adds a Pixel menu path for roaming that the English does not give (the English names only a Samsung path, which the French correctly describes instead of quoting, as platform-labels.md requires). The labels are attested (Google page 2926415), so this is a sourced addition, not a wrong instruction — keep it only if the EN source gains the same path; otherwise remove it to keep EN and FR aligned. · правило `fidelity: nothing added` · ai

## guide-activation

### A0005 · мелко · punctuation · уверенность 0.95 · linguistic · объективное

`s2.body` — guide «When to install and turn on your eSIM», section 2 — [на сайте](https://magicesim.store/fr/guides/activation/#validity)

**EN**

> It depends on the plan. Some plans start counting when the eSIM first connects to a network at the destination or first uses data. Others start as soon as the eSIM is installed.
> Because of that, the advice that never costs you days is to **install on the day you travel** — at home before you leave or on airport Wi-Fi — and to switch the eSIM on for data once you land.

**Сейчас**

> Cela dépend du forfait. Certains forfaits commencent à courir quand l’eSIM se connecte pour la première fois à un réseau à destination ou utilise des données pour la première fois. D’autres commencent dès l’installation de l’eSIM.
> C’est pourquoi le conseil qui ne vous fait jamais perdre de jours est d'**installer l’eSIM le jour du voyage** (chez vous avant de partir ou avec le Wi-Fi de l’aéroport) et de l’activer pour les données à l’atterrissage.

**Предложение**

> Cela dépend du forfait. Certains forfaits commencent à courir quand l’eSIM se connecte pour la première fois à un réseau à destination ou utilise des données pour la première fois. D’autres commencent dès l’installation de l’eSIM.
> C’est pourquoi le conseil qui ne vous fait jamais perdre de jours est d’**installer l’eSIM le jour du voyage** (chez vous avant de partir ou avec le Wi-Fi de l’aéroport) et de l’activer pour les données à l’atterrissage.

**Почему:** Straight apostrophe in «d'**installer…»; the site's French typography (README D7) requires the typographic apostrophe ’. · правило `fr-typography-apostrophe` · ai

## countries

### A0007 · мелко · spelling · уверенность 0.8 · linguistic · объективное

`VC` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/fr/esim/saint-vincent-and-the-grenadines/)

**EN**

> Saint Vincent and the Grenadines

**Сейчас**

> Saint-Vincent-et-les Grenadines

**Предложение**

> Saint-Vincent-et-les-Grenadines

**Почему:** The French official name (and CLDR fr) is hyphenated throughout: «Saint-Vincent-et-les-Grenadines»; the missing hyphen before «Grenadines» is a spelling error. · правило `fr-country-name-hyphenation` · ai

### A0008 · мелко · country-name · уверенность 0.65 · linguistic

`VA` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/fr/esim/vatican/)

**EN**

> Vatican City

**Сейчас**

> État de la Cité du Vatican

**Предложение**

> Vatican

**Почему:** «État de la Cité du Vatican» is the formal state title; in a destination list, H1 and plan cards a French reader expects «Vatican» (or «Cité du Vatican»), as the English uses the common name «Vatican City». It also reads heavily after «pour». · правило `fr-common-country-name` · ai

### A0009 · мелко · country-name · уверенность 0.6 · linguistic

`SX` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/fr/esim/sint-maarten/)

**EN**

> Sint Maarten

**Сейчас**

> Sint-Maarten

**Предложение**

> Sint Maarten

**Почему:** The Dutch name is written without a hyphen («Sint Maarten»); the hyphenated «Sint-Maarten» mixes the Dutch name with French hyphenation and matches neither usage (French also says «Saint-Martin (partie néerlandaise)»). · правило `fr-country-name-spelling` · ai

## guide-compatibility

### C0002 · мелко · terminology · уверенность 0.8 · check · объективное

`s2.body` — guide «Does your phone support eSIM?», section 2 — [на сайте](https://magicesim.store/fr/guides/compatibility/#lock)

**EN**

> A phone bought on contract may be locked to its carrier and refuse other SIMs and eSIMs until it is unlocked.
> On iPhone, open **Settings → General → About** and look for «No SIM Restrictions» next to **Carrier Lock**. On Android, ask the carrier that sold the phone.

**Сейчас**

> Un téléphone acheté avec un abonnement peut être verrouillé par son opérateur et refuser les autres SIM et eSIM jusqu’à son déverrouillage.
> Sur iPhone, ouvrez **Réglages → Général → Informations** et cherchez « Aucune restriction de SIM » en regard de **Verrouillage de l’opérateur**. Sur Android, renseignez-vous auprès de l’opérateur qui a vendu le téléphone.

**Почему:** «abonnement»: the glossary uses «forfait» for «plan». · правило `glossary:plan` · check

### A0016 · мелко · accuracy · уверенность 0.75 · fidelity · объективное

`s1.body` — guide «Does your phone support eSIM?», section 1 — [на сайте](https://magicesim.store/fr/guides/compatibility/#setting)

**EN**

> **iPhone:** Settings → Cellular. **Add eSIM** or **Add Cellular Plan** means eSIM is supported.
> **Android:** open the SIM settings and look for a way to add an eSIM — on Pixel, Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**; on Samsung, Connections → SIM manager → **Add eSIM** (older One UI: SIM card manager → **Add mobile plan**).
> An extra hint on Pixel: to use an eSIM, a phone needs an **EID** number. You can find it in Settings → About phone → SIM status. The setting to add an eSIM is still what decides.

**Сейчас**

> **iPhone :** Réglages → Données cellulaires (au Canada, Réseau cellulaire). Si **Ajouter une eSIM** ou **Ajouter un forfait cellulaire** apparaît, l’iPhone est compatible eSIM.
> **Android :** ouvrez les réglages SIM et cherchez comment ajouter une eSIM : sur Pixel, Réseau et Internet → Cartes SIM → **Ajouter une carte SIM** → **Configurer une eSIM** ; sur Samsung, Connexions → Gestionnaire SIM → **Ajouter une eSIM** (sur les versions plus anciennes de One UI, les noms du menu et de l’option diffèrent).
> Autre indice sur Pixel : pour utiliser une eSIM, le téléphone doit disposer d’un numéro **EID**. Vous le trouverez dans Paramètres → À propos du téléphone → État de la carte SIM. Mais c’est le réglage pour ajouter une eSIM qui fait foi.

**Предложение**

> **iPhone :** Réglages → Données cellulaires (au Canada, Réseau cellulaire). Si **Ajouter une eSIM** ou **Ajouter un forfait cellulaire** apparaît, l’iPhone est compatible eSIM.
> **Android :** ouvrez les réglages SIM et cherchez comment ajouter une eSIM : sur Pixel, Réseau et Internet → Cartes SIM → **Ajouter une carte SIM** → **Configurer une eSIM** ; sur Samsung, Connexions → Gestionnaire SIM → **Ajouter une eSIM** (sur les versions plus anciennes de One UI : Gestionnaire de carte SIM → **Ajout d’un forfait mobile**).
> Autre indice sur Pixel : pour utiliser une eSIM, le téléphone doit disposer d’un numéro **EID**. Vous le trouverez dans Paramètres → À propos du téléphone → État de la carte SIM. Mais c’est le réglage pour ajouter une eSIM qui fait foi.

**Почему:** Accuracy/consistency: the English gives the older One UI path (SIM card manager → Add mobile plan); the French drops it although both labels are attested in platform-labels.md (older One UI column) and guide-android:s1.body already quotes them. The suggestion restores the path with the attested labels. · правило `fidelity: nothing dropped; consistency across the batch` · ai

## ui

### A0001 · мелко · fluency · уверенность 0.65 · linguistic

`how.step4` — home → how it works — [на сайте](https://magicesim.store/fr/#how)

**EN**

> Land, switch it on, and you are online.

**Сейчас**

> À l’arrivée, activez-la : vous êtes connecté.

**Предложение**

> À l’arrivée, activez l’eSIM : vous êtes connecté.

**Почему:** « activez-la » has no feminine antecedent in the step: the previous step names «le profil eSIM» (masculine), so the pronoun reads as a mismatch; naming «l’eSIM» removes the ambiguity. · правило `pronoun-antecedent` · ai

### A0002 · мелко · fluency · уверенность 0.6 · linguistic

`checkout.emailNote` — checkout window (country page → plan) — [на сайте](https://magicesim.store/fr/esim/thailand/)

**EN**

> Not sent or saved anywhere yet — payment isn't available.

**Сейчас**

> Elle n’est encore ni envoyée ni enregistrée : le paiement n’est pas disponible.

**Предложение**

> Votre adresse e-mail n’est encore ni envoyée ni enregistrée : le paiement n’est pas disponible.

**Почему:** The note opens with « Elle », but the field it sits under may be labelled « E-mail » (masculine, ui:checkout.emailShort); a standalone note should name its subject rather than rely on a pronoun. · правило `pronoun-antecedent` · ai

### A0010 · мелко · accuracy · уверенность 0.6 · fidelity

`checkout.emailNote` — checkout window (country page → plan) — [на сайте](https://magicesim.store/fr/esim/thailand/)

**EN**

> Not sent or saved anywhere yet — payment isn't available.

**Сейчас**

> Elle n’est encore ni envoyée ni enregistrée : le paiement n’est pas disponible.

**Предложение**

> Votre adresse n’est encore ni envoyée ni enregistrée nulle part : le paiement n’est pas disponible.

**Почему:** «anywhere» is dropped, and the bare pronoun «Elle» has no antecedent when the note sits under the short label «E-mail» (masculine, checkout.emailShort); naming «Votre adresse» and adding «nulle part» restores the English (accuracy). · правило `fidelity: information dropped / unclear referent` · ai

### A0003 · мелко · fluency · уверенность 0.6 · linguistic

`quote.explain` — checkout window (country page → plan) — [на сайте](https://magicesim.store/fr/esim/thailand/)

**EN**

> The exact price is fixed by our server and held for 30 minutes.

**Сейчас**

> Le prix exact est fixé par notre serveur et réservé pendant 30 minutes.

**Предложение**

> Le prix exact est fixé par notre serveur et maintenu pendant 30 minutes.

**Почему:** « Réserver un prix » is unusual in French (one reserves a seat or a room); « maintenu » (or « bloqué ») is the natural verb for a price held for a time. Also in ui:quote.heldFor (« Prix maintenu pendant {time} »). · правило `collocation` · ai

### A0011 · мелко · accuracy · уверенность 0.55 · fidelity

`quote.explain` — checkout window (country page → plan) — [на сайте](https://magicesim.store/fr/esim/thailand/)

**EN**

> The exact price is fixed by our server and held for 30 minutes.

**Сейчас**

> Le prix exact est fixé par notre serveur et réservé pendant 30 minutes.

**Предложение**

> Le prix exact est fixé par notre serveur et maintenu pendant 30 minutes.

**Почему:** «held» means the price stays valid; «réservé» can read as the plan/eSIM being reserved for the buyer, which the English does not say. «maintenu» keeps the meaning; also in ui:quote.heldFor («Prix réservé pendant {time}» → «Prix maintenu pendant {time}»). · правило `fidelity: nuance of «held»` · ai

## guide-troubleshooting

### A0006 · мелко · fluency · уверенность 0.55 · linguistic

`description` — guide «eSIM not working — what to check» — [на сайте](https://magicesim.store/fr/guides/troubleshooting/)

**EN**

> A step-by-step checklist when a travel eSIM shows no network or no internet: data line, roaming, airplane mode, network selection, when not to delete it.

**Сейчас**

> Liste pour une eSIM de voyage sans réseau ni Internet : ligne de données, itinérance, mode Avion, choix du réseau et pourquoi ne pas supprimer l’eSIM.

**Предложение**

> Check-list pour une eSIM de voyage sans réseau ni Internet : ligne de données, itinérance, mode Avion, choix du réseau et pourquoi ne pas supprimer l’eSIM.

**Почему:** The snippet opens with a bare «Liste pour une eSIM…», which reads as truncated; «Check-list» (current fr-FR usage, EN «checklist») says what the list is. 156 characters, within the 160 budget. · правило `fr-natural-phrasing` · ai

