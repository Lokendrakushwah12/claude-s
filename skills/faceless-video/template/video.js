// faceless-video engine: timeline.js (build.py) -> VIDEO for lib.js. A shot is a clip (archival from archive-footage, or the
// user's own, as pre-extracted JPEGs) under a slow rostrum camera, or a canvas scene when no footage fits. Captions ride the
// voice's word times. look.js grades the picture; the captions and the end card stay crisp on top of it.
const F = window.FILM, FPS = F.fps, U = Math.min(W, H) / 1080, TALL = H > W;
const P = { ground: '#0d0c0a', table: '#262522', ink: '#f1ece0', dim: '#9a958a', accent: '#e9b85c', ...F.palette };
const SERIF = F.font || 'Instrument Serif', SANS = F.ui || 'Inter', CARD = F.card_font || 'Anton';

// ---- frames: decoded ahead and awaited by seek (render.mjs evaluates seek with awaitPromise) ----
const IM = new Map(), GOT = {};
function load(src) {
  if (!IM.has(src)) {
    const im = new Image(); im.src = src;
    IM.set(src, im.decode().then(() => (GOT[src] = im), () => (console.warn('missing frame', src), null)));
    if (IM.size > 200) { const k = IM.keys().next().value; IM.delete(k); delete GOT[k]; }
  }
  return IM.get(src);
}
// stutter n: hold every source frame n output frames (#37's step-printed riders: frames dropped, the motion jerks)
const frameOf = (s, t) => { let k = Math.floor((t - s.t0) * FPS + 1e-6); if (s.stutter) k -= k % s.stutter; return clamp(k, 0, s.n - 1); };
const srcOf = (s, t) => s.frames + String(frameOf(s, t) + 1).padStart(4, '0') + '.jpg';
const prevOf = s => F.shots[F.shots.indexOf(s) - 1];
const needs = t => F.shots.filter(s => t >= s.t0 && t < s.t1).flatMap(s => [...(s.frames ? [srcOf(s, t)] : []), ...(s.pops?.imgs || []),
  ...(fxList(s).includes('wipe') && t < s.t0 + WIPE && prevOf(s)?.frames ? [srcOf(prevOf(s), prevOf(s).t1 - 1 / FPS)] : [])]);
const drawAll = seek;
window.seek = async t => { await Promise.all(needs(t).map(load)); for (let k = 1; k <= 3; k++) needs(t + k / FPS).forEach(load); drawAll(t); };

