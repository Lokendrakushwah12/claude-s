---
name: aura-edit
description: Make a music-led "aura farming" hype edit (8–20 s, vertical by default) of footage or stills of a person, product, car or place, everything locked to one beat grid. It does velocity speed ramps (fast between hits, slow motion on them, frame-exact and blended between source frames), zoom punches, shake, flash and impact frames, zoom blur, RGB split, light sweeps, freeze stops, a stills strobe, type that slams on the beat or is masked with the footage, and a crushed, glowing grade with grain. The music is a synthesised bed with a real drop. HDR iPhone clips are tone-mapped at their own 60 fps, so slow motion keeps every frame. Use when the user says aura edit, aura farming, velocity edit, hype edit, phonk edit, "make this clip go hard", slow-mo on the beat, speed ramp or beat sync, or shares an aura or velocity reference.
---

# Aura edit: a clip + a beat grid → a hype edit

> Part of claude-s. When a job needs parts from other skills, read `../claude-s/SKILL.md`: which skill leads, and what the others lend.

Every time in `aura.json` is in **beats**, so the shots, the slow-mo moments, the hits, the type and the sound sit on one grid and can't drift. `aura.py build` pulls each shot's source frames at the clip's own frame rate. `video.js` retimes them through each shot's speed curve and blends neighbouring frames. `render.mjs --subframes 4` adds motion blur. The same hit list drives the picture and sfx.py's cues.

## Setup
```bash
D=~/Movies/aura-edits/<slug>; mkdir -p "$D" && cp ~/.claude/skills/aura-edit/template/* "$D"/ \
  && cp ~/.claude/skills/ugc-edit/template/{ingest.py,matte.py} ~/.claude/skills/music-video/template/{lib.js,render.mjs} \
  ~/.claude/skills/promo-video/template/{promo.js,sfx.py} ~/.claude/skills/type-film/template/{type.js,look.js} "$D"/
```
- **ugc-edit's footage engine:** ffprobe and Apple's HDR tone mapping (`ingest.py`), and the person matte for type behind the subject (`matte.py`).
- **type.js:** `retime punch shake deck maskWord flash behind ecg cam`.
- **look.js:** `LOOK.aura` (crush plus a white glow, vignette, grain), the hit passes `impactFrame zoomBlur rgbSplit lightSweep blockSwap crush`, and `lensBand` for framing. For a moodier, less punchy finish use a cinematic grade instead of crush: `LOOK.umber` (low-key amber) or `golden` (warm late sun), or `sh grade.sh` on the clips (type-film template).
- **Examples:** `examples/pulse.json` and `examples/pulse-layers.js` are the Pulse demo (its rendered page is kept local for now). They're there to show the API; don't re-skin them.

## 1. Concept before cuts
Run `~/.claude/skills/type-film/creative.md` on the subject: inventory its world, write 20 concepts, kill the first five, and find the one device that only this subject could carry. Hype edits are the genre where everything looks the same, so the invention is what the user will remember. Each borrowed technique must mean something in the subject's world. In the demo, the pre-drop silence is a flatline and the impact frame is an X-ray.

Ask for real copy only: a name, a handle, a number the user gives. Never write motivational quotes.

## Pick the sub-genre (the five references really differ)
| sub-genre | refs | picture | words | sound |
|---|---|---|---|---|
| mantra strobe | #24 | stills strobe of one word in many faces, 3 frames a card at 24 fps, B/W | the cards are the words | phonk drop; the picture ignores it |
| visible-process morph | #31 | one take; subjects swap by `blockSwap` on the bars; labelled overlays; colour | none | two drops, each after a sub-out |
| voice, then proof | #47 | talking head, then a cut on every 808 note, end stutter, B/W | one word per caption, behind the speaker | voice alone, drop 0.1 s after the last word |
| discipline / lock-in | #48 | dark motion-blurred night footage (lights, moon, trees from a car), a 3-frame cadence with every 7th card held 6 (`hold: [3,3,3,3,3,3,6]`), crushed B/W | one tiny line, static, the whole film | quiet drone, a 0.5 s sub-out, a drop with full stops; −18.6 LUFS, LRA 11 |
| athlete interview + evidence | #49 | 30 s in colour (teal and red), a bowed letterbox band (`frame`), cut between the speaker and action b-roll on her phrases | one serif word at a time, mid-band | voice throughout over a steady bed, which lifts at the emotional peak |

