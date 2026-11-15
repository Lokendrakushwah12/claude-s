# /// script
# requires-python = ">=3.10"
# dependencies = ["mcp<2"]
# ///
"""claude-s studio: the video skills as one local app. Claude is the brain, this is the body.

    uv run ~/.claude/skills/claude-s/studio.py            # http://127.0.0.1:45690  (dashboard)  +  /mcp  (tools)
    claude mcp add claude-s --transport http http://127.0.0.1:45690/mcp --scope user

What it adds over the bare skills:
- **Orchestration you can call:** `guide` returns the routing map (claude-s/SKILL.md: which skill leads, what the others
  lend, the pipeline) and every project's state; `next_step` reads a project folder and says which pipeline step is due and
  why (spec newer than the build -> build; build newer than the video -> stills, then render; video not gated -> gate;
  gated -> deliver). Each tool's description says when to use it, so the model picks the right one.
- **Jobs:** builds, renders, indexing, denoise and gates run in the background, one at a time per folder, with logs; poll
  `job`. Nothing blocks the chat.
- **A dashboard:** every project with its poster, next step, the latest video and buttons for the same actions; the jobs
  with live logs; footage search over a library.db; and the per-project editor (editor.py) a click away.
Projects live under ~/Movies/{aura-edits,faceless,ugc-edits}; the kind is read from the spec file. Localhost only, and files
are served only from those folders and the library.
"""
import asyncio, json, os, re, shutil, subprocess, sys, threading, time, uuid
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import FileResponse, HTMLResponse, JSONResponse, Response

HOME, SK = Path.home(), Path.home() / ".claude/skills"
MOV = HOME / "Movies"
KINDS = {  # spec file -> (lead skill, projects root)
    "aura.json": ("aura-edit", MOV / "aura-edits"),
    "film.json": ("faceless-video", MOV / "faceless"),
    "edit.json": ("ugc-edit", MOV / "ugc-edits"),
}
ROOTS = [r for _, r in KINDS.values()] + [MOV / "refs"]
LIB = MOV / "aura-edits/library"
JOBDIR = HOME / ".cache/claude-s-studio"; JOBDIR.mkdir(parents=True, exist_ok=True)
PORT = int(os.environ.get("STUDIO_PORT", 45690))
SETUP = {  # each lead's SKILL.md "Setup" copy line, from the template homes (claude-s: copy from home, never from a project)
    "aura-edit": 'cp {S}/aura-edit/template/* "$D"/ && cp {S}/ugc-edit/template/{{ingest.py,matte.py}} {S}/music-video/template/{{lib.js,render.mjs}} '
                 '{S}/promo-video/template/{{promo.js,sfx.py}} {S}/type-film/template/{{type.js,look.js}} "$D"/',
    "ugc-edit": 'cp {S}/ugc-edit/template/* "$D"/ && cp {S}/music-video/template/{{lib.js,render.mjs}} {S}/promo-video/template/{{promo.js,sfx.py}} '
                '{S}/type-film/template/type.js "$D"/',
    "faceless-video": 'cp -R {S}/faceless-video/template/. "$D"/',
}

# ---------------------------------------------------------------- projects
def projects():
    out = []
    for spec, (kind, root) in KINDS.items():
        for d in sorted(root.glob("*/" + spec)):
            out.append(info(d.parent))
    return out


def find(name):
    p = Path(name).expanduser()
    if p.is_dir() and kind_of(p): return p
    for spec, (_, root) in KINDS.items():
        if (root / name / spec).exists(): return root / name
    raise ValueError(f"no project {name!r}; list_projects shows them")


def kind_of(p):
    return next((k for spec, (k, _) in KINDS.items() if (p / spec).exists()), None)


def spec_of(p):
    return next(p / s for s in KINDS if (p / s).exists())


def mt(f): return f.stat().st_mtime if f and f.exists() else 0


def videos(p):  # finished renders, newest first
    return sorted(p.glob("*.mp4"), key=mt, reverse=True)


def size_of(p):
    s = json.loads(spec_of(p).read_text()).get("size") or ("1080x1920" if kind_of(p) != "aura-edit" else [1920, 1080])
    return "x".join(map(str, s)) if isinstance(s, list) else s


