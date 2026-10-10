# Reference library

These references have already been deconstructed. Reuse the notes, and add a new entry whenever you analyse a new reference.

Each entry has two parts:
- **TAKE:** techniques that transfer to another brand.
- **LEAVE:** things that are recognisably theirs. Reproducing them makes a copy, not a new film.

Entries credit the maker and link the post. They describe techniques in our own words: never paste a reference's
prompt, script or copy here. **Lives in** names the helpers that implement the technique (type.js unless marked).

Contents: the first three films (Whop, portfolio reel, Nexus), then the 2026-10-10 batch by style: screen HUD (19, 09,
17), 80s vector CRT (08), monochrome morph (12), line catalogue (20), isometric product (01, 13), UGC and screen edits
(02, 07, 16), paper and collage (14, 06), lyric and promo motion (10, 15, 18), and process (prompt-motion, stop-motion).

---

## Whop brand film, @az_andrian
`x.com/az_andrian/status/2104495114534133847` · 10.9 s · 1920×1080 · 152 BPM

**TAKE**
- A cut every 1–2 beats.
- Huge grotesk type on grid paper, with small editorial meta labels (year, chapter, product name).
- Three colours, with the grounds alternating paper / dark / accent.
- Type enters with a masked baseline rise, and small labels scramble in letter by letter.
- A match cut on a glyph.

**LEAVE**
- The shot order: One / Two / Talking Points / 5 / lockup.
- The poster wall pull-back, the tiled giant "2"s and the 3D "0".
- The "Talking Points" marquee, the pill tunnel and the scattered 5s.
- The lockup construction guides used exactly as shown.

**Used in:** `examples/keychain-v1-swiss.js`. That film took far too much: it reproduced all 13 shots in order and the user rejected it for that. Don't repeat it.

---

## Portfolio reel, @Jerrythe2d
`x.com/Jerrythe2d/status/2104236249855017381` · 21 s · 2958×2160

**TAKE**
- A bright neutral stage.
- Content on floating screens set on a **concave curved wall** that bends toward the viewer at the edges, with a soft floor reflection.
- A calm horizontal travel between items.
- Every screen has its own small UI moment (a cursor, a "Booked ✓" chip).

**LEAVE**
- The iridescent cyan-to-violet glass side panels.
- The `{ Name }` bracket title above each screen.
- The blue checkerboard bookends.
- The client-by-client portfolio structure.

**Used in:** v2's supplier conveyor (`bend()` plus the reflection baked into the strip).

---

## Nexus Labs launch film, @Kendel4204k
`x.com/Kendel4204k/status/2104168085687267716` · 50.5 s · 1920×1080

**TAKE**
- A slow, narrated pace, one idea every 1.5–2 s.
- Small centred narration whose words arrive out of a blur.
- Cream grounds with tiny printed technical marks, alternating with deep dark grounds.
- Glass UI cards and a prompt that types itself, with a cursor.
- A logo mark on dark to close.

**LEAVE**
- The "Not all AI models think the same" script.
- The model-logo tiles in perspective, the multi-model analysis cards and the diagonal card cascade.
- The toolbar over stock footage.
- The chrome ribbon, the cyan god-rays and the smoke lines.

**Used in:** v2 narration (`words()`), the prompt field (Keychain's real "Generate Products" feature), and `marks()` redone as packaging lot codes.

**Lighting lesson:** striped volumetric beams read as stage curtains, and the user called them bad. Use one broad soft `keylight()` plus `dust()` instead.

---

# Batch 2026-10-10

Full measurements (frames, sheets, spectrograms, stems) are in `~/Movies/refs/batch-2026-10-10/`, summarised in
`group-A.md` … `group-E.md` there.

## fframes "DO NOT UNMUTE", @neogoose_btw (screen HUD)
`x.com/neogoose_btw/status/2108558320873218535` · two films, 6 s and 10 s · no music

**TAKE**
- Words resolve cell by cell: each mono cell scrambles for ~0.25 s, then settles, left to right; measurement labels and tracker hairlines as texture.
- Screen physics as finish: screen-door pitch, a 1–2 px chroma fringe, bloom, a crushed vignette.
- Sound is the room plus the UI: a hum/whine/hiss bed about 20 dB under dry blips. Typing is a pitched ladder (a fixed Hz step per glyph); status blips walk a pentatonic scale and resolve on the last step. True silence between sections.
- Their cuts lead the audio by 3 frames. In our builds the cut goes ON the burst.

**LEAVE**
- The name, marks and agent-run script; the typing order and melody; the Done pill; the ECG.
- The 45° hatched cells with `x: y:` labels as drawn, the green/violet colourways, the LCD-through-a-macro-lens camera with Dutch tilt. Re-skin the cells with the brand's own objects (`glyphHud`'s `cell` and `label` hooks).