## 2. Write `aura.json`, then `uv run aura.py build`
The template shows every field once.
- **`bpm`:** pick it from the mood. 140–160 is the usual hype tempo. For a licensed track, read its tempo and first downbeat with `uv run ~/.claude/skills/x-video-frames/deconstruct.py track.mp3` (trust it when pulse ≥ 0.2) and shift beat 0 to the downbeat.
- **`clips`:** footage, or still images (a still becomes an 8 s clip: the camera, hits and type still move). HDR is conformed once into `src/<clip>.sdr60.mov` (see Problems).
- **`shots`:** `{at, beats, clip, src | hit, ramp, zoom, focus, strobe, behind}`.
  - `hit: [b, s]` puts source second `s` on beat `b` of the shot.
  - `zoom` is a number or `[from, to]`.
  - `strobe: {hold, fps, zooms}` holds a still per card for `hold` frames at `fps` (or a cadence such as `[3,3,3,3,3,3,6]`), stepping the crop.
  - Top-level `frame: {y, h, bow}` shows everything through look.js `lensBand` (#49's bowed letterbox).
  - `{insert: kind}` is a drawn shot (`INSERTS` in video.js).
- **`hits`:** `[beat | [b0, b1, step], kind, {opts}]`.
- **`type`:** `{at, beats, text, kind: slam | mask, y, fonts, hold, from, track}`. `from: 1` cuts the word on with no scale-in.
- **`sound`:** see section 5.

build prints each shot's source span. "runs off" means the ramp needs more source than the clip has, and the edge frame holds: move `src` or `hit`.

## 3. Speed ramps (the velocity edit)
- **Values:** `ramp` is a speed (1 = real time, 0 = freeze), a preset, or `[[beat, speed], ...]` in the shot's own beats, cosine-eased between keys.
- **Presets** (aura.py `RAMPS`):
  - `hit`: 2.2× in, 0.2× from a quarter beat before the hit to half a beat after, then 2.2× out;
  - `float`: 0.35×;
  - `rush`: 1 → 3×, into the cut;
  - `brake`: 3× → 0.25×;
  - `freeze`.
- **How it's frame-exact:** type.js `retime(u, keys)` returns the exact integral of the speed curve. Any frame or subframe maps to a source time with no history. The engine draws the two source frames around that time, blended by the fraction. Nothing steps, so nothing jitters.
- **Slow motion needs source frames.** At 30 fps output, 0.25× of a 60 fps clip shows a new frame every second output frame. 0.25× of a 30 fps clip is mostly blends. Shoot or keep 60 fps; for slower than 0.25×, pre-interpolate with `ffmpeg -vf minterpolate=fps=240:mi_mode=mci` (artefacts on fast limbs; check the strips).

## 4. Hits
| kind | picture | sound (auto) |
|---|---|---|
| `drop` | impact frame (2 frames), then exposure flash, punch 1.16, shake, zoom blur, RGB split | impact + sub_boom |
| `punch` | zoom punch, 1 + 0.07 (`{punch: k}`), 0.03 s rise, 0.12 s decay | none (sits on the kick) |
| `shake` | ±26 px, ±0.7°, 0.16 s decay, on two incommensurate sines | none |
| `flash` | the exposure table (1, .75, .5, .3, .15, .05) | flash_hit |
| `impact` | stark black and white, inverted (`{tint}`) for 2 frames | impact |
| `blur` / `split` | radial zoom blur / chroma split, decaying | whoosh / none |
| `sweep` | a light band crossing the frame over `dur` beats (`{angle, width}`) | none |
| `stop` | the picture freezes for `dur` beats | `gap`: the music stops dead |

- **Overrides:** any hit takes `{sfx: [[dt, name, gain]]}` to replace its sound.
- **Where they go:** put punches on the kicks, shakes on the claps, a stop at the end of every second bar, and keep impact frames for the drop plus at most two more.
- **Overscan:** the frame is overscanned 1.07×, so a shake never shows an edge.

## 5. Sound: the drop (`node render.mjs --cues && uv run aura_sfx.py`)
`aura_sfx.py` is sfx.py plus `bass808`, `drop_kit` and `tone`. The structure, as measured on the aura references:
- **Build:** the melody (or the voice) carries on while the sub band leaves 0.35–0.5 s before the drop. Use `mutes` for a sub-out, or a `gap` cue on the drop for full silence.
- **Drop:** it lands 16–27 dB louder below 90 Hz. An 808 slides about 2.5 semitones down into its note (`bass808: [[beat, midi, beats, glide]]`, midi 23–28 sits at 31–41 Hz) under `drop_kit`.
- **Stops:** inside the drop, the whole mix stops dead for 0.15–0.25 s at a time (`stop` hits).
- **End:** hard, with no tail.
- **Level:** master at −12 LUFS (the references measured −9.8 to −18.6; the quiet one had the widest range).
- **A licensed track:** `sound.music: "track.wav"` plays on the music bus with the bed (or `bed: null`). Set `bpm` and beat 0 from it.

## Voice-led variant (#47): a line, then the proof
- **The line:** a spoken line carries the build, alone. `sound.vo: "line.wav"`, with the bed starting at the drop (or a quiet `arp`); the reference ducked its music about 20 dB under the voice.
- **Captions:** one word per caption, cut on at the word's onset (`slam` with `from: 1`, wide `track`). Get the onsets from `deconstruct.py line.wav` (transcript.json). Put the words behind the speaker (`behind: true`) so a hand passes in front of them.
- **The drop:** it lands about 0.1 s after the last word, and the edit turns into the proof. Cut a shot on every 808 note, about 0.6 s each, every shot drifting 10–13 % of the frame per second.
- **The finish:** a stutter on the last shot, 1–3 frames each (a `strobe` with `hold: 1–3, fps: 30` and `ramp: 2.5`), then a hard end.

## 6. Render and review
```bash
node render.mjs --size 1080x1920 --still <one t per shot, every drop and stop frame, each mask/slam>   # stills gate
node render.mjs --size 1080x1920 --out <slug>.mp4 --subframes 4
ffmpeg -i <slug>.mp4 -vf "fps=3,scale=180:-1,tile=13x3" -frames:v 1 contact.jpg
for s in <drop, stops, ramps>; do ffmpeg -ss $s -t 0.6 -i <slug>.mp4 -vf "fps=15,scale=200:-1,tile=9x1" -frames:v 1 strip_$s.jpg; done
uv run aura_sfx.py --plot      # spectrogram with the cues: the gap really silent, the drop's sub jump, stops dead
```
Check the following:
- the strips run smoothly through every ramp, and the stops really hold;
- the first 2 s hook;
- masked words read at phone size;
- nothing sits in the bottom 15 % or the top 10 %;
- the drop frame is the impact frame, not a blank.

Put your contact sheet beside each reference's sheet for the originality check (type-film step 5).

## Grammar from the references (`type-film/references.md`, 2026-10-11)
Measured on #24, #31, #47, #48 and #49: the sub-genre table, the drop structure in section 5, and the stills strobe, one-take morph, end stutter and lens band above. Velocity ramps, shake, flash frames, glow, RGB split, zoom punches and freeze frames are genre knowledge that wasn't measured here: tune them by eye on the strips.

**Beat-locked montage (vlog/travel, measured 2026-10-18 on a 136 BPM reel):** 139 cuts/min, 1.29 cuts per beat, hard shots 0.29 s median (0.67 s mean), cuts on the eighth-note grid (median −3 ms, 43 % within ±60 ms). Shape it as bursts and holds: 3–6 cuts of 1–3 frames (0.04–0.12 s, often flashing back to shots already seen) then a 1–2 s hold. Open on a 1-frame tinted flash with a sub_boom on the first cut. Transitions every 2–4 s rather than every cut: `windowCut` hops 0.4 s apart with a falling whoosh each, `panes` one pane per beat (0.45 s), `letterbox` closing a shot to black, `rollCut` into an upside-down shot, `zoomThrough` on a drop. Run the last 4–5 shots as zoom-settles (−11 to −15 %, at −19 to −31 %/s). In the second half, a high blip about every beat with an air swish on most cuts.

**Phone UI intro + travel montage (measured 2026-11-13 on a 16.4 s 16:9 reel; built as `~/Movies/aura-edits/kashmir-dnd/`):** a 5.9 s drive shot with a glassy phone Control Center over it (tiles pop in, Focus to Do Not Disturb, an album card pops out, play), then the song's montage cut every 2 beats at 136 BPM (0.87 s median, the same in the rebuild). About half the shots push or slide 6–12 %. Lyric captions are small and centred, building a word at a time. Clicks only on the UI taps. The intro plays the music at full level (−14.6 against −14.0 LUFS).
- **Start from the example:** `examples/control-center.json` (as aura.json), `examples/control-center.js` (append to video.js) and `examples/control-center-icons.js` (copy in as icons.js and load it before video.js). It's the iOS 18 layout the reference used, with milky bright glass (blur 30, saturate 1.7, a white tint and a diagonal highlight), round buttons (white with a coloured icon when on), a big media module, tall pill sliders, and a Focus menu that takes over the panel as large pill rows. The font is the system SF and the icons are Lucide (ISC). The first version, with dark square tiles, a small media tile, Inter and hand-drawn icons, was judged "so bad" by the user. White text on bright glass needs a soft shadow to read.
- **The same song:** match the original's cut times exactly (`bpm: 60` makes beats into seconds; copy the cuts from deconstruct's cuts.json) and its length. The user then picks "Use audio" on the original reel in Instagram, gets the same song segment and turns on Instagram's lyrics display for the captions. Never type a song's lyrics into captions. Render with only the UI clicks (`bed: {}`, `lufs: -36`, so they peak around −10 dBFS) and no captions of our own. **Then also bake the song in by default, without being asked:** the reference reel's own audio (`ffmpeg -i <ref>/video.mp4 -vn song.wav`) is the same segment, synced by construction, because the cuts match its timeline. Mix the clicks under it (`amix=normalize=0`, then `loudnorm=I=-14:TP=-1.5`) and mux it with `-c:v copy`. The user asked "why you skipped it" when only the clicks version was delivered. Hand over both files: one with the song, and the clicks-only one for "Use audio" if Instagram mutes the baked-in track.
- **Lyric captions burned in:** never write, transcribe or copy a song's lyrics into captions yourself. The user pastes the text into `lyrics.txt` (one line per caption, plain lines are fine) and the tooling does the rest without printing it: `examples/control-center-lyrics-align.py` (as lyrics_align.py, `uv run`) runs faster-whisper medium.en with word timestamps on the song's vocal stem (deconstruct `--stems` gives `stems/vocals.wav`), matches the user's words to what it heard with difflib and interpolates the misses, then writes `lyrics_times.json`, numbers only. `examples/control-center-lyrics.py` (as lyrics.py) prefers those sung times over hand times (`<start s> | text`, `@<s>`, `-`) or an even spread, and writes `lyrics.js`. The `kLyrics` layer in control-center.js draws them, and `examples/control-center-finish.sh` reruns the align step whenever lyrics.txt changes. **The reference's caption style, measured on its frames:** the system font (SF) at weight 400, all lowercase with curly apostrophes, x-height 2.4 % of H (font 0.0475 H), baseline at 0.511 H, centred, plain white with no visible shadow, and nothing over the phone UI intro: captions start at the first montage cut. The user rejected the first version ("lyrics dont match with song", "text style is not same"): its lines were spread evenly instead of following the singing, and it used capitalised Helvetica Neue with a shadow.
  - **Don't give whisper the lyrics as `initial_prompt`:** it matched 14 of 36 words that way (it echoes the prompt), and 30 of 36 without it. **faster-whisper's own decoder breaks on new PyAV** (`open() got an unexpected keyword argument 'metadata_errors'`): decode with ffmpeg to 16 kHz float32 and pass the array.
  - **Check the sync from pixels:** measure when the caption band's white text grows or resets, frame by frame, in the reference and in ours. The reference's line changes landed within 0.3 s of the sung onsets.
