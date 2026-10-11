// examples/character-short.js: the finished character short in claude-s/demos/music-video.html ("Boil"), here to show toon.js in use.
// Copy it to video.js to re-render: node render.mjs --cues && uv run sfx.py && uv run align.py --bands audio.wav && node render.mjs.
// For a new film take the patterns (one event list for picture and sound, act/hop/face/exprAt, spline + blobs, the CAM
// framings, the iris), never the kettle, the mug or the story.
// "Boil": a kettle drums itself to the boil, whistles the tune at 100 degrees, and makes the waiting mug its tea.
// One shot, no cuts, 120 BPM. Every drum hit is a visible action of the kettle: the cue list is built from the same events.
const INK = '#1d1a2e', PAPER_C = '#efe6d3', RED = '#e2462e', RED_D = '#a8301f', BLUE = '#3d7bd9', CREAM = '#f7efdf', TEAL = '#2f6f6a', TEA = '#9a5a2a';
const BPM = 120, BT = 60 / BPM, bt = n => +(n * BT).toFixed(4), sc = H / 1080, KS = 1.3 * sc, MU = 0.9 * KS;
const FLAME_ON = bt(1), WAKE = bt(2.5), STARTLE = bt(4), DROP = bt(12), OFF = bt(19), POUR = OFF + 0.15, POURED = OFF + 1.25, SIP = POURED + 0.6, END = 13.4, IRIS = 12.3;
const STOVE_Y = H * 0.86, KX = W * 0.5, KY = STOVE_Y - 12 * sc, MX = W * 0.81, MY = STOVE_Y - 4 * sc, TX = W * 0.27, TY = H * 0.4;

// ---- events (picture and sound both read these) ----
const HOPS = [ // [landing beat, air s, height px, lean after the landing]
  [6, 0.34, 100, 0], [7, 0.34, 105, 0], [8, 0.34, 110, 0], [9, 0.34, 115, 0], [10, 0.32, 120, 0], [10.5, 0.3, 125, 0],
  [13, 0.3, 80, 0.1], [14, 0.3, 80, -0.1], [15, 0.3, 84, 0.1], [16, 0.3, 88, -0.1], [17, 0.3, 88, 0.1], [18, 0.3, 92, -0.08]];
const hopT = HOPS.map(([b, air, h]) => [bt(b) - air, air, h]);
const LIDS = [5, 7, 9, 13, 15, 17].map(bt);                                   // lid rattles on 2 and 4: the snare
const PUFFS = Array.from({ length: 28 }, (_, k) => bt(6 + k / 2)).filter(t => t < bt(10.75) || (t >= DROP + 0.25 && t < OFF)); // 8ths: the hats
const BUBBLES = [1.6, 1.85, 2.3, 2.45, 2.8, 3.1, 3.3];
const WHISTLE = [[12, 96, 0.9], [13, 93, 0.4], [13.5, 96, 0.4], [14, 101, 0.9], [15, 100, 0.4], [15.5, 96, 0.4], [16, 98, 0.9], [17, 94, 0.4], [17.5, 93, 0.4], [18, 89, 0.45], [18.5, 84, 0.45]]
  .map(([b, m, d]) => [bt(b), m, d * BT]);                                        // the lead is the whistle: beat, midi, seconds
const SNORES = [11.25, 12.1];
const GLUGS = Array.from({ length: 6 }, (_, k) => POUR + 0.25 + k * 0.13);

// ---- curves ----
const temp = t => { const k = Math.floor((t - FLAME_ON) / (BT / 2)), n = (DROP - FLAME_ON) / (BT / 2);   // steps on each 8th, 100 on the drop
  return t < FLAME_ON ? 18 : t >= DROP - 0.5 && t < DROP ? 99 : t < DROP ? Math.min(98, Math.round(18 + 81 * (k / n) ** 1.5)) : t < OFF ? 100 : Math.round(100 - 6 * (1 - Math.exp(-(t - OFF) / 1.2))); };
const lean = t => act(t, [[0, 0], ...HOPS.filter(h => h[3]).map(([b, , , l]) => [bt(b) - 0.06, l, { antic: 0.1, a: 0.3, move: 0.12, over: 0.2 }]),
  [OFF - 0.05, 0, { move: 0.15 }], [POUR + 0.35, 0.3, { antic: 0.25, a: 0.15, move: 0.35, over: 0.08 }], [POURED, 0, { antic: 0, a: 0, move: 0.3, over: 0.25 }]]);
