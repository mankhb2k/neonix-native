# `@motionvideo/render-worker`

Compile Motion Format (`.mt`) → frames → MP4.

```text
parseMotionProject
  → validateMotionProjectPresets (template-library)
  → compileMotionProject
  → renderCompiledProject   # reference: @napi-rs/canvas
  → encodeOutputs           # ffmpeg-static
```

## E2E smoke test

```bash
pnpm e2e:render
# or
pnpm --filter @motionvideo/render-worker e2e
```

Writes `tmp/<id>.mt` + `tmp/<id>.mp4`.

If `ffmpeg-static` binary is missing (pnpm ignored install scripts):

```bash
node apps/render-worker/node_modules/ffmpeg-static/install.js
```

## Renderer

`runtime/` rasterizes frames in parallel across `worker_threads` (one thread per CPU core, capped at 8) since frames are independent (per-scene local time). See `runtime/frame-plan.ts` (job split) + `runtime/frame-worker.ts` (worker entry) + `runtime/draw.ts` (actual drawing, shared by main thread type-checking and workers).

```bash
pnpm --filter @motionvideo/render-worker benchmark   # full-res 1080x1920@30fps timing
```

## Note

The canvas renderer is a **reference** implementation to prove the IR works. Swap for Motion Canvas / Remotion / a native engine later without changing `.mt` schema — `compileMotionProject` output stays the same either way.
