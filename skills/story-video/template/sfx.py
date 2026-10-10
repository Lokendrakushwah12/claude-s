# /// script
# dependencies = ["numpy", "scipy", "matplotlib"]
# ///
"""Soundtrack: a synthesised music bed + SFX cues (+ a licensed track, + a voice-over), mixed, reverbed and mastered to
a LUFS target under a -1.5 dBTP ceiling -> audio.wav (48 kHz stereo). Shared by promo-video, type-film and ugc-edit.

    node render.mjs --cues && uv run sfx.py     # cues.json -> audio.wav
    uv run sfx.py --audition                    # every sound in turn, 0.4 s apart -> audition.wav, audition.png, numbers
    uv run sfx.py --plot                        # audio.wav -> spectrogram.png labelled with the cues and sections, and
                                                # each cue's loudest 50 ms against the bed's around it (balance without a voice)
    from sfx import autocue                     # edit events -> cue rows (or put the events in cues.json)

cues.json. vo, drone, lufs, lp, lp_master, events and mutes may sit at the top level (render.mjs --cues copies them
there from VIDEO) OR inside bed (a bed with no bpm plays no music and just carries them).
  duration   seconds
  sfx        [[t, name], [t, name, gain], [t, name, gain, {params}], ...]. "none" or [] = no SFX
  events     [{t, kind, ...}] -> autocue() rows, appended to sfx
  music      a licensed track. It sits on the music bus with the bed (ducks, low-passes, tape-stops with it)
  vo         'voice.wav' or [[t, 'clip.wav'], ...]: mixed in, high-passed at 80 Hz. The music ducks under it and every
             SFX is set by LEVEL for its family
  drone      true or {hum: 50, whine: 7812, gain: 1}: room tone (mains hum, CRT whine, hiss). Without a bed this is the
             no-music "sonified UI" mode: dry blips over room tone
  lufs       master loudness: -14 by default, -16 in the drone mode. The ceiling is always -1.5 dBTP (AAC encoding adds up to
             ~0.5 dB, so the MP4 stays under -1)
  lp         [[t, hz], ...] low-pass automation on the music bus (hero reveal: 4500 until the land, then 20000).
             lp_master: true runs it on the whole mix, voice included (the "collapse to a line" pivot)
  bed        {bpm, chords, sections, type, kick, kick_pattern, mutes}
    chords        MIDI, one chord per bar: [[53,57,60,64], [55,59,62,67], ...]
    sections      [[t, kind] or [t, kind, gain], ...]. Start them ON the beat grid (multiples of 60/bpm) and cut the
                  scenes on the same times. gain scales everything the section plays (choruses louder each time)
      intro   pad + soft arp, riser into the next       groove  four-on-the-floor house
      break   no kick, 16th hats, snare roll out        drive   full, open hats, a half-beat gap before the next
      end     kick + impact + crash, then the tail      stop    drums and bass out, pad and arp carry on
      outro   arp only, fading (solo-keys bookend)      arp     16th plucks over the chords + a soft pad
    type          'arp' with no sections = one arp section from t=0 (fades in over 1.65 s, as any first arp does)
    kick          {f0: 155, f1: 45, tau: 0.035, decay: 0.22}. A long syncopated kick: {f0: 300, f1: 50, decay: 0.4}
    kick_pattern  beats in the bar that get a kick, default [0, 1, 2, 3]; e.g. [0, 1.5, 2.5]
    mutes         [[t0, t1], ...]: pad and bass out (the one-beat bass mute under a new idea)

Levels under a voice (only when there's a vo), in dB against the voice's RMS while it speaks; same values as the code:
    LEVEL = {"sub": +6, "air": -14, "micro": -14, "foley": -18, "music": -12, "duck": 8}
    DUCK = {"attack": 0.12, "release": 0.4, "gap": 0.3}   # seconds
Every cue is set by its family, and its gain scales that, so gain 1 = the rule. A sound's level is its loudest 50 ms.
sub: only the part below 150 Hz is set to +6; anything above 150 Hz is held at or below the micro level. Music (bed and
track) sits 12 dB under the voice while it speaks and comes back up 8 dB in pauses longer than 0.3 s. It's fully down
by the first word (120 ms ramp) and back 0.4 s after the last. The drone isn't ducked.
Master: a static gain to the LUFS target, then a look-ahead true-peak limiter (no loudnorm pumping, so quiet cues
stay quiet).

SFX. The cue time is the START of the sound, except END = it builds into the cue and ends there, PEAK = it peaks there,
HIT = a swell runs into the cue and the hit lands on it. Every SFX takes **params and ignores ones it doesn't know.
  name            at    params (defaults)                           use
  sub
  sub_boom        .     f0 95 f1 38 tau .45 h2 0 dur 1.2            hard cut into/out of an insert, a stat, a keyword
  sub_swell       END   dur .8 f 42 curve 3                         a build that stops dead on the cut
  whoomp          .     dur 1.1                                     camera dive, tilt under, muffled
  thump           .     dur .35                                     two, 0.21 s apart, 0.25 s before a giant word
  sub_drop        .     f0 150 f1 45                                the drop (after glide_riser); ducks pad and bass
  impact          .     dur 1.2                                     headline lands: broadband crack + sub
  thud            .                                                 feature-cut hit (kick + knock)
  boom_sting      .     f0 140 f1 45 h2 .5 tau .6                   meme "boom": sub_boom with its 2nd harmonic
  air
  passby          PEAK  dur .45 f0 400 fpk 3000 f1 600 width .7     across a cut; peak 0-100 ms before it; pans L->R
  suck_in         END   dur .45 f0 900 f1 5500                      reverse whoosh ending ON the keyword
  flash_hit       .     dur .22                                     white flash: bright burst + zip
  hiss_bed        .     dur 2.6                                     beam or scan moves
  whoosh          PEAK                                              transition (rises 400->6000 Hz, peak at the cue)
  swoosh          .                                                 transition (falls 6000->500 Hz)
  riser           END   dur 1.5                                     into the end card / a drop
  glide_riser     END   f0 200 f1 1050 dur .45                      sine glide into "done" (then sub_drop + sting)
  downlifter      .     dur .6                                      card exit, things leaving (4.5k->2k saw + noise)
  swell           .     dur 1.4 f 70                                under a lift: 70 Hz + 4-8 kHz air, sin^2
  reverse_riser   END   dur 1                                       reversed crash, under a rewind / replay
  burn_whoomp     HIT                                               film burn: noise swell, then a 40-80 Hz boom
  record_scratch  .     dur .45 strokes 2                           meme freeze-frame (pair with gap or tape_stop)
  micro
  tick            .     f 7000                                      one tick (typing, flips)
  tick_ramp       .     n 20 gap0 .1 gap1 .033 f 7000               ticks speeding up (flip-book)
  ticks           .     n 7 gap .035 lo 3000 hi 14000               scramble: each tick at a random band
  click           .                                                 a click on a click
  click_cluster   .     f 7000 times (0, .09, .14)                  UI state change
  key_tap / type  .                                                 one per typed character, +-20 ms
  thock           .     f 1300 dur .09                              pitched key; pitch can encode information
  ladder          .     word '' n 6 f0 1300 df 180 gap .105         one thock per glyph, stepping df Hz each
  ui_blip / blip  .     f 1760 / 1320 dur .17                       status blip (blip = the softer legacy one)
  blip_pop / pop  .     f0 1100 f1 780 dur .11 / pop 900->380       pills and chips popping in
  glitch          .     dur .28 seed                                glitch box, blue tear
  dot_ticks       .     n 14 gap .06                                dots filling, pips
  slot_roll       .     notes (580, 855, 1131, 1400) steps 16 step .085   counter or slot list rolling
  heartbeat       .                                                 pulse (shorten the gaps between cues)
  static_slam     .     dur .35 tone None                           logo slam (+ 3 stutter thocks)
  crt_off         .                                                 TV off: static + 580 Hz, zip up, zip down
  tom             .     f0 300 f1 150                               fills (4 descending)
  chime           .     notes (84, 88, 91, 96)                      logo
  sparkle         .     notes (96, 100, 103, 108)                   burst of tiles
  sting           .     notes (81, 88) dur .6                       "done", the logo (root + fifth)
  foley
  riffle          .     dur .8 rate 18                              a book riffles (cue it when the object MOVES)
  page_turn       .     dur .24                                     a page turns
  flick           .     dur .14                                     a cover flicks
  paper           .     kind 'slap' | 'tap'                         a scrap lands (slap) / a card lands (tap)
  scratch         .     dur .6 speed [..]                           a pencil stroke; speed = draw speed over the stroke
  squeak          .     dur .12 f 2100                              highlighter / marker
  clink           .     f 2600                                      keys snapping into order
  ratchet         .     n 8 rate 24 f 2400                          a counter ratcheting
  bed and utilities (no family, never re-levelled)
  tape_stop       .     dur .35 hold                                music bus slows to a stop, then silence until the
                                                                    next section (or for hold s)
  gap             END   dur .4 hold 0                               silence the music bus before a payoff (and for
                                                                    hold s after t). {hold: 99} cuts it for good
  echo            .     n 6 note bpm decay .63                      ending: bed stops at t; its last pluck repeats on
                                                                    dotted 8ths, x decay (-4 dB) and darker each time;
                                                                    {n: 8, decay: .8} carries ~3 s
  none            .                                                 placeholder, plays nothing

autocue(events) -> cue rows for cut-driven edits. Event = {t, kind, ...}; t = the cut, or the moment the word lands.
  cut          passby peaking 50 ms before t          cut_insert    sub_boom on t + passby across it
  keyword      suck_in ending on t                    keyword_stat  thumps at t-.46 and t-.25, sub_boom on t
  flash        flash_hit      glitch  glitch          pill          blip_pop
  build        sub_swell ending on t ({dur: .8})      type          key_tap per character ({text} or {n}, {cps: 12})
  montage_in   flash_hit (music comes back up by itself in the VO gap)    montage_out   sub_drop
  Density, among the event rows: at most one air sound per 0.4 s (the earlier one wins, except that a cut's sound
  (cut, cut_insert, flash, montage_out) beats a keyword's (keyword, keyword_stat, pill): a cut is never left silent);
  a suck_in is dropped if any other sound is within 0.25 s of it.
"""
import json, subprocess, sys, wave
from pathlib import Path

