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

## Backends

- `webgl2`: synchronous MVP backend for solid, rectangle/ellipse shape, image,
  and video commands.
- `webgpu`: async-capable backend using an injected `GPUDevice` and the same
  command stream.
- `auto` (default): tries WebGPU first and falls back to WebGL2 when the browser
  cannot provide a usable adapter, device, or context.

Text, paths, masks, and advanced effects intentionally report diagnostics until
their native pipelines are implemented. This keeps missing capability visible
while the backend grows.

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
