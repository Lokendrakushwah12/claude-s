# Narration for a voiced film -> voices/<id>.wav (48 kHz mono, silence trimmed at both ends), one take per LINES row.
# Two engines (measured 2026-10-17 on Hinglish lines, M-series Mac):
#   kokoro      82M, Apache-2.0, ~1-9 s a line, 4 Hindi voices; no babble in 12 test takes. Flatter delivery.
#   chatterbox  expressive (exaggeration / cfg_weight per line), ~2 min a line in Hindi, babbled on 5 of 17 Hindi takes.
#   ENGINE=kokoro uv run --python 3.12 --with "kokoro>=0.9.4" --with soundfile --with "misaki[en]" narrate.py [id ...]
#   ENGINE=chatterbox ~/.local/share/story-video/tts-venv/bin/python narrate.py [id ...]
# Kokoro needs `brew install espeak-ng`. Chatterbox needs story-video/setup.sh; Hindi pulls the multilingual model (~3 GB).
# Then run assemble.py: it checks every take and trims any that runs on past its line.
import os
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

from lines import LANG, LINES

OUT = Path(__file__).parent / "voices"
ENGINE = os.environ.get("ENGINE", "kokoro")
VOICE = {"en": "af_heart", "hi": "hm_omega"}[LANG]  # kokoro; Hindi also hf_alpha hf_beta hm_psi
SPEED = 1.0                                           # kokoro; 1.1-1.2 for a brisk reel read
REFERENCE = None  # chatterbox: a clean 10 s+ clip to clone a voice (the user's own recording works)
DEFAULT = dict(exaggeration=0.6, cfg_weight=0.45)    # chatterbox; Hindi babbled less at 0.5 / 0.5
EMOTION = {}      # chatterbox: id -> dict(exaggeration=..., cfg_weight=...)

only = set(sys.argv[1:])
OUT.mkdir(exist_ok=True)
if ENGINE == "kokoro":
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
    from kokoro import KPipeline
    pipe = KPipeline(lang_code={"en": "a", "hi": "h"}[LANG])
    gen, sr = (lambda text, lid: np.concatenate([r.audio.numpy() for r in pipe(text, voice=VOICE, speed=SPEED)])), 24000
else:
    import torch
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    if LANG == "en":
        from chatterbox.tts import ChatterboxTTS
        model = ChatterboxTTS.from_pretrained(device=device); kw = {}
    else:
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        model = ChatterboxMultilingualTTS.from_pretrained(device=device); kw = {"language_id": LANG}
    def gen(text, lid):
        torch.manual_seed(7 + len(lid) + (100 if only else 0))  # a re-roll gets a new take
        return model.generate(text, audio_prompt_path=REFERENCE, **kw, **{**DEFAULT, **EMOTION.get(lid, {})}).squeeze().cpu().numpy()
    sr = model.sr

for lid, _, _, spoken in LINES:
    if only and lid not in only:
        continue
    raw = OUT / f"{lid}.raw.wav"
    with wave.open(str(raw), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(gen(spoken, lid), -1, 1) * 32767).astype("<i2").tobytes())
    trim = "silenceremove=start_periods=1:start_threshold=-45dB"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-af", f"{trim},areverse,{trim},areverse",
                    "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(OUT / f"{lid}.wav")], check=True)
    raw.unlink()
    print(lid, "ok", flush=True)
