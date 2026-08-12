# Magic eSIM — Background Template Library (Stage 1)

Backgrounds are **text-free, logo-free, QR-free, promo-free** — composition only.
Two ways to produce one:

1. **Real photo** (best): drop a text-free image into
   `assets/story-workspace/backgrounds/` and use it directly.
2. **Generated fallback** (autonomous): `make_background.py --template <name>`.

Each template below has: **when to use**, and a **photo/AI prompt** (if you generate
with an external model, always end with *"No text, no logos, no QR, vertical 9:16"*).

| Template | Mood / when to use | Photo / AI prompt (text-free) |
|----------|--------------------|-------------------------------|
| `travel` | generic travel, pr-warm-up | Sunlit open road / suitcase by a window, warm turquoise-peach tones, airy, bokeh |
| `beach` | summer, vacation, relax | Tropical beach, turquoise sea, palm shadow, golden hour, soft bokeh |
| `airport` | departure, "перед вылетом" | Modern airport terminal, blurred departures board, cool blue tones, bokeh |
| `airplane` | roaming vs eSIM, flights, "в пути" | Airplane window view over clouds/ocean at golden hour, cinematic |
| `luxury-hotel` | premium, business, comfort | Elegant hotel suite / rooftop at dusk, warm gold + navy, soft light |
| `infinity-pool` | vacation flex, relax | Infinity pool overlooking the ocean, turquoise water, sunny, minimal |
| `passport` | docs, "готовься к поездке" | Passport + boarding pass flat-lay on navy, warm accent light, minimal |
| `city` | city trips, nightlife | City skyline at dusk, bokeh lights, purple-blue tones, cinematic |
| `asia` | Asia destinations (TH/VN/etc.) | Warm Asian street / lanterns at sunset, red-orange glow, bokeh |
| `europe` | Europe destinations | European old-town street, soft daylight, blue-cream palette |
| `cafe` | digital nomad, lifestyle | Cozy cafe table with phone + coffee, warm brown-cream, soft bokeh |
| `digital-nomad` | remote work, "работай из любой точки" | Laptop + phone by a scenic window, cool blue + cyan, clean |
| `business-trip` | corporate, efficiency | Business traveler silhouette in terminal, navy-blue, minimal |
| `family-vacation` | families, safe & easy | Family on a sunny beach/boardwalk, warm teal-sand, joyful |
| `brand` | promo/CTA, neutral | Abstract Magic eSIM gradient (purple→blue→cyan) with sparkles |

## Generated-fallback usage
```
python3 assets/story-workspace/make_background.py \
  --template <name> --format story \
  --output assets/story-workspace/backgrounds/<name>_bg.png
```
Formats: `story` (1080×1920), `reels-cover` (1080×1920),
`post-portrait` (1080×1350), `post-square` (1080×1080).
Aliases: `pool→infinity-pool`, `plane→airplane`, `luxury/hotel→luxury-hotel`,
`nomad→digital-nomad`, `business→business-trip`, `family→family-vacation`.

## Rules
- The generated fallback is a professional abstract; for hero campaigns prefer a
  real photo.
- Keep the upper-center relatively clean — the composer places the logo + headline
  there.
- Never add text/logo/QR to a background. Those belong to Stage 2 only.
