# Web Editor — Playback Ownership

> Ranh giới quyền sở hữu dữ liệu playback cho web editor.

---

## 1. Dữ liệu protocol vs session state

| Dữ liệu                                | Thuộc về             | Ghi vào JSON? |
| -------------------------------------- | -------------------- | ------------- |
| Project length (derived max root end)  | protocol (derived)   | ❌            |
| `project.layers[].animations[]`        | protocol             | ✅            |
| `project.layers[].timing`              | protocol             | ✅            |
| `currentTime`                          | editor session       | ❌            |
| `mode` (`idle/playing/scrubbing`)      | editor session       | ❌            |
| `seekRevision`                         | editor session       | ❌            |
| `playbackRate`                         | editor session       | ❌            |
| `zoom`, `selection`                    | editor session       | ❌            |

**Quy tắc:**

- Project length = `max(root.timing.start + root.timing.duration)`. Compiler stamp `runtime.timeline.duration`.
- `currentTime`, `mode`, `zoom`, `selection` là trạng thái phiên — chỉ sống trong store, không bao giờ serialize vào project.
- Timeline (lane/clip) **không phải** source of truth cho playback; nó là dữ liệu dẫn xuất cho UI.

## 2. Ai sở hữu gì

- **`playback-clock-store.ts`** — chủ sở hữu duy nhất của `currentTime`. Chứa toàn bộ business rule: `clamp`, `play`, `pause`, `scrub`, `reset`. `duration` mirror derived project length để clamp.
- **`use-playback-driver.ts`** — adapter RAF, chỉ quản lifecycle (mount/unmount). Không chứa business rule mới.
- **`editor-core/src/playback/playback-driver.ts`** — driver thuần (không React/DOM), tính `currentTime = startTimeline + elapsed * playbackRate`, re-anchor khi `mode → playing` hoặc `seekRevision` tăng.
- **Stage preview** — đọc `project + currentTime` để render frame; không tự giữ đồng hồ riêng.

## 3. Contract `playbackRate` (web MVP)

- Hiện tại **static = `1`** — chưa có UI đổi tốc độ, **chưa expose setter**.
- Driver đọc `state.playbackRate` mỗi tick nên slope hiện hành đúng.
- **Chưa support đổi tốc độ giữa lúc đang play.** Nếu mở UI `0.5x/2x`, phải bump `seekRevision` khi đổi rate (hoặc thêm nhánh `playbackRate` vào subscribe) để driver re-anchor từ mốc hiện tại — nếu không frame kế tiếp sẽ nhảy sai.

## 4. React boundary (V2)

`EditorProviders` is the composition root for the editor session. It exposes
three narrow boundaries:

- `useEditorStore(selector)` for document, selection, visibility, history and
  persistence state.
- `useEditorActions()` for authoring commands and selection/layer mutations.
- `usePlaybackController()` for imperative media registration, frame/time
  sinks, transport actions and diagnostics.

The stage receives every realtime frame through the playback sink and paints
directly into the renderer. Timeline/header UI reads the throttled
`useTransportStore` snapshot. No realtime frame is stored in React state, and
there is no broad `EditorSurfaceContext` combining authoring and playback.

## 5. Frame/time parity


- `playbackFrameIndex` / `playbackFrameTime` (trong `editor-core/playback/time-frame.ts`) là floor-based, khớp `frameIndexAtTime` của `motion-runtime`.
- Fallback an toàn cho `NaN` time, `fps <= 0`, `time < 0` — parity được khóa bởi test trong `editor-core/src/__tests__/playback-time-frame.test.ts`.
