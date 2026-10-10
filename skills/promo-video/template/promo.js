// SaaS-promo helpers on top of lib.js (bg text cover prog ease rng lerp clamp img W H).
// Every helper is a pure function of the values you pass in, so frames stay deterministic.

// Critically damped-ish spring: overshoots a touch, settles. Nicer than ease.out for UI entering.
const spring = (p, k = 8) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-k * p) * Math.cos(k * 0.9 * p));
// Stagger: progress of item i when items start `gap` seconds apart from t0 and each takes `dur`.
const stagger = (t, t0, i, gap = 0.06, dur = 0.5) => prog(t, t0 + i * gap, t0 + i * gap + dur);

function rrect(c, x, y, w, h, r = 16) { c.beginPath(); c.roundRect(x, y, w, h, r); }

// Glassy UI panel (dashboard card, modal, browser window).
function card(c, x, y, w, h, o = {}) {
  const { r = 20, fill = 'rgba(22,22,26,0.92)', border = 'rgba(255,255,255,0.08)', shadow = 'rgba(0,0,0,0.5)', blur = 60 } = o;
  c.save(); c.shadowColor = shadow; c.shadowBlur = blur; c.shadowOffsetY = blur / 3;
  rrect(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); c.restore();
  c.save(); rrect(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.strokeStyle = border; c.lineWidth = 1.5; c.stroke(); c.restore();
}

// Pill / button / badge. Returns its width so you can place things after it.
function pill(c, str, x, y, o = {}) {
  const { size = 28, font = 'Inter', weight = 600, color = '#fff', fill = '#111', border, padX = size * 0.8, h = size * 2, align = 'center', alpha = 1 } = o;
  c.save(); c.globalAlpha *= alpha; c.font = `${weight} ${size}px "${font}"`;
  const w = c.measureText(str).width + padX * 2, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  rrect(c, x0, y - h / 2, w, h, h / 2); c.fillStyle = fill; c.fill();
  if (border) { c.strokeStyle = border; c.lineWidth = 1.5; c.stroke(); }
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, x0 + w / 2, y + size * 0.04);
  c.restore(); return w;
}

// Typewriter with blinking caret. cps = characters per second, starting at t0.
function typewriter(c, str, t, t0, x, y, o = {}) {
  const { cps = 28, caret = '#ff5a1f', ...rest } = o;
  const n = Math.floor(clamp((t - t0) * cps, 0, str.length)), shown = str.slice(0, n);
  text(c, shown, x, y, { align: 'left', ...rest });
  c.save(); c.font = `${rest.weight || ''} ${rest.size || 120}px "${rest.font || 'Anton'}"`;
  const cw = c.measureText(shown).width; c.restore();
  if (Math.floor(t * 2.5) % 2 === 0 || n < str.length) { c.fillStyle = caret; c.fillRect(x + cw + 4, y - (rest.size || 120) * 0.45, Math.max(3, (rest.size || 120) * 0.06), (rest.size || 120) * 0.9); }
  return n === str.length;
}

