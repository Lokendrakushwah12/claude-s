// THE lesson file: replace this example with your own. It holds only what is specific to the topic: its drawings,
// its storyboard and its numbers. Plot, panel, chrome, looks, music and timing come from engine.js and kit.js.
//
// Example: why a heat pump delivers more heat than the electricity it uses. Every number is checked against two
// sources (see `sources`): COP = Qh / W and the Carnot ceiling Th / (Th − Tc) from OpenStax, a typical COP of 3 to 4
// from the IEA and the Centre for Sustainable Energy, the cold-climate floor from ENERGY STAR, propane's boiling point.

const TH = 20; // indoor temperature, °C (OpenStax example 4.3: 0 °C outside, 20 °C inside)
const carnot = (tc) => (TH + 273.15) / (TH - tc); // the best possible heating COP, temperatures in kelvin
const degC = (v) => { const r = Math.round(v); return `${r < 0 ? "−" : ""}${Math.abs(r)} °C`; }; // never "−0 °C"

// Beat times shared by the picture and the sound (rule 4: one list of numbers)
const HEATER = 2.4, PUMP = 5.4, OUT = 7.0, OUT_GAP = 0.6, ASK = 9.0;
const HOUSE = 10.7, ARROW = 12.6, PIPES = 15.0, PROPANE = 19.0, AIR = 22.0, SQUEEZE = 27.0, ROOM = 31.6, VALVE = 34.0, HEAT_GAP = 0.5;
const ELEC = 37.6, AIRB = 38.8, HEAT = 40.4, COP = 43.4;
const AXES = 48.9, CURVE = 51.8, MARK = 56.0, COLD = [58.6, 60.6], TYPICAL = 62.0, FLOOR = 64.0;
const RECAP = 68.3, CHIPS = 68.8, CHIP_GAP = 0.9;

// ---- 01: two machines, the same 1 kWh in ----

const UNIT = { w: 56, h: 34 };
/** Centre of block i in a row of n centred on x. */
const blockX = (x, n, i) => x - (n * UNIT.w + (n - 1) * 8) / 2 + i * (UNIT.w + 8) + UNIT.w / 2;
/** A row of kWh blocks centred on x, the i-th popping in at times[i]. */
function blocks(ctx, th, t, x, y, color, times, a) {
  times.forEach((t0, i) => {
    const p = span(t, t0, t0 + 0.45, ease.back);
    at(ctx, blockX(x, times.length, i), y + UNIT.h / 2, p, a * clamp(p * 2), () => {
      roundRect(ctx, -UNIT.w / 2, -UNIT.h / 2, UNIT.w, UNIT.h, 6);
      fillWith(ctx, color, [-UNIT.w / 2, -UNIT.h / 2, UNIT.w, UNIT.h]);
      text(ctx, "1 kWh", 0, 6, { size: 16, weight: 500, color: onColor(color), align: "center" });
    });
  });
}

/** An electric heater: a panel with three glowing elements. */
function heater(ctx, th, t, on) {
  roundRect(ctx, -75, -32, 150, 64, 10);
  ctx.strokeStyle = th.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const y of [-14, 0, 14]) path(ctx, [[-56, y], [56, y]], mix(th.faint, th.red, on * (0.8 + 0.2 * Math.sin(t * 6 + y))), 4);
}

/** An outdoor heat-pump unit: a box with a turning fan. */
function pumpUnit(ctx, th, t, on) {
  roundRect(ctx, -75, -32, 150, 64, 10);
  ctx.strokeStyle = th.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  circle(ctx, -24, 0, 24, undefined, th.muted, 2);
  for (let k = 0; k < 3; k++) {
    const a = t * 6 * on + (k * Math.PI * 2) / 3;
    path(ctx, [[-24, 0], [-24 + Math.cos(a) * 20, Math.sin(a) * 20]], th.blue, 3);
  }
  for (const x of [20, 34, 48]) path(ctx, [[x, -18], [x, 18]], th.muted, 2);
}

