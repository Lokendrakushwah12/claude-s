---
name: explorable-explainer
description: Build an interactive "explorable explanation" page that teaches how something works (a machine, mechanism, natural process, protocol or algorithm) as a long-form essay with numbered, animated line-art figures the reader drives with sliders, toggles, step-throughs and live readouts. The house style comes from the "How do bike gears work?" artifact: a dark technical-manual look, serif prose, monospace FIG_00x panels, and white line drawings with hatching and leader-line labels. It is published as a claude.ai Artifact. Use whenever the user wants an explainer, an interactive article, an animated diagram, a Bartosz Ciechanowski or Distill-style piece, "an artifact like the bike gears one", or asks "how does X work" and wants it visual or animated, even if they never say "explorable".
---

# Explorable explainer: one question, answered with figures you can play with

The reference is https://claude.ai/artifact/Ez6BXp1sGc4fCEGihotM61 ("How do bike gears work?"). It is a calm essay that stops every few paragraphs for a figure, and each figure lets the reader move one thing and see what changes. **Take its techniques, not its figures.** Every new topic gets figures invented from its own parts, its own numbers and its own motion. A lock explainer that ends up looking like the bike one with gears swapped for pins has failed.

## Setup
```bash
D=~/PersonalFiles/explainers/<slug>; mkdir -p "$D" && cp ~/.claude/skills/explorable-explainer/template/index.html "$D/"
```
- **The template** holds the design tokens (dark first, light too), the figure panel markup, the controls, shared hatch patterns and arrowhead, and a small `fig()` helper. FIG_001 is an example lever. Read the file once, then replace the example.
- **The Artifact tool** expects `artifact-design` to be loaded before you write the page, so load it. Precedence: the user's words come first, then this skill, then artifact-design's defaults. Two places where this skill wins:
  - **The look.** The user picked this look, so its "avoid near-black" advice and its light-first token order don't apply. The template is dark-first on purpose.
  - **Checking.** Step 7 replaces its "check once, then publish" rule. An explorable is mostly behaviour, so every figure gets driven.

## 1. Pin the question and the facts
- **Title:** the question the reader would type, e.g. "How does a pin tumbler lock work?". It is also the `<title>`.
- **Dek:** one or two concrete sentences that name the parts and the payoff ("A chain, a few dozen toothed discs and a pair of cables…").
- **Reader:** a curious non-expert who has used the thing but never looked inside it.
- **Numbers:** collect the real ones (dimensions, counts, ratios, forces, timings) and search the web when unsure. Never invent a statistic; say "about" when estimating. Declare the constants once at the top of the script and compute every readout from them, so the prose and the figures can't disagree.

## 2. Outline: a chain of questions
- Every `h2` is the next question a curious reader would ask, ending in "?" ("Where does your push go?", "What does a gear actually change?", "How can you coast?").
- The usual order is:
  1. What's there: an anatomy figure that names every part used later.
  2. Where the force or data flows.
  3. What the key variable changes.
  4. Why that matters in real conditions.
  5. Each sub-mechanism in turn, zooming inwards.
  6. The clever bit.
- Each section makes one claim. It gets a figure only when the mechanism is hard to assemble from sentences.
- **Size:** budget about 350 words of prose per figure.
  - **A full piece:** 6–10 figures.
  - **"Quick" or "short":** 3–4 figures.
  - **"Around N figures":** N figures.
  - **"Not a wall of text" or "animated":** lead with figures, 5–7 of them, with prose kept to about 250 words each.
- If the user is around, show the outline and the figure plan before building. Otherwise carry on.

## 3. Figure plan
Write one line per figure:

`FIG_00n [ bracket caption ] | the claim | pattern | the one control | readouts`

Each figure gets one claim, one control (or none) and up to three readouts. Two controls means two figures.

