# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow", "numpy", "scipy"]
# ///
"""Real-photo cut-out stickers: search Openverse for openly licensed photos, lift the subject, trim to a transparent PNG.
  uv run stickers.py "iced coffee" "instant camera" --preview      contact sheet of 6 candidates per query -> <out>/preview-<slug>.jpg
  uv run stickers.py "iced coffee" "instant camera" --pick instant-camera=3   lift candidate 0 (or the picked one) -> <out>/<slug>.png
  uv run stickers.py --file me.jpg --file mug.jpg                   your own photos: lift + trim only, no search, no credit
  uv run stickers.py --batch ~/Pics --out ~/Pics/clean --report     a folder (or files) of your own: alpha / colour key / Vision, cleaned edges
Options: --out assets/stickers  --max 900 (longest side, px)  --rembg (fallback when Vision finds no subject; downloads ~170 MB).
Licences: CC0, public domain and CC BY only, each credited in <out>/CREDITS.md (CC BY needs an on-screen or caption credit).
Never Pinterest / Google Images: those are other people's photos with no licence to reuse.
Search logic follows story-video/template/fetch_assets.py (Unsplash photos mirrored on Wikimedia first: CC0, clean subjects)."""
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageOps
from scipy import ndimage as nd

UA = "claude-s-stickers/0.1 (+https://github.com/Lokendrakushwah12/claude-s)"
N = 6  # candidates per query
HERE = Path(__file__).resolve().parent
CACHE = Path.home() / ".cache" / "claude-s"


def _query(params):
    q = urllib.parse.urlencode({"license": "cc0,pdm,by", "extension": "jpg,png", "page_size": N, "mature": "false", **params})
    req = urllib.request.Request(f"https://api.openverse.org/v1/images/?{q}", headers={"User-Agent": UA})
    for k in range(3):  # Openverse times out now and then
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)["results"]
        except OSError:
            if k == 2:
                raise


def search(query):
    hits = [r for r in _query({"q": f"{query} unsplash", "source": "wikimedia"}) if "unsplash" in (r.get("title") or "").lower()]
    return (hits + _query({"q": query}))[:N]


def get(url, dest):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        dest.write_bytes(r.read())


def thumb(url, w=500):
    """Wikimedia's own thumbnail at a standard width (others 400); the originals are 5-15 MB."""
    head, name = url.rsplit("/", 1)
    return f"{head.replace('/commons/', '/commons/thumb/')}/{name}/{w}px-{name}" if "upload.wikimedia.org/wikipedia/commons/" in url else None


def fetch(urls, dest):
    for u in filter(None, urls):  # Openverse's thumbnail proxy 424s now and then
        try:
            get(u, dest)
            Image.open(dest).verify()
            return True
        except Exception:
            pass
    return False


def credit(slug, r):
    lic = r["license"].upper() if r["license"] in ("cc0", "pdm") else f"CC {r['license'].upper()} {r.get('license_version', '')}".strip()
    return f"- `{slug}.png`: \"{r.get('title') or 'untitled'}\" by {r.get('creator') or 'unknown'}, {lic}. {r.get('foreign_landing_url')}\n"


def lifter():
    """Compile lift.swift once into ~/.cache/claude-s (swift-running it each time costs ~5 s)."""
    if sys.platform != "darwin" or not shutil.which("swiftc"):
        return None
    exe, src = CACHE / "lift", HERE / "lift.swift"
    if not exe.exists() or exe.stat().st_mtime < src.stat().st_mtime:
        CACHE.mkdir(parents=True, exist_ok=True)
        if subprocess.run(["swiftc", "-O", str(src), "-o", str(exe)]).returncode:
            return None
    return exe


def lift(src, dest, mx, rembg=False):
    """Subject -> transparent PNG trimmed to its bounding box plus a 4% margin, longest side <= mx."""
    with tempfile.TemporaryDirectory() as td:
        inp, raw = Path(td) / "in.png", Path(td) / "out.png"
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        im.thumbnail((2400, 2400))
        im.save(inp)
        exe, ok = lifter(), False
        if exe:
            p = subprocess.run([str(exe), str(inp), str(raw)], capture_output=True, text=True)
            ok = p.returncode == 0
            if not ok:
                print(f"  vision: {p.stderr.strip()}")
        else:
            print("  vision: needs macOS 14+ with swiftc (xcode-select --install)")
        if not ok and rembg:
            print("  falling back to rembg (MIT; first run downloads its ~170 MB u2net model)")
            ok = subprocess.run(["uvx", "--from", "rembg[cpu,cli]", "rembg", "i", str(inp), str(raw)]).returncode == 0
        if not ok:
            print(f"  no cut-out for {src}; try another candidate" + ("" if rembg else ", or --rembg"))
            return False
        out = Image.open(raw).convert("RGBA")
    a = out.getchannel("A").point(lambda v: 255 if v > 8 else 0)
    box = a.getbbox()
    if not box:
        print(f"  empty mask for {src}")
        return False
    m = int(0.04 * max(box[2] - box[0], box[3] - box[1]))
    out = out.crop((max(0, box[0] - m), max(0, box[1] - m), min(out.width, box[2] + m), min(out.height, box[3] + m)))
    out.thumbnail((mx, mx))
    out.save(dest, optimize=True)
    print(f"  -> {dest} {out.width}x{out.height}, {dest.stat().st_size // 1024} KB")
    return True


