# Layer authoring patterns

> Status: source-of-truth
> Goal: assemble layers into a valid tree. Most AI failures are structure, not a single field.

## What this is

Recommended shapes for common videos. Copy the pattern, then fill ids and timing.

## When to use

When generating a new project from a prompt (intro, overlay, caption, soundtrack).

## Hard rules

- Roots are lanes. Nest only under `group.children` with matching `parentLayerId`.
- Audio never becomes a child.
- Every visual has `frame` + `transform` + `timing` + `zIndex`.
- Group `frame` does not clip. Mask to cut.

## Pattern: text-only

One root text layer. Smallest visual project.

```jsonc
{
  "id": "hero-title",
  "type": "text",
  "parentLayerId": null,
  "zIndex": 0,
  "frame": { "width": 800, "height": 120 },
  "timing": { "start": 0, "duration": 5 }
}
```

Invalid: text without `frame`, or `parentLayerId` pointing at a missing group.

## Pattern: image + badge overlay

Two roots (or a group): background image `zIndex: 0`, badge `zIndex: 1` (shape or component).

```jsonc
{
  "layers": [
    { "id": "bg-image", "type": "image", "parentLayerId": null, "zIndex": 0 },
    { "id": "badge-brand", "type": "shape", "parentLayerId": null, "zIndex": 1 }
  ]
}
```

Invalid: putting the badge `zIndex` on `transform.depth` only.

## Pattern: caption group

Group contains text children. Not `captionTracks`.

```jsonc
{
  "id": "caption-block",
  "type": "group",
  "parentLayerId": null,
  "zIndex": 2,
  "children": [
    { "id": "caption-line-1", "type": "text", "parentLayerId": "caption-block", "zIndex": 0 }
  ]
}
```

Invalid: `type: "caption"` or a timeline track named captions.

## Pattern: bg + title + CTA

Three visual roots, increasing `zIndex`: `bg-image`, `hero-title`, `cta-label`.

Invalid: wrapping audio inside the CTA group.

## Pattern: audio root

```jsonc
{
  "id": "audio-bgm",
  "type": "audio",
  "parentLayerId": null,
  "zIndex": -1,
  "timing": { "start": 0, "duration": 6 },
  "payload": { "assetId": "bgm", "volume": 80 }
}
```

Invalid: `zIndex >= 0`, `frame`, or `parentLayerId` of a group.

## Canonical shape (root visual)

```jsonc
{
  "id": "hero-title",
  "type": "text",
  "parentLayerId": null,
  "zIndex": 0,
  "transform": {
    "translate": { "x": 960, "y": 540 },
    "rotate": { "z": 0 },
    "scale": { "x": 1, "y": 1 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "frame": { "width": 800, "height": 120 },
  "appearance": { "visible": true, "opacity": 100 },
  "timing": { "start": 0, "duration": 5 },
  "payload": {
    "content": { "kind": "plain", "text": "Hello MotiClip" },
    "fontSize": 64,
    "color": "#000000",
    "alignment": "center",
    "wrap": "word",
    "overflow": "visible"
  }
}
```

## Valid example

See the text-only and audio-root snippets above plus `assets[]` when `assetId` is used.

## Invalid example

```jsonc
{
  "id": "music",
  "type": "audio",
  "parentLayerId": "caption-block",
  "zIndex": 3,
  "frame": { "width": 100, "height": 100 }
}
```

## Common mistakes

| Mistake | Why it is wrong | What to use instead |
| --- | --- | --- |
| Audio under group | Audio is root-only | Root lane, `zIndex < 0` |
| Caption track | No such type | Group + text |
| Derive group.frame from children | Frame is authored | Set `group.frame` explicitly |

## AI writing guide

- Prefer named ids from [Naming and ID conventions](/docs/ai/naming).
- Do not flatten everything into one group unless the prompt needs a unit.
- If you need overlay, raise `zIndex`, do not nest without a group.

## Related pages

- [Authoring rules](/docs/ai/rules)
- [What is a layer](/docs/layer)
- [Patching existing projects](/docs/ai/patching)
