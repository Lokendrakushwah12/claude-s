// look.js: film and screen looks for any 2D-canvas video. Standalone (no lib.js needed), so music-video, promo-video,
// type-film and explainer-lesson can all load it (dofBand and asciiRender are aliases of type.js's dof() and asciiImage(),
// so those two need type.js). Every pass is a pure function of t over seeded, cached patterns; it works in the canvas's
// own pixels whatever transform the scene left, and scales with the frame (s = 1 at 1080p).
// None of the references used film emulation, so every look is OFF unless asked for, and each pass has a strength k.
//
//   overlay(c, t) { applyLook(c, t, null, LOOK.film16); }                  a preset, after the scene
//   overlay(c, t) { applyLook(c, t, null, { ...LOOK.film16, k: 0.5 }); }   the same at half strength
//   lutStab(c, 'thermal')                                                  event passes: call them on the frames that need them
//
// Preset passes run in this order (weave moves the finished frame, so it can run after the scene):
//   weave → scene → soft dofBand rgbSplit bloom halftone → grade → halation → screenDoor crtMask vhs → flicker → vignette → grain → dust
// Event passes: lutStab asciiRender crtCollapse vhsTear filmBurn blueTear stutterRepeat defocusExit mosh
//
// Cost per frame at 1920x1080, render.mjs wall time over 360 frames on an M4 Pro (a plain frame ≈ 62 ms, Chrome-bound):
//   the draws themselves hide in the screenshot's slack (weave grade halation flicker vignette dust soft dofBand rgbSplit
//   bloom crtMask lutStab burn tears mosh: 0–3 ms each, within noise). What costs is entropy: noise and fine masks make
//   every screenshot slower to encode. filmGrain +30–45 ms (k 0.09–0.2), screenDoor +13, halftone +9, a vhsTear frame +11.
//   presets: film16 +29  archival +30  crt +14  lcd +28  vhs +31 (so ~1.5× the render time); none +0.
//   For drafts render without grain, or render clean and add the grain afterwards with filmlook.sh.
//   lutStab reads the canvas back (getImageData, ~9 ms of JS on its own): keep it to its 2–3 stab frames.
(() => {
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, p) => a + (b - a) * p;
const rnd = seed => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash = n => rnd(n * 2654435761)();
const fr = (t, fps = 24) => Math.floor(t * fps + 1e-6); // film frame index: grain, flicker and dust change 24 times a second
const BUF = {};
const buf = (key, w, h) => { // reusable offscreen canvas, cleared
  let b = BUF[key]; if (!b || b.width !== w || b.height !== h) { b = BUF[key] = document.createElement('canvas'); b.width = w; b.height = h; }
  const x = b.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, w, h); return [b, x];
};
const tile = (key, w, h, fn) => BUF['~' + key] || (BUF['~' + key] = (() => { const b = document.createElement('canvas'); b.width = w; b.height = h; fn(b.getContext('2d'), w, h); return b; })());
const snap = c => { const [b, x] = buf('snap', c.canvas.width, c.canvas.height); x.drawImage(c.canvas, 0, 0); return b; };
const begin = c => { // device pixels, default state; every pass pairs it with c.restore()
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  const w = c.canvas.width, h = c.canvas.height; return [w, h, Math.min(w, h) / 1080];
};
const warned = {}; // dofBand and asciiRender reuse type.js; without it they skip, with one warning (render.mjs prints it)
const need = fn => typeof window[fn] === 'function' || (warned[fn] || console.warn(`look.js: ${fn}() comes from type.js, which isn't loaded; pass skipped`), (warned[fn] = true), false);
const fill = (c, op, color, a) => { c.globalCompositeOperation = op; c.globalAlpha = clamp(a); c.fillStyle = color; c.fillRect(0, 0, c.canvas.width, c.canvas.height); };

