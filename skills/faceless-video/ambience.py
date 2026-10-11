#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "scipy"]
# ///
"""Procedural ambience: nature, room and machine soundscapes built from noise and oscillators (no samples), one bed per
shot, crossfaded on the cuts. Writes a 48 kHz stereo wav, unmastered: the project mix (sfx.py) sets loudness.

  uv run ambience.py scenes.json [-o ambience.wav]
  uv run ambience.py --audition [name ...]     every layer 4 s then every spot, in turn -> audition.wav + measured numbers
  uv run ambience.py --selftest                renders each layer, spot and a cut, and asserts each sounds like its kind

scenes.json
  duration  seconds
  scenes    [{t, layers: {name: gain | {gain, ...params}}}, ...]   t = the picture cut. A layer with the same params in two
            neighbouring shots is ONE signal across the cut (only its gain eases), so a continuing wind never restarts.
  spots     [[t, name], [t, name, gain], [t, name, gain, {params}], ...]   one-shot foley on picture
  xfade     crossfade on a cut, s (0.35). One rule covers both cases: gain = sqrt((1-w)·a² + w·b²), w = sin²(πp/2), so a
            bed that changes is equal-power and a bed that carries on just eases between its two gains.
  lead      the next shot's sound starts this long BEFORE its cut (0.1 s = 3 frames, the J-cut that makes cuts feel natural)
  floor     a room layer at this gain under everything (0.6), so no cut ever falls to digital silence. 0 turns it off
  gain      master gain (1); seed (1): the same file always renders the same sound

Layers (gain 1 = its natural level; params with defaults)
  room       size .5                          room tone: the quiet floor of a space
  wind       strength .5 gust .15             gusting broadband wind; leaves follow the same gusts
  leaves     density 1                        rustle grains, louder in the gusts
  birds      density 1 species 3 dist .4      songbirds: seeded species, each its own syllables, pitch and pan
  gulls      density 1 dist .6                gull calls (kee-ow), far and wet
  stream     flow 1 size 1                    a brook: bubble chirps over a rush
  surf       size 1 period 8                  waves: build, crash, a foam wash; a distant roar under
  rain       intensity .5                     drops on leaves plus the hiss of the rain
  insects    kind crickets|cicadas count 4    crickets chirp on a temperature rate; cicadas swell and fade
  crowd      people 14 dist .5                murmur of voices: pitched, formanted, never words
  fire       size 1                           crackle, pops, hiss, low roar
  traffic    density 1 dist .7                a distant city: hum plus cars passing across the stereo field
  machine    rate 6 size 1                    a press or mill: a metallic clatter on a beat, a motor under
  projector  fps 24                           a film projector: claw clatter at fps, motor whine, fan
  hiss       crackle .5                       optical-track hiss and crackle (under silent archival film)
Spots: chirp, gull, splash, thunder, steps {n 4, rate 1.8, surface gravel|wood}, hooves {n 8, rate 3.2}, bell {f 330, decay 1}.
       Every spot takes pan (-1..1) and dist (0 near .. 1 far).
"""
import json, sys, wave, zlib
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 48000
LEVEL = {  # dBFS at gain 1: beds are RMS, event layers and spots are the loudest call's peak
    "room": -54, "wind": -30, "leaves": -38, "birds": -24, "gulls": -26, "stream": -31, "surf": -27, "rain": -31,
    "insects": -40, "crowd": -33, "fire": -34, "traffic": -36, "machine": -33, "projector": -33, "hiss": -47,
    "chirp": -20, "gull": -20, "splash": -18, "thunder": -16, "steps": -22, "hooves": -20, "bell": -16}
EVENTS = {"birds", "gulls"}  # levelled by their loudest call, so a sparse flock stays as quiet as a sparse flock is


# ---------- building blocks ----------
def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return filt(x, "bandpass", [lo, min(hi, SR / 2 - 100)], order)


def shaped(r, n, slope):  # noise with power ~ 1/f^slope: 0 white, 1 pink, 2 brown
    X = np.fft.rfft(r.standard_normal(n)); f = np.maximum(np.fft.rfftfreq(n, 1 / SR), 20); X[0] = 0  # flat under 20 Hz: no rumble
    x = np.fft.irfft(X / f ** (slope / 2), n); return x / (np.std(x) + 1e-12)


def smooth(r, n, rate, octaves=3):  # slow random curve, mean 0 sd ~1, energy spread over `octaves` up from `rate` Hz (1/f-ish)
    t = np.arange(n) / SR; out = np.zeros(n)
    for k in range(octaves):
        fr = rate * 2 ** k; m = int(n / SR * fr) + 4
        out += np.interp(t * fr, np.arange(m), r.standard_normal(m)) / 2 ** (k / 2)
    out = filt(out, "low", max(rate * 2 ** octaves, 0.5), 1); return (out - out.mean()) / (out.std() + 1e-12)


