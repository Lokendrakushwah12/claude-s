// iso.js: an orthographic "iso" camera for canvas 2D. Rounded solids, gables, decals and extruded type on any plane,
// painter's order, cast shadows, tilt-shift, the flat-plan -> oblique lift, and the two motion clocks that go with them.
// Shared by type-film, promo-video and explainer-lesson: copy it next to video.js and load it before the scenes.
// Every drawing call is a pure function of its arguments, so seek(t) stays deterministic (tilt() reuses two scratch
// canvases, which never changes its output). Check the maths with: node -e "require('./iso.js').selftest()".
// This is claude-s's own implementation. The line look it supports pairs well with Lucas Marques's hairline-create (MIT).
//
// WORLD: x right and y down on the plan (the way screen and map data are laid out), z up. At el 90 the camera IS the
// plan, so data keeps its coordinates when it lifts into 3D. That frame is left-handed on purpose; face(), extrude()
// and selftest() all account for it.
//
// PITFALLS (each one bit the prototype):
// 1. Light BOTH visible sides, from the viewer's left-front, normalised so the top face is exactly 1. A light fixed in
//    the world gives both sides the same grey at some azimuths; light(C) turns with the camera (left ~.92, right ~.71).
// 2. Decal orientation: in face(), U is the reading direction and V is "down" on the plane, and U x V is the face's
//    outward normal. If U x V points away from the camera the face is skipped; force it with both=true and it reads
//    mirrored. Ground: U [1,0,0] V [0,1,0]. Wall facing +y: U [1,0,0] V [0,0,-1]. Wall facing +x: U [0,-1,0] V [0,0,-1].
// 3. Extrude along the face normal (U x V), never along a world axis, and paint back to front along it. The front
//    is lit as a face, the sides darker, so type reads as a solid and not as a shadow.
// 4. Inside face()/extrude() the canvas is in world units, so line widths and font sizes scale with C.S. fn gets
//    px = 1 / C.S: write lineWidth = 1.2 * px for a 1.2 px hairline.
// 5. Paint order: ground decals first, then solids far to near (order()), each plate's guides just before it, and
//    labels last in screen space at a projected point. A label laid on the ground gets covered by the first block.
//
// MOTION: two clocks.
// - WHERE things are (a gap, a camera angle, a scrub position) moves on spring(t - t0): k 100, c 18, settles in about
//   0.7 s with a hair of overshoot, and never jumps when the target changes again (sum one spring per change).
// - WHICH thing is chosen (a picked layer, a mode, a colour) changes on tween(t, t0): 700 ms on ease.lift, which is
//   cubic-bezier(.32,.72,0,1).
// - Parts that start together stagger by distance from where the action starts: delay = stagger(part, origin).
const ISO = (() => {
  const rad = d => (d * Math.PI) / 180, clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)), lerp = (a, b, p) => a + (b - a) * p;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };

  // ---- line tokens: one system for both themes. Plates are filled with `plate` (= the ground) so near hides far
  // and the drawing still reads as line art. hi = the one picked part; edge = idle silhouettes; mid = creases and
  // small type; lo = guides and grid; wash = an optional fill for the picked plate. Dark matches explorable-explainer.
  const LINE = {
    light: { ground: '#FAFAF8', plate: '#FAFAF8', hi: '#1C1C1A', edge: '#8A8984', mid: '#B4B3AD', lo: '#DDDCD6', wash: '#EEEDE7' },
    dark: { ground: '#191918', plate: '#191918', hi: '#ECEBE6', edge: '#8E8D87', mid: '#5F5E59', lo: '#3A3936', wash: '#262624' },
  };

  // ---- camera ----
  // az spins the ground (45 = the classic diamond). el tilts it: 30 gives the 2:1 view (ground lines at 26.6 deg),
  // 35.264 gives true isometric (30 deg lines), 90 gives the flat plan.
  function cam({ az = 45, el = 30, S = 1, ox = 0, oy = 0 } = {}) {
    const a = rad(az), e = rad(el);
    return { az, el, S, ox, oy, c: Math.cos(a), s: Math.sin(a), k: Math.sin(e), zf: Math.cos(e) };
  }
  const P = (C, x, y, z = 0) => {
    const X = x * C.c - y * C.s, Y = x * C.s + y * C.c;
    return [C.ox + C.S * X, C.oy + C.S * (Y * C.k - z * C.zf)];
  };
  // Screen point -> world [x, y] on the plane at height z. Hit-test pointers here, against the REST pose (where the
  // spring is heading), never against the moving drawing, or a plate slides out from under the pointer and the pick flickers.
  function unP(C, sx, sy, z = 0) {
    const X = (sx - C.ox) / C.S, Y = ((sy - C.oy) / C.S + z * C.zf) / C.k;
    return [X * C.c + Y * C.s, -X * C.s + Y * C.c];
  }
  // Toward the viewer. Bigger depth = nearer = painted later.
  const view = C => [C.s * C.zf, C.c * C.zf, C.k];
  const depth = (C, x, y, z = 0) => (x * C.s + y * C.c) * C.zf + z * C.k;
  // Centre the box of world points on (cx, cy); with w/h also scale S so the box fits inside w x h.
  function fit(C, pts, cx, cy, w, h) {
    const box = () => { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (const p of pts) { const q = P(C, ...p); a = Math.min(a, q[0]); b = Math.max(b, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); } return [a, b, c, d]; };
    C.ox = 0; C.oy = 0;
    if (w && h) { const [a, b, c, d] = box(); C.S *= Math.min(w / (b - a || 1), h / (d - c || 1)); }
    const [a, b, c, d] = box(); C.ox = cx - (a + b) / 2; C.oy = cy - (c + d) / 2; return C;
  }
  // The camera's key light: the viewer's left-front and above, so the two visible sides always differ.
  const light = C => [-0.3 * C.c + 0.75 * C.s, 0.3 * C.s + 0.75 * C.c, 0.9];
  // Data -> world: p = 0 is the flat plan, p = 1 the oblique view. Data drawn at its plan coordinates keeps them the
  // whole way, and heights grow out of the plan on their own as el leaves 90. `at` (a world point) stays pinned to
  // screen (cx, cy) so nothing drifts. Feed it a tween: lift(tween(t, t0, 1.2), {...}).
  function lift(p, { from = { az: 0, el: 90 }, to = { az: 45, el: 30 }, S = 1, at = [0, 0, 0], cx = 0, cy = 0 } = {}) {
    const C = cam({ az: lerp(from.az, to.az, p), el: lerp(from.el, to.el, p), S }), q = P(C, ...at);
    C.ox = cx - q[0]; C.oy = cy - q[1]; return C;
  }

  // ---- footprints: rings of samples with outward ground normals ----
  function rrect(x0, y0, x1, y1, r = 0, n = 6) {
    r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2)); const out = [];
    for (const [cx, cy, a0] of [[x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180], [x1 - r, y0 + r, 270]])
      for (let i = 0; i <= n; i++) { const a = rad(a0 + (90 * i) / n); out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }); }
    return out;
  }
  function circle(cx, cy, R, n = 48) {
    return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; });
  }
  const ringAt = (C, ring, z) => ring.map(q => P(C, q.x, q.y, z));
  const shift = (ring, dx, dy) => ring.map(q => ({ ...q, x: q.x + dx, y: q.y + dy }));
  function hull(pts) { // monotone chain
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), x = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length > 1 && x(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length > 1 && x(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  const path = (c, pts, close = true) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); if (close) c.closePath(); };

  // ---- shading ----
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const tint = (h, f) => '#' + hex(h).map(v => Math.round(clamp(f < 1 ? v * f : v + (255 - v) * (f - 1), 0, 255)).toString(16).padStart(2, '0')).join('');
  // Lambert with an ambient floor, normalised so a face pointing straight up is exactly 1. n must be unit length.
  function lambert(n, l = light(cam()), amb = 0.45) {
    const L = Math.hypot(...l), f = v => amb + (1 - amb) * Math.max(0, dot(v, l) / L);
    return f(n) / f([0, 0, 1]);
  }

  // ---- solids ----
  // A rounded slab from z0 to z1. Its silhouette is the hull of the top and bottom rings, so no vertical corner line is
  // ever drawn: the outline, the top face and one optional crease are the whole drawing.
  // o: { top, side, edge, lw, crease, creaseColor, light, flatSide }. Side shading follows each facing sample's normal,
  // so a rounded corner blends from the lit side to the shaded one and a circle footprint shades like a cylinder.
  function slab(c, C, ring, z0, z1, o = {}) {
    const { top = '#ffffff', side = top, edge = '#9a9aa2', lw = 1.25, crease, light: l = light(C), flatSide = false } = o;
    const T = ringAt(C, ring, z1), B = ringAt(C, ring, z0), sil = hull(T.concat(B));
    if (z1 - z0 > 1e-6) {
      if (flatSide) c.fillStyle = side;
      else { // a horizontal gradient through the facing samples, each at its own Lambert brightness
        const V = view(C), face = ring.map((q, i) => [q, B[i]]).filter(([q]) => q.nx * V[0] + q.ny * V[1] > 0);
        const xs = face.map(f => f[1][0]), a = Math.min(...xs), b = Math.max(...xs), g = c.createLinearGradient(a, 0, b > a ? b : a + 1, 0);
        face.sort((p, q) => p[1][0] - q[1][0]).forEach(([q, s]) => g.addColorStop(b > a ? (s[0] - a) / (b - a) : 0, tint(side, lambert([q.nx, q.ny, 0], l))));
        c.fillStyle = face.length ? g : side;
      }
      path(c, sil); c.fill();
    }
    path(c, T); c.fillStyle = top; c.fill();
    c.lineWidth = lw; c.lineJoin = 'round'; c.strokeStyle = edge;
    path(c, sil); c.stroke(); path(c, T); c.stroke();
    if (crease) { path(c, ringAt(C, crease, z1)); c.strokeStyle = o.creaseColor || tint(edge, 1.45); c.stroke(); }
    return { sil, top: T };
  }
  // Any convex solid given as faces of world points. Back faces are skipped, so the front ones never overlap and need
  // no sorting; each is lit by its outward normal. faces: [{ pts: [[x,y,z], ...], fill }].
  function convex(c, C, faces, o = {}) {
    const { edge = '#9a9aa2', lw = 1.25, light: l = light(C) } = o, all = faces.flatMap(f => f.pts);
    const mid = pts => [0, 1, 2].map(i => pts.reduce((s, p) => s + p[i], 0) / pts.length), m = mid(all), V = view(C);
    for (const f of faces) {
      const [a, b, d] = f.pts, fm = mid(f.pts);
      let n = unit(cross(b.map((v, i) => v - a[i]), d.map((v, i) => v - a[i])));
      if (dot(n, fm.map((v, i) => v - m[i])) < 0) n = n.map(v => -v);   // outward
      if (dot(n, V) <= 1e-9) continue;
      path(c, f.pts.map(p => P(C, ...p))); c.fillStyle = tint(f.fill, lambert(n, l)); c.fill();
      c.lineWidth = lw; c.lineJoin = 'round'; c.strokeStyle = edge; c.stroke();
    }
  }
  // A gable roof over the box x0..x1, y0..y1 whose eaves sit at height z and ridge at z + h. o: { ridge: 'x' | 'y'
  // (default: along the long side), over (eave overhang), fill, gable (the end triangles), edge, lw, light }.
  function roof(c, C, x0, y0, x1, y1, z, h, o = {}) {
    const { over = 0, fill = '#ffffff', gable = fill } = o, ridge = o.ridge || (x1 - x0 >= y1 - y0 ? 'x' : 'y');
    x0 -= over; y0 -= over; x1 += over; y1 += over;
    const zt = z + h, sw = ridge === 'x' ? (x, y, zz) => [x, y, zz] : (x, y, zz) => [y, x, zz];   // build along x, swap for y
    const [a0, a1, b0, b1] = ridge === 'x' ? [x0, x1, y0, y1] : [y0, y1, x0, x1], bm = (b0 + b1) / 2;
    const F = [
      [[a0, b0, z], [a1, b0, z], [a1, bm, zt], [a0, bm, zt]],
      [[a0, b1, z], [a0, bm, zt], [a1, bm, zt], [a1, b1, z]],
      [[a0, b0, z], [a0, bm, zt], [a0, b1, z]],
      [[a1, b0, z], [a1, b1, z], [a1, bm, zt]],
    ].map((pts, i) => ({ pts: pts.map(p => sw(...p)), fill: i < 2 ? fill : gable }));
    convex(c, C, F, o);
  }
  // Draw 2D content (text, decals, UI, dots) flat on a world plane. An orthographic projection maps a plane affinely,
  // so one ctx.transform does it: origin o = [x,y,z], U = the plane's reading direction, V = its "down", in world
  // units. The screen determinant of (U, V) has the sign of (U x V) . view, so a face that passes the cull is never
  // mirrored. fn(ctx, px) draws in plane units; px = 1 / C.S turns screen pixels into plane units (pitfall 4).
  function face(c, C, o, U, V, fn, both = false) {
    if (!both && dot(cross(U, V), view(C)) <= 1e-9) return false;
    const p0 = P(C, ...o), pu = P(C, o[0] + U[0], o[1] + U[1], o[2] + U[2]), pv = P(C, o[0] + V[0], o[1] + V[1], o[2] + V[2]);
    c.save(); c.transform(pu[0] - p0[0], pu[1] - p0[1], pv[0] - p0[0], pv[1] - p0[1], p0[0], p0[1]); fn(c, 1 / C.S); c.restore(); return true;
  }
  // Extruded type or a logo on any plane: the shape drawn by fn stands out of the plane by d world units along its
  // normal U x V (pitfall 3). One copy per screen pixel of depth, painted back to front, so the sides close up.
  // fn(ctx, px, color, isFront) fills the shape with `color`. o: { front, side, light }.
  function extrude(c, C, o, U, V, d, fn, opt = {}) {
    const N = unit(cross(U, V)), { front = '#ffffff', side = front, light: l = light(C) } = opt, facing = dot(N, view(C)) > 0;
    const a = P(C, ...o), b = P(C, o[0] + N[0] * d, o[1] + N[1] * d, o[2] + N[2] * d), n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    const fc = tint(front, lambert(N, l)), sc = tint(side, 0.78 * lambert(N, l));
    for (let i = 0; i <= n; i++) {
      const k = facing ? i / n : 1 - i / n, top = i === n && facing;
      face(c, C, [o[0] + N[0] * d * k, o[1] + N[1] * d * k, o[2] + N[2] * d * k], U, V, (x, px) => fn(x, px, top ? fc : sc, top), true);
    }
  }
  // Dashed assembly guide between two world points (paint it BEFORE the plate it belongs to).
  function guide(c, C, a, b, o = {}) {
    const { color = '#b8b8be', lw = 1, dash = [2, 4] } = o, p = P(C, ...a), q = P(C, ...b);
    c.save(); c.setLineDash(dash); c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.moveTo(...p); c.lineTo(...q); c.stroke(); c.restore();
  }
  // Ground lattice from (x0,y0) to (x1,y1) every `step`, fading toward its rim.
  function grid(c, C, x0, y0, x1, y1, step, o = {}) {
    const { color = '#c9c9cf', lw = 1, z = 0, fade = 0.6 } = o, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
    c.save(); c.strokeStyle = color; c.lineWidth = lw;
    for (let x = x0; x <= x1 + 1e-6; x += step) { c.globalAlpha = 1 - fade * Math.abs(x - cx) / (R || 1); c.beginPath(); c.moveTo(...P(C, x, y0, z)); c.lineTo(...P(C, x, y1, z)); c.stroke(); }
    for (let y = y0; y <= y1 + 1e-6; y += step) { c.globalAlpha = 1 - fade * Math.abs(y - cy) / (R || 1); c.beginPath(); c.moveTo(...P(C, x0, y, z)); c.lineTo(...P(C, x1, y, z)); c.stroke(); }
    c.restore();
  }
  // Cast shadow of a solid of height h standing on z0, for a sun that throws shadows along (sx, sy) per unit height.
  function shadow(c, C, ring, z0, h, o = {}) {
    const { sun = [-0.9, 0.35], color = 'rgba(40,46,60,0.16)', blur = 0 } = o;
    const pts = hull(ringAt(C, ring, z0).concat(ringAt(C, shift(ring, sun[0] * h, sun[1] * h), z0)));
    c.save(); if (blur) c.filter = `blur(${blur}px)`; path(c, pts); c.fillStyle = color; c.fill(); c.restore();
  }
  // Painter's order: far to near by the depth of each item's anchor {x, y, z}, then by z for a stack.
  const order = (C, items) => items.slice().sort((a, b) => depth(C, a.x, a.y, a.z || 0) - depth(C, b.x, b.y, b.z || 0) || (a.z || 0) - (b.z || 0));

  // Tilt-shift: draw(ctx) paints the scene once offscreen; it is laid down sharp inside a horizontal focus band at y
  // (canvas pixels) and through `steps` growing blurs outside it. draw() must paint its own background, or the
  // blurred bands can't cover the sharp copy. o: { y, band (half height in focus), ramp, blur (max px), steps }.
  const scratch = [];
  function layer(i, w, h) {
    let L = scratch[i];
    if (!L) L = scratch[i] = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    if (L.width !== w || L.height !== h) { L.width = w; L.height = h; }
    const x = L.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h); return [L, x];
  }
  function tilt(c, draw, o = {}) {
    const w = c.canvas.width, h = c.canvas.height, { y = h / 2, band = h * 0.1, ramp = h * 0.3, blur = 6, steps = 3 } = o;
    const [A, a] = layer(0, w, h); a.setTransform(c.getTransform()); draw(a);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(A, 0, 0);
    for (let i = 1; i <= steps; i++) {
      const [B, b] = layer(1, w, h), r0 = band + (ramp * (i - 1)) / steps, r1 = band + (ramp * i) / steps, g = b.createLinearGradient(0, 0, 0, h);
      [[y - r1, 1], [y - r0, 0], [y + r0, 0], [y + r1, 1]].forEach(([v, al]) => g.addColorStop(clamp(v / h), `rgba(0,0,0,${al})`));
      b.filter = `blur(${(blur * i) / steps}px)`; b.drawImage(A, 0, 0); b.filter = 'none';
      b.globalCompositeOperation = 'destination-in'; b.fillStyle = g; b.fillRect(0, 0, w, h); b.globalCompositeOperation = 'source-over';
      c.drawImage(B, 0, 0);
    }
    c.restore();
  }

  // ---- motion: the two clocks (see the header) ----
  // Closed-form damped spring, 0 -> 1, t seconds after the change. A pure function of t, so frame 812 needs no history.
  function spring(t, k = 100, d = 18) {
    if (t <= 0) return 0;
    const w = Math.sqrt(k), z = d / (2 * w);
    if (z < 1) { const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t)); }
    return 1 - Math.exp(-w * t) * (1 + w * t);
  }
  function bezier(x1, y1, x2, y2) { // CSS cubic-bezier as a function of progress
    const f = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
    return p => { if (p <= 0) return 0; if (p >= 1) return 1; let lo = 0, hi = 1, t = p; for (let i = 0; i < 32; i++) { t = (lo + hi) / 2; if (f(x1, x2, t) < p) lo = t; else hi = t; } return f(y1, y2, t); };
  }
  const ease = { lift: bezier(0.32, 0.72, 0, 1) };
  const tween = (t, t0, dur = 0.7) => ease.lift(clamp((t - t0) / dur));
  const stagger = (p, o, step = 0.045, u = 1) => (Math.hypot(p.x - o.x, p.y - o.y, (p.z || 0) - (o.z || 0)) / u) * step;

  // ---- selftest: throws on the first broken invariant ----
  function selftest() {
    let n = 0; const ok = (c, m) => { n++; if (!c) throw new Error('iso.js selftest: ' + m); }, near = (a, b, e, m) => ok(Math.abs(a - b) < e, `${m}: ${a} != ${b}`);
    for (const [az, el] of [[45, 30], [45, 35.264], [20, 40], [130, 25], [0, 90]]) {
      const C = cam({ az, el, S: 3, ox: 100, oy: 50 });
      if (el < 90) for (const [x, y, z] of [[0, 0, 0], [10, -4, 0], [3, 7, 5]]) {   // unP inverts P on the plane z
        const [sx, sy] = P(C, x, y, z), [u, v] = unP(C, sx, sy, z); near(u, x, 1e-9, 'unP x'); near(v, y, 1e-9, 'unP y');
      }
      const V = view(C), d0 = depth(C, 1, 2, 3);                               // view() is the gradient of depth()
      near(depth(C, 2, 2, 3) - d0, V[0], 1e-9, 'view x'); near(depth(C, 1, 3, 3) - d0, V[1], 1e-9, 'view y'); near(depth(C, 1, 2, 4) - d0, V[2], 1e-9, 'view z');
      near(P(C, 0, 0, 0)[0], P(C, ...V.map(v => v * 10))[0], 1e-9, 'view is screen-up only');
      for (const [U, W] of [[[1, 0, 0], [0, 1, 0]], [[1, 0, 0], [0, 0, -1]], [[0, -1, 0], [0, 0, -1]], [[0.6, 0.8, 0], [0, 0, -1]], [[-1, 0, 0], [0, 0, -1]]]) {
        const p0 = P(C, 0, 0, 0), pu = P(C, ...U), pv = P(C, ...W), det = (pu[0] - p0[0]) * (pv[1] - p0[1]) - (pu[1] - p0[1]) * (pv[0] - p0[0]);
        const facing = dot(cross(U, W), V); if (Math.abs(facing) > 1e-6) ok(Math.sign(det) === Math.sign(facing), `decal mirrored at az ${az} el ${el}`);   // pitfall 2
      }
      if (el < 90) {                                                            // pitfall 1: both visible sides lit, left brighter
        const sides = [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0]].filter(nv => dot(nv, V) > 1e-6).map(nv => ({ x: P(C, ...nv)[0] - P(C, 0, 0, 0)[0], b: lambert(nv, light(C)) }));
        if (sides.length === 2) { sides.sort((a, b) => a.x - b.x); ok(sides[0].b > sides[1].b + 0.1, `left side not brighter at az ${az}`); ok(sides.every(s => s.b < 1 && s.b > 0.45), 'sides darker than the top'); }
      }
    }
    const ang = el => { const C = cam({ el }), p = P(C, 1, 0, 0); return (Math.atan2(p[1], p[0]) * 180) / Math.PI; };
    near(ang(30), 26.565, 1e-3, '2:1 view'); near(ang(35.264), 30, 1e-2, 'true isometric');
    const r = rrect(0, 0, 10, 6, 2); ok(r.every(q => Math.abs(Math.hypot(q.nx, q.ny) - 1) < 1e-9), 'unit ring normals');
    const h = hull(ringAt(cam(), r, 0).concat(ringAt(cam(), r, 5))); let area = 0;
    h.forEach((p, i) => { const q = h[(i + 1) % h.length]; area += p[0] * q[1] - q[0] * p[1]; }); ok(Math.abs(area) > 1, 'hull has area');
    const C = cam(), items = [{ x: 0, y: 0, z: 0, n: 'far' }, { x: 5, y: 5, z: 0, n: 'near' }, { x: 0, y: 0, z: 4, n: 'up' }];
    ok(order(C, items).map(i => i.n).join() === 'far,up,near', 'painter order');
    const plan = lift(0, { at: [5, 5, 0], cx: 10, cy: 20 }), world = lift(1, { at: [5, 5, 0], cx: 10, cy: 20 });   // data -> world
    near(P(plan, 3, 4, 0)[0], P(plan, 3, 4, 50)[0], 1e-9, 'plan ignores height x'); near(P(plan, 3, 4, 0)[1], P(plan, 3, 4, 50)[1], 1e-9, 'plan ignores height y');
    near(P(plan, 8, 1)[0] - P(plan, 3, 1)[0], 5, 1e-9, 'plan is the data layout'); near(P(world, 5, 5, 0)[1], 20, 1e-9, 'lift keeps its anchor');
    near(spring(0), 0, 1e-12, 'spring start'); near(spring(3), 1, 1e-3, 'spring settles'); ok(spring(0.7) > 0.97, 'spring settles in about 0.7 s');
    near(ease.lift(0), 0, 1e-12, 'ease start'); near(ease.lift(1), 1, 1e-12, 'ease end'); ok(ease.lift(0.5) > 0.85, 'ease.lift front-loads');
    for (let p = 0; p < 1; p += 0.05) ok(ease.lift(p + 0.05) >= ease.lift(p), 'ease monotonic');
    near(tween(0.7, 0), 1, 1e-12, 'tween takes 700 ms'); near(stagger({ x: 3, y: 4 }, { x: 0, y: 0 }), 0.225, 1e-12, 'stagger by distance');
    ok(Object.keys(LINE.light).join() === Object.keys(LINE.dark).join(), 'LINE themes share keys');
    if (typeof console !== 'undefined') console.log(`iso.js: ${n} checks pass`);
    return n;
  }

  return { LINE, cam, P, unP, view, depth, fit, light, lift, rrect, circle, ringAt, shift, hull, path, tint, lambert, slab, convex, roof, face, extrude, guide, grid, shadow, order, tilt, spring, bezier, ease, tween, stagger, selftest };
})();
if (typeof module !== 'undefined') module.exports = ISO;
