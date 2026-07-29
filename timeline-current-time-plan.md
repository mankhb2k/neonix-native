# Kế hoạch đồng bộ `currentTime` cho Timeline

## 1. Mục tiêu

Timeline sử dụng đúng một nguồn thời gian chuẩn là `currentTime` cho ba consumer:

1. Playhead.
2. Timecode trên `TransportBar`.
3. Nội dung trong `PreviewStage`.

Khi người dùng kéo playhead, cả ba phải phản ánh cùng một thời điểm ngay trong lúc giữ chuột. Việc đồng bộ không được đưa thao tác kéo trở lại trạng thái giật hoặc lag.

## 2. Quyết định kiến trúc

### 2.1. Một thời gian chuẩn

Chỉ tồn tại một giá trị mang ý nghĩa playback hiện tại:

```text
                         currentTime
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Playhead 60 fps   Timecode theo frame   Preview theo frame
```

Không tạo `liveTime`, `scrubTime` hoặc một giá trị thời gian thứ hai để điều khiển UI. Nếu sau này cần lưu lịch sử hoặc persistence, giá trị đó không được dùng như một playback clock khác.

### 2.2. Một nguồn thời gian, nhiều nhịp tiêu thụ

`currentTime` có thể thay đổi tối đa một lần trong mỗi animation frame, nhưng mỗi consumer tự giới hạn công việc:

- Playhead cập nhật CSS `transform` bằng subscription imperative, mục tiêu 60 fps.
- Timecode chỉ render lại component text độc lập khi frame hiển thị thay đổi.
- Preview chỉ evaluate và render khi `frameIndex` thay đổi, tối đa bằng FPS của project.

Như vậy, cả ba cùng đọc một thời gian nhưng không bắt toàn bộ React tree render ở 60 fps.

### 2.3. Clock không thuộc editor domain state

Chuyển `currentTime` và trạng thái playback khỏi `editor-store.ts` sang một store/controller chuyên biệt, dự kiến:

```text
apps/web/lib/playback/playback-clock-store.ts
```

State tối thiểu:

```ts
type PlaybackMode = "idle" | "playing" | "scrubbing";

type PlaybackClockState = {
  currentTime: number;
  duration: number;
  mode: PlaybackMode;
  playbackRate: number;
};
```

Actions tối thiểu:

```ts
seek(time: number): void;
setDuration(duration: number): void;
play(): void;
pause(): void;
beginScrub(): void;
endScrub(): void;
togglePlayback(): void;
```

`seek()` là cổng duy nhất cập nhật `currentTime` và luôn clamp trong `[0, duration]`.

## 3. Hiện trạng và nguyên nhân

Luồng scrub hiện tại trong `Playhead.tsx`:

```text
pointermove
  → tính time
  → đổi transform trực tiếp
  → chỉ lưu time trong pendingTimeRef

pointerup
  → setCurrentTime(finalTime)
```

Do đó playhead mượt, nhưng `TransportBar` và `PreviewStage` đứng yên tới khi `pointerup`.

Nếu gọi `editorStore.setCurrentTime()` trực tiếp ở mọi `pointermove`, các subscriber hiện tại sẽ render liên tục. `PreviewStage` còn thực hiện `quantizeTimeToFrame()`, `previewParitySnapshot()`, `evaluateScene()` và dựng lại các runtime layer, nên đây là nguồn rủi ro lag chính.

Ngoài ra, playback hiện tăng thời gian bằng `state.currentTime + dt` trong `Timeline.tsx`. Khi scrub diễn ra lúc playback vẫn chạy, clock playback và vị trí kéo có thể cạnh tranh nhau.

## 4. Phạm vi file dự kiến

