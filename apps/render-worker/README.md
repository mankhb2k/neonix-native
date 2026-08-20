# `@motionvideo/render-worker`

Protocol V2 JSON -> Runtime IR V2 -> PNG frames -> MP4.

```text
MotionProtocolV2Schema
  -> compileProtocolV2
  -> RuntimeProjectV2
  -> evaluateRuntimeProjectV2
  -> CPU raster / ffmpeg encode
```

## E2E smoke test

```bash
pnpm --filter @motionvideo/render-worker e2e
```

The smoke fixture contains certified rectangle and ellipse atoms and verifies
that the V2 runtime can produce a real MP4. The rasterizer is a reference CPU
backend; Remotion and the browser preview consume the same V2 paint contract.

## Benchmark

```bash
pnpm --filter @motionvideo/render-worker benchmark
```
