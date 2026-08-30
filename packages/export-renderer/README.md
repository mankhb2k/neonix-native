# Native export renderer

Local-first export worker for `RuntimeProjectV3`.

This package is also the single owner of the render contracts. Import shared
schemas and types from `@motionvideo/export-renderer/contracts`.

Pipeline:

```text
RuntimeProjectV3
  -> evaluateRuntimeProjectV3
  -> PaintCommandBuffer
  -> SVG frame rasterization (sharp/libvips)
  -> raw RGBA stream
  -> FFmpeg H.264 MP4
```

The pipeline above is the current visual baseline. It proves deterministic
Runtime V3 frame output before the worker adds the workload-specific caches and
native GPU passes described below.

## End-to-end export architecture

Export Renderer is an offline consumer of the compiled runtime. It does not
parse authoring JSON, run Playback, or invent timeline semantics.

```text
MotionProtocolV2
      │
      ▼
Compiler + hydrated media catalog
      │
      ▼
RuntimeProjectV3
      │
      ├── evaluate(frame/time)
      │     └── PaintCommandBuffer
      │             └── Native Renderer → video frames
      │
      └── evaluate(audio sample window)
            └── AudioMixPlanV3
                    └── Offline Audio Backend → mixed audio
      │
      ▼
FFmpeg
  ├── video input: native-rendered frames
  ├── audio input: mixed audio samples
  └── mux / encode → MP4
```

## Workload-specific renderer target

V2 already separates transform, timing, hierarchy, effects, and asset identity.
The Compiler can lower that meaning into immutable static descriptors plus state
that must be evaluated for the requested frame. Runtime remains
backend-neutral; actual GPU/CPU handles belong only to this renderer.

```text
RuntimeProjectV3
        │
        ├── static semantic descriptors
        └── dynamic frame state
        │
        ▼
Render Scheduler
        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   Static cache     Dynamic pass      Media pass
        │               │               │
        └───────────────┼───────────────┘
                        ▼
                   Compositor
                        ▼
                 RGBA frame buffer
                        ▼
                     FFmpeg
```

The renderer must not do this per frame:

```text
parse JSON → rebuild scene → rebuild DOM → screenshot
```

Instead, it opens one export session, prepares reusable resources once, then
only evaluates and updates work that changes for each frame.

### Static descriptors and renderer resources

`RuntimeProjectV3` may describe data that is static for an export, but it must
not contain texture handles, GPU objects, decoder instances, or encoder state.

```text
Runtime static descriptor
  ├── geometry descriptor
  ├── glyph run descriptor
  ├── paint/style descriptor
  ├── blend/composite descriptor
  ├── media resource identity
  └── static fingerprint

Renderer cache entry
  ├── GPU/CPU texture
  ├── tessellated path geometry
  ├── glyph atlas location
  ├── decoded media frame
  └── cached isolated surface

Dynamic frame state
  ├── matrix
  ├── opacity
  ├── media time
  ├── visibility
  └── animated effect parameters
```

### Export frame loop

```text
open export session
prepare static resources and cache keys

for each composition frame:
    evaluate Runtime at frame/time
    update dynamic matrices, opacity, and effect values
    resolve required video frame and media resources
    replay static/dynamic/media passes
    composite to final RGBA frame buffer
    write frame to FFmpeg pipe

resolve and mix audio windows
FFmpeg encodes/muxes final MP4
```

## Future workload paths

Not every atom needs the same backend path. The target scheduler can specialize
the work while preserving one Runtime meaning:

| Atom | Target path |
| --- | --- |
| Shape | Reusable geometry → GPU/CPU draw pass |
| Path | Tessellation cache → GPU/CPU draw pass |
| Image | Decode/texture cache → draw pass |
| Text | Glyph shaping cache + glyph atlas → draw pass |
| Video | Decoder → current frame → texture/draw pass |
| Blur/effects | Filter or compute pass over the required surface |
| Audio | Offline Audio Backend → FFmpeg encode/mux |

The first implementation does not need GPU for every atom. The current
CPU/SVG rasterization path remains the certified correctness baseline. A new
native or GPU path is accepted only after parity tests prove the same output.

## Cache rules and optimization order

Cache entries must be invalidated by every value that can change output:

```text
static fingerprint
+ asset integrity
+ Runtime version
+ renderer version
+ export preset
```

Recommended order:

1. Static shape geometry and path tessellation cache.
2. Font, glyph, and image resource cache.
3. Static layer or isolated-subtree surface cache.
4. Batching and specialized native/GPU passes.
5. Video decode-to-texture reuse.
6. Optional hardware encoding such as NVENC after visual parity is stable.

Static surface caching is valid only when every visual input for that surface is
unchanged over the cached range. It is an execution optimization, never a new
timeline or compositing rule.

### Video and audio source separation

For a video layer with embedded audio:

```text
original MP4
  ├── video stream → native frame decoder / renderer
  └── audio stream → not used directly for final mix

audio derivative
  └── AudioMixPlanV3 → offline decode / gain / pan / fades / mix
```

The original MP4 is retained as the visual source. The export path disables
its embedded audio input so it cannot be mixed twice. The detached audio
derivative is the only source used for the linked audio clip. Its timing and
trim come from the compiled video/audio relationship; gain, pan, and fades are
applied from the audio plan.

### Ownership

| Concern | Owner |
| --- | --- |
| Authoring audio fields | Motion Protocol |
| Linked video/audio lowering | Motion Compiler |
| Frame and sample-time semantics | Motion Runtime |
| Pixel rendering | Native Renderer |
| Audio decode and mixing | Offline Audio Backend |
| Final encode and mux | FFmpeg |
| Output artifact and ownership metadata | Web API / R2 |

Export Renderer must fail closed when a required video stream, audio
derivative, or supported native operation is unavailable. It must never silently
use the original MP4's audio when the compiled plan requires a derivative.

### Current certification boundary

The first certified export slice validates visual rendering and currently
produces a video-only MP4 until the offline audio backend and audio mux path
have their own parity tests. The target architecture above is the contract for
the completed audio export path; documenting it does not claim that every part
is already wired in the local worker.

The first certified slice supports solid layers, rectangle/ellipse/polygon
shapes, paths, basic text, affine 2D transforms, opacity and normal/multiply/
screen/add compositing. Images, videos, masks, effects and isolated layers
fail closed until their parity tests exist.

## Local usage

From the repository root:

```bash
pnpm --filter @motionvideo/export-renderer render:smoke
```

Output is written to `tmp/export-renderer/native-export-smoke.mp4`.

## HTTP worker

```bash
pnpm --filter @motionvideo/export-renderer start
```

- `GET /health` (also `/healthz` and `/readyz`)
- `POST /v1/renders`
- `POST /v1/media/prepare` (requires `x-internal-worker-token`)

Request body:

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
`{assetId}/poster.webp` created by the browser and writes `{assetId}/audio.m4a`
when an audio stream exists. A missing browser poster is reported as a partial
or failed media preparation result; the worker does not generate posters.
It then calls the Web API callback provided in the request.
The worker never writes Supabase directly.

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
