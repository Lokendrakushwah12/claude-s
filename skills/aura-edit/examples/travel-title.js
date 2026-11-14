// ---- kashmir-dnd v2: a title sequence of our own, then the montage on the song's 2-beat grid from 5.87 s.
// 0-2.94 Sonamarg valley, "kashmir" rising behind the ridge (shot 0 has behind: "sky", skymatte.py); 2.94-5.87 two friends
// walking into the valley, the four places landing one per beat; then lyrics only. aura.json runs at bpm 60 (beats = seconds).
// Appended to video.js after the template's own code. Every frame is graded already (aura.json grade: grade.cube).
const K_CUT = beatT(5.87), K_WALK = beatT(2.94), K_BEAT = 60 / 136.4;
const K_FONT = '-apple-system, system-ui, "SF Pro Display", "Helvetica Neue", sans-serif';
const K_PLACES = ['srinagar', 'gulmarg', 'pahalgam', 'sonamarg']; // from the clips' GPS, in the order the trip went
const K_DATES = '30.09 — 03.10.2026';                         // the clips' creation dates

function kType(c, s, x, y, size, o = {}) { // one line of system-font type; track in em
  c.save(); c.font = `${o.weight || 400} ${size}px ${K_FONT}`; c.letterSpacing = `${(o.track || 0) * size}px`;
  c.textAlign = o.align || 'center'; c.textBaseline = 'alphabetic'; c.globalAlpha *= o.a ?? 1; c.fillStyle = o.color || '#fff';
  if (o.shadow) { c.shadowColor = `rgba(0,0,0,${o.shadow})`; c.shadowBlur = size * 0.35; }
  if (o.blur) c.filter = `blur(${o.blur}px)`;
  c.fillText(s, x, y); c.restore();
}

// the title: each letter rises up out of the ridge, from 12 % below and a 2 % blur to sharp, 50 ms apart (the user asked for
// "bottom to top with blur fade"), drawn between footage and sky matte so it emerges from behind the mountains.
// Behind the mountains: the skyline runs 0.35 H (left) to 0.27 H (the peak, right) across the word (measured on the sky matte,
// in screen space). 0.24 H type on a 0.36 baseline puts the ridge through the lower half of the x-height mid-word: the left
// letters stand almost whole and the peak swallows most of "ir".
const K_TITLE = 'kashmir';
function kTitle(c, t) {
  if (t >= K_WALK) return;
  const size = H * 0.24, track = -0.02 * size, y = H * 0.36;
  c.save(); c.font = `600 ${size}px ${K_FONT}`; c.letterSpacing = `${track}px`;
  const x0 = (W - (c.measureText(K_TITLE).width - track)) / 2;
  const xs = [...K_TITLE].map((_, i) => x0 + (i ? c.measureText(K_TITLE.slice(0, i)).width : 0)); c.restore(); // kerned advances
  [...K_TITLE].forEach((ch, i) => {
    const t0 = 0.15 + 0.05 * i, p = ease.out(prog(t, t0, t0 + 0.9)); if (p <= 0) return;
    kType(c, ch, xs[i], y + H * 0.12 * (1 - p), size, { weight: 600, track: -0.02, a: p, blur: H * 0.02 * (1 - p), align: 'left' });
  });
  const q = ease.out(prog(t, 0.75, 1.5));
  kType(c, K_DATES, W / 2, H * 0.12 + H * 0.02 * (1 - q), H * 0.019, { weight: 500, track: 0.32, a: 0.9 * q, blur: H * 0.006 * (1 - q), shadow: 0.25 });
}
// the places: one per beat from the cut, low and small, like a film's location card. Widths are measured without the
// trailing letter-space that letterSpacing adds after the last glyph, and drawn left-aligned so the dots sit centred
function kPlaces(c, t) {
  if (t < K_WALK || t >= K_CUT) return;
  const size = H * 0.021, track = 0.28 * size, gap = size * 2.4; c.save(); c.font = `500 ${size}px ${K_FONT}`; c.letterSpacing = `${track}px`;
  const ws = K_PLACES.map(w => c.measureText(w).width - track), total = ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1); c.restore();
  let x = (W - total) / 2; const y = H * 0.9;
  K_PLACES.forEach((w, i) => {
    const t0 = K_WALK + 0.1 + i * K_BEAT, a = ease.out(prog(t, t0, t0 + 0.25));
    kType(c, w, x, y + H * 0.008 * (1 - a), size, { weight: 500, track: 0.28, a, shadow: 0.35, align: 'left' });
    if (i < ws.length - 1) kType(c, '\u00b7', x + ws[i] + gap / 2, y, size, { a: 0.7 * ease.out(prog(t, t0 + K_BEAT, t0 + K_BEAT + 0.25)), shadow: 0.35 });
    x += ws[i] + gap;
  });
}
LAYERS.push((c, t) => kTitle(c, t));

// ---- captions from lyrics.txt (lyrics.py -> lyrics.js), in the reference's style, measured on its frames: the system font
// (SF) at weight 400, all lowercase with curly apostrophes, x-height 2.4 % of the height, baseline 51 % down, centred, plain
// white with no visible shadow, the line building word by word on the sung onsets. The text is the user's; nothing here writes any.
function kLyrics(c, t) {
  if (t < K_CUT) return; // lyrics only over the montage: the title sequence carries the intro
  const cap = (window.KLYR || []).find(l => t >= l.t && t < l.end); if (!cap) return;
  const str = cap.words.filter(([, at]) => t >= at).map(([w]) => w).join(' ').toLowerCase().replace(/'/g, '’'); if (!str) return;
  c.save(); c.font = `400 ${Math.round(H * 0.0475)}px ${K_FONT}`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = H * 0.004; c.fillText(str, W / 2, H * 0.511); c.restore();
}
{ const o0 = VIDEO.overlay; VIDEO.overlay = (c, t) => { o0(c, t); kPlaces(c, t); kLyrics(c, t); }; }
