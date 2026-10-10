---
name: x-video-frames
description: Download a video from an X/Twitter post link and extract frames (default 1 per second) plus a contact sheet. Use when the user shares an x.com or twitter.com status link and asks for frames, stills, screenshots, or a frame grab of the video.
---

# X/Twitter video → frames

Needs `yt-dlp` and `ffmpeg` (both in /opt/homebrew/bin; `brew install yt-dlp ffmpeg` if missing).

1. Peek at the metadata first, without downloading:
   ```bash
   yt-dlp --no-warnings -j "<URL>" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["title"][:80],"|",d["duration"],"s |",d["width"],"x",d["height"])'
   ```
   Tell the user the title, duration and resolution. A shared link plus a request for frames counts as permission to download. Only ask first if the video is over 10 minutes long.

2. Download it and extract the frames. Pull the tweet id out of the URL (`/status/<id>`) and save everything to `~/Downloads/x-frames/<id>/`:
   ```bash
   D=~/Downloads/x-frames/<id>; mkdir -p "$D/frames"
   yt-dlp -q --no-warnings -o "$D/video.mp4" "<URL>"
   ffmpeg -loglevel error -i "$D/video.mp4" -vf fps=1 "$D/frames/frame_%03d.png"
   ```
   Change `fps=1` if the user asks for a different rate (`fps=2`, `fps=1/5`, ...). For scene changes only, use `-vf "select='gt(scene,0.3)'" -vsync vfr`. For specific timestamps, run `-ss <t> -frames:v 1` once per timestamp.

3. Build a contact sheet and send it with SendUserFile:
   ```bash
   N=$(ls "$D/frames" | wc -l); C=10; R=$(( (N + C - 1) / C ))
   ffmpeg -loglevel error -y -i "$D/video.mp4" -vf "fps=1,scale=320:-1,tile=${C}x${R}:padding=4" -frames:v 1 "$D/contact_sheet.jpg"
   ```
   Keep the fps here the same as in step 2. The local ffmpeg build has no `drawtext` filter, so there are no timestamp overlays. Frame N is at second N−1 when fps=1.

4. Report back: how many frames, the folder path, and the file size.

If the post has several videos, yt-dlp saves each one as a separate playlist item. Use `-o "$D/video_%(playlist_index)s.mp4"` and handle each file separately.
