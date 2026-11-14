// iOS-18-style Control Center intro (example): append to video.js after the template's own code; load icons.js (Lucide, ISC) and lyrics.js before video.js.
// Project: ~/Movies/aura-edits/kashmir-dnd. Needs album.jpg (the user's own still) and click cues on K_TAP. aura.json runs at bpm 60 so times are seconds.
// ---- kashmir-dnd: an iOS-18-style Control Center over the drive. Focus -> Do Not Disturb, the album card pops out, a skip,
// and the trip starts on the cut at 5.87 s, the original reel's own cut times. aura.json runs at bpm 60, so beats = seconds.
// Appended to video.js after the template's own code; icons.js (Lucide, ISC) is loaded before it. The UI draws after the
// look, so it stays crisp. Our own drawing: no OS artwork, no album artwork (the cover is the user's own Dal Lake still).
const K_CUT = beatT(5.87), K_ART = 'album.jpg';
const K_TAP = { focus: 1.64, dnd: 2.75, media: 4.35, skip: 5.58 }; // the clicks in aura.json sit on the same times
const K_SONG = { title: 'Young Dumb & Broke', artist: 'Khalid' };
const K_FONT = '"SF Pro Display", "SF Pro Text", -apple-system, system-ui, "Inter"';
const K_BLUE = '#0a84ff', K_RED = '#ff3b30', K_YEL = '#ffcc00', K_PURPLE = '#5e5ce6';

// ---- icons: Lucide SVGs tinted per colour, decoded once (seek awaits them with the album art) ----
const K_IC = {}, K_ICONS = [];
function kIconImg(name, col, fill) {
  const key = name + col + (fill ? 'f' : ''); if (K_IC[key]) return K_IC[key];
  let s = window.KICONS[name].replace(/currentColor/g, col); if (fill) s = s.replace('fill="none"', `fill="${col}"`);
  const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); K_IC[key] = im; K_ICONS.push(im); return im;
}
const kIco = (c, name, x, y, size, col = '#fff', fill = false) => { const im = kIconImg(name, col, fill); if (im.complete && im.naturalWidth) c.drawImage(im, x - size / 2, y - size / 2, size, size); };
{ const s0 = window.seek; window.seek = async t => { await load(K_ART); await Promise.all(K_ICONS.map(im => im.decode().catch(() => {}))); return s0(t); }; }

// ---- glass: the frame behind, blurred and lifted, through a rounded shape, with a top highlight and a hairline ----
function kGlassSrc(c) { const [cv, x] = scratch('kglass', c.canvas.width, c.canvas.height); x.filter = 'blur(30px) saturate(1.7) brightness(1.12)'; x.drawImage(c.canvas, 0, 0); return cv; }
function kGlass(c, g, x, y, w, h, r, o = {}) {
  c.save(); c.shadowColor = 'rgba(0,0,0,0.16)'; c.shadowBlur = 34 * S; c.shadowOffsetY = 8 * S; c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = 'rgba(0,0,0,0.02)'; c.fill(); c.restore();
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, r); c.clip();
  if (o.solid) { c.fillStyle = o.solid; c.fillRect(x, y, w, h); }
  else {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(g, 0, 0); c.restore();
    c.fillStyle = `rgba(255,255,255,${o.tint ?? 0.24})`; c.fillRect(x, y, w, h);
    const hl = c.createLinearGradient(x, y, x + w * 0.3, y + h); hl.addColorStop(0, 'rgba(255,255,255,0.32)'); hl.addColorStop(0.45, 'rgba(255,255,255,0.04)'); hl.addColorStop(1, 'rgba(255,255,255,0.12)');
    c.fillStyle = hl; c.fillRect(x, y, w, h);
  }
  c.restore();
  c.save(); c.beginPath(); c.roundRect(x + 0.75 * S, y + 0.75 * S, w - 1.5 * S, h - 1.5 * S, r); c.strokeStyle = o.solid ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'; c.lineWidth = 1.5 * S; c.stroke(); c.restore();
}
const kCircle = (c, g, x, y, r, o) => kGlass(c, g, x - r, y - r, 2 * r, 2 * r, r, o);
function kText(c, s, x, y, size, o = {}) {
  c.save(); c.font = `${o.weight || 600} ${size * S}px ${K_FONT}`; c.fillStyle = o.color || '#fff'; c.textAlign = o.align || 'left'; c.textBaseline = 'middle';
  if (!o.color || /255,255,255|#fff/.test(o.color)) { c.shadowColor = 'rgba(0,0,0,0.28)'; c.shadowBlur = 8 * S; c.shadowOffsetY = 1 * S; } // white on bright glass needs a soft shadow to read
  if (o.maxW && c.measureText(s).width > o.maxW) { // a long title fades out at the tile's edge, like the real one
    const w = c.measureText(s).width, [cv, x2] = scratch('ktxt', Math.ceil(w + 4), Math.ceil(size * S * 1.6));
    x2.font = c.font; x2.fillStyle = c.fillStyle; x2.textBaseline = 'middle'; x2.fillText(s, 0, cv.height / 2);
    const f = x2.createLinearGradient(o.maxW * 0.7, 0, o.maxW, 0); f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)');
    x2.globalCompositeOperation = 'destination-in'; x2.fillStyle = f; x2.fillRect(0, 0, cv.width, cv.height);
    c.drawImage(cv, 0, 0, o.maxW, cv.height, x, y - cv.height / 2, o.maxW, cv.height);
  } else c.fillText(s, x, y);
  c.restore();
}

