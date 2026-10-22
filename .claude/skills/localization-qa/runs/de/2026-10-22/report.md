# Ревью локализации: de — 2026-10-22

Строк проверено: **516** · строк с замечаниями: **26** · замечаний: **35** · код: `f2334a75`

Отчёт ИИ и механических проверок. **Ничего не исправлено автоматически**; это материал для окончательного согласования после независимой оценки носителя.

| Серьёзность | Замечаний |
|---|---|
| критично (critical) | 0 |
| важно (major) | 3 |
| мелко (minor) | 28 |
| на вкус (preferential) | 4 |

| Категория | Замечаний |
|---|---|
| fluency | 11 |
| consistency | 8 |
| accuracy | 7 |
| terminology | 2 |
| grammar | 2 |
| platform-label | 2 |
| punctuation | 1 |
| seo | 1 |
| country-name | 1 |

Источник: механические проверки 8, ИИ-ревью 27; второе мнение подтвердило или понизило 0, отклонило 0. Отброшено при сверке: неизвестная строка 0, неверная форма 0, уверенность < 0.5 0, дубликаты 1.

## Решения арбитра

Строк с замечаниями: 26 · исправить: **15** · оставить как есть: 6 · стилистика (не применяется): 5 · внесено и подтверждено повторной выгрузкой: **15/15**

### page:homeDescription · важно

