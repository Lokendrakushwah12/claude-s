// Keychain — Swiss kinetic-type brand film, after @az_andrian's Whop piece (x.com/az_andrian/status/2104495114534133847).
// Grammar taken from the reference, content from keychain.com. 150 BPM: beat 0.4 s, bar 1.6 s; every cut lands on a beat.
// Brand: yellow #FFEC42 (their --primary, hsl 54 100% 63%), ink, Inter / Inter Tight, the k mark and the wordmark.
// Yellow on light fails contrast, so on light grounds yellow is a FIELD (highlight block, card fill), never text.
const B = {
  paper: '#EDEDEA', pline: '#DCDCD7', ink: '#0B0B0C', dark: '#141414', dline: '#1E1E1E',
  yellow: '#FFEC42', yline: '#F2DD2C', gold: '#B89B00', white: '#FFFFFF', mute: '#8C8C87', chev: '#232323',
};
Object.assign(TYPE, { display: 'Inter Tight', ui: 'Inter', weight: 500, track: -0.045 });
const M = 64 * S; // page margin
const TH = { // poster themes
  light: { g: B.paper, l: B.pline, ink: B.ink, hl: B.yellow, hlInk: B.ink, sub: B.ink },
  dark: { g: B.dark, l: B.dline, ink: B.white, hl: B.yellow, hlInk: B.ink, sub: '#D4D4CF' },
  yellow: { g: B.yellow, l: B.yline, ink: B.ink, hl: B.ink, hlInk: B.yellow, sub: B.ink },
};

// Keychain mark, redrawn from keychain-logo-mark-circle.png (1200-unit box): stem, quarter-disc bowl, leg.
// Each piece has its own progress so the mark can assemble itself.
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

// ---------- poster .1 — Connect ----------
function posterConnect(c, t, th) { // t = seconds since the poster starts; everything is settled by t ≈ 1.8
  grid(c, th.g, th.l);
  const m = spr(t - 0.4, 170, 26), s1 = 240 * S, w1 = tw(c, 'Connect', s1);
  c.save(); c.translate(lerp(W / 2 - (w1 * 1.3) / 2, M, m), lerp(H / 2 + 120 * S, 250 * S, m)); c.scale(lerp(1.3, 1, m), lerp(1.3, 1, m));
  riseChars(c, 'Connect', 0, 0, t, { size: s1, color: th.ink, gap: 0.035 }); c.restore();
  // meta row + arrow
  [['keychain', 1010, 600], ['2026', 1175, 600], ['Keychain Connect', 1310, 400]].forEach(([s, x, wt], i) => scramble(c, s, x * S, 186 * S, prog(t, 0.7 + i * 0.05, 1.0 + i * 0.05), { size: 30 * S, weight: wt, color: th.ink, seed: i }));
  arrow(c, 1640 * S, 165 * S, 215 * S, prog(t, 0.8, 1.2), { color: th.ink, lw: 24 * S });
  // "with brands." — right aligned, highlight on "brands."
  const s2 = 236 * S, full2 = tw(c, 'with brands.', s2), x2 = W - M - full2, wWith = tw(c, 'with ', s2), wBr = tw(c, 'brands.', s2);
  hl(c, x2 + wWith - 14 * S, 490 * S - s2 * 0.78, wBr + 28 * S, s2 * 0.98, prog(t, 1.15, 1.45), th.hl);
  rise(c, 'with', x2, 490 * S, spr(t - 0.55), { size: s2, color: th.ink });
  rise(c, 'brands.', x2 + wWith, 490 * S, spr(t - 0.62), { size: s2, color: t > 1.3 ? th.hlInk : th.ink });
  // small copy, left + right
  ['Keychain is how modern consumer', 'brands and their manufacturers', 'run, grow, and connect.'].forEach((s, i) => rise(c, s, M + 12 * S, (372 + i * 34) * S, spr(t - 0.95 - i * 0.04), { size: 28 * S, weight: 400, font: TYPE.ui, track: -0.01, color: th.sub }));
  rise(c, 'The largest', M + 6 * S, 732 * S, spr(t - 0.75), { size: 236 * S, color: th.ink });
  ['Tens of thousands of brands', 'and manufacturers. Billions', 'of data points.'].forEach((s, i) => rise(c, s, 1440 * S, (598 + i * 34) * S, spr(t - 1.0 - i * 0.04), { size: 28 * S, weight: 400, font: TYPE.ui, track: -0.01, color: th.sub }));
  // "network in CPG" + ".1"
  const s4 = 214 * S, wNet = tw(c, 'network in ', s4), wCpg = tw(c, 'CPG', s4);
  hl(c, M + wNet - 12 * S, 978 * S - s4 * 0.78, wCpg + 24 * S, s4 * 0.98, prog(t, 1.3, 1.6), th.hl);
  rise(c, 'network in', M + 6 * S, 978 * S, spr(t - 0.9), { size: s4, color: th.ink });
  rise(c, 'CPG', M + wNet, 978 * S, spr(t - 0.97), { size: s4, color: t > 1.45 ? th.hlInk : th.ink });
  rise(c, '.1', W - M, 990 * S, spr(t - 1.1), { size: 300 * S, color: th.ink, align: 'right' });
}