def times(r, dur, rate, gap=0.0):  # Poisson onsets with a refractory gap: never a loop, never a machine-gun
    out, t = [], r.uniform(0, 1 / rate) if rate > 0 else dur  # the first one within a mean gap: it's already there
    while t < dur:
        out.append(t); t += gap + r.exponential(1 / rate)
    return out


def pan2(x, p, itd=True):  # constant-power pan plus up to 0.4 ms of inter-channel delay: a place, not just a level
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4; d = int(abs(p) * 0.0004 * SR) if itd else 0
    l, rr = np.cos(a) * x, np.sin(a) * x
    if d: (l, rr) = (np.concatenate([np.zeros(d), l])[: len(x)], rr) if p > 0 else (l, np.concatenate([np.zeros(d), rr])[: len(x)])
    return np.vstack([l, rr])


def add(buf, i, x):  # mix stereo x into buf at sample i, clipped to the buffer
    if i >= buf.shape[1]: return
    j0 = max(0, -i); i = max(0, i); m = min(x.shape[1] - j0, buf.shape[1] - i)
    if m > 0: buf[:, i:i + m] += x[:, j0:j0 + m]


_IR = {}
def verb(x, rt=1.2, seed=5):  # stereo decaying-noise reverb, decorrelated L/R
    if (rt, seed) not in _IR:
        r = np.random.default_rng(seed); n = int(rt * 1.4 * SR); t = np.arange(n) / SR
        _IR[(rt, seed)] = [filt(r.standard_normal(n), "low", 6000) * np.exp(-6.9 * t / rt) * (t > 0.015) for _ in range(2)]
    ir = _IR[(rt, seed)]
    return np.vstack([fftconvolve(x[c], ir[c] / np.sqrt((ir[c] ** 2).sum()))[: x.shape[1]] for c in range(2)])


def distant(x, d):  # far = darker and quieter (the wet part is added by the caller's send)
    return filt(x, "low", 9000 - 6000 * d) * 10 ** (-14 * d / 20) if d > 0.05 else x


def osc(f):  # phase-accumulating sine for a frequency curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


_GUST = {}
def gusts(seed, n, rate):  # shared by wind and leaves, so the trees move when the wind does
    if (seed, n, rate) not in _GUST: _GUST[(seed, n, rate)] = smooth(np.random.default_rng(seed + 991), n, rate)
    return _GUST[(seed, n, rate)]


# ---------- layers: (rng, n samples, seed) -> (2, n) ----------
def room(r, n, seed, size=0.5, **_):
    x = np.vstack([filt(filt(shaped(r, n, 1.2), "low", 2500 + 2500 * size), "high", 40) for _ in range(2)])
    return x + 0.4 * filt(np.vstack([shaped(r, n, 2) for _ in range(2)]), "low", 160)


def wind(r, n, seed, strength=0.5, gust=0.15, **_):
    g = np.exp(strength * 1.1 * gusts(seed, n, gust)); g /= g.mean()
    out = []
    for _ in range(2):
        body = filt(shaped(r, n, 1.6), "low", 700); air = bp(shaped(r, n, 1), 500, 1800)
        out.append(filt(body * g + air * np.maximum(g - 0.8, 0) ** 1.5 * 0.6, "high", 45))
    return np.vstack(out)


def leaves(r, n, seed, density=1.0, gust=0.15, **_):
    g = np.clip(np.exp(0.9 * gusts(seed, n, gust)), 0.2, 3); k = np.exp(-np.arange(int(0.012 * SR)) / (0.003 * SR))
    out = []
    for _ in range(2):
        imp = np.zeros(n); m = int(n / SR * 260 * density); ix = r.integers(0, n, m)
        np.add.at(imp, ix, np.minimum(r.pareto(2.5, m), 4) * g[ix]); out.append(bp(fftconvolve(imp, k)[:n] * r.standard_normal(n), 1800, 9000))
    return np.vstack(out)


def bird_call(r, sp, d=0.0):  # one call of species sp: syllables strung with gaps, a few % of pitch variation per call
    f0 = sp["f0"] * r.uniform(0.96, 1.04); parts = []
    for kind, dur, gap in sp["syl"]:
        m = int(dur * SR); p = np.arange(m) / m; t = np.arange(m) / SR
        f = {"up": f0 * (0.8 + 0.5 * p), "down": f0 * (1.3 - 0.55 * p), "trill": f0 * (1 + 0.12 * np.sin(2 * np.pi * sp["tr"] * t)),
             "whistle": f0 * (1 + 0.02 * np.sin(2 * np.pi * 6 * t)), "chip": f0 * (1.45 - 0.6 * p ** 0.3)}[kind]
        y = osc(f) + 0.12 * osc(2 * f) + 0.03 * osc(3 * f)
        parts += [y * np.minimum(1, t / 0.003) * np.sin(np.pi * p) ** 0.5, np.zeros(int(gap * SR))]
    return distant(np.concatenate(parts), d)


