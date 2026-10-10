# Synthesised soundtrack for the cards: no audio files. Oscillator + filtered-noise palette with a chord bed,
# ported from a Web Audio lesson player.
# Run after make_cards.py:  uv run --with numpy --with pillow make_audio.py
import json
import wave
from pathlib import Path

import numpy as np

SR = 48000
FPS = 30000 / 1001
HERE = Path(__file__).parent
manifest = json.loads((HERE / "cards/manifest.json").read_text())

# Card start times on the same frame grid the clips were encoded on
starts, t = [], 0
for m in manifest:
    starts.append(t / FPS)
    t += round(m["seconds"] * FPS)
DURATION = t / FPS + 2.5  # tail so the last chord rings out
out = np.zeros(int(DURATION * SR))


def env(n, peak, attack, hold, release):
    """Exponential attack/hold/release envelope."""
    a, h, r = int(attack * SR), int(hold * SR), int(release * SR)
    lo, peak = 1e-4, max(peak, 2e-4)
    e = np.concatenate([lo * (peak / lo) ** np.linspace(0, 1, a, endpoint=False), np.full(h, peak),
                        peak * (lo / peak) ** np.linspace(0, 1, r)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def add(at, sig):
    i = int(at * SR)
    sig = sig[: max(0, len(out) - i)]
    out[i:i + len(sig)] += sig


def tone(at, freq, peak, release, to=None, glide=None, attack=0.005, hold=0.0, kind="sine"):
    n = int((attack + hold + release + 0.05) * SR)
    f = np.full(n, float(freq))
    if to:
        g = int((glide or release) * SR)
        f[:g] = freq * (to / freq) ** np.linspace(0, 1, g)
        f[g:] = to
    phase = 2 * np.pi * np.cumsum(f) / SR
    wav = {"sine": np.sin(phase),
           "triangle": 2 / np.pi * np.arcsin(np.sin(phase)),
           "square": np.sign(np.sin(phase)) * 0.5}[kind]  # ponytail: no lowpass on square/triangle; tick/pad are quiet enough
    add(at, wav * env(n, peak, attack, hold, release))


_rng = np.random.default_rng(1)  # fixed seed, same sound every render


def noise(at, length, f_from, f_to, peak, attack=None):
    n = int((length + 0.1) * SR)
    x = _rng.uniform(-1, 1, n)
    # one-pole lowpass with a swept cutoff, minus a heavier lowpass = rough bandpass sweep
    fc = f_from * (f_to / f_from) ** np.clip(np.arange(n) / (length * SR), 0, 1)
    k = 1 - np.exp(-2 * np.pi * fc / SR)
    lp, lp2, y = 0.0, 0.0, np.empty(n)
    for i in range(n):
        lp += k[i] * (x[i] - lp)
        lp2 += 0.02 * (lp - lp2)
        y[i] = lp - lp2
    attack = attack if attack is not None else length * 0.5
    add(at, y * 3 * env(n, peak, attack, 0, max(0.05, length - attack)))


# The palette
def pop(at, g=1, p=1): tone(at, 620 * p, 0.35 * g, 0.16, to=300 * p, glide=0.1)
def blip(at, g=1, p=1): tone(at, 880 * p, 0.16 * g, 0.12, kind="triangle")
def thud(at, g=1, p=1): tone(at, 120 * p, 0.5 * g, 0.32, to=55 * p, glide=0.25)
def tick(at, g=1, p=1): tone(at, 1800 * p, 0.035 * g, 0.035, kind="square")
def whoosh(at, g=1, length=0.6): noise(at, length, 300, 2600, 0.22 * g)
def chime(at, g=1, p=1):
    tone(at, 660 * p, 0.2 * g, 1.8); tone(at, 990 * p, 0.08 * g, 1.4); tone(at, 1320 * p, 0.04 * g, 1)


# Cue per card style: what the picture is doing on that cut
STYLE_CUE = {"photo": whoosh, "white": pop, "serif": blip, "sans": tick, "why": thud, "end": chime}
from make_cards import SCRIPT  # noqa: E402  style lives in the card script
for at, (_, style, _, _) in zip(starts, SCRIPT):
    STYLE_CUE[style](at)

# Narration from make_cards.py: each line starts as its card appears
VOICE_GAIN = 0.8
for at, m in zip(starts, manifest):
    if m.get("voice"):
        with wave.open(m["voice"]) as w:
            assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2
            add(at + 0.05, VOICE_GAIN * np.frombuffer(w.readframes(w.getnframes()), "<i2") / 32768)

# Music bed: held pad + eighth-note arpeggio per bar
BPM, GAIN = 124, 0.06
# The arc: calm until "why can't I?", then a kick and offbeat hats drive to the end card
DROP = starts[[c[0] for c in SCRIPT].index("why")]
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]  # Am F C G
hz = lambda midi: 440 * 2 ** ((midi - 69) / 12)
bar, music_end = 4 * 60 / BPM, t / FPS
i = 0
while i * bar < music_end - 1:
    chord, start = CHORDS[i % len(CHORDS)], i * bar
    length = min(bar, music_end - start)
    last = (i + 1) * bar >= music_end - 1
    for n in chord:
        tone(start, hz(n), GAIN * 0.55, 2.5 if last else 0.9, attack=min(0.6, length / 3), hold=max(0, length - 0.6), kind="triangle")
    for k in range(8):
        at = start + k * bar / 8
        if at >= music_end - 0.5:
            break
        n = chord[k % len(chord)] + 12 + (12 * (k % 2) if k >= 4 else 0)
        tone(at, hz(n), GAIN * (0.5 if k % 4 == 0 else 0.3), 0.35)
        if at >= DROP:
            if k % 2 == 0:
                thud(at, g=0.45)
            else:
                tick(at, g=2.5)
    i += 1

out = out / max(1.0, np.abs(out).max() / 0.9)  # never clip
pcm = (out * 32767).astype("<i2")
with wave.open(str(HERE / "audio.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print(f"audio.wav {DURATION:.1f}s, peak {np.abs(out).max():.2f}")