// ---- film ----
// Gate weave: the frame drifts a few px on two slow sines per axis (tested ffmpeg values), zoomed 1.2 % so edges stay covered.
function weave(c, t, k = 1) {
  if (!k) return; const [w, h, s] = begin(c), src = snap(c), T = 2 * Math.PI * t, z = 1 + 0.012 * Math.min(k, 1.5);
  c.translate(w / 2 + k * s * (4 * Math.sin(T * 0.53) + 2 * Math.sin(T * 1.9)), h / 2 + k * s * (3 * Math.sin(T * 0.71 + 1.3) + 1.5 * Math.sin(T * 2.7)));
  c.scale(z, z); c.drawImage(src, -w / 2, -h / 2); c.restore();
}
// Print grade: less saturation, lifted cool blacks, rolled warm highlights, warm mids (the ffmpeg curves as blend fills). mono 1 = b/w.
function grade(c, k = 1, mono = 0) {
  if (!k && !mono) return; begin(c);
  fill(c, 'saturation', '#808080', 0.12 * k + mono); fill(c, 'screen', 'rgb(9,8,15)', k); fill(c, 'multiply', 'rgb(247,245,230)', k); fill(c, 'soft-light', 'rgb(255,190,140)', 0.18 * k);
  c.restore();
}
// Halation: highlights (> ~200) at quarter res, tinted red-orange, blurred and screened back: the glow film puts round bright edges.
function halation(c, k = 0.4) {
  if (!k) return; const [w, h, s] = begin(c), [a, x] = buf('halA', w >> 2, h >> 2), [b, y] = buf('halB', w >> 2, h >> 2);
  x.filter = 'brightness(0.55) contrast(7)'; x.drawImage(c.canvas, 0, 0, a.width, a.height); x.filter = 'none'; fill(x, 'multiply', '#ff6a3a', 1);
  y.filter = `blur(${3.5 * s}px)`; y.drawImage(a, 0, 0);
  c.globalCompositeOperation = 'screen'; c.globalAlpha = clamp(k); c.drawImage(b, 0, 0, w, h); c.restore();
}
// Exposure flicker: ±2 % × k, a new value every film frame.
function flicker(c, t, k = 0.02) {
  if (!k) return; begin(c); const v = (hash(fr(t) * 31 + 7) - 0.5) * 2 * k; fill(c, 'source-over', v > 0 ? 'rgb(255,248,235)' : '#000', Math.abs(v)); c.restore();
}
function vignette(c, k = 0.35) {
  if (!k) return; const [w, h] = begin(c), g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${clamp(k)})`); c.fillStyle = g; c.fillRect(0, 0, w, h); c.restore();
}
// Luma grain: four 512 px noise tiles made once, one per film frame at a seeded offset, hard-light blended so it shows on
// paper and on black alike (overlay hides it at both ends). k 0.09 ≈ the ffmpeg chain's noise=12 (σ ≈ 7 levels); 0.04 is subtle.
function filmGrain(c, t, k = 0.06) {
  if (!k) return; const [w, h, s] = begin(c), f = fr(t);
  const T = tile('grain' + (f % 4), 512, 512, (x, tw, th) => { const r = rnd(f % 4 + 11), d = x.createImageData(tw, th);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] = d.data[i + 1] = d.data[i + 2] = 128 + (r() + r() + r() - 1.5) * 150; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); });
  const p = c.createPattern(T, 'repeat'); p.setTransform(new DOMMatrix([s, 0, 0, s, Math.floor(hash(f) * 512), Math.floor(hash(f + 7e3) * 512)]));
  c.globalCompositeOperation = 'hard-light'; c.globalAlpha = clamp(k); c.fillStyle = p; c.fillRect(0, 0, w, h); c.restore();
}
// Dust and scratches: 0–4 specks per film frame (light and dark), and a 1 px scratch held for 8 frames in every 24.
function filmDust(c, t, k = 1) {
  if (!k) return; const [w, h, s] = begin(c), f = fr(t), r = rnd(f * 31 + 5);
  for (let i = 0, n = Math.floor(r() * 4.99 * Math.min(k, 2)); i < n; i++) {
    c.fillStyle = r() < 0.5 ? 'rgb(255,250,240)' : 'rgb(24,20,16)'; c.globalAlpha = clamp(0.7 * k);
    c.beginPath(); c.ellipse(r() * w, r() * h, (1 + r() * 2.5) * s, (1 + r() * 1.5) * s, r() * 3, 0, 7); c.fill();
  }
  const g = Math.floor(f / 8), rs = rnd(g * 97 + 3);
  if (g % 3 === 0) { c.fillStyle = 'rgb(255,250,240)'; c.globalAlpha = clamp(0.5 * k); c.fillRect(w * (0.15 + 0.7 * rs()) + Math.sin(f) * s, 0, s, h * (0.4 + 0.6 * rs())); }
  c.restore();
}

// ---- screen ----
// Soft: horizontal resolution loss (VHS ~ 1/3 width), by squeezing the frame and stretching it back.
function soft(c, k = 0.6) {
  if (!k) return; const [w, h] = begin(c), [b, x] = buf('soft', Math.max(8, Math.round(w / (1 + 2 * k))), h);
  x.drawImage(c.canvas, 0, 0, b.width, h); c.drawImage(b, 0, 0, w, h); c.restore();
}
// Macro-lens focus band (thin alias over type.js dof()): the frame defocuses outside a band at y (0..1) of half-height band.
function dofBand(c, k = 1, y = 0.5, band = 0.12) {
  if (!k || !need('dof')) return; const h = c.canvas.height, s = Math.min(c.canvas.width, h) / 1080;
  dof(c, y * h, band * h * 0.6, { blur: 7 * s * k, feather: band * h * 0.8, vignette: 0 });
}
// Chromatic split: red right, blue left by 0.42 % of W × k (k 0.12 ≈ the film chain's 1 px fringe).
function rgbSplit(c, k = 0.5) {
  if (!k) return; const [w, h] = begin(c), src = snap(c), d = 0.0042 * w * k, [b, x] = buf('rgb', w, h);
  fill(c, 'source-over', '#000', 1); c.globalCompositeOperation = 'lighter';
  for (const [dx, col] of [[d, '#f00'], [0, '#0f0'], [-d, '#00f']]) {
    x.globalCompositeOperation = 'source-over'; x.drawImage(src, 0, 0); if (dx) x.drawImage(src, dx, 0); fill(x, 'multiply', col, 1); c.drawImage(b, 0, 0);
  }
  c.restore();
}
function bloom(c, k = 0.5, r = 18) {
  if (!k) return; const [w, h, s] = begin(c), [b, x] = buf('bloom', w >> 2, h >> 2);
  x.filter = `blur(${(r * s) / 4}px)`; x.drawImage(c.canvas, 0, 0, b.width, b.height);
  c.globalCompositeOperation = 'screen'; c.globalAlpha = clamp(k); c.drawImage(b, 0, 0, w, h); c.restore();
}
// Real halftone (dot size follows luminance, by thresholding luma + a radial cell ramp), multiplied over the frame.
// For a duotone stab, follow it with lutStab(c, 'navy').
function halftone(c, k = 1, pitch = 6) {
  if (!k) return; const [w, h, s] = begin(c), P = Math.max(3, Math.round(pitch * s)), [b, x] = buf('ht', w, h);
  const T = tile('ht' + P, P, P, y => { const g = y.createRadialGradient(P / 2, P / 2, 0, P / 2, P / 2, P * 0.7071); g.addColorStop(0, '#000'); g.addColorStop(1, '#fff'); y.fillStyle = g; y.fillRect(0, 0, P, P); });
  x.filter = 'grayscale(1)'; x.drawImage(c.canvas, 0, 0); x.filter = 'none'; x.globalCompositeOperation = 'lighter'; x.fillStyle = x.createPattern(T, 'repeat'); x.fillRect(0, 0, w, h);
  c.filter = 'brightness(0.502) contrast(250)'; c.globalCompositeOperation = 'multiply'; c.globalAlpha = clamp(k); c.drawImage(b, 0, 0); c.restore();
}
// LCD screen door: 2 px R/G/B columns with a 1 px gutter (7 px pitch at 1080p), multiplied.
function screenDoor(c, k = 0.45) {
  if (!k) return; const [w, h, s] = begin(c), P = Math.max(4, Math.round(7 * s)), cw = (P - 1) / 3;
  const T = tile('door' + P, P, P, x => { x.fillStyle = '#000'; x.fillRect(0, 0, P, P); ['#f00', '#0f0', '#00f'].forEach((col, i) => { x.fillStyle = col; x.fillRect(Math.round(i * cw), 0, Math.round((i + 1) * cw) - Math.round(i * cw), P - 1); }); });
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = clamp(k); c.fillStyle = c.createPattern(T, 'repeat'); c.fillRect(0, 0, w, h); c.restore();
}
// CRT: scanlines every 3 px plus a soft RGB aperture grille, multiplied.
function crtMask(c, k = 0.5) {
  if (!k) return; const [w, h, s] = begin(c), P = Math.max(3, Math.round(3 * s));
  const T = tile('crt' + P, P, P, x => { for (let i = 0; i < P; i++) for (let j = 0; j < P; j++) { const ch = Math.floor((i * 3) / P), v = j === P - 1 ? 0.3 : 1, o = [0.55, 0.55, 0.55]; o[ch] = 1; x.fillStyle = `rgb(${o.map(q => Math.round(q * v * 255))})`; x.fillRect(i, j, 1, 1); } });
  c.globalCompositeOperation = 'multiply'; c.globalAlpha = clamp(k); c.fillStyle = c.createPattern(T, 'repeat'); c.fillRect(0, 0, w, h); c.restore();
}

// ---- events (call them on the frames that need them) ----
// LUT stab: luma mapped through a colour ramp. 2–3 frames as cut glue. getImageData: ~20 ms at 1080p, so stab frames only.
const LUTS = {
  thermal: ['#000000', '#2B0A3D', '#B0306A', '#F07A2A', '#FFE9A0', '#FFFFFF'], navy: ['#0A1478', '#5B3AA8', '#F5D0FF'],
  paper: ['#F4EDE4', '#3A3530'], phosphor: ['#000000', '#0D3B22', '#39E27A', '#E6FFF0'], cyan: ['#001018', '#0A5A78', '#6FF2FF'],
};
function lutStab(c, name = 'thermal', k = 1) {
  const [w, h] = begin(c), st = LUTS[name].map(x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16))), T = new Uint8ClampedArray(768);
  for (let v = 0; v < 256; v++) { const f = (v / 255) * (st.length - 1), i = Math.min(st.length - 2, Math.floor(f)), u = f - i; for (let ch = 0; ch < 3; ch++) T[v * 3 + ch] = st[i][ch] + (st[i + 1][ch] - st[i][ch]) * u; }
  const d = c.getImageData(0, 0, w, h), p = d.data, m = clamp(k);
  for (let i = 0; i < p.length; i += 4) { const v = ((p[i] * 54 + p[i + 1] * 183 + p[i + 2] * 19) >> 8) * 3; p[i] += (T[v] - p[i]) * m; p[i + 1] += (T[v + 1] - p[i + 1]) * m; p[i + 2] += (T[v + 2] - p[i + 2]) * m; }
  c.putImageData(d, 0, 0); c.restore();
}
// ASCII (thin alias over type.js asciiImage()): the frame as one glyph per cell by luminance, on a ground. o: cell color ground chars.
function asciiRender(c, k = 1, o = {}) {
  if (!k || !need('asciiImage')) return; const { cell = 12, color = '#ffffff', ground = '#000000', chars } = o, [w, h, s] = begin(c), src = snap(c), C = cell * s;
  c.globalAlpha = clamp(k); c.fillStyle = ground; c.fillRect(0, 0, w, h);
  asciiImage(c, src, 0, 0, w, h, { cols: Math.ceil(w / C), rows: Math.ceil(h / C), color, ...(chars && { ramp: chars }) }); c.restore();
}
// CRT power-off: p 0 (full) → 0.6 (a hot line) → 1 (dark). Run p from 1 to 0 for power-on.
function crtCollapse(c, p, glow = '#E8FFF4', ground = '#04030C') {
  if (p <= 0) return; const [w, h, s] = begin(c), src = snap(c), q = clamp(p); fill(c, 'source-over', ground, 1);
  const sy = q < 0.6 ? lerp(1, 0.004, (q / 0.6) ** 3) : 0.004, sx = q < 0.6 ? 1 : lerp(1, 0, ((q - 0.6) / 0.4) ** 3);
  if (q < 1) {
    c.save(); c.translate(w / 2, h / 2); c.scale(sx, sy); c.drawImage(src, -w / 2, -h / 2); c.restore();
    const lw = 3 * s + 10 * s * clamp((q - 0.4) / 0.2); c.globalCompositeOperation = 'lighter'; c.globalAlpha = clamp((q - 0.3) / 0.3); c.fillStyle = glow;
    c.filter = `blur(${8 * s}px)`; c.fillRect(w / 2 - (w * sx) / 2, h / 2 - lw / 2, w * sx, lw); c.filter = 'none'; c.fillRect(w / 2 - (w * sx) / 2, h / 2 - 1.5 * s, w * sx, 3 * s);
  }
  c.restore();
}
// VHS tracking tear: torn bands slide sideways, a ±6 px chroma split, white dropout dashes, head-switching noise at the bottom.
// Hold it for ~3 frames (the vhs preset fires one every 2.5 s).
function vhsTear(c, t, k = 1) {
  if (!k) return; const [w, h, s] = begin(c), r = rnd(fr(t, 30) * 131 + 17), src = snap(c);
  for (let i = 0, n = 2 + Math.floor(r() * 3); i < n; i++) { const y = r() * h * 0.9, bh = (6 + r() * 50) * s; c.drawImage(src, 0, y, w, bh, (r() - 0.5) * 90 * s * k, y, w, bh); }
  c.restore(); rgbSplit(c, (6 * Math.min(w, h) * k) / 1080 / (0.0042 * w)); begin(c);
  c.fillStyle = '#fff'; for (let i = 0; i < 40 * k; i++) { c.globalAlpha = 0.35 + 0.6 * r(); c.fillRect(r() * w, r() * h, (10 + r() * 90) * s, (1 + r() * 2) * s); }
  const by = h - 14 * s; c.drawImage(src, 0, by, w, 14 * s, 24 * s * k, by, w, 14 * s);
  for (let i = 0; i < 160 * k; i++) { c.globalAlpha = r() * 0.7; c.fillStyle = r() < 0.5 ? '#fff' : '#000'; c.fillRect(r() * w, by + r() * 14 * s, (4 + r() * 40) * s, s); }
  c.restore();
}
// Film burn: an orange-white fractal flame grows from a corner (0 TL, 1 TR, 2 BL, 3 BR) as p goes 0 → 1. Use 6–10 frames.
function filmBurn(c, p, o = {}) {
  if (p <= 0) return; const { corner = 0, seed = 1 } = o, [w, h, s] = begin(c), gw = 192, gh = Math.round((gw * h) / w), [b, x] = buf('burn', gw, gh), d = x.createImageData(gw, gh), q = d.data;
  const lat = (i, j) => hash(i * 7919 + j * 104729 + seed * 1299709), sm = u => u * u * (3 - 2 * u);
  const noise = (u, v) => { const i = Math.floor(u), j = Math.floor(v), fu = sm(u - i), fv = sm(v - j); return lerp(lerp(lat(i, j), lat(i + 1, j), fu), lerp(lat(i, j + 1), lat(i + 1, j + 1), fu), fv); };
  const ramp = [[0, 0, 0, 0], [170, 25, 0, 0.75], [255, 105, 15, 1], [255, 200, 110, 1], [255, 252, 240, 1]];
  const cx = corner & 1 ? gw : 0, cy = corner & 2 ? gh : 0, R = Math.hypot(gw, gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const n = noise(i / 24, j / 24) * 0.55 + noise(i / 9, j / 9) * 0.3 + noise(i / 4, j / 4) * 0.15, v = clamp((p * 1.3 - Math.hypot(i - cx, j - cy) / R - (n - 0.5) * 0.7) * 3) * 4;
    const k0 = Math.min(3, Math.floor(v)), u = v - k0, A = ramp[k0], B = ramp[k0 + 1], o4 = (j * gw + i) * 4;
    for (let ch = 0; ch < 3; ch++) q[o4 + ch] = lerp(A[ch], B[ch], u); q[o4 + 3] = 255 * lerp(A[3], B[3], u);
  }
  x.putImageData(d, 0, 0); c.globalCompositeOperation = 'screen'; c.filter = `blur(${3 * s}px)`; c.drawImage(b, 0, 0, w, h); c.restore();
}
// Blue tear: the frame shreds into 12 bands, each shoved ±4 % of W, screened over #2A2AD0, with magenta seams. 2–3 frames.
function blueTear(c, t, k = 1) {
  if (!k) return; const [w, h, s] = begin(c), src = snap(c), r = rnd(fr(t, 30) * 71 + 3), bh = h / 12;
  fill(c, 'source-over', '#2A2AD0', 1);
  for (let i = 0; i < 12; i++) { c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.9; c.drawImage(src, 0, i * bh, w, bh, (r() - 0.5) * 0.08 * w * k, i * bh, w, bh);
    if (r() < 0.5) { c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.fillStyle = '#FF2BD6'; c.fillRect(0, i * bh, w, 2 * s); } }
  c.restore();
}
// Stutter: the frame echoed n times across x (gap × W × k apart), lighten-blended (op 'darken' on a light ground).
function stutterRepeat(c, k = 1, n = 4, gap = 0.06, op = 'lighten') {
  if (!k) return; const [w] = begin(c), src = snap(c); c.globalCompositeOperation = op;
  for (let i = 1; i < n; i++) c.drawImage(src, i * gap * w * k, 0); c.restore();
}
// Defocus exit: scale 1 + 0.1p, drift up 4 % H, blur 12p, grey, fade. layer = a full-frame canvas holding what leaves
// (e.g. from type.js scratch()); without one the whole frame leaves over `ground`.
function defocusExit(c, p, layer, ground = '#000') {
  const [w, h, s] = begin(c), src = layer || snap(c); if (!layer) fill(c, 'source-over', ground, 1);
  if (p < 1) { c.globalAlpha = clamp(1 - p); if (p > 0) c.filter = `blur(${12 * p * s}px) grayscale(${clamp(p)})`; c.translate(w / 2, h / 2 - 0.04 * h * p); c.scale(1 + 0.1 * p, 1 + 0.1 * p); c.drawImage(src, -w / 2, -h / 2); }
  c.restore();
}
// Datamosh blocks: clusters of 36 px blocks (at 1080p) copied from a shifted spot, or from o.from (a stale frame),
// re-rolled `hold` times a second (10 = held on threes at 30 fps). k = how much of the frame breaks up.
function mosh(c, t, k = 1, o = {}) {
  if (!k) return; const { block = 36, hold = 10, from, seed = 1 } = o, [w, h, s] = begin(c), B = Math.max(4, Math.round(block * s)), src = from || snap(c), f = Math.floor(t * hold + 1e-6);
  for (let j = 0; j < Math.ceil(h / B); j++) for (let i = 0; i < Math.ceil(w / B); i++) {
    if (hash(Math.floor(i / 4) * 977 + Math.floor(j / 2) * 7919 + f * 104729 + seed) > 0.3 * k) continue;
    const r = rnd(i * 73856093 ^ j * 19349663 ^ (f + seed) * 83492791), dx = from ? 0 : Math.round((r() - 0.5) * 4) * B, dy = from ? 0 : Math.round((r() - 0.5) * 2) * B;
    c.drawImage(src, i * B + dx, j * B + dy, B, B, i * B, j * B, B, B);
  }
  c.restore();
}

// ---- presets ----
// Strengths per pass; k scales them all. Off unless asked for: LOOK.none is the default for every skill.
const LOOK = {
  none: {},
  film16: { weave: 1, grade: 0.8, halation: 0.45, flicker: 0.02, vignette: 0.35, grain: 0.09, dust: 0.8 },                   // a 16 mm print
  archival: { weave: 1.6, grade: 0.6, mono: 1, halation: 0.15, flicker: 0.05, vignette: 0.55, grain: 0.16, dust: 1.6 },      // old b/w newsreel
  crt: { rgbSplit: 0.3, bloom: 0.5, crtMask: 0.55, flicker: 0.012, vignette: 0.5 },                                          // a tube monitor
  lcd: { dofBand: 1, rgbSplit: 0.2, bloom: 0.35, screenDoor: 0.45, vignette: 0.45 },                                         // an LCD through a macro lens
  vhs: { soft: 0.6, rgbSplit: 0.5, bloom: 0.2, grade: 0.3, crtMask: 0.25, vhs: 1, grain: 0.1, vignette: 0.3 },               // tape, with a tear every 2.5 s
};
// One call per frame, after the scene. src: a canvas holding the scene (default: c's own canvas). L: a preset, its name, or
// { ...LOOK.x, k, focus (dofBand y), grainFn (c, t, k) to swap the grain, e.g. type.js grain or lib.js paper }.
function applyLook(c, t, src, L = {}) {
  if (typeof L === 'string') { if (!LOOK[L]) throw new Error(`applyLook: no preset "${L}" (${Object.keys(LOOK).filter(n => n !== 'apply')})`); L = LOOK[L]; }
  const k = L.k ?? 1, g = n => (L[n] || 0) * k;
  if (src && src !== c.canvas) { begin(c); c.drawImage(src, 0, 0); c.restore(); }
  weave(c, t, g('weave'));
  soft(c, g('soft')); dofBand(c, g('dofBand'), L.focus ?? 0.5); rgbSplit(c, g('rgbSplit')); bloom(c, g('bloom')); halftone(c, g('halftone'));
  grade(c, g('grade'), g('mono')); halation(c, g('halation'));
  screenDoor(c, g('screenDoor')); crtMask(c, g('crtMask')); if (g('vhs') && fr(t, 30) % 75 < 3) vhsTear(c, t, g('vhs'));
  flicker(c, t, g('flicker')); vignette(c, g('vignette')); if (g('grain')) (L.grainFn || filmGrain)(c, t, g('grain')); filmDust(c, t, g('dust'));
}
// Assigned, not declared, so a page's own names win. applyLook only where free: explainer-lesson's kit.js has its own.
Object.assign(window, { weave, grade, halation, flicker, vignette, filmGrain, filmDust, soft, dofBand, rgbSplit, bloom, halftone, screenDoor, crtMask,
  LUTS, lutStab, asciiRender, crtCollapse, vhsTear, filmBurn, blueTear, stutterRepeat, defocusExit, mosh, LOOK });
LOOK.apply = applyLook; if (typeof window.applyLook !== 'function') window.applyLook = applyLook;
})();
