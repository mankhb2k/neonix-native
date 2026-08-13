# Timeline Runtime Duration And Folder Refactor Plan

## Goal

Make timeline duration production-ready end-to-end and reorganize V3 timeline code into a dedicated module folder.

Production target:

- `timeline.duration` is the final MP4 length.
- Compiler derives `timeline.duration` when authoring input omits it.
- Runtime/render paths use `timeline.duration` and `clip.start` as source of truth.
- Gaps, overlays, audio/caption extensions, and manual tail padding render correctly.
- V3 timeline-related schema/utilities live under `src/v3/timeline/`.

## Current Status

Already implemented:

- `deriveTimelineDurationV3()` derives duration from visual/audio/caption content.
- `canonicalizeTimelineDurationV3()` fills missing duration without mutating input.
- Compiler emits `CMP_TIMELINE_DURATION_DERIVED` warning.
- Runtime output includes `timeline.duration`.
- Protocol/compiler tests and typecheck pass.

Remaining production issues:

- Some render/runtime consumers still compute start times by cursor and ignore `clip.start`.
- Some duration helpers still derive from clip end instead of preferring explicit `runtime.timeline.duration`.
- Runtime audio validation cannot check audio end because runtime audio track lacks `duration`.
- Timeline files are now growing enough to justify a `v3/timeline/` folder.

## Principles

- Authoring schema may allow missing `timeline.duration`.
- Canonical/export/runtime output must have explicit `timeline.duration`.
- Declared duration larger than content is valid and means empty tail.
- Declared duration smaller than content is invalid.
- Visual clip `start` is absolute global timeline time.
- Runtime/render must not reconstruct clip starts by cursor.
- Move files with compatibility barrels to avoid breaking existing imports.

## Phase 1. Lock Down Runtime Duration Semantics

### Tasks

- Decide runtime policy:
  - Recommended: runtime `timeline.duration` should be required for compiler-emitted runtime IR.
  - If backward compatibility is needed, create a legacy-compatible parser separately.
- Update runtime timeline schema to make `duration` required if production runtime no longer supports missing duration.
- Keep `duration >= 0` at schema level.
- Add export/render guard that rejects `duration <= 0` for MP4 export.

### Files

- `packages/motion-protocol/src/runtime/project.ts`
- `packages/motion-protocol/src/runtime/__tests__/project.test.ts`
- `apps/render-worker/src/index.ts`

### Tests

- Runtime accepts `timeline.duration`.
- Runtime rejects missing `timeline.duration` if making it required.
- Runtime accepts `duration: 0` at protocol level if draft/legacy is allowed.
- Render-worker rejects export when compiled duration is `0`.

### Acceptance Criteria

- Runtime IR has a clear canonical duration rule.
- MP4 export never renders an accidental zero-length video.

## Phase 2. Fix Timeline Duration Helpers

### Problem

`timelineTotalDuration()` currently derives from visual clips only. This ignores explicit manual tail padding and any runtime duration produced by compiler canonicalization.

### Tasks

- Update `timelineTotalDuration(runtime)` to:
  - Return `runtime.timeline.duration` when it is defined.
  - Fall back to max visual clip end for legacy runtime only.
- Consider including audio/caption in fallback if runtime audio/caption have enough data.
- Remove component-source fallback if runtime is now scene-only.

### Files

- `packages/motion-runtime/src/resolve-timeline.ts`
- `packages/motion-runtime/src/resolve-timeline.test.ts`
- `apps/web/components/editor/timeline/MinimalTimeline.tsx`
- renderer parity tests that use `timelineTotalDuration()`

### Tests

- Explicit `timeline.duration: 10` with visual ending at `8` returns `10`.
- Missing duration falls back to visual end.
- Empty runtime with duration `0` returns `0`.
- Runtime scene-only source works with no component fallback.

### Acceptance Criteria

- Preview/editor timeline length matches canonical/runtime duration.
- Manual empty tail is visible to consumers.

## Phase 3. Fix Render-Worker Frame Plan To Use `clip.start`

### Problem

`apps/render-worker/src/runtime/frame-plan.ts` still uses cursor-based `sceneStartTimes()`, which breaks gaps and overlays.

### Tasks

- Replace cursor-based scene starts with authored runtime clip starts.
- Update `projectFrameLayers()` to evaluate all visual tracks, not only the primary track, or explicitly document if render-worker currently supports primary only.
- Sort clips by:
  - track order
  - clip start
  - stable original order as tie-breaker
- Resolve local time as:

```ts
localTime = globalTime - clip.start
```

- A clip is active when:

```ts
globalTime >= clip.start && globalTime < clip.start + clip.duration
```

