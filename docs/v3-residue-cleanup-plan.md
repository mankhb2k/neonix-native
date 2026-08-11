# V3 Residue Cleanup Plan

> Status: implementation plan
>
> Goal: remove the remaining V2-shaped residue after compat deletion, so V3 is the single source of truth for authoring, MCP, Skills, preview, render, and provider plugins.

## Current Assessment

The codebase has already made important progress:

- `packages/motion-protocol/src/compat/` has been deleted.
- `@motionvideo/motion-protocol` no longer exports `./compat/*`.
- V3 authoring rejects `formatVersion: 2`, `timeline.sceneOrder`, and `scene.transition`.
- `compile-v3.ts` now preserves one runtime visual track per V3 visual track.
- `compile-v3.ts` no longer emits runtime `timeline.sceneOrder`.

However, V3 is not fully clean yet. The remaining issue is not classic compat anymore. It is V2-shaped residue:

- Runtime IR still has `formatVersion: 2`.
- Runtime IR still accepts optional `timeline.sceneOrder`.
- Public root exports still expose many `*V2Schema` names.
- Runtime primitives are still defined with V2 names, then aliased to neutral names.
- `compileMotionProjectV2` still exists in the compiler package.
- The V3 barrel has circular import risk because V3 MCP/patch/parse/skills import `MotionProjectV3Schema` from `./index`, while `v3/index.ts` exports those modules.

## North Star

There should be one obvious path:

```text
AI / MCP / Skill / Editor
  -> MotionProject V3
  -> V3 Patch
  -> V3 Validation
  -> Compiler V3
  -> MotionRuntimeProject
  -> Provider adapter
  -> Preview / Playback / Render / Export
```

And one hard rule:

```text
Production code must not require V2 authoring fields, V2 parser names, compat modules, or public V2 schema names.
```

Runtime can have its own versioning, but it should not look like old authoring V2.

## Phase 0 - Baseline And Safety Net

Purpose: capture the current passing state before deeper cleanup.

Tasks:

- [ ] Run the V3 architecture gate:

```powershell
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

- [ ] Run compiler tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test
```

- [ ] Run protocol tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
```

- [ ] Run runtime tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-runtime test
```

- [ ] Record current known V2 residue:

```powershell
rg -n "V2Schema|NormalizedMotionProjectV2|MotionRuntimeIR|compileMotionProjectV2|sceneOrder|formatVersion:\\s*2|MOTION_V2_LIMITS" packages apps scripts -S
```

Acceptance:

- [ ] We know which failures are real and which are sandbox/tooling issues.
- [ ] The cleanup starts from a reproducible baseline.

## Phase 1 - Fix V3 Barrel Circular Imports

Purpose: make V3 safe for MCP, CLI, Skills, and external agent runtimes.

Problem:

`packages/motion-protocol/src/v3/mcp.ts`, `patch.ts`, `parse.ts`, and `skills.ts` import `MotionProjectV3Schema` from `./index`. But `v3/index.ts` also exports those modules, creating a barrel cycle.

Tasks:

- [ ] Create a leaf module for the root project schema, for example:

```text
packages/motion-protocol/src/v3/project.ts
```

- [ ] Move `MotionProjectV3Schema` and `MotionProjectV3` from `v3/index.ts` into `v3/project.ts`.
- [ ] Update `v3/index.ts` to re-export `./project`.
- [ ] Update these files to import from `./project` instead of `./index`:
  - `packages/motion-protocol/src/v3/mcp.ts`
  - `packages/motion-protocol/src/v3/patch.ts`
  - `packages/motion-protocol/src/v3/parse.ts`
  - `packages/motion-protocol/src/v3/skills.ts`
- [ ] Add or keep a test that imports each V3 submodule directly without going through the root barrel.

Acceptance:

- [ ] No production file under `packages/motion-protocol/src/v3/` imports schema values from `./index`.
- [ ] V3 MCP and Skill modules can be imported in isolation.
- [ ] Protocol tests pass.

Suggested check:

```powershell
rg -n "from \"\\.\\/index\"|from '\\.\\/index'" packages/motion-protocol/src/v3 -S
```

## Phase 2 - Rename Limits To Protocol-Neutral Names

Purpose: remove V2 language from the shared protocol vocabulary.

Problem:

`MOTION_V2_LIMITS` is used by both V3 authoring and runtime. The values may still be valid, but the name teaches the wrong model.

Tasks:

- [ ] Rename canonical export:

