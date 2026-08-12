# Content profiles

One optional file per country: `<slug>.json`.

A profile carries **editorial** content only — the part a catalogue cannot
produce and a generator must not invent. Every fact about tariffs, coverage,
prices, volumes and validity comes from the Magic eSIM API at build and render
time, and a profile that tries to state one is ignored and reported.

Pipeline these files are written for:

1. **SEO Researcher** — search intent and the questions people actually ask
   about the country. Goes into `search_intent` and shapes `faq`.
2. **eSIM/Travel Editor** — writes `lead`, `intro`, `why`, `faq` using the
   country page's own API data as the factual base.
3. **SEO Reviewer** — checks uniqueness against other countries, intent match,
   and that `title` / `h1` / `description` / `faq` do not duplicate.
4. **Browser QA** — Playwright pass over the rendered page, desktop and mobile.

`status` gates publication: only `"published"` reaches the site. A `draft` may
sit here indefinitely.

Nothing about mobile networks, operators, coverage quality or tariff conditions
may be asserted here unless it comes from the API. If a fact is not in the
catalogue, the page says nothing rather than guessing.