function column(ctx, th, t, x, name, from, inAt, outs, draw) {
  const a = life(t, from, 11, 0.5, 0.6);
  if (a <= 0) return;
  text(ctx, name, x, 196 - (1 - a) * 8, { size: 22, weight: 500, color: th.ink, align: "center", alpha: a });
  blocks(ctx, th, t, x, 214, th.amber, [inAt], a);
  arrow(ctx, [x, 252], [x, 270], th.amber, 2.5, span(t, inAt + 0.3, inAt + 0.7) * a);
  at(ctx, x, 307, 1, a, () => draw(ctx, th, t, span(t, inAt + 0.5, inAt + 1)));
  arrow(ctx, [x, 343], [x, 358], th.red, 2.5, span(t, outs[0] - 0.4, outs[0]) * a);
  blocks(ctx, th, t, x, 362, th.red, outs, a);
}

// ---- 02: the refrigerant loop, the lesson's signature drawing ----

// One closed pipe, in flow order: evaporator coil, compressor, condenser coil, expansion valve, back
const LOOP = [
  [220, 320], [100, 320], [100, 295], [220, 295], [220, 270], [100, 270], [100, 245], [220, 245], // evaporator
  [300, 245], [300, 210], [334, 210], // to the compressor
  [386, 210], [640, 210], [640, 245], [690, 245], // hot vapour, through the wall
  [810, 245], [810, 270], [690, 270], [690, 295], [810, 295], [810, 320], [690, 320], // condenser
  [640, 320], [640, 355], [380, 355], // warm liquid to the valve
  [340, 355], [250, 355], [250, 320], [220, 320], // cold again, back outside
];
const SEG = [0];
for (let i = 1; i < LOOP.length; i++) SEG.push(SEG[i - 1] + Math.hypot(LOOP[i][0] - LOOP[i - 1][0], LOOP[i][1] - LOOP[i - 1][1]));
const LEN = SEG.at(-1);
const frac = (i) => SEG[i] / LEN; // where vertex i sits along the loop, 0..1
const PART = { comp: frac(11), cond: frac(15), condOut: frac(21), valve: frac(25) };
function pointAt(s) {
  const d = (((s % 1) + 1) % 1) * LEN;
  let i = 1;
  while (SEG[i] < d) i++;
  const k = (d - SEG[i - 1]) / (SEG[i] - SEG[i - 1] || 1);
  return [lerp(LOOP[i - 1][0], LOOP[i][0], k), lerp(LOOP[i - 1][1], LOOP[i][1], k)];
}
/** Refrigerant temperature as colour: cold everywhere until the compressor is explained, then hot after it. */
function refColor(th, s, t) {
  const hot = span(t, SQUEEZE, SQUEEZE + 0.8), cool = span(t, ROOM - 0.4, ROOM + 0.6);
  if (s >= PART.comp && s < PART.cond) return mix(th.blue, th.red, hot);
  if (s >= PART.cond && s < PART.condOut) return mix(th.blue, mix(th.red, th.amber, cool * ((s - PART.cond) / (PART.condOut - PART.cond))), hot);
  if (s >= PART.condOut && s < PART.valve) return mix(th.blue, th.amber, hot * cool);
  return th.blue;
}
// Flow phase: still until the pipes are drawn, then a steady circulation (monotonic, so it never runs backwards)
const flow = (t) => 0.035 * Math.max(0, t - PIPES - 1.4) * span(t, PIPES + 1.4, PIPES + 2.4);
const FLAKES = (() => { const r = rand(5); return Array.from({ length: 26 }, () => [40 + r() * 400, r() * 340, 0.6 + r() * 1.4, r() * 6]); })();

