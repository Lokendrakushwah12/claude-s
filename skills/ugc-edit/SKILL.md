---
name: ugc-edit
description: Edit talking-head, podcast or screen-recording footage into a creator-style cut for Reels, Shorts or TikTok, or into a screen tutorial. Cuts land on the words, the camera never sits still, there's a small lead-in caption plus one hot keyword per phrase (optionally behind the speaker), an insert for each abstract idea, and a three-family SFX grammar (sub, air, micro) over a ducked bed at -14 LUFS. Two presets share one engine, `creator` (UGC, podcast clips) and `tutorial` (screen recording plus voice). With no footage, it voices a script with Chatterbox and draws placeholder cams. Use when the user says UGC, talking head, podcast clip, reels/shorts/TikTok edit, "edit this video", "cut this like a creator", or "screen recording to tutorial", or shares a UGC reference and wants that editing style.
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
Read the headers of `ingest.py`, `edit.py` and `video.js` once. The type.js devices used here are `hotWord leadIn behind shotCam flash glowIn glitchBox screenInsert clickDisc dof montageFrames cutIndex pointer track`. look.js (film and screen looks) is off; add it to index.html only if the user asks for a look.

## 1. Ingest → `src.json`
```bash
uv run ingest.py A.mp4 B.mp4                       # real footage; the first clip's audio is the master, others are synced by cross-correlation
uv run ingest.py --placeholder creator --script script.txt    # no footage: Chatterbox voice + drawn A/B/W cams with ground-truth mattes
uv run ingest.py --placeholder tutorial --script vo.txt       # no footage: voice + a drawn app recording, cursor logged separately
```
- **Transcript:** faster-whisper words (`small.en`; `WHISPER_MODEL` overrides it) fed as a numpy array, plus silences over 0.35 s and fillers. It prints the words with their indices: read them.
- **Script file:** one take per line; `(0.9) text` raises the exaggeration. Chatterbox reads at about 4.5 words/s, so ~110 words gives a 28 s cut.
- **Lock:** Chatterbox always runs under `~/.cache/claude-s/ttslock.py`, because other agents narrate too.
- **Footage resolution:** it should be at least 1.5× the output; ingest warns when it isn't, because punch-ins will soften.

## 2. Write `edit.json`, then `uv run edit.py build`
The template `edit.json` shows every field once. A phrase is one caption line and, by default, one shot:
- **Words:** `say` is the words as spoken, matched to the transcript in order. Words in no phrase are cut, so a retake is dropped by leaving it out. Fillers inside a phrase are cut, and the cut becomes a re-punched jump cut.
- **Shot:** `cam` (A/B/W…) or `insert: {kind: card|screen|montage|rec|<project kind>}`. `cut: false` continues the previous shot.
- **Camera:** `z0 tau ax ay slide` (defaults 1.35, 0.4, 0.5, 0.4, ±0.02 W/s alternating). `pull` fires a keyword-triggered pull-back from 1.2 over 2.8 s. `push: 0` adds an accelerating push.
- **Captions:** `kw` is the one hot keyword. `behind` puts it behind the subject. `graphic` slams the keyword in on a cut at keyword + 0.15 s with thump-thump-boom. `caption: false` hides them. `kwY` and `leadY` move them.
- **Moments:** `flash` (an exposure flash on the cut), `build` (a sub swell that stops dead on the cut), `hush` (the bed drops out under this phrase), `hold: 0.4` (keep more pause after it, for a punchline).
- **End card:** `end: {kind: end, text, sub, dur}`.

What `build` does for you:
- **Cut points:** `cut = next word − 0.08 s`; into a `graphic` phrase, the picture cuts at its keyword + 0.15 s.
- **Pauses:** pauses over 0.35 s shrink to 0.12 s after the voice actually ends, plus 0.08 s before the next word. Everything snaps to 30 fps.
- **Outputs:** `dialogue.wav` (the pieces with 5 ms fades, lightly compressed) and frames at 1.5× the output in `frames/sNN/`.
- **Report:** it prints the ASL, the fillers and the words it cut. Read it every time.

Edit rules:
- **Pace:** ASL 1.2–2.2 s. Cut A/B/W on phrase boundaries and never hold one framing for more than ~2.5 s.
- **Keywords:** one per phrase, the word that carries the meaning (an object or a verdict, not "the").
- **Inserts:** one for each abstract noun (question → a card, "one button" → a screen insert, "six months" → a montage), at most one montage, and 2–4 inserts in 30 s. An insert cuts in ahead of its word.
- **Project inserts:** add them at the bottom of video.js as `INSERTS.<kind>(c, t, s, o)`, plus `SOUNDS.<kind>(s, o, ev, sfx)` for its UI sounds. Draw them as concepts from the brand's own world. Never reuse a reference's metaphor (no iceberg).

