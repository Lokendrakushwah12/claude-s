// Midnight: a 2 s stippled collage loop. An ace-of-moons card tumbles over a speed-line burst, the ground smash-cuts to a
// collage, and the card zooms back up to its frame-0 state so the loop closes on a match cut.
// Reference and what was TAKEN (techniques only, never shots): references.md 2026-11-19, @shirotatakajo. Two beats joined by hard
// cuts, one ticket-stub frame through both, shade as dot coverage under grain, poster type cropped by the frame.
// Devices invented here (in no reference): the card is ONE object for the whole loop (x, y, scale, roll and turn continuous
// through both cuts); texture re-steps at 12 fps while motion stays continuous.
// No beat grid: the loop's own clock (L = 2 s, the cut at CUT). Laid out on a 1200 x 675 board scaled to the frame.
const B = { ink: '#07121C', navy: '#10263D', deep: '#1A3A5A', sky: '#86B6D6', coral: '#FF5A3C', cream: '#F6E7CF', teal: '#3FC1B0', gold: '#FFC93C' };
// Navy sits at hue ~210 on purpose: the first palette (#1B1740, #8F86E8) made filmgate read 75 % of frames as blue-purple.
const L = 2, CUT = 0.8, LOOPS = 3, BW = 1200, BH = 675, K = W / BW, PI = Math.PI;
const FLIP = [0.25 * CUT, 0.9 * CUT];            // the card turns over between these times
const POPS = [0.02, 0.1, 0.16, 0.2];             // collage solids pop in this long after the cut
const PUSH = 1.7;                                // the push-in that feeds the loop cut starts here
const TWOS = 12.5;                               // drawings a second: the reference holds every drawing 2 frames at 25 fps (measured). 0 = continuous
const DISPLAY = '"Archivo Black"';

const star4 = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * PI) / 4, d = i % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.fill(); };
// A crescent with its stipple baked in: a disc, shaded, with a second disc cut out of it.
const moon = () => cached('moon', g => { g.fillStyle = B.gold; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill(); g.globalCompositeOperation = 'source-atop';
  stipple(g, 'moon', STIP.ball, { w: 256, h: 256, dot: 2, color: B.ink, alpha: 0.5 }); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(184, 92, 108, 0, 7); g.fill(); });
const drawMoon = (c, x, y, d) => c.drawImage(moon(), 0, 0, 256, 256, x, y, d, d);
function ball(c, r, col) { c.save(); c.beginPath(); c.arc(0, 0, r, 0, 7); c.fillStyle = col; c.fill(); c.clip(); stipple(c, 'ball' + r, STIP.ball, { x: -r, y: -r, w: 2 * r, h: 2 * r, dot: 2, color: B.ink, alpha: 0.55 }); c.restore(); }
function ticket(c) { // rounded rect with a notch bitten out of each side
  const m = 18, r = 26, n = 30;
  c.beginPath(); c.moveTo(m + r, m); c.lineTo(BW - m - r, m); c.arcTo(BW - m, m, BW - m, m + r, r);
  c.lineTo(BW - m, BH / 2 - n); c.arc(BW - m, BH / 2, n, -PI / 2, PI / 2, true); c.lineTo(BW - m, BH - m - r); c.arcTo(BW - m, BH - m, BW - m - r, BH - m, r);
  c.lineTo(m + r, BH - m); c.arcTo(m, BH - m, m, BH - m - r, r); c.lineTo(m, BH / 2 + n); c.arc(m, BH / 2, n, PI / 2, -PI / 2, true); c.lineTo(m, m + r); c.arcTo(m, m, m + r, m, r); c.closePath();
}

