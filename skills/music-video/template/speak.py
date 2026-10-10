# Spoken-word vocal: perform lyrics.txt with Chatterbox (local), one take per line -> voices/01.wav, 02.wav, ...
# Always under the shared TTS lock (other skills narrate too), with story-video's venv:
#   python3 ~/.cache/claude-s/ttslock.py ~/.local/share/story-video/tts-venv/bin/python speak.py        every line
#   python3 ~/.cache/claude-s/ttslock.py ~/.local/share/story-video/tts-venv/bin/python speak.py 3 5    re-roll lines 3 and 5
# Then `uv run align.py --spoken --bpm <bpm>` places the takes on the grid and times every word.
import subprocess, sys, wave
from pathlib import Path

import numpy as np
import torch
from chatterbox.tts import ChatterboxTTS

REFERENCE = None  # a clean 10 s+ clip of a voice to clone; None = Chatterbox's built-in voice
STYLE = dict(exaggeration=0.6, cfg_weight=0.45)  # exaggeration up = more performed; cfg down = slower, more deliberate
PER_LINE = {}  # e.g. {4: dict(exaggeration=0.8, cfg_weight=0.35)} for the turn

lines = [s.strip() for s in Path("lyrics.txt").read_text().splitlines() if s.strip()]
only = {int(a) for a in sys.argv[1:]}
model = ChatterboxTTS.from_pretrained(device="mps" if torch.backends.mps.is_available() else "cpu")
Path("voices").mkdir(exist_ok=True)
for i, line in enumerate(lines, 1):
    if only and i not in only:
        continue
    wav = model.generate(line, audio_prompt_path=REFERENCE, **{**STYLE, **PER_LINE.get(i, {})})
    raw = Path(f"voices/{i:02d}.raw.wav")
    with wave.open(str(raw), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(model.sr)
        w.writeframes((np.clip(wav.squeeze().cpu().numpy(), -1, 1) * 32767).astype("<i2").tobytes())
    # 48 kHz like the mix; trim the model's silence at both ends so the take starts on its first word
    trim = "silenceremove=start_periods=1:start_threshold=-45dB"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-af", f"{trim},areverse,{trim},areverse",
                    "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", f"voices/{i:02d}.wav"], check=True)
    raw.unlink()
    print(f"{i:02d} {line}")