## 3. Camera, captions, look
- **Camera:** footage is never still. Each shot zoom-settles `z = 1 + (z0−1)e^(−t/τ)` and slides. The frame is overscanned by `2·|slide|·dur` so an edge never shows.
- **Lead-in line:** about 46 px at 1080 wide, at 0.43 H. Words land on their onsets in pre-spaced slots, and at the phrase end it un-types in reverse, a word every 2 frames.
- **Keyword:** 800 weight, cap height 0.11–0.2 W, at 0.56 H. It slides in with an expo ease, and each letter cools from the brand's accent to warm to white like a fuse. One accent per brand, and never the reference's mint green.
- **Behind the subject:** the keyword drops to jaw height (0.42 H) so the head hides its middle letters. At torso height the body hides it all.
- **Safe zone:** keep captions in 0.36–0.62 H, clear of the platform's UI.

## 4. Sound: `node render.mjs --cues && uv run sfx.py`
`video.js` turns the timeline into `events` for `autocue` (sfx.py), with `vo = dialogue.wav`, so every cue is set by its family against the voice:
- **Plain cut:** `cut` → a passby peaking 50 ms before it.
- **Cut into or out of an insert:** `cut_insert` → a sub_boom plus a passby.
- **Keyword:** `keyword` → a suck_in ending on it. A `graphic` keyword gets thumps plus a boom (`keyword_stat`).
- **Flash:** flash_hit. **Build:** sub_swell ending on the cut.
- **Montage:** flash_hit in, sub_drop out.
- **Screen insert:** a key tap per character, a click, then a click_cluster when the results land.
- **Levels:** sub +6 dB over the voice (below 150 Hz only), air and micro −14, music −12 with 8 dB of ducking. The master is −14 LUFS at −1 dBTP.
- **Bed:** a slow pad with a chord every ~3.6 s, the end card on a bar line and a riser into it. Override it with `"bed"` in edit.json, or `null` for none.

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
- every sub lands on a cut;
- the voice word error rate is under 3 %; read each difference it lists;
- no keyword is hidden or clipped;
- nothing important sits in the top or bottom 15 %.

Fix, rebuild and look again.

## POV / jump-cut fast path (no canvas)
One locked-off clip, jump cuts on a song's 8th-note grid (cut = grid − 0.05 s), and one static caption (white semibold, a dark 2 px stroke, at 21 % of H). Make the "working" segments shorter each time and keep the "chill" segments long. No SFX.
```bash
echo '{"clip": "pov.mp4", "song": "song.m4a", "bpm": 130, "downbeat": 0.42, "caption": "pov: ...", "segments": [[0, 6], [3.1, 3], [5.0, 6], [8.2, 2]]}' > pov.json
uv run edit.py pov pov.json     # segments = [source in, length in 8ths]; trim + concat + a PIL caption overlay -> pov.mp4
```

## Limits
- **Mattes:** MediaPipe's selfie segmenter (`matte.py`) gives the person only, so props and mics in front stay behind the type. It also fails on drawn figures, which is why placeholders use their ground-truth matte.
- **Multicam sync:** cross-correlation of the audio envelopes. It needs every cam to have recorded sound.
- **Motion blur:** none on cuts (render with `--subframes` if needed). Meme and b-roll images must come from the user or `archive-footage`.
- **Captions:** only as accurate as the `say` text. The voice check catches what TTS or the transcript gets wrong. Chatterbox said the made-up brand "Slipway" so that it was heard as "Flipway".

## Problems seen so far
- **Whisper looped one line:** with the whole script as `initial_prompt`, the transcript was one line repeated three times. Transcribe with no prompt; it still catches "um".
- **The edit clipped words:** Whisper ends the last word before a pause early, so cutting 0.12 s after it turned "silence" into "silen-" (the final mix was heard as "not silent"). Tails now follow the voice's energy.
- **Cuts went silent:** autocue keeps one air sound per 0.4 s and the earlier wins, so a keyword just before a cut silenced the cut's passby (3 of 20 cuts). video.js now drops a keyword's suck_in within 0.45 s before a cut.
- **The brand name was cut:** a misheard edge word ("Flipway") fell outside its phrase and was cut. Unmatched first and last words now claim the unclaimed word beside them.
- **A phrase can swallow a take:** a `say` that matches words far apart swallows everything between them. build warns when a phrase spans more than twice its written words.
- **Behind-type at torso height:** the body hid the whole word. Put it at jaw height.
- **A results list that never landed:** the screen insert's results blur in over 0.75 s, so a click on the phrase's last word meant they never resolved before the cut. Click on an earlier word, or `hold`.
- **Stacked subs:** a montage exit and a graphic keyword stacked two subs on one cut. The graphic keyword now owns that cut.
- **Slow slams:** graphic keywords slid in over 0.8 s and never slammed; they now land in 0.18 s.
- **A crash on frame 1 of the end card:** `ease.back(0)` returns −3e−15, and `arc()` throws on a negative radius. Clamp radii.
- **A missing last frame:** a shot can ask for frames past the clip's end. build counts what ffmpeg wrote, and the last frame holds.
- **A full-white strobe:** a B&W montage alternating white and black grounds at 10+ Hz strobes. The montage keeps dark grounds.
