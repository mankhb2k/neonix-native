# `@motionvideo/motion-schema`

**MotionVideo Motion Format (`.mt`)** — Zod contract + parse/serialize.

Đây là **project format** của sản phẩm (IR), không phải API của Motion Canvas / Remotion.

## API

```ts
import {
  MOTION_FORMAT_VERSION,
  parseMotionProject,
  serializeMotionProject,
  MotionProjectSchema,
  type MotionProject,
} from "@motionvideo/motion-schema";
```

- `parseMotionProject(input)` — structural validate; reject wrong `version`
- `serializeMotionProject(project)` — JSON string luôn kèm `version`
- `preset` trên animation là `string` — **không** enum cứng ở đây

Preset nào được hỗ trợ → `@motionvideo/template-library` (`validateMotionProjectPresets`).

## Spec

Xem [`docs/motion-format.md`](../../docs/motion-format.md).
