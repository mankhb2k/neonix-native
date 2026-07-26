# `@motionvideo/motion-schema`

Canonical **Zod contract** cho Motion Format v2: Project (`.mt`), Component (`.mvc`), Patch, Runtime IR normalized, property capability registry.

## Vai trò

```text
JSON authoring  →  parseMotionProject / parseMotionComponentV2
                         ↓
              structural + reference validation
                         ↓
              typed MotionProject / MotionComponentV2
```

Package **không** migrate format cũ; `formatVersion` hiện tại = `2`.

## API chính

```ts
import {
  parseMotionProject,
  serializeMotionProject,
  parseMotionProjectV2,
  parseMotionComponentV2,
  applyMotionPatch,
  motionPropertyCapabilities,
  type MotionProject,
} from "@motionvideo/motion-schema";
```

| API | Chức năng |
|---|---|
| `MotionProjectSchema` / `parseMotionProject` | API app mặc định (= v2) |
| `MotionProjectV2Schema` / `parseMotionComponentV2` | File format versioned |
| `NormalizedMotionProjectV2Schema` | Renderer-only literal IR |
| `MotionPatchSchema` / `applyMotionPatch` | Patch AI/editor (public surface) |
| `capabilities.ts` | Property vocabulary cho AI/editor |

## Docs

- Normative: [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md)
- Catalog: [`docs/primitives-object.md`](../../docs/primitives-object.md)
- Freeze: [`docs/p0-schema-freeze-checklist.md`](../../docs/p0-schema-freeze-checklist.md)
- Gate: `pnpm validate:v2-fixtures`
