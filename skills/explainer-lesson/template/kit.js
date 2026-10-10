// Components every lesson draws from, all pure functions of t: plot (graphs), the right-hand panel (header, chips,
// readouts, legend), chrome (title card, chapter label, end card, burnt-in caption) and the looks (art direction).

// ---- plot: axes that draw on, curves, markers with guides, shaded bands ----

/**
 * box: { x0, x1, y0 (bottom), y1 (top) } in canvas units. x / y: { min, max, ticks, label, format?, grid? }.
 * Returns X/Y (domain -> canvas) and the drawing calls. Keep y0 <= 372 so the axis labels clear the caption band.
 */
function plot({ box, x, y }) {
  const X = (v) => box.x0 + ((v - x.min) / (x.max - x.min)) * (box.x1 - box.x0);
  const Y = (v) => box.y0 - ((v - y.min) / (y.max - y.min)) * (box.y0 - box.y1);
  const fmt = (a, v) => (a.format ? a.format(v) : String(v));
  const points = (fn, samples = 100) => Array.from({ length: samples + 1 }, (_, i) => {
    const v = x.min + ((x.max - x.min) * i) / samples;
    return [X(v), Y(fn(v))];
  });
  return {
    X, Y, box, points,
    /** Axis lines draw on over `dur` from `at`; ticks, grid and labels fade in after. */
    axes(ctx, th, t, at, dur = 1.4) {
      // Looks with cards put the graph on a pinned sheet of paper, a quiet surface over a textured backdrop
      if (style.cards) card(ctx, th, box.x0 - 100, box.y1 - 22, box.x1 - box.x0 + 136, box.y0 - box.y1 + 86, span(t, at - 0.6, at + 0.2));
      path(ctx, [[box.x0, box.y1 - 10], [box.x0, box.y0], [box.x1 + 10, box.y0]], th.ink, 2, span(t, at, at + dur));
      const a = span(t, at + dur * 0.7, at + dur * 0.7 + 1);
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha *= a;
      for (const v of x.ticks) {
        path(ctx, [[X(v), box.y0], [X(v), box.y0 + 6]], th.ink, 1.5);
        if (x.grid && v !== x.min) path(ctx, [[X(v), box.y0], [X(v), box.y1]], alpha(th.faint, 0.9), 1);
        text(ctx, fmt(x, v), X(v), box.y0 + 26, { size: 16, color: th.muted, align: "center", font: "mono" });
      }
      for (const v of y.ticks) {
        path(ctx, [[box.x0 - 6, Y(v)], [box.x0, Y(v)]], th.ink, 1.5);
        if (y.grid !== false && v !== y.min) path(ctx, [[box.x0, Y(v)], [box.x1, Y(v)]], alpha(th.faint, 0.9), 1);
        text(ctx, fmt(y, v), box.x0 - 12, Y(v) + 5, { size: 16, color: th.muted, align: "right", font: "mono" });
      }
      text(ctx, x.label, (box.x0 + box.x1) / 2, box.y0 + 44, { size: 17, color: th.ink, align: "center" });
      ctx.translate(box.x0 - 70, (box.y0 + box.y1) / 2);
      ctx.rotate(-Math.PI / 2);
      text(ctx, y.label, 0, 0, { size: 17, color: th.ink, align: "center" });
      ctx.restore();
    },
    /** y = fn(x), drawn on to `progress`. Returns the tip, for a leading dot. */
    curve(ctx, fn, color, lw = 4, progress = 1) {
      if (progress <= 0) return null;
      const pts = points(fn);
      path(ctx, pts, color, lw, progress);
      return pts[Math.min(pts.length - 1, Math.round(progress * (pts.length - 1)))];
    },
    /** A dot at (vx, vy) with dashed guides down to the x axis and across to the y axis. */
    marker(ctx, th, vx, vy, color, a) {
      if (a <= 0) return;
      const pt = [X(vx), Y(vy)];
      ctx.save();
      ctx.globalAlpha *= a;
      dashed(ctx, [pt[0], box.y0], pt, alpha(th.muted, 0.8), 1.5, a);
      dashed(ctx, [box.x0, pt[1]], pt, alpha(th.muted, 0.8), 1.5, a);
      circle(ctx, pt[0], pt[1], 7 * ease.back(a), color, th.bg, 2.5);
      ctx.restore();
    },
    /** A shaded vertical band between two x values, labelled at the bottom (or the top). */
    band(ctx, th, from, to, color, a, label, top = false) {
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.fillStyle = alpha(color, th.dark ? 0.12 : 0.1);
      ctx.fillRect(X(from), box.y1, X(to) - X(from), box.y0 - box.y1);
      text(ctx, label, (X(from) + X(to)) / 2, top ? box.y1 + 26 : box.y0 - 16, { size: 16, weight: 500, color, align: "center" });
      ctx.restore();
    },
  };
}

