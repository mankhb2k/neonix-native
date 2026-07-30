# Kế hoạch cải thiện Timeline UI/UX: Fit 1/3 và tách vùng scroll

## 1. Mục tiêu

Thay cơ chế load project với một giá trị zoom cố định bằng cơ chế `content-aware fit` giống cách các video editor chuyên nghiệp vận hành.

Policy chính được chốt:

- Clip hình ảnh đầu tiên chiếm khoảng `1/3` chiều rộng vùng nội dung timeline.
- Ví dụ clip dài `5 giây` thì ruler ban đầu hiển thị khoảng `15 giây`.
- Tại initial fit, `scrollLeft = 0` và horizontal scrollbar chưa có khoảng để di chuyển nếu timeline mới chỉ có clip đầu tiên.
- Zoom không tự thay đổi khi thêm, xóa hoặc di chuyển clip sau đó.
- Cột icon/control bên trái không scroll ngang.
- Horizontal scrollbar chỉ nằm dưới vùng nội dung lane, không nằm dưới cột icon.
- Cột icon và nội dung lane luôn đồng bộ khi scroll dọc.

## 2. Nhận định từ UI CapCut

Ảnh tham chiếu cho thấy:

- Clip dài khoảng `02:07` chiếm gần `1/3` vùng timeline đang nhìn thấy.
- Ruler hiển thị khoảng hơn `06:00`.
- Phần trống bên phải clip được chủ động giữ lại làm runway cho việc thêm clip và thao tác timeline.
- Cột icon lane bên trái cố định theo chiều ngang.
- Horizontal scrollbar bắt đầu sau cột icon, chỉ đại diện cho vùng timeline content.

Không nên xem phần trăm slider là phần trăm chiều rộng clip. Slider chỉ nên điều khiển scale tương đối so với mức fit.

## 3. Vấn đề của implementation hiện tại

### 3.1. Initial zoom đang là một giá trị cố định

File:

`apps/web/lib/editor/editor-preferences.ts`

Hiện tại:

```ts
export const TIMELINE_ZOOM_ON_PROJECT_LOAD = 25;
```

Giá trị này không thể đảm bảo clip đầu tiên chiếm một tỷ lệ ổn định vì kích thước clip còn phụ thuộc vào:

- Duration clip.
- Chiều rộng panel timeline.
- FPS project.
- Minimum/maximum pixels per second.
- Công thức nội suy canvas duration.

### 3.2. Minimum workspace 18 phút làm clip ngắn quá nhỏ

File:

`apps/web/components/desktop/editor/timeline/timeline-scale.ts`

Hiện tại:

```ts
export const TIMELINE_MIN_WORKSPACE_SECONDS = 18 * 60;

export function timelineWorkspaceSeconds(contentSeconds: number): number {
  return Math.max(contentSeconds * 4, TIMELINE_MIN_WORKSPACE_SECONDS);
}
```

Với clip `5 giây`:

```text
contentSeconds  = 5
content × 4     = 20
workspace       = max(20, 1080) = 1080 giây
```

Ở zoom load hiện tại, clip 5 giây chỉ chiếm khoảng `3–4%` viewport thay vì `1/3`.

### 3.3. Canvas duration đang phụ thuộc vào nhiều policy chồng lên nhau

`timelineCanvasDuration()` hiện trộn các khái niệm:

- Workspace duration.
- Minimum 18 phút.
- `contentEnd + 30` giây.
- Viewport duration.
- Smoothstep theo zoom 20–30.

Điều này làm scroll width khó dự đoán và khó trả lời chính xác các câu hỏi:

- Khi nào horizontal scroll bắt đầu hoạt động?
- Clip đầu tiên chiếm bao nhiêu phần viewport?
- Zoom 25 thực tế đang đại diện cho scale nào?
- Tại sao project ngắn vẫn có ruler rất dài?

### 3.4. Cột icon và lane content đang dùng chung một scroll root

Files:

- `apps/web/components/desktop/editor/timeline/Tracks/Tracks.tsx`
- `apps/web/components/desktop/editor/timeline/Tracks/TrackLane.tsx`

Hiện tại `Tracks` dùng một container `overflow-auto` cho cả cột icon và content. Icon được giữ lại bằng:

```ts
className="sticky left-0 ..."
```

Hệ quả:

- Horizontal scrollbar trải dưới toàn bộ timeline, bao gồm cả cột icon.
- `scrollWidth` chứa cả `TIMELINE_LABEL_WIDTH` và canvas width.
- DnD, marquee, playhead và seek phải trừ label width thủ công.
- Sticky label, insert indicator và drag ghost phải xử lý nhiều lớp `z-index`.
- Khó đạt UI giống CapCut một cách ổn định.

## 4. Mô hình scale mới

### 4.1. Các khái niệm cần tách riêng

```text
fitSpanSeconds
  Khoảng thời gian cần nhìn thấy tại mức Fit.

fitPixelsPerSecond
  Pixels per second để fitSpanSeconds vừa đúng content viewport.

zoomScale
  Hệ số zoom thủ công so với Fit. Fit = 1.

timelineExtentSeconds
  Toàn bộ thời gian có thể scroll trên canvas.

visibleDurationSeconds
  Khoảng thời gian đang nhìn thấy trong viewport tại scale hiện tại.
```

### 4.2. Constants đề xuất

```ts
export const TIMELINE_INITIAL_CLIP_RATIO = 1 / 3;
export const TIMELINE_INITIAL_SPAN_FACTOR = 3;
export const TIMELINE_EMPTY_SPAN_SECONDS = 15;
export const TIMELINE_MIN_FIT_SPAN_SECONDS = 3;
export const TIMELINE_FIT_ZOOM_SCALE = 1;
```

`TIMELINE_MIN_FIT_SPAN_SECONDS` chỉ là safety clamp cho clip cực ngắn. Với clip thông thường, rule vẫn là duration nhân 3.

### 4.3. Tính fit span

```ts
export function timelineFitSpanSeconds(anchorDuration: number): number {
  if (anchorDuration <= 0) return TIMELINE_EMPTY_SPAN_SECONDS;

  return Math.max(
    TIMELINE_MIN_FIT_SPAN_SECONDS,
    anchorDuration * TIMELINE_INITIAL_SPAN_FACTOR,
  );
}
```

Ví dụ:

| Clip duration | Fit span | Tỷ lệ clip |
|---:|---:|---:|
| 1s | 3s | 1/3 |
| 5s | 15s | 1/3 |
| 10s | 30s | 1/3 |
| 30s | 90s | 1/3 |

Timeline trống dùng `15 giây` làm initial span.

### 4.4. Tính pixels per second

Phải dùng `clientWidth` thật của content scroller, không dùng toàn bộ board width.

```ts
const fitPixelsPerSecond =
  contentViewportWidth / fitSpanSeconds;

const pixelsPerSecond =
  fitPixelsPerSecond * zoomScale;
```

Tại Fit:

```text
zoomScale = 1
clipWidth = clipDuration × fitPixelsPerSecond
clipWidth / contentViewportWidth = 1/3
```

### 4.5. Tính timeline extent và scroll width

Không cộng cứng `30 giây` cho mọi project. Padding nên tỷ lệ theo nội dung/viewport và có clamp.

```ts
const trailingPaddingSeconds = clamp(
  fitSpanSeconds * 0.1,
  1,
  30,
);

const contentExtentSeconds =
  contentEndSeconds + trailingPaddingSeconds;

const visibleDurationSeconds =
  contentViewportWidth / pixelsPerSecond;

const timelineExtentSeconds = Math.max(
  fitSpanSeconds,
  contentExtentSeconds,
  visibleDurationSeconds,
);

const canvasWidth = Math.max(
  contentViewportWidth,
  timelineExtentSeconds * pixelsPerSecond,
);
```

Riêng project vừa có clip đầu tiên, `contentExtentSeconds` không được làm canvas lớn hơn Fit span. Factor 3 đã cung cấp `2/3` viewport runway bên phải, không cần cộng thêm padding khiến scrollbar xuất hiện.

Policy chính xác:

```ts
const contentExtentSeconds = isFirstClipOnly
  ? contentEndSeconds
  : contentEndSeconds + trailingPaddingSeconds;
```

### 4.6. Kết quả mong muốn với clip đầu tiên 5 giây

Giả sử content viewport rộng `1500px`:

```text
fitSpanSeconds       = 5 × 3 = 15s
fitPixelsPerSecond   = 1500 / 15 = 100px/s
clipWidth            = 5 × 100 = 500px
clip ratio           = 500 / 1500 = 1/3
canvasWidth          = 1500px
scrollLeft           = 0
maxScrollLeft        = 0
```

Khi user zoom vào `2×`:

```text
pixelsPerSecond      = 200px/s
canvasWidth          = 3000px
maxScrollLeft        = 1500px
```

