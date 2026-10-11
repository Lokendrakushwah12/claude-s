---
name: ugc-edit
description: Edit talking-head, podcast or screen-recording footage into a creator-style cut for Reels, Shorts or TikTok, or a screen tutorial. Cuts land on the words, the camera never sits still, captions are a lead-in plus one hot keyword per phrase (off the face), every cut and keyword gets a sound over a ducked bed, and the cut exports as FCPXML and EDL. It drops false starts and retakes, keeps laughs and renders A/B hooks. It mixes in product demos (a proof card that takes over as the app on a real 3D phone, the footage as a post inside a phone, code typed in an editor), reel hooks, chapter cards, riso posters and collections (stamps, polaroids, grids, mosaics) from photos or drawn. With no footage, it voices a script with Chatterbox and draws placeholder cams. Use when the user says UGC, talking head, podcast clip, reel or TikTok edit, "edit this video", "screen recording to tutorial", "remove the false starts", "hook variants", "export to Premiere/Resolve", "product demo in the UGC", "collection images", or shares a UGC or reel reference.
---

# UGC edit: footage + its words → a creator cut

Every time in the edit comes from the transcript, so `edit.json` names words, never seconds. `edit.py build` turns those words into cuts, `video.js` draws each frame as a function of t (footage frames are pre-extracted JPEGs), and `render.mjs` renders it frame-exact. Sound comes from the same timeline through sfx.py's `autocue`, so it can't drift.

- **`creator`:** talking head or podcast (reference group A). Cuts on the words, a camera that never stops, two-tier captions, inserts and the full SFX grammar.
- **`tutorial`:** a screen recording plus voice (group D). Two framings, fast spring zooms, an oversized cursor with click discs, typing sped up, and a dry voice with no bed.

## Setup
```bash
D=~/Movies/ugc-edits/<slug>; mkdir -p "$D" && cp ~/.claude/skills/ugc-edit/template/* "$D"/ && cp ~/.claude/skills/music-video/template/{lib.js,render.mjs} \
  ~/.claude/skills/promo-video/template/{promo.js,sfx.py} ~/.claude/skills/type-film/template/type.js "$D"/
```
Read the headers of `ingest.py`, `edit.py` and `video.js` once. The type.js devices used here are `hotWord leadIn behind shotCam flash glowIn glitchBox screenInsert clickDisc dof montageFrames cutIndex pointer track`; lib.js gives `phone3d` and `codeBlock`. look.js (film and screen looks) is off; add it to index.html only if the user asks for a look.

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
- **Footage resolution:** it should be at least 1.5× the output; ingest warns when it isn't, because punch-ins will soften.

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
- **Reel grammar:** `focus` (the shot opens from a blur) and `rack` (it blurs out). `lockup` stacks the words before the keyword small above it and the rest under it, then a glint sweeps it. `caption: "word"` (or top-level `"captions": "word"`) shows one word at a time. `window` shrinks the footage into a window over giant spoken words. `laugh: "type"` types a kept laugh huge.
- **More inserts:** `stat {value, label, bar}` counts a number up and lands it with an echo. `chapter {n, over, word, sub}` is a list card, and the bed changes on it. `posters {items: [{title, sub, big}], hold}` flips a riso poster series 0.4 s apart. `collection {style: stamps|polaroids|grid|mosaic, images, items, step, title}` lands items one by one: `images` are photos or `"clip.mov#2.5"` (a frame of a clip, tone-mapped when HDR), `items` are drawn as riso art when there are no photos, and `step: "words"` lands one item on each word. These inserts carry their own type, so they get no captions unless `caption: true`.

What `build` does for you:
- **Cut points:** `cut = next word − 0.08 s`; into a `graphic` phrase, the picture cuts at its keyword + 0.15 s.
- **Pauses:** pauses over 0.35 s shrink to 0.12 s after the voice actually ends, plus 0.08 s before the next word. Everything snaps to 30 fps.
- **Outputs:** `dialogue.wav` (the pieces with 5 ms fades, lightly compressed) and frames at 1.5× the output in `frames/sNN/`.
- **Report:** it prints the ASL, the fillers, retakes and laughs, and the words it cut. Read it every time.
- **Export:** `edit.fcpxml` (FCPXML 1.10, the format Final Cut Pro and Resolve import) and `edit.edl` (CMX 3600, which Premiere, Resolve and Avid import), so a person can polish the cut. V1 holds the camera shots, with inserts and the end card as named gaps; A1 holds the dialogue from the master audio; there's a marker per phrase. build parses both back and stops if a clip is off by a frame. HDR clips point at their SDR conform.

