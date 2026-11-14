---
name: faceless-video
description: Make a faceless video (nobody on camera) for Reels, Shorts, TikTok or YouTube from a script or a theme, in one of two modes. Narrated uses a human-sounding local AI voice (Chatterbox) with b-roll picked per line and word-level captions. Voiceless puts a fully synthesised natural soundscape where the voice would be (wind, birds, water, surf, rain, insects, crowd, rooms, machines, a projector), with foley on what's in shot. B-roll comes from real footage of the subject (keynotes, interviews, news, film clips downloaded from links with yt-dlp), public-domain archival film (archive-footage, licences checked at the source), the user's own clips, or canvas-drawn scenes, finished with a film grade and an end card that carries the credits. Use when the user says faceless, faceless channel, b-roll with a voiceover, documentary short, a founder or company story cut from real clips (the "Nvidia isn't a chip company" reel style), "no face", "no voice, just ambience", nature or ambient soundscape, an archival montage with sound, or wants silent old film given sound.
---

# Faceless video → MP4

> Part of claude-s. When a job needs parts from other skills, read `../claude-s/SKILL.md`: which skill leads, and what the others lend.

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
- **Narrated mode** needs the Chatterbox venv: `sh ~/.claude/skills/story-video/setup.sh`, once. The voice defaults to this skill's female clone (see **Voice** below).

