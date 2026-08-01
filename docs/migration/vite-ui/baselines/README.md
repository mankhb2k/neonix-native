# Screenshot baselines (P20)

- **Baselines** (`*.png` here): Electron captures of **real** `HubScreen` / `EditingWorkspace` (`status: electron-production-ui`).
- **Placeholders** (`placeholders/`): solid-color PNGs only — not for visual regression.

Requires fixture-enabled renderer build:

```bash
# Capture (sets VITE_ENABLE_UI_FIXTURES=1 for the renderer build)
node apps/desktop/scripts/capture-parity-baselines.mjs --electron

# Compare sizes / presence (optional EXPECT_SHA=1 for exact hashes)
node apps/desktop/scripts/compare-baselines.mjs
```

Query `?fixture=` is ignored unless `VITE_ENABLE_UI_FIXTURES=1`. Capture window uses `frame: false` like production.
