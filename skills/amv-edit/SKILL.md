---
name: amv-edit
description: Make an anime music video (AMV) from the user's anime clips and a song, styled after reference AMVs they share. It builds a shot library with contact sheets from folders of episode clips, maps the song (beats, verses, choruses, the measured drop), takes references apart into numbers (cut pace, flash count, quick-blur length, shake direction, grade versus the raw footage, the music dips where character voice comes through), plans a story arc one section per story beat, and renders frame-exact with blur dissolves, zoom punches, quick-blur cuts, vertical shakes on bloom flashes, Twixtor-style interpolated slow motion (never plain slow-down), a matched grade with highlight bloom and crisp lines, soft edges, animated serif/sans/script title and brand cards on measured beats, a corner watermark, and real character voice lines ducked under the music. Every render is length- and frame-checked before delivery. It also makes the YouTube thumbnail: a full-size character cutout in front of a full-width arched title, graded to match. Use when the user says AMV, anime edit, anime music video, "use these clips with this song", "edit like this AMV", twixtor, AMV thumbnail, or shares anime clip folders, an episode list or an AMV link.
---

# AMV edit: anime clips + a song + references → an AMV

> Part of claude-s. When a job needs parts from other skills, read `../claude-s/SKILL.md`: which skill leads, and what the others lend.

One `plan.json` holds everything: every shot's song time, source, speed, transition and shake, the flash times, the cards and the voice lines. `plan.py` writes it from the story you pick; `amv.py` renders it in two passes (each shot to a cached intermediate, then one join with grade, cards and audio). A plan tweak only re-renders the shots it touches.

## Setup
```bash
D=~/Movies/amv-edits/<slug>; mkdir -p "$D" && cp ~/.claude/skills/amv-edit/template/* "$D"/
```
Needs `ffmpeg`, `yt-dlp` and `uv` (`brew install ffmpeg yt-dlp uv`). Scripts carry their own dependencies (`uv run x.py`); `song.py` needs Python ≤ 3.12 for librosa, which uv picks itself.

## 1. Gather
- **Clips:** folders of episode clips (clip sites cut them at the original frame rate, no watermark). If a site hides files behind a login or a plugin, ask the user to download them; don't scrape around it. Another fan AMV works as a last-resort source for missing scenes; credit its editor.
- **Song:** an audio file from the user. Download a song or reference with `yt-dlp` only when the user has said to.
- **References:** each AMV the user names. `yt-dlp -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]"` into its own folder.
- **Story:** ask for episode summaries if the user has them; they decide which scene goes in which section.
- **Words:** brand name, title, any lines of text the user wants on screen. Never transcribe or type song lyrics yourself; the user supplies any words that go in `LYRICS`.

## 2. Measure the references
```bash
uv run refscan.py ref.mp4 ref/ "<a clips folder>"
```
Read the numbers and `ref/sheet.jpg`, then write TAKE/LEAVE. What the two Horimiya references measured:
| | ref A (fast) | ref B (soft, glowing) |
|---|---|---|
| median shot | 0.44 s | longer, a ballad |
| flashes | 59 in 2:39, clusters of 2-3 | fewer, bloom-like |
| quick blur | 4 frames typical | dissolves plus quick blur |
| shake | vertical, on flashes | rare |
| grade vs raw | warm glow | blacks −18, highlights −12, mean −19, colour ×1.2, sharp ×1.09 |
| text | glowing title, small brand line | thin script lines bottom centre, small pink dialogue subtitles, corner logo |
| voice | none | dialogue in music dips |
Match the effect styles, not the pace: a soft song keeps ~2 s shots even when the reference cuts every 0.44 s. The grade comparison is only directional when the reference is a different show.

## 3. Map the song
```bash
uv run song.py song.mp3 song.json
```
Sections come from the energy bars (loud = chorus). **The drop is the biggest loudness rise**, which song.py measures; the boundary guesses can be a fill off (Harvey: guess 15.4 s, onset fill 15.16 s, real drop 16.6 s). Put the drop's flash cut and the title card on that measured time.

## 4. Build the library and read every sheet
```bash
uv run shots.py library.json sheets/ "<folder>" ["<folder>" ...]
```
Read every `sheets/sheetN.jpg`. Note refs by what they show and their mood. Skip black frames, other editors' baked-in transitions, ads and end cards.

