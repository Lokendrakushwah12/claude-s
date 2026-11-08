#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy"]
# ///
"""Take a reference AMV apart into numbers, and compare its grade with your raw footage.

    uv run refscan.py ref.mp4 out_dir/ [raw clip or folder ...]

Prints:
  pacing      cuts and the median shot length
  flashes     brightness pops (count, times; clusters of 2-3 a few frames apart = strobe pops)
  blur dips   sharpness dips and their length in frames (3-4 frames = quick-blur cuts)
  motion      frame-to-frame shift: vertical-only vs horizontal-only frames (shake direction)
  grade       p5 / p95 / mean luma, saturation, sharpness, edge/centre sharpness; with raw
              clips given, the same numbers for them, so you can see the reference's shift
              (deeper blacks? highlights pulled back? more colour? sharpened? soft edges?)
  music dips  quiet holes in the mix >= 0.6 s: where the reference lets character voice through
Writes out_dir/sheet.jpg (30 frames across the video). Read it: text style (font, size,
place, how it animates), corner branding, glow. Learn the style; never copy its words.
The grade comparison is directional when the reference is a different show (own palette).
"""
import os, subprocess, sys
import numpy as np

ref, outd, raws = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(outd, exist_ok=True)
def ff(*a, **k): return subprocess.run(["ffmpeg", "-loglevel", "error", *a], capture_output=True, **k)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", ref],
                           capture_output=True, text=True).stdout)

# --- per-frame scan at 24 fps, small grey frames
w, h, fps = 214, 120, 24
F = np.frombuffer(ff("-i", ref, "-vf", f"fps={fps},scale={w}:{h},format=gray", "-f", "rawvideo", "-").stdout,
                  np.uint8).reshape(-1, h, w).astype(np.float32)
n = len(F)
luma = F.mean((1, 2))
lap = np.array([np.var(4 * f[1:-1, 1:-1] - f[:-2, 1:-1] - f[2:, 1:-1] - f[1:-1, :-2] - f[1:-1, 2:]) for f in F])
diff = np.r_[0, np.abs(np.diff(F, axis=0)).mean((1, 2))]
cuts = [i for i in range(1, n) if diff[i] > 28]
flash = [i for i in range(1, n - 1) if luma[i] - np.median(luma[max(0, i - 12):i]) > 35
         and luma[i] >= luma[i - 1] and luma[i] >= luma[i + 1]]
def shift(a, b):
    R = np.fft.fft2(a - a.mean()) * np.conj(np.fft.fft2(b - b.mean())); R /= np.abs(R) + 1e-6
    r = np.abs(np.fft.ifft2(R)); y, x = np.unravel_index(r.argmax(), r.shape)
    return (x - w if x > w / 2 else x), (y - h if y > h / 2 else y), r.max()
mot = [shift(F[i], F[i - 1]) for i in range(1, n)]
mv = [(x, y) for x, y, c in mot if c > 0.15 and 1 <= max(abs(x), abs(y)) <= 10]
med = np.array([np.median(lap[max(0, i - 24):i + 24]) for i in range(n)])
dips, s = [], None
for i, b in enumerate(lap < 0.35 * med):
    if b and s is None: s = i
    if not b and s is not None:
        if i - s >= 2: dips.append((round(s / fps, 2), i - s))
        s = None
print(f"pacing      {len(cuts)} cuts in {dur:.0f} s: mean shot {dur / max(1, len(cuts)):.2f} s (how fast it feels), "
      f"median {np.median(np.diff([0] + cuts)) / fps:.2f} s (strobe pops count as cuts)")
print(f"flashes     {len(flash)}: {[round(i / fps, 2) for i in flash][:30]}")
print(f"blur dips   {len(dips)}, median {np.median([l for _, l in dips]) if dips else 0:.0f} frames: {dips[:20]}")
print(f"motion      vertical-only {sum(1 for x, y in mv if x == 0 and y)} frames, horizontal-only "
      f"{sum(1 for x, y in mv if y == 0 and x)}, both {sum(1 for x, y in mv if x and y)}")

