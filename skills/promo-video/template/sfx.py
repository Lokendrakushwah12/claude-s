# /// script
# dependencies = ["numpy", "scipy"]
# ///
"""Soundtrack for the promo: a synthesised music bed (VIDEO.bed) + SFX cues (VIDEO.sfx) + optional licensed track
(VIDEO.music), mixed, reverbed, and loudness-normalised to -14 LUFS -> audio.wav (48 kHz stereo).

    node render.mjs --cues && uv run sfx.py

VIDEO.bed = { bpm: 120, sections: [[0,'intro'],[2.5,'groove'],[6.5,'break'],[8.5,'drive'],[12.5,'end']],
              chords: [[53,57,60,64],[55,59,62,67],[57,60,64,69],[52,55,59,64]] }   // MIDI, one chord per bar
Sections: intro (pad + soft arp, riser into the next section), groove (four-on-the-floor house), break (no kick,
open pad, 16th hats, snare roll at its end), drive (full + open hats), end (big hit on its start, then the tail).
Put section starts ON the beat grid (multiples of 60/bpm) and put scene cuts on those same times.
SFX: tick blip pop thud whoosh swoosh riser chime impact click type. Cue = [time, name] or [time, name, gain].
"""
import json, subprocess, wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
cues = json.loads(Path("cues.json").read_text())
DUR = cues["duration"]
N = int((DUR + 0.05) * SR)
rng = np.random.default_rng(7)
dry = np.zeros((2, N)); verb = np.zeros((2, N)); side = np.ones(N)  # side = sidechain gain (ducks under kicks)
duck_dry = np.zeros((2, N)); duck_verb = np.zeros((2, N))  # pads/bass: multiplied by `side` at mixdown, after every kick is placed


def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def env(n, a, r, hold=0.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a - hold) / max(r, 1e-4))


def put(at, sig, gain=1.0, pan=0.0, send=0.0, duck=False):
    """Mix mono or stereo sig at time `at`. pan -1..1, send = reverb amount."""
    i = int(at * SR)
    if i >= N: return
    sig = np.atleast_2d(sig);  sig = np.vstack([sig, sig]) if sig.shape[0] == 1 else sig
    sig = sig[:, : N - i] * gain
    lr = np.array([[np.cos((pan + 1) * np.pi / 4)], [np.sin((pan + 1) * np.pi / 4)]]) * 1.414
    d, v = (duck_dry, duck_verb) if duck else (dry, verb)
    d[:, i : i + sig.shape[1]] += sig * lr * (1 - send * 0.3); v[:, i : i + sig.shape[1]] += sig * lr * send


def osc(freq, n, kind="saw", detune=0.0):
    ph = np.cumsum(np.broadcast_to(freq * (1 + detune), (n,))) / SR
    if kind == "saw": return 2 * (ph % 1) - 1
    if kind == "tri": return 2 * np.abs(2 * (ph % 1) - 1) - 1
    if kind == "sq": return np.sign(np.sin(2 * np.pi * ph))
    return np.sin(2 * np.pi * ph)


midi = lambda m: 440 * 2 ** ((m - 69) / 12)
noise = lambda n: rng.standard_normal(n)

# ---------- drums ----------
def kick(at, g=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 110 * np.exp(-t / 0.035); body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.22)
    click = filt(noise(n), "high", 2500) * env(n, 0.0005, 0.004) * 0.4
    put(at, np.tanh((body + click) * 1.6) * 0.95, g)
    i = int(at * SR); m = min(N - i, int(0.35 * SR))
    if m > 0: side[i : i + m] = np.minimum(side[i : i + m], 1 - 0.75 * np.exp(-np.arange(m) / SR / 0.09))

def clap(at, g=1.0):
    n = int(0.35 * SR); x = filt(noise(n), "band", [900, 3200])
    e = sum(env(n, 0.0005, 0.008) * (np.arange(n) >= int(k * SR)) for k in (0, 0.011, 0.022)) + env(n, 0.0005, 0.12) * 0.7
    put(at, x * e * 0.55, g, send=0.35)

def hat(at, g=1.0, open_=False, pan=0.0):
    n = int((0.3 if open_ else 0.06) * SR); x = filt(noise(n), "high", 8000)
    put(at, x * env(n, 0.0005, 0.09 if open_ else 0.018) * 0.28, g, pan=pan, send=0.1)

def snare(at, g=1.0):
    n = int(0.25 * SR); x = filt(noise(n), "band", [1500, 7000]) * env(n, 0.0005, 0.07) + np.sin(2 * np.pi * 190 * np.arange(n) / SR) * env(n, 0.0005, 0.05) * 0.5
    put(at, x * 0.45, g, send=0.25)

