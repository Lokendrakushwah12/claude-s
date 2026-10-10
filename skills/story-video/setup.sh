#!/bin/sh
# One-time setup. Safe to re-run: it skips itself when Chatterbox is already installed.
set -e
TTS="${STORY_VIDEO_TTS:-$HOME/.local/share/story-video/tts-venv}"

for tool in uv ffmpeg; do
  command -v "$tool" >/dev/null || { echo "missing: $tool  (brew install $tool)"; exit 1; }
done

# Chatterbox, local expressive TTS. setuptools<80: its watermarker still imports pkg_resources
if ! "$TTS/bin/python" -c "import chatterbox.tts, perth; assert perth.PerthImplicitWatermarker" 2>/dev/null; then
  mkdir -p "$(dirname "$TTS")"
  uv venv -q -p 3.11 "$TTS"
  VIRTUAL_ENV="$TTS" uv pip install -q chatterbox-tts "setuptools<80"
fi

echo "Setup done. Chatterbox: $TTS  (the model downloads on first narration, a few GB)"
