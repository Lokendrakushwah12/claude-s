# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""aura.json -> timeline.js: a beat-led hype edit. Shots, speed ramps, hits, type and sound all sit on one beat grid.

    uv run aura.py build            conform HDR clips, pull each shot's source frames, write timeline.js
    uv run aura.py conform A.mov    an HDR iPhone clip -> src/A.sdr60.mov, tone-mapped at its own frame rate (see conform60)
    uv run aura.py selftest         checks the speed-ramp integral against a numeric one

aura.json. Every time is in BEATS from beat 0 of a `bpm` grid, so the cut, the hit, the type and the sound can't drift apart.
  bpm, fps (output, 30), size [w, h], scale (frames are pulled at scale x the output so punch-ins stay sharp; 1.5), brand {...},
  look (a look.js preset name or {passes}), frame ({y, h, bow}: look.js lensBand, the picture in a bowed letterbox band)
  clips    {name: path}. HDR (HLG, PQ, Dolby Vision) is tone-mapped first, keeping every frame (conform60). A still image
           becomes an 8 s clip of itself: the ramps freeze it, but the camera, punches, hits and type all still move.
  shots    [{at, beats, clip, src | hit, ramp, zoom, focus, behind} | {at, beats, insert: <kind>, ...anything the insert reads}]
    src      the source second on the shot's first frame
    hit      [b, s]: source second s lands on beat b of the shot. That's where a "hit" ramp goes slow
    ramp     a speed (1 = real time, 0 = a freeze), a preset name (RAMPS), or [[beat, speed], ...] in the shot's own beats.
             Cosine-eased between keys. type.js retime() is the exact integral, so frame n needs no history and never jitters.
    zoom     base zoom (1 = cover) about focus [x, y] (0..1 of the frame); behind: true pulls a person matte (matte.py)
  hits     [[beat | [b0, b1, step], kind, {opts}], ...] kinds: drop punch shake flash impact blur split sweep stop (video.js HIT)
  type     [{at, beats, text, kind: "slam" | "mask", y, size, fonts: [...], hold, from, track}]  (from 1 = cut on, no scale-in)
  sound    {bed: {sections: [[beat, kind], ...], chords, kick, kick_pattern}, mutes: [[b0, b1], ...], lufs,
            sfx: [[beat, name, gain, {params}], ...], bass808: [[beat, midi, beats, glide_semitones], ...],
            vo: "line.wav" | [[beat, "clip.wav"], ...] (sfx.py ducks the music under it), music: "track.wav" (licensed)}