**Lives in:** `glyphHud trackers cornerTicks typeCues scrambleCues`; look.js `lcd` preset; sfx.py `thock ladder ticks ui_blip drone`.
**Used in:** the claude-s demo (cells as film frames labelled with frame numbers, a typing ladder whose pitch is drawn under the text).

## "age of iteration", @ryanvogel (screen HUD, narrated)
`x.com/ryanvogel/status/2108760169501040748` · narrated manifesto, ~150 wpm

**TAKE**
- Mono narration typed in sync with the voice, block caret; one key word per line gets a cell or a gradient.
- Live numbers make a claim concrete (counters, a row of dots filling one tick each); status corners.
- The pivot: the frame collapses to a line while the whole mix low-passes from 16 kHz to 1.2 kHz, then hard-reopens on a sub thump.
- Section breaks: a film burn (6–10 frames) with a noise swell into a 40–80 Hz whoomp; a blue tear.

**LEAVE**
- The script, the bracketed chapter labels, the node graph, the three-verb sequence, the 1,000 mosaic, the dot end card.

**Lives in:** look.js `crtCollapse filmBurn blueTear`; sfx.py `lp` with `lp_master`, `burn_whoomp`.

## "wild visuals", @mnowakdesign (screen HUD, picture only)
`x.com/mnowakdesign/status/2108253918086176899`

**TAKE**
- "Label soup": overlapping coordinate labels used as texture, not information.
- 2–3-frame LUT stabs (thermal, navy duotone with halftone, paper negative, phosphor) as glue between cuts, each with ticks and a data burst.
- A horizontal stutter (the frame echoed across x); perspective planes with depth of field.

**LEAVE**
- Its compositions and words.

**Lives in:** look.js `lutStab LUTS stutterRepeat dofBand halftone`.

## Trenchers launch films, @TrenchersAI (80s vector CRT)
`x.com/TrenchersAI/status/2108609525213548701` · v1 photoreal office, v2 vector CRT, synth funk 129 BPM

**TAKE**
- v1: the music sits low-passed at ~4.5 kHz until the hero object lands, then opens fully. Words pop on hard ~0.17 s apart with a **0.33 s held gap before the hero word**. Type leaves by defocusing (scale up, drift, blur, grey).
- v2: phosphor strokes that draw themselves (a wide soft glow pass plus a white-hot core); inline condensed type; colour-bar scanline backdrops; a wipe beam with a starburst head; CRT collapse and expand; a VHS tear.
- Ending as a TV switching off: static plus a 580 Hz tone, a zip up, a zip down, then silence. A one-beat bass mute before a cut.

**LEAVE**
- Every brand, the phone and office set, the finger-touch motif, the phone diving into the CRT, the prize copy, the lockup.
- The exact 8-band rainbow as a palette: pick the brand's own bar colours.

**Lives in:** `drawOn inlineWord rainbowBars starburst`; look.js `crt vhs` presets, `crtCollapse vhsTear rgbSplit defocusExit`; sfx.py `crt_off tom static_slam`, `bed.lp`, `bed.mutes`.

## Monochrome morph piece, @gxjo_dev (made with Opus)
`x.com/gxjo_dev/status/2108632470551933011` · 19 s

**TAKE**
- One shape-matched single take: every object becomes the next about a shared centre, so there are no cuts.
- Full-stop lowercase headlines over a small lead line; construction lines and circles as drawing aids; one light cone.
- The score is cut to the picture: chord changes on visual beats, whoosh-then-impact on each morph, a tick triplet on annotations, a hiss under the beam.

**LEAVE**
- The person, the fruit, the eye dive, the phone, every word of copy.

**Lives in:** `morphMatch smear`; sfx.py `hiss_bed whoosh impact`.
**Used in:** the claude-s demo (the clock's cell becomes a contact-sheet cell; the mark's circle becomes the caret).

## hairline v0.2 release, @lucasmarkes__ (line catalogue)
`x.com/lucasmarkes__/status/2106502812498632707` · 12 s, no audio · made with hairline-create (github.com/lucasmarkes/hairline, MIT, © 2026 Lucas Marques)

**TAKE**
- A catalogue held together by one persistent pen: a tapered comet hairline that lands on each part as it changes and carries across swaps.
- Swaps by echo smear (6–10 fading offset copies over 0.15–0.25 s); mono state labels; an index ruler.
- Line tiers (hi, edge, mid, lo) instead of fills, so one highlight carries the meaning.

**LEAVE**
- The paper ground and grey tier palette as a whole, their figures, the pen becoming the title's baseline, the title rising from behind the line.
- Link hairline-create for this look; never vendor it. claude-s's `iso.js` is an independent implementation.

