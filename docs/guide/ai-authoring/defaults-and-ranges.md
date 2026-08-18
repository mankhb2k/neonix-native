# Defaults and ranges

> Status: source-of-truth
> Goal: emit values inside schema ranges. Prefer omitting a field when the default is correct.

## What this is

Numeric and enum bounds the parser enforces. Not every error code — the numbers AI must not invent.

## Hard rules

- `appearance.opacity` is integer **0..100**, default **100**. Never 0..1.
- `composition.fps` is **1..120**.
- `composition.width` / `height` must be **> 0**.
- `composition.colorSpace` MVP: only `"srgb"`.
- `composition.background` `#rrggbb`, default `#ffffff`.
- `composition.audioSampleRate` is `44100` or `48000` (default 48000).
- `transform.origin.x` / `.y` are **0..1**. Prefer `0`, `0.5`, or `1`.
- Polygon `payload.points` are **0..1** inside the frame (min 3 points).
- Clip `t` is local **0 .. layer.timing.duration**.
- Visual root `zIndex >= 0`. Audio root `zIndex < 0`.
- If `asset.source` exists, `source.kind` is only `"upload"`. External URLs live in `asset.uri`, not `source.kind`.

## Defaults table

| Field | Default if omitted |
| --- | --- |
| `appearance.visible` | `true` (still emit on visual layers when you author a full layer) |
| `appearance.opacity` | `100` |
| `composition.background` | `#ffffff` |
| `composition.colorSpace` | `srgb` |
| `payload.fit` image/video | `cover` |
| `payload.fit` svg | `contain` |
| video `loop` / `muted` | `false` |
| `capabilities` | `{}` |

## Ranges table

| Field | Range |
| --- | --- |
| opacity | 0..100 |
| fps | 1..120 |
| origin | 0..1 |
| polygon points | 0..1 per axis |
| crop (image) | 0..1 on source |
| depth | protocol z-position range (finite number) |

## Applies to

Visual layers: transform, appearance, frame. Audio: volume/muted on payload only. Composition: output canvas, not `frame`.

## Animatable / bindable

See [Canonical property paths](/docs/ai/property-paths). Setup-only: `frame`, `origin`, `visible`, `fit`, `assetId`, `zIndex`, `timing`.

## Valid example

```jsonc
{
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "background": "#ffffff",
    "colorSpace": "srgb",
    "audioSampleRate": 48000
  }
}
```

## Invalid example

```jsonc
{
  "appearance": { "opacity": 0.5 },
  "composition": { "fps": 240, "colorSpace": "display-p3" }
}
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| opacity 0.5 | Wrong unit | 50 |
| fps 0 | Below 1 | 24 / 30 / 60 |
| origin 50, 50 | Not 0..1 | 0.5, 0.5 |

## AI writing guide

- Prefer schema defaults instead of echoing every optional key.
- Do not invent `aspectRatio` on metadata; set width×height.
- If you need 9:16, emit 1080×1920.

## Related pages

- [Authoring rules](/docs/ai/rules)
- [Canonical property paths](/docs/ai/property-paths)
