# Real numbers for the film, read from the repo at render time (never typed in by hand): skill names and their SKILL.md
# line counts, the playable sound names in sfx.py and each sound's waveform. Writes data.js.
#   SKILLS=~/path/to/claude-s/skills uv run gen_data.py      (a checkout of the repo, not ~/.claude/skills, which holds others too)
# /// script
# dependencies = ["numpy", "scipy", "matplotlib"]
# ///
import json, sys
from pathlib import Path

import os
SKILLS = Path(os.environ["SKILLS"]).expanduser()
sys.path.insert(0, str(SKILLS / "promo-video/template"))
import sfx  # noqa: E402

skills = sorted(p.parent.name for p in SKILLS.glob("*/SKILL.md"))
lines = {s: sum(1 for _ in open(SKILLS / s / "SKILL.md")) for s in skills}
sounds = [n for n, f in sfx.FAMILY.items() if f]
data = {"skills": skills, "lines": lines, "sounds": sounds, "params": {}}
for n in sounds:  # the defaults each sound is drawn with, for the catalogue's mono column
    import inspect
    sig = inspect.signature(sfx.SFX[n]); ps = [f"{k} {v.default}" for k, v in sig.parameters.items() if k not in ("at", "g") and v.default is not inspect._empty and not isinstance(v.default, (tuple, list))]
    data["params"][n] = "  ".join(ps[:2])
# Each sound's real waveform: rendered once through sfx.py's capture hook (as --audition does), trimmed to its -60 dB
# extent, as 48 peak bins normalised to 1. The film draws it under the sound's name, at its real duration.
import numpy as np
sfx.reset(30); data["wave"] = {}
for n in sounds:
    sfx.CAP = []; sfx.SFX[n](10.0, 1.0); evs, sfx.CAP = sfx.CAP, None
    if not evs: continue
    i0 = min(e[1] for e in evs); d = np.zeros((2, max(e[1] + e[2].shape[1] for e in evs) - i0))
    for e in evs: d[:, e[1] - i0 : e[1] - i0 + e[2].shape[1]] += e[2]
    m = np.abs(d).max(0); a = m > m.max() * 1e-3; on, off = int(np.argmax(a)), len(a) - int(np.argmax(a[::-1]))
    env = np.array([b.max() for b in np.array_split(m[on:off], 48)])
    data["wave"][n] = {"dur": round((off - on) / sfx.SR, 3), "env": [round(float(v), 2) for v in env / env.max()]}
Path("data.js").write_text("const DATA = " + json.dumps(data) + ";\n")
print(f"{len(skills)} skills, {len(sounds)} sounds:", ", ".join(f"{s} {lines[s]}" for s in skills))
