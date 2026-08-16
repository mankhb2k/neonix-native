# Valid and invalid patterns

> Status: source-of-truth
> Goal: memorize legal project shapes and the illegal ones models invent.

## What this is

Side-by-side patterns. Left is copyable. Right is reject.

## When to use

Before returning JSON, or when a parse error looks like “unknown key”.

## Hard rules

- Minimal project may have empty `layers`.
- Root visual needs `frame`, `transform`, `timing`, `zIndex >= 0`.
- Audio is a root leaf with `zIndex < 0` and `payload.assetId` in `assets[]`.
- Component instance does not include internals.

## Minimal valid project

```jsonc
{
  "format": "motion-project",
  "formatVersion": 1,
  "metadata": { "id": "docs-minimal-empty", "name": "Minimal empty", "locale": "vi-VN" },
  "composition": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "background": "#ffffff",
    "colorSpace": "srgb"
  },
  "timeline": { "duration": 6 },
  "layers": [],
  "assets": [],
  "capabilities": {},
  "dependencies": { "compiler": { "range": ">=1.0.0" }, "components": [] },
  "tokens": {},
  "variables": [],
  "components": [],
  "bindings": [],
  "extensions": {}
}
```

## Valid root visual layer

See [Layer authoring patterns](/docs/ai/layer-patterns) canonical text layer (`hero-title`).

## Valid audio root layer

```jsonc
{
  "id": "audio-bgm",
  "type": "audio",
  "parentLayerId": null,
  "zIndex": -1,
  "timing": { "start": 0, "duration": 6 },
  "payload": { "assetId": "bgm", "volume": 80, "fadeIn": 0.5, "fadeOut": 0.5 }
}
```

`assets[]` must contain `{ "id": "bgm", "assetType": "audio", "uri": "..." }` for fixtures.

## Valid component instance

See [Component authoring rules](/docs/ai/component-rules) canonical shape.

## Invalid scene/track shape

```jsonc
{
  "scenes": [{ "id": "s1", "visualTracks": [] }],
  "captionTracks": []
}
```

## Invalid property path

```jsonc
{ "transform": { "z": 100, "x": 10, "y": 20 } }
```

## Invalid component access

```jsonc
{
  "type": "component",
  "payload": {
    "componentId": "BrandBadge",
    "layers": [{ "id": "inner", "type": "text" }]
  }
}
```

## Canonical shape

The minimal valid project above.

## Valid example

Minimal empty project.

## Invalid example

```jsonc
{
  "format": "motion-project",
  "formatVersion": 1,
  "scenes": [],
  "layers": [
    {
      "id": "photo",
      "type": "image",
      "parentLayerId": null,
      "zIndex": 0,
      "payload": { "assetId": "does-not-exist" }
    }
  ]
}
```

Missing `assetId` in `assets[]` fails reference validation.

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| Extra `scenes` | Strict object | Envelope keys only |
| Missing asset | Reference error | Upload, then id |
| `formatVersion: 2` | Only 1 | `1` |

## AI writing guide

- Prefer the minimal project and add layers.
- Do not start from a scene-graph or track dump.
- If you need an image, emit `assets[]` and `payload.assetId` together.

## Related pages

- [Common error fixes](/docs/ai/error-fixes)
- [Authoring rules](/docs/ai/rules)
- [Validation basics](/docs/validation)
