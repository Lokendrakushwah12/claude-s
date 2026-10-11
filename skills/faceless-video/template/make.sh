#!/bin/sh
# Faceless video, one command, from the project folder:
#   ./make.sh                narrated: voice (Chatterbox) -> words, timeline, frames, sound (build.py) -> render -> <folder>.mp4
#   ./make.sh --keep-voice   reuse voices/ (after changing shots, ambience, captions, look or timing)
#   ./make.sh --stills 1,4.5 a few frames to look at (review/), no sound
# Shared files are copied in from the other skills on the first run; delete a copy to pick up a newer one.
set -e
cd "$(dirname "$0")"
S="${SKILLS:-$HOME/.claude/skills}"
for f in music-video/template/render.mjs music-video/template/lib.js type-film/template/look.js promo-video/template/sfx.py faceless-video/ambience.py; do
  [ -f "$(basename "$f")" ] || cp "$S/$f" .
done
eval "$(python3 -c "import json; f = json.load(open('film.json')); print('MODE=%s SIZE=%s FPS=%s' % (f.get('mode', 'narrated'), f.get('size', '1080x1920'), f.get('fps', 30)))")"
OUT="${OUT:-$(basename "$PWD").mp4}"
if [ "$1" = "--stills" ]; then uv run -q build.py --picture && node render.mjs --size "$SIZE" --still "$2"; exit; fi
TTS="${STORY_VIDEO_TTS:-$HOME/.local/share/story-video/tts-venv}/bin/python"
if [ "$MODE" = narrated ] && [ "$1" != "--keep-voice" ]; then PYTORCH_ENABLE_MPS_FALLBACK=1 "$TTS" narrate.py; fi
uv run -q build.py
node render.mjs --size "$SIZE" --fps "$FPS" --out "$OUT"
echo "$OUT: $(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT")s"
