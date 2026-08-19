# Patching existing projects

> Status: source-of-truth
> Goal: change the smallest canonical path. Keep ids stable.

## What this is

Rules for MCP/update flows that edit a project already in the product — not greenfield emit.

## When to use

When the user says “make the title later”, “swap the image”, “fade the badge” on an existing file.

## Hard rules

- Do not change ids unless the user asked to rename. Bindings, clips, and masks key off ids.
- Do not move audio into `children`. Audio stays a project root.
- Do not add unknown fields. Patch only schema paths.
- Prefer updating a canonical path (`opacity`, `payload.props.label`) over rewriting the layer.
- Do not replace `layers[]` wholesale to tweak one field.
- Do not restack `zIndex` for every sibling unless a collision requires it.
- Keep `format` / `formatVersion` unchanged.
- Child timing stays local; after moving a layer into a group, re-base `timing.start`.

## Canonical shape

Problem: fade existing `hero-title`.

Recommended: append or edit a clip, do not rewrite the text payload.

```jsonc
{
  "id": "fade-hero-title",
  "layerId": "hero-title",
  "property": "opacity",
  "keys": [
    { "t": 0, "value": 100 },
    { "t": 0.3, "value": 0 }
  ]
}
```

Add to the owning layer's `animations` array.

## Valid example

Swap image source: change `assets` entry and keep `payload.assetId: "bg-image"` the same, **or** change `payload.assetId` to a new asset id you also insert. Do not leave a dangling ref.

## Invalid example

```jsonc
{
  "layers": [],
  "_comment": "cleared to insert a new title"
}
```

```jsonc
{
  "id": "audio-bgm",
  "parentLayerId": "caption-block"
}
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| New uuid for every edit | Breaks clips/bindings | Keep `hero-title` |
| Extra `locked: true` | Unknown key | Omit |
| Rebuild group to change one child | High blast radius | Patch that child’s path |

## AI writing guide

- Prefer JSON Merge / path updates: `layers[id=hero-title].payload.content.text`.
- Do not invent a `patch` format that is not the project schema unless the MCP tool defines it.
- If you need a new overlay, **append** a layer with a new kebab-case id; do not recycle `hero-title`.

## Related pages

- [Naming and ID conventions](/docs/ai/naming)
- [Canonical property paths](/docs/ai/property-paths)
- [Common error fixes](/docs/ai/error-fixes)
