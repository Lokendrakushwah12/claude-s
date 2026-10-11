// Example: i18n.doctor · a 12.5 s, 60 fps launch promo (demos/promo-video.html), the proof piece for the 2026-10-11b look upgrade.
// Render: node render.mjs --cues && uv run sfx.py && node render.mjs --smooth --out final.mp4. It shows the API; never re-skin it.
// Shows: ground() on dark, light and brand-colour grounds; headline() in three voices; card() and pill({ dot, shadow }); a depth field of
// the product's own keys on three planes that implodes into the logo's dot; type.js iris() out of it; hudFrame labels; one card that
// pastes, scans, reframes into a report, counts (counter roll: false), fixes under a 1.4x push and docks a toast; the end card spec.
// Brand, copy and numbers from the repo (~/PersonalFiles/i18n-doctor): favicon.svg, globals.css, messages/*.json, the public Recent Scans.
const B = { bg: '#fafafa', ink: '#18181b', dim: '#52525c', faint: '#a1a1aa', rule: '#e4e4e7', primary: '#c46849', rust: '#b75f41', sel: '#f2e4dc',
  ok: '#00bc7d', okFg: '#007a55', warn: '#fe9a00', warnFg: '#bb4d00', bad: '#fb2c36', dark: '#09090b', dcard: '#18181b', sky: '#00a6f4', font: 'Fustat', mono: 'Geist Mono' };
const T_OUT = 1.5, T_IMP = 1.56, T_DOT = 1.9, T_IRIS = 2.15;                       // hook → iris
const T_FIELD = 2.7, T_PASTE = 2.92, T_SCAN = 3.38, CUT_C = 4.45;                    // paste + scan
const T_FIX = 6.4, T_FIXED = 7.15, T_PRBTN = 7.3, T_PR = 7.75, T_TOAST = 7.95, CUT_D = 8.6; // report, fix, PR
const T_DROP = CUT_D + 0.22, T_RUST = CUT_D + 0.42, T_LAND = CUT_D + 0.75, END = 12.5;    // end card
const mix2 = (a, b, k) => '#' + [1, 3, 5].map(i => Math.round(lerp(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), clamp(k))).toString(16).padStart(2, '0')).join('');
const F = (c, size, weight = 500, font = B.font) => { c.font = `${weight} ${size}px "${font}"`; c.letterSpacing = '0px'; };
const aim = r => aimAt(r, 0.86, 0.8); // lower-right quarter of a wide button, so the arrow never covers its label

// ---------- the brackets: the logo's four rounded corners around a dot, at any size (logo ↔ frame) ----------
function brackets(c, x, y, w, h, arm, lw, color) {
  const r = Math.min(arm * 0.45, lw * 1.5);
  c.save(); c.strokeStyle = color; c.lineWidth = lw; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    c.moveTo(cx + sx * arm, cy); c.arcTo(cx, cy, cx, cy + sy * arm, r); c.lineTo(cx, cy + sy * arm);
  }
  c.stroke(); c.restore();
}
const LOGO = 150 * S;
const FRAME = { x: 30 * S, y: 30 * S, w: W - 60 * S, h: H - 60 * S, arm: 34 * S, lw: 3 * S };
const MARK_D = { x: W / 2 - 545 * S, y: 330 * S, s: 150 * S }; // the end card's mark
const markRect = (s, cx, cy) => ({ x: cx - s / 2, y: cy - s / 2, w: s, h: s, arm: s * 0.31, lw: s * 0.094 });
const lerpR = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), arm: lerp(a.arm, b.arm, k), lw: lerp(a.lw, b.lw, k) });
const MARK_C = [W / 2, H / 2 - 30 * S]; // where the brackets close and the end card's iris opens (then the mark slides into the lock-up)
function bracketRect(t) {
  const m0 = markRect(LOGO, W / 2, H / 2), m1 = markRect(MARK_D.s, ...MARK_C), m2 = markRect(MARK_D.s, MARK_D.x + MARK_D.s / 2, MARK_D.y + MARK_D.s / 2);
  if (t < T_IRIS) { const s = 1 + 0.6 * (1 - ease.spring(prog(t, T_DOT, T_DOT + 0.3), 0.25)); return markRect(LOGO * s, W / 2, H / 2); }
  if (t < CUT_D) return lerpR(m0, FRAME, ease.emphasized(prog(t, T_IRIS, T_IRIS + 0.55)));
  if (t < T_LAND) return lerpR(FRAME, m1, ease.emphasized(prog(t, CUT_D, CUT_D + 0.4)));
  return lerpR(m1, m2, ease.emphasized(prog(t, T_LAND, T_LAND + 0.4)));
}

// ---------- A. the hook (0-2.15): translation keys on three depth planes, then they implode into the logo's dot ----------
const KEYS = ['site.title', 'site.tagline', 'hero.badge', 'hero.heading', 'hero.placeholder', 'hero.cta', 'hero.hint', 'steps.paste.title',
  'steps.report.title', 'steps.fix.title', 'steps.fix.description', 'nav.dashboard', 'nav.newScan', 'nav.leaderboard', 'nav.signIn', 'nav.signOut',
  'dashboard.title', 'dashboard.searchPlaceholder', 'dashboard.sortCoverageDesc', 'dashboard.empty', 'dashboard.noMatch', 'newScan.hint',
  'recentScans.title', 'footer.copyright', 'notFound.heading', 'notFound.cta', 'de.json', 'ja.json', 'zh.json', 'fr.json', 'es.json',
  'Repo scannen', 'リポジトリをスキャン', '扫描仓库', 'Analyser le dépôt', 'Escanear repo', 'Mit einem Klick beheben', 'ワンクリックで修正', '一键修复', 'Corrigez en un clic']; // messages/*.json
