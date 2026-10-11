---
name: archive-footage
description: Find and cut short segments of old film (b-roll, archival texture, film countdown leaders, grain plates, "objects on black", old maps) from movingimagearchive.com, the Internet Archive or Wikimedia Commons. Each clip's licence is checked at the archive it came from, not the aggregator, and the credits are written for the end card. Use when a video needs real archival film, when the user mentions movingimagearchive.com, Prelinger, public-domain footage or old film b-roll, or when type-film, story-video, explainer-lesson, ugc-edit or faceless-video need an archival shot. Its editing.md has shot ideas per theme, a montage recipe, sound for silent film, and grade settings.
---

# Archive footage → verified clips + credits

One helper, `archive.py` (uv, stdlib, ffmpeg, Pillow for the labels). It searches, shows you a numbered contact sheet, checks the licence at the original archive, cuts a few seconds over HTTP range requests and writes the credits. **A clip goes into a video only after `get` has verified it.**

movingimagearchive.com (MIA) is the best place to *find* old film: OpenCLIP search over Prelinger, US Government Films, NASA and Open Images, split into shots. It has no terms page and no robots.txt, and every source there says `public_domain`. Prelinger's own rights FAQ warns that many of its films aren't public domain. So MIA's label is only a hint, and `get` reads the licence again where the film actually lives.

## When to use
- B-roll and archival texture under type or narration.
- Film countdowns, grain plates, "objects on black", glowing lines, old animated maps, cursors and frames. MIA has whole collections of these, and its search finds them.
- Called by `type-film`, `story-video`, `explainer-lesson`, `ugc-edit` and `faceless-video` (which cuts whole films from it). They draw everything else; this skill supplies real film and its credit lines.

## The flow
Run it from the project folder: `A=~/.claude/skills/archive-footage/archive.py`.

1. **Search.** Describe what's in the frame, not the mood: "film countdown leader", "typewriter close up", "city street 1950s".
   ```bash
   uv run $A search "typewriter close up" [--years 1945-1960] [--color bw|color] [--aspect 4:3] [--via ia|commons]
   ```
   It prints `idx year length title` and writes `assets/archive/search/sheet.jpg` (6×4, numbered in idx order) and `results.json`. `--years` works for mia and ia; `--color` and `--aspect` work for mia only.
2. **Look at the contact sheet** (Read it). The ranking is loose: a countdown search also returns Apollo footage and aluminium furnaces, so the sheet does the filtering, not the score. Check the shot length on each label, and look for burned-in titles, logos, and faces front and centre.
3. **Pick and get a segment:**
   ```bash
   uv run $A get 4 --in 4 --dur 3 --best --name typewriter
   ```
   - `--in` is seconds into the shot (mia) or the film (ia, commons). It warns if `--dur` runs into the next shot.
   - **Output:** square pixels at 30 fps and native size; it deinterlaces only frames that are flagged interlaced. `--size 1920x1080` scale-crops to fill. `--fps 30000/1001` matches story-video's cards.
   - **`--best`** probes the original archive's copies and uses the biggest one whose frames line up with your pick (correlation > 0.9 within ±2 s). Use it for Prelinger: MIA serves some of those films at 320x240, while the archive.org MPEG-2 displays at 640x480. It also checks the Commons original of a Commons film (Out West: 960x720 against MIA's 320x240).
   - **Output files:** `assets/archive/<name>.mp4` and `<name>.json` (provenance: where it was found, the upstream page, the licence evidence, warnings and the credit line).
   - **Look at the frames** before using them: `ffmpeg -i assets/archive/<name>.mp4 -vf fps=2,scale=320:-1,tile=6x1 -frames:v 1 check.jpg`
   - A later `get <id>` works with any id from `search/seen.json`; an idx always means the last search.
4. **Credits:**
   ```bash
   uv run $A credits [--card 1920x1080]
   ```
   - **`CREDITS.md`:** an "Archival footage" section between markers. Anything else in the file stays.
   - **`credits.txt`:** one line per film (two clips from one film share a line), `title (date) · archive · licence`, for an end card or the video description.
   - **`credits.json`**, and **`credits.png`** (with `--card`): a plain end card.
   - Clips are listed in the order you fetched them. To drop one, delete its .mp4 and .json and run `credits` again.

**Using the clips:**
- **Canvas skills (type-film, explainer-lesson):** extract a JPG sequence (`ffmpeg -i clip.mp4 -q:v 2 f/%04d.jpg`) and draw frame `floor((t - t0) * 30)`. It stays frame-exact under `seek(t)`. Or overlay the mp4 with ffmpeg after the render.
- **story-video:** joins card mp4s without re-encoding, so get the clip with `--size 3840x2160 --fps 30000/1001`.
- **End card:** use `credits.txt` on it, or `credits.png` as is.
- **faceless-video:** names the clip in `film.json` (`"clip": "<name>"`) and cuts, grades, scores and credits it.

