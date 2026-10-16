---
name: story-video
description: Make a fast kinetic-typography story video (founder story, promo, explainer, recap) as a finished MP4 from a short brief. Covers phrase-by-phrase title cards, expressive local AI narration (Chatterbox), synthesised SFX and a music bed with a drop that ducks under the voice, all cut to the voice and rendered with ffmpeg. No editor needed. Use whenever the user wants to "make a video like this", turn a story or script into a narrated video, make a launch/founder/recap video, or rebuild or tweak one made before (a folder with run.sh + make_cards.py).
---

# Story video → MP4

A working pipeline. **Don't rebuild it: copy `template/` and write the data.** The only creative work is the script. Everything else is one command.

The style: fast and emotional. One short phrase per card, cut 50 ms before its word. Black text cards crossfade in over 2 frames and stay quiet; the hard cuts (photos, the `white` contrast beat, the `why` drop, the end card) each land a sound. A calm bed ducks under the voice, drops into a beat at the story's turn, goes silent for half a second before the end card, and ends on an echo instead of a stinger. Keep cuts tight. Don't swap Chatterbox for the flat `say` voice unless the user asks.

## 0. First run on a machine
Check that `~/.local/share/story-video/tts-venv` exists. If it's missing, run:
```bash
sh <this skill's dir>/setup.sh
```
It needs `uv` and `ffmpeg`. `STORY_VIDEO_TTS` overrides the venv location.