def pipeline_step(p):
    """(step, why): the pipeline position, read from file times. ponytail: mtime heuristics; a step that edits
    a file without changing the spec (a project.js tweak) needs `build` or `render` called by hand."""
    k, spec, tl = kind_of(p), spec_of(p), p / "timeline.js"
    v = (videos(p) or [None])[0]
    if k == "faceless-video":
        if not v or mt(spec) > mt(v): return "make", "film.json is newer than the video (keep_voice=true if no spoken line changed)"
    else:
        if mt(spec) > mt(tl): return "build", f"{spec.name} changed since the last build"
        if not v or mt(tl) > mt(v): return "stills_then_render", "the build is newer than the video: look at stills, then render"
    gate = v.with_suffix(".gate.json")
    if mt(gate) < mt(v): return "gate", f"{v.name} hasn't been through filmgate"
    L = json.loads(gate.read_text() or "{}").get("lights", {})  # filmgate --json: {"lights": {"blank": "green", ...}}
    red, yel = [c for c, l in L.items() if l == "red"], [c for c, l in L.items() if l == "yellow"]
    if red: return "fix", f"filmgate red on {', '.join(red)}: don't deliver"
    return "deliver", f"{v.name} is built and gated" + (f" (yellow: {', '.join(yel)}, look first)" if yel else "") + \
        ("; export an FCPXML for an editor if wanted" if k == "aura-edit" else "")


def info(p):
    step, why = pipeline_step(p)
    poster = next((f for f in [*sorted((p / "review").glob("*.png"), key=mt, reverse=True)[:1], p / "frames/s00/0001.jpg", p / "frames/0001.jpg"] if f.exists()), None)
    return {"name": p.name, "kind": kind_of(p), "path": str(p), "next": step, "why": why, "size": size_of(p),
            "videos": [v.name for v in videos(p)[:4]], "poster": str(poster) if poster else None,
            "busy": any(j["cwd"] == str(p) and j["state"] == "running" for j in JOBS.values())}


# ---------------------------------------------------------------- jobs
JOBS = {}


def run(title, cmd, cwd, after=None):
    """Start a background job; one at a time per folder (two renders in one folder clobber audio.wav)."""
    cwd = str(cwd)
    for j in JOBS.values():
        if j["cwd"] == cwd and j["state"] == "running": raise RuntimeError(f"{j['title']} is still running in {cwd} (job {j['id']})")
    jid = uuid.uuid4().hex[:6]; log = JOBDIR / f"{jid}.log"
    j = JOBS[jid] = {"id": jid, "title": title, "cmd": cmd, "cwd": cwd, "log": str(log), "state": "running", "started": time.time(), "code": None}

    def go():
        with open(log, "w") as f:
            f.write(f"$ {cmd}\n"); f.flush()
            r = subprocess.run(["bash", "-lc", cmd], cwd=cwd, stdout=f, stderr=subprocess.STDOUT)
        j.update(code=r.returncode, state="done" if r.returncode == 0 else "failed", ended=time.time())
        if after and r.returncode == 0: after()
    threading.Thread(target=go, daemon=True).start()
    return {"job": jid, "title": title}


def job_view(j, lines=40):
    tail = Path(j["log"]).read_text(errors="replace").splitlines()[-lines:] if Path(j["log"]).exists() else []
    return {k: j[k] for k in ("id", "title", "state", "code", "cwd")} | {"secs": round(j.get("ended", time.time()) - j["started"]), "log": "\n".join(tail)}


def q(s): return "'" + str(s).replace("'", "'\\''") + "'"


