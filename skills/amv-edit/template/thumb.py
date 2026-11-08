#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "scipy"]
# ///
"""AMV thumbnail: a full-size character cutout in front of a full-width, bold, arched title,
with a wide spaced serif line in front, graded like the AMV, edges softly blurred. 1280x720.

    swift ~/.claude/skills/ugc-edit/template/lift.swift frame.png cut.png      # subject lift (macOS Vision)
    uv run thumb.py frame.png cut.png out.jpg --title HARVEY --sub HORIMIYA [--bg scene.png] [--deglow]
                    [--title-y 0.35] [--arc 150]

frame.png    a strong close-up from the clips (full 1920x1080 frame)
cut.png      lift.swift's output for it: same size, everything but the subject transparent
--bg         a separate sharp scene for the background; use it when the frame's own backdrop is a
             soft-focus blur (it reads as "background too blurred" however little you add)
--deglow     drop sparkle/glow the mask caught near hair edges (bright non-red, or yellow, near the edge)
--title-y    title centre as a fraction of height; --arc  px the title's middle rises
"""
import argparse, os, sys
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("frame"); ap.add_argument("cut"); ap.add_argument("out")
ap.add_argument("--title", required=True); ap.add_argument("--sub", default="")
ap.add_argument("--bg"); ap.add_argument("--deglow", action="store_true")
ap.add_argument("--title-y", type=float, default=0.35); ap.add_argument("--arc", type=float, default=150)
A = ap.parse_args()
W, H = 1920, 1080

def _first(*cands):  # first font file that exists: (path, ttc index, variable-font named style)
    for c in cands:
        if os.path.exists(c[0]): return c
    sys.exit(f"no font found among {[c[0] for c in cands]}")
_FEATURE = [os.path.join(d, f) for d in (os.path.expanduser("~/Library/Fonts"), "/Library/Fonts") if os.path.isdir(d)
            for f in os.listdir(d) if "FeatureHeadline" in f and f.endswith((".ttf", ".otf"))]
SERIF = _first(*[(f, 0, b"Display Regular") for f in _FEATURE], ("/System/Library/Fonts/Supplemental/Baskerville.ttc", 0, None))
BOLD = _first(("/System/Library/Fonts/Supplemental/GillSans.ttc", 4, None),      # Gill Sans SemiBold
              ("/System/Library/Fonts/Supplemental/Futura.ttc", 2, None))

src = Image.open(A.frame).convert("RGB").resize((W, H))
subj = Image.open(A.cut).convert("RGBA").resize((W, H))  # full size, original position: never rescale it

def clean(cut_img, frame_img):
    """Tidy the Vision mask: hard threshold, optional glow removal, drop stray islands, close only
    pinholes, pull the edge in ~2 px, feather 1 px, and give edge pixels the subject's own nearby
    colours so no bright fringe of the old background is left."""
    from scipy import ndimage
    hard = np.asarray(cut_img.getchannel("A")) > 140
    if A.deglow:
        rgbf = np.asarray(frame_img).astype(np.float32); r_, g_, b_ = rgbf[..., 0], rgbf[..., 1], rgbf[..., 2]
        luma = rgbf @ [0.299, 0.587, 0.114]
        near = hard & ~ndimage.binary_erosion(hard, iterations=45)
        near_wide = hard & ~ndimage.binary_erosion(hard, iterations=70)
        upper = (np.arange(H) < H * 0.6)[:, None]
        yellow = (r_ > 170) & (g_ > 150) & (b_ < g_ - 35) & ((r_ - g_) < 60)   # sparkle glow: yellow, unlike shirt or skin
        glow = (near & upper & (luma > 165) & ((r_ - g_) < 45)) | (near_wide & yellow)
        hard &= ~ndimage.binary_dilation(glow, iterations=2)
        hard = ndimage.binary_opening(hard, iterations=2)
    lab, n = ndimage.label(hard)
    if n > 1:  # keep the characters, drop glow islands
        sizes = ndimage.sum(hard, lab, range(1, n + 1))
        hard = np.isin(lab, 1 + np.flatnonzero(sizes >= sizes.max() * 0.02))
    holes = ndimage.binary_fill_holes(hard) & ~hard   # pinholes only: gaps between hair strands stay open
    hl, hn = ndimage.label(holes)
    if hn: hard |= np.isin(hl, 1 + np.flatnonzero(ndimage.sum(holes, hl, range(1, hn + 1)) < 400))
    hard = ndimage.binary_erosion(hard, iterations=2)
    soft = ndimage.gaussian_filter(hard.astype(np.float32), 1.0)
    rgb = np.asarray(frame_img).astype(np.float32)
    core = ndimage.binary_erosion(hard, iterations=4).astype(np.float32)
    num = ndimage.gaussian_filter(rgb * core[..., None], (6, 6, 0)); den = ndimage.gaussian_filter(core, 6)[..., None]
    inner = np.where(den > 1e-3, num / np.maximum(den, 1e-3), rgb)
    band = np.clip((1 - core) * (soft > 0.01), 0, 1)[..., None] * 0.85
    rgb = rgb * (1 - band) + inner * band
    return Image.fromarray(np.dstack([np.clip(rgb, 0, 255), soft * 255]).astype(np.uint8), "RGBA")
