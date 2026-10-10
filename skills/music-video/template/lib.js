// Scene engine + drawing helpers. Deterministic: seek(t) always draws the same frame for the same t,
// which is what lets render.mjs capture it frame by frame. Don't use Date.now() or Math.random() in scenes.
// Size comes from ?size=WxH (render.mjs --size), so one video.js can render 16:9, 1:1 and 9:16. Lay out with W/H, not constants.
const [W, H] = (new URLSearchParams(location.search).get('size') || '1920x1080').split('x').map(Number);
const cv = document.getElementById('c');
cv.width = W; cv.height = H; cv.style.width = `min(100vw, ${(W / H) * 100}vh)`;
const ctx = cv.getContext('2d');
const RENDER = location.search.includes('render');
window.LYRICS = window.LYRICS || [];
window.BEATS = window.BEATS || [];

// ---- math ----
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const prog = (t, a, b) => clamp((t - a) / (b - a)); // 0..1 progress of t through [a, b]
const ease = {
  out: p => 1 - (1 - p) ** 3,
  in: p => p ** 3,
  inOut: p => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  back: p => 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2,
  elastic: p => (p <= 0 || p >= 1 ? p : 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};
function rng(seed) { // mulberry32, seeded so every frame is reproducible
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// Hand-drawn "boil": the value only changes 12x/second, like animation on twos.
const boil = (t, fps = 12) => Math.floor(t * fps);
const wobble = (seed, t, amp = 2) => { const r = rng(seed * 7919 + boil(t)); return [(r() - 0.5) * amp, (r() - 0.5) * amp]; };

// ---- music ----
const lyricAt = t => LYRICS.find(l => t >= l.start && t < l.end);
const beatIndex = t => { let i = -1; for (const b of BEATS) { if (b > t) break; i++; } return i; };
const sinceBeat = t => { const i = beatIndex(t); return i < 0 ? 99 : t - BEATS[i]; };
const pulse = (t, decay = 0.25) => Math.exp(-sinceBeat(t) / decay); // 1 on the beat, falls off after

// ---- assets ----
const IMGS = {};
const img = name => IMGS[name]; // name = file in assets/, declared in VIDEO.assets

// ---- drawing ----
function bg(c, color) { c.fillStyle = color; c.fillRect(0, 0, W, H); }
function text(c, str, x, y, o = {}) {
  const { size = 120, font = 'Anton', color = '#111', align = 'center', base = 'middle', weight = '', italic = false, stroke, lw = 8, rot = 0, scale = 1, alpha = 1, spacing = 0 } = o;
  c.save(); c.globalAlpha *= alpha; c.translate(x, y); c.rotate(rot); c.scale(scale, scale);
  c.font = `${italic ? 'italic ' : ''}${weight} ${size}px "${font}"`; c.textAlign = align; c.textBaseline = base;
  c.letterSpacing = spacing + 'px';
  if (stroke) { c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = stroke; c.strokeText(str, 0, 0); }
  c.fillStyle = color; c.fillText(str, 0, 0);
  c.restore();
}
// Word-by-word kinetic lyric: each word pops in at its sung time (falls back to even spacing).
function kinetic(c, line, t, o = {}) {
  if (!line) return;
  const { x = W / 2, y = H / 2, size = 140, font = 'Anton', color = '#111', maxW = W * 0.8, lead = 1.05, pop = 0.18, ...rest } = o;
  const words = line.words?.length ? line.words : line.text.split(' ').map((w, i, a) => ({ w, s: lerp(line.start, line.end, i / a.length) }));
  c.save(); c.font = `${size}px "${font}"`; c.letterSpacing = (rest.spacing || 0) + 'px';
  const rows = [[]]; let rw = 0; const sp = c.measureText(' ').width;
  for (const wd of words) { const ww = c.measureText(wd.w).width; if (rw + ww > maxW && rows.at(-1).length) { rows.push([]); rw = 0; } rows.at(-1).push({ ...wd, ww }); rw += ww + sp; }
  c.restore();
  rows.forEach((row, ri) => {
    const total = row.reduce((s, w) => s + w.ww + sp, -sp);
    let cx = x - total / 2; const cy = y + (ri - (rows.length - 1) / 2) * size * lead;
    for (const wd of row) {
      const p = prog(t, wd.s - 0.04, wd.s - 0.04 + pop);
      if (p > 0) text(c, wd.w, cx + wd.ww / 2, cy + (1 - ease.out(p)) * size * 0.3, { size, font, color, ...rest, scale: ease.back(p), alpha: p });
      cx += wd.ww + sp;
    }
  });
}
// Draw an image to cover a box (like CSS object-fit: cover).
function cover(c, im, x = 0, y = 0, w = W, h = H) {
  if (!im) return; const s = Math.max(w / im.width, h / im.height);
  c.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s);
}
// Paper grain + fibres, generated once, multiplied over every frame.
let PAPER;
function paper(c, strength = 0.5, seed = 1) {
  if (!PAPER) {
    PAPER = document.createElement('canvas'); PAPER.width = W; PAPER.height = H;
    const p = PAPER.getContext('2d'), r = rng(seed), d = p.createImageData(W, H);
    for (let i = 0; i < d.data.length; i += 4) { const v = 225 + r() * 30; d.data[i] = v; d.data[i + 1] = v - 2; d.data[i + 2] = v - 8; d.data[i + 3] = 255; }
    p.putImageData(d, 0, 0); p.strokeStyle = 'rgba(120,100,80,0.08)';
    for (let i = 0; i < 900; i++) { p.lineWidth = r() * 1.5; p.beginPath(); const x = r() * W, y = r() * H, a = r() * 6.28, l = 10 + r() * 50; p.moveTo(x, y); p.quadraticCurveTo(x + r() * 20, y + r() * 20, x + Math.cos(a) * l, y + Math.sin(a) * l); p.stroke(); }
  }
  c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = strength; c.drawImage(PAPER, 0, 0); c.restore();
}

// ---- engine ----
function seek(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, W, H);
  for (const s of VIDEO.scenes) {
    if (t < s.start || t >= s.end) continue;
    ctx.save(); s.draw(ctx, prog(t, s.start, s.end), t, s); ctx.restore();
  }
  if (VIDEO.overlay) { ctx.save(); VIDEO.overlay(ctx, t); ctx.restore(); }
}

