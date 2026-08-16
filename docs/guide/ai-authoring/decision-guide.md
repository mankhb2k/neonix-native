# Decision guide

> Status: source-of-truth
> Goal: pick the right field family. If X, use Y — do not invent a new key.

## What this is

A lookup table from intent to canonical path. Read this before emitting animation or effects.

## When to use

Whenever the prompt is a visual intent (“fade”, “glow”, “closer”, “theme”, “one instance”).

## Hard rules

- One intent maps to one family. Do not stack invented aliases.
- Animate only animatable paths ([Canonical property paths](/docs/ai/property-paths)).
- Theme across many instances → variables + bindings. One instance → `payload.props`.

## Quick reference

| If you want… | Use |
| --- | --- |
| Fade / dim | `appearance.opacity` (0..100) |
| Hide without deleting | `appearance.visible` |
| Stack in front | `zIndex` (unique among siblings) |
| Near / far (parallax) | `transform.depth` |
| Move | `transform.translate.x` / `.y` |
| Grow / shrink / flip | `transform.scale` (negative = flip) |
| Spin | `transform.rotate.z` |
| Soft blur | `effects` blur |
| Glow | `effects` glow |
| Drop shadow | `effects` shadow |
| Formula box (rect / ellipse / polygon) | `type: "shape"` |
| Freeform vector | `type: "path"` + `payload.contours` |
| Bitmap | `type: "image"` + `payload.assetId` |
| Cut the source pixels | `payload.crop` (image only, 0..1) |
| Scale the layer box | `transform.scale`, not `frame.width` animation |
| Global theme | `variables` + `project.bindings` `type: "prop"` |
| One component instance | `payload.props` |
| Layer property motion | `timeline.clips` |
| Component prop motion | `payload.props.<propId>` keyframes |
| Caption | group + text, not a track |
| Music | root `type: "audio"` |

## Valid example

Intent: fade in the title.

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

Place this object in `timeline.clips`.

## Invalid example

```jsonc
{ "opacity": 0.5, "glow": true, "z": 12, "closer": true }
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| Glow via opacity | Opacity is fade, not bloom | `effects` glow |
| Depth as zIndex | Depth is parallax | `transform.depth` |
| Animate `frame.width` | Frame is not animatable | `transform.scale` |

## AI writing guide

- Prefer this table over synonyms from other tools.
- Do not emit After Effects / Figma field names.
- If you need both stack and parallax, emit **both** `zIndex` and `transform.depth`.

## Related pages

- [Canonical property paths](/docs/ai/property-paths)
- [Authoring rules](/docs/ai/rules)
- [Binding and variables rules](/docs/ai/bindings)
