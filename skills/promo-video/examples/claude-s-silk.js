// Example: claude-s · silk (demos/promo-video.html), a 9 s, 60 fps proof of render.mjs --smooth and promo.js's cursor choreography.
// Render: node render.mjs --cues && uv run sfx.py && node render.mjs --smooth --out silk-60.mp4 (VIDEO.blur adds subframes on the fling).
// Shots: a prompt the cursor runs (0-1.5) | velocity-matched cut to a rail of the nine skills the cursor grabs and flings (1.5-4.5) |
// the same orbit at 30 fps without blur and at 60 fps with it (4.5-6.5) | velocity-matched cut up to the end card, Copy pressed (6.5-9).
// It shows how the API is used; never re-skin it. Copy is the repo's own: the SKILLS list in index.html and the README's clone command.
// Brand and copy from the repo's index.html and README. Layout in W/H/S; 1920x1080 only (a 9:16 needs a re-layout).
const B = { bg: '#f5f4f0', panel: '#ffffff', raise: '#ecebe6', ink: '#1a1a18', dim: '#66655f', faint: '#b9b8b1', rule: '#dcdbd5', accent: '#d9481c', font: 'Inter' };
const CUT1 = 1.5, CUT2 = 4.5, CUT3 = 6.5, END = 9.0, V1 = 3000 * S, V3 = 2600 * S; // the velocity-matched cuts' speeds, px/s
const setF = (c, size, weight = 500) => { c.font = `${weight} ${size}px "${B.font}"`; };
const shadowed = (c, blur, dy, a = 0.1) => { c.shadowColor = `rgba(26,26,24,${a})`; c.shadowBlur = blur; c.shadowOffsetY = dy; };
const mix2 = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(lerp(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), k)).toString(16).padStart(2, '0')).join('');

// ---------- A. the prompt (0–1.5): the cursor is already flying in, presses Run, the desk accelerates left into the cut ----------
const PANEL = { w: 1240 * S, h: 290 * S }; PANEL.x = (W - PANEL.w) / 2; PANEL.y = (H - PANEL.h) / 2;
const RUN = { w: 176 * S, h: 72 * S }; RUN.x = PANEL.x + PANEL.w - RUN.w - 28 * S; RUN.y = PANEL.y + PANEL.h - RUN.h - 28 * S;
const PROMPT = 'a 9 s promo, 60 fps', TYPE0 = -0.41, CPS = 22; // 9 characters already typed on frame 0, done by 0.45 s
const [RX, RY] = aimAt(RUN);
const CUR_A = cursorPath([{ t: -0.35, x: W * 0.86, y: H * 1.1 }, { t: 0.55, x: RX, y: RY, click: true }, { t: 1.3, x: RX + 60 * S, y: RY + 46 * S }]); // mid-flight on frame 0
const PRESS_A = CUR_A.clicks[0];