## 5. Chọn fit anchor

Không được tính lại anchor theo `contentEnd` sau mỗi thay đổi clip, vì timeline sẽ tự nhảy zoom.

### 5.1. Project trống

```text
fitSpan = 15 giây
zoomMode = fit
scrollLeft = 0
```

### 5.2. Thả clip hình ảnh đầu tiên vào Main

```text
fitAnchorDuration = duration clip đầu tiên
fitSpan = duration × 3
zoomScale = 1
scrollLeft = 0
```

Chỉ thực hiện một lần khi project chuyển từ timeline trống sang có clip đầu tiên.

### 5.3. Load project đã có dữ liệu

Thứ tự tìm anchor:

1. Clip Main đầu tiên theo `startTime`.
2. Visual clip đầu tiên nếu không có Main.
3. Audio clip đầu tiên nếu project chỉ có audio.
4. Fallback về timeline trống 15 giây.

Sau khi xác định anchor, toàn bộ content vẫn được dùng để tính `timelineExtentSeconds`. Vì vậy clip đầu tiên chiếm `1/3`, còn các clip phía sau vẫn có thể truy cập bằng horizontal scroll.

### 5.4. Sau khi đã fit

Không tự fit lại khi:

- Thêm overlay.
- Thêm audio.
- Thêm clip Main tiếp theo.
- Move clip.
- Resize clip.
- Delete clip.
- Lane được thêm hoặc xóa.

Chỉ fit lại khi:

- Load/đổi project.
- Timeline trống nhận clip đầu tiên.
- User bấm lệnh `Fit timeline`.

Nếu clip anchor bị xóa, giữ nguyên scale hiện tại cho đến khi user chủ động Fit.

## 6. State và lifecycle

Không tạo Zustand store mới. Đây vẫn là editor viewport preference và nên nằm trong editor UI/preferences slice hiện tại.

State đề xuất:

```ts
type TimelineZoomMode = "fit" | "manual";

type TimelineViewportState = {
  timelineZoomMode: TimelineZoomMode;
  timelineZoomScale: number;
  timelineFitAnchorSeconds: number | null;
};
```

Initial/reset khi load project:

```ts
timelineZoomMode: "fit",
timelineZoomScale: 1,
timelineFitAnchorSeconds: resolveProjectFitAnchor(project),
```

Khi user thay slider:

```ts
timelineZoomMode: "manual";
timelineZoomScale: sliderValueToZoomScale(value);
```

Không dùng tên `zoomPercent` vì giá trị slider không phải phần trăm chiều rộng.

## 7. UX của zoom slider

Fit phải là mốc trung tâm của slider:

```text
slider giữa  = Fit / 1.0×
slider trái  = zoom out
slider phải  = zoom in
```

Công thức scale đề xuất:

```ts
export function sliderValueToZoomScale(value: number): number {
  const normalized = (value - 50) / 50;
  return 2 ** (normalized * ZOOM_OCTAVES);
}
```

Ví dụ với `ZOOM_OCTAVES = 4`:

```text
0   → 1/16× Fit
25  → 1/4× Fit
50  → 1× Fit
75  → 4× Fit
100 → 16× Fit
```

UI không nên hiển thị `50%`. Nên hiển thị một trong các dạng:

- `Fit`
- `1.0×`
- Không hiển thị số, chỉ có icon zoom out/in và slider.

Thêm nút hoặc double-click slider để trở về `Fit`.

## 8. Kiến trúc scroll mới

### 8.1. Layout mục tiêu

```text
┌──────────────────┬──────────────────────────────────┐
│ Ruler corner     │ Ruler viewport                   │
├──────────────────┼──────────────────────────────────┤
│ Lane labels      │ Timeline content scroller        │
│ fixed horizontal │ owns scrollLeft + scrollTop      │
│ sync vertical    │                                  │
└──────────────────┴──────────────────────────────────┘
                   └── horizontal scrollbar ──────────
```

CSS skeleton:

```tsx
<div className="timeline-board-grid">
  <div className="ruler-corner" />
  <div className="ruler-viewport" />

  <div className="lane-label-viewport">
    <div style={{ transform: `translateY(${-scrollTop}px)` }}>
      {laneLabels}
    </div>
  </div>

  <div ref={contentScrollRef} className="timeline-content-scroll">
    {laneContentRows}
  </div>
</div>
```

Grid columns:

```css
grid-template-columns: var(--timeline-label-width) minmax(0, 1fr);
```

### 8.2. Một scroll owner duy nhất

`contentScrollRef` sở hữu:

- `scrollLeft`.
- `scrollTop`.
- Native vertical scrollbar.
- Native horizontal scrollbar.
- Auto-scroll cho DnD và marquee.

Không tạo một vertical scrollbar riêng cho labels.

Khi content scroll:

```ts
setScrollLeft(contentScroller.scrollLeft);
setScrollTop(contentScroller.scrollTop);
```

Consumers:

```text
TimeRuler       ← scrollLeft
Playhead        ← scrollLeft
Lane labels     ← scrollTop
DnD cache       ← scrollLeft + scrollTop
Marquee         ← content coordinates
```

### 8.3. Wheel trên cột icon

Cột label không phải scroll container nhưng user vẫn phải cuộn được khi pointer nằm trên icon.

```ts
function handleLabelWheel(event: WheelEvent) {
  contentScroller.scrollTop += event.deltaY;
}
```

Chỉ forward `deltaY`. Không forward horizontal wheel vào label pane.

### 8.4. Đồng bộ chiều cao row

Không để label và content tự quyết định chiều cao riêng.

Tạo một lane row model dùng chung:

```ts
type TimelineLaneRow = {
  id: string;
  family: "overlay" | "main" | "audio";
  height: number;
  order: number;
};
```

Constants:

```ts
MAIN_LANE_HEIGHT_PX
SECONDARY_LANE_HEIGHT_PX
LANE_GAP_PX
TIMELINE_TOP_PADDING_PX
TIMELINE_BOTTOM_PADDING_PX
```

Cả label pane và content pane render theo cùng một `laneRows` array để không bị lệch dọc.

## 9. Những phép tính tọa độ phải thay đổi sau khi tách scroll

Sau khi `contentScrollRef` bắt đầu ngay sau cột icon, không được tiếp tục trừ `TIMELINE_LABEL_WIDTH` trong time/content coordinates.

Phải rà soát:

### 9.1. Sidebar drag

File:

`apps/web/components/desktop/editor/timeline/Tracks/useTracksDrag.ts`

Hiện tại có dạng:

```ts
clientX - rootRect.left + scrollLeft - TIMELINE_LABEL_WIDTH
```

Sau khi split:

```ts
clientX - contentRect.left + scrollLeft
```

### 9.2. Clip move

File:

`apps/web/components/desktop/editor/timeline/Tracks/useTimelineClipMove.ts`

`clientXToGhostLeft()` phải dùng content scroller rect và bỏ label offset.

### 9.3. Ruler seek và playhead

Files:

- `apps/web/components/desktop/editor/timeline/TimelineBoard.tsx`
- `apps/web/components/desktop/editor/timeline/Tracks/Playhead.tsx`

Time zero bắt đầu tại `contentScroller.left`, không bắt đầu tại board left cộng label width nữa.

### 9.4. Drag ghost

Các `leftOffset: TIMELINE_LABEL_WIDTH` phải được kiểm tra lại. Khi ghost render bên trong content workspace, offset thường phải về `0`.

### 9.5. Insert indicator

Insert indicator chỉ phủ content pane:

```ts
left: 0;
width: canvasWidth;
```

Không bắt đầu từ `TIMELINE_LABEL_WIDTH` bên trong workspace mới.

### 9.6. Marquee

Marquee tiếp tục dùng content/workspace coordinates. Cột label nằm ngoài workspace và không tham gia selection hit-test.

## 10. Cấu trúc file đề xuất

```text
components/desktop/editor/timeline/
  TimelineBoard.tsx
  timeline-scale.ts
  timeline-fit.ts

  Tracks/
    Tracks.tsx
    TimelineLaneLabels.tsx
    TimelineLaneContent.tsx
    timeline-lane-rows.ts
    useTimelineScrollSync.ts
    useTimelineAutoScroll.ts
    useTracksDrag.ts
    useTimelineClipMove.ts
    useMarqueeSelect.ts
```

Trách nhiệm:

- `timeline-fit.ts`: pure functions tính fit span, fit PPS, extent và slider scale.
- `timeline-lane-rows.ts`: tạo một row model dùng chung cho labels/content.
- `useTimelineScrollSync.ts`: scrollLeft, scrollTop, ruler và label synchronization.
- `useTimelineAutoScroll.ts`: tiếp tục là controller auto-scroll duy nhất.
- Không đưa DOM geometry vào Zustand.

