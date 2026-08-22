# Task 11: Outer Glow

## Objective

Certify the first alpha-derived halo effect in Atomic Protocol V2. Outer glow
is a projected screen-space effect: it follows the final Matrix4 silhouette of
one isolated layer, but is not a volumetric light or a world-space emitter.

## Atomic Contract

```json
{
  "id": "cyan-halo",
  "type": "outer-glow",
  "radius": 24,
  "color": "#00e5ff",
  "opacity": 0.7
}
```

`radius` is a positive Gaussian sigma in composition/output pixels. `color`
is unpremultiplied sRGB and its embedded alpha is multiplied by `opacity`.
There is no offset, spread, intensity, blend-mode, or GPU-quality field.

## Runtime Meaning

```text
source
  |-> alpha-mask -> blur -> tint --|
  |                                 |-> composite(source over glow) -> output
  `---------------------------------|
```

The captured source is immutable. Its complete projected alpha, including fill,
stroke, corner coverage, and layer opacity, creates the glow branch. The
unchanged source is composited over the colored halo.

## Certified Result

- [x] Strict Protocol V2 schema and capability registration.
- [x] Compiler lowers the atom into a layer-owned Runtime Effect Program.
- [x] Pass planner recognizes the exact four-operator branch.
- [x] WebGPU default and WebGL2 fallback execute the same offscreen plan.
- [x] Fixtures prove source preservation, stroke-source capture, and a
  perspective-projected silhouette.
- [x] `pnpm e2e:v2-remotion-parity` rendered all 66 shared preview fixtures
  and compared each Remotion PNG against the native WebGL2 preview buffer.

## Non-goals

`inner-glow` needs inverted/intersected alpha masks and is a separate task.
`spread` needs morphology or SDF semantics and remains deliberately absent.
Multi-scale neon recipes are high-level presets or a future versioned runtime
recipe, not a backend-specific interpretation of this atom.
