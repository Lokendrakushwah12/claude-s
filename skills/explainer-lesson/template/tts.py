# Chatterbox for narrate.mjs, which runs this with story-video's venv python: reads voices/todo.json
# ([{key, text}]) and writes voices/<key>.raw.wav for each line, loading the model once.
import json
import wave
from pathlib import Path

import numpy as np
import torch
from chatterbox.tts import ChatterboxTTS

VOICES = Path(__file__).parent / "voices"
REFERENCE = None  # a clean 10 s+ clip to clone that voice; None = Chatterbox's own
# A calm teacher: exaggeration 0.5 is neutral (0.8 warm, 1.0+ dramatic); a lower cfg_weight speaks slower
STYLE = dict(exaggeration=0.5, cfg_weight=0.5)

model = ChatterboxTTS.from_pretrained(device="mps" if torch.backends.mps.is_available() else "cpu")
for item in json.loads((VOICES / "todo.json").read_text()):
    audio = model.generate(item["text"], audio_prompt_path=REFERENCE, **STYLE)
    with wave.open(str(VOICES / f"{item['key']}.raw.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(model.sr)
        w.writeframes((np.clip(audio.squeeze().cpu().numpy(), -1, 1) * 32767).astype("<i2").tobytes())
    print(f"{item['n']:3} ok", flush=True)