// ---------- poster .2 — Edge ----------
const EDGE = series(26, 11, 1.2);
function posterEdge(c, t, th, hideO = false) {
  grid(c, th.g, th.l);
  const s1 = 228 * S, y1 = 244 * S;
  if (hideO) { rise(c, 'Gr', M, y1, 1, { size: s1, color: th.ink }); rise(c, 'w your', M + tw(c, 'Gro', s1), y1, 1, { size: s1, color: th.ink }); }
  else rise(c, 'Grow your', M, y1, spr(t), { size: s1, color: th.ink });
  rise(c, 'revenue.', 0.265 * W, 472 * S, spr(t - 0.08), { size: s1, color: th.ink });
  arrow(c, 1640 * S, 165 * S, 215 * S, prog(t, 0.2, 0.6), { color: th.ink, lw: 24 * S });
  ['Keychain', 'Edge', 'CRM'].forEach((s, i) => { scramble(c, s, M, (352 + i * 36) * S, prog(t, 0.2, 0.5), { size: 32 * S, color: th.ink, seed: i }); scramble(c, s, W - M, (352 + i * 36) * S, prog(t, 0.25, 0.55), { size: 32 * S, color: th.ink, seed: i + 5, align: 'right' }); });
  // three columns: discover / nurture / win
  [['Discover', 'deals', '.1'], ['Nurture', 'buyers', '.2'], ['Win', 'reorders', '.3']].forEach(([a, b, n], i) => {
    const x = M + i * 0.2 * W, p = spr(t - 0.22 - i * 0.07), s = 78 * S;
    rise(c, a, x, 652 * S, p, { size: s, color: th.ink }); rise(c, b, x, 722 * S, spr(t - 0.27 - i * 0.07), { size: s, color: th.ink });
    scramble(c, n, x + tw(c, a, s) + 10 * S, 652 * S, prog(t, 0.4 + i * 0.07, 0.6 + i * 0.07), { size: 30 * S, weight: 600, color: th.ink, seed: i });
  });
  // pipeline block: yellow field with a self-drawing line
  const bx = 0.64 * W, by = 548 * S, bw = W - M - bx, bh = 212 * S; hl(c, bx, by, bw, bh, prog(t, 0.3, 0.6), th.hl);
  if (t > 0.35) {
    c.save(); c.strokeStyle = th.hlInk; c.lineWidth = 6 * S; c.lineJoin = 'round';
    const pts = EDGE.map((v, i) => [bx + 30 * S + (i / (EDGE.length - 1)) * (bw - 60 * S), by + bh - 30 * S - v * (bh - 90 * S)]), q = ease.inOut(prog(t, 0.35, 0.95));
    polyPart(c, pts, q); const L = pts[Math.min(pts.length - 1, Math.round(q * (pts.length - 1)))];
    c.fillStyle = th.hlInk; c.beginPath(); c.arc(L[0], L[1], 11 * S, 0, 7); c.fill(); c.restore();
    ui(c, 'From first touch to reorder', bx + 30 * S, by + 46 * S, { size: 24 * S, weight: 500, color: th.hlInk });
  }
  // bottom row
  rise(c, 'Edge', M, 1000 * S, spr(t - 0.3), { size: 240 * S, color: th.ink });
  [['2026', 0.335, 700], ['CRM Revenue Platform', 0.415, 400], ['Keychain Edge', 0.615, 400], ['2026', 0.79, 700]].forEach(([s, x, wt], i) => scramble(c, s, x * W, 960 * S, prog(t, 0.45 + i * 0.04, 0.7 + i * 0.04), { size: 34 * S, weight: wt, color: th.ink, seed: i + 9 }));
  rise(c, '.2', W - M, 1000 * S, spr(t - 0.36), { size: 300 * S, color: th.ink, align: 'right' });
}

