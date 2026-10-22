// The French guides: /fr/guides/<slug>/ (I18N FR-1, 2026-10-22). Data only; seo/build-locale-pages.mjs renders them.
// Standard French (fr-FR, owner D3), addressed with «vous» (owner D1) — as Apple’s, Google’s and Samsung’s own French
// support pages do. Where Apple names a setting differently in France and Canada, both are given, France first (D3).
// French typography (D7): no-break spaces before «:» and «; ? !», guillemets with no-break spaces, the apostrophe ’.
//
// FACT POLICY — the English guides' policy (seo/guides-en.mjs), unchanged: menu paths are typical and said to vary;
// nothing about what Magic eSIM will deliver or how; no pointer to a card row the plan cards do not show; the
// start-of-term advice is the one safe for every plan (install on the day you travel, over Wi-Fi); no network-quality
// promise, no hotspot / APN / calls / SMS / 2FA guarantee, no device-model list, no payment method; a QR code «may be
// single-use». seo/claim-guards.mjs (fr) enforces these on the rendered pages. AI-assisted draft; its quality gate is the
// three-stage AI review (localization-qa skill) — nothing here may say more than the English guide it mirrors.
//
// SOURCES — every French menu label below was read on the vendor’s own French page on 2026-10-22; a label not found
// there is NOT quoted (the action is described in plain words instead):
//   Apple fr-FR support.apple.com/fr-fr/118669 (notification «Forfait cellulaire détecté», «Continuer», «Ajouter un
//               forfait cellulaire», code de confirmation; iOS 17.4+: toucher le code QR de façon prolongée → «Ajouter une
//               eSIM»; Réglages → «Données cellulaires» ou «Données mobiles» → «Ajouter un forfait cellulaire» → «Saisir les
//               données manuellement»; l’app «Appareil photo»), /fr-fr/118227 (Réglages → Général → Informations: «Aucune
//               restriction de SIM» en regard de «Verrouillage de l’opérateur»; Réglages → Données cellulaires → the line),
//               /fr-fr/109317 («itinérance des données» named, no menu path), /fr-fr/HT201415 (status «Aucun service»).
//   Apple fr-CA support.apple.com/fr-ca/118669 («Réseau cellulaire» ou «Données mobiles»; «Saisir les détails
//               manuellement»; the same «Forfait cellulaire détecté», «Continuer», «Ajouter un forfait cellulaire»).
//   Google fr   support.google.com/pixelphone/answer/16115470?hl=fr (Réseau et Internet → «Cartes SIM» → «Ajouter une
//               carte SIM» → «Configurer une eSIM»), 9449293 (Réseau et Internet → Cartes SIM → «Données mobiles»; Réseau et
//               Internet → «Réseau mobile» → «Utiliser cette carte SIM»), 2926415 (Réseau et Internet → «Profils SIM»:
//               «Itinérance», «Noms des points d’accès»), 10402530 («À propos du téléphone» → «État de la carte SIM» → EID;
//               «Pour utiliser une eSIM, le téléphone doit également disposer d’un numéro EID»). Google’s pages name the list
//               «Cartes SIM» and «Profils SIM»: both are given.
//   Samsung     samsung.com/be_fr/support/mobile-devices/la-esim-galaxy-et-les-reseaux-porteurs-supportes/ (current One UI:
//               Paramètres → Connexions → «Gestionnaire SIM» → «Ajouter une eSIM» → «Scanner le code QR»; «Entrer le code
//               d’activation»); samsung.com/fr/support/mobile-devices/how-to-install-nano-sim-card-and-esim-on-the-galaxy-s22-series/
//               (older One UI, Samsung France: «Gestionnaire de carte SIM» → «Ajout d’un forfait mobile» → «Numérisation code
//               QR opérateur»). Neither page names the data-roaming switch: the Samsung roaming step is described, not quoted.

const P = '/fr';