EXTS = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
FLAT, TOL = 6.0, 18.0  # border-ring RGB std that counts as a plain background; RGB distance the key floods across


def load(f):
    if f.suffix.lower() != ".heic":
        return ImageOps.exif_transpose(Image.open(f))
    with tempfile.TemporaryDirectory() as td:  # PIL has no HEIC; sips does
        t = Path(td) / "h.png"
        subprocess.run(["sips", "-s", "format", "png", str(f), "--out", str(t)], capture_output=True, check=True)
        im = Image.open(t)
        im.load()
        return im


def vision(im):
    exe = lifter()
    if not exe:
        return None
    with tempfile.TemporaryDirectory() as td:
        i, o = Path(td) / "i.png", Path(td) / "o.png"
        im.convert("RGB").save(i)
        if subprocess.run([str(exe), str(i), str(o)], capture_output=True).returncode:
            return None
        return np.asarray(Image.open(o).getchannel("A").resize(im.size)) > 127


def drop_small(m, frac):
    lab, n = nd.label(m)
    if not n:
        return m
    return np.isin(lab, 1 + np.flatnonzero(nd.sum(m, lab, range(1, n + 1)) >= frac * m.size))


def clean_one(f, dest, mx, method="auto"):
    """-> [file, method, kept %, warnings]. alpha (>2 % transparent) > colour key (plain border) > Vision; whichever keeps 3-97 % wins."""
    try:
        im = load(f).convert("RGBA")
    except Exception as e:
        return [f.name, "error", 0, str(e)[:80]]
    im.thumbnail((2000, 2000))
    px = np.asarray(im)
    rgb, A, warn = px[..., :3].astype(np.float32), px[..., 3], []
    ring = np.concatenate([x.reshape(-1, 3) for x in (rgb[:3], rgb[-3:], rgb[:, :3], rgb[:, -3:])])
    key = np.median(ring, 0)

    def keyed():  # flood the key colour in from the border only, so the same colour inside the subject stays
        lab, _ = nd.label(np.linalg.norm(rgb - key, axis=2) < TOL)
        edge = np.setdiff1d(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]], [0])
        return ~np.isin(lab, edge)

    tries = ["alpha"] if method == "auto" and (A < 250).mean() > 0.02 else []
    tries += ["key", "vision"] if method == "key" or (method == "auto" and ring.std(0).max() < FLAT) else ["vision", "key"]
    for how in tries:
        m = {"alpha": lambda: A > 127, "key": keyed, "vision": lambda: vision(im)}[how]()
        if m is not None and 0.03 < m.mean() < 0.97:
            break
        warn.append(f"{how}:{'none' if m is None else f'{m.mean():.0%}'}")
    else:
        how, m = "rect", np.ones(A.shape, bool)
    m = drop_small(m, 0.001)  # islands < 0.1 %
    holes = nd.binary_fill_holes(m) & ~m
    m |= holes & ~drop_small(holes, 0.001)  # pinholes only; real holes (a ring, a pin's loop) stay open
    if how != "rect":
        m = nd.binary_erosion(m, iterations=1)
    a = nd.gaussian_filter(m.astype(np.float32), 1.0)
    inner = a > 0.99
    if inner.any():  # defringe: edge pixels take the colour of the nearest solid pixel, not the background's
        iy, ix = nd.distance_transform_edt(~inner, return_distances=False, return_indices=True)
        rgb = np.where((~inner)[..., None], rgb[iy, ix], rgb)
    out = Image.fromarray(np.dstack([rgb, a * 255]).clip(0, 255).astype(np.uint8), "RGBA")
    box = Image.fromarray(((a > 0.03) * 255).astype(np.uint8)).getbbox()
    if not box:
        return [f.name, "error", 0, "empty"]
    g = int(0.02 * max(box[2] - box[0], box[3] - box[1]))
    out = out.crop((max(0, box[0] - g), max(0, box[1] - g), min(out.width, box[2] + g), min(out.height, box[3] + g)))
    out.thumbnail((mx, mx))
    out.save(dest, optimize=True)
    return [f.name, how, round(100 * m.mean(), 1), " ".join(warn)]


