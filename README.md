# claude-s

Skills that let Claude (Opus 5.5 in Claude Code) make and edit videos. Every frame is drawn in code (canvas animation rendered frame-exact in headless Chrome) or cut from real footage with a virtual camera. Every sound is synthesised: sub booms, whooshes, clicks, paper, CRT, music beds. Voices come from a local AI model. The only API keys are optional ones.

| Skill | What it makes | Demo |
|---|---|---|
| [`ugc-edit`](skills/ugc-edit) | A creator-style edit of your own footage. It takes a talking head, podcast or screen recording and cuts it on the words with an always-moving camera, hot-keyword captions (optionally behind the speaker), inserts, and a sound on every cut | [ugc-edit.html](demos/ugc-edit.html) |
| [`type-film`](skills/type-film) | An original 10–30 s brand motion film from reference videos plus the brand's own site. Styles include Swiss type, cinematic, screen HUD, 80s vector CRT, single-take morph, line catalogue and isometric product | [type-film.html](demos/type-film.html) |
| [`promo-video`](skills/promo-video) | A SaaS launch promo built from a product's repo or site, using its real logo, colours, fonts, UI and numbers. Renders 16:9, 1:1 and 9:16 | [promo-video.html](demos/promo-video.html) |
| [`explainer-lesson`](skills/explainer-lesson) | A narrated, animated lesson on one hard concept, with picture, sound and voice on one clock. Looks include blueprint, chalkboard, gouache, riso, graphite stop-motion and hairline | [explainer-lesson.html](demos/explainer-lesson.html) |
| [`music-video`](skills/music-video) | A lyric-driven music video from a song file, or a spoken-word lyric essay over a synthesised bed: karaoke words, live counters, beat-cut scenes | [music-video.html](demos/music-video.html) |
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
| `music-video/template` | `render.mjs`, `lib.js` | the frame-exact renderer (`--still`, `--subframes` motion blur, `--loopcheck`) and the timing helpers |
| `promo-video/template` | `sfx.py`, `promo.js` | 55 synthesised sounds, beds, voice ducking, sound levels by family, and `autocue` for edits |
| `type-film/template` | `type.js`, `look.js`, `iso.js`, `filmlook.sh` | about 50 type and motion devices, film and screen looks, isometric solids, and an ffmpeg film-look pass |

## Requirements

- macOS, with Google Chrome in `/Applications` (set `CHROME=` to use another path).
- `node` 18+, `ffmpeg` and `uv`. `render.mjs` drives Chrome over raw CDP, so there's no `npm install`; Python steps pull their own packages through `uv`.
- `yt-dlp` for `x-video-frames`.
- Voice: `story-video`, `explainer-lesson`, `music-video` and `ugc-edit` narrate with Chatterbox. Install it once with `sh ~/.claude/skills/story-video/setup.sh` (a local TTS model; a few GB on first use). `explainer-lesson` falls back to macOS `say`.
- Optional:
  - `FAL_KEY` and `ELEVENLABS_API_KEY` for `music-video`.
  - MediaPipe, which `ugc-edit` pulls in itself for type behind the speaker.

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

Each video skill keeps its projects in their own folder under `~/Movies/`, with the source next to the rendered MP4, so you can ask for changes later.

## How these were made

The skills learn from real references; they don't copy them. Each reference was taken apart for its techniques: edit rhythm, type behaviour, camera, film look, and sound measured from spectrograms. The techniques went into the toolkits. What's recognisably the original creator's (shots, copy, palettes, brands) is listed as "LEAVE" in [`type-film/references.md`](skills/type-film/references.md) and never reused.

## Pairs well with

- [lucasmarkes/hairline](https://github.com/lucasmarkes/hairline) (MIT): `/hairline-create` draws pointer-driven isometric line figures. The isometric style in `iso.js` and explorable-explainer was inspired by it.
- [jakubkrehel/skills](https://github.com/jakubkrehel/skills): interface-review skills (`better-ui`, `better-typography`, `better-colors`, `better-layout`, `better-accessibility`, `better-writing`, `interface-review`, `variant`, `break`). They're handy for polishing the pages and UI these videos are made from.

```bash
npx skills add jakubkrehel/skills
```

Peers worth a look: [Leonxlnx/cinetic](https://github.com/Leonxlnx/cinetic) and [heygen-com/hyperframes-community-skills](https://github.com/heygen-com/hyperframes-community-skills).

## License

MIT
