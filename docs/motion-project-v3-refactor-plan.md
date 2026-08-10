# Motion Project V3 Cutover Plan

> Status: direct cutover plan
>
> Source design: [`json-project-design.md`](../json-project-design.md)
>
> Decision: the product has not shipped real projects yet, so v3 becomes the canonical format now. We do not need a long v2 compatibility/migration period.

## Goal

Move the whole system to Motion Project v3 as the only authoring project format.

```text
MotionProject v3
  -> motion-compiler
  -> MotionRuntime IR
  -> motion-runtime evaluateCompositionFrame
  -> Pixi preview / Remotion export / playback-engine
```

Important distinction:

```text
MotionProject v3 is the source of truth.
MotionRuntime IR is generated output.
Editor UI state lives outside project JSON.
```

## Current Repo Notes

The repo already has `@motionvideo/motion-protocol`, and there are signs of partial v3 work:

- `packages/motion-protocol/src/v3/`
- `packages/motion-protocol/schema/v3.json`
- `packages/motion-compiler/src/compile-v3.ts`
- tests and docs that still mention v2 compatibility

This plan changes the direction from gradual compatibility to direct replacement.

## What Changes Now

Remove v2 as a first-class path:

- `MotionProject` should mean `MotionProjectV3`.
- `MotionProjectSchema` should mean `MotionProjectV3Schema`.
- `parseMotionProject()` should accept v3 only.
- New editor projects should be v3 only.
- AI generation should target v3 only.
- Compiler should accept v3 as the canonical input.
- Runtime, Pixi, Remotion, playback, and render-worker should consume runtime IR, not v2 authoring JSON.

Keep v2 only as temporary scaffolding while converting local fixtures/demo data. Once equivalent v3 fixtures exist, delete v2 production exports and tests.

## Target Package Responsibilities

| Package | Responsibility after cutover |
| --- | --- |
| `@motionvideo/motion-protocol` | v3 authoring schema, runtime IR schema, limits, capabilities, references, patch schema, JSON Schema |
| `@motionvideo/motion-compiler` | v3 authoring -> runtime IR, tokens/variables/components/layout/presets/captions expansion |
| `@motionvideo/motion-runtime` | timeline evaluation, composition frame, projection, paint/audio/media plans, hit-test, diagnostics |
| `@motionvideo/playback-engine` | playback clock and frame scheduling over runtime IR |
| `@motionvideo/pixi-renderer` | preview painter over evaluated frame / paint contract |
| `@motionvideo/remotion-renderer` | export painter over the same evaluated frame / paint contract |
| `@motionvideo/render-contracts` | render job, manifest, worker protocol |
| `@motionvideo/editor-core` | editor commands, selection, history, v3 project transactions |

## Target V3 Authoring Shape

Canonical root:

```ts
type MotionProject = MotionProjectV3;
```

Target root:

```ts
type MotionProjectV3 = {
  format: "motion-project";
  formatVersion: 3;
  metadata: ProjectMetadata;
  composition: CompositionSettings;
  capabilities: ProjectCapabilityRequirements;
  dependencies: ProjectDependencies;
  tokens: DesignTokens;
  variables: ProjectVariable[];
  assets: AssetDeclaration[];
  components: EmbeddedComponent[];
  scenes: SceneDefinition[];
  timeline: ProjectTimeline;
  bindings: ProjectBinding[];
  provenance?: ProjectProvenance;
  extensions?: Record<string, JsonValue>;
};
```

Main differences from v2:

| Area | v2 | v3 |
| --- | --- | --- |
| Composition | `metadata.aspectRatio` + `metadata.fps` | `composition.width/height/fps/background/audioSampleRate` |
| Brand/tokens | `metadata.brand` / `metadata.designTokens` | top-level `tokens` |
| Visual timeline | `timeline.sceneOrder` | `timeline.visualTracks[].clips[]` |
| Transition | `scene.transition` | `visualClip.transitionIn/transitionOut` |
| Components | dependency plus component node | embedded/flattened portable component profile |
| Audio | partial lifetime/rate | explicit duration, trim, playbackRate |
| Workspace | not formalized | `motion-workspace` manifest and linker |

## Phase 1 - Make V3 Canonical In Protocol

Purpose: stop the main API from pointing at v2.

Tasks:

- [ ] Confirm/complete `packages/motion-protocol/src/v3/` schema modules.
- [ ] Export `MotionProjectV3Schema` and `MotionProjectV3`.
- [ ] Change `MotionProject = MotionProjectV3`.
- [ ] Change `MotionProjectSchema = MotionProjectV3Schema`.
- [ ] Change `MOTION_FORMAT_VERSION = 3`.
- [ ] Change `parseMotionProject()` to parse v3 only.
- [ ] Change `serializeMotionProject()` to serialize v3 only.
- [ ] Move v2 exports behind explicit legacy names or remove them from the main barrel.
- [ ] Make canonical parser reject `formatVersion: 2`.

