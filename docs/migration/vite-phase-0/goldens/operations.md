# Serialized operation goldens

Each `*.after.json` is the timeline document snapshot **after** one deterministic command (or undo/redo) applied to a known fixture.

| File | Base fixture | Operation |
|---|---|---|
| `move-clip.after.json` | `fixtureMainOnly` | `move-clip` `clip.main.b` → `startTime: 3` |
| `trim-clip.after.json` | `fixtureMainOnly` | `clip/trim` `clip.main.a` → `duration: 1.25` |
| `split-clip.after.json` | `fixtureMainOnly` | `split-selected-clips` at `t=1` on `clip.main.a` |
| `duplicate-clip.after.json` | `fixtureMainOnly` | `duplicate-selected-clips` on `clip.main.b` |
| `delete-clip.after.json` | `fixtureBasePlusOverlay` | `delete-selected-clips` on `clip.overlay` |
| `lane-lock.after.json` | `fixtureMainOnly` | `update-lane-flags` `lane.main` `{ locked: true }` |
| `lane-reorder.after.json` | `fixtureBasePlusOverlay` | `reorder-lane` `lane.overlay.0` → `newOrder: 0` |
| `undo-after-move.after.json` | store + `fixtureMainOnly` | move then `undo` |
| `redo-after-undo.after.json` | store + `fixtureMainOnly` | move → undo → `redo` |

## Determinism

IDs from `uid()` / `cloneSceneWithNewIds` are stabilized by mocking `Math.random` during generation (`withDeterministicIds`).

## Regenerate + lock

```bash
pnpm --filter @motionvideo/web generate:vite-phase0
pnpm --filter @motionvideo/web test -- lib/editor/__tests__/vite-phase0-goldens.test.ts
```

Do not hand-edit golden JSON — regenerate from the command seam.
