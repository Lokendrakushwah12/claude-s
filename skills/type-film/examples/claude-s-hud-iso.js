// Example film (demos/type-film.html). Needs data.js, written by claude-s-gen_data.py (as gen_data.py in the film folder:
// SKILLS=<claude-s checkout>/skills uv run gen_data.py), loaded before this file in index.html.
// claude-s: "Describe the video. Each video is written as code." A brand film for the repo, made with its own type-film skill.
// References and what was TAKEN from each (techniques only, never shots): docs/grammar.md. Banned list: docs/concept.md.
// Devices invented for this film (in no reference): a pitch skyline (the typed line draws the pitch of every key it
// sounds), seek(t) over the film's own timeline, a self contact sheet (the film reviews its own frames), sounds that draw
// their own waveforms as they play, a SKILL.md skyline (each skill grows to its real line count), world → mark (the
// skyline lowers into the logo) and a caret loop (the mark's record light becomes frame 0's caret).
// 120 BPM grid, beat 0.5 s. Every number on screen comes from data.js, which gen_data.py reads out of the repo.
const B = { ink: '#0B0B0C', bone: '#ECEAE4', mute: '#7A7872', dim: '#3A3936', line: '#2C2B28', red: '#FF3D2E', wash: '#1A1918', bar: '#5E5C57' };
Object.assign(TYPE, { display: 'Geist', ui: 'Geist', mono: 'Geist Mono', weight: 600, track: -0.04 });
const LOOKS = !location.search.includes('look=0');
const T = { type0: 0.15, gap: 0.068, code: 3.0, clock: 3.75, morph: 5.0, sheet: 5.5, push: 7.5, sounds: 8.0, skills: 10.5, lift: 10.6,
  build: 11.7, fold: 14.0, still: 14.7, hero: 15.0, url: 15.55, out: 17.45, end: 18.0 };
const FPS = 30, FRAMES = Math.round(T.end * FPS);
const fq = t => Math.floor(t * FPS + 1e-6) / FPS; // clocks read the frame's time, so subframe blur never smears a digit
const mono = (size, w = 400) => ({ size, weight: w, font: TYPE.mono, track: 0 });
const cwOf = size => tw(ctx, 'M', size, 400, TYPE.mono, 0); // mono advance
const pad3 = n => String(n).padStart(3, '0');