function shotA(c, t) {
  bg(c, B.bg);
  c.save(); c.translate(-velCut(t, CUT1, V1), 0); // the whip: expo acceleration into the cut
  const k = lerp(1, 1.12, ease.smooth(prog(t, 0, CUT1))); c.translate(W / 2, H / 2); c.scale(k, k); c.translate(-W / 2, -H / 2);
  c.fillStyle = 'rgba(26,26,24,0.10)'; for (let y = 36 * S; y < H; y += 48 * S) for (let x = 24 * S; x < W; x += 48 * S) c.fillRect(x - 1.5 * S, y - 1.5 * S, 3 * S, 3 * S);
  const e = 1;
  c.save(); c.globalAlpha = e; c.translate(0, (1 - e) * 40 * S); shadowed(c, 50 * S, 18 * S); rrect(c, PANEL.x, PANEL.y, PANEL.w, PANEL.h, 22 * S); c.fillStyle = B.panel; c.fill(); c.restore();
  c.save(); c.globalAlpha = e; c.translate(0, (1 - e) * 40 * S);
  smoothText(c, 'claude-s', PANEL.x + 32 * S, PANEL.y + 58 * S, { size: 30 * S, font: B.font, weight: 500, color: B.dim });
  const n = Math.floor(clamp((t - TYPE0) * CPS, 0, PROMPT.length)), shown = PROMPT.slice(0, n);
  setF(c, 60 * S, 500); if (shown) smoothText(c, shown, PANEL.x + 32 * S, PANEL.y + 146 * S, { size: 60 * S, font: B.font, weight: 500, color: B.ink });
  if (n < PROMPT.length || Math.floor(t * 2.5) % 2 === 0) { const cw = c.measureText(shown).width; c.fillStyle = B.accent; c.fillRect(PANEL.x + 36 * S + cw, PANEL.y + 98 * S, 4 * S, 62 * S); }
  const pose = CUR_A(t), [, , hov] = magnet(pose, RUN), down = pose.press, ran = prog(t, PRESS_A + 0.05, CUT1 + 0.1);
  c.save(); c.translate(RUN.x + RUN.w / 2, RUN.y + RUN.h / 2); c.scale(1 - 0.05 * down, 1 - 0.05 * down);
  rrect(c, -RUN.w / 2, -RUN.h / 2, RUN.w, RUN.h, RUN.h / 2); c.fillStyle = mix2(B.accent, B.ink, 0.1 * hov + 0.2 * down + 0.08 * (ran > 0)); c.fill(); // hover darkens, press darkens more: no ring
  setF(c, 30 * S, 600); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ran > 0 ? 'Running' : 'Run', 0, 1 * S); c.restore();
  if (ran > 0) { c.fillStyle = B.accent; c.fillRect(PANEL.x + 22 * S, PANEL.y + PANEL.h - 3 * S, (PANEL.w - 44 * S) * ease.inOut(ran), 3 * S); } // the run's progress along the panel's foot
  c.restore();
  drawCursor(c, pose);
  c.restore();
}

// ---------- B. the rail of nine skills (1.5–4.5): arrives at the cut's speed, the cursor grabs and flings it ----------
const SKILLS = [ // SKILLS in index.html: id, demo title, length. Ordered so the fling travels five cards and lands on promo-video.
  ['x-video-frames', 'A deconstruction report of our own heat-pump lesson', 'report page'], ['archive-footage', 'Old film b-roll, licences checked at the source', '12.5 s montage'],
  ['story-video', 'A founder story in 27 seconds', '27 s, 16:9'], ['music-video', 'Small things compound: a spoken-word lyric essay', '29 s, 16:9'],
  ['explainer-lesson', 'How does a hash table find one name in a million?', '58.5 s, 16:9'], ['type-film', 'claude-s: a brand film for the repo, made by its own skill', '18 s, 16:9'],
  ['promo-video', 'Plexus launch promo', '18 s, 16:9'], ['ugc-edit', 'A creator cut from a placeholder talking head', '28.5 s, 9:16'],
  ['explorable-explainer', 'How does a mechanical keyboard switch work?', 'interactive page'],
];
const CW = 560 * S, CH = 380 * S, PITCH = 610 * S, FOCUS0 = 1, HERO = 6;
const TG = CUT1 + 0.97, TD = 0.22, TR = TG + TD, TAU = 0.3; // grab, drag, release, momentum decay
const TRAVEL = (HERO - FOCUS0) * PITCH, FLING = TRAVEL / (1 + (0.5 * TD) / TAU), VR = FLING / TAU, DRAG = 0.5 * VR * TD; // the drag ends at the fling's speed
const railShift = t => -velCut(t, CUT1, V1) - (t < TG ? 0 : t < TR ? (0.5 * VR / TD) * (t - TG) ** 2 : DRAG + FLING * (1 - Math.exp(-(t - TR) / TAU)));
const GX = W / 2 + PITCH - 40 * S + railShift(CUT1 + 0.85), GY = H / 2 + 92 * S;
const CUR_B = cursorPath([
  { t: CUT1 + 0.35, x: W * 0.64, y: H * 1.08 }, { t: CUT1 + 0.85, x: GX, y: GY, grab: true, dwell: TG - CUT1 - 0.85, hold: 0 },
  { t: TR, x: GX - DRAG, y: GY - 12 * S, drop: true, dwell: 0, hold: 0, bow: 0, ease: p => p * p },             // carried with the rail
  { t: TR + 0.17, x: GX - DRAG - (VR * 0.17) / (10 * Math.LN2), y: GY - 16 * S, bow: 0, ease: ease.expoOut, out: true, hold: 0.3 }, // the hand runs on, then fades
]);
// One tick per card crossing the centre, read off railShift (sound from the picture's own function).
const CROSS = []; for (let t = CUT1, k = FOCUS0 + 1; t < CUT2 && k <= HERO; t += 1 / 960) if (-railShift(t) >= (k - FOCUS0) * PITCH - PITCH / 2) CROSS.push([t, k++]);