function house(ctx, th, t, a) {
  const draw = span(t, HOUSE, HOUSE + 1.2);
  ctx.save();
  ctx.globalAlpha *= a;
  // snow falling outside, a warm glow growing inside as the condenser delivers
  for (const [x0, y0, s, ph] of FLAKES) {
    const y = 60 + ((y0 + t * 16 * s) % 330), x = x0 + Math.sin(t * 0.8 + ph) * 6;
    circle(ctx, x, y, 1.2 + s, alpha(th.ink, 0.35 * span(t, HOUSE, HOUSE + 1)));
  }
  const walls = [[470, 392], [470, 150], [685, 92], [900, 150], [900, 392]];
  const warm = span(t, ROOM, ROOM + 2.5);
  if (warm > 0) {
    ctx.save();
    ctx.beginPath();
    walls.forEach((p) => ctx.lineTo(...p));
    ctx.clip(); // inside the house only, so the glow has no hard edge
    const g = ctx.createRadialGradient(750, 285, 10, 750, 285, 260);
    g.addColorStop(0, alpha(th.red, 0.24 * warm));
    g.addColorStop(1, alpha(th.red, 0));
    ctx.fillStyle = g;
    ctx.fillRect(470, 92, 430, 300);
    ctx.restore();
  }
  path(ctx, [[40, 392], [920, 392]], th.muted, 2, draw);
  path(ctx, walls, th.ink, 3, draw);
  text(ctx, `Outside · ${degC(0)}`, 60, 130, { size: 20, weight: 500, color: th.ink, alpha: span(t, ARROW - 0.2, ARROW + 0.3) });
  text(ctx, `Inside · ${degC(TH)}`, 700, 186, { size: 20, weight: 500, color: th.ink, alpha: span(t, ARROW + 0.2, ARROW + 0.7) });
  // The idea first: heat goes from the cold side to the warm side
  const big = life(t, ARROW, PIPES + 0.2, 0.4, 0.6);
  if (big > 0) {
    ctx.save();
    ctx.globalAlpha *= big;
    arrow(ctx, [150, 290], [820, 290], th.red, 9, span(t, ARROW, ARROW + 1.4, ease.out));
    text(ctx, "heat", 300, 270, { size: 20, weight: 500, color: th.ink });
    ctx.restore();
  }
  // Pipes, then the parts on them
  path(ctx, LOOP, alpha(th.ink, 0.55), 7, span(t, PIPES, PIPES + 1.4));
  const parts = span(t, PIPES + 0.8, PIPES + 1.4);
  for (let i = 0; i < 40; i++) {
    const s = i / 40 + flow(t), [x, y] = pointAt(s);
    circle(ctx, x, y, 3.2, alpha(refColor(th, ((s % 1) + 1) % 1, t), parts));
  }
  // compressor (squeezes on its beat) and expansion valve
  const squeeze = 1 - 0.18 * pulse(t, SQUEEZE, 0.5);
  at(ctx, 360, 210, squeeze, parts, () => { circle(ctx, 0, 0, 26, th.bg, th.ink, 3); path(ctx, [[-12, 8], [0, -10], [12, 8]], th.ink, 3); });
  at(ctx, 360, 355, 1, parts, () => {
    ctx.beginPath();
    ctx.moveTo(-18, -12); ctx.lineTo(18, 12); ctx.lineTo(18, -12); ctx.lineTo(-18, 12); ctx.closePath();
    ctx.fillStyle = th.bg; ctx.fill(); ctx.strokeStyle = th.ink; ctx.lineWidth = 2.5; ctx.stroke();
  });
  // Labels, each on the beat that explains it
  const label = (s, x, y, from) => text(ctx, s, x, y, { size: 16, weight: 500, color: th.muted, align: "center", font: "mono", alpha: span(t, from, from + 0.5) });
  label("EVAPORATOR", 140, 366, PROPANE - 2.7);
  label("COMPRESSOR", 360, 170, SQUEEZE - 0.8);
  label("CONDENSER", 750, 366, ROOM - 0.4);
  label("EXPANSION VALVE", 360, 334, VALVE);
  pill(ctx, `propane boils at ${degC(-42)} (1 atm)`, 160, 212, { fill: th.panel, color: th.ink, alpha: span(t, PROPANE, PROPANE + 0.4) });
  // heat from the 0 °C air into the colder coil; bubbles once it boils
  for (let i = 0; i < 3; i++) arrow(ctx, [40, 258 + i * 26], [88, 258 + i * 26], th.red, 2.5, stagger(t, AIR, i, HEAT_GAP, 0.5, ease.out));
  const boil = span(t, AIR + 1.4, AIR + 2);
  if (boil > 0) for (let i = 0; i < 12; i++) {
    const r = (t * 0.9 + i / 12) % 1, x = 110 + ((i * 37) % 100), y = 330 - r * 95;
    circle(ctx, x, y, 2 + r * 2, undefined, alpha(th.ink, boil * (1 - r) * 0.8), 1.2);
  }
  pill(ctx, "hotter than the room", 560, 186, { fill: th.red, color: onColor(th.red), alpha: span(t, SQUEEZE + 1, SQUEEZE + 1.4) });
  for (let i = 0; i < 3; i++) arrow(ctx, [818, 258 + i * 26], [880, 258 + i * 26], th.red, 2.5, stagger(t, ROOM, i, HEAT_GAP, 0.5, ease.out));
  pill(ctx, "pressure drops: cold again", 520, 380, { fill: th.blue, color: onColor(th.blue), alpha: span(t, VALVE + 0.4, VALVE + 0.8) });
  ctx.restore();
}

