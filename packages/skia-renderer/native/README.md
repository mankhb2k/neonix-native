# Native `SkiaGpuBackend` POC

`skia_gpu_backend.cpp` is the first native host for the export GPU path. It
creates a Skia Ganesh `GrDirectContext` backed by Vulkan, renders a small
surface, submits it, reads pixels back, and emits one JSON metrics line.

This is intentionally a strict POC:

- it exits when Vulkan or the Skia GPU context cannot be created;
- it never reports a CPU/raster fallback as a GPU success;
- it is not yet the full `PaintCommandBuffer` replay bridge;
- the first artifact is a dependency-free PPM readback for pixel inspection.

The next bridge step will replace the demo draw calls with a versioned
length-delimited protocol carrying `PaintCommandBuffer`, asset metadata, and
font/image payloads. The TypeScript renderer should only select this process
when `RENDER_BACKEND=skia-gpu`, and must fail fast if the process is missing or
returns `softwareRenderer=true`.
