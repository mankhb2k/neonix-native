# Task 3.5: 3D-Capable Mat4 Runtime, Rectangle Only

## Status

Accepted. Task 4 (Ellipse) is now the active atom.

Do not start ellipse, path, image, video, text, effects, masks, high-level
authoring, or editor-facing 3D controls until every completion gate in this
document is green.

## Goal

Make Atomic Protocol V2 spatially 3D-capable now, while the product MVP still
renders only rectangle fixtures. Atomic JSON keeps semantic transform fields;
Compiler B and the frame evaluator lower those fields into backend-neutral
4x4 matrices. WebGPU and WebGL2 must consume the same model/world matrix
contract.

```text
Atomic Protocol V2 JSON
  translate / rotate / scale / anchor / skew
                    |
                    | Compiler B + frame evaluation
                    v
Runtime RenderFrame
  model/world/view/projection mat4
                    |
          +---------+---------+
          v                   v
       WebGPU              WebGL2
```

The task is complete only when the existing 2D rectangle output remains
pixel-identical and a perspective rectangle fixture renders consistently in
both backends.

## Scope

This task includes only:

- Atomic V2 transform and view/projection contracts.
- Deterministic mat4 math and packing.
- Rectangle Compiler B lowering.
- Rectangle Runtime RenderFrame lowering.
- Rectangle rendering in WebGPU and WebGL2.
- Rectangle preview fixtures and E2E parity tests.
- Documentation of coordinate, matrix, and projection conventions.

## Non-Goals

- Ellipse or any Task 4 implementation.
- Path, text, image, video, effects, masks, or blend-mode expansion.
- Group hierarchy UI or parent editing. Root rectangle `localMatrix` and
  `worldMatrix` are identical during this task.
- High-level camera moves, camera rigs, parallax presets, or 3D transitions.
- Editor-facing X/Y/Z controls.
- Remotion/export migration.
- Arbitrary transform order.
- Raw matrices in Atomic Protocol JSON.
- GPU buffers, textures, pipelines, bind groups, or native command handles in
  Runtime IR.
- Depth testing or using geometric Z as a replacement for `zIndex`.

## Locked Architecture Decisions

### Atomic JSON Is Semantic, Not Matrix Data

Atomic Protocol V2 must not contain `matrix`, `matrix4`, `modelMatrix`,
`worldMatrix`, or `mvp` fields.

```ts
type AtomicTransformV2 = {
  translate: { x: number; y: number; z: number };
  rotate: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  anchor: { x: number; y: number; z: number };
  skew: { x: number; y: number };
};
```

`anchor` is the only pivot field. Atomic V2 must reject the legacy `origin`
field; no alias, fallback, or dual-read migration path is allowed. Anchor uses
local layer units on all three axes and may be inside or outside rectangle
bounds. A planar rectangle has local geometry at Z zero, but a non-zero
`anchor.z` remains meaningful when rotate X/Y and perspective are active.

All transform fields remain explicit in strict V2 JSON. Existing rectangle
fixtures must be migrated from normalized origin to an equivalent local anchor
without changing their rendered pixels:

```text
anchor.x = oldOrigin.x * frame.width
anchor.y = oldOrigin.y * frame.height
anchor.z = 0
```

Normalized anchor is an optional high-level authoring convenience only.
Compiler A may resolve it against the final frame later; it is not part of
Atomic Protocol V2.

### Units and Defaults

```text
translate.x/y/z = composition/world units; one unit equals one composition pixel
rotate.x/y/z    = degrees
scale.x/y/z     = ratio; 1 means 100 percent
anchor.x/y/z    = local layer units; finite and not clamped to layer bounds
skew.x/y        = degrees in the local XY plane
```

Identity values:

```json
{
  "translate": { "x": 0, "y": 0, "z": 0 },
  "rotate": { "x": 0, "y": 0, "z": 0 },
  "scale": { "x": 1, "y": 1, "z": 1 },
  "anchor": { "x": 0, "y": 0, "z": 0 },
  "skew": { "x": 0, "y": 0 }
}
```

