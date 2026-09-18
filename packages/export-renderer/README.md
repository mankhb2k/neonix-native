# Native export renderer

`@motionvideo/export-renderer` is Neonix's local-first, offline export worker
for `RuntimeProjectV3`.

The package owns the export contracts and the pixel-to-artifact pipeline. It
does not parse authoring documents, run the interactive Playback engine, or
invent timeline semantics. Those responsibilities belong to the compiler and
runtime packages.

Import shared schemas and types from:

```ts
import type { RenderJob } from "@motionvideo/export-renderer/contracts";
```

## Architecture at a glance

The important boundary is between frame production and video encoding:

```text
MotionProtocolV2
        |
        v
Compiler + hydrated media catalog
        |
        v
RuntimeProjectV3
        |
        v
Prepared export runtime
        |
        v
Shared frame evaluator
  - frame clock and timeline mapping
  - transforms, opacity, hierarchy
  - text shaping and layout
  - media-time resolution
  - effects and compositing semantics
        |
        v
PaintCommandBuffer
        |
        +--------------------+----------------------+
        |                                           |
        v                                           v
CanvasKit preview                         Native Skia CPU raster
browser/WebGL2                           native export worker
                                                |
                                                v
                                      libyuv -> libx264/FFmpeg
                                                |
                                                v
                                           MP4 artifact
```

Preview and export must use the same frame semantics. Only the backend that
replays the `PaintCommandBuffer` changes. CanvasKit is the browser preview
backend; native Skia CPU raster is the production-native export backend. Native
Skia Vulkan is a future GPU candidate behind the same command-buffer contract.

FFmpeg is an encoder/muxer in this architecture. It must not be responsible
for evaluating the scene, rasterizing HTML, or taking browser screenshots.

## Current implementation

There is one MP4 export path. The implementation is intentionally fail-closed
while native parity is being completed:

```text
RuntimeProjectV3
  -> prepareRuntimeProjectV3 (once per job)
  -> evaluatePreparedRuntimeProjectV3 (per frame)
  -> PaintCommandBuffer
       |
       v
  Native Skia CPU worker
       |
       v
  libyuv -> libx264 in-process
       |
       v
      MP4
```

`renderRuntimeProjectV3`, `renderFrameRangeToMp4`, `render:job`, chunk workers,
the API render route, and the CLI all use the native adapter. There is no
CanvasKit fallback and `RENDER_BACKEND` is no longer a routing switch. If a
project contains a command that the native protocol does not support yet
(currently image/video/audio and some effects), export returns an explicit
`UNSUPPORTED_COMMAND` error. This prevents a preview backend from becoming an
undocumented production source of truth.

CanvasKit remains in the browser preview package and in historical benchmark
fixtures only. `renderOneFrameToSvg` is a preview/diagnostic helper and never
creates an MP4.

The former SVG/libvips rasterizer remains a legacy diagnostic helper only. GPU
rendering may be added later behind a feature flag after it passes the same
golden-frame tests.

## Runtime and ownership boundaries

```text
Neonix JSON V2
  -> authoring schema and audio fields

Compiler pipe
  -> compiled timeline, linked media/audio relationships,
     hydrated media catalog, RuntimeProjectV3

Motion Runtime
  -> frame-time and sample-time semantics,
     animation evaluation, media-time mapping

Export Renderer
  -> prepared resources, frame scheduling, pixel rendering,
     media frame delivery, encoder flow control

Offline Audio Backend
  -> audio decode, gain/pan/fade processing, sample mixing

Video encoder + muxer
  -> encoded video, encoded audio, final MP4 container

Web API / R2
  -> job state, artifact ownership, publication and cleanup
```

`RuntimeProjectV3` must remain backend-neutral. It must not contain texture
handles, GPU objects, decoder instances, encoder state, browser objects, or
other process-local resources.

## Prepared export runtime

An export opens one session and prepares reusable resources once. It must not
rebuild the scene for every frame:

```text
open export session
  -> validate runtime and preset
  -> probe media and build resource table
  -> prepare fonts, images, paths, and decoders
  -> calculate cache fingerprints
  -> render frame range
  -> flush encoder and finalize mux
  -> verify and publish artifact
close export session
```

The forbidden hot path is:

```text
parse JSON -> rebuild scene -> rebuild DOM -> screenshot
```

The frame loop should only evaluate dynamic state and replay the work that is
needed for the requested frame:

```text
for each composition frame:
    evaluate shared frame state
    resolve media frame at exact media time
    replay static and dynamic paint passes
    composite into the output frame
    submit to the bounded encoder queue
```

## Shared frame semantics

The preview and export paths share these semantic inputs and operations:

- composition frame clock and frame-to-time conversion;
- animation interpolation and easing;
- layer hierarchy, transforms, visibility, and opacity;
- text shaping, font selection, and layout;
- media trim, playback rate, loop, reverse, and time remapping;
- masks, effects, blend modes, and isolated compositing;
- deterministic rounding, color, and dimension rules.

The evaluator produces a backend-neutral `PaintCommandBuffer`. The evaluator
must not branch on GPU or CPU implementation details. Backend-specific handles
are resolved only when commands are prepared or replayed.

## Media frame provider

Video and animated media are prepared independently from the visual evaluator.
The provider should expose deterministic frame access by media time:

```ts
interface MediaFrameProvider {
  prepare(asset: RuntimeMediaAsset): Promise<void>;
  getFrame(assetId: string, mediaTimeUs: number): Promise<DecodedMediaFrame>;
  dispose(): Promise<void>;
}
```

Required behavior:

- probe streams and timestamps once per export session;
- resolve frames using exact presentation timestamps;
- support sequential playback with bounded feed-ahead;
- reset from a keyframe for seek, reverse, and non-sequential access;
- keep cache size bounded and release decoder resources on eviction;
- use separate mutable decoder state when clips share an asset but have
  different timing behavior;
- provide a native/FFmpeg fallback for codecs unsupported by the primary
  decoder;
- produce the same media-time result for preview and export.

### Phase 3 local implementation

The Skia asset boundary currently implements the first optimization slice of
this provider contract:

- input-side FFmpeg seek is used for non-sequential requests;
- a decoder session is started only after two adjacent timestamps prove that
  access is sequential, then it feeds subsequent PNG frames from one process;
- resized output frames are cached separately from decoded source frames, so a
  loop hit does not invoke Sharp again;
- raw and resized video caches use a bounded LRU policy (48 entries by
  default); `SkiaFrameAssetResolver.getStats()` exposes hit, miss, decode,
  resize, session, and eviction counters for benchmark runs.

The session is reset for random seek, reverse playback, asset changes, or
non-adjacent timestamps. Exact timestamp parity remains the acceptance gate
before replacing this fallback with a native decoder.

The original MP4 video stream is the visual source. If the compiled project
contains a detached audio derivative, the original embedded audio must be
disabled for final mixing so audio cannot be included twice.

## Logical and physical resolution

Composition geometry is expressed in a stable logical coordinate space. The
export preset determines the physical output size:

```text
logical composition: 1920 x 1080
  -> 720p preset:    1280 x 720
  -> 1080p preset:   1920 x 1080
  -> 1440p preset:   2560 x 1440
  -> 4K preset:      3840 x 2160
```

Scaling is applied consistently to transforms, text, strokes, blur radii,
masks, images, and effect parameters. Encoders receive even physical
dimensions. Logical resolution must not be changed as an accidental side
effect of a backend or output preset.

## Caching and invalidation

Every reusable resource has a fingerprint that covers all values capable of
changing its pixels:

```text
resource fingerprint
  + asset integrity
  + Runtime version
  + renderer version
  + export preset
```

Examples:

- images: content hash and decode-relevant dimensions;
- SVG/path geometry: path data, trim/morph state, dimensions, and paint;
- text: content, font identity, size, shaping result, and style;
- static subtrees: all descendants, assets, and effects that contribute to
  the isolated surface.

Static geometry, glyph runs, textures, decoded frames, and isolated surfaces
may be cached. A cache hit must not cause a stale visual result, and unchanged
resources must not be re-rasterized or re-uploaded on every frame.

Static surface caching is valid only while every visual input for that surface
is unchanged. It is an execution optimization, never a new timeline rule.

## Frame scheduling and backpressure

Rendering and encoding are separate stages connected by a bounded queue:

```text
frame evaluator -> renderer -> bounded frame queue
                                      |
                                      v
                             video encoder -> muxer
```

The scheduler must define an explicit `maxFramesInFlight`. The producer waits
when the encoder queue is full; it must not keep allocating RGBA frames until
the process runs out of memory.

Progress is tracked separately:

```text
rendered -> submitted -> encoded -> muxed
```

A job reaches 100% only after encoder flush, mux finalization, artifact
verification, and publication succeed. Encoder and muxer drain operations
must have watchdog timeouts so a stalled subprocess becomes a diagnosable
failure rather than an indefinitely running job.

## Artifact lifecycle and memory rules

The export path is asynchronous for production workloads:

```text
queued -> preparing -> rendering -> encoding -> finalizing
       -> verifying -> published
```

The worker must not implement this artifact path:

```text
MP4 -> ArrayBuffer -> Blob -> base64 -> Node Buffer
```

Use a temporary file or bounded multipart stream, verify the completed output,
then publish it atomically. Peak memory must not grow linearly with the final
MP4 size. Temporary artifacts must have ownership, cleanup, and retry rules.

