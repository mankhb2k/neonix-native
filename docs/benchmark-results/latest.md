# Engine Benchmark Report

> Generated: 2026-08-09T18:40:41.871Z
> Node: v24.12.0
> Platform: win32 x64

## Summary

| Scenario | FPS | Scenes | Layers | Frames | Compile (ms) | Eval (ms) | P50 (ms) | P95 (ms) | P99 (ms) | RSS (MB) |
|---|---|---|---|---|---|---|---|---|---|---|
| small · 1s × 3L @ 30fps | 30 | 1 | 3 | 150 | 0.01 | 0.56 | 0.001 | 0.002 | 0.027 | 69.33 |
| small · 1s × 3L @ 60fps | 60 | 1 | 3 | 300 | 0 | 0.8 | 0.001 | 0.003 | 0.051 | 69.49 |
| medium · 3s × 10L @ 30fps | 30 | 3 | 30 | 300 | 0 | 0.35 | 0.001 | 0.001 | 0.002 | 69.57 |
| medium · 3s × 10L @ 60fps | 60 | 3 | 30 | 600 | 0 | 1.31 | 0.001 | 0.001 | 0.003 | 69.82 |
| large · 10s × 30L @ 30fps | 30 | 10 | 300 | 900 | 0.07 | 2.62 | 0.002 | 0.003 | 0.012 | 70.13 |
| large · 10s × 30L @ 60fps | 60 | 10 | 300 | 1800 | 0 | 6.39 | 0.003 | 0.005 | 0.013 | 73.8 |

## Notes

- Phase 0 baseline — measures fixture creation + simulated per-frame transform math
- Real compile/evaluate/paint wired in Phase 1
