# claude-s

Skills that let Claude (Opus 5.5 in Claude Code) make and edit videos. Every frame is drawn in code (canvas animation rendered frame-exact in headless Chrome) or cut from real footage with a virtual camera. Every sound is synthesised: sub booms, whooshes, clicks, paper, CRT, music beds. Voices come from a local AI model. The only API keys are optional ones.

| Skill | What it makes | Demo |
|---|---|---|
| [`ugc-edit`](skills/ugc-edit) | A creator-style edit of your own footage. It takes a talking head, podcast or screen recording and cuts it on the words with an always-moving camera, hot-keyword captions that keep off the face (optionally behind the speaker), inserts, and a sound on every cut. It drops false starts and retakes, keeps laughs, renders hook variants, mixes in product demos, chapter cards, riso posters and collections (stamps, polaroids, grids), and exports the cut as FCPXML and EDL | [ugc-edit.html](demos/ugc-edit.html) |
| [`aura-edit`](skills/aura-edit) | A music-led "aura farming" hype edit of footage or stills, locked to one beat grid: frame-exact speed ramps, punches, shake, impact frames, a stills strobe, slammed and masked type, a crushed glowing grade and a synthesised bed with a real drop | coming soon |
| [`faceless-video`](skills/faceless-video) | A faceless video from a script or a theme: narrated with a human-sounding local voice and word captions, or voiceless with a fully synthesised natural soundscape and foley on what's in shot. B-roll from public-domain archive film, your clips or canvas scenes | [faceless-video.html](demos/faceless-video.html) |
| [`type-film`](skills/type-film) | An original 10–30 s brand motion film from reference videos plus the brand's own site. Styles include Swiss type, cinematic, screen HUD, 80s vector CRT, single-take morph, line catalogue and isometric product | [type-film.html](demos/type-film.html) |
| [`promo-video`](skills/promo-video) | A SaaS launch promo built from a product's repo or site, using its real logo, colours, fonts, UI and numbers, with a cursor that moves like a hand and silky 60 fps motion. Renders 16:9, 1:1 and 9:16 | [promo-video.html](demos/promo-video.html) |
| [`explainer-lesson`](skills/explainer-lesson) | A narrated, animated lesson on one hard concept, with picture, sound and voice on one clock. Looks include blueprint, chalkboard, gouache, riso, graphite stop-motion and hairline | [explainer-lesson.html](demos/explainer-lesson.html) |
| [`music-video`](skills/music-video) | A lyric-driven music video from a song file, a spoken-word lyric essay over a synthesised bed, or an animated character short where the music is the action: karaoke words, live counters, beat-cut scenes, and `toon.js` acting (pose to pose, squash and stretch, faces, mouths on syllables) | [music-video.html](demos/music-video.html) |
| [`story-video`](skills/story-video) | A narrated kinetic-typography story (founder story, recap): a card per phrase, an expressive Chatterbox voice, ducked music, a sub on every hard cut | [story-video.html](demos/story-video.html) |
| [`explorable-explainer`](skills/explorable-explainer) | An interactive "how does X work" essay with line-art and isometric figures you scrub and pick, published as a claude.ai Artifact | [explorable-explainer.html](demos/explorable-explainer.html) |
| [`archive-footage`](skills/archive-footage) | Public-domain archival clips (countdowns, grain plates, old streets) with each licence verified at the original archive, and credits written for you | [archive-footage.html](demos/archive-footage.html) |
| [`x-video-frames`](skills/x-video-frames) | Frames from an x.com video. `deconstruct.py` takes any reference apart: cuts, spectrogram, SFX events, beats, ducking, words, camera drift | [x-video-frames.html](demos/x-video-frames.html) |

Each demo page is self-contained, with the video and its sound embedded. Download it and open it in a browser.

## Install

```bash
git clone https://github.com/Lokendrakushwah12/claude-s.git
cp -R claude-s/skills/* ~/.claude/skills/
```

Install them together. The skills share three toolkits, which they copy from each other's templates in `~/.claude/skills/`:

| Template | Shared files | What they do |
|---|---|---|
| `music-video/template` | `render.mjs`, `lib.js`, `toon.js` | the frame-exact renderer (`--still`, `--subframes` motion blur, `--smooth` 60 fps with a real shutter and `VIDEO.blur` windows, `--motioncheck` judder test, `--loopcheck`), the easing and timing helpers, `smoothText` for slow-moving type, 3D through Three.js (`gl3d`, a lit `phone3d` whose screen is any drawing), a typing `codeBlock`, and `toon.js` character acting |
| `promo-video/template` | `sfx.py`, `promo.js` | 59 synthesised sounds, beds, voice ducking, sound levels by family, and `autocue` for edits |
| `type-film/template` | `type.js`, `look.js`, `iso.js`, `filmlook.sh` | about 70 type and motion devices (including aura hits: speed ramps, punches, impact frames), film and screen looks, isometric solids, an ffmpeg film-look pass, and `creative.md`, the method the skills follow to get past derivative ideas |

## Requirements

- macOS, with Google Chrome in `/Applications` (set `CHROME=` to use another path).
- `node` 18+, `ffmpeg` and `uv`. 3D scenes load Three.js from jsdelivr at render time, so they need a network connection. `render.mjs` drives Chrome over raw CDP, so there's no `npm install`; Python steps pull their own packages through `uv`.
- `yt-dlp` for `x-video-frames`.
- Voice: `story-video`, `explainer-lesson`, `music-video`, `ugc-edit` and `faceless-video` narrate with Chatterbox. Install it once with `sh ~/.claude/skills/story-video/setup.sh` (a local TTS model; a few GB on first use). `explainer-lesson` falls back to macOS `say`. Narrated `type-film`s use [Kokoro](https://github.com/hexgrad/kokoro) (82M, Apache-2.0) by default: fast, and it reads Hindi cleanly (`brew install espeak-ng`; `uv` pulls the rest). For a Hindi voice with Chatterbox, its multilingual model is another ~3 GB.
- Optional:
  - `FAL_KEY` and `ELEVENLABS_API_KEY` for `music-video`.
  - MediaPipe, which `ugc-edit` pulls in itself for type behind the speaker and captions that keep off the face.

## Use it

Describe the video; the matching skill triggers on its own.

> "cut this podcast clip like a creator edit, vertical, captions and sfx" (`~/Downloads/ep12.mp4`)

> "turn this screen recording into a 60 second tutorial"

> "here's a reference https://x.com/… make one like it for our brand, site is acme.dev"

> "make a 20s launch promo for this repo, vertical too"

> "make an explainer video on why a hash table finds things so fast"

> "make an interactive explainer on how a mechanical keyboard switch works"

> "30 second founder story: ex-banker, quit to build a budgeting app, 40k users now. brand Pennywise"

> "find some old film countdown footage I can use"

> "make an aura edit of this clip, phonk drop, speed ramps" (`~/Downloads/drive.mov`)

> "a faceless reel about the sea with no voice, just natural sound and old film"

Each video skill keeps its projects in their own folder under `~/Movies/`, with the source next to the rendered MP4, so you can ask for changes later.

## How these were made

The skills learn from real references; they don't copy them. Each reference was taken apart for its techniques: edit rhythm, type behaviour, camera, film look, and sound measured from spectrograms. The techniques went into the toolkits. What's recognisably the original creator's (shots, copy, palettes, brands) is listed as "LEAVE" in [`type-film/references.md`](skills/type-film/references.md) and never reused. Every reference, with what each skill took from it, is on the [references page](index.html).

## Pairs well with

- [lucasmarkes/hairline](https://github.com/lucasmarkes/hairline) (MIT): `/hairline-create` draws pointer-driven isometric line figures. The isometric style in `iso.js` and explorable-explainer was inspired by it.
- [jakubkrehel/skills](https://github.com/jakubkrehel/skills): interface-review skills (`better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing`, `interface-review`, `variant`, `break`). They're handy for polishing the pages and UI these videos are made from.

```bash
npx skills add jakubkrehel/skills
```

Editing skills for your own footage. `ugc-edit` took ideas from these. Each port is our own code, with a credit comment naming its source:

- [browser-use/video-use](https://github.com/browser-use/video-use) (MIT): raw takes to `final.mp4` by conversation. The model picks the cuts and the takes from a packed phrase-level transcript, and the false starts are its judgement, not code. Transcription needs an ElevenLabs key. ugc-edit's one-line-per-breath transcript comes from it.
- [kajisho5/ffmpeg-skill](https://github.com/kajisho5/ffmpeg-skill) (MIT): 42 local ffmpeg tools (silence removal, karaoke captions, 9:16 reframing, loudness, delivery checks) with no API keys. ugc-edit's EDL layout follows its timeline export.
- [louisedesadeleer/cut-video](https://github.com/louisedesadeleer/cut-video) (MIT): tightens long recordings on forced-aligner word times and keeps laughs and comic pauses. Its rules are written for the model, not as code: ugc-edit turned the laugh test (louder than the room by 10 dB) and the false-start and retake rules into code.
- [kurbaitaev/ghost-editor](https://github.com/kurbaitaev/ghost-editor) (MIT): talking head to reel, with the best take per sentence, captions placed around the face, and SFX and music under the voice. ugc-edit's face-safe caption placement follows its placer.
- [hassancs91/claude-youtube-editor](https://github.com/hassancs91/claude-youtube-editor) (MIT): a long-form YouTube pipeline. Its `/suggest-sfx` puts library sounds on exact words and checks in dB that each one is heard (AssemblyAI and ElevenLabs keys). ugc-edit took sounds on words and the masked-cue check.
- [elevenlabs/skills](https://github.com/elevenlabs/skills) (MIT): the official skills for ElevenLabs sound effects, music and Scribe transcription (which tags laughter). Use it as an optional path when a synthesised sound won't do; it needs `ELEVENLABS_API_KEY`.
- [dmtrKovalenko/fframes](https://github.com/dmtrKovalenko/fframes) (MIT): videos written in Rust and SVG, rendered on the GPU. See below.

Hook variants are an idea from [krusemediallc/video-editor-agent](https://github.com/krusemediallc/video-editor-agent). It has no licence, so none of its code is used.

### fframes or render.mjs?

fframes isn't wired in: its scenes are Rust functions that return SVG, and these skills draw on a canvas with shared JS toolkits, so using it would mean a port rather than an adapter. Pick by job:

| | fframes | render.mjs (these skills) |
|---|---|---|
| Scenes | Rust structs returning SVG (`svgr!`), springs, SkSL and Shadertoy shader layers | JS canvas `draw(t)` with type.js, look.js, iso.js, footage frames and sfx.py |
| Renders on | the GPU (Skia on Metal or Vulkan), with ffmpeg linked in | headless Chrome over CDP, frames piped to ffmpeg |
| Speed | 128 s of video rendered in 36 s, by its README | measured here: 1080×1920 ugc-edit at ~21 fps (521 frames in 25 s) |
| Setup | the Rust toolchain plus Homebrew libs; the first build takes about a minute (prebuilt) or ~20 minutes (from source) | Chrome and node, no `npm install` |
| Checks for an agent | `inspect` (cut-off text, missing fonts), `strip`, `onion`, `audio analyze` | `--still`, `--loopcheck`, contact sheets, the skills' own review steps |

Use fframes for a new motion piece where render time dominates: long videos, batch renders, shader looks. Use these skills for real footage, the shared toolkits, or to avoid Rust.

Before a video, the research: [ScrapeCreators/social-media-research-skills](https://github.com/ScrapeCreators/social-media-research-skills) (MIT) finds a creator's outlier posts, mines comments and pulls hooks from transcripts across TikTok, Reels, Shorts and X. It needs a ScrapeCreators API key. Feed an outlier it finds to `x-video-frames` to take it apart.

Peers worth a look: [Leonxlnx/cinetic](https://github.com/Leonxlnx/cinetic) and [heygen-com/hyperframes-community-skills](https://github.com/heygen-com/hyperframes-community-skills).

## License

MIT