const PLANES = [0.32, 1.5, -0.42]; // focus (sharp), far (small, soft), near (big, soft)
const CHIPS = (() => { const r = rng(11), out = []; let i = 0;
  for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 8; gx++) { // a jittered 8x5 grid, so every quadrant has sharp keys
    const z = PLANES[(gx + gy * 2) % 3], x = ((gx + 0.5 + (r() - 0.5) * 0.7) / 8) * W, y = ((gy + 0.5 + (r() - 0.5) * 0.6) / 5) * H;
    if (Math.abs(y - H * 0.47) < H * 0.2 && Math.abs(x - W / 2) < W * 0.36 && z > 0) continue; // keep the headline clear
    out.push({ k: KEYS[i++ % KEYS.length], x, y, z, rot: (r() - 0.5) * 0.2, vx: (r() - 0.5) * 34 * S, vy: (r() - 0.5) * 18 * S, dot: r() < 0.3 ? B.bad : r() < 0.55 ? B.warn : '#52525c', d: r() * 0.12 });
  }
  return out; })();
function chip(c, k, x, y, dot, rot) {
  F(c, 26 * S, 400, B.mono); const w = c.measureText(k).width + 78 * S, h = 58 * S;
  c.save(); c.translate(x, y); c.rotate(rot); card(c, -w / 2, -h / 2, w, h, { fill: B.dcard, r: 12 * S, blur: 24 * S });
  c.fillStyle = dot; c.beginPath(); c.arc(-w / 2 + 26 * S, 0, 6 * S, 0, 7); c.fill();
  c.fillStyle = '#d4d4d8'; c.textBaseline = 'middle'; c.fillText(k, -w / 2 + 46 * S, 1 * S); c.restore();
}
function shotA(c, t) {
  ground(c, t, { base: B.dark, blooms: [[B.primary, 0.5, 0.6, 0.45, 0.17], ['#3f3f46', 0.12, 0.08, 0.5, 0.25]], lattice: 'dots', cell: 48 * S });
  const cam = { x: 0, y: 0, z: lerp(-0.12, 0.2, ease.smooth(prog(t, 0, T_IMP))), focus: 0.32 };
  [...CHIPS].sort((a, b) => b.z - a.z).forEach(p => {
    const u = ease.expoIn(prog(t, T_IMP + p.d, T_DOT + p.d * 0.5)), z = lerp(p.z, 0.32, u), room = 1 + z - cam.z;
    if (room < 0.3 || u >= 0.98) return;
    const x = lerp(p.x + p.vx * t, W / 2, u), y = lerp(p.y + p.vy * t, H / 2, u), s = lerp(1, 0.08, u);
    c.save(); c.globalAlpha = (1 - u * 0.6) * clamp((room - 0.3) / 0.2);
    depthLayer(c, cam, z, cc => { cc.translate(x, y); cc.scale(s, s); chip(cc, p.k, 0, 0, p.dot, p.rot * (1 - u)); }, { dof: 9 * S }); c.restore();
  });
  // headline already landing on frame 0 (readable by frame 6), then out fast (blur up) before the implode
  const out = ease.in(prog(t, T_OUT, T_OUT + 0.16)); c.save(); c.globalAlpha = 1 - out; if (out > 0) c.filter = `blur(${out * 16 * S}px)`; c.translate(0, -out * 30 * S);
  headline(c, ['LOCALIZATION HEALTH SCANNER'], W / 2, H / 2 - 150 * S, { font: B.mono, size: 24 * S, weight: 500, track: 0.32, color: '#e8a38a', align: 'center', t: t + 0.3 });
  headline(c, ['New UI strings go'], W / 2, H / 2 + 6 * S, { font: B.font, size: 150 * S, weight: 700, color: '#fafafa', align: 'center', t: t + 0.32, track: -0.04 });
  headline(c, [['untranslated.', { color: '#e8a38a', underline: B.primary }]], W / 2, H / 2 + 166 * S, { font: B.font, size: 150 * S, weight: 700, align: 'center', t: t + 0.1, dur: 0.5, track: -0.04 });
  c.restore();
  const dk = ease.expoOut(prog(t, T_DOT - 0.12, T_DOT + 0.1)), dr = LOGO * 0.1875 * dk;
  if (dk > 0) { glow(c, W / 2, H / 2, 160 * S * dk, B.primary, 0.55); c.fillStyle = '#fafafa'; c.beginPath(); c.arc(W / 2, H / 2, dr, 0, 7); c.fill(); }
}

