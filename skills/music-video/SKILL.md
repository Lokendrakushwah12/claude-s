---
name: music-video
description: Make lyric-driven music videos from a song file, drawn entirely as hand-coded JavaScript canvas animation with a papery, hand-drawn look (kinetic lyrics, mascot characters that act on the beat with squash, stretch, anticipation and expressive faces, meme inserts, beat-synced cuts), rendered frame-exact to MP4. Also does "lyric essays" (karaoke captions, live exponential counters, diagrams cut to the arrangement), instrumental character shorts and silent shorts where the sound tells the story, and, with no song, a spoken-word version over a synthesised bed. Optionally uses fal.ai (image/video gen for character sheets, sets and motion reference) and ElevenLabs (SFX). Handles one video or a whole queue in bulk. Use when the user wants a "Claude Pop"-style music video, a lyric video, a lyric essay, an animated video for a song, a character animation or animated short (with or without music), or to batch-produce several of them, even if they just say "make a video for this song".
---

# Music video: song → JS-animated MP4

> Part of claude-s. When a job needs parts from other skills, read `../claude-s/SKILL.md`: which skill leads, and what the others lend.

The approach comes from donald jewkes' "Claude Pop" remake prompt: a coherent style bible, a mascot protagonist, lyrics as the main attention device, current zeitgeist references, and ruthless self-review. Everything on screen is drawn in code, so the video is deterministic and re-renderable. Generated images and video are optional **reference or underlay**, never the look itself.

`template/` is a working engine. **Copy it; don't rebuild it.** The creative work goes into `treatment.md` and `video.js`.