import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

SR = 48000
LEVEL = {"sub": 6, "air": -14, "micro": -14, "foley": -18, "music": -12, "duck": 8}
DUCK = {"attack": 0.12, "release": 0.4, "gap": 0.3}
rng = np.random.default_rng(7)
SFX, FAMILY = {}, {}
ST = {"bus": "sfx", "g": 1.0}  # where put() sends by default, and the current section's gain
N, DUR, BUS, CAP, side, mg, PLUCKS, TAPE, STARTS, BED = 0, 0.0, {}, None, None, None, [], [], [], {}


def reset(dur):
    global N, DUR, BUS, CAP, side, mg, PLUCKS, TAPE, STARTS
    DUR, N, CAP, PLUCKS, TAPE, STARTS = dur, int((dur + 0.05) * SR), None, [], [], []
    BUS = {b: [np.zeros((2, N)), np.zeros((2, N))] for b in ("sfx", "mus", "duck", "room")}  # [dry, reverb send]
    side, mg = np.ones(N), np.ones(N)  # side: sidechain on pad + bass (kicks, mutes); mg: music-bus gate (gap, tape_stop, echo)


# ---------- helpers ----------
def filt(x, kind, f, order=2):
    return sosfilt(butter(order, f, btype=kind, fs=SR, output="sos"), x)


def env(n, a, r, hold=0.0):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a - hold) / max(r, 1e-4))


def fin(x, ms=25):  # fade the tail so a decay cut short doesn't click
    x = x.copy(); k = min(x.shape[-1], int(ms * SR / 1000)); x[..., x.shape[-1] - k :] *= np.linspace(1, 0, k); return x


def osc(freq, n, kind="saw", detune=0.0):
    ph = np.cumsum(np.broadcast_to(freq * (1 + detune), (n,))) / SR
    if kind == "saw": return 2 * (ph % 1) - 1
    if kind == "tri": return 2 * np.abs(2 * (ph % 1) - 1) - 1
    if kind == "sq": return np.sign(np.sin(2 * np.pi * ph))
    return np.sin(2 * np.pi * ph)


def bl_saw(freq, n):  # band-limited saw (harmonics under 20 kHz only), for high glides that would alias
    ph = 2 * np.pi * np.cumsum(np.broadcast_to(freq, (n,))) / SR
    return sum(np.sin(k * ph) / k for k in range(1, int(20000 // np.max(freq)) + 1)) * 2 / np.pi


def glide(f0, f1, n, tau):  # sine whose pitch falls f0 -> f1 exponentially (time constant tau)
    return np.sin(2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-np.arange(n) / SR / tau)) / SR)


midi = lambda m: 440 * 2 ** ((m - 69) / 12)
noise = lambda n: rng.standard_normal(n)
stereo = lambda x, d=240: np.vstack([x, np.roll(x, d)])


def bandnoise(fc, band=0.6):  # noise through a band-pass whose centre follows the array fc, in 5 ms steps
    n = len(fc); x = noise(n + 4096); out = np.zeros(n); step = int(0.005 * SR)
    for s in range(0, n, step):
        lo, hi = max(30, fc[s] * (1 - band / 2)), min(fc[s] * (1 + band / 2), SR / 2 - 200)
        m = min(step, n - s); out[s : s + m] = filt(x[s : s + 4096 + m], "band", [lo, hi])[4096:]  # 4096-sample warm-up
    return out


def sweep(dur, f0, f1, band=0.6, curve=1.0):
    n = int(dur * SR); return bandnoise(f0 * (f1 / f0) ** ((np.arange(n) / n) ** curve), band)


def shaped(dur, f0, f1, attack, band=0.5):  # the whoosh / swoosh / riser shape: attack^2, then a long fade
    n = int(dur * SR); return sweep(dur, f0, f1, band) * np.minimum(1, np.arange(n) / (attack * SR)) ** 2 * np.linspace(1, 0, n) ** 0.7


def put(at, sig, gain=1.0, pan=0.0, send=0.0, bus=None):
    """Mix mono or stereo sig at `at` s. pan -1..1, send = reverb amount, bus: sfx | mus | duck (sidechained) | room."""
    i = int(at * SR)
    if i >= N: return
    sig = np.atleast_2d(sig); sig = np.vstack([sig, sig]) if sig.shape[0] == 1 else sig
    if i < 0: sig, i = sig[:, -i:], 0
    sig = sig[:, : N - i] * (gain * ST["g"])
    if not sig.shape[1]: return
    k = min(sig.shape[1], int(0.008 * SR)); sig[:, -k:] *= np.linspace(1, 0, k)  # never click where a tail is cut
    sig *= np.array([[np.cos((pan + 1) * np.pi / 4)], [np.sin((pan + 1) * np.pi / 4)]]) * 1.414
    ev = [bus or ST["bus"], i, sig * (1 - send * 0.3), sig * send if send else None]
    CAP.append(ev) if CAP is not None else commit(ev)


def commit(ev):
    b, i, d, w = ev; BUS[b][0][:, i : i + d.shape[1]] += d
    if w is not None: BUS[b][1][:, i : i + w.shape[1]] += w


def gate(arr, t0, t1, r=0.006):  # arr = 0 over [t0, t1], with r-second ramps outside it
    a, b = max(0, int((t0 - r) * SR)), min(N, int((t1 + r) * SR) + 1)
    if b > a: t = np.arange(a, b) / SR; arr[a:b] = np.minimum(arr[a:b], np.clip(np.maximum(t0 - t, t - t1) / r, 0, 1))


def duck_side(at, depth, tau, dur):
    i = max(0, int(at * SR)); m = min(N - i, int(dur * SR))
    if m > 0: side[i : i + m] = np.minimum(side[i : i + m], 1 - depth * np.exp(-np.arange(m) / SR / tau))


def reg(fam):
    def deco(fn): SFX[fn.__name__] = fn; FAMILY[fn.__name__] = fam; return fn
    return deco


def alias(name, fn, **preset):
    SFX[name] = lambda at, g=1.0, **k: fn(at, g, **{**preset, **k}); FAMILY[name] = FAMILY[fn.__name__]


# ---------- sub ----------
def boom(dur=1.2, f0=95, f1=38, atk=0.012, tau=0.45, body=0.35, h2=0.0):
    n = int(dur * SR); s = (glide(f0, f1, n, 0.06) + h2 * glide(2 * f0, 2 * f1, n, 0.06)) * env(n, atk, tau)
    th = filt(noise(n), "low", 180, 4) * env(n, 0.003, 0.05) * body
    return fin(np.tanh((s + th) * 1.4) / np.tanh(1.4))


@reg("sub")
def sub_boom(at, g=1.0, f0=95, f1=38, tau=0.45, h2=0.0, dur=1.2, **_): put(at, boom(dur, f0, f1, 0.012, tau, 0.35, h2) * 0.9, g)


@reg("sub")
def sub_swell(at, g=1.0, dur=0.8, f=42, curve=3.0, **_):
    n = int(dur * SR); x = (osc(f, n, "sine") + filt(noise(n), "low", 90, 4) * 0.6) * (np.arange(n) / n) ** curve
    put(at - dur, fin(x / np.abs(x).max(), 4) * 0.9, g)


@reg("sub")
def whoomp(at, g=1.0, dur=1.1, **_):
    n = int(dur * SR); put(at, fin(boom(dur, 80, 34, 0.08, 0.5, 0.0) + sweep(dur, 700, 110, 1.2) * env(n, 0.18, 0.35) * 0.6) * 0.75, g)


@reg("sub")
def thump(at, g=1.0, dur=0.35, **_):
    n = int(dur * SR); put(at, (glide(160, 70, n, 0.03) * env(n, 0.002, 0.09) + filt(noise(n), "band", [300, 2500]) * env(n, 0.001, 0.012) * 0.3) * 0.8, g)


@reg("sub")
def sub_drop(at, g=1.0, f0=150, f1=45, **_):
    n = int(0.6 * SR); t = np.arange(n) / SR
    body = np.tanh(osc(f1 + (f0 - f1) * np.exp(-t / 0.09), n, "sine") * env(n, 0.002, 0.28) * 1.8) * 0.8
    put(at, fin(body + filt(noise(n), "high", 3000) * env(n, 0.0003, 0.004) * 0.3) * 0.75, g); duck_side(at, 0.8, 0.12, 0.4)


@reg("sub")
def impact(at, g=1.0, dur=1.2, **_):
    n = int(dur * SR); x = filt(noise(n), "high", 1500) * env(n, 0.001, 0.025) * 0.8 + boom(dur, 110, 42, 0.004, 0.4, 0.5)
    put(at, fin(x / np.abs(x).max()) * 0.9, g, send=0.15)


@reg("sub")
def thud(at, g=1.0, **_):
    kick(at, 0.9 * g); n = int(0.2 * SR); put(at, filt(noise(n), "low", 900) * env(n, 0.001, 0.05) * 0.4, g)


@reg("sub")
def boom_sting(at, g=1.0, f0=140, f1=45, h2=0.5, tau=0.6, **_): put(at, boom(1.6, f0, f1, 0.004, tau, 0.5, h2) * 0.9, g, send=0.15)


# ---------- air ----------
@reg("air")
def passby(at, g=1.0, dur=0.45, f0=400, fpk=3000, f1=600, peak=0.6, width=0.7, **_):
    n = int(dur * SR); u = np.arange(n) / n
    x = bandnoise(np.where(u < peak, f0 * (fpk / f0) ** (u / peak), fpk * (f1 / fpk) ** ((u - peak) / (1 - peak))), 0.8)
    x = x * np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.3); p = (np.linspace(-width, width, n) + 1) * np.pi / 4
    put(at - peak * dur, np.vstack([x * np.cos(p), x * np.sin(p)]) * 1.414 / np.abs(x).max() * 0.5, g, send=0.3)


