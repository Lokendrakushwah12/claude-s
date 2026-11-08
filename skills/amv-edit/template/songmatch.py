#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["numpy", "librosa", "soundfile"]
# ///
"""Find which stretch of a song a reference edit uses, so a new edit can use the same audio.

    uv run songmatch.py ref.mp4 song.mp3

Matches chroma (harmony) plus onset envelopes (rhythm) of the reference's audio against every
offset of the song. Prints the top 3 offsets (choruses repeat, so check the best is clearly ahead)
and how much of the reference's audio is NOT the song (low = the song alone; high = voice/SFX on top).
Use the top offset as plan "song_start" and the reference's length as "end".
"""
import os, subprocess, sys, tempfile
import numpy as np, librosa

ref, song = sys.argv[1], sys.argv[2]
tmp = tempfile.mkdtemp()
def wav(src, name):  # librosa can't read audio straight out of an mp4
    out = os.path.join(tmp, name)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-vn", "-ac", "1", "-ar", "11025", out], check=True)
    return librosa.load(out, sr=None)[0]
y, r = wav(song, "song.wav"), wav(ref, "ref.wav")
sr, hop = 11025, 256
cs, cr = (librosa.feature.chroma_cqt(y=a, sr=sr, hop_length=hop) for a in (y, r))
os_, or_ = (librosa.onset.onset_strength(y=a, sr=sr, hop_length=hop) for a in (y, r))
n = cr.shape[1]
scores = []
for i in range(cs.shape[1] - n):
    c = (cs[:, i:i + n] * cr).sum() / (np.linalg.norm(cs[:, i:i + n]) * np.linalg.norm(cr) + 1e-9)
    scores.append((c + np.corrcoef(os_[i:i + n], or_)[0, 1], i))
scores.sort(reverse=True)
for s, i in scores[:3]:
    print(f"score {s:.3f}: song {i * hop / sr:.2f} s -> {(i * hop + len(r)) / sr:.2f} s")
i = scores[0][1] * hop; seg = y[i:i + len(r)]; k = min(len(seg), len(r))
g = np.dot(seg[:k], r[:k]) / max(np.dot(seg[:k], seg[:k]), 1e-9)
print(f"reference length {len(r) / sr:.2f} s; audio that isn't the song: "
      f"{20 * np.log10(np.std(r[:k] - g * seg[:k]) / np.std(r[:k]) + 1e-9):.1f} dB (0 dB = can't separate; try by ear)")
