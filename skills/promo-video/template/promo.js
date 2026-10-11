// SaaS-promo helpers on top of lib.js (bg text cover prog ease rng lerp clamp img spring W H) and type.js (S, iris, drawCloud).
// Every helper is a pure function of the values you pass in, so frames stay deterministic.
// Look (2026-10-11b): card ground headline hudFrame plane connector. At the bottom: cursor choreography (cursorPath aimAt
// magnet drawCursor clickRing) and silky motion (fling velCut cutLadder pushInto depthLayer).
// spring lives in lib.js and takes both forms: spring(p) / spring(p, 8) is the 0..1 overshoot-a-touch ease for UI
// entering; spring(t, [[t0, v0], [t1, v1], ...]) is the closed-form spring in seconds through targets.

// Stagger: progress of item i when items start `gap` seconds apart from t0 and each takes `dur`.
const stagger = (t, t0, i, gap = 0.06, dur = 0.5) => prog(t, t0 + i * gap, t0 + i * gap + dur);

function rrect(c, x, y, w, h, r = 16) { c.beginPath(); c.roundRect(x, y, w, h, r); }

// True for a dark colour ('#rrggbb' or 'rgb(a)(...)'): card and ground pick their light/dark defaults from it.
function darkCol(col) {
  const h = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(col), m = h ? h.slice(1).map(v => parseInt(v, 16)) : (col.match(/[\d.]+/g) || [255, 255, 255]).map(Number);
  return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] < 128;
}

