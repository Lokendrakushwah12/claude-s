#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pillow"]
# ///
"""Archival film footage, with the licence checked at the original archive instead of the aggregator.

  uv run archive.py search "film countdown leader" [--via mia|ia|commons] [--color bw|color] [--aspect 4:3]
                    [--years 1920-1960] [--n 24]          -> assets/archive/search/results.json + sheet.jpg
  uv run archive.py get 7 [--in 1.2] [--dur 3] [--name leader] [--fps 30] [--size 1920x1080] [--best]
                    [--allow-sa] [--i-checked "what you checked"]   -> assets/archive/<name>.mp4 + <name>.json
  uv run archive.py credits [--card 1920x1080]            -> CREDITS.md, credits.txt, credits.json [+ credits.png]
  uv run archive.py --selftest

Run it from the project folder. movingimagearchive.com (MIA) has no docs, no terms page and no robots.txt, and
its "public_domain" label is only a hint. Every `get` re-reads the licence at the source archive (archive.org
licenseurl, openbeelden oi:license, NASA, Commons extmetadata) and refuses what it can't verify.
"""
import argparse, hashlib, html, io, json, os, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from pathlib import Path

UA = "claude-s-archive-footage/0.1 (+https://github.com/Lokendrakushwah12/claude-s)"
MIA = "https://www.movingimagearchive.com"
COMMONS = "https://commons.wikimedia.org/w/api.php"
CACHE = Path(os.environ.get("ARCHIVE_CACHE", "~/.cache/claude-s/archive")).expanduser()
GAP = {"openbeelden.nl": 10, "r2.dev": 0.25, "upload.wikimedia.org": 0.25}  # s between requests per host, default 1;
# openbeelden's robots.txt asks Crawl-delay 10. The other two are static CDNs serving contact-sheet thumbnails.
OUT, SEARCH = Path("assets/archive"), Path("assets/archive/search")
PD_LINE = date.today().year - 96  # US: published in this year or earlier = public domain (1930 in 2026)
FEDERAL = re.compile(r"\bNASA\b|National Aeronautics|\bU\.\s?S\.\s?(Army|Navy|Air Force|Marine|Department|Information Agency)"
                     r"|United States (Army|Navy|Air Force|Marine|Department|Information Agency)|Tennessee Valley Authority", re.I)
ARCHIVES = {"archive.org": "Internet Archive", "openbeelden.nl": "Open Images (Netherlands Institute for Sound & Vision)",
            "images.nasa.gov": "NASA Image and Video Library", "commons.wikimedia.org": "Wikimedia Commons"}
_last = {}


# ---------- network: one request a second per host, cached ----------
def cached(url, body=None):
    return CACHE / hashlib.sha1(f"{url} {json.dumps(body, sort_keys=True)}".encode()).hexdigest()


