---
name: type-film
description: Make an ORIGINAL brand motion film (10–30 s) from one or more reference videos plus the brand's own site. It takes each reference's techniques (pacing, type behaviour, camera, texture, sound), never its shots, and invents a new concept and shot list native to the brand's world. The brand's real logo, colours, fonts and copy are drawn as JS canvas animation with seek(t), scored with synthesised music or sonified UI, and rendered frame-exact to MP4. Styles: Swiss kinetic type, beat words, words as structure, cinematic narration with glass UI, screen HUD, 80s vector CRT, monochrome single-take morph, line catalogue and isometric product, with designed particles and shape morphs. Use when the user shares motion references (x.com links, MP4s) and wants "one like this for <brand>", a brand film, launch video, motion-design reel, kinetic type piece or a new variant of an earlier one.
---

# Type film: references + brand → an original motion film

> Part of claude-s. When a job needs parts from other skills, read `../claude-s/SKILL.md`: which skill leads, and what the others lend.

**References are ingredients, not scripts.** The first Keychain film reproduced its Whop reference shot for shot: the same 13 shots, in the same order, with the same compositions. The user rejected it for that. Every film must be a new idea, built from the brand's own world. The references only lend techniques.

## Setup
```bash
D=~/Movies/type-films/<slug>; mkdir -p "$D"/{assets,docs} && cp ~/.claude/skills/type-film/template/* "$D"/ \
  && cp ~/.claude/skills/music-video/template/{lib.js,render.mjs} ~/.claude/skills/promo-video/template/{promo.js,sfx.py} "$D"/
```
`index.html` loads lib → promo → type → look → iso → video. Put data files (e.g. a `data.js` of real numbers) before video.js.
- **`type.js`:** the helper vocabulary, in sections (type, captions, HUD, fields, line/paper, containers, timing). Read the section comments once.
- **`look.js`:** film and screen finishes, off unless the style asks: `overlay(c, t) { applyLook(c, t, null, LOOK.crt); }`, presets `film16 archival crt lcd vhs` and the cinematic grades `umber alpine cream golden`, event passes such as `lutStab crtCollapse filmBurn`. `sh filmlook.sh in.mp4 out.mp4 0.4` does the film look as an ffmpeg pass instead.
- **`iso.js`:** an isometric camera for canvas: `ISO.cam slab face extrude lift order shadow tilt`, the `ISO.LINE` tokens, its own `spring` and `tween`. `node -e "require('./iso.js').selftest()"` checks its maths.
- **`examples/*.js`:** finished films, there to show how the API is used. **Never copy a scene from an example or a reference.**
- **`references.md`:** references that have already been deconstructed, with credits. Check it first and add to it.

## 1. Deconstruct each reference → `docs/grammar.md`
`uv run ~/.claude/skills/x-video-frames/deconstruct.py <x.com url | file> [--stems] [--drift]` writes frames, 8 fps sheets, the cuts, a spectrogram with cuts, beats and SFX marked, the tempo and a report.md with empty TAKE/LEAVE sections. Use `--stems` for any reference with a voice, or its SFX are lost under the speech. Its sound classes are guesses: look at the sheets and the spectrogram yourself.

Fill in a TAKE / LEAVE table per reference:
- **TAKE (transferable):** shot length and cuts per beat; how type enters and leaves; camera and transition logic; palette *roles*; texture and lighting; sound feel; 1–2 signature techniques described abstractly ("a concave wall that wraps the viewer").
- **LEAVE (recognisably theirs):** the shot order, compositions, set pieces, script and copy, metaphors, logo moments, and their colourway as a whole.

