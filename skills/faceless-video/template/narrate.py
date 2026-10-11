# Chatterbox narration, one take per line of film.json -> voices/<id>.wav (48 kHz mono, silence trimmed). Runs in the
# story-video TTS venv (sh ~/.claude/skills/story-video/setup.sh makes it):
#   ~/.local/share/story-video/tts-venv/bin/python narrate.py          every line
#   ~/.local/share/story-video/tts-venv/bin/python narrate.py l3 l5    re-roll just these
# A faceless voice is a person talking, not an announcer: exaggeration 0.5-0.6 and cfg 0.45 read calm and close (#29's
# monologue); push a line to 0.8 only where the script turns. build.py prints "??" for a take whisper hears differently.
import json, subprocess, sys, wave
from pathlib import Path

import numpy as np
import torch
from chatterbox.tts import ChatterboxTTS

F = json.loads(Path("film.json").read_text())
V = {"exaggeration": 0.55, "cfg_weight": 0.45, **{k: v for k, v in (F.get("tts") or {}).items() if k != "reference"}}
OUT = Path("voices"); OUT.mkdir(exist_ok=True)
model = ChatterboxTTS.from_pretrained(device="mps" if torch.backends.mps.is_available() else "cpu")
only = set(sys.argv[1:])
for L in F["lines"]:
    if only and L["id"] not in only: continue
    wav = model.generate(L.get("tts_text", L["say"]), audio_prompt_path=(F.get("tts") or {}).get("reference"),
                         **{**V, **{k: L[k] for k in ("exaggeration", "cfg_weight") if k in L}})
    raw = OUT / f"{L['id']}.raw.wav"
    with wave.open(str(raw), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(model.sr)
        w.writeframes((np.clip(wav.squeeze().cpu().numpy(), -1, 1) * 32767).astype("<i2").tobytes())
    trim = "silenceremove=start_periods=1:start_threshold=-45dB"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(raw), "-af", f"{trim},areverse,{trim},areverse",
                    "-ar", "48000", "-ac", "1", str(OUT / f"{L['id']}.wav")], check=True)
    raw.unlink(); print(L["id"], "ok")
