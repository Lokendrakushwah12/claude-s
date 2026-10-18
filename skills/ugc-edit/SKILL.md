---
name: ugc-edit
description: Edit talking-head, podcast or screen-recording footage into a creator-style cut for Reels, Shorts or TikTok, or a screen tutorial. Cuts land on the words, the camera never sits still, captions are a lead-in plus one hot keyword per phrase (off the face), every cut and keyword gets a sound over a ducked bed, and the cut exports as FCPXML and EDL. It drops false starts and retakes, keeps laughs and renders A/B hooks. It mixes in product demos (a proof card that takes over as the app on a real 3D phone, the footage as a post inside a phone, code typed in an editor), reel hooks, chapter cards, riso posters and collections (stamps, polaroids, grids, mosaics) from photos or drawn. An aesthetic reel caption style (mixed-type words at the top, cover stickers with drawn arrows, pastel or notebook frames, a three-voice hook title) matches the "after" of a before/after edit. With no footage, it voices a script with Chatterbox and draws placeholder cams. Use when the user says UGC, talking head, podcast clip, reel or TikTok edit, "edit this video", "screen recording to tutorial", "remove the false starts", "hook variants", "export to Premiere/Resolve", "product demo in the UGC", "collection images", "make it look like this aesthetic reel", a before/after edit, or shares a UGC or reel reference.
---

# UGC edit: footage + its words → a creator cut

> Part of claude-s. When a job needs parts from other skills, read `../claude-s/SKILL.md`: which skill leads, and what the others lend.

Every time in the edit comes from the transcript, so `edit.json` names words, never seconds. `edit.py build` turns those words into cuts, `video.js` draws each frame as a function of t (footage frames are pre-extracted JPEGs), and `render.mjs` renders it frame-exact. Sound comes from the same timeline through sfx.py's `autocue`, so it can't drift.

- **`creator`:** talking head or podcast (reference group A). Cuts on the words, a camera that never stops, two-tier captions, inserts and the full SFX grammar.
- **`tutorial`:** a screen recording plus voice (group D). Two framings, fast spring zooms, an oversized cursor with click discs, typing sped up, and a dry voice with no bed.

## Setup
```bash
D=~/Movies/ugc-edits/<slug>; mkdir -p "$D" && cp ~/.claude/skills/ugc-edit/template/* "$D"/ && cp ~/.claude/skills/music-video/template/{lib.js,render.mjs} \
  ~/.claude/skills/promo-video/template/{promo.js,sfx.py} ~/.claude/skills/type-film/template/type.js "$D"/
```
Read the headers of `ingest.py`, `edit.py` and `video.js` once (and `reel.js` for the reel caption style). The type.js devices used here are `hotWord leadIn behind shotCam flash glowIn glitchBox screenInsert clickDisc dof montageFrames cutIndex pointer track`, and in reel mode `handleChip clipSheet serifStack scriptLine cutout loopArrow`; lib.js gives `phone3d` and `codeBlock`. look.js (film and screen looks) is off; add it to index.html only if the user asks for a look. For a cinematic grade on the footage itself run type-film's `sh grade.sh in.mp4 out.mp4 cream` (`umber alpine cream golden`; cream suits talking heads and interviews) before ingest.

## 1. Ingest → `src.json`
```bash
uv run ingest.py A.mp4 B.mp4                       # real footage; the first clip's audio is the master, others are synced by cross-correlation
uv run ingest.py --placeholder creator --script script.txt    # no footage: Chatterbox voice + drawn A/B/W cams with ground-truth mattes
uv run ingest.py --placeholder tutorial --script vo.txt       # no footage: voice + a drawn app recording, cursor logged separately
```
- **Transcript:** faster-whisper words (`small.en`; `WHISPER_MODEL` overrides it), silences over 0.35 s and fillers, printed one breath per line: `{dropped}`, `(filler)`, `(laugh: kept)`. Read it. Whisper gets a short disfluent prompt (never the script), so it writes the "um"s and restarts it otherwise smooths away.
- **Retakes:** a false start (up to 6 words said again within 1.5 s: "so the— so the thing") and a line said again within the next two lines both drop the earlier attempt; the last take wins. A `say` can't match a dropped word.
- **Laughs:** sound in a pause louder than this recording's floor + 10 dB (and within 15 dB of the voice) is re-heard on its own: no confident words means a laugh, which build keeps. Words means `UNHEARD`: speech Whisper skipped, so listen there. A `long word` warning marks a word that may hide a filler.
- **Faces:** each clip gets `src/<clip>.face.json` (MediaPipe BlazeFace full-range, 5×/s; placeholders write the true box).
- **Script file:** one take per line; `(0.9) text` raises the exaggeration. Chatterbox reads at about 4.5 words/s, so ~110 words gives a 28 s cut.
- **Lock:** Chatterbox always runs under `~/.cache/claude-s/ttslock.py`, because other agents narrate too.
- **Footage resolution:** it should be at least 1.5× the output; ingest warns when it isn't, because punch-ins will soften. Frames are pulled at up to 2× the output (a 4K clip at full size for a 1080 cut), Lanczos, JPEG q2, so a punch-in still downsamples.

