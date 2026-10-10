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
| `kit.js` | `plot` (axes, curves, markers, bands), the panel (`header chip chipList readout legend`), chrome (`titleCard`, chapter label, end card, burnt-in caption) and the looks (`LOOKS`, `card`) |
| `audio.js` | the sound palette `SOUNDS`, the music bed, and `soundtrack()`, which renders the MP4's audio offline |
| `index.html` | the player. In a browser it plays with sound and narration; under `render.mjs` it renders frames and hands over the soundtrack |
| `narrate.mjs` + `tts.py` | records each caption with Chatterbox (or macOS `say`) into `voices/`, and writes each clip's real length to `voices/voices.js` |

Read `engine.js` and `kit.js` once before writing a lesson.

## Setup
```bash
D=~/Movies/explainer-lessons/<slug>; cp -R ~/.claude/skills/explainer-lesson/template "$D" && cp ~/.claude/skills/music-video/template/render.mjs "$D"/
```
Narration uses story-video's Chatterbox. If `~/.local/share/story-video/tts-venv` is missing, run `sh ~/.claude/skills/story-video/setup.sh` once. Without it, `narrate.mjs` falls back to `say`, which is fine for drafts and flat for a finished lesson.

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
- **The film makes room for the voice, never the other way round.** Write beat times for the picture and let the narration set the final length. `defineLesson` times each caption by its recorded clip's real length (or an estimate before `narrate.mjs` has run). Where a beat is too short for its sentence, the whole beat plays proportionally slower, so every motion in it still lines up with the words, and every later beat, cue and chapter moves with it. For a beat that ends by clearing the screen, set `hold: <script time>` on its caption instead: the beat runs at normal speed and rests at that moment, with the finished picture up, until the sentence is done.
- End on the rule the viewer should remember.

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
  pronounce?, music?,          // music: null for none; defaults to a quiet D-major bed
  poster?, eyebrowFrom?, end?, // the browser's first frame (2.5 s); when the chapter label appears (4 s); end card ({ at, title, sub } or false)
});
```
Every time in the spec is script time. The returned `LESSON` is in real time, after the narration warp.

- **The canvas is 960×540 units** (16:9), scaled to the output. Keep text at 16 units or more and important content inside a 40-unit margin. **Nothing the viewer must read goes below `SAFE_BOTTOM` (y = 420):** the captions are burnt in there. A plot with `y0: 372` keeps its axis labels clear.
- Use `theme.*` colours (`bg panel ink muted faint accent red blue teal amber`), never raw hex. They come from the look, in light or dark. `mix()` and `alpha()` need `#rrggbb`; they throw on anything else rather than paint black.
- `plot({ box, x, y })` returns `X`/`Y` (domain to canvas) plus `axes`, `curve` (draws on with `progress`, returns the tip), `marker` and `band`.
- The right-hand column: `header`, `chipList({ x, y, at, gap, items, color })`, `readout`, `legend`.
- `titleCard(ctx, th, t, [line1, line2], from, to)` opens the film. The chapter label, end card and caption are drawn for you.
- If a drawing or a beat would be copied into a second lesson, move it into `kit.js`. If it is topic-specific but repeats inside a lesson, make it one function driven by config, with its cues built from the same config.

### Motion that looks smooth
- Everything eases. Linear motion is only for constant flows (refrigerant in a pipe, a conveyor).
- Entrances fade and rise 8 to 12 units with `ease.back`. Exits are faster than entrances.
- Overlap beats by 0.2 to 0.4 s so nothing starts from a dead stop, and give idle things tiny life (`Math.sin(t * 2) * 2`).
- Move the eye to one place at a time. Dim what isn't being discussed (`globalAlpha` 0.3).

### Sound design
- Every visible event that lands (a pop-in, a part clicking into place) gets a short cue at the same `at`: `pop`, `blip`, `snap`, `thud`, `tick`. Continuous motion (a line drawing on, a curve sliding) gets `rise`, `slide` or `whoosh` lasting as long as the motion (`len`). End a beat that resolves an idea with a `chime`.
- Keep the music bed quiet (`gain` about 0.05 to 0.08), in one key, with slow chord changes. It glues the beats together under the voice.
- To add a sound, add a function to `SOUNDS` in `audio.js`: build nodes with `tone` or `noise`, start them at `when`, and return them so the browser player can stop them on pause or seek.