// ---------- B + C. one light world, one card: centred to paste and scan, then it reframes right and grows into the report ----------
const URL = 'github.com/calcom/cal.com';
const STEPS = ['Fetching repository info…', 'Building file tree…', 'Detecting locale files…', 'Parsing translations…', 'Comparing locales…'];
const stepDone = i => T_SCAN + 0.15 + i * 0.15;
const lightGround = (c, t, ox = 0) => ground(c, t, { base: '#f7f4f2', blooms: [[B.sel, 0.7, 0.42, 0.6, 0.9], [B.primary, 0.74, 0.5, 0.32, 0.08], ['#ffffff', 0.12, 0.2, 0.5, 0.6]], lattice: 'grid', cell: 64 * S, ox });
const reframe = t => ease.spring(prog(t, CUT_C, CUT_C + 0.65), 0.1);              // centred → two columns
const RECT_IN = { x: W / 2 - 590 * S, y: 520 * S, w: 1180 * S, h: 132 * S };       // the paste bar, centred and big
const RECT_SCAN = { x: W / 2 - 590 * S, y: 470 * S, w: 1180 * S, h: 500 * S };
const RECT_REP = { x: 905 * S, y: 175 * S, w: 860 * S, h: 730 * S };
function cardRect(t) {
  const a = ease.spring(prog(t, T_SCAN, T_SCAN + 0.5), 0.15), b = reframe(t), r0 = { x: RECT_IN.x, y: lerp(RECT_IN.y, RECT_SCAN.y, a), w: RECT_IN.w, h: lerp(RECT_IN.h, RECT_SCAN.h, a) };
  return { x: lerp(r0.x, RECT_REP.x, b), y: lerp(r0.y, RECT_REP.y, b), w: lerp(r0.w, RECT_REP.w, b), h: lerp(r0.h, RECT_REP.h, b) };
}
const FIELD = r => ({ x: r.x + 28 * S, y: r.y + 28 * S, w: r.w - 56 * S - 250 * S, h: 76 * S });
const SCANB = r => ({ x: r.x + r.w - 28 * S - 236 * S, y: r.y + 28 * S, w: 236 * S, h: 76 * S });
const FIXB = r => ({ x: r.x + 32 * S, y: r.y + r.h - 32 * S - 76 * S, w: 340 * S, h: 76 * S });
let CUR; // the cursor's beats, built on first use (below)

