#!/usr/bin/env node
// Render index.html frame by frame in headless Chrome (raw CDP, no npm deps) and mux the song in.
//   node render.mjs                     full video -> out.mp4
//   node render.mjs --from 20 --to 35   a section -> out.mp4 (audio offset to match)
//   node render.mjs --still 3,12.5,40   just those frames -> review/t<sec>.png (fast, for looking at)
//   --fps 30  --out name.mp4  --preview (half-res, 15fps draft)  --size 1080x1920 (vertical; also 1080x1080)
//   --cues   write cues.json ({ duration, sfx, music, bed } from VIDEO) for an audio step, then exit
//   --query 'theme=dark&look=riso'   extra URL params for the page; stills get them as a file-name prefix
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
  fps: { type: 'string', default: '30' }, from: { type: 'string', default: '0' }, to: { type: 'string' },
  out: { type: 'string', default: 'out.mp4' }, still: { type: 'string' }, preview: { type: 'boolean' },
  size: { type: 'string', default: '1920x1080' }, cues: { type: 'boolean' }, query: { type: 'string' } } });
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

const scale = o.preview ? 0.5 : 1, fps = o.preview ? 15 : +o.fps;
const [SW, SH] = o.size.split('x').map(Number);
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: SW * scale, height: SH * scale, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'file://' + join(dir, 'index.html') + `?render&size=${o.size}${o.query ? '&' + o.query : ''}` });
for (let i = 0; i < 300; i++) { if (await js('document.readyState === "complete" && !!window.ready').catch(() => false)) break; await sleep(100); }
if (!(await js('!!window.ready').catch(() => false))) { console.error('page failed to boot:\n  ' + (logs.join('\n  ') || 'no error captured; open index.html in a browser')); process.exit(1); }
const { duration, audio } = await js('window.ready.then(() => ({ duration: VIDEO.duration, audio: VIDEO.audio }))');
if (logs.length) console.error('page errors:\n  ' + logs.join('\n  '));
if (o.cues) {
  writeFileSync(join(dir, 'cues.json'), JSON.stringify(await js('({ duration: VIDEO.duration, sfx: VIDEO.sfx || [], music: VIDEO.music || null, bed: VIDEO.bed || null })'), null, 1));
  console.log('wrote cues.json'); process.exit(0);
}
const shot = async (t, format = 'png') => { await js(`seek(${t})`); return Buffer.from((await send('Page.captureScreenshot', { format, quality: format === 'jpeg' ? 95 : undefined, optimizeForSpeed: true })).data, 'base64'); };

if (o.still) {
  mkdirSync(join(dir, 'review'), { recursive: true });
  for (const t of o.still.split(',').map(Number)) writeFileSync(join(dir, 'review', `${o.size === '1920x1080' ? '' : o.size + '-'}${o.query ? o.query.replace(/[^\w=.-]+/g, '_') + '-' : ''}t${t.toFixed(1).padStart(5, '0')}.png`), await shot(t));
  console.log(`wrote ${o.still.split(',').length} stills to review/`);
  process.exit(logs.length ? 1 : 0);
}

if (audio && await js('typeof mixdown === "function"')) {
  const bytes = await js('mixdown()'), parts = [];
  for (let i = 0; i < bytes; i += 1 << 22) parts.push(Buffer.from(await js(`wavChunk(${i}, ${1 << 22})`), 'base64'));
  writeFileSync(join(dir, audio), Buffer.concat(parts));
}
const from = +o.from, to = o.to ? +o.to : duration, n = Math.round((to - from) * fps);
const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
  ...(audio ? ['-ss', String(from), '-t', String(to - from), '-i', join(dir, audio)] : []),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', o.preview ? '26' : '17', '-preset', o.preview ? 'veryfast' : 'medium',
  ...(audio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), join(dir, o.out)], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now();
for (let f = 0; f < n; f++) {
  if (!ff.stdin.write(await shot(from + f / fps, 'jpeg'))) await once(ff.stdin, 'drain');
  if (f % (fps * 5) === 0) process.stdout.write(`\r${(from + f / fps).toFixed(1)}s / ${to.toFixed(1)}s  (${((Date.now() - t0) / 1000).toFixed(0)}s elapsed)`);
}
ff.stdin.end(); await once(ff, 'close');
console.log(`\nwrote ${o.out}: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (logs.length) console.error('page errors:\n  ' + logs.join('\n  '));
process.exit(0);
