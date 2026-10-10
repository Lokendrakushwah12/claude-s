// examples/lyric-essay.js: the finished demo (claude-s/demos/music-video.html), here to show the lyric-essay API in use.
// Copy it to video.js to re-render the demo; for a new film, take the patterns (SHOTS + film(), lyric(), statBox()), never the scenes.
// "Small things compound": a spoken-word lyric essay, 128 BPM, flat cel-shaded diagrams.
// One line per 2 bars (lyrics.js from align.py --spoken), one shot per line. Hard cuts only where the drums drop
// (bars 3 and 9), 2-frame crossfades everywhere else, every cut 50 ms before its downbeat.
const BPM = 128, B = 60 / BPM, BAR = 4 * B, bar = n => n * BAR, cutAt = n => bar(n) - 0.05;
const C = { night: '#13212B', ground: '#1B2F3C', line: '#2A4252', ink: '#0B141A', cream: '#F3EAD7', creamS: '#DDCFB3',
  coral: '#EE6A4D', coralS: '#B5463A', jade: '#2F9C8A', jadeS: '#1E6B5F', jadeL: '#5DBFAE', ochre: '#F2B441', ochreS: '#C4862A',
  plum: '#4A2D4F', plumS: '#331E37', skin: '#D9A27A', skinS: '#B47A54' };
TYPE.display = 'Inter'; TYPE.mono = 'JetBrains Mono';
const BIG = 'Bricolage Grotesque';
const LOOK_Q = new URLSearchParams(location.search).get('look');

// ---- cel shading: one flat base, one hard shadow shape, one highlight ----
function cel(c, x, y, r, base, shade, hi = true) {
  if (r < 2.5) { c.fillStyle = base; c.fillRect(x - r, y - r, 2 * r, 2 * r); return; }
  c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = shade; c.fill(); c.clip();
  c.beginPath(); c.arc(x - r * 0.17, y - r * 0.17, r * 0.93, 0, 7); c.fillStyle = base; c.fill(); c.restore();
  if (hi && r > 7) { c.fillStyle = 'rgba(255,248,236,0.6)'; c.beginPath(); c.ellipse(x - r * 0.42, y - r * 0.44, r * 0.17, r * 0.1, -0.8, 0, 7); c.fill(); }
}
function cell(c, x, y, r) { cel(c, x, y, r, C.coral, C.coralS); if (r > 6) cel(c, x + r * 0.12, y + r * 0.08, r * 0.3, C.plum, C.plumS, false); }
function grid(c, step = 60 * S, color = C.line, a = 0.45) {
  c.save(); c.strokeStyle = color; c.globalAlpha = a; c.lineWidth = 1; c.beginPath();
  for (let x = (W / 2) % step; x < W; x += step) { c.moveTo(x, 0); c.lineTo(x, H); }
  for (let y = (H / 2) % step; y < H; y += step) { c.moveTo(0, y); c.lineTo(W, y); }
  c.stroke(); c.restore();
}
const poly = (c, pts, fill) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); };

