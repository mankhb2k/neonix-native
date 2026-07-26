# `@motionvideo/shared`

Hằng số và type **dùng chung** giữa apps/packages — không chứa schema motion hay renderer.

## Nội dung

```ts
import {
  APP_NAME,
  DEFAULT_LOCALE,
  type AspectRatio,
  type RenderJobStatus,
} from "@motionvideo/shared";
```

| Export | Mô tả |
|---|---|
| `APP_NAME` | `"MotionVideo"` |
| `DEFAULT_LOCALE` | `"vi-VN"` |
| `AspectRatio` | `"9:16" \| "16:9" \| "1:1"` |
| `RenderJobStatus` | Trạng thái job render/encode (`queued` … `failed`) |

Giữ package này mỏng: chỉ shared product primitives, không business logic.