| file | what it is |
|---|---|
| `index.html` + `lib.js` | the scene engine and helpers: `bg text kinetic cover paper wobble boil sketch pulse lyricAt ease prog rng img`. Read `lib.js` once before writing scenes. |
| `toon.js` | character acting and music reactivity: `act` (pose to pose with anticipation and overshoot), `hop` `squashAt` `contactShadow` `walk` `limb`, `spline` `polyPath` `blobs` (smooth shapes, merged steam), faces (`face` `EXPR` `exprAt` `blinkAt` `mouthAt`), `band(t, 'low')` (the song's energy per band). Section "Characters" below. |
| `type.js` `look.js` `promo.js` `sfx.py` | copied in at setup from type-film and promo-video: `karaoke expLerp bigNum softcut callout` and more, `lutStab` and the film looks, the synthesised bed |
| `video.js` | **the creative file**: `VIDEO = { duration, audio, fonts, assets, scenes[], overlay }` |
| `lyrics.js` | `LYRICS` (lines, with word times), `BEATS`, `SONG`, `BANDS` (low/mid/high energy at 60 fps) and `VO` for spoken word, written by `align.py` (`--bands audio.wav` adds BANDS for a synthesised mix) |
| `align.py` | `uv run align.py song.mp3 lyrics.txt` gives word timings (Whisper) and a beat grid (librosa); `--spoken` and `--check`, below |
| `speak.py` `mix.py` | spoken word: Chatterbox performs `lyrics.txt`, a take per line; `mix.py` runs sfx.py balanced like a song |
| `examples/lyric-essay.js` `examples/character-short.js` | a finished lyric essay and a finished character short ("Boil": `act`, `hop`, faces, `blobs`, a pour, one event list driving picture and sound), to show the APIs in use. Never copy their scenes. |
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
- **Protagonist:** a mascot tied to the subject, plus 1–3 supporting characters, each drawable in canvas primitives (a body shape that squashes, a `face()`, two-bone `limb()`s) or generated as a reference sheet. Give each an acting arc in beats (asleep → startled → determined → joyful → asleep) and write the beat into the shot list.
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

**Style: silent short (no song, no voice; sound tells the story).** For a story told by characters, on a synthesised bed or none. Measured on a lighthouse-keeper silent short, a shadow theatre, a life-cycle piece and a robot short:
- **One world bed, filtered by where we are.** The storm outside stays the same signal all film; indoors it's heard through the wall (a layer with `muffle: 500`), and a door opening is the muffle gliding open. A hard change of the high band is the scene change. Build it with faceless-video's `ambience.py` (`cp ~/.claude/skills/faceless-video/ambience.py .`, write `scenes.json`, `uv run ambience.py scenes.json -o ambience.wav`) and set `VIDEO.music = 'ambience.wav'`: sfx.py mixes it on the music bus under the cues.
- **Sound for time and off-screen action:** a clock (`ambience.py` spot `clock`) while someone waits, steps on the stairs before we see them, a heartbeat whose gaps lengthen as a life ends (measured 0.52 → 0.81 s over 6 beats).
- **The payoff is the only tonal music**, or the first time the music is whole; before it, 0.4–0.6 s of silence. End on a held tone into digital silence (the reference stopped 0.6 s before its last card).
- **Structure:** a bookend with a difference (the opening's pose returns, but something has changed: the cup is full, the light is on; a plain repeat reads as predictable), and each beat adds ONE thing to the scene (a lit window, smoke from the stove, an open door) rather than cutting to a new place.

**3. Assets (optional, only when `FAL_KEY` is set and it's within budget)**
- Look up current model IDs and pricing on fal.ai at run time. Don't hardcode them.
- Generate a character turnaround and expression sheet plus the key set backgrounds in the style bible's look, and save them to `assets/`. Either draw the PNGs directly (with `paper()`, a multiply colour grade and hard cut-outs), or use them as tracing reference: a short generated clip for a hero motion, frames extracted with ffmpeg, the motion redrawn in canvas.
- Log every paid call with its cost in `spend.md`, and stop at the cap. With `ELEVENLABS_API_KEY`, SFX can be mixed in afterwards under the song.
- Without keys, draw everything in canvas. That works; the reference video was pure JS.

**4. Build `video.js`**, one section at a time in song order. Each shot list row becomes one or more scenes.
- Keep everything a pure function of `t`: no `Math.random()` (use `rng(seed)`) and no `Date.now()`.
- Cut on `BEATS`. Use `pulse(t)` for beat bounces and `wobble`/`boil` for hand-drawn jitter on twos.
- Use `kinetic()` or `karaoke()` for word-timed lyrics. Write custom text effects for the hero lines: a stretch, a stamp, per-letter drop, masked reveal or scramble.
- Put shared drawing (the character rig, backgrounds) in functions at the top of `video.js` and reuse them. Prefix their names: `cam`, `card`, `fill` and `S` already exist in the toolkits, and a clash stops the page booting.
- **One event list drives picture and sound.** Write the hits as data (landing times, lid rattles, steam puffs), draw from it, and build `VIDEO.sfx` from the same list, so every sound has a visible cause on its exact frame (the collision-machine reference's rule: every note is a visible hit).
- Preview with `node render.mjs --still <times>`. The user can also open `index.html` in a browser: click to play, arrows scrub, `#42` jumps to 42 s.

**Characters (toon.js).** The numbers come from the best character pieces on prompt-motion.com (a rigged samurai kata, two mascots acting a day, a life-cycle walk, a dance rig):
- **Pose to pose, never a constant drift.** A move takes 0.12–0.3 s and the pose then holds 0.5–1 s (the kata: 0.2 s moves, 0.5–1 s holds). `act(t, keys)` lands each pose ON its key time: a wind-up the other way (`a` 0.15–0.25 of the move, over `antic` 0.1–0.2 s), the move, an overshoot (`over` 0.1–0.15) and a settle. Put the key times on beats: the extreme or contact frame IS the beat.
- **Squash and stretch, volume kept** (`squashAt`): stretch 1.2–1.3 on a take-off or a startle, squash 0.7–0.8 on a landing, a deep crouch before a big move. A hop lifts at least 20 % of the body's height, or it doesn't read. `hop()` does a whole jump (wind-up, stretch, round apex, stretch into the landing, squash, wobble) and returns the landing time for the sound. A held character still breathes (±2 % at 3 s a cycle).
- **Faces carry the story.** One readable emotion per beat, held ≥ 0.5 s, changed in 2–4 frames (`exprAt`); through a build, a new face every 2 beats (sleepy → curious → eager → determined → strain), never one face for 3 s (a fresh critic read 12 cells of one scowl as "annoyed"). Blink every 2–6 s and always on a head turn and just before an expression changes (`blinkAt(t, seed, {at})`); the eyes lead the head by ~0.1 s (`look`). The vocabulary that read best: closed ∪ arcs asleep, ^ ^ happy, tall eyes + round mouth startled, half lids bored, brows for intent, blush. Mouths: `mouthAt(t, words)` opens once per syllable on the word times.
- **Secondary motion:** anything attached (lid, handle, ears, scarf, antenna) reads the body's motion at t − 0.06–0.12 s. A second character reacts 0.1–0.15 s after the first, never on the same frame, and answers on the off-beats (call and response).
- **Walks:** one step per beat (`walk()`), contact on the beat, body lowest just after contact and highest after the passing pose, arms against legs. Age a character by swapping its prop mid-stride (the life-cycle reference morphed a skateboard into a briefcase) instead of cutting.
- **Grounding:** a `contactShadow` under everything that stands or lands, smaller and fainter as it rises. Nothing floats. A tilt turns about the corner it leans onto (`squashAt(..., rot, pivot)`); rocked about its centre, a body sinks a corner into the floor.
- **Camera: framings, not one locked wide.** Even in one unbroken shot, move between 4–5 framings by what the beat is about: close on the face for an emotion (×1.5), on the prop the character looks at, wide for action, a slow push through a held breath, a blow-back on the drop, close on the payoff. A fresh critic called the one-framing version "the brief, transcribed".
- **Give the second character a want and pay it off** (a mug waiting with its teabag from frame one gets its tea at the end). Without one, a sidekick is decoration and the ending is a fade.
- **Material:** flat fills read as clip art. Multiply a soft pigment wash inside each fill and a darker rim at its edge (watercolour), keep the hand-drawn outline boiling on twos (`sketch` with `boil(t, 12, 3)` seeds), and keep paper grain over everything. Fill and outline from ONE dense point list (`spline(pts)`): a smooth fill under a `sketch` of the raw points shows straight segments. Steam, smoke and clouds are `blobs()` (one merged shape, one outline), never separately outlined circles. Light from the scene's sources: a flame lights the base, a window warms the wall, the highlight slides when the body tilts.
- **The drop is an event, not a colour change:** true silence before it (gate the music AND keep SFX out of the gap), then on the frame: ONE frame of pure white and straight back to full colour (a fading wash turns every outline grey), a camera that pushed in through the held breath blown back ~1.5× in 6 frames with an overshoot, a shake of ~10 px dying in 8 frames, something attached pops (a lid, a hat), the biggest stretch of the piece, and a burst of the subject's own material (steam, sparks, paper). Keep everything it throws inside a 5 % safe area and arcing into open space, never into the type.
- **Character sound** (sfx.py): `slide` up on a take-off, `squish` or `thud` on the squash frame, `boing` on a startle, `chirp` for a small creature, `babble` (with `text` and a `mood`; a low `'o'` at `rate` 2 is a snore) for speech without words, `deflate` for a sigh. Cue them on the animation's own frames, from the event list. A small action needs energy above 150 Hz: a sub-only `whoomp` disappears on a phone.

**Music reactivity.** `band(t, 'low' | 'mid' | 'high')` is the song's energy per band, 0..1. Tie ONE thing to each: the bass to a scale or a flame height (≤ 3 % on a whole frame, more on a small element), the highs to sparkle or grain, the voice band to the lyric's brightness. Beats (`pulse`) are for hits; bands are for continuous life. A HUD that shows the music (a bar counter, a tempo readout, a live level chart) works when it is the subject's own number.

**Lyric type in the scene.** The best lyric video measured put each verse line on a line in the picture (the horizon), small, in a light italic serif; the word being sung rises 8 px over ~0.2 s at full weight while the earlier words step back in weight and opacity; the line leaves as a group (blur-dissolve); the one hit word per section goes huge and bold; one line ran on an arc around the subject. One visual metaphor carried the whole song (a sun rising, burning, eclipsed, setting) with a countdown that ended on the last word.

**5. Review loop. This is where quality comes from; do at least 2 full passes.**
- After each section, run `node render.mjs --still` at 3–5 moments per scene and **look at every frame**. Is the text readable, with nothing clipped? Does the composition match the treatment? Is it on-palette? Does it look designed, or like default canvas?
- `node render.mjs --preview --from A --to B` renders a section draft. Extract frames at 2 fps and check the motion and the cut timing against the lyrics.
- Before `final`: do a full `--preview` render, make a 1 fps contact sheet (`ffmpeg -i out.mp4 -vf fps=1,scale=320:-1,tile=10x15 sheet.jpg`), and look for dead stretches, repeated looks and pacing sags. Look at the 6 frames around every cut (`select='between(n,F-2,F+3)',tile=6x1`), and at a spectrogram with the cut times drawn on it: hard cuts on drops, not in gaps.
- **Acting strip:** for every key action, tile 12–18 frames at 15 fps (`ffmpeg -ss A -t 1.2 -i out.mp4 -vf fps=15,crop=...,scale=200:-1,tile=9x2`). You should see the wind-up, the extreme on the beat, the overshoot and the settle; a pose that only slides between two drawings is a fail. Check nothing is cropped when the character stretches or the camera punches.
- **Sound balance:** `uv run sfx.py --plot` prints each cue's level against the bed around it. Check the silences on the spectrogram: `gap` ENDS at its time, so the pre-drop silence is `[DROP, 'gap', 1, {dur: 0.5}]` (cued half a second early, it silences the wrong half second). When SFX play the kick (a landing), shorten the bed's (`bed.kick: {decay: 0.1}`) or the tails fuse into one 40 Hz block at 120 BPM. A melody played by SFX (a whistle, a babble) is the lead: within 0–3 dB of the bed's loudest 50 ms. Foley sits 6–12 dB under, drum-role SFX (a landing as the kick) 3–6 dB over a quiet bed. A section that's 15 dB louder than the one before it buries everything cued in it: lift the quiet sections' gains instead.
- `uv run align.py --check final.mp4` transcribes the finished mix and compares it with `lyrics.js`. Every word should be heard, and onsets should sit within 2 frames. Whisper pads each line's first word 100–450 ms early, so judge the rest. A word heard in its take but lost in the mix is masked: lower that section's gain. A word lost in the take too needs a re-roll.
- Be honest in review. If a section looks weak, redo it rather than polishing it.

**6. Final:** run `node render.mjs --out final.mp4`, then check it with `ffprobe` (the duration should equal the song) and look at the last contact sheet. Report the path, the length, the style in one line, and the weak spots.

## Limits
- **Render time is the bottleneck?** For a NEW piece that doesn't need this skill's templates or toolkits (no footage, no type.js/look.js/sfx.py devices) and is long, batch-rendered or shader-heavy, [fframes](https://github.com/dmtrKovalenko/fframes) (MIT; Rust + SVG on the GPU) renders far faster than headless Chrome. Ask the user first: it needs the Rust toolchain (`rustup`, plus a first build of about a minute prebuilt or ~20 min from source), then `npx skills add https://fframes.studio` installs its own skill, which you then follow. Otherwise stay on render.mjs. Trade-offs: the README's "fframes or render.mjs?" table.
- **claude-s can't synthesise singing.** A sung video needs the user's song (or an ElevenLabs Music track, after asking). Otherwise it's spoken word over a synthesised bed; say which one up front.
- Lip-sync is one opening per syllable (`mouthAt`), not visemes: keep mouths small and cut away during long held vowels.
- Canvas 2D has no real 3D. Fake it with scale, parallax layers and perspective-drawn grids.
- Don't draw real people's likenesses, and don't use other brands' logos as if they were endorsements. Parody characters are fine.
