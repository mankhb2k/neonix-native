# Web UI/UX reference images (CSS-0)

**Do not** feed these into `compare:baselines` (Vite regression). Parity QA uses this folder + `metrics/`.

| Path | Role |
|------|------|
| `vite/` | Vite chrome captures (geometry pipeline) |
| `web/` | Legacy web captures (Playwright / manual) — fill via `capture:reference-web` |
| `metrics/web-contract.json` | Target boxes/tokens from legacy (CSS-3+ must match ≤1px) |
| `metrics/vite-*.json` | Measured Vite regions per surface×size |

## Required surfaces (matrix)

Sizes: **1280×720**, **1440×900**, **1920×1080**

- Hub: empty / recent / dialog
- Sidebar: each primary tab
- Inspector: empty / node / text
- Timeline: empty / single / multi-select / dragging
- Editor shell (combined)

## Commands

```bash
# Vite metrics + PNGs (apps/desktop)
pnpm --filter @motionvideo/desktop build:renderer  # with VITE_ENABLE_UI_FIXTURES=1 via capture script env
pnpm --filter @motionvideo/desktop capture:geometry
pnpm --filter @motionvideo/desktop compare:geometry

# Legacy web (optional when Next is available)
pnpm --filter @motionvideo/desktop capture:reference-web
```

`COMPARE_GEOMETRY_STRICT=1` fails if Vite panels ≠ web-contract (expected red until CSS-3).

Fixture content is synced under the **Parity Fixture** name in Vite seeds.