### Atomic Coordinate System

- Composition origin is top-left.
- Positive X moves right.
- Positive Y moves down.
- Positive Z moves toward the viewer.
- Atomic authoring space is screen-oriented and left-handed.
- Positive rotation follows the left-handed rule.
- Positive `rotate.z` appears clockwise on screen.
- Angles are degrees in Atomic JSON and are converted by the shared math core.
- GPU NDC and backend depth conventions never leak into Atomic Protocol.

The implementation must include point-transform goldens that make X, Y, Z,
and rotation signs unambiguous. Comments alone are not sufficient.

### Fixed Transform Order

For column vectors, local model composition is fixed as:

```text
Model =
  Translate(position)
  * Translate(anchor.x, anchor.y, anchor.z)
  * RotateZ
  * RotateY
  * RotateX
  * SkewXY
  * Scale
  * Translate(-anchor.x, -anchor.y, -anchor.z)
```

No `transformOrder` property is allowed in V2.

### Z and Paint Order Are Separate

- `translate.z` is geometric position.
- `zIndex` is deterministic compositing order.
- Rectangle MVP keeps depth testing disabled.
- Existing `zIndex` ordering must remain pixel-identical.
- Transparent sorting and 3D depth testing require a later certified task.

### Projection Is Frame-Level State

Perspective is not a per-layer transform field. Atomic V2 adds a minimal
composition-level view contract:

```ts
type AtomicViewV2 = {
  projection:
    | { kind: "orthographic" }
    | {
        kind: "perspective";
        fov: number;
        near: number;
        far: number;
      };
  transform: {
    translate: { x: number; y: number; z: number };
    rotate: { x: number; y: number; z: number };
  };
};
```

Current 2D fixtures use an explicit or normalized orthographic default.
Perspective is exercised only by internal rectangle certification fixtures;
no high-level camera feature ships in this task.

### Runtime and GPU Precision

- CPU composition uses JavaScript number/Float64 precision and the existing
  deterministic math/rounding rules.
- Runtime render matrices are packed once as column-major
  `Float32Array(16)` values.
- A runtime validator rejects matrices that are not exactly 16 finite values.
- Golden tests serialize matrices with `Array.from(matrix)`.
- Render backends must not reconstruct translate/rotate/scale/anchor fields.

## Runtime Contracts

The exact names may follow existing package conventions, but ownership must
match this shape:

```ts
type RuntimeFrameTransform = {
  viewMatrix: Float32Array;
  projectionMatrix: Float32Array;
  viewProjectionMatrix: Float32Array;
};

type RuntimeRectangleItem = {
  localMatrix: Float32Array;
  worldMatrix: Float32Array;
  opacity: number;
  visible: boolean;
  zIndex: number;
  width: number;
  height: number;
  fill: string;
};

type RuntimeRenderFrame = {
  width: number;
  height: number;
  background: string;
  transform: RuntimeFrameTransform;
  items: RuntimeRectangleItem[];
};
```

Runtime IR contains renderer-neutral data only. GPU resource ownership remains
inside `preview-renderer` backends.

## Projection Convention

Runtime owns one documented canonical projection convention. Backend adapters
may adjust only clip-space depth:

```text
WebGPU depth clip: 0 to 1
WebGL2 depth clip: -1 to 1
```

X/Y coverage for the same rectangle must be identical. A WebGL depth-remap
matrix may be composed with the canonical projection, but model/world matrices
must remain unchanged between backends.

## Implementation Tasks

### 3.5.0 Baseline Lock

- [x] Record current rectangle command goldens for every Task 2/3 fixture.
- [x] Record WebGL2 pixels for fill, translate, scale, anchor, rotate Z, skew,
      timing, opacity, and z-index.
- [ ] Record WebGPU regression screenshots/pixels on a supported browser.
- [x] Confirm the preview backend toggle can force WebGPU and WebGL2.
- [x] Add a test that proves existing V2 JSON rejects raw matrix fields.

