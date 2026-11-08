"""Worked example: a 13.5 s kinetic-type short (Horimiya x Harvey, song 57.77-71.29) matched to a
reference lyric edit. Cut times, flash pops and word entrances are the reference's measured times
(same audio via songmatch.py, so the same beats); each word arrives in syllable chunks on the
measured vocal onsets. The reference spells out lyrics; this one uses non-lyric words (the song
title, the characters' names) - the user supplies any other lines. Writes plan JSON for amv.py.

    python3 horimiya-harvey-short.py > short.json && uv run amv.py short.json short.mp4

Refs: "L<n>" = episode 1-2 shots from that project's lib.json, "E7-57" style = shots.py refs.
"""
import json, os, sys

W = "."   # the project folder holding lib.json / clips.json (that project's libraries)
SONG = "Harvey.mp3"
ST = os.path.expanduser("~/.claude/skills/ugc-edit/stickers")
LIB = {f"L{i}": s for i, s in enumerate(json.load(open(f"{W}/lib.json")))}
for c in json.load(open(f"{W}/clips.json")):
    if c["shots"]:
        a, b = max(c["shots"], key=lambda s: s[1] - s[0]); LIB[c["ref"]] = [c["file"], a, b]

END = 13.514
# (start, shot): close-ups, cut on the reference's cut times
# warm close-ups only (sunset, red-lit room, golden light): the reference's look is one warm palette
# deep, warm, saturated close-ups: white/pastel backgrounds turn grey under the matte grade
SHOTS = [(0.00, "E7-57"), (0.63, "E4-30"), (1.70, "E7-61"), (2.50, "E4-31"), (2.93, "E7-56"),
         (3.37, "E13-58"), (4.00, "L71"), (5.03, "E4-28"), (5.87, "L20"), (6.30, "E7-40"),
         (6.77, "E4-24"), (7.37, "L19"), (8.27, "E13-14"), (9.03, "E7-58"), (10.07, "E13-16"), (11.80, "E13-60")]
FLASH = [1.70, 3.38, 3.46, 5.88, 10.35, 11.80]   # the reference's pops (strobe pairs kept)
SHAKE = {1.70, 3.37, 11.80}

shots = []
for k, (at, r) in enumerate(SHOTS):
    f, a, b = LIB[r]
    nxt = SHOTS[k + 1][0] if k + 1 < len(SHOTS) else END
    screen = nxt - at
    off = max(0.12, (b - a - screen) / 2)        # middle of the source shot
    # no push-in: the reference's shots hold still between cuts (only the vertical shakes move)
    s = {"at": at, "clip": f, "in": round(a + off, 3), "t": "cut" if k else "blur", "speed": 1.0, "zoom": 1.0, "src": r}
    if at in SHAKE: s["shake"] = True
    shots.append(s)

GOLD, RED, CREAM = [228, 182, 54], [206, 22, 30], [245, 238, 228]
def word(at, dur, text, color, chunks, small=None, small_delay=0.45, size=400):
    # chunks: [[letters, seconds after `at`], ...] - each syllable lands on its sung onset, like the reference
    # heavy high-contrast serif squeezed to 58%: tall, very condensed letters like the reference's; flat, little glow
    lines = [{"text": text, "font": "heavy", "size": size, "sx": 0.58, "track": 0.0, "y": -40, "color": color,
              "glow": 0.18, "halo": 0.4}]
    if small: lines.append({"text": small, "font": "sans", "size": 64, "track": 0.04, "y": -290, "small": True,
                            "delay": small_delay, "color": CREAM})
    return {"at": at, "dur": dur, "bg": "none", "chunks": chunks, "lines": lines}
# chunk times = vocal onsets (song.py-style detection on the voice's harmonic part), nearest each
# word's measured entrance, then spaced >= 3/4 of the reveal window per chunk
CARDS = [
    word(0.20, 1.68, "HARVEY", GOLD, [[3, 0.01], [3, 0.51]]),                          # HAR 0.21, VEY 0.71
    word(1.88, 1.57, "HORI", RED, [[2, 0.0], [2, 0.56]], "kyouko"),                   # HO 1.88, RI 2.44
    word(3.57, 1.55, "&", GOLD, [[1, 0.0]], size=440),
    word(5.23, 3.10, "MIYAMURA", RED, [[2, 0.09], [2, 0.56], [2, 0.88], [2, 1.21]], "izumi", 1.4),
    word(8.43, 1.50, "HORIMIYA", RED, [[2, 0.09], [2, 0.51], [2, 0.80], [2, 1.18]]),
    word(9.98, 3.47, "HARVEY", GOLD, [[3, 0.0], [3, 0.46]], "her's", 0.9),             # HAR 9.98, VEY 10.44
]
plan = {"song": SONG, "song_start": 57.77, "fps": 24, "end": END, "shots": shots, "flashes": FLASH, "cards": CARDS,
        "watermark": "", "credit": ["© 2026 LEGEND AWAKENS", "HARVEY - HER'S"], "fade": [0.5, 0.03, 0.6],
        # matched to the reference: warm orange-red matte (R-B ~60), rich colour, lifted blacks,
        # highlights held under ~165, crisp (no edge blur, little bloom)
        "grade": {"curve": "0/0.06 0.25/0.245 0.5/0.445 0.8/0.655 1/0.74", "contrast": 1.0, "sat": 1.45,
                  "balance": "rs=0.10:gs=0.02:bs=-0.10:rm=0.085:bm=-0.085:rh=0.05:bh=-0.07",
                  "bloom": 0.12, "vignette": "PI/5", "sharpen": 1.3,
                  # the reference's edges: strong radial zoom blur from ~1/3 out, sharp centre
                  "edge": 3, "edge_zoom": 0.10, "edge_start": 0.28}}
json.dump(plan, sys.stdout, indent=1)
