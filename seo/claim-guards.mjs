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

/** A pattern for Chinese (and other unspaced Han) text — ZH-1, T1 (2026-10-22). Chinese writes no space between words,
 *  so every character next to a phrase is a letter (\p{L}) and `word()` can NEVER match inside a sentence: measured,
 *  word('最快') does not fire on «我们是最快的eSIM». Here only a LATIN letter or a digit ends a match: «最快» fires inside
 *  a Chinese sentence, «5G» fires in «支持5G网络», and «15G» or «eSIM5» are still not «5G». Case-insensitive, Unicode. */
export function hanWord(source) {
  return new RegExp(`(?<![\\p{Script=Latin}\\p{N}])(?:${source})(?![\\p{Script=Latin}\\p{N}])`, 'iu');
}

/* A sentence a rule would refuse, allowed WHOLE because the owner decided it and a source states it (ZH-1, owner D12:
 * the iPhone models Apple lists for mainland China, on the Chinese compatibility guide only). Never a pattern, never a
 * page: one exact sentence, its rule, its page and its source. seo/test-claim-guards.mjs removes exactly these sentences
 * before applying the rules, and fails if one is missing from its page, if its rule does not fire on it (then it is not
 * needed) or if it has no https source. */
export const SOURCED = Object.freeze({
  'zh-Hans': Object.freeze([
    Object.freeze({
      rule: 'devices', page: 'zh/guides/compatibility/',
      sentence: '根据 Apple 于 2026 年 9 月 9 日发布的说明，在中国大陆，以下 iPhone 机型支持 eSIM：iPhone 18 Pro、iPhone 18 Pro Max、iPhone Duo、iPhone 17e 和 iPhone Air。',
      source: 'https://support.apple.com/zh-cn/123879', read: '2026-10-22' }),
  ]),
});