// ---- 03: the energy budget ----

function budget(ctx, th, t) {
  const a = life(t, ELEC - 0.4, 48.8, 0.4, 0.6);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const U = 48, base = 372;
  const slab = (x, y, h, color, label, p) => at(ctx, x + 60, y + h / 2 - (1 - p) * 40, 1, clamp(p * 2), () => {
    roundRect(ctx, -60, -h / 2, 120, h, 8);
    fillWith(ctx, color, [-60, -h / 2, 120, h]);
    text(ctx, label, 0, 7, { size: 20, weight: 700, color: onColor(color), align: "center" });
  });
  slab(230, base - U, U, th.amber, "1 kWh", span(t, ELEC, ELEC + 0.5, ease.out));
  slab(230, base - 3 * U, 2 * U, th.blue, "2 kWh", span(t, AIRB, AIRB + 0.5, ease.out));
  text(ctx, "electricity", 216, base - U / 2 + 6, { size: 18, color: th.ink, align: "right", alpha: span(t, ELEC + 0.3, ELEC + 0.7) });
  text(ctx, "from outside air", 216, base - 2 * U + 6, { size: 18, color: th.ink, align: "right", alpha: span(t, AIRB + 0.3, AIRB + 0.7) });
  text(ctx, "=", 410, base - 1.5 * U + 14, { size: 44, weight: 500, color: th.ink, align: "center", alpha: span(t, HEAT - 0.4, HEAT) });
  const grow = span(t, HEAT, HEAT + 1.2);
  if (grow > 0) {
    roundRect(ctx, 470, base - 3 * U * grow, 120, 3 * U * grow, 8);
    fillWith(ctx, th.red, [470, base - 3 * U, 120, 3 * U]);
    text(ctx, "3 kWh", 530, base - 1.5 * U + 7, { size: 20, weight: 700, color: onColor(th.red), align: "center", alpha: span(t, HEAT + 1, HEAT + 1.3) });
  }
  text(ctx, "heat to the house", 530, base - 3 * U - 16, { size: 18, color: th.ink, align: "center", alpha: span(t, HEAT + 1.2, HEAT + 1.6) });
  readout(ctx, th, 650, 250, span(t, COP, COP + 0.6), th.accent, "COP = heat ÷ electricity", "3 kWh ÷ 1 kWh = 3");
  readout(ctx, th, 650, 330, span(t, COP + 2.2, COP + 2.8), th.teal, "A typical home unit", "COP 3 to 4");
  ctx.restore();
}

// ---- 04: the ceiling ----