// ---------- 1. prompt: the line types itself; each key is a thock one step up its word's ladder, drawn as a bar above it ----------
const PROMPT = 'make a 20s launch promo for this repo', PRE = '› ';
const TYPE_CUES = (() => { let at = 0; return PROMPT.split(' ').flatMap((w, k) => { const q = typeCues(T.type0 + at * T.gap, w, T.gap, 760 + 90 * k, 110, 0.7); at += w.length + 1; return q; }); })();
const GLYPH_F = (() => { const m = {}; let i = 0, q = 0; for (const ch of PROMPT) { if (ch !== ' ') m[i] = TYPE_CUES[q++][3].f; i++; } return m; })(); // the picture reads the cue list
const P1 = { x: 0.1 * W, y: 0.8 * H, size: 62 * S };
const typedN = t => clamp(Math.floor((t - T.type0) / T.gap) + 1, 0, PROMPT.length) * (t >= T.type0);
const caretX = t => P1.x + (PRE.length + clamp((t - T.type0) / T.gap + 1, 0, PROMPT.length)) * cwOf(P1.size);
const camZ = t => 1 + 0.5 * Math.exp(-Math.max(0, t - T.type0) / 1.1);
// The caret in SCREEN space at time t of shot 1 (zoom camZ about the caret): frame 0's caret, which the film loops back to.
function caretRect(t) {
  const cw = cwOf(P1.size), z = camZ(t), ax = caretX(t), xc = P1.x + (PRE.length + typedN(t)) * cw, top = P1.y - P1.size * 0.74;
  return { x: ax + (xc - ax) * z, y: P1.y + (top - P1.y) * z, w: cw * 0.56 * z, h: P1.size * 0.9 * z, r: 0 };
}
function prompt(c, t) {
  bg(c, B.ink);
  const cw = cwOf(P1.size), n = typedN(t), z = camZ(t), ax = caretX(t), a = prog(t, 0.25, 0.55); // chrome fades in after frame 0 (loop)
  c.save(); cam(c, z, ax, P1.y);
  for (let i = 0; i < n; i++) { // the pitch skyline: one bar per sounded key, height = its frequency
    const f = GLYPH_F[i]; if (!f) continue;
    const age = t - (T.type0 + i * T.gap), g = spr(age, 520, 28), newest = i === n - 1 || (PROMPT[n - 1] === ' ' && i === n - 2), live = t < T.code - 0.05;
    const bx = P1.x + (PRE.length + i) * cw + cw * 0.14, full = ((f - 650) / 1100) * 0.42 * H, base = P1.y - P1.size * 1.05;
    c.fillStyle = live ? mixHex(B.red, B.bar, clamp(age / 0.3)) : B.bar; c.fillRect(bx, base - full * g, cw * 0.72, full * g); // red as it sounds, cooling to grey
    if (newest && live) ui(c, `${f} Hz`, bx, base - full - 18 * S, { ...mono(30 * S, 500), color: B.bone });
  }
  word(c, PRE, P1.x, P1.y, { ...mono(P1.size), color: B.mute, alpha: a });
  word(c, PROMPT.slice(0, n), P1.x + PRE.length * cw, P1.y, { ...mono(P1.size), color: B.bone });
  if (a > 0) ui(c, 'describe the video', P1.x + PRE.length * cw, P1.y + 70 * S, { ...mono(24 * S), color: B.mute, alpha: a });
  c.restore();
  const r = caretRect(t); c.fillStyle = B.red; c.fillRect(r.x, r.y, r.w, r.h);
}

// ---------- HUD chrome over shots 1–4: the real clock and frame count (ink while the ground is red) ----------
function hud(c, t) {
  const a = prog(t, 0.25, 0.55) * (1 - prog(t, T.fold, T.fold + 0.3)), onRed = t >= T.code && t < T.morph; if (a <= 0) return;
  ui(c, 'claude-s', 64 * S, 70 * S, { ...mono(20 * S, 500), color: onRed ? B.ink : B.bone, alpha: a });
  ui(c, `t ${fq(t).toFixed(2).padStart(5, '0')}   f ${pad3(Math.round(fq(t) * FPS))} / ${FRAMES}`, W - 64 * S, 70 * S, { ...mono(20 * S), color: onRed ? B.ink : B.mute, alpha: a, align: 'right' });
  cornerTicks(c, 40 * S, 40 * S, W - 80 * S, H - 80 * S, { color: onRed ? '#8F1F16' : B.dim, len: 22 * S, lw: 1.5 * S, p: a });
}