Done when the migration has a stable before-state and no production code has
changed yet.

### 3.5.1 Atomic V2 Spatial Schema

- [x] Change `translate` from Vec2 to Vec3.
- [x] Change `rotate` from Z-only to required X/Y/Z.
- [x] Change `scale` from Vec2 to Vec3.
- [x] Replace normalized `origin` with required local-unit `anchor` Vec3.
- [x] Reject `origin` in strict Atomic V2 after fixture migration.
- [x] Migrate existing rectangle origin fixtures to pixel-equivalent anchors.
- [x] Keep `skew` as local XY-plane Vec2.
- [x] Add the minimal composition-level `view.projection` contract.
- [x] Reject unknown matrix, quaternion, transform-order, space, camera-rig,
      parallax, and depth-test fields.
- [x] Add strict valid/invalid schema tests and finite-number tests.
- [x] Update all rectangle fixtures to explicit Z identity values.

Done when Atomic V2 is semantically 3D-capable but still contains no matrix.

### 3.5.2 Neutral Mat4 Core

- [x] Extract or create a V2-safe mat4 core independent of V1 camera/bone code.
- [x] Implement identity, multiply, translation, scale, rotate X/Y/Z, local XY
      skew, point transform, and finite validation.
- [x] Implement local anchor X/Y/Z pivot composition.
- [x] Test center, outside-bounds, negative, and non-zero-Z anchors.
- [x] Implement the fixed model composition order.
- [x] Implement deterministic Float32 packing at the Runtime IR boundary.
- [x] Add exact identity/translation tests and tolerance-based rotation tests.
- [x] Add multiplication-order and transformed-point golden tests.
- [ ] Test negative values, `.5` values, large composition coordinates, and
      non-uniform scale.

Done when one shared function produces the rectangle model matrix and neither
GPU backend contains authoring transform math.

### 3.5.3 View and Projection Core

- [x] Implement the 1920x1080 orthographic projection without changing current
      rectangle pixels.
- [x] Implement minimal perspective projection for certification fixtures.
- [x] Build view, projection, and view-projection matrices outside renderers.
- [x] Define and test near/far/FOV validation.
- [x] Add canonical-depth and WebGL depth-remap tests.
- [x] Prove that backend depth adaptation does not alter model/world matrices.

Done when both backends receive the same world matrix and a documented
view-projection input.

### 3.5.4 Compiler B Rectangle Lowering

- [x] Lower rectangle semantic transform into local mat4.
- [x] Set root rectangle world mat4 equal to local mat4.
- [x] Preserve timing, opacity, visibility, and z-index behavior.
- [x] Emit renderer-neutral Runtime RenderFrame data.
- [x] Keep command/golden serialization deterministic.
- [x] Add compiler tests for translate Z, rotate X/Y/Z, scale Z, anchor, skew,
      orthographic view, and perspective view.
- [x] Verify that animation targets remain semantic transform property paths.

Done when Compiler B/runtime, not either backend, owns all rectangle matrix
composition.

### 3.5.5 WebGL2 Mat4 Path

- [x] Replace the V2 rectangle `uniform mat3` path with `uniform mat4`.
- [x] Bind frame view-projection state separately from per-item model state.
- [x] Apply only the WebGL clip-depth adapter in the WebGL2 backend.
- [x] Keep geometry local as a unit rectangle/quad.
- [x] Remove V2-specific affine reconstruction from WebGL2.
- [x] Preserve alpha blending and current rectangle edge coverage.

Done when WebGL2 renders every Task 2/3 rectangle fixture through mat4 only.

### 3.5.6 WebGPU Mat4 Path

- [x] Consume the same Runtime RenderFrame model/world matrices as WebGL2.
- [x] Bind frame view-projection state separately from per-item model state.
- [x] Remove the current mat3-to-mat4 promotion adapter.
- [x] Keep WGSL uniform offsets and 16-byte alignment explicit and tested.
- [x] Preserve transient resource lifetime and existing alpha blending fixes.
- [x] Add a regression test for translation in the fourth mat4 column.

