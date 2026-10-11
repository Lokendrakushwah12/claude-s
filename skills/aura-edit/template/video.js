// aura-edit engine: timeline.js (aura.py build) -> VIDEO. A beat-led hype edit: footage retimed on speed ramps and blended
// between its own frames, hits on the beat grid (drop punch shake flash impact blur split sweep stop), type that slams on the
// beat, the aura look, and a bed with a drop. Picture and sound read the same hit times, so they can't drift.
// Project layers (an idea the footage can't show) go at the bottom: INSERTS.<kind>(c, t, s) for a whole shot, LAYERS for
// things drawn over every shot (after the type, before the hits).
const A = window.AURA, FPS = A.fps, OVERSCAN = 1.07; // overscan covers the edges a shake would show (±26 px, ±0.7°)
const B = { accent: '#FF3B2F', ink: '#FFFFFF', ground: '#050505', font: 'Inter Tight', mono: 'JetBrains Mono', ...A.brand };
Object.assign(TYPE, { display: B.font, ui: B.font, mono: B.mono, weight: 800, track: -0.03 });
const pad4 = k => String(k + 1).padStart(4, '0'), LOOKS = !location.search.includes('look=0');
const beatT = b => +(b * A.spb).toFixed(4); // beat -> seconds, rounded like aura.py, so `t < beatT(12)` is false ON the drop frame

// ---- hits: what each kind does to the picture, and the sound it brings (sfx.py rows, offsets in s from the hit) ----
const HIT = {
  drop: { punch: 0.16, shake: 1, flash: 1, impact: 2, blur: 1, split: 1, sfx: [[0, 'impact', 1], [0, 'sub_boom', 1]] },
  punch: { punch: 0.07 }, shake: { shake: 1 }, flash: { flash: 1, sfx: [[0, 'flash_hit', 0.7]] },
  impact: { impact: 2, shake: 0.6, sfx: [[0, 'impact', 0.7]] }, blur: { blur: 1, sfx: [[0, 'whoosh', 0.6]] },
  split: { split: 1 }, sweep: { sweep: 1 }, stop: { stop: 1 },
};
const hitsOf = key => A.hits.filter(h => (HIT[h.kind] || {})[key]).map(h => ({ ...h, k: h[key] ?? HIT[h.kind][key] }));
const H_ = Object.fromEntries(['punch', 'shake', 'flash', 'impact', 'blur', 'split', 'sweep', 'stop'].map(k => [k, hitsOf(k)]));
// A stop freezes the picture for its dur (beats in aura.json): the shot's clock holds while the grain keeps running.
const pic = t => { for (const h of H_.stop) if (t >= h.t && t < h.t + (h.dur ?? 0.25)) return h.t; return t; };
const decay = (t, list, tau) => list.reduce((m, h) => (t >= h.t ? Math.max(m, h.k * Math.exp(-(t - h.t) / tau)) : m), 0);

// ---- frames: pre-extracted JPEGs at the source's own frame rate; seek(t) awaits their decode ----
const IM = new Map(), GOT = {};
function load(src) {
  if (!IM.has(src)) {
    const im = new Image(); im.src = src;
    IM.set(src, im.decode().then(() => (GOT[src] = im), () => (console.warn('missing frame', src), null)));
    if (IM.size > 160) { const k = IM.keys().next().value; IM.delete(k); delete GOT[k]; }
  }
  return IM.get(src);
}
const shotAt = t => A.shots.find(s => t >= s.out0 && t < s.out1) || A.shots[A.shots.length - 1];
// Which source frame shows at t: the ramp's exact integral (type.js retime), as a fractional index into the shot's frames.
// A strobe shot holds a still per card (deck), the #24 stills strobe made from the footage itself.
function cardOf(s, t) { // [card index, its first frame]: hold = frames per card, or a cadence such as [3, 3, 3, 3, 3, 3, 6] (#48)
  const { hold = 3, fps = 24 } = s.strobe, f = Math.floor((t - s.out0) * fps + 1e-6), hs = [].concat(hold), L = hs.reduce((a, b) => a + b), k = Math.floor(f / L);
  let i = 0, f0 = k * L; while (f0 + hs[i] <= f) f0 += hs[i++];
  return [k * hs.length + i, f0];
}
function srcFrame(s, t) {
  const u = s.strobe ? cardOf(s, t)[1] / (s.strobe.fps || 24) : t - s.out0;
  return clamp((s.src0 + retime(u, s.keys)) * s.fps - s.f0, 0, s.n - 1);
}
function needs(t) {
  const s = shotAt(pic(t)); if (s.kind !== 'clip') return [];
  const f = srcFrame(s, pic(t)), i = Math.floor(f), out = [s.frames + pad4(i) + '.jpg'];
  if (f - i > 0.01) out.push(s.frames + pad4(i + 1) + '.jpg');
  if (s.matte) out.push(s.frames + 'm' + pad4(Math.round(f)) + '.jpg');
  return out;
}
const drawAll = seek;
window.seek = async t => { await Promise.all(needs(t).map(load)); for (let k = 1; k <= 3; k++) needs(t + k / FPS).forEach(load); drawAll(t); };

