"""Generuje ikony PWA: globus z samolotem lecącym po łuku trasy.

Uruchom raz po zmianie designu:
    pip install Pillow
    python tools/gen_icons.py

Pliki wynikowe trafiają do static/icons/.
"""
import math
from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "static" / "icons"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BLUE_TOP = (26, 111, 219)    # #1a6fdb
BLUE_BOT = (13, 79, 168)     # #0d4fa8
BLUE_GRID = (10, 60, 130, 255)   # ciemniejsze niż tło — wyraźne na białym globusie
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


def make_plane(wingspan_px):
    """Sylwetka samolotu (biała na transparent), nos do góry. Bounding box ≈ wingspan x 1.4*wingspan."""
    L = wingspan_px
    cw = int(L * 1.2)         # canvas wider than wingspan dla bezpiecznego rotate
    ch = int(L * 1.6)
    img = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = cw / 2, ch / 2

    # Kadłub: wydłużony romb pionowy (nos góra, ogon dół)
    body = [
        (cx, cy - L * 0.62),         # nos
        (cx + L * 0.05, cy + L * 0.10),
        (cx, cy + L * 0.55),         # ogon
        (cx - L * 0.05, cy + L * 0.10),
    ]
    # Główne skrzydła: szeroki romb poprzeczny przy 1/3 od nosa
    wings = [
        (cx - L * 0.50, cy + L * 0.02),
        (cx,            cy - L * 0.10),
        (cx + L * 0.50, cy + L * 0.02),
        (cx,            cy + L * 0.18),
    ]
    # Stery ogonowe: mniejszy romb przy ogonie
    tail = [
        (cx - L * 0.18, cy + L * 0.42),
        (cx,            cy + L * 0.34),
        (cx + L * 0.18, cy + L * 0.42),
        (cx,            cy + L * 0.50),
    ]
    draw.polygon(body, fill=WHITE)
    draw.polygon(wings, fill=WHITE)
    draw.polygon(tail, fill=WHITE)
    return img


def draw_content(img, scale):
    """Rysuje globus + łuk trasy + samolot w środku canvasu.
    scale ∈ (0, 1]: dla maskable mniejszy (safe zone Android = r 40%)."""
    w, h = img.size
    cx, cy = w / 2, h / 2
    s = min(w, h) * scale

    draw = ImageDraw.Draw(img, "RGBA")

    # ── 1. Łuk trasy lotu (NAD globusem) ──────────────────────
    # Elipsa lekko szersza niż globus, mocno spłaszczona; tylko górna połowa
    arc_w = 0.40 * s        # half-width łuku (mieści się w canvasie)
    arc_h = 0.30 * s        # half-height (wysokość łuku)
    arc_cy = cy - 0.20 * s  # arc_cy mocno wyżej niż środek (góra ikony)
    line_w_arc = max(int(0.022 * s), 2)
    draw.arc(
        [cx - arc_w, arc_cy - arc_h, cx + arc_w, arc_cy + arc_h],
        start=180, end=360,
        fill=WHITE,
        width=line_w_arc,
    )

    # ── 2. Globus (białe koło + ciemnoniebieskie linie siatki) ──
    g_r = 0.30 * s          # mniejszy globus żeby zostawić miejsce na łuk
    g_cx, g_cy = cx, cy + 0.07 * s   # globus przesunięty w dół, łuk nad

    # Białe wypełnienie
    draw.ellipse(
        [g_cx - g_r, g_cy - g_r, g_cx + g_r, g_cy + g_r],
        fill=WHITE,
    )

    line_w = max(int(0.018 * s), 2)

    # Maska: linie siatki tylko WEWNĄTRZ globusa (przyciąć do koła)
    grid_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid_layer)

    # Równik
    gd.line(
        [(g_cx - g_r, g_cy), (g_cx + g_r, g_cy)],
        fill=BLUE_GRID, width=line_w,
    )
    # Pionowy meridian
    gd.line(
        [(g_cx, g_cy - g_r), (g_cx, g_cy + g_r)],
        fill=BLUE_GRID, width=line_w,
    )
    # Boczne południki (elipsy pionowe o malejącej szerokości)
    for ratio in (0.62, 0.25):
        ew = g_r * ratio
        gd.ellipse(
            [g_cx - ew, g_cy - g_r, g_cx + ew, g_cy + g_r],
            outline=BLUE_GRID, width=line_w,
        )
    # Paralele (elipsy poziome — jedna nad i jedna pod równikiem)
    for offset in (-0.45, 0.45):
        eh = g_r * 0.85   # mniejsza szerokość żeby paralele krzywiły się ładnie
        gd.ellipse(
            [g_cx - eh, g_cy + g_r * offset - g_r * 0.13,
             g_cx + eh, g_cy + g_r * offset + g_r * 0.13],
            outline=BLUE_GRID, width=line_w,
        )

    # Maska kołowa (ograniczy linie do okręgu globusa)
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse(
        [g_cx - g_r, g_cy - g_r, g_cx + g_r, g_cy + g_r],
        fill=255,
    )
    img.alpha_composite(Image.composite(grid_layer, Image.new("RGBA", img.size, (0,0,0,0)), mask))

    # ── 3. Samolot (w apogeum łuku, lekko pochylony) ──────────
    plane_wing = int(0.28 * s)
    plane = make_plane(plane_wing)
    plane = plane.rotate(-30, resample=Image.BICUBIC, expand=True)  # nos w prawo-górę
    # Apogeum łuku jest w (cx, arc_cy - arc_h). Samolot tam, dotyka łuku spodem skrzydeł.
    px = int(cx - plane.width / 2)
    py = int((arc_cy - arc_h) - plane.height / 2)
    img.alpha_composite(plane, (px, py))


def make_icon(size, *, maskable=False):
    ss = 4  # supersample dla gładkich krawędzi
    big = vertical_gradient(size * ss, size * ss, BLUE_TOP, BLUE_BOT)

    if not maskable:
        big = with_rounded_corners(big, int(size * ss * 0.22))

    # Maskable: treść mniejsza (safe zone — Android przycina do koła r=40%)
    scale = 0.62 if maskable else 0.82
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