const inflate = t => clamp((t - (DROP - 0.5)) / 0.35) * (t < DROP ? 1 : 0);    // holding its breath at 99: 0..1
const body = t => { let y = 0, k = 1;
  for (const [t0, air, h] of hopT) { const o = hop(t, t0, { air, h: h * KS, squash: 0.76, wind: 0.14 }); y += o.y; k *= o.k; }
  const st = hop(t, STARTLE - 0.05, { air: 0.22, h: 26 * KS, stretch: 1.3, squash: 0.85 }); y += st.y; k *= st.k;
  k *= act(t, [[0, 1], [WAKE, 0.92, { antic: 0.12, a: -0.6, move: 0.1, over: 0 }], [WAKE + 0.25, 1, { move: 0.12, over: 0.3 }], // a stretch-yawn as it wakes
    [DROP, 1.3, { antic: 0, a: 0, move: 0.05, over: 0.06 }], [DROP + 0.5, 1, { move: 0.2, over: 0.15 }]]);
  k *= 1 + 0.018 * Math.sin(t * 2 * Math.PI / 3) * (t < WAKE || t > OFF + 1.5 ? 1 : 0.3); // breathing
  return { y, k }; };
const lidUp = t => { let y = 0; for (const [tl, d, h] of [...LIDS.map(x => [x - 0.07, 0.14, 22]), [STARTLE - 0.03, 0.2, 60]]) { const s = t - tl; if (s > 0 && s < d) y += h * KS * Math.sin(Math.PI * s / d); }
  return y + Math.max(0, body(t - 0.06).y - body(t).y) * 0.5 - 4 * KS * inflate(t); };   // drags behind the body; pressed down while it holds its breath
const lidFly = t => { const s = (t - DROP) / 0.6; return s <= 0 || s >= 1 ? [0, 0, 0] : [70 * Math.sin(Math.PI * s), 4 * 200 * s * (1 - s), 0.55 * Math.sin(Math.PI * s)]; }; // flies clear on the drop and lands back
const whistleOn = t => { for (const [t0, , d] of WHISTLE) if (t >= t0 && t < t0 + d) return Math.min(1, (t - t0) / 0.04, (t0 + d - t) / 0.06); return 0; };
// One shot, five framings (moves, not cuts): wide; close on the face to wake; pan to the thermometer it reads; wide for the
// hops; a slow push through the held breath; BLOWN back out on the drop; wide for the dance; close on the mug for the tea.
const KF = [KX, KY - 200 * KS], CAM = [[0, 1.12, W / 2, H * 0.52], [WAKE - 0.15, 1.65, KF[0] + 100 * sc, KF[1], { move: 0.55 }], [STARTLE + 0.35, 1.22, 640 * sc, H * 0.55, { move: 0.35 }],
  [bt(6) - 0.1, 1.16, W / 2 + 60 * sc, H * 0.52, { move: 0.4 }], [DROP - 0.12, 1.38, KF[0], KF[1] + 40 * KS, { move: 0.35, over: 0 }], [DROP + 0.2, 0.92, W / 2, H * 0.48, { antic: 0, a: 0, move: 0.2, over: 0.15 }],
  [DROP + 1.2, 1.12, W / 2 + 60 * sc, H * 0.5, { move: 0.8, over: 0 }], [POUR + 0.2, 1.4, (KX + MX) / 2 + 100 * sc, MY - 190 * sc, { move: 0.7, over: 0 }], [SIP + 0.6, 1.3, (KX + MX) / 2 + 40 * sc, MY - 200 * sc, { move: 1.0, over: 0 }]];
const camAt = t => [1, 2, 3].map(j => act(t, CAM.map(k => [k[0], k[j], { antic: 0, a: 0, move: 0.4, over: 0.05, ...(k[4] || {}) }])));
const camShake = t => { const a = t - DROP; return a < 0 || a > 0.5 ? [0, 0] : [10 * sc * Math.exp(-a / 0.12) * Math.sin(a * 97), 10 * sc * Math.exp(-a / 0.12) * Math.sin(a * 131 + 1)]; };
const FACE = [[0, 'asleep'], [WAKE + 0.08, 'sleepy'], [STARTLE - 0.05, 'surprised'], [STARTLE + 0.55, 'curious'], [bt(6), 'eager'], [bt(8.5), 'surprised'], [bt(9.5), 'eager'], [bt(10.5), 'worried'],
  [DROP - 0.5, 'strain'], [DROP, 'laugh'], [DROP + 0.7, 'happy'], [OFF, 'curious'], [POURED, 'happy'], [POURED + 0.3, 'sleepy'], [SNORES[0] - 0.3, 'asleep']];

// ---- kettle ----
const BODY = spline([[-205, 0], [205, 0], [222, -24], [212, -120], [180, -205], [128, -254], [55, -276], [-55, -276], [-128, -254], [-180, -205], [-212, -120], [-222, -24]]);
const LID = spline([[-92, 4], [-70, -22], [0, -36], [70, -22], [92, 4], [0, 8]], 6);
const SPOUT = [[178, -150], [318, -238], [344, -214], [204, -78]], TIP = [338, -230];
const seedT = (id, t) => id * 3 + boil(t, 12, 3);
const kxf = t => { const { y, k } = body(t), r = lean(t), f = inflate(t), tr = f ? Math.sin(t * 190) * 2.5 * sc : 0;
  return new DOMMatrix().translate(KX + tr + Math.sign(r) * 222 * KS, KY - y).rotate(r * 180 / Math.PI).translate(-Math.sign(r) * 222 * KS, 0).scale((1 + 0.12 * f) / Math.sqrt(k), (1 - 0.05 * f) * k).scale(KS); };
