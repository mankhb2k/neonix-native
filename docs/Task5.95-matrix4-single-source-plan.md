# Task 5.95: Matrix4 Single Source of Truth

Task 5.95 is the final hardening gate between Task 5.9 and Task 6:
**Path Embedded in 3D**.

The goal is to remove the two competing transform paths. Atomic Protocol V2
continues to describe semantic transform values, but Compiler B, Runtime V2,
preview, and export use Matrix4 as the only render transform representation.

## 1. Target Result

```text
Atomic Protocol V2
translate / rotate / scale / skew / anchor
                    |
                    v
             Motion Compiler V2
                    |
                    v
          localMatrix4 / worldMatrix4
                    |
                    v
             RuntimeFrameV2
                    |
          +---------+----------+
          |                    |
          v                    v
 Preview Renderer       Remotion Export
 WebGPU / WebGL2        same GPU paint path
```

Mandatory rules:

- Atomic Protocol V2 must not contain raw matrix fields.
- Compiler B is the only layer that lowers semantic transforms into Matrix4.
- Runtime V2 must not store `matrix2D` or accept a Matrix2D fallback.
- Preview and Remotion must consume `matrix4`, view, and projection from the same
  `RuntimeFrameV2` contract.
- 2D geometry remains on the local XY plane, but is always transformed by Matrix4.
- `zIndex` remains compositing order; `translate.z` does not replace it.
- WebGPU is the default preview backend; WebGL2 is the fallback.

## 2. Locked Decisions

### 2.1 Atomic Transform Schema Does Not Change

```ts
type AtomicTransformV2 = {
  translate: { x: number; y: number; z: number };
  rotate: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  skew: { x: number; y: number };
  anchor: { x: number; y: number; z: number };
};
```

- `translate` and `anchor` use composition/local units.
- `anchor.x`, `anchor.y`, and `anchor.z` all use local units. Normalized X/Y
  must not be mixed with absolute Z.
- Rotation uses degrees.
- Scale uses ratios.
- Skew applies in the local XY plane.
- Camera and projection belong to composition-level `view`, not layer transform.

### 2.2 2D Is a Matrix4 Subset

A layer is a pure 2D case when:

```text
translate.z = 0
rotate.x = 0
rotate.y = 0
scale.z = 1
anchor.z = 0
projection = orthographic
```

The layer may still use `rotate.z`, X/Y scale, X/Y skew, and X/Y anchor. No
Matrix2D is needed to render this case.

### 2.3 One Compose Order

```text
Model =
  Translate(position)
  * Translate(anchor)
  * RotateZ
  * RotateY
  * RotateX
  * SkewXY
  * ScaleXYZ
  * Translate(-anchor)
```

No `transformOrder` property is supported. Every atom and renderer must use this
order.

### 2.4 Precision and Packing

- CPU math uses `Float64Array` for Matrix4 calculations.
- The Runtime wire contract contains exactly 16 finite column-major numbers.
- One shared helper packs Matrix4 into `Float32Array` at the GPU boundary.
- WebGPU and WebGL2 use the same packing helper.
- Renderers must not recompute translate, rotate, scale, skew, or anchor.

## 3. Out of Scope

- Path implementation.
- Depth-buffer ordering.
- Geometric Z as a replacement for `zIndex`.
- Quaternion fields in Atomic Protocol.
- Look-at camera, orbit rigs, and high-level camera movement.
- Editor, pattern UI, and high-level authoring refactors.
- Changes to certified shape, stroke, gradient, or opacity semantics.

## 4. Phase Status

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Baseline and contract freeze | Done |
| 1 | Harden Matrix4 math API | Done |
| 2 | Unify local Matrix4 composition | Pending |
| 3 | Remove Matrix2D from Compiler and Runtime V2 | Pending |
| 4 | Lock Preview to Matrix4 | Pending |
| 5 | Move Remotion/export to Matrix4 | Pending |
| 6 | Projection and camera-plane safety | Pending |
| 7 | Matrix4 parity E2E | Pending |
| 8 | Validators, cleanup, and final gate | Pending |

## 5. Phase 0: Baseline and Contract Freeze

### Tasks

- [x] Record current test counts for protocol, compiler, runtime, preview, and
  Remotion.
