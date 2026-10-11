// SaaS-promo helpers on top of lib.js (bg text cover prog ease rng lerp clamp img spring W H).
// Every helper is a pure function of the values you pass in, so frames stay deterministic.
// At the bottom: cursor choreography (cursorPath aimAt magnet drawCursor clickRing) and silky motion (fling velCut cutLadder pushInto depthLayer).
// spring lives in lib.js and takes both forms: spring(p) / spring(p, 8) is the 0..1 overshoot-a-touch ease for UI
// entering; spring(t, [[t0, v0], [t1, v1], ...]) is the closed-form spring in seconds through targets.

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

// ---- cursor choreography (measured 2026-10-11: #42 Wix, #45 ElevenLabs, #22 gojiberry, #43 tap ring) ----
// Beats [{ t, x, y, click, dwell, hold, grab, drop, out, bow, ease }]: the tip ARRIVES at (x, y) at t, leaving the previous beat
// after its hold, on ease.cursor (eases off the start, decays into the target, τ ≈ 0.2 s) along a slight arc (bow × distance).
// click: press dwell s after arriving (default 0.2), leave 0.25 s after it. grab … drop: the press stays down between them (a drag).
// out: fade over 0.16 s, hold s after arriving (a cursor that has done its job fades, #42). Returns t => pose; .clicks = press times.
function cursorPath(beats, o = {}) {
  const { bow = 0.06, dwell = 0.2 } = o, B = beats.map(b => ({ ...b, tc: b.click || b.grab || b.drop ? b.t + (b.dwell ?? dwell) : null }));
  B.forEach(b => (b.leave = b.tc != null ? b.tc + (b.hold ?? 0.25) : b.t + (b.hold ?? 0)));
  const at = t => {
    if (t <= B[0].t) return [B[0].x, B[0].y];
    for (let i = 1; i < B.length; i++) { const a = B[i - 1], b = B[i]; if (t >= b.t) continue;
      const L = Math.min(a.leave, b.t - 1e-3), u = clamp((t - L) / (b.t - L)), e = (b.ease || ease.cursor)(u), dx = b.x - a.x, dy = b.y - a.y, k = (b.bow ?? bow) * Math.sin(Math.PI * e);
      return [a.x + dx * e - dy * k, a.y + dy * e + dx * k]; }
    return [B.at(-1).x, B.at(-1).y];
  };
  const tcs = B.filter(b => b.tc != null), downs = B.map((b, i) => b.grab && [b.tc, (B.slice(i + 1).find(q => q.drop) || {}).tc ?? Infinity]).filter(Boolean);
  const press = t => Math.max(0, ...tcs.map(b => { const q = t - b.tc; return q < 0 ? 0 : q < 0.06 ? ease.out(q / 0.06) : 1 - ease.inOut(clamp((q - 0.06) / 0.12)); }),
    ...downs.map(([a, z]) => (t >= a && t < z ? clamp((t - a) / 0.06) : 0)));
  const f = t => { const [x, y] = at(t), [x1, y1] = at(t + 1 / 240), [x0, y0] = at(t - 1 / 240), vx = (x1 - x0) * 120, vy = (y1 - y0) * 120;
    const last = tcs.filter(b => b.tc <= t).at(-1), gone = B.filter(b => b.out).map(b => prog(t, b.leave, b.leave + 0.16));
    return { x, y, vx, vy, speed: Math.hypot(vx, vy), press: press(t), clickAge: last ? t - last.tc : Infinity, holding: downs.some(([a, z]) => t >= a && t < z), alpha: 1 - Math.max(0, ...gone) }; };
  f.clicks = tcs.map(b => b.tc); return f;
}
// Where the tip lands on a control: just inside its lower right, so the arrow's body doesn't cover the label (#42, #45).
const aimAt = (r, fx = 0.62, fy = 0.72) => [r.x + r.w * fx, r.y + r.h * fy];
// Hover magnetism: 0..1 as the tip nears a control (r px out → inside), and the tip pulled that much toward its aim point.
function magnet(pose, r, o = {}) {
  const { reach = 60 * S, pull = 0.3 } = o, dx = Math.max(r.x - pose.x, 0, pose.x - r.x - r.w), dy = Math.max(r.y - pose.y, 0, pose.y - r.y - r.h);
  const h = 1 - ease.inOut(clamp(Math.hypot(dx, dy) / reach)), [ax, ay] = aimAt(r); return [lerp(pose.x, ax, h * h * pull), lerp(pose.y, ay, h * h * pull), h];
}
// Draw the pointer from a pose: 'arrow' (black, white rim, soft shadow; ~5.5 % of H as measured, up to 11 % in push-ins) or 'touch' (a tap ring).
function drawCursor(c, pose, o = {}) {
  const { kind = 'arrow', size = 0.055 * H, fill = '#111111', rim = '#ffffff', shadow = 'rgba(0,0,0,0.28)' } = o; if (pose.alpha <= 0) return;
  c.save(); c.globalAlpha *= pose.alpha; c.translate(pose.x, pose.y);
  if (kind === 'touch') { c.restore(); return clickRing(c, pose.x, pose.y, pose.clickAge, { size, color: rim, alpha: pose.alpha }); }
  const s = size * (1 - 0.1 * pose.press); c.scale(s, s); c.beginPath();
  [[0, 0], [0, 0.8], [0.2, 0.63], [0.33, 0.93], [0.46, 0.87], [0.33, 0.58], [0.56, 0.58]].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath(); c.shadowColor = shadow; c.shadowBlur = 0.12 * s; c.shadowOffsetY = 0.04 * s; c.lineJoin = 'round'; c.lineWidth = 0.075;
  c.strokeStyle = rim; c.stroke(); c.shadowColor = 'transparent'; c.fillStyle = fill; c.fill(); c.restore();
}
// Click / tap ring from its age in s: a dot that opens to a ring in 0.13 s, then keeps growing and fades by 0.5 s (#43; #22's CTA).
function clickRing(c, x, y, age, o = {}) {
  const { size = 0.055 * H, color = '#ffffff', lw = 0.06, alpha = 1 } = o; if (!(age >= 0 && age < 0.5)) return;
  const r = size * (age < 0.13 ? lerp(0.08, 0.35, ease.out(age / 0.13)) : lerp(0.35, 1.1, ease.expoOut((age - 0.13) / 0.37)));
  c.save(); c.globalAlpha *= alpha * (1 - ease.in(clamp((age - 0.13) / 0.37))); c.strokeStyle = color; c.lineWidth = size * lw; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); c.restore();
}

