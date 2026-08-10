# V3 Source Of Truth Completion Plan

> Status: completion roadmap
>
> Goal: make Motion Project V3 the only authoring contract for humans, editor UI, AI agents, MCP tools, Skill templates, compiler, runtime, preview, and export.

## North Star

The final system should orbit around one canonical project format:

```text
Skill.md / MCP / Agent / Editor
  -> MotionProject V3
  -> validate V3
  -> compile V3
  -> MotionRuntimeProject
  -> evaluate frame/audio/captions
  -> Pixi preview / Remotion export / render-worker
```

Important boundary:

```text
MotionProject V3 = source of truth authoring JSON
MotionRuntimeProject = generated runtime artifact
Editor UI state = local interface state, not source of truth
Skill.md = instruction layer that creates/patches V3, not a separate project model
MCP tools = automation surface around V3 operations
```

## Current Reality

Good:

- `legacy/` has been removed from the active protocol layout.
- V3 owns many schema modules directly.
- Root `parseMotionProject()` rejects `formatVersion: 2`.
- `motion-protocol` and `motion-compiler` tests are currently green.
- `validate-v3-source-of-truth` currently passes.

Still not complete:

- `compat/` still exists and includes V2 parser/project/patch/reference helpers.
- Some scripts still import `parseMotionProjectV2` from `compat`.
- Root protocol API still re-exports some compatibility concepts.
- `compile-v3.ts` still builds an internal V2-shaped project with `sceneOrder`.
- Runtime and render-worker still have fallback paths for `timeline.sceneOrder` and `scene.transition`.
- Some editor/stage paths still derive timeline clips from scene order.
- There is not yet a V3-native Agent/Skill/MCP patch contract.

## Definition Of Source Of Truth

V3 is truly source of truth only when:

- V3 is the only authoring JSON accepted by product paths.
- Root protocol exports do not expose V2/compat authoring APIs.
- Compiler does not down-migrate V3 into a V2-shaped project.
- Runtime does not need `timeline.sceneOrder` fallback for production paths.
- Transitions are clip-level, not scene-level.
- Editor commands modify V3 `timeline.visualTracks`, `timeline.audioTracks`, `captionTracks`, `scenes`, `assets`, `variables`, and `bindings`.
- Agent/MCP/Skill tools read/write V3 patches only.
- Preview and export consume the same generated runtime/evaluated contracts.

## Phase 0 - Freeze V3 Contract

Purpose: stop schema drift before deeper refactors.

Tasks:

- [ ] Mark `MotionProjectV3Schema` as the canonical authoring schema in README.
- [ ] Document canonical root fields:
  - `metadata`
  - `composition`
  - `capabilities`
  - `dependencies`
  - `tokens`
  - `variables`
  - `assets`
  - `components`
  - `scenes`
  - `timeline`
  - `bindings`
  - `provenance`
  - `extensions`
- [ ] Document that `timeline.visualTracks` replaces `timeline.sceneOrder`.
- [ ] Document that `visualClip.transitionIn/transitionOut` replaces `scene.transition`.
- [ ] Document that editor UI state is not part of V3.
- [ ] Regenerate JSON Schema for V3 only, or clearly mark V2 schemas as archived/test-only if any remain.
- [ ] Add V3 examples for minimal, multi-scene, component, caption, audio, and transition projects.

Gate:

- [ ] A new contributor can create a valid V3 JSON file without reading V2 docs.
- [ ] `parseMotionProject()` accepts only V3.
- [ ] V3 JSON Schema contains `visualTracks`.
- [ ] V3 JSON Schema does not contain `sceneOrder`.

## Phase 1 - Seal Public Protocol API

Purpose: prevent AI, apps, and packages from learning old APIs.

Tasks:

- [ ] Remove root exports that point to `compat`.
- [ ] Do not export `MotionProjectV2`.
- [ ] Do not export `parseMotionProjectV2`.
- [ ] Do not export `MotionComponentV2`.
- [ ] Do not export `MotionPatchSchema` from `compat`.
- [ ] Do not export `applyMotionPatch` from `compat`.
- [ ] Replace root `MotionScene` export from `compat/project` with a V3 scene type.
- [ ] Replace any V2-named root exports with V3-neutral names.
- [ ] Keep `compat/` accessible only by direct internal path during migration, never from package root.

Gate:

- [ ] `rg "from \"./compat|from './compat" packages/motion-protocol/src/index.ts` returns nothing.
- [ ] `rg "MotionProjectV2|parseMotionProjectV2|MotionComponentV2|MotionPatchSchema|applyMotionPatch" packages/motion-protocol/src/index.ts` returns nothing.
- [ ] Protocol tests pass.

## Phase 2 - Archive Or Delete Compat

Purpose: make remaining V2 helpers non-production.

Tasks:

- [ ] Classify each `packages/motion-protocol/src/compat/*` file:
  - delete now
  - convert to V3
  - move to archived migration tooling
  - keep temporarily for test fixture conversion only
- [ ] Convert scripts that still import `compat/parse-v2`:
  - `scripts/validate-runtime-primitives.ts`
  - `scripts/validate-acceptance-web-parity.ts`
  - `scripts/validate-acceptance-export.ts`
  - `scripts/score-acceptance-pack.ts`
- [ ] Replace V2 acceptance fixture generation with V3 fixture generation.
- [ ] Replace `MotionProjectV2` use in editor-core internal timeline sync with V3-only inputs.
- [ ] Delete or archive `compat/patch.ts` after V3 patch contract exists.
- [ ] Delete or archive `compat/project.ts` after no production import remains.
- [ ] Delete or archive `compat/parse-v2.ts` after scripts are converted.

Gate:

- [ ] `rg "from .*compat|\\.\\/compat|\\.\\.\\/compat|src[\\\\/]compat|compat/" packages apps scripts -S` has no production matches.
- [ ] Any remaining compat references are in archived docs or one-off migration scripts only.

## Phase 3 - V3 Native Patch Contract

Purpose: give AI Agents and MCP tools a safe editing language.

Tasks:

- [ ] Create a V3 patch schema, for example `packages/motion-protocol/src/v3/patch.ts`.
- [ ] Support basic document operations:
  - add scene
  - update scene
  - remove scene
  - add visual clip
  - trim visual clip
  - move visual clip
  - reorder visual track
  - add/update asset
  - add/update variable
  - add/update binding
  - add/update caption cue
  - add/update audio track
  - set composition
  - set tokens
- [ ] Include source paths that match V3 structure.
- [ ] Return structured diagnostics instead of throwing raw strings.
- [ ] Add `applyMotionProjectV3Patch(project, patch)`.
- [ ] Add patch validation tests.
- [ ] Replace `compat/patch` exports with V3 patch exports.

Gate:

- [ ] AI/editor code imports V3 patch APIs only.
- [ ] Patch output always re-validates with `MotionProjectV3Schema`.
- [ ] Invalid patch paths return diagnostics.

## Phase 4 - Skill Template Contract

Purpose: let `SKILL.md` become a reliable authoring instruction layer around V3.

Tasks:

- [ ] Define a `MotionSkillManifest` shape for Skill templates.
- [ ] Decide where it lives:
  - recommended: `packages/motion-protocol/src/v3/skills.ts`
- [ ] Define skill metadata:
  - `id`
  - `name`
  - `description`
  - `version`
  - `author`
  - `requiredCapabilities`
  - `inputSchema`
  - `outputContract`
- [ ] Define allowed skill outputs:
  - full `MotionProjectV3`
  - `MotionProjectV3Patch`
  - template parameter object
  - validation report
- [ ] Add examples:
  - brand intro skill
  - social ad skill
  - subtitle styling skill
  - product demo skill
  - corporate template skill
- [ ] Add a skill validation helper:
  - validate skill metadata
  - validate generated project
  - validate generated patch
  - compile generated project