@reg("air")
def suck_in(at, g=1.0, dur=0.45, f0=900, f1=5500, **_):
    n = int(dur * SR); r = int(0.07 * SR); x = sweep(dur, f0, f1, 0.7, 1.6) * np.linspace(0, 1, n) ** 1.8
    x[-r:] *= np.exp(-np.arange(r) / (0.025 * SR)); put(at - dur, stereo(x / np.abs(x).max() * 0.5), g, send=0.1)


@reg("air")
def flash_hit(at, g=1.0, dur=0.22, **_):
    n = int(dur * SR); x = filt(filt(noise(n), "high", 2000), "low", 8000) * env(n, 0.003, 0.07) + sweep(dur, 2500, 5500, 0.3) * env(n, 0.002, 0.04) * 0.6
    put(at, stereo(x / np.abs(x).max() * 0.45), g, send=0.2)


@reg("air")
def hiss_bed(at, g=1.0, dur=2.6, **_):
    n = int(dur * SR); e = np.sin(np.pi * np.arange(n) / n) ** 1.5
    put(at, np.vstack([filt(filt(noise(n), "high", 1000), "low", 9000) * e for _ in range(2)]) * 0.12, g, send=0.3)


@reg("air")
def whoosh(at, g=1.0, **_): x = shaped(0.55, 400, 6000, 0.38); put(at - 0.38, stereo(x) * 0.5, g, send=0.4)


@reg("air")
def swoosh(at, g=1.0, **_): x = shaped(0.4, 6000, 500, 0.03); put(at, stereo(x)[::-1] * 0.4, g, send=0.4)


@reg("air")
def riser(at, g=1.0, dur=1.5, **_):
    n = int(dur * SR); t = np.arange(n) / SR; tone = osc(220 * 2 ** (2 * t / dur), n, "saw") * (t / dur) ** 3 * 0.05
    put(at - dur, shaped(dur, 300, 9000, dur * 0.95, 0.8) * 0.5 + filt(tone, "low", 4000), g, send=0.5)


@reg("air")
def glide_riser(at, g=1.0, f0=200, f1=1050, dur=0.45, **_):
    n = int(dur * SR); t = np.arange(n) / SR; sw = (t / dur) ** 2
    put(at - dur, osc(f0 * (f1 / f0) ** (t / dur), n, "sine") * sw * 0.25 + filt(noise(n), "high", 2000) * sw ** 2 * 0.08, g, send=0.3)


@reg("air")
def downlifter(at, g=1.0, dur=0.6, **_):
    n = int(dur * SR); u = np.arange(n) / n
    x = filt(bl_saw(4500 * (2000 / 4500) ** u, n) * 0.1 + sweep(dur, 6000, 800, 0.9) * 0.7, "low", 7000) * env(n, 0.004, dur * 0.35)
    put(at, stereo(x) * 0.7, g, send=0.4)


@reg("air")
def swell(at, g=1.0, dur=1.4, f=70, **_):
    n = int(dur * SR); x = osc(f, n, "sine") * 0.6 + filt(filt(noise(n), "high", 4000), "low", 8000) * 0.4
    put(at, x * np.sin(np.pi * np.arange(n) / n) ** 2 * 0.7, g, send=0.3)


@reg("air")
def reverse_riser(at, g=1.0, dur=1.0, **_):  # dry: a reversed tail already sounds like the swell into a hit
    n = int(dur * SR); t = np.arange(n) / SR
    put(at - dur, np.vstack([(filt(filt(noise(n), "high", 2500), "low", 10000) * np.exp(-t / (dur * 0.3)) + filt(noise(n), "band", [500, 2500]) * np.exp(-t / (dur * 0.12)) * 0.4)[::-1] for _ in range(2)]) * 0.3, g)


@reg("air")
def burn_whoomp(at, g=1.0, **_):
    n = int(0.5 * SR); put(at - 0.5, filt(noise(n), "band", [1500, 10000]) * (np.arange(n) / n) ** 2.5 * 0.2, g, send=0.5)
    m = int(1.6 * SR); put(at, fin(osc(42 + 38 * np.exp(-np.arange(m) / SR / 0.15), m, "sine") * env(m, 0.004, 0.5) * 0.8), g)


