# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "librosa", "soundfile", "matplotlib", "pillow>=10.1", "faster-whisper"]
# ///
"""Take a reference video apart into measured facts, so Claude can judge the craft by looking instead of re-measuring.

    uv run deconstruct.py <x.com url | any URL | local file> [--out DIR] [--fps N] [--stems] [--drift]
    uv run deconstruct.py <DIR> --html        # re-render report.html after filling TAKE/LEAVE in report.md

Writes to DIR (default ~/Downloads/x-frames/<tweet id | file name>/):
  frames/t<sec>.jpg   frames at --fps (default 2)          sheets/s<sec>.jpg  8 fps sheets, 3 s each, labelled
  contact.jpg         the whole film on one sheet           cuts_<n>.jpg       the frame before | after every cut
  cuts.json           hard cuts + jump cuts, with word / beat / SFX offsets
  audio.wav  spectrogram.png (cuts, words, beats, SFX marked)  waveform.png (levels; voice vs bed with --stems)
  sound.json          tempo, beats, onsets, SFX transients (class guess + confidence), RMS, loudness, ducking
  transcript.json     word timestamps (faster-whisper), only when there is speech
  camera.json         per-shot zoom and pan (--drift)
  report.md / .html   the measured facts plus empty TAKE / LEAVE sections that Claude fills by looking

--stems  splits voice from the rest with demucs (torch, about 1 GB on first use) and reads SFX on the no-voice stem.
--drift  measures camera moves per shot with ORB features (opencv).
Both re-run this script under `uv run --with ...`, so the default run stays light.
Nothing here listens: sound classes are guesses from band energy, attack and decay. Check the spectrogram.
"""
import argparse, base64, html, importlib.util, io, itertools, json, os, re, shutil, subprocess, sys, tempfile
from fractions import Fraction
from pathlib import Path

ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
ap.add_argument("src")
ap.add_argument("--out")
ap.add_argument("--fps", type=float, default=2)
ap.add_argument("--stems", action="store_true")
ap.add_argument("--drift", action="store_true")
ap.add_argument("--html", action="store_true", help="only re-render DIR/report.html from DIR/report.md")
a = ap.parse_args()

# Optional heavy dependencies: re-run this same script with them added, once.
need = [p for on, mod, p in ((a.stems, "demucs", "demucs"), (a.drift, "cv2", "opencv-python-headless")) if on and not importlib.util.find_spec(mod)]
if need:
    if os.environ.get("DECONSTRUCT_REEXEC"): sys.exit(f"could not load {need}")
    os.environ["DECONSTRUCT_REEXEC"] = "1"
    os.execvp("uv", ["uv", "run", "-q", *[x for p in need for x in ("--with", p)], "--script", str(Path(__file__).resolve()), *sys.argv[1:]])

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = ImageFont.load_default(size=15)  # this ffmpeg has no drawtext, so every label is drawn with PIL


ASR = """import sys, json, soundfile as sf
from faster_whisper import WhisperModel
segs, info = WhisperModel("base", device="cpu", compute_type="int8").transcribe(sf.read(sys.argv[1], dtype="float32")[0], word_timestamps=True, vad_filter=True)
print(json.dumps({"lang": info.language, "segments": [{"start": s.start, "end": s.end, "text": s.text, "nsp": s.no_speech_prob, "lp": s.avg_logprob,
                  "words": [[w.start, w.end, w.word, w.probability] for w in s.words or []]} for s in segs]}))"""


def run(*cmd):
    return subprocess.run([str(c) for c in cmd], check=True, capture_output=True)


def ff(*args):
    return run("ffmpeg", "-loglevel", "error", "-y", *args)


