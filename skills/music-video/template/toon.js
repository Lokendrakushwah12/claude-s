// Character acting + music reactivity, as pure functions of t (load after lib.js). Numbers come from the 2026-10-11b
// prompt-motion teardowns: a rigged samurai kata (moves 0.15-0.3 s, holds 0.5-1 s), a box mascot and a chat-bubble mascot
// acting a day (stretch 1.25 on a startle, squash 0.7 on a landing, blinks under 0.13 s), a life-cycle walk (one step a beat).
// Trails and smears: type.js onion(c, fn, t) and smear(). Springs without anticipation: lib.js spring(t, keys).

// ---- pose to pose ----
// The value at t through key poses that LAND on their times (put them on beats): keys = [[t, v], [t, v, {antic, move, a, over}], ...].
// Each change winds up the opposite way (a = 0.18 of the change, over antic = 0.14 s), travels in move = 0.12 s so it arrives
// exactly at t, overshoots by over = 0.12 and settles in ~0.3 s. Closed form and summed, so any frame needs no history.
function act(t, keys, o = {}) {
  let v = keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [th, val, ko = {}] = keys[i], dv = val - keys[i - 1][1], { antic = 0.14, move = 0.12, a = 0.18, over = 0.12 } = { ...o, ...ko };
    const s = t - th;
    if (s < -move - antic) continue;
    if (s < -move) { const u = (s + move + antic) / antic; v -= dv * a * u * u * (3 - 2 * u); continue; }
    v += dv * (-a + (1 + a) * actStep(s + move, move, over / (1 + a)));
  }
  return v;
}
// Spring step 0 -> 1 from rest that first crosses 1 at time `cross` and peaks at 1 + os (os 0: a smooth ease, no overshoot).
function actStep(s, cross, os) {
  if (s <= 0) return 0;
  if (os < 1e-3) { const u = Math.min(1, s / cross); return u * u * (3 - 2 * u); }
  const L = Math.log(os), z = -L / Math.sqrt(Math.PI ** 2 + L * L), wd = (Math.PI - Math.acos(z)) / cross, w = wd / Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * s));
}
// Dense points along the smooth closed curve through pts (the quadratic midpoint spline). Fill AND outline from this one
// list: a smooth fill under a polygon outline (sketch on the raw points) shows straight segments on every curve.
function spline(pts, n = 8) {
  const out = [], P = pts.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  for (let i = 0; i < P; i++) { const a = mid(pts[(i + P - 1) % P], pts[i]), b = pts[i], e = mid(pts[i], pts[(i + 1) % P]);
    for (let k = 0; k < n; k++) { const u = k / n; out.push([(1 - u) ** 2 * a[0] + 2 * u * (1 - u) * b[0] + u * u * e[0], (1 - u) ** 2 * a[1] + 2 * u * (1 - u) * b[1] + u * u * e[1]]); } }
  return out;
}
const polyPath = (c, pts) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
// Steam, smoke, clouds, foam: circles [[x, y, r], ...] drawn as ONE merged shape with a single outline (every outline
// first at double width, then every fill over it). Separate outlined circles read as vector debug output, not vapour.
function blobs(c, circles, o = {}) {
  const { fill = '#f7efdf', ink = '#1d1a2e', lw = 3 } = o; c.save(); c.fillStyle = fill; c.strokeStyle = ink; c.lineWidth = lw * 2;
  for (const [x, y, r] of circles) { c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); }
  for (const [x, y, r] of circles) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
  c.restore();
}

// Velocity of any pure curve f(t), per second (for stretch along a move, or a smear's length).
const velOf = (f, t, h = 1 / 240) => (f(t + h) - f(t - h)) / (2 * h);