// Product card (panel, modal, browser window, toast). Looks like real UI, not a slab: a wide soft shadow plus a tight contact
// shadow, a 1 px hairline, and on a dark fill a lit top edge. Measured on the 2026-10-11b UI promos (agonaliu, 0xfemyn): radius
// 16-20 px, ambient ~48 px blur 16 px down at 8-12 % on light grounds (45-55 % on dark), contact 2-3 px. lift 0..1 raises it
// (hover, pick-up). shadow takes a tint: a CTA in the brand colour casts that colour. Draw the fill opaque (it is filled twice).
function card(c, x, y, w, h, o = {}) {
  const dark = darkCol(o.fill || '#ffffff');
  const { r = 18 * S, fill = '#ffffff', border = dark ? 'rgba(255,255,255,0.09)' : 'rgba(17,17,24,0.09)', shadow = dark ? 'rgba(0,0,0,0.5)' : 'rgba(17,17,24,0.11)', blur = 48 * S, lift = 0 } = o;
  c.save(); rrect(c, x, y, w, h, r); c.fillStyle = fill;
  c.shadowColor = shadow; c.shadowBlur = blur * (1 + 0.6 * lift); c.shadowOffsetY = blur * (0.33 + 0.3 * lift); c.fill();
  c.shadowColor = dark ? 'rgba(0,0,0,0.4)' : 'rgba(17,17,24,0.08)'; c.shadowBlur = 3 * S; c.shadowOffsetY = 1 * S; c.fill(); c.restore();
  c.save(); rrect(c, x + 0.5, y + 0.5, w - 1, h - 1, r); c.strokeStyle = border; c.lineWidth = Math.max(1, S); c.stroke();
  if (dark) { const g = c.createLinearGradient(0, y, 0, y + Math.min(h, 60 * S)); g.addColorStop(0, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = g; c.stroke(); }
  c.restore();
}

// Pill / button / badge / chip. Returns its width so you can place things after it. dot: a status-dot colour before the label
// (the chips in 0xfemyn and agonaliu); shadow: a tinted drop shadow (a CTA casts its own colour, ~35 % alpha).
function pill(c, str, x, y, o = {}) {
  const { size = 28, font = 'Inter', weight = 600, color = '#fff', fill = '#111', border, padX = size * 0.8, h = size * 2, align = 'center', alpha = 1, dot, shadow } = o;
  c.save(); c.globalAlpha *= alpha; c.font = `${weight} ${size}px "${font}"`;
  const dw = dot ? size * 0.75 : 0, w = c.measureText(str).width + padX * 2 + dw, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  rrect(c, x0, y - h / 2, w, h, h / 2); c.fillStyle = fill;
  if (shadow) { c.save(); c.shadowColor = shadow; c.shadowBlur = h * 0.5; c.shadowOffsetY = h * 0.18; c.fill(); c.restore(); } else c.fill();
  if (border) { c.strokeStyle = border; c.lineWidth = 1.5; c.stroke(); }
  if (dot) { c.fillStyle = dot; c.beginPath(); c.arc(x0 + padX + size * 0.2, y, size * 0.2, 0, 7); c.fill(); }
  c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(str, x0 + w / 2 + dw / 2, y + size * 0.04);
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

// Odometer counter: each digit column rolls, the way real ones do (a digit turns over while the one below it wraps). A new leading
// digit rolls in from blank (99.6 shows a '1' arriving, never a bare '00'). roll: false snaps to integers: use it for a fast count
// (thousands in under a second), where the low columns would only ever show half-turned digits.
function counter(c, value, x, y, o = {}) {
  const { size = 120, font = 'Inter', weight = 700, color = '#fff', prefix = '', suffix = '', align = 'center', commas = true, mono = true, roll: rolling = true } = o;
  const v = rolling ? Math.max(0, value) : Math.round(Math.max(0, value)), base = Math.max(1, Math.floor(v).toString().length);
  const digits = Math.max(base, (Math.floor(v) + (v % 1 > 0 ? 1 : 0)).toString().length);
  c.save(); c.font = `${weight} ${size}px "${font}"`; c.textBaseline = 'middle'; c.fillStyle = color;
  const dw = mono ? c.measureText('0').width : 0, cw = c.measureText(',').width, pw = c.measureText(prefix).width;
  // A digit rolls only while every digit below it is 9 and rolling over (so a resting integer never shows half-turned digits).
  const rolls = []; for (let k = 0; k < digits; k++) rolls[k] = k === 0 ? v % 1 : Math.floor(v / 10 ** (k - 1)) % 10 === 9 ? rolls[k - 1] : 0;
  const grow = k => (k >= base ? ease.inOut(rolls[k]) : 1); // a new leading digit's cell widens as it rolls in, so the rest slide over smoothly
  const cols = []; for (let k = digits - 1; k >= 0; k--) { cols.push([k, (mono ? dw : c.measureText(String(Math.floor(v / 10 ** k) % 10)).width) * grow(k)]); if (commas && k % 3 === 0 && k) cols.push([',', cw * grow(k)]); }
  const total = pw + c.measureText(suffix).width + cols.reduce((s, [, w]) => s + w, 0), gap = size * 1.2;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  c.textAlign = 'left'; c.fillText(prefix, cx, y); cx += pw;
  for (const [k, w] of cols) {
    if (k === ',') { c.fillText(',', cx, y); cx += w; continue; } // commas sit outside the digit clips (their tails descend)
    const d = Math.floor(v / 10 ** k) % 10, r = rolls[k];
    const dx = mono ? (w - c.measureText(String(d)).width) / 2 : 0, dx2 = mono ? (w - c.measureText(String((d + 1) % 10)).width) / 2 : 0; // centre each digit in its cell, like tabular figures
    c.save(); c.beginPath(); c.rect(cx - 2, y - size * 0.44, w + 4, size * 0.86); c.clip(); // each column clipped to its own line box
    if (d || k < base || digits === 1) c.fillText(String(d), cx + dx, y - r * gap); if (r > 0) c.fillText(String((d + 1) % 10), cx + dx2, y + (1 - r) * gap);
    c.restore(); cx += w;
  }
  c.fillText(suffix, cx, y); c.restore();
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

// ---- the look (measured 2026-10-11b on the best UI promos: agonaliu, 0xfemyn, aschapmann, arjunsh1607, cansincengiz) ----
// Ground under the UI: a base, soft colour blooms that drift, a fine lattice and a vignette. Every top entry had at least a
// bloom and a lattice; a flat bg() reads as a template. blooms: [[colour, fx, fy, fr = 0.7, alpha]] (fractions of W, H and
// max(W, H)); lattice 'grid' | 'dots' | null, cell px, ox/oy slide it (move it at ~0.5x a camera pan for parallax).
function ground(c, t, o = {}) {
  const { base = '#f6f5f1', blooms = [], lattice = 'grid', cell = 64 * S, ox = 0, oy = 0 } = o, dark = darkCol(base);
  const { ink = dark ? '#ffffff' : '#111118', ink_a = dark ? 0.05 : 0.05, vignette = dark ? 0.45 : 0.07 } = o;
  bg(c, base);
  blooms.forEach(([col, fx, fy, fr = 0.7, a = dark ? 0.32 : 0.2], i) =>
    glow(c, W * fx + Math.sin(t * 0.31 + i * 2.1) * 40 * S, H * fy + Math.cos(t * 0.23 + i) * 28 * S, Math.max(W, H) * fr, col, a, dark ? 'lighter' : 'source-over'));
  if (lattice) {
    c.save(); c.fillStyle = ink; c.globalAlpha = ink_a; const x0 = ((ox % cell) + cell) % cell, y0 = ((oy % cell) + cell) % cell, lw = Math.max(1, S);
    if (lattice === 'dots') { c.globalAlpha = ink_a * 2.4; for (let y = y0; y < H; y += cell) for (let x = x0; x < W; x += cell) c.fillRect(x - lw, y - lw, lw * 2, lw * 2); }
    else { for (let x = x0; x < W; x += cell) c.fillRect(x, 0, lw, H); for (let y = y0; y < H; y += cell) c.fillRect(0, y, W, lw); }
    c.restore();
  }
  if (vignette) { const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette})`); c.fillStyle = g; c.fillRect(0, 0, W, H); }
}

// One line of type in up to three voices (display, an accent word, mono meta): parts are strings or [str, style], style
// overrides { font, weight, italic, color, size, track (em), underline (true or a colour) }; put the spaces inside the parts.
// t = seconds since the line starts: each part rises 0.22 em out of a blur over dur, parts gap s apart (default t: settled).
// underline draws a hand-drawn stroke under its part after it lands. Drawn through smoothText, so slow settles don't step.
// Returns { w, x0, parts: [{ x, w }] }. Eyebrow: headline(c, ['ONE-CLICK FIX'], x, y, { font: mono, size: 20 * S, track: 0.3 }).
function headline(c, parts, x, y, o = {}) {
  const { size = 110 * S, font = 'Inter', weight = 700, italic = false, color = '#111111', track = -0.035, align = 'left', t = 99, gap = 0.09, dur = 0.45, blur = 12 * S, alpha = 1 } = o;
  const P = parts.map(p => { const [str, st] = typeof p === 'string' ? [p, {}] : p; return { str, s: { size, font, weight, italic, color, track, ...st } }; });
  const sw = s => `${s.italic ? 'italic ' : ''}${s.weight}`;
  c.save(); P.forEach(p => { c.font = `${sw(p.s)} ${p.s.size}px "${p.s.font}"`; c.letterSpacing = p.s.track * p.s.size + 'px'; p.w = c.measureText(p.str).width; }); c.restore();
  const total = P.reduce((a, p) => a + p.w, 0); let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x; const x0 = cx;
  P.forEach((p, i) => {
    p.x = cx; cx += p.w; const q = clamp((t - i * gap) / dur), e = ease.expoOut(q), a = alpha * clamp(q * 1.8); if (a <= 0.004) return;
    c.save(); c.globalAlpha *= a; if (q < 1 && blur) c.filter = `blur(${((1 - e) * blur).toFixed(2)}px)`;
    smoothText(c, p.str, p.x, y + (1 - e) * p.s.size * 0.22, { size: p.s.size, font: p.s.font, weight: sw(p.s), color: p.s.color, spacing: p.s.track * p.s.size }); c.restore();
    if (p.s.underline) {
      const u = ease.inOut(clamp((t - i * gap - dur * 0.7) / 0.35)), sz = p.s.size, n = 24; if (u <= 0) return;
      c.save(); c.globalAlpha *= alpha; c.strokeStyle = p.s.underline === true ? p.s.color : p.s.underline; c.lineWidth = sz * 0.05; c.lineCap = 'round'; c.beginPath();
      for (let k = 0; k <= n * u; k++) { const f = k / n, px = p.x + sz * 0.04 + (p.w - sz * 0.12) * f, py = y + sz * 0.17 + Math.sin(f * 5.2 + 0.6) * sz * 0.022 - f * sz * 0.03; k ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.stroke(); c.restore();
    }
  });
  return { w: total, x0, parts: P.map(p => ({ x: p.x, w: p.w })) };
}

// Reel chrome (5 of the top UI promos): corner brackets inset 28 px, tracked mono labels in the corners, a progress rule along
// the bottom (rule: false drops it; arm: 0 drops the brackets). tl/tr/br are strings or t => string; bl defaults to a running
// timecode. p 0..1 draws it on. Draw last, outside the
// camera. Use it for a showreel-style piece, not by default: it is chrome, and a promo that needs it to look finished isn't.
function hudFrame(c, t, o = {}) {
  const { color = '#111111', font = 'Geist Mono', size = 17 * S, track = 0.2, inset = 28 * S, arm = 26 * S, lw = 2 * S, alpha = 0.8, p = 1, rule = true, duration = VIDEO.duration, fps = window.OUTFPS || 60,
    tl = '', tr = '', br = '', bl = u => { const f = Math.floor(u * fps + 1e-6), s = Math.floor(f / fps); return `TC 00:00:${String(s).padStart(2, '0')}:${String(f % fps).padStart(2, '0')}`; } } = o;
  if (p <= 0) return; const L = arm * ease.out(clamp(p * 1.5)), tx = inset + 42 * S, ty = inset + 27 * S, by = H - inset - 27 * S;
  c.save(); c.globalAlpha *= alpha; c.strokeStyle = c.fillStyle = color; c.lineWidth = lw; c.beginPath();
  for (const [x, y, sx, sy] of [[inset, inset, 1, 1], [W - inset, inset, -1, 1], [inset, H - inset, 1, -1], [W - inset, H - inset, -1, -1]]) { c.moveTo(x + sx * L, y); c.lineTo(x, y); c.lineTo(x, y + sy * L); }
  c.stroke(); c.globalAlpha *= clamp(p * 2 - 0.6); c.font = `500 ${size}px "${font}"`; c.letterSpacing = track * size + 'px'; c.textBaseline = 'middle';
  const lab = v => (typeof v === 'function' ? v(t) : v);
  c.textAlign = 'left'; c.fillText(lab(tl), tx, ty); c.fillText(lab(bl), tx, by);
  c.textAlign = 'right'; c.fillText(lab(tr), W - tx, ty); c.fillText(lab(br), W - tx, by);
  const r0 = W * 0.19, r1 = W * 0.81, lw2 = Math.max(1, S); if (rule) { c.globalAlpha *= 0.25; c.fillRect(r0, by, r1 - r0, lw2); c.globalAlpha *= 4; c.fillRect(r0, by - lw2 / 2, (r1 - r0) * clamp(t / duration), lw2 * 2); }
  c.restore();
}

// A tilted plane in perspective: a wall of cards or screens behind a headline, a desk the camera skims (aschapmann, arjunsh1607).
// rot [rx, ry, rz] degrees (rx > 0 tips the top away, ry > 0 swings the right side away), the plane's centre at (cx, cy), the eye
// dist px in front (1000-1800 S: lower is more dramatic). fn(put): put(x, y, w, h, draw, strips = 1) maps a rect in plane px
// (origin at the plane's centre) to the screen and calls draw(c, w, h, z) in the rect's own px; z = depth (+ is farther).
// Each item gets an affine fit to its projected corners (exact at three; fine for items up to ~1/4 of the plane), so pass
// strips 4-8 for a big one. dof px of blur per 1000 px of depth away from focus (0 = sharp). Pan by animating cx/cy or the rects.
function plane(c, o, fn) {
  const { rot = [42, 0, -14], cx = W / 2, cy = H / 2, dist = 1400 * S, dof = 0, focus = 0 } = o, [ax, ay, az] = rot.map(d => (d * Math.PI) / 180);
  const P = (u, v) => {
    const x = u * Math.cos(az) - v * Math.sin(az), y = u * Math.sin(az) + v * Math.cos(az), y2 = y * Math.cos(ax), z2 = -y * Math.sin(ax);
    const x3 = x * Math.cos(ay) - z2 * Math.sin(ay), z3 = x * Math.sin(ay) + z2 * Math.cos(ay), k = dist / Math.max(1, dist + z3); return [cx + x3 * k, cy + y2 * k, z3];
  };
  const put = (x, y, w, h, draw, strips = 1) => {
    const z = P(x + w / 2, y + h / 2)[2], b = dof ? (Math.abs(z - focus) / 1000) * dof : 0;
    for (let i = 0; i < strips; i++) {
      const v0 = y + (h * i) / strips, v1 = y + (h * (i + 1)) / strips, A = P(x, v0), B = P(x + w, v0), D = P(x, v1);
      c.save(); c.transform((B[0] - A[0]) / w, (B[1] - A[1]) / w, (D[0] - A[0]) / (v1 - v0), (D[1] - A[1]) / (v1 - v0), A[0], A[1]); c.translate(0, y - v0);
      if (strips > 1) { c.beginPath(); c.rect(-2, v0 - y - 0.6, w + 4, v1 - v0 + 1.2); c.clip(); }
      if (b > 0.4) c.filter = `blur(${b.toFixed(1)}px)`; draw(c, w, h, z); c.restore();
    }
  };
  fn(put);
}

// A link from a to b ([x, y]) drawn on to p as a horizontal S-curve (stat cards wired to a hub, 0xfemyn; tags to a card,
// agonaliu), with a bright pulse riding it at phase q (0..1; loop with q = (t * 0.8 + i * 0.25) % 1). Returns the point at p.
function connector(c, a, b, p, o = {}) {
  const { color = '#ffffff', alpha = 0.4, lw = 2 * S, q = null, len = 0.14, bend = 0.55, dash = null } = o, k = (b[0] - a[0]) * bend;
  const at = u => { const m = 1 - u; return [0, 1].map(j => m * m * m * a[j] + 3 * m * m * u * (a[j] + (j ? 0 : k)) + 3 * m * u * u * (b[j] - (j ? 0 : k)) + u * u * u * b[j]); };
  const seg = (u0, u1) => { c.beginPath(); for (let i = 0, n = 40; i <= n; i++) { const [x, y] = at(lerp(u0, u1, i / n)); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); };
  p = clamp(p); if (p <= 0) return a;
  c.save(); c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.save(); c.globalAlpha *= alpha; if (dash) c.setLineDash(dash); seg(0, p); c.restore();
  if (q != null && p >= 1) { c.lineWidth = lw * 1.6; c.shadowColor = color; c.shadowBlur = 12 * S; seg(Math.max(0, q - len), q); }
  c.restore(); return at(p);
}

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
