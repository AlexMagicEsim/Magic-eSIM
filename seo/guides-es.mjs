// The Spanish guides: /es/guides/<slug>/ (I18N ES-1, 2026-10-21). Data only; seo/build-locale-pages.mjs renders them.
// Neutral international Spanish (owner, D1): «tú», no «vosotros»; where Spain and Latin America name a setting
// differently, BOTH names are given, Spain's first, because a phone shows the one of its own language setting.
//
// FACT POLICY — the English guides' policy (seo/guides-en.mjs), unchanged: menu paths are typical and said to vary;
// nothing about what Magic eSIM will deliver or how; no pointer to a card row the plan cards do not show; the
// start-of-term advice is the one safe for every plan (install on the day you travel, over Wi-Fi); no network-quality
// promise, no hotspot / APN / calls / SMS / 2FA guarantee, no device-model list, no payment method; a QR code «may be
// single-use». seo/claim-guards.mjs (es) enforces these on the rendered pages. AI-assisted draft: a native review is
// part of publishing (ES-1r) — nothing here may say more than the English guide it mirrors.
//
// SOURCES — every Spanish menu label below was read on the vendor's own Spanish page on 2026-10-21; a label not found
// there is NOT quoted (the action is described in plain words instead):
//   Apple es-ES support.apple.com/es-es/118669 («Plan móvil detectado», «Continuar», «Añadir plan móvil»; iOS 17.4+
//               «Añadir eSIM»; Ajustes → Datos móviles → Añadir plan móvil → «Introducir Detalles Manualmente»),
//               /es-es/118227 (Ajustes → General → Información: «Sin restricción de SIM» junto a «Bloqueo del Operador»;
//               Ajustes → Datos Móviles → Datos Móviles), /es-es/109317 («Etiqueta del plan móvil»; «itinerancia de datos»
//               named, no menu path).
//   Apple es-MX support.apple.com/es-mx/118669 («Plan de datos celulares detectado»; «Agregar eSIM»; Configuración →
//               Datos celulares o Datos móviles → «Agregar plan de datos» → «Ingresar detalles manualmente»), /es-mx/118227
//               (Configuración → General → Información: «Sin restricción de SIM» junto a «Bloq. de operador»;
//               Configuración → Datos celulares → Datos celulares), /es-mx/109317 («Etiqueta de plan de datos»; «roaming
//               de datos» named, no menu path).
//   Google es-419 support.google.com/pixelphone/answer/16115470 (Configuración → «Internet y redes» → «Tarjetas SIM» →
//               «Agregar una SIM» → «Configurar una eSIM»), 9449293 (Internet y redes → «SIMs» → «Datos móviles»;
//               Internet y redes → «Red móvil» → «Usar esta SIM»), 2926415 (Internet y redes → «SIM» → «Roaming»;
//               «Nombres de puntos de acceso»), 10402530 («Acerca del dispositivo» → «Estado de SIM» → EID; «Para usar una
//               eSIM, el teléfono también necesita un número EID»). Google's two pages name the list «Tarjetas SIM» and
//               «SIMs»: both are given.
//   Samsung es  samsung.com/es/support/mobile-devices/esim-de-galaxy-y-operadores-de-red-compatibles/ (Ajustes →
//               Conexiones → «Gestor de SIM» → «Añadir eSIM» → «Escanear código QR»; «Introducir código de activación»).
//               NO official Spanish Samsung page names the data-roaming switch (only community threads do), so the
//               Samsung roaming step is described, not quoted.

const P = '/es';

