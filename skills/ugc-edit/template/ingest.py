# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "faster-whisper"]
# ///
"""Footage (or placeholders) -> src/ + src.json: clips, master audio, words, silences, fillers.

    uv run ingest.py A.mp4 B.mp4 [--script script.txt]     real footage; the first clip's audio is the master
    uv run ingest.py --placeholder creator --script script.txt
        no footage: voice script.txt with Chatterbox (one take per line, "(0.9) text" sets the exaggeration), then draw
        three talking-head cams A (medium), B (tight, 3/4 view) and W (wide, at a desk) as a silhouette on a set, mouth
        driven by the voice; each comes with a ground-truth matte (src/<cam>.matte.mp4) for type behind the subject
    uv run ingest.py --placeholder tutorial --script vo.txt [--rec-text "Dark mode toggle"]
        no footage: the voice, plus REC, a drawn app recording at 2880x1800 (New release -> type -> Ship) whose cursor
        is NOT in the frames but logged in src/REC.cursor.json, the way Screen Studio-style recorders keep it

src.json: { fps, duration, audio, script, clips: {name: {path, w, h, dur, offset, matte?, cursor?}},
            words: [{i, w, s, e}], silences: [[s, e]] (> 0.35 s), fillers: [i] }
offset = seconds to add to master time to get that clip's time (audio cross-correlation; 0 for placeholders).
HDR footage (HLG, PQ or Dolby Vision: every recent iPhone) is tone-mapped to BT.709 SDR first, into src/<clip>.sdr.mov, and
that file becomes the clip's path: macOS uses avconvert (Apple's own tone mapping, rotation baked in, H.264 at 30 fps),
elsewhere ffmpeg zscale+tonemap. Frames pulled straight from HDR without it come out pale and yellow-green.
faster-whisper is fed a numpy array: its PyAV path is broken on this machine.
"""
import argparse, json, os, re, shutil, subprocess, sys
from pathlib import Path

import numpy as np

FPS, SR = 30, 48000
FILLERS = {"um", "uh", "erm", "er", "hmm", "mm", "uhm", "ah", "eh"}
TTS = Path(os.environ.get("STORY_VIDEO_TTS", Path.home() / ".local/share/story-video/tts-venv")) / "bin/python"
LOCK = Path.home() / ".cache/claude-s/ttslock.py"


def sh(*a, **k): return subprocess.run([str(x) for x in a], check=True, **k)


def pcm(path, sr=16000):  # mono float32
    return np.frombuffer(sh("ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", 1, "-ar", sr, "-", capture_output=True).stdout, np.float32)


