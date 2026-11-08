#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow"]
# ///
"""Render an AMV from an edit plan: clips cut to song timestamps, joined with
smooth blur-dissolves, zoom punches, quick-blur cuts or white flashes, plus
vertical shakes, bloom flashes, a light grade and animated text cards.

usage: uv run amv.py plan.json out.mp4

plan.json:
{
  "song": "song.mp3", "fps": 24, "w": 1920, "h": 1080, "end": 95.0,
  "shots": [
    {"at": 0.0, "clip": "a.mp4", "in": 1.2, "t": "blur", "d": 0.6, "speed": 1.0, "zoom": 1.04, "shake": false},
    ...
  ],
  "flashes": [56.0, 62.7],          # song times of instant bloom flashes
  "cards": [{"at": 0.5, "dur": 3.4, "bg": "black|dim|none",
             "lines": [{"text": "TITLE", "font": "serif|sans", "size": 120, "track": 0.5,
                        "y": 0, "delay": 0.0, "move": "down|up", "edge": false}]}]
}
"at"    song time this shot is fully on screen (the transition into it ends here)
"t"     transition INTO this shot: blur | zoom | qblur | cut | flash   (first shot fades from black)
"speed" < 1 is motion-interpolated (Twixtor-style), never plain slow-down
"""
import hashlib, json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor, as_completed

plan = json.load(open(sys.argv[1]))
out = sys.argv[2]
FPS, W, H = plan.get("fps", 24), plan.get("w", 1920), plan.get("h", 1080)
shots, end = plan["shots"], plan["end"]
BLUR = 22     # gblur sigma at the peak of a blur transition
PAD = 0.25    # extra seconds rendered past each shot's end
PUNCH = 0.16  # zoom transition: extra scale at the punch
DZ = 0.35     # zoom transition: punch length in seconds
QB = 0.17     # quick-blur cut: blur-in length (4 frames)
SHAKE = 18    # px, vertical only, damped over ~0.5s
def _first(*cands):  # first font file that exists: (path, ttc index, variable-font named style)
    for c in cands:
        if os.path.exists(c[0]): return c
    sys.exit(f"no font found among {[c[0] for c in cands]}")
_FEATURE = [os.path.join(d, f) for d in (os.path.expanduser("~/Library/Fonts"), "/Library/Fonts") if os.path.isdir(d)
            for f in os.listdir(d) if "FeatureHeadline" in f and f.endswith((".ttf", ".otf"))]
FONTS = {"serif": _first(*[(f, None, b"Display Regular") for f in _FEATURE],
                         ("/System/Library/Fonts/Supplemental/Baskerville.ttc", 0, None)),
         "sans": ("/System/Library/Fonts/Supplemental/GillSans.ttc", 7, None),   # Gill Sans Light
         "script": ("/System/Library/Fonts/Supplemental/Savoye LET.ttc", 0, None)}  # thin handwritten, for sung lines
WATERMARK = plan.get("watermark", "")  # small, faint, top-right for the whole video
tmp = os.path.join(os.path.dirname(os.path.abspath(out)), ".amv_cache")
os.makedirs(tmp, exist_ok=True)

def log(msg):
    print(msg, flush=True)

def d_of(s):
    t = s.get("t", "blur")
    return 1 / FPS if t in ("cut", "qblur") else s.get("d", {"flash": 0.25, "zoom": 0.3}.get(t, 0.6))

# Shot i plays from at_i - d_i (its transition in) to at_{i+1} (next transition done).
for i, s in enumerate(shots):
    nxt = shots[i + 1] if i + 1 < len(shots) else None
    s["_d"] = 0 if i == 0 else d_of(s)
    s["_len"] = (nxt["at"] if nxt else end) - s["at"] + s["_d"]
    s["_dout"] = d_of(nxt) if nxt else 0
    s["_next"] = nxt.get("t", "blur") if nxt else None