```ts
MOTION_V2_LIMITS -> MOTION_PROTOCOL_LIMITS
```

- [ ] Update imports across protocol, runtime, compiler, and tests.
- [ ] If needed, keep a temporary deprecated alias in an internal-only location, not public root.
- [ ] Remove the deprecated alias once all packages are updated.
- [ ] Update docs to use `MOTION_PROTOCOL_LIMITS`.

Acceptance:

- [ ] `rg -n "MOTION_V2_LIMITS" packages apps scripts docs -S` has no production matches.
- [ ] V3 schema files read as V3/protocol-owned, not V2-owned.

## Phase 3 - Make Runtime Primitive Schemas Canonical

Purpose: stop defining runtime primitives as V2 schemas with neutral aliases on top.

Problem:

Runtime files currently define names like `NodeV2Schema`, `AssetV2Schema`, `TransformV2Schema`, then alias them to `NodeSchema`, `AssetSchema`, `TransformSchema`.

Target:

```ts
export const NodeSchema = z.discriminatedUnion("type", [...]);
export type MotionNode = z.infer<typeof NodeSchema>;
```

Tasks:

- [ ] Rename runtime assets:
  - `ImageAssetV2Schema` -> `ImageAssetSchema`
  - `SvgAssetV2Schema` -> `SvgAssetSchema`
  - `VideoAssetV2Schema` -> `VideoAssetSchema`
  - `AudioAssetV2Schema` -> `AudioAssetSchema`
  - `FontAssetV2Schema` -> `FontAssetSchema`
  - `AssetV2Schema` -> `AssetSchema`
- [ ] Rename runtime effects:
  - `EffectV2Schema` -> `EffectSchema`
- [ ] Rename runtime transform:
  - `TransformV2Schema` -> `TransformSchema`
- [ ] Rename runtime node timing:
  - `NodeTimingV2Schema` -> `NodeTimingSchema`
  - `NodeTimingV2` -> `NodeTiming`
- [ ] Rename runtime geometry primitives:
  - `PointV2Schema` -> `PointSchema`
  - `PathSegmentV2Schema` -> `PathSegmentSchema`
  - `PathContourV2Schema` -> `PathContourSchema`
  - `PathMorphTargetV2Schema` -> `PathMorphTargetSchema`
- [ ] Rename runtime node schemas:
  - `GroupNodeV2Schema` -> `GroupNodeSchema`
  - `BoneNodeV2Schema` -> `BoneNodeSchema`
  - `TextNodeV2Schema` -> `TextNodeSchema`
  - `ShapeNodeV2Schema` -> `ShapeNodeSchema`
  - `PathNodeV2Schema` -> `PathNodeSchema`
  - `ImageNodeV2Schema` -> `ImageNodeSchema`
  - `SvgNodeV2Schema` -> `SvgNodeSchema`
  - `VideoNodeV2Schema` -> `VideoNodeSchema`
  - `CameraNodeV2Schema` -> `CameraNodeSchema`
  - `ComponentNodeV2Schema` -> `ComponentNodeSchema`
  - `SolidNodeV2Schema` -> `SolidNodeSchema`
  - `AdjustmentNodeV2Schema` -> `AdjustmentNodeSchema`
  - `NodeV2Schema` -> `NodeSchema`
- [ ] Update imports in runtime project schema.
- [ ] Update imports in compiler and render worker.
- [ ] Update tests and fixtures.
- [ ] Remove neutral aliases that point back to V2 names.

Acceptance:

- [ ] Runtime primitives are defined with neutral names first.
- [ ] `rg -n "\\b\\w+V2Schema\\b|\\b\\w+V2\\b" packages/motion-protocol/src/runtime -S` has no production matches, except intentional negative tests if any.

## Phase 4 - Clean Public Root API

Purpose: prevent AI agents and external users from learning V2 names from the package surface.

Problem:

`packages/motion-protocol/src/index.ts` still exports deprecated `*V2Schema` names from the public root.

Tasks:

- [ ] Remove all public root exports named `*V2Schema`.
- [ ] Remove all public root exports named `*V2`.
- [ ] Remove `ClipV2Schema` from root export.
- [ ] Keep only neutral names:
  - `EffectSchema`
  - `TransformSchema`
  - `AssetSchema`
  - `VariableSchema`
  - `PublicParamSchema`
  - `NodeSchema`
  - `ClipSchema` only if clip is still a real runtime concept.
