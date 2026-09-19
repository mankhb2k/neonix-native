# Native Skia CPU Cloud Run benchmark

This image is the CPU-only control for the GPU experiment. It uses native
Skia `SkSurface::MakeRaster`, emits raw RGBA frames to stdout when `--raw` is
set, and prints JSON timing metrics to stderr. It does not load CanvasKit or
any GPU runtime.

Example local/container command:

```text
/usr/local/bin/neonix-skia-cpu-backend --width 1920 --height 1080 --frames 1800 --raw \
  | ffmpeg -f rawvideo -pixel_format rgba -video_size 1920x1080 -framerate 30 -i - \
      -c:v libx264 -preset veryfast -pix_fmt yuv420p /tmp/native-skia-cpu.mp4
```

The first benchmark composition mirrors the existing three-layer smoke
fixture (background, animated ellipse, rounded panel). It is a native Skia
CPU benchmark slice, not yet the full PaintCommandBuffer bridge. Full parity
requires replacing the fixed scene with the versioned command protocol.

Cloud Run benchmark settings: one task, parallelism one, 4 vCPU, no GPU,
16 GiB memory, and an immutable Artifact Registry digest. Record the native
JSON line, FFmpeg timings, execution timestamps, image digest, and output
checksum in the canonical
[`docs/render-benchmark-comprehensive-assessment.md`](../../../../docs/render-benchmark-comprehensive-assessment.md).