def species(r, k):
    out = []
    for _ in range(k):
        kinds = r.choice(["up", "down", "trill", "whistle", "chip"], 2, replace=False); n = int(r.integers(2, 8))
        syl = [(kinds[i % 2] if r.random() < 0.8 else kinds[0], r.uniform(0.03, 0.14) if kinds[i % 2] != "chip" else r.uniform(0.015, 0.03),
                r.uniform(0.02, 0.08)) for i in range(n)]
        out.append({"f0": np.exp(r.uniform(np.log(2200), np.log(5500))), "syl": syl, "tr": r.uniform(25, 45)})
    return out


def birds(r, n, seed, density=1.0, dist=0.4, **kw):
    sps = species(r, int(kw.get("species", 3))); dry, send = np.zeros((2, n)), np.zeros((2, n))
    for i in range(int(len(sps) * 2)):  # two birds of each species, somewhere around the mic
        sp, d, p = sps[i % len(sps)], np.clip(dist + r.uniform(-0.3, 0.4), 0, 1), r.uniform(-0.9, 0.9)
        for t in times(r, n / SR, 0.25 * density, 1.2):
            y = pan2(bird_call(r, sp, d), p); add(dry, int(t * SR), y); add(send, int(t * SR), y * d)
    return dry + 0.5 * verb(send, 1.4)


def gull_call(r, d=0.6):
    f0, notes = r.uniform(850, 1250), []
    for _ in range(int(r.integers(2, 5))):
        dur = r.uniform(0.25, 0.5); m = int(dur * SR); p = np.arange(m) / m
        f = f0 * np.interp(p, [0, 0.3, 1], [0.8, 1.25, 0.7]) * (1 + 0.01 * np.sin(2 * np.pi * 9 * np.arange(m) / SR))
        y = sum(osc(k * f) / k for k in range(1, 9)) * (1 + 0.2 * np.sin(2 * np.pi * 70 * np.arange(m) / SR))
        y = bp(y, 600, 3500) + 0.1 * bp(r.standard_normal(m), 1500, 4000)
        notes += [y * np.minimum(1, p * dur / 0.02) * np.minimum(1, (1 - p) * dur / 0.08), np.zeros(int(r.uniform(0.06, 0.18) * SR))]
    return distant(np.concatenate(notes), d)


def gulls(r, n, seed, density=1.0, dist=0.6, **_):
    dry, send = np.zeros((2, n)), np.zeros((2, n))
    for t in times(r, n / SR, 0.3 * density, 1.5):
        d = np.clip(dist + r.uniform(-0.2, 0.3), 0, 1); y = pan2(gull_call(r, d), r.uniform(-0.8, 0.8))
        add(dry, int(t * SR), y); add(send, int(t * SR), y * (0.4 + d))
    return dry + 0.6 * verb(send, 2.0)


def bubbles(r, n, rate, f_lo, f_hi, spread=0.9):  # Minnaert bubbles: a sine that rises as it decays, thousands of them
    out = np.zeros((2, n)); m = int(n / SR * rate)
    for t, f0, dur, a, p in zip(r.uniform(0, n / SR, m), np.exp(r.uniform(np.log(f_lo), np.log(f_hi), m)), r.uniform(0.004, 0.025, m),
                                np.minimum(r.pareto(3, m), 2.5) + 0.2, r.uniform(-spread, spread, m)):
        k = int(dur * 2 * SR); tt = np.arange(k) / SR  # rings out to -52 dB: no click where it ends
        add(out, int(t * SR), pan2(np.sin(2 * np.pi * f0 * (tt + 0.75 * tt ** 2 / dur)) * np.exp(-tt / (dur / 3)) * np.minimum(1, tt / 0.0015) * a, p, itd=False))
    return out


def stream(r, n, seed, flow=1.0, size=1.0, **_):
    rush = np.vstack([bp(r.standard_normal(n), 250, 2600) * np.exp(0.5 * smooth(r, n, 8, 2)) for _ in range(2)])
    return bubbles(r, n, 420 * flow, 450 / size, 2600 / size) + 0.35 * rush