function wrapLines(c, str, maxW) { const out = [''], words = str.split(' '); for (const w of words) { const l = out.at(-1), q = l ? l + ' ' + w : w; if (c.measureText(q).width > maxW && l) out.push(w); else out[out.length - 1] = q; } return out; }
function skillCard(c, i, x, y, lift, ring = true) {
  const [id, title, meta] = SKILLS[i];
  c.save(); c.translate(x + CW / 2, y + CH / 2); c.scale(1 + 0.035 * lift, 1 + 0.035 * lift); c.translate(-CW / 2, -CH / 2);
  c.save(); shadowed(c, (26 + 30 * lift) * S, (8 + 14 * lift) * S, 0.08 + 0.06 * lift); rrect(c, 0, 0, CW, CH, 20 * S); c.fillStyle = B.panel; c.fill(); c.restore();
  if (lift > 0 && ring) { rrect(c, 0, 0, CW, CH, 20 * S); c.strokeStyle = `rgba(217,72,28,${lift})`; c.lineWidth = 3 * S; c.stroke(); }
  c.textBaseline = 'alphabetic'; setF(c, 24 * S, 500); c.fillStyle = B.faint; c.fillText(String(i + 1).padStart(2, '0'), 32 * S, 54 * S);
  setF(c, 48 * S, 600); c.fillStyle = B.ink; c.fillText(id, 32 * S, 108 * S);
  c.fillStyle = B.rule; c.fillRect(32 * S, 134 * S, CW - 64 * S, 1.5 * S);
  setF(c, 34 * S, 400); c.fillStyle = B.dim; wrapLines(c, title, CW - 64 * S).slice(0, 2).forEach((l, j) => c.fillText(l, 32 * S, (190 + j * 44) * S));
  setF(c, 28 * S, 500); const mw = c.measureText(meta).width + 36 * S; rrect(c, 32 * S, CH - 76 * S, mw, 48 * S, 24 * S); c.fillStyle = B.raise; c.fill(); c.fillStyle = B.dim; c.fillText(meta, 50 * S, CH - 42 * S);
  c.restore();
}
function shotB(c, t) {
  bg(c, B.bg); const zk = lerp(1, 1.14, ease.emphasized(prog(t, CUT1 + 1.55, CUT2))); c.save(); c.translate(W / 2, H / 2); c.scale(zk, zk); c.translate(-W / 2, -H / 2);
  const sh = railShift(t), lift = ease.spring(prog(t, CUT1 + 1.85, CUT1 + 2.35), 0.2), y = H / 2 - CH / 2 + 30 * S;
  const held = ease.out(clamp((t - TG) / 0.08)) * (1 - ease.inOut(clamp((t - TR) / 0.15))); // the grabbed card lifts a little while it's held
  setF(c, 34 * S, 500); c.fillStyle = B.dim; c.textBaseline = 'middle'; c.globalAlpha = ease.expoOut(prog(t, CUT1 + 0.1, CUT1 + 0.5));
  c.fillText('9 skills', W / 2 - CW / 2, y - 50 * S); c.globalAlpha = 1;
  SKILLS.forEach((_, i) => { const x = W / 2 + (i - FOCUS0) * PITCH + sh - CW / 2; if (x > -CW - 40 * S && x < W + 40 * S) skillCard(c, i, x, y, i === HERO ? lift : i === FOCUS0 + 1 ? 0.5 * held : 0, i === HERO); });
  drawCursor(c, CUR_B(t)); c.restore();
}

