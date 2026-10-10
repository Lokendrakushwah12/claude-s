# Kinetic-typography title cards: one card per spoken phrase. Edit SCRIPT (and ASSETS, FONTS), then ./run.sh
import json
import re
import subprocess
import wave
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H = 3840, 2160
OUT = Path(__file__).parent / "cards"
ASSETS_DIR = Path(__file__).parent / "assets"


def pick(*candidates):
    """First font that exists: (path, ttc index, variable-font axes)."""
    return next(c for c in candidates if Path(c[0]).expanduser().exists())


# Variable fonts take axis values by name; the fallbacks are stock macOS fonts
FONTS = {
    "serif": pick(("~/Library/Fonts/Awesome Serif VAR-VF.ttf", 0, {"Weight": 400}),
                  ("/System/Library/Fonts/Supplemental/Didot.ttc", 0, {})),
    # Optical size 32 = Inter Display
    "sans": pick(("~/Library/Fonts/InterVariable.ttf", 0, {"Optical size": 32, "Weight": 700}),
                 ("/System/Library/Fonts/HelveticaNeue.ttc", 1, {})),
}
BLACK, WHITE, GREY = (14, 14, 16), (245, 245, 243), (38, 38, 42)
FPS = "30000/1001"  # 29.97, the usual social/broadcast rate
PURPLE, ORANGE = (104, 20, 230), (240, 110, 80)  # end-card brand colours: swap for yours
# Fallback narration when narrate.py (Chatterbox) hasn't run: macOS `say`. `say -v '?'` lists voices;
# System Settings > Accessibility > Spoken Content > Manage Voices adds better (Premium) ones. None disables it.
VOICE = "Samantha"
RATE = 235  # words per minute; say's default 175 drags
PAD = 0.05  # lines run into each other like a real read, not a pause after each
SAY = {"end": "Brand dot com."}  # what to speak when it differs from the card text
# Photo per card: fetch_assets.py searches openly licensed images for these and saves assets/<slug>.jpg.
# Any assets/<slug>.jpg|png you drop in yourself wins; photo cards without one get a grey placeholder.
ASSETS = {
    "open": "woman laptop window morning",
    "day": "office desk worker",
    "almost": "tired woman laptop night",
    "launched": "startup team celebrating office",
}

# (slug, style, text, seconds)
# styles: serif | sans | white | photo | why | end
SCRIPT = [
    ("open", "photo", "Three years ago", 1.5),
    ("had", "sans", "she had an idea", 1.0),
    ("idea", "serif", "nobody believed in", 1.5),
    ("day", "photo", "[DAY JOB] by day.", 1.5),
    ("night", "white", "Code by night.", 1.5),
    ("rejected", "sans", "rejected", 0.8),
    ("again", "serif", "again, and again", 1.5),
    ("almost", "photo", "She almost gave up.", 2.0),
    ("then", "serif", "Then one conversation", 1.5),
    ("changed", "sans", "changed everything", 1.5),
    ("asked", "sans", "Someone asked her", 1.0),
    ("why", "why", "what are you waiting for?", 1.5),
    ("launched", "photo", "So she launched [PRODUCT]", 2.0),
    ("users", "white", "[NUMBER] people use it today.", 2.0),
    ("started", "serif", "It started with one idea.", 1.5),
    ("yours", "serif", "What's yours?", 1.5),
    ("end", "end", "[BRAND]|[BRAND.COM]", 3.0),
]


def font(role, size, axes=None):
    path, index, base = FONTS[role]
    f = ImageFont.truetype(str(Path(path).expanduser()), size, index=index)
    want = {**base, **(axes or {})}
    if want:
        names = [a["name"].decode() if isinstance(a["name"], bytes) else a["name"] for a in f.get_variation_axes()]
        f.set_variation_by_axes([want.get(n, a["default"]) for n, a in zip(names, f.get_variation_axes())])
    return f