function inputBar(c, r, t, a) {
  if (a <= 0) return; c.save(); c.globalAlpha *= a; const f = FIELD(r), focus = t >= T_FIELD + 0.2;
  rrect(c, f.x, f.y, f.w, f.h, 14 * S); c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = focus && t < T_SCAN ? B.primary : B.rule; c.lineWidth = 2 * S; c.stroke();
  if (focus && t < T_SCAN) { c.save(); c.strokeStyle = 'rgba(196,104,73,0.18)'; c.lineWidth = 6 * S; rrect(c, f.x - 3 * S, f.y - 3 * S, f.w + 6 * S, f.h + 6 * S, 16 * S); c.stroke(); c.restore(); }
  F(c, 32 * S, 400, B.mono); c.textBaseline = 'middle'; const tx = f.x + 28 * S, ty = f.y + f.h / 2 + 1 * S, pasted = t >= T_PASTE;
  if (!pasted) { c.fillStyle = B.faint; c.fillText('https://github.com/owner/repo', tx, ty); }
  else { const sel = 1 - ease.out(prog(t, T_PASTE + 0.12, T_PASTE + 0.4)), w = c.measureText(URL).width; // pasted whole, selected for a beat
    if (sel > 0) { c.fillStyle = `rgba(196,104,73,${0.22 * sel})`; c.fillRect(tx - 4 * S, f.y + 16 * S, w + 8 * S, f.h - 32 * S); }
    c.fillStyle = B.ink; c.fillText(URL, tx, ty); }
  if (focus && t < T_SCAN && Math.floor((t - T_FIELD) * 2.5) % 2 === 0) { const cw = pasted ? c.measureText(URL).width : 0; c.fillStyle = B.primary; c.fillRect(tx + cw + 3 * S, f.y + 20 * S, 3 * S, f.h - 40 * S); }
  const b = SCANB(r), pose = CUR(t), [, , hov] = magnet(pose, b), scanning = t >= T_SCAN, pr = scanning && t < T_SCAN + 0.3 ? pose.press : 0;
  c.save(); c.translate(b.x + b.w / 2, b.y + b.h / 2); c.scale(1 - 0.05 * pr, 1 - 0.05 * pr);
  rrect(c, -b.w / 2, -b.h / 2, b.w, b.h, 14 * S); c.fillStyle = mix2(B.primary, B.ink, 0.12 * hov + 0.2 * pr); c.fill();
  F(c, 30 * S, 600); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.fillText(scanning ? 'Scanning…' : 'Scan Repo  →', 0, 1 * S); c.restore();
  c.restore();
}
function checklist(c, r, t, a) {
  if (a <= 0) return; c.save(); c.globalAlpha *= a; const x = r.x + 28 * S, w = r.w - 56 * S;
  const hl = ease.in(prog(t, CUT_C - 0.21, CUT_C - 0.08)); c.save(); c.globalAlpha *= 1 - hl;
  F(c, 22 * S, 500, B.mono); c.fillStyle = B.dim; c.textBaseline = 'middle'; c.letterSpacing = 3 * S + 'px'; c.fillText('SCANNING REPOSITORY', x + 4 * S, r.y + 146 * S - hl * 12 * S); c.restore();
  STEPS.forEach((s, i) => {
    const y = r.y + 178 * S + i * 64 * S, e = ease.expoOut(prog(t, T_SCAN + 0.05 + i * 0.04, T_SCAN + 0.4 + i * 0.04)), done = t >= stepDone(i), act = !done && t >= stepDone(i - 1);
    const leave = ease.in(prog(t, CUT_C - 0.18 + i * 0.03, CUT_C - 0.03 + i * 0.03)); // rows leave before the card reframes (no double exposure)
    c.save(); c.globalAlpha *= e * (1 - leave); c.translate(0, (1 - e) * 16 * S - leave * 12 * S);
    rrect(c, x, y, w, 54 * S, 12 * S); c.fillStyle = done ? 'rgba(196,104,73,0.10)' : act ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.025)'; c.fill();
    const cx = x + 30 * S, cy = y + 27 * S, k = ease.spring(prog(t, stepDone(i), stepDone(i) + 0.22), 0.4);
    c.beginPath(); c.arc(cx, cy, 11 * S, 0, 7); c.strokeStyle = act ? 'rgba(82,82,92,0.5)' : 'rgba(82,82,92,0.22)'; c.lineWidth = 2 * S; c.stroke();
    if (done) { c.save(); c.translate(cx, cy); c.scale(k, k); c.fillStyle = B.primary; c.beginPath(); c.arc(0, 0, 12 * S, 0, 7); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 2.6 * S; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(-5 * S, 0); c.lineTo(-1.5 * S, 4 * S); c.lineTo(5.5 * S, -4 * S); c.stroke(); c.restore(); }
    F(c, 28 * S, 500); c.fillStyle = done ? B.ink : act ? B.dim : B.faint; c.fillText(s, x + 58 * S, cy + 5 * S); c.restore();
  });
  c.restore();
}
// the product's primitive: 50 rounded lines, success / warning by coverage. n = lines lit (a fractional one pops in).
function lines(c, x, y, w, h, n, colorAt) {
  const L = 50, gap = 3 * S, lw = (w - gap * (L - 1)) / L;
  for (let i = 0; i < L; i++) { const on = clamp(n - i), s = 0.55 + 0.45 * ease.spring(on, 0.35);
    rrect(c, x + i * (lw + gap), y + (h - h * (on > 0 ? s : 1)) / 2, lw, on > 0 ? h * s : h, lw / 2); c.fillStyle = on > 0 ? mix2('#e4e4e7', colorAt(i), on) : '#e4e4e7'; c.fill(); }
}
const STAT = [['KEYS', 4748, 'Total keys'], ['LOC', 42, 'Locales'], ['COV', 82, 'Avg coverage']];
function icon(c, kind, x, y, s) { // heroicons-like glyphs in a sky tile, as the report's StatCard draws them
  rrect(c, x, y, s, s, 8 * S); c.fillStyle = 'rgba(0,166,244,0.16)'; c.fill(); c.strokeStyle = c.fillStyle = B.sky; c.lineWidth = 2.6 * S; c.lineCap = 'round';
  const m = x + s / 2, n = y + s / 2;
  if (kind === 'KEYS') { c.beginPath(); c.arc(m - 4 * S, n - 3 * S, 6 * S, 0, 7); c.stroke(); c.beginPath(); c.moveTo(m, n + 1 * S); c.lineTo(m + 8 * S, n + 9 * S); c.moveTo(m + 5 * S, n + 6 * S); c.lineTo(m + 8 * S, n + 3 * S); c.stroke(); }
  if (kind === 'LOC') { c.beginPath(); c.arc(m, n, 9 * S, 0, 7); c.moveTo(m - 9 * S, n); c.lineTo(m + 9 * S, n); c.stroke(); c.beginPath(); c.ellipse(m, n, 4 * S, 9 * S, 0, 0, 7); c.stroke(); }
  if (kind === 'COV') [[-6, 4], [0, 9], [6, 14]].forEach(([dx, hh]) => c.fillRect(m + dx * S - 2 * S, n + 8 * S - hh * S, 4 * S, hh * S));
}
const T_COUNT = CUT_C + 0.08, T_LANDED = T_COUNT + 0.95; // stats land here; the badge and footer wait for it
function report(c, r, t) {
  const a = (j = 0) => ease.expoOut(prog(t, CUT_C - 0.02 + j * 0.04, CUT_C + 0.38 + j * 0.04)); if (a() <= 0) return;
  const x = r.x + 32 * S, w = r.w - 64 * S, row = (j, fn) => { const e = a(j); c.save(); c.globalAlpha *= e; c.translate(0, (1 - e) * 18 * S); fn(); c.restore(); };
  row(0, () => { F(c, 22 * S, 500, B.mono); c.letterSpacing = 3 * S + 'px'; c.fillStyle = B.dim; c.textBaseline = 'alphabetic'; c.fillText('HEALTH REPORT', x, r.y + 58 * S);
    F(c, 42 * S, 600, B.mono); c.fillStyle = B.ink; c.fillText('calcom/cal.com', x, r.y + 110 * S);
    const sw = 116 * S, sx = r.x + r.w - 32 * S - sw; rrect(c, sx, r.y + 64 * S, sw, 52 * S, 10 * S); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = B.rule; c.lineWidth = 1.5 * S; c.stroke();
    F(c, 22 * S, 500, B.mono); c.fillStyle = B.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Share', sx + sw / 2, r.y + 91 * S); c.textAlign = 'left'; });
  const cw = (w - 2 * 20 * S) / 3, cy = r.y + 146 * S, fixP = prog(t, T_FIX + 0.12, T_FIXED - 0.05), full = t >= T_FIXED;
  STAT.forEach(([k, v, lab], i) => row(1 + i, () => {
    const cx = x + i * (cw + 20 * S), cnt = ease.out(prog(t, T_COUNT + i * 0.08, T_LANDED - 0.16 + i * 0.08));
    card(c, cx, cy, cw, 184 * S, { r: 14 * S, blur: 20 * S, shadow: 'rgba(17,17,24,0.06)' });
    icon(c, k, cx + 22 * S, cy + 22 * S, 40 * S);
    if (k === 'COV') counter(c, 82 * cnt + 18 * ease.inOut(fixP), cx + 22 * S, cy + 116 * S, { size: 58 * S, font: B.font, weight: 700, color: B.ink, align: 'left', suffix: '%', roll: false });
    else counter(c, v * cnt, cx + 22 * S, cy + 116 * S, { size: 58 * S, font: B.font, weight: 700, color: B.ink, align: 'left', roll: false });
    F(c, 21 * S, 400, B.mono); c.fillStyle = B.dim; c.textBaseline = 'middle'; c.fillText(lab, cx + 22 * S, cy + 158 * S);
  }));
  const by = r.y + 382 * S, cov = 82 + 18 * ease.inOut(fixP), landed = ease.out(prog(t, T_LANDED, T_LANDED + 0.25));
  row(4, () => {
    F(c, 22 * S, 500, B.mono); c.letterSpacing = 3 * S + 'px'; c.fillStyle = B.dim; c.textBaseline = 'middle'; c.fillText('AVG COVERAGE · 42 LOCALES', x, by + 22 * S);
    const good = full, bt = `${Math.round(cov)}% COVERAGE`; F(c, 21 * S, 500, B.mono); c.letterSpacing = 2 * S + 'px'; const bw = c.measureText(bt).width + 28 * S;
    c.save(); c.globalAlpha *= landed; rrect(c, x + w - bw, by + 3 * S, bw, 40 * S, 8 * S); c.fillStyle = good ? 'rgba(0,188,125,0.12)' : 'rgba(254,154,0,0.12)'; c.fill();
    c.fillStyle = good ? B.okFg : B.warnFg; c.textAlign = 'center'; c.fillText(bt, x + w - bw / 2, by + 24 * S); c.restore(); c.textAlign = 'left';
    const lit = 41 * ease.out(prog(t, T_COUNT, T_LANDED)) + 9 * fixP, sweep = fixP * 58 - 4;
    lines(c, x, by + 64 * S, w, 66 * S, lit, i => (i < sweep ? '#1f9d6b' : B.warn));
    c.save(); c.globalAlpha *= landed; F(c, 22 * S, 400, B.mono); c.fillStyle = B.dim; c.fillText(full ? '4,748 keys · 42 locales · 0 missing' : '4,748 source keys · 42 locales', x, by + 168 * S); c.restore();
  });
  row(5, () => fixButton(c, r, t));
}
const PRB = r => { const b = FIXB(r); return { x: b.x + b.w + 20 * S, y: b.y, w: 330 * S, h: b.h }; };
function fixButton(c, r, t) { // Fix with Lingo.dev → Fixing… → ✓ Fixed (stays), then Create draft PR appears beside it
  const b = FIXB(r), pose = CUR(t), [, , hov] = magnet(pose, b), pr = t >= T_FIX - 0.05 && t < T_FIX + 0.3 ? pose.press : 0;
  const fixedK = ease.inOut(prog(t, T_FIXED - 0.08, T_FIXED + 0.08));
  c.save(); c.translate(b.x + b.w / 2, b.y + b.h / 2); c.scale(1 - 0.05 * pr, 1 - 0.05 * pr); rrect(c, -b.w / 2, -b.h / 2, b.w, b.h, 14 * S);
  c.fillStyle = mix2(mix2(B.primary, '#1f9d6b', fixedK), B.ink, 0.12 * hov * (1 - fixedK) + 0.2 * pr); c.fill();
  F(c, 28 * S, 600); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
  c.fillText(t < T_FIX ? 'Fix with Lingo.dev' : t < T_FIXED ? 'Fixing…' : '✓  Fixed', 0, 1 * S); c.restore();
  if (t >= T_FIX && t < T_FIXED) { c.save(); c.translate(b.x + b.w + 36 * S, b.y + b.h / 2); c.rotate(t * 9); c.strokeStyle = B.primary; c.lineWidth = 3 * S; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 13 * S, 0, 4.4); c.stroke(); c.restore(); }
  const e = ease.expoOut(prog(t, T_PRBTN, T_PRBTN + 0.35)); if (e <= 0) return; // the next action arrives beside it
  const q = PRB(r), [, , hv] = magnet(pose, q), pp = t >= T_PR - 0.05 && t < T_PR + 0.3 ? pose.press : 0;
  c.save(); c.globalAlpha *= e; c.translate(q.x + q.w / 2 - (1 - e) * 30 * S, q.y + q.h / 2); c.scale(1 - 0.05 * pp, 1 - 0.05 * pp);
  rrect(c, -q.w / 2, -q.h / 2, q.w, q.h, 14 * S); c.fillStyle = mix2('#ffffff', '#f4f4f5', hv + pp); c.fill(); c.strokeStyle = B.rule; c.lineWidth = 1.5 * S; c.stroke();
  F(c, 28 * S, 600); c.fillStyle = B.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t < T_PR ? 'Create draft PR  ↗' : 'Creating draft PR…', 0, 1 * S); c.restore();
}
function toast(c, r, t) { // the app's own toast, "Draft PR created", docked inside the card over its header
  const e = ease.spring(prog(t, T_TOAST, T_TOAST + 0.35), 0.2); if (e <= 0) return;
  const x = r.x + 24 * S, w = r.w - 48 * S, h = 104 * S, y = r.y + 24 * S - (1 - e) * 40 * S;
  c.save(); c.globalAlpha *= clamp(e * 1.6); card(c, x, y, w, h, { r: 16 * S, blur: 36 * S, shadow: 'rgba(40,20,10,0.16)' });
  c.fillStyle = '#1f9d6b'; c.beginPath(); c.arc(x + 52 * S, y + h / 2, 20 * S, 0, 7); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 3.4 * S; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + 43 * S, y + h / 2); c.lineTo(x + 50 * S, y + h / 2 + 7 * S); c.lineTo(x + 62 * S, y + h / 2 - 7 * S); c.stroke();
  F(c, 32 * S, 600); c.fillStyle = B.ink; c.textBaseline = 'middle'; c.fillText('Draft PR created', x + 92 * S, y + h / 2 - 14 * S);
  F(c, 22 * S, 400, B.mono); c.fillStyle = B.dim; c.fillText('calcom/cal.com', x + 92 * S, y + h / 2 + 22 * S); c.restore();
}
// the headline: centred above the bar while pasting, then it moves to the left column with the reframe; new eyebrows add facts
const HEADS = [[T_IRIS - 0.05, CUT_C - 0.1, 'ANY PUBLIC GITHUB REPO', 'Paste a ', 'repo URL.'], [CUT_C + 0.16, T_FIX - 0.1, 'JSON · YAML · .PO', 'Get a health', 'report.'],
  [T_FIX, CUT_D, 'TRANSLATED BY LINGO.DEV', 'Fix with', 'one click.']];
