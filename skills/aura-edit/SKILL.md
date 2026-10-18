---
name: aura-edit
description: Make a music-led "aura farming" hype edit (8–20 s, vertical by default) of footage or stills of a person, product, car or place, everything locked to one beat grid. It does velocity speed ramps (fast between hits, slow motion on them, frame-exact and blended between source frames), zoom punches, shake, flash and impact frames, zoom blur, RGB split, light sweeps, freeze stops, a stills strobe, type that slams on the beat or is masked with the footage, and a crushed, glowing grade with grain. The music is a synthesised bed with a real drop. HDR iPhone clips are tone-mapped at their own 60 fps, so slow motion keeps every frame. Use when the user says aura edit, aura farming, velocity edit, hype edit, phonk edit, "make this clip go hard", slow-mo on the beat, speed ramp or beat sync, or shares an aura or velocity reference.
---

# Aura edit: a clip + a beat grid → a hype edit

Every time in `aura.json` is in **beats**, so the shots, the slow-mo moments, the hits, the type and the sound sit on one grid and can't drift. `aura.py build` pulls each shot's source frames at the clip's own frame rate. `video.js` retimes them through each shot's speed curve and blends neighbouring frames. `render.mjs --subframes 4` adds motion blur. The same hit list drives the picture and sfx.py's cues.

## Setup
```bash
D=~/Movies/aura-edits/<slug>; mkdir -p "$D" && cp ~/.claude/skills/aura-edit/template/* "$D"/ \
  && cp ~/.claude/skills/ugc-edit/template/{ingest.py,matte.py} ~/.claude/skills/music-video/template/{lib.js,render.mjs} \
  ~/.claude/skills/promo-video/template/{promo.js,sfx.py} ~/.claude/skills/type-film/template/{type.js,look.js} "$D"/
```
- **ugc-edit's footage engine:** ffprobe and Apple's HDR tone mapping (`ingest.py`), and the person matte for type behind the subject (`matte.py`).
- **type.js:** `retime punch shake deck maskWord flash behind ecg cam`.
- **look.js:** `LOOK.aura` (crush plus a white glow, vignette, grain), the hit passes `impactFrame zoomBlur rgbSplit lightSweep blockSwap crush`, and `lensBand` for framing.
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

## Problems seen so far
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