def asset(slug):
    return next((p for p in sorted(ASSETS_DIR.glob(f"{slug}.*")) if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")), None)


def wrap(draw, text, f, max_w):
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=f) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    return lines + [cur]


def centered(draw, text, f, fill, box=(0, 0, W, H), max_w=None):
    x0, y0, x1, y1 = box
    lines = wrap(draw, text, f, max_w or (x1 - x0) * 0.8)
    lh = f.size * 1.1
    y = y0 + ((y1 - y0) - lh * len(lines)) / 2
    for line in lines:
        draw.text(((x0 + x1) / 2, y + lh / 2), line, font=f, fill=fill, anchor="mm")
        y += lh


def card(slug, style, text):
    bg = {"white": WHITE, "why": (150, 150, 150)}.get(style, BLACK)
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    if style == "serif":
        centered(d, text, font("serif", 210), WHITE)
    elif style == "sans":
        centered(d, text, font("sans", 150), WHITE)
    elif style == "white":
        centered(d, text, font("serif", 200), BLACK)
    elif style == "why":
        centered(d, text, font("sans", 230, {"Weight": 800}), WHITE)
    elif style == "photo":
        box = tuple(int(v) for v in (W * 0.18, H * 0.12, W * 0.82, H * 0.88))
        photo = asset(slug)
        if photo:
            # cover-crop into the frame, darkened so the caption reads over any photo
            im = ImageOps.fit(ImageOps.exif_transpose(Image.open(photo)).convert("RGB"), (box[2] - box[0], box[3] - box[1]))
            img.paste(Image.blend(im, Image.new("RGB", im.size, BLACK), 0.4), box[:2])
        else:
            d.rectangle(box, fill=GREY)
            d.text((W / 2, H * 0.2), "PHOTO / CLIP", font=font("sans", 70, {"Weight": 500}), fill=(110, 110, 115), anchor="mm")
        centered(d, text, font("sans", 150), WHITE, max_w=W * 0.6)
    elif style == "end":
        name, url = text.split("|")
        d.rectangle((0, 0, W / 2, H), fill=PURPLE)
        d.rectangle((W / 2, 0, W, H), fill=ORANGE)
        centered(d, name, font("sans", 170), ORANGE, box=(0, 0, W / 2, H))
        centered(d, url, font("serif", 120), WHITE, box=(W / 2, 0, W, H))
    return img


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    manifest = []
    for i, (slug, style, text, secs) in enumerate(SCRIPT):
        png = OUT / f"{i:02d}-{slug}-card.png"
        card(slug, style, text).save(png)
        voice = Path(__file__).parent / "voices" / f"{slug}.wav"  # Chatterbox take from narrate.py
        if not voice.exists() and VOICE:
            # The film makes room for the voice: a card lasts at least as long as its line takes to say
            voice = OUT / f"{i:02d}-{slug}-voice.wav"
            line = SAY.get(slug, re.sub(r"[\[\]|]", " ", text))
            subprocess.run(["say", "-v", VOICE, "-r", str(RATE), "--file-format=WAVE", "--data-format=LEI16@48000",
                            "-o", str(voice), line], check=True)
        if voice.exists():
            with wave.open(str(voice)) as w:
                # the voice sets the cut, not the script's guess; only the end card keeps its hold
                secs = max(secs if style == "end" else 0.5, w.getnframes() / w.getframerate() + PAD)
        # bake each card into an exact-length clip; run.sh joins them losslessly with ffmpeg concat
        mp4 = png.with_suffix(".mp4")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-loop", "1", "-framerate", FPS, "-i", str(png),
                        "-frames:v", str(round(secs * 30000 / 1001)), "-c:v", "libx264", "-pix_fmt", "yuv420p",
                        "-tune", "stillimage", str(mp4)], check=True)
        manifest.append({"path": str(mp4), "seconds": secs, "voice": str(voice) if voice.exists() else None})
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    print(len(manifest), "cards,", sum(m["seconds"] for m in manifest), "s")
