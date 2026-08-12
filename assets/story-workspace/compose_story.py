#!/usr/bin/env python3
"""
Magic eSIM — Story / Post Composer (Stage 2)
============================================
Compose ONE creative (PNG) from:
  - a Stage-1 background (NO text, NO logo baked in),
  - the REAL Magic eSIM logo (default: ~/Desktop/eSim/magic-esim-logo-3.png),
  - Russian text rendered programmatically with a local font.

Design rules (see .claude/skills/magic-esim-marketing-designer):
  - One file == one slide. Never a collage/склейка.
  - Text is drawn with Pillow, never generated inside the image by an AI.
  - The logo is placed as-is: aspect ratio preserved, never redrawn/recolored.
    Transparent margins are auto-trimmed so it sizes correctly.
  - Output is exactly the format size (default story 1080x1920) PNG.
  - Content stays inside safe zones (top/bottom UI reserved).

Formats: story (1080x1920), reels-cover (1080x1920),
         post-portrait (1080x1350), post-square (1080x1080).

Usage:
  python3 compose_story.py \
    --background backgrounds/bg.png \
    --logo ~/Desktop/eSim/magic-esim-logo-3.png \
    --output output/slide1.png \
    --headline "Почему eSIM удобнее роуминга" \
    --body "Подключаете тариф заранее — интернет работает сразу после посадки." \
    --promo "FRIENDS10 — скидка 10%" \
    --website "magicesim.store"

No OCR. No network. Source files are never modified.
"""

import argparse
import os
import re
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("ERROR: Pillow is required.  python3 -m pip install Pillow")

# Emoji / pictographs have no glyph in Arial/Helvetica and render as tofu boxes.
# Baked emoji look worse than native ones, so we strip them here and let the user
# add emoji as native Instagram/Telegram stickers. Arrows (→) and dashes are kept.
_EMOJI_RE = re.compile(
    "["
    "\U0001F000-\U0001FAFF"   # pictographs, transport, symbols, faces
    "\U00002600-\U000026FF"   # misc symbols (incl. ✈ ★ ☀)
    "\U00002700-\U000027BF"   # dingbats
    "\U0001F1E6-\U0001F1FF"   # regional indicators (flags)
    "\U0000FE00-\U0000FE0F"   # variation selectors
    "\U00002B00-\U00002BFF"   # extra stars/arrows block
    "\U0000200D"              # zero-width joiner
    "]+",
    flags=re.UNICODE,
)


def sanitize_text(text):
    """Strip unsupported emoji/pictographs; collapse the whitespace they leave."""
    cleaned = _EMOJI_RE.sub("", text)
    # collapse spaces but keep explicit newlines
    cleaned = "\n".join(re.sub(r"[ \t]{2,}", " ", ln).strip() for ln in cleaned.split("\n"))
    return cleaned

# ---------------------------------------------------------------------------
# Formats: (w, h, safe_top, safe_bottom, safe_x)
# ---------------------------------------------------------------------------
FORMATS = {
    "story":         (1080, 1920, 240, 240, 96),
    "reels-cover":   (1080, 1920, 240, 300, 96),   # extra bottom room for Reels UI
    "post-portrait": (1080, 1350, 96, 96, 90),
    "post-square":   (1080, 1080, 80, 80, 80),
}

# Brand palette (verified against magicesim.store CSS)
PURPLE = (138, 22, 199)     # #8a16c7
BLUE = (66, 103, 232)       # #4267e8
CYAN = (0, 199, 223)        # #00c7df
NAVY = (17, 24, 39)         # #111827
WHITE = (255, 255, 255)     # #ffffff

DEFAULT_LOGO = os.path.expanduser("~/Desktop/eSim/magic-esim-logo-3.png")

FONT_CANDIDATES_BOLD = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
FONT_CANDIDATES_REGULAR = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def resolve_font(explicit, candidates, label):
    if explicit:
        if not os.path.isfile(explicit):
            sys.exit(f"ERROR: --{label} font not found: {explicit}")
        return explicit
    for path in candidates:
        if os.path.isfile(path):
            return path
    sys.exit(f"ERROR: no {label} font found. Pass --{label} <path>. Tried: {candidates}")


def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception as e:  # noqa: BLE001
        sys.exit(f"ERROR: cannot load font {path} at {size}: {e}")


