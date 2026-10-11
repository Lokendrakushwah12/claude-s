# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy", "matplotlib", "faster-whisper", "pillow"]
# ///
"""edit.json + src.json -> the cut. Run from the project folder.

    uv run edit.py build     -> timeline.js / timeline.json (shots, phrases, words on the OUTPUT clock), dialogue.wav, frames/
    uv run edit.py review    after the render: every cut has a sound, every sub lands on a cut, the final mix transcribed back
                             against the phrases, review/spectrogram.png with the cuts, review/times.txt (each cut -2..+2 frames)
    uv run edit.py hooks     edit.json "hooks" -> hooks/hN.mp4: each candidate opening line + the first body phrases, for A/B tests
    uv run edit.py pov pov.json   the fast path, no canvas: one locked-off clip jump-cut on a song's 8th-note grid + one caption

Cut rules applied here, so edit.json never holds a time:
  cut = next word - 0.08 s (audio and picture); into a `graphic` phrase the picture cuts at its keyword + 0.15 s
  pauses over 0.35 s shrink to 0.12 s after the voice ends (a phrase's "hold" keeps more) + 0.08 s before the next word;
  fillers, dropped retakes (src.json) and words outside every phrase are cut; a laugh after a phrase is kept ("laugh": false cuts it)
  every boundary snaps to the 30 fps grid; a phrase whose pause was removed inside it becomes a jump cut (a new shot, re-punched)
Photos named in a phrase (insert.images, ui.img, pops[].img) become frames/img/*.jpg (<= 1400 px); "clip.mov#2.5" takes the frame at
2.5 s of a clip, tone-mapped first when it's HDR. A kept laugh's output-clock span goes on its phrase as laughAt (laugh: "type").
"""
import difflib, json, re, subprocess, sys, wave
from fractions import Fraction
from pathlib import Path

import numpy as np

FPS, SR, LEAD, TAIL, MAXGAP, GRAPHIC = 30, 48000, 0.08, 0.12, 0.35, 0.15
norm = lambda s: re.sub(r"[^a-z0-9']", "", s.lower().replace("’", "'"))
q = lambda t: round(t * FPS) / FPS


def sh(*a, **k): return subprocess.run([str(x) for x in a], check=True, **k)


def align(phrases, words, fillers, drop=frozenset()):
    """Each phrase's `say` -> transcript words, in order. Returns per phrase: kept word indices and display tokens [{w, i}].
    Fillers and dropped retakes never match, so a say lands on the take that was kept. A "hook": true phrase is matched on its
    own, anywhere in the recording (a hook variant opens on a later line); the other phrases in order."""
    skip, out = set(fillers) | set(drop), {}
    def run(pis):
        toks = [(pi, tok) for pi in pis for tok in phrases[pi]["say"].split()]
        sm = difflib.SequenceMatcher(None, [norm(t) for _, t in toks], ["\0" if i in skip else norm(w["w"]) for i, w in enumerate(words)], autojunk=False)
        hit = {a + k: b + k for a, b, n in sm.get_matching_blocks() for k in range(n)}; claimed = set(hit.values()); last = -1
        for pi in pis:
            p, ks = phrases[pi], [k for k, (j, _) in enumerate(toks) if j == pi]; m = [hit[k] for k in ks if k in hit]
            if not m: sys.exit(f"phrase {pi} {p['say']!r}: no words found in the transcript" + (" (dropped as a retake? \"retakes\": false in edit.json keeps every take)" if drop else ""))
            lo, hi = max(min(m), last + 1), max(m); first = next(j for j, k in enumerate(ks) if k in hit); end = max(j for j, k in enumerate(ks) if k in hit)
            for k in reversed(ks[:first]):  # a misheard first/last word ("Flipway" for "Slipway") claims the unclaimed word beside the range,
                if lo - 1 > last and lo - 1 not in claimed and lo - 1 not in skip: lo -= 1; hit[k] = lo; claimed.add(lo)  # or it'd be cut
            for k in ks[end + 1:]:
                if hi + 1 < len(words) and hi + 1 not in claimed and hi + 1 not in skip: hi += 1; hit[k] = hi; claimed.add(hi)
            last = hi
            if hi - lo + 1 > 2 * len(ks) + 3: print(f"  phrase {pi}: spans {hi - lo + 1} heard words for {len(ks)} written; check its say text matches the take")
            heard = [f"{toks[k][1]!r} as {words[hit[k]]['w']!r}" if k in hit else repr(toks[k][1]) for k in ks if k not in hit or norm(toks[k][1]) != norm(words[hit[k]]["w"])]
            if heard: print(f"  phrase {pi}: not heard as written: {', '.join(heard)} (captions use the phrase's spelling)")
            keep = [i for i in range(lo, hi + 1) if i not in skip]
            cut = [words[i]["w"] for i in range(lo, hi + 1) if i in fillers]; gone = [words[i]["w"] for i in range(lo, hi + 1) if i in drop]
            if cut: print(f"  phrase {pi}: fillers cut {cut}")
            if gone: print(f"  phrase {pi}: false start cut {gone}")
            out[pi] = (keep, [{"w": toks[k][1], "i": hit.get(k)} for k in ks])
        skip.update(i for pi in pis for i in out[pi][0])  # a hook's words aren't the body's to take
    for pi, p in enumerate(phrases):
        if p.get("hook"): run([pi])
    run([pi for pi, p in enumerate(phrases) if not p.get("hook")])
    return [out[pi] for pi in range(len(phrases))]


