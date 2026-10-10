// Swiss / editorial kinetic-type helpers. Sits on top of lib.js (bg text prog ease rng clamp lerp W H) and
// promo.js (spring stagger rrect pill card counter withBlur glow). Every helper is a pure function of what you pass in,
// so seek(t) stays deterministic. Nothing here keeps state between frames except the offscreen `cached()` renders,
// which are the same on every frame.
const S = Math.min(W, H) / 1080; // size scale: 1 at 1080p
const TYPE = { display: 'Inter Tight', ui: 'Inter', weight: 500, track: -0.045 }; // video.js overrides with the brand's fonts; track is in em

// ---- motion ----
// Closed-form damped spring in SECONDS, 0 -> 1. k = stiffness, d = damping. 260/24 has a hair of overshoot (type);
// 170/26 is critically damped (camera); 320/30 is snappy (UI). Pure function of t, so frame 812 needs no history.
function spr(t, k = 260, d = 24) {
  if (t <= 0) return 0;
  const w0 = Math.sqrt(k), z = d / (2 * w0);
  if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); }
  return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
}
// A value with several targets: one spring per change, summed, so motion stays continuous. keys = [[time, value], ...].
function track(t, keys, k = 170, d = 26) { let v = keys[0][1]; for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spr(t - keys[i][0], k, d); return v; }
// Camera: zoom s about (x, y), then draw.
function cam(c, s, x = W / 2, y = H / 2, dx = 0, dy = 0) { c.translate(x + dx, y + dy); c.scale(s, s); c.translate(-x, -y); }

// ---- type ----
function setFont(c, size, weight = TYPE.weight, font = TYPE.display, trk = TYPE.track) { c.font = `${weight} ${size}px "${font}"`; c.letterSpacing = trk * size + 'px'; }
function tw(c, str, size, weight, font, trk) { c.save(); setFont(c, size, weight, font, trk); const w = c.measureText(str).width - (trk ?? TYPE.track) * size; c.restore(); return w; }
// Display word on its alphabetic baseline. o: size weight font track color align alpha stroke
function word(c, str, x, y, o = {}) {
  const { size = 200, weight, font, track: trk, color = '#000', align = 'left', alpha = 1, stroke } = o;
  if (alpha <= 0) return;
  c.save(); c.globalAlpha *= alpha; setFont(c, size, weight, font, trk); c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  const w = align === 'left' ? 0 : tw(c, str, size, weight, font, trk), x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  if (stroke) { c.lineWidth = stroke; c.strokeStyle = color; c.lineJoin = 'round'; c.strokeText(str, x0, y); } else { c.fillStyle = color; c.fillText(str, x0, y); }
  c.restore();
}
const ui = (c, str, x, y, o = {}) => word(c, str, x, y, { size: 26 * S, weight: 400, font: TYPE.ui, track: -0.01, ...o }); // small labels
// Masked baseline rise: the word slides up from behind its own baseline. p is 0..1 (a spring may overshoot a hair).
function rise(c, str, x, y, p, o = {}) {
  if (p <= 0) return;
  const size = o.size || 200, align = o.align || 'left', w = tw(c, str, size, o.weight, o.font, o.track);
  const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  c.save(); c.beginPath(); c.rect(x0 - size * 0.3, y - size * 1.0, w + size * 0.6, size * 1.26); c.clip();
  word(c, str, x0, y + (1 - p) * size * 1.08, { ...o, align: 'left' });
  c.restore();
}
// Letter-by-letter rise, each character on its own spring, `gap` seconds apart. t = seconds since the word starts.
function riseChars(c, str, x, y, t, o = {}) {
  const { gap = 0.03, k = 260, d = 24, size = 200, align = 'left' } = o, full = tw(c, str, size, o.weight, o.font, o.track);
  if (t > gap * str.length + 0.6) return word(c, str, x, y, o); // settled: draw whole, keeps kerning
  const x0 = align === 'left' ? x : align === 'right' ? x - full : x - full / 2;
  [...str].forEach((ch, i) => ch !== ' ' && rise(c, ch, x0 + tw(c, str.slice(0, i), size, o.weight, o.font, o.track), y, spr(t - i * gap, k, d), { ...o, align: 'left' }));
}
// Letters pop in (or out, with p falling) in a seeded random order, like the small editorial labels.
function scramble(c, str, x, y, p, o = {}) {
  if (p <= 0) return; if (p >= 1) return (o.big ? word : ui)(c, str, x, y, o);
  const draw = o.big ? word : ui, size = o.size || (o.big ? 200 : 26 * S), f = o.big ? {} : { weight: 400, font: TYPE.ui, track: -0.01 }, oo = { ...f, ...o, size };
  const r = rng((o.seed || 7) + str.length * 131), full = tw(c, str, size, oo.weight, oo.font, oo.track), align = o.align || 'left';
  const x0 = align === 'left' ? x : align === 'right' ? x - full : x - full / 2;
  [...str].forEach((ch, i) => { if (r() < p && ch !== ' ') draw(c, ch, x0 + tw(c, str.slice(0, i), size, oo.weight, oo.font, oo.track), y, { ...oo, align: 'left' }); });
}
// Typed-on sentence (no caret): the first n characters of str.
const typed = (c, str, x, y, p, o = {}) => p > 0 && (o.big ? word : ui)(c, str.slice(0, Math.round(clamp(p) * str.length)), x, y, o);

// ---- editorial furniture ----
// Grid-paper ground. cell in px; pass line = null for a plain ground.
function grid(c, ground, line, cell = 60 * S, ox = 0, oy = 0) {
  bg(c, ground); if (!line) return;
  c.save(); c.strokeStyle = line; c.lineWidth = Math.max(1, S); c.beginPath();
  for (let x = ((ox % cell) + cell) % cell; x < W; x += cell) { c.moveTo(Math.round(x) + 0.5, 0); c.lineTo(Math.round(x) + 0.5, H); }
  for (let y = ((oy % cell) + cell) % cell; y < H; y += cell) { c.moveTo(0, Math.round(y) + 0.5); c.lineTo(W, Math.round(y) + 0.5); }
  c.stroke(); c.restore();
}
// Highlighter block that wipes in left -> right (p 0..1) — the accent used as a FIELD behind a word.
function hl(c, x, y, w, h, p, color) { if (p <= 0) return; c.fillStyle = color; c.fillRect(x, y, w * ease.inOut(clamp(p)), h); }
// Thick editorial arrow that draws itself: shaft, then head. Anchored at its tail (x, y), pointing along rot.
function arrow(c, x, y, len, p, o = {}) {
  if (p <= 0) return; const { color = '#000', lw = len * 0.1, rot = 0 } = o, e = ease.out(clamp(p)), q = ease.out(prog(p, 0.3, 1)), a = len * 0.48 * q;
  c.save(); c.translate(x, y); c.rotate(rot); c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.beginPath(); c.moveTo(0, 0); c.lineTo(len * e, 0); c.stroke();
  if (q > 0) { c.beginPath(); c.moveTo(len - a * 0.7071, -a * 0.7071); c.lineTo(len, 0); c.lineTo(len - a * 0.7071, a * 0.7071); c.stroke(); }
  c.restore();
}
// Polyline drawn to fraction q of its length.
function polyPart(c, pts, q) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), L = seg.reduce((a, b) => a + b, 0) * clamp(q);
  c.beginPath(); c.moveTo(...pts[0]); let acc = 0;
  for (let i = 0; i < seg.length; i++) { const f = clamp((L - acc) / seg[i]); if (f <= 0) break; c.lineTo(lerp(pts[i][0], pts[i + 1][0], f), lerp(pts[i][1], pts[i + 1][1], f)); acc += seg[i]; }
  c.stroke();
}
// Circled check mark that draws itself.
function check(c, x, y, r, o = {}) {
  const { color = '#000', lw = r * 0.14, p = 1 } = o; if (p <= 0) return;
  c.save(); c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ease.out(clamp(p * 1.5))); c.stroke();
  polyPart(c, [[x - r * 0.42, y + r * 0.02], [x - r * 0.12, y + r * 0.32], [x + r * 0.45, y - r * 0.3]], prog(p, 0.35, 1));
  c.restore();
}
// Endless row of type. items: strings, '✓' (check icon) or { s, size, dy, color, weight, font, track }. off = scroll in px.
function marquee(c, items, y, off, o = {}) {
  const { size = 120, gap = size * 0.32 } = o;
  const run = (x0, dry) => {
    let x = x0;
    for (const it of items) {
      const m = typeof it === 'string' ? { s: it } : it;
      if (m.s === '✓') { const r = size * 0.3; if (!dry) check(c, x + r, y - size * 0.34, r, { color: m.color || o.color, lw: size * 0.055 }); x += r * 2 + gap; continue; }
      const sz = m.size || size; if (!dry) word(c, m.s, x, y + (m.dy || 0), { ...o, ...m, size: sz, align: 'left' });
      x += tw(c, m.s, sz, m.weight ?? o.weight, m.font ?? o.font, m.track ?? o.track) + gap;
    }
    return x - x0;
  };
  const unit = run(0, true); for (let x = -(((off % unit) + unit) % unit); x < W; x += unit) run(x, false);
}
// Extruded ring (a 3D "O") spinning about the vertical axis: back-to-front annulus layers, then the lit face.
function ring3d(c, x, y, R, r, depth, theta, o = {}) {
  const { face = '#fff', side = '#888', layers = 36 } = o, cx = Math.cos(theta), dx = depth * Math.sin(theta);
  const ann = (ox, col) => { c.beginPath(); c.ellipse(x + ox, y, Math.max(0.5, R * Math.abs(cx)), R, 0, 0, 7); c.ellipse(x + ox, y, Math.max(0.3, r * Math.abs(cx)), r, 0, 0, 7); c.fillStyle = col; c.fill('evenodd'); };
  for (let i = 0; i <= layers; i++) ann(lerp(-dx / 2, dx / 2, i / layers), side);
  ann(dx / 2, face);
}
// Concentric orbit rings with dots. rings: [{ r, n, dot, speed, lw, alpha, blur }]. Returns dot positions per ring.
function orbit(c, x, y, rings, t, grow = 1) {
  return rings.map((g, gi) => {
    const R = g.r * grow, pts = [];
    c.save(); if (g.blur) c.filter = `blur(${g.blur}px)`;
    c.globalAlpha = g.alpha ?? 0.4; c.strokeStyle = g.color || '#fff'; c.lineWidth = g.lw || 2; c.beginPath(); c.arc(x, y, R, 0, 7); c.stroke();
    c.globalAlpha = 1; c.fillStyle = g.color || '#fff';
    for (let i = 0; i < g.n; i++) { const a = (i / g.n) * Math.PI * 2 + t * (g.speed || 0.3) + gi; const px = x + Math.cos(a) * R, py = y + Math.sin(a) * R; pts.push([px, py, a]); c.beginPath(); c.arc(px, py, g.dot || 5, 0, 7); c.fill(); }
    c.restore(); return pts;
  });
}
// Nested rounded rectangles receding into the frame (the "tunnel" that frames one punchy line).
function tunnel(c, cx, cy, w, h, n, o = {}) {
  const { k = 0.72, r = 0.3, shades = ['#0d0d0d', '#171717', '#0f0f0f', '#1a1a1a', '#0c0c0c'], from = 0 } = o;
  for (let i = from; i < n; i++) {
    const s = k ** i, ww = w * s, hh = h * s; c.save(); c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 60 * S * s;
    rrect(c, cx - ww / 2, cy - hh / 2, ww, hh, Math.min(ww, hh) * r); c.fillStyle = shades[i % shades.length]; c.fill(); c.restore();
  }
}
// Construction guides around boxes [{x,y,w,h}]: full-bleed lines on every edge + square handles. p draws them in.
function guides(c, boxes, p, o = {}) {
  if (p <= 0) return; const { color = 'rgba(255,255,255,0.45)', handle = '#fff', hs = 10 * S } = o, e = ease.inOut(clamp(p));
  c.save(); c.strokeStyle = color; c.lineWidth = Math.max(1, S);
  for (const b of boxes) {
    for (const yy of [b.y, b.y + b.h]) { const cx = b.x + b.w / 2; c.beginPath(); c.moveTo(cx - W * e, Math.round(yy) + 0.5); c.lineTo(cx + W * e, Math.round(yy) + 0.5); c.stroke(); }
    for (const xx of [b.x, b.x + b.w]) { const cy = b.y + b.h / 2; c.beginPath(); c.moveTo(Math.round(xx) + 0.5, cy - H * e); c.lineTo(Math.round(xx) + 0.5, cy + H * e); c.stroke(); }
  }
  if (e > 0.5) { c.fillStyle = handle; c.globalAlpha = prog(e, 0.5, 0.8);
    for (const b of boxes) for (const [hx, hy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h / 2], [b.x + b.w, b.y + b.h / 2]]) c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs); }
  c.restore();
}
// Full-frame offscreen render, made once and reused (poster walls, repeated layouts). fn(ctx) must be deterministic.
const CACHE = {};
function cached(key, fn) { if (!CACHE[key]) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; fn(cv.getContext('2d')); CACHE[key] = cv; } return CACHE[key]; }