Writes timeline.js (window.AURA, all in seconds) and prints each shot's source span, so a ramp that runs off its clip shows.
"""
import json, math, shutil, subprocess, sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ingest import conform, probe  # ugc-edit's: ffprobe + Apple's HDR tone mapping (copied in by the setup line)

# Speed-ramp presets in beats, relative to the shot's hit beat h (or its start). Velocity edits go fast between hits and
# slow ON them: "hit" is the standard one.
RAMPS = {
    "hit": lambda h, n: [[h - 1, 2.2], [h - 0.25, 0.2], [h + 0.5, 0.2], [h + 1.25, 2.2]],
    "float": lambda h, n: [[0, 0.35]],
    "rush": lambda h, n: [[0, 1], [n, 3]],      # accelerates into the cut
    "brake": lambda h, n: [[0, 3], [n * 0.6, 0.25]],  # arrives fast, settles slow
    "freeze": lambda h, n: [[0, 0]],
}


def sh(*a, **k): return subprocess.run([str(x) for x in a], check=True, **k)


def integral(u, keys):  # source seconds elapsed at output second u: the same curve as type.js retime()
    return antider(u, keys) - antider(0, keys)  # keys may start before u = 0


def antider(u, keys):
    if u <= keys[0][0]: return u * keys[0][1]
    s = keys[0][0] * keys[0][1]
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if u <= b:
            L, d = b - a, u - a
            return s + va * d + (vb - va) / 2 * (d - L / math.pi * math.sin(math.pi * d / L))
        s += (b - a) * (va + vb) / 2
    a, v = keys[-1]
    return s + (u - a) * v


def rate(path):
    r = sh("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate", "-of", "default=nw=1:nk=1", path, capture_output=True, text=True).stdout.split()[0]
    n, d = r.split("/"); return float(n) / float(d)


def rgb(path, t, w, h):  # one frame at t as float RGB 0..1 (16-bit decode, so HLG keeps its steps)
    raw = sh("ffmpeg", "-loglevel", "error", "-ss", f"{t:.4f}", "-i", path, "-frames:v", 1, "-vf", f"scale={w}:{h},format=rgb48le", "-f", "rawvideo", "-", capture_output=True).stdout
    return np.frombuffer(raw, np.uint16).reshape(h, w, 3).astype(np.float32) / 65535


def conform60(path, dst, n=33):
    """HDR -> BT.709 SDR at the clip's own frame rate. avconvert's H.264 presets tone-map HDR the way Photos does, but at 30 fps;
    its ProRes preset keeps 60 fps but stays HLG. So we make both, fit a 33^3 LUT from ProRes pixels to tone-mapped pixels at the
    same instants (each 30 fps frame against its nearest 60 fps neighbours, keeping the better match), and run the ProRes through
    it with ffmpeg lut3d. Slow motion needs every source frame; frame blending can't invent the missing half."""
    if dst.exists(): return dst
    from scipy.ndimage import distance_transform_edt, gaussian_filter
    pr = probe(path); ref = conform(path, pr, dst.with_name(dst.stem + ".ref30.mov")); hlg = dst.with_name(dst.stem + ".hlg.mov")
    if not hlg.exists(): sh("avconvert", "--source", path, "--preset", "PresetAppleProRes422LPCM", "--output", hlg, "--replace")
    fr, fh = rate(ref), rate(hlg); w, h = (96, 170) if pr["h"] > pr["w"] else (170, 96)
    if fh <= fr + 1: shutil.copy(ref, dst); return dst  # the source isn't faster than 30 fps: the 30 fps conform has every frame
    dur = probe(ref)["dur"]; X, Y = [], []
    for t in np.linspace(0.2, dur - 0.2, 24):
        t = round(t * fr) / fr; Yt = rgb(ref, t, w, h)
        cands = [rgb(hlg, t + k / fh, w, h) for k in (-1, 0, 1)]
        best = max(cands, key=lambda C: np.corrcoef(C.mean(2).ravel(), Yt.mean(2).ravel())[0, 1])
        X.append(best.reshape(-1, 3)); Y.append(Yt.reshape(-1, 3))
    X, Y = np.concatenate(X), np.concatenate(Y); q = np.clip(np.rint(X * (n - 1)), 0, n - 1).astype(int)
    idx = q[:, 0] + n * q[:, 1] + n * n * q[:, 2]  # .cube order: red fastest
    cnt = np.bincount(idx, minlength=n ** 3).astype(float)
    lut = np.stack([np.bincount(idx, Y[:, k], n ** 3) for k in range(3)], 1) / np.maximum(cnt, 1)[:, None]
    lut, cnt = lut.reshape(n, n, n, 3), cnt.reshape(n, n, n)  # [b, g, r]
    near = distance_transform_edt(cnt == 0, return_distances=False, return_indices=True)  # empty cells take their nearest filled one
    lut = np.clip(gaussian_filter(lut[tuple(near)], (0.6, 0.6, 0.6, 0)), 0, 1)
    cube = dst.with_name(dst.stem + ".cube")
    cube.write_text(f"LUT_3D_SIZE {n}\n" + "\n".join(f"{r:.6f} {g:.6f} {b:.6f}" for r, g, b in lut.reshape(-1, 3)) + "\n")
    sh("ffmpeg", "-loglevel", "error", "-y", "-i", hlg, "-vf", f"format=rgb48le,lut3d=file={cube}:interp=tetrahedral,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p",
       "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-an", "-c:v", "libx264", "-crf", 12, "-preset", "medium", dst)
    t = round(dur / 2 * fr) / fr; err = np.abs(rgb(dst, t, w, h) - rgb(ref, t, w, h)).mean() * 255; hlg.unlink()  # the ProRes is ~140 MB/s
    print(f"{path}: HDR at {fh:g} fps -> {dst} through a fitted LUT (mean error against Apple's 30 fps tone map {err:.1f}/255)")
    return dst