Edit rules:
- **Pace:** ASL 1.2–2.2 s. Cut A/B/W on phrase boundaries and never hold one framing for more than ~2.5 s.
- **Keywords:** one per phrase, the word that carries the meaning (an object or a verdict, not "the").
- **Inserts:** one for each abstract noun (question → a card, "one button" → a screen insert, "six months" → a montage), at most one montage, and 2–4 inserts in 30 s. An insert cuts in ahead of its word.
- **A reel's shape:** a hook in the first 3 s (focus-in, a lockup or a statement word, a proof card or counter within 0.3 s, the face on screen); a calm body (word or two-tier captions, a gentle camera); a `chapter` card per list item.
- **A product moment:** speaker → card under the chin → takeover → `app` in the phone (tap, the toast lifts out) → back to the speaker, or into a `phone: "in"` post that pushes through to the speaker.
- **Project inserts:** add them at the bottom of video.js as `INSERTS.<kind>(c, t, s, o)`, plus `SOUNDS.<kind>(s, o, ev, sfx)` for its UI sounds. Draw them as concepts from the brand's own world. Never reuse a reference's metaphor (no iceberg).

## 3. Camera, captions, look
- **Camera:** footage is never still. Each shot zoom-settles `z = 1 + (z0−1)e^(−t/τ)` and slides. The frame is overscanned by `2·|slide|·dur` so an edge never shows.
- **Lead-in line:** about 46 px at 1080 wide, at 0.43 H. Words land on their onsets in pre-spaced slots, and at the phrase end it un-types in reverse, a word every 2 frames.
- **Keyword:** 800 weight, cap height 0.11–0.2 W, at 0.56 H. It slides in with an expo ease, and each letter cools from the brand's accent to warm to white like a fuse. One accent per brand, and never the reference's mint green.
- **Behind the subject:** the keyword drops to jaw height (0.42 H) so the head hides its middle letters. At torso height the body hides it all.
- **Off the face:** per phrase, the face box goes through the shot's camera every 0.1 s. The lead-in + keyword block stays where the previous phrase had it if that's clear; else the house spot, below the chin, above the head, or as low as 0.76 H allows. A `behind` phrase moves only its lead-in, above the head first.
- **Safe zone:** the block stays in 0.14–0.76 H, clear of the platform's top bar and caption area.

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
- **Toolkit names clash:** lib.js already defines `cover()` and `PAPER`, and a second `PAPER` stopped the page booting. Check new globals against lib.js, type.js and promo.js.
- **The riso ghost was a cloud:** a canvas `filter` blur works in the layer's own pixels, so on the half-resolution ink layer it came out twice as wide. It's 0.7 % of the poster now. With `step: "words"`, a collection's title had no time on screen; it now comes in at least 1.05 s before the cut.
- **The portal:** drawn over the captions, it hid the keyword 0.1 s after it landed, and a dark disc growing out of the face read as a censor blob. It now draws under the captions, grows from the chest and has an accent rim.
- **Numbers counted as word errors:** Whisper writes "forty" as "40" and "twelve thousand" as "12 000", so a clean mix scored 5.2 %. review now compares numbers as numbers (0 %). An accent keyword in one-word captions vanished on dark clothes, so it's white at 1.25x now.
- **A stale phone screen:** the phone's screen canvas is redrawn every frame; a textAlign left over from the status bar shifted the app's text from the second frame on. phone3d now starts each frame from `ctx.reset()`.
- **Colours shifted in every MP4:** render.mjs piped BT.601 JPEGs into an untagged H.264, and browsers decoded it as BT.709: #00ff00 played as 0,216,0 and the accent's green channel moved 14 levels. render.mjs now converts to BT.709 limited range and tags it (max error 2-3/255).
- **The takeover popped:** the proof card and the app card differ in height, so the card now cross-fades into the app over the first 30 % of the move. The lockup glint's shine measured +0.4 dB (masked), so it plays at 1.8x.
