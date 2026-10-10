# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "matplotlib", "faster-whisper", "pillow"]
# ///
"""edit.json + src.json -> the cut. Run from the project folder.

    uv run edit.py build     -> timeline.js / timeline.json (shots, phrases, words on the OUTPUT clock), dialogue.wav, frames/
    uv run edit.py review    after the render: every cut has a sound, every sub lands on a cut, the final mix transcribed back
                             against the phrases, review/spectrogram.png with the cuts, review/times.txt (each cut -2..+2 frames)
    uv run edit.py pov pov.json   the fast path, no canvas: one locked-off clip jump-cut on a song's 8th-note grid + one caption

Cut rules applied here, so edit.json never holds a time:
  cut = next word - 0.08 s (audio and picture); into a `graphic` phrase the picture cuts at its keyword + 0.15 s
  pauses over 0.35 s shrink to 0.12 s after the voice ends (a phrase's "hold" keeps more) + 0.08 s before the next word;
  fillers and words outside every phrase are cut
  every boundary snaps to the 30 fps grid; a phrase whose pause was removed inside it becomes a jump cut (a new shot, re-punched)
"""
import difflib, json, re, subprocess, sys, wave
from pathlib import Path

import numpy as np

FPS, SR, LEAD, TAIL, MAXGAP, GRAPHIC = 30, 48000, 0.08, 0.12, 0.35, 0.15
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower().replace("’", "'"))
q = lambda t: round(t * FPS) / FPS


def sh(*a, **k): return subprocess.run([str(x) for x in a], check=True, **k)


def align(phrases, words, fillers):
    """Each phrase's `say` -> transcript words, in order. Returns per phrase: kept word indices and display tokens [{w, i}]."""
    toks = [(pi, tok) for pi, p in enumerate(phrases) for tok in p["say"].split()]
    sm = difflib.SequenceMatcher(None, [norm(t) for _, t in toks], [norm(w["w"]) for w in words], autojunk=False)
    hit = {a + k: b + k for a, b, n in sm.get_matching_blocks() for k in range(n)}; claimed = set(hit.values())
    out, last = [], -1
    for pi, p in enumerate(phrases):
        ks = [k for k, (j, _) in enumerate(toks) if j == pi]; m = [hit[k] for k in ks if k in hit]
        if not m: sys.exit(f"phrase {pi} {p['say']!r}: no words found in the transcript")
        lo, hi = max(min(m), last + 1), max(m); first = next(j for j, k in enumerate(ks) if k in hit); end = max(j for j, k in enumerate(ks) if k in hit)
        for k in reversed(ks[:first]):  # a misheard first/last word ("Flipway" for "Slipway") claims the unclaimed word beside the range,
            if lo - 1 > last and lo - 1 not in claimed and lo - 1 not in fillers: lo -= 1; hit[k] = lo; claimed.add(lo)  # or it'd be cut
        for k in ks[end + 1:]:
            if hi + 1 < len(words) and hi + 1 not in claimed and hi + 1 not in fillers: hi += 1; hit[k] = hi; claimed.add(hi)
        last = hi
        if hi - lo + 1 > 2 * len(ks) + 3: print(f"  phrase {pi}: spans {hi - lo + 1} heard words for {len(ks)} written; check its say text matches the take")
        heard = [f"{toks[k][1]!r} as {words[hit[k]]['w']!r}" if k in hit else repr(toks[k][1]) for k in ks if k not in hit or norm(toks[k][1]) != norm(words[hit[k]]["w"])]
        if heard: print(f"  phrase {pi}: not heard as written: {', '.join(heard)} (captions use the phrase's spelling)")
        keep = [i for i in range(lo, hi + 1) if i not in fillers]
        cut = [words[i]["w"] for i in range(lo, hi + 1) if i in fillers]
        if cut: print(f"  phrase {pi}: fillers cut {cut}")
        out.append((keep, [{"w": toks[k][1], "i": hit.get(k)} for k in ks]))
    return out


