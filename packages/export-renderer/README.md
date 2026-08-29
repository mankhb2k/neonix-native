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
