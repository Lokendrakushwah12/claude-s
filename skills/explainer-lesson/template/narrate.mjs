#!/usr/bin/env node
// Record each caption's narration to voices/<key>.wav and write their real lengths to voices/voices.js, which
// defineLesson reads to time every beat to its voice. Only lines whose spoken words changed are recorded again, and
// clips no caption uses any more are deleted.
//   node narrate.mjs             Chatterbox (story-video's local TTS) when it's installed, else macOS `say`
//   node narrate.mjs --say       macOS `say`: instant and flat, fine for drafts (SAY_VOICE=Daniel picks the voice)
//   node narrate.mjs --redo 3,7  record lines 3 and 7 again (numbers as printed below): re-roll a bad take
//   node narrate.mjs --check     also transcribe every take with Whisper, to catch clipped or garbled ones unheard,
//                                and print when each word starts in its take: put the beats on the words
//   node narrate.mjs --mix <slug>.mp4   transcribe the finished film and print what's heard under each caption, so a
//                                buried, clipped or mistimed line shows up in the final mix, not just in its take
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url)), out = join(dir, 'voices');
const { values: o } = parseArgs({ options: { say: { type: 'boolean' }, redo: { type: 'string', default: '' }, check: { type: 'boolean' }, mix: { type: 'string' } } });

// The lesson, loaded as the page loads it: classic scripts that touch no DOM at load time (with the recorded lengths,
// so its caption times are the film's)
const ctx = vm.createContext({ console });
const files = [...(existsSync(join(out, 'voices.js')) ? ['voices/voices.js'] : []), 'engine.js', 'kit.js', 'audio.js', 'lesson.js'];
for (const f of files) vm.runInContext(readFileSync(join(dir, f), 'utf8'), ctx, { filename: f });
const { LESSON, speakable, speechSeconds, voiceKey } = vm.runInContext('({ LESSON, speakable, speechSeconds, voiceKey })', ctx);
if (LESSON.voice === 'typed') { console.log("voice: 'typed': the captions type on, so there's nothing to record"); process.exit(0); }

if (o.mix) {
  // Whisper small.en over the whole mix, words with times, each word filed under the caption showing when it starts
  const py = `import json, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel
caps = json.load(sys.stdin)
pcm = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", sys.argv[1], "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
segs, _ = WhisperModel("small.en", compute_type="int8").transcribe(np.frombuffer(pcm, np.float32), language="en", word_timestamps=True, vad_filter=True)
words = [w for s in segs for w in s.words]
for i, (n, at, text) in enumerate(caps):
    end = caps[i + 1][1] if i + 1 < len(caps) else 1e9
    heard = "".join(w.word for w in words if at - 0.25 <= w.start < end - 0.25).strip()
    print(f"{n:3} {at:6.1f}s said:  {text}\\n            heard: {heard}", flush=True)`;
  const caps = LESSON.captions.map((c, i) => [i + 1, +c.at.toFixed(2), speakable(c.say ?? c.text, LESSON.pronounce)]);
  const r = spawnSync('uv', ['run', '-q', '--with', 'faster-whisper', '--with', 'numpy', 'python', '-c', py, o.mix], { input: JSON.stringify(caps), stdio: ['pipe', 'inherit', 'inherit'] });
  process.exit(r.status ?? 1);
}

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
    segs = list(m.transcribe(x[: len(x) // 3 * 3].reshape(-1, 3).mean(1), language="en", word_timestamps=True)[0])
    heard = " ".join(s.text.strip() for s in segs)
    words = " ".join(f"{w.word.strip()}@{w.start:.2f}" for s in segs for w in s.words)
    print(f"{n:3} said:  {text}\\n    heard: {heard}\\n    times: {words}", flush=True)`;
  spawnSync('uv', ['run', '-q', '--with', 'faster-whisper', '--with', 'numpy', 'python', '-c', py],
    { input: JSON.stringify(lines.map((l) => [l.n, l.text, wav(l.key)])), stdio: ['pipe', 'inherit', 'inherit'] });
}
