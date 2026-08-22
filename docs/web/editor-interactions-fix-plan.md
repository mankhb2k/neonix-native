# Editor Interactions Fix Plan

> Historical scope: web-first cleanup for interaction logic, now merged into `@motionvideo/editor-core`.
> Goal: keep interactions as pure gesture/coordinate math while making every public name map cleanly to `editor-core` and the JSON protocol vocabulary.

## Current Position

`editor-interactions` is already in the right architectural lane:

- It owns gesture math, pointer sessions, timeline coordinate math, marquee hit testing, clip move/trim resolution, drop geometry, and stage transform sessions.
- It does not own React hooks, Zustand state, UI chrome, document mutation, protocol validation, rendering, or export.
- Web and future desktop hosts should call it, then apply results through `editor-core` commands or web-local store adapters.

The remaining work is mostly vocabulary hardening, command-boundary clarity, and test/build gate cleanup.

## Vocabulary Rules

- Use `rootLayerId` when the value means the protocol top-level `MotionProject.layers[].id`.
- Use `layerId` when the value means the concrete protocol `MotionLayer.id` being edited.
- Use `node` only for editor/property-command language around editable layer targets.
- Use `sceneId` only for timeline clip source fields where `TimelineClip.kind === "scene"` references its source/root layer.
- Use `clip`, `lane`, and `track` only for timeline/editor view-model concepts, not as JSON protocol object names.

## Phase 1 - Stage Vocabulary Cleanup

- [ ] Rename `StageTransformValues.sceneId` to `StageTransformValues.rootLayerId`.
- [ ] Update `packages/editor-interactions/src/stage/transform-box.ts`.
- [ ] Update `packages/editor-interactions/src/stage/commit.ts`.
- [ ] Change `toStagePropertyPatches()` mapping from `preview.sceneId` to `preview.rootLayerId`.
- [ ] Update `packages/editor-interactions/src/stage/sessions/*` types/usages if needed.
- [ ] Update `packages/editor-interactions/src/__tests__/stage.test.ts`.
- [ ] Update `packages/editor-interactions/src/__tests__/web-desktop-host-contract.test.ts`.
- [ ] Update web stage consumers:
  - `apps/web/components/editor/stage/InteractionOverlay.tsx`
  - `apps/web/hooks/editor/stage/use-node-transform.ts`
  - `apps/web/hooks/editor/stage/use-stage-pointer-session.ts`
- [ ] Update duplicate/migration copy under `packages/editor-react/src/stage/*` if still present.
- [ ] Replace local variables named `sceneId` with `rootLayerId` when they are produced by `rootLayerIdOf(...)`.
- [ ] Keep `sceneId` only where it is a real clip/source reference.

Acceptance:

- [ ] `StageTransformValues` no longer exposes `sceneId`.
- [ ] `toStagePropertyPatches()` emits `target.rootLayerId` from `rootLayerId`.
- [ ] Stage tests assert `target: { rootLayerId, layerId }`, not just command type.
- [ ] Web stage commit calls use `values.rootLayerId`.

## Phase 2 - Typecheck/Test Gate Cleanup

- [ ] Fix `packages/editor-interactions` typecheck so source code can typecheck without pulling Vitest errors.
- [ ] Choose one option:
  - Option A: create `tsconfig.build.json` with `include: ["src"]` and `exclude: ["src/__tests__"]`, then change `package.json` `typecheck` to `tsc -p tsconfig.build.json --noEmit`.
  - Option B: keep current `tsconfig.json` for source and create `tsconfig.test.json` with `types: ["node", "vitest"]`.
- [ ] Prefer Option A for package CI because runtime package typecheck should not depend on test files.
- [ ] Add a separate script if useful: `typecheck:test`.
- [ ] Check whether `editor-core` has the same gate issue and align configs later, but do not block this package on core.

Acceptance:

- [ ] `pnpm.cmd --filter @motionvideo/editor-core typecheck:test` does not fail on Vitest imports.
- [ ] Tests remain included by `vitest.config.ts`.
- [ ] No package source depends on test-only globals.

## Phase 3 - Pointer Session Commit Contract

- [ ] Decide the API contract:
  - Preferred: `PointerSessionController.commit()` flushes pending update automatically.
  - Alternative: rename/document `flushPendingUpdate()` as mandatory host responsibility.
- [ ] Implement preferred behavior in `packages/editor-interactions/src/pointer/pointer-session-controller.ts`.
- [ ] Make `commit()` call `flushPendingUpdate()` before changing state to `committed`.
- [ ] Ensure the implementation does not double-apply when RAF already ran.
- [ ] Keep web host's explicit flush for now; it should become harmless.
- [ ] Add package-level test for commit without explicit flush.

Acceptance:

- [ ] A queued pointer update is applied when `commit()` is called directly.
- [ ] Existing `flushPendingUpdate()` tests still pass.
- [ ] Web host does not need special knowledge to avoid dropping the last pointer position.

## Phase 4 - Stage Commit Boundary

- [ ] Clarify `StageCommitResult` semantics:
  - `patches` are the canonical stage interaction result.
  - `command` is optional and currently only covers transform fields supported by `set-node-transform`.
  - resize dimensions may appear as `sizePatch` until `editor-core` has a canonical size/frame command.
- [ ] Update README/docs comments so hosts do not assume every stage gesture returns a command.
- [ ] Tighten `toSetNodeTransformCommand()` behavior.
- [ ] Choose one option:
  - Option A: assert/support only one patch and rename helper to `toSingleSetNodeTransformCommand`.
  - Option B: group targets by identical transform patch before building commands.
  - Option C: return one command per patch if patches differ.
