# `@motionvideo/template-library`

Kệ sản phẩm: **Content + Animation → Pattern → Template**.

## Cấu trúc thư mục

```text
src/blocks/
├── content/
│   ├── text/           # Title, Subtitle, Number, CTA…
│   ├── shape/
│   ├── media/
│   ├── container/
│   ├── data/
│   ├── character/
│   └── camera/         # shot/frame placeholder
├── animation/
│   ├── entrance/       # enter.fade-up…
│   ├── exit/
│   ├── emphasis/
│   ├── transform/
│   ├── text/           # Text Animation (typewriter, stagger, highlight)
│   ├── number/         # Number Animation (counter…)
│   ├── shape/          # Shape Animation (draw-line…)
│   ├── transition/
│   ├── camera/         # Camera Presets
│   └── timing/         # schema constants — không phải block
├── library.ts
├── catalog.ts
├── types.ts
└── index.ts
```

| Family | Nghĩa | Ví dụ |
|---|---|---|
| **Content** | Cái gì trên khung | `text.title`, `shape.circle` |
| **Animation** | Làm gì với layer | `enter.fade-up`, `text.typewriter` |

Lab: `/app/lab/blocks` — filter Content | Animation.

## API

```ts
import {
  motionBlocks,
  motionLibrary,
  listMotionBlocksByFamily,
  getMotionBlock,
} from "@motionvideo/template-library";
```

## Docs

- [`docs/blocks-plan.md`](../../docs/blocks-plan.md)
- Repo [`README.md`](../../README.md)