@reg("air")
def record_scratch(at, g=1.0, dur=0.45, strokes=2, **_):
    n = int(dur * SR); u = np.arange(n) / n; s = 1 - np.abs(2 * ((u * strokes) % 1) - 1)  # triangle LFO: platter speed, 0 at each reversal
    x = bandnoise(300 + 2700 * s, 0.5) * 0.6 + filt(bl_saw(110 + 900 * s, n), "low", 3000) * 0.25
    put(at, x * s ** 0.7 * np.linspace(1, 0.6, n), g, send=0.1)


# ---------- micro ----------
def tick_sig(f=7000):
    n = int(0.03 * SR); return filt(noise(n), "band", [f * 0.7, min(f * 1.4, 20000)]) * env(n, 0.0004, 0.006)


@reg("micro")
def tick(at, g=1.0, f=7000, **_): put(at, tick_sig(f) * 0.5, g, pan=rng.uniform(-0.3, 0.3))


@reg("micro")
def tick_ramp(at, g=1.0, n=20, gap0=0.1, gap1=0.033, f=7000, **_):
    for k in range(n): tick(at, g, f); at += gap0 + (gap1 - gap0) * k / max(1, n - 1)


@reg("micro")
def ticks(at, g=1.0, n=7, gap=0.035, lo=3000, hi=14000, **_):
    m = int(0.03 * SR)
    for k in range(n):
        fc = np.exp(rng.uniform(np.log(lo), np.log(hi)))
        put(at + k * gap, filt(noise(m), "band", [fc / 1.5, min(fc * 1.5, SR / 2 - 100)]) * env(m, 0.0003, 0.007) * 0.35, g, pan=rng.uniform(-0.4, 0.4))


@reg("micro")
def click(at, g=1.0, **_):
    put(at, (osc(1800, 1200, "sine") * env(1200, 0.0003, 0.004) + filt(noise(1200), "high", 3000) * env(1200, 0.0003, 0.002) * 0.5) * 0.4, g)


@reg("micro")
def click_cluster(at, g=1.0, f=7000, times=(0, 0.09, 0.14), **_):
    for k, t0 in enumerate(times): put(at + t0, tick_sig(f * (1 + 0.15 * k)) * 0.45 * (1 - 0.2 * k), g)


@reg("micro")
def key_tap(at, g=1.0, **_):
    n = int(0.04 * SR); x = filt(noise(n), "band", [1800, 6000]) * env(n, 0.0003, 0.006) * 0.35 + osc(rng.uniform(180, 240), n, "sine") * env(n, 0.0005, 0.008) * 0.2
    put(at, x, g, pan=rng.uniform(-0.25, 0.25), send=0.05)


alias("type", key_tap)


def thock_sig(f, dur=0.09):
    n = int(dur * SR); x = noise(n) * env(n, 0.0003, 0.012); d = int(SR / 450); x[d:] += 0.85 * x[:-d]  # comb at 450 Hz: hollow key
    return (filt(x, "high", 400) * 0.25 + osc(f, n, "sine") * env(n, 0.001, 0.035) * 0.35 + osc(150, n, "sine") * env(n, 0.001, 0.02) * 0.5) * 0.5


@reg("micro")
def thock(at, g=1.0, f=1300, dur=0.09, **_): put(at, thock_sig(f, dur), g)


@reg("micro")
def ladder(at, g=1.0, word="", n=6, f0=1300, df=180, gap=0.105, **_):
    for i, ch in enumerate(word or "x" * n):
        if ch != " ": thock(at + i * gap, g, f0 + i * df)


@reg("micro")
def ui_blip(at, g=1.0, f=1760, dur=0.17, pan=0.0, send=0.1, amp=0.3, **_):
    n = int(dur * SR); x = (osc(f, n, "sine") + 0.4 * osc(2 * f, n, "sine")) * env(n, 0.001, 0.06) + filt(noise(n), "band", [300, 6000]) * env(n, 0.0003, 0.006)
    put(at, x * amp, g, pan=rng.uniform(-0.5, 0.5) if pan is None else pan, send=send)


alias("blip", ui_blip, f=1320, pan=None, send=0.4, amp=0.11)


@reg("micro")
def blip_pop(at, g=1.0, f0=1100, f1=780, dur=0.11, **_):
    n = int(dur * SR); put(at, glide(f0, f1, n, 0.03) * env(n, 0.002, 0.035) * 0.4, g, send=0.25)


alias("pop", blip_pop, f0=900, f1=380, dur=0.12)


@reg("micro")
def glitch(at, g=1.0, dur=0.28, seed=None, **_):
    r = np.random.default_rng(rng.integers(1 << 30) if seed is None else seed); n = int(dur * SR); x = np.zeros(n); i = 0
    while i < n:  # sample-and-hold, crushed noise slices at random bands, gains and gaps
        L = int(r.uniform(0.012, 0.035) * SR); hold = r.integers(4, 40)
        s = np.round(np.repeat(r.standard_normal(L // hold + 1), hold)[:L] * 6) / 6
        lo = r.uniform(800, 4000); s = filt(s, "band", [lo, min(lo * r.uniform(2, 5), 20000)])
        x[i : i + L] += s[: n - i] * r.uniform(0.3, 1.0) * (r.random() > 0.2); i += L + int(r.uniform(0, 0.02) * SR)
    put(at, x / (np.abs(x).max() + 1e-9) * 0.35, g)


@reg("micro")
def dot_ticks(at, g=1.0, n=14, gap=0.06, **_):
    m = int(0.025 * SR)
    for k in range(n): put(at + k * gap, filt(noise(m), "band", [6000, 16000]) * env(m, 0.0005, 0.008) * 0.2, g, pan=(k / max(1, n - 1) - 0.5) * 0.8)


@reg("micro")
def slot_roll(at, g=1.0, notes=(580, 855, 1131, 1400), steps=16, step=0.085, **_):
    for i in range(steps): put(at + i * step, thock_sig(notes[i % len(notes)], 0.06), 0.8 * g)


@reg("micro")
def heartbeat(at, g=1.0, **_):
    n = int(0.3 * SR); t = np.arange(n) / SR
    lub = (osc(70, n, "sine") * env(n, 0.002, 0.05) * 0.7 + osc(780 + 270 * np.exp(-t / 0.08), n, "sine") * env(n, 0.003, 0.09) * 0.3) * 0.6
    put(at, lub, g); put(at + 0.2, fin(lub[: int(0.15 * SR)], 20), 0.15 * g)


@reg("micro")
def static_slam(at, g=1.0, dur=0.35, tone=None, **_):
    n = int(dur * SR); t = np.arange(n) / SR
    x = filt(noise(n), "band", [100, 8000]) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 60 * t))) * env(n, 0.004, dur * 0.6) * 0.3
    put(at, fin(x + (osc(tone, n, "sine") * env(n, 0.004, dur * 0.8) * 0.2 if tone else 0)), g)


@reg("micro")
def crt_off(at, g=1.0, **_):
    n = int(0.25 * SR); put(at, fin(filt(noise(n), "band", [200, 10000]) * env(n, 0.002, 0.2, hold=0.05) * 0.25 + osc(580, n, "sine") * 0.06, 15), g)
    for t0, a, b, L in ((0.22, 1500, 8000, 0.07), (0.33, 8000, 1400, 0.13)):  # zip up, zip down
        m = int(L * SR); put(at + t0, fin(osc(a * (b / a) ** (np.arange(m) / SR / L), m, "sine") * env(m, 0.002, L * 0.5) * 0.18, 10), g)


@reg("micro")
def tom(at, g=1.0, f0=300, f1=150, **_):
    n = int(0.35 * SR); t = np.arange(n) / SR
    put(at, fin(osc(f1 + (f0 - f1) * np.exp(-t / 0.06), n, "sine") * env(n, 0.002, 0.25) * 0.6 + filt(noise(n), "high", 1000) * env(n, 0.0005, 0.01) * 0.2, 30) * 0.6, g, send=0.25)


def bells(at, g, notes, stagger=0.03, decay=0.7, amp=0.14, send=0.6, spread=0.3, dur=2.0):
    n = int(dur * SR)
    for k, m in enumerate(notes):
        put(at + k * stagger, fin(osc(midi(m), n, "sine") * env(n, 0.002, decay), 30) * amp * 0.75 ** k, g, pan=(k - (len(notes) - 1) / 2) * spread, send=send)


