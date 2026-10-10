# claude-s

Skills that let Claude (Opus 5.5 in Claude Code) make and edit videos. Each video is written as code: canvas animation rendered frame-exact in headless Chrome, or title cards cut to a local AI voice. Sound is synthesised, so there's no stock audio. The only API keys are optional ones.

| Skill | What it makes |
|---|---|
| [`type-film`](skills/type-film) | An original 10–30 s brand motion film from reference videos plus the brand's own site: kinetic type, glass UI, camera moves, a synthesised score |
| [`promo-video`](skills/promo-video) | A SaaS launch promo built from a product's repo or site, with its real logo, colours, fonts and UI. Renders 16:9, 1:1 and 9:16 |
| [`music-video`](skills/music-video) | A lyric-driven music video from a song file: kinetic lyrics, a mascot, beat-synced cuts and a papery hand-drawn look |
| [`story-video`](skills/story-video) | A narrated kinetic-typography story (founder story, recap) as a finished MP4: a card per phrase, expressive Chatterbox voice, SFX and a music drop |
| [`x-video-frames`](skills/x-video-frames) | Frames and a contact sheet from an x.com video, for taking a reference apart |
| [`explorable-explainer`](skills/explorable-explainer) | The odd one out: an interactive "how does X work" essay with animated line-art figures, published as a claude.ai Artifact |

## Install

```bash
git clone https://github.com/Lokendrakushwah12/claude-s.git
cp -R claude-s/skills/* ~/.claude/skills/
```

Install them together. `type-film` and `promo-video` copy helpers from the `music-video` and `promo-video` templates in `~/.claude/skills/`, and all three render through `music-video/template/render.mjs`.

## Requirements

- macOS, with Google Chrome in `/Applications` (set `CHROME=` to use another path).
- `node` 18+, `ffmpeg` and `uv`. `render.mjs` drives Chrome over raw CDP, so there's no `npm install`.
- `yt-dlp` for `x-video-frames`.
- `story-video` needs a one-time `sh ~/.claude/skills/story-video/setup.sh`, which installs Chatterbox (local TTS, a few GB on first use).
- Optional, for `music-video`: `FAL_KEY` (image and video generation for character sheets and sets) and `ELEVENLABS_API_KEY` (SFX).

## Use it

Describe the video; the matching skill triggers on its own.

> "here's a reference https://x.com/… make one like it for our brand, site is acme.dev"

> "make a 20s launch promo for this repo, vertical too"

> "make a music video for ~/Downloads/song.mp3, lyrics are in lyrics.txt"

> "30 second founder story: ex-banker, quit to build a budgeting app, 40k users now. brand Pennywise"

> "make an interactive explainer on how a pin tumbler lock works"

Each video skill keeps its projects in their own folder under `~/Movies/`, with the source next to the rendered MP4, so you can ask for changes later.

## License

MIT