const spoutTip = t => kxf(t).transformPoint(new DOMPoint(...TIP));

function kettle(c, t) {
  const wh = whistleOn(t), r = lean(t), fl = flameAmt(t);
  c.save(); c.setTransform(c.getTransform().multiply(kxf(t)));
  const sw = (body(t - 0.1).y - body(t).y) * 0.002 / KS; // the handle swings behind the motion
  c.save(); c.translate(0, -262); c.rotate(sw); c.lineWidth = 15; c.strokeStyle = INK; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-118, 6); c.bezierCurveTo(-120, -150, 120, -150, 118, 6); c.stroke();
  c.fillStyle = '#5a3b2a'; rrect(c, -62, -132, 124, 26, 13); c.fill(); c.lineWidth = 5; c.stroke(); c.restore();
  c.fillStyle = RED; polyPath(c, SPOUT); c.fill(); sketch(c, SPOUT, { closed: true, color: INK, lw: 5, seed: seedT(2, t), wob: 1 });
  c.fillStyle = INK; c.beginPath(); c.ellipse(331, -226, 9, 15, -0.55, 0, 7); c.fill();                     // the opening
  c.save(); c.translate(331, -226); c.rotate(-0.55 - wh * 0.6); c.fillStyle = INK; rrect(c, 2, -18, 30, 12, 6); c.fill(); c.restore(); // whistle flap
  polyPath(c, BODY); c.fillStyle = RED; c.fill();
  c.save(); polyPath(c, BODY); c.clip();
  c.globalAlpha = 0.6; c.fillStyle = RED_D; c.beginPath(); c.ellipse(225 - r * 60, -90, 105, 260, -0.15, 0, 7); c.fill();       // core shadow, away from the window
  c.globalAlpha = 0.55; c.fillStyle = '#ffd9c8'; c.beginPath(); c.ellipse(-165 - r * 60, -170, 22, 64, 0.4, 0, 7); c.fill();   // highlight slides as it tilts
  if (fl > 0) { const g = c.createLinearGradient(0, 0, 0, -90); g.addColorStop(0, `rgba(255,138,61,${0.7 * fl})`); g.addColorStop(1, 'rgba(255,138,61,0)'); c.globalAlpha = 1; c.globalCompositeOperation = 'screen'; c.fillStyle = g; c.fillRect(-240, -90, 480, 92); c.globalCompositeOperation = 'source-over'; } // flame light
  c.globalAlpha = 0.3; polyPath(c, BODY); c.lineWidth = 34; c.strokeStyle = RED_D; c.stroke(); c.globalAlpha = 1; wash(c, -240, -300, 480, 320, 0.45); c.restore();
  sketch(c, BODY, { closed: true, color: INK, lw: 6, seed: seedT(1, t), wob: 0.8 });
  const [lx, ly, lr] = lidFly(t); c.save(); c.translate(lx, -272 - lidUp(t) / KS - ly); c.rotate(lr + Math.sin(t * 31) * Math.min(1, Math.max(0, lidUp(t)) / 10) * 0.08);
  c.fillStyle = RED; polyPath(c, LID); c.fill(); sketch(c, LID, { closed: true, color: INK, lw: 5, seed: seedT(3, t) });
  c.fillStyle = INK; c.beginPath(); c.arc(0, -40, 14, 0, 7); c.fill(); c.restore();
  const f = { ...exprAt(t, FACE, 0.08), blink: blinkAt(t, 4, { at: [STARTLE + 0.5, DROP + 0.62, OFF - 0.1] }),
    look: t > STARTLE + 0.5 && t < bt(8) ? [-1, 0.1] : t > OFF && t < POURED ? [1, 0.6] : [r * 4, 0] };   // reads its thermometer; watches the pour
  if (wh) { f.open = Math.max(f.open, 0.6 * wh); f.smile = Math.min(f.smile, 0.1); }
  f.puff = t > DROP - 0.45 && t < DROP ? 1 : 0;
  face(c, 0, -138, 132, f, { ink: INK, cheek: '#ff9a8a' });
  c.restore();
}
const flameAmt = t => clamp((t - FLAME_ON) / 0.25) * (1 - clamp((t - OFF) / 0.2));
function flame(c, t) {
  const on = flameAmt(t); if (on <= 0) return;
  for (let i = 0; i < 12; i++) {
    const x = (-275 + i * 50) * KS, edge = Math.abs(x) > 180 * KS ? 1.5 : 1, h = (24 + 10 * Math.sin(t * 23 + i * 1.7) + 30 * band(t, 'low') * (t > 2 ? 1 : 0.4)) * KS * on * edge;
    c.fillStyle = BLUE; c.globalAlpha = 0.9; c.beginPath(); c.moveTo(x - 13 * KS, 0); c.quadraticCurveTo(x - 10 * KS, -h * 0.6, x, -h); c.quadraticCurveTo(x + 10 * KS, -h * 0.6, x + 13 * KS, 0); c.fill();
    c.fillStyle = '#9fd0ff'; c.beginPath(); c.moveTo(x - 5 * KS, 0); c.quadraticCurveTo(x, -h * 0.5, x + 5 * KS, 0); c.fill(); c.globalAlpha = 1;
  }
}
// steam: every puff leaves the spout where it was, rises and arcs back over the upper centre; all puffs are one merged shape
function steam(c, t) {
  const circ = [];
  const puff = (tp, seed, big) => { const a = t - tp; if (a < 0 || a > 1.2) return; const r = rng(seed), p = a / 1.2, b = big ? 1.5 : 1, tip = spoutTip(tp);
    const x = tip.x + (70 * p - 330 * p * p + (r() - 0.5) * 40 * p) * KS * b, y = Math.max(H * 0.08, tip.y - (320 * p ** 0.8 + r() * 30 * p) * KS), rad = (10 + 44 * p) * KS * b * (1 - p) ** 0.3;
    circ.push([x, y, rad], [x - rad * 0.7, y + rad * 0.35, rad * 0.7], [x + rad * 0.65, y + rad * 0.3, rad * 0.75]); };
  PUFFS.forEach((tp, i) => puff(tp, 50 + i, false));
  for (let i = 0; i < 80; i++) { const tp = DROP + i * 0.045; if (tp < OFF && whistleOn(tp) > 0) puff(tp, 200 + i, true); }
  for (let i = 0; i < 10; i++) puff(DROP - 0.012 * i, 400 + i, true);                      // the jet on the drop
  for (const tp of SNORES) puff(tp + 0.35, 600 + Math.round(tp * 10), false);               // it snores through its whistle
  for (let i = 0; i < 6; i++) { const a = t - POURED - 0.3 - i * 0.4; if (a < 0 || a > 1.4) continue; const p = a / 1.4, x = MX + Math.sin(a * 3 + i) * 18 * sc, y = MY - 186 * MU - 10 * sc - p * 160 * sc, rr = (8 + 20 * p) * sc; circ.push([x, y, rr], [x + rr * 0.6, y + rr * 0.4, rr * 0.6]); } // tea steam
  if (circ.length) { c.save(); c.globalAlpha = 0.9; blobs(c, circ, { fill: CREAM, ink: 'rgba(29,26,46,0.45)', lw: 2 * sc }); c.restore(); }
}
function notes(c, t) { // a note leaves the spout on every whistled note and arcs to the upper centre, higher notes higher
  WHISTLE.forEach(([t0, m], i) => { const a = t - t0; if (a < 0 || a > 1.3) return; const p = a / 1.3, tip = spoutTip(t0);
    const x = tip.x + (60 * p - 520 * p * p) * KS, y = tip.y - (200 + (m - 72) * 8) * p * KS - 60 * KS * p;
    c.save(); c.translate(x, Math.max(H * 0.07, y)); c.rotate(Math.sin(a * 5 + i) * 0.2); c.globalAlpha *= Math.min(1, a / 0.06) * (1 - p) ** 0.7; c.fillStyle = c.strokeStyle = INK; const z = (0.8 + 0.35 * (i % 2)) * KS;
    c.beginPath(); c.ellipse(0, 0, 15 * z, 11 * z, -0.4, 0, 7); c.fill(); c.lineWidth = 5 * z; c.beginPath(); c.moveTo(13 * z, -4 * z); c.lineTo(13 * z, -58 * z); c.quadraticCurveTo(30 * z, -46 * z, 32 * z, -30 * z); c.stroke(); c.restore(); });
}
function burst(c, t) { // ink action lines over the kettle for 0.3 s on the drop, upper half only (off the type and the stove)
  const a = t - DROP; if (a < 0 || a > 0.3) return; const r = rng(77);
  c.save(); c.strokeStyle = INK; c.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const ang = -Math.PI * (0.05 + 0.6 * r()), r0 = (330 + 60 * r() + 240 * a) * KS, L = (60 + 80 * r()) * KS * (1 - a / 0.3), cy = KY - 200 * KS; c.lineWidth = (3 + 5 * r()) * sc;
    c.beginPath(); c.moveTo(KX + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.8); c.lineTo(KX + Math.cos(ang) * (r0 + L), cy + Math.sin(ang) * (r0 + L) * 0.8); c.stroke(); }
  c.restore();
}

