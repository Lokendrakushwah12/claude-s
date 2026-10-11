// reel.js: the "aesthetic reel" caption style, on with top-level "captions": "reel" in edit.json (else this file does nothing).
// From a before/after reel's "after" side (instagram DdH7o_ShMAn): captions build 1-3 words at a time at the top of frame in
// mixed type: plain = the brand's tight heavy grotesk, chunk = rounded heavy pale yellow, spark = Bodoni with sparkle i-dots,
// ital = Instrument Serif italic, label = a name on a red stitched star (+ its cover or photo sticker and a drawn arrow), tg / yt =
// Telegram / YouTube logo chips. frame = the whole picture inset 0.845 on a striped or ruled-paper border.
// Phrase fields: st {word: style}, show {word: display text, "" hides it}, stk [{img, on, side: "r"|"l", circle: [cx, cy, r]}],
//   frame blue|pink|mint|paper, big (a section word: its own group, larger), hook (the hookTitle stack shows over it).
// Top level: hookTitle ["small serif", "BIG", "script"] (or {text, font} each; font is a Google Fonts spec, "Fredoka:wght@700").
// Words show as written in say, a sentence's first capital lowered (names, acronyms and "I" stay): fix spellings with show.
(() => {
if (E.captions !== 'reel') return;
PRESET.captions = false; // the house lead-in + keyword step aside
const TITLE_FONTS = ['Bodoni Moda:wght@500', 'Fredoka:wght@700', 'Pinyon Script'];
const TITLE = (E.hookTitle || []).map((x, k) => { const o = typeof x === 'string' ? { text: x } : x, f = o.font || TITLE_FONTS[k];
  return { text: o.text, f, fam: f.split(':')[0], wt: /wght@(\d+)/.exec(f)?.[1] || 400 }; });
VIDEO.fonts.push('Fredoka:wght@600;700', 'Bodoni Moda:ital,wght@0,400;0,500;1,400', 'Instrument Serif:ital@0;1', 'Pinyon Script');
for (const o of TITLE) if (!VIDEO.fonts.some(f => f.split(':')[0] === o.fam)) VIDEO.fonts.push(o.f);
VIDEO.assets = [...new Set([...(VIDEO.assets || []), ...E.phrases.flatMap(p => (p.stk || []).map(k => k.img.replace('assets/', '')))])];

const R = { cream: '#F4EFA4', ink: '#2B2114', pink: '#F6B9D2', star: '#D8353D', shadow: 'rgba(0,0,0,0.42)' };
const BIG = new Set(['label', 'tg', 'yt']);
const STRIPES = { blue: ['#BACFE9', '#EEF3F9'], pink: ['#F2C3D5', '#FCF0F4'], mint: ['#BFE3D0', '#EEF8F3'] };

// Camera: the reference's jump cuts alternate a wide and a held punch-in; section words punch in and settle.
E.phrases.forEach((p, i) => { // a punch-in magnifies the source: past ~1.3x a phone's front camera reads soft;
  p.ax ??= 0.5; p.ay ??= 1.0; p.slide ??= (i % 2 ? -1 : 1) * 0.006; p.tau ??= 99; p.z0 ??= p.big || i % 2 ? 1.3 : 1.15; // anchored low, so zooming lifts the face clear of the platform's bottom UI
});

function shown(p) { // the words as displayed: [{s, st, t, k}], hidden ones dropped
  return (p.cache ||= p.words.map((w, i) => {
    const k = clean(w.w), st = p.st?.[k] || 'plain', own = p.show?.[k];
    let s = own ?? w.w.replace(/[^\w'’-]/g, '').replace(/^-/, '');
    const first = !i || /[.?!]$/.test(p.words[i - 1].w); // captions run lowercase: a sentence's opening capital goes, names and acronyms stay
    if (own === undefined && st !== 'label' && first && /^[A-Z][a-z'’-]*$/.test(s) && !/^I(['’]|$)/.test(s)) s = s.toLowerCase();
    if (st !== 'plain' && !BIG.has(st) && own === undefined && /[.,]$/.test(w.w)) s += w.w.slice(-1);
    return { s, st, t: w.t, k };
  }).filter(x => x.s !== ''));
}
function groups(p) { // 1-3 words a group; a label or chip stands alone; a section word is its own group
  if (p.groups) return p.groups;
  const ws = shown(p), out = []; let g = [];
  ws.forEach((w, i) => {
    if (g.length && BIG.has(w.st)) { out.push(g); g = []; }
    g.push(w); const nx = ws[i + 1], len = g.reduce((a, x) => a + x.s.length, 0);
    if (!nx || BIG.has(w.st) || p.big || g.length >= 3 || len >= 15 || (/[,.]$/.test(w.s) && g.length >= 2)) { out.push(g); g = []; }
  });
  return (p.groups = out.map((g, i) => ({ ws: g, t0: i ? g[0].t - 0.03 : p.start, t1: out[i + 1] ? out[i + 1][0].t - 0.03 : p.end })));
}

const SZ = { plain: 0.056, chunk: 0.08, spark: 0.086, ital: 0.084, label: 0.066, tg: 0.066, yt: 0.066 };
const FONT = { plain: z => `800 ${z}px "${B.font}"`, chunk: z => `700 ${z}px Fredoka`, spark: z => `400 ${z}px "Bodoni Moda"`,
  ital: z => `italic 400 ${z}px "Instrument Serif"`, label: z => `700 ${z}px Fredoka`, tg: z => `700 ${z * 0.62}px Fredoka`, yt: z => `700 ${z * 0.62}px Fredoka` };
const TRACK = { plain: -0.045, chunk: -0.01, spark: -0.02, ital: 0, label: -0.01, tg: 0, yt: 0 };
const size = (p, w) => H * SZ[w.st] * (p.big && w.st === 'chunk' ? 1.4 : 1);
function setFont(c, st, z) { c.font = FONT[st](z); c.letterSpacing = `${TRACK[st] * z}px`; }
function wordW(c, p, w) {
  const z = size(p, w); setFont(c, w.st, z); const tw = c.measureText(w.s).width;
  return w.st === 'label' ? z * 1.3 + tw : BIG.has(w.st) ? z * 1.55 + tw : tw;
}
function layout(c, p, g) { // lines: plain words share a line, a styled word takes its own; staircase from left to right
  const gap = H * 0.012, lines = []; let cur = null;
  for (const w of g.ws) {
    const ww = wordW(c, p, w), z = size(p, w), sp = H * SZ.plain * 0.28;
    if (cur && w.st === 'plain' && cur.plain && cur.w + sp + ww < W * 0.8) { cur.items.push({ w, x: cur.w + sp, ww }); cur.w += sp + ww; continue; }
    cur = { items: [{ w, x: 0, ww }], w: ww, h: z, plain: w.st === 'plain' }; lines.push(cur);
  }
  const BW = Math.max(...lines.map(l => l.w)), n = lines.length; let y = H * (p.hook && TITLE.length ? 0.3 : 0.115); // under the hook title
  const x0 = (W - BW) / 2;
  lines.forEach((l, k) => { l.x = n > 1 ? x0 + (BW - l.w) * (k / (n - 1)) : (W - l.w) / 2; l.y = y + l.h * 0.82; y += l.h * (l.plain ? 1.0 : 0.98) + gap * (l.plain ? 0 : 0.4); });
  return lines;
}
function sparkle(c, x, y, r, a = 0) {
  c.save(); c.translate(x, y); c.rotate(a); c.beginPath();
  for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.22 : r, an = (i * Math.PI) / 4; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
  c.closePath(); c.fill(); c.restore();
}
function starPath(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.48 : r, an = -Math.PI / 2 + (i * Math.PI) / 5; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } c.closePath(); }
function rrect(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }

function drawWord(c, t, p, w, x, y) { // x = left, y = baseline
  const z = size(p, w), a = prog(t, w.t - 0.04, w.t + 0.05), sc = 0.84 + 0.16 * ease.back(prog(t, w.t - 0.04, w.t + 0.14));
  if (a <= 0) return null;
  const ww = wordW(c, p, w), cx = x + ww / 2, cy = y - z * 0.35;
  c.save(); c.globalAlpha *= a; c.translate(cx, cy); c.scale(sc, sc); c.translate(-cx, -cy); setFont(c, w.st, z);
  if (w.st === 'plain' || w.st === 'ital') {
    c.shadowColor = R.shadow; c.shadowBlur = 14 * S; c.shadowOffsetY = 3 * S; c.fillStyle = '#fff'; c.fillText(w.s, x, y);
  } else if (w.st === 'chunk') {
    c.fillStyle = 'rgba(64,46,8,0.75)'; c.fillText(w.s, x + 3.5 * S, y + 4.5 * S);
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 16 * S; c.fillStyle = R.cream; c.fillText(w.s, x, y);
  } else if (w.st === 'spark') {
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = 16 * S; c.shadowOffsetY = 2 * S; c.fillStyle = '#F7F2C8'; c.fillText(w.s, x, y);
    c.shadowColor = 'transparent';
    [...w.s].forEach((ch, i) => { if (ch === 'i' || ch === 'j') { const dx = c.measureText(w.s.slice(0, i)).width + c.measureText(ch).width / 2;
      sparkle(c, x + dx, y - z * 0.66, z * 0.15 * (1 + 0.12 * Math.sin((t - w.t) * 7 + i)), (t - w.t) * 0.8); } });
  } else if (w.st === 'label') {
    const r = z * 0.62, sx = x + r * 0.9, sy = y - z * 0.34, rot = -0.18 + 0.05 * Math.sin((t - w.t) * 3);
    c.save(); c.translate(sx, sy); c.rotate(rot); c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 10 * S; c.fillStyle = R.star; starPath(c, 0, 0, r); c.fill();
    c.shadowColor = 'transparent'; c.setLineDash([5 * S, 4 * S]); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2.4 * S; starPath(c, 0, 0, r * 0.78); c.stroke(); c.restore();
    const tx = x + z * 1.3; setFont(c, 'label', z);
    c.fillStyle = 'rgba(64,46,8,0.75)'; c.fillText(w.s, tx + 3.5 * S, y + 4.5 * S); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 14 * S; c.fillStyle = R.cream; c.fillText(w.s, tx, y);
  } else { // tg / yt chips
    const hh = z * 1.15, top = y - z * 0.85, tg = w.st === 'tg';
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 16 * S; c.shadowOffsetY = 4 * S; c.fillStyle = tg ? '#2AABEE' : '#FF1F2D'; rrect(c, x, top, ww, hh, hh * 0.28); c.fill();
    c.shadowColor = 'transparent'; const ic = x + hh * 0.62, iy = top + hh / 2;
    c.fillStyle = '#fff';
    if (tg) { c.beginPath(); c.moveTo(ic - hh * 0.26, iy - hh * 0.02); c.lineTo(ic + hh * 0.27, iy - hh * 0.24); c.lineTo(ic + hh * 0.17, iy + hh * 0.24); c.lineTo(ic + hh * 0.02, iy + hh * 0.1); c.lineTo(ic - hh * 0.06, iy + hh * 0.2); c.lineTo(ic - hh * 0.06, iy + hh * 0.07); c.closePath(); c.fill(); }
    else { rrect(c, ic - hh * 0.3, iy - hh * 0.21, hh * 0.6, hh * 0.42, hh * 0.12); c.fill(); c.fillStyle = '#FF1F2D'; c.beginPath(); c.moveTo(ic - hh * 0.08, iy - hh * 0.12); c.lineTo(ic + hh * 0.14, iy); c.lineTo(ic - hh * 0.08, iy + hh * 0.12); c.closePath(); c.fill(); }
    setFont(c, w.st, z); c.fillStyle = '#fff'; c.textBaseline = 'middle'; c.fillText(w.s, x + hh * 1.12, iy + z * 0.02); c.textBaseline = 'alphabetic';
  }
  c.restore();
  return { x, y: y - z, w: ww, h: z };
}

let LABEL = null; // where this frame's label sits, for the arrow to its sticker
function captionsReel(c, t, p) {
  LABEL = null; const g = groups(p).find(g => t >= g.t0 && t < g.t1); if (!g) return;
  const ls = layout(c, p, g), BW = Math.max(...ls.map(l => l.w)), f = Math.min(1, (W * 0.88) / BW), y0 = ls[0].y - ls[0].h;
  c.translate(W / 2, y0); c.scale(f, f); c.translate(-W / 2, -y0);
  for (const l of ls) for (const it of l.items) { const b = drawWord(c, t, p, it.w, l.x + it.x, l.y); if (b && it.w.st === 'label') LABEL = { x: W / 2 + (b.x - W / 2) * f, y: y0 + (b.y - y0) * f, w: b.w * f, h: b.h * f, t: it.w.t }; }
}

function stickerBox(p, k, i) {
  const im = IMGS[k.img.replace('assets/', '')]; if (!im) return null;
  const side = k.side || 'r', bw = W * (k.circle ? 0.27 : 0.25), bh = k.circle ? bw : Math.min(W * 0.36, (bw * im.height) / im.width);
  return { im, side, bw, bh, cx: side === 'r' ? W * 0.79 : W * 0.21, cy: H * (0.355 + (p.stk.length > 1 ? 0.01 * i : 0)) };
}
function stickers(c, t, p) {
  (p.stk || []).forEach((k, i) => {
    const w = p.words.find(x => clean(x.w) === k.on), b = stickerBox(p, k, i); if (!w || !b) return;
    const t0 = w.t + 0.04, u = prog(t, t0, t0 + 0.5); if (t < t0) return;
    const sc = ease.spring(u, 0.45), base = (b.side === 'r' ? 1 : -1) * 0.1, rot = base + (1 - ease.out(u)) * -0.35 * (b.side === 'r' ? 1 : -1) + 0.02 * Math.sin((t - t0) * 4.4 + i);
    const bob = H * 0.003 * Math.sin((t - t0) * 4.4 + i);
    c.save(); c.translate(b.cx, b.cy + bob); c.rotate(rot); c.scale(sc, sc);
    c.shadowColor = 'rgba(0,0,0,0.38)'; c.shadowBlur = 26 * S; c.shadowOffsetY = 10 * S; c.fillStyle = '#fff';
    if (k.circle) {
      const R0 = b.bw / 2; c.beginPath(); c.arc(0, 0, R0, 0, Math.PI * 2); c.fill(); c.shadowColor = 'transparent';
      const [fx, fy, fr] = k.circle, rr = R0 * 0.9, s = rr / (fr * b.im.width);
      c.save(); c.beginPath(); c.arc(0, 0, rr, 0, Math.PI * 2); c.clip(); c.drawImage(b.im, -fx * b.im.width * s, -fy * b.im.height * s, b.im.width * s, b.im.height * s); c.restore();
    } else {
      const m = b.bw * 0.045; c.fillRect(-b.bw / 2 - m, -b.bh / 2 - m, b.bw + 2 * m, b.bh + 2 * m); c.shadowColor = 'transparent';
      cover(c, b.im, -b.bw / 2, -b.bh / 2, b.bw, b.bh);
    }
    c.restore();
    if (LABEL && p.stk.length === 1) arrow(c, t, t0, LABEL, b);
  });
}
function arrow(c, t, t0, L, b) { // a hand-drawn arrow from the label towards its sticker, drawn on in 0.22 s
  const u = ease.out(prog(t, t0 + 0.08, t0 + 0.3)); if (u <= 0) return;
  const right = b.side === 'r', x0 = right ? L.x + L.w * 0.55 : L.x + L.w * 0.45, y0 = L.y + L.h * 1.25;
  const x1 = b.cx + (right ? -1 : 1) * b.bw * 0.6, y1 = b.cy - b.bh * 0.12, mx = x0 + (right ? -1 : 1) * W * 0.04, my = y1 + H * 0.02;
  const pt = s => [(1 - s) ** 2 * x0 + 2 * (1 - s) * s * mx + s * s * x1, (1 - s) ** 2 * y0 + 2 * (1 - s) * s * my + s * s * y1];
  c.save(); c.strokeStyle = '#fff'; c.lineWidth = 5 * S; c.lineCap = c.lineJoin = 'round'; c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 8 * S;
  c.beginPath(); for (let s = 0; s <= u + 1e-6; s += 0.04) c.lineTo(...pt(Math.min(s, u))); c.stroke();
  if (u > 0.9) { const [ex, ey] = pt(1), [px, py] = pt(0.9), an = Math.atan2(ey - py, ex - px), hl = 24 * S;
    c.beginPath(); c.moveTo(ex - Math.cos(an - 0.5) * hl, ey - Math.sin(an - 0.5) * hl); c.lineTo(ex, ey); c.lineTo(ex - Math.cos(an + 0.5) * hl, ey - Math.sin(an + 0.5) * hl); c.stroke(); }
  c.restore();
}

function voice(c, o, x, z, track = 0) { // o's font at size z (tracked), shrunk if the text would cross the frame edge centred on x
  const set = z => { c.font = `${o.wt} ${z}px "${o.fam}"`; c.letterSpacing = `${track * z}px`; return c.measureText(o.text).width; };
  const w = set(z), room = 1.9 * Math.min(x, W - x); if (w > room) set((z * room) / w);
}
function hookTitle(c) { // the reference's three-voice title from hookTitle: a small serif up left, a huge rounded word, a script under it; on screen from frame 0 (the thumbnail)
  const [a, b, d] = TITLE, cx = W / 2, y1 = H * 0.098, y2 = H * 0.205, y3 = H * 0.252;
  c.save(); c.textAlign = 'center';
  if (a?.text) { voice(c, a, cx - W * 0.16, H * 0.05); c.shadowColor = 'rgba(0,0,0,0.4)'; c.shadowBlur = 14 * S; c.fillStyle = R.pink; c.fillText(a.text, cx - W * 0.16, y1); }
  if (b?.text) { voice(c, b, cx, H * 0.14, -0.01); c.shadowColor = 'transparent'; c.fillStyle = 'rgba(64,46,8,0.8)'; c.fillText(b.text, cx + 5 * S, y2 + 6 * S);
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 18 * S; c.fillStyle = R.cream; c.fillText(b.text, cx, y2); }
  if (d?.text) { voice(c, d, cx + W * 0.19, H * 0.072); c.translate(cx + W * 0.19, y3); c.rotate(-0.06); c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 12 * S; c.fillStyle = '#fff'; c.fillText(d.text, 0, 0); }
  c.restore();
}

function frameGround(c, f, cw, ch) {
  const col = STRIPES[f];
  if (col) {
    const per = cw * 0.064; c.fillStyle = col[1]; c.fillRect(0, 0, cw, ch); c.fillStyle = col[0];
    for (let x = 0; x < cw; x += per) c.fillRect(x, 0, per / 2, ch);
    c.fillStyle = 'rgba(40,60,90,0.07)'; for (let x = 0; x < cw; x += per) c.fillRect(x + per / 2 - 1.5 * S, 0, 1.5 * S, ch);
  } else { // ruled notebook paper: blue rules and a red margin
    c.fillStyle = '#F7F1E1'; c.fillRect(0, 0, cw, ch); c.fillStyle = 'rgba(86,128,196,0.38)';
    for (let y = ch * 0.03; y < ch; y += ch * 0.024) c.fillRect(0, y, cw, 1.6 * S);
    c.fillStyle = 'rgba(214,74,74,0.6)'; c.fillRect(cw * 0.045, 0, 2.2 * S, ch);
  }
}
function framePass(c, t, p) {
  if (!STRIPES[p.frame] && p.frame !== 'paper') return;
  const cw = c.canvas.width, ch = c.canvas.height, [cv, x] = scratch('reelFrame', cw, ch); x.drawImage(c.canvas, 0, 0);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); frameGround(c, p.frame, cw, ch);
  const k = 0.845, iw = cw * k, ih = ch * k, ix = (cw - iw) / 2, iy = (ch - ih) / 2;
  c.shadowColor = 'rgba(30,25,20,0.3)'; c.shadowBlur = 24 * S; c.shadowOffsetY = 8 * S; c.fillStyle = '#000'; c.fillRect(ix, iy, iw, ih); c.shadowColor = 'transparent';
  c.drawImage(cv, ix, iy, iw, ih); c.restore();
}

const baseOverlay = VIDEO.overlay;
VIDEO.overlay = (c, t) => {
  baseOverlay(c, t); const p = phraseAt(t); if (!p) return;
  if (p.hook && TITLE.length) hookTitle(c);
  if (p.caption !== false && (p.caption === true || !NOCAP.has(p.insert?.kind))) { c.save(); captionsReel(c, t, p); c.restore(); } // inserts with their own type: none
  stickers(c, t, p); framePass(c, t, p);
};

// Sound, as the reference: no whoosh on a plain jump cut; a passby where the frame changes (a sub under it into a section),
// a blip on each label or chip, a bloop as a sticker lands, a shine on a sparkle word. Gains ~2x: at 1x they measured
// +0.1..0.5 dB over the voice (masked); the reference's clicks sit 4-8 dB under the voice, clearly heard.
const fk = s => E.phrases[s.phrase]?.frame || '', ev = VIDEO.events.filter(e => e.kind !== 'cut'), owned = t => ev.some(e => /^cut|montage|portal/.test(e.kind) && Math.abs(e.t - t) < 0.01);
E.shots.forEach((s, i) => { const a = E.shots[i - 1]; if (a && fk(a) !== fk(s) && !owned(s.out0)) ev.push({ t: s.out0, kind: E.phrases[s.phrase]?.big ? 'cut_insert' : 'cut', gain: 1.8 }); });
for (const p of E.phrases) {
  for (const w of shown(p)) { if (BIG.has(w.st)) ev.push({ t: w.t, kind: 'pill', gain: 2.4 }); if (w.st === 'spark') ev.push({ t: w.t, kind: 'glint', gain: 2 }); }
  for (const k of p.stk || []) { const w = p.words.find(x => clean(x.w) === k.on); if (w) ev.push({ t: w.t + 0.12, kind: 'icon', gain: 2.2 }); }
}
VIDEO.events = ev.map(e => ({ ...e, t: +e.t.toFixed(3) })).sort((a, b) => a.t - b.t);
})();