### Art direction (before drawing anything)
A lesson that looks like every other lesson looks machine-made. Give each one its own identity:
1. **Pick a look** to suit the topic (`mood` on each entry in `LOOKS`): `blueprint` for machines, circuits and flow; `chalkboard` for derivations, proofs and algorithms; `gouache` for physical things as warm objects; `riso` for comparisons, classifications and money. Try any lesson in another look with `?look=riso` in the browser. Don't give two lessons in a series the same look.
2. **Draw one signature illustration** that only this lesson has, and let the look carry it. The example's is the refrigerant loop: a house in section, snow outside, coloured refrigerant circulating through the evaporator, compressor, condenser and valve, turning hot at the compressor on the beat that explains it. Draw objects with `fillWith(ctx, colour, box)` or `blob()`, so the look's texture and light reach them.
3. **Give the frame life.** Looks add grain and motes. Add small idle motion to the illustration itself, always as a pure function of `t`.
4. **A new look is a new entry in `LOOKS`**, never one-off colours inside a lesson: a palette for light and dark, a backdrop, grain, stroke, fill and Google fonts. Keep ink and muted at 4.5:1 contrast on `bg` and `panel`, accent at 3:1 on `bg`, and red, blue and teal at 3:1 on `panel`.
5. **Coloured text goes on cards** (`card()`, or a `pill`). On a textured backdrop only `ink` and `muted` text is reliably readable.

## 4. Narrate
```bash
node narrate.mjs             # Chatterbox when installed, else `say`; only changed lines are recorded again
node narrate.mjs --redo 3,7  # re-roll lines 3 and 7
node narrate.mjs --check     # also transcribe every take with Whisper, printed under its script line
```
It prints every line with its length and flags the suspicious ones: a take under 0.7 s is usually clipped, and one far longer than expected repeated words or stalled. You can't listen, so run `--check` before calling the narration done; a missing or invented phrase in "heard" means a re-roll. Whisper tiny mishears some words itself ("vapour" came back as "paper"), so judge whole phrases, not spellings. Change the delivery with `STYLE` in `tts.py` (exaggeration 0.5 is neutral; a lower `cfg_weight` speaks slower), or clone a voice with `REFERENCE`. Re-run after any caption's words change. A caption with no clip is read by the browser's voice in preview and is silent in the MP4 (the render warns).

## 5. Check it (don't skip this)
```bash
node render.mjs --still <the middle of every chapter>                       # light: review/t*.png
node render.mjs --still <same times> --query theme=dark                     # dark: review/theme=dark-t*.png
open index.html                                                             # play it with sound and narration
node render.mjs --out <slug>.mp4                                            # the soundtrack is mixed in automatically
ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 <slug>.mp4
ffmpeg -loglevel error -y -i <slug>.mp4 -vf "fps=1/3,scale=480:-1,tile=6x6" -frames:v 1 contact.jpg
```
- Chapter times move once the narration is recorded: read the real ones in the browser's HUD (or `LESSON.chapters`) before picking still times. The planning estimate (2.6 words a second) is slow for Chatterbox, which reads about 3.4: the example planned at 105 s and came out at 82 s. Judge the length after narrating, not before.
- Look at every still in both themes: overlaps, clipped text, a label sitting on a line, a colour you can't read, anything below y = 420 that matters.
- Ask the user to play it once with sound (the MP4, or `index.html` in Chrome). Every cue should land on its visual, and every sentence should finish before the next caption. Sync is exact by construction; what a listen catches is a bad take or a cue that sounds wrong for its moment.
- The MP4's video and audio durations should match (within a frame or two), and the contact sheet should show no dead stretches.
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

## Limits
- 16:9 only: the lesson is laid out in 960×540 units. A vertical cut needs its own layout.
- Canvas 2D: fake depth with layers, scale and shading.
- Chatterbox adds an inaudible watermark, is slow (see above), and its model is a few GB on first use.
- For maths-heavy derivations on a video channel, Manim is the standard tool; this engine is for mechanisms, curves and processes.
