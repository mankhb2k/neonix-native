# Phase 0 project fixtures

Persisted editor envelopes (`storageVersion: 2`) for legacy ↔ Vite parity.

| File | Project id | Intent |
|---|---|---|
| `small.project.json` | `vite-phase0.small` | 2 main clips — open/smoke |
| `medium.project.json` | `vite-phase0.medium` | Base + overlay + 2 audio lanes |
| `large.project.json` | `vite-phase0.large` | 100 clips (schema max scenes) — scroll/virtualization |

## Schema note

`motion-project` v2 caps `scenes` / `sceneOrder` at **100**. Committed `large` uses 100 clips so `parseMotionProject` succeeds.

For in-memory stress (500 / 2000 clips) use `createDenseTimelineFixture` in [`apps/web/lib/editor/__fixtures__/large-timeline.ts`](../../../apps/web/lib/editor/__fixtures__/large-timeline.ts) — those bypass schema parse and are for unit DOM-budget tests only.

## Regenerate

```bash
pnpm --filter @motionvideo/web generate:vite-phase0
```

Builders live in [`apps/web/lib/editor/__fixtures__/vite-phase0.ts`](../../../apps/web/lib/editor/__fixtures__/vite-phase0.ts).

## Seed into localStorage (manual / Playwright)

Prefer the per-project adapter key after migration:

- Index: `motionvideo.projectIndex`
- Record: `motionvideo.project.<id>`

Legacy e2e still seeds `motionvideo.projects` collection; the adapter migrates on load.
