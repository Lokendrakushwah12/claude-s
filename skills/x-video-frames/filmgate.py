# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "opencv-python-headless"]
# ///
"""Delivery gate for a finished film: reads only the MP4, prints a light per check, exits 2 on any red.

    uv run ~/.claude/skills/x-video-frames/filmgate.py film.mp4 [--allow-blue-purple "reason"] [--json out.json]

Ported (trimmed, translated) from huashu-art-motion's scripts/film_gate.py, MIT (c) 2026 alchaincyf,
https://github.com/alchaincyf/huashu-art-motion. Their thresholds were calibrated on films the author had judged
(13 for motion, 88 for colour); ours aren't re-calibrated yet, so the motion gate is yellow-only until they are.

Checks (12 fps, 320 px wide greyscale, the bottom caption band masked: 15 %, or 18 % for vertical):
  blank     RED  a mid-film run of >= 0.3 s where < 0.2 % of pixels have a Sobel gradient > 24 (judged by edges, not
                 colour, so a black frame with fine lines passes). First/last 0.5 s, cut frames and dissolves excluded.
  bluepurp  RED  >= 30 % of frames (sampled at 2 fps) are >= 30 % blue-purple pixels: hue 225-300, sat >= 0.30,
                 value 0.06-0.90. Navy (~210) is outside the band. Yellow from 12 %. --allow-blue-purple downgrades.
  motion    YELLOW  fast_ratio: the share of non-transition frame pairs whose mean |grey diff| >= 9. Their red line
                 was < 0.035 (approved films >= 0.068, rejected <= 0.021); here it is reported, never blocking.
  pushins   YELLOW  >= 8 push-ins a minute: the "every shot zooms in" habit (zoom runs > 0.4 %/frame totalling >= 3 %).
Transitions are excluded from motion: a cut is a frame diff >= max(8, 3 x local median + 2) that camera motion
(LK flow + RANSAC similarity) can't explain; a dissolve is a 2-12 frame window that fits a linear mix of its ends.
"""
import argparse
import json
import subprocess
import sys

import cv2
import numpy as np

FPS, WIDTH = 12, 320
BLANK_GRAD, BLANK_FRAC, BLANK_EDGE_S, BLANK_MIN_S = 24.0, 0.002, 0.5, 0.3
BP_HUE, BP_SAT, BP_VAL, BP_FRAME, BP_RED, BP_YELLOW = (225, 300), 0.30, (0.06, 0.90), 0.30, 0.30, 0.12
FAST, FAST_YELLOW, FAST_THEIR_RED = 9.0, 0.06, 0.035
PUSH_RATE, PUSH_TOTAL, PUSH_YELLOW = 0.004, 0.03, 8.0


def probe(path):
    j = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                            "stream=width,height:format=duration", "-of", "json", path]))
    return int(j["streams"][0]["width"]), int(j["streams"][0]["height"]), float(j["format"].get("duration") or 0)


def decode(path, W, H, fps, width, fmt, ch):
    h = int(round(H * width / W / 2) * 2)
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-vf", f"fps={fps},scale={width}:{h}:flags=area",
                                   "-pix_fmt", fmt, "-f", "rawvideo", "-"])
    n = len(raw) // (width * h * ch)
    return np.frombuffer(raw[: n * width * h * ch], np.uint8).reshape((n, h, width) + ((ch,) if ch > 1 else ()))


def similarity(a, b):  # a -> b camera move (LK tracking + RANSAC), or None
    pts = cv2.goodFeaturesToTrack(a, maxCorners=300, qualityLevel=0.01, minDistance=6, blockSize=5)
    if pts is None or len(pts) < 15:
        return None
    nxt, st, _ = cv2.calcOpticalFlowPyrLK(a, b, pts, None, winSize=(21, 21), maxLevel=3)
    ok = st.ravel() == 1
    if ok.sum() < 12:
        return None
    M, inl = cv2.estimateAffinePartial2D(pts[ok].reshape(-1, 2), nxt[ok].reshape(-1, 2), method=cv2.RANSAC, ransacReprojThreshold=1.0)
    return M if M is not None and inl.sum() >= 20 and inl.sum() / len(pts) >= 0.35 else None


