#!/usr/bin/env node
// Render index.html frame by frame in headless Chrome (raw CDP, no npm deps) and mux the song in.
//   node render.mjs                     full video -> out.mp4
//   node render.mjs --from 20 --to 35   a section -> out.mp4 (audio offset to match)
//   node render.mjs --still 3,12.5,40   just those frames -> review/t<sec>.png (fast, for looking at)
//   --fps 30  --out name.mp4  --preview (half-res, 15fps draft)  --size 1080x1920 (vertical; also 1080x1080)
//   --cues   write cues.json ({ duration, sfx, music, bed } from VIDEO, plus vo drone lufs lp lp_master events mutes levels when
//            VIDEO sets them) for an audio step, then exit
//   --query 'theme=dark&look=riso'   extra URL params for the page; stills get them as a file-name prefix
//   --subframes 4   motion blur: each output frame averages 4 frame-exact sub-times spread over --shutter (default 0.5
//                   of a frame, a 180° film shutter; values over 1 are degrees, --shutter 270), each sampled at the middle
//                   of its slice of the shutter, starting at the frame's time. Costs N screenshots per frame.
//                   VIDEO.blur = [[t0, t1, n], ...] raises the count inside those windows (a fling, a whip).
//   --linear        average the subframes in linear light (gamma 2.2), so bright streaks on dark keep their weight
//   --smooth        silky delivery: --fps 60 --subframes 4 --linear (240 samples a second, 180° shutter); any of them
//                   can still be set. Fast whips: add --subframes 8. --fps 120 --subframes 2 only where the platform
//                   keeps 120 (a file played on a 120 Hz screen); X, Instagram, TikTok and YouTube play at most 60.
//   --motioncheck   frame-to-frame motion consistency at the output fps, per 6x4 tile: stalls (a frame that doesn't move
//                   inside motion: held or dropped), hitches (a step far bigger than both neighbours inside motion), cuts
//                   or pops (a jump out of rest), and a judder index. Exits 1 on any stall or hitch. Use --from/--to.
// The page gets ?fps=<output fps>; lib.js reads it as OUTFPS (onFrame(t) = the frame's own time).
//   --loopcheck     for loops: per 16x9 tile, does last frame -> frame 0 change more than any normal step? Exits 1 if so.
//                   Catches things that pop, wrap or snap at the seam (not a moving object skipping ahead). Run it with looks off.
// A page that synthesises its own soundtrack (explainer-lesson) defines mixdown(): before a video render its WAV is
// pulled out in chunks and written to VIDEO.audio, so sound and picture come from one timeline.
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values: o } = parseArgs({ options: {
  fps: { type: 'string' }, from: { type: 'string', default: '0' }, to: { type: 'string' }, smooth: { type: 'boolean' }, linear: { type: 'boolean' }, motioncheck: { type: 'boolean' },
  out: { type: 'string', default: 'out.mp4' }, still: { type: 'string' }, preview: { type: 'boolean' },
  size: { type: 'string', default: '1920x1080' }, cues: { type: 'boolean' }, query: { type: 'string' },
  subframes: { type: 'string' }, shutter: { type: 'string', default: '0.5' }, loopcheck: { type: 'boolean' } } });
if (o.smooth) { o.fps ??= '60'; o.subframes ??= '4'; o.linear ??= true; }
const dir = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(join(tmpdir(), 'mv-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
const cleanup = () => { chrome.kill(); try { rmSync(profile, { recursive: true, force: true, maxRetries: 5 }); } catch {} };
process.on('exit', cleanup);

let wsUrl;
for (let i = 0; i < 100 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t => t.type === 'page')?.webSocketDebuggerUrl; } catch {}
  if (!wsUrl) await sleep(100);
}
if (!wsUrl) throw new Error('Chrome did not start: set CHROME=/path/to/chrome');
const ws = new WebSocket(wsUrl); await once(ws, 'open');
let seq = 0; const pending = new Map(); const logs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.method === 'Runtime.exceptionThrown') logs.push(m.params.exceptionDetails.exception?.description);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
  m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
};
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const js = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