- [ ] Prefer Option A until multi-select stage transform is implemented.
- [ ] Add tests:
  - move returns `set-node-transform`
  - resize-only returns `command: null` but includes `sizePatch`
  - rotate returns `set-node-transform`
  - mixed size + transform returns command + sizePatch

Acceptance:

- [ ] Public docs explain why `command` can be null.
- [ ] Tests lock resize behavior.
- [ ] No API silently applies the first patch to unrelated targets.

## Phase 5 - Layer Reorder Naming

- [ ] Rename `reorderLayerLayerIds` to `reorderLayerIds`.
- [ ] Rename `reorderLayerLayerIdsByInsert` to `reorderLayerIdsByInsert`.
- [ ] Keep deprecated aliases temporarily if web/desktop/package consumers are not migrated in one PR.
- [ ] Update exports in `packages/editor-interactions/src/index.ts`.
- [ ] Update tests in `packages/editor-interactions/src/__tests__/layer-helpers.test.ts`.
- [ ] Update web imports:
  - `apps/web/hooks/editor/timeline/use-layer-move.ts`
- [ ] Update `packages/editor-react` imports if still mirrored.
- [ ] Leave desktop compatibility aliases only if necessary; web-first migration can update web immediately.

Acceptance:

- [ ] New API names read naturally.
- [ ] Comments consistently say either `layer id list` or `node id list`, not both in one sentence.
- [ ] Deprecated aliases, if kept, are marked with `@deprecated`.

## Phase 6 - Vendor Stub Drift Control

- [ ] Review why `packages/editor-interactions/tsconfig.json` maps `@motionvideo/editor-core` to `src/vendor-stubs/editor-core.ts`.
- [ ] If `editor-core` is now typecheck-clean enough, remove the path alias and use the real workspace package.
- [ ] If the stub must stay temporarily, add a clear TODO with removal condition.
- [ ] Add a drift gate:
  - Type-level compatibility test against real `@motionvideo/editor-core`, or
  - A package build config that resolves real core in CI, or
  - A small script that compares exported names used by interactions.
- [ ] Do not let stub behavior mask runtime semantics. In particular, avoid stubs like `clipAcceptsTrack()` returning `true` if tests rely on real behavior.

Acceptance:

- [ ] Source typecheck is not permanently coupled to a divergent local fake.
- [ ] Runtime behavior and typecheck assumptions point to the same `editor-core` API.
- [ ] Any remaining stub is explicitly temporary.

## Phase 7 - Missing Test Coverage

- [ ] Add tests for `resolveDropGeometry()`:
  - negative Y returns null
  - empty lanes returns null
  - lane gap does not accidentally select a previous lane
  - content X clamps start time to zero
  - custom `laneHeightFor`
  - display order is respected without sorting
- [ ] Add tests for `computeAutoScrollNearEdge()`:
  - horizontal left/right clamp
  - vertical top/bottom clamp
  - small viewport near both edges chooses one vertical direction
  - `maxScrollTop` and `maxScrollLeft` caps are respected
- [ ] Add tests for session state helpers:
  - `buildClipMovePatch()`
  - `buildPlacementTarget()`
  - null lane target
  - insert lane target
- [ ] Add tests for stage commit helpers:
  - `toStagePropertyPatches()` maps `rootLayerId`
  - transform-only command
  - size-only patch
  - rotate patch
- [ ] Add tests for stage hit policy:
  - locked/selectable filtering
  - cycle offset
  - `respectSelectable: false`

Acceptance:

- [ ] Package tests cover every exported pure helper with protocol-facing semantics.
- [ ] Tests assert vocabulary fields, not only loose object matching.
- [ ] Web-specific behavior that remains in web has matching web tests, not duplicated in interactions.

## Phase 8 - Docs Update

- [ ] Update `packages/editor-interactions/README.md`.
- [ ] Link this plan from `docs/web/editor-core-protocol-map.md` or `docs/web/editor-vocabulary.md` if useful.
- [ ] Add a short "Interaction Layer Mapping" section:
  - pointer/client coordinates -> interaction math
  - interaction preview -> web UI chrome
  - interaction commit payload -> `editor-core` command/store adapter
  - protocol JSON remains the final source of truth
- [ ] Document forbidden responsibilities:
  - no React
  - no Zustand/store
  - no document mutation
  - no protocol migration
  - no renderer-specific types

Acceptance:

- [ ] A new contributor can tell where `clip`, `lane`, `track`, `rootLayerId`, `layerId`, and `node` belong.
- [ ] Docs explain that interactions produce intent, not final protocol JSON directly.

## Suggested Implementation Order

1. Fix Stage vocabulary (`sceneId` -> `rootLayerId`).
2. Fix package typecheck config.
3. Make pointer commit self-flushing.
4. Tighten stage commit helper semantics.
5. Rename layer reorder helpers.
6. Add missing tests.
7. Reduce/remove vendor stubs.
8. Update docs/README.

## Verification Checklist

- [ ] `pnpm.cmd --filter @motionvideo/editor-core lint`
- [ ] `pnpm.cmd --filter @motionvideo/editor-core typecheck`
- [ ] `pnpm.cmd --filter @motionvideo/editor-core test`
- [ ] `pnpm.cmd --filter @motionvideo/web lint`
- [ ] `pnpm.cmd --filter @motionvideo/web typecheck`
- [ ] Targeted web tests for stage/timeline hooks if touched.

## Done Definition

- [ ] Public interaction API names align with `editor-core` and protocol vocabulary.
- [ ] Web stage/timeline consumers compile against the new names.
- [ ] Package lint/typecheck/test gates are meaningful.
- [ ] Tests cover protocol-facing interaction payloads.
- [ ] Docs make it clear that `editor-interactions` is not a protocol layer, but every result it emits must be easy to map into protocol-backed `editor-core` commands.
