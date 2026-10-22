# French (fr) — what «right» means on this site

- **Variant:** standard French (fr-FR) (owner D3, 2026-10-22). Address the reader as **vous** (owner D1) — as Apple's,
  Google's and Samsung's own French support pages do; never «tu». No Canadian-only or Belgian-only words in the copy
  (courriel, magasiner, septante…); where Apple names a setting differently in France and Canada, the guides give both,
  France first («Données cellulaires … au Canada, Réseau cellulaire») — that is decided, not a finding.
- **Decided, not findings:** prices «12,99 USD» (fr-FR, the currency as a code — owner D2); English slugs in URLs (D4);
  «une eSIM / l’eSIM» (feminine); data in **Go / Mo** (the French units); the slogan «Stay Connected Anywhere» in English;
  legal links «Conditions / Confidentialité (en russe)» (D8); a country name after «pour» (or as the object of
  «couvrir») is the noun phrase `FR_POUR` gives in seo/page-copy.mjs — «le Japon», «la France», «l’Italie», «les
  États-Unis», «les îles Caïmans», «Singapour» — templates never use «au / aux / en».
- **Typography (D7):** a no-break space (U+00A0) before «:», a narrow no-break space (U+202F) before «; ? !»; guillemets
  « » with no-break spaces inside; the apostrophe ’ (never '); the dash « – » spaced; «…» for an ellipsis. A missing or
  plain space before «: ; ? !» is an objective error (seo/test-fr-site.mjs fails on it too).
- **Numbers:** decimal comma («1,5 Go»), thousands with a narrow no-break space («1 234,50 USD»); units kbit/s, Mbit/s.
- **Plural:** 0 and 1 are singular («0 jour», «1 jour»), «2 jours»; «pays» is invariable.
- **SEO:** titles ≤ 60 characters, descriptions ≤ 160; a country title states the intent («eSIM pour …»).
- **Claims:** the English is the legal reference. «illimité», «rapide», «garanti», «24h/24», «nous vous enverrons…»,
  «remboursé», payment methods — never, unless the English says the same (seo/claim-guards.mjs, fr).
