# Remove V2, Keep V3 As Source Of Truth

> Status: implementation plan after V3 completion review
>
> Decision: V3 is the only authoring source of truth. V2 should no longer be a public product format, compiler path, editor format, AI target, or runtime-facing naming model.

## Short Evaluation

V3 is in a good place as an authoring protocol:

- `MotionProject` already aliases `MotionProjectV3`.
- `MotionProjectSchema` already aliases `MotionProjectV3Schema`.
- `MOTION_FORMAT_VERSION` is already `3`.
- `parseMotionProject()` already parses V3 through `parseMotionProjectV3()`.
- `packages/motion-protocol/src/v3/` has schema modules, fixtures, parse tests, reference tests, migrations, and canonical hash utilities.
- `packages/motion-compiler/src/compile-v3.ts` exists and V3 compiler tests pass.

But V3 is not yet the only source of truth for the whole runtime system:

- `motion-protocol` still exports `./v2` from the root barrel.
- `parse-any` and `migrateMotionProjectV2ToV3` are still exported from the public root.
- `compileMotionProjectV3()` still down-migrates V3 into a V2-shaped project and calls `compileMotionProjectV2()`.
- The runtime schema is still physically located under `src/v2/runtime.ts`, even though `MotionRuntimeProject` is now the better public name.
- Several packages still use V2 project fixtures, `timeline.sceneOrder`, `scene.transition`, and V2 parser/compiler APIs.
- Root scripts still include `validate:v2-fixtures`, `update:v2-goldens`, and `update:v2-frame-goldens`.

So the honest state is:

```text
V3 is canonical at the authoring API boundary.
V2 is still the hidden compatibility spine for compiler/runtime/tests.
```

The removal plan should therefore remove V2 in layers, not by deleting `src/v2` first.

## Target Architecture

```text
MotionProject V3
  -> compileMotionProject()
  -> MotionRuntimeProject
  -> motion-runtime evaluation
  -> Pixi preview / Remotion export / playback-engine / render-worker
```

Rules:

- V3 authoring JSON is the only persisted project format.
- Runtime IR is generated output, not authoring JSON.
- Editor UI state stays outside project JSON.
- Pixi and Remotion may render differently internally, but both must consume the same `MotionRuntimeProject` / evaluated frame contract.
- Compiler remains necessary because V3 authoring and runtime render contracts do different jobs.

## V2 Removal Allowlist

During the cutover, V2 references are allowed only in one temporary place:

```text
packages/motion-protocol/src/legacy-v2/
```

Allowed contents:

- one private V2 parser if needed to convert local fixtures
- one private V2-to-V3 migration helper if needed during the cutover
- migration tests marked as temporary

Not allowed:

- root exports of V2 types
- app imports from V2
- renderer tests loading V2 fixtures
- compiler V3 path calling `compileMotionProjectV2()`
- production code reading `timeline.sceneOrder`
- production code reading `scene.transition`

Final state:

```text
rg "MotionProjectV2" packages apps scripts
rg "NormalizedMotionProjectV2" packages apps scripts
rg "parseMotionProjectV2" packages apps scripts
rg "compileMotionProjectV2" packages apps scripts
rg "timeline.sceneOrder" packages apps scripts
rg "scene.transition" packages apps scripts
```

All should return no production matches.

## Phase 1 - Seal Protocol Public API

Goal: make V2 unreachable from normal package imports.

Tasks:

- [ ] Remove `export * from "./v2"` from `packages/motion-protocol/src/index.ts`.
- [ ] Remove `export * from "./parse-any"` from the root barrel.
- [ ] Remove root export of `migrateMotionProjectV2ToV3`.
- [ ] Keep `V3` namespace export.
- [ ] Keep direct exports for `MotionProject`, `MotionProjectSchema`, `parseMotionProject`, `serializeMotionProject`.
- [ ] Make `parseMotionProject()` reject `formatVersion: 2`.
- [ ] Move V2 migration code into a temporary internal path if fixture conversion still needs it.
- [ ] Update `schema-files.test.ts` so `schema/v3.json` is the canonical schema file.
- [ ] Stop generating `schema/v2.json`.
- [ ] Delete `packages/motion-protocol/schema/v2.json` after no test requires it.

