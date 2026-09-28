"""
FastAPI wrapper around render_neonix_video.py, for Cloud Run deployment.

See ARCHITECHTURE.md "Hai kien truc render doc lap": this is Kien truc B's
real export path (packages/render-html). Deliberately standalone -- no shared
code with Kien truc A (motion-compiler / motion-runtime / render-native).

Auth/health/error-shape conventions are copied from the other Cloud Run
services in this repo (infra/cloud-run/layout-probe, infra/cloud-run/
media-preparer): an `X-Internal-Worker-Token` header checked against the
INTERNAL_WORKER_TOKEN env var (401 if the header is wrong, 503 if the env var
itself isn't set), `/health` + `/healthz` + `/readyz`, and
`{"ok": false, "error": "..."}` on failure.

Request body: { jobId, html, width?, height?, fps?, durationMs?, workers?,
audioUrl? }. width/height/fps fall back to the file's own
<meta name="neonix-document"> tag, same as the CLI. durationMs is NOT
auto-detected (see render_neonix_video.py's module docstring) and must always
be supplied by the caller. On success, responds with the rendered MP4 as the
raw response body (video/mp4) -- this service does no R2/storage I/O itself,
by design, to keep it a pure HTML-to-MP4 function.
"""

import json
import os
import shutil
import tempfile
import urllib.request
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, Request, Response
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

from render_neonix_video import parse_composition, render_html_to_mp4

app = FastAPI()

MAX_BODY_BYTES = 16 * 1024 * 1024  # real documents with inline base64 fonts/images can get large
TMP_ROOT = os.environ.get("TMPDIR") or None
AUDIO_DOWNLOAD_TIMEOUT_SECONDS = 30


def _token_configured() -> bool:
    return bool(os.environ.get("INTERNAL_WORKER_TOKEN", "").strip())


def _authorized(token: Optional[str]) -> bool:
    expected = os.environ.get("INTERNAL_WORKER_TOKEN", "").strip()
    return bool(expected) and (token or "").strip() == expected


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"ok": False, "error": message})


@app.get("/health")
@app.get("/healthz")
@app.get("/readyz")
def health():
    return {"ok": True, "service": "render-html"}


def _required_string(payload: dict, name: str) -> str:
    value = payload.get(name)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} is required")
    return value


def _positive_number(payload: dict, name: str) -> Optional[float]:
    value = payload.get(name)
    if value is None:
        return None
    if not isinstance(value, (int, float)) or isinstance(value, bool) or value <= 0:
        raise ValueError(f"{name} must be a positive number")
    return float(value)


def _download_audio(url: str, dest_dir: str) -> str:
    parsed_scheme = url.split("://", 1)[0].lower()
    if parsed_scheme not in ("http", "https"):
        raise ValueError("audioUrl must be http(s)")
    suffix = Path(url.split("?", 1)[0]).suffix or ".audio"
    dest_path = os.path.join(dest_dir, f"audio{suffix}")
    with urllib.request.urlopen(url, timeout=AUDIO_DOWNLOAD_TIMEOUT_SECONDS) as response, open(dest_path, "wb") as out:
        shutil.copyfileobj(response, out)
    return dest_path


@app.post("/v1/html/render")
async def render(request: Request, x_internal_worker_token: Optional[str] = Header(default=None)):
    if not _authorized(x_internal_worker_token):
        return _error(401 if _token_configured() else 503, "unauthorized")

    body = await request.body()
    if len(body) > MAX_BODY_BYTES:
        return _error(400, "request body too large")

    try:
        payload = json.loads(body.decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("invalid JSON body")
        job_id = _required_string(payload, "jobId")
        html = _required_string(payload, "html")
        duration_ms = _positive_number(payload, "durationMs")
        if duration_ms is None:
            raise ValueError("durationMs is required")
        width = _positive_number(payload, "width")
        height = _positive_number(payload, "height")
        fps = _positive_number(payload, "fps")
        workers_raw = payload.get("workers")
        if workers_raw is not None and (not isinstance(workers_raw, int) or isinstance(workers_raw, bool) or workers_raw < 1):
            raise ValueError("workers must be a positive integer")
        audio_url = payload.get("audioUrl")
        if audio_url is not None and (not isinstance(audio_url, str) or not audio_url.strip()):
            raise ValueError("audioUrl must be a non-empty string")
    except (ValueError, UnicodeDecodeError) as error:
        return _error(400, str(error))
    except json.JSONDecodeError as error:
        return _error(400, f"invalid JSON body: {error}")

    job_dir = tempfile.mkdtemp(prefix="neonix_job_", dir=TMP_ROOT)
    try:
        html_path = os.path.join(job_dir, "input.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)

        composition = parse_composition(Path(html_path))
        resolved_width = int(width or composition.get("width") or 0)
        resolved_height = int(height or composition.get("height") or 0)
        resolved_fps = float(fps or composition.get("fps") or 0)
        if not resolved_width or not resolved_height or not resolved_fps:
            missing = [n for n, v in [("width", resolved_width), ("height", resolved_height), ("fps", resolved_fps)] if not v]
            return _error(400, f"Missing: {', '.join(missing)} (not in the request and not in the "
                                f"document's neonix-document meta tag)")

        audio_path = await run_in_threadpool(_download_audio, audio_url, job_dir) if audio_url else None

        out_path = os.path.join(job_dir, "output.mp4")
        try:
            resolved_out = await run_in_threadpool(
                render_html_to_mp4,
                html_path, out_path, resolved_width, resolved_height, resolved_fps, duration_ms / 1000.0,
                workers=workers_raw, audio_path=audio_path, tmp_root=job_dir,
                progress=lambda message: print(json.dumps({"jobId": job_id, "message": message})),
            )
        except Exception as error:  # noqa: BLE001 -- reported to the caller, not a crash
            print(json.dumps({"jobId": job_id, "error": str(error)}))
            return _error(500, f"render failed: {error}")

        video_bytes = Path(resolved_out).read_bytes()
        return Response(content=video_bytes, media_type="video/mp4", headers={"X-Neonix-Job-Id": job_id})
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
