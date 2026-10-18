# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""Real-photo cut-out stickers: search Openverse for openly licensed photos, lift the subject, trim to a transparent PNG.
  uv run stickers.py "iced coffee" "instant camera" --preview      contact sheet of 6 candidates per query -> <out>/preview-<slug>.jpg
  uv run stickers.py "iced coffee" "instant camera" --pick instant-camera=3   lift candidate 0 (or the picked one) -> <out>/<slug>.png
  uv run stickers.py --file me.jpg --file mug.jpg                   your own photos: lift + trim only, no search, no credit
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

from PIL import Image, ImageDraw, ImageOps

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
    ap.add_argument("--out", default="assets/stickers")
    ap.add_argument("--pick", action="append", default=[], help="slug=n: use candidate n from the preview")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--max", type=int, default=900)
    ap.add_argument("--rembg", action="store_true", help="opt-in fallback, downloads ~170 MB")
    A = ap.parse_args()
    out = Path(A.out)
    out.mkdir(parents=True, exist_ok=True)
    picks = dict(p.split("=") for p in A.pick)

    for f in A.file:
        print(f"{f}:")
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