const FACTS = [['Search 30,000+', 'supplier profiles'], ['Get matched with', 'qualified suppliers'], ['From first touch', 'to reorder'], ['Food safety &', 'traceability'],
  ['Sync accounting,', 'EDI & logistics'], ['Generate product', 'specs with AI'], ['SOC 2', 'compliant'], ['Inventory, purchasing', '& production'],
  ['28,000+ brands', '& manufacturers'], ['One connected', 'system of record']];
const OPS = ['Food safety', 'Inventory', 'Purchasing', 'Production', 'Traceability'];
const CATS = ['Granola', 'Gummies', 'Protein bars', 'Energy drinks', 'Chocolate', 'Supplements', 'Packaging', 'Beauty', 'Coffee', 'Snacks', 'Sauces', 'Pet food', 'Kombucha', 'Baked goods', 'Spices', 'Frozen'];
const CW = 360 * S, CH = 150 * S, CG = 26 * S; // feature card size + gap
const TK = 0.8, TN = 4; // tunnel: scale per layer, layers

function card2(c, x, y, lines, kind, p) { // kind: 0 ink, 1 outline, 2 yellow
  if (p <= 0) return; const s = lerp(0.6, 1, p), cx = x + CW / 2, cy = y + CH / 2;
  c.save(); c.translate(cx, cy); c.scale(s, s); c.translate(-cx, -cy); c.globalAlpha = clamp(p * 2);
  rrect(c, x, y, CW, CH, 24 * S); c.fillStyle = kind === 0 ? B.ink : kind === 2 ? B.yellow : B.paper; c.fill();
  if (kind === 1) { c.strokeStyle = B.ink; c.lineWidth = 2 * S; c.stroke(); }
  const fg = kind === 0 ? B.white : B.ink; check(c, x + 38 * S, y + 38 * S, 15 * S, { color: fg, lw: 2.6 * S, p: prog(p, 0.3, 1) });
  lines.forEach((l, i) => ui(c, l, x + 26 * S, y + CH - (50 - i * 28) * S, { size: 23 * S, weight: 500, color: fg }));
  c.restore();
}
// 3D-ring timing shared by the ring and the match cut into it
const ringTheta = lt => lerp(0.9, Math.PI * 2, ease.inOut(prog(lt, 0, 0.6)));