// ---------- 2. code, on the red field: the sentence becomes seek(t), over the film's own timeline ----------
const P2 = { y: 0.5 * H, size: 200 * S }, SCR = { per: 0.012, settle: 0.42 }; // every cell scrambles from the cut, then resolves
const RED_INK = 'rgba(11,11,12,0.55)';
const frameCell = (c, x, top, w, h) => { rrect(c, x + 4 * S, top + 4 * S, w - 8 * S, h - 8 * S, 10 * S); c.strokeStyle = RED_INK; c.lineWidth = 2 * S; c.stroke(); };
const hudO = start => ({ ...mono(P2.size, 500), ...SCR, color: B.ink, ground: '#9C2318', cell: frameCell, label: i => `f ${pad3(Math.floor((start + i * SCR.per + SCR.settle) * FPS))}` });
function numBox(t) { // where the live clock sits, in screen px
  const cw = cwOf(P2.size), s = spr(t - T.clock, 220, 26), xs = SH.x0;
  return { xs, s, x: xs + 5 * cw, y: P2.y - P2.size * 0.82, w: 4 * cw, h: P2.size * 1.02 };
}
// The film's timeline: a tick every 10 frames, seconds labelled, the playhead at the frame being drawn. ink/mid/head = colours.
function ruler(c, t, y, p, o = {}) {
  const { ink = B.mute, mid = B.dim, head = B.red, label = B.bone } = o, x0 = SH.x0, w = SH.W, px = x0 + (w * fq(t)) / T.end;
  c.fillStyle = mid; c.fillRect(x0, y, w * p, 1.5 * S);
  for (let f = 0; f <= FRAMES; f += 10) {
    const x = x0 + (w * f) / FRAMES, sec = f % 30 === 0; if (x > x0 + w * p) break;
    c.fillStyle = sec ? ink : mid; c.fillRect(x, y - (sec ? 22 : 10) * S, 1.5 * S, (sec ? 22 : 10) * S);
    if (sec) ui(c, String(f / 30), x, y + 34 * S, { ...mono(18 * S), color: ink, align: 'center' });
  }
  if (px > x0 + w * p) return;
  c.fillStyle = head; c.fillRect(x0, y - 0.5 * S, px - x0, 2.5 * S); c.fillRect(px - 1.5 * S, y - 62 * S, 3 * S, 68 * S);
  ui(c, `f ${pad3(Math.round(fq(t) * FPS))} / ${FRAMES}`, px + 12 * S, y - 44 * S, { ...mono(24 * S, 500), color: label });
}
function code(c, t) {
  const red = t < T.morph; bg(c, red ? B.red : B.ink); // the ground snaps back to ink on the beat the morph starts
  const cw = cwOf(P2.size), fade = 1 - prog(t, T.morph, T.morph + 0.2);
  c.save(); c.globalAlpha = fade;
  if (t < T.clock) glyphHud(c, 'seek(t)', SH.x0, P2.y, t - T.code, hudO(T.code));
  else {
    const b = numBox(t), live = fq(t).toFixed(2);
    word(c, 'seek(', b.xs, P2.y, { ...mono(P2.size, 500), color: B.ink });
    glyphHud(c, live, b.x, P2.y, t - T.clock, hudO(T.clock));
    word(c, ')', b.xs + lerp(6, 9, b.s) * cw, P2.y, { ...mono(P2.size, 500), color: B.ink });
  }
  words(c, 'Each video is written as code.', SH.x0, P2.y - 270 * S, t - (T.code + 0.45), { size: 52 * S, weight: 500, font: TYPE.ui, track: -0.02, color: B.ink, align: 'left' });
  c.restore();
  c.save(); c.globalAlpha = 1 - prog(t, T.sheet - 0.2, T.sheet); // the timeline stays through the morph
  ruler(c, t, P2.y + 210 * S, ease.out(prog(t, T.code + 0.25, T.code + 0.85)), red ? { ink: B.ink, mid: RED_INK, head: B.ink, label: B.ink } : {});
  c.restore();
  if (t >= T.morph) { // the clock's cell becomes the contact sheet's first cell (shape-match, no cut)
    const b = numBox(t), cell = sheetCell(0);
    morphMatch(c, { x: b.x, y: b.y, w: b.w, h: b.h, r: 10 * S }, { ...cell, r: 4 * S }, prog(t, T.morph, T.sheet), { stroke: B.bone, lw: 2 * S });
  }
}

