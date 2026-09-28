# Neonix render-html

Kien truc B's real export path (see `ARCHITECHTURE.md` -> "Hai kien truc render
doc lap"): raw HTML/CSS -> headless Chromium (Playwright), scrubbed
frame-by-frame -> ffmpeg -> MP4. Deliberately standalone -- no shared code
with Kien truc A (`motion-compiler` / `motion-runtime` / `render-native`).

- `render_neonix_video.py` -- the render engine. Runnable as a CLI directly,
  or imported by `server.py`. Each parallel Chromium worker pipes its PNG
  screenshots straight into its own `ffmpeg -f image2pipe` subprocess,
  producing one small H.264 segment; segments are stream-copy-concatenated at
  the end. **No raw frame ever touches disk** -- only small encoded segments
  do, which matters on Cloud Run, where "disk" (`/tmp`) is actually the
  container's own memory (tmpfs).
- `server.py` -- a FastAPI wrapper exposing this as an HTTP service for Cloud
  Run.

## CLI

```bash
pip install playwright fastapi "uvicorn[standard]"
playwright install chromium

python3 render_neonix_video.py --html input.html --out output.mp4 \
  [--width 1080] [--height 1920] [--fps 30] --duration 65 \
  [--workers N] [--audio track.mp3]
```

`--width`/`--height`/`--fps` default to whatever the file's own
`<meta name="neonix-document">` tag declares. `--duration` is never
auto-detected (`durationMs` in that tag is only a minimum padding value, not
the real animation length) -- always pass it explicitly.

## HTTP service

```
POST /v1/html/render
X-Internal-Worker-Token: <INTERNAL_WORKER_TOKEN>
Content-Type: application/json

{
  "jobId": "hrj_...",
  "html": "<!doctype html>...",
  "width": 1080, "height": 1920, "fps": 30,   // optional, else read from the neonix-document meta tag
  "durationMs": 65000,                          // required -- see CLI note above
  "workers": 2,                                 // optional, default: CPU count
  "audioUrl": "https://..."                     // optional, http(s) only
}
```

Responds with the rendered clip as the raw `video/mp4` response body on
success, or `{"ok": false, "error": "..."}` (400/401/500/503) on failure. This
service does no R2/storage I/O of its own -- callers are expected to persist
the returned bytes themselves (kept this way so the service stays a pure
HTML-to-MP4 function, testable with a bare `curl`).

`GET /health`, `/healthz`, `/readyz` all return `{"ok": true, "service":
"render-html"}` unauthenticated, matching the other Cloud Run services in
this repo.

## Local run

```bash
export INTERNAL_WORKER_TOKEN=dev-token
python3 -m uvicorn server:app --reload --port 8080
```

## Image and Cloud Run shape

From the repository root (the build context must be repo root, matching this
repo's other Cloud Run Dockerfiles):

```powershell
docker build -f packages/render-html/Dockerfile -t neonix-render-html:dev .
docker run --rm -p 8080:8080 -e INTERNAL_WORKER_TOKEN=dev-token neonix-render-html:dev
```

`./deploy.ps1 [-Deploy -RuntimeServiceAccount ... -InternalWorkerTokenSecret ...]`
builds, pushes to Artifact Registry, and (with `-Deploy`) deploys to Cloud
Run. Rendering is CPU/memory heavy and can take several minutes per clip (see
`render_neonix_video.py`'s benchmark notes) -- the script's `--cpu`/`--memory`/
`--timeout` are starting points; tune them against a real render of your
typical clip length before relying on this in production.

Not yet wired up: `apps/web/lib/server/render/html-render-worker.ts` still
spawns this script as a local subprocess rather than calling this HTTP
service. Pointing it at a deployed instance of this service (over HTTP,
behind `INTERNAL_WORKER_TOKEN`) instead is a natural next step once this
image is deployed somewhere Node can reach it.
