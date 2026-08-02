# Performance baseline (Phase 0)

Measured on legacy stack (Next editor + command seam). Wall-clock UI numbers are machine-local; command micro-benchmarks are deterministic enough to re-run in CI scripts without asserting.

**Host:** Windows 10 · Node 24 · Chromium (Playwright) / command bench via `tsx`  
**Date:** 2026-07-31

## Command seam micro-benchmarks

```bash
pnpm --filter @motionvideo/web exec tsx scripts/bench-vite-phase0-commands.ts
```

| Operation | Samples | Avg (ms) |
|---|---:|---:|
| move-clip | 200 | 0.039 |
| trim-clip | 200 | 0.021 |
| split-clip | 100 | 0.058 |
| delete-clip | 200 | 0.017 |

Fixture builders:

| Builder | Wall time (approx) |
|---|---|
| `buildPhase0LargeFixture()` (100 clips) | ~12 ms |
| `buildPhase0Goldens()` (all ops) | ~6 ms |

## UI / Electron checklist (manual)

Procedure from [`performance-baseline.ts`](../../../apps/web/lib/editor/__fixtures__/performance-baseline.ts). Fill on the machine used for cutover comparisons.

| Metric | Fixture | How | Measured |
|---|---|---|---|
| Cold start → editor visible | small | Stopwatch: `pnpm dev` + `pnpm dev:desktop`, open seeded editor | record locally |
| Project open → timeline first paint | small / large | Performance panel (navigation → paint) | record locally |
| Timeline horizontal scroll long task | large (100) or in-memory 500 | Performance panel while scrolling | no new long task > 50ms target |
| Clip drag RAF / setState | medium | Performance panel during drag | ≤1 RAF flush / frame |
| Playback playhead smoothness | medium | Eye + Performance | ~60fps playhead transform |

Automated DOM-count budgets remain in vitest (`visible-range` / virtualization). Do **not** assert wall-clock UI timings in CI.

## Stress fixtures

- Committed: `fixtures/large.project.json` (100 clips, schema-valid)
- In-memory: `createDenseTimelineFixture(500|2000)` for DOM budget only
