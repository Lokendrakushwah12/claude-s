// ugc-edit engine: timeline.js (edit.py build) -> VIDEO. A shot is footage through a camera that never sits still, or an
// insert. The overlay draws captions, titles and flashes. Sound events come from the same timeline, so cues can't drift.
// Project-specific inserts (a concept card for an abstract noun) go at the bottom: INSERTS.<kind> + SOUNDS.<kind>.
//
// Phrase fields added from the 2026-10-11 references (the product mix, reel grammars, riso, collections):
//   ui: {name, handle, img, title, text, stat, label, rows, button, glow, takeover}   a proof card in the face-free zone (under the
//        chin in 9:16, the free side in 16:9), lead-in line above it, no hot keyword (the card is the keyword); a light sweep crosses
//        it; rows tick on, the stat counts up. takeover: true = it grows into the next phrase's {kind: "app"} insert (same card)
//   pops: ["Ab", {text, img}, ...]   chips pop round the head 80 ms apart (a logo cloud), each with a bloop
//   out: "portal" | {kind: "portal", at: [x, y]}   a circle of the next shot's ground grows out of the chest (or at) into the cut
//   window: true    the footage shrinks to a window on paper and each spoken word stands giant behind it (no other captions)
//   lockup: true    a title lockup: the words before the keyword small above it (split left/right), the rest small below; a glint
//   focus: true     the shot opens from a 14 px blur (hooks);  rack: true  it blurs out over its last 0.15 s
//   laugh: "type"   a kept laugh is typed huge across the frame, a letter every 2 frames (needs the laugh in the phrase's piece)
//   caption: "word" one word on screen at a time, hard on and off (a reel's calm body); top-level "captions": "word" sets it for all
// Phones and code (2026-10-11b refs: phone mockups, code on screen; lib.js phone3d / codeBlock, a real 3D phone through Three.js):
//   app inserts sit in a 3D phone by default (device: "card" = the flat card): it rises in (or the takeover card lands on its screen),
//        drifts, a touch disc taps the button, and the toast lifts out of the phone as a crisp card while the phone defocuses;
//        list: ["Title|sub", ...] rows and tabs: [...] fill the screen under the card
//   phone: true | "in" | "out"  on a cam phrase: the footage plays inside a phone as a post (handle, caption, a heart that pops on the
//        keyword, post: its caption) over a blurred copy of itself; "in" pushes through the screen to full frame (1:1 at the cut), "out" pulls back
//   insert {kind: "code", src, hl, hlOn, title, cps, result}: an editor types src on the words (a newline and its indent land as one step),
//        then line hl lights up on the word hlOn and result types as a status row; end: {..., cta} adds a call-to-action pill
// Inserts added: app (the takeover's card, full frame, with a click), stat {value, label, from, bar}, chapter {n, over, word, sub},
//   posters {items: [{title, sub, big}], hold: 0.4}, collection {style: stamps|polaroids|grid|mosaic, images | items, title, step}.
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
    if (s.insert?.images) out.push(...s.insert.images);
  }
  for (const p of E.phrases) if (t >= p.start - 0.3 && t < p.end) { if (p.ui?.img) out.push(p.ui.img); for (const x of p.pops || []) if (x.img) out.push(x.img); }
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
  if (ph.window) return windowShot(c, t, s, ph, img);
  if (ph.phone && phoneShot(c, t, s, ph, img)) return;
  const { box, cam: co } = camGeom(s);
  c.save();
  const fb = (ph.focus && !s.jump ? 14 * S * (1 - ease.out(prog(t, s.out0, s.out0 + 0.25))) : 0) + (ph.rack ? 18 * S * ease.in(prog(t, s.out1 - 0.15, s.out1)) : 0);
  if (fb > 0.3) c.filter = `blur(${fb}px)`; // hooks open from a blur (refs #40, #44); rack: a blur-out into the next shot
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
  const cx = ph.cx ?? 0.5, size = Math.min(46 * S, 46 * S * (0.88 * W * 2 * Math.min(cx, 1 - cx)) / width(46 * S)), frame = 2 / FPS; // cx: the block's centre (16:9 phones: left of it)
  leadIn(c, ws, W * cx, H * (ph.leadAt ?? (ph.leadY ?? (ph.behind ? 0.48 : 0.43)) + (ph.ldy ?? ph.dy ?? 0)), t, ph.end - ws.length * frame, { size, gap, frame, align: 'center', font: TYPE.ui });
}
function lockup(c, t, ph) { // ref #44's hook title: the words before the keyword small above it (split to its edges), the rest under it
  const ws = ph.words.map(w => ({ w: clean(w.w), t: w.t })).filter(w => w.w), k = ph.kw.k, y = H * ((ph.kwY ?? 0.56) + (ph.dy || 0));
  const size = Math.min(0.24 * W, (0.86 * W * 100) / tw(c, ph.kw.w, 100, 800)), half = tw(c, ph.kw.w, size, 800) / 2, sm = 40 * S, frame = 2 / FPS;
  const pre = ws.slice(0, k), post = ws.slice(k + 1), m = Math.ceil(pre.length / 2), o = { size: sm, weight: 700, gap: 0.3, frame, font: TYPE.ui }, out = ph.end - ws.length * frame;
  leadIn(c, pre.slice(0, m), W / 2 - half, y - size * 0.8, t, out, { ...o, align: 'left' });
  leadIn(c, pre.slice(m), W / 2 + half, y - size * 0.8, t, out, { ...o, align: 'right' });
  leadIn(c, post, W / 2 + half, y + sm * 1.35, t, out, { ...o, align: 'right' });
}
function oneWord(c, t, ph) { // a reel's calm body (ref #44): the word being said, alone, hard on and off; the keyword 1.25x (not coloured:
  const i = ph.words.findLastIndex(w => t >= w.t); if (i < 0) return; const w = ph.words[i], k = ph.kw && i === ph.kw.k; // an accent on dark clothes vanished)
  c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 18 * S; c.shadowOffsetY = 3 * S;
  word(c, w.w.replace(/[.,;:!?]+$/, ''), W / 2, H * (0.6 + (ph.dy || 0)), { size: 76 * S * (k ? 1.25 : 1), weight: k ? 800 : 700, font: TYPE.ui, track: -0.01, align: 'center', color: B.ink });
  c.restore();
}
const wordStyle = ph => (ph.caption ?? E.captions) === 'word';
function keyword(c, t, ph) {
  const kw = ph.kw; if (!kw || t < kw.t) return;
  const cx = ph.cx ?? 0.5, size = Math.min(0.24 * W * 2 * Math.min(cx, 1 - cx), cx === 0.5 ? 1e9 : 0.2 * H, (0.86 * W * 2 * Math.min(cx, 1 - cx) * 100) / tw(c, kw.w, 100, 800)), n = NUM.exec(kw.w), u = clamp((t - kw.t) / COUNT);
  const text = n && u < 1 ? (+n[1] * ease.out(u)).toFixed(n[1].includes('.') ? 1 : 0) + n[2] : kw.w; // a number counts up as it lands
  const y = H * ((ph.kwY ?? (ph.behind ? 0.42 : 0.56)) + (ph.dy || 0)), o = { size, weight: 800, hot: B.accent, cold: ph.lockup ? B.accent : B.ink, align: 'center', ...(ph.graphic || ph.lockup ? { slide: 0.18, from: 0.5 } : {}) };
  hotWord(c, text, W * cx, y, t - kw.t, o); // a graphic keyword slams on its boom; a lockup keyword stays in the accent
  const g = prog(t, kw.t + GLINT, kw.t + GLINT + 0.35); if (!ph.lockup || g <= 0 || g >= 1) return;
  const [cv, x] = scratch('glint'); hotWord(x, text, W / 2, y, t - kw.t, { ...o, shadow: null }); x.globalCompositeOperation = 'source-in'; // a specular glint sweeps it (ref #44)
  const gx = lerp(-0.3, 1.3, ease.inOut(g)) * W, gr = x.createLinearGradient(gx - size, y - size, gx + size, y); ['#ffffff00', '#ffffffdd', '#ffffff00'].forEach((col, k) => gr.addColorStop(k / 2, col));
  x.fillStyle = gr; x.fillRect(0, 0, W, H); c.drawImage(cv, 0, 0);
}
const GLINT = 0.5;
const NUM = /^(\d+(?:\.\d+)?)([k%x+]?)$/, COUNT = 0.4;
const NOCAP = new Set(['chapter', 'stat', 'app', 'posters', 'collection']); // inserts that carry their own type: no captions unless caption: true
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
    if (p.leadY != null || p.kwY != null || p.caption === false || p.ui || p.window) { prev = null; continue; }
    const B = !!p.behind && !p.lockup, t0 = (B ? 0.48 : 0.43) - 0.035, [top0, h] = wordStyle(p) ? [0.565, 0.045] : p.lockup && p.kw ? [0.445, 0.15] : [t0, (p.kw && !B ? 0.59 : t0 + 0.047) - t0]; let ft = 1, fb = 0;
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

