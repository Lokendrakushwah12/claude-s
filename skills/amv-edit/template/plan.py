#!/usr/bin/env python3
"""Story -> plan.json for amv.py: song sections -> ordered shot pools, cut points snapped to
the beat grid. Each section's time is shared out in proportion to how long each shot can last
(down to the mood's min speed), so no shot runs past its own source boundary.

    python3 plan.py song.json library.json song.mp3 > plan.json

Edit the block between the ===== lines per project (examples/horimiya-harvey.py is a full one).
"""
import json, sys

beats = json.load(open(sys.argv[1]))["beats"]
LIB = json.load(open(sys.argv[2]))   # ref -> [file, start, end], from shots.py
SONG = sys.argv[3]

# ===================================================================== per project
END = 210.0          # song second the edit ends (fades out over the last 1.5 s)
WATERMARK = ""       # small faint corner brand for the whole video, e.g. "YOUR NAME"
# (start, end, mood, shot pool in story order). Moods: intro | lift | calm | chorus.
# Section times come from song.py's energy map; put a section start on the measured DROP.
# Pools run a bit long (the shortest middle shots get dropped first); one story beat per section.
SECTIONS = [
    (0.0,  16.6, "intro",  "E1-1 E1-2 E1-4 E1-5"),
    (16.6, 31.0, "lift",   "E1-13 E1-14 E1-18 E1-19"),
    # ...
]
# Animated text cards. Times are exact song seconds (measure them: first beat, the drop).
# lines: {"text", "font": serif|sans|script, "size", "track" (letter spacing x size), "y" (px from
# centre), "delay", "move": down|up, "edge" (fade the ends)}. bg: black | dim | none.
CARDS = [
    # {"at": 0.534, "dur": 3.6, "bg": "black", "lines": [
    #     {"text": "YOUR BRAND", "font": "serif", "size": 118, "track": 0.42, "move": "up"}]},
    # {"at": 16.6, "dur": 3.8, "bg": "dim", "lines": [
    #     {"text": "SHOW TITLE", "font": "serif", "size": 62, "track": 0.62, "y": -78, "move": "down"},
    #     {"text": "SONG TITLE", "font": "sans", "size": 168, "track": 0.05, "y": 34, "delay": 0.15,
    #      "move": "up", "edge": True}]},
]
# Words the user wants on screen, as (song s, seconds, "their words"): thin script, bottom centre,
# blur fade. The user supplies these; don't transcribe song lyrics yourself.
LYRICS = [
]
# Shots that keep their own character dialogue while the music ducks: ref -> voice gain.
# Rank candidates with voicescan.py; one per calm section is plenty.
VOICE = {}
EXACT = []       # section starts to keep exact (e.g. the measured drop); others snap to the beat
# =====================================================================

EDGE = 0.12   # trim off shot edges (a source AMV's own transitions live there)
# transitions: (type, seconds, shake). first = into the section, inner cycles inside it.
# shake is vertical, damped, and always rides a bloom flash. min = slowest speed (below 1x
# is motion-interpolated; under ~0.75x interpolation starts to smear). zoom = slow push-in end
# scale, 1.0 = off: a push on every shot reads as a constant zoom (user noticed), so opt in per mood.
STYLE = {
    "intro":  dict(first=("blur", 0.8, 0), inner=[("blur", 0.45, 0)], zoom=1.0, max=1.9, min=0.85),
    "lift":   dict(first=("flash", 0.3, 0), inner=[("qblur", 0, 1), ("zoom", 0.3, 0), ("qblur", 0, 0), ("blur", 0.4, 0)],
                   zoom=1.0, max=1.9, min=0.8, flashes=True),
    "calm":   dict(first=("blur", 1.0, 0), inner=[("blur", 0.6, 0), ("blur", 0.6, 0), ("zoom", 0.4, 0)],
                   zoom=1.0, max=3.0, min=0.75),
    "chorus": dict(first=("flash", 0.3, 0), inner=[("qblur", 0, 1), ("zoom", 0.3, 0), ("qblur", 0, 0), ("blur", 0.35, 0)],
                   zoom=1.0, max=1.7, min=0.75, flashes=True),
}