# ---------------------------------------------------------------- actions (shared by tools and dashboard)
def act(name, action, **kw):
    p = find(name); k = kind_of(p)
    if action == "build":
        if k == "faceless-video": return run(f"{p.name}: picture build", "uv run -q build.py --picture", p)
        return run(f"{p.name}: build", "uv run aura.py build" if k == "aura-edit" else "uv run edit.py build", p)
    if action == "stills":
        t = kw.get("times") or "1"
        if k == "faceless-video": return run(f"{p.name}: stills {t}", f"sh make.sh --stills {q(t)}", p)
        return run(f"{p.name}: stills {t}", f"node render.mjs --size {size_of(p)} --still {q(t)}", p)
    if action == "render":
        if k == "faceless-video": return run(f"{p.name}: make", "sh make.sh" + (" --keep-voice" if kw.get("keep_voice", True) else ""), p)
        if (p / "finish.sh").exists(): return run(f"{p.name}: finish.sh", "sh finish.sh", p)  # the project's own recipe wins
        pre = "cp mix.wav audio.wav && " if (p / "mix.wav").exists() else ""  # render.mjs muxes audio.wav with -shortest
        return run(f"{p.name}: render", f"{pre}node render.mjs --size {size_of(p)} --out {q(p.name + '.mp4')}", p)
    if action == "make": return act(name, "render", **kw)
    if action == "gate":
        v = p / kw["video"] if kw.get("video") else (videos(p) or [None])[0]
        if not v: raise ValueError("no video to gate yet")
        return run(f"{p.name}: gate {v.name}", f"uv run {q(SK / 'x-video-frames/filmgate.py')} {q(v.name)} --json {q(v.with_suffix('.gate.json').name)}; true", p)
    if action == "export":
        if k != "aura-edit": raise ValueError("FCPXML export is aura-edit only")
        return run(f"{p.name}: export", f"uv run aura.py export aura.json {q(p.name + '.fcpxml')}", p)
    raise ValueError(f"unknown action {action}")


EDITORS = {}


