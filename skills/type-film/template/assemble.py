# voices/<id>.wav -> voice.wav (the takes in order, LINES' gaps between them) + timeline.js (each line's start and end, and
# each caption word's onset, on the film's clock). Load timeline.js before video.js; video.js reads window.TL.
#   uv run --with faster-whisper --with numpy assemble.py
# Every take is transcribed in its own language and printed so you can check it. A take that runs on past its line
# (whisper hears more than 2 words over the spoken text) is cut 120 ms after its last real word: Chatterbox's Hindi takes
# sometimes add 10-20 s of babble after a correct sentence. Garbled words inside a line still need a re-roll (narrate.py <id>).
import json
import re
import shutil
import wave
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel

from lines import LANG, LINES

HERE = Path(__file__).parent
LEAD, TAIL, SR = 0.25, 1.6, 48000  # silence before the first word; hold after the last (the end card)
model = WhisperModel("medium", device="cpu", compute_type="int8")


def read(p):
    with wave.open(str(p)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768


def hear(x):
    x16 = np.interp(np.arange(0, len(x), SR / 16000), np.arange(len(x)), x).astype(np.float32)
    segs, _ = model.transcribe(np.pad(x16, 8000), language=LANG, word_timestamps=True, beam_size=5)
    return [w for s in segs for w in s.words]  # times include the 0.5 s pad


out, rows, t = [np.zeros(int(LEAD * SR), np.float32)], [], LEAD
for lid, gap, caption, spoken in LINES:
    if rows:
        out.append(np.zeros(int(gap * SR), np.float32)); t += gap
    path = HERE / "voices" / f"{lid}.wav"; x = read(path); ww = hear(x); n = len(spoken.split())
    if len(ww) > n + 2:  # ran on: keep the first n words
        cut = min(len(x), int((ww[n - 1].end - 0.5 + 0.12) * SR)); shutil.copy(path, path.with_suffix(".full.wav"))
        x = x[:cut] * np.minimum(1, np.arange(cut)[::-1] / (0.06 * SR)).astype(np.float32); ww = ww[:n]
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype("<i2").tobytes())
        print(f"{lid}: trimmed a run-on take to {cut / SR:.2f} s (the full take is {path.stem}.full.wav)")
    dur, C = len(x) / SR, caption.split()
    if len(ww) == len(C):  # one heard word per caption word: whisper's onsets
        on = [max(0.0, w.start - 0.5) for w in ww]
    else:  # otherwise spread the caption words over the voiced span by their length
        s0 = max(0.0, ww[0].start - 0.5) if ww else 0.0; e1 = min(dur, ww[-1].end - 0.5) if ww else dur
        wt = np.array([len(re.sub(r"\W", "", c)) + 2 for c in C], float); cum = np.concatenate([[0], np.cumsum(wt)[:-1]]) / wt.sum()
        on = list(s0 + cum * (e1 - s0))
    rows.append({"id": lid, "t0": round(t, 3), "t1": round(t + dur, 3), "words": [{"w": c, "t": round(t + o, 3)} for c, o in zip(C, on)]})
    print(f"{lid:8} {t:6.2f}-{t + dur:6.2f}  {len(C) / dur:4.1f} w/s  {'=' if len(ww) == len(C) else '~'}  {' '.join(w.word.strip() for w in ww)}")
    out.append(x); t += dur

out.append(np.zeros(int(TAIL * SR), np.float32))
y = (np.clip(np.concatenate(out), -1, 1) * 32767).astype("<i2")
with wave.open(str(HERE / "voice.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(y.tobytes())
(HERE / "timeline.js").write_text("window.TL = " + json.dumps({"lines": rows, "duration": round(len(y) / SR, 3)}) + ";\n")
print(f"voice.wav {len(y) / SR:.2f} s, timeline.js written")