| File | Thay đổi dự kiến |
|---|---|
| `apps/web/lib/playback/playback-clock-store.ts` | Tạo clock store và các invariant |
| `apps/web/lib/playback/use-playback-driver.ts` | RAF driver cho playback, nếu tách thành hook |
| `apps/web/lib/store/editor-store.ts` | Xóa dần `currentTime`, `isPlaying` và actions playback sau migration |
| `apps/web/components/desktop/editor/timeline/Timeline.tsx` | Dùng playback driver, không tự cộng `currentTime` |
| `apps/web/components/desktop/editor/timeline/TimelineBoard.tsx` | Không subscribe `currentTime` để render playhead qua React |
| `apps/web/components/desktop/editor/timeline/Tracks/Playhead.tsx` | Scrub qua clock; coalesce pointer events bằng RAF |
| `apps/web/components/desktop/editor/timeline/TransportBar/TransportBar.tsx` | Dùng clock mode/actions; tách timecode |
| `apps/web/components/desktop/editor/timeline/TransportBar/CurrentTimeDisplay.tsx` | Component text subscribe theo frame hiển thị |
| `apps/web/components/desktop/editor/stage/PreviewStage.tsx` | Subscribe theo `frameIndex`, cô lập runtime canvas |
| `apps/web/components/desktop/editor/timeline/timeline-scale.ts` | Thống nhất quy tắc time-to-frame và format timecode |

Tên file mới có thể điều chỉnh theo convention khi bắt đầu implementation, nhưng ranh giới trách nhiệm phải được giữ.

## 5. Các phase triển khai

### Phase 0 — Khóa hành vi và đo baseline

- Ghi nhận project mẫu, FPS, số scene/node và độ dài timeline dùng để kiểm tra.
- Profile một lần playback và scrub bằng Chrome Performance/React Profiler.
- Ghi nhận:
  - số lần `PreviewStage` render trong một giây scrub;
  - long task trên 50 ms;
  - playhead có bỏ frame nhìn thấy được hay không;
  - timecode có thay đổi trước `pointerup` hay không.
- Bổ sung test mô tả lỗi hiện tại: giữ pointer, di chuyển nhưng chưa thả thì timecode phải đổi.

Kết quả phase: có baseline và test thất bại đúng với bug hiện tại.

### Phase 1 — Tạo playback clock duy nhất

- Tạo vanilla Zustand store/controller riêng cho playback.
- Đưa `currentTime`, duration và playback mode vào clock.
- Centralize clamp trong `seek()`.
- Dùng một enum `mode` thay cho hai boolean độc lập để tránh trạng thái vừa `playing` vừa `scrubbing`.
- Đồng bộ `duration` từ `clipsContentEndSeconds(timelineClips)` khi clips thay đổi.
- Trong giai đoạn migration, tạo adapter tạm nếu cần; không để editor store và clock cùng có quyền ghi thời gian.

Invariant:

```text
0 <= currentTime <= duration
mode = scrubbing  => playback RAF không được tiến clock
mode = playing    => pointer scrub chưa hoạt động
```

Kết quả phase: mọi lệnh play, pause và seek đi qua clock mới.

### Phase 2 — Đồng bộ scrub và playhead

- `pointerdown`:
  - pause playback nếu đang phát;
  - chuyển mode sang `scrubbing`;
  - giữ pointer capture.
- `pointermove`:
  - chỉ ghi thời điểm mới nhất vào `pendingTimeRef`;
  - schedule tối đa một `requestAnimationFrame`;
  - trong RAF, gọi `clock.seek(latestTime)`.
- Playhead subscribe clock theo kiểu imperative và áp dụng `translate3d()`; không dùng React state cho vị trí nóng.
- `pointerup`/`pointercancel`:
  - flush giá trị cuối;
  - chuyển mode về `idle`;
  - release pointer capture;
  - hủy RAF còn treo khi unmount.
- Giữ các ref mới nhất cho `pixelsPerSecond`, `scrollLeft`, label width và duration để subscription không dùng closure cũ.

Kết quả phase: playhead vẫn mượt nhưng `currentTime` đã thay đổi trong khi kéo, không chờ `pointerup`.

### Phase 3 — Cô lập timecode

- Tách `CurrentTimeDisplay` khỏi `TransportBar`.
- Component này chỉ subscribe giá trị frame dùng để hiển thị, không subscribe raw object state.
- Thống nhất một quy tắc time-to-frame giữa timecode và preview. Ưu tiên `floor`/`quantizeTimeToFrame()` thay vì một nơi `round`, một nơi `floor`.
- Giữ `font-mono` và `tabular-nums` để thay text không làm layout shift.
- Không cho cập nhật timecode làm render lại nút play/pause, zoom hoặc toàn bộ timeline board.

