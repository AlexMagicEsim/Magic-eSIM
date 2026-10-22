// The German guides: /de/guides/<slug>/ (I18N DE-1, 2026-10-22). Data only; seo/build-locale-pages.mjs renders them.
// Standard German (de-DE, owner D3), addressed with «du» (owner D1) — as Apple's, Google's and Samsung's own German
// support pages do.
//
// FACT POLICY — the English guides' policy (seo/guides-en.mjs), unchanged: menu paths are typical and said to vary;
// nothing about what Magic eSIM will deliver or how; no pointer to a card row the plan cards do not show; the
// start-of-term advice is the one safe for every plan (install on the day you travel, over Wi-Fi); no network-quality
// promise, no hotspot / APN / calls / SMS / 2FA guarantee, no device-model list, no payment method; a QR code «may be
// single-use». seo/claim-guards.mjs (de) enforces these on the rendered pages. AI-assisted draft; its quality gate is the
// three-stage AI review (localization-qa skill) — nothing here may say more than the English guide it mirrors.
//
// SOURCES — every German menu label below was read on the vendor's own German page on 2026-10-22; a label not found
// there is NOT quoted (the action is described in plain words instead):
//   Apple de-DE support.apple.com/de-de/118669 (Mitteilung «Mobilfunktarif erkannt», «Weiter», «Mobilfunktarif
//               hinzufügen», Bestätigungscode; iOS 17.4+: QR-Code gedrückt halten → «eSIM hinzufügen»; Einstellungen →
//               «Mobilfunk» bzw. «Mobile Daten» → «Mobilfunktarif hinzufügen» → «Details manuell eingeben»),
//               /de-de/118227 (Einstellungen → Allgemein → Info: «Keine SIM-Beschränkungen» neben «SIM-Lock»),
//               /de-de/109317 (Einstellungen → «Mobilfunk» → «Mobile Daten» → the line for mobile data; «Datenroaming»
//               named, no menu path), /de-de/HT201415 (status «Kein Netz»); the camera app is «Kamera» (118669).
//   Google de   support.google.com/pixelphone/answer/16115470?hl=de (Netzwerk & Internet → «SIMs» → «SIM hinzufügen» →
//               «eSIM einrichten»), 9449293 (Netzwerk & Internet → «SIM-Karten» → «Mobile Daten»; Netzwerk & Internet →
//               «Mobilfunknetz» → the SIM → «Diese SIM verwenden»), 2926415 (Netzwerk & Internet → «SIM-Karten»: «Roaming»,
//               «Zugangspunkte (APNs)»), 10402530 («Über das Telefon» → «SIM-Status» → EID; «Damit Sie eine eSIM verwenden
//               können, brauchen Sie ein Smartphone mit einer EID-Nummer»). Google's pages name the list «SIMs» and
//               «SIM-Karten»: both are given.
//   Samsung de  samsung.com/de/support/mobile-devices/so-verwendest-du-dein-galaxy-smartphone-mit-esim/ (Einstellungen →
//               Verbindungen → «SIM-Manager» → «eSIM hinzufügen» → «QR-Code scannen»; «Über Aktivierungscode hinzufügen»;
//               Einstellungen → Telefoninfo → Statusinformationen: EID). The page does not name the data-roaming switch,
//               so the Samsung roaming step is described, not quoted.

const P = '/de';