Gate:

- [ ] Minimal v3 project parses.
- [ ] Representative v3 project parses.
- [ ] `parseMotionProject({ formatVersion: 2, ... })` fails.
- [ ] Unknown fields reject except allowed namespaced `extensions`.

## Phase 2 - Finish V3 Schema Coverage

Purpose: make the v3 schema complete enough for editor and AI.

Tasks:

- [ ] `metadata`: identity-only fields.
- [ ] `composition`: width, height, fps, background, colorSpace, audioSampleRate, safeArea, motionBlur.
- [ ] `capabilities`: required, optional, experimental.
- [ ] `tokens`: colors, fonts, spacing, radii, motion.
- [ ] `variables`: string, color, number, boolean, asset, enum, list.
- [ ] `assets`: image, svg, video, audio, font with integrity and metadata.
- [ ] `components`: embedded component definitions and bundle profiles.
- [ ] `scenes`: scene definitions without `scene.transition`.
- [ ] `timeline`: visualTracks, audioTracks, captionTracks, markers, workArea.
- [ ] `nodes`: reuse valid node primitives but align imports/types with v3.
- [ ] `animation`: keep scene-local clips/tracks for node animation.
- [ ] `extensions`: namespaced JSON records.
- [ ] `provenance`: source map and bundle profile metadata.
- [ ] `references`: v3 cross-reference validation.
- [ ] Generate/update `packages/motion-protocol/schema/v3.json`.

Gate:

- [ ] Positive fixtures cover every top-level v3 field.
- [ ] Negative fixtures cover duplicate IDs, missing refs, invalid clip ranges, invalid asset refs, invalid capability IDs.
- [ ] JSON Schema output is usable by AI/tooling.

## Phase 3 - Convert Fixtures And Project Creation

Purpose: stop the repo from creating or relying on v2 projects.

Tasks:

- [ ] Convert minimal fixture to v3.
- [ ] Convert representative/demo projects to v3.
- [ ] Convert large timeline fixture to v3 visual tracks.
- [ ] Convert render-worker smoke project to v3.
- [ ] Convert AI planner fixtures to v3.
- [ ] Convert web/desktop create-blank-project helpers to v3.
- [ ] Delete v2 fixture snapshots once v3 equivalents pass.

Temporary allowance:

```ts
convertV2FixtureToV3(input)
```

Use this only to port local test/demo data. Do not expose it as the product migration strategy.

Gate:

- [ ] New project creation emits `formatVersion: 3`.
- [ ] `rg "formatVersion: 2"` finds no production fixtures.
- [ ] `rg '"formatVersion": 2'` finds no production fixtures.

## Phase 4 - Compiler Cutover

Purpose: make `motion-compiler` compile v3 directly.

Tasks:

- [ ] Make `compileMotionProject(project)` accept canonical `MotionProjectV3`.
- [ ] Keep `compileMotionProjectV3` only if it helps during the transition, then fold it into `compileMotionProject`.
- [ ] Remove down-migration from v3 to v2 inside compiler.
- [ ] Compile `composition` into runtime composition metadata.
- [ ] Compile `timeline.visualTracks` into runtime composition plan.
- [ ] Compile visual clips:
  - scene source
  - component source
  - start
  - duration
  - trimStart
  - playbackRate
  - loop
  - opacity
  - transitionIn/transitionOut
- [ ] Resolve tokens, variables, and bindings before runtime IR.
- [ ] Flatten/namespace components according to bundle profile.
- [ ] Expand presets/actions into literal tracks.
- [ ] Expand repeaters.
- [ ] Bake compile-time layout.
- [ ] Bake caption cues if runtime expects cue windows.
- [ ] Emit structured diagnostics with v3 project paths/source refs.
- [ ] Include protocol version, compiler version, capability version, project hash, and dependency hashes in compile fingerprints.

Gate:

- [ ] Minimal v3 project compiles.
- [ ] Representative v3 project compiles.
- [ ] Runtime IR contains no unresolved variable/component/layout/preset.
- [ ] Compile output validates against runtime schema.
- [ ] Compiler no longer calls v2 compiler for v3 input.

## Phase 5 - Runtime IR Naming And Shape

Purpose: remove v2 naming from runtime-facing contracts.

Preferred public names:

```ts
type MotionRuntimeProject = ...
type MotionRuntimeScene = ...
type MotionRuntimeTrack = ...
```

Tasks:

- [ ] Rename public runtime type aliases away from `NormalizedMotionProjectV2`.
- [ ] Keep `format: "motion-runtime"`.
- [ ] Add `runtimeVersion`.
- [ ] Add runtime composition metadata:
  - width
  - height
  - fps
  - background
  - colorSpace
  - audioSampleRate