subj = clean(subj, src)

# background: barely blurred, darker, a little more colour, vignette, pink light from the top right
bgsrc = Image.open(A.bg).convert("RGB").resize((W, H)) if A.bg else src
bg = ImageEnhance.Brightness(bgsrc.filter(ImageFilter.GaussianBlur(0.8))).enhance(0.75 if A.bg else 0.48)
bg = np.asarray(ImageEnhance.Color(bg).enhance(1.15)).astype(np.float32)
yy, xx = np.mgrid[0:H, 0:W]
bg *= (1 - 0.65 * np.clip((np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)) - 0.5) / 0.85, 0, 1) ** 1.5)[..., None]
light = np.clip(1 - np.hypot((xx - W * 0.95) / (W * 0.7), (yy + H * 0.1) / H), 0, 1)[..., None] ** 1.4
bg = 255 - (255 - bg) * (1 - light * 0.45 * np.array([255, 80, 160], np.float32) / 255)
comp = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8)).convert("RGBA")

def text_mask(text, font, track, target_w):
    """Tracked text as an L mask, font size solved so the word fills target_w."""
    path, idx, var = font
    def build(size):
        f = ImageFont.truetype(path, size, index=idx)
        if var: f.set_variation_by_name(var)
        ws = [f.getlength(c) for c in text]; gap = track * size
        return f, ws, gap, sum(ws) + gap * (len(ws) - 1)
    f, ws, gap, tw = build(200)
    f, ws, gap, tw = build(int(200 * target_w / tw))
    asc, desc = f.getmetrics(); pad = 90
    m = Image.new("L", (int(tw) + 2 * pad, asc + desc + 2 * pad), 0)
    d, x = ImageDraw.Draw(m), pad
    for c, w in zip(text, ws):
        d.text((x, pad), c, font=f, fill=255); x += w + gap
    l, t, r, b = m.getbbox()
    return m.crop((l - pad, t - pad, r + pad, b + pad))

def arch(mask, rise, bulge=0.12):
    """Bend a text mask into an arch: the middle rises by `rise` px and grows `bulge` taller."""
    a = np.asarray(mask).astype(np.float32); h, w = a.shape
    pad = int(rise + h * bulge) + 4
    a = np.pad(a, ((pad, pad), (0, 0))); H2 = a.shape[0]; cy = H2 / 2
    u = (np.arange(w) - w / 2) / (w / 2)
    shift, scale = rise * (1 - u ** 2), 1 + bulge * (1 - u ** 2)
    sy = cy + (np.arange(H2)[:, None] - cy + shift[None, :]) / scale[None, :]
    y0 = np.clip(np.floor(sy).astype(int), 0, H2 - 2); fy = np.clip(sy - y0, 0, 1); cols = np.arange(w)[None, :]
    return Image.fromarray(np.clip(a[y0, cols] * (1 - fy) + a[y0 + 1, cols] * fy, 0, 255).astype(np.uint8))

