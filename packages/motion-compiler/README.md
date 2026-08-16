# `@motionvideo/motion-compiler`

Biên dịch **Motion Project / Component authoring** → **MotionRuntimeProject** (literal). Expand component instance, repeater, text animator, bindings, và `timeline.clips` thành `layers` + `propertyAnimations` — không còn tham chiếu authoring.

## Vai trò

```text
MotionProjectV1 (+ Component registry)
        ↓
  compileMotionProjectV1
        ↓
MotionRuntimeProject  →  runtime / draw / encode
```

Browser và render-worker phải dùng cùng compiler (hoặc bản tương đương) để parity preview/export.

## API chính

```ts
import {
  compileMotionProject,
  type CompileOptions,
  type CompiledProject,
} from "@motionvideo/motion-compiler";

const runtime = compileMotionProject(project, { components });
```

`CompiledProject` = alias của `MotionRuntimeProject`.

## Không làm

- Không raster PNG/MP4 (thuộc `apps/render-worker`)
- Không evaluate tại thời điểm t (thuộc `@motionvideo/motion-runtime`)
- Không validate Zod lần đầu (gọi `parseMotionProject` trước khi compile)

## Docs

- [`docs/guide/v1-compiler-runtime-guide.md`](../../docs/guide/v1-compiler-runtime-guide.md)
- [`docs/guide/v1-format-guide.md`](../../docs/guide/v1-format-guide.md)
- [`docs/guide/v1-timeline-guide.md`](../../docs/guide/v1-timeline-guide.md)
- [`docs/guide/v1-group-guide.md`](../../docs/guide/v1-group-guide.md)
