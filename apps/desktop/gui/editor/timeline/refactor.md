# Kế hoạch tổ chức lại module Timeline

> Trạng thái: **đã hoàn thành** (Phase 0–6)  
> Phạm vi: `apps/desktop/gui/editor/timeline` và các import trực tiếp tới `timeline/Tracks`  
> Mục tiêu chính: giải thể dần `Tracks` thành các feature có ranh giới rõ, không thay đổi hành vi người dùng

## 1. Tóm tắt quyết định

`Tracks` hiện không còn là một feature đơn nhất. Folder này đang chứa đồng thời:

- component bố cục viewport;
- render clip và lane;
- pointer gesture cho move/trim/marquee;
- drag/drop từ Library;
- geometry và virtualization;
- context menu, hotkey, scrollbar và playhead;
- API dùng chung được các module ngoài Timeline import trực tiếp.

Không nên chỉ tạo vài folder con rồi di chuyển nguyên trạng các file lớn. Việc tổ chức lại sẽ được thực hiện theo hai bước lặp lại ở từng phase:

1. Tách trách nhiệm và xác định API của feature.
2. Di chuyển file về vị trí thể hiện đúng trách nhiệm đó.

Kết quả cuối cùng là xóa `timeline/Tracks`. `Timeline.tsx` tiếp tục là entry point UI chính của Timeline.

## 2. Mục tiêu

### 2.1. Mục tiêu bắt buộc

- Mỗi folder thể hiện một feature hoặc một lớp trách nhiệm rõ ràng.
- `TimelineViewport` chỉ làm nhiệm vụ composition và kết nối các feature.
- `ClipStrip` chủ yếu render clip; logic move và trim nằm trong hook/controller riêng.
- Logic thuần như geometry, layout và policy không phụ thuộc React.
- Module `library` không import đường dẫn nội bộ từ một folder component như `timeline/Tracks`.
- Test thuần được đặt cạnh implementation tương ứng.
- Mỗi phase có thể merge độc lập và không làm thay đổi hành vi hiện tại.
- Kết thúc refactor không còn import chứa `timeline/Tracks`.

### 2.2. Không nằm trong phạm vi

- Không thiết kế lại UI Timeline.
- Không thay đổi timeline schema hoặc command của `@motionvideo/editor-core`.
- Không thay đổi thuật toán placement/snapping nếu không cần để tách module.
- Không đồng thời refactor implementation Timeline của `apps/web`.
- Không đổi tên hàng loạt `Header` và `TimeRuler` chỉ để đồng bộ kiểu chữ folder.
- Không tạo barrel `index.ts` cho mọi folder nếu chưa có nhu cầu public API thực tế.

## 3. Vấn đề hiện tại

### 3.1. `TimelineViewport.tsx` là component điều phối quá lớn

File hiện tại quản lý cùng lúc:

- kích thước viewport và `ResizeObserver`;
- đồng bộ scroll ngang/dọc qua `requestAnimationFrame`;
- detached horizontal scrollbar;
- tính canvas width, zoom và fit;
- gom clip theo lane và virtualization hai chiều;
- đăng ký global Timeline drop host;
- preview khi kéo asset từ Library;
- marquee selection;
- render ruler, lane labels, lane canvas và các drag overlay.

Hệ quả là thay đổi một tương tác nhỏ có thể ảnh hưởng component hơn 1.000 dòng và rất khó test riêng từng lifecycle.

### 3.2. `ClipStrip.tsx` trộn UI và gesture controller

File hiện tại vừa render clip vừa xử lý:

- selection đơn và multi-select;
- group move;
- cross-lane move;
- snapping;
- insert lane;
- auto-scroll;
- trim trái/phải;
- preview local và preview chia sẻ với viewport.

Logic gesture cần được tách khỏi JSX để có thể kiểm thử và thay đổi độc lập.

### 3.3. `drop-host.ts` có nhiều loại trách nhiệm

File hiện tại chứa:

- singleton registry của DOM host;
- chuyển pointer sang content coordinate;
- state hysteresis cho insert lane;
- tính preview geometry;
- chuyển `LibraryPayload` thành placement;
- kiểm tra pointer gần Timeline;
- auto-scroll khi pointer gần mép.

