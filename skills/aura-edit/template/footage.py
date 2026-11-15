# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
"""Review a folder of phone footage before cutting: what's there, what each clip looks like start to end, which windows are
steady, and how each cut pairs. The kashmir-dnd v2 method (2026-11-14), which the user's notes on v1 asked for ("choose
better suited clips, check where they end and how the next clip starts").

    uv run footage.py list <folder> [--out clips.json]       usable clips: index, path, duration, size, fps, date, GPS
    uv run footage.py strips clips.json [--out review/]      a 12-frame filmstrip of every clip, 12 clips to a sheet
    uv run footage.py window <clip> <start> <end> [--n 16]   a timestamped strip of one window (find the exact moment)
    uv run footage.py motion <clip> <start> <end> [...]      camera pan (px/s at 1920 wide) and shake (px/step) per window
    uv run footage.py cuts [timeline.js] [--out cuts.jpg]    each cut as a pair: last frame of shot i | first of shot i+1
    uv run footage.py selftest                               motion() against a known synthetic shift

list skips what a phone dump is full of: Live Photo .MOVs (a same-named .HEIC/.JPG sits next to them), edited copies
(IMG_E*), clips under 3.5 s, and the same file name seen twice (story/, posts/ copies). motion: phase correlation between
frames 1/15 s apart at 320 px; the mean shift is the pan (+ = content moves right, so the camera pans left), the spread is
shake. Over ~15 px/step reads as handheld wobble; 0.0 is a locked-off phone, the best title or hold shot. A pan direction
kept across consecutive shots reads as one move. In <clip>, a number is an index into clips.json (in the working directory).
"""
import json, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

VIDEO, STILL = (".mov", ".mp4", ".m4v"), (".heic", ".jpg", ".jpeg")


def probe(p):
    o = json.loads(subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(p)],
                                  capture_output=True, text=True).stdout or "{}")
    v = next((s for s in o.get("streams", []) if s.get("codec_type") == "video"), {}); tags = o.get("format", {}).get("tags", {})
    rot = next((d.get("rotation") for d in v.get("side_data_list", []) if "rotation" in d), 0) or 0
    w, h = v.get("width", 0), v.get("height", 0)
    if abs(int(rot)) in (90, 270): w, h = h, w
    num, den = (v.get("r_frame_rate") or "0/1").split("/")
    return {"dur": float(o.get("format", {}).get("duration") or 0), "w": w, "h": h, "fps": round(int(num) / max(1, int(den)), 2),
            "date": tags.get("creation_time", "")[:10], "gps": tags.get("com.apple.quicktime.location.ISO6709", ""),
            "hdr": v.get("color_transfer") in ("arib-std-b67", "smpte2084")}


def cmd_list(folder, out="clips.json"):
    folder = Path(folder).expanduser(); seen, rows, skipped = set(), [], {"live": 0, "edited": 0, "short": 0, "dupe": 0}
    for d in sorted(p for p in folder.rglob("*") if p.is_dir()) + [folder]:
        stills = {f.stem.upper() for f in d.iterdir() if f.suffix.lower() in STILL}
        for f in sorted(d.iterdir()):
            if f.suffix.lower() not in VIDEO: continue
            if f.name.upper().startswith("IMG_E"): skipped["edited"] += 1; continue
            if f.stem.upper() in stills: skipped["live"] += 1; continue
            if f.name.upper() in seen: skipped["dupe"] += 1; continue
            rows.append(str(f))
            seen.add(f.name.upper())
    with ThreadPoolExecutor(8) as ex: info = list(ex.map(probe, rows))
    clips = []
    for p, i in zip(rows, info):
        if i["dur"] < 3.5: skipped["short"] += 1; continue
        clips.append({"path": p, **i})
    json.dump(clips, open(out, "w"), indent=1)
    for k, c in enumerate(clips):
        print(f"{k:3d}  {c['dur']:6.1f}s  {c['w']}x{c['h']} {c['fps']:g}fps{' HDR' if c['hdr'] else ''}  {c['date']}  {c['gps'][:18]:18s}  {Path(c['path']).relative_to(folder)}")
    print(f"{len(clips)} clips, {sum(c['dur'] for c in clips) / 60:.0f} min -> {out}; skipped {skipped}")


