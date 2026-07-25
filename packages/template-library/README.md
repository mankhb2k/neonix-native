# `@motionvideo/template-library`

Kệ sản phẩm: **Content + Animation → Pattern → Template**.

## Hai lớp

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

## MVP giữ / bỏ / thêm (Animation A–J)

| Nhóm | Giữ | Thêm MVP | Bỏ / để sau |
|---|---|---|---|
| Entrance | 14 `enter.*` | — | Typewriter → Text Anim |
| Exit | — | fade/scale/slide/zoom out | Collapse, Explode |
| Emphasis | — | pulse, shake, flash | Jelly, Rubber Band; highlight ở Text Anim |
| Transform | schema only | — | Không block trên kệ |
| Text Anim | typewriter, stagger, highlight | — | Letter-split, scramble… |
| Number | counter | — | Rolling/money (params sau) |
| Shape Anim | — | draw-line, bar-grow, progress-fill | Morph, Ripple |
| Transition | — | crossfade, swipe, push | Curtain, Split… |
| Camera | 10 primitive | — | Ken Burns / Orbit (pha 2) |
| Timing | schema fields | — | Không tạo `timing.*` block |

**Content:** giữ Text/Shape/Media/Container/Data/Character. Không kệ Content Camera (trùng Camera Presets).

Lab: `/app/lab/blocks`.

## API

```ts
import {
  motionBlocks,
  motionLibrary,
  listMotionBlocksByFamily,
  getMotionBlock,
  isKnownPreset,
  validateMotionProjectPresets,
} from "@motionvideo/template-library";
```

`validateMotionProjectPresets(project)` — semantic check: mọi `Clip.source.presetId` phải có trong registry; schema giữ preset ID là string mở.

## Docs

- [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md) — canonical `.mt` / `.mvc`
- [`docs/primitives-object.md`](../../docs/primitives-object.md) — primitive catalog
- Repo [`README.md`](../../README.md)
