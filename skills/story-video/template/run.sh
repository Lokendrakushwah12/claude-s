#!/bin/sh
# Whole pipeline, one command: voice -> cards -> soundtrack -> <folder-name>.mp4
#   ./run.sh              everything (re-narrates every line)
#   ./run.sh --keep-voice reuse voices/ takes, only rebuild cards, audio and the video
#   SFX=none ./run.sh     no SFX; the music alone carries the cuts
#   LOOK=0.3 ./run.sh     finish with type-film's film look at strength 0.3 (off by default; 0.3-0.5 when used)
set -e
cd "$(dirname "$0")"
TTS="${STORY_VIDEO_TTS:-$HOME/.local/share/story-video/tts-venv}/bin/python"
OUT="${OUT:-$(basename "$PWD").mp4}"
[ "$1" = "--keep-voice" ] || PYTORCH_ENABLE_MPS_FALLBACK=1 "$TTS" narrate.py 2>&1 | grep -E " ok$|Error" || true
uv run -q --with pillow make_cards.py
uv run -q --with numpy --with scipy --with pillow make_audio.py
# every card clip shares codec and size, so they join without re-encoding; the mix goes on top
python3 -c "import json;[print(f\"file '{m['path']}'\") for m in json.load(open('cards/manifest.json'))]" > cards/concat.txt
ffmpeg -loglevel error -y -f concat -safe 0 -i cards/concat.txt -i audio.wav \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -movflags +faststart "$OUT"
if [ -n "$LOOK" ]; then
  FILMLOOK="${FILMLOOK:-$HOME/.claude/skills/type-film/template/filmlook.sh}"
  [ -f "$FILMLOOK" ] || { echo "LOOK needs type-film's filmlook.sh, not found at $FILMLOOK (set FILMLOOK=)"; exit 1; }
  sh "$FILMLOOK" "$OUT" cards/look.mp4 "$LOOK" 0 && mv cards/look.mp4 "$OUT"  # DUST=0: its geq dust crawls at 4K
fi
echo "$OUT: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT")s"