@reg("micro")
def chime(at, g=1.0, notes=(84, 88, 91, 96), **_): bells(at, g, notes)


@reg("micro")
def sparkle(at, g=1.0, notes=(96, 100, 103, 108), **_): bells(at, g, notes, 0.025, 0.4, 0.12, 0.5, 0.5, 1.2)


@reg("micro")
def sting(at, g=1.0, notes=(81, 88), dur=0.6, **_): bells(at, g, notes, 0, 0.35, 0.18, 0.4, 0, dur)


# ---------- paper and foley ----------
@reg("foley")
def riffle(at, g=1.0, dur=0.8, rate=18, **_):
    m = int(0.25 * SR); put(at, glide(140, 70, m, 0.05) * env(m, 0.004, 0.04) * 0.12, g)  # the lift
    t, k = 0.0, int(0.025 * SR)
    while t < dur:
        put(at + t, filt(noise(k), "band", [1500, 9000]) * env(k, 0.0004, 0.007) * 0.3 * rng.uniform(0.6, 1) * min(1, (dur - t) / 0.3 + 0.2), g, pan=rng.uniform(-0.3, 0.3), send=0.1)
        t += rng.uniform(0.8, 1.2) / rate


@reg("foley")
def page_turn(at, g=1.0, dur=0.24, **_):
    n = int(dur * SR); x = (sweep(dur, 2500, 6000, 0.9) + filt(noise(n), "band", [400, 1500]) * 0.25) * np.sin(np.pi * np.arange(n) / n) ** 1.5
    put(at, stereo(x) * 0.3, g, send=0.15)


@reg("foley")
def flick(at, g=1.0, dur=0.14, **_):
    n = int(dur * SR); put(at, filt(filt(noise(n), "high", 1200), "low", 8000) * env(n, 0.001, 0.035) * 0.2, g, send=0.1)


@reg("foley")
def paper(at, g=1.0, kind="slap", **_):
    n = int(0.12 * SR)
    if kind == "tap": x = filt(noise(n), "low", 2500) * env(n, 0.0005, 0.008) * 0.5 + osc(140, n, "sine") * env(n, 0.001, 0.04) * 0.5
    else: x = filt(noise(n), "band", [800, 4000]) * env(n, 0.0005, 0.012) * 0.5 + osc(120, n, "sine") * env(n, 0.001, 0.04) * 0.4
    put(at, x * 0.6, g, pan=rng.uniform(-0.2, 0.2), send=0.1)


@reg("foley")
def scratch(at, g=1.0, dur=0.6, speed=None, **_):
    n = int(dur * SR); u = np.arange(n) / n
    sp = np.interp(u, np.linspace(0, 1, len(speed)), speed) if speed else np.sin(np.pi * u) ** 0.5
    tooth = 0.5 + np.abs(filt(noise(n), "low", 60)) / 0.05  # paper tooth: slow random grain
    put(at, filt(noise(n), "band", [2000, 6000]) * sp * (0.65 + 0.35 * np.sin(2 * np.pi * 12 * u * dur)) * tooth * 0.04, g, pan=rng.uniform(-0.2, 0.2))


@reg("foley")
def squeak(at, g=1.0, dur=0.12, f=2100, **_):
    n = int(dur * SR); t = np.arange(n) / SR; ph = 2 * np.pi * np.cumsum(f + 60 * np.sin(2 * np.pi * 9 * t)) / SR
    x = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph) + filt(noise(n), "band", [1500, 5000]) * 0.15
    put(at, x * np.sin(np.pi * t / dur) ** 0.6 * 0.2, g, send=0.1)


@reg("foley")
def clink(at, g=1.0, f=2600, **_):
    n = int(0.35 * SR); f *= rng.uniform(0.96, 1.04)
    x = sum(a * osc(f * r, n, "sine") * env(n, 0.0005, d) for r, a, d in ((1, 1, 0.16), (2.32, 0.6, 0.08), (4.25, 0.35, 0.05), (6.8, 0.2, 0.03)))
    put(at, fin(x + filt(noise(n), "high", 4000) * env(n, 0.0002, 0.002) * 0.5, 15) * 0.15, g, pan=rng.uniform(-0.3, 0.3), send=0.25)


@reg("foley")
def ratchet(at, g=1.0, n=8, rate=24, f=2400, **_):
    m = int(0.03 * SR)
    for k in range(n):
        x = filt(noise(m), "band", [1500, 6000]) * env(m, 0.0002, 0.003) + osc(f * rng.uniform(0.97, 1.03), m, "sine") * env(m, 0.0005, 0.008) * 0.4
        put(at + k / rate, x * 0.25 * rng.uniform(0.75, 1), g, pan=0.1)


# ---------- bed and utility cues (no family) ----------
@reg(None)
def tape_stop(at, g=1.0, dur=0.35, hold=None, **_):
    TAPE.append((at, dur)); nxt = [s for s in STARTS if s > at + dur]
    gate(mg, at + dur, at + dur + hold if hold is not None else nxt[0] if nxt else DUR + 1)


@reg(None)
def gap(at, g=1.0, dur=0.4, hold=0.0, **_): gate(mg, at - dur, at + hold)


@reg(None)
def echo(at, g=1.0, n=6, note=None, bpm=None, decay=0.63, **_):
    d = 0.75 * 60 / (bpm or BED.get("bpm", 120)); heard = [p for p in PLUCKS if p[0] < at - 0.01]
    t0, m = heard[-1] if heard and note is None else (at - d, note or 76)
    gate(mg, at, DUR + 1); k, j = 0, 1
    while k < n:
        if t0 + j * d >= at - 1e-6: pluck(m, t0 + j * d, g * decay ** (k + 1), pan=0.4 if k % 2 else -0.4, lp=6000 * 0.7 ** k, bus="sfx"); k += 1
        j += 1


@reg(None)
def none(at, g=1.0, **_): pass


# ---------- bed instruments ----------
def kick(at, g=1.0, f0=155, f1=45, tau=0.035, decay=0.22, **_):
    n = int(max(0.45, 2 * decay) * SR); t = np.arange(n) / SR
    body = osc(f1 + (f0 - f1) * np.exp(-t / tau), n, "sine") * env(n, 0.001, decay)
    put(at, fin(np.tanh((body + filt(noise(n), "high", 2500) * env(n, 0.0005, 0.004) * 0.4) * 1.6) * 0.95), g)
    duck_side(at, 0.75, 0.09, 0.35)


def clap(at, g=1.0):
    n = int(0.35 * SR); x = filt(noise(n), "band", [900, 3200])
    e = sum(env(n, 0.0005, 0.008) * (np.arange(n) >= int(k * SR)) for k in (0, 0.011, 0.022)) + env(n, 0.0005, 0.12) * 0.7
    put(at, x * e * 0.55, g, send=0.35)


def hat(at, g=1.0, open_=False, pan=0.0):
    n = int((0.3 if open_ else 0.06) * SR); put(at, filt(noise(n), "high", 8000) * env(n, 0.0005, 0.09 if open_ else 0.018) * 0.28, g, pan=pan, send=0.1)


def snare(at, g=1.0):
    n = int(0.25 * SR); x = filt(noise(n), "band", [1500, 7000]) * env(n, 0.0005, 0.07) + osc(190, n, "sine") * env(n, 0.0005, 0.05) * 0.5
    put(at, x * 0.45, g, send=0.25)


def crash(at, g=1.0):
    n = int(2.5 * SR); put(at, stereo(filt(noise(n), "high", 3000) * env(n, 0.001, 0.6) * 0.18, 480), g, send=0.6)


def pad(chord, at, length, cutoff=1400, g=1.0):
    n = int((length + 0.8) * SR); L = np.zeros(n); R = np.zeros(n)
    for m in chord:
        L += osc(midi(m), n, "saw", -0.004) + osc(midi(m), n, "saw", 0.003) * 0.6
        R += osc(midi(m), n, "saw", 0.004) + osc(midi(m), n, "saw", -0.002) * 0.6
    put(at, np.vstack([filt(L, "low", cutoff), filt(R, "low", cutoff)]) * env(n, 0.25, 0.5, hold=length - 0.25) * 0.045, g, send=0.5, bus="duck")