Đây vừa là infrastructure, vừa là policy adapter, vừa là Library integration. Việc tách file này là điều kiện để tạo dependency boundary rõ.

### 3.4. Dependency boundary bị rò rỉ

Các module sau đang import trực tiếp từ `timeline/Tracks`:

- `EditingWorkspace.tsx` import hotkey;
- `library/components/LibraryDragPreview.tsx` import drop host/geometry;
- `library/hooks/use-library-pointer-gesture.ts` import placement và auto-scroll;
- `library/adapters/commit-library-payload.ts` import placement;
- `timeline/view-model/use-visible-timeline.ts` re-export lane virtualization;
- test trong `timeline/interactions` import viewport layout.

Những import này cho thấy `Tracks` đang đóng vai trò API công khai ngoài ý muốn.

## 4. Nguyên tắc tổ chức

### 4.1. Nhóm theo feature, không nhóm chung theo loại kỹ thuật

Ưu tiên:

```text
clips/
  ClipStrip.tsx
  use-clip-move.ts
  clip-move-geometry.ts
```

Không ưu tiên:

```text
components/
hooks/
utils/
```

Một feature nên chứa UI, hook/controller và logic thuần liên quan trực tiếp tới feature đó. Chỉ những primitive thật sự dùng chung giữa nhiều feature mới được đặt ở cấp `timeline` hoặc một module dùng chung có tên cụ thể.

### 4.2. Chiều phụ thuộc

Chiều phụ thuộc mong muốn:

```text
Timeline.tsx
  -> viewport/
       -> clips/, lanes/, selection/, context-menu/
       -> drop/, view-model/, interactions/
            -> pure geometry/policy
                 -> @motionvideo/editor-core
```

Quy tắc:

- Pure module không import React hoặc component.
- Component cấp thấp không import `TimelineViewport`.
- Feature không import file private của feature khác nếu có thể truyền dependency qua props/argument.
- `library` chỉ sử dụng API integration được đặt tên rõ; không import component hoặc file private của `viewport`/`clips`.
- `TimelineViewport` được phép phụ thuộc nhiều feature vì đây là composition root.
- Không tạo dependency vòng thông qua barrel file.

### 4.3. Public và private API

Ban đầu tiếp tục dùng direct import để việc di chuyển dễ kiểm soát. Chỉ thêm `index.ts` khi một feature thực sự cần cung cấp API ổn định cho module ngoài Timeline.

Đối với Library drop, API công khai dự kiến nên giới hạn ở các operation như:

- đăng ký/hủy đăng ký Timeline drop host;
- kiểm tra drop zone;
- resolve preview;
- resolve placement để commit;
- auto-scroll gần mép.

Không public các helper DOM/policy nhỏ nếu chúng chỉ được dùng bên trong `drop`.

## 5. Cây thư mục đích

```text
timeline/
├─ Timeline.tsx
├─ timeline-scale.ts
├─ timeline-seek.ts
├─ timeline-interaction-prefs.ts
│
├─ Header/                         # Giữ nguyên trong refactor này
│  ├─ TransportBar.tsx
│  ├─ TimelineModeToggles.tsx
│  ├─ EditActions.tsx
│  └─ CurrentTimeDisplay.tsx
│
├─ TimeRuler/                      # Giữ nguyên trong refactor này
│  └─ TimeRuler.tsx
│
├─ viewport/
│  ├─ TimelineViewport.tsx
│  ├─ TimelineLaneCanvas.tsx
│  ├─ TimelineLaneLabels.tsx
│  ├─ TimelineOverlays.tsx
│  ├─ Playhead.tsx
│  ├─ TimelineHScrollBar.tsx
│  ├─ EmptyTimelineDash.tsx
│  ├─ use-timeline-viewport-metrics.ts
│  └─ viewport-layout.ts
│
├─ clips/
│  ├─ ClipStrip.tsx
│  ├─ use-clip-move.ts
│  ├─ use-clip-trim.ts
│  ├─ clip-move-geometry.ts
│  └─ clip-move-geometry.test.ts
│
├─ lanes/
│  ├─ LaneFlagControls.tsx
│  ├─ LaneLeadingIcon.tsx
│  ├─ timeline-lane-rows.ts
│  └─ timeline-lane-rows.test.ts
│
├─ drop/
│  ├─ timeline-drop-host.ts
│  ├─ library-drop.ts
│  ├─ drop-geometry.ts
│  ├─ drop-geometry.test.ts
│  ├─ lane-drop-target.ts
│  ├─ auto-scroll.ts
│  └─ library-drop.test.ts
│
├─ selection/
│  ├─ use-marquee-selection.ts
│  ├─ marquee-geometry.ts
│  └─ marquee-geometry.test.ts
│
├─ context-menu/
│  ├─ TimelineContextMenu.tsx
│  └─ timeline-context-actions.ts
│
├─ interactions/
│  ├─ use-timeline-hotkeys.ts
│  ├─ use-pointer-session.ts
│  ├─ pointer-session.ts
│  ├─ pointer-session-controller.ts
│  └─ các test hiện có
│
├─ view-model/
│  ├─ use-visible-timeline.ts
│  ├─ visible-lane-window.ts
│  └─ visible-lane-window.test.ts
│
├─ adapters/                       # Giữ nguyên trong refactor này
└─ __tests__/                      # Chỉ giữ integration/ownership test
```

