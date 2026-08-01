# Screenshot baselines (N2 / G4)

Capture Hub + Editor at **1280×720** and **1920×1080**. Store PNGs here when taken (manual or Playwright).

Suggested names:

- `hub-empty-1280.png` / `hub-empty-1920.png`
- `hub-recent-1280.png`
- `editor-shell-1280.png`
- `sidebar-layers-1280.png`
- `timeline-empty-1280.png`

## Capture helper

From repo root (dev server running optional):

```bash
node apps/desktop/scripts/capture-parity-baselines.mjs
```

Until screenshots exist, parity reviews use live Vite desktop against the [parity contract](../PARITY_CONTRACT.md). Status remains **partial**.
