#!/usr/bin/env python3
"""Add one example (a "cut") to a skill's demo page, with its own title, prompt and notes.

  python3 demos/add_cut.py --page demos/aura-edit.html --title "Night shift: a chrome watch aura edit" \
      --prompt "what the user asked for" --video out.mp4 [--note "what the skill did"]... [--sound "..."]... \
      [--first] [--poster 3.2] [--page-title "Aura edits"] [--skill aura-edit]

The cut goes at the end of the page, or before the older ones with --first (the player opens a page's
first video). --poster T also writes demos/posters/<page>.jpg from the frame at T seconds. A missing page
is created with the same look as make_demo.py. Videos are re-encoded like make_demo.py (at most 720 px
tall, CRF 28) so each page stays a few MB; the player reads each cut's title, prompt and notes.
"""
import argparse, base64, html, re, subprocess, tempfile
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--page", required=True)
ap.add_argument("--title", required=True)
ap.add_argument("--prompt", default="")
ap.add_argument("--video", required=True)
ap.add_argument("--note", action="append", default=[])
ap.add_argument("--sound", action="append", default=[])
ap.add_argument("--first", action="store_true")
ap.add_argument("--poster", type=float)
ap.add_argument("--page-title", default="")
ap.add_argument("--skill", default="")
a = ap.parse_args()
e = html.escape
page = Path(a.page)

with tempfile.TemporaryDirectory() as d:
    dst = Path(d) / "v.mp4"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", a.video, "-vf", "scale=-2:'min(720,ih)'",
                    "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-pix_fmt", "yuv420p",
                    "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dst)], check=True)
    b64 = base64.b64encode(dst.read_bytes()).decode()

li = lambda items: "".join(f"<li>{e(x)}</li>" for x in items)
cut = (f'<article class="cut" data-title="{e(a.title)}">\n<h2 class="ct">{e(a.title)}</h2>\n'
       + (f'<blockquote>{e(a.prompt)}</blockquote>\n' if a.prompt else '')
       + f'<video controls playsinline preload="metadata" src="data:video/mp4;base64,{b64}"></video>\n'
       + (f'<section><h2>What the skill did</h2><ul>{li(a.note)}</ul></section>\n' if a.note else '')
       + (f'<section><h2>Sound</h2><ul>{li(a.sound)}</ul></section>\n' if a.sound else '')
       + '</article>\n')

if not page.exists():
    skill = a.skill or page.stem
    page.write_text(f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(a.page_title or a.title)}</title>
<style>
:root{{--bg:#0e0e0d;--fg:#ecebe6;--dim:#8e8d87;--rule:#2a2a27;--mono:ui-monospace,"SF Mono",Menlo,monospace;color-scheme:dark}}
body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,"Inter",system-ui,sans-serif;padding:48px 16px 80px}}
main{{max-width:960px;margin:auto;display:grid;gap:28px}}
.k{{font:500 12px/1 var(--mono);letter-spacing:.06em;color:var(--dim);text-transform:uppercase}}
h1{{font-size:clamp(28px,5vw,44px);line-height:1.05;margin:8px 0 0;letter-spacing:-.02em;text-wrap:balance}}
blockquote{{margin:0;padding:14px 18px;border-left:2px solid var(--fg);background:#161614;font:15px/1.5 var(--mono)}}
video{{display:block;width:auto;height:auto;max-width:100%;max-height:calc(100vh - 32px);margin:0 auto;border-radius:10px;background:#000}}
h2{{font-size:14px;margin:0 0 6px;color:var(--dim);font-weight:500}}
ul{{margin:0;padding-left:18px}} li{{margin:4px 0}}
footer{{border-top:1px solid var(--rule);padding-top:14px;color:var(--dim);font:13px var(--mono)}}
</style>
<main>
<div><div class="k">claude-s · {e(skill)}</div><h1>{e(a.page_title or a.title)}</h1></div>
<footer>Made with the {e(skill)} skill · github.com/Lokendrakushwah12/claude-s</footer>
</main>""")

s = page.read_text()
if ".cut{" not in s:   # one rule for every cut block, added once per page
    s = s.replace("</style>", "article.cut{display:grid;gap:18px;padding-top:28px;border-top:1px solid var(--rule)}\nh2.ct{font-size:22px;color:var(--fg);margin:0;font-weight:600}\n</style>", 1)
if a.first:   # before the first older cut, blockquote or video, whichever comes first
    m = re.search(r'<article class="cut"|<blockquote>|<video', s)
    at = m.start() if m else s.index("<footer>")   # a new page has nothing to go before yet
    s = s[:at] + cut + s[at:]
else:
    s = s.replace("<footer>", cut + "<footer>", 1)
page.write_text(s)

if a.poster is not None:
    out = page.parent / "posters" / f"{page.stem}.jpg"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(a.poster), "-i", a.video, "-frames:v", "1",
                    "-vf", "scale='if(gt(iw,ih),720,-2)':'if(gt(iw,ih),-2,720)'", "-q:v", "4", str(out)], check=True)
    print("poster", out)
print(page, f"{page.stat().st_size / 1e6:.1f} MB,", s.count("<video"), "videos")
