# /// script
# dependencies = ["numpy", "scipy", "pyloudnorm"]
# ///
"""Storm foley for Count the gap: rain, thunder at its real delay, the count's ticks, true silence after the close strike.
No music. Times come from cues.json (node render.mjs --cues), the same constants the picture reads.
    node render.mjs --cues && uv run storm.py   -> audio.wav (48 kHz stereo, -16 LUFS)
"""
import json, numpy as np, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
cues = json.load(open("cues.json"))
D = cues["duration"]; N = int(D * SR); T = np.arange(N) / SR
ev = {}
for row in cues["sfx"]:
    ev.setdefault(row[1], []).append((row[0], (row[3] if len(row) > 3 else {})))
rng = np.random.default_rng(7)
noise = lambda n: rng.standard_normal(n)
filt = lambda x, kind, f, o=4: sosfilt(butter(o, f, kind, fs=SR, output="sos"), x)
mix = np.zeros((2, N))

def put(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR); sig = sig[: max(0, N - i)]
    if i < 0 or len(sig) == 0: return
    l, r = np.sqrt(0.5 * (1 - pan)), np.sqrt(0.5 * (1 + pan))
    mix[0, i:i + len(sig)] += sig * gain * l; mix[1, i:i + len(sig)] += sig * gain * r

# ---- rain: two decorrelated noise beds, a low wash, and droplet pings; out on the deafened gap, back over 0.8 s ----
deaf, back = ev["deaf"][0][0], ev["back"][0][0]
env = np.clip(T / 0.4, 0, 1) * np.where(T < deaf, 1.0, np.clip((T - back) / 0.8, 0, 1))
for ch in range(2):
    bed = filt(filt(noise(N), "high", 500), "low", 8000) * 0.05 + filt(filt(noise(N), "high", 90), "low", 400) * 0.03
    mix[ch] += bed * env * (1 + 0.15 * np.sin(2 * np.pi * 0.23 * T + ch))
for at in np.cumsum(rng.exponential(1 / 70, int(D * 90))):
    if at >= D or env[int(at * SR)] < 0.01: continue
    n = int(0.012 * SR); tt = np.arange(n) / SR; f = rng.uniform(2200, 7000)
    put(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.0025), at, 0.035 * rng.uniform(0.3, 1) * env[int(at * SR)], rng.uniform(-0.8, 0.8))

# ---- thunder: darker and later with distance; crack only when close; a multipath rumble; a sub for the close ones ----
ir = noise(int(1.6 * SR)) * np.exp(-np.arange(int(1.6 * SR)) / SR / 0.45); ir /= np.abs(ir).sum() ** 0.5 * 4
def thunder(at, dist, cut=None, roll=None, gain=1.0):
    near = 343 / dist                                  # 1 at 343 m, 0.34 at 1 km, 2.9 overhead
    n = int(3.4 * SR); tt = np.arange(n) / SR
    brown = np.cumsum(noise(n)); brown -= filt(brown, "low", 8, 2); brown /= np.abs(brown).max()
    lo = filt(brown, "low", 160 + 900 * min(near, 1.5) ** 2)
    mid = filt(brown, "band", [150, 600]); body = np.tanh(3 * lo / np.abs(lo).max()) * 0.5 + np.tanh(2 * mid / np.abs(mid).max()) * 0.6   # saturation + a 150-520 Hz band, so phones hear it
    r = np.random.default_rng(int(at * 1000))
    rolls = [(1, 0, 0.45)] + [(r.uniform(0.45, 0.85), r.uniform(0.2, 1.1), r.uniform(0.2, 0.45)) for _ in range(3)] + ([(1.1, roll, 0.4)] if roll else [])   # roll: a second swell the picture cuts on
    bumps = sum(a * np.clip((tt - d) / 0.05, 0, 1) * np.exp(-np.clip(tt - d, 0, None) / w) for a, d, w in rolls)
    sig = body * bumps * (0.45 + 0.4 * min(near, 2)) * np.exp(-tt / (0.7 + 0.3 * min(near, 2)))
    dry = np.zeros(n)
    if near > 0.6:                                     # a crack: 30 ms at 2-5 kHz, then a crackle of impulses over 0.25 s
        crack = filt(filt(noise(n), "high", 2000), "low", 5000) * np.exp(-tt / 0.03) * 1.4
        for d in r.uniform(0, 0.25, 50): i = int(d * SR); crack[i:i + 60] += filt(noise(60), "high", 1500) * np.exp(-d / 0.1) * 0.9
        sig = sig + crack * min(near, 2)
        dry = np.sin(2 * np.pi * 48 * tt * (1 - 0.15 * tt)) * np.exp(-tt / 0.22) * 0.7 * min(near, 2)   # sub thump, kept out of the reverb
    wet = fftconvolve(sig, ir)[:n]
    out = (sig * 0.8 + wet * 0.5 + dry) * gain
    if cut: out[max(0, int((cut - at) * SR)):] = 0     # a strike overhead: nothing after the deafened cut
    i = int(at * SR); m = out[: max(0, N - i)]
    for ch, p in ((0, -0.3), (1, 0.3)): mix[ch, i:i + len(m)] += m * (1 + p * (1 - min(near, 1)) * 0.5)
for row in cues["sfx"]:
    if row[1] == "thunder": p = row[3] if len(row) > 3 else {}; thunder(row[0], p.get("dist", 1000), p.get("cut"), p.get("roll"), row[2] if len(row) > 2 else 1)

# ---- the count: a knuckle tap on each counted second ----
for at, p in ev.get("tok", []):
    n = int(0.05 * SR); tt = np.arange(n) / SR
    knock = filt(noise(n), "low", 500) * np.exp(-tt / 0.01) + np.sin(2 * np.pi * 115 * tt) * np.exp(-tt / 0.03)   # a knuckle on wood, not a beep
    put(knock, at, 0.5)

# ---- the deafened gap: nothing at all from the close strike's cut until the rain comes back ----
cut = int(deaf * SR); mix[:, cut:int(back * SR)] = 0
mix[:, cut - 96:cut] *= np.linspace(1, 0, 96)          # 2 ms, so the cut doesn't click

meter = pyln.Meter(SR); lufs = meter.integrated_loudness(mix.T)
mix *= 10 ** ((cues.get("lufs", -16) - lufs) / 20)
ceil = 10 ** (-1.5 / 20); mix = np.where(np.abs(mix) > ceil * 0.8, np.sign(mix) * (ceil * 0.8 + (ceil * 0.2) * np.tanh((np.abs(mix) - ceil * 0.8) / (ceil * 0.2))), mix)
wavfile.write("audio.wav", SR, (mix.T * 32767).astype(np.int16))
print(f"audio.wav: {D:.2f} s, was {lufs:.1f} LUFS, peak {20 * np.log10(np.abs(mix).max()):.1f} dBFS")