// ---- panel: the column beside a diagram. Positions are the item's left edge and baseline ----

/** A short list title with a muted subtitle. */
function header(ctx, th, x, y, a, title, sub, color) {
  text(ctx, title.toUpperCase(), x, y, { size: 16, weight: 500, color, font: "mono", alpha: a });
  text(ctx, sub, x, y + 24, { size: 16, color: th.muted, alpha: a });
}

/** A coloured badge (a number, a letter of a mnemonic) and its label, sliding in as `p` goes 0 -> 1. */
function chip(ctx, th, x, y, p, badge, label, color) {
  at(ctx, x + (1 - p) * 16, y, 1, clamp(p * 1.4), () => {
    blob(ctx, 14, 0, 14, color);
    const long = badge.length > 1;
    text(ctx, badge, 14, long ? 5 : 6, { size: long ? 13 : 16, weight: 700, color: onColor(color), align: "center" });
    text(ctx, label, 38, 6, { size: 18, color: th.ink });
  });
}

/** o: { x, y, at, gap, items: [[badge, label]], color, alpha?, rowHeight? }. Pair `at`/`gap` with seq() for sounds. */
function chipList(ctx, th, t, o) {
  o.items.forEach(([b, l], i) => chip(ctx, th, o.x, o.y + i * (o.rowHeight ?? 42), stagger(t, o.at, i, o.gap) * (o.alpha ?? 1), b, l, o.color));
}

/** A dot, a bold line and a muted line below it: a value read off the diagram. */
function readout(ctx, th, x, y, a, dot, head, sub) {
  at(ctx, x, y - (1 - a) * 8, 1, a, () => {
    blob(ctx, 7, -6, 7, dot);
    text(ctx, head, 24, 0, { size: 18, weight: 500, color: th.ink });
    text(ctx, sub, 24, 24, { size: 16, color: th.muted });
  });
}

/** Line-swatch legend rows [name, value, colour], staggered in from `from`. */
function legend(ctx, th, t, x, y, from, rows, gap = 0.35) {
  rows.forEach(([name, v, c], i) => {
    at(ctx, x, y + i * 40, 1, stagger(t, from, i, gap, 0.5, ease.out), () => {
      path(ctx, [[0, -6], [28, -6]], c, 4);
      text(ctx, name, 40, 0, { size: 18, weight: 500, color: th.ink });
      text(ctx, v, 130, 0, { size: 16, color: th.muted, font: "mono" });
    });
  });
}

// ---- chrome: the frame around every lesson ----

/** Two-line title, the second line in the accent colour, shown from `from` to `to`. */
function titleCard(ctx, th, t, lines, from = 0.2, to = 4.3, y = 92) {
  const a = span(t, from, from + 1, ease.out) * (1 - span(t, to - 0.7, to));
  if (a <= 0) return;
  const lift = (1 - a) * 10;
  text(ctx, lines[0], W / 2, y - lift, { size: 40, weight: 500, font: "heading", color: th.ink, align: "center", alpha: a });
  if (lines[1]) text(ctx, lines[1], W / 2, y + 48 - lift, { size: 40, weight: 500, font: "heading", color: th.accent, align: "center", alpha: a });
}

/** "03 · THE CEILING" top-left, crossfading at chapter changes. defineLesson draws it. */
function eyebrow(ctx, th, t, chapters, duration, from = 4) {
  const i = activeIndex(chapters, t), c = chapters[i];
  if (!c) return;
  const end = chapters[i + 1]?.at ?? duration + 1;
  const a = Math.min(span(t, c.at, c.at + 0.6), 1 - span(t, end - 0.4, end)) * span(t, from, from + 1);
  text(ctx, `${String(i + 1).padStart(2, "0")} · ${c.title.toUpperCase()}`, 40, 46, { size: 16, weight: 500, color: th.muted, font: "mono", alpha: a });
}

