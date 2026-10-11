# /// script
# dependencies = ["numpy", "scipy", "matplotlib"]
# ///
"""sfx.py plus the three sounds an aura drop needs, then the same render: `node render.mjs --cues && uv run aura_sfx.py`.
(sfx.py belongs to promo-video; these live here until they're folded into it. Same cue rows, same mix, same master.)

  bass808   .  note 29 dur .8 glide 2.5 gt .12 drive 1.8   an 808: a sine that falls `glide` semitones into `note` over
                                                         gt s, saturated so phones hear its harmonics. On the music bus,
                                                         so a `gap` stop silences it with the rest of the music
  drop_kit  .  bars 4 bpm 150 kick (0, 1.5, 2.5) clap (1, 3) hats 8 swing 0
                                                         the drop's drums for `bars` bars from `at`, on the music bus
  tone      .  f 960 dur .4                              a held sine (a monitor's flatline, a test tone); sfx bus
Measured on the 2026-10-11 aura references: the sub band leaves 0.35-0.4 s before the drop while the melody carries on
(use `mutes` on the bed), the drop arrives 16-20 dB louder below 90 Hz with an 808 sliding ~2.5 semitones down into its
note, and inside the drop the whole mix stops dead for 0.25 s at a time (a `gap` cue with dur .25).
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import numpy as np
import sfx
from sfx import SR, env, fin, filt, midi, noise, osc, put, reg


@reg("sub")
def bass808(at, g=1.0, note=29, dur=0.8, glide=2.5, gt=0.12, drive=1.8, **_):
    n = int((dur + 0.06) * SR); t = np.arange(n) / SR; f = midi(note) * 2 ** (glide * np.exp(-t / max(gt, 1e-3)) / 12)
    x = np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * drive) / np.tanh(drive) * env(n, 0.004, 0.06, hold=dur)
    put(at, fin(x * 0.55), g, bus="mus")


@reg("sub")
def drop_kit(at, g=1.0, bars=4, bpm=150, kick=(0, 1.5, 2.5), clap=(1, 3), hats=8, swing=0.0, **_):
    beat, prev = 60 / bpm, sfx.ST["bus"]; sfx.ST["bus"] = "mus"  # sfx.py's own kick, clap and hat, routed with the music
    try:
        for b in range(bars):
            t0 = at + b * 4 * beat
            for k in kick: sfx.kick(t0 + k * beat, 1.0, f0=170, f1=48, tau=0.03, decay=0.3)
            for k in clap: sfx.clap(t0 + k * beat, 0.9)
            for k in range(hats):  # hats per bar, the odd ones pushed late by `swing` of their spacing
                sfx.hat(t0 + (4 * k + (swing if k % 2 else 0) * 4) / hats * beat, 0.5 if k % 2 else 0.8, pan=0.25 if k % 2 else -0.25)
    finally: sfx.ST["bus"] = prev


@reg("micro")
def tone(at, g=1.0, f=960, dur=0.4, **_):
    n = int(dur * SR); put(at, osc(f, n, "sine") * np.minimum(1, np.arange(n) / (0.005 * SR)) * 0.2, g)


if __name__ == "__main__":
    q = lambda: json.loads(Path("cues.json").read_text())
    sfx.audition() if "--audition" in sys.argv else sfx.report(q()) if "--plot" in sys.argv else sfx.render(q())
