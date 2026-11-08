#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["numpy", "librosa", "soundfile"]
# ///
"""Song -> song.json (beat grid) + a printed map to plan sections from.

    uv run song.py song.mp3 song.json

Prints: tempo (librosa often reports double time for slow songs; halve it if the beats
come 0.4 s apart on a ballad), an energy bar per 4 s (loud = chorus, quiet = verse/bridge),
suggested section boundaries, and the DROP: the biggest loudness jump plus the strongest
onsets around it. Put the drop's flash cut and any title card on that measured time, not on
a section-boundary guess.
"""
import json, sys
import numpy as np, librosa

y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
tempo = float(np.atleast_1d(tempo)[0])
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr)
S = np.abs(librosa.stft(librosa.effects.harmonic(y)))
f = librosa.fft_frequencies(sr=sr); voc = S[(f > 300) & (f < 3000)].mean(0); vt = librosa.times_like(voc, sr=sr)
feat = np.vstack([librosa.util.normalize(librosa.feature.chroma_cqt(y=y, sr=sr), axis=1),
                  librosa.util.normalize(librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13), axis=1)])
bounds = librosa.frames_to_time(librosa.segment.agglomerative(feat, 12), sr=sr)
dur = len(y) / sr

print(f"tempo {tempo:.1f} bpm, {len(beats)} beats, {dur:.1f} s")
print("sections (boundary guesses):", [round(float(b), 1) for b in bounds])
for t0 in range(0, int(dur) + 1, 4):
    m = (rt >= t0) & (rt < t0 + 4); v = (vt >= t0) & (vt < t0 + 4)
    if m.any(): print(f"{t0:4d}s rms {rms[m].mean():.3f} voc {voc[v].mean():.2f} " + "#" * int(rms[m].mean() * 120))

# the drop: biggest rise in a 1 s smoothed loudness curve, then the strongest onsets near it
sm = np.convolve(rms, np.ones(43) / 43, "same")
rise = sm[43:] - sm[:-43]
j = int(np.argmax(rise)); rise_t = float(rt[j + 43 // 2])
env = librosa.onset.onset_strength(y=y, sr=sr); et = librosa.times_like(env, sr=sr)
near = (et > rise_t - 2) & (et < rise_t + 2)
top = sorted(zip(env[near], et[near]), reverse=True)[:4]
# the smoothed rise lands mid-window, ~0.5 s late: the drop is the strongest onset just before it
w = (et > rise_t - 1.0) & (et <= rise_t + 0.2)
drop = float(et[w][np.argmax(env[w])])
print(f"DROP {drop:.3f} s (strongest onset at the biggest loudness rise ~{rise_t:.2f} s); onsets near it:",
      [(round(float(t), 3), round(float(e), 1)) for e, t in top])
json.dump({"tempo": tempo, "beats": [round(float(b), 3) for b in beats], "sections": [round(float(b), 2) for b in bounds],
           "drop": round(drop, 3), "duration": round(dur, 3)}, open(sys.argv[2], "w"))