def bass(m, at, length, g=1.0):
    n = int(length * SR); x = osc(midi(m), n, "saw") * 0.6 + osc(midi(m), n, "sine") * 0.8
    put(at, filt(x, "low", 420) * env(n, 0.004, length * 0.6) * 0.42, g, bus="duck")


def pluck(m, at, g=1.0, pan=0.0, lp=3500, bus=None):
    if (bus or ST["bus"]) == "mus": PLUCKS.append((at, m))
    n = int(0.5 * SR); x = osc(midi(m), n, "tri") + osc(midi(m) * 2, n, "sine") * 0.3
    put(at, filt(x, "low", lp) * env(n, 0.002, 0.14) * 0.16, g, pan=pan, send=0.45, bus=bus)


def drone_bed(hum=50, whine=7812, gain=1.0, **_):
    t = np.arange(N) / SR; h = sum(a * np.sin(2 * np.pi * hum * k * t) for k, a in ((1, 1), (2, 0.45), (3, 0.25), (4, 0.12)))
    x = h * 0.035 + np.sin(2 * np.pi * whine * t) * 0.006 + np.vstack([filt(filt(noise(N), "high", 300), "low", 8000) * 0.035 for _ in range(2)])
    put(0, x * np.clip(t / 0.05, 0, 1) * 0.5, gain, bus="room")  # ~20 dB under the blips


CUT = {"intro": 700, "groove": 1500, "break": 2600, "drive": 2200, "stop": 2000, "arp": 900}


def play_bed(bed):
    beat = 60 / bed["bpm"]; bar = 4 * beat; chords = bed["chords"]
    secs = [list(s) + [1.0] * (3 - len(s)) for s in bed.get("sections") or [[0, bed.get("type", "groove")]]]
    STARTS[:] = [s[0] for s in secs]; secs.append([DUR, "_", 1.0])
    kk, kp = bed.get("kick") or {}, bed.get("kick_pattern") or [0, 1, 2, 3]
    for si, ((s0, kind, sg), (s1, _, _)) in enumerate(zip(secs, secs[1:])):
        ST["g"] = sg
        if kind == "end":
            kick(s0, 1.1, **kk); impact(s0); crash(s0); ch = chords[0]; pad(ch, s0, max(0.1, s1 - s0 - 0.8), 2600, 1.4); bass(ch[0] - 24, s0, 2.5, 1.2)
            for k, m in enumerate(ch + [ch[0] + 12]): pluck(m + 12, s0 + k * beat / 4, 0.9, pan=(k - 2) * 0.3)
            continue
        if kind not in CUT and kind != "outro": sys.exit(f"unknown section kind {kind!r}")
        drums, t = kind in ("groove", "drive"), s0
        while t < s1 - 1e-6:
            ch = chords[int(round((t - secs[0][0]) / bar)) % len(chords)]; blen = min(bar, s1 - t)
            if kind != "outro": pad(ch, t, blen, CUT[kind], 0.7 if kind in ("intro", "arp") else 1.0)
            for k in range(int(round(blen / beat))):
                tb = t + k * beat
                if kind == "drive" and tb >= s1 - beat / 2 - 1e-6: continue  # the pre-drop gap
                if drums:
                    hat(tb + beat / 2, 0.9, open_=kind == "drive", pan=0.2)
                    if k % 2 == 1: clap(tb)
                    bass(ch[0] - 24, tb + beat / 2, beat / 2 * 0.9)
                    for q in (1, 3): hat(tb + q * beat / 4, 0.35, pan=-0.3)
                if kind == "break":
                    for q in range(4): hat(tb + q * beat / 4, 0.3 + 0.2 * (q == 2), pan=0.3 if q % 2 else -0.3)
                    if k == 0: bass(ch[0] - 24, tb, blen * 0.95, 0.9)
                if kind == "arp":  # 16ths, up-down over the chord + its octave
                    seq = ch + [ch[0] + 12] + ch[:0:-1]
                    for q in range(4):
                        s, ts = k * 4 + q, tb + q * beat / 4
                        pluck(seq[s % len(seq)] + 12, ts, 0.55 * (1.2 if q == 0 else 1) * (min(1, 0.1 + (ts - s0) / 1.65) if si == 0 else 1), pan=0.35 if s % 2 else -0.35)
                elif kind != "intro" or k % 2 == 0:  # 8ths, chord tones up an octave
                    gk = 0.5 if kind == "intro" else 0.8 * (1 - 0.65 * (tb - s0) / (s1 - s0)) if kind == "outro" else 0.8
                    for e8 in (0, 1): pluck(ch[(k * 2 + e8) % len(ch)] + 12, tb + e8 * beat / 2, gk, pan=0.4 if e8 else -0.4)
            if drums:
                for p in kp:
                    tk = t + p * beat
                    if tk < t + blen - 1e-6 and not (kind == "drive" and tk >= s1 - beat / 2 - 1e-6): kick(tk, 1.0, **kk)
            t += bar
        if kind == "break":  # snare roll into what follows
            for k in range(8): snare(s1 - beat + k * beat / 8, 0.3 + 0.08 * k)
        if kind in ("intro", "drive"): riser(s1, 1.0, dur=min(1.5, s1 - s0))
        if kind == "drive": gate(side, s1 - beat / 2, s1)  # half a beat of silence before the end hit
    ST["g"] = 1.0


# ---------- mixing ----------
def load(path):
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.astype(float)


def frames(x, hop=int(0.01 * SR)):  # mean power per 10 ms
    m = np.atleast_2d(x).mean(0); K = len(m) // hop; return (m[: K * hop].reshape(K, hop) ** 2).mean(1)


def level(x):  # loudest 50 ms RMS (a shorter sound counts as 50 ms, padded with silence)
    k = int(0.05 * SR); m = np.atleast_2d(x).mean(0); c = np.cumsum(np.concatenate([[0], m ** 2, np.zeros(max(0, k - len(m)))]))
    return np.sqrt(max((c[k:] - c[:-k]).max() / k, 1e-20))


def voice(spec):
    vo = np.zeros((2, N))
    for at, path in [[0, spec]] if isinstance(spec, str) else spec:
        x = load(path); i = int(at * SR); x = x[:, : max(0, N - i)]; vo[:, i : i + x.shape[1]] += x
    vo = filt(vo, "high", 80); p = frames(vo); act = p > p.max() * 10 ** -3.5  # speaking: within 35 dB of the loudest 10 ms
    return vo, np.sqrt(p[act].mean()), act


def duck_gain(act):  # act per 10 ms -> gain per sample: down LEVEL duck dB while the voice speaks
    act = act.copy(); on = np.flatnonzero(act)
    for a, b in zip(on[:-1], on[1:]):
        if b - a <= DUCK["gap"] / 0.01 + 1: act[a:b] = True  # short pauses stay ducked
    la = int(round(DUCK["attack"] / 0.01)); tgt = act | np.concatenate([act[la:], np.zeros(la, bool)])  # look ahead: fully down by the first word
    d = np.zeros(len(act))
    for k in range(1, len(act)): d[k] = min(d[k - 1] + 1 / la, 1) if tgt[k] else max(d[k - 1] - 0.01 / DUCK["release"], 0)
    return 10 ** (-LEVEL["duck"] * np.interp(np.arange(N) / (0.01 * SR), np.arange(len(d)), d) / 20)


def relevel(evs, fam, tgt, cap):  # one cue's events -> one event at the family's level against the voice
    i0 = min(e[1] for e in evs); d = np.zeros((2, max(e[1] + e[2].shape[1] for e in evs) - i0)); w = np.zeros_like(d)
    for _, i, x, y in evs:
        d[:, i - i0 : i - i0 + x.shape[1]] += x
        if y is not None: w[:, i - i0 : i - i0 + y.shape[1]] += y
    if fam == "sub":  # the sub part sits above the voice; whatever is above 150 Hz is held at the micro level
        lo, hi = (filt(filt(d, k, 150, 4), k, 150, 4) for k in ("low", "high"))  # Linkwitz-Riley 8 split
        lo = filt(lo, "low", 150, 4)  # steeper still: the sub keeps nothing in the voice's range
        s = tgt / level(lo); d = (lo + hi * min(1, cap / (level(hi) * s))) * s; w *= s
    else:
        s = tgt / level(d); d, w = d * s, w * s
    return ["sfx", i0, d, w]


