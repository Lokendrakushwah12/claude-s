# /// script
# dependencies = ["numpy", "scipy", "faster-whisper"]
# ///
"""film.json -> frames/ + timeline.js (picture) and ambience.wav + audio.wav (sound). make.sh runs it after narrate.py.
    uv run build.py              everything
    uv run build.py --picture    timing, frames and timeline.js only (no whisper, no mix): for stills

Timing. Narrated: the takes set the clock. A line starts after the last one plus its pause (0.6 s, the median the #29 voice
held), and a shot cuts 2 frames before the word it starts on. Ambient: each shot's own dur.
Sound. sfx.py renders the voice, its SFX and an optional bed, mastered; ambience.py's bed goes in under it at its calibrated
level (made for a voice at -18 dBFS) minus amb_under dB (8), and lifts amb_lift dB (6) in pauses longer than 0.6 s.
"""
import json, re, subprocess, sys
from pathlib import Path

import numpy as np

import ambience, sfx  # copied in by make.sh

F = json.loads(Path("film.json").read_text())
FPS, (W, H) = F.get("fps", 30), map(int, F.get("size", "1080x1920").split("x"))
NARRATED, PICTURE = F.get("mode", "narrated") == "narrated", "--picture" in sys.argv
SR, LEAD = 48000, 2 / FPS
run = lambda *a: subprocess.run([str(x) for x in a], check=True, capture_output=True, text=True).stdout
dur = lambda p: float(run("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", p))
norm = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower().replace("-", " ")).split()


# ---------- words: whisper on each take, mapped onto the script's own spelling ----------
MODEL = []
def words_of(text, wav):
    cache = Path(str(wav).replace(".wav", ".words.json"))
    if cache.exists() and cache.stat().st_mtime > wav.stat().st_mtime and json.loads(cache.read_text())["text"] == text:
        return json.loads(cache.read_text())["words"]
    if PICTURE: return [[w, 0, 0] for w in text.split()]  # no whisper for stills; captions show whole until build runs once
    from faster_whisper import WhisperModel
    if not MODEL: MODEL.append(WhisperModel("small.en", device="cpu", compute_type="int8"))
    x = sfx.load(wav).mean(0); x = np.interp(np.arange(0, len(x), SR / 16000), np.arange(len(x)), x).astype(np.float32)
    segs, _ = MODEL[0].transcribe(np.pad(x, 8000), language="en", beam_size=5, word_timestamps=True)  # numpy in: PyAV is broken here
    got = [(w.word.strip(), w.start - 0.5, w.end - 0.5) for s in segs for w in s.words]
    want = text.split()
    if len(got) == len(want): times = [(a, b) for _, a, b in got]
    else:  # whisper split or merged a word: spread the script's words over the voiced span by length
        a0, a1 = (got[0][1], got[-1][2]) if got else (0.05, len(x) / 16000); c = np.cumsum([0] + [len(w) + 1 for w in want])
        times = [(a0 + (a1 - a0) * c[i] / c[-1], a0 + (a1 - a0) * (c[i + 1] - 1) / c[-1]) for i in range(len(want))]
    heard = " ".join(g for g, _, _ in got)
    print(f"{'ok' if norm(heard) == norm(text) else '??'} {wav.stem:8} {text!r} -> {heard!r}")
    out = [[w, round(max(0, a), 3), round(b, 3)] for w, (a, b) in zip(want, times)]
    cache.write_text(json.dumps({"text": text, "words": out})); return out


# ---------- timing ----------
shots, words, speech = [], [], []  # speech: [t0, t1] of every take, for the ambience lift
t = F.get("lead_in", 0.4)
if NARRATED:
    for li, L in enumerate(F["lines"]):
        wav = Path(f"voices/{L['id']}.wav")
        if not wav.exists(): sys.exit(f"no take {wav}: run narrate.py first (make.sh does)")
        d = dur(wav); ws = words_of(L["say"], wav)
        cuts = [0 if li == 0 else t - LEAD] + [t + ws[min(s["on"], len(ws) - 1)][1] - LEAD for s in L["shots"][1:]]  # "on": word index
        for s, c0 in zip(L["shots"], cuts): shots.append({**s, "t0": c0, "amb": s.get("amb", L.get("amb")), "line": li})
        words += [{"w": w, "t0": t + a, "t1": t + b, "line": li} for w, a, b in ws]
        speech.append([t, t + d]); t += d + L.get("pause", F.get("pause", 0.6))
    for a, b in zip(shots, shots[1:]): a["t1"] = b["t0"]
    shots[-1]["t1"] = t
else:
    for i, s in enumerate(F["shots"]):
        shots.append({**s, "t0": t if i else 0, "t1": t + s["dur"], "line": i})
        if s.get("text"):  # a typed caption: its words land evenly over the first 60 % of the shot (#30's typed line)
            ws = s["text"].split(); words += [{"w": w, "t0": t + 0.15 + k * 0.6 * s["dur"] / len(ws), "t1": t + s["dur"] - 0.4, "line": i} for k, w in enumerate(ws)]
        t += s["dur"]
E = F.get("end", {}); end = {"t0": t, "t1": t + E.get("dur", 2.5), **E}
cred = Path("credits.txt")
end["credits"] = E.get("credits") or (list(dict.fromkeys(ln for ln in cred.read_text().splitlines() if ln.strip())) if cred.exists() else [])
D = end["t1"]


