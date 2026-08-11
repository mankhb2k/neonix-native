# V3 Runtime Source Of Truth Fix Plan

> Status: focused remediation plan
>
> Goal: remove the remaining V2-shaped runtime/compiler/API leaks so Motion Project V3 can act as the provider-neutral source of truth for preview, render, MCP, Skills, and AI Agents.

## Problem Summary

The codebase has moved strongly toward V3, but several production-facing seams still carry V2 mental models:

- Compiler V3 still emits runtime `timeline.sceneOrder`.
- Compiler V3 flattens all V3 visual tracks into one runtime track named `primary`.
- Compiler V3 still passes `scene.transition` through scene compilation.
- Root protocol API still exports many `*V2Schema` names.
- Architecture gate passes because of transition allowlists.
- `@motionvideo/motion-protocol` still exposes `./compat/*`.

These issues matter because AI/MCP/Skill users will learn whatever surface we expose. If public APIs still mention `V2`, `sceneOrder`, or `compat`, agents can generate the wrong structure even if V3 schema exists.

## Target Architecture

```text
MotionProject V3
  -> compile directly from timeline.visualTracks
  -> MotionRuntimeProject with runtime visualTracks
  -> evaluate visual clips/layers
  -> provider.renderFrame/renderSequence/renderVideo
```

Final rule:

```text
No production provider, MCP tool, Skill, editor command, compiler path, or public root API should require sceneOrder, scene.transition, V2Schema names, or compat exports.
```

## Phase 1 - Runtime Timeline Contract

Purpose: make runtime IR visual-track-first and remove `sceneOrder` from production contracts.

Tasks:

- [ ] Update `MotionRuntimeProjectSchema` so `timeline.visualTracks` is required.
- [ ] Mark `timeline.sceneOrder` as deprecated in runtime tests, then remove it from runtime schema after compiler/runtime pass.
- [ ] Add runtime schema fixtures with multiple visual tracks:
  - primary track
  - overlay track
  - empty track
  - overlapping clips
  - transition clips
- [ ] Update runtime goldens so visual order comes from `visualTracks`, not `sceneOrder`.
- [ ] Remove runtime tests that assert `sceneOrder` is required.
- [ ] Keep `formatVersion: 2` only if it means runtime IR version; otherwise rename the runtime format marker to avoid confusion.

Gate:

- [ ] `MotionRuntimeProjectSchema` parses runtime IR with `visualTracks`.
- [ ] `MotionRuntimeProjectSchema` no longer requires `sceneOrder`.
- [ ] `rg "timeline\\.sceneOrder" packages/motion-protocol/src/runtime packages/motion-runtime/src apps/render-worker/src/runtime -S` has no production matches.

## Phase 2 - Preserve V3 Visual Tracks In Compiler

Purpose: compiler must not flatten V3 visual tracks into a single `primary` track.

Current issue:

```ts
const visualTracks = [
  {
    id: "primary",
    role: "primary",
    order: 0,
    clips: visualClips,
  },
];
```

Target:

```text
project.timeline.visualTracks[]
  -> runtime.timeline.visualTracks[]
```

Tasks:

- [ ] Replace `entries: VisualPlanEntry[]` with a track-preserving visual plan.
- [ ] Include original V3 track fields in the plan:
  - `track.id`
  - `track.role`
  - `track.order`
  - clip order within the track
- [ ] Compile clips per track instead of globally appending all clips.
- [ ] Preserve source clip IDs in runtime visual clips.
- [ ] Preserve overlay/main track distinctions.
- [ ] Preserve clip start/duration/trim/playback fields.
- [ ] Preserve `transitionIn` and `transitionOut` per clip.
- [ ] Add compile tests for:
  - two visual tracks
  - overlay clip over base clip
  - repeated scene on different tracks
  - component clip on overlay track
  - deterministic ordering when track order ties

Gate:

- [ ] `compileMotionProjectV3(project).project.timeline.visualTracks.length` equals the meaningful V3 track count.
- [ ] Runtime visual track IDs match or derive predictably from V3 track IDs.
- [ ] Compiler tests no longer expect everything under one `primary` runtime track.

## Phase 3 - Remove Compiler Runtime `sceneOrder`

Purpose: compiler V3 must stop emitting `timeline.sceneOrder`.

Current issue:

```ts
timeline: {
  sceneOrder: entries.map((entry) => entry.sceneId),
  audioTracks,
  captionTracks,
  visualTracks,
}
```

Tasks:

- [ ] Remove `sceneOrder` from compiler V3 runtime output.
- [ ] Replace any compile test assertion of `result.project.timeline.sceneOrder`.
- [ ] Replace runtime compile goldens that include `"sceneOrder"`.
- [ ] Update runtime schema to accept the new timeline shape.
- [ ] Update render worker / playback / runtime helpers to use `visualTracks`.
- [ ] If a temporary compatibility shim is necessary, keep it outside `compileMotionProjectV3()` and outside public runtime artifacts.

Gate:

- [ ] `rg "sceneOrder" packages/motion-compiler/src/compile-v3.ts packages/motion-compiler/src/__tests__ -S` has no production assertions except negative docs/comments.
- [ ] Runtime compile goldens have `visualTracks`, not `sceneOrder`.

## Phase 4 - Clip-Level Transition Semantics

Purpose: move transition semantics fully from scene-level to visual-clip-level.

Current issue:

```ts
transition: scene.transition
transitionOut: scene.transition ?? undefined
```

Target:

```text
visualClip.transitionIn
visualClip.transitionOut
```

Tasks:

- [ ] Remove `scene.transition` from compiler V3 code path.
- [ ] Update `_compileScenePipeline` input so transition is not scene-local authoring data.
- [ ] Move transition evaluation to visual layer evaluation.
- [ ] Store transitions on runtime visual clips.
- [ ] Update transition fixtures to clip transitions.
- [ ] Add tests for:
  - fade in
  - fade out
  - crossfade between adjacent clips
  - overlay clip transition
  - clip without transition
- [ ] Ensure Skills/MCP diagnostics reject `scene.transition` in V3 projects.

Gate:

- [ ] `rg "scene\\.transition" packages/motion-compiler/src packages/motion-runtime/src apps/render-worker/src -S` has no production V3 authoring matches.
- [ ] Transitions render from runtime visual clips.

## Phase 5 - Runtime Evaluation Uses Visual Tracks Only

Purpose: make providers rely on the same visual layer plan.

Tasks:

- [ ] Update `resolve-timeline.ts` to resolve clip layers from `runtime.timeline.visualTracks`.
- [ ] Remove fallback that builds timeline from `sceneOrder`.
- [ ] Update `evaluate-composition.ts` to use visual clip layers.
- [ ] Update `apps/render-worker/src/runtime/frame-plan.ts` to remove `sceneOrder` fallback.
- [ ] Update playback engine tests to load runtime visual tracks.
- [ ] Update render contract tests to use visual tracks.
- [ ] Add tests for multi-provider stable frame plan:
  - base track only
  - base + overlay
  - gaps
  - overlapping clips
  - clip transitions

Gate:

- [ ] `rg "sceneOrder" packages/motion-runtime/src apps/render-worker/src/runtime packages/playback-engine/src packages/render-contracts/src -S` has no production runtime logic matches.
- [ ] Runtime frame evaluation is deterministic from visual tracks.

## Phase 6 - Provider-Neutral Preview/Render Contract

Purpose: make Pixi, Remotion, server canvas, MCP preview, and future providers plug into one contract.

Tasks:

- [ ] Define provider-neutral request/result types in `packages/render-contracts` or `packages/motion-protocol/src/runtime`.
- [ ] Add `PreviewFrameRequest`.
- [ ] Add `PreviewFrameResult`.
- [ ] Add `PreviewContactSheetRequest`.
- [ ] Add `PreviewContactSheetResult`.
- [ ] Add `DraftVideoRequest`.
- [ ] Add `DraftVideoResult`.
- [ ] Add `FinalRenderRequest`.
- [ ] Add `FinalRenderResult`.
- [ ] Include fields:
  - `runtime`
  - `time` or frame number
  - `width`
  - `height`
  - `format`
  - `background`
  - `providerId`
  - diagnostics
  - project/runtime hashes
- [ ] Add provider capabilities:
  - supported node types
  - supported effects
  - supported transitions
  - max resolution
  - supports alpha
  - supports audio
  - supports final export
- [ ] Add a provider registry interface.
- [ ] Make MCP preview tools call provider contracts, not renderer internals directly.

Gate:

- [ ] Pixi and Remotion can be described as providers.
- [ ] MCP preview can return image/video results without requiring editor UI.
- [ ] A future Canvas/WebGPU/server renderer can implement the same contract.

## Phase 7 - Public API V3 Naming Cleanup

Purpose: public root API should not teach AI agents V2 names.

Current issue examples:

- `EffectV2Schema`
- `TransformV2Schema`
- `VariableV2Schema`
- `NodeV2Schema`
- `ClipV2Schema`

Tasks:

- [ ] Add V3-neutral aliases:
  - `EffectSchema`
  - `TransformSchema`
  - `VariableSchema` or `ProjectVariableSchema`
  - `NodeSchema`
  - `AnimationClipSchema`
  - `RuntimeClipSchema`
- [ ] Export neutral names from root.
- [ ] Move old `*V2Schema` names behind internal paths only.
- [ ] Update package imports to use neutral or V3 names.
- [ ] Update docs/examples so agents only see V3 names.
- [ ] Add a root API test that fails if public exports include `V2`.

Gate:

- [ ] `rg "V2Schema|MotionProjectV2|parseMotionProjectV2|MotionComponentV2" packages/motion-protocol/src/index.ts docs README.md -S` has no public-facing matches except archived migration docs.
- [ ] AI/MCP/Skill docs mention V3 only.

## Phase 8 - Remove Public Compat Export

Purpose: prevent external consumers and agents from importing V2 authoring APIs.

Current issue:

```json
"./compat/*": "./src/compat/*"
```

Tasks:

- [ ] Remove `./compat/*` from `packages/motion-protocol/package.json` exports.
- [ ] Convert acceptance scripts that import `src/compat/parse-v2`.
- [ ] Move one-off migration code to an archived non-package path if still needed.
- [ ] Do not document compat imports.
- [ ] Add a package export test to ensure compat is not exposed.

Gate:

- [ ] External package consumers cannot import `@motionvideo/motion-protocol/compat/*`.
- [ ] `rg "compat/parse-v2|src/compat|\\.\\/compat" packages apps scripts -S` has no production matches.

## Phase 9 - Tighten Architecture Gate

Purpose: make the gate represent final cleanliness, not transition state.

Tasks:

- [ ] Remove allowlist for `packages/motion-protocol/src/compat/`.
- [ ] Remove allowlist for `packages/motion-compiler/src/compile-v3.ts`.
- [ ] Remove allowlist for `packages/motion-compiler/src/index.ts` if legacy V2 compiler is deleted.
- [ ] Remove allowlist for acceptance scripts after they are V3.
- [ ] Remove allowlist for runtime `scene.transition` once transitions are visual clip-level.
- [ ] Add forbidden pattern for:
  - `sceneOrder`
  - `scene.transition`
  - `*V2Schema`
  - `./compat`
  - `src/compat`
  - `downMigrate`
- [ ] Keep allowlist only for archived docs and negative tests.

Gate:

- [ ] `pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts` passes with minimal allowlist.
- [ ] Gate failure points directly to production leaks.

## Phase 10 - MCP/Skill Source Of Truth Validation

Purpose: ensure Agent-facing tools cannot emit old shapes.

Tasks:

- [ ] Update V3 MCP validators to reject:
  - `timeline.sceneOrder`
  - `scene.transition`
  - `formatVersion: 2`
  - compat patch operations
  - unknown root fields
- [ ] Update Skill validators to reject V2-shaped output.
- [ ] Add fixtures for common agent mistakes.
- [ ] Add diagnostics explaining correct V3 shape.
- [ ] Ensure `preview_frame` and `preview_contact_sheet` compile through the same provider-neutral runtime path.

Gate:

- [ ] Agent/MCP tests fail on `sceneOrder`.
- [ ] Agent/MCP tests fail on `scene.transition`.
- [ ] Agent/MCP preview tools compile/render V3 only.

## Final Definition Of Done

This remediation is complete when:

- [ ] Compiler V3 emits no production `sceneOrder`.
- [ ] Compiler V3 preserves multiple visual tracks.
- [ ] Transitions are clip-level.
- [ ] Runtime evaluates visual tracks only.
- [ ] Provider contract is renderer-neutral.
- [ ] Public root API exposes no `V2Schema` names.
- [ ] `compat` is not package-exported.
- [ ] Architecture gate has no broad transition allowlists.
- [ ] MCP/Skill validators reject old V2 fields.
- [ ] Pixi, Remotion, and future providers can render from the same V3-derived runtime contract.

## Suggested Order

1. Preserve visual tracks in compiler.
2. Remove compiler `sceneOrder` output.
3. Move transition semantics to visual clips.
4. Update runtime evaluation to visual tracks only.
5. Add provider-neutral preview/render contract.
6. Clean public API names.
7. Remove compat package export.
8. Tighten architecture gate.
9. Harden MCP/Skill validators.

## Test Matrix

Run after each phase:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/playback-engine test
pnpm.cmd --filter @motionvideo/render-contracts test
pnpm.cmd --filter @motionvideo/pixi-renderer test
pnpm.cmd --filter @motionvideo/remotion-renderer test
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```