- **No web fonts when the user renders:** with `fonts: [...]` set, render.mjs refuses to start if Google Fonts can't be reached ("fonts failed to load: Inter"), which happened on the user's own run of finish.sh. When the drawing only uses system fonts (SF, Helvetica Neue), set `"fonts": []` and `brand.font` to a system font.
- **Our own drawing only:** the cover is the user's own still, not album artwork, and no trademark glyphs (the reference's Shazam button became a flashlight). The song's title and artist as text are fine.
- **UI and captions draw after the look:** wrap `VIDEO.overlay` (as the example does). `LAYERS` draw before the grade and would get its grain and crush.
- **Intro loudness:** the `intro` bed section measured −30 LUFS under a −14 montage. Use `[0, "arp", 5]` for a music-led intro (−14.9).

**Travel montage from a big folder of the user's own clips (v2 of kashmir-dnd, 2026-11-14).** The first cut was rejected: "why is the UI not polished" (the glass modules overlapped each other), "you added weird zoom in/out which is bad" (an animated `zoom: [a, b]` on almost every shot), "choose better suited clips, check where they end and how the next clip starts", "add nice color correction" (with a grade reference), "intro doesn't need to be the same as the ref, be creative". What fixed each (the user on the result: "rest is soo much good"; this is the travel default now, `examples/travel-montage.json` is its aura.json):
- **No digital zoom on real footage.** Leave `zoom` out (1 = cover). The camera's own motion is the move; a push on top of a handheld pan reads as wobble.
- **Watch every clip before picking.** A 12-frame filmstrip for every clip (keyframes only: `-skip_frame nokey`, `fps=12/dur`, tiled; 101 clips in about a minute), then 16-frame strips of each candidate window, then the exact moment at 1-4 fps. About half of a phone dump is pocket footage, selfie cam or sideways; the strips show it at a glance. Live Photo clips and `IMG_E*` copies are skipped, `story/` and `posts/` folders hold duplicates.
- **Measure the camera before ordering.** Phase-correlate frames 1/15 s apart at 320 px over each window: the mean shift is the pan (px/s), its spread the shake. Drop windows over ~15 px/step jitter, and keep consecutive shots panning the same way (here three lake shots all panned right). A locked-off phone (0.0 jitter) makes the best title shot.
- **Centre an off-centre subject with a held reframe, never a move.** The user asked to centre the meadow shot (the pair walked at 0.37-0.39 of the width). `zoom` scales about `focus`, which stays put on screen, so pick the focus that lands the subject mid-screen: with z' = zoom x 1.07 overscan, focus = (0.5 - u z') / (1 - z'), and z' >= 1 / (2u) keeps the frame covering the screen (here zoom 1.31, focus [0.045, 0.45]). Give the shot `scale` 1.8 so a 4K source is pulled at 3456 px and the crop stays sharp.
- **Check every cut as a pair.** A sheet of (last frame of shot i | first frame of shot i+1). Good pairs share something: a horizon height, water, forward walking, people to people.
- **The grade is a LUT baked into the frames:** `template/grade.py` writes `grade.cube`, `"grade": "grade.cube"` in aura.json makes aura.py pull every frame through it (the cache key includes the cube's mtime, so a re-run re-pulls). Tune it by numbers, not by eye alone: the 1/5/25/50/75/95/99 % luma percentiles, the darkest-20 % mean RGB, and the median hue and saturation of greens and of sky, on 14 of our frames against the reference's. iPhone SDR sits on a ~34/255 black floor with yellow-green grass (hue ~74); the teal-and-emerald reference had blacks at ~10, teal-green shadows (15,37,30), greens at hue ~102 and a cyan sky (~200). Input levels, a logistic S-curve, a green pull toward 120 with saturation tapered in highlights (or sunlit grass goes neon lime), a cool white balance and a shadow tint got within a few units of every number.
- **An intro of our own: the title behind the mountains (the user: "rest is soo much good").** Approved recipe, in `examples/travel-title.js`: a locked-off wide (0.0 jitter) with a clear ridge, `behind: "sky"` on the shot, the word lowercase in the system font at weight 600, 0.24 H tall, -0.02 em; each letter rises from 12 % below (out from behind the ridge) and from a 0.02 H blur to sharp, 0.9 s ease-out, 50 ms apart (the user asked for "bottom to top with blur fade"; draw letters at their kerned advances, `measureText(word.slice(0, i))`, and blur with `ctx.filter`); small tracked dates (0.019 H, 0.32 em) above it; on the next shot the four places from the clips' GPS land one per beat, low (0.9 H) and small; lyrics only from the montage on.
  - **The matte is a skyline walk, not a colour key** (`template/skymatte.py`): each column walked down from the top at 480 px, following the sky's drifting colour, stopping at 3 pixels that differ by > 0.12; a stop is a cloud when sky returns within 15 % of the height below it (then carry on from the sky under it), a snow cap isn't because rock follows; median over 7 columns, 2 px feather. The first version keyed "blue, connected to the top": after the cool grade the upper rock faces and hazy far ridges were blue-grey too, so the title drew over the mountains and the user sent a screenshot of it. Check a matte by darkening the sky through it on one frame before rendering.
  - **Place it from the measured skyline**, in screen space (frame y mapped through the 1.07 overscan): here the ridge ran 0.35 H on the left to 0.27 H at the peak on the right. A 0.36 baseline puts it through the lower half of the x-height mid-word, leaves the left letters almost whole and lets the peak swallow most of "ir" (the i's dot and the r's arm keep it readable). At 0.44 the word read "kashr"; at 0.36 with 0.2 H type it sat entirely in the sky and didn't read as behind anything.
- **`letterSpacing` adds space after the last glyph too:** subtract one track from `measureText` widths and draw left-aligned, or separators sit off-centre.
- **avconvert trims can conform short:** a 4.93 s HEVC trim conformed to 2.51 s (avconvert's H.264 preset dropped half the frames). aura.py warns "runs off"; re-trim with a different start and a longer duration, delete `src/<name>.*`, rebuild.

## Problems seen so far
- **Long 4K HDR clips:** `conform60` converts the whole file through a ProRes intermediate (about 140 MB/s, so 35 GB for a 4 min clip). Trim first with HDR intact: `avconvert --source X.MOV --preset PresetHEVCHighestQuality --start <s> --duration <s> --output src-trim/x.mov --disableMetadataFilter` stays HLG, 10-bit, 4K, in about 2 s. Then point `clips` at the trims with `src` relative to the trim.
- **A double image on a whip pan:** `--subframes 4` over a phone whip stacks 4 sharp copies instead of a smear. Look at a strip of every shot; move `src` off the whip, or slow the shot onto its steady part (`ramp` 0.4 on a calm lake read clean).
- **Live Photo clutter:** an iPhone folder can hold more Live Photo `.MOV` companions than real videos (1,367 of 1,470 here). Keep clips ≥ 3.5 s with no same-named `.HEIC`/`.JPG`, and skip `IMG_E*` (the edited copy of `IMG_*`). Clips filmed sideways in portrait show up turned 90° on a contact sheet: leave them out.
- **Slow motion at 30 fps:** avconvert's H.264 presets tone-map HDR but drop 60 fps to 30. `conform60` makes the 30 fps tone map and a 60 fps ProRes, fits a 33³ LUT from one to the other, and runs the ProRes through it. That measured 1.6/255 from Apple's own look, with every frame kept.
- **A ramp that started before its shot:** a `hit` ramp's keys begin a beat before u = 0. The first integral counted that beat and put the slow moment 0.5 s late. `retime` now subtracts its own value at 0, and `aura.py selftest` checks it.
- **The drop frame came out white:** `12 * spb` in JS was 4.800000000000001, so "before the drop" was still true on the drop frame and darkened it. The impact frame's contrast 9 then made it pure white. Use `beatT()` (rounded the way aura.py rounds) for any time test in project layers.
- **The flash hid the impact frame:** both landed on frame 0. The flash now starts after the hit's impact frames.
- **White trace on a white coat, then across her eyes:** the ECG vanished over the coat at 0.8 H, then crossed her glasses at 0.3 H in the close-ups. It now sits in one row beside the number in the top band, over a scrim, 6 px with a dark shadow.
- **A dead opening:** the first cut spent 3.2 s at rest and the fresh critic scored the hook 3/10. Now a 3-frame flash-forward of the drop's impact frame opens it, the rest lasts 1.5 s, and the first heartbeat punches 1.15.
- **A flatline that wasn't flat:** the trace kept drawing its old beats through the gap. It now gets no beats at all during the flatline, so the whole trace goes flat, and the gap lasts 0.6 s.
- **A masked number that read as a dark hole:** footage dimmed under its own window showed beige wall in the glyphs. Zoom the shot so the subject fills the glyphs, brighten the fill, and add a 2.5 px hairline.
- **A name clash:** a helper called `card` collided with promo.js's `card()` and the page didn't boot. Prefix project helpers.

## Limits
- One clip or several; no multicam sync (that's ugc-edit's job).
- The person matte (`behind: true`) needs MediaPipe (matte.py) and only finds people.
- Canvas 2D: no optical flow inside the page. Blending plus subframes is the smooth path; minterpolate is the fallback for extreme slow motion.
- The beat grid is one fixed tempo. A track that drifts or changes tempo needs its sections cut to their own grids.
