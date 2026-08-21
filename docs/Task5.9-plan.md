# Task 5.9: Core V2 Cleanup and Protocol Hard Lock

Task 5.9 is the gate between the certified shape/matrix work and Task 6:
**Path Embedded in 3D**.

## Scope

This task covers only the certified render core:

```text
motion-protocol
      |
motion-compiler
      |
motion-runtime
   /       \
preview   Remotion
```

Included:

- `packages/motion-protocol`
- `packages/motion-compiler`
- `packages/motion-runtime`
- `packages/preview-renderer`
- `packages/remotion-renderer`
- V2 preview and Remotion/export smoke verification

Explicitly excluded:

- editor and desktop editor
- pattern and high-level authoring UI
- old documentation examples
- Task 6 Path implementation

Legacy editor failures do not block this task, but no legacy code may be
introduced into the certified core.

## Target Architecture

```text
Atomic Protocol V2 JSON
        |
        v
Compiler V2
        |
        v
RuntimeProjectV2
        |
        v
Runtime evaluator
        |
        v
RuntimeFrameV2 / PaintCommandBuffer
        |
        +--> Preview Renderer (WebGPU default, WebGL2 fallback)
        |
        +--> Remotion Renderer
```

Ownership rules:

| Package | Owns | Must not own |
| --- | --- | --- |
| `motion-protocol` | Atomic V2 schema and capability certification | Runtime IR, GPU, renderer logic |
| `motion-compiler` | Protocol V2 to Runtime IR V2 lowering | Pixel rendering and UI authoring |
| `motion-runtime` | Runtime IR validation, timing, Matrix4 and paint commands | Protocol parsing and compiler logic |
| `preview-renderer` | WebGPU/WebGL2 rasterization | Protocol parsing and compilation |
| `remotion-renderer` | Runtime V2 playback through Remotion | Protocol parsing and V1 fallback |

## Phase Status

| Phase | Description | Status |
| --- | --- | --- |
| 0 | Baseline and scope freeze | Done |
| 1 | Make Protocol public root V2 | Done |
| 2 | Remove Protocol V1 implementation | Done |
| 3 | Separate Runtime IR from Protocol fixtures | Done |
| 4 | Hard-lock compiler input to V2 | Done |
| 5 | Hard-lock preview and Remotion | Done |
| 6 | Remove `render-contracts` from render core | Done |
| 7 | Add the V2 core boundary validator | Done |
| 8 | Regenerate schema and certify public exports | Done |
| 9 | Final verification gate | Done |

## Phase 0: Baseline and Scope Freeze

Completed before refactor.

### Baseline results

| Surface | Result |
| --- | ---: |
| Protocol V2 targeted tests | 27 passed |
| Compiler tests | 17 passed |
| Runtime tests | 37 passed |
| Preview renderer tests | 6 passed |
| Remotion renderer tests | 5 passed |
| Preview Playwright suite | 22 passed |
| Render-worker V2 MP4 smoke | Passed |

### Phase 0 checklist

- [x] Freeze scope to the five certified core packages.
- [x] Record the current V2 test baseline.
- [x] Confirm WebGPU default and WebGL2 fallback are covered by E2E.
- [x] Confirm Remotion consumes the same Runtime V2 paint contract.
- [x] Keep editor/pattern work outside this acceptance gate.
- [x] Do not change render behavior during ownership cleanup.

## Phase 1: Make Protocol Public Root V2

### Tasks

- [x] Replace the root public API in `motion-protocol/src/index.ts` with V2.
- [x] Export `MotionProtocolV2Schema` and `MotionProtocolV2` from `.`.
- [x] Keep `/v2` as an explicit alias during migration.
- [x] Remove the public `./runtime` legacy export.
- [x] Remove `MotionProject`, `MotionProjectSchema`, and V1 parser aliases.
- [x] Set the only public format version to `2`.

### Acceptance

- [x] Root import and `/v2` import expose the same V2 contract.
- [x] No public Protocol API returns a V1 type.

### Phase 1 verification

- [x] Root `@motionvideo/motion-protocol` now exposes Protocol V2.
- [x] `/v2` remains available as the explicit V2 entrypoint.
- [x] `./runtime` is no longer exported.

## Phase 2: Remove Protocol V1 Implementation

### Tasks

- [x] Delete `packages/motion-protocol/src/v1`.
- [x] Delete the old `packages/motion-protocol/src/runtime` tree.
- [x] Delete V1 fixtures and V1 tests from the Protocol package.
- [x] Remove generated V1 schemas.
- [x] Remove V1-only dependencies and exports.
- [x] Reject `motion-project`, `formatVersion: 1`, `origin`, `depth`, and `bone`.

