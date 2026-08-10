# Remove Legacy Imports, V3 Only Plan

> Status: detailed cutover plan
>
> Goal: remove every dependency on `packages/motion-protocol/src/legacy/` so the protocol package can delete `legacy/` completely and keep V3 as the only source of truth.

## Current Diagnosis

`legacy/` is not dead code yet. It currently plays four different roles:

- Public barrel export through `packages/motion-protocol/src/index.ts`.
- Shared primitive schemas used by V3 modules.
- Runtime IR schema source through `packages/motion-protocol/src/runtime/project.ts`.
- Temporary tests/helpers for V2 rejection and old text normalization.

So the correct move is not:

```text
delete packages/motion-protocol/src/legacy
```

The safe move is:

```text
move reusable authoring schemas directly into V3 modules
move runtime-only schemas into runtime modules
replace every import from legacy
remove root legacy export
delete V2-only parser/project/component/migration files
delete legacy folder
```

## Source Of Truth Rule

After this refactor:

- Authoring schemas live under `packages/motion-protocol/src/v3/`.
- Runtime schemas live under `packages/motion-protocol/src/runtime/`.
- No extra `primitives/` layer. If a schema is part of authoring, V3 owns it directly.
- V2 parser, V2 project schema, V2 component schema, V2 patch schema, and V2 reference validators are deleted.
- Root package exports V3 and runtime only.

Target import rule:

```text
No file may import from:
packages/motion-protocol/src/legacy
```

Target gate:

```powershell
rg "from .*legacy|\\.\\/legacy|\\.\\.\\/legacy|legacy/" packages/motion-protocol/src packages/motion-compiler/src packages/motion-runtime/src packages/editor-core/src apps scripts -S
```

The command should return no protocol/runtime/compiler production matches.

## Import Inventory

Current direct dependencies that must be moved:

| Current file | Legacy dependency | Replacement target |
| --- | --- | --- |
| `src/index.ts` | `export * from "./legacy"` | remove entirely |
| `src/runtime/project.ts` | `../legacy/runtime` | `src/runtime/project.ts` owns schema |
| `src/runtime/prepared.ts` | `../legacy/prepared-runtime` | `src/runtime/prepared.ts` owns types |
| `src/v3/common.ts` | `../legacy/common` | `src/v3/common.ts` owns copied/renamed schema |
| `src/v3/variables.ts` | `../legacy/values` | `src/v3/values.ts` |
| `src/v3/components.ts` | `../legacy/variables`, `../legacy/values` | `src/v3/variables.ts`, `src/v3/values.ts` |
| `src/v3/timeline.ts` | `../legacy/captions` | `src/v3/captions.ts` |
| `src/v3/scenes.ts` | `../legacy/nodes/structural` | `src/v3/nodes/structural.ts` |
| `src/v3/parse.ts` | `../legacy/normalize-input` | `src/v3/normalize-input.ts` or remove |
| `src/v3/animation/*` | `../../legacy/animation/*` | `src/v3/animation/*` owns schemas |
| `src/v3/nodes/*` | `../../legacy/nodes/*`, `../../legacy/transform`, `../../legacy/effects`, `../../legacy/modifiers` | `src/v3/nodes/*`, `src/v3/transform.ts`, `src/v3/effects.ts`, `src/v3/modifiers.ts` |
| `src/v3/references/*` | `../../legacy/references/*` | `src/v3/references/*` owns helpers/types |
| `src/v3/__tests__/schema.test.ts` | `../../legacy/parse` | root `parseMotionProject()` rejection test |
| `src/capabilities.test.ts` | `./legacy`, `./legacy/parse` | V3 fixtures or dedicated capability fixtures |
| `src/ai-schema-capability.test.ts` | `./legacy/source-ref` | `src/v3/source-ref.ts` or `src/runtime/source-ref.ts` |
| `src/rich-text.test.ts` | `./legacy` | V3 text helpers |

## Phase 1 - Remove Legacy From Public API

Goal: stop exposing V2/legacy from the package root.