Gate:

- [ ] `@motionvideo/motion-protocol` root import exposes V3 only.
- [ ] No app/package can import `parseMotionProjectV2` from the package root.
- [ ] Protocol tests pass.

## Phase 2 - Move Runtime Schema Out Of V2

Goal: make runtime IR a neutral generated contract, not a V2 artifact.

Tasks:

- [ ] Create `packages/motion-protocol/src/runtime/`.
- [ ] Move runtime schema from `src/v2/runtime.ts` to `src/runtime/project.ts`.
- [ ] Export canonical names:
  - `MotionRuntimeProjectSchema`
  - `MotionRuntimeProject`
  - `MotionRuntimeScene`
  - `MotionRuntimeTrack`
  - `PreparedRuntimeProject`
- [ ] Remove or deprecate `NormalizedMotionProjectV2Schema` aliases inside production imports.
- [ ] Keep `format: "motion-runtime"`.
- [ ] Decide whether runtime `formatVersion` stays `2` temporarily or becomes a separate `runtimeVersion`.
- [ ] Prefer `runtimeVersion` for runtime IR evolution so authoring `formatVersion: 3` does not get confused with runtime format version.
- [ ] Update runtime schema tests to live under `src/runtime/__tests__/`.

Gate:

- [ ] Production code imports `MotionRuntimeProjectSchema`, not `NormalizedMotionProjectV2Schema`.
- [ ] Runtime tests pass.
- [ ] `rg "NormalizedMotionProjectV2" packages apps scripts` has no production matches.

## Phase 3 - Replace V2 Fixtures With V3 Fixtures

Goal: tests prove V3 behavior directly.

Tasks:

- [ ] Convert `packages/motion-protocol/src/__fixtures__/v2` into V3 equivalents.
- [ ] Convert compiler snapshot fixtures to V3.
- [ ] Convert Pixi/Remotion parity fixtures to V3 runtime fixtures.
- [ ] Convert motion-runtime frame fingerprint fixtures to V3-compiled runtime fixtures.
- [ ] Convert web/editor fixtures to V3.
- [ ] Convert desktop smoke project fixture to V3.
- [ ] Remove tests named `parity-v2-fixture`.
- [ ] Rename goldens:
  - `v2-compile-goldens` -> `runtime-compile-goldens`
  - `v2-frame-goldens` -> `runtime-frame-goldens`
- [ ] Replace root scripts:
  - `validate:v2-fixtures` -> `validate:motion-fixtures`
  - `update:v2-goldens` -> `update:runtime-goldens`
  - `update:v2-frame-goldens` -> `update:runtime-frame-goldens`

Gate:

- [ ] `rg "formatVersion: 2" packages apps scripts` has no authoring fixture matches.
- [ ] `rg "\"formatVersion\": 2" packages apps scripts` only matches runtime IR fixtures if runtime version remains `2`.
- [ ] Renderer parity tests pass on V3-derived runtime input.

## Phase 4 - Make Compiler V3 Direct

Goal: remove the biggest hidden dependency: V3 compiling by down-migrating to V2.

Current problem:

```text
compileMotionProjectV3()
  -> downMigrateProject()
  -> compileMotionProjectV2()
  -> MotionRuntimeProject
```

Target:

```text
compileMotionProject()
  -> validate V3
  -> build visual composition plan from timeline.visualTracks
  -> expand scenes/components/presets/bindings/layout/captions
  -> emit MotionRuntimeProject
```

Tasks:

- [ ] Rename the current V2 compiler internals into private helpers where useful.
- [ ] Extract reusable pure helpers that are not V2-specific:
  - schedule resolution
  - playback expansion
  - preset expansion
  - component expansion
  - text animator expansion
  - layout solver
  - caption compiler