// ---- layout (px at 1080p, scaled by S): two button columns on the left, the media module and sliders on the right ----
const KX = 0.635 * W, KY = 0.12 * H, kx = v => KX + v * S, ky = v => KY + v * S;
const K_BTN = 50, K_COL = [60, 190], K_RX = 260, K_RW = 330;
const K_MEDIA = [K_RX, 0, K_RW, 270], K_FOCUS = [10, 140, 230, 84];
const K_CONN = [0, 260, 250, 250], K_SLIDE = [[K_RX + 20, 260, 110, 270], [K_RX + 180, 260, 110, 270]];
const K_ROW = [[60, 600, 'calculator'], [190, 600, 'circle-dot'], [K_RX + 75, 600, 'flashlight'], [K_RX + 235, 600, 'timer']];
const K_MENU = [-10, 0, 500, 120], K_ITEMS = [['moon', 'Do Not Disturb'], ['user', 'Personal'], ['bed-double', 'Sleep'], ['briefcase', 'Work']];
const K_CARD = [-560, 40, 400, 640]; // the popped album card, left of the grid
const kR = ([x, y, w, h]) => [kx(x), ky(y), w * S, h * S];
const kMid = r => [r[0] + r[2] / 2, r[1] + r[3] / 2];
const K_TAPAT = { focus: kMid(kR(K_FOCUS)), dnd: kMid(kR(K_MENU)), media: kMid(kR(K_MEDIA)), skip: [kx(K_CARD[0] + K_CARD[2] / 2 + 110), ky(K_CARD[1] + K_CARD[3] - 72)] };

// ---- states over time ----
const kIn = (t, i) => { const a0 = 0.05 + 0.04 * i; return { a: prog(t, a0, a0 + 0.2), k: lerp(0.86, 1, ease.back(prog(t, a0, a0 + 0.36))) }; };
const kMenu = t => t < K_TAP.focus + 0.03 ? 0 : t < K_TAP.dnd + 0.45 ? ease.out(prog(t, K_TAP.focus + 0.03, K_TAP.focus + 0.32)) : 1 - ease.out(prog(t, K_TAP.dnd + 0.45, K_TAP.dnd + 0.7));
const kCard = t => ease.out(prog(t, K_TAP.media + 0.03, K_TAP.media + 0.38));