// ---------- 3. sheet: the film reviews its own frames, named the way render.mjs --still names them ----------
const SH = { cols: 6, rows: 3, w: 236 * S, gap: 18 * S, rowGap: 56 * S, y0: 310 * S };
SH.h = (SH.w * 9) / 16; SH.W = SH.cols * SH.w + (SH.cols - 1) * SH.gap; SH.x0 = (W - SH.W) / 2;
const N_CELLS = SH.cols * SH.rows, cellT = i => (i === N_CELLS - 1 ? T.sounds : Math.round((0.3 + i * 0.29) * 10) / 10);
const stillName = tt => `t${tt.toFixed(1).padStart(5, '0')}.png`;
function sheetCell(i) { const col = i % SH.cols, row = Math.floor(i / SH.cols); return { x: SH.x0 + col * (SH.w + SH.gap), y: SH.y0 + row * (SH.h + SH.rowGap), w: SH.w, h: SH.h }; }
const PICKS = [[6.6, 2], [6.85, 9], [7.1, 15], [7.3, N_CELLS - 1]], CELL_GAP = 0.025;
function sheet(c, t, self) {
  bg(c, B.ink);
  const last = sheetCell(N_CELLS - 1), e = ease.in(prog(t, T.push, T.sounds)), z = (W / SH.w) ** e;
  const fx = (last.x * W) / (W - SH.w), fy = (last.y * H) / (H - SH.h); // the point that stays put while the last cell grows to the frame
  c.save(); cam(c, z, fx, fy);
  const hdr = 1 - prog(t, T.push, T.push + 0.2);
  words(c, 'rendered frame-exact in headless Chrome', SH.x0, SH.y0 - 70 * S, t - (T.sheet + 0.1), { size: 46 * S, weight: 500, font: TYPE.ui, track: -0.02, color: B.bone, align: 'left', alpha: hdr });
  ui(c, `review/ · ${N_CELLS} stills`, SH.x0 + SH.W, SH.y0 - 70 * S, { ...mono(24 * S), color: B.mute, align: 'right', alpha: hdr * prog(t, T.sheet + 0.4, T.sheet + 0.7) });
  for (let i = 0; i < N_CELLS; i++) {
    const at = T.sheet + i * CELL_GAP; if (t < at) continue;
    const r = sheetCell(i), tt = cellT(i);
    c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip(); c.translate(r.x, r.y); c.scale(r.w / W, r.h / H); drawAt(c, tt, self); c.restore();
    const edge = i === N_CELLS - 1 ? 1 - e : 1;
    c.globalAlpha = edge; c.strokeStyle = B.line; c.lineWidth = 1.5 * S; c.strokeRect(r.x, r.y, r.w, r.h);
    ui(c, stillName(tt), r.x, r.y + r.h + 30 * S, { ...mono(20 * S), color: i === N_CELLS - 1 ? B.bone : B.mute, alpha: edge }); c.globalAlpha = 1;
  }
  const k = PICKS.filter(p => t >= p[0]).length; // the review's selection, stepping to the frame that isn't rendered yet
  if (k) {
    const a = sheetCell(PICKS[Math.max(0, k - 2)][1]), b = sheetCell(PICKS[k - 1][1]), s = spr(t - PICKS[k - 1][0], 320, 28);
    c.strokeStyle = B.red; c.lineWidth = 4 * S; c.globalAlpha = 1 - e; c.strokeRect(lerp(a.x, b.x, s) - 6 * S, lerp(a.y, b.y, s) - 6 * S, SH.w + 12 * S, SH.h + 12 * S); c.globalAlpha = 1;
  }
  c.restore();
}