def cue(row, ref):
    global CAP
    at, name, *rest = row
    if name not in SFX: sys.exit(f"unknown sfx {name!r}; known: {' '.join(SFX)}")
    g, kw, fam = rest[0] if rest else 1.0, rest[1] if len(rest) > 1 else {}, FAMILY[name]
    if ref is None or fam is None: return SFX[name](at, g, **kw)
    CAP = []; SFX[name](at, 1.0, **kw); evs, CAP = CAP, None
    if evs: commit(relevel(evs, fam, ref * 10 ** (LEVEL[fam] / 20) * g, ref * 10 ** (LEVEL["micro"] / 20)))


def reverb(v):  # stereo exponentially-decaying noise IR, pre-filtered
    if not v.any(): return v
    n = int(2.2 * SR); t = np.arange(n) / SR; r = np.random.default_rng(11)
    ir = [filt(r.standard_normal(n), "low", 7000) * np.exp(-t / 0.55) * (t > 0.012) for _ in range(2)]
    return np.vstack([fftconvolve(filt(v[c], "high", 250, 4), ir[c] / np.sqrt((ir[c] ** 2).sum()) * 0.9)[:N] for c in range(2)]) * 0.8


def lp_auto(x, pts):  # cutoff moves in log frequency; crossfades fixed low-passes so a sweep doesn't zipper
    cut = [300, 600, 1200, 2500, 4500, 9000, 20000]; ts, hz = zip(*pts)
    lv = np.interp(np.interp(np.arange(x.shape[-1]) / SR, ts, np.log(np.clip(hz, cut[0], cut[-1]))), np.log(cut), np.arange(len(cut))); out = np.zeros_like(x)
    for k, c in enumerate(cut):
        w = np.clip(1 - np.abs(lv - k), 0, 1)
        if w.any(): out += (x if c >= 20000 else filt(x, "low", c)) * w
    return out


def tape(x, at, dur):  # the music slows to a stop over dur, its low-pass falling 8 kHz -> 300 Hz
    i = int(at * SR); n = min(int(dur * SR), N - i)
    if n <= 0: return
    pos = i + np.cumsum(np.linspace(1, 0, n) ** 1.5)
    x[:, i : i + n] = lp_auto(np.vstack([np.interp(pos, np.arange(N), ch) for ch in x]) * np.linspace(1, 0, n) ** 0.5, [[0, 8000], [n / SR, 300]])


KW = [[1.53512485958697, -2.69169618940638, 1.19839281085285, 1, -1.69065929318241, 0.73248077421585],
      [1.0, -2.0, 1.0, 1, -1.99004745483398, 0.99007225036621]]  # BS.1770 K-weighting at 48 kHz


def loudness(x):  # integrated LUFS, BS.1770-4 gating
    p = (sosfilt(KW, x) ** 2).sum(0); c = np.concatenate([[0], np.cumsum(p)]); b = int(0.4 * SR)
    s = np.arange(0, max(1, len(p) - b + 1), int(0.1 * SR)); z = (c[np.minimum(s + b, len(p))] - c[s]) / b
    z = z[z > 10 ** ((-70 + 0.691) / 10)]
    return -0.691 + 10 * np.log10(z[z > z.mean() * 0.1].mean()) if len(z) else -70.0


def true_peak(x): return np.abs(resample_poly(x, 4, 1, axis=1)).max(0)


def limit(x, ceil=10 ** (-1.55 / 20)):  # look-ahead true-peak limiter: 40 ms hold, 5 ms ramps, never above what's needed
    need = np.minimum(1, ceil / np.maximum(true_peak(x)[: 4 * x.shape[1]].reshape(-1, 4).max(1), 1e-9))
    return x if need.min() >= 1 else x * uniform_filter1d(minimum_filter1d(need, int(0.04 * SR) | 1), int(0.005 * SR))


def render(cues, out="audio.wav", audition=False):
    global BED
    bed = cues.get("bed") or {}
    opt = lambda k, d=None: cues[k] if cues.get(k) is not None else bed.get(k, d)
    reset(cues["duration"]); BED = bed if bed.get("bpm") else {}
    ST.update(bus="mus", g=1.0)
    if BED: play_bed(BED)
    for t0, t1 in opt("mutes") or []: gate(side, t0, t1)  # pad and bass out (top level or bed.mutes)
    drone = opt("drone")
    if drone: drone_bed(**(drone if isinstance(drone, dict) else {}))
    ST.update(bus="sfx", g=1.0)
    vo, ref, act = voice(opt("vo")) if opt("vo") else (None, None, None)
    rows = cues.get("sfx") or []; rows = ([] if rows == "none" else list(rows)) + autocue(opt("events") or [])
    for row in rows: cue(row, ref)

    (md, mv), (dd, dv), (sd, sv), (rd, rv) = (BUS[b] for b in ("mus", "duck", "sfx", "room"))
    music = md + dd * side + reverb(mv + dv * side)
    if cues.get("music"):
        m = load(cues["music"])[:, :N]; music[:, : m.shape[1]] += m * 0.8 * np.clip((N - np.arange(m.shape[1])) / (1.5 * SR), 0, 1)
    for at, dur in sorted(TAPE): tape(music, at, dur)
    if vo is not None and music.any():  # music LEVEL music under the voice while it speaks, LEVEL duck dB up in the pauses
        p = frames(music); music *= ref * 10 ** ((LEVEL["music"] + LEVEL["duck"]) / 20) / np.sqrt(p[p > p.max() * 1e-4].mean()) * duck_gain(act)
    music = (music + rd + reverb(rv)) * mg
    lp, lp_all = opt("lp"), opt("lp_master")
    if lp and not lp_all: music = lp_auto(music, lp)
    mix = music + sd + reverb(sv) + (vo if vo is not None else 0)
    if lp and lp_all: mix = lp_auto(mix, lp)

    x = filt(mix, "high", 28) * np.clip((N - np.arange(N)) / (0.4 * SR), 0, 1)  # no rumble, no click at the very end
    if audition: x *= 10 ** (-1 / 20) / max(np.abs(x).max(), 1e-9)  # peak-normalised so the sounds keep their levels
    else:
        target = opt("lufs", -16 if drone and not BED and not cues.get("music") else -14)
        for _ in range(3): x = limit(x * 10 ** ((target - loudness(x)) / 20))
    with wave.open(out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1).T * 32767).astype(np.int16).tobytes())
    print(f"{out}: {DUR}s stereo, {loudness(x):.1f} LUFS, {20 * np.log10(true_peak(x).max() + 1e-12):.1f} dBTP, {len(rows)} cues"
          + "".join(f", {k}" for k, v in (("bed", BED), ("music", cues.get("music")), ("vo", vo is not None), ("drone", drone)) if v))
    return x


# ---------- auto-cues for edits ----------
AUTO = {"cut": [(-0.05, "passby", 0.8)], "cut_insert": [(0, "sub_boom", 1), (-0.05, "passby", 0.7)], "keyword": [(0, "suck_in", 1)],
        "keyword_stat": [(-0.46, "thump", 0.7), (-0.25, "thump", 0.8), (0, "sub_boom", 1)], "flash": [(0, "flash_hit", 1)],
        "glitch": [(0, "glitch", 1)], "pill": [(0, "blip_pop", 1)], "build": [(0, "sub_swell", 1)], "type": [],
        "montage_in": [(0, "flash_hit", 1)], "montage_out": [(0, "sub_drop", 1)]}


CUT_KINDS, KEY_KINDS = {"cut", "cut_insert", "flash", "montage_out"}, {"keyword", "keyword_stat", "pill"}