def build():
    src, ed = json.loads(Path("src.json").read_text()), json.loads(Path("edit.json").read_text())
    Wd, Hd = map(int, ed.get("size", "1080x1920").split("x")); words, phrases = src["words"], ed["phrases"]
    drop = set() if ed.get("retakes") is False else {i for i0, i1, _ in src.get("retakes", []) for i in range(i0, i1 + 1)}
    al = align(phrases, words, set(src["fillers"]), drop); kept = {i for keep, _ in al for i in keep}
    gone = [i for i in range(len(words)) if i not in kept and i not in src["fillers"] and i not in drop]
    if drop - kept: print(f"  retakes cut: {' | '.join(' '.join(words[i]['w'] for i in range(i0, i1 + 1)) for i0, i1, _ in src['retakes'] if i0 in drop)}")
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
        lg = next((l for l in src.get("laughs", []) if b["e"] - 0.05 <= l[0] < cap), None) if phrases[pi].get("laugh", True) else None
        if lg: o1 = min(max(o1, lg[1] + TAIL), cap); print(f"  phrase {pi}: laugh kept ({lg[1] - lg[0]:.1f} s)")  # cut-video: laughs aren't silences
        if pieces and pieces[-1]["last"] + 1 == ws[0] and a["s"] - words[ws[0] - 1]["e"] <= MAXGAP:  # same take: one shared point
            pieces[-1]["o1"] = i0 = max(words[ws[0] - 1]["e"], a["s"] - LEAD); pieces[-1]["flow"] = True
        pieces.append({"phrase": pi, "i0": i0, "o1": o1, "last": ws[-1], "words": ws, "flow": False, **({"laugh": lg} if lg else {})})
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
        la = [[round(p["out0"] + p["laugh"][0] - p["i0"], 3), round(p["out0"] + p["laugh"][1] - p["i0"], 3)] for p in ps if p.get("laugh")]  # a kept laugh, output clock
        P.append({**ph, "i": pi, "start": ps[0]["out0"], "end": ps[-1]["out1"], "words": caption, "kw": kw, **({"laughAt": la} if la else {})})
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
    for ph in P:  # photos for collections, cards and chips: files or "clip.mov#2.5" (a frame of a clip) -> frames/img/*.jpg
        for o in [ph.get("insert"), ph.get("ui"), *(x for x in ph.get("pops") or [] if isinstance(x, dict))]:
            if isinstance(o, dict):
                if o.get("images"): o["images"] = [still(x) for x in o["images"]]
                if o.get("img"): o["img"] = still(o["img"])
    # frames: footage at 1.5x the output (cover fit, never upscaled); mattes at half that, grey (white = subject)
    Path("frames").mkdir(exist_ok=True)
    for k, s in enumerate(shots):
        s["i"] = k; s["out0"], s["out1"] = round(s["out0"], 6), round(s["out1"], 6)
        if s["kind"] == "cam":
            clip = src["clips"][s["cam"]]; sc = min(1.0, max(1.5 * Wd / clip["w"], 1.5 * Hd / clip["h"])); fw, fh = int(clip["w"] * sc) // 2 * 2, int(clip["h"] * sc) // 2 * 2
            s.update(n=max(1, round((s["out1"] - s["out0"]) * FPS)), frames=f"frames/s{k:02d}/", fw=fw, fh=fh)
            extract(clip["path"], s["i0"] + clip.get("offset", 0), s["n"], s["frames"], fw, fh); s["matte"] = False
            s["n"] = len(list(Path(s["frames"]).glob("[0-9]*.jpg")))  # fewer if the clip ends first: the last frame holds
            if clip.get("face"):  # face boxes on the shot's own clock, 0..1 of the frame: video.js keeps captions off the face
                t0 = s["i0"] + clip.get("offset", 0); s["face"] = [[round(b[0] - t0, 3)] + b[1:] for b in json.loads(Path(clip["face"]).read_text())["boxes"] if len(b) == 5 and -0.5 <= b[0] - t0 <= s["n"] / FPS + 0.5]
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
    tl = {"size": f"{Wd}x{Hd}", "fps": FPS, "duration": round(dur, 3), "preset": ed.get("preset", "creator"), "brand": ed.get("brand", {}), "bed": ed.get("bed", "auto"), "captions": ed.get("captions"),
          "shots": shots, "phrases": P, "words": [{"w": words[i]["w"], "t": out_t[i]} for i in sorted(out_t)]}
    Path("timeline.json").write_text(json.dumps(tl, indent=1)); Path("timeline.js").write_text("window.EDIT = " + json.dumps(tl) + ";\n")
    export(tl, pieces, src, Path.cwd().name)
    cut_s = sum(max(0, p["i0"] - (pieces[k - 1]["o1"] if k else 0)) for k, p in enumerate(pieces))  # a hook from later on jumps back: not a cut pause
    print(f"timeline.js: {len(shots)} shots, ASL {np.mean([s['out1'] - s['out0'] for s in shots]):.2f} s, {dur:.2f} s ({cut_s:.2f} s of pauses and fillers cut), dialogue.wav")