// ---- squash and stretch ----
// Scale about a base point (the feet, the bottom of a blob) keeping volume: k > 1 stretches tall and thin, k < 1 squashes.
// A tilt turns about the corner it leans onto (pivot = that corner's x offset, e.g. +halfWidth leaning right), never the
// centre: a body rocked about its centre sinks a corner into the floor.
function squashAt(c, x, y, k, rot = 0, pivot = 0) { c.translate(x + pivot, y); c.rotate(rot); c.translate(-pivot, 0); c.scale(1 / Math.sqrt(k), k); }
// A hop from t0 lasting air s, h px high: {y (px above the ground), k (stretch), land (the landing time, cue a sound there)}.
// Wind-up squash 0.8 for 0.12 s before t0, stretch 1.25 off the ground, round at the top, stretched again into the landing,
// squash 0.7 on it, settled with a wobble in 0.3 s.
function hop(t, t0, o = {}) {
  const { air = 0.45, h = 120, squash = 0.7, stretch = 1.25, wind = 0.12 } = o, land = t0 + air, u = (t - t0) / air;
  if (t < t0 - wind) return { y: 0, k: 1, land };
  if (t < t0) { const p = (t - t0 + wind) / wind; return { y: 0, k: 1 - 0.2 * p * p * (3 - 2 * p), land }; }
  if (t < land) return { y: h * 4 * u * (1 - u), k: 1 + (stretch - 1) * (1 - 2 * u) ** 2, land };
  const s = t - land; return { y: 0, k: 1 - (1 - squash) * Math.exp(-s / 0.09) * Math.cos(s * 2 * Math.PI / 0.3), land };
}
// Contact shadow under anything that stands or lands: smaller and fainter the higher it is. Nothing should float.
function contactShadow(c, x, y, r, height = 0, o = {}) { // o.flat: height/width of the ellipse (0.22; 0.1 for a wide thing on a shelf)
  const k = 1 / (1 + height / (o.fall ?? 250)); c.save(); c.globalAlpha *= (o.alpha ?? 0.25) * k; c.fillStyle = o.color || '#000';
  c.beginPath(); c.ellipse(x, y, r * k, r * (o.flat ?? 0.22) * k, 0, 0, 7); c.fill(); c.restore();
}

// ---- walk ----
// One step per `step` s (put a step on each beat; t0 = a beat, the left foot's contact). Angles in radians from hanging
// straight down, + = forward. Body lowest just after each contact, highest at the passing pose; arms swing against the legs.
function walk(t, o = {}) {
  const { t0 = 0, step = 0.5, stride = 0.45, knee = 0.9, arm = 0.5, bob = 10 } = o, ph = ((t - t0) / step) * Math.PI;
  const leg = p => ({ hip: stride * Math.cos(p), knee: -(Math.sin(p) < 0 ? knee * -Math.sin(p) : 0.12 * Math.sin(p)) });
  return { L: leg(ph), R: leg(ph + Math.PI), armL: -arm * Math.cos(ph), armR: arm * Math.cos(ph),
    up: bob * (1 - Math.cos(2 * (ph - 0.35))) / 2, lean: 0.05 + 0.02 * Math.cos(2 * ph) };
}
// A two-bone limb (thigh + shin, upper arm + forearm) from (x, y), angles from straight down, a2 relative to a1. Draws a
// round-capped stroke (hose: one smooth curve through the joint, rubber-hose style) and returns the end point [x, y].
function limb(c, x, y, a1, a2, l1, l2, o = {}) {
  const jx = x + Math.sin(a1) * l1, jy = y + Math.cos(a1) * l1, ex = jx + Math.sin(a1 + a2) * l2, ey = jy + Math.cos(a1 + a2) * l2;
  c.save(); c.lineCap = c.lineJoin = 'round'; c.lineWidth = o.w ?? 14; c.strokeStyle = o.color || '#1d1a2e'; c.beginPath(); c.moveTo(x, y);
  o.hose ? c.quadraticCurveTo(jx, jy, ex, ey) : (c.lineTo(jx, jy), c.lineTo(ex, ey)); c.stroke(); c.restore();
  return [ex, ey];
}

