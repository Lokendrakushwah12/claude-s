---
name: music-video
description: Make lyric-driven music videos from a song file, drawn entirely as hand-coded JavaScript canvas animation with a papery, hand-drawn look (kinetic lyrics, a mascot character, meme inserts, beat-synced cuts), rendered frame-exact to MP4. Optionally uses fal.ai (image/video gen for character sheets, sets and motion reference) and ElevenLabs (SFX). Handles one video or a whole queue in bulk. Use when the user wants a "Claude Pop"-style music video, a lyric video, an animated video for a song, or to batch-produce several of them, even if they just say "make a video for this song".
---

# Music video: song → JS-animated MP4

The approach comes from donald jewkes' "Claude Pop" remake prompt: a coherent style bible, a mascot protagonist, lyrics as the main attention device, current zeitgeist references, and ruthless self-review. Everything on screen is drawn in code, so the video is deterministic and re-renderable. Generated images and video are optional **reference or underlay**, never the look itself.

`template/` is a working engine. **Copy it; don't rebuild it.** The creative work goes into `treatment.md` and `video.js`.

| file | what it is |
|---|---|
| `index.html` + `lib.js` | the scene engine and helpers: `bg text kinetic cover paper wobble boil pulse lyricAt ease prog rng img`. Read `lib.js` once before writing scenes. |
| `video.js` | **the creative file**: `VIDEO = { duration, audio, fonts, assets, scenes[], overlay }` |
| `lyrics.js` | `LYRICS` (lines, with word times), `BEATS`, `SONG`, written by `align.py` |
| `align.py` | `uv run align.py song.mp3 lyrics.txt` gives word timings (Whisper) and a beat grid (librosa) |
| `render.mjs` | `node render.mjs` renders headless Chrome to `out.mp4` at about 15 fps render speed, with no npm deps. Also `--still 3,12,40` for review frames, `--from/--to` for a section, `--preview` for a fast draft |

## Inputs per video
A folder containing:
- **`song.mp3`** (or wav/m4a). Required. The user must have the rights to publish it. If they have no song and `ELEVENLABS_API_KEY` is set, you *may* generate one with ElevenLabs Music, after asking.
- **`brief.md`**: what it's about, the audience, the vibe, and references (links, a character idea, a brand). Can be one sentence.
- `lyrics.txt`: optional but strongly preferred.
- `refs/`: optional images or videos to study.

## Bulk mode
When the user gives several songs or briefs, or points at a queue folder (default `~/Movies/music-videos/queue/<slug>/`):
1. List the queue and the output folders (`~/Movies/music-videos/<slug>/`). Skip slugs that already have a `final.mp4` unless told to redo them.
2. If fal.ai is going to be used, ask once for a **per-video spend cap** (the default suggestion is $20). Say how many videos × cap that adds up to.
3. Launch **one background subagent per video**, at most 3 at a time. Each render uses one Chrome and one ffmpeg, and more than that thrashes the machine. Give each agent the full text of "Per-video pipeline" below plus its folder paths and budget. Tell it to finish with a report: the path to `final.mp4`, the duration, what it's proud of, what's weak, and the money spent.
4. When they're done, make one contact sheet per video and report a table: slug | length | status | spend | weak spots.

## Per-video pipeline
**0. Setup**
```bash
cp -R ~/.claude/skills/music-video/template ~/Movies/music-videos/<slug> && cd $_
cp <queue>/song.* <queue>/brief.md <queue>/lyrics.txt . 2>/dev/null; uv run align.py song.* lyrics.txt
```
Open `lyrics.js`, fix any mis-heard words against `lyrics.txt` and keep the timings. Set `VIDEO.duration = SONG.duration` and `VIDEO.audio`. The first run downloads the Whisper model, about 1.5 GB.

**1. Study, before designing anything.** Read the brief and the lyrics line by line, and listen to the structure using `BEATS`, `SONG.bpm` and the gaps between lines: intro, verse, pre-chorus, chorus, drop, bridge, outro. Look at everything in `refs/`. If the brief touches a live topic, search the web for the current memes and events around it so the references land with the audience. For example, tech Twitter's AI-progress video pulled from p(doom), shoggoths, Navier-Stokes, "math is cooked", Sydney, the Chinese room, basilisk, shinigami eyes and "you're absolutely right".