Ghi chú:

- `timeline-scale.ts`, `timeline-seek.ts` và `timeline-interaction-prefs.ts` tạm giữ ở root vì đang được nhiều feature sử dụng. Chỉ di chuyển chúng nếu xuất hiện một ownership rõ hơn sau refactor.
- `TimelineLaneCanvas`, `TimelineLaneLabels`, `TimelineOverlays`, các hook move/trim/marquee và `library-drop.ts` là file mới dự kiến được extract, không phải thao tác rename đơn thuần.
- Tên `library-drop.test.ts` có thể tiếp tục là `drop-host.test.ts` trong giai đoạn đầu để giảm diff; đổi tên sau khi trách nhiệm đã tách ổn định.

## 6. Mapping file hiện tại sang vị trí đích

| File hiện tại trong `Tracks` | Vị trí đích | Hành động |
|---|---|---|
| `TimelineViewport.tsx` | `viewport/TimelineViewport.tsx` | Tách metrics, marquee, labels, canvas và overlays trước khi chuyển |
| `viewport-layout.ts` | `viewport/viewport-layout.ts` | Chuyển nguyên file, giữ pure |
| `Playhead.tsx` | `viewport/Playhead.tsx` | Chuyển nguyên file; xem xét tách gesture sau nếu cần |
| `TimelineHScrollBar.tsx` | `viewport/TimelineHScrollBar.tsx` | Chuyển nguyên file |
| `EmptyTimelineDash.tsx` | `viewport/EmptyTimelineDash.tsx` | Chuyển nguyên file |
| `ClipStrip.tsx` | `clips/ClipStrip.tsx` | Extract `use-clip-move` và `use-clip-trim` trước |
| `clip-move-geometry.ts` | `clips/clip-move-geometry.ts` | Chuyển cùng test; tiếp tục là pure module |
| `clip-move-geometry.test.ts` | `clips/clip-move-geometry.test.ts` | Chuyển cùng implementation |
| `LaneFlagControls.tsx` | `lanes/LaneFlagControls.tsx` | Chuyển nguyên file |
| `LaneLeadingIcon.tsx` | `lanes/LaneLeadingIcon.tsx` | Chuyển nguyên file |
| `timeline-lane-rows.ts` | `lanes/timeline-lane-rows.ts` | Chuyển cùng test |
| `timeline-lane-rows.test.ts` | `lanes/timeline-lane-rows.test.ts` | Chuyển cùng implementation |
| `drop-host.ts` | `drop/timeline-drop-host.ts`, `drop/library-drop.ts`, `drop/auto-scroll.ts` | Tách theo trách nhiệm, không chỉ rename |
| `drop-host.test.ts` | `drop/library-drop.test.ts` và/hoặc test host | Chia test theo module sau khi tách |
| `drop-geometry.ts` | `drop/drop-geometry.ts` | Chuyển nguyên file |
| `drop-geometry.test.ts` | `drop/drop-geometry.test.ts` | Chuyển cùng implementation |
| `lane-drop-target.ts` | `drop/lane-drop-target.ts` | Chuyển nguyên file; giữ phần DOM adapter tách khỏi core policy |
| `marquee-geometry.ts` | `selection/marquee-geometry.ts` | Chuyển cùng test |
| `marquee-geometry.test.ts` | `selection/marquee-geometry.test.ts` | Chuyển cùng implementation |
| `TimelineContextMenu.tsx` | `context-menu/TimelineContextMenu.tsx` | Chuyển cùng action builder |
| `timeline-context-actions.ts` | `context-menu/timeline-context-actions.ts` | Chuyển cùng component |
| `use-timeline-hotkeys.ts` | `interactions/use-timeline-hotkeys.ts` | Chuyển và cập nhật import từ `EditingWorkspace` |
| `visible-lane-window.ts` | `view-model/visible-lane-window.ts` | Chuyển, bỏ reverse re-export từ `Tracks` |
| `visible-lane-window.test.ts` | `view-model/visible-lane-window.test.ts` | Chuyển cùng implementation |