// ---- the shot: cover-fit, base zoom about its focus, punches and shake on top; frames blended by their fraction ----
function frameBox(s) { const sc = Math.max(W / s.fw, H / s.fh); return [(W - s.fw * sc) / 2, (H - s.fh * sc) / 2, s.fw * sc, s.fh * sc]; }
function camera(c, t, s) {
  shake(c, t, H_.shake.map(h => h.t), { amp: 26 * S, tau: 0.16 });
  const zs = s.strobe?.zooms, zz = s.zoom || 1, zr = Array.isArray(zz) ? lerp(zz[0], zz[1], ease.inOut(prog(t, s.out0, s.out1))) : zz; // zoom: n, or [from, to] over the shot
  const z0 = (zs ? zs[cardOf(s, t)[0] % zs.length] : zr) * OVERSCAN; // a strobe steps its crop per card
  const [fx, fy] = s.focus || [0.5, 0.45], z = H_.punch.reduce((z, h) => z * punch(t, [h.t], h.k, h.kind === 'drop' ? 0.22 : 0.12), z0);
  cam(c, z, fx * W, fy * H);
}
function footage(c, t, s) { // the shot's picture at time t (picture time: stops already applied)
  const f = srcFrame(s, t), i = Math.floor(f), a = f - i, box = frameBox(s), im0 = GOT[s.frames + pad4(i) + '.jpg'], im1 = a > 0.01 && GOT[s.frames + pad4(i + 1) + '.jpg'];
  if (!im0) return bg(c, B.ground);
  c.drawImage(im0, ...box); if (im1) { c.save(); c.globalAlpha *= a; c.drawImage(im1, ...box); c.restore(); }
}
function alphaOf(img) { // grey matte (white = subject) -> alpha, for type.js behind()
  const [cv, x] = scratch('matteA', img.width, img.height); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height); for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = d.data[i];
  x.putImageData(d, 0, 0); return cv;
}
function shot(c, t, s, drawType) {
  c.save(); camera(c, t, s);
  if (s.insert) { INSERTS[s.insert](c, t, s); c.restore(); return drawType(c); }
  const k = pad4(Math.round(srcFrame(s, t))), m = s.matte && GOT[s.frames + 'm' + k + '.jpg'], im = GOT[s.frames + k + '.jpg'];
  if (m && im) { // type behind the subject (type.js behind): footage, type in screen space, the subject again through its matte
    behind(c, im, alphaOf(m), cc => { cc.save(); cc.setTransform(1, 0, 0, 1, 0, 0); drawType(cc); cc.restore(); }, frameBox(s)); return c.restore();
  }
  footage(c, t, s); c.restore(); drawType(c);
}

