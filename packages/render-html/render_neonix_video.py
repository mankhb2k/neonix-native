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

NO RAW FRAMES EVER TOUCH DISK (Cloud Run has no real disk -- see below)
-------------------------------------------------------------------------
Each worker pipes its captured PNG screenshots directly into its OWN
`ffmpeg -f image2pipe -i -` subprocess (stdin), producing one small encoded
MP4 *segment* per worker. Segments are then concatenated with ffmpeg's
`-f concat -c copy` (stream copy, no re-encode) into the final output. Only
small H.264 segments -- never raw PNG frames -- are written to the
filesystem, which matters because on Cloud Run "disk" is actually the
container's own memory (tmpfs): a few hundred MB of raw PNGs for a longer
clip could exhaust the memory budget, while the equivalent H.264 segments are
a small fraction of that size.

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

This module is also imported directly (not just run as a CLI) by
server.py's FastAPI render endpoint -- see render_html_to_mp4() below.
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
from typing import Optional


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


def render_frame_range_to_segment(html_path: str, segment_path: str, width: int, height: int,
                                   fps: float, start_frame: int, end_frame: int):
    """Runs in its own OS process: launches one headless Chromium, scrubs every
    CSS animation on the page to each frame's exact virtual time, screenshots
    it, and pipes the PNG bytes straight into this worker's own ffmpeg
    subprocess -- no frame file ever hits the filesystem."""
    from playwright.sync_api import sync_playwright

    # ffmpeg's own stderr goes straight to a file, not a pipe: a pipe has a
    # small OS buffer (64KB on Linux), and ffmpeg logs enough per-frame stats
    # that leaving it undrained while we're busy writing frames to stdin can
    # deadlock (ffmpeg blocks writing to a full stderr pipe, we're blocked
    # writing to its stdin, neither side is reading the other). A file has no
    # such limit, and we only need the contents if the encode actually fails.
    stderr_path = f"{segment_path}.stderr.log"
    with open(stderr_path, "wb") as stderr_file:
        ffmpeg = subprocess.Popen(
            [
                "ffmpeg", "-y",
                "-f", "image2pipe", "-vcodec", "png", "-framerate", str(fps), "-i", "-",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
                segment_path,
            ],
            stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=stderr_file,
        )

        try:
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
                    assert ffmpeg.stdin is not None
                    ffmpeg.stdin.write(page.screenshot())

                browser.close()
        finally:
            # NOTE: deliberately .wait(), not .communicate() -- communicate()
            # tries to close+flush stdin itself, which raises "flush of closed
            # file" on a stream we already closed ourselves above.
            if ffmpeg.stdin is not None:
                ffmpeg.stdin.close()
            ffmpeg.wait()

    if ffmpeg.returncode != 0:
        stderr_tail = Path(stderr_path).read_text(encoding="utf-8", errors="ignore")[-2000:]
        os.remove(stderr_path)
        raise RuntimeError(
            f"ffmpeg segment encode failed (frames {start_frame}-{end_frame}): {stderr_tail}"
        )
    os.remove(stderr_path)

    return (start_frame, end_frame, segment_path)


def concat_segments(segment_paths, out_path: str):
    """Stream-copies (no re-encode) a list of already-encoded MP4 segments into one file."""
    work_dir = os.path.dirname(segment_paths[0])
    list_path = os.path.join(work_dir, "segments.txt")
    with open(list_path, "w", encoding="utf-8") as f:
        for path in segment_paths:
            escaped = os.path.abspath(path).replace("'", "'\\''")
            f.write(f"file '{escaped}'\n")
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy", out_path]
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


def render_html_to_mp4(
    html_path: str,
    out_path: str,
    width: int,
    height: int,
    fps: float,
    duration: float,
    workers: Optional[int] = None,
    audio_path: Optional[str] = None,
    tmp_root: Optional[str] = None,
    keep_segments: bool = False,
    progress=print,
) -> Path:
    """Core entry point shared by the CLI (main(), below) and server.py's
    FastAPI render endpoint. Renders html_path frame-by-frame into out_path,
    writing only small per-worker H.264 segments (never raw frames) to disk,
    then concatenating them (and optionally muxing audio_path in)."""
    total_frames = math.ceil(duration * fps)
    resolved_workers = workers or os.cpu_count() or 1
    resolved_workers = max(1, min(resolved_workers, total_frames))

    chunk = math.ceil(total_frames / resolved_workers)
    ranges = [(i, min(i + chunk, total_frames)) for i in range(0, total_frames, chunk)]

    progress(f"[render] {Path(html_path).name} -> {total_frames} frames @ {fps}fps, "
              f"{width}x{height}, {len(ranges)} worker(s)")

    work_dir = tempfile.mkdtemp(prefix="neonix_render_", dir=tmp_root)
    segment_paths = [os.path.join(work_dir, f"segment_{idx:04d}.mp4") for idx in range(len(ranges))]
    t0 = time.time()

    try:
        with ProcessPoolExecutor(max_workers=len(ranges)) as pool:
            futures = [
                pool.submit(render_frame_range_to_segment, str(html_path), segment_paths[idx], width, height, fps, s, e)
                for idx, (s, e) in enumerate(ranges)
            ]
            for f in as_completed(futures):
                s, e, seg = f.result()
                progress(f"[render] worker done: frames {s}-{e} -> {os.path.basename(seg)}")

        progress(f"[render] capture done in {time.time() - t0:.1f}s, concatenating...")

        resolved_out = Path(out_path).resolve()
        resolved_out.parent.mkdir(parents=True, exist_ok=True)

        merged = str(resolved_out.with_suffix(".merged.mp4")) if audio_path else str(resolved_out)
        concat_segments(segment_paths, merged)
        if audio_path:
            mux_audio(merged, str(Path(audio_path).resolve()), str(resolved_out))
            os.remove(merged)

        progress(f"[render] wrote {resolved_out} ({resolved_out.stat().st_size / 1e6:.2f} MB) "
                  f"in {time.time() - t0:.1f}s total")
        return resolved_out
    finally:
        if not keep_segments:
            shutil.rmtree(work_dir, ignore_errors=True)
        else:
            progress(f"[render] segments kept at {work_dir}")


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
    ap.add_argument("--keep-segments", action="store_true",
                    help="Don't delete the temporary per-worker MP4 segments directory afterward")
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

    render_html_to_mp4(
        str(html_path), args.out, int(width), int(height), float(fps), float(duration),
        workers=args.workers, audio_path=args.audio, keep_segments=args.keep_segments,
    )


if __name__ == "__main__":
    main()

# ---------------------------------------------------------------------------
# Benchmark notes (2 vCPU / 7.8GB RAM sandbox, 1920x1080, 30fps, 65s = 1950 frames):
#   1 worker (serial):        ~0.56 s/frame  -> ~18 min total
#   2 workers (= vCPU count): ~538 s total    -> ~9 min total  (near-linear 2x)
# Parallel speedup scales close to linearly up to (worker count == vCPU count);
# going beyond that gives diminishing or negative returns (context-switching,
# per-worker Chromium startup overhead, shared disk/memory bandwidth). These
# numbers predate the piped-segment rewrite above; per-frame Chromium/paint
# cost is unchanged, so wall-clock time should be materially the same or
# slightly better (no PNG file I/O), just with far lower peak memory/disk use.
# ---------------------------------------------------------------------------