def tcstart(path):  # a file's start timecode in seconds (0 if it has none) and its frame rate
    j = json.loads(sh("ffprobe", "-v", "error", "-show_entries", "stream=codec_type,r_frame_rate:stream_tags=timecode:format_tags=timecode", "-of", "json", path, capture_output=True).stdout)
    v = next((s for s in j["streams"] if s["codec_type"] == "video"), None); fps = Fraction(v["r_frame_rate"]) if v else Fraction(FPS)
    tc = next((s["tags"]["timecode"] for s in j["streams"] if s.get("tags", {}).get("timecode")), None) or j.get("format", {}).get("tags", {}).get("timecode")
    if not tc: return Fraction(0), fps
    h, m, s, f = map(int, re.split("[:;.]", tc)); return h * 3600 + m * 60 + s + Fraction(f, round(fps)), fps


def export(tl, pieces, src, name):
    """The cut as an editor timeline, for a person to polish: edit.fcpxml (Final Cut Pro, DaVinci Resolve) and edit.edl (CMX 3600:
    Premiere, Resolve, Avid). V1 = the camera shots from the source clips; inserts and the end card are gaps named after them.
    A1 = the kept dialogue from the master audio. 30 fps, each source offset by its own start timecode, a marker per phrase.
    The EDL layout (reel AX, FROM CLIP NAME, record from 01:00:00:00) follows kajisho5/ffmpeg-skill's timeline export (MIT)."""
    from xml.sax.saxutils import quoteattr as qa
    Wd, Hd = tl["size"].split("x"); F = lambda t: Fraction(round(t * FPS), FPS); T = lambda x: f"{x.numerator}/{x.denominator}s" if x.denominator > 1 else f"{x.numerator}s"
    srcs = {}  # path -> (asset id, tc start, fps); the master audio is a1
    def asset(path):
        if path not in srcs: srcs[path] = (f"a{len(srcs) + 1}", *tcstart(path))
        return srcs[path]
    asset(src["audio"]); video, audio = [], []  # [rec_in, rec_out, path or None, src_in, label]
    for s in tl["shots"]:
        r0, r1 = F(s["out0"]), F(s["out1"])
        if s["kind"] != "cam": video.append([r0, r1, None, Fraction(0), f"{s['kind']}: {s['insert'].get('kind')} {s['insert'].get('title') or s['insert'].get('text') or ''}".strip()]); continue
        clip = src["clips"][s["cam"]]; _, tc, fps = asset(clip["path"])
        video.append([r0, r1, clip["path"], tc + Fraction(round((s["i0"] + clip.get("offset", 0)) * fps), 1) / fps, s["cam"]])
    for p in pieces: audio.append([F(p["out0"]), F(p["out1"]), src["audio"], F(p["i0"]), "dialogue"])
    dur = F(tl["duration"]); out = ['<?xml version="1.0" encoding="UTF-8"?>', "<!DOCTYPE fcpxml>", '<fcpxml version="1.10">', "  <resources>",
                                    f'    <format id="f0" frameDuration="1/{FPS}s" width="{Wd}" height="{Hd}"/>']
    for path, (aid, tc, fps) in srcs.items():
        pr = json.loads(sh("ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:stream_side_data=rotation:format=duration", "-of", "json", path, capture_output=True).stdout)
        v = next((x for x in pr["streams"] if x["codec_type"] == "video"), None); fmt = ""; has_a = any(x["codec_type"] == "audio" for x in pr["streams"])
        if v:
            w, h = (v["height"], v["width"]) if any(abs(int(d.get("rotation", 0))) % 180 == 90 for d in v.get("side_data_list", [])) else (v["width"], v["height"])
            out.append(f'    <format id="f{aid}" frameDuration="{T(1 / fps)}" width="{w}" height="{h}"/>'); fmt = f' format="f{aid}"'
        out += [f'    <asset id="{aid}" name={qa(Path(path).name)} start="{T(tc)}" duration="{T(F(float(pr["format"]["duration"])))}" hasVideo="{int(bool(v))}" hasAudio="{int(has_a)}"{fmt}'
                + (' audioSources="1" audioChannels="1" audioRate="48000"' if not v else "") + ">", f'      <media-rep kind="original-media" src={qa(Path(path).resolve().as_uri())}/>', "    </asset>"]
    out += ["  </resources>", "  <library>", f"    <event name={qa(name)}>", f"      <project name={qa(name)}>",
            f'        <sequence format="f0" duration="{T(dur)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">', "          <spine>"]
    for r0, r1, path, s0, label in video:  # each dialogue piece hangs off the V1 item it starts in, at that item's local time
        kids = [f'              <asset-clip ref="a1" lane="-1" offset="{T(s0 + a0 - r0)}" name="dialogue" start="{T(as0)}" duration="{T(a1 - a0)}"/>' for a0, a1, _, as0, _ in audio if r0 <= a0 < r1]
        kids += [f'              <marker start="{T(s0 + F(p["start"]) - r0)}" duration="1/{FPS}s" value={qa(p["say"])}/>' for p in tl["phrases"] if r0 <= F(p["start"]) < r1]
        tag, attrs = ("asset-clip", f'ref="{srcs[path][0]}" name={qa(label)} srcEnable="video"') if path else ("gap", f"name={qa(label)}")  # V1 is picture only: A1 carries the voice
        out += [f'            <{tag} {attrs} offset="{T(r0)}" start="{T(s0)}" duration="{T(r1 - r0)}">', *kids, f"            </{tag}>"]
    out += ["          </spine>", "        </sequence>", "      </project>", "    </event>", "  </library>", "</fcpxml>"]
    Path("edit.fcpxml").write_text("\n".join(out) + "\n")
    tc = lambda x: (lambda f: f"{f // (3600 * FPS):02d}:{f // (60 * FPS) % 60:02d}:{f // FPS % 60:02d}:{f % FPS:02d}")(round(x * FPS))
    ev = sorted([(r0, "V", path, s0, r1, label) for r0, r1, path, s0, label in video] + [(r0, "A", path, s0, r1, label) for r0, r1, path, s0, label in audio], key=lambda e: (e[0], e[1] == "A"))
    edl = [f"TITLE: {name}", "FCM: NON-DROP FRAME", ""]
    for n, (r0, ch, path, s0, r1, label) in enumerate(ev, 1):
        edl += [f"{n:03d}  {'AX' if path else 'BL':<8} {ch:<5} C        {tc(s0)} {tc(s0 + r1 - r0)} {tc(3600 + r0)} {tc(3600 + r1)}",
                f"* FROM CLIP NAME: {Path(path).name}" if path else f"* {label}", ""]
    Path("edit.edl").write_text("\n".join(edl))
    # read both back: every clip's offset, start and duration must be the cut's (timeline shots, dialogue pieces) to the frame
    import xml.etree.ElementTree as ET
    R, fr = (lambda v: Fraction(v[:-1]) if v else Fraction(0)), (lambda t: round(t * FPS))
    got_v, got_a = [], []
    for el in ET.parse("edit.fcpxml").getroot().find(".//spine"):  # a child's offset is on its parent's clock: parent start + (t - parent offset)
        o, st, du = R(el.get("offset")), R(el.get("start")), R(el.get("duration")); got_v.append((o * FPS, (o + du) * FPS, st))
        got_a += [((o + R(k.get("offset")) - st) * FPS, (o + R(k.get("offset")) - st + R(k.get("duration"))) * FPS, R(k.get("start")) * FPS) for k in el.findall("asset-clip")]
    want_v = [(fr(s["out0"]), fr(s["out1"]), v[3]) for s, v in zip(tl["shots"], video)]; want_a = [(fr(p["out0"]), fr(p["out1"]), fr(p["i0"])) for p in pieces]
    edl_t = lambda c: sum(int(x) * k for x, k in zip(c.split(":"), (3600 * FPS, 60 * FPS, FPS, 1)))
    got_e = sorted((edl_t(e[6]) - 3600 * FPS, edl_t(e[7]) - 3600 * FPS, e[2]) for e in (l.split() for l in edl) if e and e[0].isdigit())
    bad = [k for k, (g, w) in enumerate(zip(got_v, want_v)) if (g[0], g[1], g[2]) != w] + [f"a{k}" for k, (g, w) in enumerate(zip(sorted(got_a), sorted(want_a))) if g != w]
    if bad or len(got_v) != len(want_v) or len(got_a) != len(want_a) or got_e != sorted([(w[0], w[1], "V") for w in want_v] + [(w[0], w[1], "A") for w in want_a]):
        sys.exit(f"edit.fcpxml/edit.edl don't read back as the cut (items {bad}): a bug in export()")
    print(f"edit.fcpxml + edit.edl: {len(video)} picture events ({sum(1 for v in video if not v[2])} gaps for inserts), {len(audio)} dialogue pieces; read back, all match the cut to the frame")