Done when WebGPU performs no semantic transform reconstruction or mat3
promotion.

### 3.5.7 Rectangle Preview Fixtures

Add only rectangle cases:

- [x] Existing rectangle identity, translate, center-anchor scale, center-anchor
      rotate Z, skew, opacity, timing, and z-index cases use the mat4 path.
- [x] `rectangle.mat4.anchor-outside-rotate-z`
- [x] `rectangle.mat4.anchor-z-rotate-y-perspective`
- [x] `rectangle.mat4.rotate-x-perspective`
- [x] `rectangle.mat4.rotate-y-perspective`
- [x] `rectangle.mat4.translate-z-perspective`

Each fixture uses Full HD composition dimensions and is available through the
existing WebGPU/WebGL2 preview toggle. No ellipse fixture may be added.

### 3.5.8 Browser E2E and Backend Parity

- [x] Force WebGL2 and assert exact 2D rectangle pixels.
- [x] Force WebGPU when supported and assert equivalent draw coverage.
- [x] Compare 2D outputs exactly except documented anti-alias tolerances.
- [x] Compare perspective rectangle bounds and selected inside/outside pixels.
- [x] Assert that backend switching preserves case and preview time.
- [x] Assert active backend status after every switch.
- [ ] Run the WebGPU suite in installed Chrome as well as Playwright Chromium
      when available.
- [ ] Keep WebGL2 fallback green when WebGPU adapter creation fails.

Done when the same Atomic V2 rectangle project produces equivalent frames in
both backends.

### 3.5.9 Cleanup and Documentation

- [x] Remove V2 preview use of `toClipMatrix` mat3 helpers.
- [x] Remove V2 WebGPU mat3-to-mat4 packing code.
- [x] Keep old Matrix2D utilities only for explicit V1/Canvas compatibility.
- [x] Document Atomic coordinate, angle, anchor, matrix layout, transform
      order, projection, and depth conventions.
- [x] Update the main V2 plan to mark Task 3.5 as the blocker before Task 4.
- [x] Add forbidden-symbol checks preventing raw matrix fields in Atomic JSON.

Done when there is one V2 transform path from semantic JSON to runtime mat4
and both GPU backends consume it.

## Required Test Matrix

| Area | Required assertion |
| --- | --- |
| Atomic schema | Vec3 transform and anchor required; origin/raw matrix rejected |
| Math | Fixed order, signs, anchor X/Y/Z, translation column, finite values |
| Runtime | Every matrix is exactly 16 finite Float32 values |
| 2D parity | Existing rectangle pixels remain unchanged |
| 3D readiness | Perspective rectangle responds to rotate X/Y and translate Z |
| WebGL2 | Uses mat4 and WebGL clip-depth adaptation only |
| WebGPU | Uses the same model/world mat4 without promotion |
| Compositing | Opacity and z-index remain independent of geometric Z |
| Fallback | Auto selects WebGPU first and falls back to WebGL2 |
| Protocol boundary | No GPU resources or raw matrices in Atomic JSON |

## Completion Gate Before Task 4

Task 4 may begin only when all conditions below are true:

- [ ] All Task 2 and Task 3 rectangle tests pass without changed visual output.
- [ ] Atomic V2 uses semantic 3D transform fields plus local-unit `anchor`
      Vec3, and rejects both `origin` and raw matrix fields.
- [ ] Compiler/runtime produces validated column-major mat4 values.
- [ ] WebGL2 and WebGPU consume the same model/world matrix contract.
- [ ] Orthographic 2D and perspective rectangle fixtures pass browser E2E.
- [ ] Backend toggle parity has been manually verified in installed Chrome.
- [ ] No ellipse schema, fixture, shader branch, or test has been added.
- [ ] Runtime IR remains free of backend-native GPU handles.
- [ ] The main V2 roadmap records Task 3.5 as complete.

Only after this gate is complete may Task 4 add ellipse geometry coverage on
top of the certified transform/runtime foundation.