## 7. Kế hoạch triển khai theo phase

Mỗi phase phải kết thúc ở trạng thái typecheck, lint và test chạy được. Tránh một commit duy nhất vừa move toàn bộ file vừa thay đổi hành vi.

### Phase 0 — Baseline và bảo vệ hành vi

Mục tiêu: có điểm so sánh trước refactor.

Công việc:

1. Chạy typecheck, lint và test desktop hiện tại.
2. Ghi lại test đang fail sẵn, nếu có; không gán regression có sẵn cho refactor.
3. Xác nhận các hành vi Timeline quan trọng:
   - render lane và clip;
   - seek/playhead;
   - scroll ngang và dọc;
   - zoom/fit;
   - select và marquee;
   - move một clip;
   - move nhiều clip;
   - trim hai cạnh;
   - snapping;
   - kéo Library item vào base/overlay/audio;
   - insert lane;
   - context menu và hotkey.
4. Dùng `rg` lưu danh sách import tới `timeline/Tracks` để làm checklist migration.

Điều kiện hoàn thành:

- Có baseline test rõ ràng.
- Không có thay đổi production code trong phase này.

### Phase 1 — Di chuyển các module có ownership rõ

Mục tiêu: giảm file phẳng mà chưa thay đổi logic.

Công việc:

1. Tạo `clips`, `lanes`, `drop`, `selection`, `context-menu`, `viewport`.
2. Chuyển các cặp implementation/test thuần:
   - `clip-move-geometry` → `clips`;
   - `timeline-lane-rows` → `lanes`;
   - `drop-geometry` → `drop`;
   - `marquee-geometry` → `selection`;
   - `viewport-layout` → `viewport`.
3. Chuyển các component nhỏ có ownership rõ:
   - lane controls/icon → `lanes`;
   - context menu/action → `context-menu`;
   - playhead/scrollbar/empty state → `viewport`.
4. Cập nhật direct import, không thêm barrel file.

Điều kiện hoàn thành:

- Không đổi public type hoặc behavior.
- Test vẫn nằm cạnh implementation.
- `Tracks` chỉ còn các orchestrator lớn và integration chưa tách.

### Phase 2 — Sửa vị trí hotkey và virtualization

Mục tiêu: loại các ownership sai dễ thấy.

Công việc:

1. Chuyển `use-timeline-hotkeys.ts` vào `interactions`.
2. Cập nhật `EditingWorkspace.tsx` import từ `timeline/interactions`.
3. Chuyển `visible-lane-window.ts` và test vào `view-model`.
4. Để `use-visible-timeline.ts` import nội bộ cùng folder.
5. Bỏ re-export ngược từ `view-model` sang `Tracks`.
6. Cập nhật test đang import `viewport-layout` từ `Tracks`.

Điều kiện hoàn thành:

- `EditingWorkspace` không import `timeline/Tracks`.
- `view-model` không phụ thuộc `Tracks`.
- Không còn test Timeline import layout thông qua folder component cũ.

### Phase 3 — Tách Library drop boundary

Mục tiêu: biến drag/drop thành feature rõ và loại dependency tới `Tracks`.

Công việc:

1. Tách registry khỏi `drop-host.ts`:
   - type `TimelineDropHost`;
   - `setTimelineDropHost`/`getTimelineDropHost`;
   - coordinate conversion phụ thuộc host.
2. Tách Library-specific logic sang `library-drop.ts`:
   - payload family;
   - duration/ghost size/label;
   - preview geometry;
   - placement để commit.
