# Reference library

These references have already been deconstructed. Reuse the notes, and add a new entry whenever you analyse a new reference.

Each entry has two parts:
- **TAKE:** techniques that transfer to another brand.
- **LEAVE:** things that are recognisably theirs. Reproducing them makes a copy, not a new film.

---

## Whop brand film, @az_andrian
`x.com/az_andrian/status/2104495114534133847` · 10.9 s · 1920×1080 · 152 BPM

**TAKE**
- A cut every 1–2 beats.
- Huge grotesk type on grid paper, with small editorial meta labels (year, chapter, product name).
- Three colours, with the grounds alternating paper / dark / accent.
- Type enters with a masked baseline rise, and small labels scramble in letter by letter.
- A match cut on a glyph.

**LEAVE**
- The shot order: One / Two / Talking Points / 5 / lockup.
- The poster wall pull-back, the tiled giant "2"s and the 3D "0".
- The "Talking Points" marquee, the pill tunnel and the scattered 5s.
- The lockup construction guides used exactly as shown.

**Used in:** `examples/keychain-v1-swiss.js`. That film took far too much: it reproduced all 13 shots in order and the user rejected it for that. Don't repeat it.

---

## Portfolio reel, @Jerrythe2d
`x.com/Jerrythe2d/status/2104236249855017381` · 21 s · 2958×2160

**TAKE**
- A bright neutral stage.
- Content on floating screens set on a **concave curved wall** that bends toward the viewer at the edges, with a soft floor reflection.
- A calm horizontal travel between items.
- Every screen has its own small UI moment (a cursor, a "Booked ✓" chip).

**LEAVE**
- The iridescent cyan-to-violet glass side panels.
- The `{ Name }` bracket title above each screen.
- The blue checkerboard bookends.
- The client-by-client portfolio structure.

**Used in:** v2's supplier conveyor (`bend()` plus the reflection baked into the strip).

---

## Nexus Labs launch film, @Kendel4204k
`x.com/Kendel4204k/status/2104168085687267716` · 50.5 s · 1920×1080

**TAKE**
- A slow, narrated pace, one idea every 1.5–2 s.
- Small centred narration whose words arrive out of a blur.
- Cream grounds with tiny printed technical marks, alternating with deep dark grounds.
- Glass UI cards and a prompt that types itself, with a cursor.
- A logo mark on dark to close.

**LEAVE**
- The "Not all AI models think the same" script.
- The model-logo tiles in perspective, the multi-model analysis cards and the diagonal card cascade.
- The toolbar over stock footage.
- The chrome ribbon, the cyan god-rays and the smoke lines.

**Used in:** v2 narration (`words()`), the prompt field (Keychain's real "Generate Products" feature), and `marks()` redone as packaging lot codes.

**Lighting lesson:** striped volumetric beams read as stage curtains, and the user called them bad. Use one broad soft `keylight()` plus `dust()` instead.
