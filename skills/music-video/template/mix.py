# /// script
# dependencies = ["numpy", "scipy", "matplotlib"]
# ///
"""cues.json -> audio.wav for a spoken-word lyric film (node render.mjs --cues && uv run mix.py).
It's sfx.py's mix (copied in from promo-video), balanced like a song rather than a narration: the bed sits 6 dB under
the voice and ducks only 2 dB more while it speaks (sfx.py's default is 12 under, coming back up 8 in every pause)."""
import json

import sfx

sfx.LEVEL.update(music=-6, duck=2)
sfx.render(json.load(open("cues.json")))
