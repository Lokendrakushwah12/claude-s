---
name: promo-video
description: Make a short, polished SaaS or product launch promo video (10–30 s motion graphics, like the one-shot Dub.co launch video) from a product's own repo or website. It uses the real logo, colours, fonts, copy, numbers and UI, recreated as JS canvas animation (a one-primitive visual vocabulary, the real screens in a player frame with a cursor walk-through, slot-list feature rolls, rolling counters, a logo end card with a CTA), scored with synthesised SFX and a music bed (or sonified UI). Renders frame-exact MP4 in 16:9, 1:1 and 9:16. Handles one product, an event promo, or a batch. Use when the user asks for a promo, launch video, product teaser, event or webinar promo, showreel-style ad, social video for their app or site, or several of them.
---

# Promo video: product → 15 s launch MP4

The reference is the Dub.co launch video (Sept 2026). It was one-shotted from a two-sentence prompt run **inside the product's repo**. The prompt asked for a 15-second motion-graphics SaaS launch video that shows off like a motion designer's showreel. The repo is the whole trick: the agent had the real logo, brand colours, fonts, copy, data and UI components, so the video looked like *their* product, not a template.

It reuses the **music-video engine** (`lib.js`, `render.mjs`) and the **type-film kit** (`type.js` devices, `look.js` looks, `iso.js` isometric). This skill adds `promo.js` (promo helpers), `sfx.py` (the sound) and a demo `video.js`.

## Setup per video
```bash
D=~/Movies/promos/<slug>; cp -R ~/.claude/skills/promo-video/template "$D" \
  && cp ~/.claude/skills/music-video/template/{lib.js,render.mjs} ~/.claude/skills/type-film/template/{type.js,look.js,iso.js} "$D"
```
Read `lib.js`, `promo.js` and the section headers of `type.js` once before writing scenes.
- **`lib.js`:** `bg text kinetic cover prog ease rng spring sketch`, `W`, `H`. `spring(p)` is the 0..1 UI entrance; `spring(t, [[t0, v0], [t1, v1], ...])` is a closed-form spring in seconds through targets (cameras, anything that changes target). Pure functions of t, never state carried between frames.
- **`promo.js`:** `stagger card pill typewriter counter series lineChart glow mesh wipe withBlur rrect`.
- **`type.js`:** `S` (= min(W, H) / 1080; don't redeclare it), `TYPE` (set the brand's fonts), `word ui rise scramble` and the devices below. `look.js` is off unless asked. `iso.js` draws isometric solids and the flat → oblique lift.
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
Write the brief first: one idea, the brand's **one primitive** (see 3), the real screens and the one task the cursor will do. Add a **banned list**: what this brand would never do (glass cards, mesh gradients, bouncy type, crossfades between shots, holds over 0.6 s, invented numbers, click sounds, a stinger, UI that isn't in the repo...). Then the **beat grid**: pick a BPM, put every shot, cue and section on it, and cut on the kicks. 15 s is about 8–12 shots:

| t | beat | example |
|---|---|---|
| 0–2 | **hook**: the primitive appears, or something types in | the mark draws itself out of a dot field |
| 2–6 | **product moment**: the value shown working | the real screen in a player frame; the cursor does the one task |
| 6–9 | **the second capability** | a slot-list roll of the real features with their real counts |
| 9–12 | **proof** | real numbers rolling, or the data itself drawn as the primitive |
| 12–15 | **end card**: a gap, then the logo, tagline, CTA, domain | the CTA collapses into the logo's origin |

Craft rules (the "showreel" bar):
- Every shot moves. Nothing holds still for more than about 0.6 s, except a deliberate held gap.
- Enter with `spring` and `stagger`; exit fast. Text is 1–4 words, huge, in the brand font with tight tracking.
- Go into the next shot with a camera move or a match cut on a shape, not a cut, where it helps.
- **Contrast rhythm:** dark → dark → light pop → colour → light end. Keep the accent for the hero moments.
- Real UI density (small labels, secondary numbers, a live-looking feed), never empty rectangles.

