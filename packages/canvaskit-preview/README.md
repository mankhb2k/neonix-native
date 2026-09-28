# @motionvideo/canvaskit-preview

CanvasKit WASM preview renderer for Motion Protocol V2 runtime frames. This is
the browser-side UI preview backend only - it has no relationship to MP4
export, which always renders through the native Skia CPU worker on Cloud Run
(see `@motionvideo/render-native`). Never treat this package as a fallback
or reference implementation for export.

The package consumes only `RuntimeFrameV3` / `PaintCommandBuffer`. It does not
compile protocol data or evaluate timelines. The host application owns the
CanvasKit WASM files and provides decoded image/video assets through
`SkiaRendererOptions.assets`.

```ts
import { createSkiaRenderer } from "@motionvideo/canvaskit-preview";

const renderer = await createSkiaRenderer({
  canvas,
  width: 1920,
  height: 1080,
  // Runtime fontAssetId -> verified font bytes owned by the host.
  fonts: fontBytes,
});

renderer.paintFrame(runtimeFrame);
```

CanvasKit is loaded from `/vendor/canvaskit/` by default. This keeps browser
asset hosting separate from the renderer package and leaves the renderer
usable by a future headless/export host.

The replay currently covers Runtime V3 solid paints, linear/radial/sweep
gradients, focal radial gradients, stop opacity, spread modes, gradient units,
affine gradient transforms, absolute per-drawable transforms, rounded paths,
Runtime glyph outlines, native `Typeface/Font.drawGlyphs` replay for eligible
non-color glyphs, color emoji layers/encoded glyph resources, text stroke and
text decorations. Runtime remains the sole text shaper: the host must pass a
prepared `RuntimeFrameV3` whose glyph IDs and positions were resolved by
Runtime. Outline replay remains the deterministic fallback for variation fonts,
per-glyph rotation/scaling, unavailable font bytes, and color glyphs.

For live browser preview, pass `directPresentation: true` when CanvasKit's
canvas-bound surface is available. This submits flushed Skia commands directly
to the HTML/Offscreen canvas and avoids a full-frame `readPixels` →
`putImageData` copy on every frame. If the browser cannot create that surface,
the renderer automatically falls back to the deterministic unpremultiplied
RGBA readback path. Export and pixel-test callers keep the readback path by
leaving the option disabled. CanvasKit WASM remains an application-owned
runtime dependency; the renderer package only consumes its small host adapter.
