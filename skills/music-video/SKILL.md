---
name: music-video
description: Make lyric-driven music videos from a song file, drawn entirely as hand-coded JavaScript canvas animation with a papery, hand-drawn look (kinetic lyrics, a mascot character, meme inserts, beat-synced cuts), rendered frame-exact to MP4. Also does "lyric essays" (karaoke captions, live exponential counters, diagrams cut to the arrangement) and, with no song, a spoken-word version over a synthesised bed. Optionally uses fal.ai (image/video gen for character sheets, sets and motion reference) and ElevenLabs (SFX). Handles one video or a whole queue in bulk. Use when the user wants a "Claude Pop"-style music video, a lyric video, a lyric essay, an animated video for a song, or to batch-produce several of them, even if they just say "make a video for this song".
---

# Music video: song → JS-animated MP4

The approach comes from donald jewkes' "Claude Pop" remake prompt: a coherent style bible, a mascot protagonist, lyrics as the main attention device, current zeitgeist references, and ruthless self-review. Everything on screen is drawn in code, so the video is deterministic and re-renderable. Generated images and video are optional **reference or underlay**, never the look itself.

`template/` is a working engine. **Copy it; don't rebuild it.** The creative work goes into `treatment.md` and `video.js`.

| file | what it is |
|---|---|
| `index.html` + `lib.js` | the scene engine and helpers: `bg text kinetic cover paper wobble boil sketch pulse lyricAt ease prog rng img`. Read `lib.js` once before writing scenes. |
| `type.js` `look.js` `promo.js` `sfx.py` | copied in at setup from type-film and promo-video: `karaoke expLerp bigNum softcut callout` and more, `lutStab` and the film looks, the synthesised bed |
| `video.js` | **the creative file**: `VIDEO = { duration, audio, fonts, assets, scenes[], overlay }` |
| `lyrics.js` | `LYRICS` (lines, with word times), `BEATS`, `SONG` (and `VO` for spoken word), written by `align.py` |
| `align.py` | `uv run align.py song.mp3 lyrics.txt` gives word timings (Whisper) and a beat grid (librosa); `--spoken` and `--check`, below |
| `speak.py` `mix.py` | spoken word: Chatterbox performs `lyrics.txt`, a take per line; `mix.py` runs sfx.py balanced like a song |
| `examples/lyric-essay.js` | a finished lyric essay, to show the API in use. Never copy its scenes. |
| `render.mjs` | `node render.mjs` renders headless Chrome to `out.mp4` at about 15 fps render speed, with no npm deps. Also `--still 3,12,40` for review frames, `--from/--to` for a section, `--preview` for a fast draft, `--cues` for the sound step, `--smooth` for 60 fps with a real shutter (pages can add `VIDEO.blur` windows for fast moves), `--motioncheck` for held frames, hitches and a judder index |

## Inputs per video
A folder containing:
- **`song.mp3`** (or wav/m4a). The user must have the rights to publish it. With no song, either make a spoken-word piece (below) or, if `ELEVENLABS_API_KEY` is set, generate one with ElevenLabs Music after asking.
- **`brief.md`**: what it's about, the audience, the vibe, and references (links, a character idea, a brand). Can be one sentence.
- `lyrics.txt`: optional but strongly preferred. `refs/`: optional images or videos to study.

## Bulk mode
When the user gives several songs or briefs, or points at a queue folder (default `~/Movies/music-videos/queue/<slug>/`):
1. List the queue and the output folders (`~/Movies/music-videos/<slug>/`). Skip slugs that already have a `final.mp4` unless told to redo them.
2. If fal.ai is going to be used, ask once for a **per-video spend cap** (the default suggestion is $20). Say how many videos × cap that adds up to.
3. Launch **one background subagent per video**, at most 3 at a time. Each render uses one Chrome and one ffmpeg, and more than that thrashes the machine. Give each agent the full text of "Per-video pipeline" below plus its folder paths and budget. Tell it to finish with a report: the path to `final.mp4`, the duration, what it's proud of, what's weak, and the money spent.
4. When they're done, make one contact sheet per video and report a table: slug | length | status | spend | weak spots.