// ---------- 4. sounds: a sound's name lights, it plays, and its real waveform draws itself under the name at real speed ----------
const PLAYS = ['thock', 'ui_blip', 'blip_pop', 'heartbeat', 'tom', 'riffle', 'page_turn']; // in list order; all at their defaults
const PLAY_T = PLAYS.map((_, k) => +(T.sounds + 0.4 + k * 0.29).toFixed(3));
const P4 = { x: 0.42 * W, y0: 0.31 * H, w: 0.52 * W, size: 28 * S, lh: 70 * S, pxs: 400 * S }; // pxs: waveform px per second
let FLOW; // name -> { x, y, w } in the text flow, laid out once
function flow() {
  if (FLOW) return FLOW; FLOW = {}; const sp = cwOf(P4.size); let x = P4.x, y = P4.y0;
  for (const n of DATA.sounds) { const w = n.length * sp; if (x + w > P4.x + P4.w) { x = P4.x; y += P4.lh; } FLOW[n] = { x, y, w }; x += w + sp * 2.5; }
  return FLOW;
}
function waveform(c, name, x, y, p, color) { // the sound's own envelope, mirrored, drawn to fraction p of its duration
  const wv = DATA.wave[name], n = wv.env.length, w = wv.dur * P4.pxs, bw = w / n; c.fillStyle = color;
  for (let i = 0; i < Math.floor(n * clamp(p)); i++) { const h = Math.max(1.5 * S, wv.env[i] ** 0.6 * 21 * S); c.fillRect(x + i * bw, y - h, Math.max(1, bw * 0.62), h * 2); }
}
function sounds(c, t) {
  bg(c, B.ink);
  const F = flow(), k = PLAY_T.filter(x => t >= x).length - 1;
  words(c, "Sound is synthesised, so there's no stock audio.", 0.08 * W, 0.17 * H, t - (T.sounds + 0.05), { size: 48 * S, weight: 500, font: TYPE.ui, track: -0.02, color: B.bone, align: 'left' });
  const n = DATA.sounds.length, v = n * ease.out(prog(t, T.sounds + 0.1, T.sounds + 1.1));
  counter(c, v, 0.08 * W, 0.44 * H, { size: 280 * S, font: TYPE.display, weight: 600, color: B.bone, align: 'left', commas: false });
  ui(c, 'sounds in sfx.py', 0.08 * W + 8 * S, 0.57 * H, { ...mono(28 * S), color: B.mute });
  if (k >= 0) {
    const name = PLAYS[k];
    c.fillStyle = B.red; c.beginPath(); c.arc(0.08 * W + 16 * S, 0.7 * H - 18 * S, 13 * S, 0, 7); c.fill();
    ui(c, name, 0.08 * W + 48 * S, 0.7 * H, { ...mono(52 * S, 500), color: B.bone });
    ui(c, `${DATA.params[name] || 'defaults'} · ${Math.round(DATA.wave[name].dur * 1000)} ms`, 0.08 * W + 48 * S, 0.7 * H + 56 * S, { ...mono(34 * S), color: B.mute });
  }
  for (const nm of DATA.sounds) { // the whole list as a flow; played names light up, the one playing now brightest
    const f = F[nm], j = PLAYS.indexOf(nm), lit = j >= 0 && j <= k;
    ui(c, nm, f.x, f.y, { ...mono(P4.size, lit ? 500 : 400), color: j === k ? B.bone : lit ? '#B9B7B0' : B.dim });
    if (lit) waveform(c, nm, f.x, f.y + 30 * S, (t - PLAY_T[j]) / DATA.wave[nm].dur, j === k ? B.red : B.mute);
  }
}

