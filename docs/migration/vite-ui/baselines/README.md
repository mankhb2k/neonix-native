# Screenshot baselines (P20/B1)

- **References** (`*.png` here): promoted Electron captures of real `HubScreen` / `EditingWorkspace` (`status: electron-production-ui`).
- **Candidates** (`apps/desktop/tmp/baseline-candidates/`): written by every capture run; compared against references.
- **Placeholders** (`placeholders/`): solid-color PNGs only — not for visual regression.

```bash
# Capture → tmp/baseline-candidates (does NOT overwrite references)
pnpm --filter @motionvideo/desktop capture:baselines

# Pixel-diff candidates vs references (uses .bgra sidecars + maxPixelDiffRatio)
pnpm --filter @motionvideo/desktop compare:baselines

# After visual review, promote candidates → this folder
# PowerShell: $env:PROMOTE_BASELINES=1; pnpm --filter @motionvideo/desktop capture:baselines
```

Query `?fixture=` is ignored unless `VITE_ENABLE_UI_FIXTURES=1`. Capture uses `frame: false`, `show: true`, and fails if the UI is still on “Starting…”.