// ---- the product mix (refs #25, #40): a proof card beside the speaker, a takeover into the full screen, a portal, a logo cloud ----
const CREAM = '#F3F0E8', INK = '#141414', MUTE = '#8A8A8A';
const ON_ACCENT = (([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? INK : '#ffffff')(rgbOf(B.accent)); // white on an amber button was 1.9:1
function faceBox(s, t) { // the face box through the shot's camera, as fractions of the frame [x0, y0, x1, y1]; null if none was seen
  let f = null, d = 0.6; for (const x of s?.face || []) if (Math.abs(x[0] - (t - s.out0)) < d) { d = Math.abs(x[0] - (t - s.out0)); f = x; }
  if (!f) return null; const { box, cam: co } = camGeom(s), [, x] = scratch('camT', 8, 8); shotCam(x, t - s.out0, co); const m = x.getTransform();
  const p = (u, v) => m.transformPoint(new DOMPoint(box[0] + u * box[2], box[1] + v * box[3])); const a = p(f[1], f[2]), b = p(f[3], f[4]);
  return [a.x / W, a.y / H, b.x / W, b.y / H];
}
const shotAt = t => E.shots.find(s => t >= s.out0 && t < s.out1);
function wrap(c, str, maxW, size, weight = 500) { const out = [''];
  for (const w of str.split(' ')) { const tryL = out.at(-1) ? out.at(-1) + ' ' + w : w; if (tw(c, tryL, size, weight, TYPE.ui, -0.01) > maxW && out.at(-1)) out.push(w); else out[out.length - 1] = tryL; } return out; }
// A UI card in the brand's own terms, drawn at width w (laid out at 760 px and scaled). u = seconds since it appeared. Returns its height
// and the button box. o: {img | name, handle} or {title} header, text, stat + label (counts up under a marker), rows (tick on), button.
function uiCard(c, x, y, w, u, o, measure = false) {
  const k = w / 760, pad = 44 * k, lines = o.text ? wrap(c, o.text, w - pad * 2, 36 * k) : [], rows = o.rows || [];
  const h = pad * 2 + 80 * k + (lines.length ? lines.length * 50 * k + 24 * k : 0) + (o.stat ? 150 * k : 0) + rows.length * 76 * k + (o.button ? 110 * k : 0);
  const btn = o.button ? [x + w - pad - tw(c, o.button, 34 * k, 600, TYPE.ui, 0) - 70 * k, y + h - pad - 76 * k, tw(c, o.button, 34 * k, 600, TYPE.ui, 0) + 70 * k, 76 * k] : null;
  if (measure) return { h, btn };
  c.save(); c.shadowColor = 'rgba(0,0,0,0.28)'; c.shadowBlur = 60 * k; c.shadowOffsetY = 18 * k; rrect(c, x, y, w, h, 34 * k); c.fillStyle = '#ffffff'; c.fill(); c.restore();
  if (o.glow !== false) { c.save(); c.shadowColor = B.accent; c.shadowBlur = 40 * k; rrect(c, x, y, w, h, 34 * k); c.strokeStyle = B.accent + 'aa'; c.lineWidth = 3 * k; c.stroke(); c.restore(); }
  let cy = y + pad;
  if (o.title) { [0, 1, 2].forEach(i => { c.beginPath(); c.arc(x + pad + 14 * k + i * 34 * k, cy + 30 * k, 11 * k, 0, 7); c.fillStyle = ['#e5e5e5', '#d9d9d9', '#cfcfcf'][i]; c.fill(); });
    word(c, o.title, x + pad + 130 * k, cy + 42 * k, { size: 36 * k, weight: 700, font: TYPE.ui, track: -0.01, color: INK }); }
  else { const r = 38 * k, ax = x + pad + r, ay = cy + r; c.save(); c.beginPath(); c.arc(ax, ay, r, 0, 7); c.clip();
    if (o.img && GOT[o.img]) cover(c, GOT[o.img], ax - r, ay - r, 2 * r, 2 * r); else { c.fillStyle = B.accent; c.fillRect(ax - r, ay - r, 2 * r, 2 * r); word(c, (o.name || '?')[0], ax, ay + r * 0.36, { size: r, weight: 700, font: TYPE.ui, color: '#fff', align: 'center' }); }
    c.restore(); word(c, o.name || '', x + pad + 2 * r + 24 * k, cy + 34 * k, { size: 36 * k, weight: 700, font: TYPE.ui, track: -0.01, color: INK });
    if (o.handle) word(c, o.handle, x + pad + 2 * r + 24 * k, cy + 74 * k, { size: 28 * k, weight: 400, font: TYPE.ui, color: MUTE }); }
  cy += 80 * k + 24 * k;
  lines.forEach((l, i) => word(c, l, x + pad, cy + 36 * k + i * 50 * k, { size: 36 * k, weight: 500, font: TYPE.ui, track: -0.01, color: INK })); if (lines.length) cy += lines.length * 50 * k + 24 * k;
  if (o.stat) { const m = /^([^\d]*)([\d,.]+)(.*)$/.exec(o.stat) || ['', '', o.stat, ''], n = +m[2].replace(/,/g, ''), p = ease.out(prog(u, 0.25, 1.1)), sz = 84 * k;
    const str = m[1] + (isNaN(n) ? m[2] : Math.round(n * p).toLocaleString('en-US')) + m[3], sw = tw(c, m[1] + m[2] + m[3], sz, 800, TYPE.display);
    c.fillStyle = B.accent + '40'; c.fillRect(x + pad - 8 * k, cy + 18 * k, (sw + 16 * k) * ease.out(prog(u, 0.2, 0.5)), sz * 0.95); // the marker sweeps first
    word(c, str, x + pad, cy + sz * 0.95, { size: sz, weight: 800, color: INK }); if (o.label) word(c, o.label, x + pad + sw + 22 * k, cy + sz * 0.95, { size: 34 * k, weight: 500, font: TYPE.ui, color: MUTE }); cy += 150 * k; }
  rows.forEach((r, i) => { const on = u >= rowAt(o, i), ry = cy + i * 76 * k; rrect(c, x + pad, ry + 14 * k, 44 * k, 44 * k, 12 * k);
    if (on) { c.fillStyle = B.accent; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 6 * k; c.beginPath(); c.moveTo(x + pad + 10 * k, ry + 37 * k); c.lineTo(x + pad + 19 * k, ry + 47 * k); c.lineTo(x + pad + 35 * k, ry + 26 * k); c.stroke(); }
    else { c.strokeStyle = '#d0d0d0'; c.lineWidth = 3 * k; c.stroke(); }
    word(c, r, x + pad + 68 * k, ry + 48 * k, { size: 34 * k, weight: 500, font: TYPE.ui, color: on ? INK : MUTE }); });
  if (btn) { const down = o.tClick != null && u >= o.tClick && u < o.tClick + 2 / FPS, done = o.tClick != null && u >= o.tClick + 0.08;
    c.save(); c.translate(btn[0] + btn[2] / 2, btn[1] + btn[3] / 2); if (down) c.scale(0.94, 0.94); rrect(c, -btn[2] / 2, -btn[3] / 2, btn[2], btn[3], btn[3] / 2); c.fillStyle = done ? mixHex(B.accent, '#000000', 0.2) : B.accent; c.fill();
    word(c, done && o.done ? o.done : o.button, 0, 12 * k, { size: 34 * k, weight: 600, font: TYPE.ui, track: 0, color: ON_ACCENT, align: 'center' }); c.restore(); }
  const sw = prog(u, 0.12, 0.62); if (sw > 0 && sw < 1) { c.save(); rrect(c, x, y, w, h, 34 * k); c.clip(); const gx = x - w * 0.3 + sw * w * 1.6, g = c.createLinearGradient(gx - 160 * k, y, gx + 160 * k, y + h * 0.3);
    ['#ffffff00', '#ffffffcc', '#ffffff00'].forEach((col, i) => g.addColorStop(i / 2, col)); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x, y, w, h); c.restore(); } // the light sweep (ref #40)
  return { h, btn };
}
const rowAt = (o, i) => (o.rowAt ?? 0.55) + i * 0.22;
function placeUI() { // each ui card goes where the face isn't: under the chin in 9:16 (above the head if the face sits low), the free side in 16:9
  for (const p of E.phrases) if (p.ui) {
    let f = null; for (let t = p.start; t < p.end; t += 0.1) { const b = faceBox(shotAt(t), t); if (b) f = f ? [Math.min(f[0], b[0]), Math.min(f[1], b[1]), Math.max(f[2], b[2]), Math.max(f[3], b[3])] : b; }
    const wide = W > H, w = wide ? W * 0.36 : W * 0.82, h = uiCard(MEASURE, 0, 0, w, 9, p.ui, true).h / H;
    let x = (W - w) / 2, y = Math.min(SAFE[1] - h, Math.max(0.42, (f ? f[3] : 0.42) + 0.07)); // room for the lead-in line between chin and card
    if (wide) { x = f && (f[0] + f[2]) / 2 < 0.5 ? W * 0.58 : W * 0.06; y = 0.5 - h / 2; } else if (f && y + h > SAFE[1] - 0.001 && f[1] - 0.04 - h > SAFE[0] + 0.05) y = f[1] - 0.04 - h;
    p.uiBox = [x, y * H, w]; p.leadAt = wide ? 0.82 : Math.max(SAFE[0] + 0.02, y - 0.018);
  }
}
const appRect = o => { const w = W * (W > H ? 0.5 : 0.9), h = uiCard(MEASURE, 0, 0, w, 9, o, true).h; return [(W - w) / 2, (H - h) / 2, w, h]; };
function appGround(c, a = 1, at, alpha = '30') { c.save(); c.globalAlpha *= a; bg(c, B.ground); const [gx, gy, gr, ga] = at ? [...at, alpha] : [W * 0.75, H * 0.12, W, '44'];
  const g = c.createRadialGradient(gx, gy, 0, gx, gy, gr); g.addColorStop(0, B.accent + ga); g.addColorStop(1, B.accent + '00'); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore(); } // at: [x, y, r] a glow behind a phone (a dark bezel vanished on the plain ground)
function uiOverlay(c, t, p) {
  const o = p.ui, u = t - p.start - (o.delay ?? 0.15); if (u < 0) return; const [x, y, w] = p.uiBox, h = uiCard(MEASURE, 0, 0, w, 9, o, true).h;
  const e = ease.spring(prog(u, 0, 0.5), 0.3), q = o.takeover ? ease.inOut(prog(t, p.end - 0.35, p.end)) : 0, out = o.takeover ? 0 : prog(t, p.end - 0.12, p.end);
  if (q > 0) appGround(c, q, isPhone(nextApp(p)) && nextApp(p).kind === 'app' ? [PHONE_L().x, PHONE_L().y - PHONE_L().h * 0.1, PHONE_L().h * 0.75] : undefined); // the takeover: over the app's own ground
  const big = { ...o, ...nextApp(p), rowAt: 1e9 }, hb = uiCard(MEASURE, 0, 0, w, 9, big, true).h, x0 = clamp(q / 0.3); // the app's rows tick after the cut
  const na = nextApp(p), [tx, ty, aw] = na.kind === 'app' && isPhone(na) ? phoneCardRect(big) : [W / 2, H / 2, appRect(big)[2]]; // onto the phone's screen
  if (q > 0 && na.kind === 'app' && isPhone(na)) phoneApp(c, p.end, E.shots.find(x => x.phrase === p.i + 1), na, { alpha: q, card: false });
  const cx = lerp(x + w / 2, tx, q), cy = lerp(y + h / 2, ty, q), sc = lerp(1, aw / w, q) * (0.92 + 0.08 * e);
  c.save(); c.globalAlpha *= clamp(e * 1.5) * (1 - out); c.translate(cx, cy + (1 - e) * 60 * S); c.scale(sc, sc);
  if (x0 < 1) { c.save(); c.globalAlpha *= 1 - x0; uiCard(c, -w / 2, -h / 2, w, u, o); c.restore(); }
  if (x0 > 0) { c.globalAlpha *= x0; uiCard(c, -w / 2, -hb / 2, w, u, big); } // it opens into the app as it flies
  c.restore();
}
const nextApp = p => (E.phrases[p.i + 1]?.insert?.kind === 'app' ? E.phrases[p.i + 1].insert : {});
const TINTS = () => [B.accent, mixHex(B.accent, '#ffffff', 0.45), mixHex(B.accent, '#000000', 0.35), '#E9E4D8', '#2B2B2B'];
function popsLayout(p) { // chips on an arc round the face (above and beside it, never below, where the captions go)
  if (p.popXY) return p.popXY; let f = null; for (let t = p.start; t < p.end; t += 0.1) f = f || faceBox(shotAt(t), t); f = f || [0.33, 0.18, 0.67, 0.42];
  const cx = (f[0] + f[2]) / 2, cy = (f[1] + f[3]) / 2, rx = (f[2] - f[0]) / 2 + 0.16, ry = (f[3] - f[1]) / 2 + 0.07 * (W / H) * 1.6, n = p.pops.length;
  return (p.popXY = p.pops.map((_, i) => { const a = Math.PI * (1.08 + 0.84 * (n > 1 ? i / (n - 1) : 0.5)) + (i % 2 ? 0.08 : -0.08);
    return [clamp(cx + rx * Math.cos(a) * (W > H ? H / W : 1), 0.08, 0.92), clamp(cy + ry * Math.sin(a), SAFE[0] + 0.03, SAFE[1] - 0.05)]; }));
}
const popAt = (p, i) => p.start + (p.popsAt ?? 0.1) + i * 0.08;
function popsOverlay(c, t, p) { // a logo cloud (ref #25): chips pop in 80 ms apart with a back ease, bob, and pop out at the phrase end
  popsLayout(p).forEach(([fx, fy], i) => {
    const it = typeof p.pops[i] === 'string' ? { text: p.pops[i] } : p.pops[i], q = ease.back(prog(t, popAt(p, i), popAt(p, i) + 0.24)) * (1 - prog(t, p.end - 0.12, p.end)); if (q <= 0) return;
    const z = 0.14 * Math.min(W, H) * 1.0, x = fx * W, y = fy * H + Math.sin(t * 2.2 + i) * 6 * S, tint = TINTS()[i % 5];
    c.save(); c.translate(x, y); c.scale(q, q); c.rotate((i % 2 ? 1 : -1) * 0.06); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 30 * S; c.shadowOffsetY = 10 * S;
    rrect(c, -z / 2, -z / 2, z, z, z * 0.24); c.fillStyle = '#ffffff'; c.fill(); c.shadowColor = 'transparent'; c.clip();
    if (it.img && GOT[it.img]) cover(c, GOT[it.img], -z * 0.4, -z * 0.4, z * 0.8, z * 0.8);
    else { rrect(c, -z * 0.36, -z * 0.36, z * 0.72, z * 0.72, z * 0.16); c.fillStyle = tint; c.fill(); word(c, it.text.slice(0, 2), 0, z * 0.13, { size: z * 0.36, weight: 800, color: tint === '#E9E4D8' ? INK : '#fff', align: 'center' }); }
    c.restore();
  });
}
function portalOverlay(c, t, p) { // a circle of the next shot's ground grows out of a point in the frame and becomes the cut (ref #25: the hand)
  const o = typeof p.out === 'string' ? { kind: p.out } : p.out, q = prog(t, p.end - (o.dur ?? 0.32), p.end) ** 2; if (q <= 0) return;
  const s = shotAt(p.end + 1e-3), f = o.at ? null : faceBox(shotAt(p.end - 0.01), p.end - 0.01), at = o.at || [f ? (f[0] + f[2]) / 2 : 0.5, Math.min(0.72, (f ? f[3] : 0.45) + 0.14)];
  const r = q * Math.hypot(W, H); c.save(); c.beginPath(); c.arc(at[0] * W, at[1] * H, r, 0, 7); c.fillStyle = groundOf(s); c.fill(); // from the chest, not the face:
  c.strokeStyle = B.accent; c.lineWidth = 8 * S; c.stroke(); c.restore(); // a dark disc on a face read as a censor blob
}
const groundOf = s => s?.insert?.ground || { collection: CREAM, stat: '#F1F0EC', posters: mixHex(B.ground, '#ffffff', 0.86), card: B.ground, chapter: B.ground, app: B.ground, end: B.ground }[s?.insert?.kind] || B.ground;

// ---- reel grammars (refs #28, #44): the clip window in giant type, a typed laugh ----
function windowShot(c, t, s, ph, img) { // the footage in a window on paper; each spoken word stands giant behind it, cropped by the frame
  const g = ph.window.ground || CREAM, i = ph.words.findLastIndex(w => t >= w.t), cur = i >= 0 ? clean(ph.words[i].w) : '';
  bg(c, g); if (cur) { const size = Math.min(0.5 * H, (1.12 * W * 100) / tw(c, cur, 100, 700)); word(c, cur, W / 2, H * 0.47 + size * 0.36, { size, weight: 700, color: mixHex(g, INK, 0.28), align: 'center', track: -0.05 }); }
  const u = t - s.out0, ww = W * (W > H ? 0.3 : 0.6), wh = ww * (W > H ? 0.62 : 1.18), z = 1.12 + 0.12 * Math.exp(-u / 0.35), x = (W - ww) / 2 + Math.sin(u * 1.3) * 8 * S, y = H * 0.47 - wh / 2;
  c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 40 * S; c.fillStyle = '#000'; c.fillRect(x, y, ww, wh); c.restore();
  c.save(); c.beginPath(); c.rect(x, y, ww, wh); c.clip(); cover(c, img, x - ww * (z - 1) / 2, y - wh * (z - 1) / 2, ww * z, wh * z); c.restore();
}
const LAUGH_CPS = FPS / 2; // a letter every 2 frames (ref #28)
const laughStr = n => ('haha' + 'a'.repeat(60)).slice(0, n);
function laughType(c, t, ph) { // a kept laugh typed huge across the frame, running off the right edge, with a text cursor
  for (const [l0, l1] of ph.laughAt || []) { if (t < l0 || t > l1 + 0.25) continue;
    const n = Math.min(64, 1 + Math.floor((t - l0) * LAUGH_CPS)), str = laughStr(n), size = 0.34 * Math.min(W, H) * (W > H ? 1.3 : 1), w = tw(c, str, size, 700), x = W * 0.06 - Math.max(0, w - W * 0.84);
    c.save(); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = size * 0.08; word(c, str, x, H * 0.52, { size, weight: 700, color: '#ffffff', track: -0.04 });
    if (Math.floor(t * 2.5) % 2 === 0) { c.fillStyle = '#ffffff'; c.fillRect(x + w + size * 0.06, H * 0.52 - size * 0.78, size * 0.06, size * 0.92); } c.restore(); }
}

// ---- riso print (ref #39): each ink is a coverage mask thresholded against a fixed noise field (a soft edge becomes grain), laid as a
// flat spot colour multiplied onto paper, a few px off register. Rendered once per poster or stamp, then cached.
let NOISE = null;
function riso(key, w, h, paper, inks, grain = 2) { // inks: [{color, draw(ctx, w, h), blur, dx, dy, density}] -> a cached w x h canvas
  if (CACHE[key]) return CACHE[key];
  const sw = Math.ceil(w / grain), sh = Math.ceil(h / grain), out = document.createElement('canvas'); out.width = w; out.height = h; const c = out.getContext('2d');
  c.fillStyle = paper; c.fillRect(0, 0, w, h); if (!NOISE || NOISE.length < sw * sh) { const r = rng(4242); NOISE = new Float32Array(sw * sh * 2).map(() => r()); }
  inks.forEach((k, j) => {
    const [cv, s] = scratch('riso', sw, sh); s.scale(1 / grain, 1 / grain); if (k.blur) s.filter = `blur(${k.blur}px)`; s.fillStyle = s.strokeStyle = '#000'; k.draw(s, w, h); s.filter = 'none';
    const d = s.getImageData(0, 0, sw, sh), px = d.data, [R, G, Bl] = rgbOf(k.color), dn = k.density ?? 0.93, off = j * 7919;
    for (let i = 0; i < sw * sh; i++) { const v = clamp((px[i * 4 + 3] / 255 * dn - NOISE[(i + off) % NOISE.length]) / 0.07 + 0.5); px[i * 4] = R; px[i * 4 + 1] = G; px[i * 4 + 2] = Bl; px[i * 4 + 3] = v * v * (3 - 2 * v) * 255; }
    s.putImageData(d, 0, 0); c.save(); c.globalCompositeOperation = 'multiply'; c.imageSmoothingEnabled = false; c.drawImage(cv, k.dx || 0, k.dy || 0, sw * grain, sh * grain); c.restore();
  });
  return (CACHE[key] = out);
}
function posterArt(key, w, h, it, k) { // three layouts, cycled: a headline with a blurred ghost echo; a huge glyph over tiles; scattered letters
  const ink2 = it.ink || '#1D1F2B', ink1 = B.accent, title = it.title || '', lines = title.split('\n'), sub = it.sub || '', r = rng(k * 31 + 7), L = k % 3;
  const fit = (s, maxW, wt = 800) => Math.min(h * 0.16, (maxW * 100) / Math.max(1, ...s.map(l => tw(ctx, l, 100, wt))));
  const head = (x, sz, dy = 0) => lines.forEach((l, i) => word(x, l, w / 2, h * 0.5 + (i - (lines.length - 1) / 2) * sz * 0.95 + sz * 0.35 + dy, { size: sz, weight: 800, color: '#000', align: 'center', track: -0.03 }));
  const small = (x, s, xx, yy, o = {}) => word(x, s, xx, yy, { size: w * 0.028, weight: 500, font: TYPE.mono, color: '#000', track: 0.12, ...o });
  const marks = x => [[0.05, 0.04], [0.92, 0.04], [0.05, 0.94], [0.92, 0.94]].forEach(([a, b]) => { x.fillRect(a * w, b * h, w * 0.03, w * 0.03); x.clearRect(a * w + w * 0.015, b * h, w * 0.015, w * 0.015); });
  const tiles = (x, y0, y1) => { const cs = w / 14; for (let yy = y0 * h; yy < y1 * h; yy += cs) for (let xx = 0; xx < w; xx += cs) { const v = r(); if (v > 0.35) { x.globalAlpha = v > 0.75 ? 0.9 : 0.4; x.fillRect(xx + 1, yy + 1, cs - 2, cs - 2); } } x.globalAlpha = 1; };
  const inks = L === 0 ? [
    { color: ink1, blur: w * 0.007, dx: w * 0.02, dy: h * 0.015, draw: x => { x.save(); x.translate(w / 2, h / 2); x.scale(1.16, 1.16); x.translate(-w / 2, -h / 2); head(x, fit(lines, w * 0.82)); x.restore(); } },
    { color: ink1, draw: x => tiles(x, 0.84, 0.97) },
    { color: ink2, draw: x => { head(x, fit(lines, w * 0.78)); small(x, sub.toUpperCase(), w / 2, h * 0.09, { align: 'center' }); marks(x); } }]
    : L === 1 ? [
    { color: ink1, draw: x => { tiles(x, 0.05, 0.62); x.beginPath(); x.arc(w * 0.62, h * 0.36, w * 0.3, 0, 7); x.globalAlpha = 0.55; x.fill(); x.globalAlpha = 1; } },
    { color: ink2, dx: -w * 0.006, draw: x => { word(x, it.big || title.slice(0, 2), w * 0.06, h * 0.62, { size: h * 0.42, weight: 800, color: '#000', track: -0.06 }); word(x, lines.join(' '), w * 0.06, h * 0.78, { size: w * 0.075, weight: 800, color: '#000' }); small(x, sub, w * 0.06, h * 0.86); marks(x); } }]
    : [
    { color: ink1, blur: w * 0.005, draw: x => { const g = title.replace(/\s/g, '') || '•'; for (let i = 0; i < 12; i++) { x.save(); x.translate(r() * w, r() * h); x.rotate((r() - 0.5) * 1.2); x.globalAlpha = 0.45 + r() * 0.55; word(x, g[i % g.length], 0, 0, { size: w * (0.2 + r() * 0.22), weight: 800, color: '#000' }); x.restore(); } } },
    { color: ink2, draw: x => { const sz = fit(lines, w * 0.74) * 1.05; lines.forEach((l, li) => { let cx = w * 0.08; [...l].forEach(ch => { x.save(); x.translate(cx, h * 0.4 + li * sz * 1.02); x.rotate((r() - 0.5) * 0.45); word(x, ch, 0, 0, { size: sz, weight: 800, color: '#000' }); x.restore(); cx += tw(ctx, ch, sz, 800) * 1.04; }); }); small(x, sub, w * 0.08, h * 0.92); marks(x); } }];
  return riso(key, Math.round(w), Math.round(h), it.paper || '#F6F3EC', inks);
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
  app(c, t, s, o) { // the product demo (ref #25): the takeover's card at full size; rows tick, the pointer clicks the button, a push in
    if (isPhone(o)) return phoneApp(c, t, s, o);
    const { oo, cs } = appOf(s, o), u = t - cs, [x, y, w] = appRect(oo), btn = uiCard(MEASURE, x, y, w, 9, oo, true).btn, tc = appClick(s, oo, cs);
    appGround(c); c.save(); if (btn) cam(c, 1 + 0.06 * ease.inOut(prog(t, s.out0, s.out1)), lerp(W / 2, btn[0] + btn[2] / 2, 0.5), btn[1] + btn[3] / 2); // push toward the button, card kept in frame
    uiCard(c, x, y, w, u, { ...oo, tClick: btn ? tc : null });
    if (btn) { const bx = btn[0] + btn[2] * 0.55, by = btn[1] + btn[3] * 0.6, m = ease.cursor(prog(u, tc - 0.5, tc));
      clickDisc(c, bx, by, u - tc, { r: 0.035 * Math.min(W, H) * 1.6, dur: 0.4 }); pointer(c, lerp(W * 0.86, bx, m), lerp(H * 0.84, by, m), 2.4 * (u >= tc && u < tc + 2 / FPS ? 0.9 : 1), { fill: '#ffffff', stroke: INK }); }
    c.restore();
    if (oo.toast && u > tc + 0.12) { const q = ease.out(prog(u, tc + 0.12, tc + 0.4)), sz = 34 * S, tw0 = tw(c, oo.toast, sz, 600, TYPE.ui, 0) + 80 * S;
      c.save(); c.globalAlpha *= q; rrect(c, (W - tw0) / 2, H * 0.8 + (1 - q) * 40 * S, tw0, sz * 2.4, sz * 1.2); c.fillStyle = B.accent; c.fill();
      word(c, oo.toast, W / 2, H * 0.8 + (1 - q) * 40 * S + sz * 1.55, { size: sz, weight: 600, font: TYPE.ui, color: '#fff', align: 'center' }); c.restore(); }
  },
  stat(c, t, s, o) { // a number counts up and lands, throwing two ghost copies outward (ref #26); bar: a progress bar fills with it
    const u = t - s.out0, g = groundOf(s), m = /^([^\d]*)([\d,.]+)(.*)$/.exec(o.value), num = +m[2].replace(/,/g, ''), dec = (m[2].split('.')[1] || '').length, { d0, dur } = statTimes(o);
    const p = prog(u, d0, d0 + dur), v = lerp(o.from ?? 0, num, o.bar ? ease.in(p) : ease.out(p)), fmt = x => m[1] + x.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + m[3];
    const str = fmt(v), size = Math.min(0.26 * W, 0.24 * H, (0.84 * W * 100) / tw(c, fmt(num), 100, 800)), y = H * 0.5, ink = o.ink || INK;
    bg(c, g); grid(c, g, 'rgba(0,0,0,0.05)', 72 * S); c.save(); cam(c, 1 + 0.05 * ease.out(prog(u, 0, s.out1 - s.out0)), W / 2, y);
    const e = prog(u, d0 + dur, d0 + dur + 0.6);
    if (e > 0 && e < 1) for (const k of [-1, 1]) { c.save(); c.translate(W / 2 + k * e * 0.1 * W, y); c.scale(1 + 0.35 * e, 1 + 0.35 * e); word(c, str, 0, 0, { size, weight: 800, color: ink, align: 'center', alpha: 0.22 * (1 - e) }); c.restore(); }
    if (p > 0 && p < 1) for (const k of [-1, 1]) word(c, str, W / 2, y + k * size * 0.07, { size, weight: 800, color: ink, align: 'center', alpha: 0.16 }); // digits blur while rolling
    word(c, str, W / 2, y, { size, weight: 800, color: ink, align: 'center' });
    if (o.label) ui(c, o.label, W / 2, y + size * 0.42, { size: 36 * S, color: '#6b6b6b', align: 'center' });
    if (o.bar) { const bw = W * 0.74, bx = (W - bw) / 2, by = y + size * 0.62, bh = 30 * S; rrect(c, bx, by, bw, bh, bh / 2); c.fillStyle = B.accent + '44'; c.fill();
      rrect(c, bx, by, Math.max(bh, bw * clamp(v / num)), bh, bh / 2); c.fillStyle = B.accent; c.fill(); }
    c.restore();
  },
  chapter(c, t, s, o) { // a numbered list card (ref #44): ".1", a small word above, the keyword typed in the accent, a line under it
    const u = t - s.out0, g = c.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, H * 0.75); g.addColorStop(0, mixHex(B.ground, B.accent, 0.2)); g.addColorStop(1, B.ground); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const kw = o.word || '', size = Math.min(0.19 * W, 0.16 * H, (0.8 * W * 100) / tw(c, kw, 100, 800)), y = H * 0.5, x0 = W / 2 - tw(c, kw, size, 800) / 2, n = Math.floor(clamp((u - 0.15) * CH_CPS, 0, kw.length));
    word(c, '.' + (o.n ?? 1), W / 2, y - size * 1.25, { size: size * 0.95, weight: 800, color: B.ink, align: 'center', alpha: prog(u, 0, 0.1) });
    if (o.over) ui(c, o.over, x0, y - size * 0.82, { size: 42 * S, weight: 600, color: B.ink, alpha: prog(u, 0.08, 0.18) });
    word(c, kw.slice(0, n), x0, y, { size, weight: 800, color: B.accent });
    if (o.sub) ui(c, o.sub, x0 + tw(c, kw, size, 800), y + 58 * S, { size: 42 * S, weight: 600, color: B.ink, align: 'right', alpha: prog(u, 0.15 + kw.length / CH_CPS, 0.3 + kw.length / CH_CPS) });
  },
  posters(c, t, s, o) { // a poster series flipped in one fixed frame, o.hold s each, hard cuts (ref #39); riso inks, rendered once per poster
    const items = o.items || [{ title: 'poster' }], i = posterIndex(s, o, t), ph = Math.min(H * 0.8, W * 0.8 * 1.29), pw = ph / 1.29;
    bg(c, groundOf(s)); c.save(); c.shadowColor = 'rgba(0,0,0,0.2)'; c.shadowBlur = 50 * S; c.shadowOffsetY = 18 * S;
    c.drawImage(posterArt(`poster${s.i}_${i}`, pw, ph, items[i], i + (o.seed || 0)), (W - pw) / 2, H * 0.47 - ph / 2, pw, ph); c.restore();
  },
  collection(c, t, s, o) { // ref #46: the user's photos (or drawn riso art) as stamps, polaroids, a grid or a mosaic, landing one by one
    const u = t - s.out0, L = collLayout(s, o), st = o.style || 'stamps', land = Math.max(...L.map(it => it.t0)), last = Math.min(land, s.out1 - s.out0 - 1.05); // the title gets ~0.7 s on screen
    bg(c, groundOf(s)); c.save(); const zz = st === 'grid' ? 1 - 0.1 * ease.inOut(prog(u, last + 0.3, last + 0.8)) : 1 + 0.06 * ease.inOut(prog(t, s.out0, s.out1)); cam(c, zz, W / 2, H * 0.5);
    for (const it of L) { const q = u - it.t0; if (q < 0) continue; const art = collArt(s, o, it);
      c.save(); c.translate(it.x, it.y);
      if (st === 'stamps') { c.rotate(it.rot); c.scale(1 + 0.12 * (1 - ease.out(prog(q, 0, 0.1))), 1 + 0.12 * (1 - ease.out(prog(q, 0, 0.1)))); c.shadowColor = 'rgba(0,0,0,0.2)'; c.shadowBlur = 16 * S; c.shadowOffsetY = 6 * S;
        c.drawImage(stampFrame(`stamp${s.i}_${it.k}`, art, it.w, it.h, it.k), -it.w / 2, -it.h / 2, it.w, it.h); }
      else if (st === 'polaroids') { const e = ease.out(prog(q, 0, 0.22)); c.translate(0, (1 - e) * H * 0.7); c.rotate(it.rot * (1 + 1.5 * (1 - e))); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 30 * S; c.shadowOffsetY = 10 * S;
        c.fillStyle = '#FDFDFB'; c.fillRect(-it.w / 2, -it.h / 2, it.w, it.h); c.shadowColor = 'transparent'; const m = it.w * 0.06;
        c.save(); c.beginPath(); c.rect(-it.w / 2 + m, -it.h / 2 + m, it.w - 2 * m, it.w - 2 * m); c.clip(); cover(c, art, -it.w / 2 + m, -it.h / 2 + m, it.w - 2 * m, it.w - 2 * m); c.restore();
        if (it.label) word(c, it.label, 0, it.h / 2 - it.w * 0.09, { size: it.w * 0.07, weight: 500, font: TYPE.ui, color: '#3a3a3a', align: 'center' }); }
      else { const f = st === 'grid' ? ease.out(prog(q, 0, 0.16)) : 1, e = st === 'mosaic' ? ease.out(prog(q, 0, 0.28)) : 1; // grid: tiles flip in a wave; mosaic: tiles fly home
        if (e < 1) { c.translate(it.fx * (1 - e), it.fy * (1 - e)); c.rotate(it.rot * (1 - e)); c.scale(0.4 + 0.6 * e, 0.4 + 0.6 * e); }
        c.scale(Math.max(0.001, f), 1); rrect(c, -it.w / 2, -it.h / 2, it.w, it.h, st === 'grid' ? 14 * S : 2 * S); c.save(); c.clip(); cover(c, art, -it.w / 2, -it.h / 2, it.w, it.h); c.restore(); }
      c.restore(); }
    c.restore();
    if (o.title) { const q = prog(u, last + 0.35, last + 0.6), sz = Math.min(0.13 * W, (0.8 * W * 100) / tw(c, o.title, 100, 800)), y = st === 'mosaic' ? H * 0.5 : H * 0.2;
      if (st === 'mosaic' && q > 0) { const pw0 = tw(c, o.title, sz, 800) + sz; c.save(); c.globalAlpha *= q; c.fillStyle = CREAM; c.fillRect((W - pw0) / 2, y - sz * 0.95, pw0, sz * 1.3); c.restore(); }
      glowIn(c, o.title, W / 2, y, u - last - 0.35, { size: sz, weight: 800, color: INK, align: 'center' }); }
  },
  code(c, t, s, o) { // an editor types o.src on the words, then line o.hl lights up on the word o.hlOn; a slow push toward the caret
    const u = t - s.out0, ct = codeTimes(s, o), wide = W > H, w = wide ? W * 0.6 : W * 0.86, src = o.src || '', n = Math.max(...src.split('\n').map(l => l.length));
    const gutter = wide, size = Math.min(wide ? H * 0.034 : W * 0.044, (w * 0.92) / ((n + (gutter ? 6 : 2.5)) * 0.6)), nl = src.split('\n').length, rows = nl + (o.result ? 1.9 : 0.6);
    const th = { bg: mixHex(B.ground, '#ffffff', 0.07), bar: mixHex(B.ground, '#ffffff', 0.11) }, m = codeBlock(MEASURE, src, 0, 0, { w, size, rows, gutter }), y = wide ? (H - m.h) / 2 : H * 0.42;
    const hz = o.hl != null ? ease.inOut(prog(u, ct.tHl - 0.1, ct.tHl + 0.45)) : 0, hy = o.hl != null ? m.lineY(o.hl) + y - size * 0.3 : H / 2;
    appGround(c); grid(c, B.ground, 'rgba(255,255,255,0.035)', 60 * S); // a slow push, then a punch-in on the highlighted line
    c.save(); cam(c, (1 + 0.03 * ease.inOut(prog(u, 0, s.out1 - s.out0))) * (1 + (wide ? 0.25 : 0.06) * hz), W / 2, lerp(y + m.h / 2, hy, hz)); // at most 1.09x in 9:16: the panel keeps 3 % margins
    c.save(); c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 70 * S; c.shadowOffsetY = 24 * S; rrect(c, (W - w) / 2, y, w, m.h, size * 0.7); c.fillStyle = th.bg; c.fill(); c.shadowColor = 'transparent'; c.strokeStyle = 'rgba(255,255,255,0.09)'; c.lineWidth = 2 * S; c.stroke(); c.restore();
    codeBlock(c, src, (W - w) / 2, y, { w, size, rows, gutter, theme: th, u: u - ct.t0, cps: ct.cps, accent: B.accent, title: o.title ?? 'main.ts', hl: o.hl != null ? [o.hl, prog(u, ct.tHl, ct.tHl + 0.12)] : null });
    if (o.result && u > ct.tHl + 0.25) { const x0 = (W - w) / 2 + size * 1.1 + (gutter ? size * 2.4 : 0), ry = y + m.lineY(nl + 0.55), n2 = Math.floor((u - ct.tHl - 0.25) * Math.max(40, o.result.length / Math.max(0.15, s.out1 - s.out0 - ct.tHl - 0.6))); // the payoff: a status row, done 0.35 s before the cut
      c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect((W - w) / 2 + size, ry - size * 1.45, w - size * 2, 2 * S); c.fillStyle = B.accent; c.beginPath(); c.arc(x0 + size * 0.3, ry - size * 0.32, size * 0.28, 0, 7); c.fill();
      word(c, o.result.slice(0, n2), x0 + size * 1.1, ry, { size: size * 0.95, weight: 500, font: TYPE.mono, color: B.accent }); }
    c.restore();
  },
  end(c, t, s, o) { // brand end card
    if (o.ground) bg(c, o.ground); else appGround(c, 1, [W / 2, H * 0.48, Math.max(W, H) * 0.45], '1f'); const u = t - s.out0, size = Math.min(0.2 * W, (0.7 * W * 100) / tw(c, o.text, 100, 800));
    glowIn(c, o.text, W / 2, H * 0.5, u, { size, weight: 800, color: B.ink, align: 'center' });
    c.fillStyle = B.accent; c.beginPath(); c.arc(W / 2 + tw(c, o.text, size, 800) / 2 + size * 0.14, H * 0.5 - size * 0.06, size * 0.07 * Math.max(0, ease.back(prog(u, 0.12, 0.4))), 0, 7); c.fill();
    if (o.sub) word(c, o.sub, W / 2, H * 0.5 + size * 0.62, { size: 46 * S, weight: 500, font: TYPE.ui, color: '#D5D8DD', align: 'center', alpha: prog(u, 0.3, 0.55) });
    if (o.cta) { const q = ease.out(prog(u, 0.45, 0.75)), sz = 40 * S, pw = tw(c, o.cta, sz, 700, TYPE.ui, 0) + sz * 2.4, py = H * 0.5 + size * 0.62 + sz * 2.6 + (1 - q) * 20 * S; // a call to action pill
      c.save(); c.globalAlpha *= q; rrect(c, (W - pw) / 2, py - sz * 1.15, pw, sz * 2.3, sz * 1.15); c.fillStyle = B.accent; c.fill();
      word(c, o.cta, W / 2, py + sz * 0.36, { size: sz, weight: 700, font: TYPE.ui, color: B.ground, align: 'center' }); c.restore(); }
  },
};
const MONTAGE_SLATES = [ // drawn b-roll for the montage: a big number, a calendar being crossed off, a bar of commits
  (c, it, r) => { word(c, it, 0, 0, { size: 330 * S, weight: 800, color: '#fff', align: 'center' }); ui(c, 'WEEK', 0, -300 * S, { font: TYPE.mono, size: 34 * S, color: '#aaa', align: 'center' }); },
  (c, it, r) => { const n = 35, cw = 104 * S, x0 = -3.5 * cw, y0 = -2.5 * cw, off = Math.floor(r() * 30); c.strokeStyle = '#777'; c.lineWidth = 2 * S;
    for (let k = 0; k < n; k++) { const x = x0 + (k % 7) * cw, y = y0 + Math.floor(k / 7) * cw; c.strokeRect(x, y, cw, cw); if (k < off) { c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(x + 18, y + 18); c.lineTo(x + cw - 18, y + cw - 18); c.moveTo(x + cw - 18, y + 18); c.lineTo(x + 18, y + cw - 18); c.stroke(); c.strokeStyle = '#777'; } } },
  (c, it, r) => { for (let k = 0; k < 26; k++) { const h = (40 + r() * 260) * S; c.fillStyle = k % 5 ? '#bbb' : '#fff'; c.fillRect(-W * 0.4 + k * W * 0.031, 150 * S - h, W * 0.022, h); } ui(c, 'commits / week', -W * 0.4, 210 * S, { font: TYPE.mono, size: 30 * S, color: '#aaa' }); },
];
// ---- phones (refs gabrielbuzziv, francoxavier33, gautam-mer1, bthreeagency): lib.js phone3d, a 3D phone whose screen is drawn in 2D ----
// Measured: in 9:16 the phone is 55-65 % of H under a headline, in 16:9 ~85 % of H at 0.68 W; it rises in ~0.55 s (ease-out) and keeps
// drifting; a card lifts out over a defocused phone (blur ~1 % of W); a push-through is an ease-in dolly of ~0.7-1.2 s into the screen.
const isPhone = o => (o.device ?? E.device ?? 'phone') === 'phone';
const PHONE_L = feed => (W > H ? { x: W * 0.68, y: H * 0.53, h: H * 0.86, yaw: -0.3 } : feed ? { x: W / 2, y: H * 0.69, h: H * 0.66, yaw: -0.2 } : { x: W / 2, y: H * 0.61, h: H * 0.72, yaw: -0.24 });
function phonePose(U, dur, rise = true) { // U: seconds into the shot. Rises from below with a yaw that springs home, then drifts and creeps in
  const L = PHONE_L(), d = clamp(U / Math.max(dur, 1)), r = rise ? ease.expoOut(clamp(U / 0.55)) : 1, y0 = rise ? 1 - ease.spring(clamp(U / 0.9), 0.25) : 0;
  return { x: L.x, y: L.y + (1 - r) * H * 0.75, h: L.h * (1 + 0.04 * ease.inOut(d)), yaw: L.yaw - 0.5 * y0 + 0.07 * ease.inOut(d), pitch: 0.07 - 0.03 * d, roll: 0.025 * (1 - d) };
}
const quadPt = (q, u, v) => [0, 1].map(k => lerp(lerp(q[0][k], q[1][k], u), lerp(q[3][k], q[2][k], u), v)); // a point on the screen, u, v in 0..1
const SCREEN = { ground: '#F2F2F5', top: 0.16, side: 0.045 }; // the app screen: the card under the status bar, 4.5 % margins
function phoneCardRect(oo) { // where the takeover's card lands: the card's centre and width on the frame, at the phone's resting pose
  const L = PHONE_L(), sw = 0.4416 * L.h * Math.cos(L.yaw), cw = sw * (1 - 2 * SCREEN.side), ch = (uiCard(MEASURE, 0, 0, 760, 9, oo, true).h * cw) / 760;
  return [L.x, L.y - 0.48 * L.h + SCREEN.top * sw + ch / 2, cw];
}
function phoneApp(c, t, s, o, x = {}) { // the app on a phone; x.alpha / x.card: false when the takeover draws it under the flying card
  const { oo, cs } = appOf(s, o), u = t - cs, U = t - s.out0, from = E.phrases[s.phrase - 1]?.ui?.takeover, tc = appClick(s, oo, cs);
  const lift = oo.toast ? clamp((u - tc - 0.12) / 0.35) : 0, L = PHONE_L(), P = phonePose(U, s.out1 - s.out0, !from);
  if (x.card !== false) appGround(c, 1, [L.x, L.y - L.h * 0.1, L.h * 0.75]);
  // the camera pushes in on the card (1 -> 1.3x, the card's centre drifting to 0.42 H; the bottom of the phone leaves frame, as in the refs),
  // then eases in a little more as the toast lifts out
  let btn = null; const push = x.card === false ? 0 : ease.inOut(prog(U, 0.25, 1.5)), k = (1 + 0.3 * push) * (1 + 0.08 * ease.inOut(lift));
  const [, cy0] = phoneCardRect(oo), a = (cy0 - PHONE_L().y) / PHONE_L().h, ay = lerp(P.y + a * P.h, H * (W > H ? 0.42 : 0.5), push);
  const q = phone3d(c, { ...P, h: P.h * k, y: ay - a * P.h * k, alpha: x.alpha ?? 1, blur: 0.009 * W * ease.out(lift), dim: 0.45 * ease.out(lift), shadow: 0.4, // it recedes: 10 px defocus, 55 % brightness
    screen: (sc, sw, sh) => { sc.fillStyle = SCREEN.ground; sc.fillRect(0, 0, sw, sh);
      if (x.card === false) return appChrome(sc, sw, sh, sw * SCREEN.top + (uiCard(MEASURE, 0, 0, 760, 9, oo, true).h * sw * (1 - 2 * SCREEN.side)) / 760 + sw * 0.05, oo);
      const r = uiCard(sc, sw * SCREEN.side, sw * SCREEN.top, sw * (1 - 2 * SCREEN.side), u, { ...oo, glow: false, tClick: oo.button ? tc : null });
      if (r.btn) btn = [(r.btn[0] + r.btn[2] / 2) / sw, (r.btn[1] + r.btn[3] / 2) / sh];
      appChrome(sc, sw, sh, sw * SCREEN.top + r.h + sw * 0.05, oo); } });
  if (x.card === false) return;
  if (btn && u > tc - 0.3 && u < tc + 0.5) { const [bx, by] = quadPt(q, ...btn), a = clamp((u - tc + 0.3) / 0.15) * (1 - clamp((u - tc - 0.25) / 0.25)), down = u >= tc && u < tc + 0.12;
    clickDisc(c, bx, by, u - tc, { r: 0.04 * Math.min(W, H), dur: 0.35 }); // a touch, not a mouse pointer: a grey disc that presses, a ring on the tap
    c.save(); c.globalAlpha = a; c.beginPath(); c.arc(bx, by, 0.034 * Math.min(W, H) * (down ? 0.82 : 1), 0, 7); c.fillStyle = 'rgba(40,40,48,0.32)'; c.fill(); c.lineWidth = 3 * S; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke(); c.restore(); }
  if (lift > 0) { // the toast lifts out of the screen toward the lens: 1.15x the screen's width, a -1.5 deg tilt, then it floats
    const e = ease.spring(lift, 0.12), sw = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), cw = Math.min(W * 0.84, sw * 1.15), sz = cw * 0.06, ch = sz * 4.2, [bx, by] = btn ? quadPt(q, ...btn) : [L.x, L.y];
    const fl = Math.max(0, u - tc - 0.47), cx = clamp(lerp(bx, (q[0][0] + q[1][0]) / 2, e), cw / 2 + 0.04 * W, W - cw / 2 - 0.04 * W), cy = lerp(by, quadPt(q, 0.5, 0.2)[1], e) - fl * 0.012 * H;
    c.save(); c.translate(cx, cy); c.rotate(-0.026 + 0.012 * e); const tick = 1 + 0.05 * Math.sin(Math.PI * clamp((u - tc - 0.97) / 0.2)); c.scale(lerp(0.65, 1, e) * (1 + 0.02 * fl) * tick, lerp(0.65, 1, e) * (1 + 0.02 * fl) * tick); // a tick as the count lands c.globalAlpha = clamp(lift * 8); // opaque at once: a half-faded copy read as a ghost
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = cw * 0.1; c.shadowOffsetY = cw * 0.04; rrect(c, -cw / 2, -ch / 2, cw, ch, sz * 0.9); c.fillStyle = '#ffffff'; c.fill(); c.shadowColor = 'transparent';
    const ix = -cw / 2 + sz * 1.1; rrect(c, ix, -sz * 1.15, sz * 2.3, sz * 2.3, sz * 0.6); c.fillStyle = B.accent; c.fill(); // an app-icon tile with a check
    c.strokeStyle = '#fff'; c.lineWidth = sz * 0.28; c.lineCap = 'round'; c.beginPath(); c.moveTo(ix + sz * 0.6, 0); c.lineTo(ix + sz * 1.0, sz * 0.4); c.lineTo(ix + sz * 1.7, -sz * 0.4); c.stroke();
    word(c, oo.name || E.brand?.name || 'now', ix + sz * 3.1, -sz * 0.35, { size: sz * 0.8, weight: 500, font: TYPE.ui, color: MUTE });
    const ts = Math.min(sz * 1.05, (sz * 1.05 * (cw - sz * 5.2)) / tw(c, oo.toast, sz * 1.05, 700, TYPE.ui, -0.01)), m = /\d[\d,]*/.exec(oo.toast), cp = ease.out(prog(u, tc + 0.47, tc + 0.97)); // fits; its number counts up as it lands
    const str = m ? oo.toast.slice(0, m.index) + Math.round(+m[0].replace(/,/g, '') * lerp(0.85, 1, cp)).toLocaleString('en-US') + oo.toast.slice(m.index + m[0].length) : oo.toast; // from 85 %: from 0 read as "wiped"
    word(c, str, ix + sz * 3.1, sz * 0.75, { size: ts, weight: 700, font: TYPE.ui, track: -0.01, color: INK }); c.restore(); }
}
function appChrome(c, sw, sh, top, oo) { // below the card: quiet list rows, and a tab bar, so the screen reads as an app, not a card on white
  const u = sw / 393, m = sw * SCREEN.side, tabs = oo.tabs || ['Today', 'Stats', 'Friends', 'You'];
  const list = oo.list || []; // list: ["Title|sub", ...] real rows; without it, quiet skeleton rows
  for (let i = 0, y = top; y + 64 * u < sh - 100 * u && i < (list.length || 4); i++, y += 76 * u) { const [ti, sub] = (list[i] || '').split('|'); c.fillStyle = '#ffffff'; c.beginPath(); c.roundRect(m, y, sw - 2 * m, 64 * u, 14 * u); c.fill();
    c.fillStyle = ti ? ['#FDE9A6', '#DCE9FF', '#E3F5E3', '#F9DDE6'][i % 4] : mixHex(B.accent, '#ffffff', 0.78); c.beginPath(); ti ? c.arc(m + 32 * u, y + 32 * u, 18 * u, 0, 7) : c.roundRect(m + 14 * u, y + 14 * u, 36 * u, 36 * u, 10 * u); c.fill();
    if (ti) { word(c, ti[0], m + 32 * u, y + 37.5 * u, { size: 15 * u, weight: 700, font: TYPE.ui, color: '#3A3A44', align: 'center' }); // an avatar: initial on a tint
      word(c, ti, m + 62 * u, y + 30 * u, { size: 15 * u, weight: 600, font: TYPE.ui, color: INK }); if (sub) word(c, sub, m + 62 * u, y + 49 * u, { size: 12.5 * u, weight: 400, font: TYPE.ui, color: MUTE }); }
    else { c.fillStyle = '#D9DADF'; c.fillRect(m + 62 * u, y + 20 * u, (120 + 40 * ((i * 7) % 3)) * u, 9 * u); c.fillStyle = '#E8E9ED'; c.fillRect(m + 62 * u, y + 36 * u, 80 * u, 8 * u); } }
  c.fillStyle = '#ffffffee'; c.fillRect(0, sh - 84 * u, sw, 84 * u); c.fillStyle = '#00000014'; c.fillRect(0, sh - 84 * u, sw, u);
  tabs.forEach((l, i) => { const x = sw * (i + 0.5) / tabs.length, y = sh - 61 * u, r = 10 * u; c.save(); c.strokeStyle = c.fillStyle = i ? '#9A9AA3' : B.accent; c.lineWidth = 2 * u; c.lineJoin = 'round'; c.beginPath();
    [() => { c.moveTo(x - r, y); c.lineTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x + r * 0.8, y); c.lineTo(x + r * 0.8, y + r); c.lineTo(x - r * 0.8, y + r); c.lineTo(x - r * 0.8, y); c.closePath(); c.stroke(); }, // home
     () => { [[-0.8, 0.4], [-0.15, 1.2], [0.5, 0.8]].forEach(([dx, hh]) => c.fillRect(x + dx * r, y + r - hh * r * 1.6, r * 0.5, hh * r * 1.6)); }, // bars
     () => { c.arc(x - r * 0.4, y - r * 0.2, r * 0.45, 0, 7); c.moveTo(x + r * 0.95, y - r * 0.2); c.arc(x + r * 0.5, y - r * 0.2, r * 0.45, 0, 7); c.moveTo(x - r * 1.1, y + r); c.arc(x, y + r * 1.3, r * 1.1, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }, // people
     () => { c.arc(x, y - r * 0.35, r * 0.5, 0, 7); c.moveTo(x + r * 0.95, y + r); c.arc(x, y + r * 1.2, r * 0.95, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }][i % 4](); c.restore();
    word(c, l, x, sh - 30 * u, { size: 11 * u, weight: 600, font: TYPE.ui, color: i ? '#8A8A92' : B.accent, align: 'center' }); });
}
function phoneShot(c, t, s, ph, img) { // the footage inside a phone as a post; "in" pushes through the screen, "out" pulls back into it
  const U = t - s.out0, dur = s.out1 - s.out0, L = PHONE_L(true), full = (1.08 * Math.max(W / 0.4416, H / 0.96)) / L.h; // the screen ends at 108 %: no bezel on the last frames
  // z: 0 in the phone, 1 its screen covers the frame (reached 0.1 s before the cut, so the last frames are the plain shot); scale = full^z
  const z = ph.phone === 'in' ? ease.in(prog(U, dur - 0.55, dur - 0.1)) : ph.phone === 'out' ? 1 - ease.out(prog(U, 0.1, 0.55)) : 0;
  if (z > 0.999) return false; // full frame: the plain shot draws
  const { box, cam: co } = camGeom(s), drift = clamp(U / Math.max(dur, 1));
  c.save(); c.filter = 'blur(40px) brightness(0.5) saturate(1.2)'; cover(c, img, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1); c.restore(); // ambient: itself, blurred
  phone3d(c, { x: lerp(L.x, W / 2, z), y: lerp(L.y, H / 2, z), h: L.h * full ** z * (1 + 0.03 * drift), yaw: (L.yaw + 0.06 * drift) * (1 - z), pitch: 0.06 * (1 - z), roll: 0.02 * (1 - z),
    statusInk: '#ffffff', shadow: 0.45 * (1 - z), screen: (sc, sw, sh) => {
      const k = lerp(Math.max(sw / W, sh / H), sw / (0.4416 * L.h * full), z); sc.fillStyle = '#000'; sc.fillRect(0, 0, sw, sh); sc.save(); sc.translate(sw / 2, sh / 2); sc.scale(k, k); sc.translate(-W / 2, -H / 2); shotCam(sc, U, co); sc.drawImage(img, ...box); sc.restore(); // cover the screen, easing to 1:1 with the frame at full cover (the face keeps its size across the hand-off)
      sc.save(); sc.globalAlpha = 1 - clamp(z * 2.5); feedChrome(sc, sw, sh, t, ph); sc.restore(); } });
  return true;
}
function feedChrome(c, sw, sh, t, ph) { // a reel's UI in phone points (393 wide): a scrim, the right rail, the handle and the caption
  const u = sw / 393, g = c.createLinearGradient(0, sh * 0.62, 0, sh); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = g; c.fillRect(0, sh * 0.62, sw, sh * 0.38);
  const g2 = c.createLinearGradient(0, 0, 0, 110 * u); g2.addColorStop(0, 'rgba(0,0,0,0.45)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g2; c.fillRect(0, 0, sw, 110 * u); // the status bar reads over any footage
  const hit = ph.kw ? t - ph.kw.t : -1, pop = hit >= 0 ? 1 + 0.35 * Math.exp(-hit / 0.12) * Math.cos(hit * 18) : 1, rx = sw - 34 * u;
  [['heart', hit >= 0 ? '12.4K' : '12.3K'], ['comment', '318'], ['share', 'Share']].forEach(([kind, n], i) => { const y = sh * 0.6 + i * 74 * u, r = 15 * u;
    c.save(); c.translate(rx, y); if (kind === 'heart') c.scale(pop, pop); c.fillStyle = kind === 'heart' && hit >= 0 ? B.accent : '#ffffff'; c.strokeStyle = '#ffffff'; c.lineWidth = 2.4 * u; c.beginPath();
    if (kind === 'heart') { c.moveTo(0, r * 0.9); c.bezierCurveTo(-r * 1.6, -r * 0.1, -r * 0.7, -r * 1.3, 0, -r * 0.45); c.bezierCurveTo(r * 0.7, -r * 1.3, r * 1.6, -r * 0.1, 0, r * 0.9); hit >= 0 ? c.fill() : c.stroke(); }
    else if (kind === 'comment') { c.ellipse(0, -r * 0.1, r, r * 0.85, 0, 0, 7); c.stroke(); }
    else { c.moveTo(-r * 0.9, r * 0.6); c.quadraticCurveTo(-r * 0.6, -r * 0.5, r * 0.4, -r * 0.5); c.lineTo(r * 0.4, -r); c.lineTo(r, -r * 0.3); c.lineTo(r * 0.4, r * 0.35); c.lineTo(r * 0.4, -r * 0.05); c.quadraticCurveTo(-r * 0.4, -r * 0.1, -r * 0.9, r * 0.6); c.stroke(); }
    c.restore(); word(c, n, rx, y + 30 * u, { size: 12 * u, weight: 600, font: TYPE.ui, color: '#ffffff', align: 'center' }); });
  const hy = sh - 96 * u, name = (E.brand?.handle || '@' + (E.brand?.name || 'creator')).replace(/^@?/, '@');
  c.beginPath(); c.arc(30 * u, hy, 14 * u, 0, 7); c.fillStyle = B.accent; c.fill(); word(c, name, 52 * u, hy + 5 * u, { size: 15 * u, weight: 700, font: TYPE.ui, color: '#ffffff' });
  word(c, ph.post ?? '♪ original audio · ' + name, 18 * u, hy + 34 * u, { size: 14 * u, weight: 500, font: TYPE.ui, color: '#ffffffdd' }); // post: the post's own caption (not the reel's)
  c.fillStyle = '#ffffff55'; c.fillRect(0, sh - 44 * u, sw, 2 * u); c.fillStyle = '#ffffff'; c.fillRect(0, sh - 44 * u, sw * clamp((t - ph.start) / (ph.end - ph.start)), 2 * u);
}
// ---- code on screen (refs davidmarcus, hqmank, kyonax, theviableedge): lib.js codeBlock on the brand ground, typed on the words ----
function codeTimes(s, o) { // typing starts at 0.15 s and ends 0.3 s before hlOn's word (else 0.45 s before the cut); cps 18-70 to fit
  const src = o.src || '', typed = src.split('\n').map(l => l.trimStart()).join('\n'), w = o.hlOn && s.phrases.flatMap(i => E.phrases[i].words).find(x => clean(x.w) === clean(o.hlOn));
  const end = (w ? w.t - s.out0 : s.out1 - s.out0 - 0.15) - 0.3, cps = o.cps ?? clamp(typed.length / Math.max(0.3, end - 0.15), 18, 70);
  return { t0: 0.15, cps, typed, tHl: w ? w.t - s.out0 : 0.15 + typed.length / cps + 0.15 };
}
// ---- clocks for the new inserts: the same numbers drive the picture and sounds(), so the cues can't drift ----
function appOf(s, o) { // an app insert after a takeover inherits that card and its clock (the rows keep ticking across the cut)
  const prev = E.phrases[s.phrase - 1], from = prev?.ui?.takeover ? prev : null;
  const cs = from ? from.start + (from.ui.delay ?? 0.15) : s.out0 - 0.3;
  return { oo: { ...(from?.ui || {}), rowAt: s.out0 - cs + 0.25, ...o, takeover: false }, cs };
}
function appClick(s, oo, cs) { const w = s.phrases.flatMap(i => E.phrases[i].words).find(w => clean(w.w) === clean(oo.clickOn || '')); return (w ? w.t : s.out1 - 0.55) - cs; }
const statTimes = o => ({ d0: o.delay ?? 0.15, dur: o.dur ?? 0.9 });
const CH_CPS = 16; // chapter keyword letters per second
const posterIndex = (s, o, t) => Math.min((o.items || [0]).length - 1, Math.floor((t - s.out0 + 1e-6) / (o.hold ?? 0.4)));
function collLayout(s, o) { // where each item sits and when it lands (s seconds); cached on the shot
  if (s.coll) return s.coll; const st = o.style || 'stamps', pool = [...(o.images || []).map(img => ({ img })), ...(o.items || []).map(label => ({ label }))], n = o.n || pool.length || 6, r = rng(s.i * 13 + 5), wide = W > H;
  const ws = s.phrases.flatMap(i => E.phrases[i].words).filter(w => w.t >= s.out0), step = o.step ?? 0.13;
  const when = k => (step === 'words' && ws[k] ? ws[k].t - s.out0 : 0.12 + k * (typeof step === 'number' ? step : 0.13));
  const item = (k, extra) => ({ k, img: null, label: null, ...pool[k % Math.max(1, pool.length)], ...extra }); // photos first, then drawn art
  let L = [];
  if (st === 'stamps') { const cols = wide ? 4 : 3, rows = Math.ceil(n / cols), cw = (W * 0.9) / cols, chh = (H * (wide ? 0.62 : 0.5)) / rows, order = [...Array(n).keys()].sort(() => r() - 0.5);
    for (let k = 0; k < n; k++) { const h = Math.min(chh * 1.4, cw * 1.25), j = order.indexOf(k); // they overlap, like a pile (ref #46)
      L.push(item(k, { x: clamp(W * 0.05 + (k % cols + 0.5) * cw + (r() - 0.5) * cw * 0.3, h / 2.6 + W * 0.03, W - h / 2.6 - W * 0.03), y: H * (wide ? 0.22 : 0.25) + (Math.floor(k / cols) + 0.5) * chh + (r() - 0.5) * chh * 0.25, w: h / 1.3, h, rot: (r() - 0.5) * 0.18, t0: when(j) })); } }
  else if (st === 'polaroids') for (let k = 0; k < n; k++) { const w = wide ? W * 0.24 : W * 0.56; L.push(item(k, { x: W / 2 + (r() - 0.5) * W * 0.3, y: H * 0.5 + (r() - 0.5) * H * 0.1, w, h: w * 1.2, rot: (r() - 0.5) * 0.36, t0: when(k) })); }
  else if (st === 'grid') { const cols = wide ? 5 : 3, gap = 18 * S, w = (W * 0.92 - gap * (cols - 1)) / cols, h = w * 1.25, rows = Math.max(Math.ceil(n / cols), Math.floor((H * 0.7) / (h + gap)));
    for (let k = 0; k < cols * rows; k++) { const i = k % cols, j = Math.floor(k / cols); L.push(item(k, { x: W * 0.04 + i * (w + gap) + w / 2, y: H / 2 + (j - (rows - 1) / 2) * (h + gap), w, h, rot: 0, t0: 0.1 + (i + j) * 0.06 })); } }
  else { const cols = wide ? 16 : 9, sz = W / cols, rows = Math.ceil(H / sz);
    for (let k = 0; k < cols * rows; k++) { const i = k % cols, j = Math.floor(k / cols), x = (i + 0.5) * sz, y = (j + 0.5) * sz, d = Math.hypot(x - W / 2, y - H / 2) / Math.hypot(W / 2, H / 2);
      L.push(item(k, { x, y, w: sz - 4 * S, h: sz - 4 * S, rot: (r() - 0.5) * 1.5, fx: (r() - 0.5) * W * 0.9, fy: (r() - 0.5) * H * 0.6, t0: 0.1 + d * 0.7 + r() * 0.08 })); } }
  return (s.coll = L);
}
function collArt(s, o, it) { // the user's photo, or drawn riso art (a stamp-sized poster with the item's label and a denomination)
  if (it.img) return GOT[it.img] || MEASURE.canvas; const k = (o.items || []).indexOf(it.label) + 1 || it.k % 6 + 1, w = 330, h = 430;
  return posterArt(`collart${s.i}_${k}`, w, h, { title: (it.label || o.title || B.name || '').toUpperCase(), sub: o.sub || `${k * 10}c · 2026`, big: String(k).padStart(2, '0') }, k);
}
function stampFrame(key, art, w, h, k) { // a perforated stamp: paper border, the art inset, a few cracks and sometimes a stain (ref #46)
  if (CACHE[key]) return CACHE[key]; const cv = document.createElement('canvas'); cv.width = Math.ceil(w); cv.height = Math.ceil(h); const x = cv.getContext('2d'), r = rng(k * 97 + 5), tr = w * 0.028, step = tr * 2.7, m = w * 0.08;
  x.fillStyle = '#FBFAF5'; x.fillRect(0, 0, w, h); x.globalCompositeOperation = 'destination-out'; x.beginPath();
  for (let a = step / 2; a < w; a += step) { x.moveTo(a + tr, 0); x.arc(a, 0, tr, 0, 7); x.moveTo(a + tr, h); x.arc(a, h, tr, 0, 7); }
  for (let a = step / 2; a < h; a += step) { x.moveTo(tr, a); x.arc(0, a, tr, 0, 7); x.moveTo(w + tr, a); x.arc(w, a, tr, 0, 7); }
  x.fill(); x.globalCompositeOperation = 'source-over'; x.save(); x.beginPath(); x.rect(m, m, w - 2 * m, h - 2 * m); x.clip(); cover(x, art, m, m, w - 2 * m, h - 2 * m);
  x.globalCompositeOperation = 'screen'; x.strokeStyle = 'rgba(255,255,255,0.45)'; x.lineWidth = Math.max(1, w * 0.004);
  for (let n = 0; n < 5; n++) { let px = r() * w, py = r() * h, a = r() * 6.28; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 9; j++) { a += (r() - 0.5) * 1.2; px += Math.cos(a) * w * 0.06; py += Math.sin(a) * w * 0.06; x.lineTo(px, py); } x.stroke(); }
  x.restore(); if (r() < 0.45) { x.globalCompositeOperation = 'multiply'; x.strokeStyle = 'rgba(160,120,70,0.32)'; x.lineWidth = w * 0.014; x.beginPath(); x.ellipse(w * (0.3 + r() * 0.4), h * (0.5 + r() * 0.35), w * 0.2, w * 0.18, r(), 0.3, 5.6); x.stroke(); }
  return (CACHE[key] = cv);
}
const collKind = o => ({ stamps: 'land', polaroids: 'photo' }[o.style || 'stamps'] || 'tile');
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
  app(s, o, ev, sfx) { // UI sounds on a full-screen product shot sit ~6 dB over the micro rule (refs #25, #28 measured -5..-8 under the voice)
    const { oo, cs } = appOf(s, o), tc = cs + appClick(s, oo, cs), inShot = t => t > s.out0 + 0.05 && t < s.out1;
    (oo.rows || []).forEach((_, i) => inShot(cs + rowAt(oo, i)) && ev.push({ t: cs + rowAt(oo, i), kind: 'tile' }));
    if (oo.button && inShot(tc)) sfx.push([tc, 'click', 2]); if (oo.toast && inShot(tc + 0.12)) sfx.push([tc + 0.12, 'click_cluster', 1.4]);
    if (oo.toast && isPhone(o) && inShot(tc + 0.12)) ev.push({ t: tc + 0.12, kind: 'pill' }); // the toast lifting out of the phone
    if (oo.toast && isPhone(o) && /\d/.test(oo.toast) && inShot(tc + 0.47)) sfx.push([+(tc + 0.47).toFixed(3), 'ratchet', 0.7, { n: 8, rate: 16 }]); // its number counting
  },
  code(s, o, ev, sfx) { const ct = codeTimes(s, o); ev.push({ t: s.out0 + ct.t0, kind: 'type', text: ct.typed, cps: ct.cps }); if (o.hl != null) ev.push({ t: s.out0 + ct.tHl, kind: 'glint', gain: 1.2 });
    if (o.result && s.out0 + ct.tHl + 0.25 < s.out1) ev.push({ t: s.out0 + ct.tHl + 0.25, kind: 'tile' }); },
  stat(s, o, ev, sfx) { const { d0, dur } = statTimes(o); sfx.push([s.out0 + d0, 'ratchet', 0.9, { n: Math.round(dur * 14), rate: 14 }]); ev.push({ t: s.out0 + d0 + dur, kind: 'keyword' }); },
  posters(s, o, ev, sfx) { for (let f = Math.ceil(s.out0 * FPS) + 1; f < s.out1 * FPS; f++) if (posterIndex(s, o, f / FPS) !== posterIndex(s, o, (f - 1) / FPS)) ev.push({ t: f / FPS, kind: 'flip' }); },
  collection(s, o, ev, sfx) { collLayout(s, o).forEach(it => it.t0 > 0.05 && s.out0 + it.t0 < s.out1 && ev.push({ t: s.out0 + it.t0, kind: collKind(o) })); },
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
      if ((E.phrases[a.phrase]?.out || E.phrases[a.phrase]?.phone === 'in') && a.phrase !== s.phrase) return ev.push({ t, kind: 'portal' }); // a circle wipe or a push through a phone: a reverse riser into the cut
      const ins = x => x.kind !== 'cam' || E.phrases[x.phrase]?.window; ev.push({ t, kind: ins(s) || ins(a) ? 'cut_insert' : 'cut' });
    });
    for (const p of E.phrases) {
      if (p.kw && !p.insert && !p.ui && !p.window) ev.push({ t: p.kw.t, kind: p.graphic ? 'keyword_stat' : 'keyword' });
      if (p.lockup && p.kw) ev.push({ t: p.kw.t + GLINT, kind: 'glint', gain: 1.8 }); // at 1x it measured +0.4 dB under the voice: masked
      if (p.ui) { const u0 = p.start + (p.ui.delay ?? 0.15); ev.push({ t: u0, kind: 'pill' }, { t: u0 + 0.15, kind: 'glint', gain: 0.7 });
        (p.ui.rows || []).forEach((_, i) => u0 + rowAt(p.ui, i) < p.end && ev.push({ t: u0 + rowAt(p.ui, i), kind: 'tile' }));
        if (p.ui.stat) sfx.push([+(u0 + 0.25).toFixed(3), 'ratchet', 0.7, { n: 12, rate: 14 }]); }
      (p.pops || []).forEach((_, i) => ev.push({ t: popAt(p, i), kind: 'icon' }));
      if (p.phone && p.kw) sfx.push([+p.kw.t.toFixed(3), 'pop', 0.9]); // the post's heart pops on the keyword
      if (p.window) p.words.slice(1).forEach(w => ev.push({ t: w.t, kind: 'tile', gain: 0.6 })); // a soft tick as each giant word changes
      if (p.laugh === 'type') for (const [l0, l1] of p.laughAt || []) ev.push({ t: l0, kind: 'type', text: laughStr(Math.min(64, 1 + Math.floor((l1 - l0) * LAUGH_CPS))), cps: LAUGH_CPS });
      if (p.flash) ev.push({ t: p.start, kind: 'flash' });
      if (p.build) ev.push({ t: p.start, kind: 'build', dur: p.build === true ? 0.8 : p.build });
      if (p.hush) sfx.push([+p.end.toFixed(3), 'gap', 1, { dur: +(p.end - p.start).toFixed(3) }]); // the bed drops out before a payoff
      if (p.insert?.kind === 'chapter' && p.i) sfx.push([+p.start.toFixed(3), 'gap', 1, { dur: 0.35 }]); // the bed drops out, then changes (ref #44)
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
  if (E.bed === null) return null; if (E.bed && E.bed !== 'auto') return E.bed; if (!PRESET.bed) return null; // "bed": null in edit.json = no bed
  const end = E.shots.find(s => s.kind === 'end')?.out0 ?? E.duration, bars = Math.max(1, Math.round(end / 3.6));
  const chapters = E.shots.filter(s => s.insert?.kind === 'chapter' && s.out0 > 0 && s.out0 < end).map((s, i) => [s.out0, i % 2 ? 'intro' : 'arp']); // each chapter changes the bed
  return { bpm: +((240 * bars) / end).toFixed(5), chords: [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 60]], sections: [[0, 'intro'], ...chapters, ...(end < E.duration ? [[end, 'outro']] : [])] };
}

