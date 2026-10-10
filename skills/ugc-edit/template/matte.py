# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["mediapipe", "numpy", "pillow"]
# ///
"""Person matte for type behind the subject: frames/sNN/0001.jpg... -> frames/sNN/m0001.jpg... (grey, white = subject, half size).

    uv run matte.py frames/s03 [frames/s07 ...]      edit.py build calls it for `behind` shots on real footage

MediaPipe's selfie segmenter through the Tasks API (mediapipe 1.x has no `solutions`). The 250 KB model comes once from
Google's model bucket into ~/.cache/claude-s/. If mediapipe can't load, it says so and exits 1, and the build puts that
keyword in front of the subject instead. Placeholders skip this: ingest.py writes their ground-truth matte.
"""
import sys, urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

MODEL = Path.home() / ".cache/claude-s/selfie_segmenter.tflite"
URL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"
try:
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
except Exception as e:
    sys.exit(f"matte.py: mediapipe unavailable ({e}); keywords stay in front")
if not MODEL.exists(): MODEL.parent.mkdir(parents=True, exist_ok=True); urllib.request.urlretrieve(URL, MODEL)
seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
    base_options=BaseOptions(model_asset_path=str(MODEL)), running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True))
for d in map(Path, sys.argv[1:]):
    fs = sorted(d.glob("[0-9]*.jpg"))
    for k, f in enumerate(fs):
        im = Image.open(f).convert("RGB"); w, h = im.size; small = im.resize((w // 2, h // 2))
        m = seg.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(small)), int(k * 1000 / 30)).confidence_masks[0].numpy_view()
        Image.fromarray((np.clip((np.squeeze(m) - 0.35) / 0.3, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)).save(d / f"m{f.name}", quality=90)
    print(f"matte.py: {d}: {len(fs)} mattes")