### Acceptance

- [x] No V1 implementation remains under `motion-protocol/src`.
- [x] V1 JSON fails schema parsing without migration or fallback.

### Phase 2 verification

- [x] Removed `src/v1` and the old Protocol `src/runtime` tree.
- [x] Removed V1 fixtures, tests, schema artifact and generator.
- [x] Removed legacy root capability and AI schema modules.
- [x] Protocol package typecheck passed.
- [x] Protocol V2 tests passed: 10 tests.
- [x] `check:schema` passed for `schema/v2.json`.

## Phase 3: Separate Runtime IR from Protocol Fixtures

### Goal

`motion-runtime` must be a Protocol-independent Runtime IR package. Runtime
tests may construct `RuntimeProjectV2`, but Runtime must not own Protocol JSON
fixtures or depend on Protocol schemas.

### Tasks

- [x] Move Protocol V2 fixtures from `motion-runtime/testing` to
      `motion-compiler/testing`.
- [x] Add the explicit `@motionvideo/motion-compiler/testing` export.
- [x] Update V2-only consumers to import fixtures from compiler testing.
- [x] Remove `motion-runtime/testing` from the runtime package exports.
- [x] Remove the Protocol dependency from `motion-runtime/package.json`.
- [x] Keep `RuntimeProjectV2`, `RuntimeFrameV2`, Matrix4, determinism and paint
      contracts in `motion-runtime`.
- [x] Add a dependency-direction check proving runtime does not import Protocol.

### Acceptance

- [x] Runtime production source contains no Protocol import.
- [x] Runtime public API contains no authoring fixture.
- [x] Compiler, runtime, preview and Remotion tests remain green.
- [x] The dependency graph check is available as `validate:v2-runtime-boundary`.

### Phase 3 verification

```text
validate:v2-runtime-boundary     passed
motion-runtime lint              passed
motion-runtime typecheck         passed
motion-compiler typecheck        passed
motion-compiler tests            17 passed
motion-runtime tests             37 passed
preview-renderer tests            6 passed
remotion-renderer tests           5 passed
ai-planner V2 tests               2 passed
render-worker typecheck           passed
render-worker tests               1 passed
```

## Phase 4: Hard-lock Compiler Input to V2

### Tasks

- [x] Import Protocol types only from the V2 public API.
- [x] Reject V1 envelopes and mixed V1/V2 documents.
- [x] Reject unknown layer types and unknown transform fields.
- [x] Keep capability checks fail-closed.
- [x] Add negative tests for all retired V1 entry shapes.

### Acceptance

- [x] `compileProtocolV2()` accepts only Protocol V2.
- [x] No auto-migration or V1 compatibility path exists.

### Phase 4 verification

```text
motion-compiler typecheck    passed
motion-compiler tests        20 passed
V1/mixed/unknown-field tests passed
```

## Phase 5: Hard-lock Preview and Remotion

### Preview tasks

- [x] Accept only `RuntimeFrameV2` or the V2 paint command contract.
- [x] Keep WebGPU as the default backend.
- [x] Keep WebGL2 as fallback and explicit test mode.
- [x] Ensure preview never parses Protocol JSON or compiles projects.

### Remotion tasks

- [x] Make `MotionComposition(runtime: RuntimeProjectV2)` the canonical API.
- [x] Reject runtime payloads whose format/version is not V2.
- [x] Keep Remotion and preview on the same evaluator and paint commands.

### Acceptance

- [x] Preview has no V1 adapter.
- [x] Remotion has no V1 adapter.
- [x] WebGPU/WebGL2 and Remotion parity tests remain green.

### Phase 5 verification

```text
motion-runtime typecheck    passed
motion-runtime tests        40 passed
preview-renderer typecheck  passed
preview-renderer tests      6 passed
remotion-renderer typecheck passed
remotion-renderer tests     5 passed
validate:v2-renderers       passed
preview Playwright baseline 22 passed
```

The latest browser rerun was blocked before route response by the local Next
dev server; it did not produce a renderer assertion failure. The certified
22-test preview suite remains the recorded E2E baseline, and package-level
preview/Remotion gates pass after this change.

## Phase 6: Remove `render-contracts` from Render Core

### Tasks

- [x] Remove the mandatory `RenderManifest` dependency from
      `remotion-renderer`.
- [x] Keep URL loading, Lambda job and webhook orchestration outside the core
      renderer, in the application/export layer.