def clip_of(path, out):
    path = str(Path(path).expanduser()); f = Path(path)
    if f.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".heic"):  # a still: an 8 s, 30 fps clip of it, so ramps, punches and hits still apply
        v = out / f"{f.stem}.still.mp4"
        if not v.exists(): sh("ffmpeg", "-loglevel", "error", "-y", "-loop", 1, "-i", path, "-t", 8, "-r", 30, "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p", "-c:v", "libx264", "-crf", 14, v)
        path = str(v); f = v
    pr = probe(path)
    if pr["hdr"]: f = conform60(path, out / f"{f.stem}.sdr60.mov"); pr = probe(f)
    return {"path": str(f), "w": pr["w"], "h": pr["h"], "dur": pr["dur"], "fps": rate(f)}


def extract(path, f0, n, fps, d, w, h):  # n frames from frame f0, at the clip's own rate; cached by a key file
    d = Path(d); d.mkdir(parents=True, exist_ok=True); key = d / ".key"; k = json.dumps([path, f0, n, w, h])
    if key.exists() and key.read_text() == k: return len(list(d.glob("[0-9]*.jpg")))
    for f in d.glob("*.jpg"): f.unlink()
    sh("ffmpeg", "-loglevel", "error", "-y", "-ss", f"{max(0, (f0 - 0.5) / fps):.5f}", "-i", path, "-frames:v", n, "-vf", f"scale={w}:{h}:flags=lanczos", "-q:v", 2, d / "%04d.jpg")
    key.write_text(k); return len(list(d.glob("[0-9]*.jpg")))


def ramp_keys(s, spb):  # the shot's ramp in its own output seconds
    r, n = s.get("ramp", 1), s["beats"]; h = s["hit"][0] if "hit" in s else 0
    keys = [[0, float(r)]] if isinstance(r, (int, float)) else RAMPS[r](h, n) if isinstance(r, str) else r
    return [[b * spb, v] for b, v in sorted(keys)]


def beats(x):  # a hit's beat or [b0, b1, step] -> list of beats
    if isinstance(x, list): b0, b1, st = x; return [b0 + k * st for k in range(int(round((b1 - b0) / st)) + 1)]
    return [x]


