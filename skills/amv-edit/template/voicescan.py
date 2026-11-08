#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""Rank a plan's shots by how much character dialogue their own audio carries.

    uv run voicescan.py plan.json START-END [START-END ...]     e.g. 84-111 139-165

Only full-speed shots of 1.2 s or more inside the windows count (slowed shots can't keep
lips in sync). Score = syllabic modulation (speech-band energy pulsing 3-8 times a second,
which a music bed doesn't do) x the speech band's share of the energy. Pick the top shot
per calm window (a voice over a loud chorus gets buried) and put it in plan.py VOICE.
"""
import json, subprocess, sys
import numpy as np
from scipy.signal import butter, sosfilt

p = json.load(open(sys.argv[1])); sh = p["shots"]
sos = butter(4, [300, 3400], btype="band", fs=16000, output="sos")

def speech(clip, start, dur):
    a = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", clip,
                        "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    x = np.frombuffer(a, np.int16).astype(np.float32) / 32768
    if len(x) < 16000 * 0.8: return 0.0, 0.0, -99.0
    band = sosfilt(sos, x)
    env = np.sqrt(np.convolve(band ** 2, np.ones(160) / 160, "same")[::160]); env -= env.mean()
    F = np.abs(np.fft.rfft(env * np.hanning(len(env)))); fr = np.fft.rfftfreq(len(env), 0.01)
    syl = F[(fr >= 3) & (fr <= 8)].sum() / max(F[(fr >= 0.5) & (fr <= 20)].sum(), 1e-9)
    share = float((band ** 2).mean() / max((x ** 2).mean(), 1e-12))
    return float(syl), share, float(20 * np.log10(np.sqrt((band ** 2).mean()) + 1e-9))

for w in sys.argv[2:]:
    a, b = map(float, w.split("-"))
    rows = []
    for i, s in enumerate(sh):
        nxt = sh[i + 1]["at"] if i + 1 < len(sh) else p["end"]
        if not (a <= s["at"] < b) or s.get("speed", 1) < 0.99 or nxt - s["at"] < 1.2: continue
        d = 0 if s["t"] in ("cut", "qblur") else s.get("d", 0.6)
        syl, share, lvl = speech(s["clip"], s["in"] + d, nxt - s["at"])
        rows.append((syl * share, syl, share, lvl, s.get("src", "?"), s["at"]))
    print(f"{a:.0f}-{b:.0f}s  score  syllabic  speech-share  dB    shot  at")
    for r in sorted(rows, reverse=True)[:5]:
        print(f"         {r[0]:.3f}  {r[1]:.2f}      {r[2]:.2f}          {r[3]:6.1f} {r[4]}  {r[5]:.2f}")