## 3. Devices and patterns (type.js unless noted)
- **One-primitive vocabulary** (Firecrawl): find the primitive in the mark (a square, a hub and spokes, a dot) and build the field, transitions, bullets, data and logo from it. `pixelField` (square dots in 4 opacity tiers: bloom, a hole for text, rings on beats), `cornerTicks` for small type in big space, chips that pop in with overshoot 80 ms apart, `tumbleTiles` (a deck fanning into a vortex), `asciiImage` (a 0/1 portrait).
- **Slot-list feature roll:** `slotList(c, items, x, y, slotStep(t))`: centre in ink, ±1 at 45 %, ±2 at 15 % and blurred, a step every 0.27 s; `counterRoll` for numbers.
- **Container continuity** (Claude Motion): one `player` frame on a desk hosts all the product UI, and moves of the frame (shrink to 0.6×, pan, push in) replace cuts. `skeletonFlash` as the UI loads (outline → block → content), `slitReveal`, `shutterButton` (bars close, the block morphs into the CTA), `sparkHop` (an agent visiting sources), `rewind` + `drawAt` (scrub-rewind of earlier shots), a tile burst with `sparkle` for exports, `pointer` + `clickDisc` for clicks.
- **Hero reveal** (Trenchers): words pop on hard ~0.17 s apart, a 0.33 s held gap where everything freezes, then the hero word, with the whole mix low-passed until it lands (`lp: [[0, 1800], [t - 0.02, 1800], [t, 20000]], lp_master: true`; at 4.5 kHz a dark arp barely changes, so nobody hears the reveal). Build with something dark (`sub_swell` + `glide_riser`) that stops where the picture freezes; a noise `riser` is brighter than the low-pass and gives the reveal away. **Screen as portal:** ease into an element, match its size across the cut, and grow the next world out of it on the same ground (no flash to white; bring a light surface in later, as a hard-edged shape from the element). Ending option: `crtCollapse` + `crt_off`, then silence.

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
node render.mjs --subframes 16 --out final.mp4         # motion blur; 4 strobes on fast camera moves (16x the render time)
node render.mjs --size 1080x1920 --out final-9x16.mp4  # only as a real re-layout; check its stills too
```
- Lay out with `W`, `H` and `S` so other sizes work; vertical usually needs the screen cropped to its task and the text smaller.
- Draw the cursor at whole-frame times (`Math.floor(t * 30) / 30`) so subframes leave it sharp, and size it by 1 / zoom. Push in until the text that matters is about 35–40 px on screen.
- A whip or a big zoom still strobes at 16: re-render just that window (`--from 8.5 --to 9.1 --subframes 48 --out seg.mp4`) and splice it in with ffmpeg `trim=start_frame/end_frame` + `concat`, keeping the full render's audio. Feather hard-edged wipes; their edge bands under blur.
- **At least 2 review rounds.** Each round: a contact sheet (`ffmpeg -i final.mp4 -vf fps=2,scale=320:-1,tile=6x6 sheet.jpg`), the spectrogram, and a **fresh critic** subagent that hasn't seen the build (give it the MP4, `treatment.md` and `brand.md`; ask for ranked problems with timestamps and fixes). Fix, re-render, repeat.
- Loops: `node render.mjs --loopcheck` must say "closes".
- Music: `VIDEO.music = 'music.mp3'` only for a track the user supplied or has licensed; otherwise the synthesised bed or SFX alone.

## Bulk
For several products (a list of repos or URLs, or `~/Movies/promos/queue/<slug>/brief.md`), run one background subagent per product, at most 3 at a time, each with the full text of this file, its paths and the formats to ship. Each reports the `final*.mp4` paths, the brand elements it found, what it had to guess and its weak spots. Finish with one contact sheet per video and a summary table.

## Limits
- Canvas 2D; `iso.js` for isometric solids and the flat → oblique lift.
- No voiceover by default. For narration, use the `story-video` skill's Chatterbox run inside `python3 ~/.cache/claude-s/ttslock.py`, then pass it as `vo` (sfx.py ducks the music and levels every SFX against it).
- Don't use other companies' logos or customers' names as endorsements unless they appear on the product's own public site.