# Pass 1: each shot to an intra-only intermediate, cached by its exact inputs.
def render_shot(i):
    s = shots[i]
    sp, L, z, t_in = s.get("speed", 1.0), s["_len"], s.get("zoom", 1.0), s.get("t", "blur")
    if sp < 0.99:  # Twixtor-style slow-mo: drop anime's held frames, then motion-interpolate
        v = (f"mpdecimate=hi=768:lo=320:frac=0.33:max=3,setpts=(PTS-STARTPTS)/{sp},"
             f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,")
    else:
        v = f"setpts=(PTS-STARTPTS)/{sp},fps={FPS},"
    v += f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},setsar=1"
    # Hold the last frame (near-still shots can come out short after mpdecimate), then
    # renumber frames: minterpolate's timestamps made time-based trims drop the padding.
    n = round((L + PAD) * FPS)
    v += f",tpad=stop_mode=clone:stop_duration=2,setpts=N/{FPS}/TB,trim=end_frame={n}"
    # zoom curve: slow push + punch-out after a zoom transition + punch-in before one
    zx = [f"1+({z}-1)*t/{L:.3f}"]
    if t_in == "zoom" and i > 0: zx.append(f"{PUNCH}*pow(max(0,1-t/{DZ}),2)")
    if s["_next"] == "zoom": zx.append(f"{PUNCH}*pow(max(0,(t-{L - DZ:.3f})/{DZ}),2)")
    shake = s.get("shake") and i > 0
    if shake: zx.append("0.035")  # headroom so the shaken crop never shows an edge
    if len(zx) > 1 or z != 1.0:
        sy = f"{SHAKE}*exp(-5*t)*sin(2*PI*4.5*t)" if shake else "0"  # vertical, smooth, damped
        v += (f",scale=w='2*trunc({W}*({'+'.join(zx)})/2)':h=-2:eval=frame,"
              f"crop={W}:{H}:x='(iw-{W})/2':y='clip((ih-{H})/2+{sy},0,ih-{H})'")
    # blur ramps on the edges that are blur/zoom transitions, and a 4-frame blur-in on quick-blur cuts
    soft = ("blur", "zoom")
    hi = QB if t_in == "qblur" and i > 0 else (s["_d"] if t_in in soft and i > 0 else 0)
    ho = s["_dout"] if s["_next"] in soft else 0
    if hi or ho:
        w = [f"max(0,1-T/{hi:.3f})"] * bool(hi) + [f"min(1,max(0,(T-{L - ho:.3f})/{ho:.3f}))"] * bool(ho)
        wv = w[0] if len(w) == 1 else f"max({w[0]},{w[1]})"
        v += (f",split[a][b];[b]gblur=sigma={BLUR}[c];"
              f"[a][c]blend=all_expr='A*(1-{wv})+B*{wv}'")
    args = ["-ss", str(s["in"]), "-t", f"{L * sp + 0.5:.3f}", "-i", s["clip"], "-an",
            "-vf", v + ",format=yuvj420p", "-c:v", "mjpeg", "-q:v", "2"]
    p = f"{tmp}/{hashlib.sha1(repr(args).encode()).hexdigest()[:16]}.mov"
    if not os.path.exists(p):
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args, p + ".part.mov"], check=True)
        os.rename(p + ".part.mov", p)
    return p

