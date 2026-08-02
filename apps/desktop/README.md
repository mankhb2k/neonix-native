# MotionVideo Desktop (Electron + Vite)

Electron shell với **Vite renderer mặc định**. Legacy Next chỉ dùng khi rollback: `MOTIONVIDEO_RENDERER=legacy` / `pnpm dev:legacy`.

| Mode | Flag | Loads |
|---|---|---|
| **Vite** (default) | unset / `MOTIONVIDEO_RENDERER=vite` / packaged | Vite dev hoặc `app://bundle/` |
| **Legacy** (rollback) | `MOTIONVIDEO_RENDERER=legacy` | Next.js URL |

Migration: [`docs/migration/vite-ui/README.md`](../../docs/migration/vite-ui/README.md).

## Dev — Vite (default)

```bash
pnpm dev:desktop
# hoặc
pnpm --filter @motionvideo/desktop dev
```

Mặc định URL: `http://127.0.0.1:5173/` (ghi đè bằng `MOTIONVIDEO_VITE_URL`).

## Dev — Legacy rollback

Terminal A — Next trên `:3000`:

```bash
pnpm --filter @motionvideo/web dev
```

Terminal B:

```bash
pnpm --filter @motionvideo/desktop dev:legacy
```

## Simulated production

```bash
pnpm --filter @motionvideo/desktop start:prod
```

## Scripts

| Script | Purpose |
|---|---|
| `dev` / `dev:vite` | Vite renderer + Electron |
| `dev:legacy` | Next legacy |
| `build` / `build:release` | Main + preload + renderer |
| `test` / `typecheck` / `lint` | Gates |
| `test:desktop-paths` | Artifact path smoke |
| `test:web-ban` | ESLint web-import probe |

## Architecture notes

- Main: esbuild bundle; roots via `DesktopPaths` (`app.getAppPath()`), not `__dirname` depth.
- Renderer: React + session/`editor-core` commands; no `apps/web` imports.
- Packaged: `app://` protocol serves `dist-renderer`.