// ---- silky motion and camera ----
// Inertial scroll after a flick at t0: offset → dist with momentum decay τ (a trackpad fling; 0 before t0).
const fling = (t, t0, dist, tau = 0.32) => (t < t0 ? 0 : dist * (1 - Math.exp(-(t - t0) / tau)));
// Velocity-matched cut (#32, #42): offset along the move for the shot on screen at t. The outgoing shot accelerates (expo, τin) and
// the incoming one starts at that same v px/s and decays (τout), so the eye's tracking never breaks. Translate the shot by it.
const velCut = (t, tCut, v, tauIn = 0.12, tauOut = 0.22) => (t < tCut ? v * tauIn * Math.exp((t - tCut) / tauIn) : -v * tauOut * Math.exp(-(t - tCut) / tauOut));
// Accelerando cut ladder (#33): n cut times from t0, each gap ratio × the last; then cut hard to the payoff and silence.
const cutLadder = (t0, n, first = 0.5, ratio = 0.75) => Array.from({ length: n }, (_, i) => t0 + (first * (1 - ratio ** i)) / (1 - ratio));
// Push through a rect until it IS the frame (screen as portal, #22): zoom in log space so the speed feels constant. Then draw the world.
function pushInto(c, p, r) {
  const k = Math.exp(lerp(0, Math.log(Math.max(W / r.w, H / r.h)), p)), cx = lerp(W / 2, r.x + r.w / 2, ease.out(Math.min(1, p * 1.5)));
  const cy = lerp(H / 2, r.y + r.h / 2, ease.out(Math.min(1, p * 1.5))); c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-cx, -cy); return k;
}
// A depth layer for floating UI (#22): z = 0 is the focus plane, + is farther. Parallax and scale from cam {x, y, z}; blur = |z| × dof px.
function depthLayer(c, cam, z, fn, o = {}) {
  const { dof = 14 * S } = o, k = 1 / Math.max(0.05, 1 + z - cam.z), b = Math.abs(z - (cam.focus ?? 0)) * dof;
  c.save(); c.translate(W / 2 - cam.x * k, H / 2 - cam.y * k); c.scale(k, k); c.translate(-W / 2, -H / 2); if (b > 0.3) c.filter = `blur(${b.toFixed(1)}px)`; fn(c, k); c.restore();
}