Tasks:

- [ ] Remove `export * from "./legacy"` from `packages/motion-protocol/src/index.ts`.
- [ ] Export only canonical V3 APIs from root:
  - `MotionProject`
  - `MotionProjectSchema`
  - `MOTION_FORMAT_VERSION`
  - `parseMotionProject`
  - `serializeMotionProject`
  - `V3`
- [ ] Export runtime APIs from root:
  - `MotionRuntimeProjectSchema`
  - `MotionRuntimeProject`
  - `MotionRuntimeScene`
  - `MotionRuntimeTrack`
- [ ] Do not export `MotionProjectV2`, `parseMotionProjectV2`, `MotionComponentV2`, or `NormalizedMotionProjectV2`.
- [ ] Update scripts that import V2 parser from root:
  - `scripts/score-acceptance-pack.ts`
  - `scripts/validate-acceptance-export.ts`
  - `scripts/validate-acceptance-web-parity.ts`
  - `scripts/validate-runtime-primitives.ts`
- [ ] Either convert these scripts to V3 input or archive/delete them if they are V2-only.

Gate:

- [ ] Root import no longer exposes legacy symbols.
- [ ] `rg "parseMotionProjectV2|parseMotionComponentV2|MotionProjectV2|MotionComponentV2" scripts packages apps -S` has no production matches except deleted/archived files.

## Phase 2 - Move Shared Authoring Schemas Into V3

Goal: remove V3's dependency on `legacy/` without adding a new `primitives/` layer.

Direction:

```text
legacy authoring primitives -> v3/*
legacy runtime schemas      -> runtime/*
```

Create or complete these V3-owned modules:

- `v3/values.ts`: `JsonValueSchema`, `LiteralValueSchema`, `VariableReferenceSchema`, `ResolvableValueSchema`, `ValueKindSchema`.
- `v3/source-ref.ts`: `SourceRefSchema`, `SourceRefKindSchema`, `sourceRefKey` if source refs are authored by V3.
- `v3/transform.ts`: transform schema, renamed away from `TransformV2Schema`.
- `v3/effects.ts`: effect schemas, renamed away from `EffectV2Schema`.
- `v3/modifiers.ts`: motion modifier schemas.
- `v3/captions.ts`: caption track/token schemas.
- `v3/nodes/text-content.ts` or `v3/text.ts`: text content, rich text schemas, text payload helpers.
- `v3/references/helpers.ts`: `duplicates()` and small reference helpers.

Naming rule:

- If a schema is reused by V3, remove `V2` from the exported name.
- Temporary compatibility aliases can exist inside V3 only while refactoring, but must not be root-exported.
- Do not create `src/primitives/`; it adds another layer and works against the chosen direct V3 source-of-truth direction.

Migration tasks:

- [ ] Copy or move `legacy/common.ts` concepts into `v3/common.ts`.
- [ ] Copy or move `legacy/values.ts` into `v3/values.ts`.
- [ ] Copy or move `legacy/source-ref.ts` into `v3/source-ref.ts` if still needed by authoring/capability tests.
- [ ] Copy or move `legacy/transform.ts` into `v3/transform.ts`.
- [ ] Copy or move `legacy/effects.ts` into `v3/effects.ts`.
- [ ] Copy or move `legacy/modifiers.ts` into `v3/modifiers.ts`.
- [ ] Copy or move `legacy/captions.ts` into `v3/captions.ts`.
- [ ] Copy or move text content helpers from `legacy/nodes/text.ts` into V3 text modules.
- [ ] Copy or move reference helper functions from `legacy/references/helpers.ts` into `v3/references/helpers.ts`.
- [ ] Update V3 imports one group at a time.

Gate:

- [ ] `src/v3/*` imports from V3-local modules, not `../legacy/*`.
- [ ] Tests cover text payload, JSON value, source ref, transform, paint, and reference helper behavior through V3 exports.

## Phase 3 - Move Runtime IR Out Of Legacy

Goal: runtime schema must be owned by `src/runtime`, not aliased from legacy.

