---
name: faceless-video
description: Make a faceless video (nobody on camera) for Reels, Shorts, TikTok or YouTube from a script or a theme, in one of two modes. Narrated uses a human-sounding local AI voice (Chatterbox) with b-roll picked per line and word-level captions. Voiceless puts a fully synthesised natural soundscape where the voice would be (wind, birds, water, surf, rain, insects, crowd, rooms, machines, a projector), with foley on what's in shot. B-roll comes from public-domain archival film (archive-footage, licences checked at the source), the user's own clips, or canvas-drawn scenes, finished with a film grade and an end card that carries the credits. Use when the user says faceless, faceless channel, b-roll with a voiceover, documentary short, "no face", "no voice, just ambience", nature or ambient soundscape, an archival montage with sound, or wants silent old film given sound.
---

# Faceless video → MP4

The picture is someone else's world and the sound is ours. Two modes share one engine:
- **narrated:** a calm, close Chatterbox read, a new picture for every idea, and captions that build word by word on the voice.
- **ambient:** no voice. A procedural soundscape (`ambience.py`, no samples) changes with every cut, and foley lands on what's in the shot.

Where the rules come from (measured, see `~/Movies/refs/batch-2026-10-11/NOTES-G4.md`):
- @manwon_man (#29) gives the human read: a dry voice with its room tone kept and long pauses.
- @jordanarchivess (#30) gives the clean read: gated to silence with a short reverb tail.
- @julianleiss (#37) and @toonoxx_ (#38) give the archival edit grammar.

**Don't rebuild it.** Copy `template/`, write `film.json`, run `./make.sh`.

## When to use
- A faceless channel video, a documentary-style short, a mood piece, a "history in 20 seconds", a silent archival montage that needs sound.
- **Not this skill:** someone on camera is `ugc-edit`; type cards on a story is `story-video`; a product promo is `promo-video`; a brand film is `type-film`.

## 1. Set up
```bash
cp -R <this skill's dir>/template ~/Movies/faceless/<slug> && cd ~/Movies/faceless/<slug>
```
- **First run:** `make.sh` copies in `render.mjs` and `lib.js` (music-video), `look.js` (type-film), `sfx.py` (promo-video) and `ambience.py` (this skill). Delete a copy to pick up a newer one.
- **Narrated mode** needs the Chatterbox venv: `sh ~/.claude/skills/story-video/setup.sh`, once.

## 2. Write film.json
Before you plan the piece, run the creative method in `~/.claude/skills/type-film/creative.md` (20 concepts from the subject's own world, kill the first five, one "only this could exist here" invention).

- **Top level:**
  - `mode`: `narrated` or `ambient`.
  - `size`: `1080x1920` for Reels/Shorts, `1920x1080`, or `1440x1080` when it's all 4:3 film.
  - `fps`: 30.
  - `captions`: `line` (the default in narrated), `caps` (small spaced capitals) or `none`.
  - `voice`: `room` or `clean`.
  - `look`: `{preset, k, ...}`, any look.js pass by name; colour b-roll can take a cinematic grade preset instead of archival: `LOOK.umber` (moody low-key amber: interiors, night, food), `alpine` (cool, desaturated highs: landscape, travel), `cream` (faded, lifted warm blacks: interviews, lifestyle), `golden` (warm late sun: outdoor portraits) (or `sh grade.sh` on the clips). `palette`, `font`, `ui`, `end`.
- **narrated:** `lines: [{id, say, shots: [...], amb, pause?, exaggeration?, tts_text?}]`.
  - **One sentence per line, one idea per sentence, 4 to 10 words.** The take sets the clock.
  - A line starts `pause` (0.7) after the last one. Keep the pauses: #29 held a median of 0.66 s and never rushed.
  - A second shot inside a line cuts on word `on` (an index), 2 frames before that word. A new idea word gets a new picture; the rest stays put.
  - `tts_text` is what Chatterbox reads when it differs from the caption (a name, a number).
- **ambient:** `shots: [{..., dur, text?}]`.
  - **Rhythm (#37):** runs of 3-5 shots of 0.3-0.5 s each, accelerating into a hold of 2.5-3.6 s on a wide. Never an even beat.
  - `text` types a short line in over the first 60 % of the shot. Keep it to a place and a date, factual, from the clip's own metadata.

**Shot keys:**
- **Source:** `clip` (an `assets/archive/<name>.mp4` from archive-footage), `file` (the user's own clip) or `scene` (canvas: `sea`, `sky`, `intertitle` with `title`).
- **Trim:** `in` (seconds into the source), `speed` (0.6 slows 18 fps film down), `crop` (ffmpeg `w:h`, e.g. to drop pillarbox bars).
- **Camera:** `move` is `push` (default), `pull`, `drift`, `rise`, `settle` or `still`. The speed is constant, so motion carries across the cut, like a rostrum camera.
- **Frame:**
  - `full` (cover).
  - `box`: the whole frame fitted; use it for a face or sign you mustn't crop in 9:16.
  - `print`: a photo print on a table, #37.
  - `crt`: a tube screen, #38.
- **Effects:** `stutter` (hold each frame n frames, step-printing) and `flash` (a one-frame white burst on the cut, #30; use it once).
- **Sound:** `amb`, `spots`, `sfx`.

**B-roll, in this order:**
1. **Public-domain archival** via `archive-footage`. Search for what's in the frame, at most 3 searches, and use `get` only on `pd`, `pd-age` or `by` (credit it). Read its `editing.md` for shot ideas per theme.
2. **The user's own clips** (`file`).
3. **A canvas scene** when nothing fits. The archival grade makes it sit with the film.

Never use a reference's footage, a real public figure, or a disaster film for an unrelated mood.

## 3. Sound
`amb` is a shot's soundscape, `{layer: gain | {gain, ...params}}`. The layers:
- **Nature:** `wind`, `leaves`, `birds`, `gulls`, `stream`, `surf`, `rain`, `insects` (crickets or cicadas), `fire`.
- **Places and machines:** `crowd`, `traffic`, `machine`, `projector`, `hiss`, `room`.

The `ambience.py` docstring has every param. `spots` are one-shots relative to the cut: `chirp`, `gull`, `splash`, `thunder`, `steps` (gravel or wood), `hooves`, `clock` (tick-tock, `n`, `rate`), and `bell` (`f`, `decay`; f 1450 with decay .05 is a tram's ding).
- **Inside and outside (`muffle`).** A layer's value can carry `muffle` in Hz: the same storm heard through a wall is `{"wind": {"gain": 0.6, "muffle": 500}}`. Gain and muffle never restart a layer, so cutting from the coast to a room keeps ONE storm that darkens on the cut (the J-cut lead applies) and opens again when we go back out. A door is a short shot with the muffle off. This is how a silent short told its story with no words (measured on a 45 s lighthouse film: the high band vanished on the cut indoors, a clock ticked every 0.41 s, steps on the stairs came before the picture, and the lamp's harmonic drone was the only music, held into 0.6 s of silence before the end card).
- **What keeps it clean and human** (each rule is in the code):
  - The cut never drops to digital silence: a room floor runs under everything.
  - Nothing loops: events are Poisson with refractory gaps, a little random pitch, level and pan, all seeded.
  - Wind and leaves share their gusts.
  - Far sounds are darker and wetter.
  - The next shot's bed starts 0.1 s before its picture (a J-cut), with an equal-power crossfade over `xfade` (0.35 s; 0.2 for fast runs). A layer that continues across the cut is the same signal, only its gain eases.
- **Foley:** one spot per shot that matches something you can see: hooves under a carriage, steps on a bridge, a bell when there's a tower. Sound for things off screen reads as fake.
- **Levels:** each layer has a calibrated level (made for a voice at -18 dBFS).
  - **Narrated:** the bed sits `amb_under` dB (8) under that and lifts `amb_lift` dB (6) in pauses over 0.6 s. `room` adds room tone 35 dB under the voice, as #29 had; `clean` adds a short plate tail instead. Masters to -14 LUFS.
  - **Ambient:** the bed is the mix, SFX peak at `sfx_peak` (-20), and it masters to -16 LUFS.
  - A music bed is optional (`bed`, as in sfx.py). The voice-led refs used none (#29) or a quiet one (#30).
- **Checking it:** `uv run ambience.py --audition [names]` plays each layer in turn into `audition.wav`; `--selftest` asserts each layer sounds like its kind.

## 4. Build and check
```bash
./make.sh                  # narrated: voice -> words + timeline + frames + sound -> <folder>.mp4
./make.sh --keep-voice     # after changing shots, ambience, captions or the look
./make.sh --stills 1,4.5   # frames to look at, in review/
```
1. **Re-roll every `??` take** with `narrate.py <id>`. That's a take whisper heard differently.
2. **Look at a contact sheet:** `ffmpeg -i out.mp4 -vf fps=2,scale=200:-1,tile=11x3 -frames:v 1 contact.jpg`.
3. **Run `deconstruct.py` on your own MP4.** Cuts should land 0-150 ms before their words (#29: median -33 ms), and the loudness should be on target.
4. **Credits:** run `archive.py credits` before the build; `credits.txt` goes onto the end card, one line per film.

## Looks
- **Clean scans want almost nothing.** #37 added no damage at all. Use `{preset: "archival", k: 0.3, dust: 0}` to unify mixed sources into one b/w print.
- **When canvas scenes are in the cut,** raise it to k 0.45 with dust 0.5 so they read as film too.
- **Captions and the end card draw after the look,** so they stay sharp.

## Problems seen so far
- **A take passed a length check and was wrong.** "Nobody ever had to set it" came back as "...said it" twice. Rephrasing fixed it first time ("It never needed a key.").
- **Avoid words with two pronunciations.** "wind it" can be read as the weather.
- **Chatterbox reads fast:** 192-197 wpm against #29's 156. A lower `cfg_weight` didn't slow it. Longer `pause` values and short lines do.
- **The archive has hair and pans in it.** A 320x240 home movie had a hair in the gate and whip-panned after 1.5 s. Look at every clip's strip before you place it. `speed` 0.6 stretched the static part.
- **Pillarboxed HD archive copies.** An openbeelden 1920x1080 file was 4:3 inside black bars. Cover mode shows the bars; set `crop`.
- **A typed caption ran into the next shot.** Captions now end 0.35 s before the cut.
- **Tram bells rang for 2 s.** The bell's partials are a church bell's; `decay` 0.05 makes a ding.
- **Brown noise is mostly sub.** Unfiltered, traffic's centroid measured 13 Hz. Every noise in ambience.py is now flat below 20 Hz.
- **Heavy-tailed amplitudes clipped.** Pareto drops and bubbles peaked at +14 dBFS. They're capped now; the selftest asserts peaks under -1 dBFS.
- **The first canvas sea looked like vector art.** Stroked swell lines read as a diagram. Blurred filled bands and a flickering glint path read as film.
- **#30 has a voice.** The user called it "no human audio": its voice is synthetic-clean (digital silence between phrases, no breaths, a reverb tail), not absent. Both readings are covered: `voice: "clean"` and the ambient mode.
