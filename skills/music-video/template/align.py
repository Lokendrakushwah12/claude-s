# /// script
# dependencies = ["faster-whisper", "librosa"]
# ///
"""Word-level lyric timings + beat grid -> lyrics.js.

    uv run align.py song.mp3 [lyrics.txt]                 a sung song: Whisper words + a librosa beat grid
    uv run align.py --spoken --bpm 128 [--every 2] [--at 2.344]
        spoken word over a synthesised bed: speak.py's takes (voices/01.wav, ...) go one per `every` bars, line n's first
        word ON at + (n - 1) * every bars (default at = one beat in). Each take is timed on its own, so the words are
        exact on the bed's clock, and lyrics.js also gets VO = [[t, 'voices/01.wav'], ...] for VIDEO.vo (sfx.py mixes it).
    uv run align.py --check final.mp4                     review: transcribe the finished mix (no prompt, so it's honest)
        and compare it with lyrics.js: which words can't be heard, and how far each heard onset is from its karaoke onset.
    uv run align.py --bands audio.wav                     (re)write window.BANDS in lyrics.js from a mix, e.g. after sfx.py
        made the bed. A song run writes BANDS by itself. toon.js band(t, 'low' | 'mid' | 'high') reads it.

lyrics.txt (one line per line) primes Whisper so the words come out right; where the word count matches, its spelling
is used. Sung vocals still mis-transcribe sometimes, so read lyrics.js and fix wrong words by hand (keep the timings).
WHISPER_MODEL=large-v3 is more accurate but slower; default is medium (small.en is plenty for a clean spoken take).
"""
import argparse, difflib, json, os, re, subprocess, sys

import librosa
import numpy as np
from faster_whisper import WhisperModel

ap = argparse.ArgumentParser()
ap.add_argument("song", nargs="?"); ap.add_argument("lyrics", nargs="?")
ap.add_argument("--spoken", action="store_true"); ap.add_argument("--bpm", type=float)
ap.add_argument("--every", type=float, default=2.0); ap.add_argument("--at", type=float); ap.add_argument("--check")
ap.add_argument("--bands")
a = ap.parse_args()


def bands(path, fps=60):  # energy per band per 1/fps s, 0..1: instant attack, 0.15 s release, scaled by its 98th percentile
    y, sr = librosa.load(path, sr=24000, mono=True); hop = sr // fps  # 24 kHz: hop is exact at 30 and 60 fps, so no drift
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop)) ** 2; f = librosa.fft_frequencies(sr=sr, n_fft=2048); out = {"fps": fps}
    for name, lo, hi in (("low", 20, 150), ("mid", 150, 2000), ("high", 4000, 11000)):
        e = np.sqrt(S[(f >= lo) & (f < hi)].sum(0)); env, k = np.zeros_like(e), np.exp(-1 / (0.15 * fps))
        for i, v in enumerate(e): env[i] = max(v, env[i - 1] * k) if i else v
        out[name] = [round(float(v), 2) for v in np.clip(env / (np.percentile(env, 98) + 1e-9), 0, 1)]
    return out


if a.bands:
    js = open("lyrics.js").read().split("\nwindow.BANDS = ")[0].rstrip("\n")
    open("lyrics.js", "w").write(js + f"\nwindow.BANDS = {json.dumps(bands(a.bands))};\n")
    sys.exit(print(f"BANDS from {a.bands} -> lyrics.js"))

text_file = "lyrics.txt" if a.spoken else a.lyrics
texts = [s.strip() for s in open(text_file).read().splitlines() if s.strip()] if text_file and os.path.exists(text_file) else []
model = WhisperModel(os.environ.get("WHISPER_MODEL", "medium"), device="cpu", compute_type="int8")


def segments(y, prompt):  # pass faster-whisper a 16 kHz float array: its own file decoder (PyAV) breaks on some setups
    return list(model.transcribe(y, word_timestamps=True, initial_prompt=prompt, condition_on_previous_text=False, language="en")[0])


norm = lambda w: re.sub(r"[^a-z0-9']", "", w.lower())