window.VIDEO = {
  duration: E.duration, audio: 'audio.wav', vo: 'dialogue.wav', lufs: PRESET.lufs,
  three: E.phrases.some(p => p.phone || (p.insert?.kind === 'app' && isPhone(p.insert))), // lib.js loads Three.js for phone3d
  blur: E.phrases.filter(p => p.phone === 'in').map(p => [+(p.end - 0.35).toFixed(3), p.end, 8]), // --subframes / --smooth: 8 samples on the push
  fonts: [`${B.font}:wght@500;600;800`, `${B.ui}:wght@400;500;600`, `${B.mono}:wght@500`],
  scenes: E.shots.map(s => ({ start: s.out0, end: s.out1, draw: (c, p, t) => (s.kind === 'cam' ? camShot(c, t, s) : INSERTS[s.insert.kind](c, t, s, s.insert)) })),
  overlay(c, t) {
    const ph = phraseAt(t), laughing = ph?.laugh === 'type' && (ph.laughAt || []).some(([a, b]) => t >= a && t <= b + 0.25);
    if (ph?.pops) popsOverlay(c, t, ph);
    if (ph?.ui) uiOverlay(c, t, ph);
    if (ph?.out) portalOverlay(c, t, ph); // under the captions: the keyword rides the wipe into the cut
    const capA = ph?.phone === 'in' ? 1 - prog(t, ph.end - 0.62, ph.end - 0.52) : 1; c.globalAlpha = capA; // captions clear before a push through a phone
    if (ph && capA > 0 && PRESET.captions && ph.caption !== false && !ph.window && !laughing && !(ph.ui?.takeover && t > ph.end - 0.35) && (ph.caption === true || !NOCAP.has(ph.insert?.kind))) {
      if (wordStyle(ph)) oneWord(c, t, ph);
      else if (ph.lockup && ph.kw) { lockup(c, t, ph); if (behindAt !== t) keyword(c, t, ph); }
      else { lead(c, t, ph); if (behindAt !== t && !ph.ui && ph.insert?.kind !== 'app') keyword(c, t, ph); } // a card or the app's toast is the keyword
    }
    c.globalAlpha = 1; if (laughing) laughType(c, t, ph);
    if (ph?.title) title(c, t, ph);
    for (const p of E.phrases) if (p.flash) flash(c, t, p.start, { fps: FPS });
    behindAt = -1;
  },
};
// ---- project inserts (this video only) ----

for (const p of E.phrases) { // captions round phones and code: above them in 9:16 (phone top at 0.38 H, under the platform's top bar); left of the phone in 16:9
  const k = p.insert?.kind, ph3 = p.phone || (k === 'app' && isPhone(p.insert));
  if (W < H && (ph3 || k === 'code')) { p.leadY ??= 0.17; p.kwY ??= 0.31; if (k === 'app') p.caption ??= true; }
  if (W >= H && ph3) { p.cx ??= 0.31; p.leadY ??= 0.38; p.kwY ??= 0.6; if (k === 'app') p.caption ??= true; }
  if (W >= H && k === 'code') p.caption ??= false; // the panel fills the middle of a wide frame
  if (E.phrases[p.i - 1]?.phone === 'in') p.z0 ??= 1.08; // after a push through the screen the shot keeps a little of the push
}
if (PRESET.captions) placeCaptions();
placeUI();
const SND = sounds(); Object.assign(VIDEO, { events: SND.ev, sfx: SND.sfx, bed: bed(), captions: E.phrases.map(p => [p.i, p.dy || 0, p.face || null]) });
