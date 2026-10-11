// THE creative file. Replace this demo with the storyboard from treatment.md, using the product's real brand, copy and numbers.
// It shows the defaults the skill expects (SKILL.md 2 and 3c): a ground that isn't flat, three type voices, a real card that
// grows instead of cutting, an implode -> iris turn, and the end-card spec. Colours #rrggbb. Lay out with W/H/S.
const B = { bg: '#f6f5f1', dark: '#0b0b0e', ink: '#17171a', dim: '#5b5b63', rule: '#e4e4e7', accent: '#ff5a1f', ok: '#16a34a', font: 'Inter', mono: 'Geist Mono', name: 'acme' };
const T_IRIS = 2.0, T_END = 5.2, END = 8.0; // S = min(W, H) / 1080 comes from type.js (don't redeclare it)
const PIECES = Array.from({ length: 22 }, (_, i) => { const r = rng(40 + i); return { x: W * (0.05 + 0.9 * r()), y: H * (0.06 + 0.88 * r()), z: r() * 2, label: ['links.csv', 'utm_source', 'clicks 1,204', 'qr.svg', '/launch', 'ref=x'][i % 6] }; });
const CUR = cursorPath([{ t: 3.0, x: W * 0.95, y: H * 1.05 }, { t: 3.7, x: W * 0.58, y: H * 0.64, click: true }, { t: 6.4, x: W / 2 + 60 * S, y: H * 0.72, click: true }, { t: 7.1, x: W / 2 + 120 * S, y: H * 0.8, out: true }]);

function hook(c, t) { // dark: the product's own pieces in depth, a three-voice headline, then everything implodes into one dot
  ground(c, t, { base: B.dark, blooms: [[B.accent, 0.5, 0.6, 0.45, 0.18]], lattice: 'dots', cell: 48 * S });
  const cam = { x: 0, y: 0, z: 0.3 * ease.smooth(prog(t, 0, 1.6)), focus: 0.4 };
  PIECES.forEach((p, i) => { const u = ease.expoIn(prog(t, 1.45 + (i % 5) * 0.025, 1.85)); if (u > 0.97) return;
    depthLayer(c, cam, lerp(p.z, 0.4, u), cc => { cc.translate(lerp(p.x, W / 2, u), lerp(p.y, H / 2, u)); cc.scale(1 - u * 0.9, 1 - u * 0.9);
      pill(cc, p.label, 0, 0, { size: 22 * S, font: B.mono, weight: 400, fill: '#18181b', color: '#d4d4d8', border: 'rgba(255,255,255,0.09)', dot: i % 3 ? '#52525c' : B.accent }); }, { dof: 9 * S }); });
  const out = ease.in(prog(t, 1.35, 1.55)); c.save(); c.globalAlpha = 1 - out; if (out) c.filter = `blur(${out * 14 * S}px)`;
  headline(c, ['SHORT LINKS · ANALYTICS'], W / 2, H / 2 - 100 * S, { font: B.mono, size: 22 * S, weight: 500, track: 0.3, color: '#ff9a6b', align: 'center', t: t - 0.1 });
  headline(c, ['Every click, ', ['counted.', { color: '#ff9a6b', underline: B.accent }]], W / 2, H / 2 + 30 * S, { font: B.font, size: 110 * S, weight: 800, color: '#fafafa', align: 'center', t: t - 0.25 });
  c.restore(); const d = ease.expoOut(prog(t, 1.75, 1.95)); if (d) { glow(c, W / 2, H / 2, 140 * S * d, B.accent, 0.6); c.fillStyle = '#fff'; c.beginPath(); c.arc(W / 2, H / 2, 18 * S * d, 0, 7); c.fill(); }
}
function product(c, t) { // light: headline left, one card right that grows from a link field into a stats panel
  ground(c, t, { base: B.bg, blooms: [['#ffd9c7', 0.85, 0.15, 0.6, 0.7], ['#dbeafe', 0.08, 0.95, 0.5, 0.5]], lattice: 'grid' });
  headline(c, [['01  ', { color: B.accent }], 'SHORTEN A LINK'], 150 * S, 420 * S, { font: B.mono, size: 22 * S, weight: 500, track: 0.3, color: B.dim, t: t - T_IRIS - 0.2 });
  headline(c, ['Short links'], 150 * S, 540 * S, { font: B.font, size: 104 * S, weight: 800, color: B.ink, t: t - T_IRIS - 0.25 });
  headline(c, [['that count.', { color: B.accent }]], 150 * S, 650 * S, { font: B.font, size: 104 * S, weight: 800, t: t - T_IRIS - 0.35 });
  const g = ease.spring(prog(t, 3.9, 4.5), 0.15), x = 960 * S, w = 800 * S, y = lerp(470 * S, 290 * S, g), h = lerp(140 * S, 500 * S, g), e = ease.expoOut(prog(t, T_IRIS + 0.2, T_IRIS + 0.7));
  c.save(); c.globalAlpha = e; c.translate(0, (1 - e) * 40 * S); card(c, x, y, w, h, { r: 22 * S });
  text(c, B.name + '.com/launch', x + 40 * S, y + 70 * S, { size: 34 * S, font: B.mono, color: B.ink, align: 'left' });
  const pose = CUR(t), done = t > CUR.clicks[0] + 0.03; pill(c, done ? 'Copied' : 'Shorten', x + w - 110 * S, y + 70 * S, { size: 26 * S, font: B.font, fill: done ? B.ok : B.accent, h: 64 * S });
  if (g > 0.05) { c.save(); c.globalAlpha *= g; text(c, 'CLICKS · LAST 7 DAYS', x + 40 * S, y + 160 * S, { size: 20 * S, font: B.mono, color: B.dim, align: 'left', spacing: 5 * S });
    counter(c, 1204 * ease.out(prog(t, 4.0, 4.9)), x + 40 * S, y + 225 * S, { size: 64 * S, font: B.font, color: B.ink, align: 'left', roll: false });
    lineChart(c, series(40, 7), x + 40 * S, y + 280 * S, w - 80 * S, h - 320 * S, ease.inOut(prog(t, 4.1, 5.0)), { color: B.accent, width: 3 * S }); c.restore(); }
  c.restore(); if (t < T_END) drawCursor(c, pose);
}
function endCard(c, t) { // wordmark ~45 % of W, tagline with one accent part + drawn underline, CTA in the brand colour casting its colour
  const u = t - T_END; headline(c, [B.name], W / 2, H / 2 - 20 * S, { font: B.font, size: 230 * S, weight: 800, color: B.ink, track: -0.05, align: 'center', t: u, dur: 0.5, blur: 18 * S });
  headline(c, ['Turn clicks into ', ['revenue.', { color: B.accent, underline: true }]], W / 2, H / 2 + 90 * S, { font: B.font, size: 60 * S, weight: 600, color: B.ink, align: 'center', t: u - 0.35 });
  const e = ease.expoOut(prog(u, 0.7, 1.2)), pose = CUR(t); if (e <= 0) return; c.save(); c.globalAlpha = e; c.translate(0, (1 - e) * 30 * S);
  c.save(); c.translate(W / 2, H * 0.72); c.scale(1 - 0.05 * pose.press, 1 - 0.05 * pose.press); pill(c, 'Start for free  →', 0, 0, { size: 30 * S, font: B.font, weight: 700, fill: B.accent, h: 86 * S, padX: 44 * S, shadow: 'rgba(255,90,31,0.4)' }); c.restore();
  text(c, B.name.toUpperCase() + '.COM', W / 2, H * 0.82, { size: 20 * S, font: B.mono, color: B.dim, spacing: 8 * S }); c.restore(); drawCursor(c, pose);
}