## Per-video pipeline
Before you plan the piece, run the creative method in `~/.claude/skills/type-film/creative.md` (20 concepts from the subject's own world, kill the first five, one "only this could exist here" invention).

**0. Setup**
```bash
cp -R ~/.claude/skills/music-video/template ~/Movies/music-videos/<slug> && cd $_
cp ~/.claude/skills/type-film/template/{type.js,look.js} ~/.claude/skills/promo-video/template/{promo.js,sfx.py} .
cp <queue>/song.* <queue>/brief.md <queue>/lyrics.txt . 2>/dev/null; uv run align.py song.* lyrics.txt
```
Open `lyrics.js`, fix any mis-heard words against `lyrics.txt` and keep the timings. Set `VIDEO.duration = SONG.duration` and `VIDEO.audio`. The first run downloads the Whisper model, about 1.5 GB.

**No song: spoken word over a synthesised bed.** claude-s can't sing, so this is the honest version:
1. `lyrics.txt`: one line per 2 bars, 8 words at most (a take runs about 2 s; 2 bars at 128 BPM is 3.75 s).
2. `python3 ~/.cache/claude-s/ttslock.py ~/.local/share/story-video/tts-venv/bin/python speak.py`. Always under the lock, because other skills narrate too. `speak.py 4` re-rolls line 4.
3. `uv run align.py --spoken --bpm 128 --at <first slot>` puts each take's first word on its slot (one per `--every 2` bars) and times every word inside its take, so the karaoke runs on the bed's clock. It warns about mis-heard words and takes that overrun.
4. In `video.js`: `vo: window.VO, bed: { bpm, chords, sections }, sfx: 'none', audio: 'audio.wav'`, then `node render.mjs --cues && uv run mix.py`.

**1. Study, before designing anything.** Read the brief and the lyrics line by line, and listen to the structure using `BEATS`, `SONG.bpm` and the gaps between lines: intro, verse, pre-chorus, chorus, drop, bridge, outro. Look at everything in `refs/`. If the brief touches a live topic, search the web for the current memes and events around it so the references land with the audience. For example, tech Twitter's AI-progress video pulled from p(doom), shoggoths, Navier-Stokes, "math is cooked", Sydney, the Chinese room, basilisk, shinigami eyes and "you're absolutely right".

**2. Write `treatment.md`.** This is the whole plan, so do the thinking here:
- **Style bible:** a 4–6 colour palette as hex, 2 fonts (a display face plus a contrast face, from Google Fonts), the texture (paper grain, halftone, misregistered print), and motion rules (for example "hold poses on twos, snap-in with `ease.back`, cut on beats"). Pick one coherent direction. Avoid generic glossy 3D, Pixar pastiche and default-looking gradients. For a stop-motion paper look, set `VIDEO.stopmo = true` (12 fps holds, ±2 px jitter, ±1.2 % flicker) and draw lines with `sketch()` seeded by `boil(t, 12, 3)`.
- **Protagonist:** a mascot tied to the subject, plus 2–4 supporting characters, each drawable in canvas primitives or generated as a reference sheet.
- **Shot list:** a table with time range | lyric | visual | text treatment (HUGE / medium / subtitle) | composition (where the text sits and where the character sits).
- **Rules for the shot list:**
  - **The hook is the first 3 seconds:** a huge kinetic lyric and the strongest image.
  - Put a cut or a visual change on every 1–2 bars, and a big change at every section boundary. With music only, cut 50 ms before the beat (`beat - 0.05`).
  - Vary how the text is treated, and don't run three HUGE shots in a row. Busy backgrounds only where the text is small.
  - The chorus repeats should echo each other, with an escalating variation each time.
  - Put at least one insert without the character every ~20 s: a diagram, a chart, a meme collage, a fake UI, a newspaper.

**Style: lyric essay.** An argument told as a song: each line gets a diagram, the words land on their onsets, and live numbers carry the scale. Use it when the lyric is an idea (time, scale, science, history) rather than a feeling.
- **Captions:** `karaoke()` from type.js fades each word on at its onset over a dark keyline; the **held word** (the one the voice holds or leans on) is outline-only. Size is intensity: ~50 px subtitles for verses, 85–100 px display type for the big lines. Wrap rows yourself, one `karaoke()` per row.
- **Stat box:** a mono box in one fixed corner with label/value rows and a live exponential counter (`expLerp(v0, v1, p)`). Land the counter on the word that names the number, and run linked counters in lockstep (years and height).
- **Cuts:** one shot per line. Hard cuts only where the drums drop, glued with a 2-frame `lutStab()`; every other change is a 2-frame `softcut()`.
- **Beat pulse:** in the drums-out break the picture keeps time instead: `1 + 0.03 * pulse(t, 0.09)` on the frame, plus something that counts the beats to the turn.
- **A callback character:** one figure, same coat and pose, at three ages; the ending reprises the opening's composition.
- **Arrangement**, for a synthesised bed: `intro` (keys) → `groove` → 2 bars of `stop` (drums and bass out) before the turn → a louder `groove` → `outro` (keys). Raise the gain each chorus (0.8 → 1.15), and lift the quiet sections (intro ~3, stop ~2.2, outro ~1.8) or the keys vanish under the voice. A real song already has this shape: find its drops and breaks in the loudness and cut to them.

**3. Assets (optional, only when `FAL_KEY` is set and it's within budget)**
- Look up current model IDs and pricing on fal.ai at run time. Don't hardcode them.
- Generate a character turnaround and expression sheet plus the key set backgrounds in the style bible's look, and save them to `assets/`. Either draw the PNGs directly (with `paper()`, a multiply colour grade and hard cut-outs), or use them as tracing reference: a short generated clip for a hero motion, frames extracted with ffmpeg, the motion redrawn in canvas.
- Log every paid call with its cost in `spend.md`, and stop at the cap. With `ELEVENLABS_API_KEY`, SFX can be mixed in afterwards under the song.
- Without keys, draw everything in canvas. That works; the reference video was pure JS.

**4. Build `video.js`**, one section at a time in song order. Each shot list row becomes one or more scenes.
- Keep everything a pure function of `t`: no `Math.random()` (use `rng(seed)`) and no `Date.now()`.
- Cut on `BEATS`. Use `pulse(t)` for beat bounces and `wobble`/`boil` for hand-drawn jitter on twos.
- Use `kinetic()` or `karaoke()` for word-timed lyrics. Write custom text effects for the hero lines: a stretch, a stamp, per-letter drop, masked reveal or scramble.
- Put shared drawing (the character rig, backgrounds) in functions at the top of `video.js` and reuse them.
- Preview with `node render.mjs --still <times>`. The user can also open `index.html` in a browser: click to play, arrows scrub, `#42` jumps to 42 s.

**5. Review loop. This is where quality comes from; do at least 2 full passes.**
- After each section, run `node render.mjs --still` at 3–5 moments per scene and **look at every frame**. Is the text readable, with nothing clipped? Does the composition match the treatment? Is it on-palette? Does it look designed, or like default canvas?
- `node render.mjs --preview --from A --to B` renders a section draft. Extract frames at 2 fps and check the motion and the cut timing against the lyrics.
- Before `final`: do a full `--preview` render, make a 1 fps contact sheet (`ffmpeg -i out.mp4 -vf fps=1,scale=320:-1,tile=10x15 sheet.jpg`), and look for dead stretches, repeated looks and pacing sags. Look at the 6 frames around every cut (`select='between(n,F-2,F+3)',tile=6x1`), and at a spectrogram with the cut times drawn on it: hard cuts on drops, not in gaps.
- `uv run align.py --check final.mp4` transcribes the finished mix and compares it with `lyrics.js`. Every word should be heard, and onsets should sit within 2 frames. Whisper pads each line's first word 100–450 ms early, so judge the rest. A word heard in its take but lost in the mix is masked: lower that section's gain. A word lost in the take too needs a re-roll.
- Be honest in review. If a section looks weak, redo it rather than polishing it.

**6. Final:** run `node render.mjs --out final.mp4`, then check it with `ffprobe` (the duration should equal the song) and look at the last contact sheet. Report the path, the length, the style in one line, and the weak spots.

## Limits
- **Render time is the bottleneck?** For a NEW piece that doesn't need this skill's templates or toolkits (no footage, no type.js/look.js/sfx.py devices) and is long, batch-rendered or shader-heavy, [fframes](https://github.com/dmtrKovalenko/fframes) (MIT; Rust + SVG on the GPU) renders far faster than headless Chrome. Ask the user first: it needs the Rust toolchain (`rustup`, plus a first build of about a minute prebuilt or ~20 min from source), then `npx skills add https://fframes.studio` installs its own skill, which you then follow. Otherwise stay on render.mjs. Trade-offs: the README's "fframes or render.mjs?" table.
- **claude-s can't synthesise singing.** A sung video needs the user's song (or an ElevenLabs Music track, after asking). Otherwise it's spoken word over a synthesised bed; say which one up front.
- Lip-sync isn't automatic. Suggest singing with mouth shapes keyed to word times (`LYRICS[].words`) and cutting away during long vowels.
- Canvas 2D has no real 3D. Fake it with scale, parallax layers and perspective-drawn grids.
- Don't draw real people's likenesses, and don't use other brands' logos as if they were endorsements. Parody characters are fine.
