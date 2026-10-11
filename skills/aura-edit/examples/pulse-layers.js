// The Pulse demo's project layers: append to video.js after the template's own code.
// Edit: examples/pulse.json (as aura.json). Concept and the 23 ideas behind it: type-film/creative.md, worked example.
// ---- Pulse (demo): her heart is the edit's clock. 75 BPM resting, racing to 150, a flatline, then the drop is the shock ----
const BT = beatT, BUILD = BT(4), FLAT = BT(6.5), DROP = BT(8), OUTRO = BT(24);
const PEAKS = [0.5, 2.5, 4, 5, 5.75, 6.25, ...[8, 12, 16, 20].flatMap(b => [b, b + 1.5, b + 2.5]), 24, 25.75].map(BT); // R peaks = heartbeats, then the kicks
const bpmAt = t => t < BUILD ? 75 : t < FLAT ? Math.round(expLerp(75, 150, prog(t, BUILD, FLAT))) : t < DROP ? null : t < OUTRO ? 150 : Math.round(lerp(150, 86, ease.out(prog(t, OUTRO, BT(26)))));
LAYERS.push((c, t, pt) => { // the monitor, high on the wall: a trace whose R peaks are the edit's own beats, and the music's real tempo
  const tf = onFrame(pt), v = bpmAt(tf), x = 0.08 * W, y = 0.19 * H, big = 1 + 0.55 * Math.sin(Math.PI * prog(tf, BUILD, FLAT + 0.15)) * (tf < DROP); // the climb is the biggest thing on screen
  if (tf >= BT(16) && tf < BT(17)) return; // the masked "150" is the readout grown to full screen: the small one steps aside
  const g = c.createLinearGradient(0, 0, 0, 0.4 * H); g.addColorStop(0, '#000000a0'); g.addColorStop(1, '#00000000'); c.fillStyle = g; c.fillRect(0, 0, W, 0.4 * H); // a scrim behind the monitor
  if (v == null) { c.fillStyle = '#000000a8'; c.fillRect(0, 0, W, H); } // flatline: the room goes dark, the line stays lit
  c.save(); c.shadowColor = '#000000'; c.shadowBlur = 12 * S;
  ecg(c, 0.38 * W, y, 0.54 * W, 0.06 * H, tf, { beats: v == null ? [] : PEAKS, span: 2.4, lw: 6 * S, color: '#ffffff', len: 0.36 }); // no beats = the whole trace flat
  ui(c, 'BPM', x, 0.115 * H, { font: B.mono, size: 34 * S, weight: 500, color: '#ffffffcc', track: 0.08 });
  word(c, v == null ? '0' : String(v), x, 0.115 * H + 150 * S * big, { font: B.mono, size: 150 * S * big, weight: 700, color: '#ffffff', track: -0.02 });
  c.restore();
});
LOOK_AT = t => (t < DROP ? { ...LOOK.aura, mono: 1 } : t >= OUTRO ? { ...LOOK.aura, mono: 0.7 } : LOOK.aura); // colour returns with the shock