// ---------- 5–8. skills: the folder lifts, each skill grows to its SKILL.md length, it folds into the mark, the mark loops ----------
const CW = 12, CH = 6.75, GAP = 2.5, GRID_W = 3 * CW + 2 * GAP, GRID_H = 3 * CH + 2 * GAP; // 16:9 frames: the mark is a contact sheet
const BACK_TO_FRONT = [0, 1, 3, 2, 4, 6, 5, 7]; // cells by depth at az 45, so the tallest stand at the back
const CELLS = (() => {
  const rest = DATA.skills.filter(s => s !== 'type-film').sort((a, b) => DATA.lines[b] - DATA.lines[a]), at = {};
  BACK_TO_FRONT.forEach((cell, k) => (at[cell] = rest[k]));
  return Array.from({ length: 9 }, (_, i) => {
    const col = i % 3, row = Math.floor(i / 3), x = col * (CW + GAP), y = row * (CH + GAP), name = i === 8 ? 'type-film' : at[i];
    return { i, x, y, name, h: name ? DATA.lines[name] / 18 : 0.5, ring: i === 8 ? ISO.circle(x + CW / 2, y + CH / 2, CH / 2) : ISO.rrect(x, y, x + CW, y + CH, 1.6) };
  });
})();
const VISIT = [...BACK_TO_FRONT, 8].filter(i => CELLS[i].name); // a sweep from the back corner to the record light at the front
const BUILD = VISIT.map((_, k) => +(T.build + k * 0.25).toFixed(3)), LAND = BUILD.map(b => +(b + 0.2).toFixed(3)); // spring 400/26 peaks ~0.2 s in
const growOf = (t, k) => spr(t - BUILD[k], 400, 26);
const NOTES = [76, 79, 81, 83, 86, 88, 91, 93, 95];
const MARK = { cy: 0.47 * H, S: 5.6 * S };
function lockupX(c) { const ww = tw(c, 'claude-s', 170 * S, 600, TYPE.display, -0.045), mw = GRID_W * MARK.S, gap = 64 * S; return (W - (mw + gap + ww)) / 2; }
function camAt(c, t) { // lift from the plan, fold back to it at the centre at 2×, then slide into the lockup on the hero beat
  const up = ISO.tween(t, T.lift, 1.2), down = ease.inOut(prog(t, T.fold, T.still)), slide = spr(t - T.hero, 320, 36), p = up * (1 - down);
  const cx = lerp(lerp(0.58 * W, W / 2, down), lockupX(c) + (GRID_W / 2) * MARK.S, slide), cy = lerp(0.57 * H, MARK.cy, down);
  const sc = lerp(lerp(24 * S * (1 + 0.04 * up), 2 * MARK.S, down), MARK.S, slide);
  return { C: ISO.lift(p, { from: { az: 0, el: 90 }, to: { az: 45, el: 32 }, S: sc, at: [GRID_W / 2, GRID_H / 2, 0], cx, cy }), p, down };
}
function skillName(c, C, cell, z, color, alpha) { // the skill's name printed on its top face, split at its last hyphen
  const k = cell.name.lastIndexOf('-'), lines = k > 0 ? [cell.name.slice(0, k + 1), cell.name.slice(k + 1)] : [cell.name];
  const rec = cell.i === 8, len = Math.max(...lines.map(l => l.length)), size = rec ? 1.05 : Math.min(1.35, (CW - 2) / (len * 0.6));
  const o = rec ? [cell.x + CW / 2 - (len * 0.6 * size) / 2, cell.y + CH / 2 - (lines.length * size * 1.25) / 2 + 0.1] : [cell.x + 1, cell.y + 0.9];
  ISO.face(c, C, [...o, z], [1, 0, 0], [0, 1, 0], x => {
    x.globalAlpha *= alpha; x.font = `500 ${size}px "${TYPE.mono}"`; x.letterSpacing = '0px'; x.fillStyle = color; x.textBaseline = 'top';
    lines.forEach((l, j) => x.fillText(l, 0, j * size * 1.25));
  });
}
function skills(c, t) {
  bg(c, B.ink);
  const { C, down } = camAt(c, t), grow = ease.out(prog(t, T.lift, T.lift + 1.2)), cur = BUILD.filter(x => t >= x).length - 1;
  const outA = 1 - prog(t, T.out + 0.1, T.out + 0.3), morph = prog(t, T.out + 0.17, T.end - 0.08), names = 1 - prog(t, T.fold, T.fold + 0.35);
  const items = CELLS.map(cell => {
    const k = VISIT.indexOf(cell.i), g = k >= 0 ? growOf(t, k) : 0, plate = 0.35 * grow; // a plate until its turn, then it grows to its length
    return { ...cell, x: cell.x + CW / 2, y: cell.y + CH / 2, z: 0, k, top: (plate + (cell.h - plate) * g) * (1 - down), visited: k >= 0 && t >= BUILD[k] };
  });
  for (const it of ISO.order(C, items)) {
    const cell = CELLS[it.i], now = it.k >= 0 && it.k === cur && t < T.fold, rec = cell.i === 8, hot = rec && it.visited;
    const edge = mixHex(now ? B.bone : it.visited ? '#8E8C86' : '#55534E', B.bone, down), lw = lerp(now ? 2.4 : 1.6, 2.2, down) * S;
    if (rec && morph > 0) continue; // the record light leaves the grid and becomes the caret (drawn below)
    c.save(); c.globalAlpha = rec ? 1 : outA;
    if (!cell.name && down < 1) c.setLineDash([6 * S, 6 * S]); // an open slot (a skill folder without a SKILL.md yet): dashed until it becomes the mark
    ISO.slab(c, C, cell.ring, 0, it.top, { top: hot ? B.red : now ? B.wash : B.ink, side: hot ? '#7A1A12' : '#141413', edge: hot ? B.red : edge, lw });
    c.restore();
    if (cell.name && names > 0) skillName(c, C, cell, it.top, hot ? B.ink : now ? B.bone : B.mute, names);
  }
  const ha = prog(t, T.skills + 0.1, T.skills + 0.4) * (1 - prog(t, T.fold, T.fold + 0.25)); // HUD: which skill, and its real length
  if (ha > 0) {
    const nm = cur >= 0 ? CELLS[VISIT[cur]].name : null;
    ui(c, 'skills/', 110 * S, 170 * S, { ...mono(28 * S), color: B.mute, alpha: ha });
    ui(c, `${pad3(Math.max(0, cur + 1)).slice(1)} / ${String(DATA.skills.length).padStart(2, '0')} skills`, W - 110 * S, 170 * S, { ...mono(32 * S), color: B.mute, align: 'right', alpha: ha });
    if (nm) {
      word(c, nm, 110 * S, 245 * S, { size: 64 * S, weight: 600, color: B.bone, alpha: ha });
      word(c, String(Math.round(DATA.lines[nm] * clamp(growOf(fq(t), cur) / 0.98))), 104 * S, 420 * S, { size: 150 * S, weight: 600, color: B.bone, alpha: ha });
      ui(c, 'lines in SKILL.md', 112 * S, 470 * S, { ...mono(28 * S), color: B.mute, alpha: ha });
    }
  }
  if (t >= T.hero) { // lockup: the mark slides in on the hero beat and the wordmark rises beside it
    const x0 = lockupX(c), wx = x0 + GRID_W * MARK.S + 64 * S, by = MARK.cy + 61 * S, wa = 1 - prog(t, T.out + 0.05, T.out + 0.2);
    c.save(); c.globalAlpha = wa; riseChars(c, 'claude-s', wx, by, t - T.hero - 0.07, { size: 170 * S, weight: 600, track: -0.045, color: B.bone, gap: 0.018, k: 420, d: 34 }); c.restore();
    words(c, 'Skills that let Claude make and edit videos.', x0, MARK.cy + 205 * S, t - (T.hero + 0.35), { size: 44 * S, weight: 400, font: TYPE.ui, track: -0.01, color: B.mute, align: 'left', out: T.out - (T.hero + 0.35) });
    const n = Math.round(clamp((t - T.url) / URL_GAP, 0, URL.length)) - Math.max(0, Math.floor((t - T.out) * 200));
    if (n > 0) ui(c, URL.slice(0, n), x0, MARK.cy + 275 * S, { ...mono(38 * S, 500), color: B.bone });
    c.save(); c.globalAlpha = 1 - prog(t, T.out, T.out + 0.15); ruler(c, t, 0.88 * H, ease.out(prog(t, T.hero + 0.3, T.hero + 0.9)), { label: B.mute }); c.restore();
  }
  if (morph > 0) { // caret loop: the record light becomes frame 0's caret, same size, same place
    const it = items.find(q => q.i === 8), [px, py] = ISO.P(C, it.x, it.y, 0), r = (CH / 2) * C.S;
    morphMatch(c, { x: px - r, y: py - r, w: 2 * r, h: 2 * r, r }, caretRect(0), ease.inOut(morph), { color: B.red });
  }
}
const URL = 'github.com/Lokendrakushwah12/claude-s · MIT', URL_GAP = 0.6 / URL.length;
const URL_CUES = [0, URL.indexOf('/'), URL.lastIndexOf('/'), URL.indexOf('·')].map((i, k) => [+(T.url + i * URL_GAP).toFixed(3), 'thock', 0.4, { f: [1568, 1319, 1175, 988][k] }]); // a key per segment, falling

