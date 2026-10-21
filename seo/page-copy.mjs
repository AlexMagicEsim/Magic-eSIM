// The words of the locale pages that the BROWSER dictionary does not carry —
// titles, descriptions, headings, the checkout steps, accessibility labels —
// per language, for seo/build-locale-pages.mjs (I18N-08).
//
// Two dictionaries on purpose. assets/site-i18n.js holds the words the
// browser re-applies at runtime (`data-i18n`) and is shipped to every visitor
// under a content hash; these never change after the page is built, so they
// stay at build time and add nothing to a download.
//
// English and Spanish exist. A language is added here — written for its readers,
// held to the English copy's facts, reviewed — in the stage that publishes it;
// until then seo/build-locale-pages.mjs refuses to build it. `esc`-ed values (country names) are passed in already escaped.

const freeze = (o) => Object.freeze(o);

export const PAGE_COPY = freeze({
  en: freeze({
    skipLink: 'Skip to main content',
    navLabel: 'Main',
    menuLabel: 'Menu',
    // the language switch's label once it is a list (two or more other languages)
    langMenu: 'Language',
    support: 'Support:',
    // the home (seo/home-page.mjs)
    homeTitle: 'Magic eSIM — travel data abroad without roaming',
    homeDescription: 'Pick a destination, install an eSIM and land connected. Magic eSIM covers 190+ destinations with no plastic SIM and no airport queue.',
    homeOgDescription: 'Pick a destination, install an eSIM and land connected.',
    homeNojsSearch: 'Search needs JavaScript.',
    homeNojsBrowse: 'Browse all destinations',
    homeReadGuide: 'Read the guide →',
    // the decorative data pass in the hero (aria-hidden; every word a fact about the product)
    homeArtBack: 'eSIM · DATA PASS',
    homeArtTitle: 'Data pass',
    homeArtCoverage: 'Coverage',
    homeArtCoverageValue: '190+ destinations',
    homeArtType: 'Type',
    homeArtInstall: 'Install by<br>QR code',
    /* The six quick links under the home's search, by ISO code — named and linked from this language's own pages. */
    quick: freeze(['TH', 'TR', 'JP', 'US', 'VN', 'FR']),
    /* The destinations the footer and the hub feature, in this language's own
     * order and names. Every slug must have a page; seo/test-en-home.mjs checks it. */
    popular: freeze([
      freeze({ iso: 'TH', slug: 'thailand', name: 'Thailand' }),
      freeze({ iso: 'TR', slug: 'turkey', name: 'Türkiye' }),
      freeze({ iso: 'AE', slug: 'uae', name: 'United Arab Emirates' }),
      freeze({ iso: 'JP', slug: 'japan', name: 'Japan' }),
      freeze({ iso: 'US', slug: 'usa', name: 'United States' }),
      freeze({ iso: 'IT', slug: 'italy', name: 'Italy' }),
      freeze({ iso: 'ES', slug: 'spain', name: 'Spain' }),
      freeze({ iso: 'GB', slug: 'united-kingdom', name: 'United Kingdom' }),
    ]),
    // checkout window
    yourPlan: 'Your plan',
    esimFor: (name) => `eSIM for ${name}`,
    steps: freeze(['Plan', 'Details', 'Review']),
    // «Before you buy»
    beforeYouBuy: 'Before you buy',
    // a country page
    countryTitle: (name) => `eSIM for ${name} — data plans in US dollars | Magic eSIM`,
    countryDescription: (name) => `eSIM data plans that cover ${name}, with prices in US dollars. Online payment is not available yet.`,
    countryLead: (name) => `Data plans that work in ${name}, with prices in US dollars.`,
    chooseAnother: 'Choose another destination',
    planTypes: 'Plan types',
    jumpRegional: 'Regional',
    jumpDaily: 'Data every day',
    noscript: 'Plans and prices on this page need JavaScript. Nothing can be bought here yet.',
    localTitle: (name) => `Plans for ${name}`,
    localNote: (name) => `Plans that cover ${name} only.`,
    regionalTitle: (name) => `Regional plans that include ${name}`,
    regionalNote: (name) => `Plans that cover ${name} together with other countries.`,
    dailyTitle: 'Data every day',
    dailyNote: 'A data allowance for each day of the trip.',
    // the destination list
    hubTitle: 'eSIM destinations — Magic eSIM',
    hubDescription: 'Every destination Magic eSIM has data plans for, with prices in US dollars. Online payment is not available yet.',
    hubH1: 'eSIM destinations',
    hubLead: 'Pick a country to see its data plans, with prices in US dollars.',
    hubSearchPlaceholder: 'Search a country',
    hubClear: 'Clear search',
    hubAz: 'Destinations A to Z',
    hubEmptyNote: 'Check the spelling, or browse the list from A to Z.',
    hubShowAll: 'Show all destinations',
    // the guides
    questions: 'Questions',
    onThisPage: 'On this page',
    relatedGuides: 'Related guides',
    chooseDestination: 'Choose a destination',
    guidesTitle: 'eSIM guides — install, check and fix | Magic eSIM',
    guidesDescription: 'How to install a travel eSIM on iPhone and Android, check that your phone supports it, when to install it and what to do if it does not work.',
    guidesH1: 'eSIM guides',
    guidesLead: 'Install, check and fix a travel eSIM — step by step.',
  }),

  /* Neutral international Spanish (owner, D1: «tú», no «vosotros», no regional slang), I18N ES-1 2026-10-21. An
   * AI-assisted draft held to the English copy's facts — it may say nothing the English does not — and to
   * seo/claim-guards.mjs (es); a native review is part of publishing (ES-1r). Country names are CLDR's, the same
   * the generator prints. */
  es: freeze({
    skipLink: 'Ir al contenido principal',
    navLabel: 'Principal',
    menuLabel: 'Menú',
    langMenu: 'Idioma',
    support: 'Soporte:',
    homeTitle: 'Magic eSIM — datos móviles en el extranjero sin roaming',
    homeDescription: 'Elige un destino, instala una eSIM y conéctate al aterrizar. Magic eSIM cubre más de 190 destinos, sin SIM física ni esperas en el aeropuerto.',
    homeOgDescription: 'Elige un destino, instala una eSIM y conéctate al aterrizar.',
    homeNojsSearch: 'La búsqueda necesita JavaScript.',
    homeNojsBrowse: 'Ver todos los destinos',
    homeReadGuide: 'Leer la guía →',
    homeArtBack: 'eSIM · PASE DE DATOS',
    homeArtTitle: 'Pase de datos',
    homeArtCoverage: 'Cobertura',
    homeArtCoverageValue: '190+ destinos',
    homeArtType: 'Tipo',
    homeArtInstall: 'Instalación con<br>código QR',
    quick: freeze(['US', 'MX', 'ES', 'JP', 'TH', 'IT']),
    popular: freeze([
      freeze({ iso: 'US', slug: 'usa', name: 'Estados Unidos' }),
      freeze({ iso: 'MX', slug: 'mexico', name: 'México' }),
      freeze({ iso: 'ES', slug: 'spain', name: 'España' }),
      freeze({ iso: 'JP', slug: 'japan', name: 'Japón' }),
      freeze({ iso: 'TH', slug: 'thailand', name: 'Tailandia' }),
      freeze({ iso: 'TR', slug: 'turkey', name: 'Turquía' }),
      freeze({ iso: 'IT', slug: 'italy', name: 'Italia' }),
      freeze({ iso: 'FR', slug: 'france', name: 'Francia' }),
    ]),
    yourPlan: 'Tu plan',
    esimFor: (name) => `eSIM para ${name}`,
    steps: freeze(['Plan', 'Tus datos', 'Revisión']),
    beforeYouBuy: 'Antes de comprar',
    countryTitle: (name) => `eSIM para ${name}: planes de datos en USD | Magic eSIM`,
    countryDescription: (name) => `Planes de datos eSIM que cubren ${name}, con precios en dólares estadounidenses. El pago en línea aún no está disponible.`,
    countryLead: (name) => `Planes de datos que funcionan en ${name}, con precios en dólares estadounidenses.`,
    chooseAnother: 'Elegir otro destino',
    planTypes: 'Tipos de planes',
    jumpRegional: 'Regionales',
    jumpDaily: 'Datos cada día',
    noscript: 'Los planes y precios de esta página necesitan JavaScript. Aquí todavía no se puede comprar nada.',
    localTitle: (name) => `Planes para ${name}`,
    localNote: (name) => `Planes que solo cubren ${name}.`,
    regionalTitle: (name) => `Planes regionales que incluyen ${name}`,
    regionalNote: (name) => `Planes que cubren ${name} junto con otros países.`,
    dailyTitle: 'Datos cada día',
    dailyNote: 'Una cantidad de datos para cada día del viaje.',
    hubTitle: 'Destinos eSIM — Magic eSIM',
    hubDescription: 'Todos los destinos para los que Magic eSIM tiene planes de datos, con precios en dólares estadounidenses. El pago en línea aún no está disponible.',
    hubH1: 'Destinos eSIM',
    hubLead: 'Elige un país para ver sus planes de datos, con precios en dólares estadounidenses.',
    hubSearchPlaceholder: 'Buscar un país',
    hubClear: 'Borrar la búsqueda',
    hubAz: 'Destinos de la A a la Z',
    hubEmptyNote: 'Revisa la ortografía o consulta la lista de la A a la Z.',
    hubShowAll: 'Ver todos los destinos',
    questions: 'Preguntas',
    onThisPage: 'En esta página',
    relatedGuides: 'Guías relacionadas',
    chooseDestination: 'Elegir un destino',
    guidesTitle: 'Guías eSIM: instalar, comprobar y solucionar | Magic eSIM',
    guidesDescription: 'Cómo instalar una eSIM de viaje en iPhone y Android, comprobar que tu teléfono la admite, cuándo instalarla y qué hacer si no funciona.',
    guidesH1: 'Guías eSIM',
    guidesLead: 'Instala, comprueba y soluciona una eSIM de viaje, paso a paso.',
  }),
});
