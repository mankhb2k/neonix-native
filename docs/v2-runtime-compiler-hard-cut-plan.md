# V2 Runtime And Compiler Hard-Cut Plan

> Status: required before Protocol V2 Task 6 (Path)
>
> Decision: `@motionvideo/motion-compiler` and
> `@motionvideo/motion-runtime` become V2-only packages. They do not parse,
> compile, evaluate, export, or provide compatibility aliases for V1.

## 1. Objective

Replace the current V1 execution pipeline with one V2 pipeline:

```text
High-level Authoring JSON
  -> Compiler A
Atomic Protocol V2 JSON
  -> Compiler B
Runtime IR V2
  -> frame evaluation
PaintCommandBuffer V2
  -> preview-renderer (WebGPU default, WebGL2 fallback)
  -> remotion-renderer / render-worker
```

The cut is intentionally destructive because the application is not in
production. A caller that still passes V1 data must fail at compile time or at
strict V2 validation. It must never be silently translated at runtime.

## 2. Non-Negotiable Invariants

- Atomic JSON accepted by Compiler B is only `MotionProtocolV2` with
  `format: "motion-protocol"` and `formatVersion: 2`.
- Runtime IR is created only by Compiler B. It never contains V1 authoring
  objects, V1 property paths, `bone`, `component`, `preset`, `pattern`, or raw
  matrices.
- Runtime owns deterministic timing, hierarchy, rounding, model mat4, view
  mat4, projection, and backend-neutral resource descriptors.
- WebGPU and WebGL2 consume the same Runtime IR / PaintCommandBuffer.
- Remotion export consumes the same Runtime IR / PaintCommandBuffer semantics
  as preview. It may use a different rendering backend.
- No `compileMotionProjectV1`, `compileProjectV1`, `evaluateCompositionFrameV1`,
  `MotionProjectV1`, `CompileV1Options`, V1 fixtures, or V1 compatibility
  export remains in compiler/runtime public APIs.
- There is no V1-to-V2 migration adapter in process memory. Any optional
  migration utility belongs outside compiler/runtime and is one-shot tooling,
  not a production execution path.

## 3. Current State And Gap

Today, `compileProtocolV2ToPaintCommands()` can render certified V2 shape
fixtures, but it emits a PaintCommandBuffer directly. Meanwhile,
`compileMotionProject()` still delegates to `compileMotionProjectV1()`, and
the runtime evaluator consumes the old `MotionRuntimeProject` format.

Therefore, deleting V1 first would leave V2 with no explicit Runtime IR
boundary and would break preview/export callers without a replacement. The
correct order is: establish the V2 Runtime IR, migrate consumers, then delete
the V1 implementation in one hard cut.

## 4. Target Public APIs

### `@motionvideo/motion-compiler`

```ts
import {
  compileProtocolV2,
  type CompileProtocolV2Options,
  type RuntimeProjectV2,
} from "@motionvideo/motion-compiler";

const runtime = compileProtocolV2(protocol);
```

Compiler B has two explicit operations:

```ts
compileProtocolV2(protocol): RuntimeProjectV2
evaluateRuntimeProjectV2(runtime, frame): PaintCommandBuffer
```

For a fixed-frame preview convenience API, this is valid:

```ts
compileProtocolV2ToPaintCommands(protocol, { frame: 0 })
```

It must be implemented as `compileProtocolV2()` followed by
`evaluateRuntimeProjectV2()`. It must not be a separate V2 code path.

### `@motionvideo/motion-runtime`

```ts
import {
  evaluateRuntimeProjectV2,
  type RuntimeProjectV2,
  type RuntimeFrameV2,
  type PaintCommandBuffer,
} from "@motionvideo/motion-runtime";
```

The runtime package retains generic math, paint commands, deterministic clock,
path helpers, and backend-neutral resource descriptions only when they have a
V2 owner. V1-named evaluator APIs are deleted, not renamed as aliases.

## 5. Runtime IR V2 Contract

Create `packages/motion-runtime/src/v2/` with strict TypeScript contracts.
The first vertical slice only needs the atoms already certified in preview:
rectangle and ellipse, fill/stroke/gradient, timing, opacity, z-index, and
the 3D transform/view contract.

