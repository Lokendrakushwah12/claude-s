# Expressive narration with Chatterbox (open source, runs locally). Writes voices/<slug>.wav, which
# make_cards.py uses in place of `say`. Run before make_cards.py:
#   ~/.local/share/story-video/tts-venv/bin/python narrate.py            all lines (run.sh does this)
#   ~/.local/share/story-video/tts-venv/bin/python narrate.py why dream  just these (re-roll a take you don't like)
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
import torch
from chatterbox.tts import ChatterboxTTS

from make_cards import SAY, SCRIPT

OUT = Path(__file__).parent / "voices"
REFERENCE = None  # path to a 10s+ clean clip of any voice to clone it; None = Chatterbox's built-in voice

# exaggeration: 0.5 neutral, ~0.7 expressive, 1.0+ dramatic. cfg: lower = slower, more deliberate delivery
DEFAULT = dict(exaggeration=0.65, cfg_weight=0.4)
EMOTION = {
    "idea": dict(exaggeration=0.8, cfg_weight=0.35),     # doubt
    "rejected": dict(exaggeration=0.9, cfg_weight=0.4),  # the sting
    "almost": dict(exaggeration=0.85, cfg_weight=0.3),   # low point
    "why": dict(exaggeration=1.2, cfg_weight=0.3),       # the turn: urgent
    "yours": dict(exaggeration=1.0, cfg_weight=0.35),    # the ask
    "end": dict(exaggeration=0.7, cfg_weight=0.5),
}

device = "mps" if torch.backends.mps.is_available() else "cpu"
model = ChatterboxTTS.from_pretrained(device=device)
OUT.mkdir(exist_ok=True)
only = set(sys.argv[1:])

for slug, _, text, _ in SCRIPT:
    if only and slug not in only:
        continue
    line = SAY.get(slug, re.sub(r"[\[\]|]", " ", text)).strip()
    wav = model.generate(line, audio_prompt_path=REFERENCE, **{**DEFAULT, **EMOTION.get(slug, {})})
    raw = OUT / f"{slug}.raw.wav"
    with wave.open(str(raw), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(model.sr)
        w.writeframes((np.clip(wav.squeeze().cpu().numpy(), -1, 1) * 32767).astype("<i2").tobytes())
    # 48k to match the mix, and trim the silence the model leaves at both ends so cuts stay tight
    trim = "silenceremove=start_periods=1:start_threshold=-45dB"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-af", f"{trim},areverse,{trim},areverse",
                    "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(OUT / f"{slug}.wav")], check=True)
    raw.unlink()
    print(slug, "ok")