// ---------- C. the claim, shown (4.5–6.5): the same orbit at 30 fps without blur | at 60 fps through a 180° shutter ----------
const ORBIT = 0.5, OR = 280 * S; // two turns a second: 3520 px/s, 59 px a frame at 60 fps, 117 at 30
// The dot, plus faint ghosts at the frames this rate actually shows over the last 0.12 s (4 at 30 fps, 7 at 60): the same diagram on both sides.
function orbitDot(c, cx, cy, t, k, rate) {
  c.strokeStyle = B.rule; c.lineWidth = 2 * S; c.beginPath(); c.arc(cx, cy, OR, 0, 7); c.stroke();
  c.fillStyle = B.ink; c.beginPath(); c.arc(cx, cy, 6 * S, 0, 7); c.fill();
  const at = u => (u / ORBIT) * 2 * Math.PI - Math.PI / 2, n = Math.round(0.12 * rate);
  for (let i = n; i >= 0; i--) { const u = t - i / rate, a = at(u); if (u < 0) continue; c.globalAlpha = i ? 0.2 * (1 - i / (n + 1)) : 1;
    c.fillStyle = B.accent; c.beginPath(); c.arc(cx + Math.cos(a) * OR, cy + Math.sin(a) * OR, 40 * S * k, 0, 7); c.fill(); }
  c.globalAlpha = 1;
}
function shotC(c, t) {
  bg(c, B.bg); c.save(); c.translate(0, -velCut(t, CUT3, V3)); // whip up into the end card
  const cy = H / 2 + 40 * S, e = j => ease.expoOut(prog(t, CUT2 + 0.05 + j * 0.07, CUT2 + 0.55 + j * 0.07));
  c.fillStyle = B.rule; c.fillRect(W / 2 - 1 * S, 90 * S, 2 * S, H - 180 * S);
  [[W / 4, '30 fps', 'no motion blur'], [(3 * W) / 4, '60 fps', 'motion blur']].forEach(([x, big, small], j) => {
    c.save(); c.globalAlpha = e(j); c.translate(0, (1 - e(j)) * 24 * S); c.textAlign = 'center'; c.textBaseline = 'middle';
    smoothText(c, big, x, 150 * S, { size: 56 * S, font: B.font, weight: 600, color: B.ink, align: 'center' }); smoothText(c, small, x, 204 * S, { size: 36 * S, font: B.font, weight: 400, color: B.dim, align: 'center' }); c.restore();
  });
  const k = ease.expoOut(prog(t, CUT2, CUT2 + 0.3));
  orbitDot(c, W / 4, cy, Math.floor((t - CUT2) * 30 + 1e-6) / 30, k, 30); // held on a 30 fps grid: every subframe of a frame sees the same place, so no blur
  orbitDot(c, (3 * W) / 4, cy, t - CUT2, k, 60);                        // continuous time: the shutter smears it as far as it moves
  c.restore();
}

// ---------- D. end card (6.5–9.0): rises at the cut's speed; the cursor presses Copy ----------
const X0 = W / 2 - 640 * S, BOX = { x: X0, y: H / 2 + 110 * S, w: 1280 * S, h: 100 * S }, COPY = { w: 190 * S, h: 68 * S };
COPY.x = BOX.x + BOX.w - COPY.w - 14 * S; COPY.y = BOX.y + (BOX.h - COPY.h) / 2;
const [CX, CY] = aimAt(COPY);
const CUR_D = cursorPath([{ t: 7.0, x: W * 0.92, y: H * 1.08 }, { t: 7.75, x: CX, y: CY, click: true }, { t: 8.45, x: CX + 70 * S, y: CY + 52 * S, out: true, hold: 0.05 }]);
const PRESS_D = CUR_D.clicks[0];
function shotD(c, t) {
  bg(c, B.bg); const dy = -velCut(t, CUT3, V3), st = j => ease.expoOut(prog(t, CUT3, CUT3 + 0.5 + j * 0.1)); // rises from below at the cut's speed
  c.save(); c.translate(0, dy);
  c.textBaseline = 'alphabetic'; smoothText(c, 'claude-s', X0 - 8 * S, H / 2 - 40 * S, { size: 184 * S, font: B.font, weight: 650, color: B.ink, spacing: -6 * S });
  c.save(); c.translate(0, (1 - st(1)) * 40 * S); smoothText(c, 'video skills for Claude Code', X0, H / 2 + 40 * S, { size: 46 * S, font: B.font, weight: 400, color: B.dim }); c.restore();
  c.save(); c.translate(0, (1 - st(2)) * 80 * S);
  rrect(c, BOX.x, BOX.y, BOX.w, BOX.h, 16 * S); c.fillStyle = B.raise; c.fill();
  smoothText(c, 'git clone https://github.com/Lokendrakushwah12/claude-s.git', BOX.x + 30 * S, BOX.y + BOX.h / 2, { size: 32 * S, font: B.font, weight: 500, color: B.ink, base: 'middle' }); c.textBaseline = 'middle';
  const pose = CUR_D(t), [, , hov] = magnet(pose, COPY), done = t >= PRESS_D + 0.03, q = ease.expoOut(prog(t, PRESS_D + 0.03, PRESS_D + 0.3));
  c.save(); c.translate(COPY.x + COPY.w / 2, COPY.y + COPY.h / 2); c.scale(1 - 0.05 * pose.press, 1 - 0.05 * pose.press);
  shadowed(c, 10 * S, 3 * S, 0.08 + 0.06 * hov); rrect(c, -COPY.w / 2, -COPY.h / 2, COPY.w, COPY.h, 12 * S); c.fillStyle = done ? B.accent : mix2(B.panel, B.raise, 0.6 * pose.press); c.fill(); c.shadowColor = 'transparent';
  setF(c, 30 * S, 600); c.textAlign = 'center'; c.fillStyle = done ? '#ffffff' : B.ink;
  if (!done) c.fillText('Copy', 0, 1 * S);
  else { c.fillText('Copied', 20 * S, 1 * S); c.strokeStyle = '#ffffff'; c.lineWidth = 3.5 * S; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(-72 * S, 0); c.lineTo(-72 * S + 7 * S * clamp(q * 2), 7 * S * clamp(q * 2)); if (q > 0.5) c.lineTo(-65 * S + 13 * S * (q - 0.5) * 2, 7 * S - 15 * S * (q - 0.5) * 2); c.stroke(); }
  c.restore(); c.restore();
  c.restore();
  drawCursor(c, pose);
}