## Backend strategy

The backend order is deliberate:

1. Native Skia raster backend for correctness and deterministic output.
2. Resource caches and isolated-surface reuse.
3. Batching and specialized native passes.
4. Native Skia Ganesh + Vulkan behind a feature flag.
5. Optional hardware encoding after visual parity is stable.

CanvasKit/WASM/WebGL remains the browser preview backend and may be used for
semantic investigation. The current Cloud Run native export worker uses Skia
CPU raster. Native Skia Ganesh + Vulkan is a candidate backend, not an enabled
production path; headless Chrome, WebGPU, WebGL, and screenshots are not part
of the native export path because browser startup, host drift, and extra
readbacks make performance and determinism difficult to control.

The native CPU color contract is explicit: opaque sRGB raster pixels are
converted by pinned libyuv to BT.709 limited-range YUV420P, then encoded by
in-process libx264. `libswscale` is retained only in the sandbox image as the
fallback and A/B reference.

Every benchmark records the actual backend, not only the requested one:

```ts
type BackendIdentity = {
  requestedBackend: string;
  actualBackend: string;
  adapterName?: string;
  driverVersion?: string;
  softwareRenderer: boolean;
  encoderName?: string;
  hardwareAcceleration?: boolean;
  fallbackReason?: string;
};
```

SwiftShader and other software fallbacks must be reported as software
benchmarks and must not be presented as hardware GPU results. Calling
`gpuFinish()` every frame may serialize CPU and GPU work, so fence and drain
strategies must be measured rather than assumed. A GPU-canvas to 2D-canvas to
`VideoFrame` path is a full-frame copy; it is not zero-copy.

## Failure policy

Production exports use `strict` by default:

- required assets, codecs, fonts, effects, and audio fail the job explicitly
  when unsupported;
- the worker never silently drops audio, substitutes an unrelated asset, or
  uses embedded video audio when a detached derivative is required;
- `best-effort` is opt-in for previews or diagnostics and must report every
  substitution in the job result and logs.

This makes an apparently successful but visually incorrect MP4 impossible in
the normal production path.

## Correctness and performance gates

Every backend must pass the same golden-frame and timeline tests before it is
enabled for production. Required coverage includes:

- representative frames at the beginning, middle, end, and transition points;
- 720p, 1080p, 1440p, and optional 4K output sizes;
- transforms, text, strokes, blur, masks, blend modes, and isolated layers;
- sequential playback, seek, reverse, loop, trim, playback rate, freeze,
  and time remapping;
- the same asset used by multiple clips with different timing;
- unsupported codec and missing-resource fallback behavior;
- preview/export pixel parity within the declared tolerance;
- bounded memory, bounded encoder queue, and timeout behavior.

Performance reports include:

```text
prepare time
render time
encode time
mux/finalize time
wall-clock duration
peak RSS
frames in flight
cache hit/miss counts
requested and actual render backend
requested and actual encoder
```

## Source layout

```text
src/
  api/        HTTP server and route dispatch
  media/      media probing, preparation, decoding, and resource helpers
  render/     frame evaluation, paint replay, rasterization, and scheduling
  contracts/  shared render job schemas and types
  cli.ts      local render smoke entrypoint
  testing.ts  local Runtime V3 fixtures
```

The API layer validates and dispatches requests. Media preparation, visual
rendering, encoding, and artifact publication stay in separate modules so
future endpoints do not duplicate processing logic.

## Local usage

From the repository root:

```bash
pnpm --filter @motionvideo/export-renderer render:smoke
```

Output is written to:

```text
tmp/export-renderer/native-export-smoke.mp4
```

## HTTP worker

```bash
pnpm --filter @motionvideo/export-renderer start
```

Endpoints:

- `GET /health` (also `/healthz` and `/readyz`)
- `POST /v1/renders`
- `POST /v1/render-jobs` → `202` with `statusUrl`
- `GET /v1/render-jobs/:jobId` → persisted progress and artifact state
- `DELETE /v1/render-jobs/:jobId` → cancellation and FFmpeg abort
- `POST /v1/media/prepare` (requires `x-internal-worker-token`)

The asynchronous render-job endpoints also require
`x-internal-worker-token` when `INTERNAL_WORKER_TOKEN` is configured. Jobs are
persisted by the local file-backed renderer store, render into an
attempt-scoped temporary MP4, run `ffprobe` and SHA-256 verification, and are
atomically renamed to the final output only after verification succeeds. The
web BFF dispatches without waiting for the render, polls status, then streams
the verified artifact to a temporary `__tmp__/render/` R2 object and copies it
to the final key. Configure an R2 lifecycle rule for that prefix as a second
line of defense against abandoned uploads.
The transfer never materializes the complete MP4 as a Node `Buffer`.