Kết quả phase: timecode chạy song song với playhead và luôn cùng frame với clock.

### Phase 4 — Preview theo cùng `currentTime`

- Tách phần runtime canvas nhạy với thời gian khỏi shell/layout của `PreviewStage`.
- Selector preview trả về `frameIndex`, không trả trực tiếp raw `currentTime`:

```ts
frameIndex = floor(currentTime * fps)
previewTime = frameIndex / fps
```

- Chỉ gọi `previewParitySnapshot()` khi một trong các dữ liệu sau thay đổi:
  - compiled project;
  - scene hiện tại;
  - `frameIndex`.
- Không evaluate lại khi nhiều clock tick vẫn nằm trong cùng frame.
- Memoize các node/layer không thay đổi nếu profiler cho thấy React reconciliation còn chiếm đáng kể.
- Khi scrub qua biên scene, scene và local time phải đổi trong cùng clock tick.

Kết quả phase: preview đi theo playhead trong lúc giữ chuột, tối đa theo FPS project.

### Phase 5 — Chuẩn hóa playback driver

- Di chuyển RAF playback ra khỏi component `Timeline` sang playback driver/controller.
- Tính thời gian từ mốc tuyệt đối:

```text
currentTime = startTimelineTime
            + (performance.now() - startPerformanceTime) / 1000
              × playbackRate
```

- Không cộng dồn `currentTime + dt` qua nhiều frame để tránh tích lũy sai số.
- Clamp ở content end và tự chuyển `mode` về `idle`.
- Nếu sau này có audio/video thật, media/audio clock có thể thay RAF làm master clock mà API consumer không đổi.

Kết quả phase: play và scrub dùng chung controller, không có hai vòng lặp cùng ghi clock.

### Phase 6 — Xóa migration và hoàn thiện

- Xóa `currentTime`, `isPlaying`, `setCurrentTime`, `setPlaying`, `togglePlaying` khỏi editor store.
- Xóa adapter hoặc compatibility code tạm.
- Kiểm tra không còn consumer đọc clock cũ bằng `rg`.
- Cập nhật comment để mô tả kiến trúc mới thay vì mô tả “commit on pointerup”.

Kết quả phase: chỉ playback clock có quyền sở hữu `currentTime`.

## 6. Quy tắc hiệu năng

- Không gọi state setter trực tiếp cho từng `pointermove`; luôn coalesce bằng RAF.
- Không cho `TimelineBoard` render lại chỉ vì clock tick.
- Không render lại toàn bộ `TransportBar` chỉ vì timecode đổi.
- Không evaluate preview nhiều lần trong cùng một frame video.
- Không đặt `currentTime` trong undo/redo hoặc persistence nóng.
- CSS playhead tiếp tục dùng `transform: translate3d(...)` và `will-change: transform`.
- Không debounce scrub: debounce tạo cảm giác trễ. Dùng RAF coalescing và frame gating.

## 7. Test plan

### 7.1. Clock unit tests

- `seek()` clamp về 0 khi nhận số âm.
- `seek()` clamp về duration khi vượt cuối timeline.
- duration giảm sẽ clamp lại `currentTime`.
- `beginScrub()` dừng trạng thái playing.
- playback driver không tiến thời gian khi mode là `scrubbing`.
- playback dừng đúng content end.
- chuyển đổi time-to-frame nhất quán ở sát ranh giới frame.

### 7.2. Component/integration tests

- Trong lúc pointer vẫn đang giữ, kéo playhead làm timecode đổi.
- Playhead position, timecode frame và preview frame cùng biểu diễn một `currentTime`.
- Thả chuột không tạo bước nhảy ngược hoặc tiến thêm một frame.
- `pointercancel` kết thúc scrub sạch sẽ.
- Kéo khi đang playback phải pause trước khi seek.
- Kéo qua biên giữa hai scene cập nhật đúng scene preview.
- Zoom hoặc horizontal scroll không làm sai phép đổi pointer X sang time.

### 7.3. Regression checks