- [ ] Keep Skill instructions separate from project JSON.

Gate:

- [ ] A Skill can create a V3 project without editor-specific state.
- [ ] A Skill can patch an existing V3 project.
- [ ] A Skill cannot emit V2 fields like `sceneOrder`.

## Phase 5 - MCP Tool Contract

Purpose: build automation tools around V3, not around editor internals.

Tasks:

- [ ] Define MCP-facing operations:
  - `create_project`
  - `validate_project`
  - `apply_patch`
  - `compile_project`
  - `render_preview_frame`
  - `list_capabilities`
  - `inspect_timeline`
  - `explain_diagnostics`
- [ ] Define input/output schemas from V3 and runtime types.
- [ ] Ensure MCP tools never accept V2 authoring JSON.
- [ ] Ensure MCP tools never expose editor UI state as source of truth.
- [ ] Add capability preflight for every tool.
- [ ] Add deterministic project hash and runtime hash to MCP results.
- [ ] Add examples for enterprise workflows:
  - generate ad variants
  - update brand kit
  - localize captions
  - convert script to video timeline
  - batch render templates

Gate:

- [ ] MCP tool inputs are V3 or V3 patch only.
- [ ] MCP compile/render paths are same as app compile/render paths.
- [ ] MCP diagnostics use V3 source paths.

## Phase 6 - Compiler Direct V3

Purpose: remove the V2-shaped compiler spine.

Current anti-pattern:

```text
MotionProject V3
  -> downMigrateProject()
  -> internal sceneOrder project
  -> compile scene pipeline
  -> runtime IR
```

Target:

```text
MotionProject V3
  -> build V3 visual plan
  -> compile scenes/components/assets/bindings directly
  -> MotionRuntimeProject
```

Tasks:

- [ ] Delete or replace `downMigrateProject()`.
- [ ] Delete or replace `downMigrateMetadata()`.
- [ ] Delete or replace `downMigrateScene()`.
- [ ] Delete or replace `downMigrateNode()`.
- [ ] Delete or replace `downMigrateVariable()`.
- [ ] Delete or replace `downMigrateAudioTrack()`.
- [ ] Build runtime visual tracks from `project.timeline.visualTracks`.
- [ ] Preserve clip IDs and source refs from V3.
- [ ] Use `clip.transitionIn` and `clip.transitionOut` directly.
- [ ] Compile component clips without synthesizing V2 authoring scenes.
- [ ] Emit diagnostics with V3 paths.
- [ ] Rename `_compileScenePipeline` to a neutral helper.
- [ ] Remove `compileMotionProjectV2()` from compiler public exports.
- [ ] Update compile tests to assert `timeline.visualTracks`, not `sceneOrder`.

Gate:

- [ ] `rg "downMigrate" packages/motion-compiler/src -S` returns nothing.
- [ ] `rg "sceneOrder" packages/motion-compiler/src -S` has no production compiler matches.
- [ ] `rg "scene\\.transition" packages/motion-compiler/src -S` returns nothing.
- [ ] Compiler tests pass.

## Phase 7 - Runtime Visual Timeline Only

Purpose: make runtime evaluation follow the V3 timeline model.

Tasks:

- [ ] Make runtime `timeline.visualTracks` required in runtime IR.
- [ ] Remove production fallback to `timeline.sceneOrder`.
- [ ] Remove production fallback to `scene.transition`.
- [ ] Evaluate visual clips by:
  - track order
  - clip start
  - clip duration
  - trim start
  - playback rate
  - loop
  - transition in/out
- [ ] Resolve active clip layers into one evaluated composition frame.
- [ ] Resolve audio tracks from V3/runtime audio track model.
- [ ] Resolve captions from V3/runtime caption track model.
- [ ] Update transition fixtures to visual clip transitions.
- [ ] Update runtime tests to use visual tracks.

Gate:

- [ ] `rg "timeline\\.sceneOrder|scene\\.transition|sceneOrder" packages/motion-runtime/src apps/render-worker/src/runtime -S` has no production fallback matches.
- [ ] Motion runtime tests pass.
- [ ] Render worker frame plan uses visual tracks only.

