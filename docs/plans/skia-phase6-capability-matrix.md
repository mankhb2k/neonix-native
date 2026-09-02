# Skia Phase 6 capability matrix

Phase 6 keeps Protocol V2 and Runtime unchanged. The renderer consumes the
existing `RuntimeFrameV3` layer boundary and semantic source-node contract.

| Capability | MVP status | Implementation |
| --- | --- | --- |
| Offscreen layer | supported | `beginLayer` -> CanvasKit `saveLayer`, `endLayer` -> `restore` |
| Blend mode | supported | All 16 CSS blend modes are mapped to CanvasKit `Paint.setBlendMode` |
| Isolation | supported | Isolated leaf/group is flattened in a Skia layer |
| Group opacity | supported | `compositeAlpha` is applied once at layer restore |
| clipPath user-space | supported | Runtime source path is transformed through `PathBuilder`, then `clipPath` |
| clipPath objectBoundingBox | partial | Runtime geometry is lowered; image resampling keeps a wider pixel threshold |
| Alpha mask | supported for Runtime path sources | Runtime source geometry is applied as a layer clip and its uniform alpha is applied to the layer |
| Luma mask | supported for Runtime path sources | Runtime source color is converted to luminance coverage and applied to the layer alpha |
| Single blur | supported | `ImageFilter.MakeBlur` is attached to `saveLayer` |
| Color-adjust | supported | Runtime values are lowered to a CanvasKit 4x5 color matrix |
| Ordered blur chain | supported | Ordered `MakeBlur` input filters preserve Runtime operator order |
| Drop shadow | supported | Runtime alpha/blur/tint/offset graph lowers to `MakeDropShadow` |
| Outer glow | supported | Runtime alpha/blur/tint graph lowers to zero-offset `MakeDropShadow` |
| Inner glow | supported where CanvasKit exposes blend/color-filter graph APIs | `SourceAlpha DstOut blurred alpha -> tint -> source-over` image-filter graph |
| Isolation/compositing | supported | Skia saveLayer carries group opacity and blend mode at the layer boundary |
| Noise | unsupported / diagnostic | CanvasKit 0.42 has no portable deterministic procedural-noise filter |
| 3D perspective | intentionally unsupported / diagnostic | Skia 2D backend does not consume 3D projection; Runtime keeps the `current_3d_unsupported` diagnostic |

## E2E fixtures

The lab dropdown sources all cases from `PREVIEW_LAB_CASES` and still executes:

```text
Protocol V2 -> compileProtocol() -> evaluateRuntimeProjectV3()
            -> RuntimeFrameV3 -> SkiaCommandReplay
```

`skia-phase6.spec.ts` covers all 16 blend modes, isolation, both clipPath unit
modes, alpha/luma masks, color-adjust, blur radii/chains, drop shadow, outer and
inner glow, plus the explicit diagnostics for noise and 3D perspective. The SVG
reference is generated from the same RuntimeFrameV3 and includes layer opacity,
blend/isolation, clipPath, mask, and effect filter definitions.

## Next implementation slice

The remaining backend slice is pixel-wise resource masks and deterministic noise.
These need intermediate surfaces or a generated shader/texture; they should not
be silently approximated. Protocol V2 and Runtime evaluation remain stable.