def probe(path):
    j = json.loads(sh("ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", path, capture_output=True).stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    rot = [d.get("rotation", 0) for d in v.get("side_data_list", [])] + [int(v.get("tags", {}).get("rotate", 0))]
    w, h = (v["height"], v["width"]) if any(abs(int(r)) % 180 == 90 for r in rot) else (v["width"], v["height"])  # phones store portrait rotated
    return {"w": w, "h": h, "dur": float(j["format"]["duration"]), "audio": any(s["codec_type"] == "audio" for s in j["streams"]), "hdr": hdr(v)}


def hdr(v):  # an ffprobe video stream: HLG or PQ transfer, or a Dolby Vision record
    return v.get("color_transfer") in ("arib-std-b67", "smpte2084") or any("DOVI" in d.get("side_data_type", "") for d in v.get("side_data_list", []))


AVCONVERT = [(640, 480), (960, 540), (1280, 720), (1920, 1080), (3840, 2160)]  # its size presets


def conform(path, pr, dst):  # HDR -> BT.709 SDR; returns the file to pull frames from (the source if it can't)
    if dst.exists(): return dst
    if sys.platform == "darwin" and shutil.which("avconvert"):
        pw, ph = next((p for p in AVCONVERT if p[0] >= max(pr["w"], pr["h"])), AVCONVERT[-1])
        sh("avconvert", "--source", path, "--preset", f"Preset{pw}x{ph}", "--output", dst, "--replace")
    elif "zscale" in sh("ffmpeg", "-hide_banner", "-filters", capture_output=True, text=True).stdout:  # ponytail: untested here (this ffmpeg has no zscale)
        sh("ffmpeg", "-loglevel", "error", "-y", "-i", path, "-vf", "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p",
           "-c:v", "libx264", "-crf", 16, "-preset", "veryfast", "-c:a", "aac", dst)
    else:
        print(f"WARNING: {path} is HDR and this ffmpeg has no zscale, so it can't be tone-mapped: frames will look pale and yellow-green.\n"
              "  Install an ffmpeg built with libzimg, or convert it to SDR yourself and ingest that.", file=sys.stderr)
        return Path(path)
    return dst


def offset(master, x, sr=16000, hop=160):  # seconds to add to master time to get x's time: cross-correlated 10 ms envelopes
    env = lambda a: np.abs(a[: len(a) // hop * hop]).reshape(-1, hop).mean(1)
    a, b = env(master), env(x); a, b = a - a.mean(), b - b.mean(); n = len(a) + len(b)
    k = int(np.argmax(np.fft.irfft(np.fft.rfft(b, n) * np.conj(np.fft.rfft(a, n)), n)))
    return round((k - n if k > n // 2 else k) * hop / sr, 3)


def transcribe(wav, prompt=None):
    from faster_whisper import WhisperModel
    m = WhisperModel(os.environ.get("WHISPER_MODEL", "small.en"), device="cpu", compute_type="int8")
    segs, _ = m.transcribe(pcm(wav), word_timestamps=True, initial_prompt=prompt, condition_on_previous_text=False)
    return [{"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for s in segs for w in s.words]


TTS_CODE = r"""
import json, sys, wave, numpy as np, torch
from chatterbox.tts import ChatterboxTTS
lines, out, gap = json.loads(sys.argv[1]), sys.argv[2], float(sys.argv[3])
m = ChatterboxTTS.from_pretrained(device="mps" if torch.backends.mps.is_available() else "cpu")
parts = []
for ex, text in lines:
    x = np.clip(m.generate(text, exaggeration=ex, cfg_weight=0.35).squeeze().cpu().numpy(), -1, 1)
    on = np.flatnonzero(np.abs(x) > 10 ** (-45 / 20)); x = x[max(0, on[0] - 240): on[-1] + 2400]   # trim the model's silence
    parts += [x, np.zeros(int(gap * m.sr))]; print("voiced:", text, file=sys.stderr)
with wave.open(out, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(m.sr); w.writeframes((np.concatenate(parts[:-1]) * 32767).astype("<i2").tobytes())
"""


def voice(script, out, gap=0.55):  # Chatterbox, one take per line, under the shared lock (other agents narrate too)
    lines = [(float(m[1]) if m[1] else 0.6, m[2]) for m in (re.match(r"\s*(?:\(([\d.]+)\))?\s*(.+)", l) for l in script.splitlines() if l.strip())]
    raw = out.with_suffix(".raw.wav")
    sh("python3", LOCK, TTS, "-c", TTS_CODE, json.dumps(lines), raw, gap)
    sh("ffmpeg", "-loglevel", "error", "-y", "-i", raw, "-ar", SR, "-ac", 1, out); raw.unlink()


# ---------- placeholders: a drawn talking head on a set, three framings ----------
def font(size, bold=False):
    from PIL import ImageFont
    try: return ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", size, index=1 if bold else 0)
    except OSError: return ImageFont.load_default(size)


def envelope(wav, n):  # voice level per video frame, 0..1, for the mouth
    a = pcm(wav, 16000); k = 16000 // FPS; e = np.sqrt((np.pad(a, (0, n * k))[: n * k].reshape(n, k) ** 2).mean(1))
    e = np.convolve(e, [0.25, 0.5, 0.25], "same"); return np.clip(e / (np.percentile(e, 95) + 1e-9), 0, 1)


CAMS = {  # head centre (fractions of W/H), head width u (fraction of W), 3/4 turn, set, label
    "A": dict(cx=0.5, cy=0.33, u=0.33, turn=0.0, set="shelf", label="A-CAM  35mm"),
    "B": dict(cx=0.42, cy=0.36, u=0.46, turn=0.45, set="window", label="B-CAM  85mm"),
    "W": dict(cx=0.52, cy=0.42, u=0.2, turn=-0.15, set="desk", label="WIDE  24mm"),
}
SKIN, HAIR, KNIT, KNIT_RIM, WALL0, WALL1 = (196, 182, 168), (38, 33, 31), (58, 63, 72), (120, 104, 92), (44, 52, 62), (27, 32, 39)


def draw_set(W, H, kind):
    from PIL import Image, ImageDraw, ImageFilter
    y = np.linspace(0, 1, H)[:, None, None]; im = (np.array(WALL0) * (1 - y) + np.array(WALL1) * y) * np.ones((1, W, 1))
    yy, xx = np.mgrid[0:H, 0:W] / W
    lamp = np.exp(-(((xx - 0.12) ** 2 + (yy - 0.28 * H / W) ** 2) / 0.09))[..., None]  # warm practical, left
    im = im + lamp * np.array([120, 70, 30]) * 0.9
    bg = Image.fromarray(np.clip(im, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(bg)
    if kind in ("shelf", "desk"):
        sy = int(H * (0.5 if kind == "shelf" else 0.46)); d.rectangle([0, sy, int(W * 0.46), sy + int(W * 0.02)], fill=(70, 58, 50))
        x = int(W * 0.03)
        for i, (bw, bh, c) in enumerate([(0.05, 0.16, (92, 62, 58)), (0.035, 0.13, (60, 72, 88)), (0.06, 0.15, (150, 132, 108)), (0.04, 0.11, (84, 90, 70))]):
            d.rectangle([x, sy - int(W * bh), x + int(W * bw), sy], fill=c); x += int(W * (bw + 0.008))
        px, py = int(W * 0.38), sy  # a potted plant: a pot and a few leaf ellipses
        d.rectangle([px - 40, py - 90, px + 40, py], fill=(150, 96, 70))
        for a in np.linspace(-1.2, 1.2, 7): d.ellipse([px + 120 * np.sin(a) - 40, py - 260 - 60 * np.cos(a), px + 120 * np.sin(a) + 40, py - 120 - 60 * np.cos(a)], fill=(96, 110, 82))
    if kind in ("window", "shelf"):
        x0 = int(W * (0.62 if kind == "shelf" else 0.55)); d.rectangle([x0, int(H * 0.06), W + 40, int(H * 0.46)], fill=(92, 110, 132))
        for f in (0.33, 0.66): d.rectangle([x0, int(H * (0.06 + 0.4 * f)) - 6, W, int(H * (0.06 + 0.4 * f)) + 6], fill=(54, 62, 74))
        d.rectangle([x0 + int((W - x0) * 0.5) - 6, int(H * 0.06), x0 + int((W - x0) * 0.5) + 6, int(H * 0.46)], fill=(54, 62, 74))
    for i in range(14):  # bokeh
        r = np.random.default_rng(i * 7 + len(kind)); cx, cy, rad = r.uniform(0, W), r.uniform(0, H * 0.55), r.uniform(20, 70)
        d.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=tuple(int(v) for v in r.uniform([170, 140, 100], [230, 190, 140])))
    return bg.filter(ImageFilter.GaussianBlur(W * 0.012))  # the set sits out of focus behind the subject


def draw_person(W, H, cam, t, env, blink):
    """Figure on an RGBA layer: torso, neck, head, hair, eyes, a mouth that opens with the voice. Its alpha IS the matte."""
    from PIL import Image, ImageDraw, ImageFilter
    c = CAMS[cam]; u = c["u"] * W; L = c["turn"]
    sway = 10 * np.sin(2 * np.pi * 0.13 * t) + 5 * np.sin(2 * np.pi * 0.41 * t + 1)
    bx, by = c["cx"] * W + sway * 0.5, c["cy"] * H + 3 * np.sin(2 * np.pi * 0.27 * t)
    hx, hy = bx + sway + 6 * np.sin(2 * np.pi * 0.21 * t), by + env * u * 0.03  # the head moves more than the body, nods on stress
    lay = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(lay)
    E = lambda x, y, w, h, col: d.ellipse([x - w / 2, y - h / 2, x + w / 2, y + h / 2], fill=col)
    for dx, col in ((-u * 0.025, KNIT_RIM), (0, KNIT)):  # torso twice: a warm rim on the lamp side, then the sweater
        E(bx + dx, by + u * 1.55, u * 2.5, u * 1.5, col); d.rectangle([bx + dx - u * 1.25, by + u * 1.55, bx + dx + u * 1.25, H], fill=col)
    E(bx, by + u * 0.86, u * 0.66, u * 0.34, (44, 48, 56))  # collar shadow
    d.rectangle([hx - u * 0.22, hy + u * 0.35, hx + u * 0.22, by + u * 0.86], fill=tuple(int(v * 0.86) for v in SKIN))
    E(hx - u * 0.47 + L * u * 0.12, hy + u * 0.05, u * 0.14, u * 0.24, SKIN); E(hx + u * 0.47 + L * u * 0.12, hy + u * 0.05, u * 0.14, u * 0.24, SKIN)  # ears
    E(hx - u * 0.03, hy - u * 0.14, u * 1.06, u * 1.12, HAIR)
    E(hx, hy + u * 0.06, u * 0.92, u * 1.18, SKIN)
    E(hx - u * 0.06 + L * u * 0.1, hy - u * 0.47, u * 0.95, u * 0.42, HAIR)  # fringe
    ex = lambda s: hx + (s * 0.2 + L * 0.16) * u
    for s in (-1, 1): E(ex(s), hy + u * 0.02, u * 0.085, u * (0.012 if blink else 0.05), (40, 34, 34))
    E(hx + L * u * 0.2, hy + u * 0.19, u * 0.07, u * 0.12, tuple(int(v * 0.88) for v in SKIN))  # nose shadow
    E(hx + L * u * 0.17, hy + u * 0.36, u * (0.2 - env * 0.04), u * (0.025 + env * 0.11), (70, 38, 40))  # mouth
    if cam == "A":  # a podcast mic on its arm, in front of the subject (so it's in the matte too)
        d.line([(W * 0.02, H * 0.6), (bx - u * 0.75, by + u * 0.75)], fill=(24, 24, 26), width=int(u * 0.06))
        d.rounded_rectangle([bx - u * 0.95, by + u * 0.55, bx - u * 0.55, by + u * 1.3], radius=u * 0.18, fill=(30, 30, 33))
    if cam == "W":  # a desk and a laptop in front of the subject
        d.rectangle([0, H * 0.7, W, H], fill=(92, 72, 58)); d.polygon([(bx - u * 1.2, H * 0.7), (bx + u * 0.9, H * 0.7), (bx + u * 0.75, H * 0.6), (bx - u * 1.05, H * 0.6)], fill=(170, 172, 178))
    return lay.filter(ImageFilter.GaussianBlur(1.6))


def placeholder_cams(wav, dur, out):
    from PIL import Image, ImageDraw
    W, H = 1620, 2880; n = int(round(dur * FPS)); env = envelope(wav, n); clips = {}
    for cam in CAMS:
        bg = draw_set(W, H, CAMS[cam]["set"])
        enc = lambda dst, size, pix: subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", pix, "-s", f"{size[0]}x{size[1]}", "-r", str(FPS), "-i", "-"]
                                                      + (["-i", str(wav), "-c:a", "aac", "-shortest"] if pix == "rgb24" else []) + ["-c:v", "libx264", "-crf", "16", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(dst)], stdin=subprocess.PIPE)
        v, m = enc(out / f"{cam}.mp4", (W, H), "rgb24"), enc(out / f"{cam}.matte.mp4", (W // 2, H // 2), "gray")
        for f in range(n):
            t = f / FPS; lay = draw_person(W, H, cam, t, env[f], (t % 3.7) < 0.12)
            fr = Image.alpha_composite(bg.convert("RGBA"), lay).convert("RGB"); d = ImageDraw.Draw(fr)
            d.ellipse([W * 0.08, H * 0.085, W * 0.08 + 26, H * 0.085 + 26], fill=(230, 60, 50) if f % 30 < 20 else (90, 40, 40))  # slate: REC, cam, timecode
            d.text((W * 0.08 + 44, H * 0.085 - 6), f"PLACEHOLDER  {CAMS[cam]['label']}   {int(t // 60):02d}:{int(t % 60):02d}:{f % FPS:02d}", font=font(34), fill=(235, 235, 235))
            v.stdin.write(fr.tobytes()); m.stdin.write(lay.getchannel("A").resize((W // 2, H // 2)).tobytes())
        for p in (v, m): p.stdin.close(); p.wait()
        clips[cam] = {"path": f"src/{cam}.mp4", "w": W, "h": H, "dur": n / FPS, "offset": 0.0, "matte": f"src/{cam}.matte.mp4"}
        print(f"placeholder {cam}: {n} frames")
    return clips


# ---------- placeholder screen recording: a drawn app, cursor logged separately ----------
def placeholder_rec(out, text="Dark mode toggle", accent=(255, 90, 54)):
    from PIL import Image, ImageDraw
    W, H, s = 2880, 1800, 2  # a retina MacBook capture
    tNew, tField, t0, cps = 1.7, 2.9, 3.2, 5.0; tType = t0 + len(text) / cps; tShip = tType + 0.9; dur = tShip + 1.6
    side, top = 440, 104; row = lambda i: top + 260 + i * 120
    newB, field, shipB = (W - 520, top + 60, W - 120, top + 150), (1340, 520, 2440, 640), (2140, 760, 2440, 860)
    rows = ["v1.42  Undo on delete", "v1.41  Export to CSV", "v1.40  Faster search", "v1.39  Keyboard shortcuts"]
    keys = [(0, 1500, 900), (1.0, 1500, 900), (1.6, newB[0] + 200, newB[1] + 45), (2.3, newB[0] + 200, newB[1] + 45), (2.8, field[0] + 300, field[1] + 60),
            (tType, field[0] + 300, field[1] + 60), (tType + 0.1, field[0] + 300, field[1] + 60), (tShip - 0.1, shipB[0] + 150, shipB[1] + 50), (dur, shipB[0] + 170, shipB[1] + 80)]
    clicks = [tNew, tField, tShip]; F = font(17 * s); FB = font(20 * s, True); FT = font(30 * s, True)
    v = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "14", "-preset", "veryfast", "-pix_fmt", "yuv420p", str(out / "REC.mp4")], stdin=subprocess.PIPE)
    n = int(dur * FPS); log = []
    for f in range(n):
        t = f / FPS; im = Image.new("RGB", (W, H), (250, 250, 248)); d = ImageDraw.Draw(im)
        d.rectangle([0, 0, W, top], fill=(236, 236, 233)); [d.ellipse([40 + i * 44, 38, 68 + i * 44, 66], fill=c) for i, c in enumerate([(236, 106, 94), (244, 190, 80), (98, 197, 84)])]
        d.rectangle([0, top, side, H], fill=(242, 242, 239))
        for i, nav in enumerate(["Inbox", "Releases", "Roadmap", "Feedback", "Settings"]):
            if i == 1: d.rounded_rectangle([24, top + 40 + i * 76, side - 24, top + 100 + i * 76], 14, fill=(228, 228, 224))
            d.text((60, top + 52 + i * 76), nav, font=FB if i == 1 else F, fill=(30, 30, 30) if i == 1 else (110, 110, 110))
        d.text((side + 80, top + 70), "Releases", font=FT, fill=(20, 20, 20))
        d.rounded_rectangle(newB, 18, fill=accent); d.text((newB[0] + 70, newB[1] + 26), "+ New release", font=FB, fill=(255, 255, 255))
        shipped = t >= tShip + 0.1; listed = (["v1.43  " + text] if shipped else []) + rows
        for i, r in enumerate(listed):
            y = row(i) + (0 if not shipped else int(120 * (1 - min(1, (t - tShip - 0.1) / 0.25))) * (i > 0))
            d.line([(side + 80, y + 100), (W - 120, y + 100)], fill=(230, 230, 226), width=2)
            d.text((side + 80, y + 30), r, font=FB if (shipped and i == 0) else F, fill=(30, 30, 30))
            d.text((W - 460, y + 30), "Shipped", font=F, fill=(120, 160, 110))
        if tNew <= t < tShip + 0.1:  # the panel slides in from the right
            px = 1240 + int(1640 * (1 - min(1, (t - tNew) / 0.25)) ** 3)
            d.rectangle([px, top, W, H], fill=(255, 255, 255)); d.line([(px, top), (px, H)], fill=(220, 220, 216), width=3)
            d.text((px + 100, top + 120), "New release", font=FT, fill=(20, 20, 20)); d.text((field[0], field[1] - 60), "Name", font=F, fill=(110, 110, 110))
            fx = px - 1240; d.rounded_rectangle([field[0] + fx, field[1], field[2] + fx, field[3]], 14, outline=accent if t >= tField else (210, 210, 206), width=4)
            typed = text[: max(0, min(len(text), int((t - t0) * cps)))]; d.text((field[0] + fx + 36, field[1] + 36), typed, font=FB, fill=(20, 20, 20))
            if t >= tField and int(t * 2.5) % 2 == 0: tx = field[0] + fx + 40 + d.textlength(typed, font=FB); d.rectangle([tx, field[1] + 30, tx + 4, field[3] - 30], fill=(20, 20, 20))
            d.rounded_rectangle([shipB[0] + fx, shipB[1], shipB[2] + fx, shipB[3]], 18, fill=(20, 20, 20)); d.text((shipB[0] + fx + 110, shipB[1] + 30), "Ship", font=FB, fill=(255, 255, 255))
        if tShip + 0.1 <= t < tShip + 1.5:
            msg = f"Shipped v1.43  {text}"; tw = d.textlength(msg, font=F); d.rounded_rectangle([W / 2 - tw / 2 - 60, H - 200, W / 2 + tw / 2 + 60, H - 100], 24, fill=(24, 24, 24)); d.text((W / 2 - tw / 2, H - 170), msg, font=F, fill=(255, 255, 255))
        v.stdin.write(im.tobytes())
        log.append({"t": round(t, 3), "x": round(float(np.interp(t, [k[0] for k in keys], [k[1] for k in keys])), 1), "y": round(float(np.interp(t, [k[0] for k in keys], [k[2] for k in keys])), 1)})
    v.stdin.close(); v.wait()
    (out / "REC.cursor.json").write_text(json.dumps({"w": W, "h": H, "moves": log, "clicks": clicks}))
    print(f"placeholder REC: {n} frames, clicks at {clicks}, typing {t0}-{tType:.2f} s")
    return {"path": "src/REC.mp4", "w": W, "h": H, "dur": n / FPS, "offset": 0.0, "cursor": "src/REC.cursor.json"}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("clips", nargs="*"); ap.add_argument("--script"); ap.add_argument("--placeholder", choices=["creator", "tutorial"])
    ap.add_argument("--rec-text", default="Dark mode toggle"); a = ap.parse_args()
    out = Path("src"); out.mkdir(exist_ok=True); script = Path(a.script).read_text() if a.script else None; clips = {}
    if a.placeholder:
        if not script: sys.exit("--placeholder needs --script (the lines to voice)")
        master = out / "voice.wav"
        if not master.exists(): voice(script, master)
        dur = len(pcm(master)) / 16000
        clips = placeholder_cams(master, dur, out) if a.placeholder == "creator" else {"REC": placeholder_rec(out, a.rec_text)}
    else:
        if not a.clips: sys.exit("give footage clips, or --placeholder creator|tutorial --script script.txt")
        master = out / "audio.wav"; sh("ffmpeg", "-loglevel", "error", "-y", "-i", a.clips[0], "-vn", "-ac", 1, "-ar", SR, master); ref = pcm(master)
        for i, p in enumerate(a.clips):
            name = "ABCDEFGH"[i]; pr = probe(p); f = Path(p)
            if pr["hdr"] and (f := conform(p, pr, out / f"{f.stem}.sdr.mov")) != Path(p): pr = probe(f); print(f"{name}: HDR, tone-mapped to {f}")
            clips[name] = {"path": str(f.resolve()), "w": pr["w"], "h": pr["h"], "dur": pr["dur"], "offset": offset(ref, pcm(p)) if i and pr["audio"] else 0.0}
            print(f"{name}: {p} {pr['w']}x{pr['h']} {pr['dur']:.1f}s offset {clips[name]['offset']:+.3f}s" + ("  (under 1.5x the output: punch-ins will soften)" if max(pr["w"], pr["h"]) < 2880 else ""))
    words = [dict(i=i, **w) for i, w in enumerate(transcribe(master))]  # no initial_prompt: a script-length prompt made Whisper loop one line
    dur = len(pcm(master)) / 16000; edges = [0.0] + [x for w in words for x in (w["s"], w["e"])] + [dur]
    sil = [[round(edges[k], 3), round(edges[k + 1], 3)] for k in range(0, len(edges), 2) if edges[k + 1] - edges[k] > 0.35]
    fill = [w["i"] for w in words if re.sub(r"[^a-z]", "", w["w"].lower()) in FILLERS]
    Path("src.json").write_text(json.dumps({"fps": FPS, "duration": round(dur, 3), "audio": str(master), "script": script, "clips": clips, "words": words, "silences": sil, "fillers": fill}, indent=1))
    print(f"src.json: {len(words)} words, {len(sil)} silences > 0.35 s, fillers {[words[i]['w'] for i in fill]}, {dur:.1f} s")
    print(" ".join(f"{w['i']}:{w['w']}" for w in words))


if __name__ == "__main__":
    if "--selftest" in sys.argv:  # the sync maths: a copy that starts 0.5 s later in its own clock reads +0.5
        r = np.random.default_rng(1); a = np.repeat(r.random(400), 160).astype(np.float32); assert offset(a, np.concatenate([np.zeros(8000, np.float32), a])) == 0.5
        assert hdr({"color_transfer": "arib-std-b67"}) and hdr({"side_data_list": [{"side_data_type": "DOVI configuration record"}]}) and not hdr({"color_transfer": "bt709"}); print("ok")
    else: main()
