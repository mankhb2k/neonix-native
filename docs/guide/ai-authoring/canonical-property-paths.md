# Canonical property paths

> Status: source-of-truth
> Goal: emit dotted paths exactly as they exist on the layer. Use them in `layer.animations[].property`.

## What this is

The allowlist of strings for clips and for “where the value lives”. Legacy aliases fail parse or compile.

## When to use

Before writing any keyframe clip or describing a field in a patch.

## Hard rules

- Path is dotted from the layer root: `appearance.opacity`, not `opacity`.
- `t` on keys is local to the target layer (`0` .. `timing.duration`).
- Keys use `value`, not `v` (compiled IR uses `v` — do not paste IR).
- Do not animate frame, timing, zIndex, origin, fit, trim, or assetId.
- Scale with `transform.scale`, not `frame.width`.

## Path table — safe to animate

| Path | Kind |
| --- | --- |
| `appearance.opacity` | number 0..100 |
| `transform.translate.x` / `.y` | number |
| `transform.scale.x` / `.y` | number (negative = flip) |
| `transform.rotate.z` | angle |
| `transform.skew.x` / `.y` | angle |
| `transform.depth` | number |
| `style.fill` / `style.stroke` | color (shape, path) |
| `style.strokeWidth` | number |
| `payload.fontSize` | number (text) |
| `payload.color` | color (text, solid) |
| `effects.<id>.*` | per effect field |

## Transform paths

Use nested objects in authoring JSON:

```jsonc
{
  "translate": { "x": 0, "y": 0 },
  "rotate": { "z": 0 },
  "scale": { "x": 1, "y": 1 },
  "skew": { "x": 0, "y": 0 },
  "origin": { "x": 0.5, "y": 0.5 },
  "depth": 0
}
```

Clip property: `transform.translate.x` — never `transform.x`.

`transform.origin.*` is setup only (not a clip target).

## Appearance paths

| Path | Animatable |
| --- | --- |
| `appearance.opacity` | yes |
| `appearance.visible` | no (set once) |

## Compositing paths

`compositing.blend-mode`, `compositing.isolation`, `compositing.mask.sourceLayerId` — not clip targets.

## Effects paths

Animate `effects.<effectId>.<field>`. Glow and inner-glow have no `intensity` alias. Noise has no `seed` field. Noise is a pixel overlay on that layer's alpha, not a default full-screen grain. Full-screen grain: put noise on a full-frame solid or shape. No effects on audio or camera.

## Invalid legacy paths

| Invalid | Use |
| --- | --- |
| `transform.z` | `transform.depth` or `zIndex` |
| `transform.x` / `transform.y` | `transform.translate.x` / `.y` |
| `opacity` | `appearance.opacity` |
| `flipX` / `flipY` | negative `transform.scale` |
| `project.tracks` / `propertyAnimations` | `layer.animations` |

## Canonical shape

```jsonc
{
  "id": "fade-hero-title",
  "layerId": "hero-title",
  "property": "appearance.opacity",
  "keys": [
    { "t": 0, "value": 0 },
    { "t": 0.4, "value": 100 }
  ]
}
```

## Valid example

See canonical shape. Component props: `payload.props.<propId>` keyframes with `keys[].value`.

## Invalid example

```jsonc
{
  "layerId": "hero-title",
  "property": "transform.x",
  "keys": [{ "t": 0, "v": 10 }]
}
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| `keys[].v` in authoring | Compiler output | `keys[].value` |
| Clip `payload.assetId` | Not animatable | Swap asset as a patch, or a new layer |
| Clip `frame.width` | Not animatable | `transform.scale.x` |

## AI writing guide

- Prefer the tables on this page over other products’ names.
- Do not emit `project.propertyAnimations`.
- If you need a prop animation, put it on `payload.props`, not `layer.animations` into internals.

## Related pages

- [Decision guide](/docs/ai/decision-guide)
- [Defaults and ranges](/docs/ai/defaults)
- [Common error fixes](/docs/ai/error-fixes)
