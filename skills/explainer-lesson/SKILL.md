---
name: explainer-lesson
description: Make a narrated, animated explainer for one hard concept (physics, engineering, computer science, finance, biology, medicine) as a frame-exact MP4. Every frame is drawn on a canvas as a function of time, every sound is synthesised, and a local AI voice reads the captions, all on one clock, so picture, sound and narration stay locked together. The same folder plays live in a browser for review. Use whenever someone asks for an explainer video, an animated lesson, "explain X in a video", a mechanism, cycle or curve animated with narration, or changes to a lesson made before (a folder with lesson.js).
---

# Explainer lesson: one hard concept → a narrated MP4

A lesson is one file, `lesson.js`. It holds a timeline (chapters, captions, sound cues) and a `scene()` that paints the film for any time `t`. Everything else is shared, so the lesson holds only what is specific to its topic. The method comes from Kevin Ngo's Opus shorts: one HTML page with a canvas and scripts, no media files.

`template/` is a working lesson. **Copy it; don't rebuild it.** The creative work goes into `lesson.js`.

| file | what it is |
|---|---|
| `lesson.js` | **the lesson**: `defineLesson({...})` with its storyboard, numbers and drawings. The example explains why a heat pump delivers more heat than the electricity it uses; replace it |
| `engine.js` | time (`span life pulse stagger seq`), `ease`, colour (`mix alpha onColor`), drawing (`text pill path arrow dashed circle blob fillWith roundRect at`), narration timing, `defineLesson` |
| `kit.js` | `plot` (axes, curves, markers, bands), the panel (`header chip chipList readout legend`), the data story (`callout countAt countCues route clockPill lift grade highlight`), chrome (`titleCard`, chapter label, end card, burnt-in caption) and the looks (`LOOKS`, `card`, `settle`) |
| `audio.js` | the sound palette `SOUNDS`, the music bed and its level under the voice, and `soundtrack()`, which renders the MP4's audio offline and masters it to −14 LUFS |
| `index.html` | the player. In a browser it plays with sound and narration; under `render.mjs` it renders frames and hands over the soundtrack |
| `narrate.mjs` + `tts.py` | records each caption with Chatterbox (or macOS `say`) into `voices/`, and writes each clip's real length to `voices/voices.js`. It also checks the takes and the finished mix with Whisper |

Read `engine.js` and `kit.js` once before writing a lesson.

## Setup
```bash
D=~/Movies/explainer-lessons/<slug>; cp -R ~/.claude/skills/explainer-lesson/template "$D" && cp ~/.claude/skills/music-video/template/render.mjs ~/.claude/skills/type-film/template/iso.js "$D"/
```
`iso.js` is type-film's canvas isometric camera, which `lift()` uses. A lesson that never lifts doesn't need it.
Narration uses story-video's Chatterbox. If `~/.local/share/story-video/tts-venv` is missing, run `sh ~/.claude/skills/story-video/setup.sh` once. Without it, `narrate.mjs` falls back to `say`, which is fine for drafts and flat for a finished lesson. When other sessions may narrate too, run it under the shared lock: `python3 ~/.cache/claude-s/ttslock.py node narrate.mjs`.

## Why it stays in sync
1. **One clock.** In the browser, `t` comes from `AudioContext.currentTime` and the picture is redrawn from it every frame. In the MP4, frame `i` is drawn at exactly `t = i / fps`, and the soundtrack is rendered offline on the same timeline. Visuals never keep their own timer.
2. **Draw from `t`, never from the previous frame.** `scene` must be pure: the same `t` gives the same picture. No `x += v`, no `Math.random()` (use `rand(seed)`), no `Date.now()`. That is what makes seeking, pausing and frame-by-frame rendering work.
3. **Sounds are scheduled, not fired.** Cues sit on the timeline in seconds. In the browser a lookahead scheduler books them about 150 ms ahead on the audio clock (`osc.start(when)`), as in web.dev's "A Tale of Two Clocks". For the MP4, `soundtrack()` books every cue, the music and each narration clip into an `OfflineAudioContext`, which starts each one on an exact sample. Never use `setTimeout` for sound.
4. **One list of numbers.** Put a beat's time in a `const` (`const SQUEEZE = 27`) and use it in both the drawing and the cues. A picture event and its sound can't drift if they read the same number. When a list of things pops in with `stagger`, give its `at` and `gap` to `seq()` for the sounds.

