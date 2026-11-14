#!/bin/sh
# lyrics.txt -> captions, render the picture, lay the song (mix.wav: the reference's song + the tap clicks) under it,
# and make the phone-size copy. Run from this folder:  ./finish.sh
set -e
cd "$(dirname "$0")"
# time the words to the singing again whenever lyrics.txt changed
[ lyrics_times.json -nt lyrics.txt ] || uv run -q lyrics_align.py 2>&1 | grep -v -i warn
python3 lyrics.py
cp ~/.claude/skills/aura-edit/template/video.js video.js && cat project.js >> video.js
node render.mjs --size 1920x1080 --out kashmir-dnd-ig.mp4 --subframes 4
ffmpeg -loglevel error -y -i kashmir-dnd-ig.mp4 -i mix.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest kashmir-dnd-song.mp4
ffmpeg -loglevel error -y -i kashmir-dnd-song.mp4 -c:v libx264 -b:v 10M -maxrate 12M -bufsize 20M -preset slow -pix_fmt yuv420p -c:a aac -b:a 256k -movflags +faststart kashmir-dnd-song-share.mp4
echo "done: kashmir-dnd-song.mp4 (master) and kashmir-dnd-song-share.mp4 (phone size)"