- [ ] Add compiled visual track/clip plan or compiled composition layer plan.
- [ ] Add stable runtime keys for repeated scene usage.
- [ ] Add source refs back to v3 project paths.
- [ ] Keep serialized runtime IR JSON-only.
- [ ] Keep `PreparedRuntimeProject` as in-memory indexes, not persisted JSON.

Gate:

- [ ] Runtime IR can serialize/deserialize.
- [ ] Prepared indexes can rebuild from serialized runtime IR.
- [ ] No production API exposes `NormalizedMotionProjectV2`.

## Phase 6 - Composition Evaluator V3

Purpose: evaluate the real visual timeline.

Tasks:

- [ ] Evaluate active visual clips at composition time.
- [ ] Resolve scene local time from clip start, trimStart, playbackRate, loop, and scene duration.
- [ ] Support main and overlay tracks.
- [ ] Support deterministic track and clip ordering.
- [ ] Resolve transition layers from visual clip transitions.
- [ ] Produce one `EvaluatedCompositionFrame`.
- [ ] Resolve audio plan from v3 audio tracks.
- [ ] Resolve caption/cue/token activity from v3 caption tracks.
- [ ] Ensure hit-test and paint use the same evaluated transforms.
- [ ] Carry diagnostics with source refs.

Gate:

- [ ] Cut, fade, crossfade, slide, wipe, and zoom fixtures pass.
- [ ] Same runtime frame gives same structural fingerprint.
- [ ] Hit-test snapshots match paint snapshots.

## Phase 7 - Renderer, Playback, Render Worker

Purpose: make every consumer read the same runtime/evaluated contracts.

Tasks:

- [ ] Update Pixi renderer to consume v3 runtime/evaluated output only.
- [ ] Update Remotion renderer to consume the same evaluated frame contract.
- [ ] Update playback-engine to load `MotionRuntimeProject`.
- [ ] Update render-worker to parse v3 -> compile -> render.
- [ ] Update frame-plan/render-worker logic so it no longer reads `scene.transition`.
- [ ] Update render manifest to include:
  - project hash
  - runtime hash
  - compiler version
  - protocol version
  - capability fingerprint
  - asset/font hashes
- [ ] Add required capability preflight.

Gate:

- [ ] Pixi and Remotion consume the same composition plan.
- [ ] Export does not compile through a separate path from preview.
- [ ] Playback never compiles in the play loop.

## Phase 8 - Editor Cutover

Purpose: make the editor write v3 project transactions.

Tasks:

- [ ] Update project creation to v3.
- [ ] Update load/save envelopes to v3.
- [ ] Update timeline projection to read `timeline.visualTracks`.
- [ ] Update move/trim/reorder commands to edit visual clips.
- [ ] Update scene reorder to edit main visual track.
- [ ] Update transition editing to write visual clip transitions.
- [ ] Update audio editing to write explicit v3 audio tracks.
- [ ] Update caption editing to write v3 caption tracks.
- [ ] Keep editor UI state outside project JSON:
  - currentTime
  - playing
  - selection
  - timeline zoom/scroll
  - collapsed lanes
  - stage pan/scale
  - undo history

Gate:

- [ ] Editor creates v3.
- [ ] Editor saves v3.
- [ ] Editor previews v3.
- [ ] Undo/redo commits v3 project transactions.
- [ ] `timeline.sceneOrder` is not used in production editor code.

## Phase 9 - AI Cutover

Purpose: make AI generate and patch v3 only.

Tasks:

- [ ] Update AI prompt schema block to v3 JSON Schema.
- [ ] Update AI command/patch types for v3.
- [ ] Add critic checks for:
  - composition dimensions
  - visual track ranges
  - scene/component refs
  - capability requirements
  - asset refs
  - caption timing
  - audio duration/rate
- [ ] Keep AI capability allowlist gated by schema -> compiler -> runtime -> Pixi -> Remotion support.

Gate:

- [ ] AI can generate minimal v3 project.
- [ ] AI can generate representative v3 project.
- [ ] AI patch output parses and compiles.

## Phase 10 - Workspace Linker

Purpose: support multi-file authoring without leaking workspace layout into runtime/renderers.

New package:

```text
packages/motion-workspace/
  src/schema.ts
  src/loader.ts
  src/resolver.ts
  src/linker.ts
  src/canonicalize.ts
  src/source-map.ts
```

Tasks:

- [ ] Add `MotionWorkspaceManifestSchema` with `format: "motion-workspace"`.
- [ ] Add `MotionWorkspaceReader`.
- [ ] Add memory reader for tests.
- [ ] Add filesystem reader for local tooling.
- [ ] Implement linker:
  - read manifest
  - parse modules
  - resolve paths
  - detect import cycles
  - validate module-local IDs
  - resolve assets/components
  - namespace instances
  - merge variables/tokens
  - build canonical v3 project
  - validate cross references
  - canonical serialize/hash