/** Fades the film under a closing line from `from`. defineLesson draws it. */
function endCard(ctx, th, t, from, title, sub) {
  const a = span(t, from, from + 1.2);
  if (a <= 0) return;
  ctx.fillStyle = alpha(th.bg, a * 0.92);
  ctx.fillRect(0, 0, W, H);
  text(ctx, title, W / 2, H / 2 - 8, { size: 30, weight: 500, font: "heading", color: th.ink, align: "center", alpha: a });
  text(ctx, sub, W / 2, H / 2 + 30, { size: 18, color: th.muted, align: "center", alpha: span(t, from + 0.6, from + 1.6) });
}

/** The caption, burnt in: white on a dark rounded box at the bottom, below SAFE_BOTTOM. */
function caption(ctx, s) {
  if (!s) return;
  const size = 21, line = size * 1.35, max = W * 0.82;
  ctx.save();
  ctx.font = `400 ${size}px ${fonts.sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = [];
  for (const word of s.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * 1.2, h = lines.length * line + size * 0.5;
  const y = H * 0.95 - h;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  roundRect(ctx, W / 2 - w / 2, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = "#fff";
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + size * 0.25 + line * (i + 0.5)));
  ctx.restore();
}

// ---- looks: a lesson's art direction ----
// Palette per theme, backdrop, grain, line style, fill style, cards and drifting motes, plus Google fonts. All
// procedural and seeded, so a texture is identical on every frame. A new look is a new entry here, never one-off
// colours inside a lesson. Keep ink and muted at 4.5:1 on bg and panel, accent 3:1 on bg, red/blue/teal 3:1 on panel.

const pal = (dark, t) => ({ dark, ...t });

const LOOKS = {
  /** A painted wall with a table ledge, speckled ceramic fills, graphs on pinned paper cards. */
  gouache: {
    mood: "warm, physical things as objects: cells, molecules, organs, kitchen science",
    fonts: { sans: "Inter", heading: "Fraunces", mono: "JetBrains Mono" },
    themes: {
      light: pal(false, { bg: "#8dbdb7", panel: "#f7f0e3", ink: "#172120", muted: "#26403d", faint: "#e2d8c5", accent: "#983717", red: "#d4553c", blue: "#285f80", teal: "#2d6f64", amber: "#c98f2a" }),
      dark: pal(true, { bg: "#1f3a3f", panel: "#274549", ink: "#f4ede1", muted: "#bfd0cb", faint: "#3b5d61", accent: "#f08a5d", red: "#f2735a", blue: "#8cc7e6", teal: "#7fd1bf", amber: "#f2c46b" }),
    },
    backdrop: "wall", table: 452, tableColor: { light: "#52615d", dark: "#132629" }, grain: 0.55, fill: "speckle", stroke: "clean", cards: true, motes: 18,
  },
  /** A chalk talk: smudged green board, chalky strokes, pastel chalk. */
  chalkboard: {
    mood: "step-by-step derivations, proofs, algorithms, the teacher at the board",
    fonts: { sans: "Nunito", heading: "Kalam", mono: "Space Mono" },
    themes: {
      light: pal(true, { bg: "#2c4a3f", panel: "#34564a", ink: "#f1f1e8", muted: "#c6d3cb", faint: "#4d6b5f", accent: "#f7d774", red: "#f4a09a", blue: "#a8d8ef", teal: "#b5ead7", amber: "#ffd79a" }),
      dark: pal(true, { bg: "#20362e", panel: "#294338", ink: "#f1f1e8", muted: "#c0cdc5", faint: "#42604f", accent: "#f7d774", red: "#f4a09a", blue: "#a8d8ef", teal: "#b5ead7", amber: "#ffd79a" }),
    },
    backdrop: "board", grain: 0.4, fill: "flat", stroke: "chalk", cards: false, motes: 10,
  },
  /** An engineering drawing: blue grid paper, crisp glowing lines. */
  blueprint: {
    mood: "machines, circuits, pressure and flow, anything built from parts",
    fonts: { sans: "IBM Plex Sans", heading: "IBM Plex Sans", mono: "IBM Plex Mono" },
    themes: {
      light: pal(true, { bg: "#1e4f8a", panel: "#245a9a", ink: "#eef4ff", muted: "#c3d6f2", faint: "#3d6ea8", accent: "#ffd166", red: "#ff9aa2", blue: "#9ad1ff", teal: "#8ff0d8", amber: "#ffd166" }),
      dark: pal(true, { bg: "#122f55", panel: "#183a66", ink: "#eef4ff", muted: "#b8cbe8", faint: "#2e5a8e", accent: "#ffd166", red: "#ff9aa2", blue: "#9ad1ff", teal: "#8ff0d8", amber: "#ffd166" }),
    },
    backdrop: "grid", grain: 0.15, fill: "flat", stroke: "glow", cards: false, motes: 0,
  },
  /** A risograph print: grainy cream paper, halftone fills, a second ink slightly out of register. */
  riso: {
    mood: "comparisons, classifications, lists with punch, money and markets",
    fonts: { sans: "Space Grotesk", heading: "Space Grotesk", mono: "Space Mono" },
    themes: {
      light: pal(false, { bg: "#f3ede1", panel: "#ebe3d3", ink: "#1f1d3a", muted: "#4b4866", faint: "#dcd3c1", accent: "#e8378e", red: "#e0356b", blue: "#1f5fae", teal: "#00796f", amber: "#c98a00" }),
      dark: pal(true, { bg: "#1e1c30", panel: "#28263e", ink: "#f3ede1", muted: "#c9c3d9", faint: "#3a3754", accent: "#ff6fb5", red: "#ff6f93", blue: "#79aef2", teal: "#5fd3c3", amber: "#f5c84c" }),
    },
    backdrop: "paper", grain: 0.7, fill: "halftone", stroke: "riso", misregister: { light: "#ff48b0", dark: "#ff48b0" }, cards: false, motes: 0,
  },
};

// Textures: painted once into small canvases, then tiled or stretched
const tiles = new Map();
function tile(key, w, h, paint) {
  if (!tiles.has(key)) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    paint(c.getContext("2d"));
    tiles.set(key, c);
  }
  return tiles.get(key);
}

/** Fine mono noise, like paper tooth. */
const grainTile = (dark) => tile(`grain-${dark}`, 160, 160, (c) => {
  const r = rand(7), img = c.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = img.data[i + 1] = img.data[i + 2] = r() < 0.5 ? 0 : 255;
    img.data[i + 3] = Math.floor(r() * (dark ? 22 : 28));
  }
  c.putImageData(img, 0, 0);
});

/** Vertical brush fibres for a painted wall, full-frame so the strokes don't visibly repeat. */
const brushTile = (dark) => tile(`brush-${dark}`, W, H, (c) => {
  const r = rand(11);
  for (let i = 0; i < 900; i++) {
    const x = r() * W, y = r() * H, len = 30 + r() * 140;
    c.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${(dark ? 0.03 : 0.07) * r()})` : `rgba(0,0,0,${(dark ? 0.12 : 0.06) * r()})`;
    c.lineWidth = 0.6 + r() * 2.2;
    c.beginPath();
    c.moveTo(x, y);
    c.bezierCurveTo(x + (r() - 0.5) * 6, y + len / 3, x + (r() - 0.5) * 6, y + (2 * len) / 3, x + (r() - 0.5) * 4, y + len);
    c.stroke();
  }
});

