#!/usr/bin/env python3
"""Wrap a skill's test render into one self-contained demo page (video embedded, so it plays with sound offline).

  python3 demos/make_demo.py --skill ugc-edit --title "Talking-head edit" \
      --prompt "cut this podcast clip like a creator edit" --video out.mp4 [--video b.mp4] \
      [--note "what the skill did"]... [--sound "what the sound does"]... --out demos/ugc-edit.html

Videos are re-encoded to at most 720 px tall (CRF 28, AAC 128k) to keep the page a few MB.
"""
import argparse, base64, html, subprocess, tempfile
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--skill", required=True)
ap.add_argument("--title", required=True)
ap.add_argument("--prompt", default="")
ap.add_argument("--video", action="append", default=[])
ap.add_argument("--note", action="append", default=[])
ap.add_argument("--sound", action="append", default=[])
ap.add_argument("--out", required=True)
a = ap.parse_args()


def embed(src):
    with tempfile.TemporaryDirectory() as d:
        dst = Path(d) / "v.mp4"
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-vf", "scale=-2:'min(720,ih)'",
                        "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-pix_fmt", "yuv420p",
                        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(dst)], check=True)
        return base64.b64encode(dst.read_bytes()).decode()


e = html.escape
videos = "\n".join(f'<video controls playsinline preload="metadata" src="data:video/mp4;base64,{embed(v)}"></video>' for v in a.video)
li = lambda items: "".join(f"<li>{e(x)}</li>" for x in items)
page = f"""<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(a.title)}</title>
<style>
:root{{--bg:#0e0e0d;--fg:#ecebe6;--dim:#8e8d87;--rule:#2a2a27;--mono:ui-monospace,"SF Mono",Menlo,monospace;color-scheme:dark}}
body{{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 -apple-system,"Inter",system-ui,sans-serif;padding:48px 16px 80px}}
main{{max-width:960px;margin:auto;display:grid;gap:28px}}
.k{{font:500 12px/1 var(--mono);letter-spacing:.06em;color:var(--dim);text-transform:uppercase}}
h1{{font-size:clamp(28px,5vw,44px);line-height:1.05;margin:8px 0 0;letter-spacing:-.02em;text-wrap:balance}}
blockquote{{margin:0;padding:14px 18px;border-left:2px solid var(--fg);background:#161614;font:15px/1.5 var(--mono)}}
video{{width:100%;border-radius:10px;background:#000;display:block}}
h2{{font-size:14px;margin:0 0 6px;color:var(--dim);font-weight:500}}
ul{{margin:0;padding-left:18px}} li{{margin:4px 0}}
footer{{border-top:1px solid var(--rule);padding-top:14px;color:var(--dim);font:13px var(--mono)}}
</style>
<main>
<div><div class="k">claude-s · {e(a.skill)}</div><h1>{e(a.title)}</h1></div>
{f'<blockquote>{e(a.prompt)}</blockquote>' if a.prompt else ''}
{videos}
{f'<section><h2>What the skill did</h2><ul>{li(a.note)}</ul></section>' if a.note else ''}
{f'<section><h2>Sound</h2><ul>{li(a.sound)}</ul></section>' if a.sound else ''}
<footer>Made with the {e(a.skill)} skill · github.com/Lokendrakushwah12/claude-s</footer>
</main>"""
Path(a.out).write_text(page)
print(a.out, f"{Path(a.out).stat().st_size / 1e6:.1f} MB")