// ---- cinematic devices (added for Keychain v2; techniques distilled from a portfolio reel + a dark AI launch film) ----
TYPE.mono = TYPE.mono || 'IBM Plex Mono';
const hex2 = a => Math.round(clamp(a) * 255).toString(16).padStart(2, '0'); // alpha 0..1 -> 'xx' for '#rrggbb' + alpha
// Reusable offscreen canvas, cleared on every call (for per-frame layers such as a strip you bend).
function scratch(key, w = W, h = H) {
  let cv = CACHE['~' + key]; if (!cv || cv.width !== w || cv.height !== h) { cv = document.createElement('canvas'); cv.width = w; cv.height = h; CACHE['~' + key] = cv; }
  const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, w, h); return [cv, x];
}
// Soft key light on a dark ground: one broad warm pool from above, a faint floor bounce, a vignette. k = intensity.
// (Replaced a striped "stage beams" helper: separate beams read as curtains. One big soft source reads as a lit room.)
function keylight(c, color, t = 0, o = {}) {
  const { k = 1, x = W / 2, drift = 40 * S } = o, cx = x + Math.sin(t * 0.25) * drift;
  const pool = (px, py, rx, ry, a) => { c.save(); c.translate(px, py); c.scale(rx / ry, 1); const g = c.createRadialGradient(0, 0, 0, 0, 0, ry); g.addColorStop(0, color + hex2(a)); g.addColorStop(0.5, color + hex2(a * 0.3)); g.addColorStop(1, color + '00'); c.fillStyle = g; c.fillRect(-ry, -ry, ry * 2, ry * 2); c.restore(); };
  pool(cx, -H * 0.22, W * 0.72, H * 0.95, 0.19 * k); pool(W / 2, H * 1.18, W * 0.6, H * 0.45, 0.05 * k);
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = v; c.fillRect(0, 0, W, H);
}
// Dust motes drifting up through the light, seeded; brighter near the top where the light is.
function dust(c, t, o = {}) {
  const { n = 70, color = '#fff', alpha = 0.3, seed = 5 } = o, r = rng(seed);
  c.save(); c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x0 = r() * W, y0 = r() * H, sp = (10 + r() * 30) * S, sz = (0.6 + r() * 1.8) * S, ph = r() * 6.28, y = (((y0 - t * sp) % H) + H) % H;
    c.globalAlpha = alpha * (0.4 + 0.3 * (1 + Math.sin(t * 1.3 + ph))) * (1 - (y / H) * 0.7); c.beginPath(); c.arc(x0 + Math.sin(t * 0.6 + ph) * 12 * S, y, sz, 0, 7); c.fill();
  }
  c.restore();
}
// Narration line: words arrive one by one out of a blur (the small, centred voice-over look). t = seconds since the line starts; out = when it leaves.
function words(c, str, x, y, t, o = {}) {
  if (t < 0) return; const { gap = 0.08, dur = 0.4, size = 48 * S, align = 'center', out = 1e9, blur = 14 * S } = o;
  const ws = str.split(' '), sp = tw(c, ' ', size, o.weight, o.font, o.track), wd = ws.map(w => tw(c, w, size, o.weight, o.font, o.track));
  const total = wd.reduce((a, b) => a + b, 0) + sp * (ws.length - 1); let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  ws.forEach((w, i) => {
    const pin = ease.out(prog(t, i * gap, i * gap + dur)), a = Math.min(pin, 1 - prog(t, out + i * gap * 0.5, out + i * gap * 0.5 + 0.3));
    if (a > 0.01) { c.save(); if (a < 0.99) c.filter = `blur(${(1 - a) * blur}px)`; word(c, w, cx, y + (1 - pin) * size * 0.22, { ...o, size, alpha: a, align: 'left' }); c.restore(); }
    cx += wd[i] + sp;
  });
}
// Dark glass panel: translucent fill, hairline border, a lit top edge. Reads best on a dark ground under keylight().
function glass(c, x, y, w, h, o = {}) {
  const { r = 28 * S, tint = '#ffffff', alpha = 0.07, edge = 0.16, shadow = true, under } = o;
  c.save(); if (shadow) { c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 60 * S; c.shadowOffsetY = 24 * S; }
  rrect(c, x, y, w, h, r); if (under) { c.fillStyle = under; c.fill(); c.shadowColor = 'transparent'; }
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, tint + hex2(alpha * 1.6)); g.addColorStop(1, tint + hex2(alpha * 0.5)); c.fillStyle = g; c.fill(); c.restore();
  c.save(); rrect(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.strokeStyle = tint + hex2(edge); c.lineWidth = 1.5 * S; c.stroke();
  const lg = c.createLinearGradient(x, 0, x + w, 0); lg.addColorStop(0, tint + '00'); lg.addColorStop(0.5, tint + hex2(edge * 2.8)); lg.addColorStop(1, tint + '00');
  c.beginPath(); c.moveTo(x + r, y + 1); c.lineTo(x + w - r, y + 1); c.strokeStyle = lg; c.lineWidth = 2 * S; c.stroke(); c.restore();
}
// Mouse pointer (arrow), tip at (x, y).
function pointer(c, x, y, s = 1, o = {}) {
  const { fill = '#fff', stroke = '#000' } = o; c.save(); c.translate(x, y); c.scale(s * S, s * S); c.beginPath();
  [[0, 0], [0, 34], [9, 26], [15, 40], [21, 37], [15, 24], [27, 24]].forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
  c.closePath(); c.fillStyle = fill; c.fill(); c.lineWidth = 2; c.strokeStyle = stroke; c.stroke(); c.restore();
}
// Printed-label marks scattered on paper: lot codes, barcode fragments, registration crosses, tick rows. Flicker on twos.
// clear = [w, h] fraction of the frame kept empty around the centre for the hero content.
function marks(c, t, o = {}) {
  const { seed = 3, n = 36, color = '#000', alpha = 0.5, codes = ['LOT 26-0928', 'NET WT 12 OZ', 'BATCH 3,000 LB', 'SKU 00812', 'SQF', 'EXP 09/27'], clear = [0.56, 0.46] } = o;
  const r = rng(seed), f = boil(t, 8);
  c.save(); c.globalAlpha = alpha; c.fillStyle = color; c.strokeStyle = color; c.lineWidth = Math.max(1, S);
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, kind = Math.floor(r() * 4), v = r(), on = rng(seed * 97 + i * 13 + f)() > 0.1;
    if (!on || (Math.abs(x - W / 2) < (W * clear[0]) / 2 && Math.abs(y - H / 2) < (H * clear[1]) / 2)) continue;
    if (kind === 0) word(c, codes[Math.floor(v * codes.length)], x, y, { size: 13 * S, weight: 500, font: TYPE.mono, track: 0.04, color });
    else if (kind === 1) { const rr = rng(seed + i); let bx = x; for (let k = 0; k < 16; k++) { const bw = (1 + Math.floor(rr() * 3)) * S; if (rr() > 0.4) c.fillRect(bx, y - 12 * S, bw, 14 * S); bx += bw + S; } }
    else if (kind === 2) { const s = 8 * S; c.beginPath(); c.arc(x, y, s * 0.6, 0, 7); c.moveTo(x - s, y); c.lineTo(x + s, y); c.moveTo(x, y - s); c.lineTo(x, y + s); c.stroke(); }
    else for (let k = 0; k < 9; k++) c.fillRect(x + k * 5 * S, y - (k % 4 ? 5 : 9) * S, S, (k % 4 ? 5 : 9) * S);
  }
  c.restore();
}
// Retail barcode (EAN-13 look): seeded modules, long guard bars. p draws it in; grow stretches bars to full height; widen fattens them until they merge.
function barcode(c, x, y, w, h, o = {}) {
  const { seed = 12, color = '#000', p = 1, grow = 0, widen = 0, digits = true } = o, r = rng(seed), mods = [];
  const half = () => { for (let k = 0; k < 42; k++) mods.push([r() > 0.5 ? 1 : 0, 0]); };
  mods.push([1, 1], [0, 1], [1, 1]); half(); mods.push([0, 1], [1, 1], [0, 1], [1, 1], [0, 1]); half(); mods.push([1, 1], [0, 1], [1, 1]);
  const mw = w / mods.length, n = Math.floor(mods.length * clamp(p)), top = lerp(y, -H * 0.1, grow);
  c.save(); c.fillStyle = color;
  for (let i = 0; i < n; i++) { const [on, g] = mods[i]; if (!on) continue; const bot = lerp(y + h + (g ? h * 0.1 : 0), H * 1.1, grow), ww = mw * (1 + widen * 7); c.fillRect(x + i * mw + mw / 2 - ww / 2, top, ww + 0.4, bot - top); }
  if (digits && grow < 0.02 && p >= 1) { const d = Array.from({ length: 13 }, (_, i) => Math.floor(rng(seed * 5 + i)() * 10)).join('');
    [[d[0], x - 26 * S], [d.slice(1, 7), x + w * 0.27], [d.slice(7), x + w * 0.73]].forEach(([s, xx], i) => word(c, s, xx, y + h * 1.1 + 34 * S, { size: 30 * S, weight: 500, font: TYPE.mono, track: i ? 0.35 : 0, color, align: i ? 'center' : 'left' })); }
  c.restore();
}
// Split-flap board: each cell riffles through letters before landing on its target. t = seconds since this word was set.
function flap(c, str, x, y, t, o = {}) {
  const { cells = str.length, cw = 100 * S, ch = 146 * S, gap = 10 * S, size = 100 * S, ink = '#fff', face = '#1A1A1B', seed = 1, per = 0.045, spin = 6, prev = '' } = o;
  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', total = cells * (cw + gap) - gap, x0 = x - total / 2, s = str.padEnd(cells).slice(0, cells), pv = prev.padEnd(cells).slice(0, cells);
  for (let i = 0; i < cells; i++) {
    const cx = x0 + i * (cw + gap), lt = t - i * (o.stagger ?? 0.03), flips = s[i] === pv[i] ? 0 : spin + (i % 3), k = Math.floor(lt / per), riffling = lt >= 0 && k < flips;
    const chx = lt < 0 ? pv[i] : riffling ? AZ[Math.floor(rng(seed * 31 + i * 7 + k)() * 26)] : s[i];
    rrect(c, cx, y - ch / 2, cw, ch, 10 * S); c.fillStyle = face; c.fill();
    if (chx !== ' ') word(c, chx, cx + cw / 2, y + size * 0.36, { size, weight: 600, font: TYPE.display, track: 0, color: ink, align: 'center' });
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(cx, y - 1.5 * S, cw, 3 * S);
    if (riffling) { const fr = (lt / per) % 1; c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(cx, y - ch / 2 + (ch / 2) * fr, cw, (ch / 2) * (1 - fr)); }
  }
}
// Chain of links along +x from (x, y): face-on rounded links, edge-on links drawn over them. n may be fractional: each link pops in over 1 unit.
function chain(c, x, y, n, o = {}) {
  const { L = 160 * S, lw = 16 * S, color = '#fff', pitch = L * 0.8, rot = 0 } = o;
  c.save(); c.translate(x, y); c.rotate(rot);
  for (const face of [true, false]) for (let i = 0; i < Math.ceil(n); i++) {
    if ((i % 2 === 0) !== face) continue; const p = ease.back(clamp(n - i)); if (p <= 0) continue;
    c.save(); c.translate(i * pitch, 0); c.scale(p, p);
    if (face) { rrect(c, -L / 2, -L * 0.3, L, L * 0.6, L * 0.3); c.strokeStyle = color; c.lineWidth = lw; c.stroke(); }
    else { rrect(c, -L / 2, -lw * 0.9, L, lw * 1.8, lw * 0.9); c.fillStyle = color; c.fill(); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(-L / 2 + lw, -lw * 0.18, L - lw * 2, lw * 0.36); }
    c.restore();
  }
  c.restore();
}
// Concave curved wall: a flat strip (cards in a row, reflections included) wrapped around the viewer. scroll = strip px at screen centre.
// R ≈ 0.45 W shows about ±50°; edges grow toward the camera like a gallery wall that curves around you.
function bend(c, src, cx, cy, R, scroll, o = {}) {
  const { step = 5, maxA = 0.95, sh = src.height } = o;
  for (let sx = Math.max(0, Math.floor((scroll - maxA * R) / step) * step); sx < Math.min(src.width, scroll + maxA * R); sx += step) {
    const a1 = (sx - scroll) / R, a2 = (sx + step - scroll) / R, x1 = cx + R * Math.tan(a1), x2 = cx + R * Math.tan(a2), hh = sh / Math.cos((a1 + a2) / 2);
    c.drawImage(src, sx, 0, step, sh, x1, cy - hh * 0.4, x2 - x1 + 0.7, hh);
  }
}
// Film grain: four seeded noise tiles made once, one per frame on twos, overlaid softly.
function grain(c, t, alpha = 0.06) {
  const tile = cached('grain' + (boil(t, 12) % 4), x => { const r = rng(boil(t, 12) % 4 + 11), d = x.createImageData(W, H); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); });
  c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = 'overlay'; c.drawImage(tile, 0, 0); c.restore();
}