function boot() {
  // VIDEO.fonts entries are Google Fonts css2 specs: 'Anton', 'Instrument Serif:ital@0;1', 'Inter:wght@400;900'.
  const fonts = VIDEO.fonts || [];
  const css = !fonts.length ? Promise.resolve() : new Promise(res => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.onload = l.onerror = res;
    l.href = 'https://fonts.googleapis.com/css2?' + fonts.map(f => 'family=' + f.replace(/ /g, '+')).join('&') + '&display=block';
    document.head.appendChild(l);
  });
  const loads = (VIDEO.assets || []).map(n => new Promise(res => { const i = new Image(); i.onload = () => { IMGS[n] = i; res(); }; i.onerror = () => { console.warn('missing asset', n); res(); }; i.src = 'assets/' + n; }));
  window.ready = Promise.all([...loads, css.then(() => Promise.all(fonts.map(f => document.fonts.load(`40px "${f.split(':')[0]}"`))))]).then(() => document.fonts.ready);
  if (RENDER) return document.getElementById('hud').remove();
  // Preview: click to play/pause, arrows scrub, #12.5 in the URL jumps to 12.5s.
  const au = new Audio(VIDEO.audio || ''); const hud = document.getElementById('hud');
  au.currentTime = parseFloat(location.hash.slice(1)) || 0;
  addEventListener('click', () => (au.paused ? au.play() : au.pause()));
  addEventListener('keydown', e => { if (e.key === ' ') au.paused ? au.play() : au.pause(); if (e.key === 'ArrowRight') au.currentTime += 2; if (e.key === 'ArrowLeft') au.currentTime -= 2; });
  window.ready.then(() => (function loop() { seek(au.currentTime); hud.textContent = au.currentTime.toFixed(2) + 's' + (au.paused ? ' (click to play)' : ''); requestAnimationFrame(loop); })());
}