def snap(t):
    return min(beats, key=lambda b: abs(b - t))

def avail(r):
    f, a, b = LIB[r]
    return max(0.3, b - a - 2 * EDGE)

# Beat grid through the end (the tracker stops as a song fades out), then section starts on it.
step = sorted(b - a for a, b in zip(beats, beats[1:]))[len(beats) // 2]
while beats[-1] + step <= END: beats.append(round(beats[-1] + step, 3))
starts = [t0 if k == 0 or t0 in EXACT or abs(snap(t0) - t0) > 0.25 else snap(t0) for k, (t0, *_) in enumerate(SECTIONS)]
SECS = [(starts[k], starts[k + 1] if k + 1 < len(SECTIONS) else SECTIONS[k][1], m, pool)
        for k, (_, _, m, pool) in enumerate(SECTIONS)]

shots, flashes = [], []
for t0, t1, mood, pool in SECS:
    st, span, ids = STYLE[mood], t1 - t0, pool.split()
    missing = [r for r in ids if r not in LIB]
    if missing: sys.exit(f"not in library.json: {missing}")
    mn = st["min"]
    trans = lambda k: (st["first"] if k == 0 else st["inner"][(k - 1) % len(st["inner"])])
    ids = [r for k, r in enumerate(ids) if k == 0 or avail(r) / mn - 0.7 >= 0.6]  # too short to hold a blur
    # screen time each shot can carry, capped per mood so long clips keep the pace
    cap = lambda: [max(0.6, min(avail(r) / mn - trans(k)[1] - 0.05, st["max"])) for k, r in enumerate(ids)]
    while len(ids) > 3 and sum(cap()) - min(cap()[1:-1]) > span * 1.1:
        c = cap(); ids.pop(1 + c[1:-1].index(min(c[1:-1])))
    c = cap()
    if sum(c) < span: print(f"warn {t0}: pool short by {span - sum(c):.1f}s - add shots", file=sys.stderr)
    cuts, acc = [t0], t0
    for ci in c[:-1]:
        acc += span * ci / sum(c)
        cuts.append(acc)
    for k in range(1, len(cuts)):  # snap to a beat only if it keeps cuts ordered and >= 0.5s apart
        b = snap(cuts[k])
        if abs(b - cuts[k]) < 0.25 and b - cuts[k - 1] >= 0.5 and (k + 1 == len(cuts) or cuts[k + 1] - b >= 0.5) and t1 - b >= 0.5:
            cuts[k] = b
    for k, r in enumerate(ids):
        at, nxt = cuts[k], (cuts[k + 1] if k + 1 < len(ids) else t1)
        t, d, shake = trans(k)
        f, a, _ = LIB[r]
        speed = max(mn - 0.1, min(1.0, avail(r) / (nxt - at + max(d, 1 / 24) + 0.05)))
        shot = {"at": round(at, 3), "clip": f, "in": round(a + EDGE, 3), "t": t,
                "speed": round(speed, 3), "zoom": st["zoom"], "src": r}
        if t not in ("cut", "qblur"): shot["d"] = d
        if r in VOICE:  # gain, or {"gain": g, "sub": "subtitle text"}
            v = VOICE[r]; shot["voice"] = v["gain"] if isinstance(v, dict) else v
            if isinstance(v, dict) and v.get("sub"): shot["sub"] = v["sub"]
        if shake: shot["shake"] = True; flashes.append(round(at, 3))  # shake rides a bloom flash
        shots.append(shot)
    if st.get("flashes"):  # quick bloom pop every 2 bars (16 half-beats), not on the section start
        bs = [b for b in beats if t0 + 1 < b < t1 - 1]
        flashes += [round(b, 3) for b in bs[15::16]]
json.dump({"song": SONG, "fps": 24, "end": END, "watermark": WATERMARK, "shots": shots,
           "flashes": sorted(set(flashes)),
           "cards": CARDS + [{"at": t, "dur": d, "bg": "none", "lines": [
               {"text": txt, "font": "script", "size": 96, "y": 400}]} for t, d, txt in LYRICS]},
          sys.stdout, indent=1)
