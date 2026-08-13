# Runtime/MCP Legacy Cleanup And Production Hardening Plan

## Goal

Make V3 production-ready for MP4 motion graphic rendering by enforcing one source of truth:

- Authoring timeline uses scene-only visual clips.
- Component instances exist only as sealed `type: "component"` scene layers.
- Runtime IR receives compiled scenes only, not component clip sources.
- MCP/tools inspect and generate the canonical scene-only model.
- TypeScript, tests, runtime schema, fixtures, and docs all agree.

## Current Decision

Component should stay as a scene layer/group-like node:

- `kind`/`type` remains `component` at scene node level.
- Internal component layers are sealed.
- Consumers can only edit owner-exposed public API.
- Whole component instance can be moved/scaled/keyframed through the component node transform, exactly like a group layer.
- Public props are separate from transform/keyframe behavior.

Timeline should stay scene-first:

- `timeline.visualTracks[].clips[].source` only supports `{ kind: "scene", sceneId }`.
- Audio and captions live at project timeline level.
- Scene-local animation lives in `scene.clips`.
- Component-local/instance transform animation targets the component node inside the scene, not the visual clip.

## Production Blockers

### P0. Remove Legacy Component Clip Source From Runtime And MCP

Problem:

Runtime and MCP still contain code paths that assume visual clip source can be `component`, even though V3 authoring timeline is now scene-only.

Files:

