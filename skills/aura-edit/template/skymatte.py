# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "scipy"]
# ///
"""Sky matte for type behind the mountains: frames/sNN/0001.jpg... -> frames/sNN/m0001.jpg... (grey, white = in front of the
type, i.e. everything below the skyline). aura.py build runs it for shots with behind: "sky".

    uv run skymatte.py frames/s00 [frames/s03 ...]

A skyline walk, not a colour key: each column is walked down from the top (at 480 px wide), following the sky's own colour
as it drifts (an exponential average), and stops at the first run of 3 pixels that differs from it by more than 0.12 (RGB 0-1).
A stop is skipped when sky comes back (within 0.2: the sky under a cloud is lighter) within 15 % of the height below it (a cloud); a snow cap isn't skipped, because
rock follows it. The skyline is median-smoothed over 7 columns, scaled up, and feathered 2 px.
Why: the first version keyed "blue and bright, connected to the top". After a cool grade the upper rock faces and the hazy
far ridges are blue-grey too, so it called them sky and the title drew over the mountains (the user's screenshot), and it
left the clouds out of the sky."""
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import median_filter

TH, RUN, BACK, BACK_TH, EMA = 0.12, 3, 0.15, 0.2, 0.15  # BACK_TH: the sky under a cloud is lighter than above it

def skyline(a):  # a: h x w x 3 in 0..1 (small) -> first non-sky row per column
    h, w, _ = a.shape; out = np.full(w, h)
    for x in range(w):
        col = a[:, x]; sky = col[1:4].mean(0); y = 1
        while y < h - RUN:
            d = np.abs(col[y:y + RUN] - sky).max(1)
            if (d <= TH).any(): sky = (1 - EMA) * sky + EMA * col[y]; y += 1; continue
            back = next((yy for yy in range(y + RUN, min(h - RUN, y + int(BACK * h))) if np.abs(col[yy:yy + RUN] - sky).max() <= BACK_TH), None)
            if back is None: break
            y = back; sky = col[back:back + RUN].mean(0)  # carry on from the sky under the cloud
        out[x] = y
    return median_filter(out, 7)  # 7 columns of 480: removes notches where snow touches the sky, keeps the peaks

def matte(p):
    im = Image.open(p).convert("RGB"); W, H = im.size; w = 480; h = round(H * w / W)
    a = np.asarray(im.resize((w, h), Image.BILINEAR)).astype(float) / 255
    top = np.interp(np.arange(W), np.linspace(0, W - 1, w), skyline(a) * H / h)
    fg = (np.arange(H)[:, None] >= top[None, :]).astype(np.uint8) * 255
    return Image.fromarray(fg).filter(ImageFilter.GaussianBlur(2))

for d in sys.argv[1:]:
    fs = sorted(Path(d).glob("[0-9]*.jpg"))
    for f in fs: matte(f).save(f.with_name("m" + f.name), quality=92)
    print(f"{d}: {len(fs)} sky mattes")