def hooks():
    """edit.json "hooks": [say | phrase, ...] -> hooks/hN.mp4: that opening line, then the first "hookBody" (3) body phrases, built and
    rendered in hooks/hN/ (src, scripts and toolkits linked) for A/B tests of the hook. A hook line can come from anywhere in the
    recording; the body phrase that says the same line is left out, and lends the hook its cam and keyword. The idea is from krusemediallc/video-editor-agent's
    hook-variations (no licence, so no code from it: this is ours)."""
    ed = json.loads(Path("edit.json").read_text()); size, here = ed.get("size", "1080x1920"), Path.cwd()
    for k, h in enumerate(ed["hooks"], 1):
        h = h if isinstance(h, dict) else {"say": h}; same = next((p for p in ed["phrases"] if norm(p["say"]) == norm(h["say"])), {})
        body = [p for p in ed["phrases"] if norm(p["say"]) != norm(h["say"])][: ed.get("hookBody", 3)]
        hp = {"cam": "A", **{k: v for k, v in same.items() if k not in ("cut", "insert")}, **h, "hook": True}
        if "cam" not in h and hp["cam"] == body[0].get("cam"):  # a different framing from the first body shot, or the join is a jump cut
            hp["cam"] = next((c for c in json.loads(Path("src.json").read_text())["clips"] if c != body[0].get("cam")), hp["cam"])
        d = here / "hooks" / f"h{k}"; d.mkdir(parents=True, exist_ok=True)
        for f in [here / "src", here / "src.json", *here.glob("*.py"), *(f for f in here.glob("*.js") if f.name != "timeline.js")]:
            if not (d / f.name).exists(): (d / f.name).symlink_to(f)
        for f in ("index.html", "render.mjs"): (d / f).write_bytes((here / f).read_bytes())  # render.mjs loads index.html from its own folder
        (d / "edit.json").write_text(json.dumps({**ed, "phrases": [hp] + body, "end": None, "hooks": None}, indent=1))
        print(f"--- hook {k}: {hp['say']!r}")
        for cmd in (["uv", "run", "edit.py", "build"], ["node", "render.mjs", "--cues"], ["uv", "run", "sfx.py"], ["node", "render.mjs", "--size", size, "--out", f"../h{k}.mp4"]):
            sh(*cmd, cwd=d)
    print(f"hooks/h1..h{len(ed['hooks'])}.mp4")