```ts
type RuntimeProjectV2 = {
  format: "motion-runtime";
  formatVersion: 2;
  id: string;
  composition: RuntimeCompositionV2;
  nodes: RuntimeNodeV2[];
  view: RuntimeViewV2;
};

type RuntimeNodeV2 = {
  id: string;
  parentId: string | null;
  zIndex: number;
  timing: RuntimeTimingV2;
  frame: { width: number; height: number };
  localTransform: Float32Array;
  content: RuntimeShapeV2;
  composite: { opacity: number; blendMode: "normal" };
};
```

Rules:

- `localTransform`, `worldTransform`, and `viewProjectionTransform` are
  column-major `Float32Array(16)` and are runtime-only values.
- Atomic V2 continues to store semantic `translate`, `scale`, `rotate`,
  `anchor`, and `skew`; it never stores a matrix.
- A frame evaluation produces resolved world mat4 values and a deterministic
  `PaintCommandBuffer` ordered by `zIndex`, then stable node id.
- MVP depth policy remains painter ordering. `translate.z` affects projection,
  not implicit depth-buffer occlusion.
- The V2 Runtime IR cannot include GPU device handles, WebGL objects, texture
  handles, bind groups, vertex buffers, or shader source.

## 6. Execution Tasks

### Phase 0: Freeze The Boundary

- [x] Mark V1 compiler/runtime APIs as forbidden for new code in lint/search
      gates.
- [x] Add a repository check that rejects new imports of:
      `compileMotionProjectV1`, `compileProjectV1`,
      `evaluateCompositionFrameV1`, and `MotionProjectV1` from compiler/runtime.
- [x] Record all remaining V1 consumers by package: web editor, desktop,
      render-worker, remotion-renderer, playback-engine, AI planner, MCP, and
      test fixtures.
- [x] Stop Task 6 until Phases 1 through 5 are complete.

Acceptance: no new V1 execution dependency can enter the repository.

### Phase 1: Define Runtime IR V2

- [x] Add `RuntimeProjectV2`, `RuntimeNodeV2`, `RuntimeFrameV2`, and V2
      diagnostics under `packages/motion-runtime/src/v2/`.
- [x] Move the canonical Matrix4, projection, timing quantization, stable
      order, color/paint, and rounding contracts into V2-owned modules.
- [x] Define `evaluateRuntimeProjectV2(runtime, frame)` that emits a
      `PaintCommandBuffer` for certified rectangle/ellipse atoms.
- [x] Add golden unit tests for flat 2D and perspective Matrix4 frames.
- [x] Make the V2 runtime package independent of V1 protocol types.

Acceptance: a V2 RuntimeProject can be evaluated without importing any V1
schema, compiler, fixture, or type.

### Phase 2: Refactor Compiler B To V2 Runtime IR

- [x] Rename the V2 compiler entrypoint to `compileProtocolV2`.
- [x] Make it validate `MotionProtocolV2Schema`, V2 capability certification,
      layer references, timing, and normalized view state.
- [x] Emit `RuntimeProjectV2`, not a direct renderer-specific representation.
- [x] Implement `compileProtocolV2ToPaintCommands` only as a thin composition
      of compiler plus V2 runtime evaluation.
- [x] Keep the existing rectangle/ellipse fixtures byte-for-byte deterministic
      where their output contract is unchanged.
- [x] Replace public `compileMotionProject` with the V2-only API; do not retain
      its V1 parameter type or alias.

Acceptance: compiler unit tests use only V2 JSON and assert RuntimeProjectV2
plus PaintCommandBuffer output.

### Phase 3: Migrate Render Consumers

- [x] Update `packages/preview-renderer` to accept only V2 runtime frames or
      PaintCommandBuffer generated by V2 runtime.
- [x] Keep WebGPU as default and WebGL2 as fallback; assert their command input
      is identical for every certified atom.
- [x] Update `packages/remotion-renderer` to consume V2 runtime frames.
- [x] Update `apps/render-worker` export and contact-sheet paths to compile and
      evaluate V2 only.
- [x] Update `packages/playback-engine` with a V2 playback adapter that calls
      `evaluateRuntimeProjectV2`.
- [x] Disable legacy editor screens/fixtures that cannot yet author V2; do not
      retain a hidden V1 preview path.

Acceptance: preview, local export, and Remotion export render the same V2
rectangle/ellipse fixtures at frame 0 and selected perspective frames.

Progress: the certified rectangle/ellipse execution path is now V2-only across
preview, Remotion, render-worker export/contact sheets, and the new playback
adapter. The pre-existing V1 compiler/runtime source remains isolated for the
planned Phase 5 deletion; it is no longer an active editor/export path.

### Phase 4: Migrate Tooling And Test Fixtures