- Click ruler vẫn seek đúng.
- Play/pause và tự dừng cuối timeline vẫn hoạt động.
- Clip drag vẫn khóa scrub như hiện tại.
- Timeline zoom không bị ảnh hưởng.
- Project FPS khác 30, ví dụ 24, 25 và 60 fps, vẫn đồng bộ frame.

### 7.4. Lệnh kiểm tra

```powershell
pnpm --filter @motionvideo/web typecheck
pnpm --filter @motionvideo/web lint
pnpm --filter @motionvideo/web e2e
```

Chạy e2e chọn lọc trong lúc phát triển; chạy bộ phù hợp đầy đủ trước khi kết thúc.

## 8. Tiêu chí nghiệm thu

### Tính đúng

- Chỉ có một playback `currentTime` trong runtime editor.
- Khi đang giữ và kéo chuột, timecode thay đổi trước `pointerup`.
- Playhead, timecode và preview không lệch quá một frame video.
- Không có race giữa playback RAF và scrub.
- Không lệch một frame do khác biệt `round` và `floor`.

### Trải nghiệm

- Playhead bám con trỏ liên tục và không có bước nhảy khi thả.
- Preview phản hồi trong lúc scrub, không chờ kết thúc drag.
- Timecode không nhấp nháy hoặc làm layout dịch chuyển.
- Scrub qua biên scene không hiển thị frame của scene cũ sau khi playhead đã sang scene mới.

### Hiệu năng

- Pointer events được gom tối đa một clock update mỗi animation frame.
- Preview evaluate tối đa một lần cho mỗi frame video khác nhau.
- React Profiler xác nhận `TimelineBoard` và phần tĩnh của `TransportBar` không render theo từng clock tick.
- Trên fixture baseline, không xuất hiện long task mới trên 50 ms do scrub; mục tiêu cảm nhận playhead đạt gần 60 fps trên máy test.

## 9. Rủi ro và biện pháp

| Rủi ro | Biện pháp |
|---|---|
| Hai store cùng giữ `currentTime` trong migration | Chỉ clock mới được ghi; adapter cũ chỉ đọc và bị xóa ở Phase 6 |
| Preview vẫn nặng ở project nhiều node | Gate theo `frameIndex`, isolate runtime canvas, profile rồi mới memoize sâu |
| Closure cũ khi zoom/scroll trong lúc kéo | Giữ scale và scroll trong ref cập nhật tức thời |
| RAF chưa flush trước `pointerup` | Flush pending time đồng bộ trước khi kết thúc scrub |
| Timecode và preview lệch một frame | Dùng chung helper time-to-frame |
| Duration thay đổi trong khi đang ở cuối timeline | `setDuration()` clamp `currentTime` ngay lập tức |
| React Strict Mode tạo subscription/RAF kép | Cleanup idempotent và test mount/unmount |

## 10. Ngoài phạm vi kế hoạch này

- Auto-scroll timeline khi kéo playhead sát mép viewport.
- Snap playhead vào clip boundary hoặc marker.
- Audio scrubbing/jog sound.
- Waveform synchronization.
- Playback bằng media element hoặc AudioContext làm master clock.
- Worker/OffscreenCanvas cho preview nặng.

Các mục này có thể triển khai sau mà không thay đổi nguyên tắc một `currentTime`.

## 11. Thứ tự PR/commit đề xuất

1. `test(timeline): capture live scrub synchronization`
2. `refactor(playback): add canonical playback clock`
3. `feat(timeline): drive playhead and timecode from currentTime`
4. `perf(preview): render scrub preview by frame index`
5. `refactor(playback): centralize RAF driver and remove legacy clock`
6. `test(timeline): cover scrub, scene boundaries and fps variants`

Không trộn thay đổi styling hoặc timeline clip drag vào chuỗi này để việc review và đo regression rõ ràng.

## 12. Definition of done

- Tất cả tiêu chí nghiệm thu ở mục 8 đạt.
- Typecheck, lint và các test timeline liên quan pass.
- Không còn clock playback trùng trong `editor-store.ts`.
- Profiler evidence được ghi lại trước và sau thay đổi.
- Comment và tên API phản ánh đúng một nguồn `currentTime`.
- Không có thay đổi ngoài phạm vi đối với clip move, zoom, ruler hoặc editor persistence.