# ---------- tonal ----------
def pad(chord, at, length, cutoff=1400, g=1.0):
    n = int((length + 0.8) * SR); L = np.zeros(n); R = np.zeros(n)
    for m in chord:
        L += osc(midi(m), n, "saw", -0.004) + osc(midi(m), n, "saw", 0.003) * 0.6
        R += osc(midi(m), n, "saw", 0.004) + osc(midi(m), n, "saw", -0.002) * 0.6
    e = env(n, 0.25, 0.5, hold=length - 0.25)
    put(at, np.vstack([filt(L, "low", cutoff), filt(R, "low", cutoff)]) * e * 0.045, g, send=0.5, duck=True)

def bass(m, at, length, g=1.0):
    n = int(length * SR); x = osc(midi(m), n, "saw") * 0.6 + osc(midi(m), n, "sine") * 0.8
    put(at, filt(x, "low", 420) * env(n, 0.004, length * 0.6) * 0.42, g, duck=True)

def pluck(m, at, g=1.0, pan=0.0):
    n = int(0.5 * SR); x = osc(midi(m), n, "tri") + osc(midi(m) * 2, n, "sine") * 0.3
    put(at, filt(x, "low", 3500) * env(n, 0.002, 0.14) * 0.16, g, pan=pan, send=0.45)

# ---------- fx ----------
def sweep_noise(length, f0, f1, attack, band=0.5):
    n = int(length * SR); x = noise(n); out = np.zeros(n); step = int(0.01 * SR)
    for s in range(0, n, step):  # stepped band-pass sweep: cheap and smooth enough
        fc = f0 * (f1 / f0) ** (s / n); lo, hi = fc * (1 - band / 2), min(fc * (1 + band / 2), SR / 2 - 100)
        out[s : s + step] = filt(x[max(0, s - 2048) : s + step], "band", [max(lo, 30), hi])[-len(x[s : s + step]):]
    shape = np.minimum(1, np.arange(n) / (attack * SR)) ** 2 * np.linspace(1, 0, n) ** 0.7
    return out * shape

def whoosh(at, g=1.0):
    x = sweep_noise(0.55, 400, 6000, 0.38); put(at - 0.38, np.vstack([x, np.roll(x, 240)]) * 0.5, g, send=0.4)
def swoosh(at, g=1.0):
    x = sweep_noise(0.4, 6000, 500, 0.03); put(at, np.vstack([np.roll(x, 240), x]) * 0.4, g, send=0.4)
def riser(at, length=1.5, g=1.0):  # ends AT `at`
    n = int(length * SR); x = sweep_noise(length, 300, 9000, length * 0.95, band=0.8) * 0.5
    t = np.arange(n) / SR; tone = osc(220 * 2 ** (2 * t / length), n, "saw") * (t / length) ** 3 * 0.05
    put(at - length, x + filt(tone, "low", 4000), g, send=0.5)
def impact(at, g=1.0):
    kick(at, 1.1 * g); n = int(2.5 * SR); t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-t / 0.2)) / SR) * env(n, 0.002, 0.8) * 0.7
    crash = filt(noise(n), "high", 3000) * env(n, 0.001, 0.6) * 0.18
    put(at, boom, g); put(at, np.vstack([crash, np.roll(crash, 480)]), g, send=0.6)
def chime(at, g=1.0):
    for k, (m, a) in enumerate([(84, 0.14), (88, 0.1), (91, 0.08), (96, 0.05)]):
        n = int(2 * SR); put(at + k * 0.03, osc(midi(m), n, "sine") * env(n, 0.002, 0.7) * a, g, pan=(k - 1.5) * 0.3, send=0.6)

SFX = {
    "tick": lambda at, g: put(at, filt(noise(int(0.02 * SR)), "high", 4000) * env(int(0.02 * SR), 0.0003, 0.004) * 0.25, g, pan=rng.uniform(-0.3, 0.3)),
    "type": lambda at, g: put(at, filt(noise(int(0.03 * SR)), "band", [1800, 6000]) * env(int(0.03 * SR), 0.0003, 0.006) * 0.35
                               + osc(rng.uniform(180, 240), int(0.03 * SR), "sine") * env(int(0.03 * SR), 0.0005, 0.008) * 0.2, g, pan=rng.uniform(-0.25, 0.25), send=0.05),
    "click": lambda at, g: put(at, (osc(1800, 1200, "sine") * env(1200, 0.0003, 0.004) + filt(noise(1200), "high", 3000) * env(1200, 0.0003, 0.002) * 0.5) * 0.4, g),
    "blip": lambda at, g: put(at, osc(1320, int(0.15 * SR), "tri") * env(int(0.15 * SR), 0.002, 0.05) * 0.18, g, pan=rng.uniform(-0.5, 0.5), send=0.4),
    "pop": lambda at, g: put(at, osc(np.geomspace(900, 380, int(0.12 * SR)), int(0.12 * SR), "sine") * env(int(0.12 * SR), 0.001, 0.04) * 0.4, g, send=0.25),
    "thud": lambda at, g: (kick(at, 0.9 * g), put(at, filt(noise(int(0.2 * SR)), "low", 900) * env(int(0.2 * SR), 0.001, 0.05) * 0.4, g)),
    "whoosh": lambda at, g: whoosh(at, g), "swoosh": lambda at, g: swoosh(at, g),
    "riser": lambda at, g: riser(at, 1.5, g), "impact": lambda at, g: impact(at, g), "chime": lambda at, g: chime(at, g),
}