# ---------- frames: each clip shot gets its own JPEG run, so video.js indexes from the cut ----------
for i, s in enumerate(shots):
    src = s.get("file") or (f"assets/archive/{s['clip']}.mp4" if s.get("clip") else None)
    if not src: continue
    d, out = s["t1"] - s["t0"] + 0.2, Path(f"frames/s{i:02d}")
    stamp = f"{src} {s.get('in', 0)} {d:.3f} {FPS} {s.get('crop')} {s.get('speed')} {Path(src).stat().st_mtime}"
    if not (out / "stamp").exists() or (out / "stamp").read_text() != stamp:
        out.mkdir(parents=True, exist_ok=True); [f.unlink() for f in out.glob("*.jpg")]
        rate = s.get("speed", 1.0)  # 0.5 = half speed (archival often runs fast: 16-18 fps material shown at 24)
        run("ffmpeg", "-loglevel", "error", "-y", "-ss", s.get("in", 0), "-i", src, "-t", d * rate, "-an",
            "-vf", (f"crop={s['crop']}," if s.get("crop") else "") + f"setpts=PTS/{rate},fps={FPS},scale='min(iw,1600)':-2:flags=lanczos", "-q:v", "2", out / "%04d.jpg")
        (out / "stamp").write_text(stamp)
    s["frames"], s["n"] = f"{out}/", len(list(out.glob("*.jpg")))

FILM = {"fps": FPS, "size": [W, H], "duration": round(D, 3), "palette": F.get("palette", {}), "font": F.get("font"), "ui": F.get("ui"),
        "fonts": F.get("fonts"), "look": F.get("look"), "captions": F.get("captions", "line" if NARRATED else "none"),
        "shots": [{k: v for k, v in s.items() if k not in ("amb", "spots", "sfx")} for s in shots], "words": words, "end": end}
Path("timeline.js").write_text("window.FILM = " + json.dumps(FILM, indent=1) + ";\n")
print(f"timeline.js: {len(shots)} shots, {len(words)} words, {D:.2f} s")
if PICTURE: sys.exit()


# ---------- sound ----------
amb = ambience.render({"duration": D, "seed": F.get("seed", 1), "xfade": F.get("xfade", 0.35), "lead": F.get("amb_lead", 0.1),
                       "scenes": [{"t": s["t0"], "layers": s.get("amb") or {}} for s in shots] + [{"t": end["t0"], "layers": E.get("amb", shots[-1].get("amb") or {})}],
                       "spots": [[s["t0"] + r[0], *r[1:]] for s in shots for r in s.get("spots", [])]}, "ambience.wav")
rows = [[s["t0"] + r[0], *r[1:]] for s in shots for r in s.get("sfx", [])] + F.get("sfx", [])
N = amb.shape[1]; fit = lambda x: np.pad(x, ((0, 0), (0, max(0, N - x.shape[1]))))[:, :N]
if NARRATED:
    vo = []
    for L, (t0, _) in zip(F["lines"], speech):  # the take, treated: "clean" gets a short plate tail (#30), "room" stays dry (#29)
        x, p = sfx.load(f"voices/{L['id']}.wav"), Path(f"voices/{L['id']}.mix.wav")
        if F.get("voice", "room") == "clean": x = np.pad(x, ((0, 0), (0, SR // 2))); x = x + 0.16 * ambience.verb(x, 0.8)
        ambience.write(p, x * 0.9 / max(np.abs(x).max(), 1e-9)); vo.append([t0, str(p)])
    sfx.render({"duration": D, "vo": vo, "sfx": rows or "none", "bed": F.get("bed"), "lufs": -14}, "fg.wav")
    fg = fit(sfx.load("fg.wav")); t = np.arange(N) / SR
    talk = np.zeros(N, bool)
    for a, b in speech: talk[int(a * SR):int(b * SR)] = True
    vref = np.sqrt(np.mean(fg[:, talk] ** 2))
    # lift: the bed comes up amb_lift dB in pauses over 0.6 s, back down 0.25 s before the next take
    gap = np.ones(N); pad = int(0.25 * SR)
    for (_, b), (a, _) in zip(speech, speech[1:] + [[D + 1, 0]]):
        if a - b > 0.6: gap[int(b * SR) + pad:max(int(b * SR) + pad, int(a * SR) - pad)] = 10 ** (F.get("amb_lift", 6) / 20)
    k = np.ones(pad) / pad; gap = np.convolve(gap, k, "same")
    mix = fg + amb * (vref / 10 ** (-18 / 20)) * 10 ** (-F.get("amb_under", 8) / 20) * gap
    if F.get("voice", "room") == "room":  # #29: the room tone stays under the whole read, ~35 dB below the voice
        rt = ambience.make("room", N, F.get("seed", 1), {}); a, b = int(speech[0][0] * SR), int(speech[-1][1] * SR) + SR
        env = np.clip(np.minimum(t - speech[0][0] + 0.5, speech[-1][1] + 1.0 - t) / 0.5, 0, 1)
        mix += rt / np.sqrt(np.mean(rt ** 2)) * vref * 10 ** (-35 / 20) * env
    target = F.get("lufs", -14)
else:
    mix = amb.copy()
    if rows:  # SFX keep their relative levels; the loudest peaks at sfx_peak dBFS in the bed's calibrated scale
        x = sfx.render({"duration": D, "sfx": rows}, "fg.wav", audition=True); mix += fit(x) * 10 ** ((F.get("sfx_peak", -20) + 1) / 20)
    target = F.get("lufs", -16)
mix *= np.clip((D - np.arange(N) / SR) / 0.6, 0, 1)  # the picture ends; so does the sound, over 0.6 s
for _ in range(3): mix = sfx.limit(mix * 10 ** ((target - sfx.loudness(mix)) / 20))
ambience.write("audio.wav", mix)
print(f"audio.wav: {D:.2f} s, {sfx.loudness(mix):.1f} LUFS, peak {20 * np.log10(np.abs(mix).max() + 1e-12):.1f} dBFS")