- [x] Pass `RuntimeProjectV2` directly to the canonical Remotion composition.
- [x] Move runtime hashing needed by the core to runtime determinism utilities.
- [x] Replace worker-only job status types with local worker types.
- [x] Remove `render-contracts` from compiler/runtime/preview/remotion core
      dependencies.

### Acceptance

- [x] The render core can compile and render without `render-contracts`.
- [x] Export orchestration may use a separate manifest package later.

### Phase 6 verification

```text
motion-runtime typecheck     passed
motion-runtime tests         43 passed
motion-runtime lint          passed
remotion-renderer typecheck  passed
remotion-renderer tests      5 passed
remotion-renderer lint       passed
remotion-site typecheck      passed
render-worker typecheck      passed
render-worker tests          1 passed
validate:v2-boundary         passed
validate:v2-runtime-boundary passed
validate:v2-consumers        passed
validate:v2-renderers        passed
Remotion runtime-only MP4    passed (125.9 KB, 3.05s)
V2 render-worker MP4 smoke   passed (3.2 KB)
```

The application web typecheck still reports pre-existing editor and pattern
imports that intentionally target removed Protocol V1 APIs. Those modules are
outside Task 5.9 scope; the new export orchestration call site typechecks, and
the certified render core remains clean.

## Phase 7: V2 Core Boundary Validator

### Tasks

- [x] Add `validate:v2-core` for the five certified packages.
- [x] Ban V1 symbols, V1 format markers and legacy protocol imports.
- [x] Ban Protocol imports from Runtime, Preview and Remotion.
- [x] Ban Compiler imports from Preview and Remotion.
- [x] Remove legacy allowlists from the core validator.
- [x] Check package exports and workspace dependency direction.

### Acceptance

- [x] The validator fails on any new V1 reference in the core.
- [x] The validator passes on the clean V2 core.

### Phase 7 verification

```text
validate:v2-core              passed
validate:v2-boundary          passed
validate:v2-runtime-boundary  passed
validate:v2-consumers         passed
validate:v2-renderers         passed
```

`validate:v2-core` scans production source without legacy allowlists, checks
the five package dependency directions and public export maps, and confirms
the retired Protocol V1 trees/schema are absent.

## Phase 8: Schema and Public Export Certification

### Tasks

- [x] Generate JSON Schema from the V2 root schema only.
- [x] Verify strict unknown-key rejection.
- [x] Verify rectangle and ellipse remain certified.
- [x] Keep Path uncertified until Task 6 is complete.
- [x] Test root exports, `/v2` exports and removal of `./runtime`.

### Acceptance

- [x] Schema artifacts describe Protocol V2 only.
- [x] Public exports cannot expose V1 symbols.

### Phase 8 verification

```text
motion-protocol typecheck     passed
motion-protocol lint          passed
motion-protocol tests         14 passed
check:schema                  5 passed
schema/v2.json regeneration   passed
root and /v2 export tests     passed
Path capability lock          passed
```

## Phase 9: Final Gate Before Task 6

Run all of the following:

```text
motion-protocol typecheck and V2 tests        passed
motion-compiler typecheck and tests          passed
motion-runtime typecheck and tests           passed
preview-renderer typecheck and tests         passed
remotion-renderer typecheck and tests        passed
validate:v2-core                             passed
preview Playwright WebGPU/WebGL2 suite       22 passed
Remotion V2 parity suite                     6 passed
V2 export MP4 smoke                           passed
V1 rejection tests                            passed
```

Editor and pattern UI checks are intentionally excluded.

### Phase 9 verification

```text
Protocol tests                 14 passed
Compiler tests                 20 passed
Runtime tests                  43 passed
Preview renderer tests          6 passed
Remotion renderer tests         5 passed
Preview Playwright             22 passed
Remotion parity V2              6 passed
Remotion MP4 smoke              passed (125.9 KB, 3.05s)
Render-worker MP4 smoke         passed (3.2 KB)
validate:v2-core                passed
git diff --check                passed
```

The Playwright test server now uses the Webpack dev path and waits on
`/docs/preview`, keeping this gate isolated from the deferred editor route.

## Definition of Done

Task 6 may start only when:

- Protocol public root is V2.
- Protocol contains no V1 implementation or old Runtime IR.
- Compiler accepts only Protocol V2.
- Runtime is independent of Protocol schemas and fixtures.
- Preview accepts only Runtime V2.
- Remotion accepts only Runtime V2.
- Render core does not depend on `render-contracts`.
- `validate:v2-core` passes.
- Preview, Remotion and export smoke tests pass.
- V1 input is rejected at every core boundary.