// =====================================================================================================================
// DEVICE LIBRARY: the 2026-10 reference batch (UGC edits, screen HUDs, iso explainers, recap and lyric films).
// Colours are arguments with neutral defaults: pass the brand's. Hex colours must be '#rrggbb' (some devices append alpha).
// Unless a comment says otherwise, t = seconds since the device starts and p = 0..1 progress. Everything is a pure function of them.
// Screen effects (bloom, rgbSplit, LUT stabs, CRT, film look) live in look.js, not here.

// ---- shared helpers ----
ease.outExpo ??= p => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)); // the UGC slide-in curve
const rgbOf = h => (h.length === 4 ? [1, 2, 3].map(k => parseInt(h[k] + h[k], 16)) : [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)));
const mixHex = (a, b, p) => { const A = rgbOf(a), Z = rgbOf(b); return '#' + A.map((v, i) => Math.round(lerp(v, Z[i], clamp(p))).toString(16).padStart(2, '0')).join(''); };
// Left edge of character i as word() sets it (tracking included), and where a string with o.align starts.
const charX = (c, str, i, size, o = {}) => (i ? tw(c, str.slice(0, i), size, o.weight, o.font, o.track) + (o.track ?? TYPE.track) * size : 0);
const startX = (c, str, x, size, o = {}) => { const a = o.align || 'left', w = a === 'left' ? 0 : tw(c, str, size, o.weight, o.font, o.track); return a === 'right' ? x - w : a === 'center' ? x - w / 2 : x; };
// Point at distance d along a polyline, with its tangent angle: [x, y, angle]. d clamps to the ends.
function polyAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay);
    if (d <= L || i === pts.length - 1) { const f = clamp(d / (L || 1)); return [lerp(ax, bx, f), lerp(ay, by, f), Math.atan2(by - ay, bx - ax)]; }
    d -= L;
  }
  return [pts[0][0], pts[0][1], 0];
}
const polyLen = pts => pts.slice(1).reduce((s, q, i) => s + Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]), 0);
const qbez = (a, k, b, u) => [0, 1].map(j => (1 - u) ** 2 * a[j] + 2 * (1 - u) * u * k[j] + u * u * b[j]); // quadratic Bézier point

