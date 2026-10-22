/* WHAT A PAGE IN ANY LANGUAGE MAY NOT SAY — one set of rules, one table per language (I18N ES-0, 2026-10-21).
 *
 * The English pages were held to these rules by regexes written inside their tests (seo/test-en-guides.mjs,
 * seo/test-en-home.mjs, seo/test-en-pages.mjs). Those regexes read ENGLISH words: a Spanish guide promising «datos
 * ilimitados» or «te enviaremos el QR por correo» would have passed every gate. Here every rule has an id, a reason and,
 * per language, a pattern plus the sentences it must fire on (`fires`) and the honest sentences it must leave alone
 * (`quiet`). seo/test-claim-guards.mjs proves every rule of every language fires and stays quiet as declared, and
 * applies the rules to the generated pages of every PUBLISHED language; seo/build-locale-pages.mjs cannotBuild()
 * refuses a language that has no complete table — so DE, FR, ZH-Hans and KO each bring theirs in their own stage.
 *
 * Writing a rule. JavaScript's \b and \w are ASCII-only: «\búnica» never matches, so a Spanish (or German, French…)
 * rule that uses \b around a word with an accented letter silently passes everything (CLAUDE.md: «never write \b in a
 * Russian regex» — the same trap). Use `word(…)` below, which builds Unicode-aware edges. The FIRST `fires` sentence of
 * a rule is the sentence the rule exists for.
 *
 * The English patterns are the tests' own, moved here byte for byte; the English tests read them from here.
 */

/** A pattern for whole words in any script: letters and digits on either side end a match. Case-insensitive, Unicode. */
export function word(source) {
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, 'iu');
}

/** Every rule a language must have, with what it is for and where it applies. */
export const RULES = Object.freeze({
  money: { why: 'a price in roubles or a payment method: GLOBAL takes no payment yet', on: ['guide'] },
  delivery: { why: 'a promise about delivery that does not exist for GLOBAL yet', on: ['guide'] },
  cardRow: { why: 'a pointer to a plan-card row the GLOBAL cards do not show', on: ['guide'] },
  network: { why: 'a promise of network quality in a place', on: ['guide'] },
  features: { why: 'an unlimited / hotspot / calls / SMS / 2FA promise', on: ['guide'] },
  devices: { why: 'a list of device models', on: ['guide'] },
  installEarly: { why: 'install-early advice that ignores the start of term', on: ['guide'] },
  reusableQr: { why: 'a QR code that can always be reused', on: ['guide'] },
  suppliers: { why: 'a claim about suppliers the page cannot check', on: ['guide'] },
  marketing: { why: 'a marketing claim the business cannot stand behind (24/7, best, cheapest, refund, ratings…)', on: ['home'] },
  template: { why: 'a template country page saying anything about network, operators or coverage quality', on: ['country'] },
});