/** A page's text without the sentences SOURCED allows for this language and page. */
export function withoutSourced(code, page, text) {
  let t = String(text);
  for (const s of SOURCED[code] || []) if (s.page === page) t = t.split(s.sentence).join(' ');
  return t;
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

  // Standard French, «vous» (owner D1, D3), FR-1 2026-10-22. Elision (l’, d’) and accents go through word(): the
  // apostrophe is not a letter, so «l’eSIM» still ends a word at «l».
  fr: Object.freeze({
    money: {
      re: word('₽|roubles?|RUB|SBP|toute carte|n’importe quelle carte|cartes? de crédit|cartes? bancaires?|pay(ez|er) (par|avec) (une )?carte'),
      fires: ['Payez 950 ₽ par carte', 'Prix en roubles', 'Nous acceptons toute carte de crédit'],
      quiet: ['Prix en dollars américains (USD)', 'Dépannage'] },
    delivery: {
      re: word('nous vous (enverrons|envoyons|adresserons)|vous recevrez (un|le|l’|votre) ?(e-mail|courriel|mail)|e-mail de (livraison|commande|confirmation)|courriel de (livraison|commande|confirmation)|dans votre boîte de réception'),
      fires: ['Nous vous enverrons le code QR par e-mail', 'Vous recevrez un e-mail avec votre eSIM', 'Consultez l’e-mail de confirmation'],
      quiet: ['Écrivez à notre équipe d’assistance par e-mail.', 'Aucune eSIM ne sera envoyée.'] },
    cardRow: {
      re: word('début de (la )?validité|ligne (validité|activation|début)|couverture et conditions'),
      fires: ['Consultez la ligne Début de validité', 'Voir « Couverture et conditions »'],
      quiet: ['Installer le profil et démarrer le forfait sont deux moments distincts.'] },
    network: {
      re: word('rapides?|fiables?|signal (fort|excellent|stable)|meilleure couverture|couverture (totale|complète|garantie|parfaite)|garanti(e|s|es)?|fonctionne partout|sans interruption|4G|5G|LTE'),
      fires: ['Une 5G rapide partout', 'Couverture totale dans tout le pays', 'Un réseau fiable'],
      quiet: ['Vérifiez que les données mobiles sont activées.', 'La vérification la plus rapidement faite'] },
    features: {
      re: word('illimité(e|s|es)?|sans limite|partage de connexion|point d’accès( mobile)?|hotspot|tethering|recevoir (des )?(SMS|codes)|2FA|codes? de vérification|numéro de téléphone inclus'),
      fires: ['Données illimitées avec point d’accès mobile', 'Vous pourrez recevoir des SMS', 'Code de vérification inclus'],
      quiet: ['Un volume de données pour chaque jour du voyage.', 'Noms des points d’accès', 'la connexion partagée depuis le téléphone d’un compagnon de voyage'] },
    devices: {
      re: /iPhone\s?(X[RS]?|\d{1,2})(?![\p{L}\p{N}])|Galaxy\s?[SZA]\d|Pixel\s?\d/iu,
      fires: ['Fonctionne à partir de l’iPhone 12', 'Galaxy S21'],
      quiet: ['Installer une eSIM sur iPhone'] },
    installEarly: {
      // advice to install early, not a question about having done it («J’ai installé l’eSIM une semaine avant le voyage»)
      re: word('installe[zr]?(-la| la| l’eSIM)? (quelques|plusieurs) jours (avant|à l’avance)|installe[zr]?(-la| la| l’eSIM)? une semaine (avant|à l’avance)|(quelques|plusieurs) jours à l’avance|bien avant (le départ|le voyage)'),
      fires: ['Installez-la quelques jours avant le voyage', 'Installez l’eSIM une semaine avant', 'Mieux vaut l’installer plusieurs jours à l’avance'],
      quiet: ['Installez l’eSIM le jour du voyage.', 'J’ai installé l’eSIM une semaine avant le voyage. La validité du forfait a-t-elle déjà commencé ?'] },
    reusableQr: {
      re: word('code QR (peut|pourra) être (réutilisé|rescanné|scanné à nouveau)|codes? QR réutilisables?'),
      fires: ['Le code QR peut être réutilisé', 'Un code QR réutilisable'],
      quiet: ['Ne supprimez pas l’eSIM.', 'Un code QR peut être à usage unique.'] },
    suppliers: {
      re: word('fournisseurs?|eSIM Access|MobiMatter'),
      fires: ['Notre fournisseur eSIM Access', 'MobiMatter fournit l’eSIM'],
      quiet: ['Votre téléphone ne doit pas être verrouillé par un opérateur.', 'via des réseaux partenaires'] },
    marketing: {
      re: word('24 ?h ?/ ?24|24/7|7 ?j ?/ ?7|instantané(e|s|es)?|immédiat(e|s|es)?|le meilleur|la meilleure|les meilleur(e)?s|le moins cher|la moins chère|garanti(e|s|es)?|rembours(é|ée|ement|ements)|illimité(e|s|es)?|économisez|économiser|n° ?1|numéro 1|avis clients|évaluations?|de confiance|millions'),
      fires: ['Assistance rapide 24h/24', 'Le meilleur prix', 'Satisfait ou remboursé'],
      quiet: ['Choisissez une destination, installez une eSIM et soyez connecté dès l’atterrissage.', 'Des questions avant de partir ?'] },
    template: {
      // «verrouillé par un opérateur» (the checkout's device check) is not a claim about networks — like the English
      // rule, only operator NETWORKS and named operators are.
      re: word('4G|5G|LTE|opérateurs? (locaux|local|partenaires?|mobiles?)|réseaux? (de l’|des |d’)?opérateurs?|signal|fiables?|rapides?|le meilleur|la meilleure|le moins cher|illimité(e|s|es)?|garanti(e|s|es)?'),
      fires: ['Fonctionne en 5G', 'Le meilleur réseau du pays', 'Les réseaux des opérateurs locaux'],
      quiet: ['Des forfaits de données pour le Japon, avec des prix en dollars américains.', 'Mon téléphone est compatible eSIM et n’est pas verrouillé par un opérateur'] },
  }),
  /* Simplified Chinese (ZH-1, 2026-10-22). Every pattern is built with hanWord(): Chinese has no spaces, so word()
   * would never fire inside a sentence (T1). Beyond the English rules, the Chinese table refuses anything that would
   * say which services can be reached in mainland China (VPN, 翻墙, «access Google / WhatsApp …») — owner: no
   * unconfirmed statement about service availability in mainland China — and the absolute words of the PRC Advertising
   * Law art. 9 (最佳, 第一, 唯一, 顶级…) on the home. */
  'zh-Hans': Object.freeze({
    money: {
      re: hanWord('₽|卢布|RUB|SBP|任意(银行)?卡|任何(银行)?卡|信用卡|银行卡|刷卡|用卡支付|支付宝|微信支付'),
      fires: ['用银行卡支付 950 ₽', '价格以卢布计', '支持支付宝付款'],
      quiet: ['价格以美元（USD）计', '故障排除'] },
    delivery: {
      re: hanWord('我们(会|将)[^。！？]{0,12}(发送|发给|寄给)|您将(会)?收到[^。！？]{0,12}(邮件|电子邮件)|发货邮件|订单邮件|确认邮件|收件箱'),
      fires: ['我们会把二维码发送到您的邮箱', '您将收到一封包含 eSIM 的邮件', '请查看确认邮件'],
      quiet: ['请发送电子邮件联系我们的客服团队。', '不会发送任何 eSIM。'] },
    cardRow: {
      re: hanWord('有效期开始”?(一栏|这一行|那一行|一行)|覆盖范围(和|与)条(件|款)|激活”?(一栏|这一行)'),
      fires: ['请查看“有效期开始”一栏', '参见“覆盖范围和条件”'],
      quiet: ['安装描述文件和开始使用套餐是两个不同的时刻。'] },
    network: {
      re: hanWord('快速|高速|稳定|可靠|信号(强|好|满格)|最佳覆盖|全面覆盖|全覆盖|保证|确保连接|随处可用|无缝|不掉线|4G|5G|LTE|VPN|翻墙|科学上网|不受限制地?访问|畅通无阻|(访问|使用|打开|登录)(谷歌|Google|WhatsApp|Facebook|Instagram|YouTube|Telegram|Gmail|ChatGPT|X)|中国大陆(也)?(可以|能|能够)(正常)?(访问|使用|上网)'),
      fires: ['全国 5G 高速网络', '支持5G网络', '无需 VPN 即可访问 Google', '在中国大陆可以正常访问 WhatsApp'],
      quiet: ['确认已开启移动数据。', '旅行 eSIM 通常通过合作网络连接。'] },
    features: {
      re: hanWord('无限(流量)?|不限量|不限流量|个人热点|热点|网络共享|接收(短信|验证码)|2FA|验证码|双重验证|包含电话号码|附带(电话)?号码'),
      fires: ['无限流量，支持个人热点', '可以接收短信验证码'],
      quiet: ['旅行期间每天一份流量额度。', '同行旅伴手机共享的网络'] },
    devices: {
      // a digit followed by a Chinese character still ends a model number («iPhone 12及以上»)
      re: /iPhone\s?(X[RS]?|\d{1,2})(?![\p{Script=Latin}\p{N}])|Galaxy\s?[SZA]\d|Pixel\s?\d/iu,
      fires: ['适用于 iPhone 12 及更新机型', 'iPhone 12及以上', 'Galaxy S21'],
      quiet: ['在 iPhone 上安装 eSIM', 'iOS 17.4 或更高版本'] },
    installEarly: {
      // advice to install early — not the question about having done it, nor «before entering mainland China»
      re: hanWord('提前(几|数|一|两|三)?(天|周|个星期)|出发前(几|数)天|(几|数)天前安装|提前安装'),
      fires: ['请提前几天安装 eSIM', '最好出发前几天安装', '建议提前安装'],
      quiet: ['请在出行当天安装 eSIM。', '我在出行前一周安装了 eSIM，套餐的有效期已经开始了吗？', '请在入境前安装 eSIM。'] },
    reusableQr: {
      re: hanWord('二维码(可以|可)(重复|多次|再次)(使用|扫描)|可(重复|多次)使用的二维码'),
      fires: ['二维码可以重复使用', '可重复使用的二维码'],
      quiet: ['请不要删除 eSIM。', '二维码可能只能使用一次。'] },
    suppliers: {
      re: hanWord('供应商|eSIM Access|MobiMatter'),
      fires: ['我们的供应商 eSIM Access', 'MobiMatter 提供 eSIM'],
      quiet: ['您的手机不能被运营商锁定。', '通过合作网络连接'] },
    marketing: {
      re: hanWord('24 ?小时|24/7|全天候|即时|立即|最(佳|好|优|便宜|低价?|快|强|稳定)|(排名|全网|行业|业界|全国|全球|销量)第一|第一(品牌|名)|NO\\.? ?1|唯一|顶级|国家级|保证|退款|无限|不限量|省钱|节省|好评|评分|值得信赖|数百万|VPN|翻墙|科学上网|(访问|使用)(谷歌|Google|WhatsApp|Facebook|YouTube)'),
      fires: ['24 小时快速客服', '最佳价格', '不满意可退款', '全网最便宜', '销量第一的 eSIM'],
      quiet: ['选择目的地，安装 eSIM，落地即可上网。', '出发前有疑问？', '以及抵达后的第一步。'] },
    template: {
      // «未被运营商锁定» (the checkout's device check) is not a claim about networks — like the French rule, only
      // operator NETWORKS and named operators are.
      re: hanWord('4G|5G|LTE|(当地|本地|合作|移动)运营商|运营商网络|网络运营商|信号|稳定|可靠|快速|高速|最(佳|好|便宜|快)|无限|不限量|保证|VPN|翻墙|(访问|使用)(谷歌|Google|WhatsApp)'),
      fires: ['支持 5G 网络', '当地运营商网络', '全国最佳网络'],
      quiet: ['日本的流量套餐，价格以美元计。', '我的手机支持 eSIM，且未被运营商锁定'] },
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