- [ ] Update README examples so no public import uses V2 names.
- [ ] Add a root API test that fails if `index.ts` exports V2 names.

Acceptance:

- [ ] `rg -n "V2Schema|MotionProjectV2|MotionComponentV2|NormalizedMotionProjectV2|MotionRuntimeIR|ClipV2Schema" packages/motion-protocol/src/index.ts packages/motion-protocol/README.md -S` has no production matches.
- [ ] Generated docs expose only V3/protocol-neutral names.

## Phase 5 - Remove Runtime `sceneOrder`

Purpose: make runtime timeline truly visual-track-first.

Problem:

Runtime schema still accepts optional `timeline.sceneOrder` for backward compatibility.

Tasks:

- [ ] Remove `timeline.sceneOrder` from `MotionRuntimeProjectSchema`.
- [ ] Update runtime tests that still include `sceneOrder`.
- [ ] Update runtime goldens that still include `sceneOrder`.
- [ ] Update desktop/web smoke fixtures that manually build runtime IR with `sceneOrder`.
- [ ] Ensure render worker frame planning reads only `timeline.visualTracks`.
- [ ] Keep V3 invalid tests that reject authoring `sceneOrder`, but make sure they live under V3 validation tests, not runtime production schema.

Acceptance:

- [ ] Runtime IR parse fails if `timeline.sceneOrder` is present.
- [ ] `rg -n "timeline\\.sceneOrder|sceneOrder" packages/motion-protocol/src/runtime packages/motion-runtime/src apps/render-worker/src/runtime apps/desktop/electron/main/services -S` has no production matches.
- [ ] Multi-track runtime fixtures still preview/render correctly.

## Phase 6 - Decide Runtime Format Version

Purpose: remove confusion between V3 authoring format and runtime IR format.

Context:

Runtime currently emits:

```ts
format: "motion-runtime",
formatVersion: 2
```

This can be valid if `formatVersion` means runtime version, not authoring version. But for AI/MCP/Skill users, `formatVersion: 2` can look like V2 leakage.

Options:

- Option A: keep `formatVersion: 2`, but document clearly that runtime format version is independent from authoring V3.
- Option B: bump runtime to `formatVersion: 3` when `sceneOrder` and V2-shaped schemas are removed.
- Option C: rename runtime version field to avoid authoring confusion, for example `runtimeFormatVersion`.

Recommendation:

Use Option B if the runtime shape changes by removing `sceneOrder` and neutralizing runtime primitives. It gives a clean psychological and technical cut:

```text
MotionProject formatVersion: 3
MotionRuntimeProject formatVersion: 3
```

Tasks:

- [ ] Decide the runtime version strategy.
- [ ] If bumping, update `RUNTIME_IR_FORMAT_VERSION`.
- [ ] Update compiler output.
- [ ] Update render worker manifests and tests.
- [ ] Update runtime goldens.
- [ ] Update docs to explain authoring V3 vs runtime IR.

Acceptance:

- [ ] No production runtime fixture accidentally looks like old authoring V2.
- [ ] Docs clearly say runtime IR is generated, not hand-authored by agents unless explicitly supported.

## Phase 7 - Remove Legacy Compiler V2 Path

Purpose: make compiler package V3-only for production.

Problem:

`packages/motion-compiler/src/index.ts` still has an internal `compileMotionProjectV2` path.

Tasks:

- [ ] Identify all callers of the legacy compiler path.
- [ ] Convert remaining callers to `compileMotionProjectV3`.
- [ ] Remove `compileMotionProjectV2`.
- [ ] Remove code paths that sort scenes via `timeline.sceneOrder`.
- [ ] Remove code paths that pass authoring `scene.transition`.
- [ ] Remove V2-shaped test fixtures from compiler tests or move them to archived migration tests outside production packages.
- [ ] Ensure public compiler API accepts V3 authoring project only.

Acceptance:

- [ ] `rg -n "compileMotionProjectV2|project\\.timeline\\.sceneOrder|scene\\.transition" packages/motion-compiler/src -S` has no production matches.
- [ ] Compiler tests still cover:
  - one primary track
  - multiple overlay tracks
  - overlapping clips
  - clip-level transitions
  - audio tracks
  - caption tracks
  - sourceRef mapping

## Phase 8 - Editor And App Fixture Cleanup

Purpose: remove old `sceneOrder` assumptions from editor fixtures and smoke utilities.

Current likely residues:

- Web/editor fixtures may still mention legacy `sceneOrder`.
- Desktop smoke utility may manually construct runtime IR with `sceneOrder`.
- Some README notes still mention legacy fallback behavior.

Tasks:

- [ ] Convert editor fixtures to V3 `timeline.visualTracks`.
- [ ] Replace helpers named around `sceneOrderToTimelineClips` with visual-track-first names.
- [ ] Update `InteractionOverlay` and timeline utilities to read clips from `visualTracks`.
- [ ] Remove comments that describe legacy sidecar + `sceneOrder` as current behavior.
- [ ] Update app smoke probes to construct runtime IR with `visualTracks` only.

Acceptance:

- [ ] App/editor production paths do not need `sceneOrder`.
- [ ] Remaining `sceneOrder` mentions are only negative tests or migration docs.

## Phase 9 - Tighten Architecture Gate

Purpose: turn the gate from a transition gate into a final source-of-truth gate.

Problem:

The current gate passes while allowlisting runtime, compiler legacy path, and some V3 definitions that still contain V2 names.

Tasks:

- [ ] Remove allowlist entries for:
  - `packages/motion-protocol/src/runtime/`
  - `packages/motion-compiler/src/index.ts`
  - `packages/motion-compiler/src/compile-v3.ts`
  - broad V3 primitive files
- [ ] Keep allowlists only for:
  - migration docs
  - negative tests that intentionally verify V2 rejection
  - archived fixtures outside product paths
- [ ] Add hard failures for public root V2 exports.
- [ ] Add hard failures for `sceneOrder` in production runtime/app/compiler files.
- [ ] Add hard failure for `from "./index"` inside V3 implementation files if it imports runtime values and creates barrel cycles.

Acceptance:

- [ ] Gate failure means there is a real V2/source-of-truth leak.
- [ ] Gate pass means production code is V3-clean, not merely allowlisted.

## Phase 10 - Docs And Agent Surface

Purpose: make the AI/MCP/Skill-facing story boringly clear.

Tasks:

- [ ] Update `packages/motion-protocol/README.md`:
  - V3 is the only authoring protocol.
  - Agents should generate `MotionProjectV3`.
  - Agents should use `visualTracks`, not `sceneOrder`.
  - Transitions live on visual clips.
  - Runtime IR is generated by compiler/provider pipeline.
- [ ] Update `docs/motion-format-v3.md` with a clean V3 example.
- [ ] Add a section for provider-neutral rendering:

```text
MotionProjectV3 -> compiler -> runtime -> provider
```

- [ ] Document provider expectations:
  - Pixi preview provider
  - Remotion render provider
  - future canvas/headless provider
  - MCP preview/export provider
- [ ] Add examples for Skills:
  - style skill
  - edit skill
  - template skill
  - validation skill

Acceptance:

- [ ] A human or agent reading docs sees only V3 authoring.
- [ ] Runtime/provider details are clearly separated from authoring JSON.

## Final Definition Of Done

The cleanup is complete when these checks pass:

```powershell
rg -n "compat/parse-v2|src/compat|\\.\\/compat|\\.\\.\\/compat|MotionProjectV2|MotionComponentV2|parseMotionProjectV2|parseMotionComponentV2|serializeMotionProjectV2|NormalizedMotionProjectV2|compileMotionProjectV2" packages apps scripts -S
```

Expected: no production matches.

```powershell
rg -n "\\b\\w+V2Schema\\b|\\b\\w+V2\\b|MOTION_V2_LIMITS" packages/motion-protocol/src packages/motion-compiler/src apps scripts -S
```

Expected: no production matches, except negative tests and migration docs.

```powershell
rg -n "timeline\\.sceneOrder|project\\.timeline\\.sceneOrder|scene\\.transition" packages apps scripts -S
```

Expected: no production matches, except negative tests and migration docs.

Required test suite:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

## Suggested Execution Order

Recommended order:

1. Fix V3 barrel circular imports.
2. Rename `MOTION_V2_LIMITS`.
3. Rename runtime primitive schemas to neutral canonical names.
4. Remove public root V2 exports.
5. Remove runtime `sceneOrder`.
6. Decide and apply runtime format version strategy.
7. Remove legacy compiler V2 path.
8. Clean app/editor fixtures.
9. Tighten architecture gate.
10. Update docs and agent-facing examples.

This order keeps the work safe: first remove import/runtime risks, then clean public API, then delete legacy behavior, then make the gate strict.