export const CLAIM_GUARDS = Object.freeze({
  en: Object.freeze({
    money: {
      re: /₽|\broubles?\b|\brubles?\b|\bRUB\b|\bSBP\b|any card|credit card|bank card|pay with/i,
      fires: ['Pay 950 ₽ by card', 'Prices in roubles'], quiet: ['eSIM troubleshooting', 'Prices in US dollars'] },
    delivery: {
      re: /we (will )?(send|email)|our email|you('ll| will) receive|sent to your (e-?mail|inbox)|delivery email|order email/i,
      fires: ['we will send the QR code to your email'], quiet: ['Write to our support team by email.'] },
    cardRow: {
      re: /start of (the )?term|validity starts? row|coverage and conditions|activation row/i,
      fires: ['see the Start of term row'], quiet: ['Installing the profile and starting the plan are different events.'] },
    network: {
      re: /\b(fast|reliable|strong signal|best coverage|full coverage|guaranteed?|works everywhere|seamless)\b|\b(4G|5G|LTE)\b/i,
      fires: ['fast 5G everywhere'], quiet: ['Check that mobile data is on.'] },
    features: {
      re: /\bunlimited\b|\bhotspot\b|tethering|receive (sms|texts|verification)|\b2FA\b|verification code|phone number included/i,
      fires: ['unlimited data with hotspot'], quiet: ['A data allowance for each day of the trip.'] },
    devices: {
      re: /iPhone\s?(X[RS]?|\d{1,2})\b|Galaxy\s?[SZA]\d|Pixel\s?\d/i,
      fires: ['works on iPhone 12 and later'], quiet: ['How to install an eSIM on iPhone'] },
    installEarly: {
      re: /install (it |the eSIM )?(a few days|days|a week|well) (before|ahead)/i,
      fires: ['install it a few days before you fly'], quiet: ['install on the day you travel'] },
    reusableQr: {
      re: /QR code (can|may) be (re-?used|scanned again)|reusable QR|scan it again any time/i,
      fires: ['the QR code can be reused'], quiet: ['Do not delete the eSIM.'] },
    suppliers: {
      re: /\bsupplier|\bprovider\b|eSIM Access|MobiMatter/i,
      fires: ['our supplier eSIM Access'], quiet: ['Your phone must not be carrier-locked.'] },
    marketing: {
      re: /24\/7|\binstant|\bbest\b|\bfastest|\bcheapest|guarantee|\brefund|\bunlimited|\bsave\b|\bno\.? ?1\b|rating|review|trusted|million/i,
      fires: ['Fast support 24/7'], quiet: ['Pick a destination, install an eSIM, land connected.'] },
    template: {
      re: /\b(4G|5G|LTE|operator|carrier network|signal|reliable|fast|best|cheapest|unlimited|guarantee)/i,
      fires: ['works on 5G'], quiet: ['Data plans that work in Peru, with prices in US dollars.'] },
  }),

  // Neutral international Spanish (owner, D1). Patterns follow the English rules' intent, written for how a Spanish
  // sentence actually says it — not a translation of the English regex.
  es: Object.freeze({
    money: {
      re: word('₽|rublos?|RUB|SBP|cualquier tarjeta|tarjetas? de crédito|tarjetas? bancarias?|pag(a|á|ue|ar) con( tarjeta)?'),
      fires: ['Paga 950 ₽ con tarjeta', 'Precios en rublos', 'Acepta cualquier tarjeta de crédito'],
      quiet: ['Precios en dólares estadounidenses (USD)', 'Solución de problemas'] },
    delivery: {
      re: word('te (lo |la )?enviaremos|le enviaremos|enviaremos (el|la|tu|su)|recibir[áa]s (un|el|tu) (correo|e-?mail)|correo (de entrega|del pedido|de confirmación)|te llegará (un|el) correo|en tu bandeja de entrada'),
      fires: ['Te enviaremos el código QR por correo', 'Recibirás un correo con tu eSIM', 'Revisa el correo de entrega'],
      quiet: ['Escribe a nuestro equipo de soporte por correo electrónico.'] },
    cardRow: {
      re: word('inicio del (plazo|periodo|período)|fila (de )?(validez|activación|inicio)|cobertura y condiciones'),
      fires: ['Consulta la fila Inicio del plazo', 'Mira «Cobertura y condiciones»'],
      quiet: ['Instalar el perfil y empezar el plan son cosas distintas.'] },
    network: {
      re: word('rápid[oa]s?|fiables?|confiables?|señal (fuerte|excelente|estable)|mejor cobertura|cobertura (total|completa|garantizada)|garantizad[oa]s?|funciona en todas partes|sin interrupciones|4G|5G|LTE'),
      fires: ['Internet rápido y 5G en todas partes', 'Cobertura total en el país', 'Una red fiable'],
      quiet: ['Comprueba que los datos móviles estén activados.'] },
    features: {
      re: word('ilimitad[oa]s?|sin límites?|punto de acceso|compartir (datos|internet|la conexión)|anclaje de red|tethering|recibir (sms|mensajes|códigos)|2FA|códigos? de verificación|número de teléfono incluido'),
      fires: ['Datos ilimitados con punto de acceso', 'Podrás recibir SMS', 'Incluye código de verificación'],
      quiet: ['Una cantidad de datos para cada día del viaje.'] },
    devices: {
      re: /iPhone\s?(X[RS]?|\d{1,2})(?![\p{L}\p{N}])|Galaxy\s?[SZA]\d|Pixel\s?\d/iu,
      fires: ['Funciona en el iPhone 12 y posteriores', 'Galaxy S21'],
      quiet: ['Cómo instalar una eSIM en iPhone'] },
    installEarly: {
      re: word('inst[aá]la(la|rla|r)? (el eSIM |la eSIM )?(unos|varios|algunos) días antes|con (unos|varios|algunos) días de antelación|inst[aá]la(la|rla|r)? (el eSIM |la eSIM )?una semana antes'),
      fires: ['Instálala unos días antes de viajar', 'Instala la eSIM una semana antes', 'Conviene instalarla con varios días de antelación'],
      quiet: ['Instala la eSIM el día del viaje.'] },
    reusableQr: {
      re: word('(el )?código QR (se )?(puede|podrá|podrás) (reutilizar|volver a escanear|escanear (de nuevo|otra vez))|QR reutilizable'),
      fires: ['El código QR se puede reutilizar', 'Un QR reutilizable'],
      quiet: ['No borres la eSIM.'] },
    suppliers: {
      re: word('proveedor(es)?|eSIM Access|MobiMatter'),
      fires: ['Nuestro proveedor eSIM Access'],
      quiet: ['Tu teléfono no debe estar bloqueado por el operador.'] },
    marketing: {
      re: word('24/7|instantáne[oa]s?|al instante|(el|la|los|las) mejor(es)?|más barat[oa]s?|garantía|garantizad[oa]s?|reembolsos?|ilimitad[oa]s?|ahorr[aeo]s?|ahorrar|n\\.?º ?1|número 1|valoraci[oó]n(es)?|reseñas?|opiniones|de confianza|millones'),
      fires: ['Soporte rápido 24/7', 'El mejor precio', 'Reembolso garantizado'],
      quiet: ['Elige un destino, instala una eSIM y conéctate al aterrizar.'] },
    template: {
      re: word('4G|5G|LTE|operador(es)?|red del operador|señal|fiables?|confiables?|rápid[oa]s?|(el|la) mejor|más barat[oa]s?|ilimitad[oa]s?|garantía|garantizad[oa]s?'),
      fires: ['Funciona con 5G', 'La mejor red del país'],
      quiet: ['Planes de datos que funcionan en Perú, con precios en dólares estadounidenses.'] },
  }),

  // Standard German, «du» (owner D1, D3), DE-1 2026-10-22. German builds compounds («Datenflatrate»,
  // «Highspeed-Internet», «Turbo-Support»), so a stem that can sit INSIDE a compound is matched without a left edge
  // (`(?<![\p{L}])` is not used for those); everything else goes through word().
  de: Object.freeze({
    money: {
      re: word('₽|Rubel[n]?|RUB|SBP|jede[rn]? (Kredit|Bank)?karte|Kreditkarten?|Bankkarten?|(be)?zahl(e|st|en) (mit|per) (Karte|Kreditkarte)'),
      fires: ['Zahle 950 ₽ mit Karte', 'Preise in Rubel', 'Wir akzeptieren jede Kreditkarte'],
      quiet: ['Preise in US-Dollar (USD)', 'Fehlerbehebung'] },
    delivery: {
      re: word('wir (schicken|senden|mailen|liefern) (dir|ihnen)|(schicken|senden) wir dir|du (erhältst|bekommst) (eine|die|deine) (E-?Mail|Mail)|per E-?Mail (erhalten|zugeschickt|zugestellt)|Liefer-?E-?Mail|Bestell-?E-?Mail|Bestellbestätigung|in deinem Posteingang'),
      fires: ['Wir schicken dir den QR-Code per E-Mail', 'Du erhältst eine E-Mail mit deiner eSIM', 'Sieh in der Bestellbestätigung nach'],
      quiet: ['Schreib unserem Support-Team eine E-Mail.', 'Es wird keine eSIM verschickt.'] },
    cardRow: {
      re: word('Beginn der Laufzeit|Laufzeitbeginn|Zeile (Gültigkeit|Aktivierung|Laufzeit|Beginn)|Abdeckung und Bedingungen'),
      fires: ['Sieh dir die Zeile Beginn der Laufzeit an', 'Siehe „Abdeckung und Bedingungen“'],
      quiet: ['Profil installieren und Tarif starten sind zwei verschiedene Zeitpunkte.'] },
    network: {
      re: /schnell(e[nmrs]?|er|ste[nmrs]?)?(?![\p{L}])|zuverlässig|stabile[nmrs]? (Verbindung|Netz|Signal)|starke[snm]? (Signal|Netz|Empfang)|beste[nmrs]? (Abdeckung|Netz|Empfang)|(volle|komplette|lückenlose|flächendeckende|garantierte) Abdeckung|garantiert|überall (verfügbar|Empfang|Netz)|funktioniert überall|unterbrechungsfrei|(?<![\p{L}\p{N}])(4G|5G|LTE)(?![\p{L}\p{N}])/iu,
      fires: ['Schnelles 5G überall', 'Flächendeckende Abdeckung im ganzen Land', 'Ein zuverlässiges Netz', 'Highspeed-Internet, das schnell ist'],
      quiet: ['Prüfe, ob die mobilen Daten eingeschaltet sind.', 'Schritt für Schritt'] },
    features: {
      re: /unbegrenzt|unlimitiert|flatrate|(?<![\p{L}])ohne (Datenlimit|Limit|Begrenzung)|hotspot|tethering|(Internet|Verbindung|Daten) (mit anderen )?teilen(?![\p{L}])|SMS (empfangen|erhalten)|(empfangen|erhalten) (von )?SMS|(?<![\p{L}\p{N}])2FA(?![\p{L}\p{N}])|Bestätigungs-?SMS|Verifizierungscodes?|Telefonnummer (inklusive|inbegriffen)/iu,
      fires: ['Unbegrenzte Daten mit Hotspot', 'Du kannst SMS empfangen', 'Inklusive Verifizierungscode', 'Datenflatrate für die Reise'],
      quiet: ['Ein Datenvolumen für jeden Reisetag.', 'die geteilte Verbindung vom Telefon einer Begleitperson'] },
    devices: {
      re: /iPhone\s?(X[RS]?|\d{1,2})(?![\p{L}\p{N}])|Galaxy\s?[SZA]\d|Pixel\s?\d/iu,
      fires: ['Funktioniert ab dem iPhone 12', 'Galaxy S21'],
      quiet: ['eSIM auf dem iPhone installieren'] },
    installEarly: {
      // advice to install early, not a question about having done it («Ich habe die eSIM eine Woche vor der Reise installiert»)
      re: word('installiere (sie |die eSIM )?(einige|ein paar|mehrere) Tage (vor|vorher|im Voraus)|installiere (sie |die eSIM )?eine Woche (vor|vorher|im Voraus)|((einige|ein paar|mehrere) Tage|eine Woche) (vor der Reise |vor dem Abflug |vorher |im Voraus )(zu )?installieren|(frühzeitig|rechtzeitig) vor (der Reise|dem Abflug) (zu )?installieren'),
      fires: ['Installiere sie ein paar Tage vor der Reise', 'Installiere die eSIM eine Woche vorher', 'Am besten einige Tage im Voraus installieren'],
      quiet: ['Installiere sie am Reisetag.', 'Ich habe die eSIM eine Woche vor der Reise installiert. Läuft die Gültigkeit des Tarifs schon?'] },
    reusableQr: {
      re: word('QR-Code (kann|lässt sich) (wieder|erneut|mehrfach) (verwendet|genutzt|gescannt)|QR-Code (ist )?(wiederverwendbar|mehrfach verwendbar)|wiederverwendbare[nmrs]? QR-Code'),
      fires: ['Der QR-Code kann wieder verwendet werden', 'Ein wiederverwendbarer QR-Code'],
      quiet: ['Lösche die eSIM nicht.', 'Ein QR-Code ist möglicherweise nur einmal verwendbar.'] },
    suppliers: {
      re: word('Lieferanten?|Zulieferer[ns]?|(unser|unseres|unserem) (Partner|Provider)|eSIM Access|MobiMatter'),
      fires: ['Unser Lieferant eSIM Access', 'MobiMatter liefert die eSIM'],
      quiet: ['Dein Smartphone darf keinen SIM-Lock haben.', 'Reise-eSIMs verbinden sich meist über Partnernetze'] },
    marketing: {
      re: /24\/7|rund um die Uhr|sofort(ig)?(?![\p{L}])|blitzschnell|(?<![\p{L}])(beste[nmrs]?|günstigste[nmrs]?|billigste[nmrs]?|schnellste[nmrs]?)(?![\p{L}])|garant|rückerstatt|geld-?zurück|unbegrenzt|(?<![\p{L}])spar(e|en|st|t)?(?![\p{L}])|nr\.? ?1|nummer 1|bewertung|rezension|vertrauen|millionen/iu,
      fires: ['Schneller Support rund um die Uhr', 'Der beste Preis', 'Geld-zurück-Garantie', 'Spare bis zu 50 %'],
      quiet: ['Wähle ein Reiseziel, installiere eine eSIM und sei nach der Landung online.', 'Fragen vor der Reise?'] },
    template: {
      re: /(?<![\p{L}\p{N}])(4G|5G|LTE)(?![\p{L}\p{N}])|netzbetreiber|mobilfunkanbieter|signal|empfang|zuverlässig|schnell|(?<![\p{L}])(beste[nmrs]?|günstigste[nmrs]?|billigste[nmrs]?)(?![\p{L}])|unbegrenzt|garant/iu,
      fires: ['Funktioniert mit 5G', 'Das beste Netz im Land', 'Guter Empfang beim Netzbetreiber'],
      quiet: ['Datentarife für die Türkei, mit Preisen in US-Dollar.'] },
  }),
});

/** The rules a page kind is checked against, as [id, pattern] — for the language's tests. */
export function rulesFor(code, kind) {
  const table = CLAIM_GUARDS[code];
  if (!table) throw new Error(`claim-guards: no table for ${code}`);
  return Object.entries(RULES).filter(([, r]) => r.on.includes(kind)).map(([id]) => [id, table[id].re]);
}

/** Why a language's table is not complete, or null. */
export function missingGuards(code) {
  const table = CLAIM_GUARDS[code];
  if (!table) return `${code} has no claim guards (seo/claim-guards.mjs)`;
  const missing = Object.keys(RULES).filter((id) => !table[id] || !(table[id].re instanceof RegExp) || !table[id].fires?.length);
  return missing.length ? `${code} claim guards miss ${missing.join(', ')} (seo/claim-guards.mjs)` : null;
}
