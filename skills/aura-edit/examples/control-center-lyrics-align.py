# /// script
# dependencies = ["faster-whisper"]
# ///
"""Times every word of lyrics.txt to the singing: faster-whisper (word timestamps) on the song's vocal stem, then the user's
words are matched to what it heard (difflib) and the misses interpolated between their matched neighbours. Writes
lyrics_times.json (numbers only: per line, each word's start), which lyrics.py prefers over the even spread.
Prints counts, never the words.   uv run lyrics_align.py [vocals.wav]"""
import difflib, json, re, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

VOC = sys.argv[1] if len(sys.argv) > 1 else "assets/vocals.wav"
lines = []  # same parse as lyrics.py: optional '<s> |', '@<s>' markers dropped, '-' lines skipped
for ln in open("lyrics.txt", encoding="utf-8"):
    ln = ln.strip()
    if not ln or ln.startswith("#"): continue
    m = re.match(r"^(\d+(?:\.\d+)?)\s*\|\s*(.*)$", ln)
    text = (m[2] if m else ln).strip()
    if text != "-": lines.append([w for w in text.split() if not re.fullmatch(r"@\d+(?:\.\d+)?", w)])
norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())
mine = [norm(w) for ws in lines for w in ws]
# decode with ffmpeg ourselves: faster-whisper's own decoder breaks on newer PyAV (open() lost metadata_errors)
pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", VOC, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
segs, _ = WhisperModel("medium.en", device="cpu", compute_type="int8").transcribe(
    np.frombuffer(pcm, "<i2").astype(np.float32) / 32768, word_timestamps=True, vad_filter=False, condition_on_previous_text=False)
# no initial_prompt with the lyrics: with one it matched 14/36 words (it echoes the prompt); without, 30/36
heard = [(norm(w.word), w.start, w.end) for s in segs for w in (s.words or []) if norm(w.word)]
at = [None] * len(mine)
sm = difflib.SequenceMatcher(None, mine, [h[0] for h in heard], autojunk=False)
for a, b, n in sm.get_matching_blocks():
    for k in range(n): at[a + k] = heard[b + k][1]
hit = sum(x is not None for x in at)
known = [i for i, x in enumerate(at) if x is not None]
if not known: sys.exit("lyrics_align: whisper matched none of the words; keep the even spread")
for i in range(len(at)):  # misses: linear between matched neighbours (before the first / after the last: 0.25 s steps)
    if at[i] is not None: continue
    lo = max([k for k in known if k < i], default=None); hi = min([k for k in known if k > i], default=None)
    if lo is None: at[i] = at[hi] - 0.25 * (hi - i)
    elif hi is None: at[i] = at[lo] + 0.25 * (i - lo)
    else: at[i] = at[lo] + (at[hi] - at[lo]) * (i - lo) / (hi - lo)
for i in range(1, len(at)): at[i] = max(at[i], at[i - 1])  # never out of order
out, k = [], 0
for ws in lines: out.append([round(max(0.0, x), 3) for x in at[k:k + len(ws)]]); k += len(ws)
json.dump({"words": out}, open("lyrics_times.json", "w"))
print(f"lyrics_align: {hit}/{len(mine)} words heard in the vocals, {len(mine) - hit} interpolated; "
      f"lines start at {', '.join(f'{ws[0]:.2f}' for ws in out if ws)} s")