export const ES_GUIDES = [
  // ------------------------------------------------------------------ iPhone
  {
    slug: 'iphone',
    nav: 'iPhone',
    title: 'Cómo instalar una eSIM en iPhone, paso a paso | Magic eSIM',
    description: 'Instala una eSIM de viaje en iPhone con un código QR o introduciendo los datos a mano, y activa los datos para el viaje.',
    h1: 'Cómo instalar una eSIM en iPhone',
    blurb: 'Con código QR o a mano, y qué activar al aterrizar.',
    lead: 'La instalación tarda unos minutos y necesita conexión a internet; lo más sencillo es una red Wi-Fi. A continuación tienes todo el proceso: comprobar que tu iPhone admite eSIM, instalar el perfil y activar los datos móviles en tu destino.',
    sections: [
      { h2: 'Comprueba que tu iPhone admite eSIM', id: 'check', html: `
        <p>Abre <strong>Ajustes → Datos móviles</strong> (en algunas regiones, <strong>Configuración → Datos celulares</strong>). Si ves <strong>Añadir eSIM</strong> o <strong>Añadir plan móvil</strong> (<strong>Agregar eSIM</strong> o <strong>Agregar plan de datos</strong>), tu iPhone admite eSIM.</p>
        <p>Además, tu iPhone no debe estar bloqueado por un operador. Consulta <a href="${P}/guides/compatibility/">cómo comprobar la compatibilidad</a>.</p>` },
      { h2: 'Opción 1: escanea el código QR', id: 'qr', html: `
        <ol class="steps">
          <li>Muestra el código QR de tu eSIM en otra pantalla: un ordenador, una tableta u otro teléfono.</li>
          <li>En el iPhone, abre la app <strong>Cámara</strong> y escanea el código QR.</li>
          <li>Cuando aparezca la notificación <strong>Plan móvil detectado</strong> (<strong>Plan de datos celulares detectado</strong>), tócala.</li>
          <li>Toca <strong>Continuar</strong> y después <strong>Añadir plan móvil</strong>. Si se te pide un código de confirmación, introduce el que se indica con tu eSIM.</li>
          <li>Pon a la línea un nombre claro, por ejemplo «Viaje», para no confundirla con tu SIM principal.</li>
        </ol>
        <p class="note">Con iOS 17.4 o posterior, si el código QR está en un correo o en una página web del propio iPhone, mantén pulsado el código y toca <strong>Añadir eSIM</strong> (<strong>Agregar eSIM</strong>).</p>` },
      { h2: 'Opción 2: introduce los datos a mano', id: 'manual', html: `
        <ol class="steps">
          <li>Busca los datos para la instalación manual que acompañan a tu eSIM.</li>
          <li>Abre <strong>Ajustes → Datos móviles</strong> y toca <strong>Añadir plan móvil</strong> (en algunas regiones, <strong>Configuración → Datos celulares → Agregar plan de datos</strong>).</li>
          <li>Toca <strong>Introducir Detalles Manualmente</strong> (<strong>Ingresar detalles manualmente</strong>) y escribe esos datos.</li>
          <li>Confirma y espera a que termine la instalación.</li>
        </ol>
        <p class="note">Útil cuando no tienes un código QR que escanear.</p>` },
      { h2: 'En tu destino: activa los datos', id: 'data', html: `
        <ol class="steps">
          <li>En <strong>Ajustes → Datos móviles</strong> (<strong>Configuración → Datos celulares</strong>), comprueba que la línea eSIM está activada.</li>
          <li>Toca <strong>Datos móviles</strong> (<strong>Datos celulares</strong>) y elige la línea eSIM. Tu SIM principal puede seguir activa para llamadas.</li>
          <li>Abre la línea eSIM y activa la itinerancia de datos (en algunas regiones se llama roaming de datos). Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.</li>
          <li>Si no quieres cargos de tu operador habitual, desactiva la itinerancia de datos en tu SIM principal.</li>
          <li>Espera uno o dos minutos a que el teléfono se registre en una red local.</li>
        </ol>
        <p class="note">Los nombres de los menús pueden variar un poco según la versión de iOS y el idioma del teléfono.</p>` },
      { h2: 'Si algo no funciona', id: 'help', html: `
        <p>Comprueba que la eSIM es la línea elegida para los datos y que tiene la itinerancia de datos activada, y reinicia el teléfono. La lista completa está en <a href="${P}/guides/troubleshooting/">La eSIM no funciona</a>.</p>
        <p><strong>No borres la eSIM</strong> mientras buscas el problema: su código QR puede ser de un solo uso y es posible que no puedas volver a instalarla.</p>` },
    ],
    faq: [
      { q: '¿Necesito Wi-Fi para instalar una eSIM en iPhone?', a: 'Necesitas conexión a internet para descargar el perfil, y lo más sencillo es una red Wi-Fi. Instalarla el día del viaje, antes de salir de casa o con el Wi-Fi del aeropuerto, funciona sean cuales sean las reglas del plan sobre cuándo empieza su validez.' },
      { q: 'El código QR está en este mismo iPhone. ¿Puedo instalarla igualmente?', a: 'Sí. Con iOS 17.4 o posterior, mantén pulsado el código QR en el correo o en la página web y toca Añadir eSIM (Agregar eSIM). O elige Introducir Detalles Manualmente (Ingresar detalles manualmente) y escribe los datos que acompañan a tu eSIM.' },
      { q: '¿Qué pasa con mi número principal?', a: 'Sigue activo. Las llamadas a tu número principal siguen las condiciones de itinerancia de tu operador habitual; la eSIM de viaje se usa para los datos móviles.' },
      { q: '¿Por qué activar la itinerancia de datos en la eSIM?', a: 'Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia. Activarla en la línea eSIM es un ajuste normal; en tu SIM principal puedes dejarla desactivada.' },
    ],
    related: ['android', 'compatibility', 'activation', 'troubleshooting'],
  },

  // ----------------------------------------------------------------- Android
  {
    slug: 'android',
    nav: 'Android',
    title: 'Cómo instalar una eSIM en Android: Samsung, Pixel y otros | Magic eSIM',
    description: 'Instala una eSIM de viaje en un teléfono Android con un código QR o a mano, elígela para los datos móviles y activa el roaming en tu destino.',
    h1: 'Cómo instalar una eSIM en Android',
    blurb: 'Dónde suele estar el ajuste de eSIM según la marca, y los primeros pasos en el extranjero.',
    lead: 'Cada marca de Android llama a sus ajustes de forma distinta, pero los pasos son los mismos: encuentra dónde se gestionan las SIM, añade una eSIM con su código QR o a mano y elígela para los datos móviles en tu destino. Para instalarla necesitas conexión a internet; lo más sencillo es una red Wi-Fi.',
    sections: [
      { h2: 'Encuentra dónde se gestionan las SIM', id: 'find', html: `
        <p>Los ajustes de la SIM suelen estar en uno de estos lugares; los nombres cambian según la marca y la versión de Android:</p>
        <ul class="list">
          <li><strong>Google Pixel:</strong> Configuración → Internet y redes → Tarjetas SIM (o SIMs) → <strong>Agregar una SIM</strong> → <strong>Configurar una eSIM</strong>.</li>
          <li><strong>Samsung Galaxy:</strong> Ajustes → Conexiones → Gestor de SIM → <strong>Añadir eSIM</strong>.</li>
          <li><strong>Otras marcas:</strong> busca en los ajustes «Red móvil», «Tarjetas SIM» o «Conexiones».</li>
        </ul>
        <p>Si no encuentras en ningún sitio la opción de añadir una eSIM, consulta <a href="${P}/guides/compatibility/">si tu teléfono admite eSIM</a>.</p>` },
      { h2: 'Instala la eSIM', id: 'install', html: `
        <ol class="steps">
          <li>Muestra el código QR de tu eSIM en otra pantalla.</li>
          <li>Empieza a añadir una eSIM como se indica arriba. <strong>Samsung:</strong> toca <strong>Escanear código QR</strong> y escanea el código. <strong>Pixel:</strong> sigue las instrucciones de la pantalla.</li>
          <li>¿No tienes un código QR que escanear? En Samsung, toca <strong>Introducir código de activación</strong> y escribe los datos que acompañan a tu eSIM.</li>
          <li>Confirma y espera a que termine la instalación.</li>
          <li>Cambia el nombre de la eSIM, por ejemplo a «Viaje».</li>
        </ol>` },
      { h2: 'En tu destino: activa los datos', id: 'data', html: `
        <ol class="steps">
          <li>Comprueba que la eSIM está activada. Pixel: Configuración → Internet y redes → Red móvil → la eSIM → <strong>Usar esta SIM</strong>.</li>
          <li>Elige la eSIM como SIM para los <strong>datos móviles</strong>. Pixel: Configuración → Internet y redes → SIMs → <strong>Datos móviles</strong>. Tu SIM principal puede seguir activa para llamadas.</li>
          <li>Activa el <strong>roaming</strong> para la eSIM. Pixel: Configuración → Internet y redes → SIM → <strong>Roaming</strong>. Samsung: búscalo en los ajustes de red móvil de Conexiones; el nombre exacto depende del modelo. Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como roaming.</li>
          <li>Si no quieres cargos de tu operador habitual, desactiva el roaming de datos en tu SIM principal.</li>
          <li>Espera uno o dos minutos a que el teléfono se registre en una red local.</li>
        </ol>` },
      { h2: 'Si algo no funciona', id: 'help', html: `
        <p>Comprueba la SIM elegida para los datos y el roaming de la eSIM, activa y desactiva el modo avión y reinicia. La lista completa está en <a href="${P}/guides/troubleshooting/">La eSIM no funciona</a>.</p>
        <p><strong>No borres la eSIM</strong> mientras buscas el problema: su código QR puede ser de un solo uso.</p>` },
    ],
    faq: [
      { q: 'Mi teléfono Android no tiene la opción de añadir una eSIM. ¿Qué hago?', a: 'Revisa todos los menús relacionados con la SIM: el nombre cambia según la marca. Si en ningún sitio existe la opción de añadir o descargar una eSIM, probablemente el teléfono (o esta versión regional) no admite eSIM.' },
      { q: '¿Puedo usar la eSIM y mi SIM física a la vez?', a: 'En los teléfonos que admiten SIM dual con eSIM, sí: elige la eSIM para los datos móviles y mantén la SIM física para las llamadas.' },
      { q: '¿Tengo que configurar un APN?', a: 'Solo si los datos de tu plan indican un APN: en ese caso, comprueba que coincide en los ajustes de la eSIM (en Pixel, «Nombres de puntos de acceso»).' },
    ],
    related: ['iphone', 'compatibility', 'activation', 'troubleshooting'],
  },

  // ----------------------------------------------------------- compatibility
  {
    slug: 'compatibility',
    nav: 'Compatibilidad',
    title: '¿Mi teléfono admite eSIM? Cómo comprobarlo | Magic eSIM',
    description: 'Comprueba la compatibilidad con eSIM antes de elegir un plan: el ajuste que debes buscar en iPhone y Android, el bloqueo de operador y las versiones regionales.',
    h1: '¿Tu teléfono admite eSIM?',
    blurb: 'Una comprobación de un minuto antes de elegir un plan.',
    lead: 'La comprobación más sencilla: abre los ajustes de la SIM y busca la opción de añadir una eSIM. Si está, el teléfono admite eSIM. Aprovecha para comprobar dos cosas más: si el teléfono está bloqueado por un operador y qué versión regional tienes.',
    sections: [
      { h2: 'Comprobación 1: el ajuste', id: 'setting', html: `
        <p><strong>iPhone:</strong> Ajustes → Datos móviles (Configuración → Datos celulares). Si aparece <strong>Añadir eSIM</strong> o <strong>Añadir plan móvil</strong> (<strong>Agregar eSIM</strong> o <strong>Agregar plan de datos</strong>), el iPhone admite eSIM.</p>
        <p><strong>Android:</strong> abre los ajustes de la SIM y busca cómo añadir una eSIM: en Pixel, Internet y redes → Tarjetas SIM → <strong>Agregar una SIM</strong> → <strong>Configurar una eSIM</strong>; en Samsung, Conexiones → Gestor de SIM → <strong>Añadir eSIM</strong>.</p>
        <p>Una pista más en Pixel: para usar una eSIM, el teléfono necesita un número <strong>EID</strong>. Lo encontrarás en Configuración → Acerca del dispositivo → Estado de SIM. Aun así, lo que decide es el ajuste para añadir una eSIM.</p>` },
      { h2: 'Comprobación 2: ¿está bloqueado por un operador?', id: 'lock', html: `
        <p>Un teléfono comprado con contrato puede estar bloqueado por su operador y rechazar otras SIM y eSIM hasta que se libere.</p>
        <p>En iPhone, abre <strong>Ajustes → General → Información</strong> (<strong>Configuración → General → Información</strong>) y busca «Sin restricción de SIM» junto a <strong>Bloqueo del Operador</strong> (<strong>Bloq. de operador</strong>). En Android, pregunta al operador que vendió el teléfono.</p>` },
      { h2: 'Comprobación 3: la versión regional', id: 'region', html: `
        <p>El mismo modelo puede tener eSIM en un país y no en otro: la compatibilidad depende del mercado para el que se fabricó el teléfono, no solo de su nombre. Por eso no publicamos una lista de «modelos compatibles»: lo que decide son los ajustes de tu propio teléfono.</p>` },
      { h2: 'Tu teléfono cumple los requisitos: ¿y ahora?', id: 'next', html: `
        <p>Elige un destino en la <a href="${P}/esim/">lista de destinos</a> y consulta cómo instalar la eSIM en <a href="${P}/guides/iphone/">iPhone</a> o en <a href="${P}/guides/android/">Android</a>.</p>` },
    ],
    faq: [
      { q: 'Mi teléfono admite dos tarjetas SIM. ¿Significa que tiene eSIM?', a: 'No necesariamente: algunos teléfonos tienen dos ranuras físicas y no tienen eSIM. Busca la opción de añadir una eSIM en los ajustes de la SIM.' },
      { q: 'No encuentro el EID. ¿Significa que no hay eSIM?', a: 'No necesariamente. La comprobación que decide es la opción de añadir una eSIM en los ajustes.' },
      { q: '¿Y si mi teléfono no admite eSIM?', a: 'Una eSIM de viaje no funcionará en él. Necesitarías otro teléfono con eSIM o una SIM física local en tu destino.' },
    ],
    related: ['iphone', 'android', 'activation', 'troubleshooting'],
  },

  // -------------------------------------------------------------- activation
  {
    slug: 'activation',
    nav: 'Cuándo instalarla',
    title: 'Cuándo instalar y activar una eSIM de viaje | Magic eSIM',
    description: 'Instalar una eSIM y empezar su validez son cosas distintas. Cuándo instalarla, cuándo activar la línea y la itinerancia de datos, y una lista para el día del vuelo.',
    h1: 'Cuándo instalar y activar tu eSIM',
    blurb: 'Instalar el perfil y empezar el plan son momentos distintos.',
    lead: 'Instalar la eSIM y empezar su validez no son lo mismo, y cada plan decide cuándo empieza la validez. El consejo que sirve para cualquier plan: instálala el día del viaje, con Wi-Fi, y actívala para los datos al llegar.',
    sections: [
      { h2: 'Cuatro pasos distintos', id: 'steps', html: `
        <ol class="steps">
          <li><strong>Instalar</strong>: el teléfono descarga el perfil eSIM con el código QR. Necesita internet.</li>
          <li><strong>Activar la línea</strong>: la eSIM aparece como activa en tu lista de SIM.</li>
          <li><strong>Elegirla para los datos móviles</strong>: internet pasa por la eSIM.</li>
          <li><strong>Activar la itinerancia de datos</strong> en la eSIM: le permite usar redes asociadas en el extranjero.</li>
        </ol>` },
      { h2: '¿Cuándo empieza la validez?', id: 'validity', html: `
        <p>Depende del plan. Algunos planes empiezan a contar cuando la eSIM se conecta por primera vez a una red en el destino o usa datos por primera vez. Otros empiezan en cuanto la eSIM se instala.</p>
        <p>Por eso, el consejo que nunca te hace perder días es <strong>instalarla el día del viaje</strong> (en casa antes de salir o con el Wi-Fi del aeropuerto) y activarla para los datos al aterrizar.</p>` },
      { h2: 'Lista para el día del vuelo', id: 'checklist', html: `
        <ul class="list">
          <li>Tu teléfono admite eSIM y está liberado (<a href="${P}/guides/compatibility/">compruébalo</a>).</li>
          <li>Tienes a mano el código QR de la eSIM, o sus datos para la instalación manual, guardados donde puedas abrirlos sin conexión.</li>
          <li>Instalas la eSIM con Wi-Fi (<a href="${P}/guides/iphone/">iPhone</a>, <a href="${P}/guides/android/">Android</a>).</li>
          <li>Mantienes tu SIM principal para los datos hasta aterrizar.</li>
        </ul>` },
      { h2: 'Después de aterrizar', id: 'landed', html: `
        <ol class="steps">
          <li>Activa la línea eSIM, si está desactivada.</li>
          <li>Elige la eSIM para los datos móviles.</li>
          <li>Activa la itinerancia de datos en la eSIM.</li>
          <li>Espera de uno a tres minutos. ¿No hay red? Activa y desactiva el modo avión.</li>
          <li>¿Sigue sin funcionar? Revisa <a href="${P}/guides/troubleshooting/">La eSIM no funciona</a>.</li>
        </ol>` },
      { h2: '¿Has aterrizado sin instalar la eSIM y sin Wi-Fi?', id: 'no-wifi', html: `
        <p>Necesitas internet para descargar el perfil. Opciones: el Wi-Fi gratuito del aeropuerto o la conexión compartida desde el teléfono de un acompañante. Introducir los datos a mano también necesita internet para descargar el perfil.</p>` },
    ],
    faq: [
      { q: 'Instalé la eSIM una semana antes del viaje. ¿El plan ya está contando?', a: 'Depende del plan: algunos empiezan a contar al instalarla y otros con la primera conexión o el primer uso de datos en el destino. Para ir sobre seguro con cualquier plan, instálala el día del viaje.' },
      { q: '¿Activar la itinerancia de datos en casa cuesta algo?', a: 'El interruptor en sí no cobra nada; solo permite que la línea use redes asociadas. Lo que importa es qué línea está elegida para los datos móviles y las condiciones de tu plan.' },
      { q: 'He aterrizado y no hay internet. ¿Cuánto debo esperar?', a: 'El registro suele tardar uno o dos minutos después de activar los datos y la itinerancia de la eSIM. Activar y desactivar el modo avión suele ayudar. Si después de 10 a 15 minutos sigue sin haber red, revisa la lista de solución de problemas.' },
    ],
    related: ['iphone', 'android', 'troubleshooting', 'compatibility'],
  },

  // ---------------------------------------------------------- troubleshooting
  {
    slug: 'troubleshooting',
    nav: 'Solución de problemas',
    title: 'La eSIM no funciona en el extranjero: qué revisar | Magic eSIM',
    description: 'Una lista paso a paso cuando una eSIM de viaje no tiene red ni internet: línea de datos, itinerancia, modo avión, selección de red y por qué no borrar la eSIM.',
    h1: 'La eSIM no funciona: qué revisar',
    blurb: 'Una lista, en el orden que resuelve la mayoría de los problemas.',
    lead: 'La mayoría de los problemas se deben a un ajuste. Sigue los pasos en orden y prueba internet después de cada uno. No borres la eSIM mientras buscas el problema.',
    sections: [
      { h2: 'La lista', id: 'checklist', html: `
        <ol class="steps">
          <li><strong>¿Está activada la línea eSIM?</strong> Revisa los ajustes de la SIM.</li>
          <li><strong>¿Está elegida la eSIM para los datos móviles?</strong> Internet tiene que pasar por la eSIM, no por tu SIM principal.</li>
          <li><strong>¿Está activada la itinerancia de datos en la eSIM?</strong> Las eSIM de viaje suelen conectarse a través de redes asociadas, y el teléfono lo trata como itinerancia.</li>
          <li><strong>Activa el modo avión</strong> durante diez segundos y desactívalo.</li>
          <li><strong>Reinicia el teléfono.</strong></li>
          <li><strong>Elige una red a mano.</strong> En los ajustes de red de la eSIM, desactiva la selección automática y elige otra red de la lista.</li>
          <li><strong>Revisa el APN</strong>, solo si los datos de tu plan indican uno: debe coincidir en los ajustes de la eSIM.</li>
          <li><strong>¿Estás dentro de la cobertura del plan?</strong> Comprueba que el país en el que estás figura entre los países que cubre el plan.</li>
        </ol>` },
      { h2: 'Hay red, pero no hay internet', id: 'no-internet', html: `
        <p>El teléfono está registrado, pero los datos no pasan. Lo más habitual es que la eSIM no sea la línea elegida para los datos móviles o que tenga la itinerancia de datos desactivada. Revisa ambas cosas y luego activa y desactiva el modo avión.</p>` },
      { h2: 'No borres la eSIM', id: 'dont-delete', html: `
        <p>Borrar la eSIM casi nunca soluciona nada, y su código QR puede ser de un solo uso: es posible que no puedas volver a instalarla. Déjala instalada mientras sigues la lista.</p>` },
      { h2: '¿Sigue sin funcionar?', id: 'contact', html: `
        <p>Si has seguido toda la lista y la eSIM sigue sin funcionar, escríbenos a <a href="mailto:support@magicesim.store">support@magicesim.store</a>.</p>` },
    ],
    faq: [
      { q: 'La eSIM indica que no hay servicio. ¿Qué hago primero?', a: 'Comprueba que la itinerancia de datos está activada en la eSIM, activa y desactiva el modo avión y espera un par de minutos. Después, prueba a elegir una red a mano.' },
      { q: '¿Puedo reinstalar la eSIM con el mismo código QR?', a: 'A menudo no: un código QR puede ser de un solo uso. Por eso la lista te dice que no borres la eSIM.' },
      { q: '¿Me cobrará mi SIM principal mientras busco el problema?', a: 'Si la SIM principal está elegida para los datos móviles y tiene la itinerancia de datos activada, tu operador habitual puede cobrarte. Mantén la eSIM como línea de datos o desactiva la itinerancia de datos en la SIM principal.' },
    ],
    related: ['iphone', 'android', 'activation', 'compatibility'],
  },
];