def extract(path, t0, n, d, w, h, prefix=""):  # n frames from t0, cached by a key file
    d = Path(d); d.mkdir(parents=True, exist_ok=True); key = d / f".key{prefix}"; k = json.dumps([str(path), round(t0, 4), n, w, h])
    if key.exists() and key.read_text() == k: return
    for f in d.glob(f"{prefix}[0-9]*.jpg"): f.unlink()
    sh("ffmpeg", "-loglevel", "error", "-y", "-ss", f"{max(0, t0):.4f}", "-i", path, "-frames:v", n, "-vf", f"fps={FPS},scale={w}:{h}" + (",format=gray" if prefix else ""), "-q:v", 3, d / f"{prefix}%04d.jpg")
    key.write_text(k)


def still(spec):  # a photo, or "clip.mov#2.5" = the frame at 2.5 s of a clip (HDR tone-mapped first, as ingest does) -> a JPEG <= 1400 px
    import hashlib
    from ingest import conform, probe
    path, _, at = str(spec).partition("#"); out = Path("frames/img") / (hashlib.md5(str(spec).encode()).hexdigest()[:10] + ".jpg")
    if not Path(path).exists(): sys.exit(f"image {spec!r}: no such file")
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        try: pr = probe(path)
        except (KeyError, ValueError, StopIteration): pr = {"hdr": False}  # a still has no duration to probe
        if pr["hdr"]: path = conform(path, pr, Path("src") / f"{Path(path).stem}.sdr.mov")
        sh("ffmpeg", "-loglevel", "error", "-y", *(["-ss", at] if at else []), "-i", path, "-frames:v", 1, "-vf", "scale=1400:1400:force_original_aspect_ratio=decrease", "-q:v", 3, out)
    return str(out)


