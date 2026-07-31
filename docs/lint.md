# Lint layers

## @motionvideo/web (Next)

Tham chiếu cấu hình Aucobot, chỉnh cho MotionVideo.

| Lớp | Được làm | Không được |
|---|---|---|
| `app/`, `components/`, `hooks/` | UI, gọi `lib/api`, đọc `@motionvideo/*` | `fetch`/`axios` thô, Motion Canvas, render-worker |
| `lib/api/` (sau này) | HTTP client | React, components |
| `lib/*` (trừ store) | Helper thuần | React, UI, render engine |
| `lib/store/` | Zustand + Motion JSON | components, app routes, render engine |
| `packages/motion-schema` | Contract Zod | (lint riêng package — không React) |
| `apps/render-worker` | Compile + render | (không import từ web UI) |

### Khác bản Aucobot

- **Không Storybook** (chưa dùng).
- Thêm rule cấm `@motion-canvas/*` và `render-worker` trong web — giữ biên **JSON ở editor / render ở worker**.
- Import group `@motionvideo/**` xếp internal.
- `lib/store` được mutate `state`/`draft` (Zustand).

```bash
pnpm --filter @motionvideo/web lint
pnpm --filter @motionvideo/web lint:ci
```

## @motionvideo/desktop (Vite React)

Flat config không dùng `next/core-web-vitals`. Port safety / import / TS rules từ web + `eslint-plugin-react` / `react-hooks` / `jsx-a11y`.

| Lớp | Được làm | Không được |
|---|---|---|
| `renderer/src/ui/` | Primitives thuần | Electron, IPC, session, `apps/web` |
| `renderer/src/app/`, `editor/` | Feature UI + session callbacks | `apps/web`, Next, Motion Canvas, render-worker |
| `renderer/src/infrastructure/` | DesktopAPI / repositories | `apps/web` |
| `src/shared/` | Contracts / envelope | React, `apps/web` |
| `src/main/`, `src/preload/` | Electron process | React, `apps/web` |

Type-aware lint chỉ trên `renderer/src` (`tsconfig.renderer.json`). Main/preload dùng recommended TS (không type-checked project service trong wave này).

```bash
pnpm --filter @motionvideo/desktop lint
pnpm --filter @motionvideo/desktop lint:ci
pnpm lint              # web + desktop
pnpm lint:desktop
```
