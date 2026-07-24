# `@motionvideo/motion-schema`

Canonical Zod contract cho MotionVideo.

```ts
import {
  parseMotionProject,
  serializeMotionProject,
  type MotionProject,
} from "@motionvideo/motion-schema";
```

Các tên không có hậu tố version luôn trả **MotionProject v2**. `parseMotionProject` chấp nhận project v2 hoặc v1 legacy; v1 được migrate ngay và không thoát ra khỏi package dưới type mặc định.

API chính:

- `MotionProjectV2Schema`, `parseMotionProjectV2`: structural + reference validation v2.
- `MotionComponentV2Schema`, `parseMotionComponentV2`: Component authoring contract.
- `NormalizedMotionProjectV2Schema`: renderer-only literal IR.
- `MotionPatchV1Schema`: patch artifact version độc lập với Motion Project version.
- `parseMotionProjectV1`, `migrateMotionProjectV1ToV2`: chỉ dành cho import/migration/test.

Không import type v1 trong Web, planner, template hoặc worker. Contract đầy đủ: [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md).