def lyric_words(ws, text):  # Whisper's timings, the lyric's spelling when the counts line up
    real = text.split() if text else []
    if real and len(real) != len(ws): print(f"  word count differs ({len(ws)} heard, {len(real)} written): {text!r}; fix by hand")
    elif real and [norm(w.word) for w in ws] != [norm(w) for w in real]:  # often just "30" for "thirty"; a real mishearing means re-roll
        print("  heard " + ", ".join(f"{w.word.strip()!r} for {r!r}" for w, r in zip(ws, real) if norm(w.word) != norm(r)))
    return [{"w": real[i] if len(real) == len(ws) else w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)} for i, w in enumerate(ws)]


if a.check:
    y = np.frombuffer(subprocess.run(["ffmpeg", "-loglevel", "error", "-i", a.check, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout, np.float32)
    heard = [(w.word.strip(), w.start) for s in segments(y, None) for w in s.words]
    lyr = [(w["w"], w["s"]) for l in json.loads(open("lyrics.js").read().split("window.LYRICS = ")[1].split(";\n")[0]) for w in l["words"]]
    m = difflib.SequenceMatcher(a=[norm(w) for w, _ in lyr], b=[norm(w) for w, _ in heard], autojunk=False)
    hit = {i: heard[j][1] - lyr[i][1] for x, y0, n in m.get_matching_blocks() for i, j in zip(range(x, x + n), range(y0, y0 + n))}
    d = np.abs(list(hit.values()))
    print("heard: " + " ".join(w for w, _ in heard))
    print(f"{len(hit)}/{len(lyr)} lyric words heard in order; onset off by median {np.median(d) * 1000:.0f} ms, "
          f"{(d <= 0.067).mean():.0%} within 2 frames, worst {d.max() * 1000:.0f} ms ({lyr[max(hit, key=lambda i: abs(hit[i]))][0]})")
    print("not heard: " + (" ".join(w for i, (w, _) in enumerate(lyr) if i not in hit) or "none") + "  (digits for number words count as misses)")
    sys.exit()
if a.spoken:
    if not a.bpm: sys.exit("--spoken needs --bpm (the bed's tempo)")
    beat = 60 / a.bpm; slot = a.every * 4 * beat; at = beat if a.at is None else a.at
    lines, vo = [], []
    for n, text in enumerate(texts):
        path = f"voices/{n + 1:02d}.wav"; y = librosa.load(path, sr=16000)[0]
        ws = [w for s in segments(y, text) for w in s.words]
        if not ws: sys.exit(f"{path}: no words heard; re-roll it with speak.py {n + 1}")
        t0 = at + n * slot - ws[0].start  # the take starts here, so its first word lands on the slot
        if len(y) / 16000 > slot - 0.2: print(f"  line {n + 1} runs {len(y) / 16000:.2f} s, over its {slot:.2f} s slot: shorten or re-roll it")
        wd = [{**w, "s": round(w["s"] + t0, 3), "e": round(w["e"] + t0, 3)} for w in lyric_words(ws, text)]
        lines.append({"start": wd[0]["s"], "end": wd[-1]["e"], "text": text, "words": wd}); vo.append([round(t0, 3), path])
    duration = round(at - beat + len(texts) * slot, 2); bpm = a.bpm
    beats = [round(k * beat, 4) for k in range(int(duration / beat) + 1)]
else:
    song = a.song or sys.exit(__doc__)
    y = librosa.load(song, sr=16000, mono=True)[0]
    prompt = "\n".join(texts) or None
    lines = [{"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip(),
              "words": [{"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)} for w in s.words]} for s in segments(y, prompt)]
    y, sr = librosa.load(song, sr=22050, mono=True)
    tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm = round(float(np.ravel(tempo)[0]), 1)
    beats = [round(float(b), 3) for b in librosa.frames_to_time(frames, sr=sr)]
    duration, vo = round(len(y) / sr, 2), None

with open("lyrics.js", "w") as f:
    f.write(f"// generated by align.py; fix words by hand, keep timings\n")
    f.write(f"window.SONG = {json.dumps({'duration': duration, 'bpm': bpm})};\n")
    f.write("window.LYRICS = [\n" + ",\n".join("  " + json.dumps(l, ensure_ascii=False) for l in lines) + "\n];\n")
    f.write(f"window.BEATS = {json.dumps(beats)};\n")
    if vo: f.write(f"window.VO = {json.dumps(vo)};\n")
    if not a.spoken: f.write(f"window.BANDS = {json.dumps(bands(song))};\n")
print(f"{duration}s, {bpm:g} bpm, {len(lines)} lines, {len(beats)} beats -> lyrics.js")