## 2. Write `edit.json`, then `uv run edit.py build`
Before you plan the piece, run the creative method in `~/.claude/skills/type-film/creative.md` (20 concepts from the subject's own world, kill the first five, one "only this could exist here" invention).

The template `edit.json` shows every field once. A phrase is one caption line and, by default, one shot:
- **Words:** `say` is the words as spoken, matched to the transcript in order. Words in no phrase are cut. Fillers and false starts inside a phrase are cut, and the cut becomes a re-punched jump cut. `"retakes": false` (top level) keeps every take, for a line repeated on purpose. `laugh: false` cuts a laugh after the phrase.
- **Shot:** `cam` (A/B/W…) or `insert: {kind: card|screen|montage|rec|<project kind>}`. `cut: false` continues the previous shot.
- **Camera:** `z0 tau ax ay slide` (defaults 1.35, 0.4, 0.5, 0.4, ±0.02 W/s alternating). `pull` fires a keyword-triggered pull-back from 1.2 over 2.8 s. `push: 0` adds an accelerating push.
- **Captions:** `kw` is the one hot keyword. `behind` puts it behind the subject. `graphic` slams the keyword in on a cut at keyword + 0.15 s with thump-thump-boom. `caption: false` hides them. `kwY` and `leadY` pin them (and turn off face-safe placement). A keyword in digits ("40k") counts up over 0.4 s with ratchet ticks.
- **Word sounds:** `sfx: {"ship": "pop", "done": ["sting", 0.7]}` puts any sfx.py sound on that word. Onomatopoeia (boom, click, pop, ding, whoosh…) get one automatically in `creator`; `sfx: false` turns that off.
- **Moments:** `flash` (an exposure flash on the cut), `build` (a sub swell that stops dead on the cut), `hush` (the bed drops out under this phrase), `hold: 0.4` (keep more pause after it, for a punchline).
- **End card:** `end: {kind: end, text, sub, cta, dur}`: the wordmark on an accent glow, `cta` a pill under it.
- **Product mix (UGC + demo):** `ui: {name, handle, img, stat, label, text, rows, button}` puts a proof card under the chin (beside the speaker in 16:9). Its lead-in sits above it, and the card replaces the hot keyword. `takeover: true` flies the card onto the screen of the next phrase's `insert: {kind: "app", clickOn, toast}`: a real 3D phone (lib.js `phone3d`, 66 % of H in 9:16, 86 % at 0.68 W in 16:9) with the card as its app screen, `list: ["Title|sub", ...]` rows (else quiet skeleton rows) and a tab bar (`tabs`) under it, on a soft accent glow. The camera pushes 1.3x onto the card, the rows tick, a touch disc taps the button, and the toast lifts out of the phone as a crisp card (1.15x the screen width, opaque at once, its number counting up) while the phone defocuses (0.9 % of W) and dims to 55 %. The phrase's lead-in sits above the phone; the toast is its keyword. Without a takeover the phone rises in (0.55 s) with its yaw springing home. `device: "card"` keeps the old flat card. `pops: ["DM", {text, img}]` pops chips round the head. `out: "portal"` grows a circle of the next shot's ground out of the chest (or `at`) into the cut.
- **Footage in a phone:** `phone: true | "in" | "out"` on a cam phrase plays the footage inside a phone as a post (handle, caption, progress, a heart that pops in the accent on the keyword) over a blurred copy of itself; the captions move above it. `post` sets the post's own caption (else "♪ original audio"). `"in"` pushes through the screen (ease-in from 0.55 s before the cut, full cover 0.1 s before it, 8 motion-blur samples): the footage inside eases to 1:1 with the frame, so the next phrase on the same cam continues it at the same size (its z0 defaults to 1.08); the captions clear first. `"out"` pulls back into the phone over 0.45 s.
- **Code:** `insert: {kind: "code", src, hl, hlOn, title}` types `src` (lines with `\n`, indents free) in an editor on the brand ground, ending 0.3 s before the word `hlOn`, then lights line `hl` (0-based), punches in on it, and types `result` as a status row under a hairline (the payoff: "40,312 streaks reset"). Speed is fitted to the words (18-70 chars/s; the refs type a code card at ~25 and a CLI command at 50-60). Keep it to 2-6 lines of 20-40 characters: it has to read in under 2 s.
- **Reel grammar:** `focus` (the shot opens from a blur) and `rack` (it blurs out). `lockup` stacks the words before the keyword small above it and the rest under it, then a glint sweeps it. `caption: "word"` (or top-level `"captions": "word"`) shows one word at a time. Top-level `"captions": "reel"` is a caption style of its own (see "Aesthetic reel captions"). `window` shrinks the footage into a window over giant spoken words. `laugh: "type"` types a kept laugh huge.
- **More inserts:** `stat {value, label, bar}` counts a number up and lands it with an echo. `chapter {n, over, word, sub}` is a list card, and the bed changes on it. `posters {items: [{title, sub, big}], hold}` flips a riso poster series 0.4 s apart. `collection {style: stamps|polaroids|grid|mosaic, images, items, step, title}` lands items one by one: `images` are photos or `"clip.mov#2.5"` (a frame of a clip, tone-mapped when HDR), `items` are drawn as riso art when there are no photos, and `step: "words"` lands one item on each word. These inserts carry their own type, so they get no captions unless `caption: true`.

What `build` does for you:
- **Cut points:** `cut = next word − 0.08 s`; into a `graphic` phrase, the picture cuts at its keyword + 0.15 s.
- **Pauses:** pauses over 0.35 s shrink to 0.12 s after the voice actually ends, plus 0.08 s before the next word. Everything snaps to 30 fps.
- **Outputs:** `dialogue.wav` (the pieces with 5 ms fades, lightly compressed) and frames at 2× the output (capped at the source) in `frames/sNN/`.
- **Report:** it prints the ASL, the fillers, retakes and laughs, and the words it cut. Read it every time.
- **Export:** `edit.fcpxml` (FCPXML 1.10, the format Final Cut Pro and Resolve import) and `edit.edl` (CMX 3600, which Premiere, Resolve and Avid import), so a person can polish the cut. V1 holds the camera shots, with inserts and the end card as named gaps; A1 holds the dialogue from the master audio; there's a marker per phrase. build parses both back and stops if a clip is off by a frame. HDR clips point at their SDR conform.

Edit rules:
- **Pace:** ASL 1.2–2.2 s. Cut A/B/W on phrase boundaries and never hold one framing for more than ~2.5 s.
- **Fast creator cut (measured 2026-10-18 on two 220–226 wpm reels, `type-film/references.md`):** 77–89 cuts/min counting jump cuts, hard shots 1.2 s median (1.55–1.85 s mean), 0.66–0.77 s between any two cuts. 90 % of cuts sit within 150 ms of a word: half 0–150 ms before its onset (median −44 to −60 ms), half 0–200 ms after (median +50 ms). Build a caption word by word as jump cuts 0.04–0.08 s apart (12 in 0.9 s) on one key line, not every line. When the voice names a device ("cut, transition"), show five cuts in 0.7 s with a click each, then hold 0.9 s. Hook shots land zoomed in and settle out 20–33 % at ~26 %/s; body shots push in 6–12 % over the shot. Glue: a sub_boom on the 1–2 hook cuts, swoosh/click on graphic cuts, a 0.3 s light leak (`filmBurn`) or white dip (`flash`) between sections, `matteCut` when a hand or object crosses the lens, `lutStab(c, 'xray')` for 1–2 frames on a reveal.
- **Keywords:** one per phrase, the word that carries the meaning (an object or a verdict, not "the").
- **Inserts:** one for each abstract noun (question → a card, "one button" → a screen insert, "six months" → a montage), at most one montage, and 2–4 inserts in 30 s. An insert cuts in ahead of its word.
- **A reel's shape:** a hook in the first 3 s (focus-in, a lockup or a statement word, a proof card or counter within 0.3 s, the face on screen); a calm body (word or two-tier captions, a gentle camera); a `chapter` card per list item.
- **A product moment:** speaker → card under the chin → takeover → `app` in the phone (tap, the toast lifts out) → back to the speaker, or into a `phone: "in"` post that pushes through to the speaker.
- **Project inserts:** add them at the bottom of video.js as `INSERTS.<kind>(c, t, s, o)`, plus `SOUNDS.<kind>(s, o, ev, sfx)` for its UI sounds. Draw them as concepts from the brand's own world. Never reuse a reference's metaphor (no iceberg).

## 3. Camera, captions, look
- **Zoom ceiling:** a punch-in magnifies the source. Keep a phone's front camera at 1.3x or under; past that the wall and hair read soft even at 2x frames. To raise a face that sits low in frame, anchor the zoom low (`ay` 0.9–1.0) rather than zooming harder.
- **Camera:** footage is never still. Each shot zoom-settles `z = 1 + (z0−1)e^(−t/τ)` and slides. The frame is overscanned by `2·|slide|·dur` so an edge never shows.
- **Lead-in line:** about 46 px at 1080 wide, at 0.43 H. Words land on their onsets in pre-spaced slots, and at the phrase end it un-types in reverse, a word every 2 frames.
- **Keyword:** 800 weight, cap height 0.11–0.2 W, at 0.56 H. It slides in with an expo ease, and each letter cools from the brand's accent to warm to white like a fuse. One accent per brand, and never the reference's mint green.
- **Behind the subject:** the keyword drops to jaw height (0.42 H) so the head hides its middle letters. At torso height the body hides it all.
- **Off the face:** per phrase, the face box goes through the shot's camera every 0.1 s. The lead-in + keyword block stays where the previous phrase had it if that's clear; else the house spot, below the chin, above the head, or as low as 0.76 H allows. A `behind` phrase moves only its lead-in, above the head first.
- **Safe zone:** the block stays in 0.14–0.76 H, clear of the platform's top bar and caption area.

## Aesthetic reel captions: `"captions": "reel"`
Use it when the user shares an "aesthetic" reel and says "make it look like this", when they want the "after" side of a before/after edit, or for a list reel (books, tools, products) where each item gets named and shown. Top-level `"captions": "reel"` swaps the house lead-in + keyword for `reel.js`; the cut, the camera engine and the sound engine stay. Without it, reel.js does nothing.
- **Captions:** 1-3 words at a time at the top of frame (0.115 H), each word springing in on its onset. Type is set per word with `st: {"word": style}`: `plain` (the default: the brand font, 800, tight, white), `chunk` (Fredoka 700, pale yellow with a brown drop), `spark` (Bodoni Moda with sparkle dots on its i and j), `ital` (Instrument Serif italic), `serif` (Gloock, a high-contrast display serif), `script` (Caveat, handwritten; pair it with a `serif` or `chunk` word for the mixed serif + script look), `label` (a name on a red stitched star, alone on its line), `tg` / `yt` (Telegram and YouTube logo chips). Style one or two words a phrase and leave the rest plain.
- **Text:** words show as written in `say`, with a sentence's opening capital lowered; names, acronyms and "I" keep their capitals. `show: {"word": "Display text"}` respells a word (Whisper's "Jason" for JSON) and `""` hides one, so `{"eloquent": "Eloquent JavaScript", "javascript": ""}` turns two spoken words into one label. Keys are lowercase words, and a key applies to every time that word comes up in the phrase.
- **Stickers:** `stk: [{img: "assets/cover.jpg", on: "word", side: "r" | "l", circle: [cx, cy, r]}]` springs a white-bordered photo (a book cover, a product) in on that word beside the face at 0.355 H, where it floats. `circle` crops a portrait to a disc round (cx, cy) with radius r, as fractions of the image. With one sticker, a hand-drawn arrow runs from the phrase's label to it. Images go in `assets/` and come from the user or a source you may use.
- **Real-photo cut-out stickers:** `uv run ~/.claude/skills/ugc-edit/template/stickers.py "iced coffee" "instant camera" --preview` writes a 6-candidate contact sheet per query to `assets/stickers/preview-<slug>.jpg` (each tile shows its licence); look, then `... "iced coffee" "instant camera" --pick instant-camera=3` lifts candidate 0 or the picked one to `assets/stickers/<slug>.png`, trimmed to the subject with a small margin (`--max 900` px). `--file photo.jpg` does the same for the user's own photos (no search, no credit). Use it as `stk: [{"img": "assets/stickers/iced-coffee.png", "on": "coffee"}]`: a PNG under `stickers/` (or `cut: true`) gets type.js `cutout`'s die-cut white border that follows the alpha instead of the rectangle.
  - **Batch clean-up of the user's own images:** `uv run .../stickers.py --batch ~/Pics --out ~/Pics/clean --report` turns every jpg/png/webp/heic in a folder (or listed files) into a trimmed die-cut PNG with the same base name: real alpha is kept, a plain border (white/grey/black studio or flat graphic) is colour-keyed in from the edge, anything else goes to Vision; edges are de-islanded, eroded 1 px, feathered and defringed. `report.csv` lists the method and kept % per file. Re-run a miss with `--method key|vision` or `--tol 8` (pale subject on a pale ground). Keep the user's collection local; never copy it into a repo.
  - **Licences:** search is Openverse with CC0, public domain and CC BY only (Unsplash photos mirrored on Wikimedia first, as story-video's fetch_assets.py); each is appended to `assets/stickers/CREDITS.md` (title, author, licence, source URL). CC BY needs the credit on screen or in the post caption; CC0 / PD need none. Never Pinterest or Google Images: those are other people's photos with no licence to reuse.
  - **Cut-out:** macOS Vision subject lifting (`lift.swift`, `VNGenerateForegroundInstanceMaskRequest`, macOS 14+, no download; compiled once to `~/.cache/claude-s/lift`). It lifts every foreground instance, so a cup in a hand comes with the hand: pick a candidate where the object stands alone. If Vision finds no subject (or not on a Mac), `--rembg` falls back to rembg (MIT) via `uvx --from "rembg[cpu,cli]" rembg i`, which downloads a ~170 MB model on first run: ask the user before passing it.
- **Ranking:** `rank: {"n": 1, "handle": "studio.name", "sub": "Studio Name", "avatar": "#5B3FD9"}` on a phrase puts type.js `handleChip` at the top: a big script numeral wiped on beside a dark glass chip with an avatar disc, the handle and a grey subtitle. That phrase's captions step aside (as the reference); `caption: true` brings them back. Use it for each item of a top-N list.
- **Cover:** top-level `cover: {"lines": ["I shot 6", "film", "cameras for", "a month"], "script": "here's the keeper", "props": ["laptop", "cup", "camera"], "accent": "#6F8A3A", "dur": 1.2}` lays a cover card over the `hook` phrases for their first `dur` seconds, built from frame 0 so it is the thumbnail: a gridded sheet in a binder clip (`clipSheet`), a giant condensed serif stack (`serifStack`), a script line (`scriptLine`), up to three drawn die-cut props (`cutout`: `cup camera laptop photo`) and a looping arrow (`loopArrow`). Write your own headline; never the reference's.
- **More pieces (type.js, for inserts or a custom overlay):** `mixWords` (a caption line in mixed fonts, each word on its onset), `serifSub` (elegant serif subtitles, a staggered two-line title), `scribble` (drawn underline, circle, zigzag, spark), `tornLabel` (torn paper strip with handwritten caps), `starConfetti` + `stripeMat` (the cream star ground and pinstripe "after" mat of a before/after). Gallery T127-T139.
- **Frame:** `frame: "blue" | "pink" | "mint" | "paper"` insets the whole picture, captions included, to 0.845 on pastel stripes or ruled notebook paper. Change it on section boundaries: it's the reel's chapter marker. A phrase without one plays full bleed.
- **Sections:** `big: true` on a section's first phrase ("So, for JavaScript,") gives every word its own group, chunk words at 1.4x and the camera at 1.3x.
- **Hook title:** top-level `hookTitle: ["first year", "CODE", "starter kit"]` stacks three voices over the `hook: true` phrases from frame 0 (the thumbnail): a small pink serif up left (Bodoni Moda 500), a huge pale-yellow rounded word (Fredoka 700) and a white script tucked under its right (Pinyon Script). Any voice can be `{text, font}` with a Google Fonts spec (`"Playfair Display:ital,wght@1,600"`); a long word shrinks to fit. Captions on hook phrases move down to 0.3 H. `hook` also makes build match those phrases first, which changes nothing for opening lines.
- **Camera:** held crops anchored low (`ay` 1.0, `tau` 99, so no settle), alternating 1.15x and 1.3x phrase by phrase with a slow ±0.006 W/s slide. Per-phrase camera fields still win.
- **Sticker library (347 die-cut stickers):** `~/.claude/skills/ugc-edit/stickers/s001.webp … s347.webp`, transparent lossless WebP. `manifest.json` gives each `{id, file, w, h, tags}`, so pick by word (`camera`, `star`, `speech bubble`, `film`, `text`…); the gallery's Stickers tab (`gallery/?view=stickers`) shows them all, searchable, and copies picks into the prompt. reel.js loads `stk` images only from the project's `assets/` (it strips `assets/` and fetches `assets/<name>`; an absolute path won't load), so copy the picks: `mkdir -p assets/stickers && cp ~/.claude/skills/ugc-edit/stickers/s012.webp assets/stickers/`, then `stk: [{"img": "stickers/s012.webp", "on": "camera"}]`. A `.webp` under `stickers/` gets the same alpha-following die-cut border as stickers.py PNGs (`cut: false` to drop it).
- **Sound:** no whoosh on a plain jump cut. There's a passby where the frame changes (with a sub into a `big` section), a blip on each label or chip, a bloop as a sticker lands and a glint on each spark word, at gain 1.8-2.4: at 1x they measured +0.1-0.5 dB over the voice (masked). review expects a sound only where the frame changes.
```json
"captions": "reel", "hookTitle": ["first year", "CODE", "starter kit"],
"phrases": [
 {"cam": "A", "say": "If you're learning to code this year", "frame": "blue", "hook": true, "st": {"code": "chunk"}},
 {"cam": "A", "say": "So, for JavaScript,", "frame": "pink", "big": true, "st": {"javascript": "chunk"}},
 {"cam": "A", "say": "the book everyone reads is Eloquent JavaScript.", "frame": "pink", "st": {"eloquent": "label"},
   "show": {"eloquent": "Eloquent JavaScript", "javascript": ""}, "stk": [{"img": "assets/eloquent.jpg", "on": "eloquent"}]},
 {"cam": "A", "say": "It's free to read online,", "st": {"free": "spark"}},
 {"cam": "A", "say": "and the course is on YouTube.", "st": {"youtube": "yt"}}
]
```

## 4. Sound: `node render.mjs --cues && uv run sfx.py`
`video.js` turns the timeline into `events` for `autocue` (sfx.py), with `vo = dialogue.wav`, so every cue is set by its family against the voice:
- **Plain cut:** `cut` → a passby peaking 50 ms before it.
- **Cut into or out of an insert:** `cut_insert` → a sub_boom plus a passby.
- **Keyword:** `keyword` → a suck_in ending on it. A `graphic` keyword gets thumps plus a boom (`keyword_stat`).
- **Flash:** flash_hit. **Build:** sub_swell ending on the cut.
- **Montage:** flash_hit in, sub_drop out.
- **Screen insert:** a key tap per character, a click, then a click_cluster when the results land.
- **Word sounds:** on the word's onset; a ratchet runs under a counting keyword. On a negative word, use `sfx: {"less": "deflate"}`.
- **Portal and items:** `portal` → a reverse_riser ending on the cut + a sub_boom. A collection item → a stamp, shutter or tick as it lands; bursts are thinned to one per 70 ms and taper to 0.5x, so a pile never gets louder. Pops → a bloop each; posters → a flick + paper tap per flip.
- **UI and chapters:** a `ui` card → blip_pop and a shine on its sweep, a tick per row; a lockup → a shine on its glint. The `app` click and toast play at gain 2 (about −8 dB), because the product is the focus; the toast lifting out adds a blip_pop. Code → a key tap per character, a shine when the line lights. A phone post → a pop on its heart; pushing through it → the portal's reverse riser and sub boom on the cut (a plain passby there measured +1.0 dB: masked). A chapter → the bed gaps 0.35 s, then switches section.
- **Levels:** sub +6 dB over the voice (below 150 Hz only), air and micro −14, music −12 with 8 dB of ducking. The master is −14 LUFS at −1 dBTP.
- **Bed:** a slow pad with a chord every ~3.6 s, the end card on a bar line and a riser into it. Override it with `"bed"` in edit.json, or `null` for none. A podcast with a beat bed sits ~9 dB under the voice, unducked: `"bed": {…, "levels": {"music": -9, "duck": 0}}`.

## Tutorial preset
- **Recording:** each phrase is a `rec` insert on the recording. `src: [a, b]` maps the phrase onto recording seconds; `[[u, sec], ...]` with u running 0..1 gives speed-ups and holds (typing at 6–8×, waits sped up).
- **Framing:** `frame: "full"` puts the window at 82 % of the width on the brand ground. `{zoom: 2–2.6, at: [x, y]}` punches in on that point, clamped inside the window. Framings change on sentence boundaries with a spring zoom (k 900, d 36: ~10 % overshoot, settled in ~5 frames).
- **Cursor:** comes from the recorder's log (`<clip>.cursor.json`: moves at 30 fps, plus clicks). It's drawn oversized (5.5 % of H full, 10 % in a punch-in), parked while typing, with a click disc.
- **Captions:** off. `title` on a phrase gives a chapter title at x 6 %, y 85 % on a dark plate.
- **Sound:** dry voice at −16 LUFS and a quiet click per click. No bed, and no SFX on cuts.
- **Recordings with a baked-in cursor:** skip the oversized cursor. You can't remove one that's in the pixels.
- **9:16:** that's a re-layout (the window large, captions on), not a crop of the 16:9.

## Render and review
```bash
node render.mjs --size 1080x1920 --out <slug>.mp4                   # 16:9 tutorials: --size 1920x1080
uv run edit.py review                                              # every cut has a sound, every sub on a cut, final mix transcribed back
node render.mjs --size 1080x1920 --still $(cat review/times.txt)   # each cut -2..+2 frames
(cd review && ffmpeg -loglevel error -y -pattern_type glob -i '1080x1920-t*.png' -vf "scale=200:-1,tile=5x20:padding=4" -frames:v 1 ../cuts.jpg)
ffmpeg -loglevel error -y -i <slug>.mp4 -vf "fps=1.5,scale=216:-1,tile=9x5:padding=3" -frames:v 1 contact.jpg
```
Look at `cuts.jpg` (one row per cut), `contact.jpg` and `review/spectrogram.png` yourself. Check that:
- every cut has a sound;
- every sub lands on a cut (a word's own sound is exempt);
- `masked:` lists cues that add under 1 dB over a no-SFX mix (0.5 for micro): heard as nothing;
- the voice word error rate is under 3 %; read each difference it lists;
- no keyword is hidden or clipped;
- nothing important sits in the top or bottom 15 %.

Fix, rebuild and look again.

## Hook variants (A/B the opening)
Put candidate opening lines in `"hooks"` (any line of the recording, as words or as a phrase object), then:
```bash
uv run edit.py hooks      # hooks/hN.mp4 = that line + the first "hookBody" (3) body phrases, each built and rendered in hooks/hN/
```
A hook that matches a body phrase takes its cam and keyword, and that phrase leaves the body. A hook on the same cam as the first body shot switches cams, because the join would be a jump. Pick hooks that stand alone: a claim, a number, a question.

## POV / jump-cut fast path (no canvas)
One locked-off clip, jump cuts on a song's 8th-note grid (cut = grid − 0.05 s), and one static caption (white semibold, a dark 2 px stroke, at 21 % of H). Make the "working" segments shorter each time and keep the "chill" segments long. No SFX.
```bash
echo '{"clip": "pov.mp4", "song": "song.m4a", "bpm": 130, "downbeat": 0.42, "caption": "pov: ...", "segments": [[0, 6], [3.1, 3], [5.0, 6], [8.2, 2]]}' > pov.json
uv run edit.py pov pov.json     # segments = [source in, length in 8ths]; trim + concat + a PIL caption overlay -> pov.mp4
```

## Limits
- **Three.js from the network:** a phone loads three@0.169.0 from jsdelivr at render time (like the fonts from Google). Offline, the page fails to boot; use `device: "card"`.
- **Mattes:** MediaPipe's selfie segmenter (`matte.py`) gives the person only, so props and mics in front stay behind the type. It also fails on drawn figures, which is why placeholders use their ground-truth matte.
- **Multicam sync:** cross-correlation of the audio envelopes. It needs every cam to have recorded sound.
- **Motion blur:** none on cuts (render with `--subframes` if needed). Meme and b-roll images must come from the user or `archive-footage`.
- **Captions:** only as accurate as the `say` text. The voice check catches what TTS or the transcript gets wrong. Chatterbox said the made-up brand "Slipway" so that it was heard as "Flipway".

## Problems seen so far
- **The edit clipped words:** Whisper ends the last word before a pause early, so cutting 0.12 s after it turned "silence" into "silen-" (the final mix was heard as "not silent"). Tails now follow the voice's energy.
- **Cuts went silent:** autocue keeps one air sound per 0.4 s and the earlier wins, so a keyword just before a cut silenced the cut's passby (3 of 20 cuts). video.js now drops a keyword's suck_in within 0.45 s before a cut.
- **The brand name was cut:** a misheard edge word ("Flipway") fell outside its phrase and was cut. Unmatched first and last words now claim the unclaimed word beside them.
- **A phrase can swallow a take:** a `say` that matches words far apart swallows everything between them. build warns when a phrase spans more than twice its written words.
- **Behind-type at torso height:** the body hid the whole word. Put it at jaw height.
- **A results list that never landed:** the screen insert's results blur in over 0.75 s, so a click on the phrase's last word meant they never resolved before the cut. Click on an earlier word, or `hold`.
- **Graphic keywords:** they slid in over 0.8 s and never slammed (now 0.18 s), and a montage exit stacked a second sub on their cut (the keyword now owns it).
- **Edge frames:** `ease.back(0)` returns −3e−15 and `arc()` throws on a negative radius (clamp radii); a shot can ask for frames past the clip's end (build counts what ffmpeg wrote, and the last frame holds).
- **Pale, yellow-green iPhone footage:** iPhone HDR (HLG, Dolby Vision) extracted without tone mapping looks pale and yellow-green. ingest (and `edit.py pov`) now tone-maps HDR clips to BT.709 (avconvert on macOS) before any frame is pulled.
- **A full-white strobe:** a B&W montage alternating white and black grounds at 10+ Hz strobes. The montage keeps dark grounds.
- **Whisper and its prompt:** the whole script as `initial_prompt` made it loop one line three times. With no prompt, `small.en` heard "So the— so the thing is" as "So the thing is", dropped both "um" and "uh", and stretched "in" to 0.96 s over the "um". A short disfluent prompt brings them back. faster-whisper drops the prompt after the first 30 s window, so ingest transcribes in windows of up to 28 s.
- **A laugh read as speech:** re-heard with the disfluent prompt, a laugh came back as "Like,". The re-listen uses no prompt, keeps only confident segments and ignores "T-t-t-t" gibberish.
- **Captions on the face:** BlazeFace short-range missed a face 15 % of the frame wide in 15 of 48 samples (full-range found all 48). At the fixed 0.43 H, the lead-in crossed a real speaker's eyes and the keyword her chin, and on placeholders the lead-in sat on the chin. Captions are now placed per phrase. A `behind` lead-in on her glasses now goes above the head.
- **Masked keyword sounds:** a keyword's suck_in under unbroken speech measured +0.0–0.4 dB: there but unheard. `masked:` lists them; give the keyword a pause (`hold` on the phrase before) or a `graphic` cut if it must be heard.
- **Export timecode:** avconvert drops the timecode track, so an HDR clip's SDR conform starts at 0. Relink to the original in the editor to grade the HDR. The export is checked structurally (xmllint, a DTD of the subset, read back with OpenTimelineIO) but not yet opened in Premiere, Resolve or Final Cut.
- **A caption layer that broke the toolkit:** the reel style began as a project file whose top-level `setFont` and `arrow` replaced type.js's, so any house title or insert drawn with them would have thrown. reel.js now runs inside a function and returns unless `captions` is `reel`. A proper-noun list hard-coded for one video became the `say` casing rule plus `show`.
- **Toolkit names clash:** lib.js already defines `cover()` and `PAPER`, and a second `PAPER` stopped the page booting. Check new globals against lib.js, type.js and promo.js.
- **The riso ghost was a cloud:** a canvas `filter` blur works in the layer's own pixels, so on the half-resolution ink layer it came out twice as wide. It's 0.7 % of the poster now. With `step: "words"`, a collection's title had no time on screen; it now comes in at least 1.05 s before the cut.
- **The portal:** drawn over the captions, it hid the keyword 0.1 s after it landed, and a dark disc growing out of the face read as a censor blob. It now draws under the captions, grows from the chest and has an accent rim.
- **Numbers counted as word errors:** Whisper writes "forty" as "40" and "twelve thousand" as "12 000", so a clean mix scored 5.2 %. review now compares numbers as numbers (0 %). An accent keyword in one-word captions vanished on dark clothes, so it's white at 1.25x now.
- **A stale phone screen:** the phone's screen canvas is redrawn every frame; a textAlign left over from the status bar shifted the app's text from the second frame on. phone3d now starts each frame from `ctx.reset()`.
- **Colours shifted in every MP4:** render.mjs piped BT.601 JPEGs into an untagged H.264, and browsers decoded it as BT.709: #00ff00 played as 0,216,0 and the accent's green channel moved 14 levels. render.mjs now converts to BT.709 limited range and tags it (max error 2-3/255).
- **The takeover popped:** the proof card and the app card differ in height, so the card now cross-fades into the app over the first 30 % of the move. The lockup glint's shine measured +0.4 dB (masked), so it plays at 1.8x.
- **Softer than the source:** a 4K iPhone talking head looked visibly blurrier in the 1080 cut than the original. Frames were pulled at 1.5× the output with bicubic and JPEG q3, the camera then zoomed 1.46x, and Chrome drew them with its default bilinear smoothing: each output pixel came from about one stored pixel, 14 % softer (Laplacian variance) than a straight Lanczos crop of the 4K frame. Frames now come at 2× (Lanczos, q2) and lib.js sets `imageSmoothingQuality = 'high'`: within 2 % of the ideal crop. Chrome's JPEG capture and x264 CRF 17 were measured too: PNG capture gave no gain after the encode (both 41 dB against the lossless frame).