def matte(s):  # real footage: MediaPipe on the shot's frames (matte.py runs in its own env); False if it can't
    ok = subprocess.run(["uv", "run", "matte.py", s["frames"]]).returncode == 0 and any(Path(s["frames"]).glob("m0001.jpg"))
    if not ok: print(f"  shot {s['i']}: no matte, its keyword goes in front of the subject")
    return ok


def load(path):
    return np.frombuffer(sh("ffmpeg", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", 1, "-ar", SR, "-", capture_output=True).stdout, np.float32).astype(float)


def write(path, x):
    with wave.open(path, "wb") as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


UNITS = {w: i for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split())}
TENS, SCALE = {w: 10 * i for i, w in enumerate("_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()) if i > 1}, {"thousand": 1000, "million": 10 ** 6}


def numerals(ws):  # Whisper writes numbers as digits ("forty" -> "40", "twelve thousand" -> "12", "000"): compare numbers as numbers
    out, tot, cur, num = [], 0, 0, False
    for w in ws + [""]:
        if w in UNITS or w in TENS or num and (w == "hundred" or w in SCALE):
            if w == "hundred": cur *= 100
            elif w in SCALE: tot += cur * SCALE[w]; cur = 0
            else: cur += UNITS.get(w, TENS.get(w, 0))
            num = True; continue
        if num: out.append(str(tot + cur)); tot, cur, num = 0, 0, False
        if w.isdigit() and out and out[-1].isdigit() and len(w) == 3: out[-1] += w  # "12" "000" -> "12000"
        elif w: out.append(w)
    return out


def review():
    sys.path.insert(0, "."); import sfx
    from ingest import transcribe
    tl, cues = json.loads(Path("timeline.json").read_text()), json.loads(Path("cues.json").read_text())
    rows = sorted(([] if cues.get("sfx") in (None, "none") else cues["sfx"]) + sfx.autocue(cues.get("events") or []), key=lambda r: r[0])
    cuts = [s["out0"] for s in tl["shots"][1:]]; Path("review").mkdir(exist_ok=True); bad = 0
    for t in cuts:  # whoosh peaks lead by up to 0.1 s; booms, flashes and swell ends sit on the cut
        near = [r[1] for r in rows if -0.12 <= r[0] - t <= 0.05]
        if not near: bad += 1; print(f"  cut {t:6.2f}: NO SOUND")
    subs = [r for r in rows if sfx.FAMILY.get(r[1]) == "sub" and r[1] != "thump" and "word" not in (r[3:4] or [{}])[0]]  # thumps lead a giant word on purpose; a word's own sound is placed on purpose
    off = [r for r in subs if min(abs(r[0] - t) for t in cuts) > 1.01 / FPS]
    for r in off: print(f"  {r[1]} at {r[0]:.2f} is not on a cut")
    print(f"cuts: {len(cuts)}, {len(cuts) - bad} with a sound; subs: {len(subs)}, {len(subs) - len(off)} on a cut")
    # masked? each cue against a mix without the SFX: what its loudest 50 ms adds (hassancs91/claude-youtube-editor's /suggest-sfx,
    # MIT: measure audibility, don't hope). Air sits 14 dB under the voice by design, so a passby in a cut's gap adds only ~1-2 dB;
    # under 1 dB (0.5 for micro) it's masked: a keyword suck_in under unbroken speech adds ~0 at any gain
    base = sfx.render({**cues, "sfx": [r for r in rows if sfx.FAMILY.get(r[1]) is None], "events": []}, "review/nosfx.wav").mean(0)
    db = lambda x: 10 * np.log10((x[: len(x) // 2400 * 2400].reshape(-1, 2400) ** 2).mean(1) + 1e-10); gain = db(sfx.load("audio.wav").mean(0)) - db(base); quiet = []
    for r in rows:
        if sfx.FAMILY.get(r[1]) in (None, "foley") or r[1] in ("key_tap", "tick"): continue
        k = int(r[0] * SR / 2400); add = gain[max(0, k - 6): k + 6].max()
        if add < (0.5 if sfx.FAMILY[r[1]] == "micro" else 1): quiet.append(f"{r[1]} {r[0]:.2f} (+{add:.1f} dB)")
    print(f"masked: {len(quiet)} cues add under 1 dB to the voice and bed" + (f": {', '.join(quiet)}" if quiet else ""))
    Path("review/times.txt").write_text(",".join(f"{max(0, t + k / FPS):.3f}" for t in cuts for k in (-2, -1, 0, 1, 2)))
    mix = sfx.load("audio.wav").mean(0); sfx.plot(mix, [(t, "|") for t in cuts] + [(r[0], r[1]) for r in rows if r[1] not in ("key_tap",)], "review/spectrogram.png")
    said = numerals([norm(w) for p in tl["phrases"] for w in p["say"].split()]); heard = numerals([norm(w["w"]) for w in transcribe("audio.wav")])
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
    if "--selftest" in sys.argv:  # the number matching review uses
        assert numerals("it got twelve thousand views".split()) == "it got 12000 views".split() == numerals("it got 12 000 views".split())
        assert numerals("rule one".split()) == ["rule", "1"] and numerals("forty two projects".split()) == ["42", "projects"] and numerals(["one", "hundred"]) == ["100"]
        sys.exit(print("ok"))
    {"build": build, "review": review, "hooks": hooks, "pov": pov}.get(sys.argv[1] if len(sys.argv) > 1 else "", lambda: sys.exit(__doc__))()
