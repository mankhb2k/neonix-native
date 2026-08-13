# Timeline Duration Derivation Implementation Plan

## Goal

Make `timeline.duration` production-safe without forcing users to manually enter it.

The app/compiler should derive `timeline.duration` from the last timeline content end when it is missing, then validate and export a canonical timeline with an explicit duration.

## Decision

`timeline.duration` means the final MP4 timeline length in seconds.

Authoring input may omit it:

```json
{
  "timeline": {
    "visualTracks": [],
    "audioTracks": [],
    "captionTracks": []
  }
}
```

Compiler/canonicalizer should fill it:

```json
{
  "timeline": {
    "duration": 10,
    "visualTracks": [],
    "audioTracks": [],
    "captionTracks": []
  }
}
```

## Duration Derivation Rule

Compute:

```ts
derivedDuration = max(
  ...visualTracks.flatMap((track) =>
    track.clips.map((clip) => clip.start + clip.duration),
  ),
  ...audioTracks.map((track) => track.start + track.duration),
  ...captionTracks.flatMap((track) => track.tokens.map((token) => token.end)),
);
```

If no visual/audio/caption content exists:

```ts
derivedDuration = 0;
```

## Declared Duration Rule

If `timeline.duration` is missing:

```ts
timeline.duration = derivedDuration;
```

If `timeline.duration` exists and is smaller than `derivedDuration`:

```ts
throw validation error
```

If `timeline.duration` exists and is larger than `derivedDuration`:

```ts
allow;
```

Reason: the author intentionally keeps empty tail at the end of the MP4.

## Production Export Rule

For MP4 export:

- final runtime/canonical project must always have `timeline.duration`.
- duration must be `> 0`.
- empty draft timeline may have `duration = 0`, but export should reject it unless the product explicitly supports blank videos.

## Timeline Integrity & Absolute Start Semantics

`clip.start` is the **absolute global timeline time** in seconds (from 0). It is
NOT a relative offset. Compiler/runtime/render must preserve `clip.start`
verbatim and never reconstruct starts with a cursor.

Overlap & integrity policy (validated at parse time):

- Duplicate visual clip id → reject (unique across the entire timeline, not per track).
- Duplicate visual track `order` → allow with stable tie-breaker (compiler sorts
  by `order` using a stable sort; ties preserve original array order).
- `main` track clips must not overlap unless a non-cut transition
  (`transitionOut` / `transitionIn`, e.g. `crossfade`) bridges them.
- `overlay` tracks may overlap freely.
- `clip.trimStart + clip.duration * playbackRate` must be ≤ source scene
  duration when `loop` is false.
- Scene-local motion clips must fit within the scene duration where schedules
  resolve statically (`absolute`, `scene-end`).

Gaps: time between clips is valid — only background renders during a gap
(audio/caption may still exist).

Source layout: timeline schema/utilities live in
`packages/motion-protocol/src/v1/timeline/` (`schema.ts`, `duration.ts`,
`canonicalize.ts`, `validation.ts`, `index.ts`).

## Implementation Phases

### Phase 1. Add Duration Utilities

Files:

- `packages/motion-protocol/src/v1/timeline-duration.ts`
- `packages/motion-protocol/src/v1/index.ts`
- `packages/motion-protocol/src/index.ts`

Tasks:

- Create `deriveTimelineDurationV1(timeline)` utility.
- Create `getVisualTimelineEndV1(timeline)` helper.
- Create `getAudioTimelineEndV1(timeline)` helper.
- Create `getCaptionTimelineEndV1(timeline)` helper.
- Ensure returned duration is finite and rounded consistently.
- Use canonical rounding, for example `Math.round(value * 1e9) / 1e9`.

Suggested API:

```ts
export function deriveTimelineDurationV1(timeline: ProjectTimelineV1): number;

export function hasTimelineContentV1(timeline: ProjectTimelineV1): boolean;
```

Tests:

