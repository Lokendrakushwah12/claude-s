"""lyrics.txt -> lyrics.js for the caption layer. One caption per line: `<start s> | <text>`.
A token `@<s>` inside the text makes the words after it appear at that time (the caption builds word by word, like the
reference); without markers, the words appear evenly over the first half of the line. A line shows until the next one
starts (or `<start s> | -` to clear the screen). Lines starting with # are comments.
A line with no `<start s> |` gets a time spread evenly between the timed lines around it (the montage, 5.87-16.4 s, when
nothing is timed), so a plain pasted block works too. When lyrics_times.json (uv run lyrics_align.py) matches, its sung word times win."""
import json, re, sys
START, END = 5.87, 16.4
raw = []  # [time or None, text], in file order
for ln in open("lyrics.txt", encoding="utf-8"):
    ln = ln.strip()
    if not ln or ln.startswith("#"): continue
    m = re.match(r"^(\d+(?:\.\d+)?)\s*\|\s*(.*)$", ln)
    raw.append([float(m[1]), m[2].strip()] if m else [None, ln])
k = 0
while k < len(raw):  # fill each run of untimed lines evenly between its timed neighbours
    if raw[k][0] is not None: k += 1; continue
    j = k
    while j < len(raw) and raw[j][0] is None: j += 1
    a = raw[k - 1][0] if k else START
    b = raw[j][0] if j < len(raw) else END
    step = (b - a) / (j - k + (1 if k else 0))
    for i in range(k, j): raw[i][0] = round(a + step * (i - k + (1 if k else 0)), 3)
    k = j
rows = sorted(raw)
untimed = sum(1 for ln in open("lyrics.txt", encoding="utf-8") if ln.strip() and not ln.strip().startswith("#") and not re.match(r"^\d", ln.strip()))
caps = []
for i, (t, text) in enumerate(rows):
    end = rows[i + 1][0] if i + 1 < len(rows) else END
    if text == "-": continue
    toks, words, at = text.split(), [], None
    for tok in toks:
        if re.fullmatch(r"@\d+(?:\.\d+)?", tok): at = float(tok[1:]); continue
        words.append([tok, at]); at = None
    plain = [k for k, (_, a) in enumerate(words) if a is None]
    for j, k in enumerate(plain):  # unmarked words: spread over the first half of the line (the first one at its start)
        prev = max([a for _, a in words[:k] if a is not None] + [t])
        words[k][1] = round(max(prev, t + (end - t) * 0.5 * (k / max(1, len(words)))), 3)
    caps.append({"t": t, "end": end, "words": words})
try: TT = json.load(open("lyrics_times.json"))["words"]  # from lyrics_align.py: each word's start in the vocals
except (OSError, ValueError, KeyError): TT = None
if TT and [len(c["words"]) for c in caps] == [len(x) for x in TT]:
    for c, ts in zip(caps, TT): c["t"], c["words"] = ts[0], [[w, a] for (w, _), a in zip(c["words"], ts)]
    for c, n in zip(caps, caps[1:] + [None]): c["end"] = n["t"] if n else END
    print("lyrics.js: every word timed to the singing (lyrics_times.json)")
else:
    if TT: print("lyrics_times.json no longer matches lyrics.txt: run `uv run lyrics_align.py` again")
    if untimed: print(f"lyrics.txt: {untimed} line(s) had no time; spread them evenly (`uv run lyrics_align.py` times them to the singing)")
open("lyrics.js", "w", encoding="utf-8").write("window.KLYR = " + json.dumps(caps, ensure_ascii=False) + ";\n")
print(f"lyrics.js: {len(caps)} captions, {sum(len(c['words']) for c in caps)} words")