def surf(r, n, seed, size=1.0, period=8.0, **_):
    out = 0.25 * np.vstack([bp(shaped(r, n, 1.5), 60, 400) for _ in range(2)])  # the distant roar
    t = -r.uniform(0, period)
    while t < n / SR:  # each wave: a swell builds, crashes broadband, then the foam fizzes away
        L = int(r.uniform(6, 8.5) * SR); tt = np.arange(L) / SR; build = r.uniform(1.4, 2.6); a = r.uniform(0.6, 1.1) * size
        rise = np.clip(tt / build, 0, 1) ** 2.5; wash = np.where(tt > build, np.exp(-(tt - build) / r.uniform(1.0, 2.0)), 0)
        crash = np.exp(-np.abs(tt - build) / np.where(tt < build, 0.15, 0.5))
        nz = lambda lo, hi, s=1.0: bp(np.vstack([shaped(r, L, s) for _ in range(2)]), lo, hi)
        low = nz(70, 700, 1.5) * (rise * (tt <= build) + wash ** 0.7 * (tt > build))
        foam = nz(1500, 9000, 1) * wash * (0.6 + 0.4 * np.abs(smooth(r, L, 14, 2)))
        y = pan2(np.ones(L), r.uniform(-0.4, 0.4), itd=False) * (low + 0.9 * nz(300, 3000, 1) * crash + 0.45 * foam) * a
        add(out, int(t * SR), y); t += period * r.uniform(0.7, 1.3)
    return out


def rain(r, n, seed, intensity=0.5, **_):
    hiss = np.vstack([bp(shaped(r, n, 0.8), 700, 9000) for _ in range(2)]) * (0.3 + 0.7 * intensity)
    drops = np.zeros((2, n))
    for lo, hi, dec, rate, g in ((1500, 7000, 0.0015, 60 + 1600 * intensity, 1.0), (500, 1500, 0.01, 1 + 3 * intensity, 2.5)):
        k = np.exp(-np.arange(int(dec * 6 * SR)) / (dec * SR)); edges = np.geomspace(lo, hi, 4)
        for c in range(2):  # sparse ticks of noise in three random bands: drops on leaves, never a ringing tone
            for a, b in zip(edges, edges[1:]):
                imp = np.zeros(n); m = int(n / SR * rate / 3); np.add.at(imp, r.integers(0, n, m), np.minimum(r.pareto(2.2, m), 3) * g)
                drops[c] += bp(fftconvolve(imp, k)[:n] * r.standard_normal(n), a, b)
    return hiss + 0.6 * drops