- `packages/motion-protocol/src/runtime/project.ts`
- `packages/motion-protocol/src/runtime/__tests__/project.test.ts`
- `packages/motion-protocol/src/v3/mcp.ts`
- `packages/motion-protocol/src/v3/__tests__/mcp.test.ts`
- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`
- `packages/motion-compiler/src/__fixtures__/runtime-compile-goldens/*.runtime.json`

Tasks:

- Change `RuntimeClipSourceSchema` to only allow `{ kind: "scene", sceneId }`.
- Remove runtime acceptance of `{ kind: "component", componentId }`.
- Simplify MCP timeline inspection so `refId` always comes from `clip.source.sceneId`.
- Remove branches in tests that expect component clip source in runtime.
- Keep legacy component visual clip migration only in `normalizeMotionProjectV3(..., { migrateComponentClipsToScenes: true })`.
- Add explicit test that canonical runtime rejects `source.kind: "component"`.
- Add explicit test that V3 authoring parse rejects visual clip `source.kind: "component"` unless migration is run first.

Acceptance criteria:

- Runtime schema is scene-only.
- MCP typecheck no longer needs component-source narrowing.
- No `clip.source.componentId` references remain outside legacy normalizer/tests.

Commands:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-protocol typecheck
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-compiler typecheck
```

### P0. Fix Timeline Clip Start Semantics

> **✅ DONE** — `clip.start` is now absolute global timeline time; compiler/runtime/render carry it verbatim and no longer reconstruct starts with a cursor (see `docs/guide/v3-format-guide.md` §3.3 and §3.8).

Problem:

Compiler currently builds runtime clip `start` using a cursor, so it ignores authoring `clip.start`. Overlay clips and non-contiguous timelines render at the wrong time.

Files:

- `packages/motion-compiler/src/compile-v3.ts`
- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`
- `packages/motion-compiler/src/__fixtures__/runtime-compile-goldens/*.runtime.json`

Tasks:

- Carry `clip.start` from V3 into `VisualPlanEntry`.
- In runtime visual track generation, set `start: entry.start`.
- Do not compute `start` with `clipCursor`.
- Preserve `duration` from the compiled scene override.
- Update overlay tests so a clip authored at `start: 2` compiles to runtime `start: 2`.
- Update crossfade tests so `start: 2.5` remains `2.5`, not cursor-derived `3`.
- Add regression test for a gap: clips at `0` and `5` must compile as `0` and `5`.
- Add regression test for overlap on overlay track: clips at `1` and `1.5` must preserve both starts.

Acceptance criteria:

- Runtime timeline timing equals authoring timeline timing.
- No test expects compiler-computed clip starts.

### P0. Make Typecheck Green

Problem:

Runtime tests pass, but `tsc --noEmit` fails in both protocol and compiler packages. Production cannot ship with red typecheck.

Files:

- `packages/motion-protocol/src/runtime/index.ts`
- `packages/motion-protocol/src/v3/mcp.ts`
- `packages/motion-protocol/src/v3/references/helpers.ts`
- `packages/motion-protocol/src/v3/skills.ts`
- `packages/motion-protocol/src/v3/__tests__/*.test.ts`
- `packages/motion-compiler/src/compile-v3.ts`
- `packages/motion-compiler/src/compile-result.ts`
- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`
- `packages/motion-compiler/src/index.ts`

Tasks:

- Resolve duplicate `RuntimeScene` exports in `runtime/index.ts`.
- Import `MotionPathContour` from the correct module, likely `../layers/geometry`.
- Add missing diagnostic code `CMP_UNRESOLVED_COMPONENT_VARIANT` or reuse `UNKNOWN_VARIANT` consistently.
- Fix union narrowing in `compile-v3.ts` so `component`, `componentLayer`, and `scene` binding targets are narrowed before accessing fields.
- Update test fixtures/types for required defaults that are inferred as required by Zod output types.
- Fix `publicProps` fixture typing so default `{}` is explicit where needed.
- Fix stale skill fixtures requiring `instructionFormat`.
- Fix stale capability fixtures requiring `capabilities.required`.

Acceptance criteria:

- `pnpm.cmd --filter @motionvideo/motion-protocol typecheck` passes.
- `pnpm.cmd --filter @motionvideo/motion-compiler typecheck` passes.

## Production Validation Hardening

### P1. Add Timeline Semantic Validation

Problem:

Current schema validates field shape but not timeline-level meaning.

Files:

- `packages/motion-protocol/src/v3/timeline.ts`
- `packages/motion-protocol/src/v3/references/project.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`

Tasks:

- Validate `workArea.end <= timeline.duration` when `timeline.duration` exists.
- Validate timeline markers `t <= timeline.duration` when duration exists.
- Validate visual clip `start + duration <= timeline.duration` when duration exists.
- Validate audio track `start + duration <= timeline.duration` when duration exists.
- Validate caption token start/end within timeline duration when duration exists.
- Decide whether `timeline.duration` is required for production export or can be derived.
- If derived, implement deterministic duration derivation in compiler and expose it in runtime metadata.

Acceptance criteria:

- Invalid timeline-boundary projects fail parse/reference validation.
- MP4 export has deterministic total duration.

### P1. Validate Scene Clip And Scene Duration Boundaries

Problem:

Scene-local animation can exceed scene duration without a clear protocol decision.

Files:

- `packages/motion-protocol/src/v3/scenes.ts`
- `packages/motion-protocol/src/v3/references/project.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`
- `packages/motion-compiler/src/index.ts`

Tasks:

- Resolve schedules to absolute scene time during reference validation where possible.
- Validate absolute scene clip `at + duration <= scene.duration`.
- Validate `scene-end` schedule does not produce negative start.
- Validate marker-relative keyframe times resolve inside scene duration.
- Decide policy for `after`/`with` clips that extend beyond scene duration: reject or clamp.

Acceptance criteria:

- Scene animation cannot silently render outside scene bounds.
- Compiler diagnostics match parser/reference validation.

### P1. Validate Transition Duration And Adjacency

Problem:

Transitions are accepted independently from clip duration and neighboring clips.

Files:

- `packages/motion-protocol/src/v3/timeline.ts`
- `packages/motion-protocol/src/v3/references/project.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`
- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`

Tasks:

- Validate `transitionIn.duration <= clip.duration`.
- Validate `transitionOut.duration <= clip.duration`.
- Validate `transitionIn.duration + transitionOut.duration <= clip.duration`.
- For `crossfade`, define whether adjacent clips must overlap by exactly transition duration.
- Add tests for too-long fade, too-long crossfade, and valid overlay fade.

Acceptance criteria:

- Transition edge cases are rejected before compile.
- Renderer does not need to guess transition behavior.

## Component Public API Hardening

### P1. Type Public Targets And Public Props

Problem:

Component node `publicProps` only validates public target keys, not value compatibility.

Files:

- `packages/motion-protocol/src/v3/components.ts`
- `packages/motion-protocol/src/v3/layers/component.ts`
- `packages/motion-protocol/src/v3/references/project.ts`
- `packages/motion-compiler/src/compile-v3.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`
- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`

Tasks:

- Add `valueKind` or `schema` to `ComponentPublicTargetV3Schema`.
- Validate `publicProps[targetId]` against the public target kind.
- Validate variable refs used in public props against expected value kind when possible.
- Reject unknown public props in `parseMotionProjectV3`.
- Reject incompatible values such as string assigned to transform number.
- Add tests for valid numeric transform prop, invalid string transform prop, valid color/text prop, unknown target id.

Acceptance criteria:

- User can only edit public fields that owner exposes.
- Public field values are typed and validated before compile.

### P1. Define And Apply Variant Semantics

Problem:

`variantId` is validated for existence, but variant params are not clearly applied.

Files:

- `packages/motion-protocol/src/v3/components.ts`
- `packages/motion-protocol/src/v3/layers/component.ts`
- `packages/motion-compiler/src/compile-v3.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`
- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`

Tasks:

- Decide variant model: public target overrides, public param defaults, or named action/layout preset.
- Prefer explicit `overrides: Record<publicTargetId, ResolvableValue>` for strict validation.
- Validate every variant override targets an existing public target.
- Apply variant overrides before consumer `publicProps`.
- Define precedence: component defaults < variant overrides < consumer publicProps.
- Add tests for valid variant, unknown variant, invalid variant override, and publicProps overriding variant.

Acceptance criteria:

- `variantId` changes compiled runtime deterministically.
- Variant does not expose internals beyond public targets.

### P2. Add Slot Content Contract Or Defer Explicitly

Problem:

Slots exist in component schema but component node instances do not yet provide slot content.

Files:

- `packages/motion-protocol/src/v3/components.ts`
- `packages/motion-protocol/src/v3/layers/component.ts`
- `packages/motion-protocol/src/v3/references/project.ts`

Tasks:

- Either add `payload.slots` to component node with strict slot content schemas.
- Or mark slots as reserved/future and do not expose them to production authoring.
- If implemented, validate slot id, count, accepted content kind, and fallback.

Acceptance criteria:

- No half-supported slot feature ships silently.

## Migration Cleanup

### P1. Make Legacy Component Clip Migration Collision-Safe

Problem:

`normalizeMotionProjectV3` currently synthesizes scene ids from component id only, which can collide.

Files:

- `packages/motion-protocol/src/v3/normalize.ts`
- `packages/motion-protocol/src/v3/__tests__/normalize.test.ts`

Tasks:

- Generate scene id from track id and clip id, for example `component-scene__${track.id}__${clip.id}`.
- Generate component node id from clip id, for example `component-instance__${clip.id}`.
- Check existing scene ids and append deterministic suffix on collision.
- Add test for two clips using the same component.
- Add test for pre-existing scene id collision.
- Add test that migrated scene keeps clip duration and transform tracks.

Acceptance criteria:

- Legacy migration never creates duplicate scene ids or node ids.
- Migration remains opt-in.

### P2. Decide Normalizer Policy For Production Import

Problem:

Legacy migration is useful for old projects, but production authoring should stay strict.

Files:

- `packages/motion-protocol/src/v3/normalize.ts`
- `packages/motion-protocol/src/v3/parse.ts`
- `docs/guide/v3-format-guide.md`
- `docs/guide/v3-component-guide.md`

Tasks:

- Keep `parseMotionProjectV3` strict and non-migrating.
- Add separate `migrateLegacyMotionProjectV3` or document explicit `normalizeMotionProjectV3(..., { migrateComponentClipsToScenes: true })`.
- Document that app import may offer migration, but saved canonical V3 must be scene-only.

Acceptance criteria:

- Production saved files never contain component visual clips.
- Legacy import path is explicit and auditable.

## Track And Layer Policy

### P1. Define Main Track Overlap Policy

> **✅ DONE** — Decision: `main` clips must not overlap unless a non-cut transition (`transitionOut`/`transitionIn`, e.g. `crossfade`) bridges them; `overlay` tracks may overlap freely. Duplicate clip ids (timeline-wide) are rejected. Duplicate track `order` is allowed with a stable tie-breaker (compiler sorts by `order`; ties preserve original array order). Implemented in `packages/motion-protocol/src/v3/timeline/validation.ts`.

Problem:

`main` and `overlay` are defined but overlap semantics are not enforced.

Files:

- `packages/motion-protocol/src/v3/timeline.ts`
- `packages/motion-protocol/src/v3/references/project.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`
- `docs/guide/v3-format-guide.md`

Tasks:

- Decide whether `main` tracks are sequential/non-overlap or can overlap like any visual layer.
- Recommended: `main` clips should not overlap unless transition/crossfade explicitly permits overlap.
- Allow arbitrary overlap on `overlay`.
- Validate duplicate `order` policy or define stable tie-breaker by original array order.
- Add tests for main overlap reject, transition overlap accept, overlay overlap accept.

Acceptance criteria:

- Timeline behavior is deterministic and documented.

### P2. Revisit Empty Visual Track Policy

Problem:

`VisualTrackV3Schema.clips.min(1)` is strict for final files but inconvenient for editor state.

Files:

- `packages/motion-protocol/src/v3/timeline.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`

Tasks:

- Decide if canonical production project allows empty tracks.
- Recommended: allow empty tracks in app draft state, but export canonical project omits empty tracks.
- If protocol stays production-only, keep `.min(1)` and document it.

Acceptance criteria:

- Editor and production export have a clear boundary.

## Test Matrix

Required protocol tests:

- Scene-only visual clip accepts.
- Component visual clip rejects.
- Runtime component clip source rejects.
- Legacy component clip migrates to scene-only when opt-in.
- Timeline clip exceeds duration rejects.
- Audio track exceeds duration rejects.
- Work area exceeds duration rejects.
- Marker exceeds duration rejects.
- Transition exceeds clip duration rejects.
- Component public prop unknown target rejects.
- Component public prop wrong value kind rejects.
- Variant unknown id rejects.
- Variant override unknown public target rejects.

Required compiler tests:

- Runtime clip preserves authored `start`.
- Overlay clip at non-zero start preserves start.
- Crossfade clip authored at `2.5` remains `2.5`.
- Gap between clips remains a gap.
- Component node transform compiles into wrapper group transform.
- Scene-local motion targeting component node remaps to wrapper group.
- Public props apply through public targets only.
- Variant applies before public props.
- Runtime output has no `source.kind: "component"`.

Required type gates:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol typecheck
pnpm.cmd --filter @motionvideo/motion-compiler typecheck
```

Required test gates:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
```

Optional wider gates after core fixes:

```powershell
pnpm.cmd typecheck
pnpm.cmd validate:v3-source-of-truth
pnpm.cmd validate:motion-fixtures
```

## Suggested Implementation Order

1. Fix typecheck errors that directly come from scene-only source changes.
2. Remove runtime/MCP legacy component clip source.
3. Fix compiler `clip.start` preservation and update tests/goldens.
4. Add timeline duration and transition semantic validation.
5. Type `publicTargets` and validate `publicProps`.
6. Define/apply variants.
7. Make legacy migration collision-safe.
8. Update docs and format guide.
9. Run full protocol/compiler tests and typecheck.

## Done Definition

Production readiness for this scope means:

- No canonical V3 or runtime schema accepts component visual clip source.
- Component is only a sealed scene node with public API.
- Runtime timeline timing matches authoring timeline timing.
- Typecheck is green for protocol and compiler.
- Tests cover scene-only timeline, component node transform animation, public API validation, and legacy migration.
- Docs state the canonical model clearly enough that dev/design users do not generate invalid shapes.
