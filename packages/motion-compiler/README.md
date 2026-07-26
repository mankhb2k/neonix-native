# `@motionvideo/motion-compiler`

Biên dịch **Motion Project / Component authoring** → **Normalized Runtime IR** (literal). Expand Component instance, Repeater, Text Animator, bindings, presets/actions thành nodes/tracks không còn tham chiếu authoring.

## Vai trò

```text
MotionProjectV2 (+ Component registry)
        ↓
  compileMotionProject
        ↓
NormalizedMotionProjectV2  →  runtime / draw / encode
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

`CompiledProject` = alias của `NormalizedMotionProjectV2`.

## Không làm

- Không raster PNG/MP4 (thuộc `apps/render-worker`)
- Không evaluate tại thời điểm t (thuộc `@motionvideo/motion-runtime`)
- Không validate Zod lần đầu (gọi `parseMotionProject` trước khi compile)

## Docs

- [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md)
- Runtime goldens: `pnpm validate:v2-fixtures` / `pnpm update:v2-goldens`