Tasks:

- [ ] Move schema definitions from `src/legacy/runtime.ts` into `src/runtime/project.ts`.
- [ ] Rename `NormalizedMotionProjectV2Schema` to `MotionRuntimeProjectSchema`.
- [ ] Rename exported types:
  - `NormalizedMotionProjectV2` -> `MotionRuntimeProject`
  - `MotionRuntimeIR` -> delete alias or keep only internally during refactor
- [ ] Keep runtime `format: "motion-runtime"`.
- [ ] Keep `formatVersion: 2` only if it means runtime IR v2, not authoring V2.
- [ ] Prefer adding/keeping `runtimeVersion` as the real runtime evolution marker.
- [ ] Move prepared runtime definitions from `legacy/prepared-runtime.ts` to `runtime/prepared.ts`.
- [ ] Update all imports from `@motionvideo/motion-protocol` to use canonical runtime names only.
- [ ] Remove runtime exports of `NormalizedMotionProjectV2Schema` and `NormalizedMotionProjectV2`.

Gate:

- [ ] `rg "NormalizedMotionProjectV2" packages apps scripts -S` has no production matches.
- [ ] `packages/motion-protocol/src/runtime/project.ts` does not import from `legacy`.
- [ ] Runtime schema tests pass from `src/runtime/__tests__/`.

## Phase 4 - Make V3 Own Animation Schemas

Goal: V3 animation should not borrow from legacy animation modules.

Move or rewrite:

- [ ] `legacy/animation/easing.ts` -> `v3/animation/easing.ts`
- [ ] `legacy/animation/tracks.ts` -> `v3/animation/tracks.ts`
- [ ] `legacy/animation/clips.ts` -> `v3/animation/clips.ts`
- [ ] `legacy/animation/drivers.ts` -> `v3/animation/drivers.ts`

Rename:

- [ ] `KeyframeEasingV2Schema` -> `KeyframeEasingSchema`
- [ ] `ProceduralDriverV2` -> `ProceduralDriver`
- [ ] `ClipV2Schema` -> `SceneClipSchema` or `AnimationClipSchema`
- [ ] `TrackV2Schema` -> `AnimationTrackSchema`

Gate:

- [ ] `src/v3/animation/*` has no import from `legacy`.
- [ ] Compiler tests still pass because scene clips/tracks are structurally unchanged.

## Phase 5 - Make V3 Own Node Schemas

Goal: V3 nodes should be self-contained.

Move or rewrite:

- [ ] `legacy/transform.ts` -> `v3/transform.ts`
- [ ] `legacy/nodes/base.ts` -> `v3/nodes/base.ts`
- [ ] `legacy/nodes/text.ts` -> `v3/nodes/text.ts` plus optional `v3/nodes/text-content.ts`
- [ ] `legacy/nodes/paint.ts` -> `v3/nodes/paint.ts` or `v3/paint.ts`
- [ ] `legacy/nodes/geometry.ts` -> `v3/nodes/geometry.ts`
- [ ] `legacy/nodes/media.ts` -> `v3/nodes/media.ts`
- [ ] `legacy/nodes/structural.ts` -> `v3/nodes/structural.ts`
- [ ] `legacy/effects.ts` -> `v3/effects.ts`
- [ ] `legacy/modifiers.ts` -> `v3/modifiers.ts`

Rename:

- [ ] `TransformV2Schema` -> `TransformSchema`
- [ ] `NodeTimingV2Schema` -> `NodeTimingSchema`
- [ ] `PointV2Schema` -> `PointSchema`
- [ ] `TextNodeV2Schema` -> `TextNodeSchema`
- [ ] `ImageNodeV2Schema` -> `ImageNodeSchema`
- [ ] `SvgNodeV2Schema` -> `SvgNodeSchema`
- [ ] `VideoNodeV2Schema` -> `VideoNodeSchema`
- [ ] `CameraNodeV2Schema` -> `CameraNodeSchema`
- [ ] `EffectV2Schema` -> `EffectSchema`

Gate:

