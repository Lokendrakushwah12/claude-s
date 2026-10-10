---
name: type-film
description: Make an ORIGINAL brand motion film (10–30 s) from one or more reference videos plus the brand's own site. It takes each reference's techniques (pacing, type behaviour, camera, texture), never its shots, and invents a new concept and shot list native to the brand's world. The brand's real logo, colours, fonts and copy are drawn as JS canvas animation with seek(t), scored with synthesised music and SFX, and rendered frame-exact to MP4. Styles so far: Swiss kinetic type (the Whop film), and cinematic narration with glass UI and a curved gallery (the Nexus launch and a portfolio reel). Use when the user shares motion references (x.com links, MP4s) and wants "one like this for <brand>", a brand film, launch video, motion-design reel, kinetic type piece or a new variant of an earlier one.
---

# Type film: references + brand → an original motion film

**References are ingredients, not scripts.** The first Keychain film reproduced its Whop reference shot for shot: the same 13 shots, in the same order, with the same compositions. The user rejected it for that. Every film must be a new idea, built from the brand's own world. The references only lend techniques.

## Setup
```bash
D=~/Movies/type-films/<slug>; mkdir -p "$D"/{assets,docs} && cp ~/.claude/skills/type-film/template/* "$D"/ \
  && cp ~/.claude/skills/music-video/template/{lib.js,render.mjs} ~/.claude/skills/promo-video/template/{promo.js,sfx.py} "$D"/
```
- **`type.js`:** the helper vocabulary. Read it once.
- **`examples/*.js`:** finished films, there to show how the API is used. **Never copy a scene from an example or a reference.**
- **`references.md`:** references that have already been deconstructed. Check it first and add to it.

## 1. Deconstruct each reference → `docs/grammar.md`
Use `x-video-frames` or ffmpeg to get frames at 2–4 fps, plus 8 fps sheets per 3 s segment. Measure the beat grid with librosa (`uv run` with `numpy librosa soundfile`).

Fill in a TAKE / LEAVE table per reference:
- **TAKE (transferable):**
  - average shot length and cuts per beat
  - how type enters and leaves
  - camera language and transition logic
  - palette *roles* (which colour is the ground, the text, the accent)
  - texture and lighting
  - sound feel
  - 1–2 signature techniques, described abstractly (e.g. "a concave wall that wraps the viewer")
- **LEAVE (recognisably theirs):** the shot order, compositions, specific set pieces, script and copy, metaphors, logo moments.

## 2. Find the brand's world → `docs/concept.md`
- **Objects:** from the site and the product, list 10+ objects, rituals and artefacts native to the domain. For Keychain: barcodes, lot codes, spec sheets, pouches, supplier profiles, factory floors, a chain of links.
- **Metaphor:** pick one core metaphor.
- **Logline:** write it in the brand's voice.
- **Story arc:** the film tells a story (hook → tension → product → proof → logo). It is not a tour of techniques.
- **Copy:** use real copy and real numbers only. Never invent stats or customers; use descriptors ("Co-packer · New Jersey") instead.

## 3. Invent the shot list → `docs/shotlist.md`
- **Formula:** write every shot as `technique (from TAKE) × brand object × real copy`.
- **Invention:** add at least 3 devices that appear in **no** reference and no earlier film in this folder, and mark them "new".
- **The same-sentence test:** no shot keeps a reference shot's composition *and* motion. If one sentence describes both your shot and a reference shot, redesign it.
- **Transitions:** build them from the story's objects, not generic wipes. For example, barcode bars fatten into the cut to black, or the final chain link closes into the logo.
- **Beat grid:** choose the BPM from the mood (brisk Swiss ≈150, cinematic narration ≈100). Every scene starts on a beat.
- **A variant of an earlier film:** list the earlier film's concept and devices first, then change the concept, the ground and lighting mood, the pacing, and at least 70% of the devices.
- If the user is interactive, show them the concept and shot list before building. Otherwise continue.

## 4. Build
- **Motion:** `spr track cam`.
- **Type:** `word ui rise riseChars scramble typed words` (words out of a blur).
- **Surfaces:** `grid hl glass keylight dust marks grain`.
- **Objects:** `arrow check marquee ring3d orbit tunnel guides barcode flap chain bend pointer`.
- **Layers:** `cached scratch`.
- **From promo.js:** `pill counter rrect glow`.

When you invent a device that could be reused, add it to `type.js` with a one-line comment, then record it in `references.md`.

Brand rules:
- **Colours:** take them from CSS variables (convert `hsl()` to hex) and logo pixels.
- **Fonts:** take them from `@font-face` / `next/font`, and use the nearest Google font if needed.
- **Logo:** use the SVG wordmark (make a white copy with `sed 's/fill="black"/fill="white"/'`). Redraw a geometric mark as canvas paths so it can assemble itself.
- **Pale accents** (yellow, lime) are never text on light grounds; use them only as fields there.

## 5. Critique: craft AND originality
```bash
node render.mjs --still <one t per shot, plus the transition midpoints>
(cd review && ffmpeg -loglevel error -y -pattern_type glob -i 't*.png' -vf "scale=480:-1,tile=6x5:padding=4" -frames:v 1 ../sheet.jpg)
node render.mjs --cues && uv run sfx.py && node render.mjs --out <slug>.mp4
ffmpeg -i <slug>.mp4 -vf "fps=1.5,scale=384:-1,tile=6x6" -frames:v 1 contact.jpg
for s in <transition times>; do ffmpeg -loglevel error -y -ss $s -t 0.7 -i <slug>.mp4 -vf "fps=13,scale=320:-1,tile=9x1" -frames:v 1 strip_$s.jpg; done
```
Look at every sheet at full size and at half-res 2×2 zooms. Score each of these 1–10:
- a hook in the first 2 s
- readability at phone size
- motion
- variety
- brand accuracy
- sound sync
- **originality**

To score originality, put your contact sheet beside each reference's sheet. Any shot that reads as "their shot" scores 4 or less and gets redesigned. Fix the 3 worst problems and do at least 2 rounds, until every score is 8+.

Problems these films actually had:
- **Stage lights:** striped volumetric beams looked like curtains (the user called them bad). Use one soft `keylight` plus `dust`.
- **Split-flap too slow:** it never settled. Keep the riffle ≤0.35 s and centre the word in its cells.
- **Transitions through gray:** a light/dark crossfade passes through mud. Hard-cut on the beat instead.
- **Text over a growing object:** narration drawn over something that grows gets eaten by it. Fade the words before the object arrives.
- **Overlapping meta labels:** measure widths before placing them.
- **Text overflowing a frame:** size the frame from the text.
- **Leftover word in a push:** the previous shot's word shows through a camera push. Fade it by `push*3`.
- **Colliding scatter rows:** advance each row by its descender plus the next row's cap height.

Only ship 9:16 or 1:1 if asked. Those formats need a re-layout, not a crop.

## Examples (to show the API, not to re-skin)
- **`examples/keychain-v1-swiss.js`:** Swiss kinetic type after Whop. It is too literal a copy of its reference, so keep it only as a demo of the Swiss helpers.
- **`examples/keychain-v2-cinematic.js`:** "Every product on the shelf started with someone who could make it." It opens with a barcode scan whose bars cut to black, then Keychain's real Generate Products prompt, a generated spec sheet with a drawn pouch, a curved supplier conveyor, a split-flap category board, a chain-of-links network and a final link that closes into the k mark.

## Limits
- Canvas 2D only: fake 3D comes from layers, strips and camera scale.
- There is no motion blur.
- Music is synthesised unless the user supplies a licensed track (`VIDEO.music`).
