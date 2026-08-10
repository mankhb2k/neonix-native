# `@motionvideo/editor-interactions`

Gesture / pointer math thuần túy cho editor (timeline + stage). Không React, không Zustand — apps và `@motionvideo/editor-react` gọi vào đây rồi tự cập nhật state.

## Vai trò

```text
Pointer / client coords
        ↓
  seek · marquee · clip-move/trim · auto-scroll · stage session
        ↓
  Preview / commit payloads  →  app gọi editor-core commands
```

- **Pointer session:** `PointerSessionController`, coordinator, quy tắc commit/cancel.
- **Timeline:** seek + playhead edge-scroll, marquee hit, clip move/trim resolve, layer timing/reorder, auto-scroll mép viewport.
- **Stage:** hit-test, transform box, constraints, `createStageSession` → property patches / transform commands.

## API chính

```ts
import {
  PointerSessionController,
  ensurePlayheadScrubScroll,
  clipIdsInMarqueeIndexed,
  resolveClipMoveDrag,
  resolveClipTrimUpdate,
  createStageSession,
} from "@motionvideo/editor-interactions";
```

| Nhóm | Chức năng |
|---|---|
| `pointer/` | Session pointer, coordinator |
| `timeline/seek` | Client X ↔ time, scrub + edge scroll |
| `timeline/marquee` | Hình chữ nhật chọn + hit clip theo lane |
| `timeline/clip-move` · `clip-trim` | Preview/commit math khi kéo / trim |
| `timeline/clip-move-session` · `library-drop-session` | State machine thuần (start/update → patch / PlacementTarget) |
| `stage/` | Hit, constraints, stage session |

## Không làm

- **Không React / JSX / hooks** — hooks thuộc `@motionvideo/editor-react`.
- **Không Zustand / store toàn cục** — không giữ selection hay document; chỉ trả kết quả để host apply.
- **Không UI chrome** — không component timeline/stage; apps tự vẽ playhead, clip strip, overlay.
- **Không command domain** — không `executeTimelineCommand`; sau gesture, host gọi `@motionvideo/editor-core`.
- **Không compile / evaluate / paint** — thuộc motion-compiler, motion-runtime, pixi/remotion renderers.

## Phụ thuộc

- `@motionvideo/editor-core` — types timeline, selection helpers, gutter constants
- `@motionvideo/motion-protocol` / `@motionvideo/motion-runtime` — stage/transform khi cần schema runtime