// Odometer counter: each digit column rolls, the way real ones do (a digit turns over while the one below it wraps).
function counter(c, value, x, y, o = {}) {
  const { size = 120, font = 'Inter', weight = 700, color = '#fff', prefix = '', suffix = '', align = 'center', commas = true, mono = true } = o;
  const v = Math.max(0, value), digits = Math.max(1, Math.floor(v).toString().length);
  c.save(); c.font = `${weight} ${size}px "${font}"`; c.textBaseline = 'middle'; c.fillStyle = color;
  const dw = mono ? c.measureText('0').width : 0, cw = c.measureText(',').width, pw = c.measureText(prefix).width, sw = c.measureText(suffix).width;
  const cols = []; for (let k = digits - 1; k >= 0; k--) { cols.push(k); if (commas && k % 3 === 0 && k) cols.push(','); }
  const total = pw + sw + cols.reduce((s, k) => s + (k === ',' ? cw : dw), 0);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  c.textAlign = 'left'; c.fillText(prefix, cx, y); cx += pw;
  c.beginPath(); c.rect(cx - 4, y - size * 0.55, total + 8, size * 1.1); c.clip(); const gap = size * 1.2;
  // A digit rolls only while every digit below it is 9 and rolling over (so a resting integer never shows half-turned digits).
  const rolls = []; for (let k = 0; k < digits; k++) rolls[k] = k === 0 ? v % 1 : Math.floor(v / 10 ** (k - 1)) % 10 === 9 ? rolls[k - 1] : 0;
  for (const k of cols) {
    if (k === ',') { c.fillText(',', cx, y); cx += cw; continue; }
    const d = Math.floor(v / 10 ** k) % 10, roll = rolls[k];
    const dx = mono ? (dw - c.measureText(String(d)).width) / 2 : 0, dx2 = mono ? (dw - c.measureText(String((d + 1) % 10)).width) / 2 : 0; // centre each digit in its cell, like tabular figures
    c.fillText(String(d), cx + dx, y - roll * gap); if (roll > 0) c.fillText(String((d + 1) % 10), cx + dx2, y + (1 - roll) * gap);
    cx += dw;
  }
  c.restore(); c.save(); c.font = `${weight} ${size}px "${font}"`; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(suffix, cx, y); c.restore();
}

// Seeded "growth" series for charts: noisy but trending up.
function series(n = 60, seed = 3, trend = 1) {
  const r = rng(seed); let v = 0.2; return Array.from({ length: n }, (_, i) => (v = clamp(v + (r() - 0.45) * 0.08 + trend * 0.012, 0.02, 1)));
}
// Line chart that draws itself left→right as p goes 0→1, with gradient fill and a glowing head.
function lineChart(c, pts, x, y, w, h, p, o = {}) {
  const { color = '#3b82f6', width = 4, fillAlpha = 0.35 } = o;
  const n = Math.max(2, Math.floor(lerp(2, pts.length, clamp(p)))), P = pts.slice(0, n).map((v, i) => [x + (i / (pts.length - 1)) * w, y + h - v * h]);
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, color + Math.round(fillAlpha * 255).toString(16).padStart(2, '0')); g.addColorStop(1, color + '00');
  c.save(); c.beginPath(); c.moveTo(P[0][0], y + h); P.forEach(([px, py]) => c.lineTo(px, py)); c.lineTo(P.at(-1)[0], y + h); c.fillStyle = g; c.fill();
  c.beginPath(); P.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.strokeStyle = color; c.lineWidth = width; c.lineJoin = 'round'; c.stroke();
  const [hx, hy] = P.at(-1); glow(c, hx, hy, 40, color); c.beginPath(); c.arc(hx, hy, width * 1.6, 0, 7); c.fillStyle = '#fff'; c.fill();
  c.restore(); return [hx, hy];
}

// Soft radial glow / light leak.
function glow(c, x, y, r, color, alpha = 0.6, op = 'lighter') { // 'lighter' adds light on dark; pass 'source-over' on light backgrounds
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, color + '00');
  c.save(); c.globalAlpha *= alpha; c.globalCompositeOperation = op; c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); c.restore();
}

// Mesh-gradient background (the "Conversions." rainbow card). colors: 3–5 hex strings.
function mesh(c, colors, t = 0, seed = 1) {
  const r = rng(seed); bg(c, colors[0]);
  colors.slice(1).forEach((col, i) => { const a = r() * 6.28 + t * 0.4 * (i % 2 ? 1 : -1); glow(c, W / 2 + Math.cos(a) * W * 0.3, H / 2 + Math.sin(a) * H * 0.3, Math.max(W, H) * 0.6, col, 0.85, 'source-over'); });
}

// Whole-frame transitions. Call with progress p of the transition; draw the next scene after (or before) as needed.
function wipe(c, p, color, dir = 1) { c.save(); c.fillStyle = color; const x = dir > 0 ? -W + ease.inOut(p) * 2 * W : W - ease.inOut(p) * 2 * W; c.fillRect(x, 0, W, H); c.restore(); }
function withBlur(c, px, fn) { c.save(); c.filter = `blur(${px}px)`; fn(); c.restore(); } // motion-blur entrances: blur 20→0 while sliding in
