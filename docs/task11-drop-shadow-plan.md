# Task 11: Drop Shadow

## Objective

Add the first branching spatial Effect Operator to Atomic Protocol V2 without
creating a CSS-only export path. The first certified surface is a single
rectangle, including a rectangle that has both fill and stroke.

## Atomic Contract

```json
{
  "id": "shadow",
  "type": "drop-shadow",
  "x": 18,
  "y": 20,
  "blur": 16.8,
  "color": "#000000",
  "opacity": 0.25
}
```

`x` and `y` are projected composition/output pixels. `blur` is Gaussian sigma
in those same pixels. `color` is unpremultiplied sRGB and `opacity` is in
`[0, 1]`. There is deliberately no `spread`, angle, distance, inner shadow, or
world-space lighting field in this ticket.

## Runtime Meaning

```text
source
  |-> alpha-mask -> blur -> tint -> offset --|
  |                                           |-> composite(source over shadow) -> output
  `-------------------------------------------|
```

The source is the already-projected, composited layer surface. Its fill,
stroke, rounded-corner coverage, and layer opacity are captured once. Shadow
does not reevaluate Matrix4, Z, z-index, or geometry in a second coordinate
space.

## Subtask 1: Freeze Semantics and Source Fixture

- [x] Fix the rectangle-only scope and projected-pixel units.
- [x] Define `x`, `y`, `blur`, `color`, and `opacity`; exclude `spread`.
- [x] Add a blur fixture with both rectangle fill and stroke to certify the
  captured source contains the complete composited atom.
- [x] Add WebGL2/WebGPU pixel parity coverage for that fixture.

Acceptance: the source contract is observable before `drop-shadow` is added to
the Atomic schema.

## Subtask 2: Protocol and Runtime Lowering

- [x] Add strict `drop-shadow` schema validation.
- [x] Add `effect.drop-shadow` only after the runtime/compiler path exists.
- [x] Lower one Atomic effect into `alpha-mask`, `blur`, `tint`, `offset`, and
  `composite` Runtime Effect Operators with stable surface references.
- [x] Test JSON order when a shadow is adjacent to blur or color adjustment.

Acceptance: Runtime validates the branching program and no output overwrites
`source`.

## Subtask 3: Backend-Neutral Shadow Pass Plan

- [x] Extend `EffectPassPlan` for the exact shadow graph without reordering.
- [x] Preserve the immutable source while allocating shadow intermediates.
- [x] Use the full composition effect surface, which conservatively retains
  `3 * blur + abs(x/y)` on every side until a future tight-bounds allocator.
- [x] Diagnose unsupported mixed/branched programs rather than approximate.

Acceptance: the plan has only Runtime IR and logical surface lifetimes, never
Atomic JSON or GPU objects.

## Subtask 4: WebGPU and WebGL2 Execution

- [x] Implement alpha extraction, linear premultiplied Gaussian blur, tint,
  pixel offset, then `source-over` composition.
- [x] Keep stroke/fill capture as one source surface.
- [x] Keep the source unmodified during the shadow branch.
- [x] Support WebGPU first and WebGL2 fallback with matching output.

Acceptance: a shadow never darkens the source interior or changes its
paint-order position.

## Subtask 5: Preview and Export Certification

- [x] Add fixtures for positive and negative offsets, zero blur, alpha color,
  and fill-plus-stroke source capture.
- [x] Compare WebGPU and WebGL2 with the established per-channel tolerance of
  two 8-bit values at the same semantic samples.
- [x] Render equivalent Remotion PNG fixtures through `MotiClipVideo` and
  compare the same output samples.
- [x] Mark Task 11 Shadow complete after protocol/runtime, both preview
  backends, and Remotion export pass.

Acceptance: preview and export consume the same Runtime Effect Program with no
CSS filter fallback.

## Certified Result

`drop-shadow` is now a V2 Atomic Effect with one source-capture semantic:
the complete projected layer alpha is copied once, then branched through
`alpha-mask -> blur -> tint -> offset`. The unchanged captured source is
composited source-over that branch. WebGPU is the preferred executor and
WebGL2 is the matching fallback; `MotiClipVideo` consumes that same Runtime
Effect Program through `preview-renderer`, not through CSS filters.