def insects(r, n, seed, kind="crickets", count=4, **_):
    out, t = np.zeros((2, n)), np.arange(n) / SR
    if kind == "cicadas":
        for _ in range(max(1, int(count) // 2)):
            sw = np.clip(np.sin(2 * np.pi * (t / r.uniform(10, 18) + r.random())), 0, 1) ** 0.7
            y = bp(r.standard_normal(n), 4200, 7500) * (0.4 + 0.6 * np.sin(2 * np.pi * r.uniform(110, 190) * t) ** 2) * sw
            out += pan2(y, r.uniform(-0.8, 0.8), itd=False)
        return out
    for _ in range(int(count)):  # each cricket: chirps of 3-5 pulses at ~30 Hz, 1.5-3 chirps a second, slightly irregular
        fc, prate, crate, d = r.uniform(3900, 5200), r.uniform(26, 38), r.uniform(1.5, 3.0), r.uniform(0, 0.7)
        e = np.zeros(n); pw = int(0.014 * SR); win = np.sin(np.pi * np.arange(pw) / pw) ** 2
        for c0 in times(r, n / SR, crate * 3, 1 / crate * 0.6):
            for k in range(int(r.integers(3, 6))):
                i = int((c0 + k / prate) * SR)
                if i + pw < n: e[i:i + pw] += win
        out += pan2(distant(e * osc(fc * (1 + 0.004 * np.sin(2 * np.pi * 3 * t))), d), r.uniform(-0.9, 0.9))
    return out


def crowd(r, n, seed, people=14, dist=0.5, **_):
    t = np.arange(n) / SR; dry = np.zeros((2, n))
    vowels = [(730, 1090, 2440), (270, 2290, 3010), (530, 1840, 2480), (570, 840, 2410), (300, 870, 2240)]  # a i e o u
    for _ in range(int(people)):
        f0 = r.uniform(95, 230) * (1 + 0.08 * smooth(r, n, 2.5, 2)) * (1 + 0.004 * r.standard_normal(n))
        src = filt(2 * ((np.cumsum(f0) / SR) % 1) - 1, "low", 3800)
        talk = (smooth(r, n, 0.35, 2) > -0.2).astype(float)  # utterances and pauses
        talk = np.convolve(talk, np.ones(int(0.08 * SR)) / int(0.08 * SR), "same")
        syl = np.clip(0.55 + 0.45 * np.sin(2 * np.pi * np.cumsum(4.5 + 1.5 * smooth(r, n, 1, 1)) / SR), 0, 1) ** 1.5
        a, b = (vowels[i] for i in r.choice(len(vowels), 2, replace=False)); w = 0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(2.2 + smooth(r, n, 1, 1)) / SR)
        v = sum(bp(src, fa * 0.85, fa * 1.15) * (1 - w) * (1 / (j + 1)) + bp(src, fb * 0.85, fb * 1.15) * w * (1 / (j + 1)) for j, (fa, fb) in enumerate(zip(a, b)))
        v += 0.15 * bp(r.standard_normal(n), 3000, 7000) * (np.diff(syl, prepend=0) > 0) * syl  # consonants on the rising edges
        dry += pan2(v * talk * syl * r.uniform(0.5, 1.2), r.uniform(-0.9, 0.9))
    dry = distant(dry, dist); return dry + (0.3 + 0.6 * dist) * verb(dry, 1.1)


def fire(r, n, seed, size=1.0, **_):
    roar = np.vstack([bp(shaped(r, n, 1.5), 60, 300) * np.exp(0.4 * smooth(r, n, 0.5)) for _ in range(2)]) * 0.35
    hiss = np.vstack([bp(r.standard_normal(n), 1500, 6000) * np.exp(0.6 * smooth(r, n, 6)) for _ in range(2)]) * 0.25
    cr = np.zeros((2, n))
    for t in times(r, n / SR, 14 * size):
        k = int(r.uniform(0.002, 0.006) * SR); y = bp(r.standard_normal(k), 900, 6500) * np.exp(-np.arange(k) / (k / 4)) * (min(r.pareto(1.8), 4) + 0.3)
        if r.random() < 0.08: k2 = int(0.012 * SR); y = np.concatenate([y, bp(r.standard_normal(k2), 350, 1200) * np.exp(-np.arange(k2) / (k2 / 5)) * 2])
        add(cr, int(t * SR), pan2(y, r.uniform(-0.6, 0.6), itd=False))
    return roar + hiss + 0.6 * cr


def traffic(r, n, seed, density=1.0, dist=0.7, **_):
    out = np.vstack([bp(shaped(r, n, 2), 40, 260) + 0.3 * filt(shaped(r, n, 1), "low", 1200) for _ in range(2)]) * np.exp(0.3 * smooth(r, n, 0.1))
    for t in times(r, n / SR + 4, 0.3 * density, 0.8):
        L = int(r.uniform(3, 7) * SR); p = np.arange(L) / L; g = np.exp(-((p - 0.5) / 0.2) ** 2); s = r.choice([-1, 1])
        hum = sum(osc(r.uniform(30, 55) * k * (1 + 0.03 * (0.5 - p))) / k for k in range(1, 5))
        y = (filt(shaped(r, L, 1.5), "low", 700) + 0.25 * hum + 0.4 * bp(shaped(r, L, 1), 400, 2000)) * g
        st = np.vstack([np.cos((s * (2 * p - 1) * 0.8 + 1) * np.pi / 4), np.sin((s * (2 * p - 1) * 0.8 + 1) * np.pi / 4)])
        add(out, int((t - 2) * SR), distant(st * y * 1.5, dist))
    return out


def machine(r, n, seed, rate=6.0, size=1.0, **_):
    out = 0.2 * np.vstack([filt(shaped(r, n, 1.5), "low", 1500) for _ in range(2)])
    modes = np.array([620, 1430, 2710, 3900]) * r.uniform(0.85, 1.15) / size; k = int(0.08 * SR); tt = np.arange(k) / SR
    hit = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / r.uniform(0.012, 0.04)) for f in modes); acc = [1, 0.5, 0.75, 0.4]
    for i, t in enumerate(np.arange(0, n / SR, 1 / rate)):
        add(out, int((t + r.normal(0, 0.006)) * SR), pan2(hit * acc[i % 4] * r.uniform(0.85, 1.1), r.uniform(-0.2, 0.2), itd=False))
    t = np.arange(n) / SR; return out + 0.15 * pan2(sum(np.sin(2 * np.pi * 50 * j * t) / j for j in (1, 2, 3)), 0, itd=False)


def projector(r, n, seed, fps=24, **_):
    t = np.arange(n) / SR; out = 0.12 * np.vstack([filt(shaped(r, n, 1), "low", 2500) * (1 + 0.08 * np.sin(2 * np.pi * 2 * fps * t)) for _ in range(2)])
    k = int(0.02 * SR); tt = np.arange(k) / SR
    claw = bp(r.standard_normal(k), 1200, 4000) * np.exp(-tt / 0.0015) + 0.8 * bp(r.standard_normal(k), 180, 600) * np.exp(-tt / 0.006)
    at = np.cumsum(np.full(int(n / SR * fps) + 2, 1 / fps) * (1 + 0.004 * np.sin(2 * np.pi * 0.3 * np.arange(int(n / SR * fps) + 2) / fps)))
    for i, a in enumerate(at):  # pull-down and shutter alternate: the clatter has a lilt at half the frame rate
        add(out, int(a * SR), pan2(claw * (1 if i % 2 else 0.6) * r.uniform(0.85, 1.1), 0.15, itd=False))
    whine = osc(1100 * (1 + 0.01 * smooth(r, n, 0.2))) * 0.03
    return out + pan2(whine + 0.5 * whine ** 2, 0.1, itd=False)