// ---- type: slam (lands on the beat at 1.5x and settles in 3 frames, optionally a new face every `hold` frames) or mask ----
function typeAt(c, t, y) { // a mask fills the width (it has to hold picture); a slam stays under 0.3 W
  const fit = (0.86 * W * 100) / tw(c, y.text, 100, y.weight || 800, y.fonts?.[0] || B.font, y.track), u = t - y.t0, size = y.size ? y.size * S : y.kind === 'mask' ? fit * 1.09 : Math.min(0.3 * W, fit);
  const font = y.fonts ? y.fonts[deck(t, y.t0, y.fonts.length, y.hold || 2, 24)] : B.font, yy = H * (y.y ?? 0.5), o = { size, weight: y.weight || 800, font, color: y.color || B.ink, align: 'center', ...(y.track != null ? { track: y.track } : {}) };
  if (y.kind === 'mask') { // a window onto the shot: the frame dimmed, the word cut through to the undimmed frame
    const s = shotAt(pic(t)); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 0.9 * clamp(u / 0.1); c.fillStyle = B.ground; c.fillRect(0, 0, W, H); c.restore();
    maskWord(c, y.text, W / 2, yy, cc => { cc.save(); camera(cc, t, s); cc.filter = 'brightness(1.3) contrast(1.15)'; s.insert ? INSERTS[s.insert](cc, t, s) : footage(cc, pic(t), s); cc.restore(); }, o);
    return word(c, y.text, W / 2, yy, { ...o, stroke: 2.5 * S, color: '#ffffff', alpha: 0.55 }); // a hairline keeps the word legible where the picture is dark
  }
  const p = ease.out(clamp(u / (3 / FPS))), sc = lerp(y.from ?? 1.5, 1, p); // from 1: the word just cuts on (one word per caption, on its onset)
  c.save(); c.translate(W / 2, yy); c.scale(sc, sc); c.translate(-W / 2, -yy); c.shadowColor = o.color; c.shadowBlur = 40 * S * (1 - clamp(u / 0.3));
  word(c, y.text, W / 2, yy + size * 0.35, o); c.restore();
}
const typeLayer = t => c => A.type.filter(y => t >= y.t0 && t < y.t1).forEach(y => typeAt(c, t, y));

// ---- hits after the scene: zoom blur, RGB split, a light sweep, the impact frame (2 frames), the exposure flash ----
function hits(c, t) {
  const s = shotAt(pic(t)), [fx, fy] = s.focus || [0.5, 0.45];
  zoomBlur(c, decay(t, H_.blur, 0.09), fx, fy); rgbSplit(c, 1.2 * decay(t, H_.split, 0.14));
  for (const h of H_.sweep) lightSweep(c, (t - h.t) / (h.dur ?? 0.4), { angle: h.angle ?? 0.5, k: h.k2 ?? 0.7, width: h.width ?? 0.16 });
  for (const h of H_.impact) if (t >= h.t && t < h.t + h.k / FPS) impactFrame(c, 1, { tint: h.tint });
  for (const h of H_.flash) if (h.k) flash(c, t, h.t + (h.impact ?? HIT[h.kind].impact ?? 0) / FPS, { fps: FPS, table: FLASH.exposure.map(v => v * h.k) }); // after the hit's impact frames; {flash: 0.6} is softer, 0 is none
}

window.VIDEO = {
  duration: A.duration,
  audio: 'audio.wav',
  fonts: A.fonts ?? ['Inter Tight:wght@500;800;900', 'JetBrains Mono:wght@500;700'],
  bed: A.sound.bed, mutes: A.sound.mutes, lufs: A.sound.lufs, ...(A.sound.vo ? { vo: A.sound.vo } : {}), ...(A.sound.music ? { music: A.sound.music } : {}),
  sfx: [...A.sound.sfx, ...A.hits.flatMap(h => h.kind === 'stop' ? [[+(h.t + (h.dur ?? 0.25)).toFixed(4), 'gap', 1, { dur: h.dur ?? 0.25 }]]
    : (h.sfx ?? HIT[h.kind]?.sfx ?? []).map(([dt, n, g]) => [+(h.t + dt).toFixed(4), n, g]))],
  overlay(c, t) { hits(c, t); if (A.frame) lensBand(c, 1, A.frame); if (LOOKS) applyLook(c, t, null, LOOK_AT(t)); }, // frame: the #49 lens band
  scenes: [{ start: 0, end: A.duration, draw(c, p, t) {
    bg(c, B.ground); const pt = pic(t), s = shotAt(pt);
    shot(c, pt, s, cc => { typeLayer(t)(cc); LAYERS.forEach(f => f(cc, t, pt, s)); });
  } }],
};

// ---- project layers ----
const INSERTS = {}; // INSERTS.<kind> = (c, t, s) => draw a whole shot (the camera is already applied)
const LAYERS = [];  // (c, t, pt, s) => draw over every shot; pt = picture time (frozen during a stop)
let LOOK_AT = t => A.look ?? LOOK.aura; // a look per time (e.g. black and white until the drop): reassign it below
