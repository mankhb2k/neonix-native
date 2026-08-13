# `@motionvideo/motion-compiler`

Biên dịch **Motion Project / Component authoring** → **MotionRuntimeProject** (literal). Expand Component instance, Repeater, Text Animator, bindings, presets/actions thành layers/tracks không còn tham chiếu authoring.

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

- [`docs/motion-format-v1.md`](../../docs/motion-format-v1.md)
- Runtime goldens: `pnpm validate:v1-source-of-truth`
