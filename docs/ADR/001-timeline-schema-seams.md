# ADR-001: Timeline schema seams before trim / transition / video features

- **Status:** Accepted
- **Date:** 2026-07-31
- **Context:** Phase 7 export/persistence DoD is met. Phase 8 spikes proved command-runner, history, snapping, and document metadata seams without shipping UI.

## Decisions

### 1. Trim edge model

- Trim is a **command** (`clip/trim`), not a direct store mutation.
- Scene clips: update `duration` (+ optional `startTime`); scene payload duration stays in sync via runner.
- Audio clips: update clip `duration`/`startTime` and track `trimStart` together.
- Undo/redo restores both placement and `trimStart` via document snapshots (existing history seam).
- UI edge handles remain out of scope until a dedicated feature PR; do not fork a second trim path in React.

### 2. Transition persistence

- Transitions live on **`TimelineDocument.transitions[]`** (document aggregate), not on `TimelineClipItem` or Motion Format scene nodes yet.
- Each entry refs `fromClipId` / `toClipId` with optional `kind: cut | fade | crossfade` (aligned with format freeze).
- Invariants: unique transition ids; both clip ids must exist.
- Command stub: `transition/add`. Rendering/export of transitions is a later feature; deleting the stub must not affect placement/export until wired.

### 3. Video / caption (and future) clip kinds

- Production `TimelineClip` stays `scene | audio` until a real feature lands.
- New kinds must update **exhaustive** adapters in the same PR: `clipCapabilities` / `assertNever`, validate, command runner, preview compose, export bake, migration.
- Spike D showed unknown kinds throw at runtime via `assertNever`; do not add silent `default` fallthroughs.

### 4. Snapping

- Placement uses injectable `SnappingPolicy` (`resolveLaneStartTime` + `findNearestSnapTime`).
- Default wraps existing nearest-gap behavior; sessions/commands should pass overrides only in tests or future preferences — not hard-code alternate snap math in UI.

## Consequences

- Feature work for trim UI, transition UI, and video/caption kinds can land as thin wrappers over these contracts.
- Removing spike-only tests must leave production behavior unchanged (unknown commands stay `rejected`; optional `transitions` remain valid when absent).