export const DE_GUIDES = [
  // ------------------------------------------------------------------ iPhone
  {
    slug: 'iphone',
    nav: 'iPhone',
    title: 'eSIM auf dem iPhone installieren | Magic eSIM',
    description: 'So installierst du eine Reise-eSIM auf dem iPhone per QR-Code oder durch manuelle Eingabe und schaltest die mobilen Daten für die Reise ein.',
    h1: 'eSIM auf dem iPhone installieren',
    blurb: 'Per QR-Code oder manuell – und was du nach der Landung einschaltest.',
    lead: 'Die Installation dauert ein paar Minuten und braucht eine Internetverbindung, am einfachsten über WLAN. Hier findest du den ganzen Ablauf: prüfen, ob dein iPhone eSIM unterstützt, das Profil installieren und am Reiseziel die mobilen Daten einschalten.',
    sections: [
      { h2: 'Prüfe, ob dein iPhone eSIM unterstützt', id: 'check', html: `
        <p>Öffne <strong>Einstellungen → Mobilfunk</strong> (in manchen Regionen <strong>Mobile Daten</strong>). Wenn du dort <strong>eSIM hinzufügen</strong> oder <strong>Mobilfunktarif hinzufügen</strong> siehst, unterstützt dein iPhone eSIM.</p>
        <p>Außerdem darf dein iPhone keinen SIM-Lock eines Mobilfunkanbieters haben. Lies dazu, <a href="${P}/guides/compatibility/">wie du die Kompatibilität prüfst</a>.</p>` },
      { h2: 'Variante 1: QR-Code scannen', id: 'qr', html: `
        <ol class="steps">
          <li>Zeig den QR-Code deiner eSIM auf einem anderen Bildschirm an: auf einem Computer, einem Tablet oder einem anderen Smartphone.</li>
          <li>Öffne auf dem iPhone die <strong>Kamera</strong>-App und scanne den QR-Code.</li>
          <li>Wenn die Mitteilung <strong>Mobilfunktarif erkannt</strong> erscheint, tippe darauf.</li>
          <li>Tippe auf <strong>Weiter</strong> und dann auf <strong>Mobilfunktarif hinzufügen</strong>. Wenn du nach einem Bestätigungscode gefragt wirst, gib den Code ein, der zu deiner eSIM angegeben ist.</li>
          <li>Gib der Leitung einen eindeutigen Namen, zum Beispiel „Reise“, damit du sie nicht mit deiner Haupt-SIM verwechselst.</li>
        </ol>
        <p class="note">Ab iOS 17.4: Wenn der QR-Code in einer E-Mail oder auf einer Webseite auf diesem iPhone ist, halte den Code gedrückt und tippe auf <strong>eSIM hinzufügen</strong>.</p>` },
      { h2: 'Variante 2: Daten manuell eingeben', id: 'manual', html: `
        <ol class="steps">
          <li>Halte die Daten für die manuelle Installation bereit, die zu deiner eSIM gehören.</li>
          <li>Öffne <strong>Einstellungen → Mobilfunk</strong> (bzw. <strong>Mobile Daten</strong>) und tippe auf <strong>Mobilfunktarif hinzufügen</strong>.</li>
          <li>Tippe auf <strong>Details manuell eingeben</strong> und gib diese Daten ein.</li>
          <li>Bestätige und warte, bis die Installation abgeschlossen ist.</li>
        </ol>
        <p class="note">Praktisch, wenn du keinen QR-Code zum Scannen hast.</p>` },
      { h2: 'Am Reiseziel: Daten einschalten', id: 'data', html: `
        <ol class="steps">
          <li>Prüfe unter <strong>Einstellungen → Mobilfunk</strong>, ob die eSIM-Leitung eingeschaltet ist.</li>
          <li>Tippe auf <strong>Mobile Daten</strong> und wähle die eSIM-Leitung. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.</li>
          <li>Öffne die eSIM-Leitung und schalte das Datenroaming ein. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.</li>
          <li>Wenn bei deinem eigenen Mobilfunkanbieter keine Kosten anfallen sollen, schalte das Datenroaming auf deiner Haupt-SIM aus.</li>
          <li>Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.</li>
        </ol>
        <p class="note">Die Menübezeichnungen können je nach iOS-Version etwas abweichen.</p>` },
      { h2: 'Wenn etwas nicht funktioniert', id: 'help', html: `
        <p>Prüfe, ob die eSIM als Leitung für mobile Daten gewählt ist und Datenroaming eingeschaltet hat, und starte das Telefon neu. Die vollständige Liste findest du unter <a href="${P}/guides/troubleshooting/">Die eSIM funktioniert nicht</a>.</p>
        <p><strong>Lösche die eSIM nicht</strong>, während du nach dem Fehler suchst: Ihr QR-Code ist möglicherweise nur einmal verwendbar, und du kannst sie dann eventuell nicht erneut installieren.</p>` },
    ],
    faq: [
      { q: 'Brauche ich WLAN, um eine eSIM auf dem iPhone zu installieren?', a: 'Du brauchst eine Internetverbindung, um das Profil herunterzuladen, am einfachsten über WLAN. Wenn du die eSIM am Reisetag installierst – zu Hause vor dem Aufbruch oder im WLAN des Flughafens –, passt das zu jedem Tarif, egal wann seine Gültigkeit beginnt.' },
      { q: 'Der QR-Code ist auf demselben iPhone. Kann ich die eSIM trotzdem installieren?', a: 'Ja. Ab iOS 17.4 hältst du den QR-Code in der E-Mail oder auf der Webseite gedrückt und tippst auf „eSIM hinzufügen“. Oder du wählst „Details manuell eingeben“ und gibst die Daten ein, die zu deiner eSIM gehören.' },
      { q: 'Was passiert mit meiner Hauptnummer?', a: 'Sie bleibt aktiv. Für Anrufe und SMS an deine Hauptnummer gelten die Roamingbedingungen deines eigenen Mobilfunkanbieters; die Reise-eSIM wird für mobile Daten genutzt.' },
      { q: 'Warum soll ich auf der eSIM Datenroaming einschalten?', a: 'Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming. Datenroaming auf der eSIM-Leitung ist eine normale Einstellung; auf deiner Haupt-SIM kannst du es ausgeschaltet lassen.' },
    ],
    related: ['android', 'compatibility', 'activation', 'troubleshooting'],
  },

  // ----------------------------------------------------------------- Android
  {
    slug: 'android',
    nav: 'Android',
    title: 'eSIM unter Android installieren | Magic eSIM',
    description: 'So installierst du eine Reise-eSIM auf einem Android-Smartphone per QR-Code oder manuell, wählst sie für mobile Daten und schaltest am Reiseziel Roaming ein.',
    h1: 'eSIM unter Android installieren',
    blurb: 'Wo die eSIM-Einstellung je nach Marke meist liegt – und die ersten Schritte im Ausland.',
    lead: 'Jede Android-Marke benennt ihre Einstellungen anders, die Schritte sind aber dieselben: Finde die SIM-Verwaltung, füge eine eSIM per QR-Code oder manuell hinzu und wähle sie am Reiseziel für mobile Daten. Für die Installation brauchst du eine Internetverbindung, am einfachsten über WLAN.',
    sections: [
      { h2: 'Finde die SIM-Verwaltung', id: 'find', html: `
        <p>Die SIM-Einstellungen liegen meist an einer dieser Stellen; die Namen hängen von Marke und Android-Version ab:</p>
        <ul class="list">
          <li><strong>Google Pixel:</strong> Einstellungen → Netzwerk &amp; Internet → SIMs (oder SIM-Karten) → <strong>SIM hinzufügen</strong> → <strong>eSIM einrichten</strong>.</li>
          <li><strong>Samsung Galaxy:</strong> Einstellungen → Verbindungen → SIM-Manager → <strong>eSIM hinzufügen</strong> (bei älteren One-UI-Versionen heißen Menü und Option anders).</li>
          <li><strong>Andere Marken:</strong> Such in den Einstellungen nach „Mobilfunknetz“, „SIM-Karten“ oder „Verbindungen“.</li>
        </ul>
        <p>Wenn du nirgends eine Option zum Hinzufügen einer eSIM findest, lies nach, <a href="${P}/guides/compatibility/">ob dein Smartphone eSIM unterstützt</a>.</p>` },
      { h2: 'eSIM installieren', id: 'install', html: `
        <ol class="steps">
          <li>Zeig den QR-Code deiner eSIM auf einem anderen Bildschirm an.</li>
          <li>Beginne wie oben beschrieben, eine eSIM hinzuzufügen. <strong>Samsung:</strong> Tippe auf <strong>QR-Code scannen</strong> und scanne den Code. <strong>Pixel:</strong> Folge den Anweisungen auf dem Bildschirm.</li>
          <li>Kein QR-Code zum Scannen? Tippe bei Samsung auf <strong>Über Aktivierungscode hinzufügen</strong> und gib die Daten ein, die zu deiner eSIM gehören.</li>
          <li>Bestätige und warte, bis die Installation abgeschlossen ist.</li>
          <li>Benenne die eSIM um, zum Beispiel in „Reise“.</li>
        </ol>` },
      { h2: 'Am Reiseziel: Daten einschalten', id: 'data', html: `
        <ol class="steps">
          <li>Prüfe, ob die eSIM eingeschaltet ist. Pixel: Einstellungen → Netzwerk &amp; Internet → Mobilfunknetz → die eSIM → <strong>Diese SIM verwenden</strong>.</li>
          <li>Wähle die eSIM als SIM für <strong>mobile Daten</strong>. Pixel: Einstellungen → Netzwerk &amp; Internet → SIM-Karten → <strong>Mobile Daten</strong>. Deine Haupt-SIM kann für Anrufe und SMS aktiv bleiben.</li>
          <li>Schalte <strong>Roaming</strong> für die eSIM ein. Pixel: Einstellungen → Netzwerk &amp; Internet → SIM-Karten → <strong>Roaming</strong>. Samsung: Such die Einstellung in den Mobilfunknetz-Einstellungen unter Verbindungen; der genaue Name hängt vom Modell ab. Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.</li>
          <li>Wenn bei deinem eigenen Mobilfunkanbieter keine Kosten anfallen sollen, schalte das Datenroaming auf deiner Haupt-SIM aus.</li>
          <li>Warte ein bis zwei Minuten, bis sich das Telefon in einem lokalen Netz angemeldet hat.</li>
        </ol>` },
      { h2: 'Wenn etwas nicht funktioniert', id: 'help', html: `
        <p>Prüfe die SIM für mobile Daten und das Roaming der eSIM, schalte den Flugmodus ein und wieder aus und starte das Telefon neu. Die vollständige Liste findest du unter <a href="${P}/guides/troubleshooting/">Die eSIM funktioniert nicht</a>.</p>
        <p><strong>Lösche die eSIM nicht</strong>, während du nach dem Fehler suchst: Ihr QR-Code ist möglicherweise nur einmal verwendbar.</p>` },
    ],
    faq: [
      { q: 'Mein Android-Smartphone hat keine Option zum Hinzufügen einer eSIM. Was tun?', a: 'Sieh dir alle Menüs rund um die SIM an – der Name hängt von der Marke ab. Wenn es nirgends eine Option zum Hinzufügen oder Herunterladen einer eSIM gibt, unterstützt das Smartphone (oder diese regionale Version) wahrscheinlich keine eSIM.' },
      { q: 'Kann ich die eSIM und meine physische SIM gleichzeitig nutzen?', a: 'Bei Smartphones, die Dual-SIM mit eSIM unterstützen, ja: Wähle die eSIM für mobile Daten und behalte die physische SIM für Anrufe und SMS.' },
      { q: 'Muss ich einen APN einrichten?', a: 'Nur wenn in den Angaben zu deinem Tarif ein APN steht: Prüfe dann, ob er in den Einstellungen der eSIM übereinstimmt.' },
    ],
    related: ['iphone', 'compatibility', 'activation', 'troubleshooting'],
  },

  // ----------------------------------------------------------- compatibility
  {
    slug: 'compatibility',
    nav: 'Kompatibilität',
    title: 'Unterstützt mein Smartphone eSIM? | Magic eSIM',
    description: 'Prüfe die eSIM-Kompatibilität, bevor du einen Tarif wählst: welche Einstellung du auf iPhone und Android suchst, SIM-Lock und regionale Versionen.',
    h1: 'Unterstützt dein Smartphone eSIM?',
    blurb: 'Ein Check in einer Minute, bevor du einen Tarif wählst.',
    lead: 'Der einfachste Check: Öffne die SIM-Einstellungen und such nach der Option, eine eSIM hinzuzufügen. Ist sie da, unterstützt das Smartphone eSIM. Prüfe bei der Gelegenheit noch zwei Dinge: ob das Smartphone einen SIM-Lock hat und welche regionale Version du besitzt.',
    sections: [
      { h2: 'Check 1: die Einstellung', id: 'setting', html: `
        <p><strong>iPhone:</strong> Einstellungen → Mobilfunk. Wenn dort <strong>eSIM hinzufügen</strong> oder <strong>Mobilfunktarif hinzufügen</strong> erscheint, unterstützt das iPhone eSIM.</p>
        <p><strong>Android:</strong> Öffne die SIM-Einstellungen und such nach einer Möglichkeit, eine eSIM hinzuzufügen: beim Pixel unter Netzwerk &amp; Internet → SIMs → <strong>SIM hinzufügen</strong> → <strong>eSIM einrichten</strong>, bei Samsung unter Verbindungen → SIM-Manager → <strong>eSIM hinzufügen</strong> (bei älteren One-UI-Versionen heißen Menü und Option anders).</p>
        <p>Ein weiterer Hinweis beim Pixel: Um eine eSIM zu nutzen, braucht das Smartphone eine <strong>EID</strong>-Nummer. Du findest sie unter Einstellungen → Über das Telefon → SIM-Status. Entscheidend ist aber die Einstellung zum Hinzufügen einer eSIM.</p>` },
      { h2: 'Check 2: Hat das Smartphone einen SIM-Lock?', id: 'lock', html: `
        <p>Ein Smartphone, das mit Vertrag gekauft wurde, kann für andere SIM-Karten und eSIMs gesperrt sein, bis der Mobilfunkanbieter die Sperre aufhebt.</p>
        <p>Öffne auf dem iPhone <strong>Einstellungen → Allgemein → Info</strong> und such nach „Keine SIM-Beschränkungen“ neben <strong>SIM-Lock</strong>. Bei Android fragst du den Mobilfunkanbieter, der das Smartphone verkauft hat.</p>` },
      { h2: 'Check 3: die regionale Version', id: 'region', html: `
        <p>Dasselbe Modell kann in einem Land eSIM haben und in einem anderen nicht: Die Unterstützung hängt vom Markt ab, für den das Smartphone gebaut wurde, nicht nur vom Modellnamen. Deshalb veröffentlichen wir keine Liste „kompatibler Modelle“ – entscheidend sind die Einstellungen deines eigenen Smartphones.</p>` },
      { h2: 'Dein Smartphone erfüllt die Voraussetzungen – und jetzt?', id: 'next', html: `
        <p>Wähle ein Reiseziel in der <a href="${P}/esim/">Liste der Reiseziele</a> und lies, wie du die eSIM auf dem <a href="${P}/guides/iphone/">iPhone</a> oder unter <a href="${P}/guides/android/">Android</a> installierst.</p>` },
    ],
    faq: [
      { q: 'Mein Smartphone unterstützt zwei SIM-Karten. Heißt das, es hat eSIM?', a: 'Nicht unbedingt: Manche Smartphones haben zwei physische Steckplätze und keine eSIM. Such in den SIM-Einstellungen nach der Option, eine eSIM hinzuzufügen.' },
      { q: 'Ich finde die EID nicht. Heißt das, es gibt keine eSIM?', a: 'Nicht unbedingt. Entscheidend ist die Option zum Hinzufügen einer eSIM in den Einstellungen.' },
      { q: 'Und wenn mein Smartphone keine eSIM unterstützt?', a: 'Dann funktioniert eine Reise-eSIM darauf nicht. Du bräuchtest ein anderes Smartphone mit eSIM oder eine lokale physische SIM an deinem Reiseziel.' },
    ],
    related: ['iphone', 'android', 'activation', 'troubleshooting'],
  },

  // -------------------------------------------------------------- activation
  {
    slug: 'activation',
    nav: 'Wann installieren',
    title: 'Reise-eSIM: wann installieren und aktivieren? | Magic eSIM',
    description: 'eSIM installieren und Laufzeit starten ist nicht dasselbe: wann du installierst, Leitung und Datenroaming einschaltest – plus Checkliste für den Reisetag.',
    h1: 'Wann du deine eSIM installierst und aktivierst',
    blurb: 'Profil installieren und Tarif starten sind zwei verschiedene Zeitpunkte.',
    lead: 'Die eSIM zu installieren und ihre Gültigkeit zu starten ist nicht dasselbe, und jeder Tarif legt selbst fest, wann die Gültigkeit beginnt. Der Rat, der für jeden Tarif passt: Installiere die eSIM am Reisetag über WLAN und schalte sie nach der Ankunft für Daten ein.',
    sections: [
      { h2: 'Vier verschiedene Schritte', id: 'steps', html: `
        <ol class="steps">
          <li><strong>Installieren</strong>: Das Telefon lädt das eSIM-Profil über den QR-Code herunter. Dafür braucht es Internet.</li>
          <li><strong>Leitung einschalten</strong>: Die eSIM erscheint in deiner SIM-Liste als aktiv.</li>
          <li><strong>Für mobile Daten wählen</strong>: Das Internet läuft über die eSIM.</li>
          <li>Auf der eSIM <strong>Datenroaming einschalten</strong>: Damit kann sie im Ausland Partnernetze nutzen.</li>
        </ol>` },
      { h2: 'Wann beginnt die Gültigkeit?', id: 'validity', html: `
        <p>Das hängt vom Tarif ab. Bei manchen Tarifen beginnt die Gültigkeit, wenn sich die eSIM am Reiseziel zum ersten Mal mit einem Netz verbindet oder zum ersten Mal Daten nutzt. Bei anderen beginnt sie, sobald die eSIM installiert ist.</p>
        <p>Deshalb lautet der Rat, mit dem du nie Tage verlierst: <strong>Installiere die eSIM am Reisetag</strong> (zu Hause vor dem Aufbruch oder im WLAN des Flughafens) und schalte sie nach der Landung für Daten ein.</p>` },
      { h2: 'Checkliste für den Reisetag', id: 'checklist', html: `
        <ul class="list">
          <li>Dein Smartphone unterstützt eSIM und hat keinen SIM-Lock (<a href="${P}/guides/compatibility/">prüfen</a>).</li>
          <li>Du hast den QR-Code der eSIM oder die Daten für die manuelle Installation griffbereit und so gespeichert, dass du sie auch offline öffnen kannst.</li>
          <li>Du installierst die eSIM über WLAN (<a href="${P}/guides/iphone/">iPhone</a>, <a href="${P}/guides/android/">Android</a>).</li>
          <li>Bis zur Landung bleibt deine Haupt-SIM für Daten zuständig.</li>
        </ul>` },
      { h2: 'Nach der Landung', id: 'landed', html: `
        <ol class="steps">
          <li>Schalte die eSIM-Leitung ein, falls sie ausgeschaltet ist.</li>
          <li>Wähle die eSIM für mobile Daten.</li>
          <li>Schalte auf der eSIM Datenroaming ein.</li>
          <li>Warte ein bis drei Minuten. Kein Netz? Schalte den Flugmodus ein und wieder aus.</li>
          <li>Funktioniert es immer noch nicht? Lies <a href="${P}/guides/troubleshooting/">Die eSIM funktioniert nicht</a>.</li>
        </ol>` },
      { h2: 'Gelandet, ohne installierte eSIM und ohne WLAN?', id: 'no-wifi', html: `
        <p>Zum Herunterladen des Profils brauchst du Internet. Möglichkeiten: das kostenlose WLAN am Flughafen oder die geteilte Verbindung vom Telefon einer Begleitperson. Auch die manuelle Eingabe braucht Internet, um das Profil herunterzuladen.</p>` },
    ],
    faq: [
      { q: 'Ich habe die eSIM eine Woche vor der Reise installiert. Läuft die Gültigkeit des Tarifs schon?', a: 'Das hängt vom Tarif ab: Manche beginnen mit der Installation, andere mit der ersten Verbindung oder der ersten Datennutzung am Reiseziel. Um bei jedem Tarif auf der sicheren Seite zu sein, installiere die eSIM am Reisetag.' },
      { q: 'Kostet es etwas, das Datenroaming zu Hause einzuschalten?', a: 'Der Schalter selbst kostet nichts; er erlaubt der Leitung nur, Partnernetze zu nutzen. Entscheidend ist, welche Leitung für mobile Daten gewählt ist und was dein Tarif vorsieht.' },
      { q: 'Ich bin gelandet und habe kein Internet. Wie lange soll ich warten?', a: 'Die Anmeldung dauert meist ein bis zwei Minuten, nachdem du Daten und Datenroaming der eSIM eingeschaltet hast. Den Flugmodus ein- und wieder auszuschalten hilft oft. Wenn nach 10 bis 15 Minuten immer noch kein Netz da ist, geh die Checkliste zur Fehlerbehebung durch.' },
    ],
    related: ['iphone', 'android', 'troubleshooting', 'compatibility'],
  },

  // ---------------------------------------------------------- troubleshooting
  {
    slug: 'troubleshooting',
    nav: 'Fehlerbehebung',
    title: 'eSIM funktioniert im Ausland nicht? | Magic eSIM',
    description: 'Checkliste für eine Reise-eSIM ohne Netz oder Internet: Datenleitung, Datenroaming, Flugmodus, Netzauswahl – und wann du die eSIM nicht löschen solltest.',
    h1: 'Die eSIM funktioniert nicht: Das kannst du prüfen',
    blurb: 'Eine Checkliste – in der Reihenfolge, die die meisten Probleme löst.',
    lead: 'Die meisten Probleme liegen an einer Einstellung. Geh die Schritte der Reihe nach durch und teste das Internet nach jedem Schritt. Lösche die eSIM nicht, während du nach dem Fehler suchst.',
    sections: [
      { h2: 'Die Checkliste', id: 'checklist', html: `
        <ol class="steps">
          <li><strong>Ist die eSIM-Leitung eingeschaltet?</strong> Sieh in den SIM-Einstellungen nach.</li>
          <li><strong>Ist die eSIM für mobile Daten gewählt?</strong> Das Internet muss über die eSIM laufen, nicht über deine Haupt-SIM.</li>
          <li><strong>Ist auf der eSIM Datenroaming eingeschaltet?</strong> Reise-eSIMs verbinden sich meist über Partnernetze, und das Telefon behandelt das als Roaming.</li>
          <li><strong>Schalte den Flugmodus</strong> für zehn Sekunden ein und dann wieder aus.</li>
          <li><strong>Starte das Telefon neu.</strong></li>
          <li><strong>Wähle ein Netz manuell.</strong> Schalte in den Netzeinstellungen der eSIM die automatische Netzauswahl aus und wähle ein anderes Netz aus der Liste.</li>
          <li><strong>Prüfe den APN</strong> – nur wenn in den Angaben zu deinem Tarif einer steht: Er muss in den Einstellungen der eSIM übereinstimmen.</li>
          <li><strong>Bist du im Abdeckungsbereich des Tarifs?</strong> Prüfe, ob das Land, in dem du bist, zu den Ländern gehört, die der Tarif abdeckt.</li>
        </ol>` },
      { h2: 'Netz ja, Internet nein', id: 'no-internet', html: `
        <p>Das Telefon ist angemeldet, aber es fließen keine Daten. Meist ist die eSIM nicht als Leitung für mobile Daten gewählt, oder ihr Datenroaming ist ausgeschaltet. Prüfe beides und schalte dann den Flugmodus ein und wieder aus.</p>` },
      { h2: 'Lösche die eSIM nicht', id: 'dont-delete', html: `
        <p>Die eSIM zu löschen löst fast nie ein Problem, und ihr QR-Code ist möglicherweise nur einmal verwendbar: Du kannst sie dann eventuell nicht erneut installieren. Lass sie installiert, während du die Checkliste durchgehst.</p>` },
      { h2: 'Funktioniert es immer noch nicht?', id: 'contact', html: `
        <p>Wenn du die ganze Checkliste durchgegangen bist und die eSIM immer noch nicht funktioniert, schreib uns an <a href="mailto:support@magicesim.store">support@magicesim.store</a>.</p>` },
    ],
    faq: [
      { q: 'Die eSIM zeigt „Kein Netz“ an. Was mache ich zuerst?', a: 'Prüfe, ob auf der eSIM Datenroaming eingeschaltet ist, schalte den Flugmodus ein und wieder aus und warte ein paar Minuten. Versuch danach, ein Netz manuell zu wählen.' },
      { q: 'Kann ich die eSIM mit demselben QR-Code erneut installieren?', a: 'Oft nicht: Ein QR-Code ist möglicherweise nur einmal verwendbar. Deshalb sagt die Checkliste, dass du die eSIM nicht löschen sollst.' },
      { q: 'Fallen auf meiner Haupt-SIM Kosten an, während ich nach dem Fehler suche?', a: 'Wenn die Haupt-SIM für mobile Daten gewählt ist und Datenroaming eingeschaltet hat, kann dein eigener Mobilfunkanbieter Kosten berechnen. Lass die eSIM als Datenleitung gewählt oder schalte das Datenroaming auf der Haupt-SIM aus.' },
    ],
    related: ['iphone', 'android', 'activation', 'compatibility'],
  },
];
