#!/usr/bin/env python3
"""
Magic eSIM — Background Generator (Stage 1)
===========================================
Produce a clean, text-free, logo-free background for a story/post from a named
TEMPLATE. This is the Stage-1 artifact: NO text, NO logo, NO QR, NO promo — only
composition (gradient + soft bokeh + subtle motif + vignette).

In production you may instead drop a real photo (text-free) into
`backgrounds/`. This generator gives a professional abstract fallback so the
system can work fully autonomously without an external image model.

Usage:
  python3 make_background.py --template airplane --output backgrounds/bg.png
  python3 make_background.py --template beach --format post-square --output bg.png

Templates: travel, beach, airport, airplane, luxury-hotel, infinity-pool,
passport, city, asia, europe, cafe, digital-nomad, business-trip,
family-vacation, brand.  (aliases accepted, see TEMPLATES)

No text is ever drawn. No network. No OCR.
"""

import argparse
import math
import os
import random
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter
except ImportError:
    sys.exit("ERROR: Pillow is required.  python3 -m pip install Pillow")

FORMATS = {
    "story": (1080, 1920),
    "reels-cover": (1080, 1920),
    "post-portrait": (1080, 1350),
    "post-square": (1080, 1080),
}

# Each template: vertical gradient stops (top->bottom) + bokeh accent + motif.
# Colours chosen to sit under white text; the composer adds its own scrim too.
TEMPLATES = {
    "brand":          {"grad": [(138, 22, 199), (66, 103, 232), (0, 199, 223)], "bokeh": (255, 255, 255), "motif": "sparkles"},
    "travel":         {"grad": [(70, 40, 150), (66, 103, 232), (0, 199, 223)],  "bokeh": (255, 255, 255), "motif": "path"},
    "beach":          {"grad": [(0, 150, 180), (0, 199, 223), (245, 224, 168)], "bokeh": (255, 250, 230), "motif": "sun"},
    "airport":        {"grad": [(30, 41, 70), (52, 73, 120), (120, 150, 200)],  "bokeh": (200, 220, 255), "motif": "bokeh"},
    "airplane":       {"grad": [(18, 24, 60), (40, 70, 150), (110, 170, 220)],  "bokeh": (230, 240, 255), "motif": "path"},
    "luxury-hotel":   {"grad": [(30, 24, 40), (80, 50, 70), (212, 175, 110)],   "bokeh": (255, 230, 180), "motif": "bokeh"},
    "infinity-pool":  {"grad": [(0, 120, 150), (0, 175, 200), (120, 220, 225)], "bokeh": (255, 255, 255), "motif": "waves"},
    "passport":       {"grad": [(25, 30, 60), (40, 45, 90), (90, 40, 70)],      "bokeh": (220, 200, 160), "motif": "sparkles"},
    "city":           {"grad": [(35, 25, 70), (70, 50, 130), (200, 120, 180)],  "bokeh": (255, 220, 200), "motif": "bokeh"},
    "asia":           {"grad": [(120, 30, 80), (210, 90, 70), (245, 180, 120)], "bokeh": (255, 235, 200), "motif": "sun"},
    "europe":         {"grad": [(40, 60, 120), (90, 120, 190), (225, 220, 210)],"bokeh": (255, 255, 255), "motif": "bokeh"},
    "cafe":           {"grad": [(50, 34, 28), (110, 78, 55), (205, 170, 130)],  "bokeh": (255, 235, 200), "motif": "bokeh"},
    "digital-nomad":  {"grad": [(28, 32, 60), (60, 90, 170), (0, 199, 223)],    "bokeh": (230, 240, 255), "motif": "path"},
    "business-trip":  {"grad": [(20, 28, 50), (45, 65, 120), (110, 140, 190)],  "bokeh": (210, 225, 255), "motif": "bokeh"},
    "family-vacation":{"grad": [(0, 140, 170), (90, 190, 200), (250, 215, 160)],"bokeh": (255, 245, 220), "motif": "sun"},
}
ALIASES = {
    "luxury": "luxury-hotel", "hotel": "luxury-hotel", "pool": "infinity-pool",
    "plane": "airplane", "nomad": "digital-nomad", "business": "business-trip",
    "family": "family-vacation", "default": "brand",
}