def measure(path, allow_bp=None):
    W, H, dur = probe(path)
    F = decode(path, W, H, FPS, WIDTH, "gray", 1)
    F = np.ascontiguousarray(F[:, : int(round(F.shape[1] * (1 - (0.18 if H > W else 0.15))))])  # mask the caption band
    n, h, w = F.shape
    if n < 4:
        raise SystemExit("too few frames to measure")
    G = F.astype(np.int16)
    d, loc, zoom = np.zeros(n - 1), np.zeros(n - 1), np.zeros(n - 1)
    for i in range(n - 1):
        d[i] = loc[i] = np.abs(G[i + 1] - G[i]).mean()
        if d[i] < 0.05:
            continue
        M = similarity(F[i], F[i + 1])
        if M is not None:
            s = float(np.hypot(M[0, 0], M[1, 0])); zoom[i] = np.log(s)
            if abs(np.log(s)) > 1e-4 or abs(M[0, 2]) > 0.05 or abs(M[1, 2]) > 0.05:
                warp = cv2.warpAffine(F[i], M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
                loc[i] = np.abs(G[i + 1] - warp.astype(np.int16)).mean()
    cut = np.zeros(n - 1, bool)
    for i in range(n - 1):
        nb = np.concatenate([d[max(0, i - 6):i], d[i + 1:i + 7]])
        cut[i] = d[i] >= max(8.0, 3 * (np.median(nb) if len(nb) else 0) + 2) and loc[i] >= 0.6 * d[i]
    diss = np.zeros(n - 1, bool)  # dissolves: the middle frames are a monotonic linear mix of the window's two ends
    for half in (2, 3, 5, 8, 12):
        for t in range(half, n - half):
            a, b = t - half, t + half
            if cut[a:b].any() or diss[a:b].any():
                continue
            seg = d[a:b]
            if seg.max() > 0.75 * seg.sum() or seg.sum() < 10:
                continue
            A, Bf = G[a].astype(np.float32), G[b].astype(np.float32); D = A - Bf
            if np.abs(D).mean() < 10 or (np.abs(D) > 20).mean() < 0.20:
                continue
            nd = float((D * D).sum()) + 1e-6; al, res = [], []
            for k in range(a + 1, b):
                X = G[k].astype(np.float32) - Bf; c = float((X * D).sum() / nd)
                al.append(c); res.append(np.abs(X - c * D).mean() / (np.abs(D).mean() + 1e-6))
            al, res = np.array(al), np.array(res); mid = (al > 0.15) & (al < 0.85)
            if mid.sum() >= 2 and res[mid].mean() < 0.22 and res.mean() < 0.25 and np.all(np.diff(al) <= 0.08) and al[0] > 0.55 and al[-1] < 0.45:
                diss[a:b] = True
    trans = cut | diss

    # blank: by edges, mid-film, transitions excluded
    blank = np.array([(np.hypot(cv2.Sobel(f, cv2.CV_32F, 1, 0), cv2.Sobel(f, cv2.CV_32F, 0, 1)) > BLANK_GRAD).mean() < BLANK_FRAC for f in F])
    ok = np.ones(n, bool); e = int(round(BLANK_EDGE_S * FPS)); ok[:e] = ok[n - e:] = False
    for i in np.where(trans)[0]:
        ok[i] = ok[i + 1] = False
    runs, s0 = [], None
    for i, v in enumerate(list(blank & ok) + [False]):
        if v and s0 is None: s0 = i
        elif not v and s0 is not None:
            if (i - s0) / FPS >= BLANK_MIN_S - 1e-9: runs.append((round(s0 / FPS, 2), round(i / FPS, 2)))
            s0 = None

    # blue-purple: share of frames mostly in the band
    C = decode(path, W, H, 2, 160, "rgb24", 3).astype(np.float32) / 255
    r, g, b = C[..., 0], C[..., 1], C[..., 2]; mx = C.max(-1); dd = mx - C.min(-1) + 1e-6
    hue = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) * 60
    m = (hue >= BP_HUE[0]) & (hue <= BP_HUE[1]) & (dd / (mx + 1e-6) >= BP_SAT) & (mx >= BP_VAL[0]) & (mx <= BP_VAL[1])
    bpf = m.reshape(len(C), -1).mean(1) >= BP_FRAME; bp = float(bpf.mean()) if len(C) else 0.0

    # motion and push-ins
    mv = d[~trans]; fast = float((mv >= FAST).mean()) if len(mv) else 0.0
    pushes, run = 0, 0.0
    for z, tr in zip(zoom, trans):
        if z > PUSH_RATE and not tr: run += z
        else:
            pushes += run >= PUSH_TOTAL; run = 0.0
    pushes += run >= PUSH_TOTAL
    per_min = pushes / max(dur, 1e-6) * 60

    L = {"blank": "red" if runs else "green",
         "bluepurp": ("yellow" if allow_bp else "red") if bp >= BP_RED else "yellow" if bp >= BP_YELLOW else "green",
         "motion": "yellow" if fast < FAST_YELLOW else "green",
         "pushins": "yellow" if per_min >= PUSH_YELLOW else "green"}
    return {"file": path, "duration_s": round(dur, 2), "cuts": int((cut & ~np.concatenate([[False], cut[:-1]])).sum()),
            "blank_runs_s": runs, "blue_purple_share": round(bp, 3), "allow_blue_purple": allow_bp,
            "fast_ratio": round(fast, 4), "push_ins_per_min": round(per_min, 1), "lights": L}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("film"); ap.add_argument("--allow-blue-purple", metavar="REASON"); ap.add_argument("--json")
    a = ap.parse_args()
    res = measure(a.film, a.allow_blue_purple); L = res["lights"]
    print(f"{res['file']}  {res['duration_s']} s, {res['cuts']} cuts")
    print(f"  [{L['blank']:6}] blank frames      {res['blank_runs_s'] or 'none'}  (red: any mid-film run >= 0.3 s)")
    print(f"  [{L['bluepurp']:6}] blue-purple       {res['blue_purple_share']:.0%} of frames  (red >= 30 %, yellow >= 12 %)"
          + (f"  allowed: {a.allow_blue_purple}" if a.allow_blue_purple else ""))
    print(f"  [{L['motion']:6}] fast motion       {res['fast_ratio']:.3f}  (yellow < 0.06; huashu's films: approved >= 0.068, rejected <= 0.021)")
    print(f"  [{L['pushins']:6}] push-ins          {res['push_ins_per_min']}/min  (yellow >= 8)")
    if a.json:
        open(a.json, "w").write(json.dumps(res, indent=1))
    red = "red" in L.values()
    print("RED: don't deliver. Fix and re-render." if red else "No red: OK to deliver (look at any yellow first).")
    sys.exit(2 if red else 0)


if __name__ == "__main__":
    main()