def batch(paths, out, mx, method, report):
    from concurrent.futures import ThreadPoolExecutor
    files = []
    for p in (Path(x).expanduser() for x in paths):
        files += sorted(p.iterdir()) if p.is_dir() else [p]
    files = [f for f in files if f.is_file() and f.suffix.lower() in EXTS and not f.name.startswith(".")]
    stems = {f.stem for f in files if f.suffix.lower() != ".heic"}
    files = [f for f in files if f.suffix.lower() != ".heic" or f.stem not in stems]  # a .heic twin of a .jpg
    lifter()  # compile once, before the threads race for it
    with ThreadPoolExecutor(4) as ex:
        rows = list(ex.map(lambda f: clean_one(f, out / f"{f.stem}.png", mx, method), files))
    for r in rows:
        print(f"  {r[0]}: {r[1]} {r[2]}% {r[3]}")
    counts = {k: sum(r[1] == k for r in rows) for k in dict.fromkeys(r[1] for r in rows)}
    print(f"{len(rows)} images -> {out}: {counts}")
    if report:
        import csv
        with open(out / "report.csv", "w", newline="") as fh:
            csv.writer(fh).writerows([["file", "method", "kept_pct", "warnings"], *rows])


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def save_credit(out, slug, line):
    path = out / "CREDITS.md"
    old = path.read_text().splitlines(keepends=True)[2:] if path.exists() else []
    keep = [x for x in old if not x.startswith(f"- `{slug}.png`")]
    path.write_text("# Sticker credits\n\n" + "".join(sorted(keep + [line])))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("queries", nargs="*")
    ap.add_argument("--file", action="append", default=[], help="your own photo: lift + trim only")
    ap.add_argument("--batch", nargs="+", metavar="DIR", help="folders/files of your own images -> cleaned die-cut PNGs, same base name")
    ap.add_argument("--method", default="auto", choices=["auto", "key", "vision"], help="--batch: force the colour key or Vision")
    ap.add_argument("--tol", type=float, default=TOL, help="--batch: RGB distance the colour key floods across (lower keeps pale subjects on pale grounds)")
    ap.add_argument("--report", action="store_true", help="--batch: write <out>/report.csv (file, method, kept %%, warnings)")
    ap.add_argument("--out", default="assets/stickers")
    ap.add_argument("--pick", action="append", default=[], help="slug=n: use candidate n from the preview")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--max", type=int, default=900)
    ap.add_argument("--rembg", action="store_true", help="opt-in fallback, downloads ~170 MB")
    A = ap.parse_args()
    out = Path(A.out)
    out.mkdir(parents=True, exist_ok=True)
    picks = dict(p.split("=") for p in A.pick)
    TOL = A.tol
    if A.batch:
        batch(A.batch, out, A.max, A.method, A.report)

    missing = [f for f in A.file if not Path(f).expanduser().is_file()]
    if missing:
        sys.exit(f"not found: {', '.join(missing)} (relative to {Path.cwd()}). Pass the real path, e.g. --file ~/Downloads/cup.jpg")
    for f in A.file:
        print(f"{f}:")
        f = str(Path(f).expanduser())
        lift(f, out / f"{slugify(Path(f).stem)}.png", A.max, A.rembg)

    for q in A.queries:
        slug, res = slugify(q), search(q)
        if not res:
            print(f"{slug}: nothing openly licensed found for {q!r}")
            continue
        if A.preview:
            sheet, t = Image.new("RGB", (300 * N, 300), "white"), out / ".thumb"
            d = ImageDraw.Draw(sheet)
            for i, r in enumerate(res):
                if fetch([thumb(r["url"]), r.get("thumbnail"), r["url"]], t):
                    sheet.paste(ImageOps.fit(Image.open(t).convert("RGB"), (300, 300)), (300 * i, 0))
                d.rectangle((300 * i, 0, 300 * i + 70, 34), fill=(0, 0, 0))
                d.text((300 * i + 35, 17), f"{i} {r['license']}", fill=(255, 255, 255), anchor="mm", font_size=18)
            t.unlink(missing_ok=True)
            sheet.save(out / f"preview-{slug}.jpg")
            print(f"{slug}: {q!r} -> {out}/preview-{slug}.jpg  (then --pick {slug}=n)")
            continue
        r = res[int(picks.get(slug, 0))]
        print(f"{slug}: {r.get('title')!r} ({r['license']}, {r.get('creator')})")
        src = out / f".{slug}.src"
        if fetch([thumb(r["url"], 1280), r["url"]], src) and lift(src, out / f"{slug}.png", A.max, A.rembg):
            save_credit(out, slug, credit(slug, r))
        src.unlink(missing_ok=True)
