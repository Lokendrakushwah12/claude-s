// ugc-edit engine: timeline.js (edit.py build) -> VIDEO. A shot is footage through a camera that never sits still, or an
// insert. The overlay draws captions, titles and flashes. Sound events come from the same timeline, so cues can't drift.
// Project-specific inserts (a concept card for an abstract noun) go at the bottom: INSERTS.<kind> + SOUNDS.<kind>.
const E = window.EDIT, FPS = E.fps;
const B = { accent: '#FF5A36', ink: '#FFFFFF', ground: '#121519', font: 'Inter Tight', ui: 'Inter', mono: 'JetBrains Mono', ...E.brand };
Object.assign(TYPE, { display: B.font, ui: B.ui, mono: B.mono, weight: 800, track: -0.035 });
const PRESET = {
  creator: { captions: true, cutSounds: true, bed: true, lufs: -14 },   // talking head / podcast (group A)
  tutorial: { captions: false, cutSounds: false, bed: false, lufs: -16 }, // screen recording + dry VO (group D)
}[E.preset || 'creator'];
const pad4 = k => String(k + 1).padStart(4, '0'), frameOf = (s, t) => clamp(Math.floor((t - s.out0) * FPS + 1e-6), 0, s.n - 1);
const phraseAt = t => E.phrases.find(p => t >= p.start && t < p.end);

// ---- frames: pre-extracted JPEGs; seek(t) awaits their decode (render.mjs evaluates with awaitPromise) ----
const IM = new Map(), GOT = {};
function load(src) {
  if (!IM.has(src)) {
    const im = new Image(); im.src = src;
    IM.set(src, im.decode().then(() => (GOT[src] = im), () => (console.warn('missing frame', src), null)));
    if (IM.size > 240) { const k = IM.keys().next().value; IM.delete(k); delete GOT[k]; }
  }
  return IM.get(src);
}
function needs(t) {
  const out = [];
  for (const s of E.shots) if (t >= s.out0 && t < s.out1) {
    if (s.kind === 'cam') { const k = pad4(frameOf(s, t)); out.push(s.frames + k + '.jpg'); if (s.matte) out.push(s.frames + 'm' + k + '.jpg'); }
    if (s.insert?.kind === 'rec') out.push(s.frames + pad4(recFrame(s, t)) + '.jpg');
  }
  return out;
}
const drawAll = seek;
window.seek = async t => { await Promise.all(needs(t).map(load)); for (let k = 1; k <= 4; k++) needs(t + k / FPS).forEach(load); drawAll(t); };

// ---- footage: zoom-settle on entry, a lateral slide, a keyword pull-back or a push; type behind the subject ----
let behindAt = -1;
function alphaOf(img) { // grey matte (white = subject) -> alpha, for type.js behind()
  const [cv, x] = scratch('matteA', img.width, img.height); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height); for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = d.data[i];
  x.putImageData(d, 0, 0); return cv;
}
function camGeom(s) { // the frame's box on the canvas and the camera move: shared by the drawing and the face-safe captions
  const ph = E.phrases[s.phrase], o = { z0: 1.35, tau: 0.4, ax: 0.5, ay: 0.4, slide: (s.i % 2 ? -1 : 1) * 0.02, ...ph };
  if (s.jump) o.z0 = Math.max(o.z0, 1.25); // a jump cut re-punches, so the cut reads as intended
  const zb = 1 + 2 * Math.abs(o.slide) * (s.out1 - s.out0) + 0.02, sc = Math.max(W / s.fw, H / s.fh) * zb; // overscan: the slide never shows an edge
  return { box: [(W - s.fw * sc) / 2, (H - s.fh * sc) / 2, s.fw * sc, s.fh * sc],
    cam: { z0: o.z0, tau: o.tau, ax: o.ax, ay: o.ay, slide: o.slide, kw: ph.pull && ph.kw ? ph.kw.t - s.out0 : undefined, kwZ: 1.2, push: ph.push != null && ph.push !== false ? +ph.push : undefined, pushZ: 0.18, pushDur: s.out1 - s.out0 } };
}
function camShot(c, t, s) {
  const ph = E.phrases[s.phrase], k = pad4(frameOf(s, t)), img = GOT[s.frames + k + '.jpg']; if (!img) return;
  const { box, cam: co } = camGeom(s);
  c.save();
  shotCam(c, t - s.out0, co);
  const m = s.matte && ph.behind && ph.kw && t >= ph.kw.t && GOT[s.frames + 'm' + k + '.jpg'];
  if (m) { behind(c, img, alphaOf(m), cc => { cc.save(); cc.setTransform(1, 0, 0, 1, 0, 0); keyword(cc, t, ph); cc.restore(); }, box); behindAt = t; }
  else c.drawImage(img, ...box);
  c.restore();
}

