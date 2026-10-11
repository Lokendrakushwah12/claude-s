# Soundtrack for the cards: story-video's cues handed to sfx.py, the shared engine (a byte-for-byte copy of
# promo-video/template/sfx.py; its docstring lists every sound). sfx.py ducks the music 12 dB under the voice and lets it
# back up in pauses over 0.3 s, sets every SFX by family against the voice, and masters to -14 LUFS.
# Run after make_cards.py:  uv run --with numpy --with scipy --with pillow make_audio.py      (SFX=none: music only)
import json
import os
from pathlib import Path

import sfx
from make_cards import GAP, SCRIPT

HERE = Path(__file__).parent
FPS = 30000 / 1001
manifest = json.loads((HERE / "cards/manifest.json").read_text())
starts, n = [], 0  # card start times on the frame grid the clips were encoded on
for m in manifest:
    starts.append(n / FPS)
    n += m["frames"]

# Sound per card style: (offset from the cut, sfx.py name, gain). Hard cuts hit; crossfaded text cards stay quiet.
STYLE_CUE = {
    "photo": [(-0.05, "passby", 0.8), (0, "sub_boom", 1)],  # passby peaks just before the cut, the sub lands on it
    "why": [(-0.05, "passby", 0.8), (0, "sub_boom", 1)],    # the drop
    "white": [(0, "suck_in", 1)],                           # emphasis: the suck-in ends on the word
    "end": [(0, "sub_boom", 1)],                            # out of the gap; the echo below ends the bed, no stinger
}
CUE = {}  # per-slug override, e.g. {"rejected": [(0, "suck_in", 1)]}. Any sfx.py sound works
LEAD = {"passby", "suck_in", "sub_swell", "whoosh", "riser"}  # these sound BEFORE the cut, so a GAP card drops them
NO_SFX = os.environ.get("SFX") == "none"  # the music alone carries the cuts; gap and echo still play (they're the bed)

rows = []
for at, (slug, style, *_) in zip(starts, SCRIPT):
    if not NO_SFX:
        rows += [[at + dt, name, g] for dt, name, g in CUE.get(slug, STYLE_CUE.get(style, [])) if not (slug in GAP and name in LEAD)]
    if slug in GAP:
        rows.append([at, "gap", 1, {"dur": GAP[slug]}])  # silence the bed while the held card runs out
rows.append([starts[-1], "echo", 1])  # the bed stops on the end card and its last note echoes out

# Bed: 16th plucks over a soft pad, then four-on-the-floor from the drop on the `why` card to the end card
DROP = starts[[s[0] for s in SCRIPT].index("why")]
BPM = 240 * max(1, round(DROP * 124 / 240)) / DROP  # ponytail: ~124, nudged so the drop lands on a bar line
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G, one per bar
# sfx.py sets the whole music bus by its mean level, so the sparse half needs its own gain or it vanishes (it measured
# 32 dB under the voice at 1/1). At 2.5/0.6 the arp sits ~17 dB under the voice and the groove ~10 dB: a lift at the drop
SECTIONS = [[0, "arp", 2.5], [DROP, "groove", 0.6]]

cues = {"duration": n / FPS, "sfx": rows,
        "vo": [[at + 0.05, m["voice"]] for at, m in zip(starts, manifest) if m["voice"]],  # cut 50 ms before the word
        "bed": {"bpm": BPM, "chords": CHORDS, "sections": SECTIONS}}
(HERE / "cues.json").write_text(json.dumps(cues))  # what `uv run sfx.py --plot` reads for its labels
sfx.render(cues, str(HERE / "audio.wav"))
