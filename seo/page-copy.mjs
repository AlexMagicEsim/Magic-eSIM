// The words of the locale pages that the BROWSER dictionary does not carry —
// titles, descriptions, headings, the checkout steps, accessibility labels —
// per language, for seo/build-locale-pages.mjs (I18N-08).
//
// Two dictionaries on purpose. assets/site-i18n.js holds the words the
// browser re-applies at runtime (`data-i18n`) and is shipped to every visitor
// under a content hash; these never change after the page is built, so they
// stay at build time and add nothing to a download.
//
// Only English exists. A language is added here — written for its readers'
// own search intent, reviewed, never machine-translated from this one — in the
// stage that publishes it; until then seo/build-locale-pages.mjs refuses to
// build it. `esc`-ed values (country names) are passed in already escaped.

const freeze = (o) => Object.freeze(o);

export const PAGE_COPY = freeze({
  en: freeze({
    skipLink: 'Skip to main content',
    navLabel: 'Main',
    menuLabel: 'Menu',
    support: 'Support:',
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
});
