# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["numpy", "pillow", "torch", "open_clip_torch", "faster-whisper"]
# ///
"""A local, searchable index of a footage folder: find shots by what's in them or what's said, with no cloud and no limits.
Built from open models (OpenCLIP image-text embeddings, faster-whisper), not from any app's code.

    uv run library.py index <folder> [--db library.db] [--every 1.0] [--speech]
    uv run library.py search "riders on horses with a cable car" [--db library.db] [--k 12] [--out hits.jpg]
    uv run library.py said "launch" [--db library.db]
    uv run library.py stats [--db library.db]

index samples one frame every `--every` seconds from each usable clip (footage.py's rules: no Live Photo videos, edited
copies, clips under 3.5 s or repeated names), embeds it with OpenCLIP ViT-B-32 (laion2b, ~600 MB, downloaded once), and
stores it in SQLite next to the folder's clip list. --speech also transcribes each clip's audio with faster-whisper (base,
word timestamps). Re-running only indexes new or changed files. search embeds the text, ranks every frame by cosine
similarity, keeps the best moment per clip, prints clip + time + score, and writes a contact sheet of the hits; feed the
time straight into footage.py window/motion. said finds words in the transcripts.
Frames are pulled from keyframes and not tone-mapped: HDR frames look pale, which doesn't matter to the embedding.
"""
import json, sqlite3, subprocess, sys, time
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from footage import cmd_list as _list_clips, probe  # same usable-clip rules

MODEL, PRETRAINED = "ViT-B-32", "laion2b_s34b_b79k"
_M = {}


def model():
    if not _M:
        import open_clip, torch
        dev = "mps" if torch.backends.mps.is_available() else "cpu"
        m, _, pre = open_clip.create_model_and_transforms(MODEL, pretrained=PRETRAINED, device=dev); m.eval()
        _M.update(m=m, pre=pre, tok=open_clip.get_tokenizer(MODEL), dev=dev, torch=torch)
    return _M


def db(path):
    c = sqlite3.connect(path)
    c.executescript("""create table if not exists clips(id integer primary key, path text unique, size int, mtime real, dur real,
                         w int, h int, date text, gps text);
                       create table if not exists frames(clip int, t real, emb blob);
                       create table if not exists words(clip int, t0 real, t1 real, w text);
                       create index if not exists f_clip on frames(clip); create index if not exists w_w on words(w);""")
    return c


def frames(path, every, w=224):  # (t, PIL image) at roughly every `every` s, from keyframes (fast on 4K HEVC)
    raw = subprocess.run(["ffmpeg", "-v", "error", "-skip_frame", "nokey", "-i", str(path), "-vf",
                          f"fps=1/{every},scale={w}:{w}:force_original_aspect_ratio=increase,crop={w}:{w},format=rgb24",
                          "-f", "rawvideo", "-"], capture_output=True).stdout
    a = np.frombuffer(raw, np.uint8).reshape(-1, w, w, 3)
    return [((k + 0.5) * every, Image.fromarray(x)) for k, x in enumerate(a)]


def embed_images(ims):
    M = model(); t = M["torch"]
    with t.no_grad():
        x = t.stack([M["pre"](im) for im in ims]).to(M["dev"]); e = M["m"].encode_image(x)
        return (e / e.norm(dim=-1, keepdim=True)).float().cpu().numpy()


def embed_text(s):
    M = model(); t = M["torch"]
    with t.no_grad():
        e = M["m"].encode_text(M["tok"]([s]).to(M["dev"]))
        return (e / e.norm(dim=-1, keepdim=True)).float().cpu().numpy()[0]


def transcribe(path):
    from faster_whisper import WhisperModel
    if "w" not in _M: _M["w"] = WhisperModel("base", device="cpu", compute_type="int8")
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
    if len(pcm) < 32000: return []
    segs, _ = _M["w"].transcribe(np.frombuffer(pcm, "<i2").astype(np.float32) / 32768, word_timestamps=True, vad_filter=True)
    return [(w.start, w.end, w.word.strip()) for s in segs for w in (s.words or [])]


