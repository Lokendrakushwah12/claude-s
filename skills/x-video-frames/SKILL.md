---
name: x-video-frames
description: Download a video from an X/Twitter post link and extract frames (default 1 per second) plus a contact sheet. Also deconstructs a reference video (X link, any URL or a local file) into measured facts (hard and jump cuts, shot lengths, camera zoom and pan, beats, SFX transients, word timing, loudness, ducking) and a report with TAKE/LEAVE sections to fill. Use when the user shares an x.com or twitter.com status link and asks for frames, stills, screenshots or a frame grab, or when a reference video needs taking apart ("how is this cut", "what are the sounds", type-film step 1).
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

## Deconstruct a reference

Use this when a reference has to be taken apart rather than just looked at: type-film step 1, "make one like this", "how is this edited", "what are the sounds". It runs the measurements the 2026-10-10 research agents each rebuilt by hand, the same way every time.

```bash
uv run ~/.claude/skills/x-video-frames/deconstruct.py "<x.com URL | any URL | local file>" [--out DIR] [--fps 2] [--stems] [--drift]
```
- `--stems` splits voice from the rest with demucs (torch, about 1 GB on first use). **Use it whenever someone speaks.** Without it, sounds inside words are dropped, because on a full mix a syllable and an SFX look the same. It also measures the real ducking.
- `--drift` measures camera zoom and pan per shot with ORB (opencv): push-ins, slides, zoom-settles.
- About 15 s for a 50 s clip, or 30 s with both flags once they're installed. Only the first video of a multi-video post is used.
- Memory grows with length: a 168 s 1080p video takes about 2 minutes and peaks near 4 GB. If a run ends with only a `leaked semaphore` warning and no `report.md`, macOS killed it for memory. Re-run it when nothing else is rendering.

It writes to `~/Downloads/x-frames/<id or file name>/`:
- `report.md` with the facts, and `report.html`, the same page with the images embedded.
- Pictures: `contact.jpg`, `cuts_*.jpg` (the frame before and after every cut), `sheets/` (8 fps, 3 s each, labelled), `frames/t<sec>.jpg`, `spectrogram.png` (cuts, words, beats and SFX marked), `waveform.png` (levels, voice vs bed).
- Data: `cuts.json`, `sound.json`, `transcript.json`, `camera.json`.

Then:
1. Read `report.md`, `contact.jpg`, every `cuts_*.jpg`, `spectrogram.png`, and the `sheets/` around anything that matters.
2. Fill the TAKE and LEAVE sections in `report.md` by looking. The numbers come from the report. Judgement comes from the frames: how type enters, palette roles, what a transition actually is.
3. Re-render the page with your notes in it: `uv run deconstruct.py <DIR> --html`.

What the numbers can and can't say:
- **Cuts** are frame-difference spikes over a local floor, so they catch the locked-off jump cuts that `scene>0.3` misses. Hard means the picture was replaced. Jump means the framing stayed the same: a jump cut, or a graphic popping in a single frame (check the cut sheet). Dissolves and whips aren't listed.
- **Beat:** trust the tempo only when `pulse` ≥ 0.2. Speech and beatless beds still get a confident tempo, with a pulse under 0.1.
- **SFX:** classes are guesses from band, attack, decay and tonality. `voice leak?` rows are breaths and sibilants that demucs left in. Slow, soft swells and glides under a bed show up in the spectrogram but rarely in the list.
- **Words:** whisper `base`, fed a numpy array because its PyAV path is broken here. A low mean confidence or the wrong language means it is hearing words in music.
- **Calibration** against the hand measurements of a 50 s podcast edit:
  - cuts: all 37 hand-marked cuts, each within one frame;
  - SFX: 53 of 89 transients;
  - ducking: 8.3 dB against 8 by hand.

  On our own heat-pump lesson, whose cue times are exact, 19 of its 29 non-leak SFX were real cues.

**Honesty rule: Claude doesn't hear the file.** Write "the spectrogram shows a falling noise band peaking 60 ms before the cut, probably a whoosh", never "a whoosh plays". Give every number with its method. Say plainly when a number is noise: tempo with a low pulse, ducking under 2 dB, any class guess.