## Phase 8 - Editor V3 Commands

Purpose: editor should be an interface over V3, not a parallel data model.

Tasks:

- [ ] Replace `sceneOrderToTimelineClips` usage in production editor paths.
- [ ] Derive timeline UI from `project.timeline.visualTracks`.
- [ ] Make move/trim/reorder commands update V3 visual clips.
- [ ] Make transition commands update `visualClip.transitionIn/transitionOut`.
- [ ] Make asset commands update V3 `assets`.
- [ ] Make text/edit commands update V3 scene nodes.
- [ ] Make caption commands update V3 caption tracks.
- [ ] Make audio commands update V3 audio tracks.
- [ ] Keep undo/redo as command history over V3 patches.
- [ ] Keep UI-only state outside project JSON.

Gate:

- [ ] Editor project save is valid V3.
- [ ] Editor export compiles V3 directly.
- [ ] `rg "sceneOrderToTimelineClips|timeline\\.sceneOrder|sceneOrder" apps/web packages/editor-core -S` has no production editor source-of-truth usage.

## Phase 9 - AI Planner V3 Only

Purpose: AI generation should learn and emit V3, not compat concepts.

Tasks:

- [ ] Update AI planner input/output contracts to V3.
- [ ] Remove command schemas that mention `sceneOrder`.
- [ ] Remove command execution paths that materialize `scene.transition`.
- [ ] Generate `timeline.visualTracks` directly.
- [ ] Generate clip-level transitions directly.
- [ ] Generate V3 patch operations, not compat patches.
- [ ] Add AI critic checks:
  - schema validity
  - missing refs
  - clip timing
  - unsupported capabilities
  - asset integrity
  - text/caption duration
  - renderability
- [ ] Add fixtures for AI-generated V3 projects.

Gate:

- [ ] AI-generated output parses as V3.
- [ ] AI-generated output compiles.
- [ ] AI planner tests do not reference V2 fields.

## Phase 10 - Renderers And Worker

Purpose: preview and export should consume the same runtime/evaluated contract.

Tasks:

- [ ] Make Pixi preview consume `MotionRuntimeProject` or evaluated frame only.
- [ ] Make Remotion export consume the same contract.
- [ ] Make render-worker parse V3 only.
- [ ] Make render-worker compile V3 once per job, not in playback loop.
- [ ] Include hashes in render manifest:
  - project hash
  - runtime hash
  - compiler version
  - protocol version
  - capability fingerprint
  - asset hashes
- [ ] Add parity tests for Pixi and Remotion over the same V3-derived runtime.

Gate:

- [ ] Pixi/Remotion parity fixtures do not use V2 fixtures.
- [ ] Render worker has no V2 parse path.
- [ ] Export and preview produce consistent frame plans.

## Phase 11 - Capability And Safety Layer

Purpose: make enterprise/Agent workflows safe and predictable.

Tasks:

- [ ] Treat capabilities as part of V3 source of truth.
- [ ] Add capability preflight before compile/render.
- [ ] Add unsupported feature diagnostics.
- [ ] Define capability IDs for:
  - text
  - rich text
  - image
  - svg
  - video
  - audio
  - captions
  - transitions
  - effects
  - component embedding
  - AI patching
  - external assets
- [ ] Include capability requirements in Skill manifests.
- [ ] Include capability fingerprints in render manifests.

Gate:

- [ ] A project requiring unsupported features fails before render.
- [ ] Skill/MCP can query capabilities before generating patches.

## Phase 12 - Determinism And Hashing

Purpose: make Agent/MCP/template workflows reproducible.

Tasks:

- [ ] Ensure canonical serializer excludes editor UI state.
- [ ] Ensure project hash is stable.
- [ ] Ensure runtime hash is stable.
- [ ] Ensure compile cache key uses:
  - project hash
  - compiler version
  - protocol version
  - capability fingerprint
  - dependency hashes
  - skill/template version when relevant
