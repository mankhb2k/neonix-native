# Task 11: Inner Glow

## Objective

Certify an inside-only glow for Atomic Protocol V2 without introducing a CSS
filter path or changing the projected Matrix4 source surface.

## Atomic Contract

```json
{
  "id": "cyan-inner-edge",
  "type": "inner-glow",
  "radius": 24,
  "color": "#00e5ff",
  "opacity": 0.85
}
```

`radius` is a positive Gaussian sigma in output pixels. `color` is
unpremultiplied sRGB and `opacity` is in `[0, 1]`. Offset, spread, choke, and
world-space lighting are intentionally outside this atom.

## Runtime Meaning

```text
source
  |-> alpha-mask -> blur ----------------------|
  |                                             |-> inner-alpha -> tint --|
  `---------------------------------------------|                         |-> composite(tint over source)
```

`inner-alpha` computes `max(sourceAlpha - blurredAlpha, 0)`. It produces
coverage only inside the captured final source silhouette. The source surface
is already projected and includes fill, stroke, rounded corners, and layer
opacity; no pass recalculates geometry, transforms, Z, or paint order.

## Certified Execution

- [x] Strict Protocol V2 schema and `effect.inner-glow` capability.
- [x] Runtime Effect Program with stable `inner-alpha` surface references.
- [x] Backend-neutral `EffectPassPlan` that recognizes only the exact graph.
- [x] WebGPU default and WebGL2 fallback use linear-premultiplied source and
  blurred alpha surfaces, then composite source first and tint second.
- [x] Preview E2E checks the unchanged gray center, cyan inner edge, and
  WebGPU/WebGL2 pixel parity within two 8-bit values per channel.
- [x] Remotion renders the same Runtime Effect Program through
  `MotiClipVideo` and checks the equivalent PNG samples.

## Result

`inner-glow` is an atomic effect, not a mask relationship. It reuses the
shared offscreen alpha infrastructure, but its semantic is a local inside-edge
operator: it never expands a layer's visible silhouette beyond its source.