/** Soft cloudy smudges: chalk dust wiped across a board. */
const smudgeTile = () => tile("smudge", W, H, (c) => {
  const r = rand(23);
  for (let i = 0; i < 26; i++) {
    const x = r() * W, y = r() * H, rad = 60 + r() * 180;
    const g = c.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.02 + r() * 0.035})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
});

/** Glaze speckle for ceramic fills. */
const speckleTile = () => tile("speckle", 96, 96, (c) => {
  const r = rand(31);
  for (let i = 0; i < 150; i++) {
    c.fillStyle = r() < 0.72 ? `rgba(255,248,235,${0.35 + r() * 0.4})` : `rgba(40,20,10,${0.18 + r() * 0.2})`;
    c.beginPath();
    c.arc(r() * 96, r() * 96, 0.35 + r() * 1.1, 0, Math.PI * 2);
    c.fill();
  }
});

/** Halftone dots for print fills. */
const halftoneTile = () => tile("halftone", 8, 8, (c) => {
  c.fillStyle = "rgba(255,255,255,0.28)";
  c.beginPath();
  c.arc(2, 2, 1.3, 0, Math.PI * 2);
  c.arc(6, 6, 1.3, 0, Math.PI * 2);
  c.fill();
});

const patterns = new Map();
function pattern(ctx, key, source) {
  if (!patterns.has(key)) patterns.set(key, ctx.createPattern(source(), "repeat"));
  return patterns.get(key);
}