// ---- faces ----
// Eyelid 0 (open) .. 1 (shut) from seeded blinks every 2-5.5 s (close 0.05 s, shut 0.03, open 0.09; 1 in 5 is a double),
// plus forced blinks at o.at (on every head turn, and just before an expression changes).
function blinkAt(t, seed = 1, o = {}) {
  const one = s => s < 0 ? 0 : s < 0.05 ? s / 0.05 : s < 0.08 ? 1 : s < 0.17 ? 1 - (s - 0.08) / 0.09 : 0;
  let v = Math.max(0, ...(o.at || []).map(b => one(t - b)));
  const r = rng(seed * 977 + 13); let b = r() * 2;
  while (b < t + 0.2) { v = Math.max(v, one(t - b)); const dbl = r() < 0.2; if (dbl) v = Math.max(v, one(t - b - 0.25)); b += 2 + r() * 3.5 + (dbl ? 0.25 : 0); }
  return v;
}
// Expression presets: lid (0 open .. 1 shut), happy (^ ^ arcs), eye (height x), mouth smile -1..1 / open 0..1, brow (-1 angry
// .. 1 worried), blush. Mix them with face(); exprAt blends between keyed presets in `dur` s (faces change in 2-4 frames).
const EXPR = {
  neutral: { lid: 0, happy: 0, eye: 1, smile: 0.25, open: 0, brow: 0, blush: 0 },
  happy: { lid: 0, happy: 1, eye: 1, smile: 0.9, open: 0.15, brow: 0.2, blush: 0.8 },
  laugh: { lid: 0, happy: 1, eye: 1, smile: 1, open: 0.8, brow: 0.3, blush: 1 },
  surprised: { lid: 0, happy: 0, eye: 1.35, smile: 0, open: 0.7, brow: 0.8, blush: 0 },
  sleepy: { lid: 0.55, happy: 0, eye: 1, smile: 0, open: 0, brow: 0.1, blush: 0 },
  asleep: { lid: 1, happy: 0, eye: 1, smile: 0.1, open: 0.1, brow: 0, blush: 0 },
  sad: { lid: 0.25, happy: 0, eye: 0.9, smile: -0.7, open: 0, brow: 1, blush: 0 },
  angry: { lid: 0.3, happy: 0, eye: 0.9, smile: -0.5, open: 0.2, brow: -1, blush: 0 },
  determined: { lid: 0.35, happy: 0, eye: 0.95, smile: -0.1, open: 0, brow: -0.6, blush: 0 },
  worried: { lid: 0.1, happy: 0, eye: 1.1, smile: -0.35, open: 0.1, brow: 1, blush: 0 },
  curious: { lid: 0, happy: 0, eye: 1.15, smile: 0.2, open: 0.05, brow: 0.6, blush: 0 },
  eager: { lid: 0, happy: 0, eye: 1.2, smile: 0.7, open: 0.25, brow: 0.5, blush: 0.4 },
  strain: { lid: 1, happy: 0, eye: 1, smile: -0.2, open: 0, brow: -0.5, blush: 1 }, // holding a breath: add puff 1 (cheeks out)
};
function exprAt(t, keys, dur = 0.1) {
  let cur = { ...EXPR[keys[0][1]] };
  for (let i = 1; i < keys.length; i++) { const p = prog(t, keys[i][0] - dur, keys[i][0]), nx = EXPR[keys[i][1]]; if (p <= 0) break; for (const k in cur) cur[k] = lerp(cur[k], nx[k], ease.inOut(p)); }
  return cur;
}
// Draw a mascot face centred at (x, y); u = the eye spacing in px. f = an EXPR mix plus look [-1..1, -1..1] (pupils lead
// the head by ~0.1 s), blink (blinkAt), talk (mouthAt, opens the mouth), and colours ink / shine / cheek.
function face(c, x, y, u, f = EXPR.neutral, o = {}) {
  const { ink = '#1d1a2e', shine = '#fff', cheek = '#ff7a8a', eyeW = 0.22, eyeH = 0.34 } = o, look = f.look || [0, 0];
  const lid = clamp(Math.max(f.lid, f.blink || 0)), open = clamp(f.open + (f.talk || 0) * 0.6), ew = u * eyeW, eh = u * eyeH * f.eye;
  c.save(); c.translate(x, y); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = c.fillStyle = ink; c.lineWidth = u * 0.07;
  for (const sd of [-1, 1]) {
    const ex = sd * u / 2 + look[0] * u * 0.15, ey = look[1] * u * 0.1; // eyes travel far enough to read at phone size
    if (f.happy > 0.5) { c.beginPath(); c.moveTo(ex - ew, ey + eh * 0.15); c.quadraticCurveTo(ex, ey - eh * 0.9, ex + ew, ey + eh * 0.15); c.stroke(); }
    else if (lid > 0.85) { c.beginPath(); c.moveTo(ex - ew, ey); c.quadraticCurveTo(ex, ey + eh * 0.5, ex + ew, ey); c.stroke(); }
    else {
      const h = eh * (1 - lid); c.beginPath(); c.ellipse(ex, ey + eh * lid * 0.5, ew * 0.75, Math.max(h / 2, u * 0.02), 0, 0, 7); c.fill();
      if (h > eh * 0.4) { c.fillStyle = shine; c.beginPath(); c.arc(ex - ew * 0.25, ey - h * 0.18, ew * 0.22, 0, 7); c.fill(); c.fillStyle = ink; }
      if (lid > 0.1) { c.beginPath(); c.moveTo(ex - ew, ey - eh / 2 + eh * lid); c.lineTo(ex + ew, ey - eh / 2 + eh * lid); c.stroke(); }
    }
    if (Math.abs(f.brow) > 0.15) { const by = ey - eh * 0.85 - u * 0.08, tilt = f.brow * u * 0.07 * sd; c.beginPath(); c.moveTo(ex - ew * 1.1, by - tilt); c.lineTo(ex + ew * 1.1, by + tilt); c.stroke(); }
    if (f.blush > 0.05) { c.save(); c.globalAlpha *= f.blush * 0.55; c.fillStyle = cheek; c.beginPath(); c.ellipse(sd * u * 0.78, eh * 0.55, u * 0.13 * (1 + (f.puff || 0)), u * 0.07 * (1 + (f.puff || 0)), 0, 0, 7); c.fill(); c.restore(); }
    if (f.puff > 0.05) { c.beginPath(); c.arc(sd * u * 0.7, eh * 0.6, u * 0.22 * f.puff, sd > 0 ? -1.2 : Math.PI - 0.6, sd > 0 ? 0.6 : Math.PI + 1.2); c.stroke(); } // cheeks blown out
  }
  const my = eh * 0.75 + u * 0.08, mw = u * 0.22 * (1 + 0.3 * Math.abs(f.smile));
  if (open > 0.08) { c.beginPath(); c.ellipse(0, my + u * 0.05 * open, mw * (0.55 + 0.3 * (f.smile > 0)), u * 0.16 * open + u * 0.02, 0, 0, 7); c.fill(); }
  else { c.beginPath(); c.moveTo(-mw, my); c.quadraticCurveTo(0, my + f.smile * u * 0.2, mw, my); c.stroke(); }
  c.restore();
}
// Mouth opening 0..1 for talking or singing: words = [{w, s, e}] (LYRICS[].words, or VO word times). Each word opens and
// closes once per syllable (vowel group), shut between words; long held vowels stay open (cut away from those, see SKILL.md).
function mouthAt(t, words) {
  for (const { w, s, e = s + 0.3 } of words) {
    if (t < s - 0.03 || t > e) continue;
    const n = Math.max(1, (w.toLowerCase().match(/[aeiouy]+/g) || []).length), u = ((t - s + 0.03) / (e - s + 0.03)) * n;
    return Math.sin(Math.PI * (u % 1)) ** 0.7;
  }
  return 0;
}