def hiss(r, n, seed, crackle=0.5, **_):
    out = np.vstack([bp(shaped(r, n, 1), 1500, 12000) for _ in range(2)])
    for t in times(r, n / SR, 3 + 25 * crackle):
        k = int(r.uniform(0.0002, 0.001) * SR) + 2; y = filt(r.standard_normal(k), "high", 1000) * (min(r.pareto(1.6), 5) + 0.5) * 1.5
        add(out, int(t * SR), np.vstack([y, y * 0.7]))
    return out


LAYERS = {f.__name__: f for f in (room, wind, leaves, birds, gulls, stream, surf, rain, insects, crowd, fire, traffic, machine, projector, hiss)}


# ---------- spots: (rng, **params) -> stereo one-shot ----------
def sp_chirp(r, pan=0.0, dist=0.2, **_): return pan2(bird_call(r, species(r, 1)[0], dist), pan)
def sp_gull(r, pan=0.0, dist=0.4, **_): y = np.pad(pan2(gull_call(r, dist), pan), ((0, 0), (0, SR))); return y + 0.4 * dist * verb(y, 2.0)


def sp_splash(r, pan=0.0, dist=0.2, **_):
    k = int(0.9 * SR); tt = np.arange(k) / SR
    body = bp(r.standard_normal(k), 300, 5000) * np.minimum(1, tt / 0.01) * np.exp(-tt / 0.12)
    return distant(pan2(body, pan, itd=False) + bubbles(r, k, 900, 500, 3000, 0.4) * np.exp(-tt / 0.25), dist)


def sp_thunder(r, pan=0.0, dist=0.5, **_):
    k = int(6 * SR); tt = np.arange(k) / SR
    roll = sum(np.exp(-((tt - c) / w) ** 2) for c, w in zip(np.cumsum(r.uniform(0.3, 1.1, 5)), r.uniform(0.3, 0.9, 5)))
    rum = lambda: bp(shaped(r, k, 1.5), 40, 400) * roll * np.exp(-tt / 2.5)
    crack = filt(r.standard_normal(k), "low", 2500) * np.exp(-tt / 0.08) * (1 - dist) * 0.6
    return distant(np.vstack([rum() + crack, rum() + 0.8 * crack]), dist * 0.5)


def sp_steps(r, n=4, rate=1.8, surface="gravel", pan=0.0, dist=0.2, **_):
    k = int(0.25 * SR); tt = np.arange(k) / SR; out = np.zeros(int((n / rate + 0.5) * SR))
    for i in range(int(n)):
        y = filt(r.standard_normal(k), "low", 300) * np.exp(-tt / 0.012) * 0.8
        if surface == "wood": y += sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / 0.03) for f in (180, 420)) * 0.4
        else: y += bp(r.standard_normal(k) * (r.random(k) < 0.08), 1200, 7000) * np.exp(-tt / 0.06) * 1.5
        for d in (0, 0.03 + r.uniform(0, 0.02)):  # heel, then toe
            j = max(0, int((i / rate + d + r.normal(0, 0.015)) * SR)); out[j:j + k] += y * (1 if d == 0 else 0.6)
    return distant(pan2(out, pan), dist)


def sp_hooves(r, n=8, rate=3.2, pan=0.0, dist=0.3, **_):
    k = int(0.12 * SR); tt = np.arange(k) / SR; out = np.zeros(int((n / rate + 0.5) * SR))
    for i in range(int(n)):  # a trot: hooves land in pairs, the second a touch later and softer
        y = bp(r.standard_normal(k), 1500, 4500) * np.exp(-tt / 0.004) + filt(r.standard_normal(k), "low", 400) * np.exp(-tt / 0.02) * 0.9
        for d, g in ((0, 1), (0.06, 0.7)):
            j = max(0, int((i / rate + d + r.normal(0, 0.01)) * SR)); out[j:j + k] += y * g * r.uniform(0.8, 1.1)
    return distant(pan2(out, pan), dist)


def sp_bell(r, f=330.0, decay=1.0, pan=0.0, dist=0.7, **_):  # decay .15 and f 1400 = a tram's ding instead of a church
    k = int((1 + 6 * decay) * SR); tt = np.arange(k) / SR  # minor-third bell partials: hum, prime, tierce, quint, nominal, upper
    y = sum(a * np.sin(2 * np.pi * f * m * (1 + 0.0007 * j) * tt) * np.exp(-tt / (dec * decay)) for j, (m, a, dec) in
            enumerate(((0.5, 0.6, 4.5), (1, 1, 3.5), (1.19, 0.6, 2.5), (1.5, 0.35, 2), (2, 0.5, 1.8), (2.52, 0.25, 1.1), (3.01, 0.2, 0.8))))
    y = pan2(y * np.minimum(1, tt / 0.003), pan); return distant(y, dist * 0.6) + dist * 0.8 * verb(y, 2.5)


SPOTS = {k[3:]: v for k, v in globals().items() if k.startswith("sp_")}


