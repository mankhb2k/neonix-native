# `@motionvideo/template-library`

Kệ sản phẩm: **Content + Animation → Pattern → Template**. Seed templates (F&B hook-offer-CTA, big-number, process-steps, compare) và registry preset dùng khi export/preview.

## Vai trò

- Catalog **motion blocks** (content + animation) cho Block Lab / planner
- **Templates** sẵn → `MotionProject` v2
- `validateMotionProjectPresets` — mọi `presetId` trong clip phải thuộc `COMPILED_PRESET_IDS` (compiler allowlist; unknown không fallback fade-in)

## Hai lớp block

| Lớp | Vai trò | Ví dụ |
|---|---|---|
| **Content** | Cái gì trên khung | `text.title`, `shape.circle`, `data.progress` |
| **Animation** | Làm gì với layer/scene | `enter.fade-up`, `exit.fade-out`, `camera.zoom-in` |
| **Meta** | Field schema — không phải block | Timing (`delay`/`easing`), Transform primitives |

## Cấu trúc

```text
src/blocks/
├── content/     # text, shape, media, container, data, character
├── animation/
│   ├── entrance/          # 14 enter.*
│   ├── exit/              # fade/scale/slide/zoom out
│   ├── emphasis/          # pulse, shake, flash
│   ├── text/              # typewriter, stagger, highlight
│   ├── number/            # counter
│   ├── shape/             # draw-line, bar-grow, progress-fill
│   ├── transition/        # crossfade, swipe, push
│   ├── camera/            # zoom/pan/focus/shake…
│   ├── transform/         # meta — không shelf block
│   └── timing/            # meta — schema constants
├── library.ts
└── …
```

Lab UI (CSS preview, không phải Runtime IR): `/app/lab/blocks`.

## API

```ts
import {
  templates,
  motionBlocks,
  motionLibrary,
  listMotionBlocksByFamily,
  getMotionBlock,
  isKnownPreset,
  validateMotionProjectPresets,
  retrieveTemplates,
} from "@motionvideo/template-library";
```

## Docs

- [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md) — canonical `.mt` / `.mvc`
- [`docs/primitives-object.md`](../../docs/primitives-object.md) — primitive catalog
- Repo [`README.md`](../../README.md)