function kPanel(c, g, t, fade) {
  const dnd = t >= K_TAP.dnd, items = [];
  items.push(() => { const [x, y] = [kx(K_COL[0]), ky(70)]; kCircle(c, g, x, y, K_BTN * S, { solid: '#fff' }); kIco(c, 'lock-keyhole', x, y, 40 * S, K_RED); });
  items.push(() => { const [x, y] = [kx(K_COL[1]), ky(70)]; kCircle(c, g, x, y, K_BTN * S); kIco(c, 'screen-share', x, y, 38 * S); });
  items.push(() => { // the Focus pill: "Focus" until Do Not Disturb is on
    const [x, y, w, h] = kR(K_FOCUS); kGlass(c, g, x, y, w, h, h / 2);
    const cx = x + h / 2, cy = y + h / 2; c.beginPath(); c.arc(cx, cy, h * 0.36, 0, 7); c.fillStyle = dnd ? '#fff' : 'rgba(255,255,255,0.22)'; c.fill();
    kIco(c, 'moon', cx, cy, h * 0.4, dnd ? K_PURPLE : '#fff', true);
    if (dnd) { kText(c, 'Do Not', x + h * 0.95, cy - 13 * S, 19); kText(c, 'Disturb', x + h * 0.95, cy + 12 * S, 19); }
    else kText(c, 'Focus', x + h * 0.95, cy, 21);
    kIco(c, 'chevrons-up-down', x + w - 30 * S, cy, 20 * S, 'rgba(255,255,255,0.8)');
  });
  items.push(() => { // the media module: cover, AirPlay-style button, title fading at the edge, artist, controls
    const [x, y, w, h] = kR(K_MEDIA); kGlass(c, g, x, y, w, h, 46 * S);
    const im = GOT[K_ART], s = 104 * S; if (im) { c.save(); c.beginPath(); c.roundRect(x + 26 * S, y + 26 * S, s, s, 14 * S); c.clip(); c.drawImage(im, x + 26 * S, y + 26 * S, s, s); c.restore(); }
    kCircle(c, g, x + w - 52 * S, y + 52 * S, 28 * S, { tint: 0.18 }); kIco(c, 'cast', x + w - 52 * S, y + 52 * S, 26 * S);
    kText(c, K_SONG.title, x + 26 * S, y + 160 * S, 24, { maxW: w - 52 * S }); kText(c, K_SONG.artist, x + 26 * S, y + 189 * S, 20, { weight: 500, color: 'rgba(255,255,255,0.72)' });
    [['rewind', -100], ['pause', 0], ['fast-forward', 100]].forEach(([n, dx]) => kIco(c, n, x + w / 2 + dx * S, y + 235 * S, (n === 'pause' ? 44 : 40) * S, '#fff', true));
  });
  items.push(() => { // connectivity: one glass block, four buttons
    const [x, y, w, h] = kR(K_CONN); kGlass(c, g, x, y, w, h, 56 * S, { tint: 0.16 });
    [[60, 325, 'wifi', K_BLUE], [190, 325, 'radio', null], [60, 450, 'plane', null], [190, 450, 'bluetooth', K_BLUE]].forEach(([bx, by, n, on]) => {
      kCircle(c, g, kx(bx), ky(by), K_BTN * S, on ? { solid: '#fff' } : { tint: 0.2 }); kIco(c, n, kx(bx), ky(by), 40 * S, on || '#fff');
    });
  });
  K_SLIDE.forEach((sr, i) => items.push(() => { // brightness rises after Do Not Disturb; volume sits at 55 %
    const [x, y, w, h] = kR(sr); kGlass(c, g, x, y, w, h, w / 2, { tint: 0.2 });
    const f = i ? 0.55 : lerp(0.42, 0.8, ease.inOut(prog(t, K_TAP.dnd + 0.85, K_TAP.dnd + 1.4)));
    c.save(); c.beginPath(); c.roundRect(x, y, w, h, w / 2); c.clip(); c.fillStyle = '#fff'; c.fillRect(x, y + h * (1 - f), w, h * f); c.restore();
    kIco(c, i ? 'volume-2' : 'sun', x + w / 2, y + h - 48 * S, 40 * S, i ? K_BLUE : K_YEL, !i);
  }));
  K_ROW.forEach(([bx, by, n]) => items.push(() => { const on = n === 'flashlight'; kCircle(c, g, kx(bx), ky(by), K_BTN * S, on ? { solid: '#fff' } : { tint: 0.2 }); kIco(c, n, kx(bx), ky(by), 38 * S, on ? K_BLUE : '#fff'); }));
  items.push(() => { kCircle(c, g, kx(K_COL[0]), ky(730), K_BTN * S, { solid: '#fff' }); kIco(c, 'battery-low', kx(K_COL[0]), ky(730), 42 * S, '#e5b400'); });
  items.forEach((draw, i) => {
    const { a, k } = kIn(t, i); if (a <= 0) return;
    c.save(); c.globalAlpha = a * (1 - fade); const z = k * lerp(1, 0.92, fade); c.translate(kx(250), ky(380)); c.scale(z, z); c.translate(-kx(250), -ky(380)); draw(); c.restore();
  });
}
function kFocusMenu(c, g, t, m) { // the Focus menu takes over the panel: four big pills and "New Focus"
  const dnd = t >= K_TAP.dnd, [fx, fy] = kMid(kR(K_FOCUS));
  K_ITEMS.forEach(([icon, name], i) => {
    const p = ease.out(clamp((m - i * 0.08) / 0.7)); if (p <= 0) return;
    const r = kR([K_MENU[0], K_MENU[1] + i * 150, K_MENU[2], K_MENU[3]]), sel = i === 0 && dnd, [mx, my] = kMid(r);
    c.save(); c.globalAlpha = p; c.translate(lerp(fx, mx, p), lerp(fy, my, p)); c.scale(lerp(0.5, 1, p), lerp(0.5, 1, p)); c.translate(-mx, -my);
    kGlass(c, g, ...r, r[3] / 2, sel ? { solid: '#fff' } : { tint: 0.2 });
    kIco(c, icon, r[0] + 62 * S, my, 40 * S, sel ? K_PURPLE : '#fff', icon !== 'briefcase');
    const sub = i === 0 ? (dnd ? 'On' : 'Silence all notifications') : null;
    kText(c, name, mx, sub ? my - 14 * S : my, 27, { align: 'center', color: sel ? '#111' : '#fff' });
    if (sub) kText(c, sub, mx, my + 20 * S, 17, { align: 'center', weight: 500, color: sel ? '#777' : 'rgba(255,255,255,0.75)' });
    kIco(c, 'ellipsis', r[0] + r[2] - 58 * S, my, 30 * S, sel ? '#999' : 'rgba(255,255,255,0.85)');
    c.restore();
  });
  const p = ease.out(clamp((m - 0.35) / 0.65)); if (p <= 0) return;
  const [nx, ny] = [kx(K_MENU[0] + K_MENU[2] / 2), ky(640)];
  c.save(); c.globalAlpha = p; kCircle(c, g, nx, ny, 40 * S, { tint: 0.2 }); kIco(c, 'plus', nx, ny, 34 * S); kText(c, 'New Focus', nx, ny + 66 * S, 19, { align: 'center' }); c.restore();
}
function kAlbumCard(c, g, t, p) { // grows out of the media module into a big card on the left
  const from = kR(K_MEDIA), to = kR(K_CARD), [x, y, w, h] = from.map((v, i) => lerp(v, to[i], p)), im = GOT[K_ART];
  c.save(); c.globalAlpha = Math.min(1, p * 2.5); kGlass(c, g, x, y, w, h, lerp(46, 52, p) * S, { tint: 0.22 });
  const pad = 30 * S, art = w - 2 * pad;
  if (im) { c.save(); c.beginPath(); c.roundRect(x + pad, y + pad, art, art, 24 * S); c.clip(); c.drawImage(im, x + pad, y + pad, art, art); c.restore(); }
  c.globalAlpha *= prog(p, 0.55, 1);
  const ty = y + pad + art + 44 * S; kText(c, K_SONG.title, x + pad, ty, 30, { weight: 700, maxW: art }); kText(c, K_SONG.artist, x + pad, ty + 36 * S, 23, { weight: 500, color: 'rgba(255,255,255,0.75)' });
  const by = ty + 76 * S, done = 0.28 + 0.06 * prog(t, K_TAP.media, K_CUT); // the progress bar keeps moving: the song is playing
  c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.roundRect(x + pad, by, art, 6 * S, 3 * S); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.roundRect(x + pad, by, art * done, 6 * S, 3 * S); c.fill();
  const cy = y + h - 72 * S; [['rewind', -110], ['pause', 0], ['fast-forward', 110]].forEach(([n, dx]) => kIco(c, n, x + w / 2 + dx * S, cy, (n === 'pause' ? 58 : 50) * S, '#fff', true));
  c.restore();
}
function kTaps(c, t) { // a fingertip: a soft dot just before each tap, then a ring
  for (const [k, at] of Object.entries(K_TAP)) {
    const [x, y] = K_TAPAT[k], u = t - at; if (u < -0.14 || u > 0.34) continue;
    c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 16 * S;
    if (u < 0.08) { c.globalAlpha = 0.85 * prog(u, -0.14, -0.05); c.beginPath(); c.arc(x, y, (u < 0 ? 30 : 26) * S, 0, 7); c.fillStyle = 'rgba(255,255,255,0.55)'; c.fill(); }
    if (u >= 0) { c.globalAlpha = 1 - prog(u, 0, 0.34); c.beginPath(); c.arc(x, y, lerp(26, 54, ease.out(prog(u, 0, 0.34))) * S, 0, 7); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3 * S; c.stroke(); }
    c.restore();
  }
}
function kControl(c, t) {
  if (t >= K_CUT) return;
  const g = kGlassSrc(c), m = kMenu(t), p = kCard(t);
  kPanel(c, g, t, m); if (m > 0) kFocusMenu(c, g, t, m); if (p > 0) kAlbumCard(c, g, t, p); kTaps(c, t);
}
// preload every icon colour the UI uses, so the first frame of each never draws blank
[['lock-keyhole', K_RED], ['screen-share'], ['moon', K_PURPLE, 1], ['moon', '#fff', 1], ['chevrons-up-down', 'rgba(255,255,255,0.8)'], ['cast'], ['rewind', '#fff', 1], ['pause', '#fff', 1],
 ['fast-forward', '#fff', 1], ['wifi', K_BLUE], ['radio'], ['plane'], ['bluetooth', K_BLUE], ['sun', K_YEL, 1], ['volume-2', K_BLUE], ['calculator'], ['circle-dot'], ['flashlight', K_BLUE],
 ['timer'], ['battery-low', '#e5b400'], ['user', '#fff', 1], ['bed-double', '#fff', 1], ['briefcase'], ['ellipsis', '#999'], ['ellipsis', 'rgba(255,255,255,0.85)'], ['plus']].forEach(([n, col = '#fff', f]) => kIconImg(n, col, !!f));
// ---- captions from lyrics.txt (lyrics.py -> lyrics.js), in the reference's style, measured on its frames: the system font
// (SF) at weight 400, all lowercase with curly apostrophes, x-height 2.4 % of the height, baseline 51 % down, centred, plain
// white with no visible shadow, the line building word by word on the sung onsets. The text is the user's; nothing here writes any.
function kLyrics(c, t) {
  if (t < K_CUT) return; // the reference shows no lyrics over the Control Center intro, only from the first montage cut
  const cap = (window.KLYR || []).find(l => t >= l.t && t < l.end); if (!cap) return;
  const str = cap.words.filter(([, at]) => t >= at).map(([w]) => w).join(' ').toLowerCase().replace(/'/g, '\u2019'); if (!str) return;
  c.save(); c.font = `400 ${Math.round(H * 0.0475)}px ${K_FONT}`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.shadowColor = 'rgba(0,0,0,0.12)'; c.shadowBlur = H * 0.004; c.fillText(str, W / 2, H * 0.511); c.restore();
}
{ const o0 = VIDEO.overlay; VIDEO.overlay = (c, t) => { o0(c, t); kControl(c, t); kLyrics(c, t); }; }
