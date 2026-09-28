# `@motionvideo/render-native/contracts`

Hợp đồng dữ liệu (Zod + types) cho **render jobs / export pipeline**. Web API và native VPS export worker dùng chung schema này để tạo job, theo dõi progress, và nhận kết quả — không chứa engine render hay Pixi.

## Vai trò

```text
CreateRenderJobRequest
        ↓
  RenderManifest + presets
        ↓
  RenderJobStatus / Progress  (+ webhook payload)
```

- Validate request/response tạo job.
- Manifest render (đầu vào native export worker) + phiên bản compiler/runtime.
- Preset id/spec (quality / format).
- Status, progress, webhook payload schemas.

## API chính

```ts
import {
  CreateRenderJobRequestSchema,
  parseRenderManifest,
  RENDER_PRESETS,
  type RenderJobStatus,
  type RenderManifest,
} from "@motionvideo/render-native/contracts";
```

| Nhóm | Chức năng |
|---|---|
| `create-render-job` | Request/response tạo job |
| `render-manifest` | Manifest + `parseRenderManifest` + native export renderer version |
| `render-presets` | Preset id và thông số |
| `render-job` | Status / progress |

## Không làm

- **Không gọi renderer hay FFmpeg** — chỉ schema; thực thi thuộc `apps/web` API hoặc native export worker.
- **Không UI / React / Zustand** — không progress bar hay job store.
- **Không MotionProject domain / timeline editor** — không phụ thuộc editor-core; job trỏ artifact / revision từ app.
- **Không compile hay evaluate frame** — thuộc motion-compiler / motion-runtime.

## Phụ thuộc

- `zod`
