#!/usr/bin/env python3
"""Rebuild refs.js's REFS2 block (the 2026-10-11 batch) from the agents' refs-*.json files.
   python3 demos/build_refs2.py ~/Movies/refs/batch-2026-10-11"""
import json, pathlib, re, sys
d = pathlib.Path(sys.argv[1]).expanduser()
refs = [r for f in sorted(d.glob("refs-G*.json")) for r in json.loads(f.read_text())]
key = lambda r: (r["n"][0].isalpha(), int(re.sub(r"\D", "", r["n"]) or 0))   # numbered first, then E4…
refs.sort(key=key)
js = "const REFS2 = [\n" + "".join("  " + json.dumps({k: r[k] for k in ("n", "who", "url", "meta", "title", "took", "feeds") if k in r}, ensure_ascii=False) + ",\n" for r in refs) + "];"
p = pathlib.Path(__file__).resolve().parent.parent / "refs.js"; s = p.read_text()
s = re.sub(r"(// BATCH2-START[^\n]*\n).*?(\n// BATCH2-END)", lambda m: m.group(1) + js + m.group(2), s, flags=re.S)
p.write_text(s); print(len(refs), "refs:", " ".join(r["n"] for r in refs))
