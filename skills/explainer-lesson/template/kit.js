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

/**
 * The caption, burnt in below SAFE_BOTTOM. defineLesson draws it. Default: white on a dark rounded box. slip: ink on a
 * paper slip taped to the page (graphite). shown: characters typed so far (typed captions); the lines are laid out
 * for the whole text, so they never reflow while it types. o: { th, slip, shown, seed }.
 */
function caption(ctx, s, o = {}) {
  if (!s) return;
  const slip = o.slip && o.th, size = slip ? 20 : 21, line = size * 1.35, max = W * 0.8;
  ctx.save();
  ctx.font = `400 ${size}px ${slip ? fonts.mono : fonts.sans}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = [];
  for (const word of s.split(/\s+/)) {
    const last = lines.at(-1);
    if (last !== undefined && ctx.measureText(`${last} ${word}`).width <= max) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size * (slip ? 2.4 : 1.2), h = lines.length * line + size * (slip ? 1.1 : 0.5);
  const y = H * 0.95 - h;
  if (slip) {
    const th = o.th;
    ctx.translate(W / 2, y + h / 2);
    ctx.rotate((hash(o.seed ?? 0, 3) - 0.5) * 0.012); // each slip sits a hair crooked, and stays that way
    ctx.translate(-W / 2, -(y + h / 2));
    ctx.save();
    ctx.shadowColor = alpha("#000000", th.dark ? 0.5 : 0.25);
    ctx.shadowOffsetX = 3 * ctx.getTransform().a;
    ctx.shadowOffsetY = 4 * ctx.getTransform().a;
    ctx.shadowBlur = 3 * ctx.getTransform().a;
    ctx.fillStyle = th.panel;
    ctx.fillRect(W / 2 - w / 2, y, w, h);
    ctx.restore();
    for (const [tx, rot] of [[W / 2 - w / 2 + 18, -0.3], [W / 2 + w / 2 - 18, 0.26]]) {
      ctx.save();
      ctx.translate(tx, y + 1);
      ctx.rotate(rot);
      ctx.fillStyle = alpha("#dbd6b7", th.dark ? 0.45 : 0.8);
      ctx.fillRect(-22, -8, 44, 16);
      ctx.restore();
    }
    ctx.fillStyle = th.ink;
  } else {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    roundRect(ctx, W / 2 - w / 2, y, w, h, 6);
    ctx.fill();
    ctx.fillStyle = "#fff";
  }
  let left = o.shown ?? Infinity;
  lines.forEach((l, i) => {
    if (left <= 0) return;
    const part = l.slice(0, left);
    left -= l.length + 1;
    // typed: draw the typed part from where the whole line starts, so letters never shift as more arrive
    const x = part === l ? W / 2 : W / 2 - ctx.measureText(l).width / 2 + ctx.measureText(part).width / 2;
    ctx.fillText(part, x, y + size * (slip ? 0.55 : 0.25) + line * (i + 0.5));
  });
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
  /**
   * Pencil on grey paper, shot as stop-motion. Measured off a hand-drawn explainer: 12 fps, 3 boiling drawings, ±2 px
   * whole-pixel jitter, ±1.2 % flicker, paper #ECECE6 falling to #BDC0BB in the corners, double-pass graphite lines,
   * 45° hachure, colour only in thin blue and red pencil and a highlighter, captions on taped paper slips.
   * The hands come in one weight, so 700 is synthesised: keep text at 400–500.
   */
  graphite: {
    mood: "algorithms, data structures and step-by-step mechanisms as a notebook sketch; first-person explainers",
    fonts: { sans: "Patrick Hand", heading: "Caveat", mono: "Special Elite" },
    themes: {
      light: pal(false, { bg: "#ECECE6", panel: "#F5F5EF", ink: "#383933", muted: "#4E4F49", faint: "#C9CBC4", accent: "#625FB8", red: "#AC505B", blue: "#625FB8", teal: "#2F7468", amber: "#8A6A12", highlight: "#E1DDA9" }),
      dark: pal(true, { bg: "#2A2B28", panel: "#34352F", ink: "#E7E6DF", muted: "#B3B2AA", faint: "#4A4B46", accent: "#AFACF2", red: "#F0A0A8", blue: "#AFACF2", teal: "#8ED5C6", amber: "#E8CF7A", highlight: "#6A6232" }),
    },
    backdrop: "pencil", vignette: 0.19, grain: 0.3, fill: "hachure", stroke: "graphite", cards: true, motes: 0,
    caption: "slip", shadow: [3, 4, 3, 0.25], stop: { fps: 12, boil: 3, jitter: 1.5, flicker: 0.012 },
  },
  /**
   * Hairlines on pale paper: four greys and one ink accent. No fills: a shape is paper (the ground) with an outline, so
   * near hides far and it still reads as line art. Colour marks the one thing being discussed. Pairs with iso.js.
   */
  hairline: {
    mood: "data stories, systems and devices in plan and isometric, precise and quiet; colour only on the one highlight",
    fonts: { sans: "Geist", heading: "Geist", mono: "Geist Mono" },
    themes: {
      light: pal(false, { bg: "#EAEAE4", panel: "#F4F4F0", ink: "#1D1916", muted: "#64605D", faint: "#D6D2CE", accent: "#D2491F", red: "#C2402A", blue: "#2F5BC8", teal: "#1F7A6B", amber: "#9A6B00", highlight: "#F3D9C9" }),
      dark: pal(true, { bg: "#191918", panel: "#222220", ink: "#ECEBE6", muted: "#9C9B95", faint: "#3A3936", accent: "#FF7A4D", red: "#FF8A70", blue: "#8FB0FF", teal: "#6FD6C2", amber: "#E8B94A", highlight: "#4A2A1E" }),
    },
    backdrop: "flat", grain: 0.12, fill: "plate", stroke: "clean", weight: 0.55, cards: false, motes: 0,
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
  style.weight = look.weight ?? 1;
  style.knockout = look.fill === "hachure" || look.fill === "plate";
  style.ink = th.ink;
  style.paper = look.fill === "plate" ? th.bg : th.panel; // hairline plates are the ground itself
  style.shadow = look.shadow;
  style.grain = look.grain;
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
  } else if (look.backdrop === "pencil") {
    // Paper under a lamp: measured −14 % at the side edges and −19 % (vignette) in the corners
    const R = Math.hypot(W / 2, H / 2), g = ctx.createRadialGradient(W / 2, H / 2, R * 0.25, W / 2, H / 2, R);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.83, alpha("#000000", look.vignette * 0.74));
    g.addColorStop(1, alpha("#000000", look.vignette));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
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

/**
 * A paper thing dropping onto the page, as graphite's cards do (measured): it lands from 30 units up, turned up to 8°,
 * settles in 0.2 s (2-3 stop-motion drawings), then idles within 0.6°. Nothing fades in. fn() draws it around (x, y).
 */
function settle(ctx, t, t0, x, y, seed, fn) {
  if (t < t0) return;
  const p = span(t, t0, t0 + 0.2, ease.out), turn = hash(seed, 1) < 0.5 ? -0.14 : 0.14;
  ctx.save();
  ctx.translate(x, y - (1 - p) * 30);
  ctx.rotate(turn * (1 - p) + Math.sin(t * 1.3 + seed) * 0.0105);
  ctx.translate(-x, -y);
  fn();
  ctx.restore();
}

/** A paper card pinned with two strips of tape: the quiet surface coloured text needs on a textured backdrop. */
function card(ctx, th, x, y, w, h, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  // A look's hard shadow ([dx, dy, blur, alpha], graphite) means paper cut square; else a soft drop under a rounded card
  const [dx, dy, blur, sa] = style.shadow ?? [0, 8, 22, 0.22], k = style.shadow ? ctx.getTransform().a : 1;
  ctx.shadowColor = alpha("#000000", th.dark ? Math.min(1, sa * 1.8) : sa);
  ctx.shadowBlur = blur * k;
  ctx.shadowOffsetX = dx * k;
  ctx.shadowOffsetY = dy * k;
  roundRect(ctx, x, y, w, h, style.shadow ? 2 : 10);
  ctx.fillStyle = th.panel;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.save();
  ctx.clip();
  ctx.globalAlpha *= 0.8 * Math.min(1, style.grain / 0.55); // as grainy as the look's backdrop: clean paper for graphite
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

// ---- data story: counts as proof, callouts, routes, the clock, the lift, the grade, the highlighter ----

/**
 * A number counting from `from` to `to` over [at, at + dur] (script time). exp counts in equal ratios, so 1 → 500,000
 * spends as long reaching 700 as going from 700 to 500,000, and a huge number still reads as counting.
 * c: { at, dur, from, to, exp?, ease? (ease.out), format? (v => string; default a rounded, comma-grouped integer) }
 */
function countAt(t, c) {
  const p = span(t, c.at, c.at + c.dur, c.ease ?? ease.out);
  return c.exp ? c.from * (c.to / c.from) ** p : lerp(c.from, c.to, p);
}
const countText = (v, c) => (c.format ? c.format(v) : Math.round(v).toLocaleString("en-US"));

/** The sound of a count: a cue each time the shown number changes, at most `rate` a second, pitch rising by `step`. */
function countCues(c, sound = "tick", o = {}) {
  const rate = o.rate ?? 12, out = [];
  let shown = countText(countAt(c.at, c), c);
  for (let k = 1; k <= Math.ceil(c.dur * rate); k++) {
    const t = c.at + Math.min(c.dur, k / rate), now = countText(countAt(t, c), c);
    if (now !== shown) out.push({ at: t, sound, gain: o.gain, pitch: (o.pitch ?? 1) + out.length * (o.step ?? 0) });
    shown = now;
  }
  return out;
}

/**
 * A label on a leader line from a point on the drawing: a value read off the thing it belongs to. With `count` the
 * number ticks (the count is the proof); give the same count to countCues() for its sound. `to` is the number's
 * baseline start, or its end with align: 'right' (for a label left of its point). o: { from: [x, y], to: [x, y], a,
 * label, value?, count?, color?, size? (28), align? }
 */
function callout(ctx, th, t, o) {
  if (o.a <= 0) return;
  const [x0, y0] = o.from, [x1, y1] = o.to, size = o.size ?? 28, right = o.align === "right", side = right ? 10 : -10;
  ctx.save();
  ctx.globalAlpha *= clamp(o.a);
  // from above, the leader stops over the label; from beside, at the number's side. Never through the words
  const top = y1 - size - 22, end = y0 < top ? [x1 + side / 2, top] : [x1 + side, y1 - size * 0.35];
  path(ctx, [[x0, y0], end], th.muted, 1.5, clamp(o.a * 1.5));
  circle(ctx, x0, y0, 3.5, th.ink);
  const align = right ? "right" : "left", v = o.count ? countText(countAt(t, o.count), o.count) : o.value;
  text(ctx, o.label, x1, y1 - size - 4, { size: 16, color: th.muted, font: "mono", align });
  if (v !== undefined) text(ctx, v, x1, y1, { size, weight: 500, color: o.color ?? th.ink, font: "mono", align });
  ctx.restore();
}

/** Length of a polyline, and the point at distance d along it. */
const polyLength = (pts) => pts.reduce((s, q, i) => (i ? s + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0), 0);
function along(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], l = Math.hypot(x1 - x0, y1 - y0);
    if (d <= l || i === pts.length - 1) { const k = clamp(d / (l || 1)); return [lerp(x0, x1, k), lerp(y0, y1, k)]; }
    d -= l;
  }
  return pts[0];
}

/**
 * A journey drawn on from its start: the path grows with `p` with a dot riding its tip, then `dots` dots loop along it
 * (data moving, a flow, a commute). Returns the tip. o: { p (1), dots (0), speed (loops a second, 0.4), dash, lw (2.5), color }
 */
function route(ctx, th, t, pts, o = {}) {
  const p = clamp(o.p ?? 1), color = o.color ?? th.accent, lw = o.lw ?? 2.5;
  if (p <= 0) return null;
  ctx.save();
  if (o.dash) ctx.setLineDash(o.dash);
  path(ctx, pts, color, lw, p);
  ctx.restore();
  const L = polyLength(pts), tip = along(pts, L * p);
  if (p < 1) circle(ctx, tip[0], tip[1], lw + 2.5, color);
  for (let i = 0; i < (o.dots ?? 0); i++) {
    const q = along(pts, L * p * ((((i / o.dots + t * (o.speed ?? 0.4)) % 1) + 1) % 1));
    circle(ctx, q[0], q[1], lw + 1, color);
  }
  return tip;
}

/** A pill with a small clock and a mono label, for time passing ("05:30", "day 3", "40 ms"). turns spins the minute hand. Left edge x, centred on y. */
function clockPill(ctx, th, x, y, a, label, turns = 0) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= clamp(a);
  ctx.font = `500 16px ${fonts.mono}`;
  roundRect(ctx, x, y - 17, ctx.measureText(label).width + 54, 34, 17);
  ctx.fillStyle = th.panel;
  ctx.fill();
  ctx.strokeStyle = th.faint;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  circle(ctx, x + 20, y, 9, undefined, th.ink, 1.5);
  for (const [len, ang] of [[5, turns / 12], [7.5, turns]]) path(ctx, [[x + 20, y], [x + 20 + Math.sin(ang * 6.283) * len, y - Math.cos(ang * 6.283) * len]], th.ink, 1.5);
  text(ctx, label, x + 38, y + 6, { size: 16, weight: 500, color: th.ink, font: "mono" });
  ctx.restore();
}

/**
 * The flat plan rising into 3D on the same coordinates (needs iso.js, which the setup line copies in). p 0 is the plan
 * exactly as drawn, in canvas units; p 1 is the oblique view `to`. `pin` stays put on screen. Returns P(x, y, z) ->
 * [sx, sy] for plan points at height z (canvas units, z up) and the ISO camera C for ISO.slab and ISO.face. Draw a
 * box's top at z = h and it rises out of the plan as the view tilts; S shrinks the 3D view to fit. Ease p, and put a
 * `swell` under it.
 */
function lift(p, { pin = [W / 2, 280], to = { az: 30, el: 35 }, S = 1 } = {}) {
  const C = ISO.lift(clamp(p), { from: { az: 0, el: 90 }, to, S: lerp(1, S, clamp(p)), at: [pin[0], pin[1], 0], cx: pin[0], cy: pin[1] });
  return { C, P: (x, y, z = 0) => ISO.P(C, x, y, z) };
}

/**
 * Wash everything drawn so far with `color` at strength k (0..1): multiply darkens toward night, screen lifts toward
 * dawn, soft-light tints, source-over fades. Works in device pixels, so a jittered frame is covered to its edges.
 * Call it last in scene(): the caption is drawn after, ungraded.
 */
function grade(ctx, color, k, mode = "multiply") {
  if (k <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = clamp(k);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** A highlighter swiped over [x, y, w, h] from left to right as p goes 0 → 1. Draw it over the words it marks. */
function highlight(ctx, th, x, y, w, h, p) {
  if (p <= 0) return;
  const ww = w * clamp(p);
  ctx.save();
  ctx.globalCompositeOperation = th.dark ? "screen" : "multiply";
  ctx.globalAlpha *= 0.75;
  ctx.fillStyle = th.highlight ?? mix(th.amber, th.bg, 0.55);
  ctx.beginPath(); // a slanted chisel tip at each end
  ctx.moveTo(x + 3, y);
  ctx.lineTo(x + ww, y + 1);
  ctx.lineTo(x + ww - 3, y + h);
  ctx.lineTo(x, y + h - 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