# ---------- scenes -> wav ----------
def norm(name, x):
    ref = np.abs(x).max() if name in EVENTS or name in SPOTS else np.sqrt(np.mean(x ** 2))
    return x * 10 ** (LEVEL[name] / 20) / (ref + 1e-12)


def make(name, n, seed, params):
    r = np.random.default_rng(zlib.crc32(f"{seed} {name} {json.dumps(params, sort_keys=True)}".encode()))
    return norm(name, LAYERS[name](r, n, seed, **params))


def render(spec, out=None):
    dur, seed = spec["duration"], spec.get("seed", 1); N = int(dur * SR)
    xf, lead, floor = spec.get("xfade", 0.35), spec.get("lead", 0.1), spec.get("floor", 0.6)
    scenes = sorted(spec.get("scenes") or [{"t": 0, "layers": {}}], key=lambda s: s["t"])
    starts = [0.0] + [max(0.0, s["t"] - lead) for s in scenes[1:]]
    inst = {}  # (name, params) -> gain per scene
    for i, s in enumerate(scenes):
        lay = dict(s.get("layers") or {})
        if floor: lay.setdefault("room", floor)
        for name, v in lay.items():
            if name not in LAYERS: sys.exit(f"unknown layer {name!r}; known: {' '.join(LAYERS)}")
            v = v if isinstance(v, dict) else {"gain": v}; p = {k: x for k, x in v.items() if k != "gain"}
            inst.setdefault((name, json.dumps(p, sort_keys=True)), [0.0] * len(scenes))[i] = float(v.get("gain", 1))
    mix, t = np.zeros((2, N)), np.arange(N) / SR
    for (name, p), gains in inst.items():
        g = np.full(N, gains[0])
        for i in range(1, len(scenes)):
            a, b = gains[i - 1], gains[i]; w = np.sin(np.pi / 2 * np.clip((t - starts[i] + xf / 2) / xf, 0, 1)) ** 2
            g = np.where(t >= starts[i] - xf / 2, np.sqrt((1 - w) * a ** 2 + w * b ** 2), g)
        if g.max() > 0: mix += make(name, N, seed, json.loads(p)) * g
    for row in spec.get("spots") or []:
        at, name, gain, kw = (list(row) + [1.0, {}][len(row) - 2:])[:4]
        if name not in SPOTS: sys.exit(f"unknown spot {name!r}; known: {' '.join(SPOTS)}")
        r = np.random.default_rng(zlib.crc32(f"{seed} {name} {at}".encode()))
        add(mix, int(at * SR), norm(name, SPOTS[name](r, **kw)) * gain)
    mix *= spec.get("gain", 1.0)
    pk = np.abs(mix).max()
    if pk > 0.98: mix *= 0.98 / pk; print(f"ambience: peak {20 * np.log10(pk):+.1f} dBFS, scaled down to -0.2")
    if out: write(out, mix)
    return mix


def write(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1).T * 32767).astype("<i2").tobytes())


