# `@motionvideo/motion-runtime`

Evaluator thời gian chạy cho **Runtime IR** đã compile từ NeonVideo V1. Không parse authoring JSON — nhận `MotionRuntimeProject` và trả transform, bounds, hit-test, geometry tại timestamp xác định.

Runtime **không** mở rộng protocol. Animation runtime là `propertyAnimations`, compile từ `layer.animations` và component prop keyframes.

## Vai trò

```text
MotionProjectV1
        ↓ compileMotionProjectV1
MotionRuntimeProject (Runtime IR)
        ↓
  evaluateScene / evaluateProperty
        ↓
  world matrix · bounds · snapshot / paint
```

Dùng chung bởi browser preview (`apps/web`) và worker raster (`apps/render-worker`).

## API chính

```ts
import {
  evaluateScene,
  evaluateProperty,
  applyMatrix,
  frameTimestamp,
  quantizeTimeToFrame,
  hitTestScene,
  subtreeBounds,
  pathMorphContours,
} from "@motionvideo/motion-runtime";
```

| Module | Chức năng |
| --- | --- |
| `evaluator` | `propertyAnimations`, hierarchy |
| `matrix` / `spatial` | World matrix, bounds |
| `hit-test` | Hit-test theo draw order / mask |
| `clock` | Frame ↔ time deterministic |
| `geometry` | Path sample; morphTargets data-only |

## Docs

- [`docs/guide/v1-compiler-runtime-guide.md`](../../docs/guide/v1-compiler-runtime-guide.md)
- [`docs/guide/v1-format-guide.md`](../../docs/guide/v1-format-guide.md)
- [`docs/guide/v1-timeline-guide.md`](../../docs/guide/v1-timeline-guide.md)
- Gate visual: `pnpm validate:primitives`