## 2. Find the brand's world → `docs/concept.md`
Run **[`creative.md`](creative.md)** first, into `docs/concepts.md`: inventory 25+ things from the brand's world, write 20 concepts, kill the first five, set two constraints, and find one "only this could exist here" invention. References give techniques; the idea has to come from the subject.
- **Objects:** list 10+ objects, rituals and artefacts native to the brand's domain (Keychain: barcodes, lot codes, spec sheets, pouches, a chain of links).
- **Metaphor, logline** in the brand's voice, and a **story arc** (hook → tension → product → proof → logo), not a tour of techniques.
- **Copy:** real copy and real numbers only; read numbers from the source at render time where you can. Never invent stats or customers.
- **Banned list:** what this film won't do. Name each reference's signature look one by one, then the house bans: glass cards, decorative gradients, stage beams, bouncy type, blanket fades, dead holds, invented numbers, and the AI-showreel defaults (creative.md step 3: corner brackets and timecodes, a curve editor, a rippling dot grid, a particle sphere with orbit rings, a metaball, an orange full-stop dot). The critic checks against it.

## 3. Invent the shot list → `docs/shotlist.md`
- Write every shot as `technique (from TAKE) × brand object × real copy`, and add at least 3 devices that appear in **no** reference and no earlier film here, marked "new".
- **The same-sentence test:** if one sentence describes both your shot and a reference shot (composition *and* motion), redesign it. Re-skinning the colours isn't enough.
- Build transitions from the story's objects (barcode bars fattening into the cut; a cell growing into the next shot).
- Pick a beat grid from the mood (brisk Swiss ≈150 BPM, narration ≈100, HUD and beat words 120: all four measured kinetic-type references sat at 120, a word per beat) and start every scene on it. A story with its own clock (a count, a heartbeat, the speed of sound) uses that clock instead.
- A variant of an earlier film: list that film's concept and devices first, then change the concept, ground, pacing and at least 70% of the devices.
- If the user is interactive, show the concept and shot list before building.

## Styles
Mix freely. Details and credits are in `references.md`.

**"In the style of <a painter or art movement>":** none of the styles below is painterly. Read that style's card in [huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion) (MIT; `references/风格配方/INDEX.md` lists 36 with star ratings, ★★★ first; cards are in Chinese, so translate as you read) for its stroke passes, palettes and what moves (Van Gogh: three flow-field stroke passes over regional palettes, the sky curling into swirls). Rebuild it in our toolkit on the user's subject; never reuse its room-with-a-cat composition. Fetch the repo only when a film needs it.

| Style | Picture | Sound | From |
|---|---|---|---|
| Swiss kinetic type | huge grotesk on grid paper, masked rises, scrambled meta labels | bright bed ≈150 BPM | Whop |
| Cinematic narration | small words out of a blur, glass UI, `keylight dust`, a curved wall | slow bed ≈100 BPM | Nexus, portfolio reel |
| Screen HUD | `glyphHud` scramble → resolve with **re-skinned** `cell`/`label`, `trackers cornerTicks`, live counters; look `lcd` or `crt`, light | no music: `drone` room tone, `typeCues` and `scrambleCues`, pentatonic blips, true silence | 19, 09, 17 |
| 80s vector CRT | `drawOn` phosphor strokes, `inlineWord`, `rainbowBars starburst`, `crtCollapse`, `vhsTear`; look `crt` | synth bed, `bed.mutes`, `crt_off` then silence | 08 |
| Monochrome single-take morph | one shape becomes the next (`morphMatch smear`), lowercase full-stop headlines, construction lines | a chord change per visual beat, whoosh-then-impact per morph | 12 |
| Line catalogue | `ISO.LINE` tiers, one `pen` threading every figure, mono state labels, an index ruler, echo-smear swaps | sparse foley or none | 20 |
| Isometric product | `ISO.slab` hull solids, one highlight, `ISO.lift` from the flat plan, springs for *where*, tweens for *which* | foley for objects, `swell` under the lift, silence before the payoff | 01, 13 |
| Beat words | one giant word per beat (cap height 25–40 % of H) that lands oversized and dims as the next arrives (`hitWord`); the story's own numbers counting live; grounds that change with the section | 120 BPM, a word per beat, a true silence before the payoff | prompt-motion: the photon film, zheke |
| Words as structure | each key word takes a physical job in the frame (a beam, a load on cables, a support, a floor) and the last line stands on what the earlier words built; heavy grotesk for the load-bearing words, serif for the speech | phrase cues instead of a beat grid; one stillness of 0.4 s or more | prompt-motion: gdgtify |
| Maker's-tool collision | the tool's own furniture (a selection box with handles, a cursor with a halftone trail, a pen) acting on an organic world; a push *through* the type into the next world; texture from a visible process (slices, budding, `blockSwap` refresh) | soft pad, a sub on the push-through, a whoosh on the burst, ticks only on the tool's clicks | 35, 31 |