# ---------- arrangement ----------
bed = cues.get("bed")
if bed:
    beat = 60 / bed["bpm"]; bar = beat * 4; chords = bed["chords"]; secs = bed["sections"] + [[DUR, "_"]]
    for (s0, kind), (s1, _) in zip(secs, secs[1:]):
        if kind == "end":
            impact(s0); ch = chords[0]; pad(ch, s0, DUR - s0 - 0.8, 2600, 1.4); bass(ch[0] - 24, s0, 2.5, 1.2)
            for k, m in enumerate(ch + [ch[0] + 12]): pluck(m + 12, s0 + k * beat / 4, 0.9, pan=(k - 2) * 0.3)
            continue
        cut = {"intro": 700, "groove": 1500, "break": 2600, "drive": 2200}[kind]
        b = 0; t = s0
        while t < s1 - 1e-6:
            bi = int(round((t - secs[0][0]) / bar)); ch = chords[bi % len(chords)]; blen = min(bar, s1 - t)
            pad(ch, t, blen, cut, 0.7 if kind == "intro" else 1.0)
            for k in range(int(round(blen / beat))):
                tb = t + k * beat
                if kind == "drive" and tb >= s1 - beat / 2 - 1e-6: continue  # the pre-drop gap
                if kind in ("groove", "drive"):
                    kick(tb); hat(tb + beat / 2, 0.9, open_=kind == "drive", pan=0.2)
                    if k % 2 == 1: clap(tb)
                    bass(ch[0] - 24, tb + beat / 2, beat / 2 * 0.9)
                    for q in (1, 3): hat(tb + q * beat / 4, 0.35, pan=-0.3)
                if kind == "break":
                    for q in range(4): hat(tb + q * beat / 4, 0.3 + 0.2 * (q == 2), pan=0.3 if q % 2 else -0.3)
                    if k == 0: bass(ch[0] - 24, tb, blen * 0.95, 0.9)
                if kind != "intro" or k % 2 == 0:  # arp: 8ths, chord tones up an octave
                    for e8 in (0, 1): pluck(ch[(k * 2 + e8) % len(ch)] + 12, tb + e8 * beat / 2, 0.8 if kind != "intro" else 0.5, pan=0.4 if e8 else -0.4)
            t += bar
        if kind == "break":  # snare roll into what follows
            for k in range(8): snare(s1 - beat + k * beat / 8, 0.3 + 0.08 * k)
        if kind in ("intro", "drive"): riser(s1, min(1.5, s1 - s0))
        if kind == "drive": side[int((s1 - beat / 2) * SR) : int(s1 * SR)] = 0.0  # half-beat of silence before the end hit

for cue in cues["sfx"]:
    at, name, gain = (cue + [1.0])[:3]
    SFX[name](at, gain)

if cues.get("music"):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", cues["music"], "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    m = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T[:, :N].astype(float); m = np.pad(m, ((0, 0), (0, N - m.shape[1])))
    dry += m * 0.8 * np.clip((N - np.arange(N)) / (1.5 * SR), 0, 1)

dry += duck_dry * side; verb += duck_verb * side

# reverb: stereo exponentially-decaying noise IR, pre-filtered
n_ir = int(2.2 * SR); t = np.arange(n_ir) / SR
ir = [filt(noise(n_ir), "low", 7000) * np.exp(-t / 0.55) * (t > 0.012) for _ in range(2)]
ir = [x / np.sqrt((x ** 2).sum()) * 0.9 for x in ir]
wet = np.vstack([fftconvolve(filt(verb[c], "high", 250), ir[c])[:N] for c in range(2)])
mix = dry + wet * 0.8
mix = filt(mix, "high", 28)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= np.clip((N - np.arange(N)) / (0.4 * SR), 0, 1)  # no click at the very end
mix /= max(1e-9, np.abs(mix).max()) / 0.95

with wave.open("audio_raw.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype(np.int16).tobytes())
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", "audio_raw.wav", "-af", "loudnorm=I=-14:TP=-1:LRA=7", "-ar", str(SR), "audio.wav"], check=True)
Path("audio_raw.wav").unlink()
print(f"audio.wav: {DUR}s stereo, -14 LUFS, {len(cues['sfx'])} cues" + (", bed" if bed else "") + (", music" if cues.get("music") else ""))