// ---- type ----
// Hot keyword: slides in from the right (expo) and each letter cools hot -> warm -> cold in turn, like a fuse. One per phrase.
function hotWord(c, str, x, y, t, o = {}) {
  if (t < 0) return;
  const { size = 160 * S, weight = 800, hot = '#9A9A9A', cold = '#FFFFFF', warm = mixHex(hot, cold, 0.7), stagger = 0.06, cool = 0.15, slide = 0.8, from = 3.3, shadow = 'rgba(0,0,0,0.22)' } = o;
  const oo = { ...o, size, weight, align: 'left' }, x0 = startX(c, str, x, size, { ...o, weight }) + (1 - ease.outExpo(clamp(t / slide))) * size * from;
  c.save(); if (shadow) { c.shadowColor = shadow; c.shadowBlur = size * 0.08; }
  [...str].forEach((ch, i) => { const q = clamp((t - 0.1 - i * stagger) / cool); word(c, ch, x0 + charX(c, str, i, size, oo), y, { ...oo, color: q < 0.5 ? mixHex(hot, warm, q * 2) : mixHex(warm, cold, q * 2 - 1) }); });
  c.restore();
}
// Glow-in: a word sharpens out of a blur in ~3 frames and sheds a bloom over ~6 (a cut that lands on a word).
function glowIn(c, str, x, y, t, o = {}) {
  if (t < 0) return; const { blur = 12 * S, dur = 0.125, glowDur = 0.25, bloom = 30 * S, glow = o.color || '#ffffff' } = o, p = clamp(t / dur);
  c.save(); if (p < 1) c.filter = `blur(${(1 - p) * blur}px)`; c.shadowColor = glow; c.shadowBlur = bloom * (1 - clamp(t / glowDur));
  word(c, str, x, y, { ...o, alpha: (o.alpha ?? 1) * p }); c.restore();
}
// Glyphs shrunk by r px: the intersection of n copies shifted around a circle, on a word-sized scratch layer. Strokes can't do this
// cleanly: they also trace the overlapping contours inside variable-font glyphs (lines through the e and t). Returns [canvas, ctx, bx, by]:
// the word's left baseline sits at (bx, by) on the layer, so draw the layer at (x0 - bx, y - by).
function erodeWord(key, str, o, r, color = '#000000', n = 48) {
  const size = o.size, bx = size * 0.4, by = size * 1.1, [cv, s] = scratch(key, Math.ceil(tw(ctx, str, size, o.weight, o.font, o.track) + bx * 2), Math.ceil(size * 1.5)), oo = { ...o, align: 'left' };
  word(s, str, bx, by, { ...oo, color }); s.globalCompositeOperation = 'destination-in';
  for (let k = 0; k < n; k++) word(s, str, bx + Math.cos((k / n) * 6.2832) * r, by + Math.sin((k / n) * 6.2832) * r, oo);
  s.globalCompositeOperation = 'source-over'; return [cv, s, bx, by];
}
// Inline type: a solid letter with a ground-coloured line running just inside its edge (80s vector-CRT titles).
// edge = rim width, line = inline width, both as fractions of size.
function inlineWord(c, str, x, y, o = {}) {
  const { size = 200 * S, color = '#ffffff', ground = '#000000', edge = 0.035, line = 0.03 } = o, oo = { ...o, size }, x0 = startX(c, str, x, size, o);
  const [ring, s, bx, by] = erodeWord('inline', str, oo, size * edge, ground), [core] = erodeWord('inlineCore', str, oo, size * (edge + line));
  s.globalCompositeOperation = 'destination-out'; s.drawImage(core, 0, 0);
  word(c, str, x0, y, { ...oo, color, align: 'left' }); c.drawImage(ring, x0 - bx, y - by);
}
// Shimmer: a status line ("Projecting coordinates…") whose letters brighten from base to ink as a wave passes. speed in chars/s.
function shimmer(c, str, x, y, t, o = {}) {
  const { size = 30 * S, base = '#9A9A9A', ink = '#111111', speed = 22, band = 5, settle = Infinity } = o, oo = { weight: 400, font: TYPE.ui, track: -0.01, ...o, size, align: 'left' };
  const x0 = startX(c, str, x, size, { ...oo, align: o.align }), head = (t * speed) % (str.length + band * 3) - band;
  [...str].forEach((ch, i) => ch !== ' ' && word(c, ch, x0 + charX(c, str, i, size, oo), y, { ...oo, color: mixHex(base, ink, Math.max(1 - Math.abs(i - head) / band, clamp((t - settle) / 0.4))) }));
}
// Text selection: a band extends char by char behind [from, to) as p goes 0..1, text on top (a live type edit). Returns the band [x, y, w, h].
function selectHL(c, str, x, y, from, to, p, o = {}) {
  const { size = 80 * S, color = '#111111', band = 'rgba(140,140,140,0.35)' } = o, oo = { ...o, size, color, align: 'left' }, x0 = startX(c, str, x, size, o);
  const a = x0 + charX(c, str, from, size, oo), b = x0 + charX(c, str, Math.round(lerp(from, to, clamp(p))), size, oo), box = [a, y - size * 0.9, b - a, size * 1.15];
  if (b > a) { c.fillStyle = band; c.fillRect(...box); }
  word(c, str, x0, y, oo); return box;
}
// Text set along a polyline (a hill, a route), each glyph turned to the tangent. off = px along the path; o.p reveals glyphs in order.
function textOnPath(c, str, pts, off = 0, o = {}) {
  const { size = 40 * S, p = 1 } = o, oo = { weight: 500, ...o, size, align: 'center' };
  [...str].slice(0, Math.ceil(str.length * clamp(p))).forEach((ch, i) => {
    const [px, py, a] = polyAt(pts, off + charX(c, str, i, size, oo) + tw(c, ch, size, oo.weight, oo.font, oo.track) / 2);
    c.save(); c.translate(px, py); c.rotate(a); word(c, ch, 0, 0, oo); c.restore();
  });
}

// ---- captions ----
// Lead-in caption: tiny words pop into pre-spaced slots on their onsets, then the line un-types in reverse, a word every 2 frames.
// ws = [{ w, t }] (t on the same clock as `t`); out = when the un-type starts.
function leadIn(c, ws, x, y, t, out = Infinity, o = {}) {
  const { size = 34 * S, color = '#ffffff', gap = 1.2, frame = 1 / 12, shadow = 'rgba(0,0,0,0.35)' } = o, oo = { weight: 500, font: TYPE.ui, track: -0.01, ...o, size, color, align: 'left' };
  const wd = ws.map(w => tw(c, w.w, size, oo.weight, oo.font, oo.track)), total = wd.reduce((a, b) => a + b, 0) + size * gap * (ws.length - 1);
  const shown = ws.filter(w => t >= w.t).length - Math.max(0, Math.floor((t - out) / frame) + 1);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  c.save(); if (shadow) { c.shadowColor = shadow; c.shadowBlur = size * 0.3; c.shadowOffsetY = size * 0.05; }
  ws.forEach((w, i) => { if (i < shown) word(c, w.w, cx, y, oo); cx += wd[i] + size * gap; }); c.restore();
}
// Karaoke line: words fade on at their sung onsets with a dark keyline; the held word is outline-only. ws = [{ w, on }].
function karaoke(c, ws, x, y, t, o = {}) {
  const { size = 60 * S, fill = '#ffffff', line = '#000000', held = -1, fade = 0.1 } = o, oo = { weight: 800, ...o, size, align: 'left' };
  const sp = tw(c, ' ', size, oo.weight, oo.font, oo.track), wd = ws.map(w => tw(c, w.w, size, oo.weight, oo.font, oo.track)), total = wd.reduce((a, b) => a + b + sp, -sp);
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  ws.forEach((w, i) => {
    const a = clamp((t - w.on) / fade);
    if (a > 0 && i !== held) { word(c, w.w, cx, y, { ...oo, alpha: a, color: line, stroke: size * 0.12 }); word(c, w.w, cx, y, { ...oo, alpha: a, color: fill }); }
    if (a > 0 && i === held) { // hollow: the keyline outside the glyph, then a thin rim (glyph minus its erosion), centre left open
      const [core, , bx, by] = erodeWord('karaokeCore', w.w, oo, size * 0.035), [kv, k] = scratch('karaokeKey', core.width, core.height), [rv, r] = scratch('karaokeRim', core.width, core.height);
      word(k, w.w, bx, by, { ...oo, color: line, stroke: size * 0.12 }); k.globalCompositeOperation = 'destination-out'; word(k, w.w, bx, by, oo);
      word(r, w.w, bx, by, { ...oo, color: fill }); r.globalCompositeOperation = 'destination-out'; r.drawImage(core, 0, 0);
      c.save(); c.globalAlpha *= a; c.drawImage(kv, cx - bx, y - by); c.drawImage(rv, cx - bx, y - by); c.restore();
    }
    cx += wd[i] + sp;
  });
}
// Type behind the subject: footage, then the type, then the footage again through the matte. The matte's ALPHA is the subject (RGBA PNG).
function behind(c, frame, matte, drawType, box = [0, 0, W, H]) {
  c.drawImage(frame, ...box); drawType(c);
  const [cv, s] = scratch('behind'); s.drawImage(frame, ...box); s.globalCompositeOperation = 'destination-in'; s.drawImage(matte, ...box);
  c.drawImage(cv, 0, 0);
}

