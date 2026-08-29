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
| Output artifact and ownership metadata | Web API / Storage |

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

Request body:

```json
{
  "project": "<RuntimeProjectV3>",
  "outputName": "local-test.mp4",
  "frameCount": 30
}
```

`outputName` is restricted to a relative `.mp4` path under
`tmp/export-renderer` by default. No R2, Supabase or export job record is
written by this worker yet.

## Docker

Build from the repository root so workspace packages are available:

```bash
docker build -f packages/export-renderer/Dockerfile -t neonix-export-renderer .
docker run --rm -p 8787:8787 neonix-export-renderer
```
