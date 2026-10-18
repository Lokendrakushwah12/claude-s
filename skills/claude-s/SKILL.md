---
name: claude-s
description: The map of the claude-s video skills. Read it first for any video job that touches more than one of them, or when you're not sure which skill leads. It picks the lead skill, lists the parts the others lend (voice, captions, transitions, camera, grades, sound, stickers, archive film, the delivery gate) and the pipeline every job follows. Use it whenever a request mixes footage, voice, motion design, music or references, says "combine", "use everything", or asks for "the best video" from several inputs.
---

# claude-s: which skill leads, and what to borrow

The skills are one studio, not eleven apps. **One skill leads** (its project folder, its renderer, its SKILL.md steps); every other skill is a parts shelf. Read the lead's SKILL.md fully. From the others, read only the section for the part you borrow. Don't open a second project.

## 1. Pick the lead by the input and the output
| The job starts from… | and should become… | Lead |
|---|---|---|
| the user's own talking head, podcast or screen recording | a creator cut, tutorial, before/after, aesthetic reel | `ugc-edit` |
| the user's clips or stills | a beat-locked hype edit, montage | `aura-edit` |
| a script or theme, nobody on camera | narrated or voiceless b-roll video | `faceless-video` |
| a reference film + a brand | an original motion film, kinetic type, a narrated motion reel | `type-film` |
| a product repo or site | a launch promo with the real UI | `promo-video` |
| one hard concept | a narrated animated lesson | `explainer-lesson` |
| a song (or lyrics, or a character idea) | a music video, lyric essay, animated short | `music-video` |
| a short story or founder brief | phrase cards with a voice, fast | `story-video` |
| "how does X work", to explore | an interactive page (Artifact), not a video | `explorable-explainer` |
| a need for old film | licence-checked archival clips | `archive-footage` (a supplier, never the lead of a finished video) |
| a link to a video | frames, a measured breakdown, a delivery check | `x-video-frames` (a tool for every lead) |

Mixed inputs: lead with whatever owns the **footage** (real clips beat drawn scenes), else the **voice** (a narrated piece), else the **motion** (`type-film`).

## 2. The parts shelf
| Part | Lives in | How to borrow it |
|---|---|---|
| Take a reference apart | `x-video-frames/deconstruct.py` | before writing anything that should "feel like" a reference; fill TAKE/LEAVE |
| Delivery gate | `x-video-frames/filmgate.py` | on every finished MP4, every skill; red = don't deliver |
| Creative method (past the first idea) | `type-film/creative.md` | any original piece; §6b motion rules apply to every drawn shot |
| Voice-over as the clock, Kokoro/Chatterbox, Hindi/Hinglish | `type-film/template/{lines,narrate,assemble}.py` | any narrated piece; `timeline.js` drives cuts and captions |
| Expressive English narration, voice cloning | `story-video/template/narrate.py` (`REFERENCE`) | when the read must act |
| Type, captions, 3D camera, transitions, hits | `type-film/template/type.js` | any canvas-drawn shot; names in `gallery/` (#Txxx) |
| Aesthetic reel kit (clipped sheets, serif stacks, script lines, cut-outs, torn labels) | `type.js` + `ugc-edit` reel mode | covers, list reels, before/after |
| Sticker library, 347 die-cut stickers | `ugc-edit/stickers/` (`manifest.json` tags, gallery Stickers tab) | copy picks into the project's `assets/stickers/`, `stk: [{img: "stickers/s012.webp", on: "word"}]` |
| Real photo stickers | `ugc-edit/template/stickers.py` + `lift.swift` | CC0/PD/CC BY search or the user's photos, subject lifted, credits written |
| Looks and grades (film16, archival, crt, vhs, aura, umber, alpine, cream, golden) | `type-film/template/look.js`; real footage: `grade.sh`, `filmlook.sh` | finish any piece |
| Sound: 59 SFX, beds, ducking under a voice | `promo-video/template/sfx.py` | every piece; cue sounds from the same times the picture uses |
| Renderer (frame-exact, motion blur, stills, loop/motion checks) | `music-video/template/render.mjs` + `lib.js` | every canvas piece |
| Characters that act (squash, faces, mouths) | `music-video/template/toon.js` | any piece that needs a figure |
| Product UI, cursor, 3D phone, code typing | `promo-video/template/promo.js`, `lib.js` (`phone3d`, `codeBlock`) | demos inside any piece |
| Archival film + credits | `archive-footage` | b-roll for faceless, story, ugc, type films |
| Pacing rules (measured) | `ugc-edit` "Fast creator cut", `aura-edit` "Beat-locked montage" | any edit that should feel fast |

The user may paste picks from the gallery (`#T029 dollyZoom (type.js)`) or a references prompt (`#R12 …`): map each to the named helper or reference entry.

## 3. The pipeline every job follows
1. **Brief:** what it's about, who it's for, length, 9:16 or 16:9, voice or not. Ask only for what you can't default.
2. **References:** deconstruct any the user gave; take techniques, never their shots or copy.
3. **Script** (when there's a voice): spoken lines, not notes; write for one listener. Write the hook last with `hooks.md` (families, visual hooks, anti-slop rules, the 4-line check).
4. **Voice:** narrate, check every take, build the timeline.
5. **Picture:** the lead's renderer; borrowed helpers; stills gate before the full render.
6. **Sound:** cues from the picture's own times; music ducks under the voice.
7. **Finish:** a look or grade.
8. **Gates:** `filmgate.py`, then a fresh critic that didn't make it; the lower score wins.
9. **Deliver:** the MP4 in the user's folder, project kept under `~/Movies/` for changes, credits for anything licensed.

## Copying shared files
Toolkits are copied into a project from their home template (the lead's SKILL.md "Setup" shows the `cp` line). Copy a borrowed file the same way, from its home, never from another project, so fixes travel. Don't fork a helper inside a project; improve it at home and say so.
