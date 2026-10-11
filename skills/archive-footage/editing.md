# Editing archival film: shot ideas, cutting, sound, grade

What to do with the clips once `get` has verified them. These notes come from two archival edits taken apart frame by frame and from
spectrograms on 2026-10-11:
- @julianleiss (#37): a b/w montage of two parallel worlds, 95 cuts in 36 s.
- @toonoxx_ (#38): archive and news footage played on a CRT.

The detail is in `~/Movies/refs/batch-2026-10-11/NOTES-G4.md`. `faceless-video` is the skill that cuts these into a finished MP4; this
file is the craft it follows. The licence rules in SKILL.md stay as they are: nothing here changes what `get` lets through.

## Shot ideas per theme
Search for what's **in the frame**: a noun and a verb, no mood words. Every row was a real result or a near miss on 2026-10-11.
Pre-1931 queries (`--years 1900-1930`) come back `pd-age`, the safest class.

| Theme | Search phrases that work | Watch out for |
|---|---|---|
| Sea and coast | waves breaking on rocky shore · fishing boats leaving harbour · sailboats moored at a quay · sun glitter on the sea | whip pans in home movies; pillarboxed HD copies |
| City streets, 1900-1930 | horse drawn carts on a busy street · tram on a city street · canal bridge with people · street market stalls | earthquake and disaster films come up for "busy street": don't borrow a tragedy for a mood |
| Work and industry | printing press running · steel mill sparks · loom weaving close up · men loading a ship | sponsored films show brands (SKILL.md) |
| Farm and country | ploughing with horses · wheat field in wind · cows grazing · haystack | 1940s+ USDA films are federal (pd) but often colour-faded |
| Sky and weather | clouds moving fast · rain on a window · snow falling on a street · storm at sea | many time-lapses are later and unverified |
| Transport | steam locomotive passing · ship's wake from the stern · biplane taking off · car on a country road | |
| Home and hands (inserts) | hands typing · hands sewing · pouring tea · a clock face | faces fill these frames; no product claims next to a stranger |
| Science and space | rocket launch · mission control · microscope view · film countdown leader | NASA is federal (pd); check the credited creator |
| Texture plates | film grain plate · objects on black · glowing lines · old animated map | MIA collections; label-only pd |

## Cutting it
**Montage of two worlds (#37):**
1. **Pick two sets** that rhyme: then and now, two cities, two crafts.
2. **Match-cut on framing.** A face to a face at the same eye line, a body to a body, a horizon to a horizon. The cut is the idea.
3. **Rhythm:** runs of 3-5 frame shots (0.1-0.17 s) that speed up into a match, then a hold of 1.5-2 s on a wide. Median shot 0.17 s, ASL 0.38 s, with no even beat.
4. **Inserts:**
   - Objects on grey seamless (a coin, a tool, a scrap), museum-catalogue style, held 2-4 frames.
   - A typeset page pushed in until one line is readable.
   - An accumulating grid: stills added one per cut on a white page.
5. **Step-print a held shot.** Drop frames so the riders move in jerks (faceless-video `stutter: 3`); it marks memory without a filter.
6. **Hard cuts only.** No dissolves; the speed of the cuts is the transition.

**Footage on a screen (#38):**
- Play the archive inside a frame: a tube screen with rounded, soft edges and scanlines (faceless-video `frame: "crt"`), or a photo
  print on a table with a curled corner (`frame: "print"`). It says "this is a record".
- **Captions:** one word added per cut in small spaced capitals (faceless-video `captions: "caps"`).
- **Tint:** modern clips get tinted, archive stays neutral; or the reverse. Never both the same.
- **LEAVE #38's timeline strip:** that is its signature.

**Old film runs fast.** 16-18 fps material served at 29.97 looks sped up. `speed: 0.6-0.75` in faceless-video slows it to life;
check that the walking looks like walking.

## Sound for silent archival film
Old film has no usable track; give it sound that matches the frame. faceless-video's `ambience.py` synthesises it all (no samples),
or take the lines below into any other skill's mix.

| In the frame | Bed (ambience.py layers) | Spots and SFX |
|---|---|---|
| a street, 1900-1930 | crowd {dist .8}, wind .3 | hooves {n 8, pan, dist}, steps, bell {f 1450, decay .05} for a tram |
| a market | crowd {gain 1, dist .3} | |
| a canal, a quay, a harbour | stream {flow .4, size 1.8} (lapping), gulls {dist .6}, wind | bell {f 290, dist .85} for a church; steps {surface wood} on a bridge |
| the sea, surf | surf, wind .4, gulls | splash on the wave hit |
| a factory or press | machine {rate = the visible stroke rate}, room | sfx.py `clink`, `ratchet` |
| fields, farms | wind, leaves, birds, insects | hooves for a plough horse |
| watching film as film (print, crt, leader) | projector {fps 24}, hiss {crackle .5} | sfx.py `tick` on a countdown |

- **One spot per shot,** on the thing you can see move. Sound for what's off screen reads as fake.
- **Montages:**
  - #37 carried 95 cuts with ONE sustained drone (an open fifth over a low E) and a hiss floor at about -39 dBFS.
  - Soft 15-30 ms ticks played only on the fastest run, and a riser went into one hit.
  - A fast montage wants a bed that doesn't change on every cut. Cut the bed on the holds instead (faceless-video `xfade` 0.2).
- **A beat-cut edit (#38):** 150 BPM, kicks on beats, ticks on 8ths, and the music thins out under the final mark.
- **The film's own track:** use it only when it's verified PD speech or effects (SKILL.md, Sound).

## Grade and damage
| Source | look.js (faceless-video `look`) | filmlook.sh K | Why |
|---|---|---|---|
| clean scans (openbeelden HD, Prelinger 4K) | `archival`, k .3, dust 0 | 0.2-0.3, DUST=0 | #37 added no damage; the archive's grain and halation carry it |
| mixed sources, one cut | `archival`, k .3-.45 (mono 1 makes everything one b/w print) | 0.3 | unifies contrast and tone |
| canvas scenes in the cut | `archival`, k .45, dust .5 | 0.4 | the drawn frames need grain and weave to sit with real film |
| "found footage" on purpose | `archival`, k .7-1 | 0.6, DUST=1 | heavy weave, flicker, dust: a choice, not a default |

- **Never fake damage on a clean scan.** Never put a second grain over an SD source already full of grain; it turns to mush.
- **Crop overscan on leaders** (`crop=iw-16:ih-12`) and pillarboxed HD copies before the grade.