- [x] Run `pnpm validate:v2-core` and record the baseline result.
- [x] Run the preview Playwright suite for WebGPU and WebGL2.
- [x] Render one 2D MP4 with Remotion as the export baseline.
- [x] Record symbols that must be removed:
  - `Transform2D.depth`
  - `RuntimeNodeV2.matrix2D`
  - `shapeTransformMatrix2D`
  - `PaintCommand.setTransform.matrix`
  - `affineToMatrix4(transform.matrix)` in the V2 renderer path
  - CSS `matrix(...)` in the Remotion V2 painter
- [x] Confirm that Task 6 remains locked throughout Task 5.95.

### Baseline Results

Recorded on 2026-08-21:

| Gate | Result |
| --- | --- |
| Protocol typecheck/tests | 14 tests passed |
| Compiler typecheck/tests | 20 tests passed |
| Runtime typecheck/tests | 43 tests passed |
| Preview renderer typecheck/tests | 6 tests passed |
| Remotion renderer typecheck/tests | 5 tests passed |
| `pnpm validate:v2-core` | Passed |
| `pnpm test:parity` | Passed, 6 samples |
| Preview Playwright | 22 tests passed |
| Remotion MP4 smoke | Passed, 125.9 KB, 3.05s |
| V2 worker MP4 smoke | Passed, 3.2 KB |

Baseline limitation: the existing full web typecheck still includes excluded
legacy editor imports. That editor surface is outside Task 5.95 and Task 5.9.

### Exit Criteria

- [x] Baseline is recorded in this plan.
- [x] No visual behavior was intentionally changed by Phase 0.
- [x] Task 6 remains blocked until the Matrix4-only contract is certified.

## 6. Phase 1: Harden the Matrix4 Math API

### 1.1 Strict Matrix Factories

- [x] Separate the identity factory from the values factory:

```ts
identityMatrix4(): Matrix4
matrix4FromValues(values: Matrix4Values): Matrix4
```

- [x] Require exactly 16 finite values for `Matrix4Values`.
- [x] Remove the partial-input behavior of `createMatrix4([1, 2])`.
- [x] Make `arrayToMatrix4()` strict or replace it with `matrix4FromValues()`.
- [x] Runtime validators reject missing, short, long, `NaN`, and infinite matrices.

### 1.2 Remove Shared Mutable Identity

- [x] Remove exported mutable `IDENTITY_MATRIX4`.
- [x] Give each consumer a fresh identity matrix from the factory.
- [x] Add a regression test proving that one consumer cannot mutate another
  consumer's identity matrix.

### 1.3 Inverse Policy

- [x] Define singular and near-singular matrix behavior explicitly.
- [x] Replace the absolute determinant threshold with a relative threshold or a
  pivot threshold based on matrix magnitude.
- [x] Allow zero scale in rendering if the Protocol contract continues to allow
  it, but make inverse/hit-testing return `undefined` deterministically.
- [x] Add tests for zero scale, very small scale, and normal scale.

### Tests

- [x] Exact identity golden.
- [x] Column-major translation golden.
- [x] Matrix multiplication order golden.
- [x] Inverse round-trip with a locked tolerance.
- [x] Invalid values fail closed.

### Phase 1 Implementation Notes

Implemented on 2026-08-21:

- `createMatrix4()` now uses an identity seed before applying overrides, so
  partial overrides preserve identity values.
- `createMatrix4(values)` rejects non-array, non-finite, and non-16-value input.
- `arrayToMatrix4()` delegates to the strict factory.
- `identityMatrix4()` returns a fresh matrix for every call.
- Runtime-owned consumers no longer need to share the mutable identity singleton.
- Matrix4 tests cover identity, partial input rejection, invalid values,
  translation, and identity isolation.

Phase 1 verification on 2026-08-21:

| Gate | Result |
| --- | --- |
| Runtime typecheck | Passed |
| Runtime tests | 48 passed |
| Runtime lint | Passed |
| Compiler typecheck/tests/lint | Passed, 20 tests |
| Playback Engine typecheck/tests/lint | Passed, 50 tests |
| Preview typecheck/tests | Passed, 6 tests |
| Remotion typecheck/tests | Passed, 5 tests |
| `pnpm validate:v2-core` | Passed |
| `pnpm test:parity` | Passed, 6 samples |
| `git diff --check` | Passed |

### Exit Criteria