def fetch(url, body=None, ttl=86400):
    hit = cached(url, body)
    if hit.exists() and time.time() - hit.stat().st_mtime < ttl:
        return hit.read_bytes()
    host = urllib.parse.urlparse(url).hostname or ""
    time.sleep(max(0, _last.get(host, 0) + next((g for h, g in GAP.items() if host.endswith(h)), 1) - time.monotonic()))
    req = urllib.request.Request(url, json.dumps(body).encode() if body else None,
                                 {"User-Agent": UA, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
    finally:
        _last[host] = time.monotonic()
    CACHE.mkdir(parents=True, exist_ok=True)
    hit.write_bytes(data)
    return data


def jget(url, body=None):
    d = json.loads(fetch(url, body))
    if isinstance(d, dict) and "error" in d:  # archive.org and Commons answer 200 with an error body; don't cache it
        cached(url, body).unlink(missing_ok=True)
        sys.exit(f"{urllib.parse.urlparse(url).hostname}: {d['error']}")
    return d


def first(x):
    return (x[0] if x else None) if isinstance(x, list) else x


def year_of(s):
    """First year in a date string. A decade ("ca. 1920s") counts as its last year, so the age test stays safe."""
    m = re.search(r"\b(1[89]\d\d|20\d\d)(s?)\b", str(s or ""))
    return int(m[1]) + (9 if m[2] else 0) if m else None


def text(s):
    t = " ".join(html.unescape(re.sub(r"<[^>]+>", "", str(s or ""))).split())
    return None if t.lower() in ("", "n/a", "none", "unknown") else t  # archive.org writes "N/A" for empty fields


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


# ---------- licence ----------
def classify(lic, year=None, federal=False):
    """Licence string at the original archive (+ upstream year, federal authorship) -> (class, basis)."""
    l = (lic or "").lower().strip()
    if year and int(year) <= PD_LINE:
        return "pd-age", "age"
    if re.search(r"publicdomain|\bcc0\b|^pd\b|^pd-|public domain", l):
        return "pd", "label"
    if federal:
        return "pd", "federal"
    if re.search(r"by-nc|by-nd|-nc\b|-nd\b|-nc-|-nd-|\bnc\b|\bnd\b", l):
        return "restricted", "label"
    if "by-sa" in l or re.search(r"\bby sa\b", l):
        return "by-sa", "label"
    if re.search(r"licenses/by/|^cc[- ]by([- ]\d|$)", l):
        return "by", "label"
    return "unverified", "none"


def allowed(cls, allow_sa=False, checked=None):
    return cls in ("pd", "pd-age", "by") or (cls == "by-sa" and allow_sa) or (cls == "unverified" and bool(checked))


def licence_name(lic):
    l = (lic or "").lower()
    if "zero" in l or "cc0" in l:
        return "CC0"
    if "publicdomain/mark" in l:
        return "Public Domain Mark"
    m = re.search(r"\b(by(?:-sa|-nc|-nd)*)[/\s-]?(\d\.\d)?", l)
    return f"CC {m[1].upper()} {m[2] or ''}".strip() if m and ("creativecommons" in l or l.startswith("cc")) else (lic or "")


def ia(ident):
    d = jget(f"https://archive.org/metadata/{ident}")
    m = d.get("metadata", {})
    vids = [f for f in d.get("files", []) if f.get("width") and f["name"].lower().endswith(
        (".mp4", ".m4v", ".mov", ".mpeg", ".mpg", ".mkv", ".webm", ".ogv", ".avi"))]
    url = lambda f: f"https://archive.org/download/{ident}/{urllib.parse.quote(f['name'])}"
    vids.sort(key=lambda f: (num(f["width"]) * num(f.get("height")), num(f.get("size")) / (num(f.get("length")) or 1)), reverse=True)
    h264 = [f for f in vids if f["name"].endswith(".mp4")]  # seeks cleanly over HTTP
    who = " ".join(str(m.get(k) or "") for k in ("creator", "sponsor", "publisher"))
    # Community uploads: licence and date are whatever the uploader typed (a "PD" Charlie's Angels leader turned up)
    trust = "opensource_movies" not in (m.get("collection") if isinstance(m.get("collection"), list) else [m.get("collection")])
    return {"lic": m.get("licenseurl") if trust else None, "year": year_of(m.get("year") or m.get("date")) if trust else None,
            "date": text(m.get("date") or m.get("year")), "title": text(first(m.get("title"))),
            "creator": text(first(m.get("creator")) or first(m.get("publisher"))), "sponsor": text(first(m.get("sponsor"))),
            "federal": bool(FEDERAL.search(who)), "copies": [url(f) for f in vids],
            "media": url(h264[0] if h264 else vids[0]) if vids else None,
            "evidence": f"archive.org/metadata/{ident}: licenseurl={m.get('licenseurl')}, date={m.get('date')}"
                        + ("" if trust else " (community upload: the uploader's claim, not the archive's)")}


def openbeelden(n):
    x = ET.fromstring(fetch(f"https://www.openbeelden.nl/feeds/oai/?verb=GetRecord&identifier=oai:openimages.eu:{n}&metadataPrefix=oai_oi"))
    ns = {"oi": "http://www.openbeelden.nl/oai/"}
    t = lambda k: getattr(x.find(f".//oi:{k}", ns), "text", None)
    hd = [e.text for e in x.findall(".//oi:medium", ns) if e.get("format") == "hd" and (e.text or "").endswith(".mp4")]
    return {"lic": t("license"), "year": year_of(t("date")), "date": t("date"), "title": t("title"), "creator": t("creator"), "federal": False,
            "copies": hd, "evidence": f"openbeelden.nl OAI record {n}: license={t('license')}, date={t('date')}"}


def nasa(nid):
    q = urllib.parse.quote(nid)
    items = jget(f"https://images-api.nasa.gov/search?nasa_id={q}")["collection"]["items"]
    d = items[0]["data"][0] if items else {}
    who = d.get("secondary_creator") or d.get("photographer") or ""
    hrefs = [i["href"] for i in jget(f"https://images-api.nasa.gov/asset/{q}")["collection"]["items"]]
    return {"lic": None, "year": year_of(d.get("date_created")), "date": d.get("date_created"), "title": d.get("title"), "creator": f"NASA {d.get('center', '')}".strip(),
            "federal": bool(d) and (not who or "NASA" in who.upper()),
            "copies": [h for h in hrefs if "~orig." in h and h.endswith((".mp4", ".mov"))] + [h for h in hrefs if h.endswith("~large.mp4")],
            "evidence": f"images-api.nasa.gov nasa_id={nid}: center={d.get('center')}, credited to {who or 'nobody'}; "
                        "NASA's own media isn't copyrighted in the US"}


def commons_query(**p):
    p = {"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 320,
         "iiextmetadatafilter": "LicenseShortName|License|LicenseUrl|DateTimeOriginal|Artist|ObjectName", **p}
    return sorted(jget(f"{COMMONS}?{urllib.parse.urlencode(p)}").get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))


def cmeta(ii):
    return {k: text(str(v.get("value", ""))) for k, v in ii.get("extmetadata", {}).items()}


def commons(title):
    ii = commons_query(titles=title)[0]["imageinfo"][0]
    m = cmeta(ii)
    return {"lic": m.get("License") or m.get("LicenseShortName"), "year": year_of(m.get("DateTimeOriginal")), "date": m.get("DateTimeOriginal"),
            "title": m.get("ObjectName") or title[5:], "creator": m.get("Artist"), "federal": False, "copies": [], "media": ii["url"],
            "evidence": f"Commons extmetadata for {title}: License={m.get('License')}, LicenseShortName={m.get('LicenseShortName')}"}


def parse_mia(page):
    """Source page -> (metadata dict, source mp4 url). The data sits in the Next.js flight payload."""
    flight = "".join(json.loads(s) for s in re.findall(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', page))
    k = re.search(r'"sourceUrl":"([^"]+)".{0,300}?"metadata":(\{[^{}]*\})', flight)
    if not k:
        sys.exit("The MIA source page changed shape; can't find its metadata. Use --via ia or --via commons.")
    return json.loads(k[2]), k[1]


def verify(r):
    v, up, mia_src = {"warnings": [], "copies": []}, r["page"], None
    if r["via"] == "mia":  # cut from MIA's copy, but take the licence from the archive it came from
        m, mia_src = parse_mia(fetch(f"{MIA}/sources/{r['slug']}").decode())
        v["mia_label"], v["collection"] = m.get("public_domain_status"), m.get("original_collection")
        up = m.get("source_url") or ""
    for pat, fn in ((r"archive\.org/details/([^/?#]+)", ia), (r"openbeelden\.nl/media/(\d+)", openbeelden),
                    (r"images\.nasa\.gov/details/([^/?#]+)", nasa), (r"commons\.wikimedia\.org/wiki/(File:[^?#]+)", commons)):
        if k := re.search(pat, up):
            v.update(fn(urllib.parse.unquote(k[1])))
            break
    else:
        v.update(lic=None, year=None, federal=False, evidence=f"original archive not recognised: {up or 'none given'}")
    v["upstream"] = up
    if mia_src:
        v["media"] = mia_src
    v["cls"], v["basis"] = classify(v["lic"], v["year"], v["federal"])
    if v["cls"] == "pd" and v["basis"] == "label":
        v["warnings"].append("Public domain by the archive's own label only. Labels can be wrong (Prelinger's rights FAQ says so "
                             "of its own films); check before commercial use.")
    if v["cls"] == "pd-age" and v["lic"] and classify(v["lic"])[0] != "pd":
        v["warnings"].append(f"The archive labels it {v['lic']}. The age rule is US-only; follow the label outside the US.")
    if v.get("sponsor") or (v.get("creator") and re.search(r"\b(Inc|Co|Company|Corporation|Corp|Ltd|Motors)\b\.?", v["creator"])):
        v["warnings"].append(f"Made or sponsored by {v.get('sponsor') or v['creator']}: logos may be on screen; don't imply endorsement.")
    if v.get("mia_label") == "public_domain" and v["cls"] == "unverified":
        v["warnings"].append("MIA says public_domain, but the original archive doesn't back it up.")
    return v


# ---------- search ----------
def search_mia(q, a):
    body = {"query": q, "offset": 0}
    if a.color:
        body["color"] = {"bw": "black_and_white"}.get(a.color, a.color)
    if a.aspect:
        body["aspectRatio"] = a.aspect
    if a.years:
        body["yearMin"], body["yearMax"] = a.years
    return [{"via": "mia", "id": c["id"], "title": c["sourceTitle"], "year": c["sourceYear"], "slug": c["sourceSlug"],
             "start": c["startSeconds"], "end": c["endSeconds"], "thumb": c["thumbnailUrl"],
             "page": f"{MIA}/sources/{c['sourceSlug']}?clip={c['id']}"} for c in jget(f"{MIA}/api/search", body)["clips"]]


def search_ia(q, a):
    qq = f"({q}) AND mediatype:movies AND (licenseurl:*publicdomain* OR licenseurl:*by\\/*)"  # unescaped / breaks IA's search
    if a.years:
        qq += f" AND year:[{a.years[0]} TO {a.years[1]}]"
    p = urllib.parse.urlencode([("q", qq), ("fl[]", "identifier"), ("fl[]", "title"), ("fl[]", "year"), ("rows", a.n), ("output", "json")])
    return [{"via": "ia", "id": d["identifier"], "title": d.get("title"), "year": year_of(d.get("year")), "start": 0, "end": None,
             "thumb": f"https://archive.org/services/img/{d['identifier']}", "page": f"https://archive.org/details/{d['identifier']}"}
            for d in jget(f"https://archive.org/advancedsearch.php?{p}")["response"]["docs"]]


def search_commons(q, a):
    out = []
    for p in commons_query(generator="search", gsrnamespace=6, gsrsearch=f"{q} filetype:video", gsrlimit=a.n):
        ii = p["imageinfo"][0]
        out.append({"via": "commons", "id": p["title"], "title": cmeta(ii).get("ObjectName") or p["title"][5:],
                     "year": year_of(cmeta(ii).get("DateTimeOriginal")), "start": 0, "end": ii.get("duration"),
                     "thumb": ii.get("thumburl"), "page": ii["descriptionurl"]})
    return out


def sheet(results, path):
    from PIL import Image, ImageDraw, ImageFont, ImageOps
    W, H = 320, 240
    im = Image.new("RGB", (W * 6, H * max(1, -(-len(results) // 6))))
    d, big, small = ImageDraw.Draw(im), ImageFont.load_default(26), ImageFont.load_default(13)
    for i, r in enumerate(results):
        x, y = W * (i % 6), H * (i // 6)
        try:
            im.paste(ImageOps.pad(Image.open(io.BytesIO(fetch(r["thumb"], ttl=1e9))).convert("RGB"), (W, H)), (x, y))
        except Exception:
            pass  # a missing thumbnail leaves a black tile; the idx still works
        d.rectangle((x, y, x + 42, y + 34), fill=0)
        d.text((x + 21, y + 17), str(i), fill="white", anchor="mm", font=big)
        dur = f" {r['end'] - r['start']:.1f}s" if r.get("end") else ""
        d.rectangle((x, y + H - 18, x + W, y + H), fill=0)
        d.text((x + 4, y + H - 9), f"{r.get('year') or '?'}{dur}  {r.get('title') or ''}"[:46], fill=(225, 225, 225), anchor="lm", font=small)
    im.save(path, quality=85)


def cmd_search(a):
    res = {"mia": search_mia, "ia": search_ia, "commons": search_commons}[a.via](a.query, a)[:min(a.n, 24)]
    SEARCH.mkdir(parents=True, exist_ok=True)
    (SEARCH / "results.json").write_text(json.dumps({"query": a.query, "via": a.via, "results": res}, indent=1))
    seen = SEARCH / "seen.json"
    allr = json.loads(seen.read_text()) if seen.exists() else {}
    seen.write_text(json.dumps(allr | {r["id"]: r for r in res}, indent=1))
    sheet(res, SEARCH / "sheet.jpg")
    for i, r in enumerate(res):
        dur = f"{r['end'] - r['start']:5.1f}s" if r.get("end") else "     -"
        print(f"{i:3} {r.get('year') or '????'} {dur}  {(r.get('title') or '')[:60]}")
    print(f"-> {SEARCH / 'sheet.jpg'} (tiles numbered by idx). Pick one: archive.py get <idx>")


# ---------- get ----------
def probe(url, must=True):
    for _ in range(2):  # R2 and archive.org sometimes stall on the first range request
        o = json.loads(subprocess.run(["ffprobe", "-v", "error", "-user_agent", UA, "-select_streams", "v:0", "-show_entries",
                                       "stream=width,height,sample_aspect_ratio:format=bit_rate", "-of", "json", url], capture_output=True, text=True).stdout or "{}")
        s = (o.get("streams") or [{}])[0]
        if s.get("width"):  # display size: IA's MPEG-2 originals store 368x480 at SAR 40:23
            n, d = (int(x) or 1 for x in (s.get("sample_aspect_ratio") or "1:1").replace("N/A", "1:1").split(":"))
            w = round(s["width"] * n / d / 2) * 2
            return w * s["height"], int(o.get("format", {}).get("bit_rate") or 0), f"{w}x{s['height']}"
    if must:
        sys.exit(f"ffprobe can't read {url}; the host may be slow, try again in a minute")
    return 0, 0, "unreadable"


def seek(url, t):
    """Fast seek to 5 s early, then decode to t. A plain input -ss on MPEG-2 over HTTP starts the video up to 0.4 s late."""
    pre = min(max(t, 0), 5)
    return ["-ss", f"{max(t, 0) - pre:.3f}", "-user_agent", UA, "-i", url, "-ss", f"{pre:.3f}"]


def frames(url, t, dur):
    """32x24 grey frames at 10 fps, as one bytes blob (768 bytes a frame)."""
    return subprocess.run(["ffmpeg", "-v", "error", *seek(url, t), "-t", f"{dur:.3f}", "-an",
                           "-vf", "fps=10,scale=32:24,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout


def corr(x, y):
    n = len(x) or 1
    mx, my = sum(x) / n, sum(y) / n
    sxy = sum((a - mx) * (b - my) for a, b in zip(x, y))
    return sxy / ((sum((a - mx) ** 2 for a in x) * sum((b - my) ** 2 for b in y)) ** 0.5 or 1)


def best_copy(src, have, copies, t, dur):
    """The biggest copy (or same size at 2x the bitrate) whose frames line up with the pick -> (url, its time, size, r)."""
    px0, br0, wh0 = have
    pick = None
    for (px, br, wh), url in sorted(((probe(u, must=False), u) for u in copies[:3]), reverse=True):
        if not (px > px0 or (px == px0 and br > 2 * br0)):
            print(f"  --best: {url.rsplit('/', 1)[-1]} is {wh} at {br // 1000} kb/s, no better than {wh0} at {br0 // 1000} kb/s")
            continue
        pick = pick or frames(src, t, dur)
        pre = min(2.0, t)  # search +-2 s: transfers can start at different points
        other = frames(url, t - pre, dur + pre + 2)
        # ponytail: 0.1 s alignment steps, so the cut can land a frame or two off; fine for b-roll
        r, k = max(((corr(pick, other[k:k + len(pick)]), k // 768) for k in range(0, max(1, len(other) - len(pick) + 1), 768)), default=(0, 0))
        if r > 0.9:
            return url, t - pre + k / 10, wh, r
        print(f"  --best: the {wh} copy doesn't line up with the pick (r={r:.2f}); keeping the {wh0} one")
    return None


def cut(src, t, dur, out, fps, size):
    vf = f"bwdif=deint=interlaced,scale='trunc(iw*sar/2)*2':ih,setsar=1,fps={fps}"  # square pixels: SD is often 10:11 or 8:9
    if size:  # fill the frame: scale to cover, centre-crop
        vf += f",scale={size[0]}:{size[1]}:force_original_aspect_ratio=increase,crop={size[0]}:{size[1]},setsar=1"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *seek(src, t), "-t", f"{dur:.3f}",
                    "-map", "0:v:0", "-map", "0:a:0?", "-vf", vf, "-c:v", "libx264", "-crf", "16", "-preset", "slow",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)], check=True)


def lic_text(p):
    v = p["licence"]
    lic = {"pd": "Public domain", "pd-age": f"Public domain in the US (published before {PD_LINE + 1})", "by": licence_name(v["url"]),
           "by-sa": licence_name(v["url"]), "unverified": f"Licence checked by hand: {p.get('i_checked')}"}[v["class"]]
    return lic + (f" ({licence_name(v['url'])})" if v["class"] == "pd" and licence_name(v["url"]) in ("CC0", "Public Domain Mark") else "")


def when(p):  # the archive's own wording for vague dates ("ca. 1920s"), else the year
    return p.get("date") if re.search(r"\d0s|ca\.|circa|\?", str(p.get("date"))) else p.get("year")


def where(p):
    host = next((n for h, n in ARCHIVES.items() if h in (p.get("upstream") or "")), "")
    coll = p.get("collection")
    return coll if coll and (not host or host.split(" (")[0] in coll) else ", ".join(filter(None, (coll, host)))


def credit_line(p):
    who = ", ".join(str(x) for x in (p.get("creator"), when(p)) if x)
    return f'"{p["title"]}"' + (f" ({who})" if who else "") + (f", {where(p)}" if where(p) else "") + f". {lic_text(p)}. {p.get('upstream')}"


def lookup(pick):
    res = json.loads((SEARCH / "results.json").read_text())["results"] if (SEARCH / "results.json").exists() else []
    if pick.isdigit() and int(pick) < len(res):
        return res[int(pick)]
    seen = json.loads((SEARCH / "seen.json").read_text()) if (SEARCH / "seen.json").exists() else {}
    if pick in seen:
        return seen[pick]
    sys.exit(f"No result {pick!r}. Use an idx from the last search or an id from {SEARCH / 'seen.json'}.")


def cmd_get(a):
    r = lookup(a.pick)
    v = verify(r)
    print(f"{r['title']}: {v['cls']} ({v['basis']}). {v['evidence']}")
    for w in v["warnings"]:
        print("  warning:", w)
    if not allowed(v["cls"], a.allow_sa, a.i_checked):
        sys.exit({"by-sa": "Blocked: share-alike. The whole video would have to be CC BY-SA. Pass --allow-sa if that's fine.",
                  "unverified": "Blocked: the original archive doesn't give a usable licence. Check it yourself, then pass "
                                "--i-checked \"what you checked\".",
                  "restricted": "Blocked: non-commercial or no-derivatives licence. Pick another clip."}[v["cls"]])
    src = v.get("media")
    if not src:
        sys.exit("No downloadable video at the original archive.")
    t = r["start"] + a.tin
    if r.get("end") and t + a.dur > r["end"] + 0.05:
        print(f"  warning: {a.dur}s from {a.tin}s runs past this shot's end ({r['end'] - r['start']:.1f}s long), into the next shot")
    have = probe(src)
    copy = have[2]
    if a.best:
        if b := best_copy(src, have, v["copies"], t, a.dur):
            src, t, copy, rr = b
            print(f"  --best: using the {copy} copy at {src} (frames match, r={rr:.2f})")
        else:
            print("  --best: no better copy that lines up; keeping", copy)
    name = a.name or re.sub(r"[^a-z0-9]+", "-", f"{v.get('title') or r['title']} {int(t)}".lower()).strip("-")[:60]
    OUT.mkdir(parents=True, exist_ok=True)
    cut(src, t, a.dur, OUT / f"{name}.mp4", a.fps, a.size)
    p = {"name": name, "file": f"{name}.mp4", "via": r["via"], "id": r["id"], "title": v.get("title") or r["title"],
         "year": v.get("year") or r.get("year"), "date": v.get("date"), "creator": v.get("creator"), "collection": v.get("collection"),
         "in": round(t, 3), "dur": a.dur, "copy": src, "copy_size": copy, "found_at": r["page"], "upstream": v["upstream"],
         "licence": {"class": v["cls"], "basis": v["basis"], "url": v["lic"], "evidence": v["evidence"],
                     "checked": datetime.now(timezone.utc).isoformat(timespec="seconds")},
         "mia_label": v.get("mia_label"), "warnings": v["warnings"], "i_checked": a.i_checked}
    p["credit"] = credit_line(p)
    (OUT / f"{name}.json").write_text(json.dumps(p, indent=1))
    print(f"-> {OUT / name}.mp4 ({copy}, {a.dur}s from {t:.2f}s)\n   credit: {p['credit']}")
    print("   People on screen have publicity rights apart from copyright: no implied endorsement.")


# ---------- credits ----------
def cmd_credits(a):
    ps = [json.loads(f.read_text()) for f in sorted(OUT.glob("*.json"), key=lambda f: f.stat().st_mtime)]  # fetch order
    if not ps:
        sys.exit(f"No clips in {OUT}.")
    ps = [p | {"credit": credit_line(p)} for p in ps]
    Path("credits.json").write_text(json.dumps([{k: p.get(k) for k in ("file", "title", "year", "creator", "upstream", "licence", "credit", "warnings")} for p in ps], indent=1))
    Path("credits.txt").write_text("".join(f"{p['title']} ({when(p) or 'n.d.'}) · {where(p)} · {lic_text(p)}\n" for p in ps))
    block = ("<!-- archive-footage -->\n## Archival footage\n\n" + "".join(f"- `{p['file']}`: {p['credit']}\n" for p in ps)
             + "\nFound with movingimagearchive.com; licences checked at the original archives listed.\n<!-- /archive-footage -->\n")
    md = Path("CREDITS.md")
    old = md.read_text() if md.exists() else "# Credits\n\n"
    md.write_text(re.sub(r"<!-- archive-footage -->.*<!-- /archive-footage -->\n", lambda _: block, old, flags=re.S)
                  if "<!-- archive-footage -->" in old else old.rstrip() + "\n\n" + block)
    print(f"{len(ps)} clips -> CREDITS.md, credits.txt, credits.json")
    if a.card:
        card(Path("credits.txt").read_text().splitlines(), a.card, Path("credits.png"))
        print("-> credits.png")


def card(lines, size, path):
    """End card: per clip, the title on one line and source + licence under it, shrunk to fit the width."""
    from PIL import Image, ImageDraw, ImageFont
    W, H = size
    im = Image.new("RGB", (W, H), (10, 10, 9))
    d = ImageDraw.Draw(im)
    ttf = next((f for f in ("/System/Library/Fonts/Helvetica.ttc", "/Library/Fonts/Arial.ttf") if Path(f).exists()), None)
    font = lambda s: ImageFont.truetype(ttf, s) if ttf else ImageFont.load_default(s)
    rows = [r for ln in lines for r in (ln.split(" · ", 1) + [""])[:2]]
    fs = H // 30
    while fs > 8 and max(d.textlength(r, font=font(fs)) for r in rows) > W * 0.88:
        fs -= 1
    y = H / 2 - (len(lines) * fs * 3.1 + fs * 2.4) / 2
    d.text((W / 2, y), "ARCHIVAL FOOTAGE", fill=(150, 148, 140), anchor="mt", font=font(int(fs * 0.8)))
    for i, r in enumerate(rows):
        d.text((W / 2, y + fs * 2.4 + (i // 2) * fs * 3.1 + (i % 2) * fs * 1.3), r, anchor="mt",
               fill=(236, 235, 230) if i % 2 == 0 else (150, 148, 140), font=font(fs if i % 2 == 0 else int(fs * 0.8)))
    im.save(path)


# ---------- selftest ----------
def selftest():
    Y = PD_LINE
    cases = [  # (licence at the original archive, upstream year, federal) -> class. First four are real records, 2026-10-10.
        (("http://creativecommons.org/licenses/publicdomain/", 1940, False), "pd"),   # archive.org HowMotionPic (Prelinger)
        (("https://creativecommons.org/publicdomain/zero/1.0/", 1970, False), "pd"),  # archive.org TouteLaBandeEpisode9Bricolage1970
        (("https://creativecommons.org/publicdomain/mark/1.0/", 1922, False), "pd-age"),  # openbeelden 1480321
        ((None, 1960, True), "pd"),  # images.nasa.gov, no licence field, NASA-credited
        ((None, 1950, False), "unverified"), ((None, None, False), "unverified"), (("", 1975, False), "unverified"),
        ((None, Y, False), "pd-age"), ((None, Y + 1, False), "unverified"),
        (("cc-by-sa-4.0", 2015, False), "by-sa"), (("http://creativecommons.org/licenses/by-sa/3.0/nl/", 1960, False), "by-sa"),
        (("CC BY-SA 4.0", None, False), "by-sa"), (("http://creativecommons.org/licenses/by-sa/3.0/nl/", 1925, False), "pd-age"),
        (("cc-by-4.0", 2019, False), "by"), (("https://creativecommons.org/licenses/by/4.0/", None, False), "by"),
        (("CC BY 3.0", None, False), "by"),
        (("cc-by-nc-sa-2.0", 2010, False), "restricted"), (("http://creativecommons.org/licenses/by-nd/3.0/", None, False), "restricted"),
        (("CC BY-NC 4.0", None, True), "pd"),  # a federal work can't be licensed away; federal wins over a bad label
        (("pd", 1955, False), "pd"), (("cc0", None, False), "pd"), (("Public domain", None, False), "pd"),
    ]
    for args, want in cases:
        got = classify(*args)[0]
        assert got == want, (args, got, want)
    assert year_of("ca. 1920s") == 1929 and year_of("1930s") == 1939 and year_of("1979-08-12") == 1979 and year_of("n.d.") is None
    assert classify("http://creativecommons.org/licenses/publicdomain/", year_of("ca. 1920s"))[0] == "pd-age"  # archive.org FarmerMi1920
    assert classify("http://creativecommons.org/licenses/publicdomain/", year_of("1930s"))[0] == "pd"
    assert allowed("pd") and allowed("pd-age") and allowed("by")
    assert not allowed("by-sa") and allowed("by-sa", allow_sa=True)
    assert not allowed("unverified") and allowed("unverified", checked="renewal search, none found")
    assert not allowed("restricted", True, "note")
    assert licence_name("http://creativecommons.org/licenses/by-sa/3.0/nl/") == "CC BY-SA 3.0"
    assert licence_name("cc-by-4.0") == "CC BY 4.0" and licence_name("https://creativecommons.org/publicdomain/zero/1.0/") == "CC0"
    page = ('<script>self.__next_f.push([1,"x\\"sourceSlug\\":\\"s\\",\\"sourceUrl\\":\\"https://r2/source.mp4?v=1\\",'
            '\\"runningTime\\":\\"10 min\\",\\"metadata\\":{\\"creator\\":null,\\"source_url\\":\\"https://archive.org/details/HowMotionPic\\",'
            '\\"public_domain_status\\":\\"public_domain\\"}}"])</script>')
    m, src = parse_mia(page)
    assert src == "https://r2/source.mp4?v=1" and m["source_url"].endswith("HowMotionPic") and m["public_domain_status"] == "public_domain"
    p = {"title": "T", "year": 1940, "creator": "Bell & Howell", "collection": "Prelinger Archives", "upstream": "https://archive.org/details/X",
         "licence": {"class": "pd", "url": "http://creativecommons.org/licenses/publicdomain/"}}
    assert credit_line(p) == '"T" (Bell & Howell, 1940), Prelinger Archives, Internet Archive. Public domain. https://archive.org/details/X', credit_line(p)
    assert credit_line(p | {"date": "ca. 1920s", "licence": {"class": "pd-age", "url": None}}).startswith('"T" (Bell & Howell, ca. 1920s), ')
    print(f"selftest ok ({len(cases)} licence cases, US public-domain line = {PD_LINE})")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        sys.exit(selftest())
    size = lambda s: tuple(int(x) for x in s.lower().split("x"))
    ap = argparse.ArgumentParser(description="Archival footage with the licence checked at the original archive.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--via", choices=["mia", "ia", "commons"], default="mia")
    s.add_argument("--color", choices=["bw", "color"])
    s.add_argument("--aspect", help="mia only, e.g. 4:3")
    s.add_argument("--years", type=lambda x: tuple(int(y) for y in x.split("-")), help="mia and ia, e.g. 1920-1960")
    s.add_argument("--n", type=int, default=24)
    g = sub.add_parser("get")
    g.add_argument("pick", help="idx from the last search, or a result id")
    g.add_argument("--in", dest="tin", type=float, default=0, help="seconds into the shot (mia) or film (ia, commons)")
    g.add_argument("--dur", type=float, default=3)
    g.add_argument("--name")
    g.add_argument("--fps", default="30", help="any ffmpeg rate, e.g. 30000/1001 to match story-video cards")
    g.add_argument("--size", type=size, help="fill WxH: scale to cover, centre-crop")
    g.add_argument("--best", action="store_true", help="use a bigger copy at the original archive if its frames match")
    g.add_argument("--allow-sa", action="store_true")
    g.add_argument("--i-checked", metavar="NOTE")
    c = sub.add_parser("credits")
    c.add_argument("--card", type=size, metavar="WxH", help="also render credits.png")
    a = ap.parse_args()
    try:
        {"search": cmd_search, "get": cmd_get, "credits": cmd_credits}[a.cmd](a)
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code} from {e.url}" + (": rate-limited, wait a few minutes" if e.code == 429 else ""))
