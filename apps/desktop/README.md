# MotionVideo Desktop (Electron + Vite)

Electron shell với Vite renderer **mặc định** (Phase 12). Legacy Next vẫn opt-in để rollback canary.

| Mode | Flag | Loads |
|---|---|---|
| **Vite** (default) | unset hoặc `MOTIONVIDEO_RENDERER=vite` | Vite dev server hoặc `app://bundle/` |
| **Legacy** (rollback) | `MOTIONVIDEO_RENDERER=legacy` | Next.js URL |

Migration: [`REFACTOR-VITE.md`](../../REFACTOR-VITE.md) · Cutover: [`docs/migration/vite-phase-12/cutover.md`](../../docs/migration/vite-phase-12/cutover.md).

## Dev — Vite (default)

Một lệnh (Vite `:5173` + Electron):

```bash
pnpm dev:desktop
# hoặc
pnpm --filter @motionvideo/desktop dev
```

Mặc định URL: `http://127.0.0.1:5173/` (ghi đè bằng `MOTIONVIDEO_VITE_URL`).

## Dev — Legacy rollback (Next)

Terminal A — Next trên `:3000`:

```bash
pnpm dev
```

Terminal B — Electron legacy:

```bash
pnpm dev:desktop:legacy
# hoặc
pnpm --filter @motionvideo/desktop dev:legacy
```

## Simulated production (không cần Vite/Next)

```bash
pnpm --filter @motionvideo/desktop start:prod
```

Build renderer → `dist-renderer/`, Electron load `app://bundle/index.html` với CSP + navigation allowlist.

## Env

| Env | Default | Meaning |
|---|---|---|
| `MOTIONVIDEO_RENDERER` | `vite` | `legacy` \| `vite` |
| `MOTIONVIDEO_DESKTOP_URL` | `http://localhost:3000/app` | Legacy Next URL |
| `MOTIONVIDEO_VITE_URL` | `http://127.0.0.1:5173/` | Vite dev URL |
| `MOTIONVIDEO_VITE_PROD` | unset | `1` = dùng `app://bundle` dù unpackaged |

## Scripts (`@motionvideo/desktop`)

| Script | Role |
|---|---|
| `dev` / `dev:vite` | Concurrent Vite + Electron (default) |
| `dev:legacy` | Electron + Next URL (`MOTIONVIDEO_RENDERER=legacy`) |
| `build` / `build:desktop` | main + preload + renderer |
| `build:release` / `pack` / `dist` | Release artifact (use `pnpm run pack`) |
| `start:prod` | Full build + prod-sim Vite (`app://`) |
| `typecheck` | main / preload / renderer |
| `test` | Vitest |

## Layout

```text
apps/desktop/
  src/main/          Electron main (window, protocol, IPC, CSP)
  src/preload/       contextBridge → window.motionvideoDesktop
                     (bundled with esbuild — sandbox cannot require sibling modules)
  src/shared/ipc/    channels, contracts, schemas, errors
  renderer/          Vite React shell + desktop-api-client
  dist/              compiled main + bundled preload
  dist-renderer/     Vite production bundle
```

## IPC

`window.motionvideoDesktop` exposes:

- **Nested** `DesktopAPI`: `app`, `window`, `project`, `assets`, `export`
- **Flat shims** for web legacy: `getInfo`, `windowMinimize`, …

Vite renderer uses `createDesktopApiClient()` at composition root — features should not touch `window.*` directly.

```bash
pnpm --filter @motionvideo/desktop test
```

## Security (Vite mode)

- `app://` privileged scheme; path traversal bị reject
- Navigation chỉ Vite origin / `app://bundle` (hoặc Next origin khi legacy)
- `openExternal` chỉ `https:` và `mailto:`
- Production CSP không `unsafe-eval`

See Phase 11: [`docs/migration/vite-phase-11/security-packaging.md`](../../docs/migration/vite-phase-11/security-packaging.md).