function heads(c, t) {
  HEADS.forEach(([t0, t1, eb, l1, l2], i) => {
    if (t < t0 || t >= t1 + 0.2) return; const out = ease.in(prog(t, t1, t1 + 0.15));
    c.save(); c.globalAlpha = 1 - out; if (out > 0) c.filter = `blur(${out * 12 * S}px)`; c.translate(0, -out * 26 * S);
    if (i === 0) { // centred, one line
      const up = ease.spring(prog(t, T_SCAN, T_SCAN + 0.5), 0.15) * 70 * S; // the headline makes room as the card grows
      headline(c, [[`0${i + 1}  `, { color: B.primary }], eb], W / 2, 250 * S - up, { font: B.mono, size: 22 * S, weight: 500, track: 0.3, color: B.dim, align: 'center', t: t - t0 });
      headline(c, [l1, [l2, { color: B.primary }]], W / 2, 400 * S - up, { font: B.font, size: 120 * S, weight: 700, color: B.ink, align: 'center', t: t - t0 - 0.05, track: -0.04 });
    } else {
      headline(c, [[`0${i + 1}  `, { color: B.primary }], eb], 150 * S, 400 * S, { font: B.mono, size: 22 * S, weight: 500, track: 0.3, color: B.dim, t: t - t0 });
      headline(c, [l1], 150 * S, 530 * S, { font: B.font, size: 116 * S, weight: 700, color: B.ink, t: t - t0 - 0.05, track: -0.04 });
      headline(c, [[l2, { color: B.primary }]], 150 * S, 648 * S, { font: B.font, size: 116 * S, weight: 700, t: t - t0 - 0.14, track: -0.04 });
    }
    c.restore();
  });
}
function shotBC(c, t) {
  lightGround(c, t, -reframe(t) * 40 * S);
  if (t >= CUT_D + 0.45) return;
  const away = ease.in(prog(t, CUT_D - 0.05, CUT_D + 0.3));
  // camera: a push onto the bar and the button while it fixes, then back out for the PR toast
  const r = cardRect(t), push = ease.smooth(prog(t, T_FIX - 0.4, T_FIX + 0.2)) * (1 - ease.smooth(prog(t, T_FIXED + 0.05, T_PRBTN + 0.3)));
  c.save(); c.globalAlpha = 1 - away; if (away > 0) c.filter = `blur(${away * 14 * S}px)`;
  const za = 1 - 0.06 * away; c.translate(W / 2, H / 2); c.scale(za, za); c.translate(-W / 2, -H / 2);
  heads(c, t);
  const zk = 1 + 0.4 * push, fx = r.x + r.w * 0.5, fy = r.y + r.h * 0.62; // push onto the bar: the card group only, so the headline stays put
  c.translate(fx - 35 * S * push, fy); c.scale(zk, zk); c.translate(-fx, -fy);
  card(c, r.x, r.y, r.w, r.h, { r: 22 * S, blur: 80 * S, shadow: 'rgba(60,30,20,0.16)' });
  c.save(); rrect(c, r.x, r.y, r.w, r.h, 22 * S); c.clip();
  inputBar(c, r, t, 1 - ease.in(prog(t, CUT_C - 0.2, CUT_C - 0.05))); checklist(c, r, t, prog(t, T_SCAN, T_SCAN + 0.15)); report(c, r, t);
  c.restore();
  toast(c, r, t);
  if (t > T_IRIS + 0.2 && t < CUT_D + 0.25) drawCursor(c, CUR(t));
  c.restore();
}

