#!/usr/bin/env python3
"""
render_neonix_video.py

Render a Neonix-format (or any pure-CSS-animation) HTML file to an MP4 video,
frame-by-frame, using headless Chromium (Playwright) + ffmpeg.

WHY FRAME-BY-FRAME INSTEAD OF SCREEN-RECORDING IN REAL TIME
-------------------------------------------------------------
Every CSS animation on the page is paused, then scrubbed to an exact virtual
timestamp per frame via the Web Animations API (`animation.currentTime = t`).
So each frame is rendered deterministically regardless of how fast or slow the
machine actually runs -- no dropped frames, no audio/visual timing drift, and
capture can run slower OR faster than real time without affecting correctness.

Multiple headless Chromium workers run in parallel (one OS process each,
default = number of CPUs), each rendering a contiguous slice of the frame
range, so wall-clock time scales down roughly linearly with vCPU count (see
the notes at the bottom of this file for the numbers this was benchmarked at).

USAGE
-----
  python3 render_neonix_video.py --html input.html --out output.mp4 \
      [--workers N] [--audio track.mp3] \
      [--fps 30] [--width 1920] [--height 1080] [--duration 65]

If --fps / --width / --height are omitted, they're read automatically from the
file's <meta name="neonix-document" content='{...composition...}'> tag.
--duration is NOT auto-detected (Neonix's optional `durationMs` is only a
*minimum* padding value, not the animation's real length) -- pass it explicitly
in seconds, e.g. --duration 65.

--audio takes an already-mixed, already-time-synced track (mp3/wav) and muxes
it into the final video with -shortest. This script does not attempt to
generate or sync the audio itself -- that has to be prepared separately, baked
to the exact timestamps that match your CSS animation-delay values, since the
rendered HTML itself has no JavaScript to do that at render time.

REQUIRES
--------
  pip install playwright && playwright install chromium
  ffmpeg on PATH

CLOUD DEPLOYMENT NOTE (Cloud Run specifically)
-----------------------------------------------
This script writes each PNG frame to a temp directory on "disk" and lets
ffmpeg read that directory as an image sequence afterward. On a normal VM
that's fine (disk and RAM are separate resources). On Cloud Run, the writable
filesystem is backed by the container's own memory (tmpfs) -- writing frames
"to disk" there counts against your memory allocation like any other RAM use.
For a short clip (a few hundred MB of frames) this is usually a non-issue if
you size memory accordingly; for longer/larger renders, prefer piping frames
directly into ffmpeg's stdin (`ffmpeg -f image2pipe -i -`) instead of writing
them to files at all, or mount a Cloud Storage FUSE / Filestore volume so
"disk" is backed by real storage instead of memory.
"""

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path


def parse_composition(html_path: Path):
    """Pull width/height/fps out of the <meta name="neonix-document"> tag, if present."""
    text = html_path.read_text(encoding="utf-8", errors="ignore")
    m = re.search(r'name="neonix-document"\s+content=\'([^\']+)\'', text)
    if not m:
        return {}
    try:
        return json.loads(m.group(1)).get("composition", {})
    except json.JSONDecodeError:
        return {}