| Pattern | What it shows | How it's driven | Used in the reference for |
|---|---|---|---|
| Exploded ↔ assembled | Anatomy, what fits where | A slider from 0 to 1, plus hover labels that fill a hint line | The drivetrain |
| Relay with spotlight | A causal chain, step by step | Auto-advance plus a clickable numbered step list. The active part has a dashed ring, the rest fade, and a readout says "now at X" | The push travelling from pedal to road |
| Parallel lanes | One variable's effect | No control: the same input runs through N lanes, and marks drop at each cycle with dimensioned gaps | Three bikes in three gears |
| Stuck vs adaptive | Why the mechanism matters as conditions change | Runs on its own, with live gauges and status chips per agent and a trace chart below | One-gear rider vs a shifting rider on a hill |
| Discrete pick + counters | A ratio or proportion | Segmented buttons, with counters that tick up as it runs | A chain wrapping 11, 21 or 34 teeth |
| Conserved quantity | A trade-off | A slider. Two hatched shapes keep the same area while their proportions change | Push × distance = the hill's pull × distance |
| Chart of every option | The whole design space | Hover a bar to read it; the legend uses hatch vs outline | All 24 gear ratios |
| Assemble → move loop | How one part is built | Runs on its own in a loop: apart, together, flexing | Chain links |
| Zoom inset | A hidden internal part | A dashed callout from the detail out to a section view, with a together / pulled-apart toggle | The freehub inside the hub |
| Unroll, then re-roll | A circular mechanism | A mode toggle plus state readouts ("pawl lifted · clicks 3"). Show it straight first, then bent back into the ring | The ratchet |

Invent at least one figure that is not in this table and that only this topic could have.

## 4. The look
- **Monochrome.** Ink lines on a near-black panel, or on paper in the light theme. There is no accent colour. Show state with:
  - inversion (the active button is filled with ink)
  - a dashed spotlight ring
  - fading inactive parts to `.muted`
  - hatching or stipple on the part that matters
- **Line art:**
  - Strokes are 1.25px and don't scale.
  - Give parts the `.solid` fill so near parts hide far ones.
  - `.hatch` and `.dots` are for shaded faces and cut sections.
  - `.dash` / `.guide` are for alignment lines, motion paths and travel arcs.
  - Use `iso()` for 3D objects and flat side or end views for mechanism detail. One drawing never switches projection mid-figure. Two linked panels side by side are fine (a globe and its sky plot), with the main one on the left.
  - Mirror a view when the natural layout puts the action on the right (a key entering from the right), so phones see it without scrolling.
  - For a cut section with holes (a housing with drilled chambers), draw the hatch as one `path` with `fill-rule="evenodd"`: the outer outline plus each hole as a subpath. Stroke the outlines separately. `.solid` only hides fills, never strokes.
- **Labels:** lowercase mono on a leader line that ends in a dot on the part (`label()`). An optional dim second line carries a fact ("34 teeth"). Bold the same word in the prose where it first appears, so the text and the drawing use the same name.
- **Chrome:**
  - The header has `FIG_00n` on the left and `[ lowercase caption ]` on the right.
  - The footer has a dim serif caption that says how to read the figure, then the mono control row. Readouts are a dim label with an ink value in tabular numbers.
  - Use letter suffixes (`FIG_009A`, `B`, `C`) for one mechanism shown in successive views.
- **Motion:**
  - Slow enough to follow, and the caption says so if it's slowed down.
  - Ease in and out, hold about 1 s on key states, and loop without a jump.
  - Every figure shows a meaningful still frame at load, which is also what `prefers-reduced-motion` readers see.
- Use colours only through the tokens and classes. Never put a hex value in JS or SVG, or the light theme breaks.

## 5. Voice
- Open with the reader's own experience, in the second person: "You have probably changed gear thousands of times without thinking about it."
- Use short declarative sentences and plain words. Tie each number to an everyday comparison ("about 70 N, the weight of a bag of sugar").
- Set up each figure in the sentence before it ("Below are three bikes pedalled at exactly the same pace…") and interpret it after ("Same legs, same cadence, completely different bikes.").
- State surprises flatly: "Of 24 combinations, only about 17 are meaningfully different."
- No hype, no "let's dive in", no em-dash asides, no bullet-list summaries, no recap ending. End on the one thing the reader now sees differently.

## 6. Build
```js
fig('f3', { w: 720, h: 360, s: { t: 2.4, gear: 34 },   // s = state; its starting values are the still frame
  build(svg, s, out) { /* create elements once and return refs; attach hover/click handlers here */ },
  draw(r, s, out)    { /* only set attributes from s; out('ratio', x.toFixed(2)) fills [data-o="ratio"] */ },
  tick(s, dt)        { s.t += dt; } });   // optional; runs only while on screen and motion is allowed
```
- **The still frame:** put it in `s`. Start `s.t` at a telling moment (a pulse in flight, the plug half turned), not at an empty `t = 0`. Values in `s` win over the HTML control values.
- **Controls** are plain HTML in the footer, bound by `data-k`:
  - `<input type=range data-k>` gives a number.
  - `<div class="seg" data-k>` with buttons gives the clicked button's `value`, as a number when it looks like one.
  - Give each range an `id` and an `aria-label`, and each `.seg` group an `aria-label`. The buttons don't need ids.