// ---- HUD ----
const HUD = { per: 0.035, roll: 28, settle: 0.25 }; // glyphHud timing; scrambleCues reads the same numbers, so ticks can't drift from picture
// Glyph HUD word: mono cells scramble under 45° hatching with coordinate labels, then resolve left to right.
// Re-skin it with the brand's own objects instead of copying the reference's look: o.cell(c, x, top, w, h, i, lt) draws an
// unresolved cell in place of the hatching, o.label(i, x, y, lt) returns its label text in place of `x: y:`.
function glyphHud(c, str, x, y, t, o = {}) {
  const { size = 140 * S, color = '#ffffff', ground = '#000000', hatch = 13 * S, seed = 5, labels = true } = o, { per, roll, settle } = { ...HUD, ...o };
  const font = o.font || TYPE.mono, cw = tw(c, 'M', size, 500, font, 0), AZ = 'abcdefghijklmnopqrstuvwxyz0123456789_/:';
  const x0 = o.align === 'center' ? x - (cw * str.length) / 2 : o.align === 'right' ? x - cw * str.length : x;
  [...str].forEach((ch, i) => {
    const gx = x0 + i * cw, lt = t - i * per; if (lt < 0 || ch === ' ') return;
    const done = lt > settle, g = done ? ch : AZ[Math.floor(rng(seed + i * 31 + Math.floor(lt * roll))() * AZ.length)];
    if (!done) {
      if (o.cell) { c.save(); o.cell(c, gx, y - size * 0.82, cw, size * 1.02, i, lt); c.restore(); }
      else {
        c.save(); c.beginPath(); c.rect(gx, y - size * 0.82, cw, size * 1.02); c.clip(); c.strokeStyle = color; c.lineWidth = 1.6 * S; c.beginPath();
        for (let k = -size; k < cw + size; k += hatch) { c.moveTo(gx + k, y + size * 0.2); c.lineTo(gx + k + size * 1.02, y - size * 0.82); }
        c.stroke(); c.restore();
      }
      if (labels) ui(c, o.label ? o.label(i, gx, y, lt) : `x: ${Math.round(gx / S)} y: ${Math.round(y / S)}`, gx, i % 2 ? y + size * 0.2 + 22 * S : y - size * 0.82 - 10 * S, { size: 15 * S, font: TYPE.mono, track: 0, color });
    }
    word(c, g, gx, y, { size, font, track: 0, weight: 500, color: done ? color : ground });
  });
}
// Tracker hairlines: a reticle on each point, crosshair lines out to the frame edges, a mono coordinate label. pts = [[x, y]].
function trackers(c, pts, p = 1, o = {}) {
  if (p <= 0) return; const { color = '#ffffff', box = 28 * S, line = 0.3, labels = true } = o, e = ease.out(clamp(p)), b = box / 2;
  c.save(); c.strokeStyle = color; c.lineWidth = Math.max(1, S); const A = c.globalAlpha;
  for (const [px, py] of pts) {
    const X = Math.round(px) + 0.5, Y = Math.round(py) + 0.5;
    c.globalAlpha = A * line; c.beginPath(); c.moveTo(X - b - W * e, Y); c.lineTo(X - b, Y); c.moveTo(X + b, Y); c.lineTo(X + b + W * e, Y);
    c.moveTo(X, Y - b - H * e); c.lineTo(X, Y - b); c.moveTo(X, Y + b); c.lineTo(X, Y + b + H * e); c.stroke();
    c.globalAlpha = A; c.strokeRect(X - b * e, Y - b * e, box * e, box * e);
    if (labels) ui(c, `x: ${Math.round(px / S)} y: ${Math.round(py / S)}`, X + b + 8 * S, Y - b - 6 * S, { size: 15 * S, font: TYPE.mono, track: 0, color, alpha: prog(e, 0.5, 1) });
  }
  c.restore();
}
// Corner ticks: four L-marks framing a box, so small type can sit in big space. p draws them in.
function cornerTicks(c, x, y, w, h, o = {}) {
  const { len = 24 * S, lw = 2 * S, color = '#ffffff', p = 1 } = o, l = len * ease.out(clamp(p)); if (l <= 0) return;
  c.save(); c.strokeStyle = color; c.lineWidth = lw; c.beginPath();
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { c.moveTo(cx + sx * l, cy); c.lineTo(cx, cy); c.lineTo(cx, cy + sy * l); }
  c.stroke(); c.restore();
}
// Phosphor draw-on: a wide soft glow pass plus a white-hot core, drawn along polylines to fraction p (reuses polyPart).
function drawOn(c, lines, p, o = {}) {
  if (p <= 0) return; const { color = '#BFBFBF', core = '#ffffff', lw = 8 * S, coreW = 2.5 * S, blur = 6 * S, alpha = 0.35 } = o, all = typeof lines[0][0] === 'number' ? [lines] : lines;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  c.globalAlpha *= alpha; c.filter = `blur(${blur}px)`; c.strokeStyle = color; c.lineWidth = lw; all.forEach(l => polyPart(c, l, p));
  c.globalAlpha /= alpha; c.filter = 'none'; c.strokeStyle = core; c.lineWidth = coreW; all.forEach(l => polyPart(c, l, p));
  c.restore();
}
// Colour bars with dark scanlines: a CRT backdrop. colors run top to bottom; p wipes them in from the left.
function rainbowBars(c, x, y, w, h, o = {}) {
  const { colors = ['#F2F2F2', '#D9D9D9', '#BFBFBF', '#A6A6A6', '#8C8C8C', '#737373', '#595959', '#404040'], p = 1, scan = 4 * S, lineW = 1.5 * S, dark = 'rgba(0,0,0,0.35)' } = o, bh = h / colors.length;
  c.save(); c.beginPath(); c.rect(x, y, w * ease.inOut(clamp(p)), h); c.clip();
  colors.forEach((col, i) => { c.fillStyle = col; c.fillRect(x, y + i * bh, w, bh + 0.5); });
  c.fillStyle = dark; for (let yy = y; yy < y + h; yy += scan) c.fillRect(x, yy, w, lineW);
  c.restore();
}
// Starburst: seeded light rays from a point (the head of a wipe beam, an impact). p grows them, then they fade.
function starburst(c, x, y, r, o = {}) {
  const { n = 20, color = '#ffffff', seed = 3, p = 1, width = 0.035, spin = 0 } = o, a = Math.sin(Math.PI * clamp(p) * 0.999 + 0.0005), rr = rng(seed), R = r * ease.out(clamp(p * 1.6));
  if (a <= 0 || R <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= a; c.translate(x, y); c.rotate(spin); c.beginPath();
  for (let i = 0; i < n; i++) { // spikes: wide at the centre, tapering to a point
    const ang = (i / n) * Math.PI * 2 + rr() * 0.25, len = R * (0.35 + rr() * 0.65), b = len * width * (0.5 + rr()), px = -Math.sin(ang) * b, py = Math.cos(ang) * b;
    c.moveTo(px, py); c.lineTo(Math.cos(ang) * len, Math.sin(ang) * len); c.lineTo(-px, -py); c.closePath(); }
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, color); g.addColorStop(0.2, color + 'CC'); g.addColorStop(1, color + '00'); c.fillStyle = g; c.fill(); c.restore();
}
// Heart monitor: a P-QRS-T beat at bpm, swept left to right with a bright head and a fading trail. (x, y) = left end of the baseline.
const ecgAt = u => 0.12 * Math.exp(-(((u - 0.18) / 0.03) ** 2)) - 0.12 * Math.exp(-(((u - 0.3) / 0.008) ** 2)) + Math.exp(-(((u - 0.33) / 0.011) ** 2)) - 0.28 * Math.exp(-(((u - 0.36) / 0.01) ** 2)) + 0.24 * Math.exp(-(((u - 0.55) / 0.05) ** 2));
function ecg(c, x, y, w, h, t, o = {}) {
  const { bpm = 72, color = '#ffffff', lw = 3 * S, span = 3, n = 240 } = o, head = ((t / span) % 1) * w, beat = 60 / bpm;
  c.save(); c.strokeStyle = color; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'round'; const A = c.globalAlpha;
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const xx = (i / n) * w, age = (((head - xx) % w) + w) % w / w * span, tt = t - age, v = tt < 0 ? 0 : ecgAt(((tt % beat) + beat) % beat / beat), pt = [x + xx, y - v * h];
    if (prev && age < span * 0.92) { c.globalAlpha = A * (1 - age / span); c.beginPath(); c.moveTo(...prev); c.lineTo(...pt); c.stroke(); }
    prev = pt;
  }
  const at = u => ecgAt(((u % beat) + beat) % beat / beat), k = Math.floor((head / w) * n), hp = [x + head, y - at(t) * h], kt = t - ((head - (k / n) * w) / w) * span;
  c.globalAlpha = A; c.fillStyle = color; c.beginPath(); c.moveTo(x + (k / n) * w, y - (kt < 0 ? 0 : at(kt)) * h); c.lineTo(...hp); c.stroke(); // join the last sample to the head
  c.beginPath(); c.arc(...hp, lw * 1.6, 0, 7); c.fill();
  c.restore();
}
// Voice waveform bars, mirrored about the centre line y. level 0..1 scales them (0 = a flat row of dots).
function waveBars(c, x, y, w, h, t, o = {}) {
  const { n = 48, gap = 0.4, color = '#ffffff', level = 1, seed = 2 } = o, rr = rng(seed), bw = w / n, ww = bw * (1 - gap);
  c.save(); c.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const f1 = 2 + rr() * 4, f2 = 7 + rr() * 9, ph = rr() * 6.28, env = Math.sin((Math.PI * (i + 0.5)) / n) ** 0.6;
    const bh = Math.max(ww, h * level * env * (0.2 + 0.8 * Math.abs(0.6 * Math.sin(t * f1 + ph) + 0.4 * Math.sin(t * f2 + ph * 2))));
    rrect(c, x + i * bw + (bw - ww) / 2, y - bh / 2, ww, bh, ww / 2); c.fill();
  }
  c.restore();
}

