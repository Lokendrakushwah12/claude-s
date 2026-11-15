# /// script
# requires-python = ">=3.10,<3.12"
# dependencies = ["deepfilternet", "torch<2.6", "torchaudio<2.6", "numpy", "soundfile"]
# ///
"""Clean a phone-mic voice locally: wind, traffic, crowd and room noise out, the speaker kept. DeepFilterNet 3 (open model,
MIT/Apache; downloads once), run on this Mac. Works on a .wav or on a video (the cleaned audio is muxed back, picture copied).

    uv run denoise.py in.mp4|in.wav [out] [--mix 0.9] [--atten 30]

--mix  how much of the cleaned signal to keep (0.9 = 10 % of the original underneath, so the voice doesn't sound processed)
--atten  the most noise reduction allowed in dB (30; lower is gentler, raise it for a bad recording)
Prints the noise floor (quietest 10 % of 50 ms windows) and the speech level (loudest 10 %) before and after, so every run
is measured: a good clean drops the floor 10-25 dB and leaves the speech level within ~1 dB.
"""
import subprocess, sys, tempfile
from pathlib import Path

import numpy as np
import soundfile as sf


def levels(x, sr):  # (noise floor dB, speech dB) from 50 ms RMS windows
    h = int(0.05 * sr); n = len(x) // h
    r = 20 * np.log10(np.sqrt((x[:n * h].reshape(n, h) ** 2).mean(1)) + 1e-9)
    return float(np.percentile(r, 10)), float(np.percentile(r, 90))


def main(src, out=None, mix=0.9, atten=30.0):
    from df.enhance import enhance, init_df
    import torch
    src = Path(src); is_video = src.suffix.lower() not in (".wav", ".flac", ".mp3", ".m4a", ".aac")
    out = Path(out) if out else src.with_name(src.stem + ".clean" + (src.suffix if is_video else ".wav"))
    model, state, _ = init_df(); sr = state.sr()
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / "in.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", str(sr), str(wav)], check=True)
        x, _ = sf.read(wav, dtype="float32")
        y = enhance(model, state, torch.from_numpy(x)[None], atten_lim_db=float(atten)).squeeze(0).numpy()
        y = mix * y[:len(x)] + (1 - mix) * x[:len(y)]
        clean = Path(d) / "clean.wav"; sf.write(clean, y, sr)
        if is_video:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-i", str(clean), "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                            "-c:a", "aac", "-b:a", "256k", "-shortest", str(out)], check=True)
        else:
            sf.write(out, y, sr)
    (f0, s0), (f1, s1) = levels(x, sr), levels(y, sr)
    print(f"{out}: noise floor {f0:.1f} -> {f1:.1f} dB ({f1 - f0:+.1f}), speech {s0:.1f} -> {s1:.1f} dB ({s1 - s0:+.1f})")


if __name__ == "__main__":
    a = sys.argv[1:]; kw = {}
    for flag in ("--mix", "--atten"):
        if flag in a: i = a.index(flag); kw[flag[2:]] = float(a[i + 1]); del a[i:i + 2]
    if not a: sys.exit(__doc__)
    main(*a, **kw)
