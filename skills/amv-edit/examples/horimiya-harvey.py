"""Worked example: the per-project block from "Horimiya x Harvey" (Her's), 3:30, 108 shots.
Paste into template/plan.py between the ===== lines to see a full story arc.

Refs come from that edit's library: "L<n>" = episode 1-2 shots (built before shots.py existed),
"N<n>" = shots of a fan AMV used for scenes the episode clips lacked, "E4-28" style = shots.py refs.
Song map (song.py): quiet intro, DROP measured at 16.6 s (not the 15.4 boundary guess), verses
31-56 and 84-111, choruses 56-84 / 111-139 / 165-192, bridge 139-165, outro 192-210.
Story: one beat per section, following the series in order (episode summaries help pick pools).
"""
END = 210.0
WATERMARK = "LEGEND AWAKENS"
SECTIONS = [
    (0.0,   16.6,  "intro",  "E3-17 L41 L2 L4 L5 E6-1 L11 L7 L0"),                      # sky, school, Hori
    (16.6,  31.0,  "lift",   "L13 L14 L18 N16 N17 L19 L20 L25 L21 L22 L27 L29"),        # E1: the reveal
    (31.0,  56.0,  "calm",   "E3-1 E3-3 E3-5 E3-7 E3-8 L24 L30 E3-9 E3-10 L31 L36 L38 L40"),  # lonely Miyamura -> Hori
    (56.0,  84.4,  "chorus", "L45 L46 L48 L49 L54 L55 L59 L63 L64 L65 L66 L67 L73 L74 "
                             "E3-19 E3-23 E3-28 E3-29 E3-30 E3-32"),                     # the run, colour splash, hands
    (84.4,  111.4, "calm",   "E4-1 E4-11 E4-24 E4-26 E4-29 E4-28 E4-21 E4-22 E4-23 E4-30 "
                             "E4-31 E4-33 E5-1 E5-2"),                                   # E4: sick Hori, the confession
    (111.4, 139.6, "chorus", "E5-7 E5-10 E5-12 E5-14 E5-16 E5-17 E5-20 E5-22 E5-24 E5-25 "
                             "E5-26 E6-4 E6-5 E6-6 E6-10 E6-12 E6-14 E6-27 E6-29 E6-30"),  # E5 night walk, E6 haircut
    (139.6, 165.5, "calm",   "E7-49 E7-50 E7-52 E7-55 E7-60 E7-61 E7-62 E7-63 E7-69 E7-75 "
                             "E7-76 E7-79 E7-80 E7-82 E7-85 E7-86 E7-81 E7-88"),         # E7: the night together
    (165.5, 192.2, "chorus", "E12-1 E12-10 E12-11 E12-12 E12-17 E12-24 E12-15 E12-16 E12-18 E12-19 E12-21 E12-23 "
                             "E12-25 E12-26 E12-27 E12-28 E12-22"),                      # E12: the proposal
    (192.2, 210.0, "calm",   "E13-23 E13-36 E13-30 E13-31 E13-47 E13-51 E13-52 E13-53 E13-58 E13-60"),  # E13: graduation
]

CARDS = [
    {"at": 0.534, "dur": 3.6, "bg": "black", "lines": [            # branding, over black
        {"text": "LEGEND AWAKENS", "font": "serif", "size": 118, "track": 0.42, "y": 0, "move": "up"}]},
    {"at": 16.6, "dur": 3.8, "bg": "dim", "lines": [             # title, on the drop (measured onset)
        {"text": "HORIMIYA", "font": "serif", "size": 62, "track": 0.62, "y": -78, "move": "down"},
        {"text": "HARVEY", "font": "sans", "size": 168, "track": 0.05, "y": 34, "delay": 0.15, "move": "up", "edge": True}]},
    {"at": 201.5, "dur": 5.2, "bg": "none", "lines": [            # end card over the blossoms
        {"text": "HORI & MIYAMURA", "font": "serif", "size": 84, "track": 0.4, "y": 0, "move": "up"}]},
]

LYRICS = [
]
VOICE = {"E4-29": {"gain": 6.0, "sub": ""},    # the confession (1:28); subtitle text from the user
         "E7-69": {"gain": 6.0, "sub": ""},    # the night (2:25)
         "E13-31": {"gain": 6.0, "sub": ""}}   # graduation (3:20)
EXACT = [16.6]   # the measured drop