def build(spec_path="aura.json"):
    E = json.loads(Path(spec_path).read_text()); spb = 60 / E["bpm"]; T = lambda b: round(b * spb, 4)
    fps, (W, H), scale = E.get("fps", 30), E.get("size", [1080, 1920]), E.get("scale", 1.5)
    out = Path("src"); out.mkdir(exist_ok=True)
    clips = {k: clip_of(v, out) for k, v in E.get("clips", {}).items()}
    shots = []
    for i, s in enumerate(E["shots"]):
        o = {k: v for k, v in s.items() if k not in ("at", "beats", "ramp", "hit", "src")}
        o.update(i=i, out0=T(s["at"]), out1=T(s["at"] + s["beats"]))
        if "insert" in s: shots.append(o); continue
        c, keys, dur = clips[s["clip"]], ramp_keys(s, spb), o["out1"] - o["out0"]
        src0 = s["hit"][1] - integral(s["hit"][0] * spb, keys) if "hit" in s else s.get("src", 0)
        src1 = src0 + integral(dur, keys)
        if src0 < 0 or src1 > c["dur"]: print(f"  shot {i}: source {src0:.2f}-{src1:.2f} s runs off {s['clip']} (0-{c['dur']:.2f}); the edge frame holds")
        f0 = max(0, math.floor(src0 * c["fps"])); f1 = math.ceil(min(src1, c["dur"]) * c["fps"]) + 1
        sc = min(1, max(W / c["w"], H / c["h"]) * scale); fw, fh = 2 * round(c["w"] * sc / 2), 2 * round(c["h"] * sc / 2)
        d = f"frames/s{i:02d}/"; n = extract(c["path"], f0, f1 - f0 + 1, c["fps"], d, fw, fh)
        if s.get("behind") and subprocess.run(["uv", "run", "matte.py", d]).returncode != 0: print(f"  shot {i}: no matte, its type goes in front")
        o.update(kind="clip", frames=d, n=n, f0=f0, fps=c["fps"], src0=round(src0, 5), keys=keys, fw=fw, fh=fh, matte=bool(s.get("behind")) and (Path(d) / "m0001.jpg").exists())
        print(f"  shot {i:2d} {o['out0']:6.2f}-{o['out1']:6.2f} s  {s['clip']} {src0:5.2f}-{src1:5.2f} s  {n} frames  ramp {s.get('ramp', 1)}")
        shots.append(o)
    hits = [{"t": T(b), "kind": k, **(o[0] if o else {})} for x, k, *o in E.get("hits", []) for b in beats(x)]
    for h in hits:
        if "dur" in h: h["dur"] = round(h["dur"] * spb, 4)  # stop / sweep lengths are in beats too
    typ = [{**y, "t0": T(y["at"]), "t1": T(y["at"] + y["beats"])} for y in E.get("type", [])]
    S = E.get("sound", {}); bed = S.get("bed")
    if bed: bed = {**bed, "bpm": E["bpm"], "sections": [[T(b), *k] for b, *k in bed.get("sections", [])]}
    vo = S.get("vo"); vo = [[T(b), f] for b, f in vo] if isinstance(vo, list) else vo  # a spoken line: 'line.wav' at 0, or [[beat, file], ...]
    sound = {"bed": bed, "vo": vo, "music": S.get("music"), "mutes": [[T(a), T(b)] for a, b in S.get("mutes", [])], "lufs": S.get("lufs", -12),
             "sfx": [[T(b), *r] for b, *r in S.get("sfx", [])] + [[T(b), "bass808", 1, {"note": m, "dur": round(L * spb, 4), "glide": g}] for b, m, L, g in S.get("bass808", [])]}
    A = {"fps": fps, "bpm": E["bpm"], "spb": spb, "size": [W, H], "duration": T(E.get("beats", max(s["at"] + s["beats"] for s in E["shots"]))),
         "brand": E.get("brand", {}), "look": E.get("look"), "fonts": E.get("fonts"), "frame": E.get("frame"), "shots": shots, "hits": hits, "type": typ, "sound": sound}
    Path("timeline.js").write_text("window.AURA = " + json.dumps(A, indent=1) + ";\n")
    print(f"timeline.js: {len(shots)} shots, {len(hits)} hits, {A['duration']:.2f} s at {E['bpm']} BPM")


def selftest():
    keys = [[0, 3], [0.5, 0.25], [1, 0.25], [1.5, 3]]
    def v(u):
        for (a, va), (b, vb) in zip(keys, keys[1:]):
            if a <= u <= b: return va + (vb - va) * (1 - math.cos(math.pi * (u - a) / (b - a))) / 2
        return keys[0][1] if u < keys[0][0] else keys[-1][1]
    du = 1e-4; num = sum(v((k + 0.5) * du) * du for k in range(int(2 / du)))
    assert abs(integral(2, keys) - num) < 1e-6, (integral(2, keys), num)
    assert abs(integral(0.75, keys) - sum(v((k + 0.5) * du) * du for k in range(int(0.75 / du)))) < 1e-6
    keys = [[-0.4, 2.2], [-0.1, 0.2], [0.2, 0.2], [0.5, 2.2]]  # a hit ramp whose fast part began before the shot
    assert abs(integral(0, keys)) < 1e-12 and abs(integral(0.2, keys) - 0.04) < 1e-9, integral(0.2, keys)
    print("ok: retime integral matches", round(num, 6))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    if cmd == "build": build(*sys.argv[2:])
    elif cmd == "conform": print(clip_of(sys.argv[2], Path("src")))
    elif cmd == "selftest": selftest()
    else: sys.exit(__doc__)