## 1. New video
Before you plan the piece, run the creative method in `~/.claude/skills/type-film/creative.md` (20 concepts from the subject's own world, kill the first five, one "only this could exist here" invention).

1. Copy the template:
   ```bash
   cp -R <this skill's dir>/template ~/Movies/<slug>
   ```
2. In `make_cards.py`, write `SCRIPT`: rows of `(slug, style, text, seconds)`.
   - Cut sentences into phrases of about 1–2 s of speech. Split across cards where a spoken pause falls ("she had an idea" / "nobody believed in").
   - Styles: `serif`, `sans` (bold), `white` (a black-on-white contrast beat, use sparingly), `photo` (a photo with a caption), `why` (the story's turn), `end` (text is `"NAME|URL"`).
   - `seconds` is only a floor. The voice sets the real length.
   - The music drop lands on the card with slug `why`. Keep exactly one, or change `DROP` in `make_audio.py`.
   - `SAY` holds spoken text that differs from the card text, for example `"end": "Brand dot com."`. Spell invented names the way they sound (`"Night Rota"`).
   - Cuts and pace: `HARD` lists the styles that hard-cut in; every other card crossfades over `XFADE` frames. `ZOOM` is the photo zoom-settle (z0 1.12, τ 0.4 s). `GAP` holds 0.4–0.5 s of silence before a card: the end card by default; add the payoff line if it should land out of silence. `TAIL` holds the end card while the echo rings.
   - Brand: `PURPLE`/`ORANGE` (the end card) and `FONTS`. Each entry is `(path, ttc index, axes)`; variable fonts take axis values by name, for example `{"Optical size": 32, "Weight": 700}` for Inter Display Bold. `pick()` falls back to stock macOS fonts. List a variable font's axes with `ImageFont.truetype(p, 10).get_variation_axes()`.
   - Fill every `[PLACEHOLDER]` with real, specific details from the brief (city, subject, award, product, numbers). If the user gave none, invent plausible ones and say so. Never attach real public figures or real organisations' endorsements to a made-up story.
3. **Photos:** in `make_cards.py`, set `ASSETS` to `{slug: "short search query"}` for each `photo` card, then run:
   ```bash
   uv run --with pillow fetch_assets.py --preview
   ```
   **Look at** `assets/preview-<slug>.jpg`: six numbered candidates per slug. Pick the one that fits the scene and matches the story (the protagonist's gender, no identifiable public figures), then run:
   ```bash
   uv run --with pillow fetch_assets.py intro=1 move=0 ...
   ```
   It searches Openverse for CC0, public-domain and CC BY images only. Unsplash photos mirrored on Wikimedia come first because they're CC0 and full-resolution; the rest are Flickr, which tops out at 1024 px. It warns under 1600 px. Credits go to `CREDITS.md`, and CC BY images need them in the video description. Short concrete queries work best ("new york city", not "manhattan skyline at dusk from brooklyn"). Files the user drops into `assets/<slug>.jpg` override any search.
4. In `narrate.py`, set `EMOTION` for the key beats. `exaggeration` 0.5 is neutral, 0.8 is warm, 1.0–1.2 is the peak. A lower `cfg_weight` gives a slower, more deliberate delivery. Every slug not listed uses `DEFAULT` (0.65). Higher `exaggeration` also reads faster: at `cfg_weight` 0.4 takes ran 4–6 words/s in testing, so for a slower read lower the exaggeration and/or the `cfg_weight` (0.2–0.3 read at 2.4–4.5 words/s).
5. Build it:
   ```bash
   cd ~/Movies/<slug> && ./run.sh
   ```
   This narrates (about 1–2 min, plus a model download on first use), renders the cards, mixes the soundtrack, and joins everything into `<slug>.mp4` (4K, 29.97 fps, AAC audio). The name comes from the folder; `OUT=name.mp4 ./run.sh` overrides it. A re-run overwrites only that file.

Check the output before reporting done. Tile the cards and look at them, look at a contact sheet of the finished video, and transcribe the takes:
```bash
ffmpeg -pattern_type glob -i 'cards/*-card.png' -vf scale=640:-1,tile=6x4 -frames:v 1 preview.jpg
ffmpeg -i <slug>.mp4 -vf "fps=2,scale=320:-1,tile=8x6" -frames:v 1 contact.jpg
uv run --with faster-whisper --with pillow check_voices.py
```
Re-roll (below) every `??` line that isn't just whisper's spelling (digits, homophones, a URL). Listening for length alone misses garbled takes.

## 2. Tweaks
- **Re-roll takes:**
  ```bash
  ~/.local/share/story-video/tts-venv/bin/python narrate.py <slug> [<slug>...]
  ```
  Then run `./run.sh --keep-voice`.
- **Text, timing or colours:** edit, then `./run.sh --keep-voice`. Re-narrate the lines whose words changed.
- **Clone a voice:** set `REFERENCE` in `narrate.py` to a clean clip of 10 s or more, including the user's own recording.
- **Sound:** `make_audio.py` turns the cards into cues for `sfx.py`, the shared engine (a byte-for-byte copy of `promo-video/template/sfx.py`; its docstring lists every sound). Every SFX is set by family against the voice: subs +6 dB below 150 Hz, air and micro −14 dB. The music sits 12 dB under the voice while it speaks and comes back up in pauses over 0.3 s.
  - `STYLE_CUE` maps style to sounds: `sub_boom` with a `passby` peaking 50 ms before the cut on `photo` and `why`, a `suck_in` ending on `white`, a `sub_boom` on `end`, nothing on crossfaded text. `CUE` overrides one slug with any sfx.py sound.
  - `SFX=none ./run.sh --keep-voice` drops every SFX and lets the music carry the cuts (the gap and echo stay).
  - `SECTIONS` shapes the bed (an arp, then a groove from the drop) and `CHORDS` sets the harmony. `BPM` is fitted near 124 so the drop lands on a bar line.
  - To pick up sfx.py fixes, copy it over again from `promo-video/template/`.
- **Film look:** `LOOK=0.3 ./run.sh --keep-voice` finishes the MP4 with type-film's `filmlook.sh` (print grade, halation, gate weave, grain, vignette; no dust). It's off by default; use 0.3–0.5 and expect about 75 s extra for 30 s at 4K. `FILMLOOK=` points at another copy of the script.
- **Swap one photo:** `fetch_assets.py <slug>=<n>`, or drop in your own `assets/<slug>.jpg`, then `./run.sh --keep-voice`.
- **Other sizes:** change `W, H` in `make_cards.py` (for example `2160, 3840` for 9:16) and check that the text still fits. It needs a re-layout, not a crop.

## Limits (tell the user; don't try to script around them)
- Cards are stills cut to the voice: photos get a zoom-settle, text cards a 2-frame crossfade. For word-by-word captions, push-ins and talking-head cuts, use `ugc-edit`. For motion design, use `type-film` or `promo-video`.
- Card text is baked into the images. Edit `SCRIPT` and re-run to change it.
- Each card is an exact-length mp4 of PIL frames, so ffmpeg joins them without re-encoding. Don't "simplify" that back to stills plus durations or an ffmpeg `xfade` chain; each xfade eats its length from the timeline and the cuts drift off the voice. The crossfade frames are baked into the head of the incoming clip instead. Don't use `zoompan` for the zoom either; it jitters. The zoom is a float crop box in PIL.
- Chatterbox adds an inaudible AI watermark to its audio.
- The fonts and the `say` fallback assume macOS. On other platforms, change the font paths and always narrate with Chatterbox.

## Hindi, Hinglish and other languages
`narrate.py` here reads English with Chatterbox. For a Hindi or Hinglish voice-over, use type-film's template `lines.py` / `narrate.py` / `assemble.py` (its SKILL.md, "Narrated films"): Kokoro reads Hindi fast and cleanly, the voice line is written all in Devanagari while the captions stay in Roman Hinglish, and every take is transcribed and trimmed if it runs on.

## Problems seen so far
- **Garbled takes pass a length check.** 5 of 19 first takes were wrong ("Hours. Gone." came back as "Algolers gone!" at 1.56 s). `check_voices.py` catches them. If a line fails twice, rephrase it: "in an ICU in Leeds" kept coming back as "and an…", while "ICU nurse, Leeds." was right first time.
- **Invented brand names get mangled** ("Nightrota" became "Nitroda"). Spell them out in `SAY`.
- **sfx.py sets the whole music bus by its mean level.** With equal section gains, the calm half sat 32 dB under the voice, so it was inaudible; `SECTIONS` gains of 2.5/0.6 put it at −17 dB and the groove at −10 dB. If you change the bed, check that the calm half is still audible.
- **Photo previews took minutes.** Openverse's thumbnail proxy 424s on Wikimedia originals, so `--preview` now uses Wikimedia's own 500 px thumbnails (other widths return HTTP 400). Flickr results top out at 1024 px. Short generic nouns ("hallway", "smartphone", "coding laptop") find the full-resolution CC0 Unsplash mirrors.
- **Stale cards in the preview tile.** Inserting a line renumbers the card files, so `make_cards.py` now clears `cards/` on every run.
- **Grey frames out of a `white` card.** A crossfade from white to black passes through grey for 2 frames. It reads as a quick dip; add the next card's style to `HARD` if you don't want it.
