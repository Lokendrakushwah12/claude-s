# /// script
# dependencies = ["numpy"]
# ///
"""grade.cube: the teal-and-emerald travel grade, measured on the reference reel (instagram.com/p/DTrw7GuCcDB, 2026-11-14):
deep blacks tinted teal-green (shadow mean ~(10,38,40)), skies pushed to cyan (hue ~196, not ~215), dense saturated greens
(hue 90-115, sat ~0.5-0.75), cool neutral highlights that roll off before clipping (p99 ~0.9), strong midtone contrast.
Built as a 33^3 LUT over display (Rec.709 gamma) RGB and baked into every frame by aura.py (aura.json "grade").
    uv run grade.py            writes grade.cube
Tune the numbers in G and re-run; aura.py re-pulls the frames when the cube changes."""
import numpy as np

G = dict(
    in_black=0.13, in_white=0.95,     # input levels: iPhone SDR sits on a ~34/255 floor; the reference's blacks are ~10/255
    black=0.025, white=0.95,          # output black and white points: blacks lifted a hair, highlights rolled off
    contrast=1.35, pivot=0.45,        # midtone S-curve strength about the pivot
    sat=1.10,                         # overall saturation
    green_hue=120, green_pull=0.9, green_sat=1.25,    # yellow-greens pulled toward emerald, then saturated
    sky_hue=197, sky_pull=0.6, sky_sat=1.0,           # blues pulled toward cyan (the pull alone lifts their saturation)
    green_deepen=0.36,                # bright greens pulled down this much at full value
    skin_sat=0.95,                    # oranges/skin held back so faces don't go red
    shadow_tint=(-0.07, 0.012, 0.02), shadow_amt=1.0, # teal-green shadows
    high_tint=(-0.006, 0.0, 0.008),   # a cool touch in the highlights
    cool=(0.94, 1.0, 1.05),           # white balance pushed cool (R, G, B gains): the reference's cyan cast
)
# measured against the reference on 14 of our frames: L pct [1,5,25,50,75,95,99], shadow mean, green and sky hue/sat
#   reference  [10,24,57,124,170,216,229]  (15,37,30)  green 102/0.57  sky 200/0.39
#   ungraded   [34,55,91,126,160,196,220]  (61,65,55)  green  74/0.42  sky 208/0.30

def rgb2hsv(c):
    r, g, b = c[..., 0], c[..., 1], c[..., 2]; mx, mn = c.max(-1), c.min(-1); d = mx - mn + 1e-9
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    return np.stack([np.where(mx - mn < 1e-6, 0, h), np.where(mx > 0, (mx - mn) / (mx + 1e-9), 0), mx], -1)

def hsv2rgb(x):
    h, s, v = x[..., 0] % 360 / 60, x[..., 1], x[..., 2]; i = np.floor(h).astype(int) % 6; f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    return np.stack([np.choose(i, [v, q, p, p, t, v]), np.choose(i, [t, v, v, q, p, p]), np.choose(i, [p, p, t, v, v, q])], -1)

def band(h, c, w):  # smooth weight 1 at hue c, 0 beyond +-w
    d = np.abs((h - c + 180) % 360 - 180); return np.clip(1 - d / w, 0, 1) ** 1.5

def grade(c, g=G):
    c = np.clip((c - g["in_black"]) / (g["in_white"] - g["in_black"]), 0, 1)
    c = np.clip(c * np.array(g["cool"]), 0, 1)
    L = c @ [0.2126, 0.7152, 0.0722]
    # contrast: a logistic S about the pivot, normalised so 0 -> 0 and 1 -> 1
    k = 4 * g["contrast"]; s = lambda x: 1 / (1 + np.exp(-k * (x - g["pivot"])))
    L2 = (s(L) - s(0)) / (s(1) - s(0))
    c = c * (L2 / np.maximum(L, 1e-4))[..., None]
    c = np.where(L[..., None] < 1e-4, L2[..., None], c)
    x = rgb2hsv(np.clip(c, 0, 1)); h, sat = x[..., 0], x[..., 1]
    gw = band(h, 95, 55) * np.clip(sat * 4, 0, 1)        # greens (and yellow-greens), not greys
    bw = band(h, 212, 35) * np.clip(sat * 5, 0, 1)       # blues
    kw = band(h, 25, 22)                                  # skin / oranges
    h = h + gw * g["green_pull"] * (((g["green_hue"] - h + 180) % 360) - 180)
    h = h + bw * g["sky_pull"] * (((g["sky_hue"] - h + 180) % 360) - 180)
    v = x[..., 2]; hi = np.clip((v - 0.42) / 0.45, 0, 1)  # sunlit grass: less boost and a touch darker, or it goes neon lime
    sat = sat * g["sat"] * (1 + gw * (g["green_sat"] - 1) * (1 - 0.65 * hi)) * (1 + bw * (g["sky_sat"] - 1)) * (1 + kw * (g["skin_sat"] - 1))
    x = np.stack([h, np.clip(sat, 0, 1), v * (1 - g["green_deepen"] * gw * hi)], -1); c = hsv2rgb(x)
    L = c @ [0.2126, 0.7152, 0.0722]
    c = c + np.array(g["shadow_tint"]) * (g["shadow_amt"] * np.clip(1 - L / 0.45, 0, 1) ** 2)[..., None]
    c = c + np.array(g["high_tint"]) * (np.clip((L - 0.6) / 0.4, 0, 1))[..., None]
    c = np.clip(c, 0, 1)
    # output range: black lift and a soft shoulder into the white point
    c = g["black"] + (g["white"] - g["black"]) * c
    return np.clip(c, 0, 1)

if __name__ == "__main__":
    n = 33; r = np.linspace(0, 1, n)
    b, gg, rr = np.meshgrid(r, r, r, indexing="ij")          # .cube order: red fastest
    out = grade(np.stack([rr, gg, b], -1).reshape(-1, 3))
    with open("grade.cube", "w") as f:
        f.write(f"TITLE \"kashmir teal-emerald\"\nLUT_3D_SIZE {n}\n")
        f.write("\n".join(f"{a:.6f} {b_:.6f} {c_:.6f}" for a, b_, c_ in out) + "\n")
    print("grade.cube written")