## 5. Plan the story
Copy the per-project block of `examples/horimiya-harvey.py` as a model; edit `plan.py` between the `=====` lines.
- **One story beat per section, in series order:** loneliness in verse 1, the bond in chorus 1, the confession in a calm verse, the proposal on the last chorus, the ending scene on the outro. The last shot is the strongest closing image.
- **Pools a bit longer than the section.** `plan.py` drops the shortest middle shots and warns "pool short", which means add shots rather than slow them down.
- **Speed:** each mood has a `min`. Below 1x is motion-interpolated; keep it at 0.75x or more (2:32-2:42 at 0.4-0.5x was the user's "frames overlap" complaint).
- **Cards:** brand over black on the first beat; title (spaced serif over a thin sans with faded ends) over dimmed footage on the drop; an end card on the outro.
- **Beats:** cut points snap to the beat grid. Section starts snap too, except times in `EXACT` (the measured drop, which can sit between grid ticks). The grid is extended at its median spacing through a fading outro, where the tracker stops. Check: every cut but the drop lands within a frame of a beat.
- **Voice:** `python3 plan.py ... > plan.json`, then `uv run voicescan.py plan.json 84-111 139-165 192-201` over the calm sections. Put the top shot per window in `VOICE` as `{"gain": 6, "sub": ""}` and re-run plan.py. Each line runs to its phrase end, up to 2.5 s past the shot (an L-cut), with a 0.3 s fade at a pause or a 0.8 s fade when the clip's own music hides the pause. `amv.py` logs each line's length.
- **Subtitles:** a voice entry's `sub` shows as a small soft-pink line at the bottom centre for exactly that span. The user supplies the text (their translation or their subtitle files). Don't transcribe or translate the show's dialogue yourself.

## 6. Test before the full render
Cut a mini plan from `plan.json`: the shots of a window, `end` = the next shot's `at`, flashes inside it, cards inside it. Render it with `uv run amv.py mini.json mini.mp4` for:
- **The first 20 s:** brand card, title on the drop, the first quick-blur cuts, shakes and flashes.
- **One calm section with a voice line.** Measure the voice window against the music around it (want about equal), and put raw and graded frames side by side (same source moment). Look at them; numbers alone missed a magenta cast.

## 7. Render, check, then deliver
```bash
uv run amv.py plan.json out.mp4
```
It prints `[render] NN%` while it works. At the end it fails on a short video track or crushed frames, and writes `out_check.jpg` (30 frames). **Look at the contact sheet before copying anything to the user**, then run `~/.claude/skills/x-video-frames/filmgate.py` as every claude-s film does. Never deliver on the exit code alone.

## 8. Thumbnail
The layout follows the classic AMV thumbnail: a huge title behind a full-size character, with a small spaced serif line.
1. **Pick a close-up from the clips:** a clear expression, the face in the upper half, and edges that aren't lost in a busy glow. Pull 8-16 candidates at full resolution and tile them. A single character matches the classic look; a couple tells the story. Offer both.
2. **Lift the subject** with macOS Vision (borrowed from ugc-edit, no download):
   ```bash
   swift ~/.claude/skills/ugc-edit/template/lift.swift frame.png cut.png
   ```
3. **Compose:**
   ```bash
   uv run thumb.py frame.png cut.png thumb.jpg --title HARVEY --sub HORIMIYA [--bg scene.png] [--deglow]
   ```
   - **Title:** full width (94%), Gill Sans SemiBold, silver with pink toward the right, arched (`--arc 150` reads on the end letters; 70 hides under the head), behind the subject.
   - **Serif line:** in front of the subject, with a stronger shadow.
   - **Grade:** the same as the AMV, then a soft edge blur. Out comes 1280×720.
4. **Check it at full size and zoomed into the hair edges** before delivering. Each of these was a real complaint:
   - the cutout was resized
   - the background was too blurred
   - the title was narrow or too thin
   - there was no curve
   - the cutout had dirty edges
   - the text had black borders
   - the shadow spread too much

## 9. A short matched to a reference edit (kinetic type)
For "make one like this" on a 10-20 s reference: big words that build letter by letter over close-ups.
1. **Find the audio:** `uv run songmatch.py ref.mp4 song.mp3` gives the song stretch (plan `song_start`, `end` = the reference's length). Same audio means the same beats, so the reference's cut times work as-is.
2. **Measure:**
   - `refscan.py` gives cuts, flash pops and motion direction.
   - Find word entrances, colour and how long each word takes to build by tracking the text colour per frame (gold/red pixel share in the middle band).
   - Measure the grade against our render, not by eye. The Harvey reference was p50 95, p95 163, sat 62, R-B 60: a warm matte.
3. **Words:** the reference may spell out lyrics. Don't type or transcribe them; use the song title and character names, or lines the user supplies.
   - **Syllable chunks:** split each word into syllables (HAR|VEY, MI|YA|MU|RA) and land each chunk on a sung syllable. Detect vocal onsets on the voice's harmonic part (HPSS, then 250-3500 Hz flux); take the onset nearest the word's entrance, then onsets at least ¾ of the reveal window apart.
   - **Card:** `chunks: [[letters, seconds in], ...]`. Each chunk develops from pale, translucent and soft to full colour and sharp in about 0.25 s, with nothing showing before its time. Study the reference frame by frame first; a smooth left-to-right sweep with ghost letters was wrong.
   - **Font:** `font: heavy` + `sx: 0.58` (tall, very condensed, high-contrast serif), `glow` around 0.2 (flat letters); a `small` line above uses quick fades. Credit: two bold lines at the bottom centre (`credit`, Avenir Next Demi Bold).
4. **Shots:** only deep, warm, saturated close-ups. Cool, white or pastel backgrounds go grey under a matte grade.
5. **Motion and edges:** no push-in (`zoom` 1.0); vertical shakes ride the flash pops. Edges: a radial zoom blur from about 0.28 out (`edge_zoom` 0.10, `edge_start` 0.28, `edge` 3), sharp in the centre.
6. **Stickers:** the claude-s library (`ugc-edit/stickers`, image lines) is optional. The reference had none, and they didn't sit well on this style, so we took them out.
7. **Check:** tile the reference and our render at the same times, side by side, before delivering. `examples/horimiya-harvey-short.py` is the full plan.

## Problems seen so far
- **The picture stopped at 0:57, then at 0:26:** xfade ends the whole stream when its first input runs a frame short. Shots render 0.25 s long (`PAD`) and hold their last frame (`tpad`), so this can't recur.
- **The padding vanished:** after `minterpolate` the frame timestamps were off, so `trim=duration` dropped the padded frames. Frames are renumbered (`setpts=N/FPS/TB`) and trimmed by count.
- **A near-still shot came out short:** `mpdecimate` drops held drawings, and a still shot lost nearly all of them. `max=3` plus the tpad hold fixed it.
- **Every frame before 1:40 crushed to black/white blobs:** the flash pulse `gte(t,ti)*exp(-11*(t-ti))` overflows to inf before a late flash, and 0×inf = NaN, which wrecked eq. The exponent is now `max(0, t-ti)`. A 22 s test missed it, because one early flash never overflows; the frame check now catches the class (59-86% near-black/white vs under 10%).
- **The grade turned everything magenta:** a screen blend in YUV screens the chroma planes, and in gbrp the blend mixed up the planes. The bloom now runs in yuv444p on luma only (`c0_mode=screen`, chroma `normal` at opacity **1**; opacity 0 takes the *bottom* layer's colour).
- **Slow motion looked bad:** plain slow-down stutters on 24 fps anime. Below 1x drops duplicate frames, then `minterpolate` (mci); keep it at 0.75x or more.
- **The title card missed the drop by 0.18 s:** cards were snapped to the nearest beat. Card times are now exact, measured song seconds.
- **The thin title washed out over white walls:** cards get a soft dark halo, and the dim layer is at 150/255.
- **A broken render reached the user:** the copy step ran on exit code 0. Copy only after the frame check passes and you've read `out_check.jpg`.
- **A voice line cut off mid-word:** voice audio ended at the shot's cut. It now runs to the next 0.26 s pause in the speech band, over the next shot, and the duck follows it.
- **Subtitles were invisible:** with no blur or resize, the card loop faded the cached sprite in place, so alpha decayed 28 → 10 → 5 frame after frame. Title cards hid this, since they blur or scale until they're fully opaque. The sprite is copied now, and the card cache key carries a version so stale frames rebuild.
- **10 cuts sat off the beat:** hand-set section starts (0.07-0.21 s off), and outro cuts after the beat tracker stopped. Section starts snap now, and the grid is extended to the end.
- **Thumbnail: a white outline round the cutout:** a rim light behind the subject. It's gone.
- **Thumbnail: glow stuck in the hair:** Vision counts backdrop sparkle next to hair as subject. Islands are dropped; `--deglow` removes bright non-red or yellow pixels near the edge; edge pixels take the subject's inner colours.
- **Thumbnail: a hair loop filled with glow:** `binary_fill_holes` closed a real gap between strands. Only pinholes under 400 px are filled now.
- **Thumbnail: holes punched in the shirt:** a "small white piece near the edge" rule sized pieces inside the edge band, where the shirt's line art splits it into small parts. The hole was hidden while the background was the same frame. Size pieces over the whole cutout, or don't use such a rule.
- **Thumbnail: "background too blurred" at 1.2 px:** the frame's own backdrop was a soft-focus sparkle. Use `--bg` with a sharp scene from the clips. One "flake" the user circled was that backdrop, not the cutout, so check the cutout's alpha at the spot before adding cleanup rules.
- **Short: the font looked wrong:** the condensed cut was too wide and soft. Render candidates next to a crop of the reference's own lettering and pick by eye. Here, a squeezed Display Extrabold matched; Bodoni and Didot were too thin.
- **Short: quality nowhere near the reference:** the grade numbers were off (R-B 19 vs 60, saturation 35 vs 62, crushed blacks), and cool or pastel shots fought the palette. Match the grade to the reference's numbers, use warm shots only, keep it crisp (`edge` 0, low bloom).
- **Short: the text animation wasn't the reference's:** a smooth letter sweep over ghost letters. The reference builds each word in syllable chunks on the sung syllables, each developing from pale to full colour; frame-by-frame strips at 30 fps showed it.
- **Short: the edges weren't soft enough:** a light gaussian edge blur from 0.55 out. The reference smears the outer two-thirds with a radial zoom blur.
- **A constant zoom on every scene:** a slow push-in on all shots by default. It's opt-in now (`zoom` 1.0).
- **The frame check stopped on a night shot:** it read a genuinely dark scene as crushed. A frame now counts as crushed only when near-black and near-white are both over 15%, which was the broken render's signature.
- **Thumbnail: black borders on the text:** a dark outline for separation. It's now a tight soft drop shadow (blur and offset about 1% of the text height); a wider one "spread too much".
