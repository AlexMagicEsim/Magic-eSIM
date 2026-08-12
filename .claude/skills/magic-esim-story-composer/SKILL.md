---
name: magic-esim-story-composer
description: Render a Magic eSIM story slide to a 1080x1920 PNG by compositing a text-free background + the real logo + Russian text with Pillow. Use when a background is ready and the user asks to "собери сторис", "наложи текст и логотип", render/compose the slide, or export the final PNG/ZIP. Runs assets/story-workspace/compose_story.py, overlays the real assets/magic-esim-logo.png (aspect preserved), wraps RU text with a local font, verifies exact 1080x1920, and visually checks each slide. Never bakes text into AI images; never edits site/backend/payments.
metadata:
  version: 1.0.0
  scope: project
  mode: build
---

# Magic eSIM — Story Composer

You turn a finished, text-free background into a ready-to-post story slide by
compositing programmatically with Pillow. You are the rendering step for
`magic-esim-story-designer` and you obey `magic-esim-brand-guard`.

## Hard limits (never do)
- Do not change production site code, backend, DB, ENV, payments, or providers.
- Only write inside `assets/story-workspace/` (and read the real logo).
- Never commit or push without explicit confirmation.
- **Never modify the source background or the logo file.** Inputs are read-only.
- **Never generate the logo** or draw a fake one — always the real
  `assets/magic-esim-logo.png`, aspect ratio preserved.
- **Never render text inside an AI background.** Text is drawn here, with Pillow.
- **One slide = one PNG.** Never composite multiple slides into one image.

## Tool
Script: `assets/story-workspace/compose_story.py` (Pillow, no OCR, no network).

```
python3 assets/story-workspace/compose_story.py \
  --background assets/story-workspace/backgrounds/slide2.png \
  --logo      assets/magic-esim-logo.png \
  --output    assets/story-workspace/output/slide2.png \
  --headline  "Мой лайфхак для связи за границей" \
  --body      "eSIM ставлю ещё дома, интернет есть сразу после посадки." \
  --promo     "FRIENDS10 — скидка 10%" \
  --website   "magicesim.store"
```

Arguments: `--background` `--logo` `--output` `--headline` (required) and optional
`--body` `--promo` `--website` `--font` `--font-bold` `--logo-width`.

## What the script guarantees
- Background is cover-resized + center-cropped to **exactly 1080x1920** (no
  distortion), with a dark readability scrim top & bottom.
- Real logo pasted top-center, **aspect ratio preserved**.
- Russian text auto-wrapped by pixel width with a local font (Arial/Helvetica
  fallback chain; override with `--font*`).
- High-contrast **promo badge** (brand purple `#8A16C7`) + cyan CTA `#00C7DF`.
- Output re-opened and asserted to be `1080x1920`; clear errors otherwise.

## Workflow
1. Confirm a text-free, logo-free background exists (in
   `assets/story-workspace/backgrounds/`). If not, ask the designer skill for one.
2. Run `compose_story.py` **once per slide** → one PNG in `output/`.
3. **Verify programmatically:** each output is exactly 1080x1920 PNG
   (`python3 -c "from PIL import Image; print(Image.open(p).size)"`).
4. **Visually inspect each PNG (open it / Read the image)** and confirm:
   - [ ] Not a collage/склейка — single slide.
   - [ ] Text is straight, wrapped, and **not clipped** at any edge/safe zone.
   - [ ] The logo is the **real** asset (not generated), undistorted.
   - [ ] No cut-off elements; promo badge + CTA fully visible.
   - [ ] Text is legible at phone size (contrast OK against the background).
5. If any check fails: adjust copy length, `--logo-width`, or the background, and
   re-render. Never "fix" by editing the logo.
6. Optionally bundle finals into a ZIP:
   `cd assets/story-workspace/output && zip magic-esim-stories.zip *.png`.
7. Stop and wait for confirmation before any commit/push.

## Notes
- Keep headlines short so wrapping stays to ≤3 lines; long copy risks clipping.
- Backgrounds and outputs under `assets/story-workspace/` are working artifacts;
  do not add them to the production site or sitemap.
