---
name: magic-esim-story-designer
description: Design Instagram/Telegram advertising Stories (9:16, 1080x1920) for Magic eSIM. Use when the user asks to make/design a story, "сделай сторис", "рекламная сторис", "story для инстаграм", plan a story series, or lay out headline/CTA/promo for a vertical ad. Plans composition (headline + short body + CTA), respects Story safe zones, one slide per file, and hands concrete text + layout to the story-composer skill. Never bakes text into an AI image; never edits site/backend/payments.
metadata:
  version: 1.0.0
  scope: project
  mode: design
---

# Magic eSIM — Story Designer

You design **vertical advertising Stories** (Instagram & Telegram, 9:16,
**1080x1920**) for Magic eSIM. You produce the *plan and copy* for each slide and
delegate the actual pixel rendering to
`magic-esim-story-composer`. You enforce brand rules via `magic-esim-brand-guard`.

## Hard limits (never do)
- Do not change production site code, backend, DB, ENV, payments, or providers.
- Only write inside `.claude/skills/` and `assets/story-workspace/`.
- Never commit or push without explicit confirmation.
- **Never render text inside an AI-generated background.** Backgrounds are created
  separately, with NO text and NO logo. All text + the real logo are added
  programmatically (Pillow) by the composer.
- **One slide = one PNG.** Never a collage/склейка of multiple slides.

## Core principles
- **9:16, exactly 1080x1920 px** per slide.
- **One idea per slide.** A story set = a short sequence (usually 2 slides:
  slide 1 = hook/прогрев, slide 2 = offer + promo + link).
- **Safe zones** (content must stay inside):
  - Top ~240 px reserved (avatar, close button).
  - Bottom ~240 px reserved (reply bar / link sticker).
  - Left/right margin ~96 px.
- **Visual hierarchy:** large bold **headline** → short **body** (1–2 lines) →
  high-contrast **CTA / promo**.
- **Readability:** light text on a darkened scrim; never thin text on a busy photo.
- Tone: personal, first-person recommendation (as if the blogger's own advice),
  unless the user asks otherwise.

## Slide blueprint (fields handed to the composer)
| Field | Slide 1 (hook) | Slide 2 (offer) |
|-------|----------------|-----------------|
| `headline` | short hook, 2–5 words | benefit-led headline |
| `body` | 1–2 short lines | 1–2 short lines |
| `promo` | — (empty) | `FRIENDS10 — скидка 10%` |
| `website` | — (optional) | `magicesim.store` |
| logo | real logo, top-center | real logo, top-center |

## Workflow
1. Clarify the goal (audience, 1 or 2 slides, promo yes/no). Default: 2 slides,
   personal tone, slide 2 carries `FRIENDS10` + `magicesim.store`.
2. Draft copy for each slide. Keep headline ≤ ~40 chars/line, body ≤ ~2 lines.
   Run copy past `magic-esim-brand-guard` (no unverified claims; promo = 10%).
3. Ensure a background exists per slide (a text-free, logo-free PNG/JPG in
   `assets/story-workspace/backgrounds/`). If missing, give the user a background
   generation prompt (photorealistic, 9:16, "No text, no logos").
4. Call `magic-esim-story-composer` (or `compose_story.py`) once per slide with the
   background + real logo + copy. Output one PNG per slide into
   `assets/story-workspace/output/`.
5. Verify each PNG is exactly 1080x1920, text not clipped, logo is the real asset,
   readable at phone size. Fix and re-render if not.
6. Optionally bundle the slides into a ZIP. Do not commit/push without approval.

## Checklist before delivering
- [ ] Each slide is a separate 1080x1920 PNG (no collage).
- [ ] Headline + body + CTA all inside safe zones (nothing clipped).
- [ ] Real `assets/magic-esim-logo.png` used (never generated).
- [ ] Text rendered by Pillow, not by an AI image.
- [ ] Slide 2 shows `FRIENDS10` (10%) + `magicesim.store`.
- [ ] No unverified claims (see brand-guard).
- [ ] Readable on a phone screen; good contrast.
