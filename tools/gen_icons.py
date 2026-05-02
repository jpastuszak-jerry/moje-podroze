"""Generuje ikony PWA: walizka z globusem na niebieskim gradiencie.

Uruchom raz po zmianie designu:
    pip install Pillow
    python tools/gen_icons.py

Pliki wynikowe trafiają do static/icons/.
"""
from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "static" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BLUE_TOP = (26, 111, 219)    # #1a6fdb
BLUE_BOT = (13, 79, 168)     # #0d4fa8
WHITE = (255, 255, 255, 255)


def vertical_gradient(w, h, top, bot):
    img = Image.new("RGB", (w, h), top)
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = round(top[0] + (bot[0] - top[0]) * t)
        g = round(top[1] + (bot[1] - top[1]) * t)
        b = round(top[2] + (bot[2] - top[2]) * t)
        for x in range(w):
            px[x, y] = (r, g, b)
    return img.convert("RGBA")


def with_rounded_corners(img, radius):
    w, h = img.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w, h], radius=radius, fill=255)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def draw_content(img, scale):
    """Rysuje walizkę z globusem. scale ∈ (0, 1] — pomniejsza treść (dla maskable safe zone)."""
    w, h = img.size
    cx, cy = w / 2, h / 2
    s = min(w, h) * scale  # rozmiar bazowy treści

    def to_px(u, v):
        return (cx + u * s, cy + v * s)

    def rect(u1, v1, u2, v2):
        return [to_px(u1, v1), to_px(u2, v2)]

    draw = ImageDraw.Draw(img, "RGBA")

    # Uchwyt walizki — biała ramka U-shape
    handle_w = 0.04 * s
    draw.rounded_rectangle(
        rect(-0.14, -0.34, 0.14, -0.16),
        radius=0.06 * s,
        outline=WHITE,
        width=int(handle_w),
    )

    # Korpus walizki — biały zaokrąglony prostokąt
    draw.rounded_rectangle(
        rect(-0.34, -0.20, 0.34, 0.30),
        radius=0.05 * s,
        fill=WHITE,
    )

    # Globus na froncie walizki (środek korpusu)
    g_cx, g_cy = cx, cy + 0.05 * s
    g_r = 0.16 * s

    # Wnętrze globusa: jasnoniebieskie koło (kolor pasujący do tła)
    blue_mid = (20, 95, 195, 255)
    draw.ellipse(
        [g_cx - g_r, g_cy - g_r, g_cx + g_r, g_cy + g_r],
        fill=blue_mid,
    )

    # Linie globusa — białe południki + równik
    line_w = max(int(0.012 * s), 2)

    # Równik (pozioma średnica)
    draw.line(
        [(g_cx - g_r, g_cy), (g_cx + g_r, g_cy)],
        fill=WHITE,
        width=line_w,
    )

    # Południk pionowy (środkowy)
    draw.line(
        [(g_cx, g_cy - g_r), (g_cx, g_cy + g_r)],
        fill=WHITE,
        width=line_w,
    )

    # Południki — elipsy o malejącej szerokości
    for ratio in (0.6, 0.25):
        ew = g_r * ratio
        draw.ellipse(
            [g_cx - ew, g_cy - g_r, g_cx + ew, g_cy + g_r],
            outline=WHITE,
            width=line_w,
        )

    # Subtelny "horyzont" — drugi łuk poziomy (lekko niżej środka, dla 3D)
    arc_offset = g_r * 0.45
    draw.arc(
        [g_cx - g_r, g_cy - g_r + arc_offset, g_cx + g_r, g_cy + g_r + arc_offset],
        start=180, end=360,
        fill=WHITE,
        width=line_w,
    )


def make_icon(size, *, maskable=False):
    # Renderuję na 4× supersample dla gładszych krawędzi, potem downsample.
    ss = 4
    big = vertical_gradient(size * ss, size * ss, BLUE_TOP, BLUE_BOT)

    if not maskable:
        big = with_rounded_corners(big, int(size * ss * 0.22))

    # Maskable: treść mniejsza (safe zone — Android przycina do koła r=40%)
    scale = 0.62 if maskable else 0.78
    draw_content(big, scale)

    return big.resize((size, size), Image.LANCZOS)


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
        print(f"  {out.relative_to(OUT_DIR.parent.parent)}  ({size}x{size}{', maskable' if maskable else ''})")
    print("Done.")


if __name__ == "__main__":
    main()