// ---- the callback character: same coat, same pose, three ages ----
// feet at (x, y), height h. Returns the magnifier's centre and radius.
function person(c, x, y, h, age) {
  const old = age === 2, kid = age === 0, legH = h * (kid ? 0.36 : 0.44), bodyH = h * 0.34, headR = h * (kid ? 0.14 : 0.1), lean = old ? 0.16 : 0;
  c.save(); c.translate(x, y);
  c.fillStyle = C.ink; c.fillRect(-h * 0.07, -legH, h * 0.055, legH); c.fillRect(h * 0.02, -legH, h * 0.055, legH); // legs
  c.translate(0, -legH); c.rotate(lean);
  const bw = h * (kid ? 0.3 : 0.26), tw2 = h * 0.2;
  poly(c, [[-bw / 2, 0], [bw / 2, 0], [tw2 / 2, -bodyH], [-tw2 / 2, -bodyH]], C.ochreS); // coat, shadow side first
  poly(c, [[-bw / 2, 0], [bw * 0.12, 0], [tw2 * 0.12, -bodyH], [-tw2 / 2, -bodyH]], C.ochre);
  const hy = -bodyH - headR * 0.95;
  cel(c, 0, hy, headR, C.skin, C.skinS, false);
  c.save(); c.beginPath(); c.arc(0, hy, headR * 1.04, 0, 7); c.clip(); c.fillStyle = old ? '#CFCAC0' : '#2A1D19'; // hair
  c.fillRect(-headR * 1.1, hy - headR * 1.1, headR * 2.2, headR * (old ? 0.75 : 0.95)); c.fillRect(-headR * 1.1, hy - headR, headR * 0.75, headR * 1.3); c.restore();
  if (old) cel(c, -headR * 0.95, hy - headR * 0.55, headR * 0.38, '#CFCAC0', '#A9A49A', false); // bun
  c.fillStyle = C.ink; c.beginPath(); c.arc(headR * 0.5, hy - headR * 0.05, Math.max(2, headR * 0.1), 0, 7); c.fill(); // eye
  // arm out to the magnifier, in front of the face
  const sx = tw2 * 0.25, sy = -bodyH * 0.9, mx = h * (kid ? 0.3 : 0.26), my = hy + headR * 0.2, mr = h * 0.055;
  c.strokeStyle = C.ochreS; c.lineCap = 'round'; c.lineWidth = h * 0.045; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx * 0.6, sy + h * 0.06, mx - mr * 0.7, my + mr * 0.9); c.stroke();
  c.strokeStyle = C.cream; c.lineWidth = h * 0.016; c.beginPath(); c.arc(mx, my, mr, 0, 7); c.stroke(); // magnifier ring
  c.fillStyle = 'rgba(243,234,215,0.18)'; c.fill();
  const m = c.getTransform().transformPoint(new DOMPoint(mx, my)); c.restore();
  if (old) { c.save(); c.strokeStyle = C.creamS; c.lineWidth = h * 0.018; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - h * 0.2, y); c.lineTo(x - h * 0.12, y - h * 0.5); c.stroke(); c.restore(); } // cane
  return [m.x, m.y, mr];
}

// ---- type ----
// Karaoke across rows: wrap a line's words to maxW, each row its own karaoke() call; held = index into the whole line.
function lyric(c, i, t, o = {}) {
  const line = LYRICS[i]; if (!line) return;
  const { x = W / 2, y = H * 0.9, size = 50 * S, maxW = W * 0.8, lead = 1.02, align = 'center', held = -1, font = TYPE.display, weight = 800 } = o;
  const ws = line.words.map(w => ({ w: w.w, on: w.s })), sp = tw(c, ' ', size, weight, font, o.track), rows = [[]]; let rw = 0;
  ws.forEach((w, k) => { const ww = tw(c, w.w, size, weight, font, o.track); if (rw + ww > maxW && rows.at(-1).length) { rows.push([]); rw = 0; } rows.at(-1).push(k); rw += ww + sp; });
  rows.forEach((row, r) => karaoke(c, row.map(k => ws[k]), x, y + (r - (o.anchor === 'top' ? 0 : rows.length - 1)) * size * lead, t,
    { size, font, weight, align, fill: C.cream, line: C.ink, held: row.indexOf(held), track: o.track ?? -0.01 }));
}
// Stat box: mono rows of [label, value], top right, fixed width so rolling digits never resize it.
function statBox(c, rows, a = 1, w = 470 * S) {
  if (a <= 0) return; const pad = 24 * S, rh = 92 * S, x = W - 64 * S - w, y = 60 * S;
  c.save(); c.globalAlpha *= a; c.fillStyle = C.ink + 'E0'; c.beginPath(); c.roundRect(x, y, w, pad * 1.4 + rows.length * rh, 12 * S); c.fill();
  rows.forEach(([label, value], i) => {
    word(c, label, x + pad, y + pad + 22 * S + i * rh, { size: 19 * S, weight: 500, font: TYPE.mono, track: 0.12, color: C.ochre });
    word(c, value, x + pad, y + pad + 72 * S + i * rh, { size: 46 * S, weight: 700, font: TYPE.mono, track: -0.02, color: C.cream });
  });
  c.restore();
}
const commas = v => Math.round(v).toLocaleString('en-US');
const metres = mm => (mm < 10 ? mm.toFixed(1) + ' mm' : mm < 1000 ? (mm / 10).toFixed(1) + ' cm' : mm < 1e6 ? (mm / 1000).toFixed(1) + ' m' : (mm / 1e6).toFixed(2) + ' km');

