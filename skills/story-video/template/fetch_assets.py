# Photos for the photo cards, from Openverse (openly licensed images, no API key). Queries live in
# make_cards.ASSETS. Only licences that allow reuse (CC0, public domain, CC BY), credited in CREDITS.md.
#   uv run --with pillow fetch_assets.py --preview      contact sheet of candidates per slug -> assets/preview-<slug>.jpg
#   uv run --with pillow fetch_assets.py                download candidate 0 for every slug without an asset yet
#   uv run --with pillow fetch_assets.py open=2 day=0   (re)download a chosen candidate for these slugs
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

from make_cards import ASSETS, ASSETS_DIR, asset

UA = "story-video/0.1 (+https://github.com/Lokendrakushwah12/story-video)"
N = 6  # candidates per query


def _query(params):
    q = urllib.parse.urlencode({"license": "cc0,pdm,by", "aspect_ratio": "wide", "extension": "jpg,png",
                                "page_size": N, "mature": "false", **params})
    req = urllib.request.Request(f"https://api.openverse.org/v1/images/?{q}", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["results"]


def search(query):
    """Unsplash photos mirrored on Wikimedia first: CC0, full resolution, generic stock (no identifiable
    public figures, which a made-up story must not use). Topped up from everything else, Flickr's 1024px max."""
    hits = [r for r in _query({"q": f"{query} unsplash", "source": "wikimedia"}) if "unsplash" in (r.get("title") or "").lower()]
    return (hits + _query({"q": query}))[:N]


def get(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        dest.write_bytes(r.read())


def credit(slug, r):
    lic = r["license"].upper() if r["license"] in ("cc0", "pdm") else f"CC {r['license'].upper()} {r.get('license_version', '')}".strip()
    return f"- `{slug}`: \"{r.get('title') or 'untitled'}\" by {r.get('creator') or 'unknown'}, {lic}. {r.get('foreign_landing_url')}\n"


def save_credits(credits):
    path = ASSETS_DIR / "credits.json"
    allc = json.loads(path.read_text()) if path.exists() else {}
    allc.update(credits)
    path.write_text(json.dumps(allc, indent=1))
    (ASSETS_DIR.parent / "CREDITS.md").write_text("# Photo credits\n\n" + "".join(allc[k] for k in sorted(allc)))


if __name__ == "__main__":
    ASSETS_DIR.mkdir(exist_ok=True)
    args = sys.argv[1:]
    if args == ["--preview"]:
        for slug, query in ASSETS.items():
            sheet = Image.new("RGB", (400 * N, 250))
            d = ImageDraw.Draw(sheet)
            for i, r in enumerate(search(query)):
                t = ASSETS_DIR / ".thumb"
                for url in (r.get("thumbnail"), r["url"]):  # Openverse's thumbnail proxy 424s now and then
                    try:
                        get(url, t)
                        sheet.paste(ImageOps.fit(Image.open(t).convert("RGB"), (400, 250)), (400 * i, 0))
                        break
                    except Exception:
                        pass
                d.rectangle((400 * i, 0, 400 * i + 44, 44), fill=(0, 0, 0))
                d.text((400 * i + 22, 22), str(i), fill=(255, 255, 255), anchor="mm", font_size=30)
            t.unlink(missing_ok=True)
            sheet.save(ASSETS_DIR / f"preview-{slug}.jpg")
            print(f"{slug}: {query!r} -> assets/preview-{slug}.jpg")
        sys.exit()

    chosen = dict(a.split("=") for a in args) if args else {s: "0" for s in ASSETS if not asset(s)}
    credits = {}
    for slug, idx in chosen.items():
        r = search(ASSETS[slug])[int(idx)]
        for old in ASSETS_DIR.glob(f"{slug}.*"):
            old.unlink()
        ext = Path(urllib.parse.urlparse(r["url"]).path).suffix.lower()
        dest = ASSETS_DIR / f"{slug}{ext if ext in ('.jpg', '.jpeg', '.png', '.webp') else '.jpg'}"
        get(r["url"], dest)
        w = Image.open(dest).width
        if w < 1600:
            print(f"  warning: {slug} is only {w}px wide, soft at 4K; try another candidate")
        credits[slug] = credit(slug, r)
        print(f"{slug}: {dest.name} ({r['license']}, {r.get('creator')})")
    if credits:
        save_credits(credits)
