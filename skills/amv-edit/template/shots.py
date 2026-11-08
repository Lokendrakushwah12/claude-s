#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""Clip folders -> shot library + contact sheets.

    uv run shots.py library.json sheets/ <folder or file> [...]

Every clip is split at its scene cuts (flicker cuts under 0.4 s fold into the previous
shot, shots under 0.5 s are dropped). library.json maps a ref to [file, start, end]:
  "E4-28"    the longest shot of a clip named like "... S01E04 (28).mp4"
  "E4-28.1"  that clip's shot 1; clips without an SxxEyy (n) name use their file stem
sheets/sheetN.jpg shows one labelled frame per clip (its longest shot), 64 per sheet:
read every sheet before planning; the label is the ref plus shot count and seconds.
"""
import json, os, re, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw

out, sheets, srcs = sys.argv[1], sys.argv[2], sys.argv[3:]
VIDEO = (".mp4", ".mov", ".mkv", ".webm", ".m4v")
files = []
for s in srcs:
    if os.path.isdir(s):
        files += [os.path.join(r, f) for r, _, fs in os.walk(s) for f in fs if f.lower().endswith(VIDEO)]
    else:
        files.append(s)

def ref_of(f):
    m = re.search(r"S\d+E(\d+).*?\((\d+)\)", os.path.basename(f))
    return f"E{int(m[1])}-{int(m[2])}" if m else re.sub(r"\W+", "_", os.path.splitext(os.path.basename(f))[0])

def key(f):
    m = re.search(r"S\d+E(\d+).*?\((\d+)\)", os.path.basename(f))
    return (int(m[1]), int(m[2]), "") if m else (10**6, 0, f)

files.sort(key=key)

def dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                capture_output=True, text=True).stdout or 0)

def detect(f):
    e = subprocess.run(["ffmpeg", "-hide_banner", "-i", f, "-an", "-vf",
                        "scale=320:-1,select='gt(scene,0.3)',showinfo", "-f", "null", "-"],
                       capture_output=True, text=True).stderr
    b = [0.0] + [float(x) for x in re.findall(r"pts_time:([0-9.]+)", e)] + [dur(f)]
    shots = []
    for a, c in zip(b, b[1:]):
        if shots and c - a < 0.4:
            shots[-1][1] = c
            continue
        shots.append([a, c])
    return [[round(a, 3), round(c, 3)] for a, c in shots if c - a >= 0.5]

with ThreadPoolExecutor(8) as ex:
    found = list(ex.map(detect, files))

lib, clips = {}, []
for f, sh in zip(files, found):
    if not sh: continue
    r = ref_of(f)
    while r in lib: r += "_"  # same name in two folders
    for k, (a, b) in enumerate(sh):
        lib[f"{r}.{k}"] = [f, a, b]
    lib[r] = [f, *max(sh, key=lambda s: s[1] - s[0])]
    clips.append((r, f, sh))
json.dump(lib, open(out, "w"), indent=0)

os.makedirs(sheets, exist_ok=True)
def grab(i):
    r, f, sh = clips[i]
    _, a, b = lib[r]
    p = f"{sheets}/c{i:04d}.jpg"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{(a + b) / 2:.3f}", "-i", f,
                    "-frames:v", "1", "-vf", "scale=288:162", p])
    return p
with ThreadPoolExecutor(8) as ex:
    thumbs = list(ex.map(grab, range(len(clips))))
per = 64
for p0 in range(0, len(clips), per):
    sheet = Image.new("RGB", (288 * 8, 162 * 8))
    for k, i in enumerate(range(p0, min(p0 + per, len(clips)))):
        if not os.path.exists(thumbs[i]): continue
        im = Image.open(thumbs[i]); d = ImageDraw.Draw(im); r, _, sh = clips[i]
        d.rectangle([0, 0, 190, 20], fill="black")
        d.text((3, 3), f"{r} {len(sh)}sh {sum(b - a for a, b in sh):.0f}s", fill="yellow", font_size=14)
        sheet.paste(im, ((k % 8) * 288, (k // 8) * 162))
        os.remove(thumbs[i])
    sheet.save(f"{sheets}/sheet{p0 // per}.jpg", quality=78)
print(f"{len(clips)} clips, {sum(len(s) for _, _, s in clips)} shots, "
      f"{sum(b - a for _, _, s in clips for a, b in s):.0f} s -> {out}, {(len(clips) + per - 1) // per} sheets in {sheets}/")