const scale = o.preview ? 0.5 : 1, fps = o.preview ? 15 : +(o.fps ?? 30), shutter = +o.shutter > 1 ? +o.shutter / 360 : +o.shutter;
const [SW, SH] = o.size.split('x').map(Number);
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: SW * scale, height: SH * scale, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file://' + join(dir, 'index.html') + `?render&size=${o.size}&fps=${fps}${o.query ? '&' + o.query : ''}` });
for (let i = 0; i < 300; i++) { if (await js('document.readyState === "complete" && !!window.ready').catch(() => false)) break; await sleep(100); }
if (!(await js('!!window.ready').catch(() => false))) { console.error('page failed to boot:\n  ' + (logs.join('\n  ') || 'no error captured; open index.html in a browser')); process.exit(1); }
const { duration, audio } = await js('window.ready.then(() => ({ duration: VIDEO.duration, audio: VIDEO.audio }))');
if (logs.length) console.error('page errors:\n  ' + logs.join('\n  '));
if (o.cues) {
  writeFileSync(join(dir, 'cues.json'), JSON.stringify(await js(`(() => { const q = { duration: VIDEO.duration, sfx: VIDEO.sfx || [], music: VIDEO.music || null, bed: VIDEO.bed || null };
    for (const k of ['vo', 'drone', 'lufs', 'lp', 'lp_master', 'events', 'mutes', 'levels']) if (VIDEO[k] !== undefined) q[k] = VIDEO[k]; return q; })()`), null, 1));
  console.log('wrote cues.json'); process.exit(0);
}
if (o.loopcheck) { // per 16x9 tile, mean |RGB difference| (0-255) between two times, measured on the page's canvas
  const diff = (a, b) => js(`(() => { const c = document.querySelector('canvas'), x = c.getContext('2d'), w = c.width, h = c.height, px = t => (seek(t), x.getImageData(0, 0, w, h).data);
    const A = px(${a}), B = px(${b}), T = new Float64Array(144);
    for (let y = 0; y < h; y++) { const row = Math.floor((y * 9) / h) * 16; for (let i = y * w * 4, e = i + w * 4, k = 0; i < e; i += 4, k++) T[row + Math.floor((k * 16) / w)] += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); }
    return [...T].map(v => (v * 144) / (w * h * 3)); })()`);
  // the 8 frames before the seam, then the first 8: d[7] is the seam, the rest are normal steps. A tile fails when the seam
  // changes it more than any normal step does (max, so held stop-motion frames don't count): something pops, wraps or snaps.
  const from = +o.from, last = from + (Math.round(((o.to ? +o.to : duration) - from) * fps) - 1) / fps, d = [];
  const ts = [...Array(16)].map((_, i) => (i < 8 ? last - (7 - i) / fps : from + (i - 8) / fps));
  for (let i = 1; i < 16; i++) d.push(await diff(ts[i - 1], ts[i]));
  const seam = d[7], steps = [...d.slice(0, 7), ...d.slice(8)], max = seam.map((_, k) => Math.max(...steps.map(s => s[k])));
  const over = seam.map((v, k) => v - (max[k] * 1.5 + 1)), k = over.indexOf(Math.max(...over)), ok = over[k] <= 0;
  console.log(`loop seam (last frame -> frame 0): worst tile x${k % 16} y${Math.floor(k / 16)} of 16x9 changes ${seam[k].toFixed(1)}, a normal step at most ${max[k].toFixed(1)}: ${ok ? 'closes' : 'JUMPS'}`);
  process.exit(ok ? 0 : 1);
}
if (o.motioncheck) { // per output frame, mean |RGB step| (0-255) of each of 6x4 tiles, read off a 320 px copy of the canvas
  const from = +o.from, to = o.to ? +o.to : duration, n = Math.round((to - from) * fps), TX = 6, TY = 4, d = [];
  await js(`window.__mc = { prev: null, x: new OffscreenCanvas(320, Math.round(320 * document.querySelector('canvas').height / document.querySelector('canvas').width)).getContext('2d', { willReadFrequently: true }) }`);
  for (let f0 = 0; f0 < n; f0 += 120) d.push(...await js(`(() => { const c = document.querySelector('canvas'), m = window.__mc, x = m.x, w = x.canvas.width, h = x.canvas.height;
    return [...Array(Math.min(120, ${n} - ${f0}))].map((_, k) => { seek(${from} + (${f0} + k) / ${fps}); x.clearRect(0, 0, w, h); x.drawImage(c, 0, 0, w, h);
      const p = x.getImageData(0, 0, w, h).data, T = new Array(${TX * TY}).fill(0);
      if (m.prev) for (let y = 0; y < h; y++) for (let i = y * w * 4, k2 = 0; k2 < w; i += 4, k2++) T[Math.floor(y * ${TY} / h) * ${TX} + Math.floor(k2 * ${TX} / w)] += Math.abs(p[i] - m.prev[i]) + Math.abs(p[i + 1] - m.prev[i + 1]) + Math.abs(p[i + 2] - m.prev[i + 2]);
      m.prev = p; return T.map(v => v * ${TX * TY} / (w * h * 3)); }); })()`));
  // d[f][tile] = the step from frame f-1 to f; a tile moves when its step is over 0.6 (sub-pixel drift is noise). Each frame is judged against its neighbours:
  // a stall is a frame where most moving tiles stop (held or dropped), a hitch a tile stepping over 2.5x both neighbours,
  // a cut or pop the whole frame jumping out of rest. One tile stopping alone is a layer held on twos (grain, a boil): reported, not failed.
  const ts = f => (from + f / fps).toFixed(3), mv = 0.6, K = TX * TY, M = d.map(r => r.reduce((a, b) => a + b, 0) / K), stalls = [], holds = [], hitches = [], cuts = [], J = [];
  for (let f = 2; f < n - 1; f++) {
    if (M[f] > 1.5 && M[f] > 3 * Math.max(M[f - 1], M[f + 1])) { cuts.push(ts(f)); continue; }
    let moving = 0, stopped = 0;
    for (let k = 0; k < K; k++) {
      const a = d[f - 1][k], b = d[f][k], c = d[f + 1][k]; if (a <= mv || c <= mv) continue; moving++;
      if (b < 0.15 * Math.min(a, c)) stopped++;
      else if (b > 2.5 * Math.max(a, c) && b > 20) cuts.push(ts(f)); // a cut between moving shots, or something popping in
      else if (b > 2.5 * Math.max(a, c) && b > 1.5) hitches.push(`${ts(f)}s tile ${k % TX},${Math.floor(k / TX)} (${b.toFixed(1)} vs ${a.toFixed(1)}/${c.toFixed(1)})`);
      else if (b > mv) J.push(Math.abs(b - (a + c) / 2) / b);
    }
    if (stopped >= 3 && stopped >= moving / 2) stalls.push(`${ts(f)}s (${stopped}/${moving} moving tiles)`); else if (stopped) holds.push(ts(f));
  }
  const med = J.sort((x, y) => x - y)[Math.floor(J.length / 2)] ?? 0, show = a => a.slice(0, 12).join(', ') + (a.length > 12 ? ` … (${a.length})` : '');
  console.log(`motion check ${from}-${to}s at ${fps} fps, ${n} frames, 6x4 tiles (run looks and grain off, e.g. --query look=0)`);
  console.log(`  judder index ${med.toFixed(3)} over ${J.length} moving tile-steps (median |step - mean of neighbours| / step, read without blur: compare renders of the same page, lower is evener)`);
  console.log(`  cuts or pops (check each is meant): ${cuts.length ? show([...new Set(cuts)]) : 'none'}`);
  console.log(`  stalls (held or dropped frames): ${stalls.length ? show(stalls) : 'none'}`);
  console.log(`  hitches (a step over 2.5x both neighbours inside motion): ${hitches.length ? show(hitches) : 'none'}`);
  if (holds.length) console.log(`  layers held on twos or threes (fine if meant): ${holds.length} frames, from ${holds[0]}s`);
  process.exit(stalls.length || hitches.length ? 1 : 0);
}
const shot = async (t, format = 'png') => { await js(`seek(${t})`); return Buffer.from((await send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 95 : undefined, optimizeForSpeed: true })).data, 'base64'); };

