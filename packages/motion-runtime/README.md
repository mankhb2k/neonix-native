# `@motionvideo/motion-runtime`

Evaluator thời gian chạy cho **Runtime IR** (literal). Không parse authoring `.mt` — nhận scene/node/track đã compile và trả transform, bounds, hit-test, geometry tại timestamp xác định.

## Vai trò

```text
NormalizedMotionProjectV2 (Runtime IR)
        ↓
  evaluateScene / evaluateProperty
        ↓
  world matrix · bounds · modifiers · secondary motion
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
  trimPathContours,
  bendPathContours,
  pathMorphContours,
} from "@motionvideo/motion-runtime";
```

| Module | Chức năng |
|---|---|
| `evaluator` | Property tracks, hierarchy, constraints, modifiers |
| `matrix` / `spatial` | World matrix, bounds |
| `hit-test` | Hit-test theo draw order / mask |
| `clock` | Frame ↔ time deterministic |
| `geometry` | Path sample, trim, bend, morph |
| `secondary-motion` | Bone chain follow-through (rotation) |

## Docs

- [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md)
- [`docs/primitives-object.md`](../../docs/primitives-object.md)
- Gate visual: `pnpm validate:primitives`