const g = plot({
  box: { x0: 110, x1: 560, y0: 372, y1: 92 },
  x: { min: -20, max: 5, ticks: [-20, -15, -10, -5, 0, 5], label: "Outdoor temperature (°C)", format: (v) => (v < 0 ? `−${-v}` : String(v)) },
  y: { min: 0, max: 20, ticks: [5, 10, 15, 20], label: "Heating COP" },
});
const PANEL = 620;

function ceiling(ctx, th, t) {
  const a = life(t, AXES - 0.4, 67.6, 0.4, 0.6);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  g.axes(ctx, th, t, AXES);
  g.band(ctx, th, -20, 0, th.blue, span(t, COLD[0] - 1.2, COLD[0] - 0.6), "below freezing", true);
  const tip = g.curve(ctx, carnot, th.teal, 4, span(t, CURVE, CURVE + 3));
  if (tip && t < CURVE + 3) circle(ctx, tip[0], tip[1], 6, th.teal);
  const typical = span(t, TYPICAL, TYPICAL + 0.8);
  if (typical > 0) {
    dashed(ctx, [g.X(-20), g.Y(4)], [g.X(5), g.Y(4)], th.amber, 2.5, typical);
    text(ctx, "typical ≈ 4", g.X(5) - 4, g.Y(4) - 10, { size: 16, weight: 500, color: th.ink, align: "right", alpha: typical });
  }
  const tc = lerp(0, -15, span(t, COLD[0], COLD[1]));
  g.marker(ctx, th, tc, carnot(tc), th.teal, span(t, MARK, MARK + 0.5));
  g.marker(ctx, th, -15, 1.75, th.red, span(t, FLOOR, FLOOR + 0.5));
  header(ctx, th, PANEL, 112, span(t, AXES + 0.6, AXES + 1.2), "Carnot ceiling", "max COP = T hot ÷ (T hot − T cold)", th.teal);
  text(ctx, "temperatures in kelvin", PANEL, 160, { size: 16, color: th.muted, alpha: span(t, AXES + 0.9, AXES + 1.5) });
  const k = (v) => Math.round(v + 273);
  readout(ctx, th, PANEL, 214, span(t, MARK, MARK + 0.6), th.teal, `${degC(tc)} out, ${degC(TH)} in`, `${k(TH)} ÷ ${Math.round(TH - tc)} ≈ ${carnot(tc).toFixed(1)}`);
  legend(ctx, th, t, PANEL, 290, TYPICAL + 0.2, [["Ceiling", "Carnot", th.teal], ["Typical", "≈ 4", th.amber]]);
  readout(ctx, th, PANEL, 384, span(t, FLOOR, FLOOR + 0.6), th.red, "Cold-climate rule", `COP ≥ 1.75 at ${degC(-15)}`);
  ctx.restore();
}

// ---- the film ----

function scene({ ctx, t, theme: th }) {
  titleCard(ctx, th, t, ["Why does a heat pump move", "more heat than it uses?"], 0.2, 3.8);
  text(ctx, "IN", 60, 238, { size: 16, weight: 500, color: th.muted, font: "mono", alpha: life(t, HEATER, 11, 0.5, 0.6) });
  text(ctx, "OUT", 60, 386, { size: 16, weight: 500, color: th.muted, font: "mono", alpha: life(t, HEATER, 11, 0.5, 0.6) });
  column(ctx, th, t, 300, "Electric heater", HEATER, HEATER + 0.6, [HEATER + 1.5], heater);
  column(ctx, th, t, 680, "Heat pump", PUMP, PUMP + 0.6, [0, 1, 2].map((i) => OUT + i * OUT_GAP), pumpUnit);
  // the question: where do the other two come from?
  for (const i of [1, 2]) {
    const q = span(t, ASK + (i - 1) * 0.3, ASK + (i - 1) * 0.3 + 0.4, ease.back) * life(t, ASK, 11, 0.1, 0.6);
    at(ctx, blockX(680, 3, i) + UNIT.w / 2 - 4, 355, q, q, () => { blob(ctx, 0, 0, 12, th.amber); text(ctx, "?", 0, 6, { size: 16, weight: 700, color: onColor(th.amber), align: "center" }); });
  }

  const h = life(t, HOUSE, 37.2, 0.2, 0.8);
  if (h > 0) house(ctx, th, t, h);
  budget(ctx, th, t);
  ceiling(ctx, th, t);

  const r = life(t, RECAP, 74.4, 0.5, 0.6); // gone before the end card, so nothing ghosts through it
  header(ctx, th, 280, 150, r, "Remember", "a heater makes heat; a heat pump moves it", th.accent);
  chipList(ctx, th, t, { x: 280, y: 214, at: CHIPS, gap: CHIP_GAP, rowHeight: 52, color: th.teal, alpha: r, items: [
    ["1", "A heater: 1 kWh in, 1 kWh of heat out"],
    ["3", "A heat pump: COP 3 to 4, most of it from outside"],
    ["T", "Colder outside, lower ceiling: Th ÷ (Th − Tc)"],
  ] });
}