- Keep opacity/transition handling, but base it on `clip.start`.
- Make `projectDuration()` prefer `compiled.timeline.duration`.
- Remove or rewrite `sceneStartTimes()` if it can no longer represent overlay/multi-track timelines correctly.

### Files

- `apps/render-worker/src/runtime/frame-plan.ts`
- `apps/render-worker/src/runtime/index.ts`
- `apps/render-worker/src/runtime/paint-canvas.ts`
- `apps/render-worker/src/runtime/draw.ts`
- render-worker tests, add if missing

### Tests

- Gap test: clips at `0..3` and `5..8`; frame at `4` has no visual layer or background only.
- Manual tail test: content ends at `8`, duration `10`; frames at `9` still exist.
- Overlay test: overlay clip at `2..4` appears over primary clip.
- Non-zero first clip test: first clip starts at `2`; frames before `2` are background only.
- Existing sequential scene tests still pass.

### Acceptance Criteria

- Render-worker frame plan respects absolute timeline placement.
- Export frame count uses explicit `timeline.duration`.
- Gaps and manual tail render correctly.

## Phase 4. Fix Motion Runtime Composition Evaluation

### Problem

`packages/motion-runtime/src/evaluate-composition.ts` builds composition scene inputs without `clip.start`, then `evaluate-composition-layers.ts` reconstructs sequential starts with cursor.

### Tasks

- Extend `CompositionSceneInput` with `start`.

```ts
export type CompositionSceneInput = {
  sceneId: string;
  start: number;
  duration: number;
  transitionIn?: CompositionTransition;
  transitionOut?: CompositionTransition;
  trackId?: string;
  trackOrder?: number;
};
```

- Update `scenesForComposition(runtime)` to include `clip.start`.
- Rewrite `buildSegments()` to use `scene.start`, not cursor.
- Decide transition semantics:
  - Clip transition uses clip's own absolute start/end.
  - Crossfade should not move clip starts.
  - Transition affects compositing around fixed clip boundaries.
- Update `compositionTotalDuration()` to prefer explicit runtime duration when available, or compute max segment end.
- Update `evaluateCompositionFrameV3()` boundary check to use explicit `timeline.duration`.

### Files

- `packages/motion-runtime/src/evaluate-composition.ts`
- `packages/motion-runtime/src/composition/evaluate-composition-layers.ts`
- `packages/motion-runtime/src/composition/evaluate-composition-layers.test.ts`
- `packages/motion-runtime/src/__tests__/phase3-composition-frame.test.ts`
- `packages/motion-runtime/src/__tests__/frame-fingerprints.test.ts`

### Tests

- Gap between scenes produces no scene layer during gap.
- Clip start is preserved in composition layer local time.
- Overlay clip at `start: 2` appears only from `2..end`.
- Manual tail frame returns background/no layer instead of truncating.
- Crossfade between clips with explicit starts behaves deterministically.

### Acceptance Criteria

- Motion runtime preview/evaluation matches compiler timeline.
- No cursor-derived start remains in V3 composition path.

## Phase 5. Runtime Audio Duration Policy

### Problem

Authoring audio has `duration`, but runtime audio track schema currently drops it. Runtime validation can only check `audio.start`, not `audio.start + duration`.

### Tasks

- Decide whether runtime audio should preserve `duration`.
- Recommended: keep runtime audio `duration`, `playbackRate`, `muted`, and maybe `trimEnd` if renderer needs them.
- Update `prepareRuntimeAudioTrack()` to include duration.
- Update `AudioTrackSchema` in runtime protocol.
- Validate `audio.start + audio.duration <= runtime.timeline.duration`.
- Update golden runtime fixtures.

### Files

- `packages/motion-protocol/src/runtime/project.ts`
- `packages/motion-compiler/src/compile-v3.ts`
- `packages/motion-compiler/src/__fixtures__/runtime-compile-goldens/*.runtime.json`
- audio/caption compiler or render paths if they consume runtime audio

### Tests

- Runtime rejects audio ending beyond duration.
- Runtime accepts audio exactly ending at duration.
- Compiler runtime output preserves audio duration.
- Golden fixtures include audio duration where audio tracks exist.

### Acceptance Criteria

- Runtime IR is self-contained enough to validate audio timeline boundaries.

## Phase 6. Add Missing Timeline Integrity Validation

### Tasks

- Add duplicate visual clip id validation.
- Decide scope:
  - Recommended: visual clip ids unique across entire timeline, not just per track.
- Add duplicate track order policy:
  - Either allow with stable tie-breaker.
  - Or reject duplicate `order`.
- Define main-track overlap policy:
  - Recommended: `main` clips cannot overlap except when explicit crossfade/transition policy allows it.
  - Overlay tracks may overlap.
- Validate `clip.trimStart + clip.duration` against source scene duration when `loop` is false.
- Validate scene-local motion clips stay within scene duration where schedules can be resolved.