## 2. Write film.json
Before you plan the piece, run the creative method in `~/.claude/skills/type-film/creative.md` (20 concepts from the subject's own world, kill the first five, one "only this could exist here" invention).

In narrated mode, write the opening line with `~/.claude/skills/claude-s/hooks.md`; in ambient mode, pick a visual hook from it.

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
- **Source:** `clip` (an `assets/archive/<name>.mp4` from archive-footage), `file` (the user's own clip, or one downloaded from a link) or `scene` (canvas: `sea`, `sky`, `intertitle` with `title`, or `card`: the commentary reel's word card, `title` in Anton on `bg` `red`, `white` or `black`, with `sfx: [[0, "thud"]]` or `"impact"` on the big numbers).
- **Trim:** `in` (seconds into the source), `speed` (0.6 slows 18 fps film down), `crop` (ffmpeg `w:h`, e.g. to drop pillarbox bars).
- **Camera:** `move` is `push` (default), `pull`, `drift`, `rise`, `settle` or `still`. The speed is constant, so motion carries across the cut, like a rostrum camera.
- **Frame:**
  - `full` (cover).
  - `box`: the whole frame fitted; use it for a face or sign you mustn't crop in 9:16.
  - `print`: a photo print on a table, #37.
  - `crt`: a tube screen, #38.
- **Effects:** `stutter` (hold each frame n frames, step-printing) and `flash` (a one-frame white burst on the cut, #30; use it once).
- **Image pops:** `pops: {imgs, mode, every, at, size, sound, gain}` on any shot, footage or card. It's the commentary reel's burst (Nvidia reel, 22.1–23.5 s and 43.4–44.9 s). A still lands every `every` s (0.12), a white slab for one frame and then the image, with a `sound` (`click`) on each.
  - `imgs` holds paths (PNG or JPEG in the project) or `{file, in, crop?}` for a still pulled from a clip.
  - `mode: "collage"` (the default) blurs and darkens the shot and scatters stills `size` × W (0.24) over the middle. `"grid"` goes black and fills a 3×3 grid from the bottom-right.
  - Images past the shot's end are dropped with their clicks, so `imgs` × `every` should fit the shot. A line of 5–9 images is a word list ("shareholders", "infrastructure") made visible. Use one or two bursts a minute, not on every line.
  - Verified 2026-11-13 on a copy of binance-heist: the stills draw as designed, and onset detection found one click per image, 0.12 s apart.
- **Sound:** `amb`, `spots`, `sfx`.

**B-roll, in this order:**
1. **Real footage of the subject** when the story is about a real person, company or event: keynotes, interviews, news, product launches, film or TV clips that fit a line. Download each link with `uvx --python 3.12 yt-dlp -q --merge-output-format mp4 -o "assets/real/<name>.%(ext)s" "<URL>"` (see x-video-frames for why that yt-dlp), then use it as `file` with `in` set to the moment you want. Find the moment with `deconstruct.py <file>`'s transcript and frames, never by guessing. The user decides what footage is fine to use. Don't lecture about copyright. Credit the sources on the end card.
2. **Public-domain archival** via `archive-footage`. Search for what's in the frame, at most 3 searches, and use `get` only on `pd`, `pd-age` or `by` (credit it). Read its `editing.md` for shot ideas per theme.
3. **The user's own clips** (`file`).
4. **A canvas scene** when nothing fits. The archival grade makes it sit with the film.

Don't re-upload a reference's own edit: take its source footage, not its cut. Don't use a disaster film for an unrelated mood.

**Fast commentary pace** (measured on @monkeymotionss's Nvidia reel, 2026-11-13, `~/Downloads/x-frames/DdB8LATJ_1z/`): 203 wpm, 0.73 s average shot (0.30 s counting graphic pops), cuts on the words rather than the beat (157 of 187 within 200 ms of a word starting), the bed ducked about 10 dB under the voice, one-word captions small and centred low, and full-screen word cards on red, white or black between clips. For this style use `pause` 0.1, `exaggeration` up, and a new shot on nearly every content word. Put an image burst (`pops`) on a line that lists things: the reference's collage and grid each ran 8–9 stills at 0.12 s, with a click on each (onsets 0.12 s apart).

**The reel's cut tricks and its music (measured frame by frame and on the music stem, 2026-11-14; asked for by the user after the first Nvidia cut "has the same bg music as the previous video and no flash transitions").** The commentary style needs them on most cuts, not as decoration on a few:
- `fx` on a shot, a name or a list, on its first frames, each with its own sound (build.py `FX_SOUND`): `invert` (a colour-negative frame with a hard black or white block, then one more negative frame, with a glitch: the reel's 0.12, 1.50, 2.25 and 22.12 s), `blocks` (white and black tiles snap over the incoming shot for 2 frames, two clicks: 0.62, 22.25, 43.6 s), `glitch` (a red/cyan channel split shrinking over 3 frames: 13.25 s), `wipe` (an accent bar sweeps right to left over 0.22 s with the old shot's last frame on its left, a swoosh: 42.25 s). Put invert on footage and white or black cards, never on red cards: it turns the whole slab cyan, which the reel never does.
- `spot: {x, y, size}` darkens everything outside a square window on the subject (the chip, 1.6-2.1 s).
- `pops.mode: "strobe"` is the reel's product run (3.0-4.5 s, 13.4-14.4 s), the "PNGs on clicks": one still per step on alternating white and black plates, the negative on the plate that turns the still's own background into the plate's colour (`source: "dark"` for a GPU on a black stage), a click on each. Crop every still tight on the object (`crop` in source pixels) or it reads as a small photo, not a cut-out. Captions go dark on the white plates.
- First cut with these: 52 hard + 41 jump cuts in 43.6 s (128 per minute) against the reel's 198; the reel also swaps graphics inside shots more often, so add pops or strobes where a line lists things.
- **The music is a dark documentary bed, not an arp:** `bed: {bpm: 128, chords, sections: [[0, "tension"], [t, "pulse"], ..., [end, "end"]]}`. `tension` is a dark pad, a held sub and a soft low hit every 2 beats; `pulse` adds a quiet 16th-note clock tick (use it under a deadline or an earnings date); a riser leads into each new section. The reel's music measured: sub level with the low-mids, mids ~10 dB under, the top ~19-24 dB under, flat level (LRA 3.3), no drum grid, close dark harmony (D, C#, C, A). Voice the chords high (D4-D5, midi 62+) and keep the low hit soft: a 0.6 hit with a 0.55 s tail put the sub 24 dB over the low-mids. Tune on the bed alone (`sfx.render({"duration", "bed"})`), band by band against the reference's demucs `no_vocals` stem. Don't reuse the last video's bed: the user noticed straight away.

**Voice.** The default is the female clone: with no `tts.reference`, narrate.py uses `voices/female_samantha.wav` (the user chose it, 2026-11-13). That file is a synthetic female reference made from macOS Samantha (`say -v Samantha -r 185`), so it is nobody's real voice. `tts: {reference: "<wav>"}` clones another 10–20 s clip, and `"reference": null` goes back to Chatterbox's own voice. Measured on binance-heist lines: Chatterbox's own default voice is already in the female pitch range (171–219 Hz median F0). The Samantha clone sits at 184–203 Hz with a different timbre, and it reads slower (3.0 s became 4.1 s on l01), so raise `exaggeration` or cut words. The best voice is a clean recording of someone who agreed to be cloned, including the user. Never clone a real person's voice from the web.

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
- **First real-footage commentary reel** (`~/Movies/faceless/binance-heist/`, 2026-11-13; use its `film.json` as the starting point for the style): 1440x1080 like the reference, because 9:16 throws away two-thirds of 16:9 news. Split-screen news needs `crop` in source pixels (`w:h:x:y`); find the box on a full-res still. Find shots on 1-per-3 s contact sheets, but treat their times as ±3 s and check each pick on a still. `captions: "caps"` is too small at 1440 wide, so use `line`. The end card's `credit_label` ("FOOTAGE") replaces "ARCHIVAL FOOTAGE".
- **Most whisper `??` flags on a number-heavy script are digits** ("six point three" heard as "$6 .3"). They're harmless. Re-roll only real misreads. Rephrasing fixed them where re-rolling made them worse: "The test was the malware" became "the Nowhere"; "froze withdrawals" ran into "Binance Pro's". Spell brand names for the voice with `tts_text` ("By bit" for Bybit, which it read as "bite").
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