## Editing it
[`editing.md`](editing.md) has the craft, taken from two archival edits on 2026-10-11:
- **Shot ideas per theme:** search phrases that worked, and their traps.
- **The two-worlds montage recipe:** match cuts, runs of 3-5 frame shots into a long hold, object inserts, a page pushed in, step-printing.
- **Footage played on a screen or as a print.**
- **Sound for silent film:** what's in the frame mapped to faceless-video's synthesised beds and foley spots.
- **Grade and damage settings by source.** Short version: clean scans get almost no look and no fake damage.

## Licensing rules
`get` checks the licence at the archive the film came from: archive.org `licenseurl`, the openbeelden OAI `oi:license`, images.nasa.gov, or Commons extmetadata. Then it sorts the clip into a class:

| Class | What it means | `get` |
|---|---|---|
| `pd` | The archive marks it public domain, CC0 or PDM, or it's a US federal work (NASA) | allowed |
| `pd-age` | Published in or before 1930 (today's year − 96, so the line moves every 1 January). US only. A decade date like "ca. 1920s" counts as 1929 | allowed |
| `by` | CC BY | allowed, and the credit is **required** |
| `by-sa` | CC BY-SA. The whole video would have to be CC BY-SA | blocked unless `--allow-sa` |
| `unverified` | No usable licence at the source. This includes **archive.org community uploads** (`opensource_movies`), whose licence and date are just what the uploader typed | blocked unless `--i-checked "what you checked"` (the note goes into the credits) |
| `restricted` | NC or ND | always blocked |

- **Label-only `pd`** (a Prelinger film from 1931 or later that isn't a federal work) gets a warning. It's fine for a demo or editorial use. Before commercial use, check that the copyright wasn't renewed, or pick a federal or pre-1931 film.
- **Sponsored films** (Goodyear, Chevrolet, Bell & Howell) show brands. Never imply an endorsement.
- **People on screen** have publicity rights that are separate from copyright. Don't put a recognisable stranger next to a product claim.
- **Sound:** a film's soundtrack can carry music that's copyrighted separately. Prefer silence or a synthesised bed. Use a clip's own audio only when it's verified PD and it's speech or effects.
- **Credits:** put them on the end card or in the description even when the clip is PD. It's courtesy, and it's the paper trail.

## Etiquette
- **Rate:** one request a second per host. openbeelden gets one every 10 s, the Crawl-delay in its robots.txt. Every request carries a `claude-s-archive-footage` user-agent.
- **Cache:** everything is cached in `~/.cache/claude-s/archive`: searches and licence lookups for a day, thumbnails for good. Re-runs are free.
- **Searches:** at most 3 per run unless the user asks for more. Pick from the sheets you already have.
- **Never crawl.** No walking collections or source pages, and no whole-film downloads: segments come as byte ranges.
- **If MIA changes:** its API is internal and undocumented. If search or the source page changes shape, switch to `--via ia` or `--via commons` and tell the user.

## Problems seen so far
- **SD only on MIA** (640x480, 720x480, 320x240). The NASA leader's "original" at images.nasa.gov is the same 712 MB file MIA rehosts, so `--best` keeps MIA's copy and says why.
- **Non-square pixels:** SD sources have them (10:11, 40:23), and one mp4 carries a crop flag (720 → 704). The output is converted to square pixels; don't trust raw ffprobe widths.
- **Late video on input-side seeks:** a plain `-ss` before `-i` on an MPEG-2 over HTTP started the video 0.2–0.4 s late. The helper seeks to 5 s early, then decodes to the in-point.
- **Slow gets:** a `get` with `--best` from an archive.org MPEG-2 takes 2–3 minutes (slow range requests). ffprobe on R2 stalled once, so it retries.
- **Leader edge:** the NASA leader has a thin magenta line along its top edge. Crop a little overscan (`crop=iw-16:ih-12`).
- **archive.org metadata quirks:** dates like "ca. 1920s", and "N/A" in empty fields. Its search returns HTTP 200 with an error body when a `/` isn't escaped.
- **A bogus PDM on a community upload:** a 1983 *Charlie's Angels* countdown leader carried the Public Domain Mark. That's why community uploads count as `unverified`.
- **CREDITS.md clash:** story-video's `fetch_assets.py` rewrites the whole file. Run `archive.py credits` after it.
- **Pillarboxed HD copies:** an openbeelden 1920x1080 file held a 4:3 picture inside black bars. Crop it (faceless-video `crop`) before a cover framing.
- **Home movies:** a 320x240 amateur reel had a hair in the gate and whip-panned after 1.5 s. Look at the strip before you place a clip.
- **Tragedy in the results:** "busy street 1906" returned the San Francisco earthquake. Don't borrow a disaster film for an unrelated mood.
