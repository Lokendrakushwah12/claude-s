// Keychain — variant 2: "Every product on the shelf started with someone who could make it."
// An original film. Techniques distilled from two references, recombined with Keychain's own world (barcodes, lot codes,
// specs, suppliers, a chain of links); no reference shot is reproduced:
//   · portfolio reel (x.com/Jerrythe2d/status/2104236249855017381) -> concave curved wall + floor reflection, used as a supplier CONVEYOR
//   · Nexus launch film (x.com/Kendel4204k/status/2104168085687267716) -> slow narrated pacing, words out of a blur, volumetric light,
//     glass UI, a prompt that types -> used for Keychain's real "Generate Products" flow, lit like factory skylights
// Invented for this film: barcode scan whose bars become the cut to black, packaging-label marks as texture, generated spec sheet with a
// drawn pouch, split-flap category board, chain of links for the network, final link closing into the k mark.
// 100 BPM: beat 0.6 s, bar 2.4 s. Cuts land on beats.
const B = {
  cream: '#F6F5F0', ink: '#0A0A0B', night: '#0B0B0D', yellow: '#FFEC42', beam: '#FFE35A', white: '#F4F3EE', mute: '#8E8D87', mute2: '#5D5C58',
  card: '#FFFFFF', line: '#E3E1D8', kraft: '#CDAE80', kraft2: '#B8965F', green: '#3BB273',
};
Object.assign(TYPE, { display: 'Inter Tight', ui: 'Inter', mono: 'IBM Plex Mono', weight: 500, track: -0.03 });
function night(c, t, k = 1) { // dark ground under one soft warm key light, with dust in the air
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#121110'); g.addColorStop(0.6, B.night); g.addColorStop(1, '#060607');
  c.fillStyle = g; c.fillRect(0, 0, W, H); keylight(c, B.beam, t, { k }); dust(c, t, { alpha: 0.28 * k });
}
const say = (c, s, y, t, o = {}) => words(c, s, W / 2, y, t, { size: 52 * S, weight: 500, font: TYPE.ui, track: -0.02, color: B.white, ...o });

// Keychain mark (from keychain-logo-mark-circle.png, 1200-unit box), pieces animate separately.
function kmark(c, x, y, size, o = {}) {
  const { circle = B.yellow, ink = B.ink, cs = 1, stem = 1, bowl = 1, leg = 1 } = o, s = size / 1200;
  c.save(); c.translate(x, y); c.scale(s, s); c.translate(-600, -600);
  if (circle && cs > 0) { c.beginPath(); c.arc(600, 600, 600 * cs, 0, 7); c.fillStyle = circle; c.fill(); }
  c.fillStyle = ink;
  if (stem > 0) { const h = 668 * clamp(stem); c.fillRect(400, 934 - h, 141, h); }
  if (bowl > 0) { c.beginPath(); c.moveTo(641, 488); c.arc(641, 488, 165, 0, (Math.PI / 2) * clamp(bowl)); c.closePath(); c.fill(); }
  if (leg > 0) { const d = (1 - clamp(leg)) * 260; c.globalAlpha = clamp(leg * 3); c.beginPath(); [[641, 672], [860, 934], [677, 934], [561, 796]].forEach(([px, py], i) => (i ? c.lineTo(px + d, py + d) : c.moveTo(px + d, py + d))); c.closePath(); c.fill(); }
  c.restore();
}
// A stand-up granola pouch, drawn: kraft body, window of clusters, yellow label band. (x, y) = centre, s = height.
function pouch(c, x, y, s, p = 1) {
  if (p <= 0) return; const w = s * 0.72, h = s, e = spr(p * 0.6, 220, 18);
  c.save(); c.translate(x, y + (1 - e) * s * 0.2); c.scale(lerp(0.8, 1, e), lerp(0.8, 1, e)); c.globalAlpha = clamp(p * 3);
  c.beginPath(); c.moveTo(-w / 2, -h / 2 + s * 0.04); c.lineTo(w / 2, -h / 2 + s * 0.04); c.lineTo(w / 2 + s * 0.02, h / 2 - s * 0.08); c.quadraticCurveTo(0, h / 2 + s * 0.02, -w / 2 - s * 0.02, h / 2 - s * 0.08); c.closePath();
  const g = c.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, B.kraft2); g.addColorStop(0.45, B.kraft); g.addColorStop(1, B.kraft2); c.fillStyle = g; c.fill();
  c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(-w / 2, -h / 2 + s * 0.04, w, s * 0.05); // top seal
  const wy = h * 0.12; c.save(); rrect(c, -w * 0.32, wy - s * 0.12, w * 0.64, s * 0.26, s * 0.13); c.clip(); c.fillStyle = '#7A5530'; c.fillRect(-w, -h, w * 2, h * 2);
  const r = rng(8); for (let i = 0; i < 40; i++) { c.beginPath(); c.arc((r() - 0.5) * w * 0.7, wy + (r() - 0.5) * s * 0.3, s * (0.015 + r() * 0.025), 0, 7); c.fillStyle = ['#C9954F', '#E1B36A', '#9B6A36', '#F0D29A'][i % 4]; c.fill(); } c.restore();
  c.fillStyle = B.yellow; c.fillRect(-w / 2, -h * 0.3, w, s * 0.2);
  word(c, 'OAT & HONEY', 0, -h * 0.215, { size: s * 0.058, weight: 700, font: TYPE.ui, track: 0.06, color: B.ink, align: 'center' });
  word(c, 'GRANOLA', 0, -h * 0.13, { size: s * 0.085, weight: 800, font: TYPE.display, track: 0.01, color: B.ink, align: 'center' });
  word(c, 'ORGANIC · 12 OZ', 0, h * 0.36, { size: s * 0.04, weight: 600, font: TYPE.mono, track: 0.05, color: B.ink, align: 'center', alpha: 0.75 });
  c.restore();
}