// ---- shots ----
// 1 / 7: the lens. A figure looks through a magnifier; a callout circle shows what it sees: one cell.
function lens(age) {
  return (c, t, lt, i) => {
    bg(c, C.night); grid(c, 60 * S, C.line, 0.25);
    c.fillStyle = C.ground; c.fillRect(0, H * 0.84, W, H * 0.16);
    const h = H * (age === 0 ? 0.36 : 0.46), [mx, my, mr] = person(c, W * 0.17, H * 0.84, h, age);
    const op = age === 0 ? ease.lift(prog(t, 0.3, 1.3)) : 1, bx = lerp(mx, W * 0.6, op), by = lerp(my, H * 0.42, op), R = lerp(mr, H * 0.31, op);
    const d = Math.hypot(W * 0.6 - mx, H * 0.42 - my), nx = -(H * 0.42 - my) / d, ny = (W * 0.6 - mx) / d;
    c.save(); c.strokeStyle = C.cream; c.globalAlpha = 0.5; c.lineWidth = 2 * S; c.setLineDash([8 * S, 9 * S]); c.beginPath();
    c.moveTo(mx + nx * mr, my + ny * mr); c.lineTo(bx + nx * R, by + ny * R); c.moveTo(mx - nx * mr, my - ny * mr); c.lineTo(bx - nx * R, by - ny * R); c.stroke(); c.restore();
    cel(c, bx, by, R, C.cream, C.creamS, false);
    c.save(); c.beginPath(); c.arc(bx, by, R, 0, 7); c.clip(); grid(c, 46 * S, '#C9BC9F', 0.5);
    const z = 1 + 0.12 * ease.inOut(clamp(lt / (2 * BAR + 1))), r0 = H * 0.06 * z * (1 + 0.025 * Math.sin(t * 2.6));
    const split = age === 2 ? spr(t - bar(14), 260, 20) : 0; // the outro's cell divides again on bar 14
    if (split > 0.001) { cell(c, bx - r0 * 0.9 * split, by, r0 * (1 - 0.2 * split)); cell(c, bx + r0 * 0.9 * split, by, r0 * (1 - 0.2 * split)); } else cell(c, bx, by, r0);
    c.restore();
    c.strokeStyle = C.ochre; c.lineWidth = 6 * S; c.beginPath(); c.arc(bx, by, R, 0, 7); c.stroke();
    c.save(); c.globalAlpha *= prog(op, 0.85, 1); c.fillStyle = C.cream; c.fillRect(bx + R * 0.55, by + R * 1.12, 70 * S, 3 * S); ui(c, '10 µm', bx + R * 0.55 + 82 * S, by + R * 1.12 + 9 * S, { color: C.cream, size: 22 * S, font: TYPE.mono }); c.restore();
    c.save(); c.globalAlpha *= 1 - prog(t, 27.2, 27.5); lyric(c, i, t, { held: age === 2 ? 5 : 3 }); c.restore();
    if (age === 2) word(c, 'SMALL THINGS COMPOUND', W / 2, H * 0.93, { size: 26 * S, font: TYPE.mono, weight: 500, track: 0.3, color: C.ochre, align: 'center', alpha: prog(t, 27.5, 27.9) });
  };
}
// 2: the colony, doubling on every beat from the drop (1 -> 256). Sunflower packing, the disc rescales as it fills.
function colony(c, t, lt, i) {
  bg(c, C.night); grid(c);
  const k = clamp(Math.floor((t - bar(3)) / B) + 1, 0, 8), sinceB = t - (bar(3) + (k - 1) * B), sp = k ? spr(sinceB, 320, 26) : 1;
  const n = 2 ** k, half = n / 2, R = H * 0.3 * (1 + 0.05 * pulse(t, 0.12)), cx = W * 0.42, cy = H * 0.46;
  const pos = (j, m) => { const s = (R / Math.sqrt(m)) * 0.95, r = s * Math.sqrt(j + 0.5), a = j * 2.39996; return m === 1 ? [cx, cy] : [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const cr = m => Math.min(H * 0.17, (R / Math.sqrt(m)) * 0.52);
  for (let j = 0; j < n; j++) {
    const parent = j >= half && k ? j - half : j, [x0, y0] = pos(parent, Math.max(1, half)), [x1, y1] = pos(j, n);
    cell(c, lerp(x0, x1, sp), lerp(y0, y1, sp), lerp(cr(Math.max(1, half)), cr(n), sp));
  }
  statBox(c, [['CELLS', commas(n)], ['DOUBLINGS', String(k)]]);
  lyric(c, i, t, { held: 6 });
}
// 3: thirty doublings as bars on a LINEAR axis, each twice the last, so the axis keeps rescaling and everything before
// the newest bar flattens into the floor. The count accelerates from 2^8 and lands on 2^30 at the onset of "billion".
function curve(c, t, lt, i) {
  bg(c, C.night); grid(c);
  const land = LYRICS[i].words[5].s, kc = 8 + 22 * clamp((t - bar(5)) / (land - bar(5))) ** 1.8, shown = Math.min(30, Math.floor(kc) + 1);
  const base = H * 0.86, x0 = W * 0.06, x1 = W * 0.95, step = (x1 - x0) / 30, bw = step * 0.62, maxH = H * 0.52, scale = maxH / 2 ** kc, dp = bw * 0.35;
  c.fillStyle = C.ground; c.fillRect(0, base, W, H - base);
  for (let j = 1; j <= shown; j++) {
    const h = 2 ** j * scale * clamp(kc - j + 1), x = x0 + (j - 1) * step; // bar j rises as the count goes from 2^(j-1) to 2^j
    if (h < 0.5) continue;
    poly(c, [[x + bw, base], [x + bw + dp, base - dp * 0.6], [x + bw + dp, base - h - dp * 0.6], [x + bw, base - h]], C.jadeS); // side
    poly(c, [[x, base - h], [x + bw, base - h], [x + bw + dp, base - h - dp * 0.6], [x + dp, base - h - dp * 0.6]], C.jadeL); // top
    c.fillStyle = j === shown ? C.coral : C.jade; c.fillRect(x, base - h, bw, h);
  }
  ui(c, 'LINEAR SCALE · EACH BAR IS TWICE THE LAST', x0, base + 44 * S, { size: 20 * S, font: TYPE.mono, color: C.creamS, track: 0.06 });
  statBox(c, [['CELLS', commas(2 ** kc)], ['DOUBLINGS', String(Math.floor(kc))]]);
  lyric(c, i, t, { x: W * 0.06, y: H * 0.2, size: 92 * S, font: BIG, align: 'left', maxW: W * 0.5, anchor: 'top', held: 5, track: -0.03 });
}
// 4: the break. Drums out; the strata hold still and the frame pulses on every beat, with a beat ruler counting to the turn.
function strata(c, t, lt, i) {
  const pz = 1 + 0.03 * pulse(t, 0.09);
  c.translate(W / 2, H / 2); c.scale(pz, pz); c.translate(-W / 2, -H / 2);
  bg(c, C.night); grid(c, 60 * S, C.line, 0.2);
  const layers = [[0.56, C.ochre, C.ochreS], [0.62, C.coral, C.coralS], [0.7, C.cream, C.creamS], [0.77, C.jade, C.jadeS], [0.86, C.plum, C.plumS]];
  layers.forEach(([y0, base, shade], j) => {
    const y1 = layers[j + 1] ? layers[j + 1][0] : 1.02, wav = x => Math.sin(x / W * 6.28 * 1.5 + j * 1.7) * H * 0.008;
    c.beginPath(); c.moveTo(-10, H * y0 + wav(0)); for (let x = 0; x <= W + 20; x += 40) c.lineTo(x, H * y0 + wav(x)); c.lineTo(W + 20, H * y1 + 20); c.lineTo(-10, H * y1 + 20); c.closePath(); c.fillStyle = base; c.fill();
    c.beginPath(); for (let x = 0; x <= W + 20; x += 40) c.lineTo(x, H * y1 + wav(x) * 0.6 - H * 0.012); c.lineTo(W + 20, H * y1 + 20); c.lineTo(-10, H * y1 + 20); c.closePath(); c.fillStyle = shade; c.fill();
  });
  const ages = ['1,000 YEARS', '100,000', '1 MILLION', '10 MILLION'];
  ages.forEach((a, j) => callout(c, W * (0.62 + j * 0.035), H * (layers[j + 1][0] + 0.03), W * 0.86, H * (layers[j + 1][0] + 0.03), a, prog(lt, 0.2 + j * B, 0.7 + j * B), { color: j < 2 ? C.ink : C.cream, size: 22 * S }));
  person(c, W * 0.12, H * 0.565, H * 0.4, 1);
  const kb = clamp(Math.floor((t - bar(7)) / B), -1, 7); // beat ruler: 8 dots, one lights per beat
  for (let j = 0; j < 8; j++) { const lit = j <= kb, x = W / 2 + (j - 3.5) * 56 * S, r = (lit ? 13 : 9) * S * (lit && j === kb ? 1 + 0.4 * pulse(t, 0.12) : 1);
    c.fillStyle = lit ? C.ochre : C.line; c.beginPath(); c.arc(x, H * 0.12, r, 0, 7); c.fill(); }
  lyric(c, i, t, { x: W * 0.58, y: H * 0.36, size: 58 * S, maxW: W * 0.7, held: 7 });
}
// 5: the turn, louder. A mountain rises on a LOG axis, a decade per beat; years and height count together.
const lift = t => track(t, [[0, 0], ...[...Array(7)].map((_, j) => [bar(9) + j * B, (j + 1) / 7])], 300, 26);
function mountain(c, cx, base, peak, w, snow = 0) {
  poly(c, [[cx - w / 2, base], [cx, base - peak], [cx + w / 2, base]], C.coralS);
  poly(c, [[cx - w / 2, base], [cx, base - peak], [cx + w * 0.05, base]], C.coral);
  poly(c, [[cx - w * 0.36, base], [cx - w * 0.2, base - peak * 0.55], [cx - w * 0.02, base]], C.plum); // a foothill in front
  if (snow > 0) { const sh = peak * 0.24 * snow; poly(c, [[cx - (w / 2) * (sh / peak), base - peak + sh], [cx, base - peak], [cx + (w / 2) * (sh / peak), base - peak + sh], [cx + w * 0.02, base - peak + sh * 0.75], [cx - w * 0.04, base - peak + sh]], C.cream); }
}
function uplift(c, t, lt, i) {
  bg(c, C.night); grid(c);
  const p = lift(t), base = H * 0.86, axTop = H * 0.2, ax = W * 0.08, decade = (base - axTop) / 7;
  c.fillStyle = C.ground; c.fillRect(0, base, W, H - base);
  c.strokeStyle = C.creamS; c.lineWidth = 2 * S; c.beginPath(); c.moveTo(ax, base); c.lineTo(ax, axTop - 20 * S); c.stroke();
  ['1 mm', '1 cm', '10 cm', '1 m', '10 m', '100 m', '1 km', '10 km'].forEach((l, j) => { const y = base - j * decade; c.fillStyle = C.creamS; c.fillRect(ax - 10 * S, y - 1 * S, 20 * S, 2 * S); ui(c, l, ax - 18 * S, y + 7 * S, { size: 20 * S, font: TYPE.mono, color: C.creamS, align: 'right' }); });
  ui(c, 'LOG SCALE', ax, axTop - 40 * S, { size: 20 * S, font: TYPE.mono, color: C.creamS, track: 0.06, align: 'center' });
  const peak = Math.max(4 * S, p * 7 * decade);
  mountain(c, W * 0.62, base, peak, Math.max(W * 0.12, peak * 1.7), clamp((p - 0.7) / 0.3));
  poly(c, [[ax + 4 * S, base - peak], [ax + 26 * S, base - peak - 11 * S], [ax + 26 * S, base - peak + 11 * S]], C.ochre); // where the peak is on the axis
  const v = 10 ** (7 * clamp(p));
  statBox(c, [['YEARS', commas(v)], ['HEIGHT', metres(v)]]);
  lyric(c, i, t, { x: W * 0.13, y: H * 0.17, size: 84 * S, font: BIG, align: 'left', maxW: W * 0.4, anchor: 'top', held: 7, track: -0.03 });
}
// 6: pull back from the mountain to the planet it sits on, made of small cells.
function globe(c, t, lt, i) {
  bg(c, C.night);
  const s = lerp(7, 1, ease.lift(clamp(lt / (2 * BAR)))), gx = W * 0.66, gy = H * 0.54, R = H * 0.34, mx = gx, my = gy - R;
  c.save(); c.translate(mx, my + (s - 1) * H * 0.07); c.scale(s, s); c.translate(-mx, -my);
  c.save(); c.beginPath(); c.arc(gx, gy, R, 0, 7); c.fillStyle = C.jade; c.fill(); c.clip();
  const r = rng(4), N = 700;
  for (let j = 0; j < N; j++) { const rr = R * Math.sqrt((j + 0.5) / N), a = j * 2.39996, x = gx + rr * Math.cos(a), y = gy + rr * Math.sin(a);
    const land = Math.sin(x * 0.011 + 1.3) + Math.sin(y * 0.014 - 0.4) + Math.sin((x + y) * 0.006) > 0.9;
    c.fillStyle = land ? C.ochre : (r() < 0.5 ? C.jadeL : C.jade); c.beginPath(); c.arc(x, y, R * 0.028 + r() * R * 0.012, 0, 7); c.fill(); }
  c.fillStyle = 'rgba(11,20,26,0.55)'; c.beginPath(); c.rect(gx - R * 2, gy - R * 2, R * 4, R * 4); c.moveTo(gx + R * 0.8, gy - R * 0.22); c.arc(gx - R * 0.22, gy - R * 0.22, R * 1.02, 0, 7, true); c.fill('evenodd'); // terminator
  c.restore();
  mountain(c, mx, my + R * 0.01, R * 0.16, R * 0.28, 1);
  c.strokeStyle = C.cream; c.lineWidth = 3 * S / s; c.beginPath(); c.arc(gx, gy, R, 0, 7); c.stroke();
  c.restore();
  statBox(c, [['YEARS', '10,000,000'], ['HEIGHT', '10.00 km']], 1 - prog(lt, 0.4, 0.8));
  lyric(c, i, t, { x: W * 0.06, y: H * 0.3, size: 96 * S, font: BIG, align: 'left', maxW: W * 0.36, anchor: 'top', held: 6, track: -0.03 });
}

const SHOTS = [[0, lens(0)], [cutAt(3), colony, true], [cutAt(5), curve], [cutAt(7), strata], [cutAt(9), uplift, true], [cutAt(11), globe], [cutAt(13), lens(2)]];
const shotAt = t => SHOTS.findLastIndex(s => t >= s[0]);
function film(c, t) {
  const i = shotAt(t), [t0, draw, hard] = SHOTS[i], at = (k, cc) => { cc.save(); SHOTS[k][1](cc, t, t - SHOTS[k][0], k); cc.restore(); };
  if (!hard && i > 0 && t - t0 < 3 / 30) softcut(c, t, t0, cc => at(i - 1, cc), cc => at(i, cc), { frames: 2 });
  else at(i, c);
}

window.VIDEO = {
  duration: 29,
  audio: 'audio.wav',
  fonts: ['Inter:wght@500;800', 'Bricolage Grotesque:wght@800', 'JetBrains Mono:wght@500;700'],
  stopmo: LOOK_Q === 'stopmo',
  scenes: [{ start: 0, end: 29, draw(c, p, t) { film(c, t); } }],
  overlay(c, t) {
    paper(c, 0.12);
    if (SHOTS.some(([t0, , hard]) => hard && t >= t0 && t < t0 + 2 / 30)) lutStab(c, 'thermal', 0.85); // 2-frame stab glues each drop cut
    const end = prog(t, 28.2, 29); if (end > 0) { c.fillStyle = C.night; c.globalAlpha = end; c.fillRect(0, 0, W, H); }
  },
  // sound: the bed scores the picture (no SFX layer). Keys bookends, louder second groove, drums-out break before the turn.
  vo: window.VO,
  bed: { bpm: BPM, chords: [[57, 60, 64, 67], [53, 57, 60, 64], [52, 55, 60, 64], [55, 59, 62, 67]],
    sections: [[0, 'intro', 3], [bar(3), 'groove', 0.8], [bar(7), 'stop', 2.2], [bar(9), 'groove', 1.15], [bar(13), 'outro', 1.8]] },
  sfx: 'none',
  lufs: -14,
};