// ---- fields / lists ----
// Square-dot field on a grid with 4 opacity tiers. fn(i, j, t) returns a level 0..4 per cell (bloom, a hole for text, spreads on beats).
const TIERS = [0, 0.15, 0.35, 0.6, 1];
function pixelField(c, fn, t, o = {}) {
  const { pitch = 42 * S, size = 0.62, color = '#ffffff', x0 = 0, y0 = 0, w = W, h = H } = o, s = pitch * size;
  c.save(); c.fillStyle = color; const A = c.globalAlpha;
  for (let j = 0; j < Math.ceil(h / pitch); j++) for (let i = 0; i < Math.ceil(w / pitch); i++) {
    const l = fn(i, j, t) | 0; if (l <= 0) continue;
    c.globalAlpha = A * TIERS[Math.min(4, l)]; c.fillRect(x0 + i * pitch + (pitch - s) / 2, y0 + j * pitch + (pitch - s) / 2, s, s);
  }
  c.restore();
}
// Slot list: the item at `pos` sits centred, neighbours fade (o.fade per row) and blur away. items = array (wraps) or i => string.
// pos may be fractional: slotStep(t) gives the stepping feature roll; a raw number gives a rolling counter (see counterRoll).
// o.side = 1 shows only upcoming items (-1 only previous); a negative lh stacks upcoming items above.
function slotList(c, items, x, y, pos, o = {}) {
  const { lh = 64 * S, size = 54 * S, color = '#111111', fade = [1, 0.45, 0.15], blur = 1.5 * S, side = 0 } = o, k = Math.floor(pos), fr = pos - k;
  const get = i => (typeof items === 'function' ? items(i) : items[((i % items.length) + items.length) % items.length]);
  for (let d = -fade.length; d <= fade.length; d++) {
    const off = d - fr, dd = Math.abs(off), f = Math.floor(dd);
    let a = lerp(fade[f] ?? 0, fade[f + 1] ?? 0, dd - f); if (side && off * side < 0) a *= clamp(1 - dd * 2);
    if (a < 0.01) continue;
    c.save(); if (blur && dd > 0.5) c.filter = `blur(${dd * blur}px)`; word(c, String(get(k + d)), x, y + off * lh, { weight: 500, ...o, size, color, alpha: a }); c.restore();
  }
}
const slotStep = (t, step = 0.27, move = 0.35) => { const f = t / step, k = Math.floor(f); return k + ease.inOut(clamp((f - k) / move)); };
// Rolling counter: the value with the next two stacked above it, fading (v, v+1, v+2 at 1, .4, .15). fmt formats each integer.
const counterRoll = (c, v, x, y, o = {}) => slotList(c, i => (o.fmt || String)(i), x, y, v, { side: 1, fade: [1, 0.4, 0.15], ...o, lh: -(o.lh || 64 * S) });
// Card deck that fans out into a vortex of tumbling tiles (scaleX = |cos|, back face when cos < 0). p: 0 = stacked deck, 1 = vortex.
// draw(c, i, w, h) paints tile i's face centred on 0,0 (omit for plain tiles).
function tumbleTiles(c, n, x, y, p, t, o = {}) {
  const { w = 150 * S, h = 200 * S, R = 520 * S, face = '#ffffff', back = '#BDBDBD', edge = 'rgba(0,0,0,0.18)', seed = 9, spin = 0.5, draw } = o, rr = rng(seed), e = ease.inOut(clamp(p));
  const tiles = Array.from({ length: n }, (_, i) => {
    const a0 = rr() * 6.28, r0 = (0.3 + rr() * 0.7) * R, fl = rr() * 6.28, fs = 1.5 + rr() * 2.5, tilt = (rr() - 0.5) * 1.2, ang = a0 + t * spin;
    return { i, x: x + Math.cos(ang) * r0 * e, y: y + Math.sin(ang) * r0 * 0.55 * e - (i - n / 2) * 1.5 * S * (1 - e), s: lerp(1, 0.75 + 0.22 * Math.sin(ang), e), z: Math.sin(ang) * e + i * 1e-3,
      flip: Math.cos(fl * e + t * fs * e), rot: lerp((i - n / 2) * 0.03, tilt, e) };
  });
  for (const tl of tiles.sort((a, b) => a.z - b.z)) {
    c.save(); c.translate(tl.x, tl.y); c.rotate(tl.rot); c.scale(Math.max(0.02, Math.abs(tl.flip)) * tl.s, tl.s);
    rrect(c, -w / 2, -h / 2, w, h, 12 * S); c.fillStyle = tl.flip >= 0 ? face : back; c.fill(); c.strokeStyle = edge; c.lineWidth = 1.5 * S; c.stroke();
    if (tl.flip >= 0 && draw) draw(c, tl.i, w, h);
    c.restore();
  }
}
// Picture as ASCII: any image or canvas sampled into cols × rows of luminance, one glyph per cell from `ramp` (dark -> bright).
// ramp '01' with alpha: true gives the 0/1 portrait. o.p reveals cells in a seeded order.
function asciiImage(c, src, x, y, w, h, o = {}) {
  const { cols = 64, rows = 48, ramp = ' .:-=+*#%@', color = '#ffffff', font = TYPE.mono, alpha = false, p = 1, seed = 3 } = o, cw = w / cols, ch = h / rows;
  const [, s] = scratch('ascii', cols, rows); s.drawImage(src, 0, 0, cols, rows); const d = s.getImageData(0, 0, cols, rows).data, r = rng(seed);
  c.save(); c.font = `500 ${o.size || ch * 1.05}px "${font}"`; c.letterSpacing = '0px'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; const A = c.globalAlpha;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const k = (j * cols + i) * 4, v = ((d[k] * 54 + d[k + 1] * 183 + d[k + 2] * 19) / 65280) * (d[k + 3] / 255), g = ramp[Math.min(ramp.length - 1, Math.floor(v * ramp.length))];
    if (r() >= p || g === ' ' || (alpha && v < 0.04)) continue;
    c.globalAlpha = alpha ? A * v : A; c.fillText(g, x + (i + 0.5) * cw, y + (j + 0.5) * ch);
  }
  c.restore();
}
// Numbered annotation pins popping in one after another (with optional labels). pts = [[x, y]]. Returns how many are in.
function pins(c, pts, t, o = {}) {
  const { gap = 0.18, r = 22 * S, fill = '#ffffff', ink = '#000000', stem = 18 * S, labels = [] } = o; let n = 0;
  pts.forEach(([px, py], i) => {
    const p = ease.back(clamp((t - i * gap) / 0.3)); if (p <= 0) return; n++;
    c.save(); c.translate(px, py); c.scale(p, p); c.fillStyle = fill; c.fillRect(-S, -stem, 2 * S, stem); c.beginPath(); c.arc(0, -stem - r, r, 0, 7); c.arc(0, 0, 3 * S, 0, 7); c.fill();
    word(c, String(i + 1), 0, -stem - r + r * 0.36, { size: r, weight: 600, font: TYPE.ui, track: 0, color: ink, align: 'center' }); c.restore();
    if (labels[i]) ui(c, labels[i], px + r * 1.5, py - stem - r + 9 * S, { color: fill, alpha: clamp(p) });
  });
  return n;
}
// Exponential live counter (time passing, scale growing): v0 -> v1 on a log scale (v0 > 0). expCount formats with MILLION / BILLION.
const expLerp = (v0, v1, p, g = 1) => v0 * (v1 / v0) ** (clamp(p) ** g);
const bigNum = v => (v >= 1e9 ? (v / 1e9).toFixed(1) + ' BILLION' : v >= 1e6 ? (v / 1e6).toFixed(1) + ' MILLION' : Math.round(v).toLocaleString('en-US'));
const expCount = (p, v0, v1, g = 1) => bigNum(expLerp(v0, v1, p, g));

// ---- line / paper ----
// Tapered comet hairline: the head at distance `head` px along a polyline, the tail `len` px behind thinning to nothing.
function pen(c, pts, head, o = {}) {
  const { len = W * 0.25, lw = 3 * S, color = '#000000', n = 48, dot = lw * 1.3 } = o;
  c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineCap = 'butt'; const A = c.globalAlpha;
  let prev = polyAt(pts, head - len);
  for (let i = 1; i <= n; i++) { const f = i / n, q = polyAt(pts, head - len + len * f); c.globalAlpha = A * f; c.lineWidth = lw * f; c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(q[0], q[1]); c.stroke(); prev = q; }
  if (dot) { c.globalAlpha = A; c.beginPath(); c.arc(prev[0], prev[1], dot, 0, 7); c.fill(); }
  c.restore();
}
// Echo smear: n copies of a drawing trailing behind it along (dx, dy), fading (swaps, fast moves). fn(c, ox, oy) draws one copy.
// even: true makes n equal copies centred on the position, summed so it stays opaque (true motion blur; whip uses it).
function smear(c, fn, dx, dy, o = {}) {
  const { n = 8, alpha = 0.6, even = false } = o;
  if (!even) { for (let k = n - 1; k >= 1; k--) { c.save(); c.globalAlpha *= alpha * (1 - k / n); fn(c, (-dx * k) / (n - 1), (-dy * k) / (n - 1)); c.restore(); } return fn(c, 0, 0); }
  const [cv, s] = scratch('smear'); s.setTransform(c.getTransform()); s.globalCompositeOperation = 'lighter'; s.globalAlpha = 1 / n;
  for (let k = 0; k < n; k++) fn(s, dx * (k / (n - 1) - 0.5), dy * (k / (n - 1) - 0.5));
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(cv, 0, 0); c.restore();
}
// Onion skin: the same moving thing drawn at earlier times, fading (ghosts behind a rider, a spark). fn(c, t) draws it at time t.
function onion(c, fn, t, o = {}) {
  const { n = 5, dt = 0.06, alpha = 0.5 } = o;
  for (let k = n; k >= 1; k--) { c.save(); c.globalAlpha *= alpha * (1 - k / (n + 1)); fn(c, t - k * dt); c.restore(); }
  fn(c, t);
}
// Torn paper slip with a quote, flying from `from` to `to` on an arc: scale 0.55 -> 1, blurred mid-flight, shadow lifting then landing.
// p = flight progress (0.45 s in the reference; stagger by distance at 0.04 s). lines = string or array of strings.
function slip(c, lines, from, to, p, o = {}) {
  const { w = 440 * S, h = 120 * S, paper = '#F4F2EC', ink = '#222222', size = 28 * S, seed = 4, arc = 0.3 } = o, e = ease.inOut(clamp(p)), lift = Math.sin(Math.PI * e), r = rng(seed);
  const rot = o.rot ?? (r() - 0.5) * 0.08, [x, y] = qbez(from, [(from[0] + to[0]) / 2, Math.min(from[1], to[1]) - Math.hypot(to[0] - from[0], to[1] - from[1]) * arc], to, e), sc = lerp(0.55, 1, e);
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(sc, sc); if (lift > 0.05) c.filter = `blur(${lift * 2.5 * S}px)`;
  c.shadowColor = 'rgba(0,0,0,0.22)'; c.shadowBlur = (6 + lift * 30) * S; c.shadowOffsetY = (2 + lift * 22) * S;
  c.beginPath(); const teeth = Math.round(w / (14 * S));
  for (let i = 0; i <= teeth; i++) c.lineTo(-w / 2 + (w * i) / teeth, -h / 2 + (r() - 0.5) * 6 * S);
  for (let i = teeth; i >= 0; i--) c.lineTo(-w / 2 + (w * i) / teeth, h / 2 + (r() - 0.5) * 6 * S);
  c.closePath(); c.fillStyle = paper; c.fill(); c.shadowColor = 'transparent';
  const ls = [].concat(lines); ls.forEach((s, i) => ui(c, s, -w / 2 + size * 0.9, (i - (ls.length - 1) / 2) * size * 1.3 + size * 0.36, { size, color: ink, weight: 500 }));
  c.restore();
}
// Washi tape: a translucent strip with zigzag ends and 45° stripes, multiplied onto what it holds down. (x, y) = centre.
function tape(c, x, y, w, h, o = {}) {
  const { color = '#D6D2C8', rot = 0, alpha = 0.9, stripe = 0.18, teeth = 6 } = o, z = h / teeth;
  c.save(); c.translate(x, y); c.rotate(rot); c.globalCompositeOperation = 'multiply'; c.globalAlpha *= alpha; c.beginPath();
  for (let i = 0; i <= teeth; i++) c.lineTo(w / 2 - (i % 2) * z * 0.7, -h / 2 + i * z);
  for (let i = teeth; i >= 0; i--) c.lineTo(-w / 2 + (i % 2) * z * 0.7, -h / 2 + i * z);
  c.closePath(); c.fillStyle = color; c.fill(); c.clip();
  c.globalAlpha *= stripe; c.strokeStyle = '#000000'; c.lineWidth = h * 0.12; c.beginPath();
  for (let k = -w / 2 - h; k < w / 2 + h; k += h * 0.4) { c.moveTo(k, h / 2); c.lineTo(k + h, -h / 2); }
  c.stroke(); c.restore();
}
// Callout attached to an object: a dot on the anchor, a 45° elbow leader, then a label. Tick a number in the label for a live count.
function callout(c, ax, ay, lx, ly, label, p, o = {}) {
  const { color = '#ffffff', size = 26 * S, dot = 5 * S, lw = 1.5 * S } = o, e = ease.out(clamp(p)); if (e <= 0) return;
  const dir = Math.sign(lx - ax) || 1, ex = ax + dir * Math.min(Math.abs(ly - ay), Math.abs(lx - ax));
  c.save(); c.strokeStyle = color; c.fillStyle = color; c.lineWidth = lw; c.beginPath(); c.arc(ax, ay, dot * ease.back(clamp(p * 3)), 0, 7); c.fill();
  polyPart(c, [[ax, ay], [ex, ly], [lx, ly]], prog(p, 0.1, 0.7)); c.restore();
  ui(c, label, lx + dir * 10 * S, ly + size * 0.35, { size, color, align: dir > 0 ? 'left' : 'right', alpha: prog(p, 0.6, 1) });
}