- [ ] `src/v3/nodes/*` has no import from `legacy`.
- [ ] V3 schema fixtures still parse.
- [ ] Rich text tests import from V3, not legacy.

## Phase 6 - Make V3 Own Variables, Captions, Components

Goal: V3 data model owns project-level concepts.

Tasks:

- [ ] Move `JsonValueSchema` usage to `v3/values.ts`.
- [ ] Replace `VariableV2Schema` with V3-native `ProjectVariableV3Schema`.
- [ ] Replace `PublicParamV2Schema` with `ComponentPublicParamSchema`.
- [ ] Move `CaptionTrackSchema` from `legacy/captions.ts` to `v3/captions.ts`.
- [ ] Update `v3/timeline.ts` to import captions from `./captions`.
- [ ] Update `v3/components.ts` to import variables from `./variables` or a V3 component-param module.

Gate:

- [ ] `src/v3/components.ts`, `src/v3/variables.ts`, and `src/v3/timeline.ts` have no import from `legacy`.

## Phase 7 - Move Reference Helpers

Goal: V3 reference validation owns its helpers.

Tasks:

- [ ] Move `ReferenceIssue` to `src/v3/references/types.ts`.
- [ ] Move `duplicates()` to `src/v3/references/helpers.ts`.
- [ ] Update `src/v3/references/project.ts`.
- [ ] Update `src/v3/references/node-graph.ts`.
- [ ] Delete legacy reference validators after V2 parser is gone.

Gate:

- [ ] `src/v3/references/*` has no import from `legacy`.

## Phase 8 - Remove Legacy Normalization From V3 Parse

Goal: V3 parse should normalize V3-compatible text only, not accept V2 projects.

Current dependency:

```ts
import { normalizeLegacyMotionInput } from "../legacy/normalize-input";
```

Options:

- Preferred: replace with `normalizeV3MotionInput()` in `src/v3/normalize-input.ts`.
- Strict option: remove normalization entirely and require valid V3 shape.

Recommended decision:

- Keep text payload normalization only if V3 intentionally supports both rich text and plain text shorthand.
- Do not keep broad V2 shape normalization.
- Keep `parseMotionProject()` rejecting `formatVersion: 2`.

Gate:

- [ ] `src/v3/parse.ts` has no import from `legacy`.
- [ ] Test confirms `formatVersion: 2` is rejected by root parser.
- [ ] Test confirms valid V3 text payload parses.

## Phase 9 - Remove V2 Parser/Project/Component/Patch

Goal: delete all authoring V2 code.

Delete after previous phases:

```text
packages/motion-protocol/src/legacy/parse.ts
packages/motion-protocol/src/legacy/project.ts
packages/motion-protocol/src/legacy/component.ts
packages/motion-protocol/src/legacy/patch.ts
packages/motion-protocol/src/legacy/references/
packages/motion-protocol/src/legacy/index.ts
```

Update tests:

- [ ] Replace `parseMotionProjectV2` tests with root `parseMotionProject()` V2 rejection tests.
- [ ] Convert capability tests to V3 fixtures.
- [ ] Convert AI schema capability tests to `v3/source-ref` or canonical V3/runtime source refs.
- [ ] Delete V2 migration/rejection-only tests once root parser rejection is covered.

Gate:

- [ ] `rg "parseMotionProjectV2|MotionProjectV2|MotionComponentV2|MotionPatchSchema|applyMotionPatch" packages/motion-protocol/src packages apps scripts -S` has no production matches.

## Phase 10 - Compiler Direct V3 Cleanup

Goal: compiler should not depend on V2-shaped internal project assumptions.

Current issue:

- `compile-v3.ts` still has `downMigrate*()` helpers.
- It still builds `sceneOrder`.
- It still creates runtime IR with `formatVersion: 2`.
- It still maps visual clip transition through `scene.transition` in the internal shape.

Tasks:

- [ ] Replace `downMigrateProject()` with `buildRuntimePlanFromV3()`.
- [ ] Build runtime visual tracks directly from `project.timeline.visualTracks`.
- [ ] Compile each visual clip from its source scene/component without generating V2 `sceneOrder`.
- [ ] Use `clip.transitionIn` / `clip.transitionOut` directly.
- [ ] Keep reusable scene pipeline helpers if they are schema-neutral.
- [ ] Rename `_compileScenePipeline` to a neutral public/private helper, for example `compileSceneToRuntimeTracks`.
- [ ] Remove `compileMotionProjectV2()` completely from `motion-compiler/src/index.ts`.

Gate:

- [ ] `rg "downMigrate|sceneOrder|scene\\.transition|formatVersion:\\s*2" packages/motion-compiler/src -S` has no production V2-authoring matches.
- [ ] Compiler tests assert `timeline.visualTracks`, not `timeline.sceneOrder`.

## Phase 11 - Delete Legacy Folder

Goal: remove `packages/motion-protocol/src/legacy/` completely.

Pre-delete checklist:

- [ ] `rg "from .*legacy|\\.\\/legacy|\\.\\.\\/legacy|legacy/" packages/motion-protocol/src packages/motion-compiler/src packages/motion-runtime/src packages/editor-core/src apps scripts -S` returns no relevant matches.
- [ ] Root `index.ts` does not export legacy.
- [ ] Runtime schema is owned by `src/runtime`.
- [ ] V3 schema is self-contained.
- [ ] Compiler no longer down-migrates to V2-shaped authoring.
- [ ] Scripts no longer import V2 parsers.
- [ ] Tests no longer import legacy parser/schema helpers.

Delete:

```text
packages/motion-protocol/src/legacy/
```

Then remove allowlist entries from:

```text
scripts/validate-v3-source-of-truth.ts
```

Remove these allowlist concepts:

- `packages/motion-protocol/src/legacy/`
- runtime re-exports from legacy
- protocol tests referencing legacy parser
- compiler direct-V3 pending exception, once compiler is clean

Gate:

- [ ] `validate-v3-source-of-truth` passes with no legacy allowlist.
- [ ] Protocol tests pass.
- [ ] Compiler tests pass.
- [ ] Runtime tests pass.
- [ ] Renderer parity tests pass.

## Suggested PR Order

1. `legacy-00-public-api`: remove root `export * from "./legacy"` and fix external imports.
2. `legacy-01-v3-shared-schemas`: move common/json/source-ref/text/paint/effects/modifier helpers into `src/v3`.
3. `legacy-02-runtime`: move runtime schema/prepared runtime into `src/runtime`.
4. `legacy-03-animation`: make V3 animation schemas self-owned.
5. `legacy-04-nodes`: make V3 node schemas self-owned.
6. `legacy-05-project-concepts`: move variables/captions/components helpers to V3.
7. `legacy-06-references-parse`: move reference helpers and V3 normalization.
8. `legacy-07-delete-v2-authoring`: delete V2 parser/project/component/patch/reference validators.
9. `legacy-08-compiler-direct-v3`: remove down-migration and sceneOrder assumptions.
10. `legacy-09-delete-folder`: delete `src/legacy` and tighten architecture gate.

## Test Matrix

Run after each PR:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/playback-engine test
pnpm.cmd --filter @motionvideo/pixi-renderer test
pnpm.cmd --filter @motionvideo/remotion-renderer test
pnpm.cmd --filter @motionvideo/render-contracts test
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

Run full typecheck before deleting the folder:

```powershell
pnpm.cmd typecheck
```

## Definition Of Done

Legacy removal is complete when:

- [ ] `packages/motion-protocol/src/legacy/` no longer exists.
- [ ] No source file imports from `legacy`.
- [ ] Root protocol package exports V3 and runtime only.
- [ ] V3 schemas own all authoring concepts.
- [ ] Runtime schemas live under `src/runtime`.
- [ ] Compiler builds runtime IR from V3 directly.
- [ ] Scripts and tests no longer use V2 parser/component/schema names.
- [ ] Architecture gate passes without legacy allowlist.
