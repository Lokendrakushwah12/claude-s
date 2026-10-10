---
name: promo-video
description: Make a short, polished SaaS or product launch promo video (10–30 s motion graphics, like the one-shot Dub.co launch video) from a product's own repo or website. It uses the real logo, colours, fonts, copy and UI, recreated as JS canvas animation (rolling counters, self-drawing charts, glassy dashboard cards, fast one-word feature cuts, a logo end card with a CTA) with synthesised SFX and an optional music bed. Renders frame-exact MP4 in 16:9, 1:1 and 9:16. Handles one product or a batch. Use when the user asks for a promo, launch video, product teaser, showreel-style ad, social video for their app or site, or several of them.
---

# Promo video: product → 15 s launch MP4

The reference is the Dub.co launch video (Sept 2026). It was one-shotted from a two-sentence prompt run **inside the product's repo**. The prompt asked for a 15-second motion-graphics SaaS launch video that shows off like a motion designer's showreel. The repo is the whole trick: the agent had the real logo, brand colours, fonts, copy and UI components, so the video looked like *their* product, not a template.

It reuses the **music-video engine** (`lib.js` for scenes and helpers, `render.mjs` for headless-Chrome rendering). This skill adds `promo.js` (promo helpers), `sfx.py` (the sound) and a demo `video.js`.

## Setup per video
```bash
D=~/Movies/promos/<slug>; cp -R ~/.claude/skills/promo-video/template "$D" && cp ~/.claude/skills/music-video/template/{lib.js,render.mjs} "$D"
```
Read `lib.js` and `promo.js` once before writing scenes.
- **`lib.js` helpers:** `bg text kinetic cover prog ease rng wobble img`, plus `W`, `H`.
- **`promo.js` helpers:** `spring stagger card pill typewriter counter series lineChart glow mesh wipe withBlur rrect`.

## 1. Brand discovery (don't skip it; this is what makes it look real)
Work from the product's repo if there is one; otherwise from its live site. Collect into `brand.md`:
- **Logo:** an SVG from `public/`, `assets/`, `app/icon*`, a favicon, or an inline React logo component (copy its paths into a `.svg` file). Save it to `assets/logo.svg`.
- **Colours:** from the Tailwind config, CSS variables (`--primary`, `--brand`), the design-token files or the theme. Use hex only. Also record the dark and light background they actually use.
- **Fonts:** check `next/font`, `@font-face` and `font-family` in the CSS. If a font isn't on Google Fonts, pick the nearest one there and note it.
- **Copy:** the landing page hero, the tagline, 3–6 feature names, the CTA text and the domain. Use their words, not new marketing speak.
- **Product UI:** the 2–4 screens that best show the value, such as a dashboard, an editor or a checkout.
  - Either **recreate them in canvas** with `card`, `counter` and `lineChart`, which animate better and stay crisp.
  - Or screenshot them into `assets/` with `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --screenshot=assets/x.png --window-size=1600,1000 --hide-scrollbars <url>`, using the dev server or the live site. Then animate the screenshot inside a `card` with a push-in and highlight callouts.
- **Numbers:** plausible metrics for counters, like "1,284,093 clicks". Use their public stats if they exist; otherwise make them clearly illustrative and don't state them as facts in captions.

## 2. Storyboard (`treatment.md`)
15 s is about 8–12 shots. Here's a proven shape, with times for 15 s; scale it for other lengths:

| t | beat | example |
|---|---|---|
| 0–2 | **hook**: something typed or appearing, which creates curiosity | the URL types in; the caret blinks on the brand accent |
| 2–6 | **product moment**: the value shown working | a dashboard card springs in, the counter rolls, the chart draws, toasts pop in with stagger |
| 6–9 | **the second capability** | a network, integrations, avatars orbiting the logo |
| 9–12 | **rapid feature cuts**: one word per beat, each on its own colour field | "Short links." / "Custom domains." / "Conversions." |
| 12–15 | **end card**: logo lockup, tagline, CTA pill, domain | a mesh gradient in brand colours |

Craft rules (the "showreel" bar):
- Every shot moves. Nothing holds still for more than about 0.6 s.
- Enter with `spring` and `stagger`; exit fast.
- Use motion-blur entrances with `withBlur`, go into the next shot with a camera push instead of a cut where it helps, and match cuts on shapes (the logo circle becomes the globe).
- One idea per shot. The text is 1–4 words, huge, in the brand font with tight tracking.
- **Contrast rhythm:** dark → dark → light pop → colour → light end. Keep the brand accent for the hero moments.
- Use real UI density (small labels, secondary numbers, a live-looking feed), not empty rectangles.
- Add `sfx` cues as you design: a `tick` on typing, a `whoosh`/`swoosh` on transitions, `pop` for UI arriving, a `thud` on each feature cut, a `riser` before the end card and a `chime` on the logo.

## 3. Build → review → render
```bash
cd "$D"
node render.mjs --still 1,3,5,8,11,14     # look at every still; fix; repeat
node render.mjs --preview                 # motion check; pull frames at 4 fps to check timing and easing
node render.mjs --cues && uv run sfx.py   # audio.wav from VIDEO.sfx (+ VIDEO.music if set)
node render.mjs --out final.mp4           # 16:9
node render.mjs --size 1080x1920 --out final-9x16.mp4   # vertical, if asked
node render.mjs --size 1080x1080 --out final-1x1.mp4
```
- Lay out using `W`, `H` and `S = min(W, H) / 1080` so that other sizes work. Check stills in every format you ship; vertical usually needs the card stacked and the text smaller.
- Review honestly, at least 2 passes. For each still, ask: does it look like *this brand*? Is anything empty, misaligned or clipped? Would a motion designer ship it?
- Music: `VIDEO.music = 'music.mp3'` only for a track the user supplied or has licensed. Otherwise ship the SFX alone; the Dub-style videos work fine that way.

## Bulk
For several products (a list of repos or URLs, or a queue folder `~/Movies/promos/queue/<slug>/brief.md`):
- Run one background subagent per product, at most 3 at a time.
- Give each one the full text of this file, its paths, and the formats to ship.
- Each one reports: the `final*.mp4` paths, the brand elements it found and what it had to guess, and its weak spots.
- Finish with one contact sheet per video (`ffmpeg -i final.mp4 -vf fps=2,scale=384:-1,tile=6x5 sheet.jpg`) and a summary table.

## Limits
- Canvas 2D only: fake 3D with scale, parallax and a perspective-drawn grid or globe dots.
- No voiceover. For narration, use the `story-video` skill's Chatterbox setup, or ask.
- Don't use other companies' logos or customers' names as endorsements unless they appear on the product's own public site.
