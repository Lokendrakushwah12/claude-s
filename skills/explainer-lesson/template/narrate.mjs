#!/usr/bin/env node
// Record each caption's narration to voices/<key>.wav and write their real lengths to voices/voices.js, which
// defineLesson reads to time every beat to its voice. Only lines whose spoken words changed are recorded again, and
// clips no caption uses any more are deleted.
//   node narrate.mjs             Chatterbox (story-video's local TTS) when it's installed, else macOS `say`
//   node narrate.mjs --say       macOS `say`: instant and flat, fine for drafts (SAY_VOICE=Daniel picks the voice)
//   node narrate.mjs --redo 3,7  record lines 3 and 7 again (numbers as printed below): re-roll a bad take
//   node narrate.mjs --check     also transcribe every take with Whisper, to catch clipped or garbled ones unheard
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url)), out = join(dir, 'voices');
const { values: o } = parseArgs({ options: { say: { type: 'boolean' }, redo: { type: 'string', default: '' }, check: { type: 'boolean' } } });

// The lesson, loaded as the page loads it: classic scripts that touch no DOM at load time
const ctx = vm.createContext({ console });
for (const f of ['engine.js', 'kit.js', 'audio.js', 'lesson.js']) vm.runInContext(readFileSync(join(dir, f), 'utf8'), ctx, { filename: f });
const { LESSON, speakable, speechSeconds, voiceKey } = vm.runInContext('({ LESSON, speakable, speechSeconds, voiceKey })', ctx);

const TTS = join(process.env.STORY_VIDEO_TTS || join(homedir(), '.local/share/story-video/tts-venv'), 'bin/python');
const chatterbox = !o.say && existsSync(TTS);
const voice = chatterbox ? 'chatterbox' : `say:${process.env.SAY_VOICE || 'default'}`;
mkdirSync(out, { recursive: true });

const lines = LESSON.captions
  .map((c, i) => ({ n: i + 1, text: speakable(c.say ?? c.text, LESSON.pronounce) }))
  .filter((l) => l.text)
  .map((l) => ({ ...l, key: voiceKey(l.text, voice) }));
const wav = (key) => join(out, `${key}.wav`);
for (const n of o.redo.split(',').filter(Boolean).map(Number)) rmSync(wav(lines.find((l) => l.n === n)?.key ?? '-'), { force: true });
const todo = [...new Map(lines.filter((l) => !existsSync(wav(l.key))).map((l) => [l.key, l])).values()];
console.log(`${lines.length} lines, ${todo.length} to record with ${voice}`);

if (todo.length && chatterbox) {
  // One Python process for every line, so the model loads once (a few GB, downloaded on first use)
  writeFileSync(join(out, 'todo.json'), JSON.stringify(todo));
  const r = spawnSync(TTS, [join(dir, 'tts.py')], { stdio: 'inherit', env: { ...process.env, PYTORCH_ENABLE_MPS_FALLBACK: '1', TQDM_DISABLE: '1' } });
  rmSync(join(out, 'todo.json'), { force: true });
  if (r.status) process.exit(r.status);
} else {
  for (const l of todo) execFileSync('say', [...(process.env.SAY_VOICE ? ['-v', process.env.SAY_VOICE] : []), '-o', join(out, `${l.key}.raw.aiff`), l.text]);
}

// 48 kHz mono with the silence the engine leaves at both ends trimmed, so each line starts on its caption; loudness evened
const trim = 'silenceremove=start_periods=1:start_threshold=-45dB';
for (const f of readdirSync(out).filter((f) => f.includes('.raw.'))) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', join(out, f), '-af', `${trim},areverse,${trim},areverse,loudnorm=I=-16:TP=-1.5`,
    '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wav(f.split('.')[0])]);
  rmSync(join(out, f));
}

const clips = {};
for (const l of lines) clips[l.key] ??= +(+execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav(l.key)])).toFixed(3);
writeFileSync(join(out, 'voices.js'), `// Written by narrate.mjs: each recorded line's length in seconds.\nvar VOICES = ${JSON.stringify({ voice, clips }, null, 1)};\n`);
for (const f of readdirSync(out)) if (f.endsWith('.wav') && !(f.slice(0, -4) in clips)) rmSync(join(out, f));

// Listen to the flagged ones: a very short take is usually clipped, a very long one repeated words or stalled
for (const l of lines) {
  const s = clips[l.key], est = speechSeconds(l.text);
  const flag = s < 0.7 ? '   <- clipped? re-roll' : s > est * 1.8 ? `   <- ${(s / est).toFixed(1)}x the expected length, re-roll` : '';
  console.log(`${String(l.n).padStart(3)} ${s.toFixed(1).padStart(5)}s  ${l.text.length > 72 ? l.text.slice(0, 71) + '…' : l.text}${flag}`);
}
console.log(`${Object.values(clips).reduce((a, b) => a + b, 0).toFixed(1)}s of narration. Re-roll a take: node narrate.mjs --redo <n>`);
if (o.check) {
  // Whisper tiny on raw samples (48 kHz -> 16 kHz by averaging threes; its own decoder trips over PyAV versions)
  const py = `import json, sys, wave, numpy as np
from faster_whisper import WhisperModel
m = WhisperModel("tiny", compute_type="int8")
for n, text, f in json.load(sys.stdin):
    w = wave.open(f); x = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768
    heard = " ".join(s.text.strip() for s in m.transcribe(x[: len(x) // 3 * 3].reshape(-1, 3).mean(1), language="en")[0])
    print(f"{n:3} said:  {text}\\n    heard: {heard}", flush=True)`;
  spawnSync('uv', ['run', '-q', '--with', 'faster-whisper', '--with', 'numpy', 'python', '-c', py],
    { input: JSON.stringify(lines.map((l) => [l.n, l.text, wav(l.key)])), stdio: ['pipe', 'inherit', 'inherit'] });
}