// ---------- D. end card (8.85-12.5): the brackets close into the logo, its dot drops and opens the brand-colour card ----------
const HEAD = [['DE', 'Fehlerhafte Übersetzungen erkennen & beheben'], ['JA', '翻訳の問題をスキャン＆修正']]; // site.tagline, messages/*.json
const T_LANG = T_LAND + 0.3, LANG_STEP = 0.38, T_EN = T_LANG + HEAD.length * LANG_STEP, CTA = { h: 86 * S, y: 742 * S };
function ctaLayout(c) { F(c, 30 * S, 700); const cw = c.measureText('Scan Repo  →').width + 88 * S; F(c, 26 * S, 400, B.mono); const dw = c.measureText('i18n-doctor.vercel.app').width + 72 * S;
  const gx = W / 2 - (cw + 24 * S + dw) / 2; return { cw, dw, gx, cx: gx + cw / 2, dx: gx + cw + 24 * S + dw / 2 }; }
const rustGround = (c, t) => ground(c, t, { base: B.rust, blooms: [['#e9926b', 0.28, 0.15, 0.7, 0.32], ['#6e2a16', 0.85, 1.0, 0.6, 0.5]], lattice: 'grid', cell: 64 * S, ink_a: 0.06, vignette: 0.12 });
function endCard(c, t) {
  if (t < T_LAND - 0.05) return;
  const wx = MARK_D.x + MARK_D.s + 44 * S, wy = MARK_D.y + MARK_D.s * 0.79;
  headline(c, ['i18n.doctor'], wx, wy, { font: B.font, size: 196 * S, weight: 700, color: '#ffffff', track: -0.045, t: t - T_LAND - 0.22, dur: 0.5, blur: 18 * S });
  const k = Math.floor((t - T_LANG) / LANG_STEP), ty = 612 * S; // the tagline in the app's own translations, then English
  if (t >= T_LANG && k < HEAD.length) {
    const [lc, str] = HEAD[k]; F(c, 22 * S, 500, B.mono); c.letterSpacing = 4 * S + 'px'; c.fillStyle = 'rgba(255,255,255,0.72)'; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.fillText(lc, W / 2, ty - 74 * S); c.font = `600 ${56 * S}px "${B.font}", "Hiragino Sans", "PingFang SC", sans-serif`; c.letterSpacing = '0px'; c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillText(str, W / 2, ty);
  } else if (t >= T_EN) {
    headline(c, ['Scan & fix broken translations ', ['in any repo', { color: B.ink, underline: B.ink }]], W / 2, ty, { font: B.font, size: 60 * S, weight: 600, color: '#ffffff', track: -0.02, align: 'center', t: t - T_EN + 0.15, gap: 0.12 });
  }
  const e = ease.expoOut(prog(t, T_EN + 0.15, T_EN + 0.6)); if (e <= 0) return;
  const L = ctaLayout(c), pose = CUR_E(t), cr = { x: L.gx, y: CTA.y - CTA.h / 2, w: L.cw, h: CTA.h }, [, , hov] = magnet(pose, cr), pr = pose.press;
  c.save(); c.globalAlpha = e; c.translate(0, (1 - e) * 30 * S);
  c.save(); c.translate(L.cx, CTA.y); c.scale(1 - 0.05 * pr, 1 - 0.05 * pr);
  pill(c, 'Scan Repo  →', 0, 0, { size: 30 * S, font: B.font, weight: 700, fill: mix2('#ffffff', '#f1e4dd', 0.6 * hov + pr), color: B.ink, h: CTA.h, padX: 44 * S, shadow: 'rgba(60,20,8,0.38)' }); c.restore();
  pill(c, 'i18n-doctor.vercel.app', L.dx, CTA.y, { size: 26 * S, font: B.mono, weight: 400, fill: 'rgba(255,255,255,0.12)', color: '#ffffff', border: 'rgba(255,255,255,0.45)', h: CTA.h, padX: 36 * S });
  F(c, 20 * S, 500, B.mono); c.letterSpacing = 4 * S + 'px'; c.fillStyle = 'rgba(255,255,255,0.85)'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('JSON · YAML · .PO · ONE-CLICK FIX WITH LINGO.DEV', W / 2, 862 * S); c.restore();
  drawCursor(c, pose);
}