// ---- the mug: the audience, and the reason. It reacts 0.12 s after the kettle and answers on the off-beats. ----
const MUG_FACE = [[0, 'curious'], [STARTLE + 0.07, 'surprised'], [STARTLE + 0.7, 'eager'], [bt(8), 'happy'], [bt(10), 'surprised'], [DROP - 0.4, 'worried'], [DROP + 0.12, 'surprised'], [DROP + 0.6, 'laugh'],
  [OFF, 'eager'], [POUR + 0.4, 'laugh'], [POURED + 0.3, 'happy'], [SIP, 'asleep'], [SIP + 0.75, 'happy']];
const MUG_HOPS = Array.from({ length: 6 }, (_, k) => bt(13.5 + k)).filter(x => x < OFF);
const MUGP = spline([[-92, -186], [92, -186], [90, -20], [70, 0], [-70, 0], [-90, -20]], 6);
const mugFill = t => clamp((t - POUR - 0.3) / 0.85) * 0.78;
function mug(c, t) {
  let y = 0, k = 1;
  for (const tl of MUG_HOPS) { const o = hop(t, tl - 0.24, { air: 0.24, h: 60 * MU, squash: 0.78 }); y += o.y; k *= o.k; }
  const st = hop(t, STARTLE + 0.07, { air: 0.2, h: 30 * MU }); y += st.y; k *= st.k;
  k *= t > bt(5) && t < DROP - 0.5 ? 1 - 0.05 * pulse(t, 0.12) : 1;                                          // nods on the build's beats
  k *= act(t, [[0, 1], [DROP - 0.02, 0.88, { antic: 0.25, a: 0.4, move: 0.15, over: 0 }], [DROP + 0.14, 1.1, { antic: 0, a: 0, move: 0.06, over: 0.1 }], [DROP + 0.6, 1, { move: 0.2, over: 0.15 }]]);
  const r = t < OFF ? -lean(t - 0.12) * 0.7 : -act(t, [[0, 0], [SIP, -0.44, { antic: 0.15, a: 0.2, move: 0.25, over: 0.1 }], [SIP + 0.7, 0, { move: 0.25, over: 0.15 }]]); // the sip
  c.save(); squashAt(c, 0, -y, k, r, Math.sign(r) * 92 * MU); c.scale(MU, MU);
  c.lineWidth = 15; c.strokeStyle = INK; c.beginPath(); c.moveTo(86, -150); c.bezierCurveTo(150, -150, 150, -40, 86, -45); c.stroke();  // handle, attached
  c.fillStyle = CREAM; polyPath(c, MUGP); c.fill();
  c.save(); polyPath(c, MUGP); c.clip(); c.fillStyle = TEAL; c.fillRect(-100, -62, 200, 24); c.globalAlpha = 0.25; c.fillStyle = '#c9bca5'; c.fillRect(30, -200, 70, 210); c.globalAlpha = 1; wash(c, -100, -200, 200, 210, 0.15); c.restore();
  sketch(c, MUGP, { closed: true, color: INK, lw: 6, seed: seedT(30, t) });
  const fl = mugFill(t), brew = clamp((t - POURED) / 1.2);
  c.fillStyle = '#d9cdb8'; c.beginPath(); c.ellipse(0, -186, 88, 18, 0, 0, 7); c.fill(); c.fillStyle = '#c4b59c'; c.beginPath(); c.ellipse(0, -182, 80, 12, 0, 0, 3.14); c.fill(); // the rim: an empty cup
  if (fl > 0) { const rx = 84 * (0.6 + 0.4 * fl), ry = 15 * (0.6 + 0.4 * fl), g = c.createRadialGradient(-50, -186, 0, -50, -186, 10 + 170 * brew); g.addColorStop(0, TEA); g.addColorStop(0.7, TEA); g.addColorStop(1, '#d9e6ec');
    c.fillStyle = brew > 0 ? g : '#d9e6ec'; c.beginPath(); c.ellipse(0, -186, rx, ry, 0, 0, 7); c.fill(); }   // amber spreads out from the teabag
  c.lineWidth = 5; c.strokeStyle = INK; c.beginPath(); c.ellipse(0, -186, 88, 18, 0, 0, 7); c.stroke();
  c.lineWidth = 3; c.beginPath(); c.moveTo(-40, -190); c.quadraticCurveTo(-120, -170, -112, -96); c.stroke();          // the teabag string, waiting from the start
  c.fillStyle = '#e8b04a'; rrect(c, -132, -100, 40, 34, 4); c.fill(); c.stroke();
  const look = t < STARTLE ? [-1, t > FLAME_ON && t < FLAME_ON + 0.8 ? 0.9 : -0.2] : t > OFF && t < POURED ? [-0.6, -0.8] : [-0.9, -0.2];
  face(c, 0, -112, 80, { ...exprAt(t, MUG_FACE, 0.08), blink: blinkAt(t, 9, { at: [STARTLE + 0.65, POURED + 0.2] }), look }, { ink: INK, cheek: '#ff9a8a' });
  c.restore();
}
function pourStream(c, t) { // boiled water from the spout tip into the mug while the kettle is tipped
  if (t < POUR + 0.25 || t > POURED - 0.05) return;
  const tip = spoutTip(t), my = MY - 186 * MU, w = Math.min(1, (t - POUR - 0.25) / 0.1, (POURED - 0.05 - t) / 0.1);
  c.save(); c.lineCap = 'round'; c.beginPath(); c.moveTo(tip.x, tip.y); c.quadraticCurveTo(tip.x + 60 * sc, tip.y - 20 * sc, MX - 10 * sc, my + 6 * sc);
  c.lineWidth = 22 * sc * w; c.strokeStyle = INK; c.stroke(); c.lineWidth = 14 * sc * w; c.strokeStyle = '#cfe3ee'; c.stroke();
  c.setLineDash([16 * sc, 22 * sc]); c.lineDashOffset = -t * 600 * sc; c.lineWidth = 4 * sc * w; c.strokeStyle = '#fff'; c.stroke(); c.restore();
}

