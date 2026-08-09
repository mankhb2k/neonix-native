# `@motionvideo/render-contracts`

Hợp đồng dữ liệu (Zod + types) cho **render jobs / export pipeline**. Web API, worker, và client export dùng chung schema này để tạo job, theo dõi progress, và nhận webhook — không chứa engine Remotion hay Pixi.

## Vai trò

```text
CreateRenderJobRequest
        ↓
  RenderManifest + presets
        ↓
  RenderJobStatus / Progress  (+ webhook payload)
```

- Validate request/response tạo job.
- Manifest render (đầu vào worker) + pin Remotion version.
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
} from "@motionvideo/render-contracts";
```

| Nhóm | Chức năng |
|---|---|
| `create-render-job` | Request/response tạo job |
| `render-manifest` | Manifest + `parseRenderManifest` + `REMOTION_PIN` |
| `render-presets` | Preset id và thông số |
| `render-job` | Status / progress |
| `render-webhook` | Payload webhook hoàn tất / lỗi |

## Không làm

- **Không gọi Remotion / Lambda / FFmpeg** — chỉ schema; thực thi thuộc `apps/web` API, `remotion-renderer`, hoặc render-worker.
- **Không UI / React / Zustand** — không progress bar hay job store.
- **Không MotionProject domain / timeline editor** — không phụ thuộc editor-core; job trỏ artifact / revision từ app.
- **Không compile hay evaluate frame** — thuộc motion-compiler / motion-runtime.

## Phụ thuộc

- `zod`