## 11. Kế hoạch triển khai theo phase

### Phase 0 — Baseline và khóa behavior hiện tại

- Chụp lại các case clip `1s`, `5s`, `10s`, `30s`.
- Ghi nhận viewport width, clip pixel width, ruler visible duration và maxScrollLeft.
- Giữ toàn bộ E2E DnD/marquee hiện có chạy xanh.

Deliverable:

- Baseline test và bảng số liệu trước thay đổi.

### Phase 1 — Tạo pure fit math

- Tạo `timeline-fit.ts`.
- Thêm constants factor 3.
- Implement:
  - `timelineFitSpanSeconds()`.
  - `fitPixelsPerSecond()`.
  - `timelineExtentSeconds()`.
  - `sliderValueToZoomScale()`.
  - `zoomScaleToSliderValue()`.
- Chưa thay UI hoặc scroll DOM.

Unit tests bắt buộc:

- Clip 5s → span 15s.
- Clip 10s → span 30s.
- Fit canvas width bằng viewport width.
- Zoom 2× → canvas width bằng 2× viewport khi chỉ có clip đầu tiên.
- Zoom out không tạo canvas nhỏ hơn viewport.
- Clamp hoạt động với duration không hợp lệ hoặc cực ngắn.

### Phase 2 — Thay zoom lifecycle

- Bỏ hard reset `timelineZoom = 25`.
- Thêm `timelineZoomMode`, `timelineZoomScale`, `timelineFitAnchorSeconds` vào editor preference slice hiện tại.
- Resolve fit anchor khi load project.
- Fit một lần khi timeline trống nhận clip đầu tiên.
- User thay slider sẽ chuyển mode sang `manual`.
- Không fit lại trên những mutation clip khác.

Regression cần kiểm tra:

- Load project A rồi project B không dùng anchor cũ.
- Add overlay/audio không đổi PPS.
- Delete clip anchor không gây zoom jump.
- Resize panel trong Fit mode vẫn giữ tỷ lệ 1/3.

### Phase 3 — Thay canvas/ruler calculation

- `TimelineBoard` đo content viewport thực tế.
- Bỏ initial dependency vào `TIMELINE_MIN_WORKSPACE_SECONDS = 18 phút`.
- Bỏ smoothstep 20–30 khỏi initial canvas policy.
- Dùng `fitPps × zoomScale`.
- Dùng `timelineExtentSeconds` mới.
- Reset `scrollLeft = 0` khi fit project mới.

Acceptance:

- Clip đầu 5s có width sai số không quá `±2px` so với `contentViewportWidth / 3`.
- Initial `maxScrollLeft <= 1px` khi project chỉ có clip đầu tiên.
- Ruler kết thúc quanh 15s trong case clip 5s.

### Phase 4 — Chuẩn hóa lane row model

- Tạo `timeline-lane-rows.ts`.
- Chuyển logic sort overlay/main/audio vào pure row builder.
- Labels và content cùng nhận một row array.
- Khóa lane height bằng constants thay vì class rời rạc.

Không thay DnD trong phase này.

### Phase 5 — Tách label pane và content scroller

- Chuyển `TimelineBoard` sang grid 2 cột.
- Tạo `TimelineLaneLabels`.
- Tạo `TimelineLaneContent` hoặc refactor `Tracks` thành content-only.
- `contentScrollRef` trở thành scroll owner duy nhất.
- Sync `scrollTop` sang label transform.
- Forward wheel từ labels sang content.
- Horizontal scrollbar chỉ xuất hiện dưới content pane.

### Phase 6 — Migration toàn bộ interaction coordinates

Thực hiện theo thứ tự:

1. Time ruler.
2. Playhead seek/scrub.
3. Sidebar drag.
4. Internal clip move.
5. Insert indicator và drag ghost.
6. Marquee.
7. Auto-scroll.

Sau mỗi bước phải chạy test riêng, không đợi hoàn thành toàn bộ phase mới test.

### Phase 7 — UI polish

- Slider giữa hiển thị Fit/1×.
- Thêm action `Fit timeline`.
- Double-click slider hoặc icon reset về Fit.
- Giữ playhead/time anchor khi user zoom thủ công.
- Không để scrollbar nhảy khi vertical scrollbar xuất hiện.
- Kiểm tra dark theme, hover, sticky ruler corner và z-index.

### Phase 8 — E2E và performance validation