window.VIDEO = {
  duration: T.end,
  audio: 'audio.wav',
  fonts: ['Geist:wght@400;500;600', 'Geist Mono:wght@400;500'],
  drone: { hum: 50, whine: 7812, gain: 0.5 },
  lufs: -16,
  sfx: [
    ...TYPE_CUES,                                                                   // 1: the prompt's ladder (the Enter press is silent)
    [T.code, 'ticks', 0.9, { n: 9, gap: 0.016 }], [T.code, 'thump', 0.45], ...scrambleCues(T.code, 'seek(t)', 0.5, SCR), // 2: cut ON the burst, into red
    [+(T.code + SCR.per * 6 + SCR.settle).toFixed(3), 'ui_blip', 0.55, { f: 1319 }], ...scrambleCues(T.clock, '0.00', 0.4, SCR), [+(T.clock + SCR.per * 3 + SCR.settle).toFixed(3), 'ui_blip', 0.45, { f: 1568 }],
    [T.sheet - 0.05, 'whoosh', 0.35],                                               // 3: the morph, then the sheet
    [T.sheet + 0.02, 'dot_ticks', 0.55, { n: N_CELLS - 1, gap: CELL_GAP }], ...PICKS.map(([at]) => [at, 'tick', 0.6]),
    [T.sounds - 0.05, 'passby', 0.7],                                               // the push peaks 50 ms before the cut
    ...PLAYS.map((n, k) => [PLAY_T[k], n, 0.8]),                                    // 4: each lit name plays itself
    [T.skills, 'sub_boom', 0.5], [T.lift, 'swell', 0.22],                           // 5: hard cut into the world; swell under the lift
    ...LAND.map((at, k) => [at, 'clink', 0.75, { f: Math.round(440 * 2 ** ((NOTES[k] - 69) / 12)) }]), // foley: tiles landing
    [T.still, 'sub_swell', 0.7, { dur: 0.7 }], [T.still, 'suck_in', 0.45, { dur: 0.6 }], [T.hero, 'gap', 1, { dur: T.hero - T.still }], // 6: dry builds, then silence
    [T.hero, 'sub_drop', 0.55], [T.hero, 'sting', 0.8, { notes: [76, 83] }],        // 7: the mark slides in, the wordmark rises
    ...URL_CUES,                                                                    // the URL's keys fall (the opening's rose)
  ],
  overlay(c, t) { if (LOOKS) applyLook(c, t, null, { bloom: 0.3, rgbSplit: 0.1, vignette: 0.32, grain: 0.035 }); },
  scenes: [
    { start: 0, end: T.code, draw: (c, p, t) => prompt(c, t) },
    { start: T.code, end: T.sheet, draw: (c, p, t) => code(c, t) },
    { start: T.sheet, end: T.sounds, draw(c, p, t) { sheet(c, t, this); } },
    { start: T.sounds, end: T.skills, draw: (c, p, t) => sounds(c, t) },
    { start: T.skills, end: T.end, draw: (c, p, t) => skills(c, t) },
    { start: 0, end: T.fold + 0.3, draw: (c, p, t) => hud(c, t) },
  ],
};
