# Hooks: the first 1–3 seconds

The opening line and the opening picture decide whether anyone sees the rest. This guide is for whoever writes the script or picks the opening line in any claude-s skill. Write the hook last, after you know what the video actually pays off.

## What a hook has to do
- **Land in 1–3 s.** The first spoken words and the first frame carry it. Cut any warm-up ("so", "hey guys", a logo).
- **One emotion, one promise, one idea.** If you need "and" to say it, it's two hooks; pick one.
- **Be clear before clever.** A plain line that a scrolling thumb understands beats a pun it has to decode.
- **Voice and screen do different jobs.** The spoken line makes the promise; the on-screen text names the topic or the stakes in 2–5 words. Don't caption the hook word for word as the title.
- **Open a loop, then rehook.** Raise a question the video answers, then give a second pull between 3 and 10 s (a reveal, a number, a turn) before attention drops.
- **Never fake proof.** No invented numbers, results, screenshots or credentials. If there's no real proof, use a different family.
- **Talk to one person.** "You", not "you guys" or "everyone".
- **Short:** under about 15 spoken words, ideally under 10.

## Hook families (fill in the brackets)
**Pain**
- "If <pain> keeps happening, it's probably <cause>."
- "<Task> shouldn't take you <time>."

**Contrarian**
- "<Common advice> is why your <thing> isn't working."
- "Stop trying to <popular goal>. Do <different thing>."

**Curiosity gap**
- "There's one <setting/step/word> that changes <outcome>."
- "I didn't expect <thing> to be the reason <result>."
- "Nobody talks about what happens after <milestone>."

**Authority or proof** (only with proof you can show on screen)
- "I've <done X> <real number> times. Here's what actually matters."
- "This <real result> came from one change."

**Story or behind the scenes**
- "<Time> ago I <mistake or moment>. Here's what happened."
- "This is what <making/doing X> actually looks like."

**Identity**
- "If you're a <who> who <situation>, watch this."
- "<Who>, this one's for you."

**Transformation**
- "<Before state> to <after state> in <real time>. Here's the part that mattered."
- "Same <thing>, <one change>, completely different <result>."

**Uncomfortable truth**
- "Your <thing> isn't the problem. <Real cause> is."
- "Most <who> won't like this, but <truth>."

**Cliffhanger**
- "I almost <bad outcome> because of <small thing>."
- "Wait until you see what <thing> does at the end."

**Controversial or unpopular opinion**
- "Unpopular opinion: <claim you can defend>."
- "<Popular thing> is overrated for <who>."

**Lesson / wish I knew**
- "I wish someone had told me <lesson> before <moment>."
- "<Number> years of <thing> taught me one thing: <lesson>."

**Same input, different result**
- "Same <ingredients/tools/budget>. Two results. The difference is <one thing>."
- "We both <did X>. Mine <result A>, theirs <result B>. Here's why."

**Numbers and specifics** (real numbers only)
- "<Exact number> <units> in <time>, and how."
- "It costs <real amount> to <thing>. Here's where it goes."

**Negative urgency**
- "Stop <doing X> before you <consequence>."
- "Don't <common action> until you've seen this."

## Visual hooks (no face needed)
| Hook | How it reads | Where it lives |
|---|---|---|
| Newspaper lowered from the face | a "headline" drops to reveal the speaker | footage in `ugc-edit`; drawn: a `slip` or `clipSheet` sheet on a `spr` slide-down |
| Step-over floor reveal | a foot or object crosses the lens and the scene changes behind it | `matteCut` (the silhouette bridges the cut, swoosh + flash_hit) |
| Poster unroll | the title opens out of a band | `slitReveal` (type.js); real paper in `ugc-edit` |
| Reverse motion of a tiny action | spilled sugar jumps back into the spoon | `rewind` + `drawAt` (type.js), or a reversed clip in `aura-edit` / `ugc-edit` |
| Slow stirring cup, ambient motion | a calm loop with one moving thing | `faceless-video` voiceless mode; drawn: `propArt('cup')` in a `cutout` |
| Red-pen circle | the key detail gets circled as the line lands | `scribble(c, 'circle', ...)`, `doodleTrace`, `loopArrow` (type.js) |
| Matte cut into the topic | a white silhouette flashes across the first cut | `matteCut` |
| Zoom-through | punch into shot A, land zoomed on B | `zoomThrough` |
| Window hop | B hops in as frame-in-frame on black, then fills | `windowCut` |
| Cut-out pop | a prop sticker springs in on the keyword | `cutout` + `propArt`, ugc-edit stickers |
| Scribble wipe | a marker scribble covers the frame and reveals the payoff | `scribbleWipe` (scratch in, squeak out) |

Browse them in `gallery/` (`?q=` with the helper name) and paste the pick as `#Txxx`.

## Anti-slop rules for scripts
- **Banned openers:** "In this video", "Let's dive in", "Here's the thing", "Picture this", "Did you know", "Buckle up".
- **No staccato triplets** ("Fast. Simple. Powerful.") and no question-answer lists ("The price? High. The quality? Low.").
- **No hype adjectives:** game-changing, insane, mind-blowing, revolutionary, ultimate.
- **Talk like a person:** join ideas with "see", "so", "meaning", "which is why", not with dashes and lists.
- **Contrast does the work:** "most people do <X>, but <what works>".
- **Explain the mechanism,** not just the claim: why it works, in one sentence.
- **Don't announce the conclusion.** Put the facts in order and let the viewer land it.
- **CTA soft and specific:** "save this for your next <task>", not "like, comment and subscribe".

## Hindi and Hinglish
Caption in Roman Hinglish (what readers type), voice in full Devanagari with English words transliterated. See type-film's **Narrated films** paragraph in `~/.claude/skills/type-film/SKILL.md` (section 4, Build).

## Run this on every hook before rendering
1. Read it aloud: under 15 words, one idea, clear without the picture?
2. Mute it: does the first frame plus the on-screen text still make someone stop?
3. Is every number, result and claim real and shown?
4. What's the rehook between 3 and 10 s, and does the body pay off the promise?

## Sources
Patterns paraphrased and regrouped in our own words from:
- SocialSync hook carousels, incl. https://in.pinterest.com/pin/1136947868453689781/
- Techvint, "50 hooks"
- adoremyspace, "50 hooks"
- lecreativecontent
- Beerspitnight, viral-reel-generator (MIT)
- arhamhi, hooksmith (MIT)
- charlie947, reels-scripting
- outscal, script-agent