3. Tách `autoScrollTimelineNearEdge` sang `auto-scroll.ts` nếu nó được cả clip move và Library drag sử dụng.
4. Giữ lane DOM hit testing trong `lane-drop-target.ts`.
5. Cập nhật Library imports tới API mới trong `timeline/drop`.
6. Nếu dependency từ `timeline/drop` tới `LibraryPayload` vẫn làm boundary khó hiểu, thêm type trung gian:

   ```ts
   type TimelineDropItem = {
     family: "visual" | "audio";
     durationSec: number;
     label: string;
     preferredGhostWidthPx?: number;
   };
   ```

   Library chịu trách nhiệm chuyển `LibraryPayload` thành `TimelineDropItem`; phần Timeline drop không cần biết model nội bộ của Library.
7. Chia test theo API mới. Giữ lại tất cả case hiện có về base, overlay, audio, insert, invalid target, snapping và scroll.

Điều kiện hoàn thành:

- `library/**` không import `timeline/Tracks`.
- Host registry không biết chi tiết `LibraryPayload` nếu đã áp dụng type trung gian.
- Pure placement/geometry có thể test không cần React.
- Không thay đổi command được commit khi drop.

### Phase 4 — Tách gesture khỏi `ClipStrip`

Mục tiêu: biến `ClipStrip` thành component render có kích thước và trách nhiệm hợp lý.

Công việc:

1. Extract `use-clip-move.ts`:
   - selection tại gesture start;
   - freeze group IDs;
   - threshold;
   - cross-lane target;
   - snapping và group validation;
   - preview;
   - commit `move-clip`/`move-clips`;
   - cancel cleanup.
2. Extract `use-clip-trim.ts`:
   - edge trái/phải;
   - minimum duration;
   - preview;
   - commit `clip/trim`;
   - cancel cleanup.
3. Truyền dependency rõ qua argument của hook:
   - `beginGesture`;
   - `onSelect`;
   - `onExecute`;
   - timeline geometry/config;
   - preview callback.
4. Giữ JSX, class name và keyboard activation trong `ClipStrip.tsx`.
5. Chuyển `ClipStrip` và geometry vào `clips` nếu chưa chuyển ở phase trước.
6. Bổ sung test cho controller/hook hoặc pure resolver nếu coverage hiện tại chưa bảo vệ:
   - click không vượt threshold không tạo move command;
   - move invalid không commit;
   - cancel xóa preview;
   - group move giữ delta;
   - trim không nhỏ hơn `MIN_CLIP_SLICE_SEC`.

Điều kiện hoàn thành:

- `ClipStrip.tsx` không chứa toàn bộ state machine move/trim inline.
- Render clip không phụ thuộc trực tiếp vào chi tiết Library drop.
- Pointer capture và cleanup vẫn hoạt động khi clip source được ẩn trong lúc move.

### Phase 5 — Tách `TimelineViewport`

Mục tiêu: `TimelineViewport` trở thành composition root dễ đọc.

Công việc:

1. Extract `use-timeline-viewport-metrics.ts`:
   - `viewWidth`, `trackViewHeight`;
   - `ResizeObserver`;
   - scroll state được throttle qua RAF;
   - cleanup RAF;
   - detached horizontal scrollbar metrics.
2. Extract `use-marquee-selection.ts`:
   - bắt đầu/kết thúc/cancel gesture;
   - theo dõi Shift;
   - auto-scroll;
   - tạo clip hit boxes;
   - gọi `onSelect`.
3. Extract `TimelineLaneLabels.tsx`:
   - render label virtualization spacers;
   - leading icon;
   - lane flag controls;
   - wheel forwarding.
4. Extract `TimelineLaneCanvas.tsx`:
   - render visible lane rows;
   - mount `ClipStrip`;
   - empty state;
   - nhận layout/view-model qua props thay vì tự tính lại.
5. Extract `TimelineOverlays.tsx`:
   - Library drop ghost;
   - insert indicator;
   - clip move ghost/cursor;
   - snap guide;
   - marquee rectangle.
6. Giữ trong `TimelineViewport.tsx`:
   - composition;
   - wiring các hook;
   - tạo layout/view-model cấp cao;
   - đăng ký drop host;
   - ghép ruler, labels, canvas, overlays và scrollbar.