The production queue source of truth is Supabase `render_jobs`; the PGMQ
message contains only `{ jobId }`. The queue consumer claims a database lease,
renews its heartbeat while polling the renderer, retries transient failures,
recovers stale leases, and checks cancellation before dispatch. Local file
jobs remain only for development and renderer tests.

Render request:

```json
{
  "project": "<RuntimeProjectV3>",
  "outputName": "local-test.mp4",
  "frameCount": 30
}
```

For video-only exports, Phase 5 can render isolated frame ranges in parallel
processes and concatenate the encoded segments without re-encoding:

```json
{
  "project": "<RuntimeProjectV3>",
  "outputName": "local-parallel-test.mp4",
  "frameCount": 1800,
  "parallelism": 4,
  "chunkSize": 300,
  "chunkRetries": 1
}
```

Each chunk has absolute frame boundaries, an attempt number, and a SHA-256
checksum. The scheduler retries only the failed chunk. Native export is the
only render implementation; projects containing native-unsupported audio,
video, image, effect, or text features fail with an explicit capability error
until their parity work is complete. They never fall back to CanvasKit.

H.264 encoding defaults to one FFmpeg encoder thread for byte-stable output
within the same runtime and preset. A caller may set `ffmpegThreads` explicitly
when throughput is more important than byte-for-byte repeatability; decoded
frame verification remains the image-quality contract.

### Historical CanvasKit benchmark

These numbers are retained only as the pre-native comparison baseline. They
must not be interpreted as the current export implementation. The current
production path is native Skia CPU plus in-process libyuv/libx264.

Measured on the local software CanvasKit backend at 1920x1080, 30 FPS:

| Run | Render time | Encode time | Result |
| --- | ---: | ---: | --- |
| 30 frames, before | ~9.4 s | ~0.2 s | 30 frames |
| 30 frames, after | 2.30 s | 0.19 s | 30 frames |
| 300 frames, before | ~137.8 s | ~0.5 s | 300 frames |
| 300 frames, after | 61.89 s | 0.46 s | 300 frames |
| 1,800 frames, parallelism 4, after | 540.16 s | 0.25 s | 1,800 frames / 60 s |

The full run produced a valid 1920x1080 H.264 MP4 with exactly 1,800 frames
and 60 seconds. The 30-frame output has identical per-frame checksums to the
pre-optimization baseline. Four isolated workers used roughly 0.5 GiB RSS each
on this machine, so concurrency must be bounded by the Cloud Run memory budget.
The command profiler is available at
`apps/web/scripts/profile-neonix-commands.ts`.

The previous Phase 6 audio run is retained as a historical reference. The
current native-only export intentionally rejects audio/video manifests until
native media decoding and audio finalization are implemented and parity-tested;
the old CanvasKit/FFmpeg route is not a production fallback.

The latest real run rendered 300 frames / 10 seconds in 80.33 s after the
source download: R2 download 15.73 s, audio preparation 15.52 s, Skia render
63.95 s, and encode/mux 0.51 s. The output was verified with 300 H.264 video
frames, one AAC audio stream, and 10.000 s duration. The encoder submitted all
300 frames; pipe backpressure was 100 ms and finalization was 91 ms.

`outputName` is restricted to a relative `.mp4` path under
`tmp/export-renderer` by default. Media preparation reads the origin from the
configured R2 user-assets bucket, reuses the browser-generated
`{assetId}/poster.webp`, and writes `{assetId}/audio.m4a` when an audio stream
exists. The worker does not generate posters and never writes Supabase
directly; it reports the result to the Web API callback.

Media preparation request:

```json
{
  "jobId": "uuid",
  "assetId": "uuid",
  "sourceKey": "asset-id/origin.mp4",
  "sourceMimeType": "video/mp4",
  "sourceIntegrity": "r2:123:asset-id/origin.mp4",
  "callbackUrl": "https://app.example.com/api/internal/media-jobs/callback",
  "pipelineVersion": 1
}
```

## Docker

Build from the repository root so workspace packages are available:

```bash
docker build --platform linux/amd64 -f infra/cloud-run/export-renderer/skia-command-cpu-bench/Dockerfile -t neonix-skia-command-cpu-native .
docker run --rm -p 8787:8787 neonix-skia-command-cpu-native pnpm --filter @motionvideo/export-renderer start
```

## Reference policy

ClipKit and other renderers may be used as architectural references for ideas
such as prepared runtimes, immutable scene descriptions, resource caching,
frame scheduling, and backend separation. Neonix must keep an independent
implementation and must not copy or port source code covered by a restrictive
license into this package.
