"""Edit the cut in a browser: the shot list next to the live player, saved straight into aura.json.

    python3 editor.py [port]        # in a project folder, after one `uv run aura.py build`; opens http://localhost:8765

Each shot is a row: a thumbnail of its first frame, the clip (a menu of aura.json's clips), its length in beats and where it
starts in the source (src). Drag a row to move the shot; the cut stays gapless, every `at` re-packs from the first shot's.
Save writes aura.json (the old one goes to aura.json.bak), runs `uv run aura.py build` and reloads the player beside it;
the build's log shows under the list. Keys a row doesn't show (behind, ramp, hit, scale, stabilize...) ride along untouched.
Standard library only; it serves this folder on localhost and nothing else.
"""
import http.server, json, shutil, subprocess, sys, webbrowser
from functools import partial

PAGE = r"""<!doctype html><meta charset="utf-8"><title>aura editor</title>
<style>
 body{margin:0;display:flex;height:100vh;font:13px system-ui;background:#151515;color:#ddd}
 #list{width:520px;overflow:auto;padding:10px;box-sizing:border-box} iframe{flex:1;border:0;background:#000}
 .row{display:flex;gap:8px;align-items:center;padding:4px;margin:3px 0;background:#222;border-radius:6px;cursor:grab}
 .row.drag{opacity:.4} .row img{width:96px;height:96px;object-fit:contain;border-radius:4px;background:#000}
 .row b{width:22px;color:#888} input,select{background:#111;color:#ddd;border:1px solid #444;border-radius:4px;padding:3px}
 input{width:58px} .at{color:#888;width:54px} button{padding:6px 14px;margin:8px 0} pre{white-space:pre-wrap;color:#9a9;font-size:11px}
</style>
<div id="list"><button id="save">Save + build</button> <span id="st"></span><div id="rows"></div><pre id="log"></pre></div>
<iframe id="player"></iframe>
<script>
let A, drag;
const $ = s => document.querySelector(s);
const play = () => $('#player').src = `index.html?size=${[].concat(A.size || [1920, 1080]).join('x')}&${Date.now()}`; // the project's own frame size
async function load() { A = await (await fetch('aura.json?' + Date.now())).json(); draw(); }
function pack() { let t = A.shots[0]?.at || 0; for (const s of A.shots) { s.at = +t.toFixed(3); t += +s.beats; } }
function draw() {
  const clips = Object.keys(A.clips || {});
  $('#rows').innerHTML = '';
  A.shots.forEach((s, i) => {
    const r = document.createElement('div'); r.className = 'row'; r.draggable = true;
    const thumb = s.insert ? '' : `frames/s${String(i).padStart(2, '0')}/0001.jpg?${Date.now()}`;
    r.innerHTML = `<b>${i}</b><img src="${thumb}"><span class="at">${(+s.at).toFixed(2)}</span>` +
      (s.insert ? `<span>insert: ${s.insert}</span>` : `<select>${clips.map(c => `<option${c === s.clip ? ' selected' : ''}>${c}</option>`).join('')}</select>`) +
      ` beats <input data-k="beats" type="number" step="0.05" value="${s.beats}">` + (s.insert ? '' : ` src <input data-k="src" type="number" step="0.1" value="${s.src ?? 0}">`);
    r.querySelector('select')?.addEventListener('change', e => { s.clip = e.target.value; });
    r.querySelectorAll('input').forEach(n => n.addEventListener('change', () => { s[n.dataset.k] = +n.value; pack(); draw(); }));
    r.ondragstart = () => { drag = i; r.classList.add('drag'); };
    r.ondragover = e => e.preventDefault();
    r.ondrop = () => { const [m] = A.shots.splice(drag, 1); A.shots.splice(i, 0, m); pack(); draw(); };
    $('#rows').append(r);
  });
}
$('#save').onclick = async () => {
  $('#st').textContent = 'building...'; $('#save').disabled = true;
  const r = await fetch('/save', { method: 'POST', body: JSON.stringify(A, null, 1) }), j = await r.json();
  $('#log').textContent = j.log; $('#st').textContent = j.ok ? 'built' : 'build failed'; $('#save').disabled = false;
  await load(); play();
};
load().then(play);
</script>"""


class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/editor"):
            b = PAGE.encode(); self.send_response(200); self.send_header("Content-Type", "text/html"); self.end_headers(); return self.wfile.write(b)
        return super().do_GET()

    def end_headers(self):  # the player and thumbnails must never come from cache after a build
        self.send_header("Cache-Control", "no-store"); super().end_headers()

    def do_POST(self):
        if self.path != "/save": return self.send_error(404)
        spec = json.loads(self.rfile.read(int(self.headers["Content-Length"])))  # parse first: a bad body never touches aura.json
        shutil.copy("aura.json", "aura.json.bak")
        with open("aura.json", "w") as f: json.dump(spec, f, indent=1)
        p = subprocess.run(["uv", "run", "aura.py", "build"], capture_output=True, text=True)
        b = json.dumps({"ok": p.returncode == 0, "log": (p.stdout + p.stderr)[-4000:]}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(b)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    s = http.server.ThreadingHTTPServer(("127.0.0.1", port), partial(H, directory="."))
    print(f"aura editor: http://localhost:{port}  (ctrl-c to stop)"); webbrowser.open(f"http://localhost:{port}"); s.serve_forever()
