# ADR 004: Evaluation Order and Compositing Boundary

## Status
Accepted (Normative for Motion Format v2)

## Context
Motion graphics rendering requires a deterministic evaluation order and strict compositing isolation boundaries to ensure consistent rendering across preview and export engines.

## Decisions

### 1. Normative 14-Stage Evaluation Order
Every frame MUST be evaluated in the following exact sequence:
1. **Node Defaults**: Evaluate baseline node literal values and default properties.
2. **Variable Bindings**: Resolve component/project variable bindings.
3. **Clip & Track Evaluation**: Map local time and evaluate property tracks and keyframes.
4. **Procedural Drivers**: Apply driver graph modifications (noise, oscillator, link-property).
5. **Constraints & Secondary Motion**: Solve spatial constraints (`look-at`, `copy-position`, `copy-rotation`) and secondary motion spring chains.
6. **2.5D Projection**: Apply 2.5D camera and depth parallax projection.
7. **Geometry Modifiers**: Apply path modifiers (`path-morph`, `path-bend`, `trim-path`).
8. **Local Rasterization**: Composite local subtree content into intermediate surface buffers.
9. **Matte Masking**: Apply clipping, alpha, inverse-alpha, luma, or inverse-luma matte masking.
10. **Node Effects**: Apply ordered node effect stacks (`blur`, `shadow`, `glow`, `color-adjust`).
11. **Adjustment Passes**: Apply `AdjustmentNode` effect stacks to composited siblings below in the current isolation group.
12. **Layer Blend Modes**: Blend local layer output into parent group surface using declared blend mode.
13. **Scene Transitions**: Composite scene transitions (`cut`, `fade`, `crossfade`).
14. **Final Target Render**: Output composite frame to screen or video encoder.

### 2. Group Compositing Isolation (`pass-through` vs `isolate`)
- `pass-through`: Group acts as a logical container without an intermediate offscreen buffer.
- `isolate`: Group renders subtree into an isolated offscreen buffer before applying group-level masks, effects, and blend modes.

### 3. Adjustment Layer Semantics (`type: "adjustment"`)
- An Adjustment Node does not draw original graphic content.
- It captures the composited framebuffer of all sibling layers below it within the current isolated group and applies its ordered effect stack to that buffer.
- Adjustment effects DO NOT bleed outside their isolation group boundary.

### 4. Extended Matte Modes
- Mask modes expanded to: `"clip" | "alpha" | "inverse-alpha" | "luma" | "inverse-luma"`.
- `luma`: Uses luminance of source node as alpha aperture.
- `inverse-luma`: Uses inverted luminance of source node.