// ---- room ----
let WASH; // watercolour: soft pigment blotches, made once, multiplied inside a fill
function wash(c, x, y, w, h, a = 0.35) {
  if (!WASH) { WASH = new OffscreenCanvas(512, 512); const g = WASH.getContext('2d'), r = rng(9); g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 110; i++) { const X = r() * 512, Y = r() * 512, R = 18 + r() * 80, gr = g.createRadialGradient(X, Y, 0, X, Y, R), v = 150 + Math.round(r() * 70);
      gr.addColorStop(0, `rgba(${v},${v - 20},${v - 30},0.32)`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(X - R, Y - R, 2 * R, 2 * R); } }
  c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha *= a; c.drawImage(WASH, x, y, w, h); c.restore();
}
function room(c, t) {
  const p = clamp(t / END), wx = W * 0.06, wy = H * 0.07, ww = W * 0.17, wh = H * 0.3;
  c.fillStyle = PAPER_C; c.fillRect(-W, -H, 3 * W, 3 * H);
  const glow = c.createRadialGradient(wx + ww / 2, wy + wh, 0, wx + ww / 2, wy + wh, W * 0.6);     // morning light from the window warms the wall
  glow.addColorStop(0, `rgba(255,185,110,${0.06 + 0.4 * p})`); glow.addColorStop(1, 'rgba(255,190,120,0)'); c.fillStyle = glow; c.fillRect(-W, -H, 3 * W, 3 * H);
  c.save(); c.globalAlpha = 0.07;
  for (let i = -2; i < 16; i++) sketch(c, [[i * 150 * sc, -200], [i * 150 * sc, STOVE_Y]], { color: TEAL, lw: 1.6, seed: 70 + i, wob: 1 });
  for (let j = 0; j < 7; j++) sketch(c, [[-300, j * 150 * sc], [W + 300, j * 150 * sc]], { color: TEAL, lw: 1.6, seed: 90 + j, wob: 1 });
  c.restore();
  c.save(); c.globalAlpha = 0.35; c.fillStyle = '#b9ab92'; c.fillRect(W * 0.64, H * 0.27, W * 0.3, 10 * sc);              // a shelf, low contrast: jars and a pan
  [[0.67, 70, 80], [0.72, 55, 110], [0.76, 60, 70]].forEach(([x, w, h]) => { rrect(c, W * x, H * 0.27 - h * sc, w * sc, h * sc, 10 * sc); c.fill(); });
  c.beginPath(); c.arc(W * 0.86, H * 0.12, 60 * sc, 0, 7); c.fill(); c.fillRect(W * 0.86 - 6 * sc, H * 0.12 - 130 * sc, 12 * sc, 80 * sc); c.restore();
  c.save(); c.beginPath(); c.rect(wx, wy, ww, wh); c.clip();
  const g = c.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, mixHex('#2a3a6b', '#9cc4e4', p)); g.addColorStop(1, mixHex('#e98a6b', '#ffe2b8', p));
  c.fillStyle = g; c.fillRect(wx, wy, ww, wh); c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(wx + ww * 0.62, wy + wh * (1.08 - 0.5 * p), 30 * sc, 0, 7); c.fill(); c.restore();
  c.fillStyle = PAPER_C; c.fillRect(wx + ww / 2 - 5 * sc, wy, 10 * sc, wh); c.fillRect(wx, wy + wh / 2 - 5 * sc, ww, 10 * sc);
  sketch(c, [[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], { closed: true, color: INK, lw: 5, seed: seedT(20, t) });
  c.fillStyle = '#e9dcc6'; c.fillRect(-300, STOVE_Y, W + 600, H); c.fillStyle = INK; c.fillRect(-300, STOVE_Y - 6 * sc, W + 600, 12 * sc);
  const fl = flameAmt(t) * (0.8 + 0.2 * band(t, 'low')); if (fl > 0) { const g2 = c.createRadialGradient(KX, STOVE_Y, 0, KX, STOVE_Y, 420 * KS); // the flame lights the wall behind
    g2.addColorStop(0, `rgba(255,170,90,${0.35 * fl})`); g2.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = g2; c.fillRect(KX - 420 * KS, STOVE_Y - 420 * KS, 840 * KS, 420 * KS); }
  [0.42, 0.5, 0.58].forEach((x, i) => { // knobs; the middle one turns the gas on and off
    const a = i === 1 ? act(t, [[0, 0], [FLAME_ON - 0.1, -1.6, { antic: 0.12, a: 0.1, move: 0.15, over: 0.08 }], [OFF, 0, { move: 0.15 }]]) : 0;
    c.save(); c.translate(W * x, STOVE_Y + 75 * sc); c.rotate(a); c.fillStyle = CREAM; c.beginPath(); c.arc(0, 0, 30 * sc, 0, 7); c.fill(); c.lineWidth = 5 * sc; c.strokeStyle = INK; c.stroke();
    c.fillStyle = INK; c.fillRect(-4 * sc, -27 * sc, 8 * sc, 23 * sc); c.restore(); });
}
function gauge(c, t) { // the clock of the piece: water temperature on a card beside the stove, stepping on each 8th (1.08x for 3 frames)
  const T = temp(onFrame(t)), out = 1 - 0.6 * clamp((t - OFF - 0.6) / 0.8);
  const step = (() => { for (let k = 0; k < 3; k++) if (temp(onFrame(t) - k / 30) !== temp(onFrame(t) - (k + 1) / 30)) return 1; return 0; })();
  const hit = act(t, [[0, 0], [DROP, 1, { antic: 0.1, a: 0.3, move: 0.05, over: 0.25 }], [DROP + 0.6, 0.12, { move: 0.25, over: 0 }]]);
  c.save(); c.globalAlpha *= out; c.translate(TX, TY);
  c.fillStyle = CREAM; rrect(c, -22 * sc, 0, 44 * sc, 330 * sc, 22 * sc); c.fill(); c.lineWidth = 5 * sc; c.strokeStyle = INK; c.stroke();
  const lv = (T - 10) / 95 * 290 * sc; c.fillStyle = RED; rrect(c, -9 * sc, 320 * sc - lv, 18 * sc, lv, 9 * sc); c.fill();
  c.beginPath(); c.arc(0, 342 * sc, 34 * sc, 0, 7); c.fill(); c.stroke();
  for (let i = 0; i <= 7; i++) { c.fillStyle = INK; c.fillRect(22 * sc, (320 - i * 40) * sc, (i % 3 ? 12 : 24) * sc, 4 * sc); }
  c.translate(-90 * sc, 150 * sc); const s = (1 + 0.3 * hit) * (1 + 0.08 * step); c.scale(s, s);
  c.font = `${150 * sc}px "Anton"`; const tw = c.measureText(`${T}`).width;
  c.fillStyle = CREAM; rrect(c, -tw - 90 * sc, -96 * sc, tw + 112 * sc, 196 * sc, 20 * sc); c.fill(); c.lineWidth = (T >= 100 ? 8 : 5) * sc; c.strokeStyle = INK; c.stroke();
  text(c, `${T}`, -66 * sc, 0, { size: 150 * sc, font: 'Anton', color: INK, align: 'right' });
  text(c, '°', -62 * sc, -36 * sc, { size: 70 * sc, font: 'Anton', color: T >= 99 ? RED : INK, align: 'left' });
  text(c, 'WATER °C', -tw - 66 * sc, 76 * sc, { size: 20 * sc, font: 'IBM Plex Mono', weight: 500, color: INK, align: 'left', spacing: 3 * sc });
  c.restore();
}
function zzz(c, t) { // asleep: a z drifts up every 1.2 s, at the start and again at the end
  for (const [t0, t1] of [[-0.4, WAKE], [SNORES[0] - 0.2, END + 2]]) for (let k = 0; k < 4; k++) { const a = t - t0 - k * 1.2; if (a < 0 || a > 1.6 || t > t1) continue;
    text(c, 'z', KX + 230 * KS + a * 50 * sc, KY - 330 * KS - a * 110 * sc, { size: (40 + 30 * a) * sc, font: 'Anton', color: INK, alpha: Math.sin(Math.PI * a / 1.6) }); }
}

