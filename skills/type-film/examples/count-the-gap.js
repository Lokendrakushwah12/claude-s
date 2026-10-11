// Count the gap: a kinetic-type film about thunder's delay. Light is silent and sound is late, so the gap is the distance.
// Concept and kills: docs/concepts.md. Techniques TAKEN (never shots): slam-and-dim beat words, a small italic serif over a
// giant grotesk, a prop that becomes the cut, a true silence before the last section, particles driven by one depth.
// Devices invented here: the edit's clock is the speed of sound (thunder lands distance / 343 s after its flash); the count's
// type size is the storm's distance; the flash inverts the frame; the last afterimage falls into the rule the instruction stands on.
Object.assign(TYPE, { display: 'Archivo', ui: 'Instrument Serif', weight: '900 condensed', track: -0.01 });
const C = { night: '#0A0C16', ink: '#0B0D18', rain: '#B4C3E6', violet: '#D4FF3A', glow: '#9FB4FF', lead: '#F0F0F5', white: '#F2F2F7', land: '#05060B' };
const V = 343;                                          // speed of sound, m/s (dry air, 20 °C)
const PK = 0.033;                                       // a flash = the leader's start; the return stroke peaks PK later
const FA = 0.07, TA = FA + PK + 1000 / V;               // 1 km: thunder 2.92 s after the stroke
const CUT3 = TA + 0.45, FB = CUT3 + 1.2, TB = FB + PK + 343 / V;   // 343 m: one second
const CUT5 = TB + 0.32, FC = CUT5 + 1.05, TC = FC + PK;           // overhead: no gap
const DEAF = TC + 0.27, BACK = DEAF + 0.7, TD = BACK + 0.85, END = TD + 1.35;   // TD: distant thunder, the storm moving on
const DISP = { font: 'Archivo', weight: '900 condensed', track: -0.01 }, LEAD = { font: 'Instrument Serif', weight: 'italic 400', track: 0 };
const capOf = (s, o = DISP) => inkBox(ctx, s, 100, o).a / 100;   // cap height per px of font size, measured
const sizeFor = (s, capFrac) => (capFrac * H) / capOf(s);

// ---- the storm ----
// Flash level 0..1: a dim leader, the return stroke, a re-strike 0.13 s later, a short tail. k = how white it gets (distance).
const STEPS = [0.1, 1, 1, 0.12, 1, 0.3, 0.08];        // per 30 fps frame from the leader: a hard flash, a re-stroke, gone
function flashL(t, tf, k = 1) { const f = Math.floor((t - tf) * 30 + 1e-6); return f < 0 || f >= STEPS.length ? 0 : k * STEPS[f]; }
const LIGHT = t => (t >= TC && t < DEAF ? 1 - 0.25 * (Math.floor((t - TC) * 30) % 3 === 1) : Math.max(flashL(t, FA), flashL(t, FB), flashL(t, FC)));
// A seeded stepped leader from (x0, y0) down to y1: a random walk with drift toward x1, plus branches. Returns polylines.
function bolt(seed, x0, y0, x1, y1, steps = 18, wig = 0.045) {
  const r = rng(seed), main = [[x0, y0]];
  for (let i = 1; i <= steps; i++) { const f = i / steps, p = main[i - 1]; main.push([lerp(x0, x1, f) + (r() - 0.5) * wig * H * 2 + (p[0] - lerp(x0, x1, (i - 1) / steps)) * 0.45, lerp(y0, y1, f) + (r() - 0.5) * 0.02 * H]); }
  const lines = [main];
  for (let b = 0; b < 3; b++) { const k = 2 + Math.floor(r() * (steps - 8)), dir = r() < 0.5 ? -1 : 1, br = [main[k]]; for (let j = 1; j < 3 + r() * 5; j++) { const q = br[j - 1]; br.push([q[0] + dir * (0.01 + r() * 0.045) * H, q[1] + (0.02 + r() * 0.045) * H]); } lines.push(br); }
  return lines;
}
const BOLTS = {
  A: { t: FA, k: 1, lines: bolt(11, 0.84 * W, -0.03 * H, 0.8 * W, 0.62 * H, 12, 0.025), lw: 7 },
  B: { t: FB, k: 1, lines: bolt(23, 0.27 * W, -0.04 * H, 0.36 * W, 0.86 * H, 20, 0.05), lw: 16 },
  C: { t: FC, k: 1, lines: bolt(7, 0.56 * W, -0.06 * H, 0.47 * W, 1.06 * H, 22, 0.07), lw: 34 },
};
// Tapered strokes: the main channel thins from lw to 15 % along its length, branches start at half and thin out.
const taper = (c, lines, lw, color) => lines.forEach((l, j) => taperLine(c, l, j ? lw * 0.45 : lw, (j ? lw * 0.45 : lw) * 0.2, color));
const RAIN = pointCloud('field', 760, 4), DROPS = pointCloud('field', 16, 9);
// Rain in a 6.8 × 3.8 × 2 box at one wind angle; the wrap is anchored to the frame time T so a streak never spans the frame.
const rainAt = (i, tt, T) => { const q = RAIN[i], v = 2.4 + 0.5 * (i % 5) / 4, k = Math.floor((q[1] * 1.9 + 1.9 + v * T) / 3.8), y = q[1] * 1.9 + 1.9 + v * tt - k * 3.8 - 1.9;
  return [q[0] * 3.4 - (0.36 + 0.12 * Math.sin(T * 0.9 + q[2])) * (y + 1.9), y, q[2]]; };