### Files

- `packages/motion-protocol/src/v3/references/project.ts`
- `packages/motion-protocol/src/v3/timeline.ts`
- `packages/motion-protocol/src/v3/scenes.ts`
- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`

### Tests

- Duplicate visual clip id rejects.
- Duplicate visual clip ids across different tracks reject.
- Main-track overlap rejects.
- Overlay overlap accepts.
- Main crossfade overlap accepts only if policy supports it.
- Visual clip trim exceeds source scene rejects.
- Scene-local absolute clip beyond scene duration rejects.
- Scene-end schedule that would start before zero rejects or is explicitly documented.

### Acceptance Criteria

- Timeline is deterministic and safe for render/export.
- No duplicate/collision-prone ids in runtime scene clone ids.

## Phase 7. Refactor To `src/v3/timeline/`

### Recommendation

Do this after behavior fixes above so file moves do not hide logic changes in review.

### Target Structure

```text
packages/motion-protocol/src/v3/timeline/
  index.ts
  schema.ts
  duration.ts
  canonicalize.ts
  validation.ts
  types.ts
```

### File Mapping

- Current `src/v3/timeline.ts` -> `src/v3/timeline/schema.ts`
- Current `src/v3/timeline-duration.ts` -> `src/v3/timeline/duration.ts`
- Current `src/v3/canonicalize.ts` duration-specific logic -> `src/v3/timeline/canonicalize.ts`
- Future timeline integrity helpers -> `src/v3/timeline/validation.ts`
- Timeline type aliases -> `src/v3/timeline/types.ts` or keep next to schema if simpler.

### Compatibility Plan

Keep old import paths working:

```ts
// packages/motion-protocol/src/v3/timeline.ts
export * from "./timeline/index";
```

```ts
// packages/motion-protocol/src/v3/timeline-duration.ts
export * from "./timeline/duration";
```

```ts
// packages/motion-protocol/src/v3/canonicalize.ts
export * from "./timeline/canonicalize";
```

Update internal imports gradually to the new folder paths.

### Export Updates

Files:

- `packages/motion-protocol/src/v3/index.ts`
- `packages/motion-protocol/src/index.ts`
- `packages/motion-protocol/src/v3/project.ts`
- `packages/motion-compiler/src/compile-v3.ts`

Tasks:

- Export timeline schemas from `./timeline`.
- Keep public root exports unchanged.
- Avoid circular imports:
  - `timeline/schema.ts` should not import from `project.ts`.
  - `timeline/duration.ts` should import only timeline types.
  - `timeline/canonicalize.ts` may import project type only as `import type`.

### Tests

- Existing protocol tests pass without changing external import paths.
- Add a small import compatibility test if useful:

```ts
import { ProjectTimelineV3Schema } from "../timeline";
import { deriveTimelineDurationV3 } from "../timeline-duration";
```

### Acceptance Criteria

- Existing public imports continue to work.
- New code can import from `src/v3/timeline`.
- No circular dependency regression.

## Phase 8. Documentation Update

### Files

- `docs/guide/v3-format-guide.md`
- `docs/guide/v3-component-guide.md`
- `docs/timeline-duration-derivation-plan.md`
- `docs/runtime-mcp-legacy-cleanup-production-plan.md`

### Tasks

- Document `clip.start` as absolute global timeline time.
- Document `timeline.duration` as final MP4 length.
- Document compiler derivation.
- Document manual empty tail.
- Document render behavior during gaps:
  - background only.
  - audio/caption may still exist.
- Document main vs overlay overlap policy after final decision.
- Document new source layout `v3/timeline/`.

### Acceptance Criteria

- Dev/design users can produce valid timeline data without guessing semantics.

## Phase 9. End-To-End Gate

### Required Commands

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol typecheck
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler typecheck
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime typecheck
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/render-worker typecheck
pnpm.cmd --filter @motionvideo/render-worker test
```

### Optional Wider Gates

```powershell
pnpm.cmd typecheck
pnpm.cmd validate:v3-source-of-truth
pnpm.cmd validate:motion-fixtures
pnpm.cmd e2e:render
```

## Done Definition

This work is complete when:

- Compiler fills missing `timeline.duration`.
- Runtime IR carries explicit `timeline.duration`.
- Render-worker frame plan uses `clip.start`.
- Motion-runtime composition evaluation uses `clip.start`.
- Timeline total duration helpers prefer explicit runtime duration.
- Runtime validates visual/audio/caption boundaries against duration.
- Manual empty tail renders as frames.
- Gaps render correctly.
- Overlay starts render correctly.
- Timeline code is organized under `src/v3/timeline/`.
- Old public import paths remain compatible.
- Protocol, compiler, runtime, and render-worker tests/typecheck pass.
