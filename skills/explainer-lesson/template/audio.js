// Every sound is synthesised with Web Audio, no audio files. Each sound books its nodes at an exact audio-clock time
// `when` and returns them, so the preview can stop them on pause or seek. The same code renders the MP4's soundtrack
// offline (mixdown), so what you hear in preview is what the file gets.

function env(b, when, peak, attack, hold, release) {
  const g = b.ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
  g.gain.setValueAtTime(Math.max(peak, 0.0002), when + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  g.connect(b.out);
  return g;
}

function tone(b, when, o) {
  const osc = b.ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, when);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, when + (o.glide ?? o.release));
  const attack = o.attack ?? 0.005, hold = o.hold ?? 0;
  const g = env(b, when, o.peak, attack, hold, o.release);
  if (o.filter) {
    const f = b.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.filter;
    osc.connect(f).connect(g);
  } else osc.connect(g);
  osc.start(when);
  osc.stop(when + attack + hold + o.release + 0.05);
  return [osc];
}

const noiseBuffers = new WeakMap();
function noise(b, when, o) {
  let buf = noiseBuffers.get(b.ctx);
  if (!buf) {
    buf = b.ctx.createBuffer(1, b.ctx.sampleRate * 2, b.ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Fixed-seed noise, so a lesson sounds the same on every play and in every render
    let s = 1;
    for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    noiseBuffers.set(b.ctx, buf);
  }
  const src = b.ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const f = b.ctx.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.Q.value = o.q ?? 1.2;
  f.frequency.setValueAtTime(o.from, when);
  f.frequency.exponentialRampToValueAtTime(o.to, when + o.len);
  const attack = o.attack ?? o.len * 0.5;
  src.connect(f).connect(env(b, when, o.peak, attack, 0, Math.max(0.05, o.len - attack)));
  src.start(when);
  src.stop(when + o.len + 0.1);
  return [src];
}

/** The sound palette. Cues name these; add a new one here. o = { gain, pitch, len }. */
const SOUNDS = {
  /** Something appears. */
  pop: (b, w, o) => tone(b, w, { freq: 620 * o.pitch, to: 300 * o.pitch, glide: 0.1, peak: 0.35 * o.gain, release: 0.16 }),
  /** A small accent: a label or a chip. */
  blip: (b, w, o) => tone(b, w, { type: "triangle", freq: 880 * o.pitch, peak: 0.16 * o.gain, release: 0.12 }),
  /** Two things click together: a part seating, a key in a lock, a value locking in. */
  snap: (b, w, o) => [
    ...tone(b, w, { freq: 360 * o.pitch, to: 520 * o.pitch, glide: 0.06, peak: 0.3 * o.gain, release: 0.4 }),
    ...tone(b, w, { freq: 1040 * o.pitch, peak: 0.07 * o.gain, release: 0.25 }),
  ],
  /** A resolved idea, the end of a beat. */
  chime: (b, w, o) => [
    ...tone(b, w, { freq: 660 * o.pitch, peak: 0.2 * o.gain, release: 1.8 }),
    ...tone(b, w, { freq: 990 * o.pitch, peak: 0.08 * o.gain, release: 1.4 }),
    ...tone(b, w, { freq: 1320 * o.pitch, peak: 0.04 * o.gain, release: 1 }),
  ],
  /** Fast motion across the frame. */
  whoosh: (b, w, o) => noise(b, w, { len: o.len || 0.6, from: 300, to: 2600, q: 0.9, peak: 0.22 * o.gain }),
  /** A line or curve drawing on: a soft glide lasting `len`. */
  rise: (b, w, o) => {
    const len = o.len || 1.5, shape = { glide: len, attack: len * 0.3, hold: len * 0.4, release: len * 0.3 + 0.2 };
    return [
      ...tone(b, w, { freq: 220 * o.pitch, to: 520 * o.pitch, peak: 0.06 * o.gain, ...shape }),
      ...tone(b, w, { type: "triangle", freq: 221.5 * o.pitch, to: 522 * o.pitch, peak: 0.03 * o.gain, filter: 1400, ...shape }),
    ];
  },
  /** Something heavy sliding sideways: a curve shifting, a value running down. */
  slide: (b, w, o) => noise(b, w, { len: o.len || 1.2, from: 1600 * o.pitch, to: 420 * o.pitch, type: "lowpass", q: 0.7, peak: 0.16 * o.gain, attack: 0.25 }),
  /** Weight, a firm stop. */
  thud: (b, w, o) => tone(b, w, { freq: 120 * o.pitch, to: 55 * o.pitch, glide: 0.25, peak: 0.5 * o.gain, release: 0.32 }),
  /** Soft tick, for counting or a pointer landing. */
  tick: (b, w, o) => tone(b, w, { type: "square", freq: 1800 * o.pitch, peak: 0.035 * o.gain, release: 0.035, filter: 3000 }),
};

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Everything the lesson plays, as { at, len, play(bus, when, len) }, sorted by time. `len` > 0 marks a held pad chord
 * that the preview resumes part-way through after a seek.
 */
function lessonEvents(lesson) {
  const out = lesson.cues.map((c) => ({ at: c.at, len: 0, play: (b, w) => SOUNDS[c.sound](b, w, { gain: c.gain ?? 1, pitch: c.pitch ?? 1, len: c.len ?? 0 }) }));
  const m = lesson.music, duration = lesson.duration;
  // The music bed: a held pad per bar plus a soft eighth-note arpeggio, both from the bar's chord
  const bar = m ? (4 * 60) / m.bpm : 0;
  for (let i = 0; m && i * bar < duration - 1; i++) {
    const chord = m.chords[i % m.chords.length], start = i * bar, len = Math.min(bar, duration - start), last = (i + 1) * bar >= duration - 1;
    out.push({ at: start, len, play: (b, w, l) => chord.flatMap((n) => tone(b, w, { type: "triangle", freq: hz(n), peak: m.gain * 0.55, attack: Math.min(0.6, l / 3), hold: Math.max(0, l - 0.6), release: last ? 2.5 : 0.9, filter: 900 })) });
    for (let k = 0; k < 8; k++) {
      const at = start + (k * bar) / 8;
      if (at >= duration - 0.5) break;
      const n = chord[k % chord.length] + 12 + (k >= 4 ? 12 * (k % 2) : 0);
      out.push({ at, len: 0, play: (b, w) => tone(b, w, { freq: hz(n), peak: m.gain * (k % 4 === 0 ? 0.5 : 0.3), release: 0.35 }) });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * The MP4's soundtrack, rendered offline: every cue and the music bed booked on the lesson's real timeline, and each
 * caption's recorded clip started the moment its caption appears. Returns 48 kHz 16-bit stereo WAV bytes.
 * Why offline in the page: it runs the same SOUNDS and the same timeline the picture reads, and an OfflineAudioContext
 * starts every sound on an exact sample (t * 48000), while frame i is drawn at exactly t = i / fps. So sound and picture
 * are locked to the sample with no second implementation to drift. The page hands the bytes to render.mjs through mixdown().
 * `load(url)` returns a clip's bytes (an XHR: fetch() refuses file:// URLs).
 */
async function soundtrack(lesson, load) {
  const SR = 48000, ac = new OfflineAudioContext(2, Math.round(lesson.duration * SR), SR);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.connect(ac.destination);
  for (const e of lessonEvents(lesson)) e.play({ ctx: ac, out: comp }, e.at, e.len);
  const silent = lesson.captions.filter((c) => c.text && !c.clip).length;
  if (silent) console.warn(`${silent} captions have no recorded voice, so the MP4 is silent there: run node narrate.mjs`);
  // The voice goes beside the compressor, as the preview's <audio> element plays it
  for (const c of lesson.captions.filter((c) => c.clip)) {
    const src = ac.createBufferSource();
    src.buffer = await ac.decodeAudioData(await load(c.clip.url));
    src.connect(ac.destination);
    src.start(c.at);
  }
  const buf = await ac.startRendering(), n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
  let peak = 0;
  for (const c of ch) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(c[i]));
  const g = peak > 0.89 ? 0.89 / peak : 1; // a -1 dBFS ceiling, so the AAC encode never clips
  const v = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => [...s].forEach((x, i) => v.setUint8(o + i, x.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n * 4, true); str(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 2, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) v.setInt16(44 + i * 4 + c * 2, Math.round(clamp(ch[c][i] * g, -1, 1) * 32767), true);
  return new Uint8Array(v.buffer);
}