- [x] Matrix4 factories no longer silently zero-fill partial input.
- [x] Shared mutable identity is no longer required by the runtime path.
- [x] All Matrix4 values entering Runtime V2 are exactly 16 finite values.
- [x] Matrix4 package typecheck and tests pass.

## 7. Phase 2: Unify Local Matrix4 Composition

### Tasks

- [x] Create one protocol-neutral runtime math helper:

```ts
composeLocalMatrix4(input: LocalTransform3D): Matrix4
```

- [x] `LocalTransform3D` uses Vec3 semantic values and absolute composition-unit
  anchor; it must
  not receive `width`/`height` to normalize anchor values.
- [x] Compiler maps `V2Transform` to `LocalTransform3D` and calls the one helper.
- [x] Remove the duplicate compiler-side Matrix4 composition implementation
  after migration.
- [x] Remove or replace the old `localTransformMatrix3D()` implementation that
  contains `anchorZ * 0`.
- [x] Compose skew using the locked order.
- [x] Do not allow compiler or renderer to add a second composition algorithm.

### Required Goldens

- [x] Identity transform and Translate XYZ.
- [x] Rotate X/Y/Z, Scale XYZ, and Skew X/Y are covered by the canonical composer test.
- [x] Anchor inside/outside composition bounds is represented by absolute anchor units.
- [x] `anchor.z != 0` with X rotation.
- [x] `anchor.z != 0` with Y rotation.
- [x] Combined translate, anchor, rotation, skew, and scale.
- [x] Identity rotation/scale does not move a layer when only the anchor changes.

### Exit Criteria

- Only one local Matrix4 compose helper exists in the certified core.
- The Matrix4 composer tests use non-zero `anchor.z` values.
- Matrix4 tests prove that non-zero `anchor.z` changes the pivot/orbit behavior.

## 8. Phase 3: Remove Matrix2D from Compiler and Runtime V2

### Compiler Tasks

- [x] Remove `shapeTransformMatrix2D()`.
- [x] Remove Matrix2D imports from Compiler V2.
- [x] Compiler emits only `localMatrix` and `worldMatrix` Matrix4 values.

### Runtime Tasks

- [x] Remove `matrix2D` from `RuntimeNodeV2`.
- [x] Remove `matrix` from V2 `setTransform`; `matrix4` becomes required.
- [x] Remove `Transform2D.depth`.
- [x] Do not let Runtime V2 accept a Matrix2D fallback.
- [x] Update hash/fingerprint code to hash canonical Matrix4 only.
- [x] Remove `depthFromMat4()` because it has no consumer; do not keep an ambiguous
  helper that may later be mistaken for general 3D sorting.
- [x] Any remaining Matrix2D utility is isolated to the legacy/editor-only adapter
  modules (`matrix.ts`, `evaluated-geometry.ts`, and Canvas2D replay); it is not
  imported by Compiler V2, Runtime V2 evaluation, Preview, or Remotion.
  the certified V2 render core and must not be imported by Compiler V2, Runtime
  V2, Preview, or Remotion.

### Boundary Tests

- [x] Missing `matrix4` is rejected.
- [x] Legacy `matrix` is rejected.
- [x] `matrix2D` is rejected at the Runtime V2 boundary by the V2 type/command shape.
- [x] 2D identity and translation remain covered through Matrix4; Z rotation remains
  covered by compiler Matrix4 tests.
- [x] Certified preview/remotion production code has no Matrix2D fallback symbols.

## 9. Phase 4: Lock Preview to Matrix4

### Shared Renderer Tasks

- [x] `setTransform.matrix4` is required in WebGPU and WebGL2.
- [x] Remove `affineToMatrix4(transform.matrix)` fallback.
- [x] WebGPU and WebGL2 use shared `packMatrix4F32()`.
- [x] Both backends receive the same model/world Matrix4 and composition projection.
- [x] WebGL2 may adjust only clip-space depth; it must not modify model Matrix4.
- [x] WebGPU remains the default for `auto`; WebGL2 remains the fallback.
- [x] Backend diagnostics record the active backend and fallback reason.

### Preview Tests