- **Autoplay that hands over to the reader:** controls follow `s` after every draw, so `tick` may move a slider or step a `.seg` list on its own. The first time the reader touches any control, `s.touched` becomes true. Guard the autoplay with `if (!s.touched)`. The template's lever does this.
- **Helpers:**
  - `el`, `set`: create and update SVG elements.
  - `lerp`, `clamp`, `ease`: interpolation.
  - `iso(x,y,z)`: isometric projection.
  - `rot(x,y,cx,cy,deg)`: rotate a point.
  - `phase(t, [beats])`: which beat of a loop t is in, for scripted sequences.
  - `label(g, text, sub, anchor)`: build a label once in `build`, then place it in `draw` with `.at(px, py, tx, ty)` (a dot on the part, then the text). Its line meets the side of the text facing the part. Pick `anchor` by where the text sits: `'start'` right of the part, `'end'` left of it, `'middle'` above or below.
  - **Hover hints:** give the footer a `<span class="hint" data-o="hint">`, and on a label set `onmouseenter = () => out('hint', '…')`. Anything only shown on hover must also be in the caption or the prose.
  - `STILL.matches`: true for reduced-motion readers. Check it in `draw` before animating a one-off transition.
  - If two figures need the same new helper, add it to the helpers block.
- Build elements in `build` and only mutate them in `draw`. Rebuilding many nodes every frame stutters, and so does calling `getBBox` inside `tick`.
- The stage keeps a 34rem minimum width and scrolls sideways inside the panel on phones. Put each figure's main action in its left two-thirds so a phone shows it without scrolling.
- Build one figure at a time, and look at each before starting the next.

## 7. Check
The browser pane can't inspect `file://` tabs, so serve the folder. Run `preview_start {name: "explainers"}`. If the project's `.claude/launch.json` has no `explainers` config, add one first: `runtimeExecutable` `python3`, `runtimeArgs` `["-m", "http.server", "8740", "--directory", "<the explainers folder>"]`, `port` 8740. Then open `http://localhost:8740/<slug>/` and check:
- `read_console_messages` with `onlyErrors` returns nothing.
- Every figure: scroll it into view, screenshot it, drive its control through its range, and screenshot again. Labels that move need the closest look; most collisions in testing were a moving label crossing a line or another label. Give a moving label a lane of its own.
- The light theme: `document.documentElement.dataset.theme = 'light'`. Look for anything still drawn in the dark palette.
- `resize_window` mobile: `document.documentElement.scrollWidth === innerWidth`, the controls wrap cleanly, and the main action is visible.
- The prose numbers match the readouts.

Fix what you find and check again. Reset the viewport to desktop when you're done.

If there's no browser pane, headless Chrome still gives you a real render of the whole page to look at:
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=900,9000 \
  --virtual-time-budget=4000 --screenshot="$D/page.png" http://localhost:8740/<slug>/
```

## 8. Publish
Publish with the Artifact tool:
- `file_path`: `$D/index.html`.
- `icon`: one generic word (`diagram`, `gear`, `lock`).
- `description`: one sentence.

Keep the file. Republishing the same path in the same conversation updates the same URL. In a later conversation, pass the artifact's `url`.

## Problems seen so far
- **`file://` tabs are opaque:** the console, JS and page reads all refuse a local file. Serve over http (step 7).
- **Phone emulation shows the desktop layout** if the page has no viewport meta. The template carries one with `viewport-fit=cover`; keep it.
- **Screenshots can lag** a JS change (a theme switch or a slider set by script) by a frame. Take a second screenshot before deciding something is broken.
- **Slider end labels wrapped** to two lines on phones. `.range` is `nowrap` now; keep end labels to one or two words.
- **Garbled `·`, `°` and `µ`** (`Â·`, `Â°`) on the local preview: `http.server` sends no charset. The template now starts with `<meta charset="utf-8">`; keep it.
- **Leader lines ran into their own text** and the dim second line. `label()` now ends the line at the side of the text block that faces the part; pick the anchor by where the text sits.
- **Step lists and autoplay sliders couldn't follow the figure,** so runs kept shadow state and grabbed buttons by hand. Controls now follow `s` after every draw. Drive them from `tick` until `s.touched`.
- **`.seg` values compared as strings** (`'3' !== 3`) and failed silently. They come through as numbers now when they look like one.
- **Local preview runs in quirks mode** because the page has no doctype (the publish adds one). The template's layout doesn't depend on it. If something looks off only locally, check the published page before "fixing" it.