def jpeg_data(p, width=1400, q=70):
    im = Image.open(p).convert("RGB")
    im.thumbnail((width, 100000))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=q, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def md_html(md, root):
    """report.md -> one self-contained page (headings, lists, tables, quotes, images embedded as JPEG)."""
    def inline(s):
        s = html.escape(s)
        return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", re.sub(r"`([^`]+)`", r"<code>\1</code>", s))

    def kind(l):
        for k, pre in (("h", "#"), ("q", "> "), ("li", "- "), ("t", "|"), ("img", "![")):
            if l.startswith(pre): return k
        return "p" if l.strip() else ""

    body, title = [], "Deconstruct"
    for k, g in itertools.groupby(md.splitlines(), kind):
        g = list(g)
        if k == "h":
            for l in g:
                n = len(l) - len(l.lstrip("#"))
                body.append(f"<h{n}>{inline(l[n:].strip())}</h{n}>")
                title = l[n:].strip() if n == 1 else title
        elif k == "q": body.append("<blockquote>" + " ".join(inline(l[2:]) for l in g) + "</blockquote>")
        elif k == "li": body.append("<ul>" + "".join(f"<li>{inline(l[2:])}</li>" for l in g) + "</ul>")
        elif k == "p": body.append("<p>" + " ".join(inline(l) for l in g) + "</p>")
        elif k == "t":
            rows = [[c.strip() for c in l.strip().strip("|").split("|")] for l in g if not set(l.strip()) <= set("|-: ")]
            cell = lambda r, t: "<tr>" + "".join(f"<{t}>{inline(c)}</{t}>" for c in r) + "</tr>"
            body.append('<div class="tw"><table>' + cell(rows[0], "th") + "".join(cell(r, "td") for r in rows[1:]) + "</table></div>")
        elif k == "img":
            for l in g:
                alt, src = re.match(r"!\[(.*)\]\((.*)\)", l).groups()
                body.append(f'<figure><img alt="{html.escape(alt)}" src="{jpeg_data(root / src)}"><figcaption>{inline(alt)}</figcaption></figure>')
    return f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<style>
:root{{--bg:#0e0e0d;--fg:#ecebe6;--dim:#8e8d87;--rule:#2a2a27;--card:#161614;--mono:ui-monospace,"SF Mono",Menlo,monospace;color-scheme:dark}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.6 -apple-system,"Inter",system-ui,sans-serif;padding:40px 16px 80px}}
main{{max-width:1100px;margin:auto}}
h1{{font-size:clamp(24px,4vw,38px);line-height:1.1;letter-spacing:-.02em;margin:0 0 12px;text-wrap:balance}}
h2{{font:500 13px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:44px 0 12px;padding-top:16px;border-top:1px solid var(--rule)}}
h3{{font-size:15px;margin:22px 0 6px}}
blockquote{{margin:16px 0;padding:12px 16px;border-left:2px solid #ffd84a;background:var(--card)}}
ul{{padding-left:18px}} li{{margin:3px 0}} code{{font:13px var(--mono);background:var(--card);padding:1px 4px;border-radius:3px}}
.tw{{overflow-x:auto}} table{{border-collapse:collapse;font:12.5px/1.4 var(--mono);white-space:nowrap}}
th,td{{padding:4px 10px;border-bottom:1px solid var(--rule);text-align:left}} th{{color:var(--dim);font-weight:500}}
figure{{margin:16px 0}} img{{width:100%;border-radius:6px;display:block}} figcaption{{color:var(--dim);font:12px var(--mono);margin-top:6px}}
footer{{margin-top:56px;border-top:1px solid var(--rule);padding-top:14px;color:var(--dim);font:12px var(--mono)}}
</style>
<main>
{chr(10).join(body)}
<footer>deconstruct.py · x-video-frames skill · github.com/Lokendrakushwah12/claude-s</footer>
</main>"""


if a.html:
    d = Path(a.src).expanduser()
    (d / "report.html").write_text(md_html((d / "report.md").read_text(), d))
    sys.exit(print(d / "report.html"))

import warnings
warnings.filterwarnings("ignore", module="numba")  # librosa's numba kernels warn on harmless float casts
import librosa, soundfile as sf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.ndimage import median_filter, percentile_filter, uniform_filter1d

# ---- 1. source ----
title = None
if re.match(r"https?://", a.src):
    info = json.loads(run("yt-dlp", "-j", "--no-warnings", "--playlist-items", "1", a.src).stdout.splitlines()[0])
    m = re.search(r"/status/(\d+)", a.src)
    out = Path(a.out or f"~/Downloads/x-frames/{m.group(1) if m else info['id']}").expanduser()
    out.mkdir(parents=True, exist_ok=True)
    if not list(out.glob("video.*")):
        run("yt-dlp", "-q", "--no-warnings", "--playlist-items", "1", "--merge-output-format", "mp4", "-o", out / "video.%(ext)s", a.src)
    video, title, label = next(out.glob("video.*")), info.get("title"), a.src
else:
    video = Path(a.src).expanduser().resolve()
    title = video.parent.name if video.stem == "video" else video.stem  # this skill's own downloads are all video.mp4
    out = Path(a.out or f"~/Downloads/x-frames/{title}").expanduser()
    out.mkdir(parents=True, exist_ok=True)
    label = video.name  # the page may be shared, so no home-folder paths in it
title = title or video.stem

pr = json.loads(run("ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,avg_frame_rate,r_frame_rate,width,height", "-of", "json", video).stdout)
vs = next(s for s in pr["streams"] if s["codec_type"] == "video")
has_audio = any(s["codec_type"] == "audio" for s in pr["streams"])
rate = vs["avg_frame_rate"] if vs["avg_frame_rate"] != "0/0" else vs["r_frame_rate"]  # e.g. "30000/1001"
fps = float(Fraction(rate))
dur = float(pr["format"]["duration"])
print(f"{label}: {dur:.1f} s, {vs['width']}x{vs['height']}, {fps:.3f} fps, audio {has_audio} -> {out}", file=sys.stderr)


# ---- 2. frames and sheets ----
def tile(items, cols, w, pad=4):
    """items: [(PIL image, label)] -> one sheet with a label in each tile's corner."""
    h = round(items[0][0].height * w / items[0][0].width)
    sheet = Image.new("RGB", (cols * (w + pad) + pad, -(-len(items) // cols) * (h + pad) + pad), (34, 34, 32))
    d = ImageDraw.Draw(sheet)
    for i, (im, text) in enumerate(items):
        x, y = pad + i % cols * (w + pad), pad + i // cols * (h + pad)
        sheet.paste(im.convert("RGB").resize((w, h)), (x, y))
        bb = d.textbbox((x + 5, y + 4), text, font=FONT)
        d.rectangle((bb[0] - 3, bb[1] - 2, bb[2] + 3, bb[3] + 2), fill=(0, 0, 0))
        d.text((x + 5, y + 4), text, fill=(255, 216, 74), font=FONT)
    return sheet


for sub in ("frames", "sheets"):
    shutil.rmtree(out / sub, ignore_errors=True)
    (out / sub).mkdir()
for p in out.glob("cuts_*.jpg"): p.unlink()
ff("-i", video, "-vf", f"fps={a.fps},scale=480:-2", "-q:v", "3", out / "frames/%05d.jpg")
frames = []
for k, p in enumerate(sorted((out / "frames").glob("*.jpg"))):
    frames.append(p.rename(out / f"frames/t{k / a.fps:07.2f}.jpg"))
step = -(-len(frames) // 120)  # the contact sheet holds at most 120 tiles
tile([(Image.open(p), f"{k * step / a.fps:.1f}s") for k, p in enumerate(frames[::step])], 8, 240).save(out / "contact.jpg", quality=82)
with tempfile.TemporaryDirectory() as td:
    ff("-i", video, "-vf", "fps=8,scale=256:-2", "-q:v", "4", f"{td}/%05d.jpg")
    imgs = sorted(Path(td).glob("*.jpg"))
    for s in range(0, len(imgs), 24):
        tile([(Image.open(p), f"{(s + i) / 8:.2f}") for i, p in enumerate(imgs[s:s + 24])], 6, 256).save(out / f"sheets/s{s / 8:06.1f}.jpg", quality=80)

# ---- 3. cuts: a frame-difference spike over a quiet local floor ----
# ffmpeg's scene>0.3 misses jump cuts in a locked-off frame (same colours, new position), so measure YDIF per frame
# (mean absolute luma change) and call a cut where it jumps well above the 25th percentile of the second around it.
# ponytail: the whole clip sits in memory at 96x54 (15 KB a frame, ~280 MB for 10 min); stream it if refs get longer.
raw = run("ffmpeg", "-loglevel", "error", "-i", video, "-vf", f"fps={rate},scale=96:54", "-pix_fmt", "rgb24", "-f", "rawvideo", "-").stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, 54, 96, 3)
Y = F.astype(np.float32) @ np.float32([0.299, 0.587, 0.114])
dY = np.abs(np.diff(Y, axis=0))
ydif = np.r_[0, dY.mean((1, 2))]
area = np.r_[0, (dY > 24).mean((1, 2))]
q = F.astype(np.int32) >> 5
hist = np.stack([np.bincount(x.ravel(), minlength=512) for x in q[..., 0] * 64 + q[..., 1] * 8 + q[..., 2]]) / (54 * 96)
hdist = np.r_[0, 0.5 * np.abs(np.diff(hist, axis=0)).sum(1)]  # 0 = same colours, 1 = nothing shared
floor = percentile_filter(ydif, 25, size=int(2 * fps) | 1)
calm_side = np.minimum(np.r_[0, ydif[:-1]], np.r_[ydif[1:], 0])  # a cut towers over at least one neighbour; motion does not
spike = (ydif > 3 * floor + 2) & (ydif > 2.5) & (ydif >= 1.6 * calm_side) & (area >= 0.02)
spike[:2] = False
cuts = []
for i in np.flatnonzero(spike):
    hard = ydif[i] >= 30 or (hdist[i] >= 0.4 and area[i] >= 0.3)
    cuts.append(dict(t=round(i / fps, 3), frame=int(i), kind="hard" if hard else "jump",
                     ydif=round(float(ydif[i]), 1), hist=round(float(hdist[i]), 2), area=round(float(area[i]), 2)))
hard_t = [c["t"] for c in cuts if c["kind"] == "hard"]
all_t = [c["t"] for c in cuts]
shot_len = lambda ts: np.diff([0, *ts, dur])
print(f"cuts: {len(hard_t)} hard, {len(cuts) - len(hard_t)} jump", file=sys.stderr)

# the frame before | after every cut, at full resolution, picked by frame number on the same fps grid
for page in range(0, len(cuts), 30):
    chunk = cuts[page:page + 30]
    want = sorted({n for c in chunk for n in (c["frame"] - 1, c["frame"])})
    with tempfile.TemporaryDirectory() as td:
        ff("-i", video, "-vf", f"fps={rate},select='{'+'.join(f'eq(n,{n})' for n in want)}',scale=320:-2", "-fps_mode", "passthrough", f"{td}/%05d.png")
        im = dict(zip(want, [Image.open(p).copy() for p in sorted(Path(td).glob("*.png"))]))
    items = [it for j, c in enumerate(chunk, page + 1) for it in ((im[c["frame"] - 1], f"#{j} before"), (im[c["frame"]], f"#{j} {c['t']:.2f}s {c['kind']}"))]
    tile(items, 6, 320).save(out / f"cuts_{page // 30 + 1}.jpg", quality=82)

# ---- 4. sound ----
sound, words, voice, fx_name = {}, [], None, "full mix"
if has_audio:
    ff("-i", video, "-vn", "-ac", "1", "-ar", "48000", out / "audio.wav")
    y, sr = sf.read(out / "audio.wav", dtype="float32")
    fx = y  # the signal SFX are read from
    if a.stems:
        with tempfile.TemporaryDirectory() as td:
            subprocess.run([sys.executable, "-m", "demucs", "--two-stems", "vocals", "-n", "htdemucs", "--shifts", "0", "--float32", "--clip-mode", "none",
                            "-o", td, out / "audio.wav"], check=True, capture_output=True)
            voice, fx = (librosa.load(Path(td) / f"htdemucs/audio/{s}.wav", sr=sr, mono=True)[0] for s in ("vocals", "no_vocals"))
        (out / "stems").mkdir(exist_ok=True)
        sf.write(out / "stems/vocals.wav", voice, sr)
        sf.write(out / "stems/no_vocals.wav", fx, sr)
        fx_name = "no-voice stem (demucs)"

    # words first: SFX read inside words need the voice split off, and ducking needs to know when someone speaks.
    # faster-whisper runs in a child process: it can segfault (exit 139) on music-only audio, and that must not lose the report.
    # It gets a numpy array, because its PyAV decode path is broken here.
    a16 = out / "asr16k.wav"
    sf.write(a16, librosa.resample(voice if voice is not None else y, orig_sr=sr, target_sr=16000), 16000)
    r = subprocess.run([sys.executable, "-c", ASR, str(a16)], capture_output=True, text=True)
    a16.unlink()
    if r.returncode:
        print(f"words: whisper exited {r.returncode}; the report continues without a transcript", file=sys.stderr)
    asr = json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode == 0 else {"lang": None, "segments": []}
    r2 = lambda v: round(v, 2)
    wl = lambda s: [[r2(w0), r2(w1), w.strip(), r2(pr)] for w0, w1, w, pr in s["words"]]
    # VAD keeps music out of whisper; a segment with no letters ("1.6%", "6.9%") is still a music hallucination
    segments = [s for s in asr["segments"] if s["nsp"] < 0.6 and s["lp"] > -1.0 and any(c.isalpha() for c in s["text"])]
    words = [w for s in segments for w in wl(s)]
    if len(words) >= 3:
        json.dump({"lang": asr["lang"], "segments": [{"start": r2(s["start"]), "end": r2(s["end"]), "text": s["text"].strip(), "words": wl(s)} for s in segments]},
                  open(out / "transcript.json", "w"), indent=1)
    else:
        words = []
        (out / "transcript.json").unlink(missing_ok=True)
    in_word = lambda t: any(w0 - 0.02 <= t <= w1 + 0.02 for w0, w1, *_ in words)

    hop = 240  # 5 ms
    fr = sr / hop
    S = np.abs(librosa.stft(fx, n_fft=2048, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    oe = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S, ref=np.max), sr=sr, hop_length=hop)
    # librosa.beat.beat_track's last-beat step (a numba gufunc) segfaults (exit 139) under librosa 1.0, even with trim=False.
    # This is the same dynamic-programming tracker (Ellis 2007) in numpy: a beat on an onset peak, one period after the last.
    # On a 150 BPM edit it lands a median 10 ms off the edit's own grid (PLP peaks ran ~90 ms late). Swap back once librosa is fixed.
    tempo = float(np.atleast_1d(librosa.feature.tempo(onset_envelope=oe, sr=sr, hop_length=hop))[0])
    def dp_beats(env, period, tight=100.0):
        o = env / (env.std() + 1e-9)
        local = np.convolve(o, np.exp(-0.5 * (np.arange(-round(period), round(period) + 1) * 32 / period) ** 2), 'same')
        score, back = local.copy(), np.full(len(o), -1)
        lo, hi = round(2 * period), round(period / 2)
        for i in range(hi, len(o)):
            prev = np.arange(max(0, i - lo), i - hi)
            if len(prev):
                c = score[prev] - tight * np.log((i - prev) / period) ** 2
                k = c.argmax(); score[i] = local[i] + c[k]; back[i] = prev[k]
        pk = np.flatnonzero(librosa.util.localmax(score))
        i = pk[score[pk] >= 0.5 * np.median(score[pk])][-1] if len(pk) else len(o) - 1
        out = []
        while i >= 0: out.append(i); i = back[i]
        b = np.array(out[::-1], dtype=int)
        return b[local[b] > 0.1 * local.max()]   # no beats invented in silence
    bf = dp_beats(oe, 60 * fr / tempo) if tempo > 0 else np.array([], dtype=int)
    beats = librosa.frames_to_time(bf, sr=sr, hop_length=hop)
    # pulse = how much the onset autocorrelation PEAKS at the beat lag over the off-beat valley. Plain ac[lag] reads
    # 0.35 on a beatless bed of slow swells; this reads 0.35 on a 130 BPM song and under 0.07 on speech and beds.
    ac, L = librosa.autocorrelate(oe - oe.mean()), round(60 / tempo * fr) if tempo > 0 else 0
    pulse = float((ac[L] - ac[L // 4:3 * L // 4].min()) / ac[0]) if L > 4 else 0.0
    on = librosa.onset.onset_detect(onset_envelope=oe, sr=sr, hop_length=hop, delta=0.07, wait=6)
    cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    power = lambda X, lo, hi: 10 * np.log10((X[(freqs >= lo) & (freqs < hi)] ** 2).sum(0) + 1e-10)
    V = np.abs(librosa.stft(voice, n_fft=2048, hop_length=hop)) if voice is not None else None
    voice_db = None  # the voice's broadband level while speaking, in the same units as the band levels
    if words:
        vb = power(V if V is not None else S, 20, 20000)  # without stems, S is the mix
        speaking = np.zeros(len(vb), bool)
        for w0, w1, *_ in words: speaking[int(w0 * fr):int(w1 * fr)] = True
        voice_db = float(np.median(vb[speaking[:len(vb)]]))

    # Band events (the hand method from the 2026-10-10 batch): a band's level rising 14 dB over its own 3 s median.
    # One sound lights several bands at once, so events peaking within 60 ms are merged into one transient.
    BANDS = (("sub", 20, 90), ("low", 90, 300), ("mid", 300, 2000), ("high", 2000, 5000), ("air", 5000, 15000))
    ev = []
    for name, lo, hi in BANDS:
        e = uniform_filter1d(power(S, lo, hi), 3)
        x = e - median_filter(e, size=int(3 * fr) | 1)
        i = 0
        while i < len(x):
            if x[i] <= 14: i += 1; continue
            j = i
            while j < len(x) and x[j] > 14: j += 1
            s0, e1 = i, j
            while s0 > 0 and x[s0] > 6: s0 -= 1
            while e1 < len(x) - 1 and x[e1] > 6: e1 += 1
            pk = i + int(np.argmax(e[i:j]))
            if (e1 - s0) / fr >= 0.02:
                col = S[(freqs >= lo) & (freqs < hi), pk] ** 2  # tonality inside the event's own band, not the voice or pad around it
                ev.append(dict(band=name, start=s0 / fr, peak=pk / fr, end=e1 / fr, rise=float(x[pk]), level=float(e[pk]),
                               over_voice=float(e[pk] - power(V[:, pk:pk + 1], lo, hi)[0]) if V is not None else None,
                               cent=[int(cent[s0]), int(cent[pk]), int(cent[max(e1 - 1, pk)])], tonal=float(col.max() / (col.sum() + 1e-12))))
            i = e1 + 1
    ev.sort(key=lambda r: r["peak"])

    def classify(e):
        atk, dec, c0, c1, c2 = e["peak"] - e["start"], e["end"] - e["peak"], *e["cent"]
        if e["band"] == "sub":
            return "sub swell (stops on the hit)" if atk >= 0.2 and dec <= 0.1 else "sub boom / impact" if atk <= 0.06 else "whoomp / low hit"
        if e["band"] == "low": return "thud / body hit" if dec < 0.3 else "low swell / drone"
        if e["tonal"] >= 0.25: return "chime / bell (tonal, rings)" if dec >= 0.5 else "blip / pop (tonal)"
        if e["end"] - e["start"] <= 0.08: return "click / tick"
        if atk >= 0.15 and dec <= 0.1: return "riser / suck-in (ends on the hit)"
        if atk >= 0.08 and dec >= 0.1: return "whoosh / pass-by" + (" (falling)" if c2 < 0.7 * c1 else "")
        return "noise hit / swish"

    groups = []
    for r in ev:
        if groups and r["peak"] - groups[-1][0]["peak"] <= 0.06: groups[-1].append(r)
        else: groups.append([r])
    transients, skipped = [], 0
    for g in groups:
        e = max(g, key=lambda r: r["rise"])
        iw = bool(words) and in_word(e["peak"])
        if iw and voice is None:  # on the full mix a syllable and an SFX look the same (measured on our own lesson), so only --stems reads under speech
            skipped += 1
            continue
        conf = min(0.95, max(0.1, (e["rise"] - 10) / 20))  # how clearly it stands out of its own band
        cls = classify(e)
        # demucs leaves breaths and sibilants in the no-voice stem: louder in the voice stem in the same band, or a short
        # high-only hiss inside a word (an "s" in "Celsius" looked exactly like that on our own lesson)
        leak = iw and e["over_voice"] is not None and e["over_voice"] < 0 and e["band"] in ("mid", "high", "air")
        hiss = iw and not {r["band"] for r in g} & {"sub", "low", "mid"} and e["tonal"] < 0.25 and e["end"] - e["start"] <= 0.4
        if leak or hiss:
            cls, conf = "voice leak? (sibilant or breath)", conf * 0.3
        transients.append(dict(t=round(e["peak"], 3), start=round(min(r["start"] for r in g), 3), end=round(max(r["end"] for r in g), 3),
                               bands=[e["band"]] + sorted({r["band"] for r in g} - {e["band"]}, key=[b[0] for b in BANDS].index), cls=cls, conf=round(conf, 2),
                               attack=round(e["peak"] - e["start"], 3), decay=round(e["end"] - e["peak"], 3), rise_db=round(e["rise"], 1),
                               vs_voice_db=round(e["level"] - voice_db, 1) if voice_db is not None else None,
                               centroid=e["cent"], tonal=round(e["tonal"], 2), in_word=iw))

    rms = librosa.amplitude_to_db(librosa.feature.rms(y=y, frame_length=4800, hop_length=4800)[0], ref=1.0)
    lo = subprocess.run(["ffmpeg", "-nostats", "-i", str(video), "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    grab = lambda k: float(re.findall(rf"{k}:\s+(-?[\d.]+|-inf)", lo)[-1].replace("-inf", "-120"))
    loud = dict(integrated_lufs=grab("I"), lra_lu=grab("LRA"), true_peak_dbfs=grab("Peak"))

    duck = None
    if words:
        n100 = int(dur * 10)
        talk = np.zeros(n100, bool)
        for w0, w1, *_ in words: talk[int(w0 * 10):int(np.ceil(w1 * 10))] = True
        gap = ~talk & ~np.convolve(talk, np.ones(5), "same").astype(bool)  # at least 200 ms from any word
        db100 = lambda s: librosa.amplitude_to_db(librosa.feature.rms(y=s, frame_length=4800, hop_length=4800)[0], ref=1.0)[:n100]
        if voice is not None:
            bed, vo = db100(fx), db100(voice)
            t_, g_ = talk[:len(bed)], gap[:len(bed)]
            duck = dict(method="demucs stems", voice_db=round(float(np.median(vo[t_])), 1), bed_under_voice_db=round(float(np.median(bed[t_])), 1),
                        bed_in_gaps_db=round(float(np.median(bed[g_])), 1) if g_.any() else None)
            duck["voice_over_bed_db"] = round(duck["voice_db"] - duck["bed_under_voice_db"], 1)
            duck["ducking_db"] = round(duck["bed_in_gaps_db"] - duck["bed_under_voice_db"], 1) if g_.any() else None
        else:
            mix = db100(y)
            t_, g_ = talk[:len(mix)], gap[:len(mix)]
            duck = dict(method="full mix, no stems: bed level only measurable in the gaps", mix_while_speaking_db=round(float(np.median(mix[t_])), 1),
                        bed_in_gaps_db=round(float(np.median(mix[g_])), 1) if g_.any() else None)
    sound = dict(analysed=fx_name, tempo_bpm=round(tempo, 1), pulse=round(pulse, 2), beats=[round(float(b), 3) for b in beats],
                 onsets=[dict(t=round(float(t), 3), strength=round(float(s), 2)) for t, s in zip(librosa.frames_to_time(on, sr=sr, hop_length=hop), oe[on])],
                 transients=transients, skipped_in_speech=skipped, rms_db_100ms=[round(float(v), 1) for v in rms], loudness=loud, voice=duck,
                 note="Measured from band energy and onsets, not heard. Class guesses come from attack, decay, centroid and tonality; check the spectrogram.")
    json.dump(sound, open(out / "sound.json", "w"), indent=1)
    print(f"sound: {len(transients)} transients, {len(words)} words, tempo {tempo:.0f} (pulse {pulse:.2f})", file=sys.stderr)

# ---- 5. cuts vs words, beats and SFX ----
near = lambda t, xs: min(xs, key=lambda x: abs(x - t)) if len(xs) else None
for c in cuts:
    w = near(c["t"], [w[0] for w in words])
    if w is not None:
        c["word"], c["word_ms"] = next(x[2] for x in words if x[0] == w), round((c["t"] - w) * 1000)  # minus = the cut leads the word
    if sound:
        b = near(c["t"], sound["beats"])
        if b is not None: c["beat_ms"] = round((c["t"] - b) * 1000)
        s = near(c["t"], [x["t"] for x in transients if abs(x["t"] - c["t"]) <= 0.3 and not x["cls"].startswith("voice leak")])
        if s is not None: c["sfx"], c["sfx_ms"] = next(x["cls"] for x in transients if x["t"] == s), round((c["t"] - s) * 1000)
json.dump(dict(fps=round(fps, 3), method="YDIF spike over the local 25th percentile; hard = picture replaced, jump = same framing",
               cuts=cuts, asl_hard=round(float(np.mean(shot_len(hard_t))), 2), asl_all=round(float(np.mean(shot_len(all_t))), 2)), open(out / "cuts.json", "w"), indent=1)

# ---- 6. camera drift per shot (--drift) ----
cam = []
if a.drift:
    import cv2
    w8 = 480
    h8 = round(w8 * vs["height"] / vs["width"] / 2) * 2
    G = np.frombuffer(run("ffmpeg", "-loglevel", "error", "-i", video, "-vf", f"fps=8,scale={w8}:{h8}", "-pix_fmt", "gray", "-f", "rawvideo", "-").stdout, np.uint8).reshape(-1, h8, w8)
    orb, bfm = cv2.ORB_create(1500), cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    kp = [orb.detectAndCompute(g, None) for g in G]
    for s0, s1 in zip([0, *all_t], [*all_t, dur]):
        idx = [i for i in range(len(G)) if s0 + 0.1 < i / 8 < s1 - 0.1]
        if len(idx) < 3: continue
        z, px, py, path, ok = 1.0, 0.0, 0.0, [], 0
        for i, j in zip(idx, idx[1:]):
            (ka, da), (kb, db) = kp[i], kp[j]
            M = None
            if da is not None and db is not None and len(ka) > 20 and len(kb) > 20:
                m = sorted(bfm.match(da, db), key=lambda x: x.distance)[:300]
                if len(m) >= 12:
                    M, inl = cv2.estimateAffinePartial2D(np.float32([ka[x.queryIdx].pt for x in m]), np.float32([kb[x.trainIdx].pt for x in m]), method=cv2.RANSAC, ransacReprojThreshold=3)
            if M is not None and inl.sum() >= 10:
                z *= float(np.hypot(M[0, 0], M[1, 0])); px += M[0, 2] / w8; py += M[1, 2] / h8; ok += 1
            path.append([round(j / 8, 3), round(z, 4)])
        T = (idx[-1] - idx[0]) / 8
        steps = np.abs(np.diff(np.log([1.0] + [p[1] for p in path])))
        early = steps[:len(steps) // 3 + 1].sum() / steps.sum() if steps.sum() >= 0.03 else None  # share of the zooming done in the first third
        cam.append(dict(start=round(s0, 2), end=round(s1, 2), tracked=round(ok / max(1, len(idx) - 1), 2), zoom_pct=round((z - 1) * 100, 1),
                        zoom_pct_per_s=round((z - 1) * 100 / T, 1), pan_x_pct_per_s=round(px * 100 / T, 1), pan_y_pct_per_s=round(py * 100 / T, 1),
                        front_loaded=None if early is None else round(float(early), 2), scale_path=path))
    json.dump(dict(note="scale > 1 = push in (features spread); pan in % of frame per second; tracked = share of frame pairs ORB could match", shots=cam),
              open(out / "camera.json", "w"), indent=1)

# ---- 7. pictures of the sound ----
if has_audio:
    spr = max(10, 5 * int(np.ceil(dur / 60)))  # seconds per row
    rows = max(1, int(np.ceil((dur - 0.2) / spr)))  # no row for a stray last 0.2 s
    tf = np.geomspace(30, 16000, 240)
    D = librosa.amplitude_to_db(S, ref=S.max())[np.searchsorted(freqs, tf)]
    pal = {}
    cmap = plt.get_cmap("tab10")
    for x in transients: pal.setdefault(x["cls"], cmap(len(pal) % 10))
    fig, axs = plt.subplots(rows, 1, figsize=(20, 2.3 * rows + 0.8), squeeze=False)
    for r, ax in enumerate(axs[:, 0]):
        t0, t1 = r * spr, min(dur, (r + 1) * spr)
        ax.imshow(D[:, int(t0 * fr):int(t1 * fr)], aspect="auto", origin="lower", cmap="magma", vmin=-85, vmax=0, extent=[t0, t1, 0, 240])
        ax.set_xlim(t0, t0 + spr)
        ax.set_yticks([np.interp(np.log(f), np.log(tf), np.arange(240)) for f in (50, 200, 1000, 5000)], ["50", "200", "1k", "5k"], fontsize=7)
        ax.set_xticks(np.arange(t0, t0 + spr + 0.01, 1))
        ax.tick_params(axis="x", labelsize=7)
        for c in cuts:
            if t0 <= c["t"] < t1: ax.axvline(c["t"], color="#3ff" if c["kind"] == "hard" else "#ff3", lw=1.2 if c["kind"] == "hard" else 1, ls="-" if c["kind"] == "hard" else "--")
        if pulse >= 0.1: ax.vlines([b for b in sound["beats"] if t0 <= b < t1], 232, 240, color="#f44", lw=1.2)  # no grid drawn for speech
        for w0, w1, w, p in words:
            if t0 <= w0 < t1: ax.text(w0, 236, w, color="white", fontsize=7, rotation=90, va="top", alpha=0.9)
        for x in transients:
            if t0 <= x["t"] < t1: ax.plot(x["t"], 12, marker="^", ms=4 + 6 * x["conf"], color=pal[x["cls"]], mec="black", mew=0.5)
    handles = [plt.Line2D([], [], marker="^", ls="", color=c, label=k) for k, c in pal.items()]
    handles += [plt.Line2D([], [], color="#3ff", label="hard cut"), plt.Line2D([], [], color="#ff3", ls="--", label="jump cut")]
    if pulse >= 0.1: handles.append(plt.Line2D([], [], color="#f44", label=f"beat ({tempo:.0f} BPM, pulse {pulse:.2f})"))
    fig.legend(handles=handles, loc="lower center", ncol=min(6, len(handles)), fontsize=8, frameon=False)
    fig.suptitle(f"{fx_name}: spectrogram 30 Hz-16 kHz; triangles = SFX transients (size = confidence), white = words", fontsize=10)
    fig.tight_layout(rect=(0, 0.6 / (2.3 * rows + 0.8), 1, 1 - 0.3 / (2.3 * rows + 0.8)))
    fig.savefig(out / "spectrogram.png", dpi=72)
    plt.close(fig)

    lv = lambda s: librosa.amplitude_to_db(librosa.feature.rms(y=s, frame_length=960, hop_length=240)[0], ref=1.0)
    tl = np.arange(len(lv(y))) / fr
    fig, axs = plt.subplots(rows, 1, figsize=(20, 1.6 * rows + 0.6), squeeze=False)
    lines = [(lv(y), "#bbb", "mix")] + ([(lv(voice), "#4af", "voice stem"), (lv(fx), "#fa4", "no-voice stem")] if voice is not None else [])
    for r, ax in enumerate(axs[:, 0]):
        t0, t1 = r * spr, min(dur, (r + 1) * spr)
        m = (tl >= t0) & (tl < t1)
        for v, col, name in lines: ax.plot(tl[m], v[m], color=col, lw=0.8, label=name)
        for w0, w1, *_ in words:
            if t0 <= w0 < t1: ax.axvspan(w0, w1, color="#4af", alpha=0.12, lw=0)
        for c in cuts:
            if t0 <= c["t"] < t1: ax.axvline(c["t"], color="#0aa" if c["kind"] == "hard" else "#cc0", lw=1, ls="-" if c["kind"] == "hard" else "--")
        ax.set_xlim(t0, t0 + spr)
        ax.set_ylim(-70, 0)
        ax.set_xticks(np.arange(t0, t0 + spr + 0.01, 1))
        ax.tick_params(labelsize=7)
        ax.grid(alpha=0.25)
    axs[0, 0].legend(loc="upper right", fontsize=8, ncol=3)
    fig.suptitle("level, dBFS (20 ms RMS); blue spans = words; lines = cuts", fontsize=10)
    fig.tight_layout()
    fig.savefig(out / "waveform.png", dpi=72)
    plt.close(fig)

# ---- 8. report ----
L = [f"# {title}", "", f"Source: `{label}` · {dur:.1f} s · {vs['width']}x{vs['height']} · {fps:.2f} fps · audio: {'yes' if has_audio else 'none'}", "",
     "> Measured, not watched or heard. Cuts come from frame differences, sound from band energy and onsets, words from a speech model. "
     "Claude cannot hear this file: every SFX class is a guess from the spectrogram's shape, and the beat tracker will invent a tempo for speech or a beatless pad (check `pulse`). "
     "Look at the sheets and the spectrogram before quoting a number.", "",
     "## Picture", "",
     f"- **Cuts:** {len(hard_t)} hard, {len(cuts) - len(hard_t)} jump. Hard = the picture is replaced. Jump = a sudden change in the same framing: a jump cut, or a graphic popping or swapping in one frame.",
     f"- **Average shot length:** {np.mean(shot_len(hard_t)):.2f} s between hard cuts (median {np.median(shot_len(hard_t)):.2f}); {np.mean(shot_len(all_t)):.2f} s counting jump cuts.",
     f"- **Cuts per minute:** {len(cuts) / dur * 60:.1f}" + (f"; cuts per beat {len(cuts) / max(1, len(sound['beats'])):.2f}" if sound and sound["pulse"] >= 0.1 else ""), "",
     "![Contact sheet](contact.jpg)", ""]
L += [f"![Every cut, the frame before and after (page {k})](cuts_{k}.jpg)" for k in range(1, -(-len(cuts) // 30) + 1)]
L += ["", "Dense sheets for Claude to read, 8 fps, 3 s each: " + ", ".join(f"`sheets/{p.name}`" for p in sorted((out / "sheets").glob("*.jpg"))[:3]) + f" … ({len(list((out / 'sheets').glob('*.jpg')))} in all)", ""]
if cam:
    L += ["### Camera (ORB, per shot)", "", "| shot | len s | tracked | zoom % | zoom %/s | pan x %/s | pan y %/s | zoom done in first third |", "|---|---|---|---|---|---|---|---|"]
    L += [f"| {c['start']:.2f} | {c['end'] - c['start']:.2f} | {c['tracked']:.0%} | {c['zoom_pct']:+.1f} | {c['zoom_pct_per_s']:+.1f} | {c['pan_x_pct_per_s']:+.1f} | {c['pan_y_pct_per_s']:+.1f} | {'' if c['front_loaded'] is None else format(c['front_loaded'], '.0%')} |" for c in cam]
    L += ["", "Zoom > 0 = push in; pan in % of the frame per second. A negative zoom done mostly in the first third reads as a zoom-settle (the shot lands zoomed in and eases out). Measured from 0.1 s after the cut, so the first frames of a settle are missing. Low `tracked` = flat graphics with few features: don't trust that row.", ""]
if has_audio:
    v = sound["voice"]
    L += ["## Sound", "", f"Analysed: {fx_name}.", "",
          f"- **Loudness:** {loud['integrated_lufs']} LUFS integrated, LRA {loud['lra_lu']} LU, true peak {loud['true_peak_dbfs']} dBFS.",
          f"- **Beat:** {tempo:.1f} BPM, pulse {pulse:.2f} " + ("(a steady beat)." if pulse >= 0.2 else "(none to speak of: speech or a beatless bed, so treat this grid as fiction)." if pulse < 0.1 else "(faint: check the spectrogram)."),
          f"- **Onsets:** {len(sound['onsets'])}. **SFX transients:** {len(transients)}, by guessed class: " + ", ".join(f"{k} {n}" for k, n in sorted(((k, sum(x['cls'] == k for x in transients)) for k in {x['cls'] for x in transients}), key=lambda kv: -kv[1])) + "."
          + (f" {skipped} more fell inside words and were dropped: on the full mix a syllable reads like an SFX, so run `--stems` to read under the voice." if skipped else "")]
    if words:
        span = words[-1][1] - words[0][0]
        L.append(f"- **Voice:** {len(words)} words, {len(words) / max(span, 1e-6) * 60:.0f} wpm over {span:.1f} s; language `{asr["lang"]}`, mean word confidence {np.mean([w[3] for w in words]):.2f} (low, or the wrong language, means whisper is hearing words in music).")
    if v:
        L.append("- **Mix:** " + (f"voice {v['voice_db']} dBFS, bed under voice {v['bed_under_voice_db']} dBFS (voice {v['voice_over_bed_db']} dB over the bed), bed in speech gaps {v['bed_in_gaps_db']} dBFS, so ducking ≈ {v['ducking_db']} dB (under ~2 dB is separation noise: our own lesson, mixed with none, reads 1.4)."
                                  if "voice_db" in v else f"mix while speaking {v['mix_while_speaking_db']} dBFS, bed in speech gaps {v['bed_in_gaps_db']} dBFS. Run `--stems` for the bed under the voice and the ducking."))
    L += ["", "![Spectrogram with cuts, words, beats and SFX](spectrogram.png)", "", "![Levels](waveform.png)", "",
          "### Strongest SFX transients", "", "| t s | class guess | conf | bands, main first | attack ms | decay ms | rise dB | vs voice dB | in a word |", "|---|---|---|---|---|---|---|---|---|"]
    for x in sorted(sorted((x for x in transients if not x["cls"].startswith("voice leak")), key=lambda x: -x["conf"] * x["rise_db"])[:40], key=lambda x: x["t"]):
        vv = "" if x["vs_voice_db"] is None else f"{x['vs_voice_db']:+.0f}"
        L.append(f"| {x['t']:.2f} | {x['cls']} | {x['conf']:.2f} | {' '.join(x['bands'])} | {x['attack'] * 1000:.0f} | {x['decay'] * 1000:.0f} | {x['rise_db']:.0f} | {vv} | {'yes' if x['in_word'] else ''} |")
    L += ["", "conf = how far the sound stands out of its own band (14 dB = 0.2, 30 dB = 0.95). It is not a probability. vs voice = the main band's peak level minus the voice's median level while speaking.", ""]
if cuts:
    L += ["## Timing: cuts against words, beats and SFX", "",
          "Offsets are cut minus event, in ms: minus = the cut comes first.", ""]
    wm = [c["word_ms"] for c in cuts if "word_ms" in c]
    bm = [c["beat_ms"] for c in cuts if "beat_ms" in c]
    if wm:
        lead, after = [x for x in wm if -150 <= x < 0], [x for x in wm if 0 <= x <= 200]
        L.append(f"- **Words:** {len(lead)} of {len(wm)} cuts come 0-150 ms before a word starts" + (f" (median {np.median(lead):+.0f} ms)" if lead else "")
                 + f"; {len(after)} land 0-200 ms after a word starts" + (f" (median {np.median(after):+.0f} ms)" if after else "") + f"; {len(wm) - len(lead) - len(after)} sit further from any word.")
    if bm and sound["pulse"] < 0.1:
        L.append(f"- **Beats:** no steady pulse ({sound['pulse']:.2f}), so cut-to-beat offsets mean nothing here.")
    elif bm and len(sound["beats"]) > 1:
        b = np.array(sound["beats"])
        ibi = float(np.median(np.diff(b)))
        g8 = np.sort(np.r_[b, (b[1:] + b[:-1]) / 2])
        o8 = np.array([(c["t"] - g8[np.abs(g8 - c["t"]).argmin()]) * 1000 for c in cuts])
        L.append(f"- **Beats** (one every {ibi:.2f} s): {np.mean([abs(x) <= 50 for x in bm]):.0%} of cuts within ±50 ms of a beat (random cuts: {min(1, 0.1 / ibi):.0%}). "
                 f"Against the eighth-note grid the median offset is {np.median(o8):+.0f} ms, {np.mean(np.abs(o8) <= 60):.0%} within ±60 ms (random: {min(1, 0.24 / ibi):.0%}).")
    L += ["", "| # | t s | kind | to next cut s | nearest word | word ms | beat ms | nearest SFX | SFX ms |", "|---|---|---|---|---|---|---|---|---|"]
    for j, (c, sl) in enumerate(zip(cuts, np.diff([*all_t, dur])), 1):
        L.append(f"| {j} | {c['t']:.3f} | {c['kind']} | {sl:.2f} | {c.get('word', '')} | {c.get('word_ms', '')} | {c.get('beat_ms', '')} | {c.get('sfx', '')} | {c.get('sfx_ms', '')} |")
    L.append("")
if words:
    L += ["## Transcript", ""] + [f"- `{s['start']:6.2f}` {s['text']}" for s in json.load(open(out / "transcript.json"))["segments"][:60]] + [""]
L += ["## TAKE (transferable): fill by looking at the sheets", "",
      "- Average shot length and cuts per beat: ", "- How type enters and leaves: ", "- Camera language and transition logic: ",
      "- Palette roles (ground, text, accent): ", "- Texture and lighting: ", "- Sound feel (what the numbers above say, in words): ", "- Signature techniques (1-2, described abstractly): ", "",
      "## LEAVE (recognisably theirs)", "", "- Shot order and compositions: ", "- Set pieces, script and copy, metaphors, logo moments: ", ""]
(out / "report.md").write_text("\n".join(L))
(out / "report.html").write_text(md_html("\n".join(L), out))
print(out / "report.md")
