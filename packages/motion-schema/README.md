# `@motionvideo/motion-schema`

Canonical Zod contract cho MotionVideo.

```ts
import {
  parseMotionProject,
  serializeMotionProject,
  type MotionProject,
} from "@motionvideo/motion-schema";
```

`parseMotionProject` chỉ nhận canonical Motion Project hiện tại và chạy cả structural lẫn reference validation. Package không cung cấp migrator hoặc schema tương thích định dạng cũ.

API chính:

- `MotionProjectSchema`, `parseMotionProject`: API application mặc định.
- `MotionProjectV2Schema`, `parseMotionProjectV2`: schema được version hóa của file format.
- `MotionComponentV2Schema`, `parseMotionComponentV2`: Component authoring contract.
- `NormalizedMotionProjectV2Schema`: renderer-only literal IR.
- `MotionPatchSchema`: patch artifact cho AI/editor operation.

Contract đầy đủ: [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md).