def tile(paths, labels, out, cols, w=240, h=135):
    rows = (len(paths) + cols - 1) // cols; S = Image.new("RGB", (w * cols + 80, h * rows), "black"); D = ImageDraw.Draw(S)
    for i, (p, lab) in enumerate(zip(paths, labels)):
        try: S.paste(Image.open(p), (80 + (i % cols) * w, (i // cols) * h))
        except Exception: pass
        if lab and cols == 1: D.text((4, (i // cols) * h + 40), lab, fill="yellow")  # one clip a row: label in the margin
        elif lab: x, y = 80 + (i % cols) * w, (i // cols) * h; D.rectangle([x, y, x + 70, y + 28], fill="black"); D.text((x + 3, y + 2), lab, fill="yellow")
    S.save(out, quality=82)


def strip(path, a, b, n, out):  # n frames evenly over [a, b], 240x135 each (portrait padded), one row
    vf = f"fps={n / max(0.1, b - a):.5f},scale=236:132:force_original_aspect_ratio=decrease,setsar=1,pad=240:135:(ow-iw)/2:(oh-ih)/2,tile={n}x1,format=yuvj420p"  # 10-bit HDR frames won't go into a JPEG as they are
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-t", f"{b - a:.3f}", "-i", str(path), "-vf", vf, "-frames:v", "1", str(out)])


def cmd_strips(clips_json, out="review"):
    clips = json.load(open(clips_json)); d = Path(out); (d / "rows").mkdir(parents=True, exist_ok=True)
    def go(k):  # keyframes only: 101 clips (2 h of 4K) in about a minute
        c = clips[k]; vf = f"fps={12 / c['dur']:.5f},scale=236:132:force_original_aspect_ratio=decrease,setsar=1,pad=240:135:(ow-iw)/2:(oh-ih)/2,tile=12x1"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-skip_frame", "nokey", "-i", c["path"], "-vf", vf, "-frames:v", "1", str(d / "rows" / f"{k:03d}.jpg")])
    with ThreadPoolExecutor(8) as ex: list(ex.map(go, range(len(clips))))
    for g in range(0, len(clips), 12):
        ks = range(g, min(g + 12, len(clips)))
        tile([d / "rows" / f"{k:03d}.jpg" for k in ks], [f"{k}\n{clips[k]['dur']:.0f}s" for k in ks], d / f"strips_{g // 12:02d}.jpg", 1, w=2880)
    print(f"{(len(clips) + 11) // 12} sheets in {d}/strips_*.jpg (each row: one clip, 12 frames start to end)")


def clip_path(x):
    if str(x).isdigit(): return json.load(open("clips.json"))[int(x)]["path"]
    return x


def cmd_window(x, a, b, n=16, out=None):
    p = clip_path(x); a, b, n = float(a), float(b), int(n); out = out or f"window_{Path(p).stem}_{a:g}-{b:g}.jpg"
    tmp = Path(out).with_suffix(".row.jpg"); strip(p, a, b, n, tmp); im = Image.open(tmp); D = ImageDraw.Draw(im)
    for i in range(n): t = a + i * (b - a) / n; D.rectangle([i * 240, 0, i * 240 + 58, 14], fill="black"); D.text((i * 240 + 3, 1), f"{int(t // 60)}:{t % 60:04.1f}", fill="yellow")
    im.save(out, quality=85); tmp.unlink(); print(out)


def shifts(frames):  # phase correlation between consecutive frames -> [(dx, dy)] in pixels of these frames
    h, w = frames[0].shape; win = np.outer(np.hanning(h), np.hanning(w)); out = []
    for p, q in zip(frames[:-1], frames[1:]):
        F = np.fft.fft2(p * win) * np.conj(np.fft.fft2(q * win)); r = np.fft.ifft2(F / (abs(F) + 1e-9)).real
        y, x = np.unravel_index(r.argmax(), r.shape); out.append((-(x - w if x > w / 2 else x), -(y - h if y > h / 2 else y)))
    return np.array(out, float)


def motion(path, a, b, fps=15, w=320, h=180):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-t", str(b - a), "-i", str(path), "-vf", f"fps={fps},scale={w}:{h},format=gray",
                          "-f", "rawvideo", "-"], capture_output=True).stdout
    v = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(float)
    if len(v) < 3: return None
    s = shifts(v) * 1920 / w; m = s.mean(0) * fps
    return {"pan_x": round(m[0]), "pan_y": round(m[1]), "shake": round(float(s.std(0).mean()), 1)}


def cmd_motion(*args):
    for x, a, b in zip(args[0::3], args[1::3], args[2::3]):
        r = motion(clip_path(x), float(a), float(b))
        verdict = "locked off" if r and r["shake"] == 0 else "steady" if r and r["shake"] < 8 else "ok" if r and r["shake"] < 15 else "shaky"
        print(f"{x:>4} {float(a):7.1f}-{float(b):6.1f}s  " + (f"pan x {r['pan_x']:+5d} y {r['pan_y']:+5d} px/s  shake {r['shake']:5.1f} px/step  {verdict}" if r else "too short"))


def cmd_cuts(timeline="timeline.js", out="cuts.jpg"):
    A = json.loads(Path(timeline).read_text().split("=", 1)[1].strip().rstrip(";")); shots = [s for s in A["shots"] if s.get("frames")]
    def frame(s, last):  # the source frame shown on the shot's first / last output frame (real time; ramps not followed)
        fs = sorted(Path(s["frames"]).glob("[0-9]*.jpg")); i = round((s["src0"] + ((s["out1"] - s["out0"]) if last else 0)) * s["fps"]) - s["f0"] - (1 if last else 0)
        return fs[max(0, min(i, len(fs) - 1))]
    tmp = Path(out).with_suffix(".tmp"); tmp.mkdir(exist_ok=True); paths, labels = [], []
    for k, (s, t) in enumerate(zip(shots, shots[1:])):
        for j, f in enumerate((frame(s, True), frame(t, False))):
            q = tmp / f"{k:02d}{j}.jpg"; Image.open(f).convert("RGB").resize((240, 135)).save(q); paths.append(q); labels.append(f"cut {k + 1}\n{t['out0']:.2f}s" if j == 0 else "")
    tile(paths, labels, out, 6); [p.unlink() for p in paths]; tmp.rmdir(); print(f"{out}: {len(shots) - 1} cuts, three pairs a row (left of each pair: the shot ending)")


def selftest():
    r = np.random.default_rng(1); base = np.kron(r.random((60, 107)), np.ones((6, 6)))[:180, :320]
    frames = [np.roll(base, (k * -2, k * 5), (0, 1)) for k in range(6)]  # content moves 5 px right, 2 px up per step
    s = shifts(frames); assert np.allclose(s.mean(0), [5, -2]) and s.std(0).max() == 0, s
    print("selftest ok: phase correlation recovers a 5 px right, 2 px up shift exactly")


if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    cmd, a = sys.argv[1], sys.argv[2:]; kw = {}
    while "--out" in a or "--n" in a:
        for flag in ("--out", "--n"):
            if flag in a: i = a.index(flag); kw[flag[2:]] = a[i + 1]; del a[i:i + 2]
    {"list": cmd_list, "strips": cmd_strips, "window": cmd_window, "motion": cmd_motion, "cuts": cmd_cuts, "selftest": lambda: selftest()}[cmd](*a, **kw)