- visual-only duration.
- audio-only duration.
- caption-only duration.
- visual/audio/caption mixed duration uses max end.
- empty timeline returns `0`.
- gap between clips is preserved in duration.
- overlay clip extending beyond main track sets duration.

### Phase 2. Add Canonicalization/Normalization Step

Files:

- `packages/motion-protocol/src/v1/normalize.ts`
- or new file: `packages/motion-protocol/src/v1/canonicalize.ts`
- `packages/motion-protocol/src/v1/parse.ts`

Tasks:

- Add `canonicalizeTimelineDurationV1(project)` that fills missing `timeline.duration`.
- Do not mutate input.
- If duration is present, leave it unchanged.
- Return issues/warnings when duration is derived.

Suggested API:

```ts
export interface CanonicalizeTimelineDurationIssue {
  path: string;
  message: string;
  severity: "info" | "warn";
}

export function canonicalizeTimelineDurationV1(project: MotionProjectV1): {
  project: MotionProjectV1;
  issues: CanonicalizeTimelineDurationIssue[];
};
```

Decision point:

- `parseMotionProjectV1` should probably stay strict and not auto-fill.
- compiler should call canonicalization before semantic validation.
- app save/export can call canonicalization explicitly.

Recommended:

- `parseMotionProjectV1`: validates canonical project.
- `compileMotionProjectV1`: accepts authoring project, derives missing duration internally.
- `serializeMotionProjectV1`: serializes already-canonical project only.

Tests:

- canonicalization fills missing duration.
- canonicalization does not override declared larger duration.
- canonicalization does not mutate input.
- canonicalization returns info issue when deriving.

### Phase 3. Adjust Schema Validation Order

Files:

- `packages/motion-protocol/src/v1/timeline.ts`
- `packages/motion-protocol/src/v1/__tests__/schema.test.ts`

Tasks:

- Keep `timeline.duration` optional at schema level for authoring compatibility.
- Keep current boundary validation when duration exists.
- Add tests for declared duration smaller than content.
- Add tests for declared duration larger than content.
- Do not force required duration in raw schema unless creating a separate export schema.

Optional:

- Add `ExportTimelineV1Schema` or `CanonicalMotionProjectV1Schema` where duration is required.

Recommended production design:

```ts
MotionProjectV1Schema; // authoring/canonical-compatible, duration optional
CanonicalMotionProjectV1Schema; // export/save canonical, duration required
```

### Phase 4. Update Compiler Flow

Files:

- `packages/motion-compiler/src/compile-v1.ts`
- `packages/motion-compiler/src/compile-result.ts`
- `packages/motion-compiler/src/__tests__/compile-v1.test.ts`

Tasks:

- After normalizing input and before `validateV1Semantics`, derive timeline duration if missing.
- Use the derived/canonical project for all later compiler steps.
- Emit warning diagnostic when duration is derived.
- Add diagnostic code, for example `CMP_TIMELINE_DURATION_DERIVED`.
- Add error diagnostic when final duration is `0` and export requires non-empty MP4.
- Ensure runtime output includes the derived duration if runtime timeline schema supports it.

Compiler flow should become:

```ts
const normalized = parse/normalize input;
const canonical = fillTimelineDurationIfMissing(normalized);
validateV1Semantics(canonical);
buildVisualPlan(canonical);
emit runtime from canonical;
```

Tests:

- compile project without `timeline.duration` fills duration from visual clips.
- compile derives from audio when audio ends later than visual.
- compile derives from caption when caption ends later than visual/audio.
- compile preserves declared larger duration.
- compile rejects declared smaller duration.
- compile emits warning when deriving.

### Phase 5. Runtime Schema And Output

Files:

- `packages/motion-protocol/src/runtime/project.ts`
- `packages/motion-protocol/src/runtime/__tests__/project.test.ts`
- `packages/motion-compiler/src/compile-v1.ts`
- runtime golden fixtures.

Tasks:

- Decide where runtime duration lives.
- Recommended: add `timeline.duration` to runtime timeline.
- Keep `composition` for pixel/fps/color settings only.
- Use runtime `timeline.duration` as render length for MP4.
- Validate runtime clips/audio/caption do not exceed runtime duration.

