#!/bin/sh
# Whole pipeline, one command: voice -> cards -> soundtrack -> <folder-name>.mp4
#   ./run.sh              everything (re-narrates every line)
#   ./run.sh --keep-voice reuse voices/ takes, only rebuild cards, audio and the video
set -e
cd "$(dirname "$0")"
TTS="${STORY_VIDEO_TTS:-$HOME/.local/share/story-video/tts-venv}/bin/python"
OUT="${OUT:-$(basename "$PWD").mp4}"
[ "$1" = "--keep-voice" ] || PYTORCH_ENABLE_MPS_FALLBACK=1 "$TTS" narrate.py 2>&1 | grep -E " ok$|Error" || true
uv run -q --with pillow make_cards.py
uv run -q --with numpy --with pillow make_audio.py
# every card clip shares codec and size, so they join without re-encoding; the mix goes on top
python3 -c "import json;[print(f\"file '{m['path']}'\") for m in json.load(open('cards/manifest.json'))]" > cards/concat.txt
# hold the end card through make_audio.py's 2.5 s tail (75 frames) so the last chord doesn't play over nothing
LAST=$(python3 -c "import json;print(json.load(open('cards/manifest.json'))[-1]['path'][:-4] + '.png')")
ffmpeg -loglevel error -y -loop 1 -framerate 30000/1001 -i "$LAST" -frames:v 75 -c:v libx264 -pix_fmt yuv420p -tune stillimage cards/zz-hold.mp4
echo "file '$PWD/cards/zz-hold.mp4'" >> cards/concat.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i cards/concat.txt -i audio.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart "$OUT"
echo "$OUT: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s"