# --- grade stats at 960x540
def frame(path, t):
    g = ff("-ss", f"{t:.2f}", "-i", path, "-frames:v", "1", "-vf", "scale=960:540", "-pix_fmt", "rgb24",
           "-f", "rawvideo", "-").stdout
    return np.frombuffer(g, np.uint8).reshape(540, 960, 3).astype(np.float32) if len(g) == 960 * 540 * 3 else None
def stats(fs):
    r = []
    for f in fs:
        y = f @ [0.299, 0.587, 0.114]
        L = np.abs(4 * y[1:-1, 1:-1] - y[:-2, 1:-1] - y[2:, 1:-1] - y[1:-1, :-2] - y[1:-1, 2:]); hh, ww = L.shape
        c = L[hh // 4:3 * hh // 4, ww // 4:3 * ww // 4].mean() + 1e-6
        e = np.r_[L[:, :ww // 10].ravel(), L[:, -ww // 10:].ravel(), L[:hh // 10].ravel(), L[-hh // 10:].ravel()].mean()
        r.append((np.percentile(y, 5), np.percentile(y, 95), y.mean(), (f.max(2) - f.min(2)).mean(), L.mean(), e / c))
    return np.median(np.array(r), 0)
names = ["p5", "p95", "mean", "sat", "sharp", "edge/centre"]
rh = int(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=height", "-of", "csv=p=0", ref],
                        capture_output=True, text=True).stdout or 0)
if rh < 720: print(f"note        reference is {rh}p: sharpness reads low; download 720p+ for grade numbers")
rs = stats([f for f in (frame(ref, 6 + k * (dur - 12) / 29) for k in range(30)) if f is not None])
print("grade ref   " + "  ".join(f"{a} {b:.2f}" for a, b in zip(names, rs)))
if raws:
    files = []
    for p in raws:
        files += sorted(os.path.join(r, f) for r, _, fs in os.walk(p) for f in fs if f.endswith((".mp4", ".mov", ".mkv"))) \
            if os.path.isdir(p) else [p]
    files = files[::max(1, len(files) // 30)][:30]
    ws = stats([f for f in (frame(p, 1.0) for p in files) if f is not None])
    print("grade raw   " + "  ".join(f"{a} {b:.2f}" for a, b in zip(names, ws)))
    print("ref vs raw  " + "  ".join(f"{a} {(x / y if a in ('sat', 'sharp') else x - y):+.2f}{'x' if a in ('sat', 'sharp') else ''}"
                                     for a, x, y in zip(names, rs, ws)))

# --- music dips: loudness >= 9 dB under its 6 s neighbourhood for >= 0.6 s
x = np.frombuffer(ff("-i", ref, "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-").stdout, np.int16).astype(np.float32)
hop = 400; rms = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, "same")[::hop]) + 1
db = 20 * np.log10(rms); t = np.arange(len(db)) * hop / 8000; out, s = [], None
for i in range(len(db)):
    low = db[i] < np.median(db[max(0, i - 60):i + 60]) - 9
    if low and s is None: s = i
    if not low and s is not None:
        if t[i] - t[s] >= 0.6: out.append((round(t[s], 1), round(t[i] - t[s], 1)))
        s = None
print("music dips  (start s, length s):", out)

for k in range(30):
    ff("-y", "-ss", f"{6 + k * (dur - 12) / 29:.2f}", "-i", ref, "-frames:v", "1", "-vf", "scale=384:216", f"{outd}/s{k:02d}.jpg")
ff("-y", "-i", f"{outd}/s%02d.jpg", "-vf", "tile=6x5", "-frames:v", "1", f"{outd}/sheet.jpg")
for k in range(30):
    if os.path.exists(f"{outd}/s{k:02d}.jpg"): os.remove(f"{outd}/s{k:02d}.jpg")
print(f"contact sheet {outd}/sheet.jpg")