// ---- the card ----
const CW = 340, CH = 480;
const panel = (c, w, h) => { c.beginPath(); c.roundRect(-w / 2 + 24, -h / 2 + 24, w - 48, h - 48, 44); c.clip(); };
function cardFront(c, w, h) {
  panel(c, w, h); c.fillStyle = B.navy; c.fillRect(-w, -h, 2 * w, 2 * h);
  c.fillStyle = B.deep; c.beginPath(); c.moveTo(-w, 80); c.lineTo(w, -80); c.lineTo(w, h); c.lineTo(-w, h); c.fill();
  c.strokeStyle = B.cream; c.lineWidth = 4; c.beginPath(); c.moveTo(-w, 80); c.lineTo(w, -80); c.stroke();
  for (const s of [0, 1]) { c.save(); c.rotate(s * PI); drawMoon(c, -62, -178, 150);
    c.fillStyle = B.cream; c.font = `400 36px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText('A', -w / 2 + 62, -h / 2 + 82);
    star4(c, -w / 2 + 62, -h / 2 + 106, 13, B.coral); star4(c, 96, -150, 9, B.cream); c.restore(); }
  stipple(c, 'cardfall', STIP.fall, { x: -w / 2, y: -h / 2, w, h, dot: 2, color: B.ink, alpha: 0.3 });
}
function cardBack(c, w, h) {
  panel(c, w, h); c.fillStyle = B.coral; c.fillRect(-w, -h, 2 * w, 2 * h); c.strokeStyle = B.navy; c.lineWidth = 3;
  for (let i = 0; i < 12; i++) { const a = (i * PI) / 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 400, Math.sin(a) * 400); c.stroke(); }
  for (const r of [150, 118]) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); }
  c.fillStyle = B.navy; c.beginPath(); c.arc(0, 0, 86, 0, 7); c.fill(); star4(c, 0, 0, 70, B.gold); star4(c, 0, 0, 26, B.navy);
  stipple(c, 'cardfall', STIP.fall, { x: -w / 2, y: -h / 2, w, h, dot: 2, color: B.ink, alpha: 0.3 });
}
// [x, y, scale, roll, turn]: continuous at CUT, at PUSH and across the loop point (turn 2*PI = 0).
function cardState(t) {
  if (t < CUT) { const p = t / CUT; return [BW / 2, BH / 2, lerp(1.5, 0.95, ease.expoOut(p)), lerp(-0.2, 0.35, p), PI * ease.inOut(prog(t, FLIP[0], FLIP[1]))]; }
  const rest = d => [790 + d * 14, 390 - d * 10, 0.42, -0.35 + d * 0.12];
  if (t < PUSH) { const p = ease.expoOut(prog(t, CUT, 1.2)), r = rest(t - CUT); return [lerp(BW / 2, r[0], p), lerp(BH / 2, r[1], p), lerp(0.95, r[2], p), lerp(0.35, r[3], p), PI * (1 + p)]; }
  const p = ease.in(prog(t, PUSH, L)), r = rest(PUSH - CUT); return [lerp(r[0], BW / 2, p), lerp(r[1], BH / 2, p), lerp(r[2], 1.5, p), lerp(r[3], -0.2, p), 0];
}

// ---- beat one: the burst ----
function burst(c, f) {
  c.fillStyle = B.coral; c.fillRect(0, 0, BW, BH);
  const r = rng(7), cols = [B.gold, B.cream, B.navy, B.sky, B.gold, B.navy];
  c.save(); c.translate(BW / 2, BH / 2); c.rotate(f * 0.11);
  for (let i = 0; i < 46; i++) { const a = r() * 2 * PI, w = 0.01 + r() * 0.07, inner = 40 + r() * 220 * (1 - ((f + i) % 3) / 4);
    c.fillStyle = cols[i % cols.length]; c.beginPath(); c.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); c.lineTo(Math.cos(a - w) * 900, Math.sin(a - w) * 900); c.lineTo(Math.cos(a + w) * 900, Math.sin(a + w) * 900); c.fill(); }
  c.restore();
  stipple(c, 'vig', STIP.vignette, { w: BW, h: BH, dot: 2, color: B.ink, alpha: 0.6 }); // made at board size: stretched from a small sprite it turned to blocks
}

// ---- beat two: the collage ----
function ribbon(c, pts, w, col, p) { c.save(); c.lineCap = 'round'; c.lineWidth = w; c.strokeStyle = col; c.setLineDash([2600]); c.lineDashOffset = 2600 * (1 - p);
  c.beginPath(); c.moveTo(pts[0], pts[1]); c.bezierCurveTo(...pts.slice(2)); c.stroke(); c.restore(); }
function collage(c, t, f) {
  const u = t - CUT, s = ease.expoOut(prog(u, 0, 0.35)), z = 1 + ease.in(prog(t, PUSH, L)) * 0.3;
  const obj = (x, y, d, vx, vy, draw) => { const k = ease.back(prog(u, d, d + 0.28)); if (k <= 0) return; c.save(); c.translate(x + vx * u, y + vy * u); c.scale(k, k); draw(); c.restore(); };
  c.save(); c.translate(BW / 2, BH / 2); c.scale(z, z); c.translate(-BW / 2, -BH / 2);
  c.fillStyle = B.navy; c.fillRect(0, 0, BW, BH);
  c.fillStyle = B.coral; c.fillRect(lerp(-500, 0, s), 0, 470, 300); stipple(c, 'blockfall', STIP.fall, { x: lerp(-500, 0, s), y: 0, w: 470, h: 300, dot: 2, color: B.ink, alpha: 0.5 });
  c.fillStyle = B.sky; c.fillRect(lerp(BW, 760, s), 330, 440, 345);
  c.font = `400 236px ${DISPLAY}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillStyle = B.cream; c.fillText('MIDNIGHT', lerp(500, -60, s) - u * 30, 245);
  c.fillStyle = B.gold; c.fillText('MIDNIGHT', lerp(-900, -330, s) + u * 30, 590);
  c.font = '700 15px "Inter"'; c.letterSpacing = '9px'; c.fillStyle = B.gold;
  for (let i = 0; i < 5; i++) c.fillText('MIDNIGHT', 60 + i * 300 - u * 20, 300);
  c.letterSpacing = '0px';
  c.strokeStyle = B.cream; c.lineWidth = 2; c.globalAlpha = 0.6 * s;
  c.beginPath(); c.ellipse(330, 380, 230, 76, -0.3 + u * 0.1, 0, 7); c.stroke(); c.beginPath(); c.ellipse(700, 340, 480, 180, 0.2 - u * 0.05, 0, 7); c.stroke(); c.globalAlpha = 1;
  ribbon(c, [-80, 480, 300, 200, 620, 720, 1300, 420], 64, B.teal, ease.expoOut(prog(u, 0.05, 0.6)));
  ribbon(c, [200, -60, 420, 300, 80, 520, 520, 760], 40, B.cream, ease.expoOut(prog(u, 0.15, 0.7)));
  obj(330, 380, POPS[0], -18, -12, () => { ball(c, 125, B.cream); c.rotate(u * 0.3); c.fillStyle = 'rgba(134,182,214,0.6)'; for (const [x, y, r] of [[-40, -30, 22], [35, 20, 30], [-20, 60, 14]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } });
  obj(900, 190, POPS[1], 16, 8, () => { const ring = (a, b) => { c.strokeStyle = B.gold; c.lineWidth = 12; c.beginPath(); c.ellipse(0, 0, 128, 34, -0.35, a, b); c.stroke(); }; ring(PI, 2 * PI); ball(c, 72, B.coral); ring(0, PI); });
  obj(620, 545, POPS[2], -8, -22, () => ball(c, 40, B.teal));
  obj(1040, 500, POPS[3], 10, -14, () => { c.rotate(0.4 + u * 0.2); drawMoon(c, -105, -105, 210); });
  const r = rng(11);
  for (let i = 0; i < 10; i++) { const x = 80 + r() * 1040, y = 50 + r() * 575, base = 8 + r() * 14; obj(x, y, 0.1 + i * 0.03, 0, -6, () => star4(c, 0, 0, base * (0.6 + (0.4 * ((f + i) % 3)) / 2), i % 2 ? B.cream : B.gold)); }
  c.restore();
}

function film(c, T) {
  const t = TWOS ? stepT(T % L, TWOS) : T % L, f = boil(t, 12), [x, y, s, rz, ry] = cardState(t);
  c.fillStyle = B.ink; c.fillRect(0, 0, W, H);
  c.save(); c.scale(K, K); c.imageSmoothingEnabled = false; // board units from here; stipple dots stay crisp
  ticket(c); c.clip();
  t < CUT ? burst(c, f) : collage(c, t, f);
  cardFlip(c, x, y, ry, cardFront, cardBack, { w: CW, h: CH, r: 28, s, rz, paper: B.cream, shadow: 'rgba(7,18,28,0.4)' });
  c.globalAlpha = 0.35 * clamp(1 - (t < CUT ? t : t - CUT) / 0.07); c.fillStyle = B.cream; c.fillRect(0, 0, BW, BH); // a flash on each cut
  c.globalAlpha = 0.6; c.strokeStyle = B.cream; c.lineWidth = 4; c.lineCap = 'round'; c.setLineDash([0.1, 14]);
  for (const X of [120, BW - 120]) { c.beginPath(); c.moveTo(X, 30); c.lineTo(X, BH - 30); c.stroke(); }
  c.restore();
}

// Sound from the picture's own times, once per loop: a sub and a flash on the loop cut, a whoosh peaking mid-turn, an impact as the
// type lands on the mid cut, a pop per solid, a swell and a suck-in that both END on the next loop cut.
const loopCues = o => [
  [o, 'sub_boom', 0.9, { dur: 0.9 }], [o, 'flash_hit', 0.8],
  [+(o + (FLIP[0] + FLIP[1]) / 2).toFixed(3), 'whoosh', 2.5],
  [o + CUT, 'impact', 0.8], [o + CUT, 'flash_hit', 0.6],
  ...POPS.map((d, i) => [+(o + CUT + d).toFixed(3), i % 2 ? 'pop' : 'bloop', 0.6]),
  [o + CUT + 0.3, 'sparkle', 0.8],
  [o + L, 'sub_swell', 0.8, { dur: L - PUSH }], [o + L, 'suck_in', 1, { dur: L - PUSH }],
];

window.VIDEO = {
  duration: L * LOOPS,
  audio: 'audio.wav',
  fonts: ['Archivo Black', 'Inter:wght@700'],
  sfx: Array.from({ length: LOOPS }, (_, k) => loopCues(k * L)).flat(),
  overlay(c, t) { if (!location.search.includes('look=0')) grain(c, t, 0.12); },
  scenes: [{ start: 0, end: L * LOOPS, draw(c, p, t) { film(c, t); } }],
};
