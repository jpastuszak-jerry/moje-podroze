"""Generate deterministic PWA icons for Moje Podroze.

The design is intentionally simple at 32px: a folded travel map, a route,
and a warm current-stop marker. All output files land in static/icons/.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


OUT_DIR = Path(__file__).resolve().parent.parent / "static" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BG_TOP = (16, 82, 111)
BG_BOTTOM = (8, 30, 58)
TEAL_LIGHT = (76, 224, 203, 255)
TEAL = (26, 177, 190, 255)
TEAL_DARK = (12, 114, 145, 255)
INK = (9, 46, 72, 255)
WHITE = (255, 255, 255, 255)
AMBER = (255, 195, 96, 255)
CORAL = (255, 93, 67, 255)


def vertical_gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h), top)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = round(top[0] + (bottom[0] - top[0]) * t)
        g = round(top[1] + (bottom[1] - top[1]) * t)
        b = round(top[2] + (bottom[2] - top[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img.convert("RGBA")


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size[0] - 1, size[1] - 1],
        radius=radius,
        fill=255,
    )
    return mask


def with_rounded_corners(img, radius):
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), rounded_mask(img.size, radius))
    return out


def add_background_glow(img):
    w, h = img.size
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.ellipse(
        [w * 0.02, h * 0.02, w * 0.92, h * 0.80],
        fill=(42, 205, 189, 58),
    )
    draw.ellipse(
        [w * 0.30, h * 0.18, w * 1.12, h * 1.05],
        fill=(255, 126, 91, 25),
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=max(4, w // 18)))
    img.alpha_composite(overlay)


def qcurve(p0, p1, p2, steps=32):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        a = (1 - t) * (1 - t)
        b = 2 * (1 - t) * t
        c = t * t
        pts.append((
            a * p0[0] + b * p1[0] + c * p2[0],
            a * p0[1] + b * p1[1] + c * p2[1],
        ))
    return pts


def draw_poly_shadow(img, points, blur, offset, alpha):
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    shifted = [(x + offset[0], y + offset[1]) for x, y in points]
    ImageDraw.Draw(layer).polygon(shifted, fill=(0, 0, 0, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(radius=blur))
    img.alpha_composite(layer)


def draw_folded_map(img, cx, cy, s):
    draw = ImageDraw.Draw(img, "RGBA")

    p1 = (cx - 0.39 * s, cy - 0.18 * s)
    p2 = (cx - 0.13 * s, cy - 0.30 * s)
    p3 = (cx + 0.12 * s, cy - 0.20 * s)
    p4 = (cx + 0.39 * s, cy - 0.30 * s)
    p5 = (cx + 0.39 * s, cy + 0.20 * s)
    p6 = (cx + 0.12 * s, cy + 0.31 * s)
    p7 = (cx - 0.13 * s, cy + 0.21 * s)
    p8 = (cx - 0.39 * s, cy + 0.31 * s)

    outline = [p1, p2, p3, p4, p5, p6, p7, p8]
    draw_poly_shadow(img, outline, blur=max(2, int(0.025 * s)), offset=(0, int(0.035 * s)), alpha=88)

    map_mask = Image.new("L", img.size, 0)
    mask_draw = ImageDraw.Draw(map_mask)
    mask_draw.polygon(outline, fill=255)

    draw.polygon([p1, p2, p7, p8], fill=TEAL_LIGHT)
    draw.polygon([p2, p3, p6, p7], fill=TEAL)
    draw.polygon([p3, p4, p5, p6], fill=TEAL_DARK)

    texture = Image.new("RGBA", img.size, (0, 0, 0, 0))
    tex = ImageDraw.Draw(texture, "RGBA")
    waves = [
        ((cx - 0.47 * s, cy - 0.02 * s), (cx - 0.24 * s, cy - 0.15 * s), (cx + 0.04 * s, cy - 0.04 * s)),
        ((cx - 0.40 * s, cy + 0.17 * s), (cx - 0.18 * s, cy + 0.05 * s), (cx + 0.10 * s, cy + 0.16 * s)),
        ((cx - 0.04 * s, cy - 0.20 * s), (cx + 0.18 * s, cy - 0.02 * s), (cx + 0.43 * s, cy - 0.12 * s)),
        ((cx + 0.05 * s, cy + 0.20 * s), (cx + 0.22 * s, cy + 0.06 * s), (cx + 0.45 * s, cy + 0.16 * s)),
    ]
    for p0, p_mid, p_end in waves:
        tex.line(
            qcurve(p0, p_mid, p_end, steps=30),
            fill=(4, 91, 121, 70),
            width=max(2, int(0.050 * s)),
            joint="curve",
        )
    img.alpha_composite(Image.composite(texture, Image.new("RGBA", img.size, (0, 0, 0, 0)), map_mask))

    draw.line([p2, p7], fill=(255, 255, 255, 58), width=max(2, int(0.010 * s)))
    draw.line([p3, p6], fill=(0, 67, 96, 70), width=max(2, int(0.012 * s)))
    draw.line(outline + [p1], fill=(130, 255, 238, 92), width=max(2, int(0.012 * s)))


def draw_route(img, cx, cy, s):
    draw = ImageDraw.Draw(img, "RGBA")
    start = (cx - 0.29 * s, cy + 0.06 * s)
    mid = (cx - 0.09 * s, cy + 0.11 * s)
    main = (cx + 0.10 * s, cy + 0.06 * s)
    end = (cx + 0.30 * s, cy - 0.10 * s)

    route = []
    route.extend(qcurve(start, (cx - 0.20 * s, cy - 0.02 * s), mid, steps=18))
    route.extend(qcurve(mid, (cx + 0.01 * s, cy + 0.18 * s), main, steps=18)[1:])
    route.extend(qcurve(main, (cx + 0.20 * s, cy - 0.04 * s), end, steps=22)[1:])

    draw.line(route, fill=(5, 52, 76, 74), width=max(5, int(0.044 * s)), joint="curve")
    draw.line(route, fill=WHITE, width=max(4, int(0.030 * s)), joint="curve")

    draw_stop(draw, start, 0.044 * s, TEAL)
    draw_stop(draw, mid, 0.045 * s, AMBER)
    draw_stop(draw, end, 0.043 * s, TEAL_LIGHT)
    draw_stop(draw, main, 0.070 * s, CORAL, shadow=True)


def draw_stop(draw, center, radius, fill, shadow=False):
    x, y = center
    r = radius
    if shadow:
        draw.ellipse(
            [x - r * 1.25, y - r * 1.15 + r * 0.18, x + r * 1.25, y + r * 1.35],
            fill=(0, 0, 0, 48),
        )
    draw.ellipse([x - r * 1.18, y - r * 1.18, x + r * 1.18, y + r * 1.18], fill=WHITE)
    draw.ellipse([x - r * 0.72, y - r * 0.72, x + r * 0.72, y + r * 0.72], fill=fill)


def draw_content(img, scale):
    w, h = img.size
    cx = w / 2
    cy = h / 2 + h * 0.01
    s = min(w, h) * scale

    draw_folded_map(img, cx, cy, s)
    draw_route(img, cx, cy, s)


def make_icon(size, *, maskable=False):
    ss = 4
    big_size = size * ss
    img = vertical_gradient(big_size, big_size, BG_TOP, BG_BOTTOM)
    add_background_glow(img)

    if not maskable:
        img = with_rounded_corners(img, int(big_size * 0.22))

    draw_content(img, 0.70 if maskable else 0.86)
    return img.resize((size, size), Image.LANCZOS)


def main():
    targets = [
        ("icon-192.png", 192, False),
        ("icon-512.png", 512, False),
        ("icon-maskable-512.png", 512, True),
        ("apple-touch-icon.png", 180, False),
        ("favicon-32.png", 32, False),
    ]
    for name, size, maskable in targets:
        out = OUT_DIR / name
        img = make_icon(size, maskable=maskable)
        img.save(out, "PNG", optimize=True)
        suffix = ", maskable" if maskable else ""
        print(f"  {out.relative_to(OUT_DIR.parent.parent)} ({size}x{size}{suffix})")
    print("Done.")


if __name__ == "__main__":
    main()
