# Authoring rules

> Status: source-of-truth
> Goal: emit a full MotionProjectV1 that parses. Do not invent a scene graph.

## What this is

Global contract for writing MotiClip JSON. Schema is the law. Preview is not a validator.

## Hard rules

### Global

- Always emit a full project: `format: "motion-project"`, `formatVersion: 1`.
- Visual content lives in `project.layers`. Timeline is a clock, not tracks.
- Extra keys are rejected (`.strict()`).
- Do not emit `scenes`, `visualTracks`, `audioTracks`, `captionTracks`, `project.tracks`, or `project.propertyAnimations`.
- Do not invent fields outside the schema. Do not emit `modifiers` or `locked`.
- Use canonical property paths only.

### Layer-only

- Every layer needs unique `id`, `zIndex`, and `timing`.
- Root visual layers: `parentLayerId: null`, `zIndex >= 0`. Nested `zIndex` is always `>= 0`. Sibling `zIndex` is unique.
- Every visual layer has `frame` and `transform` (`translate`, `scale`, `rotate.z`, `skew`, `origin`, `depth`).
- Use `zIndex` for stacking, not depth. Use `depth` for near/far, not zIndex.
- Child `timing.start` is local to the parent. Keep the child inside the parent duration.
- `semantic` is optional tagging and does not change paint.

### Component

- Component internals are sealed.
- Instance = wrapper atoms + `payload.componentId` + `payload.props`.
- Bind only `target.type: "prop"` to a public `propId`.

### Audio

- Audio is root-only. `zIndex < 0`. No `frame`, no `transform`, no `appearance`.
- Captions are a group with text children, not a track type.

## Do / do not

| Do | Do not |
| --- | --- |
| `transform.translate.x` | `transform.x`, `transform.z` |
| `appearance.opacity` 0..100 | root `opacity`, 0..1 |
| `payload.assetId` after upload | `source.kind: "url"`, googleDrive |
| 1080×1920 on composition | `metadata.aspectRatio` |
| Negative `scale` to flip | `flipX` / `flipY` |

## Valid example

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
  "assets": []
}
```

Empty `layers` is valid. Other required root keys may use schema defaults (`capabilities`, `dependencies`, `tokens`, `variables`, `components`, `bindings`, `extensions`).

## Invalid example

```jsonc
{
  "format": "motion-project",
  "formatVersion": 1,
  "scenes": [],
  "visualTracks": [],
  "transform": { "z": 100 }
}
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| Partial clip / scene graph | Not a project | Full `MotionProjectV1` |
| `visualTracks` | Removed from V1 | `project.layers` + `timeline.clips` |
| `transform.z` | Not a field | `transform.depth` or `zIndex` |

## AI writing guide

- Prefer one complete JSON object per reply.
- Do not write JSON for a preview surface.
- If parse fails, fix the file. Do not debug preview.
- Checklist: [AI output checklist](/docs/ai/checklist)

## Related pages

- [Decision guide](/docs/ai/decision-guide)
- [Canonical property paths](/docs/ai/property-paths)
- [Valid and invalid patterns](/docs/ai/patterns)