if (o.still) {
  mkdirSync(join(dir, 'review'), { recursive: true }); const seen = logs.length;
  // t012.5.png as before; finer times keep their digits (t007.04.png) instead of rounding onto a neighbour's file
  const stamp = t => { const [i, f = '0'] = String(+t.toFixed(3)).split('.'); return i.padStart(3, '0') + '.' + f; };
  for (const t of o.still.split(',').map(Number)) writeFileSync(join(dir, 'review', `${o.size === '1920x1080' ? '' : o.size + '-'}${o.query ? o.query.replace(/[^\w=.-]+/g, '_') + '-' : ''}t${stamp(t)}.png`), await shot(t));
  console.log(`wrote ${o.still.split(',').length} stills to review/`);
  if (logs.length > seen) console.error('page errors:\n  ' + logs.slice(seen).join('\n  '));
  process.exit(logs.length ? 1 : 0);
}

if (audio && await js('typeof mixdown === "function"')) {
  const bytes = await js('mixdown()'), parts = [];
  for (let i = 0; i < bytes; i += 1 << 22) parts.push(Buffer.from(await js(`wavChunk(${i}, ${1 << 22})`), 'base64'));
  writeFileSync(join(dir, audio), Buffer.concat(parts));
}
const from = +o.from, to = o.to ? +o.to : duration, n = Math.round((to - from) * fps), base = Math.max(1, +o.subframes | 0);
// VIDEO.blur = [[t0, t1, subframes], ...]: more subframes where the page knows things move fast (a fling, a whip), so 4 stamps
// don't ghost; every frame still feeds ffmpeg N images, a frame with fewer shots repeats each one, so all shots weigh the same.
const wins = base > 1 ? await js('VIDEO.blur || []') : [], N = Math.max(base, ...wins.map(w => w[2] | 0)); // only when blur is on: a draft stays fast
const nAt = t => { const w = wins.find(([a, b]) => t >= a && t < b); let k = Math.min(N, Math.max(1, w ? w[2] | 0 : base)); while (N % k) k--; return k; };
// Subframes: Chrome renders N sub-times per frame; ffmpeg averages each run of N (tmix), keeps the frame that closes it, re-times.
// --linear wraps the average in gamma 2.2 <-> linear on 16-bit RGB, so a bright streak's blur keeps its energy.
const lin = g => `lutrgb=r='65535*pow(val/65535\\,${g})':g='65535*pow(val/65535\\,${g})':b='65535*pow(val/65535\\,${g})'`;
const mix = `tmix=frames=${N},select='eq(mod(n\\,${N})\\,${N - 1})',setpts=N/(${fps}*TB)`;
const blur = N > 1 ? ['-vf', o.linear ? `format=rgb48le,${lin(2.2)},${mix},${lin(1 / 2.2)}` : mix, '-r', String(fps)] : [];
const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps * N), '-i', '-',
  ...(audio ? ['-ss', String(from), '-t', String(to - from), '-i', join(dir, audio)] : []), ...blur,
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', o.preview ? '26' : '17', '-preset', o.preview ? 'veryfast' : 'medium',
  ...(audio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), join(dir, o.out)], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let f = 0; f < n; f++) {
  const t = from + f / fps, k = nAt(t);
  for (let i = 0; i < k; i++) { const b = await shot(t + (k > 1 ? ((i + 0.5) / k) * (shutter / fps) : 0), 'jpeg'); for (let r = 0; r < N / k; r++) if (!ff.stdin.write(b)) await once(ff.stdin, 'drain'); }
  if (f % (fps * 5) === 0) process.stdout.write(`\r${(from + f / fps).toFixed(1)}s / ${to.toFixed(1)}s  (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`);
}
ff.stdin.end(); const [code] = await once(ff, 'close');
if (code) { console.error(`\nffmpeg failed (exit ${code})${audio ? `; is ${audio} there? (make it first, e.g. --cues then sfx.py)` : ''}`); process.exit(1); }
console.log(`\nwrote ${o.out}: ${n} frames at ${fps} fps${N > 1 ? ` (${base} subframes${wins.length ? `, up to ${N} in VIDEO.blur windows` : ''}, ${Math.round(shutter * 360)}° shutter${o.linear ? ', linear light' : ''})` : ''} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (logs.length) console.error('page errors:\n  ' + logs.join('\n  '));
process.exit(0);