def build():
    src, ed = json.loads(Path("src.json").read_text()), json.loads(Path("edit.json").read_text())
    Wd, Hd = map(int, ed.get("size", "1080x1920").split("x")); words, phrases = src["words"], ed["phrases"]
    al = align(phrases, words, set(src["fillers"])); kept = {i for keep, _ in al for i in keep}
    gone = [i for i in range(len(words)) if i not in kept and i not in src["fillers"]]
    if gone: print(f"  cut (in no phrase): {' '.join(words[i]['w'] for i in gone)}")
    # runs of kept words with no long pause and nothing cut between them -> audio pieces on the source clock
    runs = []
    for pi, (keep, _) in enumerate(al):
        cur = [keep[0]]
        for a, b in zip(keep, keep[1:]):
            if b != a + 1 or words[b]["s"] - words[a]["e"] > MAXGAP: runs.append([pi, cur]); cur = [b]
            else: cur.append(b)
        runs.append([pi, cur])
    aud = load(src["audio"]); env = np.sqrt((aud[: len(aud) // 480 * 480].reshape(-1, 480) ** 2).mean(1)); floor = np.percentile(env, 95) * 10 ** (-32 / 20)
    def voiced_to(t, cap):  # Whisper ends a word early before a pause: follow the voice until it stays under -32 dB for 60 ms
        k = int(t * 100)
        while k < min(cap * 100, len(env)) and env[k: k + 6].max() > floor: k += 1
        return max(t, k / 100)
    pieces = []
    for k, (pi, ws) in enumerate(runs):
        a, b = words[ws[0]], words[ws[-1]]
        nb = words[ws[-1] + 1] if ws[-1] + 1 < len(words) else None; pv = words[ws[0] - 1] if ws[0] else None
        i0 = max(a["s"] - LEAD, pv["e"] + 0.01 if pv else 0.0); cap = nb["s"] - LEAD if nb else src["duration"]; o1 = min(voiced_to(b["e"], cap) + phrases[pi].get("hold", TAIL), cap)
        if pieces and pieces[-1]["last"] + 1 == ws[0] and a["s"] - words[ws[0] - 1]["e"] <= MAXGAP:  # same take: one shared point
            pieces[-1]["o1"] = i0 = max(words[ws[0] - 1]["e"], a["s"] - LEAD); pieces[-1]["flow"] = True
        pieces.append({"phrase": pi, "i0": i0, "o1": o1, "last": ws[-1], "words": ws, "flow": False})
    t = 0
    for p in pieces:
        p["i0"], p["o1"] = q(p["i0"]), q(p["o1"]); p["n"] = max(1, round((p["o1"] - p["i0"]) * FPS)); p["out0"] = t; t = round(t + p["n"] / FPS, 6); p["out1"] = t
    pieces[-1]["flow"] = False
    out_t = {}  # word index -> output time
    for p in pieces:
        for i in p["words"]: out_t[i] = round(p["out0"] + max(0.0, words[i]["s"] - p["i0"]), 3)
    # phrases on the output clock
    P = []
    for pi, (ph, (keep, toks)) in enumerate(zip(phrases, al)):
        ps = [p for p in pieces if p["phrase"] == pi]; ts = [out_t.get(tk["i"]) for tk in toks]
        known = [(k, v) for k, v in enumerate(ts) if v is not None]
        ts = [v if v is not None else float(np.interp(k, *zip(*known))) for k, v in enumerate(ts)]
        caption = [{"w": tk["w"], "t": round(v, 3)} for tk, v in zip(toks, ts)]
        kw = None
        if ph.get("kw"):
            hitk = [k for k, tk in enumerate(toks) if norm(tk["w"]) == norm(ph["kw"])]
            if not hitk: sys.exit(f"phrase {pi}: keyword {ph['kw']!r} is not in {ph['say']!r}")
            kw = {"w": re.sub(r"[^\w'?!]", "", ph["kw"]).lower(), "t": caption[hitk[0]]["t"], "k": hitk[0]}
        P.append({**ph, "i": pi, "start": ps[0]["out0"], "end": ps[-1]["out1"], "words": caption, "kw": kw})
    for pi, ph in enumerate(P):  # a graphic phrase: the picture cuts at its keyword + 0.15 s (the words before it play over the
        if ph.get("graphic") and pi:  # previous shot) and the keyword slams in on that cut
            c = q((ph["kw"] or ph["words"][0])["t"] + GRAPHIC); P[pi - 1]["end"] = ph["start"] = c
            if ph["kw"]: ph["kw"]["t"] = c
    # shots: a phrase starts one unless cut: false (or it continues a screen recording); a removed pause inside a shot = jump cut
    shots = []
    for ph in P:
        ins = ph.get("insert"); prev = shots[-1] if shots else None
        cont = prev and (ph.get("cut") is False or (ins and ins.get("kind") == "rec" and prev.get("insert", {}).get("kind") == "rec"))
        if cont: prev["out1"] = ph["end"]; prev["phrases"].append(ph["i"]); continue
        if ins: shots.append({"kind": "insert", "insert": ins, "out0": ph["start"], "out1": ph["end"], "phrase": ph["i"], "phrases": [ph["i"]]}); continue
        for k, p in enumerate(p for p in pieces if p["phrase"] == ph["i"]):  # pieces inside one phrase are split by a removed pause
            o0 = p["out0"] if k else ph["start"]
            shots.append({"kind": "cam", "cam": ph["cam"], "out0": o0, "out1": p["out1"], "phrase": ph["i"], "phrases": [ph["i"]], "i0": p["i0"] + o0 - p["out0"], "jump": k > 0})
        shots[-1]["out1"] = ph["end"]
    for a, b in zip(shots, shots[1:]): a["out1"] = b["out0"]
    dur = shots[-1]["out1"]
    if ed.get("end"): shots.append({"kind": "end", "insert": ed["end"], "out0": dur, "out1": round(dur + ed["end"].get("dur", 1.2), 6), "phrase": None, "phrases": []}); dur = shots[-1]["out1"]
    # frames: footage at 1.5x the output (cover fit, never upscaled); mattes at half that, grey (white = subject)
    Path("frames").mkdir(exist_ok=True)
    for k, s in enumerate(shots):
        s["i"] = k; s["out0"], s["out1"] = round(s["out0"], 6), round(s["out1"], 6)
        if s["kind"] == "cam":
            clip = src["clips"][s["cam"]]; sc = min(1.0, max(1.5 * Wd / clip["w"], 1.5 * Hd / clip["h"])); fw, fh = int(clip["w"] * sc) // 2 * 2, int(clip["h"] * sc) // 2 * 2
            s.update(n=max(1, round((s["out1"] - s["out0"]) * FPS)), frames=f"frames/s{k:02d}/", fw=fw, fh=fh)
            extract(clip["path"], s["i0"] + clip.get("offset", 0), s["n"], s["frames"], fw, fh); s["matte"] = False
            s["n"] = len(list(Path(s["frames"]).glob("[0-9]*.jpg")))  # fewer if the clip ends first: the last frame holds
            if any(P[i].get("behind") for i in s["phrases"]):
                if clip.get("matte"): extract(clip["matte"], s["i0"] + clip.get("offset", 0), s["n"], s["frames"], fw // 2, fh // 2, "m"); s["matte"] = True
                else: s["matte"] = matte(s)
        if s.get("insert", {}).get("kind") == "rec":
            clip = src["clips"][s["insert"].get("clip", "REC")]; n = round(clip["dur"] * FPS)
            extract(clip["path"], 0, n, "frames/REC/", clip["w"], clip["h"]); s.update(frames="frames/REC/", n=len(list(Path("frames/REC").glob("[0-9]*.jpg"))), fw=clip["w"], fh=clip["h"])
            if clip.get("cursor"): s["cursor"] = json.loads(Path(clip["cursor"]).read_text())
    # dialogue: the pieces back to back, 5 ms fades at every join, lightly compressed; silence under the end card
    f5 = np.linspace(0, 1, int(0.005 * SR)); parts = []
    for p in pieces:
        x = aud[int(p["i0"] * SR): int(p["i0"] * SR) + round(p["n"] * SR / FPS)].copy(); x = np.pad(x, (0, round(p["n"] * SR / FPS) - len(x)))
        x[: len(f5)] *= f5; x[-len(f5):] *= f5[::-1]; parts.append(x)
    parts.append(np.zeros(round((dur - pieces[-1]["out1"]) * SR)))
    write("dialogue.raw.wav", np.concatenate(parts))
    sh("ffmpeg", "-loglevel", "error", "-y", "-i", "dialogue.raw.wav", "-af", "acompressor=threshold=0.1:ratio=3:attack=5:release=120", "dialogue.wav"); Path("dialogue.raw.wav").unlink()
    tl = {"size": f"{Wd}x{Hd}", "fps": FPS, "duration": round(dur, 3), "preset": ed.get("preset", "creator"), "brand": ed.get("brand", {}), "bed": ed.get("bed"),
          "shots": shots, "phrases": P, "words": [{"w": words[i]["w"], "t": out_t[i]} for i in sorted(out_t)]}
    Path("timeline.json").write_text(json.dumps(tl, indent=1)); Path("timeline.js").write_text("window.EDIT = " + json.dumps(tl) + ";\n")
    cut_s = sum(p["i0"] - (pieces[k - 1]["o1"] if k else 0) for k, p in enumerate(pieces))
    print(f"timeline.js: {len(shots)} shots, ASL {np.mean([s['out1'] - s['out0'] for s in shots]):.2f} s, {dur:.2f} s ({cut_s:.2f} s of pauses and fillers cut), dialogue.wav")


def extract(path, t0, n, d, w, h, prefix=""):  # n frames from t0, cached by a key file
    d = Path(d); d.mkdir(parents=True, exist_ok=True); key = d / f".key{prefix}"; k = json.dumps([str(path), round(t0, 4), n, w, h])
    if key.exists() and key.read_text() == k: return
    for f in d.glob(f"{prefix}[0-9]*.jpg"): f.unlink()
    sh("ffmpeg", "-loglevel", "error", "-y", "-ss", f"{max(0, t0):.4f}", "-i", path, "-frames:v", n, "-vf", f"fps={FPS},scale={w}:{h}" + (",format=gray" if prefix else ""), "-q:v", 3, d / f"{prefix}%04d.jpg")
    key.write_text(k)


def matte(s):  # real footage: MediaPipe on the shot's frames (matte.py runs in its own env); False if it can't
    ok = subprocess.run(["uv", "run", "matte.py", s["frames"]]).returncode == 0 and any(Path(s["frames"]).glob("m0001.jpg"))
    if not ok: print(f"  shot {s['i']}: no matte, its keyword goes in front of the subject")
    return ok


def load(path):
    return np.frombuffer(sh("ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", 1, "-ar", SR, "-", capture_output=True).stdout, np.float32).astype(float)


def write(path, x):
    with wave.open(path, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def review():
    sys.path.insert(0, "."); import sfx
    from ingest import transcribe
    tl, cues = json.loads(Path("timeline.json").read_text()), json.loads(Path("cues.json").read_text())
    rows = sorted(([] if cues.get("sfx") in (None, "none") else cues["sfx"]) + sfx.autocue(cues.get("events") or []), key=lambda r: r[0])
    cuts = [s["out0"] for s in tl["shots"][1:]]; Path("review").mkdir(exist_ok=True); bad = 0
    for t in cuts:  # whoosh peaks lead by up to 0.1 s; booms, flashes and swell ends sit on the cut
        near = [r[1] for r in rows if -0.12 <= r[0] - t <= 0.05]
        if not near: bad += 1; print(f"  cut {t:6.2f}: NO SOUND")
    subs = [r for r in rows if sfx.FAMILY.get(r[1]) == "sub" and r[1] != "thump"]  # thumps lead a giant word on purpose
    off = [r for r in subs if min(abs(r[0] - t) for t in cuts) > 1.01 / FPS]
    for r in off: print(f"  {r[1]} at {r[0]:.2f} is not on a cut")
    print(f"cuts: {len(cuts)}, {len(cuts) - bad} with a sound; subs: {len(subs)}, {len(subs) - len(off)} on a cut")
    Path("review/times.txt").write_text(",".join(f"{max(0, t + k / FPS):.3f}" for t in cuts for k in (-2, -1, 0, 1, 2)))
    mix = sfx.load("audio.wav").mean(0); sfx.plot(mix, [(t, "|") for t in cuts] + [(r[0], r[1]) for r in rows if r[1] not in ("key_tap",)], "review/spectrogram.png")
    said = [norm(w) for p in tl["phrases"] for w in p["say"].split()]; heard = [norm(w["w"]) for w in transcribe("audio.wav")]
    ops = [o for o in difflib.SequenceMatcher(None, said, heard, autojunk=False).get_opcodes() if o[0] != "equal"]
    err = sum(max(o[2] - o[1], o[4] - o[3]) for o in ops)
    for o in ops: print(f"  voice: {o[0]} {' '.join(said[o[1]:o[2]])!r} -> {' '.join(heard[o[3]:o[4]])!r}")
    print(f"voice: {len(said)} words, word error rate {err / max(1, len(said)):.1%} on the final mix; stills: node render.mjs --size {tl['size']} --still $(cat review/times.txt)")


def pov():
    """pov.json: {clip, song, bpm, downbeat (s into the song), caption, segments: [[src_in, eighths], ...], out}. Each cut lands on the
    8th grid - 0.05 s. The caption is a PIL PNG (this ffmpeg has no drawtext): white semibold, dark 2 px stroke, at 21 % of H.
    An HDR clip is tone-mapped to <clip>.sdr.mov here first, the same way ingest.py does it."""
    from PIL import Image, ImageDraw, ImageFont
    from ingest import conform, probe
    j = json.loads(Path(sys.argv[2]).read_text()); e8 = 30 / j["bpm"]; ends, k = [], 0
    for _, n in j["segments"]: k += n; ends.append(round(k * e8 - 0.05, 3))
    clip = j["clip"]; pr = probe(clip)
    if pr["hdr"] and (clip := conform(clip, pr, Path(f"{Path(clip).stem}.sdr.mov"))) != Path(j["clip"]): pr = probe(clip); print(f"HDR, tone-mapped to {clip}")
    w, h = pr["w"], pr["h"]; im = Image.new("RGBA", (w, h)); d = ImageDraw.Draw(im)
    try: f = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", int(h * 0.03), index=1)
    except OSError: f = ImageFont.load_default(int(h * 0.03))
    d.multiline_text((w / 2, h * 0.21), j["caption"], font=f, fill="white", anchor="ma", align="center", stroke_width=max(2, h // 960), stroke_fill=(16, 16, 16)); im.save("caption.png")
    segs = "".join(f"[0:v]trim={a}:{a + (e - b)},setpts=PTS-STARTPTS[v{i}];" for i, ((a, _), b, e) in enumerate(zip(j["segments"], [0] + ends, ends)))
    fc = segs + "".join(f"[v{i}]" for i in range(len(ends))) + f"concat=n={len(ends)}:v=1:a=0[c];[c][1]overlay[o]"
    sh("ffmpeg", "-loglevel", "error", "-y", "-i", clip, "-i", "caption.png", "-ss", j.get("downbeat", 0), "-i", j["song"], "-filter_complex", fc, "-map", "[o]", "-map", "2:a",
       "-t", ends[-1], "-r", FPS, "-c:v", "libx264", "-crf", 18, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", j.get("out", "pov.mp4"))
    print(f"{j.get('out', 'pov.mp4')}: {len(ends)} cuts at {ends} s")


if __name__ == "__main__":
    {"build": build, "review": review, "pov": pov}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()