Runtime shape:

```json
{
  "timeline": {
    "duration": 10,
    "visualTracks": [],
    "audioTracks": [],
    "captionTracks": []
  }
}
```

Tests:

- runtime accepts explicit duration.
- runtime rejects clip beyond duration.
- runtime rejects audio beyond duration.
- runtime rejects caption token beyond duration.
- runtime rejects duration `0` for export mode if export mode schema exists.

### Phase 6. App Export Boundary

Files:

- export pipeline files after locating current MP4/render entry.
- docs/guides.

Tasks:

- Before MP4 export, call canonicalization.
- If derived duration is `0`, block export with useful message.
- Show derived duration in UI as computed value if user did not set manual tail.
- If user wants tail padding, store declared duration larger than derived duration.

UX rule:

- Default duration is automatic.
- User can extend duration manually for empty tail.
- User cannot set duration shorter than content.

### Phase 7. Documentation

Files:

- `docs/guide/v1-format-guide.md`
- `docs/guide/v1-component-guide.md`
- `docs/runtime-mcp-legacy-cleanup-production-plan.md`

Tasks:

- Document `timeline.duration` as final MP4 length.
- Explain automatic derivation.
- Explain declared duration larger than content means empty tail.
- Explain declared duration smaller than content is invalid.
- Add JSON examples:
  - visual-only project.
  - audio longer than visual.
  - caption longer than visual.
  - manual tail padding.

## Test Matrix

### Protocol Unit Tests

- `deriveTimelineDurationV1` returns `0` for empty timeline.
- visual clip `start: 6`, `duration: 4` derives `10`.
- audio track ending at `12` derives `12`.
- caption token ending at `15` derives `15`.
- mixed timeline derives max of visual/audio/caption.
- declared `duration: 20` with content ending `10` is valid.
- declared `duration: 8` with content ending `10` is invalid.
- `workArea.end > duration` is invalid.
- marker beyond duration is invalid.

### Compiler Tests

- missing duration is filled before runtime emit.
- derived duration appears in runtime output.
- derived duration warning is emitted.
- declared larger duration is preserved.
- declared smaller duration fails compile.
- gap at end is preserved when duration is declared larger.

### Runtime Tests

- runtime timeline requires duration if this becomes canonical runtime.
- runtime visual clips fit within duration.
- runtime audio tracks fit within duration.
- runtime caption tokens fit within duration.
- runtime layer / track counts use `layersPerProject` and `motionClipsPerProject` (no visual/audio track arrays).

## Edge Cases

### Empty Draft

Input:

```json
{
  "timeline": {
    "visualTracks": [],
    "audioTracks": [],
    "captionTracks": []
  }
}
```

Derived:

```json
{
  "duration": 0
}
```

Export:

- reject unless blank video export is intentionally supported.

### Manual Tail

Content ends at `8`, declared duration is `10`.

Result:

- valid.
- MP4 length is `10`.
- last 2 seconds are empty/background/audio silence unless other tracks exist.

### Audio Longer Than Visual

Visual ends at `8`, audio ends at `10`.

Derived duration:

```ts
10;
```

Reason:

- audio is timeline content and must not be cut silently.

### Caption Longer Than Audio

Caption token ends at `12`.

Derived duration:

```ts
12;
```

Reason:

- captions are visible timeline content.

## Acceptance Criteria

- Compiler can accept project missing `timeline.duration`.
- Compiler/runtime output has explicit duration.
- Export duration is deterministic.
- Declared shorter duration is rejected.
- Declared longer duration is preserved.
- Tests and typecheck pass for protocol and compiler.
- Documentation explains automatic duration clearly.

## Commands

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol typecheck
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler typecheck
pnpm.cmd --filter @motionvideo/motion-compiler test
```

Optional after core changes:

```powershell
pnpm.cmd typecheck
pnpm.cmd validate:v1-source-of-truth
pnpm.cmd validate:motion-fixtures
```
