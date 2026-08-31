# `@motionvideo/preview-renderer`

Native preview rendering boundary for MotionVideo.

The package consumes only `RuntimeFrameV3` / `PaintCommandBuffer`. It does not
import PixiJS, compile authoring JSON, or evaluate motion. The same V2 command
buffer can therefore be painted by this package for interactive preview and by
Native VPS export is provided by `@motionvideo/export-renderer`.

The render contract is Matrix4-only. Compiler B/runtime resolve local, world,
view, and projection matrices before this package is called; a backend only
uploads the provided matrices and paints commands. WebGPU is the default
selection and WebGL2 is the explicit fallback.

## Preview rendering flow

```text
RuntimeProjectV3
        │
        │ evaluate(frame/time)
        ▼
PaintCommandBuffer
        │
        ▼
┌─────────────────────────┐
│    PREVIEW RENDERER     │
│                         │
│  Select backend          │
│  Own canvas/context      │
│  Own GPU resources       │
│  Replay paint commands   │
│  Render media            │
│  Resize / device scale   │
│  Diagnostics / lifecycle │
└────────────┬────────────┘
             │
             ├── WebGPU API → GPU → Canvas
             └── WebGL2 API → GPU → Canvas
```

The package is a renderer, not a project evaluator. It receives the visual
state already resolved by Runtime and turns that state into actual pixels on a
browser canvas.

## Responsibilities

1. Accept a validated `PaintCommandBuffer` from Runtime.
2. Select WebGPU or WebGL2 according to browser capability and caller policy.
3. Create and own the canvas context, device, command encoder, buffers,
   textures, surfaces, and other backend resources.
4. Replay commands in the supplied order while preserving matrices, layer
   order, opacity, masks, effects, and compositing boundaries.
5. Upload and draw supported images, video frames, paths, text, and shapes.
6. Handle canvas resize, device-pixel ratio, viewport changes, and resource
   disposal.
7. Return explicit diagnostics for unavailable backends, unsupported commands,
   invalid resources, and lost device/context lifecycle events.
8. Produce the real canvas image consumed by the Editor or captured by
   `docs/preview` for parity comparison.

## Backend boundary

WebGPU and WebGL2 are implementation backends, not separate rendering
semantics:

```text
same PaintCommandBuffer
          │
          ├── WebGPU replay
          └── WebGL2 replay
```

The backend may choose different buffers, shaders, texture upload operations,
or synchronization mechanisms. It must not change timeline evaluation, layer
activation, media-time mapping, transform meaning, or audio behavior.

Preview Renderer does not parse `MotionProtocolV2`, invoke the Compiler,
evaluate `RuntimeProjectV3`, manage Playback clocks, decode audio, or encode
MP4. Audio is handled by the separate Playback Audio Backend from the
`AudioMixPlanV3` produced by Runtime.

## Entry paths

Interactive Editor preview uses Playback to supply a realtime frame/time:

```text
Editor controls → Playback → Runtime → PaintCommandBuffer → Preview Renderer
```

Deterministic preview tests bypass Playback:

```text
fixed frame/time → Runtime → PaintCommandBuffer → Preview Renderer → Canvas capture
```

Export does not use this package. Native Export consumes the same Runtime
meaning through its own renderer and FFmpeg pipeline.

## Backends

- `webgl2`: synchronous MVP backend for solid, rectangle/ellipse shape, image,
  video, gradient and stroke commands.
- `webgpu`: async-capable backend using an injected `GPUDevice` and the same
  command stream. Both native backends sample up to eight normalized gradient
  stops per draw, including linear, radial and conic gradients.
- `auto` (default): tries WebGPU first and falls back to WebGL2 when the browser
  cannot provide a usable adapter, device, or context.

Text, paths, masks, and advanced effects intentionally report diagnostics until
their native pipelines are implemented. This keeps missing capability visible
while the backend grows.

## Preview media and audio boundary

Preview receives visual semantics from Runtime and audio semantics from the
separate playback audio backend. It does not play the audio track embedded in
the original video element as an additional source.

```text
RuntimeProjectV3
  ├── PaintCommandBuffer
  │     └── Preview Renderer → video frames on canvas
  └── AudioMixPlanV3
        └── Playback Audio Backend → audio derivative
```

For a video layer with `payload.audio`, the visual video resource is rendered
with its embedded audio muted. The linked audio derivative is scheduled from
the same compiled timing and trim and receives gain, pan, and fade controls
from `AudioMixPlanV3`.

`docs/preview` calls Runtime and this renderer with a fixed frame/time for
visual parity tests. It does not use the Editor Playback clock. Audio
playback controls belong to the Editor Playback path and never affect Native
Export.

```ts
const renderer = await createPreviewRenderer({
  canvas,
  backend: "auto",
  width: 1920,
  height: 1080,
  assets,
});

renderer.paintFrame(runtimeFrameV3);
renderer.resize(width, height, devicePixelRatio);
renderer.dispose();
```
