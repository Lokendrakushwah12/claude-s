// The lesson engine: time, easing, colour, drawing, narration timing and defineLesson. Classic script with globals,
// so index.html and narrate.mjs (node vm) load it the same way. Nothing here touches the DOM at load time.

/** Logical canvas, 16:9. The page scales it to the output size (1920x1080 by default). */
const W = 960, H = 540;
/** Captions are burnt in over the bottom of the frame: nothing the viewer must read goes below this line. */
const SAFE_BOTTOM = 420;

// ---- time ----

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, p) => a + (b - a) * p;

const ease = {
  linear: (p) => p,
  in: (p) => p * p * p,
  out: (p) => 1 - (1 - p) ** 3,
  inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  back: (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2,
  elastic: (p) => (p === 0 || p === 1 ? p : 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

/** Eased 0..1 progress of `t` between `a` and `b`. */
function span(t, a, b, e = ease.inOut) {
  const p = (t - a) / (b - a);
  return p <= 0 ? 0 : p >= 1 ? 1 : e(p);
}

/** 0 -> 1 -> 0 over `len` seconds starting at `at`. */
function pulse(t, at, len = 0.4) {
  const p = (t - at) / len;
  return p < 0 || p > 1 ? 0 : Math.sin(p * Math.PI);
}

/** Progress of the i-th item of a sequence that starts at `a`, one every `gap` seconds, each taking `len`. */
function stagger(t, a, i, gap, len = 0.5, e = ease.back) {
  return span(t, a + i * gap, a + i * gap + len, e);
}

/** Visibility of something on screen from `from` to `to`: fades in over `fadeIn`, out over `fadeOut`. */
function life(t, from, to, fadeIn = 0.6, fadeOut = 0.6, e = ease.inOut) {
  return span(t, from, from + fadeIn, e) * (1 - span(t, to - fadeOut, to));
}

/** Cues for a sequence that `stagger` draws: `n` sounds from `at`, one every `gap`, pitch rising by `step`. */
function seq(at, n, gap, sound, o = {}) {
  return Array.from({ length: n }, (_, i) => ({ at: at + i * gap + (o.lead ?? 0.05), sound, pitch: (o.pitch ?? 1) + i * (o.step ?? 0), gain: o.gain }));
}

/** Index of the entry active at `t` in an ascending list of `{ at }`; -1 before the first. */
function activeIndex(list, t) {
  let i = -1;
  for (let k = 0; k < list.length; k++) if (list[k].at <= t) i = k;
  return i;
}

// ---- colour: theme values are #rrggbb, so blends feed alpha() and mix() again ----

function rgb(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`mix()/alpha() need #rrggbb colours, got ${hex}`);
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const mix = (a, b, p) => `#${rgb(a).map((v, i) => Math.round(lerp(v, rgb(b)[i], clamp(p))).toString(16).padStart(2, "0")).join("")}`;
const alpha = (hex, a) => `rgba(${rgb(hex).join(",")},${clamp(a)})`;

/** Text colour for a badge filled with `fill`: white while it keeps 3:1 contrast, else near-black (pale fills). */
function onColor(fill) {
  const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgb(fill).map(lin);
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05) >= 3 ? "#ffffff" : "#1a1a1a";
}

// ---- drawing ----

/** Font stacks, set from the look by the page before the first frame. */
const fonts = { sans: "system-ui, sans-serif", heading: "system-ui, sans-serif", mono: "ui-monospace, monospace" };

/**
 * How the current frame's lines and fills come out. applyLook() sets it every frame, so the same drawing code
 * renders as gouache, chalk, blueprint or riso. stroke: clean | chalk | riso | glow. fill: flat | speckle | halftone.
 */
const style = { stroke: "clean", fill: "flat", misregister: "#ff48b0", cards: false, texture: () => null };

/** Seeded random numbers (mulberry32): the same seed gives the same sequence, so nothing flickers. */
function rand(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable 0..1 value for an integer pair: jitter that stays put from frame to frame. */
const hash = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * Fill the current path in the look's fill style (flat, glaze speckle, halftone). `box` [x, y, w, h] adds soft
 * light-to-shade modelling, so a shape reads as an object. Draw objects with this, not bare fill().
 */
function fillWith(ctx, color, box) {
  ctx.fillStyle = color;
  ctx.fill();
  const tex = style.fill === "flat" ? null : style.texture(style.fill);
  if (!tex && !box) return;
  ctx.save();
  ctx.clip();
  if (tex) { ctx.fillStyle = tex; ctx.fillRect(-4000, -4000, 8000, 8000); }
  if (box) {
    const [x, y, w, h] = box;
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, "rgba(255,255,255,0.22)");
    g.addColorStop(0.45, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

/** o: size (18), weight (400|500|700), color, align, baseline, font (sans|heading|mono), alpha. */
function text(ctx, s, x, y, o = {}) {
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.font = `${o.weight ?? 400} ${o.size ?? 18}px ${fonts[o.font ?? "sans"]}`;
  ctx.fillStyle = o.color ?? "#000";
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = o.baseline ?? "alphabetic";
  ctx.fillText(s, x, y);
  ctx.restore();
}

function circle(ctx, x, y, r, fill, stroke, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/** A disc in the look's fill style, modelled like a small object. */
function blob(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  fillWith(ctx, color, [x - r, y - r, r * 2, r * 2]);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

/** A rounded label chip centred on (x, y), or starting at x with `left`. Returns its width. */
function pill(ctx, s, x, y, o) {
  const size = o.size ?? 16;
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.font = `500 ${size}px ${fonts.sans}`;
  const w = ctx.measureText(s).width + size * 1.4, h = size * 1.9;
  if (o.left) x += w / 2;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = o.fill;
  ctx.fill();
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.fillStyle = o.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y + 1);
  ctx.restore();
  return w;
}

/** Polyline drawn on from its start: `progress` 0..1 of its total length. */
function path(ctx, pts, color, lw = 3, progress = 1) {
  if (pts.length < 2 || progress <= 0) return;
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const stop = lens.at(-1) * clamp(progress);
  const drawn = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (lens[i] <= stop) { drawn.push(pts[i]); continue; }
    const k = (stop - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
    drawn.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]);
    break;
  }
  strokeLine(ctx, drawn, color, lw);
}

/** Stroke a polyline in the look's line style. Jitter is keyed to the point index, so it never shimmers. */
function strokeLine(ctx, pts, color, lw) {
  const line = (ps, c, w) => {
    ctx.beginPath();
    ctx.moveTo(...ps[0]);
    for (let i = 1; i < ps.length; i++) ctx.lineTo(...ps[i]);
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  if (style.stroke === "clean" || lw < 1.2) return line(pts, color, lw);
  ctx.save();
  if (style.stroke === "chalk") {
    // Two thin, slightly wandering passes: the uneven edge of chalk on a board
    for (const pass of [0, 1]) {
      ctx.globalAlpha *= pass ? 0.55 : 0.85;
      line(pts.map(([x, y], i) => [x + (hash(i, pass) - 0.5) * lw * 0.7, y + (hash(pass, i) - 0.5) * lw * 0.7]), color, lw * (pass ? 0.6 : 0.85));
    }
  } else if (style.stroke === "riso") {
    // A second ink printed a hair out of register
    ctx.globalAlpha *= 0.55;
    line(pts.map(([x, y]) => [x + lw * 0.45, y + lw * 0.35]), style.misregister, lw);
    ctx.globalAlpha /= 0.55;
    line(pts, color, lw);
  } else {
    // glow: a soft halo under a crisp line, like light on a blueprint
    ctx.shadowColor = color;
    ctx.shadowBlur = lw * 3;
    line(pts, color, lw);
  }
  ctx.restore();
}

function dashed(ctx, a, b, color, lw = 1.5, progress = 1) {
  ctx.save();
  ctx.setLineDash([5, 6]);
  path(ctx, [a, b], color, lw, progress);
  ctx.restore();
}

/** Straight arrow from a to b with a filled head; `progress` grows it from a. */
function arrow(ctx, a, b, color, lw = 2.5, progress = 1) {
  if (progress <= 0) return;
  const end = [lerp(a[0], b[0], clamp(progress)), lerp(a[1], b[1], clamp(progress))];
  path(ctx, [a, end], color, lw);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), s = 5 + lw * 2;
  ctx.beginPath();
  ctx.moveTo(end[0] + Math.cos(ang) * 2, end[1] + Math.sin(ang) * 2);
  ctx.lineTo(end[0] - Math.cos(ang - 0.45) * s, end[1] - Math.sin(ang - 0.45) * s);
  ctx.lineTo(end[0] - Math.cos(ang + 0.45) * s, end[1] - Math.sin(ang + 0.45) * s);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Run `fn` with the context moved to (x, y), scaled by `s` and faded by `a`. */
function at(ctx, x, y, s, a, fn) {
  if (a <= 0 || s <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp(a);
  fn();
  ctx.restore();
}

// ---- narration: what the voice says, how long it takes ----

/** Caption text is written for the eye; this rewrites it for the voice. Longer, more specific forms first. */
const SAY = [
  [/\b1 kWh\b/g, "1 kilowatt hour"],
  [/\bkWh\b/g, "kilowatt hours"],
  [/\bkW\b/g, "kilowatts"],
  [/°C\b/g, " degrees Celsius"],
  [/°F\b/g, " degrees Fahrenheit"],
  [/(\d)\s*%/g, "$1 percent"],
  [/CO₂/g, "C O 2"],
  [/H₂O/g, "water"],
  [/−(?=\d)/g, "minus "],
  [/\s−\s/g, " minus "],
  [/≈/g, "about"],
  [/×/g, "times"],
  [/÷/g, "divided by"],
  [/→/g, "to"],
  [/↑/g, "up"],
  [/↓/g, "down"],
  [/\be\.g\./g, "for example"],
  [/\bvs\.?(?=\s)/g, "versus"],
  [/·/g, ","],
];

function speakable(s, pronounce = {}) {
  for (const [from, to] of Object.entries(pronounce)) s = s.replaceAll(from, to);
  for (const [re, to] of SAY) s = s.replace(re, to);
  return s.replace(/\s+/g, " ").trim();
}

/** Planning estimate for a voice with no recorded clip yet: 2.6 words a second plus a beat per pause. */
function speechSeconds(s, pronounce) {
  const said = speakable(s, pronounce);
  if (!said) return 0;
  return said.split(" ").length / 2.6 + (said.match(/[,;:]/g) ?? []).length * 0.15 + (said.match(/[.!?](\s|$)/g) ?? []).length * 0.3 + 0.4;
}

/** A caption must also stay up long enough to read: about 3.2 words a second, never under 1.5 s. */
const readSeconds = (s) => (s ? Math.max(1.5, s.split(/\s+/).filter(Boolean).length / 3.2) + 0.02 : 0);

/** File name for a recorded line: FNV-1a over the voice and the words, twice with different seeds. */
function voiceKey(spoken, voice) {
  const s = `${voice}|${spoken}`;
  let a = 0x811c9dc5, b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    a = Math.imul(a ^ s.charCodeAt(i), 0x01000193);
    b = Math.imul(b ^ s.charCodeAt(i), 0x5bd1e995);
  }
  return (a >>> 0).toString(36).padStart(7, "0") + (b >>> 0).toString(36).padStart(7, "0");
}

// ---- the warp: the film makes room for the voice ----
// A lesson is written in script time, the times its author chose for each beat. When a caption needs longer to be
// said than its beat allows, the whole beat plays proportionally slower, so every motion in it still lines up with
// the words; or, with `hold`, it runs at speed and rests at that moment. The warp maps real (playback) time to script
// time and back, so picture, sounds, captions and chapters all move together.

function narrationWarp(slots, need, duration, holds = []) {
  const EPS = 0.001;
  const knots = [[0, 0]]; // [real, script]
  let real = 0, script = 0, held = 0;
  slots.forEach((at, i) => {
    const end = slots[i + 1] ?? duration, slot = end - at, extra = Math.max(0, (need[i] ?? 0) - slot);
    if (extra <= 0.05) return;
    real += at - script;
    knots.push([real, at]);
    const pin = holds[i];
    if (pin !== undefined && pin >= at && pin < end - EPS) {
      real += pin - at; knots.push([real, pin]);
      real += extra; knots.push([real, pin]);
      real += EPS; knots.push([real, pin + EPS]);
      real += end - pin - EPS;
    } else real += slot + extra;
    knots.push([real, end]);
    script = end;
    held += extra;
  });
  real += duration - script;
  knots.push([real, duration]);
  const toScript = (r) => {
    if (r <= 0) return 0;
    for (let k = 1; k < knots.length; k++) {
      const [r1, s1] = knots[k], [r0, s0] = knots[k - 1];
      if (r <= r1) return r1 === r0 ? s1 : s0 + ((r - r0) / (r1 - r0)) * (s1 - s0);
    }
    return duration;
  };
  const toReal = (s) => {
    if (s <= 0) return 0;
    for (let k = 1; k < knots.length; k++) {
      const [r1, s1] = knots[k], [r0, s0] = knots[k - 1];
      if (s <= s1 && s1 > s0) return r0 + ((s - s0) / (s1 - s0)) * (r1 - r0);
    }
    return real;
  };
  return { duration: real, held, toScript, toReal };
}

// ---- defineLesson ----

/** Silence after a recorded clip before the next caption may start. */
const BREATH = 0.35;
/** The shared music bed: D major at 80 bpm, one chord per 3 s bar (Dmaj7, Bm7, Gmaj7, A6). */
const DEFAULT_MUSIC = { bpm: 80, gain: 0.07, chords: [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 49, 52, 54]] };

/**
 * spec: title, look, theme ('light' | 'dark'), duration, chapters [{at, title}], captions [{at, text, say?, hold?}],
 * cues [{at, sound, gain?, pitch?, len?}], sources (two or more), scene({ctx, t, theme}), plus optional
 * music (null for none), pronounce, poster, eyebrowFrom (4), end ({at, title, sub} or false).
 * Every time in the spec is script time. The returned lesson's times are real playback time, stretched where the
 * narration needs longer than its beat; draw(ctx, t) maps real time back to script time for the scene.
 */
function defineLesson(spec) {
  const { scene, music, eyebrowFrom = 4, end: endSpec, poster = 2.5, theme = "light", ...meta } = spec;
  validate(spec);
  // Recorded clips (narrate.mjs writes voices/voices.js) time their caption by their real length; a caption with
  // no clip yet is timed by the estimate and read by the browser's voice in preview
  const voices = globalThis.VOICES ?? { voice: "", clips: {} };
  const clips = meta.captions.map((c) => {
    const key = voiceKey(speakable(c.say ?? c.text, meta.pronounce), voices.voice);
    const seconds = voices.clips[key];
    return c.text && seconds !== undefined ? { url: `voices/${key}.wav`, seconds } : undefined;
  });
  const warp = narrationWarp(
    meta.captions.map((c) => c.at),
    meta.captions.map((c, i) => Math.max(readSeconds(c.text), clips[i] ? clips[i].seconds + BREATH : speechSeconds(c.say ?? c.text, meta.pronounce))),
    meta.duration,
    meta.captions.map((c) => c.hold),
  );
  const real = warp.toReal;
  const end = endSpec === false ? null : { at: meta.duration - 3, title: "That's the idea", sub: meta.title, ...endSpec };
  return {
    ...meta,
    theme,
    duration: warp.duration,
    chapters: meta.chapters.map((c) => ({ ...c, at: real(c.at) })),
    captions: meta.captions.map((c, i) => ({ ...c, at: real(c.at), clip: clips[i] })),
    // A glide's length stretches with any hold it spans, so its sound still ends with its motion
    cues: meta.cues.map((c) => ({ ...c, at: real(c.at), ...(c.len ? { len: real(c.at + c.len) - real(c.at) } : {}) })),
    poster: real(poster),
    music: music === null ? undefined : (music ?? DEFAULT_MUSIC),
    /** Paint real time `t` in 960x540 units. o: { dark, look } override the lesson's theme and look (previews). */
    draw(ctx, t, o = {}) {
      const s = warp.toScript(t);
      const look = LOOKS[o.look] ?? LOOKS[meta.look];
      const th = look.themes[(o.dark ?? theme === "dark") ? "dark" : "light"];
      applyLook(ctx, look, th, s);
      eyebrow(ctx, th, s, meta.chapters, meta.duration, eyebrowFrom);
      scene({ ctx, t: s, theme: th });
      if (end) endCard(ctx, th, s, end.at, end.title, end.sub);
    },
  };
}

/** The checks a lesson must pass. Problems go to console.error, which render.mjs prints (and fails stills on). */
function validate(l) {
  const bad = [];
  for (const [name, list] of [["chapter", l.chapters], ["caption", l.captions]]) {
    if (list[0]?.at !== 0) bad.push(`the first ${name} must be at 0`);
    list.forEach((x, i) => { if (i && x.at <= list[i - 1].at) bad.push(`${name} at ${x.at}s is out of order`); });
  }
  l.chapters.forEach((c, i) => { if ((l.chapters[i + 1]?.at ?? l.duration) - c.at > 180) bad.push(`chapter "${c.title}" runs over 3 minutes; split it`); });
  for (const c of l.cues) {
    if (!(c.sound in SOUNDS)) bad.push(`unknown sound "${c.sound}" at ${c.at}s`);
    if (c.at < 0 || c.at >= l.duration) bad.push(`cue at ${c.at}s is outside the film`);
  }
  if (!(l.look in LOOKS)) bad.push(`unknown look "${l.look}"`);
  if ((l.sources ?? []).length < 2) bad.push("check every number against two sources, and list them in `sources`");
  for (const b of bad) console.error(`lesson: ${b}`);
}
