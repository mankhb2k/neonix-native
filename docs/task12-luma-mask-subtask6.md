# Task 12, Subtask 6: Luma Mask

## Certified Atomic Contract

`group.composite.mask` accepts `mode: "luma"` with the same direct-child and
`mask-only` relationship used by the other certified mask modes.

```json
{
  "mask": {
    "mode": "luma",
    "sourceLayerId": "luma-mask-ellipse",
    "sourceVisibility": "mask-only"
  }
}
```

The source must be a direct drawable child of the isolated group. Effects and
non-normal source blending remain rejected for this slice.

## Runtime Meaning

The source and group content are rendered into separate post-projection
surfaces. The final native pass decodes the source's premultiplied sRGB color
to linear color and derives coverage as:

```text
sourceLuma = dot(sourceLinearRgb / sourceAlpha, [0.2126, 0.7152, 0.0722])
coverage = sourceLuma * sourceAlpha
output = content * coverage * groupOpacity
```

WebGL2 and WebGPU use the same coefficients and the same premultiplied
surface semantics. Remotion consumes the same Runtime Paint command buffer.

## Verification

The `composite.mask.luma` fixture uses an opaque `#808080` ellipse over
`example1-1.jpg`. Its center is visible with lower coverage than the white
alpha-mask fixture, while an image pixel outside the ellipse remains the
composition background.

Verified with WebGL2/WebGPU E2E, 81-fixture Remotion PNG rendering, and the
final browser PNG parity test.

Deferred: inverse-luma, nested masks/isolation, source effects, and masked
group blend modes.