# Text cards: Pillow renders each card as a transparent PNG sequence (cached by spec)
def render_card(card):
    from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
    key = hashlib.sha1(json.dumps([2, card], sort_keys=True).encode()).hexdigest()[:12]  # bump on renderer changes
    d = f"{tmp}/card_{key}"
    if os.path.exists(f"{d}/done"):
        return d
    os.makedirs(d, exist_ok=True)
    ease = lambda x: 0.0 if x <= 0 else 1.0 if x >= 1 else x * x * (3 - 2 * x)
    sprites = []
    for ln in card["lines"]:  # each line once: tracked text + bloom, tight-cropped
        path, idx, var = FONTS[ln.get("font", "serif")]
        font = ImageFont.truetype(path, ln["size"], index=idx or 0)
        if var: font.set_variation_by_name(var)
        gap = ln.get("track", 0) * ln["size"]
        widths = [font.getlength(ch) for ch in ln["text"]]
        tw = int(sum(widths) + gap * (len(widths) - 1))
        pad = 60
        im = Image.new("L", (tw + 2 * pad, int(ln["size"] * 1.5) + 2 * pad), 0)
        dr, x = ImageDraw.Draw(im), pad
        for ch, cw in zip(ln["text"], widths):
            dr.text((x, pad), ch, font=font, fill=255)
            x += cw + gap
        if ln.get("edge"):  # fade toward the ends, like the reference title
            ramp = Image.linear_gradient("L").rotate(90, expand=True).resize((im.width // 2, im.height))
            mask = Image.new("L", im.size, 0)
            mask.paste(ramp.point(lambda v: 110 + v * 145 // 255), (0, 0))
            mask.paste(ramp.transpose(Image.FLIP_LEFT_RIGHT).point(lambda v: 110 + v * 145 // 255), (im.width // 2, 0))
            im = ImageChops.multiply(im, mask)
        glow = im.filter(ImageFilter.GaussianBlur(16)).point(lambda v: min(255, v * 2))
        alpha = ImageChops.lighter(im, glow.point(lambda v: v * 150 // 255))
        rgb = ln.get("color", [255, 250, 242])
        sprite = Image.merge("RGBA", (*(Image.new("L", im.size, c) for c in rgb), alpha))
        # soft dark halo underneath keeps thin letters readable over bright footage
        halo = im.filter(ImageFilter.GaussianBlur(26)).point(lambda v: min(255, v * 3) * 130 // 255)
        z = Image.new("L", im.size, 0)
        sprite = Image.alpha_composite(Image.merge("RGBA", (z, z, z, halo)), sprite)
        sprites.append((ln, sprite))
    dur, n = card["dur"], round(card["dur"] * FPS)
    for k in range(n):
        t = k / FPS
        fr = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bg_in, bg_out = ease(t / 0.35), ease((dur - t) / 0.6)
        bga = {"black": 255 * bg_out, "dim": 150 * min(bg_in, bg_out), "none": 0}[card.get("bg", "none")]
        if bga: fr.paste((0, 0, 0, int(bga)), (0, 0, W, H))
        for ln, sp in sprites:
            if card.get("static"): a_in, a_out = 1, 1
            elif card.get("sub"): a_in, a_out = ease(t / 0.2), ease((dur - t) / 0.25)  # subtitles: quick, no drift
            else: a_in, a_out = ease((t - ln.get("delay", 0)) / 0.7), ease((dur - t) / 0.55)
            a = a_in * a_out
            if a <= 0: continue
            mv = 0 if card.get("sub") else {"down": -26, "up": 26}.get(ln.get("move"), 0) * (1 - a_in) - 14 * (1 - a_out)
            scale = 1 + (0.06 if ln.get("move") == "up" else 0) * (1 - a_in)
            # copy: putalpha below would otherwise fade the cached sprite itself, frame after frame
            img = sp.copy() if scale == 1 else sp.resize((int(sp.width * scale), int(sp.height * scale)))
            r = 0 if card.get("sub") else 14 * (1 - a_in) + 10 * (1 - a_out)
            if r > 0.3: img = img.filter(ImageFilter.GaussianBlur(r))
            img.putalpha(img.getchannel("A").point(lambda v: int(v * a)))
            x = W - 40 - img.width if ln.get("align") == "right" else (W - img.width) / 2
            fr.alpha_composite(img, (int(x), int(H / 2 + ln.get("y", 0) - img.height / 2 + mv)))
        fr.save(f"{d}/{k:04d}.png")
    open(f"{d}/done", "w").close()
    return d

N = len(shots)
parts = [None] * N
with ThreadPoolExecutor(8) as ex:  # minterpolate is single-threaded; more workers swapped on 24GB
    futs = {ex.submit(render_shot, i): i for i in range(N)}
    for done, fu in enumerate(as_completed(futs), 1):
        parts[futs[fu]] = fu.result()
        log(f"[render] {80 * done // N:3d}%  shots {done}/{N}")
# Voice lines run to the end of their phrase (an L-cut over the next shot, up to 2.5 s): ending at
# the shot's cut chopped E7-69 mid-word. A shot's "sub" text shows as a small subtitle for that span.
def phrase_len(clip, src0, L, extra=2.5):
    import numpy as np
    cd = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", clip],
                              capture_output=True, text=True).stdout)
    a = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{src0:.3f}", "-t", f"{L + extra:.3f}", "-i", clip, "-vn",
                        "-af", "highpass=f=300,lowpass=f=3400", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"],
                       capture_output=True).stdout
    x = np.frombuffer(a, np.int16).astype(np.float32) / 32768
    env = 20 * np.log10(np.sqrt(np.convolve(x ** 2, np.ones(160) / 160, "same")[::160]) + 1e-9)  # 20 ms frames
    quiet = env < max(np.percentile(env, 90) - 18, -50)
    for k in range(max(0, int((L - 0.3) / 0.02)), len(quiet) - 13):
        if quiet[k:k + 13].all():  # a 0.26 s pause
            return min(k * 0.02 + 0.08, cd - src0), 0.3
    return min(L + extra, cd - src0), 0.8  # no pause found (the clip's own music): fade out gently
VOICES = []  # (shot index, song start, seconds, fade-out)
for i, s in enumerate(shots):
    if not s.get("voice") or s.get("speed", 1.0) < 0.99: continue
    vl, fo = phrase_len(s["clip"], s["in"] + s["_d"], (shots[i + 1]["at"] if i + 1 < N else end) - s["at"])
    VOICES.append((i, s["at"], vl, fo))
    log(f"[render]      voice {s.get('src', i)} at {s['at']:.2f}s runs {vl:.2f}s, {fo}s fade{' (no pause found)' if fo > 0.3 else ''}")
    if s.get("sub"):
        plan.setdefault("cards", []).append({"at": s["at"], "dur": round(vl, 3), "bg": "none", "sub": True, "lines": [
            {"text": s["sub"], "font": "sans", "size": 44, "y": 440, "color": [255, 214, 228]}]})
cards = [render_card(c) for c in plan.get("cards", [])]
log("[render]  80%  cards ready, joining")

# Pass 2: join with xfade; offset = where the next shot's transition starts in output time
inputs, f = [], []
for p in parts: inputs += ["-i", p]
prev, t0 = "0:v", shots[0]["at"]
for i in range(1, N):
    s = shots[i]
    kind = {"blur": "fade", "zoom": "fade", "qblur": "fade", "cut": "fade", "flash": "fadewhite"}[s.get("t", "blur")]
    f.append(f"[{prev}][{i}:v]xfade=transition={kind}:duration={s['_d']:.3f}:offset={s['at'] - s['_d'] - t0:.3f}[x{i}]")
    prev = f"x{i}"
total = end - t0
# grade: a touch more contrast and warmth, soft glow and vignette. Flashes: instant bloom
# (brightness up, contrast down) with a quick exponential fade, on the same per-frame eq.
# max(0,..) keeps the exponent <= 0: before a late flash, exp(-11*(t-ti)) overflows to inf
# and gte()*inf = NaN, which wrecked every frame before ~1:40
P = "+".join(f"gte(t,{ft - t0:.3f})*exp(-11*max(0,t-{ft - t0:.3f}))" for ft in plan.get("flashes", [])) or "0"
# Grade matched to reference 2 (measured vs the raw episodes): deeper blacks, highlights rolled
# off below clipping, ~14% darker mids, ~20% more saturation, luma-only sharpening, then a bloom
# built from the highlights only (a full-frame screen glow lifted the blacks), soft edge blur.
# Curves and colour balance run in RGB (gbrp); the bloom switches to yuv444p (see below).
f.append(f"[{prev}]trim=duration={total:.3f},format=gbrp,"
         f"curves=all='0/0 0.12/0.04 0.5/0.46 0.8/0.75 1/0.9',"
         f"eq=contrast='1.06-0.22*({P})':saturation=0.85:brightness='0.2*({P})':eval=frame,"
         f"colorbalance=rs=0.015:bs=-0.015:rh=0.01:bh=-0.01,unsharp=5:5:1.1:5:5:0,"
         # bloom on brightness only (yuv444p): blend in gbrp mixed up planes and turned everything
         # magenta; "normal" at opacity 1 keeps the base picture's colour
         f"format=yuv444p,split[g0][g1];[g1]curves=all='0/0 0.6/0 1/1',gblur=sigma=28[g2];"
         f"[g0][g2]blend=c0_mode=screen:c0_opacity=0.35:c1_mode=normal:c1_opacity=1:c2_mode=normal:c2_opacity=1,"
         f"split[e0][e1];[e1]gblur=sigma=10[e2]")
def edge_mask():  # 0 in the middle, easing to 255 at the frame edges
    from PIL import Image
    import numpy as np
    p = f"{tmp}/edge_mask_{W}x{H}.png"
    if not os.path.exists(p):
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) / np.sqrt(2)
        Image.fromarray((np.clip((r - 0.55) / 0.45, 0, 1) ** 1.6 * 255).astype(np.uint8)).save(p)
    return p
j = inputs.count("-i")
inputs += ["-loop", "1", "-framerate", str(FPS), "-i", edge_mask()]
f.append(f"[{j}:v]format=gray,trim=duration={total:.3f}[em];[e2][em]alphamerge[e3];"
         f"[e0][e3]overlay=shortest=1,vignette=angle=PI/7[g]")
prev = "g"
if WATERMARK:
    wm = render_card({"at": 0, "dur": 1 / FPS, "bg": "none", "static": True, "lines": [
        {"text": WATERMARK, "font": "serif", "size": 30, "track": 0.35, "y": -H / 2 + 62, "align": "right"}]})
    j = inputs.count("-i")
    inputs += ["-loop", "1", "-framerate", str(FPS), "-i", f"{wm}/0000.png"]
    f.append(f"[{j}:v]format=rgba,colorchannelmixer=aa=0.5,trim=duration={total:.3f}[wm];"
             f"[{prev}][wm]overlay=shortest=1:enable='between(t,4.3,{total - 1.5:.3f})'[w]")
    prev = "w"
for k, (c, d) in enumerate(zip(plan.get("cards", []), cards)):
    j = inputs.count("-i")
    inputs += ["-framerate", str(FPS), "-i", f"{d}/%04d.png"]
    f.append(f"[{j}:v]format=rgba,setpts=PTS+{c['at'] - t0:.3f}/TB[c{k}];[{prev}][c{k}]overlay=eof_action=pass[o{k}]")
    prev = f"o{k}"
f.append(f"[{prev}]fade=t=out:st={total - 1.5:.3f}:d=1.5,format=yuv420p[vout]")
ai = inputs.count("-i")
inputs += ["-ss", str(plan.get("song_start", 0) + t0), "-t", f"{total:.3f}", "-i", plan["song"]]
# Character voice lines (planned above): the shot's own dialogue, music ducked under it with 0.25s ramps.
voices, duck = [], []
for i, at, vl, fo in VOICES:
    s = shots[i]
    a, b = at - t0, at - t0 + vl
    j = inputs.count("-i")
    inputs += ["-ss", f"{s['in'] + s['_d']:.3f}", "-t", f"{vl:.3f}", "-i", s["clip"]]
    f.append(f"[{j}:a]aresample=44100,aformat=channel_layouts=stereo,volume={s['voice']},"
             f"afade=t=in:d=0.15,afade=t=out:st={max(0, vl - fo):.3f}:d={fo},"
             f"adelay={int(a * 1000)}|{int(a * 1000)}[v{j}]")
    voices.append(f"[v{j}]")
    duck.append(f"clip((t-{a - 0.25:.3f})/0.25,0,1)*clip(({b + 0.25:.3f}-t)/0.25,0,1)")
music_vol = f"1-0.65*min(1,{'+'.join(duck)})" if duck else "1"
f.append(f"[{ai}:a]volume='{music_vol}':eval=frame,afade=t=in:d=0.5[mus]")
f.append(f"[mus]{''.join(voices)}amix=inputs={1 + len(voices)}:normalize=0:duration=first,"
         f"afade=t=out:st={total - 2:.3f}:d=2,alimiter=limit=0.95[aout]")
proc = subprocess.Popen(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-nostats", "-progress", "pipe:1",
                         *inputs, "-filter_complex", ";".join(f), "-map", "[vout]", "-map", "[aout]",
                         "-c:v", "libx264", "-crf", "17", "-preset", "medium",
                         "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", out],
                        stdout=subprocess.PIPE, text=True)
last = 80
for line in proc.stdout:
    if line.startswith("out_time_us=") and line.strip()[12:].isdigit():
        pct = 80 + int(20 * min(1, int(line.strip()[12:]) / 1e6 / total))
        if pct >= last + 2:
            last = pct
            log(f"[render] {pct:3d}%  final pass")
if proc.wait():
    sys.exit("final ffmpeg pass failed")
vdur = float(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                             "stream=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout)
if vdur < total - 0.1:
    sys.exit(f"video track is {vdur:.2f}s, expected {total:.2f}s - a shot came out short")

# Frame check: a broken grade (NaN/overflow) crushes frames into black/white blobs. Measured on the
# broken 2026-11-08 render: 59-86% of pixels near-black/white vs <10% typical (48% for a dark night
# shot). Sample frames, fail on several crushed ones or a crushed median, save a contact sheet.
import numpy as np
ts = [5 + (total - 7) * k / 29 for k in range(30)]  # skip the black brand card and the fade-out
ext = []
for k, t in enumerate(ts):
    g = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", out, "-frames:v", "1",
                        "-vf", "scale=320:180,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
    y = np.frombuffer(g, np.uint8)
    ext.append(float(((y < 20) | (y > 235)).mean()))
bad = [(round(t, 1), round(e, 2)) for t, e in zip(ts, ext) if e > 0.55]
if len(bad) < 3 and np.median(ext) <= 0.35: bad = []
sheet = os.path.splitext(out)[0] + "_check.jpg"
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", out, "-vf",
                f"select='{'+'.join(f'eq(n,{round(t * FPS)})' for t in ts)}',scale=384:216,tile=6x5",
                "-frames:v", "1", "-fps_mode", "vfr", sheet])
if bad:
    sys.exit(f"frame check failed - crushed frames at (t, black/white share) {bad}, "
             f"median {np.median(ext):.2f}; see {sheet}")
log(f"[render] 100%  wrote {out} {total:.2f}s, frame check ok, contact sheet {sheet}")