- [ ] Add deterministic ordering rules for tracks/clips/nodes/assets.
- [ ] Add deterministic time quantization.
- [ ] Add hash tests for V3 projects and runtime artifacts.

Gate:

- [ ] Same semantic V3 project gives same project hash.
- [ ] Same compile input gives same runtime hash.
- [ ] Agent-generated project can be reproduced from Skill version + inputs.

## Phase 13 - Tighten Architecture Gate

Purpose: prevent old concepts from returning.

Tasks:

- [ ] Update `scripts/validate-v3-source-of-truth.ts`.
- [ ] Remove allowlists for compiler V2 fallback after Phase 6.
- [ ] Remove allowlists for runtime `sceneOrder` fallback after Phase 7.
- [ ] Remove allowlists for compat scripts after Phase 2.
- [ ] Add forbidden patterns:
  - `parseMotionProjectV2`
  - `MotionProjectV2`
  - `compileMotionProjectV2`
  - `migrateMotionProjectV2ToV3`
  - `timeline.sceneOrder`
  - `scene.transition`
  - `downMigrate`
  - `from "./compat"`
  - `src/compat`
- [ ] Allow archived docs only.
- [ ] Add architecture gate to CI.

Gate:

- [ ] `validate-v3-source-of-truth` passes with minimal allowlist.
- [ ] No production source contains V2 authoring concepts.

## Phase 14 - Documentation For AI-First Workflow

Purpose: make the intended product direction explicit.

Tasks:

- [ ] Write `docs/ai-first-editor-architecture.md`.
- [ ] Document that the editor is optional UI over V3.
- [ ] Document that agents edit via Skills and V3 patches.
- [ ] Document how enterprises can define style/template Skills.
- [ ] Document Skill lifecycle:
  - author
  - validate
  - test
  - publish
  - apply
  - render
- [ ] Document MCP lifecycle:
  - validate project
  - apply patch
  - compile
  - preview
  - export
- [ ] Add end-to-end examples.

Gate:

- [ ] A developer can build a Skill without opening editor code.
- [ ] A developer can build an MCP tool without knowing V2/compat.

## Recommended Implementation Order

1. Public API seal: remove root compat exports.
2. Compat scripts: convert or archive V2 scripts.
3. V3 patch contract: define Agent-editable operations.
4. Skill contract: define Skill metadata and output rules.
5. MCP contract: define V3 automation tool surface.
6. Compiler direct V3: remove down-migration.
7. Runtime visual tracks only: remove `sceneOrder` fallback.
8. Editor V3 commands: stop deriving source of truth from scene order.
9. AI planner V3 only: emit V3 projects/patches only.
10. Renderer/worker parity: same runtime/evaluated contract.
11. Capability/safety: preflight for Agent and enterprise workflows.
12. Determinism/hashing: reproducible Skill/MCP outputs.
13. Architecture gate: remove allowlists and enforce.
14. AI-first docs: document the product model.

## Test Matrix

Run frequently:

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

Run before major deletion:

```powershell
pnpm.cmd typecheck
pnpm.cmd build
```

## Final Definition Of Done

V3 source of truth is complete when:

- [ ] `MotionProjectV3` is the only authoring project format in product paths.
- [ ] `compat/` is deleted or moved to archived migration tooling.
- [ ] Root protocol exports no compat/V2 authoring concepts.
- [ ] Compiler builds runtime IR directly from V3.
- [ ] Runtime evaluates visual tracks only.
- [ ] Editor commands update V3 structures.
- [ ] AI planner emits V3 projects or V3 patches only.
- [ ] Skill templates target V3.
- [ ] MCP tools accept V3/V3 patch only.
- [ ] Pixi and Remotion consume the same V3-derived runtime/evaluated frame contract.
- [ ] Capability preflight blocks unsupported outputs before render.
- [ ] Project/runtime hashes are deterministic.
- [ ] Architecture gate prevents V2 concepts from returning.