// ---- camera: constant speed, so motion carries across cuts (a rostrum over a print); settle lands 12 % in and eases out ----
function cam(s, t) {
  const p = prog(t, s.t0, s.t1), dir = s.dir ?? ((s.line ?? 0) % 2 ? -1 : 1);
  return { push: { z: 1.02 + 0.06 * p }, pull: { z: 1.09 - 0.06 * p }, drift: { z: 1.07, x: dir * 0.03 * (p - 0.5) },
    rise: { z: 1.07, y: 0.03 * (0.5 - p) }, settle: { z: 1 + 0.12 * Math.exp(-(t - s.t0) / 0.35) }, still: { z: 1 } }[s.move || 'push'] || { z: 1 };
}
function full(c, im, s, t) {
  const { z, x = 0, y = 0 } = cam(s, t); c.save(); c.translate(W / 2 + x * W, H / 2 + y * H); c.scale(z, z); cover(c, im, -W / 2, -H / 2, W, H); c.restore();
}
// box: the whole frame, fitted (4:3 film in a 9:16 reel sits in the upper middle, captions under it; no face cropped off)
function box(c, im, s, t) {
  const { z } = cam(s, t), k = Math.min(W / im.width, (TALL ? H * 0.6 : H) / im.height), bw = im.width * k, bh = im.height * k, y0 = TALL ? H * 0.42 - bh / 2 : (H - bh) / 2;
  bg(c, P.ground); c.save(); c.beginPath(); c.rect((W - bw) / 2, y0, bw, bh); c.clip();
  c.translate(W / 2, y0 + bh / 2); c.scale(z, z); c.drawImage(im, -bw / 2, -bh / 2, bw, bh); c.restore();
}
// print: #37's device, the film as a photo print on a dark table, white border, curled corner, soft shadow
function print(c, im, s, t) {
  const { z } = cam(s, t), r = rng((s.t0 * 997) | 0), rot = (r() - 0.5) * 0.05;
  const pw = Math.min(W * 0.78, H * 0.6 * im.width / im.height), ph = pw * im.height / im.width, b = pw * 0.035, k = pw * 0.07;
  bg(c, P.table); paper(c, 0.18);
  c.save(); c.translate(W / 2, H * (TALL ? 0.44 : 0.5)); c.scale(z, z); c.rotate(rot);
  c.shadowColor = 'rgba(0,0,0,.55)'; c.shadowBlur = 40 * U; c.shadowOffsetY = 14 * U;
  c.fillStyle = '#f0ede4'; c.fillRect(-pw / 2 - b, -ph / 2 - b, pw + 2 * b, ph + 2 * b); c.shadowColor = 'transparent';
  c.drawImage(im, -pw / 2, -ph / 2, pw, ph);
  const cx = pw / 2 + b, cy = ph / 2 + b, g = c.createLinearGradient(cx - k, cy - k, cx - k / 2, cy - k / 2);
  g.addColorStop(0, '#cfcabd'); g.addColorStop(1, '#fbf8f0');
  c.fillStyle = P.table; c.beginPath(); c.moveTo(cx - k, cy); c.lineTo(cx, cy); c.lineTo(cx, cy - k); c.fill();
  c.fillStyle = g; c.beginPath(); c.moveTo(cx - k, cy); c.lineTo(cx, cy - k); c.lineTo(cx - k * 0.95, cy - k * 0.95); c.closePath(); c.fill();
  c.restore();
}
// crt: footage on a tube in the dark, rounded and soft at the edges, scanlines (#38's frame, without its timeline strip)
function crt(c, im, s, t) {
  const { z } = cam(s, t), sw = Math.min(W * 0.88, H * 0.62 * 4 / 3), sh = sw * 0.75, x0 = (W - sw) / 2, y0 = H * (TALL ? 0.42 : 0.47) - sh / 2, r = sw * 0.06;
  bg(c, '#050505'); c.save(); c.beginPath(); c.roundRect(x0, y0, sw, sh, r); c.clip();
  c.save(); c.translate(W / 2, y0 + sh / 2); c.scale(z, z); cover(c, im, -sw / 2, -sh / 2, sw, sh); c.restore();
  c.fillStyle = 'rgba(0,0,0,.22)'; for (let y = y0; y < y0 + sh; y += 3 * U) c.fillRect(x0, y, sw, 1.2 * U);
  const g = c.createRadialGradient(W / 2, y0 + sh / 2, sh * 0.35, W / 2, y0 + sh / 2, sw * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.75)'); c.fillStyle = g; c.fillRect(x0, y0, sw, sh);
  const hl = c.createLinearGradient(x0, y0, x0 + sw * 0.4, y0 + sh * 0.4); hl.addColorStop(0, 'rgba(255,255,255,.07)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = hl; c.fillRect(x0, y0, sw, sh); c.restore();
}

// ---- canvas scenes, for a line no footage fits. Drawn in greys so the archival grade makes them sit with the film ----
const SCENES = {
  sea(c, s, t) { // a horizon, swell bands in perspective under a soft blur, a sun path of glints flickering on twelves
    const hz = H * (TALL ? 0.42 : 0.45), sx = W * 0.6, sky = c.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#34373a'); sky.addColorStop(1, '#cfcabd'); c.fillStyle = sky; c.fillRect(0, 0, W, hz);
    const sun = c.createRadialGradient(sx, hz - H * 0.04, 0, sx, hz - H * 0.04, W * 0.35); sun.addColorStop(0, 'rgba(255,250,235,.9)'); sun.addColorStop(1, 'rgba(255,250,235,0)');
    c.fillStyle = sun; c.fillRect(0, 0, W, hz);
    const sea = c.createLinearGradient(0, hz, 0, H); sea.addColorStop(0, '#a7a397'); sea.addColorStop(1, '#202122'); c.fillStyle = sea; c.fillRect(0, hz, W, H - hz);
    const r = rng(7); c.save(); c.filter = `blur(${1.4 * U}px)`;
    for (let i = 0; i < 150; i++) {
      const q = (i + 0.5) / 150, y = hz + (H - hz) * q * q, th = (1 + 14 * q * q) * U, a = (1 + 18 * q * q) * U;
      const f = (0.006 + r() * 0.006) / (0.25 + q), ph = r() * 7, v = (0.5 + r()) * (0.6 + q);
      c.beginPath();
      for (let x = -20; x <= W + 20; x += 12 * U) c.lineTo(x, y + a * Math.sin(x * f + t * v + ph));
      for (let x = W + 20; x >= -20; x -= 12 * U) c.lineTo(x, y + th + a * Math.sin(x * f * 1.1 + t * v + ph + 0.8));
      c.fillStyle = `rgba(15,15,16,${0.1 + 0.25 * q})`; c.fill();
    }
    c.restore();
    const g = rng(boil(t, 12) * 31 + 1); c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 260; i++) {
      const q = g() ** 1.6, y = hz + 2 * U + (H - hz) * q * q, x = sx + (g() + g() - 1) * W * (0.03 + 0.35 * q), w = (2 + 18 * q) * U * g();
      c.fillStyle = `rgba(255,250,235,${0.5 * (1 - 0.6 * q)})`; c.beginPath(); c.ellipse(x, y, w, (0.6 + 1.6 * q) * U, 0, 0, 7); c.fill();
    }
    c.restore();
    const hzg = c.createLinearGradient(0, hz - 30 * U, 0, hz + 60 * U); hzg.addColorStop(0, 'rgba(220,216,205,0)'); hzg.addColorStop(0.4, 'rgba(220,216,205,.35)'); hzg.addColorStop(1, 'rgba(220,216,205,0)');
    c.fillStyle = hzg; c.fillRect(0, hz - 30 * U, W, 90 * U);
  },
  sky(c, s, t) { // slow cloud masses and a few birds crossing
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5d5f60'); sky.addColorStop(1, '#d8d3c6'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
    const r = rng(11);
    for (let k = 0; k < 9; k++) {
      const cx = ((r() * 1.6 - 0.3) * W + t * (8 + r() * 14) * U) % (W * 1.4) - W * 0.2, cy = H * (0.1 + r() * 0.7), sc = (120 + r() * 220) * U;
      for (let j = 0; j < 12; j++) { const x = cx + (r() - 0.5) * sc * 2.4, y = cy + (r() - 0.5) * sc * 0.5, rr = sc * (0.3 + r() * 0.5);
        const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(245,242,234,.55)'); g.addColorStop(1, 'rgba(245,242,234,0)'); c.fillStyle = g; c.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); }
    }
    c.strokeStyle = 'rgba(25,25,25,.8)'; c.lineWidth = 2.2 * U;
    for (let b = 0; b < 5; b++) { const x = ((t - s.t0) * (60 + b * 9) * U + b * 70 * U) - 100 * U, y = H * 0.3 + b * 23 * U + Math.sin(t + b) * 6 * U, w = 9 * U, f = Math.sin(t * 9 + b) * 5 * U;
      c.beginPath(); c.moveTo(x - w, y - f); c.quadraticCurveTo(x - w / 2, y - 2 * U, x, y); c.quadraticCurveTo(x + w / 2, y - 2 * U, x + w, y - f); c.stroke(); }
  },
  card(c, s, t) { // the commentary reel's word card: one heavy condensed word on a solid red, white or black slab, a slow push
    const bgc = { red: '#b3121b', white: '#f2f0eb', black: '#0b0b0b' }[s.bg || 'red'] || s.bg, sz = (s.size || (TALL ? 200 : 170)) * U;
    bg(c, bgc); const z = 1 + 0.05 * prog(t, s.t0, s.t1); c.save(); c.translate(W / 2, H / 2); c.scale(z, z);
    para(c, (s.title || '').toUpperCase(), 0, 0, W * 0.86, { size: sz, font: `${sz}px "${CARD}"`, color: s.ink || (s.bg === 'white' ? '#141414' : '#f2f0eb'), lead: 0.95 });
    c.restore();
  },
  intertitle(c, s, t) { // a silent-film title card: thin double border, one line of serif; the look ages it
    bg(c, '#0b0a09'); const m = Math.min(W, H) * 0.08;
    c.strokeStyle = 'rgba(232,226,210,.75)'; c.lineWidth = 2 * U; c.strokeRect(m, m * (TALL ? 3 : 1), W - 2 * m, H - 2 * m * (TALL ? 3 : 1));
    c.lineWidth = 1 * U; c.strokeRect(m + 9 * U, m * (TALL ? 3 : 1) + 9 * U, W - 2 * m - 18 * U, H - 2 * m * (TALL ? 3 : 1) - 18 * U);
    para(c, s.title || '', W / 2, H / 2, W - 4 * m, { size: (TALL ? 76 : 64) * U, font: `italic 400 ${(TALL ? 76 : 64) * U}px "${SERIF}"`, color: '#ece6d6', lead: 1.15 });
  },
};

function shot(c, s, t) {
  if (s.scene) SCENES[s.scene] ? SCENES[s.scene](c, s, t) : console.warn('no canvas scene', s.scene);
  else { const im = GOT[srcOf(s, t)]; if (im) ({ full, box, print, crt })[s.frame || 'full'](c, im, s, t); }
  if (s.spot) spot(c, s);
  if (s.pops) pops(c, s, t);
  fxIn(c, s, t);
}

// ---- the commentary reel's cut tricks (Nvidia reel, measured frame by frame 2026-11-14), on a shot's first frames.
// fx: a name or a list. invert: a colour-negative frame with a hard black or white block (0.12, 1.50, 2.25, 22.12 s), then
// one negative frame more. blocks: white and black tiles snap over the incoming shot for 2 frames (0.62, 22.25, 43.6 s).
// glitch: a red/cyan channel split for 3 frames, shrinking (13.25 s). wipe: an accent bar sweeps right to left over 0.22 s,
// the old shot's last frame still on its left (42.25 s). build.py puts a sound on each (FX_SOUND there).
const WIPE = 0.22, fxList = s => [].concat(s.fx || []);
function scratchOf(c) { const k = c.canvas; (scratchOf.cv ??= document.createElement('canvas')); const v = scratchOf.cv; if (v.width !== k.width) { v.width = k.width; v.height = k.height; }
  const x = v.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, v.width, v.height); x.drawImage(k, 0, 0); return v; }