**Lives in:** `pen smear onion`; iso.js `LINE` tokens.
**Used in:** the claude-s demo (the pen underlines sound names as they play).

## Exploded device, @srushtiddesign (isometric product)
`x.com/srushtiddesign/status/2108473831262494790` · 19 s, no audio · output of hairline-create

**TAKE**
- 2:1 dimetric (az 45, el 30). Rounded footprints extruded, the silhouette is the hull of the top and bottom rings, so no vertical corner lines; one crease on the top.
- Plates filled with the ground and painted back to front, so near hides far; dashed guides painted before their plate.
- Exactly one part coloured at a time. A gap opening on a spring (k 100, c 18, ~0.7 s); a pick fading in over ~0.25 s.

**LEAVE**
- The device, the exploded vertical stack with a pastel per layer, the bench chrome, the caption.

**Lives in:** iso.js `cam slab guide order spring tween stagger`.
**Used in:** the claude-s demo (the skills as an iso skyline, hull-silhouette tiles in the dark line tokens).

## Claude Dashboards + Claude Motion launch, @claudeai (isometric lift, player frame)
`x.com/claudeai/status/2108271552991252810` · 82 s, voice-over, 86 BPM bed

**TAKE**
- Moves of one container replace cuts: shrink into a player, scrub-rewind, a slit opening from the centre, bars closing into a button, a burst of tiles.
- Agent devices: a spark hopping between tiles with a comet tail, a skeleton flash before content, status lines that shimmer grey to ink, text set on a path.
- Data → world: a flat plan lifts into 3D and every point keeps its coordinates; the colour grade moves with a clock.
- Sound: voice first, no UI clicks sonified, 0.4 s of silence before the lift, a swell under it, an echo tail instead of a stinger.

**LEAVE**
- The story and its people, the cream desk, terracotta, the end line, Anthropic's brand and partner logos, the compositions.