def render_frame_range(html_path: str, frames_dir: str, width: int, height: int,
                        fps: float, start_frame: int, end_frame: int):
    """Runs in its own OS process: launches one headless Chromium, scrubs every
    CSS animation on the page to each frame's exact virtual time, screenshots it."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--force-color-profile=srgb"])
        page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
        page.goto(f"file://{os.path.abspath(html_path)}")
        page.wait_for_timeout(200)

        # Pause every CSS animation so we can scrub to an exact global time.
        page.evaluate("() => { document.getAnimations().forEach(a => a.pause()); }")

        for i in range(start_frame, end_frame):
            t_ms = (i / fps) * 1000.0
            page.evaluate(
                "(t) => { document.getAnimations().forEach(a => { a.currentTime = t; }); }",
                t_ms,
            )
            # let two rAF ticks elapse so style/paint reflect the new currentTime
            page.evaluate(
                "() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))"
            )
            page.screenshot(path=os.path.join(frames_dir, f"frame_{i:06d}.png"))

        browser.close()
    return (start_frame, end_frame)


def encode_video(frames_dir: str, fps: float, silent_out: str):
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", os.path.join(frames_dir, "frame_%06d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
        silent_out,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def mux_audio(silent_video: str, audio_path: str, final_out: str):
    cmd = [
        "ffmpeg", "-y",
        "-i", silent_video,
        "-i", audio_path,
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
        final_out,
    ]
    subprocess.run(cmd, check=True, capture_output=True)


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--html", required=True, help="Path to the HTML file to render")
    ap.add_argument("--out", required=True, help="Output .mp4 path")
    ap.add_argument("--audio", default=None,
                    help="Optional pre-mixed, already time-synced audio track (mp3/wav) to mux in")
    ap.add_argument("--width", type=int, default=None,
                    help="Viewport width in px (default: read from neonix-document meta tag)")
    ap.add_argument("--height", type=int, default=None,
                    help="Viewport height in px (default: read from neonix-document meta tag)")
    ap.add_argument("--fps", type=float, default=None,
                    help="Frames per second (default: read from neonix-document meta tag)")
    ap.add_argument("--duration", type=float, default=None,
                    help="Total duration in seconds (required -- not auto-detected, see notes above)")
    ap.add_argument("--workers", type=int, default=None,
                    help="Number of parallel Chromium worker processes (default: CPU count)")
    ap.add_argument("--keep-frames", action="store_true",
                    help="Don't delete the temporary PNG frames directory afterward")
    args = ap.parse_args()

    html_path = Path(args.html).resolve()
    if not html_path.exists():
        sys.exit(f"HTML file not found: {html_path}")

    comp = parse_composition(html_path)
    width = args.width or comp.get("width")
    height = args.height or comp.get("height")
    fps = args.fps or comp.get("fps")
    duration = args.duration

    missing = [n for n, v in [("width", width), ("height", height), ("fps", fps), ("duration", duration)] if not v]
    if missing:
        sys.exit(
            f"Missing: {', '.join(missing)}. Pass explicitly with --width/--height/--fps/--duration "
            f"(the file's neonix-document meta tag didn't provide all of them, or --duration "
            f"was omitted -- it must always be given explicitly)."
        )

    total_frames = math.ceil(duration * fps)
    workers = args.workers or os.cpu_count() or 1
    workers = max(1, min(workers, total_frames))

    print(f"[render] {html_path.name} -> {total_frames} frames @ {fps}fps, "
          f"{width}x{height}, {workers} worker(s)")

    frames_dir = tempfile.mkdtemp(prefix="neonix_frames_")
    t0 = time.time()

    chunk = math.ceil(total_frames / workers)
    ranges = [(i, min(i + chunk, total_frames)) for i in range(0, total_frames, chunk)]

    try:
        with ProcessPoolExecutor(max_workers=len(ranges)) as pool:
            futures = [
                pool.submit(render_frame_range, str(html_path), frames_dir, width, height, fps, s, e)
                for s, e in ranges
            ]
            for f in as_completed(futures):
                s, e = f.result()
                print(f"[render] worker done: frames {s}-{e}")

        print(f"[render] capture done in {time.time() - t0:.1f}s, encoding...")

        out_path = Path(args.out).resolve()
        out_path.parent.mkdir(parents=True, exist_ok=True)

        if args.audio:
            silent = str(out_path.with_suffix(".silent.mp4"))
            encode_video(frames_dir, fps, silent)
            mux_audio(silent, str(Path(args.audio).resolve()), str(out_path))
            os.remove(silent)
        else:
            encode_video(frames_dir, fps, str(out_path))

        print(f"[render] wrote {out_path} ({out_path.stat().st_size / 1e6:.2f} MB) "
              f"in {time.time() - t0:.1f}s total")
    finally:
        if not args.keep_frames:
            shutil.rmtree(frames_dir, ignore_errors=True)
        else:
            print(f"[render] frames kept at {frames_dir}")


if __name__ == "__main__":
    main()

# ---------------------------------------------------------------------------
# Benchmark notes (2 vCPU / 7.8GB RAM sandbox, 1920x1080, 30fps, 65s = 1950 frames):
#   1 worker (serial):        ~0.56 s/frame  -> ~18 min total
#   2 workers (= vCPU count): ~538 s total    -> ~9 min total  (near-linear 2x)
# Parallel speedup scales close to linearly up to (worker count == vCPU count);
# going beyond that gives diminishing or negative returns (context-switching,
# per-worker Chromium startup overhead, shared disk/memory bandwidth).
# ---------------------------------------------------------------------------