// ---------- the conveyor strip: supplier cards laid flat (with their reflection), then bent around the viewer ----------
const CW = 440, CH = 300, CGAP = 44, REF = 170; // strip px (not scaled: the strip is scaled when bent)
const SUP = [
  ['Co-packer', 'New Jersey · SQF certified', ['Granola', 'Bars', 'Pouches']], ['Bakery', 'Illinois · Organic', ['Baked goods', 'Cookies']],
  ['Private label', 'Ohio · Kosher', ['Snacks', 'Trail mix']], ['YOUR SPEC'], ['Snack maker', 'California · Gluten free', ['Bars', 'Bites']],
  ['Ingredient supplier', 'Oregon · Non-GMO', ['Oats', 'Honey']], ['Packaging', 'Wisconsin · Compostable', ['Pouches', 'Film']],
  ['Co-manufacturer', 'New Jersey · SQF · Organic', ['Granola', 'Clusters', 'Pouches']], ['Co-packer', 'Texas · BRC certified', ['Cereal', 'Granola']],
  ['Bakery', 'Georgia · Organic', ['Bars', 'Crisps']], ['Private label', 'Utah · SQF', ['Supplements']], ['Snack maker', 'Colorado · Vegan', ['Chips']],
];
const MATCH = 7, SPEC = 3, cx0 = i => i * (CW + CGAP) + CW / 2 + 80;
function factory(c, x, y, s, col) { c.save(); c.fillStyle = col; c.beginPath(); c.moveTo(x, y + s); c.lineTo(x, y + s * 0.35); c.lineTo(x + s * 0.3, y + s * 0.55); c.lineTo(x + s * 0.3, y + s * 0.35); c.lineTo(x + s * 0.6, y + s * 0.55); c.lineTo(x + s * 0.6, y); c.lineTo(x + s * 0.8, y); c.lineTo(x + s * 0.8, y + s * 0.55); c.lineTo(x + s, y + s * 0.55); c.lineTo(x + s, y + s); c.closePath(); c.fill(); c.restore(); }
function supplierCard(c, x, y, i, lt) {
  const [kind, sub, tags] = SUP[i], match = i === MATCH && lt > 1.75, pref = i % 4 === 1;
  if (i === SPEC) { // the generated spec, now riding the belt
    rrect(c, x, y, CW, CH, 26); c.fillStyle = B.ink; c.fill(); pouch(c, x + 100, y + CH / 2 + 6, 190, 1);
    word(c, 'Your spec', x + 210, y + 64, { size: 20, weight: 600, font: TYPE.mono, track: 0.04, color: B.yellow });
    word(c, 'Oat & Honey', x + 210, y + 120, { size: 40, color: B.white }); word(c, 'Granola', x + 210, y + 164, { size: 40, color: B.white });
    word(c, '12 oz pouch · Organic', x + 210, y + 210, { size: 20, font: TYPE.ui, weight: 400, track: 0, color: B.mute }); return;
  }
  c.save(); if (match) { c.shadowColor = 'rgba(255,215,0,0.55)'; c.shadowBlur = 40; }
  rrect(c, x, y, CW, CH, 26); c.fillStyle = B.card; c.fill(); c.restore();
  rrect(c, x + 0.5, y + 0.5, CW - 1, CH - 1, 26); c.strokeStyle = match ? B.ink : B.line; c.lineWidth = match ? 4 : 2; c.stroke();
  factory(c, x + 30, y + 30, 40, B.ink);
  if (pref) pill(c, 'Preferred', x + CW - 30, y + 50, { size: 18, font: TYPE.ui, weight: 600, fill: B.yellow, color: B.ink, align: 'right', h: 34 });
  word(c, kind, x + 30, y + 132, { size: 40, color: B.ink }); word(c, sub, x + 30, y + 168, { size: 20, font: TYPE.ui, weight: 400, track: 0, color: '#6D6C66' });
  let tx = x + 30; tags.forEach(tg => { tx += pill(c, tg, tx, y + 222, { size: 17, font: TYPE.ui, weight: 500, fill: '#F1F0EA', color: B.ink, align: 'left', h: 34 }) + 8; });
  c.beginPath(); c.arc(x + 38, y + 270, 6, 0, 7); c.fillStyle = B.green; c.fill(); word(c, 'Accepting projects', x + 52, y + 277, { size: 17, font: TYPE.ui, weight: 500, track: 0, color: '#6D6C66' });
  if (match) { const e = spr(lt - 1.75, 300, 20); c.save(); cam(c, e, x + CW - 30, y + 50); pill(c, 'Matched', x + CW - 30, y + 50, { size: 20, font: TYPE.ui, weight: 700, fill: B.ink, color: B.yellow, align: 'right', h: 40 }); c.restore(); }
}
function strip(lt) {
  const [cv, x] = scratch('belt', SUP.length * (CW + CGAP) + 160, CH + REF + 20);
  SUP.forEach((_, i) => supplierCard(x, cx0(i) - CW / 2, 10, i, lt));
  x.save(); x.translate(0, 2 * (CH + 10) + 14); x.scale(1, -1); x.globalAlpha = 0.9; x.drawImage(cv, 0, 0, cv.width, CH + 10, 0, 0, cv.width, CH + 10); x.restore(); // mirror
  const g = x.createLinearGradient(0, CH + 24, 0, CH + REF); g.addColorStop(0, B.cream + 'B8'); g.addColorStop(1, B.cream); x.fillStyle = g; x.fillRect(0, CH + 22, cv.width, REF);
  return cv;
}
// Keychain product icons for the triptych
function icon(c, kind, x, y, s, t) {
  c.save(); c.strokeStyle = B.white; c.fillStyle = B.white; c.lineWidth = 3 * S;
  if (kind === 0) { const pts = [0, 1, 2, 3, 4, 5].map(k => [x + Math.cos(k * 1.047 + 0.3) * s, y + Math.sin(k * 1.047 + 0.3) * s]); pts.forEach(([px, py], k) => { c.globalAlpha = 0.5; c.beginPath(); c.moveTo(x, y); c.lineTo(px, py); c.stroke(); c.globalAlpha = 1; c.beginPath(); c.arc(px, py, 9 * S, 0, 7); c.fill(); }); c.beginPath(); c.arc(x, y, 20 * S, 0, 7); c.fillStyle = B.yellow; c.fill(); }
  if (kind === 1) { const pts = [[-1, 0.6], [-0.5, 0.3], [-0.1, 0.45], [0.35, -0.1], [0.75, -0.2], [1, -0.7]].map(([a, b]) => [x + a * s, y + b * s]); polyPart(c, pts, ease.inOut(clamp(t))); c.beginPath(); c.arc(pts[5][0], pts[5][1], 10 * S, 0, 7); c.fillStyle = B.yellow; if (t > 0.95) c.fill(); }
  if (kind === 2) { orbit(c, x, y, [{ r: s * 0.55, n: 6, dot: 6 * S, speed: 0.8, lw: 2 * S, alpha: 0.5 }, { r: s, n: 9, dot: 8 * S, speed: -0.5, lw: 2 * S, alpha: 0.3 }], t); c.beginPath(); c.arc(x, y, 20 * S, 0, 7); c.fillStyle = B.yellow; c.fill(); }
  c.restore();
}
const FLAPS = [['GRANOLA', 12.72], ['KOMBUCHA', 13.5], ['PROTEIN BARS', 14.28]];
const LINKS = ['Brand', 'Co-packer', 'Ingredients', 'Packaging', 'Retailer', 'Brand', 'Co-packer', 'Logistics', 'Brand', 'Co-packer', 'Ingredients', 'Brand', 'Packaging', 'Retailer'];
const PROMPT = 'Oat & honey granola, organic, 12 oz pouch';
const FW = 1120 * S, FH = 150 * S, FX = W / 2 - FW / 2, FY = H / 2 - FH / 2; // prompt field
const SW_ = 1240 * S, SH_ = 660 * S, SX = W / 2 - SW_ / 2, SY = H / 2 - SH_ / 2; // spec sheet