const CLOUDS = () => cached('clouds', x => { const r = rng(31); x.filter = `blur(${70 * S}px)`; x.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) { const cy = (r() ** 1.3) * 0.62 * H, cx = r() * W * 1.2 - 0.1 * W, rr = (0.03 + r() * 0.1) * H; x.globalAlpha = (0.15 + r() * 0.45) * (1 - cy / (0.7 * H)); x.beginPath(); x.ellipse(cx, cy, rr * (1.5 + r() * 2), rr, (r() - 0.5) * 0.3, 0, 7); x.fill(); } });

function sky(c, t, L, x) { // the sky goes to pure white at a near stroke; a far one only lights the cloud around its bolt
  litGround(c, mixHex(C.night, '#FFFFFF', L), 0.3 * (1 - L) + 0.02, { x, y: 0.12 * H });
  const glow = 0;
  if (glow > 0.01) { const g = c.createRadialGradient(x, 0.12 * H, 0, x, 0.12 * H, 0.7 * H); g.addColorStop(0, `rgba(205,200,255,${0.55 * glow})`); g.addColorStop(0.5, `rgba(160,150,230,${0.18 * glow})`); g.addColorStop(1, 'rgba(160,150,230,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  c.save(); c.globalAlpha = 0.08 + 0.5 * L * (1 - L) + 0.25 * glow; c.drawImage(CLOUDS(), -t * 6 * S, 0); c.drawImage(CLOUDS(), W - t * 6 * S, 0); c.restore();
  const gy = 0.86 * H, g = c.createLinearGradient(0, gy, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.35 * (1 - L)})`); c.fillStyle = g; c.fillRect(0, gy, W, H - gy);
  c.fillStyle = `rgba(255,255,255,${0.05 * (1 - L)})`; c.fillRect(0, gy, W, 2 * S); // the horizon, only in the dark
}
function rain(c, t, L) { // denser after each thunder, as the storm closes in
  const n = 440 + (t > TA ? 160 : 0) + (t > TB ? 160 : 0);
  drawCloud(c, (i, tt) => rainAt(i, tt, t), t, { n, dist: 1.6, scale: 0.3 * H, size: 0.75 * S, sizeVar: 0.7, trail: 0.05, fog: 0.6,
    color: mixHex(C.rain, '#1E2438', clamp(L * 1.3)), alpha: 0.45 + 0.4 * L });
}
function lens(c, L) { // drops on the lens: invisible in the dark, glinting when the flash lights them
  if (L < 0.05) return;
  drawCloud(c, i => [DROPS[i][0] * 2.6, DROPS[i][1] * 1.5, -0.8], 0, { n: 16, dist: 2.2, size: 26 * S, sizeVar: 0.8, soft: true, color: '#DDE4FF', alpha: 0.22 * L * (1 - L * 0.6), fog: 0 });
}
function drawBolt(c, b, t, L) { // on only while its own flash pulses (stroke, re-strike): dark on the white sky, white-hot on dark
  const e = flashL(t, b.t), on = b === BOLTS.C && t >= TC && t < DEAF ? 1 : clamp(e * 1.6); if (t < b.t || on < 0.04) return;
  const lines = t < b.t + PK ? b.lines.map(l => l.slice(0, Math.max(2, Math.ceil(l.length * (t - b.t) / PK)))) : b.lines; // the leader feels its way down
  c.save(); c.globalAlpha *= on;
  if (L > 0.6) taper(c, lines, b.lw * S, C.ink);
  else { c.filter = `blur(${b.lw * 1.2 * S}px)`; taper(c, lines, b.lw * 3 * S, C.glow); c.filter = 'none'; taper(c, lines, b.lw * S, '#FFFFFF'); }
  c.restore();
}
function afterimage(c, b, t, dur = 0.6, a0 = 0.25) { // the bolt burned on the eye: violet, soft, gone fast
  const u = t - b.t - 0.25; if (u < 0 || u > dur) return;
  c.save(); c.globalAlpha *= a0 * (1 - u / dur) ** 2; c.filter = `blur(${8 * S}px)`; taper(c, b.lines, b.lw * 2.5 * S, C.violet); c.restore();
}

// ---- type ----
const lead = (c, s, x, y, t, o = {}) => rise(c, s, x, y, spr(t, 300, 26), { size: 0.14 * H, ...LEAD, color: C.lead, align: 'left', ...o });
function countNum(c, s, x, capFrac, t, tl, o = {}) { // a counted second: lands on its real time, dims as the next lands
  hitWord(c, s, x, 0.74 * H, t - tl, { ...DISP, size: sizeFor(s, capFrac), align: 'center', color: o.color || C.white, from: 1.3, tau: 0.06, dim: o.dim ?? 0.32, fade: 1.2, blur: 10 * S });
}
const push = (c, t, t0, rate = 0.035) => cam(c, 1 + rate * Math.max(0, t - t0)); // a slow push during a hold

window.VIDEO = {
  duration: END,
  audio: 'audio.wav',
  lufs: -16,
  // storm.py reads these (the same constants the picture draws from): thunder at distance / 343 s, the count's toks, the deafened gap
  sfx: [[FA + PK + 1, 'tok'], [FA + PK + 2, 'tok'], [TA, 'thunder', 1, { dist: 1000, roll: CUT3 - TA }], [TB, 'thunder', 1, { dist: 343, roll: CUT5 - TB }], [TC, 'thunder', 1, { dist: 120, cut: DEAF }],
    [TD, 'thunder', 0.5, { dist: 4000 }], [DEAF, 'deaf'], [BACK, 'back']],
  fonts: ['Archivo:wdth,wght@62..125,100..900', 'Instrument Serif:ital@0;1'],
  overlay(c, t) { applyLook(c, t, null, { vignette: 0.22 * (1 - LIGHT(t)), grain: 0.1 }); },
  scenes: [{ start: 0, end: END, draw(c, p, t) {
    const L = LIGHT(t);
    if (t >= DEAF && t < BACK) { // deafened: black, nothing but the strike burned on the eye
      bg(c, '#030307'); const a = 1, s = sizeFor('0', 0.95);
      c.save(); c.filter = `blur(${3 * S}px)`; word(c, '0', W / 2, 0.5 * H + s * capOf('0') / 2, { ...DISP, size: s, align: 'center', color: C.violet, alpha: 0.55, stroke: 5 * S }); c.restore(); // the 0's edge burned on the eye
      c.save(); c.globalAlpha = 0.45; c.filter = `blur(${6 * S}px)`; taper(c, BOLTS.C.lines, BOLTS.C.lw * 2 * S, C.violet); c.restore();
      return;
    }
    c.save(); shake(c, t, [TA], { amp: 5 * S, tau: 0.4, hz: 8, seed: 1 }); shake(c, t, [TB], { amp: 12 * S, tau: 0.4, hz: 11, seed: 2 }); shake(c, t, [TC], { amp: 26 * S, tau: 0.3, hz: 13, seed: 3 });
    const bx = t < FB ? BOLTS.A.lines[0][0][0] : t < FC ? BOLTS.B.lines[0][0][0] : BOLTS.C.lines[0][0][0];
    c.save(); cam(c, 1.05); sky(c, t, L, bx); rain(c, t, L); c.restore(); // overscan the world so the shake never shows an edge
    for (const b of [BOLTS.A, BOLTS.B]) { afterimage(c, b, t); drawBolt(c, b, t, L); }
    const ink = L > 0.6 ? C.ink : C.white;
    if (t < CUT3) { // the count from 1 km: numerals where the sound front is, growing toward us
      lead(c, 'See the flash. Count.', 0.078 * W, 0.24 * H, t - FA - 0.1, { color: L > 0.6 ? C.ink : C.lead });
      countNum(c, '1', 0.2 * W, 0.2, t, FA + PK + 1, { color: ink });
      countNum(c, '2', 0.45 * W, 0.28, t, FA + PK + 2, { color: ink });
      countNum(c, '3', 0.75 * W, 0.44, t, TA, { dim: 1, color: ink });
    } else if (t < TB) { // the answer lands on the thunder's second roll; it stays as a ghost through the next count
      const ghost = t > FB ? 0.16 : 1, s = sizeFor('1 KM', 0.38), b = inkBox(c, '1 KM', s, DISP);
      c.save(); push(c, t, CUT3); shake(c, t, [CUT3], { amp: 3 * S, tau: 0.9, hz: 7, seed: 4 }); c.globalAlpha = ghost;
      lead(c, 'three seconds of quiet:', 0.078 * W, 0.26 * H, t - CUT3 + 0.1, { color: L > 0.6 ? C.ink : C.lead });
      hitWord(c, '1 KM', 0.075 * W - b.l, 0.34 * H + b.a, t - CUT3, { ...DISP, size: s, color: ink, from: 1.12, tau: 0.06 });
      c.restore();
    } else if (t < CUT5) countNum(c, '1', 0.8 * W, 0.6, t, TB, { dim: 1, color: ink });
    else if (t < FC + PK) { // the answer, closer: bigger, full width, lead under it on the right
      c.save(); push(c, t, CUT5); shake(c, t, [CUT5], { amp: 4 * S, tau: 0.9, hz: 8, seed: 5 });
      const r = fitStack(c, ['343 M'], 0.075 * W, 0.12 * H, 0.85 * W, DISP)[0];
      hitWord(c, r.s, r.x, r.y, t - CUT5, { ...DISP, size: r.size, color: C.white, from: 1.12, tau: 0.06 });
      lead(c, 'in one second of quiet.', 0.925 * W, r.y + 0.2 * H, t - CUT5 + 0.1, { align: 'right' });
      c.restore();
    } else if (t < DEAF) { const s = sizeFor('0', 0.95); word(c, '0', W / 2, 0.5 * H + s * capOf('0') / 2, { ...DISP, size: s, align: 'center', color: C.ink }); drawBolt(c, BOLTS.C, t, 1); }
    else { // back: the strike's afterimage straightens into a rule, and the instruction stands on it
      c.save(); push(c, t, BACK, 0.02);
      const b = inkBox(c, 'INSIDE', 100, DISP), sz = (100 * 0.6 * W) / (b.r - b.l), x0 = 0.2 * W;
      const [g, ins] = fitStack(c, [{ s: 'GO', size: sz }, { s: 'INSIDE', size: sz }], x0, 0.3 * H, 0.6 * W, DISP), y = ins.y + 0.035 * H;
      const src = BOLTS.C.lines[0], n = src.length, m = ease.inOut(prog(t, BACK, BACK + 0.27));
      const pts = src.map(([x, y0], i) => [lerp(x, lerp(x0, x0 + 0.6 * W, i / (n - 1)), m), lerp(y0, y, m)]);
      taperLine(c, pts, lerp(BOLTS.C.lw * 0.9, 7, m) * S, lerp(BOLTS.C.lw * 0.2, 7, m) * S, C.violet);
      lead(c, 'If you can hear it,', x0, 0.22 * H, t - BACK - 0.3);
      hitWord(c, g.s, g.x, g.y, t - BACK - 0.52, { ...DISP, size: g.size, color: C.white, from: 1.15, tau: 0.07 });
      hitWord(c, ins.s, ins.x, ins.y, t - TD, { ...DISP, size: ins.size, color: C.white, from: 1.15, tau: 0.07 });
      c.restore();
    }
    lens(c, L);
    c.restore();
  } }],
};
