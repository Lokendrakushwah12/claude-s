---
name: promo-video
description: Make a short, polished SaaS or product launch promo video (10–30 s motion graphics, like the one-shot Dub.co launch video) from a product's own repo or website. It uses the real logo, colours, fonts, copy, numbers and UI, recreated as JS canvas animation (a one-primitive visual vocabulary, the real screens in a player frame with a cursor walk-through, slot-list feature rolls, rolling counters, a logo end card with a CTA), scored with synthesised SFX and a music bed (or sonified UI). Renders frame-exact MP4 at 60 fps with real motion blur in 16:9, 1:1 and 9:16, with a choreographed cursor (eased arrivals, presses the UI reacts to, drags and flings). Handles one product, an event promo, or a batch. Use when the user asks for a promo, launch video, product teaser, event or webinar promo, showreel-style ad, social video for their app or site, or several of them.
---

# Promo video: product → 15 s launch MP4

> Part of claude-s. When a job needs parts from other skills, read `../claude-s/SKILL.md`: which skill leads, and what the others lend.

The reference is the Dub.co launch video (Sept 2026). It was one-shotted from a two-sentence prompt run **inside the product's repo**. The prompt asked for a 15-second motion-graphics SaaS launch video that shows off like a motion designer's showreel. The repo is the whole trick: the agent had the real logo, brand colours, fonts, copy, data and UI components, so the video looked like *their* product, not a template.

It reuses the **music-video engine** (`lib.js`, `render.mjs`) and the **type-film kit** (`type.js` devices, `look.js` looks, `iso.js` isometric). This skill adds `promo.js` (promo helpers), `sfx.py` (the sound) and a demo `video.js`.