// ---- music ----
// The song's energy per band at t, 0..1 (fast attack, 0.15 s release): 'low' (kick, bass), 'mid' (voice, chords), 'high'
// (hats, air). align.py writes window.BANDS for a song; `align.py --bands audio.wav` adds it for a synthesised mix. 0 without.
function band(t, name = 'low') {
  const B = window.BANDS, a = B && B[name]; if (!a) return 0;
  const x = clamp(t * B.fps, 0, a.length - 1), i = Math.floor(x); return lerp(a[i], a[Math.min(i + 1, a.length - 1)], x - i);
}

// Self-check of the closed forms (node render.mjs --still 0 --query tooncheck: a failure shows as a page error).
function toonCheck() {
  const ok = (c, m) => { if (!c) throw new Error('toon.js check: ' + m); }, k = [[0, 0], [1, 10]];
  ok(Math.abs(act(1, k) - 10) < 1e-9, 'act lands on its key time'); ok(act(0.8, k) < 0, 'act winds up the other way first');
  ok(Math.abs(act(0.5, k)) < 1e-9, 'act rests before the wind-up'); ok(Math.abs(act(2.5, k) - 10) < 0.05, 'act settles');
  let mx = 0; for (let t = 1; t < 1.6; t += 0.001) mx = Math.max(mx, act(t, k)); ok(Math.abs(mx - 11.2) < 0.15, 'act overshoots ~12 %');
  ok(hop(0.2, 0, { air: 0.4, h: 100 }).y > 70 && hop(0.03, 0, { air: 0.4 }).k > 1.15, 'hop: airborne, stretched off the ground'); ok(hop(0.4, 0, { air: 0.4 }).k < 0.75, 'hop squashes on landing');
  ok(blinkAt(0.06, 1, { at: [0] }) === 1, 'a forced blink shuts'); ok(spline([[0, 0], [10, 0], [10, 10], [0, 10]]).length === 32, 'spline density');
  ok(mouthAt(0.15, [{ w: 'hello', s: 0, e: 0.4 }]) > 0.5 && mouthAt(0.6, [{ w: 'hello', s: 0, e: 0.4 }]) === 0, 'mouth opens on words only');
  return 'toon.js check ok';
}
if (location.search.includes('tooncheck')) console.log(toonCheck());