// ---- containers / transitions ----
// Player frame that hosts content on a desk: rounded window, content clipped inside, a scrub bar with a playhead, comment pins.
// fn(c, x, y, w, h) draws the content. o.time 0..1 = playhead; o.marks = [0..1] pins on the bar; o.label = filename above.
function player(c, x, y, w, h, fn, o = {}) {
  const { r = 18 * S, frame = '#161616', ink = '#ffffff', bar = 56 * S, time = 0, marks = [], label = '', accent = ink } = o, pad = 26 * S, by = y + h + bar / 2;
  c.save(); c.shadowColor = 'rgba(0,0,0,0.28)'; c.shadowBlur = 50 * S; c.shadowOffsetY = 18 * S; rrect(c, x, y, w, h + bar, r); c.fillStyle = frame; c.fill(); c.restore();
  c.save(); rrect(c, x, y, w, h, [r, r, 0, 0]); c.clip(); fn(c, x, y, w, h); c.restore();
  c.save(); c.fillStyle = ink; c.globalAlpha *= 0.25; c.fillRect(x + pad, by - 2 * S, w - pad * 2, 4 * S); c.globalAlpha *= 4; c.fillStyle = accent; c.fillRect(x + pad, by - 2 * S, (w - pad * 2) * clamp(time), 4 * S);
  marks.forEach(m => { c.beginPath(); c.arc(x + pad + (w - pad * 2) * m, by - 14 * S, 5 * S, 0, 7); c.fill(); });
  c.beginPath(); c.arc(x + pad + (w - pad * 2) * clamp(time), by, 8 * S, 0, 7); c.fillStyle = ink; c.fill(); c.restore();
  if (label) ui(c, label, x, y - 16 * S, { size: 20 * S, font: TYPE.mono, track: 0, color: o.labelColor || ink });
}
// Slit reveal: the next shot opens through a band growing from the centre line, edges lit. fn(c) draws the next shot.
function slitReveal(c, p, fn, o = {}) {
  const { line = '#ffffff', lw = 2 * S, vertical = false, cx = W / 2, cy = H / 2 } = o, e = ease.inOut(clamp(p)); if (p <= 0) return;
  const r = vertical ? [cx - (W * e) / 2, 0, W * e, H] : [0, cy - (H * e) / 2, W, H * e];
  c.save(); c.beginPath(); c.rect(...r); c.clip(); fn(c); c.restore();
  if (line && e < 1) { c.save(); c.globalAlpha *= 1 - e; c.fillStyle = line; vertical ? (c.fillRect(r[0] - lw / 2, 0, lw, H), c.fillRect(r[0] + r[2] - lw / 2, 0, lw, H)) : (c.fillRect(0, r[1] - lw / 2, W, lw), c.fillRect(0, r[1] + r[3] - lw / 2, W, lw)); c.restore(); }
}
// Shape-match morph: one rounded box becomes another about their centres (card -> dot -> button -> screen). a/b = { x, y, w, h, r }.
function morphMatch(c, a, b, p, o = {}) {
  const { color = '#ffffff', stroke, lw = 2 * S } = o, e = (o.ease || ease.inOut)(clamp(p)), w = lerp(a.w, b.w, e), h = lerp(a.h, b.h, e);
  const x = lerp(a.x + a.w / 2, b.x + b.w / 2, e) - w / 2, y = lerp(a.y + a.h / 2, b.y + b.h / 2, e) - h / 2, r = Math.min(lerp(a.r || 0, b.r || 0, e), w / 2, h / 2);
  rrect(c, x, y, w, h, r); if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } else { c.fillStyle = color; c.fill(); }
  return { x, y, w, h, r };
}
// Shutter into a button: bars close over box (first `split` of p, ~0.4 s), then the closed block morphs into a labelled button.
function shutterButton(c, box, btn, p, o = {}) {
  const { color = '#2A2A2A', ink = '#ffffff', label = 'Export', bars = 6, size = 30 * S, split = 0.57 } = o, a = clamp(p / split), b = clamp((p - split) / (1 - split)), bh = box.h / bars;
  if (p <= 0) return;
  if (b <= 0) { c.fillStyle = color; for (let i = 0; i < bars; i++) c.fillRect(box.x, box.y + i * bh, box.w, bh * ease.inOut(clamp(a * 1.6 - (i / bars) * 0.6)) + 0.5); return; }
  const m = morphMatch(c, { ...box, r: 0 }, btn, b, { color, ease: ease.out });
  if (b > 0.6) word(c, label, m.x + m.w / 2, m.y + m.h / 2 + size * 0.36, { size, weight: 600, font: TYPE.ui, track: -0.01, color: ink, align: 'center', alpha: prog(b, 0.6, 1) });
}
// Spark hopping between points on arcs with a comet tail (an agent visiting data sources). hop + rest seconds per jump.
// Returns { i, u, x, y }: the hop index, its progress and the head, so tiles can light up as it lands.
function sparkHop(c, pts, t, o = {}) {
  if (t < 0 || pts.length < 2) return; const { hop = 0.45, rest = 0.15, height = 0.35, color = '#ffffff', lw = 3 * S, r = 6 * S, len = 240 * S, halo = 0.5 } = o;
  const i = Math.min(pts.length - 2, Math.floor(t / (hop + rest))), u = clamp((t - i * (hop + rest)) / hop), e = ease.inOut(u);
  const arcPts = (a, b) => { const k = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - Math.hypot(b[0] - a[0], b[1] - a[1]) * height]; return Array.from({ length: 25 }, (_, j) => qbez(a, k, b, j / 24)); };
  const prev = i > 0 ? arcPts(pts[i - 1], pts[i]) : [], cur = arcPts(pts[i], pts[i + 1]), head = polyLen(prev) + polyLen(cur) * e, [x, y] = polyAt([...prev, ...cur.slice(prev.length ? 1 : 0)], head);
  pen(c, [...prev, ...cur.slice(prev.length ? 1 : 0)], head, { len: len * Math.sin(Math.PI * u), lw, color, dot: 0 });
  if (halo) glow(c, x, y, r * 6, color, halo, 'source-over');
  c.save(); c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.restore();
  return { i, u, x, y };
}
// Skeleton flash: boxes appear as outlines, flash to solid placeholder blocks, then fade as real content arrives.
// Returns each box's content progress 0..1, so you draw the charts with it.
function skeletonFlash(c, boxes, p, o = {}) {
  const { line = 'rgba(128,128,128,0.7)', block = 'rgba(128,128,128,0.28)', r = 12 * S, lw = 1.5 * S, gap = 0.05 } = o, span = 1 - gap * Math.max(0, boxes.length - 1);
  return boxes.map((b, i) => {
    const q = clamp((p - i * gap) / span), out = 1 - prog(q, 0.65, 1);
    c.save(); rrect(c, b.x, b.y, b.w, b.h, r); const A = c.globalAlpha;
    c.globalAlpha = A * prog(q, 0, 0.12) * out; c.strokeStyle = line; c.lineWidth = lw; c.stroke();
    c.globalAlpha = A * prog(q, 0.3, 0.36) * out; c.fillStyle = block; c.fill(); c.restore();
    return prog(q, 0.55, 1);
  });
}
// Click feedback: a grey disc that swells and fades under the pointer tip. t = seconds since the click.
function clickDisc(c, x, y, t, o = {}) {
  const { r = 30 * S, color = 'rgba(128,128,128,0.45)', dur = 0.35 } = o, q = t / dur; if (q < 0 || q > 1) return;
  c.save(); c.globalAlpha *= 1 - q; c.fillStyle = color; c.beginPath(); c.arc(x, y, r * (0.6 + 0.6 * ease.out(q)), 0, 7); c.fill(); c.restore();
}
// Screen insert (UGC): a search field types a query at cps, the pointer arcs to the button and clicks, result rows blur in 40 ms apart.
// (x, y, w) = panel top-left and width. Returns the times and the first result's box, to aim shotCam's push at it.
function screenInsert(c, x, y, w, t, o = {}) {
  const { query = 'search query', results = ['First result title', 'Second result title', 'Third result title'], cps = 12, size = 30 * S, ground = '#ffffff', ink = '#111111',
    mute = '#8A8A8A', line = '#DDDDDD', accent = '#2A2A2A', button = 'Search', from = [x + w * 0.4, y + 420 * S] } = o;
  const fh = size * 2.4, pad = size, rowH = size * 3.2, h = fh + pad * 3 + rowH * results.length, typedAt = query.length / cps, tMove = typedAt + 0.15, tClick = tMove + 0.4, tRes = tClick + 0.15;
  c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 50 * S; c.shadowOffsetY = 16 * S; rrect(c, x, y, w, h, 20 * S); c.fillStyle = ground; c.fill(); c.restore();
  const fx = x + pad, fy = y + pad, n = Math.floor(clamp(t * cps, 0, query.length)), shown = query.slice(0, n), tx = fx + size * 0.8, ty = fy + fh / 2 + size * 0.36;
  rrect(c, fx, fy, w - pad * 2, fh, fh / 2); c.strokeStyle = line; c.lineWidth = 2 * S; c.stroke();
  word(c, shown, tx, ty, { size, weight: 400, font: TYPE.ui, track: -0.01, color: ink });
  if (n < query.length || Math.floor(t * 2.5) % 2 === 0) { c.fillStyle = ink; c.fillRect(tx + tw(c, shown, size, 400, TYPE.ui, -0.01) + 3 * S, ty - size * 0.8, 2.5 * S, size); }
  const bw = tw(c, button, size * 0.8, 600, TYPE.ui, 0) + size * 1.4, bx = fx + w - pad * 2 - bw - 8 * S, by = fy + 8 * S, bh = fh - 16 * S, press = t >= tClick && t < tClick + 2 / 30 ? 0.94 : 1;
  c.save(); c.translate(bx + bw / 2, by + bh / 2); c.scale(press, press); rrect(c, -bw / 2, -bh / 2, bw, bh, bh / 2); c.fillStyle = accent; c.fill();
  word(c, button, 0, size * 0.29, { size: size * 0.8, weight: 600, font: TYPE.ui, track: 0, color: ground, align: 'center' }); c.restore();
  results.forEach((r, i) => {
    const q = ease.out(clamp((t - tRes - i * 0.04) / 0.75)); if (q <= 0) return; const ry = fy + fh + pad * 1.5 + i * rowH;
    c.save(); c.globalAlpha *= q; if (q < 1) c.filter = `blur(${(1 - q) * 8 * S}px)`;
    word(c, r, fx + size * 0.4, ry + size, { size: size * 1.1, weight: 600, font: TYPE.ui, track: -0.01, color: ink });
    c.fillStyle = mute; c.globalAlpha *= 0.35; c.fillRect(fx + size * 0.4, ry + size * 1.7, (w - pad * 2) * (0.5 + 0.3 * rng(i + 7)()), size * 0.4); c.restore();
  });
  const target = [bx + bw * 0.55, by + bh * 0.6], cp = qbez(from, [lerp(from[0], target[0], 0.2), target[1] + 160 * S], target, ease.inOut(clamp((t - tMove) / 0.4)));
  clickDisc(c, ...target, t - tClick); pointer(c, cp[0], cp[1], t >= tClick && t < tClick + 2 / 30 ? 0.9 : 1, { fill: '#ffffff', stroke: ink });
  return { typedAt, tClick, tRes, first: { x: fx, y: fy + fh + pad * 1.5, w: w - pad * 2, h: rowH } };
}
// Footage camera that never sits still, applied through cam(). u = seconds since the shot started.
// z0/tau: zoom-settle on entry (1.25–1.5, 0.35–0.5 s); slide: lateral drift in W per s; kw: u when a keyword fires a pull-back from kwZ to 1;
// push: u when an accelerating push-in starts (pushZ over pushDur). ax/ay = anchor 0..1. Returns the zoom.
function shotCam(c, u, o = {}) {
  const { z0 = 1.3, tau = 0.4, ax = 0.5, ay = 0.5, slide = 0, kw, kwZ = 1.2, kwDur = 2.8, push, pushZ = 0.4, pushDur = 1 } = o;
  let z = 1 + (z0 - 1) * Math.exp(-Math.max(0, u) / tau);
  if (kw != null) z *= lerp(kwZ, 1, ease.inOut(clamp((u - kw) / kwDur)));
  if (push != null) z *= 1 + pushZ * ease.in(clamp((u - push) / pushDur));
  cam(c, z, ax * W, ay * H, -slide * W * u, 0); return z;
}
// Exposure flash on a cut: a full-frame overlay stepping down a per-frame table. whiteout ramps up INTO tCut + 6 frames; dip is 2 dark frames.
const FLASH = { exposure: [1, 0.75, 0.5, 0.3, 0.15, 0.05], whiteout: [0.15, 0.3, 0.5, 0.7, 0.85, 1], dip: [1, 1] };
function flash(c, t, tCut, o = {}) {
  const { table = FLASH.exposure, color = '#ffffff', fps = 24 } = o, k = Math.floor((t - tCut) * fps + 1e-6); if (k < 0 || k >= table.length) return;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha *= table[k]; c.fillStyle = color; c.fillRect(0, 0, W, H); c.restore();
}
// Glitch box: for a few frames the region's slices jump sideways and a channel copy splits off, then it snaps clean. Box in screen px.
// Call after drawing the region. tint is a channel colour (red split), not a palette colour; op 'lighten' suits dark grounds,
// on light grounds pass op: 'darken' with a cyan tint.
function glitchBox(c, x, y, w, h, t, o = {}) {
  const { frames = 4, fps = 24, split = 4 * S, tint = '#ff0000', op = 'lighten', seed = 7, min = 10 * S, max = 60 * S } = o, f = Math.floor(t * fps); if (t < 0 || f >= frames) return;
  const r = rng(seed * 131 + f), [cv, s] = scratch('glitch', Math.ceil(w), Math.ceil(h)), [tv, tx] = scratch('glitchTint', Math.ceil(w), Math.ceil(h));
  s.drawImage(c.canvas, x, y, w, h, 0, 0, w, h); tx.drawImage(cv, 0, 0); tx.globalCompositeOperation = 'multiply'; tx.fillStyle = tint; tx.fillRect(0, 0, w, h); // keeps darks dark, tints the bright content
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); const A = c.globalAlpha; c.globalCompositeOperation = op; c.globalAlpha = A * 0.8; c.drawImage(tv, x + split, y); c.globalCompositeOperation = 'source-over'; c.globalAlpha = A;
  for (let k = 0, n = 3 + Math.floor(r() * 3); k < n; k++) { const sy = r() * h * 0.9, sh = (0.04 + r() * 0.16) * h, dx = (r() < 0.5 ? -1 : 1) * lerp(min, max, r()); c.drawImage(cv, 0, sy, w, sh, x + dx, y + sy, w, sh); }
  c.restore();
}
// Soft cut: a 1–2 frame crossfade instead of a hard cut (keep hard cuts for drops and section starts). drawB must paint an opaque ground.
function softcut(c, t, tCut, drawA, drawB, o = {}) {
  const { frames = 2, fps = 30 } = o, p = clamp(((t - tCut) * fps + 1) / (frames + 1));
  if (p < 1) drawA(c); if (p > 0) { c.save(); c.globalAlpha *= p; drawB(c); c.restore(); }
}
// Whip pan across a wide world: drawWorld(c, ox) draws it shifted by ox; eased in-out with 8-copy motion blur peaking mid-move.
function whip(c, drawWorld, x0, x1, p, o = {}) {
  const e = ease.inOut(clamp(p)), ox = -lerp(x0, x1, e), v = Math.sin(Math.PI * clamp(p)) * Math.abs(x1 - x0) * (o.blur ?? 0.06);
  if (v < 1) return drawWorld(c, ox);
  smear(c, (cc, dx) => drawWorld(cc, ox + dx), v, 0, { n: o.n || 8, even: true });
}
// Synthetic depth of field: blur everything drawn so far except a sharp horizontal band at y (±band), then a soft vignette. Call last.
function dof(c, y = H / 2, band = 0.08 * H, o = {}) {
  const { blur = 7 * S, feather = 0.08 * H, vignette = 0.35 } = o, [cv, s] = scratch('dof'), [mv, m] = scratch('dofSharp'), top = y - band - feather, span = (band + feather) * 2;
  s.drawImage(c.canvas, 0, 0); m.drawImage(cv, 0, 0); m.globalCompositeOperation = 'destination-in';
  const g = m.createLinearGradient(0, top, 0, top + span); g.addColorStop(0, '#00000000'); g.addColorStop(feather / span, '#000000'); g.addColorStop(1 - feather / span, '#000000'); g.addColorStop(1, '#00000000');
  m.fillStyle = g; m.fillRect(0, 0, W, H);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.filter = `blur(${blur}px)`; c.drawImage(cv, 0, 0); c.filter = 'none'; c.drawImage(mv, 0, 0);
  if (vignette) { const v = c.createRadialGradient(W / 2, y, H * 0.3, W / 2, y, Math.hypot(W, H) * 0.6); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${vignette})`); c.fillStyle = v; c.fillRect(0, 0, W, H); }
  c.restore();
}

// ---- timing ----
// Sound from the picture's own constants, as sfx.py cues [t, name, gain, {params}]. Same numbers in, so sound can't drift.
// typeCues: a pitched thock per typed glyph, stepping df Hz per glyph. Pass the gap the picture types at (1 / cps).
const typeCues = (t0, str, gap = 0.105, f0 = 1300, df = 180, g = 1) => [...str].flatMap((ch, i) => (ch === ' ' ? [] : [[+(t0 + i * gap).toFixed(3), 'thock', g, { f: f0 + i * df }]]));
// scrambleCues: one tick burst (roll ticks/s) covering a glyphHud word from its first cell to its last settle.
const scrambleCues = (t0, str, g = 0.6, o = {}) => { const { per, roll, settle } = { ...HUD, ...o }; return [[+t0.toFixed(3), 'ticks', g, { n_ticks: Math.round((per * (str.length - 1) + settle) * roll), gap: +(1 / roll).toFixed(4) }]]; };
// Beat pulse from a BPM alone (lib.js pulse() needs a BEATS list): 1 + amt on every beat, decaying. Multiply a scale by it.
const bpmPulse = (t, bpm = 120, amt = 0.04, decay = 0.09) => { const b = 60 / bpm; return 1 + amt * Math.exp(-(((t % b) + b) % b) / decay); };
// Which shot is showing in a burst of very short shots. frames = per-shot lengths in frames, from montageFrames() or flipFrames().
function cutIndex(t, t0, frames, fps = 30) { let at = t0; for (let i = 0; i < frames.length; i++) { at += frames[i] / fps; if (t < at) return i; } return frames.length - 1; }
const montageFrames = (n, seed = 1, pool = [1, 1, 2, 2, 3]) => { const r = rng(seed); return Array.from({ length: n }, () => pool[Math.floor(r() * pool.length)]); }; // B&W flash montage (24 fps)
const flipFrames = (n, f0 = 3, f1 = 1) => Array.from({ length: n }, (_, i) => Math.round(f0 + ((f1 - f0) * i) / Math.max(1, n - 1))); // accelerating flip-book: 3,3,2…1
const MONTAGE = 'grayscale(1) contrast(1.3)'; // c.filter for flash-montage shots
// Paste-up collage: scrap k lands at t0 + k·step frames, no easing, at a seeded ±8° tilt. Returns the landed scraps for you to draw.
const pasted = (t, t0, n, o = {}) => { const { step = 3.5, fps = 30, tilt = 0.14, jitter = 0, seed = 99 } = o; return Array.from({ length: n }, (_, k) => k).filter(k => t >= t0 + (k * step) / fps).map(k => { const r = rng(seed + k * 7); return { k, rot: (r() - 0.5) * 2 * tilt, dx: (r() - 0.5) * jitter, dy: (r() - 0.5) * jitter }; }); };
// Reverse replay: maps t in [ts, ts + dur] to a source time running back from ts over `span` s, one frame per output frame. Then drawAt it.
const rewind = (t, ts, dur = 1, span = 3, fps = 30) => ts - (Math.floor(clamp((t - ts) / dur) * dur * fps) / (dur * fps)) * span;
// Draw every scene live at time tt (rewinds, flip-books of earlier shots). skip = the calling scene, so it doesn't recurse.
const drawAt = (c, tt, skip) => VIDEO.scenes.forEach(s => s !== skip && tt >= s.start && tt < s.end && (c.save(), s.draw(c, prog(tt, s.start, s.end), tt, s), c.restore()));