window.VIDEO = {
  duration: 16,
  audio: 'audio.wav',
  fonts: ['Inter Tight:wght@400;500;600;700', 'Inter:wght@400;500;600;700'],
  assets: ['wordmark-white.svg', 'wordmark-black.svg'],
  bed: { bpm: 150, sections: [[0, 'groove'], [6.4, 'break'], [8.0, 'drive'], [13.6, 'end']], chords: [[53, 57, 60, 64], [55, 59, 62, 67], [57, 60, 64, 69], [52, 55, 59, 64]] },
  sfx: [
    [0.02, 'thud'], ...[0.05, 0.09, 0.12, 0.16, 0.19, 0.23].map(t => [t, 'type', 0.7]), [0.55, 'tick'], [0.75, 'tick'], [0.9, 'tick'], [1.1, 'pop', 0.6], [1.2, 'swoosh', 0.35], [1.45, 'blip', 0.5],
    [2.0, 'whoosh'], [2.4, 'swoosh', 0.5], [2.8, 'thud'], [3.2, 'swoosh', 0.5],
    [3.6, 'thud'], ...[3.62, 3.68, 3.74, 3.8, 3.86, 3.92, 3.98, 4.04].map(t => [t, 'type', 0.6]),
    [4.4, 'thud'], [4.62, 'blip', 0.5], [4.7, 'blip', 0.5], [4.78, 'blip', 0.5], [4.9, 'swoosh', 0.3], [5.2, 'pop'],
    [5.6, 'whoosh'], [6.2, 'swoosh', 0.5], [6.4, 'chime', 0.5], ...[6.9, 6.98, 7.06, 7.14, 7.22].map(t => [t, 'blip', 0.4]), [7.25, 'whoosh'],
    [7.6, 'thud'], [8.0, 'thud'], [8.4, 'swoosh', 0.4],
    [8.8, 'thud'], [9.2, 'swoosh', 0.5], ...Array.from({ length: 12 }, (_, i) => [9.3 + i * 0.024, 'type', 0.5]), [9.6, 'pop'],
    [10.0, 'swoosh', 0.5], ...Array.from({ length: 8 }, (_, i) => [10.05 + i * 0.05, 'click', 0.5]),
    [11.2, 'thud'], ...Array.from({ length: 10 }, (_, i) => [11.22 + i * 0.05, 'tick', 0.6]), [11.8, 'whoosh'], [12.0, 'thud'], [12.4, 'thud'],
    ...Array.from({ length: 8 }, (_, i) => [12.8 + i * 0.1, 'pop', 0.45]),
    [14.6, 'swoosh', 0.5], [14.95, 'whoosh', 0.6], [15.2, 'chime'], [15.6, 'click', 0.6],
  ],
  scenes: [
    { start: 0, end: 2.0, draw(c, p, t) { posterConnect(c, t, TH.light); } },

    { start: 2.0, end: 2.8, draw(c, p, t) { // pull back into a wall of poster variants
      const lt = t - 2.0, z = lerp(1, 0.25, spr(lt, 110, 20)), G = 44, TWd = W + G, THt = H + G;
      const cx = W / 2 + lt * lt * 1400, cy = H / 2 + lt * lt * 700, phase = lt >= 0.4 ? 1 : 0;
      const img = { light: cached('c-light', x => posterConnect(x, 9, TH.light)), dark: cached('c-dark', x => posterConnect(x, 9, TH.dark)), yellow: cached('c-yel', x => posterConnect(x, 9, TH.yellow)) };
      bg(c, '#0A0A0A'); c.save(); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-cx, -cy);
      const hw = W / 2 / z, hh = H / 2 / z;
      for (let j = Math.floor((cy - hh) / THt) - 1; j <= Math.ceil((cy + hh) / THt); j++) for (let i = Math.floor((cx - hw) / TWd) - 2; i <= Math.ceil((cx + hw) / TWd) + 1; i++) {
        const ox = (((j % 2) + 2) % 2) * TWd * 0.5, r = rng(i * 73 + j * 191 + phase * 7)();
        const kind = i === 0 && j === 0 && !phase ? 'light' : r < 0.4 ? 'light' : r < 0.72 ? 'dark' : 'yellow';
        c.drawImage(img[kind], i * TWd + ox, j * THt);
      }
      c.restore();
    } },

    { start: 2.8, end: 3.6, draw(c, p, t) { // chapter 2: giant numerals, cropped
      const lt = t - 2.8; grid(c, B.dark, B.dline);
      [[-0.07, 0.6, 0], [0.2, 1.32, 0.05], [0.505, 0.62, 0.1], [0.82, 1.3, 0.15]].forEach(([x, y, d], i) => {
        const yy = y * H + (1 - spr(lt - d, 170, 22)) * H * 0.9 + track(lt, [[0, 0], [0.4, (i % 2 ? -1 : 1) * 70 * S]], 200, 26);
        word(c, '2', x * W, yy, { size: 1150 * S, color: B.yellow, weight: 500 });
      });
      const f = prog(lt, 0.1, 0.35);
      [['Chapter 2', M, 60], ['Keychain Edge', 0.2 * W, 60], ['Chapter 2', 0.32 * W, 60], ['Grow your revenue', W - M, 60, 'right'], ['Chapter 2', M, H / S - 36], ['Keychain Edge', 0.31 * W, H / S - 36], ['Grow your revenue', W - M, H / S - 36, 'right']]
        .forEach(([s, x, y, al], i) => scramble(c, s, x, y * S, f, { size: 28 * S, color: B.white, seed: i, align: al || 'left' }));
      ['Number Two', 'Keychain Edge'].forEach((s, i) => scramble(c, s, 0.19 * W, (730 + i * 34) * S, f, { size: 30 * S, color: B.white, align: 'right', seed: i + 20 }));
      ['A CRM and revenue platform', 'built for how CPG actually sells', '— from first touch to reorder.'].forEach((s, i) => scramble(c, s, 0.19 * W, (790 + i * 15) * S, f, { size: 12 * S, color: '#BDBDB8', align: 'right', seed: i + 30 }));
      [['CRM Revenue Platform', 0.51 * W, 400], ['2026', 0.72 * W, 700], ['keychain', 0.78 * W, 700]].forEach(([s, x, wt], i) => scramble(c, s, x, 734 * S, f, { size: 30 * S, weight: wt, color: B.white, seed: i + 40 }));
    } },

    { start: 3.6, end: 4.4, draw(c, p, t) { // yellow field, letters stacking
      const lt = t - 3.6; grid(c, B.yellow, B.yline);
      [['Grow', -0.012, 0.33, 0], ['your', 0.3, 0.64, 0.12], ['revenue.', 0.43, 0.955, 0.2]].forEach(([s, x, y, d]) => riseChars(c, s, x * W, y * H, lt - d, { size: 400 * S, color: B.ink, gap: 0.04 }));
      const f = prog(lt, 0.05, 0.3);
      [['Keychain Edge', M, 56], ['Chapter 2', 0.5 * W, 56], ['2026', W - M, 56, 'right'], ['Discover · Nurture · Win', M, H / S - 36]].forEach(([s, x, y, al], i) => scramble(c, s, x, y * S, f, { size: 28 * S, color: B.ink, seed: i, align: al || 'left' }));
    } },

    { start: 4.4, end: 5.6, draw(c, p, t) { // poster .2, then the "o" of Grow turns into a 3D ring in place
      const lt = t - 4.4, swap = lt >= 0.8;
      posterEdge(c, lt, TH.light, swap);
      if (swap) {
        const s1 = 228 * S, R = tw(c, 'o', s1) / 2 - 4 * S, ox = M + tw(c, 'Gr', s1) + tw(c, 'o', s1) / 2, oy = 244 * S - s1 * 0.265;
        const e = spr(lt - 0.8, 200, 20), rr = R * lerp(1, 1.18, e);
        ring3d(c, ox, oy, rr, rr * 0.6, rr * 0.55, lerp(0, 1.2, e) + (lt - 0.8) * 3, { face: B.yellow, side: B.gold });
      }
    } },

    { start: 5.6, end: 6.4, draw(c, p, t) { // the ring, spinning, then shrinking into a white "O"
      const lt = t - 5.6; bg(c, B.dark);
      const shrink = ease.inOut(prog(lt, 0.6, 0.8)), R = lerp(230 * S, 58 * S, shrink);
      if (shrink < 1) ring3d(c, W / 2, H / 2, R, R * 0.6, R * 0.5 * (1 - shrink), ringTheta(lt), { face: shrink > 0.5 ? B.white : B.yellow, side: B.gold });
      else word(c, 'O', W / 2, H / 2 + 54 * S, { size: 150 * S, color: B.white, align: 'center' });
    } },

    { start: 6.4, end: 7.6, draw(c, p, t) { // orbit: Keychain OS and everything it runs
      const lt = t - 6.4; bg(c, B.dark);
      const push = ease.in(prog(lt, 0.8, 1.05)), z = lerp(1, 4.2, push);
      c.save(); cam(c, z);
      const grow = spr(lt, 120, 18); c.globalAlpha = 1 - push * 0.75;
      const pts = orbit(c, W / 2, H / 2, [
        { r: 190 * S, n: 16, dot: 5 * S, speed: 0.6, lw: 2 * S, alpha: 0.5 },
        { r: 335 * S, n: 20, dot: 7.5 * S, speed: -0.35, lw: 7 * S, alpha: 0.22 },
        { r: 640 * S, n: 12, dot: 14 * S, speed: 0.18, lw: 20 * S, alpha: 0.14, blur: 5 * S },
      ], lt, grow);
      OPS.forEach((s, i) => { const [px, py, a] = pts[1][i * 4]; scramble(c, s, px + Math.cos(a) * 30 * S, py + Math.sin(a) * 30 * S + 9 * S, prog(lt, 0.22 + i * 0.06, 0.42 + i * 0.06), { size: 26 * S, weight: 500, color: B.white, align: Math.cos(a) < 0 ? 'right' : 'left', seed: i }); });
      const osp = prog(lt, 0.35, 0.55);
      word(c, osp > 0 ? 'OS' : 'O', W / 2 + (tw(c, 'OS', 150 * S) - tw(c, 'O', 150 * S)) / 2 * (1 - ease.out(osp)) * 0, H / 2 + 54 * S, { size: 150 * S, color: B.white, align: 'center', alpha: 1 - clamp(push * 3) });
      c.restore();
      if (lt > 0.9) { // title card through the push
        const q = lt - 0.9, ch = spr(q, 200, 26);
        c.save(); c.globalAlpha = clamp(q * 6);
        [-1, 1].forEach(dir => { c.save(); c.translate(W / 2 + dir * lerp(420, 720, ch) * S, H / 2); c.scale(dir, 1); c.strokeStyle = B.chev; c.lineWidth = 80 * S; c.beginPath(); c.moveTo(-160 * S, -320 * S); c.lineTo(160 * S, 0); c.lineTo(-160 * S, 320 * S); c.stroke(); c.restore(); });
        c.restore();
        ui(c, 'Keychain OS', W / 2, H / 2 - 110 * S, { size: 26 * S, color: B.mute, align: 'center', alpha: clamp(q * 6) });
        rise(c, 'Run your operations.', W / 2, H / 2 + 40 * S, spr(q), { size: 128 * S, color: B.white, align: 'center' });
        ui(c, 'Chapter 3', W / 2, H / 2 + 130 * S, { size: 26 * S, color: B.mute, align: 'center', alpha: clamp(q * 6) });
      }
    } },

    { start: 7.6, end: 8.8, draw(c, p, t) { // marquee of everything OS runs
      const lt = t - 7.6, y2 = lt >= 0.4, fg = y2 ? B.ink : B.yellow; bg(c, y2 ? B.yellow : B.dark);
      for (let r = 0; r < 8; r++) {
        const items = [...OPS.slice(r % 5), ...OPS.slice(0, r % 5)].flatMap(s => [s, '✓', { s: 'keychain', size: 22 * S, dy: -44 * S, weight: 600, font: TYPE.ui, track: 0 }]);
        const dir = r % 2 ? -1 : 1, off = dir * (lt * 520 * S + (1 - spr(lt, 170, 24)) * 900 * S) + r * 380 * S;
        marquee(c, items, (r * 150 + 118) * S, off, { size: 124 * S, color: fg });
      }
    } },

    { start: 8.8, end: 10.0, draw(c, p, t) { // one punchy line, framed by a tunnel, then down to a single pill
      const lt = t - 8.8, flip = lt >= 0.8;
      if (!flip) {
        bg(c, B.dark);
        const tin = spr(lt - 0.4, 170, 24);
        if (lt > 0.38) { c.save(); cam(c, lerp(1.6, 1, tin)); c.globalAlpha = clamp(tin * 2); tunnel(c, W / 2, H / 2, W - 160 * S, H - 160 * S, TN, { k: TK, r: 0.17, shades: ['#0c0c0c', '#1f1f1f', '#121212', '#0a0a0a'] }); c.restore(); }
        const big = 1 - ease.inOut(prog(lt, 0.4, 0.55));
        if (big > 0) { c.save(); cam(c, lerp(0.2, 1, big)); c.globalAlpha = big; riseChars(c, 'One system.', W / 2, H / 2 + 100 * S, lt, { size: 300 * S, color: B.white, align: 'center', gap: 0.03 }); c.restore(); }
        const s = 'One connected system of record.', q = prog(lt, 0.5, 0.78);
        if (q > 0) { const w = tw(c, s, 54 * S, 500, TYPE.ui, -0.02); typed(c, s, W / 2 - w / 2, H / 2 + 19 * S, q, { size: 54 * S, weight: 500, track: -0.02, color: B.white }); }
      } else {
        bg(c, B.paper); const q = lt - 0.8, e = spr(q, 220, 24);
        const pw = lerp((W - 160 * S) * TK ** (TN - 1), CW, e), ph = lerp((H - 160 * S) * TK ** (TN - 1), CH, e); // starts as the tunnel's innermost box
        c.save(); rrect(c, W / 2 - pw / 2, H / 2 - ph / 2, pw, ph, lerp(ph * 0.5, 24 * S, prog(q, 0.15, 0.4))); c.fillStyle = B.ink; c.fill(); c.restore();
        check(c, W / 2 - pw / 2 + 38 * S, H / 2 - ph / 2 + 38 * S, 15 * S, { color: B.white, lw: 2.6 * S, p: prog(q, 0.1, 0.35) });
        FACTS[9].forEach((l, i) => ui(c, l, W / 2 - pw / 2 + 26 * S, H / 2 + ph / 2 - (50 - i * 28) * S, { size: 23 * S, weight: 500, color: B.white, alpha: prog(q, 0.2, 0.3) }));
      }
    } },

    { start: 10.0, end: 11.2, draw(c, p, t) { // wall of feature cards
      const lt = t - 10.0; bg(c, B.paper); c.save(); cam(c, lerp(1.0, 0.92, ease.inOut(prog(lt, 0, 1.2))));
      for (let j = -3; j <= 3; j++) for (let i = -4; i <= 4; i++) {
        const drift = (((j % 2) + 2) % 2 ? 1 : -1) * lt * 70 * S, x = W / 2 - CW / 2 + i * (CW + CG) + drift * (i || j ? 1 : 0), y = H / 2 - CH / 2 + j * (CH + CG);
        const center = i === 0 && j === 0, d = Math.hypot(i, j * 1.4), p2 = center ? 1 : spr(lt - 0.04 - d * 0.045, 260, 22);
        const kind = center ? 0 : (i * 7 + j * 3 + 20) % 5 === 0 ? 2 : (i + j + 10) % 2;
        card2(c, x, y, center ? FACTS[9] : FACTS[(((i + 4) + (j + 3) * 3) % 9)], kind, p2);
      }
      c.restore();
    } },

    { start: 11.2, end: 12.8, draw(c, p, t) { // the number
      const lt = t - 11.2;
      if (lt < 0.6) { bg(c, B.paper); const s = lerp(0.35, 1, spr(lt, 170, 22)); c.save(); cam(c, s);
        counter(c, lerp(0, 28000, ease.out(prog(lt, 0, 0.5))), W / 2, H / 2, { size: 300 * S, font: TYPE.display, weight: 500, color: B.ink, suffix: '+' }); c.restore();
        rise(c, 'CPG brands and manufacturers on Keychain', W / 2, H / 2 + 230 * S, spr(lt - 0.15), { size: 34 * S, weight: 400, font: TYPE.ui, track: -0.01, color: B.ink, align: 'center' }); return; }
      if (lt < 0.8) { bg(c, B.paper); marquee(c, ['28,000+', { s: '· · · · ·', size: 60 * S, dy: -40 * S }], H / 2 + 105 * S, (lt - 0.6) * 4200 * S, { size: 300 * S, color: B.ink }); return; }
      const q = lt - 0.8, light = q >= 0.4, th = light ? TH.light : TH.dark, fg = light ? B.ink : B.yellow, sub = light ? B.ink : B.white;
      grid(c, th.g, th.l);
      const s = 176 * S;
      if (light) { const wN = tw(c, '28,000+', s); hl(c, 0.33 * W - 14 * S, 0.8 * H - s * 0.78, wN + 28 * S, s * 0.98, 1, B.yellow); }
      rise(c, 'Brands &', 0.2 * W, 0.44 * H, spr(q), { size: s, color: fg });
      arrow(c, 0.2 * W - 30 * S, 0.62 * H - s * 0.3, 190 * S, prog(q, 0.1, 0.4), { color: fg, lw: 20 * S, rot: Math.PI });
      ui(c, '2026', 0.225 * W, 0.62 * H - s * 0.26, { size: 34 * S, weight: 700, color: sub, alpha: prog(q, 0.1, 0.2) });
      rise(c, 'manufacturers', 0.31 * W, 0.62 * H, spr(q - 0.06), { size: s, color: fg });
      rise(c, '28,000+', 0.33 * W, 0.8 * H, spr(q - 0.12), { size: s, color: fg });
      arrow(c, 0.33 * W + tw(c, '28,000+', s) + 40 * S, 0.8 * H - s * 0.3, 190 * S, prog(q, 0.2, 0.5), { color: fg, lw: 20 * S });
      [['Connect', 'Network', 'Brands', 'Suppliers', 'Projects'], ['Edge', 'CRM', 'Pipeline', 'Deals', 'Reorders'], ['OS', 'Food safety', 'Inventory', 'Purchasing', 'Production']]
        .forEach((col, ci) => col.forEach((s2, k) => scramble(c, s2, (0.64 + ci * 0.11) * W, (230 + k * 26) * S, prog(q, 0.1 + ci * 0.05, 0.35 + ci * 0.05), { size: 21 * S, weight: k ? 400 : 600, color: sub, seed: ci * 9 + k })));
      [['Chapter 4', M, 56], ['Keychain Connect', 0.2 * W, 56], ['Trusted by', 0.32 * W, 56], ['keychain', W - M, 56, 'right'], ['From single-facility co-packers to national brands.', M, H / S - 36], ['2026', W - M, H / S - 36, 'right']]
        .forEach(([s2, x, y, al], i) => ui(c, s2, x, y * S, { size: 24 * S, color: sub, align: al || 'left' }));
    } },

    { start: 12.8, end: 13.6, draw(c, p, t) { // CPG categories scattered at depth, rising past
      const lt = t - 12.8; grid(c, B.yellow, B.yline, 60 * S, 0, -lt * 120 * S); const r = rng(5), sizes = [210, 84, 150, 64, 190, 104];
      let y = 0.2 * H, i = 0, row = 0;
      while (y < 2.4 * H) { // rows of category names, big/small alternating, the whole field rising past the camera
        const sz = sizes[row % sizes.length] * S, yy = y - lt * 640 * S, dx = (row % 2 ? 1 : -1) * lt * 90 * S, pop = spr(lt - row * 0.025, 300, 20);
        for (let x = -r() * 180 * S; x < W + 200 * S; i++) {
          const s = CATS[i % CATS.length], w = tw(c, s, sz), outline = (row * 3 + i) % 5 === 0;
          if (yy > -sz * 0.3 && yy < H + sz && pop > 0) { c.save(); c.translate(x + dx, yy); c.scale(lerp(0.6, 1, pop), lerp(0.6, 1, pop)); word(c, s, 0, 0, { size: sz, color: B.ink, stroke: outline ? 3 * S : 0, alpha: clamp(pop * 3) }); c.restore();
            if (sz > 180 * S) ui(c, 'keychain', x + dx + 6 * S, yy + 34 * S, { size: 18 * S, weight: 600, color: B.ink, alpha: 0.55 * clamp(pop) }); }
          x += w + lerp(70, 170, r()) * S;
        }
        y += sz * 0.26 + sizes[(row + 1) % sizes.length] * S * 0.8 + 40 * S; row++; // descender of this row + cap of the next
      }
    } },

    { start: 13.6, end: 16.0, draw(c, p, t) { // lockup with construction guides, then the logo
      const lt = t - 13.6; bg(c, B.dark);
      const ms = 170 * S, sL = 54 * S, gapT = 70 * S;
      const out = ease.inOut(prog(lt, 1.0, 1.3)), slide = spr(lt - 1.3, 170, 26);
      const wmH = 120 * S, wmW = wmH * (257 / 64), total = ms + 44 * S + wmW, mx = lerp(W / 2, W / 2 - total / 2 + ms / 2, slide), my = H / 2;
      const wL = tw(c, 'The AI Platform', sL, 500), wR = tw(c, 'for CPG', sL, 500);
      const boxes = [{ x: W / 2 - ms / 2 - gapT - wL - 10 * S, y: my - 40 * S, w: wL + 20 * S, h: 80 * S }, { x: W / 2 - ms / 2 - 6 * S, y: my - ms / 2 - 6 * S, w: ms + 12 * S, h: ms + 12 * S }, { x: W / 2 + ms / 2 + gapT - 10 * S, y: my - 40 * S, w: wR + 20 * S, h: 80 * S }];
      guides(c, boxes, prog(lt, 0, 0.35) - out);
      const tp = clamp(prog(lt, 0.25, 0.5) - out);
      scramble(c, 'The AI Platform', boxes[0].x + 10 * S, my + 19 * S, tp, { big: true, size: sL, color: B.white, seed: 3 });
      if (tp >= 1) { hl(c, boxes[0].x + 10 * S + tw(c, 'The ', sL) - 6 * S, my - 36 * S, tw(c, 'AI', sL) + 12 * S, 70 * S, 1, B.yellow); word(c, 'AI', boxes[0].x + 10 * S + tw(c, 'The ', sL), my + 19 * S, { size: sL, color: B.ink }); }
      scramble(c, 'for CPG', boxes[2].x + 10 * S, my + 19 * S, tp, { big: true, size: sL, color: B.white, seed: 4 });
      const k = lt - 0.1;
      kmark(c, mx, my, ms, { cs: spr(k, 220, 18), stem: ease.out(prog(k, 0.1, 0.35)), bowl: ease.out(prog(k, 0.2, 0.45)), leg: spr(k - 0.25, 260, 22) });
      const rev = ease.out(prog(lt, 1.35, 1.75));
      if (rev > 0) { const wx = mx + ms / 2 + 44 * S; c.save(); c.beginPath(); c.rect(wx, my - wmH, wmW * rev, wmH * 2); c.clip(); c.drawImage(img('wordmark-white.svg'), wx - (1 - rev) * 60 * S, my - wmH * 0.58, wmW, wmH); c.restore(); }
      rise(c, 'The AI Platform for CPG', W / 2, my + 190 * S, spr(lt - 1.6), { size: 44 * S, weight: 400, font: TYPE.ui, track: -0.01, color: B.mute, align: 'center' });
      const cta = spr(lt - 2.0, 300, 22);
      if (cta > 0) { c.save(); cam(c, cta, W / 2, my + 290 * S); pill(c, 'Request access at keychain.com', W / 2, my + 290 * S, { size: 28 * S, font: TYPE.ui, weight: 600, fill: B.yellow, color: B.ink }); c.restore(); }
    } },
  ],
};