- [x] Orthographic 2D rectangle pixel parity.
- [x] Orthographic ellipse pixel parity.
- [x] Rotate X/Y perspective.
- [x] Translate Z perspective.
- [x] Non-zero anchor Z perspective.
- [x] Skew combined with Y rotation.
- [x] WebGPU/WebGL2 bounds stay within the certified tolerance.
- [x] DPR 1 and DPR 2 preserve logical geometry.

## 10. Phase 5: Move Remotion/Export to Matrix4

Remotion remains responsible for timeline orchestration and video encoding. It
must not maintain a separate DOM/CSS Matrix2D renderer for Runtime V2.

### Architecture

- [x] Create a Remotion frame component with a canvas at composition resolution.
- [x] The component receives the same `RuntimeFrameV2` consumed by preview.
- [x] Reuse the WebGPU/WebGL2 paint path from `preview-renderer`.
- [x] Use `delayRender()` and `continueRender()` so capture waits for backend
  initialization and frame presentation.
- [x] `auto` prefers WebGPU and falls back to WebGL2.
- [x] Export smoke certifies the WebGL2 fallback because headless WebGPU is
  not guaranteed on every machine.
- [x] Remove CSS `matrix(...)` from the Remotion V2 painter.
- [x] Do not translate the canonical projection into a separate CSS perspective.

### Export Tests

- [x] 2D orthographic rectangle and combined 3D Matrix4 MP4 smoke.
- [x] The combined smoke exercises Rotate X, Rotate Y, non-zero anchor Z, and
  Translate Z through the same RuntimeFrameV2 canvas path.
- [x] Preview and Remotion consume the same frame-level Matrix4 contract.
- [x] Remotion fails closed if the backend cannot initialize; it must not fall
  back to Matrix2D.

## 11. Phase 6: Projection and Camera-Plane Safety

### Point Transform API

- [x] Separate homogeneous transform from perspective division:

```ts
transformPoint4(matrix, point): { x: number; y: number; z: number; w: number }

projectPoint3D(matrix, point):
  | { kind: "projected"; x: number; y: number; z: number; w: number }
  | { kind: "clipped"; reason: ProjectionClipReason; w: number };
```

- [x] Never return `{x: 0, y: 0, z: 0}` when `w` is near zero.
- [x] Distinguish `near-plane`, `behind-camera`, `far-plane`, `non-finite`, and valid points.
- [x] Bounds and hit testing must not treat a clipped point as composition origin;
  the active V2 workspace has no CPU bounds/hit-test consumer, and the shared
  projection API now fails closed for that future consumer.

### Projection Policy

- [x] Use near/far planes in camera/clip space; do not clamp with an arbitrary
  `z < 0.8 * cameraDistance` rule.
- [x] GPU continues to perform homogeneous clipping.
- [x] CPU bounds helpers fail closed or clip geometry before perspective divide;
  no CPU raster/bounds worker is present in the active workspace, so this is
  enforced at the shared runtime API boundary.
- [x] Add diagnostics when an entire layer is behind the camera.
- [x] Geometry crossing the near plane cannot produce `NaN`, infinity, or giant
  projected values through the shared API; invalid points are classified and
  returned without division.

### View Matrix

- [x] Add a golden test for camera translation and rotation together.
- [x] Verify camera inverse multiplication order against the locked convention.
- [x] `lookAtMatrix()` remains outside Atomic V2 in this task.

## 12. Phase 7: Matrix4 Parity E2E

### Required Cases

| Case | Projection | What it proves |
| --- | --- | --- |
| `matrix4.2d.identity` | Orthographic | 2D remains pixel-stable |
| `matrix4.2d.rotate-z` | Orthographic | Z rotation and XY anchor work |
| `matrix4.2d.skew` | Orthographic | Skew needs no Matrix2D |
| `matrix4.3d.rotate-x` | Perspective | X rotation is not flattened |
| `matrix4.3d.rotate-y` | Perspective | Y rotation is not flattened |
| `matrix4.3d.translate-z` | Perspective | Geometric Z works |
| `matrix4.3d.anchor-z` | Perspective | Non-zero Z pivot creates an orbit |
| `matrix4.camera-plane` | Perspective | Invalid W does not become origin |

Each case must run through:

- [x] Preview WebGPU.
- [x] Preview WebGL2.
- [x] Remotion frame rendering.
- [x] MP4 smoke when the case contains motion.

### Assertions

