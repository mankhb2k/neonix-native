# Task 11: Deterministic Noise

## Contract

`noise` is an atomic effect operator over the already-rasterized layer
surface. It is not a mask and it does not change the layer footprint, Matrix4,
alpha coverage, or Z ordering.

```json
{
  "id": "grain",
  "type": "noise",
  "scale": 4,
  "amount": 0.45,
  "opacity": 0.85,
  "seed": 1337
}
```

- `scale` is the grain cell size in projected output pixels.
- `amount` is centered luminance variation in the range `0..1`.
- `opacity` controls the effect contribution in the range `0..1`.
- `seed` is explicit so browser preview and Remotion export produce the same
  field. Noise is not time-random and has no hidden scene or frame seed.

## Runtime Flow

```text
Atomic V2 noise
  -> Runtime Effect Program: noise(source -> effect:<id>)
  -> isolated offscreen surface
  -> shared deterministic hash in WebGPU/WebGL2
  -> premultiplied source-over composite
```

WebGL2 converts its bottom-left fullscreen UV to the Protocol top-left
coordinate convention before hashing. This keeps the same seed and sample
coordinates identical across both native backends and Remotion.

Noise is currently limited to one operator before and one after spatial
operators in the physical pass planner. Unsupported combinations remain
diagnosed instead of being silently reordered.

## Relationship To Masks And Inner Glow

Noise can later modulate color or alpha from a mask surface, but the base atom
does not require a mask. Inner glow is the next separate operator and will
reuse the certified alpha-mask, blur, tint, and offscreen isolation primitives:

```text
source alpha -> inner coverage -> blur -> tint -> source-over composite
```

The two effects therefore share the renderer infrastructure without being
collapsed into one semantic atom.