// ---- captions: a small lead-in line typed on the word onsets, and ONE hot keyword per phrase ----
const clean = w => w.toLowerCase().replace(/[^\w'?]/g, '');
function lead(c, t, ph) {
  const ws = ph.words.map(w => ({ w: clean(w.w), t: w.t })).filter(w => w.w), gap = 0.32;
  const width = sz => ws.reduce((a, w) => a + tw(c, w.w, sz, 500, TYPE.ui, -0.01), 0) + sz * gap * (ws.length - 1);
  const size = Math.min(46 * S, 46 * S * (0.88 * W) / width(46 * S)), frame = 2 / FPS;
  leadIn(c, ws, W / 2, H * ((ph.leadY ?? (ph.behind ? 0.48 : 0.43)) + (ph.ldy ?? ph.dy ?? 0)), t, ph.end - ws.length * frame, { size, gap, frame, align: 'center', font: TYPE.ui });
}
function keyword(c, t, ph) {
  const kw = ph.kw; if (!kw || t < kw.t) return;
  const size = Math.min(0.24 * W, (0.86 * W * 100) / tw(c, kw.w, 100, 800)), n = NUM.exec(kw.w), u = clamp((t - kw.t) / COUNT);
  const text = n && u < 1 ? (+n[1] * ease.out(u)).toFixed(n[1].includes('.') ? 1 : 0) + n[2] : kw.w; // a number counts up as it lands
  hotWord(c, text, W / 2, H * ((ph.kwY ?? (ph.behind ? 0.42 : 0.56)) + (ph.dy || 0)), t - kw.t, { size, weight: 800, hot: B.accent, cold: B.ink, align: 'center', ...(ph.graphic ? { slide: 0.18, from: 0.5 } : {}) }); // a graphic keyword slams on its boom
}
const NUM = /^(\d+(?:\.\d+)?)([k%x+]?)$/, COUNT = 0.4;
// ---- face-safe captions: the lead-in + keyword block moves off the face (after kurbaitaev/ghost-editor's safezone.mjs, MIT).
// The face box (src/<cam>.face.json, through this shot's camera) is sampled every 0.1 s of a phrase; the block stays where the
// last phrase had it if that's clear, else goes to the house spot, below the chin, above the head, or as low as the platform UI
// allows. A behind-the-subject keyword stays on the head; only its lead-in line moves (above the head first, so it reads first).
// Phrases with an explicit leadY/kwY are left alone.
const SAFE = [0.14, 0.76]; // the block's limits as fractions of H: the platform's top bar and caption/buttons area
function faceOnScreen(s, t) {
  let f = null, d = 0.6; for (const x of s.face || []) if (Math.abs(x[0] - (t - s.out0)) < d) { d = Math.abs(x[0] - (t - s.out0)); f = x; }
  if (!f) return null;
  const { box, cam: co } = camGeom(s), [, x] = scratch('camT', 8, 8); shotCam(x, t - s.out0, co); const m = x.getTransform();
  const y = v => m.transformPoint(new DOMPoint(box[0] + 0.5 * box[2], box[1] + v * box[3])).y / H; return [y(f[2]), y(f[4])];
}
function placeCaptions() {
  let prev = null;
  for (const p of E.phrases) {
    if (p.leadY != null || p.kwY != null || p.caption === false) { prev = null; continue; }
    const B = !!p.behind, top0 = (B ? 0.48 : 0.43) - 0.035, h = (p.kw && !B ? 0.56 + 0.03 : top0 + 0.047) - top0; let ft = 1, fb = 0;
    for (let t = p.start; t < p.end; t += 0.1) { const s = E.shots.find(s => t >= s.out0 && t < s.out1), f = s?.kind === 'cam' && faceOnScreen(s, t); if (f) { ft = Math.min(ft, f[0]); fb = Math.max(fb, f[1]); } }
    if (ft >= fb) { p.dy = 0; prev = top0; continue; } // no face seen (an insert, or a missed detection): the house spot
    const ok = y => y != null && y >= SAFE[0] && y + h <= SAFE[1] && (y + h <= ft - 0.015 || y >= fb + 0.015);
    const y = (B ? [top0, ft - 0.02 - h, fb + 0.02] : [prev, top0, fb + 0.02, ft - 0.02 - h]).find(ok) ?? (B ? top0 : SAFE[1] - h);
    p[B ? 'ldy' : 'dy'] = +(y - top0).toFixed(4); p.face = [+ft.toFixed(3), +fb.toFixed(3)]; prev = B ? null : y;
  }
}
function title(c, t, ph) { // chapter title (tutorial bumpers): x 6 %, y 85 %, 0.25 s fades
  const a = prog(t, ph.start, ph.start + 0.25) * (1 - prog(t, ph.end - 0.25, ph.end)), size = 56 * S, w = tw(c, ph.title, size, 600, TYPE.display, -0.02);
  c.save(); c.globalAlpha = a * 0.72; rrect(c, W * 0.06 - size * 0.45, H * 0.85 - size * 1.05, w + size * 0.9, size * 1.45, size * 0.3); c.fillStyle = '#000'; c.fill(); c.restore(); // a plate: titles sit on heads or on white UI
  word(c, ph.title, W * 0.06, H * 0.85, { size, weight: 600, color: B.ink, alpha: a, track: -0.02 });
}

// ---- inserts ----
const MEASURE = scratch('measure', 8, 8)[1];
const INSERTS = {
  card(c, t, s, o) { // a word or two on the brand ground: the plainest concept insert
    bg(c, o.ground || B.ground); const u = t - s.out0, size = Math.min(0.2 * W, (0.84 * W * 100) / tw(c, o.title, 100, 800));
    glowIn(c, o.title, W / 2, H * 0.5, u, { size, weight: 800, color: B.ink, align: 'center' });
    if (o.sub) word(c, o.sub, W / 2, H * 0.5 + size * 0.7, { size: 40 * S, weight: 500, font: TYPE.ui, color: B.accent, align: 'center', alpha: prog(u, 0.2, 0.45) });
  },
  screen(c, t, s, o) { // a UI acted out on the words: types, the pointer clicks on o.clickOn, results blur in; push + depth of field
    const u = t - s.out0, w = W * 0.9, x = (W - w) / 2, y = H * (o.y ?? 0.1), si = screenTimes(s, o), f = si.first, fx = x + f.x + f.w / 2, fy = y + f.y + f.h / 2;
    bg(c, B.ground); grid(c, B.ground, 'rgba(255,255,255,0.045)', 60 * S);
    c.save(); cam(c, 1 + 0.22 * ease.in(clamp((u - si.tRes + 0.1) / 1.2)), fx, fy);
    screenInsert(c, x, y, w, u, { size: 44 * S, ...o, cps: si.cps, accent: B.accent, ink: '#121212' }); c.restore();
    if (u > si.tRes) dof(c, fy, 0.06 * H, { blur: 7 * S * prog(u, si.tRes, si.tRes + 0.4), vignette: 0.3 });
  },
  montage(c, t, s, o) { // B&W flash montage, 1-3 frame shots; kept dark-on-dark so it doesn't strobe
    s.mf ??= montageFrames(Math.ceil((s.out1 - s.out0) * FPS), o.seed || 3);
    const i = cutIndex(t, s.out0, s.mf, FPS), items = o.items || ['01', '02', '03'], it = items[i % items.length], r = rng(i * 17 + 3);
    c.save(); c.filter = MONTAGE; bg(c, ['#101010', '#1c1c1c', '#262626'][i % 3]);
    c.translate(W / 2 + (r() - 0.5) * W * 0.2, H * 0.27 + (r() - 0.5) * H * 0.08); c.rotate((r() - 0.5) * 0.08);
    (MONTAGE_SLATES[i % MONTAGE_SLATES.length])(c, it, r, o); c.restore();
  },
  rec(c, t, s, o) { // tutorial: the recording in a window on the brand ground; framings switch with a 4-6 frame spring zoom
    bg(c, B.ground); const g = c.createRadialGradient(W * 0.8, H * 0.1, 0, W * 0.8, H * 0.1, W * 0.9); g.addColorStop(0, B.accent + '38'); g.addColorStop(1, B.accent + '00'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const img = GOT[s.frames + pad4(recFrame(s, t)) + '.jpg'], R = recRect(s), v = recView(s, t);
    c.save(); c.translate(W / 2, H / 2); c.scale(v.z, v.z); c.translate(-v.x, -v.y);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 60 * S; c.shadowOffsetY = 20 * S; rrect(c, R.x, R.y, R.w, R.h, 12 * S); c.fillStyle = '#000'; c.fill(); c.restore();
    c.save(); rrect(c, R.x, R.y, R.w, R.h, 12 * S); c.clip(); if (img) c.drawImage(img, R.x, R.y, R.w, R.h); c.restore(); c.restore();
    if (!s.cursor) return; // the cursor, from the recorder's log: oversized (~10 % of H in a punch-in), click disc under the tip
    const m = s.cursor.moves[clamp(Math.round(recSrc(s, t) * FPS), 0, s.cursor.moves.length - 1)], P = recPt(s, v, m.x, m.y);
    for (const k of s.clicks) clickDisc(c, ...recPt(s, v, ...k.at), t - k.t, { r: 0.045 * H, dur: 0.4 });
    const ph = 0.055 + 0.045 * clamp((v.z - 1) / 1.2), down = s.clicks.some(k => t >= k.t && t < k.t + 2 / FPS);
    pointer(c, P[0], P[1], (ph * H) / (40 * S) * (down ? 0.9 : 1), { fill: '#ffffff', stroke: '#111111' });
  },
  end(c, t, s, o) { // brand end card
    bg(c, o.ground || B.ground); const u = t - s.out0, size = Math.min(0.2 * W, (0.7 * W * 100) / tw(c, o.text, 100, 800));
    glowIn(c, o.text, W / 2, H * 0.5, u, { size, weight: 800, color: B.ink, align: 'center' });
    c.fillStyle = B.accent; c.beginPath(); c.arc(W / 2 + tw(c, o.text, size, 800) / 2 + size * 0.14, H * 0.5 - size * 0.06, size * 0.07 * Math.max(0, ease.back(prog(u, 0.12, 0.4))), 0, 7); c.fill();
    if (o.sub) word(c, o.sub, W / 2, H * 0.5 + size * 0.62, { size: 42 * S, weight: 500, font: TYPE.ui, color: '#9aa0a6', align: 'center', alpha: prog(u, 0.3, 0.55) });
  },
};
const MONTAGE_SLATES = [ // drawn b-roll for the montage: a big number, a calendar being crossed off, a bar of commits
  (c, it, r) => { word(c, it, 0, 0, { size: 330 * S, weight: 800, color: '#fff', align: 'center' }); ui(c, 'WEEK', 0, -300 * S, { font: TYPE.mono, size: 34 * S, color: '#aaa', align: 'center' }); },
  (c, it, r) => { const n = 35, cw = 104 * S, x0 = -3.5 * cw, y0 = -2.5 * cw, off = Math.floor(r() * 30); c.strokeStyle = '#777'; c.lineWidth = 2 * S;
    for (let k = 0; k < n; k++) { const x = x0 + (k % 7) * cw, y = y0 + Math.floor(k / 7) * cw; c.strokeRect(x, y, cw, cw); if (k < off) { c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(x + 18, y + 18); c.lineTo(x + cw - 18, y + cw - 18); c.moveTo(x + cw - 18, y + 18); c.lineTo(x + 18, y + cw - 18); c.stroke(); c.strokeStyle = '#777'; } } },
  (c, it, r) => { for (let k = 0; k < 26; k++) { const h = (40 + r() * 260) * S; c.fillStyle = k % 5 ? '#bbb' : '#fff'; c.fillRect(-W * 0.4 + k * W * 0.031, 150 * S - h, W * 0.022, h); } ui(c, 'commits / week', -W * 0.4, 210 * S, { font: TYPE.mono, size: 30 * S, color: '#aaa' }); },
];
function screenTimes(s, o) { // screenInsert's own clock, measured once; cps is set so the click lands on o.clickOn
  if (s.si) return s.si; const ws = s.phrases.flatMap(i => E.phrases[i].words), on = ws.find(w => clean(w.w) === clean(o.clickOn || ''));
  const cps = on ? clamp(o.query.length / Math.max(0.3, on.t - s.out0 - 0.55), 8, 40) : o.cps || 14;
  return (s.si = { cps, ...screenInsert(MEASURE, 0, 0, W * 0.9, 0, { size: 44 * S, ...o, cps }) });
}
// tutorial maths: each phrase maps its time onto the recording (src [a, b], or [[u, sec], ...] with u 0..1 through the phrase);
// no src = carry on at 1x. frame 'full' = the window at 82 % of the width; {zoom, at: [x, y]} = a punch-in on that point (0..1).
function recSrc(s, t) {
  let carry = 0;
  for (const i of s.phrases) {
    const p = E.phrases[i], o = p.insert || {}, u = (Math.min(t, p.end) - p.start) / (p.end - p.start);
    const map = !o.src ? [[0, carry], [1, carry + p.end - p.start]] : typeof o.src[0] === 'number' ? [[0, o.src[0]], [1, o.src[1]]] : o.src;
    const at = x => { const k = Math.max(1, map.findIndex(m => m[0] >= x)); const [a, b] = [map[k - 1], map[k] || map[k - 1]]; return a[1] + (b[1] - a[1]) * clamp((x - a[0]) / ((b[0] - a[0]) || 1)); };
    if (t < p.end || i === s.phrases.at(-1)) return at(clamp(u)); carry = at(1);
  }
}
const recFrame = (s, t) => clamp(Math.round(recSrc(s, t) * FPS), 0, s.n - 1);
function recRect(s) { let w = W * 0.82, h = (w * s.fh) / s.fw; if (h > H * 0.88) { h = H * 0.88; w = (h * s.fw) / s.fh; } return { x: (W - w) / 2, y: (H - h) / 2, w, h }; }
function recView(s, t) {
  const R = recRect(s), key = i => { const f = E.phrases[i].insert?.frame; if (!f || f === 'full') return [1, W / 2, H / 2];
    const inside = (v, a, len, half) => (len > 2 * half ? clamp(v, a + half, a + len - half) : a + len / 2); // a punch-in never shows past the window
    return [f.zoom, inside(R.x + f.at[0] * R.w, R.x, R.w, W / 2 / f.zoom), inside(R.y + f.at[1] * R.h, R.y, R.h, H / 2 / f.zoom)]; };
  const ks = j => s.phrases.map((i, n) => [n ? E.phrases[i].start : s.out0 - 1, key(i)[j]]);
  return { z: track(t, ks(0), 900, 36), x: track(t, ks(1), 900, 36), y: track(t, ks(2), 900, 36) }; // ~10 % overshoot, settled in ~5 frames
}
const recPt = (s, v, x, y) => { const R = recRect(s); return [W / 2 + (R.x + (x / s.cursor.w) * R.w - v.x) * v.z, H / 2 + (R.y + (y / s.cursor.h) * R.h - v.y) * v.z]; };

// ---- sound: group A's grammar through sfx.py autocue (events) plus a few direct cues ----
const SOUNDS = {
  screen(s, o, ev, sfx) { const si = screenTimes(s, o); ev.push({ t: s.out0, kind: 'type', text: o.query, cps: si.cps }); sfx.push([s.out0 + si.tClick, 'click', 1], [s.out0 + si.tRes, 'click_cluster', 0.8]); },
  rec(s, o, ev, sfx) { s.clicks.forEach(k => sfx.push([+k.t.toFixed(3), 'click', 0.6])); },
  end(s, o, ev, sfx) { sfx.push([s.out0 + 0.05, 'sting', 0.8]); },
};
function sounds() {
  const ev = [], sfx = [];
  E.shots.forEach(s => { if (s.insert?.kind === 'rec' && s.cursor) { // when each logged click shows on the output clock
    s.clicks = []; for (const c0 of s.cursor.clicks) for (let f = Math.round(s.out0 * FPS); f < s.out1 * FPS; f++) if (recSrc(s, f / FPS) >= c0) { const m = s.cursor.moves[Math.round(c0 * FPS)] || s.cursor.moves.at(-1); if (f > s.out0 * FPS) s.clicks.push({ t: f / FPS, at: [m.x, m.y] }); break; } } });
  if (PRESET.cutSounds) {
    E.shots.forEach((s, i) => {
      const a = E.shots[i - 1], ph = E.phrases[s.phrase], t = s.out0; if (!a) return;
      if (ph && (ph.flash || ph.graphic) && !s.jump) return; // the flash or the stat keyword is this cut's sound
      if (s.insert?.kind === 'montage') return ev.push({ t, kind: 'montage_in' });
      if (a.insert?.kind === 'montage') return ev.push({ t, kind: 'montage_out' });
      ev.push({ t, kind: s.kind !== 'cam' || a.kind !== 'cam' ? 'cut_insert' : 'cut' });
    });
    for (const p of E.phrases) {
      if (p.kw && !p.insert) ev.push({ t: p.kw.t, kind: p.graphic ? 'keyword_stat' : 'keyword' });
      if (p.flash) ev.push({ t: p.start, kind: 'flash' });
      if (p.build) ev.push({ t: p.start, kind: 'build', dur: p.build === true ? 0.8 : p.build });
      if (p.hush) sfx.push([+p.end.toFixed(3), 'gap', 1, { dur: +(p.end - p.start).toFixed(3) }]); // the bed drops out before a payoff
    }
  }
  E.shots.forEach(s => s.insert && SOUNDS[s.insert.kind]?.(s, s.insert, ev, sfx));
  // a sound on a spoken word: onomatopoeia get theirs, and "sfx": {"word": "sound" | ["sound", gain], ...} on a phrase puts any sfx.py
  // sound on any of its words ("sfx": false: none). The idea is hassancs91/claude-youtube-editor's /suggest-sfx (MIT): sync to the word
  for (const p of E.phrases) {
    for (const w of p.sfx === false ? [] : p.words) { const v = p.sfx?.[clean(w.w)] ?? (PRESET.cutSounds && ONOMATOPOEIA[clean(w.w)]), [name, g = 1] = [].concat(v || []); if (name) sfx.push([+w.t.toFixed(3), name, g, { word: clean(w.w) }]); }
    if (p.kw && NUM.test(p.kw.w) && PRESET.cutSounds) sfx.push([+p.kw.t.toFixed(3), 'ratchet', 0.8, { n: 8, rate: 8 / COUNT }]); // ticks under the count-up
  }
  // autocue keeps one air sound per 0.4 s and the EARLIER wins, so a keyword just before a cut would silence the cut: the cut wins
  const cuts = E.shots.slice(1).map(s => s.out0), out = ev.filter(e => e.kind !== 'keyword' || !cuts.some(c => c > e.t && c - e.t < 0.45));
  out.forEach(e => (e.t = +e.t.toFixed(3)));
  return { ev: out, sfx };
}
const ONOMATOPOEIA = { boom: 'boom_sting', bang: 'boom_sting', kaboom: 'boom_sting', pow: 'boom_sting', click: 'click', clicked: 'click', snap: 'click',
  tap: 'click', pop: 'pop', popped: 'pop', ding: 'ui_blip', ping: 'ui_blip', beep: 'ui_blip', tick: 'tick', whoosh: 'whoosh', swoosh: 'swoosh', glitch: 'glitch' }; // creator preset only: "click" is every other word in a tutorial
function bed() { // a beatless-feeling pad: one chord per ~3.6 s bar, the end card on a bar line, a riser into it
  if (E.bed !== undefined && E.bed !== null) return E.bed; if (!PRESET.bed) return null;
  const end = E.shots.find(s => s.kind === 'end')?.out0 ?? E.duration, bars = Math.max(1, Math.round(end / 3.6));
  return { bpm: +((240 * bars) / end).toFixed(5), chords: [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 60]], sections: [[0, 'intro'], ...(end < E.duration ? [[end, 'outro']] : [])] };
}

window.VIDEO = {
  duration: E.duration, audio: 'audio.wav', vo: 'dialogue.wav', lufs: PRESET.lufs,
  fonts: [`${B.font}:wght@500;600;800`, `${B.ui}:wght@400;500;600`, `${B.mono}:wght@500`],
  scenes: E.shots.map(s => ({ start: s.out0, end: s.out1, draw: (c, p, t) => (s.kind === 'cam' ? camShot(c, t, s) : INSERTS[s.insert.kind](c, t, s, s.insert)) })),
  overlay(c, t) {
    const ph = phraseAt(t);
    if (ph && PRESET.captions && ph.caption !== false) { lead(c, t, ph); if (behindAt !== t) keyword(c, t, ph); }
    if (ph?.title) title(c, t, ph);
    for (const p of E.phrases) if (p.flash) flash(c, t, p.start, { fps: FPS });
    behindAt = -1;
  },
};
// ---- project inserts (this video only) ----

if (PRESET.captions) placeCaptions();
const SND = sounds(); Object.assign(VIDEO, { events: SND.ev, sfx: SND.sfx, bed: bed(), captions: E.phrases.map(p => [p.i, p.dy || 0, p.face || null]) });
