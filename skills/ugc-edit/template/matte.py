# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = ["mediapipe", "numpy", "pillow"]
# ///
"""Person matte for type behind the subject, and face boxes for captions that keep off the face.

    uv run matte.py frames/s03 [frames/s07 ...]      frames/sNN/0001.jpg... -> frames/sNN/m0001.jpg... (grey, white = subject,
                                                     half size); edit.py build calls it for `behind` shots on real footage
    uv run matte.py --face clip.mov src/A.face.json  the face box 5 times a second: {"fps": 5, "boxes": [[t, x0, y0, x1, y1] | [t]]}
                                                     in clip seconds, 0..1 of the (rotated) frame; ingest.py calls it per clip

MediaPipe through the Tasks API (mediapipe 1.x has no `solutions`): the selfie segmenter for mattes, BlazeFace full-range for
faces (short-range missed a face 15 % of the frame wide in 15 of 48 samples; full-range found all 48, with tighter boxes). Its
box runs forehead to chin, so it's grown to cover hair and chin, the way kurbaitaev/ghost-editor's face_track.py (MIT) grows
YuNet's. A shot with no face found keeps its captions where they are. Models (~250 KB each) come once from Google's model bucket into
~/.cache/claude-s/. If mediapipe can't load, it says so and exits 1: the build puts that keyword in front of the subject
instead, and ingest leaves captions where they are. Placeholders skip this: ingest.py writes their ground truth.
"""
import json, subprocess, sys, urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

CACHE, BUCKET = Path.home() / ".cache/claude-s", "https://storage.googleapis.com/mediapipe-models"
MODELS = {"seg": ("selfie_segmenter.tflite", "image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite"),
          "face": ("blaze_face_full_range.tflite", "face_detector/blaze_face_full_range/float16/latest/blaze_face_full_range.tflite")}
try:
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
except Exception as e:
    sys.exit(f"matte.py: mediapipe unavailable ({e}); keywords stay in front, captions stay put")


def model(k):
    f = CACHE / MODELS[k][0]
    if not f.exists(): CACHE.mkdir(parents=True, exist_ok=True); urllib.request.urlretrieve(f"{BUCKET}/{MODELS[k][1]}", f)
    return BaseOptions(model_asset_path=str(f))


def faces(clip, out, fps=5, long=640):
    j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation",
                                   "-of", "json", clip], capture_output=True, check=True).stdout)["streams"][0]
    w, h = j["width"], j["height"]
    if any(abs(int(d.get("rotation", 0))) % 180 == 90 for d in j.get("side_data_list", [])): w, h = h, w  # ffmpeg auto-rotates
    k = long / max(w, h); w, h = int(w * k) // 2 * 2, int(h * k) // 2 * 2
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", clip, "-vf", f"fps={fps},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    det = vision.FaceDetector.create_from_options(vision.FaceDetectorOptions(base_options=model("face"), min_detection_confidence=0.5))
    boxes = []
    for n, fr in enumerate(np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3)):
        d = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(fr))).detections
        if not d: boxes.append([round(n / fps, 3)]); continue
        b = max(d, key=lambda x: x.bounding_box.width * x.bounding_box.height).bounding_box  # the largest face is the speaker
        x0, y0, bw, bh = b.origin_x / w, b.origin_y / h, b.width / w, b.height / h
        boxes.append([round(n / fps, 3)] + [round(float(np.clip(v, 0, 1)), 4) for v in (x0 - 0.1 * bw, y0 - 0.4 * bh, x0 + 1.1 * bw, y0 + 1.12 * bh)])
    Path(out).write_text(json.dumps({"fps": fps, "boxes": boxes}))
    print(f"matte.py: {clip}: a face in {sum(len(b) > 1 for b in boxes)}/{len(boxes)} samples -> {out}")


def mattes(dirs):
    seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(base_options=model("seg"), running_mode=vision.RunningMode.VIDEO, output_confidence_masks=True))
    for d in map(Path, dirs):
        fs = sorted(d.glob("[0-9]*.jpg"))
        for k, f in enumerate(fs):
            im = Image.open(f).convert("RGB"); w, h = im.size; small = im.resize((w // 2, h // 2))
            m = seg.segment_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(small)), int(k * 1000 / 30)).confidence_masks[0].numpy_view()
            Image.fromarray((np.clip((np.squeeze(m) - 0.35) / 0.3, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)).save(d / f"m{f.name}", quality=90)
        print(f"matte.py: {d}: {len(fs)} mattes")


faces(*sys.argv[2:4]) if sys.argv[1:2] == ["--face"] else mattes(sys.argv[1:])