window.VIDEO = {
  duration: END,
  audio: 'audio.wav',
  fonts: ['Anton', 'IBM Plex Mono:wght@500'],
  scenes: [{ start: 0, end: END, draw(c, p, t) {
    const [z, fx, fy] = camAt(t), [sx, sy] = camShake(t);
    c.translate(W / 2 + sx, H / 2 + sy); c.scale(z, z); c.translate(-fx, -fy);
    room(c, t); gauge(c, t);
    c.save(); c.translate(KX, KY); flame(c, t); c.fillStyle = INK; c.fillRect(-300 * KS, -10 * sc, 600 * KS, 14 * sc);
    [-1, 1].forEach(d => c.fillRect(d * 300 * KS - 7 * sc, -10 * sc, 14 * sc, 22 * sc));
    contactShadow(c, 0, -2 * sc, 250 * KS, body(t).y, { alpha: 0.3, flat: 0.08 }); c.restore();
    c.save(); c.translate(MX, MY); contactShadow(c, 0, 0, 110 * MU, 0, { alpha: 0.25, flat: 0.12 }); c.restore();
    burst(c, t); kettle(c, t); pourStream(c, t);
    c.save(); c.translate(MX, MY); mug(c, t); c.restore();
    steam(c, t); notes(c, t); zzz(c, t);
  } }],
  overlay(c, t) { paper(c, 0.5); const a = t - DROP; if (a >= 0 && a < 1 / 30) { c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); } // one pure white frame on the drop
    if (t > IRIS) { const p = ease.inOut(clamp((t - IRIS) / 0.7)), [z, fx, fy] = camAt(t), cx = W / 2 + (KX + 40 * KS - fx) * z, cy = H / 2 + (KY - 170 * KS - fy) * z; // iris closes on the snoring kettle
      const rr = Math.max(0, (1 - p) * W * 0.9); c.fillStyle = INK; c.beginPath(); c.rect(0, 0, W, H); c.moveTo(cx + rr, cy); c.arc(cx, cy, rr, 0, 2 * Math.PI); c.fill('evenodd'); } },
};