function fxIn(c, s, t) {
  const fx = fxList(s); if (!fx.length) return;
  const f = Math.floor((t - s.t0) * FPS + 1e-6), r = rng(((s.t0 * 997) | 0) + 3), cw = c.canvas.width, ch = c.canvas.height;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  if (fx.includes('wipe') && t < s.t0 + WIPE) {
    const p = ease.inOut(prog(t, s.t0, s.t0 + WIPE)), x = cw * (1 - p), pv = prevOf(s), im = pv && GOT[srcOf(pv, pv.t1 - 1 / FPS)];
    c.save(); c.beginPath(); c.rect(0, 0, x, ch); c.clip(); im ? cover(c, im, 0, 0, cw, ch) : bg(c, '#f2f0eb'); c.restore();
    c.fillStyle = P.accent; c.fillRect(x - cw * 0.012, 0, cw * 0.024, ch);
  }
  if (fx.includes('glitch') && f <= 2) {
    const v = scratchOf(c), dx = (3 - f) * 9 * U * (c.canvas.width / W), tint = (col, ox) => { const k = document.createElement('canvas'); k.width = cw; k.height = ch; const x = k.getContext('2d');
      x.drawImage(v, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, cw, ch); c.drawImage(k, ox, 0); };
    c.fillStyle = '#000'; c.fillRect(0, 0, cw, ch); c.globalCompositeOperation = 'lighter'; tint('#ff0000', dx); tint('#00ffff', -dx); c.globalCompositeOperation = 'source-over';
  }
  if (fx.includes('invert') && f <= 1) {
    const v = scratchOf(c); c.filter = 'invert(1)'; c.drawImage(v, 0, 0); c.filter = 'none';
    if (f === 0) { const bw = cw * (0.22 + 0.14 * r()), bh = ch * (0.26 + 0.14 * r()), bx = r() < 0.5 ? 0 : cw - bw, by = r() < 0.5 ? 0 : ch - bh;
      c.fillStyle = r() < 0.5 ? '#000' : '#fff'; c.fillRect(bx, by, bw, bh); }
  }
  if (fx.includes('blocks') && f <= 1) {
    const cells = [...Array(9).keys()].sort(() => r() - 0.5).slice(0, f ? 2 : 3), tw = cw / 3, th = ch / 3;
    cells.forEach((k, i) => { c.fillStyle = (i + f) % 2 ? '#000' : '#fff'; c.fillRect((k % 3) * tw, Math.floor(k / 3) * th, tw, th); });
  }
  c.restore();
}
// spot: {x, y, size} (0..1; size = the square's side as a fraction of the height): the commentary reel's square window on the
// subject (the chip, 1.6-2.1 s), everything outside it near black
function spot(c, s) {
  const o = s.spot === true ? {} : s.spot, side = H * (o.size || 0.45), x = W * (o.x ?? 0.5) - side / 2, y = H * (o.y ?? 0.45) - side / 2;
  c.save(); c.fillStyle = 'rgba(0,0,0,.9)'; c.beginPath(); c.rect(0, 0, W, H); c.rect(x, y, side, side); c.fill('evenodd'); c.restore();
}
// pops: the commentary reel's image burst (Nvidia reel, 22.1-23.5 s and 43.4-44.9 s). A still lands every `every` s (0.12),
// a white slab for one frame and then the image, with a click on each (build.py). collage: the shot behind blurs and
// darkens and the stills scatter over the middle, overlapping. grid: black, then a 3x3 grid fills from the bottom-right
// and keeps swapping tiles while images last.
function pops(c, s, t) {
  const p = s.pops, every = p.every || 0.12, grid = p.mode === 'grid', since = t - s.t0 - (p.at || 0), k = Math.floor(since / every + 1e-6);
  if (k < 0) return;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  if (p.mode === 'strobe') { // the commentary reel's product run (3.0-4.5 s, 13.4-14.4 s): one image per step on a plate
    c.restore(); const i = Math.min(k, p.imgs.length - 1), im = GOT[p.imgs[i]], dark = i % 2 === 1, sz = W * (p.size || 0.5);
    bg(c, dark ? '#050505' : '#f2f0eb');
    // the negative goes on the plate that turns the image's own background into the plate's colour, so it reads as a
    // cut-out: light-background stills invert on black (the default), dark ones (source: "dark", a GPU on a black stage) on white
    if (im) { const w = Math.min(sz, H * 0.62 * im.width / im.height), h = w * im.height / im.width; c.save(); if (dark !== (p.source === 'dark')) c.filter = 'invert(1)';
      c.shadowColor = dark ? 'transparent' : 'rgba(0,0,0,.25)'; c.shadowBlur = 30 * U; c.drawImage(im, (W - w) / 2, H * 0.46 - h / 2, w, h); c.restore(); }
    return;
  }
  if (grid) { c.fillStyle = '#000'; c.fillRect(0, 0, c.canvas.width, c.canvas.height); }
  else { c.filter = 'blur(14px) brightness(0.45)'; c.drawImage(c.canvas, 0, 0); }
  c.restore();
  const r = rng(((s.t0 * 997) | 0) + 7), at = [], n = Math.min(k + 1, p.imgs.length), sz = W * (p.size || 0.24);
  for (let i = 0; i < p.imgs.length; i++) at.push([W * (0.5 + 0.5 * (r() - 0.5)), H * (0.48 + 0.42 * (r() - 0.5)), (r() - 0.5) * 0.06]);
  for (let i = 0; i < n; i++) {
    const im = GOT[p.imgs[i]], fresh = since - i * every < 1 / FPS;
    if (grid) {
      const slot = 8 - (i % 9), tw = W / 3, th = H / 3, x = (slot % 3) * tw, y = Math.floor(slot / 3) * th;
      if (fresh || !im) { c.fillStyle = '#fff'; c.fillRect(x + 2 * U, y + 2 * U, tw - 4 * U, th - 4 * U); }
      else cover(c, im, x + 2 * U, y + 2 * U, tw - 4 * U, th - 4 * U);
    } else {
      const [x, y, rot] = at[i], w = sz, h = im ? w * im.height / im.width : w * 0.66;
      c.save(); c.translate(x, y); c.rotate(rot); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 24 * U;
      if (fresh || !im) { c.fillStyle = '#fff'; c.fillRect(-w / 2, -h / 2, w, h); } else c.drawImage(im, -w / 2, -h / 2, w, h);
      c.restore();
    }
  }
}