def vertical_gradient(w, h, stops):
    """Smooth top->bottom gradient across the given colour stops."""
    grad = Image.new("RGB", (1, h))
    px = grad.load()
    n = len(stops) - 1
    for y in range(h):
        t = y / (h - 1)
        seg = min(int(t * n), n - 1)
        lt = (t * n) - seg
        a, b = stops[seg], stops[seg + 1]
        px[0, y] = tuple(int(a[i] + (b[i] - a[i]) * lt) for i in range(3))
    return grad.resize((w, h))


def add_bokeh(base, colour, count, seed):
    rnd = random.Random(seed)
    w, h = base.size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(count):
        r = rnd.randint(int(w * 0.02), int(w * 0.13))
        x = rnd.randint(-r, w + r)
        y = rnd.randint(-r, h + r)
        a = rnd.randint(10, 46)
        d.ellipse([x - r, y - r, x + r, y + r], fill=colour + (a,))
    layer = layer.filter(ImageFilter.GaussianBlur(18))
    return Image.alpha_composite(base.convert("RGBA"), layer)


def add_motif(base, motif, colour, seed):
    w, h = base.size
    rnd = random.Random(seed + 7)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if motif == "path":
        # dotted flight-path arc across the upper third
        cx, cy = w * 0.5, h * 0.62
        rad = w * 0.78
        for deg in range(200, 340, 4):
            ang = math.radians(deg)
            x = cx + rad * math.cos(ang)
            y = cy + rad * math.sin(ang)
            d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=colour + (60,))
    elif motif == "sun":
        r = int(w * 0.42)
        cx, cy = int(w * 0.5), int(h * 0.30)
        for i in range(r, 0, -6):
            a = int(46 * (i / r))
            d.ellipse([cx - i, cy - i, cx + i, cy + i], fill=colour + (max(0, 46 - a),))
    elif motif == "waves":
        for k in range(6):
            yy = int(h * (0.55 + k * 0.07))
            pts = [(x, yy + int(18 * math.sin(x / 70.0 + k))) for x in range(0, w + 1, 24)]
            d.line(pts, fill=colour + (40,), width=6)
    elif motif == "sparkles":
        for _ in range(38):
            x, y = rnd.randint(0, w), rnd.randint(0, int(h * 0.55))
            s = rnd.randint(4, 12)
            d.line([(x - s, y), (x + s, y)], fill=colour + (120,), width=2)
            d.line([(x, y - s), (x, y + s)], fill=colour + (120,), width=2)
    else:  # generic soft bokeh already covers it
        pass
    layer = layer.filter(ImageFilter.GaussianBlur(2))
    return Image.alpha_composite(base, layer)


def add_vignette(base, strength=120):
    w, h = base.size
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([-w * 0.25, -h * 0.15, w * 1.25, h * 1.15], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(180))
    dark = Image.new("RGBA", (w, h), (0, 0, 0, strength))
    inv = mask.point(lambda p: strength - int(p / 255 * strength))
    dark.putalpha(inv)
    return Image.alpha_composite(base, dark)


def main():
    ap = argparse.ArgumentParser(description="Generate a text/logo-free background (Stage 1).")
    ap.add_argument("--template", required=True, help="Template name (see TEMPLATES).")
    ap.add_argument("--output", required=True, help="Output PNG path.")
    ap.add_argument("--format", default="story", choices=list(FORMATS), help="Canvas format.")
    ap.add_argument("--seed", type=int, default=42, help="Deterministic seed.")
    args = ap.parse_args()

    key = args.template.strip().lower()
    key = ALIASES.get(key, key)
    if key not in TEMPLATES:
        sys.exit(f"ERROR: unknown template '{args.template}'. "
                 f"Available: {', '.join(sorted(TEMPLATES))}")

    w, h = FORMATS[args.format]
    spec = TEMPLATES[key]
    img = vertical_gradient(w, h, spec["grad"]).convert("RGBA")
    img = add_bokeh(img, spec["bokeh"], count=max(10, int(w * h / 90000)), seed=args.seed)
    img = add_motif(img, spec["motif"], spec["bokeh"], seed=args.seed)
    img = add_vignette(img)

    if img.size != (w, h):
        sys.exit(f"ERROR: size drift {img.size}, expected {(w, h)}")
    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)
    img.convert("RGB").save(args.output, "PNG")
    print(f"OK  background '{key}' [{args.format}]  {w}x{h}  -> {args.output}")


if __name__ == "__main__":
    main()