7. Chuyển `TimelineViewport.tsx` vào `viewport` và cập nhật `Timeline.tsx`.

Nguyên tắc khi extract:

- Không truyền một object props khổng lồ chỉ để giấu coupling. Nhóm props theo model rõ như `layout`, `virtualRows`, `dropPreview` khi chúng thực sự là một khái niệm.
- Không duplicate phép tính `laneRows`, `bottomSpacer`, `pixelsPerSecond` ở nhiều component.
- State cần chia sẻ giữa lane canvas và overlay vẫn do viewport hoặc hook cấp viewport sở hữu.
- Không đưa side effect DOM vào pure layout module.

Điều kiện hoàn thành:

- `TimelineViewport` có thể đọc như sơ đồ composition thay vì state machine tổng hợp.
- Labels và canvas dùng cùng một virtual-row model.
- Drop, marquee và clip overlays không nằm inline trong JSX chính.
- Scroll/resize lifecycle có test hoặc được bảo vệ bởi integration test hiện có.

### Phase 6 — Xóa `Tracks` và củng cố boundary

Mục tiêu: hoàn tất migration và ngăn kiến trúc cũ quay lại.

Công việc:

1. Chạy tìm kiếm toàn repo:

   ```text
   rg "timeline/Tracks|timeline\\Tracks|/Tracks/" apps/desktop
   ```

2. Cập nhật mọi import còn sót.
3. Xóa folder `Tracks` sau khi xác nhận rỗng.
4. Kiểm tra dependency vòng.
5. Kiểm tra không có folder `utils`/`components` mới trở thành nơi chứa hỗn hợp.
6. Cập nhật tài liệu này với cây thực tế và đánh dấu hoàn thành từng phase.
7. Chỉ cân nhắc public `index.ts` cho `drop` nếu Library cần API ổn định và dependency graph vẫn một chiều.

Điều kiện hoàn thành:

- Không còn folder hoặc import `Tracks`.
- `Timeline.tsx` import viewport từ `timeline/viewport`.
- Không có module ngoài Timeline import file private của `clips`, `lanes` hoặc `viewport`.
- Tất cả kiểm tra chất lượng đều pass.

## 8. Chiến lược test và kiểm tra

### 8.1. Lệnh kiểm tra bắt buộc sau mỗi phase

Chạy từ repo root:

```bash
pnpm --filter @motionvideo/desktop typecheck
pnpm --filter @motionvideo/desktop lint
pnpm --filter @motionvideo/desktop test
```

Trong lúc làm một phase có thể chạy Vitest theo file để phản hồi nhanh, nhưng trước khi hoàn thành phase phải chạy toàn bộ test desktop.

### 8.2. Phân loại test

- Pure geometry/layout test đặt cạnh implementation:
  - clip move geometry;
  - drop geometry;
  - marquee geometry;
  - lane rows;
  - visible lane window;
  - viewport layout nếu bổ sung test riêng.
- Hook/controller test đặt cạnh feature nếu test implementation cụ thể.
- Integration/lifecycle/ownership test tiếp tục ở `timeline/__tests__` hoặc `timeline/interactions` khi chúng kiểm tra nhiều feature.
- Không di chuyển integration test vào một feature chỉ vì nó import một helper của feature đó.

### 8.3. Regression checklist thủ công

- Empty Timeline hiển thị đúng và nhận Library drop.
- Lane labels và clip rows không lệch khi scroll dọc.
- Ruler, playhead và clip không lệch khi scroll ngang.
- Detached horizontal scrollbar phản ánh đúng scroll width.
- Zoom/fit và đổi project reset scroll đúng như trước.
- Virtualized clip/lane vẫn giữ clip đang selected hoặc đang move được mount.
- Marquee hoạt động với và không có Shift.
- Move/trim giữ pointer capture, kể cả khi source clip bị ẩn.
- Drop ghost và insert indicator đúng Y/height cho visual và audio.
- Snap guide đúng cho clip move và Library drop.
- Context menu, copy/cut/paste, delete và hotkey không regression.

## 9. Quy tắc commit

Để review và rollback an toàn:

