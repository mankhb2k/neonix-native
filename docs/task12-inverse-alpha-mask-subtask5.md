# Task 12, Subtask 5: Inverse Alpha Mask

## Certified Atomic Contract

`group.composite.mask` now accepts `mode: "inverse-alpha"` alongside `clip`
and `alpha`.

```json
{
  "mask": {
    "mode": "inverse-alpha",
    "sourceLayerId": "inverse-alpha-mask-ellipse",
    "sourceVisibility": "mask-only"
  }
}
```

The mask source is a direct drawable child of the isolated group. Its own
effects and non-normal blend modes remain rejected. The source never becomes
visible content.

## Runtime Meaning

Runtime lowers the group relation to the existing mask boundary and renders
the source alpha and sibling content into separate post-projection surfaces.
Both native backends then composite, in premultiplied linear working color:

```text
output = content * (1 - sourceAlpha) * groupOpacity
```

Only this final coverage calculation differs from `alpha`; there is no second
renderer path and no CSS fallback in Remotion export.

## Verification

The `composite.mask.inverse-alpha` fixture uses an opaque, mask-only ellipse
over `example1-1.jpg`. E2E asserts that the center is the composition
background and that an image pixel outside the ellipse remains visible in both
WebGL2 and WebGPU. The Remotion PNG parity gate asserts the same two pixels.

Deferred: luma modes, nested masks/isolation, source effects, and non-normal
source blending.