- [ ] Add bundle profiles:
  - `embedded-components`
  - `flattened-components`

Gate:

- [ ] Workspace bundle equals equivalent single-file v3 project semantically.
- [ ] Runtime/renderers never import `motion-workspace`.
- [ ] Absolute local paths are rejected in portable bundles.

## Phase 11 - Hashing And Determinism

Purpose: make preview/export reproducible.

Tasks:

- [ ] Add canonical serializer for v3 project.
- [ ] Add `projectHash`.
- [ ] Add `runtimeHash`.
- [ ] Add `sourceHash` for workspace modules.
- [ ] Exclude timestamps/provenance/editor state from render hash.
- [ ] Add deterministic sort rules with stable ID tie-breaks.
- [ ] Add deterministic time/frame quantization in one place.
- [ ] Add render manifest versioning.

Gate:

- [ ] Same semantic v3 project gives same project hash.
- [ ] Same runtime artifact gives same runtime hash.
- [ ] Render manifest can reproduce render job input.

## Phase 12 - Delete V2 Production Path

Purpose: remove old shape after v3 path is green.

Tasks:

- [ ] Delete or archive `packages/motion-protocol/src/v2`.
- [ ] Delete v2 parse/serialize exports.
- [ ] Delete v2 runtime schema exports after neutral runtime schema exists.
- [ ] Delete v2 fixtures and snapshots.
- [ ] Delete v2-specific compiler branches.
- [ ] Delete v2-specific editor adapters.
- [ ] Delete docs that imply v2 is canonical.
- [ ] Update README files to describe v3 only.
- [ ] Update `docs/motion-project-v3-implementation-detail.md` or replace it, because it currently describes a compatibility migration path.

Gate:

- [ ] `rg "MotionProjectV2"` returns no production code.
- [ ] `rg "NormalizedMotionProjectV2"` returns no production code.
- [ ] `rg "timeline.sceneOrder"` returns no production code.
- [ ] `rg "scene.transition"` returns no production code.
- [ ] All package tests pass.

## Suggested PR Order

1. `v3-cutover-00`: make protocol canonical parser/type aliases point to v3.
2. `v3-cutover-01`: finish v3 schema/reference validation and JSON Schema output.
3. `v3-cutover-02`: convert fixtures, demos, and project creation to v3.
4. `v3-cutover-03`: compile v3 directly without down-migrating to v2.
5. `v3-cutover-04`: rename runtime-facing types and add runtime composition metadata.
6. `v3-cutover-05`: evaluate v3 visual timeline and transitions.
7. `v3-cutover-06`: update Pixi, Remotion, playback, and render-worker.
8. `v3-cutover-07`: update editor persistence and timeline commands.
9. `v3-cutover-08`: update AI planner/prompts/patches.
10. `v3-cutover-09`: add workspace manifest/linker.
11. `v3-cutover-10`: add canonical serializer, hashes, and render manifest.
12. `v3-cutover-11`: delete v2 production path and stale docs.

## Test Matrix

Run after each major phase:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/playback-engine test
pnpm.cmd --filter @motionvideo/pixi-renderer test
pnpm.cmd --filter @motionvideo/remotion-renderer test
pnpm.cmd --filter @motionvideo/render-contracts test
```

Add v3-specific suites:

- [ ] protocol v3 positive fixtures
- [ ] protocol v3 negative fixtures
- [ ] v3 compile snapshots
- [ ] v3 evaluated frame fingerprints
- [ ] v3 transition frame fixtures
- [ ] v3 audio plan fixtures
- [ ] v3 caption/cue fixtures
- [ ] Pixi/Remotion parity over v3 runtime
- [ ] editor command transaction fixtures over visual clips
- [ ] AI generation and patch fixtures over v3 JSON Schema

## Definition Of Done

V3 cutover is complete when:

- [ ] `MotionProject` means `MotionProjectV3`.
- [ ] `parseMotionProject` accepts v3 only.
- [ ] New projects are v3 only.
- [ ] AI generates v3 only.
- [ ] Editor saves v3 only.
- [ ] Compiler accepts v3 as canonical project input.
- [ ] Runtime consumes generated runtime IR, not authoring JSON.
- [ ] Pixi preview and Remotion export consume the same evaluated frame contract.
- [ ] Playback loads runtime IR and never compiles during playback.
- [ ] Workspace linker produces canonical v3 project bundles.
- [ ] Project/runtime/render hashes are deterministic.
- [ ] Required capability preflight exists.
- [ ] v2 names and timeline assumptions are gone from production code.