def wrap_by_pixels(draw, text, font, max_width):
    """Pixel-accurate word wrap (Cyrillic-safe). Preserves explicit newlines."""
    out = []
    for para in text.split("\n"):
        words = para.split()
        if not words:
            out.append("")
            continue
        cur = words[0]
        for word in words[1:]:
            if draw.textlength(cur + " " + word, font=font) <= max_width:
                cur += " " + word
            else:
                out.append(cur)
                cur = word
        out.append(cur)
    return out


def draw_block(draw, lines, font, x, y, fill, spacing, box_w, align="center", shadow=None):
    ascent, descent = font.getmetrics()
    line_h = int((ascent + descent) * spacing)
    for line in lines:
        w = draw.textlength(line, font=font)
        lx = x + (box_w - w) / 2 if align == "center" else x
        if shadow:
            sx, sy, sc = shadow
            draw.text((lx + sx, y + sy), line, font=font, fill=sc)
        draw.text((lx, y), line, font=font, fill=fill)
        y += line_h
    return y


def block_height(lines, font, spacing):
    ascent, descent = font.getmetrics()
    return int((ascent + descent) * spacing) * len(lines)


def cover_resize(bg, w, h):
    bw, bh = bg.size
    scale = max(w / bw, h / bh)
    nw, nh = int(round(bw * scale)), int(round(bh * scale))
    resized = bg.resize((nw, nh), Image.LANCZOS)
    left, top = (nw - w) // 2, (nh - h) // 2
    return resized.crop((left, top, left + w, top + h))


def readability_scrim(base, safe_top, safe_bottom):
    w, h = base.size
    scrim = Image.new("L", (1, h), 0)
    px = scrim.load()
    for y in range(h):
        t_top = max(0.0, 1 - y / (safe_top + int(h * 0.28)))
        t_bot = (y - (h - safe_bottom - int(h * 0.34))) / (safe_bottom + int(h * 0.34))
        t_bot = min(max(t_bot, 0.0), 1.0)
        px[0, y] = int(170 * max(t_top, t_bot))
    scrim = scrim.resize((w, h))
    overlay = Image.new("RGBA", (w, h), (8, 10, 22, 0))
    overlay.putalpha(scrim)
    return Image.alpha_composite(base, overlay)


def trim_alpha(im):
    """Trim fully-transparent margins so the logo fills its target width."""
    if im.mode != "RGBA":
        return im
    bbox = im.getchannel("A").getbbox()
    return im.crop(bbox) if bbox else im


def paste_logo(canvas, logo_path, target_w, top_y, plate=False):
    logo = trim_alpha(Image.open(logo_path).convert("RGBA"))
    lw, lh = logo.size
    scale = target_w / lw
    nw, nh = int(round(lw * scale)), int(round(lh * scale))
    logo = logo.resize((nw, nh), Image.LANCZOS)
    x = (canvas.size[0] - nw) // 2
    if plate:
        pad = int(nw * 0.10)
        d = ImageDraw.Draw(canvas)
        d.rounded_rectangle([x - pad, top_y - pad, x + nw + pad, top_y + nh + pad],
                            radius=int(pad * 1.2), fill=(255, 255, 255, 235))
    canvas.alpha_composite(logo, (x, top_y))
    return top_y + nh