E2E bắt buộc:

- Timeline trống → drop clip 5s → clip chiếm 1/3.
- Clip đầu tiên → maxScrollLeft bằng 0.
- Zoom in → horizontal scroll hoạt động.
- Horizontal scrollbar bắt đầu sau label pane.
- Wheel trên lane icon → content scroll dọc.
- Ruler, playhead và content giữ cùng time coordinate sau scroll.
- Drag audio xuống lane ngoài viewport.
- Drag overlay lên lane ngoài viewport.
- Marquee + wheel chọn clip ngoài viewport.
- Reload project giữ đúng policy fit/manual đã chốt.

Performance:

- Không set React state mỗi `pointermove` ngoài RAF hiện có.
- Không đo toàn bộ lane rect mỗi animation frame.
- Label sync dùng transform hoặc imperative scroll, không render lại toàn bộ lane tree mỗi scroll event.
- Ruler tiếp tục cull ticks theo visible window.

## 12. Rủi ro và cách giảm thiểu

### Rủi ro 1: Sai lệch label/content theo chiều dọc

Nguyên nhân:

- Hai pane render height khác nhau.

Giảm thiểu:

- Một lane row model.
- Height constants dùng chung.
- E2E so sánh `getBoundingClientRect().top` của label và lane.

### Rủi ro 2: DnD lệch ngang đúng bằng label width

Nguyên nhân:

- Tiếp tục trừ `TIMELINE_LABEL_WIDTH` sau khi content scroller đã được tách.

Giảm thiểu:

- Quy định một coordinate contract duy nhất: `timelineX = clientX - contentRect.left + scrollLeft`.
- Unit test coordinate conversion.
- Xóa mọi subtraction rải rác và dùng shared helper.

### Rủi ro 3: Zoom tự nhảy khi thêm clip

Nguyên nhân:

- Fit anchor bị derive lại từ `timelineClips` mỗi render.

Giảm thiểu:

- Anchor được snapshot khi load/first drop.
- Mutation thường chỉ cập nhật extent, không cập nhật fit anchor.

### Rủi ro 4: Scrollbar xuất hiện 1–2px tại Fit

Nguyên nhân:

- Làm tròn pixels per second.
- Vertical scrollbar làm thay đổi client width.
- Border/padding tham gia scroll width.

Giảm thiểu:

- Dùng `contentScroller.clientWidth` sau layout.
- Giữ PPS dạng float.
- `canvasWidth = Math.max(clientWidth, calculatedWidth)`.
- Acceptance cho phép sai số `<= 1px`.

### Rủi ro 5: Zoom làm mất vị trí đang xem

Nguyên nhân:

- Chỉ đổi PPS mà không giữ time anchor dưới pointer/playhead.

Giảm thiểu:

- Initial Fit luôn anchor tại time 0.
- Manual zoom giữ time tại playhead hoặc pointer làm anchor.
- Tính lại `scrollLeft` sau PPS change.

## 13. Definition of Done

Implementation chỉ được coi là hoàn thành khi:

- Không còn dùng fixed load zoom `25` để quyết định initial scale.
- Clip đầu 5s chiếm `1/3 ± 2px` content viewport.
- Ruler initial của clip 5s hiển thị khoảng 15s.
- Project chỉ có clip đầu tiên không scroll ngang được quá 1px.
- Thêm clip sau không gây zoom jump.
- Cột lane icon không di chuyển ngang.
- Cột lane icon đồng bộ chính xác với lane khi scroll dọc.
- Horizontal scrollbar bắt đầu sau cột icon.
- Ruler, playhead, DnD và marquee dùng chung một content coordinate contract.
- Typecheck và lint pass.
- Toàn bộ unit tests pass.
- Toàn bộ timeline E2E pass.
- Có regression E2E riêng cho Fit 1/3 và split scroll layout.

## 14. Thứ tự commit đề xuất

Để dễ review và rollback:

1. `test(timeline): add 1/3 fit scale baselines`
2. `refactor(timeline): introduce content-aware fit math`
3. `feat(timeline): replace fixed load zoom with fit lifecycle`
4. `refactor(timeline): build shared lane row model`
5. `refactor(timeline): split lane labels from content scroller`
6. `fix(timeline): migrate interactions to content coordinates`
7. `test(timeline): cover fit zoom and split scroll e2e`
8. `style(timeline): polish fit control and scrollbar layout`

Không gộp fit math và scroll DOM refactor vào cùng một commit lớn.