def start_editor(name):
    p = find(name)
    if kind_of(p) != "aura-edit": raise ValueError("the shot editor is for aura-edit projects")
    if not (p / "editor.py").exists() or mt(p / "editor.py") < mt(SK / "aura-edit/template/editor.py"):
        shutil.copy(SK / "aura-edit/template/editor.py", p)
    if p.name not in EDITORS or EDITORS[p.name][1].poll() is not None:
        port = 8765 + len(EDITORS)
        EDITORS[p.name] = (port, subprocess.Popen(["python3", "editor.py", str(port)], cwd=p, env={**os.environ, "BROWSER": "true"},
                                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        time.sleep(0.8)
    return f"http://localhost:{EDITORS[p.name][0]}"


def library(*args, db=None):
    db = Path(db).expanduser() if db else max(LIB.glob("*.db"), key=mt)  # default: the newest library
    r = subprocess.run(["uv", "run", "-q", "--python", "3.12", str(SK / "aura-edit/template/library.py"), *map(str, args), "--db", str(db)],
                       capture_output=True, text=True, cwd=db.parent)
    return (r.stdout + (r.stderr[-1500:] if r.returncode else "")).strip()


# ---------------------------------------------------------------- MCP tools
mcp = FastMCP("claude-s", host="127.0.0.1", port=PORT, instructions=(
    "claude-s studio: local video production. Call `guide` first on any video job: it says which skill leads and the "
    "pipeline, and lists projects. Then `next_step` on a project tells you what is due. Long work runs as background jobs: "
    "poll `job`. Read the lead skill's SKILL.md before writing a spec (aura.json / film.json / edit.json)."))


@mcp.tool()
def guide() -> str:
    """Start here for ANY video request. Returns the routing map (which skill leads for which input/output, what the other
    skills lend, the 9-step pipeline every job follows) plus every project and the step it's on."""
    ps = "\n".join(f"- {x['name']} ({x['kind']}): next {x['next']} ({x['why']})" for x in projects())
    return (SK / "claude-s/SKILL.md").read_text() + "\n\n## Projects now\n" + (ps or "none yet") + \
        f"\n\n## Studio tools\nnew_project, next_step, build, stills, render, gate, export_fcpxml, open_editor, job, jobs, " \
        f"search_footage, said, index_footage, people, denoise, deconstruct, download. Dashboard: http://127.0.0.1:{PORT}"


@mcp.tool()
def list_projects() -> list:
    """Every project under ~/Movies with its kind, size, latest videos and next pipeline step."""
    return projects()


@mcp.tool()
def next_step(project: str) -> dict:
    """What to do next on a project and why, read from its files: build (spec changed), stills_then_render (build newer than
    the video), make (faceless), gate (video not checked), fix (gate red), deliver. Call it after every job finishes."""
    return info(find(project))


@mcp.tool()
def new_project(kind: str, slug: str) -> dict:
    """Create a project folder from a lead skill's template: kind is aura-edit (the user's clips -> beat-locked edit),
    faceless-video (script/theme, nobody on camera) or ugc-edit (talking head, podcast, screen recording). Pick the kind
    with `guide`'s table. Then write its spec from that skill's SKILL.md."""
    root = next(r for _, (k, r) in KINDS.items() if k == kind); d = root / re.sub(r"[^\w-]+", "-", slug).strip("-")
    if d.exists(): raise ValueError(f"{d} exists")
    d.mkdir(parents=True)
    subprocess.run(["bash", "-c", SETUP[kind].format(S=SK)], env={**os.environ, "D": str(d)}, check=True)
    return {"path": str(d), "files": sorted(f.name for f in d.iterdir()), "read": str(SK / kind / "SKILL.md")}


@mcp.tool()
def build(project: str) -> dict:
    """Rebuild a project's timeline and frames from its spec (aura.py build / edit.py build / faceless picture build). Background job."""
    return act(project, "build")


@mcp.tool()
def stills(project: str, times: str = "1") -> dict:
    """Render a few frames (comma-separated seconds) to review/ to look at before a full render. Background job; Read the PNGs after."""
    return act(project, "stills", times=times)


@mcp.tool()
def render(project: str, keep_voice: bool = True) -> dict:
    """Render the finished MP4 (the project's finish.sh if it has one; faceless runs make.sh, keep_voice=false re-narrates).
    Do stills first. Background job; gate the result after."""
    return act(project, "render", keep_voice=keep_voice)


@mcp.tool()
def gate(project: str, video: str = "") -> dict:
    """Run the delivery gate (x-video-frames/filmgate.py) on the newest (or named) video. Red means don't deliver."""
    return act(project, "gate", video=video)


@mcp.tool()
def export_fcpxml(project: str) -> dict:
    """aura-edit: export the cut as FCPXML 1.9 for Resolve/Final Cut/Premiere fine-tuning."""
    return act(project, "export")


@mcp.tool()
async def open_editor(project: str) -> str:
    """aura-edit: start the browser shot editor (reorder, trim, swap clips, save rebuilds) and return its URL for the user."""
    return await asyncio.to_thread(start_editor, project)


@mcp.tool()
def job(id: str, lines: int = 40) -> dict:
    """Status and the log's tail for a background job."""
    return job_view(JOBS[id], lines)


@mcp.tool()
def jobs() -> list:
    """All jobs this session, newest first."""
    return [job_view(j, 3) for j in sorted(JOBS.values(), key=lambda j: -j["started"])]


@mcp.tool()
async def search_footage(query: str, db: str = "", k: int = 12) -> str:
    """Find moments in indexed footage by what's in them ("two friends walking into a valley"). Returns ranked clip+time
    hits and a contact-sheet path to Read. Confirm a pick with footage.py before using it."""
    return await asyncio.to_thread(library, "search", query, "--k", k, db=db or None)


@mcp.tool()
async def said(word: str, db: str = "") -> str:
    """Find where a word is spoken in indexed footage (needs index_footage with speech)."""
    return await asyncio.to_thread(library, "said", word, db=db or None)


@mcp.tool()
def index_footage(folder: str, db: str, speech: bool = False) -> dict:
    """Index a footage folder once (frame embeddings, optional transcripts) so search_footage/said work. Re-runs only add new clips. Background job."""
    dbp = Path(db).expanduser(); dbp.parent.mkdir(parents=True, exist_ok=True)
    return run(f"index {Path(folder).name}", f"uv run --python 3.12 {q(SK / 'aura-edit/template/library.py')} index {q(folder)} --db {q(dbp)}" + (" --speech" if speech else ""), dbp.parent)


@mcp.tool()
async def people(action: str = "people", a: str = "", b: str = "", db: str = "") -> str:
    """Face groups in a library: action people (list), review (one sheet to check), suggest (likely same-person pairs: hints,
    confirm on the review sheet), merge (a=keep, b=other), name (a=id, b=name), person (a=name). Run `faces` first via index."""
    if action not in ("people", "review", "suggest", "merge", "name", "person", "faces"): raise ValueError(action)
    return await asyncio.to_thread(library, action, *[x for x in (a, b) if x], db=db or None)


@mcp.tool()
def denoise(path: str, mix: float = 0.9, atten: float = 30) -> dict:
    """Clean wind/traffic/room noise off a phone voice (DeepFilterNet, local). Video in -> <name>.clean.mp4. Background job."""
    f = Path(path).expanduser()
    return run(f"denoise {f.name}", f"uv run {q(SK / 'ugc-edit/template/denoise.py')} {q(f)} --mix {mix} --atten {atten}", f.parent)


@mcp.tool()
def deconstruct(source: str) -> dict:
    """Take a reference video (URL or file) apart into measured cuts, pacing, beats, loudness and a report. Do this before
    making anything that should feel like a reference. Background job; the report path is in the log."""
    out = MOV / "refs"; out.mkdir(exist_ok=True)
    return run(f"deconstruct {source[-40:]}", f"uv run {q(SK / 'x-video-frames/deconstruct.py')} {q(source)}", out)


@mcp.tool()
def download(url: str, dest: str) -> dict:
    """Download a video from a link (X, Instagram, YouTube, TikTok) into a folder, e.g. a faceless project's assets/real/ for real footage."""
    d = Path(dest).expanduser(); d.mkdir(parents=True, exist_ok=True)
    return run(f"download {url[-40:]}", f"uvx --python 3.12 yt-dlp -q --no-warnings --merge-output-format mp4 -o '%(id)s.%(ext)s' {q(url)}", d)


# ---------------------------------------------------------------- dashboard
def safe(p):
    p = Path(p).expanduser().resolve()
    if not any(p.is_relative_to(r.resolve()) for r in ROOTS + [JOBDIR]) or not p.is_file(): raise PermissionError(str(p))
    return p


@mcp.custom_route("/", methods=["GET"])
async def home(_: Request): return HTMLResponse(PAGE.replace("__PORT__", str(PORT)))


@mcp.custom_route("/file", methods=["GET"])
async def file(r: Request):
    try: return FileResponse(safe(r.query_params["p"]), headers={"Cache-Control": "no-store"})
    except (PermissionError, KeyError): return Response(status_code=404)


@mcp.custom_route("/api/state", methods=["GET"])
async def state(_: Request): return JSONResponse({"projects": projects(), "jobs": [job_view(j, 12) for j in sorted(JOBS.values(), key=lambda j: -j["started"])]})


@mcp.custom_route("/api/act", methods=["POST"])
async def api_act(r: Request):
    b = await r.json()
    try:  # in a thread: a search or editor start must not stall the page's other requests
        if b["action"] == "editor": return JSONResponse({"url": await asyncio.to_thread(start_editor, b["project"])})
        if b["action"] == "search":
            text = await asyncio.to_thread(library, "search", b["query"], "--k", 12, "--out", JOBDIR / "hits.jpg")
            return JSONResponse({"text": text, "sheet": str(JOBDIR / "hits.jpg")})
        return JSONResponse(act(b["project"], b["action"], **{k: v for k, v in b.items() if k not in ("project", "action")}))
    except Exception as e: return JSONResponse({"error": str(e)}, status_code=400)


PAGE = r"""<!doctype html><meta charset="utf-8"><title>claude-s studio</title><meta name="viewport" content="width=device-width">
<style>
 :root{--bg:#0f0f10;--card:#1a1a1c;--line:#2a2a2e;--fg:#e8e8ea;--dim:#8a8a90;--acc:#e8b04a}
 body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 -apple-system,system-ui,sans-serif}
 header{display:flex;gap:16px;align-items:center;padding:14px 20px;border-bottom:1px solid var(--line)} h1{font-size:16px;margin:0}
 header span{color:var(--dim);font-size:12px} main{display:grid;grid-template-columns:1fr 380px;gap:20px;padding:20px}
 @media(max-width:900px){main{grid-template-columns:1fr}} h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:0 0 10px}
 .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
 .card{background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
 .card img,.card video{width:100%;aspect-ratio:16/9;object-fit:cover;background:#000;display:block}
 .body{padding:10px 12px} .name{font-weight:600} .kind{color:var(--dim);font-size:12px} .next{margin:6px 0;font-size:12px}
 .next b{color:var(--acc)} button{background:#26262a;color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 9px;margin:2px 2px 0 0;cursor:pointer;font-size:12px}
 button:hover{border-color:var(--acc)} .job{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:8px;font-size:12px}
 .job pre{white-space:pre-wrap;color:var(--dim);max-height:140px;overflow:auto;margin:6px 0 0;font-size:11px}
 .running{color:var(--acc)} .failed{color:#e86a5a} .done{color:#7cc68a} input{width:100%;box-sizing:border-box;background:#111;color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:7px}
 #hits img{width:100%;margin-top:8px;border-radius:6px} #hits pre{white-space:pre-wrap;font-size:11px;color:var(--dim)}
</style>
<header><h1>claude-s studio</h1><span>Claude drives it through MCP at 127.0.0.1:__PORT__/mcp; everything here runs on this Mac</span></header>
<main><section><h2>Projects</h2><div class="grid" id="ps"></div></section>
<aside><h2>Search footage</h2><input id="q" placeholder="two friends walking into a valley"><div id="hits"></div>
<h2 style="margin-top:20px">Jobs</h2><div id="js"></div></aside></main>
<script>
const $=s=>document.querySelector(s), f=p=>'/file?p='+encodeURIComponent(p);
async function act(project,action,extra={}){const r=await(await fetch('/api/act',{method:'POST',body:JSON.stringify({project,action,...extra})})).json();
 if(r.error)alert(r.error); if(r.url)open(r.url,'_blank'); tick();}
const BTN={'aura-edit':['build','stills','render','gate','export','editor'],'faceless-video':['stills','render','gate'],'ugc-edit':['build','stills','render','gate']};
let shown='';
async function tick(){const s=await(await fetch('/api/state')).json(), key=JSON.stringify(s.projects);
 if(key!==shown){shown=key; $('#ps').innerHTML=s.projects.map(p=>`<div class="card">
  ${p.videos[0]?`<video src="${f(p.path+'/'+p.videos[0])}" ${p.poster?`poster="${f(p.poster)}"`:''} controls preload="none"></video>`:p.poster?`<img src="${f(p.poster)}">`:'<img>'}
  <div class="body"><div class="name">${p.name}</div><div class="kind">${p.kind} · ${p.size}${p.busy?' · <span class="running">busy</span>':''}</div>
  <div class="next">next: <b>${p.next}</b>, ${p.why}</div>
  ${BTN[p.kind].map(a=>`<button onclick="act('${p.name}','${a}'${a==='stills'?",{times:prompt('seconds, comma separated','1')||'1'}":''})">${a}</button>`).join('')}</div></div>`).join('')||'<p>No projects yet. Ask Claude for a video.</p>';}
 $('#js').innerHTML=s.jobs.map(j=>`<div class="job"><span class="${j.state}">${j.state}</span> ${j.title} · ${j.secs}s<pre>${j.log.replace(/</g,'&lt;')}</pre></div>`).join('')||'<div class="kind">none yet</div>';}
$('#q').onkeydown=async e=>{if(e.key!=='Enter')return; $('#hits').innerHTML='<pre>searching...</pre>';
 const r=await(await fetch('/api/act',{method:'POST',body:JSON.stringify({action:'search',query:e.target.value})})).json();
 $('#hits').innerHTML=`<pre>${(r.text||r.error||'').replace(/</g,'&lt;')}</pre>`+(r.sheet?`<img src="${f(r.sheet)}&${Date.now()}">`:'');};
tick(); setInterval(tick,2000);
</script>"""

if __name__ == "__main__":
    print(f"claude-s studio: http://127.0.0.1:{PORT}  (MCP at /mcp)")
    mcp.run(transport="streamable-http")
