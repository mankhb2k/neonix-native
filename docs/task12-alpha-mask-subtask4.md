# Task 12 Subtask 4: Alpha Mask

## Contract

`alpha` extends the existing group mask relation:

```json
{
  "composite": {
    "blendMode": "normal",
    "mask": {
      "mode": "alpha",
      "sourceLayerId": "alpha-mask-ellipse",
      "sourceVisibility": "mask-only"
    }
  }
}
```

The source is a direct drawable child of the masked group. Unlike `clip`, its
rendered alpha is preserved: source opacity, fill opacity, image alpha, text
glyph coverage, and path coverage can determine the final mask. Source effects
and non-normal blending are intentionally rejected.

## Execution

The compiler emits one `RuntimeNodeV2.mask` relation. Runtime keeps the source
draw in the mask-only surface and emits the same isolated Paint scope used by
clip. WebGL2 and WebGPU render content and source alpha separately, then apply
`content * sourceAlpha * groupOpacity` in the final premultiplied composite.

## Verification

`composite.mask.alpha` uses `example1-1.jpg` as content and a 45% opaque
ellipse source. E2E proves the external image remains hidden and the center
pixel is closer to the composition background than the corresponding 100%
clip-mask pixel, with WebGL2/WebGPU parity.

## Deferred

Inverse alpha is certified separately in
`docs/task12-inverse-alpha-mask-subtask5.md`. Luma, nested masks, source
effects, and source non-normal blend modes remain unsupported.