window.VIDEO = {
  duration: 24,
  audio: 'audio.wav',
  fonts: ['Inter Tight:wght@400;500;600;700;800', 'Inter:wght@400;500;600;700;800', 'IBM Plex Mono:wght@500;600'],
  assets: ['wordmark-white.svg'],
  bed: { bpm: 100, sections: [[0, 'intro'], [4.8, 'break'], [9.6, 'groove'], [18.0, 'drive'], [20.4, 'end']], chords: [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]] },
  sfx: [
    ...[0.08, 0.18, 0.28, 0.38].map(t => [t, 'tick', 0.35]), [0.5, 'swoosh', 0.25], [1.0, 'blip', 1.0], ...Array.from({ length: 8 }, (_, i) => [1.02 + i * 0.045, 'type', 0.3]),
    [2.95, 'whoosh', 0.8], [3.0, 'thud', 0.6],
    [4.75, 'whoosh', 0.4], ...Array.from({ length: 21 }, (_, i) => [5.2 + i * 0.058, 'type', 0.45]), [6.62, 'click', 0.9], [6.68, 'pop', 0.5],
    [7.2, 'swoosh', 0.5], ...Array.from({ length: 6 }, (_, i) => [7.55 + i * 0.12, 'pop', 0.35]), [8.1, 'blip', 0.4], [9.1, 'whoosh', 0.6],
    [9.6, 'swoosh', 0.4], [11.35, 'click', 0.8], [11.37, 'chime', 0.45],
    [12.6, 'swoosh', 0.5], ...FLAPS.flatMap(([, s]) => Array.from({ length: 9 }, (_, i) => [s + i * 0.035, 'tick', 0.32])),
    [15.0, 'swoosh', 0.4], ...Array.from({ length: 14 }, (_, i) => [15.25 + i * 0.1, 'click', 0.45]), ...Array.from({ length: 9 }, (_, i) => [16.5 + i * 0.08, 'tick', 0.4]),
    [17.9, 'whoosh', 0.6], [18.0, 'thud', 0.7], [18.12, 'thud', 0.5], [18.24, 'thud', 0.5], [19.95, 'swoosh', 0.5],
    [21.05, 'pop', 0.6], [21.4, 'chime', 0.9], [21.7, 'whoosh', 0.4], [22.45, 'click', 0.7],
  ],
  overlay(c, t) { grain(c, t, 0.05); },
  scenes: [
    { start: 0, end: 3.0, draw(c, p, t) { // barcode: scanned, then its bars become the cut to black
      bg(c, B.cream); marks(c, t, { seed: 4, color: B.ink, alpha: 0.42 });
      const bw = 560 * S, bh = 210 * S, bx = W / 2 - bw / 2, by = H * 0.42 - bh / 2, zoom = lerp(1, 4.2, ease.in(prog(t, 2.45, 3.0)));
      c.save(); cam(c, zoom, W / 2, H * 0.42);
      barcode(c, bx, by, bw, bh, { seed: 21, color: B.ink, p: ease.out(prog(t, 0.05, 0.45)), grow: ease.inOut(prog(t, 2.1, 2.55)), widen: ease.in(prog(t, 2.25, 2.75)) });
      const sp = prog(t, 0.5, 1.0);
      if (sp > 0 && sp < 1) { const sx = bx - 30 * S + (bw + 60 * S) * ease.inOut(sp); c.fillStyle = B.yellow + 'AA'; c.fillRect(sx - 40 * S, by - 40 * S, 80 * S, bh + 80 * S); c.fillStyle = B.ink; c.fillRect(sx - 1.5 * S, by - 40 * S, 3 * S, bh + 80 * S); }
      c.restore();
      if (t < 2.2) typed(c, 'SCANNED — OAT & HONEY GRANOLA · 12 OZ', W / 2 - tw(c, 'SCANNED — OAT & HONEY GRANOLA · 12 OZ', 20 * S, 600, TYPE.mono, 0.05) / 2, by - 44 * S, prog(t, 1.0, 1.4), { size: 20 * S, weight: 600, font: TYPE.mono, track: 0.05, color: B.ink });
      say(c, 'Every product on the shelf', H * 0.76, t - 1.15, { color: B.ink, out: 0.75 });
      c.fillStyle = B.night; c.globalAlpha = ease.in(prog(t, 2.72, 2.98)); c.fillRect(0, 0, W, H); c.globalAlpha = 1; // bars finish the cut to black
    } },
    { start: 3.0, end: 4.8, draw(c, p, t) { // skylights come up
      night(c, t, ease.out(prog(t, 3.0, 3.7)));
      say(c, 'started with someone who could make it.', H * 0.53, t - 3.25, { out: 1.2 });
    } },
    { start: 4.8, end: 7.2, draw(c, p, t) { // Keychain's Generate Products prompt, typed
      night(c, t, 0.8); const e = spr(t - 4.8, 170, 22), y = FY + (1 - e) * 220 * S;
      c.save(); c.globalAlpha = clamp(e * 1.5);
      ui(c, '✦  Generate Products', FX + 8 * S, y - 30 * S, { size: 24 * S, weight: 500, color: B.mute });
      glass(c, FX, y, FW, FH, { r: 38 * S, under: '#16161A' });
      const n = Math.round(clamp(prog(t, 5.2, 6.4)) * PROMPT.length), s = PROMPT.slice(0, n), ty = y + FH / 2 + 14 * S, tx = FX + 46 * S;
      if (!n) ui(c, 'Describe your product…', tx, ty, { size: 38 * S, color: B.mute2 });
      ui(c, s, tx, ty, { size: 38 * S, weight: 500, color: B.white });
      if (Math.floor(t * 2.5) % 2 === 0 || (t > 5.2 && t < 6.4)) { c.fillStyle = B.yellow; c.fillRect(tx + tw(c, s, 38 * S, 400, TYPE.ui, -0.01) + 4 * S, ty - 34 * S, 3 * S, 44 * S); }
      const press = t > 6.62 && t < 6.75 ? 0.92 : 1, bxp = FX + FW - 36 * S, byp = y + FH / 2;
      c.save(); cam(c, press, bxp - 90 * S, byp); pill(c, 'Generate  ✦', bxp, byp, { size: 26 * S, font: TYPE.ui, weight: 600, fill: B.yellow, color: B.ink, align: 'right', h: 70 * S }); c.restore();
      const mp = ease.inOut(prog(t, 6.1, 6.55)); pointer(c, lerp(W * 0.78, bxp - 70 * S, mp), lerp(H * 0.86, byp + 6 * S, mp), press < 1 ? 0.9 : 1, {});
      c.restore();
      ui(c, 'Describe your product to create a detailed spec with photos and sales estimates.', W / 2, H * 0.8, { size: 24 * S, color: B.mute, align: 'center', alpha: prog(t, 5.4, 5.8) });
    } },
    { start: 7.2, end: 9.6, draw(c, p, t) { // the spec sheet generates
      const lt = t - 7.2, m = spr(lt, 170, 24), out = ease.inOut(prog(t, 9.05, 9.6));
      night(c, t, 0.8 * (1 - out * 0.6));
      const x = lerp(FX, SX, m), y = lerp(FY, SY, m), w = lerp(FW, SW_, m), h = lerp(FH, SH_, m);
      c.save(); cam(c, lerp(1, 0.34, out), W / 2, H / 2);
      glass(c, x, y, w, h, { r: 38 * S, under: '#16161A' });
      const a = prog(lt, 0.2, 0.4);
      ui(c, '✦  Spec · generated with Keychain AI', x + 44 * S, y + 64 * S, { size: 22 * S, weight: 500, color: B.mute, alpha: a });
      c.save(); c.globalAlpha = a; rrect(c, x + 44 * S, y + 100 * S, 480 * S, 520 * S, 26 * S); c.fillStyle = '#1C1B16'; c.fill(); glow(c, x + 284 * S, y + 330 * S, 300 * S, B.beam, 0.12, 'lighter'); c.restore();
      pouch(c, x + 284 * S, y + 360 * S, 400 * S, prog(lt, 0.3, 0.9));
      [['Product', 'Oat & Honey Granola'], ['Format', '12 oz stand-up pouch'], ['Claims', 'Organic · Non-GMO'], ['Certifications', 'SQF · USDA Organic'], ['Run size', '3,000 lb'], ['Sales estimate', '']].forEach(([k, v], i) => {
        const q = spr(lt - 0.35 - i * 0.12, 260, 24), ry = y + (130 + i * 82) * S; if (q <= 0) return;
        c.save(); c.globalAlpha = clamp(q * 2); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(x + 580 * S, ry + 28 * S, w - 624 * S, 1.5 * S);
        ui(c, k, x + 580 * S, ry + (1 - q) * 20 * S, { size: 20 * S, color: B.mute });
        if (v) ui(c, v, x + 800 * S, ry + (1 - q) * 20 * S, { size: 28 * S, weight: 500, color: B.white });
        else for (let b = 0; b < 12; b++) { const bh = (18 + 34 * (0.35 + 0.65 * rng(b + 3)()) * (b / 11 + 0.3)) * S * ease.out(prog(lt, 0.95 + b * 0.03, 1.3 + b * 0.03)); c.fillStyle = b > 8 ? B.yellow : 'rgba(255,255,255,0.55)'; c.fillRect(x + 800 * S + b * 30 * S, ry + 8 * S - bh, 18 * S, bh); }
        c.restore();
      });
      c.restore();
    } },
    { start: 9.6, end: 12.6, draw(c, p, t) { // the curved conveyor of suppliers
      const lt = t - 9.6; bg(c, B.cream); marks(c, t, { seed: 9, color: B.ink, alpha: 0.32, clear: [0.9, 0.62] });
      const scroll = track(lt, [[0, cx0(SPEC)], [0.25, cx0(MATCH)]], 50, 13), z = lerp(0.34 * (1240 / 440) * S, 1.3 * S, ease.out(prog(lt, 0, 0.4)));
      const src = strip(lt); c.save(); c.translate(W / 2, H * 0.45); c.scale(z, z); bend(c, src, 0, 0, W * 0.5 / z, scroll); c.restore();
      const tape = 'KEYCHAIN CONNECT — 30,000+ SUPPLIER PROFILES', tw_ = tw(c, tape, 20 * S, 600, TYPE.mono, 0.08);
      word(c, tape, W / 2, 128 * S, { size: 20 * S, weight: 600, font: TYPE.mono, track: 0.08, color: B.ink, align: 'center', alpha: prog(lt, 0.2, 0.5) });
      c.fillStyle = B.ink; [-1, 1].forEach(d => { for (let k = 0; k < 12; k++) c.fillRect(W / 2 + d * (tw_ / 2 + 30 * S + k * 8 * S), 110 * S, 1.5 * S, (k % 4 ? 10 : 18) * S); });
      say(c, 'Keychain finds the one who can.', H * 0.9, lt - 0.45, { color: B.ink, out: 2.2 });
    } },
    { start: 12.6, end: 15.0, draw(c, p, t) { // split-flap board of categories
      night(c, t, 0.55);
      words(c, 'Find a manufacturer for', W / 2, H * 0.34, t - 12.65, { size: 76 * S, weight: 500, color: B.white });
      let cur = FLAPS[0], prev = ''; FLAPS.forEach((f, i) => { if (t >= f[1]) { cur = f; prev = i ? FLAPS[i - 1][0] : ''; } });
      const mid = w => ' '.repeat(Math.floor((12 - w.length) / 2)) + w; // centre the word in the 12 cells
      c.save(); c.globalAlpha = prog(t, 12.6, 12.8); flap(c, mid(cur[0]), W / 2, H * 0.57, t - cur[1], { cells: 12, cw: 112 * S, ch: 160 * S, size: 104 * S, ink: B.yellow, prev: prev && mid(prev), per: 0.03, spin: 4, stagger: 0.016 }); c.restore();
      ui(c, 'Search 28,000+ manufacturers by product, category, or capability.', W / 2, H * 0.8, { size: 26 * S, color: B.mute, align: 'center', alpha: prog(t, 13.0, 13.4) });
    } },
    { start: 15.0, end: 18.0, draw(c, p, t) { // the network as a chain of links
      const lt = t - 15.0; night(c, t, 0.9);
      words(c, 'Connect with brands.', W / 2, H * 0.27, lt - 0.05, { size: 100 * S, weight: 500, color: B.white });
      const n = clamp((lt - 0.25) / 0.1, 0, LINKS.length), L = 170 * S, pitch = L * 0.8, x0 = 150 * S - lt * 40 * S;
      chain(c, x0, H * 0.54, n, { L, lw: 18 * S, color: B.yellow, pitch });
      LINKS.forEach((s, i) => { const a = clamp(n - i - 0.3); if (a > 0) ui(c, s, x0 + i * pitch, H * 0.54 + (i % 2 ? -1 : 1) * 110 * S + (i % 2 ? 0 : 10 * S), { size: 22 * S, weight: 500, color: B.mute, align: 'center', alpha: a }); });
      const q = prog(lt, 1.5, 2.3);
      if (q > 0) { counter(c, 28000 * ease.out(q), W / 2, H * 0.8, { size: 84 * S, font: TYPE.display, weight: 500, color: B.white, suffix: '+' });
        ui(c, 'brands and manufacturers, and the intelligence between them', W / 2, H * 0.88, { size: 26 * S, color: B.mute, align: 'center', alpha: prog(lt, 1.7, 2.0) }); }
    } },
    { start: 18.0, end: 20.4, draw(c, p, t) { // three products, three glass panels
      const lt = t - 18.0; night(c, t, 0.85);
      const pw = 520 * S, ph = 620 * S, gap = 40 * S, x0 = W / 2 - (pw * 3 + gap * 2) / 2, y0 = H / 2 - ph / 2 + 20 * S, fold = ease.inOut(prog(lt, 1.9, 2.4));
      [['Connect', 'Connect with brands.', 'The largest network in CPG.'], ['Edge', 'Grow your revenue.', 'The CRM revenue platform for CPG.'], ['OS', 'Run your operations.', 'The AI-powered ERP system.']].forEach(([name, line, sub], i) => {
        const e = spr(lt - i * 0.12, 200, 22), px = lerp(x0 + i * (pw + gap), W / 2 - pw / 2, fold), sc = lerp(lerp(0.86, 1, e), 0.25, fold);
        c.save(); c.globalAlpha = clamp(e * 2) * (1 - fold); cam(c, sc, px + pw / 2, y0 + ph / 2, 0, (1 - e) * 260 * S);
        glass(c, px, y0, pw, ph, { r: 34 * S, under: '#131312' });
        ui(c, 'Keychain', px + 40 * S, y0 + 64 * S, { size: 22 * S, color: B.mute }); ui(c, `0${i + 1}`, px + pw - 40 * S, y0 + 64 * S, { size: 22 * S, font: TYPE.mono, color: B.mute, align: 'right' });
        icon(c, i, px + pw / 2, y0 + 230 * S, 90 * S, prog(lt, 0.2 + i * 0.12, 0.9 + i * 0.12));
        word(c, name, px + 40 * S, y0 + 460 * S, { size: 110 * S, color: B.white });
        ui(c, line, px + 40 * S, y0 + 520 * S, { size: 30 * S, weight: 500, color: B.white }); ui(c, sub, px + 40 * S, y0 + 562 * S, { size: 22 * S, color: B.mute });
        c.restore();
      });
    } },
    { start: 20.4, end: 24.0, draw(c, p, t) { // one link closes into the k
      const lt = t - 20.4; night(c, t, 1);
      const ms = 200 * S, m = ease.inOut(prog(lt, 0.05, 0.55)), fill = prog(lt, 0.5, 0.68), slide = spr(lt - 1.2, 170, 26);
      const wmH = 136 * S, wmW = wmH * (257 / 64), total = ms + 50 * S + wmW, mx = lerp(W / 2, W / 2 - total / 2 + ms / 2, slide), my = H / 2 - 30 * S;
      if (fill < 1) { const lw_ = lerp(270 * S, ms, m), lh = lerp(160 * S, ms, m), a = spr(lt, 300, 20);
        c.save(); cam(c, a, mx, my); rrect(c, mx - lw_ / 2, my - lh / 2, lw_, lh, lh / 2); c.strokeStyle = B.yellow; c.lineWidth = lerp(20 * S, 10 * S, m); c.stroke(); c.globalAlpha = fill; c.fillStyle = B.yellow; c.fill(); c.restore(); }
      else { const k = lt - 0.68; kmark(c, mx, my, ms, { stem: ease.out(prog(k, 0, 0.22)), bowl: ease.out(prog(k, 0.1, 0.32)), leg: spr(k - 0.18, 260, 22) }); }
      const rev = ease.out(prog(lt, 1.25, 1.7));
      if (rev > 0) { const wx = mx + ms / 2 + 50 * S; c.save(); c.beginPath(); c.rect(wx, my - wmH, wmW * rev, wmH * 2); c.clip(); c.drawImage(img('wordmark-white.svg'), wx - (1 - rev) * 60 * S, my - wmH * 0.58, wmW, wmH); c.restore(); }
      say(c, 'The AI Platform for CPG', H / 2 + 170 * S, lt - 1.7, { size: 44 * S, weight: 400, color: B.mute });
      const cta = spr(lt - 2.05, 300, 22);
      if (cta > 0) { c.save(); cam(c, cta, W / 2, H / 2 + 270 * S); pill(c, 'Request access  ·  keychain.com', W / 2, H / 2 + 270 * S, { size: 28 * S, font: TYPE.ui, weight: 600, fill: B.yellow, color: B.ink }); c.restore(); }
    } },
  ],
};
