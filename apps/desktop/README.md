# MotionVideo Desktop (Electron)

Spike shell: cửa sổ Electron bọc UI Next hiện tại. **Chưa** đóng gói installer.

## Ship cái gì? (trả lời ngắn)

| | Dev | Prod (hướng đi) |
|--|-----|-----------------|
| Electron / Chromium | Có (~100MB+) | Có — **luôn** nặng nhất |
| Source Next + monorepo `node_modules` | Máy bạn đang có | **Không** ship vào máy user |
| Artifact đã build | Không cần | **Có** — Next `standalone` (hoặc static sau này) + app Electron |

**Không** đóng gói cả repo / toàn bộ deps pnpm vào Electron.  
**Có** đóng gói: binary Electron + output build (folder `.next/standalone` + static, hoặc bản static export nếu bỏ được API).

Chromium trong Electron chiếm phần lớn dung lượng; Next standalone thêm Node runtime nhỏ + code app — nặng vừa, không phải “ship nguyên Next monorepo”.

## Dev

Cần Electron postinstall (pnpm 10): `onlyBuiltDependencies: [electron]` đã có trong `pnpm-workspace.yaml`.

Mặc định Electron load `http://localhost:3001/app` (tách cổng với web `:3000`).

> Electron **không** chiếm cổng — chỉ mở URL. Cần một Next đang listen `:3001`.

Terminal A — Next cho web (tuỳ chọn):

```bash
pnpm dev
```

Terminal B — Next cho desktop:

```bash
pnpm dev:desktop:next
```

Terminal C — Electron:

```bash
pnpm dev:desktop
```

Đổi URL:

```bash
MOTIONVIDEO_DESKTOP_URL=http://localhost:3001/app/editor/<id> pnpm dev:desktop
```

Bridge preload: `window.motionvideoDesktop` (`isDesktop`, `getInfo()`).

Title bar kiểu Cursor: `titleBarStyle: 'hidden'` + `titleBarOverlay` (Windows), không còn thanh menu native File/Edit. Menu nằm trong UI (`DesktopMenuBar` / `TitleBar`).

## Prod (chưa scaffold builder)

1. `next build` với `output: 'standalone'` trên `@motionvideo/web`
2. Electron main spawn server từ folder standalone (localhost port nội bộ) **hoặc** chỉ `loadFile` nếu chuyển editor sang static
3. `electron-builder` / Forge đóng `.exe` / `.dmg` chứa: Electron + standalone (+ ffmpeg/worker nếu cần)

## Layout desktop khác web

Giữ panel trong `apps/web/components/editor/*`.  
Sau spike: thêm `DesktopEditorShell` (bố cục khác) — Electron vẫn load Next route đó. Extract `packages/editor-ui` chỉ khi thật sự cần.
