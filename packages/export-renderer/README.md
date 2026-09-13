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
        |                    |                      |
        v                    v                      v
Preview GPU backend   Skia CPU golden backend   Optional GPU backend
        |                    |                      |
        +--------------------+----------------------+
                             v
                       RGBA frame buffer
                             |
                             v
                 Bounded encoder input queue
                             |
                             v
                   Video encoder + audio muxer
                             |
                             v
                         MP4 artifact
```

Preview and export must use the same frame semantics. Only the backend that
replays the `PaintCommandBuffer` changes. A GPU backend is an optimization;
the Skia CPU backend is the deterministic correctness reference.

FFmpeg is an encoder/muxer in this architecture. It must not be responsible
for evaluating the scene, rasterizing HTML, or taking browser screenshots.

## Current certified path

The current visual baseline is intentionally smaller than the target
architecture:

```text
RuntimeProjectV3
  -> evaluateRuntimeProjectV3
  -> PaintCommandBuffer
  -> SVG frame rasterization (sharp/libvips)
  -> raw RGBA stream
  -> FFmpeg H.264 MP4
```

This path proves deterministic Runtime V3 frame output. It is not yet the
complete optimized renderer. Images, videos, masks, effects, and isolated
layers remain fail-closed until their parity tests exist.

The target replacement for the SVG/libvips rasterization step is a native Skia
CPU renderer. GPU rendering may be added later behind a feature flag after it
passes the same golden-frame tests.

## Runtime and ownership boundaries

```text
Motion Protocol
  -> authoring schema and audio fields

Motion Compiler
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

1. Skia CPU golden backend for correctness and deterministic output.
2. Resource caches and isolated-surface reuse.
3. Batching and specialized native passes.
4. Optional GPU renderer behind a feature flag.
5. Optional hardware encoding after visual parity is stable.

Browser rendering through headless Chrome, WebGPU, WebGL, or WebCodecs may be
used for local investigation or a compatibility fallback. It is not the
production rendering core because browser startup, DOM/layout work, GPU
readbacks, version drift, and screenshot capture make performance and
determinism difficult to control.

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
- `POST /v1/media/prepare` (requires `x-internal-worker-token`)

Render request:

```json
{
  "project": "<RuntimeProjectV3>",
  "outputName": "local-test.mp4",
  "frameCount": 30
}
```

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
docker build -f packages/export-renderer/Dockerfile -t neonix-export-renderer .
docker run --rm -p 8787:8787 neonix-export-renderer
```

## Reference policy

ClipKit and other renderers may be used as architectural references for ideas
such as prepared runtimes, immutable scene descriptions, resource caching,
frame scheduling, and backend separation. Neonix must keep an independent
implementation and must not copy or port source code covered by a restrictive
license into this package.