- [x] Interior pixels match.
- [x] Geometry bounds stay within the locked tolerance.
- [x] Edge tolerance is at most 1 physical pixel at DPR 1.
- [x] No dark fringe, `NaN`, blank frame, or origin teleport occurs.
- [x] Active backend is recorded in test artifacts.
- [x] The 2D baseline remains unchanged after Matrix2D removal.

## 13. Phase 8: Validators, Cleanup, and Final Gate

### Static Validators

- [x] Ban `Matrix2D` and `matrix2D` in the certified V2 render path.
- [x] Ban optional `matrix4` in the Runtime V2 transform command.
- [x] Ban renderer-side semantic transform composition.
- [x] Ban Protocol imports from Preview and Remotion.
- [x] Ban Compiler imports from Preview and Remotion.
- [x] Ban CSS `matrix(...)` in the Remotion V2 painter.
- [x] Ban `anchorZ * 0` and partial Matrix4 construction.

### Documentation

- [x] Update `ai-first-editor-architecture.md` to describe Matrix4-only Runtime V2.
- [x] Update `atomic-protocol-v2-preview-e2e-plan.md` so Task 6 depends on Task
  5.95.
- [x] Update Runtime, Preview, and Remotion READMEs.
- [x] Document that Matrix2D may only be an editor-local derived optimization,
  never Runtime IR.

### Final Commands

```powershell
pnpm --filter @motionvideo/motion-protocol typecheck
pnpm --filter @motionvideo/motion-protocol test
pnpm --filter @motionvideo/motion-compiler typecheck
pnpm --filter @motionvideo/motion-compiler test
pnpm --filter @motionvideo/motion-runtime typecheck
pnpm --filter @motionvideo/motion-runtime test
pnpm --filter @motionvideo/preview-renderer typecheck
pnpm --filter @motionvideo/preview-renderer test
pnpm --filter @motionvideo/remotion-renderer typecheck
pnpm --filter @motionvideo/remotion-renderer test
pnpm validate:v2-core
pnpm validate:v2-hard-lock
pnpm test:parity
```

Playwright gate:

```powershell
$env:PLAYWRIGHT_PORT = "3001"
$env:NEXT_DIST_DIR = ".next-matrix4-e2e"
pnpm --filter @motionvideo/web exec playwright test `
  e2e/preview-v2-atoms.spec.ts `
  --project=chromium `
  --reporter=line
```

Export gates:

```powershell
pnpm e2e:remotion
pnpm e2e:render
```

## 14. Commit and Acceptance Strategy

Each phase should be one isolated commit so it can be reviewed and bisected:

| Phase | Suggested commit |
| --- | --- |
| 0 | `test: record matrix4 single-source baseline` |
| 1 | `refactor(runtime): harden matrix4 construction` |
| 2 | `refactor(compiler): centralize matrix4 composition` |
| 3 | `refactor(runtime): remove matrix2d from v2` |
| 4 | `refactor(preview): require matrix4 transforms` |
| 5 | `refactor(remotion): render runtime v2 through matrix4` |
| 6 | `fix(runtime): classify invalid perspective projection` |
| 7 | `test: certify matrix4 preview export parity` |
| 8 | `chore: enforce matrix4-only v2 render core` |

Do not start the next phase until the current phase has passing typecheck, unit
tests, and an acceptance artifact.

## 15. Definition of Done

Task 5.95 is complete when all of the following are true:

- [ ] Atomic Protocol V2 remains semantic JSON and contains no Matrix4.
- [ ] Compiler emits Matrix4 only.
- [x] Runtime V2 has no `matrix2D` or optional Matrix4 fallback.
- [ ] Preview WebGPU and WebGL2 consume Matrix4 only.
- [ ] Remotion/export consume the same RuntimeFrameV2 and Matrix4 contract.
- [ ] Orthographic 2D remains pixel-stable through Matrix4.
- [ ] Rotate X/Y, translate Z, and non-zero anchor Z work in preview and export.
- [ ] Invalid perspective points never map to composition origin.
- [ ] `zIndex` remains the only MVP compositing order.
- [ ] Protocol, compiler, runtime, preview, Remotion, Playwright, and MP4 smoke
  gates pass.
- [x] Static validation prevents Matrix2D from returning to the certified V2
  render path.

Only after this checklist is accepted may Task 6: Path Embedded in 3D start.