def main():
    ap = argparse.ArgumentParser(description="Compose one Magic eSIM creative.")
    ap.add_argument("--background", required=True)
    ap.add_argument("--logo", default=DEFAULT_LOGO, help=f"Real logo PNG (default: {DEFAULT_LOGO})")
    ap.add_argument("--output", required=True)
    ap.add_argument("--headline", required=True)
    ap.add_argument("--body", default="")
    ap.add_argument("--promo", default="")
    ap.add_argument("--website", default="")
    ap.add_argument("--format", default="story", choices=list(FORMATS))
    ap.add_argument("--font", default="")
    ap.add_argument("--font-bold", dest="font_bold", default="")
    ap.add_argument("--logo-width", type=int, default=0, help="Logo width px (0 = auto by format).")
    ap.add_argument("--logo-plate", action="store_true", help="White rounded plate behind logo.")
    args = ap.parse_args()

    if not os.path.isfile(args.background):
        sys.exit(f"ERROR: --background not found: {args.background}")
    if not os.path.isfile(args.logo):
        sys.exit(f"ERROR: --logo not found: {args.logo}")

    # Strip emoji the base font can't render (avoid tofu boxes).
    raw = f"{args.headline}\n{args.body}\n{args.promo}\n{args.website}"
    args.headline = sanitize_text(args.headline)
    args.body = sanitize_text(args.body)
    args.promo = sanitize_text(args.promo)
    args.website = sanitize_text(args.website)
    if sanitize_text(raw) != raw:
        print("NOTE: emoji/unsupported glyphs were stripped from text "
              "(add them as native stickers in the app).")
    if not args.headline.strip():
        sys.exit("ERROR: --headline must not be empty (after emoji strip).")

    W, H, SAFE_TOP, SAFE_BOTTOM, SAFE_X = FORMATS[args.format]
    hs = H / 1920.0  # height scale so posts get proportional type

    fb = resolve_font(args.font_bold, FONT_CANDIDATES_BOLD, "font-bold")
    fr = resolve_font(args.font, FONT_CANDIDATES_REGULAR, "font")
    f_head = load_font(fb, int(76 * hs))
    f_body = load_font(fr, int(44 * hs))
    f_promo = load_font(fb, int(58 * hs))
    f_web = load_font(fb, int(46 * hs))

    try:
        bg = Image.open(args.background).convert("RGBA")
    except Exception as e:  # noqa: BLE001
        sys.exit(f"ERROR: cannot open background: {e}")
    canvas = cover_resize(bg, W, H)
    canvas = readability_scrim(canvas, SAFE_TOP, SAFE_BOTTOM)
    draw = ImageDraw.Draw(canvas)
    content_w = W - 2 * SAFE_X

    # logo (top, centered, real, aspect preserved, transparent margins trimmed)
    logo_w = args.logo_width or int(W * 0.34)
    y = SAFE_TOP
    y = paste_logo(canvas, args.logo, logo_w, y, plate=args.logo_plate)
    y += int(70 * hs)

    # headline
    head_lines = wrap_by_pixels(draw, args.headline.strip(), f_head, content_w)
    y = draw_block(draw, head_lines, f_head, SAFE_X, y, WHITE, 1.15, content_w,
                   shadow=(0, 3, (0, 0, 0, 170)))
    y += int(34 * hs)

    # body
    if args.body.strip():
        body_lines = wrap_by_pixels(draw, args.body.strip(), f_body, content_w)
        draw_block(draw, body_lines, f_body, SAFE_X, y, (236, 239, 248), 1.3, content_w,
                   shadow=(0, 2, (0, 0, 0, 140)))

    # website / caption (wrapped, cyan) anchored to the bottom safe zone
    bottom_y = H - SAFE_BOTTOM
    web_top = bottom_y
    if args.website.strip():
        web_lines = wrap_by_pixels(draw, args.website.strip(), f_web, content_w)
        wh = block_height(web_lines, f_web, 1.2)
        wy = bottom_y - wh - int(24 * hs)
        draw_block(draw, web_lines, f_web, SAFE_X, wy, CYAN, 1.2, content_w,
                   shadow=(0, 2, (0, 0, 0, 150)))
        web_top = wy

    # promo badge sits just above the website block (or the bottom if no website)
    if args.promo.strip():
        pad_x, pad_y = int(46 * hs), int(30 * hs)
        promo_lines = wrap_by_pixels(draw, args.promo.strip(), f_promo, content_w - 2 * pad_x)
        bh = pad_y * 2 + block_height(promo_lines, f_promo, 1.1)
        by = web_top - bh - int(40 * hs)
        draw.rounded_rectangle([SAFE_X, by, SAFE_X + content_w, by + bh],
                               radius=int(36 * hs), fill=PURPLE)
        draw_block(draw, promo_lines, f_promo, SAFE_X, by + pad_y, WHITE, 1.1, content_w)

    if canvas.size != (W, H):
        sys.exit(f"ERROR: size drift {canvas.size}, expected {(W, H)}")
    out = canvas.convert("RGB")
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    out.save(args.output, "PNG")

    check = Image.open(args.output)
    if check.size != (W, H):
        sys.exit(f"ERROR: written file is {check.size}, expected {(W, H)}")
    print(f"OK  {args.output}  {check.size[0]}x{check.size[1]} PNG  [{args.format}]")
    print(f"    logo={os.path.basename(args.logo)} fonts={os.path.basename(fb)}/{os.path.basename(fr)}")


if __name__ == "__main__":
    main()
