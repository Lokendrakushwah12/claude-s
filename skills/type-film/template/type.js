// Swiss / editorial kinetic-type helpers. Sits on top of lib.js (bg text prog ease rng clamp lerp W H) and
// promo.js (spring stagger rrect pill card counter withBlur). Every helper is a pure function of what you pass in,
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
  const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.filter = 'none'; x.clearRect(0, 0, w, h); return [cv, x];
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
