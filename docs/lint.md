# Lint layers (@motionvideo/web)

Tham chiếu cấu hình Aucobot, chỉnh cho MotionVideo.

## Ý tưởng

| Lớp | Được làm | Không được |
|---|---|---|
| `app/`, `components/`, `hooks/` | UI, gọi `lib/api`, đọc `@motionvideo/*` | `fetch`/`axios` thô, Motion Canvas, render-worker |
| `lib/api/` (sau này) | HTTP client | React, components |
| `lib/*` (trừ store) | Helper thuần | React, UI, render engine |
| `lib/store/` | Zustand + Motion JSON | components, app routes, render engine |
| `packages/motion-schema` | Contract Zod | (lint riêng package — không React) |
| `apps/render-worker` | Compile + render | (không import từ web UI) |

## Khác bản Aucobot

- **Không Storybook** (chưa dùng).
- Thêm rule cấm `@motion-canvas/*` và `render-worker` trong web — giữ biên **JSON ở editor / render ở worker**.
- Import group `@motionvideo/**` xếp internal.
- `lib/store` được mutate `state`/`draft` (Zustand).

## Chạy

```bash
pnpm --filter @motionvideo/web lint
pnpm --filter @motionvideo/web lint:ci
```

Lần đầu có thể fail vì code MVP chưa tuân `no-console` / named export — sửa dần hoặc tạm `warn` từng rule.