/** Set the frame's line and fill style from the look and paint its backdrop. defineLesson calls it every frame. */
function applyLook(ctx, look, th, t) {
  style.stroke = look.stroke;
  style.fill = look.fill;
  style.cards = look.cards;
  style.misregister = look.misregister?.[th.dark ? "dark" : "light"] ?? th.accent;
  style.texture = (kind) => (kind === "speckle" ? pattern(ctx, "speckle", speckleTile) : kind === "halftone" ? pattern(ctx, "halftone", halftoneTile) : null);
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, W, H);
  if (look.backdrop === "wall") {
    // Light falling from the upper left across the wall, brush fibres, then the table ledge and its shadow
    const g = ctx.createRadialGradient(W * 0.3, -H * 0.2, 0, W * 0.3, -H * 0.2, W * 1.1);
    g.addColorStop(0, alpha("#ffffff", th.dark ? 0.06 : 0.16));
    g.addColorStop(1, alpha("#000000", th.dark ? 0.18 : 0.06));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(brushTile(th.dark), 0, 0, W, H);
    const y = look.table;
    ctx.fillStyle = look.tableColor[th.dark ? "dark" : "light"];
    ctx.fillRect(0, y, W, H - y);
    ctx.fillStyle = alpha("#ffffff", 0.12);
    ctx.fillRect(0, y, W, 2);
    const sh = ctx.createLinearGradient(0, y - 14, 0, y);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,0.16)");
    ctx.fillStyle = sh;
    ctx.fillRect(0, y - 14, W, 14);
  } else if (look.backdrop === "board") {
    ctx.drawImage(smudgeTile(), 0, 0, W, H);
    ctx.strokeStyle = alpha("#000000", 0.25);
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, W - 10, H - 10);
  } else if (look.backdrop === "grid") {
    for (let x = 0; x <= W; x += 24) { ctx.fillStyle = alpha(th.ink, x % 120 === 0 ? 0.13 : 0.05); ctx.fillRect(x, 0, 1, H); }
    for (let y = 0; y <= H; y += 24) { ctx.fillStyle = alpha(th.ink, y % 120 === 0 ? 0.13 : 0.05); ctx.fillRect(0, y, W, 1); }
  } else if (look.backdrop === "paper") {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.75);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, alpha("#000000", th.dark ? 0.2 : 0.07));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (look.grain > 0) {
    ctx.save();
    ctx.globalAlpha = look.grain;
    ctx.fillStyle = pattern(ctx, `grain-${th.dark}`, () => grainTile(th.dark));
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  // Drifting motes (dust in a sunbeam, chalk dust): pure in t, so seeking is exact
  const r = rand(97);
  for (let i = 0; i < look.motes; i++) {
    const x0 = r() * W, y0 = r() * H, vx = (r() - 0.5) * 6, vy = -(3 + r() * 7), size = 0.8 + r() * 1.8, ph = r() * 6.28;
    const x = (((x0 + vx * t + Math.sin(t * 0.5 + ph) * 8) % W) + W) % W, y = (((y0 + vy * t) % H) + H) % H;
    circle(ctx, x, y, size, alpha(th.dark ? "#ffffff" : "#fffaf0", 0.18 + 0.22 * Math.sin(t * 0.8 + ph) ** 2));
  }
}

/** A paper card pinned with two strips of tape: the quiet surface coloured text needs on a textured backdrop. */
function card(ctx, th, x, y, w, h, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.shadowColor = alpha("#000000", th.dark ? 0.4 : 0.22);
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = th.panel;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.clip();
  ctx.globalAlpha *= 0.8;
  ctx.fillStyle = pattern(ctx, `grain-${th.dark}`, () => grainTile(th.dark));
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  for (const [tx, rot] of [[x + 34, -0.14], [x + w - 34, 0.12]]) {
    ctx.save();
    ctx.translate(tx, y + 2);
    ctx.rotate(rot);
    ctx.fillStyle = alpha(th.dark ? "#d9d0bf" : "#fff8e6", th.dark ? 0.35 : 0.7);
    ctx.fillRect(-26, -9, 52, 18);
    ctx.restore();
  }
  ctx.restore();
}