- [ ] Delete `downMigrateProject()` from `compile-v3.ts`.
- [ ] Delete V3-to-V2 field mapping helpers after direct compile exists.
- [ ] Make `compileMotionProject()` accept only `MotionProjectV3`.
- [ ] Make `compileMotionProjectV3()` either a thin alias or remove it.
- [ ] Remove `compileMotionProjectV2()` from public exports.
- [ ] Compile `timeline.visualTracks` into runtime composition/layer plan.
- [ ] Map visual clip transitions from `transitionIn` / `transitionOut`, not `scene.transition`.
- [ ] Emit runtime `sourceRef` paths pointing back to V3 locations.
- [ ] Emit compile diagnostics using V3 paths, for example `timeline.visualTracks[0].clips[2]`.

Gate:

- [ ] `compile-v3.ts` no longer imports `compileMotionProjectV2`.
- [ ] `compileMotionProjectV3` tests no longer assert `timeline.sceneOrder`.
- [ ] Compiler tests pass.
- [ ] Runtime IR validates with canonical `MotionRuntimeProjectSchema`.

## Phase 5 - Runtime Timeline Cutover

Goal: runtime evaluates the V3 visual timeline model.

Tasks:

- [ ] Replace runtime use of `runtime.timeline.sceneOrder`.
- [ ] Add or finalize runtime visual layer/clip plan.
- [ ] Evaluate active visual clips at composition time.
- [ ] Resolve clip-local time from:
  - clip start
  - duration
  - trimStart
  - playbackRate
  - loop
  - source scene duration
- [ ] Evaluate main track and overlay tracks deterministically.
- [ ] Move transitions from scene-level to visual-clip-level.
- [ ] Update `evaluate-composition.ts`.
- [ ] Update `resolve-timeline.ts`.
- [ ] Update transition fixtures.
- [ ] Update hit-test and paint plans to use the same evaluated frame output.

Gate:

- [ ] `rg "timeline.sceneOrder" packages/motion-runtime apps packages -S` has no production runtime matches.
- [ ] `rg "scene.transition" packages/motion-runtime apps packages -S` has no production runtime matches.
- [ ] Motion runtime tests pass.

## Phase 6 - Renderer And Render Worker Cutover

Goal: Pixi, Remotion, and worker render from the same runtime contract.

Tasks:

- [ ] Update `apps/render-worker/src/runtime/frame-plan.ts` to use visual clip transition data.
- [ ] Update `cli-contact-sheet.ts` to parse V3 through `parseMotionProject`.
- [ ] Update render worker compile entry to accept V3 only.
- [ ] Update Pixi parity tests to use V3-derived runtime.
- [ ] Update Remotion parity tests to use V3-derived runtime.
- [ ] Ensure Pixi preview and Remotion export receive equivalent evaluated frame data.
- [ ] Keep renderer packages free of authoring V2 imports.

Gate:

- [ ] Pixi tests pass.
- [ ] Remotion tests pass.
- [ ] Render worker smoke/e2e uses V3 input.

## Phase 7 - Editor And AI Cutover

Goal: no user-facing path creates, edits, accepts, or upgrades V2.

Tasks:

- [ ] Update editor project fixtures to V3.
- [ ] Update `build-export-project` to output V3 or compile from V3.
- [ ] Update timeline selectors from `sceneOrder` to `visualTracks`.
- [ ] Update timeline mutations to edit visual clips.
- [ ] Update transition commands to write clip transitions.
- [ ] Update desktop project validation to reject V2 instead of migrating it.
- [ ] Update web runtime parsing to reject V2 instead of migrating it.
- [ ] Update AI generation route to return V3 directly and remove migration fallback.
- [ ] Update AI command executor from `timeline.sceneOrder` and `scene.transition` to V3 visual tracks.

Gate:

- [ ] Editor creates V3.
- [ ] Editor saves V3.
- [ ] AI generates V3.
- [ ] AI patches V3.
- [ ] Apps do not import `migrateMotionProjectV2ToV3`.

## Phase 8 - Delete V2 Files

Goal: remove the old model after all consumers are off it.

Delete candidates:

- [ ] `packages/motion-protocol/src/v2.ts`
- [ ] `packages/motion-protocol/src/v2/`
- [ ] `packages/motion-protocol/src/__fixtures__/v2/`
- [ ] `packages/motion-protocol/schema/v2.json`
- [ ] `packages/motion-protocol/src/parse-any.ts`
- [ ] `packages/motion-protocol/src/v3/migrations/`
- [ ] V2 migration fixtures under `packages/motion-protocol/src/v3/__fixtures__/migration/`
- [ ] V2 migration tests under `packages/motion-protocol/src/v3/__tests__/migration.test.ts`
- [ ] scripts named `validate-motion-v2-fixtures`, `update-motion-v2-goldens`, `update-motion-v2-frame-goldens`
- [ ] README sections that describe V2 as canonical

Gate:

- [ ] `rg "MotionProjectV2" packages apps scripts docs` only matches this deletion plan, or returns nothing after this file is archived.
- [ ] `rg "parseMotionProjectV2" packages apps scripts docs` only matches this deletion plan, or returns nothing after this file is archived.
- [ ] `rg "compileMotionProjectV2" packages apps scripts docs` only matches this deletion plan, or returns nothing after this file is archived.
- [ ] `rg "__fixtures__/v2|__fixtures__\\\\v2" packages apps scripts docs` only matches this deletion plan, or returns nothing after this file is archived.

## Phase 9 - Enforcement

Goal: prevent V2 from creeping back.

Tasks:

- [ ] Add an architecture check script, for example `scripts/validate-v3-source-of-truth.ts`.
- [ ] Fail if production code contains:
  - `MotionProjectV2`
  - `NormalizedMotionProjectV2`
  - `parseMotionProjectV2`
  - `compileMotionProjectV2`
  - `timeline.sceneOrder`
  - `scene.transition`
  - `migrateMotionProjectV2ToV3`
- [ ] Allow matches only in archived docs, if any.
- [ ] Add the check to CI/package validation.
- [ ] Update package READMEs to describe V3-only flow.

Gate:

- [ ] V3-only architecture check passes.
- [ ] Full package test matrix passes.

## Recommended PR Order

1. `v3-only-protocol-api`: remove V2 root exports and make V3-only parsing explicit.
2. `runtime-schema-neutral`: move runtime schema out of `src/v2` and rename runtime APIs.
3. `v3-fixtures`: convert fixtures/goldens/scripts away from V2 naming.
4. `compiler-direct-v3`: remove V3 down-migration and public V2 compiler.
5. `runtime-visual-tracks`: replace `sceneOrder` and scene transitions in runtime evaluation.
6. `renderers-v3-runtime`: update Pixi, Remotion, playback, and render-worker tests/inputs.
7. `editor-ai-v3-only`: update editor and AI to create/patch V3 only.
8. `delete-v2`: remove V2 files, migration helpers, schemas, and stale docs.
9. `v3-architecture-gate`: add checks so V2 cannot come back accidentally.

## Test Matrix

Run after every PR:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/playback-engine test
pnpm.cmd --filter @motionvideo/pixi-renderer test
pnpm.cmd --filter @motionvideo/remotion-renderer test
pnpm.cmd --filter @motionvideo/render-contracts test
```

Run after app/editor cutover:

```powershell
pnpm.cmd --filter @motionvideo/editor-core test
pnpm.cmd --filter @motionvideo/web test
pnpm.cmd --filter @motionvideo/desktop test
pnpm.cmd --filter @motionvideo/render-worker test
```

## Definition Of Done

V2 removal is complete when:

- [ ] V3 is the only accepted authoring project format.
- [ ] `MotionProject` means V3 everywhere.
- [ ] `parseMotionProject()` rejects V2.
- [ ] No production code imports V2 protocol APIs.
- [ ] Compiler no longer down-migrates V3 to V2.
- [ ] Runtime IR is named and exported independently of V2.
- [ ] Runtime no longer evaluates `timeline.sceneOrder`.
- [ ] Transitions live on visual clips, not scenes.
- [ ] Editor and AI create/patch V3 only.
- [ ] Pixi and Remotion render from the same runtime/evaluated contract.
- [ ] V2 schema, fixtures, migration helpers, and scripts are deleted.
- [ ] Architecture guard prevents V2 references from returning.