# ---------- measuring + self-check ----------
def measure(x):  # rms dBFS, peak dBFS, spectral centroid Hz, L/R correlation, spread of 50 ms levels (dB, 10-90 %), loop score
    m = x.mean(0); X = np.abs(np.fft.rfft(m)) ** 2; f = np.fft.rfftfreq(len(m), 1 / SR); np.seterr(invalid="ignore")
    k = int(0.05 * SR); e = 10 * np.log10((m[: len(m) // k * k].reshape(-1, k) ** 2).mean(1) + 1e-14)
    return {"rms": 10 * np.log10(np.mean(x ** 2) + 1e-14), "peak": 20 * np.log10(np.abs(x).max() + 1e-12), "centroid": (f * X).sum() / X.sum(),
            "corr": np.corrcoef(x[0], x[1])[0, 1], "spread": np.percentile(e, 90) - np.percentile(e, 10), "loop": loop(m)}


def loop(m):  # how closely any later half second repeats the half second at 1 s, sample for sample (1 = a loop)
    if len(m) < 3 * SR: return 0.0
    a = SR // 2; seg = m[SR:SR + a]; c = fftconvolve(m, seg[::-1], "valid"); s2 = np.concatenate([[0], np.cumsum(m ** 2)])
    r = np.abs(c) / (np.sqrt((s2[a:] - s2[:-a])[: len(c)] * (seg ** 2).sum()) + 1e-12); r[max(0, SR - SR // 3):SR + SR // 3] = 0
    return float(r.max())


CHECK = {  # name: (centroid range Hz, min spread dB): what each must sound like, by the numbers
    "room": ((100, 1500), 0), "wind": ((120, 1200), 3), "leaves": ((2500, 7500), 3), "birds": ((2000, 7000), 10),
    "gulls": ((700, 3200), 10), "stream": ((500, 2500), 0), "surf": ((200, 3000), 4), "rain": ((1500, 6000), 0),
    "insects": ((3500, 6500), 6), "crowd": ((250, 1600), 0), "fire": ((150, 4500), 0), "traffic": ((50, 900), 1),
    "machine": ((300, 3500), 3), "projector": ((300, 3500), 0), "hiss": ((2500, 8000), 0),
    "chirp": ((2000, 7000), 0), "gull": ((700, 3200), 0), "splash": ((300, 3500), 0), "thunder": ((30, 600), 0),
    "steps": ((100, 4000), 0), "hooves": ((200, 4000), 0), "bell": ((150, 1500), 0)}


def selftest():
    n = 12 * SR
    for name in LAYERS:
        x = make(name, n, 1, {}); m = measure(x); lo, hi = CHECK[name][0]
        assert np.isfinite(x).all(), name
        assert m["peak"] < -1, (name, m)
        ref = 20 * np.log10(np.abs(x).max()) if name in EVENTS else m["rms"]
        assert abs(ref - LEVEL[name]) < 0.6, (name, ref)
        assert lo <= m["centroid"] <= hi, (name, round(m["centroid"]))
        assert m["corr"] < 0.97, (name, "mono", m["corr"])  # stereo, not one channel twice
        assert m["spread"] >= CHECK[name][1], (name, "too static", m["spread"])
        assert name in ("machine", "projector") or m["loop"] < 0.5, (name, "repeats like a loop", m["loop"])
        assert (make(name, n, 1, {}) == x).all() and not (make(name, n, 2, {}) == x).all(), (name, "seeding")
        print(f"ok {name:9} rms {m['rms']:6.1f}  peak {m['peak']:6.1f}  centroid {m['centroid']:5.0f} Hz  L/R {m['corr']:.2f}  spread {m['spread']:4.1f} dB  loop {m['loop']:.2f}")
    for name, fn in SPOTS.items():
        x = norm(name, fn(np.random.default_rng(3))); m = measure(x); lo, hi = CHECK[name][0]
        assert np.isfinite(x).all() and abs(m["peak"] - LEVEL[name]) < 0.1 and lo <= m["centroid"] <= hi, (name, m)
        print(f"ok spot {name:7} {x.shape[1] / SR:4.1f} s  centroid {m['centroid']:5.0f} Hz")
    # a cut: wind carries on (same params) while birds hand over to rain; the J-cut lead puts the change before the picture
    spec = {"duration": 6, "scenes": [{"t": 0, "layers": {"wind": 1, "birds": 1}}, {"t": 3, "layers": {"wind": 0.5, "rain": 1}}],
            "spots": [[4.5, "bell", 1]]}
    x = render(spec); k = int(0.05 * SR); e = 10 * np.log10((x.mean(0)[: len(x[0]) // k * k].reshape(-1, k) ** 2).mean(1) + 1e-14)
    assert np.abs(np.diff(x, axis=1)).max() < 0.25, "a click at the cut"
    assert e.min() > -62, f"fell toward silence ({e.min():.1f} dB)"  # the room floor holds every frame
    assert abs(e[int(2.4 / 0.05):int(2.6 / 0.05)].mean() - e[int(3.4 / 0.05):int(3.6 / 0.05)].mean()) < 12, "a hole or a jump across the cut"
    a, b = measure(x[:, : int(2.5 * SR)])["centroid"], measure(x[:, int(3.2 * SR): int(4.4 * SR)])["centroid"]
    assert b > a, ("rain should brighten the bed after the cut", a, b)
    assert e[int(4.5 / 0.05) + 1] > e[int(4.3 / 0.05)] + 2, "the bell spot didn't land"
    print("ok cut: one wind across it, birds -> rain, no click, no hole, bell lands")
    print(f"selftest ok: {len(LAYERS)} layers, {len(SPOTS)} spots")


def audition(names):
    names = names or list(LAYERS) + list(SPOTS); parts = []
    for name in names:
        x = make(name, 4 * SR, 1, {}) if name in LAYERS else norm(name, SPOTS[name](np.random.default_rng(3)))
        m = measure(x); parts += [x * np.minimum(1, np.minimum(np.arange(x.shape[1]), x.shape[1] - np.arange(x.shape[1])) / (0.05 * SR)), np.zeros((2, SR // 2))]
        print(f"{name:9} rms {m['rms']:6.1f}  peak {m['peak']:6.1f}  centroid {m['centroid']:5.0f}  L/R {m['corr']:.2f}  spread {m['spread']:4.1f}")
    write("audition.wav", np.hstack(parts) * 4); print("-> audition.wav (+12 dB so the quiet ones are audible)")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["--selftest"]: selftest()
    elif a[:1] == ["--audition"]: audition(a[1:])
    elif a: out = a[a.index("-o") + 1] if "-o" in a else "ambience.wav"; render(json.loads(Path(a[0]).read_text()), out); print("->", out)
    else: print(__doc__)