// ---- text ----
function layout(c, words, maxW, font) { // fixed positions for the whole line, so words don't shuffle as they appear
  c.font = font; const sp = c.measureText(' ').width, rows = [[]]; let w = 0;
  for (const wd of words) { const ww = c.measureText(wd).width; if (w + ww > maxW && rows.at(-1).length) { rows.push([]); w = 0; } rows.at(-1).push({ wd, ww }); w += ww + sp; }
  return rows.map(r => ({ r, w: r.reduce((s, x) => s + x.ww + sp, -sp) })).map(({ r, w }) => { let x = -w / 2; return r.map(o => { const p = { ...o, x: x + o.ww / 2 }; x += o.ww + sp; return p; }); });
}
function para(c, str, x, y, maxW, o) {
  const rows = layout(c, str.split(' '), maxW, o.font), lh = o.size * o.lead;
  c.save(); c.font = o.font; c.fillStyle = o.color; c.textAlign = 'center'; c.textBaseline = 'middle';
  rows.forEach((r, i) => r.forEach(p => c.fillText(p.wd, x + p.x, y + (i - (rows.length - 1) / 2) * lh))); c.restore();
}
// captions: the line builds word by word on the voice's onsets and clears when it ends (#29, #30); the word being said is
// in the accent. 'caps' is #38's small spaced capitals; 'none' leaves the picture alone.
const LINES = {};
F.words.forEach((w, i) => { (LINES[w.line] ??= []).push({ ...w, i }); });
Object.values(LINES).forEach((ws, k, all) => { const nx = all[k + 1]?.[0].t0 ?? 1e9; ws.end = Math.min(ws.at(-1).t1 + 0.35, nx - 0.05); });
function captions(c, t) {
  if (F.captions === 'none') return;
  const ws = Object.values(LINES).find(l => t >= l[0].t0 - 0.04 && t < l.end); if (!ws) return;
  const caps = F.captions === 'caps', size = (caps ? 30 : TALL ? 58 : 46) * U, font = caps ? `600 ${size}px "${SANS}"` : `500 ${size}px "${SANS}"`;
  c.save(); c.letterSpacing = caps ? `${size * 0.16}px` : '0px';
  const rows = layout(c, ws.map(w => caps ? w.w.toUpperCase() : w.w), W * 0.84, font), lh = size * 1.25, y0 = H * (TALL ? 0.76 : 0.85) - (rows.length - 1) * lh / 2;
  // over a white word card or a white strobe plate the captions go dark (white on white vanished), the said word in the card red
  const strobeWhite = s => { const p = s.pops, k = Math.floor((t - s.t0 - (p.at || 0)) / (p.every || 0.12) + 1e-6); return k >= 0 && Math.min(k, p.imgs.length - 1) % 2 === 0; };
  const light = F.shots.some(s => t >= s.t0 && t < s.t1 && ((s.scene === 'card' && s.bg === 'white') || (s.pops?.mode === 'strobe' && strobeWhite(s)))),
    ink = light ? '#141414' : P.ink, hot = light ? '#b3121b' : P.accent;
  c.font = font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = light ? 'transparent' : 'rgba(0,0,0,.65)'; c.shadowBlur = 18 * U;
  let k = 0;
  rows.forEach((r, ri) => r.forEach(p => {
    const w = ws[k++], a = prog(t, w.t0 - 0.04, w.t0 + 0.06); if (a <= 0) return;
    const now = t >= w.t0 - 0.04 && t < (ws[k]?.t0 ?? ws.end) - 0.04;
    c.globalAlpha = a; c.fillStyle = now && !caps ? hot : ink; c.fillText(p.wd, W / 2 + p.x, y0 + ri * lh + (1 - a) * 6 * U);
  }));
  c.restore();
}
function flash(c, t) { // flash: true on a shot = #30's one-frame white burst around a change (0.85, then 0.4)
  for (const s of F.shots) if (s.flash) { const f = Math.floor((t - s.t0) * FPS + 1e-6); if (f === 0 || f === 1) { c.save(); c.globalAlpha = f ? 0.4 : 0.85; bg(c, '#fff'); c.restore(); } }
}
function endCard(c, t) {
  const E = F.end; if (t < E.t0) return; const p = k => ease.out(prog(t, E.t0 + k, E.t0 + k + 0.5));
  c.save(); c.globalAlpha = p(0.1);
  para(c, E.title || '', W / 2, H * (TALL ? 0.42 : 0.4), W * 0.8, { size: (TALL ? 96 : 84) * U, font: `400 ${(TALL ? 96 : 84) * U}px "${SERIF}"`, color: P.ink, lead: 1.05 });
  c.globalAlpha = p(0.35); if (E.sub) para(c, E.sub, W / 2, H * (TALL ? 0.5 : 0.52), W * 0.8, { size: 30 * U, font: `400 ${30 * U}px "${SANS}"`, color: P.dim, lead: 1.3 });
  c.globalAlpha = p(0.6); const cs = E.credits || [];
  if (cs.length) { c.font = `400 ${17 * U}px "${SANS}"`; c.fillStyle = P.dim; c.textAlign = 'center';
    c.fillText(E.credit_label || 'ARCHIVAL FOOTAGE', W / 2, H * 0.8 - (cs.length + 0.6) * 24 * U); cs.forEach((ln, i) => c.fillText(ln, W / 2, H * 0.8 - (cs.length - 1 - i) * 24 * U, W * 0.92)); }
  c.restore();
}

window.VIDEO = {
  duration: F.duration, audio: 'audio.wav',
  fonts: F.fonts || [`${SERIF}:ital@0;1`, `${SANS}:wght@400;500;600`, ...(F.shots.some(s => s.scene === 'card') ? [CARD] : [])],
  scenes: [...F.shots.map(s => ({ start: s.t0, end: s.t1, draw: (c, p, t) => shot(c, s, t) })), { start: F.end.t0, end: F.end.t1 + 1, draw: c => bg(c, P.ground) }],
  overlay(c, t) {
    if (F.look) applyLook(c, t, null, { ...LOOK[F.look.preset || 'archival'], ...F.look, k: F.look.k ?? 0.6 });
    flash(c, t); captions(c, t); endCard(c, t);
  },
};