## Type craft (measured on 41 prompt-motion type, shape and particle films)
- **Size by cap height, as a fraction of H.** A one-word frame: 30–40 %. A hero line: 18–30 %, spanning 60–80 % of W. A frame-filling stack: each line justified to the measure (`fitStack`), up to 60 % of H per line in 1:1. The lead or support line: 6–9 % in a second voice (an italic serif at 11–14 % font size). Labels: at least 2.2 % (24 px at 1080), caps tracked +0.12 em. A 7 % hero (the earlier claude-s demo) reads as a caption, not a film.
- **Weight and width:** display at 800–900, condensed or expanded. With a variable font loaded with its axes (`'Archivo:wdth,wght@62..125,100..900'`), pass `weight: '900 condensed'` and word() sets the width too. Track heavy display −0.01 to −0.03 em; never open up lowercase. `weightWave` moves weight through a word.
- **Pairing:** one heavy grotesk for what's shouted, one italic serif for what's said around it ("three seconds of quiet" over a giant "1 KM"), mono only for live data. That pairing carried the best 6 of the 41.
- **Lines:** one idea per frame; break by meaning, not width. Stacked lines sit 0.12 × cap height apart. Place big type by its ink, not its advance box (`inkBox`, `fitStack`): at 400 px an O overhangs and an I sits inside.
- **Entering and settling:** land at 1.15–1.35× and settle in 3–5 frames (`hitWord`, tau 0.07), or rise from behind a baseline for calm lines (`rise`, letters 30 ms apart with `riseChars`). A word that travels more than ~10 % of W in a frame carries motion blur along its path (`smear` with even: true). Leaving: dim to 40 % while the next word lands, or cut on the beat. Nothing fades out on its own.
- **Grounds:** full-bleed colour that changes with the section (2–4 colours with roles), lit from the centre (`litGround`), not one dark grey.
- **The corner test:** delete every corner label, bracket and timecode. If the frame loses no information, they stay deleted. One creator banned them by name as "AI giveaways", and the ~20 of 41 entries that kept them look alike. Live numbers that ARE the story (a photon's depth and temperature, the time since it left) are the exception.

## Particles and shapes
- Particles look designed when **one depth drives size, brightness, blur and speed** (`drawCloud`), sizes follow a power law (most small, a few large), and the set holds a form: a sphere, a word (`textPts`), rain at one wind angle, a flock. Uniform scatter at one size looks like a default. Measured: point clouds of 1,000–2,000 dots at 1.5–3 px; bokeh fields of 30–60 discs at 20–110 px; streak fields of 300–600.
- A swap between forms staggers each point's departure (`mixPts` spread 0.35, burst 0.3–0.5), so it reads as a flock, not a crossfade.
- **Shape morphs:** resample both outlines to 200 points (`shapePts`, `morphPts`), run them on a spring, and trail 3–4 echo outlines (`onion`) or concentric contours.

## 4. Build
- **Gallery picks:** users may paste picks from the repo's `gallery/` as `#Txxx helper (file) — ask`; each maps to the named helper, so use that helper for the device they picked.
- **Motion:** `spr track cam shotCam`, a pinhole 3D camera `cam3d proj MM` and its moves `dollyZoom orbitCam crane dutch`, `ISO.spring`/`ISO.tween`. lib.js's `spring` takes both forms (`spring(p)` and `spring(p, 8)`); use `track()` for summed closed-form springs. Stop-motion: `boil(t, 12, 3)` gives 3 drawings looping 4 times a second; lib.js also has `stepT jitter flickerGain sketch`.
- **Type:** `word ui rise riseChars scramble typed words hotWord glowIn inlineWord shimmer selectHL textOnPath`, `hitWord chromaWord fitStack inkBox weightWave`; captions `leadIn karaoke`.
- **Particles and shapes:** `pointCloud textPts mixPts drawCloud` (trail for streaks, focus for bokeh), `shapePts morphPts drawPts`, `squashDot` for a fast prop.
- **HUD and fields:** `glyphHud trackers cornerTicks pixelField slotList counterRoll tumbleTiles asciiImage ecg waveBars expCount`.
- **Line, paper, containers:** `drawOn pen smear onion slip tape callout pins player slitReveal morphMatch shutterButton sparkHop skeletonFlash screenInsert`.
- **Aesthetic reel kit (covers, creator captions):** `clipSheet` (grid/ruled sheet with a binder clip, paper clip or tape), `serifStack` (giant condensed serif headline) + `scriptLine` (handwritten accent written on), `loopArrow scribble` (drawn arrows, underlines, circles, sparks), `cutout propArt` (die-cut prop stickers that pop in), `handleChip` (ranked creator chip with a script numeral), `mixWords` (mixed-voice caption words), `serifSub` (elegant serif subtitles, staggered titles), `tornLabel starConfetti stripeMat`. Fonts: `TYPE.serif` Gloock, `TYPE.script` Caveat, `TYPE.hand` Reenie Beanie, plus Instrument Serif (italic too); add them to `VIDEO.fonts`.
- **Surfaces and objects:** `grid hl glass keylight dust marks grain arrow check marquee ring3d orbit tunnel guides barcode flap chain bend pointer`, flat layers and a grid floor through the 3D camera `cards floor3d`, look.js photo passes `lensFlare doubleExposure tealOrange fisheye`; from promo.js `pill counter rrect glow`.
- **Timing:** `flash softcut whip dof focusPull glitchBox cutIndex flipFrames pasted rewind drawAt bpmPulse`, fast-cut transitions with softcut's signature `(c, t, tCut, drawA, drawB, o)`: `matteCut` (a white silhouette bridges the cut; swoosh + flash_hit), `windowCut` (frame-in-frame hops on black, then fills; click per hop), `rollCut` (180° spin; whoosh), `zoomThrough` (punch in, land zoomed, settle out; passby + sub_boom), plus `panes` (split screen, one pane per beat; pop) and look.js `letterbox` and `lutStab(c, 'xray')` (1–2 frame negative; flash_hit), `iris` (the next shot opens from a point, so a prop becomes the cut), `litGround`. `drawAt(c, t, self)` draws the film at another time, inside a cell or a rewind.
- **Hits (beat-led edits, shared with aura-edit):** `retime` (a speed curve's exact integral), `punch shake deck maskWord`, `ecg(..., {beats})`; look.js `impactFrame zoomBlur lightSweep blockSwap crush` and the `aura` preset.
- **Cinematic grades (measured on four reels, references.md 2026-10-18):** `LOOK.umber` (moody low-key amber: interiors, night, food), `alpine` (cool, desaturated highs: landscape, travel), `cream` (faded, lifted warm blacks: interviews, lifestyle), `golden` (warm late sun: outdoor portraits) via `applyLook(c, t, null, 'cream')` (`{ ...LOOK.umber, bars: 2.39 }` adds scope bars; the `cine` pass takes any `curves`/`sat`). For real footage `sh grade.sh in.mp4 out.mp4 cream [K] [2.39]` applies the same numbers in ffmpeg. Gallery T147–T150.
- **Sound from the picture:** build cues from the constants the scenes read: `typeCues(t0, str, gap, f0, df)`, `scrambleCues(t0, str, g, {per, settle})`, one array of times shared by a scene and its cues. `VIDEO.drone`, `lufs`, `lp`, `bed.mutes` pass through `render.mjs --cues` to sfx.py (its docstring lists every sound and its params).

When you invent a reusable device, add it to `type.js` with a one-line comment and record it in `references.md`.

**Narrated films (a voice-over is the clock).** The template's `lines.py`, `narrate.py` and `assemble.py` turn a script into `voice.wav` and `timeline.js`: each line's start and end, and each caption word's onset. Add `<script src="timeline.js"></script>` before video.js, set `VIDEO.vo = 'voice.wav'` (sfx.py ducks the bed under it) and `VIDEO.duration = TL.duration`, and time every scene and cue from `TL` (cut 50 ms before a line's first word), never from constants, so a re-voiced take re-times the whole film. The MBBS Hinglish reel (`~/Movies/type-films/mbbs-hinglish`, 2026-10-17) is the worked example: caption pills from `TL` words, `say()` for words out of a blur on their spoken onsets, and a 0.45 s `gap` before the end card.
- **Engine:** Kokoro (82M, Apache-2.0) by default: 17 Hindi lines in 43 s, every take right first time. Chatterbox when the read must act: ~2 min a line in Hindi, and 5 of 17 Hindi takes went wrong (4 babbled on past the sentence, one dropped its last word). Same `narrate.py`, `ENGINE=kokoro|chatterbox`.
- **Hindi and Hinglish:** two texts per line in `lines.py`. The caption is Roman Hinglish (what Instagram readers type); the spoken text is the whole line in Devanagari, English words transliterated (एग्ज़ामिनर, फ्लोचार्ट). With Latin words left inside a Hindi line, Chatterbox read the sentence and then babbled for 3–20 s; full Devanagari read cleanly. `LANG = "hi"` makes whisper check every take in Hindi.
- **Check every take:** `assemble.py` prints whisper's transcript of each one and cuts a run-on take 120 ms after its last real word (a 26 s babbling take came back as a clean 3.02 s). A wrong word inside a line still needs a re-roll: `narrate.py <id>`.

**Rules for cuts and sound:**
- **Cut ON the audio burst.** fframes cuts 3 frames before its burst. Put the cut frame and the burst on the same time.
- **Hold a gap before the hero word:** 0.3 s, and 0.4–0.9 s of true silence before the final reveal (the best type piece here held 0.87 s of digital silence). Picture still, sound silent. `[t, 'gap', 1, {dur: 0.3}]` silences the bed and the drone. End a dry build where the gap starts (`sub_swell`, `suck_in`); a riser with a reverb send rings straight through the gap.
- **Foley for objects, silence for clicks.** Something that moves, lands or grows gets a sound when it moves. A pointer click, an Enter or a caret gets none. Use pitch only where it carries information (a typing ladder, a walk up a scale).
- **Loop closure:** if the film can loop, its last frame is frame 0. Fade in from frame 0 anything that appears after it, and check with `node render.mjs --loopcheck --query look=0` (have `overlay` skip the look when the query says so).

**Brand rules:** colours from CSS variables (`hsl()` → hex) and logo pixels; fonts from `@font-face` / `next/font` or the nearest Google font; the SVG wordmark (white copy: `sed 's/fill="black"/fill="white"/'`); a geometric mark redrawn as canvas paths so it can assemble itself. Pale accents (yellow, lime) are never text on light grounds. A brand with no identity gets a designed one: a palette with roles, two fonts, a mark from its own objects.

## 5. Gates and critique: craft AND originality
1. **Stills gate:** check every still for one focal element, a biggest word of at least 18 % of H (unless the shot is about something else), and the corner test. Before any full render, `node render.mjs --still <one t per shot, plus every transition midpoint>` and tile them: `(cd review && ffmpeg -loglevel error -y -pattern_type glob -i 't*.png' -vf "scale=480:-1,tile=6x5:padding=4" -frames:v 1 ../sheet.jpg)`. Fix layout, collisions and readability here, where a fix costs seconds.
2. **Render:** `node render.mjs --cues && uv run sfx.py && node render.mjs --out <slug>.mp4 --subframes 4`. Subframes give motion blur at 4× the render time; leave them off for drafts.
3. **Critique pack:**
```bash
ffmpeg -i <slug>.mp4 -vf "fps=2,scale=384:-1,tile=6x6" -frames:v 1 contact.jpg
for s in <transition times>; do ffmpeg -loglevel error -y -ss $s -t 0.7 -i <slug>.mp4 -vf "fps=13,scale=320:-1,tile=9x1" -frames:v 1 strip_$s.jpg; done
```
   Plus stills on any event shorter than 0.5 s (a 2 fps sheet misses a 3-frame flash), and a spectrogram with the cuts marked (`sfx.plot(mono, [(t, label)], 'spec.png')`) to check every sound against its picture event.
4. **Score each 1–10:** hook in the first 2 s, readability at phone size, motion, variety, brand accuracy, sound sync, **originality**. For originality, put your contact sheet beside each reference's sheet: any shot that reads as "their shot" scores 4 or less and gets redesigned.
5. **Fresh critic:** spawn one subagent that didn't make the film. Give it concept.md with the banned list, the sheet, strips, spectrogram, stills and the reference sheets, and ask for scores, the 5 worst problems, and "which shot could you have predicted from the brief alone?". It sees what you've stopped seeing. When scores disagree, the lower of yours and the critic's wins (huashu-art-motion measured self-scores about 10 points above independent ones).
6. **Delivery gate:** `uv run ~/.claude/skills/x-video-frames/filmgate.py <slug>.mp4`. Red means no delivery: a mid-film blank run of 0.3 s or more, or a blue-purple film (30 %+ of frames). On its first run it caught the MBBS reel going empty for 0.6 s in the silence before the end card: hold the last picture through a `gap`, don't clear it. Yellow is a reason to look, not to block: fast motion under 0.06 (that reel read 0.025, slow handwriting), or 8+ push-ins a minute.

Fix the 3 worst problems; do at least 2 rounds, until every score is 8+.

Problems these films actually had:
- **Stage lights:** striped volumetric beams looked like curtains. Use one soft `keylight` plus `dust`.
- **Split-flap too slow:** keep the riffle ≤0.35 s and centre the word in its cells.
- **Transitions through grey:** a light/dark crossfade passes through mud. Hard-cut on the beat instead.
- **Text over a growing object** gets eaten by it: fade the words before the object arrives.
- **Overlapping labels; text overflowing a frame; a leftover word in a push; colliding scatter rows:** measure widths, size frames from the text, fade the old word by `push*3`, advance rows by descender plus cap height.
- **Re-skinning isn't redesigning.** A centred mono word in scramble cells read as fframes whatever the colours; a typed mono line with a grey label above it read as ryanvogel's; a pen plus a mono state label plus an index ruler was hairline's film complete. New compositions fixed them: the code over the film's own timeline on a red field, the line's pitches as a skyline above it, sounds drawing their own waveforms.
- **A spark hopping tile to tile was 13's device.** Let the data do the visiting: each tile grows to its real number in turn.
- **Proof too small to read:** numbers at 20–26 px vanish at phone size. Make the number the display element (150 px), and keep labels at 28 px or more.
- **The call to action flashed by:** a URL that finishes typing 0.2 s before the loop-out is never read. Type it fast and hold the lockup for over a second.
- **Subframes smeared a live clock:** digits that change within a frame blur into each other. Read clocks at the frame's time (`Math.floor(t * fps) / fps`).
- **A 3×3 of rounded squares plus a dot read as a phone keypad.** 16:9 cells made it a contact sheet.
- **The loop didn't close:** a prompt glyph drawn at t=0 but gone at the end. Fade everything but the shared element in from frame 0.
- **The gap wasn't silent:** a `glide_riser` ending on it left its reverb tail ringing at −35 dB. A `sub_swell` that stops dead made it 13 dB quieter than the room tone.
- **Grey flashes:** a flash that peaks below ~90 % white reads as a grey dissolve. Step it per frame: white, white, dark, white (the re-stroke), then gone.
- **Beaded strokes:** stroking a polyline segment by segment with round caps leaves a bead at every joint once alpha < 1 or a blur is on. Draw a tapered stroke as one fill (`taperLine`).
- **Leads too small:** an italic lead with a 4 % cap height disappeared at phone size; the fix was 6–9 %.
- **Answers off the sound, holds dead:** an answer that landed 0.4 s after its thunder read as late, and 1–2 s of still type read as a slideshow. Land the answer ON a sound (a beat, a second thunder roll), push in 3–5 % over the hold, and let the rumble shake it.
- **Fades in disguise:** an afterimage fading to black and a bolt fading out both counted as fades. Hold, then cut.
- **A -1 index matched:** an unvisited tile's `indexOf` (-1) equalled "nothing selected yet" (-1) and lit up. Guard lookups that can miss.

Only ship 9:16 or 1:1 if asked. Those formats need a re-layout, not a crop.

## Examples (to show the API, not to re-skin)
- **`examples/keychain-v1-swiss.js`:** Swiss kinetic type after Whop. Too literal a copy of its reference; keep it only as a demo of the Swiss helpers.
- **`examples/keychain-v2-cinematic.js`:** a barcode scan whose bars cut to black, Keychain's Generate Products prompt, a spec sheet with a drawn pouch, a curved supplier conveyor, a split-flap board, a chain whose last link closes into the k mark.
- **`examples/count-the-gap.js`:** the demo (`demos/type-film.html`, first video), made with the type-craft rules above. A kinetic-type film whose cuts run on the speed of sound. Each thunder lands distance / 343 s after its flash, the count's numerals grow as the storm closes, each flash inverts the frame, rain is `drawCloud`, and the last afterimage straightens into the rule the instruction stands on. Its sound is `examples/count-the-gap-storm.py` (rain and thunder synthesised from the same cue list; no music). Copy it to the project as storm.py and run `node render.mjs --cues && uv run storm.py`.
- **`examples/claude-s-hud-iso.js`:** the earlier demo (second video): screen HUD + isometric product + a monochrome morph, no music. A prompt whose keys' pitches rise above it as a skyline, `seek(t)` on a red field over the film's own timeline, a contact sheet of its own frames, sounds that draw their real waveforms as they play, the skills growing to their SKILL.md lengths and folding into the mark, and a caret loop. Its numbers and waveforms come from the repo via `examples/claude-s-gen_data.py`.

## Limits
- **Render time is the bottleneck?** For a NEW piece that doesn't need this skill's templates or toolkits (no footage, no type.js/look.js/sfx.py devices) and is long, batch-rendered or shader-heavy, [fframes](https://github.com/dmtrKovalenko/fframes) (MIT; Rust + SVG on the GPU) renders far faster than headless Chrome. Ask the user first: it needs the Rust toolchain (`rustup`, plus a first build of about a minute prebuilt or ~20 min from source), then `npx skills add https://fframes.studio` installs its own skill, which you then follow. Otherwise stay on render.mjs. Trade-offs: the README's "fframes or render.mjs?" table.
- Real 3D is in lib.js (its header has the details): `VIDEO.three = true` with `gl3d()` for Three.js 0.169 that renders identically however it's seeked (soft shadows, `gl3d.env()` for metal), `phone3d()` for a lit phone whose screen is any 2D drawing, and `codeBlock()` for an editor panel with typing and a highlighted line. Without them it's canvas 2D: layers, strips and camera scale, `drawCloud` for perspective particles, and `iso.js` for orthographic solids.
- Motion blur costs render time: `--subframes 4` takes 4 screenshots per frame.
- Music is synthesised unless the user supplies a licensed track (`VIDEO.music`).