def cmd_index(folder, db_path="library.db", every="1.0", speech=False):
    every = float(every); c = db(db_path); folder = Path(folder).expanduser()
    lst = Path(db_path).with_suffix(".clips.json"); _list_clips(folder, out=str(lst)); clips = json.load(open(lst))
    t0 = time.time(); done = 0
    for k, cl in enumerate(clips):
        p = Path(cl["path"]); st = p.stat(); row = c.execute("select id, size, mtime from clips where path=?", (str(p),)).fetchone()
        if row and row[1] == st.st_size and row[2] == st.st_mtime: continue
        if row: c.execute("delete from frames where clip=?", (row[0],)); c.execute("delete from words where clip=?", (row[0],)); c.execute("delete from clips where id=?", (row[0],))
        cid = c.execute("insert into clips(path,size,mtime,dur,w,h,date,gps) values(?,?,?,?,?,?,?,?)",
                        (str(p), st.st_size, st.st_mtime, cl["dur"], cl["w"], cl["h"], cl["date"], cl["gps"])).lastrowid
        fs = frames(p, every)
        for i in range(0, len(fs), 64):
            ts, ims = zip(*fs[i:i + 64]); E = embed_images(list(ims))
            c.executemany("insert into frames values(?,?,?)", [(cid, t, e.astype(np.float16).tobytes()) for t, e in zip(ts, E)])
        if speech: c.executemany("insert into words values(?,?,?,?)", [(cid, a, b, w.lower()) for a, b, w in transcribe(p)])
        c.commit(); done += 1
        print(f"  [{k + 1}/{len(clips)}] {p.name}: {len(fs)} frames{' + speech' if speech else ''}  ({time.time() - t0:.0f} s)", flush=True)
    n = c.execute("select count(*) from frames").fetchone()[0]
    print(f"{db_path}: {done} clips indexed now, {c.execute('select count(*) from clips').fetchone()[0]} in all, {n} frames")


def cmd_search(query, db_path="library.db", k="12", out="hits.jpg"):
    k = int(k); c = db(db_path); rows = c.execute("select clip, t, emb from frames").fetchall()
    if not rows: sys.exit("empty index: run library.py index <folder> first")
    E = np.stack([np.frombuffer(r[2], np.float16) for r in rows]).astype(np.float32); s = E @ embed_text(query)
    best = {}
    for i in np.argsort(-s):  # the best moment per clip
        cid = rows[i][0]
        if cid not in best: best[cid] = (float(s[i]), rows[i][1])
        if len(best) >= k: break
    paths = dict(c.execute("select id, path from clips").fetchall()); tiles = []
    print(f'"{query}"')
    for r, (cid, (sc, t)) in enumerate(sorted(best.items(), key=lambda x: -x[1][0])):
        p = paths[cid]; print(f"{r + 1:2d}. {sc:.3f}  {t:7.1f}s  {p}")
        raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", p, "-frames:v", "1", "-vf", "scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,format=rgb24",
                              "-f", "rawvideo", "-"], capture_output=True).stdout
        im = Image.frombytes("RGB", (320, 180), raw) if len(raw) == 320 * 180 * 3 else Image.new("RGB", (320, 180))
        ImageDraw.Draw(im).text((4, 4), f"{r + 1}  {Path(p).name} {t:.0f}s", fill="yellow"); tiles.append(im)
    S = Image.new("RGB", (320 * 4, 180 * ((len(tiles) + 3) // 4)))
    for i, im in enumerate(tiles): S.paste(im, ((i % 4) * 320, (i // 4) * 180))
    S.save(out, quality=85); print(f"-> {out}")


def cmd_said(words, db_path="library.db"):
    c = db(db_path); q = [w.lower().strip(".,!?") for w in words.split()]
    rows = c.execute("select clips.path, words.t0, words.w from words join clips on clips.id = words.clip where words.w like ?", (f"%{q[0]}%",)).fetchall()
    for p, t0, w in rows[:40]: print(f"{t0:7.1f}s  {p}")
    print(f"{len(rows)} hits for '{q[0]}'" + (" (first word only)" if len(q) > 1 else ""))


def cmd_stats(db_path="library.db"):
    c = db(db_path)
    print({t: c.execute(f"select count(*) from {t}").fetchone()[0] for t in ("clips", "frames", "words")})


if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    cmd, a = sys.argv[1], sys.argv[2:]; kw = {}
    for flag in ("--db", "--every", "--k", "--out"):
        if flag in a: i = a.index(flag); kw[flag[2:].replace("db", "db_path")] = a[i + 1]; del a[i:i + 2]
    if "--speech" in a: a.remove("--speech"); kw["speech"] = True
    {"index": cmd_index, "search": cmd_search, "said": cmd_said, "stats": cmd_stats}[cmd](*a, **kw)