export const FR_GUIDES = [
  {
    slug: 'iphone',
    nav: 'iPhone',
    title: 'Installer une eSIM sur iPhone, étape par étape | Magic eSIM',
    description: 'Installez une eSIM de voyage sur iPhone avec un code QR ou en saisissant les données à la main, puis activez les données pour le voyage.',
    h1: 'Installer une eSIM sur iPhone',
    blurb: 'Par code QR ou à la main, et ce qu’il faut activer à l’arrivée.',
    lead: 'L’installation prend quelques minutes et nécessite une connexion Internet, le plus simple étant un réseau Wi-Fi. Voici tout le processus : vérifier que votre iPhone est compatible eSIM, installer le profil et activer les données cellulaires à destination.',
    sections: [
      { h2: 'Vérifiez que votre iPhone est compatible eSIM', id: 'check', html: `
        <p>Ouvrez <strong>Réglages → Données cellulaires</strong> (ou <strong>Données mobiles</strong> ; au Canada, <strong>Réseau cellulaire</strong>). Si vous y voyez <strong>Ajouter une eSIM</strong> ou <strong>Ajouter un forfait cellulaire</strong>, votre iPhone est compatible eSIM.</p>
        <p>Votre iPhone ne doit pas non plus être verrouillé par un opérateur. Voir <a href="${P}/guides/compatibility/">comment vérifier la compatibilité</a>.</p>` },
      { h2: 'Option 1 : scannez le code QR', id: 'qr', html: `
        <ol class="steps">
          <li>Affichez le code QR de votre eSIM sur un autre écran : un ordinateur, une tablette ou un autre téléphone.</li>
          <li>Sur l’iPhone, ouvrez l’app <strong>Appareil photo</strong> et scannez le code QR.</li>
          <li>Lorsque la notification <strong>Forfait cellulaire détecté</strong> apparaît, touchez-la.</li>
          <li>Touchez <strong>Continuer</strong>, puis <strong>Ajouter un forfait cellulaire</strong>. Si un code de confirmation vous est demandé, saisissez celui indiqué avec votre eSIM.</li>
          <li>Donnez à la ligne un nom clair, par exemple « Voyage », pour ne pas la confondre avec votre SIM principale.</li>
        </ol>
        <p class="note">Avec iOS 17.4 ou une version ultérieure, si le code QR se trouve dans un e-mail ou sur une page web de cet iPhone, touchez le code de façon prolongée, puis touchez <strong>Ajouter une eSIM</strong>.</p>` },
      { h2: 'Option 2 : saisissez les données à la main', id: 'manual', html: `
        <ol class="steps">
          <li>Munissez-vous des données d’installation manuelle fournies avec votre eSIM.</li>
          <li>Ouvrez <strong>Réglages → Données cellulaires</strong> (ou <strong>Données mobiles</strong>) et touchez <strong>Ajouter un forfait cellulaire</strong>.</li>
          <li>Touchez <strong>Saisir les données manuellement</strong> (au Canada, <strong>Saisir les détails manuellement</strong>) et saisissez ces données.</li>
          <li>Confirmez et attendez la fin de l’installation.</li>
        </ol>
        <p class="note">Pratique lorsque vous n’avez pas de code QR à scanner.</p>` },
      { h2: 'À destination : activez les données', id: 'data', html: `
        <ol class="steps">
          <li>Dans <strong>Réglages → Données cellulaires</strong>, vérifiez que la ligne eSIM est activée.</li>
          <li>Touchez <strong>Données cellulaires</strong> et choisissez la ligne eSIM. Votre SIM principale peut rester active pour les appels et les SMS.</li>
          <li>Ouvrez la ligne eSIM et activez l’itinérance des données. Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.</li>
          <li>Si vous ne voulez pas de frais de votre opérateur habituel, désactivez l’itinérance des données sur votre SIM principale.</li>
          <li>Attendez une ou deux minutes que le téléphone s’enregistre sur un réseau local.</li>
        </ol>
        <p class="note">Les noms des menus peuvent légèrement varier selon la version d’iOS.</p>` },
      { h2: 'Si quelque chose ne fonctionne pas', id: 'help', html: `
        <p>Vérifiez que l’eSIM est la ligne choisie pour les données et que son itinérance des données est activée, puis redémarrez le téléphone. La liste complète se trouve dans <a href="${P}/guides/troubleshooting/">L’eSIM ne fonctionne pas</a>.</p>
        <p><strong>Ne supprimez pas l’eSIM</strong> pendant que vous cherchez le problème : son code QR peut être à usage unique, et vous risquez de ne pas pouvoir la réinstaller.</p>` },
    ],
    faq: [
      { q: 'Faut-il du Wi-Fi pour installer une eSIM sur iPhone ?', a: 'Il faut une connexion Internet pour télécharger le profil, le plus simple étant un réseau Wi-Fi. Si vous installez l’eSIM le jour du voyage, chez vous avant de partir ou avec le Wi-Fi de l’aéroport, cela convient à tous les forfaits, quel que soit le moment où leur validité commence.' },
      { q: 'Le code QR est sur ce même iPhone. Puis-je quand même installer l’eSIM ?', a: 'Oui. Avec iOS 17.4 ou une version ultérieure, touchez de façon prolongée le code QR dans l’e-mail ou sur la page web, puis touchez Ajouter une eSIM. Vous pouvez aussi choisir Saisir les données manuellement et saisir les données fournies avec votre eSIM.' },
      { q: 'Que devient mon numéro principal ?', a: 'Il reste actif. Les appels et les SMS vers votre numéro principal suivent les conditions d’itinérance de votre opérateur habituel ; l’eSIM de voyage sert aux données cellulaires.' },
      { q: 'Pourquoi activer l’itinérance des données sur l’eSIM ?', a: 'Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance. L’itinérance des données sur la ligne eSIM est un réglage normal ; sur votre SIM principale, vous pouvez la laisser désactivée.' },
    ],
    related: ['android', 'compatibility', 'activation', 'troubleshooting'],
  },
  {
    slug: 'android',
    nav: 'Android',
    title: 'Installer une eSIM sur Android | Magic eSIM',
    description: 'Installez une eSIM de voyage sur Android avec un code QR ou à la main, choisissez-la pour les données mobiles et activez l’itinérance à destination.',
    h1: 'Installer une eSIM sur Android',
    blurb: 'Où se trouve généralement le réglage eSIM selon la marque, et les premiers pas à l’étranger.',
    lead: 'Chaque marque Android nomme ses réglages différemment, mais les étapes sont les mêmes : trouvez où se gèrent les SIM, ajoutez une eSIM avec son code QR ou à la main, puis choisissez-la pour les données mobiles à destination. L’installation nécessite une connexion Internet, le plus simple étant un réseau Wi-Fi.',
    sections: [
      { h2: 'Trouvez où se gèrent les SIM', id: 'find', html: `
        <p>Les réglages SIM se trouvent généralement à l’un de ces endroits ; les noms varient selon la marque et la version d’Android :</p>
        <ul class="list">
          <li><strong>Google Pixel :</strong> Paramètres → Réseau et Internet → Cartes SIM → <strong>Ajouter une carte SIM</strong> → <strong>Configurer une eSIM</strong>.</li>
          <li><strong>Samsung Galaxy :</strong> Paramètres → Connexions → Gestionnaire SIM → <strong>Ajouter une eSIM</strong> (sur les versions plus anciennes de One UI : Gestionnaire de carte SIM → <strong>Ajout d’un forfait mobile</strong>).</li>
          <li><strong>Autres marques :</strong> cherchez dans les réglages « Réseau mobile », « Cartes SIM » ou « Connexions ».</li>
        </ul>
        <p>Si vous ne trouvez nulle part l’option pour ajouter une eSIM, vérifiez <a href="${P}/guides/compatibility/">si votre téléphone est compatible eSIM</a>.</p>` },
      { h2: 'Installez l’eSIM', id: 'install', html: `
        <ol class="steps">
          <li>Affichez le code QR de votre eSIM sur un autre écran.</li>
          <li>Commencez à ajouter une eSIM comme indiqué ci-dessus. <strong>Samsung :</strong> touchez <strong>Scanner le code QR</strong> (sur les versions plus anciennes : <strong>Numérisation code QR opérateur</strong>) et scannez le code. <strong>Pixel :</strong> suivez les instructions à l’écran.</li>
          <li>Pas de code QR à scanner ? Sur Samsung, touchez <strong>Entrer le code d’activation</strong> et saisissez les données fournies avec votre eSIM (sur les versions plus anciennes de One UI, suivez l’option proposée à l’écran pour saisir un code d’activation).</li>
          <li>Confirmez et attendez la fin de l’installation.</li>
          <li>Renommez l’eSIM, par exemple « Voyage ».</li>
        </ol>` },
      { h2: 'À destination : activez les données', id: 'data', html: `
        <ol class="steps">
          <li>Vérifiez que l’eSIM est activée. Pixel : Paramètres → Réseau et Internet → Réseau mobile → l’eSIM → <strong>Utiliser cette carte SIM</strong>.</li>
          <li>Choisissez l’eSIM comme SIM pour les <strong>données mobiles</strong>. Pixel : Paramètres → Réseau et Internet → Cartes SIM → <strong>Données mobiles</strong>. Votre SIM principale peut rester active pour les appels et les SMS.</li>
          <li>Activez l’<strong>itinérance</strong> pour l’eSIM. Pixel : Paramètres → Réseau et Internet → Cartes SIM (ou Profils SIM) → <strong>Itinérance</strong>. Samsung : cherchez le réglage dans les paramètres de réseau mobile sous Connexions ; son nom exact dépend du modèle. Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.</li>
          <li>Si vous ne voulez pas de frais de votre opérateur habituel, désactivez l’itinérance des données sur votre SIM principale.</li>
          <li>Attendez une ou deux minutes que le téléphone s’enregistre sur un réseau local.</li>
        </ol>` },
      { h2: 'Si quelque chose ne fonctionne pas', id: 'help', html: `
        <p>Vérifiez la SIM choisie pour les données et l’itinérance de l’eSIM, activez puis désactivez le mode Avion et redémarrez le téléphone. La liste complète se trouve dans <a href="${P}/guides/troubleshooting/">L’eSIM ne fonctionne pas</a>.</p>
        <p><strong>Ne supprimez pas l’eSIM</strong> pendant que vous cherchez le problème : son code QR peut être à usage unique.</p>` },
    ],
    faq: [
      { q: 'Mon téléphone Android n’a pas d’option pour ajouter une eSIM. Que faire ?', a: 'Parcourez tous les menus liés à la SIM : leur nom varie selon la marque. Si aucun ne propose d’ajouter ou de télécharger une eSIM, le téléphone (ou cette version régionale) n’est probablement pas compatible eSIM.' },
      { q: 'Puis-je utiliser l’eSIM et ma SIM physique en même temps ?', a: 'Sur les téléphones double SIM compatibles eSIM, oui : choisissez l’eSIM pour les données mobiles et gardez la SIM physique pour les appels et les SMS.' },
      { q: 'Dois-je configurer un APN ?', a: 'Seulement si les informations de votre forfait indiquent un APN : vérifiez alors qu’il correspond dans les réglages de l’eSIM.' },
    ],
    related: ['iphone', 'compatibility', 'activation', 'troubleshooting'],
  },
  {
    slug: 'compatibility',
    nav: 'Compatibilité',
    title: 'Mon téléphone est-il compatible eSIM ? | Magic eSIM',
    description: 'Vérifiez la compatibilité eSIM avant de choisir un forfait : le réglage à chercher sur iPhone et Android, le verrouillage opérateur et les versions régionales.',
    h1: 'Votre téléphone est-il compatible eSIM ?',
    blurb: 'Une vérification d’une minute avant de choisir un forfait.',
    lead: 'La vérification la plus courte : ouvrez les réglages SIM et cherchez l’option pour ajouter une eSIM. Si elle est présente, le téléphone est compatible eSIM. Profitez-en pour vérifier deux autres points : le téléphone est-il verrouillé par un opérateur, et de quelle version régionale s’agit-il ?',
    sections: [
      { h2: 'Vérification 1 : le réglage', id: 'setting', html: `
        <p><strong>iPhone :</strong> Réglages → Données cellulaires (au Canada, Réseau cellulaire). Si <strong>Ajouter une eSIM</strong> ou <strong>Ajouter un forfait cellulaire</strong> apparaît, l’iPhone est compatible eSIM.</p>
        <p><strong>Android :</strong> ouvrez les réglages SIM et cherchez comment ajouter une eSIM : sur Pixel, Réseau et Internet → Cartes SIM → <strong>Ajouter une carte SIM</strong> → <strong>Configurer une eSIM</strong> ; sur Samsung, Connexions → Gestionnaire SIM → <strong>Ajouter une eSIM</strong> (sur les versions plus anciennes de One UI : Gestionnaire de carte SIM → <strong>Ajout d’un forfait mobile</strong>).</p>
        <p>Autre indice sur Pixel : pour utiliser une eSIM, le téléphone doit disposer d’un numéro <strong>EID</strong>. Vous le trouverez dans Paramètres → À propos du téléphone → État de la carte SIM. Mais c’est le réglage pour ajouter une eSIM qui fait foi.</p>` },
      { h2: 'Vérification 2 : est-il verrouillé par un opérateur ?', id: 'lock', html: `
        <p>Un téléphone acheté avec un abonnement peut être verrouillé par son opérateur et refuser les autres SIM et eSIM jusqu’à son déverrouillage.</p>
        <p>Sur iPhone, ouvrez <strong>Réglages → Général → Informations</strong> et cherchez « Aucune restriction de SIM » en regard de <strong>Verrouillage de l’opérateur</strong>. Sur Android, renseignez-vous auprès de l’opérateur qui a vendu le téléphone.</p>` },
      { h2: 'Vérification 3 : la version régionale', id: 'region', html: `
        <p>Un même modèle peut avoir l’eSIM dans un pays et pas dans un autre : la compatibilité dépend du marché pour lequel le téléphone a été fabriqué, pas seulement de son nom. C’est pourquoi nous ne publions pas de liste de « modèles compatibles » : ce sont les réglages de votre propre téléphone qui font foi.</p>` },
      { h2: 'Votre téléphone remplit les conditions : et maintenant ?', id: 'next', html: `
        <p>Choisissez une destination dans la <a href="${P}/esim/">liste des destinations</a> et découvrez comment installer l’eSIM sur <a href="${P}/guides/iphone/">iPhone</a> ou sur <a href="${P}/guides/android/">Android</a>.</p>` },
    ],
    faq: [
      { q: 'Mon téléphone accepte deux cartes SIM. Est-il compatible eSIM ?', a: 'Pas forcément : certains téléphones ont deux emplacements physiques et pas d’eSIM. Cherchez l’option pour ajouter une eSIM dans les réglages SIM.' },
      { q: 'Je ne trouve pas l’EID. Cela veut-il dire qu’il n’y a pas d’eSIM ?', a: 'Pas forcément. Ce qui fait foi, c’est l’option pour ajouter une eSIM dans les réglages.' },
      { q: 'Et si mon téléphone n’est pas compatible eSIM ?', a: 'Une eSIM de voyage n’y fonctionnera pas. Il vous faudrait un autre téléphone compatible eSIM ou une SIM physique locale à destination.' },
    ],
    related: ['iphone', 'android', 'activation', 'troubleshooting'],
  },
  {
    slug: 'activation',
    nav: 'Quand l’installer',
    title: 'Quand installer et activer une eSIM de voyage | Magic eSIM',
    description: 'Installer une eSIM et démarrer sa validité, ce n’est pas pareil : quand l’installer, quand activer la ligne et l’itinérance, et une liste pour le jour du vol.',
    h1: 'Quand installer et activer votre eSIM',
    blurb: 'Installer le profil et démarrer le forfait sont deux moments distincts.',
    lead: 'Installer l’eSIM et démarrer sa validité, ce n’est pas la même chose, et chaque forfait fixe le moment où sa validité commence. Le conseil valable pour tous les forfaits : installez l’eSIM le jour du voyage, en Wi-Fi, et activez-la pour les données à l’arrivée.',
    sections: [
      { h2: 'Quatre étapes distinctes', id: 'steps', html: `
        <ol class="steps">
          <li><strong>Installer</strong> : le téléphone télécharge le profil eSIM à l’aide du code QR. Il faut Internet.</li>
          <li><strong>Activer la ligne</strong> : l’eSIM apparaît comme active dans votre liste de SIM.</li>
          <li><strong>La choisir pour les données mobiles</strong> : Internet passe par l’eSIM.</li>
          <li><strong>Activer l’itinérance des données</strong> sur l’eSIM : elle peut alors utiliser des réseaux partenaires à l’étranger.</li>
        </ol>` },
      { h2: 'Quand la validité commence-t-elle ?', id: 'validity', html: `
        <p>Cela dépend du forfait. Certains forfaits commencent à courir quand l’eSIM se connecte pour la première fois à un réseau à destination ou utilise des données pour la première fois. D’autres commencent dès l’installation de l’eSIM.</p>
        <p>C’est pourquoi le conseil qui ne vous fait jamais perdre de jours est d’<strong>installer l’eSIM le jour du voyage</strong> (chez vous avant de partir ou avec le Wi-Fi de l’aéroport) et de l’activer pour les données à l’atterrissage.</p>` },
      { h2: 'Liste pour le jour du vol', id: 'checklist', html: `
        <ul class="list">
          <li>Votre téléphone est compatible eSIM et n’est pas verrouillé par un opérateur (<a href="${P}/guides/compatibility/">vérifier</a>).</li>
          <li>Vous avez sous la main le code QR de l’eSIM, ou ses données d’installation manuelle, enregistrés là où vous pouvez les ouvrir hors connexion.</li>
          <li>Vous installez l’eSIM en Wi-Fi (<a href="${P}/guides/iphone/">iPhone</a>, <a href="${P}/guides/android/">Android</a>).</li>
          <li>Votre SIM principale reste chargée des données jusqu’à l’atterrissage.</li>
        </ul>` },
      { h2: 'Après l’atterrissage', id: 'landed', html: `
        <ol class="steps">
          <li>Activez la ligne eSIM si elle est désactivée.</li>
          <li>Choisissez l’eSIM pour les données mobiles.</li>
          <li>Activez l’itinérance des données sur l’eSIM.</li>
          <li>Attendez une à trois minutes. Pas de réseau ? Activez puis désactivez le mode Avion.</li>
          <li>Toujours rien ? Consultez <a href="${P}/guides/troubleshooting/">L’eSIM ne fonctionne pas</a>.</li>
        </ol>` },
      { h2: 'Arrivé sans avoir installé l’eSIM, et sans Wi-Fi ?', id: 'no-wifi', html: `
        <p>Il faut Internet pour télécharger le profil. Solutions : le Wi-Fi gratuit de l’aéroport, ou la connexion partagée depuis le téléphone d’un compagnon de voyage. La saisie manuelle des données nécessite elle aussi Internet pour télécharger le profil.</p>` },
    ],
    faq: [
      { q: 'J’ai installé l’eSIM une semaine avant le voyage. La validité du forfait a-t-elle déjà commencé ?', a: 'Cela dépend du forfait : certains commencent à l’installation, d’autres à la première connexion ou à la première utilisation de données à destination. Pour être sûr avec tous les forfaits, installez l’eSIM le jour du voyage.' },
      { q: 'Activer l’itinérance des données chez soi coûte-t-il quelque chose ?', a: 'L’interrupteur lui-même ne coûte rien ; il permet seulement à la ligne d’utiliser des réseaux partenaires. Ce qui compte, c’est la ligne choisie pour les données mobiles et les conditions de votre forfait.' },
      { q: 'Je suis arrivé et je n’ai pas Internet. Combien de temps attendre ?', a: 'L’enregistrement prend généralement une ou deux minutes après l’activation des données et de l’itinérance de l’eSIM. Activer puis désactiver le mode Avion aide souvent. Si après 10 à 15 minutes il n’y a toujours pas de réseau, suivez la liste de dépannage.' },
    ],
    related: ['iphone', 'android', 'troubleshooting', 'compatibility'],
  },
  {
    slug: 'troubleshooting',
    nav: 'Dépannage',
    title: 'L’eSIM ne fonctionne pas à l’étranger ? | Magic eSIM',
    description: 'Check-list pas à pas pour une eSIM de voyage sans réseau ni Internet : ligne de données, itinérance, mode Avion, choix du réseau, quand ne pas supprimer l’eSIM.',
    h1: 'L’eSIM ne fonctionne pas : que vérifier',
    blurb: 'Une liste, dans l’ordre qui résout la plupart des problèmes.',
    lead: 'La plupart des problèmes viennent d’un réglage. Suivez les étapes dans l’ordre et testez Internet après chacune. Ne supprimez pas l’eSIM pendant que vous cherchez le problème.',
    sections: [
      { h2: 'La liste', id: 'checklist', html: `
        <ol class="steps">
          <li><strong>La ligne eSIM est-elle activée ?</strong> Vérifiez dans les réglages SIM.</li>
          <li><strong>L’eSIM est-elle choisie pour les données mobiles ?</strong> Internet doit passer par l’eSIM, pas par votre SIM principale.</li>
          <li><strong>L’itinérance des données est-elle activée sur l’eSIM ?</strong> Les eSIM de voyage se connectent généralement via des réseaux partenaires, et le téléphone considère cela comme de l’itinérance.</li>
          <li><strong>Activez le mode Avion</strong> pendant dix secondes, puis désactivez-le.</li>
          <li><strong>Redémarrez le téléphone.</strong></li>
          <li><strong>Choisissez un réseau à la main.</strong> Dans les réglages réseau de l’eSIM, désactivez la sélection automatique et choisissez un autre réseau dans la liste.</li>
          <li><strong>Vérifiez l’APN</strong>, uniquement si les informations de votre forfait en indiquent un : il doit correspondre dans les réglages de l’eSIM.</li>
          <li><strong>Êtes-vous dans la zone de couverture du forfait ?</strong> Vérifiez que le pays où vous vous trouvez fait partie des pays couverts par le forfait.</li>
        </ol>` },
      { h2: 'Du réseau, mais pas d’Internet', id: 'no-internet', html: `
        <p>Le téléphone est enregistré, mais les données ne passent pas. Le plus souvent, l’eSIM n’est pas la ligne choisie pour les données mobiles, ou son itinérance des données est désactivée. Vérifiez les deux, puis activez et désactivez le mode Avion.</p>` },
      { h2: 'Ne supprimez pas l’eSIM', id: 'dont-delete', html: `
        <p>Supprimer l’eSIM ne résout presque jamais rien, et son code QR peut être à usage unique : vous risquez de ne pas pouvoir la réinstaller. Laissez-la installée pendant que vous suivez la liste.</p>` },
      { h2: 'Toujours pas de connexion ?', id: 'contact', html: `
        <p>Si vous avez suivi toute la liste et que l’eSIM ne fonctionne toujours pas, écrivez-nous à <a href="mailto:support@magicesim.store">support@magicesim.store</a>.</p>` },
    ],
    faq: [
      { q: 'L’eSIM affiche « Aucun service ». Que faire en premier ?', a: 'Vérifiez que l’itinérance des données est activée sur l’eSIM, activez puis désactivez le mode Avion et attendez quelques minutes. Essayez ensuite de choisir un réseau à la main.' },
      { q: 'Puis-je réinstaller l’eSIM avec le même code QR ?', a: 'Souvent non : un code QR peut être à usage unique. C’est pourquoi la liste vous dit de ne pas supprimer l’eSIM.' },
      { q: 'Ma SIM principale peut-elle me coûter quelque chose pendant que je cherche le problème ?', a: 'Si la SIM principale est choisie pour les données mobiles et que son itinérance des données est activée, votre opérateur habituel peut vous facturer. Gardez l’eSIM comme ligne de données ou désactivez l’itinérance des données sur la SIM principale.' },
    ],
    related: ['iphone', 'android', 'activation', 'compatibility'],
  },
];
