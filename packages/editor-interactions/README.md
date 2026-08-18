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

## Interaction Layer Mapping

Tầng này chỉ tạo **intent** (preview + commit payload), không tự ghi document.

| Tầng                    | Trách nhiệm                                                 | Kết quả                                                      |
| ----------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Pointer / client coords | Nhận `clientX/Y`, đổi sang content/composition space        | `PointerPos`, `contentX/Y`, `compositionPoint`               |
| Interaction math        | Tính preview khi kéo/trim/resize/rotate                     | `ClipMovePreview`, `StageTransformValues`, `AutoScrollDelta` |
| Commit boundary         | Đóng session → payload cuối                                 | `ClipMovePatch`, `StagePropertyPatch`, `PlacementTarget`     |
| Command adapter         | Host (web/desktop) map payload → `@motionvideo/editor-core` | `DocumentPropertyCommand`                                    |
| Protocol JSON           | `motion-protocol` là nguồn chân lý cuối cùng                | `project.layers[]`, `timeline.clips[]`                       |

**Từ vựng quan trọng:** `clip`/`lane`/`track` thuộc tầng timeline dẫn xuất của editor; `rootLayerId`/`layerId` là id protocol của layer; `node` chỉ dùng khi duyệt cây nội bộ. Xem `docs/web/editor-vocabulary.md` để biết đầy đủ.

## API chính

```ts
import {
  PointerSessionController,
  ensurePlayheadScrubScroll,
  clipIdsInMarqueeIndexed,
  resolveClipMoveDrag,
  resolveClipTrimUpdate,
  createStageSession,
  toStagePropertyPatches,
  toSingleSetNodeTransformCommand,
} from "@motionvideo/editor-interactions";
```

| Nhóm                                                  | Chức năng                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| `pointer/`                                            | Session pointer, coordinator                                 |
| `timeline/seek`                                       | Client X ↔ time, scrub + edge scroll                         |
| `timeline/marquee`                                    | Hình chữ nhật chọn + hit clip theo lane                      |
| `timeline/clip-move` · `clip-trim`                    | Preview/commit math khi kéo / trim                           |
| `timeline/clip-move-session` · `library-drop-session` | State machine thuần (start/update → patch / PlacementTarget) |
| `timeline/drop-geometry` · `auto-scroll`              | Đổi coords → lane/time, auto-scroll mép viewport             |
| `stage/`                                              | Hit, constraints, stage session                              |

### Ranh giới commit của stage

`toStagePropertyPatches()` luôn trả về **một** patch (stage là single-selection), với `target = { rootLayerId, layerId }`.

`toSingleSetNodeTransformCommand(patch)` trả về:

- `{ type: "set-node-transform", targets: [target], patch }` khi có thay đổi transform (move/rotate/scale).
- `null` khi chỉ có thay đổi kích thước — `sizePatch` vẫn nằm ở patch để host tự xử lý, vì `TransformPatch` hiện chưa mở rộng `width`/`height`.

## Không làm

- **Không React / JSX / hooks** — hooks thuộc `@motionvideo/editor-react`.
- **Không Zustand / store toàn cục** — không giữ selection hay document; chỉ trả kết quả để host apply.
- **Không document mutation** — không ghi `project.layers[]` / `timeline.clips[]`; chỉ sinh intent.
- **Không protocol migration** — không đọc/ghi/chuẩn hóa JSON protocol; protocol là nguồn chân lý của `motion-protocol`.
- **Không renderer-specific types** — không pixi/remotion/canvas DOM; chỉ dùng types trung lập từ `motion-runtime` cho stage hit-test.
- **Không UI chrome** — không component timeline/stage; apps tự vẽ playhead, clip strip, overlay.
- **Không command domain** — không `executeTimelineCommand`; sau gesture, host gọi `@motionvideo/editor-core`.

## Phụ thuộc

- `@motionvideo/editor-core` — types timeline, selection helpers, gutter constants
- `@motionvideo/motion-protocol` / `@motionvideo/motion-runtime` — stage/transform khi cần schema runtime