def paint(mask, top, bottom, right_tint=None, glow=1.0, glow_r=14, shadow=None):
    """Gradient fill (top->bottom, optional tint toward the right), soft glow, tight soft drop shadow.
    shadow=(alpha, blur, offset). No dark outline: a hard dark edge reads as a black border."""
    h, w = mask.height, mask.width
    gy = np.linspace(0, 1, h)[:, None, None]
    rgb = np.repeat(np.array(top, np.float32) * (1 - gy) + np.array(bottom, np.float32) * gy, w, 1)
    if right_tint:
        gx = np.clip((np.linspace(0, 1, w) - 0.45) / 0.55, 0, 1)[None, :, None] ** 1.3
        rgb = rgb * (1 - 0.6 * gx) + np.array(right_tint, np.float32) * 0.6 * gx
    txt = Image.fromarray(np.dstack([rgb.astype(np.uint8), np.asarray(mask)]), "RGBA")
    g = mask.filter(ImageFilter.GaussianBlur(glow_r)).point(lambda v: min(255, int(v * glow)))
    glow_l = Image.merge("RGBA", (*(Image.new("L", mask.size, c) for c in (255, 235, 245)), g))
    sa, sb, so = shadow or (175, max(2.5, h // 110), max(2, h // 120))
    sh = ImageChops.offset(mask, 0, int(so)).filter(ImageFilter.GaussianBlur(sb))
    sh_l = Image.merge("RGBA", (*(Image.new("L", mask.size, 0) for _ in range(3)), sh.point(lambda v: min(255, v * sa // 255))))
    return Image.alpha_composite(Image.alpha_composite(sh_l, glow_l), txt)

T = paint(arch(text_mask(A.title, BOLD, 0.01, W * 0.94), A.arc), (252, 252, 255), (178, 180, 192),
          right_tint=(255, 140, 195), glow=0.9)                     # silver, pink toward the right
cy = int(H * A.title_y)
comp.alpha_composite(T, ((W - T.width) // 2, cy - T.height // 2))   # title behind the subject
a = subj.getchannel("A")                                            # no rim light: it drew a white outline
s = ImageEnhance.Contrast(subj.convert("RGB")).enhance(1.06); s.putalpha(a)
comp.alpha_composite(s.filter(ImageFilter.UnsharpMask(2, 70, 2)))
if A.sub:  # small serif line in front of the subject (behind it, the body hid it), stronger shadow
    S = paint(text_mask(A.sub, SERIF, 1.25, W * 0.62), (255, 255, 255), (230, 226, 235), glow=1.3, glow_r=10,
              shadow=(255, 5, 4))
    comp.alpha_composite(S, ((W - S.width) // 2, cy + int(T.height * 0.34)))

# grade, matched to the AMV: curve (deeper blacks, highlights rolled off), +14% colour, slightly warm,
# luma-only bloom from the highlights (no hue shift); then soft blur toward the frame edges
g = np.asarray(comp.convert("RGB")).astype(np.float32) / 255
g = np.interp(g, [0, 0.12, 0.5, 0.8, 1], [0, 0.06, 0.48, 0.80, 0.95])
lum = (g @ [0.299, 0.587, 0.114])[..., None]
g = (lum + (g - lum) * 1.14) * np.array([1.03, 1.0, 0.96])
lum = g @ [0.299, 0.587, 0.114]
bloom = np.asarray(Image.fromarray((np.clip((lum - 0.62) / 0.38, 0, 1) * 255).astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(26))).astype(np.float32)[..., None] / 255
flat = Image.fromarray((np.clip(1 - (1 - g) * (1 - bloom * 0.35), 0, 1) * 255).astype(np.uint8))
r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2)) / np.sqrt(2)
m = Image.fromarray((np.clip((r - 0.5) / 0.5, 0, 1) ** 1.4 * 255).astype(np.uint8))
flat = Image.composite(flat.filter(ImageFilter.GaussianBlur(9)), flat, m)
flat.resize((1280, 720), Image.LANCZOS).save(A.out, quality=94)
print("wrote", A.out)