home — [на сайте](https://magicesim.store/de/)

**EN**

> Pick a destination, install an eSIM and land connected. Magic eSIM covers 190+ destinations with no plastic SIM and no airport queue.

**Было**

> Wähle ein Reiseziel, installiere eine eSIM und sei nach der Landung online. Über 190 Reiseziele, ohne Plastik-SIM und ohne Warteschlange am Flughafen.

**Стало**

> Wähle ein Reiseziel, installiere eine eSIM und sei nach der Landung online. Magic eSIM: über 190 Reiseziele, ohne Plastik-SIM und ohne Schlange am Flughafen.

**Причина:** Accuracy/do-not-translate: the English names Magic eSIM as the subject of «covers 190+ destinations»; the German drops the brand. Restored within the 160-character description budget (157).

**Независимые проверки:** check C0001 (terminology, важно, 0.9) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:s1.body · мелко

guide «How to install an eSIM on iPhone», section 1 — [на сайте](https://magicesim.store/de/guides/iphone/#check)

**EN**

> Open **Settings → Cellular** (called **Mobile Data** in some regions). If you see **Add eSIM** or **Add Cellular Plan**, your iPhone supports eSIM.
> Your iPhone must also not be locked to one carrier. See how to check compatibility.

**Было**

> Öffne **Einstellungen → Mobilfunk**. Wenn du dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** siehst, unterstützt dein iPhone eSIM.
> Außerdem darf dein iPhone keinen SIM-Lock eines Mobilfunkanbieters haben. Lies dazu, wie du die Kompatibilität prüfst.

**Стало**

> Öffne **Einstellungen → Mobilfunk** (in manchen Regionen **Mobile Daten**). Wenn du dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** siehst, unterstützt dein iPhone eSIM.
> Außerdem darf dein iPhone keinen SIM-Lock eines Mobilfunkanbieters haben. Lies dazu, wie du die Kompatibilität prüfst.

**Причина:** Accuracy (rule 1): the English gives the regional alternative label «Mobile Data», which platform-labels.md lists («Mobilfunk (bzw. Mobile Daten)»); the German dropped it. C0002/C0005 are false positives («Mobilfunktarif» carries «Tarif»).

**Независимые проверки:** fidelity A0017 (accuracy, мелко, 0.75); check C0002 (consistency, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-android:s1.body · мелко

guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/de/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM manager → **Add eSIM** (on older One UI versions: SIM card manager → **Add mobile plan**).
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Было**

> Die SIM-Einstellungen liegen meist an einer dieser Stellen; die Namen hängen von Marke und Android-Version ab:
> • **Google Pixel:** Einstellungen → Netzwerk &amp; Internet → SIMs (oder SIM-Karten) → **SIM hinzufügen** → **eSIM einrichten**.
> • **Samsung Galaxy:** Einstellungen → Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> • **Andere Marken:** Such in den Einstellungen nach „Mobilfunknetz“, „SIM-Karten“ oder „Verbindungen“.
> Wenn du nirgends eine Option zum Hinzufügen einer eSIM findest, lies, ob dein Smartphone eSIM unterstützt.

**Стало**

> Die SIM-Einstellungen liegen meist an einer dieser Stellen; die Namen hängen von Marke und Android-Version ab:
> • **Google Pixel:** Einstellungen → Netzwerk &amp; Internet → SIMs (oder SIM-Karten) → **SIM hinzufügen** → **eSIM einrichten**.
> • **Samsung Galaxy:** Einstellungen → Verbindungen → SIM-Manager → **eSIM hinzufügen** (bei älteren One-UI-Versionen heißen Menü und Option anders).
> • **Andere Marken:** Such in den Einstellungen nach „Mobilfunknetz“, „SIM-Karten“ oder „Verbindungen“.
> Wenn du nirgends eine Option zum Hinzufügen einer eSIM findest, lies nach, ob dein Smartphone eSIM unterstützt.

**Причина:** Accuracy: the English's older-One-UI path was dropped; its labels are not in platform-labels.md, so the fact is stated in words (F0006). Fluency: «lies, ob …» → «lies nach, ob …» (L0008). C0008 is a false positive.

**Независимые проверки:** linguistic A0008 (fluency, мелко, 0.7); check C0008 (consistency, мелко, 0.55); fidelity A0020 (accuracy, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-compatibility:s1.body · мелко

guide «Does your phone support eSIM?», section 1 — [на сайте](https://magicesim.store/de/guides/compatibility/#setting)

**EN**

> **iPhone:** Settings → Cellular. **Add eSIM** or **Add Cellular Plan** means eSIM is supported.
> **Android:** open the SIM settings and look for a way to add an eSIM — on Pixel, Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**; on Samsung, Connections → SIM manager → **Add eSIM** (older One UI: SIM card manager → **Add mobile plan**).
> An extra hint on Pixel: to use an eSIM, a phone needs an **EID** number. You can find it in Settings → About phone → SIM status. The setting to add an eSIM is still what decides.

**Было**

> **iPhone:** Einstellungen → Mobilfunk. Wenn dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** erscheint, unterstützt das iPhone eSIM.
> **Android:** Öffne die SIM-Einstellungen und such, wie du eine eSIM hinzufügst: beim Pixel unter Netzwerk &amp; Internet → SIMs → **SIM hinzufügen** → **eSIM einrichten**, bei Samsung unter Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> Ein weiterer Hinweis beim Pixel: Um eine eSIM zu nutzen, braucht das Smartphone eine **EID**-Nummer. Du findest sie unter Einstellungen → Über das Telefon → SIM-Status. Entscheidend ist aber die Einstellung zum Hinzufügen einer eSIM.

**Стало**

> **iPhone:** Einstellungen → Mobilfunk. Wenn dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** erscheint, unterstützt das iPhone eSIM.
> **Android:** Öffne die SIM-Einstellungen und such nach einer Möglichkeit, eine eSIM hinzuzufügen: beim Pixel unter Netzwerk &amp; Internet → SIMs → **SIM hinzufügen** → **eSIM einrichten**, bei Samsung unter Verbindungen → SIM-Manager → **eSIM hinzufügen** (bei älteren One-UI-Versionen heißen Menü und Option anders).
> Ein weiterer Hinweis beim Pixel: Um eine eSIM zu nutzen, braucht das Smartphone eine **EID**-Nummer. Du findest sie unter Einstellungen → Über das Telefon → SIM-Status. Entscheidend ist aber die Einstellung zum Hinzufügen einer eSIM.

**Причина:** Fluency: «such, wie du …» is unidiomatic; «such nach einer Möglichkeit» matches «look for a way» (L0009). Accuracy: the older One UI hint the English gives is restored in words, as F0006 notes «also in» here. C0009 is a false positive.

**Независимые проверки:** linguistic A0009 (fluency, мелко, 0.7); check C0009 (consistency, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### ui:quote.explain · мелко

checkout window (country page → plan) — [на сайте](https://magicesim.store/de/esim/thailand/)

**EN**

> The exact price is fixed by our server and held for 30 minutes.

**Было**

> Den genauen Preis legt unser Server fest und hält ihn 30 Minuten lang.

**Стало**

> Den genauen Preis legt unser Server fest und reserviert ihn 30 Minuten lang.

**Причина:** Fluency/consistency: «einen Preis halten» is a calque of «hold a price»; the same window says «Preis reserviert für {time}».

**Независимые проверки:** linguistic A0001 (fluency, мелко, 0.75); fidelity A0015 (consistency, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### ui:checkout.emailNote · мелко

checkout window (country page → plan) — [на сайте](https://magicesim.store/de/esim/thailand/)

**EN**

> Not sent or saved anywhere yet — payment isn't available.

**Было**

> Wird noch nirgends gesendet oder gespeichert – eine Zahlung ist noch nicht möglich.

**Стало**

> Wird noch nirgendwohin gesendet und nirgends gespeichert – eine Zahlung ist noch nicht möglich.

**Причина:** Grammar/fluency: «nirgends» is locative and does not combine with «senden» (direction needs «nirgendwohin»).

**Независимые проверки:** linguistic A0002 (fluency, мелко, 0.65) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:faq1.a · важно

guide «How to install an eSIM on iPhone», answer 1 — [на сайте](https://magicesim.store/de/guides/iphone/#faq)

**EN**

> You need an internet connection to download the profile, and Wi-Fi is the easiest. Installing on the day you travel, before you leave home or on airport Wi-Fi, works whatever the plan's rules for when its validity starts.

**Было**

> Du brauchst eine Internetverbindung, um das Profil herunterzuladen, am einfachsten über WLAN. Wenn du sie am Reisetag installierst – zu Hause vor dem Aufbruch oder im WLAN des Flughafens –, passt das zu jedem Tarif, egal wann seine Gültigkeit beginnt.

**Стало**

> Du brauchst eine Internetverbindung, um das Profil herunterzuladen, am einfachsten über WLAN. Wenn du die eSIM am Reisetag installierst – zu Hause vor dem Aufbruch oder im WLAN des Flughafens –, passt das zu jedem Tarif, egal wann seine Gültigkeit beginnt.

**Причина:** Grammar/accuracy: «sie» can only refer to «Internetverbindung», so the sentence says to install the connection; the English means the eSIM.

**Независимые проверки:** linguistic A0004 (grammar, важно, 0.85); fidelity A0019 (accuracy, мелко, 0.6) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:faq1.a · важно

guide «When to install and turn on your eSIM», answer 1 — [на сайте](https://magicesim.store/de/guides/activation/#faq)

**EN**

> It depends on the plan: some start counting at installation, others on the first connection or the first data used at the destination. To be safe with any plan, install on the day you travel.

**Было**

> Das hängt vom Tarif ab: Manche beginnen mit der Installation, andere mit der ersten Verbindung oder der ersten Datennutzung am Reiseziel. Um bei jedem Tarif auf der sicheren Seite zu sein, installiere sie am Reisetag.

**Стало**

> Das hängt vom Tarif ab: Manche beginnen mit der Installation, andere mit der ersten Verbindung oder der ersten Datennutzung am Reiseziel. Um bei jedem Tarif auf der sicheren Seite zu sein, installiere die eSIM am Reisetag.

**Причина:** Grammar/accuracy: «installiere sie» has no eSIM antecedent in the answer and points to a feminine noun like «Datennutzung». The same ambiguous «sie» in guide-activation:s2.body and :lead (not in this input) should be fixed the same way.

**Независимые проверки:** linguistic A0005 (grammar, важно, 0.8) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:faq2.a · мелко

guide «When to install and turn on your eSIM», answer 2 — [на сайте](https://magicesim.store/de/guides/activation/#faq)

**EN**

> The switch itself charges nothing; it only allows the line to use partner networks. What matters is which line is chosen for mobile data, and your plan's terms.

**Было**

> Der Schalter selbst kostet nichts; er erlaubt der Leitung nur, Partnernetze zu nutzen. Entscheidend ist, welche Leitung für mobile Daten gewählt ist, und was dein Tarif vorsieht.

**Стало**

> Der Schalter selbst kostet nichts; er erlaubt der Leitung nur, Partnernetze zu nutzen. Entscheidend ist, welche Leitung für mobile Daten gewählt ist und was dein Tarif vorsieht.

**Причина:** Punctuation: no comma between two subordinate clauses joined by «und» (amtliches Regelwerk § 72).

**Независимые проверки:** linguistic A0006 (punctuation, мелко, 0.85) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-iphone:s4.body · мелко

guide «How to install an eSIM on iPhone», section 4 — [на сайте](https://magicesim.store/de/guides/iphone/#data)

**EN**

> • In **Settings → Cellular**, make sure the eSIM line is turned on.
> • Tap **Cellular Data** and choose the eSIM line. Your main SIM can stay on for calls and texts.
> • Open the eSIM line and turn on **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.
> Menu names can differ slightly between iOS versions.

**Было**

> • Prüfe unter **Einstellungen → Mobilfunk**, ob die eSIM-Leitung eingeschaltet ist.
> • Tippe auf **Mobile Daten** und wähle die eSIM-Leitung. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.
> • Öffne die eSIM-Leitung und schalte das Datenroaming ein. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.
> • Wenn du keine Kosten bei deinem eigenen Mobilfunkanbieter möchtest, schalte das Datenroaming auf deiner Haupt-SIM aus.
> • Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.
> Die Menübezeichnungen können je nach iOS-Version etwas abweichen.

**Стало**

> • Prüfe unter **Einstellungen → Mobilfunk**, ob die eSIM-Leitung eingeschaltet ist.
> • Tippe auf **Mobile Daten** und wähle die eSIM-Leitung. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.
> • Öffne die eSIM-Leitung und schalte das Datenroaming ein. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.
> • Wenn bei deinem eigenen Mobilfunkanbieter keine Kosten anfallen sollen, schalte das Datenroaming auf deiner Haupt-SIM aus.
> • Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.
> Die Menübezeichnungen können je nach iOS-Version etwas abweichen.

**Причина:** Fluency: «keine Kosten … möchtest» is unnatural; costs «fallen an».

**Независимые проверки:** linguistic A0007 (fluency, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:s1.body · мелко

guide «When to install and turn on your eSIM», section 1 — [на сайте](https://magicesim.store/de/guides/activation/#steps)

**EN**

> • **Installing** — the phone downloads the eSIM profile with the QR code. Needs internet.
> • **Turning the line on** — the eSIM appears in your SIM list as active.
> • **Choosing it for mobile data** — internet goes through the eSIM.
> • **Turning on data roaming** for the eSIM — lets it use partner networks abroad.

**Было**

> • **Installieren**: Das Telefon lädt das eSIM-Profil über den QR-Code herunter. Dafür braucht es Internet.
> • **Leitung einschalten**: Die eSIM erscheint in deiner SIM-Liste als aktiv.
> • **Für mobile Daten wählen**: Das Internet läuft über die eSIM.
> • **Datenroaming einschalten** auf der eSIM: Damit kann sie im Ausland Partnernetze nutzen.

**Стало**

> • **Installieren**: Das Telefon lädt das eSIM-Profil über den QR-Code herunter. Dafür braucht es Internet.
> • **Leitung einschalten**: Die eSIM erscheint in deiner SIM-Liste als aktiv.
> • **Für mobile Daten wählen**: Das Internet läuft über die eSIM.
> • Auf der eSIM **Datenroaming einschalten**: Damit kann sie im Ausland Partnernetze nutzen.

**Причина:** Word order: in a German infinitive phrase the infinitive comes last; «einschalten auf der eSIM» follows English order.

**Независимые проверки:** linguistic A0010 (fluency, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-troubleshooting:faq3.q · мелко

guide «eSIM not working — what to check», question 3 — [на сайте](https://magicesim.store/de/guides/troubleshooting/#faq)

**EN**

> Will my main SIM get charged while I troubleshoot?

**Было**

> Berechnet mir meine Haupt-SIM etwas, während ich nach dem Fehler suche?

**Стало**

> Fallen auf meiner Haupt-SIM Kosten an, während ich nach dem Fehler suche?

**Причина:** Fluency: a SIM does not «berechnen» anything; «Kosten fallen an» is the normal phrasing and keeps the English meaning.

**Независимые проверки:** linguistic A0011 (fluency, мелко, 0.65) · плейсхолдеры сохранены · на сайте именно этот текст

### page:guidesDescription · мелко

guides — [на сайте](https://magicesim.store/de/guides/)

**EN**

> How to install a travel eSIM on iPhone and Android, check that your phone supports it, when to install it and what to do if it does not work.

**Было**

> So installierst du eine Reise-eSIM auf iPhone und Android, prüfst dein Smartphone, wählst den richtigen Zeitpunkt und löst Probleme.

**Стало**

> So installierst du eine Reise-eSIM auf iPhone und Android, prüfst, ob dein Smartphone sie unterstützt, wählst den richtigen Zeitpunkt und löst Probleme.

**Причина:** Accuracy (rule 1): the English says what is checked — that the phone supports an eSIM; «prüfst dein Smartphone» loses that object. 152 characters, within budget.

**Независимые проверки:** fidelity A0016 (accuracy, мелко, 0.75) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-android:s3.body · мелко

guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/de/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Было**

> • Prüfe, ob die eSIM eingeschaltet ist. Pixel: Einstellungen → Netzwerk &amp; Internet → Mobilfunknetz → die eSIM → **Diese SIM verwenden**.
> • Wähle die eSIM als SIM für **mobile Daten**. Pixel: Einstellungen → Netzwerk &amp; Internet → SIM-Karten → **Mobile Daten**. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.
> • Schalte **Roaming** für die eSIM ein. Pixel: Einstellungen → Netzwerk &amp; Internet → SIM-Karten → **Roaming**. Samsung: Such die Einstellung in den Mobilfunknetz-Einstellungen unter Verbindungen; der genaue Name hängt vom Modell ab. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.
> • Wenn du keine Kosten bei deinem eigenen Mobilfunkanbieter möchtest, schalte das Datenroaming auf deiner Haupt-SIM aus.
> • Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.

**Стало**

> • Prüfe, ob die eSIM eingeschaltet ist. Pixel: Einstellungen → Netzwerk &amp; Internet → Mobilfunknetz → die eSIM → **Diese SIM verwenden**.
> • Wähle die eSIM als SIM für **mobile Daten**. Pixel: Einstellungen → Netzwerk &amp; Internet → SIM-Karten → **Mobile Daten**. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.
> • Schalte **Roaming** für die eSIM ein. Pixel: Einstellungen → Netzwerk &amp; Internet → SIM-Karten → **Roaming**. Samsung: Such die Einstellung in den Mobilfunknetz-Einstellungen unter Verbindungen; der genaue Name hängt vom Modell ab. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.
> • Wenn bei deinem eigenen Mobilfunkanbieter keine Kosten anfallen sollen, schalte das Datenroaming auf deiner Haupt-SIM aus.
> • Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.

**Причина:** The added Pixel roaming path is sourced (platform-labels.md, page 2926415) and makes no claim, and the Samsung path is correctly described instead of quoted, so F0007 is kept as is. The «keine Kosten … möchtest» phrasing L0007 flags «also in» this string is fixed («Kosten fallen an»).

**Независимые проверки:** fidelity A0021 (accuracy, мелко, 0.55) · плейсхолдеры сохранены · на сайте именно этот текст

### guide-activation:s5.h2 · мелко

guide «When to install and turn on your eSIM», section 5 heading (H2) — [на сайте](https://magicesim.store/de/guides/activation/#no-wifi)

**EN**

> Landed without the eSIM installed and no Wi-Fi?

**Было**

> Gelandet, ohne eSIM und ohne WLAN?

**Стало**

> Gelandet, ohne installierte eSIM und ohne WLAN?

**Причина:** Accuracy: «ohne eSIM» says the reader has no eSIM; the English means one bought but not installed.

**Независимые проверки:** fidelity A0024 (accuracy, мелко, 0.7) · плейсхолдеры сохранены · на сайте именно этот текст

### Стилистика — записано, не применяется

- ui:home.typesLead: The current wording is correct; the reading «gleich = sofort» is unlikely in context. Recorded as a stylistic option only.
- guide-iphone:s5.body: «die eSIM … Datenroaming eingeschaltet hat» is grammatical and understood; the suggestion is a stylistic refinement, not a correction.
- countries:BN: «Brunei Darussalam» is the correct official German name; «Brunei» would be shorter and match the English and search usage, but that is a naming/SEO preference for the country-names overrides, not an error.
- guide-compatibility:lead: «einfachste» vs «quickest» is a slight nuance; the instruction and facts are unchanged. Stylistic option only.
- guide-activation:title: «aktivieren» is a correct rendering of «turn on» and a likely search term; aligning with the body's «einschalten» is a terminology preference, not an error.

### Оставлено как есть

- ui:preview.title: False positive: «Tarifdetails» contains the glossary term «Tarif» as a compound.
- page:planTypes: False positive: «Tarifarten» contains the glossary term «Tarif» as a compound.
- guide-iphone:s2.body: C0006 is a false positive («Mobilfunktarif»). «Kamera» is the iPhone camera app's German name; F0004 asks for a source, it shows no error — add Apple's page to platform-labels.md rather than change the copy.
- guide-iphone:s3.body: False positive: «Mobilfunktarif hinzufügen» carries «Tarif».
- countries:CV: «Cabo Verde» is the official German short name (Auswärtiges Amt) and correct; both reviewers rate the change preferential.
- guide-troubleshooting:faq1.q: „Kein Netz“ is the German iOS status text for «No Service»; the finding asks for a source and shows no error — add the vendor source to platform-labels.md.

## Все замечания этапов

## page

### C0001 · важно · terminology · уверенность 0.9 · check · объективное

`homeDescription` — home — [на сайте](https://magicesim.store/de/)

**EN**

> Pick a destination, install an eSIM and land connected. Magic eSIM covers 190+ destinations with no plastic SIM and no airport queue.

**Сейчас**

> Wähle ein Reiseziel, installiere eine eSIM und sei nach der Landung online. Über 190 Reiseziele, ohne Plastik-SIM und ohne Warteschlange am Flughafen.

**Почему:** «Magic eSIM» is never translated or altered, and it is missing here. · правило `do-not-translate` · check

### A0016 · мелко · accuracy · уверенность 0.75 · fidelity · объективное

`guidesDescription` — guides — [на сайте](https://magicesim.store/de/guides/)

**EN**

> How to install a travel eSIM on iPhone and Android, check that your phone supports it, when to install it and what to do if it does not work.

**Сейчас**

> So installierst du eine Reise-eSIM auf iPhone und Android, prüfst dein Smartphone, wählst den richtigen Zeitpunkt und löst Probleme.

**Предложение**

> So installierst du eine Reise-eSIM auf iPhone und Android, prüfst, ob dein Smartphone sie unterstützt, wählst den richtigen Zeitpunkt und löst Probleme.

**Почему:** Accuracy (rule 1): the English says what is checked – that the phone supports an eSIM (the compatibility guide); «prüfst dein Smartphone» drops that object and reads as a generic device check. The suggestion restores it and stays within the 160-character budget (152). · правило `fidelity: information lost` · ai

### C0004 · мелко · consistency · уверенность 0.55 · check · объективное

`planTypes` — country page (sample: Thailand) — [на сайте](https://magicesim.store/de/esim/thailand/)

**EN**

> Plan types

**Сейчас**

> Tarifarten

**Почему:** The source says «plan»; elsewhere it is «Tarif», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

## guide-iphone

### A0004 · важно · grammar · уверенность 0.85 · linguistic · объективное

`faq1.a` — guide «How to install an eSIM on iPhone», answer 1 — [на сайте](https://magicesim.store/de/guides/iphone/#faq)

**EN**

> You need an internet connection to download the profile, and Wi-Fi is the easiest. Installing on the day you travel, before you leave home or on airport Wi-Fi, works whatever the plan's rules for when its validity starts.

**Сейчас**

> Du brauchst eine Internetverbindung, um das Profil herunterzuladen, am einfachsten über WLAN. Wenn du sie am Reisetag installierst – zu Hause vor dem Aufbruch oder im WLAN des Flughafens –, passt das zu jedem Tarif, egal wann seine Gültigkeit beginnt.

**Предложение**

> Du brauchst eine Internetverbindung, um das Profil herunterzuladen, am einfachsten über WLAN. Wenn du die eSIM am Reisetag installierst – zu Hause vor dem Aufbruch oder im WLAN des Flughafens –, passt das zu jedem Tarif, egal wann seine Gültigkeit beginnt.

**Почему:** The pronoun «sie» has no valid antecedent: the nearest feminine noun is «Internetverbindung» (the eSIM is named only in the question), so the sentence literally says to install the connection. Name the eSIM. · правило `pronoun reference` · ai

### A0017 · мелко · accuracy · уверенность 0.75 · fidelity · объективное

`s1.body` — guide «How to install an eSIM on iPhone», section 1 — [на сайте](https://magicesim.store/de/guides/iphone/#check)

**EN**

> Open **Settings → Cellular** (called **Mobile Data** in some regions). If you see **Add eSIM** or **Add Cellular Plan**, your iPhone supports eSIM.
> Your iPhone must also not be locked to one carrier. See how to check compatibility.

**Сейчас**

> Öffne **Einstellungen → Mobilfunk**. Wenn du dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** siehst, unterstützt dein iPhone eSIM.
> Außerdem darf dein iPhone keinen SIM-Lock eines Mobilfunkanbieters haben. Lies dazu, wie du die Kompatibilität prüfst.

**Предложение**

> Öffne **Einstellungen → Mobilfunk** (in manchen Regionen **Mobile Daten**). Wenn du dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** siehst, unterstützt dein iPhone eSIM.
> Außerdem darf dein iPhone keinen SIM-Lock eines Mobilfunkanbieters haben. Lies dazu, wie du die Kompatibilität prüfst.

**Почему:** The English names the regional alternative label («called Mobile Data in some regions»); the German drops it, although platform-labels.md lists «Mobilfunk (bzw. Mobile Daten)» and s3.body of the same guide keeps «(bzw. **Mobile Daten**)». A reader whose iPhone shows «Mobile Daten» loses the hint. · правило `fidelity: nothing dropped` · ai

### A0007 · мелко · fluency · уверенность 0.7 · linguistic

`s4.body` — guide «How to install an eSIM on iPhone», section 4 — [на сайте](https://magicesim.store/de/guides/iphone/#data)

**EN**

> • In **Settings → Cellular**, make sure the eSIM line is turned on.
> • Tap **Cellular Data** and choose the eSIM line. Your main SIM can stay on for calls and texts.
> • Open the eSIM line and turn on **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.
> Menu names can differ slightly between iOS versions.

**Сейчас**

> • Prüfe unter **Einstellungen → Mobilfunk**, ob die eSIM-Leitung eingeschaltet ist.
> • Tippe auf **Mobile Daten** und wähle die eSIM-Leitung. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.
> • Öffne die eSIM-Leitung und schalte das Datenroaming ein. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.
> • Wenn du keine Kosten bei deinem eigenen Mobilfunkanbieter möchtest, schalte das Datenroaming auf deiner Haupt-SIM aus.
> • Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.
> Die Menübezeichnungen können je nach iOS-Version etwas abweichen.

**Предложение**

> • Prüfe unter **Einstellungen → Mobilfunk**, ob die eSIM-Leitung eingeschaltet ist.
> • Tippe auf **Mobile Daten** und wähle die eSIM-Leitung. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.
> • Öffne die eSIM-Leitung und schalte das Datenroaming ein. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.
> • Wenn bei deinem eigenen Mobilfunkanbieter keine Kosten anfallen sollen, schalte das Datenroaming auf deiner Haupt-SIM aus.
> • Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.
> Die Menübezeichnungen können je nach iOS-Version etwas abweichen.

**Почему:** «keine Kosten … möchtest» is unnatural German; costs «fallen an». Same sentence also in guide-android:s3.body. · правило `natural phrasing` · ai

### A0019 · мелко · accuracy · уверенность 0.6 · fidelity · объективное

`faq1.a` — guide «How to install an eSIM on iPhone», answer 1 — [на сайте](https://magicesim.store/de/guides/iphone/#faq)

**EN**

> You need an internet connection to download the profile, and Wi-Fi is the easiest. Installing on the day you travel, before you leave home or on airport Wi-Fi, works whatever the plan's rules for when its validity starts.

**Сейчас**

> Du brauchst eine Internetverbindung, um das Profil herunterzuladen, am einfachsten über WLAN. Wenn du sie am Reisetag installierst – zu Hause vor dem Aufbruch oder im WLAN des Flughafens –, passt das zu jedem Tarif, egal wann seine Gültigkeit beginnt.

**Предложение**

> Du brauchst eine Internetverbindung, um das Profil herunterzuladen, am einfachsten über WLAN. Wenn du die eSIM am Reisetag installierst – zu Hause vor dem Aufbruch oder im WLAN des Flughafens –, passt das zu jedem Tarif, egal wann seine Gültigkeit beginnt.

**Почему:** «Wenn du sie am Reisetag installierst» — the nearest feminine antecedent is «eine Internetverbindung», so «sie» reads as installing the connection; the English means installing the eSIM. Naming the eSIM restores the meaning. · правило `fidelity: who/what does what` · ai

### A0012 · мелко · fluency · уверенность 0.6 · linguistic

`s5.body` — guide «How to install an eSIM on iPhone», section 5 — [на сайте](https://magicesim.store/de/guides/iphone/#help)

**EN**

> Check that the eSIM is the line chosen for cellular data and that data roaming is on for it, then restart the phone. The full checklist is in eSIM not working.
> **Do not delete the eSIM** while troubleshooting: its QR code may be single-use, and you may not be able to install it again.

**Сейчас**

> Prüfe, ob die eSIM als Leitung für mobile Daten gewählt ist und Datenroaming eingeschaltet hat, und starte das Telefon neu. Die vollständige Liste findest du unter Die eSIM funktioniert nicht.
> **Lösche die eSIM nicht**, während du nach dem Fehler suchst: Ihr QR-Code ist möglicherweise nur einmal verwendbar, und du kannst sie dann eventuell nicht erneut installieren.

**Предложение**

> Prüfe, ob die eSIM als Leitung für mobile Daten gewählt ist und Datenroaming für sie eingeschaltet ist, und starte das Telefon neu. Die vollständige Liste findest du unter Die eSIM funktioniert nicht.
> **Lösche die eSIM nicht**, während du nach dem Fehler suchst: Ihr QR-Code ist möglicherweise nur einmal verwendbar, und du kannst sie dann eventuell nicht erneut installieren.

**Почему:** The eSIM is made the agent («die eSIM … Datenroaming eingeschaltet hat»), as if it switched roaming on itself; German says the setting «ist eingeschaltet». Same construction in guide-troubleshooting:faq3.a («die Haupt-SIM … Datenroaming eingeschaltet hat»). · правило `natural phrasing` · ai

### C0002 · мелко · consistency · уверенность 0.55 · check · объективное

`s1.body` — guide «How to install an eSIM on iPhone», section 1 — [на сайте](https://magicesim.store/de/guides/iphone/#check)

**EN**

> Open **Settings → Cellular** (called **Mobile Data** in some regions). If you see **Add eSIM** or **Add Cellular Plan**, your iPhone supports eSIM.
> Your iPhone must also not be locked to one carrier. See how to check compatibility.

**Сейчас**

> Öffne **Einstellungen → Mobilfunk**. Wenn du dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** siehst, unterstützt dein iPhone eSIM.
> Außerdem darf dein iPhone keinen SIM-Lock eines Mobilfunkanbieters haben. Lies dazu, wie du die Kompatibilität prüfst.

**Почему:** The source says «mobile data»; elsewhere it is «mobile Daten», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:mobile data` · check

### C0006 · мелко · consistency · уверенность 0.55 · check · объективное

`s2.body` — guide «How to install an eSIM on iPhone», section 2 — [на сайте](https://magicesim.store/de/guides/iphone/#qr)

**EN**

> • Show your eSIM's QR code on another screen: a computer, a tablet or a second phone.
> • On the iPhone, open the **Camera** app and scan the QR code.
> • When the **Cellular Plan Detected** notification appears, tap it.
> • Tap **Continue**, then **Add Cellular Plan**. If you are asked for a confirmation code, enter the one provided with your eSIM.
> • Give the line a clear name, such as «Travel», so you do not mix it up with your main SIM.
> With iOS 17.4 or later, if the QR code is in an email or on a web page on the iPhone itself, touch and hold the code, then tap **Add eSIM**.

**Сейчас**

> • Zeig den QR-Code deiner eSIM auf einem anderen Bildschirm an: auf einem Computer, einem Tablet oder einem anderen Smartphone.
> • Öffne auf dem iPhone die **Kamera**-App und scanne den QR-Code.
> • Wenn die Mitteilung **Mobilfunktarif erkannt** erscheint, tippe darauf.
> • Tippe auf **Weiter** und dann auf **Mobilfunktarif hinzufügen**. Wenn du nach einem Bestätigungscode gefragt wirst, gib den Code ein, der zu deiner eSIM angegeben ist.
> • Gib der Leitung einen eindeutigen Namen, zum Beispiel „Reise“, damit du sie nicht mit deiner Haupt-SIM verwechselst.
> Ab iOS 17.4: Wenn der QR-Code in einer E-Mail oder auf einer Webseite auf diesem iPhone ist, halte den Code gedrückt und tippe auf **eSIM hinzufügen**.

**Почему:** The source says «plan»; elsewhere it is «Tarif», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

### C0007 · мелко · consistency · уверенность 0.55 · check · объективное

`s3.body` — guide «How to install an eSIM on iPhone», section 3 — [на сайте](https://magicesim.store/de/guides/iphone/#manual)

**EN**

> • Find the details for manual installation that come with your eSIM.
> • Open **Settings → Cellular** (or **Mobile Data**) and tap **Add Cellular Plan**.
> • Tap **Enter Details Manually** and type in those details.
> • Confirm, and wait until the installation finishes.
> Useful when there is no QR code to scan.

**Сейчас**

> • Halte die Daten für die manuelle Installation bereit, die zu deiner eSIM gehören.
> • Öffne **Einstellungen → Mobilfunk** (bzw. **Mobile Daten**) und tippe auf **Mobilfunktarif hinzufügen**.
> • Tippe auf **Details manuell eingeben** und gib diese Daten ein.
> • Bestätige und warte, bis die Installation abgeschlossen ist.
> Praktisch, wenn du keinen QR-Code zum Scannen hast.

**Почему:** The source says «plan»; elsewhere it is «Tarif», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

### A0018 · мелко · platform-label · уверенность 0.5 · fidelity

`s2.body` — guide «How to install an eSIM on iPhone», section 2 — [на сайте](https://magicesim.store/de/guides/iphone/#qr)

**EN**

> • Show your eSIM's QR code on another screen: a computer, a tablet or a second phone.
> • On the iPhone, open the **Camera** app and scan the QR code.
> • When the **Cellular Plan Detected** notification appears, tap it.
> • Tap **Continue**, then **Add Cellular Plan**. If you are asked for a confirmation code, enter the one provided with your eSIM.
> • Give the line a clear name, such as «Travel», so you do not mix it up with your main SIM.
> With iOS 17.4 or later, if the QR code is in an email or on a web page on the iPhone itself, touch and hold the code, then tap **Add eSIM**.

**Сейчас**

> • Zeig den QR-Code deiner eSIM auf einem anderen Bildschirm an: auf einem Computer, einem Tablet oder einem anderen Smartphone.
> • Öffne auf dem iPhone die **Kamera**-App und scanne den QR-Code.
> • Wenn die Mitteilung **Mobilfunktarif erkannt** erscheint, tippe darauf.
> • Tippe auf **Weiter** und dann auf **Mobilfunktarif hinzufügen**. Wenn du nach einem Bestätigungscode gefragt wirst, gib den Code ein, der zu deiner eSIM angegeben ist.
> • Gib der Leitung einen eindeutigen Namen, zum Beispiel „Reise“, damit du sie nicht mit deiner Haupt-SIM verwechselst.
> Ab iOS 17.4: Wenn der QR-Code in einer E-Mail oder auf einer Webseite auf diesem iPhone ist, halte den Code gedrückt und tippe auf **eSIM hinzufügen**.

**Почему:** «**Kamera**» is quoted as an on-screen label (the Camera app) but is not in references/de/platform-labels.md. Very likely correct, but per the rubric a label needs a vendor source: add Apple's German page for it or describe the app without bold. · правило `labels are evidence-bound (rubric rule 4)` · ai

## guide-activation

### A0005 · важно · grammar · уверенность 0.8 · linguistic · объективное

`faq1.a` — guide «When to install and turn on your eSIM», answer 1 — [на сайте](https://magicesim.store/de/guides/activation/#faq)

**EN**

> It depends on the plan: some start counting at installation, others on the first connection or the first data used at the destination. To be safe with any plan, install on the day you travel.

**Сейчас**

> Das hängt vom Tarif ab: Manche beginnen mit der Installation, andere mit der ersten Verbindung oder der ersten Datennutzung am Reiseziel. Um bei jedem Tarif auf der sicheren Seite zu sein, installiere sie am Reisetag.

**Предложение**

> Das hängt vom Tarif ab: Manche beginnen mit der Installation, andere mit der ersten Verbindung oder der ersten Datennutzung am Reiseziel. Um bei jedem Tarif auf der sicheren Seite zu sein, installiere die eSIM am Reisetag.

**Почему:** The answer never names the eSIM; «sie» can only refer back to the feminine nouns of the answer («Installation», «Verbindung», «Datennutzung»). Same ambiguous «Installiere sie» also in guide-activation:s2.body (antecedent «sie» = «die Gültigkeit» in the previous sentence) and guide-activation:lead (nearest feminine noun «die Gültigkeit»); naming «die eSIM» there fixes it too. · правило `pronoun reference` · ai

### A0006 · мелко · punctuation · уверенность 0.85 · linguistic · объективное

`faq2.a` — guide «When to install and turn on your eSIM», answer 2 — [на сайте](https://magicesim.store/de/guides/activation/#faq)

**EN**

> The switch itself charges nothing; it only allows the line to use partner networks. What matters is which line is chosen for mobile data, and your plan's terms.

**Сейчас**

> Der Schalter selbst kostet nichts; er erlaubt der Leitung nur, Partnernetze zu nutzen. Entscheidend ist, welche Leitung für mobile Daten gewählt ist, und was dein Tarif vorsieht.

**Предложение**

> Der Schalter selbst kostet nichts; er erlaubt der Leitung nur, Partnernetze zu nutzen. Entscheidend ist, welche Leitung für mobile Daten gewählt ist und was dein Tarif vorsieht.

**Почему:** Two coordinated subordinate clauses joined by «und» take no comma between them (§ 72 amtliches Regelwerk); the comma is wrong. · правило `no comma before coordinating und` · ai

### A0010 · мелко · fluency · уверенность 0.7 · linguistic

`s1.body` — guide «When to install and turn on your eSIM», section 1 — [на сайте](https://magicesim.store/de/guides/activation/#steps)

**EN**

> • **Installing** — the phone downloads the eSIM profile with the QR code. Needs internet.
> • **Turning the line on** — the eSIM appears in your SIM list as active.
> • **Choosing it for mobile data** — internet goes through the eSIM.
> • **Turning on data roaming** for the eSIM — lets it use partner networks abroad.

**Сейчас**

> • **Installieren**: Das Telefon lädt das eSIM-Profil über den QR-Code herunter. Dafür braucht es Internet.
> • **Leitung einschalten**: Die eSIM erscheint in deiner SIM-Liste als aktiv.
> • **Für mobile Daten wählen**: Das Internet läuft über die eSIM.
> • **Datenroaming einschalten** auf der eSIM: Damit kann sie im Ausland Partnernetze nutzen.

**Предложение**

> • **Installieren**: Das Telefon lädt das eSIM-Profil über den QR-Code herunter. Dafür braucht es Internet.
> • **Leitung einschalten**: Die eSIM erscheint in deiner SIM-Liste als aktiv.
> • **Für mobile Daten wählen**: Das Internet läuft über die eSIM.
> • Auf der eSIM **Datenroaming einschalten**: Damit kann sie im Ausland Partnernetze nutzen.

**Почему:** In a German infinitive phrase the infinitive comes last; «einschalten auf der eSIM» reads as an English word order. Moving «Auf der eSIM» in front keeps the bold label intact. · правило `word order of infinitive phrase` · ai

### A0024 · мелко · accuracy · уверенность 0.7 · fidelity · объективное

`s5.h2` — guide «When to install and turn on your eSIM», section 5 heading (H2) — [на сайте](https://magicesim.store/de/guides/activation/#no-wifi)

**EN**

> Landed without the eSIM installed and no Wi-Fi?

**Сейчас**

> Gelandet, ohne eSIM und ohne WLAN?

**Предложение**

> Gelandet, eSIM nicht installiert und kein WLAN?

**Почему:** English: landed «without the eSIM installed»; German «ohne eSIM» says the reader has no eSIM at all (not bought), which is a different situation from the one the section answers (eSIM bought, profile not yet downloaded). · правило `fidelity: condition kept` · ai

### A0023 · мелко · terminology · уверенность 0.55 · fidelity

`title` — guide «When to install and turn on your eSIM» — [на сайте](https://magicesim.store/de/guides/activation/)

**EN**

> When to install and turn on a travel eSIM | Magic eSIM

**Сейчас**

> Reise-eSIM: wann installieren und aktivieren? | Magic eSIM

**Предложение**

> Reise-eSIM: wann installieren und einschalten? | Magic eSIM

**Почему:** The guide's whole point is that installing and starting the validity are different; English says «turn on» (switch the line on). «aktivieren» is the word German readers associate with eSIM activation, i.e. the start of the plan — «einschalten» (as the body uses) keeps the distinction. 59 characters, within the 60 budget. Also in guide-activation:h1 («… installierst und aktivierst» → «… installierst und einschaltest»). · правило `terminology: keep the install / switch on / validity distinction` · ai

## ui

### A0001 · мелко · fluency · уверенность 0.75 · linguistic

`quote.explain` — checkout window (country page → plan) — [на сайте](https://magicesim.store/de/esim/thailand/)

**EN**

> The exact price is fixed by our server and held for 30 minutes.

**Сейчас**

> Den genauen Preis legt unser Server fest und hält ihn 30 Minuten lang.

**Предложение**

> Den genauen Preis legt unser Server fest und reserviert ihn 30 Minuten lang.

**Почему:** «einen Preis halten» is a calque of «hold a price»; German says a price is «reserviert» (as the site itself does in ui:quote.heldFor «Preis reserviert für {time}»). · правило `natural phrasing / calque` · ai

### A0002 · мелко · fluency · уверенность 0.65 · linguistic

`checkout.emailNote` — checkout window (country page → plan) — [на сайте](https://magicesim.store/de/esim/thailand/)

**EN**

> Not sent or saved anywhere yet — payment isn't available.

**Сейчас**

> Wird noch nirgends gesendet oder gespeichert – eine Zahlung ist noch nicht möglich.

**Предложение**

> Wird noch nirgendwohin gesendet und nirgends gespeichert – eine Zahlung ist noch nicht möglich.

**Почему:** «nirgends» denotes a location and does not combine naturally with «senden» (direction → «nirgendwohin»); the shared adverb reads awkwardly to a native. · правило `adverb of direction vs. location` · ai

### A0015 · мелко · consistency · уверенность 0.6 · fidelity

`quote.explain` — checkout window (country page → plan) — [на сайте](https://magicesim.store/de/esim/thailand/)

**EN**

> The exact price is fixed by our server and held for 30 minutes.

**Сейчас**

> Den genauen Preis legt unser Server fest und hält ihn 30 Minuten lang.

**Предложение**

> Den genauen Preis legt unser Server fest und reserviert ihn 30 Minuten lang.

**Почему:** «held» is rendered «hält» here but «reserviert» in ui:quote.heldFor («Preis reserviert für {time}»); the same concept in the same window reads two ways, and «reserviert» states the 30-minute hold more clearly. Meaning is intact — a consistency nuance. · правило `consistency: one source term, one translation within the batch` · ai

### C0003 · мелко · consistency · уверенность 0.55 · check · объективное

`preview.title` — payment notice under the header — [на сайте](https://magicesim.store/de/esim/thailand/)

**EN**

> Plan details

**Сейчас**

> Tarifdetails

**Почему:** The source says «plan»; elsewhere it is «Tarif», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

### A0003 · на вкус · fluency · уверенность 0.6 · linguistic

`home.typesLead` — home — [на сайте](https://magicesim.store/de/)

**EN**

> Every destination page groups its plans the same way, so you can compare like with like.

**Сейчас**

> Jede Reiseziel-Seite ordnet ihre Tarife gleich an, damit du Gleiches mit Gleichem vergleichen kannst.

**Предложение**

> Jede Reiseziel-Seite ordnet ihre Tarife auf die gleiche Weise an, damit du Gleiches mit Gleichem vergleichen kannst.

**Почему:** «gleich an(ordnen)» can be read as «immediately»; «auf die gleiche Weise» states «the same way» unambiguously. · правило `ambiguity` · ai

## guide-android

### A0008 · мелко · fluency · уверенность 0.7 · linguistic

`s1.body` — guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/de/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM manager → **Add eSIM** (on older One UI versions: SIM card manager → **Add mobile plan**).
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Сейчас**

> Die SIM-Einstellungen liegen meist an einer dieser Stellen; die Namen hängen von Marke und Android-Version ab:
> • **Google Pixel:** Einstellungen → Netzwerk &amp; Internet → SIMs (oder SIM-Karten) → **SIM hinzufügen** → **eSIM einrichten**.
> • **Samsung Galaxy:** Einstellungen → Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> • **Andere Marken:** Such in den Einstellungen nach „Mobilfunknetz“, „SIM-Karten“ oder „Verbindungen“.
> Wenn du nirgends eine Option zum Hinzufügen einer eSIM findest, lies, ob dein Smartphone eSIM unterstützt.

**Предложение**

> Die SIM-Einstellungen liegen meist an einer dieser Stellen; die Namen hängen von Marke und Android-Version ab:
> • **Google Pixel:** Einstellungen → Netzwerk &amp; Internet → SIMs (oder SIM-Karten) → **SIM hinzufügen** → **eSIM einrichten**.
> • **Samsung Galaxy:** Einstellungen → Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> • **Andere Marken:** Such in den Einstellungen nach „Mobilfunknetz“, „SIM-Karten“ oder „Verbindungen“.
> Wenn du nirgends eine Option zum Hinzufügen einer eSIM findest, lies nach, ob dein Smartphone eSIM unterstützt.

**Почему:** «lesen, ob …» is not idiomatic; checking something in a text is «nachlesen, ob …». · правило `verb choice` · ai

### C0008 · мелко · consistency · уверенность 0.55 · check · объективное

`s1.body` — guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/de/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM manager → **Add eSIM** (on older One UI versions: SIM card manager → **Add mobile plan**).
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Сейчас**

> Die SIM-Einstellungen liegen meist an einer dieser Stellen; die Namen hängen von Marke und Android-Version ab:
> • **Google Pixel:** Einstellungen → Netzwerk &amp; Internet → SIMs (oder SIM-Karten) → **SIM hinzufügen** → **eSIM einrichten**.
> • **Samsung Galaxy:** Einstellungen → Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> • **Andere Marken:** Such in den Einstellungen nach „Mobilfunknetz“, „SIM-Karten“ oder „Verbindungen“.
> Wenn du nirgends eine Option zum Hinzufügen einer eSIM findest, lies, ob dein Smartphone eSIM unterstützt.

**Почему:** The source says «plan»; elsewhere it is «Tarif», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

### A0020 · мелко · accuracy · уверенность 0.55 · fidelity · объективное

`s1.body` — guide «How to install an eSIM on Android», section 1 — [на сайте](https://magicesim.store/de/guides/android/#find)

**EN**

> The SIM settings usually live in one of these places — names vary by brand and Android version:
> • **Google Pixel:** Settings → Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**.
> • **Samsung Galaxy:** Settings → Connections → SIM manager → **Add eSIM** (on older One UI versions: SIM card manager → **Add mobile plan**).
> • **Other brands:** look for «Mobile network», «SIM cards» or «Connections» in Settings.
> If there is no option to add an eSIM anywhere, check whether your phone supports eSIM.

**Сейчас**

> Die SIM-Einstellungen liegen meist an einer dieser Stellen; die Namen hängen von Marke und Android-Version ab:
> • **Google Pixel:** Einstellungen → Netzwerk &amp; Internet → SIMs (oder SIM-Karten) → **SIM hinzufügen** → **eSIM einrichten**.
> • **Samsung Galaxy:** Einstellungen → Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> • **Andere Marken:** Such in den Einstellungen nach „Mobilfunknetz“, „SIM-Karten“ oder „Verbindungen“.
> Wenn du nirgends eine Option zum Hinzufügen einer eSIM findest, lies, ob dein Smartphone eSIM unterstützt.

**Предложение**

> Die SIM-Einstellungen liegen meist an einer dieser Stellen; die Namen hängen von Marke und Android-Version ab:
> • **Google Pixel:** Einstellungen → Netzwerk &amp; Internet → SIMs (oder SIM-Karten) → **SIM hinzufügen** → **eSIM einrichten**.
> • **Samsung Galaxy:** Einstellungen → Verbindungen → SIM-Manager → **eSIM hinzufügen** (bei älteren One-UI-Versionen heißen Menü und Option anders).
> • **Andere Marken:** Such in den Einstellungen nach „Mobilfunknetz“, „SIM-Karten“ oder „Verbindungen“.
> Wenn du nirgends eine Option zum Hinzufügen einer eSIM findest, lies, ob dein Smartphone eSIM unterstützt.

**Почему:** The English gives the older One UI path for Samsung («on older One UI versions: SIM card manager → Add mobile plan»); the German drops it entirely. Those labels are not in platform-labels.md, so they must not be quoted — but the fact that older One UI versions name the menu differently can be said in words. Also in guide-android:s2.body (older One UI «Add using QR code» / the newer-versions condition on the activation code) and guide-compatibility:s1.body. · правило `fidelity: nothing dropped; labels are evidence-bound` · ai

### A0021 · мелко · accuracy · уверенность 0.55 · fidelity · объективное

`s3.body` — guide «How to install an eSIM on Android», section 3 — [на сайте](https://magicesim.store/de/guides/android/#data)

**EN**

> • Make sure the eSIM is turned on. Pixel: Settings → Network &amp; internet → Mobile network → the eSIM → **Use this SIM**.
> • Choose the eSIM as the SIM for **mobile data**. Pixel: Settings → Network &amp; internet → SIMs → **Mobile data**. Your main SIM can stay on for calls and texts.
> • Turn on **roaming** for the eSIM. Samsung: Settings → Connections → Mobile Networks → **Data Roaming**. Travel eSIMs usually connect through partner networks, which the phone treats as roaming.
> • If you do not want charges from your home operator, turn off data roaming on your main SIM.
> • Give the phone a minute or two to register on a local network.

**Сейчас**

> • Prüfe, ob die eSIM eingeschaltet ist. Pixel: Einstellungen → Netzwerk &amp; Internet → Mobilfunknetz → die eSIM → **Diese SIM verwenden**.
> • Wähle die eSIM als SIM für **mobile Daten**. Pixel: Einstellungen → Netzwerk &amp; Internet → SIM-Karten → **Mobile Daten**. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.
> • Schalte **Roaming** für die eSIM ein. Pixel: Einstellungen → Netzwerk &amp; Internet → SIM-Karten → **Roaming**. Samsung: Such die Einstellung in den Mobilfunknetz-Einstellungen unter Verbindungen; der genaue Name hängt vom Modell ab. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.
> • Wenn du keine Kosten bei deinem eigenen Mobilfunkanbieter möchtest, schalte das Datenroaming auf deiner Haupt-SIM aus.
> • Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.

**Почему:** The German adds a Pixel path for roaming («Pixel: Einstellungen → Netzwerk & Internet → SIM-Karten → **Roaming**») that the English does not give, and replaces the English Samsung path with a description (correct: Samsung's data-roaming label is not on the vendor page). The added Pixel path is backed by platform-labels.md (page 2926415) and is not a claim, so it may be a deliberate improvement — the arbiter decides whether to keep it (and mirror it in EN) or drop it for parity. · правило `fidelity: nothing added` · ai

## guide-compatibility

### A0009 · мелко · fluency · уверенность 0.7 · linguistic

`s1.body` — guide «Does your phone support eSIM?», section 1 — [на сайте](https://magicesim.store/de/guides/compatibility/#setting)

**EN**

> **iPhone:** Settings → Cellular. **Add eSIM** or **Add Cellular Plan** means eSIM is supported.
> **Android:** open the SIM settings and look for a way to add an eSIM — on Pixel, Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**; on Samsung, Connections → SIM manager → **Add eSIM** (older One UI: SIM card manager → **Add mobile plan**).
> An extra hint on Pixel: to use an eSIM, a phone needs an **EID** number. You can find it in Settings → About phone → SIM status. The setting to add an eSIM is still what decides.

**Сейчас**

> **iPhone:** Einstellungen → Mobilfunk. Wenn dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** erscheint, unterstützt das iPhone eSIM.
> **Android:** Öffne die SIM-Einstellungen und such, wie du eine eSIM hinzufügst: beim Pixel unter Netzwerk &amp; Internet → SIMs → **SIM hinzufügen** → **eSIM einrichten**, bei Samsung unter Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> Ein weiterer Hinweis beim Pixel: Um eine eSIM zu nutzen, braucht das Smartphone eine **EID**-Nummer. Du findest sie unter Einstellungen → Über das Telefon → SIM-Status. Entscheidend ist aber die Einstellung zum Hinzufügen einer eSIM.

**Предложение**

> **iPhone:** Einstellungen → Mobilfunk. Wenn dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** erscheint, unterstützt das iPhone eSIM.
> **Android:** Öffne die SIM-Einstellungen und such nach einer Möglichkeit, eine eSIM hinzuzufügen: beim Pixel unter Netzwerk &amp; Internet → SIMs → **SIM hinzufügen** → **eSIM einrichten**, bei Samsung unter Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> Ein weiterer Hinweis beim Pixel: Um eine eSIM zu nutzen, braucht das Smartphone eine **EID**-Nummer. Du findest sie unter Einstellungen → Über das Telefon → SIM-Status. Entscheidend ist aber die Einstellung zum Hinzufügen einer eSIM.

**Почему:** «suchen, wie du …» is unidiomatic (one does not «search how»); «nach einer Möglichkeit suchen» matches the English «look for a way». · правило `verb valency` · ai

### C0009 · мелко · consistency · уверенность 0.55 · check · объективное

`s1.body` — guide «Does your phone support eSIM?», section 1 — [на сайте](https://magicesim.store/de/guides/compatibility/#setting)

**EN**

> **iPhone:** Settings → Cellular. **Add eSIM** or **Add Cellular Plan** means eSIM is supported.
> **Android:** open the SIM settings and look for a way to add an eSIM — on Pixel, Network &amp; internet → SIMs → **Add SIM** → **Set up an eSIM**; on Samsung, Connections → SIM manager → **Add eSIM** (older One UI: SIM card manager → **Add mobile plan**).
> An extra hint on Pixel: to use an eSIM, a phone needs an **EID** number. You can find it in Settings → About phone → SIM status. The setting to add an eSIM is still what decides.

**Сейчас**

> **iPhone:** Einstellungen → Mobilfunk. Wenn dort **eSIM hinzufügen** oder **Mobilfunktarif hinzufügen** erscheint, unterstützt das iPhone eSIM.
> **Android:** Öffne die SIM-Einstellungen und such, wie du eine eSIM hinzufügst: beim Pixel unter Netzwerk &amp; Internet → SIMs → **SIM hinzufügen** → **eSIM einrichten**, bei Samsung unter Verbindungen → SIM-Manager → **eSIM hinzufügen**.
> Ein weiterer Hinweis beim Pixel: Um eine eSIM zu nutzen, braucht das Smartphone eine **EID**-Nummer. Du findest sie unter Einstellungen → Über das Telefon → SIM-Status. Entscheidend ist aber die Einstellung zum Hinzufügen einer eSIM.

**Почему:** The source says «plan»; elsewhere it is «Tarif», here neither it nor an accepted variant appears. Check whether the meaning is kept. · правило `consistency:plan` · check

### A0022 · на вкус · accuracy · уверенность 0.55 · fidelity

`lead` — guide «Does your phone support eSIM?» — [на сайте](https://magicesim.store/de/guides/compatibility/)

**EN**

> The quickest check: open your phone's SIM settings and look for an option to add an eSIM. If it is there, the phone supports eSIM. Two more things to check at the same time: whether the phone is locked to one carrier, and which regional version you have.

**Сейчас**

> Der einfachste Check: Öffne die SIM-Einstellungen und such nach der Option, eine eSIM hinzuzufügen. Ist sie da, unterstützt das Smartphone eSIM. Prüfe bei der Gelegenheit noch zwei Dinge: ob das Smartphone einen SIM-Lock hat und welche regionale Version du besitzt.

**Предложение**

> Der schnellste Check: Öffne die SIM-Einstellungen und such nach der Option, eine eSIM hinzuzufügen. Ist sie da, unterstützt das Smartphone eSIM. Prüfe bei der Gelegenheit noch zwei Dinge: ob das Smartphone einen SIM-Lock hat und welche regionale Version du besitzt.

**Почему:** «The quickest check» becomes «Der einfachste Check» (the simplest) — a small shift of the attribute; «schnellste» keeps the English. · правило `fidelity: attributes kept` · ai

## countries

### A0013 · мелко · fluency · уверенность 0.65 · linguistic

`BN` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/de/esim/brunei/)

**EN**

> Brunei

**Сейчас**

> Brunei Darussalam

**Предложение**

> Brunei

**Почему:** «Brunei Darussalam» is the formal state name; in a destination list, page title and H1 («eSIM für Brunei Darussalam») a German reader expects the short form «Brunei», which is also what the English uses. Phrasing, not an error. · правило `natural phrasing for headings/SEO titles` · ai

### A0026 · мелко · seo · уверенность 0.6 · fidelity

`BN` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/de/esim/brunei/)

**EN**

> Brunei

**Сейчас**

> Brunei Darussalam

**Предложение**

> Brunei

**Почему:** The English uses the short name; «Brunei Darussalam» is the CLDR/official long form. It adds 11 characters to the title «eSIM für …» and the H1 while German searchers type «Brunei». Not a meaning change — an SEO/intent nuance. · правило `seo-title-keeps-search-intent` · ai

### A0014 · на вкус · fluency · уверенность 0.6 · linguistic

`CV` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/de/esim/cape-verde/)

**EN**

> Cape Verde

**Сейчас**

> Cabo Verde

**Предложение**

> Kap Verde

**Почему:** «Cabo Verde» is the official short name used by the Auswärtiges Amt, but travellers and the Duden use «Kap Verde»; for a storefront list and SEO title the common form reads more naturally. Both are correct German, so this is phrasing only. · правило `natural phrasing for headings/SEO titles` · ai

### A0027 · на вкус · country-name · уверенность 0.5 · fidelity

`CV` — country name (list, page title, H1, plan cards) — [на сайте](https://magicesim.store/de/esim/cape-verde/)

**EN**

> Cape Verde

**Сейчас**

> Cabo Verde

**Предложение**

> Kap Verde

**Почему:** «Cabo Verde» is the official form (Auswärtiges Amt) and is correct, but German travellers mostly search «Kap Verde»/«Kapverden», matching the English exonym «Cape Verde». Preferential: the current name is acceptable. · правило `seo-title-keeps-search-intent` · ai

## guide-troubleshooting

### A0011 · мелко · fluency · уверенность 0.65 · linguistic

`faq3.q` — guide «eSIM not working — what to check», question 3 — [на сайте](https://magicesim.store/de/guides/troubleshooting/#faq)

**EN**

> Will my main SIM get charged while I troubleshoot?

**Сейчас**

> Berechnet mir meine Haupt-SIM etwas, während ich nach dem Fehler suche?

**Предложение**

> Fallen auf meiner Haupt-SIM Kosten an, während ich nach dem Fehler suche?

**Почему:** A SIM card does not «berechnen» anything — the operator does; the personified SIM sounds odd to a native. «Kosten fallen an» is the usual phrasing. · правило `natural phrasing` · ai

### A0025 · мелко · platform-label · уверенность 0.5 · fidelity

`faq1.q` — guide «eSIM not working — what to check», question 1 — [на сайте](https://magicesim.store/de/guides/troubleshooting/#faq)

**EN**

> The eSIM shows «No Service». What first?

**Сейчас**

> Die eSIM zeigt „Kein Netz“ an. Was mache ich zuerst?

**Почему:** «No Service» is an on-screen status the English quotes; the German quotes „Kein Netz“, which is not in references/de/platform-labels.md. Probably the iOS German status text, but it needs a vendor source — or describe it («zeigt kein Netz an») without quoting. · правило `labels are evidence-bound (rubric rule 4)` · ai