// ---- sound: built from the same events ----
const midiHz = m => 440 * 2 ** ((m - 69) / 12);
const SFX = [
  [0.15, 'babble', 0.6, { text: 'o', f: 95, mood: 'sad', rate: 2 }], [1.35, 'babble', 0.35, { text: 'o', f: 110, mood: 'sad', rate: 2.5 }], // snores
  [FLAME_ON - 0.2, 'click'], [FLAME_ON - 0.1, 'click'], [FLAME_ON, 'swoosh', 0.45], [FLAME_ON, 'thump', 0.3],
  ...BUBBLES.map(b => [b, 'pop', 0.35]),
  [STARTLE - 0.05, 'boing', 0.8], [STARTLE + 0.05, 'clink', 0.8], [STARTLE + 0.17, 'squish', 0.7], [STARTLE + 0.27, 'chirp', 0.6],
  ...hopT.flatMap(([t0, air]) => t0 + air < DROP ? [[t0 + air, 'thump', 0.9], [t0 + air, 'stamp', 0.5, { f: 120 }]] : [[t0 + air, 'stamp', 0.8, { f: 220 }]]), // landings: the kick
  ...hopT.filter(([t0]) => t0 < DROP).map(([t0]) => [t0, 'slide', 0.4, { f0: 300, f1: 520, dur: 0.12 }]),
  ...LIDS.map(t => [t, 'clink', t < DROP ? 0.9 : 1.8]),                                            // lid: the snare
  ...PUFFS.map(t => [t, 'tick', 2.2, { f: 9500 }]),                                                // steam: the hats
  [DROP, 'sub_drop'], [DROP, 'flash_hit', 0.9], [DROP, 'hiss_bed', 2.2, { dur: 0.7 }], [DROP, 'slide', 1.6, { f0: 2000, f1: 3000, dur: 0.45, vib: 0.02 }], [DROP + 0.6, 'clink', 1.6], // the shriek, the steam blast, the lid lands
  ...WHISTLE.slice(1).map(([t0, m, d]) => [t0, 'slide', 1.8, { f0: midiHz(m - 1), f1: midiHz(m), dur: d, vib: 0.03 }]),
  ...MUG_HOPS.map(t => [t, 'squish', 0.35, { f: 260 }]),
  [OFF, 'click'], [POUR + 0.25, 'hiss_bed', 0.5, { dur: POURED - POUR - 0.3 }], ...GLUGS.map((t, k) => [t, 'pop', 0.4, { f0: 380 + k * 90, f1: 300 + k * 80 }]),
  [POURED + 0.3, 'chirp', 0.7, { n: 3 }], [POURED + 0.1, 'clink', 0.6], [SIP + 0.1, 'suck_in', 0.5, { dur: 0.3, f0: 600, f1: 2500 }], [SIP + 0.8, 'deflate', 0.35, { dur: 0.6, f0: 420, f1: 160 }],
  ...SNORES.flatMap(tp => [[tp, 'babble', 0.5, { text: 'o', f: 95, mood: 'sad', rate: 2 }], [tp + 0.3, 'slide', 0.35, { f0: 1700, f1: 2300, dur: 0.22 }]]), // snoring through its whistle
  [DROP, 'gap', 1, { dur: 0.5 }], [DROP - 0.05, 'suck_in', 0.22, { dur: 0.4, f0: 500, f1: 1800 }], // a held breath, nothing else
  [IRIS + 0.6, 'slide', 0.3, { f0: 1700, f1: 2300, dur: 0.2 }], [OFF + 1.2, 'echo', 0.8],
];
Object.assign(window.VIDEO, {
  sfx: SFX,
  bed: { bpm: BPM, kick: { decay: 0.1 }, chords: [[50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 60], [53, 57, 60, 64], [46, 50, 53, 57], [53, 57, 60, 64]],
    sections: [[0, 'arp', 2.4], [bt(4), 'stop', 2.6], [DROP, 'groove', 0.4], [OFF, 'outro', 2.2]] },
});