- Một commit chỉ move file thuần và sửa import, hoặc chỉ extract behavior; tránh trộn cả hai nếu diff lớn.
- Dùng rename/move giữ lịch sử file khi có thể.
- Không format hàng loạt file không liên quan.
- Không đổi class Tailwind/markup trong commit chỉ tổ chức code.
- Mỗi commit phải typecheck; mỗi phase phải pass lint và test đầy đủ.
- Nếu phải sửa bug phát hiện trong lúc refactor, ưu tiên commit bugfix riêng có test trước khi tiếp tục move.

Gợi ý chuỗi commit:

1. `refactor(timeline): move pure track modules to feature folders`
2. `refactor(timeline): relocate hotkeys and lane virtualization`
3. `refactor(timeline): define timeline drop integration boundary`
4. `refactor(timeline): extract clip move and trim gestures`
5. `refactor(timeline): split viewport labels canvas and overlays`
6. `refactor(timeline): remove legacy Tracks folder`

## 10. Rủi ro và cách giảm thiểu

### Pointer lifecycle bị thay đổi khi extract hook

Rủi ro lớn nhất là cleanup, pointer capture hoặc closure giữ state cũ. Giữ nguyên `beginGesture` contract trong lần extract đầu; chỉ chuyển code, chưa tối ưu state machine.

### Virtualization làm unmount source clip

Clip đang selected/move phải tiếp tục được pin. Không thay đổi logic `pinIds`, origin lane, target lane và member lanes trong cùng commit với việc tách component.

### Drop host singleton bị đăng ký sai lifecycle

Việc mount/unmount host phải tiếp tục gắn với viewport active. Test trường hợp đổi project, unmount Timeline và drag sau unmount để tránh giữ DOM reference cũ.

### Dependency vòng giữa `clips` và `drop`

`clips` có thể dùng public operation của `drop`, nhưng `drop` không được import `ClipStrip` hoặc hook của `clips`. Logic edge snap dùng chung nên nằm ở pure module có ownership rõ hoặc được đẩy xuống `editor-core` nếu thực sự dùng rộng.

### Diff rename lớn trên Windows

Tránh case-only rename. Refactor này không yêu cầu đổi `Header` thành `header` hoặc `TimeRuler` thành `time-ruler`.

## 11. Tiêu chí hoàn thành toàn bộ refactor

- [x] `timeline/Tracks` đã được xóa.
- [x] Không còn import tới `timeline/Tracks` trong `apps/desktop`.
- [x] `TimelineViewport` chỉ còn composition và orchestration cấp cao (metrics hook + overlays extract; lane labels/canvas vẫn compose inline trong viewport).
- [x] Move và trim không còn được implement inline toàn bộ trong `ClipStrip`.
- [x] Drop host registry, Library mapping và auto-scroll có boundary riêng.
- [x] Pure geometry/layout không phụ thuộc React.
- [x] Library dùng API Timeline drop rõ ràng, không import private viewport/clip module.
- [x] Test thuần nằm cạnh implementation; integration test ở đúng lớp integration.
- [x] Không xuất hiện dependency vòng mới.
- [ ] Desktop typecheck pass (chạy lại trước merge nếu cần).
- [ ] Desktop lint pass.
- [x] Desktop timeline + library vitest pass sau từng phase.
- [ ] Regression checklist thủ công pass.
- [x] Cây thư mục thực tế: `Tracks` đã xóa; `viewport/`, `clips/`, `drop/`, `lanes/`, `selection/`, `context-menu/` đã có. `TimelineLaneLabels` / `TimelineLaneCanvas` / `use-marquee-selection` chưa tách file riêng (vẫn trong `TimelineViewport`).

## 12. Thứ tự ưu tiên nếu cần chia nhỏ phạm vi

Nếu không thể thực hiện toàn bộ ngay, ưu tiên theo thứ tự:

1. Sửa dependency boundary của `drop-host` vì nó đang bị Library sử dụng trực tiếp.
2. Extract gesture khỏi `ClipStrip` vì đây là logic tương tác có rủi ro cao và khó bảo trì.
3. Extract viewport metrics, lane canvas và overlays khỏi `TimelineViewport`.
4. Di chuyển hotkey và virtualization về folder đã có sẵn.
5. Hoàn thiện các move nhỏ và xóa `Tracks`.

Không coi việc tạo đủ folder là hoàn thành nếu ba file lớn vẫn giữ nguyên tất cả trách nhiệm cũ.
