# Transcribe every take and flag the ones that don't say their line. A garbled take passes any length check
# ("Hours. Gone." came back as "Algolers gone!" at 1.56 s). Run after narrate.py:
#   uv run --with faster-whisper --with pillow check_voices.py [slug ...]
# "??" can also be whisper's spelling (digits, homophones); listen to those. The model downloads on first use.
import re
import sys
import wave
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

from make_cards import SAY, SCRIPT

model = WhisperModel("small.en", device="cpu", compute_type="int8")
words = lambda s: re.sub(r"[^a-z0-9 ]", "", s.lower().replace("-", " ").replace(".", "")).split()
for slug, _, text, _ in SCRIPT:
    if sys.argv[1:] and slug not in sys.argv[1:]:
        continue
    want = SAY.get(slug, re.sub(r"[\[\]|]", " ", text))
    with wave.open(str(Path(__file__).parent / "voices" / f"{slug}.wav")) as w:
        x, sr = np.frombuffer(w.readframes(w.getnframes()), "<i2") / 32768, w.getframerate()
    # a numpy array, not the path: faster-whisper decodes files with PyAV, which is broken on some installs
    x = np.interp(np.arange(0, len(x), sr / 16000), np.arange(len(x)), x).astype(np.float32)
    got = " ".join(s.text.strip() for s in model.transcribe(np.pad(x, 8000), language="en", beam_size=5)[0])
    print(f"{'ok' if words(got) == words(want) else '??'} {slug:10} {len(x) / 16000:4.2f}s  {want!r} -> {got!r}")