// ---------- the overlay: brackets (logo ↔ frame), the dots, the HUD labels ----------
function overlay(c, t) {
  if (t < T_DOT - 0.05) return;
  const r = bracketRect(t), lightK = t < T_IRIS ? 0 : t < T_RUST ? ease.inOut(prog(t, T_IRIS + 0.1, T_IRIS + 0.45)) : 1 - ease.inOut(prog(t, T_RUST, T_RUST + 0.2));
  const snap = t < T_IRIS ? ease.expoOut(prog(t, T_DOT, T_DOT + 0.12)) : 1;
  c.save(); c.globalAlpha = snap; brackets(c, r.x, r.y, r.w, r.h, r.arm, r.lw, mix2('#fafafa', B.ink, lightK)); c.restore();
  const dd = ease.spring(prog(t, T_DROP, T_DROP + 0.3), 0.3); // the end card's dot drops in, then opens the brand-colour iris
  if (t >= CUT_D && dd > 0) { c.fillStyle = t < T_RUST ? B.primary : '#ffffff'; c.beginPath(); c.arc(r.x + r.w / 2, r.y + r.h / 2, MARK_D.s * 0.1875 * dd, 0, 7); c.fill(); }
  const hp = Math.min(prog(t, T_IRIS + 0.45, T_IRIS + 0.8), 1 - prog(t, CUT_D - 0.1, CUT_D + 0.15));
  if (hp > 0) hudFrame(c, t, { arm: 0, rule: false, p: 1, alpha: 0.72 * hp, color: B.ink, font: B.mono, size: 17 * S, inset: 30 * S, tl: 'I18N.DOCTOR', tr: '',
    bl: u => (u < T_PASTE ? 'NO REPO' : 'CALCOM/CAL.COM'), br: u => (u < T_SCAN ? 'IDLE' : u < CUT_C ? 'SCANNING' : u < T_LANDED ? 'REPORT' : u < T_FIX ? '82%' : u < T_FIXED ? 'FIXING' : u < T_TOAST ? '100%' : 'DRAFT PR OPEN') });
}