## Setup per video
```bash
D=~/Movies/promos/<slug>; cp -R ~/.claude/skills/promo-video/template "$D" \
  && cp ~/.claude/skills/music-video/template/{lib.js,render.mjs} ~/.claude/skills/type-film/template/{type.js,look.js,iso.js} "$D"
```
Read `lib.js`, `promo.js` and the section headers of `type.js` once before writing scenes. Two examples show the API (never re-skin either): `examples/i18n-doctor.js` (12.5 s: the look — ground, three type voices, real cards, a depth field that implodes into an iris, one card that grows through three states, the end-card spec) and `examples/claude-s-silk.js` (9 s: the cursor, a drag and fling, velocity-matched cuts, `smoothText`).
- **`lib.js`:** `bg text smoothText kinetic cover prog ease rng spring sketch onFrame`, `W`, `H`. `spring(p)` is the 0..1 UI entrance; `spring(t, [[t0, v0], [t1, v1], ...])` is a closed-form spring in seconds through targets (cameras, anything that changes target). Premium eases: `ease.expoOut expoIn expoInOut quintOut emphasized smooth cursor spring(p, bounce)`, and `bezier(x1, y1, x2, y2)` for your own. Pure functions of t, never state carried between frames.
- **`promo.js`:** the look (`ground card headline hudFrame plane connector`, `pill` with `dot`/`shadow`), `stagger typewriter counter series lineChart glow mesh wipe withBlur rrect`, the cursor (`cursorPath aimAt magnet drawCursor clickRing`) and silky motion (`fling velCut cutLadder pushInto depthLayer`). `iris`, `litGround` and `drawCloud` live in `type.js`.
- **`type.js`:** `S` (= min(W, H) / 1080; don't redeclare it), `TYPE` (set the brand's fonts), `word ui rise scramble` and the devices below. `look.js` is off unless asked. `iso.js` draws isometric solids and the flat → oblique lift.
- **3D (lib.js):** `VIDEO.three` + `gl3d()` (the lib.js header has the rules); a phone with the product UI on its screen: `phone3d(c, { x, y, h, yaw, pitch, screen: (sc, w, h) => drawUI(sc, w, h) })` (unlit screen, so brand colours land exact; don't build a 2D phone); code on screen: `codeBlock()`.
- **Brand fonts not on Google Fonts:** copy the files to `assets/`, add `@font-face` rules in `index.html`, and after `boot()` chain them on: `window.ready = Promise.all([window.ready, document.fonts.load('700 40px "Brand"')])`.

## 1. Brand discovery (don't skip it; this is what makes it look real)
Work from the product's repo if there is one; otherwise from its live site. Collect into `brand.md`:
- **Logo:** an SVG from `public/`, `assets/`, `app/icon*`, a favicon, or an inline React logo component (copy its geometry). Save it to `assets/logo.svg`.
- **Colours:** from the Tailwind config, CSS variables (`--primary`, `--brand`), the design-token files or the theme. Hex only. Record the grounds they actually use and which colour is accent only.
- **Fonts:** `next/font`, `@font-face`, `font-family`. Use the repo's own font files when they're there; otherwise the nearest Google font, noted.
- **Copy:** the hero, the tagline, the feature names, the CTA text and the domain. Their words, not new marketing speak.
- **Product UI:** the 2–4 screens that show the value. **Redraw them in canvas from the components** (layout constants, real labels, real data, their loading skeletons), which animates better and stays crisp; or screenshot them into `assets/` (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=assets/x.png --window-size=1600,1000 --hide-scrollbars <url>`) and animate inside a `card`.
- **Numbers:** only real ones, from the repo's data, stats files or public site, checked by running a script over the data. Note each number's source in `brand.md`. **Never invent a stat**; with no real numbers, show the UI working and make no claims.

## 2. Brief and beat grid (`treatment.md`)
Before you plan the piece, run the creative method in `~/.claude/skills/type-film/creative.md` (20 concepts from the subject's own world, kill the first five, one "only this could exist here" invention).
Write the brief first: one idea, the brand's **one primitive** (see 3), the real screens and the one task the cursor will do. Add a **banned list**: what this brand would never do (glass cards, mesh gradients, a flat ground, bouncy type, crossfades between shots, invented numbers, click sounds, a stinger, UI that isn't in the repo...). Then the **beat grid**: pick a BPM, put every shot, cue and section on it, and cut on the kicks. 15 s is about 8–12 shots:

| t | beat | example |
|---|---|---|
| 0–2 | **hook**: the primitive appears, or something types in | the mark draws itself out of a dot field |
| 2–6 | **product moment**: the value shown working | the real screen in a player frame; the cursor does the one task |
| 6–9 | **the second capability** | a slot-list roll of the real features with their real counts |
| 9–12 | **proof** | real numbers rolling, or the data itself drawn as the primitive |
| 12–15 | **end card**: a gap, then the logo, tagline, CTA, domain | the CTA collapses into the logo's origin |

Longer demos keep the same shape (measured off two annotated launch videos): **24 s** ≈ hook 19 %, demo 39 %, result 25 %, CTA 16 %; **60 s** with a voice ≈ intro 11 %, demo 22 %, features 14 %, build 32 %, outro 19 %. With a voice-over, cut on the voice, not the beat.

Craft rules (the "showreel" bar, measured on the best product promos of the 2026-10-11b batch):
- **Holds read, nothing freezes.** A composed frame stays 1.5–2.2 s while its parts arrive 0.08–0.12 s apart and something inside keeps moving (typing, a counter ticking, a pulse on a link, a bar filling). Nothing is fully still for more than 0.6 s except a deliberate gap. Enter with `spring`/`stagger`/`headline`; exit in 0.15–0.2 s (blur up and out).
- **Three type voices.** Display: the brand's grotesk at weight 700+, tracking −0.03 to −0.05 em; a hero word 20–28 % of H, a section headline 10–15 %, a tagline 5.5–6 %. Accent: the payoff word in the brand colour or a serif italic, at most one per line. Meta: mono, tracked caps (+0.25–0.35 em) at 1.8–2.2 % of H for eyebrows ("01  PASTE A REPO URL"), labels and metadata. `headline()` sets all three.
- **The ground is never a flat fill.** `ground()`: a light base (warm off-white) or a dark one (#09090b–#0b0d17), one or two soft blooms (a brand tint, a cool tint), a faint grid or dot lattice, a vignette. Dark grounds also take `dust`/`grain`.
- **UI looks real.** `card()` (layered shadow, hairline, lit edge on dark); icon tiles tinted with the accent at ~15 %; chips with a status dot (`pill(..., { dot })`); mono metadata lines; specific content (the repo's real labels, a list that ticks, a bar that fills). Small UI text never under 20 px at 1080; push in until the text that matters is 35–40 px.
- **Fill the frame.** Headline block plus UI covers 55–75 % of the width; a two-column layout (headline left at x ≈ 8 %, UI right) or one centred object. A tiny element in an empty frame is the commonest flaw in the batch.
- **One world, not slides.** Prefer one container that grows or morphs between states (input → scanning → report) and a camera that moves over it to cuts between unrelated layouts; cut when the idea changes.
- **Contrast rhythm:** dark hook → light product → an end card on a ground the product world never used (the brand colour, or dark). Keep the accent for the hero moments.

## 3. Devices and patterns (type.js unless noted)
- **One-primitive vocabulary** (Firecrawl): find the primitive in the mark (a square, a hub and spokes, a dot) and build the field, transitions, bullets, data and logo from it. `pixelField` (square dots in 4 opacity tiers: bloom, a hole for text, rings on beats), `cornerTicks` for small type in big space, chips that pop in with overshoot 80 ms apart, `tumbleTiles` (a deck fanning into a vortex), `asciiImage` (a 0/1 portrait).
- **Slot-list feature roll:** `slotList(c, items, x, y, slotStep(t))`: centre in ink, ±1 at 45 %, ±2 at 15 % and blurred, a step every 0.27 s; `counterRoll` for numbers.
- **Container continuity** (Claude Motion): one `player` frame on a desk hosts all the product UI, and moves of the frame (shrink to 0.6×, pan, push in) replace cuts. `skeletonFlash` as the UI loads (outline → block → content), `slitReveal`, `shutterButton` (bars close, the block morphs into the CTA), `sparkHop` (an agent visiting sources), `rewind` + `drawAt` (scrub-rewind of earlier shots), a tile burst with `sparkle` for exports, `pointer` + `clickDisc` for clicks.
- **Hero reveal** (Trenchers): words pop on hard ~0.17 s apart, a 0.33 s held gap where everything freezes, then the hero word, with the whole mix low-passed until it lands (`lp: [[0, 1800], [t - 0.02, 1800], [t, 20000]], lp_master: true`; at 4.5 kHz a dark arp barely changes, so nobody hears the reveal). Build with something dark (`sub_swell` + `glide_riser`) that stops where the picture freezes; a noise `riser` is brighter than the low-pass and gives the reveal away. **Screen as portal:** ease into an element, match its size across the cut, and grow the next world out of it on the same ground (no flash to white; bring a light surface in later, as a hard-edged shape from the element). Ending option: `crtCollapse` + `crt_off`, then silence.

## 3b. Cursor, camera and transitions (measured, 2026-10-11 batch)
- **The cursor is an actor with a hand behind it.** `cursorPath([{ t, x, y, click, grab, drop, out }])` → `pose` per frame; `drawCursor(c, pose)`. It arrives on `ease.cursor` (eases off the start, decays in at ≈ 0.82 per 25 fps frame, τ ≈ 0.2 s, no overshoot), on a slight arc, tip at `aimAt(rect)` (just inside the control's lower right, so the label stays readable). Dwell 0.2–0.3 s, press, then it backs off or fades (`out`) instead of hanging around. Size ≈ 5.5 % of H, up to 11 % in a push-in; draw it in the world it lives in, so it moves with camera moves.
- **The control reacts, not a ring:** dip 4–5 % with `pose.press`, change colour, flip a toggle or a label ("Copy" → "Copied"); `magnet(pose, rect)` gives the hover amount. `clickRing` only for touch (a tap ring an object rises through) or a CTA with no state of its own.
- **Drag and scroll:** the dragged thing leads and the cursor rides it (`grab` … `drop`, with `ease: p => p * p` so the drag ends at the fling's speed), then `fling(t, t0, dist, τ 0.28–0.32)` carries it on momentum; the hand runs on a little and fades. A file can drag itself in with no cursor at all.
- **Velocity-matched cuts** are where the "120 fps" feel comes from: `velCut(t, tCut, v)` accelerates the outgoing shot (expo, τ 0.12 s) and starts the incoming one at the same speed and direction, decaying (τ 0.22 s); the eye never loses the motion. The cursor can cross the cut the same way.
- **Click as portal:** the pressed control becomes the next scene (a button grows into the next world; a tap ring opens and the next object rises through it). **Push through the bezel:** `pushInto(c, p, screenRect)` zooms in log space until the screen is the frame. **Depth:** float UI on `depthLayer(c, cam, z, fn)` (parallax, blur by depth) for an immersive camera (see 3c).
- **Rhythm devices:** an accelerando cut ladder (`cutLadder(t0, n, 0.5, 0.75)`, each cut 0.75× the last) into a hard cut and silence; a 2×2 or 4-up bento of live cells, each a mini-scene swapping on its own beat; a hand-drawn mark layer held on twos (`stepT(t, 12)`) over type moving on ones.

## 3c. Staging, transitions and the end card (measured, 2026-10-11b: 52 product-UI promos)
- **Stage in depth, not on a flat plane.** Pick one per piece:
  - *Depth field:* 20–30 small pieces of the product's world (its real keys, file names, chips with a status dot) at depths 0–2.3 on `depthLayer`, the camera dollying in, `dof` ≈ 9 S so only the focus band is sharp; keep a clear band round the headline.
  - *Perspective wall:* `plane(c, { rot: [42, 0, -14] }, put => ...)` lays real cards or screens on a tilted plane behind a headline; drift it 20–40 px/s; `dof` blurs the far rows; lay a 40–60 % scrim of the ground colour where the headline sits. Lift one card off the wall toward the camera to go into the product.
  - *Hero object held:* one object (the device, the card) stays put while the headline and a status card swap each beat and its numbers keep ticking.
- **Implode → iris** (the dark-to-light turn): the field collapses into one point on `ease.expoIn` over 0.3–0.35 s, staggered 0–0.12 s per piece, while the headline blurs out; a dot glows there (make it the mark's own dot or shape), then `iris(c, x, y, p, next, { r0: dot, ease: ease.quintOut, ring: accent })` opens the next world from it in 0.4 s. Score: `sub_swell` ending on the dot, a `passby` across the iris.
- **Hub and links:** stat cards round the logo tile joined by `connector()` S-curves that draw on, then carry a travelling pulse (`q = (t * 0.8 + i * 0.25) % 1`); the numbers count up as each link lands.
- **Verb shots** (a feature list without a feature grid): one giant verb per beat (~1 s each, 20–28 % of H) that does what it says (blur. blurs under a drag marquee, zoom. zooms, translate. swaps language), over the real micro-UI that does it, on a full-bleed ground that changes colour each beat.
- **One shape through states:** `morphMatch` the same rounded rect from button → loader → panel → toast, content swapping with a 0.1 s blur. Make the shape big (≥ 40 % of W at its largest): the references that did this with a small pill in an empty frame looked empty.
- **Chrome (optional):** `hudFrame` (corner brackets, tracked mono labels, a progress rule) suits a showreel brief or a brand whose mark is a frame or viewfinder. It doesn't rescue a sparse frame.
- **End card spec:** the mark assembles (pieces fly in, a stroke draws, or the film's primitive closes into it) centred, then slides into the lock-up as the wordmark arrives (a lone off-centre mark reads as a missing frame); wordmark ≈ 45–50 % of W; tagline 5.5–6 % of H with one accent part and `underline` drawn on after it lands; CTA pill ≈ 8 % of H in the brand colour with `shadow` in that colour at ~40 %; a domain chip or tracked-mono platform line; the cursor arrives and presses the CTA (it dips, darkens). Hold the finished card 1.5–2.5 s.

## 3d. Adapting a reference without copying it
A strong launch film is a skeleton plus nouns. Keep the skeleton: section proportions, pacing (voice wpm, cut density), the container rule, how state is shown (an agent's checklist, one approve click), where the silence sits. Replace every noun with the brand's own: its mark's geometry for the open and close (two bars that become brackets, a hub that blooms), its ground pattern, its palette roles, what the bursts show (its users, its data). The test is type-film's same-sentence test: if one sentence describes your shot and theirs (composition and motion), redesign it. List the reference's devices in `treatment.md` with what replaced each.

## 4. Sound (`sfx.py`; the palette, cue params, sections, `lp`, `mutes`, `gap`, `echo`, `drone` and VO ducking are in its docstring)
- **Foley for objects, silence for clicks:** sound what moves (a sheet sliding: a `passby` peaking ~0.2 s after the click, since a sharp sound on the click reads as a click; a list rolling: `slot_roll`; dots landing: `dot_ticks`), never the click itself.
- **Cut on the kick**, and drop the bass for the beat *before* each new idea (`mutes`), so the kick on the cut is the re-entry (a mute that starts on a kick is masked by it). A minimal groove's long syncopated kick: `kick: {f0: 300, f1: 55, tau: 0.06, decay: 0.3}, kick_pattern: [0, 1.5, 2.5]` (the slower glide keeps it audible on phone speakers).
- **Silence before the payoff:** `[t, 'gap', 1, {dur: 0.5}]` into the logo, then an **echo tail** (`[t, 'echo', 3, {n: 8, decay: 0.8}]`, about −2 dB a repeat) over a sub that releases to the last frame (`sub_boom {dur: <to the end>, tau: 1}`) instead of a stinger; the defaults die a second early.
- Balance by measuring: `uv run sfx.py --plot` writes the labelled spectrogram and each cue's level against the bed. Foley about 6–12 dB under the bed; ticks can sit lower, they're above it in pitch.
- **Sonified-UI option** (fframes): no music; `drone: true` for room tone, and every UI event pitched from the picture's own constants (`typeCues` thocks per glyph, `ui_blip` on a pentatonic walk, `slot_roll` on counters, `glide_riser` → `sub_drop` + `sting` on "done"). Masters at −16 LUFS, with true silence between sections.

## 5. Event-promo variant
For a launch event, webinar or drop: footage or a brand field under a pixel-block glitch mask (`mosh`); a poster card in front while the background blurs about 30 px and zooms 1.6×; the card drops out in 0.25 s (ease-in) as the background snaps back into focus; the date pops at 1.2× and settles in 2 frames; end on a "live on <date> · <where>" lock-up. Sound: an `arp` bed fading in, a `downlifter` on the card exit, a reverb tail under the date, a bell (`chime`) on the logo.

## 6. Build → gate → review → render
```bash
cd "$D"
node render.mjs --still 1,1.5,2,...          # the stills gate: a still on every beat, all passing, before any full render
node render.mjs --cues && uv run sfx.py && uv run sfx.py --plot
node render.mjs --motioncheck --fps 60                 # stalls, hitches, cuts and a judder index per 6x4 tile, before the long render
node render.mjs --smooth --out final.mp4               # 60 fps, 4 subframes (240 samples/s), 180° shutter, linear-light blur
node render.mjs --size 1080x1920 --smooth --out final-9x16.mp4  # only as a real re-layout; check its stills too
```
- **Stills gate, read at full size** (each "no" is a fix before the render): Is the ground more than a flat fill? Does the headline block plus UI fill 55–75 % of the width? Is every UI text ≥ 20 px and the text that matters 35–40 px? Do cards show a layered shadow and hairline, and real content (the repo's labels, numbers with a source)? Is there exactly one accent per line? Is there something in depth (a field, a wall, a blur layer) at least once? Does the end card match the spec in 3c?
- **Flaws critics keep finding** (fix them before the first render):
  - A container that changes state double-exposes: old content leaves first (0.15 s, fade + 12 px up, rows 0.03 s apart), then the container reshapes, then new rows enter 0.04 s apart; overlap ≤ 0.05 s.
  - Counters: `counter(..., { roll: false })` for a fast count (thousands in under a second); anything that states the final number (a badge, a footer) waits until the count lands.
  - A beat ends on its payoff, never on a spinner: Fixing… → ✓ Fixed (0.4 s), and the next action appears beside it rather than the same button churning through four labels; the result holds ≥ 0.9 s before the next click, the final state ≥ 0.6 s.
  - The action matches the word: "Paste" pastes in one frame with a 0.15 s selection flash; checklists tick 0.15 s a row.
  - Push 1.3–1.45x onto the payoff (the bar filling, the number turning) so it fills 65–75 % of the width; scale the UI group, not the headline beside it. Reframe on each beat (centred → two columns); a layout locked for 4 s reads flat.
  - An iris or wipe reveals finished content, never an empty ground that fills in afterwards. Eyebrows add a fact; they never repeat the headline or the HUD.
  - Thin strokes moving fast (brackets, rules) strobe at 4 subframes: give their window 32 in `VIDEO.blur`. On wide buttons aim the cursor at `aimAt(r, 0.86, 0.8)` so the arrow never covers the label.
- **Silky motion** is 60 fps plus a real shutter plus eases that never stop dead. `--smooth` is the default delivery for promos (X, Instagram, TikTok and YouTube play 60 at most; `--fps 120 --subframes 2 --linear` only for a file played on a 120 Hz screen). At speed, 4 subframes show as 4 stamps (a fast title reads doubled): keep stamps under ~3 px apart by giving those windows more, `VIDEO.blur = [[t0, t1, 32], ...]` (only frames inside take the extra shots), or a 270° shutter (`--shutter 270`); past about 130 px a frame make the move a cut (`velCut`).
- `--motioncheck` reads the page at the output fps: a stall is a held or dropped frame, a hitch a step far bigger than its neighbours (a state jump, an ease that snaps), and both exit 1. Run it with looks off; its judder index compares versions of the same page (lower is evener).
- **Chrome snaps canvas text to whole pixels vertically**, so type that settles or drifts slowly up or down steps (the check reports stalls). Move such text with `smoothText` (a cached sprite that resamples smoothly). Read live clocks and digits through `onFrame(t)` so the blur can't smear them; let the cursor and everything else blur.
- Lay out with `W`, `H` and `S` so other sizes work; vertical usually needs the screen cropped to its task and the text smaller.
- Feather hard-edged wipes; their edge bands under blur.
- **At least 2 review rounds.** Each round: a contact sheet (`ffmpeg -i final.mp4 -vf fps=2,scale=320:-1,tile=6x6 sheet.jpg`), the spectrogram, and a **fresh critic** subagent that hasn't seen the build (give it the MP4, `treatment.md` and `brand.md`; ask for ranked problems with timestamps and fixes). Fix, re-render, repeat.
- Loops: `node render.mjs --loopcheck` must say "closes".
- Music: `VIDEO.music = 'music.mp3'` only for a track the user supplied or has licensed; otherwise the synthesised bed or SFX alone.

## Bulk
For several products (a list of repos or URLs, or `~/Movies/promos/queue/<slug>/brief.md`), run one background subagent per product, at most 3 at a time, each with the full text of this file, its paths and the formats to ship. Each reports the `final*.mp4` paths, the brand elements it found, what it had to guess and its weak spots. Finish with one contact sheet per video and a summary table.

## Limits
- **Render time is the bottleneck?** For a NEW piece that doesn't need this skill's templates or toolkits (no footage, no type.js/look.js/sfx.py devices) and is long, batch-rendered or shader-heavy, [fframes](https://github.com/dmtrKovalenko/fframes) (MIT; Rust + SVG on the GPU) renders far faster than headless Chrome. Ask the user first: it needs the Rust toolchain (`rustup`, plus a first build of about a minute prebuilt or ~20 min from source), then `npx skills add https://fframes.studio` installs its own skill, which you then follow. Otherwise stay on render.mjs. Trade-offs: the README's "fframes or render.mjs?" table.
- Canvas 2D; `iso.js` for isometric solids and the flat → oblique lift.
- No voiceover by default. For narration, use the `story-video` skill's Chatterbox run inside `python3 ~/.cache/claude-s/ttslock.py`, then pass it as `vo` (sfx.py ducks the music and levels every SFX against it).
- Don't use other companies' logos or customers' names as endorsements unless they appear on the product's own public site.