- [ ] Convert AI planner, MCP operations, CLI commands, docs fixtures, and
      smoke fixtures to Protocol V2 input.
- [ ] Replace V1 testing helpers with V2 fixture builders. Testing exports must
      not compile V1 projects.
- [ ] Rewrite runtime/compiler tests around certified V2 atoms and Runtime IR
      V2. Delete V1 parity tests instead of maintaining dual parity.
- [ ] Remove V1 references from package READMEs and architecture documentation.
- [ ] Preserve valuable visual assertions by porting them to V2 only when the
      relevant atom has been certified; otherwise remove them with the V1 code.

Acceptance: `rg` finds no compiler/runtime consumer calling a V1 API.

### Phase 5: Delete V1 From Compiler And Runtime

- [ ] Delete `packages/motion-compiler/src/compile-v1/`.
- [ ] Delete V1 compiler tests, cache-key code, V1 semantic validators, V1
      component expansion, and V1-only compile diagnostics.
- [ ] Delete V1 runtime evaluators, V1 fixtures, V1 testing helpers, and all
      exports that expose old `MotionRuntimeProject` evaluation.
- [ ] Remove `@motionvideo/motion-protocol` V1 imports from compiler/runtime.
- [ ] Delete obsolete V1 documentation links from package READMEs.
- [ ] Fail CI when source code under compiler/runtime contains `V1`,
      `formatVersion: 1`, or imports from `motion-protocol/v1`, except in a
      separately approved one-shot migration tool outside these packages.

Acceptance: compiler/runtime source trees contain no V1 execution code and
their public entrypoints have no V1 exports.

### Phase 6: Final Certification And Task 6 Gate

- [ ] Run compiler/runtime V2 unit tests.
- [ ] Run Protocol V2 schema and capability tests.
- [ ] Run preview renderer unit tests.
- [ ] Run `/docs/preview` E2E tests in WebGPU and WebGL2.
- [ ] Run Remotion/export parity for every certified V2 atom.
- [ ] Verify `rg` reports no V1 compiler/runtime API usage across `apps/` and
      `packages/`.
- [ ] Commit the hard cut as one migration commit or a small ordered commit
      series with no intermediate compatibility release.

Only after this phase is green may Protocol V2 Task 6 (Path) begin.

## 7. Deletion Inventory

The following are expected to disappear or be rewritten during the hard cut:

| Area | Current V1 responsibility | V2 destination |
| --- | --- | --- |
| `motion-compiler/src/compile-v1/` | V1 parsing, component expansion, compile | Delete; Compiler B accepts Atomic V2 only |
| `compileMotionProject*` APIs | V1 public compiler facade | Replace with `compileProtocolV2` |
| `motion-runtime/evaluate-composition.ts` V1 API | V1 RuntimeProject frame evaluation | Replace with `evaluateRuntimeProjectV2` |
| `motion-runtime/testing/compile.ts` | V1 fixture compilation | Replace with V2 fixture constructors only |
| `motion-runtime/testing/*demo*` | V1 project fixtures | Port atom-by-atom or delete |
| legacy web/desktop stage paths | V1 compile/evaluate calls | V2 preview route or disabled legacy surface |
| worker/Remotion/playback | V1 runtime inputs | RuntimeProjectV2 / RuntimeFrameV2 |

`MotionProtocolV1` removal from `@motionvideo/motion-protocol` is a subsequent
repository-wide cleanup task. It must start only after no compiler/runtime or
consumer path requires it. This plan deliberately prevents new V1 dependence
while making V2 execution the sole supported path first.

## 8. Explicit Non-Goals

- Do not add High-level patterns, components, templates, or presets before the
  V2 execution path is stable.
- Do not convert arbitrary V1 documents automatically during preview or export.
- Do not preserve V1 API names with V2 implementations.
- Do not start Path, Text, Image, Video, Mask, or Effects atoms while the core
  compiler/runtime still has a V1 execution path.
- Do not make renderer backends calculate semantic transforms or compensate for
  V1 behavior.

## 9. Completion Definition

This hard cut is complete only when a clean repository build can execute:

```text
Protocol V2 rectangle or ellipse fixture
  -> compileProtocolV2
  -> RuntimeProjectV2
  -> evaluateRuntimeProjectV2(frame)
  -> identical PaintCommandBuffer meaning
  -> WebGPU preview / WebGL2 fallback / Remotion export
```

and no V1 compiler/runtime code, public API, fixture helper, or consumer path
remains.
