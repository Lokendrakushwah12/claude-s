# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["numpy", "pillow", "torch", "open_clip_torch", "faster-whisper", "insightface", "onnxruntime"]
# ///
"""A local, searchable index of a footage folder: find shots by what's in them or what's said, with no cloud and no limits.
Built from open models (OpenCLIP image-text embeddings, faster-whisper), not from any app's code.

    uv run library.py index <folder> [--db library.db] [--every 1.0] [--speech]
    uv run library.py search "riders on horses with a cable car" [--db library.db] [--k 12] [--out hits.jpg]
    uv run library.py said "launch" [--db library.db]
    uv run library.py stats [--db library.db]
    uv run library.py faces [--db library.db] [--every 2]   detect + embed faces, group them into people, a sheet per person
    uv run library.py people [--db library.db]              list the groups (id, name, how many clips, sheet)
    uv run library.py name <person id> <name> [--db]        name a group (merge: give two groups the same name)
    uv run library.py person <name or id> [--db]            every clip and moment that person appears in
    uv run library.py review [--db]                          one sheet of every group, labelled, to check them at a glance
    uv run library.py suggest [--db]                         group pairs that are probably one person (most similar first)
    uv run library.py merge <keep id> <other id> [--db]      fold one group into another

index samples one frame every `--every` seconds from each usable clip (footage.py's rules: no Live Photo videos, edited
copies, clips under 3.5 s or repeated names), embeds it with OpenCLIP ViT-B-32 (laion2b, ~600 MB, downloaded once), and
stores it in SQLite next to the folder's clip list. --speech also transcribes each clip's audio with faster-whisper (base,
word timestamps). Re-running only indexes new or changed files. search embeds the text, ranks every frame by cosine
similarity, keeps the best moment per clip, prints clip + time + score, and writes a contact sheet of the hits; feed the
time straight into footage.py window/motion. said finds words in the transcripts.
faces uses InsightFace (buffalo_l: RetinaFace detection + ArcFace embeddings, ~280 MB on first use). Its pretrained models are
licensed for NON-COMMERCIAL research only: fine for sorting your own footage, check the licence before any commercial use.
Faces scoring >= 0.75 are grouped by cosine similarity (>= 0.5 to a group's mean joins it), so one person can split into two groups (profile
vs front, sunglasses): name both the same and they merge.
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
                       create table if not exists faces(clip int, t real, x real, y real, w real, h real, score real, emb blob, person int);
                       create table if not exists people(id integer primary key, name text, n int, sheet text);
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
        if row and row[1] == st.st_size and row[2] == st.st_mtime:
            if speech and not c.execute("select 1 from words where clip=? limit 1", (row[0],)).fetchone():  # speech added later
                ws = transcribe(p); c.executemany("insert into words values(?,?,?,?)", [(row[0], a, b, w.lower()) for a, b, w in ws]); c.commit()
                print(f"  [{k + 1}/{len(clips)}] {p.name}: {len(ws)} words", flush=True)
            continue
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


def face_app():
    if "fa" not in _M:
        from insightface.app import FaceAnalysis
        a = FaceAnalysis(name="buffalo_l", allowed_modules=["detection", "recognition"], providers=["CPUExecutionProvider"]); a.prepare(ctx_id=-1, det_size=(640, 640))
        _M["fa"] = a
    return _M["fa"]


def cmd_faces(db_path="library.db", every="2"):
    every = float(every); c = db(db_path); app = face_app(); clips = c.execute("select id, path from clips").fetchall()
    done = {r[0] for r in c.execute("select distinct clip from faces")}; t0 = time.time()
    for k, (cid, p) in enumerate(clips):
        if cid in done: continue
        raw = subprocess.run(["ffmpeg", "-v", "error", "-skip_frame", "nokey", "-i", p, "-vf", f"fps=1/{every},scale=960:-2,format=bgr24", "-f", "rawvideo", "-"], capture_output=True).stdout
        pr = probe(p); w = 960; h = round(pr["h"] * w / max(1, pr["w"]) / 2) * 2
        if not raw or len(raw) % (w * h * 3): continue
        rows = []
        for i, fr in enumerate(np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)):
            for f in app.get(np.ascontiguousarray(fr)):
                x0, y0, x1, y1 = f.bbox
                if f.det_score < 0.6 or (x1 - x0) < 36: continue  # small or unsure faces group badly
                e = f.normed_embedding.astype(np.float32)
                rows.append((cid, (i + 0.5) * every, float(x0 / w), float(y0 / h), float((x1 - x0) / w), float((y1 - y0) / h), float(f.det_score), e.tobytes(), None))  # plain floats: numpy float32 lands in SQLite as a blob
        c.executemany("insert into faces values(?,?,?,?,?,?,?,?,?)", rows or [(cid, -1, 0, 0, 0, 0, 0, b"", None)]); c.commit()
        print(f"  [{k + 1}/{len(clips)}] {Path(p).name}: {len(rows)} faces  ({time.time() - t0:.0f} s)", flush=True)
    group(c, Path(db_path).with_suffix(".people"))


def group(c, outdir, th=0.5, min_score=0.75):  # tuned on the Kashmir folder: 0.45 / 0.6 mixed friends and kept flower/sky false faces  # greedy clustering on cosine similarity to each group's running mean; biggest groups first
    num = lambda v: float(np.frombuffer(v, np.float32)[0]) if isinstance(v, bytes) else float(v)  # rows saved before the float fix
    rows = [(r[0], r[1], r[2], *map(num, r[3:7]), r[7]) for r in c.execute("select rowid, clip, t, x, y, w, h, emb from faces where t >= 0 and score >= ?", (min_score,))]
    if not rows: print("no faces"); return
    E = np.stack([np.frombuffer(r[7], np.float32) for r in rows]); order = np.argsort(-np.array([r[6] for r in rows]))  # biggest faces seed groups
    means, members = [], []
    for i in order:
        if means:
            sims = np.array(means) @ E[i]; j = int(sims.argmax())
            if sims[j] >= th:
                members[j].append(i); m = E[members[j]].mean(0); means[j] = m / np.linalg.norm(m); continue
        means.append(E[i].copy()); members.append([i])
    names = dict(c.execute("select id, name from people").fetchall()); c.execute("delete from people")
    outdir.mkdir(exist_ok=True); paths = dict(c.execute("select id, path from clips").fetchall()); kept = 0
    for gi, mem in enumerate(sorted(members, key=len, reverse=True)):
        clips_in = {rows[i][1] for i in mem}
        if len(mem) < 3 or len(clips_in) < 2: pid = None  # one-off faces (passers-by) stay ungrouped
        else:
            kept += 1; pid = kept; sheet = outdir / f"person_{pid:02d}.jpg"; tiles = []
            for i in sorted(mem, key=lambda i: -rows[i][5])[:10]:
                _, cid, t, x, y, w, h, _ = rows[i]; pr = probe(paths[cid])
                raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.2f}", "-i", paths[cid], "-frames:v", "1", "-vf",
                                      f"crop=iw*{w * 1.6:.4f}:ih*{h * 1.6:.4f}:iw*{max(0, x - w * 0.3):.4f}:ih*{max(0, y - h * 0.3):.4f},scale=120:120,format=rgb24",
                                      "-f", "rawvideo", "-"], capture_output=True).stdout
                if len(raw) == 120 * 120 * 3: tiles.append(Image.frombytes("RGB", (120, 120), raw))
            S = Image.new("RGB", (120 * max(1, len(tiles)), 120))
            for k, im in enumerate(tiles): S.paste(im, (120 * k, 0))
            S.save(sheet, quality=85)
            c.execute("insert into people(id, name, n, sheet) values(?,?,?,?)", (pid, names.get(pid), len(clips_in), str(sheet)))
        c.executemany("update faces set person=? where rowid=?", [(pid, rows[i][0]) for i in mem])
    c.commit(); print(f"{len(rows)} faces -> {kept} people (in 2+ clips, 3+ sightings); sheets in {outdir}/"); cmd_people(db=c)


def cmd_people(db_path="library.db", db=None):
    c = db or globals()["db"](db_path)
    for pid, name, n, sheet in c.execute("select id, name, n, sheet from people order by n desc"): print(f"  {pid:3d}  {name or '-':12s}  {n:3d} clips  {sheet}")


def cmd_name(pid, name, db_path="library.db"):
    c = db(db_path); c.execute("update people set name=? where id=?", (name, int(pid))); c.commit(); print(f"person {pid} = {name}")


def cmd_person(who, db_path="library.db"):
    c = db(db_path); ids = [r[0] for r in c.execute("select id from people where name=? or id=?", (who, who if str(who).isdigit() else -1))]
    if not ids: sys.exit(f"no person {who!r}: see library.py people")
    q = f"select clips.path, min(faces.t), max(faces.t), count(*) from faces join clips on clips.id = faces.clip where faces.person in ({','.join('?' * len(ids))}) group by faces.clip order by count(*) desc"
    for p, a, b, n in c.execute(q, ids): print(f"  {n:3d} sightings  {a:6.1f}-{b:6.1f}s  {p}")


def cmd_suggest(db_path="library.db", th="0.5"):
    # pair score = the mean of the 10 best face-to-face matches between two groups: one person split by a turban or sunglasses
    # still has some near-identical faces, while two different people only meet in their averages (a mean-of-means test ranked
    # two different friends first, 0.61, on the Kashmir folder)
    c = db(db_path); G = {}
    for pid, in c.execute("select id from people"):
        E = [np.frombuffer(r[0], np.float32) for r in c.execute("select emb from faces where person=?", (pid,)) if r[0]]
        if E: G[pid] = np.stack(E)
    ids = sorted(G); pairs = []
    for a in range(len(ids)):
        for b in range(a + 1, len(ids)):
            S = (G[ids[a]] @ G[ids[b]].T).ravel(); pairs.append((float(np.sort(S)[-10:].mean()), ids[a], ids[b]))
    names = dict(c.execute("select id, name from people").fetchall())
    for sim, a, b in sorted(pairs, reverse=True):
        if sim < float(th): break
        print(f"  {sim:.2f}  {a} ({names.get(a) or '-'}) + {b} ({names.get(b) or '-'})   -> library.py merge {a} {b}")
    print("(check both groups on the review sheet before merging)")


def cmd_merge(keep, other, db_path="library.db"):
    c = db(db_path); keep, other = int(keep), int(other)
    c.execute("update faces set person=? where person=?", (keep, other))
    n = c.execute("select count(distinct clip) from faces where person=?", (keep,)).fetchone()[0]
    c.execute("update people set n=? where id=?", (n, keep)); c.execute("delete from people where id=?", (other,)); c.commit()
    print(f"person {other} merged into {keep}: {n} clips")


def cmd_review(db_path="library.db"):
    c = db(db_path); rows = c.execute("select id, name, n, sheet from people order by n desc").fetchall()
    if not rows: sys.exit("no people: run library.py faces first")
    S = Image.new("RGB", (1300, 130 * len(rows)), "black"); D = ImageDraw.Draw(S)
    for k, (pid, name, n, sheet) in enumerate(rows):
        D.text((6, 130 * k + 50), f"#{pid}\n{name or '-'}\n{n} clips", fill="yellow")
        try: S.paste(Image.open(sheet), (100, 130 * k + 5))
        except Exception: pass
    out = Path(db_path).with_suffix(".people") / "review.jpg"; S.save(out, quality=85); print(out)


def cmd_stats(db_path="library.db"):
    c = db(db_path)
    print({t: c.execute(f"select count(*) from {t}").fetchone()[0] for t in ("clips", "frames", "words")})


if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    cmd, a = sys.argv[1], sys.argv[2:]; kw = {}
    for flag in ("--db", "--every", "--k", "--out"):
        if flag in a: i = a.index(flag); kw[flag[2:].replace("db", "db_path")] = a[i + 1]; del a[i:i + 2]
    if "--speech" in a: a.remove("--speech"); kw["speech"] = True
    {"index": cmd_index, "search": cmd_search, "said": cmd_said, "stats": cmd_stats, "faces": cmd_faces, "people": cmd_people,
     "name": cmd_name, "person": cmd_person, "review": cmd_review, "suggest": cmd_suggest, "merge": cmd_merge}[cmd](*a, **kw)