## 1. Pick the concept and check the facts
- Pick something people get wrong or find hard: a mechanism (a heat pump, a transistor), a curve (compound interest, a dissociation curve), a process (TCP's handshake, the Krebs cycle), a rule with a surprising cause.
- **Check every number you draw against two sources**, and list them in `sources` (`defineLesson` complains with fewer than two). Use a standard textbook for the field, then a second textbook, a standards body, a government or agency report, or a review paper. OpenStax covers most of school and university science for free. Where sources disagree, draw the value both support, or say so in the caption.
- Keep curves and values to scale: write the real equation (the example's ceiling is `(TH + 273.15) / (TH - tc)`), not a curve that merely looks right. A wrong number in a lesson does harm.

## 2. Storyboard before code
**Length follows depth; there is no cap.** A single idea with one graph runs 60 to 120 s. A cycle or a process with several stages runs 3 to 6 minutes, and a whole system can run 10 minutes or more. Budget 20 to 40 s per idea, and put a chapter every 30 to 90 s (`defineLesson` complains about a chapter longer than 3 minutes).

One line per beat, with times. The shape of a short lesson; longer ones repeat the middle for each stage:
```
0-10   hook: the thing, big and simple, as a question or a surprise
10-35  mechanism: why it happens, built up piece by piece
35-50  the model: the number, the equation, the graph
50-70  the twist: what changes it, the limit, the case people get wrong
70-80  recap: the rule to remember, two or three takeaways
```
- **One idea per beat.** Build a diagram up in steps; never show everything at once.
- **Captions are the narration.** Each caption is read aloud the moment it appears, at a natural pace. Write them to be heard: short sentences, under about 18 words. Where the written form reads badly aloud (a formula, a symbol), give the caption a `say`. Shared spellings for the voice (°C, kWh, −, ÷, ≈) live in `SAY` in `engine.js`; a lesson adds its own terms with `pronounce` (the example says COP as "C O P").
- **Cut to the voice (a VO-led edit).** Write the script first and narrate it early. Then put each beat on the word it illustrates: `narrate.mjs --check` prints when every word starts in its take, so a beat is `C[i] + 2.86`, where `C[i]` is its caption's start and 2.86 s is where "hash" falls. Give each caption a slot at least as long as it takes to read (3.2 words a second) and to say (its clip plus 0.35 s). A shorter slot gets stretched, and stretching pulls every beat in it off its word.
- **The film makes room for the voice, never the other way round.** Write beat times for the picture and let the narration set the final length. `defineLesson` times each caption by its recorded clip's real length (or an estimate before `narrate.mjs` has run). Where a beat is too short for its sentence, the whole beat plays proportionally slower, so every motion in it still lines up with the words, and every later beat, cue and chapter moves with it. For a beat that ends by clearing the screen, set `hold: <script time>` on its caption instead: the beat runs at normal speed and rests at that moment, with the finished picture up, until the sentence is done.
- End on the rule the viewer should remember.

**A data story** (a number, a structure, a system) has its own shape, taken from the Claude Motion launch:
```
0-10   the claim as a number, on a scoreboard the film comes back to: what it costs the usual way
10-25  the plan: the data drawn flat, as it's stored; one route through it
25-30  an instrumental breath: an empty caption while the plan lifts into 3D on the same coordinates (swell under it)
30-45  routes and counts: routes draw with travelling dots, and callouts tick their counts (the count is the proof)
45-55  the payoff: a 0.45 s gap of silence, then the number lands on a subBoom; then make it hold as the scale changes
55-60  the rule, then an echo tail instead of a stinger
```
- **A first-person persona works.** Let the thing explain itself: "I'm a hash table. Give me a million names…" It gives the voice a stake, and every comparison becomes a claim the film has to prove. The persona may only use real features and real numbers.

## 3. Write `lesson.js`
```js
const LESSON = defineLesson({
  title, look, theme,          // look: a key of LOOKS; theme: 'light' or 'dark' for the MP4
  duration,                    // seconds, script time: the end of the last beat
  chapters: [{ at, title }],   // first at 0, ascending; drives the chapter label
  captions: [{ at, text, say?, hold? }],   // first at 0, ascending; each shows until the next; end with { at, text: '' }
  cues: [{ at, sound, gain?, pitch?, len? }], // any order; sound is a key of SOUNDS
  sources: [],                 // two or more
  scene,                       // ({ ctx, t, theme }) => void; the backdrop is already painted
  pronounce?, music?,          // music: null for none; defaults to a quiet D-major bed; { bpm, chords, instrument: 'mallet', lift }
  voice?,                      // 'typed': no narration; captions type on at 37 characters a second and hold about 3 s
  poster?, eyebrowFrom?, end?, // the browser's first frame (2.5 s); when the chapter label appears (4 s); end card ({ at, title, sub } or false)
});
```
Every time in the spec is script time. The returned `LESSON` is in real time, after the narration warp.

- **The canvas is 960×540 units** (16:9), scaled to the output. Keep text at 16 units or more and important content inside a 40-unit margin. **Nothing the viewer must read goes below `SAFE_BOTTOM` (y = 420):** the captions are burnt in there. A plot with `y0: 372` keeps its axis labels clear.
- Use `theme.*` colours (`bg panel ink muted faint accent red blue teal amber`), never raw hex. They come from the look, in light or dark. `mix()` and `alpha()` need `#rrggbb`; they throw on anything else rather than paint black.
- `plot({ box, x, y })` returns `X`/`Y` (domain to canvas) plus `axes`, `curve` (draws on with `progress`, returns the tip), `marker` and `band`.
- The right-hand column: `header`, `chipList({ x, y, at, gap, items, color })`, `readout`, `legend`.
- `titleCard(ctx, th, t, [line1, line2], from, to)` opens the film. The chapter label, end card and caption are drawn for you.
- The data story: `callout(ctx, th, t, { from, to, a, label, value | count })` is a label on a leader line from the thing it belongs to. A `count` (`{ at, dur, from, to, exp }`) ticks; `exp` counts in equal ratios, so 1 → 500,000 still reads as counting. `countCues(count, 'tick')` gives the matching cues. `route(ctx, th, t, pts, { p, dots })` draws a journey with a dot riding its tip. `lift(p, { pin, to })` returns `P(x, y, z)`: at p 0 it is the plan exactly as you drew it, and at 1 it is an oblique view of the same coordinates, so a box with its top at z = h rises out of the plan. `ISO.slab` and `ISO.face` draw with its camera `C`. `clockPill` shows time passing; `grade(ctx, colour, k, mode)` washes the frame (night → dawn); `highlight` swipes a marker over words; `settle` drops a paper card the way graphite's cards land.
- If a drawing or a beat would be copied into a second lesson, move it into `kit.js`. If it is topic-specific but repeats inside a lesson, make it one function driven by config, with its cues built from the same config.

### Motion that looks smooth
- Everything eases. Linear motion is only for constant flows (refrigerant in a pipe, a conveyor).
- Entrances fade and rise 8 to 12 units with `ease.back`. Exits are faster than entrances.
- Overlap beats by 0.2 to 0.4 s so nothing starts from a dead stop, and give idle things tiny life (`Math.sin(t * 2) * 2`).
- Move the eye to one place at a time. Dim what isn't being discussed (`globalAlpha` 0.3).

### Sound design
- Every visible event that lands (a pop-in, a part clicking into place) gets a short cue at the same `at`: `pop`, `blip`, `snap`, `thud`, `tick`, `uiBlip`, `thock` (a pitched key; pitch can carry meaning), `ticks` (a scramble). Continuous motion (a line drawing on, a curve sliding) gets `rise`, `slide` or `whoosh` lasting as long as the motion (`len`). End a beat that resolves an idea with a `chime`.
- Weight and air, ported from promo-video's `sfx.py`: put `subBoom` on the reveal (the hard cut into the number). `suckIn` *ends* on its cue, so put the cue on the key word, not before it. `swell` (70 Hz plus air) goes under a dimensional shift. In graphite, use `scratch` as a line draws on (give it `len`) and `tap` as a card lands.
- Foley for objects, and not every click: one sound per thing that moves.
- Keep the music bed quiet (`gain` about 0.05 to 0.08), in one key, with slow chord changes. It glues the beats together under the voice.
- **Music rules, from the Claude Motion launch:**
  - Use a soft mallet bed at 80–90 BPM (`instrument: 'mallet'`), and let the voice lead the edit: beats follow the words, not the bar lines.
  - The bed sits under the voice and comes up about 7 dB (`lift`) only in pauses of 2 s or more. An empty caption makes that pause: an instrumental breath, which is the place for the lift.
  - Put a `gap` cue on the payoff. It gives 0.45 s of true silence first, so keep the narration and other cues out of that window.
  - End on an `echo` cue rather than a stinger: the bed stops there, and its last note repeats on dotted eighths, 4 dB quieter and darker each time. Leave about 4 s after it.
- To add a sound, add a function to `SOUNDS` in `audio.js`: build nodes with `tone` or `noise`, start them at `when`, and return them so the browser player can stop them on pause or seek.

### Art direction (before drawing anything)
A lesson that looks like every other lesson looks machine-made. Give each one its own identity:
1. **Pick a look** to suit the topic (`mood` on each entry in `LOOKS`): `blueprint` for machines, circuits and flow; `chalkboard` for derivations, proofs and algorithms; `gouache` for physical things as warm objects; `riso` for comparisons, classifications and money; `graphite` for algorithms and step-by-step mechanisms as a notebook sketch; `hairline` for data stories and devices in plan and isometric. Try any lesson in another look with `?look=riso` in the browser. Don't give two lessons in a series the same look.
   - **graphite** was measured off a hand-drawn stop-motion explainer: paper #ECECE6 darkening 19 % into the corners, double-pass pencil lines, 45° hachure, colour only in thin blue and red pencil and a highlighter, cards with hard shadows that drop in turned up to 8° (`settle`), and captions on taped paper slips. Its `stop` setting makes the film stop-motion: drawings held at 12 fps, three drawings boiling, ±1.5-unit whole-pixel jitter and ±1.2 % flicker. Fills are knockouts (paper inside, colour in the lines), so text on a shape is ink. The hand fonts come in one weight; keep text at 400–500.
   - **hairline** is pale paper with four greys and one ink accent. There are no fills: a shape is the ground with an outline, and colour marks the one thing being discussed. Line weights are scaled to 0.55. It pairs with `lift` and `ISO.slab`.
2. **Draw one signature illustration** that only this lesson has, and let the look carry it. The example's is the refrigerant loop: a house in section, snow outside, coloured refrigerant circulating through the evaporator, compressor, condenser and valve, turning hot at the compressor on the beat that explains it. Draw objects with `fillWith(ctx, colour, box)` or `blob()`, so the look's texture and light reach them.
3. **Give the frame life.** Looks add grain and motes. Add small idle motion to the illustration itself, always as a pure function of `t`.
4. **A new look is a new entry in `LOOKS`**, never one-off colours inside a lesson: a palette for light and dark, a backdrop, grain, stroke, fill and Google fonts. Keep ink and muted at 4.5:1 contrast on `bg` and `panel`, accent at 3:1 on `bg`, and red, blue and teal at 3:1 on `panel`.
5. **Coloured text goes on cards** (`card()`, or a `pill`). On a textured backdrop only `ink` and `muted` text is reliably readable.
6. **Typed captions** (`voice: 'typed'`) suit a silent piece. Each caption types on at 37 characters a second and holds for about 3 s, so each beat lasts its typing time plus 3 s. A soft tick sounds per word, and `narrate.mjs` has nothing to record.

## 4. Narrate
```bash
node narrate.mjs             # Chatterbox when installed, else `say`; only changed lines are recorded again
node narrate.mjs --redo 3,7  # re-roll lines 3 and 7
node narrate.mjs --check     # also transcribe every take with Whisper, printed under its script line, with each word's start
node narrate.mjs --mix <slug>.mp4   # after the render: what the finished mix says under each caption
```
It prints every line with its length and flags the suspicious ones: a take under 0.7 s is usually clipped, and one far longer than expected repeated words or stalled. You can't listen, so run `--check` before calling the narration done; a missing or invented phrase in "heard" means a re-roll. Whisper tiny mishears some words itself ("vapour" came back as "paper"), so judge whole phrases, not spellings. A homophone that Whisper trips on will trip a listener too ("halve it" came back as "have it"), so reword it. Change the delivery with `STYLE` in `tts.py` (exaggeration 0.5 is neutral; a lower `cfg_weight` speaks slower), or clone a voice with `REFERENCE`. Re-run after any caption's words change. A caption with no clip is read by the browser's voice in preview and is silent in the MP4 (the render warns).

## 5. Check it (don't skip this)
```bash
node render.mjs --still <the middle of every chapter>                       # light: review/t*.png
node render.mjs --still <same times> --query theme=dark                     # dark: review/theme=dark-t*.png
open index.html                                                             # play it with sound and narration
node render.mjs --out <slug>.mp4                                            # the soundtrack is mixed in automatically
ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 <slug>.mp4
ffmpeg -hide_banner -nostats -i <slug>.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -12   # I ≈ −14 LUFS, peak ≤ −1 dBFS
ffmpeg -loglevel error -y -i <slug>.mp4 -vf "fps=1/3,scale=480:-1,tile=6x6" -frames:v 1 contact.jpg
node narrate.mjs --mix <slug>.mp4
```
- Chapter times move once the narration is recorded: read the real ones in the browser's HUD (or `LESSON.chapters`) before picking still times. The planning estimate (2.6 words a second) is slow for Chatterbox, which reads about 3.4: the example planned at 105 s and came out at 82 s. Judge the length after narrating, not before.
- Look at every still in both themes: overlaps, clipped text, a label sitting on a line, a colour you can't read, anything below y = 420 that matters.
- Ask the user to play it once with sound (the MP4, or `index.html` in Chrome). Every cue should land on its visual, and every sentence should finish before the next caption. Sync is exact by construction; what a listen catches is a bad take or a cue that sounds wrong for its moment.
- The MP4's video and audio durations should match (within a frame or two), and the contact sheet should show no dead stretches.
- The soundtrack is mastered to −14 LUFS under a −1 dBFS ceiling. That fixes the whole film, not its balance: check a breath against a spoken passage (cut each window out of `audio.wav` and run it through `ebur128`). The breath should come up but stay a few LU under the voice.
- `--mix` should hear every line, complete and under its own caption. A word on the edge of two captions can be filed under the wrong one, because Whisper's word times run about 0.3 s early.
- Keep renders in the lesson's folder under `~/Movies/explainer-lessons/`, next to the source, so later changes are a re-render.

## Problems seen so far
- **Faked bold:** a bare Google Fonts family serves only weight 400, so text at 500 and 700 came out synthesised. The page asks for `:wght@400;500;700` and loads every weight before `ready`.
- **Hard-edged glow:** a radial gradient filled into a rectangle showed the rectangle's top edge. Clip a glow to the shape it lights.
- **An arrow ran into a label:** the big "heat" arrow ended on the "Inside · 20 °C" label. Check where every moving thing ends, not just where it starts.
- **Badges between the blocks:** the "?" badges used a hand-copied position formula and landed between the kWh blocks. Compute a position from the same helper that draws the thing (`blockX`): one list of numbers applies to space too.
- **"−0 °C":** a readout animating from 0 °C to −15 °C showed "−0 °C" on its first frame. Round before choosing the sign.
- **Dead frames between beats:** the first chapter's machines faded out before the house started drawing, leaving an empty frame. Start the next beat 0.3–0.5 s before the last one has gone.
- **Ghosts under the end card:** the end card is 92% opaque, so the recap showed through it as faint text behind the title. Fade content out before the end card arrives.
- **An empty hook:** the first 3 s showed the title over nothing. Bring the first picture in under the title.
- **A hot master:** the first mix peaked at −0.2 dBFS. The soundtrack now has a −1 dBFS ceiling; the example lands at −14.4 LUFS, with the voice about 10 LU above the effects.
- **Chatterbox slows down over a run:** the example's first lines took 10–30 s each and its last ones about 3 minutes, with no change in the text. Budget 15–20 minutes for a dozen lines, and start narrating before you polish the pictures.
- **Progress-bar spam:** Chatterbox prints a tqdm bar per token. `narrate.mjs` sets `TQDM_DISABLE=1`.
- **Fast takes, stretched beats:** the hash-table lesson's takes ran at about 4.3 words a second, faster than the 3.2 a second a caption needs to be read. Reading time set every slot, and the warp stretched each beat by up to 19 %, so every picture landed late on its word. Size each slot to max(reading, clip + 0.35 s), then place beats on the word times.
- **Words that run together:** "a plain list" came back as "a playlist". Chatterbox ran the two words into one, and a listener would hear the same thing. "A simple list" came back clean.
- **Whisper invents speech over music:** over the echo tail it "heard" the last line again. `--mix` runs with VAD.
- **A bed that pumps:** lifting the music in every pause between lines made it swell after each sentence. It now lifts only in pauses of 2 s or more.
- **A breath louder than the voice:** the first `swell` (from sfx.py's levels) made the breath 3 LU louder than speech. It is now 9 dB lower, and the breath sits 3.5 LU under the voice.
- **A label off the frame:** `callout` picked its side automatically and flipped a count off the left edge. Alignment is now explicit (`align: 'right'`). A leader from above stops over the label instead of running through "looks".
- **A route over its own delivery:** the dashed route to drawer 11 crossed "Ada" once she landed. Fade a route as the thing it carries arrives.
- **3D too small to read:** at az 14 and el 42, the names on the drawer tops were specks. az 8, el 50 and 15-unit text keep plan text readable after the lift.
- **"500,001":** (N + 1) / 2 rounded up. Show the number the narration says ("half a million").
- **Grainy cards:** cards carried the gouache grain over graphite's clean paper. Their grain now follows the look's.
- **Stop-motion offsets sound from picture:** sounds land on the exact clock while the picture steps at 12 fps, so a hit can lead its drawing by up to 83 ms. Put cues on the 12 fps grid if it matters.

## Limits
- **Render time is the bottleneck?** For a NEW piece that doesn't need this skill's templates or toolkits (no footage, no type.js/look.js/sfx.py devices) and is long, batch-rendered or shader-heavy, [fframes](https://github.com/dmtrKovalenko/fframes) (MIT; Rust + SVG on the GPU) renders far faster than headless Chrome. Ask the user first: it needs the Rust toolchain (`rustup`, plus a first build of about a minute prebuilt or ~20 min from source), then `npx skills add https://fframes.studio` installs its own skill, which you then follow. Otherwise stay on render.mjs. Trade-offs: the README's "fframes or render.mjs?" table.
- 16:9 only: the lesson is laid out in 960×540 units. A vertical cut needs its own layout.
- Canvas 2D: depth comes from iso.js (orthographic: `lift`, `ISO.slab`) or from layers, scale and shading. There's no perspective camera.
- Chatterbox adds an inaudible watermark, is slow (see above), and its model is a few GB on first use.
- For maths-heavy derivations on a video channel, Manim is the standard tool; this engine is for mechanisms, curves and processes.