window.VIDEO = {
  duration: END,
  audio: 'audio.wav',
  fonts: ['Inter:wght@400;500;600;650'],
  bed: { bpm: 120, chords: [[50, 57, 60, 65], [48, 55, 60, 64], [53, 57, 60, 64], [55, 59, 62, 67]], sections: [[0, 'groove', 0.5]],
    kick: { f0: 300, f1: 55, tau: 0.06, decay: 0.3 }, kick_pattern: [0, 2, 2.75] },
  blur: [[CUT1 - 0.15, CUT1 + 0.25, 16], [TG, TR + 0.5, 32], [TR + 0.5, TR + 1.0, 8], [CUT2, CUT3 + 0.3, 16]], // more subframes where things move fast
  mutes: [[4.0, 4.5]], // the beat before the comparison loses its bass; the kick on 4.5 is the re-entry
  sfx: [
    ...[...PROMPT].map((ch, i) => [TYPE0 + i / CPS, 'key_tap', 0.25]).filter((_, i) => PROMPT[i] !== ' '),
    [CUT1, 'sub_swell', 0.5, { dur: 0.8 }],                                      // the run building, stopping dead on the whip
    [CUT1 - 0.04, 'passby', 1.3, { dur: 0.4 }],                                   // the whip: a pass-by peaking just before the cut
    [TR - 0.02, 'swoosh', 0.9],                                                   // the rail let go
    ...CROSS.map(([t, k]) => [t, 'tick', 0.9 - 0.12 * (k - FOCUS0 - 1), { f: 5200 }]), // one tick per card crossing centre, softer as it slows
    [CUT1 + 2.05, 'paper', 0.5, { kind: 'tap' }],                                  // promo-video lifts
    [PRESS_A + 0.05, 'blip_pop', 0.3],                                             // Run becomes Running (the label, not the click)
    [CUT2, 'thud', 0.6],
    [CUT3, 'gap', 1, { dur: 0.5 }], [CUT3 - 0.03, 'whoosh', 1.0],            // silence before the payoff, then the whip up
    [CUT3, 'echo', 2.6, { n: 8, decay: 0.8 }], [CUT3, 'sub_boom', 0.42, { dur: END - CUT3, tau: 1.0 }],
    [PRESS_D + 0.05, 'blip_pop', 0.35],                                            // the button's label changing, not the click
  ],
  scenes: [
    { start: 0, end: CUT1, draw: (c, p, t) => shotA(c, t) },
    { start: CUT1, end: CUT2, draw: (c, p, t) => shotB(c, t) },
    { start: CUT2, end: CUT3, draw: (c, p, t) => shotC(c, t) },
    { start: CUT3, end: END, draw: (c, p, t) => shotD(c, t) },
  ],
};