**2. Write `treatment.md`.** This is the whole plan, so do the thinking here:
- **Style bible:** a 4–6 colour palette as hex, 2 fonts (a display face plus a contrast face, from Google Fonts), the texture (paper grain, halftone, misregistered print), and motion rules (for example "hold poses on twos, snap-in with `ease.back`, cut on beats"). Pick one coherent direction. Avoid generic glossy 3D, Pixar pastiche and default-looking gradients.
- **Protagonist:** a mascot tied to the subject, plus 2–4 supporting characters. Describe each so it can be drawn in canvas primitives, or generated as a reference sheet.
- **Shot list:** a table with time range | lyric | visual | text treatment (HUGE / medium / subtitle) | composition (where the text sits and where the character sits).
- **Rules for the shot list:**
  - **The hook is the first 3 seconds:** a huge kinetic lyric and the strongest image.
  - Put a cut or a visual change on every 1–2 bars, and a big change at every section boundary.
  - Vary how the text is treated, and don't run three HUGE shots in a row.
  - Busy backgrounds only where the text is small.
  - The chorus repeats should echo each other, with an escalating variation each time.
  - Put at least one insert without the character every ~20 s: a diagram, a chart, a meme collage, a fake UI, a newspaper.

**3. Assets (optional, only when `FAL_KEY` is set and it's within budget)**
- Look up current model IDs and pricing on fal.ai at run time. Don't hardcode them.
- Generate a character turnaround and expression sheet plus the key set backgrounds in the style bible's look, and save them to `assets/`.
- Use them in one of two ways:
  - Draw the PNGs directly, with `paper()`, a multiply colour grade and hard cut-outs, so they fit the drawn world.
  - Use them as tracing reference: generate a short video clip (Seedance or similar) for a hero motion, extract frames with ffmpeg, study the poses, and draw that motion in canvas.
- Log every paid call with its cost in `spend.md`, and stop at the cap.
- If `ELEVENLABS_API_KEY` is set, SFX (whooshes, risers, glitches) can be mixed in afterwards with ffmpeg `amix`. Keep them under the song.
- Without keys, draw everything in canvas. That works; the reference video was pure JS.

**4. Build `video.js`**, one section at a time in song order. Each shot list row becomes one or more scenes.
- Keep everything a pure function of `t`: no `Math.random()` (use `rng(seed)`) and no `Date.now()`.
- Cut on `BEATS`. Use `pulse(t)` for beat bounces and `wobble`/`boil` for hand-drawn jitter on twos.
- Use `kinetic()` for word-timed lyrics. Write custom text effects for the hero lines: a stretch, a stamp, per-letter drop, masked reveal or scramble.
- Put shared drawing (the character rig, backgrounds) in functions at the top of `video.js` and reuse them.
- Preview with `node render.mjs --still <times>`. The user can also open `index.html` in a browser: click to play, arrows scrub, `#42` jumps to 42 s.

**5. Review loop. This is where quality comes from; do at least 2 full passes.**
- After each section, run `node render.mjs --still` at 3–5 moments per scene and **look at every frame**. Check:
  - Is the text readable, with nothing clipped at the edges?
  - Does the composition match the treatment?
  - Is it on-palette?
  - Does it look designed, or does it look like default canvas?
- `node render.mjs --preview --from A --to B` renders a section draft. Extract frames at 2 fps and check the motion and the cut timing against the lyrics.
- Before `final`: do a full `--preview` render, make a 1 fps contact sheet (`ffmpeg -i out.mp4 -vf fps=1,scale=320:-1,tile=10x15 sheet.jpg`), and look for dead stretches, repeated looks and pacing sags. Then fix them.
- Be honest in review. If a section looks weak, redo it rather than polishing it.

**6. Final:** run `node render.mjs --out final.mp4`, then check it with `ffprobe` (the duration should equal the song) and look at the last contact sheet. Report the path, the length, the style in one line, and the weak spots.

## Limits
- Lip-sync isn't automatic. Suggest singing with mouth shapes keyed to word times (`LYRICS[].words`) and cutting away during long vowels.
- Canvas 2D has no real 3D. Fake it with scale, parallax layers and perspective-drawn grids.
- Don't draw real people's likenesses, and don't use other brands' logos as if they were endorsements. Parody characters are fine.