**Lives in:** `player slitReveal shutterButton sparkHop skeletonFlash shimmer textOnPath onion selectHL`; iso.js `lift`; sfx.py `swell sparkle echo gap`.
**Used in:** the claude-s demo (the skills' plan lifts into the skyline; the swell under it).

## "This Is What Good Editing Can Do", @Falex_mp4 (UGC edit)
`x.com/Falex_mp4/status/2108411178984812546` · 50 s podcast re-edit, 24 fps

**TAKE**
- Cuts follow the words, 40–120 ms before the next word; keyword graphics land 140–180 ms after their word.
- Two-tier captions: a tiny lead-in line that un-types in reverse, and one giant keyword per phrase that slides in and cools letter by letter like a fuse.
- The camera never sits still: zoom-settle on entry, lateral slide, a keyword-fired pull-back.
- Transitions from a table: exposure flash, white-out, dip, glow-in, glitch box, a B&W flash montage.
- Three SFX families at fixed levels against the voice: sub (+4 to +12 dB, below 90 Hz), air and micro (−11 to −18 dB).

**LEAVE**
- The iceberg and grid inserts, the green/lime/amber trio (take the fuse, not the green), the thermal hand, the montage content, the footage, the script.

**Lives in:** `hotWord leadIn glowIn flash shotCam glitchBox montageFrames`; sfx.py families and `autocue`; ugc-edit.

## YouTube edit highlight, @alemu_creatives (screen insert)
`x.com/alemu_creatives/status/2108617934310678712` · 7.7 s

**TAKE**
- Recreated UI acted out on the words: typing at ~5 chars/s, a Bézier cursor, a click, results arriving out of a blur 40 ms apart.
- An accelerating push into the highlighted phrase with a synthetic depth of field; a pad entering 0.45 s before the cut it introduces.

**LEAVE**
- Google's UI and the script.

**Lives in:** `screenInsert clickDisc dof shotCam`.

## Claude Code Projects tutorial, @shadcn (screen recording)
`x.com/shadcn/status/2108804948750393689` · 4.5 min, voice only

**TAKE**
- Fast zooms of 4–6 frames, expo ease-out with a slight overshoot; an oversized cursor parked while typing and a grey click disc.

**LEAVE**
- Anthropic's brand, the set, the script and the diagrams as drawn.

**Lives in:** `clickDisc`; the rest of it belongs to a screen-recording edit, not a type film.

## "Breaking apart a book", @azlenelza (paper foley)
`x.com/azlenelza/status/2108768504006774968` · 12.6 s

**TAKE**
- Source → evidence: torn slips fly from the object on arcs (0.45 s, staggered by distance), scale up, blur mid-flight, their shadow lifting then landing; washi-tape labels.
- Paper foley only, with digital silence between events. The riffle starts when the object moves, ~0.25 s after the click; **clicks are not sonified**.

**LEAVE**
- The book, its quotes, the timeline as drawn.

**Lives in:** `slip tape`; sfx.py `riffle page_turn flick paper`.

## "four months at Parallel", @reathchris (recap moodboard)
`x.com/reathchris/status/2108723438861058326` · 44.6 s, 1:1, no audio, a seamless loop

**TAKE**
- An accelerating flip-book (shots of 3, 3, 3, 2, 2 … 1 frames), then a hold, then a push through.
- Paste-up collage (a scrap every 3–4 frames at ±8°, no easing), numbered pins, scatter → snap, a reverse replay of earlier frames.
- The loop closes exactly: the end is the start.

**LEAVE**
- The brand and copy, the botanical sphere, the collages as composed, the tree ring.

**Lives in:** `flipFrames cutIndex pasted pins whip rewind drawAt`; sfx.py `tick_ramp paper reverse_riser`.

## Fermi-paradox lyric film, @antic (lyric essay)
`x.com/antic/status/2108582512960368715` · 222 s, 136 BPM song

**TAKE**
- Hard cuts only at section changes; every other change is a 2-frame crossfade.
- Karaoke at the sung onsets, size following intensity, the held word outline-only; exponential live counters in a mono stat box.
- The arrangement scores the picture: drums out for 7.5 beats before the turn while the picture pulses on the beat.

**LEAVE**
- The script and lyrics, the scenes, the anime look, the stat copy.

**Lives in:** `karaoke expCount softcut bpmPulse`; sfx.py sections `stop` and `outro`.

## Firecrawl launch, @MotionByLeo (one-primitive promo)
`x.com/MotionByLeo/status/2108226331125457249` · 120 BPM tech-house

**TAKE**
- One primitive carries everything (here a square): a dot field in 4 opacity tiers that blooms, opens a hole for text and spreads on beats; letters turning into squares; a deck fanning into tumbling tiles.
- A slot-list feature roll (centre item solid, neighbours fading and blurred, stepping every 0.27 s); chips popping 80 ms apart.
- Cuts on kicks ±70 ms; the bass mutes for one beat under each new idea; no UI sounds; mastered quiet.

**LEAVE**
- The orange, the flame, the copy, the logos, the portrait, the sequence.

**Lives in:** `pixelField slotList slotStep counterRoll tumbleTiles asciiImage cornerTicks`; sfx.py `kick` params and `bed.mutes`.

## Neue Academy event promo, @ayushsoni_io
`x.com/ayushsoni_io/status/2108649039340487082` · 9 s

**TAKE**
- A pixel-block datamosh mask held on twos or threes; a card in front of a blurred, zoomed background that drops out in 0.25 s as focus snaps back; a date popping at 1.2× and settling in 2 frames.
- A downlifter under the card's exit; a bell sting on the logo.

**LEAVE**
- The brand, the footage, the poster.

**Lives in:** look.js `mosh`; sfx.py `downlifter sting`.

## prompt-motion.com, @p4nthera_'s gallery of Opus 5.5 motion pieces (process)
`prompt-motion.com` · 233 entries · the prompts belong to their creators and the site forbids AI training: take patterns, never prompts.

**TAKE**
- A banned list in the brief carries the taste (no glass cards, gradients, bouncy type, blanket fades, dead holds, invented numbers).
- Real material wins: the real site, features and numbers.
- One continuous thing (a shape that never cuts, one camera over one world, one persistent prop).
- Gates: stills on every beat before the full render, loops that close exactly, subframe motion blur, a fresh critic.
- Seen there: one shape morphing through UI states on summed springs with 4 subframes (@twoclipping); one camera over one world with match cuts by radius → 0 and a fresh critic (@antonio_kodheli); engravings with word morphs (@LexnLin); marker strokes drawn on (@ik_builds). A frame-numbered remake of another brand's film (@notdwd) is the kind of copy this skill forbids.

**LEAVE**
- Every prompt and every film.

**Lives in:** this skill's process (banned list, stills gate, critic, loop closure); render.mjs `--subframes` and `--loopcheck`.

## DeFi Saver stop-motion, @nikolajankovic (on prompt-motion.com)
12 fps, 58 s, no audio

**TAKE**
- Stop-motion measured: a 3-drawing boil at 12 fps (4 loops a second), whole-pixel ±2 px jitter, ±1.2 % flicker; pages that draw on, never fade in; one persistent prop carrying the metric.

**LEAVE**
- The script, the 3 a.m. story, the thermometer, the island map, the taped caption strip.

**Lives in:** lib.js `boil(t, 12, 3) stepT jitter flickerGain sketch`.

Not here: @eliana_jordan's POV jump cuts (`x.com/eliana_jordan/status/2108867254255505792`) belong to ugc-edit.