window.VIDEO = {
  duration: END,
  audio: 'audio.wav',             // written by sfx.py from `sfx` (+ `music`)
  music: null,                    // e.g. 'music.mp3': a licensed track, mixed under the SFX
  fonts: ['Inter:wght@400;500;600;700;800', 'Geist Mono:wght@400;500'],
  assets: [],                     // e.g. ['logo.svg'] copied from the product repo
  bed: { bpm: 120, chords: [[50, 57, 60, 65], [48, 55, 60, 64]], sections: [[0, 'intro', 0.8], [2.0, 'groove', 0.6]] },
  sfx: [[1.95, 'sub_swell', 0.5, { dur: 0.6 }], [2.1, 'passby', 1.0], [3.93, 'blip_pop', 0.3], [4.0, 'slot_roll', 0.3], [T_END, 'gap', 1, { dur: 0.4 }],
    [T_END, 'echo', 2.4, { n: 8, decay: 0.8 }], [T_END, 'sub_boom', 0.4, { dur: END - T_END, tau: 1 }]],
  scenes: [
    { start: 0, end: T_IRIS + 0.45, draw(c, p, t) { hook(c, t); if (t >= T_IRIS) iris(c, W / 2, H / 2, prog(t, T_IRIS, T_IRIS + 0.4), cc => product(cc, t), { r0: 18 * S, ease: ease.quintOut, ring: B.accent, lw: 8 * S }); } },
    { start: T_IRIS + 0.45, end: T_END, draw(c, p, t) { product(c, t); } },
    { start: T_END, end: END, draw(c, p, t) { ground(c, t, { base: B.bg, blooms: [['#ffd9c7', 0.5, 0.2, 0.7, 0.6]], lattice: 'grid' }); endCard(c, t); } },
  ],
};
