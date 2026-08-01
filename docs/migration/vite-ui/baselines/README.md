# Screenshot baselines (UI-0 / UI-0.1)

- **References** (`*.png` here): promoted **Vite** Electron captures at **exact** 1280×720 / 1920×1080 (`status: electron-production-ui`). Used for **Vite regression** only.
- **Candidates** (`apps/desktop/tmp/baseline-candidates/`): written by every capture run; compared against references.
- **Web UX reference:** [`../reference-web/`](../reference-web/) — eye QA vs legacy web; **not** auto-compared.
- **Placeholders** (`placeholders/`): solid-color PNGs only — not for visual regression.

```bash
# Capture → tmp/baseline-candidates (does NOT overwrite references)
# Fails if capture size ≠ requested (enableLargerThanScreen + setContentSize)
pnpm --filter @motionvideo/desktop capture:baselines

# Pixel-diff via sharp (RGBA) + maxPixelDiffRatio (0.02); Electron nativeImage fallback if sharp is not linked
pnpm --filter @motionvideo/desktop compare:baselines

# After visual review (timeline visible), promote candidates → this folder
# PowerShell: $env:PROMOTE_BASELINES=1; pnpm --filter @motionvideo/desktop capture:baselines
```

`PROMOTE_BASELINES=1` proves Vite is stable between captures — **not** that UI matches web. For web parity, compare by eye against `reference-web/`.

Query `?fixture=` is ignored unless `VITE_ENABLE_UI_FIXTURES=1`. Capture uses `frame: false`, `show: true`, viewport-in-view checks, and fails if the UI is still on “Starting…”.