// cursor beats, built on first use so the CTA is measured in the loaded font
function buildCur() { // the product cursor lives in the card's world, so it rides the push-in with it
  const rI = cardRect(T_FIELD), f = FIELD(rI), [px, py] = [f.x + f.w * 0.55, f.y + f.h * 0.7], [sx, sy] = aim(SCANB(cardRect(T_SCAN - 0.25)));
  const rF = cardRect(T_FIX), [fx, fy] = aim(FIXB(rF)), [qx, qy] = aim(PRB(rF));
  return cursorPath([
    { t: T_IRIS + 0.2, x: W * 0.9, y: H * 1.06 }, { t: T_FIELD, x: px, y: py, click: true, hold: 0.05 }, { t: T_SCAN - 0.2, x: sx, y: sy, click: true }, { t: T_SCAN + 0.55, x: sx + 40 * S, y: sy + 170 * S },
    { t: T_FIX - 0.25, x: fx, y: fy, click: true, dwell: 0.25, hold: 0.45 }, { t: T_PR - 0.25, x: qx, y: qy, click: true, dwell: 0.25, hold: 0.15 },
    { t: T_TOAST + 0.35, x: qx + 160 * S, y: qy + 120 * S, ease: ease.expoOut, out: true, hold: 0 },
  ]);
}
function buildCurEnd() { // a fresh hand for the end card (a path that has faded out stays out)
  const L = ctaLayout(new OffscreenCanvas(1, 1).getContext('2d')), [cx, cy] = aim({ x: L.gx, y: CTA.y - CTA.h / 2, w: L.cw, h: CTA.h });
  return cursorPath([{ t: T_EN + 0.4, x: W * 0.62, y: H * 1.06 }, { t: T_EN + 0.95, x: cx, y: cy, click: true, hold: 0.25 }, { t: T_EN + 1.5, x: cx + 60 * S, y: cy + 70 * S, out: true, hold: 0 }]);
}
let CUR_E = t => (CUR_E = buildCurEnd())(t);
CUR = t => (CUR = buildCur())(t);

window.VIDEO = {
  duration: END,
  audio: 'audio.wav',
  fonts: ['Fustat:wght@400;500;600;700', 'Geist Mono:wght@400;500;600'],
  bed: { bpm: 120, chords: [[50, 57, 60, 65], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]], sections: [[0, 'intro', 0.8], [2.0, 'groove', 0.5]],
    kick: { f0: 300, f1: 55, tau: 0.06, decay: 0.3 }, kick_pattern: [0, 1.5, 2.5] },
  mutes: [[4.0, 4.5], [6.0, 6.5]],
  blur: [[T_IMP, T_IRIS + 0.6, 16], [CUT_C, CUT_C + 0.5, 8], [CUT_D - 0.1, CUT_D + 0.6, 32], [T_RUST, T_RUST + 0.45, 8]],
  sfx: [
    [T_DOT - 0.02, 'sub_swell', 0.55, { dur: 0.7 }],
    ...CHIPS.slice(0, 10).map((p, i) => [T_IMP + p.d + 0.2, 'tick', 1.0, { f: 5200 + i * 160 }]),
    [T_DOT + 0.02, 'clink', 0.5], [T_IRIS + 0.1, 'passby', 1.1, { dur: 0.45 }],
    [T_PASTE, 'click_cluster', 0.8], [T_PASTE + 0.02, 'blip_pop', 0.5],
    [T_SCAN + 0.03, 'blip_pop', 0.6],
    ...STEPS.map((_, i) => [stepDone(i), 'tick', 1.3, { f: 4600 + i * 220 }]),
    [CUT_C, 'swoosh', 0.5], [CUT_C + 0.02, 'thud', 0.4], [T_COUNT, 'slot_roll', 0.8], [T_COUNT + 0.05, 'dot_ticks', 1.2, { n: 14, gap: 0.055 }],
    [T_FIX + 0.03, 'blip_pop', 0.6], [T_FIX + 0.12, 'dot_ticks', 1.2, { n: 9, gap: 0.075 }], [T_FIXED, 'sting', 0.5],
    [T_PR + 0.03, 'blip_pop', 0.5], [T_TOAST, 'bloop', 0.7],
    [CUT_D, 'gap', 1, { dur: 0.45 }], [CUT_D + 0.02, 'swoosh', 0.7], [T_DROP, 'bloop', 0.5], [T_RUST, 'passby', 0.8, { dur: 0.4 }],
    [T_LAND, 'echo', 2.4, { n: 8, decay: 0.8 }], [T_LAND, 'sub_boom', 0.4, { dur: END - T_LAND, tau: 1.0 }],
    ...HEAD.map((_, i) => [T_LANG + i * LANG_STEP, 'tick', 0.9, { f: 6000 + i * 300 }]),
    [T_EN + 1.18, 'blip_pop', 0.6],
  ],
  overlay,
  scenes: [
    { start: 0, end: T_IRIS + 0.6, draw: (c, p, t) => { shotA(c, t); if (t >= T_IRIS) iris(c, W / 2, H / 2, prog(t, T_IRIS, T_IRIS + 0.42), cc => shotBC(cc, t), { r0: LOGO * 0.1875, ease: ease.quintOut, ring: B.primary, lw: 10 * S }); } },
    { start: T_IRIS + 0.6, end: END, draw: (c, p, t) => {
      shotBC(c, t);
      if (t >= T_RUST) iris(c, ...MARK_C, prog(t, T_RUST, T_RUST + 0.42), cc => { rustGround(cc, t); endCard(cc, t); }, { r0: MARK_D.s * 0.1875, ease: ease.quintOut, ring: '#ffffff', lw: 8 * S });
    } },
  ],
};
