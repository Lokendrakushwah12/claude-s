// Scene engine + drawing helpers. Deterministic: seek(t) always draws the same frame for the same t,
// which is what lets render.mjs capture it frame by frame. Don't use Date.now() or Math.random() in scenes.
// Size comes from ?size=WxH (render.mjs --size), so one video.js can render 16:9, 1:1 and 9:16. Lay out with W/H, not constants.
const [W, H] = (new URLSearchParams(location.search).get('size') || '1920x1080').split('x').map(Number);
const cv = document.getElementById('c');
cv.width = W; cv.height = H; cv.style.width = `min(100vw, ${(W / H) * 100}vh)`;
const ctx = cv.getContext('2d');
const RENDER = location.search.includes('render');
window.LYRICS = window.LYRICS || [];
window.BEATS = window.BEATS || [];

// ---- math ----
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const prog = (t, a, b) => clamp((t - a) / (b - a)); // 0..1 progress of t through [a, b]
const ease = {
  out: p => 1 - (1 - p) ** 3,
  in: p => p ** 3,
  inOut: p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  back: p => p <= 0 ? 0 : 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2,   // exact 0 at p=0 (float residue made arc() radii negative)
  elastic: p => (p <= 0 || p >= 1 ? p : 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  lift: bezier(0.32, 0.72, 0, 1), // the 700 ms "discrete choice" ease from hairline-style motion: fast out, long soft landing
  // Premium presets (silky at 60 fps): no ease here ever stops dead or starts with a jerk.
  expoOut: p => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),      // fast arrival, long glide in (cursor arrivals, settles)
  expoIn: p => (p <= 0 ? 0 : 2 ** (10 * p - 10)),        // the speed ramp INTO a velocity-matched cut
  expoInOut: p => (p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2),
  quintOut: p => 1 - (1 - p) ** 5,                       // between out (cubic) and expoOut
  emphasized: bezier(0.2, 0, 0, 1),                      // Material 3 "emphasized": a quick launch and a very soft landing
  smooth: bezier(0.65, 0, 0.35, 1),                      // symmetric camera move between two rests
  cursor: bezier(0.45, 0, 0.1, 1),                       // a hand on a mouse: eases off the start, decays into the target (measured, 2026-10-11 #42)
  // 0..1 spring by bounce (0 = critically damped, 0.2 ≈ 1.5 % overshoot, 0.5 ≈ 16 %), settled by p = 1.
  spring: (p, bounce = 0.2) => { if (p <= 0) return 0; if (p >= 1) return 1; const z = Math.max(0.05, 1 - bounce), w = 6.2 / z;
    if (z >= 1) return 1 - (1 + w * p) * Math.exp(-w * p); const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * p) * (Math.cos(wd * p) + (z * w / wd) * Math.sin(wd * p)); },
};
// The render's output frame rate (render.mjs passes ?fps=); 30 in a browser preview.
// window properties, not declarations, so a page that declares the same name still boots (its declaration shadows these).
window.OUTFPS = +new URLSearchParams(location.search).get('fps') || 30;
// The time of the frame t falls in: read clocks, counters and anything that must stay sharp through it, so subframe blur can't smear them.
window.onFrame = (fps => t => Math.floor(t * fps + 1e-6) / fps)(window.OUTFPS);
// CSS cubic-bezier(x1, y1, x2, y2) as an easing p -> value (bisection on x, exact to ~1e-7).
function bezier(x1, y1, x2, y2) {
  const f = (u, a, b) => 3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;
  return p => { if (p <= 0) return 0; if (p >= 1) return 1; let lo = 0, hi = 1, u = p; for (let i = 0; i < 26; i++) { u = (lo + hi) / 2; if (f(u, x1, x2) < p) lo = u; else hi = u; } return f(u, y1, y2); };
}
function rng(seed) { // mulberry32, seeded so every frame is reproducible
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Hand-drawn "boil": the value only changes 12x/second, like animation on twos. Use it as a seed.
// cycle = how many drawings loop: stop-motion is boil(t, 12, 3) (3 drawings, 4 loops a second, measured off a
// hand-drawn reference). The default never loops, so older callers (wobble, type.js marks/grain) draw what they always did.
const boil = (t, fps = 12, cycle = Infinity) => Math.floor(t * fps) % cycle;
const wobble = (seed, t, amp = 2) => { const r = rng(seed * 7919 + boil(t)); return [(r() - 0.5) * amp, (r() - 0.5) * amp]; };

// ---- stop-motion (12 fps, 3-drawing boil, ±2 px whole-pixel jitter, ±1.2 % flicker) ----
// Hold time on a 12 fps grid: draw scene(stepT(t)) and the motion steps like stop-motion while the render stays 30 fps.
const stepT = (t, fps = 12) => Math.floor(t * fps + 1e-6) / fps;
// Whole-frame jitter for frame f = boil(t): c.translate(...jitter(boil(t))) before drawing. Whole pixels, as measured.
const jitter = (f, amp = 2, seed = 1) => { const r = rng(seed * 7919 + f); return [Math.round((r() * 2 - 1) * amp), Math.round((r() * 2 - 1) * amp)]; };
// Exposure flicker for frame f: a gain around 1. Apply as black (g < 1) or white (g > 1) at |1 - g| over the frame.
const flickerGain = (f, amp = 0.012, seed = 3) => 1 + (rng(seed * 104729 + f)() * 2 - 1) * amp;
// Closed-form spring in SECONDS through targets: keys = [[t0, v0], [t1, v1], ...] (v0 is the resting value; each later
// key starts one damped step response at its time, all summed, so motion stays continuous and frame 812 needs no history).
// k 100 / c 18 (mass 1) is within 1 % by 0.5 s and overshoots 0.2 %; c 12 bounces ~10 %. spring(p) / spring(p, 8) is promo.js's 0..1 spring.
// Assigned to window, not declared: projects made before promo.js dropped its `const spring` would otherwise hit a duplicate-declaration SyntaxError
// (where promo.js is loaded its own spring(p) wins; drop that line there and this one takes both forms).
window.spring = (t, keys = 8, k = 100, c = 18) => {
  if (!Array.isArray(keys)) return t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.exp(-keys * t) * Math.cos(keys * 0.9 * t);
  const w = Math.sqrt(k), z = c / (2 * w), wd = w * Math.sqrt(Math.abs(1 - z * z)), r1 = -w * (z - Math.sqrt(Math.max(0, z * z - 1))), r2 = -w * (z + Math.sqrt(Math.max(0, z * z - 1)));
  const step = s => s <= 0 ? 0 : z < 1 ? 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z * w / wd) * Math.sin(wd * s)) : z === 1 ? 1 - Math.exp(-w * s) * (1 + w * s) : 1 - (r2 * Math.exp(r1 * s) - r1 * Math.exp(r2 * s)) / (r2 - r1);
  let v = keys[0][1]; for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * step(t - keys[i][0]); return v;
};
// Hand-drawn stroke, no rough.js: pts [[x, y], ...] drawn in two wobbly passes (the second lighter and 1.5–2 px off),
// optional 45° hachure fill. Sharp corners (> 30°) end one stroke and start the next with a small overshoot, so boxes and
// stars cross at the corners like pencil; gentle turns (a 24-point circle) stay one smooth stroke.
// o: seed closed color lw wob (px) bow over (px) p (draw-on 0..1, in stroke order) fill (hachure colour) gap angle light.
// A box is [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] with closed: true. Boil it: seed: id * 3 + boil(t, 12, 3).
function sketch(c, pts, o = {}) {
  const { seed = 1, closed = false, color = '#383933', lw = 1.8, wob = 1.4, bow = 0.012, over = 3, p = 1, fill, gap = 6, angle = Math.PI / 4, light = 0.55 } = o;
  const line = (r, a, b, amp) => { // one wobbly, slightly bowed segment as points
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, n = Math.max(2, Math.ceil(L / 28)), nx = (a[1] - b[1]) / L, ny = (b[0] - a[0]) / L, bw = (r() - 0.5) * 2 * bow * L;
    return Array.from({ length: n + 1 }, (_, i) => { const u = i / n, d = bw * Math.sin(Math.PI * u) + (r() - 0.5) * 2 * amp; return [lerp(a[0], b[0], u) + nx * d, lerp(a[1], b[1], u) + ny * d]; });
  };
  const len = q => q.reduce((s, v, i) => (i ? s + Math.hypot(v[0] - q[i - 1][0], v[1] - q[i - 1][1]) : 0), 0);
  const stroke = (q, width, alpha, part) => { // smooth path through q, drawn to fraction `part` of its length
    if (part <= 0) return; const L = len(q);
    c.globalAlpha = alpha; c.lineWidth = width; c.setLineDash(part < 1 ? [L * part, L + 1] : []); c.beginPath(); c.moveTo(...q[0]);
    for (let i = 1; i < q.length - 1; i++) c.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    c.lineTo(...q.at(-1)); c.stroke();
  };
  const draw = (strokes, width, alpha) => { let left = strokes.reduce((a, q) => a + len(q), 0) * p; for (const q of strokes) { const l = len(q); stroke(q, width, alpha, left / l); left -= l; } };
  const P = closed ? [...pts, pts[0]] : pts, dir = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]), groups = [[0]];
  for (let i = 1; i < P.length; i++) { groups.at(-1).push(i); if (i < P.length - 1 && Math.abs(((dir(P[i], P[i + 1]) - dir(P[i - 1], P[i]) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) > 0.52) groups.push([i]); }
  const r = rng(seed * 9973 + 7), passes = [0, 1].map(k => { // geometry first, so p never changes the wobble
    const a = r() * 6.283, m = k ? 1.5 + r() * 0.5 : 0;
    return groups.map(g => { const q = g.slice(1).flatMap((j, i) => line(r, P[j - 1], P[j], wob).slice(i ? 1 : 0)), [q0, q1, y, z] = [q[0], q[1], q.at(-2), q.at(-1)], e0 = over * r(), e1 = over * r(), d0 = dir(q1, q0), d1 = dir(y, z);
      return [[q0[0] + Math.cos(d0) * e0, q0[1] + Math.sin(d0) * e0], ...q, [z[0] + Math.cos(d1) * e1, z[1] + Math.sin(d1) * e1]].map(([x, y]) => [x + Math.cos(a) * m, y + Math.sin(a) * m]); });
  });
  c.save(); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = color;
  if (fill && p > 0) { // hachure: parallel strokes across the bounding box, clipped to the shape, drawn on in order with p
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const R = Math.hypot(Math.max(...xs) - cx, Math.max(...ys) - cy), dx = Math.cos(angle), dy = Math.sin(angle), rh = rng(seed * 31 + 1), n = Math.floor((2 * R) / gap);
    c.save(); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip(); c.strokeStyle = fill;
    for (let i = 0; i <= n; i++) { const d = -R + i * gap, q = line(rh, [cx - dy * d - dx * R, cy + dx * d - dy * R], [cx - dy * d + dx * R, cy + dx * d + dy * R], wob * 0.6); if (i < (n + 1) * p) stroke(q, lw * 0.7, 0.9, 1); }
    c.restore();
  }
  draw(passes[0], lw, 1); draw(passes[1], lw * 0.8, light);
  c.restore();
}

// ---- music ----
const lyricAt = t => LYRICS.find(l => t >= l.start && t < l.end);
const beatIndex = t => { let i = -1; for (const b of BEATS) { if (b > t) break; i++; } return i; };
const sinceBeat = t => { const i = beatIndex(t); return i < 0 ? 99 : t - BEATS[i]; };
const pulse = (t, decay = 0.25) => Math.exp(-sinceBeat(t) / decay); // 1 on the beat, falls off after

// ---- assets ----
const IMGS = {};
const img = name => IMGS[name]; // name = file in assets/, declared in VIDEO.assets

// ---- drawing ----
function bg(c, color) { c.fillStyle = color; c.fillRect(0, 0, W, H); }
function text(c, str, x, y, o = {}) {
  const { size = 120, font = 'Anton', color = '#111', align = 'center', base = 'middle', weight = '', italic = false, stroke, lw = 8, rot = 0, scale = 1, alpha = 1, spacing = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
  c.font = `${italic ? 'italic ' : ''}${weight} ${size}px "${font}"`; c.textAlign = align; c.textBaseline = base;
  c.letterSpacing = spacing + 'px';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = stroke; c.strokeText(str, 0, 0); }
  c.fillStyle = color; c.fillText(str, 0, 0);
  c.restore();
}
// Chrome snaps canvas text to whole pixels vertically, so type that drifts or settles slowly up/down steps (render.mjs
// --motioncheck reports it as stalls). smoothText draws the string once into a cached sprite (res x oversampled, for zooms)
// and moves it as an image, which resamples at any sub-pixel offset. Same options as text(); align left/center/right.
function smoothText(c, str, x, y, o = {}) {
  const SPRITES = (smoothText.cache ||= new Map());
  const { size = 120, font = 'Anton', color = '#111', align = 'left', base = 'alphabetic', weight = '', spacing = 0, alpha = 1, res = 2 } = o;
  const f = `${weight} ${size}px "${font}"`, key = [f, color, spacing, base, res, str].join('|');
  let s = SPRITES.get(key);
  if (!s) {
    const m = new OffscreenCanvas(1, 1).getContext('2d'); m.font = f; m.letterSpacing = spacing + 'px'; m.textBaseline = base;
    const q = m.measureText(str), pad = Math.ceil(size * 0.2), up = Math.ceil(q.actualBoundingBoxAscent) + pad, w = Math.ceil(q.width) + pad * 2, h = up + Math.ceil(q.actualBoundingBoxDescent) + pad;
    const cv = new OffscreenCanvas(w * res, h * res), x2 = cv.getContext('2d'); x2.scale(res, res); x2.font = f; x2.letterSpacing = spacing + 'px'; x2.textBaseline = base; x2.fillStyle = color; x2.fillText(str, pad, up);
    s = { cv, w, h, pad, up, tw: q.width }; SPRITES.set(key, s);
  }
  const ax = align === 'center' ? s.tw / 2 : align === 'right' ? s.tw : 0;
  c.save(); c.globalAlpha *= alpha; c.imageSmoothingQuality = 'high'; c.drawImage(s.cv, x - ax - s.pad, y - s.up, s.w, s.h); c.restore(); return s.tw;
}
// Word-by-word kinetic lyric: each word pops in at its sung time (falls back to even spacing).
function kinetic(c, line, t, o = {}) {
  if (!line) return;
  const { x = W / 2, y = H / 2, size = 140, font = 'Anton', color = '#111', maxW = W * 0.8, lead = 1.05, pop = 0.18, ...rest } = o;
  const words = line.words?.length ? line.words : line.text.split(' ').map((w, i, a) => ({ w, s: lerp(line.start, line.end, i / a.length) }));
  c.save(); c.font = `${size}px "${font}"`; c.letterSpacing = (rest.spacing || 0) + 'px';
  const rows = [[]]; let rw = 0; const sp = c.measureText(' ').width;
  for (const wd of words) { const ww = c.measureText(wd.w).width; if (rw + ww > maxW && rows.at(-1).length) { rows.push([]); rw = 0; } rows.at(-1).push({ ...wd, ww }); rw += ww + sp; }
  c.restore();
  rows.forEach((row, ri) => {
    const total = row.reduce((s, w) => s + w.ww + sp, -sp);
    let cx = x - total / 2; const cy = y + (ri - (rows.length - 1) / 2) * size * lead;
    for (const wd of row) {
      const p = prog(t, wd.s - 0.04, wd.s - 0.04 + pop);
      if (p > 0) text(c, wd.w, cx + wd.ww / 2, cy + (1 - ease.out(p)) * size * 0.3, { size, font, color, ...rest, scale: ease.back(p), alpha: p });
      cx += wd.ww + sp;
    }
  });
}
// Draw an image to cover a box (like CSS object-fit: cover). Call it as cover(): libCover is the declared name and
// window.cover an alias, so a page or toolkit that declares its own `cover` (even `const cover`) still boots.
window.cover = libCover;
function libCover(c, im, x = 0, y = 0, w = W, h = H) {
  if (!im) return; const s = Math.max(w / im.width, h / im.height);
  c.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
}
// Paper grain + fibres, generated once, multiplied over every frame.
let LIB_PAPER; // not PAPER: a page declaring its own PAPER failed to boot
function paper(c, strength = 0.5, seed = 1) {
  if (!LIB_PAPER) {
    LIB_PAPER = document.createElement('canvas'); LIB_PAPER.width = W; LIB_PAPER.height = H;
    const p = LIB_PAPER.getContext('2d'), r = rng(seed), d = p.createImageData(W, H);
    for (let i = 0; i < d.data.length; i += 4) { const v = 225 + r() * 30; d.data[i] = v; d.data[i + 1] = v - 2; d.data[i + 2] = v - 8; d.data[i + 3] = 255; }
    p.putImageData(d, 0, 0); p.strokeStyle = 'rgba(120,100,80,0.08)';
    for (let i = 0; i < 900; i++) { p.lineWidth = r() * 1.5; p.beginPath(); const x = r() * W, y = r() * H, a = r() * 6.28, l = 10 + r() * 50; p.moveTo(x, y); p.quadraticCurveTo(x + r() * 20, y + r() * 20, x + Math.cos(a) * l, y + Math.sin(a) * l); p.stroke(); }
  }
  c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = strength; c.drawImage(LIB_PAPER, 0, 0); c.restore();
}

// ---- 3D: Three.js on the same clock ----
// VIDEO.three = true loads three@0.169.0 before `ready` as window.THREE, with RoomEnvironment; VIDEO.three = ['geometries/RoundedBoxGeometry.js',
// 'postprocessing/EffectComposer.js', ...] adds those examples/jsm addons, their exports merged onto THREE. Then, in any scene:
//   const R = gl3d(); R.render(scene, camera); c.drawImage(R.domElement, 0, 0, W, H);   the 3D layer composites like an image, so 2D
//   type, captions, looks and grain go over or under it, and --subframes motion blur works (each sub-time re-renders the scene).
// gl3d(): one WebGLRenderer the size of the frame (a context per call runs out), transparent clear, 4x MSAA, sRGB out, ACES, soft
// shadows; gl3d({ ss: 2 }) on the first call renders at 2x and downsamples (thin lines, fine text on textures). gl3d.env() is a studio
// environment map: scene.environment = gl3d.env() gives PBR materials soft reflections and fill (without it metal reads black).
// Rules: pose everything from t (no THREE.Clock, no setAnimationLoop; AnimationMixer.setTime(t)); rng(), never Math.random; textures
// load in ready; a 2D-drawn surface is a THREE.CanvasTexture whose canvas is redrawn from ctx.reset() every frame (state left over
// from the last frame, a textAlign, broke determinism) with needsUpdate = true. Look: fov 25-35 for products, rounded edges (no razor
// CG corners), env fill + one key light, a soft contact shadow. Measured 2026-10-11: headless Chrome gives ANGLE Metal with 4x MSAA
// and renders a frame bit-identically after any seek order and across launches; a phone3d frame renders in ~50 ms at 1080p.
function gl3d(o = {}) {
  if (!gl3d.R) {
    const R = (gl3d.R = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    R.setPixelRatio(o.ss || 1); R.setSize(W, H, false); R.setClearColor(0, 0); R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  return gl3d.R;
}
gl3d.env = () => (gl3d.E ||= new THREE.PMREMGenerator(gl3d()).fromScene(new THREE.RoomEnvironment(), 0.04).texture);
// A phone in 3D whose screen is anything you draw in 2D. o: x, y (its centre on the frame, px), h (its height, px), yaw, pitch, roll
// (radians; product shots sit at yaw -0.1..-0.35, pitch 0.05..0.15), screen(sc, w, h) (draw the app into a w x h canvas: 1110 x 2400 by
// default, about 2.8x a 0.8 H phone at 1080p; res: screen height in px), color (the frame), chrome (false: no status bar, island, home bar),
// blur (px, a defocus), dim (0..1, darkens it: a phone receding behind a card), alpha, shadow (0..1, default 0.35: a soft shadow on the
// ground behind it, following its silhouette).
// Returns the screen's corners on the frame [[x, y] x4: tl, tr, br, bl] for drawing taps, cards lifting out, or a push through it.
// The screen is unlit (toneMapped off), so the UI's colours land exactly; a glass layer adds a faint env reflection over it (+8/255 at most).
function phone3d(c, o = {}) {
  const T = THREE, R = gl3d(), P = (phone3d.P ||= (() => {
    const A = 0.4816, D = 0.052, rr = (w, h, r) => { const s = new T.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      s.lineTo(w / 2, h / 2 - r); s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); return s; };
    const uv01 = g => { g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y)); return g; };
    const scene = new T.Scene(), g = new T.Group(), bev = 0.012, cam = new T.PerspectiveCamera(30, W / H, 0.1, 100);
    scene.environment = gl3d.env(); scene.add(g);
    const frame = new T.MeshPhysicalMaterial({ color: '#2b2b30', metalness: 0.85, roughness: 0.28, clearcoat: 0.4, envMapIntensity: 1.6 }); // a bright rim, so it separates from a dark ground
    const body = new T.Mesh(new T.ExtrudeGeometry(rr(A - 2 * bev, 1 - 2 * bev, 0.075), { depth: D - 2 * bev, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 24 }), frame);
    body.position.z = -D / 2 + bev; g.add(body);
    const sw = A - 0.04, sh = 1 - 0.04, screen = new T.Mesh(uv01(new T.ShapeGeometry(rr(sw, sh, 0.06), 24)), new T.MeshBasicMaterial({ toneMapped: false }));
    screen.position.z = D / 2 + 0.0005; g.add(screen);
    const glass = new T.Mesh(screen.geometry, new T.MeshPhysicalMaterial({ color: '#000', roughness: 0.06, metalness: 0, envMapIntensity: 0.2, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    glass.position.z = D / 2 + 0.001; g.add(glass);
    for (const [y, l, side] of [[0.26, 0.05, -1], [0.17, 0.09, -1], [0.06, 0.09, -1], [0.14, 0.14, 1]]) { const b = new T.Mesh(new T.BoxGeometry(0.006, l, 0.018), frame); b.position.set(side * (A / 2 + 0.002), y, 0); g.add(b); }
    return { scene, g, cam, frame, A, sw, sh, D, screen };
  })());
  const { x = W / 2, y = H / 2, h = H * 0.8, yaw = -0.2, pitch = 0.08, roll = 0, res = 2400, color = '#2b2b30', chrome = true, blur = 0, dim = 0, alpha = 1, shadow = 0.35 } = o;
  const sh = Math.round(res), sw = Math.round((res * P.sw) / P.sh);
  if (P.cv?.height !== sh) { // a texture per size, made at its final size (a canvas resized under a live texture drew one frame stale)
    P.tex?.dispose(); P.cv = Object.assign(document.createElement('canvas'), { width: sw, height: sh }); P.tex = new T.CanvasTexture(P.cv);
    P.tex.colorSpace = T.SRGBColorSpace; P.tex.anisotropy = R.capabilities.getMaxAnisotropy(); P.screen.material.map = P.tex; P.screen.material.needsUpdate = true; }
  const s = P.cv.getContext('2d'); s.reset(); s.fillStyle = '#fff'; s.fillRect(0, 0, sw, sh); // reset(): no state (textAlign...) leaks between frames
  if (o.screen) { s.save(); o.screen(s, sw, sh); s.restore(); }
  if (chrome) { s.save(); const u = sw / 393, ink = o.statusInk || '#111', box = (x, y, w, h, r) => { s.beginPath(); s.roundRect(x, y, w, h, r); }; // iPhone points: 393 wide; the island 126 x 37 at 11 down; status text 17 pt semibold
    s.fillStyle = '#000'; box(sw / 2 - 63 * u, 11 * u, 126 * u, 37 * u, 18.5 * u); s.fill();
    s.fillStyle = ink; s.font = `600 ${17 * u}px -apple-system, "SF Pro Text", "Inter", sans-serif`; s.textBaseline = 'middle'; s.textAlign = 'center'; s.fillText('9:41', 64 * u, 30 * u);
    for (let i = 0; i < 4; i++) s.fillRect(sw - 98 * u + i * 5 * u, 34 * u - (4 + i * 2.6) * u, 3.2 * u, (4 + i * 2.6) * u);
    s.lineWidth = 1.2 * u; s.strokeStyle = ink; box(sw - 50 * u, 24 * u, 25 * u, 12 * u, 3.5 * u); s.globalAlpha = 0.4; s.stroke(); s.globalAlpha = 1; box(sw - 48 * u, 26 * u, 19 * u, 8 * u, 2 * u); s.fill();
    s.globalAlpha = 0.85; box(sw / 2 - 67 * u, sh - 13 * u, 134 * u, 5 * u, 2.5 * u); s.fill(); s.restore(); }
  P.tex.needsUpdate = true; P.frame.color.set(color);
  // lens shift (setViewOffset) keeps the phone on the lens axis wherever it sits on the frame, so yaw means the same everywhere
  const fov = 30, dist = H / (2 * h * Math.tan((fov * Math.PI) / 360)); P.cam.fov = fov; P.cam.aspect = W / H; P.cam.position.set(0, 0, dist); P.cam.lookAt(0, 0, 0);
  P.cam.setViewOffset(W, H, W / 2 - x, H / 2 - y, W, H); P.cam.updateProjectionMatrix();
  P.g.rotation.set(pitch, yaw, roll, 'YXZ'); P.g.updateMatrixWorld();
  R.render(P.scene, P.cam);
  c.save(); c.globalAlpha *= alpha;
  if (shadow > 0) { c.save(); c.filter = `blur(${Math.round(h * 0.035)}px) brightness(0)`; c.globalAlpha *= shadow; c.drawImage(R.domElement, h * 0.04, h * 0.06, W, H); c.restore(); }
  const f = [blur > 0.3 && `blur(${blur.toFixed(1)}px)`, dim > 0 && `brightness(${(1 - dim).toFixed(3)})`].filter(Boolean).join(' '); if (f) c.filter = f;
  c.drawImage(R.domElement, 0, 0, W, H); c.restore();
  return [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([a, b]) => { const v = new T.Vector3((a * P.sw) / 2, (b * P.sh) / 2, P.D / 2).applyMatrix4(P.g.matrixWorld).project(P.cam); return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H]; });
}

// ---- code on screen ----
// A code panel: src typed in a mono face with light syntax colour, a block caret, an optional highlighted line and scroll. o: w (panel
// width; height fits `rows`, default every line), size (px), u (seconds since typing began; omit = all typed), cps (25: a code card;
// 50-60: a CLI command), hl (line index, or [line, p] to draw the bar on with p), scroll (first line shown, fractional = smooth),
// title (a tab label in the bar; null = no bar), theme ({bg, fg, dim, kw, str, num, fn, bar, hl}; str defaults to o.accent), gutter
// (line numbers), font. Typing rules from the refs: a newline and its indent land as one step, the caret is solid while typing and blinks
// (0.53 s) when idle, hold ~0.3 s on the last character before the next beat. Returns { h, caret: [x, y], lineY: i => y, cw, done } (done:
// seconds the typing takes, to cue sounds and the next beat).
function codeBlock(c, src, x, y, o = {}) {
  const { w = W * 0.6, size = Math.round(H * 0.026), u = Infinity, cps = 25, scroll = 0, title = 'main.ts', gutter = true, font = 'JetBrains Mono', lh = 1.6, accent = '#ffb86b' } = o;
  const th = { bg: '#16171b', fg: '#e8e6e3', dim: '#6b6f76', kw: '#c4a7ff', str: accent, num: '#7fd7c4', fn: '#8ab4ff', bar: '#1f2026', hl: 'rgba(255,255,255,0.08)', ...o.theme };
  const lines = src.replace(/\t/g, '  ').split('\n'), rows = o.rows ?? lines.length, L = size * lh, pad = size * 1.1, barH = title === null ? 0 : size * 2.2;
  // typing clock: each line's indent is free, every other character (and each newline) costs 1 / cps
  let tt = 0; const at = lines.map(l => { const ind = l.length - l.trimStart().length, t0 = tt; tt += (l.length - ind + 1) / cps; return { ind, t0 }; });
  const typedOf = i => (u === Infinity ? lines[i].length : u < at[i].t0 ? -1 : Math.min(lines[i].length, at[i].ind + Math.floor((u - at[i].t0) * cps + 1e-6)));
  c.save(); c.font = `400 ${size}px "${font}"`; const cw = c.measureText('M').width, gw = gutter ? cw * 4 : 0, h = barH + pad * 2 + rows * L;
  c.beginPath(); c.roundRect(x, y, w, h, size * 0.7); c.fillStyle = th.bg; c.fill(); c.clip();
  if (barH) { c.fillStyle = th.bar; c.fillRect(x, y, w, barH); ['#ff5f57', '#febc2e', '#28c840'].forEach((k, i) => { c.beginPath(); c.arc(x + pad + i * size * 0.9, y + barH / 2, size * 0.26, 0, 7); c.fillStyle = k; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1; });
    c.font = `500 ${size * 0.78}px "${font}"`; c.fillStyle = th.dim; c.textBaseline = 'middle'; c.fillText(title, x + pad + size * 3, y + barH / 2); c.font = `400 ${size}px "${font}"`; }
  c.beginPath(); c.rect(x, y + barH, w, h - barH); c.clip(); c.textBaseline = 'alphabetic';
  const y0 = y + barH + pad - scroll * L, x0 = x + pad + gw, lineY = i => y0 + i * L + L * 0.72, KW = /^(const|let|var|function|return|if|else|for|while|import|from|export|async|await|class|new|true|false|null|undefined|def|self|in|of|fn|pub|use|type|interface)$/;
  const [hli, hlp] = Array.isArray(o.hl) ? o.hl : [o.hl, 1];
  if (hli != null && hlp > 0) { c.fillStyle = th.hl; c.fillRect(x, y0 + hli * L, w * ease.inOut(clamp(hlp)), L); c.fillStyle = accent; c.fillRect(x, y0 + hli * L, size * 0.18, L); }
  let caret = null, cur = -1;
  lines.forEach((l, i) => {
    const n = typedOf(i); if (n < 0) return; cur = i; const ly = lineY(i); if (ly < y + barH - L || ly > y + h + L) return;
    if (gutter) { c.fillStyle = th.dim; c.textAlign = 'right'; c.fillText(String(i + 1), x + pad + gw - cw * 1.5, ly); c.textAlign = 'left'; }
    const toks = l.match(/(\/\/.*|#.*$|"(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`[^`]*`?|\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|\s+|.)/g) || [];
    let col = 0;
    toks.forEach((k, j) => { if (col >= n) return; const s2 = k.slice(0, n - col), nx = toks[j + 1];
      c.fillStyle = /^(\/\/|#)/.test(k) ? th.dim : /^["'`]/.test(k) ? th.str : /^\d/.test(k) ? th.num : KW.test(k) ? th.kw : /^[A-Za-z_$]/.test(k) && nx === '(' ? th.fn : th.fg;
      c.fillText(s2, x0 + col * cw, ly); col += k.length; });
    caret = [x0 + Math.min(n, l.length) * cw, ly];
  });
  const done = tt, typing = u < done, on = typing || Math.floor((u - done) / 0.53) % 2 === 0;
  if (caret && on && o.caret !== false) { c.fillStyle = th.fg; c.globalAlpha = 0.9; c.fillRect(caret[0], caret[1] - size * 0.82, cw, size * 1.05); }
  c.restore();
  return { h, caret, lineY, cw, done, line: cur };
}

// ---- engine ----
// VIDEO.stopmo = true (or { fps, jitter, flicker }) is the stop-motion paper look, off by default: time held on a 12 fps
// grid, the whole frame jittered ±2 whole px (overscanned so no edge shows) and its exposure flickered ±1.2 % per drawing.
// For the 3-drawing boil, seed hand-drawn lines with boil(t, 12, 3), e.g. sketch(c, pts, { seed: id * 3 + boil(t, 12, 3) }).
function seek(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  const sm = VIDEO.stopmo && { fps: 12, jitter: 2, flicker: 0.012, ...VIDEO.stopmo };
  if (sm) { t = stepT(t, sm.fps); const [dx, dy] = jitter(boil(t, sm.fps), sm.jitter), k = 1 + (2 * sm.jitter + 1) / Math.min(W, H); ctx.setTransform(k, 0, 0, k, dx - (W * (k - 1)) / 2, dy - (H * (k - 1)) / 2); }
  for (const s of VIDEO.scenes) {
    if (t < s.start || t >= s.end) continue;
    ctx.save(); s.draw(ctx, prog(t, s.start, s.end), t, s); ctx.restore();
  }
  if (VIDEO.overlay) { ctx.save(); VIDEO.overlay(ctx, t); ctx.restore(); }
  if (sm) { const g = flickerGain(boil(t, sm.fps), sm.flicker); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.abs(1 - g); ctx.fillStyle = g < 1 ? '#000' : '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
}

function boot() {
  // VIDEO.fonts entries are Google Fonts css2 specs: 'Anton', 'Instrument Serif:ital@0;1', 'Inter:wght@400;900'.
  const fonts = VIDEO.fonts || [];
  const css = !fonts.length ? Promise.resolve() : new Promise(res => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.onload = l.onerror = res;
    l.href = 'https://fonts.googleapis.com/css2?' + fonts.map(f => 'family=' + f.replace(/ /g, '+')).join('&') + '&display=block';
    document.head.appendChild(l);
  });
  const loads = (VIDEO.assets || []).map(n => new Promise(res => { const i = new Image(); i.onload = () => { IMGS[n] = i; res(); }; i.onerror = () => { console.warn('missing asset', n); res(); }; i.src = 'assets/' + n; }));
  // Preload every face a spec names ('Inter:wght@400;600' → 400 and 600, 'Instrument Serif:ital@0;1' → roman and italic),
  // or a weight that isn't loaded yet draws in a fallback face on the first frames.
  const faces = f => { const [fam, ax = ''] = f.split(':'), [keys = '', vals] = ax.split('@'), k = keys.split(',');
    return (vals ? vals.split(';') : ['']).map(v => { const x = v.split(','); return `${x[k.indexOf('ital')] === '1' ? 'italic ' : ''}${k.includes('wght') ? x[k.indexOf('wght')].split('..')[0] : 400} 40px "${fam}"`; }); };
  const three = !VIDEO.three ? null : (() => { // an import map so the addons' own `import 'three'` gets the same copy
    const base = 'https://cdn.jsdelivr.net/npm/three@0.169.0/', m = document.createElement('script'); m.type = 'importmap';
    m.textContent = JSON.stringify({ imports: { three: base + 'build/three.module.min.js', 'three/addons/': base + 'examples/jsm/' } }); document.head.append(m);
    const adds = ['environments/RoomEnvironment.js', ...(Array.isArray(VIDEO.three) ? VIDEO.three : [])];
    return Promise.all([import('three'), ...adds.map(a => import('three/addons/' + a))]).then(ms => { window.THREE = Object.assign({}, ...ms); });
  })();
  window.ready = Promise.all([...loads, three, css.then(() => Promise.all(fonts.flatMap(faces).map(f => document.fonts.load(f))))]).then(() => document.fonts.ready)
    // A render must never fall back to a system font. document.fonts.check() isn't enough: it's true when the stylesheet never arrived.
    .then(() => { const miss = fonts.map(f => f.split(':')[0]).filter(fam => ![...document.fonts].some(ff => ff.family.replace(/"/g, '') === fam && ff.status === 'loaded'));
      if (miss.length) { const e = 'fonts failed to load: ' + miss.join(', ') + ' (network, or not a Google Fonts family)'; if (RENDER) throw new Error(e); console.warn(e); } });
  if (RENDER) return document.getElementById('hud').remove();
  // Preview: click to play/pause, arrows scrub, #12.5 in the URL jumps to 12.5s.
  const au = new Audio(VIDEO.audio || ''); const hud = document.getElementById('hud');
  au.currentTime = parseFloat(location.hash.slice(1)) || 0;
  addEventListener('click', () => (au.paused ? au.play() : au.pause()));
  addEventListener('keydown', e => { if (e.key === ' ') au.paused ? au.play() : au.pause(); if (e.key === 'ArrowRight') au.currentTime += 2; if (e.key === 'ArrowLeft') au.currentTime -= 2; });
  window.ready.then(() => (function loop() { seek(au.currentTime); hud.textContent = au.currentTime.toFixed(2) + 's' + (au.paused ? ' (click to play)' : ''); requestAnimationFrame(loop); })());
}
