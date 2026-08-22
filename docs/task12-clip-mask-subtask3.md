# Task 12 Subtask 3: Clip Mask

## Certified Contract

The first mask atom is deliberately small:

```json
{
  "composite": {
    "mask": {
      "mode": "clip",
      "sourceLayerId": "clip-mask-ellipse",
      "sourceVisibility": "mask-only"
    }
  }
}
```

It belongs only to a `group`. Its source must be a direct child `shape`, cannot
have effects or a non-normal blend mode, and is never drawn as ordinary group
content.

## Execution

1. Compiler lowers the relation to `RuntimeNodeV2.mask` with `mode: "clip"`.
2. Runtime emits an isolated `beginLayer` with the source key and `mask-only`
   visibility.
3. Each native backend renders the group content and source coverage into
   separate full-composition offscreen surfaces after child Matrix4 projection.
4. The final pass composites premultiplied content multiplied by mask alpha and
   the group opacity. The source surface is not copied to the stage.

This keeps the preview and Remotion canvas path on the same native renderer.

## Verification

- Fixture: `composite.mask.clip`
- Source: an ellipse; content: `example1-1.jpg`
- E2E: WebGL2 and WebGPU both assert an inside pixel is visible and an image
  pixel outside the ellipse remains the composition background.

## Deferred

`alpha`, `inverse-alpha`, `luma`, `inverse-luma`, image/path sources, nested
masks, effects inside a masked group, and masked group blend modes remain
unsupported and fail closed.