const LESSON = defineLesson({
  title: "Why does a heat pump move more heat than it uses?",
  // An engineering drawing for a machine built from parts, with flow
  look: "blueprint",
  theme: "light",
  duration: 77,
  chapters: [
    { at: 0, title: "Same electricity" },
    { at: 11, title: "Moving, not making" },
    { at: 37, title: "The energy budget" },
    { at: 49, title: "The ceiling" },
    { at: 67.5, title: "Recap" },
  ],
  // `hold` pins where a beat rests when its narration runs long: on the finished picture, before it clears away
  captions: [
    { at: 0, text: "An electric heater turns 1 kWh of electricity into 1 kWh of heat." },
    { at: 5, text: "A heat pump turns the same 1 kWh into about 3. Where do the other 2 come from?", hold: 9.8 },
    { at: 11, text: "It doesn't make that heat. It moves it, out of the cold air outside." },
    { at: 16, text: "Its pipes hold a refrigerant that boils far below freezing: propane boils at −42 °C." },
    { at: 21.5, text: "So even 0 °C air is warm to it. Heat flows in, and the liquid boils." },
    { at: 26, text: "The compressor squeezes that vapour, and squeezing a gas heats it past room temperature." },
    { at: 31, text: "Indoors it condenses, giving its heat to the room. A valve drops the pressure, and round it goes.", hold: 35.6 },
    { at: 37, text: "Energy is conserved: 1 kWh of electricity plus 2 from outside makes 3 kWh of heat." },
    { at: 43, text: "Heat out over electricity in is the coefficient of performance, COP. Home units manage 3 to 4.", hold: 47.2 },
    { at: 49, text: "Physics sets a ceiling: COP can't beat T hot ÷ (T hot − T cold), in kelvin.", say: "Physics sets a ceiling. The COP can't beat T hot, divided by T hot minus T cold, in kelvin." },
    { at: 55.5, text: "From 0 °C outside to 20 °C inside, that ceiling is about 15. Colder air, lower ceiling." },
    { at: 61.5, text: "Real machines fall well short: about 4 is typical, and cold-climate models must manage 1.75 at −15 °C.", hold: 65.6 },
    { at: 67.5, text: "So a heater makes heat, but a heat pump moves it. Most of its heat was already outside.", hold: 72.4 },
    { at: 74, text: "" },
  ],
  pronounce: { COP: "C O P" },
  cues: [
    { at: 0.3, sound: "chime", gain: 0.6, pitch: 0.75 },
    { at: HEATER, sound: "pop" },
    { at: HEATER + 0.6, sound: "blip" },
    { at: HEATER + 1.5, sound: "pop", pitch: 0.9 },
    { at: PUMP, sound: "pop", pitch: 1.1 },
    { at: PUMP + 0.6, sound: "blip" },
    ...seq(OUT, 3, OUT_GAP, "pop", { step: 0.12, lead: 0.1 }),
    { at: ASK, sound: "tick" },
    { at: ASK + 0.3, sound: "tick", pitch: 1.2 },
    { at: 10.5, sound: "whoosh", len: 0.8, gain: 0.5 },
    { at: HOUSE, sound: "rise", len: 1.2 },
    { at: ARROW, sound: "whoosh", len: 1.6, gain: 0.7 },
    { at: PIPES, sound: "rise", len: 1.4, pitch: 1.12 },
    { at: PROPANE - 2.7, sound: "blip" },
    { at: PROPANE, sound: "pop" },
    ...seq(AIR, 3, HEAT_GAP, "blip", { pitch: 0.8, step: 0.08 }),
    { at: AIR + 1.4, sound: "whoosh", len: 1.2, gain: 0.3 },
    { at: SQUEEZE - 0.8, sound: "blip" },
    { at: SQUEEZE, sound: "thud" },
    { at: SQUEEZE + 0.1, sound: "rise", len: 0.9, pitch: 1.3 },
    { at: SQUEEZE + 1, sound: "pop", pitch: 1.12 },
    { at: ROOM - 0.4, sound: "blip" },
    ...seq(ROOM, 3, HEAT_GAP, "blip", { pitch: 1.2, step: -0.08 }),
    { at: VALVE, sound: "tick" },
    { at: VALVE + 0.3, sound: "slide", len: 0.8, pitch: 0.9 },
    { at: 36.6, sound: "whoosh", len: 0.8, gain: 0.5 },
    { at: ELEC, sound: "thud", pitch: 1.1 },
    { at: AIRB, sound: "thud", pitch: 0.9 },
    { at: HEAT - 0.4, sound: "tick" },
    { at: HEAT, sound: "rise", len: 1.2 },
    { at: HEAT + 1.1, sound: "chime", gain: 0.5 },
    { at: COP, sound: "pop" },
    { at: COP + 0.6, sound: "snap" },
    { at: COP + 2.2, sound: "blip" },
    { at: 48.3, sound: "whoosh", len: 0.8, gain: 0.4 },
    { at: AXES, sound: "tick" },
    { at: AXES + 1, sound: "tick", pitch: 1.2 },
    { at: AXES + 0.6, sound: "blip" },
    { at: CURVE, sound: "rise", len: 3 },
    { at: MARK, sound: "pop" },
    { at: COLD[0] - 1.2, sound: "blip", pitch: 0.9 },
    { at: COLD[0], sound: "slide", len: COLD[1] - COLD[0] },
    { at: TYPICAL, sound: "pop", pitch: 1.1 },
    ...seq(TYPICAL + 0.2, 2, 0.35, "blip", { step: 0.1 }),
    { at: FLOOR, sound: "snap", pitch: 0.9 },
    { at: 67, sound: "whoosh", len: 0.8, gain: 0.5 },
    { at: RECAP, sound: "blip" },
    ...seq(CHIPS, 3, CHIP_GAP, "blip", { step: 0.1 }),
    { at: 74.6, sound: "chime", pitch: 0.75 },
  ],
  sources: [
    "OpenStax, University Physics Volume 2, sections 4.3 and 4.5: heat pump COP = Qh / W with W = Qh − Qc; Carnot COP = Th / (Th − Tc); example 4.3 runs 0 °C outside, 20 °C inside",
    "IEA, The Future of Heat Pumps (2022), 'How a heat pump works': a typical household heat pump has a COP of around 4; it moves heat rather than generating it",
    "Centre for Sustainable Energy, air source heat pump advice leaflet: a COP of 3 to 4",
    "ENERGY STAR cold-climate heat pump criteria (Cold Climate Controls Verification Procedure): COP of at least 1.75 at 5 °F (−15 °C)",
    "Propane's normal boiling point, −42.1 °C (231 K): Air Liquide gas encyclopedia; Lemmon et al. (2009) propane equation of state",
  ],
  scene,
});