def autocue(events):
    """[{t, kind, ...}] -> [[t, name, gain(, params)], ...] by group A's placement rules, with the density cap."""
    rows = []
    for e in events:
        t, kind = e["t"], e["kind"]
        if kind not in AUTO: raise ValueError(f"autocue: unknown kind {kind!r}; known: {' '.join(AUTO)}")
        if kind == "type":
            text = e.get("text") or "x" * e.get("n", 8); r = np.random.default_rng(int(t * 1000))
            rows += [([t + i / e.get("cps", 12) + r.uniform(-0.02, 0.02), "key_tap", 1.0], kind) for i, ch in enumerate(text) if ch != " "]
        rows += [([t + dt, name, gain] + ([{"dur": e["dur"]}] if "dur" in e and kind == "build" else []), kind) for dt, name, gain in AUTO[kind]]
    rows.sort(key=lambda r: r[0][0]); out, air = [], None  # air = the last air row kept, and the event kind it came from
    for r, kind in rows:
        if r[1] == "suck_in" and any(o is not r and o[1] != "suck_in" and abs(o[0] - r[0]) < 0.25 for o, _ in rows): continue
        if FAMILY[r[1]] == "air":
            if air and r[0] - air[0][0] < 0.4:
                if kind in CUT_KINDS and air[1] in KEY_KINDS: out.remove(air[0])  # the keyword's sound goes, the cut's stays
                else: continue
            air = (r, kind)
        out.append(r)
    return [[round(r[0], 3)] + r[1:] for r in out]


# ---------- audition ----------
def measure(x):  # stereo -> peak dBFS, attack (onset to peak), decay to -20 dB, centroid, % energy below 90 Hz, DC % of peak
    pk = np.abs(x).max() + 1e-12; k = int(0.005 * SR); c = np.cumsum(np.concatenate([[0], (x ** 2).mean(0)])); e = np.sqrt((c[k:] - c[:-k]) / k)
    ip = e.argmax(); on = np.argmax(e > e[ip] * 0.01); off = len(e) - np.argmax(e[::-1] > e[ip] * 0.1)
    X = (np.abs(np.fft.rfft(x)) ** 2).sum(0); f = np.fft.rfftfreq(x.shape[1], 1 / SR)
    return [20 * np.log10(pk), (ip - on) / SR * 1000, (off - ip) / SR * 1000, (f * X).sum() / X.sum(), X[f < 90].sum() / X.sum() * 100, np.abs(x.mean(1)).max() / pk * 100]


def audition():
    global CAP
    reset(30); spots, t = [], 0.3
    print(f"{'sound':15} {'family':6} {'at':>6} {'dur':>5} {'peak':>6} {'atk ms':>6} {'dec ms':>6} {'centroid':>8} {'<90Hz%':>6} {'dc%':>5}")
    for name in [n for n, f in FAMILY.items() if f]:
        CAP = []; SFX[name](10.0, 1.0); evs, CAP = CAP, None
        i0 = min(e[1] for e in evs); d = np.zeros((2, max(e[1] + e[2].shape[1] for e in evs) - i0))
        for e in evs: d[:, e[1] - i0 : e[1] - i0 + e[2].shape[1]] += e[2]
        a = np.abs(d).max(0) > np.abs(d).max() * 1e-3; on, off = np.argmax(a), len(a) - np.argmax(a[::-1])  # -60 dB extent
        start = (i0 + on) / SR - 10.0; spots.append((t - start, name, t))
        print(f"{name:15} {FAMILY[name]:6} {start:+6.2f} {(off - on) / SR:5.2f} " + " ".join(f"{v:{w}.{p}f}" for v, w, p in zip(measure(d[:, on:off]), (6, 6, 6, 8, 6, 5), (1, 0, 0, 0, 1, 2))))
        t += (off - on) / SR + 0.4
    b0 = round(t + 0.4, 2); bed = {"bpm": 120, "chords": [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 67]],
                                  "sections": [[b0, "arp"], [b0 + 4, "groove"], [b0 + 8, "outro"]]}
    demo = [[b0 + 6, "gap", 1, {"dur": 0.5}], [b0 + 7.4, "tape_stop"], [b0 + 10, "echo"]]
    marks = [(t0, n) for _, n, t0 in spots] + [(b0, "bed: arp"), (b0 + 4, "groove"), (b0 + 5.5, "gap"), (b0 + 7.4, "tape_stop"), (b0 + 8, "outro"), (b0 + 10, "echo")]
    x = render({"duration": b0 + 13, "sfx": [[a, n] for a, n, _ in spots] + demo, "bed": bed}, "audition.wav", audition=True)
    plot(x.mean(0), marks, "audition.png")


def plot(m, marks, path, row=20.0):
    import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
    from scipy.signal import spectrogram
    f, ts, S = spectrogram(m, SR, nperseg=4096, noverlap=3072); fl = np.geomspace(20, 20000, 320)
    L = 10 * np.log10(S[np.minimum(np.searchsorted(f, fl), len(f) - 1)] + 1e-14); top = L.max()
    rows = int(np.ceil((len(m) / SR - 0.05) / row)); fig, axs = plt.subplots(rows, 1, figsize=(24, 3.4 * rows), squeeze=False)
    for r, ax in enumerate(axs[:, 0]):
        sel = (ts >= r * row) & (ts < (r + 1) * row); tt = ts[sel]
        ax.imshow(L[:, sel], origin="lower", aspect="auto", cmap="magma", vmin=top - 90, vmax=top, extent=[tt[0], tt[-1], 0, len(fl)]); ax.set_xlim(r * row, (r + 1) * row)
        hz = [30, 60, 90, 150, 300, 1000, 3000, 6000, 12000]; ax.set_yticks([np.searchsorted(fl, h) for h in hz], [f"{h // 1000}k" if h >= 1000 else h for h in hz])
        for t0, name in marks:
            if r * row <= t0 < (r + 1) * row: ax.axvline(t0, color="w", lw=0.6, alpha=0.6); ax.text(t0 + 0.05, len(fl) - 4, name, color="w", fontsize=8, rotation=90, va="top")
    axs[-1, 0].set_xlabel("seconds"); fig.tight_layout(); fig.savefig(path, dpi=80); print(f"{path}: spectrogram, {len(marks)} labels")


def report(cues):
    global CAP, BED
    rows = [] if cues.get("sfx") in (None, "none") else cues["sfx"]; bed = cues.get("bed") or {}
    plot(load("audio.wav").mean(0), [(r[0], r[1]) for r in rows] + [(s[0], s[1]) for s in bed.get("sections") or []], "spectrogram.png", max(20.0, cues["duration"]))
    reset(cues["duration"]); BED = bed if bed.get("bpm") else {}; ST.update(bus="mus", g=1.0)
    if BED: play_bed(BED)
    for t0, t1 in cues.get("mutes") or bed.get("mutes") or []: gate(side, t0, t1)
    for at, name, *rest in rows:  # gap, echo and tape_stop shape the bed
        if name in SFX and FAMILY[name] is None: SFX[name](at, rest[0] if rest else 1.0, **(rest[1] if len(rest) > 1 else {}))
    mus, db = (BUS["mus"][0] + BUS["duck"][0] * side) * mg, lambda v: 20 * np.log10(v + 1e-12); ST.update(bus="sfx", g=1.0)
    print(f"{'t':>6} {'cue':14} {'dBFS':>6} {'bed':>6} {'diff':>6}   pre-master; foley ~6-12 dB under the bed, ticks can sit lower")
    for at, name, *rest in rows:
        if not FAMILY.get(name): continue
        CAP = []; SFX[name](at, rest[0] if rest else 1.0, **(rest[1] if len(rest) > 1 else {})); evs, CAP = CAP, None
        if not evs: continue
        i0 = min(e[1] for e in evs); d = np.zeros((2, max(e[1] + e[2].shape[1] for e in evs) - i0))
        for e in evs: d[:, e[1] - i0 : e[1] - i0 + e[2].shape[1]] += e[2]
        b = db(level(mus[:, max(0, int((at - 1) * SR)) : int((at + 1) * SR)]))
        print(f"{at:6.2f} {name:14} {db(level(d)):6.1f} " + (f"{b:6.1f} {db(level(d)) - b:+6.1f}" if BED else "     -      -"))


if __name__ == "__main__":
    q = lambda: json.loads(Path("cues.json").read_text())
    audition() if "--audition" in sys.argv else report(q()) if "--plot" in sys.argv else render(q())
